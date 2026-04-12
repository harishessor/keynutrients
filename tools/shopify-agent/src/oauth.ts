import http from "node:http";
import fsSync from "node:fs";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOKEN_FILE = path.join(__dirname, "..", ".shopify-token.json");

export type StoredSession = {
  access_token: string;
  shop: string;
  scope?: string;
  /** ISO timestamp when access_token expires (client_credentials tokens are short-lived). */
  expires_at?: string;
  grant?: "authorization_code" | "client_credentials";
};

export function getTokenFilePath(): string {
  return TOKEN_FILE;
}

export function readStoredSessionSync(): StoredSession | null {
  try {
    const raw = fsSync.readFileSync(TOKEN_FILE, "utf8");
    const data = JSON.parse(raw) as StoredSession;
    if (data?.access_token && data?.shop) return data;
  } catch {
    /* missing or invalid */
  }
  return null;
}

export async function writeStoredSession(session: StoredSession): Promise<void> {
  await fs.writeFile(TOKEN_FILE, JSON.stringify(session, null, 2), "utf8");
}

export async function clearStoredSession(): Promise<void> {
  try {
    await fs.unlink(TOKEN_FILE);
  } catch {
    /* ok */
  }
}

/**
 * Verify OAuth callback query per Shopify:
 * https://shopify.dev/docs/apps/auth/oauth/getting-started
 */
export function verifyOAuthHmac(
  searchParams: URLSearchParams,
  clientSecret: string
): boolean {
  const hmac = searchParams.get("hmac");
  if (!hmac) return false;
  const entries: string[] = [];
  for (const key of [...searchParams.keys()].sort()) {
    if (key === "hmac") continue;
    for (const value of searchParams.getAll(key)) {
      entries.push(`${key}=${value}`);
    }
  }
  const message = entries.join("&");
  const digest = createHmac("sha256", clientSecret).update(message).digest("hex");
  try {
    const a = Buffer.from(digest, "utf8");
    const b = Buffer.from(hmac, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Exchange authorization code for offline access token.
 * POST https://{shop}/admin/oauth/access_token
 */
export async function exchangeCodeForToken(params: {
  shop: string;
  code: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ access_token: string; scope: string }> {
  const shop = params.shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const url = `https://${shop}/admin/oauth/access_token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Token exchange failed (${res.status}): ${text.slice(0, 500)}`
    );
  }
  const json = JSON.parse(text) as { access_token?: string; scope?: string };
  if (!json.access_token) {
    throw new Error(`Token exchange returned no access_token: ${text.slice(0, 300)}`);
  }
  return {
    access_token: json.access_token,
    scope: json.scope ?? "",
  };
}

/**
 * Client credentials grant (no browser, no `code`).
 * POST https://{shop}/admin/oauth/access_token
 * Content-Type: application/x-www-form-urlencoded
 * @see https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant
 */
export async function exchangeClientCredentialsToken(params: {
  shop: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ access_token: string; scope?: string; expires_in?: number }> {
  const shop = params.shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const url = `https://${shop}/admin/oauth/access_token`;
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "client_credentials",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Client credentials token failed (${res.status}): ${text.slice(0, 500)}`
    );
  }
  const json = JSON.parse(text) as {
    access_token?: string;
    scope?: string;
    expires_in?: number;
  };
  if (!json.access_token) {
    throw new Error(
      `Client credentials response missing access_token: ${text.slice(0, 300)}`
    );
  }
  return {
    access_token: json.access_token,
    scope: json.scope,
    expires_in: json.expires_in,
  };
}

function openBrowser(url: string): void {
  const u = url.replace(/"/g, "");
  if (process.platform === "win32") {
    exec(`cmd /c start "" "${u}"`, { windowsHide: true });
  } else if (process.platform === "darwin") {
    exec(`open "${u}"`);
  } else {
    exec(`xdg-open "${u}"`);
  }
}

export type LoginOptions = {
  shop: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
};

/**
 * Starts localhost redirect server, opens browser to Shopify OAuth, saves token.
 */
export function runOAuthLogin(opts: LoginOptions): Promise<StoredSession> {
  const redirect = new URL(opts.redirectUri);
  const port = Number(redirect.port || (redirect.protocol === "https:" ? 443 : 80));
  if (!port || Number.isNaN(port)) {
    return Promise.reject(
      new Error(
        `Invalid SHOPIFY_OAUTH_REDIRECT_URI port. Use e.g. http://127.0.0.1:34568/callback (non-privileged port).`
      )
    );
  }
  const pathname = redirect.pathname || "/callback";
  const state = randomBytes(16).toString("hex");
  const shop = opts.shop.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${encodeURIComponent(opts.clientId)}` +
    `&scope=${encodeURIComponent(opts.scopes)}` +
    `&redirect_uri=${encodeURIComponent(opts.redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const host = req.headers.host ?? `127.0.0.1:${port}`;
        const url = new URL(req.url ?? "/", `http://${host}`);
        if (url.pathname !== pathname) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
          return;
        }

        const params = url.searchParams;
        const err = params.get("error");
        if (err) {
          const desc = params.get("error_description") ?? "";
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`<p>OAuth error: ${err}</p><p>${desc}</p>`);
          server.close();
          reject(new Error(`OAuth error: ${err} ${desc}`));
          return;
        }

        if (params.get("state") !== state) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<p>Invalid state</p>");
          server.close();
          reject(new Error("OAuth state mismatch"));
          return;
        }

        if (!verifyOAuthHmac(params, opts.clientSecret)) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<p>Invalid HMAC</p>");
          server.close();
          reject(new Error("OAuth HMAC verification failed"));
          return;
        }

        const code = params.get("code");
        const callbackShop = params.get("shop");
        if (!code || !callbackShop) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<p>Missing code or shop</p>");
          server.close();
          reject(new Error("OAuth callback missing code or shop"));
          return;
        }

        const normalizedCallbackShop = callbackShop.replace(/^https?:\/\//, "").replace(/\/$/, "");
        const tokenResult = await exchangeCodeForToken({
          shop: normalizedCallbackShop,
          code,
          clientId: opts.clientId,
          clientSecret: opts.clientSecret,
        });

        const session: StoredSession = {
          access_token: tokenResult.access_token,
          shop: normalizedCallbackShop,
          scope: tokenResult.scope,
          grant: "authorization_code",
        };
        await writeStoredSession(session);

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<p>Authorized. You can close this tab and return to the terminal.</p>"
        );
        server.close();
        resolve(session);
      } catch (e) {
        try {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Server error");
        } catch {
          /* ignore */
        }
        server.close();
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });

    const host = redirect.hostname || "127.0.0.1";
    server.listen(port, host, () => {
      console.error(`Listening on http://${host}:${port}${pathname} for OAuth callback…`);
      console.error("Opening browser. Approve the app in Shopify Admin.\n");
      openBrowser(authUrl);
    });

    server.on("error", (err) => {
      reject(err);
    });
  });
}

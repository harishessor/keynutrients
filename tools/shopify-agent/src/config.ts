import { readStoredSessionSync } from "./oauth.js";

function normalizeShopHost(raw: string | undefined): string {
  return (
    raw
      ?.trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "") ?? ""
  );
}

export function loadConfig() {
  const session = readStoredSessionSync();
  const envDomain = normalizeShopHost(process.env.SHOPIFY_STORE_DOMAIN);
  const envToken = process.env.SHOPIFY_ACCESS_TOKEN?.trim();

  const domain = envDomain || normalizeShopHost(session?.shop);
  const token = envToken || session?.access_token;

  const apiVersion = process.env.SHOPIFY_API_VERSION ?? "2025-10";
  if (!domain || !token) {
    throw new Error(
      "Missing Shopify credentials. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN in .env, " +
        "or set SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET and run `auth token` (client credentials) or `auth login` (browser OAuth)."
    );
  }
  return { domain, token, apiVersion };
}

export function loadPartnerAppCredentials(): {
  shop: string;
  clientId: string;
  clientSecret: string;
} {
  const shop = normalizeShopHost(process.env.SHOPIFY_STORE_DOMAIN);
  const clientId =
    process.env.SHOPIFY_CLIENT_ID?.trim().replace(/\s+#.*$/, "") ?? "";
  const clientSecret =
    process.env.SHOPIFY_CLIENT_SECRET?.trim().replace(/\s+#.*$/, "") ?? "";

  if (!shop) {
    throw new Error("SHOPIFY_STORE_DOMAIN is required (e.g. keynutrients.myshopify.com).");
  }
  if (!clientId || !clientSecret) {
    throw new Error(
      "SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET are required (Partner app credentials)."
    );
  }
  return { shop, clientId, clientSecret };
}

export function loadOAuthAppConfig(): {
  shop: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const base = loadPartnerAppCredentials();
  const redirectUri =
    process.env.SHOPIFY_OAUTH_REDIRECT_URI?.trim() ||
    "http://127.0.0.1:34568/callback";
  return { ...base, redirectUri };
}

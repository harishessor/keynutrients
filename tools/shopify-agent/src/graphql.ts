import { loadConfig } from "./config.js";

export type GraphqlError = { message: string; extensions?: { code?: string } };

export async function adminGraphql<T extends Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const { domain, token, apiVersion } = loadConfig();
  const url = `https://${domain}/admin/api/${apiVersion}/graphql.json`;
  const maxAttempts = 5;
  let attempt = 0;
  while (true) {
    attempt++;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 429 && attempt < maxAttempts) {
      const retryAfter = Number(res.headers.get("retry-after")) || Math.min(2 ** attempt, 30);
      await sleep(retryAfter * 1000);
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify HTTP ${res.status}: ${text.slice(0, 500)}`);
    }
    const body = (await res.json()) as {
      data?: T;
      errors?: GraphqlError[];
    };
    if (body.errors?.length) {
      const msg = body.errors.map((e) => e.message).join("; ");
      throw new Error(`Shopify GraphQL: ${msg}`);
    }
    if (!body.data) {
      throw new Error("Shopify GraphQL: empty response");
    }
    return body.data;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

# Shopify agent (prototype)

Small Node CLI that talks to the **Shopify Admin GraphQL API**. First capability: **append** images to a product’s media gallery using staged uploads.

Theme files in this repo still deploy via GitHub → Shopify as usual; this tool does **not** push theme assets.

## Authentication (pick one)

### A. Custom app token (simplest)

1. Shopify Admin → **Settings** → **Apps and sales channels** → **Develop apps**.
2. Create an app, configure **Admin API** scopes: `read_products`, `write_products`.
3. Install the app and copy the **Admin API access token** into `SHOPIFY_ACCESS_TOKEN`.

### B. OAuth (Partner app — “dual” / browser login)

Use this when you authenticate via Shopify’s OAuth flow instead of pasting a static token.

1. In **[Shopify Partners](https://partners.shopify.com/)**, create an app (or use an existing one) and note **Client ID** and **Client secret**.
2. Under **App setup** → **Allowed redirection URL(s)**, add the same value as `SHOPIFY_OAUTH_REDIRECT_URI` (default: `http://127.0.0.1:34568/callback`).
3. Set **Admin API** scopes to at least `read_products`, `write_products`.
4. In `.env`: `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, and optionally `SHOPIFY_OAUTH_REDIRECT_URI`. Leave `SHOPIFY_ACCESS_TOKEN` empty if you want to use OAuth only.
5. Run:

```bash
npm run build
node dist/cli.js auth login
```

The CLI opens your browser, you approve the app, then it saves **`tools/shopify-agent/.shopify-token.json`** (gitignored).

**Token exchange endpoint (Shopify):** `POST https://{shop}/admin/oauth/access_token` — not `/admin/oauth/access`. The CLI calls this after you return from `/admin/oauth/authorize`.

```bash
node dist/cli.js auth status   # env token vs OAuth file
node dist/cli.js auth logout   # delete .shopify-token.json
```

If `SHOPIFY_ACCESS_TOKEN` is set in `.env`, it **overrides** the OAuth file.

### C. Client credentials (Partner app — no browser, no `code`)

For apps that **you** develop and that are **installed** on your store, Shopify supports the **client credentials** grant: same URL `POST https://{shop}/admin/oauth/access_token`, but the body is `application/x-www-form-urlencoded` with `client_id`, `client_secret`, and `grant_type=client_credentials` (no authorization `code`). See Shopify’s [Client credentials grant](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant).

1. Partner app with Admin API scopes configured; app **installed** on the target shop.
2. `.env`: `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`. Leave `SHOPIFY_ACCESS_TOKEN` empty to use the saved session file.
3. Run:

```bash
npm run build
node dist/cli.js auth token
```

Tokens from this grant are often **short-lived**; re-run `auth token` when expired (check `auth status` for `expires_at`).

## Setup

```bash
cd tools/shopify-agent
cp .env.example .env
# Edit .env — never commit .env
npm install
npm run build
```

Create a local drop folder (gitignored):

```bash
mkdir incoming
```

## Naming conventions

**Flat (default)** — files directly under `incoming/`:

- Pattern: `{product-handle}__{sort-key}.{ext}`
- Example: `electrolyte-powder-lemon__01-hero.webp`
- `__` separates handle from the rest; sort key keeps order (e.g. `01`, `02` or `01-lifestyle`).
- Extensions: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`

**By folder** — `incoming/{handle}/01.webp`, `02.jpg`, …

**Optional** `incoming/upload-manifest.json` — extra paths per handle (merged with scanned files):

```json
{
  "my-product-handle": ["./one-off/hero.png", "../Desktop/extra.jpg"]
}
```

Paths are relative to the manifest file.

## Web UI (pick product + images)

Local browser UI — search products, select one, choose image file(s), upload. Listens on **127.0.0.1** only (not reachable from other machines by default).

```bash
npm run build
npm run ui
```

Open **http://127.0.0.1:3847** (or set `SHOPIFY_AGENT_UI_PORT` / `SHOPIFY_AGENT_UI_HOST` in `.env`). Same credentials as the CLI (`SHOPIFY_ACCESS_TOKEN` or `auth token` session).

Dev without building the UI server:

```bash
npm run dev:ui
```

Optional env: `SHOPIFY_AGENT_UI_MAX_MB` (default `20`) for upload size limit.

## Commands

From `tools/shopify-agent` (after `npm run build`):

```bash
# Preview (still calls Admin API to resolve products)
node dist/cli.js product-gallery upload --from ./incoming --layout flat --dry-run

# Upload for real
node dist/cli.js product-gallery upload --from ./incoming --layout flat

# Folder per product
node dist/cli.js product-gallery upload --from ./incoming --layout by-folder

# Explicit files
node dist/cli.js product-gallery upload --product my-handle --files ./a.webp ./b.jpg
```

Dev without build:

```bash
npm run dev -- product-gallery upload --from ./incoming --dry-run
```

## Safety

- **Append-only:** new images are added; existing gallery images are not removed.
- `productCreateMedia` is deprecated in Shopify’s docs but remains the safest **additive** API for this prototype. Migrate to `productSet` later if you need full sync semantics (list fields can replace, not merge).

## Future actions

Add more subcommands beside `product-gallery` (prices, tags, metafields) in the same package.

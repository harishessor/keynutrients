#!/usr/bin/env node
import { config as loadDotenv } from "dotenv";
import { Command } from "commander";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, loadOAuthAppConfig, loadPartnerAppCredentials } from "./config.js";
import {
  runOAuthLogin,
  readStoredSessionSync,
  clearStoredSession,
  getTokenFilePath,
  exchangeClientCredentialsToken,
  writeStoredSession,
  type StoredSession,
} from "./oauth.js";
import {
  resolveFromIncoming,
  resolveExplicitFiles,
} from "./resolve-sources.js";
import { uploadGalleryJobs } from "./upload-gallery.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(__dirname, "..", ".env") });

const program = new Command();
program
  .name("shopify-agent")
  .description("Local CLI for Shopify Admin actions (prototype)")
  .version("0.1.0");

const auth = program.command("auth").description("Partner app tokens (OAuth + client credentials)");

auth
  .command("token")
  .description(
    "Client credentials grant (no browser): POST /admin/oauth/access_token with grant_type=client_credentials"
  )
  .action(async () => {
    try {
      const creds = loadPartnerAppCredentials();
      const normalizedShop = creds.shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const r = await exchangeClientCredentialsToken({
        shop: normalizedShop,
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
      });
      const session: StoredSession = {
        access_token: r.access_token,
        shop: normalizedShop,
        scope: r.scope,
        grant: "client_credentials",
      };
      if (r.expires_in != null && Number.isFinite(r.expires_in)) {
        session.expires_at = new Date(
          Date.now() + r.expires_in * 1000
        ).toISOString();
      }
      await writeStoredSession(session);
      console.log("Session saved:", getTokenFilePath());
      if (session.expires_at) console.log("Token expires_at:", session.expires_at);
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    }
  });

auth
  .command("login")
  .description("Browser OAuth; saves token to .shopify-token.json")
  .option(
    "--scopes <scopes>",
    "comma-separated Admin API scopes",
    "read_products,write_products"
  )
  .action(async (opts: { scopes: string }) => {
    try {
      const app = loadOAuthAppConfig();
      await runOAuthLogin({
        shop: app.shop,
        clientId: app.clientId,
        clientSecret: app.clientSecret,
        redirectUri: app.redirectUri,
        scopes: opts.scopes,
      });
      console.log("Session saved:", getTokenFilePath());
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    }
  });

auth
  .command("logout")
  .description("Delete .shopify-token.json")
  .action(async () => {
    await clearStoredSession();
    console.log("Removed OAuth session file (if present).");
  });

auth
  .command("status")
  .description("Show whether .env token or OAuth session is active")
  .action(() => {
    const envTok = process.env.SHOPIFY_ACCESS_TOKEN?.trim();
    const s = readStoredSessionSync();
    if (envTok) {
      console.log("Active: SHOPIFY_ACCESS_TOKEN from .env (overrides OAuth file).");
    } else if (s) {
      console.log(`Active: saved session — shop=${s.shop}`);
      if (s.grant) console.log(`  grant: ${s.grant}`);
      if (s.scope) console.log(`  scopes: ${s.scope}`);
      if (s.expires_at) console.log(`  expires_at: ${s.expires_at}`);
    } else {
      console.log("No token. Set SHOPIFY_ACCESS_TOKEN or run: auth token | auth login");
    }
  });

const productGallery = program
  .command("product-gallery")
  .description("Product media gallery helpers");

productGallery
  .command("upload")
  .description("Upload images to product media (append-only)")
  .option("--from <dir>", "Incoming folder (default: ./incoming)", "incoming")
  .option("--layout <mode>", "flat | by-folder", "flat")
  .option("--product <handle>", "Single product handle (use with --files)")
  .option("--files <paths...>", "Image paths when using --product")
  .option("--dry-run", "Resolve products and list planned uploads only", false)
  .action(
    async (opts: {
      from: string;
      layout: string;
      product?: string;
      files?: string[];
      dryRun: boolean;
    }) => {
      loadConfig();
      const cwd = process.cwd();
      const dryRun = Boolean(opts.dryRun);
      let jobs;

      if (opts.product) {
        if (!opts.files?.length) {
          console.error("With --product, pass at least one path with --files.");
          process.exit(1);
        }
        jobs = [await resolveExplicitFiles(opts.product, opts.files)];
      } else {
        const incoming = path.resolve(cwd, opts.from);
        const layout = opts.layout === "by-folder" ? "by-folder" : "flat";
        if (opts.layout !== "flat" && opts.layout !== "by-folder") {
          console.error("--layout must be flat or by-folder");
          process.exit(1);
        }
        jobs = await resolveFromIncoming(incoming, layout);
      }

      await uploadGalleryJobs({ dryRun, jobs });
    }
  );

program.parse();

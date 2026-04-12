#!/usr/bin/env node
/**
 * Local-only web UI for picking a product and uploading image(s).
 * Binds 127.0.0.1 by default — not exposed to the network.
 */
import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import { loadConfig } from "./config.js";
import { searchProducts } from "./product-media.js";
import { uploadBuffersToProductByHandle } from "./upload-single.js";
import { mimeForPath } from "./resolve-sources.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(__dirname, "..", ".env") });

const PORT = Number(process.env.SHOPIFY_AGENT_UI_PORT ?? "3847");
const HOST = process.env.SHOPIFY_AGENT_UI_HOST ?? "127.0.0.1";
const MAX_MB = Number(process.env.SHOPIFY_AGENT_UI_MAX_MB ?? "20");

function main() {
  try {
    loadConfig();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MB * 1024 * 1024, files: 10 },
  });

  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/api/products", async (req, res) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : "";
      const first = Math.min(Number(req.query.first) || 30, 50);
      const products = await searchProducts(q, first);
      res.json({ products });
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.post(
    "/api/upload",
    upload.array("images", 10),
    async (req, res) => {
      try {
        const handle =
          typeof req.body?.handle === "string" ? req.body.handle.trim() : "";
        if (!handle) {
          res.status(400).json({ error: "Missing product handle" });
          return;
        }
        const files = req.files as Express.Multer.File[] | undefined;
        if (!files?.length) {
          res.status(400).json({ error: "Choose at least one image file" });
          return;
        }
        const alt =
          typeof req.body?.alt === "string" ? req.body.alt.trim() : undefined;

        const memoryFiles = files.map((f) => ({
          buffer: f.buffer,
          filename: f.originalname.replace(/[^\w.\-()+ ]/g, "_") || "upload.jpg",
          mimeType: f.mimetype || mimeForPath(f.originalname),
          alt: alt || undefined,
        }));

        const result = await uploadBuffersToProductByHandle(handle, memoryFiles);
        res.json({
          ok: true,
          title: result.title,
          productId: result.productId,
          uploaded: result.count,
        });
      } catch (e) {
        res.status(500).json({
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  );

  app.listen(PORT, HOST, () => {
    console.log(`Shopify agent UI: http://${HOST}:${PORT}`);
    console.log("Press Ctrl+C to stop.");
  });
}

main();

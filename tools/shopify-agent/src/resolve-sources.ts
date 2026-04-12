import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

export type ResolvedFile = {
  absolutePath: string;
  /** Used for sort order within a product */
  sortKey: string;
  /** Suggested alt text */
  alt: string;
};

export type ProductUploadJob = {
  handle: string;
  files: ResolvedFile[];
};

function isImageFile(name: string): boolean {
  return IMAGE_EXT.has(path.extname(name).toLowerCase());
}

function mimeForPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  return map[ext] ?? "application/octet-stream";
}

export { mimeForPath };

/**
 * Flat files: `my-product-handle__01-hero.webp` → handle + sortable key.
 */
const FLAT_PATTERN = /^(.+?)__(.+)\.(jpe?g|png|gif|webp)$/i;

export async function resolveFlatLayout(incomingDir: string): Promise<ProductUploadJob[]> {
  const entries = await readdir(incomingDir, { withFileTypes: true });
  const byHandle = new Map<string, ResolvedFile[]>();
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const m = ent.name.match(FLAT_PATTERN);
    if (!m || !isImageFile(ent.name)) continue;
    const handle = m[1].toLowerCase();
    const middle = m[2];
    const abs = path.join(incomingDir, ent.name);
    const list = byHandle.get(handle) ?? [];
    list.push({
      absolutePath: abs,
      sortKey: middle,
      alt: middle.replace(/-/g, " "),
    });
    byHandle.set(handle, list);
  }
  return sortAndPack(byHandle);
}

export async function resolveByFolderLayout(incomingDir: string): Promise<ProductUploadJob[]> {
  const entries = await readdir(incomingDir, { withFileTypes: true });
  const byHandle = new Map<string, ResolvedFile[]>();
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const handle = ent.name.toLowerCase();
    const sub = path.join(incomingDir, ent.name);
    const files = (await readdir(sub)).filter(isImageFile).sort();
    const list: ResolvedFile[] = [];
    for (const name of files) {
      const base = path.basename(name, path.extname(name));
      list.push({
        absolutePath: path.join(sub, name),
        sortKey: name,
        alt: base.replace(/-/g, " "),
      });
    }
    if (list.length) byHandle.set(handle, list);
  }
  return sortAndPack(byHandle);
}

async function loadManifest(
  manifestPath: string
): Promise<Record<string, string[]> | null> {
  try {
    const raw = await readFile(manifestPath, "utf8");
    const data = JSON.parse(raw) as unknown;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return data as Record<string, string[]>;
    }
  } catch {
    /* no manifest */
  }
  return null;
}

export async function resolveFromIncoming(
  incomingDir: string,
  layout: "flat" | "by-folder"
): Promise<ProductUploadJob[]> {
  const manifestPath = path.join(incomingDir, "upload-manifest.json");
  const manifest = await loadManifest(manifestPath);
  const baseJobs =
    layout === "by-folder"
      ? await resolveByFolderLayout(incomingDir)
      : await resolveFlatLayout(incomingDir);

  if (!manifest) {
    return baseJobs;
  }

  const manifestDir = path.dirname(manifestPath);
  const merged = new Map<string, ResolvedFile[]>();
  for (const job of baseJobs) {
    merged.set(job.handle, [...job.files]);
  }

  for (const [handle, relPaths] of Object.entries(manifest)) {
    if (!Array.isArray(relPaths)) continue;
    const list: ResolvedFile[] = [];
    let i = 0;
    for (const rel of relPaths) {
      const abs = path.resolve(manifestDir, rel);
      try {
        const st = await stat(abs);
        if (!st.isFile()) continue;
      } catch {
        continue;
      }
      if (!isImageFile(abs)) continue;
      const base = path.basename(abs, path.extname(abs));
      list.push({
        absolutePath: abs,
        sortKey: `manifest-${String(++i).padStart(3, "0")}-${base}`,
        alt: base.replace(/-/g, " "),
      });
    }
    if (list.length) {
      const existing = merged.get(handle) ?? [];
      merged.set(handle, [...existing, ...list]);
    }
  }

  return sortAndPack(merged);
}

function sortAndPack(byHandle: Map<string, ResolvedFile[]>): ProductUploadJob[] {
  const jobs: ProductUploadJob[] = [];
  for (const [handle, files] of byHandle) {
    files.sort((a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { numeric: true }));
    jobs.push({ handle, files });
  }
  jobs.sort((a, b) => a.handle.localeCompare(b.handle));
  return jobs;
}

export async function resolveExplicitFiles(
  handle: string,
  filePaths: string[]
): Promise<ProductUploadJob> {
  const files: ResolvedFile[] = [];
  let i = 0;
  for (const p of filePaths) {
    const abs = path.resolve(p);
    const st = await stat(abs);
    if (!st.isFile()) throw new Error(`Not a file: ${abs}`);
    if (!isImageFile(abs)) throw new Error(`Not a supported image: ${abs}`);
    const base = path.basename(abs, path.extname(abs));
    files.push({
      absolutePath: abs,
      sortKey: `cli-${String(++i).padStart(3, "0")}-${base}`,
      alt: base.replace(/-/g, " "),
    });
  }
  return { handle: handle.toLowerCase(), files };
}

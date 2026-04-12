import path from "node:path";
import { stat } from "node:fs/promises";
import {
  appendProductMedia,
  getProductIdByHandle,
  type MediaItem,
} from "./product-media.js";
import { createStagedTargets, postFileToStagedTarget } from "./staged-upload.js";
import { mimeForPath, type ProductUploadJob } from "./resolve-sources.js";

export type UploadGalleryOptions = {
  dryRun: boolean;
  jobs: ProductUploadJob[];
};

export async function uploadGalleryJobs(options: UploadGalleryOptions): Promise<void> {
  const { dryRun, jobs } = options;
  if (jobs.length === 0) {
    console.log("No products / files to upload.");
    return;
  }

  for (const job of jobs) {
    if (job.files.length === 0) continue;

    console.log(`\n— Product handle: ${job.handle} (${job.files.length} file(s))`);

    const metas: { filename: string; mimeType: string; filePath: string; alt: string; size: number }[] = [];
    for (const f of job.files) {
      const st = await stat(f.absolutePath);
      const filename = path.basename(f.absolutePath);
      metas.push({
        filename,
        mimeType: mimeForPath(f.absolutePath),
        filePath: f.absolutePath,
        alt: f.alt,
        size: st.size,
      });
    }

    if (dryRun) {
      const { id, title } = await getProductIdByHandle(job.handle);
      console.log(`  [dry-run] Would upload to: ${title} (${id})`);
      for (const m of metas) {
        console.log(`    • ${m.filename} (${m.mimeType}, ${m.size} bytes)`);
      }
      continue;
    }

    const { id, title } = await getProductIdByHandle(job.handle);
    console.log(`  Target: ${title}`);

    const targets = await createStagedTargets(
      metas.map((m) => ({ filename: m.filename, mimeType: m.mimeType }))
    );

    for (let i = 0; i < targets.length; i++) {
      const m = metas[i];
      const t = targets[i];
      console.log(`  Staging upload: ${m.filename}`);
      await postFileToStagedTarget(t, m.filePath, m.filename);
    }

    const mediaItems: MediaItem[] = targets.map((t, i) => ({
      resourceUrl: t.resourceUrl,
      alt: metas[i].alt,
      filename: metas[i].filename,
    }));

    console.log(`  Attaching ${mediaItems.length} image(s) to product…`);
    await appendProductMedia(id, mediaItems);
    console.log(`  Done.`);
  }
}

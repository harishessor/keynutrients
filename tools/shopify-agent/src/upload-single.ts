import { appendProductMedia, getProductIdByHandle, type MediaItem } from "./product-media.js";
import { createStagedTargets, postBufferToStagedTarget } from "./staged-upload.js";

export type MemoryUploadFile = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  alt?: string;
};

/**
 * Upload one or more in-memory images to a product by handle (append-only).
 */
export async function uploadBuffersToProductByHandle(
  handle: string,
  files: MemoryUploadFile[]
): Promise<{ title: string; productId: string; count: number }> {
  if (files.length === 0) {
    throw new Error("No files to upload");
  }
  const { id, title } = await getProductIdByHandle(handle);
  const targets = await createStagedTargets(
    files.map((f) => ({ filename: f.filename, mimeType: f.mimeType }))
  );
  for (let i = 0; i < targets.length; i++) {
    await postBufferToStagedTarget(targets[i], files[i].buffer, files[i].filename);
  }
  const mediaItems: MediaItem[] = targets.map((t, i) => ({
    resourceUrl: t.resourceUrl,
    alt: files[i].alt?.trim() || files[i].filename,
    filename: files[i].filename,
  }));
  await appendProductMedia(id, mediaItems);
  return { title, productId: id, count: files.length };
}

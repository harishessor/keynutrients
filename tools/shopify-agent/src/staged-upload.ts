import { readFile } from "node:fs/promises";
import { adminGraphql } from "./graphql.js";

export type StagedTarget = {
  url: string;
  resourceUrl: string;
  parameters: { name: string; value: string }[];
};

const STAGED_MUTATION = `
mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
  stagedUploadsCreate(input: $input) {
    stagedTargets {
      url
      resourceUrl
      parameters { name value }
    }
    userErrors { field message }
  }
}`;

export async function createStagedTargets(
  files: { filename: string; mimeType: string }[]
): Promise<StagedTarget[]> {
  const input = files.map((f) => ({
    filename: f.filename,
    mimeType: f.mimeType,
    httpMethod: "POST",
    resource: "IMAGE",
  }));
  const data = await adminGraphql<{
    stagedUploadsCreate: {
      stagedTargets: StagedTarget[] | null;
      userErrors: { field: string[] | null; message: string }[];
    };
  }>(STAGED_MUTATION, { input });
  const payload = data.stagedUploadsCreate;
  if (payload.userErrors?.length) {
    throw new Error(
      `stagedUploadsCreate: ${payload.userErrors.map((e) => e.message).join("; ")}`
    );
  }
  const targets = payload.stagedTargets ?? [];
  if (targets.length !== files.length) {
    throw new Error(`stagedUploadsCreate: expected ${files.length} targets, got ${targets.length}`);
  }
  return targets;
}

export async function postBufferToStagedTarget(
  target: StagedTarget,
  buffer: Buffer,
  filename: string
): Promise<void> {
  const form = new FormData();
  for (const { name, value } of target.parameters) {
    form.append(name, value);
  }
  form.append("file", new Blob([new Uint8Array(buffer)]), filename);
  const res = await fetch(target.url, { method: "POST", body: form });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Staged upload failed (${res.status}): ${t.slice(0, 300)}`);
  }
}

export async function postFileToStagedTarget(
  target: StagedTarget,
  filePath: string,
  filename: string
): Promise<void> {
  const buffer = await readFile(filePath);
  await postBufferToStagedTarget(target, buffer, filename);
}

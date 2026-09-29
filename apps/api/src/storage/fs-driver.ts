import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { StorageDriver } from "./index";

const ROOT = path.resolve(
  process.env.STORAGE_FS_ROOT ?? path.join(process.cwd(), ".data", "storage"),
);

// CRITICAL: block path traversal. Keys come from buildDocumentKey (sanitized),
// but defence-in-depth — never write/read outside ROOT.
function resolveSafe(key: string): string {
  const full = path.resolve(ROOT, key);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
    throw new Error("Invalid storage key (path traversal)");
  }
  return full;
}

export const fsDriver: StorageDriver = {
  async put(key, data) {
    const full = resolveSafe(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data); // data: Buffer (from multipart) or Readable
  },
  async get(key) {
    const full = resolveSafe(key);
    const s = await stat(full);
    return {
      body: Readable.toWeb(createReadStream(full)) as ReadableStream,
      contentLength: s.size,
      lastModified: s.mtime,
    };
  },
  async delete(key) {
    await unlink(resolveSafe(key)).catch(() => {}); // idempotent
  },
};

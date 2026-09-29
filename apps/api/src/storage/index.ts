import type { Readable } from "node:stream";
import { fsDriver } from "./fs-driver";

export type StorageObject = {
  body: ReadableStream | Readable;
  contentLength?: number;
  lastModified?: Date;
};

export interface StorageDriver {
  put(key: string, data: Buffer | Readable, contentType: string): Promise<void>;
  get(key: string): Promise<StorageObject>;
  delete(key: string): Promise<void>;
}

// Documents store bytes on the server filesystem (not S3). The presigned-S3
// flow in s3.ts is left untouched for cheap upstream merges; this thin adapter
// is the seam both drivers can satisfy. Only the fs driver exists today.
export const storage: StorageDriver =
  (process.env.STORAGE_DRIVER ?? "fs") === "fs" ? fsDriver : fsDriver;

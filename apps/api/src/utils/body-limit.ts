import { bodyLimit } from "hono/body-limit";

const MB = 1024 * 1024;

// Room for multipart boundaries and the other form fields next to the file.
const MULTIPART_OVERHEAD_BYTES = MB;

export const defaultBodyLimit = bodyLimit({
  maxSize: 10 * MB,
  onError: (c) => c.json({ message: "Request body is too large" }, 413),
});

// Stops an oversized upload while it streams in, before parseBody buffers it.
export function uploadBodyLimit(maxFileBytes: number) {
  return bodyLimit({
    maxSize: maxFileBytes + MULTIPART_OVERHEAD_BYTES,
    onError: (c) => c.json({ message: "Upload is too large" }, 413),
  });
}

// Upload routes apply uploadBodyLimit themselves.
const uploadRoutes = [
  /^\/api\/document\/[^/]+$/,
  /^\/api\/task\/asset\/[^/]+$/,
];

export function isUploadRoute(method: string, path: string) {
  return method === "POST" && uploadRoutes.some((route) => route.test(path));
}

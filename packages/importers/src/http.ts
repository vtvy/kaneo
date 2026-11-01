import type { FetchLike } from "./types.js";

export class SourceHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "SourceHttpError";
  }
}

export type JsonClientOptions = {
  service: string;
  baseUrl: string;
  headers: () => Record<string, string>;
  fetch?: FetchLike;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxRetries?: number;
  describeUnauthorized?: string;
};

export type JsonClient = {
  request<T>(path: string, init?: RequestInit): Promise<T>;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 5;
const MAX_RETRY_WAIT_MS = 60_000;

export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//${url.host}${path}`;
  } catch {
    return withProtocol;
  }
}

export function createJsonClient(options: JsonClientOptions): JsonClient {
  const fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const headers = new Headers(init?.headers);
      for (const [name, value] of Object.entries(options.headers())) {
        headers.set(name, value);
      }
      headers.set("Accept", "application/json");
      if (init?.body != null && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      const signals = [AbortSignal.timeout(timeoutMs)];
      if (options.signal) signals.push(options.signal);

      let res: Response;
      try {
        res = await fetchImpl(`${options.baseUrl}${path}`, {
          ...init,
          headers,
          signal: AbortSignal.any(signals),
        });
      } catch (error) {
        if (options.signal?.aborted) throw error;
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`${options.service} ${stripQuery(path)}: ${reason}`);
      }

      if (res.status === 429 && attempt < maxRetries) {
        await res.body?.cancel();
        await wait(retryDelayMs(res.headers, attempt), options.signal);
        continue;
      }

      const body = await readBody(res, options.service);
      if (!res.ok) {
        throw new SourceHttpError(
          `${options.service} ${stripQuery(path)}: ${describeError(
            body,
            res.status,
            options,
          )}`,
          res.status,
          body,
        );
      }

      return body as T;
    }
  }

  return { request };
}

export function retryDelayMs(headers: Headers, attempt: number): number {
  const retryAfter = headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return clampWait(seconds * 1000);
    const date = Date.parse(retryAfter);
    if (!Number.isNaN(date)) return clampWait(date - Date.now());
  }

  const reset =
    headers.get("x-ratelimit-reset") ?? headers.get("x-rate-limit-reset");
  if (reset) {
    const value = Number(reset);
    if (Number.isFinite(value)) {
      const resetMs = value > 1e12 ? value : value * 1000;
      if (resetMs > Date.now()) return clampWait(resetMs - Date.now());
    }
  }

  return clampWait(2 ** attempt * 1000);
}

function clampWait(ms: number): number {
  return Math.min(MAX_RETRY_WAIT_MS, Math.max(250, ms));
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// One response larger than this is not a page of project data; stop reading
// rather than buffer an unbounded body from a server the user picked.
export const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;

async function readText(res: Response, service: string): Promise<string> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    await res.body?.cancel().catch(() => {});
    throw new Error(`${service} sent a response that is too large.`);
  }
  if (!res.body) return "";

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => {});
      throw new Error(`${service} sent a response that is too large.`);
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function readBody(res: Response, service: string): Promise<unknown> {
  const text = await readText(res, service);
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

// Error bodies come from a server the user picked; only a short excerpt may
// end up in a message that is shown or stored.
const MAX_ERROR_TEXT = 200;

function truncateText(text: string): string {
  return text.length > MAX_ERROR_TEXT
    ? `${text.slice(0, MAX_ERROR_TEXT)}…`
    : text;
}

function stripQuery(path: string): string {
  const index = path.indexOf("?");
  return index === -1 ? path : path.slice(0, index);
}

function describeError(
  body: unknown,
  status: number,
  options: JsonClientOptions,
): string {
  if (status === 401) {
    return (
      options.describeUnauthorized ??
      `unauthorized (HTTP 401), check your ${options.service} credentials`
    );
  }
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    for (const key of ["message", "problem", "error", "detail"]) {
      const value = record[key];
      if (typeof value === "string" && value.length > 0) {
        return truncateText(value);
      }
    }
  }
  if (typeof body === "string" && body.length > 0 && !/^\s*</.test(body)) {
    return truncateText(body);
  }
  return `HTTP ${status}`;
}

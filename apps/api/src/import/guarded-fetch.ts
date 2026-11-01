import type { FetchLike } from "@kaneo/importers";
import { assertPublicDestination } from "../utils/assert-public-destination";
import { publicFetch } from "../utils/public-fetch";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_CAUSE_DEPTH = 5;

export type GuardFailure =
  | { kind: "destination"; message: string }
  | { kind: "unreachable"; host: string };

export type GuardedFetch = {
  fetch: FetchLike;
  failure(): GuardFailure | null;
  lastHost(): string | null;
  reset(): void;
};

type GuardOptions = {
  cancelSignal?: AbortSignal;
  baseFetch?: FetchLike;
  checkDestination?: (url: string, label: string) => Promise<void>;
};

class GuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportDestinationError";
  }
}

function errorCode(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}

// publicFetch's connect-time lookup refuses private addresses with this
// message; it can arrive wrapped in undici's "fetch failed" TypeError.
function isBlockedAtConnect(error: unknown) {
  let current = error;
  for (let depth = 0; current && depth < MAX_CAUSE_DEPTH; depth++) {
    if (
      current instanceof Error &&
      current.message.includes("non-routable address")
    ) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * fetch for a user-supplied import source. Every request is checked against
 * the public-destination rules before it is sent and again when the socket
 * connects (publicFetch), and redirects are never followed: a public host
 * could otherwise bounce the request, with its credentials, elsewhere.
 */
export function createGuardedFetch(
  label: string,
  {
    cancelSignal,
    baseFetch = publicFetch,
    checkDestination = assertPublicDestination,
  }: GuardOptions = {},
): GuardedFetch {
  let failure: GuardFailure | null = null;
  let lastHost: string | null = null;

  function fail(next: GuardFailure, message: string): never {
    failure = next;
    throw new GuardError(message);
  }

  function parse(input: string) {
    try {
      return new URL(input);
    } catch {
      const message = `Enter a valid ${label} URL.`;
      return fail({ kind: "destination", message }, message);
    }
  }

  const guarded: FetchLike = async (input, init = {}) => {
    const url = parse(input);
    lastHost = url.host;

    try {
      await checkDestination(url.href, label);
    } catch (error) {
      if (errorCode(error)) {
        fail(
          { kind: "unreachable", host: url.host },
          `${label} at ${url.host} could not be resolved`,
        );
      }
      const message =
        error instanceof Error ? error.message : `${label} URL is not allowed`;
      fail({ kind: "destination", message }, message);
    }

    let response: Response;
    try {
      response = await baseFetch(url.href, { ...init, redirect: "manual" });
    } catch (error) {
      if (isBlockedAtConnect(error)) {
        const message = `${label} destination resolves to a non-routable address`;
        fail({ kind: "destination", message }, message);
      }
      if (!cancelSignal?.aborted) {
        failure = { kind: "unreachable", host: url.host };
      }
      throw error;
    }

    if (
      REDIRECT_STATUSES.has(response.status) ||
      response.type === "opaqueredirect"
    ) {
      await response.body?.cancel().catch(() => {});
      const message = `${label} redirected the request. Enter the address the site finally opens at, including https://.`;
      fail({ kind: "destination", message }, message);
    }

    failure = null;
    return response;
  };

  return {
    fetch: guarded,
    failure: () => failure,
    lastHost: () => lastHost,
    reset: () => {
      failure = null;
    },
  };
}

import { describe, expect, it, vi } from "vitest";
import { createGuardedFetch } from "../../../apps/api/src/import/guarded-fetch";
import { describeImportError } from "../../../apps/api/src/import/source/describe-import-error";

const allow = async () => {};

function describe502(
  guard: ReturnType<typeof createGuardedFetch>,
  error: unknown,
) {
  return describeImportError(error, {
    sourceName: "Jira",
    credentialHint: "Check the API token.",
    failure: guard.failure(),
    lastHost: guard.lastHost(),
    secrets: ["secret-token"],
  });
}

describe("createGuardedFetch", () => {
  it("checks the destination, then fetches without following redirects", async () => {
    const checkDestination = vi.fn(allow);
    const baseFetch = vi.fn(async () => new Response("{}", { status: 200 }));
    const guard = createGuardedFetch("Jira", { baseFetch, checkDestination });

    const response = await guard.fetch("https://jira.example.com/rest", {
      headers: { Authorization: "Bearer secret-token" },
    });

    expect(response.status).toBe(200);
    expect(checkDestination).toHaveBeenCalledWith(
      "https://jira.example.com/rest",
      "Jira",
    );
    expect(baseFetch).toHaveBeenCalledWith(
      "https://jira.example.com/rest",
      expect.objectContaining({ redirect: "manual" }),
    );
    expect(guard.failure()).toBeNull();
  });

  it("refuses a destination the public-destination check rejects", async () => {
    const baseFetch = vi.fn();
    const guard = createGuardedFetch("PLANKA", {
      baseFetch,
      checkDestination: async () => {
        throw new Error(
          "PLANKA destination resolves to a non-routable address",
        );
      },
    });

    await expect(guard.fetch("http://10.0.0.5/api")).rejects.toThrow(
      "non-routable",
    );
    expect(baseFetch).not.toHaveBeenCalled();
    expect(guard.failure()).toEqual({
      kind: "destination",
      message: "PLANKA destination resolves to a non-routable address",
    });
  });

  it("reports a name that does not resolve as unreachable", async () => {
    const guard = createGuardedFetch("Jira", {
      baseFetch: vi.fn(),
      checkDestination: async () => {
        throw Object.assign(new Error("getaddrinfo ENOTFOUND"), {
          code: "ENOTFOUND",
        });
      },
    });

    const error = await guard
      .fetch("https://nope.example.com/x")
      .catch((caught: unknown) => caught);
    expect(describe502(guard, error)).toEqual({
      status: 502,
      message: "Could not reach Jira at nope.example.com.",
    });
  });

  it("does not follow a redirect, even to a public host", async () => {
    const baseFetch = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest" },
        }),
    );
    const guard = createGuardedFetch("Jira", {
      baseFetch,
      checkDestination: allow,
    });

    await expect(guard.fetch("https://jira.example.com/x")).rejects.toThrow(
      "redirected",
    );
    expect(baseFetch).toHaveBeenCalledTimes(1);
    expect(guard.failure()?.kind).toBe("destination");
  });

  it("maps a connect-time block from publicFetch to a destination error", async () => {
    const guard = createGuardedFetch("Jira", {
      baseFetch: async () => {
        throw new TypeError("fetch failed", {
          cause: new Error("Destination resolves to a non-routable address"),
        });
      },
      checkDestination: allow,
    });

    const error = await guard
      .fetch("https://rebind.example.com/x")
      .catch((caught: unknown) => caught);
    expect(describe502(guard, error)).toEqual({
      status: 400,
      message: "Jira destination resolves to a non-routable address",
    });
  });

  it("rejects a URL it cannot parse", async () => {
    const guard = createGuardedFetch("Jira", {
      baseFetch: vi.fn(),
      checkDestination: allow,
    });
    await expect(guard.fetch("not a url")).rejects.toThrow(
      "Enter a valid Jira URL.",
    );
  });
});

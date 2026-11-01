import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: { getSession: vi.fn() },
}));

import { authClient } from "@/lib/auth-client";
import { Route } from "@/routes/_layout/_authenticated";

const session = { user: { id: "user-1" }, session: { id: "session-1" } };
const getSession = vi.mocked(authClient.getSession);
const load = () =>
  Route.options.beforeLoad?.({
    location: { pathname: "/dashboard", searchStr: "?view=mine" },
  } as never);

describe("authenticated route during deployment", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getSession.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it("recovers a valid session after a temporary network failure", async () => {
    getSession.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    getSession.mockResolvedValue({ data: session, error: null } as never);
    const result = Promise.resolve(load()).then(
      (value) => value,
      (error) => error,
    );
    await vi.runAllTimersAsync();
    expect(await result).toEqual({ session });
  });

  it("recovers after a 503 response instead of opening login", async () => {
    getSession.mockResolvedValueOnce({
      data: null,
      error: { status: 503, message: "Unavailable" },
    } as never);
    getSession.mockResolvedValue({ data: session, error: null } as never);
    const result = Promise.resolve(load()).then(
      (value) => value,
      (error) => error,
    );
    await vi.runAllTimersAsync();
    expect(await result).toEqual({ session });
  });

  it("surfaces a persistent outage as an error rather than a login redirect", async () => {
    getSession.mockResolvedValue({
      data: null,
      error: { status: 502, message: "Bad gateway" },
    } as never);
    const result = Promise.resolve(load()).catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    expect(await result).toBeInstanceOf(Error);
  });

  it("redirects a confirmed missing session with the original destination", async () => {
    getSession.mockResolvedValue({ data: null, error: null } as never);
    await expect(load()).rejects.toMatchObject({
      options: {
        to: "/auth/sign-in",
        search: { redirect: "/dashboard?view=mine" },
      },
    });
  });

  it("redirects an expired session reported as 401", async () => {
    getSession.mockResolvedValue({
      data: null,
      error: { status: 401, message: "Unauthorized" },
    } as never);
    await expect(load()).rejects.toMatchObject({
      options: { to: "/auth/sign-in" },
    });
  });
});

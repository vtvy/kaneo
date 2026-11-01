import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useSignOut from "./use-sign-out";

const m = vi.hoisted(() => ({
  signOut: vi.fn(),
  getIdToken: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: ({ mutationFn }: { mutationFn: () => Promise<unknown> }) => ({
    mutateAsync: mutationFn,
  }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => m.navigate }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: m.signOut } }));
vi.mock("@/fetchers/oauth/get-id-token", () => ({ getIdToken: m.getIdToken }));

const location = {
  origin: "https://kaneo.example.test",
  href: "https://kaneo.example.test/dashboard",
};

beforeEach(() => {
  vi.resetAllMocks();
  location.href = "https://kaneo.example.test/dashboard";
  vi.stubGlobal("window", { location });
  m.getIdToken.mockResolvedValue({ idToken: "test-id-token" });
  m.signOut.mockResolvedValue({ data: { success: true }, error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSignOut", () => {
  it("redirects to the IdP logout URL without navigating in the app", async () => {
    const { result } = renderHook(() =>
      useSignOut("https://idp.example.test/logout?client_id=kaneo"),
    );
    await result.current.mutateAsync();

    const url = new URL(location.href);
    expect(url.origin + url.pathname).toBe("https://idp.example.test/logout");
    expect(url.searchParams.get("client_id")).toBe("kaneo");
    expect(url.searchParams.get("id_token_hint")).toBe("test-id-token");
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe(
      "https://kaneo.example.test/auth/sign-in",
    );
    expect(m.getIdToken.mock.invocationCallOrder[0]).toBeLessThan(
      m.signOut.mock.invocationCallOrder[0] ?? 0,
    );
    expect(m.navigate).not.toHaveBeenCalled();
  });

  it("still redirects when the id_token cannot be read", async () => {
    m.getIdToken.mockRejectedValue(new Error("no token"));
    const { result } = renderHook(() =>
      useSignOut("https://idp.example.test/logout"),
    );
    await result.current.mutateAsync();

    const url = new URL(location.href);
    expect(url.searchParams.has("id_token_hint")).toBe(false);
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe(
      "https://kaneo.example.test/auth/sign-in",
    );
  });

  it("navigates to sign-in without an IdP logout URL", async () => {
    const { result } = renderHook(() => useSignOut(null));
    await result.current.mutateAsync();

    expect(m.getIdToken).not.toHaveBeenCalled();
    expect(m.navigate).toHaveBeenCalledWith({ to: "/auth/sign-in" });
    expect(location.href).toBe("https://kaneo.example.test/dashboard");
  });

  it("stays on the page when Kaneo's sign-out fails", async () => {
    m.signOut.mockResolvedValue({ data: null, error: { message: "nope" } });
    const { result } = renderHook(() =>
      useSignOut("https://idp.example.test/logout"),
    );

    await expect(result.current.mutateAsync()).rejects.toThrow("nope");
    expect(location.href).toBe("https://kaneo.example.test/dashboard");
    expect(m.navigate).not.toHaveBeenCalled();
  });
});

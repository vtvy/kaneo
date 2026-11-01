import { describe, expect, it } from "vitest";
import {
  authHeaders,
  cookieHeaderFromSetCookie,
  credentialFromSignIn,
} from "./auth-credential";

describe("credentialFromSignIn", () => {
  it("prefers the bearer plugin header", () => {
    expect(
      credentialFromSignIn({
        setAuthToken: "header-token",
        bodyToken: "body-token",
        setCookie: "better-auth.session_token=cookie; Path=/",
      }),
    ).toEqual({
      kind: "bearer",
      token: "header-token",
      source: "session",
    });
  });

  it("uses the JSON session token", () => {
    expect(
      credentialFromSignIn({
        setAuthToken: null,
        bodyToken: "body-token",
        setCookie: null,
      }),
    ).toEqual({ kind: "bearer", token: "body-token", source: "session" });
  });

  it("keeps the session cookie when no token is returned", () => {
    expect(
      credentialFromSignIn({
        setAuthToken: "  ",
        bodyToken: null,
        setCookie:
          "better-auth.session_token=abc; Path=/; HttpOnly, better-auth.session_data=xyz; Path=/",
      }),
    ).toEqual({
      kind: "cookie",
      cookie: "better-auth.session_token=abc; better-auth.session_data=xyz",
    });
  });
});

describe("cookieHeaderFromSetCookie", () => {
  it("drops cookie attributes", () => {
    expect(
      cookieHeaderFromSetCookie(
        "better-auth.session_token=abc; Path=/; HttpOnly; SameSite=Lax",
      ),
    ).toBe("better-auth.session_token=abc");
  });
});

describe("authHeaders", () => {
  it("sends a session or API key as Bearer", () => {
    expect(
      authHeaders({ kind: "bearer", token: "kaneo_key", source: "apiKey" }),
    ).toEqual({ Authorization: "Bearer kaneo_key" });
  });

  it("sends a stored cookie on later requests", () => {
    expect(
      authHeaders({
        kind: "cookie",
        cookie: "better-auth.session_token=abc",
      }),
    ).toEqual({ Cookie: "better-auth.session_token=abc" });
  });
});

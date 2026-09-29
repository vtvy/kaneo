import { describe, expect, it } from "vitest";
import { hasCredentialAccount } from "./has-credential-account";

describe("hasCredentialAccount", () => {
  it("is true when a credential provider is linked", () => {
    expect(
      hasCredentialAccount([
        { providerId: "google" },
        { providerId: "credential" },
      ]),
    ).toBe(true);
  });

  it("is false for OAuth-only accounts", () => {
    expect(
      hasCredentialAccount([
        { providerId: "google" },
        { providerId: "github" },
      ]),
    ).toBe(false);
  });

  it("is false while accounts are unknown", () => {
    expect(hasCredentialAccount(undefined)).toBe(false);
    expect(hasCredentialAccount([])).toBe(false);
  });
});

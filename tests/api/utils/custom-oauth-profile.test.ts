import { describe, expect, it } from "vitest";
import {
  mapCustomOAuthProfileToUser,
  parseManagedProfileFields,
  planManagedProfileUpdate,
  readCustomOAuthAccountId,
  readCustomOAuthPicture,
} from "../../../apps/api/src/utils/custom-oauth-profile";

describe("custom OAuth profile", () => {
  it("falls back from name to given/family name, username and email", () => {
    expect(mapCustomOAuthProfileToUser({ name: " Ada " })).toEqual({
      name: "Ada",
    });
    expect(
      mapCustomOAuthProfileToUser({ given_name: "Ada", family_name: "L" }),
    ).toEqual({ name: "Ada L" });
    expect(mapCustomOAuthProfileToUser({ preferred_username: "ada" })).toEqual({
      name: "ada",
    });
    expect(mapCustomOAuthProfileToUser({ email: "ada@example.com" })).toEqual({
      name: "ada",
    });
    expect(mapCustomOAuthProfileToUser({})).toEqual({});
  });

  it("parses the managed profile fields and refuses unknown ones", () => {
    expect(parseManagedProfileFields(undefined)).toEqual([]);
    expect(parseManagedProfileFields(" Image , name,name")).toEqual([
      "name",
      "image",
    ]);
    expect(() => parseManagedProfileFields("name,email")).toThrow(/email/);
  });

  it("accepts only http(s) picture URLs", () => {
    expect(
      readCustomOAuthPicture({ picture: "https://cdn.example/a.png" }),
    ).toBe("https://cdn.example/a.png");
    expect(readCustomOAuthPicture({ picture: "javascript:alert(1)" })).toBe(
      null,
    );
    expect(
      readCustomOAuthPicture({
        picture: `https://x.example/${"a".repeat(2100)}`,
      }),
    ).toBe(null);
  });

  it("reads the account id the way Better Auth links it", () => {
    expect(readCustomOAuthAccountId({ id: "a", sub: "b" })).toBe("a");
    expect(readCustomOAuthAccountId({ sub: "b" })).toBe("b");
    expect(readCustomOAuthAccountId({ id: 42 })).toBe("42");
    expect(readCustomOAuthAccountId({})).toBe(null);
  });

  it("plans updates only for managed fields and never the email", () => {
    const stored = { name: "Old", image: null };
    const profile = {
      name: "New",
      picture: "https://cdn.example/a.png",
      email: "attacker@example.com",
    };
    expect(planManagedProfileUpdate(profile, stored, [])).toEqual({});
    expect(planManagedProfileUpdate(profile, stored, ["name"])).toEqual({
      name: "New",
    });
    expect(
      planManagedProfileUpdate(profile, stored, ["name", "image"]),
    ).toEqual({ name: "New", image: "https://cdn.example/a.png" });
    expect(
      planManagedProfileUpdate({ name: "Old" }, stored, ["name", "image"]),
    ).toEqual({});
  });
});

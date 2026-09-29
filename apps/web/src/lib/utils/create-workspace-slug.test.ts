import { describe, expect, it } from "vitest";
import {
  createRandomWorkspaceSlugSuffix,
  createUniqueWorkspaceSlug,
  createWorkspaceBaseSlug,
  isWorkspaceSlugCollisionError,
  toWorkspaceCreateError,
  WorkspaceCreateError,
} from "./create-workspace-slug";

describe("createWorkspaceBaseSlug", () => {
  it("slugifies workspace names", () => {
    expect(createWorkspaceBaseSlug("Acme Inc")).toBe("acme-inc");
  });

  it("falls back when empty", () => {
    expect(createWorkspaceBaseSlug("???")).toBe("workspace");
  });
});

describe("createRandomWorkspaceSlugSuffix", () => {
  it("returns a 12-char alphanumeric suffix without Web Crypto", () => {
    const suffix = createRandomWorkspaceSlugSuffix();
    expect(suffix).toMatch(/^[0-9a-z]{12}$/);
  });

  it("changes across calls", () => {
    const a = createRandomWorkspaceSlugSuffix();
    const b = createRandomWorkspaceSlugSuffix();
    expect(a).not.toBe(b);
  });
});

describe("createUniqueWorkspaceSlug", () => {
  it("returns base slug when free", () => {
    expect(createUniqueWorkspaceSlug("Acme", [])).toBe("acme");
  });

  it("adds a suffix when base is taken", () => {
    const slug = createUniqueWorkspaceSlug("Acme", ["acme"]);
    expect(slug.startsWith("acme-")).toBe(true);
    expect(slug).not.toBe("acme");
  });
});

describe("workspace create error mapping", () => {
  it("detects ORGANIZATION_ALREADY_EXISTS by code", () => {
    expect(
      isWorkspaceSlugCollisionError({
        code: "ORGANIZATION_ALREADY_EXISTS",
        message: "Organization already exists",
      }),
    ).toBe(true);
  });

  it("maps auth error into WorkspaceCreateError", () => {
    const mapped = toWorkspaceCreateError({
      code: "ORGANIZATION_ALREADY_EXISTS",
      message: "Organization already exists",
    });
    expect(mapped).toBeInstanceOf(WorkspaceCreateError);
    expect(mapped.code).toBe("ORGANIZATION_ALREADY_EXISTS");
  });

  it("does not treat unrelated errors as slug collisions", () => {
    expect(
      isWorkspaceSlugCollisionError({
        message: "crypto.randomUUID is not a function",
      }),
    ).toBe(false);
  });
});

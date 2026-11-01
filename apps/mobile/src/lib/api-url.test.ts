import { describe, expect, it } from "vitest";
import { buildApiUrl, normalizeServerOrigin } from "./api-url";

describe("normalizeServerOrigin", () => {
  it("adds http and drops a trailing /api", () => {
    expect(normalizeServerOrigin("192.168.1.10:1337/api")).toBe(
      "http://192.168.1.10:1337",
    );
    expect(normalizeServerOrigin("http://localhost:1337/api/")).toBe(
      "http://localhost:1337",
    );
  });

  it("keeps https origins", () => {
    expect(normalizeServerOrigin("https://kaneo.example.com")).toBe(
      "https://kaneo.example.com",
    );
  });

  it("rejects other paths and schemes", () => {
    expect(() => normalizeServerOrigin("http://localhost:1337/task")).toThrow(
      /đường dẫn/,
    );
    expect(() => normalizeServerOrigin("ftp://localhost")).toThrow(/http/);
  });
});

describe("buildApiUrl", () => {
  it("builds an API path from the saved origin", () => {
    expect(
      buildApiUrl("http://localhost:1337/api", "/api/project", {
        workspaceId: "ws_1",
        includeArchived: undefined,
        empty: "",
      }),
    ).toBe("http://localhost:1337/api/project?workspaceId=ws_1");
  });

  it("accepts a path without a leading slash", () => {
    expect(buildApiUrl("https://kaneo.example.com", "api/workspace")).toBe(
      "https://kaneo.example.com/api/workspace",
    );
  });
});

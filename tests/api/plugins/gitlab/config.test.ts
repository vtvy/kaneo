import { describe, expect, it } from "vitest";
import {
  assertValidGitlabBaseUrl,
  normalizeGitlabNamespace,
  normalizeGitlabProjectName,
  splitGitlabProjectPath,
} from "../../../../apps/api/src/plugins/gitlab/config";
import { rewriteGitlabUrl } from "../../../../apps/api/src/plugins/gitlab/utils/rewrite-url";
import { baseUrlFromRepositoryHtmlUrl } from "../../../../apps/api/src/plugins/gitlab/utils/webhook-repo";

describe("normalizeGitlabNamespace", () => {
  it("keeps nested group namespaces", () => {
    expect(normalizeGitlabNamespace("group/sub/team")).toBe("group/sub/team");
    expect(normalizeGitlabNamespace(" /group/sub/ ")).toBe("group/sub");
  });

  it("rejects empty and relative namespaces", () => {
    expect(() => normalizeGitlabNamespace("")).toThrow();
    expect(() => normalizeGitlabNamespace("group/../other")).toThrow();
    expect(() => normalizeGitlabNamespace("./group")).toThrow();
  });
});

describe("normalizeGitlabProjectName", () => {
  it("accepts a single slug", () => {
    expect(normalizeGitlabProjectName(" my-project ")).toBe("my-project");
  });

  it("rejects slashes and relative segments", () => {
    expect(() => normalizeGitlabProjectName("a/b")).toThrow();
    expect(() => normalizeGitlabProjectName("..")).toThrow();
    expect(() => normalizeGitlabProjectName("")).toThrow();
  });
});

describe("splitGitlabProjectPath", () => {
  it("splits nested namespaces from the project path", () => {
    expect(splitGitlabProjectPath("a/b/c")).toEqual({
      owner: "a/b",
      name: "c",
    });
    expect(splitGitlabProjectPath("group/project")).toEqual({
      owner: "group",
      name: "project",
    });
  });
});

describe("assertValidGitlabBaseUrl", () => {
  it("normalizes trailing slashes and keeps a path prefix", () => {
    expect(assertValidGitlabBaseUrl("https://gitlab.example.com/")).toBe(
      "https://gitlab.example.com",
    );
    expect(assertValidGitlabBaseUrl("https://example.com/gitlab//")).toBe(
      "https://example.com/gitlab",
    );
  });

  it("rejects other protocols, queries, fragments and credentials", () => {
    expect(() =>
      assertValidGitlabBaseUrl("ftp://gitlab.example.com"),
    ).toThrow();
    expect(() =>
      assertValidGitlabBaseUrl("https://gitlab.example.com?x=1"),
    ).toThrow();
    expect(() =>
      assertValidGitlabBaseUrl("https://gitlab.example.com#frag"),
    ).toThrow();
    expect(() =>
      assertValidGitlabBaseUrl("https://user:pass@gitlab.example.com"),
    ).toThrow();
    expect(() => assertValidGitlabBaseUrl("not a url")).toThrow();
  });
});

describe("baseUrlFromRepositoryHtmlUrl", () => {
  it("drops the namespace and project from web_url", () => {
    expect(
      baseUrlFromRepositoryHtmlUrl("https://gitlab.example.com/group/project"),
    ).toBe("https://gitlab.example.com");
  });

  it("returns an empty string for invalid URLs", () => {
    expect(baseUrlFromRepositoryHtmlUrl("nope")).toBe("");
  });
});

describe("rewriteGitlabUrl", () => {
  it("moves a GitLab link onto the configured host", () => {
    expect(
      rewriteGitlabUrl(
        "http://10.0.0.201",
        "https://gitlab.example.com/group/sub/project/-/issues/3#note_1",
      ),
    ).toBe("http://10.0.0.201/group/sub/project/-/issues/3#note_1");
  });

  it("keeps the original URL when the configured base is invalid", () => {
    expect(rewriteGitlabUrl("nope", "https://gitlab.example.com/x")).toBe(
      "https://gitlab.example.com/x",
    );
  });
});

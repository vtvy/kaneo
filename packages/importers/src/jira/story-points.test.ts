import { describe, expect, it } from "vitest";
import { findStoryPointsField, issuePoints } from "./story-points.js";

describe("findStoryPointsField", () => {
  it("finds classic and team-managed story point fields by name", () => {
    expect(
      findStoryPointsField([
        { id: "summary", name: "Summary", schema: { type: "string" } },
        {
          id: "customfield_10016",
          name: "Story point estimate",
          schema: { type: "number" },
        },
      ]),
    ).toBe("customfield_10016");
    expect(
      findStoryPointsField([{ id: "customfield_10002", name: "Story Points" }]),
    ).toBe("customfield_10002");
  });

  it("ignores fields that are not numbers or missing", () => {
    expect(
      findStoryPointsField([
        { id: "x", name: "Story Points", schema: { type: "string" } },
      ]),
    ).toBeNull();
    expect(findStoryPointsField(null)).toBeNull();
  });
});

describe("issuePoints", () => {
  const issue = (value: unknown) => ({
    id: "1",
    key: "ABC-1",
    fields: { customfield_1: value } as Record<string, unknown>,
  });

  it("rounds numeric estimates and drops anything else", () => {
    expect(issuePoints(issue(2.6), "customfield_1")).toBe(3);
    expect(issuePoints(issue(5000), "customfield_1")).toBe(1000);
    expect(issuePoints(issue(-1), "customfield_1")).toBeUndefined();
    expect(issuePoints(issue("3"), "customfield_1")).toBeUndefined();
    expect(issuePoints(issue(3), null)).toBeUndefined();
  });
});

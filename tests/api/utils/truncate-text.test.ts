import { describe, expect, it } from "vitest";
import { truncateText } from "../../../apps/api/src/utils/truncate-text";

describe("truncateText", () => {
  it("leaves short text alone", () => {
    expect(truncateText("short")).toBe("short");
  });

  it("caps long text at 200 characters plus an ellipsis", () => {
    const result = truncateText("a".repeat(500));
    expect(result).toBe(`${"a".repeat(200)}…`);
  });
});

import { describe, expect, it } from "vitest";
import { localeCompareSort } from "./format";

describe("localeCompareSort", () => {
  it("sorts labels with the app locale, ignoring case and sorting numbers", () => {
    expect(localeCompareSort("Äpple", "Zebra", "en-US")).toBeLessThan(0);
    expect(localeCompareSort("Äpple", "Zebra", "sv-SE")).toBeGreaterThan(0);
    expect(localeCompareSort("Label 2", "Label 10", "en-US")).toBeLessThan(0);
    expect(localeCompareSort("apple", "Apple", "en-US")).toBe(0);
  });
});

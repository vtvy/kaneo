import { describe, expect, it } from "vitest";
import { formatUptime } from "./format-uptime";

describe("formatUptime", () => {
  it("picks the two largest units", () => {
    expect(formatUptime(45)).toBe("45s");
    expect(formatUptime(125)).toBe("2m");
    expect(formatUptime(2 * 3600 + 5 * 60)).toBe("2h 5m");
    expect(formatUptime(3 * 86_400 + 4 * 3600 + 30)).toBe("3d 4h");
  });

  it("never goes negative", () => {
    expect(formatUptime(-5)).toBe("0s");
  });
});

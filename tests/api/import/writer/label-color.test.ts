import { describe, expect, it } from "vitest";
import { toLabelColor } from "../../../../apps/api/src/import/writer/label-color";

describe("toLabelColor", () => {
  it("keeps the web app's color names", () => {
    expect(toLabelColor("teal")).toBe("teal");
  });

  it("maps hex colors to the closest name", () => {
    expect(toLabelColor("#e83855")).toBe("pink");
    expect(toLabelColor("#16a34a")).toBe("green");
    expect(toLabelColor("8b5cf6")).toBe("purple");
  });

  it("falls back to gray for anything else", () => {
    expect(toLabelColor(undefined)).toBe("gray");
    expect(toLabelColor("url(javascript:1)")).toBe("gray");
  });
});

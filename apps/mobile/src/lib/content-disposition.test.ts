import { describe, expect, it } from "vitest";
import {
  filenameFromContentDisposition,
  safeDownloadName,
} from "./content-disposition";

describe("filenameFromContentDisposition", () => {
  it("prefers the UTF-8 filename the API sends", () => {
    const header =
      "attachment; filename=\"bao cao.txt\"; filename*=UTF-8''b%C3%A1o%20c%C3%A1o.txt";
    expect(filenameFromContentDisposition(header)).toBe("báo cáo.txt");
  });

  it("falls back to the ASCII filename", () => {
    expect(
      filenameFromContentDisposition('attachment; filename="notes.pdf"'),
    ).toBe("notes.pdf");
  });
});

describe("safeDownloadName", () => {
  it("removes path separators", () => {
    expect(safeDownloadName("../a/b\\c.txt")).toBe("..-a-b-c.txt");
    expect(safeDownloadName("   ")).toBe("file");
  });
});

import { describe, expect, it } from "vitest";
import { expandLabelFilter } from "./label-groups";

describe("expandLabelFilter", () => {
  const labels = [
    { id: "bug-old", name: "Bug", color: "#f00" },
    { id: "bug-new", name: "Bug", color: "#F00" },
    { id: "idea", name: "Idea", color: "#0f0" },
  ];

  it("includes a new label that shares the selected name and color", () => {
    expect(expandLabelFilter(labels, ["bug-old"])).toEqual([
      "bug-old",
      "bug-new",
    ]);
  });

  it("leaves an empty selection alone", () => {
    expect(expandLabelFilter(labels, null)).toBeNull();
  });
});

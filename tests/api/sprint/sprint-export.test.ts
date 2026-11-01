import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  buildSprintExportSheets,
  describeSprintMembership,
  type SprintExportTask,
  toSheetName,
} from "../../../apps/api/src/sprint/sprint-export-rows";
import { buildSprintWorkbook } from "../../../apps/api/src/sprint/sprint-export-workbook";

function task(overrides: Partial<SprintExportTask>): SprintExportTask {
  return {
    sprintName: "Sprint 1",
    taskKey: "TES-1",
    title: "Login",
    status: "in-progress",
    priority: "high",
    points: 3,
    assigneeName: "Vy",
    addedAt: new Date("2026-01-01T00:00:00.000Z"),
    removedAt: null,
    currentSprintName: "Sprint 1",
    ...overrides,
  };
}

describe("describeSprintMembership", () => {
  it("marks an open membership as the current sprint", () => {
    expect(
      describeSprintMembership({
        removedAt: null,
        currentSprintName: "Sprint 2",
      }),
    ).toBe("In this sprint");
  });

  it("names the sprint a task moved on to", () => {
    expect(
      describeSprintMembership({
        removedAt: new Date("2026-02-01T00:00:00.000Z"),
        currentSprintName: "Sprint 2",
      }),
    ).toBe("Moved to Sprint 2");
  });

  it("says the task went back to the backlog when it has no sprint", () => {
    expect(
      describeSprintMembership({
        removedAt: new Date("2026-02-01T00:00:00.000Z"),
        currentSprintName: null,
      }),
    ).toBe("Back to backlog");
  });
});

describe("toSheetName", () => {
  it("strips characters Excel rejects and keeps names unique", () => {
    const used = new Set<string>();
    expect(toSheetName("Q1/Q2: [plan]", used)).toBe("Q1 Q2   plan");
    expect(toSheetName("Sprint", used)).toBe("Sprint");
    expect(toSheetName("sprint", used)).toBe("sprint 2");
    expect(toSheetName("   ", used)).toBe("Sprint 3");
  });

  it("caps names at 31 characters, suffix included", () => {
    const used = new Set<string>();
    const long = "A".repeat(40);
    expect(toSheetName(long, used)).toHaveLength(31);
    const second = toSheetName(long, used);
    expect(second).toHaveLength(31);
    expect(second.endsWith(" 2")).toBe(true);
  });
});

describe("buildSprintExportSheets", () => {
  it("puts each sprint's tasks on their own sheet, current tasks first", () => {
    const sheets = buildSprintExportSheets([
      task({
        sprintId: "s1",
        sprintName: "Sprint 1",
        taskKey: "TES-12",
        removedAt: new Date("2026-02-01T00:00:00.000Z"),
        currentSprintName: "Sprint 2",
      }),
      task({
        sprintId: "s2",
        sprintName: "Sprint 2",
        taskKey: "TES-12",
        addedAt: new Date("2026-02-01T00:00:00.000Z"),
        currentSprintName: "Sprint 2",
      }),
      task({
        sprintId: "s2",
        sprintName: "Sprint 2",
        taskKey: "TES-9",
        priority: null,
        points: null,
        assigneeName: null,
        addedAt: new Date("2026-01-15T00:00:00.000Z"),
        removedAt: new Date("2026-01-20T00:00:00.000Z"),
        currentSprintName: null,
      }),
    ]);

    expect(sheets.map((sheet) => sheet.name)).toEqual(["Sprint 1", "Sprint 2"]);
    expect(sheets[1]?.rows.map((row) => row.cells[0])).toEqual([
      "TES-12",
      "TES-9",
    ]);
    expect(sheets[0]?.rows[0]?.current).toBe(false);
    expect(sheets[0]?.rows[0]?.cells[8]).toBe("Moved to Sprint 2");
    expect(sheets[1]?.rows[0]?.current).toBe(true);
    expect(sheets[1]?.rows[1]?.cells.slice(3, 6)).toEqual(["", null, ""]);
  });

  it("keeps same-named sprints on separate sheets", () => {
    const sheets = buildSprintExportSheets([
      task({ sprintId: "a", sprintName: "Sprint" }),
      task({ sprintId: "b", sprintName: "Sprint" }),
    ]);
    expect(sheets.map((sheet) => sheet.name)).toEqual(["Sprint", "Sprint 2"]);
  });
});

describe("buildSprintWorkbook", () => {
  it("writes a readable sheet: styled header, frozen row, dates, dimmed moved rows", async () => {
    const sheets = buildSprintExportSheets([
      task({ sprintId: "s1", taskKey: "TES-1" }),
      task({
        sprintId: "s1",
        taskKey: "TES-2",
        removedAt: new Date("2026-01-10T00:00:00.000Z"),
        currentSprintName: null,
      }),
    ]);
    const buffer = await buildSprintWorkbook(sheets).xlsx.writeBuffer();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet("Sprint 1");
    if (!sheet) throw new Error("missing sheet");

    expect(sheet.getRow(1).getCell(1).value).toBe("Key");
    expect(sheet.getRow(1).getCell(1).font?.bold).toBe(true);
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.getColumn(2).width).toBe(42);

    const joined = sheet.getRow(2).getCell(7);
    expect(joined.value).toBeInstanceOf(Date);
    expect(joined.numFmt).toBe("yyyy-mm-dd");
    expect(sheet.getRow(2).getCell(5).value).toBe(3);

    expect(sheet.getRow(3).getCell(1).fill).toMatchObject({
      type: "pattern",
      pattern: "solid",
    });
    expect(sheet.getRow(2).getCell(1).fill).not.toMatchObject({
      pattern: "solid",
    });
    expect(sheet.getRow(3).getCell(9).value).toBe("Back to backlog");
  });

  it("returns a header-only sheet when the project has no sprint history", () => {
    const workbook = buildSprintWorkbook([]);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Sprints"]);
    expect(workbook.worksheets[0]?.rowCount).toBe(1);
  });
});

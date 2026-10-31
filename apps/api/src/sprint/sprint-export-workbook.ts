import ExcelJS from "exceljs";
import {
  SPRINT_EXPORT_COLUMNS,
  SPRINT_EXPORT_DATE_COLUMNS,
  SPRINT_EXPORT_POINTS_COLUMN,
  type SprintExportSheet,
} from "./sprint-export-rows";

const HEADER_FILL = "FF1F2937";
const HEADER_FONT = "FFFFFFFF";
const MOVED_FILL = "FFF3F4F6";
const MOVED_FONT = "FF6B7280";

function writeSprintSheet(
  workbook: ExcelJS.Workbook,
  sheetData: SprintExportSheet,
) {
  const sheet = workbook.addWorksheet(sheetData.name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = SPRINT_EXPORT_COLUMNS.map((column) => ({
    header: column.header,
    width: column.width,
  }));

  const header = sheet.getRow(1);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT }, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  for (const row of sheetData.rows) {
    const added = sheet.addRow(row.cells);
    for (let index = 0; index < SPRINT_EXPORT_COLUMNS.length; index += 1) {
      const cell = added.getCell(index + 1);
      cell.alignment = { vertical: "middle" };
      if (SPRINT_EXPORT_DATE_COLUMNS.includes(index)) {
        cell.numFmt = "yyyy-mm-dd";
      }
      if (index === SPRINT_EXPORT_POINTS_COLUMN) {
        cell.numFmt = "0";
      }
      if (!row.current) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: MOVED_FILL },
        };
        cell.font = { color: { argb: MOVED_FONT } };
      }
    }
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: {
      row: Math.max(sheet.rowCount, 1),
      column: SPRINT_EXPORT_COLUMNS.length,
    },
  };
}

// One sheet per sprint; an empty project still gets a header-only sheet so
// the download is a valid workbook.
export function buildSprintWorkbook(sheets: SprintExportSheet[]) {
  const workbook = new ExcelJS.Workbook();
  const exportSheets =
    sheets.length > 0 ? sheets : [{ name: "Sprints", rows: [] }];

  for (const sheetData of exportSheets) {
    writeSprintSheet(workbook, sheetData);
  }

  return workbook;
}

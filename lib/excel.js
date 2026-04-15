import * as XLSX from "xlsx";

function sanitizeCellValue(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function normalizeHeader(value) {
  return sanitizeCellValue(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parseWorkbookRows(arrayBuffer) {
  const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: "buffer" });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return [];
  }

  const worksheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

  if (!matrix.length) {
    return [];
  }

  const maxScanRows = Math.min(10, matrix.length);
  let headerIndex = 0;
  let maxFilledCells = 0;

  for (let rowIndex = 0; rowIndex < maxScanRows; rowIndex += 1) {
    const filledCells = (matrix[rowIndex] || []).filter(
      (value) => sanitizeCellValue(value) !== ""
    ).length;

    if (filledCells > maxFilledCells) {
      maxFilledCells = filledCells;
      headerIndex = rowIndex;
    }
  }

  const headerRow = matrix[headerIndex] || [];
  const dataRows = matrix.slice(headerIndex + 1);

  return dataRows
    .filter((row) => row.some((value) => sanitizeCellValue(value) !== ""))
    .map((row) => {
      const normalized = {};

      headerRow.forEach((header, index) => {
        const normalizedKey = normalizeHeader(header);
        if (!normalizedKey) {
          return;
        }

        normalized[normalizedKey] = row[index] ?? "";
      });

      return normalized;
    })
    .filter((row) => Object.keys(row).length > 0)
    .map((row) => {
    const normalized = {};

    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = value;
    }

    return normalized;
  });
}

export function createWorkbookBuffer(sheetName, rows) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

import type { Workbook, Worksheet } from "exceljs";
import ExcelJS from "exceljs";

/**
 * Converte uma planilha do ExcelJS (1-indexada, com valores de célula
 * mesclada resolvidos) numa matriz 0-indexada — mais fácil de raciocinar
 * sobre posição de linha/coluna dos cabeçalhos idiossincráticos das
 * transportadoras.
 */
export function sheetToRows(sheet: Worksheet): unknown[][] {
  const rows: unknown[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const arr: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const value = cell.value;
      arr[colNumber - 1] = typeof value === "object" && value !== null && "result" in value ? value.result : value;
    });
    rows[rowNumber - 1] = arr;
  });
  return rows;
}

export async function loadWorkbook(buffer: Buffer): Promise<Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

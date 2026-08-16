import { parse } from "csv-parse/sync";
import { loadWorkbook, sheetToRows } from "./importers/xlsx-utils.js";

/**
 * Formato esperado da planilha (CSV ou XLSX), uma linha por faixa:
 *   cep_from, cep_to, weight_from_g, weight_to_g, price, deadline_days
 * Ex: 01000000, 05999999, 0, 1000, 24.90, 3
 */
export interface RawRow {
  cep_from?: string | number;
  cep_to?: string | number;
  weight_from_g?: string | number;
  weight_to_g?: string | number;
  price?: string | number;
  deadline_days?: string | number;
}

const COLUMNS = ["cep_from", "cep_to", "weight_from_g", "weight_to_g", "price", "deadline_days"] as const;

export async function parseTableFile(buffer: Buffer, filename: string): Promise<RawRow[]> {
  if (filename.toLowerCase().endsWith(".csv")) {
    return parse(buffer, { columns: true, skip_empty_lines: true, trim: true }) as RawRow[];
  }

  const workbook = await loadWorkbook(buffer);
  const firstSheet = workbook.worksheets[0];
  if (!firstSheet) throw new Error("Planilha vazia.");

  const rows = sheetToRows(firstSheet);
  const [header, ...dataRows] = rows;
  if (!header) return [];

  return dataRows
    .filter((row) => row && row.length > 0)
    .map((row) => {
      const obj: RawRow = {};
      header.forEach((col, i) => {
        const key = COLUMNS.find((c) => c === col);
        if (key) obj[key] = row[i] as string | number | undefined;
      });
      return obj;
    });
}

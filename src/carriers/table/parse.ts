import { parse } from "csv-parse/sync";
import { read, utils } from "xlsx";

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

export function parseTableFile(buffer: Buffer, filename: string): RawRow[] {
  if (filename.toLowerCase().endsWith(".csv")) {
    return parse(buffer, { columns: true, skip_empty_lines: true, trim: true }) as RawRow[];
  }
  const workbook = read(buffer, { type: "buffer" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("Planilha vazia.");
  return utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheet]!);
}

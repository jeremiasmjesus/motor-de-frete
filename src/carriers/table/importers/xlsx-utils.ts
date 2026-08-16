import { Readable } from "node:stream";
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

/**
 * Lê UMA aba em modo de fluxo, sem carregar a planilha inteira na memória.
 * Necessário pras abas de abrangência (dezenas de milhares de linhas) — o
 * `loadWorkbook` normal chega a usar mais de 1GB de RAM só pra planilha da
 * J&T, o que estoura o limite de memória do container em produção. Em
 * fluxo, a mesma planilha fica em ~200MB.
 */
export async function streamSheetToRows(buffer: Buffer, sheetName: string): Promise<unknown[][]> {
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from(buffer), {
    entries: "emit",
    sharedStrings: "cache",
    hyperlinks: "ignore",
    worksheets: "emit",
    styles: "ignore",
  });

  const rows: unknown[][] = [];
  let found = false;

  for await (const worksheetReader of workbookReader) {
    // os tipos do exceljs não declaram "name" em WorksheetReader, mas ele existe em runtime
    const name = (worksheetReader as unknown as { name: string }).name;
    if (name !== sheetName) {
      for await (const _row of worksheetReader) {
        // precisa consumir o iterador mesmo pra aba que não interessa, senão o leitor trava
      }
      continue;
    }

    found = true;
    for await (const row of worksheetReader) {
      const arr: unknown[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        arr[colNumber - 1] = cell.value;
      });
      rows[row.number - 1] = arr;
    }
  }

  if (!found) {
    throw new Error(`Não encontrei a aba "${sheetName}" na planilha.`);
  }

  return rows;
}

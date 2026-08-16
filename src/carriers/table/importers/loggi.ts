import { cepDigits, normalizeZoneCode, type ParsedZoneTable, type ZonePriceRow, type ZoneRow } from "./types.js";
import { loadWorkbook, sheetToRows } from "./xlsx-utils.js";

type Row = unknown[];

/**
 * Lê o arquivo "loggi-price-agreement-*.xlsx" que a própria Loggi manda —
 * aba "Tabela de Abrangência" (CEP -> zona + prazo) e "Tabela de Preços"
 * (zona x faixa de peso -> preço).
 *
 * Nota: o leitor em fluxo do exceljs (usado na J&T, cuja planilha é bem
 * maior) não consegue ler o zip desse arquivo específico da Loggi — mesmo
 * tipo de formatação não-padrão que já tinha quebrado a lib `xlsx` antes.
 * Carregamento normal funciona e, pro tamanho desse arquivo, cabe na
 * memória sem problema (medido abaixo do limite do container).
 */
export async function parseLoggiWorkbook(buffer: Buffer): Promise<ParsedZoneTable> {
  const workbook = await loadWorkbook(buffer);

  const abrangenciaSheet = workbook.getWorksheet("Tabela de Abrangência");
  const precosSheet = workbook.getWorksheet("Tabela de Preços");
  if (!abrangenciaSheet || !precosSheet) {
    throw new Error('Planilha da Loggi precisa ter as abas "Tabela de Abrangência" e "Tabela de Preços".');
  }

  const zones = parseAbrangencia(sheetToRows(abrangenciaSheet));
  const prices = parsePrecos(sheetToRows(precosSheet));

  return { zones, prices };
}

function parseAbrangencia(rows: Row[]): ZoneRow[] {
  const headerRowIndex = rows.findIndex((r) => String(r[1] ?? "").trim() === "Estado");
  if (headerRowIndex === -1) {
    throw new Error('Não encontrei o cabeçalho ("Estado, Cidade, ...") na aba Tabela de Abrangência.');
  }

  const zones: ZoneRow[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const cepFrom = cepDigits(row[4]);
    const cepTo = cepDigits(row[5]);
    const zoneCode = normalizeZoneCode(row[8]);
    const deadlineDays = Number(row[12]);

    if (!cepFrom || !cepTo || !zoneCode || !Number.isFinite(deadlineDays)) continue;
    zones.push({ cepFrom, cepTo, zoneCode, deadlineDays: Math.round(deadlineDays) });
  }
  return zones;
}

function parsePrecos(rows: Row[]): ZonePriceRow[] {
  const headerRowIndex = rows.findIndex((r) => String(r[1] ?? "").trim().startsWith("Peso inicial"));
  if (headerRowIndex === -1) {
    throw new Error('Não encontrei o cabeçalho ("Peso inicial (kg)...") na aba Tabela de Preços.');
  }

  const headerRow = rows[headerRowIndex]!;
  const zoneColumns = new Map<number, string>();
  for (let col = 3; col < headerRow.length; col++) {
    const zone = normalizeZoneCode(headerRow[col]);
    if (zone) zoneColumns.set(col, zone);
  }

  const prices: ZonePriceRow[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const weightFromKg = Number(row[1]);
    const weightToKg = Number(row[2]);
    if (!Number.isFinite(weightFromKg) || !Number.isFinite(weightToKg)) continue;

    for (const [col, zoneCode] of zoneColumns) {
      const price = Number(row[col]);
      if (!Number.isFinite(price) || price <= 0) continue;
      prices.push({
        zoneCode,
        weightFromG: Math.round(weightFromKg * 1000),
        weightToG: Math.round(weightToKg * 1000),
        priceCents: Math.round(price * 100),
      });
    }
  }
  return prices;
}

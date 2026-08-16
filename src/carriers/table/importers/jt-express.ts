import { cepDigits, normalizeZoneCode, type ParsedZoneTable, type ZonePriceRow, type ZoneRow } from "./types.js";
import { loadWorkbook, sheetToRows, streamSheetToRows } from "./xlsx-utils.js";

type Row = unknown[];

/**
 * J&T manda dois arquivos separados: a "Abrangência Nacional" (CEP -> zona
 * Geocom + prazo por filial de origem) e a "Proposta Comercial" (zona x faixa
 * de peso -> preço, já negociada pro contrato de vocês, aba "Proposta padrão").
 *
 * O prazo depende de qual filial de origem enviou — por isso `originCode`
 * (ex: "GYN" pra Goiânia) escolhe a coluna certa na planilha de abrangência.
 */
export async function parseJtExpressWorkbooks(
  abrangenciaBuffer: Buffer,
  propostaBuffer: Buffer,
  originCode: string,
): Promise<ParsedZoneTable> {
  // "CEP" tem dezenas de milhares de linhas — lida em fluxo pra não estourar
  // memória (carregada normal, chega a passar de 1GB de RAM só nessa aba).
  const cepRows = await streamSheetToRows(abrangenciaBuffer, "CEP");
  const zones = parseCep(cepRows, originCode);

  const propostaWb = await loadWorkbook(propostaBuffer);
  const propostaSheet = propostaWb.getWorksheet("Proposta padrão");
  if (!propostaSheet) throw new Error('Não encontrei a aba "Proposta padrão" no arquivo de proposta da J&T.');
  const prices = parseProposta(sheetToRows(propostaSheet));

  return { zones, prices };
}

function parseCep(rows: Row[], originCode: string): ZoneRow[] {
  // linha 2 = "Origem GYN" etc — a coluna de prazo que queremos é a filial
  // cujo código bate com originCode.
  const originRow = rows[2] ?? [];

  let deadlineCol = -1;
  for (let col = 0; col < originRow.length; col++) {
    if (String(originRow[col] ?? "").includes(`Origem ${originCode}`)) {
      deadlineCol = col;
      break;
    }
  }
  if (deadlineCol === -1) {
    throw new Error(`Não encontrei a coluna "Origem ${originCode}" na planilha de abrangência.`);
  }

  const headerRowIndex = rows.findIndex((r) => String(r[0] ?? "").trim() === "Municipio");
  if (headerRowIndex === -1) {
    throw new Error('Não encontrei o cabeçalho ("Municipio, Estado, ...") na aba CEP.');
  }

  const zones: ZoneRow[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const cepFrom = cepDigits(row[4]);
    const cepTo = cepDigits(row[5]);
    const zoneCode = normalizeZoneCode(row[7]);
    const deadlineDays = Number(row[deadlineCol]);

    if (!cepFrom || !cepTo || !zoneCode || !Number.isFinite(deadlineDays)) continue;
    zones.push({ cepFrom, cepTo, zoneCode, deadlineDays: Math.round(deadlineDays) });
  }
  return zones;
}

function parseProposta(rows: Row[]): ZonePriceRow[] {
  // A linha com os códigos de zona (ex: "SP - CAP", "SP - CAP 1") é a primeira
  // com várias células terminando em " - CAP".
  const zoneRowIndex = rows.findIndex((r) => r.filter((c) => String(c ?? "").includes(" - CAP")).length >= 3);
  if (zoneRowIndex === -1) {
    throw new Error('Não encontrei a linha de códigos de zona (" - CAP") na aba Proposta padrão.');
  }
  const zoneRow = rows[zoneRowIndex]!;

  const zoneColumns = new Map<number, string>();
  for (let col = 3; col < zoneRow.length; col++) {
    const zone = normalizeZoneCode(zoneRow[col]);
    if (zone) zoneColumns.set(col, zone);
  }

  // duas linhas abaixo da linha de zonas fica "Faixa de Peso em Kg" (rótulo),
  // os dados de peso x preço começam logo em seguida.
  const dataStartIndex = zoneRowIndex + 2;

  const prices: ZonePriceRow[] = [];
  for (let i = dataStartIndex; i < rows.length; i++) {
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

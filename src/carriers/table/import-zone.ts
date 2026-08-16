import { pool, type DbConnection } from "../../db/client.js";
import type { ParsedZoneTable, ZonePriceRow, ZoneRow } from "./importers/types.js";

const CHUNK_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function insertZones(client: DbConnection, rateTableId: string, rows: ZoneRow[]): Promise<void> {
  for (const batch of chunk(rows, CHUNK_SIZE)) {
    const values: unknown[] = [];
    const placeholders = batch.map((row, i) => {
      const base = i * 5;
      values.push(rateTableId, row.cepFrom, row.cepTo, row.zoneCode, row.deadlineDays);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    });
    await client.query(
      `insert into rate_zones (rate_table_id, cep_from, cep_to, zone_code, deadline_days) values ${placeholders.join(",")}`,
      values,
    );
  }
}

async function insertPrices(client: DbConnection, rateTableId: string, rows: ZonePriceRow[]): Promise<void> {
  for (const batch of chunk(rows, CHUNK_SIZE)) {
    const values: unknown[] = [];
    const placeholders = batch.map((row, i) => {
      const base = i * 5;
      values.push(rateTableId, row.zoneCode, row.weightFromG, row.weightToG, row.priceCents);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    });
    await client.query(
      `insert into rate_zone_prices (rate_table_id, zone_code, weight_from_g, weight_to_g, price_cents) values ${placeholders.join(",")}`,
      values,
    );
  }
}

export interface ImportZoneTableResult {
  rateTableId: string;
  zoneCount: number;
  priceCount: number;
  unmatchedZones: string[];
}

export async function importZoneRateTable(params: {
  carrierId: string;
  filename: string;
  uploadedBy: string;
  parsed: ParsedZoneTable;
}): Promise<ImportZoneTableResult> {
  const { zones, prices } = params.parsed;
  if (zones.length === 0) throw new Error("Nenhuma faixa de CEP válida encontrada na planilha de abrangência.");
  if (prices.length === 0) throw new Error("Nenhum preço válido encontrado na planilha de preços.");

  const priceZones = new Set(prices.map((p) => p.zoneCode));
  const unmatchedZones = [...new Set(zones.map((z) => z.zoneCode))].filter((z) => !priceZones.has(z));

  const client = await pool.connect();
  try {
    await client.query("begin");

    await client.query("update rate_tables set active = false where carrier_id = $1 and active = true", [
      params.carrierId,
    ]);

    const { rows: inserted } = await client.query<{ id: string }>(
      "insert into rate_tables (carrier_id, filename, uploaded_by) values ($1, $2, $3) returning id",
      [params.carrierId, params.filename, params.uploadedBy],
    );
    const rateTableId = inserted[0]!.id;

    await insertZones(client, rateTableId, zones);
    await insertPrices(client, rateTableId, prices);

    await client.query("commit");
    return { rateTableId, zoneCount: zones.length, priceCount: prices.length, unmatchedZones };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

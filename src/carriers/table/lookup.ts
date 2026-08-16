import { pool } from "../../db/client.js";

export interface TableQuoteResult {
  precoCentavos: number;
  prazoDias: number;
}

/**
 * Transportadora "flat": tabela com preço direto por CEP x peso (sem conceito de zona).
 */
export async function getFlatTableQuote(
  carrierId: string,
  cepDestino: string,
  pesoGramas: number,
): Promise<TableQuoteResult | null> {
  const { rows } = await pool.query<{ price_cents: number; deadline_days: number }>(
    `
    select b.price_cents, b.deadline_days
    from rate_bands b
    join rate_tables t on t.id = b.rate_table_id
    where t.carrier_id = $1
      and t.active = true
      and b.cep_from <= $2 and b.cep_to >= $2
      and b.weight_from_g <= $3 and b.weight_to_g >= $3
    order by b.price_cents asc
    limit 1
    `,
    [carrierId, cepDestino, pesoGramas],
  );

  const row = rows[0];
  if (!row) return null;
  return { precoCentavos: row.price_cents, prazoDias: row.deadline_days };
}

/**
 * Transportadora "zone" (J&T, Loggi): o CEP cai numa zona (praça) com um prazo
 * associado; o preço vem de uma tabela separada por zona x faixa de peso. Duas
 * consultas pequenas em vez de um cross-join gigante pré-calculado.
 */
export async function getZoneTableQuote(
  carrierId: string,
  cepDestino: string,
  pesoGramas: number,
): Promise<TableQuoteResult | null> {
  const { rows: zoneRows } = await pool.query<{ zone_code: string; deadline_days: number }>(
    `
    select z.zone_code, z.deadline_days
    from rate_zones z
    join rate_tables t on t.id = z.rate_table_id
    where t.carrier_id = $1
      and t.active = true
      and z.cep_from <= $2 and z.cep_to >= $2
    limit 1
    `,
    [carrierId, cepDestino],
  );

  const zone = zoneRows[0];
  if (!zone) return null;

  const { rows: priceRows } = await pool.query<{ price_cents: number }>(
    `
    select p.price_cents
    from rate_zone_prices p
    join rate_tables t on t.id = p.rate_table_id
    where t.carrier_id = $1
      and t.active = true
      and p.zone_code = $2
      and p.weight_from_g <= $3 and p.weight_to_g >= $3
    order by p.price_cents asc
    limit 1
    `,
    [carrierId, zone.zone_code, pesoGramas],
  );

  const price = priceRows[0];
  if (!price) return null;

  return { precoCentavos: price.price_cents, prazoDias: zone.deadline_days };
}

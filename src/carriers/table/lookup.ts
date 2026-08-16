import { pool } from "../../db/client.js";

export interface TableQuoteResult {
  precoCentavos: number;
  prazoDias: number;
}

/**
 * Busca a faixa de preço na tabela ativa da transportadora para o CEP e peso informados.
 * Retorna null se nenhuma faixa cobrir o pedido (ex: fora da área de entrega).
 */
export async function getTableQuote(
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

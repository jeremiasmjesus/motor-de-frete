import { pool } from "./client.js";
import type { Carrier } from "../types.js";

interface CarrierRow {
  id: string;
  name: string;
  code: string;
  price_source: "api" | "table";
  pricing_model: "flat" | "zone";
  active: boolean;
}

function toCarrier(r: CarrierRow): Carrier & { id: string } {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    priceSource: r.price_source,
    pricingModel: r.pricing_model,
    active: r.active,
  };
}

const SELECT = "select id, name, code, price_source, pricing_model, active from carriers";

export async function listActiveCarriers(): Promise<(Carrier & { id: string })[]> {
  const { rows } = await pool.query<CarrierRow>(`${SELECT} where active = true`);
  return rows.map(toCarrier);
}

export async function getCarrierByCode(code: string): Promise<(Carrier & { id: string }) | null> {
  const { rows } = await pool.query<CarrierRow>(`${SELECT} where code = $1`, [code]);
  return rows[0] ? toCarrier(rows[0]) : null;
}

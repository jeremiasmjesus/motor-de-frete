import { pool } from "./client.js";
import type { Carrier } from "../types.js";

interface CarrierRow {
  id: string;
  name: string;
  code: string;
  price_source: "api" | "table";
  active: boolean;
}

function toCarrier(r: CarrierRow): Carrier & { id: string } {
  return { id: r.id, name: r.name, code: r.code, priceSource: r.price_source, active: r.active };
}

export async function listActiveCarriers(): Promise<(Carrier & { id: string })[]> {
  const { rows } = await pool.query<CarrierRow>(
    "select id, name, code, price_source, active from carriers where active = true",
  );
  return rows.map(toCarrier);
}

export async function getCarrierByCode(code: string): Promise<(Carrier & { id: string }) | null> {
  const { rows } = await pool.query<CarrierRow>(
    "select id, name, code, price_source, active from carriers where code = $1",
    [code],
  );
  return rows[0] ? toCarrier(rows[0]) : null;
}

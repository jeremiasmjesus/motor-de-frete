import { pool } from "./client.js";
import type { Carrier } from "../types.js";

interface CarrierRow {
  id: string;
  name: string;
  code: string;
  price_source: "api" | "table";
  active: boolean;
}

export async function listActiveCarriers(): Promise<(Carrier & { id: string })[]> {
  const { rows } = await pool.query<CarrierRow>(
    "select id, name, code, price_source, active from carriers where active = true",
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    priceSource: r.price_source,
    active: r.active,
  }));
}

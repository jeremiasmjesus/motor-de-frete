import { pool } from "./client.js";
import type { Rule, RuleAction, RuleCondition, RuleType } from "../types.js";

interface RuleRow {
  id: string;
  title: string;
  type: RuleType;
  carrier_code: string | null;
  condition: RuleCondition;
  action: RuleAction;
  priority: number;
  active: boolean;
  valid_from: Date | null;
  valid_to: Date | null;
}

export async function listActiveRules(): Promise<Rule[]> {
  const { rows } = await pool.query<RuleRow>(`
    select r.id, r.title, r.type, c.code as carrier_code, r.condition, r.action,
           r.priority, r.active, r.valid_from, r.valid_to
    from rules r
    left join carriers c on c.id = r.carrier_id
    where r.active = true
  `);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    carrierCode: r.carrier_code,
    condition: r.condition,
    action: r.action,
    priority: r.priority,
    active: r.active,
    validFrom: r.valid_from,
    validTo: r.valid_to,
  }));
}

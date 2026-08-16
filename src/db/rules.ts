import { pool } from "./client.js";
import { getCarrierByCode } from "./carriers.js";
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

function toRule(r: RuleRow): Rule {
  return {
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
  };
}

const SELECT = `
  select r.id, r.title, r.type, c.code as carrier_code, r.condition, r.action,
         r.priority, r.active, r.valid_from, r.valid_to
  from rules r
  left join carriers c on c.id = r.carrier_id
`;

export async function listActiveRules(): Promise<Rule[]> {
  const { rows } = await pool.query<RuleRow>(`${SELECT} where r.active = true`);
  return rows.map(toRule);
}

export async function listAllRules(): Promise<Rule[]> {
  const { rows } = await pool.query<RuleRow>(`${SELECT} order by r.priority asc, r.created_at desc`);
  return rows.map(toRule);
}

export interface RuleInput {
  title: string;
  type: RuleType;
  carrierCode: string | null;
  condition: RuleCondition;
  action: RuleAction;
  priority: number;
  active: boolean;
  validFrom: string | null;
  validTo: string | null;
}

async function resolveCarrierId(carrierCode: string | null): Promise<string | null> {
  if (!carrierCode) return null;
  const carrier = await getCarrierByCode(carrierCode);
  if (!carrier) throw new Error(`Transportadora "${carrierCode}" não encontrada.`);
  return carrier.id;
}

export async function createRule(input: RuleInput, createdBy: string): Promise<Rule> {
  const carrierId = await resolveCarrierId(input.carrierCode);
  const { rows } = await pool.query<{ id: string }>(
    `insert into rules
      (title, type, carrier_id, condition, action, priority, active, valid_from, valid_to, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning id`,
    [
      input.title,
      input.type,
      carrierId,
      JSON.stringify(input.condition),
      JSON.stringify(input.action),
      input.priority,
      input.active,
      input.validFrom,
      input.validTo,
      createdBy,
    ],
  );
  return getRuleById(rows[0]!.id) as Promise<Rule>;
}

export async function updateRule(id: string, input: RuleInput): Promise<Rule | null> {
  const carrierId = await resolveCarrierId(input.carrierCode);
  await pool.query(
    `update rules set
       title = $2, type = $3, carrier_id = $4, condition = $5, action = $6,
       priority = $7, active = $8, valid_from = $9, valid_to = $10, updated_at = now()
     where id = $1`,
    [
      id,
      input.title,
      input.type,
      carrierId,
      JSON.stringify(input.condition),
      JSON.stringify(input.action),
      input.priority,
      input.active,
      input.validFrom,
      input.validTo,
    ],
  );
  return getRuleById(id);
}

export async function getRuleById(id: string): Promise<Rule | null> {
  const { rows } = await pool.query<RuleRow>(`${SELECT} where r.id = $1`, [id]);
  return rows[0] ? toRule(rows[0]) : null;
}

export async function deleteRule(id: string): Promise<void> {
  await pool.query("delete from rules where id = $1", [id]);
}

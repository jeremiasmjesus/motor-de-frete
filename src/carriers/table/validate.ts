import type { RawRow } from "./parse.js";

export interface NormalizedRow {
  cepFrom: string;
  cepTo: string;
  weightFromG: number;
  weightToG: number;
  priceCents: number;
  deadlineDays: number;
}

export interface RowError {
  row: number; // 1-indexed, contando o cabeçalho como linha 1
  message: string;
}

const CEP_DIGITS = /^\d{8}$/;
const REQUIRED_COLUMNS = ["cep_from", "cep_to", "weight_from_g", "weight_to_g", "price", "deadline_days"] as const;

function normalizeCep(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 0 || digits.length > 8) return null;
  return digits.padStart(8, "0");
}

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

export interface ValidationResult {
  valid: NormalizedRow[];
  errors: RowError[];
}

export function validateRows(rows: RawRow[]): ValidationResult {
  const errors: RowError[] = [];
  const valid: NormalizedRow[] = [];

  if (rows.length === 0) {
    return { valid, errors: [{ row: 1, message: "Planilha vazia — nenhuma linha encontrada." }] };
  }

  const firstRowColumns = Object.keys(rows[0]!);
  const missingColumns = REQUIRED_COLUMNS.filter((col) => !firstRowColumns.includes(col));
  if (missingColumns.length > 0) {
    return {
      valid,
      errors: [{ row: 1, message: `Colunas obrigatórias ausentes: ${missingColumns.join(", ")}` }],
    };
  }

  rows.forEach((raw, index) => {
    const line = index + 2; // +1 pelo cabeçalho, +1 porque index é 0-based
    const rowErrors: string[] = [];

    const cepFrom = normalizeCep(raw.cep_from);
    const cepTo = normalizeCep(raw.cep_to);
    if (!cepFrom) rowErrors.push("cep_from inválido (esperado até 8 dígitos)");
    if (!cepTo) rowErrors.push("cep_to inválido (esperado até 8 dígitos)");
    if (cepFrom && cepTo && cepFrom > cepTo) rowErrors.push("cep_from é maior que cep_to");

    const weightFromG = toNumber(raw.weight_from_g);
    const weightToG = toNumber(raw.weight_to_g);
    if (weightFromG === null || weightFromG < 0) rowErrors.push("weight_from_g inválido");
    if (weightToG === null || weightToG < 0) rowErrors.push("weight_to_g inválido");
    if (weightFromG !== null && weightToG !== null && weightFromG >= weightToG) {
      rowErrors.push("weight_from_g deve ser menor que weight_to_g");
    }

    const price = toNumber(raw.price);
    if (price === null || price <= 0) rowErrors.push("price inválido (esperado número maior que zero)");

    const deadlineDays = toNumber(raw.deadline_days);
    if (deadlineDays === null || deadlineDays <= 0 || !Number.isInteger(deadlineDays)) {
      rowErrors.push("deadline_days inválido (esperado inteiro maior que zero)");
    }

    if (rowErrors.length > 0) {
      errors.push({ row: line, message: rowErrors.join("; ") });
      return;
    }

    valid.push({
      cepFrom: cepFrom!,
      cepTo: cepTo!,
      weightFromG: weightFromG!,
      weightToG: weightToG!,
      priceCents: Math.round(price! * 100),
      deadlineDays: deadlineDays!,
    });
  });

  return { valid, errors };
}

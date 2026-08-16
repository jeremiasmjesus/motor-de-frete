export interface ZoneRow {
  cepFrom: string;
  cepTo: string;
  zoneCode: string;
  deadlineDays: number;
}

export interface ZonePriceRow {
  zoneCode: string;
  weightFromG: number;
  weightToG: number;
  priceCents: number;
}

export interface ParsedZoneTable {
  zones: ZoneRow[];
  prices: ZonePriceRow[];
}

export function normalizeZoneCode(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.length > 0 ? cleaned : null;
}

export function cepDigits(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 0 || digits.length > 8) return null;
  return digits.padStart(8, "0");
}

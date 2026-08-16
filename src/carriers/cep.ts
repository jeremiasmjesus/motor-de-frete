/**
 * Faixas oficiais de CEP por estado (primeiros dígitos). Aproximação suficiente
 * para condições de regra como "região = Sudeste" — não usar para roteamento postal.
 */
const RANGES: { from: number; to: number; uf: string }[] = [
  { from: 1000, to: 19999, uf: "SP" },
  { from: 20000, to: 28999, uf: "RJ" },
  { from: 29000, to: 29999, uf: "ES" },
  { from: 30000, to: 39999, uf: "MG" },
  { from: 40000, to: 48999, uf: "BA" },
  { from: 49000, to: 49999, uf: "SE" },
  { from: 50000, to: 56999, uf: "PE" },
  { from: 57000, to: 57999, uf: "AL" },
  { from: 58000, to: 58999, uf: "PB" },
  { from: 59000, to: 59999, uf: "RN" },
  { from: 60000, to: 63999, uf: "CE" },
  { from: 64000, to: 64999, uf: "PI" },
  { from: 65000, to: 65999, uf: "MA" },
  { from: 66000, to: 68899, uf: "PA" },
  { from: 68900, to: 68999, uf: "AP" },
  { from: 69000, to: 69299, uf: "AM" },
  { from: 69300, to: 69399, uf: "RR" },
  { from: 69400, to: 69899, uf: "AM" },
  { from: 69900, to: 69999, uf: "AC" },
  { from: 70000, to: 73699, uf: "DF" },
  { from: 73700, to: 76799, uf: "GO" },
  { from: 76800, to: 76999, uf: "RO" },
  { from: 77000, to: 77999, uf: "TO" },
  { from: 78000, to: 78899, uf: "MT" },
  { from: 79000, to: 79999, uf: "MS" },
  { from: 80000, to: 87999, uf: "PR" },
  { from: 88000, to: 89999, uf: "SC" },
  { from: 90000, to: 99999, uf: "RS" },
];

export function cepToUf(cep: string): string | null {
  const prefix = parseInt(cep.slice(0, 5), 10);
  if (Number.isNaN(prefix)) return null;
  return RANGES.find((r) => prefix >= r.from && prefix <= r.to)?.uf ?? null;
}

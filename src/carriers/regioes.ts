export const REGIOES = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"] as const;
export type Regiao = (typeof REGIOES)[number];

const UF_POR_REGIAO: Record<Regiao, string[]> = {
  Norte: ["AC", "AP", "AM", "PA", "RO", "RR", "TO"],
  Nordeste: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  "Centro-Oeste": ["DF", "GO", "MT", "MS"],
  Sudeste: ["ES", "MG", "RJ", "SP"],
  Sul: ["PR", "RS", "SC"],
};

const UF_TO_REGIAO = new Map<string, Regiao>();
for (const [regiao, ufs] of Object.entries(UF_POR_REGIAO)) {
  for (const uf of ufs) UF_TO_REGIAO.set(uf, regiao as Regiao);
}

export function ufToRegiao(uf: string): Regiao | null {
  return UF_TO_REGIAO.get(uf) ?? null;
}

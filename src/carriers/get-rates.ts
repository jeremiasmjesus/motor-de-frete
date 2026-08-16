import { listActiveCarriers } from "../db/carriers.js";
import { listActiveRules } from "../db/rules.js";
import { getCorreiosQuote } from "./correios/client.js";
import { getFlatTableQuote, getZoneTableQuote } from "./table/lookup.js";
import { cepToUf } from "./cep.js";
import { applyRules } from "../rules/engine.js";
import type { BaseQuote } from "../types.js";

export interface RateRequest {
  originCep: string;
  destinationCep: string;
  totalGrams: number;
  /** Valor final do carrinho/pedido, já com desconto — usado nas condições de regra. */
  cartValueCents: number;
  /** Dimensões em cm — usadas pelos Correios pra calcular peso cubado. Ignoradas pelas transportadoras por tabela. */
  dimensoes?: { comprimento: number; largura: number; altura: number };
}

/**
 * Cota em todas as transportadoras ativas e aplica as regras de negócio.
 * Compartilhado pelo endpoint público (Nuvemshop) e pela cotação manual do painel.
 */
export async function getRates(req: RateRequest): Promise<BaseQuote[]> {
  const destinationUf = cepToUf(req.destinationCep);
  const [carriers, rules] = await Promise.all([listActiveCarriers(), listActiveRules()]);

  const results: BaseQuote[] = [];

  for (const carrier of carriers) {
    let base: BaseQuote | null = null;

    try {
      if (carrier.priceSource === "api") {
        const result = await getCorreiosQuote({
          cepOrigem: req.originCep,
          cepDestino: req.destinationCep,
          pesoGramas: req.totalGrams,
          dimensoes: req.dimensoes,
        });
        base = {
          carrierCode: carrier.code,
          carrierName: carrier.name,
          priceCents: result.precoCentavos,
          deadlineDays: 3, // TODO: complementar com a API Prazo dos Correios
        };
      } else {
        const result =
          carrier.pricingModel === "zone"
            ? await getZoneTableQuote(carrier.id, req.destinationCep, req.totalGrams)
            : await getFlatTableQuote(carrier.id, req.destinationCep, req.totalGrams);
        if (result) {
          base = {
            carrierCode: carrier.code,
            carrierName: carrier.name,
            priceCents: result.precoCentavos,
            deadlineDays: result.prazoDias,
          };
        }
      }
    } catch (err) {
      console.error(`[get-rates] falha ao cotar ${carrier.code}:`, err instanceof Error ? err.message : err);
      continue; // não derruba a cotação inteira por causa de uma transportadora fora do ar
    }

    if (!base) continue;

    const adjusted = applyRules(base, rules, {
      cartValueCents: req.cartValueCents,
      destinationUf: destinationUf ?? "",
      destinationCep: req.destinationCep,
    });

    results.push(adjusted);
  }

  return results.sort((a, b) => a.priceCents - b.priceCents);
}

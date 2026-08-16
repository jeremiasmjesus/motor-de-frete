import { listActiveCarriers } from "../db/carriers.js";
import { listActiveRules } from "../db/rules.js";
import { getCorreiosDeadline, getCorreiosQuote } from "./correios/client.js";
import { getFlatTableQuote, getZoneTableQuote } from "./table/lookup.js";
import { cepToUf } from "./cep.js";
import { applyFreeShipping, applyRules } from "../rules/engine.js";
import type { BaseQuote, QuoteContext } from "../types.js";

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

  const ctx: QuoteContext = {
    cartValueCents: req.cartValueCents,
    destinationUf: destinationUf ?? "",
    destinationCep: req.destinationCep,
  };

  const results: BaseQuote[] = [];

  for (const carrier of carriers) {
    let base: BaseQuote | null = null;

    try {
      if (carrier.priceSource === "api") {
        const [priceResult, deadlineResult] = await Promise.all([
          getCorreiosQuote({
            cepOrigem: req.originCep,
            cepDestino: req.destinationCep,
            pesoGramas: req.totalGrams,
            dimensoes: req.dimensoes,
          }),
          getCorreiosDeadline({ cepOrigem: req.originCep, cepDestino: req.destinationCep }).catch((err) => {
            // a API Prazo exige um serviço à parte no contrato — se não estiver liberada,
            // cai num prazo padrão em vez de derrubar a cotação inteira dos Correios.
            console.error("[get-rates] falha ao consultar prazo dos Correios:", err instanceof Error ? err.message : err);
            return null;
          }),
        ]);
        base = {
          carrierCode: carrier.code,
          carrierName: carrier.name,
          priceCents: priceResult.precoCentavos,
          deadlineDays: deadlineResult?.prazoDias ?? 3,
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

    results.push(applyRules(base, rules, ctx));
  }

  const withFreeShipping = applyFreeShipping(results, rules, ctx);
  return withFreeShipping.sort((a, b) => a.priceCents - b.priceCents);
}

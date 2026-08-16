import type { BaseQuote, QuoteContext, Rule } from "../types.js";

function conditionMatches(rule: Rule, carrierCode: string, ctx: QuoteContext, now: Date): boolean {
  if (rule.carrierCode !== null && rule.carrierCode !== carrierCode) return false;
  if (rule.validFrom && now < rule.validFrom) return false;
  if (rule.validTo && now > rule.validTo) return false;

  const c = rule.condition;
  if (c.carrierCode && c.carrierCode !== carrierCode) return false;
  if (c.cartValueMinCents !== undefined && ctx.cartValueCents < c.cartValueMinCents) return false;
  if (c.ufIn && !c.ufIn.includes(ctx.destinationUf)) return false;

  return true;
}

function applyAction(quote: BaseQuote, rule: Rule): BaseQuote {
  const a = rule.action;
  switch (rule.type) {
    case "valor_fixo":
      return { ...quote, priceCents: a.fixedPriceCents ?? quote.priceCents };
    case "valor_fixo_adicional":
      return { ...quote, priceCents: quote.priceCents + (a.additionalPriceCents ?? 0) };
    case "percentual":
      return {
        ...quote,
        priceCents: Math.round(quote.priceCents * (1 + (a.percentual ?? 0) / 100)),
      };
    case "frete_gratis":
      return { ...quote, priceCents: 0 };
    case "acrescimo_prazo":
      return { ...quote, deadlineDays: quote.deadlineDays + (a.additionalDays ?? 0) };
    default:
      return quote;
  }
}

/**
 * Aplica as regras ativas, em ordem de prioridade (menor primeiro), sobre a cotação base.
 * Regras de prioridade mais alta (ex: frete grátis condicional) tendem a rodar por último
 * e podem sobrescrever o resultado das anteriores — mesmo comportamento observado no
 * modelo de "ordem de execução" do Frete Barato.
 */
export function applyRules(
  base: BaseQuote,
  rules: Rule[],
  ctx: QuoteContext,
  now: Date = new Date(),
): BaseQuote {
  const applicable = rules
    .filter((r) => r.active && conditionMatches(r, base.carrierCode, ctx, now))
    .sort((a, b) => a.priority - b.priority);

  return applicable.reduce(applyAction, base);
}

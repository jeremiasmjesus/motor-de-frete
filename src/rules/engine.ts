import type { BaseQuote, QuoteContext, Rule } from "../types.js";
import { ufToRegiao } from "../carriers/regioes.js";

function geoMatches(rule: Rule, ctx: QuoteContext): boolean {
  const c = rule.condition;
  switch (c.geoMode) {
    case undefined:
      return true; // sem filtro geográfico — aplica em qualquer lugar
    case "regiao": {
      const regiao = ufToRegiao(ctx.destinationUf);
      return regiao !== null && (c.regioes ?? []).includes(regiao);
    }
    case "estado":
      return (c.ufs ?? []).includes(ctx.destinationUf);
    case "cep":
      if (!c.cepFrom || !c.cepTo) return true;
      return ctx.destinationCep >= c.cepFrom && ctx.destinationCep <= c.cepTo;
    default:
      return true;
  }
}

function conditionMatches(rule: Rule, carrierCode: string, ctx: QuoteContext, now: Date): boolean {
  if (rule.carrierCode !== null && rule.carrierCode !== carrierCode) return false;
  if (rule.validFrom && now < rule.validFrom) return false;
  if (rule.validTo && now > rule.validTo) return false;

  const c = rule.condition;
  if (c.cartValueMinCents !== undefined && ctx.cartValueCents < c.cartValueMinCents) return false;
  if (!geoMatches(rule, ctx)) return false;

  return true;
}

function applyAction(quote: BaseQuote, rule: Rule, ctx: QuoteContext): BaseQuote {
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
    case "percentual_valor_declarado": {
      // Gris, Ad Valorem etc — incide sobre o valor do pedido, não sobre o preço do frete.
      const taxa = Math.round(ctx.cartValueCents * ((a.percentualValorDeclarado ?? 0) / 100));
      return { ...quote, priceCents: quote.priceCents + taxa };
    }
    case "acrescimo_prazo":
      return { ...quote, deadlineDays: quote.deadlineDays + (a.additionalDays ?? 0) };
    default:
      return quote;
  }
}

/**
 * Aplica as regras de valor/prazo (tudo exceto frete grátis), em ordem de prioridade,
 * sobre a cotação de UMA transportadora. Frete grátis é tratado à parte por
 * `applyFreeShipping`, porque a regra é "a mais barata elegível fica grátis, as
 * outras continuam pagas" — não dá pra decidir isso olhando uma transportadora
 * de cada vez.
 */
export function applyRules(
  base: BaseQuote,
  rules: Rule[],
  ctx: QuoteContext,
  now: Date = new Date(),
): BaseQuote {
  const applicable = rules
    .filter((r) => r.active && r.type !== "frete_gratis" && conditionMatches(r, base.carrierCode, ctx, now))
    .sort((a, b) => a.priority - b.priority);

  return applicable.reduce((quote, rule) => applyAction(quote, rule, ctx), base);
}

/**
 * Entre as transportadoras elegíveis pra alguma regra de frete grátis ativa,
 * zera o preço só da mais barata — as demais continuam com o preço calculado,
 * disponíveis pra quem quiser pagar por uma opção mais rápida.
 */
export function applyFreeShipping(
  quotes: BaseQuote[],
  rules: Rule[],
  ctx: QuoteContext,
  now: Date = new Date(),
): BaseQuote[] {
  const freeRules = rules.filter((r) => r.active && r.type === "frete_gratis");
  if (freeRules.length === 0) return quotes;

  const eligible = quotes.filter((q) => freeRules.some((r) => conditionMatches(r, q.carrierCode, ctx, now)));
  if (eligible.length === 0) return quotes;

  const cheapest = eligible.reduce((min, q) => (q.priceCents < min.priceCents ? q : min));

  return quotes.map((q) =>
    q === cheapest ? { ...q, priceCents: 0, originalPriceCents: cheapest.priceCents } : q,
  );
}

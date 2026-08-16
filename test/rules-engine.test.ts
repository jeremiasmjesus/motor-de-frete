import { describe, expect, it } from "vitest";
import { applyFreeShipping, applyRules } from "../src/rules/engine.js";
import type { BaseQuote, Rule } from "../src/types.js";

const base: BaseQuote = {
  carrierCode: "correios",
  carrierName: "Sedex",
  priceCents: 2490,
  deadlineDays: 3,
};

const ctx = { cartValueCents: 35000, destinationUf: "SP", destinationCep: "01310100" };

function rule(overrides: Partial<Rule>): Rule {
  return {
    id: "r1",
    title: "regra de teste",
    type: "valor_fixo_adicional",
    carrierCode: null,
    condition: {},
    action: {},
    priority: 0,
    active: true,
    validFrom: null,
    validTo: null,
    ...overrides,
  };
}

describe("applyRules", () => {
  it("sem regras, devolve o preço base intacto", () => {
    expect(applyRules(base, [], ctx)).toEqual(base);
  });

  it("aplica markup fixo só na transportadora alvo", () => {
    const rules = [
      rule({ carrierCode: "correios", type: "valor_fixo_adicional", action: { additionalPriceCents: 400 } }),
      rule({ carrierCode: "loggi", type: "valor_fixo_adicional", action: { additionalPriceCents: 999999 } }),
    ];
    const result = applyRules(base, rules, ctx);
    expect(result.priceCents).toBe(2890);
  });

  it("aplica percentual de acréscimo", () => {
    const rules = [rule({ type: "percentual", action: { percentual: 12 } })];
    expect(applyRules(base, rules, ctx).priceCents).toBe(2789); // 2490 * 1.12 arredondado
  });

  it("não mexe no preço por causa de regra de frete grátis — isso é responsabilidade do applyFreeShipping", () => {
    const rules = [rule({ type: "frete_gratis", condition: { cartValueMinCents: 30000 } })];
    expect(applyRules(base, rules, ctx).priceCents).toBe(base.priceCents);
  });

  it("ignora regra inativa", () => {
    const rules = [rule({ active: false, type: "valor_fixo", action: { fixedPriceCents: 1 } })];
    expect(applyRules(base, rules, ctx).priceCents).toBe(base.priceCents);
  });

  it("respeita vigência por período", () => {
    const rules = [
      rule({
        type: "valor_fixo",
        action: { fixedPriceCents: 880 },
        validFrom: new Date("2020-01-01"),
        validTo: new Date("2020-01-31"),
      }),
    ];
    expect(applyRules(base, rules, ctx, new Date("2026-08-16")).priceCents).toBe(base.priceCents);
  });

  it("acréscimo de prazo soma dias sem afetar o preço", () => {
    const rules = [rule({ type: "acrescimo_prazo", action: { additionalDays: 2 } })];
    const result = applyRules(base, rules, ctx);
    expect(result.deadlineDays).toBe(5);
    expect(result.priceCents).toBe(base.priceCents);
  });
});

describe("applyFreeShipping", () => {
  const quotes: BaseQuote[] = [
    { carrierCode: "correios", carrierName: "Sedex", priceCents: 5629, deadlineDays: 3 },
    { carrierCode: "loggi", carrierName: "Loggi", priceCents: 2349, deadlineDays: 4 },
    { carrierCode: "jt-express", carrierName: "J&T Express", priceCents: 1644, deadlineDays: 4 },
  ];

  it("zera só a mais barata elegível, mantém as outras pagas", () => {
    const rules = [rule({ type: "frete_gratis", condition: { cartValueMinCents: 30000 } })];
    const result = applyFreeShipping(quotes, rules, ctx);

    const jt = result.find((q) => q.carrierCode === "jt-express")!;
    const loggi = result.find((q) => q.carrierCode === "loggi")!;
    const sedex = result.find((q) => q.carrierCode === "correios")!;

    expect(jt.priceCents).toBe(0);
    expect(jt.originalPriceCents).toBe(1644);
    expect(loggi.priceCents).toBe(2349);
    expect(sedex.priceCents).toBe(5629);
  });

  it("sem condição batendo, nenhuma fica grátis", () => {
    const rules = [rule({ type: "frete_gratis", condition: { cartValueMinCents: 100000 } })];
    const result = applyFreeShipping(quotes, rules, { ...ctx, cartValueCents: 5000 });
    expect(result).toEqual(quotes);
  });

  it("regra restrita a uma transportadora só considera essa transportadora, mesmo não sendo a mais barata geral", () => {
    const rules = [rule({ type: "frete_gratis", carrierCode: "correios", condition: {} })];
    const result = applyFreeShipping(quotes, rules, ctx);

    expect(result.find((q) => q.carrierCode === "correios")!.priceCents).toBe(0);
    expect(result.find((q) => q.carrierCode === "loggi")!.priceCents).toBe(2349);
    expect(result.find((q) => q.carrierCode === "jt-express")!.priceCents).toBe(1644);
  });

  it("condição por região só torna elegíveis os destinos daquela região", () => {
    const rules = [rule({ type: "frete_gratis", condition: { geoMode: "regiao", regioes: ["Sul"] } })];
    const result = applyFreeShipping(quotes, rules, { ...ctx, destinationUf: "SP" });
    expect(result).toEqual(quotes); // SP não é Sul, ninguém fica grátis
  });

  it("ignora regra inativa", () => {
    const rules = [rule({ type: "frete_gratis", active: false, condition: {} })];
    expect(applyFreeShipping(quotes, rules, ctx)).toEqual(quotes);
  });
});

import { describe, expect, it } from "vitest";
import { applyRules } from "../src/rules/engine.js";
import type { BaseQuote, Rule } from "../src/types.js";

const base: BaseQuote = {
  carrierCode: "correios",
  carrierName: "Correios",
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

  it("frete grátis condicional zera o preço quando o valor final do carrinho bate", () => {
    const rules = [
      rule({ type: "percentual", priority: 0, action: { percentual: 10 } }),
      rule({
        type: "frete_gratis",
        priority: 99,
        condition: { cartValueMinCents: 30000, geoMode: "estado", ufs: ["SP", "RJ"] },
        action: {},
      }),
    ];
    expect(applyRules(base, rules, ctx).priceCents).toBe(0);
  });

  it("não aplica frete grátis se o valor do carrinho não atinge o mínimo", () => {
    const rules = [
      rule({
        type: "frete_gratis",
        priority: 99,
        condition: { cartValueMinCents: 100000 },
        action: {},
      }),
    ];
    expect(applyRules(base, rules, { ...ctx, cartValueCents: 5000 }).priceCents).toBe(base.priceCents);
  });

  it("condição por região bate quando a UF pertence à região selecionada", () => {
    const rules = [
      rule({ type: "frete_gratis", condition: { geoMode: "regiao", regioes: ["Sudeste"] } }),
    ];
    expect(applyRules(base, rules, { ...ctx, destinationUf: "MG" }).priceCents).toBe(0);
  });

  it("condição por região não bate fora da região selecionada", () => {
    const rules = [
      rule({ type: "frete_gratis", condition: { geoMode: "regiao", regioes: ["Sul"] } }),
    ];
    expect(applyRules(base, rules, { ...ctx, destinationUf: "SP" }).priceCents).toBe(base.priceCents);
  });

  it("condição por faixa de CEP bate quando o CEP de destino está dentro da faixa", () => {
    const rules = [
      rule({ type: "frete_gratis", condition: { geoMode: "cep", cepFrom: "01000000", cepTo: "01999999" } }),
    ];
    expect(applyRules(base, rules, ctx).priceCents).toBe(0);
  });

  it("condição por faixa de CEP não bate fora da faixa", () => {
    const rules = [
      rule({ type: "frete_gratis", condition: { geoMode: "cep", cepFrom: "02000000", cepTo: "02999999" } }),
    ];
    expect(applyRules(base, rules, ctx).priceCents).toBe(base.priceCents);
  });

  it("ignora regra inativa", () => {
    const rules = [rule({ active: false, type: "frete_gratis" })];
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

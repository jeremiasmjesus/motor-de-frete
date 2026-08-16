import { describe, expect, it } from "vitest";
import { validateRows } from "../src/carriers/table/validate.js";

const validRow = {
  cep_from: "01000000",
  cep_to: "05999999",
  weight_from_g: 0,
  weight_to_g: 1000,
  price: "24,90",
  deadline_days: 3,
};

describe("validateRows", () => {
  it("aceita uma linha bem formada", () => {
    const { valid, errors } = validateRows([validRow]);
    expect(errors).toHaveLength(0);
    expect(valid).toEqual([
      { cepFrom: "01000000", cepTo: "05999999", weightFromG: 0, weightToG: 1000, priceCents: 2490, deadlineDays: 3 },
    ]);
  });

  it("rejeita planilha sem colunas obrigatórias", () => {
    const { errors } = validateRows([{ cep_from: "01000000" } as any]);
    expect(errors[0]?.message).toMatch(/Colunas obrigatórias ausentes/);
  });

  it("rejeita cep_from maior que cep_to", () => {
    const { errors } = validateRows([{ ...validRow, cep_from: "09999999", cep_to: "01000000" }]);
    expect(errors[0]?.message).toMatch(/cep_from é maior que cep_to/);
  });

  it("rejeita faixa de peso invertida", () => {
    const { errors } = validateRows([{ ...validRow, weight_from_g: 1000, weight_to_g: 500 }]);
    expect(errors[0]?.message).toMatch(/weight_from_g deve ser menor/);
  });

  it("rejeita preço zero ou negativo", () => {
    const { errors } = validateRows([{ ...validRow, price: 0 }]);
    expect(errors[0]?.message).toMatch(/price inválido/);
  });

  it("rejeita prazo não inteiro", () => {
    const { errors } = validateRows([{ ...validRow, deadline_days: 2.5 }]);
    expect(errors[0]?.message).toMatch(/deadline_days inválido/);
  });

  it("não importa nada (valid vazio) se qualquer linha tiver erro", () => {
    const { valid, errors } = validateRows([validRow, { ...validRow, price: -1 }]);
    expect(errors).toHaveLength(1);
    expect(valid).toHaveLength(1); // a boa linha ainda é reportada como válida — quem decide o all-or-nothing é o import
  });

  it("aceita CEP com máscara (00000-000)", () => {
    const { valid, errors } = validateRows([{ ...validRow, cep_from: "01000-000", cep_to: "05999-999" }]);
    expect(errors).toHaveLength(0);
    expect(valid[0]?.cepFrom).toBe("01000000");
  });
});

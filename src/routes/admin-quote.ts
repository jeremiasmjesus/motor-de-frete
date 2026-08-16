import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRates } from "../carriers/get-rates.js";

// CEP de origem da loja (Goiânia) — mesmo usado na cotação de prazo da J&T e nos testes
// de conexão dos Correios. Não há hoje um cadastro de "CEP da loja" no sistema; se a
// origem mudar, atualizar aqui.
const ORIGIN_CEP = "74473140";

const manualQuoteBody = z.object({
  comprimento: z.number().positive(),
  largura: z.number().positive(),
  altura: z.number().positive(),
  pesoKg: z.number().positive(),
  valor: z.number().nonnegative(),
  cepDestino: z.string().regex(/^\d{8}$/, "CEP precisa ter 8 dígitos"),
});

function describeZodError(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "campo"}: ${issue.message}`).join(" · ");
}

export default async function adminQuoteRoutes(app: FastifyInstance) {
  app.post("/admin/quote-manual", { preHandler: app.requireRole("operador") }, async (request, reply) => {
    const parsed = manualQuoteBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: describeZodError(parsed.error) });
    }

    const { comprimento, largura, altura, pesoKg, valor, cepDestino } = parsed.data;

    const rates = await getRates({
      originCep: ORIGIN_CEP,
      destinationCep: cepDestino,
      totalGrams: Math.round(pesoKg * 1000),
      cartValueCents: Math.round(valor * 100),
      dimensoes: { comprimento, largura, altura },
    });

    return rates;
  });
}

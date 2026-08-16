import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listActiveCarriers } from "../db/carriers.js";
import { createRule, deleteRule, listAllRules, updateRule, type RuleInput } from "../db/rules.js";
import type { AuthUser } from "../types.js";

function describeZodError(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "campo"}: ${issue.message}`).join(" · ");
}

const ruleBody = z.object({
  title: z.string().min(1, "informe um título"),
  type: z.enum([
    "valor_fixo",
    "valor_fixo_adicional",
    "percentual",
    "percentual_valor_declarado",
    "frete_gratis",
    "acrescimo_prazo",
  ]),
  carrierCode: z.string().nullable(),
  condition: z.object({
    cartValueMinCents: z.number().int().nonnegative().optional(),
    geoMode: z.enum(["regiao", "estado", "cep"]).optional(),
    regioes: z.array(z.string()).optional(),
    ufs: z.array(z.string().length(2)).optional(),
    cepFrom: z.string().length(8).optional(),
    cepTo: z.string().length(8).optional(),
  }),
  action: z.object({
    fixedPriceCents: z.number().int().nonnegative().optional(),
    additionalPriceCents: z.number().int().optional(),
    percentual: z.number().optional(),
    percentualValorDeclarado: z.number().optional(),
    additionalDays: z.number().int().optional(),
  }),
  priority: z.number().int(),
  active: z.boolean(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
});

export default async function adminRulesRoutes(app: FastifyInstance) {
  app.get("/admin/carriers/all", { preHandler: app.requireRole("operador") }, async () => {
    return listActiveCarriers();
  });

  app.get("/admin/rules", { preHandler: app.requireRole("operador") }, async () => {
    return listAllRules();
  });

  app.post("/admin/rules", { preHandler: app.requireRole("operador") }, async (request, reply) => {
    const parsed = ruleBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: `Regra inválida — ${describeZodError(parsed.error)}` });
    }

    const user = request.user as AuthUser;
    try {
      const rule = await createRule(parsed.data as RuleInput, user.id);
      return reply.code(201).send(rule);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Falha ao criar regra." });
    }
  });

  app.put("/admin/rules/:id", { preHandler: app.requireRole("operador") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = ruleBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: `Regra inválida — ${describeZodError(parsed.error)}` });
    }

    try {
      const rule = await updateRule(id, parsed.data as RuleInput);
      if (!rule) return reply.code(404).send({ error: "Regra não encontrada." });
      return rule;
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Falha ao salvar regra." });
    }
  });

  app.delete("/admin/rules/:id", { preHandler: app.requireRole("operador") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteRule(id);
    return reply.code(204).send();
  });
}

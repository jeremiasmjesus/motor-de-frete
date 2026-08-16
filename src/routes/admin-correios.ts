import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getCorreiosCredentialsStatus, saveCorreiosCredentials } from "../carriers/correios/credentials.js";
import { invalidateCorreiosTokenCache, testCorreiosCredentials } from "../carriers/correios/client.js";
import type { AuthUser } from "../types.js";

const credentialsBody = z.object({
  user: z.string().min(1, "informe o usuário (geralmente o CNPJ cadastrado no CWS)"),
  codigoAcesso: z.string().min(1, "informe o código de acesso gerado no CWS"),
  cartaoPostagem: z.string().min(1, "informe o número do cartão de postagem"),
});

const testBody = z.object({
  cepOrigem: z.string().regex(/^\d{8}$/, "CEP de origem precisa ter 8 dígitos"),
  cepDestino: z.string().regex(/^\d{8}$/, "CEP de destino precisa ter 8 dígitos"),
  pesoGramas: z.number().int().positive().default(300),
});

export default async function adminCorreiosRoutes(app: FastifyInstance) {
  app.get("/admin/correios/credentials", { preHandler: app.requireRole("admin") }, async () => {
    return getCorreiosCredentialsStatus();
  });

  app.put("/admin/correios/credentials", { preHandler: app.requireRole("admin") }, async (request, reply) => {
    const parsed = credentialsBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Credenciais inválidas.", details: parsed.error.flatten() });
    }

    const user = request.user as AuthUser;
    await saveCorreiosCredentials(parsed.data, user.id);
    invalidateCorreiosTokenCache();

    return getCorreiosCredentialsStatus();
  });

  app.post("/admin/correios/credentials/test", { preHandler: app.requireRole("admin") }, async (request, reply) => {
    const parsed = testBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Parâmetros de teste inválidos.", details: parsed.error.flatten() });
    }

    const result = await testCorreiosCredentials(parsed.data);
    return reply.code(result.ok ? 200 : 422).send(result);
  });
}

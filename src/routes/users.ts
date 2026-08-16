import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/client.js";
import { hashPassword } from "../auth/password.js";

function describeZodError(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "campo"}: ${issue.message}`).join(" · ");
}

const createUserBody = z.object({
  name: z.string().min(1, "informe o nome"),
  email: z.string().email("e-mail inválido"),
  password: z.string().min(8, "a senha precisa ter pelo menos 8 caracteres"),
  role: z.enum(["admin", "operador"]).default("operador"),
});

const updateUserBody = z.object({
  role: z.enum(["admin", "operador"]),
  active: z.boolean(),
});

const resetPasswordBody = z.object({
  password: z.string().min(8, "a senha precisa ter pelo menos 8 caracteres"),
});

async function countActiveAdmins(excludingId?: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    "select count(*)::text as count from users where role = 'admin' and active = true and id != $1",
    [excludingId ?? "00000000-0000-0000-0000-000000000000"],
  );
  return Number(rows[0]!.count);
}

/**
 * Gestão de usuários — restrita a admins. Operadores conseguem editar
 * tabelas e regras (rotas próprias), mas não criar ou promover contas.
 */
export default async function userRoutes(app: FastifyInstance) {
  app.get("/users", { preHandler: app.requireRole("admin") }, async () => {
    const { rows } = await pool.query(
      "select id, name, email, role, active, created_at from users order by created_at",
    );
    return rows;
  });

  app.post("/users", { preHandler: app.requireRole("admin") }, async (request, reply) => {
    const parsed = createUserBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: describeZodError(parsed.error) });
    }

    const { name, email, password, role } = parsed.data;
    const passwordHash = await hashPassword(password);

    try {
      const { rows } = await pool.query(
        "insert into users (name, email, password_hash, role) values ($1, $2, $3, $4) returning id, name, email, role, active, created_at",
        [name, email, passwordHash, role],
      );
      return reply.code(201).send(rows[0]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("unique")) {
        return reply.code(400).send({ error: `Já existe um usuário com o e-mail ${email}.` });
      }
      throw err;
    }
  });

  app.patch("/users/:id", { preHandler: app.requireRole("admin") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateUserBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: describeZodError(parsed.error) });
    }

    const { role, active } = parsed.data;
    const demotingOrDeactivating = role !== "admin" || !active;

    if (demotingOrDeactivating && (await countActiveAdmins(id)) === 0) {
      return reply.code(400).send({
        error: "Não é possível remover o admin ou desativar essa conta — não sobraria nenhum admin ativo.",
      });
    }

    const { rows } = await pool.query(
      "update users set role = $2, active = $3 where id = $1 returning id, name, email, role, active, created_at",
      [id, role, active],
    );
    if (!rows[0]) return reply.code(404).send({ error: "Usuário não encontrado." });
    return rows[0];
  });

  app.post("/users/:id/reset-password", { preHandler: app.requireRole("admin") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = resetPasswordBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: describeZodError(parsed.error) });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const { rows } = await pool.query<{ id: string }>(
      "update users set password_hash = $2 where id = $1 returning id",
      [id, passwordHash],
    );
    if (!rows[0]) return reply.code(404).send({ error: "Usuário não encontrado." });
    return { ok: true };
  });
}

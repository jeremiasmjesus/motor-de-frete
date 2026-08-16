import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/client.js";
import { hashPassword } from "../auth/password.js";

const createUserBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "operador"]).default("operador"),
});

/**
 * Gestão de usuários — restrita a admins. Operadores conseguem editar
 * tabelas e regras (rotas próprias), mas não criar ou promover contas.
 */
export default async function userRoutes(app: FastifyInstance) {
  app.get("/users", { preHandler: app.requireRole("admin") }, async () => {
    const { rows } = await pool.query("select id, name, email, role, active, created_at from users order by created_at");
    return rows;
  });

  app.post("/users", { preHandler: app.requireRole("admin") }, async (request, reply) => {
    const parsed = createUserBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Dados de usuário inválidos.", details: parsed.error.flatten() });
    }

    const { name, email, password, role } = parsed.data;
    const passwordHash = await hashPassword(password);

    const { rows } = await pool.query(
      "insert into users (name, email, password_hash, role) values ($1, $2, $3, $4) returning id, name, email, role",
      [name, email, passwordHash, role],
    );

    return reply.code(201).send(rows[0]);
  });
}

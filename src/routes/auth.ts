import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { findUserByEmail } from "../db/users.js";
import { verifyPassword } from "../auth/password.js";

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const body = loginBody.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "E-mail ou senha inválidos." });
    }

    const user = await findUserByEmail(body.data.email);
    if (!user || !(await verifyPassword(body.data.password, user.password_hash))) {
      return reply.code(401).send({ error: "E-mail ou senha inválidos." });
    }

    const token = app.jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      { expiresIn: "8h" },
    );

    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  });
}

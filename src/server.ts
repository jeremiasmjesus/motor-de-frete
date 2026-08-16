import "dotenv/config";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import authPlugin from "./auth/plugin.js";
import authRoutes from "./routes/auth.js";
import quoteRoutes from "./routes/quote.js";
import userRoutes from "./routes/users.js";
import adminCorreiosRoutes from "./routes/admin-correios.js";
import adminTableRoutes from "./routes/admin-tables.js";
import adminRulesRoutes from "./routes/admin-rules.js";
import { pool } from "./db/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true });

await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } });
await app.register(authPlugin);
await app.register(authRoutes);
await app.register(quoteRoutes);
await app.register(userRoutes);
await app.register(adminCorreiosRoutes);
await app.register(adminTableRoutes);
await app.register(adminRulesRoutes);

await app.register(fastifyStatic, {
  root: join(__dirname, "..", "public"),
  prefix: "/painel/",
});

app.get("/health", async () => ({ ok: true }));
app.get("/", async (_request, reply) => reply.redirect("/painel/login.html"));

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

// Encerramento limpo é obrigatório com o PGlite embarcado — matar o processo
// sem fechar o banco corrompe os arquivos de dados locais.
async function shutdown() {
  await app.close();
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

import "dotenv/config";
import Fastify from "fastify";
import authPlugin from "./auth/plugin.js";
import authRoutes from "./routes/auth.js";
import quoteRoutes from "./routes/quote.js";
import userRoutes from "./routes/users.js";

const app = Fastify({ logger: true });

await app.register(authPlugin);
await app.register(authRoutes);
await app.register(quoteRoutes);
await app.register(userRoutes);

app.get("/health", async () => ({ ok: true }));

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

import type { FastifyInstance } from "fastify";
import { getCarrierByCode, listActiveCarriers } from "../db/carriers.js";
import { importRateTable } from "../carriers/table/import.js";
import type { AuthUser } from "../types.js";

const TABLE_CARRIER_CODES = new Set(["loggi", "jt-express"]);

export default async function adminTableRoutes(app: FastifyInstance) {
  // transportadoras que usam tabela (não API) — as únicas que aceitam upload
  app.get("/admin/carriers", { preHandler: app.requireRole("operador") }, async () => {
    const carriers = await listActiveCarriers();
    return carriers.filter((c) => c.priceSource === "table");
  });

  app.post(
    "/admin/carriers/:code/rate-table",
    { preHandler: app.requireRole("operador") },
    async (request, reply) => {
      const { code } = request.params as { code: string };

      if (!TABLE_CARRIER_CODES.has(code)) {
        return reply.code(400).send({ error: `Transportadora "${code}" não usa upload de tabela.` });
      }

      const carrier = await getCarrierByCode(code);
      if (!carrier) {
        return reply.code(404).send({ error: `Transportadora "${code}" não encontrada.` });
      }

      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ error: "Nenhum arquivo enviado." });
      }
      if (!/\.(csv|xlsx)$/i.test(file.filename)) {
        return reply.code(400).send({ error: "Formato não suportado — envie .csv ou .xlsx." });
      }

      const buffer = await file.toBuffer();
      const user = request.user as AuthUser;

      const result = await importRateTable({
        carrierId: carrier.id,
        filename: file.filename,
        buffer,
        uploadedBy: user.id,
      });

      if (!result.ok) {
        return reply.code(422).send({
          error: `A planilha tem ${result.errors.length} linha(s) com problema — nada foi importado.`,
          rowErrors: result.errors,
        });
      }

      return reply.code(201).send({
        message: `Tabela importada: ${result.rowCount} faixa(s) de preço para ${carrier.name}.`,
        rateTableId: result.rateTableId,
        rowCount: result.rowCount,
      });
    },
  );
}

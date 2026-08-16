import type { FastifyInstance } from "fastify";
import { getCarrierByCode, listActiveCarriers } from "../db/carriers.js";
import { importZoneRateTable } from "../carriers/table/import-zone.js";
import { parseLoggiWorkbook } from "../carriers/table/importers/loggi.js";
import { parseJtExpressWorkbooks } from "../carriers/table/importers/jt-express.js";
import type { AuthUser } from "../types.js";

const TABLE_CARRIER_CODES = new Set(["loggi", "jt-express"]);
const ORIGIN_CODE = "GYN"; // filial de origem (Goiânia) usada nos prazos da J&T

export default async function adminTableRoutes(app: FastifyInstance) {
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

      const files = new Map<string, { filename: string; buffer: Buffer }>();
      for await (const part of request.files()) {
        files.set(part.fieldname, { filename: part.filename, buffer: await part.toBuffer() });
      }

      const user = request.user as AuthUser;

      try {
        let parsed;
        let filenameForLog: string;

        if (code === "loggi") {
          const file = files.get("file");
          if (!file) return reply.code(400).send({ error: 'Envie o arquivo no campo "file".' });
          parsed = await parseLoggiWorkbook(file.buffer);
          filenameForLog = file.filename;
        } else {
          const abrangencia = files.get("abrangencia");
          const proposta = files.get("proposta");
          if (!abrangencia || !proposta) {
            return reply
              .code(400)
              .send({ error: 'Envie os dois arquivos: campo "abrangencia" e campo "proposta".' });
          }
          parsed = await parseJtExpressWorkbooks(abrangencia.buffer, proposta.buffer, ORIGIN_CODE);
          filenameForLog = `${abrangencia.filename} + ${proposta.filename}`;
        }

        const result = await importZoneRateTable({
          carrierId: carrier.id,
          filename: filenameForLog,
          uploadedBy: user.id,
          parsed,
        });

        return reply.code(201).send({
          message: `Tabela importada: ${result.zoneCount} faixas de CEP, ${result.priceCount} preços de zona para ${carrier.name}.`,
          ...result,
        });
      } catch (err) {
        return reply.code(422).send({ error: err instanceof Error ? err.message : "Falha ao importar planilha." });
      }
    },
  );
}

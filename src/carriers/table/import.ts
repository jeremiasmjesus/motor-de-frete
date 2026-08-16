import { pool } from "../../db/client.js";
import { parseTableFile } from "./parse.js";
import { validateRows, type NormalizedRow, type RowError } from "./validate.js";

export type ImportRateTableResult =
  | { ok: true; rateTableId: string; rowCount: number }
  | { ok: false; errors: RowError[] };

async function insertRateTable(params: {
  carrierId: string;
  filename: string;
  uploadedBy: string;
  rows: NormalizedRow[];
}): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query("begin");

    // desativa a tabela anterior da transportadora — só uma tabela ativa por vez
    await client.query("update rate_tables set active = false where carrier_id = $1 and active = true", [
      params.carrierId,
    ]);

    const { rows: inserted } = await client.query<{ id: string }>(
      "insert into rate_tables (carrier_id, filename, uploaded_by) values ($1, $2, $3) returning id",
      [params.carrierId, params.filename, params.uploadedBy],
    );
    const rateTableId = inserted[0]!.id;

    for (const row of params.rows) {
      await client.query(
        `insert into rate_bands
          (rate_table_id, cep_from, cep_to, weight_from_g, weight_to_g, price_cents, deadline_days)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [rateTableId, row.cepFrom, row.cepTo, row.weightFromG, row.weightToG, row.priceCents, row.deadlineDays],
      );
    }

    await client.query("commit");
    return rateTableId;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Importa uma planilha de tabela de frete. Valida todas as linhas primeiro —
 * se qualquer linha tiver erro, nada é gravado e a lista de erros é devolvida
 * pra quem subiu corrigir e tentar de novo.
 */
export async function importRateTable(params: {
  carrierId: string;
  filename: string;
  buffer: Buffer;
  uploadedBy: string;
}): Promise<ImportRateTableResult> {
  const rawRows = parseTableFile(params.buffer, params.filename);
  const { valid, errors } = validateRows(rawRows);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const rateTableId = await insertRateTable({
    carrierId: params.carrierId,
    filename: params.filename,
    uploadedBy: params.uploadedBy,
    rows: valid,
  });

  return { ok: true, rateTableId, rowCount: valid.length };
}

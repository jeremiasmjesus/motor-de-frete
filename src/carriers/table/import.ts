import { parse } from "csv-parse/sync";
import { read, utils } from "xlsx";
import { pool } from "../../db/client.js";

/**
 * Formato esperado da planilha (CSV ou XLSX), uma linha por faixa:
 *   cep_from, cep_to, weight_from_g, weight_to_g, price, deadline_days
 * Ex: 01000000, 05999999, 0, 1000, 24.90, 3
 */
interface RawRow {
  cep_from: string;
  cep_to: string;
  weight_from_g: string | number;
  weight_to_g: string | number;
  price: string | number;
  deadline_days: string | number;
}

function parseFile(buffer: Buffer, filename: string): RawRow[] {
  if (filename.toLowerCase().endsWith(".csv")) {
    return parse(buffer, { columns: true, skip_empty_lines: true, trim: true }) as RawRow[];
  }
  const workbook = read(buffer, { type: "buffer" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("Planilha vazia.");
  return utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheet]!);
}

function toPriceCents(value: string | number): number {
  const num = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  return Math.round(num * 100);
}

export async function importRateTable(params: {
  carrierId: string;
  filename: string;
  buffer: Buffer;
  uploadedBy: string;
}): Promise<{ rateTableId: string; rowCount: number }> {
  const rows = parseFile(params.buffer, params.filename);
  if (rows.length === 0) {
    throw new Error("Nenhuma linha encontrada na planilha.");
  }

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

    for (const row of rows) {
      await client.query(
        `insert into rate_bands
          (rate_table_id, cep_from, cep_to, weight_from_g, weight_to_g, price_cents, deadline_days)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          rateTableId,
          String(row.cep_from).padStart(8, "0"),
          String(row.cep_to).padStart(8, "0"),
          Number(row.weight_from_g),
          Number(row.weight_to_g),
          toPriceCents(row.price),
          Number(row.deadline_days),
        ],
      );
    }

    await client.query("commit");
    return { rateTableId, rowCount: rows.length };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

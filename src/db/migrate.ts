import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pool } from "./client.js";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "..", "migrations");

async function run() {
  await pool.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const applied = new Set(
    (await pool.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    console.log(`Aplicando migração: ${file}`);
    try {
      await pool.exec(sql);
      await pool.query("insert into schema_migrations (name) values ($1)", [file]);
    } catch (err) {
      console.error(`Falha aplicando ${file} — corrija e rode de novo (migrations já aplicadas não serão repetidas).`);
      throw err;
    }
  }

  console.log("Migrações em dia.");
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

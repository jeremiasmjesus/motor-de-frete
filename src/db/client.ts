import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";

export interface QueryResult<T> {
  rows: T[];
}

export interface DbConnection {
  query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  release(): void;
}

export interface Db {
  query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  /** Executa um script com múltiplos comandos (ex: um arquivo de migration inteiro). */
  exec(sql: string): Promise<void>;
  connect(): Promise<DbConnection>;
  end(): Promise<void>;
}

const databaseUrl = process.env.DATABASE_URL;
const usePglite = !databaseUrl || databaseUrl.startsWith("pglite:");

function createPgPool(url: string): Db {
  const pool = new Pool({ connectionString: url });
  return {
    async query<T>(text: string, params?: unknown[]) {
      const result = await pool.query(text, params as unknown[]);
      return result as unknown as QueryResult<T>;
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async connect(): Promise<DbConnection> {
      const client = await pool.connect();
      return {
        async query<T>(text: string, params?: unknown[]) {
          const result = await client.query(text, params as unknown[]);
          return result as unknown as QueryResult<T>;
        },
        release: () => client.release(),
      };
    },
    end: () => pool.end(),
  };
}

function createPglite(url: string | undefined): Db {
  // "pglite:./data/db" -> "./data/db"; sem DATABASE_URL -> pasta padrão local.
  const dataDir = url?.startsWith("pglite:") ? url.slice("pglite:".length) : "./data/pglite";
  mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);

  // PGlite roda em processo único, então "connect()" devolve o mesmo cliente —
  // suficiente pro volume de uma ferramenta interna, mas não é um pool de verdade.
  const asConnection: DbConnection = {
    async query<T>(text: string, params?: unknown[]) {
      const result = await client.query(text, params as unknown[]);
      return result as unknown as QueryResult<T>;
    },
    release: () => {},
  };

  return {
    async query<T>(text: string, params?: unknown[]) {
      const result = await client.query(text, params as unknown[]);
      return result as unknown as QueryResult<T>;
    },
    async exec(sql: string) {
      await client.exec(sql);
    },
    connect: async () => asConnection,
    end: () => client.close(),
  };
}

export const pool: Db = usePglite ? createPglite(databaseUrl) : createPgPool(databaseUrl!);

if (usePglite) {
  console.log(
    `[db] DATABASE_URL não aponta pra um Postgres real — usando PGlite embarcado (${
      databaseUrl?.startsWith("pglite:") ? databaseUrl : "./data/pglite"
    }). Bom pra rodar local sem instalar nada; aponte DATABASE_URL pra um Postgres de verdade em produção.`,
  );
}

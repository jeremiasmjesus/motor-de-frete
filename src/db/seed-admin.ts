import "dotenv/config";
import { pool } from "./client.js";
import { hashPassword } from "../auth/password.js";

// uso: npm run seed:admin -- "Nome" email@nalisa.com.br senhaForte123
async function run() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error('Uso: npm run seed:admin -- "Nome" email@nalisa.com.br senhaForte123');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  await pool.query(
    `insert into users (name, email, password_hash, role)
     values ($1, $2, $3, 'admin')
     on conflict (email) do update set password_hash = excluded.password_hash, role = 'admin'`,
    [name, email, passwordHash],
  );

  console.log(`Admin "${email}" criado/atualizado.`);
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

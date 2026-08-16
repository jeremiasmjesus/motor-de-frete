import { pool } from "./client.js";
import type { UserRole } from "../types.js";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  active: boolean;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    "select id, name, email, password_hash, role, active from users where email = $1 and active = true",
    [email],
  );
  return rows[0] ?? null;
}

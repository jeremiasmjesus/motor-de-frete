import { pool } from "../db/client.js";
import { decryptJson, encryptJson } from "../security/crypto.js";

export interface NuvemshopInstall {
  storeId: string;
  accessToken: string;
}

export async function saveNuvemshopInstall(storeId: string, accessToken: string): Promise<void> {
  const { ciphertext, iv, authTag } = encryptJson({ accessToken });
  await pool.query(
    `insert into nuvemshop_install (store_id, ciphertext, iv, auth_tag)
     values ($1, $2, $3, $4)
     on conflict (store_id) do update set
       ciphertext = excluded.ciphertext, iv = excluded.iv, auth_tag = excluded.auth_tag, installed_at = now()`,
    [storeId, ciphertext, iv, authTag],
  );
}

export async function getLatestNuvemshopInstall(): Promise<NuvemshopInstall | null> {
  const { rows } = await pool.query<{ store_id: string; ciphertext: Buffer; iv: Buffer; auth_tag: Buffer }>(
    "select store_id, ciphertext, iv, auth_tag from nuvemshop_install order by installed_at desc limit 1",
  );
  const row = rows[0];
  if (!row) return null;
  const { accessToken } = decryptJson<{ accessToken: string }>({
    ciphertext: row.ciphertext,
    iv: row.iv,
    authTag: row.auth_tag,
  });
  return { storeId: row.store_id, accessToken };
}

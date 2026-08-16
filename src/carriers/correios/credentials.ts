import { pool } from "../../db/client.js";
import { decryptJson, encryptJson } from "../../security/crypto.js";

export interface CorreiosCredentials {
  user: string;
  /** Código de Acesso gerado no CWS (Gestão de acesso à API) — não é a senha do Meu Correios. */
  codigoAcesso: string;
  cartaoPostagem: string;
}

async function getCorreiosCarrierId(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>("select id from carriers where code = 'correios'");
  const carrier = rows[0];
  if (!carrier) throw new Error("Transportadora 'correios' não encontrada — rode as migrations.");
  return carrier.id;
}

export async function saveCorreiosCredentials(creds: CorreiosCredentials, updatedBy: string): Promise<void> {
  const carrierId = await getCorreiosCarrierId();
  const { ciphertext, iv, authTag } = encryptJson(creds);

  await pool.query(
    `insert into carrier_credentials (carrier_id, ciphertext, iv, auth_tag, updated_by)
     values ($1, $2, $3, $4, $5)
     on conflict (carrier_id) do update set
       ciphertext = excluded.ciphertext,
       iv = excluded.iv,
       auth_tag = excluded.auth_tag,
       updated_by = excluded.updated_by,
       updated_at = now()`,
    [carrierId, ciphertext, iv, authTag, updatedBy],
  );
}

export async function loadCorreiosCredentials(): Promise<CorreiosCredentials | null> {
  const carrierId = await getCorreiosCarrierId();
  const { rows } = await pool.query<{ ciphertext: Buffer; iv: Buffer; auth_tag: Buffer }>(
    "select ciphertext, iv, auth_tag from carrier_credentials where carrier_id = $1",
    [carrierId],
  );
  const row = rows[0];
  if (!row) return null;
  return decryptJson<CorreiosCredentials>({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.auth_tag });
}

export interface CorreiosCredentialsStatus {
  configured: boolean;
  user: string | null;
  cartaoPostagemMasked: string | null;
  updatedAt: string | null;
}

export async function getCorreiosCredentialsStatus(): Promise<CorreiosCredentialsStatus> {
  const carrierId = await getCorreiosCarrierId();
  const { rows } = await pool.query<{ ciphertext: Buffer; iv: Buffer; auth_tag: Buffer; updated_at: Date }>(
    "select ciphertext, iv, auth_tag, updated_at from carrier_credentials where carrier_id = $1",
    [carrierId],
  );
  const row = rows[0];
  if (!row) return { configured: false, user: null, cartaoPostagemMasked: null, updatedAt: null };

  const creds = decryptJson<CorreiosCredentials>({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.auth_tag });
  const last4 = creds.cartaoPostagem.slice(-4);

  return {
    configured: true,
    user: creds.user,
    cartaoPostagemMasked: `••••••${last4}`,
    updatedAt: row.updated_at.toISOString(),
  };
}

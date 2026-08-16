-- Guarda o access_token da instalação OAuth na loja Nuvemshop (criptografado,
-- mesmo esquema das credenciais dos Correios). Sistema é de uma loja só, mas
-- store_id fica único pra não duplicar se reinstalar.
create table nuvemshop_install (
  id uuid primary key default gen_random_uuid(),
  store_id text not null unique,
  ciphertext bytea not null,
  iv bytea not null,
  auth_tag bytea not null,
  installed_at timestamptz not null default now()
);

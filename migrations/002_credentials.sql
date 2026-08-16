create table carrier_credentials (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references carriers(id) on delete cascade unique,
  ciphertext bytea not null,
  iv bytea not null,
  auth_tag bytea not null,
  updated_by uuid references users(id),
  updated_at timestamptz not null default now()
);

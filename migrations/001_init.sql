create extension if not exists pgcrypto;

create type user_role as enum ('admin', 'operador');

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role user_role not null default 'operador',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create type price_source as enum ('api', 'table');

create table carriers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique, -- 'correios' | 'loggi' | 'jt-express'
  price_source price_source not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table rate_tables (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references carriers(id) on delete cascade,
  filename text not null,
  uploaded_by uuid references users(id),
  active boolean not null default true,
  uploaded_at timestamptz not null default now()
);

create table rate_bands (
  id uuid primary key default gen_random_uuid(),
  rate_table_id uuid not null references rate_tables(id) on delete cascade,
  cep_from char(8) not null,
  cep_to char(8) not null,
  weight_from_g integer not null,
  weight_to_g integer not null,
  price_cents integer not null,
  deadline_days integer not null
);
create index rate_bands_lookup on rate_bands (rate_table_id, cep_from, cep_to, weight_from_g, weight_to_g);

create type rule_type as enum ('valor_fixo', 'valor_fixo_adicional', 'percentual', 'frete_gratis', 'acrescimo_prazo');

create table rules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type rule_type not null,
  carrier_id uuid references carriers(id) on delete cascade, -- null = todas as transportadoras
  condition jsonb not null default '{}'::jsonb,
  action jsonb not null default '{}'::jsonb,
  priority integer not null default 0,
  active boolean not null default true,
  valid_from timestamptz,
  valid_to timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rules_active_priority on rules (active, priority);

insert into carriers (name, code, price_source) values
  ('Correios', 'correios', 'api'),
  ('Loggi', 'loggi', 'table'),
  ('J&T Express', 'jt-express', 'table');

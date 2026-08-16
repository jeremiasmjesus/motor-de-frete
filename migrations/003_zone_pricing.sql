-- J&T e Loggi não precificam por CEP direto — usam um código de zona (ex: "SP-CAP",
-- "SP-INT2"): uma tabela mapeia faixas de CEP -> zona (+ prazo), outra mapeia
-- zona x faixa de peso -> preço. Cruzar isso antecipadamente em CEP x peso explode
-- pra milhões de linhas; então guardamos os dois lados e cruzamos na hora da cotação.

alter table carriers add column pricing_model text not null default 'flat'
  check (pricing_model in ('flat', 'zone'));

update carriers set pricing_model = 'zone' where code in ('loggi', 'jt-express');

create table rate_zones (
  id uuid primary key default gen_random_uuid(),
  rate_table_id uuid not null references rate_tables(id) on delete cascade,
  cep_from char(8) not null,
  cep_to char(8) not null,
  zone_code text not null,
  deadline_days integer not null
);
create index rate_zones_lookup on rate_zones (rate_table_id, cep_from, cep_to);

create table rate_zone_prices (
  id uuid primary key default gen_random_uuid(),
  rate_table_id uuid not null references rate_tables(id) on delete cascade,
  zone_code text not null,
  weight_from_g integer not null,
  weight_to_g integer not null,
  price_cents integer not null
);
create index rate_zone_prices_lookup on rate_zone_prices (rate_table_id, zone_code, weight_from_g, weight_to_g);

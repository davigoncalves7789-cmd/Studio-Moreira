-- Rode isso uma única vez no Supabase: Dashboard > SQL Editor > New query > Run
alter table produtos
  add column if not exists mais_vendido boolean not null default false;

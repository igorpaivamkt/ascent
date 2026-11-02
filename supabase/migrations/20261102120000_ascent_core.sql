-- ASCENT · núcleo de dados na nuvem (Supabase / PostgreSQL 15+)
--
-- Modelo:
--   ascent_state         documento versionado do usuário (fonte para as telas)
--   ascent_commands      log de comandos (idempotência por command_id) — aplicados e rejeitados
--   ascent_*_ledger      livros-razão de recompensas com chave única por usuário (impedem duplicação)
--   ascent_audit         trilha de auditoria somente-inclusão
--
-- Escrita: SOMENTE via funções SECURITY DEFINER chamadas pela Edge Function com a service_role.
-- Leitura: o próprio usuário (RLS por auth.uid()).

-- ───────────────────────────── Tabelas
create table if not exists public.ascent_state (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  version     bigint not null default 1 check (version >= 1),
  state       jsonb not null check (jsonb_typeof(state) = 'object'),
  origin      text not null default 'cloud' check (origin in ('cloud', 'import')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.ascent_commands (
  user_id            uuid not null references auth.users (id) on delete cascade,
  command_id         text not null check (command_id ~ '^[A-Za-z0-9_-]{8,80}$'),
  type               text not null,
  payload            jsonb not null,
  issued_at          timestamptz not null,
  status             text not null check (status in ('applied', 'rejected')),
  effects            jsonb not null default '[]'::jsonb,
  error              text,
  resulting_version  bigint,
  created_at         timestamptz not null default now(),
  primary key (user_id, command_id)
);

create table if not exists public.ascent_xp_ledger (
  user_id      uuid not null references auth.users (id) on delete cascade,
  key          text not null,
  amount       integer not null check (amount <> 0),
  kind         text not null check (kind in ('execution', 'milestone', 'achievement', 'review', 'result', 'adjustment')),
  reason       text not null,
  source_type  text not null,
  source_id    text not null,
  at           timestamptz not null,
  command_id   text,
  primary key (user_id, key)
);

create table if not exists public.ascent_coin_ledger (
  user_id     uuid not null references auth.users (id) on delete cascade,
  key         text not null,
  amount      integer not null,
  type        text not null check (type in ('earn', 'spend')),
  reason      text not null,
  at          timestamptz not null,
  command_id  text,
  primary key (user_id, key),
  check ((type = 'earn' and amount > 0) or (type = 'spend' and amount < 0))
);

create table if not exists public.ascent_achievements (
  user_id      uuid not null references auth.users (id) on delete cascade,
  code         text not null,
  unlocked_at  timestamptz not null,
  command_id   text,
  primary key (user_id, code)
);

create table if not exists public.ascent_level_events (
  user_id     uuid not null references auth.users (id) on delete cascade,
  level       integer not null check (level >= 2),
  at          timestamptz not null,
  title_id    text,
  command_id  text,
  primary key (user_id, level)
);

create table if not exists public.ascent_audit (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references auth.users (id) on delete cascade,
  action   text not null,
  detail   jsonb not null default '{}'::jsonb,
  at       timestamptz not null default now()
);

create index if not exists ascent_commands_user_created on public.ascent_commands (user_id, created_at desc);
create index if not exists ascent_audit_user_at on public.ascent_audit (user_id, at desc);

-- ───────────────────────────── Imutabilidade (livros-razão, log e auditoria)
-- Só é permitido apagar linhas quando o usuário dono já foi excluído (exclusão de conta em cascata).
create or replace function public.ascent_forbid_change() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from auth.users u where u.id = old.user_id) then
    return old;
  end if;
  raise exception 'ASCENT_IMMUTABLE: % é somente-inclusão', tg_table_name using errcode = '42501';
end $$;

do $$
declare t text;
begin
  foreach t in array array['ascent_xp_ledger', 'ascent_coin_ledger', 'ascent_achievements', 'ascent_level_events', 'ascent_audit', 'ascent_commands'] loop
    execute format('drop trigger if exists %I_immutable on public.%I', t, t);
    execute format('create trigger %I_immutable before update or delete on public.%I for each row execute function public.ascent_forbid_change()', t, t);
  end loop;
end $$;

-- ───────────────────────────── RLS: cada usuário só lê o que é seu; ninguém escreve direto
do $$
declare t text;
begin
  foreach t in array array['ascent_state', 'ascent_commands', 'ascent_xp_ledger', 'ascent_coin_ledger', 'ascent_achievements', 'ascent_level_events', 'ascent_audit'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists %I_select_own on public.%I', t, t);
    execute format('create policy %I_select_own on public.%I for select to authenticated using (user_id = auth.uid())', t, t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
    execute format('revoke all on public.%I from anon', t);
    -- Concessões explícitas (funciona mesmo com "Automatically expose new tables" desligado)
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant usage on schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to service_role;

-- ───────────────────────────── Funções internas
-- Insere as novas linhas dos livros-razão. Chave repetida → unique_violation → a transação inteira é desfeita.
create or replace function public.ascent_insert_ledgers(
  p_user uuid, p_command_id text, p_xp jsonb, p_coins jsonb, p_achievements jsonb, p_levels jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into ascent_xp_ledger (user_id, key, amount, kind, reason, source_type, source_id, at, command_id)
  select p_user, e->>'key', (e->>'amount')::int, e->>'kind', e->>'reason', e->>'sourceType', e->>'sourceId', (e->>'at')::timestamptz, p_command_id
  from jsonb_array_elements(coalesce(p_xp, '[]'::jsonb)) e;

  insert into ascent_coin_ledger (user_id, key, amount, type, reason, at, command_id)
  select p_user, e->>'key', (e->>'amount')::int, e->>'type', e->>'reason', (e->>'at')::timestamptz, p_command_id
  from jsonb_array_elements(coalesce(p_coins, '[]'::jsonb)) e;

  insert into ascent_achievements (user_id, code, unlocked_at, command_id)
  select p_user, e->>'code', (e->>'unlockedAt')::timestamptz, p_command_id
  from jsonb_array_elements(coalesce(p_achievements, '[]'::jsonb)) e;

  insert into ascent_level_events (user_id, level, at, title_id, command_id)
  select p_user, (e->>'level')::int, (e->>'at')::timestamptz, e->>'titleId', p_command_id
  from jsonb_array_elements(coalesce(p_levels, '[]'::jsonb)) e;
end $$;

-- O documento do usuário precisa bater exatamente com os livros-razão.
create or replace function public.ascent_check_consistency(p_user uuid, p_state jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ledger bigint; v_doc bigint; v_n_ledger bigint; v_n_doc bigint;
begin
  select coalesce(sum(amount), 0), count(*) into v_ledger, v_n_ledger from ascent_xp_ledger where user_id = p_user;
  select coalesce(sum((e->>'amount')::int), 0), count(*) into v_doc, v_n_doc from jsonb_array_elements(coalesce(p_state->'xpEvents', '[]'::jsonb)) e;
  if v_ledger <> v_doc or v_n_ledger <> v_n_doc then
    raise exception 'ASCENT_LEDGER_MISMATCH: xp livro=% documento=%', v_ledger, v_doc using errcode = '23514';
  end if;

  select coalesce(sum(amount), 0), count(*) into v_ledger, v_n_ledger from ascent_coin_ledger where user_id = p_user;
  select coalesce(sum((e->>'amount')::int), 0), count(*) into v_doc, v_n_doc from jsonb_array_elements(coalesce(p_state->'coinTx', '[]'::jsonb)) e;
  if v_ledger <> v_doc or v_n_ledger <> v_n_doc then
    raise exception 'ASCENT_LEDGER_MISMATCH: moedas livro=% documento=%', v_ledger, v_doc using errcode = '23514';
  end if;
  if v_ledger < 0 then
    raise exception 'ASCENT_NEGATIVE_BALANCE' using errcode = '23514';
  end if;

  select count(*) into v_n_ledger from ascent_achievements where user_id = p_user;
  if v_n_ledger <> jsonb_array_length(coalesce(p_state->'achievements', '[]'::jsonb)) then
    raise exception 'ASCENT_LEDGER_MISMATCH: conquistas' using errcode = '23514';
  end if;
  select count(*) into v_n_ledger from ascent_level_events where user_id = p_user;
  if v_n_ledger <> jsonb_array_length(coalesce(p_state->'levelEvents', '[]'::jsonb)) then
    raise exception 'ASCENT_LEDGER_MISMATCH: níveis' using errcode = '23514';
  end if;
end $$;

-- ───────────────────────────── API (chamada pela Edge Function com service_role)

-- Cria o estado inicial do usuário: jornada nova na nuvem ou migração única dos dados do aparelho.
create or replace function public.ascent_init_state(
  p_user uuid, p_state jsonb, p_origin text, p_xp jsonb, p_coins jsonb, p_achievements jsonb, p_levels jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'ASCENT_UNKNOWN_USER' using errcode = '42501';
  end if;
  if octet_length(p_state::text) > 4000000 then
    raise exception 'ASCENT_STATE_TOO_LARGE' using errcode = '54000';
  end if;
  insert into ascent_state (user_id, version, state, origin) values (p_user, 1, p_state, p_origin);
  perform ascent_insert_ledgers(p_user, null, p_xp, p_coins, p_achievements, p_levels);
  perform ascent_check_consistency(p_user, p_state);
  insert into ascent_audit (user_id, action, detail)
  values (p_user, case when p_origin = 'import' then 'import_device' else 'init' end,
          jsonb_build_object('xp_events', jsonb_array_length(coalesce(p_xp, '[]'::jsonb)), 'achievements', jsonb_array_length(coalesce(p_achievements, '[]'::jsonb))));
  return 1;
exception when unique_violation then
  raise exception 'ASCENT_STATE_EXISTS' using errcode = '23505';
end $$;

-- Aplica o resultado de UM comando: controle otimista de versão + idempotência + livros-razão + auditoria.
create or replace function public.ascent_commit(
  p_user uuid, p_expected_version bigint, p_command_id text, p_type text, p_payload jsonb, p_issued_at timestamptz,
  p_state jsonb, p_xp jsonb, p_coins jsonb, p_achievements jsonb, p_levels jsonb, p_effects jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_version bigint;
begin
  select version into v_version from ascent_state where user_id = p_user for update;
  if not found then
    raise exception 'ASCENT_NO_STATE' using errcode = 'P0002';
  end if;
  if exists (select 1 from ascent_commands where user_id = p_user and command_id = p_command_id) then
    raise exception 'ASCENT_DUPLICATE_COMMAND' using errcode = '23505';
  end if;
  if v_version <> p_expected_version then
    raise exception 'ASCENT_VERSION_CONFLICT: esperado % atual %', p_expected_version, v_version using errcode = '40001';
  end if;
  if octet_length(p_state::text) > 4000000 then
    raise exception 'ASCENT_STATE_TOO_LARGE' using errcode = '54000';
  end if;

  perform ascent_insert_ledgers(p_user, p_command_id, p_xp, p_coins, p_achievements, p_levels);
  perform ascent_check_consistency(p_user, p_state);

  update ascent_state set state = p_state, version = v_version + 1, updated_at = now() where user_id = p_user;
  insert into ascent_commands (user_id, command_id, type, payload, issued_at, status, effects, resulting_version)
  values (p_user, p_command_id, p_type, p_payload, p_issued_at, 'applied', coalesce(p_effects, '[]'::jsonb), v_version + 1);
  insert into ascent_audit (user_id, action, detail)
  values (p_user, 'command', jsonb_build_object(
    'command_id', p_command_id, 'type', p_type, 'version', v_version + 1,
    'xp', (select coalesce(sum((e->>'amount')::int), 0) from jsonb_array_elements(coalesce(p_xp, '[]'::jsonb)) e),
    'coins', (select coalesce(sum((e->>'amount')::int), 0) from jsonb_array_elements(coalesce(p_coins, '[]'::jsonb)) e)));
  return v_version + 1;
end $$;

-- Registra um comando recusado pelas regras (o mesmo id passa a ser respondido como recusado).
create or replace function public.ascent_reject(
  p_user uuid, p_command_id text, p_type text, p_payload jsonb, p_issued_at timestamptz, p_error text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into ascent_commands (user_id, command_id, type, payload, issued_at, status, error)
  values (p_user, p_command_id, p_type, p_payload, p_issued_at, 'rejected', left(p_error, 500))
  on conflict (user_id, command_id) do nothing;
end $$;

-- Exclusão de conta: apaga o usuário e, em cascata, todos os dados do ASCENT.
create or replace function public.ascent_delete_account(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = p_user;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'ascent_insert_ledgers(uuid, text, jsonb, jsonb, jsonb, jsonb)',
    'ascent_check_consistency(uuid, jsonb)',
    'ascent_init_state(uuid, jsonb, text, jsonb, jsonb, jsonb, jsonb)',
    'ascent_commit(uuid, bigint, text, text, jsonb, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)',
    'ascent_reject(uuid, text, text, jsonb, timestamptz, text)',
    'ascent_delete_account(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

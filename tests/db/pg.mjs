// Sobe um PostgreSQL temporário (initdb + pg_ctl) para os testes de integração do banco.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Raiz do projeto: sobe a partir deste arquivo (ou do bundle de teste) até achar supabase/migrations.
function findRoot(start) {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'supabase', 'migrations'))) return dir;
    dir = resolve(dir, '..');
  }
  return process.cwd();
}
const root = findRoot(import.meta.dirname);
const PG_BIN = ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/17/bin', '/usr/lib/postgresql/15/bin'].find((p) => existsSync(p)) ?? '';
const asUser = process.getuid?.() === 0 ? ['runuser', '-u', process.env.PG_TEST_USER || 'claude', '--'] : [];

function run(cmd, args, opts = {}) {
  const full = [...asUser, cmd, ...args];
  return execFileSync(full[0], full.slice(1), { stdio: 'pipe', encoding: 'utf8', ...opts });
}

export function startPostgres() {
  if (!PG_BIN) throw new Error('PostgreSQL não encontrado (instale postgresql-16 para rodar os testes de banco).');
  const dir = mkdtempSync(join(tmpdir(), 'ascent-pg-'));
  chmodSync(dir, 0o777);
  const data = join(dir, 'data');
  const port = String(55000 + Math.floor(Math.random() * 900));
  run(join(PG_BIN, 'initdb'), ['-D', data, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C.UTF-8']);
  run(join(PG_BIN, 'pg_ctl'), ['-D', data, '-o', `-p ${port} -k ${dir} -c listen_addresses=''`, '-l', join(dir, 'log'), '-w', 'start']);
  const db = { host: dir, port, dir, data };
  psql(db, readFileSync(join(root, 'tests/db/supabase-shim.sql'), 'utf8'));
  const migrations = readdirSync(join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
  for (const m of migrations) psql(db, readFileSync(join(root, 'supabase/migrations', m), 'utf8'));
  return db;
}

export function stopPostgres(db) {
  try {
    run(join(PG_BIN, 'pg_ctl'), ['-D', db.data, '-m', 'fast', '-w', 'stop']);
  } finally {
    rmSync(db.dir, { recursive: true, force: true });
  }
}

/** Executa SQL e devolve { ok, out, err }. Com { role, sub } simula o contexto do Supabase. */
export function psql(db, sql, { role, sub, throwOnError = true } = {}) {
  const prelude = [
    role ? `set role ${role};` : '',
    sub ? `set "request.jwt.claim.sub" = '${sub}';` : '',
  ].join('\n');
  const r = spawnSync(join(PG_BIN, 'psql'), ['-h', db.host, '-p', db.port, '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], {
    input: `${prelude}\n${sql}`, encoding: 'utf8',
  });
  const res = { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
  if (!res.ok && throwOnError) throw new Error(res.err || `psql falhou (${r.status})`);
  return res;
}

/** Literal SQL seguro para JSON/texto (dollar quoting com marcador aleatório). */
export function lit(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  const tag = `q${Math.random().toString(36).slice(2, 8)}`;
  return `$${tag}$${s}$${tag}$`;
}

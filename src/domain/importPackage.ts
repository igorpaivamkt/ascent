/**
 * Pacotes de importação: uma lista ordenada de comandos do motor, preparada fora do app (por exemplo, a
 * partir de extratos ou de um planejamento), que o usuário revisa e aplica com um toque.
 *
 * Garantias:
 * - cada item vira um comando `import/step`, registrado no próprio estado: aplicar de novo (outro
 *   aparelho, reenvio da fila, importar o arquivo duas vezes) não duplica nada;
 * - um item pode usar o que outro criou com "$ref:<id do item>" (ex.: projetos de uma meta criada antes);
 * - tudo passa pelas mesmas regras do app e, na nuvem, é revalidado pelo servidor.
 */
import type { Command } from './engine/commands';
import type { AppState } from './types';

export const IMPORT_FORMAT = 'ascent-import';
export const IMPORT_VERSION = 1;

/** Coleções em que um item pode criar algo referenciável. */
export const IMPORT_TARGETS = {
  goals: (s: AppState) => s.goals,
  milestones: (s: AppState) => s.milestones,
  projects: (s: AppState) => s.projects,
  habits: (s: AppState) => s.habits,
  tasks: (s: AppState) => s.tasks,
  accounts: (s: AppState) => s.finance.accounts,
  categories: (s: AppState) => s.finance.categories,
  transactions: (s: AppState) => s.finance.transactions,
  'rel.profiles': (s: AppState) => s.relationship.profiles,
  'rel.sections': (s: AppState) => s.relationship.sections,
  'rel.entries': (s: AppState) => s.relationship.entries,
  'rel.wishes': (s: AppState) => s.relationship.wishes,
  'rel.experiences': (s: AppState) => s.relationship.experiences,
  'rel.expenses': (s: AppState) => s.relationship.expenses,
  'rel.dates': (s: AppState) => s.relationship.dates,
  'rel.commitments': (s: AppState) => s.relationship.commitments,
  'savings.boxes': (s: AppState) => s.finance.savings.boxes,
  'savings.moves': (s: AppState) => s.finance.savings.moves,
} satisfies Record<string, (s: AppState) => { id: string }[]>;
export type ImportTarget = keyof typeof IMPORT_TARGETS;

export const IMPORT_MODULES = ['financas', 'metas', 'rotina', 'relacionamento', 'perfil'] as const;
export type ImportModule = (typeof IMPORT_MODULES)[number];
export const MODULE_LABEL: Record<ImportModule, string> = { financas: 'Finanças', metas: 'Metas', rotina: 'Rotina', relacionamento: 'Relacionamento', perfil: 'Perfil' };

export interface ImportStep {
  id: string;
  module: ImportModule;
  label: string;
  detail?: string;
  /** Dado sensível (endereço, chave PIX…): aparece destacado na prévia. */
  sensitive?: boolean;
  creates?: ImportTarget;
  /** Se já existir um registro equivalente (mesmo nome, mesma pessoa…), reaproveita em vez de criar outro. */
  reuse?: boolean;
  command: Command;
}

export interface ImportPackage {
  format: typeof IMPORT_FORMAT;
  version: number;
  id: string;
  title: string;
  description?: string;
  createdAt?: string;
  notes?: string[];
  steps: ImportStep[];
}

export type { ImportRecord } from './types';
import type { ImportRecord } from './types';

const ID_RE = /^[A-Za-z0-9._:-]{1,80}$/;
const REF_RE = /^\$ref:([A-Za-z0-9._:-]{1,80})$/;
export const MAX_STEPS = 2000;

export function isValidImportId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id);
}

/** Valida a estrutura do arquivo (não o conteúdo dos comandos, que o motor valida item a item). */
export function parsePackage(raw: unknown): ImportPackage {
  const p = raw as Partial<ImportPackage> | null;
  if (!p || typeof p !== 'object' || p.format !== IMPORT_FORMAT) throw new Error('Este arquivo não é um pacote de importação do ASCENT.');
  if (p.version !== IMPORT_VERSION) throw new Error('Versão de pacote não suportada por este app.');
  if (!isValidImportId(p.id)) throw new Error('Pacote sem identificador válido.');
  if (typeof p.title !== 'string' || !p.title.trim()) throw new Error('Pacote sem título.');
  if (!Array.isArray(p.steps) || !p.steps.length) throw new Error('O pacote não tem itens.');
  if (p.steps.length > MAX_STEPS) throw new Error(`O pacote passa do limite de ${MAX_STEPS} itens.`);
  const seen = new Set<string>();
  for (const [i, s] of p.steps.entries()) {
    const where = `Item ${i + 1}`;
    if (!s || typeof s !== 'object') throw new Error(`${where}: formato inválido.`);
    if (!isValidImportId(s.id)) throw new Error(`${where}: identificador inválido.`);
    if (seen.has(s.id)) throw new Error(`${where}: identificador repetido (${s.id}).`);
    seen.add(s.id);
    if (!IMPORT_MODULES.includes(s.module as ImportModule)) throw new Error(`${where}: módulo desconhecido.`);
    if (typeof s.label !== 'string' || !s.label.trim()) throw new Error(`${where}: sem descrição.`);
    if (s.creates !== undefined && !(s.creates in IMPORT_TARGETS)) throw new Error(`${where}: destino desconhecido.`);
    const cmd = s.command as { type?: unknown } | undefined;
    if (!cmd || typeof cmd.type !== 'string') throw new Error(`${where}: comando inválido.`);
    if (cmd.type === 'import/step') throw new Error(`${where}: comando aninhado não permitido.`);
    for (const ref of refsOf(s.command)) {
      if (!seen.has(ref) || ref === s.id) throw new Error(`${where}: depende de "${ref}", que precisa vir antes no pacote.`);
    }
  }
  return p as ImportPackage;
}

/** Ids de itens referenciados por "$ref:" dentro de um comando. */
export function refsOf(value: unknown): string[] {
  const out = new Set<string>();
  (function walk(v: unknown) {
    if (typeof v === 'string') {
      const m = REF_RE.exec(v);
      if (m) out.add(m[1]);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  })(value);
  return [...out];
}

export function findRecord(state: AppState, packageId: string, stepId: string): ImportRecord | undefined {
  return state.imports.find((r) => r.packageId === packageId && r.stepId === stepId);
}

/** Troca "$ref:<item>" pelo id criado por aquele item (lança erro se ainda não foi importado). */
export function resolveRefs<T>(value: T, state: AppState, packageId: string): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const m = REF_RE.exec(v);
      if (!m) return v;
      const rec = findRecord(state, packageId, m[1]);
      if (!rec?.createdId) throw new Error(`Depende do item "${m[1]}", que não foi importado.`);
      return rec.createdId;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

/**
 * Chave de equivalência de um registro já existente e do que o comando criaria. `null` = sem regra.
 * Perfis do relacionamento: o app mostra um perfil por vez, então reaproveita o primeiro que existir.
 */
function keyOfItem(target: ImportTarget, item: Record<string, unknown>): string | null {
  switch (target) {
    case 'goals': case 'habits': return norm(item.title);
    case 'categories': return `${norm(item.name)}|${String(item.kind)}`;
    case 'accounts': return norm(item.name);
    case 'projects': return `${String(item.goalId)}|${norm(item.title)}`;
    case 'rel.profiles': return '*';
    case 'rel.sections': return `${String(item.profileId)}|${norm(item.title)}`;
    case 'rel.entries': return `${String(item.profileId)}|${String(item.sectionId)}|${norm(item.label || item.value)}`;
    case 'rel.wishes': return `${String(item.profileId)}|${norm(item.title)}`;
    case 'savings.boxes': return norm(item.name);
    default: return null;
  }
}
function keyOfCommand(target: ImportTarget, c: Command): string | null {
  const x = c as unknown as Record<string, Record<string, unknown> & { value?: Record<string, unknown> }>;
  switch (c.type) {
    case 'goal/create': return target === 'goals' ? keyOfItem(target, c.draft as unknown as Record<string, unknown>) : null;
    case 'habit/create': return target === 'habits' ? keyOfItem(target, c.habit as unknown as Record<string, unknown>) : null;
    case 'category/add': return target === 'categories' ? keyOfItem(target, { name: c.name, kind: c.kind }) : null;
    case 'account/upsert': return target === 'accounts' ? keyOfItem(target, c.account as unknown as Record<string, unknown>) : null;
    case 'project/add': return target === 'projects' ? keyOfItem(target, { goalId: c.goalId, title: c.title }) : null;
    case 'savings/box/upsert': return target === 'savings.boxes' ? keyOfItem(target, c.box as unknown as Record<string, unknown>) : null;
    case 'rel/upsert': return target.startsWith('rel.') && (x as unknown as { value: Record<string, unknown> }).value ? keyOfItem(target, (c as { value: Record<string, unknown> }).value) : null;
    default: return null;
  }
}

/** Registro existente equivalente ao que o comando criaria (para reaproveitar em vez de duplicar). */
export function findEquivalent(state: AppState, target: ImportTarget, command: Command): string | null {
  const key = keyOfCommand(target, command);
  if (key === null) return null;
  const items = IMPORT_TARGETS[target](state) as unknown as Record<string, unknown>[];
  const hit = key === '*' ? items[0] : items.find((it) => keyOfItem(target, it) === key);
  return hit ? String(hit.id) : null;
}

export type StepStatus = 'done' | 'ready' | 'reuse' | 'blocked';

/**
 * Situação de cada item: já importado, pronto, vai reaproveitar um registro que já existe, ou bloqueado
 * por depender de um item desmarcado.
 */
export function planImport(pkg: ImportPackage, state: AppState, selected: Set<string>): Map<string, StepStatus> {
  const status = new Map<string, StepStatus>();
  for (const s of pkg.steps) {
    if (findRecord(state, pkg.id, s.id)) {
      status.set(s.id, 'done');
      continue;
    }
    const deps = refsOf(s.command);
    const ok = deps.every((d) => status.get(d) === 'done' || ((status.get(d) === 'ready' || status.get(d) === 'reuse') && selected.has(d)));
    if (!ok) {
      status.set(s.id, 'blocked');
      continue;
    }
    let reuse = false;
    if (s.reuse && s.creates) {
      try {
        reuse = !!findEquivalent(state, s.creates, resolveRefs(s.command, state, pkg.id));
      } catch {
        /* depende de item ainda não importado: só dá para saber na hora */
      }
    }
    status.set(s.id, reuse ? 'reuse' : 'ready');
  }
  return status;
}

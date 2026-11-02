import { CATALOG, DEFAULT_EQUIPPED } from './catalog';
import { DEFAULT_COIN_NAME } from './config';
import { SCHEMA_VERSION, type AppState } from './types';

export const DEFAULT_CATEGORIES: { id: string; name: string; kind: 'income' | 'expense' }[] = [
  { id: 'cat-salario', name: 'Salário', kind: 'income' },
  { id: 'cat-servicos', name: 'Serviços e freelas', kind: 'income' },
  { id: 'cat-vendas', name: 'Vendas do negócio', kind: 'income' },
  { id: 'cat-outras-receitas', name: 'Outras receitas', kind: 'income' },
  { id: 'cat-moradia', name: 'Moradia', kind: 'expense' },
  { id: 'cat-alimentacao', name: 'Alimentação', kind: 'expense' },
  { id: 'cat-transporte', name: 'Transporte', kind: 'expense' },
  { id: 'cat-saude', name: 'Saúde', kind: 'expense' },
  { id: 'cat-educacao', name: 'Educação', kind: 'expense' },
  { id: 'cat-lazer', name: 'Lazer', kind: 'expense' },
  { id: 'cat-assinaturas', name: 'Assinaturas e contas', kind: 'expense' },
  { id: 'cat-negocio', name: 'Custos do negócio', kind: 'expense' },
  { id: 'cat-outros', name: 'Outros gastos', kind: 'expense' },
];

export function createEmptyState(now: Date, opts: { mode?: AppState['mode']; displayName?: string } = {}): AppState {
  const at = now.toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    mode: opts.mode ?? 'real',
    profile: { displayName: opts.displayName ?? 'Explorador', activeTitleId: null, createdAt: at },
    settings: { theme: 'system', motion: 'system', celebrations: true, coinName: DEFAULT_COIN_NAME, currency: 'BRL', timezone: 'America/Sao_Paulo' },
    goals: [],
    goalVersions: [],
    observations: [],
    milestones: [],
    projects: [],
    steps: [],
    habits: [],
    occurrences: [],
    tasks: [],
    xpEvents: [],
    coinTx: [],
    achievements: [],
    levelEvents: [],
    progressEvents: [],
    inventory: CATALOG.filter((i) => i.unlock.type === 'default').map((i) => ({ itemId: i.id, acquiredAt: at, method: 'default' as const })),
    equipped: { ...DEFAULT_EQUIPPED },
    finance: {
      accounts: [{ id: 'acc-principal', name: 'Conta principal', type: 'corrente', openingBalance: 0 }],
      categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      transactions: [],
      budgets: [],
    },
    relationship: { profiles: [], preferences: [], dates: [], wishes: [], experiences: [], expenses: [], commitments: [], sections: [], entries: [], privateDetails: [] },
    reviews: [],
    activity: [],
  };
}

/**
 * Normaliza um estado carregado do armazenamento (ou importado), preenchendo coleções ausentes.
 * Ponto único para futuras migrações de esquema.
 */
export function migrateState(raw: unknown, now: Date): AppState {
  if (!raw || typeof raw !== 'object') throw new Error('Arquivo de dados inválido.');
  const r = raw as Partial<AppState> & { schemaVersion?: number };
  if (typeof r.schemaVersion !== 'number') throw new Error('Arquivo sem versão de esquema — não parece ser um backup do ASCENT.');
  if (r.schemaVersion > SCHEMA_VERSION) throw new Error('Este backup foi criado por uma versão mais nova do ASCENT.');
  const base = createEmptyState(now);
  const merged: AppState = {
    ...base,
    ...r,
    profile: { ...base.profile, ...r.profile },
    settings: { ...base.settings, ...r.settings },
    equipped: { ...base.equipped, ...r.equipped },
    finance: { ...base.finance, ...r.finance },
    relationship: { ...base.relationship, ...r.relationship },
    schemaVersion: SCHEMA_VERSION,
  };
  for (const key of Object.keys(base) as (keyof AppState)[]) {
    if (Array.isArray(base[key]) && !Array.isArray(merged[key])) throw new Error(`Coleção inválida no backup: ${String(key)}`);
  }
  return merged;
}

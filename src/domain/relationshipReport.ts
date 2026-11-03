// Relatório do relacionamento: quais blocos existem, quantos itens cada um tem e o recorte por período.
import { entriesOf, sectionsOf } from './relationshipProfile';
import type { AppState, ISODate, RelCommitment, RelEntry, RelExpense, RelExperience } from './types';

export interface DateRange {
  from: ISODate;
  to: ISODate;
}

export type RelBlockGroup = 'ficha' | 'historico' | 'privado';

export interface RelBlock {
  /** 'resumo', 'perfil', 'lista:<aba>', 'campos:<aba>', 'preferencias', 'desejos', 'linha', 'gastos', 'compromissos', 'datas', 'privado'. */
  id: string;
  label: string;
  group: RelBlockGroup;
  count: number;
  /** O filtro de data vale para este bloco. */
  dated: boolean;
}

/** PIX fica no bloco "Endereço e PIX", nunca no perfil. */
export const isPix = (e: RelEntry) => /^\s*(chave\s+)?pix\s*$/i.test(e.label);

const inRange = (d: ISODate, r: DateRange | null) => !r || (d >= r.from && d <= r.to);

export interface RelReportData {
  experiences: RelExperience[];
  expenses: RelExpense[];
  commitments: RelCommitment[];
  total: number;
}

/** Itens com data (linha do tempo, gastos, compromissos) já recortados pelo período, em ordem cronológica. */
export function relReportData(state: AppState, profileId: string, range: DateRange | null): RelReportData {
  const r = state.relationship;
  const experiences = r.experiences.filter((e) => e.profileId === profileId && inRange(e.date, range)).sort((a, b) => a.date.localeCompare(b.date));
  const expenses = r.expenses.filter((e) => e.profileId === profileId && inRange(e.date, range)).sort((a, b) => a.date.localeCompare(b.date));
  const commitments = r.commitments.filter((c) => c.profileId === profileId && inRange(c.dueDate, range)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return { experiences, expenses, commitments, total: Math.round(expenses.reduce((a, e) => a + e.amount, 0) * 100) / 100 };
}

/** Blocos que podem entrar no relatório, na ordem em que aparecem. */
export function relReportBlocks(state: AppState, profileId: string, range: DateRange | null): RelBlock[] {
  const r = state.relationship;
  const data = relReportData(state, profileId, range);
  const sections = sectionsOf(state, profileId);
  const priv = r.privateDetails.find((x) => x.profileId === profileId);
  const pix = entriesOf(state, profileId, 'perfil').filter(isPix).length;
  const out: RelBlock[] = [
    { id: 'resumo', label: 'Resumo em números', group: 'ficha', count: 1, dated: true },
    { id: 'perfil', label: 'Perfil', group: 'ficha', count: entriesOf(state, profileId, 'perfil').filter((e) => !isPix(e)).length, dated: false },
  ];
  for (const s of sections) {
    if (s.id === 'perfil') continue;
    out.push({ id: `${s.kind === 'list' ? 'lista' : 'campos'}:${s.id}`, label: s.title, group: 'ficha', count: entriesOf(state, profileId, s.id).length, dated: false });
  }
  out.push(
    { id: 'preferencias', label: 'Preferências', group: 'ficha', count: r.preferences.filter((p) => p.profileId === profileId && !p.outdated).length, dated: false },
    { id: 'desejos', label: 'Desejos e presentes', group: 'historico', count: r.wishes.filter((w) => w.profileId === profileId).length, dated: false },
    { id: 'datas', label: 'Datas importantes', group: 'historico', count: r.dates.filter((d) => d.profileId === profileId).length, dated: false },
    { id: 'linha', label: 'Linha do tempo', group: 'historico', count: data.experiences.length, dated: true },
    { id: 'gastos', label: 'Gastos', group: 'historico', count: data.expenses.length, dated: true },
    { id: 'compromissos', label: 'Compromissos', group: 'historico', count: data.commitments.length, dated: true },
    { id: 'privado', label: 'Endereço e PIX', group: 'privado', count: (priv?.address ? 1 : 0) + pix, dated: false },
  );
  return out;
}

/** Seleção padrão: tudo, menos endereço e PIX (dado sensível só entra quando você marca). */
export function defaultSelection(blocks: RelBlock[]): Set<string> {
  return new Set(blocks.filter((b) => b.group !== 'privado').map((b) => b.id));
}

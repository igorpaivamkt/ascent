// Ficha da pessoa no módulo de relacionamento: abas fixas, sugestões de campos e utilidades puras.
import { diffDays } from './dates';
import type { AppState, ISODate, RelEntry, RelSection, RelSectionKind } from './types';

export interface SectionView {
  id: string;
  title: string;
  kind: RelSectionKind;
  builtIn: boolean;
  hint: string;
}

/** Abas fixas: existem para todo perfil e não podem ser apagadas (os itens delas, sim). */
export const BUILTIN_SECTIONS: SectionView[] = [
  { id: 'perfil', title: 'Perfil', kind: 'fields', builtIn: true, hint: 'Dados, medidas e tamanhos. Útil na hora de comprar roupa, calçado ou presente.' },
  { id: 'personalidade', title: 'Personalidade', kind: 'list', builtIn: true, hint: 'Traços do jeito de ser. Ex.: introvertida, organizada, gosta de planejar.' },
  { id: 'qualidades', title: 'Qualidades', kind: 'list', builtIn: true, hint: 'O que você admira nela/nele.' },
  { id: 'defeitos', title: 'Defeitos', kind: 'list', builtIn: true, hint: 'Pontos de atenção, para entender e lidar melhor. Fica só com você.' },
];
export const BUILTIN_IDS = new Set(BUILTIN_SECTIONS.map((s) => s.id));

export const LIMITS = { sectionTitle: 40, label: 60, value: 500, note: 500, group: 40, customSections: 20, entriesPerProfile: 1000 };

export interface FieldSuggestion {
  label: string;
  group: string;
  placeholder?: string;
  format?: 'texto' | 'data';
}

/** Sugestões de campos para a aba Perfil (um toque preenche o nome; você digita o valor). */
export const FIELD_SUGGESTIONS: FieldSuggestion[] = [
  { group: 'Dados pessoais', label: 'Nome completo' },
  { group: 'Dados pessoais', label: 'Data de nascimento', format: 'data' },
  { group: 'Dados pessoais', label: 'Altura', placeholder: 'Ex.: 1,65 m' },
  { group: 'Dados pessoais', label: 'Peso', placeholder: 'Ex.: 58 kg' },
  { group: 'Medidas e tamanhos', label: 'Calçado', placeholder: 'Ex.: 37' },
  { group: 'Medidas e tamanhos', label: 'Sandália', placeholder: 'Ex.: 37' },
  { group: 'Medidas e tamanhos', label: 'Roupa', placeholder: 'Ex.: M' },
  { group: 'Medidas e tamanhos', label: 'Blusa', placeholder: 'Ex.: P' },
  { group: 'Medidas e tamanhos', label: 'Calça', placeholder: 'Ex.: 38' },
  { group: 'Medidas e tamanhos', label: 'Vestido', placeholder: 'Ex.: M' },
  { group: 'Medidas e tamanhos', label: 'Anel', placeholder: 'Ex.: 14' },
  { group: 'Gostos', label: 'Cor favorita', placeholder: 'Ex.: Verde' },
  { group: 'Gostos', label: 'Comida favorita' },
  { group: 'Gostos', label: 'Perfume' },
  { group: 'Gostos', label: 'Flor favorita' },
];
export const DEFAULT_GROUP = 'Outros';
export const SIZES_GROUP = 'Medidas e tamanhos';

export function sectionsOf(state: AppState, profileId: string): SectionView[] {
  const custom = state.relationship.sections
    .filter((s) => s.profileId === profileId)
    .map((s: RelSection): SectionView => ({ id: s.id, title: s.title, kind: s.kind, builtIn: false, hint: '' }));
  return [...BUILTIN_SECTIONS, ...custom];
}

export function entriesOf(state: AppState, profileId: string, sectionId: string): RelEntry[] {
  return state.relationship.entries.filter((e) => e.profileId === profileId && e.sectionId === sectionId);
}

/** Campos agrupados, na ordem: grupos das sugestões primeiro, depois os criados por você, "Outros" no fim. */
export function groupFields(entries: RelEntry[]): { group: string; items: RelEntry[] }[] {
  const order = [...new Set(FIELD_SUGGESTIONS.map((f) => f.group))];
  const groups = [...new Set(entries.map((e) => e.group || DEFAULT_GROUP))];
  const rank = (g: string) => (g === DEFAULT_GROUP ? 1e6 : order.includes(g) ? order.indexOf(g) : 1000);
  groups.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'pt-BR'));
  return groups.map((group) => ({ group, items: entries.filter((e) => (e.group || DEFAULT_GROUP) === group) }));
}

/** Idade completa em anos a partir da data de nascimento (null se a data não for válida ou for futura). */
export function ageOn(birth: string, today: ISODate): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || diffDays(today, birth) < 0) return null;
  const [by, bm, bd] = birth.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** Sugestões ainda não usadas na aba Perfil desta pessoa. */
export function missingSuggestions(fields: RelEntry[]): FieldSuggestion[] {
  const used = new Set(fields.map((f) => f.label.trim().toLowerCase()));
  return FIELD_SUGGESTIONS.filter((s) => !used.has(s.label.toLowerCase()));
}

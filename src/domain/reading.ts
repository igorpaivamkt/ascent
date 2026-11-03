// Leitura e famílias de hábito: identifica a categoria (leitura, saúde, estudos…) e soma páginas e livros.
import { addDays, toZonedISODate } from './dates';
import type { AppState, Book, Habit, ISODate, Occurrence } from './types';

export type HabitFamily = 'leitura' | 'saude' | 'estudos' | 'financas' | 'mente' | 'outros';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Palavras que identificam cada família, na categoria (ou, se a categoria for genérica, no nome do hábito). */
const FAMILY_WORDS: [HabitFamily, RegExp][] = [
  ['leitura', /\b(leitura|ler|livros?|lendo|leia)\b/],
  ['saude', /\b(saude|exercicios?|treinos?|academia|musculacao|corrida|correr|jiu|jiu-jitsu|luta|esportes?|yoga|caminhada|caminhar|natacao|bike|pedal|alongamento|sono|dormir|alimentacao|dieta|agua)\b/],
  ['estudos', /\b(estudos?|estudar|faculdade|curso|cursos|aula|aulas|idiomas?|ingles|espanhol|provas?|revisao de materia|concurso)\b/],
  ['financas', /\b(financas|financeiro|dinheiro|orcamento|gastos?|poupanca|investimentos?)\b/],
  ['mente', /\b(mente|meditacao|meditar|oracao|orar|espiritual|espiritualidade|gratidao|diario|terapia|respiracao)\b/],
];
const GENERIC = new Set(['', 'geral', 'outros', 'outro', 'rotina']);

export const FAMILY_LABEL: Record<HabitFamily, string> = {
  leitura: 'Leitura', saude: 'Saúde', estudos: 'Estudos', financas: 'Finanças', mente: 'Mente', outros: 'Outros',
};
/** Sugestões para o campo Categoria do hábito. */
export const CATEGORY_SUGGESTIONS = ['Leitura', 'Saúde', 'Estudos', 'Finanças', 'Mente', 'Trabalho', 'Casa', 'Geral'];

export function familyOf(habit: Pick<Habit, 'category' | 'title'>): HabitFamily {
  const cat = norm(habit.category ?? '');
  for (const [fam, re] of FAMILY_WORDS) if (re.test(cat)) return fam;
  if (GENERIC.has(cat)) {
    const title = norm(habit.title ?? '');
    for (const [fam, re] of FAMILY_WORDS) if (re.test(title)) return fam;
  }
  return 'outros';
}

/** A meta do hábito é em páginas? (ex.: "páginas", "pág", "pags") */
export const isPagesUnit = (unit: string | undefined) => /^p(a|á)g/i.test((unit ?? '').trim());

/** Hábito de leitura que conta páginas. */
export function countsPages(h: Habit): boolean {
  return familyOf(h) === 'leitura' && isPagesUnit(h.unit) && (h.target ?? 0) > 0;
}

/** Quantidade de uma ocorrência: o valor registrado ou, se não houver, a meta do hábito (metade quando parcial). */
export function occurrenceQuantity(o: Occurrence, h: Habit): number {
  if (o.status !== 'done' && o.status !== 'partial') return 0;
  if (typeof o.quantity === 'number') return o.quantity;
  const t = h.target ?? 0;
  return o.status === 'done' ? t : Math.floor(t / 2);
}

/** Livro atual: o "lendo" iniciado mais recentemente. */
export function currentBook(state: AppState): Book | null {
  const reading = state.reading.books.filter((b) => b.status === 'reading');
  reading.sort((a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt));
  return reading[0] ?? null;
}

export interface PagesEntry {
  date: ISODate;
  pages: number;
  bookId: string | null;
}

/** Todas as páginas lidas: hábitos de leitura (em páginas) + leituras avulsas. */
export function pageEntries(state: AppState): PagesEntry[] {
  const habits = new Map(state.habits.map((h) => [h.id, h]));
  const out: PagesEntry[] = [];
  for (const o of state.occurrences) {
    const h = habits.get(o.habitId);
    if (!h || !countsPages(h)) continue;
    const pages = occurrenceQuantity(o, h);
    if (pages > 0) out.push({ date: o.date, pages, bookId: o.bookId ?? null });
  }
  for (const l of state.reading.logs) out.push({ date: l.date, pages: l.pages, bookId: l.bookId });
  return out;
}

export function pagesRead(state: AppState, bookId?: string): number {
  return pageEntries(state).filter((e) => bookId === undefined || e.bookId === bookId).reduce((a, e) => a + e.pages, 0);
}

export interface BookStatusView {
  book: Book;
  read: number;
  left: number;
  progress: number;
  /** Páginas por dia (de hoje até o prazo, contando hoje) para terminar no prazo. */
  perDay: number | null;
  daysLeft: number | null;
  /** Já chegou na última página mas ainda não marcou como concluído. */
  readyToFinish: boolean;
  finishedOnTime: boolean;
}

function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

export function bookStatus(state: AppState, book: Book, today: ISODate): BookStatusView {
  const read = Math.min(pagesRead(state, book.id), book.totalPages);
  const left = Math.max(0, book.totalPages - read);
  let perDay: number | null = null;
  let daysLeft: number | null = null;
  if (book.status === 'reading' && book.targetDate && book.targetDate >= today) {
    daysLeft = daysBetween(today, book.targetDate) + 1;
    perDay = Math.ceil(left / daysLeft);
  }
  return {
    book, read, left,
    progress: book.totalPages > 0 ? read / book.totalPages : 0,
    perDay, daysLeft,
    readyToFinish: book.status === 'reading' && left === 0,
    finishedOnTime: book.status === 'finished' && !!book.finishedAt && !!book.targetDate && book.finishedAt <= book.targetDate,
  };
}

/** Maior sequência de dias seguidos com leitura. */
export function readingStreak(state: AppState): number {
  const days = [...new Set(pageEntries(state).map((e) => e.date))].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Ocorrências concluídas (feitas ou parciais) por família de hábito. */
export function familyDone(state: AppState): Record<HabitFamily, number> {
  const out: Record<HabitFamily, number> = { leitura: 0, saude: 0, estudos: 0, financas: 0, mente: 0, outros: 0 };
  const habits = new Map(state.habits.map((h) => [h.id, h]));
  for (const o of state.occurrences) {
    if (o.status !== 'done') continue;
    const h = habits.get(o.habitId);
    if (h) out[familyOf(h)]++;
  }
  return out;
}

/** Tarefas feitas até a data planejada (no fuso da jornada). */
export function tasksOnTime(state: AppState): number {
  const tz = state.settings.timezone;
  return state.tasks.filter((t) => t.status === 'done' && t.completedAt && toZonedISODate(new Date(t.completedAt), tz) <= t.date).length;
}

/**
 * Semanas impecáveis: semanas (seg–dom) já encerradas, com pelo menos 5 tarefas planejadas,
 * todas concluídas até a data. A semana atual só conta depois que termina.
 */
export function cleanWeeks(state: AppState, today: ISODate): number {
  const tz = state.settings.timezone;
  const weeks = new Map<string, { n: number; ok: number }>();
  for (const t of state.tasks) {
    const d = new Date(`${t.date}T12:00:00Z`);
    const monday = addDays(t.date, -((d.getUTCDay() + 6) % 7));
    const w = weeks.get(monday) ?? { n: 0, ok: 0 };
    w.n++;
    if (t.status === 'done' && t.completedAt && toZonedISODate(new Date(t.completedAt), tz) <= t.date) w.ok++;
    weeks.set(monday, w);
  }
  let n = 0;
  for (const [monday, w] of weeks) if (addDays(monday, 6) < today && w.n >= 5 && w.ok === w.n) n++;
  return n;
}

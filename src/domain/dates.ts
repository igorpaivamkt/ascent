import type { ISODate } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Data local no formato YYYY-MM-DD (o app usa o fuso do dispositivo; padrão America/Sao_Paulo). */
export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Data local em um fuso IANA específico (ex.: America/Sao_Paulo). Usada pelo motor para que o
 * servidor (em UTC) e o celular calculem o mesmo "hoje" para o usuário.
 */
export function toZonedISODate(d: Date, timeZone: string): ISODate {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return toISODate(d);
  }
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function addDays(s: ISODate, days: number): ISODate {
  const d = parseISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / 86_400_000);
}

export function dayOfWeek(s: ISODate): number {
  return parseISODate(s).getDay();
}

export function monthKey(s: ISODate): string {
  return s.slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Segunda-feira da semana de `s`. */
export function weekStart(s: ISODate): ISODate {
  const dow = dayOfWeek(s);
  return addDays(s, dow === 0 ? -6 : 1 - dow);
}

export function rangeDays(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function formatDate(s: ISODate | null | undefined, opts: { year?: boolean } = {}): string {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return `${pad(d)} ${MONTHS[m - 1]}${opts.year ? ` ${y}` : ''}`;
}

export function formatMonth(month: string, long = false): string {
  const [y, m] = month.split('-').map(Number);
  return long ? `${MONTHS_LONG[m - 1]} de ${y}` : `${MONTHS[m - 1]}/${String(y).slice(2)}`;
}

export function formatLongDate(s: ISODate): string {
  const d = parseISODate(s);
  const wd = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'][d.getDay()];
  return `${wd}, ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${formatDate(toISODate(d))} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

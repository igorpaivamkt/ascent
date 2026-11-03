// Leitura: livros (páginas, prazo, concluir) e leituras avulsas.
import { XP_RULES, COIN_RULES } from '../config';
import { bookStatus, pagesRead } from '../reading';
import type { Book } from '../types';
import type { Command } from './commands';
import { goalObserve } from './goalHandlers';
import type { Kernel } from './kernel';

type C<T extends Command['type']> = Extract<Command, { type: T }>;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BOOKS = 500;

function getBook(k: Kernel, id: string): Book {
  return k.d.reading.books.find((b) => b.id === id) ?? k.fail('Livro não encontrado.');
}

/** Objetivo ligado ao livro recebe as páginas lidas (ou 1 quando o objetivo é sim/não e o livro foi concluído). */
export function syncBookGoal(k: Kernel, bookId: string): void {
  const book = k.d.reading.books.find((b) => b.id === bookId);
  if (!book?.goalId) return;
  const goal = k.d.goals.find((g) => g.id === book.goalId);
  if (!goal || goal.status === 'archived' || goal.status === 'completed' || goal.metricSource !== 'manual') return;
  const value = goal.indicator === 'binary' ? (book.status === 'finished' ? 1 : 0) : Math.min(pagesRead(k.d, book.id), book.totalPages);
  if (goal.currentValue === value) return;
  goalObserve(k, { type: 'goal/observe', goalId: goal.id, value, date: k.today, note: `Leitura: ${book.title}` });
}

/** XP e moedas de livro concluído — desfeitos (com ajuste auditável) se o livro for reaberto. */
function settleBook(k: Kernel, book: Book): void {
  const done = book.status === 'finished';
  k.setSourceXp('book', book.id, done ? XP_RULES.bookFinished : 0, done ? `Livro concluído: ${book.title}` : `livro reaberto (${book.title})`);
  if (done) k.grantCoins(`book:${book.id}`, COIN_RULES.bookFinished, `Livro concluído: ${book.title}`);
}

export function bookUpsert(k: Kernel, { book }: C<'reading/book/upsert'>): void {
  const title = (book.title ?? '').trim().slice(0, 120);
  const author = (book.author ?? '').trim().slice(0, 80);
  const totalPages = Math.round(Number(book.totalPages));
  if (!title) k.fail('Dê o nome do livro.');
  if (!Number.isFinite(totalPages) || totalPages < 1 || totalPages > 20_000) k.fail('Informe quantas páginas o livro tem.');
  if (!ISO.test(book.startDate)) k.fail('Data de início inválida.');
  if (book.targetDate && (!ISO.test(book.targetDate) || book.targetDate < book.startDate)) k.fail('O prazo precisa ser depois do início.');
  if (book.goalId) {
    const g = k.d.goals.find((x) => x.id === book.goalId) ?? k.fail('Objetivo não encontrado.');
    if (g.metricSource !== 'manual') k.fail('Ligue o livro a um objetivo de valor manual.');
    if (k.d.reading.books.some((b) => b.goalId === book.goalId && b.id !== book.id)) k.fail('Este objetivo já está ligado a outro livro.');
  }
  const existing = book.id ? k.d.reading.books.find((b) => b.id === book.id) : undefined;
  if (existing) {
    Object.assign(existing, { title, author, totalPages, startDate: book.startDate, targetDate: book.targetDate || null, goalId: book.goalId || null });
    k.log('rotina', 'book', `Livro atualizado: ${title}`, '');
    syncBookGoal(k, existing.id);
    return;
  }
  if (k.d.reading.books.length >= MAX_BOOKS) k.fail('Limite de livros alcançado.');
  const b: Book = { id: k.id(), title, author, totalPages, startDate: book.startDate, targetDate: book.targetDate || null, status: 'reading', finishedAt: null, goalId: book.goalId || null, createdAt: k.at };
  k.d.reading.books.push(b);
  k.log('rotina', 'book', `Livro na estante: ${title}`, author);
  syncBookGoal(k, b.id);
}

export function bookSetStatus(k: Kernel, { bookId, status, date }: C<'reading/book/setStatus'>): void {
  const book = getBook(k, bookId);
  if (!['reading', 'paused', 'finished', 'abandoned'].includes(status)) k.fail('Situação inválida.');
  if (status === 'finished') {
    const when = date ?? k.today;
    if (!ISO.test(when) || when > k.today) k.fail('A data de conclusão não pode ser no futuro.');
    if (when < book.startDate) k.fail('A conclusão precisa ser depois do início.');
    book.finishedAt = when;
  } else {
    book.finishedAt = null;
  }
  book.status = status;
  settleBook(k, book);
  const labels = { reading: 'Leitura retomada', paused: 'Leitura pausada', finished: 'Livro concluído', abandoned: 'Livro deixado de lado' } as const;
  k.log('rotina', 'book', `${labels[status]}: ${book.title}`, status === 'finished' ? `${bookStatus(k.d, book, k.today).read} de ${book.totalPages} páginas registradas` : '');
  syncBookGoal(k, book.id);
}

export function bookRemove(k: Kernel, { bookId }: C<'reading/book/remove'>): void {
  const book = getBook(k, bookId);
  const used = k.d.reading.logs.some((l) => l.bookId === bookId) || k.d.occurrences.some((o) => o.bookId === bookId);
  if (used || book.status === 'finished') k.fail('Este livro já tem leitura registrada: em vez de excluir, marque como deixado de lado.');
  k.d.reading.books = k.d.reading.books.filter((b) => b.id !== bookId);
}

export function logUpsert(k: Kernel, { log }: C<'reading/log/upsert'>): void {
  const book = getBook(k, log.bookId);
  const pages = Math.round(Number(log.pages));
  if (!Number.isFinite(pages) || pages < 1 || pages > 5000) k.fail('Informe quantas páginas você leu.');
  if (!ISO.test(log.date)) k.fail('Data inválida.');
  if (log.date > k.today) k.fail('Não dá para registrar leitura no futuro.');
  const note = (log.note ?? '').trim().slice(0, 300);
  const existing = log.id ? k.d.reading.logs.find((l) => l.id === log.id) : undefined;
  const before = existing?.bookId;
  if (existing) Object.assign(existing, { bookId: book.id, date: log.date, pages, note });
  else k.d.reading.logs.push({ id: k.id(), bookId: book.id, date: log.date, pages, note, createdAt: k.at });
  k.log('rotina', 'reading', `Leitura: ${pages} páginas de ${book.title}`, log.date);
  syncBookGoal(k, book.id);
  if (before && before !== book.id) syncBookGoal(k, before);
}

export function logRemove(k: Kernel, { logId }: C<'reading/log/remove'>): void {
  const l = k.d.reading.logs.find((x) => x.id === logId) ?? k.fail('Registro não encontrado.');
  k.d.reading.logs = k.d.reading.logs.filter((x) => x.id !== logId);
  syncBookGoal(k, l.bookId);
}

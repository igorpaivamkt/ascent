// Leitura (páginas, livros, prazo), conquistas por categoria de hábito, compromissos, skins e cenários.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATALOG } from '../src/domain/catalog';
import { TITLES } from '../src/domain/config';
import type { Command } from '../src/domain/engine';
import { migrateState } from '../src/domain/initialState';
import { unlockedTitles } from '../src/domain/levels';
import { bookStatus, cleanWeeks, familyOf, pagesRead } from '../src/domain/reading';
import { makeRunner } from './helpers';

const TODAY = '2026-11-02';
const readingHabit = (extra: Record<string, unknown> = {}): Command => ({
  type: 'habit/create',
  habit: { title: 'Ler 10 páginas', description: '', category: 'Leitura', frequency: 'daily', days: [], timeWindow: '', durationMin: 20, goalId: null, startDate: '2026-10-01', target: 10, unit: 'páginas', ...extra },
});
const book = (extra: Record<string, unknown> = {}): Command => ({
  type: 'reading/book/upsert',
  book: { title: 'Hábitos Atômicos', author: 'James Clear', totalPages: 60, startDate: '2026-10-20', targetDate: '2026-11-30', goalId: null, ...extra },
});
const done = (habitId: string, date: string, quantity?: number): Command => ({ type: 'occurrence/set', occurrenceId: `${habitId}@${date}`, status: 'done', ...(quantity !== undefined ? { quantity } : {}) });
const has = (codes: { code: string }[], c: string) => codes.some((a) => a.code === c);

describe('categoria do hábito', () => {
  it('identifica a família pela categoria, ou pelo nome quando a categoria é genérica', () => {
    assert.equal(familyOf({ category: 'Leitura', title: 'x' }), 'leitura');
    assert.equal(familyOf({ category: 'livros', title: 'x' }), 'leitura');
    assert.equal(familyOf({ category: 'geral', title: 'Ler antes de dormir' }), 'leitura');
    assert.equal(familyOf({ category: 'saúde', title: 'Jiu-jitsu' }), 'saude');
    assert.equal(familyOf({ category: 'geral', title: 'Jiu-jitsu' }), 'saude');
    assert.equal(familyOf({ category: 'Estudos', title: '' }), 'estudos');
    assert.equal(familyOf({ category: 'finanças', title: '' }), 'financas');
    assert.equal(familyOf({ category: 'trabalho', title: 'Ler e-mails' }), 'outros', 'categoria própria manda');
  });
});

describe('leitura: páginas e livros', () => {
  it('hábito de leitura soma páginas no livro atual e libera as conquistas de páginas', () => {
    const r = makeRunner();
    r.run(book());
    r.run(readingHabit());
    const h = r.state.habits[0];
    const b = r.state.reading.books[0];
    r.run(done(h.id, '2026-10-30'));
    assert.equal(pagesRead(r.state, b.id), 10, 'meta do hábito: 10 páginas');
    assert.ok(has(r.state.achievements, 'read_10'));
    r.run(done(h.id, '2026-10-31', 25));
    r.run(done(h.id, '2026-11-01', 15));
    assert.equal(pagesRead(r.state, b.id), 50, 'quantidade informada vale no lugar da meta');
    assert.ok(has(r.state.achievements, 'read_50'));
    r.run({ type: 'occurrence/set', occurrenceId: `${h.id}@2026-11-01`, status: 'pending' });
    assert.equal(pagesRead(r.state, b.id), 35, 'desfazer o registro tira as páginas');
    assert.equal(r.state.occurrences.find((o) => o.id === `${h.id}@2026-10-30`)!.bookId, b.id, 'a ocorrência guarda o livro');
  });

  it('calcula páginas por dia até o prazo e avisa quando chegou na última página', () => {
    const r = makeRunner();
    r.run(book());
    const b = r.state.reading.books[0];
    r.run({ type: 'reading/log/upsert', log: { bookId: b.id, date: '2026-11-01', pages: 30, note: '' } });
    let st = bookStatus(r.state, r.state.reading.books[0], TODAY);
    assert.deepEqual([st.read, st.left, st.daysLeft, st.perDay], [30, 30, 29, 2], '30 páginas em 29 dias (02 a 30/11)');
    r.run({ type: 'reading/log/upsert', log: { bookId: b.id, date: TODAY, pages: 40, note: '' } });
    st = bookStatus(r.state, r.state.reading.books[0], TODAY);
    assert.equal(st.read, 60, 'nunca passa do total do livro');
    assert.ok(st.readyToFinish);
  });

  it('concluir o livro dá XP, conquista, título e o livro na mão; reabrir desfaz o XP', () => {
    const r = makeRunner();
    r.run(book());
    const b = r.state.reading.books[0];
    r.run({ type: 'reading/book/setStatus', bookId: b.id, status: 'finished', date: '2026-11-01' });
    assert.ok(has(r.state.achievements, 'book_1'));
    assert.ok(has(r.state.achievements, 'book_on_time'), 'terminou antes do prazo');
    assert.ok(r.state.inventory.some((i) => i.itemId === 'hand-book'), 'item da coleção Leitor');
    assert.ok(unlockedTitles(1, new Set(r.state.achievements.map((a) => a.code))).some((t) => t.id === 't-leitor'));
    const bookXp = () => r.state.xpEvents.filter((e) => e.sourceType === 'book').reduce((a, e) => a + e.amount, 0);
    assert.equal(bookXp(), 60);
    r.run({ type: 'reading/book/setStatus', bookId: b.id, status: 'reading' });
    assert.equal(bookXp(), 0, 'reaberto: XP do livro volta a zero (com ajuste auditável)');
    assert.throws(() => r.run({ type: 'reading/book/setStatus', bookId: b.id, status: 'finished', date: '2026-12-10' }), /futuro/);
    r.run({ type: 'reading/book/setStatus', bookId: b.id, status: 'finished' });
    r.run(book({ title: 'Segundo' }));
    r.run({ type: 'reading/book/setStatus', bookId: r.state.reading.books[1].id, status: 'finished' });
    assert.ok(has(r.state.achievements, 'book_2'), 'segundo livro');
  });

  it('páginas vão para o objetivo ligado ao livro; livro com leitura não é excluído', () => {
    const r = makeRunner();
    r.run({ type: 'goal/create', draft: { title: 'Ler Hábitos Atômicos', description: '', category: 'pessoal', metricName: 'Páginas', unit: 'páginas', indicator: 'quantitative', metricSource: 'manual', direction: 'increase', baselineValue: 0, targetValue: 60, startDate: '2026-10-20', targetDate: '2026-11-30', milestones: [{ title: 'Metade', targetValue: 30, rule: 'metric', major: false }] } });
    const goalId = r.state.goals[0].id;
    r.run(book({ goalId }));
    const b = r.state.reading.books[0];
    r.run({ type: 'reading/log/upsert', log: { bookId: b.id, date: TODAY, pages: 32, note: '' } });
    assert.equal(r.state.goals[0].currentValue, 32);
    assert.equal(r.state.milestones[0].status, 'reached', 'marco de metade validado pela leitura');
    assert.throws(() => r.run({ type: 'reading/book/remove', bookId: b.id }), /deixado de lado/);
    assert.throws(() => r.run(book({ title: 'Outro', goalId })), /já está ligado/);
  });

  it('valida livro e leitura', () => {
    const r = makeRunner();
    assert.throws(() => r.run(book({ title: '' })), /nome do livro/);
    assert.throws(() => r.run(book({ totalPages: 0 })), /páginas/);
    assert.throws(() => r.run(book({ targetDate: '2026-10-01' })), /prazo/);
    r.run(book());
    assert.throws(() => r.run({ type: 'reading/log/upsert', log: { bookId: r.state.reading.books[0].id, date: '2026-11-10', pages: 5, note: '' } }), /futuro/);
  });
});

describe('conquistas por categoria e compromissos', () => {
  it('hábitos de saúde contam para as conquistas de saúde', () => {
    const r = makeRunner();
    r.run({ type: 'habit/create', habit: { title: 'Jiu-jitsu', description: '', category: 'saúde', frequency: 'daily', days: [], timeWindow: '', durationMin: 60, goalId: null, startDate: '2026-10-01' } });
    const h = r.state.habits[0];
    for (let d = 20; d <= 29; d++) r.run(done(h.id, `2026-10-${d}`));
    assert.ok(has(r.state.achievements, 'health_10'));
  });

  it('tarefas cumpridas e no prazo; semana impecável só depois que a semana termina', () => {
    const r = makeRunner();
    // Semana de 26/10 (seg) a 01/11 (dom), já encerrada em 02/11.
    for (let i = 0; i < 5; i++) r.run({ type: 'task/create', title: `Tarefa ${i}`, date: '2026-11-01', goalId: null, done: false });
    for (const t of r.state.tasks) r.run({ type: 'task/toggle', taskId: t.id });
    // Concluídas "hoje" (02/11), depois da data: não contam como no prazo.
    assert.equal(cleanWeeks(r.state, TODAY), 0);
    for (let i = 0; i < 10; i++) r.run({ type: 'task/create', title: `Hoje ${i}`, date: TODAY, goalId: null, done: true });
    assert.ok(has(r.state.achievements, 'tasks_10'));
    const s = r.state;
    assert.equal(s.tasks.filter((t) => t.status === 'done').length, 15);
    assert.equal(cleanWeeks(s, '2026-11-09'), 1, 'semana de 02/11 encerrada, 10 tarefas feitas no dia');
  });

  it('cada título especial aponta para uma conquista que existe, e cada item para uma conquista ou preço', async () => {
    const { ACHIEVEMENTS } = await import('../src/domain/achievements');
    const codes = new Set(ACHIEVEMENTS.map((a) => a.code));
    for (const t of TITLES) if (t.achievement) assert.ok(codes.has(t.achievement), t.id);
    for (const i of CATALOG) if (i.unlock.type === 'achievement') assert.ok(codes.has(i.unlock.code), i.id);
    assert.equal(new Set(CATALOG.map((i) => i.id)).size, CATALOG.length, 'ids únicos');
  });
});

describe('cenários da montanha', () => {
  it('compra e equipa um cenário com moedas; o clássico não pode ser desequipado', () => {
    const r = makeRunner();
    r.state.coinTx.push({ id: 'seed', key: 'seed', amount: 500, type: 'earn', reason: 'teste', at: new Date().toISOString() });
    assert.equal(r.state.equipped.scene, 'scene-classic');
    r.run({ type: 'shop/buy', itemId: 'scene-night' });
    r.run({ type: 'shop/equip', itemId: 'scene-night' });
    assert.equal(r.state.equipped.scene, 'scene-night');
    assert.ok(has(r.state.achievements, 'first_scene'));
    assert.throws(() => r.run({ type: 'shop/equip', itemId: 'scene-volcano' }), /Adquira/);
  });

  it('quem já jogava recebe o cenário clássico e a estante vazia ao atualizar', () => {
    const r = makeRunner();
    const old = JSON.parse(JSON.stringify(r.state));
    delete old.reading;
    old.inventory = old.inventory.filter((i: { itemId: string }) => i.itemId !== 'scene-classic');
    delete old.equipped.scene;
    const m = migrateState(old, new Date());
    assert.deepEqual(m.reading, { books: [], logs: [] });
    assert.equal(m.equipped.scene, 'scene-classic');
    assert.ok(m.inventory.some((i) => i.itemId === 'scene-classic'));
    const again = migrateState(m, new Date(Date.now() + 60_000));
    assert.equal(again.inventory.length, m.inventory.length, 'migrar de novo não duplica');
    assert.equal(again.inventory.find((i) => i.itemId === 'scene-classic')!.acquiredAt, m.inventory.find((i) => i.itemId === 'scene-classic')!.acquiredAt, 'data estável entre aparelho e servidor');
  });
});

describe('leitura: servidor', () => {
  it('o servidor aceita livro, hábito com meta e leitura, e chega ao mesmo total de páginas', async () => {
    const { handleSync, handlePull } = await import('../src/server/handler');
    const { MemoryDb } = await import('../src/server/memoryDb');
    const { toZonedISODate } = await import('../src/domain/dates');
    const db = new MemoryDb();
    const USER = '77777777-0000-4000-8000-000000000002';
    await handlePull(db, USER);
    const day = toZonedISODate(new Date(), 'America/Sao_Paulo');
    const at = new Date().toISOString();
    const env = (n: number, command: Command) => ({ id: `leitura-cmd-${n}-0000`, issuedAt: at, command });
    const r1 = await handleSync(db, USER, { commands: [env(1, book({ startDate: day, targetDate: null })), env(2, readingHabit({ startDate: day }))] });
    const h = r1.state.habits[0];
    const r2 = await handleSync(db, USER, { commands: [env(3, done(h.id, day, 12))] });
    assert.deepEqual(r2.results.map((x) => x.status), ['applied']);
    assert.equal(pagesRead(r2.state), 12);
    assert.ok(r2.state.achievements.some((a) => a.code === 'read_10'));
  });
});

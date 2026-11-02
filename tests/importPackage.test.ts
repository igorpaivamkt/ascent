// Importação de pacotes de dados: validação, referências, idempotência (aparelho e servidor) e reaproveitamento.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execute, type Command } from '../src/domain/engine';
import { parsePackage, planImport, resolveRefs, type ImportPackage, type ImportStep } from '../src/domain/importPackage';
import { createEmptyState } from '../src/domain/initialState';
import type { AppState } from '../src/domain/types';
import { handlePull, handleSync } from '../src/server/handler';
import { MemoryDb } from '../src/server/memoryDb';
import { SyncEngine } from '../src/services/cloud/syncEngine';

const NOW = new Date('2026-11-02T21:00:00-03:00');
const step = (id: string, module: ImportStep['module'], command: Command, extra: Partial<ImportStep> = {}): ImportStep => ({ id, module, label: id, command, ...extra });
const goal = (title: string): Command => ({
  type: 'goal/create',
  draft: { title, description: '', category: 'financeiro', metricName: 'Valor', unit: 'R$', indicator: 'quantitative', metricSource: 'manual', direction: 'increase', baselineValue: 0, targetValue: 1000, startDate: '2026-11-01', targetDate: null, milestones: [] },
});
function pkg(steps: ImportStep[], id = 'teste-pacote'): ImportPackage {
  return parsePackage({ format: 'ascent-import', version: 1, id, title: 'Pacote de teste', steps });
}
const sample = () =>
  pkg([
    step('cat', 'financas', { type: 'category/add', name: 'Relacionamento', kind: 'expense' }, { creates: 'categories', reuse: true }),
    step('orc', 'financas', { type: 'budget/set', categoryId: '$ref:cat', month: '2026-11', amount: 300 }),
    step('meta', 'metas', goal('Reserva'), { creates: 'goals', reuse: true }),
    step('proj', 'metas', { type: 'project/add', goalId: '$ref:meta', title: 'Organizar', description: '', milestoneId: null, steps: ['a', 'b'] }, { creates: 'projects', reuse: true }),
    step('pessoa', 'relacionamento', { type: 'rel/upsert', entity: 'profiles', value: { name: 'Ana', nickname: '', photoId: null, since: null, notes: '' } }, { creates: 'rel.profiles', reuse: true }),
    step('calcado', 'relacionamento', { type: 'rel/upsert', entity: 'entries', value: { profileId: '$ref:pessoa', sectionId: 'perfil', label: 'Calçado', value: '37', note: '', group: 'Medidas e tamanhos', format: 'texto' } }, { creates: 'rel.entries', reuse: true }),
  ]);

function applyAll(p: ImportPackage, s: AppState, only?: Set<string>): { state: AppState; errors: string[] } {
  let seq = 0;
  const errors: string[] = [];
  for (const st of p.steps) {
    if (only && !only.has(st.id)) continue;
    try {
      s = execute(s, { type: 'import/step', packageId: p.id, stepId: st.id, creates: st.creates, reuse: st.reuse, command: resolveRefs(st.command, s, p.id) }, { now: NOW, newId: () => `${st.id}-${++seq}` }).state;
    } catch (e) {
      errors.push(`${st.id}: ${(e as Error).message}`);
    }
  }
  return { state: s, errors };
}

describe('pacote de importação: arquivo', () => {
  it('recusa formato errado, ids repetidos, referência a item posterior e comando aninhado', () => {
    assert.throws(() => parsePackage({ format: 'outro' }), /não é um pacote/);
    assert.throws(() => pkg([step('a', 'metas', goal('x')), step('a', 'metas', goal('y'))]), /repetido/);
    assert.throws(() => pkg([step('a', 'financas', { type: 'budget/set', categoryId: '$ref:b', month: '2026-11', amount: 1 }), step('b', 'financas', { type: 'category/add', name: 'X', kind: 'expense' })]), /precisa vir antes/);
    assert.throws(() => pkg([step('a', 'metas', { type: 'import/step', packageId: 'p', stepId: 's', command: goal('x') } as Command)]), /aninhado/);
    assert.throws(() => pkg([step('a', 'xyz' as ImportStep['module'], goal('x'))]), /módulo/);
  });
});

describe('pacote de importação: aplicar', () => {
  it('aplica em ordem, resolvendo referências ao que foi criado antes', () => {
    const p = sample();
    const { state, errors } = applyAll(p, createEmptyState(NOW, { mode: 'real' }));
    assert.deepEqual(errors, []);
    const cat = state.finance.categories.find((c) => c.name === 'Relacionamento')!;
    assert.equal(state.finance.budgets.find((b) => b.categoryId === cat.id)?.amount, 300);
    const g = state.goals.find((x) => x.title === 'Reserva')!;
    assert.equal(state.projects.find((x) => x.title === 'Organizar')?.goalId, g.id);
    assert.equal(state.relationship.entries[0].profileId, state.relationship.profiles[0].id);
    assert.equal(state.imports.length, p.steps.length);
  });

  it('aplicar o mesmo pacote de novo não duplica nada', () => {
    const p = sample();
    const once = applyAll(p, createEmptyState(NOW, { mode: 'real' })).state;
    const twice = applyAll(p, once).state;
    assert.deepEqual(twice, once);
    assert.equal([...planImport(p, twice, new Set(p.steps.map((s) => s.id))).values()].every((v) => v === 'done'), true);
  });

  it('reaproveita o perfil, a categoria, a meta e o campo que já existiam', () => {
    let s = createEmptyState(NOW, { mode: 'real' });
    const run = (c: Command) => (s = execute(s, c, { now: NOW, newId: () => `m${Math.random().toString(36).slice(2)}` }).state);
    run({ type: 'rel/upsert', entity: 'profiles', value: { name: 'Ana Souza', nickname: '', photoId: null, since: null, notes: 'criado à mão' } });
    const pid = s.relationship.profiles[0].id;
    run({ type: 'rel/upsert', entity: 'entries', value: { profileId: pid, sectionId: 'perfil', label: 'calcado', value: '37', note: '', group: '', format: 'texto' } });
    run({ type: 'category/add', name: 'relacionamento', kind: 'expense' });
    run(goal('Reserva'));
    const p = sample();
    const plan = planImport(p, s, new Set(p.steps.map((x) => x.id)));
    assert.equal(plan.get('pessoa'), 'reuse');
    assert.equal(plan.get('cat'), 'reuse');
    assert.equal(plan.get('meta'), 'reuse');
    const { state, errors } = applyAll(p, s);
    assert.deepEqual(errors, []);
    assert.equal(state.relationship.profiles.length, 1, 'não cria um segundo perfil (a tela mostra um por vez)');
    assert.equal(state.relationship.profiles[0].notes, 'criado à mão', 'o perfil existente não é sobrescrito');
    assert.equal(state.relationship.entries.length, 1, 'campo "Calçado" equivalente (sem acento/maiúscula) não duplica');
    assert.equal(state.finance.categories.filter((c) => c.name.toLowerCase() === 'relacionamento').length, 1);
    assert.equal(state.goals.length, 1);
    assert.equal(state.projects[0].goalId, state.goals[0].id, 'projeto entra na meta que já existia');
  });

  it('item desmarcado bloqueia os que dependem dele; erro em um item não impede os outros', () => {
    const p = sample();
    const all = new Set(p.steps.map((s) => s.id));
    all.delete('meta');
    const plan = planImport(p, createEmptyState(NOW, { mode: 'real' }), all);
    assert.equal(plan.get('proj'), 'blocked');
    assert.equal(plan.get('calcado'), 'ready');
    const bad = pkg([step('ruim', 'financas', { type: 'budget/set', categoryId: 'nao-existe', month: '2026-11', amount: 10 }), step('ok', 'metas', goal('Viagem'), { creates: 'goals' })]);
    const { state, errors } = applyAll(bad, createEmptyState(NOW, { mode: 'real' }));
    assert.equal(errors.length, 1);
    assert.equal(state.goals.length, 1);
    assert.equal(state.imports.length, 1, 'só o item aplicado fica registrado (o outro pode ser tentado de novo)');
  });

  it('nuvem: fila em lote, servidor aplica igual e outro aparelho não duplica ao importar de novo', async () => {
    const p = sample();
    const db = new MemoryDb();
    const USER = '66666666-0000-4000-8000-000000000001';
    const device = async () => {
      const pulled = await handlePull(db, USER, NOW);
      const net = { status: async () => ({ exists: true, version: pulled.version }), pull: async () => handlePull(db, USER, NOW), importState: async () => pulled, sync: async (c: never[]) => structuredClone(await handleSync(db, USER, { commands: c }, NOW)) };
      return new SyncEngine(net as never, { confirmed: pulled.state, version: pulled.version, outbox: [], lastSyncAt: null }, () => undefined);
    };
    const build = (st: ImportStep, view: AppState): Command => ({ type: 'import/step', packageId: p.id, stepId: st.id, creates: st.creates, reuse: st.reuse, command: resolveRefs(st.command, view, p.id) });
    const phone = await device();
    const laptop = await device(); // abriu antes de o celular importar
    const r1 = phone.enqueueMany(p.steps, build, NOW);
    assert.equal(r1.filter((x) => x.error).length, 0);
    await phone.flush();
    const r2 = laptop.enqueueMany(p.steps, build, NOW); // estado desatualizado: cria tudo de novo na fila…
    assert.equal(r2.filter((x) => x.error).length, 0);
    await laptop.flush(); // …mas o servidor reaplica sobre o estado real e ignora o que já foi importado
    const server = (await handlePull(db, USER, NOW)).state;
    assert.equal(server.goals.length, 1);
    assert.equal(server.relationship.profiles.length, 1);
    assert.equal(server.relationship.entries.length, 1);
    assert.equal(server.imports.length, p.steps.length);
    assert.deepEqual(laptop.confirmed(), server);
  });
});

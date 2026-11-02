import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MOUNTAIN_RULES } from '../src/domain/config';
import { createDemoState } from '../src/domain/demo';
import { forecastGoal, goalObservations } from '../src/domain/goals';
import { mountainState, pointAt, TRAIL_LENGTH } from '../src/domain/mountain';
import { LocalStateRepository, MemoryStorage } from '../src/repositories/localRepository';
import { dailyHabit, incomeGoal, makeRunner, NOW } from './helpers';

describe('montanha', () => {
  it('trilha é contínua, começa na base e termina no cume', () => {
    const base = pointAt(0);
    const top = pointAt(1);
    assert.ok(base.y > top.y + 400, 'o cume fica acima da base');
    assert.ok(TRAIL_LENGTH > 1000);
    let prev = pointAt(0);
    for (let f = 0.01; f <= 1; f += 0.01) {
      const p = pointAt(f);
      assert.ok(Math.hypot(p.x - prev.x, p.y - prev.y) < TRAIL_LENGTH * 0.02, 'sem saltos na trilha');
      prev = p;
    }
  });

  it('concluir um hábito avança o personagem de forma determinística', () => {
    const r = makeRunner();
    r.run(incomeGoal());
    const goalId = r.state.goals[0].id;
    r.run(dailyHabit('Ação comercial', goalId));
    const before = mountainState(r.state, goalId).position;
    const effects = r.run({ type: 'occurrence/set', occurrenceId: `${r.state.habits[0].id}@2026-11-02`, status: 'done' });
    const after = mountainState(r.state, goalId);
    assert.ok(after.position > before);
    assert.equal(after.segmentPoints, MOUNTAIN_RULES.points.habitDone);
    assert.ok(effects.some((e) => e.type === 'progress' && e.points > 0));
    // Mesmo histórico → mesma posição
    assert.equal(mountainState(structuredClone(r.state), goalId).position, after.position);
  });

  it('hábito sem objetivo avança a jornada prioritária', () => {
    const r = makeRunner();
    r.run(incomeGoal());
    r.run(dailyHabit());
    r.run({ type: 'occurrence/set', occurrenceId: `${r.state.habits[0].id}@2026-11-02`, status: 'done' });
    assert.equal(mountainState(r.state, r.state.goals[0].id).segmentPoints, MOUNTAIN_RULES.points.habitDone);
  });

  it('execução sozinha não alcança o checkpoint (ação não é resultado)', () => {
    const r = makeRunner();
    r.run(incomeGoal());
    const goalId = r.state.goals[0].id;
    for (let i = 0; i < 40; i++) r.run({ type: 'task/create', title: `Ação ${i}`, date: '2026-11-02', goalId, done: true });
    const m = mountainState(r.state, goalId);
    assert.equal(m.reachedCount, 0);
    assert.equal(m.capped, true);
    assert.ok(m.position < m.checkpoints[0].fraction);
  });

  it('marco validado pelo indicador cria checkpoint, concede recompensa e reinicia o trecho', () => {
    const r = makeRunner();
    r.run(incomeGoal());
    const goalId = r.state.goals[0].id;
    r.run({ type: 'task/create', title: 'Ação', date: '2026-11-02', goalId, done: true });
    const effects = r.run({ type: 'goal/observe', goalId, value: 4600, date: '2026-11-02', note: '' });
    assert.ok(effects.some((e) => e.type === 'milestone'));
    const m = mountainState(r.state, goalId);
    assert.equal(m.reachedCount, 1);
    assert.equal(m.segmentPoints, 0);
    assert.ok(Math.abs(m.position - m.checkpoints[0].fraction) < 1e-9);
    assert.ok(r.state.achievements.some((a) => a.code === 'first_milestone'));
    // Repetir a medição não duplica o marco
    r.run({ type: 'goal/observe', goalId, value: 4700, date: '2026-11-02', note: '' });
    assert.equal(r.state.xpEvents.filter((e) => e.key.startsWith('ms:')).length, 1);
  });

  it('atingir o alvo conclui o objetivo e leva ao cume', () => {
    const r = makeRunner();
    r.run(incomeGoal());
    const goalId = r.state.goals[0].id;
    const effects = r.run({ type: 'goal/observe', goalId, value: 10200, date: '2026-11-02', note: '' });
    assert.ok(effects.some((e) => e.type === 'summit'));
    assert.equal(r.state.goals[0].status, 'completed');
    assert.equal(mountainState(r.state, goalId).position, 1);
  });

  it('missão concluída quando todas as microetapas terminam', () => {
    const r = makeRunner();
    r.run(incomeGoal());
    const goalId = r.state.goals[0].id;
    r.run({ type: 'project/add', goalId, title: 'Oferta', description: '', milestoneId: null, steps: ['A', 'B'] });
    const [a, b] = r.state.steps.map((s) => s.id);
    r.run({ type: 'step/toggle', stepId: a });
    const fx = r.run({ type: 'step/toggle', stepId: b });
    assert.ok(fx.some((e) => e.type === 'mission'));
    assert.equal(r.state.projects[0].status, 'completed');
    assert.throws(() => r.run({ type: 'step/toggle', stepId: a }), /concluído/);
    assert.throws(() => r.run({ type: 'project/remove', projectId: r.state.projects[0].id }), /histórico/);
  });
});

describe('objetivos e histórico', () => {
  it('editar o objetivo cria nova versão e preserva a anterior', () => {
    const r = makeRunner();
    r.run(incomeGoal());
    const goalId = r.state.goals[0].id;
    r.run({ type: 'goal/update', goalId, patch: { targetValue: 8000 }, reason: 'Meta intermediária mais realista' });
    const versions = r.state.goalVersions.filter((v) => v.goalId === goalId);
    assert.equal(versions.length, 2);
    assert.equal(versions[0].snapshot.targetValue, 10000);
    assert.equal(versions[1].snapshot.targetValue, 8000);
    assert.equal(r.state.goals[0].version, 2);
    assert.ok(r.state.achievements.some((a) => a.code === 'conscious_replan'));
  });

  it('arquivar não apaga histórico, observações nem XP', () => {
    const r = makeRunner();
    r.run(incomeGoal());
    const goalId = r.state.goals[0].id;
    r.run({ type: 'goal/observe', goalId, value: 4000, date: '2026-11-01', note: '' });
    const xp = r.state.xpEvents.length;
    r.run({ type: 'goal/setStatus', goalId, status: 'archived' });
    assert.equal(r.state.goals[0].status, 'archived');
    assert.equal(goalObservations(r.state, goalId).length, 2);
    assert.ok(r.state.xpEvents.length >= xp);
    assert.ok(r.state.activity.some((a) => a.type === 'status'));
  });

  it('não estima prazo sem histórico suficiente', () => {
    const r = makeRunner();
    r.run(incomeGoal());
    const g = r.state.goals[0];
    const f = forecastGoal(g, goalObservations(r.state, g.id), '2026-11-02');
    assert.equal(f.status, 'insufficient');
  });

  it('estima prazo com tendência positiva e explicita pressupostos', () => {
    const r = makeRunner();
    r.run(incomeGoal({ startDate: '2026-07-01' }));
    const goalId = r.state.goals[0].id;
    r.run({ type: 'goal/observe', goalId, value: 4000, date: '2026-08-15', note: '' });
    r.run({ type: 'goal/observe', goalId, value: 4400, date: '2026-10-01', note: '' });
    const g = r.state.goals[0];
    const f = forecastGoal(g, goalObservations(r.state, goalId), '2026-11-02');
    assert.equal(f.status, 'ok');
    if (f.status === 'ok') {
      assert.ok(f.estimate > '2026-11-02');
      assert.ok(f.assumptions.length >= 3);
      assert.equal(f.confidence, 'baixa');
    }
  });

  it('não estima prazo quando a tendência é negativa', () => {
    const r = makeRunner();
    r.run(incomeGoal({ startDate: '2026-07-01' }));
    const goalId = r.state.goals[0].id;
    r.run({ type: 'goal/observe', goalId, value: 3300, date: '2026-08-15', note: '' });
    r.run({ type: 'goal/observe', goalId, value: 3100, date: '2026-10-01', note: '' });
    assert.equal(forecastGoal(r.state.goals[0], goalObservations(r.state, goalId), '2026-11-02').status, 'no_trend');
  });
});

describe('persistência', () => {
  it('estado sobrevive a salvar/carregar (recarregamento)', async () => {
    const storage = new MemoryStorage();
    const repo = new LocalStateRepository(storage, () => NOW);
    const r = makeRunner();
    r.run(incomeGoal());
    r.run(dailyHabit());
    r.run({ type: 'occurrence/set', occurrenceId: `${r.state.habits[0].id}@2026-11-02`, status: 'done' });
    await repo.save(r.state);
    const loaded = await new LocalStateRepository(storage, () => NOW).load();
    assert.ok(loaded);
    assert.deepEqual(loaded, r.state);
    const goalId = r.state.goals[0].id;
    assert.equal(mountainState(loaded!, goalId).position, mountainState(r.state, goalId).position);
    assert.deepEqual(loaded!.achievements, r.state.achievements);
  });

  it('rejeita backups inválidos', async () => {
    const storage = new MemoryStorage();
    storage.setItem('ascent:v1:state', JSON.stringify({ foo: 1 }));
    await assert.rejects(() => new LocalStateRepository(storage).load(), /versão de esquema/);
  });

  it('a demonstração é construída pelo próprio motor e é coerente', () => {
    const s = createDemoState(NOW);
    assert.equal(s.mode, 'demo');
    assert.ok(s.goals.length >= 2);
    assert.ok(s.achievements.length >= 8);
    assert.equal(new Set(s.xpEvents.map((e) => e.key)).size, s.xpEvents.length);
    const m = mountainState(s, s.goals[0].id);
    assert.equal(m.reachedCount, 1);
    assert.ok(m.position > m.checkpoints[0].fraction && m.position < m.checkpoints[1].fraction);
    assert.ok(s.inventory.some((i) => i.itemId === 'head-bandana'));
  });
});

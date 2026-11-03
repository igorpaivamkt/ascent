// Relatório do relacionamento: escolher o que exportar e recortar por período.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultSelection, relReportBlocks, relReportData } from '../src/domain/relationshipReport';
import { makeRunner } from './helpers';

function setup() {
  const r = makeRunner();
  r.run({ type: 'rel/upsert', entity: 'profiles', value: { name: 'Ana', nickname: '', photoId: null, since: null, notes: '' } });
  const pid = r.state.relationship.profiles[0].id;
  const entry = (sectionId: string, label: string, value: string) =>
    r.run({ type: 'rel/upsert', entity: 'entries', value: { profileId: pid, sectionId, label, value, note: '', group: '', format: 'texto' } });
  entry('perfil', 'Calçado', '37');
  entry('perfil', 'PIX', 'ana@exemplo.com');
  entry('personalidade', '', 'Leitora');
  r.run({ type: 'rel/upsert', entity: 'sections', value: { profileId: pid, title: 'Conversas pendentes', kind: 'list' } });
  const conv = r.state.relationship.sections[0].id;
  entry(conv, '', 'Falar sobre viagens');
  const exp = (title: string, date: string) => r.run({ type: 'rel/upsert', entity: 'experiences', value: { profileId: pid, title, date, location: '', type: 'encontro', description: '', learnings: '', photoIds: [] } });
  exp('Cinema', '2026-10-11');
  exp('Hotel', '2026-10-24');
  const gasto = (description: string, amount: number, date: string) => r.run({ type: 'rel/upsert', entity: 'expenses', value: { profileId: pid, experienceId: null, description, amount, category: 'Passeio', date, paidBy: 'eu' } });
  gasto('Ingressos', 84, '2026-10-11');
  gasto('Hospedagem', 295.81, '2026-10-24');
  r.run({ type: 'rel/private/set', profileId: pid, address: 'Rua A, 1', postalCode: '' });
  return { r, pid, conv };
}

describe('relatório do relacionamento', () => {
  it('lista um bloco por parte da ficha, inclusive as abas criadas por você, com a contagem', () => {
    const { r, pid, conv } = setup();
    const blocks = relReportBlocks(r.state, pid, null);
    const by = Object.fromEntries(blocks.map((b) => [b.id, b]));
    assert.equal(by.perfil.count, 1, 'PIX não conta como campo do perfil');
    assert.equal(by['lista:personalidade'].count, 1);
    assert.equal(by[`lista:${conv}`].label, 'Conversas pendentes');
    assert.equal(by.linha.count, 2);
    assert.equal(by.gastos.count, 2);
    assert.equal(by.privado.count, 2, 'endereço + PIX');
  });

  it('por padrão marca tudo, menos endereço e PIX', () => {
    const { r, pid } = setup();
    const sel = defaultSelection(relReportBlocks(r.state, pid, null));
    assert.ok(sel.has('perfil') && sel.has('gastos') && sel.has('linha'));
    assert.ok(!sel.has('privado'));
  });

  it('o período recorta linha do tempo, gastos e total', () => {
    const { r, pid } = setup();
    const d = relReportData(r.state, pid, { from: '2026-10-20', to: '2026-10-31' });
    assert.deepEqual(d.experiences.map((e) => e.title), ['Hotel']);
    assert.deepEqual(d.expenses.map((e) => e.description), ['Hospedagem']);
    assert.equal(d.total, 295.81);
    const blocks = relReportBlocks(r.state, pid, { from: '2026-11-01', to: '2026-11-30' });
    assert.equal(blocks.find((b) => b.id === 'gastos')!.count, 0, 'sem gastos em novembro');
    assert.equal(blocks.find((b) => b.id === 'perfil')!.count, 1, 'a ficha não depende do período');
    assert.equal(relReportData(r.state, pid, null).total, 379.81);
  });
});

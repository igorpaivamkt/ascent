// Ficha da pessoa (Relacionamento → Perfil): campos personalizados, listas, abas próprias e regras de integridade.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Command } from '../src/domain/engine';
import { ageOn, entriesOf, groupFields, missingSuggestions, sectionsOf } from '../src/domain/relationshipProfile';
import { makeRunner } from './helpers';

function withProfile(name = 'Ana') {
  const r = makeRunner();
  r.run({ type: 'rel/upsert', entity: 'profiles', value: { name, nickname: '', photoId: null, since: null, notes: '' } });
  const pid = r.state.relationship.profiles.at(-1)!.id;
  return { r, pid };
}
const field = (profileId: string, label: string, value: string, group = 'Medidas e tamanhos', format: 'texto' | 'data' = 'texto'): Command =>
  ({ type: 'rel/upsert', entity: 'entries', value: { profileId, sectionId: 'perfil', label, value, note: '', group, format } });
const item = (profileId: string, sectionId: string, value: string, note = ''): Command =>
  ({ type: 'rel/upsert', entity: 'entries', value: { profileId, sectionId, label: '', value, note, group: '', format: 'texto' } });

describe('perfil da pessoa: campos', () => {
  it('cria campos com o nome que você definir e mostra agrupados', () => {
    const { r, pid } = withProfile();
    r.run(field(pid, 'Calçado', ' 37 '));
    r.run(field(pid, 'Roupa', 'M'));
    r.run(field(pid, 'Cor favorita', 'Verde', 'Gostos'));
    r.run(field(pid, 'Time do coração', 'Santos', ''));
    const fields = entriesOf(r.state, pid, 'perfil');
    assert.equal(fields.length, 4);
    assert.equal(fields[0].value, '37', 'espaços nas pontas são removidos');
    assert.deepEqual(groupFields(fields).map((g) => g.group), ['Medidas e tamanhos', 'Gostos', 'Outros'], 'grupos sugeridos primeiro, "Outros" no fim');
    assert.ok(!missingSuggestions(fields).some((s) => s.label === 'Calçado'), 'sugestão já usada some da lista');
  });

  it('edita um campo sem trocar de pessoa nem de aba', () => {
    const { r, pid } = withProfile();
    const { pid: other } = { pid: 'outra' };
    r.run(field(pid, 'Calçado', '37'));
    const e = r.state.relationship.entries[0];
    r.run({ type: 'rel/upsert', entity: 'entries', value: { ...e, profileId: other, sectionId: 'qualidades', value: '38' } });
    const after = r.state.relationship.entries[0];
    assert.equal(after.value, '38');
    assert.equal(after.profileId, pid);
    assert.equal(after.sectionId, 'perfil');
    assert.equal(after.createdAt, e.createdAt);
    assert.notEqual(after.updatedAt, e.updatedAt);
  });

  it('recusa campo sem nome, sem valor, data inválida e texto longo demais', () => {
    const { r, pid } = withProfile();
    assert.throws(() => r.run(field(pid, '', '37')), /nome para o campo/);
    assert.throws(() => r.run(field(pid, 'Calçado', '  ')), /Preencha o valor/);
    assert.throws(() => r.run(field(pid, 'Data de nascimento', '18/11/2004', 'Dados pessoais', 'data')), /Data inválida/);
    assert.throws(() => r.run(field(pid, 'x'.repeat(61), '1')), /no máximo 60/);
    assert.equal(r.state.relationship.entries.length, 0);
  });

  it('calcula a idade pela data de nascimento', () => {
    assert.equal(ageOn('2004-11-18', '2026-11-02'), 21);
    assert.equal(ageOn('2004-11-18', '2026-11-18'), 22);
    assert.equal(ageOn('2004-02-29', '2027-02-28'), 22);
    assert.equal(ageOn('2030-01-01', '2026-11-02'), null);
    assert.equal(ageOn('18/11/2004', '2026-11-02'), null);
  });
});

describe('perfil da pessoa: listas e abas', () => {
  it('personalidade, qualidades e defeitos são listas; o nome do campo é ignorado', () => {
    const { r, pid } = withProfile();
    r.run(item(pid, 'personalidade', 'Introvertida', 'Prefere grupos pequenos'));
    r.run(item(pid, 'qualidades', 'Paciente'));
    r.run(item(pid, 'defeitos', 'Teimosa'));
    r.run({ type: 'rel/upsert', entity: 'entries', value: { profileId: pid, sectionId: 'qualidades', label: 'ignorado', value: 'Gentil', note: '', group: 'x', format: 'texto' } });
    const q = entriesOf(r.state, pid, 'qualidades');
    assert.deepEqual(q.map((e) => e.value), ['Paciente', 'Gentil']);
    assert.equal(q[1].label, '');
    assert.equal(q[1].group, '');
    assert.equal(entriesOf(r.state, pid, 'personalidade')[0].note, 'Prefere grupos pequenos');
    assert.throws(() => r.run(item(pid, 'defeitos', '')), /Escreva o item/);
  });

  it('cria abas próprias (campos ou lista), renomeia e exclui com os itens', () => {
    const { r, pid } = withProfile();
    r.run({ type: 'rel/upsert', entity: 'sections', value: { profileId: pid, title: 'Sonhos', kind: 'list' } });
    r.run({ type: 'rel/upsert', entity: 'sections', value: { profileId: pid, title: 'Família', kind: 'fields' } });
    const [dreams, family] = r.state.relationship.sections;
    assert.deepEqual(sectionsOf(r.state, pid).map((s) => s.title), ['Perfil', 'Personalidade', 'Qualidades', 'Defeitos', 'Sonhos', 'Família']);
    r.run(item(pid, dreams.id, 'Conhecer o Japão'));
    r.run({ type: 'rel/upsert', entity: 'entries', value: { profileId: pid, sectionId: family.id, label: 'Mãe', value: 'Marta', note: '', group: '', format: 'texto' } });
    assert.throws(() => r.run({ type: 'rel/upsert', entity: 'entries', value: { profileId: pid, sectionId: family.id, label: '', value: 'sem nome', note: '', group: '', format: 'texto' } }), /nome para o campo/);
    r.run({ type: 'rel/upsert', entity: 'sections', value: { ...dreams, title: 'Sonhos e planos' } });
    assert.equal(r.state.relationship.sections[0].title, 'Sonhos e planos');
    assert.throws(() => r.run({ type: 'rel/upsert', entity: 'sections', value: { ...dreams, kind: 'fields' } }), /não pode ser trocado/);
    assert.throws(() => r.run({ type: 'rel/upsert', entity: 'sections', value: { profileId: pid, title: ' ', kind: 'list' } }), /nome para a aba/);
    r.run({ type: 'rel/remove', entity: 'sections', id: dreams.id });
    assert.equal(r.state.relationship.sections.length, 1);
    assert.equal(entriesOf(r.state, pid, dreams.id).length, 0, 'itens da aba excluída também saem');
    assert.equal(entriesOf(r.state, pid, family.id).length, 1);
  });

  it('não aceita item numa aba inexistente ou de outra pessoa', () => {
    const { r, pid } = withProfile('Ana');
    r.run({ type: 'rel/upsert', entity: 'profiles', value: { name: 'Bia', nickname: '', photoId: null, since: null, notes: '' } });
    const bia = r.state.relationship.profiles[1].id;
    r.run({ type: 'rel/upsert', entity: 'sections', value: { profileId: bia, title: 'Hobbies', kind: 'list' } });
    const biaSection = r.state.relationship.sections[0].id;
    assert.throws(() => r.run(item(pid, 'inventada', 'x')), /Aba não encontrada/);
    assert.throws(() => r.run(item(pid, biaSection, 'x')), /Aba não encontrada/);
    assert.throws(() => r.run(item('perfil-falso', 'qualidades', 'x')), /Perfil não encontrado/);
  });

  it('excluir a pessoa apaga abas e itens dela; nada disso gera XP', () => {
    const { r, pid } = withProfile();
    const xpBefore = r.state.xpEvents.length;
    r.run(field(pid, 'Calçado', '37'));
    r.run(item(pid, 'qualidades', 'Paciente'));
    r.run({ type: 'rel/upsert', entity: 'sections', value: { profileId: pid, title: 'Sonhos', kind: 'list' } });
    assert.equal(r.state.xpEvents.length, xpBefore, 'anotar na ficha não dá XP (sem inflação)');
    r.run({ type: 'rel/remove', entity: 'profiles', id: pid });
    assert.equal(r.state.relationship.entries.length, 0);
    assert.equal(r.state.relationship.sections.length, 0);
  });

  it('o comando original não é alterado pela validação (fila offline continua igual)', () => {
    const { r, pid } = withProfile();
    const cmd = field(pid, 'Calçado', ' 37 ');
    const copy = structuredClone(cmd);
    r.run(cmd);
    assert.deepEqual(cmd, copy);
  });
});

describe('perfil da pessoa: sincronização', () => {
  it('o servidor aceita, reaplica igual ao aparelho e não duplica ao reenviar', async () => {
    const { handleSync, handlePull } = await import('../src/server/handler');
    const { MemoryDb } = await import('../src/server/memoryDb');
    const db = new MemoryDb();
    const USER = '33333333-0000-4000-8000-000000000001';
    await handlePull(db, USER);
    const at = new Date().toISOString();
    const env = (n: number, command: Command) => ({ id: `perfil-cmd-${n}-0000`, issuedAt: at, command });
    const profile: Command = { type: 'rel/upsert', entity: 'profiles', value: { name: 'Ana', nickname: '', photoId: null, since: null, notes: '' } };
    const first = await handleSync(db, USER, { commands: [env(1, profile)] });
    const pid = first.state.relationship.profiles[0].id;
    const batch = [env(2, field(pid, 'Calçado', '37')), env(3, item(pid, 'qualidades', 'Paciente')), env(4, { type: 'rel/upsert', entity: 'sections', value: { profileId: pid, title: 'Sonhos', kind: 'list' } })];
    const res = await handleSync(db, USER, { commands: batch });
    assert.deepEqual(res.results.map((x) => x.status), ['applied', 'applied', 'applied']);
    assert.equal(res.state.relationship.entries.length, 2);
    assert.equal(res.state.relationship.sections.length, 1);
    const again = await handleSync(db, USER, { commands: batch });
    assert.deepEqual(again.results.map((x) => x.status), ['duplicate', 'duplicate', 'duplicate']);
    assert.equal(again.state.relationship.entries.length, 2, 'reenvio da fila não duplica itens');
  });
});

describe('perfil da pessoa: jornada gravada antes da atualização', () => {
  it('conta antiga (sem as coleções novas) salva campo da ficha sem erro e devolve estado completo', async () => {
    const { handleSync, handlePull, handleStatus } = await import('../src/server/handler');
    const { MemoryDb } = await import('../src/server/memoryDb');
    const db = new MemoryDb();
    const USER = '44444444-0000-4000-8000-000000000001';
    await handlePull(db, USER);
    const at = new Date().toISOString();
    const env = (n: number, command: Command) => ({ id: `legado-cmd-${n}-0000`, issuedAt: at, command });
    const first = await handleSync(db, USER, { commands: [env(1, { type: 'rel/upsert', entity: 'profiles', value: { name: 'Ana', nickname: '', photoId: null, since: null, notes: '' } })] });
    const pid = first.state.relationship.profiles[0].id;
    // Simula o documento salvo pela versão anterior do app: sem 'sections' e 'entries'.
    const stored = db.states.get(USER)!;
    const rel = stored.state.relationship as Partial<typeof stored.state.relationship>;
    delete rel.sections;
    delete rel.entries;
    const res = await handleSync(db, USER, { commands: [env(2, field(pid, 'Nome completo', 'Ana Souza', 'Dados pessoais'))] });
    assert.equal(res.results[0].status, 'applied', 'antes da correção o servidor recusava com TypeError');
    assert.ok(Array.isArray(res.state.relationship.sections), 'o estado devolvido ao aparelho tem todas as coleções');
    assert.equal(res.state.relationship.entries[0].value, 'Ana Souza');
    assert.equal((await handleStatus(db, USER)).exists, true);
  });

  it('o aparelho normaliza o estado recebido mesmo se o servidor mandar sem as coleções novas', async () => {
    const { SyncEngine } = await import('../src/services/cloud/syncEngine');
    const { createEmptyState } = await import('../src/domain/initialState');
    const legacy = createEmptyState(new Date(), { mode: 'real' });
    const rel = legacy.relationship as Partial<typeof legacy.relationship>;
    delete rel.sections;
    delete rel.entries;
    const transport = {
      status: async () => ({ exists: true, version: 1 }),
      pull: async () => ({ state: structuredClone(legacy), version: 2 }),
      importState: async () => ({ state: legacy, version: 1 }),
      sync: async () => ({ state: structuredClone(legacy), version: 2, results: [] }),
      deleteAccount: async () => undefined,
    };
    const engine = new SyncEngine(transport as never, { confirmed: createEmptyState(new Date()), version: 1, outbox: [], lastSyncAt: null }, () => undefined);
    await engine.refresh();
    assert.deepEqual(engine.confirmed().relationship.sections, []);
    assert.deepEqual(engine.view().relationship.entries, []);
  });
});

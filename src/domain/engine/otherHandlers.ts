import { CATALOG, getItem, REQUIRED_SLOTS } from '../catalog';
import { COIN_RULES, XP_RULES } from '../config';
import { addDays } from '../dates';
import { BUILTIN_IDS, LIMITS } from '../relationshipProfile';
import { routineStats } from '../routine';
import type { AppState, Transaction } from '../types';
import type { Command, RelEntity } from './commands';
import type { Kernel } from './kernel';

type C<T extends Command['type']> = Extract<Command, { type: T }>;
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ───────────────────────── Perfil e configurações
export function profileUpdate(k: Kernel, c: C<'profile/update'>): void {
  if (c.displayName !== undefined) {
    if (!c.displayName.trim()) k.fail('Informe um nome.');
    k.d.profile.displayName = c.displayName.trim().slice(0, 40);
  }
  if (c.activeTitleId !== undefined) k.d.profile.activeTitleId = c.activeTitleId;
}

export function settingsUpdate(k: Kernel, { patch }: C<'settings/update'>): void {
  if (patch.coinName !== undefined && !patch.coinName.trim()) k.fail('A moeda precisa de um nome.');
  Object.assign(k.d.settings, patch, patch.coinName ? { coinName: patch.coinName.trim().slice(0, 24) } : {});
}

// ───────────────────────── Finanças
export function txUpsert(k: Kernel, { tx }: C<'tx/upsert'>): void {
  if (!tx.description.trim()) k.fail('Descreva a transação.');
  if (!Number.isFinite(tx.amount) || tx.amount <= 0) k.fail('O valor precisa ser maior que zero.');
  const cat = k.d.finance.categories.find((c) => c.id === tx.categoryId);
  if (!cat || cat.kind !== tx.type) k.fail('Escolha uma categoria compatível com o tipo.');
  if (!k.d.finance.accounts.some((a) => a.id === tx.accountId)) k.fail('Escolha uma conta.');
  if (tx.type === 'income' && !tx.incomeClass) k.fail('Classifique a natureza da receita.');
  const value = { ...tx, description: tx.description.trim(), amount: Math.round(tx.amount * 100) / 100, incomeClass: tx.type === 'income' ? tx.incomeClass : null };
  const existing = tx.id ? k.d.finance.transactions.find((t) => t.id === tx.id) : undefined;
  if (existing) {
    const linked = k.d.relationship.expenses.filter((e) => e.txId === existing.id);
    if (linked.length && value.type !== 'expense') k.fail('Esta transação está ligada a um gasto do relacionamento e precisa continuar sendo um gasto.');
    Object.assign(existing, value, { updatedAt: k.at });
    for (const e of linked) Object.assign(e, { amount: existing.amount, date: existing.date }); // mantém os dois lados iguais
    k.log('financas', 'tx', `Transação editada: ${value.description}`, money(value.amount));
  } else {
    const t: Transaction = { ...value, id: k.id(), createdAt: k.at, updatedAt: k.at };
    k.d.finance.transactions.push(t);
    k.log('financas', 'tx', `${t.type === 'income' ? 'Receita' : 'Despesa'} registrada: ${t.description}`, `${money(t.amount)} · ${{ planned: 'prevista', pending: 'pendente', settled: 'realizada' }[t.status]}`);
  }
}

export function txRemove(k: Kernel, { txId }: C<'tx/remove'>): void {
  const t = k.d.finance.transactions.find((x) => x.id === txId) ?? k.fail('Transação não encontrada.');
  k.d.finance.transactions = k.d.finance.transactions.filter((x) => x.id !== txId);
  k.d.relationship.expenses = k.d.relationship.expenses.filter((e) => e.txId !== txId); // gasto ligado sai junto
  k.log('financas', 'tx', `Transação removida: ${t.description}`, money(t.amount));
}

export function txSettle(k: Kernel, { txId }: C<'tx/settle'>): void {
  const t = k.d.finance.transactions.find((x) => x.id === txId) ?? k.fail('Transação não encontrada.');
  if (t.status === 'settled') return;
  t.status = 'settled';
  t.updatedAt = k.at;
  k.log('financas', 'tx', `Transação realizada: ${t.description}`, money(t.amount));
}

export function accountUpsert(k: Kernel, { account }: C<'account/upsert'>): void {
  if (!account.name.trim()) k.fail('Dê um nome à conta.');
  if (!Number.isFinite(account.openingBalance)) k.fail('Saldo inicial inválido.');
  const existing = account.id ? k.d.finance.accounts.find((a) => a.id === account.id) : undefined;
  if (existing) Object.assign(existing, account, { name: account.name.trim() });
  else k.d.finance.accounts.push({ ...account, name: account.name.trim(), id: k.id() });
}

export function categoryAdd(k: Kernel, { name, kind }: C<'category/add'>): void {
  if (!name.trim()) k.fail('Dê um nome à categoria.');
  if (k.d.finance.categories.some((c) => c.kind === kind && c.name.toLowerCase() === name.trim().toLowerCase())) k.fail('Essa categoria já existe.');
  k.d.finance.categories.push({ id: k.id(), name: name.trim(), kind });
}

export function budgetSet(k: Kernel, { categoryId, month, amount }: C<'budget/set'>): void {
  if (!Number.isFinite(amount) || amount < 0) k.fail('Valor de orçamento inválido.');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) k.fail('Mês do orçamento inválido.');
  const cat = k.d.finance.categories.find((c) => c.id === categoryId);
  if (!cat || cat.kind !== 'expense') k.fail('Orçamento só vale para uma categoria de gasto existente.');
  const b = k.d.finance.budgets.find((x) => x.categoryId === categoryId && x.month === month);
  if (amount === 0) k.d.finance.budgets = k.d.finance.budgets.filter((x) => x !== b);
  else if (b) b.amount = amount;
  else k.d.finance.budgets.push({ id: k.id(), categoryId, month, amount });
}

// ───────────────────────── Relacionamento
const REL_LABEL: Record<RelEntity, string> = {
  profiles: 'Perfil', preferences: 'Preferência', dates: 'Data importante', wishes: 'Desejo', experiences: 'Experiência', expenses: 'Gasto', commitments: 'Compromisso',
  sections: 'Aba do perfil', entries: 'Item do perfil',
};

const clip = (k: Kernel, v: unknown, max: number, what: string): string => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length > max) k.fail(`${what}: use no máximo ${max} caracteres.`);
  return s;
};

/** Valida e normaliza abas e itens da ficha da pessoa (antes do upsert genérico). */
function normalizeProfileData(k: Kernel, entity: RelEntity, v: Record<string, unknown>): void {
  const rel = k.d.relationship;
  if (entity === 'sections') {
    v.title = clip(k, v.title, LIMITS.sectionTitle, 'Nome da aba');
    if (!v.title) k.fail('Dê um nome para a aba.');
    if (v.kind !== 'fields' && v.kind !== 'list') k.fail('Tipo de aba inválido.');
    const existing = v.id ? rel.sections.find((s) => s.id === v.id) : undefined;
    if (existing) {
      if (existing.kind !== v.kind) k.fail('O tipo da aba não pode ser trocado depois de criada.');
      v.profileId = existing.profileId;
    } else if (rel.sections.filter((s) => s.profileId === v.profileId).length >= LIMITS.customSections) k.fail(`Limite de ${LIMITS.customSections} abas personalizadas.`);
    return;
  }
  // entries
  const existing = v.id ? rel.entries.find((e) => e.id === v.id) : undefined;
  if (existing) {
    v.profileId = existing.profileId; // um item não muda de pessoa
    v.sectionId = existing.sectionId;
  }
  const sectionId = String(v.sectionId ?? '');
  const custom = rel.sections.find((s) => s.id === sectionId);
  if (!BUILTIN_IDS.has(sectionId) && !(custom && custom.profileId === v.profileId)) k.fail('Aba não encontrada.');
  const kind = custom ? custom.kind : sectionId === 'perfil' ? 'fields' : 'list';
  v.label = kind === 'fields' ? clip(k, v.label, LIMITS.label, 'Nome do campo') : '';
  if (kind === 'fields' && !v.label) k.fail('Dê um nome para o campo (ex.: Calçado).');
  v.value = clip(k, v.value, LIMITS.value, 'Valor');
  if (!v.value) k.fail(kind === 'fields' ? 'Preencha o valor do campo.' : 'Escreva o item.');
  v.note = clip(k, v.note ?? '', LIMITS.note, 'Observação');
  v.group = kind === 'fields' ? clip(k, v.group ?? '', LIMITS.group, 'Grupo') : '';
  v.format = v.format === 'data' ? 'data' : 'texto';
  if (v.format === 'data' && !/^\d{4}-\d{2}-\d{2}$/.test(String(v.value))) k.fail('Data inválida.');
  if (!existing && rel.entries.filter((e) => e.profileId === v.profileId).length >= LIMITS.entriesPerProfile) k.fail('Limite de itens do perfil atingido.');
  v.updatedAt = k.at;
}

export function relUpsert(k: Kernel, c: C<'rel/upsert'>): void {
  const list = k.d.relationship[c.entity] as unknown as { id: string }[];
  // Cópia: a validação normaliza campos sem alterar o comando original (que pode estar na fila offline).
  const v = { ...(c.value as Record<string, unknown>) } as Record<string, unknown> & { id?: string };
  if (c.entity === 'sections' || c.entity === 'entries') normalizeProfileData(k, c.entity, v);
  const text = (v.title ?? v.value ?? v.name ?? v.description) as string | undefined;
  if (typeof text === 'string' && !text.trim()) k.fail('Preencha o campo principal.');
  if (c.entity === 'expenses' && v.txId) {
    const tx = k.d.finance.transactions.find((t) => t.id === v.txId) ?? k.fail('Transação de Finanças não encontrada.');
    if (tx.type !== 'expense') k.fail('Só um gasto pode ser ligado ao relacionamento.');
    if (k.d.relationship.expenses.some((e) => e.txId === tx.id && e.id !== v.id)) k.fail('Essa transação já está ligada a outro gasto.');
    v.amount = tx.amount;
    v.date = tx.date;
  }
  if (c.entity === 'expenses' && !(Number(v.amount) > 0)) k.fail('O valor precisa ser maior que zero.');
  if (c.entity !== 'profiles' && !k.d.relationship.profiles.some((p) => p.id === v.profileId)) k.fail('Perfil não encontrado.');
  const existing = v.id ? list.find((x) => x.id === v.id) : undefined;
  if (existing) {
    Object.assign(existing, v);
    return;
  }
  if (c.entity === 'entries') {
    list.push({ ...v, id: k.id(), createdAt: k.at } as { id: string });
    return; // sem registro no histórico: é anotação, não evento
  }
  const created: Record<string, unknown> = { ...v, id: k.id() };
  if (c.entity === 'preferences') created.recordedAt = k.at;
  else if (c.entity === 'commitments') created.completedAt = null;
  else if (c.entity !== 'dates' && c.entity !== 'expenses') created.createdAt = k.at;
  list.push(created as { id: string });
  k.log('relacionamento', c.entity, `${REL_LABEL[c.entity]} registrado(a): ${String(text ?? '')}`, '');
  if (c.entity === 'experiences') {
    // Limite anti-inflação: no máximo uma recompensa por experiência por dia.
    const date = String(v.date ?? k.today);
    k.grantXp(`relexp:${date}`, XP_RULES.relExperience, 'execution', `Experiência registrada: ${String(text)}`, 'rel_experience', String(created.id));
  }
}

export function relRemove(k: Kernel, { entity, id }: C<'rel/remove'>): void {
  const rel = k.d.relationship;
  if (entity === 'profiles') {
    const p = rel.profiles.find((x) => x.id === id) ?? k.fail('Perfil não encontrado.');
    for (const key of ['preferences', 'dates', 'wishes', 'experiences', 'expenses', 'commitments', 'sections', 'entries'] as const) {
      (rel[key] as { profileId: string }[]) = (rel[key] as { profileId: string }[]).filter((x) => x.profileId !== id);
    }
    rel.privateDetails = rel.privateDetails.filter((x) => x.profileId !== id);
    rel.profiles = rel.profiles.filter((x) => x.id !== id);
    k.log('relacionamento', 'profile', `Perfil removido: ${p.name}`, 'Todos os registros associados foram excluídos.');
    return;
  }
  if (entity === 'sections') {
    const sec = rel.sections.find((x) => x.id === id) ?? k.fail('Aba não encontrada.');
    rel.entries = rel.entries.filter((e) => e.sectionId !== sec.id);
  }
  if (entity === 'commitments') k.setSourceXp('rel_commitment', id, 0, 'compromisso removido');
  if (entity === 'experiences') for (const e of rel.expenses) if (e.experienceId === id) e.experienceId = null;
  (rel[entity] as { id: string }[]) = (rel[entity] as { id: string }[]).filter((x) => x.id !== id);
}

export function relToggle(k: Kernel, { entity, id }: C<'rel/toggle'>): void {
  if (entity === 'wishes') {
    const w = k.d.relationship.wishes.find((x) => x.id === id) ?? k.fail('Item não encontrado.');
    w.status = w.status === 'pendente' ? 'realizado' : 'pendente';
    if (w.status === 'realizado') k.log('relacionamento', 'wish', `Desejo realizado: ${w.title}`, '');
    return;
  }
  const c = k.d.relationship.commitments.find((x) => x.id === id) ?? k.fail('Compromisso não encontrado.');
  const done = c.status !== 'done';
  c.status = done ? 'done' : 'pending';
  c.completedAt = done ? k.at : null;
  k.setSourceXp('rel_commitment', c.id, done ? XP_RULES.relCommitmentDone : 0, done ? `Compromisso cumprido: ${c.title}` : `compromisso reaberto (${c.title})`);
  k.log('relacionamento', 'commitment', done ? `Compromisso cumprido: ${c.title}` : `Compromisso reaberto: ${c.title}`, '');
}

export function relPrivateSet(k: Kernel, c: C<'rel/private/set'>): void {
  if (!k.d.relationship.profiles.some((p) => p.id === c.profileId)) k.fail('Perfil não encontrado.');
  const rec = k.d.relationship.privateDetails.find((p) => p.profileId === c.profileId);
  const value = { profileId: c.profileId, address: c.address.trim(), postalCode: c.postalCode.replace(/[^\d-]/g, '').slice(0, 9), updatedAt: k.at };
  if (rec) Object.assign(rec, value);
  else k.d.relationship.privateDetails.push(value);
}

export function relPrivateClear(k: Kernel, { profileId }: C<'rel/private/clear'>): void {
  k.d.relationship.privateDetails = k.d.relationship.privateDetails.filter((p) => p.profileId !== profileId);
}

// ───────────────────────── Revisão de período livre
export function periodReviewSave(k: Kernel, c: C<'review/period/save'>): void {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(c.from) || !iso.test(c.to) || c.from > c.to) k.fail('Período inválido.');
  if (c.from > k.today) k.fail('Esse período ainda não começou.');
  const clip = (v: string, n: number) => (v ?? '').trim().slice(0, n);
  const value = { from: c.from, to: c.to, title: clip(c.title, 80), highlights: clip(c.highlights, 4000), obstacles: clip(c.obstacles, 4000), priorities: clip(c.priorities, 4000) };
  if (!value.highlights && !value.obstacles && !value.priorities) k.fail('Escreva pelo menos uma parte da reflexão.');
  const existing = c.id ? k.d.periodReviews.find((r) => r.id === c.id) : k.d.periodReviews.find((r) => r.from === c.from && r.to === c.to);
  if (existing) {
    Object.assign(existing, value, { updatedAt: k.at });
    return;
  }
  if (k.d.periodReviews.length >= 500) k.fail('Limite de revisões atingido.');
  k.d.periodReviews.push({ id: k.id(), ...value, createdAt: k.at, updatedAt: k.at });
  k.log('revisao', 'period', `Revisão registrada: ${value.title || `${c.from} a ${c.to}`}`, '');
}

export function periodReviewRemove(k: Kernel, { id }: C<'review/period/remove'>): void {
  if (!k.d.periodReviews.some((r) => r.id === id)) k.fail('Revisão não encontrada.');
  k.d.periodReviews = k.d.periodReviews.filter((r) => r.id !== id);
}

// ───────────────────────── Revisão semanal
export function reviewSave(k: Kernel, c: C<'review/save'>): void {
  if (c.weekStart > k.today) k.fail('Essa semana ainda não começou.');
  const st = routineStats(k.d, c.weekStart, addDays(c.weekStart, 6), k.today);
  const existing = k.d.reviews.find((r) => r.weekStart === c.weekStart);
  const data = {
    weekStart: c.weekStart, planned: st.eligible, done: st.done, partial: st.partial, rate: st.rate,
    highlights: c.highlights.trim(), obstacles: c.obstacles.trim(), priorities: c.priorities.trim(),
  };
  if (existing) Object.assign(existing, data);
  else k.d.reviews.push({ ...data, id: k.id(), createdAt: k.at });
  k.grantXp(`review:${c.weekStart}`, XP_RULES.weeklyReview, 'review', 'Revisão semanal', 'review', c.weekStart);
  k.grantCoins(`review:${c.weekStart}`, COIN_RULES.weeklyReview, 'Revisão semanal');
  k.log('revisao', 'review', existing ? 'Revisão semanal atualizada' : 'Revisão semanal concluída', `Semana de ${c.weekStart}`);
}

// ───────────────────────── Loja e inventário
export function shopBuy(k: Kernel, { itemId }: C<'shop/buy'>): void {
  const item = getItem(itemId) ?? k.fail('Item não encontrado.');
  if (k.d.inventory.some((i) => i.itemId === itemId)) k.fail('Você já possui este item.');
  if (item.unlock.type !== 'coins') k.fail('Este item é desbloqueado por nível ou conquista, não por compra.');
  k.spendCoins(`buy:${itemId}`, item.unlock.price, `Compra: ${item.name}`);
  k.d.inventory.push({ itemId, acquiredAt: k.at, method: 'coins' });
  k.log('loja', 'purchase', `Item comprado: ${item.name}`, `${item.unlock.price} ${k.d.settings.coinName}`);
}

export function shopEquip(k: Kernel, { itemId }: C<'shop/equip'>): void {
  const item = getItem(itemId) ?? k.fail('Item não encontrado.');
  if (!k.d.inventory.some((i) => i.itemId === itemId)) k.fail('Adquira o item antes de equipá-lo.');
  k.d.equipped[item.slot] = itemId;
}

export function shopUnequip(k: Kernel, { slot }: C<'shop/unequip'>): void {
  if (REQUIRED_SLOTS.includes(slot)) k.fail('O personagem precisa de um visual base.');
  k.d.equipped[slot] = null;
}

export function ownsAll(state: AppState): boolean {
  return CATALOG.every((i) => state.inventory.some((x) => x.itemId === i.id));
}

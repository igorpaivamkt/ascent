import { useState } from 'react';
import { useAppState, useDispatch } from '../../app/store';
import type { RelCommitment, RelDate, RelExpense, RelPreference, RelProfile, RelWish } from '../../domain/types';
import { Field, Modal, Segmented } from '../../components/ui';
import { parseNumber } from '../../utils/format';

/**
 * Formulários de edição (ícone de lápis) das listas do relacionamento. Quem usa passa `key` com o id do
 * item: o formulário nasce já preenchido, sem corrida entre abrir e preencher.
 */

const footer = (onClose: () => void, onSave: () => void, busy = false) => (
  <>
    <button className="btn" onClick={onClose}>Cancelar</button>
    <button className="btn btn--primary" disabled={busy} onClick={onSave}>Salvar</button>
  </>
);

export const EXPENSE_CATEGORIES = ['Restaurantes', 'Alimentação', 'Passeios', 'Presentes', 'Transporte', 'Hospedagem', 'Viagens', 'Experiências', 'Pix para ela', 'Outros'];

export function ExpenseEditForm({ expense, profile, onClose }: { expense: RelExpense | null; profile: RelProfile; onClose: () => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const [f, setF] = useState(() => ({ description: expense?.description ?? '', amount: expense ? String(expense.amount).replace('.', ',') : '', date: expense?.date ?? '', category: expense?.category ?? '', experienceId: expense?.experienceId ?? '', paidBy: (expense?.paidBy ?? 'eu') as RelExpense['paidBy'] }));
  const [busy, setBusy] = useState(false);
  const exps = state.relationship.experiences.filter((e) => e.profileId === profile.id);
  const tx = expense?.txId ? state.finance.transactions.find((t) => t.id === expense.txId) : undefined;
  const categories = [...new Set([...EXPENSE_CATEGORIES, ...(expense ? [expense.category] : [])])];
  const save = async () => {
    if (!expense) return;
    const amount = parseNumber(f.amount);
    setBusy(true);
    try {
      // Gasto ligado a Finanças: valor e data mudam na transação (e o motor copia para o gasto).
      if (tx) {
        const ok = await dispatch({ type: 'tx/upsert', tx: { id: tx.id, description: `${f.description.trim()} (${profile.name})`, amount, type: tx.type, categoryId: tx.categoryId, accountId: tx.accountId, date: f.date, status: tx.status, incomeClass: tx.incomeClass, origin: tx.origin, note: tx.note } });
        if (!ok) return;
      }
      const ok = await dispatch({ type: 'rel/upsert', entity: 'expenses', value: { ...expense, description: f.description, amount, date: f.date, category: f.category, experienceId: f.experienceId || null, paidBy: f.paidBy } });
      if (ok) onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={!!expense} onClose={onClose} title="Editar gasto" footer={footer(onClose, () => void save(), busy)}>
      <div className="form">
        <Field label="Descrição"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="form-row">
          <Field label="Valor (R$)"><input className="input num" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Data"><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        </div>
        <div className="form-row">
          <Field label="Categoria"><select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Pago por"><select className="select" value={f.paidBy} onChange={(e) => setF({ ...f, paidBy: e.target.value as RelExpense['paidBy'] })}><option value="eu">Eu</option><option value="dividido">Dividido</option><option value="outra pessoa">Outra pessoa</option></select></Field>
        </div>
        <Field label="Experiência relacionada"><select className="select" value={f.experienceId} onChange={(e) => setF({ ...f, experienceId: e.target.value })}><option value="">Nenhuma</option>{exps.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></Field>
        {tx && <p className="xs muted">Este gasto também está em Finanças: valor, data e descrição são atualizados lá.</p>}
      </div>
    </Modal>
  );
}

export function WishEditForm({ wish, onClose }: { wish: RelWish | null; onClose: () => void }) {
  const dispatch = useDispatch();
  const [f, setF] = useState(() => ({ title: wish?.title ?? '', kind: (wish?.kind ?? 'presente') as RelWish['kind'], note: wish?.note ?? '', status: (wish?.status ?? 'pendente') as RelWish['status'] }));
  const save = async () => {
    if (wish && (await dispatch({ type: 'rel/upsert', entity: 'wishes', value: { ...wish, ...f } }))) onClose();
  };
  return (
    <Modal open={!!wish} onClose={onClose} title="Editar desejo ou ideia" footer={footer(onClose, () => void save())}>
      <div className="form">
        <Field label="Ideia"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Tipo"><select className="select" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as RelWish['kind'] })}><option value="presente">Presente</option><option value="experiencia">Experiência</option><option value="lugar">Lugar</option></select></Field>
        <Field label="Detalhes"><textarea className="textarea" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Onde vende, preço, link, quando ela comentou…" /></Field>
        <Segmented value={f.status} onChange={(status) => setF({ ...f, status })} label="Situação" options={[{ value: 'pendente', label: 'Pendente' }, { value: 'realizado', label: 'Realizado' }]} />
      </div>
    </Modal>
  );
}

export function DateEditForm({ item, onClose }: { item: RelDate | null; onClose: () => void }) {
  const dispatch = useDispatch();
  const [f, setF] = useState(() => ({ title: item?.title ?? '', date: item?.date ?? '', yearly: item?.yearly ?? true }));
  const save = async () => {
    if (item && (await dispatch({ type: 'rel/upsert', entity: 'dates', value: { ...item, ...f } }))) onClose();
  };
  return (
    <Modal open={!!item} onClose={onClose} title="Editar data" footer={footer(onClose, () => void save())}>
      <div className="form">
        <Field label="Nome da data"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Dia"><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <label className="check"><input type="checkbox" checked={f.yearly} onChange={(e) => setF({ ...f, yearly: e.target.checked })} /> Repete todo ano</label>
      </div>
    </Modal>
  );
}

export function CommitmentEditForm({ item, onClose }: { item: RelCommitment | null; onClose: () => void }) {
  const dispatch = useDispatch();
  const [f, setF] = useState(() => ({ title: item?.title ?? '', dueDate: item?.dueDate ?? '' }));
  const save = async () => {
    if (item && (await dispatch({ type: 'rel/upsert', entity: 'commitments', value: { ...item, ...f } }))) onClose();
  };
  return (
    <Modal open={!!item} onClose={onClose} title="Editar compromisso" footer={footer(onClose, () => void save())}>
      <div className="form">
        <Field label="Compromisso"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Prazo"><input className="input" type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export function PreferenceEditForm({ item, categories, onClose }: { item: RelPreference | null; categories: string[]; onClose: () => void }) {
  const dispatch = useDispatch();
  const [f, setF] = useState(() => ({ category: item?.category ?? '', value: item?.value ?? '', certainty: (item?.certainty ?? 'confirmada') as RelPreference['certainty'] }));
  const save = async () => {
    if (item && (await dispatch({ type: 'rel/upsert', entity: 'preferences', value: { ...item, ...f } }))) onClose();
  };
  const cats = [...new Set([...categories, ...(item ? [item.category] : [])])];
  return (
    <Modal open={!!item} onClose={onClose} title="Editar preferência" footer={footer(onClose, () => void save())}>
      <div className="form">
        <Field label="Categoria"><select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Preferência"><input className="input" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></Field>
        <Segmented value={f.certainty} onChange={(certainty) => setF({ ...f, certainty })} label="Grau de certeza" options={[{ value: 'confirmada', label: 'Ela/ele me disse' }, { value: 'suposicao', label: 'É uma suposição' }]} />
      </div>
    </Modal>
  );
}

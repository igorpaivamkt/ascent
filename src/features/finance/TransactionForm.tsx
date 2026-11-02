import { useEffect, useState } from 'react';
import { useAppState, useDispatch } from '../../app/store';
import { INCOME_CLASS_LABEL, TX_STATUS_LABEL } from '../../domain/finance';
import type { IncomeClass, Transaction, TxStatus, TxType } from '../../domain/types';
import { Field, Modal, Segmented } from '../../components/ui';
import { useToday } from '../../hooks/useGame';
import { parseNumber } from '../../utils/format';

export function TransactionForm({ open, onClose, type = 'expense', tx }: { open: boolean; onClose: () => void; type?: TxType; tx?: Transaction | null }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = useToday();
  const [kind, setKind] = useState<TxType>(type);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState<TxStatus>('settled');
  const [incomeClass, setIncomeClass] = useState<IncomeClass>('renda_pessoal');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const k = tx?.type ?? type;
    setKind(k);
    setDescription(tx?.description ?? '');
    setAmount(tx ? String(tx.amount).replace('.', ',') : '');
    setCategoryId(tx?.categoryId ?? state.finance.categories.find((c) => c.kind === k)?.id ?? '');
    setAccountId(tx?.accountId ?? state.finance.accounts[0]?.id ?? '');
    setDate(tx?.date ?? today);
    setStatus(tx?.status ?? 'settled');
    setIncomeClass(tx?.incomeClass ?? 'renda_pessoal');
    setNote(tx?.note ?? '');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tx, type]);

  const changeKind = (k: TxType) => {
    setKind(k);
    setCategoryId(state.finance.categories.find((c) => c.kind === k)?.id ?? '');
  };

  const save = async () => {
    const value = parseNumber(amount);
    if (!Number.isFinite(value)) return setError('Informe um valor válido, por exemplo 1.250,90.');
    const ok = await dispatch({
      type: 'tx/upsert',
      tx: { id: tx?.id, description, amount: value, type: kind, categoryId, accountId, date, status, incomeClass: kind === 'income' ? incomeClass : null, origin: tx?.origin ?? 'manual', note },
    });
    if (ok) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={tx ? 'Editar transação' : kind === 'income' ? 'Registrar receita' : 'Adicionar despesa'} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={save}>Salvar</button></>}>
      <div className="form">
        {!tx && <Segmented value={kind} onChange={changeKind} label="Tipo" options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]} />}
        <Field label="Descrição"><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={kind === 'income' ? 'Ex.: Salário' : 'Ex.: Mercado'} /></Field>
        <div className="form-row">
          <Field label="Valor (R$)"><input className="input num" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setError(''); }} placeholder="0,00" /></Field>
          <Field label="Data"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <fieldset className="field">
          <legend>Situação</legend>
          <Segmented value={status} onChange={setStatus} label="Situação" options={(['settled', 'pending', 'planned'] as TxStatus[]).map((s) => ({ value: s, label: TX_STATUS_LABEL[s] }))} />
          <small>Só valores realizados entram no saldo. Previstos e pendentes aparecem como projeção.</small>
        </fieldset>
        {kind === 'income' && (
          <Field label="Natureza da receita" hint="Renda pessoal, faturamento do negócio e outras entradas nunca são somados como se fossem a mesma coisa.">
            <select className="select" value={incomeClass} onChange={(e) => setIncomeClass(e.target.value as IncomeClass)}>
              {(Object.keys(INCOME_CLASS_LABEL) as IncomeClass[]).map((k) => <option key={k} value={k}>{INCOME_CLASS_LABEL[k]}</option>)}
            </select>
          </Field>
        )}
        <div className="form-row">
          <Field label="Categoria">
            <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {state.finance.categories.filter((c) => c.kind === kind).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Conta">
            <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {state.finance.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Observação"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" /></Field>
      </div>
    </Modal>
  );
}

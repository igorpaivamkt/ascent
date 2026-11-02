import { useState } from 'react';
import { LuCheck, LuChevronLeft, LuChevronRight, LuPencil, LuPlus, LuReceipt, LuTrash2 } from 'react-icons/lu';
import { useAppState, useDispatch } from '../../app/store';
import { addMonths, formatDate, formatMonth, monthKey } from '../../domain/dates';
import { accountBalance, budgetLines, expenseByCategory, INCOME_CLASS_LABEL, monthSummary, monthlySeries, monthTransactions, totalBalance, TX_STATUS_LABEL, upcoming } from '../../domain/finance';
import type { Account, Transaction } from '../../domain/types';
import { BarChart } from '../../components/charts';
import { ConfirmButton, Empty, Field, Modal, Progress, Segmented, Tabs } from '../../components/ui';
import { useToday } from '../../hooks/useGame';
import { money, money0, parseNumber, percent } from '../../utils/format';
import { DemoBanner } from '../settings/DemoBanner';
import { TransactionForm } from './TransactionForm';

type Tab = 'transacoes' | 'orcamento' | 'visao' | 'contas';

export function FinancePage() {
  const state = useAppState();
  const today = useToday();
  const [month, setMonth] = useState(monthKey(today));
  const [tab, setTab] = useState<Tab>('transacoes');
  const [form, setForm] = useState<{ open: boolean; type: 'income' | 'expense'; tx: Transaction | null }>({ open: false, type: 'expense', tx: null });
  const s = monthSummary(state, month);
  return (
    <>
      <DemoBanner />
      <header className="page-head">
        <div>
          <h1>Finanças</h1>
          <p>Previsto não é realizado: só o que entrou ou saiu de fato compõe o saldo.</p>
        </div>
        <div className="page-head__actions">
          <button className="btn" onClick={() => setForm({ open: true, type: 'income', tx: null })}><LuPlus /> Receita</button>
          <button className="btn btn--primary" onClick={() => setForm({ open: true, type: 'expense', tx: null })}><LuReceipt /> Despesa</button>
        </div>
      </header>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="month-nav">
          <button className="icon-btn icon-btn--bordered" aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}><LuChevronLeft /></button>
          <strong aria-live="polite">{formatMonth(month, true)}</strong>
          <button className="icon-btn icon-btn--bordered" aria-label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))}><LuChevronRight /></button>
        </div>
        <span className="small muted">Saldo em contas hoje: <strong className="num">{money(totalBalance(state, today))}</strong></span>
      </div>
      <dl className="fin-top">
        <div className="stat"><dt>Receitas realizadas</dt><dd>{money0(s.incomeSettled)}</dd><small>Renda pessoal {money0(s.personalIncome)} · faturamento {money0(s.businessRevenue)}</small></div>
        <div className="stat"><dt>Despesas realizadas</dt><dd>{money0(s.expenseSettled)}</dd><small>{s.count} lançamentos no mês</small></div>
        <div className="stat"><dt>Saldo realizado</dt><dd className={s.balanceSettled < 0 ? 'negative' : ''}>{money0(s.balanceSettled)}</dd><small>Taxa de poupança {percent(s.savingsRate)}</small></div>
        <div className="stat"><dt>Saldo projetado</dt><dd>{money0(s.projectedBalance)}</dd><small>+{money0(s.incomeExpected)} previstos · −{money0(s.expenseExpected)} pendentes</small></div>
      </dl>
      <Tabs value={tab} onChange={setTab} label="Seções de finanças" options={[{ value: 'transacoes', label: 'Transações' }, { value: 'orcamento', label: 'Orçamento' }, { value: 'visao', label: 'Visão geral' }, { value: 'contas', label: 'Contas' }]} />
      {tab === 'transacoes' && <TxList month={month} onEdit={(tx) => setForm({ open: true, type: tx.type, tx })} />}
      {tab === 'orcamento' && <BudgetView month={month} />}
      {tab === 'visao' && <Overview month={month} />}
      {tab === 'contas' && <Accounts />}
      <TransactionForm open={form.open} type={form.type} tx={form.tx} onClose={() => setForm({ ...form, open: false, tx: null })} />
    </>
  );
}

function TxList({ month, onEdit }: { month: string; onEdit: (t: Transaction) => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const [type, setType] = useState<'all' | 'income' | 'expense'>('all');
  const [status, setStatus] = useState<'all' | 'settled' | 'open'>('all');
  const list = monthTransactions(state, month)
    .filter((t) => type === 'all' || t.type === type)
    .filter((t) => status === 'all' || (status === 'settled' ? t.status === 'settled' : t.status !== 'settled'))
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="card" aria-label="Transações do mês">
      <div className="row" style={{ marginBottom: 8 }}>
        <Segmented value={type} onChange={setType} label="Tipo" options={[{ value: 'all', label: 'Todas' }, { value: 'income', label: 'Receitas' }, { value: 'expense', label: 'Despesas' }]} />
        <Segmented value={status} onChange={setStatus} label="Situação" options={[{ value: 'all', label: 'Qualquer' }, { value: 'settled', label: 'Realizadas' }, { value: 'open', label: 'Previstas/pendentes' }]} />
      </div>
      {list.length ? (
        <ul className="list">
          {list.map((t) => {
            const cat = state.finance.categories.find((c) => c.id === t.categoryId)?.name;
            return (
              <li key={t.id} className="tx-row">
                <div className="list__main">
                  <div className="list__title">{t.description}</div>
                  <div className="list__meta">
                    <span>{formatDate(t.date)}</span><span>{cat}</span>
                    <span className={`tag ${t.status === 'settled' ? '' : 'tag--warn'}`}>{TX_STATUS_LABEL[t.status]}</span>
                    {t.incomeClass && <span>{INCOME_CLASS_LABEL[t.incomeClass]}</span>}
                  </div>
                </div>
                <span className={`tx-amount ${t.type === 'income' ? 'in' : ''}`}>{t.type === 'income' ? '+' : '−'}{money(t.amount)}</span>
                <div className="list__end">
                  {t.status !== 'settled' && <button className="icon-btn" aria-label={`Marcar como realizada: ${t.description}`} onClick={() => dispatch({ type: 'tx/settle', txId: t.id })}><LuCheck /></button>}
                  <button className="icon-btn" aria-label={`Editar ${t.description}`} onClick={() => onEdit(t)}><LuPencil /></button>
                  <ConfirmButton className="icon-btn" ariaLabel={`Excluir ${t.description}`} confirmLabel="Excluir" onConfirm={() => dispatch({ type: 'tx/remove', txId: t.id })}><LuTrash2 /></ConfirmButton>
                </div>
              </li>
            );
          })}
        </ul>
      ) : <Empty icon={<LuReceipt />}>Nenhuma transação neste filtro.</Empty>}
    </section>
  );
}

function BudgetView({ month }: { month: string }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = useToday();
  const lines = budgetLines(state, month, today);
  const [cat, setCat] = useState('');
  const [amount, setAmount] = useState('');
  const cats = state.finance.categories.filter((c) => c.kind === 'expense');
  return (
    <div className="grid grid--2">
      <section className="card" aria-labelledby="bud-h">
        <div className="card__head"><h2 id="bud-h">Planejado × realizado</h2></div>
        {lines.length ? lines.map((l) => (
          <div key={l.categoryId} className="budget-line">
            <div className="row"><strong>{l.name}</strong><span className="small num">{money0(l.realized)} {l.planned ? `de ${money0(l.planned)}` : '(sem orçamento)'}</span></div>
            {l.planned > 0 && <div className={l.realized > l.planned ? 'is-over' : ''}><Progress value={l.ratio ?? 0} label={`Consumo do orçamento: ${l.name}`} thin /></div>}
            <div className="xs muted">
              {l.planned > 0 && <>{l.diff >= 0 ? `Restam ${money0(l.diff)}` : `Excedeu ${money0(-l.diff)}`} · {percent(l.ratio)} consumido</>}
              {l.pending > 0 && <> · {money0(l.pending)} pendente</>}
              {l.trend !== null && l.planned > 0 && <> · tendência até o fim do mês: {money0(l.trend)}</>}
            </div>
          </div>
        )) : <p className="muted small">Sem orçamento ou gastos neste mês.</p>}
      </section>
      <section className="card" aria-labelledby="set-h">
        <div className="card__head"><h2 id="set-h">Definir orçamento de {formatMonth(month)}</h2></div>
        <div className="form">
          <Field label="Categoria">
            <select className="select" value={cat} onChange={(e) => { setCat(e.target.value); const b = state.finance.budgets.find((x) => x.categoryId === e.target.value && x.month === month); setAmount(b ? String(b.amount).replace('.', ',') : ''); }}>
              <option value="">Escolha…</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Valor planejado (R$)" hint="Use 0 para remover o orçamento da categoria."><input className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <button className="btn btn--primary" disabled={!cat} onClick={async () => { if (await dispatch({ type: 'budget/set', categoryId: cat, month, amount: parseNumber(amount || '0') })) { setCat(''); setAmount(''); } }}>Salvar orçamento</button>
        </div>
      </section>
    </div>
  );
}

function Overview({ month }: { month: string }) {
  const state = useAppState();
  const today = useToday();
  const series = monthlySeries(state, month, 6);
  const byCat = expenseByCategory(state, month);
  const next = upcoming(state, today, 6);
  const s = monthSummary(state, month);
  return (
    <div className="grid grid--2">
      <section className="card" aria-labelledby="ch-h">
        <div className="card__head"><h2 id="ch-h">Receitas × despesas realizadas</h2></div>
        <BarChart label="Receitas e despesas realizadas por mês" groups={series.map((m) => ({ label: formatMonth(m.month), a: m.incomeSettled, b: m.expenseSettled }))} format={money0} series={['Receitas', 'Despesas']} />
      </section>
      <section className="card" aria-labelledby="cat-h">
        <div className="card__head"><h2 id="cat-h">Despesas por categoria</h2></div>
        {byCat.length ? (
          <ul className="list">
            {byCat.map((c) => (
              <li key={c.name}><div className="list__main"><div className="list__title">{c.name}</div><Progress value={c.amount / byCat[0].amount} label={`Gasto em ${c.name}`} thin /></div><span className="tx-amount">{money0(c.amount)}</span></li>
            ))}
          </ul>
        ) : <p className="muted small">Sem despesas realizadas.</p>}
      </section>
      <section className="card" aria-labelledby="comp-h">
        <div className="card__head"><h2 id="comp-h">Composição das receitas</h2></div>
        <dl className="kv">
          <div><dt>Renda pessoal</dt><dd>{money0(s.personalIncome)}</dd></div>
          <div><dt>Faturamento (negócio)</dt><dd>{money0(s.businessRevenue)}</dd></div>
          <div><dt>Outras entradas</dt><dd>{money0(s.otherIncome)}</dd></div>
        </dl>
        <p className="xs muted" style={{ marginTop: 10 }}>Faturamento, lucro e renda líquida pessoal não são sinônimos. Metas de renda usam apenas a natureza escolhida.</p>
      </section>
      <section className="card" aria-labelledby="up-h">
        <div className="card__head"><h2 id="up-h">Próximos vencimentos e recebimentos</h2></div>
        {next.length ? (
          <ul className="list">
            {next.map((t) => (
              <li key={t.id}><div className="list__main"><div className="list__title">{t.description}</div><div className="list__meta">{formatDate(t.date)} · {TX_STATUS_LABEL[t.status]}</div></div><span className={`tx-amount ${t.type === 'income' ? 'in' : ''}`}>{t.type === 'income' ? '+' : '−'}{money0(t.amount)}</span></li>
            ))}
          </ul>
        ) : <p className="muted small">Nada previsto.</p>}
        <p className="xs muted" style={{ marginTop: 8 }}>Receitas variáveis ainda não recebidas não são tratadas como dinheiro disponível.</p>
      </section>
    </div>
  );
}

function Accounts() {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = useToday();
  const [edit, setEdit] = useState<Partial<Account> | null>(null);
  const [opening, setOpening] = useState('');
  return (
    <section className="card" aria-labelledby="acc-h">
      <div className="card__head">
        <h2 id="acc-h">Contas</h2>
        <button className="btn btn--sm spacer" onClick={() => { setEdit({ name: '', type: 'corrente' }); setOpening('0'); }}><LuPlus /> Conta</button>
      </div>
      <ul className="list">
        {state.finance.accounts.map((a) => (
          <li key={a.id}>
            <div className="list__main"><div className="list__title">{a.name}</div><div className="list__meta">{a.type} · saldo inicial {money(a.openingBalance)}</div></div>
            <span className="tx-amount">{money(accountBalance(state, a.id, today))}</span>
            <button className="icon-btn" aria-label={`Editar ${a.name}`} onClick={() => { setEdit(a); setOpening(String(a.openingBalance).replace('.', ',')); }}><LuPencil /></button>
          </li>
        ))}
      </ul>
      <p className="xs muted" style={{ marginTop: 8 }}>Saldo = saldo inicial + entradas realizadas − saídas realizadas.</p>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar conta' : 'Nova conta'} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn btn--primary" onClick={async () => { if (edit && await dispatch({ type: 'account/upsert', account: { id: edit.id, name: edit.name ?? '', type: edit.type ?? 'corrente', openingBalance: parseNumber(opening || '0') } })) setEdit(null); }}>Salvar</button></>}>
        {edit && (
          <div className="form">
            <Field label="Nome"><input className="input" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <div className="form-row">
              <Field label="Tipo">
                <select className="select" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as Account['type'] })}>
                  <option value="corrente">Conta corrente</option><option value="poupanca">Poupança</option><option value="investimento">Investimento</option><option value="carteira">Carteira</option><option value="cartao">Cartão</option>
                </select>
              </Field>
              <Field label="Saldo inicial (R$)"><input className="input num" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} /></Field>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

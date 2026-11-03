import { useState } from 'react';
import { LuArchive, LuArrowDownToLine, LuArrowUpFromLine, LuPencil, LuPiggyBank, LuPlus, LuTrash2 } from 'react-icons/lu';
import { navigate } from '../../app/router';
import { useAppState, useDispatch } from '../../app/store';
import { formatDate, formatMonth, monthKey } from '../../domain/dates';
import { boxStatus, freeCash, projectBox, savingsReminders, totalSaved, type BoxStatus } from '../../domain/savings';
import { totalBalance } from '../../domain/finance';
import type { SavingsBox, SavingsMove } from '../../domain/types';
import type { SavingsBoxDraft } from '../../domain/engine';
import { ConfirmButton, Empty, Field, Modal, Progress, Segmented } from '../../components/ui';
import { useToday } from '../../hooks/useGame';
import { money, money0, parseNumber } from '../../utils/format';

/** Faixa de cobrança: cofrinhos com valor pendente no mês. Usada no Início e em Finanças. */
export function SavingsReminder({ compact }: { compact?: boolean }) {
  const state = useAppState();
  const today = useToday();
  const pend = savingsReminders(state, today);
  if (!pend.length) return null;
  const total = pend.reduce((a, s) => a + s.pending, 0);
  const free = freeCash(state, today);
  return (
    <section className={`card savings-nudge ${compact ? 'savings-nudge--compact' : ''}`} role="status" aria-label="Cobrança da poupança">
      <LuPiggyBank aria-hidden="true" />
      <div className="list__main">
        <strong>Seu cofrinho está cobrando: faltam {money0(total)} este mês.</strong>
        <span className="small muted">
          {pend.map((s) => `${s.box.name}: ${money0(s.pending)}`).join(' · ')}
          {free > 0 ? ` · você tem ${money0(free)} livre agora` : ''}
        </span>
      </div>
      <button className="btn btn--sm btn--primary" onClick={() => navigate('/financas?aba=poupanca')}>Guardar agora</button>
    </section>
  );
}

export function SavingsView() {
  const state = useAppState();
  const today = useToday();
  const [boxForm, setBoxForm] = useState<{ open: boolean; box: SavingsBox | null }>({ open: false, box: null });
  const [moveForm, setMoveForm] = useState<{ box: SavingsBox; kind: 'in' | 'out'; move: SavingsMove | null } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const boxes = state.finance.savings.boxes.filter((b) => (showArchived ? true : b.status === 'active'));
  const statuses = boxes.map((b) => boxStatus(state, b, today));
  const saved = totalSaved(state, today);
  const balance = totalBalance(state, today);
  const free = freeCash(state, today);
  const archivedCount = state.finance.savings.boxes.filter((b) => b.status === 'archived').length;

  return (
    <div className="stack">
      <dl className="fin-top">
        <div className="stat"><dt>Em contas hoje</dt><dd>{money0(balance)}</dd><small>Saldo realizado de todas as contas</small></div>
        <div className="stat"><dt>Guardado nos cofrinhos</dt><dd>{money0(saved)}</dd><small>{statuses.length} cofrinho(s)</small></div>
        <div className="stat"><dt>Livre para gastar</dt><dd className={free < 0 ? 'negative' : ''}>{money0(free)}</dd><small>Em contas − guardado</small></div>
      </dl>
      <SavingsReminder compact />
      <section className="card" aria-labelledby="sv-h">
        <div className="card__head">
          <h2 id="sv-h"><LuPiggyBank aria-hidden="true" /> Cofrinhos</h2>
          <button className="btn btn--sm btn--primary spacer" onClick={() => setBoxForm({ open: true, box: null })}><LuPlus /> Cofrinho</button>
        </div>
        {statuses.length ? (
          <ul className="list savings-list">
            {statuses.map((s) => <BoxRow key={s.box.id} s={s} onMove={(kind) => setMoveForm({ box: s.box, kind, move: null })} onEdit={() => setBoxForm({ open: true, box: s.box })} />)}
          </ul>
        ) : (
          <Empty icon={<LuPiggyBank />}>Crie um cofrinho, como "Reserva de emergência", com quanto guardar por mês. O app cobra o que faltar.</Empty>
        )}
        {archivedCount > 0 && <label className="check small" style={{ marginTop: 8 }}><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Mostrar arquivados ({archivedCount})</label>}
        <p className="xs muted" style={{ marginTop: 8 }}>Cofrinhos separam parte do seu saldo, como envelopes. Se você também move o dinheiro para uma caixinha do banco, registre só aqui: não lance como despesa.</p>
      </section>
      <MovesHistory onEdit={(m) => { const box = state.finance.savings.boxes.find((b) => b.id === m.boxId); if (box) setMoveForm({ box, kind: m.amount > 0 ? 'in' : 'out', move: m }); }} />
      <BoxForm key={boxForm.box?.id ?? (boxForm.open ? 'novo' : 'fechado')} open={boxForm.open} box={boxForm.box} onClose={() => setBoxForm({ open: false, box: null })} />
      {moveForm && <MoveForm key={moveForm.move?.id ?? `${moveForm.box.id}-${moveForm.kind}`} {...moveForm} onClose={() => setMoveForm(null)} />}
    </div>
  );
}

function BoxRow({ s, onMove, onEdit }: { s: BoxStatus; onMove: (k: 'in' | 'out') => void; onEdit: () => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = useToday();
  const goal = s.box.goalId ? state.goals.find((g) => g.id === s.box.goalId) : null;
  const horizon = Math.min(60, Math.max(12, (s.monthsLeft ?? 0) + 1));
  const projection = projectBox(state, s.box, today, horizon);
  const reachMonth = s.box.targetAmount ? projection.find((p) => p.balance >= s.box.targetAmount!)?.month : undefined;
  const rule = s.box.ruleKind === 'fixed' ? `${money0(s.box.ruleAmount)} por mês` : s.box.ruleKind === 'percent' ? `${s.box.rulePercent}% da renda pessoal` : 'Sem regra mensal';
  const archived = s.box.status === 'archived';
  return (
    <li className={`savings-box ${archived ? 'is-archived' : ''}`}>
      <div className="savings-box__head">
        <div className="list__main">
          <div className="list__title">{s.box.name}{archived && <span className="chip chip--muted rel-linked">arquivado</span>}</div>
          <div className="list__meta"><span>{rule}</span>{goal && <span>Meta: {goal.title}</span>}</div>
        </div>
        <strong className="savings-box__balance">{money0(s.balance)}</strong>
      </div>
      {s.box.targetAmount ? (
        <>
          <Progress value={s.progress ?? 0} label={`Progresso de ${s.box.name}`} />
          <div className="list__meta"><span>{Math.round((s.progress ?? 0) * 100)}% de {money0(s.box.targetAmount)}</span>{s.box.targetDate && <span>até {formatDate(s.box.targetDate, { year: true })}</span>}</div>
        </>
      ) : null}
      {!archived && (
        <dl className="savings-box__facts">
          <div><dt>Este mês</dt><dd>{money0(s.deposited)} de {money0(s.quota.amount)}</dd></div>
          <div><dt>Falta guardar</dt><dd className={s.pending > 0 ? 'warn' : ''}>{s.pending > 0 ? money0(s.pending) : 'Em dia'}</dd></div>
          {s.requiredMonthly !== null && <div><dt>Para chegar na meta</dt><dd>{money0(s.requiredMonthly)}/mês</dd></div>}
          {s.box.targetAmount && <div><dt>Seguindo a regra</dt><dd>{reachMonth ? `chega em ${formatMonth(reachMonth, true)}` : `não chega em ${horizon} meses`}</dd></div>}
        </dl>
      )}
      {!archived && s.quota.basis === 'percent_planned' && <p className="xs muted">Cota calculada sobre a renda prevista ({money0(s.quota.income)}); é recalculada quando a renda entrar.</p>}
      {!archived && s.requiredMonthly !== null && s.box.ruleKind === 'fixed' && s.requiredMonthly > s.box.ruleAmount + 0.5 && (
        <p className="xs warn-text">Com {money0(s.box.ruleAmount)}/mês você não chega na meta no prazo. Seriam {money0(s.requiredMonthly)}/mês.</p>
      )}
      <div className="row">
        {!archived && <button className="btn btn--sm btn--primary" onClick={() => onMove('in')}><LuArrowDownToLine /> Guardar</button>}
        {!archived && s.balance > 0 && <button className="btn btn--sm" onClick={() => onMove('out')}><LuArrowUpFromLine /> Retirar</button>}
        <button className="icon-btn" aria-label={`Editar o cofrinho ${s.box.name}`} onClick={onEdit}><LuPencil /></button>
        <button className="icon-btn" aria-label={`${archived ? 'Reativar' : 'Arquivar'} ${s.box.name}`} onClick={() => dispatch({ type: 'savings/box/setStatus', boxId: s.box.id, status: archived ? 'active' : 'archived' })}><LuArchive /></button>
        {state.finance.savings.moves.every((m) => m.boxId !== s.box.id) && (
          <ConfirmButton className="icon-btn" ariaLabel={`Excluir ${s.box.name}`} confirmLabel="Excluir" onConfirm={() => dispatch({ type: 'savings/box/remove', boxId: s.box.id })}><LuTrash2 /></ConfirmButton>
        )}
      </div>
    </li>
  );
}

function MovesHistory({ onEdit }: { onEdit: (m: SavingsMove) => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const moves = [...state.finance.savings.moves].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  if (!moves.length) return null;
  const name = (id: string) => state.finance.savings.boxes.find((b) => b.id === id)?.name ?? 'Cofrinho';
  return (
    <section className="card" aria-labelledby="mv-h">
      <div className="card__head"><h2 id="mv-h">Histórico da poupança</h2></div>
      <ul className="list">
        {moves.slice(0, 60).map((m) => (
          <li key={m.id}>
            <div className="list__main"><div className="list__title">{m.amount > 0 ? 'Guardou' : 'Retirou'} · {name(m.boxId)}</div><div className="list__meta"><span>{formatDate(m.date, { year: true })}</span>{m.note && <span>{m.note}</span>}</div></div>
            <span className={`tx-amount ${m.amount > 0 ? 'in' : ''}`}>{m.amount > 0 ? '+' : '−'}{money(Math.abs(m.amount))}</span>
            <div className="list__end">
              <button className="icon-btn" aria-label={`Editar movimentação de ${formatDate(m.date)}`} onClick={() => onEdit(m)}><LuPencil /></button>
              <ConfirmButton className="icon-btn" ariaLabel={`Excluir movimentação de ${formatDate(m.date)}`} confirmLabel="Excluir" onConfirm={() => dispatch({ type: 'savings/move/remove', moveId: m.id })}><LuTrash2 /></ConfirmButton>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BoxForm({ open, box, onClose }: { open: boolean; box: SavingsBox | null; onClose: () => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = useToday();
  const goals = state.goals.filter((g) => g.status !== 'archived' && g.metricSource === 'manual' && g.unit.trim().toUpperCase() === 'R$');
  const [f, setF] = useState(() => ({
    name: box?.name ?? '', description: box?.description ?? '',
    target: box?.targetAmount ? String(box.targetAmount).replace('.', ',') : '', targetDate: box?.targetDate ?? '',
    ruleKind: (box?.ruleKind ?? 'fixed') as SavingsBox['ruleKind'], ruleAmount: box?.ruleAmount ? String(box.ruleAmount).replace('.', ',') : '', rulePercent: box?.rulePercent ? String(box.rulePercent) : '10',
    startMonth: box?.startMonth ?? monthKey(today), goalId: box?.goalId ?? '',
  }));
  const pickGoal = (goalId: string) => {
    const g = state.goals.find((x) => x.id === goalId);
    setF((p) => ({ ...p, goalId, ...(g && !box ? { name: p.name || g.title, target: String(g.targetValue).replace('.', ','), targetDate: g.targetDate ?? p.targetDate } : {}) }));
  };
  // Cálculo reverso para sugerir o valor mensal
  const target = parseNumber(f.target);
  const preview = target > 0 && f.targetDate ? boxStatus(state, { ...(box ?? ({} as SavingsBox)), id: box?.id ?? '__novo__', name: f.name, description: '', targetAmount: target, targetDate: f.targetDate, ruleKind: 'none', ruleAmount: 0, rulePercent: 0, startMonth: f.startMonth, goalId: null, status: 'active', createdAt: '' }, today) : null;
  const save = async () => {
    const draft: SavingsBoxDraft = {
      id: box?.id, name: f.name, description: f.description, targetAmount: target > 0 ? target : null, targetDate: f.targetDate || null,
      ruleKind: f.ruleKind, ruleAmount: parseNumber(f.ruleAmount), rulePercent: Number(f.rulePercent.replace(',', '.')) || 0, startMonth: f.startMonth, goalId: f.goalId || null,
    };
    if (await dispatch({ type: 'savings/box/upsert', box: draft })) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={box ? 'Editar cofrinho' : 'Novo cofrinho'} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={() => void save()}>Salvar</button></>}>
      <div className="form">
        {goals.length > 0 && (
          <Field label="Ligar a uma meta (opcional)" hint="Cada vez que você guardar, o resultado da meta é atualizado com o saldo do cofrinho.">
            <select className="select" value={f.goalId} onChange={(e) => pickGoal(e.target.value)}><option value="">Nenhuma</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select>
          </Field>
        )}
        <Field label="Nome"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Reserva de emergência" /></Field>
        <div className="form-row">
          <Field label="Meta de valor (opcional)"><input className="input num" inputMode="decimal" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="Ex.: 10.000" /></Field>
          <Field label="Prazo (opcional)"><input className="input" type="date" value={f.targetDate} onChange={(e) => setF({ ...f, targetDate: e.target.value })} /></Field>
        </div>
        {preview?.requiredMonthly != null && (
          <div className="note small savings-suggest">
            <span>Para chegar em {money0(target)} até {formatDate(f.targetDate, { year: true })}, guarde <strong>{money0(preview.requiredMonthly)} por mês</strong> ({preview.monthsLeft} meses).</span>
            <button type="button" className="btn btn--sm" onClick={() => setF({ ...f, ruleKind: 'fixed', ruleAmount: String(Math.ceil(preview.requiredMonthly!)) })}>Usar esse valor</button>
          </div>
        )}
        <fieldset className="field"><legend>Regra mensal</legend>
          <Segmented value={f.ruleKind} onChange={(ruleKind) => setF({ ...f, ruleKind })} label="Regra mensal" options={[{ value: 'fixed', label: 'Valor fixo' }, { value: 'percent', label: '% da renda' }, { value: 'none', label: 'Sem regra' }]} />
        </fieldset>
        {f.ruleKind === 'fixed' && <Field label="Guardar por mês (R$)"><input className="input num" inputMode="decimal" value={f.ruleAmount} onChange={(e) => setF({ ...f, ruleAmount: e.target.value })} /></Field>}
        {f.ruleKind === 'percent' && <Field label="Porcentagem da renda pessoal (%)" hint="Como um dízimo para você: calculado sobre a renda pessoal que entrar no mês (ou a prevista, antes de entrar)."><input className="input num" inputMode="decimal" value={f.rulePercent} onChange={(e) => setF({ ...f, rulePercent: e.target.value })} /></Field>}
        {f.ruleKind !== 'none' && <Field label="Começar a cobrar em"><input className="input" type="month" value={f.startMonth} onChange={(e) => setF({ ...f, startMonth: e.target.value })} /></Field>}
        <Field label="Observação (opcional)"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex.: fica na caixinha do Nubank" /></Field>
      </div>
    </Modal>
  );
}

function MoveForm({ box, kind, move, onClose }: { box: SavingsBox; kind: 'in' | 'out'; move: SavingsMove | null; onClose: () => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = useToday();
  const st = boxStatus(state, box, today);
  const [amount, setAmount] = useState(() => (move ? String(Math.abs(move.amount)).replace('.', ',') : kind === 'in' && st.pending > 0 ? String(st.pending).replace('.', ',') : ''));
  const [date, setDate] = useState(move?.date ?? today);
  const [note, setNote] = useState(move?.note ?? '');
  const save = async () => {
    const v = parseNumber(amount);
    if (await dispatch({ type: 'savings/move/upsert', move: { id: move?.id, boxId: box.id, date, amount: kind === 'in' ? v : -v, note } })) onClose();
  };
  return (
    <Modal open onClose={onClose} title={`${move ? 'Editar' : kind === 'in' ? 'Guardar em' : 'Retirar de'} ${box.name}`} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={() => void save()}>{kind === 'in' ? 'Guardar' : 'Retirar'}</button></>}>
      <div className="form">
        <Field label="Valor (R$)" hint={kind === 'in' && st.pending > 0 && !move ? `Falta guardar ${money(st.pending)} este mês.` : kind === 'out' ? `Saldo do cofrinho: ${money(st.balance)}` : undefined}>
          <input className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Data"><input className="input" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Observação (opcional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'in' ? 'Ex.: 10% do salário' : 'Ex.: emergência médica'} /></Field>
      </div>
    </Modal>
  );
}

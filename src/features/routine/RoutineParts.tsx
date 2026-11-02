import { useEffect, useState } from 'react';
import { LuCheck, LuEllipsis, LuTarget } from 'react-icons/lu';
import { useAppState, useDispatch } from '../../app/store';
import { addDays, formatDate, WEEKDAY_SHORT } from '../../domain/dates';
import type { HabitDraft } from '../../domain/engine';
import { dayAgenda, MISS_REASONS, STATUS_LABEL, type AgendaItem } from '../../domain/routine';
import type { Frequency, Habit, ISODate, MissReason, OccurrenceStatus, Task } from '../../domain/types';
import { Field, Modal, Segmented } from '../../components/ui';
import { useToday } from '../../hooks/useGame';

export function Tick({ state, label, onClick }: { state: OccurrenceStatus | 'pending' | 'done'; label: string; onClick: () => void }) {
  return (
    <span className="tick-wrap">
      <button type="button" role="checkbox" className="tick" aria-checked={state === 'done' ? true : state === 'partial' ? 'mixed' : false} data-state={state} aria-label={label} onClick={onClick}>
        <LuCheck />
      </button>
    </span>
  );
}

/** Lista do dia: ocorrências de hábitos + tarefas pontuais. */
export function AgendaList({ date, compact, onOpen, show = () => true }: { date: ISODate; compact?: boolean; onOpen?: (item: AgendaItem) => void; show?: (status: string) => boolean }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = useToday();
  const items = dayAgenda(state, date).filter((i) => show(i.status));
  const tasks = state.tasks.filter((t) => t.date === date && show(t.status));
  const future = date > today;
  const toggle = (item: AgendaItem) =>
    dispatch({ type: 'occurrence/set', occurrenceId: item.occurrenceId, status: item.status === 'done' ? 'pending' : 'done' });
  if (!items.length && !tasks.length) return null;
  return (
    <ul className="list agenda">
      {items.map((item) => {
        const goal = item.habit.goalId ? state.goals.find((g) => g.id === item.habit.goalId) : null;
        const muted = item.status === 'missed' || item.status === 'na' || item.status === 'rescheduled';
        return (
          <li key={item.occurrenceId} className={muted ? 'is-muted' : ''}>
            {future ? <span className="tick-wrap"><span className="tick" data-state="pending" aria-hidden="true" /></span> : (
              <Tick state={item.status} label={`${item.status === 'done' ? 'Desmarcar' : 'Concluir'}: ${item.habit.title}`} onClick={() => toggle(item)} />
            )}
            <div className="list__main">
              <div className={`list__title ${item.status === 'done' ? 'is-done' : ''}`}>{item.habit.title}</div>
              {!compact && (
                <div className="list__meta">
                  {item.habit.timeWindow && <span>{item.habit.timeWindow}</span>}
                  {item.habit.durationMin > 0 && <span>{item.habit.durationMin} min</span>}
                  {goal && <span className="row" style={{ gap: 3 }}><LuTarget aria-hidden="true" /> {goal.title}</span>}
                  {item.rescheduledFrom && <span>Reagendado de {formatDate(item.rescheduledFrom)}</span>}
                  {item.status !== 'pending' && item.status !== 'done' && <span className="strong">{STATUS_LABEL[item.status]}</span>}
                  {item.occurrence?.reason && <span>{MISS_REASONS.find((r) => r.id === item.occurrence?.reason)?.label}</span>}
                </div>
              )}
            </div>
            {onOpen && (
              <button type="button" className="icon-btn" aria-label={`Mais opções: ${item.habit.title}`} onClick={() => onOpen(item)}>
                <LuEllipsis />
              </button>
            )}
          </li>
        );
      })}
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} compact={compact} future={future} />
      ))}
    </ul>
  );
}

function TaskRow({ task, compact, future }: { task: Task; compact?: boolean; future: boolean }) {
  const dispatch = useDispatch();
  const state = useAppState();
  const goal = task.goalId ? state.goals.find((g) => g.id === task.goalId) : null;
  return (
    <li>
      {future ? <span className="tick-wrap"><span className="tick" data-state="pending" aria-hidden="true" /></span> : (
        <Tick state={task.status === 'done' ? 'done' : 'pending'} label={`${task.status === 'done' ? 'Reabrir' : 'Concluir'} tarefa: ${task.title}`} onClick={() => dispatch({ type: 'task/toggle', taskId: task.id })} />
      )}
      <div className="list__main">
        <div className={`list__title ${task.status === 'done' ? 'is-done' : ''}`}>{task.title}</div>
        {!compact && <div className="list__meta"><span className="tag">Tarefa</span>{goal && <span>{goal.title}</span>}</div>}
      </div>
    </li>
  );
}

/** Opções completas de registro de uma ocorrência. */
export function OccurrenceSheet({ item, onClose }: { item: AgendaItem | null; onClose: () => void }) {
  const dispatch = useDispatch();
  const today = useToday();
  const [status, setStatus] = useState<OccurrenceStatus | 'pending'>('done');
  const [reason, setReason] = useState<MissReason | ''>('');
  const [note, setNote] = useState('');
  const [duration, setDuration] = useState('');
  const [to, setTo] = useState('');
  useEffect(() => {
    if (!item) return;
    setStatus(item.status === 'pending' ? 'done' : item.status);
    setReason(item.occurrence?.reason ?? '');
    setNote(item.occurrence?.note ?? '');
    setDuration(String(item.occurrence?.durationMin ?? item.habit.durationMin ?? ''));
    setTo(addDays(item.date, 1));
  }, [item]);
  if (!item) return null;
  const isFuture = item.date > today;
  const options: { value: OccurrenceStatus | 'pending'; label: string }[] = [
    ...(isFuture ? [] : [{ value: 'done' as const, label: 'Concluída' }, { value: 'partial' as const, label: 'Parcial' }, { value: 'missed' as const, label: 'Não concluída' }]),
    ...(item.rescheduledFrom ? [] : [{ value: 'rescheduled' as const, label: 'Reagendar' }]),
    { value: 'na', label: 'Não aplicável' },
    ...(item.status !== 'pending' ? [{ value: 'pending' as const, label: 'Desfazer registro' }] : []),
  ];
  const needsReason = status === 'partial' || status === 'missed' || status === 'rescheduled';
  const save = async () => {
    const ok = await dispatch({
      type: 'occurrence/set', occurrenceId: item.occurrenceId, status, reason: needsReason ? (reason || null) : null, note,
      durationMin: status === 'done' || status === 'partial' ? Number(duration) || null : null, rescheduleTo: status === 'rescheduled' ? to : null,
    });
    if (ok) onClose();
  };
  return (
    <Modal open onClose={onClose} title={item.habit.title} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={save}>Salvar registro</button></>}>
      <div className="form">
        <p className="muted small">{formatDate(item.date, { year: true })} · {STATUS_LABEL[item.status]}</p>
        <fieldset className="field">
          <legend>Como foi?</legend>
          <Segmented value={status} onChange={setStatus} options={options} label="Status da ocorrência" />
        </fieldset>
        {needsReason && (
          <Field label="Motivo (opcional)" hint="Os motivos alimentam o diagnóstico da rotina — sem penalidades.">
            <select className="select" value={reason} onChange={(e) => setReason(e.target.value as MissReason)}>
              <option value="">Sem motivo informado</option>
              {MISS_REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>
        )}
        {status === 'rescheduled' && (
          <Field label="Nova data"><input className="input" type="date" value={to} min={addDays(item.date, 1)} onChange={(e) => setTo(e.target.value)} /></Field>
        )}
        {(status === 'done' || status === 'partial') && (
          <Field label="Duração real (min)"><input className="input" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ''))} /></Field>
        )}
        <Field label="Observação"><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" /></Field>
      </div>
    </Modal>
  );
}

const FREQ: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Todos os dias' },
  { value: 'weekdays', label: 'Dias úteis' },
  { value: 'custom', label: 'Dias específicos' },
];

export function HabitForm({ open, onClose, habit }: { open: boolean; onClose: () => void; habit?: Habit | null }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const blank: HabitDraft = { title: '', description: '', category: 'geral', frequency: 'daily', days: [], timeWindow: '', durationMin: 15, goalId: null };
  const [d, setD] = useState<HabitDraft>(blank);
  useEffect(() => {
    if (open) setD(habit ? { ...habit } : { ...blank, goalId: state.goals.find((g) => g.isPriority && g.status === 'active')?.id ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, habit]);
  const up = (patch: Partial<HabitDraft>) => setD((x) => ({ ...x, ...patch }));
  const save = async () => {
    const ok = await dispatch(habit ? { type: 'habit/update', habitId: habit.id, patch: d } : { type: 'habit/create', habit: d });
    if (ok) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={habit ? 'Editar hábito' : 'Novo hábito'} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={save}>Salvar</button></>}>
      <div className="form">
        <Field label="Nome"><input className="input" value={d.title} onChange={(e) => up({ title: e.target.value })} placeholder="Ex.: Estudar 1 hora" /></Field>
        <fieldset className="field">
          <legend>Frequência</legend>
          <Segmented value={d.frequency} onChange={(frequency) => up({ frequency })} options={FREQ} label="Frequência" />
        </fieldset>
        {d.frequency === 'custom' && (
          <fieldset className="field">
            <legend>Dias da semana</legend>
            <div className="daypicker">
              {WEEKDAY_SHORT.map((w, i) => (
                <button type="button" key={w} aria-pressed={d.days.includes(i)} aria-label={w} onClick={() => up({ days: d.days.includes(i) ? d.days.filter((x) => x !== i) : [...d.days, i] })}>{w.slice(0, 1)}</button>
              ))}
            </div>
          </fieldset>
        )}
        <div className="form-row">
          <Field label="Horário ou janela"><input className="input" value={d.timeWindow} onChange={(e) => up({ timeWindow: e.target.value })} placeholder="Ex.: 07:00" /></Field>
          <Field label="Duração (min)"><input className="input" inputMode="numeric" value={String(d.durationMin)} onChange={(e) => up({ durationMin: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></Field>
        </div>
        <div className="form-row">
          <Field label="Categoria"><input className="input" value={d.category} onChange={(e) => up({ category: e.target.value })} /></Field>
          <Field label="Objetivo relacionado" hint="Sem objetivo, o avanço vai para a jornada prioritária.">
            <select className="select" value={d.goalId ?? ''} onChange={(e) => up({ goalId: e.target.value || null })}>
              <option value="">Nenhum</option>
              {state.goals.filter((g) => g.status === 'active').map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Descrição"><textarea className="textarea" value={d.description} onChange={(e) => up({ description: e.target.value })} placeholder="Opcional" /></Field>
      </div>
    </Modal>
  );
}

export function TaskForm({ open, onClose, defaultDone = false, title = 'Nova tarefa' }: { open: boolean; onClose: () => void; defaultDone?: boolean; title?: string }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = useToday();
  const [name, setName] = useState('');
  const [date, setDate] = useState(today);
  const [goalId, setGoalId] = useState('');
  const [done, setDone] = useState(defaultDone);
  useEffect(() => {
    if (open) {
      setName('');
      setDate(today);
      setGoalId(state.goals.find((g) => g.isPriority && g.status === 'active')?.id ?? '');
      setDone(defaultDone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const save = async () => {
    const ok = await dispatch({ type: 'task/create', title: name, date, goalId: goalId || null, done: done && date <= today });
    if (ok) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={save}>{done ? 'Registrar ação' : 'Planejar'}</button></>}>
      <div className="form">
        <Field label="O que você fez ou vai fazer?"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Enviar proposta para cliente" /></Field>
        <div className="form-row">
          <Field label="Data"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Objetivo">
            <select className="select" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">Nenhum</option>
              {state.goals.filter((g) => g.status === 'active').map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </Field>
        </div>
        <label className="check"><input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} disabled={date > today} /> Já concluída</label>
      </div>
    </Modal>
  );
}

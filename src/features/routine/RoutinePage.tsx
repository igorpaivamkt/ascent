import { useState } from 'react';
import { LuChevronLeft, LuChevronRight, LuListChecks, LuPause, LuPencil, LuPlay, LuPlus, LuRepeat, LuTrash2 } from 'react-icons/lu';
import { useAppState, useDispatch } from '../../app/store';
import { addDays, formatDate, formatLongDate } from '../../domain/dates';
import { dayAgenda, frequencyLabel, MISS_REASONS, missReasonCounts, routineStats, streaks, type AgendaItem } from '../../domain/routine';
import type { Habit } from '../../domain/types';
import { ConfirmButton, Empty, Progress, Segmented, Tabs } from '../../components/ui';
import { useToday } from '../../hooks/useGame';
import { integer, percent } from '../../utils/format';
import { AgendaList, HabitForm, OccurrenceSheet, TaskForm } from './RoutineParts';

type View = 'dia' | 'habitos' | 'metricas';
type Filter = 'todos' | 'pendentes' | 'concluidos' | 'outros';

export function RoutinePage() {
  const state = useAppState();
  const today = useToday();
  const [view, setView] = useState<View>('dia');
  const [date, setDate] = useState(today);
  const [filter, setFilter] = useState<Filter>('todos');
  const [sheet, setSheet] = useState<AgendaItem | null>(null);
  const [habitForm, setHabitForm] = useState<{ open: boolean; habit: Habit | null }>({ open: false, habit: null });
  const [taskForm, setTaskForm] = useState(false);

  const agenda = dayAgenda(state, date);
  const dayDone = agenda.filter((i) => i.status === 'done').length;
  const dayTotal = agenda.filter((i) => i.status !== 'na' && i.status !== 'rescheduled').length;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Rotina</h1>
          <p>Compromissos concretos, registrados sem culpa. Cada conclusão move seu personagem.</p>
        </div>
        <div className="page-head__actions">
          <button className="btn" onClick={() => setTaskForm(true)}><LuPlus /> Tarefa</button>
          <button className="btn btn--primary" onClick={() => setHabitForm({ open: true, habit: null })}><LuRepeat /> Novo hábito</button>
        </div>
      </header>
      <Tabs value={view} onChange={setView} label="Visões da rotina" options={[{ value: 'dia', label: 'Dia' }, { value: 'habitos', label: 'Hábitos' }, { value: 'metricas', label: 'Métricas' }]} />

      {view === 'dia' && (
        <div className="grid grid--2">
          <section className="card" aria-labelledby="day-h">
            <div className="day-nav">
              <button className="icon-btn icon-btn--bordered" aria-label="Dia anterior" onClick={() => setDate(addDays(date, -1))}><LuChevronLeft /></button>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <h2 id="day-h">{date === today ? 'Hoje' : formatLongDate(date)}</h2>
                <p className="small muted">{date === today ? formatLongDate(date) : <button className="btn btn--ghost btn--sm" onClick={() => setDate(today)}>Voltar para hoje</button>}</p>
              </div>
              <button className="icon-btn icon-btn--bordered" aria-label="Próximo dia" onClick={() => setDate(addDays(date, 1))}><LuChevronRight /></button>
            </div>
            <div className="progress-row" style={{ margin: '14px 0 10px' }}>
              <Progress value={dayTotal ? dayDone / dayTotal : 0} label="Progresso do dia" />
              <span className="num">{dayDone}/{dayTotal}</span>
            </div>
            <Segmented value={filter} onChange={setFilter} label="Filtrar por status" options={[{ value: 'todos', label: 'Todos' }, { value: 'pendentes', label: 'Pendentes' }, { value: 'concluidos', label: 'Concluídos' }, { value: 'outros', label: 'Outros' }]} />
            <div style={{ marginTop: 8 }}>
              <FilteredAgenda date={date} filter={filter} onOpen={setSheet} />
            </div>
            {date > today && <p className="note small" style={{ marginTop: 10 }}>Dias futuros podem ser reagendados ou marcados como não aplicáveis, mas não concluídos.</p>}
          </section>
          <WeekStrip date={date} onPick={setDate} />
        </div>
      )}

      {view === 'habitos' && <HabitList onEdit={(habit) => setHabitForm({ open: true, habit })} />}
      {view === 'metricas' && <RoutineMetrics />}

      <OccurrenceSheet item={sheet} onClose={() => setSheet(null)} />
      <HabitForm open={habitForm.open} habit={habitForm.habit} onClose={() => setHabitForm({ open: false, habit: null })} />
      <TaskForm open={taskForm} onClose={() => setTaskForm(false)} />
    </>
  );
}

function FilteredAgenda({ date, filter, onOpen }: { date: string; filter: Filter; onOpen: (i: AgendaItem) => void }) {
  const state = useAppState();
  const show = (s: string) => filter === 'todos' || (filter === 'pendentes' && s === 'pending') || (filter === 'concluidos' && s === 'done') || (filter === 'outros' && s !== 'pending' && s !== 'done');
  const any = dayAgenda(state, date).some((i) => show(i.status)) || state.tasks.some((t) => t.date === date && show(t.status));
  if (!any) return <Empty icon={<LuListChecks />}>Nada {filter === 'todos' ? 'programado' : 'neste filtro'} para este dia.</Empty>;
  return <AgendaList date={date} onOpen={onOpen} show={show} />;
}

function WeekStrip({ date, onPick }: { date: string; onPick: (d: string) => void }) {
  const state = useAppState();
  const today = useToday();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const st = streaks(state, today);
  return (
    <section className="card" aria-labelledby="week-h">
      <div className="card__head"><h2 id="week-h">Últimos 7 dias</h2></div>
      <div className="week">
        {days.map((d) => {
          const s = routineStats(state, d, d, today);
          const ratio = s.eligible ? s.done / s.eligible : 0;
          return (
            <button key={d} type="button" className={`week__day ${d === date ? 'is-current' : ''}`} onClick={() => onPick(d)} aria-label={`${formatDate(d)}: ${s.done} de ${s.eligible} concluídas`}>
              <span className="week__bar"><span style={{ height: `${Math.round(ratio * 100)}%` }} /></span>
              <span className="xs">{formatDate(d).slice(0, 2)}</span>
            </button>
          );
        })}
      </div>
      <dl className="kv" style={{ marginTop: 16 }}>
        <div><dt>Sequência atual</dt><dd>{st.current} {st.current === 1 ? 'dia' : 'dias'}</dd></div>
        <div><dt>Melhor sequência</dt><dd>{st.best} {st.best === 1 ? 'dia' : 'dias'}</dd></div>
      </dl>
      <p className="small muted" style={{ marginTop: 10 }}>Perder uma sequência não apaga sua evolução histórica.</p>
    </section>
  );
}

function HabitList({ onEdit }: { onEdit: (h: Habit) => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const groups: { label: string; items: Habit[] }[] = [
    { label: 'Ativos', items: state.habits.filter((h) => h.status === 'active') },
    { label: 'Pausados', items: state.habits.filter((h) => h.status === 'paused') },
    { label: 'Arquivados', items: state.habits.filter((h) => h.status === 'archived') },
  ];
  if (!state.habits.length) return <section className="card"><Empty icon={<LuRepeat />}>Nenhum hábito ainda. Crie o primeiro para começar a registrar a rotina.</Empty></section>;
  return (
    <div className="stack">
      {groups.filter((g) => g.items.length).map((g) => (
        <section key={g.label} className="card" aria-label={g.label}>
          <div className="card__head"><h2>{g.label}</h2></div>
          <ul className="list">
            {g.items.map((h) => {
              const goal = h.goalId ? state.goals.find((x) => x.id === h.goalId) : null;
              return (
                <li key={h.id}>
                  <div className="list__main">
                    <div className="list__title">{h.title}</div>
                    <div className="list__meta"><span>{frequencyLabel(h)}</span>{h.durationMin > 0 && <span>{h.durationMin} min</span>}{h.timeWindow && <span>{h.timeWindow}</span>}<span>{goal ? goal.title : 'Jornada prioritária'}</span></div>
                  </div>
                  <div className="list__end">
                    <button className="icon-btn" aria-label={`Editar ${h.title}`} onClick={() => onEdit(h)}><LuPencil /></button>
                    {h.status === 'active' ? (
                      <button className="icon-btn" aria-label={`Pausar ${h.title}`} onClick={() => dispatch({ type: 'habit/setStatus', habitId: h.id, status: 'paused' })}><LuPause /></button>
                    ) : (
                      <button className="icon-btn" aria-label={`Reativar ${h.title}`} onClick={() => dispatch({ type: 'habit/setStatus', habitId: h.id, status: 'active' })}><LuPlay /></button>
                    )}
                    <ConfirmButton className="icon-btn" ariaLabel={`Remover ${h.title}`} confirmLabel="Remover" onConfirm={() => dispatch({ type: 'habit/remove', habitId: h.id })}><LuTrash2 /></ConfirmButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="small muted">Hábitos com registros são arquivados em vez de apagados, para preservar o histórico.</p>
    </div>
  );
}

function RoutineMetrics() {
  const state = useAppState();
  const today = useToday();
  const last7 = routineStats(state, addDays(today, -6), today, today);
  const prev7 = routineStats(state, addDays(today, -13), addDays(today, -7), today);
  const last30 = routineStats(state, addDays(today, -29), today, today);
  const reasons = missReasonCounts(state, addDays(today, -29), today);
  const st = streaks(state, today);
  const delta = last7.rate !== null && prev7.rate !== null ? last7.rate - prev7.rate : null;
  return (
    <div className="grid grid--2">
      <section className="card" aria-labelledby="m-h">
        <div className="card__head"><h2 id="m-h">Execução</h2></div>
        <dl className="kv">
          <div><dt>Taxa (7 dias)</dt><dd>{percent(last7.rate)}</dd></div>
          <div><dt>Semana anterior</dt><dd>{percent(prev7.rate)}</dd></div>
          <div><dt>Taxa (30 dias)</dt><dd>{percent(last30.rate)}</dd></div>
          <div><dt>Concluídas (30d)</dt><dd>{integer(last30.done)} de {integer(last30.eligible)}</dd></div>
          <div><dt>Parciais (30d)</dt><dd>{integer(last30.partial)}</dd></div>
          <div><dt>Tempo investido (30d)</dt><dd>{integer(Math.round(last30.minutes / 60))} h</dd></div>
          <div><dt>Sequência atual</dt><dd>{st.current} d</dd></div>
          <div><dt>Melhor sequência</dt><dd>{st.best} d</dd></div>
        </dl>
        {delta !== null && (
          <p className="note small" style={{ marginTop: 14 }}>
            Cálculo determinístico: a taxa de conclusão dos últimos 7 dias {delta >= 0 ? 'subiu' : 'caiu'} {percent(Math.abs(delta))} em relação à semana anterior ({last7.done}/{last7.eligible} vs {prev7.done}/{prev7.eligible}).
          </p>
        )}
        <p className="small muted" style={{ marginTop: 10 }}>Taxa = concluídas ÷ elegíveis. "Não aplicável" e "reagendada" saem do denominador; o dia de hoje só conta o que já foi registrado.</p>
      </section>
      <section className="card" aria-labelledby="r-h">
        <div className="card__head"><h2 id="r-h">Motivos de não execução (30 dias)</h2></div>
        {reasons.length ? (
          <ul className="list">
            {reasons.map((r) => (
              <li key={r.reason}>
                <div className="list__main">
                  <div className="list__title">{MISS_REASONS.find((m) => m.id === r.reason)?.label}</div>
                  <Progress value={r.count / reasons[0].count} label={`Frequência: ${r.reason}`} thin />
                </div>
                <span className="strong num">{r.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Nenhum motivo registrado. Ao marcar uma ocorrência como parcial ou não concluída, você pode informar o motivo.</p>
        )}
      </section>
    </div>
  );
}

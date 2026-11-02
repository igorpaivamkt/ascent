import { useEffect, useMemo, useState } from 'react';
import { LuChevronLeft, LuChevronRight, LuNotebookPen } from 'react-icons/lu';
import { useAppState, useDispatch } from '../../app/store';
import { getAchievement } from '../../domain/achievements';
import { XP_RULES } from '../../domain/config';
import { addDays, formatDate, weekStart } from '../../domain/dates';
import { routineStats } from '../../domain/routine';
import { Field } from '../../components/ui';
import { useToday } from '../../hooks/useGame';
import { metric, money0, percent } from '../../utils/format';

export function ReviewPage() {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = useToday();
  const [ws, setWs] = useState(weekStart(today));
  const we = addDays(ws, 6);
  const existing = state.reviews.find((r) => r.weekStart === ws);
  const [highlights, setHighlights] = useState('');
  const [obstacles, setObstacles] = useState('');
  const [priorities, setPriorities] = useState('');
  useEffect(() => {
    setHighlights(existing?.highlights ?? '');
    setObstacles(existing?.obstacles ?? '');
    setPriorities(existing?.priorities ?? '');
  }, [ws, existing]);

  const data = useMemo(() => {
    const inWeek = (iso: string) => iso.slice(0, 10) >= ws && iso.slice(0, 10) <= we;
    const st = routineStats(state, ws, we, today);
    const tasksPlanned = state.tasks.filter((t) => t.date >= ws && t.date <= we);
    const achievements = state.achievements.filter((a) => inWeek(a.unlockedAt));
    const xp = state.xpEvents.filter((e) => inWeek(e.at)).reduce((a, e) => a + e.amount, 0);
    const obs = state.observations.filter((o) => o.source !== 'baseline' && o.date >= ws && o.date <= we);
    const txs = state.finance.transactions.filter((t) => t.status === 'settled' && t.date >= ws && t.date <= we);
    const income = txs.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
    const expense = txs.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
    const missed = state.occurrences.filter((o) => o.date >= ws && o.date <= we && (o.status === 'missed' || o.status === 'partial'));
    const steps = state.steps.filter((s) => s.completedAt && inWeek(s.completedAt));
    return { st, tasksPlanned, achievements, xp, obs, income, expense, missed, steps };
  }, [state, ws, we, today]);

  const save = () => dispatch({ type: 'review/save', weekStart: ws, highlights, obstacles, priorities });

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Revisão semanal</h1>
          <p>Planejado × executado × resultado. Aprender e ajustar faz parte da subida.</p>
        </div>
        <div className="month-nav">
          <button className="icon-btn icon-btn--bordered" aria-label="Semana anterior" onClick={() => setWs(addDays(ws, -7))}><LuChevronLeft /></button>
          <strong>{formatDate(ws)} – {formatDate(we)}</strong>
          <button className="icon-btn icon-btn--bordered" aria-label="Próxima semana" disabled={addDays(ws, 7) > today} onClick={() => setWs(addDays(ws, 7))}><LuChevronRight /></button>
        </div>
      </header>
      <div className="grid grid--2">
        <section className="card" aria-labelledby="rv-h">
          <div className="card__head"><h2 id="rv-h">O que os dados mostram</h2></div>
          <dl className="kv">
            <div><dt>Ocorrências planejadas</dt><dd>{data.st.eligible}</dd></div>
            <div><dt>Concluídas</dt><dd>{data.st.done}</dd></div>
            <div><dt>Parciais</dt><dd>{data.st.partial}</dd></div>
            <div><dt>Taxa de conclusão</dt><dd>{percent(data.st.rate)}</dd></div>
            <div><dt>Tarefas concluídas</dt><dd>{data.tasksPlanned.filter((t) => t.status === 'done').length}/{data.tasksPlanned.length}</dd></div>
            <div><dt>Microetapas</dt><dd>{data.steps.length}</dd></div>
            <div><dt>XP na semana</dt><dd>{data.xp}</dd></div>
            <div><dt>Entradas/saídas realizadas</dt><dd className="small">+{money0(data.income)} / −{money0(data.expense)}</dd></div>
          </dl>
          {data.achievements.length > 0 && (
            <>
              <h3 className="small muted" style={{ margin: '14px 0 6px' }}>Conquistas desbloqueadas</h3>
              <div className="row">{data.achievements.map((a) => <span key={a.code} className="chip">{getAchievement(a.code)?.title}</span>)}</div>
            </>
          )}
          {data.obs.length > 0 && (
            <>
              <h3 className="small muted" style={{ margin: '14px 0 6px' }}>Resultados medidos</h3>
              <ul className="list small">{data.obs.map((o) => { const g = state.goals.find((x) => x.id === o.goalId); return <li key={o.id}><div className="list__main">{g?.title}</div><strong>{g ? metric(o.value, g.unit) : o.value}</strong></li>; })}</ul>
            </>
          )}
          {data.missed.length > 0 && (
            <>
              <h3 className="small muted" style={{ margin: '14px 0 6px' }}>Não concluídas ou parciais</h3>
              <ul className="list small">{data.missed.slice(0, 6).map((o) => <li key={o.id}><div className="list__main">{state.habits.find((h) => h.id === o.habitId)?.title ?? 'Hábito removido'}</div><span className="muted">{formatDate(o.date)}{o.reason ? ` · ${o.reason}` : ''}</span></li>)}</ul>
            </>
          )}
        </section>
        <section className="card" aria-labelledby="rf-h">
          <div className="card__head"><h2 id="rf-h"><LuNotebookPen aria-hidden="true" /> Sua reflexão</h2>{existing && <span className="tag tag--ink spacer">Concluída</span>}</div>
          <div className="form">
            <Field label="O que funcionou?"><textarea className="textarea" value={highlights} onChange={(e) => setHighlights(e.target.value)} /></Field>
            <Field label="O que atrapalhou?"><textarea className="textarea" value={obstacles} onChange={(e) => setObstacles(e.target.value)} /></Field>
            <Field label="Prioridades da próxima semana"><textarea className="textarea" value={priorities} onChange={(e) => setPriorities(e.target.value)} /></Field>
            <button className="btn btn--primary" onClick={save}>{existing ? 'Atualizar revisão' : `Concluir revisão (+${XP_RULES.weeklyReview} XP)`}</button>
            <p className="xs muted">A recompensa é concedida uma vez por semana. Editar depois não gera XP extra.</p>
          </div>
        </section>
      </div>
      {state.reviews.length > 0 && (
        <section className="card" style={{ marginTop: 16 }} aria-labelledby="past-h">
          <div className="card__head"><h2 id="past-h">Revisões anteriores</h2></div>
          <ul className="list">
            {[...state.reviews].sort((a, b) => b.weekStart.localeCompare(a.weekStart)).map((r) => (
              <li key={r.id} style={{ alignItems: 'flex-start' }}>
                <div className="list__main">
                  <button className="btn btn--ghost btn--sm" style={{ padding: 0 }} onClick={() => setWs(r.weekStart)}>Semana de {formatDate(r.weekStart, { year: true })}</button>
                  <div className="list__meta">{r.done}/{r.planned} concluídas · {percent(r.rate)}</div>
                  {r.priorities && <p className="small" style={{ marginTop: 4 }}>Prioridades: {r.priorities}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { LuChevronLeft, LuChevronRight, LuFileDown, LuNotebookPen, LuTrash2 } from 'react-icons/lu';
import { navigate } from '../../app/router';
import { useAppState, useDispatch } from '../../app/store';
import { getAchievement } from '../../domain/achievements';
import { XP_RULES } from '../../domain/config';
import { addDays, addMonths, formatDate, formatMonth, monthKey, weekStart } from '../../domain/dates';
import { rangeSummary } from '../../domain/finance';
import { routineStats } from '../../domain/routine';
import type { AppState, ISODate } from '../../domain/types';
import { ConfirmButton, Field, Segmented } from '../../components/ui';
import { lastDayOfMonth, PeriodPicker, type Period } from '../../components/PeriodPicker';
import { useToday } from '../../hooks/useGame';
import { metric, money0, percent } from '../../utils/format';

type Mode = 'semana' | 'mes' | 'periodo';

/** Tudo o que aconteceu num período: rotina, metas, finanças, poupança e relacionamento. */
export function periodData(state: AppState, from: ISODate, to: ISODate, today: ISODate) {
  const inRange = (iso: string) => iso.slice(0, 10) >= from && iso.slice(0, 10) <= to;
  const st = routineStats(state, from, to, today);
  const tasksPlanned = state.tasks.filter((t) => t.date >= from && t.date <= to);
  const achievements = state.achievements.filter((a) => inRange(a.unlockedAt));
  const xp = state.xpEvents.filter((e) => inRange(e.at)).reduce((a, e) => a + e.amount, 0);
  const obs = state.observations.filter((o) => o.source !== 'baseline' && o.date >= from && o.date <= to);
  const fin = rangeSummary(state, from, to);
  const missed = state.occurrences.filter((o) => o.date >= from && o.date <= to && (o.status === 'missed' || o.status === 'partial'));
  const steps = state.steps.filter((s) => s.completedAt && inRange(s.completedAt));
  const saved = state.finance.savings.moves.filter((m) => m.date >= from && m.date <= to).reduce((a, m) => a + m.amount, 0);
  const experiences = state.relationship.experiences.filter((e) => e.date >= from && e.date <= to);
  const relSpent = state.relationship.expenses.filter((e) => e.date >= from && e.date <= to).reduce((a, e) => a + e.amount, 0);
  const milestones = state.milestones.filter((m) => m.reachedAt && inRange(m.reachedAt));
  return { st, tasksPlanned, achievements, xp, obs, fin, missed, steps, saved, experiences, relSpent, milestones };
}

export function ReviewPage() {
  const state = useAppState();
  const today = useToday();
  const [mode, setMode] = useState<Mode>('semana');
  const [ws, setWs] = useState(weekStart(today));
  const [month, setMonth] = useState(monthKey(today));
  const [period, setPeriod] = useState<Period>({ from: `${addMonths(monthKey(today), -2)}-01`, to: today });
  const range: Period = mode === 'semana' ? { from: ws, to: addDays(ws, 6) } : mode === 'mes' ? { from: `${month}-01`, to: lastDayOfMonth(month) } : period;
  const data = useMemo(() => periodData(state, range.from, range.to, today), [state, range.from, range.to, today]);
  const label = mode === 'semana' ? 'da semana' : mode === 'mes' ? 'do mês' : 'do período';

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Revisão</h1>
          <p>Planejado × executado × resultado. Aprender e ajustar faz parte da subida.</p>
        </div>
        <div className="page-head__actions">
          <button className="btn" onClick={() => navigate(`/relatorio/revisao?de=${range.from}&ate=${range.to}`)}><LuFileDown /> Exportar</button>
        </div>
      </header>
      <div className="period-bar">
        <Segmented<Mode> value={mode} onChange={setMode} label="Período da revisão" options={[{ value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mês' }, { value: 'periodo', label: 'Período livre' }]} />
        {mode === 'semana' && (
          <div className="month-nav">
            <button className="icon-btn icon-btn--bordered" aria-label="Semana anterior" onClick={() => setWs(addDays(ws, -7))}><LuChevronLeft /></button>
            <strong>{formatDate(ws)} – {formatDate(addDays(ws, 6))}</strong>
            <button className="icon-btn icon-btn--bordered" aria-label="Próxima semana" disabled={addDays(ws, 7) > today} onClick={() => setWs(addDays(ws, 7))}><LuChevronRight /></button>
          </div>
        )}
        {mode === 'mes' && (
          <div className="month-nav">
            <button className="icon-btn icon-btn--bordered" aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}><LuChevronLeft /></button>
            <strong>{formatMonth(month, true)}</strong>
            <button className="icon-btn icon-btn--bordered" aria-label="Próximo mês" disabled={addMonths(month, 1) > monthKey(today)} onClick={() => setMonth(addMonths(month, 1))}><LuChevronRight /></button>
          </div>
        )}
        {mode === 'periodo' && <PeriodPicker value={period} onChange={setPeriod} today={today} />}
      </div>
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
            <div><dt>XP {label}</dt><dd>{data.xp}</dd></div>
            <div><dt>Marcos alcançados</dt><dd>{data.milestones.length}</dd></div>
          </dl>
          <h3 className="small muted review-sub">Dinheiro</h3>
          <dl className="kv">
            <div><dt>Entrou</dt><dd className="small">+{money0(data.fin.incomeSettled)}</dd></div>
            <div><dt>Saiu</dt><dd className="small">−{money0(data.fin.expenseSettled)}</dd></div>
            <div><dt>Saldo</dt><dd className={`small ${data.fin.balanceSettled < 0 ? 'negative' : ''}`}>{money0(data.fin.balanceSettled)}</dd></div>
            <div><dt>Guardado</dt><dd className="small">{money0(data.saved)}</dd></div>
          </dl>
          {data.fin.byCategory.length > 0 && <p className="xs muted" style={{ marginTop: 6 }}>Maiores saídas: {data.fin.byCategory.slice(0, 3).map((c) => `${c.name} ${money0(c.amount)}`).join(' · ')}</p>}
          {(data.experiences.length > 0 || data.relSpent > 0) && (
            <>
              <h3 className="small muted review-sub">Relacionamento</h3>
              <p className="small">{data.experiences.length} experiência(s) · {money0(data.relSpent)} em gastos</p>
            </>
          )}
          {data.achievements.length > 0 && (
            <>
              <h3 className="small muted review-sub">Conquistas desbloqueadas</h3>
              <div className="row">{data.achievements.map((a) => <span key={a.code} className="chip">{getAchievement(a.code)?.title}</span>)}</div>
            </>
          )}
          {data.obs.length > 0 && (
            <>
              <h3 className="small muted review-sub">Resultados medidos</h3>
              <ul className="list small">{data.obs.slice(-8).map((o) => { const g = state.goals.find((x) => x.id === o.goalId); return <li key={o.id}><div className="list__main">{g?.title}</div><strong>{g ? metric(o.value, g.unit) : o.value}</strong></li>; })}</ul>
            </>
          )}
          {data.missed.length > 0 && (
            <>
              <h3 className="small muted review-sub">Não concluídas ou parciais</h3>
              <ul className="list small">{data.missed.slice(0, 6).map((o) => <li key={o.id}><div className="list__main">{state.habits.find((h) => h.id === o.habitId)?.title ?? 'Hábito removido'}</div><span className="muted">{formatDate(o.date)}{o.reason ? ` · ${o.reason}` : ''}</span></li>)}</ul>
            </>
          )}
        </section>
        {mode === 'semana' ? <WeekReflection ws={ws} /> : <PeriodReflection key={`${range.from}:${range.to}`} from={range.from} to={range.to} defaultTitle={mode === 'mes' ? `Revisão de ${formatMonth(month, true)}` : ''} />}
      </div>
      <PastReviews onWeek={(w) => { setMode('semana'); setWs(w); }} onPeriod={(p) => { setMode('periodo'); setPeriod(p); }} />
    </>
  );
}

function WeekReflection({ ws }: { ws: ISODate }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const existing = state.reviews.find((r) => r.weekStart === ws);
  const [highlights, setHighlights] = useState('');
  const [obstacles, setObstacles] = useState('');
  const [priorities, setPriorities] = useState('');
  useEffect(() => {
    setHighlights(existing?.highlights ?? '');
    setObstacles(existing?.obstacles ?? '');
    setPriorities(existing?.priorities ?? '');
  }, [ws, existing]);
  return (
    <section className="card" aria-labelledby="rf-h">
      <div className="card__head"><h2 id="rf-h"><LuNotebookPen aria-hidden="true" /> Sua reflexão</h2>{existing && <span className="tag tag--ink spacer">Concluída</span>}</div>
      <div className="form">
        <Field label="O que funcionou?"><textarea className="textarea" value={highlights} onChange={(e) => setHighlights(e.target.value)} /></Field>
        <Field label="O que atrapalhou?"><textarea className="textarea" value={obstacles} onChange={(e) => setObstacles(e.target.value)} /></Field>
        <Field label="Prioridades da próxima semana"><textarea className="textarea" value={priorities} onChange={(e) => setPriorities(e.target.value)} /></Field>
        <button className="btn btn--primary" onClick={() => dispatch({ type: 'review/save', weekStart: ws, highlights, obstacles, priorities })}>{existing ? 'Atualizar revisão' : `Concluir revisão (+${XP_RULES.weeklyReview} XP)`}</button>
        <p className="xs muted">A recompensa é concedida uma vez por semana. Editar depois não gera XP extra.</p>
      </div>
    </section>
  );
}

function PeriodReflection({ from, to, defaultTitle }: { from: ISODate; to: ISODate; defaultTitle: string }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const existing = state.periodReviews.find((r) => r.from === from && r.to === to);
  const [title, setTitle] = useState(existing?.title ?? defaultTitle);
  const [highlights, setHighlights] = useState(existing?.highlights ?? '');
  const [obstacles, setObstacles] = useState(existing?.obstacles ?? '');
  const [priorities, setPriorities] = useState(existing?.priorities ?? '');
  return (
    <section className="card" aria-labelledby="rfp-h">
      <div className="card__head"><h2 id="rfp-h"><LuNotebookPen aria-hidden="true" /> Revisão geral</h2>{existing && <span className="tag tag--ink spacer">Salva</span>}</div>
      <p className="small muted">{formatDate(from, { year: true })} a {formatDate(to, { year: true })}</p>
      <div className="form">
        <Field label="Título (opcional)"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Primeiro trimestre em São Paulo" /></Field>
        <Field label="O que funcionou?"><textarea className="textarea" value={highlights} onChange={(e) => setHighlights(e.target.value)} /></Field>
        <Field label="O que atrapalhou?"><textarea className="textarea" value={obstacles} onChange={(e) => setObstacles(e.target.value)} /></Field>
        <Field label="O que muda daqui para frente?"><textarea className="textarea" value={priorities} onChange={(e) => setPriorities(e.target.value)} /></Field>
        <button className="btn btn--primary" onClick={() => dispatch({ type: 'review/period/save', id: existing?.id, from, to, title, highlights, obstacles, priorities })}>{existing ? 'Atualizar revisão' : 'Salvar revisão'}</button>
        <p className="xs muted">Revisões de período livre não dão XP: servem para olhar o todo com calma.</p>
      </div>
    </section>
  );
}

function PastReviews({ onWeek, onPeriod }: { onWeek: (ws: ISODate) => void; onPeriod: (p: Period) => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const items = [
    ...state.reviews.map((r) => ({ key: `w:${r.id}`, sort: r.weekStart, title: `Semana de ${formatDate(r.weekStart, { year: true })}`, meta: `${r.done}/${r.planned} concluídas · ${percent(r.rate)}`, text: r.priorities, open: () => onWeek(r.weekStart), remove: null as null | (() => void) })),
    ...state.periodReviews.map((r) => ({ key: `p:${r.id}`, sort: r.from, title: r.title || `${formatDate(r.from, { year: true })} a ${formatDate(r.to, { year: true })}`, meta: `${formatDate(r.from, { year: true })} a ${formatDate(r.to, { year: true })}`, text: r.priorities, open: () => onPeriod({ from: r.from, to: r.to }), remove: () => void dispatch({ type: 'review/period/remove', id: r.id }) })),
  ].sort((a, b) => b.sort.localeCompare(a.sort));
  if (!items.length) return null;
  return (
    <section className="card" style={{ marginTop: 16 }} aria-labelledby="past-h">
      <div className="card__head"><h2 id="past-h">Revisões anteriores</h2></div>
      <ul className="list">
        {items.map((r) => (
          <li key={r.key} style={{ alignItems: 'flex-start' }}>
            <div className="list__main">
              <button className="btn btn--ghost btn--sm" style={{ padding: 0 }} onClick={r.open}>{r.title}</button>
              <div className="list__meta">{r.meta}</div>
              {r.text && <p className="small" style={{ marginTop: 4 }}>Prioridades: {r.text}</p>}
            </div>
            {r.remove && <ConfirmButton className="icon-btn" ariaLabel={`Excluir ${r.title}`} confirmLabel="Excluir" onConfirm={r.remove}><LuTrash2 /></ConfirmButton>}
          </li>
        ))}
      </ul>
    </section>
  );
}

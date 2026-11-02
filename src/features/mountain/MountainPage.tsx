import { useMemo, useState } from 'react';
import { LuCheck, LuCircleDashed, LuFlag, LuMountainSnow, LuTent } from 'react-icons/lu';
import { Link } from '../../app/router';
import { useAppState, useDispatch } from '../../app/store';
import { MOUNTAIN_RULES, XP_RULES } from '../../domain/config';
import { formatDate } from '../../domain/dates';
import { forecastGoal, goalObservations, priorityGoal } from '../../domain/goals';
import { mountainState } from '../../domain/mountain';
import { Progress } from '../../components/ui';
import { useGame, useToday } from '../../hooks/useGame';
import { integer, metric } from '../../utils/format';
import { ForecastPanel } from '../goals/ForecastPanel';
import { Journey } from './Journey';

export function MountainPage() {
  const state = useAppState();
  const dispatch = useDispatch();
  const g = useGame();
  const today = useToday();
  const mountains = state.goals.filter((x) => x.status !== 'archived');
  const [selected, setSelected] = useState<string | null>(null);
  const goal = mountains.find((x) => x.id === selected) ?? priorityGoal(state);
  const ms = useMemo(() => (goal ? mountainState(state, goal.id) : null), [state, goal]);
  const projects = goal ? state.projects.filter((p) => p.goalId === goal.id && p.status === 'active') : [];

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Montanha</h1>
          <p>A trilha mostra a jornada. Os números abaixo mostram o resultado real.</p>
        </div>
        {mountains.length > 1 && (
          <div className="journey__picker" role="group" aria-label="Escolher montanha">
            {mountains.map((m) => (
              <button key={m.id} type="button" className={`chip ${goal?.id === m.id ? 'chip--solid' : ''}`} aria-pressed={goal?.id === m.id} onClick={() => setSelected(m.id)} style={{ minHeight: 40 }}>
                <LuMountainSnow aria-hidden="true" /> {m.title}
              </button>
            ))}
          </div>
        )}
      </header>

      <Journey goal={goal} variant="full" />

      {goal && ms && (
        <div className="grid grid--2" style={{ marginTop: 16 }}>
          <section className="card" aria-labelledby="cps-h">
            <div className="card__head">
              <h2 id="cps-h"><LuFlag aria-hidden="true" /> Checkpoints</h2>
              {!goal.isPriority && goal.status === 'active' && (
                <button className="btn btn--sm spacer" onClick={() => dispatch({ type: 'goal/setPriority', goalId: goal.id })}>Tornar prioritária</button>
              )}
            </div>
            <ol className="list checkpoints">
              <li>
                <span className="cp-icon is-done"><LuTent /></span>
                <div className="list__main"><div className="list__title">Base · {metric(goal.baselineValue, goal.unit)}</div><div className="list__meta">Início em {formatDate(goal.startDate, { year: true })}</div></div>
              </li>
              {ms.checkpoints.map((c) => (
                <li key={c.milestone.id}>
                  <span className={`cp-icon ${c.reached ? 'is-done' : ''}`}>{c.reached ? <LuCheck /> : c.milestone.major ? <LuTent /> : <LuCircleDashed />}</span>
                  <div className="list__main">
                    <div className="list__title">{c.milestone.title}</div>
                    <div className="list__meta">
                      {c.reached ? `Alcançado em ${formatDate(c.milestone.reachedAt?.slice(0, 10), { year: true })}` : c.milestone.rule === 'metric' ? `Validado quando o indicador chegar a ${metric(c.milestone.targetValue ?? 0, goal.unit)}` : 'Validação manual'}
                      {c.milestone.major && <span className="tag">Acampamento</span>}
                    </div>
                  </div>
                  {!c.reached && c.milestone.rule === 'manual' && goal.status === 'active' && (
                    <button className="btn btn--sm" onClick={() => dispatch({ type: 'milestone/validate', milestoneId: c.milestone.id })}>Validar</button>
                  )}
                </li>
              ))}
              <li>
                <span className={`cp-icon ${ms.summit ? 'is-done' : ''}`}><LuMountainSnow /></span>
                <div className="list__main"><div className="list__title">Cume · {metric(goal.targetValue, goal.unit)}</div><div className="list__meta">{goal.targetDate ? `Prazo desejado: ${formatDate(goal.targetDate, { year: true })}` : 'Sem prazo definido'}</div></div>
              </li>
            </ol>
            <Link to={`/metas/${goal.id}`} className="btn btn--sm" >Gerenciar objetivo e marcos</Link>
          </section>

          <div className="stack">
            <section className="card" aria-labelledby="miss-h">
              <div className="card__head"><h2 id="miss-h">Missões ativas</h2></div>
              {projects.length ? projects.map((p) => {
                const steps = state.steps.filter((s) => s.projectId === p.id).sort((a, b) => a.order - b.order);
                const done = steps.filter((s) => s.status === 'done').length;
                return (
                  <div key={p.id} style={{ marginBottom: 14 }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}><strong>{p.title}</strong><span className="small num">{done}/{steps.length}</span></div>
                    <Progress value={steps.length ? done / steps.length : 0} label={`Progresso da missão ${p.title}`} thin />
                    <ul className="list">
                      {steps.filter((s) => s.status === 'pending').slice(0, 3).map((s) => (
                        <li key={s.id}>
                          <span className="tick-wrap"><button type="button" role="checkbox" aria-checked={false} className="tick" aria-label={`Concluir microetapa: ${s.title}`} onClick={() => dispatch({ type: 'step/toggle', stepId: s.id })}><LuCheck /></button></span>
                          <div className="list__main"><div className="list__title">{s.title}</div><div className="list__meta">+{XP_RULES.stepDone} XP · {MOUNTAIN_RULES.points.stepDone} pts de trilha</div></div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }) : <p className="muted small">Nenhuma missão ativa para esta montanha. <Link to={`/metas/${goal.id}`}>Criar projeto</Link></p>}
            </section>

            <section className="card" aria-labelledby="rules-h">
              <div className="card__head"><h2 id="rules-h">Como o personagem avança</h2></div>
              <ul className="list small">
                <li><div className="list__main">Hábito concluído: <strong>{MOUNTAIN_RULES.points.habitDone} pts</strong> · parcial: {MOUNTAIN_RULES.points.habitPartial} pt · tarefa: {MOUNTAIN_RULES.points.taskDone} pts</div></li>
                <li><div className="list__main">Microetapa: <strong>{MOUNTAIN_RULES.points.stepDone} pts</strong> · missão concluída: <strong>{MOUNTAIN_RULES.points.missionDone} pts</strong></div></li>
                <li><div className="list__main">Cada trecho entre checkpoints vale {MOUNTAIN_RULES.pointsPerSegment} pts; a execução percorre no máximo {Math.round(MOUNTAIN_RULES.maxSegmentFraction * 100)}% dele.</div></li>
                <li><div className="list__main">O checkpoint só é alcançado quando o marco é validado. Trecho atual: <strong className="num">{integer(ms.segmentPoints)}/{MOUNTAIN_RULES.pointsPerSegment} pts</strong>.</div></li>
              </ul>
              <p className="small muted" style={{ marginTop: 8 }}>Nível {g.level.level} · {integer(g.xp)} XP. O nível do jogo não é requisito para nenhum resultado real.</p>
            </section>

            <ForecastPanel goal={goal} observations={goalObservations(state, goal.id)} forecast={forecastGoal(goal, goalObservations(state, goal.id), today)} />
          </div>
        </div>
      )}
    </>
  );
}

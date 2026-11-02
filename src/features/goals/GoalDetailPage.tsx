import { useState } from 'react';
import { LuArchive, LuCheck, LuFlag, LuMountainSnow, LuPause, LuPencil, LuPlay, LuPlus, LuTrash2, LuWallet } from 'react-icons/lu';
import { Link } from '../../app/router';
import { useAppState, useDispatch } from '../../app/store';
import { addMonths, formatDate, formatDateTime, formatMonth, monthKey, toISODate } from '../../domain/dates';
import { monthSummary } from '../../domain/finance';
import { forecastGoal, goalMilestones, goalObservations } from '../../domain/goals';
import type { Milestone } from '../../domain/types';
import { ConfirmButton, Empty, Field, Modal, Progress } from '../../components/ui';
import { useToday } from '../../hooks/useGame';
import { metric, money0 } from '../../utils/format';
import { ForecastPanel } from './ForecastPanel';
import { GoalForm, MilestoneForm, ObservationForm, StepQuickForm } from './GoalForms';
import { frequencyLabel } from '../../domain/routine';

export function GoalDetailPage({ id }: { id: string }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = useToday();
  const goal = state.goals.find((g) => g.id === id);
  const [edit, setEdit] = useState(false);
  const [obs, setObs] = useState(false);
  const [ms, setMs] = useState<{ open: boolean; m: Milestone | null }>({ open: false, m: null });
  const [stepFor, setStepFor] = useState<string | null>(null);
  const [projectOpen, setProjectOpen] = useState(false);
  const [complete, setComplete] = useState(false);
  if (!goal) return <section className="card"><Empty>Objetivo não encontrado. <Link to="/metas">Voltar</Link></Empty></section>;

  const observations = goalObservations(state, goal.id);
  const milestones = goalMilestones(state, goal.id);
  const projects = state.projects.filter((p) => p.goalId === goal.id);
  const habits = state.habits.filter((h) => h.goalId === goal.id);
  const versions = state.goalVersions.filter((v) => v.goalId === goal.id).sort((a, b) => b.version - a.version);
  const open = goal.status === 'active' || goal.status === 'paused';
  const lastMonth = addMonths(monthKey(today), -1);
  const financeValue = goal.metricSource === 'finance:personal_income' ? monthSummary(state, lastMonth).personalIncome : null;

  return (
    <>
      <header className="page-head">
        <div style={{ minWidth: 0 }}>
          <p className="small"><Link to="/metas">← Metas</Link></p>
          <h1>{goal.title}</h1>
          <p>{goal.metricName} · {goal.status === 'completed' ? 'Concluída' : goal.status === 'paused' ? 'Pausada' : goal.status === 'archived' ? 'Arquivada' : 'Ativa'} · versão {goal.version}</p>
        </div>
        <div className="page-head__actions">
          {open && <button className="btn btn--primary" onClick={() => setObs(true)}><LuFlag /> Registrar resultado</button>}
          {open && financeValue !== null && financeValue > 0 && (
            <button className="btn" onClick={() => dispatch({ type: 'goal/observe', goalId: goal.id, value: financeValue, date: toISODate(new Date(Number(lastMonth.slice(0, 4)), Number(lastMonth.slice(5, 7)), 0, 12)), note: `Renda pessoal realizada em ${formatMonth(lastMonth)} (módulo Finanças)`, source: 'finance' })}>
              <LuWallet /> Usar Finanças ({formatMonth(lastMonth)}: {money0(financeValue)})
            </button>
          )}
        </div>
      </header>

      <div className="row" style={{ marginBottom: 16 }}>
        {open && <button className="btn btn--sm" onClick={() => setEdit(true)}><LuPencil /> Editar plano</button>}
        {goal.status === 'active' && <button className="btn btn--sm" onClick={() => dispatch({ type: 'goal/setStatus', goalId: goal.id, status: 'paused' })}><LuPause /> Pausar</button>}
        {goal.status === 'paused' && <button className="btn btn--sm" onClick={() => dispatch({ type: 'goal/setStatus', goalId: goal.id, status: 'active' })}><LuPlay /> Retomar</button>}
        {open && !goal.isPriority && <button className="btn btn--sm" onClick={() => dispatch({ type: 'goal/setPriority', goalId: goal.id })}><LuMountainSnow /> Tornar prioritária</button>}
        {open && <button className="btn btn--sm" onClick={() => setComplete(true)}><LuCheck /> Concluir</button>}
        {goal.status !== 'archived' && goal.status !== 'completed' && (
          <ConfirmButton className="btn btn--sm" confirmLabel="Arquivar (histórico mantido)" onConfirm={() => dispatch({ type: 'goal/setStatus', goalId: goal.id, status: 'archived' })}><LuArchive /> Arquivar</ConfirmButton>
        )}
        {goal.status === 'archived' && <button className="btn btn--sm" onClick={() => dispatch({ type: 'goal/setStatus', goalId: goal.id, status: 'active' })}><LuPlay /> Reativar</button>}
      </div>

      <div className="grid grid--2">
        <ForecastPanel goal={goal} observations={observations} forecast={forecastGoal(goal, observations, today)} />

        <section className="card" aria-labelledby="ms-h">
          <div className="card__head">
            <h2 id="ms-h"><LuFlag aria-hidden="true" /> Marcos</h2>
            {open && <button className="btn btn--sm spacer" onClick={() => setMs({ open: true, m: null })}><LuPlus /> Marco</button>}
          </div>
          {milestones.length ? (
            <ul className="list">
              {milestones.map((m) => (
                <li key={m.id}>
                  <span className={`tag ${m.status === 'reached' ? 'tag--ink' : ''}`}>{m.status === 'reached' ? 'Alcançado' : 'Pendente'}</span>
                  <div className="list__main">
                    <div className="list__title">{m.title}{m.major ? ' · acampamento' : ''}</div>
                    <div className="list__meta">{m.rule === 'metric' ? `Indicador ≥ ${metric(m.targetValue ?? 0, goal.unit)}` : 'Validação manual'}{m.reachedAt ? ` · ${formatDate(m.reachedAt.slice(0, 10), { year: true })}` : ''}</div>
                  </div>
                  {m.status === 'pending' && open && (
                    <div className="list__end">
                      {m.rule === 'manual' && goal.status === 'active' && <button className="btn btn--sm" onClick={() => dispatch({ type: 'milestone/validate', milestoneId: m.id })}>Validar</button>}
                      <button className="icon-btn" aria-label={`Editar ${m.title}`} onClick={() => setMs({ open: true, m })}><LuPencil /></button>
                      <ConfirmButton className="icon-btn" ariaLabel={`Remover ${m.title}`} confirmLabel="Remover" onConfirm={() => dispatch({ type: 'milestone/remove', milestoneId: m.id })}><LuTrash2 /></ConfirmButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="muted small">Sem marcos intermediários: a montanha terá um único trecho até o cume.</p>}
        </section>

        <section className="card" aria-labelledby="pj-h">
          <div className="card__head">
            <h2 id="pj-h">Projetos e microetapas</h2>
            {open && <button className="btn btn--sm spacer" onClick={() => setProjectOpen(true)}><LuPlus /> Projeto</button>}
          </div>
          {projects.length ? projects.map((p) => {
            const steps = state.steps.filter((s) => s.projectId === p.id).sort((a, b) => a.order - b.order);
            const done = steps.filter((s) => s.status === 'done').length;
            return (
              <div key={p.id} style={{ marginBottom: 16 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{p.title}</strong>
                  <span className={`tag ${p.status === 'completed' ? 'tag--ink' : ''}`}>{p.status === 'completed' ? 'Missão concluída' : p.status === 'archived' ? 'Arquivado' : `${done}/${steps.length}`}</span>
                </div>
                <Progress value={steps.length ? done / steps.length : 0} label={`Progresso do projeto ${p.title}`} thin />
                <ul className="list steps-list">
                  {steps.map((s) => (
                    <li key={s.id} className={s.status === 'done' ? 'is-done' : ''}>
                      <span className="tick-wrap">
                        <button type="button" role="checkbox" className="tick" aria-checked={s.status === 'done'} aria-label={`${s.status === 'done' ? 'Reabrir' : 'Concluir'} microetapa: ${s.title}`} disabled={p.status !== 'active'} onClick={() => dispatch({ type: 'step/toggle', stepId: s.id })}><LuCheck /></button>
                      </span>
                      <div className="list__main"><div className="list__title">{s.title}</div>{s.completedAt && <div className="list__meta">{formatDateTime(s.completedAt)}</div>}</div>
                      {p.status === 'active' && <ConfirmButton className="icon-btn" ariaLabel={`Remover ${s.title}`} confirmLabel="Remover" onConfirm={() => dispatch({ type: 'step/remove', stepId: s.id })}><LuTrash2 /></ConfirmButton>}
                    </li>
                  ))}
                </ul>
                <div className="row">
                  {p.status === 'active' && <button className="btn btn--sm" onClick={() => setStepFor(p.id)}><LuPlus /> Microetapa</button>}
                  {p.status === 'active' && !steps.some((s) => s.status === 'done') && <ConfirmButton className="btn btn--sm btn--ghost" confirmLabel="Excluir projeto" onConfirm={() => dispatch({ type: 'project/remove', projectId: p.id })}>Excluir</ConfirmButton>}
                  {p.status !== 'archived' && (p.status === 'completed' || steps.some((s) => s.status === 'done')) && <button className="btn btn--sm btn--ghost" onClick={() => dispatch({ type: 'project/archive', projectId: p.id })}>Arquivar</button>}
                </div>
              </div>
            );
          }) : <p className="muted small">Nenhum projeto. Projetos agrupam microetapas — concluir todas finaliza a missão.</p>}
        </section>

        <section className="card" aria-labelledby="hist-h">
          <div className="card__head"><h2 id="hist-h">Histórico do plano</h2></div>
          <h3 className="small muted" style={{ marginBottom: 8 }}>Versões</h3>
          <ul className="versions">
            {versions.map((v) => (
              <li key={v.id}>
                <strong>v{v.version}</strong> · {formatDateTime(v.createdAt)} — {v.reason}
                <div className="xs muted">Alvo {metric(v.snapshot.targetValue, v.snapshot.unit)}{v.snapshot.targetDate ? ` até ${formatDate(v.snapshot.targetDate, { year: true })}` : ''} · {v.snapshot.milestones.length} marcos</div>
              </li>
            ))}
          </ul>
          <h3 className="small muted" style={{ margin: '14px 0 8px' }}>Medições</h3>
          <ul className="list">
            {[...observations].reverse().map((o) => (
              <li key={o.id}>
                <div className="list__main"><div className="list__title num">{metric(o.value, goal.unit)}</div><div className="list__meta">{formatDate(o.date, { year: true })} · {o.source === 'baseline' ? 'Linha de base' : o.source === 'finance' ? 'Finanças' : 'Manual'}{o.note ? ` · ${o.note}` : ''}</div></div>
              </li>
            ))}
          </ul>
          {habits.length > 0 && (
            <>
              <h3 className="small muted" style={{ margin: '14px 0 8px' }}>Hábitos vinculados</h3>
              <ul className="list">{habits.map((h) => <li key={h.id}><div className="list__main"><div className="list__title">{h.title}</div><div className="list__meta">{frequencyLabel(h)}</div></div></li>)}</ul>
            </>
          )}
        </section>
      </div>

      <GoalForm open={edit} onClose={() => setEdit(false)} goal={goal} />
      <ObservationForm open={obs} onClose={() => setObs(false)} goal={goal} />
      <MilestoneForm open={ms.open} onClose={() => setMs({ open: false, m: null })} goal={goal} milestone={ms.m} />
      <StepQuickForm open={!!stepFor} onClose={() => setStepFor(null)} projectId={stepFor ?? undefined} />
      <ProjectForm open={projectOpen} onClose={() => setProjectOpen(false)} goalId={goal.id} milestones={milestones.filter((m) => m.status === 'pending')} />
      <CompleteForm open={complete} onClose={() => setComplete(false)} goalId={goal.id} />
    </>
  );
}

function ProjectForm({ open, onClose, goalId, milestones }: { open: boolean; onClose: () => void; goalId: string; milestones: Milestone[] }) {
  const dispatch = useDispatch();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [steps, setSteps] = useState('');
  const save = async () => {
    const ok = await dispatch({ type: 'project/add', goalId, title, description, milestoneId: milestoneId || null, steps: steps.split('\n') });
    if (ok) {
      setTitle(''); setDescription(''); setSteps(''); setMilestoneId('');
      onClose();
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Novo projeto (missão)" footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={save}>Criar projeto</button></>}>
      <div className="form">
        <Field label="Nome"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Estruturar a oferta de consultoria" /></Field>
        <Field label="Descrição"><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        {milestones.length > 0 && (
          <Field label="Marco relacionado">
            <select className="select" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
              <option value="">Nenhum</option>
              {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </Field>
        )}
        <Field label="Microetapas (uma por linha)"><textarea className="textarea" value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={'Escolher o público\nValidar o problema\nPublicar a oferta'} /></Field>
      </div>
    </Modal>
  );
}

function CompleteForm({ open, onClose, goalId }: { open: boolean; onClose: () => void; goalId: string }) {
  const dispatch = useDispatch();
  const [note, setNote] = useState('');
  const save = async () => {
    const ok = await dispatch({ type: 'goal/complete', goalId, note });
    if (ok) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Concluir objetivo" footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={save}>Concluir e subir ao cume</button></>}>
      <div className="form">
        <p className="note small">Objetivos com indicador são concluídos automaticamente quando a medição atinge o alvo. Use a conclusão manual apenas com evidência — ela fica registrada no histórico.</p>
        <Field label="Evidência de conclusão"><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: Diploma emitido em 10/12" /></Field>
      </div>
    </Modal>
  );
}

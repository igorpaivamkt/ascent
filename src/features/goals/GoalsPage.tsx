import { useEffect, useState } from 'react';
import { LuArrowRight, LuMountainSnow, LuPlus, LuTarget } from 'react-icons/lu';
import { Link, navigate } from '../../app/router';
import { useAppState, useDispatch } from '../../app/store';
import { formatDate } from '../../domain/dates';
import { resultProgress } from '../../domain/goals';
import { mountainState } from '../../domain/mountain';
import type { GoalStatus } from '../../domain/types';
import { Empty, Progress, Tabs } from '../../components/ui';
import { metric, percent } from '../../utils/format';
import { CATEGORIES, GoalForm } from './GoalForms';

const STATUS_LABEL: Record<GoalStatus, string> = { active: 'Ativa', paused: 'Pausada', completed: 'Concluída', archived: 'Arquivada' };

export function GoalsPage() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [tab, setTab] = useState<'ativas' | 'concluidas' | 'arquivadas'>('ativas');
  const [form, setForm] = useState(false);
  useEffect(() => {
    if (location.hash.includes('novo=1')) {
      setForm(true);
      navigate('/metas', { replace: true });
    }
  }, []);
  const list = state.goals.filter((g) => (tab === 'ativas' ? g.status === 'active' || g.status === 'paused' : tab === 'concluidas' ? g.status === 'completed' : g.status === 'archived'));
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Metas</h1>
          <p>Objetivo → Marco → Projeto → Microetapa → Ação. Cada objetivo é uma montanha.</p>
        </div>
        <div className="page-head__actions">
          <button className="btn btn--primary" onClick={() => setForm(true)}><LuPlus /> Novo objetivo</button>
        </div>
      </header>
      <Tabs value={tab} onChange={setTab} label="Filtrar objetivos" options={[{ value: 'ativas', label: 'Ativas' }, { value: 'concluidas', label: 'Concluídas' }, { value: 'arquivadas', label: 'Arquivadas' }]} />
      {list.length ? (
        <div className="grid grid--2">
          {list.map((g) => {
            const ms = mountainState(state, g.id);
            const projects = state.projects.filter((p) => p.goalId === g.id && p.status === 'active').length;
            return (
              <article key={g.id} className="card goal-card">
                <div className="goal-card__top">
                  <h2><Link to={`/metas/${g.id}`}>{g.title}</Link></h2>
                  {g.isPriority && <span className="chip chip--solid" title="Jornada prioritária"><LuMountainSnow aria-hidden="true" /> Prioritária</span>}
                </div>
                <div className="row small muted">
                  <span>{CATEGORIES.find((c) => c.value === g.category)?.label}</span>·<span>{STATUS_LABEL[g.status]}</span>
                  {g.targetDate && <>·<span>Prazo {formatDate(g.targetDate, { year: true })}</span></>}
                </div>
                <div>
                  <div className="row small" style={{ justifyContent: 'space-between' }}>
                    <span>{g.metricName}</span>
                    <strong className="num">{metric(g.currentValue, g.unit)} / {metric(g.targetValue, g.unit)}</strong>
                  </div>
                  <div className="progress-row"><Progress value={resultProgress(g)} label={`Resultado de ${g.title}`} /><span className="num">{percent(resultProgress(g))}</span></div>
                </div>
                <div className="row small">
                  <span className="tag">{ms.reachedCount}/{ms.checkpoints.length} marcos</span>
                  <span className="tag">{projects} {projects === 1 ? 'projeto ativo' : 'projetos ativos'}</span>
                  <span className="tag">v{g.version}</span>
                </div>
                <div className="row">
                  <Link to={`/metas/${g.id}`} className="btn btn--sm">Abrir <LuArrowRight /></Link>
                  {!g.isPriority && g.status === 'active' && <button className="btn btn--sm btn--ghost" onClick={() => dispatch({ type: 'goal/setPriority', goalId: g.id })}>Tornar prioritária</button>}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="card">
          <Empty icon={<LuTarget />}>
            {tab === 'ativas' ? <>Nenhum objetivo ativo. <button className="btn btn--sm btn--primary" onClick={() => setForm(true)}>Criar objetivo</button></> : 'Nada por aqui ainda.'}
          </Empty>
        </section>
      )}
      <GoalForm open={form} onClose={() => setForm(false)} onCreated={(id) => navigate(`/metas/${id}`)} />
    </>
  );
}

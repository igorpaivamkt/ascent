import { useState } from 'react';
import { LuArrowLeft, LuArrowRight } from 'react-icons/lu';
import { navigate } from '../../app/router';
import { useAppState, useStore, useSyncStatus } from '../../app/store';
import { addDays } from '../../domain/dates';
import type { Command, GoalDraft } from '../../domain/engine';
import { Field } from '../../components/ui';
import { useToday } from '../../hooks/useGame';
import { metric, parseNumber } from '../../utils/format';
import { CharacterPreview } from '../mountain/CharacterPreview';

interface Template { id: string; label: string; hint: string; title: string; metricName: string; unit: string; baseline: string; target: string; category: GoalDraft['category']; months: number; finance?: boolean }
const TEMPLATES: Template[] = [
  { id: 'renda', label: 'Aumentar a renda', hint: 'Ex.: de R$ 3.500 para R$ 10.000/mês', title: 'Renda mensal de R$ 10.000', metricName: 'Renda líquida pessoal no mês', unit: 'R$', baseline: '', target: '10000', category: 'financeiro', months: 18, finance: true },
  { id: 'reserva', label: 'Montar uma reserva', hint: 'Ex.: 6 meses de custo de vida', title: 'Reserva de emergência', metricName: 'Valor guardado', unit: 'R$', baseline: '0', target: '15000', category: 'financeiro', months: 12 },
  { id: 'leitura', label: 'Ler mais', hint: 'Ex.: 12 livros no ano', title: 'Ler 12 livros', metricName: 'Livros concluídos', unit: 'livros', baseline: '0', target: '12', category: 'pessoal', months: 12 },
  { id: 'saude', label: 'Saúde e condicionamento', hint: 'Ex.: correr 10 km', title: 'Correr 10 km', metricName: 'Maior distância contínua', unit: 'km', baseline: '', target: '10', category: 'saude', months: 6 },
  { id: 'estudo', label: 'Concluir estudos', hint: 'Ex.: módulos de um curso', title: 'Concluir o curso', metricName: 'Módulos concluídos', unit: 'módulos', baseline: '0', target: '8', category: 'academico', months: 10 },
  { id: 'custom', label: 'Outro objetivo', hint: 'Você define o indicador', title: '', metricName: '', unit: '', baseline: '', target: '', category: 'personalizado', months: 12 },
];
const HABITS = [
  { title: 'Beber 3 L de água', frequency: 'daily' as const, durationMin: 0, category: 'saúde', linked: false },
  { title: 'Treinar 45 minutos', frequency: 'custom' as const, days: [1, 3, 5], durationMin: 45, category: 'saúde', linked: false },
  { title: 'Estudar 1 hora', frequency: 'weekdays' as const, durationMin: 60, category: 'estudos', linked: false },
  { title: 'Trabalhar no projeto principal', frequency: 'weekdays' as const, durationMin: 60, category: 'trabalho', linked: true },
  { title: 'Ler 20 páginas', frequency: 'daily' as const, durationMin: 30, category: 'desenvolvimento', linked: false },
  { title: 'Fazer uma ação comercial', frequency: 'weekdays' as const, durationMin: 30, category: 'trabalho', linked: true },
];

export function OnboardingPage() {
  const state = useAppState();
  const store = useStore();
  const today = useToday();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(state.mode === 'demo' ? '' : state.profile.displayName);
  const [tpl, setTpl] = useState<Template>(TEMPLATES[0]);
  const [g, setG] = useState({ title: TEMPLATES[0].title, metricName: TEMPLATES[0].metricName, unit: 'R$', baseline: '', target: '10000', deadline: addDays(today, 540) });
  const [habits, setHabits] = useState<string[]>([HABITS[0].title, HABITS[3].title]);
  const [skipGoal, setSkipGoal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cloud = useSyncStatus().mode === 'cloud';

  const pick = (t: Template) => {
    setTpl(t);
    setG({ title: t.title, metricName: t.metricName, unit: t.unit, baseline: t.baseline, target: t.target, deadline: addDays(today, Math.round(t.months * 30.4)) });
  };
  const b = parseNumber(g.baseline);
  const t = parseNumber(g.target);
  const goalValid = skipGoal || (g.title.trim() && g.metricName.trim() && Number.isFinite(b) && Number.isFinite(t) && b !== t);

  const finish = async () => {
    setBusy(true);
    setError('');
    try {
      await store.startFresh(name.trim() || 'Explorador');
      if (!skipGoal) {
        const step = (t - b) / 4;
        const mag = Math.abs(step) >= 1000 ? 500 : Math.abs(step) >= 100 ? 50 : Math.abs(step) >= 10 ? 5 : 1;
        const values = [1, 2, 3].map((i) => Math.round((b + step * i) / mag) * mag).filter((v, i, arr) => arr.indexOf(v) === i && v !== b && v !== t);
        await store.dispatch({ type: 'goal/create', draft: {
          title: g.title, description: '', category: tpl.category, metricName: g.metricName, unit: g.unit, indicator: 'quantitative',
          metricSource: tpl.finance ? 'finance:personal_income' : 'manual', direction: t > b ? 'increase' : 'decrease', baselineValue: b, targetValue: t,
          startDate: today, targetDate: g.deadline || null, isPriority: true,
          milestones: values.map((v, i) => ({ title: metric(v, g.unit), targetValue: v, rule: 'metric' as const, major: i === 1 })),
        } });
      }
      const goalId = store.getState().goals[0]?.id ?? null;
      for (const h of HABITS.filter((x) => habits.includes(x.title))) {
        const cmd: Command = { type: 'habit/create', habit: { title: h.title, description: '', category: h.category, frequency: h.frequency, days: 'days' in h ? h.days ?? [] : [], timeWindow: '', durationMin: h.durationMin, goalId: h.linked ? goalId : null } };
        await store.dispatch(cmd);
      }
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível iniciar a jornada.');
    } finally {
      setBusy(false);
    }
  };

  if (cloud) {
    return (
      <div className="onboarding">
        <section className="card">
          <h1 style={{ fontSize: 'var(--t-2xl)' }}>Você está numa conta sincronizada</h1>
          <p className="muted" style={{ margin: '8px 0 16px' }}>Para recomeçar do zero neste aparelho, saia da conta em Configurações. Na conta, crie objetivos e hábitos em Metas e Rotina.</p>
          <button className="btn btn--primary" onClick={() => navigate('/metas?novo=1')}>Criar objetivo</button>
        </section>
      </div>
    );
  }
  return (
    <div className="onboarding">
      <div className="steps" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}</div>
      <section className="card">
        {step === 0 && (
          <div className="form">
            <div className="row" style={{ gap: 16, flexWrap: 'nowrap' }}>
              <CharacterPreview look={state.equipped} mode="walk" size={90} />
              <div>
                <h1 style={{ fontSize: 'var(--t-2xl)' }}>Sua jornada começa na base</h1>
                <p className="muted">Você começa no nível 1 — independentemente de renda, idade ou ponto de partida.</p>
              </div>
            </div>
            {state.mode === 'demo' && <p className="note small">Ao concluir, os dados de demonstração serão apagados. Suas preferências de tema e animação serão mantidas.</p>}
            <Field label="Como quer ser chamado?"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoFocus /></Field>
          </div>
        )}
        {step === 1 && (
          <div className="form">
            <h1 style={{ fontSize: 'var(--t-2xl)' }}>Qual é a sua primeira montanha?</h1>
            <div className="choice-grid">
              {TEMPLATES.map((x) => (
                <button key={x.id} type="button" className="choice" aria-pressed={tpl.id === x.id && !skipGoal} onClick={() => { pick(x); setSkipGoal(false); }}>
                  <strong>{x.label}</strong><span>{x.hint}</span>
                </button>
              ))}
            </div>
            <label className="check"><input type="checkbox" checked={skipGoal} onChange={(e) => setSkipGoal(e.target.checked)} /> Prefiro definir o objetivo depois</label>
          </div>
        )}
        {step === 2 && !skipGoal && (
          <div className="form">
            <h1 style={{ fontSize: 'var(--t-2xl)' }}>Defina o indicador</h1>
            <p className="muted small">Linha de base é onde você está hoje. Três marcos intermediários serão sugeridos — edite depois quando quiser.</p>
            <Field label="Objetivo"><input className="input" value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} /></Field>
            <div className="form-row">
              <Field label="Indicador"><input className="input" value={g.metricName} onChange={(e) => setG({ ...g, metricName: e.target.value })} /></Field>
              <Field label="Unidade"><input className="input" value={g.unit} onChange={(e) => setG({ ...g, unit: e.target.value })} /></Field>
            </div>
            <div className="form-row">
              <Field label="Linha de base (hoje)"><input className="input num" inputMode="decimal" value={g.baseline} onChange={(e) => setG({ ...g, baseline: e.target.value })} /></Field>
              <Field label="Alvo"><input className="input num" inputMode="decimal" value={g.target} onChange={(e) => setG({ ...g, target: e.target.value })} /></Field>
              <Field label="Prazo desejado"><input className="input" type="date" value={g.deadline} onChange={(e) => setG({ ...g, deadline: e.target.value })} /></Field>
            </div>
          </div>
        )}
        {step === 2 && skipGoal && <p>Sem problema. Você poderá criar o objetivo na área Metas.</p>}
        {step === 3 && (
          <div className="form">
            <h1 style={{ fontSize: 'var(--t-2xl)' }}>Primeiros hábitos</h1>
            <p className="muted small">Comece pequeno. Você pode editar, pausar ou remover qualquer um depois.</p>
            {HABITS.map((h) => (
              <label key={h.title} className="check"><input type="checkbox" checked={habits.includes(h.title)} onChange={(e) => setHabits(e.target.checked ? [...habits, h.title] : habits.filter((x) => x !== h.title))} /> {h.title}</label>
            ))}
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>
        )}
        <div className="modal__foot">
          {step > 0 ? <button className="btn" onClick={() => setStep(step - 1)}><LuArrowLeft /> Voltar</button> : <button className="btn" onClick={() => navigate('/')}>Cancelar</button>}
          {step < 3 ? (
            <button className="btn btn--primary" disabled={step === 2 && !goalValid} onClick={() => setStep(step + 1)}>Continuar <LuArrowRight /></button>
          ) : (
            <button className="btn btn--primary" disabled={busy} onClick={finish}>Começar minha jornada</button>
          )}
        </div>
      </section>
    </div>
  );
}

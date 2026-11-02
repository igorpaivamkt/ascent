import { useEffect, useState } from 'react';
import { LuPlus, LuTrash2, LuWandSparkles } from 'react-icons/lu';
import { useAppState, useDispatch, useStore } from '../../app/store';
import { addDays } from '../../domain/dates';
import type { GoalDraft, MilestoneDraft } from '../../domain/engine';
import type { Goal, GoalCategory, Milestone, MetricSource } from '../../domain/types';
import { Field, Modal, Segmented } from '../../components/ui';
import { useToday } from '../../hooks/useGame';
import { metric, parseNumber } from '../../utils/format';

export const CATEGORIES: { value: GoalCategory; label: string }[] = [
  { value: 'financeiro', label: 'Financeiro' }, { value: 'profissional', label: 'Profissional' }, { value: 'negocio', label: 'Negócio' },
  { value: 'academico', label: 'Acadêmico' }, { value: 'saude', label: 'Saúde e condicionamento' }, { value: 'relacionamento', label: 'Relacionamento' },
  { value: 'pessoal', label: 'Desenvolvimento pessoal' }, { value: 'personalizado', label: 'Personalizado' },
];

interface MsRow { title: string; value: string; major: boolean; rule: 'metric' | 'manual' }

/** Sugere marcos igualmente espaçados — é só um ponto de partida editável. */
function suggest(base: number, target: number, unit: string, n = 4): MsRow[] {
  const step = (target - base) / (n + 1);
  const mag = Math.abs(step) >= 1000 ? 500 : Math.abs(step) >= 100 ? 50 : Math.abs(step) >= 10 ? 5 : 1;
  return Array.from({ length: n }, (_, i) => {
    const v = Math.round((base + step * (i + 1)) / mag) * mag;
    return { title: metric(v, unit) + (unit === 'R$' ? '/mês' : ''), value: String(v), major: i === Math.floor(n / 2), rule: 'metric' as const };
  }).filter((r, i, arr) => arr.findIndex((x) => x.value === r.value) === i && Number(r.value) !== base && Number(r.value) !== target);
}

export function GoalForm({ open, onClose, goal, onCreated }: { open: boolean; onClose: () => void; goal?: Goal | null; onCreated?: (id: string) => void }) {
  const dispatch = useDispatch();
  const store = useStore();
  const state = useAppState();
  const today = useToday();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GoalCategory>('financeiro');
  const [metricName, setMetricName] = useState('');
  const [unit, setUnit] = useState('R$');
  const [baseline, setBaseline] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [source, setSource] = useState<MetricSource>('manual');
  const [rows, setRows] = useState<MsRow[]>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(goal?.title ?? '');
    setDescription(goal?.description ?? '');
    setCategory(goal?.category ?? 'financeiro');
    setMetricName(goal?.metricName ?? '');
    setUnit(goal?.unit ?? 'R$');
    setBaseline(goal ? String(goal.baselineValue) : '');
    setTarget(goal ? String(goal.targetValue) : '');
    setDeadline(goal?.targetDate ?? addDays(today, 365));
    setSource(goal?.metricSource ?? 'manual');
    setRows([]);
    setReason('');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal]);

  const b = parseNumber(baseline);
  const t = parseNumber(target);

  const save = async () => {
    setError('');
    if (!Number.isFinite(t) || (!goal && !Number.isFinite(b))) return setError('Informe valores numéricos para linha de base e alvo.');
    if (goal) {
      const ok = await dispatch({ type: 'goal/update', goalId: goal.id, reason, patch: { title, description, category, metricName, unit, targetValue: t, targetDate: deadline || null, metricSource: source } });
      if (ok) onClose();
      return;
    }
    const milestones: MilestoneDraft[] = rows.filter((r) => r.title.trim()).map((r) => ({ title: r.title, targetValue: r.rule === 'metric' ? parseNumber(r.value) : null, rule: r.rule, major: r.major }));
    const draft: GoalDraft = {
      title, description, category, metricName: metricName || 'Indicador principal', unit, indicator: unit === '%' ? 'percent' : 'quantitative', metricSource: source,
      direction: t >= b ? 'increase' : 'decrease', baselineValue: b, targetValue: t, startDate: today, targetDate: deadline || null, milestones,
    };
    const before = new Set(state.goals.map((g) => g.id));
    const ok = await dispatch({ type: 'goal/create', draft });
    if (ok) {
      onClose();
      const created = store.getState().goals.find((g) => !before.has(g.id));
      if (created) onCreated?.(created.id);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={goal ? 'Editar objetivo' : 'Novo objetivo'} wide footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={save}>{goal ? 'Salvar nova versão' : 'Criar objetivo'}</button></>}>
      <div className="form">
        <Field label="Objetivo"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Renda mensal de R$ 10.000" /></Field>
        <div className="form-row">
          <Field label="Categoria">
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value as GoalCategory)}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Prazo desejado"><input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="Indicador principal" hint="Como o resultado será medido."><input className="input" value={metricName} onChange={(e) => setMetricName(e.target.value)} placeholder="Ex.: Renda líquida pessoal no mês" /></Field>
          <Field label="Unidade"><input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="R$, kg, livros, %" /></Field>
        </div>
        <div className="form-row">
          <Field label="Linha de base (hoje)"><input className="input num" inputMode="decimal" value={baseline} onChange={(e) => setBaseline(e.target.value)} disabled={!!goal} /></Field>
          <Field label="Valor-alvo"><input className="input num" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
        </div>
        {category === 'financeiro' && (
          <label className="check"><input type="checkbox" checked={source === 'finance:personal_income'} onChange={(e) => setSource(e.target.checked ? 'finance:personal_income' : 'manual')} /> Permitir atualizar com a renda pessoal registrada em Finanças</label>
        )}
        <Field label="Descrição"><textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Por que este objetivo importa?" /></Field>
        {goal ? (
          <Field label="Motivo da revisão" hint="Alterações relevantes criam uma nova versão do plano; o histórico anterior é preservado.">
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: Prazo ajustado após revisão mensal" />
          </Field>
        ) : (
          <fieldset className="field">
            <legend>Marcos intermediários (checkpoints)</legend>
            <small>Cada marco vira um checkpoint na montanha. Marcos por indicador são validados automaticamente.</small>
            {rows.map((r, i) => (
              <div key={i} className="ms-row">
                <input className="input" aria-label={`Nome do marco ${i + 1}`} value={r.title} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Nome do marco" />
                <select className="select" aria-label={`Regra do marco ${i + 1}`} value={r.rule} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, rule: e.target.value as MsRow['rule'] } : x)))}>
                  <option value="metric">Pelo indicador</option>
                  <option value="manual">Validação manual</option>
                </select>
                {r.rule === 'metric' && <input className="input num" inputMode="decimal" aria-label={`Valor do marco ${i + 1}`} value={r.value} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder="Valor" />}
                <label className="check"><input type="checkbox" checked={r.major} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, major: e.target.checked } : x)))} /> Acampamento</label>
                <button type="button" className="icon-btn" aria-label={`Remover marco ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}><LuTrash2 /></button>
              </div>
            ))}
            <div className="row">
              <button type="button" className="btn btn--sm" onClick={() => setRows([...rows, { title: '', value: '', major: false, rule: 'metric' }])}><LuPlus /> Adicionar marco</button>
              <button type="button" className="btn btn--sm" disabled={!Number.isFinite(b) || !Number.isFinite(t) || b === t} onClick={() => setRows(suggest(b, t, unit))}><LuWandSparkles /> Sugerir marcos</button>
            </div>
          </fieldset>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

export function ObservationForm({ open, onClose, goal }: { open: boolean; onClose: () => void; goal: Goal }) {
  const dispatch = useDispatch();
  const today = useToday();
  const [value, setValue] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open) {
      setValue('');
      setDate(today);
      setNote('');
    }
  }, [open, today]);
  const save = async () => {
    const ok = await dispatch({ type: 'goal/observe', goalId: goal.id, value: parseNumber(value), date, note });
    if (ok) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Registrar resultado" footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={save}>Registrar</button></>}>
      <div className="form">
        <p className="muted small">{goal.metricName} · atual {metric(goal.currentValue, goal.unit)} · alvo {metric(goal.targetValue, goal.unit)}</p>
        <div className="form-row">
          <Field label={`Valor medido (${goal.unit})`}><input className="input num" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
          <Field label="Data de referência"><input className="input" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Origem / observação" hint="Ex.: extrato do mês, balança, boletim."><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export function MilestoneForm({ open, onClose, goal, milestone }: { open: boolean; onClose: () => void; goal: Goal; milestone?: Milestone | null }) {
  const dispatch = useDispatch();
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [rule, setRule] = useState<'metric' | 'manual'>('metric');
  const [major, setMajor] = useState(false);
  useEffect(() => {
    if (!open) return;
    setTitle(milestone?.title ?? '');
    setValue(milestone?.targetValue != null ? String(milestone.targetValue) : '');
    setRule(milestone?.rule ?? 'metric');
    setMajor(milestone?.major ?? false);
  }, [open, milestone]);
  const save = async () => {
    const targetValue = rule === 'metric' ? parseNumber(value) : null;
    const ok = await dispatch(
      milestone
        ? { type: 'milestone/update', milestoneId: milestone.id, title, targetValue, major }
        : { type: 'milestone/add', goalId: goal.id, milestone: { title, targetValue, rule, major } },
    );
    if (ok) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={milestone ? 'Editar marco' : 'Novo marco'} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={save}>Salvar</button></>}>
      <div className="form">
        <Field label="Nome do marco"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Primeiro cliente" /></Field>
        {!milestone && (
          <Segmented value={rule} onChange={setRule} label="Regra de validação" options={[{ value: 'metric', label: 'Pelo indicador' }, { value: 'manual', label: 'Validação manual' }]} />
        )}
        {rule === 'metric' && <Field label={`Valor no indicador (${goal.unit})`}><input className="input num" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></Field>}
        <label className="check"><input type="checkbox" checked={major} onChange={(e) => setMajor(e.target.checked)} /> Marco de acampamento (grande marco)</label>
        <p className="note small">Adicionar, editar ou remover marcos cria uma nova versão do plano. Marcos já alcançados não podem ser alterados.</p>
      </div>
    </Modal>
  );
}

/** Adiciona uma microetapa a um projeto existente (ou cria um projeto novo). */
export function StepQuickForm({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId?: string }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const active = state.projects.filter((p) => p.status === 'active');
  const [pid, setPid] = useState('');
  const [title, setTitle] = useState('');
  const [newProject, setNewProject] = useState('');
  const [goalId, setGoalId] = useState('');
  useEffect(() => {
    if (!open) return;
    setPid(projectId ?? active[0]?.id ?? '__new');
    setTitle('');
    setNewProject('');
    setGoalId(state.goals.find((g) => g.isPriority)?.id ?? state.goals[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);
  const save = async () => {
    if (pid === '__new') {
      const ok = await dispatch({ type: 'project/add', goalId, title: newProject, description: '', milestoneId: null, steps: [title] });
      if (ok) onClose();
      return;
    }
    const ok = await dispatch({ type: 'step/add', projectId: pid, title });
    if (ok) onClose();
  };
  const activeGoals = state.goals.filter((g) => g.status === 'active');
  return (
    <Modal open={open} onClose={onClose} title="Nova microetapa" footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={save} disabled={!activeGoals.length && pid === '__new'}>Adicionar</button></>}>
      <div className="form">
        {!projectId && (
          <Field label="Projeto">
            <select className="select" value={pid} onChange={(e) => setPid(e.target.value)}>
              {active.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              <option value="__new">+ Novo projeto</option>
            </select>
          </Field>
        )}
        {pid === '__new' && (
          <div className="form-row">
            <Field label="Nome do projeto"><input className="input" value={newProject} onChange={(e) => setNewProject(e.target.value)} /></Field>
            <Field label="Objetivo">
              <select className="select" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                {activeGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </Field>
          </div>
        )}
        {!activeGoals.length && pid === '__new' && <p className="note small">Crie um objetivo antes de criar projetos.</p>}
        <Field label="Microetapa"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Fazer 5 abordagens" /></Field>
      </div>
    </Modal>
  );
}

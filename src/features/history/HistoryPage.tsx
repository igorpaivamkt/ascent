import { useMemo, useState } from 'react';
import { LuHistory } from 'react-icons/lu';
import { useAppState } from '../../app/store';
import { addDays, formatDateTime } from '../../domain/dates';
import type { Module } from '../../domain/types';
import { Empty, Field } from '../../components/ui';
import { useToday } from '../../hooks/useGame';
import { integer } from '../../utils/format';

const MODULES: { value: Module | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas as áreas' }, { value: 'rotina', label: 'Rotina' }, { value: 'metas', label: 'Objetivos' }, { value: 'conquistas', label: 'Conquistas e níveis' },
  { value: 'financas', label: 'Finanças' }, { value: 'relacionamento', label: 'Relacionamento' }, { value: 'revisao', label: 'Revisões' }, { value: 'loja', label: 'Loja' },
];

export function HistoryPage() {
  const state = useAppState();
  const today = useToday();
  const [period, setPeriod] = useState('30');
  const [module, setModule] = useState<Module | 'all'>('all');
  const [goal, setGoal] = useState('all');
  const [limit, setLimit] = useState(60);
  const from = period === 'all' ? '0000' : addDays(today, -Number(period) + 1);
  const entries = useMemo(
    () =>
      [...state.activity]
        .filter((a) => a.at.slice(0, 10) >= from || period === 'all')
        .filter((a) => module === 'all' || a.module === module)
        .filter((a) => goal === 'all' || a.goalId === goal)
        .sort((a, b) => b.at.localeCompare(a.at)),
    [state.activity, from, period, module, goal],
  );
  const xp = state.xpEvents.filter((e) => period === 'all' || e.at.slice(0, 10) >= from);
  const xpGain = xp.filter((e) => e.amount > 0).reduce((a, e) => a + e.amount, 0);
  const xpAdj = xp.filter((e) => e.amount < 0).reduce((a, e) => a + e.amount, 0);
  const levels = state.levelEvents.filter((l) => period === 'all' || l.at.slice(0, 10) >= from);
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Histórico</h1>
          <p>Tudo o que aconteceu na jornada. Alterar um plano nunca apaga o que já foi feito.</p>
        </div>
      </header>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="filters">
          <Field label="Período">
            <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="all">Tudo</option>
            </select>
          </Field>
          <Field label="Área">
            <select className="select" value={module} onChange={(e) => setModule(e.target.value as Module | 'all')}>{MODULES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
          </Field>
          <Field label="Objetivo">
            <select className="select" value={goal} onChange={(e) => setGoal(e.target.value)}>
              <option value="all">Todos</option>
              {state.goals.map((g) => <option key={g.id} value={g.id}>{g.title}{g.status === 'archived' ? ' (arquivado)' : ''}</option>)}
            </select>
          </Field>
        </div>
        <dl className="kv">
          <div><dt>Eventos</dt><dd>{integer(entries.length)}</dd></div>
          <div><dt>XP recebido</dt><dd>+{integer(xpGain)}</dd></div>
          <div><dt>Ajustes auditáveis</dt><dd>{integer(xpAdj)}</dd></div>
          <div><dt>Níveis alcançados</dt><dd>{levels.length ? levels.map((l) => l.level).join(', ') : '—'}</dd></div>
        </dl>
      </section>
      <section className="card" aria-label="Linha do tempo">
        {entries.length ? (
          <>
            <ol className="timeline">
              {entries.slice(0, limit).map((a) => (
                <li key={a.id}>
                  <time dateTime={a.at}>{formatDateTime(a.at)}</time>
                  <div><div className="list__title">{a.title}</div>{a.detail && <div className="list__meta">{a.detail}</div>}</div>
                </li>
              ))}
            </ol>
            {entries.length > limit && <button className="btn btn--sm" style={{ marginTop: 12 }} onClick={() => setLimit(limit + 60)}>Carregar mais</button>}
          </>
        ) : <Empty icon={<LuHistory />}>Nenhum evento neste filtro.</Empty>}
      </section>
    </>
  );
}

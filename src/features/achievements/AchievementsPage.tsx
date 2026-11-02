import { useMemo, useState } from 'react';
import { useAppState, useDispatch } from '../../app/store';
import { ACHIEVEMENT_CATEGORY_LABEL, ACHIEVEMENTS, computeStats, type AchievementCategory } from '../../domain/achievements';
import { TITLES, XP_RULES } from '../../domain/config';
import { formatDate, formatDateTime } from '../../domain/dates';
import { xpForLevel } from '../../domain/levels';
import { Progress, Tabs } from '../../components/ui';
import { useGame, useToday } from '../../hooks/useGame';
import { integer } from '../../utils/format';
import { CharacterPreview } from '../mountain/CharacterPreview';
import { AchievementBadge } from './AchievementBadge';

type Filter = 'todas' | 'desbloqueadas' | 'progresso' | 'bloqueadas' | AchievementCategory;

export function AchievementsPage() {
  const state = useAppState();
  const dispatch = useDispatch();
  const g = useGame();
  const today = useToday();
  const [filter, setFilter] = useState<Filter>('todas');
  const stats = useMemo(() => computeStats(state, today), [state, today]);
  const unlocked = new Map(state.achievements.map((a) => [a.code, a.unlockedAt]));
  const rows = ACHIEVEMENTS.map((def) => {
    const [cur, target] = def.progress(stats);
    const on = unlocked.has(def.code);
    return { def, cur: Math.min(cur, target), target, on, at: unlocked.get(def.code) ?? null, inProgress: !on && cur > 0 };
  }).filter((r) => {
    if (filter === 'todas') return true;
    if (filter === 'desbloqueadas') return r.on;
    if (filter === 'progresso') return r.inProgress;
    if (filter === 'bloqueadas') return !r.on;
    return r.def.category === filter;
  });
  const levels = Array.from({ length: 8 }, (_, i) => i + Math.max(1, g.level.level - 2));
  const coinTx = [...state.coinTx].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Conquistas</h1>
          <p>{state.achievements.length} de {ACHIEVEMENTS.length} desbloqueadas · XP é experiência no jogo, não medida de valor pessoal.</p>
        </div>
      </header>

      <div className="grid grid--2" style={{ marginBottom: 16 }}>
        <section className="card" aria-labelledby="lvl-h">
          <div className="card__head"><h2 id="lvl-h">Nível e títulos</h2></div>
          <div className="level-card">
            <div style={{ flex: 1 }}>
              <span className="big-number">Nível {g.level.level}</span>
              <p className="muted small" style={{ margin: '4px 0 10px' }}>{integer(g.xp)} XP acumulados · faltam {integer(g.level.nextLevelXp - g.xp)} XP para o nível {g.level.level + 1}</p>
              <Progress value={g.level.ratio} label="Progresso no nível" />
            </div>
            <CharacterPreview look={state.equipped} mode="celebrate" size={96} />
          </div>
          <h3 className="small muted" style={{ margin: '16px 0 8px' }}>Título exibido</h3>
          <div className="titles" role="group" aria-label="Escolher título exibido">
            {TITLES.map((t) => {
              const has = g.titles.includes(t);
              return (
                <button key={t.id} type="button" className={`chip ${g.title.id === t.id ? 'chip--solid' : has ? '' : 'chip--muted'}`} disabled={!has} aria-pressed={g.title.id === t.id}
                  onClick={() => dispatch({ type: 'profile/update', activeTitleId: t.id })} title={t.level ? `Nível ${t.level}` : 'Conquista especial'}>
                  {t.name}{!has && (t.level ? ` · nv ${t.level}` : ' · especial')}
                </button>
              );
            })}
          </div>
          <h3 className="small muted" style={{ margin: '16px 0 8px' }}>Curva de níveis — XP(L) = 100 × (L − 1)²</h3>
          <div className="row xs num">
            {levels.map((l) => <span key={l} className={`chip ${l === g.level.level ? 'chip--solid' : 'chip--muted'}`}>Nv {l}: {integer(xpForLevel(l))}</span>)}
          </div>
        </section>
        <section className="card" aria-labelledby="xp-h">
          <div className="card__head"><h2 id="xp-h">Como ganhar XP e {g.coinName}</h2></div>
          <ul className="list small">
            <li><div className="list__main">Concluir hábito</div><strong>+{XP_RULES.habitDone} XP</strong></li>
            <li><div className="list__main">Concluir tarefa planejada</div><strong>+{XP_RULES.taskDone} XP</strong></li>
            <li><div className="list__main">Finalizar microetapa</div><strong>+{XP_RULES.stepDone} XP</strong></li>
            <li><div className="list__main">Concluir missão (projeto)</div><strong>+{XP_RULES.missionDone} XP</strong></li>
            <li><div className="list__main">Validar marco</div><strong>+{XP_RULES.milestoneReached} XP</strong></li>
            <li><div className="list__main">Revisão semanal</div><strong>+{XP_RULES.weeklyReview} XP</strong></li>
            <li><div className="list__main">Registrar resultado real (1×/dia por meta)</div><strong>+{XP_RULES.resultRecorded} XP</strong></li>
          </ul>
          <h3 className="small muted" style={{ margin: '14px 0 6px' }}>Saldo: {integer(g.coins)} {g.coinName}</h3>
          <ul className="list small">
            {coinTx.map((t) => (
              <li key={t.id}><div className="list__main"><div>{t.reason}</div><div className="list__meta">{formatDateTime(t.at)}</div></div><strong className={t.amount < 0 ? 'negative' : 'positive'}>{t.amount > 0 ? '+' : ''}{t.amount}</strong></li>
            ))}
          </ul>
          <p className="xs muted" style={{ marginTop: 8 }}>Moedas virtuais não têm valor financeiro e não são conversíveis em dinheiro. Nada é perdido por descansar ou pausar.</p>
        </section>
      </div>

      <Tabs value={filter} onChange={setFilter} label="Filtrar conquistas" options={[
        { value: 'todas', label: 'Todas' }, { value: 'desbloqueadas', label: 'Desbloqueadas' }, { value: 'progresso', label: 'Em progresso' }, { value: 'bloqueadas', label: 'Bloqueadas' },
        ...(['rotina', 'execucao', 'financas', 'negocios', 'relacionamento', 'desenvolvimento'] as AchievementCategory[]).map((c) => ({ value: c, label: ACHIEVEMENT_CATEGORY_LABEL[c] })),
      ]} />
      <div className="ach-grid">
        {rows.map(({ def, cur, target, on, at }) => {
          const hide = def.hidden && !on;
          return (
            <article key={def.code} className={`ach ${on ? 'is-on' : ''}`}>
              <AchievementBadge def={def} unlocked={on} />
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
                <div className="row" style={{ justifyContent: 'space-between', gap: 6 }}>
                  <h3>{hide ? 'Conquista oculta' : def.title}</h3>
                  <span className="tag">{def.rarity}</span>
                </div>
                <p>{hide ? 'Continue explorando o ASCENT para revelar.' : def.description}</p>
                {!hide && (
                  <>
                    <div className="progress-row"><Progress value={cur / target} label={`Progresso: ${def.title}`} thin /><span className="num xs">{integer(cur)}/{integer(target)}</span></div>
                    <p className="xs muted">{ACHIEVEMENT_CATEGORY_LABEL[def.category]} · +{def.xp} XP · +{def.coins} {g.coinName}{at ? ` · desbloqueada em ${formatDate(at.slice(0, 10), { year: true })}` : ''}</p>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

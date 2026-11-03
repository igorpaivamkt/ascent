import { useMemo, useState, type ReactNode } from 'react';
import {
  LuArrowRight, LuChartLine, LuCirclePlus, LuGift, LuHeart, LuListChecks, LuReceipt, LuRepeat, LuShoppingBag, LuStar, LuTarget, LuTrophy, LuWallet,
  LuFootprints, LuCalendar,
} from 'react-icons/lu';
import { Link } from '../../app/router';
import { useAppState } from '../../app/store';
import { ACHIEVEMENTS, computeStats, getAchievement } from '../../domain/achievements';
import { CATALOG } from '../../domain/catalog';
import { formatDate, formatMonth, monthKey } from '../../domain/dates';
import { monthSummary, monthlySeries } from '../../domain/finance';
import { resultProgress } from '../../domain/goals';
import { dayAgenda } from '../../domain/routine';
import { LineChart } from '../../components/charts';
import { Progress } from '../../components/ui';
import { useGame, useToday } from '../../hooks/useGame';
import { integer, metric, money0, percent } from '../../utils/format';
import { AchievementBadge } from '../achievements/AchievementBadge';
import { TransactionForm } from '../finance/TransactionForm';
import { StepQuickForm } from '../goals/GoalForms';
import { CharacterPreview } from '../mountain/CharacterPreview';
import { Journey } from '../mountain/Journey';
import { ExperienceForm } from '../relationships/ExperienceForm';
import { AgendaList, HabitForm, TaskForm } from '../routine/RoutineParts';
import { SavingsReminder } from '../finance/SavingsView';
import { DemoBanner } from '../settings/DemoBanner';

type Quick = null | 'action' | 'expense' | 'income' | 'habit' | 'experience' | 'step';

export function DashboardPage() {
  const g = useGame();
  const [quick, setQuick] = useState<Quick>(null);
  return (
    <>
      <DemoBanner />
      <SavingsReminder />
      <div className="dash">
        <div className="dash__hero">
          <Journey goal={g.priority} variant="hero" overlay />
        </div>
        <LevelCard />
        <RecentAchievements />
        <TodayCard onAction={() => setQuick('action')} />
        <QuickActions onPick={setQuick} />
        <FinanceCard />
        <RelationshipCard />
        <GoalsCard />
        <NextAchievements />
        <ShopCard />
      </div>
      <TaskForm open={quick === 'action'} onClose={() => setQuick(null)} defaultDone title="Registrar ação" />
      <TransactionForm open={quick === 'expense' || quick === 'income'} onClose={() => setQuick(null)} type={quick === 'income' ? 'income' : 'expense'} />
      <HabitForm open={quick === 'habit'} onClose={() => setQuick(null)} />
      <ExperienceForm open={quick === 'experience'} onClose={() => setQuick(null)} />
      <StepQuickForm open={quick === 'step'} onClose={() => setQuick(null)} />
    </>
  );
}

function LevelCard() {
  const g = useGame();
  const state = useAppState();
  return (
    <section className="card dash__level" aria-labelledby="lvl-h">
      <div className="card__head">
        <h2 id="lvl-h"><LuStar aria-hidden="true" /> Seu nível</h2>
        <Link to="/conquistas" className="card__link">Detalhes <LuArrowRight /></Link>
      </div>
      <div className="level-card">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="muted small">{g.title.name}</p>
          <div className="row" style={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span className="big-number">{g.level.level}</span>
            <span className="strong num">{percent(g.level.ratio)}</span>
          </div>
          <Progress value={g.level.ratio} label="Progresso até o próximo nível" />
          <p className="small muted num" style={{ marginTop: 8 }}>{integer(g.level.intoLevel)} / {integer(g.level.needed)} XP neste nível</p>
          {g.nextTitle && <p className="small" style={{ marginTop: 4 }}>Próximo título: <strong>{g.nextTitle.name}</strong> (nível {g.nextTitle.level})</p>}
        </div>
        <CharacterPreview look={state.equipped} mode="idle" size={96} label="Seu personagem" />
      </div>
    </section>
  );
}

function RecentAchievements() {
  const state = useAppState();
  const recent = [...state.achievements].sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt)).slice(0, 3);
  return (
    <section className="card dash__recent" aria-labelledby="ach-h">
      <div className="card__head">
        <h2 id="ach-h"><LuTrophy aria-hidden="true" /> Conquistas recentes</h2>
        <Link to="/conquistas" className="card__link">Ver todas <LuArrowRight /></Link>
      </div>
      {recent.length ? (
        <ul className="badges">
          {recent.map((a) => {
            const def = getAchievement(a.code);
            return def ? (
              <li key={a.code}>
                <AchievementBadge def={def} unlocked />
                <span>{def.title}</span>
              </li>
            ) : null;
          })}
        </ul>
      ) : (
        <p className="muted small">Conclua sua primeira ação para desbloquear conquistas.</p>
      )}
    </section>
  );
}

function TodayCard({ onAction }: { onAction: () => void }) {
  const state = useAppState();
  const today = useToday();
  const items = dayAgenda(state, today).filter((i) => i.status !== 'na' && i.status !== 'rescheduled');
  const tasks = state.tasks.filter((t) => t.date === today);
  const done = items.filter((i) => i.status === 'done').length + tasks.filter((t) => t.status === 'done').length;
  const total = items.length + tasks.length;
  return (
    <section className="card dash__today" aria-labelledby="today-h">
      <div className="card__head">
        <h2 id="today-h"><LuListChecks aria-hidden="true" /> Rotina de hoje</h2>
        <span className="spacer strong num" aria-label={`${done} de ${total} concluídas`}>{done} / {total}</span>
      </div>
      {total ? <AgendaList date={today} compact /> : <p className="muted small">Nada programado para hoje. Crie um hábito ou registre uma ação.</p>}
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn btn--primary" style={{ flex: 1 }} onClick={onAction}><LuFootprints /> Registrar ação</button>
        <Link to="/rotina" className="btn">Rotina</Link>
      </div>
    </section>
  );
}

function QuickActions({ onPick }: { onPick: (q: Quick) => void }) {
  const actions: { q: Quick; label: string; icon: ReactNode }[] = [
    { q: 'action', label: 'Registrar ação', icon: <LuFootprints /> },
    { q: 'expense', label: 'Adicionar despesa', icon: <LuReceipt /> },
    { q: 'income', label: 'Registrar receita', icon: <LuWallet /> },
    { q: 'habit', label: 'Criar hábito', icon: <LuRepeat /> },
    { q: 'experience', label: 'Registrar experiência', icon: <LuHeart /> },
    { q: 'step', label: 'Adicionar microetapa', icon: <LuCirclePlus /> },
  ];
  return (
    <section className="card dash__quick" aria-labelledby="quick-h">
      <div className="card__head"><h2 id="quick-h">Ações rápidas</h2></div>
      <div className="quick-grid">
        {actions.map((a) => (
          <button key={a.label} type="button" className="quick" onClick={() => onPick(a.q)}>
            {a.icon}
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function FinanceCard() {
  const state = useAppState();
  const today = useToday();
  const month = monthKey(today);
  const s = monthSummary(state, month);
  const series = monthlySeries(state, month, 6);
  const finGoal = state.goals.find((g) => g.metricSource === 'finance:personal_income' && g.status === 'active');
  return (
    <section className="card dash__finance" aria-labelledby="fin-h">
      <div className="card__head">
        <h2 id="fin-h"><LuChartLine aria-hidden="true" /> Finanças · {formatMonth(month)}</h2>
        <Link to="/financas" className="card__link">Abrir <LuArrowRight /></Link>
      </div>
      <dl className="kv">
        <div><dt>Receitas realizadas</dt><dd>{money0(s.incomeSettled)}</dd></div>
        <div><dt>Despesas realizadas</dt><dd>{money0(s.expenseSettled)}</dd></div>
        <div><dt>Saldo do mês</dt><dd className={s.balanceSettled < 0 ? 'negative' : ''}>{money0(s.balanceSettled)}</dd></div>
      </dl>
      <p className="small muted" style={{ marginTop: 8 }}>Previsto/pendente: +{money0(s.incomeExpected)} / −{money0(s.expenseExpected)} · saldo projetado {money0(s.projectedBalance)}</p>
      <div style={{ marginTop: 10 }}>
        <LineChart label="Receitas realizadas nos últimos 6 meses" height={120} points={series.map((m) => ({ label: formatMonth(m.month), value: m.incomeSettled }))} format={money0} />
      </div>
      {finGoal && (
        <div style={{ marginTop: 10 }}>
          <div className="row small" style={{ justifyContent: 'space-between' }}><span>{finGoal.title}</span><strong className="num">{percent(resultProgress(finGoal))}</strong></div>
          <Progress value={resultProgress(finGoal)} label="Progresso da meta financeira" thin />
        </div>
      )}
    </section>
  );
}

function RelationshipCard() {
  const state = useAppState();
  const today = useToday();
  const p = state.relationship.profiles[0];
  const next = p ? state.relationship.commitments.filter((c) => c.profileId === p.id && c.status === 'pending').sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] : undefined;
  const recent = p ? [...state.relationship.experiences].filter((e) => e.profileId === p.id).sort((a, b) => b.date.localeCompare(a.date))[0] : undefined;
  const wish = p ? state.relationship.wishes.find((w) => w.profileId === p.id && w.status === 'pendente') : undefined;
  const upcoming = p
    ? state.relationship.dates.filter((d) => d.profileId === p.id).map((d) => ({ ...d, next: d.yearly ? `${today.slice(0, 4)}${d.date.slice(4)}` : d.date })).map((d) => ({ ...d, next: d.next < today && d.yearly ? `${Number(today.slice(0, 4)) + 1}${d.date.slice(4)}` : d.next })).filter((d) => d.next >= today).sort((a, b) => a.next.localeCompare(b.next))[0]
    : undefined;
  return (
    <section className="card dash__rel" aria-labelledby="rel-h">
      <div className="card__head">
        <h2 id="rel-h"><LuHeart aria-hidden="true" /> Relacionamento</h2>
        <Link to="/relacionamento" className="card__link">Perfil <LuArrowRight /></Link>
      </div>
      {p ? (
        <ul className="list">
          <li><div className="list__main"><div className="list__title">{p.name}{p.nickname ? ` · “${p.nickname}”` : ''}</div>{p.since && <div className="list__meta">Juntos desde {formatDate(p.since, { year: true })}</div>}</div></li>
          {upcoming && <li><LuCalendar aria-hidden="true" /><div className="list__main"><div className="list__title">{upcoming.title}</div><div className="list__meta">{formatDate(upcoming.next)}</div></div></li>}
          {next && <li><LuListChecks aria-hidden="true" /><div className="list__main"><div className="list__title">{next.title}</div><div className="list__meta">Compromisso · até {formatDate(next.dueDate)}</div></div></li>}
          {recent && <li><LuHeart aria-hidden="true" /><div className="list__main"><div className="list__title">{recent.title}</div><div className="list__meta">Experiência recente · {formatDate(recent.date)}</div></div></li>}
          {wish && <li><LuGift aria-hidden="true" /><div className="list__main"><div className="list__title">{wish.title}</div><div className="list__meta">Próximo item planejado</div></div></li>}
        </ul>
      ) : (
        <p className="muted small">Crie um perfil para registrar preferências, datas e experiências compartilhadas.</p>
      )}
    </section>
  );
}

function GoalsCard() {
  const state = useAppState();
  const goals = state.goals.filter((g) => g.status === 'active' || g.status === 'paused').slice(0, 4);
  return (
    <section className="card dash__goals" aria-labelledby="goals-h">
      <div className="card__head">
        <h2 id="goals-h"><LuTarget aria-hidden="true" /> Metas ativas</h2>
        <Link to="/metas" className="card__link">Ver todas <LuArrowRight /></Link>
      </div>
      {goals.length ? (
        <ul className="list">
          {goals.map((g) => (
            <li key={g.id}>
              <div className="list__main">
                <Link to={`/metas/${g.id}`} className="list__title" aria-label={`Abrir ${g.title}`}>{g.title}</Link>
                <div className="progress-row" style={{ marginTop: 6 }}>
                  <Progress value={resultProgress(g)} label={`Resultado de ${g.title}`} thin />
                  <span className="num">{percent(resultProgress(g))}</span>
                </div>
                <div className="list__meta">{metric(g.currentValue, g.unit)} de {metric(g.targetValue, g.unit)}{g.status === 'paused' ? ' · pausada' : ''}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Nenhuma meta ativa. <Link to="/metas?novo=1">Criar objetivo</Link></p>
      )}
    </section>
  );
}

function NextAchievements() {
  const state = useAppState();
  const today = useToday();
  const list = useMemo(() => {
    const stats = computeStats(state, today);
    const unlocked = new Set(state.achievements.map((a) => a.code));
    return ACHIEVEMENTS.filter((a) => !unlocked.has(a.code) && !a.hidden)
      .map((a) => {
        const [cur, target] = a.progress(stats);
        return { a, cur: Math.min(cur, target), target, ratio: Math.min(1, cur / target) };
      })
      .sort((x, y) => y.ratio - x.ratio)
      .slice(0, 3);
  }, [state, today]);
  return (
    <section className="card dash__next" aria-labelledby="next-h">
      <div className="card__head">
        <h2 id="next-h"><LuTrophy aria-hidden="true" /> Próximas conquistas</h2>
      </div>
      <ul className="list">
        {list.map(({ a, cur, target, ratio }) => (
          <li key={a.code}>
            <AchievementBadge def={a} unlocked={false} small />
            <div className="list__main">
              <div className="list__title">{a.title}</div>
              <div className="list__meta">{a.description}</div>
              <div className="progress-row" style={{ marginTop: 6 }}>
                <Progress value={ratio} label={`Progresso: ${a.title}`} thin />
                <span className="num">{integer(cur)}/{integer(target)}</span>
              </div>
            </div>
            <span className="tag">+{a.xp} XP</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ShopCard() {
  const state = useAppState();
  const g = useGame();
  const items = CATALOG.filter((i) => i.slot === 'body' || i.slot === 'head').slice(0, 5);
  return (
    <section className="card dash__shop" aria-labelledby="shop-h">
      <div className="card__head">
        <h2 id="shop-h"><LuShoppingBag aria-hidden="true" /> Loja de skins</h2>
        <Link to="/loja" className="card__link">{integer(g.coins)} {g.coinName} <LuArrowRight /></Link>
      </div>
      <div className="mini-skins">
        {items.map((item) => {
          const owned = state.inventory.some((i) => i.itemId === item.id);
          const look = { ...state.equipped, [item.slot]: item.id };
          return (
            <Link key={item.id} to="/loja" className={`mini-skin ${owned ? 'is-owned' : ''}`} aria-label={`${item.name}${owned ? ' (adquirido)' : ''}`}>
              <CharacterPreview look={look} size={54} animate={false} />
              <span>{owned ? 'Seu' : item.unlock.type === 'coins' ? integer(item.unlock.price) : item.unlock.type === 'level' ? `Nv ${item.unlock.level}` : 'Conquista'}</span>
            </Link>
          );
        })}
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>Itens cosméticos: não alteram progresso nem indicadores.</p>
    </section>
  );
}

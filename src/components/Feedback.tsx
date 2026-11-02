import { useEffect, useState, type ReactNode } from 'react';
import { LuCircleAlert, LuCircleCheck, LuFlag, LuGift, LuMountainSnow, LuSparkles, LuTrophy, LuX } from 'react-icons/lu';
import { navigate } from '../app/router';
import { useAppState, useStore } from '../app/store';
import { getAchievement } from '../domain/achievements';
import { getItem } from '../domain/catalog';
import { TITLES } from '../domain/config';
import type { Effect } from '../domain/engine';
import { mountainState } from '../domain/mountain';
import { daysBetweenIso } from '../domain/goals';
import { CharacterPreview } from '../features/mountain/CharacterPreview';
import { metric, plural } from '../utils/format';
import { Modal } from './ui';

interface Toast {
  id: number;
  icon: ReactNode;
  title: string;
  detail?: string;
  tone: 'ink' | 'error';
}

let toastSeq = 0;

/** Converte efeitos confirmados do motor em mensagens curtas. */
function toastsFor(effects: Effect[], coinName: string): Toast[] {
  const out: Toast[] = [];
  const xp = effects.reduce((a, e) => a + (e.type === 'xp' ? e.amount : 0), 0);
  const coins = effects.reduce((a, e) => a + (e.type === 'coins' ? e.amount : 0), 0);
  const steps = effects.reduce((a, e) => a + (e.type === 'progress' && e.points > 0 ? e.points : 0), 0);
  const firstXp = effects.find((e) => e.type === 'xp');
  if (xp > 0 || coins > 0) {
    const parts = [xp > 0 ? `+${xp} XP` : '', coins > 0 ? `+${coins} ${coinName}` : ''].filter(Boolean).join(' · ');
    const detail = [firstXp && firstXp.type === 'xp' ? firstXp.reason : '', steps > 0 ? 'o personagem avançou na trilha' : ''].filter(Boolean).join(' — ');
    out.push({ id: ++toastSeq, icon: <LuSparkles />, title: parts, detail, tone: 'ink' });
  }
  const achievements = effects.flatMap((e) => (e.type === 'achievement' ? [getAchievement(e.code)?.title ?? e.code] : []));
  if (achievements.length === 1) {
    const def = effects.find((e) => e.type === 'achievement');
    const d = def && def.type === 'achievement' ? getAchievement(def.code) : undefined;
    out.push({ id: ++toastSeq, icon: <LuTrophy />, title: `Conquista: ${achievements[0]}`, detail: d?.description, tone: 'ink' });
  } else if (achievements.length > 1) {
    out.push({ id: ++toastSeq, icon: <LuTrophy />, title: `${achievements.length} conquistas desbloqueadas`, detail: achievements.join(' · '), tone: 'ink' });
  }
  const items = effects.flatMap((e) => (e.type === 'item' ? [getItem(e.itemId)?.name ?? e.itemId] : []));
  if (items.length) out.push({ id: ++toastSeq, icon: <LuGift />, title: items.length === 1 ? `Novo item: ${items[0]}` : `${items.length} itens desbloqueados`, detail: items.length === 1 ? 'Disponível no seu inventário.' : items.join(' · '), tone: 'ink' });
  for (const e of effects) {
    if (e.type === 'milestone') {
      out.push({ id: ++toastSeq, icon: <LuFlag />, title: `Checkpoint alcançado: ${e.title}`, detail: 'Marco validado pelo indicador.', tone: 'ink' });
    } else if (e.type === 'mission') {
      out.push({ id: ++toastSeq, icon: <LuCircleCheck />, title: `Missão concluída: ${e.title}`, tone: 'ink' });
    }
  }
  return out;
}

export function Toaster() {
  const store = useStore();
  const { settings } = useAppState();
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const push = (list: Toast[], ms: number) => {
      if (!list.length) return;
      setToasts((cur) => [...cur, ...list].slice(-3));
      for (const t of list) setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== t.id)), ms);
    };
    const off1 = store.effects.on((effects) => push(toastsFor(effects, settings.coinName), 3800));
    const off2 = store.notices.on((n) =>
      push([{ id: ++toastSeq, icon: n.tone === 'error' ? <LuCircleAlert /> : <LuCircleCheck />, title: n.message, tone: n.tone === 'error' ? 'error' : 'ink' }], n.tone === 'error' ? 5500 : 3200),
    );
    return () => {
      off1();
      off2();
    };
  }, [store, settings.coinName]);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone === 'error' ? 'toast--error' : ''}`}>
          {t.icon}
          <div>
            <strong>{t.title}</strong>
            {t.detail && <span>{t.detail}</span>}
          </div>
          <button type="button" className="icon-btn toast__close" aria-label="Dispensar" onClick={() => setToasts((cur) => cur.filter((x) => x.id !== t.id))}>
            <LuX />
          </button>
        </div>
      ))}
    </div>
  );
}

type Celebration = { kind: 'level'; level: number; titleId: string | null } | { kind: 'summit'; goalId: string };

/** Modais de subida de nível e de chegada ao cume. */
export function Celebrations() {
  const store = useStore();
  const state = useAppState();
  const [queue, setQueue] = useState<Celebration[]>([]);
  useEffect(
    () =>
      store.effects.on((effects) => {
        const items: Celebration[] = [];
        const lastLevel = [...effects].reverse().find((e) => e.type === 'levelUp');
        if (lastLevel && lastLevel.type === 'levelUp') items.push({ kind: 'level', level: lastLevel.level, titleId: lastLevel.titleId });
        for (const e of effects) if (e.type === 'summit') items.push({ kind: 'summit', goalId: e.goalId });
        if (items.length) setTimeout(() => setQueue((q) => [...q, ...items]), 900);
      }),
    [store],
  );
  const current = queue[0];
  const close = () => setQueue((q) => q.slice(1));
  if (!current) return null;
  if (current.kind === 'level') {
    const title = TITLES.find((t) => t.id === current.titleId);
    return (
      <Modal open onClose={close} title={`Nível ${current.level}!`} footer={<button className="btn btn--primary" onClick={close}>Continuar subindo</button>}>
        <div className="celebrate">
          <CharacterPreview look={state.equipped} mode="celebrate" size={150} label="Personagem comemorando" />
          <p className="big-number">Nível {current.level}</p>
          {title ? <p>Novo título desbloqueado: <strong>{title.name}</strong></p> : <p>Sua experiência acumulada cresceu.</p>}
          <p className="muted small">XP representa experiência no jogo — não é medida de valor pessoal nem garantia de resultado.</p>
        </div>
      </Modal>
    );
  }
  const goal = state.goals.find((g) => g.id === current.goalId);
  if (!goal) return null;
  const ms = mountainState(state, goal.id);
  const days = daysBetweenIso(`${goal.startDate}T12:00:00`, goal.completedAt ?? new Date().toISOString());
  return (
    <Modal open onClose={close} title="Cume alcançado" wide footer={
      <>
        <button className="btn" onClick={() => { close(); navigate('/montanha'); }}>Ver a montanha</button>
        <button className="btn btn--primary" onClick={() => { close(); navigate('/metas?novo=1'); }}>Definir a próxima jornada</button>
      </>
    }>
      <div className="celebrate">
        <CharacterPreview look={state.equipped} mode="summit" size={150} label="Personagem no cume" />
        <h3 style={{ fontSize: 'var(--t-xl)' }}>{goal.title}</h3>
        <dl className="kv" style={{ width: '100%' }}>
          <div><dt>Tempo de jornada</dt><dd>{plural(days, 'dia', 'dias')}</dd></div>
          <div><dt>Ações executadas</dt><dd>{ms.executedActions}</dd></div>
          <div><dt>Marcos</dt><dd>{ms.reachedCount}/{ms.checkpoints.length}</dd></div>
          <div><dt>Versões do plano</dt><dd>{goal.version}</dd></div>
          <div><dt>Resultado</dt><dd>{metric(goal.baselineValue, goal.unit)} → {metric(goal.currentValue, goal.unit)}</dd></div>
        </dl>
        {goal.completionNote && <p className="note"><LuMountainSnow /> {goal.completionNote}</p>}
      </div>
    </Modal>
  );
}

import { useState, type ReactNode } from 'react';
import {
  LuBell, LuCalendarCheck, LuCoins, LuEllipsis, LuHistory, LuHouse, LuListChecks, LuMountainSnow, LuSettings, LuShoppingBag, LuTarget,
  LuTrophy, LuWallet, LuHeart, LuNotebookPen,
} from 'react-icons/lu';
import { CharacterPreview } from '../features/mountain/CharacterPreview';
import { SyncBadge } from '../features/settings/AccountSection';
import { formatDateTime, formatLongDate } from '../domain/dates';
import { useGame, useToday } from '../hooks/useGame';
import { integer } from '../utils/format';
import { Modal, Progress } from '../components/ui';
import { isActive, Link, usePath } from './router';
import { useAppState } from './store';

export const NAV = [
  { to: '/', label: 'Início', icon: <LuHouse /> },
  { to: '/montanha', label: 'Montanha', icon: <LuMountainSnow /> },
  { to: '/rotina', label: 'Rotina', icon: <LuListChecks /> },
  { to: '/metas', label: 'Metas', icon: <LuTarget /> },
  { to: '/financas', label: 'Finanças', icon: <LuWallet /> },
  { to: '/relacionamento', label: 'Relacionamento', icon: <LuHeart /> },
  { to: '/conquistas', label: 'Conquistas', icon: <LuTrophy /> },
  { to: '/loja', label: 'Loja', icon: <LuShoppingBag /> },
  { to: '/revisao', label: 'Revisão', icon: <LuNotebookPen /> },
  { to: '/historico', label: 'Histórico', icon: <LuHistory /> },
  { to: '/configuracoes', label: 'Configurações', icon: <LuSettings /> },
];
const MOBILE_PRIMARY = ['/', '/montanha', '/rotina', '/financas'];

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 100 62" aria-hidden="true">
      <path d="M2 60 L36 14 L50 30 L62 4 L98 60 Z" fill="currentColor" />
      <path d="M62 4 L55 19 L60 16 L64 22 L68 15 L73 17 Z" fill="var(--surface)" />
    </svg>
  );
}

function LevelCard() {
  const g = useGame();
  const state = useAppState();
  return (
    <Link to="/conquistas" className="side-level">
      <CharacterPreview look={state.equipped} size={46} animate={false} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <strong>Nível {g.level.level}</strong>
        <span>{g.title.name}</span>
        <Progress value={g.level.ratio} label={`Progresso no nível ${g.level.level}`} thin />
        <small className="num">{integer(g.level.totalXp)} / {integer(g.level.nextLevelXp)} XP</small>
      </div>
    </Link>
  );
}

function Notifications() {
  const state = useAppState();
  const [open, setOpen] = useState(false);
  const recent = [...state.activity].filter((a) => a.module === 'conquistas' || a.module === 'loja' || a.type === 'milestone' || a.type === 'mission').slice(-12).reverse();
  return (
    <>
      <button type="button" className="icon-btn" aria-label="Notificações recentes" onClick={() => setOpen(true)}>
        <LuBell />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novidades da jornada">
        {recent.length ? (
          <ul className="list">
            {recent.map((a) => (
              <li key={a.id}>
                <div className="list__main">
                  <div className="list__title">{a.title}</div>
                  <div className="list__meta">{formatDateTime(a.at)}{a.detail ? ` · ${a.detail}` : ''}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nenhuma novidade ainda. Conclua uma ação para começar.</p>
        )}
        <div className="modal__foot">
          <Link to="/historico" className="btn btn--sm" onClick={() => setOpen(false)}>Ver histórico completo</Link>
        </div>
      </Modal>
    </>
  );
}

function Avatar() {
  const state = useAppState();
  return (
    <Link to="/loja" className="avatar" aria-label="Personalizar personagem">
      <CharacterPreview look={state.equipped} size={34} animate={false} />
    </Link>
  );
}

export function DesktopHeader() {
  const g = useGame();
  const state = useAppState();
  const today = useToday();
  return (
    <header className="desktop-header">
      <Link to="/loja" className="avatar avatar--lg" aria-label="Personalizar personagem">
        <CharacterPreview look={state.equipped} size={56} animate={false} />
      </Link>
      <div>
        <div className="row" style={{ gap: 8 }}>
          <strong style={{ fontSize: 'var(--t-xl)' }}>Olá, {state.profile.displayName}</strong>
          <span className="chip chip--solid">{g.title.name}</span>
        </div>
        <div className="row small muted" style={{ gap: 12, marginTop: 2 }}>
          <span className="num">Nível {g.level.level} · {integer(g.xp)} XP</span>
          <span className="num row" style={{ gap: 4 }}><LuCoins aria-hidden="true" /> {integer(g.coins)} {g.coinName}</span>
        </div>
      </div>
      <div className="desktop-header__right">
        <SyncBadge />
        <Notifications />
        <Link to="/configuracoes" className="icon-btn" aria-label="Configurações"><LuSettings /></Link>
        <span className="chip chip--solid"><LuCalendarCheck aria-hidden="true" /> {formatLongDate(today)}</span>
      </div>
    </header>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const path = usePath();
  const g = useGame();
  const [more, setMore] = useState(false);
  const moreActive = !MOBILE_PRIMARY.some((p) => isActive(p, path));
  return (
    <div className="app">
      <a className="skip-link" href="#conteudo" onClick={(e) => { e.preventDefault(); document.getElementById('conteudo')?.focus(); }}>Pular para o conteúdo</a>
      <aside className="sidebar" aria-label="Navegação principal">
        <Link to="/" className="brand" aria-label="ASCENT — início">
          <Logo size={86} />
          <span className="wordmark">ASCENT</span>
          <small>PLANEJE · CONQUISTE · EVOLUA</small>
        </Link>
        <nav className="nav">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} current={isActive(n.to, path)}>
              {n.icon}
              {n.label}
            </Link>
          ))}
        </nav>
        <LevelCard />
        <p className="sidebar__quote">“Disciplina hoje,<br />liberdade amanhã.”</p>
      </aside>

      <header className="topbar">
        <Link to="/" className="topbar__logo" aria-label="ASCENT — início">
          <Logo size={30} />
          <span className="wordmark">ASCENT</span>
        </Link>
        <SyncBadge />
        <Link to="/conquistas" className="pill-stat" aria-label={`Nível ${g.level.level}`}>Nv {g.level.level}</Link>
        <Link to="/loja" className="pill-stat" aria-label={`${g.coins} ${g.coinName}`}><LuCoins aria-hidden="true" />{integer(g.coins)}</Link>
        <Notifications />
        <Avatar />
      </header>

      <main id="conteudo" className="main" tabIndex={-1}>
        {children}
      </main>

      <nav className="bottom-nav" aria-label="Navegação principal">
        {NAV.filter((n) => MOBILE_PRIMARY.includes(n.to)).map((n) => (
          <Link key={n.to} to={n.to} current={isActive(n.to, path)}>
            {n.icon}
            {n.label}
          </Link>
        ))}
        <button type="button" aria-current={moreActive ? 'page' : undefined} aria-haspopup="dialog" onClick={() => setMore(true)}>
          <LuEllipsis />
          Mais
        </button>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="Mais áreas">
        <nav className="menu-sheet" aria-label="Outras áreas">
          {NAV.filter((n) => !MOBILE_PRIMARY.includes(n.to)).map((n) => (
            <Link key={n.to} to={n.to} current={isActive(n.to, path)} onClick={() => setMore(false)}>
              {n.icon}
              {n.label}
            </Link>
          ))}
        </nav>
      </Modal>
    </div>
  );
}

import { useEffect, type ReactNode } from 'react';
import { Celebrations, Toaster } from '../components/Feedback';
import { AchievementsPage } from '../features/achievements/AchievementsPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { FinancePage } from '../features/finance/FinancePage';
import { GoalDetailPage } from '../features/goals/GoalDetailPage';
import { GoalsPage } from '../features/goals/GoalsPage';
import { HistoryPage } from '../features/history/HistoryPage';
import { MountainPage } from '../features/mountain/MountainPage';
import { OnboardingPage } from '../features/onboarding/OnboardingPage';
import { RelationshipPage } from '../features/relationships/RelationshipPage';
import { ReviewPage } from '../features/review/ReviewPage';
import { RoutinePage } from '../features/routine/RoutinePage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { ImportPage } from '../features/settings/ImportPage';
import { ShopPage } from '../features/shop/ShopPage';
import { useDocumentPreferences } from '../hooks/usePreferences';
import { LoginPage } from '../features/auth/LoginPage';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getCloudConfig } from '../services/cloud/config';
import { useSyncStatus } from './store';
import { DesktopHeader, Layout } from './Layout';
import { matchRoute, usePath } from './router';

const ROUTES: { pattern: string; render: (p: Record<string, string>) => ReactNode; title: string }[] = [
  { pattern: '/', render: () => <DashboardPage />, title: 'Início' },
  { pattern: '/montanha', render: () => <MountainPage />, title: 'Montanha' },
  { pattern: '/rotina', render: () => <RoutinePage />, title: 'Rotina' },
  { pattern: '/metas', render: () => <GoalsPage />, title: 'Metas' },
  { pattern: '/metas/:id', render: (p) => <GoalDetailPage id={p.id} />, title: 'Objetivo' },
  { pattern: '/financas', render: () => <FinancePage />, title: 'Finanças' },
  { pattern: '/relacionamento', render: () => <RelationshipPage />, title: 'Relacionamento' },
  { pattern: '/conquistas', render: () => <AchievementsPage />, title: 'Conquistas' },
  { pattern: '/loja', render: () => <ShopPage />, title: 'Loja' },
  { pattern: '/revisao', render: () => <ReviewPage />, title: 'Revisão semanal' },
  { pattern: '/historico', render: () => <HistoryPage />, title: 'Histórico' },
  { pattern: '/configuracoes', render: () => <SettingsPage />, title: 'Configurações' },
  { pattern: '/importar', render: () => <ImportPage />, title: 'Importar dados' },
  { pattern: '/inicio', render: () => <OnboardingPage />, title: 'Começar' },
];

export function App() {
  useDocumentPreferences();
  const path = usePath();
  const match = ROUTES.map((r) => ({ r, params: matchRoute(r.pattern, path) })).find((x) => x.params);
  useEffect(() => {
    document.title = match ? `${match.r.title} · ASCENT` : 'ASCENT';
    window.scrollTo(0, 0);
  }, [path, match]);
  const status = useSyncStatus();
  // Com servidor configurado, o app exige login: cada conta só vê a própria jornada.
  if (getCloudConfig() && status.mode !== 'cloud') {
    return (
      <>
        <LoginPage />
        <Toaster />
      </>
    );
  }
  return (
    <Layout>
      <DesktopHeader />
      <ErrorBoundary resetKey={path}>{match ? match.r.render(match.params ?? {}) : <NotFound />}</ErrorBoundary>
      <Toaster />
      <Celebrations />
    </Layout>
  );
}

function NotFound() {
  return (
    <div className="card">
      <h1>Trilha não encontrada</h1>
      <p className="muted" style={{ margin: '8px 0 16px' }}>Esta página não existe.</p>
      <a className="btn btn--primary" href="#/">Voltar ao início</a>
    </div>
  );
}

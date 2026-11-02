import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppStore, StoreContext } from './app/store';
import { createDemoState } from './domain/demo';
import { LocalMediaRepository, LocalStateRepository, MemoryStorage, type KeyValueStorage } from './repositories/localRepository';
import { registerServiceWorker } from './services/pwa';
import { getCloudConfig } from './services/cloud/config';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/mountain.css';
import './styles/pages.css';

/** Usa o localStorage quando disponível; caso contrário (modo privado restrito, prévias), cai para memória. */
function pickStorage(): { storage: KeyValueStorage; persistent: boolean } {
  try {
    const ls = window.localStorage;
    const probe = '__ascent_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return { storage: ls, persistent: true };
  } catch {
    return { storage: new MemoryStorage(), persistent: false };
  }
}

async function boot() {
  const { storage, persistent } = pickStorage();
  const repo = new LocalStateRepository(storage);
  const media = new LocalMediaRepository(storage);
  let state;
  try {
    state = await repo.load();
  } catch (e) {
    console.error('Falha ao carregar dados salvos', e);
  }
  if (!state) {
    // Primeira abertura: começa pela demonstração (claramente identificada) e salva.
    state = createDemoState(new Date());
    await repo.save(state).catch(() => undefined);
  }
  const store = new AppStore(repo, media, state, persistent, storage);
  const root = document.getElementById('root');
  if (!root) return;
  createRoot(root).render(
    <StrictMode>
      <StoreContext.Provider value={store}>
        <App />
      </StoreContext.Provider>
    </StrictMode>,
  );
  if (!persistent) store.notify({ tone: 'error', message: 'Armazenamento local indisponível: seus registros não serão mantidos ao fechar esta página.' });
  registerServiceWorker();
  startCloud(store);
}

/** Restaura a sessão lembrada e mantém a sincronização em dia (rede voltou, app voltou ao primeiro plano, a cada 60 s). */
function startCloud(store: AppStore) {
  const config = getCloudConfig();
  if (config) void store.restoreCloud(config);
  window.addEventListener('online', () => void store.syncNow());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void store.syncNow());
  setInterval(() => document.visibilityState === 'visible' && void store.syncNow(), 60_000);
}

void boot();

import { useEffect, useState } from 'react';
import { LuDownload, LuFileUp, LuRefreshCw, LuUpload } from 'react-icons/lu';
import { Link, navigate } from '../../app/router';
import { useAppState, useDispatch, useStore, useSyncStatus } from '../../app/store';
import type { MotionPref, ThemePref } from '../../domain/types';
import { ConfirmButton, Field, Segmented } from '../../components/ui';
import { DemoBanner } from './DemoBanner';
import { AccountSection } from './AccountSection';
import { AdminSection } from './AdminSection';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

export function SettingsPage() {
  const state = useAppState();
  const store = useStore();
  const dispatch = useDispatch();
  const cloud = useSyncStatus().mode === 'cloud';
  const [name, setName] = useState(state.profile.displayName);
  const [coin, setCoin] = useState(state.settings.coinName);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  const size = new Blob([JSON.stringify(state)]).size;
  const standalone = typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches;

  const exportData = () => {
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ascent-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const importData = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    try {
      await store.importJson(await f.text());
      store.notify({ tone: 'success', message: 'Backup importado com sucesso.' });
    } catch (e) {
      store.notify({ tone: 'error', message: e instanceof Error ? e.message : 'Arquivo inválido.' });
    }
  };

  return (
    <>
      <DemoBanner />
      <header className="page-head"><div><h1>Configurações</h1><p>Preferências, dados e instalação.</p></div></header>
      <div className="grid grid--2">
        <AccountSection />
        {cloud && <AdminSection />}
        <section className="card settings-section" aria-labelledby="pf-h">
          <h2 id="pf-h">Perfil e jogo</h2>
          <Field label="Seu nome"><input className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== state.profile.displayName && dispatch({ type: 'profile/update', displayName: name })} /></Field>
          <Field label="Nome da moeda virtual" hint="As moedas não têm valor financeiro real."><input className="input" value={coin} onChange={(e) => setCoin(e.target.value)} onBlur={() => coin !== state.settings.coinName && dispatch({ type: 'settings/update', patch: { coinName: coin } })} /></Field>
          <label className="check"><input type="checkbox" checked={state.settings.celebrations} onChange={(e) => dispatch({ type: 'settings/update', patch: { celebrations: e.target.checked } })} /> Efeitos de comemoração do personagem</label>
        </section>
        <section className="card settings-section" aria-labelledby="ap-h">
          <h2 id="ap-h">Aparência e acessibilidade</h2>
          <fieldset className="field"><legend>Tema</legend>
            <Segmented<ThemePref> value={state.settings.theme} onChange={(theme) => dispatch({ type: 'settings/update', patch: { theme } })} label="Tema" options={[{ value: 'system', label: 'Sistema' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Escuro' }]} />
          </fieldset>
          <fieldset className="field"><legend>Animações</legend>
            <Segmented<MotionPref> value={state.settings.motion} onChange={(motion) => dispatch({ type: 'settings/update', patch: { motion } })} label="Animações" options={[{ value: 'system', label: 'Seguir o sistema' }, { value: 'reduced', label: 'Reduzidas' }, { value: 'full', label: 'Completas' }]} />
            <small>Com animações reduzidas, o progresso é atualizado instantaneamente, sem perder funcionalidades.</small>
          </fieldset>
        </section>
        <section className="card settings-section" aria-labelledby="dt-h">
          <h2 id="dt-h">Seus dados</h2>
          <p className="small muted">Modo: <strong>{cloud ? 'nuvem (sincronizado)' : state.mode === 'demo' ? 'demonstração' : 'jornada própria neste aparelho'}</strong> · {(size / 1024).toFixed(0)} KB.</p>
          <div className="row">
            <button className="btn btn--sm" onClick={exportData}><LuDownload /> Exportar backup (JSON)</button>
            {!cloud && <label className="btn btn--sm"><LuUpload /> Importar backup<input type="file" accept="application/json" className="sr-only" onChange={(e) => importData(e.target.files)} /></label>}
            <Link to="/importar" className="btn btn--sm"><LuFileUp /> Importar pacote de dados</Link>
          </div>
          <hr className="divider" />
          {cloud ? <p className="xs muted">Recomeçar ou carregar a demonstração só é possível na jornada local: saia da conta primeiro.</p> : <div className="row">
            <Link to="/inicio" className="btn btn--sm btn--primary">{state.mode === 'demo' ? 'Limpar demonstração e começar' : 'Recomeçar do zero'}</Link>
            <ConfirmButton className="btn btn--sm" confirmLabel="Substituir tudo pela demonstração" onConfirm={async () => { await store.loadDemo(); navigate('/'); }}><LuRefreshCw /> Recarregar demonstração</ConfirmButton>
          </div>}
          <p className="xs muted">{cloud ? 'Seus dados ficam no servidor, protegidos por conta e regras de acesso por usuário; este aparelho guarda uma cópia para uso offline.' : 'Jornada local: armazenamento do navegador, sem criptografia. Exporte backups ou entre numa conta para sincronizar.'}</p>
        </section>
        <section className="card settings-section" aria-labelledby="in-h">
          <h2 id="in-h">Instalar no celular</h2>
          {standalone ? <p className="small">O ASCENT já está instalado e aberto como aplicativo.</p> : install ? (
            <button className="btn btn--primary" onClick={async () => { await install.prompt(); setInstall(null); }}>Instalar o ASCENT</button>
          ) : (
            <p className="small muted">No Android (Chrome), use o menu ⋮ → “Instalar app” ou “Adicionar à tela inicial”. No iPhone (Safari), use Compartilhar → “Adicionar à Tela de Início”.</p>
          )}
          <p className="xs muted">Versão {__APP_VERSION__} · PWA com funcionamento offline após a primeira visita. A geração de APK usa Capacitor (ver docs/ANDROID.md no projeto).</p>
        </section>
      </div>
    </>
  );
}

import { useState } from 'react';
import { LuCloud, LuCloudOff, LuLogOut, LuRefreshCw } from 'react-icons/lu';
import { useAppState, useStore, useSyncStatus } from '../../app/store';
import { formatDateTime } from '../../domain/dates';
import { getCloudConfig, isBuiltInConfig, saveRuntimeCloudConfig } from '../../services/cloud/config';
import { Field, Modal } from '../../components/ui';

/** Conta, login e sincronização com a nuvem. */
export function AccountSection() {
  const store = useStore();
  const status = useSyncStatus();
  const config = getCloudConfig();
  if (!config) return <ServerConfig />;
  return (
    <section className="card settings-section" aria-labelledby="acc-cloud-h">
      <h2 id="acc-cloud-h" className="row" style={{ gap: 8 }}>{status.mode === 'cloud' ? <LuCloud aria-hidden="true" /> : <LuCloudOff aria-hidden="true" />} Conta e sincronização</h2>
      {status.mode === 'cloud' ? <Connected /> : <SignIn onReady={() => store.notify({ tone: 'success', message: 'Conectado. Sua jornada agora é sincronizada.' })} />}
      {!isBuiltInConfig() && (
        <p className="xs muted">Servidor configurado manualmente: {config.url}. <button className="btn btn--ghost btn--sm" onClick={() => { saveRuntimeCloudConfig(null); location.reload(); }}>Remover</button></p>
      )}
    </section>
  );
}

function ServerConfig() {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  return (
    <section className="card settings-section" aria-labelledby="srv-h">
      <h2 id="srv-h" className="row" style={{ gap: 8 }}><LuCloudOff aria-hidden="true" /> Conta e sincronização</h2>
      <p className="small muted">Este app está em modo local: os dados ficam só neste aparelho. Para sincronizar entre aparelhos, o ASCENT precisa de um servidor Supabase (veja docs/BACKEND.md). Normalmente ele já vem configurado no build.</p>
      <details>
        <summary className="small strong" style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Configurar servidor manualmente (testes)</summary>
        <div className="form" style={{ marginTop: 8 }}>
          <Field label="URL do projeto Supabase"><input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" inputMode="url" /></Field>
          <Field label="Chave pública (anon key)" hint="É pública por natureza. Nunca use a service_role key aqui."><input className="input" value={key} onChange={(e) => setKey(e.target.value)} /></Field>
          <button className="btn btn--sm btn--primary" disabled={!/^https:\/\//.test(url) || key.length < 20} onClick={() => { saveRuntimeCloudConfig({ url, anonKey: key }); location.reload(); }}>Salvar e recarregar</button>
        </div>
      </details>
    </section>
  );
}

function SignIn({ onReady }: { onReady: () => void }) {
  const store = useStore();
  const local = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [choose, setChoose] = useState(false);

  const auth = store.initCloud(getCloudConfig()!);
  const afterLogin = async () => {
    store.rememberSession(remember);
    const st = await store.remoteStatus();
    if (st.exists) {
      await store.openCloudJourney();
      onReady();
    } else setChoose(true);
  };
  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível continuar.');
    } finally {
      setBusy(false);
    }
  };
  const signIn = run(async () => {
    await auth.signIn(email.trim(), password);
    setPassword('');
    await afterLogin();
  });
  const signUp = run(async () => {
    const r = await auth.signUp(email.trim(), password);
    setPassword('');
    if (r === 'confirm_email') setInfo('Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre.');
    else await afterLogin();
  });
  const hasLocalJourney = local.mode === 'real' && (local.goals.length > 0 || local.habits.length > 0 || local.xpEvents.length > 0);

  return (
    <>
      <p className="small muted">Entre para guardar sua jornada na nuvem e usar em vários aparelhos. As recompensas passam a ser validadas pelo servidor.</p>
      <div className="form">
        <Field label="E-mail"><input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Senha" hint="Mínimo de 8 caracteres. A senha nunca é guardada no aparelho."><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Manter conectado neste aparelho</label>
        {remember && <p className="xs muted">Guarda um token de sessão no armazenamento deste navegador. Use só em aparelho pessoal.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {info && <p className="note small" role="status">{info}</p>}
        <div className="row">
          <button className="btn btn--primary" disabled={busy || !email || !password} onClick={signIn}>Entrar</button>
          <button className="btn" disabled={busy || !email || !password} onClick={signUp}>Criar conta</button>
        </div>
      </div>
      <Modal open={choose} onClose={() => setChoose(false)} title="Sua conta ainda está vazia">
        <div className="form">
          <p className="small">Como você quer começar na nuvem?</p>
          <button className="choice" disabled={!hasLocalJourney || busy} onClick={run(async () => { await store.migrateLocalJourney(); setChoose(false); onReady(); })}>
            <strong>Enviar a jornada deste aparelho</strong>
            <span>{hasLocalJourney ? 'Migração única. O servidor confere XP, conquistas e moedas antes de aceitar.' : 'Não há jornada própria neste aparelho (a demonstração não é enviada).'}</span>
          </button>
          <button className="choice" disabled={busy} onClick={run(async () => { await store.openCloudJourney(); setChoose(false); onReady(); })}>
            <strong>Começar do zero na nuvem</strong>
            <span>A jornada local continua neste aparelho e volta a aparecer se você sair da conta.</span>
          </button>
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
      </Modal>
    </>
  );
}

function Connected() {
  const store = useStore();
  const status = useSyncStatus();
  const [confirmOut, setConfirmOut] = useState(false);
  const [del, setDel] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <dl className="kv">
        <div><dt>Conta</dt><dd style={{ overflowWrap: 'anywhere' }}>{status.email}</dd></div>
        <div><dt>Situação</dt><dd>{status.syncing ? 'Sincronizando…' : !status.online ? 'Offline' : status.pending ? `${status.pending} pendente(s)` : 'Sincronizado'}</dd></div>
        <div><dt>Última sincronização</dt><dd>{status.lastSyncAt ? formatDateTime(status.lastSyncAt) : '—'}</dd></div>
      </dl>
      {status.error && <p className="form-error" role="alert">{status.error}</p>}
      <div className="row">
        <button className="btn btn--sm" disabled={status.syncing} onClick={() => void store.syncNow()}><LuRefreshCw /> Sincronizar agora</button>
        <button className="btn btn--sm" onClick={() => (status.pending ? setConfirmOut(true) : void store.signOut())}><LuLogOut /> Sair</button>
        <button className="btn btn--sm btn--danger" onClick={() => setDel(true)}>Excluir conta</button>
      </div>
      <p className="xs muted">Registros feitos sem internet ficam guardados neste aparelho e são enviados quando a conexão volta. XP e avanço na montanha aparecem quando o servidor confirma.</p>
      <Modal open={confirmOut} onClose={() => setConfirmOut(false)} title="Há registros não sincronizados" footer={<><button className="btn" onClick={() => setConfirmOut(false)}>Cancelar</button><button className="btn btn--danger" onClick={() => { setConfirmOut(false); void store.signOut(); }}>Sair mesmo assim</button></>}>
        <p className="small">{status.pending} registro(s) ainda não chegaram ao servidor e serão perdidos se você sair agora. Conecte-se à internet e use "Sincronizar agora" antes de sair.</p>
      </Modal>
      <Modal open={del} onClose={() => setDel(false)} title="Excluir conta" footer={<><button className="btn" onClick={() => setDel(false)}>Cancelar</button><button className="btn btn--danger" disabled={typed !== 'EXCLUIR' || busy} onClick={async () => { setBusy(true); try { await store.deleteAccount(); setDel(false); store.notify({ tone: 'success', message: 'Conta e dados na nuvem excluídos.' }); } catch (e) { store.notify({ tone: 'error', message: e instanceof Error ? e.message : 'Falha ao excluir.' }); } finally { setBusy(false); } }}>Excluir definitivamente</button></>}>
        <div className="form">
          <p className="small">Apaga a conta e TODOS os dados da nuvem (jornada, histórico, auditoria). Não pode ser desfeito. A jornada local deste aparelho não é afetada. Exporte um backup antes, se quiser.</p>
          <Field label='Digite EXCLUIR para confirmar'><input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></Field>
        </div>
      </Modal>
    </>
  );
}

/** Indicador compacto para o cabeçalho. */
export function SyncBadge() {
  const status = useSyncStatus();
  if (status.mode !== 'cloud') return null;
  const label = status.syncing ? 'Sincronizando' : !status.online ? 'Offline' : status.error ? 'Atenção' : status.pending ? `${status.pending} pendente${status.pending > 1 ? 's' : ''}` : 'Sincronizado';
  return (
    <a href="#/configuracoes" className={`sync-badge ${!status.online || status.error ? 'is-warn' : ''}`} aria-label={`Sincronização: ${label}`} title={status.error ?? label}>
      {status.online && !status.error ? <LuCloud aria-hidden="true" /> : <LuCloudOff aria-hidden="true" />}
      <span>{label}</span>
    </a>
  );
}

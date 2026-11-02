import { useState } from 'react';
import { LuCloud, LuCloudOff, LuKeyRound, LuLogOut, LuRefreshCw } from 'react-icons/lu';
import { useStore, useSyncStatus } from '../../app/store';
import { emailToUsername } from '../../domain/accounts';
import { formatDateTime } from '../../domain/dates';
import { getCloudConfig, isBuiltInConfig, saveRuntimeCloudConfig } from '../../services/cloud/config';
import { Field, Modal } from '../../components/ui';

/** Conta, login e sincronização com a nuvem. */
export function AccountSection() {
  const status = useSyncStatus();
  const config = getCloudConfig();
  if (!config) return <ServerConfig />;
  return (
    <section className="card settings-section" aria-labelledby="acc-cloud-h">
      <h2 id="acc-cloud-h" className="row" style={{ gap: 8 }}>{status.mode === 'cloud' ? <LuCloud aria-hidden="true" /> : <LuCloudOff aria-hidden="true" />} Conta e sincronização</h2>
      {status.mode === 'cloud' ? <Connected /> : <p className="small muted">Entre pela tela de acesso para sincronizar.</p>}
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

function Connected() {
  const store = useStore();
  const status = useSyncStatus();
  const [confirmOut, setConfirmOut] = useState(false);
  const [del, setDel] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwError, setPwError] = useState('');
  const changePassword = async () => {
    if (pw !== pw2) return setPwError('As senhas não conferem.');
    setBusy(true);
    setPwError('');
    try {
      await store.cloudAuth!.updatePassword(pw);
      setPwOpen(false);
      setPw('');
      setPw2('');
      store.notify({ tone: 'success', message: 'Senha alterada.' });
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Não foi possível trocar a senha.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <dl className="kv">
        <div><dt>Usuário</dt><dd style={{ overflowWrap: 'anywhere' }}>{emailToUsername(status.email) ?? status.email}</dd></div>
        <div><dt>Situação</dt><dd>{status.syncing ? 'Sincronizando…' : !status.online ? 'Offline' : status.pending ? `${status.pending} pendente(s)` : 'Sincronizado'}</dd></div>
        <div><dt>Última sincronização</dt><dd>{status.lastSyncAt ? formatDateTime(status.lastSyncAt) : '—'}</dd></div>
      </dl>
      {status.error && <p className="form-error" role="alert">{status.error}</p>}
      <div className="row">
        <button className="btn btn--sm" disabled={status.syncing} onClick={() => void store.syncNow()}><LuRefreshCw /> Sincronizar agora</button>
        <button className="btn btn--sm" onClick={() => (status.pending ? setConfirmOut(true) : void store.signOut())}><LuLogOut /> Sair</button>
        <button className="btn btn--sm" onClick={() => { setPwError(''); setPwOpen(true); }}><LuKeyRound /> Trocar senha</button>
        <button className="btn btn--sm btn--danger" onClick={() => setDel(true)}>Excluir conta</button>
      </div>
      <p className="xs muted">Registros feitos sem internet ficam guardados neste aparelho e são enviados quando a conexão volta. XP e avanço na montanha aparecem quando o servidor confirma.</p>
      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Trocar senha" footer={<><button className="btn" onClick={() => setPwOpen(false)}>Cancelar</button><button className="btn btn--primary" disabled={busy || !pw || !pw2} onClick={() => void changePassword()}>Salvar nova senha</button></>}>
        <div className="form">
          <Field label="Nova senha" hint="Mínimo de 8 caracteres."><input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Field label="Confirmar nova senha"><input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
          {pwError && <p className="form-error" role="alert">{pwError}</p>}
        </div>
      </Modal>
      <Modal open={confirmOut} onClose={() => setConfirmOut(false)} title="Há registros não sincronizados" footer={<><button className="btn" onClick={() => setConfirmOut(false)}>Cancelar</button><button className="btn btn--danger" onClick={() => { setConfirmOut(false); void store.signOut(); }}>Sair mesmo assim</button></>}>
        <p className="small">{status.pending} registro(s) ainda não chegaram ao servidor e serão perdidos se você sair agora. Conecte-se à internet e use "Sincronizar agora" antes de sair.</p>
      </Modal>
      <Modal open={del} onClose={() => setDel(false)} title="Excluir conta" footer={<><button className="btn" onClick={() => setDel(false)}>Cancelar</button><button className="btn btn--danger" disabled={typed !== 'EXCLUIR' || busy} onClick={async () => { setBusy(true); try { await store.deleteAccount(); setDel(false); store.notify({ tone: 'success', message: 'Conta e dados na nuvem excluídos.' }); } catch (e) { store.notify({ tone: 'error', message: e instanceof Error ? e.message : 'Falha ao excluir.' }); } finally { setBusy(false); } }}>Excluir definitivamente</button></>}>
        <div className="form">
          <p className="small">Apaga a conta e TODOS os dados da nuvem (jornada, histórico, auditoria). Não pode ser desfeito. Exporte um backup antes, se quiser.</p>
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

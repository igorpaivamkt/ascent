import { useState, type FormEvent } from 'react';
import { LuEye, LuEyeOff } from 'react-icons/lu';
import { Logo } from '../../app/Layout';
import { useAppState, useStore, useSyncStatus } from '../../app/store';
import { normalizeUsername } from '../../domain/accounts';
import { Field, Modal, Tabs } from '../../components/ui';
import { getCloudConfig } from '../../services/cloud/config';
import { CharacterPreview } from '../mountain/CharacterPreview';

type Mode = 'entrar' | 'criar';

/**
 * Tela de acesso por nome de usuário e senha (sem e-mail). Cada conta tem a própria jornada na
 * nuvem; o servidor só entrega a jornada do usuário dono do token.
 */
export function LoginPage() {
  const store = useStore();
  const status = useSyncStatus();
  const local = useAppState();
  const [mode, setMode] = useState<Mode>('entrar');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [choose, setChoose] = useState(false);

  const auth = store.initCloud(getCloudConfig()!);
  const hasLocalJourney = local.mode === 'real' && (local.goals.length > 0 || local.habits.length > 0 || local.xpEvents.length > 0);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível continuar.');
    } finally {
      setBusy(false);
    }
  };

  const afterLogin = async () => {
    store.rememberSession(remember);
    const st = await store.remoteStatus();
    if (st.exists) await store.openCloudJourney();
    else setChoose(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'criar' && password !== confirm) {
      setError('As senhas não conferem.');
      return;
    }
    void run(async () => {
      if (mode === 'entrar') await auth.signInUsername(username, password);
      else await auth.signUpUsername(username, password);
      setPassword('');
      setConfirm('');
      await afterLogin();
    });
  };

  if (status.restoring) {
    return (
      <main className="login" aria-busy="true">
        <div className="login__brand"><Logo size={44} /><span>ASCENT</span></div>
        <p className="muted" role="status">Entrando na sua conta…</p>
      </main>
    );
  }

  return (
    <main className="login">
      <div className="login__brand"><Logo size={44} /><span>ASCENT</span></div>
      <div className="card login__card">
        <div className="login__hero" aria-hidden="true"><CharacterPreview look={local.equipped} size={72} /></div>
        <h1 className="login__title">{mode === 'entrar' ? 'Acesse sua jornada' : 'Crie sua conta'}</h1>
        <Tabs<Mode> label="Acesso" value={mode} onChange={(m) => { setMode(m); setError(''); }} options={[{ value: 'entrar', label: 'Entrar' }, { value: 'criar', label: 'Criar conta' }]} />
        <form className="form" onSubmit={submit} noValidate>
          <Field label="Usuário">
            <input className="input" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="text" value={username} onChange={(e) => setUsername(e.target.value)} onBlur={() => setUsername(normalizeUsername(username))} />
          </Field>
          <div className="field">
            <label htmlFor="login-password" className="field__label">Senha</label>
            <div className="input-with-action">
              <input id="login-password" className="input" name="password" type={show ? 'text' : 'password'} autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'} aria-describedby={mode === 'criar' ? 'login-password-hint' : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="btn btn--ghost" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={show} onClick={() => setShow(!show)}>{show ? <LuEyeOff /> : <LuEye />}</button>
            </div>
            {mode === 'criar' && <small id="login-password-hint">Mínimo de 8 caracteres.</small>}
          </div>
          {mode === 'criar' && (
            <Field label="Confirmar senha">
              <input className="input" name="password-confirm" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
          )}
          <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Manter conectado neste aparelho</label>
          {remember && <p className="xs muted">Guarda só um token de sessão neste navegador (nunca a senha). Desmarque em aparelho compartilhado.</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn--primary btn--block" disabled={busy || !username || !password || (mode === 'criar' && !confirm)}>
            {busy ? 'Aguarde…' : mode === 'entrar' ? 'Entrar' : 'Criar conta e entrar'}
          </button>
          {mode === 'criar' && <p className="xs muted">Só nomes de usuário liberados pelo administrador podem criar conta.</p>}
        </form>
      </div>
      <p className="xs muted login__foot">Cada conta tem a própria jornada. Uma conta não vê os dados de outra.</p>

      <Modal open={choose} onClose={() => { setChoose(false); void auth.signOut(); }} title="Sua conta ainda está vazia">
        <div className="form">
          <p className="small">Como você quer começar?</p>
          <button className="choice" disabled={!hasLocalJourney || busy} onClick={() => void run(async () => { await store.migrateLocalJourney(); setChoose(false); })}>
            <strong>Enviar a jornada deste aparelho</strong>
            <span>{hasLocalJourney ? 'Migração única para esta conta. O servidor confere XP, conquistas e moedas antes de aceitar.' : 'Não há jornada própria neste aparelho (a demonstração não é enviada).'}</span>
          </button>
          <button className="choice" disabled={busy} onClick={() => void run(async () => { await store.openCloudJourney(); setChoose(false); })}>
            <strong>Começar do zero</strong>
            <span>Jornada nova e vazia nesta conta.</span>
          </button>
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
      </Modal>
    </main>
  );
}

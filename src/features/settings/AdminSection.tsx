import { useCallback, useEffect, useState } from 'react';
import { LuKeyRound, LuRefreshCw, LuShieldCheck, LuUserPlus } from 'react-icons/lu';
import { useStore } from '../../app/store';
import { formatDateTime } from '../../domain/dates';
import type { AdminUser } from '../../server/admin';
import { Field, Modal } from '../../components/ui';

/**
 * Administração de contas, visível só para o administrador (o servidor confere a cada chamada).
 * As senhas são digitadas aqui por você e vão direto ao Supabase Auth; o app não as guarda.
 */
export function AdminSection() {
  const store = useStore();
  const api = store.cloudTransport;
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [create, setCreate] = useState(false);
  const [pwFor, setPwFor] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    if (!api) return;
    setError('');
    try {
      setUsers(await api.adminListUsers());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar as contas.');
    }
  }, [api]);

  useEffect(() => {
    let alive = true;
    api?.me().then((m) => {
      if (!alive) return;
      setIsAdmin(m.isAdmin);
      if (m.isAdmin) void load();
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [api, load]);

  if (!api || !isAdmin) return null;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      store.notify({ tone: 'success', message: ok });
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card settings-section" aria-labelledby="adm-h">
      <h2 id="adm-h" className="row" style={{ gap: 8 }}><LuShieldCheck aria-hidden="true" /> Administração</h2>
      <p className="small muted">Só você vê esta área. Contas novas são criadas aqui: o cadastro pela tela de acesso fica fechado.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {users === null ? (
        <p className="small muted" role="status">Carregando contas…</p>
      ) : (
        <ul className="list admin-users">
          {users.map((u) => (
            <li key={u.id}>
              <div className="list__main">
                <div className="list__title">{u.username ?? u.email ?? u.id}{u.isAdmin && <span className="chip chip--muted rel-linked">admin</span>}</div>
                <div className="list__meta">
                  <span>{u.access ? 'Acesso liberado' : 'Sem acesso'}</span>
                  <span>{u.lastSignInAt ? `Último acesso ${formatDateTime(u.lastSignInAt)}` : 'Nunca entrou'}</span>
                </div>
              </div>
              <div className="list__end">
                <button className="btn btn--sm" disabled={busy} onClick={() => setPwFor(u)} aria-label={`Trocar a senha de ${u.username ?? u.email}`}><LuKeyRound /> Senha</button>
                {!u.isAdmin && (
                  <button className="btn btn--sm" disabled={busy} onClick={() => void run(() => api.adminSetAccess(u.id, !u.access), u.access ? 'Acesso retirado.' : 'Acesso liberado.')}>
                    {u.access ? 'Bloquear' : 'Liberar'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="row">
        <button className="btn btn--sm btn--primary" onClick={() => setCreate(true)}><LuUserPlus /> Criar conta</button>
        <button className="btn btn--sm" disabled={busy} onClick={() => void load()}><LuRefreshCw /> Atualizar</button>
      </div>
      <CreateUser open={create} busy={busy} onClose={() => setCreate(false)} onCreate={async (u, p) => (await run(() => api.adminCreateUser(u, p), `Conta ${u.trim().toLowerCase()} criada.`)) && setCreate(false)} />
      <SetPassword user={pwFor} busy={busy} onClose={() => setPwFor(null)} onSave={async (p) => pwFor && (await run(() => api.adminSetPassword(pwFor.id, p), 'Senha alterada.')) && setPwFor(null)} />
    </section>
  );
}

function CreateUser({ open, busy, onClose, onCreate }: { open: boolean; busy: boolean; onClose: () => void; onCreate: (username: string, password: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    if (open) {
      setUsername('');
      setPassword('');
      setConfirm('');
      setErr('');
    }
  }, [open]);
  const submit = () => (password !== confirm ? setErr('As senhas não conferem.') : onCreate(username, password));
  return (
    <Modal open={open} onClose={onClose} title="Criar conta" footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" disabled={busy || !username || !password || !confirm} onClick={submit}>Criar conta</button></>}>
      <div className="form">
        <Field label="Nome de usuário" hint="3 a 30 caracteres: letras sem acento, números, ponto, hífen ou sublinhado."><input className="input" autoCapitalize="none" autoComplete="off" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
        <Field label="Senha provisória" hint="Mínimo de 8 caracteres. Combine com a pessoa e peça para ela trocar no primeiro acesso."><input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field label="Confirmar senha"><input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        {err && <p className="form-error" role="alert">{err}</p>}
      </div>
    </Modal>
  );
}

function SetPassword({ user, busy, onClose, onSave }: { user: AdminUser | null; busy: boolean; onClose: () => void; onSave: (password: string) => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    setPassword('');
    setConfirm('');
    setErr('');
  }, [user]);
  const submit = () => (password !== confirm ? setErr('As senhas não conferem.') : onSave(password));
  return (
    <Modal open={!!user} onClose={onClose} title={`Nova senha para ${user?.username ?? user?.email ?? ''}`} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" disabled={busy || !password || !confirm} onClick={submit}>Salvar senha</button></>}>
      <div className="form">
        <Field label="Nova senha" hint="Mínimo de 8 caracteres."><input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field label="Confirmar nova senha"><input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        {err && <p className="form-error" role="alert">{err}</p>}
      </div>
    </Modal>
  );
}

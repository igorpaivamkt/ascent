import { useEffect, useState } from 'react';
import { LuCalendar, LuCheck, LuEye, LuEyeOff, LuGift, LuHeart, LuLock, LuPencil, LuPlus, LuTrash2, LuX } from 'react-icons/lu';
import { useAppState, useDispatch, useStore } from '../../app/store';
import { formatDate, formatMonth, monthKey } from '../../domain/dates';
import type { RelCommitment, RelDate, RelExpense, RelExperience, RelPreference, RelProfile, RelWish } from '../../domain/types';
import { ConfirmButton, Empty, Field, Modal, Segmented, Tabs } from '../../components/ui';
import { useToday } from '../../hooks/useGame';
import { initials, money, money0, parseNumber } from '../../utils/format';
import { compressImage } from '../../utils/image';
import { DemoBanner } from '../settings/DemoBanner';
import { ExperienceForm } from './ExperienceForm';
import { ProfileTab } from './ProfileTab';
import { CommitmentEditForm, DateEditForm, EXPENSE_CATEGORIES, ExpenseEditForm, PreferenceEditForm, WishEditForm } from './RelEditForms';

type Tab = 'perfil' | 'preferencias' | 'experiencias' | 'gastos' | 'compromissos' | 'privado';

function useMediaUrl(id: string | null): string | null {
  const store = useStore();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!id) return setUrl(null);
    store.media.get(id).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [id, store]);
  return url;
}

export function RelationshipPage() {
  const state = useAppState();
  const profile = state.relationship.profiles[0];
  const [tab, setTab] = useState<Tab>('perfil');
  const [editProfile, setEditProfile] = useState(false);
  if (!profile) return <><DemoBanner /><ProfileForm open inline onClose={() => undefined} /></>;
  return (
    <>
      <DemoBanner />
      <header className="page-head">
        <div className="rel-profile">
          <ProfilePhoto profile={profile} />
          <div>
            <h1>{profile.name}</h1>
            <p>{profile.nickname ? `“${profile.nickname}” · ` : ''}{profile.since ? `Juntos desde ${formatDate(profile.since, { year: true })}` : 'Memória pessoal estruturada'}</p>
          </div>
        </div>
        <button className="btn btn--sm" onClick={() => setEditProfile(true)}><LuPencil /> Editar perfil</button>
      </header>
      <p className="note small" style={{ marginBottom: 16 }}><LuLock />Espaço privado para ser mais atento e presente. Não há pontuações sobre sentimentos ou compromisso da outra pessoa — e nada daqui aparece em notificações.</p>
      <Tabs value={tab} onChange={setTab} label="Seções do relacionamento" options={[{ value: 'perfil', label: 'Perfil' }, { value: 'preferencias', label: 'Preferências' }, { value: 'experiencias', label: 'Experiências' }, { value: 'gastos', label: 'Gastos' }, { value: 'compromissos', label: 'Compromissos' }, { value: 'privado', label: 'Dados privados' }]} />
      {tab === 'perfil' && <ProfileTab profile={profile} />}
      {tab === 'preferencias' && <Preferences profile={profile} />}
      {tab === 'experiencias' && <Experiences profile={profile} />}
      {tab === 'gastos' && <Expenses profile={profile} />}
      {tab === 'compromissos' && <Commitments profile={profile} />}
      {tab === 'privado' && <PrivateDetails profile={profile} />}
      <ProfileForm open={editProfile} onClose={() => setEditProfile(false)} profile={profile} />
    </>
  );
}

function ProfilePhoto({ profile }: { profile: RelProfile }) {
  const url = useMediaUrl(profile.photoId);
  return <span className="rel-photo" aria-hidden="true">{url ? <img src={url} alt="" /> : initials(profile.name)}</span>;
}

function ProfileForm({ open, onClose, profile, inline }: { open: boolean; onClose: () => void; profile?: RelProfile; inline?: boolean }) {
  const dispatch = useDispatch();
  const store = useStore();
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [since, setSince] = useState('');
  const [notes, setNotes] = useState('');
  const [photoId, setPhotoId] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setName(profile?.name ?? '');
    setNickname(profile?.nickname ?? '');
    setSince(profile?.since ?? '');
    setNotes(profile?.notes ?? '');
    setPhotoId(profile?.photoId ?? null);
  }, [open, profile]);
  const pick = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    try {
      const data = await compressImage(f, 400, 0.75);
      const id = `avatar-${Date.now()}`;
      await store.media.put(id, data);
      setPhotoId(id);
    } catch (e) {
      store.notify({ tone: 'error', message: e instanceof Error ? e.message : 'Falha na foto.' });
    }
  };
  const save = async () => {
    const ok = await dispatch({ type: 'rel/upsert', entity: 'profiles', value: { id: profile?.id, name, nickname, since: since || null, notes, photoId } });
    if (ok) onClose();
  };
  const body = (
    <div className="form">
      <Field label="Nome ou apelido"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <div className="form-row">
        <Field label="Como você a/o chama (opcional)"><input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} /></Field>
        <Field label="Juntos desde (opcional)"><input className="input" type="date" value={since} onChange={(e) => setSince(e.target.value)} /></Field>
      </div>
      <Field label="Foto (opcional)" hint="Armazenada apenas neste dispositivo."><input className="input" type="file" accept="image/*" onChange={(e) => pick(e.target.files)} /></Field>
      {photoId && <button type="button" className="btn btn--sm" onClick={() => setPhotoId(null)}>Remover foto</button>}
      <Field label="Observações"><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
    </div>
  );
  if (inline) {
    return (
      <section className="card" style={{ maxWidth: 640 }}>
        <h1 style={{ marginBottom: 6 }}>Relacionamento</h1>
        <p className="muted" style={{ marginBottom: 16 }}>Crie um perfil para registrar preferências, datas, experiências e gastos — de forma privada.</p>
        {body}
        <div className="modal__foot"><button className="btn btn--primary" onClick={save}>Criar perfil</button></div>
      </section>
    );
  }
  return <Modal open={open} onClose={onClose} title="Perfil" footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={save}>Salvar</button></>}>{body}</Modal>;
}

const PREF_CATEGORIES = ['Comida', 'Bebida', 'Cor', 'Flores', 'Livros', 'Filmes e séries', 'Música', 'Hobbies', 'Lugares', 'Tamanhos', 'Estilo de presente', 'Outro'];

function Preferences({ profile }: { profile: RelProfile }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = useToday();
  const prefs = state.relationship.preferences.filter((p) => p.profileId === profile.id);
  const dates = state.relationship.dates.filter((d) => d.profileId === profile.id);
  const wishes = state.relationship.wishes.filter((w) => w.profileId === profile.id);
  const [category, setCategory] = useState('Comida');
  const [value, setValue] = useState('');
  const [certainty, setCertainty] = useState<'confirmada' | 'suposicao'>('confirmada');
  const [dateForm, setDateForm] = useState({ title: '', date: today, yearly: true });
  const [wish, setWish] = useState<{ title: string; kind: RelWish['kind'] }>({ title: '', kind: 'presente' });
  const [editPref, setEditPref] = useState<RelPreference | null>(null);
  const [editDate, setEditDate] = useState<RelDate | null>(null);
  const [editWish, setEditWish] = useState<RelWish | null>(null);
  const grouped = [...new Set(prefs.map((p) => p.category))];
  return (
    <div className="grid grid--2">
      <section className="card" aria-labelledby="pref-h">
        <div className="card__head"><h2 id="pref-h"><LuHeart aria-hidden="true" /> Preferências</h2></div>
        {grouped.length ? grouped.map((c) => (
          <div key={c} style={{ marginBottom: 12 }}>
            <h3 className="xs muted" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c}</h3>
            <div className="pref-chips">
              {prefs.filter((p) => p.category === c).map((p) => (
                <span key={p.id} className={`chip ${p.certainty === 'suposicao' ? 'is-assumed' : ''} ${p.outdated ? 'is-outdated' : ''}`} title={`${p.certainty === 'suposicao' ? 'Suposição' : 'Confirmada'} · registrada em ${formatDate(p.recordedAt.slice(0, 10), { year: true })}`}>
                  {p.value}{p.certainty === 'suposicao' && <span className="xs muted"> (suposição)</span>}
                  {p.certainty === 'suposicao' && <button type="button" aria-label={`Confirmar ${p.value}`} onClick={() => dispatch({ type: 'rel/upsert', entity: 'preferences', value: { ...p, certainty: 'confirmada' } })}><LuCheck size={13} /></button>}
                  <button type="button" aria-label={`${p.outdated ? 'Reativar' : 'Marcar como desatualizada'}: ${p.value}`} onClick={() => dispatch({ type: 'rel/upsert', entity: 'preferences', value: { ...p, outdated: !p.outdated } })}><LuCalendar size={13} /></button>
                  <button type="button" aria-label={`Editar ${p.value}`} onClick={() => setEditPref(p)}><LuPencil size={13} /></button>
                  <button type="button" aria-label={`Remover ${p.value}`} onClick={() => dispatch({ type: 'rel/remove', entity: 'preferences', id: p.id })}><LuX size={13} /></button>
                </span>
              ))}
            </div>
          </div>
        )) : <p className="muted small">Nenhuma preferência registrada.</p>}
        <div className="form" style={{ marginTop: 12 }}>
          <div className="form-row">
            <Field label="Categoria"><select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>{PREF_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Preferência"><input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex.: Culinária japonesa" /></Field>
          </div>
          <Segmented value={certainty} onChange={setCertainty} label="Grau de certeza" options={[{ value: 'confirmada', label: 'Ela/ele me disse' }, { value: 'suposicao', label: 'É uma suposição' }]} />
          <button className="btn btn--primary" onClick={async () => { if (await dispatch({ type: 'rel/upsert', entity: 'preferences', value: { profileId: profile.id, category, value, certainty, outdated: false } })) setValue(''); }}><LuPlus /> Adicionar preferência</button>
        </div>
      </section>
      <div className="stack">
        <section className="card" aria-labelledby="dates-h">
          <div className="card__head"><h2 id="dates-h"><LuCalendar aria-hidden="true" /> Datas importantes</h2></div>
          <ul className="list">
            {dates.map((d) => (
              <li key={d.id}><div className="list__main"><div className="list__title">{d.title}</div><div className="list__meta">{formatDate(d.date, { year: !d.yearly })}{d.yearly ? ' · todo ano' : ''}</div></div>
                <div className="list__end">
                  <button className="icon-btn" aria-label={`Editar ${d.title}`} onClick={() => setEditDate(d)}><LuPencil /></button>
                  <ConfirmButton className="icon-btn" ariaLabel={`Remover ${d.title}`} confirmLabel="Remover" onConfirm={() => dispatch({ type: 'rel/remove', entity: 'dates', id: d.id })}><LuTrash2 /></ConfirmButton>
                </div></li>
            ))}
          </ul>
          <div className="form-row" style={{ marginTop: 10 }}>
            <Field label="Nome da data"><input className="input" value={dateForm.title} onChange={(e) => setDateForm({ ...dateForm, title: e.target.value })} placeholder="Ex.: Aniversário" /></Field>
            <Field label="Dia"><input className="input" type="date" value={dateForm.date} onChange={(e) => setDateForm({ ...dateForm, date: e.target.value })} /></Field>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <label className="check"><input type="checkbox" checked={dateForm.yearly} onChange={(e) => setDateForm({ ...dateForm, yearly: e.target.checked })} /> Repete todo ano</label>
            <button className="btn btn--sm" onClick={async () => { if (await dispatch({ type: 'rel/upsert', entity: 'dates', value: { profileId: profile.id, ...dateForm } })) setDateForm({ title: '', date: today, yearly: true }); }}><LuPlus /> Adicionar</button>
          </div>
        </section>
        <section className="card" aria-labelledby="wish-h">
          <div className="card__head"><h2 id="wish-h"><LuGift aria-hidden="true" /> Desejos e ideias</h2></div>
          <ul className="list">
            {wishes.map((w) => (
              <li key={w.id}>
                <span className="tick-wrap"><button type="button" role="checkbox" className="tick" aria-checked={w.status === 'realizado'} aria-label={`${w.status === 'realizado' ? 'Reabrir' : 'Marcar como realizado'}: ${w.title}`} onClick={() => dispatch({ type: 'rel/toggle', entity: 'wishes', id: w.id })}><LuCheck /></button></span>
                <div className="list__main"><div className="list__title">{w.title}</div><div className="list__meta">{w.kind}{w.note ? ` · ${w.note}` : ''}</div></div>
                <div className="list__end">
                  <button className="icon-btn" aria-label={`Editar ${w.title}`} onClick={() => setEditWish(w)}><LuPencil /></button>
                  <ConfirmButton className="icon-btn" ariaLabel={`Remover ${w.title}`} confirmLabel="Remover" onConfirm={() => dispatch({ type: 'rel/remove', entity: 'wishes', id: w.id })}><LuTrash2 /></ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
          <div className="form-row" style={{ marginTop: 10 }}>
            <Field label="Ideia"><input className="input" value={wish.title} onChange={(e) => setWish({ ...wish, title: e.target.value })} /></Field>
            <Field label="Tipo"><select className="select" value={wish.kind} onChange={(e) => setWish({ ...wish, kind: e.target.value as RelWish['kind'] })}><option value="presente">Presente</option><option value="experiencia">Experiência</option><option value="lugar">Lugar</option></select></Field>
          </div>
          <button className="btn btn--sm" style={{ marginTop: 8 }} onClick={async () => { if (await dispatch({ type: 'rel/upsert', entity: 'wishes', value: { profileId: profile.id, title: wish.title, kind: wish.kind, status: 'pendente', note: '' } })) setWish({ title: '', kind: 'presente' }); }}><LuPlus /> Adicionar</button>
        </section>
      </div>
      <PreferenceEditForm key={editPref?.id ?? 'none'} item={editPref} categories={PREF_CATEGORIES} onClose={() => setEditPref(null)} />
      <DateEditForm key={editDate?.id ?? 'none'} item={editDate} onClose={() => setEditDate(null)} />
      <WishEditForm key={editWish?.id ?? 'none'} wish={editWish} onClose={() => setEditWish(null)} />
    </div>
  );
}

function ExperiencePhotos({ ids }: { ids: string[] }) {
  return <div className="photo-row">{ids.map((id) => <Photo key={id} id={id} />)}</div>;
}
function Photo({ id }: { id: string }) {
  const url = useMediaUrl(id);
  return url ? <img src={url} alt="Foto da experiência" loading="lazy" /> : null;
}

function Experiences({ profile }: { profile: RelProfile }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const [form, setForm] = useState<{ open: boolean; exp: RelExperience | null }>({ open: false, exp: null });
  const list = state.relationship.experiences.filter((e) => e.profileId === profile.id).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="card" aria-labelledby="exp-h">
      <div className="card__head">
        <h2 id="exp-h">Linha do tempo</h2>
        <button className="btn btn--sm btn--primary spacer" onClick={() => setForm({ open: true, exp: null })}><LuPlus /> Experiência</button>
      </div>
      {list.length ? (
        <ul className="list">
          {list.map((e) => {
            const spent = state.relationship.expenses.filter((x) => x.experienceId === e.id).reduce((a, x) => a + x.amount, 0);
            return (
              <li key={e.id} style={{ alignItems: 'flex-start' }}>
                <div className="list__main">
                  <div className="list__title">{e.title}</div>
                  <div className="list__meta"><span>{formatDate(e.date, { year: true })}</span>{e.location && <span>{e.location}</span>}<span>{e.type}</span>{spent > 0 && <span>Gastos: {money(spent)}</span>}</div>
                  {e.description && <p className="small" style={{ marginTop: 4 }}>{e.description}</p>}
                  {e.learnings && <p className="small muted" style={{ marginTop: 2 }}>Aprendizado: {e.learnings}</p>}
                  {e.photoIds.length > 0 && <ExperiencePhotos ids={e.photoIds} />}
                </div>
                <div className="list__end">
                  <button className="icon-btn" aria-label={`Editar ${e.title}`} onClick={() => setForm({ open: true, exp: e })}><LuPencil /></button>
                  <ConfirmButton className="icon-btn" ariaLabel={`Excluir ${e.title}`} confirmLabel="Excluir" onConfirm={() => dispatch({ type: 'rel/remove', entity: 'experiences', id: e.id })}><LuTrash2 /></ConfirmButton>
                </div>
              </li>
            );
          })}
        </ul>
      ) : <Empty icon={<LuHeart />}>Registre a primeira experiência compartilhada.</Empty>}
      <ExperienceForm open={form.open} experience={form.exp} onClose={() => setForm({ open: false, exp: null })} />
    </section>
  );
}

function Expenses({ profile }: { profile: RelProfile }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = useToday();
  const list = state.relationship.expenses.filter((e) => e.profileId === profile.id).sort((a, b) => b.date.localeCompare(a.date));
  const exps = state.relationship.experiences.filter((e) => e.profileId === profile.id);
  const store = useStore();
  const [f, setF] = useState({ description: '', amount: '', category: 'Restaurantes', date: today, experienceId: '', paidBy: 'eu' as RelExpense['paidBy'] });
  const [alsoFinance, setAlsoFinance] = useState(true);
  const [editExp, setEditExp] = useState<RelExpense | null>(null);
  const byMonth = new Map<string, number>();
  const byCat = new Map<string, number>();
  for (const e of list) {
    byMonth.set(monthKey(e.date), (byMonth.get(monthKey(e.date)) ?? 0) + e.amount);
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  }
  const year = list.filter((e) => e.date.startsWith(today.slice(0, 4))).reduce((a, e) => a + e.amount, 0);
  return (
    <div className="grid grid--2">
      <section className="card" aria-labelledby="exs-h">
        <div className="card__head"><h2 id="exs-h">Gastos registrados</h2></div>
        <dl className="kv" style={{ marginBottom: 12 }}>
          <div><dt>Este mês</dt><dd>{money0(byMonth.get(monthKey(today)) ?? 0)}</dd></div>
          <div><dt>No ano</dt><dd>{money0(year)}</dd></div>
          <div><dt>Total registrado</dt><dd>{money0(list.reduce((a, e) => a + e.amount, 0))}</dd></div>
        </dl>
        <ul className="list">
          {list.map((e) => (
            <li key={e.id}>
              <div className="list__main"><div className="list__title">{e.description}</div><div className="list__meta"><span>{formatDate(e.date)}</span><span>{e.category}</span><span>Pago por: {e.paidBy}</span>{e.experienceId && <span>{exps.find((x) => x.id === e.experienceId)?.title}</span>}{e.txId && <span className="chip chip--muted rel-linked">em Finanças</span>}</div></div>
              <span className="tx-amount">{money(e.amount)}</span>
              <div className="list__end">
                <button className="icon-btn" aria-label={`Editar ${e.description}`} onClick={() => setEditExp(e)}><LuPencil /></button>
                <ConfirmButton className="icon-btn" ariaLabel={`Excluir ${e.description}`} confirmLabel="Excluir" onConfirm={() => dispatch({ type: 'rel/remove', entity: 'expenses', id: e.id })}><LuTrash2 /></ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
        <p className="xs muted" style={{ marginTop: 8 }}>Valores registrados não medem afeto nem compromisso — servem para planejar o orçamento de experiências.</p>
        <ExpenseEditForm key={editExp?.id ?? 'none'} expense={editExp} profile={profile} onClose={() => setEditExp(null)} />
      </section>
      <div className="stack">
        <section className="card" aria-labelledby="exn-h">
          <div className="card__head"><h2 id="exn-h">Novo gasto</h2></div>
          <div className="form">
            <Field label="Descrição"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            <div className="form-row">
              <Field label="Valor (R$)"><input className="input num" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
              <Field label="Data"><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            </div>
            <div className="form-row">
              <Field label="Categoria"><select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Pago por"><select className="select" value={f.paidBy} onChange={(e) => setF({ ...f, paidBy: e.target.value as RelExpense['paidBy'] })}><option value="eu">Eu</option><option value="dividido">Dividido</option><option value="outra pessoa">Outra pessoa</option></select></Field>
            </div>
            <Field label="Experiência relacionada"><select className="select" value={f.experienceId} onChange={(e) => setF({ ...f, experienceId: e.target.value })}><option value="">Nenhuma</option>{exps.map((x) => <option key={x.id} value={x.id}>{x.title} ({formatDate(x.date)})</option>)}</select></Field>
            {f.paidBy !== 'outra pessoa' && (
              <label className="check"><input type="checkbox" checked={alsoFinance} onChange={(e) => setAlsoFinance(e.target.checked)} /> Lançar também em Finanças (categoria Relacionamento)</label>
            )}
            <button className="btn btn--primary" onClick={async () => {
              const amount = parseNumber(f.amount);
              const base = { profileId: profile.id, description: f.description, amount, category: f.category, date: f.date, experienceId: f.experienceId || null, paidBy: f.paidBy };
              let txId: string | null = null;
              if (alsoFinance && f.paidBy !== 'outra pessoa') {
                if (!f.description.trim() || !(amount > 0)) return store.notify({ tone: 'error', message: 'Preencha a descrição e um valor maior que zero.' });
                const findCat = () => store.getState().finance.categories.find((c) => c.kind === 'expense' && c.name.trim().toLowerCase() === 'relacionamento');
                if (!findCat() && !(await dispatch({ type: 'category/add', name: 'Relacionamento', kind: 'expense' }))) return;
                const before = new Set(store.getState().finance.transactions.map((t) => t.id));
                const accountId = store.getState().finance.accounts[0]?.id ?? '';
                if (!(await dispatch({ type: 'tx/upsert', tx: { description: `${f.description.trim()} (${profile.name})`, amount, type: 'expense', categoryId: findCat()!.id, accountId, date: f.date, status: 'settled', incomeClass: null, origin: 'Relacionamento', note: '' } }))) return;
                txId = store.getState().finance.transactions.find((t) => !before.has(t.id))?.id ?? null;
              }
              const ok = await dispatch({ type: 'rel/upsert', entity: 'expenses', value: { ...base, txId } });
              if (ok) setF({ ...f, description: '', amount: '' });
            }}><LuPlus /> Registrar gasto</button>
          </div>
        </section>
        <section className="card" aria-labelledby="exm-h">
          <div className="card__head"><h2 id="exm-h">Por período e categoria</h2></div>
          <ul className="list small">
            {[...byMonth.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 6).map(([m, v]) => <li key={m}><div className="list__main">{formatMonth(m, true)}</div><strong className="num">{money0(v)}</strong></li>)}
          </ul>
          <div className="pref-chips" style={{ marginTop: 10 }}>{[...byCat.entries()].map(([c, v]) => <span key={c} className="chip chip--muted">{c}: {money0(v)}</span>)}</div>
        </section>
      </div>
    </div>
  );
}

function Commitments({ profile }: { profile: RelProfile }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = useToday();
  const list = state.relationship.commitments.filter((c) => c.profileId === profile.id).sort((a, b) => a.status.localeCompare(b.status) || a.dueDate.localeCompare(b.dueDate));
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(today);
  const [edit, setEdit] = useState<RelCommitment | null>(null);
  return (
    <section className="card" aria-labelledby="cm-h">
      <div className="card__head"><h2 id="cm-h">Compromissos e acordos</h2></div>
      {list.length ? (
        <ul className="list">
          {list.map((c) => (
            <li key={c.id}>
              <span className="tick-wrap"><button type="button" role="checkbox" className="tick" aria-checked={c.status === 'done'} aria-label={`${c.status === 'done' ? 'Reabrir' : 'Cumprir'}: ${c.title}`} onClick={() => dispatch({ type: 'rel/toggle', entity: 'commitments', id: c.id })}><LuCheck /></button></span>
              <div className="list__main"><div className={`list__title ${c.status === 'done' ? 'muted' : ''}`}>{c.title}</div><div className="list__meta">{c.status === 'done' ? 'Cumprido' : `Até ${formatDate(c.dueDate, { year: true })}`}{c.status !== 'done' && c.dueDate < today ? ' · atrasado' : ''}</div></div>
              <div className="list__end">
                <button className="icon-btn" aria-label={`Editar ${c.title}`} onClick={() => setEdit(c)}><LuPencil /></button>
                <ConfirmButton className="icon-btn" ariaLabel={`Remover ${c.title}`} confirmLabel="Remover" onConfirm={() => dispatch({ type: 'rel/remove', entity: 'commitments', id: c.id })}><LuTrash2 /></ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="muted small">Nenhum compromisso registrado.</p>}
      <div className="form-row" style={{ marginTop: 12 }}>
        <Field label="Compromisso"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Reservar restaurante" /></Field>
        <Field label="Prazo"><input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      </div>
      <button className="btn btn--sm btn--primary" style={{ marginTop: 10 }} onClick={async () => { if (await dispatch({ type: 'rel/upsert', entity: 'commitments', value: { profileId: profile.id, title, dueDate: due, status: 'pending' } })) setTitle(''); }}><LuPlus /> Adicionar</button>
      <CommitmentEditForm key={edit?.id ?? 'none'} item={edit} onClose={() => setEdit(null)} />
    </section>
  );
}

function PrivateDetails({ profile }: { profile: RelProfile }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const rec = state.relationship.privateDetails.find((p) => p.profileId === profile.id);
  const [reveal, setReveal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [edit, setEdit] = useState(false);
  const [address, setAddress] = useState('');
  const [cep, setCep] = useState('');
  useEffect(() => setReveal(false), [rec?.updatedAt]);
  const mask = (s: string) => (s ? s.replace(/[^\s]/g, '•').slice(0, 24) : '—');
  return (
    <section className="card" aria-labelledby="pv-h" style={{ maxWidth: 640 }}>
      <div className="card__head"><h2 id="pv-h"><LuLock aria-hidden="true" /> Endereço de entrega</h2></div>
      <p className="small muted" style={{ marginBottom: 12 }}>Opcional. Guarde apenas se for realmente necessário (ex.: enviar um presente). Fica mascarado, nunca aparece em resumos, notificações ou na tela inicial, e pode ser apagado a qualquer momento.</p>
      {rec && !edit ? (
        <>
          <dl className="kv">
            <div><dt>Endereço</dt><dd className={reveal ? '' : 'masked'}>{reveal ? rec.address || '—' : mask(rec.address)}</dd></div>
            <div><dt>CEP</dt><dd className={reveal ? '' : 'masked'}>{reveal ? rec.postalCode || '—' : mask(rec.postalCode)}</dd></div>
          </dl>
          <div className="row" style={{ marginTop: 12 }}>
            {reveal ? <button className="btn btn--sm" onClick={() => setReveal(false)}><LuEyeOff /> Ocultar</button> : confirm ? (
              <><span className="small">Exibir dados sensíveis nesta tela?</span><button className="btn btn--sm btn--primary" onClick={() => { setReveal(true); setConfirm(false); }}>Exibir</button><button className="btn btn--sm" onClick={() => setConfirm(false)}>Cancelar</button></>
            ) : <button className="btn btn--sm" onClick={() => setConfirm(true)}><LuEye /> Mostrar</button>}
            <button className="btn btn--sm" onClick={() => { setAddress(rec.address); setCep(rec.postalCode); setEdit(true); }}><LuPencil /> Editar</button>
            <ConfirmButton confirmLabel="Apagar dados" onConfirm={() => dispatch({ type: 'rel/private/clear', profileId: profile.id })}><LuTrash2 /> Apagar</ConfirmButton>
          </div>
        </>
      ) : (
        <div className="form">
          <Field label="Endereço"><input className="input" autoComplete="off" value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
          <Field label="CEP"><input className="input" inputMode="numeric" autoComplete="off" value={cep} onChange={(e) => setCep(e.target.value)} /></Field>
          <div className="row">
            <button className="btn btn--primary" onClick={async () => { if (await dispatch({ type: 'rel/private/set', profileId: profile.id, address, postalCode: cep })) { setEdit(false); setAddress(''); setCep(''); } }}>Salvar</button>
            {edit && <button className="btn" onClick={() => setEdit(false)}>Cancelar</button>}
          </div>
          <p className="xs muted">No protótipo os dados ficam no armazenamento local deste navegador, sem criptografia. Na versão com backend, este campo será criptografado no servidor.</p>
        </div>
      )}
    </section>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { LuCheck, LuGift, LuPencil, LuPlus, LuRuler, LuTrash2 } from 'react-icons/lu';
import { useAppState, useDispatch, useStore } from '../../app/store';
import { formatDate } from '../../domain/dates';
import {
  ageOn, DEFAULT_GROUP, entriesOf, FIELD_SUGGESTIONS, groupFields, missingSuggestions, sectionsOf, SIZES_GROUP,
  type FieldSuggestion, type SectionView,
} from '../../domain/relationshipProfile';
import type { RelEntry, RelProfile, RelSectionKind, RelWish } from '../../domain/types';
import { ConfirmButton, Empty, Field, Modal, Segmented } from '../../components/ui';
import { useToday } from '../../hooks/useGame';

const GIFTS = 'presentes';

/**
 * Aba "Perfil" do relacionamento: uma ficha da pessoa montada por você. Abas fixas (Perfil,
 * Personalidade, Qualidades, Defeitos, Presentes) e abas próprias, cada uma com campos
 * "nome → valor" ou com uma lista de itens.
 */
export function ProfileTab({ profile }: { profile: RelProfile }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const sections = sectionsOf(state, profile.id);
  const tabs: { id: string; title: string; count: number }[] = [
    ...sections.slice(0, 4).map((s) => ({ id: s.id, title: s.title, count: entriesOf(state, profile.id, s.id).length })),
    { id: GIFTS, title: 'Presentes', count: state.relationship.wishes.filter((w) => w.profileId === profile.id && w.kind === 'presente' && w.status === 'pendente').length },
    ...sections.slice(4).map((s) => ({ id: s.id, title: s.title, count: entriesOf(state, profile.id, s.id).length })),
  ];
  const [active, setActive] = useState('perfil');
  const [sectionForm, setSectionForm] = useState<{ open: boolean; section: SectionView | null }>({ open: false, section: null });
  const current = tabs.some((t) => t.id === active) ? active : 'perfil';
  const section = sections.find((s) => s.id === current);

  return (
    <div className="ficha">
      <div className="subtabs" role="tablist" aria-label="Abas do perfil">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" id={`ficha-tab-${t.id}`} aria-controls="ficha-panel" aria-selected={current === t.id} onClick={() => setActive(t.id)}>
            {t.title}{t.count > 0 && <span className="subtabs__count" aria-label={`${t.count} ${t.count === 1 ? 'item' : 'itens'}`}>{t.count}</span>}
          </button>
        ))}
        <button type="button" className="subtabs__add" onClick={() => setSectionForm({ open: true, section: null })}><LuPlus /> Nova aba</button>
      </div>
      <div id="ficha-panel" role="tabpanel" aria-labelledby={`ficha-tab-${current}`}>
        {current === GIFTS ? (
          <Gifts profile={profile} />
        ) : section ? (
          <section className="card ficha__card" aria-labelledby="ficha-h">
            <div className="card__head">
              <h2 id="ficha-h">{section.title}</h2>
              {!section.builtIn && (
                <div className="list__end spacer">
                  <button className="icon-btn" aria-label={`Renomear a aba ${section.title}`} onClick={() => setSectionForm({ open: true, section })}><LuPencil /></button>
                  <ConfirmButton className="icon-btn" ariaLabel={`Excluir a aba ${section.title}`} confirmLabel="Excluir aba e itens" onConfirm={() => dispatch({ type: 'rel/remove', entity: 'sections', id: section.id })}><LuTrash2 /></ConfirmButton>
                </div>
              )}
            </div>
            {section.hint && <p className="small muted ficha__hint">{section.hint}</p>}
            {section.kind === 'fields' ? <Fields profile={profile} section={section} /> : <ListItems profile={profile} section={section} />}
          </section>
        ) : null}
      </div>
      <SectionForm open={sectionForm.open} section={sectionForm.section} profile={profile} onClose={() => setSectionForm({ open: false, section: null })} onCreated={(id) => setActive(id)} />
    </div>
  );
}

// ───────────────────────── Campos "nome → valor"
function Fields({ profile, section }: { profile: RelProfile; section: SectionView }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = useToday();
  const fields = entriesOf(state, profile.id, section.id);
  const [form, setForm] = useState<{ open: boolean; entry: RelEntry | null; preset: FieldSuggestion | null }>({ open: false, entry: null, preset: null });
  const isPerfil = section.id === 'perfil';
  const suggestions = isPerfil ? missingSuggestions(fields) : [];
  return (
    <>
      {fields.length ? (
        groupFields(fields).map(({ group, items }) => (
          <div key={group} className="facts">
            {(isPerfil || groupFields(fields).length > 1) && <h3 className="facts__group">{group}</h3>}
            <dl>
              {items.map((e) => {
                const age = e.format === 'data' && /nasc/i.test(e.label) ? ageOn(e.value, today) : null;
                return (
                  <div key={e.id} className="facts__row">
                    <dt>{e.label}</dt>
                    <dd>
                      <span className="facts__value">{e.format === 'data' ? formatDate(e.value, { year: true }) : e.value}{age !== null && <span className="muted"> · {age} anos</span>}</span>
                      {e.note && <span className="facts__note">{e.note}</span>}
                    </dd>
                    <div className="list__end">
                      <button className="icon-btn" aria-label={`Editar ${e.label}`} onClick={() => setForm({ open: true, entry: e, preset: null })}><LuPencil /></button>
                      <ConfirmButton className="icon-btn" ariaLabel={`Remover ${e.label}`} confirmLabel="Remover" onConfirm={() => dispatch({ type: 'rel/remove', entity: 'entries', id: e.id })}><LuTrash2 /></ConfirmButton>
                    </div>
                  </div>
                );
              })}
            </dl>
          </div>
        ))
      ) : (
        <Empty>{isPerfil ? 'Nenhum campo ainda. Use as sugestões abaixo ou crie um campo com o nome que quiser.' : 'Nenhum campo ainda.'}</Empty>
      )}
      <button className="btn btn--primary btn--block" style={{ marginTop: 12 }} onClick={() => setForm({ open: true, entry: null, preset: null })}><LuPlus /> Adicionar campo</button>
      {suggestions.length > 0 && (
        <div className="ficha__suggest">
          <p className="xs muted">Sugestões (um toque e você só digita o valor):</p>
          <div className="pref-chips">
            {suggestions.map((s) => (
              <button key={s.label} type="button" className="chip chip--muted chip--btn" onClick={() => setForm({ open: true, entry: null, preset: s })}><LuPlus /> {s.label}</button>
            ))}
          </div>
        </div>
      )}
      <FieldForm open={form.open} entry={form.entry} preset={form.preset} profile={profile} section={section} existing={fields} onClose={() => setForm({ open: false, entry: null, preset: null })} />
    </>
  );
}

function FieldForm({ open, onClose, entry, preset, profile, section, existing }: {
  open: boolean; onClose: () => void; entry: RelEntry | null; preset: FieldSuggestion | null; profile: RelProfile; section: SectionView; existing: RelEntry[];
}) {
  const dispatch = useDispatch();
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [group, setGroup] = useState('');
  const [note, setNote] = useState('');
  const [format, setFormat] = useState<'texto' | 'data'>('texto');
  useEffect(() => {
    if (!open) return;
    setLabel(entry?.label ?? preset?.label ?? '');
    setValue(entry?.value ?? '');
    setGroup(entry?.group || preset?.group || (section.id === 'perfil' ? DEFAULT_GROUP : ''));
    setNote(entry?.note ?? '');
    setFormat(entry?.format ?? preset?.format ?? 'texto');
  }, [open, entry, preset, section.id]);
  const groups = [...new Set([...(section.id === 'perfil' ? FIELD_SUGGESTIONS.map((f) => f.group) : []), ...existing.map((e) => e.group).filter(Boolean), DEFAULT_GROUP])];
  const placeholder = preset?.placeholder ?? FIELD_SUGGESTIONS.find((f) => f.label.toLowerCase() === label.trim().toLowerCase())?.placeholder ?? '';
  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    const ok = await dispatch({ type: 'rel/upsert', entity: 'entries', value: { id: entry?.id, profileId: profile.id, sectionId: section.id, label, value, note, group, format } });
    if (ok) onClose();
  };
  const valueField = (
    <Field label={label.trim() ? label.trim() : 'Valor'}>
      <input className="input" type={format === 'data' ? 'date' : 'text'} value={value} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
    </Field>
  );
  const labelField = (
    <Field label="Nome do campo" hint="Você define o tema. Ex.: Cor favorita, Número do calçado, Time.">
      <input className="input" list="ficha-labels" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Cor favorita" />
      <datalist id="ficha-labels">{FIELD_SUGGESTIONS.map((f) => <option key={f.label} value={f.label} />)}</datalist>
    </Field>
  );
  return (
    <Modal open={open} onClose={onClose} title={entry ? `Editar ${entry.label}` : preset ? preset.label : 'Novo campo'} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={() => void save()}>Salvar</button></>}>
      <form className="form" onSubmit={save}>
        {preset ? <>{valueField}{labelField}</> : <>{labelField}{valueField}</>}
        <Segmented value={format} onChange={(f) => { setFormat(f); if (f === 'data' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) setValue(''); }} label="Tipo do valor" options={[{ value: 'texto', label: 'Texto ou número' }, { value: 'data', label: 'Data' }]} />
        <Field label="Grupo" hint="Organiza os campos dentro da aba.">
          <input className="input" list="ficha-groups" value={group} onChange={(e) => setGroup(e.target.value)} />
          <datalist id="ficha-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
        </Field>
        <Field label="Observação (opcional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: na Arezzo veste 36" /></Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

// ───────────────────────── Listas (personalidade, qualidades, defeitos, abas próprias)
function ListItems({ profile, section }: { profile: RelProfile; section: SectionView }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const items = entriesOf(state, profile.id, section.id);
  const [text, setText] = useState('');
  const [edit, setEdit] = useState<RelEntry | null>(null);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (await dispatch({ type: 'rel/upsert', entity: 'entries', value: { profileId: profile.id, sectionId: section.id, label: '', value: text, note: '', group: '', format: 'texto' } })) setText('');
  };
  return (
    <>
      {items.length ? (
        <ul className="list">
          {items.map((e) => (
            <li key={e.id}>
              <div className="list__main">
                <div className="list__title">{e.value}</div>
                {e.note && <div className="list__meta">{e.note}</div>}
              </div>
              <div className="list__end">
                <button className="icon-btn" aria-label={`Editar ${e.value}`} onClick={() => setEdit(e)}><LuPencil /></button>
                <ConfirmButton className="icon-btn" ariaLabel={`Remover ${e.value}`} confirmLabel="Remover" onConfirm={() => dispatch({ type: 'rel/remove', entity: 'entries', id: e.id })}><LuTrash2 /></ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Nada registrado em {section.title.toLowerCase()} ainda.</Empty>
      )}
      <form className="ficha__add" onSubmit={add}>
        <label className="sr-only" htmlFor={`add-${section.id}`}>Novo item em {section.title}</label>
        <input id={`add-${section.id}`} className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Adicionar em ${section.title.toLowerCase()}…`} />
        <button type="submit" className="btn btn--primary" disabled={!text.trim()}><LuPlus /> Adicionar</button>
      </form>
      <ItemForm entry={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function ItemForm({ entry, onClose }: { entry: RelEntry | null; onClose: () => void }) {
  const dispatch = useDispatch();
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    setValue(entry?.value ?? '');
    setNote(entry?.note ?? '');
  }, [entry]);
  const save = async () => {
    if (entry && (await dispatch({ type: 'rel/upsert', entity: 'entries', value: { ...entry, value, note } }))) onClose();
  };
  return (
    <Modal open={!!entry} onClose={onClose} title="Editar item" footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={() => void save()}>Salvar</button></>}>
      <div className="form">
        <Field label="Item"><input className="input" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
        <Field label="Detalhe (opcional)"><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: em que situação isso aparece, como lidar" /></Field>
      </div>
    </Modal>
  );
}

// ───────────────────────── Presentes (desejos do tipo presente)
function Gifts({ profile }: { profile: RelProfile }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const gifts = state.relationship.wishes.filter((w) => w.profileId === profile.id && w.kind === 'presente');
  const sizes = entriesOf(state, profile.id, 'perfil').filter((e) => e.group === SIZES_GROUP);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [edit, setEdit] = useState<RelWish | null>(null);
  const pending = gifts.filter((g) => g.status === 'pendente');
  const done = gifts.filter((g) => g.status === 'realizado');
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (await dispatch({ type: 'rel/upsert', entity: 'wishes', value: { profileId: profile.id, title, kind: 'presente', status: 'pendente', note } })) {
      setTitle('');
      setNote('');
    }
  };
  const row = (w: RelWish) => (
    <li key={w.id}>
      <span className="tick-wrap"><button type="button" role="checkbox" className="tick" aria-checked={w.status === 'realizado'} aria-label={`${w.status === 'realizado' ? 'Desmarcar' : 'Marcar como dado'}: ${w.title}`} onClick={() => dispatch({ type: 'rel/toggle', entity: 'wishes', id: w.id })}><LuCheck /></button></span>
      <div className="list__main"><div className="list__title">{w.title}</div>{w.note && <div className="list__meta">{w.note}</div>}</div>
      <div className="list__end">
        <button className="icon-btn" aria-label={`Editar ${w.title}`} onClick={() => setEdit(w)}><LuPencil /></button>
        <ConfirmButton className="icon-btn" ariaLabel={`Remover ${w.title}`} confirmLabel="Remover" onConfirm={() => dispatch({ type: 'rel/remove', entity: 'wishes', id: w.id })}><LuTrash2 /></ConfirmButton>
      </div>
    </li>
  );
  return (
    <div className="stack">
      <section className="card ficha__card" aria-labelledby="gift-h">
        <div className="card__head"><h2 id="gift-h"><LuGift aria-hidden="true" /> Desejos de presente</h2></div>
        <p className="small muted ficha__hint">O que ela/ele comentou que queria. Marque quando der o presente.</p>
        {pending.length ? <ul className="list">{pending.map(row)}</ul> : <Empty>Nenhum desejo de presente mapeado ainda.</Empty>}
        <form className="form" style={{ marginTop: 12 }} onSubmit={add}>
          <Field label="Desejo"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Tênis branco de couro" /></Field>
          <Field label="Detalhes (opcional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Onde vende, cor, preço, link…" /></Field>
          <button type="submit" className="btn btn--primary" disabled={!title.trim()}><LuPlus /> Adicionar desejo</button>
        </form>
        {done.length > 0 && (
          <details className="ficha__done">
            <summary className="small strong">Já dados ({done.length})</summary>
            <ul className="list">{done.map(row)}</ul>
          </details>
        )}
      </section>
      <section className="card ficha__card" aria-labelledby="sizes-h">
        <div className="card__head"><h2 id="sizes-h"><LuRuler aria-hidden="true" /> Tamanhos à mão</h2></div>
        {sizes.length ? (
          <dl className="sizes">{sizes.map((s) => <div key={s.id}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}</dl>
        ) : (
          <p className="small muted">Cadastre calçado, roupa e outras medidas na aba Perfil (grupo "{SIZES_GROUP}") e elas aparecem aqui na hora de comprar.</p>
        )}
      </section>
      <GiftForm wish={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function GiftForm({ wish, onClose }: { wish: RelWish | null; onClose: () => void }) {
  const dispatch = useDispatch();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    setTitle(wish?.title ?? '');
    setNote(wish?.note ?? '');
  }, [wish]);
  const save = async () => {
    if (wish && (await dispatch({ type: 'rel/upsert', entity: 'wishes', value: { ...wish, title, note } }))) onClose();
  };
  return (
    <Modal open={!!wish} onClose={onClose} title="Editar desejo" footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={() => void save()}>Salvar</button></>}>
      <div className="form">
        <Field label="Desejo"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Detalhes"><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

// ───────────────────────── Nova aba / renomear
function SectionForm({ open, onClose, section, profile, onCreated }: { open: boolean; onClose: () => void; section: SectionView | null; profile: RelProfile; onCreated: (id: string) => void }) {
  const state = useAppState();
  const store = useStore();
  const dispatch = useDispatch();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<RelSectionKind>('list');
  useEffect(() => {
    if (!open) return;
    setTitle(section?.title ?? '');
    setKind(section?.kind ?? 'list');
  }, [open, section]);
  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    const before = new Set(state.relationship.sections.map((s) => s.id));
    const ok = await dispatch({ type: 'rel/upsert', entity: 'sections', value: { id: section?.id, profileId: profile.id, title, kind } });
    if (!ok) return;
    onClose();
    // Abre a aba recém-criada (o id é gerado pelo motor).
    const created = section ? null : store.getState().relationship.sections.find((x) => !before.has(x.id) && x.profileId === profile.id);
    if (created) onCreated(created.id);
  };
  return (
    <Modal open={open} onClose={onClose} title={section ? 'Renomear aba' : 'Nova aba'} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={() => void save()}>{section ? 'Salvar' : 'Criar aba'}</button></>}>
      <form className="form" onSubmit={save}>
        <Field label="Nome da aba"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Sonhos, Família, Medos, Rotina" /></Field>
        {!section && (
          <div className="choice-grid" role="radiogroup" aria-label="Tipo da aba">
            <button type="button" className="choice" role="radio" aria-checked={kind === 'list'} aria-pressed={kind === 'list'} onClick={() => setKind('list')}>
              <strong>Lista</strong><span>Itens soltos, como em Qualidades. Ex.: sonhos, medos.</span>
            </button>
            <button type="button" className="choice" role="radio" aria-checked={kind === 'fields'} aria-pressed={kind === 'fields'} onClick={() => setKind('fields')}>
              <strong>Campos</strong><span>Nome e valor, como no Perfil. Ex.: Mãe → Marta.</span>
            </button>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

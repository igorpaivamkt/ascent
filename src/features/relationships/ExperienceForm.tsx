import { useEffect, useState } from 'react';
import { useAppState, useDispatch, useStore } from '../../app/store';
import type { RelExperience } from '../../domain/types';
import { Field, Modal } from '../../components/ui';
import { useToday } from '../../hooks/useGame';
import { parseNumber } from '../../utils/format';
import { compressImage } from '../../utils/image';

const TYPES: { value: RelExperience['type']; label: string }[] = [
  { value: 'encontro', label: 'Encontro' }, { value: 'passeio', label: 'Passeio' }, { value: 'viagem', label: 'Viagem' }, { value: 'presente', label: 'Presente' },
  { value: 'celebracao', label: 'Celebração' }, { value: 'conversa', label: 'Conversa importante' }, { value: 'atividade', label: 'Atividade juntos' }, { value: 'outro', label: 'Outro' },
];

export function ExperienceForm({ open, onClose, experience }: { open: boolean; onClose: () => void; experience?: RelExperience | null }) {
  const state = useAppState();
  const store = useStore();
  const dispatch = useDispatch();
  const today = useToday();
  const profile = state.relationship.profiles[0];
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [location, setLocation] = useState('');
  const [type, setType] = useState<RelExperience['type']>('encontro');
  const [description, setDescription] = useState('');
  const [learnings, setLearnings] = useState('');
  const [cost, setCost] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(experience?.title ?? '');
    setDate(experience?.date ?? today);
    setLocation(experience?.location ?? '');
    setType(experience?.type ?? 'encontro');
    setDescription(experience?.description ?? '');
    setLearnings(experience?.learnings ?? '');
    setCost('');
    setPhotos(experience?.photoIds ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, experience]);

  if (!profile) {
    return (
      <Modal open={open} onClose={onClose} title="Registrar experiência">
        <p className="muted">Crie primeiro um perfil na área Relacionamento.</p>
      </Modal>
    );
  }

  const addPhoto = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of [...files].slice(0, 3 - photos.length)) {
        const data = await compressImage(file, 900, 0.72);
        const id = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        await store.media.put(id, data);
        setPhotos((p) => [...p, id]);
      }
    } catch (e) {
      store.notify({ tone: 'error', message: e instanceof Error ? e.message : 'Não foi possível adicionar a foto.' });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const ok = await dispatch({ type: 'rel/upsert', entity: 'experiences', value: { id: experience?.id, profileId: profile.id, title, date, location, type, description, learnings, photoIds: photos } });
    if (!ok) return;
    const value = parseNumber(cost);
    if (!experience && Number.isFinite(value) && value > 0) {
      const created = store.getState().relationship.experiences.find((e) => e.title === title.trim() && e.date === date);
      await dispatch({ type: 'rel/upsert', entity: 'expenses', value: { profileId: profile.id, experienceId: created?.id ?? null, description: title, amount: value, category: 'Experiências', date, paidBy: 'eu' } });
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={experience ? 'Editar experiência' : 'Registrar experiência'} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={save} disabled={busy}>Salvar</button></>}>
      <div className="form">
        <Field label="O que vocês fizeram?"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Jantar no restaurante novo" /></Field>
        <div className="form-row">
          <Field label="Data"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Tipo">
            <select className="select" value={type} onChange={(e) => setType(e.target.value as RelExperience['type'])}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Local"><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Opcional" /></Field>
        <Field label="Descrição"><textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="O que aprendi (reflexão pessoal)"><textarea className="textarea" value={learnings} onChange={(e) => setLearnings(e.target.value)} /></Field>
        {!experience && <Field label="Gasto relacionado (R$)" hint="Opcional — cria um gasto vinculado a esta experiência."><input className="input num" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0,00" /></Field>}
        <Field label={`Fotos (${photos.length}/3)`} hint="Ficam somente neste dispositivo, comprimidas.">
          <input className="input" type="file" accept="image/*" multiple disabled={photos.length >= 3 || busy} onChange={(e) => addPhoto(e.target.files)} />
        </Field>
        {photos.length > 0 && (
          <div className="row">
            {photos.map((id) => (
              <button key={id} type="button" className="btn btn--sm" onClick={() => setPhotos((p) => p.filter((x) => x !== id))}>Remover foto {photos.indexOf(id) + 1}</button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

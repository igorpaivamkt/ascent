import { useState } from 'react';
import { LuBookOpen, LuBookPlus, LuCheck, LuPause, LuPencil, LuPlay, LuPlus, LuTrash2, LuTrophy } from 'react-icons/lu';
import { useAppState, useDispatch } from '../../app/store';
import { ACHIEVEMENTS, computeStats } from '../../domain/achievements';
import { addDays, formatDate } from '../../domain/dates';
import type { BookDraft } from '../../domain/engine';
import { bookStatus, countsPages, pagesRead, readingStreak, type BookStatusView } from '../../domain/reading';
import type { Book, ReadingLog } from '../../domain/types';
import { ConfirmButton, Empty, Field, Modal, Progress } from '../../components/ui';
import { useToday } from '../../hooks/useGame';
import { integer, plural } from '../../utils/format';

/** Leitura: livros em andamento, páginas, ritmo para o prazo, estante e conquistas de leitura. */
export function ReadingView({ onNewHabit }: { onNewHabit: () => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = useToday();
  const [bookForm, setBookForm] = useState<{ open: boolean; book: Book | null }>({ open: false, book: null });
  const [logForm, setLogForm] = useState<{ bookId: string; log: ReadingLog | null } | null>(null);
  const [finish, setFinish] = useState<Book | null>(null);
  const books = state.reading.books;
  const active = books.filter((b) => b.status === 'reading' || b.status === 'paused').map((b) => bookStatus(state, b, today));
  const shelf = books.filter((b) => b.status === 'finished' || b.status === 'abandoned').sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
  const total = pagesRead(state);
  const habit = state.habits.find((h) => h.status === 'active' && countsPages(h));
  const stats = computeStats(state, today);
  const unlocked = new Set(state.achievements.map((a) => a.code));
  const next = ACHIEVEMENTS.filter((a) => a.category === 'leitura' && !unlocked.has(a.code))
    .map((a) => ({ a, p: a.progress(stats) }))
    .sort((x, y) => x.p[0] / x.p[1] - y.p[0] / y.p[1])
    .reverse()
    .slice(0, 3);

  return (
    <div className="stack">
      <dl className="fin-top">
        <div className="stat"><dt>Páginas lidas</dt><dd>{integer(total)}</dd><small>Hábito + leituras avulsas</small></div>
        <div className="stat"><dt>Livros concluídos</dt><dd>{books.filter((b) => b.status === 'finished').length}</dd><small>{active.length} em andamento</small></div>
        <div className="stat"><dt>Melhor sequência</dt><dd>{plural(readingStreak(state), "dia", "dias")}</dd><small>Dias seguidos com leitura</small></div>
      </dl>

      {!habit && (
        <div className="note small reading-tip">
          <LuBookOpen aria-hidden="true" />
          <span>Crie um hábito na categoria <strong>Leitura</strong> com meta em <strong>páginas</strong> (ex.: 10 páginas por dia). Cada dia concluído soma no livro atual e nas conquistas.</span>
          <button className="btn btn--sm" onClick={onNewHabit}><LuPlus /> Hábito de leitura</button>
        </div>
      )}

      <section className="card" aria-labelledby="rd-h">
        <div className="card__head">
          <h2 id="rd-h"><LuBookOpen aria-hidden="true" /> Lendo agora</h2>
          <button className="btn btn--sm btn--primary spacer" onClick={() => setBookForm({ open: true, book: null })}><LuBookPlus /> Livro</button>
        </div>
        {active.length ? (
          <ul className="list savings-list">
            {active.map((s) => <BookRow key={s.book.id} s={s} pace={habit?.target ?? null} onLog={() => setLogForm({ bookId: s.book.id, log: null })} onEdit={() => setBookForm({ open: true, book: s.book })} onFinish={() => setFinish(s.book)} />)}
          </ul>
        ) : (
          <Empty icon={<LuBookOpen />}>Coloque o livro que você está lendo, com o número de páginas e um prazo. O app calcula quantas páginas por dia para terminar a tempo.</Empty>
        )}
      </section>

      {next.length > 0 && (
        <section className="card" aria-labelledby="rd-ach">
          <div className="card__head"><h2 id="rd-ach"><LuTrophy aria-hidden="true" /> Próximas conquistas de leitura</h2></div>
          <ul className="list">
            {next.map(({ a, p }) => (
              <li key={a.code}>
                <div className="list__main">
                  <div className="list__title">{a.title}</div>
                  <div className="list__meta"><span>{a.description}</span></div>
                  <Progress value={p[0] / p[1]} label={`Progresso: ${a.title}`} thin />
                </div>
                <span className="num small">{integer(Math.min(p[0], p[1]))}/{integer(p[1])}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ReadingHistory onEdit={(l) => setLogForm({ bookId: l.bookId, log: l })} />

      {shelf.length > 0 && (
        <section className="card" aria-labelledby="rd-shelf">
          <div className="card__head"><h2 id="rd-shelf">Estante</h2></div>
          <ul className="list">
            {shelf.map((b) => {
              const st = bookStatus(state, b, today);
              return (
                <li key={b.id}>
                  <div className="list__main">
                    <div className="list__title">{b.title}</div>
                    <div className="list__meta">
                      {b.author && <span>{b.author}</span>}
                      <span>{b.totalPages} páginas</span>
                      {b.status === 'finished' ? <span>Concluído em {formatDate(b.finishedAt, { year: true })}</span> : <span>Deixado de lado</span>}
                      {st.finishedOnTime && <span className="tag">No prazo</span>}
                    </div>
                  </div>
                  <button className="btn btn--sm" onClick={() => void dispatch({ type: 'reading/book/setStatus', bookId: b.id, status: 'reading' })}>Reabrir</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <BookForm key={bookForm.book?.id ?? (bookForm.open ? 'novo' : 'fechado')} open={bookForm.open} book={bookForm.book} onClose={() => setBookForm({ open: false, book: null })} />
      {logForm && <LogForm key={logForm.log?.id ?? logForm.bookId} {...logForm} onClose={() => setLogForm(null)} />}
      {finish && <FinishForm key={finish.id} book={finish} onClose={() => setFinish(null)} />}
    </div>
  );
}

function BookRow({ s, pace, onLog, onEdit, onFinish }: { s: BookStatusView; pace: number | null; onLog: () => void; onEdit: () => void; onFinish: () => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = useToday();
  const goal = s.book.goalId ? state.goals.find((g) => g.id === s.book.goalId) : null;
  const paused = s.book.status === 'paused';
  const daysAtPace = pace && pace > 0 ? Math.ceil(s.left / pace) : null;
  const eta = daysAtPace !== null ? addDays(today, Math.max(0, daysAtPace - 1)) : null;
  const late = s.book.targetDate && eta && eta > s.book.targetDate;
  return (
    <li className={`savings-box ${paused ? 'is-archived' : ''}`}>
      <div className="savings-box__head">
        <div className="list__main">
          <div className="list__title">{s.book.title}{paused && <span className="tag" style={{ marginLeft: 6 }}>Pausado</span>}</div>
          <div className="list__meta">
            {s.book.author && <span>{s.book.author}</span>}
            <span>Desde {formatDate(s.book.startDate)}</span>
            {s.book.targetDate && <span>Prazo {formatDate(s.book.targetDate, { year: true })}</span>}
            {goal && <span>Meta: {goal.title}</span>}
          </div>
        </div>
        <strong className="savings-box__balance">{Math.round(s.progress * 100)}%</strong>
      </div>
      <Progress value={s.progress} label={`Progresso de ${s.book.title}`} />
      <dl className="savings-box__facts">
        <div><dt>Lidas</dt><dd>{s.read} de {s.book.totalPages}</dd></div>
        <div><dt>Faltam</dt><dd>{s.left} páginas</dd></div>
        {s.perDay !== null && <div><dt>Para terminar no prazo</dt><dd className={pace !== null && s.perDay > pace ? 'warn' : ''}>{s.perDay} páginas/dia</dd></div>}
        {eta && !s.readyToFinish && <div><dt>No ritmo do hábito ({pace}/dia)</dt><dd className={late ? 'warn' : ''}>termina ~{formatDate(eta)}</dd></div>}
      </dl>
      {s.readyToFinish && (
        <div className="note small reading-done">
          <LuCheck aria-hidden="true" /> <span>Você chegou na última página. Marque como concluído para ganhar a conquista.</span>
        </div>
      )}
      <div className="row" style={{ gap: 6 }}>
        <button className="btn btn--sm btn--primary" onClick={onFinish}><LuCheck /> Concluir livro</button>
        <button className="btn btn--sm" onClick={onLog}><LuPlus /> Registrar leitura</button>
        <button className="icon-btn" aria-label={`Editar ${s.book.title}`} onClick={onEdit}><LuPencil /></button>
        <button className="icon-btn" aria-label={paused ? `Retomar ${s.book.title}` : `Pausar ${s.book.title}`} onClick={() => dispatch({ type: 'reading/book/setStatus', bookId: s.book.id, status: paused ? 'reading' : 'paused' })}>{paused ? <LuPlay /> : <LuPause />}</button>
      </div>
    </li>
  );
}

function ReadingHistory({ onEdit }: { onEdit: (l: ReadingLog) => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const fromHabit = pagesRead(state) - state.reading.logs.reduce((a, l) => a + l.pages, 0);
  const logs = [...state.reading.logs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 30);
  const title = (id: string) => state.reading.books.find((b) => b.id === id)?.title ?? 'Livro';
  if (!logs.length && !fromHabit) return null;
  return (
    <section className="card" aria-labelledby="rd-hist">
      <div className="card__head"><h2 id="rd-hist">Histórico de leitura</h2></div>
      {fromHabit > 0 && <p className="small muted" style={{ marginBottom: 6 }}>{integer(fromHabit)} páginas vieram do hábito de leitura (edite na Rotina, em ⋯ do dia).</p>}
      <ul className="list">
        {logs.map((l) => (
          <li key={l.id}>
            <div className="list__main">
              <div className="list__title">{l.pages} páginas · {title(l.bookId)}</div>
              <div className="list__meta"><span>{formatDate(l.date, { year: true })}</span>{l.note && <span>{l.note}</span>}</div>
            </div>
            <button className="icon-btn" aria-label="Editar leitura" onClick={() => onEdit(l)}><LuPencil /></button>
            <ConfirmButton onConfirm={() => void dispatch({ type: 'reading/log/remove', logId: l.id })} className="icon-btn" ariaLabel="Excluir leitura" confirmLabel="Excluir"><LuTrash2 /></ConfirmButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BookForm({ open, book, onClose }: { open: boolean; book: Book | null; onClose: () => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = useToday();
  const [d, setD] = useState<BookDraft>(() => (book ? { id: book.id, title: book.title, author: book.author, totalPages: book.totalPages, startDate: book.startDate, targetDate: book.targetDate, goalId: book.goalId } : { title: '', author: '', totalPages: 0, startDate: today, targetDate: null, goalId: null }));
  const up = (p: Partial<BookDraft>) => setD((x) => ({ ...x, ...p }));
  const goals = state.goals.filter((g) => g.status === 'active' && g.metricSource === 'manual');
  const read = book ? pagesRead(state, book.id) : 0;
  const days = d.targetDate && d.targetDate >= today ? Math.round((Date.parse(`${d.targetDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000) + 1 : null;
  const perDay = days && d.totalPages > 0 ? Math.ceil(Math.max(0, d.totalPages - read) / days) : null;
  const save = async () => {
    if (await dispatch({ type: 'reading/book/upsert', book: d })) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={book ? 'Editar livro' : 'Novo livro'} footer={<>
      {book && <ConfirmButton onConfirm={async () => { if (await dispatch({ type: 'reading/book/remove', bookId: book.id })) onClose(); }} className="btn btn--danger" confirmLabel="Excluir livro">Excluir</ConfirmButton>}
      <span className="spacer" />
      <button className="btn" onClick={onClose}>Cancelar</button>
      <button className="btn btn--primary" onClick={save}>Salvar</button>
    </>}>
      <div className="form">
        <Field label="Livro"><input className="input" value={d.title} onChange={(e) => up({ title: e.target.value })} placeholder="Ex.: Hábitos Atômicos" /></Field>
        <div className="form-row">
          <Field label="Autor (opcional)"><input className="input" value={d.author} onChange={(e) => up({ author: e.target.value })} /></Field>
          <Field label="Total de páginas"><input className="input" inputMode="numeric" value={d.totalPages ? String(d.totalPages) : ''} onChange={(e) => up({ totalPages: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></Field>
        </div>
        <div className="form-row">
          <Field label="Comecei em"><input className="input" type="date" value={d.startDate} onChange={(e) => up({ startDate: e.target.value })} /></Field>
          <Field label="Quero terminar até (opcional)"><input className="input" type="date" value={d.targetDate ?? ''} min={d.startDate} onChange={(e) => up({ targetDate: e.target.value || null })} /></Field>
        </div>
        {perDay !== null && <p className="note small">Para terminar até {formatDate(d.targetDate, { year: true })}: <strong>{perDay} páginas por dia</strong> ({days} dias).</p>}
        <Field label="Objetivo ligado (opcional)" hint="O objetivo recebe as páginas lidas; se for de sim/não, vira 1 quando você concluir o livro.">
          <select className="select" value={d.goalId ?? ''} onChange={(e) => up({ goalId: e.target.value || null })}>
            <option value="">Nenhum</option>
            {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function LogForm({ bookId, log, onClose }: { bookId: string; log: ReadingLog | null; onClose: () => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = useToday();
  const [book, setBook] = useState(log?.bookId ?? bookId);
  const [date, setDate] = useState(log?.date ?? today);
  const [pages, setPages] = useState(log ? String(log.pages) : '');
  const [note, setNote] = useState(log?.note ?? '');
  const books = state.reading.books.filter((b) => b.status !== 'finished' || b.id === book);
  const save = async () => {
    if (await dispatch({ type: 'reading/log/upsert', log: { id: log?.id, bookId: book, date, pages: Number(pages) || 0, note } })) onClose();
  };
  return (
    <Modal open onClose={onClose} title={log ? 'Editar leitura' : 'Registrar leitura'} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={save}>Salvar</button></>}>
      <div className="form">
        <Field label="Livro">
          <select className="select" value={book} onChange={(e) => setBook(e.target.value)}>
            {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        </Field>
        <div className="form-row">
          <Field label="Páginas lidas"><input className="input" inputMode="numeric" autoFocus value={pages} onChange={(e) => setPages(e.target.value.replace(/\D/g, ''))} placeholder="Ex.: 12" /></Field>
          <Field label="Dia"><input className="input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Observação"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" /></Field>
        <p className="xs muted">Use para leitura fora do hábito. O hábito de leitura já soma sozinho no livro atual.</p>
      </div>
    </Modal>
  );
}

function FinishForm({ book, onClose }: { book: Book; onClose: () => void }) {
  const dispatch = useDispatch();
  const today = useToday();
  const [date, setDate] = useState(today);
  const save = async () => {
    if (await dispatch({ type: 'reading/book/setStatus', bookId: book.id, status: 'finished', date })) onClose();
  };
  return (
    <Modal open onClose={onClose} title="Concluir livro" footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={save}><LuCheck /> Concluir</button></>}>
      <div className="form">
        <p><strong>{book.title}</strong>{book.targetDate ? ` · prazo ${formatDate(book.targetDate, { year: true })}` : ''}</p>
        <Field label="Terminei em"><input className="input" type="date" value={date} min={book.startDate} max={today} onChange={(e) => setDate(e.target.value)} /></Field>
        <p className="xs muted">Conta para as conquistas de livros. Se terminar até o prazo, ganha também “No prazo”.</p>
      </div>
    </Modal>
  );
}

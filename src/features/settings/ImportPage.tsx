import { useMemo, useState } from 'react';
import { LuCheck, LuFileUp, LuLock, LuTriangleAlert } from 'react-icons/lu';
import { Link } from '../../app/router';
import { useAppState, useStore, useSyncStatus, type ImportOutcome } from '../../app/store';
import { IMPORT_MODULES, MODULE_LABEL, parsePackage, planImport, type ImportPackage } from '../../domain/importPackage';

/**
 * Importar um pacote de dados preparado fora do app (ex.: pelo Claude a partir de conversas e extratos).
 * Mostra tudo antes de gravar; você pode desmarcar itens. Itens já importados nunca são duplicados.
 */
export function ImportPage() {
  const state = useAppState();
  const store = useStore();
  const cloud = useSyncStatus().mode === 'cloud';
  const [text, setText] = useState('');
  const [pkg, setPkg] = useState<ImportPackage | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportOutcome | null>(null);

  const load = (raw: string) => {
    setError('');
    setResult(null);
    try {
      const p = parsePackage(JSON.parse(raw));
      setPkg(p);
      setSelected(new Set(p.steps.map((s) => s.id)));
    } catch (e) {
      setPkg(null);
      setError(e instanceof SyntaxError ? 'O conteúdo não é um JSON válido.' : e instanceof Error ? e.message : 'Arquivo inválido.');
    }
  };
  const pick = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (f.size > 5_000_000) return setError('Arquivo grande demais (máximo 5 MB).');
    const raw = await f.text();
    setText('');
    load(raw);
  };

  const status = useMemo(() => (pkg ? planImport(pkg, state, selected) : new Map()), [pkg, state, selected]);
  const ready = pkg ? pkg.steps.filter((s) => selected.has(s.id) && (status.get(s.id) === 'ready' || status.get(s.id) === 'reuse')).length : 0;
  const done = pkg ? pkg.steps.filter((s) => status.get(s.id) === 'done').length : 0;

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    on ? next.add(id) : next.delete(id);
    setSelected(next);
  };
  const toggleModule = (ids: string[], on: boolean) => {
    const next = new Set(selected);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    setSelected(next);
  };
  const run = async () => {
    if (!pkg) return;
    setBusy(true);
    setError('');
    try {
      const r = await store.runImport(pkg, selected);
      setResult(r);
      if (r.applied) store.notify({ tone: 'success', message: `${r.applied} ${r.applied === 1 ? 'item importado' : 'itens importados'}.` });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao importar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="page-head"><div><h1>Importar dados</h1><p>Revise o pacote antes de gravar. Nada é duplicado.</p></div></header>
      <div className="stack import">
        {!pkg && (
          <section className="card settings-section" aria-labelledby="imp-h">
            <h2 id="imp-h"><LuFileUp aria-hidden="true" /> Escolha o pacote</h2>
            <p className="small muted">Um arquivo <code>.json</code> no formato de pacote do ASCENT. {cloud ? 'Os itens vão para a sua conta e são conferidos pelo servidor.' : 'Os itens vão para a jornada deste aparelho.'}</p>
            <label className="btn btn--primary btn--block"><LuFileUp /> Escolher arquivo<input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void pick(e.target.files)} /></label>
            <details>
              <summary className="small strong" style={{ cursor: 'pointer', minHeight: 40, display: 'flex', alignItems: 'center' }}>Ou cole o conteúdo</summary>
              <div className="form" style={{ marginTop: 8 }}>
                <label className="sr-only" htmlFor="imp-text">Conteúdo do pacote</label>
                <textarea id="imp-text" className="textarea" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder='{"format": "ascent-import", …}' />
                <button className="btn" disabled={!text.trim()} onClick={() => load(text)}>Ler pacote</button>
              </div>
            </details>
            {error && <p className="form-error" role="alert">{error}</p>}
          </section>
        )}

        {pkg && (
          <>
            <section className="card settings-section" aria-labelledby="pkg-h">
              <h2 id="pkg-h">{pkg.title}</h2>
              {pkg.description && <p className="small">{pkg.description}</p>}
              {pkg.notes?.length ? <ul className="import__notes">{pkg.notes.map((n) => <li key={n} className="small">{n}</li>)}</ul> : null}
              <p className="small muted">{pkg.steps.length} itens{done ? ` · ${done} já importados antes` : ''}</p>
            </section>

            {IMPORT_MODULES.map((m) => {
              const steps = pkg.steps.filter((s) => s.module === m);
              if (!steps.length) return null;
              const selectable = steps.filter((s) => status.get(s.id) !== 'done').map((s) => s.id);
              const allOn = selectable.length > 0 && selectable.every((id) => selected.has(id));
              return (
                <section key={m} className="card" aria-labelledby={`imp-${m}`}>
                  <div className="card__head">
                    <h2 id={`imp-${m}`}>{MODULE_LABEL[m]} <span className="muted small">({steps.length})</span></h2>
                    {selectable.length > 0 && (
                      <label className="check spacer small"><input type="checkbox" checked={allOn} onChange={(e) => toggleModule(selectable, e.target.checked)} /> Todos</label>
                    )}
                  </div>
                  <ul className="list import__list">
                    {steps.map((s) => {
                      const st = status.get(s.id);
                      return (
                        <li key={s.id} className={st === 'done' ? 'is-done' : st === 'blocked' ? 'is-blocked' : ''}>
                          <label className="import__item">
                            <input type="checkbox" disabled={st === 'done'} checked={st === 'done' || selected.has(s.id)} onChange={(e) => toggle(s.id, e.target.checked)} />
                            <span className="list__main">
                              <span className="list__title">{s.label}{s.sensitive && <span className="chip chip--muted import__tag"><LuLock aria-hidden="true" /> sensível</span>}</span>
                              {s.detail && <span className="list__meta">{s.detail}</span>}
                              {st === 'done' && <span className="list__meta"><LuCheck aria-hidden="true" /> já importado</span>}
                              {st === 'reuse' && <span className="list__meta"><LuCheck aria-hidden="true" /> já existe no app: será aproveitado, sem duplicar</span>}
                              {st === 'blocked' && <span className="list__meta"><LuTriangleAlert aria-hidden="true" /> depende de um item desmarcado</span>}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}

            <section className="card settings-section import__actions" aria-live="polite">
              {result ? (
                <>
                  <p className="strong">{result.applied} importado(s){result.skipped ? ` · ${result.skipped} já existiam` : ''}{result.failed.length ? ` · ${result.failed.length} com erro` : ''}.</p>
                  {result.failed.length > 0 && (
                    <ul className="import__notes">{result.failed.map((f) => <li key={f.id} className="small"><strong>{f.label}</strong>: {f.error}</li>)}</ul>
                  )}
                  {cloud && result.applied > 0 && <p className="xs muted">Os itens aparecem na hora e são enviados ao servidor em seguida. Acompanhe o selo de sincronização no topo.</p>}
                  <div className="row">
                    <Link to="/" className="btn btn--primary">Ir para o início</Link>
                    <button className="btn" onClick={() => { setPkg(null); setResult(null); }}>Importar outro</button>
                  </div>
                </>
              ) : (
                <>
                  {error && <p className="form-error" role="alert">{error}</p>}
                  <button className="btn btn--primary btn--block" disabled={busy || ready === 0} onClick={() => void run()}>
                    {busy ? 'Importando…' : ready ? `Importar ${ready} ${ready === 1 ? 'item' : 'itens'}` : 'Nada novo para importar'}
                  </button>
                  <button className="btn btn--ghost btn--block" disabled={busy} onClick={() => setPkg(null)}>Cancelar</button>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}

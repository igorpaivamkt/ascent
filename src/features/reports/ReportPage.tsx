import { useMemo, useState, type ReactNode } from 'react';
import { LuArrowLeft, LuDownload, LuPrinter } from 'react-icons/lu';
import { useAppState } from '../../app/store';
import { getAchievement } from '../../domain/achievements';
import { formatDate, formatDateTime } from '../../domain/dates';
import { rangeSummary, rangeTransactions, totalBalance, TX_STATUS_LABEL } from '../../domain/finance';
import { ageOn, entriesOf, groupFields, sectionsOf } from '../../domain/relationshipProfile';
import { defaultSelection, isPix, relReportBlocks, relReportData, type DateRange, type RelBlock, type RelBlockGroup } from '../../domain/relationshipReport';
import { PeriodPicker } from '../../components/PeriodPicker';
import { boxStatus, freeCash, totalSaved } from '../../domain/savings';
import type { AppState, ISODate } from '../../domain/types';
import { useToday } from '../../hooks/useGame';
import { metric, money, money0, percent } from '../../utils/format';
import { periodData } from '../review/ReviewPage';

export type ReportKind = 'financas' | 'relacionamento' | 'revisao';

function query(): URLSearchParams {
  const q = location.hash.split('?')[1];
  return new URLSearchParams(q ?? '');
}

/**
 * Relatório para exportar: página de "papel" com a identidade do ASCENT. "Salvar PDF" usa a impressão do
 * navegador (no celular: Compartilhar/Imprimir → Salvar como PDF). "Baixar arquivo" gera um .html
 * independente, para guardar ou abrir em qualquer aparelho.
 */
export function ReportPage({ kind }: { kind: ReportKind }) {
  const state = useAppState();
  const today = useToday();
  const q = query();
  const from = q.get('de') ?? `${today.slice(0, 7)}-01`;
  const to = q.get('ate') ?? today;
  const profileId = state.relationship.profiles[0]?.id ?? '';
  const [relRange, setRelRange] = useState<DateRange | null>(() => (q.get('de') && q.get('ate') ? { from: q.get('de')!, to: q.get('ate')! } : null));
  const blocks = useMemo(() => (kind === 'relacionamento' ? relReportBlocks(state, profileId, relRange) : []), [kind, state, profileId, relRange]);
  const [selected, setSelected] = useState<Set<string>>(() => loadSelection(kind === 'relacionamento' ? relReportBlocks(state, profileId, null) : []));
  const updateSelection = (next: Set<string>) => { setSelected(next); saveSelection(blocks, next); };
  const toggle = (id: string) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); updateSelection(n); };
  const fileFrom = kind === 'relacionamento' ? relRange?.from ?? 'inicio' : from;
  const fileTo = kind === 'relacionamento' ? relRange?.to ?? today : to;
  const title = kind === 'financas' ? 'Relatório financeiro' : kind === 'relacionamento' ? 'Relatório do relacionamento' : 'Revisão';
  const back = kind === 'financas' ? '#/financas' : kind === 'relacionamento' ? '#/relacionamento' : '#/revisao';

  const download = () => {
    const page = document.querySelector('.report-paper');
    if (!page) return;
    const css = [...document.styleSheets].map((sh) => { try { return [...sh.cssRules].map((r) => r.cssText).join('\n'); } catch { return ''; } }).join('\n')
      .replace(/url\((['"]?)(?!data:|https?:)([^'")]+)\1\)/g, (_m, _q, u) => `url("${new URL(u, location.href).href}")`);
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · ASCENT</title><style>${css}</style></head><body class="report-body">${page.outerHTML}</body></html>`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = `ascent-${kind}-${fileFrom}-a-${fileTo}.html`.replace(/[^a-z0-9.-]/gi, '-');
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };

  return (
    <div className="report-body">
      <div className="report-toolbar" role="toolbar" aria-label="Ações do relatório">
        <a className="btn btn--sm" href={back}><LuArrowLeft /> Voltar</a>
        <span className="spacer" />
        <button className="btn btn--sm" onClick={download}><LuDownload /> Baixar arquivo</button>
        <button className="btn btn--sm btn--primary" onClick={() => window.print()}><LuPrinter /> Salvar PDF</button>
      </div>
      {kind === 'relacionamento' && (
        <RelOptions blocks={blocks} selected={selected} onToggle={toggle} onAll={(v) => updateSelection(v ? new Set(blocks.filter((b) => b.group !== 'privado' || selected.has(b.id)).map((b) => b.id)) : new Set())} range={relRange} onRange={setRelRange} today={today} />
      )}
      <article className="report-paper">
        <header className="report-head">
          <div className="report-brand">
            <svg width="40" height="25" viewBox="0 0 100 62" aria-hidden="true"><path d="M2 60 L36 14 L50 30 L62 4 L98 60 Z" fill="currentColor" /><path d="M62 4 L55 19 L60 16 L64 22 L68 15 L73 17 Z" fill="#fff" /></svg>
            <span>ASCENT</span>
          </div>
          <div className="report-meta">
            <h1>{title}</h1>
            <p>{kind === 'relacionamento' ? (relRange ? `${formatDate(relRange.from, { year: true })} a ${formatDate(relRange.to, { year: true })}` : `Gerado em ${formatDateTime(new Date().toISOString())}`) : `${formatDate(from, { year: true })} a ${formatDate(to, { year: true })}`}</p>
            <p>{state.profile.displayName}</p>
          </div>
        </header>
        {kind === 'financas' && <FinanceReport state={state} from={from} to={to} today={today} />}
        {kind === 'relacionamento' && <RelationshipReport state={state} today={today} profileId={profileId} range={relRange} selected={selected} />}
        {kind === 'revisao' && <ReviewReport state={state} from={from} to={to} today={today} />}
        <footer className="report-foot">ASCENT · subir um passo de cada vez</footer>
      </article>
    </div>
  );
}

function Kpis({ items }: { items: { label: string; value: string; note?: string; tone?: 'neg' }[] }) {
  return (
    <dl className="report-kpis">
      {items.map((i) => (
        <div key={i.label}><dt>{i.label}</dt><dd className={i.tone === 'neg' ? 'neg' : ''}>{i.value}</dd>{i.note && <small>{i.note}</small>}</div>
      ))}
    </dl>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="report-section"><h2>{title}</h2>{children}</section>;
}

function Bars({ rows }: { rows: { name: string; amount: number }[] }) {
  const max = rows[0]?.amount || 1;
  return (
    <table className="report-table">
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}><td>{r.name}</td><td className="bar-cell"><span className="bar" style={{ width: `${Math.max(2, (r.amount / max) * 100)}%` }} /></td><td className="num">{money(r.amount)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function FinanceReport({ state, from, to, today }: { state: AppState; from: ISODate; to: ISODate; today: ISODate }) {
  const r = useMemo(() => rangeSummary(state, from, to), [state, from, to]);
  const txs = rangeTransactions(state, from, to);
  const cat = (id: string) => state.finance.categories.find((c) => c.id === id)?.name ?? '';
  const acc = (id: string) => state.finance.accounts.find((a) => a.id === id)?.name ?? '';
  const boxes = state.finance.savings.boxes.filter((b) => b.status === 'active').map((b) => boxStatus(state, b, today));
  return (
    <>
      <Kpis items={[
        { label: 'Entrou', value: money0(r.incomeSettled), note: `Renda pessoal ${money0(r.personalIncome)}` },
        { label: 'Saiu', value: money0(r.expenseSettled), note: `${r.count} lançamentos` },
        { label: 'Saldo do período', value: money0(r.balanceSettled), tone: r.balanceSettled < 0 ? 'neg' : undefined },
        { label: 'Previsto/pendente', value: money0(r.incomeExpected - r.expenseExpected), note: `+${money0(r.incomeExpected)} · −${money0(r.expenseExpected)}` },
      ]} />
      <Kpis items={[
        { label: 'Em contas hoje', value: money0(totalBalance(state, today)) },
        { label: 'Guardado', value: money0(totalSaved(state, today)) },
        { label: 'Livre', value: money0(freeCash(state, today)) },
      ]} />
      {r.byCategory.length > 0 && <Section title="Para onde foi o dinheiro"><Bars rows={r.byCategory} /></Section>}
      {r.incomeByCategory.length > 0 && <Section title="De onde veio"><Bars rows={r.incomeByCategory} /></Section>}
      {boxes.length > 0 && (
        <Section title="Poupança">
          <table className="report-table">
            <thead><tr><th>Cofrinho</th><th className="num">Saldo</th><th className="num">Meta</th><th className="num">Este mês</th><th className="num">Para a meta</th></tr></thead>
            <tbody>{boxes.map((s) => (
              <tr key={s.box.id}><td>{s.box.name}</td><td className="num">{money0(s.balance)}</td><td className="num">{s.box.targetAmount ? money0(s.box.targetAmount) : '—'}</td><td className="num">{money0(s.deposited)} / {money0(s.quota.amount)}</td><td className="num">{s.requiredMonthly !== null ? `${money0(s.requiredMonthly)}/mês` : '—'}</td></tr>
            ))}</tbody>
          </table>
        </Section>
      )}
      <Section title="Lançamentos">
        {txs.length ? (
          <table className="report-table report-table--zebra">
            <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th>Situação</th><th className="num">Valor</th></tr></thead>
            <tbody>{txs.map((t) => (
              <tr key={t.id}><td>{formatDate(t.date)}</td><td>{t.description}</td><td>{cat(t.categoryId)}</td><td>{acc(t.accountId)}</td><td>{TX_STATUS_LABEL[t.status]}</td><td className={`num ${t.type === 'income' ? 'pos' : ''}`}>{t.type === 'income' ? '+' : '−'}{money(t.amount)}</td></tr>
            ))}</tbody>
          </table>
        ) : <p className="muted">Nenhum lançamento no período.</p>}
      </Section>
    </>
  );
}

function RelationshipReport({ state, today, profileId, range, selected }: { state: AppState; today: ISODate; profileId: string; range: DateRange | null; selected: Set<string> }) {
  const p = state.relationship.profiles.find((x) => x.id === profileId);
  if (!p) return <p className="muted">Nenhum perfil cadastrado.</p>;
  const on = (id: string) => selected.has(id);
  const { experiences: exps, expenses, commitments, total } = relReportData(state, p.id, range);
  const sections = sectionsOf(state, p.id);
  const fields = entriesOf(state, p.id, 'perfil').filter((e) => !isPix(e));
  const pix = entriesOf(state, p.id, 'perfil').filter(isPix);
  const lists = sections.filter((s) => s.kind === 'list' && on(`lista:${s.id}`));
  const customFields = sections.filter((s) => s.kind === 'fields' && s.id !== 'perfil' && on(`campos:${s.id}`));
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const wishes = state.relationship.wishes.filter((w) => w.profileId === p.id);
  const prefs = state.relationship.preferences.filter((x) => x.profileId === p.id && !x.outdated);
  const dates = state.relationship.dates.filter((d) => d.profileId === p.id).sort((a, b) => a.date.slice(5).localeCompare(b.date.slice(5)));
  const priv = state.relationship.privateDetails.find((x) => x.profileId === p.id);
  const nothing = selected.size === 0;
  return (
    <>
      <div className="report-person">
        <h2>{p.name}</h2>
        {p.nickname && <p>“{p.nickname}”</p>}
        {p.since && <p>Juntos desde {formatDate(p.since, { year: true })}</p>}
        {p.notes && <p className="muted">{p.notes}</p>}
      </div>
      {nothing && <p className="muted">Escolha acima o que entra no relatório.</p>}
      {on('resumo') && (
        <Kpis items={[
          { label: 'Experiências', value: String(exps.length) },
          { label: 'Investido', value: money0(total) },
          { label: 'Presentes dados', value: String(wishes.filter((w) => w.kind === 'presente' && w.status === 'realizado').length) },
          { label: 'Desejos mapeados', value: String(wishes.filter((w) => w.status === 'pendente').length) },
        ]} />
      )}
      {on('perfil') && fields.length > 0 && (
        <Section title="Perfil">
          <div className="report-cols">
            {groupFields(fields).map(({ group, items }) => (
              <div key={group}>
                <h3>{group}</h3>
                <dl className="report-facts">{items.map((e) => {
                  const age = e.format === 'data' && /nasc/i.test(e.label) ? ageOn(e.value, today) : null;
                  return <div key={e.id}><dt>{e.label}</dt><dd>{e.format === 'data' ? formatDate(e.value, { year: true }) : e.value}{age !== null ? ` · ${age} anos` : ''}</dd></div>;
                })}</dl>
              </div>
            ))}
          </div>
        </Section>
      )}
      {lists.length > 0 && (
        <div className="report-cols">
          {lists.map((s) => {
            const items = entriesOf(state, p.id, s.id);
            if (!items.length) return null;
            return (
              <section key={s.id} className="report-section">
                <h2>{s.title}</h2>
                <ul className="report-list">{items.map((e) => <li key={e.id}><strong>{e.value}</strong>{e.note && <span> — {e.note}</span>}</li>)}</ul>
              </section>
            );
          })}
        </div>
      )}
      {customFields.map((s) => {
        const items = entriesOf(state, p.id, s.id);
        return items.length ? <Section key={s.id} title={s.title}><dl className="report-facts">{items.map((e) => <div key={e.id}><dt>{e.label}</dt><dd>{e.value}</dd></div>)}</dl></Section> : null;
      })}
      {on('preferencias') && prefs.length > 0 && (
        <Section title="Preferências">
          <dl className="report-facts">{prefs.map((x) => <div key={x.id}><dt>{x.category}</dt><dd>{x.value}{x.certainty === 'suposicao' ? ' (suposição)' : ''}</dd></div>)}</dl>
        </Section>
      )}
      {on('desejos') && wishes.length > 0 && (
        <Section title="Desejos e presentes">
          <table className="report-table">
            <thead><tr><th>Ideia</th><th>Tipo</th><th>Situação</th><th>Detalhes</th></tr></thead>
            <tbody>{wishes.map((w) => <tr key={w.id}><td>{w.title}</td><td>{w.kind}</td><td>{w.status}</td><td>{w.note}</td></tr>)}</tbody>
          </table>
        </Section>
      )}
      {on('datas') && dates.length > 0 && (
        <Section title="Datas importantes">
          <dl className="report-facts">{dates.map((d) => <div key={d.id}><dt>{d.title}</dt><dd>{formatDate(d.date, { year: !d.yearly })}{d.yearly ? ' · todo ano' : ''}</dd></div>)}</dl>
        </Section>
      )}
      {on('linha') && exps.length > 0 && (
        <Section title="Linha do tempo">
          <ul className="report-timeline">
            {exps.map((e) => {
              const spent = expenses.filter((x) => x.experienceId === e.id).reduce((a, x) => a + x.amount, 0);
              return <li key={e.id}><span className="when">{formatDate(e.date, { year: true })}</span><div><strong>{e.title}</strong>{e.location && <span className="muted"> · {e.location}</span>}{spent > 0 && <span className="muted"> · {money(spent)}</span>}{e.description && <p>{e.description}</p>}</div></li>;
            })}
          </ul>
        </Section>
      )}
      {on('gastos') && expenses.length > 0 && (
        <Section title="Gastos">
          <Bars rows={[...byCat.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)} />
          <table className="report-table report-table--zebra">
            <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="num">Valor</th></tr></thead>
            <tbody>{expenses.map((e) => <tr key={e.id}><td>{formatDate(e.date)}</td><td>{e.description}</td><td>{e.category}</td><td className="num">{money(e.amount)}</td></tr>)}</tbody>
            <tfoot><tr><td colSpan={3}>Total</td><td className="num">{money(total)}</td></tr></tfoot>
          </table>
          <p className="xs muted">Valores registrados não medem afeto nem compromisso.</p>
        </Section>
      )}
      {on('compromissos') && commitments.length > 0 && (
        <Section title="Compromissos">
          <ul className="report-list">{commitments.map((c) => <li key={c.id}><strong>{c.title}</strong><span> — {formatDate(c.dueDate, { year: true })} · {c.status === 'done' ? 'feito' : 'pendente'}</span></li>)}</ul>
        </Section>
      )}
      {on('privado') && (priv?.address || pix.length > 0) && (
        <Section title="Endereço e PIX">
          <dl className="report-facts">
            {priv?.address && <div><dt>Endereço</dt><dd>{priv.address}{priv.postalCode ? ` · CEP ${priv.postalCode}` : ''}</dd></div>}
            {pix.map((e) => <div key={e.id}><dt>{e.label}</dt><dd>{e.value}</dd></div>)}
          </dl>
        </Section>
      )}
    </>
  );
}

const REL_PREFS_KEY = 'ascent:report:relacionamento';
const GROUP_LABEL: Record<RelBlockGroup, string> = { ficha: 'Ficha', historico: 'Histórico', privado: 'Dados sensíveis' };

/** Lembra a escolha neste aparelho; blocos novos (abas criadas depois) entram marcados. */
function loadSelection(blocks: RelBlock[]): Set<string> {
  const def = defaultSelection(blocks);
  try {
    const raw = localStorage.getItem(REL_PREFS_KEY);
    if (!raw) return def;
    const saved = JSON.parse(raw) as { selected?: string[]; known?: string[] };
    const known = new Set(saved.known ?? []);
    const sel = new Set(saved.selected ?? []);
    return new Set(blocks.filter((b) => (known.has(b.id) ? sel.has(b.id) : def.has(b.id))).map((b) => b.id));
  } catch {
    return def;
  }
}
function saveSelection(blocks: RelBlock[], selected: Set<string>) {
  try {
    localStorage.setItem(REL_PREFS_KEY, JSON.stringify({ selected: [...selected], known: blocks.map((b) => b.id) }));
  } catch {
    /* sem armazenamento: a escolha vale só nesta visita */
  }
}

function RelOptions({ blocks, selected, onToggle, onAll, range, onRange, today }: {
  blocks: RelBlock[]; selected: Set<string>; onToggle: (id: string) => void; onAll: (on: boolean) => void;
  range: DateRange | null; onRange: (r: DateRange | null) => void; today: ISODate;
}) {
  const groups = (['ficha', 'historico', 'privado'] as RelBlockGroup[]).map((g) => ({ g, items: blocks.filter((b) => b.group === g) }));
  return (
    <details className="report-options" open>
      <summary>O que exportar <span className="muted">· {selected.size} de {blocks.length} partes{range ? ` · ${formatDate(range.from, { year: true })} a ${formatDate(range.to, { year: true })}` : ' · todo o período'}</span></summary>
      <div className="report-options__body">
        <div className="report-options__period">
          <div className="report-options__row">
            <strong>Período</strong>
            <button type="button" className={`chip chip--btn ${!range ? 'chip--solid' : 'chip--muted'}`} onClick={() => onRange(null)}>Tudo</button>
            <button type="button" className={`chip chip--btn ${range ? 'chip--solid' : 'chip--muted'}`} onClick={() => onRange(range ?? { from: `${today.slice(0, 7)}-01`, to: today })}>De/até</button>
          </div>
          {range && <PeriodPicker value={range} onChange={onRange} today={today} />}
          <p className="xs muted">O período recorta a linha do tempo, os gastos, os compromissos e o resumo. A ficha (perfil, listas, desejos) sai completa.</p>
        </div>
        {groups.map(({ g, items }) => items.length > 0 && (
          <fieldset key={g} className="report-options__group">
            <legend>{GROUP_LABEL[g]}</legend>
            <div className="report-options__checks">
              {items.map((b) => (
                <label key={b.id} className={`report-check ${b.count === 0 ? 'is-empty' : ''}`}>
                  <input type="checkbox" checked={selected.has(b.id)} onChange={() => onToggle(b.id)} />
                  <span>{b.label}</span>
                  {b.id !== 'resumo' && <small>{b.count === 0 ? 'vazio' : b.count}{b.dated && range ? ' no período' : ''}</small>}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="report-options__row">
          <button type="button" className="btn btn--sm" onClick={() => onAll(true)}>Marcar tudo</button>
          <button type="button" className="btn btn--sm" onClick={() => onAll(false)}>Desmarcar tudo</button>
        </div>
      </div>
    </details>
  );
}

function ReviewReport({ state, from, to, today }: { state: AppState; from: ISODate; to: ISODate; today: ISODate }) {
  const d = periodData(state, from, to, today);
  const saved = state.periodReviews.find((r) => r.from === from && r.to === to);
  const week = state.reviews.find((r) => r.weekStart === from);
  const reflection = saved ?? (week ? { title: '', highlights: week.highlights, obstacles: week.obstacles, priorities: week.priorities } : null);
  return (
    <>
      <Kpis items={[
        { label: 'Conclusão da rotina', value: percent(d.st.rate), note: `${d.st.done} de ${d.st.eligible}` },
        { label: 'XP', value: String(d.xp) },
        { label: 'Marcos', value: String(d.milestones.length) },
        { label: 'Microetapas', value: String(d.steps.length) },
      ]} />
      <Kpis items={[
        { label: 'Entrou', value: money0(d.fin.incomeSettled) },
        { label: 'Saiu', value: money0(d.fin.expenseSettled) },
        { label: 'Guardado', value: money0(d.saved) },
        { label: 'Relacionamento', value: money0(d.relSpent), note: `${d.experiences.length} experiência(s)` },
      ]} />
      {reflection && (
        <Section title={saved?.title || 'Reflexão'}>
          {reflection.highlights && <><h3>O que funcionou</h3><p className="pre">{reflection.highlights}</p></>}
          {reflection.obstacles && <><h3>O que atrapalhou</h3><p className="pre">{reflection.obstacles}</p></>}
          {reflection.priorities && <><h3>Daqui para frente</h3><p className="pre">{reflection.priorities}</p></>}
        </Section>
      )}
      {d.obs.length > 0 && (
        <Section title="Resultados medidos">
          <table className="report-table"><tbody>{d.obs.map((o) => { const g = state.goals.find((x) => x.id === o.goalId); return <tr key={o.id}><td>{formatDate(o.date)}</td><td>{g?.title}</td><td className="num">{g ? metric(o.value, g.unit) : o.value}</td></tr>; })}</tbody></table>
        </Section>
      )}
      {d.achievements.length > 0 && <Section title="Conquistas"><p>{d.achievements.map((a) => getAchievement(a.code)?.title).filter(Boolean).join(' · ')}</p></Section>}
      {d.fin.byCategory.length > 0 && <Section title="Maiores saídas"><Bars rows={d.fin.byCategory.slice(0, 8)} /></Section>}
    </>
  );
}

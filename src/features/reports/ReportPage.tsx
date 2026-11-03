import { useMemo, useState, type ReactNode } from 'react';
import { LuArrowLeft, LuDownload, LuPrinter } from 'react-icons/lu';
import { useAppState } from '../../app/store';
import { getAchievement } from '../../domain/achievements';
import { formatDate, formatDateTime } from '../../domain/dates';
import { rangeSummary, rangeTransactions, totalBalance, TX_STATUS_LABEL } from '../../domain/finance';
import { ageOn, entriesOf, groupFields, sectionsOf } from '../../domain/relationshipProfile';
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
  const [withPrivate, setWithPrivate] = useState(false);
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
    a.download = `ascent-${kind}-${from}-a-${to}.html`.replace(/[^a-z0-9.-]/gi, '-');
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };

  return (
    <div className="report-body">
      <div className="report-toolbar" role="toolbar" aria-label="Ações do relatório">
        <a className="btn btn--sm" href={back}><LuArrowLeft /> Voltar</a>
        {kind === 'relacionamento' && <label className="check small"><input type="checkbox" checked={withPrivate} onChange={(e) => setWithPrivate(e.target.checked)} /> Incluir endereço e PIX</label>}
        <span className="spacer" />
        <button className="btn btn--sm" onClick={download}><LuDownload /> Baixar arquivo</button>
        <button className="btn btn--sm btn--primary" onClick={() => window.print()}><LuPrinter /> Salvar PDF</button>
      </div>
      <article className="report-paper">
        <header className="report-head">
          <div className="report-brand">
            <svg width="40" height="25" viewBox="0 0 100 62" aria-hidden="true"><path d="M2 60 L36 14 L50 30 L62 4 L98 60 Z" fill="currentColor" /><path d="M62 4 L55 19 L60 16 L64 22 L68 15 L73 17 Z" fill="#fff" /></svg>
            <span>ASCENT</span>
          </div>
          <div className="report-meta">
            <h1>{title}</h1>
            <p>{kind === 'relacionamento' ? `Gerado em ${formatDateTime(new Date().toISOString())}` : `${formatDate(from, { year: true })} a ${formatDate(to, { year: true })}`}</p>
            <p>{state.profile.displayName}</p>
          </div>
        </header>
        {kind === 'financas' && <FinanceReport state={state} from={from} to={to} today={today} />}
        {kind === 'relacionamento' && <RelationshipReport state={state} today={today} withPrivate={withPrivate} />}
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

function RelationshipReport({ state, today, withPrivate }: { state: AppState; today: ISODate; withPrivate: boolean }) {
  const p = state.relationship.profiles[0];
  if (!p) return <p className="muted">Nenhum perfil cadastrado.</p>;
  const sections = sectionsOf(state, p.id);
  const fields = entriesOf(state, p.id, 'perfil').filter((e) => withPrivate || !/^pix$/i.test(e.label));
  const lists = sections.filter((s) => s.kind === 'list');
  const customFields = sections.filter((s) => s.kind === 'fields' && s.id !== 'perfil');
  const exps = [...state.relationship.experiences].filter((e) => e.profileId === p.id).sort((a, b) => a.date.localeCompare(b.date));
  const expenses = state.relationship.expenses.filter((e) => e.profileId === p.id);
  const total = expenses.reduce((a, e) => a + e.amount, 0);
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const wishes = state.relationship.wishes.filter((w) => w.profileId === p.id);
  const priv = state.relationship.privateDetails.find((x) => x.profileId === p.id);
  return (
    <>
      <div className="report-person">
        <h2>{p.name}</h2>
        {p.nickname && <p>“{p.nickname}”</p>}
        {p.since && <p>Juntos desde {formatDate(p.since, { year: true })}</p>}
        {p.notes && <p className="muted">{p.notes}</p>}
      </div>
      <Kpis items={[
        { label: 'Experiências', value: String(exps.length) },
        { label: 'Investido', value: money0(total) },
        { label: 'Presentes dados', value: String(wishes.filter((w) => w.kind === 'presente' && w.status === 'realizado').length) },
        { label: 'Desejos mapeados', value: String(wishes.filter((w) => w.status === 'pendente').length) },
      ]} />
      {fields.length > 0 && (
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
          {withPrivate && priv && <p className="small">Endereço: {priv.address}{priv.postalCode ? ` · CEP ${priv.postalCode}` : ''}</p>}
        </Section>
      )}
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
      {customFields.map((s) => {
        const items = entriesOf(state, p.id, s.id);
        return items.length ? <Section key={s.id} title={s.title}><dl className="report-facts">{items.map((e) => <div key={e.id}><dt>{e.label}</dt><dd>{e.value}</dd></div>)}</dl></Section> : null;
      })}
      {wishes.length > 0 && (
        <Section title="Desejos e presentes">
          <table className="report-table">
            <thead><tr><th>Ideia</th><th>Tipo</th><th>Situação</th><th>Detalhes</th></tr></thead>
            <tbody>{wishes.map((w) => <tr key={w.id}><td>{w.title}</td><td>{w.kind}</td><td>{w.status}</td><td>{w.note}</td></tr>)}</tbody>
          </table>
        </Section>
      )}
      {exps.length > 0 && (
        <Section title="Linha do tempo">
          <ul className="report-timeline">
            {exps.map((e) => {
              const spent = expenses.filter((x) => x.experienceId === e.id).reduce((a, x) => a + x.amount, 0);
              return <li key={e.id}><span className="when">{formatDate(e.date, { year: true })}</span><div><strong>{e.title}</strong>{e.location && <span className="muted"> · {e.location}</span>}{spent > 0 && <span className="muted"> · {money(spent)}</span>}{e.description && <p>{e.description}</p>}</div></li>;
            })}
          </ul>
        </Section>
      )}
      {expenses.length > 0 && (
        <Section title="Gastos">
          <Bars rows={[...byCat.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)} />
          <table className="report-table report-table--zebra">
            <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="num">Valor</th></tr></thead>
            <tbody>{[...expenses].sort((a, b) => a.date.localeCompare(b.date)).map((e) => <tr key={e.id}><td>{formatDate(e.date)}</td><td>{e.description}</td><td>{e.category}</td><td className="num">{money(e.amount)}</td></tr>)}</tbody>
            <tfoot><tr><td colSpan={3}>Total</td><td className="num">{money(total)}</td></tr></tfoot>
          </table>
          <p className="xs muted">Valores registrados não medem afeto nem compromisso.</p>
        </Section>
      )}
    </>
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

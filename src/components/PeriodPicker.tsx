import { addDays, addMonths, monthKey } from '../domain/dates';
import type { ISODate } from '../domain/types';

export interface Period {
  from: ISODate;
  to: ISODate;
}

export function lastDayOfMonth(ym: string): ISODate {
  return `${ym}-${String(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()).padStart(2, '0')}`;
}

/** Escolha de período de/até com atalhos (este mês, mês passado, últimos 30 dias, este ano…). */
export function PeriodPicker({ value, onChange, today }: { value: Period; onChange: (p: Period) => void; today: ISODate }) {
  const m = monthKey(today);
  const prev = addMonths(m, -1);
  const presets: { label: string; p: Period }[] = [
    { label: 'Este mês', p: { from: `${m}-01`, to: today } },
    { label: 'Mês passado', p: { from: `${prev}-01`, to: lastDayOfMonth(prev) } },
    { label: 'Últimos 30 dias', p: { from: addDays(today, -29), to: today } },
    { label: 'Últimos 3 meses', p: { from: `${addMonths(m, -2)}-01`, to: today } },
    { label: 'Este ano', p: { from: `${today.slice(0, 4)}-01-01`, to: today } },
  ];
  return (
    <div className="period-picker">
      <label className="period-picker__field"><span>De</span><input className="input" type="date" value={value.from} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} /></label>
      <label className="period-picker__field"><span>Até</span><input className="input" type="date" value={value.to} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} /></label>
      <div className="pref-chips">{presets.map((x) => <button key={x.label} type="button" className={`chip chip--btn ${x.p.from === value.from && x.p.to === value.to ? 'chip--solid' : 'chip--muted'}`} onClick={() => onChange(x.p)}>{x.label}</button>)}</div>
    </div>
  );
}


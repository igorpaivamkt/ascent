const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const int = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export const money = (n: number) => brl.format(n);
export const money0 = (n: number) => brl0.format(n);
export const number = (n: number) => num.format(n);
export const integer = (n: number) => int.format(n);
export const percent = (r: number | null, digits = 0) => (r === null || !Number.isFinite(r) ? '—' : `${(r * 100).toFixed(digits).replace('.', ',')}%`);

/** Valor de um indicador com sua unidade (R$ tratado como moeda). */
export function metric(value: number, unit: string): string {
  if (unit.trim() === 'R$') return money0(value);
  if (unit.trim() === '%') return `${number(value)}%`;
  return `${number(value)} ${unit}`.trim();
}

/** Converte "1.234,56", "1234.56" ou "1234,5" em número. Retorna NaN se inválido. */
export function parseNumber(input: string): number {
  const s = input.trim().replace(/\s|R\$/g, '');
  if (!s) return NaN;
  // pt-BR: "1.234,56" e "1.200" (ponto como separador de milhar); "1234.56" também é aceito.
  const thousandsOnly = /^-?\d{1,3}(\.\d{3})+$/.test(s);
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : thousandsOnly ? s.replace(/\./g, '') : s;
  return /^-?\d*\.?\d+$/.test(normalized) ? Number(normalized) : NaN;
}

export function plural(n: number, one: string, many: string): string {
  return `${integer(n)} ${n === 1 ? one : many}`;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

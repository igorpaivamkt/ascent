/**
 * Jornada de DEMONSTRAÇÃO. Todos os dados são fictícios e o estado inteiro fica marcado com mode = 'demo'.
 * Em vez de inserir XP, níveis e conquistas "na mão", a demonstração é construída reproduzindo comandos
 * pelo próprio motor em datas passadas — assim ela obedece exatamente às mesmas regras do uso real.
 */
import { addDays, dayOfWeek, toISODate } from './dates';
import { execute, type Command, DomainError } from './engine';
import { createEmptyState } from './initialState';
import { dayAgenda } from './routine';
import type { AppState } from './types';

export function createDemoState(now: Date): AppState {
  let seq = 0;
  const newId = () => `demo-${(++seq).toString(36)}`;
  let state = createEmptyState(now, { mode: 'demo', displayName: 'Explorador' });
  state.finance.accounts = [
    { id: 'acc-principal', name: 'Conta corrente', type: 'corrente', openingBalance: 1800 },
    { id: 'acc-reserva', name: 'Reserva', type: 'poupanca', openingBalance: 2500 },
  ];
  const today = toISODate(now);
  const at = (daysAgo: number, hour = 20) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, 0, 0, 0);
    if (daysAgo === 0) return new Date(Math.min(d.getTime(), now.getTime() - 60_000));
    return d;
  };
  const run = (daysAgo: number, cmd: Command, hour?: number) => {
    try {
      state = execute(state, cmd, { now: at(daysAgo, hour), newId }).state;
    } catch (e) {
      if (!(e instanceof DomainError)) throw e;
    }
  };
  const id = (pred: (s: AppState) => string | undefined) => pred(state) ?? '';

  // ── Objetivo prioritário: renda
  run(75, { type: 'goal/create', draft: {
    title: 'Renda mensal de R$ 10.000', description: 'Aumentar a renda líquida pessoal combinando emprego e consultoria.',
    category: 'financeiro', metricName: 'Renda líquida pessoal no mês', unit: 'R$', indicator: 'quantitative', metricSource: 'finance:personal_income',
    direction: 'increase', baselineValue: 3500, targetValue: 10000, startDate: addDays(today, -75), targetDate: addDays(today, 540), isPriority: true,
    milestones: [4500, 5000, 6000, 7000, 8000, 9000].map((v) => ({ title: `R$ ${v.toLocaleString('pt-BR')}/mês`, targetValue: v, rule: 'metric' as const, major: v === 5000 || v === 7000 })),
  } }, 9);
  const income = id((s) => s.goals[0]?.id);

  // ── Segundo objetivo: leitura
  run(75, { type: 'goal/create', draft: {
    title: 'Ler 12 livros em 2026', description: 'Uma leitura por mês, com foco em negócios e ficção.', category: 'pessoal',
    metricName: 'Livros concluídos no ano', unit: 'livros', indicator: 'quantitative', metricSource: 'manual', direction: 'increase',
    baselineValue: 0, targetValue: 12, startDate: `${today.slice(0, 4)}-01-01`, targetDate: `${today.slice(0, 4)}-12-31`,
    milestones: [3, 6, 9].map((v) => ({ title: `${v} livros`, targetValue: v, rule: 'metric' as const, major: v === 6 })),
  } }, 9);
  const reading = id((s) => s.goals[1]?.id);

  // ── Projetos e microetapas
  run(74, { type: 'project/add', goalId: income, title: 'Consultoria para pequenos negócios', description: 'Estruturar e vender uma oferta de consultoria.', milestoneId: null,
    steps: ['Escolher o público-alvo', 'Validar o problema com 5 entrevistas', 'Estruturar a oferta', 'Elaborar o plano de negócio', 'Fazer as 20 primeiras abordagens', 'Conquistar o primeiro cliente'] });
  run(73, { type: 'project/add', goalId: income, title: 'Portfólio online', description: 'Página com cases para apoiar as abordagens.', milestoneId: null,
    steps: ['Selecionar 3 cases', 'Escrever os textos', 'Publicar a página'] });
  const stepIds = () => [...state.steps].sort((a, b) => a.projectId.localeCompare(b.projectId) || a.order - b.order);
  const consult = state.projects[0]?.id;
  const portfolio = state.projects[1]?.id;
  const stepsOf = (pid: string | undefined) => stepIds().filter((s) => s.projectId === pid).map((s) => s.id);
  const [c1, c2, c3] = stepsOf(consult);
  const [p1, p2, p3] = stepsOf(portfolio);
  run(60, { type: 'step/toggle', stepId: c1 });
  run(46, { type: 'step/toggle', stepId: c2 });
  run(30, { type: 'step/toggle', stepId: p1 });
  run(25, { type: 'step/toggle', stepId: p2 });
  run(20, { type: 'step/toggle', stepId: c3 });
  run(14, { type: 'step/toggle', stepId: p3 });

  // ── Resultados medidos
  run(44, { type: 'goal/observe', goalId: income, value: 3900, date: addDays(today, -44), note: 'Salário + primeiros freelas', source: 'manual' });
  run(8, { type: 'goal/observe', goalId: income, value: 4600, date: addDays(today, -8), note: 'Renda pessoal recebida no mês anterior', source: 'finance' });
  run(60, { type: 'goal/observe', goalId: reading, value: 3, date: addDays(today, -60), note: '', source: 'manual' });
  run(30, { type: 'goal/observe', goalId: reading, value: 6, date: addDays(today, -30), note: '', source: 'manual' });
  run(6, { type: 'goal/observe', goalId: reading, value: 8, date: addDays(today, -6), note: '', source: 'manual' });

  // ── Rotina (hábitos criados há duas semanas)
  const habits: Command[] = [
    { type: 'habit/create', habit: { title: 'Beber 3 L de água', description: '', category: 'saúde', frequency: 'daily', days: [], timeWindow: 'Ao longo do dia', durationMin: 0, goalId: null, startDate: addDays(today, -14) } },
    { type: 'habit/create', habit: { title: 'Treino de musculação', description: '', category: 'saúde', frequency: 'custom', days: [1, 3, 5], timeWindow: '07:00', durationMin: 60, goalId: null, startDate: addDays(today, -14) } },
    { type: 'habit/create', habit: { title: 'Estudar ADS (2h)', description: 'Faculdade de Análise e Desenvolvimento de Sistemas', category: 'estudos', frequency: 'weekdays', days: [], timeWindow: '19:00', durationMin: 120, goalId: null, startDate: addDays(today, -14) } },
    { type: 'habit/create', habit: { title: 'Trabalhar no projeto de consultoria', description: '', category: 'trabalho', frequency: 'weekdays', days: [], timeWindow: '21:30', durationMin: 60, goalId: income, startDate: addDays(today, -14) } },
    { type: 'habit/create', habit: { title: 'Ler 20 páginas', description: '', category: 'desenvolvimento', frequency: 'daily', days: [], timeWindow: 'Antes de dormir', durationMin: 30, goalId: reading, startDate: addDays(today, -14) } },
    { type: 'habit/create', habit: { title: 'Ação comercial', description: 'Uma abordagem ou follow-up', category: 'trabalho', frequency: 'custom', days: [2, 4], timeWindow: '12:30', durationMin: 30, goalId: income, startDate: addDays(today, -14) } },
  ];
  for (const h of habits) run(14, h, 8);

  // Padrão determinístico de execução (sem aleatoriedade real): ~75% concluído, alguns parciais e faltas com motivo.
  const pattern = 'DDDPDDMDDDDDDPDDMDDDRDDDDDDDDMDDDPDDDDDDNDDD';
  const reasons = ['tempo', 'energia', 'imprevisto', 'prioridade'] as const;
  let pi = 0;
  for (let ago = 13; ago >= 1; ago--) {
    const date = addDays(today, -ago);
    const items = dayAgenda(state, date);
    const plan: string[] = items.map(() => pattern[pi++ % pattern.length]);
    // Mantém a conquista "Dia completo" disponível para o usuário desbloquear hoje.
    if (plan.length >= 3 && !plan.some((p) => p !== 'D')) plan[plan.length - 1] = 'P';
    for (const [idx, item] of items.entries()) {
      const p = plan[idx];
      const reason = reasons[pi % reasons.length];
      if (p === 'D') run(ago, { type: 'occurrence/set', occurrenceId: item.occurrenceId, status: 'done' }, 21);
      else if (p === 'P') run(ago, { type: 'occurrence/set', occurrenceId: item.occurrenceId, status: 'partial', reason }, 21);
      else if (p === 'M') run(ago, { type: 'occurrence/set', occurrenceId: item.occurrenceId, status: 'missed', reason }, 21);
      else if (p === 'R' && ago > 2) run(ago, { type: 'occurrence/set', occurrenceId: item.occurrenceId, status: 'rescheduled', reason: 'imprevisto', rescheduleTo: addDays(date, 1) }, 21);
    }
  }
  // Hoje: duas ações já registradas, o restante fica para o usuário.
  const todayItems = dayAgenda(state, today);
  for (const item of todayItems.filter((i) => i.habit.title.startsWith('Beber') || i.habit.title.startsWith('Treino'))) {
    run(0, { type: 'occurrence/set', occurrenceId: item.occurrenceId, status: 'done' });
  }

  run(2, { type: 'task/create', title: 'Enviar proposta para o cliente piloto', date: addDays(today, -2), goalId: income, done: true }, 15);
  run(0, { type: 'task/create', title: 'Revisar o orçamento de novembro', date: today, goalId: null }, 8);

  // ── Finanças (3 meses fechados + mês corrente)
  const month = (delta: number, day: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() + delta, day, 12);
    return toISODate(d);
  };
  const tx = (daysAgo: number, t: Omit<Extract<Command, { type: 'tx/upsert' }>['tx'], 'origin' | 'note'> & { note?: string }) =>
    run(Math.max(0, daysAgo), { type: 'tx/upsert', tx: { origin: 'manual', note: '', ...t } }, 10);
  const ago = (iso: string) => Math.round((now.getTime() - new Date(`${iso}T12:00:00`).getTime()) / 86_400_000);
  const freelas = [300, 700, 1400];
  for (const [i, delta] of [-3, -2, -1].entries()) {
    const d5 = month(delta, 5);
    tx(ago(d5), { description: 'Salário', amount: 3200, type: 'income', categoryId: 'cat-salario', accountId: 'acc-principal', date: d5, status: 'settled', incomeClass: 'renda_pessoal' });
    const d18 = month(delta, 18);
    tx(ago(d18), { description: 'Freelance de design', amount: freelas[i], type: 'income', categoryId: 'cat-servicos', accountId: 'acc-principal', date: d18, status: 'settled', incomeClass: 'renda_pessoal' });
    const exp = (day: number, description: string, amount: number, categoryId: string) => {
      const d = month(delta, day);
      tx(ago(d), { description, amount, type: 'expense', categoryId, accountId: 'acc-principal', date: d, status: 'settled', incomeClass: null });
    };
    exp(10, 'Aluguel', 1200, 'cat-moradia');
    exp(1, 'Internet e celular', 120, 'cat-assinaturas');
    exp(6, 'Mercado', [412.3, 398.9, 441.6][i], 'cat-alimentacao');
    exp(20, 'Mercado', [296.4, 341.2, 322.75][i], 'cat-alimentacao');
    exp(8, 'Transporte (mensal)', 220, 'cat-transporte');
    exp(7, 'Academia', 99.9, 'cat-saude');
    exp(12, 'Mensalidade ADS', 289, 'cat-educacao');
    exp(23, 'Lazer', [180, 245.5, 160][i], 'cat-lazer');
  }
  if (consult) tx(ago(month(-1, 26)), { description: 'Domínio e hospedagem do portfólio', amount: 89.9, type: 'expense', categoryId: 'cat-negocio', accountId: 'acc-principal', date: month(-1, 26), status: 'settled', incomeClass: null });
  tx(0, { description: 'Internet e celular', amount: 120, type: 'expense', categoryId: 'cat-assinaturas', accountId: 'acc-principal', date: month(0, 1), status: 'settled', incomeClass: null });
  tx(0, { description: 'Mercado', amount: 184.5, type: 'expense', categoryId: 'cat-alimentacao', accountId: 'acc-principal', date: month(0, Math.min(2, now.getDate())), status: 'settled', incomeClass: null });
  tx(0, { description: 'Salário', amount: 3200, type: 'income', categoryId: 'cat-salario', accountId: 'acc-principal', date: month(0, 5), status: 'planned', incomeClass: 'renda_pessoal' });
  tx(0, { description: 'Freelance — proposta enviada', amount: 900, type: 'income', categoryId: 'cat-servicos', accountId: 'acc-principal', date: month(0, 20), status: 'planned', incomeClass: 'renda_pessoal', note: 'Ainda não confirmado' });
  tx(0, { description: 'Aluguel', amount: 1200, type: 'expense', categoryId: 'cat-moradia', accountId: 'acc-principal', date: month(0, 10), status: 'pending', incomeClass: null });
  tx(0, { description: 'Mensalidade ADS', amount: 289, type: 'expense', categoryId: 'cat-educacao', accountId: 'acc-principal', date: month(0, 12), status: 'pending', incomeClass: null });
  const cur = today.slice(0, 7);
  const budgets: [string, number][] = [['cat-moradia', 1200], ['cat-alimentacao', 750], ['cat-transporte', 250], ['cat-lazer', 250], ['cat-educacao', 289], ['cat-assinaturas', 130]];
  for (const [categoryId, amount] of budgets) run(0, { type: 'budget/set', categoryId, month: cur, amount });

  // ── Relacionamento (perfil fictício)
  run(40, { type: 'rel/upsert', entity: 'profiles', value: { name: 'Clara', nickname: 'Cacau', photoId: null, since: '2026-03-01', notes: 'Prefere planos tranquilos no fim de semana.' } });
  const pid = id((s) => s.relationship.profiles[0]?.id);
  const prefs: [string, string, 'confirmada' | 'suposicao'][] = [
    ['Comida', 'Culinária japonesa', 'confirmada'], ['Flores', 'Girassóis', 'confirmada'], ['Livros', 'Fantasia e romances históricos', 'confirmada'],
    ['Música', 'MPB', 'confirmada'], ['Cor', 'Verde-oliva', 'suposicao'], ['Bebida', 'Chá gelado de pêssego', 'confirmada'],
  ];
  for (const [category, value, certainty] of prefs) run(38, { type: 'rel/upsert', entity: 'preferences', value: { profileId: pid, category, value, certainty, outdated: false } });
  // Ficha da pessoa (aba Perfil)
  const field = (group: string, label: string, value: string, format: 'texto' | 'data' = 'texto') =>
    run(37, { type: 'rel/upsert', entity: 'entries', value: { profileId: pid, sectionId: 'perfil', label, value, note: '', group, format } });
  field('Dados pessoais', 'Data de nascimento', '2004-11-18', 'data');
  field('Dados pessoais', 'Altura', '1,63 m');
  field('Medidas e tamanhos', 'Calçado', '37');
  field('Medidas e tamanhos', 'Sandália', '36');
  field('Medidas e tamanhos', 'Roupa', 'M');
  field('Medidas e tamanhos', 'Calça', '38');
  field('Gostos', 'Cor favorita', 'Verde-oliva');
  field('Gostos', 'Perfume', 'Florais suaves');
  const item = (sectionId: string, value: string, note = '') =>
    run(37, { type: 'rel/upsert', entity: 'entries', value: { profileId: pid, sectionId, label: '', value, note, group: '', format: 'texto' } });
  item('personalidade', 'Introvertida', 'Recarrega a energia em casa, com pouca gente.');
  item('personalidade', 'Planejadora');
  item('personalidade', 'Curiosa');
  item('qualidades', 'Paciente');
  item('qualidades', 'Escuta com atenção');
  item('qualidades', 'Senso de humor');
  item('defeitos', 'Ansiosa com atrasos', 'Avisar com antecedência quando for atrasar.');
  item('defeitos', 'Teimosa quando está cansada');
  run(36, { type: 'rel/upsert', entity: 'sections', value: { profileId: pid, title: 'Sonhos', kind: 'list' } });
  const dreams = id((s) => s.relationship.sections[0]?.id);
  item(dreams, 'Morar perto da praia');
  item(dreams, 'Conhecer o Japão');
  run(38, { type: 'rel/upsert', entity: 'dates', value: { profileId: pid, title: 'Aniversário dela', date: `${today.slice(0, 4)}-11-18`, yearly: true } });
  run(38, { type: 'rel/upsert', entity: 'dates', value: { profileId: pid, title: 'Início do namoro', date: '2026-03-01', yearly: true } });
  run(30, { type: 'rel/upsert', entity: 'wishes', value: { profileId: pid, title: 'Leitor de livros digitais', kind: 'presente', status: 'pendente', note: 'Comentou que lê muito no celular.' } });
  run(30, { type: 'rel/upsert', entity: 'wishes', value: { profileId: pid, title: 'Fim de semana na serra', kind: 'lugar', status: 'pendente', note: '' } });
  run(30, { type: 'rel/upsert', entity: 'wishes', value: { profileId: pid, title: 'Aula de cerâmica juntos', kind: 'experiencia', status: 'pendente', note: '' } });
  run(20, { type: 'rel/upsert', entity: 'experiences', value: { profileId: pid, title: 'Jantar japonês', date: addDays(today, -20), location: 'Bairro da Liberdade', type: 'encontro', description: 'Comemoramos o fim do semestre dela.', learnings: 'Ela prefere lugares mais silenciosos.', photoIds: [] } });
  run(9, { type: 'rel/upsert', entity: 'experiences', value: { profileId: pid, title: 'Cinema e sorvete', date: addDays(today, -9), location: 'Shopping', type: 'passeio', description: 'Filme de animação.', learnings: '', photoIds: [] } });
  const [e1, e2] = state.relationship.experiences.map((e) => e.id);
  run(20, { type: 'rel/upsert', entity: 'expenses', value: { profileId: pid, experienceId: e1 ?? null, description: 'Jantar', amount: 186, category: 'Restaurantes', date: addDays(today, -20), paidBy: 'eu' } });
  run(9, { type: 'rel/upsert', entity: 'expenses', value: { profileId: pid, experienceId: e2 ?? null, description: 'Ingressos e sorvete', amount: 72, category: 'Passeios', date: addDays(today, -9), paidBy: 'dividido' } });
  run(3, { type: 'rel/upsert', entity: 'commitments', value: { profileId: pid, title: 'Reservar o restaurante do aniversário', dueDate: addDays(today, 8), status: 'pending' } });
  run(3, { type: 'rel/upsert', entity: 'commitments', value: { profileId: pid, title: 'Comprar girassóis', dueDate: `${today.slice(0, 4)}-11-18`, status: 'pending' } });

  // ── Revisão da semana anterior e uma compra na loja
  const lastWeek = addDays(today, -7 - ((dayOfWeek(today) + 6) % 7));
  run(1, { type: 'review/save', weekStart: lastWeek, highlights: 'Publiquei o portfólio e mantive o treino.', obstacles: 'Duas noites sem energia para estudar.', priorities: 'Fazer 5 abordagens comerciais e fechar o primeiro cliente.' }, 19);
  run(5, { type: 'shop/buy', itemId: 'head-bandana' });
  run(5, { type: 'shop/equip', itemId: 'head-bandana' });

  return state;
}

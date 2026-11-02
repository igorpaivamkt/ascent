// Verificação de interface com Playwright: responsividade, erros de console, nomes acessíveis,
// navegação por teclado, tema escuro, movimento reduzido e um roteiro completo de uso real.
// Uso: npm run build && npm run preview  (em outro terminal)  →  node scripts/ui-check.cjs
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:4173/';
const OUT = process.env.OUT || 'ui-check-output';
require('fs').mkdirSync(OUT, { recursive: true });

const PAGES = ['/', '/montanha', '/rotina', '/metas', '/financas', '/relacionamento', '/conquistas', '/loja', '/revisao', '/historico', '/configuracoes', '/inicio'];
const WIDTHS = [['celular-pequeno', 320, 640], ['celular', 390, 844], ['tablet', 768, 1024], ['desktop', 1366, 900]];
const problems = [];
const log = (m) => console.log(m);

async function accessibleNames(page, label) {
  const missing = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=checkbox]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0 && !el.classList.contains('sr-only')) continue;
      const name = (el.getAttribute('aria-label') || el.labels?.[0]?.textContent || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
      if (!name) out.push(el.outerHTML.slice(0, 120));
    }
    return out;
  });
  missing.forEach((m) => problems.push(`${label}: elemento sem nome acessível → ${m}`));
}

async function touchTargets(page, label) {
  const small = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.bottom-nav a, .bottom-nav button, .tick-wrap, .icon-btn, .btn')) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.height < 32 || r.width < 32)) out.push(`${el.className} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
  small.slice(0, 3).forEach((s) => problems.push(`${label}: alvo de toque pequeno → ${s}`));
}

(async () => {
  const browser = await chromium.launch();

  // 1) Responsividade + console + nomes acessíveis em todas as telas
  for (const [name, w, h] of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`${name}: erro JS ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && problems.push(`${name}: console ${m.text()}`));
    await page.goto(URL + '#/');
    for (const p of PAGES) {
      await page.goto(URL + '#' + p);
      await page.waitForTimeout(350);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) problems.push(`${name} ${p}: rolagem horizontal de ${overflow}px`);
      if (name === 'celular' || name === 'desktop') await accessibleNames(page, `${name} ${p}`);
      if (name === 'celular') await touchTargets(page, `${name} ${p}`);
    }
    await ctx.close();
  }
  log(`✓ ${PAGES.length} telas × ${WIDTHS.length} larguras verificadas`);

  // 2) Teclado: o primeiro Tab leva ao link "pular para o conteúdo" e o foco é visível
  {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await page.goto(URL + '#/');
    await page.waitForSelector('.skip-link');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => ({ text: document.activeElement?.textContent, shadow: getComputedStyle(document.activeElement).boxShadow }));
    if (!/Pular/.test(focused.text ?? '')) problems.push('teclado: primeiro Tab não foca o link de pular conteúdo');
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => getComputedStyle(document.activeElement).boxShadow);
    if (!ring || ring === 'none') problems.push('teclado: foco sem indicação visível');
    // Modal: Escape fecha e devolve o foco
    await page.goto(URL + '#/rotina');
    await page.getByRole('button', { name: 'Novo hábito' }).click();
    await page.keyboard.press('Escape');
    if (await page.locator('[role=dialog]').count()) problems.push('teclado: Escape não fecha o modal');
    await page.close();
    log('✓ navegação por teclado e modal');
  }

  // 3) Roteiro de uso real em celular: onboarding → hábito → XP → marco → loja → finanças → relacionamento → revisão → recarregar
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`roteiro: erro JS ${e.message}`));
    const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('ascent:v1:state')));
    const xp = (s) => s.xpEvents.reduce((a, e) => a + e.amount, 0);
    await page.goto(URL + '#/inicio');
    await page.getByLabel('Como quer ser chamado?').fill('Igor');
    await page.getByRole('button', { name: /Continuar/ }).click();
    await page.getByRole('button', { name: /Aumentar a renda/ }).click();
    await page.getByRole('button', { name: /Continuar/ }).click();
    await page.getByLabel('Linha de base (hoje)').fill('3500');
    await page.getByRole('button', { name: /Continuar/ }).click();
    await page.getByRole('button', { name: 'Começar minha jornada' }).click();
    await page.waitForTimeout(800);
    let s = await state();
    if (s.mode !== 'real' || s.goals.length !== 1 || s.habits.length !== 2 || s.profile.displayName !== 'Igor') problems.push('roteiro: onboarding não criou a jornada esperada');
    if (s.milestones.length < 2) problems.push('roteiro: marcos sugeridos não foram criados');
    await page.screenshot({ path: `${OUT}/01-jornada-nova.png` });

    await page.locator('.dash__today .tick').first().click();
    await page.waitForTimeout(1600);
    s = await state();
    if (xp(s) <= 0 || !s.achievements.some((a) => a.code === 'first_habit')) problems.push('roteiro: hábito não gerou XP/conquista');
    await page.screenshot({ path: `${OUT}/02-primeiro-habito.png` });

    // Resultado que alcança o primeiro marco → checkpoint
    const goalId = s.goals[0].id;
    await page.goto(URL + `#/metas/${goalId}`);
    await page.getByRole('button', { name: 'Registrar resultado' }).click();
    await page.getByLabel(/Valor medido/).fill('5.400');
    await page.getByRole('dialog').getByRole('button', { name: 'Registrar' }).click();
    await page.waitForTimeout(500);
    s = await state();
    if (!s.milestones.some((m) => m.status === 'reached')) problems.push('roteiro: marco não foi validado pelo indicador');
    await page.waitForTimeout(1200);
    if (await page.locator('[role=dialog]').count()) await page.screenshot({ path: `${OUT}/03a-celebracao.png` });
    const dismiss = async () => { for (let i = 0; i < 5 && (await page.locator('[role=dialog]').count()); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); } };
    await dismiss();
    await page.goto(URL + '#/montanha');
    await page.waitForTimeout(1200);
    await dismiss();
    await page.screenshot({ path: `${OUT}/03-checkpoint.png` });

    // Loja: comprar e equipar (saldo vem das conquistas reais do roteiro)
    await page.goto(URL + '#/loja');
    await page.getByRole('tab', { name: 'Acessórios' }).click();
    await page.getByRole('button', { name: 'Ver Bastão de caminhada' }).click();
    const buy = page.locator('.shop__preview .btn--primary').first();
    await buy.waitFor();
    if (await buy.isEnabled()) {
      await buy.click();
      await page.getByRole('button', { name: 'Equipar' }).click();
      await page.waitForTimeout(300);
      s = await state();
      if (s.equipped.hand !== 'hand-pole') problems.push('roteiro: item comprado não foi equipado');
    } else problems.push('roteiro: saldo insuficiente para testar compra');
    await page.screenshot({ path: `${OUT}/04-loja.png` });

    // Finanças: despesa realizada + receita prevista
    await page.goto(URL + '#/financas');
    await page.getByRole('button', { name: 'Despesa', exact: true }).click();
    await page.getByLabel('Descrição').fill('Mercado');
    await page.getByLabel('Valor (R$)').fill('250,90');
    await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click();
    await page.getByRole('button', { name: 'Receita', exact: true }).click();
    await page.getByLabel('Descrição').fill('Projeto freelance');
    await page.getByLabel('Valor (R$)').fill('1.200');
    await page.getByRole('dialog').getByRole('button', { name: 'Previsto' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click();
    await page.waitForTimeout(300);
    const txt = await page.locator('.fin-top').textContent();
    if (!/250,90|251/.test(txt) || !/1\.200/.test(txt)) problems.push(`roteiro: totais financeiros inesperados (${txt})`);
    await page.screenshot({ path: `${OUT}/05-financas.png` });

    // Relacionamento: perfil + experiência com gasto
    await page.goto(URL + '#/relacionamento');
    await page.getByLabel('Nome ou apelido').fill('Ana');
    await page.getByRole('button', { name: 'Criar perfil' }).click();
    await page.getByRole('tab', { name: 'Experiências' }).click();
    await page.getByRole('button', { name: 'Experiência', exact: true }).click();
    await page.getByLabel('O que vocês fizeram?').fill('Piquenique no parque');
    await page.getByLabel(/Gasto relacionado/).fill('60');
    await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click();
    await page.waitForTimeout(400);
    s = await state();
    const exp = s.relationship.experiences[0];
    if (!exp || !s.relationship.expenses.some((e) => e.experienceId === exp.id)) problems.push('roteiro: gasto não foi vinculado à experiência');
    const dashText = await (async () => { await page.goto(URL + '#/'); await page.waitForTimeout(300); return page.locator('.dash__rel').textContent(); })();
    if (/Rua|CEP/.test(dashText)) problems.push('roteiro: dado sensível exposto no dashboard');

    // Revisão semanal: XP uma única vez
    await page.goto(URL + '#/revisao');
    await page.getByLabel('Prioridades da próxima semana').fill('Primeiro cliente');
    await page.getByRole('button', { name: /Concluir revisão/ }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Atualizar revisão' }).click();
    await page.waitForTimeout(300);
    s = await state();
    if (s.xpEvents.filter((e) => e.key.startsWith('review:')).length !== 1) problems.push('roteiro: revisão concedeu XP mais de uma vez');

    // Recarregar: tudo permanece
    const before = await state();
    await page.reload();
    await page.waitForTimeout(600);
    const after = await state();
    if (JSON.stringify(before) !== JSON.stringify(after)) problems.push('roteiro: estado mudou ao recarregar');
    log(`✓ roteiro completo (XP final ${xp(after)}, ${after.achievements.length} conquistas, nível salvo)`);

    // Movimento reduzido: personagem posicionado sem animação
    await page.goto(URL + '#/configuracoes');
    await page.getByRole('button', { name: 'Reduzidas' }).click();
    await page.goto(URL + '#/');
    await page.waitForTimeout(400);
    const motion = await page.evaluate(() => document.documentElement.dataset.motion);
    if (motion !== 'reduced') problems.push('movimento reduzido não aplicado');
    // Tema escuro
    await page.goto(URL + '#/configuracoes');
    await page.getByRole('button', { name: 'Escuro' }).click();
    await page.goto(URL + '#/');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/06-tema-escuro.png` });
    log('✓ movimento reduzido e tema escuro');
    await ctx.close();
  }

  await browser.close();
  if (problems.length) {
    console.log(`\n${problems.length} problema(s):\n- ` + [...new Set(problems)].join('\n- '));
    process.exit(1);
  }
  console.log('\nTodas as verificações de interface passaram.');
})();

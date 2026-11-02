// E2E da nuvem num navegador real: criar conta → jornada vazia → hábito → XP confirmado → offline →
// registro pendente sem XP → online → sincroniza → segundo aparelho vê o mesmo → sair/entrar.
// Requer: npm run mock:cloud  +  build com ASCENT_SUPABASE_URL=http://localhost:54321  +  npm run preview
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:4173/';
const OUT = process.env.OUT || 'ui-check-output';
require('fs').mkdirSync(OUT, { recursive: true });
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); else console.log('✓ ' + msg); };

(async () => {
  const browser = await chromium.launch();
  const email = `teste${Date.now()}@ascent.dev`;
  const pass = 'senha-forte-123';
  const errors = [];

  async function newDevice(name) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    await page.goto(URL + '#/configuracoes');
    await page.waitForSelector('#acc-cloud-h');
    return { ctx, page };
  }
  const xpOf = (page) => page.evaluate(() => document.querySelector('.topbar [aria-label^="Nível"]')?.textContent);
  const badge = (page) => page.locator('.topbar .sync-badge').getAttribute('aria-label');

  // Aparelho 1: criar conta e começar do zero
  const a = await newDevice('celular');
  await a.page.getByLabel('E-mail').fill(email);
  await a.page.getByLabel('Senha').fill(pass);
  await a.page.getByRole('button', { name: 'Criar conta' }).click();
  await a.page.getByRole('button', { name: /Começar do zero na nuvem/ }).click();
  await a.page.waitForSelector('.topbar .sync-badge');
  check((await badge(a.page)).includes('Sincronizado'), 'conta criada e jornada vazia aberta na nuvem');

  // Criar hábito e concluir (online)
  await a.page.goto(URL + '#/rotina');
  await a.page.getByRole('button', { name: 'Novo hábito' }).click();
  await a.page.getByLabel('Nome').fill('Beber água');
  await a.page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click();
  await a.page.waitForTimeout(500);
  await a.page.locator('.agenda .tick').first().click();
  await a.page.waitForTimeout(1200);
  const coinsOnline = await a.page.locator('.topbar .pill-stat').nth(1).textContent();
  check(Number(coinsOnline.replace(/\D/g, '')) > 0, `hábito confirmado pelo servidor gerou recompensa (${coinsOnline.trim()} moedas)`);
  await a.page.screenshot({ path: `${OUT}/cloud-01-online.png` });

  // Offline: tarefa concluída fica pendente e não gera XP ainda
  const confirmedBefore = await a.page.evaluate(() => document.querySelector('.topbar .pill-stat:nth-of-type(2)')?.textContent);
  await a.ctx.setOffline(true);
  await a.page.getByRole('button', { name: 'Tarefa' }).click();
  await a.page.getByLabel('O que você fez ou vai fazer?').fill('Ligar para cliente');
  await a.page.getByLabel('Já concluída').check();
  await a.page.getByRole('dialog').getByRole('button', { name: 'Registrar ação' }).click();
  await a.page.waitForTimeout(800);
  const offBadge = await badge(a.page);
  check(/Offline|pendente/.test(offBadge), `offline: registro guardado como pendente (${offBadge})`);
  check((await a.page.locator('.agenda .list__title', { hasText: 'Ligar para cliente' }).count()) === 1, 'offline: a tarefa aparece na lista imediatamente');
  const snap = await a.page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('ascent:v1:cloud-snapshot:')).map((k) => JSON.parse(localStorage.getItem(k)).outbox.length));
  check(snap[0] === 1, 'offline: fila guardada no aparelho (sobrevive a recarregar)');
  await a.page.screenshot({ path: `${OUT}/cloud-02-offline.png` });

  // Volta a rede → sincroniza
  await a.ctx.setOffline(false);
  await a.page.evaluate(() => window.dispatchEvent(new Event('online')));
  await a.page.waitForTimeout(1500);
  check((await badge(a.page)).includes('Sincronizado'), 'rede voltou: fila enviada e confirmada');

  // Aparelho 2: entrar na mesma conta e ver tudo
  const b = await newDevice('tablet');
  await b.page.getByLabel('E-mail').fill(email);
  await b.page.getByLabel('Senha').fill(pass);
  await b.page.getByRole('button', { name: 'Entrar' }).click();
  await b.page.waitForSelector('.topbar .sync-badge');
  await b.page.goto(URL + '#/rotina');
  await b.page.waitForTimeout(500);
  check((await b.page.locator('.agenda .list__title', { hasText: 'Ligar para cliente' }).count()) === 1, 'segundo aparelho recebe os registros do primeiro');
  check((await xpOf(a.page)) === (await xpOf(b.page)), 'os dois aparelhos mostram o mesmo nível');

  // Mesmo hábito concluído nos dois → sem duplicar
  const stateXp = (page) => page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('ascent:v1:cloud-snapshot:')); const s = JSON.parse(localStorage.getItem(k)).confirmed; return s.xpEvents.reduce((t, e) => t + e.amount, 0); });
  const before = await stateXp(b.page);
  await b.page.locator('.agenda .tick[aria-checked="true"]').first().click(); // desmarca
  await b.page.waitForTimeout(600);
  await b.page.locator('.agenda .tick[aria-checked="false"]').first().click(); // marca de novo
  await b.page.waitForTimeout(800);
  check((await stateXp(b.page)) === before, 'desfazer e refazer em outro aparelho não duplica XP');

  // Sair: a cópia da nuvem é removida do aparelho e a jornada local volta
  await a.page.goto(URL + '#/configuracoes');
  await a.page.getByRole('button', { name: 'Sair' }).click();
  await a.page.waitForTimeout(500);
  const leftovers = await a.page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('ascent:v1:cloud-snapshot:') || k === 'ascent:v1:refresh').length);
  check(leftovers === 0, 'sair remove a cópia da nuvem e nenhum token fica no aparelho');

  await browser.close();
  if (errors.length) problems.push(...errors);
  if (problems.length) {
    console.log(`\n${problems.length} problema(s):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log('\nFluxo de nuvem: OK');
})();

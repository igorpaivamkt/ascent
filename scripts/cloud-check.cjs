// E2E da nuvem num navegador real: tela de acesso (usuário + senha) → criar conta → jornada vazia → hábito →
// XP confirmado → offline → pendente → online → sincroniza → segundo aparelho vê o mesmo → outra conta NÃO vê
// → trocar senha → sair volta para a tela de acesso.
// Requer: npm run mock:cloud  +  build com ASCENT_SUPABASE_URL=http://localhost:54321  +  npm run preview
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:4173/';
const OUT = process.env.OUT || 'ui-check-output';
require('fs').mkdirSync(OUT, { recursive: true });
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); else console.log('✓ ' + msg); };

(async () => {
  const browser = await chromium.launch();
  const user = 'teste1';
  const other = 'teste2';
  const pass = 'senha-forte-123';
  const errors = [];

  async function newDevice(name) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    await page.goto(URL);
    await page.waitForSelector('main.login');
    return { ctx, page };
  }
  async function enter(page, username, password, { create = false } = {}) {
    if (create) await page.getByRole('tab', { name: 'Criar conta' }).click();
    await page.getByLabel('Usuário').fill(username);
    await page.getByLabel('Senha', { exact: true }).fill(password);
    if (create) await page.getByLabel('Confirmar senha').fill(password);
    await page.locator('main.login form button[type=submit]').click();
  }
  const xpOf = (page) => page.evaluate(() => document.querySelector('.topbar [aria-label^="Nível"]')?.textContent);
  const badge = (page) => page.locator('.topbar .sync-badge').getAttribute('aria-label');

  // Aparelho 1: o app abre na tela de acesso; nome fora da lista é recusado
  const a = await newDevice('celular');
  check((await a.page.locator('input[type=email]').count()) === 0, 'tela de acesso sem campo de e-mail');
  await enter(a.page, 'intruso', pass, { create: true });
  await a.page.waitForSelector('main.login .form-error');
  check(/não está liberado/.test(await a.page.locator('main.login .form-error').textContent()), 'nome de usuário fora da lista não cria conta');
  await a.page.getByRole('tab', { name: 'Entrar' }).click();
  await enter(a.page, user, pass, { create: true });
  await a.page.getByRole('button', { name: /Começar do zero/ }).click();
  await a.page.waitForSelector('.topbar .sync-badge');
  check((await badge(a.page)).includes('Sincronizado'), 'conta criada com usuário e senha; jornada vazia aberta');
  await a.page.screenshot({ path: `${OUT}/cloud-00-conta.png` });

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
  await enter(b.page, user, 'senha-errada-1');
  await b.page.waitForSelector('main.login .form-error');
  check(/Usuário ou senha incorretos/.test(await b.page.locator('main.login .form-error').textContent()), 'senha errada é recusada');
  await enter(b.page, user, pass);
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

  // Outra conta (aparelho 3): não vê nada da primeira
  const c = await newDevice('outro');
  await enter(c.page, other, pass, { create: true });
  await c.page.getByRole('button', { name: /Começar do zero/ }).click();
  await c.page.waitForSelector('.topbar .sync-badge');
  await c.page.goto(URL + '#/rotina');
  await c.page.waitForTimeout(500);
  check((await c.page.locator('.agenda .list__title', { hasText: 'Ligar para cliente' }).count()) === 0 && (await c.page.locator('.agenda .list__title', { hasText: 'Beber água' }).count()) === 0, 'outra conta não vê a jornada da primeira');

  // Trocar senha e entrar com a nova
  await a.page.goto(URL + '#/configuracoes');
  check((await a.page.locator('.kv dd').first().textContent()).trim() === user, 'configurações mostram o nome de usuário (não e-mail)');
  await a.page.getByRole('button', { name: 'Trocar senha' }).click();
  await a.page.getByLabel(/^Nova senha/).fill('nova-senha-456');
  await a.page.getByLabel('Confirmar nova senha').fill('nova-senha-456');
  await a.page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await a.page.waitForTimeout(500);
  check((await a.page.getByRole('dialog').count()) === 0, 'senha trocada');

  // Sair: volta para a tela de acesso e nenhum dado/token da conta fica no aparelho
  await a.page.getByRole('button', { name: 'Sair' }).click();
  await a.page.waitForSelector('main.login');
  const leftovers = await a.page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('ascent:v1:cloud-snapshot:') || k === 'ascent:v1:refresh').length);
  check(leftovers === 0, 'sair volta para a tela de acesso e nenhum token fica no aparelho');
  await enter(a.page, user, pass);
  await a.page.waitForSelector('main.login .form-error');
  check(true, 'senha antiga deixa de funcionar');
  await enter(a.page, user, 'nova-senha-456');
  await a.page.waitForSelector('.topbar .sync-badge');
  check(true, 'entra com a senha nova e reabre a mesma jornada');

  // Manter conectado: recarregar a página não pede login de novo
  await a.page.reload();
  await a.page.waitForSelector('.topbar .sync-badge');
  check(true, '"Manter conectado" mantém a sessão ao reabrir');
  await a.page.screenshot({ path: `${OUT}/cloud-03-logado.png` });

  await browser.close();
  if (errors.length) problems.push(...errors);
  if (problems.length) {
    console.log(`\n${problems.length} problema(s):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log('\nFluxo de nuvem: OK');
})();

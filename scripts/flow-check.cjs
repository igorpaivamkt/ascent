// Teste E2E do fluxo vertical: hábito → XP → conquista → personagem avança → progresso salvo após recarregar.
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:4173/';
const OUT = process.env.OUT || '.';
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL + '#/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.mountain__char');
  const charPos = () => page.$eval('.mountain__char', (el) => el.getAttribute('transform'));
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('ascent:v1:state')));
  const xp = (s) => s.xpEvents.reduce((a, e) => a + e.amount, 0);
  await page.waitForTimeout(600);
  const before = { pos: await charPos(), s: await state() };
  const ticks = page.locator('.dash__today .tick[aria-checked="false"]');
  const n = await ticks.count();
  const results = [];
  for (let i = 0; i < n; i++) {
    await page.locator('.dash__today .tick[aria-checked="false"]').first().click();
    await page.waitForTimeout(i === 0 ? 900 : 300);
    if (i === 0) await page.screenshot({ path: `${OUT}/flow-walking.png` });
  }
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${OUT}/flow-after.png` });
  const after = { pos: await charPos(), s: await state() };
  results.push(`ticks concluídos: ${n}`);
  results.push(`XP: ${xp(before.s)} → ${xp(after.s)}`);
  const newAch = after.s.achievements.filter((a) => !before.s.achievements.some((b) => b.code === a.code)).map((a) => a.code);
  results.push(`novas conquistas: ${newAch.join(', ') || 'nenhuma'}`);
  results.push(`personagem: ${before.pos} → ${after.pos}`);
  const toasts = await page.locator('.toast strong').allTextContents();
  results.push(`toasts visíveis: ${toasts.join(' | ')}`);
  await page.reload();
  await page.waitForSelector('.mountain__char');
  await page.waitForTimeout(500);
  const reloaded = { pos: await charPos(), s: await state() };
  results.push(`após recarregar: ${reloaded.pos} | XP ${xp(reloaded.s)} | conquistas ${reloaded.s.achievements.length}`);
  const samePos = reloaded.pos.split(' scale')[0] === after.pos.split(' scale')[0];
  const ok = xp(after.s) > xp(before.s) && newAch.includes('perfect_day') && before.pos !== after.pos && samePos && xp(reloaded.s) === xp(after.s);
  // Reenviar: desmarcar e marcar de novo não pode duplicar XP
  await page.locator('.dash__today .tick[aria-checked="true"]').first().click();
  await page.waitForTimeout(300);
  await page.locator('.dash__today .tick[aria-checked="false"]').first().click();
  await page.waitForTimeout(400);
  const again = await state();
  results.push(`desfazer+refazer: XP ${xp(again.s ?? again)} (esperado ${xp(after.s)})`);
  const ok2 = xp(again) === xp(after.s);
  console.log(results.join('\n'));
  console.log(errors.length ? 'ERROS:\n' + errors.join('\n') : 'sem erros de console');
  console.log(ok && ok2 ? 'FLUXO VERTICAL: OK' : 'FLUXO VERTICAL: FALHOU');
  await browser.close();
  process.exit(ok && ok2 && !errors.length ? 0 : 1);
})();

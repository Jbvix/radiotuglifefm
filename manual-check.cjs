/* TugLife FM — teste do Manual de bordo e do Tour guiado
   Versão 3.2.0 (SPRINT 20) · 2026-10-12T17:00:00-03:00 · Jossian Brito
   Uso: python3 server.py  (em outro terminal)  →  node manual-check.cjs [pasta-das-capturas]
   Cobre: tour automático na 1ª abertura (6 passos, caixa sempre dentro da tela),
   tour só uma vez por versão do manual, manual abre na seção da aba atual,
   chips e sanfona, "Abrir a aba …", "Rever o tour", link #manual, tema claro,
   computador sem tour automático.
   v3.9.0 (SPRINT 27) · 2026-10-15T16:40:00-03:00 · Jossian Brito
          [MOD] Seção Manobras tem 8 itens (5 de Suape + 3 do card do Rio). */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  // Edge no Windows (padrão do projeto) ou Chromium via PW_CHROME=/caminho/chrome
  const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : { channel: 'msedge', headless: true });
  const out = process.argv[2] || '.'; const errs = [];
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/marinetraffic|windy|supabase|brlogic/, r => r.abort());
  await pg.goto('http://127.0.0.1:8787/index.html');
  // 1ª abertura → tour aparece sozinho
  await pg.waitForSelector('.tour-camada:not([hidden])', { timeout: 4000 });
  for (let k = 1; k <= 6; k++) {
    const t = await pg.locator('.tour-passo').textContent();
    assert.equal(t, `${k} DE 6`);
    const foco = await pg.evaluate(() => getComputedStyle(document.querySelector('.tour-foco')).display);
    const caixa = await pg.evaluate(() => { const r = document.querySelector('.tour-caixa').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; });
    console.log(k, await pg.locator('#tour-titulo').textContent(), 'foco', foco, 'caixa', caixa);
    assert.ok(caixa[0] >= 0 && caixa[1] <= 844, 'caixa dentro da tela');
    await pg.screenshot({ path: `${out}/tour-${k}.png` });
    await pg.click('.tour-prox');
    await pg.waitForTimeout(350);
  }
  assert.equal(await pg.locator('.tour-camada').isHidden(), true);
  assert.equal(await pg.evaluate(() => localStorage.getItem('tuglife_tour_visto')), '3.2.0');
  // reabrir não mostra o tour de novo
  await pg.reload(); await pg.waitForTimeout(1800);
  assert.equal(await pg.locator('.tour-camada').isHidden(), true, 'tour só uma vez');
  // manual a partir da aba Maré abre na seção Maré
  await pg.click('.tabbar [data-aba="mare"]');
  await pg.click('#help-btn');
  assert.equal(await pg.locator('#manual-dialog').evaluate(d => d.open), true);
  assert.equal(await pg.locator('.manual-chip[aria-pressed="true"]').textContent(), 'Maré');
  await pg.click('.manual-chip[data-secao="manobras"]');
  assert.equal(await pg.locator('.manual-item').count(), 8);   // v3.9.0: +3 itens do Rio
  await pg.locator('.manual-item summary').nth(2).click();
  assert.equal(await pg.locator('.manual-item').nth(2).evaluate(d => d.open), true);
  const box = await pg.locator('#manual-dialog').boundingBox();
  console.log('dialog box', box);
  await pg.screenshot({ path: `${out}/manual.png` });
  await pg.click('#manual-ir');
  assert.equal(await pg.evaluate(() => document.body.dataset.aba), 'manobras');
  assert.equal(await pg.locator('#manual-dialog').evaluate(d => d.open), false);
  // Rever o tour
  await pg.click('#help-btn'); await pg.click('#manual-tour');
  assert.equal(await pg.locator('.tour-camada').isHidden(), false);
  await pg.click('.tour-pular');
  assert.equal(await pg.locator('.tour-camada').isHidden(), true);
  // #manual
  await pg.goto('http://127.0.0.1:8787/index.html#manual'); await pg.waitForTimeout(600);
  assert.equal(await pg.locator('#manual-dialog').evaluate(d => d.open), true, '#manual abre');
  // tema claro
  await pg.keyboard.press('Escape');
  await pg.click('#theme-toggle'); await pg.click('#help-btn');
  await pg.screenshot({ path: `${out}/manual-claro.png` });
  // desktop: sem tour automático; tour manual usa os cards
  const d = await b.newPage({ viewport: { width: 1280, height: 900 } });
  d.on('pageerror', e => errs.push('desk ' + e.message));
  await d.route(/marinetraffic|windy|supabase|brlogic/, r => r.abort());
  await d.goto('http://127.0.0.1:8787/index.html'); await d.waitForTimeout(1800);
  assert.equal(await d.locator('.tour-camada').isHidden(), true, 'desktop sem tour automático');
  await d.click('#help-btn'); await d.click('#manual-tour'); await d.waitForTimeout(300);
  console.log('desk passo1 foco', await d.evaluate(() => getComputedStyle(document.querySelector('.tour-foco')).display));
  await d.screenshot({ path: `${out}/tour-desktop.png` });
  assert.deepEqual(errs, []);
  console.log('OK manual + tour');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

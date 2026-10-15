/* TugLife FM — teste da aba Rádio compacta (SPRINT 25 · P2-A)
   Versão 3.7.1 (SPRINT 25) · 2026-10-15T03:00:00-03:00 · Jossian Brito
   v3.7.1  [NOVO] Cenário 5: ouvintes conectados (linha "👥 a bordo · Pico hoje"),
           em 390×844 e 412×823 (Moto G Power do Comandante): a linha não pode
           encavalar o selo STANDBY e o "Mais da TugLife" tem de ficar à vista,
           na largura toda do card.
   Uso: python3 server.py (outro terminal) → node radio-check.cjs [pasta-das-capturas]
   Navegador: Edge por padrão; PW_CHROME=<caminho do Chromium> usa outro.
   Confere:
   - 390×844: aba Rádio sem rolagem; play, faixa atual, grade e "Mais da TugLife" na tela;
     faixa atual dentro do player; painel "Mais" fechado; rodapé oculto.
   - Abrir "Mais da TugLife" mostra Instalar, Compartilhar, Store, Deezer e Alexa.
   - Manual → seção App → "Instalar na tela inicial" abre a aba Rádio, o painel e o diálogo.
   - 1280×900: painel aberto numa linha só, logo abaixo do cabeçalho; rodapé visível.
   - Nenhum erro de JavaScript. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : { channel: 'msedge', headless: true });
  const out = process.argv[2] || '.';
  const errs = [];
  async function abrir(width, height, aba = 'radio') {
    const pg = await b.newPage({ viewport: { width, height } });
    pg.on('pageerror', (e) => errs.push(e.message));
    await pg.addInitScript((a) => { try { localStorage.setItem('tuglife_tour_visto', '3.2.0'); localStorage.setItem('tuglife_aba', a); } catch (e) {} }, aba);
    await pg.route(/marinetraffic|windy|supabase|brlogic|cloudfront|tuglifefmcontrol|simcosta|ioc-sealevel/, (r) => r.abort());
    await pg.goto('http://127.0.0.1:8787/index.html');
    await pg.waitForTimeout(800);
    return pg;
  }
  const caixa = (pg, sel) => pg.locator(sel).evaluate((e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height }; });

  // 1. Celular 390×844: cabe numa tela
  {
    const pg = await abrir(390, 844);
    const rolagem = await pg.evaluate(() => { const s = document.querySelector('.app-shell'); return s.scrollHeight - s.clientHeight; });
    const barra = await caixa(pg, '.tabbar');
    console.log('rolagem da aba Rádio:', rolagem, 'px');
    assert.ok(rolagem <= 4, 'aba Rádio sem rolagem em 390×844');
    for (const sel of ['#btn-play', '#now-playing-brlogic', '#schedule-panel>summary', '#more-panel>summary']) {
      const c = await caixa(pg, sel);
      assert.ok(c.h > 0 && c.bottom <= barra.top + 1, `${sel} visível acima da barra de abas`);
    }
    assert.equal(await pg.locator('#card-player #now-playing-brlogic').count(), 1, 'faixa atual dentro do player');
    assert.equal(await pg.locator('#more-panel').evaluate((e) => e.open), false, 'painel fechado no celular');
    assert.equal(await pg.locator('.app-shell>footer').isVisible(), false, 'rodapé oculto no celular');
    await pg.screenshot({ path: `${out}/radio-390.png` });
    // 2. Abrir o painel
    await pg.click('#more-panel>summary');
    await pg.waitForTimeout(700);   // rolagem suave até o painel
    const alexa = await caixa(pg, '.btn-ext.alexa');
    assert.ok(alexa.bottom <= barra.top + 1, 'ao abrir, a aba rola até os botões');
    for (const sel of ['#install-app', '#share-radio', 'a[href*="tuglife.store"]', 'a[href*="deezer"]', '.btn-ext.alexa']) {
      assert.equal(await pg.locator(sel).isVisible(), true, `${sel} visível com o painel aberto`);
    }
    await pg.screenshot({ path: `${out}/radio-390-mais.png` });
    await pg.close();
  }
  // 3. Manual → App → "Instalar na tela inicial" (partindo da aba Maré)
  {
    const pg = await abrir(390, 844, 'mare');
    await pg.click('#help-btn');
    await pg.click('.manual-chip[data-secao="app"]');
    assert.equal(await pg.locator('#manual-ir').textContent(), 'Instalar na tela inicial');
    await pg.click('#manual-ir');
    await pg.waitForSelector('#install-dialog[open]', { timeout: 3000 });
    assert.equal(await pg.evaluate(() => document.body.dataset.aba), 'radio', 'voltou para a aba Rádio');
    assert.equal(await pg.locator('#more-panel').evaluate((e) => e.open), true, 'painel aberto pelo manual');
    await pg.close();
  }
  // 4. Computador 1280×900: painel aberto, numa linha, abaixo do cabeçalho
  {
    const pg = await abrir(1280, 900);
    assert.equal(await pg.locator('#more-panel').evaluate((e) => e.open), true, 'painel aberto no computador');
    const inst = await caixa(pg, '#install-app'), alexa = await caixa(pg, '.btn-ext.alexa');
    assert.ok(Math.abs((inst.top + inst.bottom) / 2 - (alexa.top + alexa.bottom) / 2) < 12, 'botões numa linha só');
    const cab = await caixa(pg, 'header.app-header'), mais = await caixa(pg, '#more-panel'), player = await caixa(pg, '#card-player');
    assert.ok(mais.top >= cab.bottom && mais.bottom <= player.top, 'painel entre o cabeçalho e o player');
    assert.equal(await pg.locator('.app-shell>footer').isVisible(), true, 'rodapé visível no computador');
    assert.equal(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'sem rolagem lateral');
    await pg.screenshot({ path: `${out}/radio-1280.png` });
    await pg.close();
  }
  // 5. v3.7.1: com ouvintes conectados (a linha de ouvintes só aparece com o Supabase no ar)
  for (const [w, h] of [[390, 844], [412, 823]]) {
    const pg = await abrir(w, h);
    await pg.evaluate(() => {
      document.getElementById('crew-row').hidden = false;
      document.getElementById('crew-peak').hidden = false;
      document.getElementById('now-playing-brlogic').textContent = '♪ Agora: Love night - Parte 05';
    });
    const selo = await caixa(pg, '#badge-live'), crew = await caixa(pg, '#crew-row'), barra = await caixa(pg, '.tabbar');
    assert.ok(crew.top >= selo.bottom - 0.5, `${w}×${h}: linha de ouvintes não encavala o STANDBY`);
    const mais = await caixa(pg, '#more-panel>summary');
    assert.ok(mais.bottom <= barra.top + 1, `${w}×${h}: "Mais da TugLife" acima da barra de abas`);
    const larguras = await pg.evaluate(() => [document.getElementById('more-panel').offsetWidth, document.getElementById('card-prog').offsetWidth]);
    assert.equal(larguras[0], larguras[1], `${w}×${h}: painel "Mais" na largura toda`);
    await pg.screenshot({ path: `${out}/radio-crew-${w}.png` });
    await pg.close();
  }
  assert.deepEqual(errs, []);
  console.log('OK aba Rádio compacta');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });

/* TugLife FM — teste do nível medido (tide-live.js)
   Versão 3.4.0 (SPRINT 22) · 2026-10-12T18:30:00-03:00 · Jossian Brito
   Simula a API SiMCosta: leitura = previsão + 12 cm (maré meteorológica) + 12,374 m (zero do radar).
   Uso: python3 server.py (outro terminal) → node tide-live-check.cjs [pasta-das-capturas]
   Cenários: ao vivo, busca incremental, dado velho, falha da API, outro porto, outro dia. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const OFFSET = 12.374, SURGE = 0.12;
(async () => {
  const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : { channel: 'msedge', headless: true });
  const out = process.argv[2] || '.';
  const errs = [];
  async function abrir({ modo = 'ok', atrasoMin = 3 } = {}) {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
    pg.on('pageerror', (e) => errs.push(e.message));
    const chamadas = [];
    await pg.addInitScript(() => { try { localStorage.setItem('tuglife_tour_visto', '3.2.0'); localStorage.setItem('tuglife_tide_port', 'rio-grande'); localStorage.setItem('tuglife_aba', 'mare'); } catch (e) {} });
    await pg.route(/marinetraffic|windy|supabase|brlogic|tuglifefmcontrol/, (r) => r.abort());
    await pg.route(/simcosta\.furg\.br\/api\/intrans_data/, async (route) => {
      const u = new URL(route.request().url());
      chamadas.push({ t1: +u.searchParams.get('time1'), t2: +u.searchParams.get('time2'), boia: u.searchParams.get('boiaID'), p: u.searchParams.get('params') });
      if (modo === 'falha') return route.fulfill({ status: 500, body: 'erro' });
      // a página calcula a previsão; o "servidor" falso pede a ela os valores
      const t1 = +u.searchParams.get('time1') * 1000, t2 = Math.min(+u.searchParams.get('time2') * 1000, Date.now() - atrasoMin * 60000);
      const ts = []; for (let t = Math.ceil(t1 / 60000) * 60000; t <= t2; t += 60000) ts.push(t);
      const niveis = await pg.evaluate((lista) => lista.map((t) => window.TugTides.preditor().getWaterLevelAtTime({ time: new Date(t) }).level), ts);
      const body = ts.map((t, i) => ({ timestamp: new Date(t).toISOString(), YEAR: 2026, avg_water_level_arbitrary_zero: +(niveis[i] + SURGE + OFFSET + (i % 2 ? 0.004 : -0.004)).toFixed(3) }));
      route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    });
    await pg.goto('http://127.0.0.1:8787/index.html');
    return { pg, chamadas };
  }

  // 1. Ao vivo
  {
    const { pg, chamadas } = await abrir();
    await pg.waitForSelector('#tide-live:not([hidden]) .tide-live-valor', { timeout: 6000 });
    const txt = await pg.locator('#tide-live').innerText();
    console.log('caixa:', txt.replace(/\n/g, ' | '));
    assert.match(txt, /Maré meteorológica: \+12 cm acima da previsão/);
    assert.match(txt, /SiMCosta\/FURG/);
    assert.equal(await pg.locator('.tide-now-box span').textContent(), 'Previsto agora');
    assert.equal(await pg.locator('#tide-chart .tide-real').count(), 1, 'linha medida no gráfico');
    assert.equal(chamadas[0].boia, '332'); assert.equal(chamadas[0].p, 'avg_water_level_arbitrary_zero');
    assert.ok(chamadas[0].t2 - chamadas[0].t1 >= 6 * 3600 - 5, '1ª busca = 6 h');
    // nível exibido = previsão do último dado + 12 cm
    const esperado = await pg.evaluate(() => { const t = Date.now() - 3 * 60000; return window.TugTides.preditor().getWaterLevelAtTime({ time: new Date(t) }).level + 0.12; });
    const mostrado = parseFloat(txt.match(/(-?\d+,\d+) m/)[1].replace(',', '.'));
    console.log('nível mostrado', mostrado, 'esperado', esperado.toFixed(2));
    assert.ok(Math.abs(mostrado - esperado) <= 0.011, 'nível ≈ previsão + surge');
    await pg.screenshot({ path: `${out}/live-ok.png` });
    // 2. Busca incremental: força nova busca (relógio + 6 min)
    await pg.evaluate(() => { const r = Date.now; const d = 6 * 60000; Date.now = () => r() + d; });
    await pg.evaluate(() => window.TugTides.render());
    await pg.waitForFunction(() => true); await pg.waitForTimeout(800);
    console.log('chamadas', chamadas.length, chamadas.map((c) => c.t2 - c.t1));
    assert.ok(chamadas.length >= 2 && chamadas[1].t2 - chamadas[1].t1 < 3600, 'busca incremental pequena');
    // 3. Outro dia → caixa some e sem linha medida
    await pg.click('#tide-next'); await pg.waitForTimeout(200);
    assert.equal(await pg.locator('#tide-live').isHidden(), true, 'outro dia sem caixa');
    assert.equal(await pg.locator('#tide-chart .tide-real').count(), 0);
    await pg.click('#tide-today');
    // 4. Outro porto → some
    await pg.selectOption('#tide-port', 'suape'); await pg.waitForTimeout(200);
    assert.equal(await pg.locator('#tide-live').isHidden(), true, 'Suape sem caixa');
    assert.equal(await pg.locator('.tide-now-box span').textContent(), 'Agora');
    await pg.close();
  }
  // 5. Dado velho (45 min)
  {
    const { pg } = await abrir({ atrasoMin: 45 });
    await pg.waitForSelector('#tide-live.is-off:not([hidden])', { timeout: 6000 });
    const txt = await pg.locator('#tide-live').innerText();
    console.log('velho:', txt.replace(/\n/g, ' | '));
    assert.match(txt, /Sem dado novo/);
    assert.equal(await pg.locator('.tide-now-box span').textContent(), 'Agora');
    await pg.close();
  }
  // 6. Falha da API
  {
    const { pg } = await abrir({ modo: 'falha' });
    await pg.waitForSelector('#tide-live.is-off:not([hidden])', { timeout: 6000 });
    console.log('falha:', await pg.locator('#tide-live').innerText());
    assert.equal(await pg.locator('#tide-list li').count() > 0, true, 'previsão continua');
    await pg.close();
  }
  assert.deepEqual(errs, []);
  console.log('OK nível medido');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });

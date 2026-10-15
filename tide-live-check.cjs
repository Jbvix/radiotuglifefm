/* TugLife FM — teste do nível medido (tide-live.js)
   Versão 3.8.0 (SPRINT 26) · 2026-10-15T00:45:00-03:00 · Jossian Brito
   Simula a API SiMCosta: leitura(t) = previsão(t + adiantamento) + 12 cm (maré meteorológica) + zero do radar.
   Uso: python3 server.py (outro terminal) → node tide-live-check.cjs [pasta-das-capturas]
   Cenários: ao vivo, busca incremental, dado velho, falha da API, outro porto, outro dia.
   v3.5.0  [NOVO] Suape com 2 marégrafos (Recife 330 + Tamandaré 399, adiantamento 11 min):
           média ao vivo, uma fonte fora (segue com a outra) e as duas fora.
   v3.6.0  [NOVO] Pecém, Rio de Janeiro, Paranaguá (SiMCosta) e Salvador (IOC/UNESCO
           simulada, com um sensor "prs" de isca que precisa ser ignorado).
   v3.8.0  [MOD] A faixa "Ao vivo" nasce recolhida: lerCaixa() abre os detalhes antes de ler.
           [NOVO] Cenário 12: fechada = uma linha (≤ 52 px) com nível e maré meteorológica;
           abre e fecha pelo botão (aria-expanded) e continua aberta depois de nova busca;
           maré meteorológica forte (+20 cm) fica laranja já na linha fechada. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
let SURGE = 0.12;
// v3.8.0: abre os detalhes da faixa (se ainda fechada) e devolve o texto inteiro
async function lerCaixa(pg) {
  const bt = pg.locator('#tide-live .tide-live-resumo');
  if (await bt.count() && (await bt.getAttribute('aria-expanded')) === 'false') await bt.click();
  return pg.locator('#tide-live').innerText();
}
// boia → zero do radar e quanto a maré chega antes da previsão do porto (min)
const BOIAS = { 332: { off: 12.374, adiant: 0 }, 330: { off: 10.311, adiant: 11 }, 399: { off: 10.305, adiant: 11 },
  307: { off: 9.293, adiant: 0 }, 304: { off: 11.528, adiant: 0 }, 300: { off: 11.295, adiant: 0 }, salv: { off: 4.195, adiant: 0 } };
(async () => {
  const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : { channel: 'msedge', headless: true });
  const out = process.argv[2] || '.';
  const errs = [];
  async function abrir({ modo = 'ok', atrasoMin = 3, porto = 'rio-grande', mudas = [] } = {}) {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
    pg.on('pageerror', (e) => errs.push(e.message));
    const chamadas = [];
    await pg.addInitScript((porto) => { try { localStorage.setItem('tuglife_tour_visto', '3.2.0'); localStorage.setItem('tuglife_tide_port', porto); localStorage.setItem('tuglife_aba', 'mare'); } catch (e) {} }, porto);
    await pg.route(/marinetraffic|windy|supabase|brlogic|tuglifefmcontrol/, (r) => r.abort());
    await pg.route(/simcosta\.furg\.br\/api\/intrans_data/, async (route) => {
      const u = new URL(route.request().url());
      chamadas.push({ t1: +u.searchParams.get('time1'), t2: +u.searchParams.get('time2'), boia: u.searchParams.get('boiaID'), p: u.searchParams.get('params') });
      const boia = BOIAS[u.searchParams.get('boiaID')];
      if (modo === 'falha' || mudas.includes(+u.searchParams.get('boiaID'))) return route.fulfill({ status: 500, body: 'erro' });
      // a página calcula a previsão; o "servidor" falso pede a ela os valores
      const t1 = +u.searchParams.get('time1') * 1000, t2 = Math.min(+u.searchParams.get('time2') * 1000, Date.now() - atrasoMin * 60000);
      const ts = []; for (let t = Math.ceil(t1 / 60000) * 60000; t <= t2; t += 60000) ts.push(t);
      const niveis = await pg.evaluate(([lista, ad]) => lista.map((t) => window.TugTides.preditor().getWaterLevelAtTime({ time: new Date(t + ad * 60000) }).level), [ts, boia.adiant]);
      const body = ts.map((t, i) => ({ timestamp: new Date(t).toISOString(), YEAR: 2026, avg_water_level_arbitrary_zero: +(niveis[i] + SURGE + boia.off + (i % 2 ? 0.004 : -0.004)).toFixed(3) }));
      route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    });
    // v3.6.0: IOC/UNESCO simulada (Salvador). Datas ISO em UTC; resposta com 2 sensores.
    await pg.route(/ioc-sealevelmonitoring\.org\/service\.php/, async (route) => {
      const u = new URL(route.request().url());
      const code = u.searchParams.get('code');
      chamadas.push({ boia: code, t1: Date.parse(u.searchParams.get('timestart') + 'Z') / 1000, t2: Date.parse(u.searchParams.get('timestop') + 'Z') / 1000 });
      if (modo === 'falha' || mudas.includes(code)) return route.fulfill({ status: 500, body: 'erro' });
      const boia = BOIAS[code];
      const t1 = Date.parse(u.searchParams.get('timestart') + 'Z'), t2 = Math.min(Date.parse(u.searchParams.get('timestop') + 'Z'), Date.now() - atrasoMin * 60000);
      const ts = []; for (let t = Math.ceil(t1 / 60000) * 60000; t <= t2; t += 60000) ts.push(t);
      const niveis = await pg.evaluate((lista) => lista.map((t) => window.TugTides.preditor().getWaterLevelAtTime({ time: new Date(t) }).level), ts);
      const st = (t) => new Date(t).toISOString().slice(0, 19).replace('T', ' ');
      const body = ts.flatMap((t, i) => [
        { slevel: +(niveis[i] + SURGE + boia.off).toFixed(3), stime: st(t), sensor: 'rad' },
        { slevel: 9.999, stime: st(t), sensor: 'prs' }          // isca: outro sensor
      ]);
      route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    });
    await pg.goto('http://127.0.0.1:8787/index.html');
    return { pg, chamadas };
  }

  // 1. Ao vivo
  {
    const { pg, chamadas } = await abrir();
    await pg.waitForSelector('#tide-live:not([hidden]) .tide-live-num', { timeout: 6000 });
    const txt = await lerCaixa(pg);
    console.log('caixa:', txt.replace(/\n/g, ' | '));
    assert.match(txt, /Maré meteorológica: \+12 cm acima da previsão/);
    assert.match(txt, /SiMCosta\/FURG/);
    assert.equal(await pg.locator('.tide-now-box span').textContent(), 'Previsto agora');
    assert.equal(await pg.locator('#tide-chart .tide-real').count(), 1, 'linha medida no gráfico');
    assert.equal(chamadas[0].boia, '332'); assert.equal(chamadas[0].p, 'avg_water_level_arbitrary_zero');
    assert.ok(chamadas[0].t2 - chamadas[0].t1 >= 6 * 3600 - 5, '1ª busca = 6 h');
    // nível exibido = previsão do último dado + 12 cm
    const esperado = await pg.evaluate(() => { const t = Date.now() - 3 * 60000; return window.TugTides.preditor().getWaterLevelAtTime({ time: new Date(t) }).level + 0.12; });
    const mostrado = parseFloat(txt.match(/([-−]?\d+,\d+) m/)[1].replace(',', '.').replace('−', '-'));
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
    // 4. Outro porto sem marégrafo → some
    await pg.selectOption('#tide-port', 'santos'); await pg.waitForTimeout(200);
    assert.equal(await pg.locator('#tide-live').isHidden(), true, 'Santos sem caixa');
    assert.equal(await pg.locator('.tide-now-box span').textContent(), 'Agora');
    await pg.close();
  }
  // 5. Dado velho (45 min)
  {
    const { pg } = await abrir({ atrasoMin: 45 });
    await pg.waitForSelector('#tide-live.is-off:not([hidden])', { timeout: 6000 });
    const txt = await lerCaixa(pg);
    console.log('velho:', txt.replace(/\n/g, ' | '));
    assert.match(txt, /sem dado novo/i);
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
  // 7. Suape: média de Recife + Tamandaré, horário corrigido (11 min)
  {
    const { pg, chamadas } = await abrir({ porto: 'suape' });
    await pg.waitForSelector('#tide-live:not([hidden]) .tide-live-num', { timeout: 6000 });
    const txt = await lerCaixa(pg);
    console.log('suape:', txt.replace(/\n/g, ' | '));
    assert.deepEqual([...new Set(chamadas.map((c) => c.boia))].sort(), ['330', '399'], 'busca nas duas boias');
    assert.match(txt, /Recife \+ Tamandaré/i);
    assert.match(txt, /Média de Recife e Tamandaré · horário corrigido para Suape/);
    // sem a correção de 11 min a meia-maré daria até ±9 cm de erro: aqui tem de dar +12 exatos
    assert.match(txt, /Maré meteorológica: \+12 cm acima da previsão/);
    assert.match(txt, /UFPE e CEPENE/);
    assert.equal(await pg.locator('#tide-chart .tide-real').count(), 1, 'linha medida no gráfico');
    // nível = previsão no horário do porto (leitura + 11 min) + 12 cm
    const esperado = await pg.evaluate(() => window.TugTides.preditor().getWaterLevelAtTime({ time: new Date(Date.now() - 3 * 60000 + 11 * 60000) }).level + 0.12);
    const mostrado = parseFloat(txt.match(/([-−]?\d+,\d+) m/)[1].replace(',', '.').replace('−', '-'));
    console.log('suape nível mostrado', mostrado, 'esperado', esperado.toFixed(2));
    assert.ok(Math.abs(mostrado - esperado) <= 0.011, 'nível Suape ≈ previsão + surge');
    await pg.screenshot({ path: `${out}/live-suape.png` });
    await pg.close();
  }
  // 8. Suape com Recife fora: segue só com Tamandaré
  {
    const { pg } = await abrir({ porto: 'suape', mudas: [330] });
    await pg.waitForSelector('#tide-live:not([hidden]) .tide-live-num', { timeout: 6000 });
    const txt = await lerCaixa(pg);
    console.log('suape 1 fonte:', txt.replace(/\n/g, ' | '));
    assert.match(txt, /nível medido · Tamandaré\s*\n/i);
    assert.match(txt, /Só Tamandaré no ar \(Recife sem dado\)/);
    assert.match(txt, /\+12 cm acima/);
    await pg.close();
  }
  // 9. Suape com as duas fora: aviso e previsão intacta
  {
    const { pg } = await abrir({ porto: 'suape', mudas: [330, 399] });
    await pg.waitForSelector('#tide-live.is-off:not([hidden])', { timeout: 6000 });
    assert.match(await pg.locator('#tide-live').innerText(), /indisponível/i);
    assert.equal(await pg.locator('.tide-now-box span').textContent(), 'Agora');
    assert.ok(await pg.locator('#tide-list li').count() > 0, 'previsão continua');
    await pg.close();
  }
  // 10. Portos novos da v3.6.0: caixa ao vivo com +12 cm em cada um, na fonte certa
  for (const [porto, boia, nome] of [['pecem', '307', 'Pecém'], ['rio-de-janeiro', '304', 'Niterói'], ['paranagua', '300', 'Paranaguá'], ['salvador', 'salv', 'Salvador']]) {
    const { pg, chamadas } = await abrir({ porto });
    await pg.waitForSelector('#tide-live:not([hidden]) .tide-live-num', { timeout: 6000 });
    const txt = await lerCaixa(pg);
    console.log(porto + ':', txt.replace(/\n+/g, ' | '));
    assert.equal(chamadas[0].boia, boia, `${porto}: fonte ${boia}`);
    assert.ok(chamadas[0].t2 - chamadas[0].t1 >= 6 * 3600 - 5, `${porto}: 1ª busca = 6 h`);
    assert.match(txt, new RegExp('nível medido · ' + nome, 'i'));
    assert.match(txt, /Maré meteorológica: \+12 cm acima da previsão/, `${porto}: +12 cm`);
    assert.equal(await pg.locator('#tide-chart .tide-real').count(), 1, `${porto}: linha medida`);
    if (porto === 'salvador') { assert.match(txt, /IBGE \(RMPG\), via IOC\/UNESCO/); await pg.screenshot({ path: `${out}/live-salvador.png` }); }
    await pg.close();
  }
  // 11. Itaqui (fora da v3.6.0) não chama API nenhuma
  {
    const { pg, chamadas } = await abrir({ porto: 'itaqui' });
    await pg.waitForTimeout(1500);
    assert.equal(chamadas.length, 0, 'Itaqui sem busca');
    assert.equal(await pg.locator('#tide-live').isHidden(), true);
    await pg.close();
  }
  // 12. v3.8.0: faixa recolhida
  {
    const { pg } = await abrir({ porto: 'suape' });
    await pg.waitForSelector('#tide-live:not([hidden]) .tide-live-resumo', { timeout: 6000 });
    const bt = pg.locator('#tide-live .tide-live-resumo');
    assert.equal(await bt.getAttribute('aria-expanded'), 'false', 'nasce fechada');
    assert.equal(await pg.locator('#tide-live-detalhes').isVisible(), false);
    const alt = (await pg.locator('#tide-live').boundingBox()).height;
    const linha = await bt.innerText();
    console.log('fechada:', linha.replace(/\n/g, ' '), '·', Math.round(alt), 'px');
    assert.ok(alt <= 52, 'fechada ocupa uma linha');
    assert.match(linha, /Medido/i); assert.match(linha, /\d,\d\d m/); assert.match(linha, /\+12 cm da previsão/);
    await bt.click();
    assert.equal(await bt.getAttribute('aria-expanded'), 'true');
    assert.equal(await pg.locator('#tide-live-detalhes').isVisible(), true, 'abre os detalhes');
    // nova busca (relógio + 6 min) redesenha a caixa: continua aberta
    await pg.evaluate(() => { const r = Date.now; Date.now = () => r() + 6 * 60000; window.TugTides.render(); });
    await pg.waitForTimeout(800);
    assert.equal(await pg.locator('#tide-live .tide-live-resumo').getAttribute('aria-expanded'), 'true', 'continua aberta após atualizar');
    await pg.locator('#tide-live .tide-live-resumo').click();
    assert.equal(await pg.locator('#tide-live-detalhes').isVisible(), false, 'fecha de novo');
    await pg.screenshot({ path: `${out}/live-recolhida.png` });
    await pg.close();
  }
  // 13. maré meteorológica forte: laranja já na linha fechada
  {
    SURGE = 0.20;
    const { pg } = await abrir({ porto: 'pecem' });
    await pg.waitForSelector('#tide-live:not([hidden]) .tide-live-meteo', { timeout: 6000 });
    assert.equal(await pg.locator('#tide-live .tide-live-meteo').getAttribute('data-forte'), 'sim', '+20 cm em destaque');
    assert.match(await pg.locator('#tide-live .tide-live-meteo').innerText(), /\+20 cm da previsão/);
    await pg.close();
    SURGE = 0.12;
  }
  assert.deepEqual(errs, []);
  console.log('OK nível medido');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });

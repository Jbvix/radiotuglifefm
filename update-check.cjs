/* TugLife FM — teste do aviso de nova versão (pwa.js + sw.js)
   Versão 3.8.0 (SPRINT 26) · 2026-10-15T00:30:00-03:00 · Jossian Brito
   Uso: node update-check.cjs [pasta-das-capturas]   (sobe o próprio servidor na porta 8799)
   Navegador: Edge por padrão; PW_CHROME=<caminho do Chromium> usa outro.

   COMO SIMULA UM DEPLOY
   O servidor deste teste serve os arquivos do repositório, mas acrescenta ao sw.js
   e ao VERSION.json o "deploy" atual (1, 2, 3…). Mudar o deploy muda o sw.js byte a
   byte: o navegador instala a versão nova e ela fica em espera — igual a um
   deploy real na Netlify.

   Cenários:
   1. 1ª visita: o SW instala e assume sem recarregar a página e sem aviso.
   2. Deploy novo + app procurando versão: faixa "Nova versão 9.9.2 disponível".
   3. "×" dispensa a faixa.
   4. Deploy novo com a rádio tocando: a faixa avisa que o áudio para; nada troca sozinho.
   5. "Atualizar": a página recarrega já na versão nova, sem versão em espera e sem faixa.
   6. Nenhum erro de JavaScript. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const RAIZ = __dirname, PORTA = 8799;
let deploy = 1;
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const arq = path.join(RAIZ, p);
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404); return res.end(); }
  let corpo = fs.readFileSync(arq);
  if (p === '/sw.js') corpo = Buffer.concat([corpo, Buffer.from(`\n// deploy de teste ${deploy}\n`)]);
  if (p === '/VERSION.json') corpo = Buffer.from(JSON.stringify({ version: '9.9.' + deploy }));
  res.writeHead(200, { 'content-type': TIPOS[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(corpo);
});

(async () => {
  await new Promise((ok) => servidor.listen(PORTA, '127.0.0.1', ok));
  const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : { channel: 'msedge', headless: true });
  const out = process.argv[2] || '.';
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('tuglife_tour_visto', '3.2.0'); localStorage.setItem('tuglife_aba', 'radio'); } catch (e) {} });
  await ctx.route(/marinetraffic|windy|supabase|brlogic|cloudfront|tuglifefmcontrol|simcosta|ioc-sealevel|fonts\.g/, (r) => r.abort());
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errs.push(e.message));
  const barraVisivel = () => pg.locator('#update-bar').isVisible();
  // dispara a busca do próprio app (a mesma de quando o tripulante volta ao app)
  const procurar = () => pg.evaluate(() => window.TugUpdate.verificar());
  const esperarEmEspera = () => pg.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting, null, { timeout: 10000 });

  // 1. Primeira visita
  await pg.goto(`http://127.0.0.1:${PORTA}/`);
  await pg.evaluate(() => { window.__marca = 'pagina-original'; });
  await pg.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
  await pg.waitForTimeout(500);
  assert.equal(await pg.evaluate(() => window.__marca), 'pagina-original', '1ª visita não recarrega');
  assert.equal(await barraVisivel(), false, '1ª visita sem aviso');

  // 2. Deploy 2 → faixa
  deploy = 2;
  await procurar(); await esperarEmEspera();
  await pg.waitForSelector('#update-bar:not([hidden])', { timeout: 5000 });
  const txt = await pg.locator('#update-text').textContent();
  console.log('faixa:', txt);
  assert.equal(txt, 'Nova versão 9.9.2 disponível');
  const faixa = await pg.locator('#update-bar').boundingBox(), barraAbas = await pg.locator('.tabbar').boundingBox();
  assert.ok(faixa.y + faixa.height < barraAbas.y && faixa.y > 40, 'faixa abaixo do cabeçalho e acima da barra de abas');
  await pg.screenshot({ path: `${out}/update-faixa.png` });

  // 3. Dispensar
  await pg.click('#update-close');
  assert.equal(await barraVisivel(), false, '× dispensa');

  // 4. Recarrega (a versão 2 continua em espera: nada troca sozinho), põe a "rádio tocando" e faz o deploy 3
  await pg.reload(); await pg.waitForTimeout(800);
  await pg.waitForSelector('#update-bar:not([hidden])', { timeout: 5000 });   // versão em espera → faixa de novo
  await pg.evaluate(() => Object.defineProperty(document.getElementById('radio-stream'), 'paused', { get: () => false }));
  await pg.evaluate(() => { window.__marca = 'antes-de-atualizar'; });
  deploy = 3;
  await procurar();
  await pg.waitForFunction(() => /9\.9\.3 disponível · a rádio para por alguns segundos/.test(document.getElementById('update-text').textContent), null, { timeout: 10000 });
  console.log('tocando:', await pg.locator('#update-text').textContent());
  await pg.waitForTimeout(1500);
  assert.equal(await pg.evaluate(() => window.__marca), 'antes-de-atualizar', 'com a rádio tocando nada troca sozinho');

  // 5. Atualizar
  const scriptAntes = await pg.evaluate(async () => (await navigator.serviceWorker.getRegistration()).active.scriptURL);
  await Promise.all([pg.waitForEvent('load', { timeout: 10000 }), pg.click('#update-go')]);
  await pg.waitForTimeout(800);
  assert.equal(await pg.evaluate(() => window.__marca), undefined, 'página recarregou');
  const depois = await pg.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { espera: !!r.waiting, ativo: r.active.state, temController: !!navigator.serviceWorker.controller }; });
  console.log('depois de atualizar:', JSON.stringify(depois), scriptAntes.endsWith('sw.js'));
  assert.deepEqual(depois, { espera: false, ativo: 'activated', temController: true });
  assert.equal(await barraVisivel(), false, 'sem faixa na versão nova');
  // o sw.js ativo é o do deploy 3
  const swAtivo = await pg.evaluate(async () => (await (await fetch('sw.js', { cache: 'no-store' })).text()).match(/deploy de teste (\d+)/)[1]);
  assert.equal(swAtivo, '3');

  assert.deepEqual(errs, []);
  console.log('OK aviso de nova versão');
  await b.close();
  servidor.close();
})().catch((e) => { console.error(e); servidor.close(); process.exit(1); });

/* TugLife FM — teste do contador de visitas (visitas.js)
   Versão 3.10.0 (SPRINT 29) · 2026-10-15T18:45:00-03:00 · Jossian Brito
   Uso: node visitas-check.cjs [pasta-das-capturas]   (sobe o próprio servidor na porta 8797)
   Navegador: Edge por padrão; PW_CHROME=<caminho do Chromium> usa outro.
   A função registrar_visita é simulada (rota interceptada): nenhuma visita
   de teste vai para o banco real.

   Cenários:
   1. 1ª abertura: o app sorteia um código UUID v4, guarda em "tuglife_aparelho"
      e envia SÓ esse código (nenhum outro campo) para registrar_visita.
   2. Celular (390×844): a linha 👁️ aparece em "Mais da TugLife" com o número no
      padrão brasileiro ("12.345 visitas · 1.234 aparelhos · 87 hoje"); o rodapé
      segue oculto e a aba Rádio continua sem rolagem.
   3. Recarregar: o MESMO código é reenviado (o aparelho não vira outro).
   4. Singular: 1 visita · 1 aparelho.
   5. Função fora do ar (500) ou offline: as linhas ficam ocultas e o app segue.
   6. Computador (1280 px): a linha aparece no rodapé e não se repete no painel.
   7. Nenhum erro de JavaScript. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const RAIZ = __dirname, PORTA = 8797;
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const arq = path.join(RAIZ, p);
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(fs.readFileSync(arq));
});

const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

(async () => {
  await new Promise((ok) => servidor.listen(PORTA, '127.0.0.1', ok));
  const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : { channel: 'msedge', headless: true });
  const out = process.argv[2] || '.';
  const errs = [];
  const enviados = [];
  let resposta = { status: 200, corpo: { visitas: 12345, aparelhos: 1234, hoje: 87 } };

  async function contexto(viewport) {
    const ctx = await b.newContext({ viewport, serviceWorkers: 'block' });
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('init')) { localStorage.setItem('tuglife_tour_visto', '3.2.0'); localStorage.setItem('tuglife_aba', 'radio'); sessionStorage.setItem('init', '1'); } } catch (e) {} });
    await ctx.route(/marinetraffic|windy|brlogic|cloudfront|tuglifefmcontrol|simcosta|ioc-sealevel|fonts\.g|jsdelivr/, (r) => r.abort());
    await ctx.route(/supabase\.co\/rest\/v1\/rpc\/registrar_visita/, async (r) => {
      enviados.push(JSON.parse(r.request().postData() || '{}'));
      if (resposta.status === 0) return r.abort();
      await r.fulfill({ status: resposta.status, contentType: 'application/json', body: JSON.stringify(resposta.corpo) });
    });
    await ctx.route(/supabase\.co/, (r) => (/registrar_visita/.test(r.request().url()) ? r.fallback() : r.abort()));
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => errs.push(e.message));
    return { ctx, pg };
  }
  const URL_APP = `http://127.0.0.1:${PORTA}/`;
  const texto = (pg, sel) => pg.locator(sel).innerText();

  // 1–3. Celular
  {
    const { ctx, pg } = await contexto({ width: 390, height: 844 });
    await pg.goto(URL_APP);
    await pg.locator('.visitas-mais:not([hidden])').waitFor({ state: 'attached', timeout: 8000 });
    assert.equal(enviados.length, 1, 'uma chamada por abertura');
    assert.deepEqual(Object.keys(enviados[0]), ['p_aparelho'], 'só o código do aparelho vai ao servidor');
    assert.match(enviados[0].p_aparelho, UUID4, 'código é UUID v4');
    const guardado = await pg.evaluate(() => localStorage.getItem('tuglife_aparelho'));
    assert.equal(guardado, enviados[0].p_aparelho, 'código guardado no aparelho');
    console.log('✓ 1. código anônimo sorteado, guardado e enviado sozinho');

    await pg.locator('#more-panel > summary').click();
    assert.equal((await texto(pg, '.visitas-mais')).trim(), '👁️ 12.345 visitas · 1.234 aparelhos · 87 hoje');
    assert.equal(await pg.locator('footer').isVisible(), false, 'rodapé segue oculto no celular');
    await pg.locator('#more-panel > summary').click();
    const rola = await pg.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    assert.ok(rola <= 1, `aba Rádio sem rolagem (sobra ${rola}px)`);
    await pg.screenshot({ path: path.join(out, 'visitas-celular.png') });
    console.log('✓ 2. linha no "Mais da TugLife", número brasileiro, sem rolagem');

    await pg.reload();
    await pg.locator('.visitas-mais:not([hidden])').waitFor({ state: 'attached', timeout: 8000 });
    assert.equal(enviados.length, 2);
    assert.equal(enviados[1].p_aparelho, enviados[0].p_aparelho, 'mesmo aparelho após recarregar');
    console.log('✓ 3. recarregar reenvia o mesmo código');

    resposta = { status: 200, corpo: { visitas: 1, aparelhos: 1, hoje: 1 } };
    await pg.reload();
    await pg.locator('.visitas-mais:not([hidden])').waitFor({ state: 'attached', timeout: 8000 });
    assert.equal((await pg.locator('.visitas-mais [data-visitas-texto]').textContent()).trim(), '1 visita · 1 aparelho · 1 hoje');
    console.log('✓ 4. singular');

    for (const r of [{ status: 500, corpo: { message: 'erro' } }, { status: 0 }]) {
      resposta = r;
      await pg.reload();
      await pg.waitForTimeout(800);
      assert.equal(await pg.locator('[data-visitas]:not([hidden])').count(), 0, 'linhas ocultas com falha');
      assert.ok(await pg.locator('#btn-play').isVisible(), 'app segue de pé');
    }
    console.log('✓ 5. falha da função ou offline: linhas ocultas, app normal');
    await ctx.close();
  }

  // 6. Computador
  {
    resposta = { status: 200, corpo: { visitas: 12345, aparelhos: 1234, hoje: 87 } };
    const { ctx, pg } = await contexto({ width: 1280, height: 900 });
    await pg.goto(URL_APP);
    await pg.locator('.visitas-rodape:not([hidden])').waitFor({ state: 'attached', timeout: 8000 });
    assert.ok(await pg.locator('.visitas-rodape').isVisible(), 'linha no rodapé');
    assert.match(await texto(pg, 'footer'), /👁️ 12\.345 visitas · 1\.234 aparelhos · 87 hoje/);
    assert.equal(await pg.locator('.visitas-mais').isVisible(), false, 'sem repetir no painel');
    await pg.locator('footer').screenshot({ path: path.join(out, 'visitas-computador.png') });
    console.log('✓ 6. computador: rodapé, sem repetição');
    await ctx.close();
  }

  assert.deepEqual(errs, [], 'erros de JavaScript: ' + errs.join(' | '));
  console.log('✓ 7. nenhum erro de JavaScript');
  await b.close();
  servidor.close();
  console.log('\nvisitas-check: todos os cenários passaram');
})().catch((e) => { console.error(e); process.exit(1); });

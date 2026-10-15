/* TugLife FM — teste do card "Programação SAAM · Rio de Janeiro" (saam-rj.js)
   Versão 3.9.0 (SPRINT 27) · 2026-10-15T16:40:00-03:00 · Jossian Brito
   Uso: node saam-rj-check.cjs [pasta-das-capturas]   (sobe o próprio servidor na porta 8798)
   Navegador: Edge por padrão; PW_CHROME=<caminho do Chromium> usa outro.
   A Edge Function saam-rj é simulada (rota interceptada) com horários relativos
   a "agora", então o teste vale em qualquer dia.

   Cenários:
   1. Aba Rádio aberta: nenhuma busca (economia de dados a bordo).
   2. Abrir Manobras: busca, 🟢, manobras em ordem de horário, agrupadas por dia.
   3. Rebocadores com tração (t) e fainas; ⚠️ no escalado em outra manobra; observação CTB.
   4. Filtro por área: conta, filtra, mostra a barra (fechada em vermelho) e fica lembrado.
   5. Falha da função: mantém a lista e avisa em laranja.
   6. 360 px sem rolagem lateral; computador (1280 px) mostra o card na grade.
   7. Nenhum erro de JavaScript. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const RAIZ = __dirname, PORTA = 8798;
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const arq = path.join(RAIZ, p);
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(fs.readFileSync(arq));
});

const H = 3600000;
const iso = (dh) => new Date(Date.now() + dh * H).toISOString();
function resposta() {
  const m = (o) => ({ imo: '9000000', calado: 10.5, loa: 250.4, boca: 40, dwt: 1, gt: 1, de: '', de_bordo: '', canal: '', para: '', para_bordo: '', obs: '', rebocadores: [], empresa: 'SAA', agencia: 'GAC RIO', ...o });
  return {
    ok: true, mensagem: '', fonte: 'https://www.praticagem-rj.com.br/', empresa: 'SAA', lido_em: new Date(Date.now() - 60000).toISOString(),
    total_porto: 40, total: 3,
    areas: [
      { area: 'BAÍA DE GUANABARA', barra: 'BARRA ABERTA DESDE 25/09/2026 13:03', manobras: [
        m({ area: 'BAÍA DE GUANABARA', pob: iso(5), navio: 'SEGUNDO NAVIO', tipo: 'E', tipo_nome: 'Entrada', para: 'TECONT3', para_bordo: 'BE' }),
        m({ area: 'BAÍA DE GUANABARA', pob: iso(1), navio: 'PRIMEIRO NAVIO', tipo: 'S', tipo_nome: 'Saída', de: 'PS-1', obs: 'ATRACA A CONTRA BORDO',
          rebocadores: [
            { nome: 'SAAM HOLANDA', bp: 70.76, propulsao: 'AZ', fainas: ['DES', 'PON'], aviso: '' },
            { nome: 'SAAM PATAXÓ', bp: 52.81, propulsao: 'AZ', fainas: ['DES'], aviso: 'Atenção! Este rebocador também está escalado na(s) manobra(s) do(s) navio(s): OUTRO' }
          ] })
      ] },
      { area: 'BAÍA DE SEPETIBA', barra: 'BARRA FECHADA DESDE 15/10/2026 10:00', manobras: [
        m({ area: 'BAÍA DE SEPETIBA', pob: iso(30), navio: 'TERCEIRO NAVIO', tipo: 'M', tipo_nome: 'Mudança', de: 'TECONT301', de_bordo: 'BB', para: 'TECONT302', para_bordo: 'BE' })
      ] },
      { area: 'PORTO DO FORNO', barra: 'BARRA ABERTA DESDE 13/07/2012 00:00', manobras: [] }
    ]
  };
}

(async () => {
  await new Promise((ok) => servidor.listen(PORTA, '127.0.0.1', ok));
  const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : { channel: 'msedge', headless: true });
  const out = process.argv[2] || '.';
  const errs = [];
  let chamadas = 0, falhar = false;

  async function pagina(ctxOpts, aba) {
    const ctx = await b.newContext(ctxOpts);
    await ctx.addInitScript((aba) => { try { localStorage.setItem('tuglife_tour_visto', '3.2.0'); localStorage.setItem('tuglife_aba', aba); } catch (e) {} }, aba);
    await ctx.route(/functions\/v1\/saam-rj/, (r) => { chamadas++; return falhar ? r.fulfill({ status: 502, contentType: 'application/json', body: '{"ok":false,"mensagem":"x","areas":[]}' }) : r.fulfill({ contentType: 'application/json', body: JSON.stringify(resposta()) }); });
    await ctx.route(/marinetraffic|windy|supabase\.co\/rest|supabase-js|brlogic|cloudfront|tuglifefmcontrol|simcosta|ioc-sealevel|fonts\.g/, (r) => r.abort());
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => errs.push(e.message));
    await pg.goto(`http://127.0.0.1:${PORTA}/`);
    return { ctx, pg };
  }

  // 1. Rádio aberta: sem busca
  const { ctx, pg } = await pagina({ viewport: { width: 390, height: 844 } }, 'radio');
  await pg.waitForTimeout(1500);
  assert.equal(chamadas, 0, 'não busca com o card escondido');

  // 2. Abre Manobras
  await pg.click('#tabbar [data-aba="manobras"]');
  await pg.waitForSelector('#saamrj-list .saam-item');
  assert.equal(chamadas, 1, 'uma busca ao abrir a aba');
  assert.match(await pg.textContent('#saamrj-sync'), /🟢 Praticagem RJ lida há 1 min/);
  const navios = await pg.$$eval('#saamrj-list .saam-navio', (els) => els.map((e) => e.textContent));
  assert.deepEqual(navios, ['PRIMEIRO NAVIO', 'SEGUNDO NAVIO', 'TERCEIRO NAVIO'], 'ordem por horário entre áreas');
  assert.ok((await pg.$$('#saamrj-list .saam-dia')).length >= 2, 'agrupado por dia');

  // 3. Rebocadores, aviso, observação
  const primeiro = (await pg.locator('#saamrj-list .saam-item').first().textContent()).replace(/\s+/g, ' ');
  assert.match(primeiro, /SAAM HOLANDA 70,8 t DES·PON/);
  assert.match(primeiro, /⚠️ SAAM PATAXÓ/);
  assert.match(primeiro, /também está escalado/);
  assert.match(primeiro, /ATRACA A CONTRA BORDO/);
  assert.match(primeiro, /Saída/);
  assert.match(await pg.locator('#saamrj-list .saam-item').nth(1).innerText(), /rebocadores a designar/);
  await pg.screenshot({ path: path.join(out, 'saam-rj-390.png'), fullPage: false });

  // 4. Filtro por área
  const botoes = await pg.$$eval('#saamrj-areas button', (els) => els.map((e) => e.textContent));
  assert.deepEqual(botoes, ['Todas · 3', 'Baía de Guanabara · 2', 'Baía de Sepetiba · 1', 'Porto do Forno · 0']);
  assert.ok(await pg.locator('#saamrj-barra').isVisible(), 'barra fechada aparece mesmo em Todas');
  await pg.click('#saamrj-areas [data-area="BAÍA DE SEPETIBA"]');
  assert.deepEqual(await pg.$$eval('#saamrj-list .saam-navio', (els) => els.map((e) => e.textContent)), ['TERCEIRO NAVIO']);
  assert.equal(await pg.locator('#saamrj-barra .is-fechada').count(), 1);
  assert.match(await pg.locator('#saamrj-list .saam-item').innerText(), /TECONT301\s*\(BB\)\s*→\s*TECONT302\s*\(BE\)/);
  await pg.click('#saamrj-areas [data-area="PORTO DO FORNO"]');
  assert.match(await pg.textContent('#saamrj-list'), /Nenhuma manobra SAAM/);
  await pg.reload();                                  // o initScript volta para a aba Rádio
  await pg.click('#tabbar [data-aba="manobras"]');
  await pg.waitForSelector('#saamrj-areas .is-on');
  assert.equal(await pg.getAttribute('#saamrj-areas .is-on', 'data-area'), 'PORTO DO FORNO', 'área lembrada');
  await pg.click('#saamrj-areas [data-area="TODAS"]');

  // 5. Falha da função mantém a lista
  // adianta o relógio da página 3 min (idade ≥ 2 min) e pede nova busca, que falha
  await pg.waitForSelector('#saamrj-list .saam-item');
  falhar = true;
  await pg.evaluate(() => { const t = Date.now; Date.now = () => t() + 3 * 60000; document.dispatchEvent(new Event('visibilitychange')); });
  await pg.waitForFunction(() => /Sem conexão/.test(document.getElementById('saamrj-sync').textContent));
  assert.equal(await pg.locator('#saamrj-list .saam-item').count(), 3, 'lista mantida na falha');
  falhar = false;
  await ctx.close();

  // 6. 360 px e computador
  const p360 = await pagina({ viewport: { width: 360, height: 740 } }, 'manobras');
  await p360.pg.waitForSelector('#saamrj-list .saam-item');
  const largura = await p360.pg.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(largura <= 360, `sem rolagem lateral em 360 px (${largura})`);
  await p360.ctx.close();
  const pc = await pagina({ viewport: { width: 1280, height: 900 } }, 'radio');
  await pc.pg.waitForSelector('#saamrj-list .saam-item');
  assert.ok(await pc.pg.locator('#card-saam-rj').isVisible(), 'card na grade do computador');
  await pc.pg.locator('#card-saam-rj').screenshot({ path: path.join(out, 'saam-rj-1280.png') });
  await pc.ctx.close();

  // 7. Sem erros
  assert.deepEqual(errs, [], 'sem erros de JavaScript');
  await b.close(); servidor.close();
  console.log('saam-rj-check: todos os cenários passaram');
})().catch((e) => { console.error(e); process.exit(1); });

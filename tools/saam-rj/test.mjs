/* TugLife FM — testes do leitor da Praticagem RJ (tools/saam-rj/parser.js)
   Versão 1.0.0 (SPRINT 27 · app v3.9.0) · 2026-10-15T16:40:00-03:00 · Jossian Brito
   Uso: node tools/saam-rj/test.mjs            (página sintética, sem internet)
        node tools/saam-rj/test.mjs pagina.html (confere também uma página real salva)

   A página sintética copia a estrutura da real: título da área, faixa da
   barra, cabeçalho com "BD" repetido, fichas (tooltips) com <div>, <table>
   e <tr> por dentro, linha repetida, ficha de rebocadores com linha
   vermelha e ficha CTB com observação. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePagina, daEmpresa, dataPob, num, extrairDicas } from './parser.js';

const CAB = ['POB', 'Navio', 'Cal', 'LOA', 'Boca', 'DWT', 'GT', 'M', 'De', 'BD', 'Canal', 'Para', 'BD', 'CTB', 'RB', 'EMP.RB', 'Agência'];
const cab = CAB.map((c) => `<td class="tdCabecalho"><span class="spanCabecalho">${c}</span></td>`).join('');
const fichaNavio = (nome, imo) => `<div class='tooltipDiv' onmouseenter='showTooltipSincrono(this, "Navio | 1 | 0")'>${nome}<div class='tooltipDivEscondida'><span class='tooltipText'>
  <div class="divPPNavio"><div style="x"><span id="NM_NAVIO">${nome}</span></div>
  <table class="tbPPNavio"><div id="pnlST_NR_IMO"><tr><td>IMO</td><td><b><span id="ST_NR_IMO">${imo}</span></b></td></tr></div></table>
  </div></span></div></div>`;
const linhaRb = (nome, verdes, aviso = '') => `<tr title='${aviso}' class='${aviso ? 'linhaVermelha' : 'linhaNormal'}'><td style="text-align: left;"> ${nome} </td>`
  + [0, 1, 2, 3].map((k) => `<td><span class='dxgv SimboloFainaVer${verdes.includes(k) ? 'de' : 'melho'}'>&#9898;</span></td>`).join('') + '</tr>';
const fichaRb = (linhas) => `<div class='tooltipDiv' onmouseenter='showTooltipSincrono(this, "RB | 9 | 0")'><div class='bgRebocador'></div><div class='tooltipDivEscondida'><span class='tooltipText'><style>.x{}</style>
  <table class="tbFR"><tr><th rowspan="2">REBOCADOR</th><th colspan="4">FAINAS</th></tr><tr><th>1 ATR</th><th>2 DES</th><th>3 PON</th><th>4 NAV</th></tr>
  ${linhas.join('')}</table></span></div></div>`;
const fichaCtb = (t) => `<div class='tooltipDiv' onmouseenter='showTooltipSincrono(this, "CTB | 0 | 7")'><div class=bgEventoOperacionalOn></div><div class='tooltipDivEscondida'><span class='tooltipText'>${t}</span></div></div>`;
let n = 0;
const linha = (c) => `<tr id="rptAreas_ctl00_rptManobrasArea_ctl0${n++}_trManobraArea" style="background-color: white">`
  + c.map((v) => `<td class="tdManobraArea">${String(v).startsWith('<div') ? v : `<span>${v}</span>`}</td>`).join('') + '</tr>';
const area = (i, nome, barra, linhas) => `<span id="rptAreas_ctl0${i}_lblArea1">${nome}</span>
  <div id="rptAreas_ctl0${i}_pnlBarra1"><span>${barra}</span><br><span></span></div>
  <table class="tbManobrasArea"><tr>${cab}</tr>${linhas.join('')}</table>`;

const rbs = fichaRb([
  linhaRb('SAAM HOLANDA [70,76] (AZ)', [1, 2]),
  linhaRb('SAAM PATAXÓ [52,81] (AZ)', [1], 'Atenção! Este rebocador também está escalado na(s) manobra(s) do(s) navio(s): OUTRO')
]);
const L1 = ['15/10 16:00', fichaNavio('PACIFIC JASPER', '9788552'), '9,40', '324,86', '32,23', '49998', '29513', 'S', 'PS-1', 'BE', '', '', '', '<div class=bgEventoOperacionalOff></div>', rbs, 'SAA', 'GAC RIO'];
const L2 = ['15/10 17:00', fichaNavio('SFL BONAIRE', '9000001'), '7,40', '179,99', '28,00', '33338', '22467', 'E', '', '', '', 'COSAN', 'BB', fichaCtb('ATRACA A CONTRA BORDO'), '', 'WIL', 'TRANSATLANTICA'];
const L3 = ['02/01 08:00', fichaNavio('ANO NOVO', '9000002'), '10,00', '200,00', '30,00', '50000', '30000', 'M', 'TECONT1', 'BB', '', 'TECONT4', 'BE', fichaCtb('ATRACA A CONTRA BORDO'), '', 'SAA/WIL', 'AG'];
const L4 = ['16/10 09:00', fichaNavio('SAABRINA', '9000003'), '8,00', '150,00', '25,00', '1', '1', 'E', '', '', '', 'PIER', '', '', '', 'SAAB', 'AG'];
const html = '<html><body>'
  + area(0, 'BAÍA DE GUANABARA', 'BARRA ABERTA DESDE 25/09/2026 13:03', [linha(L1), linha(L1), linha(L2), linha(L3), linha(L4)])
  + area(1, 'PORTO DO FORNO', 'BARRA FECHADA', ['<tr><td>Nenhuma manobra no momento!</td></tr>'])
  + '</body></html>';

// 1) números e datas
assert.equal(num('12,10'), 12.1);
assert.equal(num('125943'), 125943);
assert.equal(num(''), null);
const agora = new Date('2026-10-15T19:35:00Z');
assert.equal(dataPob('15/10 16:00', agora), '2026-10-15T19:00:00.000Z', 'Brasília +3 h = UTC');
assert.equal(dataPob('02/01 08:00', new Date('2026-12-30T12:00:00Z')), '2027-01-02T11:00:00.000Z', 'virada de ano para a frente');
assert.equal(dataPob('30/12 23:00', new Date('2027-01-01T12:00:00Z')), '2026-12-31T02:00:00.000Z', 'virada de ano para trás');
assert.equal(dataPob('lixo', agora), null);

// 2) fichas aninhadas são retiradas inteiras
const { limpa, dicas } = extrairDicas(fichaNavio('X', '1') + '<td>depois</td>');
assert.equal(dicas.length, 1); assert.equal(dicas[0].tipo, 'Navio');
assert.ok(limpa.endsWith('<td>depois</td>') && !limpa.includes('tbPPNavio'));

// 3) página inteira
const p = parsePagina(html, { agora });
assert.equal(p.areas.length, 2);
assert.equal(p.areas[0].area, 'BAÍA DE GUANABARA');
assert.equal(p.areas[0].barra, 'BARRA ABERTA DESDE 25/09/2026 13:03');
assert.equal(p.areas[1].manobras.length, 0, 'área sem manobras');
assert.equal(p.areas[0].manobras.length, 4, 'linha repetida fundida');
const [m1, m2, m3] = p.areas[0].manobras;
assert.equal(m1.navio, 'PACIFIC JASPER'); assert.equal(m1.imo, '9788552');
assert.equal(m1.calado, 9.4); assert.equal(m1.loa, 324.86);
assert.equal(m1.tipo_nome, 'Saída'); assert.equal(m1.de, 'PS-1'); assert.equal(m1.de_bordo, 'BE');
assert.equal(m1.empresa, 'SAA'); assert.equal(m1.agencia, 'GAC RIO');
assert.deepEqual(m1.rebocadores.map((r) => [r.nome, r.bp, r.propulsao, r.fainas.join()]),
  [['SAAM HOLANDA', 70.76, 'AZ', 'DES,PON'], ['SAAM PATAXÓ', 52.81, 'AZ', 'DES']]);
assert.match(m1.rebocadores[1].aviso, /também está escalado/);
assert.equal(m1.rebocadores[0].aviso, '');
assert.equal(m2.para, 'COSAN'); assert.equal(m2.para_bordo, 'BB'); assert.equal(m2.obs, 'ATRACA A CONTRA BORDO');
assert.equal(m3.tipo_nome, 'Mudança'); assert.equal(m3.pob, '2027-01-02T11:00:00.000Z', 'janeiro visto de outubro = ano seguinte');

// 4) filtro SAAM: SAA e SAA/WIL entram; WIL e SAAB não
const s = daEmpresa(p, 'SAA');
assert.deepEqual(s.areas[0].manobras.map((m) => m.navio), ['PACIFIC JASPER', 'ANO NOVO']);
assert.equal(s.total, 2);

// 5) opcional: página real salva
if (process.argv[2]) {
  const real = parsePagina(readFileSync(process.argv[2], 'utf8'));
  assert.ok(real.areas.length >= 1, 'página real com áreas');
  assert.ok(real.areas.every((a) => a.manobras.every((m) => m.pob && m.navio && m.tipo)), 'toda manobra com POB, navio e tipo');
  const sa = daEmpresa(real);
  console.log(`página real: ${real.total} manobras, ${sa.total} SAAM em ${real.areas.map((a) => a.area).join(', ')}`);
}
console.log('saam-rj: todos os testes passaram');

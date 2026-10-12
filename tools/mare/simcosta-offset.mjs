/* ============================================================
   TugLife FM — Calibração do zero do marégrafo SiMCosta → NR (DHN)
   ------------------------------------------------------------
   Arquivo   : tools/mare/simcosta-offset.mjs
   Versão    : 1.0.0 (SPRINT 22 · app v3.4.0)
   Data/Hora : 2026-10-12T18:30:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   HISTÓRICO DE MODIFICAÇÕES
   v1.0.0  [NOVO] Baixa N dias da API SiMCosta (blocos de 6 dias),
           faz médias horárias e compara com a previsão calibrada
           do app (tide-data.js) para obter o OFFSET de tide-live.js.
   ------------------------------------------------------------
   FÓRMULA
       OFFSET = média_horas( leitura_radar − previsão_NR )
   A média de muitos dias cancela a maré meteorológica (que oscila
   para cima e para baixo), sobrando só a diferença de referência
   entre o zero do radar e o Nível de Redução — como zerar uma
   balança tirando a média de várias pesagens do mesmo peso.
   Também imprime o offset por semana: se as semanas divergirem
   muito (> 10 cm), houve evento meteorológico longo ou o sensor
   foi mexido — aumente a janela ou investigue.
   ------------------------------------------------------------
   Uso (precisa de internet; Node 18+):
     node tools/mare/simcosta-offset.mjs [porto=rio-grande] [dias=30]
   Depois copie o OFFSET para ESTACOES[porto].offset em tide-live.js
   e atualize "calibracao" com o período.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
globalThis.window = globalThis;
vm.runInThisContext(readFileSync(join(raiz, 'vendor/tide-engine.js'), 'utf8'));
createRequire(import.meta.url)(join(raiz, 'tide-data.js'));
vm.runInThisContext(readFileSync(join(raiz, 'tide-live.js'), 'utf8'));

const portoId = process.argv[2] || 'rio-grande';
const dias = Number(process.argv[3] || 30);
const est = window.TugTideLive._estacoes[portoId];
const porto = window.TUGLIFE_TIDES.find((p) => p.id === portoId);
if (!est || !porto) { console.error('Porto sem estação SiMCosta em tide-live.js:', portoId); process.exit(2); }
const pred = NeapsTide.createTidePredictor(porto.hc.map(([name, amplitude, phase]) => ({ name, amplitude, phase })), { offset: porto.z0 });
const param = est.param.replace(/^avg_/, '');   // leitura instantânea; a média horária já suaviza

const agora = Math.floor(Date.now() / 1000), horas = new Map();
for (let fim = agora; fim > agora - dias * 86400; fim -= 6 * 86400) {
  const ini = Math.max(fim - 6 * 86400, agora - dias * 86400);
  const url = `https://simcosta.furg.br/api/intrans_data?boiaID=${est.id}&type=json&time1=${ini}&time2=${fim}&params=${param}`;
  const r = await fetch(url); const txt = await r.text();
  for (const d of (txt ? JSON.parse(txt) : [])) {
    const t = Date.parse(d.timestamp), v = Number(d[param]);
    if (!Number.isFinite(t) || !(v > 5 && v < 20)) continue;
    const h = Math.floor(t / 3600000), a = horas.get(h) || [0, 0];
    a[0] += v; a[1] += 1; horas.set(h, a);
  }
  process.stdout.write('.');
}
const linhas = [...horas].filter(([, a]) => a[1] >= 45).sort((x, y) => x[0] - y[0])
  .map(([h, a]) => { const t = new Date(h * 3600000 + 1800000); return { t, o: a[0] / a[1], p: pred.getWaterLevelAtTime({ time: t }).level }; });
if (!linhas.length) { console.error('\nSem dados.'); process.exit(1); }
const media = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const offset = media(linhas.map((l) => l.o - l.p));
const res = linhas.map((l) => l.o - offset - l.p).sort((a, b) => a - b);
console.log(`\n${est.nome} (id ${est.id}) · ${linhas.length} h válidas · ${linhas[0].t.toISOString().slice(0, 10)} a ${linhas.at(-1).t.toISOString().slice(0, 10)}`);
console.log(`OFFSET = ${offset.toFixed(3)} m   (atual em tide-live.js: ${est.offset})`);
console.log(`Maré meteorológica: RMS ${(Math.sqrt(media(res.map((x) => x * x))) * 100).toFixed(1)} cm · mín ${(res[0] * 100).toFixed(0)} · máx ${(res.at(-1) * 100).toFixed(0)} cm`);
for (let w = 0; ; w++) {
  const a = linhas[0].t.getTime() + w * 7 * 864e5; if (a > linhas.at(-1).t.getTime()) break;
  const s = linhas.filter((l) => l.t.getTime() >= a && l.t.getTime() < a + 7 * 864e5);
  if (s.length) console.log(`  semana ${w + 1}: ${media(s.map((l) => l.o - l.p)).toFixed(3)} m (${s.length} h)`);
}

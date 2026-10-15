/* ============================================================
   TugLife FM — Calibração do zero do marégrafo SiMCosta → NR (DHN)
   ------------------------------------------------------------
   Arquivo   : tools/mare/simcosta-offset.mjs
   Versão    : 1.2.0 (SPRINT 24 · app v3.6.0)
   Data/Hora : 2026-10-15T00:30:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   HISTÓRICO DE MODIFICAÇÕES
   v1.0.0  [NOVO] Baixa N dias da API SiMCosta (blocos de 6 dias),
           faz médias horárias e compara com a previsão calibrada
           do app (tide-data.js) para obter o OFFSET de tide-live.js.
   v1.1.0  [MOD] Porto com várias fontes (Suape = Recife + Tamandaré):
           calcula o OFFSET de cada marégrafo e a diferença entre eles.
           [NOVO] Usa adiantamentoMin do porto (previsão em t + atraso)
           e procura a melhor defasagem de −30 a +30 min (passo 1 min)
           para conferir se o valor em tide-live.js continua bom.
   v1.2.0  [MOD] Busca pelos mesmos adaptadores de tide-live.js
           (SiMCosta e IOC/UNESCO) e respeita fonte.faixa.
           [NOVO] Imprime a oscilação semanal e a incerteza sugerida
           (metade dela, no mínimo 3 cm).
   ------------------------------------------------------------
   FÓRMULA
       OFFSET = média_horas( leitura_radar(t) − previsão_NR(t + adiantamento) )
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
     node tools/mare/simcosta-offset.mjs suape 30
   Depois copie cada OFFSET para ESTACOES[porto].fontes[i].offset em
   tide-live.js e atualize "calibracao" com o período.
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
const ADAPT = window.TugTideLive._adaptadores;
const media = (a) => a.reduce((s, x) => s + x, 0) / a.length;
// previsão no meio da hora h, adiantada de "min" minutos (porto secundário)
const prev = (h, min) => pred.getWaterLevelAtTime({ time: new Date(h * 3600000 + 1800000 + min * 60000) }).level;

// médias horárias de uma fonte, em blocos de 6 dias (a IOC limita o tamanho da resposta)
async function horarias(f) {
  const ad = ADAPT[f.api || 'simcosta'], [lo, hi] = f.faixa || [5, 20];
  const agora = Date.now(), horas = new Map();
  for (let fim = agora; fim > agora - dias * 864e5; fim -= 6 * 864e5) {
    const ini = Math.max(fim - 6 * 864e5, agora - dias * 864e5);
    const r = await fetch(ad.url(f, ini, fim)); const txt = await r.text();
    for (const { t, v } of ad.ler(f, txt ? JSON.parse(txt) : [])) {
      if (!Number.isFinite(t) || !(v > lo && v < hi)) continue;
      const h = Math.floor(t / 3600000), a = horas.get(h) || [0, 0];
      a[0] += v; a[1] += 1; horas.set(h, a);
    }
    process.stdout.write('.');
  }
  // só horas com ≥ 45 leituras (de 60)
  return new Map([...horas].filter(([, a]) => a[1] >= 45).sort((x, y) => x[0] - y[0]).map(([h, a]) => [h, a[0] / a[1]]));
}

const adiant = est.adiantamentoMin || 0, series = {};
for (const f of est.fontes) {
  const s = await horarias(f), hs = [...s.keys()];
  if (!hs.length) { console.log(`\n${f.nome} (id ${f.id}): sem dados.`); continue; }
  series[f.id] = s;
  const resumo = (min) => {
    const off = media(hs.map((h) => s.get(h) - prev(h, min)));
    const res = hs.map((h) => s.get(h) - off - prev(h, min)).sort((a, b) => a - b);
    return { off, res, rms: Math.sqrt(media(res.map((x) => x * x))) };
  };
  const r = resumo(adiant);
  let melhor = { min: adiant, rms: r.rms };
  for (let m = -30; m <= 30; m++) { const x = resumo(m); if (x.rms < melhor.rms) melhor = { min: m, rms: x.rms }; }
  const ini = new Date(hs[0] * 3600000), fim = new Date(hs.at(-1) * 3600000);
  console.log(`\n${f.nome} (id ${f.id}) · ${hs.length} h válidas · ${ini.toISOString().slice(0, 10)} a ${fim.toISOString().slice(0, 10)}`);
  console.log(`OFFSET = ${r.off.toFixed(3)} m   (atual em tide-live.js: ${f.offset}) · adiantamento ${adiant} min`);
  console.log(`Maré meteorológica: RMS ${(r.rms * 100).toFixed(1)} cm · mín ${(r.res[0] * 100).toFixed(0)} · máx ${(r.res.at(-1) * 100).toFixed(0)} cm`);
  console.log(`Melhor adiantamento: ${melhor.min} min (RMS ${(melhor.rms * 100).toFixed(1)} cm)`);
  const semanas = [];
  for (let w = 0; ; w++) {
    const a = hs[0] + w * 168; if (a > hs.at(-1)) break;
    const sem = hs.filter((h) => h >= a && h < a + 168);
    if (!sem.length) continue;
    const m = media(sem.map((h) => s.get(h) - prev(h, adiant)));
    if (sem.length >= 24) semanas.push(m);
    console.log(`  semana ${w + 1}: ${m.toFixed(3)} m (${sem.length} h)`);
  }
  // incerteza exibida no app = metade da oscilação semanal, no mínimo 3 cm
  const osc = (Math.max(...semanas) - Math.min(...semanas)) * 100;
  console.log(`Oscilação semanal ${osc.toFixed(1)} cm → incerteza sugerida ±${Math.max(3, Math.round(osc / 2))} cm (atual ±${est.incerteza})`);
  f.novo = r.off;
}
// v1.1.0: com 2+ fontes, quanto elas discordam depois de irem ao NR
const ids = Object.keys(series).map(Number);
if (ids.length > 1) {
  const [a, b] = ids, fa = est.fontes.find((f) => f.id === a), fb = est.fontes.find((f) => f.id === b);
  const comuns = [...series[a].keys()].filter((h) => series[b].has(h));
  const d = comuns.map((h) => (series[a].get(h) - fa.novo) - (series[b].get(h) - fb.novo));
  console.log(`\n${fa.nome} − ${fb.nome} no NR: RMS ${(Math.sqrt(media(d.map((x) => x * x))) * 100).toFixed(1)} cm em ${comuns.length} h comuns`);
}

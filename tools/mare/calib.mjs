// Calibração de constantes harmônicas contra a Tábua DHN 2026
// Autor: Jossian Brito · 2026-10-08 · SPRINT 16
// Uso: node calib.mjs <arquivo_dhn.txt> <ticon_station_id> <fitMonth> <valMonth>
import fs from 'node:fs';
import { createTidePredictor, constituents as LIB } from '@neaps/tide-predictor';
import { stationsById } from '@neaps/tide-database';

const [,, file, stationId, fitMonth = '10', valMonth = '11'] = process.argv;
const TZ = -3 * 60;  // DHN: Fuso UTC -03.0
const YEAR = 2026;

/* ---------- 1. Parse do texto embaralhado ---------- */
const raw = fs.readFileSync(file, 'utf8');
const nivel = Number(raw.match(/NIVEL\s+(-?\d+\.\d+)/)[1]);
const months = {};
for (const block of raw.split(/^MES\s+/m).slice(1)) {
  const m = block.match(/^(\d+)/)[1].padStart(2, '0');
  const body = block.slice(block.indexOf('\n'));
  // Tokens em ordem: T = hora (4–6 dígitos; 6 = dia grudado), H = altura.
  // Dias com 5–6 extremos vêm como "T T T T H H H H": pareia cada sequência
  // de horas com a sequência de alturas seguinte.
  const ev = [];
  const toks = [...body.matchAll(/-?\d+\.\d\d|\d{4,6}/g)].map(t => t[0]);
  let i = 0;
  while (i < toks.length) {
    const T = []; while (i < toks.length && !toks[i].includes('.')) T.push(toks[i++]);
    const H = []; while (i < toks.length && toks[i].includes('.')) H.push(toks[i++]);
    const n = Math.min(T.length, H.length);
    for (let k = 0; k < n; k++) {
      const hhmm = T[T.length - n + k].slice(-4);
      const min = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(2));
      ev.push({ min, h: Number(H[k]), high: Number(H[k]) > nivel });
    }
  }
  months[m] = ev;
}

/* ---------- 2. Modelo ---------- */
const st = stationsById.get(stationId);
const base = st.harmonic_constituents.filter(c => LIB[c.name]).map(c => ({ name: c.name, amplitude: c.amplitude, phase: c.phase }));
const species = (n) => LIB[n].coefficients[0];

function modelExtremes(hc, z0, month) {
  const start = new Date(Date.UTC(YEAR, Number(month) - 1, 1) - TZ * 60000 - 86400000);
  const end = new Date(Date.UTC(YEAR, Number(month), 1) - TZ * 60000 + 86400000);
  return createTidePredictor(hc, { offset: z0 }).getExtremesPrediction({ start, end })
    .map(e => ({ t: new Date(e.time).getTime(), h: e.level, high: e.high }));
}

/* ---------- 3. Associação evento DHN ↔ dia ----------
   Para cada evento (hora do dia, altura) procura o extremo do modelo
   de mesmo tipo cuja hora (com deslocamento "shift") seja a mais
   próxima. Custo = |Δt| min + 0,5·|Δh| cm. Um extremo do modelo só
   pode receber um evento (guloso pelo menor custo). */
function match(events, mx, shift, tol) {
  const cand = [];
  events.forEach((e, i) => {
    mx.forEach((m, j) => {
      if (m.high !== e.high) return;
      const local = new Date(m.t + (TZ + shift) * 60000);
      const mmin = local.getUTCHours() * 60 + local.getUTCMinutes();
      let dt = e.min - mmin;
      if (dt > 720) dt -= 1440; if (dt < -720) dt += 1440;
      if (Math.abs(dt) > tol) return;
      cand.push({ i, j, cost: Math.abs(dt) + 50 * Math.abs(e.h - m.h), t: m.t + (shift + dt) * 60000 });
    });
  });
  cand.sort((a, b) => a.cost - b.cost);
  const ui = new Set(), uj = new Set(), out = [];
  for (const c of cand) {
    if (ui.has(c.i) || uj.has(c.j)) continue;
    ui.add(c.i); uj.add(c.j);
    out.push({ t: c.t, h: events[c.i].h, high: events[c.i].high });
  }
  return out;
}

/* ---------- 4. Mínimos quadrados por espécie (admitância) ----------
   h(t) = Z0 + L(t) + Σ_s [α_s·C_s(t) + β_s·S_s(t)]
   C_s: soma das componentes da espécie s; S_s: mesma soma defasada 90°.
   Equações: h(tᵢ) = Hᵢ  e  h'(tᵢ) = 0  (extremo = derivada nula). */
function solve(A, b) {
  const n = A[0].length, M = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  A.forEach((row, k) => { for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) M[i][j] += row[i] * row[j]; M[i][n] += row[i] * b[k]; } });
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    [M[i], M[p]] = [M[p], M[i]];
    for (let r = 0; r < n; r++) if (r !== i) { const f = M[r][i] / M[i][i]; for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c]; }
  }
  return M.map((r, i) => r[n] / M[i][i]);
}

function fit(hc, pts) {
  // Só espécies com energia real: D1, D2, D4. As demais (longo período,
  // D3, D5, D6, D8) ficam fixas — ajustá-las com 1 mês causa sobreajuste.
  const FIT = [1, 2, 4];
  const groups = FIT.filter(s => hc.some(c => species(c.name) === s));
  const lp = hc.filter(c => !FIT.includes(species(c.name)));
  const P = (list) => list.length ? createTidePredictor(list, { offset: 0 }) : null;
  const lvl = (p, t) => p ? p.getWaterLevelAtTime({ time: new Date(t) }).level : 0;
  const d = (p, t) => (lvl(p, t + 60000) - lvl(p, t - 60000)) / (2 / 60);
  const preds = groups.map(s => {
    const g = hc.filter(c => species(c.name) === s);
    return [P(g), P(g.map(c => ({ ...c, phase: c.phase - 90 })))];
  });
  const pL = P(lp);
  const A = [], b = [], WH = 1 / 0.03, WD = 1 / 0.02;
  for (const p of pts) {
    A.push([1, ...preds.flatMap(([c, s]) => [lvl(c, p.t), lvl(s, p.t)])].map(v => v * WH));
    b.push((p.h - lvl(pL, p.t)) * WH);
    A.push([0, ...preds.flatMap(([c, s]) => [d(c, p.t), d(s, p.t)])].map(v => v * WD));
    b.push(-d(pL, p.t) * WD);
  }
  const x = solve(A, b);
  const corr = {};
  groups.forEach((s, k) => {
    const a = x[1 + 2 * k], be = x[2 + 2 * k];
    corr[s] = { r: Math.hypot(a, be), phi: Math.atan2(be, a) * 180 / Math.PI };
  });
  const out = hc.map(c => {
    const s = species(c.name); if (!corr[s]) return c;
    return { ...c, amplitude: c.amplitude * corr[s].r, phase: ((c.phase - corr[s].phi) % 360 + 360) % 360 };
  });
  return { hc: out, z0: x[0], corr };
}

/* ---------- 5. Estatística de validação ---------- */
function stats(hc, z0, month) {
  const ev = months[month];
  const m = match(ev, modelExtremes(hc, z0, month), 0, 75);
  const mx = modelExtremes(hc, z0, month);
  // erro: para cada evento associado, extremo do modelo mais próximo
  const dts = [], dhs = [];
  for (const p of m) {
    const best = mx.filter(x => x.high === p.high).reduce((a, x) => Math.abs(x.t - p.t) < Math.abs(a.t - p.t) ? x : a);
    dts.push((best.t - p.t) / 60000); dhs.push(best.h - p.h);
  }
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const rms = a => Math.sqrt(mean(a.map(v => v * v)));
  // Extremos do modelo no mês sem correspondente DHN (±45 min) = espúrios
  const y = Number(month), t0 = Date.UTC(YEAR, y - 1, 1) - TZ * 60000, t1 = Date.UTC(YEAR, y, 1) - TZ * 60000;
  const inMonth = mx.filter(x => x.t >= t0 && x.t < t1);
  const spurious = inMonth.filter(x => !m.some(p => p.high === x.high && Math.abs(p.t - x.t) < 45 * 60000)).length;
  return { n: ev.length, matched: m.length, spurious, model: inMonth.length, dtMean: mean(dts), dtRms: rms(dts), dtMax: Math.max(...dts.map(Math.abs)), dhMean: mean(dhs), dhRms: rms(dhs), dhMax: Math.max(...dhs.map(Math.abs)) };
}

/* ---------- 5b. Porto secundário: Δt + razão de amplitude ----------
   Método das tábuas para portos secundários:
     Δt  = média(t_modelo − t_DHN)   → todas as fases: g' = g − ω·Δt
     a,b = regressão H_DHN = a·(h_modelo − z0) + b
           a escala as amplitudes; b vira o novo nível médio Z0.     */
function secondary(hc, z0, pts) {
  const mx = modelExtremes(hc, z0, fitMonth);
  const pairs = pts.map(p => {
    const m = mx.filter(x => x.high === p.high).reduce((a, x) => Math.abs(x.t - p.t) < Math.abs(a.t - p.t) ? x : a);
    return { dt: (m.t - p.t) / 3600000, hm: m.h - z0, H: p.h };
  });
  const dt = pairs.reduce((s, p) => s + p.dt, 0) / pairs.length;
  const n = pairs.length, sx = pairs.reduce((s, p) => s + p.hm, 0), sy = pairs.reduce((s, p) => s + p.H, 0);
  const sxx = pairs.reduce((s, p) => s + p.hm * p.hm, 0), sxy = pairs.reduce((s, p) => s + p.hm * p.H, 0);
  const a = (n * sxy - sx * sy) / (n * sxx - sx * sx), b = (sy - a * sx) / n;
  const out = hc.map(c => ({ ...c, amplitude: c.amplitude * a, phase: ((c.phase - LIB[c.name].speed * dt) % 360 + 360) % 360 }));
  return { hc: out, z0: b, dtMin: dt * 60, a };
}

/* ---------- 5c. Análise harmônica do próprio porto ----------
   Amplitude e fase livres para cada componente da lista FREE.
   Inferência (1 mês não separa): K2 = 0,27·S2 e P1 = 0,33·K1 (mesma fase).
   Longo período (Sa, Ssa, Mm, Mf) fica da estação de referência.     */
const FREE = ['M2', 'S2', 'N2', 'K1', 'O1', 'Q1', 'M4', 'MS4', 'MN4', 'M6', '2MS6', 'MK3', 'M3', 'MU2', 'L2'];
const INFER = { S2: [['K2', 0.27]], K1: [['P1', 0.33]] };
function harmonic(refHc, pts) {
  const fixed = refHc.filter(c => species(c.name) === 0);
  const P = (list) => createTidePredictor(list, { offset: 0 });
  const lvl = (p, t) => p.getWaterLevelAtTime({ time: new Date(t) }).level;
  const d = (p, t) => (lvl(p, t + 60000) - lvl(p, t - 60000)) / (2 / 60);
  const cols = FREE.map(n => {
    const mk = ph => P([{ name: n, amplitude: 1, phase: ph }, ...(INFER[n] || []).map(([m, r]) => ({ name: m, amplitude: r, phase: ph }))]);
    return [mk(0), mk(90)];
  });
  const pF = fixed.length ? P(fixed) : null;
  const A = [], b = [], WH = 1 / 0.03, WD = 1 / 0.02;
  for (const p of pts) {
    A.push([1, ...cols.flatMap(([c, s]) => [lvl(c, p.t), lvl(s, p.t)])].map(v => v * WH));
    b.push((p.h - (pF ? lvl(pF, p.t) : 0)) * WH);
    A.push([0, ...cols.flatMap(([c, s]) => [d(c, p.t), d(s, p.t)])].map(v => v * WD));
    b.push(-(pF ? d(pF, p.t) : 0) * WD);
  }
  // Pontos de forma: entre extremos consecutivos de tipos opostos, a maré
  // segue aproximadamente h = H1 + (H2−H1)·(1−cos(πτ))/2. Três pontos por
  // intervalo (τ = ¼, ½, ¾) com peso menor impedem ondulações espúrias.
  const sorted = [...pts].sort((x, y) => x.t - y.t);
  for (let k = 0; k + 1 < sorted.length; k++) {
    const a = sorted[k], c = sorted[k + 1], dtH = (c.t - a.t) / 3600000;
    if (a.high === c.high || dtH < 1.5 || dtH > 9) continue;
    for (const tau of [0.25, 0.5, 0.75]) {
      const t = a.t + tau * (c.t - a.t), hh = a.h + (c.h - a.h) * (1 - Math.cos(Math.PI * tau)) / 2;
      A.push([1, ...cols.flatMap(([cc, ss]) => [lvl(cc, t), lvl(ss, t)])].map(v => v * WH / 3));
      b.push((hh - (pF ? lvl(pF, t) : 0)) * WH / 3);
    }
  }
  // pequena regularização (ridge) evita amplitudes absurdas em componentes fracas
  const n = A[0].length;
  for (let k = 1; k < n; k++) { const row = new Array(n).fill(0); row[k] = 0.5; A.push(row); b.push(0); }
  const x = solve(A, b);
  const out = [...fixed];
  FREE.forEach((nm, k) => {
    // α·cos(θ) + β·cos(θ−90°) = A·cos(θ − g)  →  A = √(α²+β²), g = atan2(β, α)
    const a = x[1 + 2 * k], be = x[2 + 2 * k];
    const amp = Math.hypot(a, be), g = ((Math.atan2(be, a) * 180 / Math.PI) + 360) % 360;
    out.push({ name: nm, amplitude: amp, phase: g });
    (INFER[nm] || []).forEach(([m, r]) => out.push({ name: m, amplitude: amp * r, phase: g }));
  });
  return { hc: out, z0: x[0] };
}

/* ---------- 6. Execução ---------- */
let hc = base, z0 = nivel;
const fmt = s => `n=${s.matched}/${s.n} esp=${s.spurious}  Δt médio ${s.dtMean.toFixed(0)} min, RMS ${s.dtRms.toFixed(0)}, máx ${s.dtMax.toFixed(0)} | Δh médio ${(s.dhMean * 100).toFixed(0)} cm, RMS ${(s.dhRms * 100).toFixed(0)}, máx ${(s.dhMax * 100).toFixed(0)}`;
console.log(`${file.split('/').pop()} ← ${st.name} | nível médio DHN ${nivel} m`);
console.log('ANTES (validação ' + valMonth + '):', fmt(stats(hc, z0, valMonth)));

// deslocamento global inicial
const ev = months[fitMonth];
let best = { shift: 0, n: -1 };
const mx0 = modelExtremes(hc, z0, fitMonth);
// Sem varredura de deslocamento: ±50 min coincide com o dia vizinho
// (aliasing). A associação direta com tolerância ampla + altura é segura.
best = { shift: 0, n: 0 };
let pts = match(ev, mx0, 0, 75);
// Porto secundário (iterado 3x para refinar a associação)
let sec = secondary(hc, z0, pts);
for (let k = 0; k < 3; k++) { pts = match(ev, modelExtremes(sec.hc, sec.z0, fitMonth), 0, 20); sec = secondary(sec.hc, sec.z0, pts); }
// acumula: secondary() parte do modelo já corrigido, então Δt/a reportados são o último passo;
// o resultado final está em sec.hc / sec.z0
const sB = stats(sec.hc, sec.z0, valMonth);
// Admitância por espécie
pts = match(ev, mx0, 0, 75);
let res = fit(hc, pts);
for (const tol of [20, 15, 12]) { pts = match(ev, modelExtremes(res.hc, res.z0, fitMonth), 0, tol); res = fit(hc, pts); }
const sA = stats(res.hc, res.z0, valMonth);
// Harmônica do porto, iterada a partir da melhor associação disponível
pts = match(ev, modelExtremes(sec.hc, sec.z0, fitMonth), 0, 30);
let har = harmonic(hc, pts);
for (const tol of [25, 20]) { pts = match(ev, modelExtremes(har.hc, har.z0, fitMonth), 0, tol); har = harmonic(hc, pts); }
const sH = stats(har.hc, har.z0, valMonth);
console.log('HARMÔNICA  (val ' + valMonth + '):', fmt(sH), ` Z0 ${har.z0.toFixed(3)} M2 ${har.hc.find(c=>c.name==='M2').amplitude.toFixed(3)} M4 ${har.hc.find(c=>c.name==='M4').amplitude.toFixed(3)}`);
const s0 = stats(hc, nivel, valMonth);
// 10 min ≈ 5 cm ≈ 10 extremos espúrios/faltantes no mês
const score = s => s.dtRms / 10 + s.dhRms * 100 / 5 + (s.spurious + (s.n - s.matched)) / 10;
console.log(`deslocamento inicial ${best.shift} min`);
console.log('SECUNDÁRIO (val ' + valMonth + '):', fmt(sB), ` Z0 ${sec.z0.toFixed(3)}`);
console.log('ADMITÂNCIA (val ' + valMonth + '):', fmt(sA), ' ', Object.entries(res.corr).map(([s, c]) => `D${s} ×${c.r.toFixed(2)} ${c.phi.toFixed(0)}°`).join(' '));
const options = [['bruto', { hc, z0: nivel }, s0], ['secundário', sec, sB], ['admitância', res, sA], ['harmônica', har, sH]];
options.sort((x, y) => score(x[2]) - score(y[2]));
const [name, win, ws] = options[0];
console.log('>>> ESCOLHIDO:', name, '|', fmt(ws));
fs.writeFileSync(file.replace(/\.txt$/, '.fit.json'), JSON.stringify({ station: stationId, method: name, z0: +win.z0.toFixed(3), val: ws, hc: win.hc.map(c => [c.name, +c.amplitude.toFixed(4), +c.phase.toFixed(2)]).filter(c => c[1] >= 0.002) }));

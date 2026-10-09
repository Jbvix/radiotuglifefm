/* ============================================================
   TugLife FM — Módulo "Tábua de Maré"
   ------------------------------------------------------------
   Arquivo   : tides.js
   Versão    : 2.8.0 (SPRINT 16)
   Data/Hora : 2026-10-08T22:30:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   HISTÓRICO DE MODIFICAÇÕES
   v2.7.0  [NOVO] Card com 13 portos: altura agora, tendência,
           próxima preamar/baixa-mar, extremos do dia e curva 24 h
           [NOVO] Navegação por dia (◀ Hoje ▶) e porto lembrado
           [NOVO] Selo de confiabilidade da estação de referência
   v2.8.0  [MOD] Selo mostra "Calibrado DHN · ±X min" com o erro
           típico medido contra a Tábua das Marés DHN 2026
           [MOD] Alturas sobre o Nível de Redução da DHN
   ------------------------------------------------------------
   COMO A MARÉ É CALCULADA (previsão harmônica)
   A maré astronômica é a soma de ondas senoidais, uma por
   "componente" (M2 = Lua semidiurna, S2 = Sol semidiurna,
   K1/O1 = diurnas, M4 = águas rasas…):

       h(t) = Z0 + Σ fᵢ · Aᵢ · cos(ωᵢ·t + (V0ᵢ + uᵢ) − gᵢ)

     Aᵢ, gᵢ   amplitude e fase da estação (tide-data.js)
     ωᵢ       velocidade angular (M2 = 28,984°/h → 12h25min)
     V0ᵢ      argumento astronômico no instante de referência
     fᵢ, uᵢ   correções nodais (ciclo lunar de 18,6 anos)
     Z0       nível médio sobre o Nível de Redução da DHN
              (calibrado com a Tábua das Marés DHN 2026)

   Exemplo de batimento: M2 (12h25) e S2 (12h00) entram e saem de
   fase a cada ~14,8 dias. Em fase somam (sizígia, marés grandes);
   em oposição se subtraem (quadratura, marés pequenas). Igual a
   dois propulsores azimutais em rotações ligeiramente diferentes:
   a vibração resultante "pulsa".

   O cálculo usa @neaps/tide-predictor (vendor/tide-engine.js),
   que aplica V0, f e u. Tudo roda no aparelho: funciona offline.

   ⚠ Previsão informativa. Não substitui a Tábua de Marés da DHN
   para navegação. Não inclui vento, pressão nem vazão de rios.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const ports = window.TUGLIFE_TIDES;
  const engine = window.NeapsTide;
  const card = document.getElementById('card-mare');
  if (!card || !ports || !engine) return;   // dados ausentes: card fica oculto

  /* ---------- 1. Elementos ---------- */
  const $ = (id) => document.getElementById(id);
  const ui = {
    select: $('tide-port'),
    prev: $('tide-prev'),
    today: $('tide-today'),
    next: $('tide-next'),
    date: $('tide-date'),
    ref: $('tide-ref'),
    now: $('tide-now'),
    trend: $('tide-trend'),
    upcoming: $('tide-upcoming'),
    list: $('tide-list'),
    chart: $('tide-chart'),
    note: $('tide-note')
  };

  const STORE_KEY = 'tuglife_tide_port';
  const NOISE_M = 0.08;   // extremos com diferença < 8 cm são "marolas" do cálculo
  const DAY_MS = 86400000;
  // Todos os 13 portos estão em UTC-3 e o Brasil não adota horário de
  // verão desde 2019. Por isso o "dia do porto" começa às 00:00-03:00.
  const OFFSET = '-03:00';

  const state = { port: null, predictor: null, dayShift: 0 };

  /* ---------- 2. Utilidades de data ---------- */
  function portYMD(date, tz) {
    // 'en-CA' formata como AAAA-MM-DD, prático para montar ISO
    return date.toLocaleDateString('en-CA', { timeZone: tz });
  }

  function dayStart(shift) {
    const ymd = portYMD(new Date(Date.now() + shift * DAY_MS), state.port.tz);
    return new Date(ymd + 'T00:00:00' + OFFSET);
  }

  const fmtTime = (d) => d.toLocaleTimeString('pt-BR', { timeZone: state.port.tz, hour: '2-digit', minute: '2-digit' });
  // Arredonda antes de formatar para não exibir "-0,0 m"
  const fmtM = (m) => {
    const r = Math.round(m * 10) / 10;
    return (r === 0 ? 0 : r).toFixed(1).replace('.', ',') + ' m';
  };

  /* ---------- 3. Preparação do porto ---------- */
  function buildPredictor(port) {
    const constituents = port.hc.map(([name, amplitude, phase]) => ({ name, amplitude, phase }));
    // offset = Z0: desloca a curva do nível médio para o MLWS
    return engine.createTidePredictor(constituents, { offset: port.z0 });
  }

  /* Filtro de "marolas": em portos de micromaré (Rio Grande, Itajaí)
     a soma harmônica gera pares de máximos/mínimos de poucos cm.
     Removemos o PAR vizinho cuja diferença de altura é < 8 cm,
     repetindo até não sobrar nenhum — fica só a maré "de verdade". */
  function cleanExtremes(list) {
    const out = list.slice();
    let i = 0;
    while (i < out.length - 1) {
      if (Math.abs(out[i].level - out[i + 1].level) < NOISE_M) {
        out.splice(i, 2);
        i = Math.max(0, i - 1);
      } else {
        i++;
      }
    }
    return out;
  }

  function extremes(start, end) {
    // margem de 12 h nas bordas para o filtro decidir bem perto da meia-noite
    const raw = state.predictor.getExtremesPrediction({
      start: new Date(start.getTime() - 12 * 3600000),
      end: new Date(end.getTime() + 12 * 3600000)
    });
    return cleanExtremes(raw).map((e) => ({ time: new Date(e.time), level: e.level, high: e.high }));
  }

  /* ---------- 4. Renderização ---------- */
  function render() {
    const port = state.port;
    const start = dayStart(state.dayShift);
    const end = new Date(start.getTime() + DAY_MS);
    const now = new Date();
    const isToday = state.dayShift === 0;

    const dateText = start.toLocaleDateString('pt-BR', {
      timeZone: port.tz, weekday: 'long', day: '2-digit', month: 'long'
    });
    ui.date.textContent = dateText.charAt(0).toUpperCase() + dateText.slice(1);
    ui.today.disabled = isToday;

    // Selo de confiabilidade: calibrado com DHN (erro típico medido)
    // ou, sem calibração, o nível da estação de referência.
    const r = port.ref;
    const c = port.calib;
    if (c) {
      ui.ref.textContent = `Calibrado com Tábua DHN · ±${c.dtRms} min · ±${c.dhRms} cm`;
      ui.ref.dataset.level = c.dtRms <= 8 && c.dhRms <= 8 ? 'direta' : 'próxima';
      ui.ref.title = `Método ${c.method}; ajuste ${c.fit}, validação ${c.validation} (${c.n}/${c.of} marés). Erro típico = RMS.`;
    } else {
      ui.ref.textContent = `Estação no porto · ${r.name} · nível estimado`;
      ui.ref.dataset.level = 'aproximada';
      ui.ref.title = 'Sem tábua DHN para calibrar: horários da estação local; altura de referência estimada.';
    }

    // Altura agora + tendência (derivada numérica em ±10 min)
    if (isToday) {
      const h = state.predictor.getWaterLevelAtTime({ time: now }).level;
      const h2 = state.predictor.getWaterLevelAtTime({ time: new Date(now.getTime() + 600000) }).level;
      const h1 = state.predictor.getWaterLevelAtTime({ time: new Date(now.getTime() - 600000) }).level;
      const rate = (h2 - h1) / (20 / 60);   // m/h
      ui.now.textContent = fmtM(h);
      ui.trend.textContent = Math.abs(rate) < 0.02 ? '⇆ estofo' : rate > 0 ? '↑ enchendo' : '↓ vazando';
      ui.now.parentElement.hidden = false;
    } else {
      ui.now.parentElement.hidden = true;
    }

    const all = extremes(start, end);
    const day = all.filter((e) => e.time >= start && e.time < end);

    // Próximo extremo (só faz sentido hoje)
    const nextEx = all.find((e) => e.time > now);
    ui.upcoming.textContent = isToday && nextEx
      ? `Próxima ${nextEx.high ? 'preamar' : 'baixa-mar'}: ${fmtTime(nextEx.time)} · ${fmtM(nextEx.level)}`
      : '';

    // Lista do dia
    ui.list.replaceChildren();
    day.forEach((e) => {
      const li = document.createElement('li');
      li.className = 'tide-item ' + (e.high ? 'is-high' : 'is-low');
      if (isToday && e === nextEx) li.classList.add('is-next');
      li.innerHTML = `<span class="tide-kind">${e.high ? '▲ PM' : '▼ BM'}</span>`
        + `<span class="tide-time">${fmtTime(e.time)}</span>`
        + `<span class="tide-level">${fmtM(e.level)}</span>`;
      ui.list.append(li);
    });
    if (!day.length) {
      const li = document.createElement('li');
      li.className = 'tide-item';
      li.textContent = 'Variação muito pequena neste dia (micromaré).';
      ui.list.append(li);
    }

    drawChart(start, end, day, isToday ? now : null);

    const COMPLEX = ['santos', 'paranagua', 'itajai', 'sepetiba', 'rio-grande'];
    ui.note.textContent = port.id === 'rio-grande'
      ? 'Em Rio Grande o nível é dominado por vento e vazão da Lagoa dos Patos; a maré astronômica é de poucos centímetros.'
      : COMPLEX.includes(port.id)
        ? 'Porto com marés de águas rasas: a tábua DHN pode listar preamares/baixa-mares duplas de poucos centímetros que aqui aparecem fundidas.'
        : !c
          ? 'Sem tábua DHN deste porto para calibrar: altura de referência estimada.'
          : '';
  }

  /* ---------- 5. Curva das 24 h em SVG ----------
     Escala vertical com folga de 10% acima e abaixo:
       y = H − pad − (nível − min) / (max − min) · (H − 2·pad)
     Linha tracejada = 0 m (MLWS / nível de redução).
     A largura W do viewBox acompanha a largura real do card (1 unidade
     = 1 pixel), assim pontos e textos não ficam esticados. */
  function drawChart(start, end, day, now) {
    const W = Math.max(280, Math.round(ui.chart.clientWidth || 600));
    const H = 150, pad = 16;
    const pts = state.predictor.getTimelinePrediction({ start, end, timeFidelity: 900 });
    let min = Math.min(0, ...pts.map((p) => p.level));
    let max = Math.max(...pts.map((p) => p.level));
    const span = Math.max(max - min, 0.3);   // evita "zoom" exagerado na micromaré
    min -= span * 0.1; max = min + span * 1.2;

    const x = (t) => ((t - start) / (end - start)) * W;
    const y = (v) => H - pad - ((v - min) / (max - min)) * (H - 2 * pad);

    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(new Date(p.time)).toFixed(1)},${y(p.level).toFixed(1)}`).join(' ');
    const area = `${line} L${W},${H} L0,${H} Z`;

    let svg = `<path class="tide-area" d="${area}"/><path class="tide-line" d="${line}"/>`;
    svg += `<line class="tide-zero" x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}"/>`;
    [6, 12, 18].forEach((hh) => {
      const xx = (hh / 24) * W;
      svg += `<line class="tide-grid" x1="${xx}" x2="${xx}" y1="0" y2="${H}"/><text class="tide-axis" x="${xx}" y="${H - 3}">${hh}h</text>`;
    });
    day.forEach((e) => {
      svg += `<circle class="tide-dot ${e.high ? 'is-high' : 'is-low'}" cx="${x(e.time)}" cy="${y(e.level)}" r="4"/>`;
    });
    if (now) {
      const nx = x(now);
      const ny = y(state.predictor.getWaterLevelAtTime({ time: now }).level);
      svg += `<line class="tide-now" x1="${nx}" x2="${nx}" y1="0" y2="${H}"/><circle class="tide-now-dot" cx="${nx}" cy="${ny}" r="5"/>`;
    }
    ui.chart.setAttribute('viewBox', `0 0 ${W} ${H}`);
    ui.chart.innerHTML = svg;
  }

  /* ---------- 6. Seleção de porto ---------- */
  function selectPort(id) {
    state.port = ports.find((p) => p.id === id) || ports[0];
    state.predictor = buildPredictor(state.port);
    ui.select.value = state.port.id;
    try { localStorage.setItem(STORE_KEY, state.port.id); } catch (e) { /* modo anônimo */ }
    render();
  }

  ports.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} · ${p.uf}`;
    ui.select.append(opt);
  });

  ui.select.addEventListener('change', () => { state.dayShift = 0; selectPort(ui.select.value); });
  ui.prev.addEventListener('click', () => { state.dayShift -= 1; render(); });
  ui.next.addEventListener('click', () => { state.dayShift += 1; render(); });
  ui.today.addEventListener('click', () => { state.dayShift = 0; render(); });

  let saved = null;
  try { saved = localStorage.getItem(STORE_KEY); } catch (e) { /* sem storage */ }
  selectPort(saved);
  card.hidden = false;

  // Redesenha ao girar o celular ou redimensionar a janela
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 200);
  });

  // Atualiza "agora" a cada minuto (só quando o dia exibido é hoje)
  setInterval(() => { if (state.dayShift === 0) render(); }, 60000);
});

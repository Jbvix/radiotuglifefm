/* ============================================================
   TugLife FM — Módulo "Nível Real de Rio Grande" (CIEX-FURG)
   ------------------------------------------------------------
   Arquivo   : ciex.js
   Versão    : 2.9.0 (SPRINT 17)
   Data/Hora : 2026-10-12T15:30:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   HISTÓRICO DE MODIFICAÇÕES
   v2.9.0  [NOVO] Lê o nível medido (a cada 30 min) e a previsão
           hidrodinâmica (horária, ~72 h) da estação FURG_CCMAR do
           sistema de Monitoramento Hidrodinâmico CIEX-FURG
           (https://hidrodinamica.ciex.org.br).
   ------------------------------------------------------------
   POR QUE RIO GRANDE PRECISA DISSO
   Na Lagoa dos Patos a maré astronômica é de poucos centímetros.
   O nível é governado por VENTO (empilhamento: vento NE baixa,
   vento SW represa a água na desembocadura) e pela VAZÃO dos rios
   (Guaíba, Camaquã, São Gonçalo). É como um tanque de lastro cujo
   nível depende mais das bombas (rios) e do adernamento (vento)
   do que da ondulação de fora. O modelo hidrodinâmico do CIEX
   resolve exatamente isso; a soma de senoides não.

   DADOS (JSON públicos do próprio site, via proxy Netlify /ciex/*,
   porque o servidor não envia cabeçalho CORS):
     observado_sensor_FURG_CCMAR.json  [{data, valor (cm)}]  30 min
     time_serie_FURG_CCMAR.json        [{data, valor (m), valor_real (m)}]
       valor      = previsão já corrigida para a régua (o que o
                    site exibe); valor_real = saída bruta do modelo
     correcao_niveis.json              {FURG_CCMAR: {mae_corrigido_cm}}
       erro médio absoluto da previsão corrigida → faixa ±erro
   Cota de alerta de inundação na régua CCMar: 80 cm (mesmo valor
   usado pelo painel do CIEX e citado pela Defesa Civil).

   Referencial: régua CCMar-FURG — NÃO é o Nível de Redução da DHN.
   Por isso o card mostra estes valores em centímetros e com rótulo
   próprio, sem misturar com a maré astronômica em metros.
   ============================================================ */

(() => {
  'use strict';

  const BASE = '/ciex/';                    // proxy definido no netlify.toml
  const STATION = 'FURG_CCMAR';
  const REFRESH_MS = 15 * 60000;            // site atualiza o observado a cada 30 min
  const ALERT_CM = 80;

  let cache = null;      // último conjunto válido
  let loading = null;    // promessa em andamento (evita pedidos duplicados)
  const listeners = [];

  // "2026-10-12T13:00:00.000000Z" → epoch ms (UTC)
  const toMs = (s) => {
    const t = Date.parse(String(s).replace(/\.(\d{3})\d*Z$/, '.$1Z'));
    return Number.isFinite(t) ? t : null;
  };

  async function getJson(file) {
    const r = await fetch(BASE + file, { cache: 'no-store' });
    if (!r.ok) throw new Error(file + ' HTTP ' + r.status);
    return r.json();
  }

  async function load() {
    if (loading) return loading;
    loading = (async () => {
      try {
        const [obsRaw, prvRaw, cor] = await Promise.all([
          getJson(`observado_sensor_${STATION}.json`),
          getJson(`time_serie_${STATION}.json`),
          getJson('correcao_niveis.json').catch(() => ({}))
        ]);
        const obs = obsRaw
          .map((o) => ({ t: toMs(o.data), cm: o.valor === null || o.valor === '' ? null : Number(o.valor) }))
          .filter((o) => o.t && Number.isFinite(o.cm))
          .sort((a, b) => a.t - b.t);
        // previsão em metros → centímetros (1 casa), como o site faz: valor·100
        const prv = prvRaw
          .map((p) => ({ t: toMs(p.data), cm: Math.round(Number(p.valor) * 1000) / 10 }))
          .filter((p) => p.t && Number.isFinite(p.cm))
          .sort((a, b) => a.t - b.t);
        if (!prv.length && !obs.length) throw new Error('séries vazias');
        const st = cor && cor[STATION] ? cor[STATION] : {};
        cache = {
          obs, prv,
          errCm: Number.isFinite(st.mae_corrigido_cm) ? Math.round(st.mae_corrigido_cm * 10) / 10 : null,
          generatedAt: cor && cor.gerado_em ? toMs(cor.gerado_em) : null,
          alertCm: ALERT_CM,
          fetchedAt: Date.now()
        };
        listeners.forEach((fn) => fn(cache));
      } catch (e) {
        // Sem rede ou proxy indisponível: o card segue com a maré astronômica.
        console.warn('[TugLife] CIEX indisponível:', e.message);
      } finally {
        loading = null;
      }
      return cache;
    })();
    return loading;
  }

  /* Interpolação linear numa série ordenada [{t, cm}]:
       cm(t) = cm₁ + (cm₂ − cm₁)·(t − t₁)/(t₂ − t₁)
     Só interpola se os vizinhos estiverem a ≤ 2 h (lacunas do sensor
     não viram retas inventadas). */
  function valueAt(series, t, maxGapMs = 2 * 3600000) {
    for (let i = 1; i < series.length; i++) {
      const a = series[i - 1], b = series[i];
      if (a.t <= t && t <= b.t) {
        if (b.t - a.t > maxGapMs) return null;
        return a.cm + (b.cm - a.cm) * (t - a.t) / (b.t - a.t);
      }
    }
    return null;
  }

  /* Picos e vales da previsão horária com proeminência mínima:
     um ponto é pico se for o maior da janela de ±3 h e superar o
     vale mais alto dos dois lados em pelo menos `minProm` cm.
     Evita listar "degraus" de 0,5 cm como preamares.            */
  function extremes(series, t0, t1, minProm = 3) {
    const s = series.filter((p) => p.t >= t0 - 6 * 3600000 && p.t <= t1 + 6 * 3600000);
    const out = [];
    for (let i = 1; i < s.length - 1; i++) {
      const w = s.slice(Math.max(0, i - 3), i + 4).map((p) => p.cm);
      const v = s[i].cm;
      const high = v === Math.max(...w) && v > s[i - 1].cm;
      const low = v === Math.min(...w) && v < s[i - 1].cm;
      if (!high && !low) continue;
      const left = s.slice(Math.max(0, i - 6), i).map((p) => p.cm);
      const right = s.slice(i + 1, i + 7).map((p) => p.cm);
      if (!left.length || !right.length) continue;
      const prom = high
        ? v - Math.max(Math.min(...left), Math.min(...right))
        : Math.min(Math.max(...left), Math.max(...right)) - v;
      if (prom >= minProm && s[i].t >= t0 && s[i].t < t1) out.push({ t: s[i].t, cm: v, high });
    }
    return out;
  }

  load();
  setInterval(load, REFRESH_MS);

  window.TugCiex = {
    get data() { return cache; },
    load,
    onUpdate(fn) { listeners.push(fn); },
    valueAt,
    extremes
  };
})();

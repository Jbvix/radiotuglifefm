/* ============================================================
   TugLife FM — Nível do mar MEDIDO (marégrafos SiMCosta/FURG)
   ------------------------------------------------------------
   Arquivo   : tide-live.js
   Versão    : 3.4.0 (SPRINT 22)
   Data/Hora : 2026-10-12T18:30:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   HISTÓRICO DE MODIFICAÇÕES
   v3.4.0  [NOVO] Rio Grande: nível medido agora no marégrafo radar
           de São José do Norte (SiMCosta id 332), tendência, maré
           meteorológica (medido − previsto) e curva medida das
           últimas 6 h sobre a curva prevista. Volta sozinho para a
           previsão quando o dado fica velho (> 30 min) ou falha.
   ------------------------------------------------------------
   DE ONDE VEM O DADO
   API pública e documentada do SiMCosta (https://simcosta.furg.br/q/docs/):
     GET /api/intrans_data?boiaID=332&type=json&time1=<s>&time2=<s>&params=<p>
   - 1 leitura por minuto; CORS liberado; sem login.
   - 1ª carga: últimas 6 h (~50 KB). Depois só o que chegou desde a
     última leitura (busca incremental, poucos KB a cada 5 min).

   DO ZERO DO RADAR AO NÍVEL DE REDUÇÃO (NR) DA DHN
   O radar mede a partir do próprio centro de fase (zero arbitrário,
   ~12,4 m acima da água). Amarramos ao NR comparando 30 dias de
   médias horárias com a previsão calibrada pela DHN:

       nível_NR(t) ≈ leitura(t) − OFFSET        OFFSET = 12,374 m

   OFFSET = média(leitura − previsão) em 706 h (12/09 a 12/10/2026).
   A média semanal oscilou ±7 cm → nível absoluto "estimado ±7 cm".
   Refazer quando a FURG amarrar o radar à rede do IBGE (RAAP) ou
   se o sensor for reinstalado (ver docs/PROJETO.md).

   MARÉ METEOROLÓGICA (o que a astronomia não explica)
       surge(t) = nível_NR(t) − previsão(t)
   Positivo = água acima do previsto (vento sul/SE represando a
   lagoa); negativo = abaixo (vento NE "esvaziando" o estuário).
   Em 30 dias variou de −34 a +29 cm — mais que a própria maré
   astronômica local. É como a deriva no rebocador: a rota
   calculada é a maré; o vento e a corrente empurram por fora.

   SUAVIZAÇÃO E TENDÊNCIA
   - "Agora" = mediana dos últimos 10 min (descarta picos de onda).
   - Tendência = inclinação da reta de mínimos quadrados dos
     últimos 30 min, em cm/h:
         b = Σ(tᵢ−t̄)(hᵢ−h̄) / Σ(tᵢ−t̄)²
     |b| < 2 cm/h → estável; b > 0 → enchendo; b < 0 → vazando.
   ============================================================ */

(function () {
  'use strict';

  const API = 'https://simcosta.furg.br/api/intrans_data';
  const ESTACOES = {
    'rio-grande': {
      id: 332,
      nome: 'São José do Norte',
      param: 'avg_water_level_arbitrary_zero',
      offset: 12.374,       // m — zero do radar → NR (ver cabeçalho)
      incerteza: 7,         // cm — oscilação semanal do offset
      calibracao: '30 dias (12/09 a 12/10/2026)'
    }
  };
  const JANELA_H = 6;            // horas de série guardadas e desenhadas
  const VELHO_MIN = 30;          // dado mais velho que isso = indisponível
  const ATUALIZA_MS = 5 * 60000; // nova busca a cada 5 min
  const H = 3600000;

  const cache = {};              // portId → { pontos:[{t,v}], ultimaBusca, erro }
  let portoAtual = null, preditor = null, hoje = true, ocupado = false;

  /* ---------- 1. Busca ---------- */
  async function buscar(portId) {
    const est = ESTACOES[portId];
    if (!est || ocupado) return;
    const c = cache[portId] || (cache[portId] = { pontos: [], ultimaBusca: 0, erro: null });
    ocupado = true;
    try {
      const agora = Date.now();
      const ultimo = c.pontos.length ? c.pontos[c.pontos.length - 1].t : 0;
      // incremental: só o que veio depois da última leitura (com 1 s de folga)
      const t1 = Math.floor((ultimo ? ultimo + 1000 : agora - JANELA_H * H) / 1000);
      const t2 = Math.floor(agora / 1000);
      const url = `${API}?boiaID=${est.id}&type=json&time1=${t1}&time2=${t2}&params=${est.param}`;
      const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const txt = await r.text();
      const lista = txt ? JSON.parse(txt) : [];
      const novos = (Array.isArray(lista) ? lista : [])
        .map((d) => ({ t: Date.parse(d.timestamp), v: Number(d[est.param]) }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 5 && p.v < 20 && p.t > ultimo);
      c.pontos = c.pontos.concat(novos).filter((p) => p.t >= agora - JANELA_H * H);
      c.ultimaBusca = agora;
      c.erro = null;
    } catch (e) {
      c.ultimaBusca = Date.now();
      c.erro = e.message || 'falha';
    } finally {
      ocupado = false;
    }
    if (window.TugTides && portoAtual && portoAtual.id === portId) window.TugTides.render();
  }

  /* ---------- 2. Cálculos ---------- */
  const mediana = (a) => { const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  function situacao(portId) {
    const est = ESTACOES[portId], c = cache[portId];
    if (!est || !c || !c.pontos.length) return null;
    const ult = c.pontos[c.pontos.length - 1];
    const idadeMin = (Date.now() - ult.t) / 60000;
    const nr = (p) => p.v - est.offset;
    const ult10 = c.pontos.filter((p) => p.t >= ult.t - 10 * 60000).map(nr);
    const nivel = mediana(ult10);
    // tendência: mínimos quadrados nos últimos 30 min (t em horas)
    const j = c.pontos.filter((p) => p.t >= ult.t - 30 * 60000);
    let tend = 0;
    if (j.length >= 5) {
      const tm = j.reduce((s, p) => s + p.t, 0) / j.length;
      const hm = j.reduce((s, p) => s + nr(p), 0) / j.length;
      let num = 0, den = 0;
      j.forEach((p) => { const dt = (p.t - tm) / H; num += dt * (nr(p) - hm); den += dt * dt; });
      tend = den ? num / den : 0;          // m/h
    }
    const prev = preditor ? preditor.getWaterLevelAtTime({ time: new Date(ult.t) }).level : null;
    return { est, nivel, tend, idadeMin, surge: prev == null ? null : nivel - prev, quando: new Date(ult.t) };
  }

  /* ---------- 3. Interface ---------- */
  const fmtM = (m) => (Math.round(m * 100) / 100).toFixed(2).replace('.', ',') + ' m';
  const fmtCm = (m) => { const cm = Math.round(m * 100); return (cm > 0 ? '+' : cm < 0 ? '−' : '±') + Math.abs(cm) + ' cm'; };

  function desenharCaixa() {
    const box = document.getElementById('tide-live');
    if (!box) return;
    const id = portoAtual && portoAtual.id;
    const s = id && hoje ? situacao(id) : null;
    const est = id && ESTACOES[id];
    if (!est || !hoje || !s) {
      // sem estação, outro dia, ou sem nenhum dado: some (a previsão continua)
      box.hidden = !(est && hoje && cache[id] && cache[id].erro);
      if (!box.hidden) {
        box.className = 'tide-live is-off';
        box.replaceChildren(linha('tide-live-head', 'Nível medido indisponível agora · mostrando só a previsão'));
      }
      return;
    }
    const velho = s.idadeMin > VELHO_MIN;
    box.hidden = false;
    box.className = 'tide-live' + (velho ? ' is-off' : '');
    const idade = s.idadeMin < 1.5 ? 'agora há pouco' : `há ${Math.round(s.idadeMin)} min`;
    if (velho) {
      box.replaceChildren(
        linha('tide-live-head', `Nível medido · ${est.nome}`),
        linha('tide-live-sub', `Sem dado novo desde ${s.quando.toLocaleTimeString('pt-BR', { timeZone: portoAtual.tz, hour: '2-digit', minute: '2-digit' })} — mostrando só a previsão.`),
        credito());
      return;
    }
    const tendTxt = Math.abs(s.tend) < 0.02 ? '⇆ estável' : s.tend > 0 ? '↑ enchendo' : '↓ vazando';
    const head = linha('tide-live-head', '');
    const dot = document.createElement('span'); dot.className = 'tide-live-dot'; dot.setAttribute('aria-hidden', 'true');
    head.append(dot, document.createTextNode(` Ao vivo · nível medido · ${est.nome}`));
    const valor = document.createElement('div'); valor.className = 'tide-live-valor';
    const strong = document.createElement('strong'); strong.textContent = fmtM(s.nivel);
    const sup = document.createElement('sup'); sup.textContent = '*';
    const em = document.createElement('em'); em.textContent = tendTxt;
    strong.append(sup); valor.append(strong, em);
    const filhos = [head, valor];
    if (s.surge != null) {
      const sg = linha('tide-live-surge', '');
      const forte = Math.abs(s.surge) >= 0.15;
      sg.dataset.forte = forte ? 'sim' : 'nao';
      sg.textContent = `Maré meteorológica: ${fmtCm(s.surge)} ${s.surge >= 0 ? 'acima' : 'abaixo'} da previsão`;
      filhos.push(sg);
    }
    filhos.push(linha('tide-live-sub', `Atualizado ${idade} · linha verde no gráfico = medido`));
    filhos.push(credito());
    box.replaceChildren(...filhos);
  }

  function linha(cls, txt) { const p = document.createElement('p'); p.className = cls; p.textContent = txt; return p; }
  function credito() {
    const est = ESTACOES[portoAtual.id];
    return linha('tide-live-cred', `* Referido ao NR da DHN por ajuste de ${est.calibracao}; ±${est.incerteza} cm. Dados cortesia do SiMCosta/FURG.`);
  }

  /* ---------- 4. Interface pública (usada por tides.js) ---------- */
  window.TugTideLive = {
    // há estação para o porto e um dado recente?
    ativo(portId) { const s = situacao(portId); return !!(s && s.idadeMin <= VELHO_MIN); },
    // série no NR para o gráfico (1 ponto a cada 5 min), só dentro da janela pedida
    serie(portId, inicio, fim) {
      const est = ESTACOES[portId], c = cache[portId];
      if (!est || !c || !hoje) return [];
      const out = []; let ultimo = 0;
      c.pontos.forEach((p) => {
        if (p.t < inicio.getTime() || p.t > fim.getTime() || p.t - ultimo < 5 * 60000) return;
        out.push({ time: new Date(p.t), level: p.v - est.offset }); ultimo = p.t;
      });
      return out;
    },
    // chamado a cada render() de tides.js
    aoDesenhar(porto, pred, ehHoje) {
      portoAtual = porto; preditor = pred; hoje = ehHoje;
      desenharCaixa();
      const c = cache[porto.id];
      if (ESTACOES[porto.id] && ehHoje && (!c || Date.now() - c.ultimaBusca > ATUALIZA_MS)) buscar(porto.id);
    },
    _estacoes: ESTACOES   // para testes e documentação
  };

  if (typeof document === 'undefined') return;   // carregado em Node (tools/mare/simcosta-offset.mjs)
  document.addEventListener('DOMContentLoaded', () => {
    // tides.js já desenhou antes deste módulo carregar: sincroniza uma vez
    if (window.TugTides && window.TugTides.porto()) window.TugTides.render();
    // revisita a cada minuto; só busca se a aba/página estiver visível
    setInterval(() => {
      if (document.hidden || !portoAtual || !hoje || !ESTACOES[portoAtual.id]) return;
      const c = cache[portoAtual.id];
      if (!c || Date.now() - c.ultimaBusca > ATUALIZA_MS) buscar(portoAtual.id);
    }, 60000);
  });
})();

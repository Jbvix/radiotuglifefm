/* ============================================================
   TugLife FM — Nível do mar MEDIDO (marégrafos SiMCosta/FURG)
   ------------------------------------------------------------
   Arquivo   : tide-live.js
   Versão    : 3.5.0 (SPRINT 23)
   Data/Hora : 2026-10-14T22:30:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   HISTÓRICO DE MODIFICAÇÕES
   v3.4.0  [NOVO] Rio Grande: nível medido agora no marégrafo radar
           de São José do Norte (SiMCosta id 332), tendência, maré
           meteorológica (medido − previsto) e curva medida das
           últimas 6 h sobre a curva prevista. Volta sozinho para a
           previsão quando o dado fica velho (> 30 min) ou falha.
   v3.5.0  [NOVO] Suape com nível medido pela MÉDIA de dois marégrafos,
           Recife (id 330, UFPE) ao norte e Tamandaré (id 399,
           CEPENE/UFPE) ao sul. O marégrafo de Suape (id 311) está
           mudo desde 2024 e o radar dele foi para Tamandaré.
           [MOD] ESTACOES[porto].fontes: lista de marégrafos, cada um
           com o seu offset. Se um cair (> 30 min sem dado), segue
           com o outro e a faixa avisa qual está no ar.
           [NOVO] adiantamentoMin: correção de horário da estação de
           referência para o porto (ver "PORTO SECUNDÁRIO" abaixo).
           [FIX] Maré meteorológica pela mediana dos resíduos: a
           mediana do nível atrasava ~5 min e, com a maré correndo,
           inventava até ~4 cm (achado no teste de Suape).
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

   VÁRIOS MARÉGRAFOS NUM PORTO (Suape)
   Cada marégrafo i vai ao NR pelo seu próprio offset; depois,
   minuto a minuto, tira-se a média dos que estão no ar:

       nível_NR(t) = (1/n) · Σ [ leitura_i(t) − OFFSET_i ]

   A série combinada vai só até o último minuto que TODOS os
   marégrafos ativos já mandaram; assim a média nunca "pula" entre
   1 e 2 estações no fim da linha. É a mesma ideia de cruzar duas
   marcações para fixar a posição: cada uma tem o seu erro, a média
   fica mais firme e, se uma some, ainda sobra a outra.
   Em 30 dias, Recife e Tamandaré no NR diferiram 0,0 cm em média
   (RMS 3,2 cm).

   PORTO SECUNDÁRIO (correção de horário)
   Em Recife e Tamandaré a maré chega ~11 min ANTES da previsão de
   Suape (melhor ajuste em 30 dias, passos de 1 min). Como nas
   tábuas da DHN para portos secundários, transferimos a leitura
   para o horário do porto:

       t_porto = t_leitura + adiantamentoMin

   Sem essa correção, perto da meia-maré (subida de ~0,5 m/h em
   Suape) apareceria uma falsa maré meteorológica de ~±9 cm:
       erro ≈ velocidade × atraso = 0,5 m/h × 11/60 h ≈ 9 cm
   A idade do dado ("há N min") continua contada no relógio real.

   SUAVIZAÇÃO E TENDÊNCIA
   - Maré meteorológica = mediana, nos últimos 10 min, de
     (medido − previsto) minuto a minuto (descarta picos de onda).
   - "Agora" = previsão no último minuto + essa maré meteorológica
     (v3.5.0; antes era a mediana do nível, que atrasava ~5 min).
   - Tendência = inclinação da reta de mínimos quadrados dos
     últimos 30 min, em cm/h:
         b = Σ(tᵢ−t̄)(hᵢ−h̄) / Σ(tᵢ−t̄)²
     |b| < 2 cm/h → estável; b > 0 → enchendo; b < 0 → vazando.
   ============================================================ */

(function () {
  'use strict';

  const API = 'https://simcosta.furg.br/api/intrans_data';
  // v3.5.0: cada porto lista 1 ou mais marégrafos (fontes); offset por fonte
  const ESTACOES = {
    'rio-grande': {
      nome: 'São José do Norte',
      param: 'avg_water_level_arbitrary_zero',
      fontes: [
        { id: 332, nome: 'São José do Norte', offset: 12.374 }   // m — zero do radar → NR
      ],
      adiantamentoMin: 0,   // estação no próprio porto
      incerteza: 7,         // cm — oscilação semanal do offset
      calibracao: '30 dias (12/09 a 12/10/2026)',
      credito: 'SiMCosta/FURG'
    },
    suape: {
      nome: 'Recife + Tamandaré',
      param: 'avg_water_level_arbitrary_zero',
      fontes: [
        { id: 330, nome: 'Recife', offset: 10.311 },      // ~40 km ao norte
        { id: 399, nome: 'Tamandaré', offset: 10.305 }    // ~44 km ao sul
      ],
      adiantamentoMin: 11,  // maré chega 11 min antes nas duas (ver cabeçalho)
      incerteza: 4,         // cm — oscilação semanal do offset
      calibracao: '30 dias (15/09 a 15/10/2026)',
      credito: 'SiMCosta/FURG, UFPE e CEPENE'
    }
  };
  const JANELA_H = 6;            // horas de série guardadas e desenhadas
  const VELHO_MIN = 30;          // dado mais velho que isso = indisponível
  const ATUALIZA_MS = 5 * 60000; // nova busca a cada 5 min
  const H = 3600000, MIN = 60000;

  const cache = {};              // fonte.id → { pontos:[{t,v}], erro }
  const ultimaBusca = {};        // portId → instante da última busca
  const ocupado = {};            // portId → busca em andamento
  let portoAtual = null, preditor = null, hoje = true;

  /* ---------- 1. Busca (todas as fontes do porto em paralelo) ---------- */
  async function buscarFonte(est, f) {
    const c = cache[f.id] || (cache[f.id] = { pontos: [], erro: null });
    try {
      const agora = Date.now();
      const ultimo = c.pontos.length ? c.pontos[c.pontos.length - 1].t : 0;
      // incremental: só o que veio depois da última leitura (com 1 s de folga)
      const t1 = Math.floor((ultimo ? ultimo + 1000 : agora - JANELA_H * H) / 1000);
      const t2 = Math.floor(agora / 1000);
      const url = `${API}?boiaID=${f.id}&type=json&time1=${t1}&time2=${t2}&params=${est.param}`;
      const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const txt = await r.text();
      const lista = txt ? JSON.parse(txt) : [];
      const novos = (Array.isArray(lista) ? lista : [])
        .map((d) => ({ t: Date.parse(d.timestamp), v: Number(d[est.param]) }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 5 && p.v < 20 && p.t > ultimo);
      c.pontos = c.pontos.concat(novos).filter((p) => p.t >= agora - JANELA_H * H);
      c.erro = null;
    } catch (e) {
      c.erro = e.message || 'falha';
    }
  }

  async function buscar(portId) {
    const est = ESTACOES[portId];
    if (!est || ocupado[portId]) return;
    ocupado[portId] = true;
    ultimaBusca[portId] = Date.now();
    try {
      await Promise.all(est.fontes.map((f) => buscarFonte(est, f)));
    } finally {
      ocupado[portId] = false;
    }
    if (window.TugTides && portoAtual && portoAtual.id === portId) window.TugTides.render();
  }

  /* ---------- 2. Combinação das fontes ---------- */
  // Devolve a série do porto no NR: [{t (horário do porto), tReal, nr}]
  // e quais fontes entraram. Fontes com dado > VELHO_MIN ficam de fora;
  // se TODAS estiverem velhas, usa as que têm dado (para avisar "sem dado novo").
  function combinar(portId) {
    const est = ESTACOES[portId];
    if (!est) return null;
    const agora = Date.now();
    const comDado = est.fontes.filter((f) => cache[f.id] && cache[f.id].pontos.length);
    if (!comDado.length) return null;
    const ultimoDe = (f) => cache[f.id].pontos[cache[f.id].pontos.length - 1].t;
    let usadas = comDado.filter((f) => (agora - ultimoDe(f)) / MIN <= VELHO_MIN);
    if (!usadas.length) usadas = comDado;
    // corte no último minuto que todas as usadas já têm (média sem "degrau" no fim)
    const corte = Math.min(...usadas.map(ultimoDe));
    const soma = new Map();   // minuto → [Σ nr, n, t]
    usadas.forEach((f) => cache[f.id].pontos.forEach((p) => {
      if (p.t > corte) return;
      const k = Math.round(p.t / MIN), a = soma.get(k) || [0, 0, p.t];
      a[0] += p.v - f.offset; a[1] += 1; soma.set(k, a);
    }));
    const desloc = est.adiantamentoMin * MIN;
    const pontos = [...soma.values()].sort((x, y) => x[2] - y[2])
      .map(([s, n, t]) => ({ tReal: t, t: t + desloc, nr: s / n }));
    const fora = est.fontes.filter((f) => !usadas.includes(f));
    return { pontos, usadas, fora };
  }

  /* ---------- 3. Cálculos ---------- */
  const mediana = (a) => { const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  function situacao(portId) {
    const est = ESTACOES[portId], cb = combinar(portId);
    if (!est || !cb || !cb.pontos.length) return null;
    const pts = cb.pontos, ult = pts[pts.length - 1];
    const idadeMin = (Date.now() - ult.tReal) / MIN;   // relógio real
    const ult10 = pts.filter((p) => p.t >= ult.t - 10 * MIN);
    // tendência: mínimos quadrados nos últimos 30 min (t em horas)
    const j = pts.filter((p) => p.t >= ult.t - 30 * MIN);
    let tend = 0;
    if (j.length >= 5) {
      const tm = j.reduce((s, p) => s + p.t, 0) / j.length;
      const hm = j.reduce((s, p) => s + p.nr, 0) / j.length;
      let num = 0, den = 0;
      j.forEach((p) => { const dt = (p.t - tm) / H; num += dt * (p.nr - hm); den += dt * dt; });
      tend = den ? num / den : 0;          // m/h
    }
    // v3.5.0 [FIX] maré meteorológica = mediana dos RESÍDUOS minuto a minuto
    //   surge = mediana( nr(tᵢ) − previsão(tᵢ) )   nos últimos 10 min
    // Antes: mediana(nr) − previsão(último minuto). A mediana de 10 min
    // "mora" ~5 min no passado; com a maré correndo a 0,5 m/h isso
    // somava ~4 cm falsos (0,5 m/h × 5/60 h). Em Rio Grande não aparecia
    // porque a maré astronômica lá quase não se move.
    // Nível agora = previsão(último minuto) + surge: a forma da curva vem
    // da previsão e a altura vem do marégrafo (sem atraso de 5 min).
    // Sem previsão disponível: mediana simples dos últimos 10 min.
    let nivel, surge = null;
    if (preditor) {
      const prev = (t) => preditor.getWaterLevelAtTime({ time: new Date(t) }).level;
      surge = mediana(ult10.map((p) => p.nr - prev(p.t)));
      nivel = prev(ult.t) + surge;        // horário do porto (já com o adiantamento)
    } else {
      nivel = mediana(ult10.map((p) => p.nr));
    }
    return { est, nivel, tend, idadeMin, surge, quando: new Date(ult.tReal), usadas: cb.usadas, fora: cb.fora };
  }

  /* ---------- 4. Interface ---------- */
  const fmtM = (m) => (Math.round(m * 100) / 100).toFixed(2).replace('.', ',') + ' m';
  const fmtCm = (m) => { const cm = Math.round(m * 100); return (cm > 0 ? '+' : cm < 0 ? '−' : '±') + Math.abs(cm) + ' cm'; };
  const nomes = (lista) => lista.map((f) => f.nome).join(' e ');

  function algumErro(est) { return est.fontes.some((f) => cache[f.id] && cache[f.id].erro); }

  function desenharCaixa() {
    const box = document.getElementById('tide-live');
    if (!box) return;
    const id = portoAtual && portoAtual.id;
    const s = id && hoje ? situacao(id) : null;
    const est = id && ESTACOES[id];
    if (!est || !hoje || !s) {
      // sem estação, outro dia, ou sem nenhum dado: some (a previsão continua)
      box.hidden = !(est && hoje && algumErro(est));
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
    // v3.5.0: com uma fonte fora, o título mostra só a que está no ar
    const titulo = s.fora.length ? nomes(s.usadas) : est.nome;
    const tendTxt = Math.abs(s.tend) < 0.02 ? '⇆ estável' : s.tend > 0 ? '↑ enchendo' : '↓ vazando';
    const head = linha('tide-live-head', '');
    const dot = document.createElement('span'); dot.className = 'tide-live-dot'; dot.setAttribute('aria-hidden', 'true');
    head.append(dot, document.createTextNode(` Ao vivo · nível medido · ${titulo}`));
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
    if (est.fontes.length > 1) {
      filhos.push(linha('tide-live-sub', s.fora.length
        ? `Só ${nomes(s.usadas)} no ar (${nomes(s.fora)} sem dado) · horário corrigido para ${portoAtual.name}`
        : `Média de ${nomes(s.usadas)} · horário corrigido para ${portoAtual.name}`));
    }
    filhos.push(credito());
    box.replaceChildren(...filhos);
  }

  function linha(cls, txt) { const p = document.createElement('p'); p.className = cls; p.textContent = txt; return p; }
  function credito() {
    const est = ESTACOES[portoAtual.id];
    return linha('tide-live-cred', `* Referido ao NR da DHN por ajuste de ${est.calibracao}; ±${est.incerteza} cm. Dados cortesia do ${est.credito}.`);
  }

  /* ---------- 5. Interface pública (usada por tides.js) ---------- */
  window.TugTideLive = {
    // há estação para o porto e um dado recente?
    ativo(portId) { const s = situacao(portId); return !!(s && s.idadeMin <= VELHO_MIN); },
    // série no NR para o gráfico (1 ponto a cada 5 min), só dentro da janela pedida
    serie(portId, inicio, fim) {
      if (!ESTACOES[portId] || !hoje) return [];
      const cb = combinar(portId);
      if (!cb) return [];
      const out = []; let ultimo = 0;
      cb.pontos.forEach((p) => {
        if (p.t < inicio.getTime() || p.t > fim.getTime() || p.t - ultimo < 5 * MIN) return;
        out.push({ time: new Date(p.t), level: p.nr }); ultimo = p.t;
      });
      return out;
    },
    // chamado a cada render() de tides.js
    aoDesenhar(porto, pred, ehHoje) {
      portoAtual = porto; preditor = pred; hoje = ehHoje;
      desenharCaixa();
      if (ESTACOES[porto.id] && ehHoje && Date.now() - (ultimaBusca[porto.id] || 0) > ATUALIZA_MS) buscar(porto.id);
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
      if (Date.now() - (ultimaBusca[portoAtual.id] || 0) > ATUALIZA_MS) buscar(portoAtual.id);
    }, 60000);
  });
})();

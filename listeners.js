/* ============================================================
   TugLife FM — Módulo "Tripulação a Bordo" (ouvintes)
   ------------------------------------------------------------
   Arquivo   : listeners.js
   Versão    : 2.6.0 (SPRINT 14)
   Data/Hora : 2026-10-08T15:55:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   HISTÓRICO DE MODIFICAÇÕES
   v2.6.0  [NOVO] Selo "👥 N a bordo": ouvintes em tempo real via
           Supabase Realtime Presence (projeto tuglife-fm)
           [NOVO] "📈 Pico hoje": pico por hora gravado na tabela
           audiencia_horaria pela função registrar_pico
           [NOVO] Sonda do total OFICIAL na API de status BRLOGIC:
           se ela trouxer um campo de ouvintes, o selo passa a
           mostrar o total de todas as plataformas
   ------------------------------------------------------------
   PRINCÍPIO DE PROJETO
   Este módulo NÃO altera o player existente. Ele apenas observa
   os eventos do <audio id="radio-stream"> ('playing', 'pause',
   'error'), como um sensor externo que lê o eixo sem mexer no
   motor. Se o Supabase ou a CDN falharem, o app segue igual.
   ============================================================ */

(() => {
  'use strict';

  /* ---------- 1. Configuração ---------- */
  const CFG = {
    SUPABASE_URL: 'https://udedhipgekgonnioofgk.supabase.co',
    // Chave "publishable": pública por natureza, só faz o que as
    // regras do banco permitem (ler picos e chamar registrar_pico).
    SUPABASE_KEY: 'sb_publishable_eFnlzgsmvXurOo60X7OPcw_hlj_kFnt',
    CHANNEL: 'tuglife-fm-ouvintes',

    // Mesma API que o app já usa para a "faixa atual".
    BRLOGIC_STATUS: 'https://d36nr0u3xmc4mm.cloudfront.net/index.php/api/streaming/status/7098/d92598a79a1991e75829a583a2527672/SV14BR',
    OFFICIAL_POLL_MS: 30000,

    PEAK_MIN_INTERVAL_MS: 20000,   // ≥ 20 s entre gravações por aba
    PEAK_HEARTBEAT_MS: 5 * 60000   // regrava a cada 5 min
  };

  /* ---------- 2. Elementos ---------- */
  const $ = (id) => document.getElementById(id);
  const audio = $('radio-stream');
  const row = $('crew-row');
  const badge = $('crew-badge');
  const count = $('crew-count');
  const label = $('crew-label');
  const peak = $('crew-peak');
  const peakCount = $('crew-peak-count');

  if (!audio || !row) return;   // marcação ausente: módulo dorme

  const st = {
    playing: false,
    presence: 0,          // ouvintes no app (Presence)
    official: null,       // total BRLOGIC (null = indisponível)
    channel: null,
    subscribed: false,
    lastSent: -1,
    lastAt: 0
  };

  /* ---------- 3. Cliente Supabase (um só, compartilhado) ---------- */
  const sb = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY)
    : null;

  /* ---------- 4. Renderização ----------
     Prioridade: total OFICIAL (todas as plataformas) > Presence
     (só este app). O rótulo muda para o ouvinte saber o que vê. */
  function render() {
    const useOfficial = typeof st.official === 'number';
    const value = useOfficial ? st.official : st.presence;
    const old = count.textContent;

    count.textContent = value;
    label.textContent = useOfficial ? 'ouvintes' : 'a bordo';
    badge.title = useOfficial
      ? 'Ouvintes em todas as plataformas (BRLOGIC)'
      : 'Ouvintes conectados por este app agora';
    row.hidden = false;

    // "bump": o número pulsa ao mudar, como o ponteiro de um
    // manômetro que salta quando a pressão varia.
    if (old !== String(value)) {
      badge.classList.remove('crew-bump');
      void badge.offsetWidth;
      badge.classList.add('crew-bump');
    }
  }

  function renderPeak(value) {
    if (typeof value !== 'number' || value < 1) return;
    peakCount.textContent = value;
    peak.hidden = false;
    row.hidden = false;
  }

  /* ---------- 5. Presence: a lista de bordo ----------
     Cada aba TOCANDO "assina" a lista (track); ao pausar ou fechar,
     risca o nome (untrack). O servidor avisa todas as abas a cada
     mudança (evento "sync"). Total = número de chaves da lista. */
  function clientId() {
    const fresh = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
    try {
      let id = sessionStorage.getItem('tuglife_client_id');
      if (!id) { id = fresh(); sessionStorage.setItem('tuglife_client_id', id); }
      return id;   // mesmo id após F5: não conta em dobro
    } catch (e) {
      return fresh();
    }
  }

  function initPresence() {
    if (!sb) return;
    st.channel = sb.channel(CFG.CHANNEL, { config: { presence: { key: clientId() } } });
    st.channel
      .on('presence', { event: 'sync' }, () => {
        st.presence = Object.keys(st.channel.presenceState()).length;
        render();
        report(st.presence);
      })
      .subscribe((status) => {
        st.subscribed = (status === 'SUBSCRIBED');
        if (st.subscribed && st.playing) join();
      });
  }

  function join() {
    if (st.channel && st.subscribed) st.channel.track({ desde: new Date().toISOString() });
  }

  function leave() {
    if (st.channel && st.subscribed) st.channel.untrack();
  }

  /* ---------- 6. Diário de Audiência ----------
     Servidor: pico_da_hora = MAX(pico_atual, enviado), teto 1000.
     Cliente só envia quando (a) o total cresceu e já passaram
     20 s, ou (b) passaram 5 min (batimento que também mantém o
     projeto gratuito do Supabase ativo enquanto houver ouvintes). */
  async function report(total) {
    if (!sb || !st.playing) return;
    const now = Date.now();
    const elapsed = now - st.lastAt;
    const grew = total > st.lastSent && elapsed >= CFG.PEAK_MIN_INTERVAL_MS;
    if (!grew && elapsed < CFG.PEAK_HEARTBEAT_MS) return;

    st.lastSent = total;
    st.lastAt = now;
    const { data, error } = await sb.rpc('registrar_pico', { p_total: total });
    if (!error) renderPeak(data);
  }

  async function loadPeak() {
    if (!sb) return;
    const { data, error } = await sb.rpc('pico_hoje');
    if (!error) renderPeak(data);
  }

  setInterval(() => { if (st.playing) report(Math.max(1, st.presence)); }, CFG.PEAK_HEARTBEAT_MS);

  /* ---------- 7. Sonda do total oficial (BRLOGIC) ----------
     Não sabemos se a API de status traz ouvintes. A sonda procura
     nomes de campo comuns; achou um número -> usa como oficial.
     Os campos disponíveis ficam no console para diagnóstico. */
  const KEYS = ['listeners', 'currentListeners', 'current_listeners', 'listenersCount',
                'listeners_count', 'ouvintes'];
  // "online" fica de fora de propósito: em muitas APIs significa
  // "servidor no ar" (1/0), o que geraria um falso "1 ouvinte".
  let keysLogged = false;

  function findListeners(obj, depth) {
    if (!obj || typeof obj !== 'object' || depth > 2) return null;
    for (const k of KEYS) {
      const raw = obj[k];
      // Aceita só número ou texto numérico; booleanos ficam de fora.
      if ((typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '')) && Number.isFinite(Number(raw))) {
        return Number(raw);
      }
    }
    for (const v of Object.values(obj)) {
      const found = findListeners(v, depth + 1);
      if (found !== null) return found;
    }
    return null;
  }

  async function probeOfficial() {
    try {
      const r = await fetch(CFG.BRLOGIC_STATUS, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      if (!keysLogged) {
        console.info('[TugLife] Campos da API BRLOGIC:', Object.keys(d || {}));
        keysLogged = true;
      }
      st.official = findListeners(d, 0);
    } catch (e) {
      st.official = null;   // volta para o contador do app
    }
    if (st.official !== null || st.presence > 0) render();
  }

  /* ---------- 8. Sensores no áudio do player ---------- */
  audio.addEventListener('playing', () => {
    if (!st.playing) { st.playing = true; join(); }
  });
  ['pause', 'error', 'emptied'].forEach((ev) => audio.addEventListener(ev, () => {
    if (st.playing) { st.playing = false; leave(); }
  }));

  /* ---------- 9. Partida ---------- */
  initPresence();
  loadPeak();
  probeOfficial();
  setInterval(probeOfficial, CFG.OFFICIAL_POLL_MS);
})();

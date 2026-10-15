/* ============================================================
   TugLife FM — "Programação SAAM · Suape" (apoio ao Comandante)
   ------------------------------------------------------------
   Arquivo   : saam.js
   Versão    : 3.9.1 (SPRINT 28)
   Data/Hora : 2026-10-15T17:30:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   HISTÓRICO DE MODIFICAÇÕES
   v3.9.1  [NOVO] Card recolhível (<details id="saam-panel">): fechado no
           celular, aberto no computador; a escolha do tripulante fica
           lembrada. O resumo na linha fechada mostra 🔒 ou "N manobras".
           Um alerta abre o painel sozinho (a faixa colorida fica dentro).
           [NOVO] PIN único para Suape e Rio (saam-rj.js): entrar num card
           emite 'saam:pin' e o outro destrava junto; "Bloquear neste
           aparelho" emite 'saam:bloqueio' e trava os dois.
   v3.1.0  [NOVO] alertar() emite o evento 'saam:alerta' para o
           selo laranja da aba "Manobras" (tabs.js). Testes de som
           não acendem o selo (detail.teste = true).
           [MOD] Link #card-saam: a abertura da aba fica com tabs.js.
   v3.0.0  [NOVO] Card protegido por PIN da tripulação com as
           manobras SAAM em Suape (lidas da planilha da praticagem
           a cada 2 min pelo coletor saam-suape-sync no Supabase).
           [NOVO] 3 alertas sonoros distintos + vibração:
             CONFIRMADA  ding-dong ascendente (boa notícia)
             CANCELADA   dois tons descendentes graves
             ANTECIPADA  bipes rápidos repetidos (urgente)
           [NOVO] Notificação push com a tela apagada (Web Push).
   ------------------------------------------------------------
   COMO O SOM É FEITO (Web Audio, sem arquivos de áudio)
   Cada nota é um oscilador com envelope de volume:
       ganho(t) = 0 → pico em 15 ms → decai exponencialmente
   A frequência define a "cor" do alerta:
       subir de 660 Hz para 880 Hz (quinta justa) soa positivo;
       descer de 523 Hz para 330 Hz soa como "baixa";
       1000 Hz em pulsos curtos chama atenção, como um apito.
   O navegador só libera áudio depois de um toque do usuário —
   por isso o botão "Ativar alertas" (e ele também testa o som).
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const API = 'https://udedhipgekgonnioofgk.supabase.co/rest/v1/rpc/';
  const KEY = 'sb_publishable_eFnlzgsmvXurOo60X7OPcw_hlj_kFnt';
  const POLL_MS = 60000;
  const LS = { pin: 'tuglife_saam_pin', ultimo: 'tuglife_saam_ultimo', alertas: 'tuglife_saam_alertas', paineis: 'tuglife_paineis' };

  const $ = (id) => document.getElementById(id);
  const card = $('card-saam');
  if (!card) return;
  const ui = {
    lock: $('saam-lock'), form: $('saam-form'), pin: $('saam-pin'), msg: $('saam-msg'),
    main: $('saam-main'), sync: $('saam-sync'), alertBtn: $('saam-alert-btn'), alertInfo: $('saam-alert-info'),
    tests: $('saam-tests'), list: $('saam-list'), events: $('saam-events'), banner: $('saam-banner'), sair: $('saam-sair'),
    panel: $('saam-panel'), resumo: $('saam-resumo')
  };

  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* modo anônimo */ } },
    del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* idem */ } }
  };

  let pin = store.get(LS.pin);
  let ultimo = Number(store.get(LS.ultimo) || 0);
  let vapidKey = null;
  let timer = null;
  // Já houve uma carga nesta sessão? Só depois dela eventos novos tocam.
  // (Não dá para usar "ultimo > 0": sem nenhum alerta no histórico o 1º
  // alerta real nunca tocaria.)
  let carregado = false;

  /* ---------- 1. API (funções protegidas por PIN no Supabase) ---------- */
  async function rpc(fn, body) {
    const r = await fetch(API + fn, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  /* ---------- 2. Sons e vibração ---------- */
  let ctx = null;
  function audio() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // nota(frequência Hz, início s, duração s, forma, volume)
  function nota(f, t0, dur, tipo = 'sine', vol = 0.35) {
    const a = audio(), o = a.createOscillator(), g = a.createGain();
    const t = a.currentTime + t0;
    o.type = tipo; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const SONS = {
    CONFIRMADA: () => { [0, 0.9].forEach((s) => { nota(660, s, 0.35); nota(880, s + 0.25, 0.5); }); },
    CANCELADA: () => { [0, 1.0].forEach((s) => { nota(523, s, 0.4, 'triangle', 0.4); nota(330, s + 0.35, 0.6, 'triangle', 0.45); }); },
    ANTECIPADA: () => { for (let g = 0; g < 3; g++) for (let i = 0; i < 3; i++) nota(1000, g * 0.8 + i * 0.16, 0.11, 'square', 0.18); }
  };
  const VIBRA = {
    CONFIRMADA: [200, 100, 200],
    CANCELADA: [600, 200, 600],
    ANTECIPADA: [150, 80, 150, 80, 150, 300, 150, 80, 150, 80, 150]
  };
  const ICONE = { CONFIRMADA: '✅', CANCELADA: '❌', ANTECIPADA: '⏩' };

  function alertar(tipo, texto) {
    if (texto !== 'teste de som') abrirPainel();   // v3.9.1: alerta abre o painel
    try { SONS[tipo] && SONS[tipo](); } catch (e) { /* áudio bloqueado */ }
    if (navigator.vibrate) navigator.vibrate(VIBRA[tipo] || 200);
    ui.banner.className = 'saam-banner is-' + tipo.toLowerCase();
    ui.banner.textContent = `${ICONE[tipo] || ''} ${tipo} · ${texto}`;
    ui.banner.hidden = false;
    clearTimeout(alertar.t);
    alertar.t = setTimeout(() => { ui.banner.hidden = true; }, 20000);
    // v3.1.0: avisa a barra de abas (selo na aba Manobras)
    document.dispatchEvent(new CustomEvent('saam:alerta', { detail: { tipo, teste: texto === 'teste de som' } }));
  }

  function abrirPainel() {
    if (!ui.panel || ui.panel.open) return;
    ui.panel.dataset.auto = '1';
    ui.panel.open = true;
  }

  /* ---------- 3. Formatação ---------- */
  const TZ = 'America/Recife';
  const hora = (d) => new Date(d).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const dia = (d) => {
    const s = new Date(d).toLocaleDateString('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: '2-digit' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const MNB = { EA: 'Entrada', DS: 'Desatracação', DA: 'Mudança' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ha = (d) => {
    const min = Math.round((Date.now() - new Date(d)) / 60000);
    return min < 1 ? 'agora' : min < 60 ? `há ${min} min` : `há ${Math.round(min / 60)} h`;
  };

  /* ---------- 4. Renderização ---------- */
  function render(d) {
    // Status do coletor
    const s = d.sync || {};
    const velho = s.lido_em && Date.now() - new Date(s.lido_em) > 10 * 60000;
    ui.sync.textContent = s.lido_em
      ? `${s.ok && !velho ? '🟢' : '🟠'} Planilha lida ${ha(s.lido_em)}${s.ok ? '' : ' · falha: ' + (s.mensagem || '')}`
      : 'Aguardando a primeira leitura da planilha…';

    // Manobras agrupadas por dia
    ui.list.replaceChildren();
    const ms = d.manobras || [];
    if (ui.resumo) ui.resumo.textContent = `${ms.length} manobra${ms.length === 1 ? '' : 's'}`;
    if (!ms.length) {
      ui.list.innerHTML = '<p class="saam-vazio">Nenhuma manobra SAAM programada nas próximas horas.</p>';
    }
    let diaAtual = '';
    ms.forEach((m) => {
      const dd = dia(m.pob);
      if (dd !== diaAtual) {
        diaAtual = dd;
        const h = document.createElement('h3');
        h.className = 'saam-dia'; h.textContent = dd;
        ui.list.append(h);
      }
      const local = m.mnb === 'DS' ? m.de_local : m.mnb === 'EA' ? m.para_local : [m.de_local, m.para_local].filter(Boolean).join(' → ');
      const sit = (m.situacao || '').toLowerCase().replace(/\s+/g, '-');
      const el = document.createElement('article');
      el.className = 'saam-item sit-' + sit;
      el.innerHTML =
        `<div class="saam-hora">${hora(m.pob)}</div>`
        + `<div class="saam-corpo">`
        + `<div class="saam-navio">${esc(m.navio)}</div>`
        + `<div class="saam-linha"><span class="saam-mnb mnb-${esc(m.mnb)}">${esc(MNB[m.mnb] || m.mnb || '')}</span>`
        + `<span class="saam-sit">${esc(m.situacao)}</span>`
        + (local ? `<span>📍 ${esc(local)}</span>` : '')
        + (m.calado ? `<span>⚓ ${String(m.calado).replace('.', ',')} m</span>` : '') + `</div>`
        + `<div class="saam-linha saam-rbq">${m.rebocadores && m.rebocadores.length ? '🚢 ' + m.rebocadores.map(esc).join(' · ') : `🚢 ${m.n_rebocadores || '?'} rebocador(es) · a designar`}</div>`
        + (m.obs ? `<div class="saam-obs">${esc(m.obs)}</div>` : '')
        + `</div>`;
      ui.list.append(el);
    });

    // Eventos recentes
    ui.events.replaceChildren();
    (d.eventos || []).slice(0, 12).forEach((e) => {
      const li = document.createElement('li');
      li.className = 'saam-ev is-' + e.tipo.toLowerCase();
      li.innerHTML = `<span>${ICONE[e.tipo]} <b>${esc(e.tipo)}</b> · ${esc(e.navio)} (${esc(MNB[e.mnb] || e.mnb || '')})</span>`
        + `<small>${esc(e.detalhe || '')} · ${ha(e.criado_em)}</small>`;
      ui.events.append(li);
    });
    if (!ui.events.children.length) ui.events.innerHTML = '<li class="saam-vazio">Sem alertas nas últimas 48 h.</li>';
  }

  /* ---------- 5. Ciclo de atualização ---------- */
  async function atualizar(silencioso) {
    if (!pin) return;
    try {
      const d = await rpc('saam_programacao', { p_pin: pin });
      if (d.erro) { sair(d.erro); return; }
      vapidKey = d.vapid_public;
      // Eventos novos desde a última vez (na 1ª carga só marca, sem tocar)
      const novos = (d.eventos || []).filter((e) => e.id > ultimo).sort((a, b) => a.id - b.id);
      if (novos.length) {
        if (carregado && !silencioso) {
          novos.forEach((e, i) => setTimeout(() => alertar(e.tipo, `${e.navio} · ${e.detalhe || ''}`), i * 3500));
        }
        ultimo = novos[novos.length - 1].id;
        store.set(LS.ultimo, String(ultimo));
      }
      carregado = true;
      render(d);
      mostrar(true);
    } catch (e) {
      ui.sync.textContent = '🟠 Sem conexão com a programação. Tentando de novo…';
    }
  }

  function agendar() {
    clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden) atualizar(false); }, POLL_MS);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && pin) atualizar(false); });

  /* ---------- 6. PIN ---------- */
  function mostrar(aberto) {
    ui.lock.hidden = aberto;
    ui.main.hidden = !aberto;
    if (ui.resumo && !aberto) ui.resumo.textContent = '🔒 PIN';
  }
  // v3.9.1: avisar=false quando o pedido veio do outro card (evita eco)
  function sair(motivo, avisar = true) {
    pin = null; store.del(LS.pin); clearInterval(timer);
    mostrar(false);
    ui.msg.textContent = motivo || '';
    if (avisar) document.dispatchEvent(new CustomEvent('saam:bloqueio', { detail: { origem: 'suape', motivo } }));
  }
  ui.form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const p = ui.pin.value.trim();
    if (!/^\d{4,8}$/.test(p)) { ui.msg.textContent = 'Digite o PIN numérico da tripulação.'; return; }
    ui.msg.textContent = 'Verificando…';
    try {
      const d = await rpc('saam_programacao', { p_pin: p });
      if (d.erro) { ui.msg.textContent = 'PIN incorreto.'; return; }
      pin = p; store.set(LS.pin, p); ui.pin.value = ''; ui.msg.textContent = '';
      document.dispatchEvent(new CustomEvent('saam:pin', { detail: { origem: 'suape', pin: p } }));
      ultimo = Math.max(ultimo, ...(d.eventos || []).map((e) => e.id), 0);
      store.set(LS.ultimo, String(ultimo));
      vapidKey = d.vapid_public;
      carregado = true;
      render(d); mostrar(true); agendar(); estadoAlertas();
    } catch (e) { ui.msg.textContent = 'Sem conexão. Tente novamente.'; }
  });
  ui.sair.addEventListener('click', () => sair('Programação bloqueada neste aparelho.'));

  /* ---------- 7. Alertas: som + push ---------- */
  const b64 = (s) => {
    const p = '='.repeat((4 - (s.length % 4)) % 4);
    const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  };
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const instalado = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  function estadoAlertas() {
    const ativo = store.get(LS.alertas) === '1';
    ui.alertBtn.textContent = ativo ? '🔔 Alertas ativos' : '🔕 Ativar alertas';
    ui.alertBtn.classList.toggle('is-on', ativo);
    let info = 'Com o app aberto: som próprio para cada alerta.';
    if (!('PushManager' in window) || !('Notification' in window)) {
      info += ios && !instalado
        ? ' Para alertas com a tela apagada no iPhone, instale o app na tela de início (Compartilhar → Adicionar à Tela de Início).'
        : ' Este navegador não recebe notificações com o app fechado.';
    } else if (Notification.permission === 'denied') {
      info += ' Notificações bloqueadas: libere nas configurações do navegador para receber com a tela apagada.';
    } else if (ativo) {
      info += ' Com a tela apagada: notificação com vibração diferente por tipo.';
    }
    ui.alertInfo.textContent = info;
  }

  ui.alertBtn.addEventListener('click', async () => {
    audio();                              // destrava o áudio com o toque
    SONS.CONFIRMADA();
    store.set(LS.alertas, '1');
    try {
      if ('PushManager' in window && 'Notification' in window && vapidKey) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          const reg = await navigator.serviceWorker.ready;
          let sub = await reg.pushManager.getSubscription();
          if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(vapidKey) });
          const j = sub.toJSON();
          await rpc('saam_push_registrar', { p_pin: pin, p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
        }
      }
    } catch (e) { console.warn('[TugLife] push:', e.message); }
    estadoAlertas();
  });

  ui.tests.addEventListener('click', (ev) => {
    const tipo = ev.target && ev.target.dataset && ev.target.dataset.teste;
    if (tipo) alertar(tipo, 'teste de som');
  });

  // Push recebido pelo service worker com o app aberto → toca o som também
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (ev) => {
      const m = ev.data || {};
      if (m.type !== 'saam-push') return;
      if (m.id && m.id <= ultimo) return;           // já tocado pelo ciclo de atualização
      if (m.id) { ultimo = m.id; store.set(LS.ultimo, String(ultimo)); }
      alertar(m.tipo, m.corpo || '');
      atualizar(true);
    });
  }

  // v3.9.1: PIN digitado no card do Rio destrava Suape (e vice-versa)
  document.addEventListener('saam:pin', (ev) => {
    if (ev.detail.origem === 'suape' || pin) return;
    pin = ev.detail.pin; ui.msg.textContent = '';
    mostrar(true); atualizar(true); agendar(); estadoAlertas();
  });
  document.addEventListener('saam:bloqueio', (ev) => {
    if (ev.detail.origem !== 'suape' && pin) sair(ev.detail.motivo, false);
  });

  /* ---------- 8. Painel recolhível (v3.9.1) ----------
     Abertura automática (alerta ou clique na notificação #card-saam)
     não conta como escolha do tripulante: não é gravada.
     Estado lembrado em tuglife_paineis = {"saam-panel":true,…}.
     Sem escolha salva: aberto só em tela larga (> 760 px). */
  if (ui.panel) {
    let mem = {};
    try { mem = JSON.parse(store.get(LS.paineis) || '{}') || {}; } catch (e) { mem = {}; }
    if ('saam-panel' in mem ? mem['saam-panel'] : !window.matchMedia('(max-width: 760px)').matches) abrirPainel();
    ui.panel.addEventListener('toggle', () => {
      if (ui.panel.dataset.auto) { delete ui.panel.dataset.auto; return; }
      let m = {};
      try { m = JSON.parse(store.get(LS.paineis) || '{}') || {}; } catch (e) { m = {}; }
      m['saam-panel'] = ui.panel.open;
      store.set(LS.paineis, JSON.stringify(m));
    });
  }

  window.addEventListener('hashchange', () => { if (location.hash === '#card-saam') abrirPainel(); });
  if (location.hash === '#card-saam') abrirPainel();

  /* ---------- 9. Partida ---------- */
  card.hidden = false;
  if (pin) { mostrar(true); atualizar(true); agendar(); estadoAlertas(); }
  else mostrar(false);
  // v3.1.0: o link #card-saam (clique na notificação) é tratado por tabs.js
});

/* ============================================================
   TugLife FM — Navegação por abas (layout B · "tela única")
   ------------------------------------------------------------
   Arquivo   : tabs.js
   Versão    : 3.2.0 (SPRINT 20)
   Data/Hora : 2026-10-12T17:00:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   HISTÓRICO DE MODIFICAÇÕES
   v3.2.0  [NOVO] window.TugTabs.abrir(aba) para o Manual de bordo
                  ("Abrir a aba …") e o tour guiado (manual.js).
   v3.1.0  [NOVO] Barra inferior Rádio | Maré | Manobras | Portos.
           [NOVO] Selo laranja na aba Manobras a cada alerta SAAM
                  recebido enquanto o usuário está em outra aba.
           [NOVO] Link #card-saam (clique na notificação push) abre
                  direto a aba Manobras.
           [NOVO] Aba Portos abre o Painel do Marujo e só então
                  carrega o mapa (economia de dados a bordo).
   ------------------------------------------------------------
   COMO FUNCIONA
   Cada bloco do app tem data-tab="radio|mare|manobras|portos".
   Este script apenas grava a aba ativa em <body data-aba="…">;
   quem esconde/mostra é o CSS (refresh.css, SPRINT 19), e SOMENTE
   no celular (largura ≤ 760 px). No computador todos os cards
   continuam visíveis na grade — a barra fica oculta.

   Analogia ASD: é o seletor de estação de comando do rebocador.
   O casco (o app) é o mesmo; a manete só transfere o controle
   para o posto que interessa naquele momento — proa, popa ou
   passadiço — sem desmontar nada. Aqui, nenhum card é recriado:
   os scripts de maré, SAAM e ouvintes seguem rodando por baixo.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const bar = document.getElementById('tabbar');
  if (!bar) return;
  const ABAS = ['radio', 'mare', 'manobras', 'portos'];
  const KEY = 'tuglife_aba';
  const badge = document.getElementById('tab-badge');
  const shell = document.querySelector('.app-shell');
  const celular = window.matchMedia('(max-width: 760px)');
  let pendentes = 0;   // alertas SAAM não vistos

  const store = {
    get: () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    set: (v) => { try { localStorage.setItem(KEY, v); } catch (e) { /* modo anônimo */ } }
  };

  function selo() {
    badge.hidden = pendentes === 0;
    badge.textContent = pendentes > 9 ? '9+' : String(pendentes);
  }

  function abrir(aba, { salvar = true } = {}) {
    if (!ABAS.includes(aba)) aba = 'radio';
    document.body.dataset.aba = aba;
    bar.querySelectorAll('[data-aba]').forEach((b) => {
      const on = b.dataset.aba === aba;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.classList.toggle('is-active', on);
    });
    if (aba === 'manobras') { pendentes = 0; selo(); }
    if (aba === 'portos') {
      // abrir o <details> dispara o 'toggle' que carrega o mapa (index.html)
      const painel = document.getElementById('mariner-panel');
      if (painel && !painel.open) painel.open = true;
    }
    if (salvar) store.set(aba);
    if (shell) shell.scrollTop = 0;
    // A curva da maré mede a largura do card; escondido ele mede 0.
    // Um 'resize' sintético faz tides.js redesenhar na largura real.
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }

  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-aba]');
    if (b) abrir(b.dataset.aba);
  });

  // Alerta SAAM fora da aba Manobras (ou no computador) → acende o selo
  document.addEventListener('saam:alerta', (e) => {
    if (e.detail && e.detail.teste) return;
    if (celular.matches && document.body.dataset.aba === 'manobras') return;
    pendentes += 1; selo();
  });

  function pelaHash() {
    if (location.hash !== '#card-saam') return false;
    abrir('manobras', { salvar: false });
    if (!celular.matches) {
      const card = document.getElementById('card-saam');
      if (card) card.scrollIntoView({ behavior: 'smooth' });
    }
    return true;
  }
  window.addEventListener('hashchange', pelaHash);
  window.TugTabs = { abrir };   // v3.2.0: usado por manual.js

  if (!pelaHash()) abrir(store.get() || 'radio', { salvar: false });
});

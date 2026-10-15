/* ============================================================
   TugLife FM — "Programação SAAM · Rio de Janeiro"
   ------------------------------------------------------------
   Arquivo   : saam-rj.js
   Versão    : 3.9.0 (SPRINT 27)
   Data/Hora : 2026-10-15T16:40:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   HISTÓRICO DE MODIFICAÇÕES
   v3.9.0  [NOVO] Card público (sem PIN) na aba Manobras com as
           manobras da SAAM (coluna EMP.RB = "SAA") nos portos do Rio
           de Janeiro, lidas da página da Praticagem RJ pela Edge
           Function saam-rj (Supabase), que faz a ponte CORS e guarda
           a leitura por 60 s.
           [NOVO] Filtro por área (Baía de Guanabara, Baía de Sepetiba,
           Porto do Forno, Porto do Açu…), lembrado no aparelho.
           [NOVO] Rebocadores escalados com tração estática (t), fainas
           e o aviso da praticagem quando o mesmo rebocador está em
           outra manobra.
   ------------------------------------------------------------
   QUANDO BUSCA (economia de dados a bordo)
   Um "relógio de quarto" bate a cada TICK_MS = 30 s e só busca se:
       card visível  E  app em primeiro plano  E  idade ≥ IDADE_MS (2 min)
   Como o servidor guarda a página por 60 s, 2 min no aparelho é o
   ponto de equilíbrio: dado com no máximo ~3 min de atraso e nenhum
   acesso enquanto o tripulante está em outra aba ou com a tela apagada.
   Voltar ao app ou abrir a aba Manobras (tabs.js dispara 'resize')
   adianta a busca na hora, se a última tiver mais de 2 min.

   HORA
   O servidor devolve o POB em UTC (ISO). Aqui é mostrado no fuso
   America/Sao_Paulo — o do Rio — independente do fuso do celular
   (um tripulante de Suape vendo o Rio vê a hora do Rio).
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const URL_API = 'https://udedhipgekgonnioofgk.supabase.co/functions/v1/saam-rj';
  const TICK_MS = 30000;
  const IDADE_MS = 120000;
  const LS_AREA = 'tuglife_saamrj_area';
  const TZ = 'America/Sao_Paulo';

  const $ = (id) => document.getElementById(id);
  const card = $('card-saam-rj');
  if (!card) return;
  const ui = { sync: $('saamrj-sync'), areas: $('saamrj-areas'), barra: $('saamrj-barra'), list: $('saamrj-list') };

  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* modo anônimo */ } }
  };

  let dados = null;          // última resposta boa
  let buscadoEm = 0;         // quando o aparelho buscou pela última vez
  let buscando = false;
  let areaSel = store.get(LS_AREA) || 'TODAS';

  /* ---------- 1. Formatação ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hora = (d) => new Date(d).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const dia = (d) => {
    const s = new Date(d).toLocaleDateString('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: '2-digit' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const ha = (d) => {
    const min = Math.round((Date.now() - new Date(d)) / 60000);
    return min < 1 ? 'agora' : min < 60 ? `há ${min} min` : `há ${Math.round(min / 60)} h`;
  };
  // "BAÍA DE GUANABARA" → "Baía de Guanabara" (preposições em minúsculas)
  const titulo = (s) => String(s).toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (m, a, l) => a + l.toUpperCase())
    .replace(/\s(De|Do|Da|Dos|Das|E)\s/g, (m) => m.toLowerCase());
  const dec = (n, c = 2) => (n == null ? '' : n.toLocaleString('pt-BR', { maximumFractionDigits: c }));
  const BORDO = { BB: 'BB', BE: 'BE' };
  // Local da manobra: Entrada → destino; Saída → origem; Mudança → origem → destino
  const lugar = (nome, bordo) => nome ? esc(nome) + (BORDO[bordo] ? ` <small>(${bordo})</small>` : '') : '';
  const local = (m) => m.tipo === 'S' ? lugar(m.de, m.de_bordo)
    : m.tipo === 'E' ? lugar(m.para, m.para_bordo)
    : [lugar(m.de, m.de_bordo), lugar(m.para, m.para_bordo)].filter(Boolean).join(' → ');

  /* ---------- 2. Renderização ---------- */
  function renderAreas() {
    const nomes = (dados && dados.areas || []).map((a) => a.area);
    if (areaSel !== 'TODAS' && !nomes.includes(areaSel)) areaSel = 'TODAS';
    ui.areas.replaceChildren();
    ['TODAS', ...nomes].forEach((nome) => {
      const a = dados && dados.areas.find((x) => x.area === nome);
      const n = nome === 'TODAS' ? dados.total : a.manobras.length;
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.area = nome;
      b.className = 'saamrj-area' + (nome === areaSel ? ' is-on' : '');
      b.setAttribute('aria-pressed', nome === areaSel ? 'true' : 'false');
      b.textContent = `${nome === 'TODAS' ? 'Todas' : titulo(nome)} · ${n}`;
      ui.areas.append(b);
    });
  }

  function render() {
    if (!dados) return;
    renderAreas();
    const areas = dados.areas.filter((a) => areaSel === 'TODAS' || a.area === areaSel);

    // Situação da barra (só quando uma área está escolhida, ou se alguma estiver fechada)
    const barras = areas.filter((a) => a.barra && (areaSel !== 'TODAS' || !/ABERTA/i.test(a.barra)));
    ui.barra.innerHTML = barras.map((a) => `<span class="${/FECHAD/i.test(a.barra) ? 'is-fechada' : ''}">⚓ ${esc(titulo(a.area))}: ${esc(a.barra.toLowerCase())}</span>`).join('');
    ui.barra.hidden = !barras.length;

    const ms = areas.flatMap((a) => a.manobras).filter((m) => m.pob)
      .sort((a, b) => new Date(a.pob) - new Date(b.pob));
    ui.list.replaceChildren();
    if (!ms.length) {
      ui.list.innerHTML = '<p class="saam-vazio">Nenhuma manobra SAAM programada pela Praticagem RJ' + (areaSel === 'TODAS' ? '' : ' nesta área') + '.</p>';
      return;
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
      const passou = Date.now() - new Date(m.pob) > 60 * 60000;     // POB há mais de 1 h
      const rbs = (m.rebocadores || []).map((r) =>
        `<span class="saamrj-rb${r.aviso ? ' is-aviso' : ''}"${r.aviso ? ` title="${esc(r.aviso)}"` : ''}>`
        + `${r.aviso ? '⚠️ ' : ''}${esc(r.nome)}${r.bp ? ` <small>${dec(r.bp, 1)} t</small>` : ''}`
        + `${r.fainas && r.fainas.length ? ` <small class="saamrj-fainas">${r.fainas.map(esc).join('·')}</small>` : ''}</span>`).join('');
      const avisos = (m.rebocadores || []).filter((r) => r.aviso).map((r) => `${r.nome}: ${r.aviso.replace(/^Atenção!\s*/i, '')}`);
      const el = document.createElement('article');
      el.className = 'saam-item saamrj-tipo-' + esc(m.tipo) + (passou ? ' is-passada' : '');
      el.innerHTML =
        `<div class="saam-hora">${hora(m.pob)}</div>`
        + `<div class="saam-corpo">`
        + `<div class="saam-navio">${esc(m.navio)}</div>`
        + `<div class="saam-linha"><span class="saam-mnb saamrj-mnb-${esc(m.tipo)}">${esc(m.tipo_nome)}</span>`
        + (areaSel === 'TODAS' ? `<span class="saam-sit">${esc(titulo(m.area))}</span>` : '')
        + (local(m) ? `<span>📍 ${local(m)}</span>` : '') + `</div>`
        + `<div class="saam-linha">`
        + (m.calado ? `<span>⚓ ${dec(m.calado)} m</span>` : '')
        + (m.loa ? `<span>↔ ${dec(m.loa, 1)} m</span>` : '')
        + (m.agencia ? `<span>🏢 ${esc(m.agencia)}</span>` : '') + `</div>`
        + `<div class="saam-linha saam-rbq">${rbs ? '🚢 ' + rbs : '🚢 rebocadores a designar'}</div>`
        + (m.obs ? `<div class="saam-obs">${esc(m.obs)}</div>` : '')
        + avisos.map((a) => `<div class="saam-obs">⚠️ ${esc(a)}</div>`).join('')
        + `</div>`;
      ui.list.append(el);
    });
  }

  function renderSync() {
    if (!dados) return;
    const velho = Date.now() - new Date(dados.lido_em) > 10 * 60000;
    ui.sync.textContent = `${dados.ok && !velho ? '🟢' : '🟠'} Praticagem RJ lida ${ha(dados.lido_em)}`
      + (dados.ok ? '' : ' · site fora do ar, mostrando a última leitura');
  }

  /* ---------- 3. Busca ---------- */
  const visivel = () => card.offsetParent !== null && !document.hidden;

  async function buscar(forcar) {
    if (buscando || (!forcar && (!visivel() || Date.now() - buscadoEm < IDADE_MS))) return;
    buscando = true;
    buscadoEm = Date.now();
    try {
      const r = await fetch(URL_API, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok || !d.areas) throw new Error(d.mensagem || 'HTTP ' + r.status);
      dados = d;
      render();
      renderSync();
    } catch (e) {
      ui.sync.textContent = dados
        ? `🟠 Sem conexão com a Praticagem RJ. Última leitura ${ha(dados.lido_em)}.`
        : '🟠 Sem conexão com a Praticagem RJ. Tentando de novo…';
      buscadoEm = Date.now() - IDADE_MS + 30000;   // nova tentativa em ~30 s
    } finally {
      buscando = false;
    }
  }

  ui.areas.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-area]');
    if (!b) return;
    areaSel = b.dataset.area;
    store.set(LS_AREA, areaSel);
    render();
  });

  setInterval(() => { buscar(false); renderSync(); }, TICK_MS);
  document.addEventListener('visibilitychange', () => buscar(false));
  window.addEventListener('resize', () => buscar(false));   // troca de aba (tabs.js)

  /* ---------- 4. Partida ---------- */
  card.hidden = false;
  ui.sync.textContent = 'Lendo a programação da Praticagem RJ…';
  // 1ª leitura só quando o card estiver à vista (abre na aba Manobras)
  requestAnimationFrame(() => buscar(false));
});

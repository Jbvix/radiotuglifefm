/* ============================================================
   TugLife FM — Manual de bordo (botão ?) e Tour guiado
   ------------------------------------------------------------
   Arquivo   : manual.js
   Versão    : 3.7.0 (SPRINT 25)
   Data/Hora : 2026-10-15T01:30:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   HISTÓRICO DE MODIFICAÇÕES
   v3.7.0  [MOD] Itens "Faixa atual", "Instalar" e "Compartilhar" dizem onde estão
                 agora (player e painel "Mais da TugLife"); novidade da v3.7.0.
           [MOD] "Instalar na tela inicial" do manual abre a aba Rádio e o painel.
   v3.6.0  [MOD] Item "Nível medido (6 portos)" e novidade da v3.6.0.
   v3.5.0  [MOD] Item "Nível medido (Rio Grande e Suape)" e novidade da v3.5.0.
   v3.4.0  [NOVO] Item "Nível medido (Rio Grande)" e novidade da v3.4.0.
   v3.3.0  [MOD] Item "Grade semanal" descreve o painel recolhível.
           [NOVO] tourVersao separado de versao: o tour só volta a
                  aparecer quando tourVersao mudar (funcionalidade nova
                  que mereça o passeio), não a cada ajuste de texto.
   v3.2.0  [NOVO] Botão ? no cabeçalho abre o "Manual de bordo":
                  novidades da versão + funcionalidades por seção
                  (Rádio, Maré, Manobras, Portos, App) em sanfona,
                  com atalho "Abrir a aba …".
           [NOVO] Tour guiado de 6 passos com destaque, exibido
                  sozinho na 1ª abertura após cada atualização
                  (só no celular) e sob demanda em "Rever o tour".
           [NOVO] Link direto #manual abre o manual.
   ------------------------------------------------------------
   FONTE ÚNICA DE VERDADE
   O objeto MANUAL abaixo alimenta TRÊS coisas: a folha do app,
   o tour e a seção "Como usar" do README.md (gerada por
   tools/manual/gerar-readme.mjs). Mudou uma funcionalidade?
   Edite só aqui — como uma tabela de calibração única que
   alimenta todos os instrumentos do passadiço.

   COMO O DESTAQUE DO TOUR É DESENHADO
   Um retângulo com borda posicionado sobre o alvo e uma sombra
   gigante (box-shadow: 0 0 0 200vmax) que escurece todo o resto.
   Posição = getBoundingClientRect() do alvo, recalculada a cada
   passo e a cada resize. A caixa de texto vai para cima ou para
   baixo do alvo — para o lado onde houver mais espaço:
       espaçoAcima = alvo.top ; espaçoAbaixo = altura − alvo.bottom
   ============================================================ */

(function () {
  const MANUAL = {
    versao: '3.7.0',
    tourVersao: '3.2.0',   // mude só quando o tour precisar ser revisto pela tripulação
    novidades: [
      { versao: '3.7.0', texto: 'Aba Rádio numa tela só: faixa atual no player e o resto em "Mais da TugLife".' },
      { versao: '3.6.0', texto: 'Nível do mar medido ao vivo também em Pecém, Rio de Janeiro, Paranaguá e Salvador.' },
      { versao: '3.5.0', texto: 'Suape com nível do mar medido ao vivo: média dos marégrafos de Recife e Tamandaré.' },
      { versao: '3.4.0', texto: 'Rio Grande com nível do mar medido ao vivo (SiMCosta/FURG) e maré meteorológica.' },
      { versao: '3.3.0', texto: 'Grade da semana recolhida na aba Rádio: o essencial cabe numa tela só.' },
      { versao: '3.2.0', texto: 'Botão ? com este manual e tour guiado na primeira abertura.' },
      { versao: '3.1.0', texto: 'App em abas no celular, selo de alerta em Manobras e mapa só ao abrir Portos.' }
    ],
    secoes: [
      { id: 'radio', label: 'Rádio', aba: 'radio', resumo: 'Ouvir a TugLife FM e acompanhar a programação.', itens: [
        ['Ouvir ao vivo', 'Toque no botão grande da aba Rádio. Nas outras abas, use a faixa ao vivo logo acima da barra de abas.'],
        ['No ar agora e próximo', 'Mostra o programa da grade neste momento, quanto falta para acabar e o que vem em seguida.'],
        ['Grade semanal', 'Toque em "Grade da semana" para abrir. Escolha o dia; "Hoje" volta para o dia atual. Funciona mesmo sem internet.'],
        ['Faixa atual', 'Nome da música que está tocando (♪), logo abaixo do programa no ar. Atualiza sozinho.'],
        ['Tripulação a bordo', 'Quantos ouvintes estão conectados agora e o pico do dia.']
      ]},
      { id: 'mare', label: 'Maré', aba: 'mare', resumo: 'Previsão de maré de 13 portos, calibrada com a DHN 2026.', itens: [
        ['Porto e dia', 'Escolha um dos 13 portos. As setas mudam o dia; "Hoje" volta para a data atual.'],
        ['Agora e tendência', 'Altura estimada neste instante e se a maré está enchendo ou vazando.'],
        ['Curva de 24 horas', 'A linha laranja marca o agora; os pontos marcam preamares e baixa-mares.'],
        ['Nível medido (6 portos)', 'Faixa verde "Ao vivo": nível real do mar, atualizado a cada 5 min, e a maré meteorológica — quanto o vento põe a água acima ou abaixo da previsão (laranja a partir de 15 cm). Em Rio Grande, Suape, Pecém, Rio de Janeiro, Paranaguá e Salvador. Suape usa a média de Recife e Tamandaré, com horário corrigido; se um sair do ar, segue com o outro. Linha verde no gráfico = medido.'],
        ['Selo de calibração', 'Mostra o erro típico contra a Tábua DHN 2026. Informativo: não substitui a DHN na navegação.']
      ]},
      { id: 'manobras', label: 'Manobras', aba: 'manobras', resumo: 'Programação SAAM em Suape, exclusiva da tripulação.', itens: [
        ['Acesso por PIN', 'Digite o PIN da tripulação. Ele fica lembrado no aparelho; "Bloquear neste aparelho" apaga.'],
        ['Lista de manobras', 'Agrupada por dia: hora, navio, tipo, situação, berço, calado e rebocadores.'],
        ['Três alertas sonoros', 'Confirmada: ding-dong subindo. Cancelada: dois tons descendo. Antecipada: bipes rápidos e repetidos.'],
        ['Ativar alertas', 'Libera o som e a notificação com a tela apagada. Use os botões de teste para ouvir cada som.'],
        ['Selo laranja', 'Na barra de abas, conta os alertas que chegaram enquanto você estava em outra aba.']
      ]},
      { id: 'portos', label: 'Portos', aba: 'portos', resumo: 'Painel do Marujo: tráfego e clima por porto.', itens: [
        ['Mapa marítimo', 'Navios em tempo real (AIS) no porto escolhido.'],
        ['Clima', 'Vento em nós e previsão sobre o mesmo porto.'],
        ['Trocar de porto', 'Deslize a fileira de portos e toque no desejado.']
      ]},
      { id: 'app', label: 'App', aba: null, resumo: 'Instalação, compartilhamento e ajustes.', itens: [
        ['Instalar na tela inicial', 'Na aba Rádio, abra "Mais da TugLife" e toque em Instalar app. Abre como aplicativo, em tela cheia, e recebe as notificações de manobra.'],
        ['Compartilhar e QR Code', 'Em "Mais da TugLife" (aba Rádio): envie o link da rádio ou mostre o QR Code para outro tripulante. Lá também ficam a TugLife Store, o Deezer e a Alexa.'],
        ['Tema claro e escuro', 'Botão da lua no topo. O claro ajuda sob sol forte no convés.'],
        ['Como atualizar', 'Feche e reabra o app duas vezes. Não precisa desinstalar.'],
        ['Sem internet', 'Grade, maré e este manual continuam disponíveis; a rádio precisa de conexão.']
      ]}
    ],
    // Tour: cada passo tenta os alvos em ordem e usa o primeiro visível
    // (celular → botões da barra; computador → o card correspondente).
    tour: [
      { titulo: 'Rádio', alvos: ['.tabbar [data-aba="radio"]', '#card-player'], texto: 'Ouça a TugLife FM, veja o programa no ar e a grade da semana.' },
      { titulo: 'Ouvir ao vivo', alvos: ['#btn-play'], aba: 'radio', texto: 'Toque aqui para ouvir. Nas outras abas, o play continua na faixa ao vivo acima da barra.' },
      { titulo: 'Maré', alvos: ['.tabbar [data-aba="mare"]', '#card-mare'], texto: 'Previsão de 13 portos calibrada com a DHN: agora, curva do dia, preamares e baixa-mares.' },
      { titulo: 'Manobras SAAM', alvos: ['.tabbar [data-aba="manobras"]', '#card-saam'], texto: 'Programação de Suape com PIN da tripulação e 3 alertas sonoros. O selo laranja conta alertas novos.' },
      { titulo: 'Portos', alvos: ['.tabbar [data-aba="portos"]', '#card-mapa'], texto: 'Painel do Marujo: tráfego de navios e clima por porto.' },
      { titulo: 'Manual de bordo', alvos: ['#help-btn'], texto: 'Ficou alguma dúvida? Toque no ? a qualquer momento para ver tudo o que o app faz.' }
    ]
  };

  // Exposto para o gerador do README (Node) e para depuração.
  if (typeof module !== 'undefined' && module.exports) { module.exports = MANUAL; return; }
  window.TUG_MANUAL = MANUAL;

  const KEY_TOUR = 'tuglife_tour_visto';
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* modo anônimo */ } }
  };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  document.addEventListener('DOMContentLoaded', () => {
    const dlg = document.getElementById('manual-dialog');
    const btn = document.getElementById('help-btn');
    if (!dlg || !btn) return;
    const ui = {
      novidades: document.getElementById('manual-novidades'),
      chips: document.getElementById('manual-chips'),
      resumo: document.getElementById('manual-resumo'),
      lista: document.getElementById('manual-lista'),
      ir: document.getElementById('manual-ir'),
      tour: document.getElementById('manual-tour')
    };
    let secao = 'radio';

    /* ---------- 1. Manual ---------- */
    const nov = MANUAL.novidades[0];
    ui.novidades.replaceChildren(el('b', null, `Novidades da v${nov.versao}`), el('span', null, nov.texto));

    MANUAL.secoes.forEach((s) => {
      const c = el('button', 'manual-chip', s.label);
      c.type = 'button'; c.dataset.secao = s.id;
      c.addEventListener('click', () => mostrar(s.id));
      ui.chips.appendChild(c);
    });

    function mostrar(id) {
      secao = id;
      const s = MANUAL.secoes.find((x) => x.id === id) || MANUAL.secoes[0];
      ui.chips.querySelectorAll('.manual-chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.secao === s.id ? 'true' : 'false'));
      ui.resumo.textContent = s.resumo;
      ui.lista.replaceChildren(...s.itens.map(([titulo, texto]) => {
        // <details> nativo = sanfona acessível sem JavaScript extra
        const d = el('details', 'manual-item');
        d.dataset.secao = s.id;
        d.append(el('summary', null, titulo), el('p', null, texto));
        return d;
      }));
      ui.ir.textContent = s.aba ? `Abrir a aba ${s.label}` : 'Instalar na tela inicial';
    }

    function abrirManual() {
      // abre na seção da aba em que o usuário está (contexto primeiro)
      const aba = document.body.dataset.aba;
      mostrar(MANUAL.secoes.some((s) => s.id === aba) ? aba : 'radio');
      if (!dlg.open) dlg.showModal();
    }

    btn.addEventListener('click', abrirManual);
    ui.ir.addEventListener('click', () => {
      const s = MANUAL.secoes.find((x) => x.id === secao);
      dlg.close();
      if (s && s.aba) { if (window.TugTabs) window.TugTabs.abrir(s.aba); }
      else {
        // v3.7.0: o botão mora no painel "Mais da TugLife"; abre a aba Rádio e o painel antes
        if (window.TugTabs) window.TugTabs.abrir('radio');
        const mais = document.getElementById('more-panel'); if (mais) mais.open = true;
        const inst = document.getElementById('install-app'); if (inst) inst.click();
      }
    });
    ui.tour.addEventListener('click', () => { dlg.close(); iniciarTour(); });
    if (location.hash === '#manual') abrirManual();
    window.addEventListener('hashchange', () => { if (location.hash === '#manual') abrirManual(); });

    /* ---------- 2. Tour guiado ---------- */
    const camada = el('div', 'tour-camada'); camada.hidden = true;
    const foco = el('div', 'tour-foco'); foco.setAttribute('aria-hidden', 'true');
    const caixa = el('section', 'tour-caixa');
    caixa.setAttribute('role', 'dialog'); caixa.setAttribute('aria-modal', 'true'); caixa.setAttribute('aria-labelledby', 'tour-titulo');
    const passo = el('span', 'tour-passo');
    const titulo = el('h2', null); titulo.id = 'tour-titulo';
    const texto = el('p', null);
    const acoes = el('div', 'tour-acoes');
    const bPular = el('button', 'tour-pular', 'Pular');
    const bVoltar = el('button', 'tour-voltar', 'Voltar');
    const bProx = el('button', 'tour-prox', 'Próximo');
    [bPular, bVoltar, bProx].forEach((b) => { b.type = 'button'; });
    acoes.append(bPular, el('span', 'tour-espaco'), bVoltar, bProx);
    caixa.append(passo, titulo, texto, acoes);
    camada.append(foco, caixa);
    document.body.appendChild(camada);

    let i = 0;
    const visivel = (e) => e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';

    function desenhar() {
      const p = MANUAL.tour[i];
      if (p.aba && window.TugTabs && window.matchMedia('(max-width: 760px)').matches) window.TugTabs.abrir(p.aba, { salvar: false });
      const alvo = p.alvos.map((s) => document.querySelector(s)).find(visivel);
      passo.textContent = `${i + 1} DE ${MANUAL.tour.length}`;
      titulo.textContent = p.titulo; texto.textContent = p.texto;
      bVoltar.disabled = i === 0;
      bProx.textContent = i === MANUAL.tour.length - 1 ? 'Começar' : 'Próximo';
      if (alvo) {
        alvo.scrollIntoView({ block: 'nearest' });
        const r = alvo.getBoundingClientRect(), m = 6;
        Object.assign(foco.style, { display: 'block', left: `${r.left - m}px`, top: `${r.top - m}px`, width: `${r.width + 2 * m}px`, height: `${r.height + 2 * m}px` });
        const acima = r.top, abaixo = innerHeight - r.bottom;
        caixa.style.top = abaixo >= acima ? `${Math.min(r.bottom + 16, innerHeight - caixa.offsetHeight - 12)}px` : `${Math.max(12, r.top - caixa.offsetHeight - 16)}px`;
      } else {
        foco.style.display = 'none';
        caixa.style.top = `${Math.max(12, (innerHeight - caixa.offsetHeight) / 2)}px`;
      }
      bProx.focus({ preventScroll: true });
    }

    function iniciarTour() {
      i = 0; camada.hidden = false; document.body.classList.add('tour-on');
      requestAnimationFrame(desenhar);
    }
    function fecharTour() {
      camada.hidden = true; document.body.classList.remove('tour-on');
      store.set(KEY_TOUR, MANUAL.tourVersao);
      if (window.TugTabs) window.TugTabs.abrir('radio');
    }
    bProx.addEventListener('click', () => { if (i < MANUAL.tour.length - 1) { i += 1; desenhar(); } else fecharTour(); });
    bVoltar.addEventListener('click', () => { if (i > 0) { i -= 1; desenhar(); } });
    bPular.addEventListener('click', fecharTour);
    camada.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharTour(); });
    window.addEventListener('resize', () => { if (!camada.hidden) desenhar(); });
    window.TugTour = { iniciar: iniciarTour };

    // 1ª abertura após atualizar: só no celular, sem atrapalhar quem
    // chegou pela notificação de manobra ou pelo link do manual.
    const novo = store.get(KEY_TOUR) !== MANUAL.tourVersao;
    if (novo && !location.hash && window.matchMedia('(max-width: 760px)').matches) setTimeout(iniciarTour, 1200);
  });
})();

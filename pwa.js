// SPRINTS 09–10 · Jossian Brito · Release date in VERSION.json.
// v3.7.0 (SPRINT 25) · 2026-10-15T01:30:00-03:00 · Jossian Brito
//   [MOD] Instalar/Compartilhar agora moram no painel recolhível
//         "Mais da TugLife" (#more-panel): fechado no celular para a
//         aba Rádio caber numa tela; aberto no computador. No celular,
//         ao abrir, a aba rola sozinha até os botões.
// v3.8.0 (SPRINT 26) · 2026-10-15T00:30:00-03:00 · Jossian Brito
//   [NOVO] Faixa "Nova versão disponível · Atualizar" (#update-bar).
//          Fim do "feche e reabra o app duas vezes": quando o sw.js
//          novo termina de instalar, a faixa aparece; o toque manda
//          SKIP_WAITING e a página recarrega já na versão nova.
//          - Procura versão nova ao abrir e ao voltar para o app
//            (no máximo a cada 30 min) — app aberto por horas a bordo
//            também recebe a atualização.
//          - Com a rádio tocando nada troca sozinho: a faixa avisa que
//            o áudio para por alguns segundos.
//          - "×" dispensa até a próxima abertura do app.
//          Só funciona a partir desta versão: quem está na 3.7.1 ainda
//          fecha e reabre uma última vez para chegar na 3.8.0.
document.addEventListener('DOMContentLoaded', () => {
  const mais = document.getElementById('more-panel');
  const celular = window.matchMedia('(max-width: 760px)');
  if (mais && !celular.matches) mais.open = true;
  // no celular, ao abrir, rola até o fim do painel (os botões nascem abaixo da dobra)
  if (mais) mais.addEventListener('toggle', () => {
    if (mais.open && celular.matches) requestAnimationFrame(() => mais.scrollIntoView({ block: 'end', behavior: 'smooth' }));
  });
  const publicUrl = 'https://radiotuglifefm.netlify.app/';
  const dialog = document.getElementById('share-dialog');
  const installDialog = document.getElementById('install-dialog');
  const status = document.getElementById('share-status');
  const install = document.getElementById('install-app');
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installPrompt = event;
  });
  const installed = () => {
    install.textContent = 'App instalado'; install.disabled = true;
    installPrompt = null;
    if (installDialog.open) installDialog.close();
  };
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) installed();
  window.addEventListener('appinstalled', installed);
  install.addEventListener('click', async () => {
    if (installPrompt) {
      const prompt = installPrompt; installPrompt = null;
      try {await prompt.prompt(); await prompt.userChoice;} catch {installDialog.showModal();}
    } else installDialog.showModal();
  });
  document.getElementById('share-radio').addEventListener('click', () => {
    status.textContent = ''; dialog.showModal();
  });
  document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  document.getElementById('copy-link').addEventListener('click', async () => {
    try {await navigator.clipboard.writeText(publicUrl);status.textContent = 'Link copiado!';}
    catch {document.getElementById('share-url').select();status.textContent = 'Selecione e copie o endereço abaixo.';}
  });
  const nativeShare = document.getElementById('native-share');
  nativeShare.hidden = !navigator.share;
  nativeShare.addEventListener('click', async () => {
    try {await navigator.share({title:'TugLife FM — O Som do Mar',text:'Ouça a TugLife FM!',url:publicUrl});}
    catch(error) {if (error.name !== 'AbortError') status.textContent = 'Compartilhamento indisponível. Use o QR Code ou copie o link.';}
  });
  const network = document.getElementById('network-status');
  function updateNetwork() {network.hidden = navigator.onLine;}
  window.addEventListener('online',updateNetwork); window.addEventListener('offline',updateNetwork); updateNetwork();
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./sw.js').then(vigiarAtualizacao).catch(() => {
      document.getElementById('install-note').textContent = 'Preparação offline indisponível neste navegador. Você pode continuar usando o site.';
    });
  }

  /* ---------- v3.8.0: aviso de nova versão ---------- */
  function vigiarAtualizacao(reg) {
    const barra = document.getElementById('update-bar');
    const texto = document.getElementById('update-text');
    const botao = document.getElementById('update-go');
    const fechar = document.getElementById('update-close');
    const audio = document.getElementById('radio-stream');
    const INTERVALO = 30 * 60000;          // procura no máximo a cada 30 min
    let ultimaBusca = Date.now(), pedi = false, dispensada = false;
    // Sem controller = 1ª visita: a versão que instala já é a atual, não há o que avisar.
    const temAnterior = () => !!navigator.serviceWorker.controller;
    // Na 1ª visita o clients.claim() também dispara 'controllerchange'; não é atualização.
    const tinhaController = temAnterior();
    const tocando = () => audio && !audio.paused;

    async function mostrar() {
      if (dispensada || !reg.waiting || !temAnterior()) return;
      let v = '';
      try { v = (await (await fetch('VERSION.json', { cache: 'no-store' })).json()).version || ''; } catch (e) { /* offline: sem número */ }
      texto.textContent = `Nova versão${v ? ' ' + v : ''} disponível` + (tocando() ? ' · a rádio para por alguns segundos' : '');
      barra.hidden = false;
    }
    // versão nova terminou de instalar e está em espera
    function acompanhar(sw) {
      if (!sw) return;
      sw.addEventListener('statechange', () => { if (sw.state === 'installed') mostrar(); });
    }
    if (reg.waiting) mostrar();
    acompanhar(reg.installing);
    reg.addEventListener('updatefound', () => acompanhar(reg.installing));

    botao.addEventListener('click', () => {
      if (!reg.waiting) { location.reload(); return; }
      pedi = true;
      botao.disabled = true; texto.textContent = 'Atualizando…';
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    });
    fechar.addEventListener('click', () => { dispensada = true; barra.hidden = true; });
    // a versão nova assumiu: recarrega esta aba se foi ela que pediu ou se a rádio
    // está parada; tocando (troca pedida em outra aba), só avisa para não cortar o áudio
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!tinhaController && !pedi) return;   // 1ª visita, não é troca de versão
      if (pedi || !tocando()) { location.reload(); return; }
      dispensada = false;
      texto.textContent = 'Versão nova pronta · toque para recarregar';
      botao.disabled = false; barra.hidden = false;
    });
    // app aberto por horas: ao voltar para ele, procura versão nova (com folga de 30 min)
    function verificar(forcar) {
      if (!forcar && Date.now() - ultimaBusca < INTERVALO) return Promise.resolve();
      ultimaBusca = Date.now();
      return reg.update().catch(() => { /* offline: tenta na próxima */ });
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) verificar(false); });
    window.TugUpdate = { verificar: () => verificar(true) };   // para testes e para o Manual
  }
});

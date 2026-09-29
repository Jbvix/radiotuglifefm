// SPRINTS 09–10 · Jossian Brito · Release date in VERSION.json.
document.addEventListener('DOMContentLoaded', () => {
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
    navigator.serviceWorker.register('./sw.js').catch(() => {
      document.getElementById('install-note').textContent = 'Preparação offline indisponível neste navegador. Você pode continuar usando o site.';
    });
  }
});

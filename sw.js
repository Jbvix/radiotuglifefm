// Only the app shell is cached. Never cache the live stream or third-party APIs.
// v3.8.0 (SPRINT 26) · 2026-10-15T00:30:00-03:00 · Jossian Brito
//   [NOVO] Mensagem SKIP_WAITING: a versão nova instala e fica em espera
//          (nunca troca sozinha); só assume quando o tripulante toca em
//          "Atualizar" na faixa "Nova versão disponível" (pwa.js).
const CACHE = 'tuglife-shell-v3.8.0';
const FILES = ['./','./index.html','./refresh.css','./schedule.js','./schedule-ui.js','./experience.js','./equalizer.js','./pwa.js','./listeners.js','./tides.js','./tide-live.js','./saam.js','./tabs.js','./manual.js','./tide-data.js','./vendor/tide-engine.js','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png','./assets/apple-touch-icon.png','./assets/brand.png','./assets/share-qr.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith('tuglife-shell-') && key !== CACHE).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
// v3.8.0: ordem do app para a versão em espera assumir o comando.
// Como a troca de turno no passadiço: o oficial que chega (SW novo) espera
// na escada até o de serviço (o app aberto) passar o comando.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const known = FILES.some(path => new URL(path,self.registration.scope).pathname === url.pathname);
  if (!known && event.request.mode !== 'navigate') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Versioned cache keeps HTML, scripts and assets from the same release together.
    const stored = await cache.match(event.request, {ignoreSearch:true});
    if (stored) return stored;
    try {return await fetch(event.request);}
    catch {if (event.request.mode === 'navigate') return cache.match('./index.html');throw new Error('Offline');}
  })());
});

// SPRINT 18 · v3.0.0 · Jossian Brito — Alertas SAAM (Web Push)
// Vibração diferente por tipo; o som próprio toca no app aberto (saam.js),
// avisado por postMessage. Com a tela apagada vale o som padrão do celular.
const SAAM_VIBRA = {
  CONFIRMADA: [200, 100, 200],
  CANCELADA: [600, 200, 600],
  ANTECIPADA: [150, 80, 150, 80, 150, 300, 150, 80, 150, 80, 150]
};
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { titulo: 'TugLife FM', corpo: event.data && event.data.text() }; }
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    wins.forEach(c => c.postMessage({ type: 'saam-push', ...d }));
    await self.registration.showNotification(d.titulo || 'Programação SAAM', {
      body: d.corpo || '', tag: 'saam-' + (d.id || Date.now()), renotify: true,
      requireInteraction: d.tipo !== 'CONFIRMADA',
      vibrate: SAAM_VIBRA[d.tipo] || [200],
      icon: './assets/icon-192.png', badge: './assets/icon-192.png',
      data: { url: d.url || './#card-saam' }
    });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data && event.notification.data.url || './#card-saam', self.registration.scope).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) { if ('focus' in c) { await c.focus(); if ('navigate' in c) c.navigate(url); return; } }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});

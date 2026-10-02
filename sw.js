// Only the app shell is cached. Never cache the live stream or third-party APIs.
const CACHE = 'tuglife-shell-v2.5.2';
const FILES = ['./','./index.html','./refresh.css','./schedule.js','./schedule-ui.js','./experience.js','./equalizer.js','./pwa.js','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png','./assets/apple-touch-icon.png','./assets/brand.png','./assets/share-qr.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith('tuglife-shell-') && key !== CACHE).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
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

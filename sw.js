
const PREFIX = 'tierras-shell-' + self.registration.scope + '-';
const CACHE = PREFIX + "ddbe71675884060f";
const FILES = ["assets/index-C1Gq9O8h.css","assets/index-q6fUMhFK.js","assets/leaflet-src-7ah4FPQk.js","config.js","favicon.svg","icon-192.png","icon-512.png","index.html","manifest.webmanifest"];
const URLS = FILES.map(file => new URL(file, self.registration.scope).href);
const ALLOWED = new Set(URLS);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(URLS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  // Solo se guarda la interfaz estática. Las cuentas, fotos privadas y mapas quedan fuera.
  const config = new URL('config.js', self.registration.scope).href;
  const index = new URL('index.html', self.registration.scope).href;
  if (event.request.mode === 'navigate' || url.href === config) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const key = event.request.mode === 'navigate' ? index : config;
      try {
        const response = await fetch(event.request);
        if (response.ok) { await cache.put(key, response.clone()); return response; }
        const saved = await cache.match(key); return saved || response;
      } catch (error) {
        const saved = await cache.match(key);
        if (saved) return saved;
        return new Response('Abre Tierras con conexión al menos una vez para prepararla en este dispositivo.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    }));
  } else if (ALLOWED.has(url.href)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request)) || fetch(event.request)));
  }
});

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const output = path.resolve('dist');
async function files(dir, prefix = '') {
  const result = [];
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const name = prefix + file.name;
    if (file.isDirectory()) result.push(...await files(path.join(dir, file.name), name + '/'));
    else result.push(name);
  }
  return result.sort();
}
const precache = (await files(output)).filter(name => /\.(?:html|js|css|png|svg|webmanifest)$/.test(name));
const hash = createHash('sha256');
for (const file of precache) hash.update(await readFile(path.join(output, file)));
const version = hash.digest('hex').slice(0, 16);
await writeFile(path.join(output, '.nojekyll'), '');
await writeFile(path.join(output, 'sw.js'), `
const PREFIX = 'tierras-shell-' + self.registration.scope + '-';
const CACHE = PREFIX + ${JSON.stringify(version)};
const FILES = ${JSON.stringify(precache)};
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
`);
console.log('PWA preparada:', precache.length, 'archivos con rutas relativas.');

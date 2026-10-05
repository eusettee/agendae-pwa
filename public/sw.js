const CACHE = 'agendae-v2';
const ESSENTIALS = ['/', '/index.html', '/css/style.css', '/js/app.js', '/js/account.js', '/js/catalog.js', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ESSENTIALS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('agendae-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
    return;
  }
  if (ESSENTIALS.includes(url.pathname)) event.respondWith(caches.match(event.request, { ignoreSearch: true }).then(cached => cached || fetch(event.request)));
});

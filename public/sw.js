// App Shell: estrutura, navegação e recursos públicos independentes da API.
const APP_SHELL_CACHE = 'agendae-shell-v6';
const APP_SHELL_DOCUMENT = '/index.html';
const APP_SHELL_FILES = [APP_SHELL_DOCUMENT, '/css/style.css', '/js/app.js', '/js/account.js', '/js/catalog.js', '/js/pwa.js', '/js/units.js', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png'];
self.addEventListener('install', event => {
  // A instalação só termina depois que todos os arquivos do shell foram salvos.
  event.waitUntil(caches.open(APP_SHELL_CACHE).then(cache => cache.addAll(APP_SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('agendae-') && key !== APP_SHELL_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
async function fromAppShell(request, cacheKey) {
  const cache = await caches.open(APP_SHELL_CACHE);
  const cached = await cache.match(cacheKey, { ignoreSearch: true });
  if (cached) return cached;
  // Recupera um recurso público se o navegador tiver removido parte do cache.
  const response = await fetch(request);
  if (response.ok) await cache.put(cacheKey, response.clone());
  return response;
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  // O painel da unidade é restrito e sempre usa a rede.
  if (url.pathname.startsWith('/painel')) return;
  if (event.request.mode === 'navigate') {
    // Cache First: uma conexão lenta não bloqueia a abertura da interface.
    event.respondWith(fromAppShell(APP_SHELL_DOCUMENT, APP_SHELL_DOCUMENT));
    return;
  }
  if (APP_SHELL_FILES.includes(url.pathname)) event.respondWith(fromAppShell(event.request, url.pathname));
});

// Carrega o App Shell sem depender do login, do banco ou da IA.
const APP_SHELL_CACHE = 'agendae-shell-v4';
const APP_SHELL_FILES = ['/index.html', '/css/style.css', '/js/app.js', '/js/account.js', '/js/catalog.js', '/js/pwa.js', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png'];

function setOfflineStatus(ready, message) {
  document.querySelector('#offline-ready').textContent = message;
  document.querySelector('#app-shell-status').textContent = ready ? 'Pronto para usar offline' : 'Acesso offline em preparação';
}

async function checkAppShell() {
  if (!('caches' in window)) return false;
  const cache = await caches.open(APP_SHELL_CACHE);
  const files = await Promise.all(APP_SHELL_FILES.map(file => cache.match(file)));
  const ready = files.every(Boolean);
  if (ready) setOfflineStatus(true, 'Modo offline pronto');
  return ready;
}

async function initializePwa() {
  if (!('serviceWorker' in navigator)) {
    setOfflineStatus(false, 'Este navegador não oferece modo offline.');
    return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => { checkAppShell().catch(() => {}); });
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    const watchWorker = worker => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') checkAppShell().catch(() => {});
        if (worker.state === 'redundant') setOfflineStatus(false, 'Não foi possível preparar o offline. Reconecte e recarregue.');
      });
    };
    watchWorker(registration.installing);
    registration.addEventListener('updatefound', () => watchWorker(registration.installing));
    await navigator.serviceWorker.ready;
    await checkAppShell();
  } catch {
    const ready = await checkAppShell().catch(() => false);
    if (!ready) setOfflineStatus(false, 'Reconecte para preparar o modo offline. Use localhost ou HTTPS.');
  }
}

initializePwa();

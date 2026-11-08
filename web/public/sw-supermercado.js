// ═════════════════════════════════════════════════════════════════════════════
// KYTTO CLOUD ERP — SERVICE WORKER SUPERMERCADO & MULTI-PDV 360
// PWA Industrial para Windows, Linux e Dispositivos Móveis
// ═════════════════════════════════════════════════════════════════════════════

const CACHE_NAME = 'kytto-supermercado-v5.5';
const ASSETS_TO_CACHE = [
  '/admin/supermercado',
  '/manifest-supermercado.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png'
];

// Instalação do Service Worker e pré-carregamento dos assets essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW-Supermercado] Alguns assets não puderam ser pré-cacheados:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Ativação e limpeza de caches obsoletos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key.startsWith('kytto-supermercado-')) {
            console.log('[SW-Supermercado] Removendo cache obsoleto:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições: Estratégia Híbrida Resiliente
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Não intercepta chamadas de API POST/PUT/DELETE ou websockets
  if (req.method !== 'GET') {
    return;
  }

  // 1. Navegação de páginas HTML (/admin/supermercado): Network-First com Fallback Cache
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(() => {
          return caches.match('/admin/supermercado').then((cachedRes) => {
            if (cachedRes) return cachedRes;
            return caches.match(req);
          });
        })
    );
    return;
  }

  // 2. Chunks estáticos do Vite (JS, CSS, Imagens, Fontes): Stale-While-Revalidate
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(req).then((cachedRes) => {
        const fetchPromise = fetch(req)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const resClone = networkRes.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
            }
            return networkRes;
          })
          .catch(() => cachedRes);

        return cachedRes || fetchPromise;
      })
    );
    return;
  }

  // 3. Demais requisições GET: Network com cache fallback
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

// Background Sync para envio de vendas offline quando a rede voltar
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-vendas-offline') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_OFFLINE_REQUESTED' });
        });
      })
    );
  }
});

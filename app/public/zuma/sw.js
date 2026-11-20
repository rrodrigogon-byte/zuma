// Service Worker - Zuma Cozinha Oriental / Kytto Station
const CACHE_NAME = 'zuma-kytto-v5';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './operacao.html',
  './pilot.html',
  './login.html',
  './apps.html',
  './proprietario.html',
  './admin-conexoes.html',
  './entregador.html',
  './garcom.html',
  './pagamentos.html',
  './caixa.html',
  './erp.html',
  './manifest.json',
  './manifest-proprietario.json',
  './manifest-garcom.json',
  './manifest-entregador.json',
  './manifest-caixa.json',
  './zumi-mascote.svg',
  './cardapio-real-zuma.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        return networkResponse;
      }).catch(() => {
        // Fallback offline caso perca conexao
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./apps.html') || caches.match('./index.html');
        }
      });
    })
  );
});

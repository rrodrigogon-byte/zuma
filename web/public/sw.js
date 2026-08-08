// KYTTO Clube PWA Service Worker — v1.0.0
// Estratégia: Cache-First para assets estáticos, Network-First para /api/

const CACHE_NAME = 'kytto-v3'
const STATIC_CACHE = 'kytto-static-v3'
const API_CACHE = 'kytto-api-v3'

// Assets estáticos para pré-caching
const PRE_CACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

// ── Install: pré-cacheia assets essenciais ────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRE_CACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: limpa caches antigos ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Fetch: estratégia híbrida ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Ignora requisições de extensões ou non-http
  if (!url.protocol.startsWith('http')) return

  // ── /api/* — dados de leitura podem usar cache; mutações nunca são
  // armazenadas pelo Service Worker. A fila offline do PDV controla apenas
  // eventos idempotentes explicitamente aprovados pela aplicação.
  if (url.pathname.startsWith('/api/')) {
    if (request.method === 'GET') {
      event.respondWith(networkFirst(request, API_CACHE, 5000))
    } else {
      event.respondWith(
        fetch(request).catch(() => new Response(JSON.stringify({
          erro: 'offline',
          codigo: 'REDE_INDISPONIVEL',
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }))
      )
    }
    return
  }

  // ── Navegação (HTML) — Network-First com fallback para '/' ──
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/') || caches.match(request))
    )
    return
  }

  // ── Assets estáticos (JS, CSS, img, fonts) — Cache-First ──
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|webp)$/)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // ── Demais requests — Stale-While-Revalidate ──
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
})

// ── Estratégias de cache ──────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

async function networkFirst(request, cacheName, timeoutMs = 5000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(request, { signal: controller.signal })
    clearTimeout(timeout)
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    clearTimeout(timeout)
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response(JSON.stringify({ error: 'offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request)
  const networkFetch = fetch(request).then(async response => {
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  }).catch(() => null)

  return cached || networkFetch || new Response('Offline', { status: 503 })
}

// ── Push notifications (futuro) ───────────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() || {}
  const title = data.title || 'Kytto Clube'
  const options = {
    body: data.body || 'Nova notificação',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: data.url || '/',
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  )
})

/* Kytto PWA — rede prioritária para nunca servir interface antiga após deploy. */
const VERSAO = 'kytto-pwa-v4'
const CACHE_SHELL = `${VERSAO}-shell`
const CACHE_RUNTIME = `${VERSAO}-runtime`
const SHELL = ['/', '/manifest.json']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_SHELL).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nomes = await caches.keys()
    await Promise.all(nomes.filter(nome => nome !== CACHE_SHELL && nome !== CACHE_RUNTIME).map(nome => caches.delete(nome)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      const copia = response.clone(); caches.open(CACHE_SHELL).then(cache => cache.put('/', copia)); return response
    }).catch(async () => (await caches.match(request)) || (await caches.match('/')) || Response.error()))
    return
  }
  if (/\/api\//.test(new URL(request.url).pathname)) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ ok:false, offline:true, erro:'Sem conexão.' }), { status:503, headers:{ 'Content-Type':'application/json' } })))
    return
  }
  event.respondWith(fetch(request).then(response => {
    if (response.ok && /\.(?:js|css|svg|png|jpg|webp|woff2?)$/i.test(new URL(request.url).pathname)) {
      const copia = response.clone(); caches.open(CACHE_RUNTIME).then(cache => cache.put(request, copia))
    }
    return response
  }).catch(() => caches.match(request)))
})

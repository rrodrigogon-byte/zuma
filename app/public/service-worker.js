/* Kytto PWA — rede prioritária para nunca servir interface antiga após deploy.
 * v10: blindagem total contra travamento de tela e erro de módulo dinâmico em /admin/*
 * Rotas administrativas nunca usam cache estático defasado de index.html. */
const VERSAO = 'kytto-pwa-v10'
const CACHE_SHELL = `${VERSAO}-shell`
const CACHE_RUNTIME = `${VERSAO}-runtime`
const CACHE_DADOS = `${VERSAO}-dados`
const SHELL = ['/', '/manifest.json']
// Só a agenda do modo barbeiro fica disponível sem internet. Demais APIs: só rede.
const API_OFFLINE = /^\/api\/admin\/barbearia\/modo-barbeiro$/
// Páginas dos apps instaláveis: cada uma tem meta tags próprias (manifesto, ícone).
const PAGINA_APP = /^\/(?:barbeiro|minha)(?:\/[^/]+)?\/?$/

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE_SHELL).then(cache => cache.addAll(SHELL)))
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nomes = await caches.keys()
    // Limpa qualquer cache antigo para não reter index.html obsoleto
    await Promise.all(nomes.filter(nome => ![CACHE_SHELL, CACHE_RUNTIME, CACHE_DADOS].includes(nome)).map(nome => caches.delete(nome)))
    await self.clients.claim()
  })())
})

// O app avisa ao sair da conta: apaga a agenda guardada neste aparelho.
self.addEventListener('message', event => {
  if (event.data?.tipo === 'limpar-dados') {
    event.waitUntil(caches.delete(CACHE_DADOS))
  }
  if (event.data?.tipo === 'skip-waiting') {
    self.skipWaiting()
  }
})

function contextoDadosCompleto(request) {
  return /^Bearer\s+\S+/i.test(request.headers.get('Authorization') || '')
    && ['X-Kytto-Usuario', 'X-Empresa-Id', 'X-Loja-Id'].every(nome => Boolean((request.headers.get(nome) || '').trim()))
}

function chaveDados(request) {
  const url = new URL(request.url)
  url.searchParams.set('__u', request.headers.get('X-Kytto-Usuario') || 'anon')
  url.searchParams.set('__e', request.headers.get('X-Empresa-Id') || '')
  url.searchParams.set('__l', request.headers.get('X-Loja-Id') || '')
  return url.toString()
}

async function redeComCopia(request) {
  if (!contextoDadosCompleto(request)) return fetch(request).catch(() => new Response(JSON.stringify({ ok: false, offline: true, error: 'Selecione a empresa e unidade e entre no app para acessar a agenda.' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
  const chave = chaveDados(request)
  try {
    const resposta = await fetch(request)
    if ([502, 503, 504].includes(resposta.status)) throw Object.assign(new Error('Servidor temporariamente indisponível'), { servidor: true })
    if (resposta.ok) {
      const copia = resposta.clone()
      const cache = await caches.open(CACHE_DADOS)
      await cache.put(chave, new Response(await copia.blob(), { headers: { 'Content-Type': 'application/json', 'X-Kytto-Salvo-Em': new Date().toISOString() } }))
    }
    return resposta
  } catch (error) {
    const cache = await caches.open(CACHE_DADOS)
    const salvo = await cache.match(chave)
    if (salvo) {
      const dados = await salvo.json().catch(() => null)
      if (dados) return new Response(JSON.stringify({ ...dados, _offline: { salvoEm: salvo.headers.get('X-Kytto-Salvo-Em'), motivo: error.servidor ? 'servidor' : 'conexao' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ ok: false, offline: true, error: 'Sem conexão.' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
  }
}

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  const caminho = new URL(request.url).pathname

  // 1. Páginas do Clube e APIs públicas: direto na rede
  if (/^\/(?:contrato|clube\/(?:painel|passe|pagar))(?:\/|$)/.test(caminho) || /^\/api\/public\/(?:contratos|clube)\//.test(caminho)) return

  // 2. Rotas do Painel Administrativo (/admin/*) são sempre prioritárias na REDE
  // para NUNCA travar o balcão nem servir index.html com hashes antigos de bundles
  if (caminho.startsWith('/admin')) {
    event.respondWith(
      fetch(request).catch(async () => {
        // Se realmente estiver offline sem rede, tenta o fallback
        return (await caches.match(request)) || (await caches.match('/')) || Response.error()
      })
    )
    return
  }

  // 3. Navegação geral
  if (request.mode === 'navigate') {
    const chave = PAGINA_APP.test(caminho) ? caminho : '/'
    event.respondWith(
      fetch(request).then(async response => {
        if ([502, 503, 504].includes(response.status)) return (await caches.match(chave)) || response
        if (response.ok) {
          const copia = response.clone()
          caches.open(CACHE_SHELL).then(cache => cache.put(chave, copia))
        }
        return response
      }).catch(async () => (await caches.match(chave)) || (await caches.match('/')) || Response.error())
    )
    return
  }

  // 4. API offline específica do barbeiro
  if (API_OFFLINE.test(caminho)) {
    event.respondWith(redeComCopia(request))
    return
  }

  // 5. Demais APIs: sempre rede
  if (/\/api\//.test(caminho)) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ ok: false, offline: true, erro: 'Sem conexão.' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
    )
    return
  }

  // 6. Assets estáticos (js, css, imagens): Rede prioritária com fallback para cache
  event.respondWith(
    fetch(request).then(response => {
      if (response.ok && /\.(?:js|css|svg|png|jpg|webp|woff2?)$/i.test(caminho)) {
        const copia = response.clone()
        caches.open(CACHE_RUNTIME).then(cache => cache.put(request, copia))
      }
      return response
    }).catch(() => caches.match(request))
  )
})

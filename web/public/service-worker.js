/* Kytto PWA — blindagem total contra travamento de tela e contaminação de cache.
 * v12: PURGE TOTAL de caches legados e isolamento estrito da rota raiz '/'.
 * Páginas estáticas secundárias (.html) NUNCA interceptam nem poluem o cache shell. */
const VERSAO = 'kytto-pwa-v12-recovery-purge'
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
  event.waitUntil(
    caches.open(CACHE_SHELL).then(cache => cache.addAll(SHELL)).catch(() => {})
  )
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // PURGE TOTAL: limpa todos os caches antigos (v10, v11, etc.) para garantir
    // que nenhuma página indevida (como a torre de pesagem) permaneça retida.
    const nomes = await caches.keys()
    await Promise.all(
      nomes.filter(nome => nome !== CACHE_SHELL && nome !== CACHE_RUNTIME && nome !== CACHE_DADOS)
        .map(nome => caches.delete(nome))
    )
    await self.clients.claim()

    // Força recarregamento limpo de todas as abas abertas sob este service worker
    const clients = await self.clients.matchAll({ type: 'window' })
    for (const client of clients) {
      if (client.url && 'navigate' in client) {
        client.navigate(client.url).catch(() => {})
      }
    }
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
  if (!contextoDadosCompleto(request)) {
    return fetch(request).catch(() => new Response(JSON.stringify({ ok: false, offline: true, error: 'Selecione a empresa e unidade e entre no app para acessar a agenda.' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
  }
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

  // 0. Arquivos HTML estáticos secundários (ex: torre-pesagem.html, relatórios avulsos)
  // NUNCA são interceptados nem cacheados pelo Service Worker: vão SEMPRE direto na rede.
  if (caminho.endsWith('.html') && caminho !== '/index.html') {
    return
  }

  // 1. Páginas do Clube e APIs públicas: direto na rede
  if (/^\/(?:contrato|clube\/(?:painel|passe|pagar))(?:\/|$)/.test(caminho) || /^\/api\/public\/(?:contratos|clube)\//.test(caminho)) return

  // 2. Rotas do Painel Administrativo (/admin/*) são sempre prioritárias na REDE
  // para NUNCA travar o balcão nem servir index.html com hashes antigos de bundles
  if (caminho.startsWith('/admin')) {
    event.respondWith(
      fetch(request).catch(async () => {
        return (await caches.match(request)) || (await caches.match('/')) || Response.error()
      })
    )
    return
  }

  // 3. Navegação geral: Network-first
  if (request.mode === 'navigate') {
    // ESTRITO: apenas a rota raiz '/' ou '/index.html' grava na chave '/'
    const ehRaiz = caminho === '/' || caminho === '/index.html'
    const chave = ehRaiz ? '/' : (PAGINA_APP.test(caminho) ? caminho : null)

    event.respondWith(
      fetch(request).then(async response => {
        if ([502, 503, 504].includes(response.status)) {
          if (chave) {
            const cached = await caches.match(chave)
            if (cached) return cached
          }
          return response
        }
        if (response.ok && chave) {
          const copia = response.clone()
          const cache = await caches.open(CACHE_SHELL)
          await cache.put(chave, copia)
        }
        return response
      }).catch(async () => {
        if (chave) {
          const cached = await caches.match(chave)
          if (cached) return cached
        }
        return (await caches.match('/')) || Response.error()
      })
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
        caches.open(CACHE_RUNTIME).then(cache => cache.put(request, copia)).catch(() => {})
      }
      return response
    }).catch(() => caches.match(request))
  )
})

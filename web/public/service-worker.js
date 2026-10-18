/* Kytto PWA — rede prioritária para nunca servir interface antiga após deploy.
 * v6: recuperação de 502/503/504 somente em leituras e shell já guardado.
 * v5: notificações push da equipe, agenda do barbeiro disponível sem internet
 * (última versão, por usuário, apagada ao sair) e página de cada app guardada. */
const VERSAO = 'kytto-pwa-v8'
const CACHE_SHELL = `${VERSAO}-shell`
const CACHE_RUNTIME = `${VERSAO}-runtime`
const CACHE_DADOS = `${VERSAO}-dados`
const SHELL = ['/', '/manifest.json']
// Só a agenda do modo barbeiro fica disponível sem internet. Demais APIs: só rede.
const API_OFFLINE = /^\/api\/admin\/barbearia\/modo-barbeiro$/
// Páginas dos apps instaláveis: cada uma tem meta tags próprias (manifesto, ícone).
const PAGINA_APP = /^\/(?:barbeiro|minha)(?:\/[^/]+)?\/?$/

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_SHELL).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nomes = await caches.keys()
    await Promise.all(nomes.filter(nome => ![CACHE_SHELL, CACHE_RUNTIME, CACHE_DADOS].includes(nome)).map(nome => caches.delete(nome)))
    await self.clients.claim()
  })())
})

// O app avisa ao sair da conta: apaga a agenda guardada neste aparelho.
self.addEventListener('message', event => {
  if (event.data?.tipo === 'limpar-dados') event.waitUntil(caches.delete(CACHE_DADOS))
})

function contextoDadosCompleto(request) {
  return /^Bearer\s+\S+/i.test(request.headers.get('Authorization') || '')
    && ['X-Kytto-Usuario', 'X-Empresa-Id', 'X-Loja-Id'].every(nome => Boolean((request.headers.get(nome) || '').trim()))
}

function chaveDados(request) {
  const url = new URL(request.url)
  // Separada por login, empresa e unidade: num aparelho compartilhado ou com várias
  // empresas, ninguém vê sem internet a agenda de outro contexto.
  url.searchParams.set('__u', request.headers.get('X-Kytto-Usuario') || 'anon')
  url.searchParams.set('__e', request.headers.get('X-Empresa-Id') || '')
  url.searchParams.set('__l', request.headers.get('X-Loja-Id') || '')
  return url.toString()
}

async function redeComCopia(request) {
  // Contexto ausente não é agenda vazia e nunca usa cópia de outro login/unidade.
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
  // Páginas do Clube servidas pelo servidor (contrato com dados do aluno, passe com QR, painel):
  // nunca entram no cache do aparelho nem viram a "página inicial" offline.
  if (/^\/(?:contrato|clube\/(?:painel|passe|pagar))(?:\/|$)/.test(caminho) || /^\/api\/public\/(?:contratos|clube)\//.test(caminho)) return
  if (request.mode === 'navigate') {
    const chave = PAGINA_APP.test(caminho) ? caminho : '/'
    event.respondWith(fetch(request).then(async response => {
      if ([502, 503, 504].includes(response.status)) return (await caches.match(chave)) || response
      if (response.ok) { const copia = response.clone(); caches.open(CACHE_SHELL).then(cache => cache.put(chave, copia)) }
      return response
    }).catch(async () => (await caches.match(chave)) || (await caches.match('/')) || Response.error()))
    return
  }
  if (API_OFFLINE.test(caminho)) { event.respondWith(redeComCopia(request)); return }
  if (/\/api\//.test(caminho)) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ ok:false, offline:true, erro:'Sem conexão.' }), { status:503, headers:{ 'Content-Type':'application/json' } })))
    return
  }
  event.respondWith(fetch(request).then(response => {
    if (response.ok && /\.(?:js|css|svg|png|jpg|webp|woff2?)$/i.test(caminho)) {
      const copia = response.clone(); caches.open(CACHE_RUNTIME).then(cache => cache.put(request, copia))
    }
    return response
  }).catch(() => caches.match(request)))
})

// ── Notificações push (app da equipe) ─────────────────────────────────────
const TITULOS_PUSH = new Set(['Novo agendamento', 'Agendamento remarcado', 'Agendamento cancelado', 'Agenda atualizada', 'Notificações ligadas'])
const ROTA_PUSH = /^\/barbeiro(?:\/[A-Za-z0-9._~-]+)?\/?$/
function rotaPushPermitida(valor) {
  try {
    const url = new URL(typeof valor === 'string' ? valor : '/barbeiro', self.location.origin)
    if (url.origin !== self.location.origin || !ROTA_PUSH.test(url.pathname)) return '/barbeiro'
    // A rota de clique não leva query/hash do payload para a navegação.
    return url.pathname.replace(/\/$/, '') || '/barbeiro'
  } catch { return '/barbeiro' }
}

self.addEventListener('push', event => {
  let dados = {}
  try { dados = event.data ? event.data.json() : {} } catch { dados = {} }
  // O servidor envia somente title/body genéricos. Campos legados (url, evento,
  // nome, telefone etc.) são deliberadamente ignorados pelo worker.
  const titulo = TITULOS_PUSH.has(dados?.title) ? dados.title : 'Agenda atualizada'
  const corpo = 'Abra o app Dino Equipe para conferir a agenda.'
  event.waitUntil(self.registration.showNotification(titulo, {
    body: corpo,
    icon: '/brand/dino-equipe-192.png',
    badge: '/brand/dino-equipe-192.png',
    data: { url: rotaPushPermitida('/barbeiro') },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const rota = rotaPushPermitida(event.notification.data?.url)
  const destino = new URL(rota, self.location.origin).href
  event.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const doApp = abertas.find(cliente => {
      try { return new URL(cliente.url).origin === self.location.origin && ROTA_PUSH.test(new URL(cliente.url).pathname) } catch { return false }
    })
    if (doApp) { await doApp.focus(); if ('navigate' in doApp) await doApp.navigate(destino).catch(() => null); return }
    await self.clients.openWindow(destino)
  })())
})

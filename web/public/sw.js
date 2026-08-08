// KYTTO — Service Worker de recuperação de cache (2026-08-08)
//
// Esta versão remove deliberadamente o cache PWA legado que retinha a interface
// anterior do SetPoint em alguns navegadores. Ela se auto-remove após limpar os
// caches e força uma única navegação de rede para carregar a versão Kytto.

const CACHE_PREFIX = 'kytto-'

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheKeys = await caches.keys()
    await Promise.all(
      cacheKeys
        .filter(key => key.startsWith(CACHE_PREFIX))
        .map(key => caches.delete(key))
    )

    // Remove o próprio worker para que atualizações futuras dependam sempre
    // do navegador e da versão hashada dos assets, sem reter a UI antiga.
    await self.registration.unregister()

    // Faz as abas já abertas buscar a aplicação pela rede uma única vez.
    const clients = await self.clients.matchAll({ type: 'window' })
    await Promise.all(clients.map(client => client.navigate(client.url)))
  })())
})

// Não há handler de fetch de propósito: toda navegação e todo asset devem vir
// da rede após a recuperação, evitando que versões antigas sejam servidas.

// KYTTO — Worker de migração de instalações PWA legadas (2026-08-09)
// Mantido também neste nome porque versões antigas registravam /service-worker.js.
// Ao ser atualizado pelo navegador, remove todos os caches da origem e se desregistra,
// entregando o shell Kytto atual a partir da rede.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nomes = await caches.keys()
    await Promise.all(nomes.map(nome => caches.delete(nome)))
    await self.registration.unregister()
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    await Promise.all(janelas.map(janela => janela.navigate(janela.url)))
  })())
})

// Sem handler fetch: após a migração, navegação e assets devem vir da rede.

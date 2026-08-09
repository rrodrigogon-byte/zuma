import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { ToastProvider } from './hooks/useToast'
import App from './App'
import './theme.css'

// Quando uma nova revisão substitui os arquivos com hash, uma aba já aberta pode
// tentar carregar um módulo que existia apenas na revisão anterior. Recarregamos
// uma única vez para buscar o index e os assets consistentes da revisão atual.
const RECOVERY_KEY = 'kytto_asset_recovery_at'
function recuperarAssetsAtualizados(event) {
  event?.preventDefault?.()
  const ultimaTentativa = Number(sessionStorage.getItem(RECOVERY_KEY) || 0)
  const agora = Date.now()
  if (agora - ultimaTentativa < 30_000) return
  sessionStorage.setItem(RECOVERY_KEY, String(agora))
  window.location.reload()
}
window.addEventListener('vite:preloadError', recuperarAssetsAtualizados)
window.addEventListener('error', (event) => {
  const mensagem = String(event?.message || event?.error?.message || '')
  if (/failed to fetch dynamically imported module|importing a module script failed/i.test(mensagem)) recuperarAssetsAtualizados(event)
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)

// ── Recuperação de cache de versões anteriores ───────────────────────────────
// O PWA legado mantinha assets antigos em Cache Storage em alguns navegadores.
// A aplicação passa a depender dos assets hashados e da rede, evitando entregar
// uma interface antiga após um novo deploy.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(registration => registration.unregister()))

      if ('caches' in window) {
        const cacheNames = await caches.keys()
        // Cache Storage é isolado por domínio. Limpar todos os nomes desta origem
        // remove também o cache "setpoint-*" que continha a interface anterior.
        await Promise.all(cacheNames.map(name => caches.delete(name)))
      }
    } catch (error) {
      console.warn('[KYTTO] Não foi possível limpar o cache legado:', error)
    }
  })
}

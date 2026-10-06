import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { ToastProvider } from './hooks/useToast'
import App from './App'
import { api } from './lib/api'
import CookieConsent from './components/CookieConsent'
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
          {/* Banner LGPD — exibido globalmente, fora da árvore de rotas */}
          <CookieConsent />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)

// ── PWA Kytto: rede prioritária, fallback offline e atualização controlada ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registro = await navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' })
      registro.update().catch(() => {})
      await api.sincronizarFilaOffline().catch(() => {})
    } catch (error) {
      console.warn('[KYTTO] Não foi possível ativar o modo offline:', error)
    }
  })
}
window.addEventListener('online', () => api.sincronizarFilaOffline().catch(() => {}))

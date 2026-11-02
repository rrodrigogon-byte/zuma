import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { ToastProvider } from './hooks/useToast'
import App from './App'
import { api, fmtKpi, fmtR } from './lib/api'
import CookieConsent from './components/CookieConsent'
import './theme.css'

if (typeof globalThis !== 'undefined') {
  globalThis.fmtKpi = fmtKpi
  globalThis.fmtR = fmtR
}
if (typeof window !== 'undefined') {
  window.fmtKpi = fmtKpi
  window.fmtR = fmtR
}

// Quando uma nova revisão substitui os arquivos com hash, uma aba já aberta pode
// tentar carregar um módulo que existia apenas na revisão anterior. Recarregamos
// uma única vez para buscar o index e os assets consistentes da revisão atual.
const RECOVERY_KEY = 'kytto_asset_recovery_at'
function recuperarAssetsAtualizados(event) {
  let ultimaTentativa = 0
  try { ultimaTentativa = Number(sessionStorage.getItem(RECOVERY_KEY) || 0) } catch { /* armazenamento opcional */ }
  const agora = Date.now()
  // Já recarregou há pouco: deixa o erro seguir para a tela de erro (com botão Recarregar).
  // Cancelar o erro sem recarregar fazia o lazy() receber "undefined" e o painel quebrar
  // com "Cannot read properties of undefined (reading 'default')".
  if (agora - ultimaTentativa < 30_000) return
  event?.preventDefault?.()
  try { sessionStorage.setItem(RECOVERY_KEY, String(agora)) } catch { /* armazenamento opcional */ }
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

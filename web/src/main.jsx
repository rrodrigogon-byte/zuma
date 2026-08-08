import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { ToastProvider } from './hooks/useToast'
import App from './App'
import './theme.css'

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

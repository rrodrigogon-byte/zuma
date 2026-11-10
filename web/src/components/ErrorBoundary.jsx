import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
    const msg = String(error?.message || '')
    const isChunkError = /failed to fetch dynamically imported module|importing a module script failed|dynamically imported module|chunkloaderror/i.test(msg)

    if (isChunkError) {
      const RECOVERY_KEY = 'kytto_asset_recovery_at'
      let ultimaTentativa = 0
      try { ultimaTentativa = Number(sessionStorage.getItem(RECOVERY_KEY) || 0) } catch (_) {}
      const agora = Date.now()

      // Tenta recuperação automática transparente se faz mais de 4 segundos
      if (agora - ultimaTentativa > 4_000) {
        try { sessionStorage.setItem(RECOVERY_KEY, String(agora)) } catch (_) {}
        this.purgarCachesERecarregar()
      }
    }
  }

  purgarCachesERecarregar = () => {
    try {
      if ('caches' in window) {
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {})
      }
    } catch (_) {}

    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((reg) => reg.unregister().catch(() => {}))
        }).catch(() => {})
      }
    } catch (_) {}

    setTimeout(() => {
      const url = new URL(window.location.href)
      url.searchParams.set('_v', String(Date.now()))
      window.location.href = url.toString()
    }, 150)
  }

  render() {
    if (this.state.hasError) {
      const msg = String(this.state.error?.message || '')
      const isChunkError = /failed to fetch dynamically imported module|importing a module script failed|dynamically imported module|chunkloaderror/i.test(msg)

      if (isChunkError) {
        return (
          <div style={{ padding: '60px 20px', textAlign: 'center', maxWidth: 520, margin: '0 auto', fontFamily: 'sans-serif' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>⚡</div>
            <h2 style={{ color: '#0f172a', marginBottom: 10, fontWeight: 800 }}>
              Sincronizando Sistema
            </h2>
            <p style={{ color: '#64748b', marginBottom: 24, fontSize: 15, lineHeight: 1.5 }}>
              Uma nova versão foi carregada no servidor. Clique no botão abaixo para restabelecer a conexão instantaneamente.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={this.purgarCachesERecarregar}
                style={{
                  padding: '12px 28px',
                  fontSize: 15,
                  fontWeight: 700,
                  borderRadius: 12,
                  background: '#16a34a',
                  color: '#fff',
                  border: 0,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
                }}
              >
                Conectar e Continuar 🔄
              </button>
              <button
                onClick={() => { window.location.href = '/admin' }}
                style={{
                  padding: '12px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 12,
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer'
                }}
              >
                Ir para o Início
              </button>
            </div>
          </div>
        )
      }

      return (
        <div style={{ padding: 40, textAlign: 'center', maxWidth: 600, margin: '0 auto', fontFamily: 'sans-serif' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: '#0f172a', marginBottom: 8, fontWeight: 700 }}>Algo deu errado</h2>
          <p style={{ color: '#64748b', marginBottom: 24, fontSize: 14 }}>
            {this.state.error?.message || 'Erro inesperado'}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={this.purgarCachesERecarregar}
              style={{
                padding: '10px 24px',
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 10,
                background: '#2563eb',
                color: '#fff',
                border: 0,
                cursor: 'pointer'
              }}
            >
              Recarregar página
            </button>
            <button
              onClick={() => { window.location.href = '/admin' }}
              style={{
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 10,
                background: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                cursor: 'pointer'
              }}
            >
              Painel Principal
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

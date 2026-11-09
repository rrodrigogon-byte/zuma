import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
    const msg = String(error?.message || '')
    if (/failed to fetch dynamically imported module|importing a module script failed|dynamically imported module|chunkloaderror/i.test(msg)) {
      const RECOVERY_KEY = 'kytto_asset_recovery_at'
      let ultimaTentativa = 0
      try { ultimaTentativa = Number(sessionStorage.getItem(RECOVERY_KEY) || 0) } catch (_) {}
      const agora = Date.now()
      if (agora - ultimaTentativa > 6_000) {
        try { sessionStorage.setItem(RECOVERY_KEY, String(agora)) } catch (_) {}
        try {
          if ('caches' in window) {
            caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {})
          }
        } catch (_) {}
        const url = new URL(window.location.href)
        url.searchParams.set('_v', String(agora))
        window.location.href = url.toString()
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const msg = String(this.state.error?.message || '')
      const isChunkError = /failed to fetch dynamically imported module|importing a module script failed|dynamically imported module|chunkloaderror/i.test(msg)

      const recarregar = () => {
        try {
          if ('caches' in window) {
            caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {})
          }
        } catch (_) {}
        const url = new URL(window.location.href)
        url.searchParams.set('_v', String(Date.now()))
        window.location.href = url.toString()
      }

      if (isChunkError) {
        return (
          <div style={{ padding: '60px 20px', textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🚀</div>
            <h2 style={{ color: 'var(--cream, #0f172a)', marginBottom: 10, fontWeight: 800 }}>
              Nova versão disponível
            </h2>
            <p style={{ color: 'var(--muted, #64748b)', marginBottom: 24, fontSize: 15, lineHeight: 1.5 }}>
              O sistema foi atualizado no servidor com novos módulos e melhorias. Clique no botão abaixo para carregar a versão mais recente.
            </p>
            <button
              className="btn btn-primary"
              onClick={recarregar}
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
              Atualizar e Continuar 🔄
            </button>
          </div>
        )
      }

      return (
        <div style={{ padding: 40, textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: 'var(--cream, #0f172a)', marginBottom: 8, fontWeight: 700 }}>Algo deu errado</h2>
          <p style={{ color: 'var(--muted, #64748b)', marginBottom: 24, fontSize: 14 }}>
            {this.state.error?.message || 'Erro inesperado'}
          </p>
          <button
            className="btn btn-primary"
            onClick={recarregar}
            style={{
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 10,
              cursor: 'pointer'
            }}
          >
            Recarregar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

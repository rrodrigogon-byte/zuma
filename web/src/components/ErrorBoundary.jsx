import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    const msg = String(error?.message || '')
    if (/failed to fetch dynamically imported module|importing a module script failed|dynamically imported module/i.test(msg)) {
      const RECOVERY_KEY = 'kytto_asset_recovery_at'
      let ultimaTentativa = 0
      try { ultimaTentativa = Number(sessionStorage.getItem(RECOVERY_KEY) || 0) } catch (_) {}
      const agora = Date.now()
      if (agora - ultimaTentativa > 10_000) {
        try { sessionStorage.setItem(RECOVERY_KEY, String(agora)) } catch (_) {}
        window.location.reload()
      }
    }
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: 'var(--cream)', marginBottom: 8 }}>Algo deu errado</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: 14 }}>
            {this.state.error?.message || 'Erro inesperado'}
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Recarregar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

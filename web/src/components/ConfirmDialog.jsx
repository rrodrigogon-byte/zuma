import { useState } from 'react'

export function useConfirm() {
  const [state, setState] = useState(null)

  const confirm = (title, message) =>
    new Promise((resolve) => {
      setState({ title, message, resolve })
    })

  const handle = (ok) => {
    state?.resolve(ok)
    setState(null)
  }

  const ConfirmDialog = state ? (
    <div className="modal-backdrop">
      <div className="modal-body" style={{ maxWidth: 400 }}>
        <div style={{ fontSize: 36, marginBottom: 12, textAlign: 'center' }}>⚠️</div>
        <h3 style={{ textAlign: 'center', marginBottom: 8, color: 'var(--cream)' }}>{state.title}</h3>
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
          {state.message}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-block" onClick={() => handle(false)}>
            Cancelar
          </button>
          <button className="btn btn-danger btn-block" onClick={() => handle(true)}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, ConfirmDialog }
}

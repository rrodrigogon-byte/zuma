import { useEffect } from 'react'

export default function Modal({ open = true, title, onClose, children, width = 520 }) {
  // Telas que renderizam condicionalmente ({cond && <Modal/>}) não passam `open`
  // (default true). Telas que passam `open={state}` são respeitadas aqui.

  // Acessibilidade: fechar com Esc (só quando aberto).
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="modal-backdrop fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal-body slide-up"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fechar" title="Fechar">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

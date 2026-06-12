export default function Modal({ open = true, title, onClose, children, width = 520 }) {
  // Telas que renderizam condicionalmente ({cond && <Modal/>}) não passam `open`
  // (default true). Telas que passam `open={state}` são respeitadas aqui.
  if (!open) return null
  return (
    <div
      className="modal-backdrop fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-body slide-up" style={{ maxWidth: width }}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

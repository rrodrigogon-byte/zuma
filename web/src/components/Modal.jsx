export default function Modal({ title, onClose, children, width = 520 }) {
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

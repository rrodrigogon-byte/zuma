export default function EmptyState({ icon = '📭', title, subtitle, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{title}</div>
      {subtitle && (
        <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16 }}>{subtitle}</div>
      )}
      {action}
    </div>
  )
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 6, style = {} }) {
  return (
    <div style={{
      width,
      height,
      borderRadius,
      background: 'linear-gradient(90deg, var(--card) 25%, var(--card2) 50%, var(--card) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      ...style,
    }} />
  )
}

export function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--card)',
      borderRadius: 'var(--radius)',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <Skeleton height={18} width="60%" />
      <Skeleton height={14} width="90%" />
      <Skeleton height={14} width="75%" />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* header */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, marginBottom: 4 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={14} width="70%" />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 8,
          background: 'var(--card)',
          borderRadius: 8,
          padding: '10px 12px',
        }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height={14} width={c === 0 ? '80%' : '60%'} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonKPI() {
  return (
    <div style={{
      background: 'var(--card)',
      borderRadius: 'var(--radius)',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <Skeleton height={12} width="50%" />
      <Skeleton height={32} width="65%" borderRadius={8} />
      <Skeleton height={10} width="40%" />
    </div>
  )
}

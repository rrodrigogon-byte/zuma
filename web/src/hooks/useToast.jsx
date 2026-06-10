import { createContext, useContext, useState, useCallback } from 'react'

const Ctx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((msg, isError = false) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t, { id, msg, isError }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800)
  }, [])

  return (
    <Ctx.Provider value={toast}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} className="slide-in" style={{
            background: t.isError ? '#c0392b' : 'var(--green)',
            color: t.isError ? '#fff' : 'var(--deep)',
            padding: '12px 20px', borderRadius: 10, fontWeight: 700,
            fontSize: 14, boxShadow: 'var(--shadow)', maxWidth: 360,
            animation: 'slideIn .2s ease',
          }}>{t.msg}</div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  return useContext(Ctx)
}

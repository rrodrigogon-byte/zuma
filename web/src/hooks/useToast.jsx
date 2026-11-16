import { createContext, useContext, useState, useCallback, useMemo } from 'react'

const Ctx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  // 2º arg aceita boolean (true=erro) OU string de variante. Muitas telas chamam
  // toast(msg, 'success'|'error'|'warn'|'info'); sem este mapeamento toda string
  // truthy renderizava como erro vermelho — inclusive os sucessos.
  const toast = useCallback((msg, kind = false) => {
    const isError = kind === true ||
      kind === 'error' || kind === 'erro' ||
      kind === 'warn' || kind === 'warning' || kind === 'danger'
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
          }}>{String(t.msg ?? '')}</div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const toast = useContext(Ctx)
  return useMemo(() => {
    const fn = (msg, kind) => toast?.(msg, kind)
    fn.toast = toast
    fn.success = (msg) => toast?.(msg, 'success')
    fn.error = (msg) => toast?.(msg, 'error')
    fn.warn = (msg) => toast?.(msg, 'warn')
    fn.warning = (msg) => toast?.(msg, 'warning')
    fn.info = (msg) => toast?.(msg, 'info')
    return fn
  }, [toast])
}

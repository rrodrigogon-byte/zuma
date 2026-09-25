import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

// Foco do diálogo: ESC fecha, Tab fica preso dentro dele e o foco volta ao gatilho ao fechar.
export default function useDialogFocus(open, onClose, initialFocusRef) {
  const containerRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return undefined
    const previous = typeof document !== 'undefined' ? document.activeElement : null
    const frame = window.requestAnimationFrame(() => {
      const target = initialFocusRef?.current || containerRef.current?.querySelector(FOCUSABLE)
      target?.focus({ preventScroll: true })
    })
    function onKeyDown(event) {
      if (event.key === 'Escape') { event.stopPropagation(); closeRef.current?.(); return }
      if (event.key !== 'Tab' || !containerRef.current) return
      const items = [...containerRef.current.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown, true)
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus({ preventScroll: true })
    }
  }, [open])

  return containerRef
}

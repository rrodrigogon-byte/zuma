import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../lib/api'

export function useFetch(url, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const reloadCounter = useRef(0)

  const reload = useCallback(() => {
    reloadCounter.current += 1
    setLoading(true)
    setError(null)
  }, [])

  useEffect(() => {
    if (!url) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    api.get(url)
      .then(d => {
        if (!cancelled) {
          setData(d)
          setLoading(false)
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(e?.message || 'Erro ao carregar dados')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, reloadCounter.current, ...deps])

  return { data, loading, error, reload }
}

import { useEffect, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'

// Se o Financeiro novo (razão único) está ligado nesta instalação. Uma consulta por empresa,
// compartilhada entre o menu, o Financeiro e as telas que falam dele.
const cache = new Map()

export function razaoAtivoDaEmpresa(empresaId) {
  const chave = String(empresaId || '')
  if (!cache.has(chave)) {
    cache.set(chave, api.get('/api/admin/razao/estado')
      .then((r) => r?.ativo === true)
      .catch(() => { cache.delete(chave); return false }))
  }
  return cache.get(chave)
}

export function esquecerRazaoAtivo() { cache.clear() }

/** null enquanto carrega; depois true/false. */
export function useRazaoAtivo() {
  const { empresaAtiva, user } = useAuth()
  const [ativo, setAtivo] = useState(null)
  useEffect(() => {
    let vivo = true
    setAtivo(null)
    if (!user) { setAtivo(false); return () => { vivo = false } }
    razaoAtivoDaEmpresa(empresaAtiva?.id).then((v) => { if (vivo) setAtivo(v) })
    return () => { vivo = false }
  }, [empresaAtiva?.id, user])
  return ativo
}

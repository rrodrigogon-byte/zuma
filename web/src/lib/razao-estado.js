import { useEffect, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'

// Se o Financeiro novo (razão único) está ligado nesta instalação. Uma consulta por empresa,
// compartilhada entre o menu, o Financeiro e as telas que falam dele.
const cache = new Map()

// Sem resposta em 6 s, ou com erro (sem permissão, servidor ocupado), vale "desligado": as telas
// de hoje abrem como sempre. O erro fica guardado por 1 min para não repetir a consulta a cada tela.
const ESPERA_MS = 6000
const NOVA_TENTATIVA_MS = 60000

export function razaoAtivoDaEmpresa(empresaId) {
  const chave = String(empresaId || '')
  if (!cache.has(chave)) {
    const desligado = () => { setTimeout(() => cache.delete(chave), NOVA_TENTATIVA_MS); return false }
    const consulta = api.get('/api/admin/razao/estado').then((r) => r?.ativo === true)
    const limite = new Promise((resolve) => setTimeout(() => resolve('tempo'), ESPERA_MS))
    cache.set(chave, Promise.race([consulta, limite])
      .then((v) => (v === 'tempo' ? desligado() : v))
      .catch(desligado))
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

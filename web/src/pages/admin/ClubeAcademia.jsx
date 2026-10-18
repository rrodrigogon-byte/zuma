import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

// Clube & Academia dentro do Kytto: o painel do módulo (/clube/painel) roda embutido, com o
// menu do Kytto. A seção fica na URL (/admin/clube/<secao>), então voltar do navegador e
// favoritos funcionam. Mesma origem: o painel usa a mesma sessão e a empresa ativa.
export const SECOES_CLUBE = [
  { id: 'recepcao', label: 'Recepção' },
  { id: 'alunos', label: 'Alunos' },
  { id: 'aulas', label: 'Aulas' },
  { id: 'contratos', label: 'Contratos' },
  { id: 'retencao', label: 'Retenção' },
  { id: 'cobrancas', label: 'Cobranças' },
  { id: 'parceiros', label: 'Wellhub e TotalPass' },
  { id: 'ajustes', label: 'Catracas e planos' },
]
const IDS = new Set(SECOES_CLUBE.map((s) => s.id))

export function secaoValida(secao) {
  return IDS.has(secao) ? secao : 'recepcao'
}

export default function ClubeAcademia() {
  const { secao } = useParams()
  const atual = secaoValida(secao)
  const navigate = useNavigate()
  const frame = useRef(null)
  // endereço fixo do iframe: trocar de seção muda só o hash (não recarrega o painel)
  const [inicial] = useState(() => `/clube/painel?embed=1#${atual}`)
  const [indisponivel, setIndisponivel] = useState(false)
  // sem o módulo ligado no servidor, /clube/painel cai no próprio app: avisa em vez de abrir o Kytto dentro do Kytto
  const conferir = () => {
    try { setIndisponivel(!frame.current?.contentDocument?.getElementById('gaveta')) } catch { setIndisponivel(false) }
  }

  // menu do Kytto → painel: troca só o hash, sem recarregar o painel
  useEffect(() => {
    const janela = frame.current?.contentWindow
    if (janela && janela.location && janela.location.pathname === '/clube/painel') {
      try { if (janela.location.hash.slice(1) !== atual) janela.location.hash = atual } catch { /* outra origem: ignora */ }
    }
  }, [atual])

  // painel → URL do Kytto (links internos como "Cadastrar catraca")
  useEffect(() => {
    const receber = (ev) => {
      if (ev.origin !== window.location.origin || ev.source !== frame.current?.contentWindow) return
      const rota = ev.data?.tipo === 'kytto-clube:rota' ? String(ev.data.rota || '') : ''
      if (IDS.has(rota) && rota !== atual) navigate(`/admin/clube/${rota}`, { replace: false })
    }
    window.addEventListener('message', receber)
    return () => window.removeEventListener('message', receber)
  }, [atual, navigate])

  if (indisponivel) {
    return (
      <div style={{ padding: 24, maxWidth: 560 }}>
        <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Clube & Academia</h1>
        <p style={{ color: 'var(--muted)' }}>O módulo ainda não está ligado neste ambiente. Ele precisa do Commerce Core ativo no servidor. Fale com o administrador da plataforma.</p>
      </div>
    )
  }

  return (
    <div style={{ margin: '-8px -4px 0', height: 'calc(100vh - 96px)', minHeight: 560 }}>
      <iframe
        ref={frame}
        title="Clube & Academia"
        src={inicial}
        onLoad={conferir}
        style={{ width: '100%', height: '100%', border: 0, borderRadius: 12, background: 'transparent' }}
      />
    </div>
  )
}

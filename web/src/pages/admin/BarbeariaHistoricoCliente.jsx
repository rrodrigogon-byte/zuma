import { useEffect, useMemo, useState } from 'react'
import { api, fmtDateOnly, fmtR } from '../../lib/api'

const LIMITE = 300

const EXTRAS_KEYWORDS = [
  'hidratacao', 'massagem', 'sobrancelha', 'selagem', 'pigmentacao',
  'limpeza', 'depilacao', 'spa', 'manicure', 'pedicure'
]

function maisFrequente(itens, campo) {
  const contagem = new Map()
  for (const item of itens) {
    const v = item[campo]
    if (v) contagem.set(v, (contagem.get(v) || 0) + 1)
  }
  let melhor = null
  for (const [v, n] of contagem) if (!melhor || n > melhor[1]) melhor = [v, n]
  return melhor
}

export default function BarbeariaHistoricoCliente({ clienteId, telefone = '', nome = '' }) {
  const [itens, setItens] = useState(null)
  const [erro, setErro] = useState('')
  const [mostrarTodos, setMostrarTodos] = useState(false)

  useEffect(() => {
    if (!clienteId && !telefone && !nome) return undefined
    let vivo = true
    setItens(null)
    setErro('')
    const params = new URLSearchParams()
    if (clienteId) params.set('clienteId', clienteId)
    if (telefone) params.set('telefone', telefone)
    if (nome) params.set('nome', nome)
    params.set('limite', String(LIMITE))

    api
      .get(`/api/admin/barbearia/historico?${params.toString()}`)
      .then((r) => {
        if (vivo) setItens(Array.isArray(r?.itens) ? r.itens : [])
      })
      .catch((e) => {
        if (vivo) setErro(e.message || 'Não foi possível carregar o histórico.')
      })
    return () => {
      vivo = false
    }
  }, [clienteId, telefone, nome])

  const resumo = useMemo(() => {
    if (!itens?.length) return null
    let totalGasto = 0
    let teveClub = false
    const extrasEncontrados = new Set()

    for (const item of itens) {
      const val = Number(item.valor || 0)
      totalGasto += val
      const servNorm = String(item.servicoNome || '').toLowerCase()
      if (servNorm.includes('club') || servNorm.includes('pacote')) teveClub = true
      for (const ex of EXTRAS_KEYWORDS) {
        if (servNorm.includes(ex)) extrasEncontrados.add(item.servicoNome)
      }
    }

    const ticketMedio = totalGasto / itens.length

    return {
      servico: maisFrequente(itens, 'servicoNome'),
      profissional: maisFrequente(itens, 'profissionalNome'),
      ultima: itens[0]?.dataAgenda,
      primeira: itens[itens.length - 1]?.dataAgenda,
      totalGasto,
      ticketMedio,
      teveClub,
      extras: [...extrasEncontrados],
    }
  }, [itens])

  const caixa = { border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'grid', gap: 12, background: 'rgba(255, 255, 255, 0.02)' }
  const sub = { fontSize: 12, color: 'var(--muted)' }

  if (erro) return <div style={caixa}><strong>Histórico de atendimentos</strong><div style={{ ...sub, color: '#e05c5c' }}>{erro}</div></div>
  if (!itens) return <div style={caixa}><strong>Histórico de atendimentos</strong><div style={sub}>Carregando histórico completo…</div></div>
  if (!itens.length) return <div style={caixa}><strong>Histórico de atendimentos</strong><div style={sub}>Nenhum atendimento anterior registrado para este cliente.</div></div>

  const visiveis = mostrarTodos ? itens : itens.slice(0, 10)
  return (
    <div style={caixa}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong>Histórico de Atendimentos & Avec</strong>
          {resumo.teveClub ? (
            <span style={{ fontSize: 11, background: '#8b5cf620', color: '#c084fc', border: '1px solid #8b5cf650', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
              🔄 Assinante Club / Pacote
            </span>
          ) : (
            <span style={{ fontSize: 11, background: '#3b82f620', color: '#60a5fa', border: '1px solid #3b82f650', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
              💳 Cliente Avulso
            </span>
          )}
        </div>
        <span style={sub}>
          {itens.length >= LIMITE ? `${LIMITE}+` : itens.length} atendimento(s) · de {fmtDateOnly(resumo.primeira)} a {fmtDateOnly(resumo.ultima)}
        </span>
      </div>

      {/* Cards de Métricas do Histórico */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 10, background: 'rgba(0,0,0,0.15)', padding: 10, borderRadius: 8 }}>
        <div>
          <div style={sub}>Total gasto acumulado</div>
          <strong style={{ color: '#10b981', fontSize: 15 }}>{fmtR(resumo.totalGasto)}</strong>
        </div>
        <div>
          <div style={sub}>Ticket médio por visita</div>
          <strong style={{ color: '#38bdf8', fontSize: 15 }}>{fmtR(resumo.ticketMedio)}</strong>
        </div>
        {resumo.profissional && (
          <div>
            <div style={sub}>Barbeiro habitual</div>
            <strong>{resumo.profissional[0]}</strong> <span style={sub}>({resumo.profissional[1]}×)</span>
          </div>
        )}
        {resumo.servico && (
          <div>
            <div style={sub}>Serviço mais frequente</div>
            <strong>{resumo.servico[0]}</strong> <span style={sub}>({resumo.servico[1]}×)</span>
          </div>
        )}
        <div>
          <div style={sub}>Última visita</div>
          <strong>{fmtDateOnly(resumo.ultima)}</strong>
        </div>
      </div>

      {resumo.extras?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ ...sub, fontWeight: 600 }}>Serviços extras consumidos:</span>
          {resumo.extras.map((ex) => (
            <span key={ex} style={{ fontSize: 11, background: 'rgba(255, 255, 255, 0.06)', padding: '2px 8px', borderRadius: 4 }}>
              {ex}
            </span>
          ))}
        </div>
      )}

      {/* Tabela de Visitas */}
      <div style={{ display: 'grid', gap: 4, maxHeight: 280, overflowY: 'auto' }}>
        {visiveis.map((item) => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '86px 1fr 140px 80px auto', gap: 8, fontSize: 12.5, padding: '6px 0', borderTop: '1px solid var(--border)', alignItems: 'center' }}>
            <span style={sub}>{fmtDateOnly(item.dataAgenda)}</span>
            <span>{item.servicoNome || 'Serviço'}</span>
            <span style={{ color: '#38bdf8', fontSize: 12 }}>{item.profissionalNome || '—'}</span>
            <span style={{ fontWeight: 600 }}>{item.valor ? fmtR(item.valor) : '—'}</span>
            <span style={{ ...sub, fontSize: 10, background: item.origem === 'avec' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: item.origem === 'avec' ? '#93c5fd' : '#6ee7b7', padding: '2px 5px', borderRadius: 4 }}>
              {item.origem === 'avec' ? 'AVEC' : 'KYTTO'}
            </span>
          </div>
        ))}
      </div>

      {itens.length > visiveis.length && (
        <button
          type="button"
          onClick={() => setMostrarTodos(true)}
          style={{ justifySelf: 'start', border: '1px solid var(--border)', background: 'transparent', color: 'inherit', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}
        >
          Ver todos os {itens.length} atendimentos
        </button>
      )}
    </div>
  )
}

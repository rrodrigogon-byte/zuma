import { useEffect, useMemo, useState } from 'react'
import { api, fmtDateOnly } from '../../lib/api'

// Histórico de atendimentos do cliente (inclui o que veio de outro sistema, como o AVEC).
// Só leitura: não gera financeiro, comissão, pontos nem aviso.
const LIMITE = 200

function maisFrequente(itens, campo) {
  const contagem = new Map()
  for (const item of itens) { const v = item[campo]; if (v) contagem.set(v, (contagem.get(v) || 0) + 1) }
  let melhor = null
  for (const [v, n] of contagem) if (!melhor || n > melhor[1]) melhor = [v, n]
  return melhor
}

export default function BarbeariaHistoricoCliente({ clienteId }) {
  const [itens, setItens] = useState(null)
  const [erro, setErro] = useState('')
  const [mostrarTodos, setMostrarTodos] = useState(false)

  useEffect(() => {
    if (!clienteId) return undefined
    let vivo = true
    setItens(null); setErro('')
    api.get(`/api/admin/barbearia/historico?clienteId=${encodeURIComponent(clienteId)}&limite=${LIMITE}`)
      .then((r) => { if (vivo) setItens(Array.isArray(r?.itens) ? r.itens : []) })
      .catch((e) => { if (vivo) setErro(e.message || 'Não foi possível carregar o histórico.') })
    return () => { vivo = false }
  }, [clienteId])

  const resumo = useMemo(() => {
    if (!itens?.length) return null
    return { servico: maisFrequente(itens, 'servicoNome'), profissional: maisFrequente(itens, 'profissionalNome'), ultima: itens[0]?.dataAgenda, primeira: itens[itens.length - 1]?.dataAgenda }
  }, [itens])

  const caixa = { border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'grid', gap: 10 }
  const sub = { fontSize: 12, color: 'var(--muted)' }

  if (erro) return <div style={caixa}><strong>Histórico de atendimentos</strong><div style={{ ...sub, color: '#e05c5c' }}>{erro}</div></div>
  if (!itens) return <div style={caixa}><strong>Histórico de atendimentos</strong><div style={sub}>Carregando…</div></div>
  if (!itens.length) return <div style={caixa}><strong>Histórico de atendimentos</strong><div style={sub}>Nenhum atendimento anterior registrado para este cliente.</div></div>

  const visiveis = mostrarTodos ? itens : itens.slice(0, 8)
  return <div style={caixa}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
      <strong>Histórico de atendimentos</strong>
      <span style={sub}>{itens.length >= LIMITE ? `${LIMITE}+` : itens.length} atendimento(s) · de {fmtDateOnly(resumo.primeira)} a {fmtDateOnly(resumo.ultima)}</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 8 }}>
      {resumo.servico && <div><div style={sub}>Serviço mais feito</div><strong>{resumo.servico[0]}</strong> <span style={sub}>({resumo.servico[1]}×)</span></div>}
      {resumo.profissional && <div><div style={sub}>Profissional preferido</div><strong>{resumo.profissional[0]}</strong> <span style={sub}>({resumo.profissional[1]}×)</span></div>}
      <div><div style={sub}>Última visita</div><strong>{fmtDateOnly(resumo.ultima)}</strong></div>
    </div>
    <div style={{ display: 'grid', gap: 4, maxHeight: 280, overflowY: 'auto' }}>
      {visiveis.map((item) => <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(86px, auto) 1fr auto', gap: 10, fontSize: 13, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
        <span style={sub}>{fmtDateOnly(item.dataAgenda)}{item.hora ? ` ${item.hora}` : ''}</span>
        <span>{item.servicoNome || 'Serviço'}{item.profissionalNome ? <span style={sub}> · {item.profissionalNome}</span> : null}</span>
        <span style={sub}>{item.origem === 'avec' ? 'AVEC' : (item.origem || '')}</span>
      </div>)}
    </div>
    {itens.length > visiveis.length && <button type="button" onClick={() => setMostrarTodos(true)} style={{ justifySelf: 'start', border: '1px solid var(--border)', background: 'transparent', color: 'inherit', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>Ver todos ({itens.length})</button>}
  </div>
}

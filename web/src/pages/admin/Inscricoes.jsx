import { useState, useEffect, useRef, useMemo } from 'react'
import { api, fmtR, fmtDate, fmtDateOnly } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

// Normaliza status do servidor ('aprovada','validada','pago'=true) para o padrão do front
function normStatus(i) {
  if (i.status === 'aprovada' || i.status === 'validada' || i.pago === true) return 'aprovado'
  if (i.status === 'cancelada' || i.status === 'recusada' || i.status === 'expirado') return 'cancelado'
  return i.status || 'pendente'
}

const STATUS_COLORS = {
  aprovado: { bg: '#FF6B2C22', color: '#FF6B2C', border: '#FF6B2C44', label: 'Aprovada' },
  pendente:  { bg: '#FF6B2C22', color: '#FF6B2C', border: '#FF6B2C44', label: 'Pendente' },
  cancelado: { bg: '#6b728022', color: '#9ca3af', border: '#6b728044', label: 'Cancelada' },
}

const statusBadge = (s) => {
  const map = { aprovado: 'badge-green', pendente: 'badge-yellow', cancelado: 'badge-gray' }
  return map[normStatus({ status: s })] || 'badge-gray'
}

function exportCSV(inscricoes) {
  const headers = ['ID', 'Nome', 'E-mail', 'CPF', 'Telefone', 'Categorias', 'Total (R$)', 'Pagamento', 'Status', 'Data Inscrição']
  const rows = inscricoes.map((i) => [
    i.id, i.nome, i.email, i.cpf || '',
    i.tel || i.telefone || '',
    (Array.isArray(i.categorias) ? i.categorias : [i.categoria]).filter(Boolean).join('; '),
    i.total != null ? Number(i.total).toFixed(2) : '',
    i.pagamento || '',
    normStatus(i),
    i.criadoEm ? fmtDate(i.criadoEm) : '',
  ])
  const csvContent = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inscricoes_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Inscricoes() {
  const [inscricoes, setInscricoes] = useState([])
  const [loading, setLoading]       = useState(true)
  const [filtro, setFiltro]         = useState('todos')
  const [filtroDataDe, setFiltroDataDe] = useState('')
  const [filtroDataAte, setFiltroDataAte] = useState('')
  const [selecionados, setSelecionados] = useState([])
  const [acao, setAcao]             = useState('aprovado')
  const [detalhe, setDetalhe]       = useState(null)
  const [busca, setBusca]           = useState('')
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/api/admin/inscricoes')
      setInscricoes(Array.isArray(data) ? data : data.inscricoes || [])
    } catch {
      toast('Erro ao carregar inscrições', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const contadores = useMemo(() => {
    const c = { pendente: 0, aprovado: 0, cancelado: 0 }
    inscricoes.forEach((i) => {
      const s = normStatus(i)
      if (c[s] != null) c[s]++
    })
    return c
  }, [inscricoes])

  const receita = useMemo(() =>
    inscricoes
      .filter(i => normStatus(i) === 'aprovado')
      .reduce((s, i) => s + Number(i.total || 0), 0)
  , [inscricoes])

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim()
    return inscricoes.filter((i) => {
      const s = normStatus(i)
      if (filtro !== 'todos' && s !== filtro) return false
      if (filtroDataDe && i.criadoEm && i.criadoEm < filtroDataDe) return false
      if (filtroDataAte && i.criadoEm && i.criadoEm.slice(0, 10) > filtroDataAte) return false
      if (q && !`${i.nome} ${i.email} ${i.dupla || ''} ${i.cpf || ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [inscricoes, filtro, filtroDataDe, filtroDataAte, busca])

  const toggleSel = (id) => setSelecionados((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  )
  const toggleAll = () => {
    const ids = filtrados.map((i) => i.id)
    setSelecionados((prev) => (prev.length === ids.length ? [] : ids))
  }

  // Mapa de 'aprovado' (front) → 'aprovada' (server) para manter consistência ao PATCH
  const statusParaServer = { aprovado: 'aprovada', cancelado: 'cancelada', pendente: 'pendente' }

  const handlePatch = async (id, statusFront) => {
    try {
      await api.patch(`/api/admin/inscricoes/${id}`, { status: statusParaServer[statusFront] || statusFront })
      toast(`Inscrição ${statusFront}`)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao atualizar', 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Excluir inscrição permanentemente?')) return
    try {
      await api.delete(`/api/admin/inscricoes/${id}`)
      toast('Inscrição excluída')
      load()
    } catch (e) {
      toast(e.message || 'Erro ao excluir', 'error')
    }
  }

  const handleMassa = async () => {
    if (selecionados.length === 0) { toast('Selecione ao menos uma inscrição', 'error'); return }
    if (!confirm(`Marcar ${selecionados.length} inscrição(ões) como "${acao}"?`)) return
    try {
      await Promise.all(
        selecionados.map((id) => api.patch(`/api/admin/inscricoes/${id}`, { status: statusParaServer[acao] || acao }))
      )
      toast(`${selecionados.length} inscrição(ões) atualizadas`)
      setSelecionados([])
      load()
    } catch {
      toast('Erro ao atualizar em massa', 'error')
    }
  }

  const allSelected = filtrados.length > 0 && selecionados.length === filtrados.length

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Inscrições</h1>
        <button className="btn btn-secondary" onClick={() => exportCSV(filtrados)}>
          📥 Exportar CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'TOTAL',           value: inscricoes.length,   color: '#FF6B2C', icon: '📋', sub: 'inscrições' },
          { label: 'APROVADAS',       value: contadores.aprovado, color: '#FF9B72', icon: '✅', sub: 'confirmadas' },
          { label: 'PENDENTES',       value: contadores.pendente, color: '#FF6B2C', icon: '⏳', sub: 'aguardando' },
          { label: 'CANCELADAS',      value: contadores.cancelado,color: '#e05c5c', icon: '❌', sub: 'rejeitadas' },
          { label: 'RECEITA APROVADA',value: fmtR(receita),       color: '#FF6B2C', icon: '💰', sub: 'valor confirmado' },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10,
            padding: '14px 18px', borderLeft: `4px solid ${k.color}`, flex: 1, minWidth: 130,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700 }}>{k.label}</div>
              <span style={{ fontSize: 16 }}>{k.icon}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Busca + Filtros de data */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input"
          placeholder="🔍 Buscar por nome, e-mail, CPF ou dupla…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>De:</span>
        <input type="date" value={filtroDataDe} onChange={e => setFiltroDataDe(e.target.value)}
          style={{ padding: '6px 10px', background: 'var(--card)', border: '1px solid #1e4a2e', borderRadius: 8, color: '#fff', fontSize: 13 }} />
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Até:</span>
        <input type="date" value={filtroDataAte} onChange={e => setFiltroDataAte(e.target.value)}
          style={{ padding: '6px 10px', background: 'var(--card)', border: '1px solid #1e4a2e', borderRadius: 8, color: '#fff', fontSize: 13 }} />
        {(filtroDataDe || filtroDataAte) && (
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={() => { setFiltroDataDe(''); setFiltroDataAte('') }}>Limpar datas</button>
        )}
      </div>

      {/* Filtros de status rápidos */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          ['todos',    'Todos',      '#FF6B2C'],
          ['pendente', 'Pendentes',  '#FF6B2C'],
          ['aprovado', 'Aprovadas',  '#FF9B72'],
          ['cancelado','Canceladas', '#e05c5c'],
        ].map(([s, label, color]) => (
          <button key={s}
            onClick={() => { setFiltro(s); setSelecionados([]) }}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${filtro === s ? color : 'var(--line)'}`,
              background: filtro === s ? color + '22' : 'transparent',
              color: filtro === s ? color : 'var(--muted)',
            }}
          >
            {label}{s !== 'todos' && ` (${contadores[s] ?? 0})`}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
          {filtrados.length} / {inscricoes.length} inscrições
        </span>
      </div>

      {/* Ações em massa */}
      {selecionados.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', background: '#12283F',
          border: '1px solid var(--green)', borderRadius: 8,
          marginBottom: 14, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>
            {selecionados.length} selecionada(s)
          </span>
          <select value={acao} onChange={e => setAcao(e.target.value)}
            style={{ padding: '5px 10px', background: 'var(--card)', border: '1px solid #1e4a2e', borderRadius: 6, color: '#fff', fontSize: 13 }}>
            <option value="aprovado">Aprovar</option>
            <option value="pendente">Pendente</option>
            <option value="cancelado">Cancelar</option>
          </select>
          <button className="btn btn-primary" style={{ fontSize: 13, padding: '5px 14px' }} onClick={handleMassa}>
            Aplicar
          </button>
          <button className="btn btn-secondary" style={{ fontSize: 13, padding: '5px 14px', marginLeft: 'auto' }}
            onClick={() => setSelecionados([])}>Desmarcar</button>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--muted)', padding: 16 }}>Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p style={{ color: 'var(--muted)', padding: 16 }}>Nenhuma inscrição encontrada.</p>
      ) : (
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e4a2e' }}>
                <th style={{ padding: '10px 12px' }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                {['Nome', 'E-mail', 'Categorias', 'Total', 'Pgto', 'Status', 'Data', 'Ações'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((i) => {
                const st = normStatus(i)
                const stCfg = STATUS_COLORS[st] || STATUS_COLORS.cancelado
                return (
                  <tr key={i.id}
                    style={{ borderBottom: '1px solid #1e4a2e11', background: selecionados.includes(i.id) ? '#1a4228' : 'transparent' }}
                    onMouseEnter={e => { if (!selecionados.includes(i.id)) e.currentTarget.style.background = '#1a3a2222' }}
                    onMouseLeave={e => { e.currentTarget.style.background = selecionados.includes(i.id) ? '#1a4228' : 'transparent' }}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <input type="checkbox" checked={selecionados.includes(i.id)} onChange={() => toggleSel(i.id)} />
                    </td>
                    <td style={{ padding: '10px 12px', color: '#fff', fontWeight: 500, cursor: 'pointer' }}
                      onClick={() => setDetalhe(i)} title="Ver detalhes">
                      <span style={{ borderBottom: '1px dashed #1e4a2e' }}>{i.nome}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12 }}>{i.email}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(Array.isArray(i.categorias) ? i.categorias : [i.categoria]).filter(Boolean).map((c, idx) => (
                          <span key={idx} style={{ background: '#FF6B2C18', color: '#FF6B2C', border: '1px solid #FF6B2C40', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{c}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#FF6B2C', whiteSpace: 'nowrap' }}>
                      {i.total != null ? fmtR(i.total) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {i.pagamento ? (
                        <span style={{
                          background: (i.pagamento === 'pago' || i.pago) ? '#FF6B2C18' : '#FF6B2C18',
                          color: (i.pagamento === 'pago' || i.pago) ? '#FF6B2C' : '#FF6B2C',
                          border: '1px solid',
                          borderColor: (i.pagamento === 'pago' || i.pago) ? '#FF6B2C40' : '#FF6B2C40',
                          borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                        }}>{i.pagamento}</span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        background: stCfg.bg, color: stCfg.color,
                        border: `1px solid ${stCfg.border}`,
                        borderRadius: 10, padding: '3px 10px', fontSize: 11, fontWeight: 700,
                      }}>{stCfg.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12 }}>
                      {i.criadoEm ? fmtDateOnly(i.criadoEm) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setDetalhe(i)}>Ver</button>
                        {st !== 'aprovado' && (
                          <button className="btn btn-primary btn-sm" onClick={() => handlePatch(i.id, 'aprovado')}>✓</button>
                        )}
                        {st !== 'cancelado' && (
                          <button className="btn btn-danger btn-sm" onClick={() => handlePatch(i.id, 'cancelado')}>✕</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal detalhes */}
      {detalhe && (
        <Modal title={`Inscrição #${detalhe.id} — ${detalhe.nome}`} onClose={() => setDetalhe(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Nome"           value={detalhe.nome} />
              <Field label="E-mail"         value={detalhe.email} />
              <Field label="Telefone"       value={detalhe.tel || detalhe.telefone} />
              <Field label="CPF"            value={detalhe.cpf} />
              <Field label="Nascimento"     value={detalhe.nasc ? fmtDateOnly(detalhe.nasc) : null} />
              <Field label="Total (R$)"     value={detalhe.total != null ? fmtR(detalhe.total) : null} />
              <Field label="Status"         value={
                <span style={{
                  background: (STATUS_COLORS[normStatus(detalhe)]?.bg),
                  color:  (STATUS_COLORS[normStatus(detalhe)]?.color),
                  border: `1px solid ${STATUS_COLORS[normStatus(detalhe)]?.border}`,
                  borderRadius: 10, padding: '3px 10px', fontSize: 12, fontWeight: 700,
                }}>{STATUS_COLORS[normStatus(detalhe)]?.label || detalhe.status}</span>
              } />
              <Field label="Pagamento"      value={detalhe.pagamento || '—'} />
              <Field label="Data inscrição" value={detalhe.criadoEm ? fmtDate(detalhe.criadoEm) : null} />
              <Field label="Categorias"     value={
                (Array.isArray(detalhe.categorias) ? detalhe.categorias : [detalhe.categoria])
                  .filter(Boolean).join(', ') || '—'
              } />
              {detalhe.dupla && <Field label="Dupla" value={detalhe.dupla} />}
              {detalhe.obs   && <Field label="Obs."  value={detalhe.obs} />}
            </div>

            {detalhe.historicoPagamento?.length > 0 && (
              <div>
                <h3 style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, fontWeight: 600 }}>Histórico de Pagamento</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detalhe.historicoPagamento.map((h, idx) => (
                    <li key={idx} style={{ fontSize: 12, color: '#ddd', display: 'flex', gap: 8, padding: '6px 10px', background: '#12283F55', borderRadius: 6 }}>
                      <span style={{ color: 'var(--muted)' }}>{h.data ? fmtDate(h.data) : '—'}</span>
                      <span>{h.evento || h.descricao}</span>
                      {h.valor != null && <span style={{ marginLeft: 'auto', color: '#FF6B2C', fontWeight: 600 }}>{fmtR(h.valor)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {normStatus(detalhe) !== 'aprovado' && (
                <button className="btn btn-primary" onClick={() => { handlePatch(detalhe.id, 'aprovado'); setDetalhe(null) }}>
                  ✅ Aprovar
                </button>
              )}
              {normStatus(detalhe) !== 'cancelado' && (
                <button className="btn btn-danger" onClick={() => { handlePatch(detalhe.id, 'cancelado'); setDetalhe(null) }}>
                  ✕ Rejeitar
                </button>
              )}
              <button className="btn btn-danger" style={{ background: '#7a1a1a' }}
                onClick={() => { handleDelete(detalhe.id); setDetalhe(null) }}>
                🗑 Excluir
              </button>
              <button className="btn btn-secondary" onClick={() => setDetalhe(null)}>Fechar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 14, color: '#fff' }}>{value ?? '—'}</div>
    </div>
  )
}

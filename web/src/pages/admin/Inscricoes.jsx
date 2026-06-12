import { useState, useEffect, useRef, useMemo } from 'react'
import { api, fmtR, fmtDate, fmtDateOnly } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const STATUS_OPTS = ['todos', 'pendente', 'aprovado', 'cancelado']

const STATUS_COLORS = {
  aprovado: { bg: '#5FB33522', color: '#5FB335', border: '#5FB33544' },
  pendente: { bg: '#C9A65622', color: '#C9A656', border: '#C9A65644' },
  cancelado: { bg: '#6b728022', color: '#9ca3af', border: '#6b728044' },
}

const statusBadge = (s) => {
  const map = { aprovado: 'badge-green', pendente: 'badge-yellow', cancelado: 'badge-gray' }
  return map[s] || 'badge-gray'
}

function exportCSV(inscricoes) {
  const headers = ['ID', 'Nome', 'Email', 'Categorias', 'Pagamento', 'Status', 'Data Inscrição']
  const rows = inscricoes.map((i) => [
    i.id,
    i.nome,
    i.email,
    (Array.isArray(i.categorias) ? i.categorias : [i.categoria]).filter(Boolean).join('; '),
    i.pagamento || '',
    i.status,
    i.criadoEm ? fmtDate(i.criadoEm) : '',
  ])
  const csvContent = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inscricoes_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Inscricoes() {
  const [inscricoes, setInscricoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [filtroDataDe, setFiltroDataDe] = useState('')
  const [filtroDataAte, setFiltroDataAte] = useState('')
  const [selecionados, setSelecionados] = useState([])
  const [acao, setAcao]               = useState('aprovado')
  const [detalhe, setDetalhe]         = useState(null)
  const [busca, setBusca]             = useState('')
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/api/admin/inscricoes')
      setInscricoes(data)
    } catch (e) {
      toast('Erro ao carregar inscrições', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const contadores = useMemo(() => {
    const c = { pendente: 0, aprovado: 0, cancelado: 0 }
    inscricoes.forEach((i) => { if (c[i.status] != null) c[i.status]++ })
    return c
  }, [inscricoes])

  const receita = useMemo(() => inscricoes.reduce((s, i) => s + (i.status === 'aprovado' ? Number(i.total || 0) : 0), 0), [inscricoes])

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim()
    return inscricoes.filter((i) => {
      if (filtro !== 'todos' && i.status !== filtro) return false
      if (filtroDataDe && i.criadoEm && i.criadoEm < filtroDataDe) return false
      if (filtroDataAte && i.criadoEm && i.criadoEm.slice(0, 10) > filtroDataAte) return false
      if (q && !`${i.nome} ${i.email} ${i.dupla || ''}`.toLowerCase().includes(q)) return false
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

  const handlePatch = async (id, status) => {
    try {
      await api.patch(`/api/admin/inscricoes/${id}`, { status })
      toast(`Inscrição ${status}`)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao atualizar', 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Excluir inscrição?')) return
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
      await Promise.all(selecionados.map((id) => api.patch(`/api/admin/inscricoes/${id}`, { status: acao })))
      toast(`${selecionados.length} inscrição(ões) atualizadas`)
      setSelecionados([])
      load()
    } catch (e) {
      toast('Erro ao atualizar em massa', 'error')
    }
  }

  const allSelected = filtrados.length > 0 && selecionados.length === filtrados.length

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Inscrições</h1>
        <button className="btn btn-secondary" onClick={() => exportCSV(filtrados)}>
          📥 Exportar CSV
        </button>
      </div>

      {/* KPI extra: receita aprovada */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ padding: '10px 18px', background: '#1e4a2e22', border: '1px solid #1e4a2e', borderRadius: 10, minWidth: 110 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 2 }}>Receita aprovada</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--green)' }}>
            {receita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>
      </div>

      {/* Busca */}
      <div style={{ marginBottom: 16 }}>
        <input
          className="input"
          placeholder="🔍 Buscar por nome, e-mail ou dupla…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ maxWidth: 300 }}
        />
      </div>

      {/* Contadores por status */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {['pendente', 'aprovado', 'cancelado'].map((s) => {
          const sc = STATUS_COLORS[s]
          return (
            <div
              key={s}
              onClick={() => { setFiltro(s); setSelecionados([]) }}
              style={{
                padding: '10px 18px',
                background: sc.bg,
                border: `1px solid ${sc.border}`,
                borderRadius: 10,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                minWidth: 100,
                transition: 'opacity 0.15s',
                opacity: filtro !== 'todos' && filtro !== s ? 0.5 : 1,
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 700, color: sc.color }}>{contadores[s]}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize' }}>{s}</span>
            </div>
          )
        })}
        <div
          onClick={() => { setFiltro('todos'); setSelecionados([]) }}
          style={{
            padding: '10px 18px',
            background: '#1e4a2e22',
            border: '1px solid #1e4a2e',
            borderRadius: 10,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 100,
            opacity: filtro !== 'todos' ? 0.5 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{inscricoes.length}</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Total</span>
        </div>
      </div>

      {/* Filtros de data */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Inscrição entre:</span>
        <input
          type="date"
          value={filtroDataDe}
          onChange={(e) => setFiltroDataDe(e.target.value)}
          style={{ padding: '6px 10px', background: 'var(--card)', border: '1px solid #1e4a2e', borderRadius: 8, color: '#fff', fontSize: 13 }}
        />
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>e</span>
        <input
          type="date"
          value={filtroDataAte}
          onChange={(e) => setFiltroDataAte(e.target.value)}
          style={{ padding: '6px 10px', background: 'var(--card)', border: '1px solid #1e4a2e', borderRadius: 8, color: '#fff', fontSize: 13 }}
        />
        {(filtroDataDe || filtroDataAte) && (
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={() => { setFiltroDataDe(''); setFiltroDataAte('') }}
          >
            Limpar
          </button>
        )}
      </div>

      {/* Ações em massa */}
      {selecionados.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            background: '#0E2E1C',
            border: '1px solid var(--green)',
            borderRadius: 8,
            marginBottom: 14,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13, color: '#fff' }}>{selecionados.length} selecionada(s)</span>
          <select
            value={acao}
            onChange={(e) => setAcao(e.target.value)}
            style={{ padding: '5px 10px', background: 'var(--card)', border: '1px solid #1e4a2e', borderRadius: 6, color: '#fff', fontSize: 13 }}
          >
            <option value="aprovado">Aprovar</option>
            <option value="pendente">Pendente</option>
            <option value="cancelado">Cancelar</option>
          </select>
          <button className="btn btn-primary" style={{ fontSize: 13, padding: '5px 14px' }} onClick={handleMassa}>
            Aplicar
          </button>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 13, padding: '5px 14px', marginLeft: 'auto' }}
            onClick={() => setSelecionados([])}
          >
            Desmarcar
          </button>
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
                {['Nome', 'E-mail', 'Categorias', 'Pagamento', 'Status', 'Data Inscrição', 'Ações'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((i) => (
                <tr
                  key={i.id}
                  style={{
                    borderBottom: '1px solid #1e4a2e11',
                    background: selecionados.includes(i.id) ? '#1a4228' : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (!selecionados.includes(i.id)) e.currentTarget.style.background = '#1a3a2222' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = selecionados.includes(i.id) ? '#1a4228' : 'transparent' }}
                >
                  <td style={{ padding: '10px 12px' }}>
                    <input type="checkbox" checked={selecionados.includes(i.id)} onChange={() => toggleSel(i.id)} />
                  </td>
                  <td
                    style={{ padding: '10px 12px', color: '#fff', fontWeight: 500, cursor: 'pointer' }}
                    onClick={() => setDetalhe(i)}
                    title="Ver detalhes"
                  >
                    <span style={{ borderBottom: '1px dashed #1e4a2e' }}>{i.nome}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{i.email}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(Array.isArray(i.categorias) ? i.categorias : [i.categoria]).filter(Boolean).map((c, idx) => (
                        <span key={idx} className="badge" style={{ background: '#5FB33522', color: '#5FB335', border: '1px solid #5FB33544', fontSize: 11 }}>{c}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {i.pagamento ? (
                      <span className={`badge ${i.pagamento === 'pago' ? 'badge-green' : 'badge-yellow'}`}>{i.pagamento}</span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className={`badge ${statusBadge(i.status)}`}>{i.status}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12 }}>
                    {i.criadoEm ? fmtDateOnly(i.criadoEm) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setDetalhe(i)}>Ver</button>
                      {i.status !== 'aprovado' && (
                        <button className="btn btn-primary btn-sm" onClick={() => handlePatch(i.id, 'aprovado')}>Aprovar</button>
                      )}
                      {i.status !== 'cancelado' && (
                        <button className="btn btn-danger btn-sm" onClick={() => handlePatch(i.id, 'cancelado')}>Rejeitar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de detalhes */}
      {detalhe && (
        <Modal title={`Inscrição #${detalhe.id} — ${detalhe.nome}`} onClose={() => setDetalhe(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Nome" value={detalhe.nome} />
              <Field label="E-mail" value={detalhe.email} />
              <Field label="Telefone" value={detalhe.telefone} />
              <Field label="CPF" value={detalhe.cpf} />
              <Field label="Status" value={
                <span className={`badge ${statusBadge(detalhe.status)}`}>{detalhe.status}</span>
              } />
              <Field label="Pagamento" value={detalhe.pagamento || '—'} />
              <Field label="Data de inscrição" value={detalhe.criadoEm ? fmtDate(detalhe.criadoEm) : '—'} />
              <Field label="Categorias" value={
                (Array.isArray(detalhe.categorias) ? detalhe.categorias : [detalhe.categoria])
                  .filter(Boolean).join(', ') || '—'
              } />
            </div>

            {/* Histórico de pagamento */}
            {detalhe.historicoPagamento?.length > 0 && (
              <div>
                <h3 style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, fontWeight: 600 }}>Histórico de Pagamento</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detalhe.historicoPagamento.map((h, i) => (
                    <li key={i} style={{ fontSize: 12, color: '#ddd', display: 'flex', gap: 8, padding: '6px 10px', background: '#0E2E1C55', borderRadius: 6 }}>
                      <span style={{ color: 'var(--muted)' }}>{h.data ? fmtDate(h.data) : '—'}</span>
                      <span>{h.evento || h.descricao}</span>
                      {h.valor != null && <span style={{ marginLeft: 'auto', color: '#5FB335', fontWeight: 600 }}>{fmtR(h.valor)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {detalhe.status !== 'aprovado' && (
                <button className="btn btn-primary" onClick={() => { handlePatch(detalhe.id, 'aprovado'); setDetalhe(null) }}>
                  Aprovar
                </button>
              )}
              {detalhe.status !== 'cancelado' && (
                <button className="btn btn-danger" onClick={() => { handlePatch(detalhe.id, 'cancelado'); setDetalhe(null) }}>
                  Rejeitar
                </button>
              )}
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
      <div style={{ fontSize: 14, color: '#fff' }}>{value || '—'}</div>
    </div>
  )
}

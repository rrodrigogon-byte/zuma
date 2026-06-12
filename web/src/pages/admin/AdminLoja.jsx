import { useState, useEffect, useMemo } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const CATS = ['Kit', 'Camiseta', 'Boné', 'Acessório', 'Outro']
const STATUS_BADGE = {
  pendente:  { label: 'Pendente',  color: '#C9A656' },
  confirmada:{ label: 'Confirmada',color: '#5FB335' },
  cancelada: { label: 'Cancelada', color: '#e05c5c' },
  entregue:  { label: 'Entregue',  color: '#8FD64A' },
}
const STATUS_OPTS = ['todos', 'pendente', 'confirmada', 'entregue', 'cancelada']

const EMPTY_PROD = { nome: '', cat: 'Kit', preco: '', estoque: '', descricao: '' }

function KpiCard({ label, valor, icon, color }) {
  return (
    <div style={{
      background: 'var(--surface)', border: `1.5px solid ${color}44`,
      borderTop: `3px solid ${color}`, borderRadius: 10, padding: '14px 16px',
      flex: 1, minWidth: 140,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{valor}</div>
    </div>
  )
}

function exportCSV(reservas) {
  const headers = ['ID', 'Produto', 'Atleta', 'E-mail', 'Tel', 'Tamanho', 'Status', 'Data']
  const rows = reservas.map(r => [
    r.id, r.produto || '', r.nome || '', r.email || '', r.tel || '',
    r.tamanho || '', r.status || '', r.criadoEm ? fmtDate(r.criadoEm) : '',
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reservas_loja_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminLoja() {
  const { toast } = useToast()
  const [aba, setAba]           = useState('produtos')
  const [produtos, setProdutos] = useState([])
  const [reservas, setReservas] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm]         = useState(EMPTY_PROD)
  const [saving, setSaving]     = useState(false)

  // Filtros reservas
  const [buscaRes, setBuscaRes]         = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  async function load() {
    setLoading(true)
    try {
      const [prods, res] = await Promise.all([
        api.get('/api/admin/loja'),
        api.get('/api/admin/loja/reservas'),
      ])
      setProdutos(Array.isArray(prods) ? prods : [])
      setReservas(Array.isArray(res) ? res : [])
    } catch {
      toast('Erro ao carregar loja', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // KPIs
  const totalProdutos  = produtos.length
  const totalEstoque   = produtos.reduce((s, p) => s + (p.estoque || 0), 0)
  const receitaPotenc  = produtos.reduce((s, p) => s + (p.preco || 0) * (p.estoque || 0), 0)
  const reservasPend   = reservas.filter(r => r.status === 'pendente').length
  const receitaVendas  = reservas
    .filter(r => r.status === 'confirmada' || r.status === 'entregue')
    .reduce((s, r) => s + (r.valor || 0), 0)

  // Filtro reservas
  const reservasFiltradas = useMemo(() => {
    return reservas.filter(r => {
      const matchStatus = filtroStatus === 'todos' || r.status === filtroStatus
      const q = buscaRes.toLowerCase()
      const matchBusca = !q || (r.nome || '').toLowerCase().includes(q) ||
        (r.produto || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q)
      return matchStatus && matchBusca
    })
  }, [reservas, filtroStatus, buscaRes])

  function abrirNovo() { setEditando(null); setForm(EMPTY_PROD); setModal(true) }
  function abrirEdit(p) {
    setEditando(p.id)
    setForm({ nome: p.nome, cat: p.cat, preco: p.preco, estoque: p.estoque, descricao: p.descricao || '' })
    setModal(true)
  }

  async function salvar() {
    if (!form.nome.trim()) return toast('Nome obrigatório', 'error')
    if (!form.preco || isNaN(form.preco)) return toast('Preço inválido', 'error')
    setSaving(true)
    try {
      const body = { ...form, preco: parseFloat(form.preco), estoque: parseInt(form.estoque) || 0 }
      if (editando) {
        await api.patch(`/api/admin/loja/${editando}`, body)
        toast('Produto atualizado')
      } else {
        await api.post('/api/admin/loja', body)
        toast('Produto criado')
      }
      setModal(false)
      load()
    } catch {
      toast('Erro ao salvar produto', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function excluir(id, nome) {
    if (!confirm(`Excluir "${nome}"?`)) return
    try {
      await api.delete(`/api/admin/loja/${id}`)
      toast('Produto excluído')
      load()
    } catch {
      toast('Erro ao excluir', 'error')
    }
  }

  async function atualizarStatus(id, status) {
    try {
      await api.patch(`/api/admin/loja/reservas/${id}`, { status })
      toast('Status atualizado')
      load()
    } catch {
      toast('Erro ao atualizar status', 'error')
    }
  }

  const S = {
    page:   { padding: '1.5rem', maxWidth: 1100, margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 10 },
    h1:     { color: 'var(--fg)', fontWeight: 700, fontSize: '1.4rem', margin: 0 },
    tabs:   { display: 'flex', gap: 8, marginBottom: '1rem', borderBottom: '2px solid var(--border)' },
    tab:    (a) => ({ padding: '0.5rem 1.25rem', background: 'none', border: 'none', borderBottom: a ? '2px solid var(--green)' : '2px solid transparent', color: a ? 'var(--green)' : 'var(--muted)', fontWeight: a ? 700 : 400, cursor: 'pointer', marginBottom: -2 }),
    btn:    { padding: '0.5rem 1rem', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
    btnSm:  (c) => ({ padding: '0.3rem 0.65rem', background: c || 'var(--surface2)', color: c ? '#fff' : 'var(--fg)', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }),
    table:  { width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: 8, overflow: 'hidden' },
    th:     { background: 'var(--surface2)', color: 'var(--muted)', fontSize: '0.78rem', padding: '0.55rem 0.75rem', textAlign: 'left', fontWeight: 600 },
    td:     { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--fg)', fontSize: '0.9rem' },
    badge:  (c) => ({ display: 'inline-block', padding: '0.2rem 0.55rem', borderRadius: 12, background: c + '22', color: c, fontSize: '0.75rem', fontWeight: 700 }),
    field:  { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: '0.85rem' },
    label:  { color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 600 },
    input:  { padding: '0.45rem 0.65rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg)', fontSize: '0.9rem' },
    actions:{ display: 'flex', gap: 6 },
    select: { padding: '0.45rem 0.65rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg)', fontSize: '0.9rem' },
  }

  if (loading) return <div style={S.page}><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.h1}>🛍️ Loja — Kit Atleta</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {aba === 'reservas' && reservas.length > 0 && (
            <button style={{ ...S.btn, background: '#1e4029', border: '1px solid var(--green)' }}
              onClick={() => exportCSV(reservasFiltradas)}>
              ⬇ CSV
            </button>
          )}
          {aba === 'produtos' && (
            <button style={S.btn} onClick={abrirNovo}>+ Novo Produto</button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <KpiCard label="Produtos" valor={totalProdutos} icon="📦" color="#5FB335" />
        <KpiCard label="Estoque Total" valor={`${totalEstoque} un`} icon="🗃️" color="#C9A656" />
        <KpiCard label="Receita Potencial" valor={fmtR(receitaPotenc)} icon="💰" color="#8FD64A" />
        <KpiCard label="Reservas Pendentes" valor={reservasPend} icon="⏳" color={reservasPend > 0 ? '#e05c5c' : '#5FB335'} />
        {receitaVendas > 0 && (
          <KpiCard label="Receita Confirmada" valor={fmtR(receitaVendas)} icon="✅" color="#5FB335" />
        )}
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        <button style={S.tab(aba === 'produtos')} onClick={() => setAba('produtos')}>
          Produtos ({produtos.length})
        </button>
        <button style={S.tab(aba === 'reservas')} onClick={() => setAba('reservas')}>
          Reservas ({reservas.length})
          {reservasPend > 0 && (
            <span style={{ marginLeft: 6, background: '#e05c5c', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>
              {reservasPend}
            </span>
          )}
        </button>
      </div>

      {/* Aba: Produtos */}
      {aba === 'produtos' && (
        <table style={S.table}>
          <thead>
            <tr>
              {['Nome', 'Categoria', 'Preço', 'Estoque', 'Descrição', ''].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {produtos.length === 0 && (
              <tr><td colSpan={6} style={{ ...S.td, color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>
                Nenhum produto cadastrado.
              </td></tr>
            )}
            {produtos.map(p => (
              <tr key={p.id}>
                <td style={S.td}><strong>{p.nome}</strong></td>
                <td style={S.td}><span style={S.badge('#C9A656')}>{p.cat}</span></td>
                <td style={S.td}>{fmtR(p.preco)}</td>
                <td style={S.td}>
                  <span style={S.badge(p.estoque > 5 ? '#5FB335' : p.estoque > 0 ? '#C9A656' : '#e05c5c')}>
                    {p.estoque > 0 ? `${p.estoque} un` : '⚠ SEM ESTOQUE'}
                  </span>
                </td>
                <td style={{ ...S.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.descricao || '—'}
                </td>
                <td style={S.td}>
                  <div style={S.actions}>
                    <button style={S.btnSm()} onClick={() => abrirEdit(p)}>Editar</button>
                    <button style={S.btnSm('#e05c5c')} onClick={() => excluir(p.id, p.nome)}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Aba: Reservas */}
      {aba === 'reservas' && (
        <>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              style={{ ...S.input, minWidth: 200, flex: 1 }}
              placeholder="🔍 Buscar por atleta, produto ou e-mail…"
              value={buscaRes}
              onChange={e => setBuscaRes(e.target.value)}
            />
            <select style={S.select} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              {STATUS_OPTS.map(s => (
                <option key={s} value={s}>{s === 'todos' ? 'Todos os status' : STATUS_BADGE[s]?.label || s}</option>
              ))}
            </select>
            {(buscaRes || filtroStatus !== 'todos') && (
              <button style={S.btnSm()} onClick={() => { setBuscaRes(''); setFiltroStatus('todos') }}>
                ✕ Limpar
              </button>
            )}
          </div>

          <table style={S.table}>
            <thead>
              <tr>
                {['#', 'Produto', 'Atleta', 'E-mail', 'Tamanho', 'Status', 'Data', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reservasFiltradas.length === 0 && (
                <tr><td colSpan={8} style={{ ...S.td, color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>
                  Nenhuma reserva encontrada.
                </td></tr>
              )}
              {reservasFiltradas.map(r => {
                const bd = STATUS_BADGE[r.status] || { label: r.status, color: '#888' }
                return (
                  <tr key={r.id}>
                    <td style={S.td}>{r.id}</td>
                    <td style={S.td}><strong>{r.produto}</strong></td>
                    <td style={S.td}>{r.nome}</td>
                    <td style={{ ...S.td, fontSize: '0.8rem' }}>{r.email}</td>
                    <td style={S.td}>{r.tamanho || '—'}</td>
                    <td style={S.td}><span style={S.badge(bd.color)}>{bd.label}</span></td>
                    <td style={{ ...S.td, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{fmtDate(r.criadoEm)}</td>
                    <td style={S.td}>
                      <div style={S.actions}>
                        {r.status === 'pendente' && (
                          <>
                            <button style={S.btnSm('#5FB335')} onClick={() => atualizarStatus(r.id, 'confirmada')}>✓ Confirmar</button>
                            <button style={S.btnSm('#e05c5c')} onClick={() => atualizarStatus(r.id, 'cancelada')}>✕</button>
                          </>
                        )}
                        {r.status === 'confirmada' && (
                          <button style={S.btnSm('#8FD64A')} onClick={() => atualizarStatus(r.id, 'entregue')}>📦 Entregar</button>
                        )}
                        {(r.status === 'entregue' || r.status === 'cancelada') && (
                          <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {reservasFiltradas.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
              {reservasFiltradas.length} reserva{reservasFiltradas.length !== 1 ? 's' : ''} encontrada{reservasFiltradas.length !== 1 ? 's' : ''}
            </div>
          )}
        </>
      )}

      {/* Modal produto */}
      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Produto' : 'Novo Produto'}>
        <div>
          <div style={S.field}>
            <label style={S.label}>Nome *</label>
            <input style={S.input} value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Kit Atleta Premium" />
          </div>
          <div style={S.field}>
            <label style={S.label}>Categoria</label>
            <select style={S.select} value={form.cat}
              onChange={e => setForm(f => ({ ...f, cat: e.target.value }))}>
              {CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={S.field}>
              <label style={S.label}>Preço (R$) *</label>
              <input style={S.input} type="number" step="0.01" min="0" value={form.preco}
                onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} placeholder="0,00" />
            </div>
            <div style={S.field}>
              <label style={S.label}>Estoque</label>
              <input style={S.input} type="number" min="0" value={form.estoque}
                onChange={e => setForm(f => ({ ...f, estoque: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <div style={S.field}>
            <label style={S.label}>Descrição</label>
            <textarea style={{ ...S.input, resize: 'vertical', minHeight: 70 }} value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Descrição opcional…" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button style={{ ...S.btnSm(), padding: '0.5rem 1rem' }} onClick={() => setModal(false)}>Cancelar</button>
            <button style={{ ...S.btn, opacity: saving ? 0.6 : 1 }} onClick={salvar} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

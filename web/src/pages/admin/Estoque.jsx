import { useState, useEffect, useRef } from 'react'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const EMPTY_ENTRADA = { produtoId: '', qtd: '', custo: '' }

export default function Estoque() {
  const toast = useToast()
  const [estoque, setEstoque]     = useState([])
  const [alertas, setAlertas]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [filtro, setFiltro]       = useState('todos')       // 'todos' | 'baixo'
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState(EMPTY_ENTRADA)
  const [saving, setSaving]       = useState(false)
  const [editMin, setEditMin]     = useState({})             // { produtoId: valorStr }
  const minRefs                   = useRef({})

  async function load() {
    setLoading(true)
    try {
      const data = await api.get('/api/admin/estoque')
      setEstoque(data.estoque || [])
      setAlertas(data.alertas || [])
    } catch {
      toast('Erro ao carregar estoque', true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function salvarEntrada() {
    if (!form.produtoId) return toast('Selecione um produto', true)
    const qtd = parseInt(form.qtd)
    if (isNaN(qtd) || qtd < 1) return toast('Quantidade inválida', true)
    setSaving(true)
    try {
      const body = { produtoId: Number(form.produtoId), qtd }
      if (form.custo !== '') body.custo = parseFloat(form.custo)
      await api.post('/api/admin/estoque/entrada', body)
      toast('Entrada registrada')
      setModal(false)
      setForm(EMPTY_ENTRADA)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao registrar entrada', true)
    } finally {
      setSaving(false)
    }
  }

  function iniciarEditMin(item) {
    setEditMin(prev => ({ ...prev, [item.produtoId]: String(item.min ?? '') }))
    // foco após render
    setTimeout(() => minRefs.current[item.produtoId]?.focus(), 50)
  }

  async function salvarMin(produtoId) {
    const val = editMin[produtoId]
    if (val === undefined) return
    const min = parseInt(val)
    if (isNaN(min) || min < 0) return toast('Mínimo inválido', true)
    try {
      await api.patch(`/api/admin/estoque/${produtoId}`, { min })
      toast('Mínimo atualizado')
      setEditMin(prev => { const c = { ...prev }; delete c[produtoId]; return c })
      load()
    } catch (e) {
      toast(e.message || 'Erro ao salvar mínimo', true)
    }
  }

  const valorTotal = estoque.reduce((s, it) => s + (it.qtd || 0) * (it.custo || 0), 0)

  const lista = filtro === 'baixo'
    ? estoque.filter(it => it.qtd < it.min)
    : estoque

  if (loading) return <div className="page"><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Estoque</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={load}>↺ Atualizar</button>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY_ENTRADA); setModal(true) }}>
            + Entrada
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid2" style={{ marginBottom: 24, maxWidth: 480 }}>
        <div className="kpi">
          <div className="kpi-label">Alertas Estoque Baixo</div>
          <div className="kpi-value" style={{ color: alertas.length > 0 ? '#e74c3c' : 'var(--green)' }}>
            {alertas.length}
          </div>
          {alertas.length > 0 && (
            <div className="kpi-sub">{alertas.map(a => a.nome).join(', ')}</div>
          )}
        </div>
        <div className="kpi">
          <div className="kpi-label">Valor Total em Estoque</div>
          <div className="kpi-value" style={{ color: 'var(--lime)', fontSize: 22 }}>{fmtR(valorTotal)}</div>
        </div>
      </div>

      {/* Filtro */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['todos', 'baixo'].map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filtro === f ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFiltro(f)}
          >
            {f === 'todos' ? 'Todos' : 'Abaixo do mínimo'}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Qtd Atual</th>
              <th>Mínimo</th>
              <th>Custo Unit.</th>
              <th>Valor Total</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>
                  Nenhum item encontrado.
                </td>
              </tr>
            )}
            {lista.map(it => {
              const baixo     = it.qtd < it.min
              const editandoMin = editMin[it.produtoId] !== undefined
              return (
                <tr
                  key={it.produtoId}
                  style={baixo ? {
                    animation: 'pulse 1.5s ease-in-out infinite',
                    background: 'rgba(192,57,43,.07)',
                  } : {}}
                >
                  <td>
                    <strong>{it.nome}</strong>
                    {baixo && <span className="badge badge-red" style={{ marginLeft: 8 }}>Baixo</span>}
                  </td>
                  <td>
                    <span style={{ color: baixo ? '#e74c3c' : 'var(--text)', fontWeight: 700 }}>
                      {it.qtd}
                    </span>
                  </td>
                  <td>
                    {editandoMin ? (
                      <input
                        ref={el => (minRefs.current[it.produtoId] = el)}
                        type="number" min="0"
                        value={editMin[it.produtoId]}
                        onChange={e => setEditMin(prev => ({ ...prev, [it.produtoId]: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') salvarMin(it.produtoId)
                          if (e.key === 'Escape') setEditMin(prev => { const c = { ...prev }; delete c[it.produtoId]; return c })
                        }}
                        onBlur={() => salvarMin(it.produtoId)}
                        style={{ width: 80, padding: '4px 8px', fontSize: 13 }}
                      />
                    ) : (
                      <span
                        title="Clique para editar"
                        onClick={() => iniciarEditMin(it)}
                        style={{ cursor: 'pointer', borderBottom: '1px dashed var(--muted)', paddingBottom: 1 }}
                      >
                        {it.min ?? 0}
                      </span>
                    )}
                  </td>
                  <td>{it.custo != null ? fmtR(it.custo) : '—'}</td>
                  <td>{fmtR((it.qtd || 0) * (it.custo || 0))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Animação pulse inline */}
      <style>{`
        @keyframes pulse {
          0%, 100% { background-color: rgba(192,57,43,.07); }
          50%       { background-color: rgba(192,57,43,.18); }
        }
      `}</style>

      {/* Modal: entrada de estoque */}
      {modal && (
        <Modal title="Entrada de Estoque" onClose={() => setModal(false)}>
          <div style={{ padding: '4px 0 8px' }}>
            <div className="form-group">
              <label>Produto</label>
              <select value={form.produtoId} onChange={e => setForm(f => ({ ...f, produtoId: e.target.value }))}>
                <option value="">Selecione…</option>
                {estoque.map(it => (
                  <option key={it.produtoId} value={it.produtoId}>{it.nome}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Quantidade *</label>
                <input
                  type="number" min="1"
                  value={form.qtd}
                  onChange={e => setForm(f => ({ ...f, qtd: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="form-group">
                <label>Custo Unitário (R$)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={form.custo}
                  onChange={e => setForm(f => ({ ...f, custo: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarEntrada} disabled={saving}>
                {saving ? 'Salvando…' : 'Registrar Entrada'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

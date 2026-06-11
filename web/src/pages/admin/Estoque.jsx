import { useState, useEffect, useRef } from 'react'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const EMPTY_ENTRADA = { produtoId: '', qtd: '', custo: '' }

export default function Estoque() {
  const { toast } = useToast()
  const [estoque, setEstoque]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [filtro, setFiltro]         = useState('todos')   // 'todos' | 'baixo' | 'ok'
  const [modal, setModal]           = useState(false)
  const [form, setForm]             = useState(EMPTY_ENTRADA)
  const [saving, setSaving]         = useState(false)
  const [editMin, setEditMin]       = useState({})        // { id: valorStr }
  const [expandido, setExpandido]   = useState({})        // { id: bool } — histórico aberto
  const minRefs                     = useRef({})

  async function load() {
    setLoading(true)
    try {
      const data = await api.get('/api/admin/estoque')
      // API retorna array plano ou { estoque, alertas }
      const lista = Array.isArray(data) ? data : (data.estoque || [])
      setEstoque(lista)
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
    const key = item.id ?? item.produtoId
    setEditMin(prev => ({ ...prev, [key]: String(item.min ?? '') }))
    setTimeout(() => minRefs.current[key]?.focus(), 50)
  }

  async function salvarMin(item) {
    const key = item.id ?? item.produtoId
    const val = editMin[key]
    if (val === undefined) return
    const min = parseInt(val)
    if (isNaN(min) || min < 0) return toast('Mínimo inválido', true)
    try {
      await api.post('/api/admin/estoque/ajuste', { produtoId: key, min })
      toast('Mínimo atualizado')
      setEditMin(prev => { const c = { ...prev }; delete c[key]; return c })
      load()
    } catch (e) {
      toast(e.message || 'Erro ao salvar mínimo', true)
    }
  }

  function toggleExpandido(key) {
    setExpandido(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const alertas = estoque.filter(it => (it.qtd ?? 0) < (it.min ?? 0))
  const valorTotal = estoque.reduce((s, it) => s + (it.qtd || 0) * (it.custo || 0), 0)

  const lista = filtro === 'baixo'
    ? estoque.filter(it => (it.qtd ?? 0) < (it.min ?? 0))
    : filtro === 'ok'
    ? estoque.filter(it => (it.qtd ?? 0) >= (it.min ?? 0))
    : estoque

  if (loading) return <div className="page"><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>

  return (
    <div className="page">
      {/* Animações inline */}
      <style>{`
        @keyframes pulse-row {
          0%, 100% { background-color: rgba(192,57,43,.08); }
          50%       { background-color: rgba(192,57,43,.20); }
        }
        @keyframes badge-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: .7; transform: scale(1.1); }
        }
        .badge-alerta-anim {
          animation: badge-pulse 1.4s ease-in-out infinite;
        }
        .row-baixo {
          animation: pulse-row 1.5s ease-in-out infinite;
          color: #e74c3c !important;
        }
        .nivel-bar-track {
          background: rgba(255,255,255,.1);
          border-radius: 6px;
          height: 6px;
          width: 100%;
          overflow: hidden;
        }
        .nivel-bar-fill {
          height: 100%;
          border-radius: 6px;
          transition: width .3s;
        }
      `}</style>

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

      {/* Banner de alerta — visível quando há itens abaixo do mínimo */}
      {alertas.length > 0 && (
        <div style={{
          background: 'rgba(192,57,43,.15)',
          border: '1px solid rgba(192,57,43,.5)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, color: '#e74c3c', fontSize: 14, marginBottom: 4 }}>
              {alertas.length} {alertas.length === 1 ? 'item abaixo' : 'itens abaixo'} do estoque mínimo
            </div>
            <div style={{ color: '#e98080', fontSize: 13, lineHeight: 1.6 }}>
              {alertas.map((a, i) => (
                <span key={a.id ?? a.produtoId}>
                  <strong>{a.nome}</strong>
                  {' '}({a.qtd ?? 0}/{a.min ?? 0})
                  {i < alertas.length - 1 ? ' · ' : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

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

      {/* Filtros rápidos */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'todos', label: 'Todos' },
          { key: 'baixo', label: '⚠️ Abaixo do mínimo' },
          { key: 'ok',    label: '✅ OK' },
        ].map(f => (
          <button
            key={f.key}
            className={`btn btn-sm ${filtro === f.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFiltro(f.key)}
          >
            {f.label}
            {f.key === 'baixo' && alertas.length > 0 && (
              <span
                className="badge-alerta-anim"
                style={{
                  marginLeft: 6,
                  background: '#e74c3c',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '0 6px',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'inline-block',
                }}
              >
                {alertas.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Nível</th>
              <th style={{ textAlign: 'center' }}>Qtd Atual</th>
              <th style={{ textAlign: 'center' }}>Mínimo</th>
              <th>Custo Unit.</th>
              <th>Valor Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>
                  Nenhum item encontrado.
                </td>
              </tr>
            )}
            {lista.map(it => {
              const key         = it.id ?? it.produtoId
              const qtd         = it.qtd ?? 0
              const min         = it.min ?? 0
              const baixo       = qtd < min
              const pct         = min > 0 ? Math.min(100, Math.round((qtd / min) * 100)) : 100
              const editandoMin = editMin[key] !== undefined
              const hist        = it.historico || []
              const aberto      = !!expandido[key]
              return (
                <>
                  <tr
                    key={key}
                    className={baixo ? 'row-baixo' : ''}
                    style={baixo ? {
                      background: 'rgba(192,57,43,.08)',
                    } : {}}
                  >
                    <td>
                      <strong style={{ color: baixo ? '#e74c3c' : 'inherit' }}>{it.nome}</strong>
                      {baixo && (
                        <span
                          className="badge badge-red badge-alerta-anim"
                          style={{ marginLeft: 8 }}
                        >
                          Baixo
                        </span>
                      )}
                    </td>

                    {/* Barra de nível */}
                    <td style={{ minWidth: 100 }}>
                      <div className="nivel-bar-track">
                        <div
                          className="nivel-bar-fill"
                          style={{
                            width: pct + '%',
                            background: baixo ? '#e74c3c' : '#5FB335',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                        {pct}%
                      </div>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span style={{ color: baixo ? '#e74c3c' : 'var(--text)', fontWeight: 700 }}>
                        {qtd}
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      {editandoMin ? (
                        <input
                          ref={el => (minRefs.current[key] = el)}
                          type="number" min="0"
                          value={editMin[key]}
                          onChange={e => setEditMin(prev => ({ ...prev, [key]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') salvarMin(it)
                            if (e.key === 'Escape') setEditMin(prev => { const c = { ...prev }; delete c[key]; return c })
                          }}
                          onBlur={() => salvarMin(it)}
                          style={{ width: 70, padding: '4px 8px', fontSize: 13 }}
                        />
                      ) : (
                        <span
                          title="Clique para editar"
                          onClick={() => iniciarEditMin(it)}
                          style={{ cursor: 'pointer', borderBottom: '1px dashed var(--muted)', paddingBottom: 1 }}
                        >
                          {min}
                        </span>
                      )}
                    </td>

                    <td>{it.custo != null ? fmtR(it.custo) : '—'}</td>
                    <td>{fmtR(qtd * (it.custo || 0))}</td>
                    <td>
                      {hist.length > 0 && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => toggleExpandido(key)}
                        >
                          {aberto ? '▲ Ocultar' : '▼ Histórico'}
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Linha de histórico expandível */}
                  {aberto && hist.length > 0 && (
                    <tr key={`${key}-hist`}>
                      <td colSpan={7} style={{ padding: '8px 16px 12px', background: 'rgba(0,0,0,.2)' }}>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
                          Últimas movimentações
                        </div>
                        <table style={{ width: '100%', fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th style={{ color: 'var(--muted)', fontWeight: 500, textAlign: 'left', paddingBottom: 4 }}>Data/Hora</th>
                              <th style={{ color: 'var(--muted)', fontWeight: 500, textAlign: 'left' }}>Tipo</th>
                              <th style={{ color: 'var(--muted)', fontWeight: 500, textAlign: 'right' }}>Qtd</th>
                              <th style={{ color: 'var(--muted)', fontWeight: 500, textAlign: 'right' }}>Custo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...hist].reverse().slice(0, 10).map((mov, i) => (
                              <tr key={i}>
                                <td style={{ color: 'var(--text)', paddingRight: 16 }}>
                                  {mov.ts ? new Date(mov.ts).toLocaleString('pt-BR') : '—'}
                                </td>
                                <td>
                                  <span style={{
                                    color: mov.tipo === 'entrada' ? '#5FB335' : '#e74c3c',
                                    fontWeight: 600,
                                  }}>
                                    {mov.tipo || 'entrada'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                  {mov.tipo !== 'entrada' ? '-' : '+'}{mov.qtd ?? '—'}
                                </td>
                                <td style={{ textAlign: 'right', color: 'var(--muted)' }}>
                                  {mov.custo ? fmtR(mov.custo) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: entrada de estoque */}
      {modal && (
        <Modal title="Entrada de Estoque" onClose={() => setModal(false)}>
          <div style={{ padding: '4px 0 8px' }}>
            <div className="form-group">
              <label>Produto</label>
              <select value={form.produtoId} onChange={e => setForm(f => ({ ...f, produtoId: e.target.value }))}>
                <option value="">Selecione…</option>
                {estoque.map(it => (
                  <option key={it.id ?? it.produtoId} value={it.id ?? it.produtoId}>{it.nome}</option>
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

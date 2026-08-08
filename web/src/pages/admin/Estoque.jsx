import { useState, useEffect, useRef, useMemo } from 'react'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const EMPTY_ENTRADA = { produtoId: '', qtd: '', custo: '' }

function exportCSV(lista) {
  const headers = ['Produto','Categoria','Qtd Atual','Mínimo','Custo Unit.','Valor Total','Status']
  const rows = lista.map(it => {
    const qtd = it.qtd ?? 0
    const min = it.min ?? 0
    const custo = it.custo || 0
    return [it.nome, it.cat || '—', qtd, min, fmtR(custo), fmtR(qtd*custo), qtd < min ? 'Baixo' : 'OK']
  })
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type:'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href=url; a.download=`estoque_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function Estoque() {
  const { toast } = useToast()
  const [estoque, setEstoque]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [filtro, setFiltro]         = useState('todos')   // 'todos' | 'baixo' | 'ok'
  const [busca, setBusca]           = useState('')
  const [filtroCat, setFiltroCat]   = useState('Todas')
  const [modal, setModal]           = useState(false)
  const [form, setForm]             = useState(EMPTY_ENTRADA)
  const [saving, setSaving]         = useState(false)
  const [editMin, setEditMin]       = useState({})        // { id: valorStr }
  const [expandido, setExpandido]   = useState({})        // { id: bool } — histórico aberto
  const [ajustando, setAjustando]   = useState({})        // { id: bool } — loading de ajuste rápido
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

  // Ajuste rápido +1/-1
  async function ajustarRapido(item, delta) {
    const key = item.id ?? item.produtoId
    const novaQtd = Math.max(0, (item.qtd ?? 0) + delta)
    setAjustando(prev => ({ ...prev, [key]: true }))
    try {
      if (delta > 0) {
        await api.post('/api/admin/estoque/entrada', { produtoId: key, qtd: delta })
      } else {
        await api.post('/api/admin/estoque/ajuste', { produtoId: key, qtd: novaQtd })
      }
      load()
    } catch (e) {
      toast(e.message || 'Erro ao ajustar', 'error')
    } finally {
      setAjustando(prev => ({ ...prev, [key]: false }))
    }
  }

  const alertas = estoque.filter(it => (it.qtd ?? 0) < (it.min ?? 0))
  const valorTotal = estoque.reduce((s, it) => s + (it.qtd || 0) * (it.custo || 0), 0)

  // Extrair categorias únicas
  const categorias = useMemo(() => {
    const cats = [...new Set(estoque.map(it => it.cat || 'Sem categoria').filter(Boolean))]
    return ['Todas', ...cats.sort()]
  }, [estoque])

  // Breakdown valor por categoria
  const valorPorCat = useMemo(() => {
    const map = {}
    estoque.forEach(it => {
      const cat = it.cat || 'Sem categoria'
      map[cat] = (map[cat] || 0) + (it.qtd || 0) * (it.custo || 0)
    })
    return Object.entries(map).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1])
  }, [estoque])

  const lista = useMemo(() => {
    let base = filtro === 'baixo'
      ? estoque.filter(it => (it.qtd ?? 0) < (it.min ?? 0))
      : filtro === 'ok'
      ? estoque.filter(it => (it.qtd ?? 0) >= (it.min ?? 0))
      : estoque
    if (filtroCat !== 'Todas') {
      base = base.filter(it => (it.cat || 'Sem categoria') === filtroCat)
    }
    if (busca) {
      const q = busca.toLowerCase()
      base = base.filter(it => (it.nome || '').toLowerCase().includes(q))
    }
    return base
  }, [estoque, filtro, busca, filtroCat])

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
          <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(lista)} title="Exportar CSV">📥 CSV</button>
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
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:10, marginBottom:20 }}>
        <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:10, padding:'12px 16px',
          borderLeft:`4px solid ${alertas.length > 0 ? '#e74c3c' : 'var(--green)'}` }}>
          <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Alertas Baixo</div>
          <div style={{ fontSize:22, fontWeight:800, color: alertas.length > 0 ? '#e74c3c' : 'var(--green)' }}>{alertas.length}</div>
          {alertas.length > 0 && <div style={{ fontSize:10, color:'#e74c3c', marginTop:3 }}>{alertas.slice(0,2).map(a=>a.nome).join(', ')}{alertas.length>2?` +${alertas.length-2}`:''}</div>}
        </div>
        <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:10, padding:'12px 16px',
          borderLeft:'4px solid var(--lime)' }}>
          <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Valor em Estoque</div>
          <div style={{ fontSize:20, fontWeight:800, color:'var(--lime)' }}>{fmtR(valorTotal)}</div>
        </div>
        <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:10, padding:'12px 16px',
          borderLeft:'4px solid #3b82f6' }}>
          <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Itens Cadastrados</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#3b82f6' }}>{estoque.length}</div>
        </div>
        {valorPorCat.length > 0 && (
          <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:10, padding:'12px 16px',
            borderLeft:'4px solid #FF6B2C', gridColumn:'span 1' }}>
            <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:6 }}>Valor por Categoria</div>
            {valorPorCat.slice(0,3).map(([cat, val]) => (
              <div key={cat} style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
                <span style={{ color:'var(--muted)' }}>{cat}</span>
                <span style={{ fontWeight:700, color:'#FF6B2C' }}>{fmtR(val)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Busca + Filtros rápidos */}
      <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap', alignItems:'center' }}>
        <input
          style={{ flex:1, minWidth:180, padding: '8px 12px', background: 'var(--card)', border: '1px solid #12283F', borderRadius: 8, color: '#fff', fontSize: 13, boxSizing: 'border-box' }}
          placeholder="🔍 Buscar produto por nome…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)}
          style={{ padding:'8px 10px', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:8, color:'var(--cream)', fontSize:13 }}>
          {categorias.map(c => <option key={c}>{c}</option>)}
        </select>
        <span style={{ fontSize:12, color:'var(--muted)', whiteSpace:'nowrap' }}>{lista.length} itens</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap:'wrap' }}>
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
              <th style={{ textAlign: 'center' }}>Ajuste Rápido</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>
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
                            background: baixo ? '#e74c3c' : '#FF6B2C',
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
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
                        <button
                          onClick={() => ajustarRapido(it, -1)}
                          disabled={ajustando[key] || qtd <= 0}
                          style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #e74c3c', background: '#e74c3c22', color: '#e74c3c', cursor: 'pointer', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: qtd <= 0 ? 0.4 : 1 }}>
                          −
                        </button>
                        <button
                          onClick={() => ajustarRapido(it, 1)}
                          disabled={ajustando[key]}
                          style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #FF6B2C', background: '#FF6B2C22', color: '#FF6B2C', cursor: 'pointer', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          +
                        </button>
                      </div>
                    </td>
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
                      <td colSpan={8} style={{ padding: '8px 16px 12px', background: 'rgba(0,0,0,.2)' }}>
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
                                    color: mov.tipo === 'entrada' ? '#FF6B2C' : '#e74c3c',
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

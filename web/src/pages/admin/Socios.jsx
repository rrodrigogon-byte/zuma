import { useState, useEffect, useMemo } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const PLANOS = ['Básico', 'Prata', 'Ouro', 'Diamante']

function exportCSV(socios) {
  const headers = ['ID', 'Nome', 'E-mail', 'Plano', 'Saldo', 'Limite', 'Status']
  const rows = socios.map(s => [s.id, s.nome, s.email, s.plano, s.saldo || 0, s.limite || 0, statusSocio(s)])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `socios_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

const EMPTY_FORM = { nome: '', email: '', plano: 'Básico', limite: '' }
const EMPTY_FAT  = { valor: '', descricao: '' }

function statusSocio(s) {
  if (s.status === 'late' || s.faturas?.some(f => f.status === 'atrasada')) return 'late'
  const uso = s.limite > 0 ? s.saldo / s.limite : 0
  if (uso >= 0.7) return 'warn'
  return 'ok'
}

const STATUS_CFG = {
  ok:   { badge: 'badge-green', label: 'OK',      barColor: 'var(--green)' },
  warn: { badge: 'badge-gold',  label: 'Atenção',  barColor: 'var(--gold)'  },
  late: { badge: 'badge-red',   label: 'Atraso',   barColor: '#e74c3c'      },
}

function Avatar({ nome }) {
  const initial = (nome || '?')[0].toUpperCase()
  return (
    <div style={{
      width: 42, height: 42, borderRadius: '50%',
      background: 'var(--green)', color: 'var(--deep)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: 18, flexShrink: 0,
    }}>
      {initial}
    </div>
  )
}

export default function Socios() {
  const { toast } = useToast()
  const [socios, setSocios]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [expandido, setExpandido]   = useState(null)
  const [modal, setModal]           = useState(false)
  const [fatModal, setFatModal]     = useState(null)   // socioId
  const [form, setForm]             = useState(EMPTY_FORM)
  const [fatForm, setFatForm]       = useState(EMPTY_FAT)
  const [saving, setSaving]         = useState(false)
  const [editLimite, setEditLimite] = useState({})    // { id: str }
  const [busca, setBusca]           = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroPlan, setFiltroPlan] = useState('todos')

  async function load() {
    setLoading(true)
    try {
      const data = await api.get('/api/admin/socios')
      setSocios(data)
    } catch {
      toast('Erro ao carregar sócios', true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function criarSocio() {
    if (!form.nome.trim()) return toast('Nome obrigatório', true)
    if (!form.email.trim()) return toast('E-mail obrigatório', true)
    setSaving(true)
    try {
      const body = { ...form, limite: parseFloat(form.limite) || 0 }
      await api.post('/api/admin/socios', body)
      toast('Sócio criado')
      setModal(false)
      setForm(EMPTY_FORM)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao criar sócio', true)
    } finally {
      setSaving(false)
    }
  }

  async function excluirSocio(id, nome) {
    if (!confirm(`Excluir o sócio "${nome}"?`)) return
    try {
      await api.delete(`/api/admin/socios/${id}`)
      toast('Sócio removido')
      load()
    } catch (e) {
      toast(e.message || 'Erro ao excluir', true)
    }
  }

  async function salvarLimite(id) {
    const val = editLimite[id]
    if (val === undefined) return
    const limite = parseFloat(val)
    if (isNaN(limite) || limite < 0) return toast('Limite inválido', true)
    try {
      await api.patch(`/api/admin/socios/${id}`, { limite })
      toast('Limite atualizado')
      setEditLimite(prev => { const c = { ...prev }; delete c[id]; return c })
      load()
    } catch (e) {
      toast(e.message || 'Erro ao salvar limite', true)
    }
  }

  async function emitirFatura(socioId) {
    const valor = parseFloat(fatForm.valor)
    if (isNaN(valor) || valor <= 0) return toast('Valor inválido', true)
    if (!fatForm.descricao.trim()) return toast('Descrição obrigatória', true)
    setSaving(true)
    try {
      await api.post(`/api/admin/socios/${socioId}/fatura`, { valor, descricao: fatForm.descricao })
      toast('Fatura emitida')
      setFatModal(null)
      setFatForm(EMPTY_FAT)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao emitir fatura', true)
    } finally {
      setSaving(false)
    }
  }

  async function pagarFatura(socioId, faturaId) {
    if (!confirm('Confirmar pagamento desta fatura?')) return
    try {
      await api.post(`/api/admin/socios/${socioId}/pagar`, { faturaId })
      toast('Fatura paga')
      load()
    } catch (e) {
      toast(e.message || 'Erro ao pagar fatura', true)
    }
  }

  const totalReceber = socios.reduce((s, sc) => s + (sc.saldo || 0), 0)
  const emAtraso     = socios.filter(sc => statusSocio(sc) === 'late').length
  const emAtencao    = socios.filter(sc => statusSocio(sc) === 'warn').length
  const emOk         = socios.filter(sc => statusSocio(sc) === 'ok').length
  const totalLimite  = socios.reduce((s, sc) => s + (sc.limite || 0), 0)

  const sociosFiltrados = useMemo(() => {
    return socios.filter(sc => {
      if (filtroStatus !== 'todos' && statusSocio(sc) !== filtroStatus) return false
      if (filtroPlan !== 'todos' && sc.plano !== filtroPlan) return false
      if (busca && !sc.nome.toLowerCase().includes(busca.toLowerCase()) && !sc.email?.toLowerCase().includes(busca.toLowerCase())) return false
      return true
    })
  }, [socios, filtroStatus, filtroPlan, busca])

  if (loading) return <div className="page"><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Sócios</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(sociosFiltrados)}>📥 CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY_FORM); setModal(true) }}>+ Novo Sócio</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10, marginBottom:20 }}>
        {[
          { label:'Total Sócios', val:socios.length, color:'#3b82f6', icon:'👥' },
          { label:'A Receber', val:fmtR(totalReceber), color:'var(--lime)', icon:'💰' },
          { label:'Limite Total', val:fmtR(totalLimite), color:'var(--green)', icon:'📊' },
          { label:'Em Atraso', val:emAtraso, color: emAtraso > 0 ? '#e74c3c' : 'var(--green)', icon:'🔴' },
          { label:'Atenção', val:emAtencao, color: emAtencao > 0 ? '#C9A656' : 'var(--muted)', icon:'⚠️' },
          { label:'Regular', val:emOk, color:'var(--green)', icon:'✅' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:10,
            padding:'12px 16px', borderLeft:`4px solid ${k.color}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
              <span style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.4px', fontWeight:700 }}>{k.label}</span>
              <span style={{ fontSize:16 }}>{k.icon}</span>
            </div>
            <div style={{ fontSize:20, fontWeight:800, color:k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="🔍 Buscar por nome ou e-mail…" value={busca} onChange={e => setBusca(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--cream)', fontSize: 13 }} />
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          style={{ padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--cream)', fontSize: 13 }}>
          <option value="todos">Todos status</option>
          <option value="ok">OK</option>
          <option value="warn">Atenção</option>
          <option value="late">Atraso</option>
        </select>
        <select value={filtroPlan} onChange={e => setFiltroPlan(e.target.value)}
          style={{ padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--cream)', fontSize: 13 }}>
          <option value="todos">Todos planos</option>
          {PLANOS.map(p => <option key={p}>{p}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{sociosFiltrados.length} de {socios.length}</span>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sociosFiltrados.length === 0 && (
          <p style={{ color: 'var(--muted)' }}>Nenhum sócio encontrado.</p>
        )}
        {sociosFiltrados.map(sc => {
          const st       = statusSocio(sc)
          const stCfg    = STATUS_CFG[st]
          const usoFrac  = sc.limite > 0 ? Math.min(sc.saldo / sc.limite, 1) : 0
          const aberto   = expandido === sc.id
          const editando = editLimite[sc.id] !== undefined

          return (
            <div
              key={sc.id}
              className="card"
              style={{
                borderColor: st === 'late' ? 'rgba(231,76,60,.35)'
                           : st === 'warn' ? 'rgba(201,166,86,.35)'
                           : undefined,
              }}
            >
              {/* Linha principal */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Avatar nome={sc.nome} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: 'var(--cream)', fontSize: 15 }}>{sc.nome}</span>
                    <span className={`badge ${stCfg.badge}`}>{stCfg.label}</span>
                    <span className="badge badge-muted">{sc.plano}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{sc.email}</div>

                  {/* Barra saldo/limite */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                      <span>Saldo utilizado: {fmtR(sc.saldo)}</span>
                      <span>
                        Limite: {editando ? (
                          <input
                            type="number" min="0" step="10"
                            value={editLimite[sc.id]}
                            onChange={e => setEditLimite(prev => ({ ...prev, [sc.id]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') salvarLimite(sc.id)
                              if (e.key === 'Escape') setEditLimite(prev => { const c = { ...prev }; delete c[sc.id]; return c })
                            }}
                            onBlur={() => salvarLimite(sc.id)}
                            style={{ width: 90, padding: '2px 6px', fontSize: 11, display: 'inline-block' }}
                          />
                        ) : (
                          <span
                            title="Clique para editar"
                            onClick={() => setEditLimite(prev => ({ ...prev, [sc.id]: String(sc.limite ?? '') }))}
                            style={{ cursor: 'pointer', borderBottom: '1px dashed var(--muted)' }}
                          >
                            {fmtR(sc.limite)}
                          </span>
                        )}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(usoFrac * 100).toFixed(1)}%`,
                        background: stCfg.barColor,
                        borderRadius: 3,
                        transition: 'width .3s',
                      }} />
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setExpandido(aberto ? null : sc.id)}
                  >
                    {aberto ? '▲' : '▼'} Faturas
                  </button>
                  <button className="btn btn-gold btn-sm" onClick={() => { setFatModal(sc.id); setFatForm(EMPTY_FAT) }}>
                    + Fatura
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => excluirSocio(sc.id, sc.nome)}>
                    ✕
                  </button>
                </div>
              </div>

              {/* Faturas expandidas */}
              {aberto && (
                <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                  {sc.faturas?.length > 0 ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Descrição</th>
                            <th>Valor</th>
                            <th>Vencimento</th>
                            <th>Status</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {sc.faturas.map(fat => (
                            <tr key={fat.id}>
                              <td>{fat.descricao}</td>
                              <td>{fmtR(fat.valor)}</td>
                              <td>{fmtDate(fat.vencimento)}</td>
                              <td>
                                <span className={
                                  fat.status === 'paga'     ? 'badge badge-green' :
                                  fat.status === 'atrasada' ? 'badge badge-red'   : 'badge badge-gold'
                                }>
                                  {fat.status}
                                </span>
                              </td>
                              <td>
                                {fat.status !== 'paga' && (
                                  <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => pagarFatura(sc.id, fat.id)}
                                  >
                                    Pagar
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhuma fatura.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal: novo sócio */}
      {modal && (
        <Modal title="Novo Sócio" onClose={() => setModal(false)}>
          <div style={{ padding: '4px 0 8px' }}>
            <div className="form-group">
              <label>Nome *</label>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" />
            </div>
            <div className="form-group">
              <label>E-mail *</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Plano</label>
                <select value={form.plano} onChange={e => setForm(f => ({ ...f, plano: e.target.value }))}>
                  {PLANOS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Limite (R$)</label>
                <input type="number" min="0" step="50" value={form.limite} onChange={e => setForm(f => ({ ...f, limite: e.target.value }))} placeholder="0,00" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={criarSocio} disabled={saving}>
                {saving ? 'Salvando…' : 'Criar Sócio'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: emitir fatura */}
      {fatModal && (
        <Modal title="Nova Fatura" onClose={() => setFatModal(null)}>
          <div style={{ padding: '4px 0 8px' }}>
            <div className="form-group">
              <label>Descrição *</label>
              <input value={fatForm.descricao} onChange={e => setFatForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Mensalidade Julho 2026" />
            </div>
            <div className="form-group">
              <label>Valor (R$) *</label>
              <input type="number" min="0.01" step="0.01" value={fatForm.valor} onChange={e => setFatForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setFatModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => emitirFatura(fatModal)} disabled={saving}>
                {saving ? 'Emitindo…' : 'Emitir Fatura'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

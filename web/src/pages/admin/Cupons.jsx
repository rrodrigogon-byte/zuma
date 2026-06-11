import { useState, useEffect } from 'react'
import { api, fmtR, fmtDate, fmtDateOnly } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const EMPTY_FORM = {
  codigo: '', tipo: 'pct', valor: '', maxUsos: '', validade: '',
  uso: 'ambos', descricao: '', ativo: true,
}

function randomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function isExpired(validade) {
  if (!validade) return false
  return new Date(validade + 'T23:59:59') < new Date()
}

export default function Cupons() {
  const { toast } = useToast()
  const [cupons, setCupons]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [toggling, setToggling] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const data = await api.get('/api/admin/cupons')
      setCupons(Array.isArray(data) ? data : data.cupons || [])
    } catch {
      toast('Erro ao carregar cupons', true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function criar() {
    if (!form.codigo.trim()) return toast('Código obrigatório', true)
    if (!form.valor || isNaN(Number(form.valor))) return toast('Valor inválido', true)
    setSaving(true)
    try {
      await api.post('/api/admin/cupons', {
        ...form,
        valor: Number(form.valor),
        maxUsos: form.maxUsos ? Number(form.maxUsos) : null,
      })
      toast('Cupom criado')
      setModal(false)
      setForm(EMPTY_FORM)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao criar cupom', true)
    } finally {
      setSaving(false)
    }
  }

  async function toggleAtivo(c) {
    setToggling(c.id)
    try {
      await api.patch(`/api/admin/cupons/${c.id}`, { ativo: !c.ativo })
      setCupons(prev => prev.map(x => x.id === c.id ? { ...x, ativo: !x.ativo } : x))
    } catch (e) {
      toast(e.message || 'Erro ao atualizar', true)
    } finally {
      setToggling(null)
    }
  }

  async function excluir(id) {
    if (!window.confirm('Excluir este cupom?')) return
    try {
      await api.delete(`/api/admin/cupons/${id}`)
      toast('Cupom excluído')
      setCupons(prev => prev.filter(c => c.id !== id))
    } catch (e) {
      toast(e.message || 'Erro ao excluir', true)
    }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => toast('Código copiado!'))
  }

  const ativos       = cupons.filter(c => c.ativo && !isExpired(c.validade)).length
  const totalUsos    = cupons.reduce((s, c) => s + (c.usos || 0), 0)

  const kpiStyle = {
    background: 'var(--surface)', border: '1px solid var(--line)',
    borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 140,
  }

  return (
    <div style={{ padding: '24px 16px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--cream)' }}>🎟️ Cupons</h2>
        <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY_FORM); setModal(true) }}>
          + Novo Cupom
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <div style={kpiStyle}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>TOTAL CUPONS</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--cream)' }}>{cupons.length}</div>
        </div>
        <div style={kpiStyle}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>ATIVOS</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--green)' }}>{ativos}</div>
        </div>
        <div style={kpiStyle}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>UTILIZAÇÕES TOTAIS</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--gold)' }}>{totalUsos}</div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" /></div>
      ) : cupons.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
          Nenhum cupom cadastrado.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Uso</th>
                <th>Utilizações</th>
                <th>Validade</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cupons.map(c => {
                const expired = isExpired(c.validade)
                return (
                  <tr key={c.id}>
                    <td>
                      <button
                        onClick={() => copyCode(c.codigo)}
                        style={{
                          background: 'rgba(95,179,53,.12)', color: 'var(--green)',
                          border: 'none', borderRadius: 6, padding: '3px 8px',
                          fontWeight: 800, cursor: 'pointer', fontFamily: 'monospace',
                          fontSize: 13,
                        }}
                        title="Clique para copiar"
                      >
                        {c.codigo} 📋
                      </button>
                      {c.descricao && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{c.descricao}</div>
                      )}
                    </td>
                    <td>
                      <span className={c.tipo === 'pct' ? 'badge badge-green' : 'badge badge-gold'}>
                        {c.tipo === 'pct' ? 'Percentual' : 'Fixo'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      {c.tipo === 'pct' ? `${c.valor}%` : fmtR(c.valor)}
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'rgba(143,214,74,.12)', color: 'var(--lime)' }}>
                        {c.uso === 'bar' ? 'Bar' : c.uso === 'inscricao' ? 'Inscrição' : 'Ambos'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {c.usos || 0}{c.maxUsos ? `/${c.maxUsos}` : ''}
                    </td>
                    <td>
                      {c.validade ? (
                        <span style={{ color: expired ? '#e74c3c' : 'var(--cream)', fontSize: 13 }}>
                          {fmtDateOnly(c.validade)}
                          {expired && <span className="badge badge-red" style={{ marginLeft: 6 }}>Expirado</span>}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      {!expired ? (
                        <button
                          className={`badge ${c.ativo ? 'badge-green' : 'badge-red'}`}
                          style={{ cursor: 'pointer', border: 'none', padding: '4px 10px', fontWeight: 700 }}
                          onClick={() => toggleAtivo(c)}
                          disabled={toggling === c.id}
                        >
                          {c.ativo ? 'Ativo' : 'Inativo'}
                        </button>
                      ) : (
                        <span className="badge badge-red">Expirado</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#e74c3c', padding: '4px 8px' }}
                        onClick={() => excluir(c.id)}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal title="Novo Cupom" onClose={() => setModal(false)} width={480}>
          <div style={{ padding: '0 0 4px' }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
                Código
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  style={{ flex: 1, fontFamily: 'monospace', textTransform: 'uppercase' }}
                  value={form.codigo}
                  onChange={e => setForm(p => ({ ...p, codigo: e.target.value.toUpperCase() }))}
                  placeholder="EX: AGRO10"
                />
                <button
                  className="btn btn-ghost btn-sm"
                  title="Gerar código aleatório"
                  onClick={() => setForm(p => ({ ...p, codigo: randomCode() }))}
                  style={{ fontSize: 18 }}
                >
                  🎲
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
                  Tipo
                </label>
                <select className="input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="pct">Percentual (%)</option>
                  <option value="fixo">Valor Fixo (R$)</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
                  {form.tipo === 'pct' ? 'Desconto (%)' : 'Valor (R$)'}
                </label>
                <input
                  className="input" type="number" min={0}
                  value={form.valor}
                  onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
                  Uso
                </label>
                <select className="input" value={form.uso} onChange={e => setForm(p => ({ ...p, uso: e.target.value }))}>
                  <option value="ambos">Ambos</option>
                  <option value="bar">Bar</option>
                  <option value="inscricao">Inscrição</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
                  Máx. Usos
                </label>
                <input
                  className="input" type="number" min={1}
                  placeholder="Ilimitado"
                  value={form.maxUsos}
                  onChange={e => setForm(p => ({ ...p, maxUsos: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
                Validade
              </label>
              <input
                className="input" type="date"
                value={form.validade}
                onChange={e => setForm(p => ({ ...p, validade: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
                Descrição (opcional)
              </label>
              <input
                className="input"
                value={form.descricao}
                onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                placeholder="Ex: Desconto inauguração"
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={criar} disabled={saving}>
                {saving ? 'Criando…' : 'Criar Cupom'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const STATUS_OPTS = ['todos', 'pago', 'pendente', 'cancelado']

const statusBadge = (s) => {
  const map = { pago: 'badge-green', pendente: 'badge-yellow', cancelado: 'badge-gray' }
  return map[s] || 'badge-gray'
}

function KpiCard({ label, valor, cls }) {
  return (
    <div className={`kpi-card ${cls || ''}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-valor">{valor}</span>
    </div>
  )
}

export default function Pagamentos() {
  const [pagamentos, setPagamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [confirmando, setConfirmando] = useState(null)
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const data = await api('/api/admin/pagamentos')
      setPagamentos(data)
    } catch (e) {
      toast('Erro ao carregar pagamentos', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalRecebido = pagamentos.filter(p => p.status === 'pago').reduce((s, p) => s + (p.valor || 0), 0)
  const totalPendente = pagamentos.filter(p => p.status === 'pendente').reduce((s, p) => s + (p.valor || 0), 0)
  const totalCancelado = pagamentos.filter(p => p.status === 'cancelado').reduce((s, p) => s + (p.valor || 0), 0)

  const filtrados = filtro === 'todos' ? pagamentos : pagamentos.filter(p => p.status === filtro)

  const handlePatch = async (id, status) => {
    setConfirmando(id)
    try {
      await api(`/api/admin/pagamentos/${id}`, { method: 'PATCH', body: { status } })
      toast(`Pagamento marcado como ${status}`)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao atualizar', 'error')
    } finally {
      setConfirmando(null)
    }
  }

  const confirmarManual = (id) => {
    if (!confirm('Confirmar pagamento manualmente?')) return
    handlePatch(id, 'pago')
  }

  return (
    <div className="page-pagamentos">
      <div className="page-header">
        <h1>Pagamentos</h1>
        <span className="subtitle">{pagamentos.length} transações</span>
      </div>

      <div className="kpi-row">
        <KpiCard label="Recebido" valor={fmtR(totalRecebido)} cls="kpi-green" />
        <KpiCard label="Pendente" valor={fmtR(totalPendente)} cls="kpi-yellow" />
        <KpiCard label="Cancelado" valor={fmtR(totalCancelado)} cls="kpi-gray" />
      </div>

      <div className="toolbar">
        <div className="filtro-tabs">
          {STATUS_OPTS.map(s => (
            <button
              key={s}
              className={`tab ${filtro === s ? 'active' : ''}`}
              onClick={() => setFiltro(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== 'todos' && (
                <span className="tab-count">{pagamentos.filter(p => p.status === s).length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="loading-msg">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p className="empty-msg">Nenhum pagamento encontrado.</p>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Usuário</th>
                <th>Tipo</th>
                <th>Meio</th>
                <th>Valor</th>
                <th>Data</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => (
                <tr key={p.id}>
                  <td className="id-col">{p.id}</td>
                  <td>{p.usuario || '—'}</td>
                  <td>{p.tipo || '—'}</td>
                  <td>{p.meio || '—'}</td>
                  <td><strong>{fmtR(p.valor)}</strong></td>
                  <td>{fmtDate(p.criadoEm)}</td>
                  <td>
                    <span className={`badge ${statusBadge(p.status)}`}>{p.status}</span>
                  </td>
                  <td className="actions">
                    {p.status === 'pendente' && (
                      <button
                        className="btn-sm btn-primary"
                        disabled={confirmando === p.id}
                        onClick={() => confirmarManual(p.id)}
                      >
                        {confirmando === p.id ? '…' : 'Confirmar'}
                      </button>
                    )}
                    {p.status === 'pago' && (
                      <button
                        className="btn-sm btn-warning"
                        disabled={confirmando === p.id}
                        onClick={() => { if (confirm('Estornar pagamento?')) handlePatch(p.id, 'cancelado') }}
                      >
                        Estornar
                      </button>
                    )}
                    {p.status === 'cancelado' && (
                      <button
                        className="btn-sm btn-outline"
                        disabled={confirmando === p.id}
                        onClick={() => confirmarManual(p.id)}
                      >
                        Reativar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

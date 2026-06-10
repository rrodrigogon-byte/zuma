import { useState, useEffect } from 'react'
import { api, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const STATUS_OPTS = ['todos', 'pendente', 'aprovado', 'cancelado']

const statusBadge = (s) => {
  const map = { aprovado: 'badge-green', pendente: 'badge-yellow', cancelado: 'badge-gray' }
  return map[s] || 'badge-gray'
}

export default function Inscricoes() {
  const [inscricoes, setInscricoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [selecionados, setSelecionados] = useState([])
  const [acao, setAcao] = useState('aprovado')
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const data = await api('/api/admin/inscricoes')
      setInscricoes(data)
    } catch (e) {
      toast('Erro ao carregar inscrições', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtrados = filtro === 'todos' ? inscricoes : inscricoes.filter(i => i.status === filtro)

  const toggleSel = (id) => setSelecionados(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  )

  const toggleAll = () => {
    const ids = filtrados.map(i => i.id)
    setSelecionados(prev => prev.length === ids.length ? [] : ids)
  }

  const handlePatch = async (id, status) => {
    try {
      await api(`/api/admin/inscricoes/${id}`, { method: 'PATCH', body: { status } })
      toast(`Inscrição ${status}`)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao atualizar', 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Excluir inscrição?')) return
    try {
      await api(`/api/admin/inscricoes/${id}`, { method: 'DELETE' })
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
      await Promise.all(selecionados.map(id => api(`/api/admin/inscricoes/${id}`, { method: 'PATCH', body: { status: acao } })))
      toast(`${selecionados.length} inscrição(ões) atualizadas`)
      setSelecionados([])
      load()
    } catch (e) {
      toast('Erro ao atualizar em massa', 'error')
    }
  }

  const allSelected = filtrados.length > 0 && selecionados.length === filtrados.length

  return (
    <div className="page-inscricoes">
      <div className="page-header">
        <h1>Inscrições</h1>
        <span className="subtitle">{inscricoes.length} no total</span>
      </div>

      <div className="toolbar">
        <div className="filtro-tabs">
          {STATUS_OPTS.map(s => (
            <button
              key={s}
              className={`tab ${filtro === s ? 'active' : ''}`}
              onClick={() => { setFiltro(s); setSelecionados([]) }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== 'todos' && (
                <span className="tab-count">{inscricoes.filter(i => i.status === s).length}</span>
              )}
            </button>
          ))}
        </div>

        {selecionados.length > 0 && (
          <div className="massa-actions">
            <span>{selecionados.length} selecionada(s)</span>
            <select value={acao} onChange={e => setAcao(e.target.value)}>
              <option value="aprovado">Aprovar</option>
              <option value="pendente">Pendente</option>
              <option value="cancelado">Cancelar</option>
            </select>
            <button className="btn-primary btn-sm" onClick={handleMassa}>Aplicar</button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="loading-msg">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p className="empty-msg">Nenhuma inscrição encontrada.</p>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Categorias</th>
                <th>Pagamento</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(i => (
                <tr key={i.id} className={selecionados.includes(i.id) ? 'row-selected' : ''}>
                  <td>
                    <input type="checkbox" checked={selecionados.includes(i.id)} onChange={() => toggleSel(i.id)} />
                  </td>
                  <td><strong>{i.nome}</strong></td>
                  <td>{i.email}</td>
                  <td>
                    {(Array.isArray(i.categorias) ? i.categorias : [i.categoria]).filter(Boolean).map((c, idx) => (
                      <span key={idx} className="tag">{c}</span>
                    ))}
                  </td>
                  <td>
                    {i.pagamento
                      ? <span className={`badge ${i.pagamento === 'pago' ? 'badge-green' : 'badge-yellow'}`}>{i.pagamento}</span>
                      : '—'
                    }
                  </td>
                  <td>
                    <span className={`badge ${statusBadge(i.status)}`}>{i.status}</span>
                  </td>
                  <td className="actions">
                    {i.status !== 'aprovado' && (
                      <button className="btn-sm btn-outline" onClick={() => handlePatch(i.id, 'aprovado')}>Aprovar</button>
                    )}
                    {i.status !== 'cancelado' && (
                      <button className="btn-sm btn-warning" onClick={() => handlePatch(i.id, 'cancelado')}>Rejeitar</button>
                    )}
                    <button className="btn-sm btn-danger" onClick={() => handleDelete(i.id)}>Excluir</button>
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

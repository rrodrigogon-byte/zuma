import { useState, useEffect, useCallback } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { a2Path } from '../../lib/tenant-api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

export default function FechamentoDiario() {
  const { toast } = useToast()
  const [fechamentos, setFechamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalNovo, setModalNovo] = useState(false)
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { fechamentos } = await api.get(a2Path('/fechamento-diario'))
      setFechamentos(fechamentos || [])
    } catch (e) {
      toast('Erro ao carregar fechamentos diários', true)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const handleRealizarFechamento = async () => {
    setSaving(true)
    try {
      await api.post(a2Path('/fechamento-diario'), { observacao: obs })
      toast('Fechamento diário realizado com sucesso')
      setModalNovo(false)
      setObs('')
      load()
    } catch (e) {
      toast(e.message || 'Erro ao realizar fechamento', true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <h1 className="page-title" style={{ margin:0 }}>🔐 Fechamento Diário</h1>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary btn-sm" onClick={load}>↺ Atualizar</button>
          <button className="btn btn-primary btn-sm" onClick={() => setModalNovo(true)}>Realizar Fechamento</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24, background: 'rgba(255,107,44,0.05)', border: '1px solid rgba(255,107,44,0.2)' }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#FF6B2C', fontSize: 16 }}>O que é o Fechamento Diário?</h3>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
          O fechamento diário cria um snapshot (fotografia) auditável da situação financeira atual do sistema. Ele consolida os valores totais a receber, recebidos no dia, pendentes e em atraso, além de registrar os alertas de vencimento ativos no momento da execução. Esta operação não altera dados, apenas registra o estado para auditoria.
        </p>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data do Fechamento</th>
              <th>Total a Receber</th>
              <th>Recebido no Dia</th>
              <th>Pendente</th>
              <th>Em Atraso</th>
              <th>Alertas</th>
              <th>Responsável</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="7" style={{ textAlign:'center', padding:20 }}>Carregando...</td></tr>}
            {!loading && fechamentos.length === 0 && <tr><td colSpan="7" style={{ textAlign:'center', padding:20, color:'var(--muted)' }}>Nenhum fechamento registrado.</td></tr>}
            {fechamentos.map(f => (
              <tr key={f.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{fmtDate(f.dataFechamento)}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(f.criadoEm).toLocaleTimeString()}</div>
                </td>
                <td>{fmtR(f.totalReceber)}</td>
                <td style={{ color: '#2ecc71', fontWeight: 600 }}>{fmtR(f.totalRecebido)}</td>
                <td>{fmtR(f.totalPendente)}</td>
                <td style={{ color: f.totalAtrasado > 0 ? '#e74c3c' : 'inherit' }}>{fmtR(f.totalAtrasado)}</td>
                <td>
                  <span className="badge" style={{ background: f.alertas > 0 ? 'rgba(255,183,3,0.1)' : 'rgba(46,204,113,0.1)', color: f.alertas > 0 ? '#FFB703' : '#2ecc71' }}>
                    {f.alertas}
                  </span>
                </td>
                <td>
                  <div style={{ fontSize: 12 }}>{f.responsavel}</div>
                  {f.observacao && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>📝 {f.observacao}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalNovo && (
        <Modal title="Realizar Fechamento Diário" onClose={() => setModalNovo(false)}>
          <div style={{ paddingBottom: 16 }}>
            <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
              Esta ação registrará o estado atual das contas a receber e clientes para auditoria futura. Confirma a execução do fechamento?
            </p>
            <div className="form-group">
              <label>Observação (Opcional)</label>
              <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} placeholder="Anotações sobre o fechamento de hoje..." />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setModalNovo(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleRealizarFechamento} disabled={saving}>{saving ? 'Processando...' : 'Confirmar Fechamento'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

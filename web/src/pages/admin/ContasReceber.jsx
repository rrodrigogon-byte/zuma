import { useState, useEffect, useCallback } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const EMPTY_CONTA_FORM = { clienteId: '', mesaNumero: '', descricao: '', valor: '', dataVencimento: '', observacao: '' }

export default function ContasReceber() {
  const { toast } = useToast()
  const [contas, setContas] = useState([])
  const [clientes, setClientes] = useState([])
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos') // todos | pendente | atrasada | paga
  const [modalPagamento, setModalPagamento] = useState(null)
  const [modalNovaConta, setModalNovaConta] = useState(false)
  const [novaConta, setNovaConta] = useState(EMPTY_CONTA_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [resContas, resClientes, resAlertas] = await Promise.all([
        api.get('/api/admin/contas-receber'),
        api.get('/api/admin/clientes'),
        api.get('/api/admin/alertas-vencimento')
      ])
      setContas(resContas.contas || [])
      setClientes(resClientes.clientes || [])
      setAlertas(resAlertas.alertas || [])
    } catch (e) {
      toast('Erro ao carregar dados financeiros', true)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const abrirNovaConta = () => {
    const padrao = clientes.find((cliente) => cliente.padrao) || clientes[0]
    const hoje = new Date()
    const vencimento = new Date(hoje)
    vencimento.setDate(vencimento.getDate() + Number(padrao?.diasVencimento || 30))
    setNovaConta({ ...EMPTY_CONTA_FORM, clienteId: padrao?.id || '', dataVencimento: vencimento.toISOString().slice(0, 10) })
    setModalNovaConta(true)
  }

  const handleCriarConta = async () => {
    if (!novaConta.clienteId || !novaConta.descricao || !Number(novaConta.valor) || !novaConta.dataVencimento) {
      return toast('Cliente, descrição, valor e vencimento são obrigatórios', true)
    }
    setSaving(true)
    try {
      await api.post('/api/admin/contas-receber', {
        ...novaConta,
        mesaNumero: Number(novaConta.mesaNumero || 0),
        valor: Number(novaConta.valor),
        dataVencimento: `${novaConta.dataVencimento}T23:59:59-04:00`,
      })
      toast('Conta a receber criada com sucesso')
      setModalNovaConta(false)
      setNovaConta(EMPTY_CONTA_FORM)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao criar conta a receber', true)
    } finally {
      setSaving(false)
    }
  }

  const handleRegistrarPagamento = async () => {
    if (!modalPagamento) return
    setSaving(true)
    try {
      await api.patch(`/api/admin/contas-receber/${modalPagamento.id}`, {
        dataPagamento: new Date().toISOString()
      })
      toast('Pagamento registrado com sucesso')
      setModalPagamento(null)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao registrar pagamento', true)
    } finally {
      setSaving(false)
    }
  }

  const getNomeCliente = (id) => {
    const c = clientes.find(c => c.id === id)
    return c ? c.nome : 'Cliente não encontrado'
  }

  const filtradas = contas.filter(c => filtroStatus === 'todos' || c.status === filtroStatus)

  // KPIs
  const totalReceber = contas.filter(c => c.status !== 'paga').reduce((acc, c) => acc + (c.valor || 0), 0)
  const totalAtrasado = contas.filter(c => c.status === 'atrasada').reduce((acc, c) => acc + (c.valor || 0), 0)
  const totalAlertas = alertas.length

  return (
    <div className="page">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <h1 className="page-title" style={{ margin:0 }}>💰 Contas a Receber</h1>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary btn-sm" onClick={load}>↺ Atualizar</button>
          <button className="btn btn-primary btn-sm" onClick={abrirNovaConta}>+ Nova Conta</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:24 }}>
        <div className="kpi" style={{ borderLeft:'4px solid #FF6B2C' }}>
          <div className="kpi-label">Total a Receber</div>
          <div className="kpi-value">{fmtR(totalReceber)}</div>
        </div>
        <div className="kpi" style={{ borderLeft:'4px solid #e74c3c' }}>
          <div className="kpi-label">Total em Atraso</div>
          <div className="kpi-value" style={{ color:'#e74c3c' }}>{fmtR(totalAtrasado)}</div>
        </div>
        <div className="kpi" style={{ borderLeft:`4px solid ${totalAlertas > 0 ? '#FFB703' : '#2ecc71'}` }}>
          <div className="kpi-label">Alertas de Vencimento</div>
          <div className="kpi-value" style={{ color: totalAlertas > 0 ? '#FFB703' : '#2ecc71' }}>{totalAlertas}</div>
        </div>
      </div>

      {alertas.length > 0 && (
        <div style={{ background: 'rgba(255,183,3,0.1)', border: '1px solid #FFB703', borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#FFB703', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚠️ Alertas de Vencimento
          </h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {alertas.map(a => (
              <div key={a.contaId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: '8px 12px', borderRadius: 6 }}>
                <div>
                  <strong style={{ color: 'var(--cream)' }}>{getNomeCliente(a.clienteId)}</strong>
                  <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>
                    {a.tipo === 'vencimento_proximo' ? `Vence em ${a.diasAteVenc} dia(s)` : `Atrasado há ${a.diasAtraso} dia(s)`}
                  </span>
                </div>
                <div style={{ fontWeight: 600, color: a.severidade === 'critica' ? '#e74c3c' : '#FFB703' }}>
                  {fmtR(a.valor)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {['todos', 'pendente', 'atrasada', 'paga'].map(s => (
          <button key={s} onClick={() => setFiltroStatus(s)} className={`btn btn-sm ${filtroStatus === s ? 'btn-primary' : 'btn-ghost'}`} style={{ textTransform: 'capitalize' }}>
            {s === 'todos' ? 'Todas as Contas' : s}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Descrição</th>
              <th>Vencimento</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="6" style={{ textAlign:'center', padding:20 }}>Carregando...</td></tr>}
            {!loading && filtradas.length === 0 && <tr><td colSpan="6" style={{ textAlign:'center', padding:20, color:'var(--muted)' }}>Nenhuma conta encontrada.</td></tr>}
            {filtradas.map(c => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{getNomeCliente(c.clienteId)}</div>
                  {c.mesaNumero > 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Mesa {c.mesaNumero}</div>}
                </td>
                <td>{c.descricao || '—'}</td>
                <td>
                  <div style={{ color: c.status === 'atrasada' ? '#e74c3c' : 'inherit' }}>
                    {fmtDate(c.dataVencimento)}
                  </div>
                  {c.status === 'paga' && <div style={{ fontSize: 11, color: '#2ecc71' }}>Pago em {fmtDate(c.dataPagamento)}</div>}
                </td>
                <td style={{ fontWeight: 600 }}>{fmtR(c.valor)}</td>
                <td>
                  <span className="badge" style={{
                    background: c.status === 'paga' ? 'rgba(46,204,113,0.1)' : c.status === 'atrasada' ? 'rgba(231,76,60,0.1)' : 'rgba(255,107,44,0.1)',
                    color: c.status === 'paga' ? '#2ecc71' : c.status === 'atrasada' ? '#e74c3c' : '#FF6B2C'
                  }}>
                    {c.status.toUpperCase()}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {c.status !== 'paga' && (
                    <button className="btn btn-primary btn-sm" onClick={() => setModalPagamento(c)}>Baixar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalNovaConta && (
        <Modal title="Nova Conta a Receber" onClose={() => setModalNovaConta(false)} width={560}>
          <div style={{ paddingBottom: 16 }}>
            <div className="form-group">
              <label>Cliente *</label>
              <select value={novaConta.clienteId} onChange={(e) => {
                const cliente = clientes.find((item) => item.id === e.target.value)
                const vencimento = new Date()
                vencimento.setDate(vencimento.getDate() + Number(cliente?.diasVencimento || 30))
                setNovaConta({ ...novaConta, clienteId: e.target.value, dataVencimento: vencimento.toISOString().slice(0, 10) })
              }}>
                <option value="">Selecione o cliente...</option>
                {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}{cliente.padrao ? ' (padrão)' : ''}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Mesa associada (opcional)</label>
                <input type="number" min="0" value={novaConta.mesaNumero} onChange={(e) => setNovaConta({ ...novaConta, mesaNumero: e.target.value })} placeholder="Ex.: 1" />
              </div>
              <div className="form-group">
                <label>Valor (R$) *</label>
                <input type="number" min="0.01" step="0.01" value={novaConta.valor} onChange={(e) => setNovaConta({ ...novaConta, valor: e.target.value })} placeholder="0,00" />
              </div>
            </div>
            <div className="form-group">
              <label>Descrição *</label>
              <input value={novaConta.descricao} onChange={(e) => setNovaConta({ ...novaConta, descricao: e.target.value })} placeholder="Ex.: Consumo mesa 01" />
            </div>
            <div className="form-group">
              <label>Data de vencimento *</label>
              <input type="date" value={novaConta.dataVencimento} onChange={(e) => setNovaConta({ ...novaConta, dataVencimento: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Observação</label>
              <textarea value={novaConta.observacao} onChange={(e) => setNovaConta({ ...novaConta, observacao: e.target.value })} rows={2} placeholder="Detalhes adicionais da cobrança..." />
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
              <button className="btn btn-ghost" onClick={() => setModalNovaConta(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCriarConta} disabled={saving}>{saving ? 'Criando...' : 'Criar Conta'}</button>
            </div>
          </div>
        </Modal>
      )}

      {modalPagamento && (
        <Modal title="Registrar Pagamento" onClose={() => setModalPagamento(null)}>
          <div style={{ paddingBottom: 16 }}>
            <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
              Confirma o recebimento do valor de <strong>{fmtR(modalPagamento.valor)}</strong> referente a <strong>{modalPagamento.descricao}</strong> do cliente <strong>{getNomeCliente(modalPagamento.clienteId)}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setModalPagamento(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleRegistrarPagamento} disabled={saving}>{saving ? 'Registrando...' : 'Confirmar Pagamento'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

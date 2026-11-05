import { useState, useEffect, useCallback } from 'react'
import { api, fmtR, fmtK, fmtDateOnly } from '../../lib/api'
import { a2Path } from '../../lib/tenant-api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const EMPTY_CONTA_FORM = { clienteId: '', mesaNumero: '', descricao: '', valor: '', dataVencimento: '', observacao: '' }
const STATUS_LABEL = { todos: 'Todas as contas', pendente: 'Pendentes', atrasada: 'Atrasadas', paga: 'Pagas' }

export default function ContasReceber() {
  const { toast } = useToast()
  const [contas, setContas] = useState([])
  const [clientes, setClientes] = useState([])
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos') // todos | pendente | atrasada | paga
  const [busca, setBusca] = useState('')
  const [modalPagamento, setModalPagamento] = useState(null)
  const [modalNovaConta, setModalNovaConta] = useState(false)
  const [novaConta, setNovaConta] = useState(EMPTY_CONTA_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [resContas, resClientes, resAlertas] = await Promise.all([
        api.get(a2Path('/contas-receber')),
        api.get(a2Path('/clientes', '/api/admin/clientes')),
        api.get(a2Path('/alertas-vencimento'))
      ])
      const listaContas = Array.isArray(resContas?.contas) ? resContas.contas : (Array.isArray(resContas) ? resContas : [])
      const listaClientes = Array.isArray(resClientes?.clientes) ? resClientes.clientes : (Array.isArray(resClientes) ? resClientes : [])
      const listaAlertas = Array.isArray(resAlertas?.alertas) ? resAlertas.alertas : (Array.isArray(resAlertas) ? resAlertas : [])
      setContas(listaContas)
      setClientes(listaClientes)
      setAlertas(listaAlertas)
    } catch (e) {
      toast(e.message || 'Erro ao carregar dados financeiros', true)
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
    if (!novaConta.clienteId || !novaConta.descricao || Number(novaConta.valor) <= 0 || !novaConta.dataVencimento) {
      return toast('Cliente, descrição, valor e vencimento são obrigatórios', true)
    }
    setSaving(true)
    try {
      await api.post(a2Path('/contas-receber'), {
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
      await api.patch(a2Path(`/contas-receber/${modalPagamento.id}`), {
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

  const handleExcluirConta = async (conta) => {
    if (!window.confirm(`Deseja realmente excluir a conta "${conta.descricao || 'sem descrição'}" (${fmtR(conta.valor)})?`)) {
      return
    }
    setLoading(true)
    try {
      await api.delete(a2Path(`/contas-receber/${conta.id}`))
      toast('Conta a receber excluída com sucesso')
      load()
    } catch (e) {
      toast(e.message || 'Erro ao excluir conta', true)
      setLoading(false)
    }
  }

  const handleExpurgarTestes = async () => {
    if (!window.confirm('Deseja excluir permanentemente todas as contas de teste e manter apenas dados oficiais/Avec?')) {
      return
    }
    setLoading(true)
    try {
      const res = await api.post(a2Path('/contas-receber/expurgar-testes'), {})
      toast(`Expurgo concluído! ${res?.removidas ?? 0} conta(s) de teste removida(s).`)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao expurgar contas de teste', true)
      setLoading(false)
    }
  }

  const getNomeCliente = (id, fallbackNome) => {
    if (fallbackNome) return fallbackNome
    if (!id) return 'Cliente Geral'
    const c = clientes.find(c => String(c.id) === String(id))
    return c ? c.nome : 'Cliente Geral'
  }

  const termo = busca.trim().toLowerCase()
  const filtradas = contas.filter(c => {
    if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false
    if (termo) {
      const nome = getNomeCliente(c.clienteId, c.clienteNome).toLowerCase()
      const desc = String(c.descricao || '').toLowerCase()
      const obs = String(c.observacao || '').toLowerCase()
      return nome.includes(termo) || desc.includes(termo) || obs.includes(termo)
    }
    return true
  })

  // KPIs
  const totalReceber = contas.filter(c => c.status !== 'paga').reduce((acc, c) => acc + (c.valor || 0), 0)
  const totalAtrasado = contas.filter(c => c.status === 'atrasada').reduce((acc, c) => acc + (c.valor || 0), 0)
  const totalAlertas = alertas.length
  const contagem = {
    todos: contas.length,
    pendente: contas.filter(c => c.status === 'pendente').length,
    atrasada: contas.filter(c => c.status === 'atrasada').length,
    paga: contas.filter(c => c.status === 'paga').length,
  }

  return (
    <div className="page">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <h1 className="page-title" style={{ margin:0 }}>💰 Contas a Receber</h1>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-outline btn-sm" onClick={handleExpurgarTestes} disabled={loading} title="Remover registros de teste e manter oficiais/Avec">🗑️ Limpar Testes</button>
          <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>↺ Atualizar</button>
          <button className="btn btn-primary btn-sm" onClick={abrirNovaConta} disabled={loading || clientes.length === 0}>+ Nova Conta</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:24 }}>
        <div className="kpi" style={{ borderLeft:'4px solid #FF6B2C' }}>
          <div className="kpi-label">Total a Receber</div>
          <div className="kpi-value" title={fmtR(totalReceber)}>{fmtK(totalReceber)}</div>
          <small style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 2 }}>Exato: {fmtR(totalReceber)}</small>
        </div>
        <div className="kpi" style={{ borderLeft:'4px solid #e74c3c' }}>
          <div className="kpi-label">Total em Atraso</div>
          <div className="kpi-value" style={{ color:'#e74c3c' }} title={fmtR(totalAtrasado)}>{fmtK(totalAtrasado)}</div>
          <small style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 2 }}>Exato: {fmtR(totalAtrasado)}</small>
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

      {!loading && clientes.length === 0 && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid rgba(255,183,3,.5)', color: 'var(--muted)' }}>
          Cadastre ao menos um cliente nominal antes de lançar uma conta a receber.
        </div>
      )}

      <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {['todos', 'pendente', 'atrasada', 'paga'].map(s => (
            <button key={s} onClick={() => setFiltroStatus(s)} className={`btn btn-sm ${filtroStatus === s ? 'btn-primary' : 'btn-ghost'}`}>
              {STATUS_LABEL[s]} ({contagem[s] || 0})
            </button>
          ))}
        </div>
        <div style={{ minWidth: 260 }}>
          <input
            type="search"
            className="input input-sm"
            placeholder="Buscar por cliente ou descrição…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)' }}
          />
        </div>
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
                  <div style={{ fontWeight: 600 }}>{getNomeCliente(c.clienteId, c.clienteNome)}</div>
                  {c.mesaNumero > 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Mesa {c.mesaNumero}</div>}
                  {c.origem && <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>{c.origem === 'financeiro' ? 'Financeiro' : c.origem === 'clientes_kytto' ? 'Comanda / ERP' : 'A2'}</div>}
                </td>
                <td>{c.descricao || '—'}</td>
                <td>
                  <div style={{ color: c.status === 'atrasada' ? '#e74c3c' : 'inherit', fontWeight: c.status === 'atrasada' ? 600 : 'normal' }}>
                    {fmtDateOnly(c.dataVencimento)}
                  </div>
                  {c.status === 'paga' && <div style={{ fontSize: 11, color: '#2ecc71' }}>Pago em {fmtDateOnly(c.dataPagamento)}</div>}
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
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    {c.status !== 'paga' && (
                      <button className="btn btn-primary btn-sm" onClick={() => setModalPagamento(c)}>Baixar</button>
                    )}
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ color: '#e74c3c', borderColor: 'rgba(231,76,60,0.3)', padding: '4px 8px' }}
                      title="Excluir conta a receber"
                      onClick={() => handleExcluirConta(c)}
                    >
                      Excluir
                    </button>
                  </div>
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

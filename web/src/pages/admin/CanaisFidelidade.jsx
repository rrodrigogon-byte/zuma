import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'
import LoyaltyAdvancedPanel from './LoyaltyAdvancedPanel'
import './CanaisFidelidade.css'

const emptyMember = { clienteId: '', nome: '', telefone: '' }

export default function CanaisFidelidade() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [canais, setCanais] = useState([])
  const [fidelidade, setFidelidade] = useState({ regra: {}, membros: [] })
  const [fidelidadeAvancada, setFidelidadeAvancada] = useState(null)
  const [fidelidadeAvancadaErro, setFidelidadeAvancadaErro] = useState('')
  const [clienteAvancadoId, setClienteAvancadoId] = useState('')
  const [pedidos, setPedidos] = useState([])
  const [modal, setModal] = useState(null)
  const [member, setMember] = useState(emptyMember)
  const [saving, setSaving] = useState(false)
  const [advancedBusy, setAdvancedBusy] = useState(false)

  const notify = useCallback((type, message) => {
    toast(message, type === 'sucesso' ? 'success' : type === 'erro' ? 'error' : 'info')
  }, [toast])

  const load = useCallback(async () => {
    setLoading(true)
    const results = await Promise.allSettled([
      api.get('/api/admin/canais-venda'),
      api.get('/api/admin/fidelidade'),
      api.get('/api/admin/delivery/pedidos'),
      api.get('/api/admin/fidelidade/avancada'),
    ])
    const [canaisRes, fidelidadeRes, pedidosRes, avancadaRes] = results
    if (canaisRes.status === 'fulfilled') setCanais(canaisRes.value.canais || [])
    if (fidelidadeRes.status === 'fulfilled') setFidelidade({ regra: fidelidadeRes.value.regra || {}, membros: fidelidadeRes.value.membros || [] })
    if (pedidosRes.status === 'fulfilled') setPedidos(pedidosRes.value.pedidos || [])
    if (avancadaRes.status === 'fulfilled') {
      setFidelidadeAvancada(avancadaRes.value)
      setFidelidadeAvancadaErro('')
      setClienteAvancadoId(current => (avancadaRes.value.ranking || []).some(item => item.cliente_id === current) ? current : '')
    } else {
      setFidelidadeAvancada(null)
      setFidelidadeAvancadaErro(avancadaRes.reason?.message || 'Fidelidade avançada temporariamente indisponível.')
    }
    if (results.every(item => item.status === 'rejected')) toast('Não foi possível carregar a central.', 'error')
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  const clienteAvancado = useMemo(() => {
    const item = (fidelidadeAvancada?.ranking || []).find(row => row.cliente_id === clienteAvancadoId)
    return item ? { id: item.cliente_id, nome: item.nome, pontos: item.saldo_total } : null
  }, [clienteAvancadoId, fidelidadeAvancada?.ranking])

  const toggleChannel = async (channel) => {
    try {
      await api.post('/api/admin/canais-venda', { ...channel, ativo: !channel.ativo })
      toast(`${channel.nome}: ${!channel.ativo ? 'ativado' : 'desativado'}`)
      await load()
    } catch (error) {
      toast(error.message || 'Não foi possível atualizar o canal.', 'error')
    }
  }

  const saveRule = async () => {
    setSaving(true)
    try {
      await api.patch('/api/admin/fidelidade/regra', fidelidade.regra)
      toast('Regra de fidelização salva.')
      setModal(null)
      await load()
    } catch (error) {
      toast(error.message || 'Não foi possível salvar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const addMember = async () => {
    if (!member.clienteId || !member.nome) return toast('Informe cliente e nome para aderir à fidelização.', 'error')
    setSaving(true)
    try {
      await api.post('/api/admin/fidelidade/membros', member)
      toast('Cliente adicionado ao programa.')
      setMember(emptyMember)
      setModal(null)
      await load()
    } catch (error) {
      toast(error.message || 'Não foi possível adicionar cliente.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return <div className="page">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
      <div><h1 className="page-title" style={{ marginBottom: 5 }}>Canais, Delivery & Fidelidade</h1><p style={{ margin: 0, color: 'var(--muted)' }}>Operação integrada por empresa, pronta para PDV, delivery próprio e marketplaces.</p></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn btn-secondary btn-sm" onClick={load}>↺ Atualizar</button><button className="btn btn-secondary btn-sm" onClick={() => setModal('regra')}>⚙ Regra de pontos</button><button className="btn btn-primary btn-sm" onClick={() => setModal('membro')}>+ Cliente fidelidade</button></div>
    </div>
    <div className="card" style={{ marginBottom: 16, padding: 14, background: 'rgba(255,107,44,.06)', borderColor: 'rgba(255,107,44,.25)', fontSize: 13, color: 'var(--muted)' }}><strong style={{ color: '#FF6B2C' }}>iFood e marketplaces:</strong> a integração está preparada por empresa. A ativação real exige credenciais homologadas e webhook HTTPS assinado do canal.</div>
    {loading ? <div className="card" style={{ color: 'var(--muted)' }}>Carregando canais…</div> : <>
      <section className="card" style={{ marginBottom: 16 }}><h2 style={{ margin: '0 0 13px', fontSize: 16, color: '#12283F' }}>Canais de venda</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>{canais.map((canal) => <div key={canal.id} style={{ border: '1px solid var(--line)', borderRadius: 9, padding: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{canal.nome}</strong><span style={{ color: canal.ativo ? '#16806b' : 'var(--muted)', fontSize: 12 }}>{canal.ativo ? 'Ativo' : 'Inativo'}</span></div><div style={{ color: 'var(--muted)', fontSize: 12, margin: '6px 0 10px' }}>{canal.tipo} {canal.credencialConfigurada ? '· credencial protegida' : ''}</div><button className={canal.ativo ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'} onClick={() => toggleChannel(canal)}>{canal.ativo ? 'Desativar' : 'Ativar'}</button></div>)}</div></section>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)', gap: 16 }}>
        <section className="card"><h2 style={{ margin: '0 0 12px', fontSize: 16, color: '#12283F' }}>Programa de fidelização</h2><p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>Regra atual: <strong style={{ color: '#12283F' }}>{fidelidade.regra.pontosPorReal || 0} ponto(s) por R$ 1,00</strong> · Resgate estimado: {fmtR(fidelidade.regra.valorPonto || 0)} por ponto.</p>{fidelidade.membros.length === 0 ? <p style={{ color: 'var(--muted)' }}>Nenhum cliente aderido ao programa desta empresa.</p> : <div className="table-wrap"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr>{['Cliente', 'Telefone', 'Pontos', 'Nível'].map((header) => <th key={header} style={{ textAlign: 'left', padding: 8, color: 'var(--muted)', borderBottom: '1px solid var(--line)' }}>{header}</th>)}</tr></thead><tbody>{fidelidade.membros.map((item) => <tr key={item.id}><td style={{ padding: 8 }}>{item.nome}</td><td style={{ padding: 8 }}>{item.telefone || '—'}</td><td style={{ padding: 8, fontWeight: 750 }}>{item.pontos}</td><td style={{ padding: 8, textTransform: 'capitalize' }}>{item.nivel}</td></tr>)}</tbody></table></div>}</section>
        <section className="card"><h2 style={{ margin: '0 0 12px', fontSize: 16, color: '#12283F' }}>Pedidos de delivery</h2><p style={{ color: 'var(--muted)', fontSize: 13 }}>Pedidos recebidos por canais ativos aparecem aqui por empresa.</p><strong style={{ color: '#FF6B2C', fontSize: 26 }}>{pedidos.length}</strong><div style={{ color: 'var(--muted)', fontSize: 12 }}>pedido(s) no histórico</div></section>
      </div>
      <section className="loyalty-advanced-host">
        {fidelidadeAvancadaErro && <div className="card" style={{ marginTop: 18, color: '#9f271e' }}>{fidelidadeAvancadaErro}</div>}
        {fidelidadeAvancada && <>
          <div className="card" style={{ marginTop: 18 }}><label style={{ display: 'grid', gap: 6, maxWidth: 520, fontWeight: 700 }}>Cliente para resgate<select className="input" value={clienteAvancadoId} onChange={event => setClienteAvancadoId(event.target.value)}><option value="">Selecione um cliente ranqueado</option>{(fidelidadeAvancada.ranking || []).map(item => <option key={item.cliente_id} value={item.cliente_id}>{item.nome} — {item.saldo_total} pontos</option>)}</select></label><small style={{ color: 'var(--muted)' }}>Somente clientes com movimentação no ledger da loja aparecem aqui. O resgate exige confirmação explícita.</small></div>
          <LoyaltyAdvancedPanel
            data={fidelidadeAvancada}
            customer={clienteAvancado}
            customerDetail={clienteAvancado ? { programa: { pontos: clienteAvancado.pontos } } : null}
            busy={advancedBusy}
            setBusy={setAdvancedBusy}
            notify={notify}
            onRefresh={load}
            onCustomerRefresh={load}
          />
        </>}
      </section>
    </>}
    {modal === 'regra' && <Modal title="Regra de fidelização" onClose={() => setModal(null)} width={500}><div style={{ display: 'grid', gap: 12 }}><label>Pontos por R$ 1,00<input className="input" type="number" min="0" value={fidelidade.regra.pontosPorReal ?? 1} onChange={(event) => setFidelidade({ ...fidelidade, regra: { ...fidelidade.regra, pontosPorReal: event.target.value } })} /></label><label>Valor estimado por ponto (R$)<input className="input" type="number" step="0.01" min="0" value={fidelidade.regra.valorPonto ?? 0.01} onChange={(event) => setFidelidade({ ...fidelidade, regra: { ...fidelidade.regra, valorPonto: event.target.value } })} /></label><label><input type="checkbox" checked={fidelidade.regra.ativa !== false} onChange={(event) => setFidelidade({ ...fidelidade, regra: { ...fidelidade.regra, ativa: event.target.checked } })} /> Programa ativo</label></div><Actions onCancel={() => setModal(null)} onSave={saveRule} saving={saving} label="Salvar regra" /></Modal>}
    {modal === 'membro' && <Modal title="Adicionar cliente à fidelização" onClose={() => setModal(null)} width={500}><div style={{ display: 'grid', gap: 12 }}><label>ID do cliente<input className="input" value={member.clienteId} onChange={(event) => setMember({ ...member, clienteId: event.target.value })} /></label><label>Nome<input className="input" value={member.nome} onChange={(event) => setMember({ ...member, nome: event.target.value })} /></label><label>Telefone<input className="input" value={member.telefone} onChange={(event) => setMember({ ...member, telefone: event.target.value })} /></label></div><Actions onCancel={() => setModal(null)} onSave={addMember} saving={saving} label="Adicionar cliente" /></Modal>}
  </div>
}

function Actions({ onCancel, onSave, saving, label }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}><button className="btn btn-ghost" onClick={onCancel}>Cancelar</button><button className="btn btn-primary" disabled={saving} onClick={onSave}>{saving ? 'Salvando…' : label}</button></div>
}

/**
 * Varejo Geral — KYTTO Clube
 * Orçamentos, Pedidos, Multi-Estoque, Tabelas de Preço, Entregas
 */
import { useState, useEffect, useCallback } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const TABS = ['Orçamentos', 'Pedidos', 'Estoques', 'Entregas']
const STATUS_ORC = { aberto: { label: 'Aberto', color: '#4a9eff' }, convertido: { label: 'Convertido', color: '#FF6B2C' }, expirado: { label: 'Expirado', color: '#f59e0b' }, cancelado: { label: 'Cancelado', color: '#e05c5c' } }
const STATUS_ENT = { pendente: { label: 'Pendente', color: '#f59e0b' }, saiu_entrega: { label: 'Saiu p/ Entrega', color: '#4a9eff' }, entregue: { label: 'Entregue', color: '#FF6B2C' }, nao_entregue: { label: 'Não Entregue', color: '#e05c5c' } }

export default function Varejo() {
  const { toast } = useToast()
  const [tab, setTab] = useState('Orçamentos')
  const [orcamentos, setOrcamentos] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [estoques, setEstoques] = useState([])
  const [entregas, setEntregas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [formOrc, setFormOrc] = useState({ cliente_nome: '', validade_dias: 7, observacoes: '', itens: [{ descricao: '', quantidade: 1, unidade: 'UN', valor_unitario: '' }] })
  const [formEst, setFormEst] = useState({ nome: '', tipo: 'Varejo', responsavel: '' })
  const [formEnt, setFormEnt] = useState({ cliente_nome: '', motorista_nome: '', endereco: '', data_entrega_prevista: '', valor_frete: '' })

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [orcData, pedData, estData, entData] = await Promise.all([
        api.get('/api/v1/varejo/orcamentos'),
        api.get('/api/v1/varejo/pedidos').catch(() => ({ pedidos: [] })),
        api.get('/api/v1/varejo/estoques'),
        api.get('/api/v1/varejo/entregas')
      ])
      setOrcamentos(orcData.orcamentos || [])
      setPedidos(pedData.pedidos || [])
      setEstoques(estData.estoques || [])
      setEntregas(entData.entregas || [])
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function addItem() {
    setFormOrc(p => ({ ...p, itens: [...p.itens, { descricao: '', quantidade: 1, unidade: 'UN', valor_unitario: '' }] }))
  }

  function removeItem(idx) {
    setFormOrc(p => ({ ...p, itens: p.itens.filter((_, i) => i !== idx) }))
  }

  function updateItem(idx, campo, valor) {
    setFormOrc(p => {
      const itens = [...p.itens]
      itens[idx] = { ...itens[idx], [campo]: valor }
      return { ...p, itens }
    })
  }

  const totalOrc = formOrc.itens.reduce((s, i) => s + (parseFloat(i.quantidade) || 0) * (parseFloat(i.valor_unitario) || 0), 0)

  async function salvarOrcamento() {
    try {
      await api.post('/api/v1/varejo/orcamentos', { ...formOrc, itens: formOrc.itens.filter(i => i.descricao && i.valor_unitario) })
      toast('Orçamento criado!', 'success')
      setModal(null)
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function converterOrcamento(id) {
    try {
      await api.post(`/api/v1/varejo/orcamentos/${id}/converter`)
      toast('Orçamento convertido em pedido!', 'success')
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function salvarEstoque() {
    try {
      await api.post('/api/v1/varejo/estoques', formEst)
      toast('Depósito/estoque criado!', 'success')
      setModal(null)
      setFormEst({ nome: '', tipo: 'Varejo', responsavel: '' })
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function salvarEntrega() {
    try {
      await api.post('/api/v1/varejo/entregas', formEnt)
      toast('Entrega agendada!', 'success')
      setModal(null)
      setFormEnt({ cliente_nome: '', motorista_nome: '', endereco: '', data_entrega_prevista: '', valor_frete: '' })
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function mudarStatusEntrega(id, status) {
    try {
      await api.patch(`/api/v1/varejo/entregas/${id}/status`, { status })
      toast('Status da entrega atualizado!', 'success')
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>🛒 Varejo Geral</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>{orcamentos.length} orçamentos · {pedidos.length} pedidos · {estoques.length} depósitos</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {tab === 'Orçamentos' && <button className="btn-primary" onClick={() => setModal('novo-orc')}>+ Novo Orçamento</button>}
          {tab === 'Estoques' && <button className="btn-primary" onClick={() => setModal('novo-est')}>+ Novo Depósito</button>}
          {tab === 'Entregas' && <button className="btn-primary" onClick={() => setModal('nova-ent')}>+ Nova Entrega</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--card)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? '#fff' : 'var(--muted)', cursor: 'pointer', fontWeight: tab === t ? 600 : 400 }}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Carregando...</div> : (
        <>
          {/* Orçamentos */}
          {tab === 'Orçamentos' && (
            <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--card2)', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Nº</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Cliente</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Validade</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {orcamentos.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhum orçamento</td></tr>
                  ) : orcamentos.map(o => {
                    const st = STATUS_ORC[o.status] || { label: o.status, color: '#888' }
                    return (
                      <tr key={o.id} style={{ borderTop: '1px solid var(--line)' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{o.numero_orcamento || o.numero}</td>
                        <td style={{ padding: '12px 16px' }}>{o.cliente_nome}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{fmtR(o.valor_total || 0)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>{o.data_validade ? fmtDate(o.data_validade) : '-'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: st.color + '22', color: st.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{st.label}</span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {o.status === 'aberto' && (
                            <button onClick={() => converterOrcamento(o.id)} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#FF6B2C', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                              Converter em Pedido
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Estoques */}
          {tab === 'Estoques' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {estoques.length === 0 ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Nenhum estoque configurado</div>
              ) : estoques.map(e => (
                <div key={e.id} style={{ background: 'var(--card)', borderRadius: 12, padding: 20, border: '1px solid var(--line)' }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{e.nome}</div>
                  <div style={{ display: 'inline-block', background: '#4a9eff22', color: '#4a9eff', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, marginBottom: 12 }}>{e.tipo}</div>
                  {e.responsavel && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Responsável: {e.responsavel}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Entregas */}
          {tab === 'Entregas' && (
            <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--card2)', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Cliente</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Motorista</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Previsão</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Frete</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entregas.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhuma entrega</td></tr>
                  ) : entregas.map(e => {
                    const st = STATUS_ENT[e.status] || { label: e.status, color: '#888' }
                    return (
                      <tr key={e.id} style={{ borderTop: '1px solid var(--line)' }}>
                        <td style={{ padding: '12px 16px' }}>{e.cliente_nome || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>{e.motorista_nome || '-'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>{e.data_entrega_prevista ? fmtDate(e.data_entrega_prevista) : '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{fmtR(e.valor_frete || 0)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: st.color + '22', color: st.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{st.label}</span>
                          {e.status === 'pendente' && (
                            <button onClick={() => mudarStatusEntrega(e.id, 'saiu_entrega')} style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, border: 'none', background: '#4a9eff', color: '#fff', cursor: 'pointer', fontSize: 11 }}>Despachar</button>
                          )}
                          {e.status === 'saiu_entrega' && (
                            <button onClick={() => mudarStatusEntrega(e.id, 'entregue')} style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, border: 'none', background: '#14b87a', color: '#fff', cursor: 'pointer', fontSize: 11 }}>Confirmar entrega</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'Pedidos' && (
            <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--card2)', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Nº Pedido</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Origem</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Cliente</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Data</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhum pedido convertido ainda. Converta um orçamento na aba Orçamentos.</td></tr>
                  ) : pedidos.map(p => (
                    <tr key={p.id} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{p.numero_pedido}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>{p.numero_orcamento || 'PDV'}</td>
                      <td style={{ padding: '12px 16px' }}>{p.cliente_nome}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{fmtR(p.valor_total || 0)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>{p.created_at ? fmtDate(p.created_at) : '-'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: '#14b87a22', color: '#14b87a', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{p.status || 'aprovado'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modal === 'novo-est' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 460 }}>
            <h2 style={{ margin: '0 0 20px' }}>📦 Novo Depósito / Estoque</h2>
            <div style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
              <input placeholder="Nome do depósito (ex.: Filial Centro)" value={formEst.nome} onChange={e => setFormEst(p => ({ ...p, nome: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
              <input placeholder="Tipo (Varejo, CD / Atacado, Trânsito)" value={formEst.tipo} onChange={e => setFormEst(p => ({ ...p, tipo: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
              <input placeholder="Responsável" value={formEst.responsavel} onChange={e => setFormEst(p => ({ ...p, responsavel: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarEstoque} className="btn-primary">Salvar Depósito</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'nova-ent' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 480 }}>
            <h2 style={{ margin: '0 0 20px' }}>🚚 Nova Entrega</h2>
            <div style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
              <input placeholder="Cliente destinatário" value={formEnt.cliente_nome} onChange={e => setFormEnt(p => ({ ...p, cliente_nome: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
              <input placeholder="Motorista / Entregador" value={formEnt.motorista_nome} onChange={e => setFormEnt(p => ({ ...p, motorista_nome: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
              <input placeholder="Endereço de entrega" value={formEnt.endereco} onChange={e => setFormEnt(p => ({ ...p, endereco: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
              <input type="date" value={formEnt.data_entrega_prevista} onChange={e => setFormEnt(p => ({ ...p, data_entrega_prevista: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
              <input type="number" placeholder="Valor do frete (R$)" value={formEnt.valor_frete} onChange={e => setFormEnt(p => ({ ...p, valor_frete: e.target.value }))} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarEntrega} className="btn-primary">Agendar Entrega</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Orçamento */}
      {modal === 'novo-orc' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 700, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 24px' }}>📋 Novo Orçamento</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Cliente</label>
                <input placeholder="Nome do cliente" value={formOrc.cliente_nome} onChange={e => setFormOrc(p => ({ ...p, cliente_nome: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Validade (dias)</label>
                <input type="number" value={formOrc.validade_dias} onChange={e => setFormOrc(p => ({ ...p, validade_dias: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Itens */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase' }}>Itens</label>
                <button onClick={addItem} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 12 }}>+ Adicionar Item</button>
              </div>
              {formOrc.itens.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <input placeholder="Descrição do produto/serviço" value={item.descricao} onChange={e => updateItem(idx, 'descricao', e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
                  <input type="number" placeholder="Qtd" value={item.quantidade} onChange={e => updateItem(idx, 'quantidade', e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
                  <input placeholder="UN" value={item.unidade} onChange={e => updateItem(idx, 'unidade', e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
                  <input type="number" placeholder="Valor unit." value={item.valor_unitario} onChange={e => updateItem(idx, 'valor_unitario', e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
                  <button onClick={() => removeItem(idx)} style={{ padding: '8px', borderRadius: 6, border: 'none', background: '#e05c5c22', color: '#e05c5c', cursor: 'pointer' }}>×</button>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 10, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <span style={{ fontWeight: 700 }}>Total do Orçamento</span>
              <span style={{ fontWeight: 700, fontSize: 22, color: '#FF6B2C' }}>{fmtR(totalOrc)}</span>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarOrcamento} className="btn-primary">Salvar Orçamento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

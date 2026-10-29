/**
 * Compras & Fornecedores — KYTTO Clube
 * Pedidos de Compra, Cotações, Fornecedores, Recebimento
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const TABS = ['Pedidos', 'Cotações', 'Fornecedores']
const STATUS_PC = {
  rascunho: { label: 'Rascunho', color: '#888' },
  aguardando_aprovacao: { label: 'Aguard. Aprovação', color: '#f59e0b' },
  aprovado: { label: 'Aprovado', color: '#4a9eff' },
  enviado: { label: 'Enviado', color: '#8b5cf6' },
  parcialmente_recebido: { label: 'Parc. Recebido', color: '#f59e0b' },
  recebido: { label: 'Recebido', color: '#FF6B2C' },
  cancelado: { label: 'Cancelado', color: '#e05c5c' }
}

export default function Compras() {
  const { toast } = useToast()
  const [tab, setTab] = useState('Pedidos')
  const [pedidos, setPedidos] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [cotacoes, setCotacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [formForn, setFormForn] = useState({ razao_social: '', nome_fantasia: '', cnpj_cpf: '', email: '', telefone: '', contato_nome: '', prazo_pagamento_dias: 30 })
  const [formPC, setFormPC] = useState({ fornecedor_id: '', observacoes: '', itens: [{ descricao: '', quantidade: 1, unidade: 'UN', valor_unitario: '' }] })

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [pcData, fornData, cotData] = await Promise.all([
        api.get('/api/v1/compras/pedidos'),
        api.get('/api/v1/compras/fornecedores'),
        api.get('/api/v1/compras/cotacoes')
      ])
      setPedidos(pcData.pedidos || [])
      setFornecedores(fornData.fornecedores || [])
      setCotacoes(cotData.cotacoes || [])
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [])

  
  const [importandoIA, setImportandoIA] = useState(false)
  const fileInputRef = useRef(null)

  const handleImportNF = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportandoIA(true);
    toast('Analisando a Nota Fiscal com Inteligência Artificial... isso pode levar alguns segundos.', 'info');
    
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1];
        const isXml = file.name.toLowerCase().endsWith('.xml');
        
        try {
          const res = await api.post('/api/v1/compras/importar-nf', {
            base64: base64Data,
            mimeType: file.type || 'application/octet-stream',
            isXml
          });
          
          if (res.sucesso) {
            toast(`Nota Fiscal importada! ${res.result.itensImportados} itens registrados e lançados no estoque.`, 'success');
            carregar();
          } else {
            toast(res.erro || 'Falha ao processar nota.', 'error');
          }
        } catch (err) {
          toast(err.message || 'Erro ao comunicar com a IA.', 'error');
        } finally {
          setImportandoIA(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
    } catch (err) {
      toast('Falha ao ler arquivo', 'error');
      setImportandoIA(false);
    }
  }

  useEffect(() => { carregar() }, [carregar])

  async function salvarFornecedor() {
    try {
      await api.post('/api/v1/compras/fornecedores', formForn)
      toast('Fornecedor cadastrado!', 'success')
      setModal(null)
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function salvarPedido() {
    try {
      await api.post('/api/v1/compras/pedidos', { ...formPC, itens: formPC.itens.filter(i => i.descricao && i.valor_unitario) })
      toast('Pedido de compra criado!', 'success')
      setModal(null)
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function aprovarPedido(id) {
    try {
      await api.post(`/api/v1/compras/pedidos/${id}/aprovar`)
      toast('Pedido aprovado!', 'success')
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  const totalPC = formPC.itens.reduce((s, i) => s + (parseFloat(i.quantidade) || 0) * (parseFloat(i.valor_unitario) || 0), 0)

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>📦 Compras & Fornecedores</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>{fornecedores.length} fornecedores · {pedidos.length} pedidos</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {tab === 'Pedidos' && <button className="btn-primary" onClick={() => setModal('novo-pc')}>+ Novo Pedido</button>}
          {tab === 'Fornecedores' && <button className="btn-primary" onClick={() => setModal('novo-forn')}>+ Novo Fornecedor</button>}
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
          {/* Pedidos */}
          {tab === 'Pedidos' && (
            <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--card2)', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Nº</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Fornecedor</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Previsão</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhum pedido de compra</td></tr>
                  ) : pedidos.map(p => {
                    const st = STATUS_PC[p.status] || { label: p.status, color: '#888' }
                    return (
                      <tr key={p.id} style={{ borderTop: '1px solid var(--line)' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{p.numero}</td>
                        <td style={{ padding: '12px 16px' }}>{p.fornecedor_nome || '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{fmtR(p.valor_total || 0)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>{p.data_previsao_entrega ? fmtDate(p.data_previsao_entrega) : '-'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: st.color + '22', color: st.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{st.label}</span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {p.status === 'aguardando_aprovacao' && (
                            <button onClick={() => aprovarPedido(p.id)} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#FF6B2C', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                              Aprovar
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

          {/* Fornecedores */}
          {tab === 'Fornecedores' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {fornecedores.length === 0 ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Nenhum fornecedor cadastrado</div>
              ) : fornecedores.map(f => (
                <div key={f.id} style={{ background: 'var(--card)', borderRadius: 12, padding: 20, border: '1px solid var(--line)' }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{f.nome_fantasia || f.razao_social}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>{f.razao_social}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                    <div><span style={{ color: 'var(--muted)' }}>CNPJ:</span> {f.cnpj_cpf || '-'}</div>
                    <div><span style={{ color: 'var(--muted)' }}>Prazo:</span> {f.prazo_pagamento_dias}d</div>
                    <div><span style={{ color: 'var(--muted)' }}>Tel:</span> {f.telefone || '-'}</div>
                    <div><span style={{ color: 'var(--muted)' }}>Contato:</span> {f.contato_nome || '-'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'Cotações' && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
              📊 Módulo de cotações comparativas — em breve
            </div>
          )}
        </>
      )}

      {/* Modal: Novo Fornecedor */}
      {modal === 'novo-forn' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 24px' }}>🏭 Novo Fornecedor</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Razão Social *', key: 'razao_social', full: true },
                { label: 'Nome Fantasia', key: 'nome_fantasia' },
                { label: 'CNPJ/CPF', key: 'cnpj_cpf', placeholder: '00.000.000/0001-00' },
                { label: 'E-mail', key: 'email', type: 'email' },
                { label: 'Telefone', key: 'telefone', placeholder: '(65) 3000-0000' },
                { label: 'Contato (Nome)', key: 'contato_nome' },
                { label: 'Prazo de Pagamento (dias)', key: 'prazo_pagamento_dias', type: 'number' },
                { label: 'Categoria', key: 'categoria', placeholder: 'Alimentos, Bebidas...' },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? '1/-1' : undefined }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type || 'text'} placeholder={f.placeholder} value={formForn[f.key] || ''} onChange={e => setFormForn(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarFornecedor} className="btn-primary">Salvar Fornecedor</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Pedido de Compra */}
      {modal === 'novo-pc' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 700, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 24px' }}>📦 Novo Pedido de Compra</h2>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Fornecedor *</label>
              <select value={formPC.fornecedor_id} onChange={e => setFormPC(p => ({ ...p, fornecedor_id: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }}>
                <option value="">Selecione...</option>
                {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase' }}>Itens</label>
                <button onClick={() => setFormPC(p => ({ ...p, itens: [...p.itens, { descricao: '', quantidade: 1, unidade: 'UN', valor_unitario: '' }] }))}
                  style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 12 }}>+ Adicionar</button>
              </div>
              {formPC.itens.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <input placeholder="Produto/Serviço" value={item.descricao} onChange={e => setFormPC(p => { const itens = [...p.itens]; itens[idx] = { ...itens[idx], descricao: e.target.value }; return { ...p, itens } })}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
                  <input type="number" placeholder="Qtd" value={item.quantidade} onChange={e => setFormPC(p => { const itens = [...p.itens]; itens[idx] = { ...itens[idx], quantidade: e.target.value }; return { ...p, itens } })}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
                  <input placeholder="UN" value={item.unidade} onChange={e => setFormPC(p => { const itens = [...p.itens]; itens[idx] = { ...itens[idx], unidade: e.target.value }; return { ...p, itens } })}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
                  <input type="number" placeholder="Valor unit." value={item.valor_unitario} onChange={e => setFormPC(p => { const itens = [...p.itens]; itens[idx] = { ...itens[idx], valor_unitario: e.target.value }; return { ...p, itens } })}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
                  <button onClick={() => setFormPC(p => ({ ...p, itens: p.itens.filter((_, i) => i !== idx) }))}
                    style={{ padding: '8px', borderRadius: 6, border: 'none', background: '#e05c5c22', color: '#e05c5c', cursor: 'pointer' }}>×</button>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 10, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <span style={{ fontWeight: 700 }}>Total do Pedido</span>
              <span style={{ fontWeight: 700, fontSize: 22, color: '#4a9eff' }}>{fmtR(totalPC)}</span>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarPedido} className="btn-primary">Criar Pedido</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

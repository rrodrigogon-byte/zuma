/**
 * Supermercado — SetPoint Ultra
 * Balança, Lotes/Validade, Etiquetas de Gôndola, Promoções, Açougue/Padaria
 */
import { useState, useEffect, useCallback } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const TABS = ['Produtos', 'Lotes & Validade', 'Promoções', 'Etiquetas', 'Açougue/Padaria']

function diasParaVencer(dataValidade) {
  if (!dataValidade) return null
  const diff = Math.ceil((new Date(dataValidade) - new Date()) / (1000 * 60 * 60 * 24))
  return diff
}

function BadgeValidade({ dias }) {
  if (dias === null) return null
  if (dias < 0) return <span style={{ background: '#e05c5c22', color: '#e05c5c', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>VENCIDO</span>
  if (dias <= 3) return <span style={{ background: '#e05c5c22', color: '#e05c5c', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Vence em {dias}d</span>
  if (dias <= 7) return <span style={{ background: '#f59e0b22', color: '#f59e0b', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Vence em {dias}d</span>
  return <span style={{ background: '#5FB33522', color: '#5FB335', padding: '2px 8px', borderRadius: 20, fontSize: 11 }}>{dias}d restantes</span>
}

export default function Supermercado() {
  const { toast } = useToast()
  const [tab, setTab] = useState('Produtos')
  const [produtos, setProdutos] = useState([])
  const [lotes, setLotes] = useState([])
  const [promocoes, setPromocoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [busca, setBusca] = useState('')
  const [filtroVencendo, setFiltroVencendo] = useState(false)

  // Form produto
  const [formProd, setFormProd] = useState({
    nome: '', codigo_barras: '', categoria: '', unidade: 'UN',
    preco_custo: '', preco_venda: '', peso_liquido_kg: '',
    controla_balanca: false, controla_lote: false, estoque_minimo: 0
  })

  // Form lote
  const [formLote, setFormLote] = useState({
    produto_id: '', numero_lote: '', data_fabricacao: '', data_validade: '',
    quantidade: '', fornecedor_nome: ''
  })

  // Form promoção
  const [formPromo, setFormPromo] = useState({
    nome: '', tipo: 'desconto_percentual', valor: '', data_inicio: '', data_fim: '',
    produto_ids: [], quantidade_minima: 1, quantidade_leve: 0, quantidade_pague: 0
  })

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [prodData, loteData, promoData] = await Promise.all([
        api.get('/api/v1/supermercado/produtos').catch(() => ({ produtos: [] })),
        api.get('/api/v1/supermercado/lotes').catch(() => ({ lotes: [] })),
        api.get('/api/v1/supermercado/promocoes').catch(() => ({ promocoes: [] }))
      ])
      setProdutos(prodData.produtos || [])
      setLotes(loteData.lotes || [])
      setPromocoes(promoData.promocoes || [])
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function salvarProduto() {
    try {
      await api.post('/api/v1/supermercado/produtos', formProd)
      toast('Produto cadastrado!', 'success')
      setModal(null)
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function salvarLote() {
    try {
      await api.post('/api/v1/supermercado/lotes', formLote)
      toast('Lote registrado!', 'success')
      setModal(null)
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function salvarPromocao() {
    try {
      await api.post('/api/v1/supermercado/promocoes', formPromo)
      toast('Promoção criada!', 'success')
      setModal(null)
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function gerarEtiqueta(produtoId) {
    try {
      const url = `/api/v1/supermercado/produtos/${produtoId}/etiqueta`
      window.open(url, '_blank')
    } catch (e) { toast(e.message, 'error') }
  }

  const lotesFiltrados = lotes.filter(l => {
    if (filtroVencendo) {
      const dias = diasParaVencer(l.data_validade)
      return dias !== null && dias <= 7
    }
    return true
  }).filter(l => !busca || l.produto_nome?.toLowerCase().includes(busca.toLowerCase()) || l.numero_lote?.includes(busca))

  const lotesCriticos = lotes.filter(l => {
    const dias = diasParaVencer(l.data_validade)
    return dias !== null && dias <= 7
  }).length

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>🏪 Supermercado</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            {produtos.length} produtos
            {lotesCriticos > 0 && <span style={{ marginLeft: 8, color: '#e05c5c', fontWeight: 700 }}>⚠️ {lotesCriticos} lotes vencendo em 7 dias</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {tab === 'Produtos' && <button className="btn-primary" onClick={() => setModal('novo-prod')}>+ Novo Produto</button>}
          {tab === 'Lotes & Validade' && <button className="btn-primary" onClick={() => setModal('novo-lote')}>+ Registrar Lote</button>}
          {tab === 'Promoções' && <button className="btn-primary" onClick={() => setModal('nova-promo')}>+ Nova Promoção</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--card)', borderRadius: 10, padding: 4, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? '#fff' : 'var(--muted)', cursor: 'pointer', fontWeight: tab === t ? 600 : 400, position: 'relative' }}>
            {t}
            {t === 'Lotes & Validade' && lotesCriticos > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, background: '#e05c5c', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{lotesCriticos}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Carregando...</div> : (
        <>
          {/* Produtos */}
          {tab === 'Produtos' && (
            <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--card2)', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Código</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Produto</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Categoria</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Preço Venda</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Estoque</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Flags</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhum produto cadastrado</td></tr>
                  ) : produtos.map(p => (
                    <tr key={p.id} style={{ borderTop: '1px solid var(--line)', background: (p.estoque_atual || 0) <= (p.estoque_minimo || 0) ? '#e05c5c06' : 'transparent' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--muted)' }}>{p.codigo_barras || '-'}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{p.nome}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: 'var(--card2)', padding: '2px 8px', borderRadius: 20, fontSize: 12 }}>{p.categoria || '-'}</span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#5FB335' }}>{fmtR(p.preco_venda || 0)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: (p.estoque_atual || 0) <= (p.estoque_minimo || 0) ? '#e05c5c' : 'var(--fg)' }}>
                          {p.estoque_atual || 0} {p.unidade}
                        </span>
                        {(p.estoque_atual || 0) <= (p.estoque_minimo || 0) && <span style={{ marginLeft: 4, fontSize: 11, color: '#e05c5c' }}>⚠️ mín</span>}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          {p.controla_balanca && <span title="Integra balança" style={{ background: '#4a9eff22', color: '#4a9eff', padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>⚖️</span>}
                          {p.controla_lote && <span title="Controle de lote" style={{ background: '#8b5cf622', color: '#8b5cf6', padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>📦</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button onClick={() => gerarEtiqueta(p.id)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer', fontSize: 12 }}>
                          🏷️ Etiqueta
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Lotes & Validade */}
          {tab === 'Lotes & Validade' && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                <input placeholder="Buscar produto ou nº lote..." value={busca} onChange={e => setBusca(e.target.value)}
                  style={{ flex: 1, maxWidth: 300, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={filtroVencendo} onChange={e => setFiltroVencendo(e.target.checked)} />
                  Mostrar apenas vencendo em 7 dias
                </label>
              </div>
              <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--card2)', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Produto</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Nº Lote</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Qtd</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Fabricação</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Validade</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotesFiltrados.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhum lote encontrado</td></tr>
                    ) : lotesFiltrados.map(l => {
                      const dias = diasParaVencer(l.data_validade)
                      return (
                        <tr key={l.id} style={{ borderTop: '1px solid var(--line)', background: dias !== null && dias <= 3 ? '#e05c5c08' : dias !== null && dias <= 7 ? '#f59e0b08' : 'transparent' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{l.produto_nome}</td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12 }}>{l.numero_lote}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>{l.quantidade_atual || l.quantidade}</td>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>{l.data_fabricacao ? fmtDate(l.data_fabricacao) : '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: 13 }}>{l.data_validade ? fmtDate(l.data_validade) : '-'}</td>
                          <td style={{ padding: '12px 16px' }}><BadgeValidade dias={dias} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Promoções */}
          {tab === 'Promoções' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {promocoes.length === 0 ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Nenhuma promoção ativa</div>
              ) : promocoes.map(p => {
                const ativa = new Date(p.data_fim) >= new Date()
                return (
                  <div key={p.id} style={{ background: 'var(--card)', borderRadius: 12, padding: 20, border: `1px solid ${ativa ? 'var(--accent)' : 'var(--line)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{p.nome}</div>
                      <span style={{ background: ativa ? '#5FB33522' : '#88888822', color: ativa ? '#5FB335' : '#888', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                        {ativa ? 'Ativa' : 'Encerrada'}
                      </span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', marginBottom: 8 }}>
                      {p.tipo === 'desconto_percentual' ? `${p.valor}% OFF` :
                       p.tipo === 'leve_pague' ? `Leve ${p.quantidade_leve} Pague ${p.quantidade_pague}` :
                       fmtR(p.valor)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {fmtDate(p.data_inicio)} até {fmtDate(p.data_fim)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Etiquetas */}
          {tab === 'Etiquetas' && (
            <div style={{ background: 'var(--card)', borderRadius: 12, padding: 32, border: '1px solid var(--line)', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏷️</div>
              <h3 style={{ margin: '0 0 8px' }}>Gerador de Etiquetas de Gôndola</h3>
              <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
                Selecione os produtos na aba "Produtos" e clique em "Etiqueta" para gerar etiquetas individuais,
                ou use o botão abaixo para gerar etiquetas em lote.
              </p>
              <button className="btn-primary" onClick={() => toast('Selecione produtos na aba Produtos', 'info')}>
                🖨️ Gerar Etiquetas em Lote
              </button>
            </div>
          )}

          {/* Açougue/Padaria */}
          {tab === 'Açougue/Padaria' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ background: 'var(--card)', borderRadius: 12, padding: 24, border: '1px solid var(--line)' }}>
                <h3 style={{ margin: '0 0 16px' }}>🥩 Açougue</h3>
                <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
                  Controle de desossa com ficha técnica: registre o peso bruto da peça inteira,
                  o rendimento esperado por corte (alcatra, contrafilé, patinho...) e calcule
                  automaticamente o custo por kg de cada corte.
                </p>
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 16, marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Exemplo — Traseiro Bovino 50kg:</div>
                  {[
                    { corte: 'Alcatra', rendimento: '12%', peso: '6kg', custo_kg: 'R$ 45,00' },
                    { corte: 'Contrafilé', rendimento: '10%', peso: '5kg', custo_kg: 'R$ 52,00' },
                    { corte: 'Patinho', rendimento: '8%', peso: '4kg', custo_kg: 'R$ 38,00' },
                    { corte: 'Osso/Sebo', rendimento: '15%', peso: '7.5kg', custo_kg: 'R$ 5,00' },
                  ].map(c => (
                    <div key={c.corte} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{c.corte}</span>
                      <span style={{ color: 'var(--muted)' }}>{c.rendimento} · {c.peso}</span>
                      <span style={{ color: '#5FB335', fontWeight: 700 }}>{c.custo_kg}/kg</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: 'var(--card)', borderRadius: 12, padding: 24, border: '1px solid var(--line)' }}>
                <h3 style={{ margin: '0 0 16px' }}>🥖 Padaria</h3>
                <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
                  Ficha técnica de produção: registre os ingredientes e quantidades de cada receita
                  (pão francês, bolo, croissant...) e calcule automaticamente o custo de produção
                  por unidade ou por kg.
                </p>
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 16, marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Exemplo — Pão Francês (100 unidades):</div>
                  {[
                    { ingrediente: 'Farinha de trigo', qtd: '5kg', custo: 'R$ 18,50' },
                    { ingrediente: 'Fermento', qtd: '150g', custo: 'R$ 2,40' },
                    { ingrediente: 'Sal', qtd: '100g', custo: 'R$ 0,30' },
                    { ingrediente: 'Custo total', qtd: '', custo: 'R$ 21,20' },
                  ].map((i, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 13, fontWeight: idx === 3 ? 700 : 400 }}>
                      <span>{i.ingrediente}</span>
                      <span style={{ color: 'var(--muted)' }}>{i.qtd}</span>
                      <span style={{ color: idx === 3 ? '#5FB335' : 'var(--fg)' }}>{i.custo}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, fontSize: 12, color: '#5FB335', fontWeight: 700 }}>
                    Custo por unidade: R$ 0,21 · Preço sugerido: R$ 0,75
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal: Novo Produto */}
      {modal === 'novo-prod' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 24px' }}>🏪 Novo Produto</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Nome *', key: 'nome', full: true },
                { label: 'Código de Barras (EAN)', key: 'codigo_barras', placeholder: '7891234567890' },
                { label: 'Categoria', key: 'categoria', placeholder: 'Laticínios, Bebidas...' },
                { label: 'Unidade', key: 'unidade', placeholder: 'UN, KG, L...' },
                { label: 'Preço de Custo (R$)', key: 'preco_custo', type: 'number' },
                { label: 'Preço de Venda (R$)', key: 'preco_venda', type: 'number' },
                { label: 'Peso Líquido (kg)', key: 'peso_liquido_kg', type: 'number', placeholder: '1.0' },
                { label: 'Estoque Mínimo', key: 'estoque_minimo', type: 'number', placeholder: '5' },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? '1/-1' : undefined }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type || 'text'} placeholder={f.placeholder} value={formProd[f.key] || ''} onChange={e => setFormProd(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={formProd.controla_balanca} onChange={e => setFormProd(p => ({ ...p, controla_balanca: e.target.checked }))} />
                  ⚖️ Integra balança
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={formProd.controla_lote} onChange={e => setFormProd(p => ({ ...p, controla_lote: e.target.checked }))} />
                  📦 Controle de lote
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarProduto} className="btn-primary">Salvar Produto</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Lote */}
      {modal === 'novo-lote' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 500 }}>
            <h2 style={{ margin: '0 0 24px' }}>📦 Registrar Lote</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Produto *</label>
                <select value={formLote.produto_id} onChange={e => setFormLote(p => ({ ...p, produto_id: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }}>
                  <option value="">Selecione...</option>
                  {produtos.filter(p => p.controla_lote).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              {[
                { label: 'Número do Lote *', key: 'numero_lote', placeholder: 'LOT-2026-001' },
                { label: 'Quantidade *', key: 'quantidade', type: 'number' },
                { label: 'Data de Fabricação', key: 'data_fabricacao', type: 'date' },
                { label: 'Data de Validade *', key: 'data_validade', type: 'date' },
                { label: 'Fornecedor', key: 'fornecedor_nome', placeholder: 'Nome do fornecedor' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type || 'text'} placeholder={f.placeholder} value={formLote[f.key] || ''} onChange={e => setFormLote(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarLote} className="btn-primary">Registrar Lote</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nova Promoção */}
      {modal === 'nova-promo' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 520 }}>
            <h2 style={{ margin: '0 0 24px' }}>🏷️ Nova Promoção</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Nome da Promoção *</label>
                <input placeholder="Ex: Semana do Frango" value={formPromo.nome} onChange={e => setFormPromo(p => ({ ...p, nome: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Tipo de Promoção</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { value: 'desconto_percentual', label: '% Desconto' },
                    { value: 'desconto_valor', label: 'R$ Desconto' },
                    { value: 'leve_pague', label: 'Leve X Pague Y' },
                    { value: 'preco_fixo', label: 'Preço Fixo' },
                  ].map(t => (
                    <button key={t.value} onClick={() => setFormPromo(p => ({ ...p, tipo: t.value }))}
                      style={{ padding: '8px 14px', borderRadius: 8, border: `2px solid ${formPromo.tipo === t.value ? 'var(--accent)' : 'var(--line)'}`, background: formPromo.tipo === t.value ? 'var(--accent)22' : 'transparent', color: formPromo.tipo === t.value ? 'var(--accent)' : 'var(--fg)', cursor: 'pointer', fontWeight: formPromo.tipo === t.value ? 700 : 400 }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {formPromo.tipo === 'leve_pague' ? (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Leve</label>
                    <input type="number" placeholder="3" value={formPromo.quantidade_leve} onChange={e => setFormPromo(p => ({ ...p, quantidade_leve: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Pague</label>
                    <input type="number" placeholder="2" value={formPromo.quantidade_pague} onChange={e => setFormPromo(p => ({ ...p, quantidade_pague: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
                  </div>
                </>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                    {formPromo.tipo === 'desconto_percentual' ? 'Desconto (%)' : 'Valor (R$)'}
                  </label>
                  <input type="number" placeholder={formPromo.tipo === 'desconto_percentual' ? '10' : '5.00'} value={formPromo.valor} onChange={e => setFormPromo(p => ({ ...p, valor: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Data Início</label>
                <input type="date" value={formPromo.data_inicio} onChange={e => setFormPromo(p => ({ ...p, data_inicio: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Data Fim</label>
                <input type="date" value={formPromo.data_fim} onChange={e => setFormPromo(p => ({ ...p, data_fim: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarPromocao} className="btn-primary">Criar Promoção</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

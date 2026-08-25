import { useEffect, useMemo, useState } from 'react'
import { Archive, BarChart3, Check, ChevronRight, ClipboardList, Edit3, Eye, PackagePlus, Plus, RefreshCw, Search, Settings2, ShoppingBag, Trash2, Truck, X } from 'lucide-react'
import { api, fmtDate, fmtR } from '../../lib/api'
import './ecommerce-admin.css'

const STATUS = [
  ['pendente', 'Novos'],
  ['preparando', 'Em preparo'],
  ['pronto', 'Prontos'],
  ['entregue', 'Concluídos'],
  ['cancelado', 'Cancelados'],
]

const EMPTY_FORM = { nome: '', cat: 'Geral', preco: '', precoPromocional: '', estoque: '', descricao: '', imagem: '', ativo: true }

function money(value) { return fmtR(Number(value || 0)) }

export default function EcommerceAdmin() {
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('visao')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [notice, setNotice] = useState('')

  async function loadData(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError('')
    try {
      const [productData, orderData, customerData] = await Promise.all([
        api.get('/api/admin/loja'),
        api.get('/api/admin/loja/pedidos'),
        api.get('/api/admin/clientes').catch(() => ({ clientes: [] })),
      ])
      setProducts(Array.isArray(productData) ? productData : productData?.produtos || [])
      setOrders(Array.isArray(orderData) ? orderData : orderData?.pedidos || [])
      setCustomers(Array.isArray(customerData) ? customerData : customerData?.clientes || [])
    } catch (err) { setError(err.message || 'Não foi possível carregar a operação comercial.') }
    finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { loadData() }, [])

  const filteredProducts = useMemo(() => products.filter(item => {
    const text = `${item.nome || ''} ${item.cat || ''} ${item.cod || ''}`.toLowerCase()
    return !query.trim() || text.includes(query.trim().toLowerCase())
  }), [products, query])
  const revenue = orders.filter(order => order.status !== 'cancelado').reduce((sum, order) => sum + Number(order.total || 0), 0)
  const lowStock = products.filter(item => Number(item.estoque || 0) <= 5 && item.ativo !== false).length
  const openOrders = orders.filter(order => !['entregue', 'cancelado'].includes(order.status)).length

  function beginCreate() { setForm(EMPTY_FORM); setEditingId(null); setModalOpen(true) }
  function beginEdit(item) { setForm({ nome: item.nome || '', cat: item.cat || 'Geral', preco: item.preco ?? '', precoPromocional: item.precoPromocional ?? '', estoque: item.estoque ?? '', descricao: item.descricao || item.desc || '', imagem: item.imagem || '', ativo: item.ativo !== false }); setEditingId(item.id); setModalOpen(true) }
  function change(field, value) { setForm(current => ({ ...current, [field]: value })) }

  async function saveProduct(event) {
    event.preventDefault()
    try {
      const payload = { ...form, preco: Number(form.preco || 0), precoPromocional: form.precoPromocional === '' ? null : Number(form.precoPromocional), estoque: Number(form.estoque || 0) }
      const result = editingId ? await api.patch(`/api/admin/loja/${editingId}`, payload) : await api.post('/api/admin/loja', payload)
      const product = result?.produto || result
      setProducts(current => editingId ? current.map(item => item.id === editingId ? product : item) : [product, ...current])
      setNotice(editingId ? 'Produto atualizado.' : 'Produto cadastrado.')
      setModalOpen(false)
    } catch (err) { setError(err.message || 'Não foi possível salvar o produto.') }
  }

  async function toggleProduct(item) {
    try {
      const result = await api.patch(`/api/admin/loja/${item.id}`, { ativo: item.ativo === false })
      const product = result?.produto || result
      setProducts(current => current.map(row => row.id === item.id ? product : row))
    } catch (err) { setError(err.message || 'Não foi possível alterar o status do produto.') }
  }

  async function deleteProduct(item) {
    if (!window.confirm(`Excluir “${item.nome}”? Esta ação remove o item do catálogo.`)) return
    try { await api.delete(`/api/admin/loja/${item.id}`); setProducts(current => current.filter(row => row.id !== item.id)); setNotice('Produto excluído.') }
    catch (err) { setError(err.message || 'Não foi possível excluir o produto.') }
  }

  async function updateOrder(order, status, pagamento) {
    try {
      const result = await api.patch(`/api/admin/loja/pedidos/${order.id}`, { status, ...(pagamento ? { pagamento } : {}) })
      const updated = result?.pedido || result
      setOrders(current => current.map(item => item.id === order.id ? updated : item))
      setNotice(`Pedido ${order.codigo} atualizado.`)
    } catch (err) { setError(err.message || 'Não foi possível atualizar o pedido.') }
  }

  return <main className="ecommerce-admin-shell">
    <header className="ecommerce-admin-header"><div><span className="ecommerce-admin-kicker"><ShoppingBag size={14} /> Commerce OS</span><h1>Operação comercial</h1><p>Catálogo, estoque e pedidos em uma visão única para sua loja.</p></div><div className="ecommerce-admin-header-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={() => loadData(true)}><RefreshCw size={15} className={refreshing ? 'ecommerce-admin-spin' : ''} /> Atualizar</button><button type="button" className="ecommerce-admin-button primary" onClick={beginCreate}><Plus size={16} /> Novo item</button></div></header>
    {error && <div className="ecommerce-admin-alert error">{error}<button type="button" onClick={() => setError('')} aria-label="Fechar aviso"><X size={15} /></button></div>}
    {notice && <div className="ecommerce-admin-alert success"><Check size={15} /> {notice}<button type="button" onClick={() => setNotice('')} aria-label="Fechar aviso"><X size={15} /></button></div>}
    <nav className="ecommerce-admin-tabs" aria-label="Administração comercial"><button className={tab === 'visao' ? 'active' : ''} onClick={() => setTab('visao')}><BarChart3 size={15} /> Visão geral</button><button className={tab === 'catalogo' ? 'active' : ''} onClick={() => setTab('catalogo')}><Archive size={15} /> Catálogo</button><button className={tab === 'pedidos' ? 'active' : ''} onClick={() => setTab('pedidos')}><ClipboardList size={15} /> Pedidos {openOrders > 0 && <b>{openOrders}</b>}</button><a href="/admin/estoque"><PackagePlus size={15} /> Estoque</a><a href="/admin/pagamentos"><Truck size={15} /> Pagamentos</a><a href="/admin/configuracoes"><Settings2 size={15} /> Configurações</a></nav>
    {loading ? <div className="ecommerce-admin-loading">Carregando operação…</div> : <>
      {tab === 'visao' && <section className="ecommerce-admin-overview"><div className="ecommerce-admin-kpis"><article><span>Vendas registradas</span><strong>{money(revenue)}</strong><small>{orders.length} pedido(s) no histórico</small></article><article><span>Pedidos em aberto</span><strong>{openOrders}</strong><small>Na fila operacional agora</small></article><article><span>Itens publicados</span><strong>{products.filter(item => item.ativo !== false).length}</strong><small>{lowStock} em estoque baixo</small></article><article><span>Clientes</span><strong>{customers.length}</strong><small>Base da operação</small></article></div><div className="ecommerce-admin-overview-grid"><section className="ecommerce-admin-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Fluxo</span><h2>Pedidos recentes</h2></div><button type="button" onClick={() => setTab('pedidos')}>Ver fila <ChevronRight size={15} /></button></div>{orders.slice(0, 5).map(order => <div className="ecommerce-admin-order-line" key={order.id}><div><strong>{order.codigo}</strong><span>{order.cliente?.nome || 'Cliente balcão'} · {fmtDate(order.criadoEm)}</span></div><div><b>{money(order.total)}</b><em className={`status-${order.status}`}>{order.status}</em></div></div>)}{!orders.length && <p className="ecommerce-admin-empty">Nenhum pedido registrado.</p>}</section><section className="ecommerce-admin-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Catálogo</span><h2>Estoque em atenção</h2></div><button type="button" onClick={() => setTab('catalogo')}>Gerenciar <ChevronRight size={15} /></button></div>{products.filter(item => Number(item.estoque || 0) <= 5 && item.ativo !== false).slice(0, 6).map(item => <div className="ecommerce-admin-stock-line" key={item.id}><div><strong>{item.nome}</strong><span>{item.cat || 'Geral'}</span></div><b>{item.estoque || 0} un.</b></div>)}{!lowStock && <p className="ecommerce-admin-empty">Nenhum item em estoque baixo.</p>}</section></div></section>}
      {tab === 'catalogo' && <section className="ecommerce-admin-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Produtos</span><h2>Catálogo da loja</h2></div><div className="ecommerce-admin-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar item ou categoria" aria-label="Buscar item" /></div></div><div className="ecommerce-admin-table-wrap"><table className="ecommerce-admin-table"><thead><tr><th>Item</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Ações</th></tr></thead><tbody>{filteredProducts.map(item => <tr key={item.id}><td><div className="ecommerce-admin-item"><span>{item.imagem ? <img src={item.imagem} alt="" /> : item.emoji || '▦'}</span><div><strong>{item.nome}</strong><small>{item.cod || 'Sem SKU'}</small></div></div></td><td>{item.cat || 'Geral'}</td><td>{item.precoPromocional && Number(item.precoPromocional) < Number(item.preco) ? <div className="ecommerce-admin-price"><s>{money(item.preco)}</s><b>{money(item.precoPromocional)}</b></div> : money(item.preco)}</td><td><b className={Number(item.estoque || 0) <= 5 ? 'low' : ''}>{item.estoque || 0}</b></td><td><button type="button" className={`ecommerce-status-toggle ${item.ativo !== false ? 'on' : ''}`} onClick={() => toggleProduct(item)}><span />{item.ativo !== false ? 'Publicado' : 'Arquivado'}</button></td><td><div className="ecommerce-row-actions"><button type="button" onClick={() => beginEdit(item)} aria-label={`Editar ${item.nome}`}><Edit3 size={15} /></button><button type="button" onClick={() => deleteProduct(item)} aria-label={`Excluir ${item.nome}`}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>{!filteredProducts.length && <p className="ecommerce-admin-empty">Nenhum item encontrado.</p>}</div></section>}
      {tab === 'pedidos' && <section className="ecommerce-admin-orders"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Fulfillment</span><h2>Fila de pedidos</h2></div><a href="/loja">Abrir vitrine <Eye size={15} /></a></div><div className="ecommerce-admin-kanban">{STATUS.filter(([status]) => status !== 'cancelado').map(([status, label]) => <section className="ecommerce-admin-column" key={status}><header><strong>{label}</strong><b>{orders.filter(order => order.status === status).length}</b></header>{orders.filter(order => order.status === status).map(order => <article className="ecommerce-admin-order-card" key={order.id}><div className="ecommerce-admin-order-card-head"><strong>{order.codigo}</strong><span>{fmtDate(order.criadoEm)}</span></div><p>{order.cliente?.nome || 'Cliente balcão'}</p><div className="ecommerce-admin-order-items">{(order.itens || []).slice(0, 3).map(item => <span key={`${order.id}-${item.produtoId}`}>{item.qtd}× {item.nome}</span>)}</div><footer><b>{money(order.total)}</b>{status === 'pendente' && <button type="button" onClick={() => updateOrder(order, 'preparando')}>Preparar</button>}{status === 'preparando' && <button type="button" onClick={() => updateOrder(order, 'pronto')}>Liberar</button>}{status === 'pronto' && <button type="button" onClick={() => updateOrder(order, 'entregue')}>Concluir</button>}</footer></article>)}</section>)}</div></section>}
    </>}
    {modalOpen && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Cadastro de produto"><form className="ecommerce-admin-modal" onSubmit={saveProduct}><button type="button" className="ecommerce-admin-close" onClick={() => setModalOpen(false)} aria-label="Fechar"><X size={17} /></button><span className="ecommerce-admin-kicker">{editingId ? 'Editar item' : 'Novo item'}</span><h2>{editingId ? 'Atualizar produto' : 'Cadastrar produto'}</h2><div className="ecommerce-admin-form-grid"><label className="wide">Nome do item<input required value={form.nome} onChange={event => change('nome', event.target.value)} /></label><label>Categoria<input value={form.cat} onChange={event => change('cat', event.target.value)} /></label><label>Preço de venda<input required type="number" min="0" step="0.01" value={form.preco} onChange={event => change('preco', event.target.value)} /></label><label>Preço promocional<input type="number" min="0" step="0.01" value={form.precoPromocional} onChange={event => change('precoPromocional', event.target.value)} /></label><label>Estoque inicial<input required type="number" min="0" step="1" value={form.estoque} onChange={event => change('estoque', event.target.value)} /></label><label>URL da imagem<input type="url" placeholder="https://…" value={form.imagem} onChange={event => change('imagem', event.target.value)} /></label><label className="wide">Descrição<textarea rows="4" value={form.descricao} onChange={event => change('descricao', event.target.value)} /></label></div><div className="ecommerce-admin-modal-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary"><Check size={15} /> Salvar item</button></div></form></div>}
  </main>
}

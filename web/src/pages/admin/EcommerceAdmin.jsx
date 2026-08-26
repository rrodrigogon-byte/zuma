import { useEffect, useMemo, useState } from 'react'
import { Archive, BarChart3, Check, ChevronRight, ClipboardList, Edit3, Eye, FileBarChart, PackagePlus, Plus, RefreshCw, Search, Settings2, ShoppingBag, Tag, Trash2, Truck, X } from 'lucide-react'
import { fmtDate, fmtR } from '../../lib/api'
import { createCoreCustomer, createCoreCustomerAddress, createCoreDomain, createCoreFulfillment, createCorePromotion, createCoreShippingMethod, deleteCoreCustomerAddress, deleteCoreProduct, loadCommerceAdmin, loadCoreCustomerAddresses, loadCoreReports, saveCoreProduct, setPrimaryCoreDomain, toggleCoreProduct, updateCoreCustomer, updateCoreFulfillment, updateCoreMembership, updateCoreOrder, verifyCoreDomain } from './commerce-admin-adapter'
import { api } from '../../lib/api'
import './ecommerce-admin.css'

const STATUS = [
  ['pendente', 'Novos'],
  ['preparando', 'Em preparo'],
  ['pronto', 'Prontos'],
  ['entregue', 'Concluídos'],
  ['cancelado', 'Cancelados'],
]
const FULFILLMENT_TRANSITIONS = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['shipped', 'out_for_delivery', 'picked_up', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered', 'failed'],
  out_for_delivery: ['delivered', 'failed'],
  failed: ['preparing', 'cancelled'],
}
const FULFILLMENT_LABELS = { pending: 'Pendente', preparing: 'Em preparo', ready: 'Pronto', shipped: 'Enviado', out_for_delivery: 'Em rota', delivered: 'Entregue', picked_up: 'Retirado', failed: 'Falhou', cancelled: 'Cancelado' }

const EMPTY_FORM = { nome: '', cod: '', cat: 'Geral', categoryId: '', preco: '', precoPromocional: '', estoque: '', descricao: '', imagem: '', ativo: true }
const EMPTY_PROMOTION = { nome: '', tipo: 'percentage', valor: '', codigo: '', limiteUso: '', usoMaximo: '' }
const EMPTY_CUSTOMER = { nome: '', email: '', telefone: '', documentoMascarado: '', bloqueado: false }
const EMPTY_ADDRESS = { rotulo: 'principal', destinatario: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', referencia: '', padrao: true }
const EMPTY_SHIPPING = { codigo: '', nome: '', tipo: 'pickup', configuracao: '{}' }
const EMPTY_DOMAIN = { dominio: '', principal: false }

function money(value) { return fmtR(Number(value || 0)) }

export default function EcommerceAdmin() {
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [categories, setCategories] = useState([])
  const [promotions, setPromotions] = useState([])
  const [memberships, setMemberships] = useState([])
  const [roles, setRoles] = useState([])
  const [shippingMethods, setShippingMethods] = useState([])
  const [fulfillments, setFulfillments] = useState([])
  const [domains, setDomains] = useState([])
  const [reports, setReports] = useState(null)
  const [promotionForm, setPromotionForm] = useState(EMPTY_PROMOTION)
  const [mode, setMode] = useState('legacy')
  const [storefrontId, setStorefrontId] = useState(null)
  const [locationId, setLocationId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('visao')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER)
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS)
  const [shippingForm, setShippingForm] = useState(EMPTY_SHIPPING)
  const [domainForm, setDomainForm] = useState(EMPTY_DOMAIN)
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [shippingModalOpen, setShippingModalOpen] = useState(false)
  const [domainModalOpen, setDomainModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerAddresses, setCustomerAddresses] = useState([])
  const [editingCustomerId, setEditingCustomerId] = useState(null)

  async function loadData(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError('')
    try {
      const data = await loadCommerceAdmin()
      setMode(data.mode)
      setStorefrontId(data.storefrontId)
      setLocationId(data.locationId)
      setProducts(data.products)
      setOrders(data.orders)
      setCustomers(data.customers)
      setCategories(data.categories || [])
      setPromotions(data.promotions || [])
      setMemberships(data.memberships || [])
      setRoles(data.roles || [])
      setShippingMethods(data.shippingMethods || [])
      setFulfillments(data.fulfillments || [])
      setDomains(data.domains || [])
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

  function beginCreate() { setForm(EMPTY_FORM); setEditingId(null); setEditingProduct(null); setModalOpen(true) }
  function beginEdit(item) {
    setForm({ nome: item.nome || '', cod: item.cod || '', cat: item.cat || 'Geral', categoryId: item.categoryId || item.category_id || '', preco: item.preco ?? '', precoPromocional: item.precoPromocional ?? '', estoque: item.estoque ?? '', descricao: item.descricao || item.desc || '', imagem: item.imagem || '', ativo: item.ativo !== false })
    setEditingId(item.id)
    setEditingProduct(item)
    setModalOpen(true)
  }
  function change(field, value) { setForm(current => ({ ...current, [field]: value })) }

  async function saveProduct(event) {
    event.preventDefault()
    try {
      if (mode === 'core') {
        await saveCoreProduct({ editingId, current: editingProduct, form, storefrontId, locationId })
        setNotice(editingId ? 'Produto atualizado no Commerce Core.' : 'Produto cadastrado no Commerce Core.')
        setModalOpen(false)
        await loadData(true)
        return
      }
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
      if (mode === 'core') {
        await toggleCoreProduct(item, storefrontId)
        setNotice(item.ativo === false ? 'Produto publicado no canal.' : 'Produto retirado do canal.')
        await loadData(true)
        return
      }
      const result = await api.patch(`/api/admin/loja/${item.id}`, { ativo: item.ativo === false })
      const product = result?.produto || result
      setProducts(current => current.map(row => row.id === item.id ? product : row))
    } catch (err) { setError(err.message || 'Não foi possível alterar o status do produto.') }
  }

  async function deleteProduct(item) {
    if (!window.confirm(`Excluir “${item.nome}”? Esta ação remove o item do catálogo.`)) return
    try {
      if (mode === 'core') {
        await deleteCoreProduct(item)
        setNotice('Produto arquivado no Commerce Core.')
        await loadData(true)
        return
      }
      await api.delete(`/api/admin/loja/${item.id}`)
      setProducts(current => current.filter(row => row.id !== item.id))
      setNotice('Produto excluído.')
    } catch (err) { setError(err.message || 'Não foi possível excluir o produto.') }
  }

  async function toggleMembership(membership) {
    try {
      await updateCoreMembership(membership.id, { ativo: !membership.ativo })
      setMemberships(current => current.map(item => item.id === membership.id ? { ...item, ativo: !item.ativo } : item))
      setNotice(`Membership de ${membership.email} ${membership.ativo ? 'desativada' : 'ativada'}.`)
    } catch (err) { setError(err.message || 'Não foi possível atualizar a membership.') }
  }

  function beginCustomerCreate() { setCustomerForm(EMPTY_CUSTOMER); setEditingCustomerId(null); setCustomerModalOpen(true) }
  function beginCustomerEdit(customer) { setCustomerForm({ nome: customer.nome || '', email: customer.email || '', telefone: customer.telefone || '', documentoMascarado: customer.documento_mascarado || '', bloqueado: customer.bloqueado === true }); setEditingCustomerId(customer.id); setCustomerModalOpen(true) }
  async function saveCustomer(event) {
    event.preventDefault()
    try {
      if (mode !== 'core') throw new Error('Clientes do Commerce Core exigem PostgreSQL ativo.')
      if (editingCustomerId) await updateCoreCustomer(editingCustomerId, customerForm)
      else await createCoreCustomer(customerForm)
      setCustomerModalOpen(false)
      setNotice(editingCustomerId ? 'Cliente atualizado no Commerce Core.' : 'Cliente cadastrado no Commerce Core.')
      await loadData(true)
    } catch (err) { setError(err.message || 'Não foi possível salvar o cliente.') }
  }
  async function openCustomerAddresses(customer) {
    try {
      setSelectedCustomer(customer)
      const data = await loadCoreCustomerAddresses(customer.id)
      setCustomerAddresses(data?.items || [])
      setAddressForm({ ...EMPTY_ADDRESS, destinatario: customer.nome || '' })
      setAddressModalOpen(true)
    } catch (err) { setError(err.message || 'Não foi possível carregar os endereços.') }
  }
  async function saveAddress(event) {
    event.preventDefault()
    try {
      await createCoreCustomerAddress(selectedCustomer.id, addressForm)
      const data = await loadCoreCustomerAddresses(selectedCustomer.id)
      setCustomerAddresses(data?.items || [])
      setAddressForm({ ...EMPTY_ADDRESS, destinatario: selectedCustomer.nome || '' })
      setNotice('Endereço salvo com auditoria no tenant.')
    } catch (err) { setError(err.message || 'Não foi possível salvar o endereço.') }
  }
  async function removeAddress(address) {
    if (!window.confirm(`Excluir o endereço “${address.rotulo}”?`)) return
    try {
      await deleteCoreCustomerAddress(selectedCustomer.id, address.id)
      setCustomerAddresses(current => current.filter(item => item.id !== address.id))
      setNotice('Endereço removido.')
    } catch (err) { setError(err.message || 'Não foi possível remover o endereço.') }
  }
  async function saveShippingMethod(event) {
    event.preventDefault()
    try {
      if (mode !== 'core' || !storefrontId) throw new Error('Storefront Core não configurado para a loja.')
      let configuracao = {}
      try { configuracao = shippingForm.configuracao ? JSON.parse(shippingForm.configuracao) : {} } catch { throw new Error('Configuração de entrega deve ser JSON válido.') }
      const created = await createCoreShippingMethod({ ...shippingForm, storefrontId, configuracao })
      setShippingMethods(current => [...current, created])
      setShippingForm(EMPTY_SHIPPING)
      setShippingModalOpen(false)
      setNotice('Método de entrega criado no Commerce Core.')
    } catch (err) { setError(err.message || 'Não foi possível criar o método de entrega.') }
  }
  async function saveDomain(event) {
    event.preventDefault()
    try {
      if (mode !== 'core' || !storefrontId) throw new Error('Storefront Core não configurado para a loja.')
      const created = await createCoreDomain({ storefrontId, ...domainForm })
      setDomains(current => [...current, created])
      setDomainForm(EMPTY_DOMAIN)
      setDomainModalOpen(false)
      setNotice('Domínio cadastrado como pendente. Configure o TXT antes de verificar.')
    } catch (err) { setError(err.message || 'Não foi possível cadastrar o domínio.') }
  }
  async function verifyDomain(domain) {
    try {
      await verifyCoreDomain(domain.id)
      setNotice('Domínio verificado e apto à publicação.')
      await loadData(true)
    } catch (err) { setError(err.message || 'O TXT ainda não corresponde ao desafio.') }
  }
  async function setPrimaryDomain(domain) {
    try {
      await setPrimaryCoreDomain(domain.id)
      setDomains(current => current.map(item => ({ ...item, principal: item.id === domain.id })))
      setNotice('Domínio principal atualizado.')
    } catch (err) { setError(err.message || 'Não foi possível definir o domínio principal.') }
  }
  async function changeFulfillment(fulfillment, status) {
    try {
      const updated = await updateCoreFulfillment(fulfillment.id, { status, ocorrencia: `Atualização administrativa para ${status}` })
      setFulfillments(current => current.map(item => item.id === fulfillment.id ? { ...item, ...updated } : item))
      setNotice('Fulfillment atualizado com auditoria.')
    } catch (err) { setError(err.message || 'Não foi possível atualizar o fulfillment.') }
  }
  async function createOrderFulfillment(event) {
    event.preventDefault()
    try {
      const formData = new FormData(event.currentTarget)
      const orderId = formData.get('orderId')
      const shippingMethodId = formData.get('shippingMethodId') || null
      if (!orderId) throw new Error('Selecione um pedido.')
      const created = await createCoreFulfillment({ orderId, shippingMethodId })
      setFulfillments(current => [created, ...current])
      event.currentTarget.reset()
      setNotice('Fulfillment criado como pendente; nenhum rastreio foi inventado.')
    } catch (err) { setError(err.message || 'Não foi possível criar o fulfillment.') }
  }

  async function savePromotion(event) {
    event.preventDefault()
    try {
      if (mode !== 'core') throw new Error('Promoções e cupons exigem o Commerce Core PostgreSQL ativo.')
      await createCorePromotion(promotionForm)
      setPromotionForm(EMPTY_PROMOTION)
      setNotice('Promoção criada com segurança no tenant.')
      await loadData(true)
    } catch (err) { setError(err.message || 'Não foi possível criar a promoção.') }
  }

  async function loadReports() {
    setError('')
    try {
      if (mode !== 'core') throw new Error('Relatórios do Commerce Core exigem PostgreSQL ativo.')
      setReports(await loadCoreReports())
    } catch (err) { setError(err.message || 'Não foi possível carregar os relatórios.') }
  }

  function changePromotion(field, value) { setPromotionForm(current => ({ ...current, [field]: value })) }
  function changeCustomer(field, value) { setCustomerForm(current => ({ ...current, [field]: value })) }
  function changeAddress(field, value) { setAddressForm(current => ({ ...current, [field]: value })) }
  function changeShipping(field, value) { setShippingForm(current => ({ ...current, [field]: value })) }
  function changeDomain(field, value) { setDomainForm(current => ({ ...current, [field]: value })) }

  async function updateOrder(order, status) {
    try {
      if (mode === 'core') {
        await updateCoreOrder(order, status)
        setNotice(`Pedido ${order.codigo} atualizado no Commerce Core.`)
        await loadData(true)
        return
      }
      const result = await api.patch(`/api/admin/loja/pedidos/${order.id}`, { status })
      const updated = result?.pedido || result
      setOrders(current => current.map(item => item.id === order.id ? updated : item))
      setNotice(`Pedido ${order.codigo} atualizado.`)
    } catch (err) { setError(err.message || 'Não foi possível atualizar o pedido.') }
  }

  return <main className="ecommerce-admin-shell">
    <header className="ecommerce-admin-header"><div><span className="ecommerce-admin-kicker"><ShoppingBag size={14} /> Commerce OS</span><h1>Operação comercial</h1><p>Catálogo, estoque e pedidos em uma visão única para sua loja.</p></div><div className="ecommerce-admin-header-actions"><span className={`commerce-source-badge ${mode}`}>{mode === 'core' ? 'Core PostgreSQL' : 'Catálogo legado'}</span><button type="button" className="ecommerce-admin-button ghost" onClick={() => loadData(true)}><RefreshCw size={15} className={refreshing ? 'ecommerce-admin-spin' : ''} /> Atualizar</button><button type="button" className="ecommerce-admin-button primary" onClick={beginCreate}><Plus size={16} /> Novo item</button></div></header>
    {error && <div className="ecommerce-admin-alert error">{error}<button type="button" onClick={() => setError('')} aria-label="Fechar aviso"><X size={15} /></button></div>}
    {notice && <div className="ecommerce-admin-alert success"><Check size={15} /> {notice}<button type="button" onClick={() => setNotice('')} aria-label="Fechar aviso"><X size={15} /></button></div>}
    <nav className="ecommerce-admin-tabs" aria-label="Administração comercial"><button className={tab === 'visao' ? 'active' : ''} onClick={() => setTab('visao')}><BarChart3 size={15} /> Visão geral</button><button className={tab === 'catalogo' ? 'active' : ''} onClick={() => setTab('catalogo')}><Archive size={15} /> Catálogo</button><button className={tab === 'pedidos' ? 'active' : ''} onClick={() => setTab('pedidos')}><ClipboardList size={15} /> Pedidos {openOrders > 0 && <b>{openOrders}</b>}</button>{mode === 'core' && <><button className={tab === 'promocoes' ? 'active' : ''} onClick={() => setTab('promocoes')}><Tag size={15} /> Promoções</button><button className={tab === 'relatorios' ? 'active' : ''} onClick={() => { setTab('relatorios'); loadReports() }}><FileBarChart size={15} /> Relatórios</button><button className={tab === 'clientes' ? 'active' : ''} onClick={() => setTab('clientes')}><ShoppingBag size={15} /> Clientes</button><button className={tab === 'fulfillment' ? 'active' : ''} onClick={() => setTab('fulfillment')}><Truck size={15} /> Entrega</button><button className={tab === 'dominios' ? 'active' : ''} onClick={() => setTab('dominios')}><Eye size={15} /> Canais</button><button className={tab === 'usuarios' ? 'active' : ''} onClick={() => setTab('usuarios')}><Settings2 size={15} /> Usuários</button></>}<a href="/admin/estoque"><PackagePlus size={15} /> Estoque</a><a href="/admin/pagamentos"><Truck size={15} /> Pagamentos</a><a href="/admin/configuracoes"><Settings2 size={15} /> Configurações</a></nav>
    {loading ? <div className="ecommerce-admin-loading">Carregando operação…</div> : <>
      {tab === 'visao' && <section className="ecommerce-admin-overview"><div className="ecommerce-admin-kpis"><article><span>Vendas registradas</span><strong>{money(revenue)}</strong><small>{orders.length} pedido(s) no histórico</small></article><article><span>Pedidos em aberto</span><strong>{openOrders}</strong><small>Na fila operacional agora</small></article><article><span>Itens publicados</span><strong>{products.filter(item => item.ativo !== false).length}</strong><small>{lowStock} em estoque baixo</small></article><article><span>Clientes</span><strong>{customers.length}</strong><small>Base da operação</small></article></div><div className="ecommerce-admin-overview-grid"><section className="ecommerce-admin-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Fluxo</span><h2>Pedidos recentes</h2></div><button type="button" onClick={() => setTab('pedidos')}>Ver fila <ChevronRight size={15} /></button></div>{orders.slice(0, 5).map(order => <div className="ecommerce-admin-order-line" key={order.id}><div><strong>{order.codigo}</strong><span>{order.cliente?.nome || 'Cliente balcão'} · {fmtDate(order.criadoEm)}</span></div><div><b>{money(order.total)}</b><em className={`status-${order.status}`}>{order.status}</em></div></div>)}{!orders.length && <p className="ecommerce-admin-empty">Nenhum pedido registrado.</p>}</section><section className="ecommerce-admin-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Catálogo</span><h2>Estoque em atenção</h2></div><button type="button" onClick={() => setTab('catalogo')}>Gerenciar <ChevronRight size={15} /></button></div>{products.filter(item => Number(item.estoque || 0) <= 5 && item.ativo !== false).slice(0, 6).map(item => <div className="ecommerce-admin-stock-line" key={item.id}><div><strong>{item.nome}</strong><span>{item.cat || 'Geral'}</span></div><b>{item.estoque || 0} un.</b></div>)}{!lowStock && <p className="ecommerce-admin-empty">Nenhum item em estoque baixo.</p>}</section></div></section>}
      {tab === 'catalogo' && <section className="ecommerce-admin-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Produtos</span><h2>Catálogo da loja</h2></div><div className="ecommerce-admin-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar item ou categoria" aria-label="Buscar item" /></div></div><div className="ecommerce-admin-table-wrap"><table className="ecommerce-admin-table"><thead><tr><th>Item</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Ações</th></tr></thead><tbody>{filteredProducts.map(item => <tr key={item.id}><td><div className="ecommerce-admin-item"><span>{item.imagem ? <img src={item.imagem} alt="" /> : item.emoji || '▦'}</span><div><strong>{item.nome}</strong><small>{item.cod || 'Sem SKU'}</small></div></div></td><td>{item.cat || 'Geral'}</td><td>{item.precoPromocional && Number(item.precoPromocional) < Number(item.preco) ? <div className="ecommerce-admin-price"><s>{money(item.preco)}</s><b>{money(item.precoPromocional)}</b></div> : money(item.preco)}</td><td><b className={Number(item.estoque || 0) <= 5 ? 'low' : ''}>{item.estoque || 0}</b></td><td><button type="button" className={`ecommerce-status-toggle ${item.ativo !== false ? 'on' : ''}`} onClick={() => toggleProduct(item)}><span />{item.ativo !== false ? 'Publicado' : 'Arquivado'}</button></td><td><div className="ecommerce-row-actions"><button type="button" onClick={() => beginEdit(item)} aria-label={`Editar ${item.nome}`}><Edit3 size={15} /></button><button type="button" onClick={() => deleteProduct(item)} aria-label={`Excluir ${item.nome}`}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>{!filteredProducts.length && <p className="ecommerce-admin-empty">Nenhum item encontrado.</p>}</div></section>}
      {tab === 'pedidos' && <section className="ecommerce-admin-orders"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Fulfillment</span><h2>Fila de pedidos</h2></div><a href="/loja">Abrir vitrine <Eye size={15} /></a></div><div className="ecommerce-admin-kanban">{STATUS.filter(([status]) => status !== 'cancelado').map(([status, label]) => <section className="ecommerce-admin-column" key={status}><header><strong>{label}</strong><b>{orders.filter(order => order.status === status).length}</b></header>{orders.filter(order => order.status === status).map(order => <article className="ecommerce-admin-order-card" key={order.id}><div className="ecommerce-admin-order-card-head"><strong>{order.codigo}</strong><span>{fmtDate(order.criadoEm)}</span></div><p>{order.cliente?.nome || 'Cliente balcão'}</p><div className="ecommerce-admin-order-items">{(order.itens || []).slice(0, 3).map(item => <span key={`${order.id}-${item.produtoId || item.variantId}`}>{item.qtd || item.quantidade}× {item.nome || item.nome_snapshot}</span>)}</div><footer><b>{money(order.total)}</b>{status === 'pendente' && mode === 'legacy' && <button type="button" onClick={() => updateOrder(order, 'preparando')}>Preparar</button>}{status === 'pendente' && mode === 'core' && <span className="commerce-order-note">Aguardando pagamento</span>}{status === 'preparando' && mode === 'legacy' && <button type="button" onClick={() => updateOrder(order, 'pronto')}>Liberar</button>}{status === 'preparando' && mode === 'core' && order.coreStatus === 'paid' && <button type="button" onClick={() => updateOrder(order, 'preparando')}>Preparar</button>}{status === 'preparando' && mode === 'core' && order.coreStatus === 'processing' && <button type="button" onClick={() => updateOrder(order, 'pronto')}>Liberar</button>}{status === 'pronto' && mode === 'legacy' && <button type="button" onClick={() => updateOrder(order, 'entregue')}>Concluir</button>}{status === 'pronto' && mode === 'core' && <span className="commerce-order-note">Fulfillment pendente</span>}</footer></article>)}</section>)}</div></section>}
      {tab === 'clientes' && <section className="ecommerce-admin-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Relacionamento</span><h2>Clientes do tenant</h2></div><button type="button" className="ecommerce-admin-button primary" onClick={beginCustomerCreate}><Plus size={15} /> Novo cliente</button></div><div className="ecommerce-admin-table-wrap"><table className="ecommerce-admin-table"><thead><tr><th>Cliente</th><th>Contato</th><th>Status</th><th>Ações</th></tr></thead><tbody>{customers.map(customer => <tr key={customer.id}><td><strong>{customer.nome}</strong><small>{customer.email || 'Sem email'}</small></td><td>{customer.telefone || '—'}</td><td><span className={`commerce-source-badge ${customer.bloqueado ? 'legacy' : 'core'}`}>{customer.bloqueado ? 'Bloqueado' : 'Ativo'}</span></td><td><div className="ecommerce-row-actions"><button type="button" onClick={() => beginCustomerEdit(customer)}>Editar</button><button type="button" onClick={() => openCustomerAddresses(customer)}>Endereços</button></div></td></tr>)}</tbody></table>{!customers.length && <p className="ecommerce-admin-empty">Nenhum cliente cadastrado no Core.</p>}</div></section>}
      {tab === 'fulfillment' && <section className="ecommerce-admin-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Expedição</span><h2>Entrega e fulfillment</h2></div><button type="button" className="ecommerce-admin-button primary" onClick={() => setShippingModalOpen(true)}><Plus size={15} /> Novo método</button></div><div className="commerce-fulfillment-layout"><section className="commerce-subpanel"><h3>Métodos de entrega</h3>{shippingMethods.map(method => <div className="commerce-fulfillment-line" key={method.id}><div><strong>{method.nome}</strong><span>{method.codigo} · {method.tipo}</span></div><span className="commerce-source-badge core">Ativo</span></div>)}{!shippingMethods.length && <p className="ecommerce-admin-empty">Nenhum método configurado.</p>}</section><section className="commerce-subpanel"><h3>Criar fulfillment</h3><form className="commerce-inline-form" onSubmit={createOrderFulfillment}><label>Pedido<select name="orderId" required defaultValue=""><option value="" disabled>Selecione um pedido</option>{orders.filter(order => !['entregue', 'cancelado'].includes(order.status)).map(order => <option value={order.id} key={order.id}>{order.codigo} · {money(order.total)}</option>)}</select></label><label>Método<select name="shippingMethodId" defaultValue=""><option value="">Sem método definido</option>{shippingMethods.map(method => <option value={method.id} key={method.id}>{method.nome}</option>)}</select></label><button type="submit" className="ecommerce-admin-button primary" disabled={!orders.length}><Truck size={15} /> Criar pendente</button></form></section></div><div className="commerce-subpanel commerce-fulfillment-list"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Acompanhamento</span><h3>Fulfillments</h3></div><span>{fulfillments.length} registro(s)</span></div>{fulfillments.map(item => <article className="commerce-fulfillment-card" key={item.id}><div><strong>{item.public_code || item.order_id}</strong><span>{item.storefront_name || 'Storefront'} · {FULFILLMENT_LABELS[item.status] || item.status}</span></div><div className="commerce-fulfillment-actions">{(FULFILLMENT_TRANSITIONS[item.status] || []).slice(0, 3).map(next => <button type="button" key={next} onClick={() => changeFulfillment(item, next)}>{FULFILLMENT_LABELS[next] || next}</button>)}</div></article>)}{!fulfillments.length && <p className="ecommerce-admin-empty">Nenhum fulfillment criado.</p>}</div></section>}
      {tab === 'dominios' && <section className="ecommerce-admin-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Publicação</span><h2>Canais e domínios</h2><p className="commerce-admin-help">Um domínio só expõe o catálogo depois da verificação TXT.</p></div><button type="button" className="ecommerce-admin-button primary" onClick={() => setDomainModalOpen(true)}><Plus size={15} /> Adicionar domínio</button></div><div className="commerce-domain-list">{domains.map(domain => <article className="commerce-domain-card" key={domain.id}><div><strong>{domain.dominio}</strong><span>{domain.storefront_name || 'Storefront'} · {domain.principal ? 'Principal · ' : ''}{domain.status === 'verified' ? 'Verificado' : 'Pendente'}</span>{domain.status !== 'verified' && domain.verification_name && <code>{domain.verification_name} TXT {domain.verification_value}</code>}</div><div className="commerce-domain-actions">{domain.status !== 'verified' && <button type="button" onClick={() => verifyDomain(domain)}>Verificar TXT</button>}{domain.status === 'verified' && !domain.principal && <button type="button" onClick={() => setPrimaryDomain(domain)}>Definir principal</button>}</div></article>)}{!domains.length && <p className="ecommerce-admin-empty">Nenhum domínio cadastrado. O storefront público permanece fechado por domínio.</p>}</div></section>}
      {tab === 'promocoes' && <section className="ecommerce-admin-panel commerce-promotions-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Campanhas</span><h2>Promoções e cupons</h2></div><span className="commerce-source-badge core">Server-side</span></div><div className="commerce-promotion-layout"><form className="commerce-promotion-form" onSubmit={savePromotion}><label>Nome da promoção<input required value={promotionForm.nome} onChange={event => changePromotion('nome', event.target.value)} /></label><label>Tipo<select value={promotionForm.tipo} onChange={event => changePromotion('tipo', event.target.value)}><option value="percentage">Percentual</option><option value="fixed">Valor fixo</option></select></label><label>Valor<input required type="number" min="0.01" step="0.01" value={promotionForm.valor} onChange={event => changePromotion('valor', event.target.value)} /></label><label>Código do cupom<input placeholder="Ex.: BEMVINDO10" value={promotionForm.codigo} onChange={event => changePromotion('codigo', event.target.value)} /></label><label>Limite da campanha<input type="number" min="1" step="1" value={promotionForm.limiteUso} onChange={event => changePromotion('limiteUso', event.target.value)} /></label><label>Limite do cupom<input type="number" min="1" step="1" value={promotionForm.usoMaximo} onChange={event => changePromotion('usoMaximo', event.target.value)} /></label><button type="submit" className="ecommerce-admin-button primary"><Plus size={15} /> Criar promoção</button></form><div className="commerce-promotion-list">{promotions.map(promotion => <article key={promotion.id}><div><strong>{promotion.nome}</strong><span>{promotion.tipo === 'percentage' ? `${promotion.valor}%` : money(promotion.valor)} · {promotion.usos || 0}{promotion.limite_uso ? `/${promotion.limite_uso}` : ''} usos</span></div><div>{(promotion.codigos || []).map(code => <b key={code.id}>{code.codigo}</b>)}</div></article>)}{!promotions.length && <p className="ecommerce-admin-empty">Nenhuma promoção cadastrada.</p>}</div></div></section>}
      {tab === 'relatorios' && <section className="ecommerce-admin-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Analytics</span><h2>Relatórios do tenant</h2></div><button type="button" onClick={loadReports}><RefreshCw size={15} /> Atualizar dados</button></div>{!reports ? <p className="ecommerce-admin-empty">Carregando relatórios…</p> : <div className="commerce-report-grid"><article><span>Pedidos no período</span><strong>{reports.sales?.summary?.orders ?? reports.sales?.orders ?? 0}</strong><small>Dados reais do Commerce Core</small></article><article><span>Receita bruta</span><strong>{money(reports.sales?.summary?.gross_total ?? reports.sales?.summary?.revenue ?? reports.sales?.revenue)}</strong><small>Sem estimativas</small></article><article><span>SKUs monitorados</span><strong>{reports.inventory?.summary?.variants ?? (Array.isArray(reports.inventory?.items) ? reports.inventory.items.length : 0)}</strong><small>Saldo agregado por local</small></article><article><span>Novos clientes</span><strong>{reports.customers?.summary?.new_customers ?? reports.customers?.summary?.customers ?? reports.customers?.customers ?? 0}</strong><small>Escopo do tenant</small></article></div>}</section>}
      {tab === 'usuarios' && <section className="ecommerce-admin-panel"><div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Governança</span><h2>Usuários e permissões</h2></div><span className="commerce-source-badge core">Membership PostgreSQL</span></div>{!memberships.length ? <p className="ecommerce-admin-empty">Nenhuma membership visível ou a permissão users.write ainda não foi concedida.</p> : <div className="ecommerce-admin-table-wrap"><table className="ecommerce-admin-table"><thead><tr><th>Usuário</th><th>Papel</th><th>Loja</th><th>MFA</th><th>Status</th><th>Ação</th></tr></thead><tbody>{memberships.map(membership => <tr key={membership.id}><td><strong>{membership.nome_completo || membership.email}</strong><small>{membership.email}</small></td><td>{membership.role_nome || membership.role_codigo}</td><td>{membership.loja_nome || 'Todas as lojas'}</td><td>{membership.mfa_obrigatorio ? 'Obrigatório' : 'Opcional'}</td><td>{membership.ativo ? 'Ativa' : 'Desativada'}</td><td><button type="button" className="ecommerce-status-toggle" onClick={() => toggleMembership(membership)}>{membership.ativo ? 'Desativar' : 'Ativar'}</button></td></tr>)}</tbody></table></div>}<p className="ecommerce-admin-empty">Papéis disponíveis: {roles.map(role => role.nome).join(', ') || 'sem dados'}</p></section>}
    </>}
    {modalOpen && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Cadastro de produto"><form className="ecommerce-admin-modal" onSubmit={saveProduct}><button type="button" className="ecommerce-admin-close" onClick={() => setModalOpen(false)} aria-label="Fechar"><X size={17} /></button><span className="ecommerce-admin-kicker">{editingId ? 'Editar item' : 'Novo item'}</span><h2>{editingId ? 'Atualizar produto' : 'Cadastrar produto'}</h2><div className="ecommerce-admin-form-grid"><label className="wide">Nome do item<input required value={form.nome} onChange={event => change('nome', event.target.value)} /></label><label>SKU / código<input value={form.cod} onChange={event => change('cod', event.target.value)} /></label>{mode === 'core' ? <label>Categoria<select value={form.categoryId} onChange={event => change('categoryId', event.target.value)}><option value="">Sem categoria</option>{categories.map(category => <option value={category.id} key={category.id}>{category.nome}</option>)}</select></label> : <label>Categoria<input value={form.cat} onChange={event => change('cat', event.target.value)} /></label>}<label>Preço de venda<input required type="number" min="0" step="0.01" value={form.preco} onChange={event => change('preco', event.target.value)} /></label><label>Preço promocional<input type="number" min="0" step="0.01" value={form.precoPromocional} onChange={event => change('precoPromocional', event.target.value)} /></label><label>Estoque inicial<input required type="number" min="0" step="1" value={form.estoque} onChange={event => change('estoque', event.target.value)} /></label><label>URL da imagem<input type="url" placeholder="https://…" value={form.imagem} onChange={event => change('imagem', event.target.value)} /></label><label className="wide">Descrição<textarea rows="4" value={form.descricao} onChange={event => change('descricao', event.target.value)} /></label></div><div className="ecommerce-admin-modal-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary"><Check size={15} /> Salvar item</button></div></form></div>}
    {customerModalOpen && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Cadastro de cliente"><form className="ecommerce-admin-modal" onSubmit={saveCustomer}><button type="button" className="ecommerce-admin-close" onClick={() => setCustomerModalOpen(false)} aria-label="Fechar"><X size={17} /></button><span className="ecommerce-admin-kicker">{editingCustomerId ? 'Editar cliente' : 'Novo cliente'}</span><h2>{editingCustomerId ? 'Atualizar cliente' : 'Cadastrar cliente'}</h2><div className="ecommerce-admin-form-grid"><label className="wide">Nome<input required value={customerForm.nome} onChange={event => changeCustomer('nome', event.target.value)} /></label><label>Email<input type="email" value={customerForm.email} onChange={event => changeCustomer('email', event.target.value)} /></label><label>Telefone<input value={customerForm.telefone} onChange={event => changeCustomer('telefone', event.target.value)} /></label><label>Documento mascarado<input placeholder="Somente valor já mascarado" value={customerForm.documentoMascarado} onChange={event => changeCustomer('documentoMascarado', event.target.value)} /></label><label className="commerce-checkbox"><input type="checkbox" checked={customerForm.bloqueado} onChange={event => changeCustomer('bloqueado', event.target.checked)} /> Bloquear cliente</label></div><div className="ecommerce-admin-modal-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={() => setCustomerModalOpen(false)}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary"><Check size={15} /> Salvar cliente</button></div></form></div>}
    {addressModalOpen && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Endereços do cliente"><section className="ecommerce-admin-modal"><button type="button" className="ecommerce-admin-close" onClick={() => setAddressModalOpen(false)} aria-label="Fechar"><X size={17} /></button><span className="ecommerce-admin-kicker">Cliente</span><h2>Endereços de {selectedCustomer?.nome}</h2><div className="commerce-address-list">{customerAddresses.map(address => <article key={address.id}><div><strong>{address.rotulo}</strong><span>{[address.logradouro, address.numero, address.bairro, address.cidade, address.estado].filter(Boolean).join(', ') || 'Endereço incompleto'}{address.cep ? ` · CEP ${address.cep}` : ''}</span></div><button type="button" onClick={() => removeAddress(address)}><Trash2 size={15} /> Remover</button></article>)}{!customerAddresses.length && <p className="ecommerce-admin-empty">Nenhum endereço cadastrado.</p>}</div><form className="ecommerce-admin-form-grid commerce-address-form" onSubmit={saveAddress}><label>Rótulo<input value={addressForm.rotulo} onChange={event => changeAddress('rotulo', event.target.value)} /></label><label>Destinatário<input required value={addressForm.destinatario} onChange={event => changeAddress('destinatario', event.target.value)} /></label><label>CEP<input value={addressForm.cep} onChange={event => changeAddress('cep', event.target.value)} /></label><label>Logradouro<input value={addressForm.logradouro} onChange={event => changeAddress('logradouro', event.target.value)} /></label><label>Número<input value={addressForm.numero} onChange={event => changeAddress('numero', event.target.value)} /></label><label>Bairro<input value={addressForm.bairro} onChange={event => changeAddress('bairro', event.target.value)} /></label><label>Cidade<input value={addressForm.cidade} onChange={event => changeAddress('cidade', event.target.value)} /></label><label>UF<input maxLength="2" value={addressForm.estado} onChange={event => changeAddress('estado', event.target.value)} /></label><label className="wide">Complemento<input value={addressForm.complemento} onChange={event => changeAddress('complemento', event.target.value)} /></label><label className="commerce-checkbox"><input type="checkbox" checked={addressForm.padrao} onChange={event => changeAddress('padrao', event.target.checked)} /> Endereço padrão</label><div className="ecommerce-admin-modal-actions wide"><button type="submit" className="ecommerce-admin-button primary"><Plus size={15} /> Adicionar endereço</button></div></form></section></div>}
    {shippingModalOpen && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Novo método de entrega"><form className="ecommerce-admin-modal" onSubmit={saveShippingMethod}><button type="button" className="ecommerce-admin-close" onClick={() => setShippingModalOpen(false)} aria-label="Fechar"><X size={17} /></button><span className="ecommerce-admin-kicker">Fulfillment</span><h2>Novo método de entrega</h2><div className="ecommerce-admin-form-grid"><label>Código<input required value={shippingForm.codigo} onChange={event => changeShipping('codigo', event.target.value)} placeholder="retirada-loja" /></label><label>Nome<input required value={shippingForm.nome} onChange={event => changeShipping('nome', event.target.value)} placeholder="Retirada na loja" /></label><label>Tipo<select value={shippingForm.tipo} onChange={event => changeShipping('tipo', event.target.value)}><option value="pickup">Retirada</option><option value="delivery">Delivery</option><option value="carrier">Transportadora</option><option value="digital">Digital</option><option value="service">Serviço</option></select></label><label className="wide">Configuração JSON<input value={shippingForm.configuracao} onChange={event => changeShipping('configuracao', event.target.value)} /></label></div><div className="ecommerce-admin-modal-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={() => setShippingModalOpen(false)}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary"><Check size={15} /> Criar método</button></div></form></div>}
    {domainModalOpen && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Novo domínio"><form className="ecommerce-admin-modal" onSubmit={saveDomain}><button type="button" className="ecommerce-admin-close" onClick={() => setDomainModalOpen(false)} aria-label="Fechar"><X size={17} /></button><span className="ecommerce-admin-kicker">Canal web</span><h2>Adicionar domínio</h2><p className="commerce-admin-help">Após salvar, crie o registro TXT indicado antes de solicitar a verificação.</p><div className="ecommerce-admin-form-grid"><label className="wide">Domínio<input required value={domainForm.dominio} onChange={event => changeDomain('dominio', event.target.value)} placeholder="loja.exemplo.com.br" /></label><label className="commerce-checkbox"><input type="checkbox" checked={domainForm.principal} onChange={event => changeDomain('principal', event.target.checked)} /> Definir como principal</label></div><div className="ecommerce-admin-modal-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={() => setDomainModalOpen(false)}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary"><Check size={15} /> Cadastrar domínio</button></div></form></div>}
  </main>
}

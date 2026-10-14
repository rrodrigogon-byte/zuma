import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Archive, Boxes, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Copy, FileImage, FileSpreadsheet, Layers3, LayoutGrid, List, Package, PackageCheck, PackagePlus, Plus, RotateCcw, Search, Sparkles, Tag, Trash2 } from 'lucide-react'
import { fmtR } from '../../lib/api'
import { CATALOG_ATTENTION, catalogAttention, catalogSummary, filterProducts, pagination, productQuality, productStatus } from '../../lib/product-management'
import CommerceCatalogEnrichment from './CommerceCatalogEnrichment'
import CommerceCatalogImport from './CommerceCatalogImport'
import CommerceCatalogDiagnostic from './CommerceCatalogDiagnostic'
import CommerceProductMedia from './CommerceProductMedia'
import useCatalogActionTooltip from './useCatalogActionTooltip'

const WORKSPACES = [
  { id: 'products', label: 'Produtos', icon: Package },
  { id: 'import', label: 'Inserção em lote', icon: FileSpreadsheet, coreOnly: true },
  { id: 'enrichment', label: 'Conteúdo e imagens', icon: FileImage, coreOnly: true },
  { id: 'categories', label: 'Categorias', icon: Tag, coreOnly: true },
]

function money(value) {
  return fmtR(Number(value || 0))
}

function statusLabel(product) {
  const status = productStatus(product)
  if (status === 'published') return 'Publicado'
  if (status === 'archived') return 'Arquivado'
  if (status === 'unpublished') return 'Ativo · fora da vitrine'
  return 'Rascunho'
}

function stockLabel(value, allowBackorder = false) {
  const stock = Number(value || 0)
  if (stock <= 0 && allowBackorder) return { label: 'Sob encomenda · +10 dias', tone: 'warning' }
  if (stock <= 0) return { label: 'Sem estoque', tone: 'danger' }
  if (stock <= 5) return { label: `${stock} un. · baixo`, tone: 'warning' }
  return { label: `${stock} un.`, tone: 'success' }
}

function ProductIdentity({ product, storefrontId }) {
  return <div className="commerce-product-identity">
    <div className="commerce-product-thumbnail">
      <CommerceProductMedia media={product.media?.[0] || { public_url: product.imagem }} storefrontId={storefrontId} alt={product.nome || 'Produto'} compact />
    </div>
    <div>
      <strong>{product.nome || 'Produto sem nome'}</strong>
      <span>{product.cod || 'Sem SKU'} · {product.cat || 'Sem categoria'}</span>
    </div>
  </div>
}

function QualityBadge({ product }) {
  const quality = productQuality(product)
  return <div className={`commerce-product-quality ${quality.score === 100 ? 'complete' : ''}`} title={quality.missing.length ? `Falta: ${quality.missing.join(', ')}` : 'Cadastro completo'}>
    <span role="progressbar" aria-label="Qualidade do cadastro" aria-valuemin="0" aria-valuemax="100" aria-valuenow={quality.score} aria-valuetext={quality.missing.length ? `${quality.score}% completo. Falta: ${quality.missing.join(', ')}` : '100% completo'}><i aria-hidden="true" style={{ width: `${quality.score}%` }} /></span>
    <small>{quality.score}% completo</small>
  </div>
}

function ProductActions({ product, mode, onEdit, onDuplicate, onManageVariants, onToggle, onArchive }) {
  const state = productStatus(product)
  const published = state === 'published'
  const archived = state === 'archived'
  return <div className="commerce-product-actions">
    {!archived && <button type="button" onClick={() => onEdit(product)} aria-label={`Editar ${product.nome}`}><Package size={14} /> Editar</button>}
    <button type="button" onClick={() => onDuplicate(product)} aria-label={`Duplicar ${product.nome} como rascunho`}><Copy size={14} /> Duplicar</button>
    {mode === 'core' && !archived && <button type="button" onClick={() => onManageVariants(product)} aria-label={`Gerenciar variantes de ${product.nome}`}><Layers3 size={14} /> Variantes</button>}
    {!archived && <button type="button" onClick={() => onToggle(product)} aria-label={`${published ? 'Retirar' : 'Publicar'} ${product.nome}`}><CheckCircle2 size={14} /> {published ? 'Retirar' : 'Publicar'}</button>}
    {!archived && <button type="button" className="danger" onClick={() => onArchive(product)} aria-label={`${mode === 'core' ? 'Arquivar' : 'Excluir'} ${product.nome}`}>{mode === 'core' ? <Archive size={14} /> : <Trash2 size={14} />} {mode === 'core' ? 'Arquivar' : 'Excluir'}</button>}
  </div>
}

export default function CommerceProductManagement({
  mode,
  products = [],
  categories = [],
  storefrontId,
  empresaId,
  unitId,
  canReadReports = true,
  locationId,
  inventoryLocations = [],
  onLocationChange,
  storeName = '',
  categoryForm,
  editingCategoryId,
  onCategoryChange,
  onCategorySubmit,
  onCategoryEdit,
  onCategoryCancel,
  onCreateProduct,
  onEditProduct,
  onDuplicateProduct,
  onManageVariants,
  onToggleProduct,
  onArchiveProduct,
  onRefresh,
  attention: requestedAttention = 'all',
  onAttentionChange,
}) {
  const attention = catalogAttention(requestedAttention)
  const [workspace, setWorkspace] = useState('products')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [stock, setStock] = useState('all')
  const [quality, setQuality] = useState('all')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('updated_desc')
  const [layout, setLayout] = useState('table')
  const rootRef = useRef(null)
  const tooltip = useCatalogActionTooltip(rootRef)
  const workspaceTabs = useRef([])
  const [page, setPage] = useState(1)
  const [diagnosticOpen, setDiagnosticOpen] = useState(false)

  const summary = useMemo(() => catalogSummary(products), [products])
  const filtered = useMemo(() => filterProducts(products, { query, status, stock, quality, category, sort, attention }), [products, query, status, stock, quality, category, sort, attention])
  const paged = useMemo(() => pagination(filtered, page, 24), [filtered, page])
  const hasFilters = Boolean(attention !== 'all' || query || status !== 'all' || stock !== 'all' || quality !== 'all' || category !== 'all' || sort !== 'updated_desc')

  useEffect(() => { setPage(1) }, [query, status, stock, quality, category, sort])
  useEffect(() => { if (page > paged.totalPages) setPage(paged.totalPages) }, [page, paged.totalPages])

  useEffect(() => {
    setQuery(''); setStatus('all'); setStock('all'); setQuality('all'); setCategory('all'); setPage(1)
  }, [attention])

  useEffect(() => { setDiagnosticOpen(false) }, [mode, empresaId, unitId, storefrontId, canReadReports])

  function clearFilters() {
    onAttentionChange?.('all')
    setQuery('')
    setStatus('all')
    setStock('all')
    setQuality('all')
    setCategory('all')
    setSort('updated_desc')
  }

  const availableWorkspaces = WORKSPACES.filter(item => !item.coreOnly || mode === 'core')

  function moveWorkspace(event, index) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const last = availableWorkspaces.length - 1
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : event.key === 'ArrowRight' ? (index + 1) % availableWorkspaces.length : (index - 1 + availableWorkspaces.length) % availableWorkspaces.length
    setWorkspace(availableWorkspaces[next].id)
    workspaceTabs.current[next]?.focus()
  }

  return <section ref={rootRef} className="ecommerce-admin-panel commerce-product-workspace">
    {tooltip}
    <header className="commerce-product-hero">
      <div>
        <span className="ecommerce-admin-kicker"><Boxes size={14} /> Gestão de produtos</span>
        <h2>Catálogo {storeName ? `· ${storeName}` : 'da loja'}</h2>
        <p>Cadastre, publique e acompanhe qualidade, preço, estoque, variantes e imagens em um único lugar.</p>
      </div>
      <div className="commerce-product-hero-actions">
        {mode === 'core' && <label className="commerce-product-location"><span>Estoque exibido em</span><select value={locationId || ''} onChange={event => onLocationChange?.(event.target.value)} disabled={!inventoryLocations.length}><option value="" disabled>Selecione o local</option>{inventoryLocations.map(location => <option key={location.id} value={location.id}>{location.nome}{location.loja_id ? '' : ' · compartilhado'}</option>)}</select></label>}
        <button type="button" className="ecommerce-admin-button ghost" onClick={onRefresh}><RotateCcw size={15} /> Atualizar</button>
        <button type="button" className="ecommerce-admin-button primary" onClick={onCreateProduct}><Plus size={15} /> Adicionar produto</button>
      </div>
    </header>

    <div className="commerce-product-summary" aria-label="Resumo do catálogo">
      <article><Package size={18} /><div><span>Total</span><strong>{summary.total}</strong><small>produtos cadastrados</small></div></article>
      <article><PackageCheck size={18} /><div><span>Publicados</span><strong>{summary.published}</strong><small>{summary.notPublished} fora da vitrine</small></div></article>
      <article className={summary.lowStock ? 'attention' : ''}><AlertTriangle size={18} /><div><span>Estoque em atenção</span><strong>{summary.lowStock}</strong><small>{summary.outOfStock} sem estoque</small></div></article>
      <article className={summary.incomplete ? 'attention soft' : ''}><Sparkles size={18} /><div><span>Cadastro incompleto</span><strong>{summary.incomplete}</strong><small>{summary.missingMedia} sem imagem</small></div></article>
      <article><Boxes size={18} /><div><span>Unidades</span><strong>{summary.totalUnits}</strong><small>{categories.length} categoria(s)</small></div></article>
    </div>

    <nav className="commerce-product-nav" aria-label="Ferramentas do catálogo" role="tablist">
      {availableWorkspaces.map((item, index) => {
        const Icon = item.icon
        return <button type="button" key={item.id} id={`commerce-product-tab-${item.id}`} role="tab" aria-controls={`commerce-product-panel-${item.id}`} aria-selected={workspace === item.id} tabIndex={workspace === item.id ? 0 : -1} ref={element => { workspaceTabs.current[index] = element }} className={workspace === item.id ? 'active' : ''} onKeyDown={event => moveWorkspace(event, index)} onClick={() => setWorkspace(item.id)}><Icon size={15} /> {item.label}</button>
      })}
    </nav>

    {workspace === 'products' && <section role="tabpanel" id="commerce-product-panel-products" aria-labelledby="commerce-product-tab-products">
      {mode === 'core' && <details className="commerce-catalog-diagnostic-details" open={diagnosticOpen} onToggle={event => setDiagnosticOpen(event.currentTarget.open)}>
        <summary className={!canReadReports || !empresaId || !unitId || !storefrontId ? 'is-disabled' : ''} aria-disabled={!canReadReports || !empresaId || !unitId || !storefrontId} onClick={event => { if (!canReadReports || !empresaId || !unitId || !storefrontId) event.preventDefault() }}>
          <span><ClipboardCheck size={15} /> Diagnóstico do catálogo</span>
          <small>{!canReadReports ? 'Sem permissão reports.read' : !empresaId || !unitId || !storefrontId ? 'Contexto incompleto' : 'Somente leitura · abre sob demanda'}</small>
        </summary>
        <CommerceCatalogDiagnostic mode={mode} empresaId={empresaId} unitId={unitId} storefrontId={storefrontId} canReadReports={canReadReports} open={diagnosticOpen} />
      </details>}
      <div className="commerce-product-toolbar">
        {onAttentionChange && <label><span>Pendência da operação</span><select value={attention} onChange={event => onAttentionChange(event.target.value)}>{Object.entries(CATALOG_ATTENTION).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>}
        <label className="commerce-product-search"><Search size={17} /><span className="sr-only">Buscar produtos</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por produto, SKU, código de barras ou categoria" /></label>
        <label><span>Status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todos</option><option value="published">Publicados</option><option value="unpublished">Ativos fora da vitrine</option><option value="draft">Rascunhos</option><option value="archived">Arquivados</option></select></label>
        <label><span>Estoque</span><select value={stock} onChange={event => setStock(event.target.value)}><option value="all">Todos</option><option value="available">Disponível</option><option value="low">Baixo</option><option value="out">Sem estoque</option></select></label>
        <label><span>Categoria</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="all">Todas</option>{categories.map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label>
        <label><span>Qualidade</span><select value={quality} onChange={event => setQuality(event.target.value)}><option value="all">Todos</option><option value="incomplete">Cadastro incompleto</option><option value="missing_media">Sem imagem</option></select></label>
        <label><span>Ordenar</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="updated_desc">Atualizados recentemente</option><option value="name_asc">Nome A–Z</option><option value="stock_asc">Menor estoque</option><option value="price_asc">Menor preço</option><option value="quality_asc">Menor completude</option></select></label>
        <div className="commerce-product-layout-toggle" aria-label="Modo de visualização">
          <button type="button" className={layout === 'table' ? 'active' : ''} onClick={() => setLayout('table')} aria-label="Exibir em tabela" aria-pressed={layout === 'table'}><List size={16} /></button>
          <button type="button" className={layout === 'grid' ? 'active' : ''} onClick={() => setLayout('grid')} aria-label="Exibir em cartões" aria-pressed={layout === 'grid'}><LayoutGrid size={16} /></button>
        </div>
      </div>

      <div className="commerce-product-result-bar">
        <span><strong>{filtered.length}</strong> de {products.length} produto(s){attention !== 'all' && <span role="status"> · {CATALOG_ATTENTION[attention]}</span>}</span>
        {hasFilters && <button type="button" onClick={clearFilters}><RotateCcw size={13} /> Limpar filtros</button>}
      </div>

      {layout === 'table' ? <div className="ecommerce-admin-table-wrap commerce-product-table-wrap"><table className="ecommerce-admin-table commerce-product-table"><thead><tr><th>Produto</th><th>Preço</th><th>Estoque</th><th>Variantes</th><th>Qualidade</th><th>Status</th><th>Ações</th></tr></thead><tbody>{paged.items.map(product => {
        const stockState = stockLabel(product.estoque, product.permiteCompraSemEstoque === true)
        const variants = product.variantes || product.variants || []
        return <tr key={product.id}>
          <td><ProductIdentity product={product} storefrontId={storefrontId} /></td>
          <td>{product.precoPromocional && Number(product.precoPromocional) < Number(product.preco) ? <div className="ecommerce-admin-price"><s>{money(product.preco)}</s><b>{money(product.precoPromocional)}</b></div> : <strong>{Number(product.preco || 0) > 0 ? money(product.preco) : 'Sem preço'}</strong>}</td>
          <td><span className={`commerce-stock-pill ${stockState.tone}`}>{stockState.label}</span></td>
          <td><strong>{variants.length}</strong><small className="commerce-product-cell-help">{variants.length === 1 ? 'variante' : 'variantes'}</small></td>
          <td><QualityBadge product={product} /></td>
          <td>{productStatus(product) === 'archived' ? <span className="commerce-product-status archived">{statusLabel(product)}</span> : <button type="button" className={`commerce-product-status ${productStatus(product)}`} data-catalog-help={productStatus(product) === 'published' ? 'Retira o produto da vitrine, preservando seu cadastro.' : 'Publica este produto na vitrine selecionada.'} onClick={() => onToggleProduct(product)}>{statusLabel(product)}</button>}</td>
          <td><ProductActions product={product} mode={mode} onEdit={onEditProduct} onDuplicate={onDuplicateProduct} onManageVariants={onManageVariants} onToggle={onToggleProduct} onArchive={onArchiveProduct} /></td>
        </tr>
      })}</tbody></table></div> : <div className="commerce-admin-product-grid">{paged.items.map(product => {
        const stockState = stockLabel(product.estoque, product.permiteCompraSemEstoque === true)
        const variants = product.variantes || product.variants || []
        return <article className="commerce-admin-product-card" key={product.id}>
          <div className="commerce-admin-product-card-image"><CommerceProductMedia media={product.media?.[0] || { public_url: product.imagem }} storefrontId={storefrontId} alt={product.nome || 'Produto'} compact /></div>
          <div className="commerce-admin-product-card-body"><div className="commerce-admin-product-card-heading"><div><span>{product.cat || 'Sem categoria'}</span><h3>{product.nome || 'Produto sem nome'}</h3><small>{product.cod || 'Sem SKU'}</small></div>{productStatus(product) === 'archived' ? <span className="commerce-product-status archived">{statusLabel(product)}</span> : <button type="button" className={`commerce-product-status ${productStatus(product)}`} data-catalog-help={productStatus(product) === 'published' ? 'Retira o produto da vitrine, preservando seu cadastro.' : 'Publica este produto na vitrine selecionada.'} onClick={() => onToggleProduct(product)}>{statusLabel(product)}</button>}</div>
          <div className="commerce-admin-product-card-metrics"><span><b>{Number(product.preco || 0) > 0 ? money(product.precoPromocional || product.preco) : 'Sem preço'}</b> preço</span><span><b className={stockState.tone}>{stockState.label}</b> estoque</span><span><b>{variants.length}</b> variantes</span></div><QualityBadge product={product} /><ProductActions product={product} mode={mode} onEdit={onEditProduct} onDuplicate={onDuplicateProduct} onManageVariants={onManageVariants} onToggle={onToggleProduct} onArchive={onArchiveProduct} /></div>
        </article>
      })}</div>}

      {!paged.items.length && <div className="ecommerce-admin-empty commerce-product-empty"><PackagePlus size={28} /><strong>{products.length ? 'Nenhum produto corresponde aos filtros' : 'Seu catálogo ainda está vazio'}</strong><span>{products.length ? 'Limpe ou ajuste os filtros para voltar a visualizar os itens.' : 'Cadastre um produto manualmente ou use a inserção em lote com preview.'}</span>{products.length ? <button type="button" className="ecommerce-admin-button ghost" onClick={clearFilters}>Limpar filtros</button> : <button type="button" className="ecommerce-admin-button primary" onClick={onCreateProduct}>Adicionar primeiro produto</button>}</div>}

      {paged.totalPages > 1 && <nav className="commerce-product-pagination" aria-label="Paginação de produtos"><button type="button" disabled={paged.page <= 1} onClick={() => setPage(current => current - 1)}><ChevronLeft size={15} /> Anterior</button><span>Itens {paged.start + 1}–{paged.end} de {filtered.length} · página {paged.page} de {paged.totalPages}</span><button type="button" disabled={paged.page >= paged.totalPages} onClick={() => setPage(current => current + 1)}>Próxima <ChevronRight size={15} /></button></nav>}
    </section>}

    {workspace === 'import' && <div role="tabpanel" id="commerce-product-panel-import" aria-labelledby="commerce-product-tab-import" className="commerce-product-tool-panel"><div className="commerce-product-tool-intro"><FileSpreadsheet size={22} /><div><h3>Adicionar ou atualizar vários produtos</h3><p>O arquivo é validado antes de qualquer gravação. Preço, estoque e publicação só mudam depois do preview e da confirmação.</p></div></div><CommerceCatalogImport mode={mode} empresaId={empresaId} unitId={unitId} storefrontId={storefrontId} locationId={locationId} onImported={onRefresh} /></div>}

    {workspace === 'enrichment' && <div role="tabpanel" id="commerce-product-panel-enrichment" aria-labelledby="commerce-product-tab-enrichment" className="commerce-product-tool-panel"><div className="commerce-product-tool-intro"><FileImage size={22} /><div><h3>Completar conteúdo e imagens</h3><p>Use um manifesto aprovado para enriquecer descrições e mídias sem alterar preço, estoque, categoria ou publicação.</p></div></div><CommerceCatalogEnrichment mode={mode} products={products} onImported={onRefresh} /></div>}

    {workspace === 'categories' && <div role="tabpanel" id="commerce-product-panel-categories" aria-labelledby="commerce-product-tab-categories" className="commerce-product-categories"><div className="commerce-product-tool-intro"><Tag size={22} /><div><h3>Estrutura de categorias</h3><p>Organize a navegação da vitrine sem mover ou publicar produtos automaticamente.</p></div></div><form className="commerce-category-form" onSubmit={onCategorySubmit}><label>{editingCategoryId ? 'Nome da categoria' : 'Nova categoria'}<input required value={categoryForm.nome} onChange={event => onCategoryChange('nome', event.target.value)} placeholder="Ex.: Perfumes" /></label><label>Categoria pai<select value={categoryForm.parentId} onChange={event => onCategoryChange('parentId', event.target.value)}><option value="">Sem categoria pai</option>{categories.filter(item => item.id !== editingCategoryId).map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><label>Ordem<input type="number" min="0" step="1" value={categoryForm.ordem} onChange={event => onCategoryChange('ordem', event.target.value)} /></label><label className="wide">Descrição<input value={categoryForm.descricao} onChange={event => onCategoryChange('descricao', event.target.value)} placeholder="Descrição opcional da categoria" /></label><div className="commerce-category-actions">{editingCategoryId && <button type="button" className="ecommerce-admin-button ghost" onClick={onCategoryCancel}>Cancelar</button>}<button type="submit" className="ecommerce-admin-button primary">{editingCategoryId ? <CheckCircle2 size={15} /> : <Plus size={15} />} {editingCategoryId ? 'Salvar categoria' : 'Criar categoria'}</button></div></form><div className="commerce-category-list"><div className="commerce-category-list-heading"><strong>Categorias cadastradas</strong><span>{categories.length} categoria(s)</span></div>{categories.map(item => <article key={item.id}><div><strong>{item.nome}</strong><small>{item.descricao || 'Sem descrição'} · ordem {item.ordem || 0}</small></div><button type="button" onClick={() => onCategoryEdit(item)}><Package size={14} /> Editar</button></article>)}{!categories.length && <div className="ecommerce-admin-empty"><Tag size={24} /><strong>Nenhuma categoria cadastrada</strong><span>Crie categorias para melhorar filtros e navegação da vitrine.</span></div>}</div></div>}
  </section>
}

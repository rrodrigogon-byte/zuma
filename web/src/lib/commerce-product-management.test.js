import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { productChannelPublished } from './product-management.js'

const workspace = readFileSync(new URL('../pages/admin/CommerceProductManagement.jsx', import.meta.url), 'utf8')
const admin = readFileSync(new URL('../pages/admin/EcommerceAdmin.jsx', import.meta.url), 'utf8')
const adapter = readFileSync(new URL('../pages/admin/commerce-admin-adapter.js', import.meta.url), 'utf8')
const routes = readFileSync(new URL('../../../app/core/commerce-routes.js', import.meta.url), 'utf8')
const core = readFileSync(new URL('../../../app/core/commerce-core.js', import.meta.url), 'utf8')
const layout = readFileSync(new URL('../components/Layout.jsx', import.meta.url), 'utf8')

test('produto Core é exibido como publicado somente quando o canal confirma publicação', () => {
  assert.equal(productChannelPublished({ status: 'active', publicado: false }), false)
  assert.equal(productChannelPublished({ status: 'active', publicado: true }), true)
  assert.equal(productChannelPublished({ status: 'active' }), false)
  assert.equal(productChannelPublished({ status: 'draft', publicado: true }), false)
})

test('consulta administrativa deriva publicação dos canais da loja sem migration', () => {
  assert.match(routes, /BOOL_OR\(pc\.publicado AND p\.status = 'active'\)/)
  assert.match(routes, /channel_storefront\.loja_id/)
  assert.match(routes, /AS publicado/)
})

test('workspace mantém cadastro manual, importação e enriquecimento existentes em uma única gestão', () => {
  assert.match(workspace, /Adicionar produto/)
  assert.match(workspace, /CommerceCatalogImport/)
  assert.match(workspace, /CommerceCatalogEnrichment/)
  assert.match(workspace, /Inserção em lote/)
  assert.match(workspace, /Conteúdo e imagens/)
  assert.match(workspace, /Categorias/)
})

test('workspace oferece filtros operacionais, paginação, tabela e cartões', () => {
  for (const marker of ['Buscar por produto, SKU, código de barras ou categoria', 'Cadastro incompleto', 'Menor estoque', 'pagination(filtered, page, 24)', "layout === 'table'", 'commerce-admin-product-grid']) {
    assert.ok(workspace.includes(marker), `marcador ausente: ${marker}`)
  }
})

test('duplicação prepara rascunho sem estoque/imagens e explica a geração de um novo SKU', () => {
  const start = admin.indexOf('function beginDuplicate')
  const end = admin.indexOf('function change(', start)
  const block = admin.slice(start, end)
  assert.match(block, /cod: ''/)
  assert.match(block, /estoque: 0/)
  assert.match(block, /imagem: ''/)
  assert.match(block, /ativo: false/)
  assert.match(block, /setModalOpen\(true\)/)
  assert.match(block, /um novo código será gerado ao salvar/)
})

test('edição separa estado e publicação e usa save único idempotente', () => {
  assert.match(adapter, /status: form\.status/)
  assert.match(adapter, /published: form\.publicado === true/)
  assert.match(adapter, /catalog\/products\/workspace/)
  assert.match(adapter, /X-Idempotency-Key/)
  assert.doesNotMatch(adapter, /admin-stock-\$\{editingId\}-\$\{Date\.now\(\)\}/)
  assert.match(adapter, /publicado: product\.publicado !== true/)
})

test('listagem e formulário usam local explícito e impedem edição direta de arquivados', () => {
  assert.match(routes, /req\.query\.locationId/)
  assert.match(routes, /il\.location_id/)
  assert.match(routes, /s\.loja_id = \$\{lojaParam\} OR s\.loja_id IS NULL/)
  assert.match(workspace, /Estoque exibido em/)
  assert.match(adapter, /Produto arquivado não pode ser editado/)
})

test('save preserva a lista de preços do canal e exige vínculo do produto ao storefront', () => {
  assert.match(core, /JOIN commerce_product_channels pc/)
  assert.match(core, /PRODUCT_STOREFRONT_SCOPE_MISMATCH/)
  assert.match(core, /precoPromocional: promotionalPrice,[\s\S]*priceListId/)
  assert.match(core, /publicado: published, priceListId/)
  assert.match(core, /resolveProductChannelPriceList/)
  assert.match(admin, /const payload = \{ storefrontId, sku: variantForm\.sku/)
})

test('produto arquivado não é alterável e arquivamento exige escrita e publicação', () => {
  assert.match(core, /currentResult\.rows\[0\]\.status === 'archived'/)
  assert.match(core, /PRODUCT_ARCHIVE_REQUIRED/)
  assert.match(core, /SELECT id, nome, status FROM commerce_products/)
  assert.match(core, /SELECT v\.id, p\.status AS product_status/)
  assert.match(core, /SELECT id, status FROM commerce_products WHERE empresa_id/)
  assert.match(core, /SELECT m\.id, m\.product_id, p\.status AS product_status/)
  assert.match(routes, /media\/upload'[\s\S]*SELECT p\.id, p\.status FROM commerce_products p[\s\S]*PRODUCT_ARCHIVED/)
  assert.match(routes, /router\.delete\('\/catalog\/products\/:id'[\s\S]*requirePermission\(req, 'catalog\.write'\)[\s\S]*requirePermission\(req, 'catalog\.publish'\)/)
})

test('cada imagem selecionada mantém chave idempotente própria em retries parciais', () => {
  assert.match(admin, /files\.map\(file => \(\{ file, uploadId: crypto\.randomUUID\(\) \}\)\)/)
  assert.match(admin, /media:\$\{selected\.uploadId\}/)
})

test('workspace conecta tabs aos painéis, suporta setas e expõe o modo visual selecionado', () => {
  assert.match(workspace, /aria-controls={`commerce-product-panel-\$\{item\.id\}`}/)
  assert.match(workspace, /onKeyDown={event => moveWorkspace\(event, index\)}/)
  assert.match(workspace, /role="tabpanel"/)
  assert.match(workspace, /aria-pressed={layout === 'table'}/)
  assert.match(workspace, /aria-pressed={layout === 'grid'}/)
})

test('modais prendem foco, fecham por Escape e restauram o elemento acionador', () => {
  assert.match(admin, /function useAdminDialogFocusTrap\(\)/)
  assert.match(admin, /event\.key === 'Escape'/)
  assert.match(admin, /event\.key !== 'Tab'/)
  assert.match(admin, /previousFocus\.current/)
  assert.match(admin, /\.ecommerce-admin-close/)
})

test('qualidade cadastral expõe progresso e pendências sem depender apenas de cor', () => {
  assert.match(workspace, /role="progressbar"/)
  assert.match(workspace, /aria-valuenow={quality\.score}/)
  assert.match(workspace, /aria-valuetext=/)
  assert.match(workspace, /\{quality\.score\}% completo/)
})

test('layout autenticado permite que o backoffice encolha no viewport mobile', () => {
  assert.match(layout, /flex: 1, minWidth: 0, minHeight: '100vh'/)
})

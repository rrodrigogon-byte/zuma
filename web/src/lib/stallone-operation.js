import { matchesCatalogAttention } from './product-management.js'

// Indicadores do escopo carregado: configuração não significa homologação.
export function stalloneOperation({ products = [], paymentAccounts = [], domains = [], shippingMethods = [], storefront, warnings = [], catalogUnavailable = false } = {}) {
  const scoped = items => items.filter(item => !item.storefront_id || item.storefront_id === storefront?.id)
  const unavailable = part => warnings.some(item => String(item.path || '').includes(part))
  const published = products.filter(item => item.ativo !== false && item.publicado !== false)
  const missingImages = published.filter(item => matchesCatalogAttention(item, 'images')).length
  const missingDescriptions = published.filter(item => matchesCatalogAttention(item, 'descriptions')).length
  const lowStock = published.filter(item => matchesCatalogAttention(item, 'stock')).length
  const policies = storefront?.configuracoes?.public?.policies || storefront?.configuracoes?.publicConfig?.policies || {}
  const policyCount = ['privacyUrl', 'returnsUrl', 'shippingUrl', 'termsUrl'].filter(key => /^https:\/\//i.test(String(policies[key] || ''))).length
  const tasks = []
  const add = (id, title, detail, tab, kind = 'attention') => tasks.push({ id, title, detail, tab, kind })
  if (!storefront) add('store', 'Selecione uma loja ativa', 'Abra Lojas e canais para definir o escopo da operação.', 'stores', 'unknown')
  else {
    if (unavailable('/payments/accounts')) add('payments', 'Pagamento não verificado', 'A consulta está indisponível ou seu perfil não tem acesso.', 'payments', 'unknown')
    else if (!scoped(paymentAccounts).some(item => item.ativo === true && item.ready === true && item.ambiente === 'production')) add('payments', 'Preparar pagamento online', 'Nenhuma conta de produção pronta foi encontrada. Configure e homologue o provedor antes de vender.', 'payments', 'critical')
    if (catalogUnavailable) add('catalog', 'Catálogo não verificado', 'Atualize a consulta antes de conferir conteúdo e estoque.', 'catalog', 'unknown')
    else {
      if (!published.length) add('catalog', 'Publicar o catálogo', 'Nenhum produto publicado no escopo carregado.', 'catalog', 'critical')
      if (missingImages) add('images', `${missingImages} produto(s) sem imagem`, 'Complete fotos autorizadas para facilitar a escolha do cliente.', 'catalog')
      if (missingDescriptions) add('descriptions', `${missingDescriptions} produto(s) sem descrição`, 'Informe unidade de venda, conteúdo e dados oficiais do produto.', 'catalog')
      if (lowStock) add('stock', `${lowStock} produto(s) com até 5 unidades`, 'Confira o saldo e planeje a reposição no local de estoque selecionado.', 'catalog')
    }
    if (!storefront.configuracoes) add('policies', 'Políticas não verificadas', 'As informações públicas desta loja não foram carregadas.', 'stores', 'unknown')
    else if (policyCount < 4) add('policies', `${4 - policyCount} política(s) sem link válido`, 'Complete privacidade, trocas, entrega e termos nas informações públicas.', 'stores')
    if (unavailable('/domains')) add('domain', 'Domínio não verificado', 'A consulta de domínios não está disponível.', 'domains', 'unknown')
    else if (!scoped(domains).some(item => item.status === 'verified')) add('domain', 'Verificar o domínio', 'Confirme a configuração e a verificação do endereço da loja.', 'domains')
    if (unavailable('/shipping/methods')) add('shipping', 'Entrega não verificada', 'A consulta dos métodos de entrega não está disponível.', 'shipping', 'unknown')
    else if (scoped(shippingMethods).some(item => item.ativo !== false && item.tipo === 'delivery' && (item.provider === 'manual' || item.configuracao?.provider === 'manual'))) add('shipping', 'Conferir a entrega manual', 'Valide cobertura, tarifa, prazo e processo de envio. Uma tabela manual não gera etiqueta ou rastreio.', 'shipping')
  }
  return { published: catalogUnavailable ? null : published.length, missingImages: catalogUnavailable ? null : missingImages, missingDescriptions: catalogUnavailable ? null : missingDescriptions, tasks }
}

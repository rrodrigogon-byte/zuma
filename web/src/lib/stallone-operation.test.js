import test from 'node:test'
import assert from 'node:assert/strict'
import { stalloneOperation } from './stallone-operation.js'

const storefront = { id: 'stallone', configuracoes: { public: { policies: { privacyUrl: 'https://loja.test/privacy', returnsUrl: 'https://loja.test/returns', shippingUrl: 'https://loja.test/shipping', termsUrl: 'https://loja.test/terms' } } } }
test('conta de outra loja não elimina a pendência de pagamento', () => {
  const result = stalloneOperation({ storefront, paymentAccounts: [{ storefront_id: 'dino', ativo: true, ready: true, ambiente: 'production' }] })
  assert.equal(result.tasks.find(task => task.id === 'payments').kind, 'critical')
})
test('falha de consulta não é apresentada como configuração ausente ou catálogo vazio', () => {
  const result = stalloneOperation({ storefront, catalogUnavailable: true, warnings: [{path:'/api/admin/commerce/payments/accounts'}, {path:'/api/admin/commerce/storefront/domains'}] })
  assert.equal(result.published, null)
  assert.equal(result.tasks.find(task => task.id === 'catalog').kind, 'unknown')
  assert.equal(result.tasks.find(task => task.id === 'payments').kind, 'unknown')
  assert.equal(result.tasks.find(task => task.id === 'domain').kind, 'unknown')
  assert.equal(result.tasks.some(task => task.id === 'stock'), false)
})
test('qualidade e reposição consideram somente produtos publicados, sem alterar dados', () => {
  const products = [{ ativo: true, estoque: 2 }, { ativo: false, estoque: 0 }, { ativo: true, estoque: 0, permiteCompraSemEstoque: true, media: [{}], descricao:'Conteúdo' }]
  const before = JSON.stringify(products)
  const result = stalloneOperation({ storefront, products })
  assert.equal(result.published, 2)
  assert.equal(result.missingImages, 1)
  assert.equal(result.missingDescriptions, 1)
  assert.match(result.tasks.find(task => task.id === 'stock').title, /^1 produto/)
  assert.equal(JSON.stringify(products), before)
})
test('políticas inseguras ou incompletas não são consideradas publicadas', () => {
  const result = stalloneOperation({ storefront: {id:'stallone', configuracoes:{public:{policies:{privacyUrl:'javascript:alert(1)'}}}} })
  assert.match(result.tasks.find(task => task.id === 'policies').title, /^4 política/)
})
test('nenhum alerta não significa homologação: só verifica a configuração disponível', () => {
  const result = stalloneOperation({ storefront, products:[{ativo:true, estoque:10, imagem:'foto', descricao:'Texto'}], paymentAccounts:[{ativo:true,ready:true,ambiente:'production'}], domains:[{status:'verified'}], shippingMethods:[{tipo:'pickup'}] })
  assert.deepEqual(result.tasks, [])
})

test('conta sandbox pronta não é apresentada como pronta para venda real', () => {
 const result=stalloneOperation({storefront,paymentAccounts:[{ativo:true,ready:true,ambiente:'sandbox'}]});
 assert.equal(result.tasks.find(task=>task.id==='payments').kind,'critical');
});

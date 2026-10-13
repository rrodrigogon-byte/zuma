import test from 'node:test'
import assert from 'node:assert/strict'
import { COMMERCE_TAB_BY_QUERY, commerceTabSearch } from './commerce-tab-navigation.js'

test('navegação pode ser recarregada usando o mesmo mapa de abas do painel', () => {
  for (const tab of new Set(Object.values(COMMERCE_TAB_BY_QUERY))) {
    const result = commerceTabSearch('tab=catalog&attention=images&other=preserved', tab)
    assert.equal(COMMERCE_TAB_BY_QUERY[result.get('tab')], tab)
    assert.equal(result.get('other'), 'preserved')
    assert.equal(result.get('attention'), tab === 'catalogo' ? 'images' : null)
  }
})
test('não modifica o histórico de pesquisa recebido nem inventa aba desconhecida', () => {
  const original = new URLSearchParams('tab=reports')
  assert.equal(commerceTabSearch(original, 'catalogo').get('tab'), 'catalog')
  assert.equal(original.get('tab'), 'reports')
  assert.equal(commerceTabSearch(original, 'desconhecida').toString(), original.toString())
})

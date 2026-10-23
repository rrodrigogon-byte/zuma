import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DINO_COMMERCE_EMPRESA_ID,
  DINO_COMMERCE_LOJA_ID,
  DINO_LEGACY_EMPRESA_ID,
  DINO_LEGACY_LOJA_ID,
  legacyEmpresaIdFromCommerce,
  legacyLojaIdFromCommerce,
} from './legacy-commerce-scope.js';

test('mapeia exatamente o tenant Commerce da Dino para o ERP legado', () => {
  assert.equal(legacyEmpresaIdFromCommerce(DINO_COMMERCE_EMPRESA_ID), DINO_LEGACY_EMPRESA_ID);
  assert.equal(legacyLojaIdFromCommerce(DINO_COMMERCE_LOJA_ID, DINO_COMMERCE_EMPRESA_ID), DINO_LEGACY_LOJA_ID);
});

test('preserva IDs desconhecidos e não cruza loja entre empresas', () => {
  assert.equal(legacyEmpresaIdFromCommerce('empresa-desconhecida'), 'empresa-desconhecida');
  assert.equal(legacyLojaIdFromCommerce('loja-desconhecida', DINO_COMMERCE_EMPRESA_ID), 'loja-desconhecida');
  assert.equal(legacyLojaIdFromCommerce(DINO_COMMERCE_LOJA_ID, 'outra-empresa'), DINO_COMMERCE_LOJA_ID);
});

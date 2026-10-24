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

test('conexão WhatsApp volta ao id canônico do Commerce somente para o vínculo Dino', async () => {
  const { commerceEmpresaIdFromLegacy, commerceLojaIdFromLegacy, DINO_COMMERCE_EMPRESA_ID, DINO_COMMERCE_LOJA_ID } = await import('./legacy-commerce-scope.js');
  assert.equal(commerceEmpresaIdFromLegacy('emp-kytto-001'), DINO_COMMERCE_EMPRESA_ID);
  assert.equal(commerceEmpresaIdFromLegacy(DINO_COMMERCE_EMPRESA_ID), DINO_COMMERCE_EMPRESA_ID);
  assert.equal(commerceEmpresaIdFromLegacy('31f70c83-9172-40c2-945f-9e793b5048be'), '31f70c83-9172-40c2-945f-9e793b5048be');
  assert.equal(commerceEmpresaIdFromLegacy('principal'), 'principal');
  assert.equal(commerceLojaIdFromLegacy('dino-web-estoque', 'emp-kytto-001'), DINO_COMMERCE_LOJA_ID);
  assert.equal(commerceLojaIdFromLegacy('dino-web-estoque', 'outra-empresa'), 'dino-web-estoque');
  assert.equal(commerceLojaIdFromLegacy('6a15e943-2570-4f29-a2d5-d900d2812911', '31f70c83-9172-40c2-945f-9e793b5048be'), '6a15e943-2570-4f29-a2d5-d900d2812911');
});

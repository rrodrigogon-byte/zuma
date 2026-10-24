import test from 'node:test';
import assert from 'node:assert/strict';
import { canonizarRegistroAvec, historicoAvecVigente } from './dino-historico-avec.js';

const UUID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
const LOJA = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';

test('importação completa de 22/10 substitui a parcial e os ids legados viram canônicos', () => {
  const registros = {
    a: { id: 'a', origemImportacao: 'importacao_avec', dataAgenda: '2026-01-10' },
    b: { id: 'b', origem: 'avec-import-20261022', empresaId: 'emp-kytto-001', lojaId: 'dino-web-estoque', dataAgenda: '2026-01-10' },
    c: { id: 'c', origem: 'agenda', empresaId: UUID, lojaId: LOJA, dataAgenda: '2026-10-20' },
  };
  const vigente = historicoAvecVigente(registros);
  assert.deepEqual(vigente.map((item) => item.id), ['b', 'c']);
  assert.equal(vigente[0].empresaId, UUID);
  assert.equal(vigente[0].lojaId, LOJA);
  assert.equal(registros.b.lojaId, 'dino-web-estoque', 'o registro gravado não é alterado');
});

test('sem a importação completa, a parcial continua visível; outras empresas não mudam', () => {
  assert.deepEqual(historicoAvecVigente([{ id: 'a', origemImportacao: 'importacao_avec' }]).map((item) => item.id), ['a']);
  const outro = { id: 'x', empresaId: 'outra', lojaId: 'dino-web-estoque' };
  assert.equal(canonizarRegistroAvec(outro), outro);
});

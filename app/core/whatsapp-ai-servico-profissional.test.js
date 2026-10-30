import test from 'node:test';
import assert from 'node:assert/strict';
import { nomeBaseDoServico, servicosEquivalentes } from './whatsapp-ai-tools.js';

// Catálogo real da Dino em 30/10: o mesmo serviço cadastrado por profissional.
const servicos = [
  { id: 's-corte', nome: 'Corte' },
  { id: 's-corte-bn', nome: 'CORTE (Bruno ou Nati)' },
  { id: 's-corte-dino', nome: 'Corte com Dino' },
  { id: 's-barba-dino', nome: 'Barba com o Dino' },
  { id: 's-barba', nome: 'BARBA' },
  { id: 's-cb', nome: 'Corte e Barba' },
  { id: 's-cb-dino', nome: 'Corte e barba com Dino' },
  { id: 's-visagista', nome: 'Corte Visagista' },
];

test('nome base ignora profissional e parênteses', () => {
  assert.equal(nomeBaseDoServico('Corte com Dino'), 'corte');
  assert.equal(nomeBaseDoServico('CORTE (Bruno ou Nati)'), 'corte');
  assert.equal(nomeBaseDoServico('Barba com o Dino'), 'barba');
  assert.equal(nomeBaseDoServico('Corte e barba com Dino'), 'corte e barba');
  assert.equal(nomeBaseDoServico('Corte Visagista'), 'corte visagista');
});

test('"Corte" pedido com o Dino vira "Corte com Dino"', () => {
  const [primeiro] = servicosEquivalentes(servicos, 's-corte', { id: 'p-dino', nome: 'Dino' });
  assert.equal(primeiro.id, 's-corte-dino');
});

test('funciona com o nome completo do Dino e para os outros barbeiros', () => {
  assert.equal(servicosEquivalentes(servicos, 's-corte', { nome: 'Robson Gonçalves Rocha (Dino)' })[0].id, 's-corte-dino');
  assert.equal(servicosEquivalentes(servicos, 's-corte-dino', { nome: 'Bruno' })[0].id, 's-corte-bn');
  assert.equal(servicosEquivalentes(servicos, 's-barba', { nome: 'Dino' })[0].id, 's-barba-dino');
  assert.equal(servicosEquivalentes(servicos, 's-cb', { nome: 'Dino' })[0].id, 's-cb-dino');
});

test('não troca por serviço diferente (visagista) nem inventa quando não há equivalente', () => {
  assert.ok(!servicosEquivalentes(servicos, 's-corte', { nome: 'Dino' }).some((s) => s.id === 's-visagista'));
  assert.deepEqual(servicosEquivalentes(servicos, 's-visagista', { nome: 'Dino' }), []);
  assert.deepEqual(servicosEquivalentes(servicos, 'nao-existe', { nome: 'Dino' }), []);
});

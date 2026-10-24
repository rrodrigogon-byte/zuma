import test from 'node:test';
import assert from 'node:assert/strict';
import { nomeKyttoDoAvec, profissionalKyttoDoAvec } from './dino-vinculos-avec.js';

test('nome do Avec liga ao cadastro do Kytto pelo nome social, com acento e caixa diferentes', () => {
  assert.equal(nomeKyttoDoAvec('GUILHERME CUNHA MARTINS'), 'Dino');
  assert.equal(nomeKyttoDoAvec('Steffany Marielly de Oliveira '), 'Ester');
  assert.equal(nomeKyttoDoAvec('João Victor Domingos Ruedel'), 'João');
  assert.equal(nomeKyttoDoAvec('Bruno Rafael dos Santos'), null, 'ex-profissional sem cadastro no Kytto não liga');
  const equipe = [{ id: 'prof-1', nome: 'Dino' }, { id: 'prof-avec-hist-x', nome: 'guilherme cunha martins' }, { id: 'prof-2', nome: 'João' }];
  assert.equal(profissionalKyttoDoAvec('Guilherme Cunha Martins', equipe).id, 'prof-1', 'nunca liga a outro registro histórico');
  assert.equal(profissionalKyttoDoAvec('Joao Victor Domingos Ruedel', equipe).id, 'prof-2');
  assert.equal(profissionalKyttoDoAvec('Natani Minanis Dobler', equipe), null, 'sem cadastro correspondente, sem vínculo');
});

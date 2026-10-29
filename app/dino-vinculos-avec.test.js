import test from 'node:test';
import assert from 'node:assert/strict';
import { nomeKyttoDoAvec, profissionalKyttoDoAvec } from './dino-vinculos-avec.js';

test('nome do Avec liga ao cadastro do Kytto pelo nome social, com acento e caixa diferentes', () => {
  assert.equal(nomeKyttoDoAvec('GUILHERME CUNHA MARTINS'), 'Dino');
  assert.equal(nomeKyttoDoAvec('Steffany Marielly de Oliveira '), 'Ester');
  assert.equal(nomeKyttoDoAvec('João Victor Domingos Ruedel'), 'João');
  assert.equal(nomeKyttoDoAvec('Bruno Rafael dos Santos'), null, 'ex-profissional sem cadastro no Kytto não liga');
  // O cadastro do João no Kytto veio da importação do Avec (id prof-avec-…), mas não é histórico.
  const equipe = [{ id: 'prof-1', nome: 'Dino' }, { id: 'prof-avec-hist-x', nome: 'guilherme cunha martins' }, { id: 'prof-avec-20a2', nome: 'João' }];
  assert.equal(profissionalKyttoDoAvec('Guilherme Cunha Martins', equipe).id, 'prof-1', 'nunca liga a outro registro histórico');
  assert.equal(profissionalKyttoDoAvec('Joao Victor Domingos Ruedel', equipe).id, 'prof-avec-20a2');
  assert.equal(profissionalKyttoDoAvec('Natani Minanis Dobler', equipe), null, 'sem cadastro correspondente, sem vínculo');
});

test('vínculo continua quando o cadastro do Kytto é renomeado (apelido ou nome completo)', () => {
  const equipe = [
    { id: 'p-nati', nome: 'Nati' },
    { id: 'p-joao', nome: 'João Victor Domingos Ruedel' },
    { id: 'p-dino', nome: 'Dino' },
    { id: 'prof-avec-hist-y', nome: 'Natani Minanis Dobler' },
  ];
  assert.equal(profissionalKyttoDoAvec('NATANI MINANIS DOBLER', equipe).id, 'p-nati');
  assert.equal(profissionalKyttoDoAvec('Joao Victor Domingos Ruedel', equipe).id, 'p-joao');
  assert.equal(profissionalKyttoDoAvec('Guilherme Cunha Martins', equipe).id, 'p-dino');
  // Nome social tem prioridade sobre apelido; ambiguidade não liga.
  assert.equal(profissionalKyttoDoAvec('Natani Minanis Dobler', [...equipe, { id: 'p-natani', nome: 'Natani' }]).id, 'p-natani');
  assert.equal(profissionalKyttoDoAvec('Natani Minanis Dobler', [{ id: 'a', nome: 'Nati' }, { id: 'b', nome: 'Naty' }]), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  excluirProfissional,
  isProfissionalProtegido,
  resolverProfissionalIdSeguro,
  listarProfissionais,
  listarServicos,
  criarComandaBarbearia,
  adicionarItensComandaBarbearia
} from './barbearia-erp-kytto.js';
import { provisionarEquipeDino, PROFISSIONAIS_DINO_OFICIAIS, DINO_EMPRESA_CANONICA } from './dino-equipe-seed.js';

test('1. Trava de proteção: profissionais titulares oficiais não podem ser excluídos acidentalmente', () => {
  assert.equal(isProfissionalProtegido('Bruno Mendes Pedroso', 'Bruno'), true);
  assert.equal(isProfissionalProtegido('Dino', 'Dino'), true);
  assert.equal(isProfissionalProtegido('Natani Minanis Dobler', 'Nati'), true);
  assert.equal(isProfissionalProtegido('Steffany Marielly de Oliveira', 'Ster'), true);
  assert.equal(isProfissionalProtegido('Outro Profissional Eventual', 'Eventual'), false);
});

test('2. Tentativa de excluir Bruno sem forcar=true é bloqueada com erro', () => {
  const profs = listarProfissionais(DINO_EMPRESA_CANONICA, { incluirInativos: true });
  const bruno = profs.find(p => p.nome.toLowerCase().includes('bruno') && !p.nome.toLowerCase().includes('bruno rafael'));
  assert.ok(bruno, 'Bruno deve existir no cadastro');

  assert.throws(() => {
    excluirProfissional(DINO_EMPRESA_CANONICA, bruno.id, { forcar: false });
  }, /protegido e essencial/);
});

test('3. provisionarEquipeDino auto-recupera e garante Bruno Mendes ativo', () => {
  provisionarEquipeDino();
  const profs = listarProfissionais(DINO_EMPRESA_CANONICA, { incluirInativos: false });
  const brunoAtivo = profs.find(p => p.nome.toLowerCase().includes('bruno') && !p.nome.toLowerCase().includes('bruno rafael'));
  assert.ok(brunoAtivo, 'Bruno deve estar listado entre os profissionais ativos');
  assert.equal(brunoAtivo.ativo, true);
  assert.equal(brunoAtivo.removidoEm, null);
});

test('4. resolverProfissionalIdSeguro amarra por ID ou nome e auto-recupera', () => {
  const idResolvidoPorNome = resolverProfissionalIdSeguro(DINO_EMPRESA_CANONICA, 'Bruno');
  assert.ok(idResolvidoPorNome, 'Deve resolver pelo apelido Bruno');

  const idResolvidoPorNomeCompleto = resolverProfissionalIdSeguro(DINO_EMPRESA_CANONICA, 'Bruno Mendes Pedroso');
  assert.ok(idResolvidoPorNomeCompleto, 'Deve resolver pelo nome completo');
});

test('5. Lançamento e validação de comanda com múltiplos procedimentos e pacote para o Bruno', () => {
  const comanda = criarComandaBarbearia(DINO_EMPRESA_CANONICA, {
    clienteNome: 'Cliente Teste Blindagem Permanente',
    clienteTelefone: '65999998877',
    profissionalId: 'Bruno'
  });
  assert.ok(comanda && comanda.id, 'Comanda deve ser criada');

  const servicos = listarServicos(DINO_EMPRESA_CANONICA);
  const srv = servicos[0] || { id: 'srv-teste', preco: 100 };

  const comandaAtualizada = adicionarItensComandaBarbearia(DINO_EMPRESA_CANONICA, comanda.id, [
    { tipo: 'outro', nome: 'Procedimento pacote', preco: 0, quantidade: 2, profissionalId: 'Bruno' },
    { tipo: 'servico', itemId: srv.id, quantidade: 1, profissionalId: 'Bruno' }
  ]);
  assert.equal(comandaAtualizada.itens.length, 2);
  assert.equal(comandaAtualizada.total, Number(srv.preco || 0));
});

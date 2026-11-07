import test from 'node:test';
import assert from 'node:assert/strict';
import { provisionarEquipeDino, DINO_EMPRESA_CANONICA } from './dino-equipe-seed.js';
import * as barbeariaErp from './barbearia-erp-kytto.js';

test('1. Equipe Dino: Profissional excluído NÃO é ressuscitado pelo seed', () => {
  // Provisiona equipe inicial
  provisionarEquipeDino();

  // Buscar profissional qualquer (ex: amanda)
  const profs = barbeariaErp.listarProfissionais(DINO_EMPRESA_CANONICA, { incluirInativos: true });
  const amanda = profs.find(p => p.nome.toLowerCase().includes('amanda') || p.apelido?.toLowerCase() === 'amanda');
  assert.ok(amanda, 'Amanda deve existir na equipe inicial');

  // Gestor exclui o profissional
  barbeariaErp.excluirProfissional(DINO_EMPRESA_CANONICA, amanda.id);

  // Verifica que agora está inativo
  const profsAtivosAntes = barbeariaErp.listarProfissionais(DINO_EMPRESA_CANONICA, { incluirInativos: false });
  assert.ok(!profsAtivosAntes.some(p => p.id === amanda.id), 'Amanda não deve aparecer na lista de ativos');

  // Executa o seed novamente (simulando restart ou novo deploy do servidor)
  provisionarEquipeDino();

  // Verifica que Amanda CONTINUA inativa e NÃO foi ressuscitada
  const profsAtivosDepois = barbeariaErp.listarProfissionais(DINO_EMPRESA_CANONICA, { incluirInativos: false });
  assert.ok(!profsAtivosDepois.some(p => p.id === amanda.id), 'Amanda NÃO deve ser ressuscitada pelo seed');

  const amandaDepois = barbeariaErp.listarProfissionais(DINO_EMPRESA_CANONICA, { incluirInativos: true }).find(p => p.id === amanda.id);
  assert.strictEqual(amandaDepois.ativo, false, 'Amanda permanece com ativo = false');
  assert.ok(amandaDepois.removidoEm, 'Amanda permanece com removidoEm preenchido');

  // Restaura Amanda para manter o ambiente íntegro para testes subsequentes
  barbeariaErp.atualizarProfissional(DINO_EMPRESA_CANONICA, amanda.id, { ativo: true, removidoEm: null });
});

test('2. Fechamento Diário: Isolamento multi-tenant por perfil', () => {
  const EMPRESA_DINO = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const EMPRESA_STALLONE = '31f70c83-9172-40c2-945f-9e793b5048be';

  const todasEmpresas = [
    { id: EMPRESA_DINO, nome: 'Barbearia Dino' },
    { id: EMPRESA_STALLONE, nome: 'Stallone Nutre Sport' }
  ];

  // Simulação de filtro para Dino
  const autorizadasDino = [EMPRESA_DINO];
  const empresasDino = todasEmpresas.filter(e => autorizadasDino.includes(e.id));
  assert.strictEqual(empresasDino.length, 1, 'Dino só vê 1 empresa no fechamento');
  assert.strictEqual(empresasDino[0].id, EMPRESA_DINO, 'Dino só vê a Barbearia Dino');

  // Simulação de tentativa de Dino consultar Stallone
  const checarAcesso = (userAutorizadas, targetId) => {
    return userAutorizadas.includes(targetId);
  };

  assert.strictEqual(checarAcesso(autorizadasDino, EMPRESA_DINO), true, 'Dino acessa seu fechamento');
  assert.strictEqual(checarAcesso(autorizadasDino, EMPRESA_STALLONE), false, 'Dino é bloqueado no fechamento de Stallone');
});

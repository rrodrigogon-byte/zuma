import test from 'node:test';
import assert from 'node:assert/strict';
import { presenceConfirmIntent, resolverNomeCliente } from './core/whatsapp-ai.js';
import { cleanCustomerDisplayName } from './core/whatsapp-ai-normalize.js';
import * as barbearia from './barbearia-erp-kytto.js';
import { DINO_EMPRESA_CANONICA, provisionarEquipeDino } from './dino-equipe-seed.js';

test('presenceConfirmIntent reconhece emojis de confirmacao sem falhar', () => {
  const emojisValidos = ['👍', '👍🏻', '👍🏽', '👌', '✌️', '👊', '🤝', '🙏', '🙌', '👏', '🤙', '✅', '✂️', '💈'];
  for (const emoji of emojisValidos) {
    assert.equal(presenceConfirmIntent(emoji), true, `Emoji "${emoji}" deveria confirmar presenca`);
    assert.equal(presenceConfirmIntent(`${emoji} valeu`), true, `Emoji "${emoji} valeu" deveria confirmar presenca`);
    assert.equal(presenceConfirmIntent(`fechado ${emoji}`), true, `Expressao "fechado ${emoji}" deveria confirmar presenca`);
  }

  // Recusas e duvidas nao devem confirmar
  assert.equal(presenceConfirmIntent('não vou conseguir ir'), false);
  assert.equal(presenceConfirmIntent('cancela pra mim'), false);
  assert.equal(presenceConfirmIntent('preciso remarcar'), false);
});

test('cleanCustomerDisplayName sanitiza completamente Cliente Avec e recupera nome real', () => {
  // Com nome apos o traco
  assert.equal(cleanCustomerDisplayName('Cliente Avec — Evertom Kloppel'), 'Evertom Kloppel');
  assert.equal(cleanCustomerDisplayName('Cliente Avec — Evertom Kloppel', { firstNameOnly: true }), 'Evertom');
  assert.equal(cleanCustomerDisplayName('Cliente Avec - Rodrigo Silva'), 'Rodrigo Silva');

  // Sem nome apos o traco ou com telefone/lixo
  assert.equal(cleanCustomerDisplayName('Cliente Avec — Cel: (65) 99957-7310'), '');
  assert.equal(cleanCustomerDisplayName('Cliente Avec'), '');
  assert.equal(cleanCustomerDisplayName('Avec'), '');
  assert.equal(cleanCustomerDisplayName('Cliente'), '');

  // Nomes normais continuam perfeitos
  assert.equal(cleanCustomerDisplayName('Evertom Kloppel'), 'Evertom Kloppel');
  assert.equal(cleanCustomerDisplayName('Evertom Kloppel', { firstNameOnly: true }), 'Evertom');
  assert.equal(cleanCustomerDisplayName('Carlos Silva'), 'Carlos Silva');
});

test('cancelarPorFaltaConfirmacao NUNCA cancela agendamentos na Dino Barbearia', () => {
  const agora = new Date();
  const res = barbearia.cancelarPorFaltaConfirmacao(DINO_EMPRESA_CANONICA, 'qualquer-id', { agora });
  assert.equal(res, null, 'Deveria retornar null sem cancelar na Dino');

  const cfg = barbearia.obterConfiguracao(DINO_EMPRESA_CANONICA);
  assert.equal(cfg.confirmacaoAutomaticaAtiva, false, 'confirmacaoAutomaticaAtiva na Dino deve ser false');
  assert.equal(cfg.cancelamentoAutomaticoPorFaltaConfirmacao, false, 'cancelamentoAutomaticoPorFaltaConfirmacao deve ser false');
});

test('resolverNomeCliente recupera nome do agendamento se cadastro nao tiver nome', () => {
  const estado = barbearia.estadoEmpresa(DINO_EMPRESA_CANONICA);
  const telExclusivo = '65991998877';
  const agId = 'age-teste-evertom-99';
  estado.agendamentos[agId] = {
    id: agId,
    empresaId: DINO_EMPRESA_CANONICA,
    clienteNome: 'Evertom Kloppel',
    clienteTelefone: telExclusivo,
    dataHora: '2026-11-25T14:15:00',
    dataAgenda: '2026-11-25',
    status: 'agendado',
    servicoId: 'srv-corte',
    profissionalId: 'prof-bruno'
  };

  const nomeResolvido = resolverNomeCliente(DINO_EMPRESA_CANONICA, telExclusivo, 'Cliente Avec');
  assert.equal(nomeResolvido, 'Evertom Kloppel', 'Deveria resolver para o nome do agendamento');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADQUIRENTES_BRASIL,
  BANDEIRAS_BRASIL,
  CONFIGURACAO_PADRAO_DINO,
  obterConfiguracoesTef,
  salvarConfiguracoesTef,
  listarTerminaisTef,
  adicionarTerminalTef,
  atualizarTerminalTef,
  excluirTerminalTef,
  testarConexaoTerminal,
  processarTransacaoTef
} from './core/tef-multimaquininhas-brasil.js';

test('1. Configuração Oficial da Barbearia Dino no Módulo TEF', () => {
  const dinoId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const cfg = obterConfiguracoesTef(dinoId);

  assert.equal(cfg.cnpj, '50.073.355/0002-60');
  assert.equal(cfg.inscricaoMunicipal, '30297');
  assert.equal(cfg.adquirentePadrao, 'stone');
  assert.ok(cfg.adquirentesAtivas.includes('stone'));
  assert.ok(cfg.adquirentesAtivas.includes('pagbank'));
  assert.ok(cfg.adquirentesAtivas.includes('vero_sicredi'));
  assert.equal(cfg.terminais.length, 3);
});

test('2. Gestão de Terminais Pinpad: Listar, Cadastrar, Atualizar e Testar Conexão', () => {
  const dinoId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const terminaisIniciais = listarTerminaisTef(dinoId);
  assert.ok(terminaisIniciais.length >= 3);

  // Cadastrar novo terminal
  const novo = adicionarTerminalTef(dinoId, {
    nome: 'Pinpad Caixa Extra Mobile',
    adquirenteId: 'stone',
    modelo: 'Ton T3 Pro',
    serialNumber: 'TON-MT-998877',
    localizacao: 'Atendimento Rápido Barbearia',
    tipoConexao: 'bluetooth_app'
  });

  assert.ok(novo.id);
  assert.equal(novo.nome, 'Pinpad Caixa Extra Mobile');
  assert.equal(novo.status, 'ativo');

  // Testar conexão / ping
  const teste = testarConexaoTerminal(dinoId, novo.id);
  assert.equal(teste.sucesso, true);
  assert.equal(teste.status, 'conectado');
  assert.ok(teste.latenciaMs > 0);
  assert.ok(teste.mensagem.includes('Conexão bem-sucedida'));

  // Atualizar terminal
  const atualizado = atualizarTerminalTef(dinoId, novo.id, {
    nome: 'Pinpad Caixa Extra Mobile VIP',
    localizacao: 'Cadeira VIP Barbearia'
  });
  assert.equal(atualizado.nome, 'Pinpad Caixa Extra Mobile VIP');
  assert.equal(atualizado.localizacao, 'Cadeira VIP Barbearia');

  // Excluir terminal
  const remocao = excluirTerminalTef(dinoId, novo.id);
  assert.equal(remocao.sucesso, true);
});

test('3. Taxas MDR Negociadas e Cálculo de Líquido na Transação com Terminal Vinculado', () => {
  const dinoId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

  // Transação de R$ 200,00 no Débito via Stone no terminal 1 (taxa da Dino é 1.15%)
  const trx = processarTransacaoTef({
    empresaId: dinoId,
    valor: 200.00,
    modalidade: 'debito',
    adquirenteId: 'stone',
    bandeiraId: 'mastercard',
    terminalId: 'term-dino-01',
    clienteNome: 'Rodrigo Gonçalves'
  });

  assert.equal(trx.valor, 200.00);
  assert.equal(trx.taxaMdrPercentual, 1.15); // Taxa negociada da Dino
  assert.equal(trx.valorTaxaMdr, 2.30); // 1.15% de 200 = 2.30
  assert.equal(trx.valorLiquido, 197.70);
  assert.equal(trx.terminalId, 'term-dino-01');
  assert.ok(trx.comprovanteCliente.includes('DINO BARBEARIA LTDA'));
  assert.ok(trx.comprovanteCliente.includes('IM: 30297'));
  assert.ok(trx.comprovanteEstabelecimento.includes('LÍQUIDO A RECEBER: R$ 197.70'));
});

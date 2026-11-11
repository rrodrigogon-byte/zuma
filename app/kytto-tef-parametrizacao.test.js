import test from 'node:test';
import assert from 'node:assert/strict';
import {
  obterConfiguracoesTef,
  salvarConfiguracoesTef,
  listarTerminaisTef,
  adicionarTerminalTef,
  atualizarTerminalTef,
  excluirTerminalTef,
  testarConexaoTerminal,
  processarTransacaoTef,
} from './core/tef-multimaquininhas-brasil.js';

test('1. Estado Inicial do Módulo TEF: Nasce Não Configurado sem Terminais Falsos', () => {
  const empId = `emp-tef-limpo-${Date.now()}`;
  const cfg = obterConfiguracoesTef(empId);

  assert.equal(cfg.configurado, false);
  assert.equal(cfg.status, 'nao_configurado');
  assert.equal(cfg.terminais.length, 0);
});

test('2. Gestão de Terminais Pinpad: Cadastrar, Atualizar, Testar Conexão Real e Excluir', () => {
  const empId = `emp-tef-gestao-${Date.now()}`;
  salvarConfiguracoesTef(empId, {
    razaoSocial: 'DINO BARBEARIA LTDA',
    cnpj: '50.073.355/0002-60',
    inscricaoMunicipal: '30297',
    adquirentePadrao: 'stone',
    adquirentesAtivas: ['stone'],
    taxasNegociadas: {
      stone: { debito: 1.15, creditoAvista: 2.69, creditoParcelado2a6: 3.49, creditoParcelado7a12: 4.19, pix: 0.49 },
    },
  });

  const novo = adicionarTerminalTef(empId, {
    nome: 'Pinpad Caixa Extra Mobile',
    adquirenteId: 'stone',
    modelo: 'Ton T3 Pro',
    serialNumber: 'TON-MT-998877',
    localizacao: 'Atendimento Rápido Barbearia',
    tipoConexao: 'bluetooth_app',
  });

  assert.ok(novo.id);
  assert.equal(novo.nome, 'Pinpad Caixa Extra Mobile');
  assert.equal(novo.status, 'nao_testado');
  assert.equal(novo.ultimoPing, null);

  // Sem agente local conectado, não simula ping falso em nuvem
  const testeCloud = testarConexaoTerminal(empId, novo.id);
  assert.equal(testeCloud.sucesso, false);
  assert.equal(testeCloud.status, 'nao_testado');

  // Quando o Agente Local reporta telemetria real, registra latência e firmware
  const testeAgente = testarConexaoTerminal(empId, novo.id, {
    agenteLocalConectado: true,
    latenciaRealMs: 18,
    firmwarePinpad: 'PCI-PTS 5.x Real',
  });
  assert.equal(testeAgente.sucesso, true);
  assert.equal(testeAgente.status, 'conectado');
  assert.equal(testeAgente.latenciaMs, 18);

  const atualizado = atualizarTerminalTef(empId, novo.id, {
    nome: 'Pinpad Caixa Extra Mobile VIP',
    localizacao: 'Cadeira VIP Barbearia',
  });
  assert.equal(atualizado.nome, 'Pinpad Caixa Extra Mobile VIP');
  assert.equal(atualizado.localizacao, 'Cadeira VIP Barbearia');

  assert.equal(listarTerminaisTef(empId).length, 1);

  const remocao = excluirTerminalTef(empId, novo.id);
  assert.equal(remocao.sucesso, true);
});

test('3. Taxas MDR Negociadas em Contrato e Cálculo de Líquido na Transação com Terminal Real', () => {
  const dinoId = `emp-dino-tef-${Date.now()}`;
  salvarConfiguracoesTef(dinoId, {
    razaoSocial: 'DINO BARBEARIA LTDA',
    cnpj: '50.073.355/0002-60',
    inscricaoMunicipal: '30297',
    adquirentePadrao: 'stone',
    adquirentesAtivas: ['stone'],
    taxasNegociadas: {
      stone: { debito: 1.15, creditoAvista: 2.69, creditoParcelado2a6: 3.49, creditoParcelado7a12: 4.19, pix: 0.49 },
    },
  });
  const term = adicionarTerminalTef(dinoId, {
    id: 'term-dino-01',
    nome: 'Pinpad Recepção Principal',
    adquirenteId: 'stone',
    modelo: 'Gertec PPC930',
    serialNumber: 'GERTEC-50073355-01',
  });

  const trx = processarTransacaoTef({
    empresaId: dinoId,
    valor: 200.0,
    modalidade: 'debito',
    adquirenteId: 'stone',
    bandeiraId: 'mastercard',
    terminalId: term.id,
    clienteNome: 'Rodrigo Gonçalves',
  });

  assert.equal(trx.valor, 200.0);
  assert.equal(trx.taxaMdrPercentual, 1.15);
  assert.equal(trx.valorTaxaMdr, 2.3);
  assert.equal(trx.valorLiquido, 197.7);
  assert.equal(trx.terminalId, 'term-dino-01');
  assert.ok(trx.comprovanteCliente.includes('DINO BARBEARIA LTDA'));
  assert.ok(trx.comprovanteCliente.includes('IM: 30297'));
  assert.ok(trx.comprovanteEstabelecimento.includes('LÍQUIDO A RECEBER: R$ 197.70'));
});

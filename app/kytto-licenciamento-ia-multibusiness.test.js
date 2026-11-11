/**
 * Suíte de Testes Unitários: Licenciamento Criptográfico, Gestão de Instâncias & IA Kytto Advisor
 * Kytto ERP - Multi-Tenant, Multi-Business & Hybrid Deploy (SaaS / On-Premise)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  gerarChaveLicenca, 
  verificarChaveLicenca, 
  obterStatusLicenca, 
  ativarChaveLicenca, 
  obterUsoInstancias, 
  PLANOS_CATALOGO 
} from './core/licenciamento-kytto.js';
import { 
  calcularForecastFaturamento, 
  auditarAnomaliasERiscos, 
  simularCenario, 
  sugerirCrossSelling 
} from './core/ia-advisor-executivo.js';
import { EMPRESA_DINO_ID } from './modules/empresas/servico.js';

test('1. Licenciamento: Geração e Verificação de Chave Assinada Digitalmente', () => {
  const { chave, payload } = gerarChaveLicenca({
    empresaId: EMPRESA_DINO_ID,
    clienteNome: 'Dino Barbearia Master',
    cnpj: '50073355000260',
    tipoDeploy: 'on_premise',
    plano: 'on_premise_sovereign'
  });

  assert.ok(chave.startsWith('KYTTO-LIC.'), 'A chave deve ter o prefixo oficial KYTTO-LIC.');
  assert.equal(payload.plano, 'on_premise_sovereign');
  assert.equal(payload.tipoDeploy, 'on_premise');

  // Validação criptográfica
  const resultado = verificarChaveLicenca(chave);
  assert.equal(resultado.valido, true, 'A chave emitida deve ser 100% válida');
  assert.equal(resultado.payload.clienteNome, 'Dino Barbearia Master');
  assert.equal(resultado.payload.limites.maxInstanciasWhatsapp, 50);
});

test('2. Licenciamento: Bloqueio de Chave Adulterada ou Corrompida', () => {
  const { chave } = gerarChaveLicenca({
    empresaId: EMPRESA_DINO_ID,
    plano: 'starter'
  });

  // Tenta alterar o hash da assinatura
  const chaveAdulterada = chave.slice(0, -4) + 'abcd';
  const resultado = verificarChaveLicenca(chaveAdulterada);
  assert.equal(resultado.valido, false, 'Chave adulterada deve ser rejeitada');
  assert.match(resultado.motivo, /Assinatura digital inválida/);
});

test('3. Licenciamento: Ativação de Chave e Consulta de Status', () => {
  const { chave } = gerarChaveLicenca({
    empresaId: EMPRESA_DINO_ID,
    clienteNome: 'Dino Barbearia',
    plano: 'enterprise'
  });

  const status = ativarChaveLicenca(EMPRESA_DINO_ID, chave);
  assert.equal(status.status, 'ativa');
  assert.equal(status.plano, 'enterprise');
  assert.ok(status.diasRestantes > 300, 'Deve ter validade anual');
  assert.ok(status.modulosAtivos.includes('ia_advisor'), 'Enterprise deve ter módulo ia_advisor');
});

test('4. Gestão de Instâncias: Verificação de Cotas e Limites', () => {
  const uso = obterUsoInstancias(EMPRESA_DINO_ID);
  assert.ok(uso.cotas.whatsapp, 'Deve calcular cota de WhatsApp');
  assert.ok(uso.cotas.lojas, 'Deve calcular cota de Lojas/Unidades');
  assert.ok(uso.cotas.pdv, 'Deve calcular cota de Terminais PDV');
  assert.ok(uso.cotas.usuarios, 'Deve calcular cota de Usuários');
  assert.ok(uso.cotas.whatsapp.limite >= 1, 'Limite de WhatsApp deve ser positivo');
});

test('5. IA Advisor: Forecast Preditivo de Faturamento', () => {
  const forecast = calcularForecastFaturamento(EMPRESA_DINO_ID);
  assert.ok(forecast.mes, 'Deve retornar o mês de referência');
  assert.ok(typeof forecast.receitaRealizada === 'number', 'Receita realizada deve ser numérica');
  assert.ok(typeof forecast.faturamentoProjetado === 'number', 'Faturamento projetado deve ser numérico');
  assert.ok(forecast.faturamentoProjetadoFormatado.includes('R$'), 'Deve conter formatação em Real brasileiro');
  assert.ok(forecast.probabilidadeMeta >= 0 && forecast.probabilidadeMeta <= 100, 'Probabilidade deve estar entre 0% e 100%');
});

test('6. IA Advisor: Auditoria de Anomalias e Riscos Operacionais', () => {
  const auditoria = auditarAnomaliasERiscos(EMPRESA_DINO_ID);
  assert.ok(typeof auditoria.scoreSaudeOperacional === 'number', 'Score de saúde deve ser numérico');
  assert.ok(Array.isArray(auditoria.anomalias), 'Anomalias deve ser uma lista');
  assert.ok(Array.isArray(auditoria.riscos), 'Riscos deve ser uma lista');
});

test('7. IA Advisor: Simulador de Cenários "What-If"', () => {
  const simulacao = simularCenario(EMPRESA_DINO_ID, {
    receitaRealizadaPg: 10000,
    custosAtuaisPg: 3000,
    despesasAtuaisPg: 2000,
    reajustePrecoPercentual: 10,
    aumentoAtendimentosPercentual: 15,
    novosColaboradores: 1
  });

  assert.ok(simulacao.atual.receitaBruta >= 0, 'Receita atual deve ser calculada');
  assert.ok(simulacao.simulado.receitaBruta > simulacao.atual.receitaBruta, 'Cenário com reajuste deve aumentar a receita');
  assert.ok(simulacao.parecerIa.length > 10, 'Deve emitir parecer da IA em texto compreensível');
});

test('8. IA Advisor: Recomendação de Cross-Selling Preditivo', () => {
  const crossCorte = sugerirCrossSelling('Corte Degradê');
  assert.ok(crossCorte.length > 0, 'Deve sugerir itens para corte');
  assert.ok(crossCorte.some(i => i.nome.includes('Pomada') || i.nome.includes('Sobrancelha')), 'Deve sugerir pomada ou sobrancelha');

  const crossBarba = sugerirCrossSelling('Barboterapia');
  assert.ok(crossBarba.some(i => i.nome.includes('Balm') || i.nome.includes('Toalha')), 'Deve sugerir balm ou vapor de ozônio');
});

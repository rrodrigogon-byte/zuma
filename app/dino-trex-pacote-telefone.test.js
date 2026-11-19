import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as barbearia from './barbearia-erp-kytto.js';
import * as clientes from './clientes-contas-kytto.js';
import * as captacao from './dino-captacao-kytto.js';
import { customerContextFor } from './core/whatsapp-ai.js';

test('T-Rex identifica pacote/plano ativo pelo telefone do cliente e não cobra avulso', async () => {
  const empresaId = `emp_teste_trex_pacote_${Date.now()}`;
  const lojaId = randomUUID();
  const telefone = '14997462929';

  // 1. Cria cliente
  const cli = clientes.criarCliente(empresaId, {
    nome: 'Rodrigo Ribeiro Gonçalves',
    telefone: '5514997462929',
  });

  // 2. Cria barbeiro Dino e serviços
  const dino = barbearia.criarProfissional(empresaId, {
    nome: 'Dino (Mestre)',
    apelido: 'Dino',
    ativo: true,
    atendimento24x7: true,
  });

  const srvCorte = barbearia.criarServico(empresaId, {
    nome: 'Corte com Dino',
    preco: 300,
    duracaoMinutos: 40,
    ativo: true,
    profissionaisIds: [dino.id],
  });

  const srvBarba = barbearia.criarServico(empresaId, {
    nome: 'Barba com o Dino',
    preco: 300,
    duracaoMinutos: 30,
    ativo: true,
    profissionaisIds: [dino.id],
  });

  const srvCombo = barbearia.criarServico(empresaId, {
    nome: 'Corte e barba com Dino',
    preco: 600,
    duracaoMinutos: 60,
    ativo: true,
    profissionaisIds: [dino.id],
  });

  // 3. Cria plano Club Dino e assinatura com 4 sessões restantes
  const plano = barbearia.criarPlano(empresaId, {
    nome: 'Club Dino',
    preco: 1000,
    validadeDias: 30,
    sessoesIncluidas: 16,
    servicosIds: [srvCorte.id, srvBarba.id, srvCombo.id],
    categoriaPlano: 'recorrencia',
  });

  const ass = barbearia.criarAssinatura(empresaId, {
    clienteId: cli.id,
    clienteNome: cli.nome,
    clienteTelefone: telefone,
    planoId: plano.id,
    sessoesContratadas: 10,
    sessoesUsadas: 6,
  });

  barbearia.alterarStatusAssinatura(empresaId, ass.id, 'ativa', {
    confirmadoSemCobranca: true,
    pagamentoConfirmado: true,
  });

  // 4. Valida detecção pelo telefone via planoDoTelefone
  const planoDetectado = captacao.planoDoTelefone(empresaId, telefone);
  assert.ok(planoDetectado, 'Plano deve ser detectado pelo telefone');
  assert.equal(planoDetectado.plano, 'Club Dino');
  assert.equal(planoDetectado.restantes, 4);

  // 5. Valida contexto gerado para o T-Rex (customerContextFor)
  const toolContext = {
    empresaId,
    lojaId,
    phone: telefone,
    customerName: 'Rodrigo',
    toolResults: [],
    toolLinks: [],
  };

  const contextPrompt = customerContextFor(toolContext);
  assert.ok(contextPrompt.includes('ATENÇÃO MÁXIMA T-REX — CLIENTE É ASSINANTE'), 'Prompt deve conter alerta de assinante');
  assert.ok(contextPrompt.includes('Club Dino'), 'Prompt deve citar Club Dino');
  assert.ok(contextPrompt.includes('R$ 0,00 ADICIONAL'), 'Prompt deve instruir R$ 0,00 adicional');
  assert.ok(contextPrompt.includes('NUNCA informe cobrança avulsa'), 'Prompt deve proibir cobrança avulsa de assinante');

  // 6. Valida que cobreServicoEProfissional reconhece a cobertura
  const cobreCorte = captacao.cobreServicoEProfissional(planoDetectado, srvCorte.id, dino.id, srvCorte.nome);
  assert.equal(cobreCorte, true, 'Deve cobrir corte com Dino');

  const cobreCombo = captacao.cobreServicoEProfissional(planoDetectado, srvCombo.id, dino.id, srvCombo.nome);
  assert.equal(cobreCombo, true, 'Deve cobrir combo corte e barba com Dino');

  // 7. Valida que cliente sem plano recebe prompt normal sem alerta de assinante
  const toolContextSemPlano = {
    empresaId,
    lojaId,
    phone: '65999990000',
    customerName: 'Cliente Avulso',
    toolResults: [],
    toolLinks: [],
  };
  const contextSemPlano = customerContextFor(toolContextSemPlano);
  assert.equal(contextSemPlano.includes('ATENÇÃO MÁXIMA T-REX — CLIENTE É ASSINANTE'), false);
});

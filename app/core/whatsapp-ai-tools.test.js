import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from './database.js';
import { confirmPendingAction, createWhatsappAiToolExecutor, WhatsappAiToolError, WHATSAPP_AI_TOOL_DECLARATIONS } from './whatsapp-ai-tools.js';

const CONTEXT = {
  empresaId: '11111111-1111-4111-8111-111111111111',
  lojaId: '22222222-2222-4222-8222-222222222222',
  canalId: '33333333-3333-4333-8333-333333333333',
  sessionId: '44444444-4444-4444-8444-444444444444',
  phone: '5565999999999',
  externalEventId: 'MSG-1',
};

test('executor rejeita ferramenta fora da allowlist', async () => {
  await assert.rejects(
    () => createWhatsappAiToolExecutor(CONTEXT)('apagar_banco', {}),
    error => error instanceof WhatsappAiToolError && error.code === 'TOOL_NOT_ALLOWED',
  );
});

test('confirmPendingAction devolve ação concluída sem executar nova mutação', async () => {
  const original = db.transaction;
  const calls = [];
  db.transaction = async callback => callback({
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM whatsapp_ai_sessions')) return { rows: [{ acao_pendente: { actionId: '55555555-5555-4555-8555-555555555555' } }] };
      if (sql.includes('FROM whatsapp_ai_actions')) return { rows: [{ id: '55555555-5555-4555-8555-555555555555', status: 'concluida', resposta: { ok: true, publicCode: 'KC-TESTE' } }] };
      throw new Error('nenhuma mutação adicional deveria ocorrer');
    },
  });
  try {
    const result = await confirmPendingAction(CONTEXT);
    assert.deepEqual(result, { ok: true, publicCode: 'KC-TESTE' });
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].params.slice(1), [CONTEXT.empresaId, CONTEXT.lojaId]);
    assert.deepEqual(calls[1].params.slice(1), [CONTEXT.empresaId, CONTEXT.lojaId]);
  } finally { db.transaction = original; }
});

test('canal Gestão permite somente consulta/handoff e rejeita despesa', async () => {
  await assert.rejects(
    () => createWhatsappAiToolExecutor({ ...CONTEXT, channelType: 'gestao' })('listar_servicos', {}),
    error => error instanceof WhatsappAiToolError && error.code === 'MANAGEMENT_TOOL_DISABLED',
  );
  await assert.rejects(
    () => createWhatsappAiToolExecutor({ ...CONTEXT, channelType: 'gestao', capabilities: { financialOperations: true } })('preparar_despesa', {}),
    error => error instanceof WhatsappAiToolError && error.code === 'MANAGEMENT_TOOL_DISABLED',
  );
});

test('canal Lançamentos permite apenas despesa pendente ou handoff', async () => {
  await assert.rejects(
    () => createWhatsappAiToolExecutor({ ...CONTEXT, channelType: 'lancamentos' })('listar_servicos', {}),
    error => error instanceof WhatsappAiToolError && error.code === 'LAUNCH_TOOL_DISABLED',
  );
});

test('executor bloqueia promoções quando a capacidade não está habilitada no canal', async () => {
  await assert.rejects(
    () => createWhatsappAiToolExecutor({ ...CONTEXT, capabilities: { sendPromotions: false } })('listar_promocoes_ativas', {}),
    error => error instanceof WhatsappAiToolError && error.code === 'CAPABILITY_DISABLED',
  );
});

test('despesa está na allowlist e pode ser desabilitada por canal', async () => {
  assert.equal(WHATSAPP_AI_TOOL_DECLARATIONS.some((tool) => tool.name === 'preparar_despesa'), true);
  await assert.rejects(
    () => createWhatsappAiToolExecutor({ ...CONTEXT, capabilities: { financialOperations: false } })('preparar_despesa', {}),
    error => error instanceof WhatsappAiToolError && error.code === 'CAPABILITY_DISABLED',
  );
});

test('mesma mídia de despesa não cria segunda ação', async () => {
  const original = db.queryRead;
  const mediaHash = 'a'.repeat(64);
  db.queryRead = async () => ({ rows: [{ id: 'acao-existente', status: 'preparada', solicitacao: {}, resposta: null }] });
  try {
    const result = await createWhatsappAiToolExecutor({
      ...CONTEXT,
      customerText: `[foto enviada pelo cliente]\n[despesa extraída da foto] ${JSON.stringify({ fornecedor: 'Fornecedor Teste', valor: 47, dataDocumento: '2026-10-14', categoria: 'Outros', descricao: 'Recibo', confianca: 0.99, mediaHash })}`,
    })('preparar_despesa', {});
    assert.equal(result.duplicada, true);
    assert.equal(result.acao.id, 'acao-existente');
  } finally { db.queryRead = original; }
});

test('cálculo de pacotes exige intenção ou oportunidade aprovada, sem inventar tabela por profissional',async()=>{
 assert.equal(WHATSAPP_AI_TOOL_DECLARATIONS.some(t=>t.name==='calcular_pacote_frequencia'),true);
 await assert.rejects(()=>createWhatsappAiToolExecutor(CONTEXT)('calcular_pacote_frequencia',{profissional:'Nati'}),error=>error.code==='OPPORTUNITY_REQUIRED');
});

test('agendamento whats: alerta sempre os valores e regras de forma humana e transparente', async () => {
  const { listServices, availability } = await import('./barbershop-agenda.js');
  const barbearia = await import('../barbearia-erp-kytto.js');

  const EMPRESA = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const dino = barbearia.listarProfissionais(EMPRESA).find((p) => barbearia.ehProfissionalDino(p)) || barbearia.criarProfissional(EMPRESA, {
    nome: 'Guilherme Cunha Martins (Dino)',
    apelido: 'Dino',
    atendimento24x7: true,
  });

  const servicosExistentes = barbearia.listarServicos(EMPRESA);
  const servicoDino = servicosExistentes.find((s) => s.nome.toLowerCase().includes('dino')) || barbearia.criarServico(EMPRESA, {
    nome: 'Corte VIP Dino',
    duracaoMinutos: 30,
    preco: 300,
    profissionaisIds: [dino.id],
  });

  const bruno = barbearia.listarProfissionais(EMPRESA).find((p) => p.nome.toLowerCase().includes('bruno')) || barbearia.criarProfissional(EMPRESA, {
    nome: 'Bruno Mendes',
    apelido: 'Bruno',
  });

  const servicoBruno = servicosExistentes.find((s) => !s.nome.toLowerCase().includes('dino') && s.preco > 0) || barbearia.criarServico(EMPRESA, {
    nome: 'Corte Tradicional Equipe',
    duracaoMinutos: 30,
    preco: 50,
    profissionaisIds: [bruno.id],
  });

  const scope = { empresaId: EMPRESA, lojaId: 'dino-matriz' };

  const originalQueryRead = db.queryRead;
  db.queryRead = async () => ({ rows: [] });
  try {
    // Verifica listServices com avisoValorHumano
    const servicos = await listServices(scope);
    const sDino = servicos.find((s) => s.id === servicoDino.id);
    const sBruno = servicos.find((s) => s.id === servicoBruno.id);

    assert.ok(sDino, 'Serviço do Dino encontrado');
    assert.match(sDino.avisoValorHumano, /R\$ 300 diurno.*R\$ 600 em horário extra/);
    assert.ok(sBruno, 'Serviço do Bruno encontrado');
    assert.match(sBruno.avisoValorHumano, /Valor R\$/);

    // Verifica availability com tabelaValores
    const dispDino = await availability(scope, {
      serviceId: servicoDino.id,
      professionalId: dino.id,
      date: '2030-06-15',
    });
    assert.equal(dispDino.tabelaValores.tipo, 'dino_24x7');
    assert.match(dispDino.tabelaValores.orientacaoHumana, /Sempre alerte o cliente com simpatia e transparência/);

    const dispBruno = await availability(scope, {
      serviceId: servicoBruno.id,
      professionalId: bruno.id,
      date: '2030-06-15',
    });
    assert.equal(dispBruno.tabelaValores.tipo, 'padrao');
    assert.match(dispBruno.tabelaValores.valor, /R\$/);
  } finally {
    db.queryRead = originalQueryRead;
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { isStaffTyped, latestStaffMessages, pauseForStaff, STAFF_REASON } from './whatsapp-staff-takeover.js';
import { db } from './database.js';
import { buildWhatsappAiSystemPrompt, claimWhatsappAiHandoff, sendWhatsappAiStaffMessage, searchWhatsappAiContacts, startWhatsappAiSession } from './whatsapp-ai.js';
import { resolvePersona } from './whatsapp-ai-persona.js';

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const LOJA = '22222222-2222-4222-8222-222222222222';
const CANAL = '33333333-3333-4333-8333-333333333333';
const SESSAO = '44444444-4444-4444-8444-444444444444';
const USUARIO = '55555555-5555-4555-8555-555555555555';

test('isStaffTyped: identifica apenas mensagens orgânicas digitadas por humanos no aparelho', () => {
  assert.equal(isStaffTyped({ role: 'assistant', interactionType: 'organic' }), true);
  assert.equal(isStaffTyped({ role: 'assistant', interactionType: 'bot' }), false);
  assert.equal(isStaffTyped({ role: 'user', interactionType: 'organic' }), false);
  assert.equal(isStaffTyped({ role: 'assistant' }), false);
  assert.equal(isStaffTyped(null), false);
});

test('latestStaffMessages: agrupa última mensagem por telefone', () => {
  const agora = new Date();
  const antes = new Date(agora.getTime() - 60000);
  const items = [
    { chatId: '556599998888@s.whatsapp.net', role: 'assistant', interactionType: 'organic', timestamp: antes.toISOString() },
    { chatId: '556599998888@s.whatsapp.net', role: 'assistant', interactionType: 'organic', timestamp: agora.toISOString() },
    { chatId: '556511112222@s.whatsapp.net', role: 'assistant', interactionType: 'organic', timestamp: antes.toISOString() },
    { chatId: '556599998888@s.whatsapp.net', role: 'assistant', interactionType: 'bot', timestamp: agora.toISOString() },
  ];
  const resultado = latestStaffMessages(items);
  assert.equal(resultado.length, 2);
  const m1 = resultado.find((r) => r.phone === '556599998888');
  assert.equal(m1.at.toISOString(), agora.toISOString());
});

test('pauseForStaff: cancela tarefas pendentes da IA ao pausar para a equipe humana', async () => {
  const queries = [];
  const originalTransaction = db.transaction;
  db.transaction = async (fn) => fn({
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (/INSERT INTO whatsapp_ai_sessions/.test(sql)) {
        return { rows: [{ id: SESSAO, status: 'ativo', handoff_reason: null, estado: {}, acao_pendente: null }] };
      }
      return { rows: [] };
    },
  });

  try {
    const canal = { id: CANAL, empresa_id: EMPRESA, loja_id: LOJA };
    const at = new Date();
    const res = await pauseForStaff(canal, { phone: '556599998888', at });
    assert.equal(res.paused, true);
    assert.equal(res.sessionId, SESSAO);

    // Verifica se houve cancelamento de tarefas pendentes em tarefas_integracao_canais
    const cancelouTarefas = queries.some((q) => /UPDATE tarefas_integracao_canais/.test(q.sql) && /status = 'cancelada'/.test(q.sql));
    assert.ok(cancelouTarefas, 'Tarefas pendentes de IA devem ser canceladas imediatamente');
  } finally {
    db.transaction = originalTransaction;
  }
});

test('claimWhatsappAiHandoff: cancela tarefas pendentes ao assumir atendimento na plataforma', async () => {
  const queries = [];
  const originalTransaction = db.transaction;
  db.transaction = async (fn) => fn({
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (/SELECT id, status, assigned_to[\s\S]*FROM whatsapp_ai_sessions/i.test(sql)) {
        return { rows: [{ id: SESSAO, status: 'ativo', assigned_to: null, assigned_at: null, priority: 0, handoff_reason: null }] };
      }
      if (/UPDATE whatsapp_ai_sessions/i.test(sql)) {
        return { rows: [{ id: SESSAO, status: 'humano', assigned_to: USUARIO, assigned_at: new Date(), priority: 1, handoff_reason: null, handoff_requested_at: new Date() }] };
      }
      return { rows: [] };
    },
  });

  try {
    const res = await claimWhatsappAiHandoff(
      { empresaId: EMPRESA, lojaId: LOJA, usuarioId: USUARIO },
      SESSAO
    );
    assert.equal(res.id, SESSAO);
    assert.equal(res.status, 'humano');

    const cancelouTarefas = queries.some((q) => /UPDATE tarefas_integracao_canais/.test(q.sql) && /status = 'cancelada'/.test(q.sql));
    assert.ok(cancelouTarefas, 'Claim manual deve cancelar tarefas pendentes do T-Rex');
  } finally {
    db.transaction = originalTransaction;
  }
});

test('sendWhatsappAiStaffMessage: auto-assume a conversa se ainda estava com o T-Rex', async () => {
  const queries = [];
  const originalTransaction = db.transaction;
  const originalQuery = db.query;
  const originalQueryRead = db.queryRead;

  const mockQuery = async (sql, params) => {
    queries.push({ sql, params });
    if (/SELECT s\.id[\s\S]*FROM whatsapp_ai_sessions s/i.test(sql)) {
      return { rows: [{ id: SESSAO, telefone: '556599998888', status: 'ativo', assigned_to: null, canal_id: CANAL, empresa_id: EMPRESA, loja_id: LOJA, api_base_url: 'https://wa.local', configuracao: { instance: 'dino' }, canal_nome: 'Dino', canal_status: 'conectado' }] };
    }
    if (/SELECT id, status, assigned_to[\s\S]*FROM whatsapp_ai_sessions/i.test(sql)) {
      return { rows: [{ id: SESSAO, status: 'ativo', assigned_to: null, assigned_at: null, priority: 0, handoff_reason: null }] };
    }
    if (/UPDATE whatsapp_ai_sessions/i.test(sql)) {
      return { rows: [{ id: SESSAO, status: 'humano', assigned_to: USUARIO, assigned_at: new Date(), priority: 1, handoff_reason: null, handoff_requested_at: new Date() }] };
    }
    if (/INSERT INTO whatsapp_ai_messages/i.test(sql)) {
      return { rows: [{ id: 'msg-1', criado_em: new Date().toISOString() }] };
    }
    return { rows: [] };
  };

  db.query = mockQuery;
  db.queryRead = mockQuery;
  db.transaction = async (fn) => fn({
    query: mockQuery,
  });

  try {
    const res = await sendWhatsappAiStaffMessage(
      { empresaId: EMPRESA, lojaId: LOJA, usuarioId: USUARIO },
      SESSAO,
      { texto: 'Olá!' },
      {
        sendProviderMessage: async () => ({ ok: true, providerMessageId: 'p-1', status: 'sent' }),
      }
    );
    assert.equal(res.ok, true);
    assert.equal(res.session.status, 'humano');
    assert.equal(res.session.claimed, true);
    assert.equal(res.autoClaimed, true);
  } finally {
    db.transaction = originalTransaction;
    db.query = originalQuery;
    db.queryRead = originalQueryRead;
  }
});

test('anti-flood de agenda e escopo de serviços no prompt do sistema', () => {
  const trex = resolvePersona({ persona: { id: 'trex' } }, {});
  const prompt = buildWhatsappAiSystemPrompt({ storeName: 'Barbearia Dino', persona: trex });

  // Anti-flood de link de agendamento
  assert.match(prompt, /NUNCA envie o link repetidas vezes/i);
  assert.match(prompt, /No máximo 1 vez por conversa/i);

  // Escopo estrito da barbearia
  assert.match(prompt, /ESCOPO ESTRITO DA BARBEARIA/i);
  assert.match(prompt, /NÃO oferecemos serviços de podologia, manicure, unhas/i);
  assert.match(prompt, /nem procedimentos estéticos invasivos ou limpeza de pele profunda/i);
});

test('claimWhatsappAiHandoff com reatribuir: permite assumir conversa que já estava com outro atendente', async () => {
  const originalTransaction = db.transaction;
  const OUTRO_USUARIO = '66666666-6666-4666-8666-666666666666';

  db.transaction = async (fn) => fn({
    query: async (sql, p) => {
      if (/SELECT[\s\S]*FROM whatsapp_ai_sessions/i.test(sql)) {
        return {
          rows: [{
            id: SESSAO,
            status: 'humano',
            assigned_to: OUTRO_USUARIO,
            assigned_at: new Date(),
            priority: 2,
            handoff_reason: 'cliente pediu atendente humano',
          }],
        };
      }
      if (/UPDATE whatsapp_ai_sessions/i.test(sql)) {
        return {
          rows: [{
            id: SESSAO,
            status: 'humano',
            assigned_to: USUARIO,
            assigned_at: new Date(),
            priority: 2,
            handoff_reason: 'cliente pediu atendente humano',
          }],
        };
      }
      return { rows: [] };
    },
  });

  try {
    // Sem reatribuir: deve lançar erro de conflito
    await assert.rejects(
      () => claimWhatsappAiHandoff({ empresaId: EMPRESA, lojaId: LOJA, usuarioId: USUARIO }, SESSAO, { reatribuir: false }),
      (err) => err.code === 'WHATSAPP_AI_SESSION_CONFLICT'
    );

    // Com reatribuir: deve permitir e atualizar assigned_to
    const reassigned = await claimWhatsappAiHandoff(
      { empresaId: EMPRESA, lojaId: LOJA, usuarioId: USUARIO },
      SESSAO,
      { reatribuir: true }
    );
    assert.equal(reassigned.assigned_to, USUARIO);
  } finally {
    db.transaction = originalTransaction;
  }
});

test('searchWhatsappAiContacts: retorna contatos por busca de nome ou telefone', async () => {
  const originalQueryRead = db.queryRead;
  db.queryRead = async (sql, p) => {
    return {
      rows: [
        { nome: 'Carlos Cliente', telefone: '5565999887766', clean_tel: '5565999887766', origem: 'cliente_base' },
        { nome: 'Carlos Visitante', telefone: '5565999001122', clean_tel: '5565999001122', origem: 'conversa_anterior' },
      ],
    };
  };

  try {
    const res = await searchWhatsappAiContacts({ empresaId: EMPRESA }, 'Carlos');
    assert.equal(res.contacts.length, 2);
    assert.equal(res.contacts[0].nome, 'Carlos Cliente');
    assert.equal(res.contacts[0].origem, 'cliente_base');
    assert.equal(res.contacts[1].origem, 'conversa_anterior');
  } finally {
    db.queryRead = originalQueryRead;
  }
});

test('startWhatsappAiSession: cria nova sessão já assumida para o atendente', async () => {
  const originalQuery = db.query;
  const originalQueryRead = db.queryRead;
  const calls = [];

  db.queryRead = async (sql, p) => {
    if (/FROM canais_integracao/i.test(sql)) {
      return {
        rows: [{
          id: CANAL,
          api_base_url: 'http://localhost:3000',
          configuracao: {},
          nome: 'WhatsApp Dino',
          status: 'ativo',
        }],
      };
    }
    return { rows: [] };
  };

  db.query = async (sql, p) => {
    calls.push({ sql, p });
    if (/INSERT INTO whatsapp_ai_sessions/i.test(sql)) {
      return {
        rows: [{
          id: SESSAO,
          telefone: '5565999112233',
          nome: 'Novo Cliente',
          status: 'humano',
          assigned_to: USUARIO,
          canal_id: CANAL,
        }],
      };
    }
    return { rows: [] };
  };

  try {
    const res = await startWhatsappAiSession(
      { empresaId: EMPRESA, lojaId: LOJA, usuarioId: USUARIO },
      {
        telefone: '65999112233',
        nome: 'Novo Cliente',
        assumir: true,
      }
    );
    assert.equal(res.ok, true);
    assert.equal(res.session.status, 'humano');
    assert.equal(res.session.assigned_to, USUARIO);
    assert.equal(res.session.telefone, '5565999112233');
  } finally {
    db.query = originalQuery;
    db.queryRead = originalQueryRead;
  }
});

test('startWhatsappAiSession: resolve atendente resiliente por email ou fallback quando usuarioId não é UUID', async () => {
  const originalQuery = db.query;
  const originalQueryRead = db.queryRead;

  db.queryRead = async (sql) => {
    if (sql.includes('FROM canais_integracao')) {
      return { rows: [{ id: CANAL, api_base_url: 'http://waha.test', configuracao: {}, nome: 'Canal Teste', status: 'conectado' }] };
    }
    if (sql.includes('FROM usuarios WHERE')) {
      return { rows: [{ id: USUARIO }] };
    }
    return { rows: [] };
  };

  db.query = async (sql, params) => {
    if (sql.includes('INSERT INTO whatsapp_ai_sessions')) {
      return {
        rows: [{
          id: '88888888-8888-4888-8888-888888888888',
          remote_jid: '5565999223344@s.whatsapp.net',
          telefone: '5565999223344',
          nome: 'Cliente Resiliente',
          status: 'humano',
          assigned_to: USUARIO,
          canal_id: CANAL,
        }],
      };
    }
    return { rows: [] };
  };

  try {
    const res = await startWhatsappAiSession(
      { empresaId: EMPRESA, lojaId: LOJA, usuarioEmail: 'ster@barbeariadino.com.br' },
      {
        telefone: '65999223344',
        nome: 'Cliente Resiliente',
        assumir: true,
      }
    );
    assert.equal(res.ok, true);
    assert.equal(res.session.status, 'humano');
    assert.equal(res.session.assigned_to, USUARIO);
  } finally {
    db.query = originalQuery;
    db.queryRead = originalQueryRead;
  }
});

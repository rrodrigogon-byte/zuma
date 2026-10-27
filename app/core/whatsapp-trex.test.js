// Integração da persona T-Rex com o atendente: prompt, configuração no canal,
// lembrete de 24 h, toque de retomada e figurinhas. O fluxo de conversa inteiro
// (bolhas, saudação, "vc é robô?", figurinha após agendar) roda no simulador
// PostgreSQL: WHATSAPP_AI_PERSONA=trex node --test app/core/whatsapp-ai-cenarios.pg.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './database.js';
import { buildWhatsappAiSystemPrompt, configureWhatsappAiPersona, whatsappAiOperationalStatus } from './whatsapp-ai.js';
import { resolvePersona } from './whatsapp-ai-persona.js';
import { followUpText } from './whatsapp-ai-followup.js';
import { mensagem } from './barbershop-appointment-notifications.js';
import { caminhoFigurinha, enviarFigurinha, figurinhaDisponivel, figurinhaSuportada, lerFigurinha } from './whatsapp-figurinhas.js';
import { chatbotBackendStickerPath, sendStickerViaChatbotBackend } from './whatsapp-provider.js';

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const LOJA = '22222222-2222-4222-8222-222222222222';
const trex = resolvePersona({ persona: { id: 'trex' } }, {});

test('prompt: com persona abre como T-Rex e mantém todas as regras do atendente', () => {
  const padrao = buildWhatsappAiSystemPrompt({ storeName: 'Barbearia Dino' });
  const persona = buildWhatsappAiSystemPrompt({ storeName: 'Barbearia Dino', persona: trex });
  assert.match(padrao, /^Você é o atendente virtual humanizado/);
  assert.match(persona, /^Você é o T-Rex, da recepção da Barbearia Dino/);
  assert.doesNotMatch(persona, /Na primeira apresentação, informe com transparência que é um assistente virtual/);
  // O que vem depois da abertura é o mesmo texto: ferramentas, travas e handoff.
  const corpo = (texto) => texto.slice(texto.indexOf('CAPACIDADES DA UNIDADE'));
  assert.equal(corpo(persona), corpo(padrao));
  assert.match(persona, /propor_oportunidade/);
  assert.match(persona, /NUNCA se identifique como IA|Nunca negue ser assistente/);
});

test('configuração: persona exige confirmação, valida nome e grava auditoria', async () => {
  await assert.rejects(configureWhatsappAiPersona({ empresaId: EMPRESA, lojaId: LOJA }, { nome: 'T-Rex' }), /confirmação humana/);
  await assert.rejects(configureWhatsappAiPersona({ empresaId: EMPRESA, lojaId: LOJA }, { nome: 'Dino', confirmed: true }), /barbeiro master/);
  const originalTransaction = db.transaction;
  const queries = [];
  db.transaction = async (fn) => fn({
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (/UPDATE canais_integracao/.test(sql)) {
        return { rows: [{ id: 'canal-1', codigo_publico: 'pub', nome: 'Barbearia Dino', status: 'rascunho', configuracao: { instance: 'dino', persona: JSON.parse(params[2]) } }] };
      }
      return { rows: [] };
    },
  });
  try {
    const result = await configureWhatsappAiPersona({ empresaId: EMPRESA, lojaId: LOJA, usuarioId: null }, { nome: 'T-Rex', figurinhas: false, confirmed: true });
    assert.equal(result.ok, true);
    assert.equal(result.persona.ativa, true);
    assert.equal(result.persona.nome, 'T-Rex');
    assert.equal(result.persona.figurinhas, false);
    assert.equal(result.channel.persona.origem, 'canal');
    assert.ok(queries.some((q) => /persona_configured/.test(q.sql)), 'auditoria gravada');
  } finally {
    db.transaction = originalTransaction;
  }
});

test('lembrete de 24 h: voz do T-Rex com os mesmos comandos; sem persona, texto original', () => {
  const snapshot = {
    configuracao: { nomePublico: 'Barbearia Dino' },
    servicos: [{ id: 's1', nome: 'Corte Masculino' }],
    profissionais: [{ id: 'p1', nome: 'Bruno' }],
  };
  const agendamento = { servicoId: 's1', profissionalId: 'p1', dataAgenda: '2099-10-10', horaLocal: '09:00' };
  const cliente = { nome: 'João Silva' };
  const voz = mensagem(snapshot, agendamento, cliente, 'lembrete', trex);
  assert.match(voz, /^Opa, João! Passando pra lembrar: no sábado, sáb 10\/10 às 9h, Corte Masculino com Bruno\. Responda CONFIRMO, REMARCAR ou CANCELO\./);
  assert.match(voz, /SAIR/);
  const padrao = mensagem(snapshot, agendamento, cliente, 'lembrete');
  assert.match(padrao, /^Olá, João Silva\. Lembrete do seu agendamento/);
});

test('toque de retomada: T-Rex curto, com o mesmo resumo e a mesma dica de confirmação', () => {
  const sessao = { nome: 'Paulo Lima', configuracao: { persona: { id: 'trex' } }, acao_pendente: { summary: 'Corte Masculino com Bruno, amanhã às 15:00.' } };
  const texto = followUpText(sessao);
  assert.equal(texto, "Opa, Paulo! Dá uma olhada no seu horário: Corte Masculino com Bruno, amanhã às 15:00.\n👉 Responda *SIM* para confirmar, ou *NÃO* para mudar.");
  assert.match(followUpText({ ...sessao, configuracao: {} }), /^Oi, Paulo! Ficou faltando só sua confirmação/);
});

test('figurinhas: arquivos do pacote existem e são WebP pequenos', () => {
  for (const nome of ['oi', 'agendado', 'um-instante', 'corte-na-regua', 'perfume-novo', 'valeu', 'promocao', 'foi-mal', 'ate-amanha']) {
    assert.ok(figurinhaDisponivel(nome), nome);
    const bytes = Buffer.from(lerFigurinha(nome), 'base64');
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    assert.ok(bytes.length < 100 * 1024, `${nome} < 100 KB`);
  }
  assert.equal(caminhoFigurinha('../../etc/passwd'), '', 'nome fora da lista não vira caminho');
  assert.equal(figurinhaDisponivel('inexistente'), false);
});

test('figurinhas: sem rota no backend, nada é enviado e nada quebra', async () => {
  const anterior = { ...process.env };
  try {
    Object.assign(process.env, { WHATSAPP_PROVIDER: 'chatbot_backend', CHATBOT_BACKEND_URL: 'https://backend.sim', CHATBOT_BACKEND_KEY: 'x'.repeat(24), CHATBOT_BACKEND_MODE: 'isa' });
    delete process.env.CHATBOT_BACKEND_STICKER_PATH;
    assert.equal(figurinhaSuportada(), false);
    const r = await enviarFigurinha({}, '65999990000', 'agendado');
    assert.equal(r.ok, false);
    assert.equal(r.unsupported, true);
    process.env.CHATBOT_BACKEND_STICKER_PATH = 'http://fora-do-backend';
    assert.equal(chatbotBackendStickerPath(), '', 'só caminho relativo ao backend');
  } finally {
    process.env = anterior;
  }
});

test('figurinhas: Evolution só quando ligado de propósito; backend com dono exige instâncias', async () => {
  const anterior = { ...process.env };
  try {
    Object.assign(process.env, { WHATSAPP_PROVIDER: 'evolution', EVOLUTION_API_URL: 'https://evo.sim' });
    delete process.env.CHATBOT_BACKEND_URL;
    delete process.env.WHATSAPP_AI_STICKERS_EVOLUTION;
    assert.equal(figurinhaSuportada(), false);
    process.env.WHATSAPP_AI_STICKERS_EVOLUTION = 'on';
    assert.equal(figurinhaSuportada(), true);
    process.env.CHATBOT_BACKEND_URL = 'https://backend.sim';
    const escopo = await enviarFigurinha({ whatsapp_api_url: 'https://evo.sim', whatsapp_api_key: 'k', whatsapp_instance: 'i' }, '65999990000', 'agendado');
    assert.equal(escopo.error, 'WHATSAPP_PROVIDER_SCOPE');
    Object.assign(process.env, { WHATSAPP_PROVIDER: 'chatbot_backend', CHATBOT_BACKEND_KEY: 'x'.repeat(24), CHATBOT_BACKEND_MODE: 'isa', CHATBOT_BACKEND_STICKER_PATH: '/send-media', CHATBOT_BACKEND_EMPRESA_ID: EMPRESA });
    const dono = await enviarFigurinha({}, '65999990000', 'agendado');
    assert.equal(dono.error, 'WHATSAPP_OWNER_REQUIRES_INSTANCE_MODE');
  } finally {
    process.env = anterior;
  }
});

test('figurinhas: contrato do backend (rota configurada)', async () => {
  const anterior = { ...process.env };
  try {
    Object.assign(process.env, { WHATSAPP_PROVIDER: 'chatbot_backend', CHATBOT_BACKEND_URL: 'https://backend.sim', CHATBOT_BACKEND_KEY: 'x'.repeat(24), CHATBOT_BACKEND_MODE: 'isa', CHATBOT_BACKEND_STICKER_PATH: '/send-media' });
    const chamadas = [];
    const fake = async (url, opcoes) => {
      chamadas.push({ url, corpo: JSON.parse(opcoes.body) });
      return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, messageId: 'm1' }) };
    };
    const r = await sendStickerViaChatbotBackend({ number: '65999990000', base64: lerFigurinha('agendado'), fileName: 'agendado.webp' }, fake);
    assert.equal(r.ok, true);
    assert.match(chamadas[0].url, /\/send-media$/);
    assert.ok(chamadas[0].corpo.sticker.base64);
    assert.equal(chamadas[0].corpo.sticker.mimetype, 'image/webp');
    assert.ok(chamadas[0].corpo.chat_id);
    const naoExiste = await sendStickerViaChatbotBackend({ number: '65999990000', base64: 'abc' }, async () => ({ ok: false, status: 404, text: async () => '{}' }));
    assert.equal(naoExiste.unsupported, true);
  } finally {
    process.env = anterior;
  }
});



test('status operacional devolve a persona persistida para recarregar o painel', async () => {
  const original = db.queryRead;
  const channel = { id: 'canal-1', nome: 'Barbearia Dino', status: 'ativo', configuracao: { instance: 'dino', persona: { id: 'trex', ativo: true, nome: 'T-Rex', figurinhas: false } } };
  channel.configuracao.handoff = { notify_email: 'recepcao@example.com', attendant_phone: '5565999990002' };
  db.queryRead = async (sql, params) => {
    if (/FROM canais_integracao/.test(sql)) {
      assert.deepEqual(params, [EMPRESA, LOJA, 'cliente']);
      return { rows: [channel] };
    }
    return { rows: [] };
  };
  try {
    const result = await whatsappAiOperationalStatus({ empresaId: EMPRESA, lojaId: LOJA });
    assert.equal(result.channel.handoff.notifyEmail, 'recepcao@example.com');
    assert.equal(result.channel.handoff.attendantPhone, '5565999990002');
    assert.equal(result.channel.persona.ativa, true);
    assert.equal(result.channel.persona.origem, 'canal');
    assert.equal(result.channel.persona.nome, 'T-Rex');
    assert.equal(result.channel.persona.figurinhas, false);
    channel.configuracao.persona.ativo = false;
    const disabled = await whatsappAiOperationalStatus({ empresaId: EMPRESA, lojaId: LOJA });
    assert.equal(disabled.channel.persona.ativa, false);
  } finally { db.queryRead = original; }
});


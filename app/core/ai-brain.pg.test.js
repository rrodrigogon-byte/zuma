// Teste de integração com PostgreSQL real. Roda só quando AI_BRAIN_PG_URL aponta para um
// banco descartável com as migrations aplicadas (ex.: postgres://postgres:pg@127.0.0.1:5432/kytto_ai).
import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';

const URL = process.env.AI_BRAIN_PG_URL;
const skip = !URL;
if (URL) process.env.DATABASE_URL = URL;

const { db } = await import('./database.js');
const memory = await import('./ai-memory.js');
const learning = await import('./ai-learning.js');
const automations = await import('./ai-automations.js');

const IDS = { empresa: crypto.randomUUID(), loja: crypto.randomUUID(), canal: crypto.randomUUID(), sessao: crypto.randomUUID(), sessao2: crypto.randomUUID() };
const PHONE = '5565999990001';
const PHONE2 = '5565999990002';
const DIA = '2026-09-27';

async function seed() {
  await db.query(`INSERT INTO empresas (id, nome, cnpj, razao_social) VALUES ($1, 'Dino Teste', $2, 'Dino Teste LTDA')`, [IDS.empresa, String(Date.now()).slice(-14).padStart(14, '1')]);
  await db.query(`INSERT INTO lojas (id, empresa_id, codigo, nome) VALUES ($1, $2, $3, 'Loja')`, [IDS.loja, IDS.empresa, `L${Date.now().toString(36)}`]);
  await db.query(`INSERT INTO canais_integracao (id, empresa_id, loja_id, provedor, nome, status) VALUES ($1, $2, $3, 'whatsapp', 'WA', 'ativo')`, [IDS.canal, IDS.empresa, IDS.loja]);
  for (const [sessao, phone] of [[IDS.sessao, PHONE], [IDS.sessao2, PHONE2]]) {
    await db.query(`INSERT INTO whatsapp_ai_sessions (id, empresa_id, loja_id, canal_id, remote_jid, telefone) VALUES ($1,$2,$3,$4,$5,$6)`, [sessao, IDS.empresa, IDS.loja, IDS.canal, `${phone}@s.whatsapp.net`, phone]);
  }
  const msgs = [
    [IDS.sessao, 'user', 'Oi, tem horário sábado cedo com o Bruno? Sábado de manhã é sempre melhor pra mim'],
    [IDS.sessao, 'assistant', 'Tem sim! Sábado 9h com o Bruno. Agendamento confirmado.'],
    [IDS.sessao, 'user', 'Vocês têm estacionamento?'],
    [IDS.sessao, 'assistant', 'Não tenho essa informação, encaminhei para a equipe.'],
    [IDS.sessao2, 'user', 'Voces tem estacionamento?'],
    [IDS.sessao2, 'assistant', 'Não sei informar agora.'],
  ];
  let t = 0;
  for (const [sessao, papel, conteudo] of msgs) {
    t += 1;
    await db.query(
      `INSERT INTO whatsapp_ai_messages (empresa_id, loja_id, canal_id, sessao_id, direcao, papel, conteudo, criado_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7, ($8::date + time '14:00' + ($9 || ' minutes')::interval) AT TIME ZONE 'America/Cuiaba')`,
      [IDS.empresa, IDS.loja, IDS.canal, sessao, papel === 'user' ? 'entrada' : 'saida', papel, conteudo, DIA, t],
    );
  }
}

function fakeRouter(calls) {
  return async (task, opts) => {
    calls.push({ task, exclude: opts.exclude || [] });
    if (task === 'resumir_extrair') {
      const first = opts.user.includes('sábado cedo');
      return {
        provider: 'anthropic', model: 'fake', data: first ? {
          resumo: 'Cliente agendou sábado 9h com o Bruno e perguntou de estacionamento.', resultado: 'agendou', sentimento: 'positivo',
          fatos: [
            { chave: 'horario_preferido', valor: 'sábado de manhã', categoria: 'preferencia_horario', confianca: 0.93, trecho: 'Sábado de manhã é sempre melhor' },
            { chave: 'profissional', valor: 'Bruno', categoria: 'profissional_preferido', confianca: 0.7, trecho: 'com o Bruno' },
            { chave: 'saude', valor: 'alergia a amônia', categoria: 'estilo', confianca: 0.99 },
          ],
          perguntas_sem_resposta: ['Vocês têm estacionamento?'],
        } : { resumo: 'Perguntou de estacionamento.', resultado: 'duvida', sentimento: 'neutro', fatos: [], perguntas_sem_resposta: ['Voces tem estacionamento?'] },
      };
    }
    if (task === 'propor_resposta') return { provider: 'anthropic', model: 'fake', data: { resposta: 'Temos [CONFERIR: onde fica o estacionamento].' } };
    if (task === 'avaliar') return { provider: 'openai', model: 'fake', data: { nota: 4, criterios: { precisao: 5 }, comentario: 'Bom.' } };
    throw new Error('tarefa inesperada');
  };
}

test('ciclo completo no PostgreSQL: configuração, aprendizado, memória, aprovação, esquecimento', { skip }, async (t) => {
  await seed();
  const saved = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'teste';
  t.after(() => { if (saved === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved; });

  assert.equal((await memory.getBrainSettings(IDS.empresa)).ativo, false, 'nasce desligado');
  assert.deepEqual(await learning.runLearningCycle({ empresaId: IDS.empresa, dia: DIA }), { skipped: true, reason: 'cerebro_desligado' });
  const settings = await memory.saveBrainSettings(IDS.empresa, { ativo: true, autonomia: 2, automacoes: { reativacao: true, inexistente: true } }, 'teste');
  assert.equal(settings.autonomia, 2);
  assert.equal(settings.automacoes.reativacao, true);
  assert.equal(Object.hasOwn(settings.automacoes, 'inexistente'), false);

  const calls = [];
  const consentMap = async () => new Map([[PHONE, { personalizacao: true, marketing: null, optOut: false }]]);
  const out = await learning.runLearningCycle({ empresaId: IDS.empresa, dia: DIA, router: fakeRouter(calls), consentMap });
  assert.equal(out.conversas, 2);
  assert.equal(out.fatosAtivos, 1);
  assert.equal(out.fatosPropostos, 1);
  assert.equal(out.respostasRedigidas, 1, 'pergunta repetida 2x ganha rascunho no nível 2');
  assert.equal(out.avaliadas, 2);
  assert.ok(calls.filter((c) => c.task === 'avaliar').every((c) => c.exclude.includes('gemini')), 'juíza nunca é o Gemini');
  assert.deepEqual(await learning.runLearningCycle({ empresaId: IDS.empresa, dia: DIA, router: fakeRouter([]), consentMap }), { skipped: true, reason: 'ja_executado' });
  assert.equal((await memory.customerMemory(IDS.empresa, PHONE2)).facts.length, 0, 'sem consentimento de personalização, nenhum fato');
  assert.equal((await memory.customerMemory(IDS.empresa, PHONE2)).summaries.length, 1, 'mas a conversa é resumida');

  const mem = await memory.customerMemory(IDS.empresa, PHONE);
  assert.equal(mem.facts.length, 2);
  assert.ok(!mem.facts.some((f) => /alergia/.test(f.valor)), 'fato de saúde descartado');
  assert.equal(mem.summaries[0].resultado, 'agendou');
  assert.equal(mem.summaries[0].nota, 4);

  const prompt = await memory.memoryForPrompt(IDS.empresa, PHONE);
  assert.deepEqual(prompt.fatos.map((f) => f.valor), ['sábado de manhã'], 'só fatos ativos vão para o atendimento');

  // Contestar: não volta mesmo que a IA extraia de novo
  const ativo = mem.facts.find((f) => f.status === 'ativo');
  await memory.setFactStatus(IDS.empresa, ativo.id, 'contestado', 'teste');
  await memory.upsertFacts(db.query.bind(db), { empresaId: IDS.empresa, telefone: PHONE, autonomia: 1, facts: [{ chave: 'horario_preferido', valor: 'sábado de manhã', categoria: 'preferencia_horario', confianca: 0.99 }] });
  assert.equal((await memory.customerMemory(IDS.empresa, PHONE)).facts.find((f) => f.id === ativo.id).status, 'contestado');

  // Proposta: não aprova com [CONFERIR]; aprova com texto final e vira resposta da equipe
  const [proposal] = await learning.listProposals(IDS.empresa);
  assert.equal(proposal.ocorrencias, 2);
  await assert.rejects(learning.decideProposal(IDS.empresa, proposal.id, { decisao: 'aprovado' }), /CONFERIR/);
  await learning.decideProposal(IDS.empresa, proposal.id, { decisao: 'aprovado', proposta: 'Sim, estacionamento gratuito em frente à barbearia.', operador: 'teste' });
  assert.deepEqual(await memory.approvedAnswers(IDS.empresa), [{ pergunta: 'Vocês têm estacionamento?', resposta: 'Sim, estacionamento gratuito em frente à barbearia.' }]);

  const quality = await learning.learningQuality(IDS.empresa, 3650);
  assert.equal(quality.conversas, 2);
  assert.equal(quality.notaMedia, 4);

  const busca = await memory.searchCustomerMemory(IDS.empresa, PHONE, 'estacionamento');
  assert.equal(busca.length, 1);

  // Automação: enfileira uma vez, não repete, e respeita o horário silencioso
  const planned = [{ automacao: 'reativacao', telefone: PHONE2, referencia: 'ciclo:2026-08-01', variante: 'A', mensagem: 'Oi! teste\n\nPara não receber estas mensagens, responda SAIR.' }];
  assert.equal((await automations.enqueueAutomations(IDS.empresa, IDS.loja, planned, { quiet: true })).reason, 'horario_silencioso');
  assert.equal((await automations.enqueueAutomations(IDS.empresa, IDS.loja, planned, {})).queued, 1);
  assert.equal((await automations.enqueueAutomations(IDS.empresa, IDS.loja, planned, {})).queued, 0);
  const task = await db.query(`SELECT * FROM tarefas_integracao_canais WHERE empresa_id = $1 AND tipo = 'automacao_ia'`, [IDS.empresa]);
  assert.equal(task.rows.length, 1);
  const guards = await automations.automationGuards(IDS.empresa);
  assert.equal(guards.sentToday, 1);
  assert.ok(guards.recentMarketing.has(PHONE2));

  // Opt-out permanente aparece no mapa de consentimentos mesmo sem sessão
  await memory.recordAutomationOptOut(db.query.bind(db), IDS.empresa, PHONE2, 'teste');
  assert.equal((await memory.whatsappConsentMap(IDS.empresa)).get(PHONE2).optOut, true);
  assert.equal((await automations.sendTimeConsent(IDS.empresa, PHONE2, 'atendimento', { localClients: [] })).reason, 'opt_out');

  // Automação desligada antes do envio: bloqueia sem mandar
  await memory.saveBrainSettings(IDS.empresa, { automacoes: { reativacao: false } });
  const processed = await automations.processAutomationTask({ ...task.rows[0], payload: task.rows[0].payload });
  assert.equal(processed.reason, 'automation_disabled');

  // Esquecer: apaga fatos, resumos, avaliações, automações e conversas
  const forgot = await memory.forgetCustomer(IDS.empresa, PHONE);
  assert.ok(forgot.removidos.fatos >= 2 && forgot.removidos.resumos === 1 && forgot.removidos.conversas === 1, JSON.stringify(forgot));
  const forgot2 = await memory.forgetCustomer(IDS.empresa, PHONE2);
  assert.equal(forgot2.removidos.mensagensNaFila, 1, 'mensagem pendente na fila é cancelada e esvaziada');
  const cancelled = await db.query(`SELECT status, payload FROM tarefas_integracao_canais WHERE empresa_id = $1 AND tipo = 'automacao_ia'`, [IDS.empresa]);
  assert.deepEqual([cancelled.rows[0].status, cancelled.rows[0].payload], ['cancelada', {}]);
  assert.equal((await memory.whatsappConsentMap(IDS.empresa)).get(PHONE2).optOut, true, 'opt-out sobrevive ao esquecimento');
  const after = await memory.customerMemory(IDS.empresa, PHONE);
  assert.equal(after.facts.length + after.summaries.length, 0);
});

test.after(async () => { if (!skip) await (await import('./database.js')).getPool().end().catch(() => null); });

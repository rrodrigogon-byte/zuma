import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Set isolation before importing any app module: even a standalone invocation
// must never reset the repository fixture or a production path supplied by env.
if (process.env.NODE_ENV === 'production') throw new Error('Contrato sintético proibido em NODE_ENV=production');
const TEMP_DIR = mkdtempSync(join(tmpdir(), 'dino-agenda-contract-'));
process.env.NODE_ENV = 'test';
process.env.DB_PATH = join(TEMP_DIR, 'db.json');
process.env.GCS_BUCKET = '';
const publicAgendaRouterModule = await import('../modules/barbearia/routes-publico.js');
const barbearia = await import('../barbearia-erp-kytto.js');
const { db: legacyDb, reset } = await import('../db.js');
const { db: pgDb } = await import('./database.js');
const { agendaSource, availability, createAppointment, limparCacheFonteAgenda } = await import('./barbershop-agenda.js');
const { createWhatsappAiToolExecutor } = await import('./whatsapp-ai-tools.js');

const EMPRESA_A = '11111111-1111-4111-8111-111111111111';
const EMPRESA_B = '22222222-2222-4222-8222-222222222222';
const LOJA_A = '33333333-3333-4333-8333-333333333333';
const LOJA_B = '44444444-4444-4444-8444-444444444444';
const CANAL = '55555555-5555-4555-8555-555555555555';
const SESSAO = '66666666-6666-4666-8666-666666666666';
const ORIGINAL_SOURCE = process.env.BARBEARIA_AGENDA_FONTE;
const publicRouter = publicAgendaRouterModule.default;

function nextBusinessDate() {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + 7);
  while (value.getUTCDay() === 0) value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function seedEnterprise(empresaId, slug, lojaId, { serviceName, professionalName } = {}) {
  barbearia.atualizarConfiguracao(empresaId, {
    slugPublico: slug,
    nomePublico: `Contrato ${slug}`,
    lojaPublicaId: lojaId,
    horarioAbertura: '08:00',
    horarioFechamento: '20:00',
    intervaloMinutos: 30,
    antecedenciaMinutos: 0,
    janelaReservaDias: 90,
  });
  const professional = barbearia.criarProfissional(empresaId, {
    nome: professionalName || `Profissional ${slug}`,
    horarioInicio: '08:00',
    horarioFim: '20:00',
    diasTrabalho: [1, 2, 3, 4, 5, 6],
  });
  const service = barbearia.criarServico(empresaId, {
    nome: serviceName || `Serviço ${slug}`,
    duracaoMinutos: 45,
    preco: 60,
    permiteAgendamentoOnline: true,
  });
  return { professional, service };
}

function responseCapture() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function publicAvailabilityHandler() {
  const layer = publicRouter.stack.find((entry) => entry.route?.path === '/:slug/horarios' && entry.route.methods.get);
  assert.ok(layer, 'binding público de disponibilidade não encontrado');
  return layer.route.stack.at(-1).handle;
}

function readAdminSlots(empresaId, lojaId, serviceId, professionalId, date) {
  return barbearia.listarHorariosDisponiveis(empresaId, {
    data: date,
    servicoId: serviceId,
    profissionalId: professionalId,
    lojaId,
  }).filter((item) => item.disponivel).map((item) => item.horario);
}

async function readPublicSlots(slug, serviceId, professionalId, date) {
  const response = responseCapture();
  publicAvailabilityHandler()({
    params: { slug },
    query: { servico_id: serviceId, profissional_id: professionalId, data: date },
  }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body?.ok, true);
  return response.body.horarios.filter((item) => item.disponivel).map((item) => item.horario);
}

function aiContext(empresaId, lojaId) {
  return {
    empresaId,
    lojaId,
    canalId: CANAL,
    sessionId: SESSAO,
    phone: '65999990000',
    customerName: 'Cliente contrato',
    legacyEmpresaId: empresaId,
  };
}

beforeEach(() => {
  process.env.BARBEARIA_AGENDA_FONTE = 'barbearia';
  reset();
  limparCacheFonteAgenda();
});

after(() => {
  reset();
  rmSync(TEMP_DIR, { recursive: true, force: true });
  limparCacheFonteAgenda();
  if (ORIGINAL_SOURCE === undefined) delete process.env.BARBEARIA_AGENDA_FONTE;
  else process.env.BARBEARIA_AGENDA_FONTE = ORIGINAL_SOURCE;
});

test('contrato JSON: admin, link público e ferramenta IA retornam o mesmo slot, duração e bloqueio', async () => {
  const date = nextBusinessDate();
  const { professional, service } = seedEnterprise(EMPRESA_A, 'agenda-contract', LOJA_A, {
    serviceName: 'Corte contrato',
    professionalName: 'Profissional contrato',
  });
  assert.equal(await agendaSource(aiContext(EMPRESA_A, LOJA_A)), 'barbearia');

  const adminBefore = readAdminSlots(EMPRESA_A, LOJA_A, service.id, professional.id, date);
  const publicBefore = await readPublicSlots('agenda-contract', service.id, professional.id, date);
  const aiBefore = await createWhatsappAiToolExecutor(aiContext(EMPRESA_A, LOJA_A))(
    'consultar_disponibilidade', { serviceId: service.id, professionalId: professional.id, date },
  );
  assert.deepEqual(publicBefore, adminBefore);
  assert.deepEqual(aiBefore.disponibilidade.slots, adminBefore);
  assert.equal(aiBefore.disponibilidade.service.duracaoMinutos, 45);
  assert.equal(aiBefore.disponibilidade.date, date);
  assert.ok(adminBefore.includes('10:00'), 'fixture deve começar com o slot de controle livre');

  barbearia.criarBloqueio(EMPRESA_A, {
    titulo: 'Bloqueio contrato',
    inicio: `${date}T10:00:00-04:00`,
    fim: `${date}T10:45:00-04:00`,
    profissionalId: professional.id,
    lojaId: LOJA_A,
  });
  const adminAfter = readAdminSlots(EMPRESA_A, LOJA_A, service.id, professional.id, date);
  const publicAfter = await readPublicSlots('agenda-contract', service.id, professional.id, date);
  const aiAfter = await createWhatsappAiToolExecutor(aiContext(EMPRESA_A, LOJA_A))(
    'consultar_disponibilidade', { serviceId: service.id, professionalId: professional.id, date },
  );
  assert.deepEqual(publicAfter, adminAfter);
  assert.deepEqual(aiAfter.disponibilidade.slots, adminAfter);
  assert.equal(adminAfter.includes('10:00'), false);
  assert.equal(adminAfter.includes('10:30'), false, 'duração de 45 min respeita sobreposição do bloqueio');
  assert.equal(legacyDb().barbearias[EMPRESA_A].bloqueios !== undefined, true);
});

test('contrato JSON: retry com actionId é idempotente e conflito/bloqueio não grava segundo atendimento', async () => {
  const date = nextBusinessDate();
  const { professional, service } = seedEnterprise(EMPRESA_A, 'agenda-retry', LOJA_A);
  const scope = aiContext(EMPRESA_A, LOJA_A);
  const input = {
    date,
    time: '11:00',
    serviceId: service.id,
    professionalId: professional.id,
    customerName: 'Cliente retry',
    customerPhone: '65999990001',
    actionId: 'contract-retry-001',
  };
  const first = await createAppointment({}, scope, input);
  const retry = await createAppointment({}, scope, input);
  assert.equal(retry.id, first.id);
  assert.equal(barbearia.listarAgendamentos(EMPRESA_A, { lojaId: LOJA_A }).filter((item) => item.id === first.id).length, 1);

  await assert.rejects(
    () => createAppointment({}, scope, { ...input, actionId: 'contract-conflict-002', customerPhone: '65999990002' }),
    (error) => error.code === 'SLOT_UNAVAILABLE',
  );
  barbearia.criarBloqueio(EMPRESA_A, {
    titulo: 'Bloqueio retry',
    inicio: `${date}T12:00:00-04:00`,
    fim: `${date}T12:45:00-04:00`,
    profissionalId: professional.id,
    lojaId: LOJA_A,
  });
  await assert.rejects(
    () => createAppointment({}, scope, { ...input, time: '12:00', actionId: 'contract-block-003', customerPhone: '65999990003' }),
    (error) => error.code === 'SLOT_UNAVAILABLE',
  );
  assert.equal(barbearia.listarAgendamentos(EMPRESA_A, { lojaId: LOJA_A }).length, 1);
});

test('replay divergente ou em outra unidade é bloqueado sem devolver reserva nem gravar novo atendimento', async () => {
  const date = nextBusinessDate();
  const { professional, service } = seedEnterprise(EMPRESA_A, 'agenda-replay-scope', LOJA_A);
  const scope = aiContext(EMPRESA_A, LOJA_A);
  const input = { date, time: '11:00', serviceId: service.id, professionalId: professional.id,
    customerName: 'Cliente replay', customerPhone: '65999990004', actionId: 'scope-replay-001' };
  const first = await createAppointment({}, scope, input);
  for (const delta of [{ time: '13:00' }, { serviceId: 'outro-servico' }, { professionalId: 'outro-profissional' },
    { customerPhone: '65999990005' }, { customerName: 'Outro cliente' }, { notes: 'conteudo alterado' }]) {
    await assert.rejects(() => createAppointment({}, scope, { ...input, ...delta }), error => error.code === 'IDEMPOTENCY_CONFLICT');
  }
  await assert.rejects(() => createAppointment({}, aiContext(EMPRESA_A, LOJA_B), input), error => error.code === 'IDEMPOTENCY_CONFLICT');
  const records = barbearia.listarAgendamentos(EMPRESA_A, {});
  assert.equal(records.length, 1);
  assert.equal(records[0].id, first.id);
});

test('isolamento de empresa e unidade: ocupação não cruza escopo', async () => {
  const date = nextBusinessDate();
  const a = seedEnterprise(EMPRESA_A, 'agenda-isolation-a', LOJA_A);
  const b = seedEnterprise(EMPRESA_B, 'agenda-isolation-b', LOJA_B);
  barbearia.criarBloqueio(EMPRESA_A, {
    titulo: 'Somente unidade A',
    inicio: `${date}T10:00:00-04:00`,
    fim: `${date}T10:45:00-04:00`,
    profissionalId: a.professional.id,
    lojaId: LOJA_A,
  });
  assert.equal(readAdminSlots(EMPRESA_A, LOJA_A, a.service.id, a.professional.id, date).includes('10:00'), false);
  assert.equal(readAdminSlots(EMPRESA_A, LOJA_B, a.service.id, a.professional.id, date).includes('10:00'), true);
  assert.equal(readAdminSlots(EMPRESA_B, LOJA_B, b.service.id, b.professional.id, date).includes('10:00'), true);
  const otherUnit = await availability(aiContext(EMPRESA_A, LOJA_B), {
    serviceId: a.service.id, professionalId: a.professional.id, date,
  });
  assert.equal(otherUnit.slots.includes('10:00'), true);
  assert.equal(await agendaSource(aiContext(EMPRESA_B, LOJA_B)), 'barbearia');
});

test('fonte PostgreSQL mockada: somente o binding real da IA é verificável sem alegar banco real', async () => {
  const previousSource = process.env.BARBEARIA_AGENDA_FONTE;
  const originalQueryRead = pgDb.queryRead;
  const date = nextBusinessDate();
  const queries = [];
  process.env.BARBEARIA_AGENDA_FONTE = 'postgres';
  limparCacheFonteAgenda();
  pgDb.queryRead = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('FROM servicos')) return { rows: [{ id: '77777777-7777-4777-8777-777777777777', nome: 'Corte PG', duracao_minutos: 45, preco: 60 }] };
    if (sql.includes('FROM usuarios')) return { rows: [{ id: '88888888-8888-4888-8888-888888888888', nome_completo: 'Profissional PG' }] };
    return { rows: [{ inicio: `${date}T10:00:00`, fim: `${date}T10:45:00` }] };
  };
  try {
    const scope = aiContext(EMPRESA_A, LOJA_A);
    assert.equal(await agendaSource(scope), 'postgres');
    const direct = await availability(scope, {
      serviceId: '77777777-7777-4777-8777-777777777777',
      professionalId: '88888888-8888-4888-8888-888888888888',
      date,
    });
    const ai = await createWhatsappAiToolExecutor(scope)('consultar_disponibilidade', {
      serviceId: '77777777-7777-4777-8777-777777777777',
      professionalId: '88888888-8888-4888-8888-888888888888',
      date,
    });
    assert.deepEqual(ai.disponibilidade.slots, direct.slots);
    assert.equal(direct.slots.includes('10:00'), false);
    assert.equal(direct.service.duracaoMinutos, 45);
    assert.ok(queries.length >= 3);
    assert.equal(queries.some(({ sql }) => /\b(INSERT|UPDATE|DELETE)\b/i.test(sql)), false);
  } finally {
    pgDb.queryRead = originalQueryRead;
    if (previousSource === undefined) delete process.env.BARBEARIA_AGENDA_FONTE;
    else process.env.BARBEARIA_AGENDA_FONTE = previousSource;
    limparCacheFonteAgenda();
  }
});

test('gate não verificável: equivalência admin/link público contra engine PostgreSQL', { skip: 'admin e link público ainda estão ligados ao motor JSON; não comparar clones nem mascarar divergência de fonte' }, () => {});

test('concorrência cross-source não é afirmada: JSON não oferece lock transacional', { skip: 'runtime JSON usa gravação em arquivo sem lock transacional; concorrência real requer PostgreSQL descartável' }, () => {});

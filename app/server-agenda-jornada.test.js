import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import test from 'node:test';

const APP_ROOT = path.resolve(new URL('.', import.meta.url).pathname);
const SENHA = 'fixture-agenda-http-only-pass';
const EMPRESA_A = '11111111-1111-4111-8111-111111111111';
const EMPRESA_B = '22222222-2222-4222-8222-222222222222';
const LOJA_A = '33333333-3333-4333-8333-333333333333';
const LOJA_A2 = '55555555-5555-4555-8555-555555555555';
const LOJA_B = '44444444-4444-4444-8444-444444444444';
const CANAL = '66666666-6666-4666-8666-666666666666';
const SESSAO = '77777777-7777-4777-8777-777777777777';
const USER_A = 'user-agenda-a.invalid';
const USER_A2 = 'user-agenda-a2.invalid';
const USER_B = 'user-agenda-b.invalid';

function futureBusinessDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 7);
  while (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function commonEnv(dbPath, port = '') {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    LANG: 'C.UTF-8',
    TZ: 'UTC',
    NODE_ENV: 'test',
    DB_PATH: dbPath,
    ...(port ? { PORT: String(port) } : {}),
    JWT_SECRET: 'fixture-agenda-http-only-jwt-secret',
    COMMERCE_CORE_ENABLED: '0',
    SEED_DEMO: '0',
    GCS_BUCKET: '',
    BARBEARIA_AGENDA_FONTE: 'barbearia',
    KYTTO_TIMEZONE: 'America/Cuiaba',
    WPP_BASE_URL: '',
    WPP_APIKEY: '',
    WPP_INSTANCE: '',
    FEATURE_WHATSAPP: 'false',
    FEATURE_WHATSAPP_AI: 'false',
    AI_API_KEY: '',
    OPENAI_API_KEY: '',
    GEMINI_API_KEY: '',
    EVOLUTION_API_URL: '',
    EVOLUTION_API_KEY: '',
    WHATSAPP_AI_WEBHOOK_SECRET: '',
    WHATSAPP_AI_MAINTENANCE_INTERVAL_MS: '86400000',
    DINO_RESUMO_DIARIO: 'off',
  };
}

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, {
    ...options,
    headers: { ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) },
  });
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  return { response, body };
}

function jsonBody(value) {
  return JSON.stringify(value);
}

async function waitForServer(base, process) {
  const started = Date.now();
  let lastError = '';
  while (Date.now() - started < 15000) {
    if (process.exitCode !== null) throw new Error(`server.js encerrou antes do healthcheck (${process.exitCode}): ${lastError}`);
    try {
      const result = await request(base, '/health');
      if (result.response.ok && result.body.status === 'ready') return;
      lastError = JSON.stringify(result.body);
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`tempo excedido aguardando server.js: ${lastError}`);
}

async function stopServer(process) {
  if (process.exitCode !== null) return;
  process.kill('SIGTERM');
  await Promise.race([once(process, 'exit'), new Promise((resolve) => setTimeout(resolve, 3000))]);
  if (process.exitCode === null) process.kill('SIGKILL');
}

function runFreshNode(dbPath, source) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', source], {
      cwd: APP_ROOT,
      env: commonEnv(dbPath),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const timeout = setTimeout(() => child.kill('SIGKILL'), 15000);
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(`fresh Node falhou (${code ?? signal}): ${stderr}\n${stdout}`));
      try {
        const lines = stdout.trim().split('\n').filter(Boolean);
        resolve(JSON.parse(lines.at(-1) || '{}'));
      } catch (error) {
        reject(new Error(`fresh Node não devolveu JSON: ${error.message}\nstdout=${stdout}\nstderr=${stderr}`));
      }
    });
  });
}

async function readDb(dbPath) {
  return runFreshNode(dbPath, "import { db } from './db.js'; console.log(JSON.stringify(db()));");
}

function aiSource(scope, operation) {
  const scopeLiteral = JSON.stringify(scope);
  const operationLiteral = JSON.stringify(operation);
  return `
    import { createWhatsappAiToolExecutor } from './core/whatsapp-ai-tools.js';
    import { createAppointment } from './core/barbershop-agenda.js';
    const scope = ${scopeLiteral};
    const operation = ${operationLiteral};
    const execute = createWhatsappAiToolExecutor(scope);
    const output = {};
    output.availability = await execute('consultar_disponibilidade', {
      serviceId: operation.serviceId,
      professionalId: operation.professionalId,
      date: operation.date,
    });
    if (operation.input) {
      const first = await createAppointment({}, scope, operation.input);
      const retry = await createAppointment({}, scope, operation.input);
      output.first = first;
      output.retry = retry;
      try {
        await createAppointment({}, scope, { ...operation.input, time: operation.divergentTime });
        output.divergent = { ok: true };
      } catch (error) {
        output.divergent = { ok: false, code: error.code || '', message: error.message };
      }
    }
    process.stdout.write(JSON.stringify(output));
    process.exit(0);
  `;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

function assertOk(result, expected = 200) {
  assert.equal(result.response.status, expected, JSON.stringify(result.body));
  return result.body;
}

test('server.js real por HTTP fecha jornada de agenda JSON isolada e IA local simulada', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dino-agenda-http-'));
  const dbPath = path.join(directory, 'db.json');
  const port = 32500 + Math.floor(Math.random() * 400);
  const base = `http://127.0.0.1:${port}`;
  const senhaHash = bcrypt.hashSync(SENHA, 4);
  fs.writeFileSync(dbPath, JSON.stringify({
    seq: 1,
    usuarios: [
      { id: USER_A, nome: 'Gestor Agenda A .invalid', email: USER_A, senhaHash, role: 'admin', ativo: true, empresaId: EMPRESA_A, lojaId: LOJA_A },
      { id: USER_A2, nome: 'Gestor Agenda A2 .invalid', email: USER_A2, senhaHash, role: 'admin', ativo: true, empresaId: EMPRESA_A, lojaId: LOJA_A2 },
      { id: USER_B, nome: 'Gestor Agenda B .invalid', email: USER_B, senhaHash, role: 'admin', ativo: true, empresaId: EMPRESA_B, lojaId: LOJA_B },
    ],
  }));
  const server = spawn(process.execPath, ['server.js'], {
    cwd: APP_ROOT,
    env: commonEnv(dbPath, port),
    stdio: 'ignore',
  });
  const date = futureBusinessDate();
  const schedule = {
    horarioAbertura: '08:00',
    horarioFechamento: '20:00',
    intervaloMinutos: 30,
    diasFuncionamento: [1, 2, 3, 4, 5, 6],
    antecedenciaMinutos: 0,
    janelaReservaDias: 90,
    politicaCancelamentoHoras: 4,
    lojaPublicaId: LOJA_A,
    slugPublico: 'agenda-http-jornada',
    nomePublico: 'Agenda HTTP Fixture .invalid',
    agendamentoPublicoAtivo: true,
  };

  try {
    await waitForServer(base, server);

    const loginA = assertOk(await request(base, '/api/admin/login', {
      method: 'POST',
      body: jsonBody({ user: USER_A, pass: SENHA }),
    }));
    const loginA2 = assertOk(await request(base, '/api/admin/login', {
      method: 'POST',
      body: jsonBody({ user: USER_A2, pass: SENHA }),
    }));
    const loginB = assertOk(await request(base, '/api/admin/login', {
      method: 'POST',
      body: jsonBody({ user: USER_B, pass: SENHA }),
    }));
    const headersA = auth(loginA.token);
    const headersA2 = auth(loginA2.token);
    const headersB = auth(loginB.token);

    assert.equal(assertOk(await request(base, '/api/admin/barbearia/configuracoes', { headers: headersA })).configuracao.slugPublico || '', '');
    const configA = assertOk(await request(base, '/api/admin/barbearia/configuracoes', {
      method: 'PATCH', headers: headersA, body: jsonBody(schedule),
    }));
    assert.equal(configA.configuracao.slugPublico, 'agenda-http-jornada');
    assert.equal(configA.configuracao.lojaPublicaId, LOJA_A);
    assert.equal(assertOk(await request(base, '/api/admin/barbearia/configuracoes/unidade-ativa', { headers: headersA })).lojaId, LOJA_A);
    assert.equal(assertOk(await request(base, '/api/admin/barbearia/configuracoes/unidade-ativa', { headers: headersA2 })).lojaId, LOJA_A2);

    const professionalA = assertOk(await request(base, '/api/admin/barbearia/profissionais', {
      method: 'POST', headers: headersA,
      body: jsonBody({ nome: 'Profissional HTTP .invalid', horarioInicio: '08:00', horarioFim: '20:00', diasTrabalho: [1, 2, 3, 4, 5, 6] }),
    }), 201).profissional;
    const serviceA = assertOk(await request(base, '/api/admin/barbearia/servicos', {
      method: 'POST', headers: headersA,
      body: jsonBody({ nome: 'Serviço HTTP .invalid', duracaoMinutos: 45, preco: 60, permiteAgendamentoOnline: true }),
    }), 201).servico;
    assert.equal(serviceA.duracaoMinutos, 45);

    const blocked = assertOk(await request(base, '/api/admin/barbearia/bloqueios', {
      method: 'POST', headers: headersA,
      body: jsonBody({ titulo: 'Bloqueio HTTP .invalid', inicio: `${date}T10:00:00-04:00`, fim: `${date}T10:45:00-04:00`, profissionalId: professionalA.id }),
    }), 201).bloqueio;
    assert.equal(blocked.profissionalId, professionalA.id);
    assert.equal(blocked.lojaId, LOJA_A);

    // Same company, different signed unit: the real admin router accepts a separate
    // appointment and must not make it visible in LOJA_A.
    const unitBAppointment = assertOk(await request(base, '/api/admin/barbearia/agenda', {
      method: 'POST', headers: headersA2,
      body: jsonBody({
        clienteNome: 'Cliente unidade B .invalid', clienteTelefone: '65999990888',
        profissionalId: professionalA.id, servicoId: serviceA.id,
        dataHora: `${date}T17:00:00-04:00`, dataAgenda: date, horaLocal: '17:00',
        status: 'agendado', notificarCliente: false,
      }),
    }), 201);
    assert.equal(unitBAppointment.agendamento.lojaId, LOJA_A2);
    assert.deepEqual(unitBAppointment.notificacao, { queued: 0, skipped: true, reason: 'customer_notification_disabled_by_staff' });

    const publicRoot = assertOk(await request(base, '/api/publico/agendamento/agenda-http-jornada'));
    assert.equal(publicRoot.estabelecimento.slug, 'agenda-http-jornada');
    assert.equal(publicRoot.estabelecimento.nome, 'Agenda HTTP Fixture .invalid');
    assert.equal(publicRoot.servicos.find((item) => item.id === serviceA.id).duracao_min, 45);
    assert.equal(publicRoot.profissionais.find((item) => item.id === professionalA.id).nome, 'Profissional HTTP .invalid');

    const adminBefore = assertOk(await request(base, `/api/admin/barbearia/horarios-livres?de=${date}&ate=${date}&servicoId=${encodeURIComponent(serviceA.id)}&profissionalId=${encodeURIComponent(professionalA.id)}`, { headers: headersA }));
    const adminItem = adminBefore.itens.find((item) => item.data === date && item.profissionalId === professionalA.id);
    assert.ok(adminItem);
    assert.equal(adminItem.horarios.includes('10:00'), false);
    assert.equal(adminItem.horarios.includes('10:30'), false, 'a duração de 45 min respeita o bloqueio seguinte');
    assert.ok(adminItem.horarios.includes('09:00'));
    assert.equal(adminItem.horarios.includes('17:00'), true, 'a reserva da unidade irmã não bloqueia LOJA_A');

    const publicBefore = assertOk(await request(base, `/api/publico/agendamento/agenda-http-jornada/horarios?servico_id=${encodeURIComponent(serviceA.id)}&profissional_id=${encodeURIComponent(professionalA.id)}&data=${date}`));
    const publicSlots = publicBefore.horarios.filter((item) => item.disponivel).map((item) => item.horario);
    assert.deepEqual(publicSlots, adminItem.horarios);
    assert.equal(publicBefore.horarios.find((item) => item.horario === '10:00').disponivel, false);
    assert.equal(publicBefore.horarios.find((item) => item.horario === '10:30').disponivel, false);

    const scope = {
      empresaId: EMPRESA_A, legacyEmpresaId: EMPRESA_A, lojaId: LOJA_A,
      canalId: CANAL, sessionId: SESSAO, phone: '65999990101', customerName: 'Cliente IA HTTP .invalid',
    };
    const aiBefore = await runFreshNode(dbPath, aiSource(scope, { serviceId: serviceA.id, professionalId: professionalA.id, date }));
    assert.deepEqual(aiBefore.availability.disponibilidade.slots, adminItem.horarios);
    assert.equal(aiBefore.availability.disponibilidade.service.duracaoMinutos, 45);
    assert.equal(aiBefore.availability.disponibilidade.date, date);

    const publicTime = '09:00';
    const publicPayload = {
      servico_id: serviceA.id, profissional_id: professionalA.id, data: date, horario: publicTime,
      cliente_nome: 'Cliente público HTTP .invalid', cliente_telefone: '65999990202',
    };
    const confirmed = assertOk(await request(base, '/api/publico/agendamento/agenda-http-jornada/confirmar', {
      method: 'POST', body: jsonBody(publicPayload),
    }), 201);
    assert.equal(confirmed.agendamento.status, 'agendado');
    const publicCode = confirmed.agendamento.codigo;
    const duplicate = await request(base, '/api/publico/agendamento/agenda-http-jornada/confirmar', {
      method: 'POST', body: jsonBody(publicPayload),
    });
    assert.equal(duplicate.response.status, 409, JSON.stringify(duplicate.body));
    const slotConflict = await request(base, '/api/publico/agendamento/agenda-http-jornada/confirmar', {
      method: 'POST', body: jsonBody({ ...publicPayload, cliente_nome: 'Outro cliente HTTP .invalid', cliente_telefone: '65999990303' }),
    });
    assert.equal(slotConflict.response.status, 409, JSON.stringify(slotConflict.body));

    const aiAfterPublic = await runFreshNode(dbPath, aiSource(scope, { serviceId: serviceA.id, professionalId: professionalA.id, date }));
    assert.equal(aiAfterPublic.availability.disponibilidade.slots.includes(publicTime), false);
    const aiTime = '11:00';
    assert.ok(aiAfterPublic.availability.disponibilidade.slots.includes(aiTime));

    const adminAfterPublic = assertOk(await request(base, `/api/admin/barbearia/agenda?data=${date}`, { headers: headersA }));
    assert.equal(adminAfterPublic.agendamentos.filter((item) => item.lojaId === LOJA_A).length, 1);
    assert.equal(adminAfterPublic.agendamentos.find((item) => item.id === confirmed.agendamento.id).duracaoMinutos, 45);
    assert.equal(adminAfterPublic.agendamentos.some((item) => item.lojaId === LOJA_A2), false);
    const adminUnitB = assertOk(await request(base, `/api/admin/barbearia/agenda?data=${date}`, { headers: headersA2 }));
    assert.equal(adminUnitB.agendamentos.length, 1);
    assert.equal(adminUnitB.agendamentos[0].lojaId, LOJA_A2);
    const adminOtherCompany = assertOk(await request(base, `/api/admin/barbearia/agenda?data=${date}`, { headers: headersB }));
    assert.equal(adminOtherCompany.agendamentos.length, 0);
    const hiddenAppointment = await request(base, `/api/admin/barbearia/agenda/${encodeURIComponent(confirmed.agendamento.id)}`, { headers: headersB });
    assert.equal(hiddenAppointment.response.status, 404);

    const publicAfterConfirm = assertOk(await request(base, `/api/publico/agendamento/agenda-http-jornada/horarios?servico_id=${encodeURIComponent(serviceA.id)}&profissional_id=${encodeURIComponent(professionalA.id)}&data=${date}`));
    const replacementTime = publicAfterConfirm.horarios.filter((item) => item.disponivel).map((item) => item.horario)
      .find((time) => !['10:00', publicTime, aiTime].includes(time));
    assert.ok(replacementTime);
    const moved = assertOk(await request(base, '/api/publico/agendamento/agenda-http-jornada/meu-agendamento/remarcar', {
      method: 'POST', body: jsonBody({ codigo: publicCode, cliente_telefone: publicPayload.cliente_telefone, data: date, horario: replacementTime }),
    }));
    assert.equal(moved.agendamento.status, 'agendado');
    assert.equal(moved.agendamento.dataAgenda, date);
    assert.equal(moved.agendamento.horaLocal, replacementTime);
    const canceled = assertOk(await request(base, '/api/publico/agendamento/agenda-http-jornada/meu-agendamento/cancelar', {
      method: 'POST', body: jsonBody({ codigo: publicCode, cliente_telefone: publicPayload.cliente_telefone, motivo: 'fixture HTTP .invalid' }),
    }));
    assert.equal(canceled.agendamento.status, 'cancelado');
    const integrations = assertOk(await request(base, '/api/admin/barbearia/integracoes', { headers: headersA }));
    assert.equal(integrations.ia.configurada, false);
    assert.equal(integrations.whatsapp.credencialConfigurada, false);
    assert.equal(integrations.whatsapp.envioManualDisponivel, false);
    const publicAfterCancel = assertOk(await request(base, `/api/publico/agendamento/agenda-http-jornada/horarios?servico_id=${encodeURIComponent(serviceA.id)}&profissional_id=${encodeURIComponent(professionalA.id)}&data=${date}`));
    assert.equal(publicAfterCancel.horarios.find((item) => item.horario === replacementTime).disponivel, true);

    // The simulated AI is deliberately a clean child process, not a webhook or
    // chatbot HTTP call. No server HTTP request follows this write: server.js has
    // an in-memory JSON cache, so persisted-state checks use another fresh child.
    const aiAction = await runFreshNode(dbPath, aiSource(scope, {
      serviceId: serviceA.id, professionalId: professionalA.id, date, divergentTime: '12:00',
      input: {
        date, time: aiTime, serviceId: serviceA.id, professionalId: professionalA.id,
        customerName: 'Cliente IA HTTP .invalid', customerPhone: scope.phone, actionId: 'http-journey-confirm-001',
      },
    }));
    assert.equal(aiAction.first.status, 'agendado');
    assert.equal(aiAction.first.duracaoMinutos, 45);
    assert.equal(aiAction.retry.id, aiAction.first.id);
    assert.equal(aiAction.divergent.ok, false);
    assert.equal(aiAction.divergent.code, 'IDEMPOTENCY_CONFLICT');
    const aiAfter = await runFreshNode(dbPath, aiSource(scope, { serviceId: serviceA.id, professionalId: professionalA.id, date }));
    assert.equal(aiAfter.availability.disponibilidade.slots.includes(aiTime), false);
    assert.equal(aiAfter.availability.disponibilidade.service.duracaoMinutos, 45);

    const persisted = await readDb(dbPath);
    const freshState = {
      empresaA: Object.values(persisted.barbearias?.[EMPRESA_A]?.agendamentos || {}).map((item) => ({ id: item.id, lojaId: item.lojaId, status: item.status, dataAgenda: item.dataAgenda, horaLocal: item.horaLocal, duracaoMinutos: item.duracaoMinutos })),
      empresaB: Object.values(persisted.barbearias?.[EMPRESA_B]?.agendamentos || {}).length,
      bloqueiosA: Object.values(persisted.barbearias?.[EMPRESA_A]?.bloqueios || {}).filter((item) => item.ativo !== false).map((item) => ({ lojaId: item.lojaId, profissionalId: item.profissionalId })),
    };
    assert.equal(freshState.empresaA.filter((item) => item.lojaId === LOJA_A && item.status === 'agendado').length, 1);
    assert.equal(freshState.empresaA.filter((item) => item.lojaId === LOJA_A2 && item.status === 'agendado').length, 1);
    assert.equal(freshState.empresaA.filter((item) => item.status === 'cancelado').length, 1);
    assert.equal(freshState.empresaB, 0);
    assert.deepEqual(freshState.bloqueiosA, [{ lojaId: LOJA_A, profissionalId: professionalA.id }]);
  } finally {
    await stopServer(server);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

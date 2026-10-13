import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const enabled = Boolean(process.env.DINO_AGENDA_FIXTURE && process.env.DINO_AGENDA_FIXTURE_MARKER);
test('Agenda PostgreSQL real — concorrência, bloqueio, ações e isolamento', { skip: enabled ? false : 'Execute npm run test:agenda-pg-real; somente cluster efêmero criado pelo executor é permitido' }, async t => {
  assert.equal(process.env.NODE_ENV, 'test');
  const manifestPath = realpathSync(process.env.DINO_AGENDA_FIXTURE);
  const tempRoot = realpathSync(tmpdir());
  const fixtureDir = dirname(manifestPath);
  assert.ok(fixtureDir.startsWith(join(tempRoot, 'dino-agenda-pg-')));
  const fixture = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(fixture.marker, process.env.DINO_AGENDA_FIXTURE_MARKER);
  assert.equal(realpathSync(fixture.socket), join(fixtureDir, 'socket'));
  assert.equal(fixture.database, 'dino_agenda_test');
  assert.equal(fixture.owner, 'dino_fixture_owner');
  assert.equal(fixture.port, 55432);
  // Overwrite all connection inputs before importing the real application.
  process.env.DATABASE_URL = `postgresql:///${fixture.database}?host=${encodeURIComponent(fixture.socket)}&port=${fixture.port}&user=${fixture.owner}`;
  process.env.POSTGRES_URL = process.env.DATABASE_URL;
  Object.assign(process.env, { DB_HOST: fixture.socket, DB_PORT: String(fixture.port), DB_NAME: fixture.database, DB_USER: fixture.owner, DB_PASSWORD: '', DB_SSL: 'false', DEBUG_SQL: 'false', BARBEARIA_AGENDA_FONTE: 'postgres', DB_PATH: join(fixtureDir, 'legacy.json'), GCS_BUCKET: '' });
  const { db } = await import('./database.js');
  const { createScheduledAppointment, listSchedulingAvailability, listSchedulingServices } = await import('./barbershop-scheduling.js');
  const { createWhatsappAiToolExecutor, confirmPendingAction } = await import('./whatsapp-ai-tools.js');
  const A = '11111111-1111-4111-8111-111111111111';
  const B = '22222222-2222-4222-8222-222222222222';
  const U1 = '33333333-3333-4333-8333-333333333333';
  const U2 = '44444444-4444-4444-8444-444444444444';
  const U3 = '55555555-5555-4555-8555-555555555555';
  const P1 = '66666666-6666-4666-8666-666666666666';
  const P2 = '77777777-7777-4777-8777-777777777777';
  const S1 = '88888888-8888-4888-8888-888888888888';
  const S2 = '99999999-9999-4999-8999-999999999999';
  const S3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const C = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const SESSION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const base = { serviceId: S1, professionalId: P1, date, time: '10:00', customerName: 'Cliente fixture', customerPhone: '65999990000' };
  const scope = { empresaId: A, lojaId: U1 };
  try {
    const identity = await db.queryRead('SELECT current_database() AS database, current_user AS owner');
    assert.equal(identity.rows[0].database, fixture.database);
    assert.equal(identity.rows[0].owner, fixture.owner);
    for (const [id, suffix] of [[A, '01'], [B, '02']]) await db.query('INSERT INTO empresas (id,nome,razao_social,cnpj,tipo_negocio) VALUES ($1,$2,$2,$3,\'barbearia\')', [id, `Fixture ${suffix}`, `000000000000${suffix}`]);
    for (const [id, company, code] of [[U1, A, 'u1'], [U2, A, 'u2'], [U3, B, 'u3']]) await db.query('INSERT INTO lojas(id,empresa_id,codigo,nome) VALUES ($1,$2,$3,$3)', [id, company, code]);
    for (const [id, company, alias] of [[P1, A, 'prof-a'], [P2, B, 'prof-b']]) await db.query('INSERT INTO usuarios(id,empresa_id,email,senha_hash,nome_completo,role) VALUES($1,$2,$3,\'FIXTURE_NOT_A_CREDENTIAL\',$4,\'barbeiro\')', [id, company, `${alias}@example.invalid`, alias]);
    for (const [professional, unit] of [[P1, U1], [P1, U2], [P2, U3]]) await db.query('INSERT INTO usuarios_lojas(usuario_id,loja_id,role_loja) VALUES($1,$2,\'barbeiro\')', [professional, unit]);
    for (const [id, company, unit, name] of [[S1, A, U1, 'Serviço fixture A1'], [S3, A, U2, 'Serviço fixture A2'], [S2, B, U3, 'Serviço fixture B']]) await db.query('INSERT INTO servicos(id,empresa_id,loja_id,nome,duracao_minutos,preco) VALUES($1,$2,$3,$4,45,60)', [id, company, unit, name]);
    await db.query('INSERT INTO canais_integracao(id,empresa_id,loja_id,provedor,nome) VALUES($1,$2,$3,\'whatsapp\',\'Canal fixture\')', [C, A, U1]);
    await db.query('INSERT INTO whatsapp_ai_sessions(id,empresa_id,loja_id,canal_id,remote_jid,telefone) VALUES($1,$2,$3,$4,\'fixture\',\'65999990000\')', [SESSION, A, U1, C]);

    await t.test('duas transações concorrentes para o mesmo horário criam exatamente uma reserva', async () => {
      const results = await Promise.allSettled([
        db.transaction(trx => createScheduledAppointment(trx, scope, base)),
        db.transaction(trx => createScheduledAppointment(trx, scope, { ...base, customerName: 'Cliente concorrente' })),
      ]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(results.find(r => r.status === 'rejected').reason.code, 'SLOT_UNAVAILABLE');
      const count = await db.queryRead('SELECT count(*)::int AS total FROM agendamentos WHERE empresa_id=$1 AND loja_id=$2', [A, U1]);
      assert.equal(count.rows[0].total, 1);
    });
    await t.test('duração de 45 minutos bloqueia sobreposição e mantém próximo slot livre', async () => {
      const availability = await listSchedulingAvailability(scope, base);
      assert.equal(availability.slots.includes('10:00'), false);
      assert.equal(availability.slots.includes('10:30'), false);
      assert.equal(availability.slots.includes('11:00'), true);
    });
    await t.test('bloqueio cadastrado rejeita a escrita sem nova reserva', async () => {
      await db.query('INSERT INTO agendamentos_bloqueios(empresa_id,loja_id,usuario_profissional_id,data_inicio,data_fim,motivo) VALUES($1,$2,$3,$4::timestamp,$5::timestamp,\'Fixture\')', [A, U1, P1, `${date}T12:00:00`, `${date}T12:45:00`]);
      await assert.rejects(() => db.transaction(trx => createScheduledAppointment(trx, scope, { ...base, time: '12:00' })), e => e.code === 'SLOT_UNAVAILABLE');
    });
    await t.test('unidade e tenant distintos não compartilham ocupação e IDs cruzados são rejeitados', async () => {
      const secondUnit = await db.transaction(trx => createScheduledAppointment(trx, { empresaId: A, lojaId: U2 }, { ...base, serviceId: S3 }));
      const otherTenant = await db.transaction(trx => createScheduledAppointment(trx, { empresaId: B, lojaId: U3 }, { ...base, serviceId: S2, professionalId: P2 }));
      assert.notEqual(secondUnit.id, otherTenant.id);
      const services = await listSchedulingServices({ empresaId: A, lojaId: U2 });
      assert.deepEqual(services.map(s => s.id), [S3]);
      await assert.rejects(() => listSchedulingAvailability({ empresaId: A, lojaId: U2 }, base), e => e.code === 'SERVICE_NOT_FOUND');
      await assert.rejects(() => db.transaction(trx => createScheduledAppointment(trx, { empresaId: A, lojaId: U2 }, { ...base, time: '13:00' })), e => e.code === 'SCHEDULE_SCOPE_MISMATCH');
      await assert.rejects(() => db.transaction(trx => createScheduledAppointment(trx, { empresaId: B, lojaId: U3 }, { ...base, time: '13:00' })), e => e.code === 'SCHEDULE_SCOPE_MISMATCH');
    });
    const context = { ...scope, canalId: C, sessionId: SESSION, phone: base.customerPhone, customerName: base.customerName, externalEventId: 'fixture-event-1' };
    const execute = createWhatsappAiToolExecutor(context);
    let action;
    await t.test('preparo repetido retorna a mesma ação; payload divergente é fail-closed sem reserva', async () => {
      action = await execute('preparar_agendamento', { ...base, time: '14:00' });
      const retry = await createWhatsappAiToolExecutor(context)('preparar_agendamento', { ...base, time: '14:00' });
      assert.equal(retry.acao.id, action.acao.id);
      await assert.rejects(() => createWhatsappAiToolExecutor(context)('preparar_agendamento', { ...base, time: '15:00' }), e => e.code === 'IDEMPOTENCY_CONFLICT');
      const count = await db.queryRead('SELECT count(*)::int AS total FROM whatsapp_ai_actions WHERE empresa_id=$1', [A]);
      assert.equal(count.rows[0].total, 1);
      const appointments = await db.queryRead('SELECT count(*)::int AS total FROM agendamentos WHERE empresa_id=$1 AND loja_id=$2', [A, U1]);
      assert.equal(appointments.rows[0].total, 1, 'preparo e divergência não criam reserva');
    });
    await t.test('confirmar ação e repetir resposta concluída não duplica o agendamento', async () => {
      const confirmed = await confirmPendingAction(context);
      assert.equal(confirmed.ok, true);
      const pendingLostResponse = { actionId: action.acao.id };
      // Fixture restores a pending pointer to simulate a repeated delivery after lost response.
      await db.query('UPDATE whatsapp_ai_sessions SET acao_pendente=$2::jsonb WHERE id=$1', [SESSION, JSON.stringify(pendingLostResponse)]);
      const replay = await confirmPendingAction(context);
      assert.equal(replay.id, confirmed.result.id);
      const count = await db.queryRead('SELECT count(*)::int AS total FROM agendamentos WHERE empresa_id=$1 AND loja_id=$2 AND data_agendamento=$3::timestamp', [A, U1, `${date}T14:00:00`]);
      assert.equal(count.rows[0].total, 1);
    });
    const agenda = await import('./barbershop-agenda.js');
    const barbearia = await import('../barbearia-erp-kytto.js');
    const M1 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const M2 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const M3 = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    let legacyProfessional;
    let legacyService;
    const dependencies = { query: db.query.bind(db), queryRead: db.queryRead.bind(db) };
    const pgStatus = async id => (await db.queryRead('SELECT status,loja_id,observacoes FROM agendamentos WHERE id=$1', [id])).rows[0];
    const seedPg = async (id, company, unit, service, professional, time) => db.query(
      `INSERT INTO agendamentos(id,empresa_id,loja_id,servico_id,usuario_profissional_id,cliente_nome,cliente_telefone,data_agendamento,status)
       VALUES($1,$2,$3,$4,$5,'Cliente fixture migração','65999990077',$6::timestamp,'agendado')`,
      [id, company, unit, service, professional, `${date}T${time}:00`],
    );
    await t.test('decisão automática é GET interno sem migração e cache de A1 não determina A2', async () => {
      await db.query('DELETE FROM agendamentos'); // Somente fixture efêmera já identificada.
      barbearia.atualizarConfiguracao(A, { horarioAbertura: '08:00', horarioFechamento: '20:00', intervaloMinutos: 30, diasFuncionamento: [0,1,2,3,4,5,6], antecedenciaMinutos: 0, janelaReservaDias: 90 });
      legacyProfessional = barbearia.criarProfissional(A, { nome: 'prof-a', horarioInicio: '08:00', horarioFim: '20:00', diasTrabalho: [0,1,2,3,4,5,6] });
      legacyService = barbearia.criarServico(A, { nome: 'Serviço fixture A1', preco: 60, duracaoMinutos: 45 });
      barbearia.criarServico(A, { nome: 'Serviço fixture A2', preco: 60, duracaoMinutos: 45 });
      await seedPg(M2, A, U2, S3, P1, '17:00');
      await seedPg(M3, B, U3, S2, P2, '18:00');
      delete process.env.BARBEARIA_AGENDA_FONTE;
      agenda.limparCacheFonteAgenda();
      assert.equal(await agenda.agendaSource(scope), 'barbearia');
      assert.equal(await agenda.agendaSource({ empresaId: A, lojaId: U2 }), 'postgres');
      assert.equal(await agenda.agendaSource(scope), 'barbearia');
      assert.equal((await pgStatus(M2)).status, 'agendado');
      assert.equal((await pgStatus(M3)).status, 'agendado');
      assert.equal(barbearia.listarAgendamentos(A, {}).length, 0, 'uma leitura não cria reserva JSON');
    });
    await t.test('sem unidade, erro PG ou resposta incompleta não migram e não escolhem JSON silenciosamente', async () => {
      const read = db.queryRead;
      let calls = 0;
      try {
        agenda.limparCacheFonteAgenda();
        db.queryRead = async () => { calls += 1; throw new Error('Fixture: leitura indisponível'); };
        assert.equal(await agenda.agendaSource({ empresaId: A }), 'postgres');
        await assert.rejects(() => agenda.migrarAgendaPostgresParaBarbearia({ empresaId: A }, dependencies), e => e.code === 'AGENDA_SCOPE_REQUIRED');
        assert.equal(calls, 0);
        await assert.rejects(() => agenda.agendaSource(scope), e => e.code === 'AGENDA_SOURCE_UNVERIFIABLE');
        db.queryRead = async () => ({});
        await assert.rejects(() => agenda.agendaSource(scope), e => e.code === 'AGENDA_SOURCE_UNVERIFIABLE');
      } finally { db.queryRead = read; agenda.limparCacheFonteAgenda(); }
      assert.equal((await pgStatus(M2)).status, 'agendado');
      assert.equal(barbearia.listarAgendamentos(A, {}).length, 0);
    });
    await t.test('duas fontes com reservas na mesma unidade falham fechado, também após cache PG', async () => {
      assert.equal(await agenda.agendaSource({ empresaId: A, lojaId: U2 }), 'postgres');
      const mixed = barbearia.criarAgendamento(A, {
        clienteNome: 'Cliente fixture JSON', clienteTelefone: '65999990088',
        profissionalId: legacyProfessional.id, servicoId: legacyService.id,
        dataHora: new Date(`${date}T19:00:00-04:00`).toISOString(), dataAgenda: date,
        horaLocal: '19:00', lojaId: U2, origem: 'fixture',
      });
      try {
        await assert.rejects(() => agenda.agendaSource({ empresaId: A, lojaId: U2 }), e => e.code === 'AGENDA_SOURCE_CONFLICT');
        agenda.limparCacheFonteAgenda();
        await assert.rejects(() => agenda.agendaSource({ empresaId: A, lojaId: U2 }), e => e.code === 'AGENDA_SOURCE_CONFLICT');
        assert.equal(await agenda.agendaSource(scope), 'barbearia', 'A2 não bloqueia A1');
        assert.equal((await pgStatus(M2)).status, 'agendado');
        assert.equal(barbearia.listarAgendamentos(A, {}).find(x => x.id === mixed.id).status, 'agendado');
      } finally {
        const { db: legacyDb } = await import('../db.js');
        delete legacyDb().barbearias[A].agendamentos[mixed.id];
        agenda.limparCacheFonteAgenda();
      }
    });
    await t.test('migração explícita A1 só lê/cancela A1; A2 e outro tenant permanecem intactos', async () => {
      await seedPg(M1, A, U1, S1, P1, '16:00');
      const beforeA2 = await pgStatus(M2);
      const beforeB = await pgStatus(M3);
      const result = await agenda.migrarAgendaPostgresParaBarbearia(scope, dependencies);
      assert.equal(result.migrados, 1);
      assert.equal(result.pendentes, 0);
      assert.equal((await pgStatus(M1)).status, 'cancelado');
      assert.deepEqual(await pgStatus(M2), beforeA2);
      assert.deepEqual(await pgStatus(M3), beforeB);
      const json = barbearia.listarAgendamentos(A, {});
      assert.equal(json.length, 1);
      assert.equal(json[0].lojaId, U1);
      const retry = await agenda.migrarAgendaPostgresParaBarbearia(scope, dependencies);
      assert.equal(retry.migrados, 0);
      assert.equal(barbearia.listarAgendamentos(A, {}).length, 1);
    });
    await t.test('UPDATE sem correspondência não conta sucesso; replay divergente ou cross-unit nunca cancela PG', async () => {
      await db.query('DELETE FROM agendamentos WHERE id=$1', [M1]);
      await seedPg(M1, A, U1, S1, P1, '16:00');
      const noUpdate = await agenda.migrarAgendaPostgresParaBarbearia(scope, {
        queryRead: dependencies.queryRead,
        query: async (sql, params) => { assert.match(sql, /empresa_id = \$3 AND loja_id = \$4/); assert.deepEqual(params.slice(2), [A,U1]); return { rowCount: 0, rows: [] }; },
      });
      assert.equal(noUpdate.migrados, 0);
      assert.equal(noUpdate.pendentes, 1);
      assert.equal((await pgStatus(M1)).status, 'agendado');
      const legacy = barbearia.listarAgendamentos(A, {})[0];
      const { db: legacyDb } = await import('../db.js');
      const mutable = legacyDb().barbearias[A].agendamentos[legacy.id];
      mutable.lojaId = U2;
      let writes = 0;
      const blocked = await agenda.migrarAgendaPostgresParaBarbearia(scope, { queryRead: dependencies.queryRead, query: async () => { writes += 1; throw new Error('Não deve executar UPDATE'); } });
      assert.equal(blocked.migrados, 0);
      assert.ok(blocked.motivos.includes('replay_divergente'));
      assert.equal(writes, 0);
      mutable.lojaId = U1;
      mutable.observacoes = 'payload divergente';
      const mismatch = await agenda.migrarAgendaPostgresParaBarbearia(scope, { queryRead: dependencies.queryRead, query: async () => { writes += 1; throw new Error('Não deve executar UPDATE'); } });
      assert.ok(mismatch.motivos.includes('replay_divergente'));
      assert.equal(writes, 0);
      assert.equal((await pgStatus(M1)).status, 'agendado');
      assert.equal((await pgStatus(M2)).status, 'agendado');
    });
  } finally { await db.close(); }
});

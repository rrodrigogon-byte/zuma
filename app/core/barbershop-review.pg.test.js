import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const url = process.env.BARBERSHOP_REVIEW_TEST_DATABASE_URL || '';
const parsed = url ? new URL(url) : null;
const localOnly = parsed?.hostname === 'localhost' && parsed.searchParams.get('host') === '/var/run/postgresql';

test('PG local: NPS enfileira uma única vez por atendimento e respeita revogação de consentimento', { skip: !localOnly && 'defina BARBERSHOP_REVIEW_TEST_DATABASE_URL para PostgreSQL local via socket' }, async () => {
  process.env.DATABASE_URL = url;
  process.env.DB_SSL = 'false';
  const previousBase = process.env.PUBLIC_BASE_URL;
  process.env.PUBLIC_BASE_URL = 'https://dino.kytto.com.br';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dino-review-pg-'));
  process.env.DB_PATH = path.join(tmp, 'db.json');
  const { reset } = await import('../db.js');
  const barbearia = await import('../barbearia-erp-kytto.js');
  const clientes = await import('../clientes-contas-kytto.js');
  const captacao = await import('../dino-captacao-kytto.js');
  const { db, getPool } = await import('./database.js');
  const { queueReviewRequest, reviewNotificationMetrics } = await import('./barbershop-appointment-notifications.js');
  const empresaId = '0f0e0d0c-1b2a-4c3d-8e9f-0123456789ab';
  const lojaId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const canalId = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
  const originalTransaction = db.transaction;
  const originalQuery = db.query;
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TEMP TABLE canais_integracao (
      id uuid PRIMARY KEY, empresa_id uuid, loja_id uuid, nome text, api_base_url text,
      configuracao jsonb, provedor text, status text, data_atualizacao timestamptz
    ) ON COMMIT DROP`);
    await client.query(`CREATE TEMP TABLE tarefas_integracao_canais (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, empresa_id uuid, loja_id uuid,
      canal_id uuid, tipo text, referencia_externa text, payload jsonb, status text, resposta jsonb,
      proxima_tentativa_em timestamptz
    ) ON COMMIT DROP`);
    await client.query(`CREATE UNIQUE INDEX uq_tarefas_notificar_agendamento_test
      ON tarefas_integracao_canais (empresa_id, tipo, referencia_externa)
      WHERE tipo='notificar_agendamento'`);
    await client.query(`INSERT INTO canais_integracao (id, empresa_id, loja_id, nome, provedor, status, data_atualizacao)
      VALUES ($1,$2,$3,'WhatsApp teste','whatsapp','ativo',now())`, [canalId, empresaId, lojaId]);
    db.transaction = async (callback) => callback({ query: (sql, params) => client.query(sql, params) });
    db.query = (sql, params) => client.query(sql, params);
    reset();
    barbearia.atualizarConfiguracao(empresaId, { slugPublico: 'dino', nomePublico: 'Dino Teste' });
    const cliente = clientes.criarCliente(empresaId, { nome: 'Cliente Teste', telefone: '65977770200' });
    captacao.registrarConsentimentoAtendimento(empresaId, cliente.id, 'teste-local');
    const agendamento = { id: 'ag-review-local-01', status: 'concluido', lojaId,
      clienteId: cliente.id, clienteTelefone: cliente.telefone, codigoConfirmacao: 'ABCD1234', dataHora: new Date().toISOString() };
    const contexto = { empresaId, lojaId, legacyEmpresaId: empresaId };
    assert.equal((await queueReviewRequest({ ...contexto, legacyEmpresaId: 'outra-empresa' }, agendamento)).reason, 'tenant_scope_mismatch');
    assert.equal((await queueReviewRequest({ ...contexto, lojaId: 'cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa' }, agendamento)).reason, 'store_scope_mismatch');
    assert.equal((await queueReviewRequest(contexto, { ...agendamento, clienteTelefone: '65977779999' })).reason, 'appointment_phone_mismatch');
    assert.equal((await queueReviewRequest(contexto, { ...agendamento, dataHora: new Date(Date.now() - 31 * 86400000).toISOString() })).reason, 'review_outside_window');
    assert.equal((await queueReviewRequest(contexto, { ...agendamento, dataHora: new Date(Date.now() + 86400000).toISOString() })).reason, 'review_outside_window');
    assert.equal((await client.query('SELECT count(*)::int AS total FROM tarefas_integracao_canais')).rows[0].total, 0);
    const primeiro = await queueReviewRequest(contexto, agendamento);
    assert.equal(primeiro.queued, 1);
    assert.ok(Math.abs(new Date(primeiro.executarEm).valueOf() - Date.now()) < 15000, 'padrão dispara a fila ao concluir');
    assert.equal((await queueReviewRequest(contexto, agendamento)).queued, 0);
    assert.equal((await client.query('SELECT count(*)::int AS total FROM tarefas_integracao_canais')).rows[0].total, 1);
    assert.equal((await reviewNotificationMetrics(contexto)).pendentes, 1);
    assert.equal((await reviewNotificationMetrics(contexto)).canaisAtivos, 1);
    assert.equal((await reviewNotificationMetrics({ ...contexto, lojaId: 'cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa' })).pendentes, 0);
    assert.equal((await reviewNotificationMetrics({ ...contexto, lojaId: 'cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa' })).canaisAtivos, 0);
    await client.query(`UPDATE tarefas_integracao_canais SET status='concluida', resposta='{"sent":true}'::jsonb`);
    assert.equal((await reviewNotificationMetrics(contexto)).aceitas_provedor, 1);
    assert.equal((await reviewNotificationMetrics(contexto)).pendentes, 0);
    captacao.salvarConfiguracaoCaptacao(empresaId, { pedirAvaliacaoAposMinutos: 120 });
    const atrasado = await queueReviewRequest(contexto, { ...agendamento, id: 'ag-review-local-03' });
    assert.equal(atrasado.queued, 1);
    assert.ok(new Date(atrasado.executarEm).valueOf() - Date.now() > 119 * 60000, 'atraso explícito de 120 min preservado');
    assert.equal((await reviewNotificationMetrics(contexto)).pendentes, 1);
    clientes.atualizarConsentimentoCliente(empresaId, cliente.id, { canal: 'whatsapp', finalidade: 'atendimento', concedido: false, origem: 'SAIR' });
    assert.equal((await queueReviewRequest(contexto, { ...agendamento, id: 'ag-review-local-02' })).reason, 'service_consent_required');
    assert.equal((await client.query('SELECT count(*)::int AS total FROM tarefas_integracao_canais')).rows[0].total, 2);
  } finally {
    db.transaction = originalTransaction;
    db.query = originalQuery;
    await client.query('ROLLBACK');
    client.release();
    await db.close();
    if (previousBase === undefined) delete process.env.PUBLIC_BASE_URL; else process.env.PUBLIC_BASE_URL = previousBase;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

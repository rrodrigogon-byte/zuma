import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { authorizeWhatsappEgress } from './whatsapp-egress.js';

const url = process.env.COMMERCE_PG_TEST_URL || '';
const parsed = (() => { try { return new URL(url); } catch { return null; } })();
const local = parsed?.protocol === 'postgresql:' && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
  && /^[a-z0-9_]*_test$/i.test(parsed.pathname.slice(1))
  && (parsed.searchParams.get('host') === '/var/run/postgresql' || parsed.port === '5432');

const COMPANY = '11111111-1111-4111-8111-111111111111';
const STORE = '22222222-2222-4222-8222-222222222222';
const CHANNEL = '33333333-3333-4333-8333-333333333333';
const OTHER = '44444444-4444-4444-8444-444444444444';

test('PostgreSQL local: canal, loja e instância compartilham zero egress cross-tenant', { skip: !local && 'requer COMMERCE_PG_TEST_URL PostgreSQL localhost *_test' }, async () => {
  const previous = { ...process.env };
  Object.assign(process.env, {
    WHATSAPP_PROVIDER: 'chatbot_backend', CHATBOT_BACKEND_MODE: 'instancias',
    CHATBOT_BACKEND_URL: 'https://backend.example.invalid', CHATBOT_BACKEND_INSTANCE: 'dino',
    CHATBOT_BACKEND_EMPRESA_ID: COMPANY, WHATSAPP_POLL_PILOT_PHONES: '5565999990001',
    WHATSAPP_EGRESS_MODE: 'pilot', WHATSAPP_LINE_VERIFIED: '1',
  });
  const client = new pg.Client({ connectionString: url, ssl: false });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE TEMP TABLE lojas (id UUID PRIMARY KEY, empresa_id UUID NOT NULL) ON COMMIT DROP');
    await client.query('INSERT INTO lojas VALUES ($1,$2)', [STORE, COMPANY]);
    await client.query(`CREATE TEMP TABLE canais_integracao (
      id UUID PRIMARY KEY, empresa_id UUID NOT NULL, loja_id UUID NOT NULL,
      provedor TEXT NOT NULL, status TEXT NOT NULL, configuracao JSONB NOT NULL) ON COMMIT DROP`);
    await client.query(`INSERT INTO canais_integracao VALUES ($1,$2,$3,'whatsapp','ativo',$4::jsonb)`, [CHANNEL, COMPANY, STORE, JSON.stringify({ instance: 'dino' })]);
    const database = { queryRead: (sql, params) => client.query(sql, params) };
    const request = { empresaId: COMPANY, lojaId: STORE, canalId: CHANNEL, instance: 'dino', number: '5565999990001' };
    assert.equal((await authorizeWhatsappEgress(request, { database, lock: true })).ok, true);
    assert.equal((await authorizeWhatsappEgress({ ...request, lojaId: OTHER }, { database })).ok, false);
    await client.query('UPDATE lojas SET empresa_id=$1 WHERE id=$2', [OTHER, STORE]);
    assert.equal((await authorizeWhatsappEgress(request, { database })).reason, 'channel_inactive_or_shared');
    await client.query('UPDATE lojas SET empresa_id=$1 WHERE id=$2', [COMPANY, STORE]);
    await client.query(`INSERT INTO canais_integracao VALUES ($1,$2,$3,'whatsapp','ativo',$4::jsonb)`, [OTHER, OTHER, OTHER, JSON.stringify({ instance: ' DINO ' })]);
    assert.equal((await authorizeWhatsappEgress(request, { database })).reason, 'channel_inactive_or_shared');
    await client.query(`UPDATE canais_integracao SET status='pausado' WHERE id=$1`, [OTHER]);
    assert.equal((await authorizeWhatsappEgress(request, { database })).ok, true);
    await client.query(`UPDATE canais_integracao SET status='pausado' WHERE id=$1`, [CHANNEL]);
    assert.equal((await authorizeWhatsappEgress(request, { database })).reason, 'channel_inactive_or_shared');
    await client.query('ROLLBACK');
  } finally {
    await client.query('ROLLBACK').catch(() => null);
    await client.end();
    process.env = previous;
  }
});

test('PostgreSQL local com migration 063: índice único e FK composta negam colidir ou trocar empresa', { skip: !local && 'requer COMMERCE_PG_TEST_URL PostgreSQL localhost *_test migrado' }, async () => {
  const client = new pg.Client({ connectionString: url, ssl: false });
  await client.connect();
  try {
    await client.query('BEGIN');
    const schema = await client.query("SELECT to_regclass('uq_canais_whatsapp_instancia_ativa') AS idx, (SELECT COUNT(*)::int FROM pg_constraint WHERE conname='fk_canais_integracao_loja_empresa') AS fk");
    assert.ok(schema.rows[0].idx && schema.rows[0].fk === 1, 'migration 063 deve estar aplicada no banco local');
    await client.query(`INSERT INTO empresas (id,nome,cnpj,razao_social) VALUES ($1,'Empresa Fictícia A','00000000000001','Empresa Fictícia A'),($2,'Empresa Fictícia B','00000000000002','Empresa Fictícia B')`, [COMPANY, OTHER]);
    await client.query(`INSERT INTO lojas (id,empresa_id,codigo,nome) VALUES ($1,$2,'unit-a','Unidade Fictícia A'),($3,$4,'unit-b','Unidade Fictícia B')`, [STORE, COMPANY, OTHER, OTHER]);
    await client.query(`INSERT INTO canais_integracao (id,empresa_id,loja_id,provedor,nome,status,algoritmo_assinatura,configuracao) VALUES ($1,$2,$3,'whatsapp','Canal A','ativo','nenhum',$4::jsonb)`, [CHANNEL, COMPANY, STORE, JSON.stringify({ instance: 'dino' })]);
    await client.query('SAVEPOINT duplicate');
    await assert.rejects(() => client.query(`INSERT INTO canais_integracao (empresa_id,loja_id,provedor,nome,status,algoritmo_assinatura,configuracao) VALUES ($1,$2,'whatsapp','Canal B','ativo','nenhum',$3::jsonb)`, [OTHER, OTHER, JSON.stringify({ instance: ' DINO ' })]), { code: '23505' });
    await client.query('ROLLBACK TO SAVEPOINT duplicate');
    await client.query('SAVEPOINT mismatch');
    await assert.rejects(() => client.query(`INSERT INTO canais_integracao (empresa_id,loja_id,provedor,nome,status,algoritmo_assinatura,configuracao) VALUES ($1,$2,'whatsapp','Canal Inválido','ativo','nenhum',$3::jsonb)`, [OTHER, STORE, JSON.stringify({ instance: 'outra-instancia' })]), { code: '23503' });
    await client.query('ROLLBACK TO SAVEPOINT mismatch');
    await client.query('ROLLBACK');
  } finally {
    await client.query('ROLLBACK').catch(() => null);
    await client.end();
  }
});

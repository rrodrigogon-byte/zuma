// Banco de teste do módulo Clube: cada arquivo ganha um schema próprio num PostgreSQL real.
// Só roda com CLUBE_PG_TEST_URL definido (nunca usa DATABASE_URL, que é o banco de produção).
// Sem ela, os testes .pg são pulados (o `npm run test:node` continua verde no CI e no Mac).
// O adaptador expõe a mesma API do app/db-pg.js do agro-open
// (query, beginTransaction, queryInTransaction, commit, rollback).
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// Banco de teste com trava (mesma convenção das outras suítes PG do repositório): só localhost e
// só banco cujo nome termina em _test. Nunca usa DATABASE_URL (produção).
function urlSegura(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    const host = (u.hostname || 'localhost').toLowerCase();
    const banco = u.pathname.replace(/^\//, '');
    if (!['localhost', '127.0.0.1', '::1', '[::1]', ''].includes(host)) return '';
    if (!/_test$/.test(banco)) return '';
    return url;
  } catch { return ''; }
}
const CONN = urlSegura(process.env.CLUBE_PG_TEST_URL || '');
// Segredos só para os testes (em produção vêm do Render).
if (!process.env.CLUBE_CONTRATO_SECRET) process.env.CLUBE_CONTRATO_SECRET = 'segredo-de-teste-do-codigo-de-aceite-0123456789';
export const pgDeTeste = CONN ? false : 'defina CLUBE_PG_TEST_URL (localhost, banco *_test) para rodar os testes do Clube com PostgreSQL';

// Réplica fiel das partes do agro-open que os módulos usam: commerce_customers com as colunas
// normalizadas geradas e os índices únicos da migration 051, e commerce_audit_logs (019), para
// que o resolvedor de clientes do Commerce funcione igual à produção.
const STUB_AGRO_OPEN = `
CREATE TABLE commerce_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  usuario_id UUID,
  nome VARCHAR(240) NOT NULL,
  email VARCHAR(320),
  telefone VARCHAR(30),
  documento_mascarado VARCHAR(40),
  consentimentos JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadados JSONB NOT NULL DEFAULT '{}'::jsonb,
  bloqueado BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  email_normalizado VARCHAR(320) GENERATED ALWAYS AS (NULLIF(lower(btrim(email)), '')) STORED,
  telefone_normalizado VARCHAR(13) GENERATED ALWAYS AS (
    CASE
      WHEN regexp_replace(COALESCE(telefone, ''), '[^0-9]+', '', 'g') ~ '^[1-9][0-9]{9,10}$'
        THEN '55' || regexp_replace(telefone, '[^0-9]+', '', 'g')
      WHEN regexp_replace(COALESCE(telefone, ''), '[^0-9]+', '', 'g') ~ '^55[1-9][0-9]{9,10}$'
        THEN regexp_replace(telefone, '[^0-9]+', '', 'g')
      ELSE NULL
    END
  ) STORED,
  CONSTRAINT uq_commerce_customers_empresa_id UNIQUE (empresa_id, id)
);
CREATE UNIQUE INDEX uq_commerce_customer_email_normalizado ON commerce_customers (empresa_id, email_normalizado) WHERE email_normalizado IS NOT NULL;
CREATE UNIQUE INDEX uq_commerce_customer_telefone_normalizado ON commerce_customers (empresa_id, telefone_normalizado) WHERE telefone_normalizado IS NOT NULL;
CREATE TABLE commerce_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL, loja_id UUID, usuario_id UUID,
  entidade VARCHAR(100) NOT NULL, entidade_id UUID, acao VARCHAR(30) NOT NULL,
  antes JSONB, depois JSONB, correlation_id VARCHAR(160), ip_address INET, user_agent TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

export async function criarBancoTeste(migrations = []) {
  const schema = `t_${randomBytes(5).toString('hex')}`;
  const admin = new pg.Client({ connectionString: CONN });
  await admin.connect();
  await admin.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.end();
  const pool = new pg.Pool({ connectionString: CONN, max: 5, options: `-c search_path=${schema},public` });
  await pool.query(STUB_AGRO_OPEN);
  for (const arquivo of migrations) {
    await pool.query(readFileSync(new URL(`../../migrations/${arquivo}`, import.meta.url), 'utf8'));
  }
  const db = {
    query: (text, values) => pool.query(text, values),
    queryRead: (text, values) => pool.query(text, values),
    beginTransaction: async () => { const c = await pool.connect(); await c.query('BEGIN'); return c; },
    queryInTransaction: (c, text, values) => c.query(text, values),
    commit: async (c) => { try { await c.query('COMMIT'); } finally { c.release(); } },
    rollback: async (c) => { try { await c.query('ROLLBACK'); } finally { c.release(); } },
  };
  const fechar = async () => {
    await pool.end();
    const a = new pg.Client({ connectionString: CONN });
    await a.connect();
    await a.query(`DROP SCHEMA ${schema} CASCADE`);
    await a.end();
  };
  return { db, pool, schema, fechar };
}

// telefone único por padrão: commerce_customers tem índice único por (empresa, telefone normalizado)
export async function criarCliente(db, empresaId, nome, telefone = `659${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`) {
  const r = await db.query(
    'INSERT INTO commerce_customers (empresa_id, nome, telefone) VALUES ($1, $2, $3) RETURNING id',
    [empresaId, nome, telefone],
  );
  return r.rows[0].id;
}

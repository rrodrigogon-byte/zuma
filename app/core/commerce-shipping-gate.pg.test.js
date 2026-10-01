import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { resolveShippingSelection } from './commerce-shipping.js';

const connectionString = process.env.COMMERCE_SHIPPING_TEST_DATABASE_URL;
const empresaId = '10000000-0000-4000-8000-000000000106';
const storefrontId = '10000000-0000-4000-8000-000000000103';
const methodId = '10000000-0000-4000-8000-000000000109';
const otherMethodId = '10000000-0000-4000-8000-000000000119';
const quoteId = '10000000-0000-4000-8000-000000000110';
const variantId = '10000000-0000-4000-8000-000000000105';
const destinationCep = '78300055';

const input = {
  shippingQuoteId: quoteId,
  shippingOptionId: 'motoboy:local',
  shippingAddress: {
    destinatario: 'Pessoa de teste', documento: '12345678909', cep: destinationCep,
    logradouro: 'Rua de teste', numero: '1', bairro: 'Centro', cidade: 'Tangará da Serra', estado: 'MT',
  },
};

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
  return value;
}

// Test-only TEMP tables mask Commerce tables and disappear with the connection.
// No production connection is inferred from DATABASE_URL; explicit local test URL is required.
test('PG: seleção usa apenas quote com método ainda ativo e idêntico, sem DML no bloqueio', { skip: !connectionString }, async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TEMP TABLE commerce_shipping_methods (
      id uuid PRIMARY KEY, empresa_id uuid NOT NULL, storefront_id uuid NOT NULL,
      tipo text NOT NULL, ativo boolean NOT NULL, configuracao jsonb NOT NULL
    ) ON COMMIT DROP`);
    await client.query(`CREATE TEMP TABLE commerce_shipping_quotes (
      id uuid PRIMARY KEY, empresa_id uuid NOT NULL, storefront_id uuid NOT NULL,
      shipping_method_id uuid NOT NULL, shipping_account_id uuid, provider text,
      ambiente text, request_hash text NOT NULL, request_snapshot jsonb NOT NULL,
      response_snapshot jsonb NOT NULL, status text NOT NULL, expires_at timestamptz NOT NULL,
      selected_option_id text, selected_amount numeric, atualizado_em timestamptz
    ) ON COMMIT DROP`);
    const snapshot = {
      storefrontId, shippingMethodId: methodId, destinationCep,
      methodConfigHash: crypto.createHash('sha256').update(JSON.stringify(canonicalJson({ provider: 'manual', deliveryType: 'motoboy', freeShippingAbove: 1000 }))).digest('hex'),
      lines: [{ variantId, quantity: 1 }],
    };
    const hash = crypto.createHash('sha256').update(JSON.stringify(canonicalJson(snapshot))).digest('hex');
    const response = { providerOptions: [{ public: { id: 'motoboy:local', amount: 13 }, raw: { ruleId: 'local' } }] };
    await client.query(`INSERT INTO commerce_shipping_methods VALUES ($1,$2,$3,'delivery',true,$5::jsonb),($4,$2,$3,'delivery',true,$5::jsonb)`, [methodId, empresaId, storefrontId, otherMethodId, JSON.stringify({ provider: 'manual', deliveryType: 'motoboy', freeShippingAbove: 1000 })]);
    await client.query(`INSERT INTO commerce_shipping_quotes
      (id,empresa_id,storefront_id,shipping_method_id,provider,ambiente,request_hash,request_snapshot,response_snapshot,status,expires_at)
      VALUES ($1,$2,$3,$4,'manual','manual',$5,$6::jsonb,$7::jsonb,'quoted',CURRENT_TIMESTAMP + INTERVAL '1 hour')`,
    [quoteId, empresaId, storefrontId, methodId, hash, JSON.stringify(snapshot), JSON.stringify(response)]);
    const context = { empresaId };
    const options = { storefrontId, shippingMethodId: methodId, lines: [{ variantId, quantity: 1 }] };
    const selected = await resolveShippingSelection(client, context, input, options);
    assert.equal(selected.amount, 13);
    assert.equal((await client.query('SELECT status FROM commerce_shipping_quotes WHERE id=$1', [quoteId])).rows[0].status, 'selected');

    await client.query("UPDATE commerce_shipping_quotes SET status='quoted', selected_option_id=NULL, selected_amount=NULL WHERE id=$1", [quoteId]);
    await client.query('UPDATE commerce_shipping_methods SET ativo=false WHERE id=$1', [methodId]);
    await assert.rejects(() => resolveShippingSelection(client, context, input, options), error => error.code === 'SHIPPING_QUOTE_EXPIRED');
    const blocked = (await client.query('SELECT status,selected_option_id,selected_amount FROM commerce_shipping_quotes WHERE id=$1', [quoteId])).rows[0];
    assert.deepEqual(blocked, { status: 'quoted', selected_option_id: null, selected_amount: null });

    await client.query('UPDATE commerce_shipping_methods SET ativo=true WHERE id=$1', [methodId]);
    await assert.rejects(() => resolveShippingSelection(client, context, input, { ...options, shippingMethodId: otherMethodId }), error => error.code === 'SHIPPING_QUOTE_EXPIRED');
    await client.query(`UPDATE commerce_shipping_methods SET configuracao = jsonb_set(configuracao, '{freeShippingAbove}', '1200'::jsonb) WHERE id=$1`, [methodId]);
    await assert.rejects(() => resolveShippingSelection(client, context, input, options), error => error.code === 'SHIPPING_QUOTE_EXPIRED');
    await client.query(`UPDATE commerce_shipping_methods SET configuracao = jsonb_set(configuracao, '{freeShippingAbove}', '1000'::jsonb) WHERE id=$1`, [methodId]);
    await client.query(`UPDATE commerce_shipping_quotes SET request_snapshot = request_snapshot - 'methodConfigHash' WHERE id=$1`, [quoteId]);
    await assert.rejects(() => resolveShippingSelection(client, context, input, options), error => error.code === 'SHIPPING_QUOTE_EXPIRED');
    await client.query(`UPDATE commerce_shipping_quotes SET request_snapshot = $2::jsonb WHERE id=$1`, [quoteId, JSON.stringify(snapshot)]);
    await assert.rejects(() => resolveShippingSelection(client, context, input, { ...options, lines: [{ variantId, quantity: 2 }] }), error => error.code === 'SHIPPING_QUOTE_MISMATCH');
    await assert.rejects(() => resolveShippingSelection(client, { empresaId: '10000000-0000-4000-8000-000000000206' }, input, options), error => error.code === 'SHIPPING_QUOTE_EXPIRED');
    const mismatched = (await client.query('SELECT status,selected_option_id FROM commerce_shipping_quotes WHERE id=$1', [quoteId])).rows[0];
    assert.deepEqual(mismatched, { status: 'quoted', selected_option_id: null });
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});

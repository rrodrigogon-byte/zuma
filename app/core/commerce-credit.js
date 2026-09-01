import { CommerceError, assertUuid, requestId, tenantContext, transitionOrder, withCommerceTransaction } from './commerce-core.js';

function money(value, fallback = 0) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : fallback;
}

function positiveMoney(value, field) {
  const amount = money(value, NaN);
  if (!Number.isFinite(amount) || amount <= 0) throw new CommerceError(`${field} deve ser maior que zero`, 'CREDIT_VALUE_INVALID');
  return amount;
}

function days(value) {
  const amount = Number(value || 30);
  if (!Number.isInteger(amount) || amount < 1 || amount > 365) throw new CommerceError('prazo do crediário deve ficar entre 1 e 365 dias', 'CREDIT_DUE_DAYS_INVALID');
  return amount;
}

function accountStatus(value = 'active') {
  const status = String(value || 'active').trim().toLowerCase();
  if (!['active', 'blocked', 'closed'].includes(status)) throw new CommerceError('status de crédito inválido', 'CREDIT_STATUS_INVALID');
  return status;
}

function scopeStorefront(input) {
  return input.storefrontId ? assertUuid(input.storefrontId, 'storefrontId') : null;
}

export async function listCreditAccounts(client, context, input = {}) {
  const { empresaId, lojaId } = tenantContext(context);
  const storefrontId = scopeStorefront(input);
  const result = await client.query(
    `SELECT ca.id, ca.storefront_id, ca.customer_id, ca.limite_credito, ca.saldo_devedor,
            ca.prazo_dias, ca.status, ca.observacoes, ca.criado_em, ca.atualizado_em,
            c.nome AS customer_name, c.email AS customer_email, c.telefone AS customer_phone,
            s.nome AS storefront_name, s.codigo AS storefront_code,
            COALESCE(SUM(CASE WHEN ce.tipo = 'charge' AND ce.status = 'open' THEN ce.valor ELSE 0 END), 0) AS charges_open
       FROM commerce_customer_credit_accounts ca
       JOIN commerce_customers c ON c.empresa_id = ca.empresa_id AND c.id = ca.customer_id
       JOIN commerce_storefronts s ON s.empresa_id = ca.empresa_id AND s.id = ca.storefront_id
       LEFT JOIN commerce_customer_credit_entries ce ON ce.empresa_id = ca.empresa_id AND ce.account_id = ca.id
      WHERE ca.empresa_id = $1
        AND ($2::uuid IS NULL OR ca.storefront_id = $2)
        AND ($3::uuid IS NULL OR s.loja_id = $3)
      GROUP BY ca.id, c.id, s.id
      ORDER BY c.nome ASC`,
    [empresaId, storefrontId, lojaId || null],
  );
  return { items: result.rows };
}

export async function createCreditAccount(trx, context, input = {}) {
  const { empresaId, usuarioId, lojaId } = tenantContext(context);
  const storefrontId = assertUuid(input.storefrontId, 'storefrontId');
  const customerId = assertUuid(input.customerId, 'customerId');
  const limit = money(input.limiteCredito ?? input.creditLimit, NaN);
  if (!Number.isFinite(limit) || limit < 0) throw new CommerceError('limite de crédito inválido', 'CREDIT_LIMIT_INVALID');
  const dueDays = days(input.prazoDias ?? input.dueDays);
  const status = accountStatus(input.status);
  const customer = await trx.query(
    `SELECT id, bloqueado FROM commerce_customers WHERE empresa_id = $1 AND id = $2 LIMIT 1`,
    [empresaId, customerId],
  );
  if (!customer.rows[0] || customer.rows[0].bloqueado) throw new CommerceError('cliente não encontrado ou bloqueado no tenant', 'CREDIT_CUSTOMER_INVALID');
  const storefront = await trx.query(
    `SELECT id FROM commerce_storefronts WHERE empresa_id = $1 AND id = $2 AND ($3::uuid IS NULL OR loja_id = $3) LIMIT 1`,
    [empresaId, storefrontId, lojaId || null],
  );
  if (!storefront.rows[0]) throw new CommerceError('storefront fora do escopo da loja ativa', 'CREDIT_STOREFRONT_SCOPE_MISMATCH');
  const existing = await trx.query(`SELECT id FROM commerce_customer_credit_accounts WHERE empresa_id = $1 AND storefront_id = $2 AND customer_id = $3 LIMIT 1`, [empresaId, storefrontId, customerId]);
  if (existing.rows[0]) throw new CommerceError('cliente já possui conta de crediário neste storefront', 'CREDIT_ACCOUNT_CONFLICT');
  const result = await trx.query(
    `INSERT INTO commerce_customer_credit_accounts
      (empresa_id, storefront_id, customer_id, limite_credito, prazo_dias, status, observacoes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [empresaId, storefrontId, customerId, limit, dueDays, status, String(input.observacoes || '').trim().slice(0, 1000) || null],
  );
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois)
     VALUES ($1, $2, $3, 'customer_credit_account', $4, 'created', $5::jsonb)`,
    [empresaId, lojaId || null, usuarioId || null, result.rows[0].id, JSON.stringify({ customerId, storefrontId, limiteCredito: limit, prazoDias: dueDays, status })],
  );
  return result.rows[0];
}

export async function updateCreditAccount(trx, context, accountIdInput, input = {}) {
  const { empresaId, usuarioId, lojaId } = tenantContext(context);
  const accountId = assertUuid(accountIdInput, 'creditAccountId');
  const currentResult = await trx.query(
    `SELECT ca.* FROM commerce_customer_credit_accounts ca
      JOIN commerce_storefronts s ON s.empresa_id = ca.empresa_id AND s.id = ca.storefront_id
     WHERE ca.empresa_id = $1 AND ca.id = $2 AND ($3::uuid IS NULL OR s.loja_id = $3)
     FOR UPDATE`,
    [empresaId, accountId, lojaId || null],
  );
  const current = currentResult.rows[0];
  if (!current) throw new CommerceError('conta de crediário não encontrada no escopo', 'CREDIT_ACCOUNT_NOT_FOUND');
  const limit = input.limiteCredito === undefined && input.creditLimit === undefined ? Number(current.limite_credito) : money(input.limiteCredito ?? input.creditLimit, NaN);
  if (!Number.isFinite(limit) || limit < Number(current.saldo_devedor)) throw new CommerceError('limite não pode ficar abaixo do saldo devedor atual', 'CREDIT_LIMIT_BELOW_BALANCE');
  const dueDays = input.prazoDias === undefined && input.dueDays === undefined ? Number(current.prazo_dias) : days(input.prazoDias ?? input.dueDays);
  const status = input.status === undefined ? current.status : accountStatus(input.status);
  const note = input.observacoes === undefined ? current.observacoes : String(input.observacoes || '').trim().slice(0, 1000) || null;
  const result = await trx.query(
    `UPDATE commerce_customer_credit_accounts
        SET limite_credito = $3, prazo_dias = $4, status = $5, observacoes = $6, atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND id = $2
      RETURNING *`,
    [empresaId, accountId, limit, dueDays, status, note],
  );
  await trx.query(
    `INSERT INTO commerce_audit_logs (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, antes, depois)
     VALUES ($1, $2, $3, 'customer_credit_account', $4, 'updated', $5::jsonb, $6::jsonb)`,
    [empresaId, lojaId || null, usuarioId || null, accountId, JSON.stringify(current), JSON.stringify(result.rows[0])],
  );
  return result.rows[0];
}

export async function createCreditPayment(contextInput, input = {}) {
  const context = tenantContext(contextInput);
  const orderId = assertUuid(input.orderId, 'orderId');
  const idempotencyKey = String(input.idempotencyKey || '').trim().slice(0, 180);
  if (!idempotencyKey) throw new CommerceError('chave de idempotência é obrigatória para crediário', 'PAYMENT_IDEMPOTENCY_REQUIRED');
  return withCommerceTransaction(async trx => {
    const existing = await trx.query(
      `SELECT id, order_id, status, amount, provider, method, metadata
         FROM commerce_payments
        WHERE empresa_id = $1 AND idempotency_key = $2 AND provider = 'crediario'
        LIMIT 1
        FOR UPDATE`,
      [context.empresaId, idempotencyKey],
    );
    if (existing.rows[0]) return { paymentId: existing.rows[0].id, orderId: existing.rows[0].order_id, status: existing.rows[0].status, provider: 'crediario', method: 'account', checkout: { status: existing.rows[0].status, account: true } };
    const orderResult = await trx.query(
      `SELECT o.id, o.public_code, o.storefront_id, o.loja_id, o.customer_id, o.status, o.total,
              c.nome AS customer_name, c.bloqueado
         FROM commerce_orders o
         JOIN commerce_customers c ON c.empresa_id = o.empresa_id AND c.id = o.customer_id
        WHERE o.empresa_id = $1 AND o.id = $2 AND ($3::uuid IS NULL OR o.loja_id = $3)
        FOR UPDATE OF o`,
      [context.empresaId, orderId, context.lojaId || null],
    );
    const order = orderResult.rows[0];
    if (!order) throw new CommerceError('pedido não encontrado para crediário', 'ORDER_NOT_FOUND');
    if (order.bloqueado) throw new CommerceError('cliente bloqueado para compras', 'CREDIT_CUSTOMER_BLOCKED');
    if (!['draft', 'pending_payment', 'payment_failed'].includes(order.status)) throw new CommerceError('pedido não está disponível para crediário', 'PAYMENT_ORDER_STATE_INVALID');
    const accountResult = await trx.query(
      `SELECT * FROM commerce_customer_credit_accounts
        WHERE empresa_id = $1 AND storefront_id = $2 AND customer_id = $3
        FOR UPDATE`,
      [context.empresaId, order.storefront_id, order.customer_id],
    );
    const account = accountResult.rows[0];
    if (!account) throw new CommerceError('crediário disponível somente para clientes cadastrados e aprovados', 'CREDIT_ACCOUNT_NOT_FOUND');
    if (account.status !== 'active') throw new CommerceError('a conta de crediário do cliente não está ativa', 'CREDIT_ACCOUNT_NOT_ACTIVE');
    const total = positiveMoney(order.total, 'total do pedido');
    const available = Number(account.limite_credito) - Number(account.saldo_devedor);
    if (available + 0.005 < total) throw new CommerceError(`limite de crediário insuficiente; disponível: R$ ${available.toFixed(2)}`, 'CREDIT_LIMIT_EXCEEDED', { available, total });
    const paymentResult = await trx.query(
      `INSERT INTO commerce_payments
        (empresa_id, order_id, payment_account_id, provider, method, status, idempotency_key, amount, provider_payment_id, metadata, authorized_at, captured_at)
       VALUES ($1, $2, NULL, 'crediario', 'account', 'captured', $3, $4, $5, $6::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, status, amount, provider, method`,
      [context.empresaId, order.id, idempotencyKey, total, `credit-${order.public_code}`, JSON.stringify({ accountId: account.id, customerId: order.customer_id, dueDays: account.prazo_dias, source: 'checkout' })],
    );
    const dueDate = new Date(Date.now() + Number(account.prazo_dias) * 86400000).toISOString().slice(0, 10);
    await trx.query(
      `INSERT INTO commerce_customer_credit_entries
        (empresa_id, account_id, customer_id, storefront_id, order_id, tipo, valor, vencimento_em, status, descricao, metadata)
       VALUES ($1, $2, $3, $4, $5, 'charge', $6, $7::date, 'open', $8, $9::jsonb)`,
      [context.empresaId, account.id, order.customer_id, order.storefront_id, order.id, total, dueDate, `Pedido ${order.public_code}`, JSON.stringify({ paymentId: paymentResult.rows[0].id, idempotencyKey })],
    );
    await trx.query(
      `UPDATE commerce_customer_credit_accounts
          SET saldo_devedor = saldo_devedor + $3, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND id = $2`,
      [context.empresaId, account.id, total],
    );
    await transitionOrder(trx, { empresaId: context.empresaId }, { orderId: order.id, status: 'paid', origin: 'credit_account_checkout', correlationId: requestId(`credit:${idempotencyKey}`), payload: { provider: 'crediario', paymentId: paymentResult.rows[0].id, dueDate } });
    return { paymentId: paymentResult.rows[0].id, orderId: order.id, status: 'captured', provider: 'crediario', method: 'account', checkout: { status: 'captured', account: true, dueDate, customerName: order.customer_name } };
  });
}

export async function listCreditEntries(client, context, accountIdInput) {
  const { empresaId, lojaId } = tenantContext(context);
  const accountId = assertUuid(accountIdInput, 'creditAccountId');
  const result = await client.query(
    `SELECT ce.* FROM commerce_customer_credit_entries ce
       JOIN commerce_customer_credit_accounts ca ON ca.empresa_id = ce.empresa_id AND ca.id = ce.account_id
       JOIN commerce_storefronts s ON s.empresa_id = ca.empresa_id AND s.id = ca.storefront_id
      WHERE ce.empresa_id = $1 AND ce.account_id = $2 AND ($3::uuid IS NULL OR s.loja_id = $3)
      ORDER BY ce.vencimento_em NULLS LAST, ce.criado_em DESC`,
    [empresaId, accountId, lojaId || null],
  );
  return { items: result.rows };
}

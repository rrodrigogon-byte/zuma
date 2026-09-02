import { randomUUID } from 'node:crypto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REWARD_STATUS = new Set(['rascunho', 'ativa', 'pausada', 'encerrada']);
const DEFAULT_LEVELS = [
  { codigo: 'bronze', nome: 'Bronze', ordem: 1, pontos_minimos: 0, beneficios: ['Nível inicial do programa'], ativo: true },
  { codigo: 'prata', nome: 'Prata', ordem: 2, pontos_minimos: 1000, beneficios: ['Reconhecimento de cliente recorrente'], ativo: true },
  { codigo: 'ouro', nome: 'Ouro', ordem: 3, pontos_minimos: 3000, beneficios: ['Reconhecimento de alta recorrência'], ativo: true },
];

export class LoyaltyAdvancedError extends Error {
  constructor(message, statusCode = 400, code = 'LOYALTY_ADVANCED_ERROR') {
    super(message);
    this.name = 'LoyaltyAdvancedError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function text(value, max = 250, { required = false } = {}) {
  const result = String(value ?? '').trim().slice(0, max);
  if (required && !result) throw new LoyaltyAdvancedError('Campo textual obrigatório ausente.');
  return result || null;
}

function integer(value, { min = 0, max = Number.MAX_SAFE_INTEGER, nullable = false } = {}) {
  if ((value === '' || value === null || value === undefined) && nullable) return null;
  const result = Number(value);
  if (!Number.isInteger(result) || result < min || result > max) throw new LoyaltyAdvancedError('Valor inteiro fora do intervalo permitido.');
  return result;
}

function timestamp(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new LoyaltyAdvancedError('Data ou hora inválida.');
  return parsed.toISOString();
}

function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function benefits(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
  return source.map(item => String(item || '').trim().slice(0, 160)).filter(Boolean).slice(0, 10);
}

function requireScope({ empresaId, lojaId }) {
  if (!UUID_REGEX.test(empresaId || '') || !UUID_REGEX.test(lojaId || '')) {
    throw new LoyaltyAdvancedError('Escopo de empresa e loja inválido.', 403, 'INVALID_SCOPE');
  }
}

function requireUuid(value, label) {
  if (!UUID_REGEX.test(value || '')) {
    throw new LoyaltyAdvancedError(`${label} inválido.`);
  }
}

export function defaultLoyaltyLevels() {
  return DEFAULT_LEVELS.map(level => ({ ...level, beneficios: [...level.beneficios], persistido: false }));
}

export function normalizeLoyaltyLevels(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 10) {
    throw new LoyaltyAdvancedError('Informe entre 1 e 10 níveis de fidelidade.');
  }
  const normalized = input.map((item, index) => {
    const nome = text(item?.nome, 80, { required: true });
    const codigo = slug(item?.codigo || nome);
    if (!codigo) throw new LoyaltyAdvancedError('Código de nível inválido.');
    return {
      codigo,
      nome,
      ordem: index + 1,
      pontos_minimos: integer(item?.pontos_minimos, { min: 0, max: 100000000 }),
      beneficios: benefits(item?.beneficios),
      ativo: item?.ativo !== false,
    };
  });
  if (normalized[0].pontos_minimos !== 0) throw new LoyaltyAdvancedError('O primeiro nível deve começar em zero pontos.');
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index].pontos_minimos <= normalized[index - 1].pontos_minimos) {
      throw new LoyaltyAdvancedError('Os limites dos níveis devem ser estritamente crescentes.');
    }
  }
  if (new Set(normalized.map(item => item.codigo)).size !== normalized.length) {
    throw new LoyaltyAdvancedError('Os códigos dos níveis devem ser únicos.');
  }
  return normalized;
}

export function normalizeRewardInput(input = {}, current = null) {
  const merged = { ...(current || {}), ...(input || {}) };
  const nome = text(merged.nome, 140, { required: true });
  const codigo = slug(merged.codigo || nome);
  if (!codigo) throw new LoyaltyAdvancedError('Código de recompensa inválido.');
  const inicioEm = timestamp(merged.inicio_em);
  const fimEm = timestamp(merged.fim_em);
  if (inicioEm && fimEm && new Date(fimEm) <= new Date(inicioEm)) {
    throw new LoyaltyAdvancedError('O fim da recompensa deve ser posterior ao início.');
  }
  const status = String(merged.status || 'rascunho');
  if (!REWARD_STATUS.has(status)) throw new LoyaltyAdvancedError('Status de recompensa inválido.');
  const estoqueTotal = integer(merged.estoque_total, { min: 0, max: 1000000, nullable: true });
  const redeemed = integer(current?.quantidade_resgatada ?? 0, { min: 0, max: 1000000 });
  if (estoqueTotal !== null && estoqueTotal < redeemed) {
    throw new LoyaltyAdvancedError('O estoque total não pode ser menor que a quantidade já resgatada.');
  }
  return {
    codigo,
    nome,
    descricao: text(merged.descricao, 500),
    custo_pontos: integer(merged.custo_pontos, { min: 1, max: 100000000 }),
    estoque_total: estoqueTotal,
    limite_por_cliente: integer(merged.limite_por_cliente, { min: 1, max: 1000, nullable: true }),
    inicio_em: inicioEm,
    fim_em: fimEm,
    status,
  };
}

function normalizeIdempotencyKey(value) {
  const result = String(value || '').trim();
  if (!/^[A-Za-z0-9:_-]{16,120}$/.test(result)) {
    throw new LoyaltyAdvancedError('Chave de idempotência inválida.');
  }
  return result;
}

function decimal(value, { min = 0, max = 100000000 } = {}) {
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max) {
    throw new LoyaltyAdvancedError('Valor decimal fora do intervalo permitido.');
  }
  return Number(result.toFixed(4));
}

export function normalizeLoyaltySettings(input = {}) {
  return {
    ativo: input.ativo === true,
    pontos_por_real: decimal(input.pontos_por_real ?? 1, { min: 0, max: 1000 }),
    valor_minimo_compra: decimal(input.valor_minimo_compra ?? 0, { min: 0, max: 100000000 }),
    validade_dias: integer(input.validade_dias, { min: 1, max: 3650, nullable: true }),
  };
}

export async function getLoyaltySettings(db, { empresaId, lojaId }) {
  requireScope({ empresaId, lojaId });
  const result = await db.query(
    `SELECT id, ativo, pontos_por_real, valor_minimo_compra, validade_dias, atualizado_em
       FROM commerce_loyalty_settings
      WHERE empresa_id = $1 AND loja_id = $2`,
    [empresaId, lojaId],
  );
  return result.rows[0] || {
    ativo: false,
    pontos_por_real: 1,
    valor_minimo_compra: 0,
    validade_dias: null,
    persistido: false,
  };
}

export async function upsertLoyaltySettings(db, { empresaId, lojaId, usuarioId, input }) {
  requireScope({ empresaId, lojaId });
  const settings = normalizeLoyaltySettings(input);
  const client = await db.beginTransaction();
  try {
    await assertStore(db, client, empresaId, lojaId);
    const result = await db.queryInTransaction(
      client,
      `INSERT INTO commerce_loyalty_settings
       (empresa_id, loja_id, ativo, pontos_por_real, valor_minimo_compra, validade_dias, criado_por, atualizado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       ON CONFLICT (empresa_id, loja_id) DO UPDATE
         SET ativo = EXCLUDED.ativo,
             pontos_por_real = EXCLUDED.pontos_por_real,
             valor_minimo_compra = EXCLUDED.valor_minimo_compra,
             validade_dias = EXCLUDED.validade_dias,
             atualizado_por = EXCLUDED.atualizado_por,
             atualizado_em = CURRENT_TIMESTAMP
       RETURNING id, ativo, pontos_por_real, valor_minimo_compra, validade_dias, atualizado_em`,
      [empresaId, lojaId, settings.ativo, settings.pontos_por_real, settings.valor_minimo_compra, settings.validade_dias, usuarioId],
    );
    await db.commit(client);
    return { ...result.rows[0], persistido: true };
  } catch (error) {
    await db.rollback(client);
    throw error;
  }
}

async function assertStore(db, client, empresaId, lojaId) {
  const result = await db.queryInTransaction(
    client,
    'SELECT id FROM lojas WHERE id = $1 AND empresa_id = $2 FOR UPDATE',
    [lojaId, empresaId],
  );
  if (!result.rows[0]) throw new LoyaltyAdvancedError('Loja não encontrada no tenant ativo.', 404, 'STORE_NOT_FOUND');
}

export async function creditPaidOrderLoyaltyPoints(trx, { empresaId, orderId, usuarioId = null }) {
  if (!UUID_REGEX.test(empresaId || '') || !UUID_REGEX.test(orderId || '')) {
    throw new LoyaltyAdvancedError('Empresa ou pedido inválido.', 403, 'INVALID_SCOPE');
  }
  const orderResult = await trx.query(
    `SELECT o.id, o.customer_id, o.total, o.public_code, s.loja_id
       FROM commerce_orders o
       JOIN commerce_storefronts s ON s.empresa_id = o.empresa_id AND s.id = o.storefront_id
      WHERE o.empresa_id = $1 AND o.id = $2 AND o.status = 'paid'
      FOR UPDATE OF o`,
    [empresaId, orderId],
  );
  const order = orderResult.rows[0];
  if (!order) return { credited: false, reason: 'order_not_paid' };
  if (!order.customer_id || !order.loja_id) return { credited: false, reason: 'customer_or_store_missing' };
  const settingsResult = await trx.query(
    `SELECT pontos_por_real, valor_minimo_compra, validade_dias
       FROM commerce_loyalty_settings
      WHERE empresa_id = $1 AND loja_id = $2 AND ativo = true
      FOR UPDATE`,
    [empresaId, order.loja_id],
  );
  const settings = settingsResult.rows[0];
  if (!settings) return { credited: false, reason: 'loyalty_inactive' };
  const orderTotal = Number(order.total || 0);
  if (orderTotal < Number(settings.valor_minimo_compra || 0)) return { credited: false, reason: 'minimum_not_reached' };
  const points = Math.floor(orderTotal * Number(settings.pontos_por_real || 0));
  if (points <= 0) return { credited: false, reason: 'zero_points' };
  const existing = await trx.query(
    `SELECT id, pontos
       FROM commerce_loyalty_ledger
      WHERE empresa_id = $1 AND loja_id = $2
        AND referencia_tipo = 'commerce_order' AND referencia_id = $3 AND tipo = 'credito'`,
    [empresaId, order.loja_id, orderId],
  );
  if (existing.rows[0]) return { credited: false, replay: true, points: Number(existing.rows[0].pontos) };
  await trx.query(
    `INSERT INTO commerce_loyalty_accounts (empresa_id, loja_id, customer_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (empresa_id, loja_id, customer_id) DO NOTHING`,
    [empresaId, order.loja_id, order.customer_id],
  );
  const accountResult = await trx.query(
    `SELECT id, saldo_pontos, pontos_acumulados
       FROM commerce_loyalty_accounts
      WHERE empresa_id = $1 AND loja_id = $2 AND customer_id = $3
      FOR UPDATE`,
    [empresaId, order.loja_id, order.customer_id],
  );
  const account = accountResult.rows[0];
  const balanceBefore = Number(account.saldo_pontos || 0);
  const balanceAfter = balanceBefore + points;
  await trx.query(
    `INSERT INTO commerce_loyalty_ledger
     (empresa_id, loja_id, account_id, customer_id, tipo, pontos, saldo_anterior,
      saldo_posterior, descricao, referencia_tipo, referencia_id, expira_em, criado_por)
     VALUES ($1, $2, $3, $4, 'credito', $5, $6, $7, $8, 'commerce_order', $9,
             CASE WHEN $10::int IS NULL THEN NULL ELSE CURRENT_TIMESTAMP + make_interval(days => $10::int) END,
             $11)`,
    [empresaId, order.loja_id, account.id, order.customer_id, points, balanceBefore, balanceAfter,
      `Crédito do pedido ${order.public_code}`.slice(0, 240), orderId, settings.validade_dias, usuarioId],
  );
  await trx.query(
    `UPDATE commerce_loyalty_accounts
        SET saldo_pontos = $1,
            pontos_acumulados = pontos_acumulados + $2,
            atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $3 AND loja_id = $4 AND customer_id = $5`,
    [balanceAfter, points, empresaId, order.loja_id, order.customer_id],
  );
  return { credited: true, points, customerId: order.customer_id, lojaId: order.loja_id };
}

export async function getLoyaltyLevels(db, scope) {
  requireScope(scope);
  const result = await db.query(
    `SELECT id, codigo, nome, ordem, pontos_minimos, beneficios, ativo, data_atualizacao
       FROM fidelidade_niveis_loja
      WHERE empresa_id = $1 AND loja_id = $2
      ORDER BY ordem ASC`,
    [scope.empresaId, scope.lojaId],
  );
  return result.rows.length
    ? result.rows.map(row => ({ ...row, pontos_minimos: Number(row.pontos_minimos), beneficios: row.beneficios || [], persistido: true }))
    : defaultLoyaltyLevels();
}

export async function replaceLoyaltyLevels(db, { empresaId, lojaId, usuarioId, levels }) {
  requireScope({ empresaId, lojaId });
  const normalized = normalizeLoyaltyLevels(levels);
  const client = await db.beginTransaction();
  try {
    await assertStore(db, client, empresaId, lojaId);
    await db.queryInTransaction(client, 'DELETE FROM fidelidade_niveis_loja WHERE empresa_id = $1 AND loja_id = $2', [empresaId, lojaId]);
    const saved = [];
    for (const level of normalized) {
      const result = await db.queryInTransaction(
        client,
        `INSERT INTO fidelidade_niveis_loja
         (empresa_id, loja_id, codigo, nome, ordem, pontos_minimos, beneficios, ativo, criado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
         RETURNING *`,
        [empresaId, lojaId, level.codigo, level.nome, level.ordem, level.pontos_minimos, JSON.stringify(level.beneficios), level.ativo, usuarioId],
      );
      saved.push({ ...result.rows[0], persistido: true });
    }
    await db.commit(client);
    return saved;
  } catch (error) {
    await db.rollback(client);
    throw error;
  }
}

export async function listRewards(db, { empresaId, lojaId, includeInactive = true }) {
  requireScope({ empresaId, lojaId });
  const result = await db.query(
    `SELECT r.*,
            CASE WHEN r.estoque_total IS NULL THEN NULL ELSE r.estoque_total - r.quantidade_resgatada END AS estoque_disponivel
       FROM fidelidade_recompensas r
      WHERE r.empresa_id = $1 AND r.loja_id = $2
        AND ($3::boolean OR r.status = 'ativa')
      ORDER BY CASE r.status WHEN 'ativa' THEN 0 WHEN 'rascunho' THEN 1 WHEN 'pausada' THEN 2 ELSE 3 END,
               r.custo_pontos ASC, r.data_criacao DESC`,
    [empresaId, lojaId, includeInactive],
  );
  return result.rows;
}

export async function createReward(db, { empresaId, lojaId, usuarioId, input }) {
  requireScope({ empresaId, lojaId });
  const reward = normalizeRewardInput(input);
  const client = await db.beginTransaction();
  try {
    await assertStore(db, client, empresaId, lojaId);
    const result = await db.queryInTransaction(
      client,
      `INSERT INTO fidelidade_recompensas
       (empresa_id, loja_id, codigo, nome, descricao, custo_pontos, estoque_total,
        limite_por_cliente, inicio_em, fim_em, status, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [empresaId, lojaId, reward.codigo, reward.nome, reward.descricao, reward.custo_pontos, reward.estoque_total,
        reward.limite_por_cliente, reward.inicio_em, reward.fim_em, reward.status, usuarioId],
    );
    await db.commit(client);
    return result.rows[0];
  } catch (error) {
    await db.rollback(client);
    if (error.code === '23505') throw new LoyaltyAdvancedError('Já existe uma recompensa com este código na loja.', 409, 'REWARD_CODE_CONFLICT');
    throw error;
  }
}

export async function updateReward(db, { empresaId, lojaId, rewardId, input }) {
  requireScope({ empresaId, lojaId });
  requireUuid(rewardId, 'Recompensa');
  const client = await db.beginTransaction();
  try {
    const existing = await db.queryInTransaction(
      client,
      'SELECT * FROM fidelidade_recompensas WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 FOR UPDATE',
      [rewardId, empresaId, lojaId],
    );
    if (!existing.rows[0]) throw new LoyaltyAdvancedError('Recompensa não encontrada.', 404, 'REWARD_NOT_FOUND');
    const reward = normalizeRewardInput(input, existing.rows[0]);
    const result = await db.queryInTransaction(
      client,
      `UPDATE fidelidade_recompensas
          SET codigo = $1, nome = $2, descricao = $3, custo_pontos = $4,
              estoque_total = $5, limite_por_cliente = $6, inicio_em = $7,
              fim_em = $8, status = $9
        WHERE id = $10 AND empresa_id = $11 AND loja_id = $12
        RETURNING *`,
      [reward.codigo, reward.nome, reward.descricao, reward.custo_pontos, reward.estoque_total,
        reward.limite_por_cliente, reward.inicio_em, reward.fim_em, reward.status,
        rewardId, empresaId, lojaId],
    );
    await db.commit(client);
    return { reward: result.rows[0], before: existing.rows[0] };
  } catch (error) {
    await db.rollback(client);
    if (error.code === '23505') throw new LoyaltyAdvancedError('Já existe uma recompensa com este código na loja.', 409, 'REWARD_CODE_CONFLICT');
    throw error;
  }
}

export async function getLoyaltyRanking(db, { empresaId, lojaId, limit = 50 }) {
  requireScope({ empresaId, lojaId });
  const safeLimit = integer(limit, { min: 1, max: 100 });
  const result = await db.query(
    `SELECT ROW_NUMBER() OVER (ORDER BY a.pontos_acumulados DESC, a.saldo_pontos DESC, c.nome ASC)::int AS posicao,
            c.id AS cliente_id, c.nome,
            a.pontos_acumulados::int,
            a.saldo_pontos::int AS saldo_loja,
            a.saldo_pontos::int AS saldo_total,
            LEAST(a.saldo_pontos, COALESCE(expiring.pontos, 0))::int AS pontos_a_expirar_30d,
            nivel.codigo AS nivel_codigo, nivel.nome AS nivel_nome, nivel.beneficios AS nivel_beneficios
       FROM commerce_loyalty_accounts a
       JOIN commerce_customers c
         ON c.empresa_id = a.empresa_id AND c.id = a.customer_id AND c.bloqueado = false
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(l.pontos), 0)::int AS pontos
           FROM commerce_loyalty_ledger l
          WHERE l.empresa_id = a.empresa_id AND l.loja_id = a.loja_id
            AND l.customer_id = a.customer_id AND l.tipo = 'credito'
            AND l.expira_em > CURRENT_TIMESTAMP
            AND l.expira_em <= CURRENT_TIMESTAMP + INTERVAL '30 days'
       ) expiring ON true
       LEFT JOIN LATERAL (
         SELECT n.codigo, n.nome, n.beneficios
           FROM fidelidade_niveis_loja n
          WHERE n.empresa_id = a.empresa_id AND n.loja_id = a.loja_id AND n.ativo = true
            AND n.pontos_minimos <= a.pontos_acumulados
          ORDER BY n.pontos_minimos DESC
          LIMIT 1
       ) nivel ON true
      WHERE a.empresa_id = $1 AND a.loja_id = $2
      ORDER BY posicao
      LIMIT $3`,
    [empresaId, lojaId, safeLimit],
  );
  return result.rows.map(row => {
    if (row.nivel_nome) return row;
    const virtual = defaultLoyaltyLevels()
      .filter(level => level.ativo && level.pontos_minimos <= Number(row.pontos_acumulados || 0))
      .at(-1);
    return {
      ...row,
      nivel_codigo: virtual?.codigo || 'bronze',
      nivel_nome: virtual?.nome || 'Bronze',
      nivel_beneficios: virtual?.beneficios || [],
    };
  });
}

export async function listRewardRedemptions(db, { empresaId, lojaId, limit = 50 }) {
  requireScope({ empresaId, lojaId });
  const safeLimit = integer(limit, { min: 1, max: 100 });
  const result = await db.query(
    `SELECT rr.id, rr.cliente_id, c.nome AS cliente_nome, rr.recompensa_id,
            r.nome AS recompensa_nome, rr.pontos_resgatados, rr.quantidade,
            rr.status, rr.observacao, rr.criado_em, rr.entregue_em, rr.cancelado_em
       FROM commerce_loyalty_reward_redemptions rr
       JOIN commerce_customers c ON c.id = rr.cliente_id AND c.empresa_id = rr.empresa_id
       JOIN fidelidade_recompensas r ON r.id = rr.recompensa_id AND r.empresa_id = rr.empresa_id
      WHERE rr.empresa_id = $1 AND rr.loja_id = $2
      ORDER BY rr.criado_em DESC
      LIMIT $3`,
    [empresaId, lojaId, safeLimit],
  );
  return result.rows;
}

export async function getAdvancedLoyaltyOverview(db, scope) {
  const [settings, levels, rewards, ranking, redemptions] = await Promise.all([
    getLoyaltySettings(db, scope),
    getLoyaltyLevels(db, scope),
    listRewards(db, scope),
    getLoyaltyRanking(db, { ...scope, limit: 50 }),
    listRewardRedemptions(db, { ...scope, limit: 50 }),
  ]);
  return {
    settings,
    levels,
    levelsPersisted: levels.some(level => level.persistido === true),
    rewards,
    ranking,
    redemptions,
    metrics: {
      customersRanked: ranking.length,
      activeRewards: rewards.filter(item => item.status === 'ativa').length,
      confirmedRedemptions: redemptions.filter(item => item.status === 'confirmado').length,
      pointsRedeemed: redemptions.filter(item => item.status !== 'cancelado').reduce((sum, item) => sum + Number(item.pontos_resgatados || 0), 0),
    },
  };
}

export async function getCustomerLoyaltyStatus(db, { empresaId, lojaId, clienteId }) {
  requireScope({ empresaId, lojaId });
  requireUuid(clienteId, 'Cliente');
  const result = await db.query(
    `SELECT COALESCE(a.saldo_pontos, 0)::int AS saldo_pontos,
            COALESCE(a.pontos_acumulados, 0)::int AS pontos_acumulados,
            LEAST(COALESCE(a.saldo_pontos, 0), COALESCE(expiring.pontos, 0))::int AS pontos_a_expirar_30d,
            n.codigo AS nivel_codigo, n.nome AS nivel_nome, n.beneficios AS nivel_beneficios
       FROM commerce_customers c
       LEFT JOIN commerce_loyalty_accounts a
         ON a.empresa_id = c.empresa_id AND a.loja_id = $2 AND a.customer_id = c.id
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(l.pontos), 0)::int AS pontos
           FROM commerce_loyalty_ledger l
          WHERE l.empresa_id = c.empresa_id AND l.loja_id = $2 AND l.customer_id = c.id
            AND l.tipo = 'credito' AND l.expira_em > CURRENT_TIMESTAMP
            AND l.expira_em <= CURRENT_TIMESTAMP + INTERVAL '30 days'
       ) expiring ON true
       LEFT JOIN LATERAL (
         SELECT codigo, nome, beneficios
           FROM fidelidade_niveis_loja
          WHERE empresa_id = c.empresa_id AND loja_id = $2 AND ativo = true
            AND pontos_minimos <= COALESCE(a.pontos_acumulados, 0)
          ORDER BY pontos_minimos DESC LIMIT 1
       ) n ON true
      WHERE c.empresa_id = $1 AND c.id = $3 AND c.bloqueado = false`,
    [empresaId, lojaId, clienteId],
  );
  const status = result.rows[0];
  if (!status) throw new LoyaltyAdvancedError('Cliente não encontrado no tenant ativo.', 404, 'CUSTOMER_NOT_FOUND');
  if (!status.nivel_nome) {
    const virtual = defaultLoyaltyLevels().filter(level => level.ativo && level.pontos_minimos <= Number(status.pontos_acumulados || 0)).at(-1);
    return { ...status, nivel_codigo: virtual?.codigo || 'bronze', nivel_nome: virtual?.nome || 'Bronze', nivel_beneficios: virtual?.beneficios || [] };
  }
  return status;
}

export async function redeemReward(db, {
  empresaId, lojaId, clienteId, recompensaId, quantidade = 1,
  idempotencyKey, confirmar, observacao, usuarioId,
}) {
  requireScope({ empresaId, lojaId });
  if (!UUID_REGEX.test(clienteId || '') || !UUID_REGEX.test(recompensaId || '')) {
    throw new LoyaltyAdvancedError('Cliente ou recompensa inválida.');
  }
  if (confirmar !== true) throw new LoyaltyAdvancedError('Confirmação humana explícita é obrigatória.');
  const quantity = integer(quantidade, { min: 1, max: 20 });
  const key = normalizeIdempotencyKey(idempotencyKey);
  const client = await db.beginTransaction();
  try {
    await db.queryInTransaction(client, 'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${empresaId}:${key}`]);
    const replay = await db.queryInTransaction(
      client,
      `SELECT rr.*, r.nome AS recompensa_nome, c.nome AS cliente_nome
         FROM commerce_loyalty_reward_redemptions rr
         JOIN fidelidade_recompensas r ON r.id = rr.recompensa_id
         JOIN commerce_customers c ON c.id = rr.cliente_id AND c.empresa_id = rr.empresa_id
        WHERE rr.empresa_id = $1 AND rr.idempotency_key = $2
        FOR UPDATE OF rr`,
      [empresaId, key],
    );
    if (replay.rows[0]) {
      const existing = replay.rows[0];
      if (existing.loja_id !== lojaId
        || existing.cliente_id !== clienteId
        || existing.recompensa_id !== recompensaId
        || Number(existing.quantidade) !== quantity) {
        throw new LoyaltyAdvancedError('A chave de idempotência já foi usada com outro resgate.', 409, 'IDEMPOTENCY_CONFLICT');
      }
      await db.commit(client);
      return { redemption: existing, replay: true };
    }
    await assertStore(db, client, empresaId, lojaId);
    const customer = await db.queryInTransaction(client, 'SELECT id, nome FROM commerce_customers WHERE id = $1 AND empresa_id = $2 AND bloqueado = false FOR UPDATE', [clienteId, empresaId]);
    if (!customer.rows[0]) throw new LoyaltyAdvancedError('Cliente não encontrado no tenant ativo.', 404, 'CUSTOMER_NOT_FOUND');
    const config = await db.queryInTransaction(client, 'SELECT id FROM commerce_loyalty_settings WHERE empresa_id = $1 AND loja_id = $2 AND ativo = true FOR UPDATE', [empresaId, lojaId]);
    if (!config.rows[0]) throw new LoyaltyAdvancedError('Programa de fidelidade não está ativo nesta loja.', 409, 'LOYALTY_INACTIVE');
    const rewardResult = await db.queryInTransaction(
      client,
      `SELECT * FROM fidelidade_recompensas
        WHERE id = $1 AND empresa_id = $2 AND loja_id = $3
        FOR UPDATE`,
      [recompensaId, empresaId, lojaId],
    );
    const reward = rewardResult.rows[0];
    if (!reward) throw new LoyaltyAdvancedError('Recompensa não encontrada.', 404, 'REWARD_NOT_FOUND');
    if (reward.status !== 'ativa') throw new LoyaltyAdvancedError('Recompensa não está ativa.', 409, 'REWARD_INACTIVE');
    const now = Date.now();
    if (reward.inicio_em && new Date(reward.inicio_em).getTime() > now) throw new LoyaltyAdvancedError('Recompensa ainda não está disponível.', 409, 'REWARD_NOT_STARTED');
    if (reward.fim_em && new Date(reward.fim_em).getTime() <= now) throw new LoyaltyAdvancedError('Recompensa expirada.', 409, 'REWARD_EXPIRED');
    if (reward.estoque_total !== null && Number(reward.quantidade_resgatada) + quantity > Number(reward.estoque_total)) {
      throw new LoyaltyAdvancedError('Estoque da recompensa insuficiente.', 409, 'REWARD_OUT_OF_STOCK');
    }
    if (reward.limite_por_cliente !== null) {
      const used = await db.queryInTransaction(
        client,
        `SELECT COALESCE(SUM(quantidade), 0)::int AS total
           FROM commerce_loyalty_reward_redemptions
          WHERE empresa_id = $1 AND loja_id = $2 AND cliente_id = $3 AND recompensa_id = $4
            AND status IN ('confirmado', 'entregue')`,
        [empresaId, lojaId, clienteId, recompensaId],
      );
      if (Number(used.rows[0]?.total || 0) + quantity > Number(reward.limite_por_cliente)) {
        throw new LoyaltyAdvancedError('Limite de resgates por cliente excedido.', 409, 'CUSTOMER_REWARD_LIMIT');
      }
    }
    const points = Number(reward.custo_pontos) * quantity;
    const accountResult = await db.queryInTransaction(
      client,
      `SELECT id, saldo_pontos, pontos_acumulados
         FROM commerce_loyalty_accounts
        WHERE empresa_id = $1 AND loja_id = $2 AND customer_id = $3
        FOR UPDATE`,
      [empresaId, lojaId, clienteId],
    );
    const account = accountResult.rows[0];
    if (!account || Number(account.saldo_pontos) < points) {
      throw new LoyaltyAdvancedError('Saldo de pontos insuficiente.', 409, 'INSUFFICIENT_POINTS');
    }
    const redemptionId = randomUUID();
    const balanceAfter = Number(account.saldo_pontos) - points;
    const ledger = await db.queryInTransaction(
      client,
      `INSERT INTO commerce_loyalty_ledger
       (empresa_id, loja_id, account_id, customer_id, tipo, pontos, saldo_anterior,
        saldo_posterior, descricao, referencia_tipo, referencia_id, criado_por)
       VALUES ($1, $2, $3, $4, 'resgate', $5, $6, $7, $8, 'reward_redemption', $9, $10)
       RETURNING id`,
      [empresaId, lojaId, account.id, clienteId, -points, Number(account.saldo_pontos), balanceAfter,
        `Resgate de recompensa: ${reward.nome}`.slice(0, 240), redemptionId, usuarioId],
    );
    await db.queryInTransaction(
      client,
      `UPDATE commerce_loyalty_accounts
          SET saldo_pontos = $1, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $2 AND loja_id = $3 AND customer_id = $4`,
      [balanceAfter, empresaId, lojaId, clienteId],
    );
    await db.queryInTransaction(client, 'UPDATE fidelidade_recompensas SET quantidade_resgatada = quantidade_resgatada + $1 WHERE id = $2 AND empresa_id = $3 AND loja_id = $4', [quantity, recompensaId, empresaId, lojaId]);
    const inserted = await db.queryInTransaction(
      client,
      `INSERT INTO commerce_loyalty_reward_redemptions
       (id, empresa_id, loja_id, cliente_id, recompensa_id, ledger_debito_id,
        pontos_resgatados, quantidade, idempotency_key, observacao, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [redemptionId, empresaId, lojaId, clienteId, recompensaId, ledger.rows[0].id,
        points, quantity, key, text(observacao, 500), usuarioId],
    );
    await db.commit(client);
    return { redemption: { ...inserted.rows[0], recompensa_nome: reward.nome, cliente_nome: customer.rows[0].nome }, replay: false };
  } catch (error) {
    await db.rollback(client);
    throw error;
  }
}

export async function markRewardDelivered(db, { empresaId, lojaId, redemptionId, confirmar }) {
  requireScope({ empresaId, lojaId });
  requireUuid(redemptionId, 'resgate');
  if (confirmar !== true) throw new LoyaltyAdvancedError('Confirmação humana explícita é obrigatória.', 409, 'CONFIRMATION_REQUIRED');
  const client = await db.beginTransaction();
  try {
    const current = await db.queryInTransaction(
      client,
      `SELECT * FROM commerce_loyalty_reward_redemptions
        WHERE id = $1 AND empresa_id = $2 AND loja_id = $3
        FOR UPDATE`,
      [redemptionId, empresaId, lojaId],
    );
    const redemption = current.rows[0];
    if (!redemption) throw new LoyaltyAdvancedError('Resgate não encontrado.', 404, 'REDEMPTION_NOT_FOUND');
    if (redemption.status === 'entregue') {
      await db.commit(client);
      return { ...redemption, replay: true };
    }
    if (redemption.status === 'cancelado') throw new LoyaltyAdvancedError('Resgate cancelado não pode ser entregue.', 409, 'REDEMPTION_CANCELLED');
    const result = await db.queryInTransaction(
      client,
      `UPDATE commerce_loyalty_reward_redemptions
          SET status = 'entregue', entregue_em = CURRENT_TIMESTAMP
        WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 AND status = 'confirmado'
        RETURNING *`,
      [redemptionId, empresaId, lojaId],
    );
    if (!result.rows[0]) throw new LoyaltyAdvancedError('Resgate não está disponível para entrega.', 409, 'REDEMPTION_STATUS_INVALID');
    await db.commit(client);
    return { ...result.rows[0], replay: false };
  } catch (error) {
    await db.rollback(client);
    throw error;
  }
}

export async function cancelRewardRedemption(db, { empresaId, lojaId, redemptionId, confirmar, motivo, usuarioId }) {
  requireScope({ empresaId, lojaId });
  requireUuid(redemptionId, 'Resgate');
  if (confirmar !== true) throw new LoyaltyAdvancedError('Confirmação humana explícita é obrigatória.');
  const reason = text(motivo, 500, { required: true });
  const client = await db.beginTransaction();
  try {
    const result = await db.queryInTransaction(
      client,
      `SELECT rr.*, r.nome AS recompensa_nome
         FROM commerce_loyalty_reward_redemptions rr
         JOIN fidelidade_recompensas r ON r.id = rr.recompensa_id
        WHERE rr.id = $1 AND rr.empresa_id = $2 AND rr.loja_id = $3
        FOR UPDATE OF rr, r`,
      [redemptionId, empresaId, lojaId],
    );
    const redemption = result.rows[0];
    if (!redemption) throw new LoyaltyAdvancedError('Resgate não encontrado.', 404, 'REDEMPTION_NOT_FOUND');
    if (redemption.status === 'cancelado') {
      await db.commit(client);
      return { redemption, replay: true };
    }
    if (redemption.status === 'entregue') throw new LoyaltyAdvancedError('Recompensa já entregue não pode ser cancelada.', 409, 'REDEMPTION_DELIVERED');
    const accountResult = await db.queryInTransaction(
      client,
      `SELECT id, saldo_pontos
         FROM commerce_loyalty_accounts
        WHERE empresa_id = $1 AND loja_id = $2 AND customer_id = $3
        FOR UPDATE`,
      [empresaId, lojaId, redemption.cliente_id],
    );
    const account = accountResult.rows[0];
    if (!account) throw new LoyaltyAdvancedError('Conta de fidelidade não encontrada.', 409, 'LOYALTY_ACCOUNT_NOT_FOUND');
    const balanceAfter = Number(account.saldo_pontos) + Number(redemption.pontos_resgatados);
    await db.queryInTransaction(
      client,
      `INSERT INTO commerce_loyalty_ledger
       (empresa_id, loja_id, account_id, customer_id, tipo, pontos, saldo_anterior,
        saldo_posterior, descricao, referencia_tipo, referencia_id, criado_por)
       VALUES ($1, $2, $3, $4, 'estorno', $5, $6, $7, $8, 'reward_redemption', $9, $10)`,
      [empresaId, lojaId, account.id, redemption.cliente_id, Number(redemption.pontos_resgatados),
        Number(account.saldo_pontos), balanceAfter,
        `Estorno de recompensa: ${redemption.recompensa_nome}`.slice(0, 240), redemption.id, usuarioId],
    );
    await db.queryInTransaction(
      client,
      `UPDATE commerce_loyalty_accounts
          SET saldo_pontos = $1, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $2 AND loja_id = $3 AND customer_id = $4`,
      [balanceAfter, empresaId, lojaId, redemption.cliente_id],
    );
    await db.queryInTransaction(client, 'UPDATE fidelidade_recompensas SET quantidade_resgatada = GREATEST(0, quantidade_resgatada - $1) WHERE id = $2 AND empresa_id = $3 AND loja_id = $4', [redemption.quantidade, redemption.recompensa_id, empresaId, lojaId]);
    const updated = await db.queryInTransaction(
      client,
      `UPDATE commerce_loyalty_reward_redemptions
          SET status = 'cancelado', cancelado_em = CURRENT_TIMESTAMP,
              observacao = LEFT(CONCAT_WS(' | ', observacao, $1::text, $2::text), 500)
        WHERE id = $3 AND empresa_id = $4 AND loja_id = $5
        RETURNING *`,
      [reason, usuarioId ? `Cancelado por ${usuarioId}` : null, redemptionId, empresaId, lojaId],
    );
    await db.commit(client);
    return { redemption: updated.rows[0], replay: false };
  } catch (error) {
    await db.rollback(client);
    throw error;
  }
}

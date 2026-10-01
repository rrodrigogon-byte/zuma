import { verifyPhoneToken } from './phone-verification.js';
import { isWhatsappOptOutText, phoneMatchKeySql } from './whatsapp-phone.js';
import { createHash } from 'node:crypto';
import { CommerceError } from './commerce-error.js';
import { normalizeBrazilianPhone, resolveCommerceCustomer } from './commerce-customer-identity.js';
import { db } from './database.js';
import { enviarMensagem } from './whatsapp.js';
import { whatsappProviderConfigured } from './whatsapp-provider.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION = /^[A-Za-z0-9_-]{24,180}$/;
const DEFAULT_DELAY_MINUTES = Math.min(1440, Math.max(15, Number.parseInt(process.env.CART_RECOVERY_DELAY_MINUTES || '60', 10)));
const DEFAULT_ORIGIN = 'https://setpoint.kytto.com.br';

function fail(message, code = 'VALIDATION_ERROR') {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function clean(value, limit = 500) { return String(value || '').trim().replace(/\u0000/g, '').slice(0, limit); }
function uuid(value, field) { const normalized = clean(value, 60); if (!UUID.test(normalized)) fail(`${field} inválido`); return normalized; }
function sessionKey(value) { const normalized = clean(value, 180); if (!SESSION.test(normalized)) fail('sessionKey inválida'); return normalized; }
function sessionHash(value) { return createHash('sha256').update(sessionKey(value)).digest('hex'); }
export function normalizeCartPhone(value) {
  try { return normalizeBrazilianPhone(value) || ''; } catch { return ''; }
}
function publicOrigin() { return clean(process.env.PUBLIC_APP_URL || process.env.APP_PUBLIC_URL || process.env.SERVER_URL || DEFAULT_ORIGIN, 1000).replace(/\/$/, ''); }
function delayMinutes(value) { const parsed = Number.parseInt(value || DEFAULT_DELAY_MINUTES, 10); return Math.min(1440, Math.max(15, Number.isFinite(parsed) ? parsed : DEFAULT_DELAY_MINUTES)); }
function sourceAllowed(value) { const normalized = clean(value, 40).toLowerCase(); return ['checkout_checkbox', 'customer_request'].includes(normalized) ? normalized : ''; }
function safeEvidence(input = {}) {
  return {
    version: 'cart-recovery-v1',
    checkbox: input.checkbox === true,
    notice: clean(input.notice, 240),
    sourcePage: clean(input.sourcePage, 240),
    capturedAt: new Date().toISOString(),
  };
}
function normalizeItems(items) {
  if (!Array.isArray(items) || items.length > 50) fail('itens do carrinho inválidos');
  return items.map(item => {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100) fail('quantidade inválida');
    return { variantId: uuid(item.variantId, 'variantId'), quantity };
  });
}
async function activeChannel(trx, empresaId, lojaId) {
  const result = await trx.query(
    `SELECT * FROM canais_integracao
      WHERE empresa_id=$1 AND loja_id=$2 AND provedor='whatsapp' AND status='ativo'
      ORDER BY data_atualizacao DESC LIMIT 1`,
    [empresaId, lojaId],
  );
  return result.rows[0] || null;
}
async function resolveVariants(trx, empresaId, storefrontId, items) {
  const ids = [...new Set(items.map(item => item.variantId))];
  if (!ids.length) return [];
  const result = await trx.query(
    `SELECT DISTINCT ON (v.id) v.id, v.sku, p.nome AS product_name,
            COALESCE(vp.preco_promocional, vp.preco) AS price
       FROM commerce_product_variants v
       JOIN commerce_products p ON p.empresa_id=v.empresa_id AND p.id=v.product_id AND p.status='active'
       JOIN commerce_variant_prices vp ON vp.empresa_id=v.empresa_id AND vp.variant_id=v.id
       JOIN commerce_product_channels pc ON pc.empresa_id=v.empresa_id AND pc.product_id=p.id
        AND pc.storefront_id=$3 AND pc.price_list_id=vp.price_list_id AND pc.publicado=true
       JOIN commerce_price_lists pl ON pl.empresa_id=vp.empresa_id AND pl.id=vp.price_list_id AND pl.ativo=true AND pl.canal='web'
      WHERE v.empresa_id=$1 AND v.id=ANY($2::uuid[]) AND v.ativo=true
        AND vp.vigencia_inicio <= CURRENT_TIMESTAMP
        AND (vp.vigencia_fim IS NULL OR vp.vigencia_fim > CURRENT_TIMESTAMP)
      ORDER BY v.id, vp.vigencia_inicio DESC`,
    [empresaId, ids, storefrontId],
  );
  if (result.rows.length !== ids.length) fail('um ou mais itens não estão disponíveis', 'ITEM_UNAVAILABLE');
  return result.rows;
}
async function event(trx, { empresaId, lojaId, cartId, customerId, type, metadata = {} }) {
  await trx.query(
    `INSERT INTO commerce_cart_recovery_events (empresa_id,loja_id,cart_id,customer_id,tipo,metadados)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [empresaId, lojaId || null, cartId, customerId || null, type, JSON.stringify(metadata)],
  );
}

export async function syncPublicCart(context = {}, input = {}) {
  const empresaId = uuid(context.empresaId, 'empresaId');
  const lojaId = context.lojaId ? uuid(context.lojaId, 'lojaId') : null;
  const storefrontId = uuid(context.storefrontId, 'storefrontId');
  const hash = sessionHash(input.sessionKey);
  const items = normalizeItems(input.items || []);
  const requestedSyncVersion = Number(input.syncVersion);
  const clientSyncVersion = Number.isSafeInteger(requestedSyncVersion) && requestedSyncVersion >= 0 ? requestedSyncVersion : 0;
  let requestedConsent = null;
  if (input.recoveryConsent === true) {
    const source = sourceAllowed(input.recoverySource);
    const evidence = safeEvidence(input.recoveryEvidence);
    const contact = input.contact || {};
    if (!source || !evidence.checkbox || evidence.notice.length < 20) fail('consentimento de recuperação exige origem e evidência explícitas', 'CONSENT_EVIDENCE_REQUIRED');
    if (!clean(contact.name || contact.nome, 240) || !normalizeCartPhone(contact.phone || contact.telefone)) fail('nome e WhatsApp válidos são obrigatórios para o lembrete');
    // Número confirmado por código no WhatsApp: o lembrete pode ir mesmo sem conversa anterior.
    if (verifyPhoneToken(input.phoneVerificationToken, empresaId, contact.phone || contact.telefone)) evidence.phoneVerified = true;
    requestedConsent = { source, evidence, contact };
  }
  return db.transaction(async trx => {
    const customerResolution = requestedConsent && items.length
      ? await resolveCommerceCustomer(trx, { empresaId, lojaId, identitySource: 'cart_recovery' }, requestedConsent.contact)
      : null;
    await trx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`commerce-cart-sync:${empresaId}:${storefrontId}:${hash}`]);
    const existing = await trx.query(
      `SELECT * FROM commerce_carts WHERE empresa_id=$1 AND storefront_id=$2 AND session_key_hash=$3 ORDER BY CASE WHEN status='converted' THEN 0 ELSE 1 END, client_sync_version DESC, atualizado_em DESC LIMIT 1 FOR UPDATE`,
      [empresaId, storefrontId, hash],
    );
    if (existing.rows[0]?.status === 'converted') {
      return { status: 'converted', converted: true, orderId: existing.rows[0].converted_order_id || null, syncVersion: Number(existing.rows[0].client_sync_version || 0) };
    }
    const storedSyncVersion = Number(existing.rows[0]?.client_sync_version || 0);
    if (existing.rows[0] && storedSyncVersion > 0 && clientSyncVersion <= storedSyncVersion) {
      return { status: existing.rows[0].status, stale: true, syncVersion: storedSyncVersion };
    }
    if (!items.length) {
      if (!existing.rows[0]) {
        if (!clientSyncVersion) return { status: 'empty', itemCount: 0 };
        await trx.query(
          `INSERT INTO commerce_carts (empresa_id,storefront_id,session_key_hash,status,last_activity_at,expira_em,client_sync_version,recovery_status)
           VALUES ($1,$2,$3,'expired',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,$4,'expired')`,
          [empresaId, storefrontId, hash, clientSyncVersion],
        );
        return { status: 'expired', itemCount: 0, syncVersion: clientSyncVersion };
      }
      const cart = existing.rows[0];
      await trx.query(`DELETE FROM commerce_cart_items WHERE empresa_id=$1 AND cart_id=$2`, [empresaId, cart.id]);
      await trx.query(`UPDATE commerce_carts SET status='expired', recovery_status='expired', recovery_due_at=NULL, last_activity_at=CURRENT_TIMESTAMP, atualizado_em=CURRENT_TIMESTAMP, client_sync_version=$3 WHERE empresa_id=$1 AND id=$2`, [empresaId, cart.id, clientSyncVersion]);
      await trx.query(`UPDATE tarefas_integracao_canais SET status='cancelada', proxima_tentativa_em=NULL, data_atualizacao=CURRENT_TIMESTAMP WHERE empresa_id=$1 AND tipo='recuperar_carrinho' AND referencia_externa=$2 AND status IN ('pendente','falha')`, [empresaId, cart.id]);
      await event(trx, { empresaId, lojaId, cartId: cart.id, customerId: cart.customer_id, type: 'expired' });
      return { status: 'expired', itemCount: 0, syncVersion: clientSyncVersion };
    }
    const variants = await resolveVariants(trx, empresaId, storefrontId, items);
    const byId = new Map(variants.map(row => [row.id, row]));
    let cart = existing.rows[0];
    if (!cart) {
      const inserted = await trx.query(
        `INSERT INTO commerce_carts (empresa_id,storefront_id,session_key_hash,status,last_activity_at,expira_em,client_sync_version)
         VALUES ($1,$2,$3,'open',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+INTERVAL '7 days',$4) RETURNING *`,
        [empresaId, storefrontId, hash, clientSyncVersion],
      );
      cart = inserted.rows[0];
    } else {
      const updated = await trx.query(`UPDATE commerce_carts SET status='open', last_activity_at=CURRENT_TIMESTAMP, expira_em=CURRENT_TIMESTAMP+INTERVAL '7 days', atualizado_em=CURRENT_TIMESTAMP, client_sync_version=$3 WHERE empresa_id=$1 AND id=$2 RETURNING *`, [empresaId, cart.id, clientSyncVersion]);
      cart = updated.rows[0];
    }
    await trx.query(`DELETE FROM commerce_cart_items WHERE empresa_id=$1 AND cart_id=$2`, [empresaId, cart.id]);
    for (const item of items) {
      const variant = byId.get(item.variantId);
      await trx.query(
        `INSERT INTO commerce_cart_items (empresa_id,cart_id,variant_id,quantidade,preco_unitario) VALUES ($1,$2,$3,$4,$5)`,
        [empresaId, cart.id, item.variantId, item.quantity, variant.price],
      );
    }
    if (input.recoveryConsent === false && cart.recovery_consent_at) {
      await trx.query(`UPDATE commerce_carts SET recovery_revoked_at=CURRENT_TIMESTAMP,recovery_due_at=NULL,recovery_status='revoked',atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$1 AND id=$2`, [empresaId, cart.id]);
      await trx.query(`UPDATE tarefas_integracao_canais SET status='cancelada',proxima_tentativa_em=NULL,data_atualizacao=CURRENT_TIMESTAMP WHERE empresa_id=$1 AND tipo='recuperar_carrinho' AND referencia_externa=$2 AND status IN ('pendente','falha')`, [empresaId, cart.id]);
      await event(trx, { empresaId, lojaId, cartId: cart.id, customerId: cart.customer_id, type: 'revoked', metadata: { source: 'checkout_checkbox' } });
      return { status: 'revoked', itemCount: items.length };
    }
    if (input.recoveryConsent !== true) return { status: cart.recovery_status || 'not_requested', itemCount: items.length };
    const { source, evidence } = requestedConsent;
    const customer = customerResolution.customer;
    if (cart.customer_id && cart.customer_id !== customer.id) {
      throw new CommerceError('o carrinho já está associado a outro cliente', 'CONTACT_CONFLICT', { reason: 'cart_customer_mismatch' });
    }
    const dueMinutes = delayMinutes(input.delayMinutes);
    const updated = await trx.query(
      `UPDATE commerce_carts SET customer_id=$3,recovery_consent_at=CURRENT_TIMESTAMP,recovery_revoked_at=NULL,
          recovery_due_at=CURRENT_TIMESTAMP+($4::text||' minutes')::interval,recovery_status=CASE WHEN recovery_reminded_at IS NULL THEN 'consented' ELSE 'sent' END,
          recovery_source=$5,recovery_evidence=$6::jsonb,last_activity_at=CURRENT_TIMESTAMP,atualizado_em=CURRENT_TIMESTAMP
        WHERE empresa_id=$1 AND id=$2 RETURNING *`,
      [empresaId, cart.id, customer.id, dueMinutes, source, JSON.stringify(evidence)],
    );
    const channel = await activeChannel(trx, empresaId, lojaId);
    if (channel && !updated.rows[0].recovery_reminded_at) {
      const taskResult = await trx.query(
        `INSERT INTO tarefas_integracao_canais (empresa_id,loja_id,canal_id,tipo,referencia_externa,payload,status,proxima_tentativa_em)
         VALUES ($1,$2,$3,'recuperar_carrinho',$4,$5::jsonb,'pendente',$6)
         ON CONFLICT (empresa_id,tipo,referencia_externa) WHERE tipo='recuperar_carrinho'
         DO UPDATE SET canal_id=EXCLUDED.canal_id,payload=EXCLUDED.payload,proxima_tentativa_em=EXCLUDED.proxima_tentativa_em,data_atualizacao=CURRENT_TIMESTAMP
           WHERE tarefas_integracao_canais.status='pendente' AND tarefas_integracao_canais.tentativas=0
         RETURNING id`,
        [empresaId, lojaId, channel.id, cart.id, JSON.stringify({ cartId: cart.id }), updated.rows[0].recovery_due_at],
      );
      if (taskResult.rows[0]) {
        await trx.query(`UPDATE commerce_carts SET recovery_status='queued' WHERE empresa_id=$1 AND id=$2`, [empresaId, cart.id]);
        await event(trx, { empresaId, lojaId, cartId: cart.id, customerId: customer.id, type: 'queued', metadata: { dueAt: updated.rows[0].recovery_due_at } });
      } else {
        await event(trx, { empresaId, lojaId, cartId: cart.id, customerId: customer.id, type: 'consented', metadata: { taskAlreadyFinal: true } });
      }
      return { status: taskResult.rows[0] ? 'queued' : updated.rows[0].recovery_status, itemCount: items.length, recoveryDueAt: updated.rows[0].recovery_due_at, messagingReady: true };
    } else {
      await event(trx, { empresaId, lojaId, cartId: cart.id, customerId: customer.id, type: 'consented', metadata: { messagingReady: Boolean(channel) } });
    }
    return { status: updated.rows[0].recovery_status, itemCount: items.length, recoveryDueAt: updated.rows[0].recovery_due_at, messagingReady: Boolean(channel) };
  });
}

export async function markCartConverted(trx, context = {}, input = {}) {
  if (!input.cartSessionKey || !input.orderId) return null;
  const empresaId = uuid(context.empresaId, 'empresaId');
  const storefrontId = uuid(input.storefrontId, 'storefrontId');
  const orderId = uuid(input.orderId, 'orderId');
  const customerId = input.customerId ? uuid(input.customerId, 'customerId') : null;
  const hash = sessionHash(input.cartSessionKey);
  await trx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`commerce-cart-sync:${empresaId}:${storefrontId}:${hash}`]);
  const found = await trx.query(`SELECT * FROM commerce_carts WHERE empresa_id=$1 AND storefront_id=$2 AND session_key_hash=$3 ORDER BY CASE WHEN status='converted' THEN 0 ELSE 1 END, atualizado_em DESC LIMIT 1 FOR UPDATE`, [empresaId, storefrontId, hash]);
  let cart = found.rows[0];
  if (cart?.status === 'converted') {
    if (cart.converted_order_id && cart.converted_order_id !== orderId) throw new CommerceError('sessão de carrinho já convertida em outro pedido', 'CART_ALREADY_CONVERTED');
    return cart.id;
  }
  if (!cart) {
    const inserted = await trx.query(
      `INSERT INTO commerce_carts
        (empresa_id,storefront_id,customer_id,session_key_hash,status,recovery_status,converted_order_id,last_activity_at,expira_em)
       VALUES ($1,$2,$3,$4,'converted','converted',$5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       RETURNING *`,
      [empresaId, storefrontId, customerId, hash, orderId],
    );
    cart = inserted.rows[0];
  }
  if (cart.customer_id && customerId && cart.customer_id !== customerId) {
    throw new CommerceError('carrinho e pedido pertencem a clientes diferentes', 'CONTACT_CONFLICT', { reason: 'cart_order_customer_mismatch' });
  }
  const effectiveCustomerId = cart.customer_id || customerId;
  if (cart.status !== 'converted') await trx.query(`UPDATE commerce_carts SET customer_id=COALESCE(customer_id,$4),status='converted',recovery_status='converted',converted_order_id=$3,recovery_due_at=NULL,atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$1 AND id=$2`, [empresaId, cart.id, orderId, customerId]);
  await trx.query(`UPDATE tarefas_integracao_canais SET status='cancelada',proxima_tentativa_em=NULL,data_atualizacao=CURRENT_TIMESTAMP WHERE empresa_id=$1 AND tipo='recuperar_carrinho' AND referencia_externa=$2 AND status IN ('pendente','falha')`, [empresaId, cart.id]);
  await event(trx, { empresaId, lojaId: context.lojaId, cartId: cart.id, customerId: effectiveCustomerId, type: 'converted', metadata: { orderId } });
  return cart.id;
}

export async function enqueueDueCartRecoveries(limit = 100) {
  const take = Math.min(500, Math.max(1, Number(limit) || 100));
  return db.transaction(async trx => {
    const queued = await trx.query(
      `WITH eligible AS (
         SELECT c.empresa_id,c.id AS cart_id,s.loja_id,ci.id AS canal_id
           FROM commerce_carts c
           JOIN commerce_storefronts s ON s.empresa_id=c.empresa_id AND s.id=c.storefront_id
           JOIN LATERAL (
             SELECT id FROM canais_integracao
              WHERE empresa_id=c.empresa_id AND loja_id=s.loja_id AND provedor='whatsapp' AND status='ativo'
              ORDER BY data_atualizacao DESC LIMIT 1
           ) ci ON true
          WHERE c.status IN ('open','abandoned') AND c.recovery_status='consented'
            AND c.recovery_consent_at IS NOT NULL AND c.recovery_revoked_at IS NULL AND c.recovery_reminded_at IS NULL
            AND c.recovery_due_at <= CURRENT_TIMESTAMP
          ORDER BY c.recovery_due_at ASC
          LIMIT $1
       ), inserted AS (
         INSERT INTO tarefas_integracao_canais (empresa_id,loja_id,canal_id,tipo,referencia_externa,payload,status,proxima_tentativa_em)
         SELECT empresa_id,loja_id,canal_id,'recuperar_carrinho',cart_id::text,jsonb_build_object('cartId',cart_id),'pendente',CURRENT_TIMESTAMP
           FROM eligible
         ON CONFLICT (empresa_id,tipo,referencia_externa) WHERE tipo='recuperar_carrinho' DO NOTHING
         RETURNING empresa_id,loja_id,referencia_externa::uuid AS cart_id
       )
       UPDATE commerce_carts c SET recovery_status='queued',atualizado_em=CURRENT_TIMESTAMP
         FROM inserted i WHERE c.empresa_id=i.empresa_id AND c.id=i.cart_id
       RETURNING c.empresa_id,c.id,c.customer_id,i.loja_id`,
      [take],
    );
    for (const row of queued.rows) await event(trx, { empresaId: row.empresa_id, lojaId: row.loja_id, cartId: row.id, customerId: row.customer_id, type: 'queued', metadata: { source: 'worker_sweep' } });
    return queued.rowCount || 0;
  });
}

function cartDeliveryError(message, code, retryable = false) {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  return error;
}

export async function processCartRecoveryTask(task = {}) {
  const cartId = uuid(task.referencia_externa, 'cartId');
  if (task.delivery_started_at) throw cartDeliveryError('resultado anterior do lembrete incerto; revisão humana obrigatória', 'CART_RECOVERY_DELIVERY_UNKNOWN', false);
  const snapshot = await db.transaction(async trx => {
    const locked = await trx.query(
      `SELECT * FROM commerce_carts WHERE empresa_id=$1 AND id=$2 FOR UPDATE`,
      [task.empresa_id, cartId],
    );
    if (!locked.rows[0]) return { skipped: true, reason: 'cart_not_found' };
    const result = await trx.query(
      `SELECT c.*, s.loja_id, s.nome AS storefront_name, a.alias, cu.nome AS customer_name, cu.telefone,
              ci.api_base_url, ci.configuracao, ci.nome AS channel_name,
              COALESCE(jsonb_agg(jsonb_build_object('nome',p.nome,'quantidade',i.quantidade) ORDER BY i.criado_em) FILTER (WHERE i.id IS NOT NULL),'[]'::jsonb) AS items
         FROM commerce_carts c
         JOIN commerce_storefronts s ON s.empresa_id=c.empresa_id AND s.id=c.storefront_id
         LEFT JOIN commerce_storefront_aliases a ON a.empresa_id=c.empresa_id AND a.storefront_id=c.storefront_id AND a.ativo=true
         LEFT JOIN commerce_customers cu ON cu.empresa_id=c.empresa_id AND cu.id=c.customer_id
         LEFT JOIN commerce_cart_items i ON i.empresa_id=c.empresa_id AND i.cart_id=c.id
         LEFT JOIN commerce_product_variants v ON v.empresa_id=i.empresa_id AND v.id=i.variant_id
         LEFT JOIN commerce_products p ON p.empresa_id=v.empresa_id AND p.id=v.product_id
         LEFT JOIN canais_integracao ci ON ci.id=$2 AND ci.empresa_id=c.empresa_id AND ci.loja_id=s.loja_id AND ci.status='ativo'
        WHERE c.empresa_id=$1 AND c.id=$3
        GROUP BY c.id,s.loja_id,s.nome,a.alias,cu.id,ci.id`,
      [task.empresa_id, task.canal_id, cartId],
    );
    const cart = result.rows[0];
    if (!['open','abandoned'].includes(cart.status) || !['consented','queued'].includes(cart.recovery_status)) return { skipped: true, reason: 'cart_not_eligible' };
    if (!cart.recovery_consent_at || cart.recovery_revoked_at || cart.recovery_reminded_at) return { skipped: true, reason: 'consent_not_active' };
    if (new Date(cart.recovery_due_at || 0).getTime() > Date.now()) fail('lembrete ainda não venceu', 'CART_RECOVERY_NOT_DUE');
    if (!cart.telefone || !(whatsappProviderConfigured() || process.env.EVOLUTION_API_URL || cart.api_base_url)) fail('canal ou contato de recuperação indisponível', 'MESSAGING_NOT_READY');
    await trx.query(`UPDATE commerce_carts SET status='abandoned',recovery_status='queued',atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$1 AND id=$2`, [cart.empresa_id, cart.id]);
    return cart;
  });
  if (snapshot.skipped) return snapshot;
  const items = Array.isArray(snapshot.items) ? snapshot.items.slice(0, 3).map(item => `${Number(item.quantidade)}× ${item.nome}`).join(', ') : '';
  const alias = clean(snapshot.alias || '', 80);
  const resumeUrl = alias ? `${publicOrigin()}/ecommerce/${encodeURIComponent(alias)}` : publicOrigin();
  const message = `Olá, ${clean(snapshot.customer_name, 80)}. Você deixou ${items || 'itens'} no carrinho da ${clean(snapshot.storefront_name, 120)}. Se quiser concluir, retome em ${resumeUrl}. Para não receber lembretes deste carrinho, responda SAIR.`;
  await db.query(
    `UPDATE tarefas_integracao_canais SET delivery_started_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'processando' AND lease_token = $2::uuid`,
    [task.id, task.lease_token],
  );
  const sent = await enviarMensagem({
    whatsapp_api_url: process.env.EVOLUTION_API_URL || snapshot.api_base_url,
    whatsapp_api_key: process.env.EVOLUTION_API_KEY,
    whatsapp_instance: snapshot.configuracao?.instance || process.env.EVOLUTION_INSTANCE,
  }, snapshot.telefone, message);
  if (!sent?.ok) {
    const unknown = sent?.uncertain === true;
    if (!unknown) await db.query(`UPDATE tarefas_integracao_canais SET delivery_started_at = NULL WHERE id = $1`, [task.id]);
    throw cartDeliveryError(unknown ? 'resultado do lembrete incerto' : 'falha ao enviar lembrete pelo provedor', unknown ? 'CART_RECOVERY_DELIVERY_UNKNOWN' : 'CART_RECOVERY_SEND_FAILED', !unknown && sent?.retryable === true);
  }
  const providerId = clean(sent?.data?.key?.id || sent?.data?.id || '', 200) || null;
  await db.transaction(async trx => {
    await trx.query(`UPDATE commerce_carts SET recovery_status='sent',recovery_reminded_at=CURRENT_TIMESTAMP,recovery_provider_id=$3,atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$1 AND id=$2 AND recovery_reminded_at IS NULL`, [snapshot.empresa_id, snapshot.id, providerId]);
    await trx.query(`UPDATE tarefas_integracao_canais SET provider_message_id=$2 WHERE id=$1`, [task.id, providerId]);
    await event(trx, { empresaId: snapshot.empresa_id, lojaId: snapshot.loja_id, cartId: snapshot.id, customerId: snapshot.customer_id, type: 'sent', metadata: { providerId } });
  });
  return { sent: true, providerMessageId: providerId, cartId: snapshot.id };
}

export async function recordCartRecoveryOptOut(channel = {}, parsed = {}) {
  const phone = normalizeCartPhone(parsed.phone || parsed.remoteJid);
  const command = clean(parsed.text, 80).toUpperCase().replace(/[.!?]+$/g, '').trim();
  if (!phone || !isWhatsappOptOutText(command)) return { optedOut: false };
  const empresaId = uuid(channel.empresa_id, 'empresaId');
  const lojaId = uuid(channel.loja_id, 'lojaId');
  return db.transaction(async trx => {
    const carts = await trx.query(
      `SELECT c.* FROM commerce_carts c JOIN commerce_customers cu ON cu.empresa_id=c.empresa_id AND cu.id=c.customer_id
        JOIN commerce_storefronts s ON s.empresa_id=c.empresa_id AND s.id=c.storefront_id
       WHERE c.empresa_id=$1 AND s.loja_id=$2 AND c.status IN ('open','abandoned')
         AND ${phoneMatchKeySql('cu.telefone')} = ${phoneMatchKeySql('$3')}
         AND c.recovery_status IN ('consented','queued','sent') FOR UPDATE`,
      [empresaId, lojaId, phone],
    );
    for (const cart of carts.rows) {
      await trx.query(`UPDATE commerce_carts SET recovery_status='revoked',recovery_revoked_at=CURRENT_TIMESTAMP,recovery_due_at=NULL,atualizado_em=CURRENT_TIMESTAMP WHERE empresa_id=$1 AND id=$2`, [empresaId, cart.id]);
      await trx.query(`UPDATE tarefas_integracao_canais SET status='cancelada',proxima_tentativa_em=NULL,data_atualizacao=CURRENT_TIMESTAMP WHERE empresa_id=$1 AND tipo='recuperar_carrinho' AND referencia_externa=$2 AND status IN ('pendente','falha')`, [empresaId, cart.id]);
      await event(trx, { empresaId, lojaId, cartId: cart.id, customerId: cart.customer_id, type: 'revoked', metadata: { source: 'whatsapp_opt_out', externalId: clean(parsed.externalId, 200) } });
    }
    return { optedOut: carts.rowCount > 0, carts: carts.rowCount };
  });
}

export async function listAbandonedCarts(context = {}, { limit = 50, offset = 0 } = {}) {
  const empresaId = uuid(context.empresaId, 'empresaId');
  const lojaId = uuid(context.lojaId, 'lojaId');
  const take = Math.min(100, Math.max(1, Number(limit) || 50));
  const skip = Math.max(0, Number(offset) || 0);
  const result = await db.query(
    `SELECT c.id,c.status,c.recovery_status,c.last_activity_at,c.recovery_due_at,c.recovery_reminded_at,c.recovery_revoked_at,
            cu.nome AS customer_name,CASE WHEN cu.telefone IS NULL THEN NULL ELSE '***'||right(regexp_replace(cu.telefone,'\\D','','g'),4) END AS phone_masked,
            COUNT(i.id)::int AS item_count,COALESCE(SUM(i.quantidade*i.preco_unitario),0)::numeric AS subtotal,
            COUNT(*) OVER()::int AS total_count
       FROM commerce_carts c
       JOIN commerce_storefronts s ON s.empresa_id=c.empresa_id AND s.id=c.storefront_id AND s.loja_id=$2
       LEFT JOIN commerce_customers cu ON cu.empresa_id=c.empresa_id AND cu.id=c.customer_id
       LEFT JOIN commerce_cart_items i ON i.empresa_id=c.empresa_id AND i.cart_id=c.id
      WHERE c.empresa_id=$1 AND c.status IN ('open','abandoned','converted','expired')
      GROUP BY c.id,cu.id
      ORDER BY c.last_activity_at DESC LIMIT $3 OFFSET $4`,
    [empresaId, lojaId, take, skip],
  );
  return { items: result.rows, pagination: { limit: take, offset: skip, total: Number(result.rows[0]?.total_count || 0) } };
}

export async function cartRecoveryMetrics(context = {}) {
  const empresaId = uuid(context.empresaId, 'empresaId');
  const lojaId = uuid(context.lojaId, 'lojaId');
  const result = await db.query(
    `SELECT COUNT(DISTINCT c.id) FILTER (WHERE c.status IN ('open','abandoned'))::int AS active,
            COUNT(DISTINCT c.id) FILTER (WHERE c.recovery_status='queued')::int AS queued,
            COUNT(DISTINCT c.id) FILTER (WHERE c.recovery_status='sent')::int AS sent,
            COUNT(DISTINCT c.id) FILTER (WHERE c.recovery_status='converted')::int AS converted,
            COUNT(DISTINCT c.id) FILTER (WHERE c.recovery_status='revoked')::int AS revoked,
            COALESCE(SUM(i.quantidade*i.preco_unitario) FILTER (WHERE c.status IN ('open','abandoned')),0)::numeric AS open_value
       FROM commerce_carts c
       JOIN commerce_storefronts s ON s.empresa_id=c.empresa_id AND s.id=c.storefront_id AND s.loja_id=$2
       LEFT JOIN commerce_cart_items i ON i.empresa_id=c.empresa_id AND i.cart_id=c.id
      WHERE c.empresa_id=$1`,
    [empresaId, lojaId],
  );
  return result.rows[0] || { active: 0, queued: 0, sent: 0, converted: 0, revoked: 0, open_value: 0 };
}

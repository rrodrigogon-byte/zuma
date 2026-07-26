/**
 * Controllers do Módulo BILLING - Assinatura
 * SetPoint Ultra - Faturamento SaaS com Stripe e Mercado Pago
 */

import { db } from '../../../core/database.js';
import Stripe from 'stripe';
import mercadopago from 'mercadopago';
import { config } from '../../../config.js';

const stripe = new Stripe(config.billing.stripe.secretKey);
mercadopago.configure({ access_token: config.billing.mercadopago.accessToken });

// ============================================================================
// PLANOS E ASSINATURA
// ============================================================================

/**
 * Obter planos disponíveis
 */
export const obterPlanos = async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT * FROM planos_assinatura
      WHERE ativo = true
      ORDER BY preco ASC
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao obter planos:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Criar assinatura
 */
export const criarAssinatura = async (req, res) => {
  try {
    const { plano_id, metodo_pagamento, dados_pagamento } = req.body;
    const tenantId = req.tenantId;

    // Obter plano
    const planoResult = await db.query(
      `
      SELECT * FROM planos_assinatura
      WHERE id = $1 AND ativo = true
      `,
      [plano_id]
    );

    if (planoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    const plano = planoResult.rows[0];

    // Obter tenant
    const tenantResult = await db.query(
      `
      SELECT * FROM tenants WHERE id = $1
      `,
      [tenantId]
    );

    const tenant = tenantResult.rows[0];

    let assinatura = null;

    if (metodo_pagamento === 'stripe') {
      assinatura = await criarAssinaturaStripe(tenant, plano, dados_pagamento);
    } else if (metodo_pagamento === 'mercadopago') {
      assinatura = await criarAssinaturaMercadoPago(tenant, plano, dados_pagamento);
    } else {
      return res.status(400).json({ error: 'Método de pagamento inválido' });
    }

    // Registrar assinatura no banco
    const result = await db.query(
      `
      INSERT INTO assinaturas (
        tenant_id, plano_id, metodo_pagamento, id_externo,
        status, data_inicio, data_proxima_cobranca, valor_mensal
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '1 month', $6)
      RETURNING *
      `,
      [tenantId, plano_id, metodo_pagamento, assinatura.id_externo, 'ativa', plano.preco]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar assinatura:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Criar assinatura com Stripe
 */
const criarAssinaturaStripe = async (tenant, plano, dados) => {
  try {
    // Criar cliente Stripe
    const customer = await stripe.customers.create({
      email: tenant.email,
      name: tenant.nome,
      metadata: {
        tenant_id: tenant.id,
      },
    });

    // Criar assinatura
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: plano.nome,
              description: plano.descricao,
            },
            unit_amount: Math.round(plano.preco * 100),
            recurring: {
              interval: 'month',
              interval_count: 1,
            },
          },
        },
      ],
      payment_method: dados.payment_method_id,
      off_session: true,
    });

    return {
      id_externo: subscription.id,
      customer_id: customer.id,
      status: subscription.status,
    };
  } catch (error) {
    console.error('Erro ao criar assinatura Stripe:', error);
    throw error;
  }
};

/**
 * Criar assinatura com Mercado Pago
 */
const criarAssinaturaMercadoPago = async (tenant, plano, dados) => {
  try {
    const subscription = await mercadopago.subscriptions.create({
      payer_email: tenant.email,
      card_token_id: dados.card_token,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: plano.preco,
        currency_id: 'BRL',
      },
      back_url: `${config.server.url}/assinatura/confirmacao`,
    });

    return {
      id_externo: subscription.id,
      status: subscription.status,
    };
  } catch (error) {
    console.error('Erro ao criar assinatura Mercado Pago:', error);
    throw error;
  }
};

/**
 * Cancelar assinatura
 */
export const cancelarAssinatura = async (req, res) => {
  try {
    const { assinatura_id } = req.params;
    const tenantId = req.tenantId;

    // Obter assinatura
    const assinaturaResult = await db.query(
      `
      SELECT * FROM assinaturas
      WHERE id = $1 AND tenant_id = $2
      `,
      [assinatura_id, tenantId]
    );

    if (assinaturaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assinatura não encontrada' });
    }

    const assinatura = assinaturaResult.rows[0];

    // Cancelar com provedor
    if (assinatura.metodo_pagamento === 'stripe') {
      await stripe.subscriptions.cancel(assinatura.id_externo);
    } else if (assinatura.metodo_pagamento === 'mercadopago') {
      await mercadopago.subscriptions.cancel(assinatura.id_externo);
    }

    // Atualizar status
    const result = await db.query(
      `
      UPDATE assinaturas
      SET status = 'cancelada', data_cancelamento = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [assinatura_id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obter assinatura atual
 */
export const obterAssinaturatual = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      SELECT a.*, p.nome as plano_nome, p.descricao as plano_descricao,
             p.modulos as plano_modulos
      FROM assinaturas a
      JOIN planos_assinatura p ON a.plano_id = p.id
      WHERE a.tenant_id = $1 AND a.status = 'ativa'
      LIMIT 1
      `,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nenhuma assinatura ativa' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter assinatura:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// FATURAS
// ============================================================================

/**
 * Obter faturas
 */
export const obterFaturas = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      SELECT * FROM faturas
      WHERE tenant_id = $1
      ORDER BY data_emissao DESC
      LIMIT 50
      `,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao obter faturas:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  obterPlanos,
  criarAssinatura,
  cancelarAssinatura,
  obterAssinaturatual,
  obterFaturas,
};

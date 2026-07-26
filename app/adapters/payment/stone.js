/**
 * Adaptador Stone
 * Integração com Stone para processamento de pagamentos
 */

import axios from 'axios';
import { config } from '../../config.js';
import { db } from '../../core/database.js';

const stoneAPI = axios.create({
  baseURL: config.payment.stone.apiUrl,
  headers: {
    'Authorization': `Bearer ${config.payment.stone.apiKey}`,
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// PROCESSAMENTO DE PAGAMENTO
// ============================================================================

/**
 * Processar pagamento com cartão de crédito
 */
export const processarCartaoCredito = async (pagamentoData) => {
  try {
    const {
      tenantId,
      valor,
      cartao,
      cliente,
      descricao,
      referencia,
    } = pagamentoData;

    // Obter configurações Stone do tenant
    const configResult = await db.query(
      `
      SELECT api_key, merchant_id, terminal_id
      FROM configuracoes_adquirentes
      WHERE estabelecimento_id = $1 AND adquirente = 'stone' AND ativo = true
      `,
      [tenantId]
    );

    if (configResult.rows.length === 0) {
      throw new Error('Configuração Stone não encontrada');
    }

    const config_stone = configResult.rows[0];

    // Montar payload
    const payload = {
      amount: Math.round(valor * 100), // Converter para centavos
      payment_method: 'card',
      card: {
        number: cartao.numero.replace(/\s/g, ''),
        holder_name: cartao.titular,
        expiration_month: cartao.mes,
        expiration_year: cartao.ano,
        cvv: cartao.cvv,
      },
      customer: {
        name: cliente.nome,
        email: cliente.email,
        phone: cliente.telefone,
        document: cliente.cpf,
      },
      description: descricao,
      reference_id: referencia,
    };

    // Enviar para Stone
    const response = await stoneAPI.post('/transactions', payload);

    if (response.data.status === 'approved') {
      return {
        sucesso: true,
        idTransacao: response.data.id,
        idAutorizacao: response.data.authorization_code,
        nsu: response.data.nsu,
        bandeira: response.data.card.brand,
        ultimosDigitos: response.data.card.last_four_digits,
        valor: response.data.amount / 100,
        dataAprovacao: response.data.created_at,
      };
    } else if (response.data.status === 'declined') {
      throw new Error(`Pagamento recusado: ${response.data.decline_reason}`);
    } else {
      throw new Error(`Status desconhecido: ${response.data.status}`);
    }
  } catch (error) {
    console.error('Erro ao processar cartão de crédito via Stone:', error);
    throw error;
  }
};

/**
 * Processar pagamento com cartão de débito
 */
export const processarCartaoDebito = async (pagamentoData) => {
  try {
    const {
      tenantId,
      valor,
      cartao,
      cliente,
      descricao,
      referencia,
    } = pagamentoData;

    // Obter configurações Stone do tenant
    const configResult = await db.query(
      `
      SELECT api_key, merchant_id, terminal_id
      FROM configuracoes_adquirentes
      WHERE estabelecimento_id = $1 AND adquirente = 'stone' AND ativo = true
      `,
      [tenantId]
    );

    if (configResult.rows.length === 0) {
      throw new Error('Configuração Stone não encontrada');
    }

    // Montar payload
    const payload = {
      amount: Math.round(valor * 100),
      payment_method: 'debit_card',
      card: {
        number: cartao.numero.replace(/\s/g, ''),
        holder_name: cartao.titular,
        expiration_month: cartao.mes,
        expiration_year: cartao.ano,
        cvv: cartao.cvv,
      },
      customer: {
        name: cliente.nome,
        email: cliente.email,
        phone: cliente.telefone,
        document: cliente.cpf,
      },
      description: descricao,
      reference_id: referencia,
    };

    // Enviar para Stone
    const response = await stoneAPI.post('/transactions', payload);

    if (response.data.status === 'approved') {
      return {
        sucesso: true,
        idTransacao: response.data.id,
        idAutorizacao: response.data.authorization_code,
        nsu: response.data.nsu,
        bandeira: response.data.card.brand,
        ultimosDigitos: response.data.card.last_four_digits,
        valor: response.data.amount / 100,
        dataAprovacao: response.data.created_at,
      };
    } else {
      throw new Error(`Pagamento recusado: ${response.data.decline_reason}`);
    }
  } catch (error) {
    console.error('Erro ao processar cartão de débito via Stone:', error);
    throw error;
  }
};

/**
 * Processar Pix dinâmico
 */
export const processarPix = async (pagamentoData) => {
  try {
    const {
      tenantId,
      valor,
      cliente,
      descricao,
      referencia,
    } = pagamentoData;

    // Obter configurações Stone do tenant
    const configResult = await db.query(
      `
      SELECT api_key
      FROM configuracoes_adquirentes
      WHERE estabelecimento_id = $1 AND adquirente = 'stone' AND ativo = true
      `,
      [tenantId]
    );

    if (configResult.rows.length === 0) {
      throw new Error('Configuração Stone não encontrada');
    }

    // Montar payload para Pix
    const payload = {
      amount: Math.round(valor * 100),
      payment_method: 'pix',
      pix: {
        expires_in: 3600, // 1 hora
      },
      customer: {
        name: cliente.nome,
        email: cliente.email,
        phone: cliente.telefone,
        document: cliente.cpf,
      },
      description: descricao,
      reference_id: referencia,
    };

    // Enviar para Stone
    const response = await stoneAPI.post('/transactions', payload);

    if (response.data.status === 'pending') {
      return {
        sucesso: true,
        idTransacao: response.data.id,
        qrCode: response.data.pix.qr_code,
        qrCodeUrl: response.data.pix.qr_code_url,
        chavePix: response.data.pix.pix_key,
        expiresIn: response.data.pix.expires_in,
        valor: response.data.amount / 100,
      };
    } else {
      throw new Error(`Erro ao gerar Pix: ${response.data.status}`);
    }
  } catch (error) {
    console.error('Erro ao processar Pix via Stone:', error);
    throw error;
  }
};

// ============================================================================
// CONSULTA E REEMBOLSO
// ============================================================================

/**
 * Consultar status de transação
 */
export const consultarTransacao = async (idTransacao) => {
  try {
    const response = await stoneAPI.get(`/transactions/${idTransacao}`);

    return {
      idTransacao: response.data.id,
      status: response.data.status,
      valor: response.data.amount / 100,
      metodo: response.data.payment_method,
      dataAprovacao: response.data.created_at,
      idAutorizacao: response.data.authorization_code,
    };
  } catch (error) {
    console.error('Erro ao consultar transação:', error);
    throw error;
  }
};

/**
 * Reembolsar transação
 */
export const reembolsarTransacao = async (idTransacao, valor) => {
  try {
    const payload = {
      amount: valor ? Math.round(valor * 100) : undefined,
    };

    const response = await stoneAPI.post(
      `/transactions/${idTransacao}/refunds`,
      payload
    );

    return {
      idReembolso: response.data.id,
      status: response.data.status,
      valor: response.data.amount / 100,
      dataReembolso: response.data.created_at,
    };
  } catch (error) {
    console.error('Erro ao reembolsar transação:', error);
    throw error;
  }
};

// ============================================================================
// RECONCILIAÇÃO
// ============================================================================

/**
 * Reconciliar transações do dia
 */
export const reconciliarTransacoes = async (tenantId, data) => {
  try {
    // Obter configurações Stone
    const configResult = await db.query(
      `
      SELECT api_key
      FROM configuracoes_adquirentes
      WHERE estabelecimento_id = $1 AND adquirente = 'stone' AND ativo = true
      `,
      [tenantId]
    );

    if (configResult.rows.length === 0) {
      throw new Error('Configuração Stone não encontrada');
    }

    // Buscar transações do dia
    const dataFormatada = data.toISOString().split('T')[0];
    const response = await stoneAPI.get('/transactions', {
      params: {
        created_at_start: `${dataFormatada}T00:00:00Z`,
        created_at_end: `${dataFormatada}T23:59:59Z`,
      },
    });

    const transacoes = response.data.data || [];

    // Calcular totais
    const totais = {
      total: 0,
      aprovadas: 0,
      recusadas: 0,
      pendentes: 0,
    };

    transacoes.forEach((transacao) => {
      const valor = transacao.amount / 100;

      if (transacao.status === 'approved') {
        totais.aprovadas += valor;
      } else if (transacao.status === 'declined') {
        totais.recusadas += valor;
      } else if (transacao.status === 'pending') {
        totais.pendentes += valor;
      }

      totais.total += valor;
    });

    // Armazenar reconciliação
    await db.query(
      `
      INSERT INTO reconciliacao_pagamentos 
      (estabelecimento_id, adquirente, data_reconciliacao, total_transacoes, 
       total_confirmado, total_pendente, total_recusado, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'reconciliado')
      ON CONFLICT (estabelecimento_id, adquirente, data_reconciliacao) 
      DO UPDATE SET
        total_transacoes = $4,
        total_confirmado = $5,
        total_pendente = $6,
        total_recusado = $7,
        atualizado_em = NOW()
      `,
      [
        tenantId,
        'stone',
        data,
        totais.total,
        totais.aprovadas,
        totais.pendentes,
        totais.recusadas,
      ]
    );

    return totais;
  } catch (error) {
    console.error('Erro ao reconciliar transações:', error);
    throw error;
  }
};

// ============================================================================
// WEBHOOK HANDLERS
// ============================================================================

/**
 * Processar webhook de Stone
 */
export const processarWebhook = async (payload) => {
  try {
    const { event, data } = payload;

    switch (event) {
      case 'transaction.approved':
        // Atualizar pagamento para aprovado
        await db.query(
          `
          UPDATE pagamentos
          SET status = 'aprovado', data_confirmacao = NOW()
          WHERE id_transacao_adquirente = $1
          `,
          [data.id]
        );
        break;

      case 'transaction.declined':
        // Atualizar pagamento para recusado
        await db.query(
          `
          UPDATE pagamentos
          SET status = 'recusado'
          WHERE id_transacao_adquirente = $1
          `,
          [data.id]
        );
        break;

      case 'transaction.refunded':
        // Atualizar pagamento para reembolsado
        await db.query(
          `
          UPDATE pagamentos
          SET status = 'cancelado'
          WHERE id_transacao_adquirente = $1
          `,
          [data.id]
        );
        break;

      default:
        console.log(`Evento desconhecido: ${event}`);
    }

    return { sucesso: true };
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    throw error;
  }
};

export default {
  processarCartaoCredito,
  processarCartaoDebito,
  processarPix,
  consultarTransacao,
  reembolsarTransacao,
  reconciliarTransacoes,
  processarWebhook,
};

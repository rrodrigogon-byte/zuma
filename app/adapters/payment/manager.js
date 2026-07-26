/**
 * Gerenciador de Pagamentos Multiadquirente
 * SetPoint Ultra - Suporte a Stone, Cielo, PagBank, Mercado Pago
 */

import { db } from '../../core/database.js';
import * as stoneAdapter from './stone.js';
import * as cieloAdapter from './cielo.js';
import * as pagbankAdapter from './pagbank.js';
import { config } from '../../config.js';

// ============================================================================
// PROCESSAMENTO DE PAGAMENTO COM FALLBACK
// ============================================================================

/**
 * Processar pagamento com suporte a múltiplas adquirentes
 */
export const processarPagamento = async (pagamentoData) => {
  try {
    const { tenantId, tipo_pagamento, adquirente, valor } = pagamentoData;

    // Obter adquirentes ativas para o tenant
    const adquirentesResult = await db.query(
      `
      SELECT * FROM configuracoes_adquirentes
      WHERE estabelecimento_id = $1 AND ativo = true
      ORDER BY prioridade ASC
      `,
      [tenantId]
    );

    if (adquirentesResult.rows.length === 0) {
      throw new Error('Nenhuma adquirente configurada');
    }

    const adquirentes = adquirentesResult.rows;
    let resultado = null;
    let erros = [];

    // Tentar com adquirente especificada primeiro
    if (adquirente) {
      const adqEspecificada = adquirentes.find((a) => a.adquirente === adquirente);
      if (adqEspecificada) {
        try {
          resultado = await processarComAdquirente(
            tipo_pagamento,
            adqEspecificada.adquirente,
            pagamentoData
          );
          if (resultado.sucesso) {
            return resultado;
          }
        } catch (error) {
          erros.push({
            adquirente: adqEspecificada.adquirente,
            erro: error.message,
          });
        }
      }
    }

    // Tentar com outras adquirentes em ordem de prioridade
    for (const adq of adquirentes) {
      if (adquirente && adq.adquirente === adquirente) continue; // Já tentou

      try {
        resultado = await processarComAdquirente(
          tipo_pagamento,
          adq.adquirente,
          pagamentoData
        );

        if (resultado.sucesso) {
          return resultado;
        }
      } catch (error) {
        erros.push({
          adquirente: adq.adquirente,
          erro: error.message,
        });
        console.error(`Erro com ${adq.adquirente}:`, error.message);
      }
    }

    // Se todas falharem
    throw new Error(
      `Falha ao processar pagamento com todas as adquirentes: ${JSON.stringify(erros)}`
    );
  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
    throw error;
  }
};

/**
 * Processar pagamento com adquirente específica
 */
const processarComAdquirente = async (tipo_pagamento, adquirente, pagamentoData) => {
  if (tipo_pagamento === 'pix') {
    if (adquirente === 'stone') {
      return await stoneAdapter.processarPix(pagamentoData);
    } else if (adquirente === 'pagbank') {
      return await pagbankAdapter.processarPix(pagamentoData);
    }
  } else if (tipo_pagamento === 'cartao_credito') {
    if (adquirente === 'stone') {
      return await stoneAdapter.processarCartaoCredito(pagamentoData);
    } else if (adquirente === 'cielo') {
      return await cieloAdapter.processarCartaoCredito(pagamentoData);
    } else if (adquirente === 'pagbank') {
      return await pagbankAdapter.processarCartaoCredito(pagamentoData);
    }
  } else if (tipo_pagamento === 'cartao_debito') {
    if (adquirente === 'stone') {
      return await stoneAdapter.processarCartaoDebito(pagamentoData);
    } else if (adquirente === 'cielo') {
      return await cieloAdapter.processarCartaoDebito(pagamentoData);
    }
  } else if (tipo_pagamento === 'dinheiro') {
    return {
      sucesso: true,
      idTransacao: `DINHEIRO-${Date.now()}`,
      valor: pagamentoData.valor,
    };
  }

  throw new Error(`Tipo de pagamento não suportado: ${tipo_pagamento}`);
};

// ============================================================================
// RECONCILIAÇÃO MULTIADQUIRENTE
// ============================================================================

/**
 * Reconciliar transações de todas as adquirentes
 */
export const reconciliarTodas = async (tenantId, data) => {
  try {
    const adquirentesResult = await db.query(
      `
      SELECT DISTINCT adquirente FROM configuracoes_adquirentes
      WHERE estabelecimento_id = $1 AND ativo = true
      `,
      [tenantId]
    );

    const resultados = {};

    for (const row of adquirentesResult.rows) {
      const adquirente = row.adquirente;

      try {
        if (adquirente === 'stone') {
          resultados[adquirente] = await stoneAdapter.reconciliarTransacoes(
            tenantId,
            data
          );
        } else if (adquirente === 'cielo') {
          resultados[adquirente] = await cieloAdapter.reconciliarTransacoes?.(
            tenantId,
            data
          );
        } else if (adquirente === 'pagbank') {
          resultados[adquirente] = await pagbankAdapter.reconciliarTransacoes?.(
            tenantId,
            data
          );
        }
      } catch (error) {
        console.error(`Erro ao reconciliar ${adquirente}:`, error);
        resultados[adquirente] = { erro: error.message };
      }
    }

    return resultados;
  } catch (error) {
    console.error('Erro ao reconciliar todas as adquirentes:', error);
    throw error;
  }
};

// ============================================================================
// WEBHOOK HANDLERS
// ============================================================================

/**
 * Processar webhook de pagamento
 */
export const processarWebhook = async (adquirente, payload) => {
  try {
    if (adquirente === 'stone') {
      return await stoneAdapter.processarWebhook(payload);
    } else if (adquirente === 'cielo') {
      // Implementar handler Cielo
      return { sucesso: true };
    } else if (adquirente === 'pagbank') {
      // Implementar handler PagBank
      return { sucesso: true };
    }

    throw new Error(`Adquirente desconhecida: ${adquirente}`);
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    throw error;
  }
};

// ============================================================================
// CONSULTA E REEMBOLSO
// ============================================================================

/**
 * Consultar transação
 */
export const consultarTransacao = async (idTransacao, adquirente) => {
  try {
    if (adquirente === 'stone') {
      return await stoneAdapter.consultarTransacao(idTransacao);
    } else if (adquirente === 'pagbank') {
      return await pagbankAdapter.consultarTransacao(idTransacao);
    }

    throw new Error(`Adquirente não suportada: ${adquirente}`);
  } catch (error) {
    console.error('Erro ao consultar transação:', error);
    throw error;
  }
};

/**
 * Reembolsar transação
 */
export const reembolsarTransacao = async (idTransacao, adquirente, valor) => {
  try {
    if (adquirente === 'stone') {
      return await stoneAdapter.reembolsarTransacao(idTransacao, valor);
    } else if (adquirente === 'cielo') {
      return await cieloAdapter.reembolsarTransacao(idTransacao, valor);
    } else if (adquirente === 'pagbank') {
      return await pagbankAdapter.reembolsarTransacao(idTransacao, valor);
    }

    throw new Error(`Adquirente não suportada: ${adquirente}`);
  } catch (error) {
    console.error('Erro ao reembolsar transação:', error);
    throw error;
  }
};

export default {
  processarPagamento,
  reconciliarTodas,
  processarWebhook,
  consultarTransacao,
  reembolsarTransacao,
};

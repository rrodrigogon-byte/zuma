/**
 * Gerenciador de NFC-e e NF-e
 * SetPoint Ultra - Suporte completo a todas as UFs e provedores
 */

import { db } from '../../core/database.js';
import * as focusAdapter from './focus.js';
import * as plugnotasAdapter from './plugnotas.js';
import { config } from '../../config.js';

// ============================================================================
// MAPEAMENTO DE UFES E SEFAZ
// ============================================================================

const SEFAZ_CONFIG = {
  AC: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  AL: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  AP: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  AM: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  BA: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  CE: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  DF: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  ES: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  GO: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  MA: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  MT: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  MS: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  MG: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  PA: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  PB: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  PR: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  PE: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  PI: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  RJ: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  RN: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  RS: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  RO: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  RR: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  SC: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  SP: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  SE: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
  TO: { ambiente: 'svrs', url: 'https://nfe.svrs.rs.gov.br' },
};

// ============================================================================
// EMISSÃO DE NFC-E
// ============================================================================

/**
 * Emitir NFC-e com suporte a contingência offline
 */
export const emitirNfce = async (nfceData) => {
  try {
    const { tenantId, uf, itens, cliente, valor_total, valor_desconto } = nfceData;

    // Obter configuração do tenant para a UF
    const configResult = await db.query(
      `
      SELECT * FROM configuracoes_nfce
      WHERE estabelecimento_id = $1 AND sefaz_uf = $2
      `,
      [tenantId, uf]
    );

    if (configResult.rows.length === 0) {
      throw new Error(`Configuração NFC-e não encontrada para UF: ${uf}`);
    }

    const config_nfce = configResult.rows[0];

    // Tentar emitir via provedor principal
    let resultado = null;
    let provedor = config.nfce.provider || 'focus';

    try {
      if (provedor === 'focus') {
        resultado = await focusAdapter.emitirNfce({
          ...nfceData,
          config: config_nfce,
        });
      } else if (provedor === 'plugnotas') {
        resultado = await plugnotasAdapter.emitirNfce({
          ...nfceData,
          config: config_nfce,
        });
      }

      if (resultado.sucesso) {
        // Registrar NFC-e no banco
        await registrarNfce(tenantId, resultado, nfceData);
        return resultado;
      }
    } catch (error) {
      console.error(`Erro ao emitir via ${provedor}:`, error);

      // Tentar provedor fallback
      const provedorFallback = provedor === 'focus' ? 'plugnotas' : 'focus';
      console.log(`Tentando provedor fallback: ${provedorFallback}`);

      try {
        if (provedorFallback === 'plugnotas') {
          resultado = await plugnotasAdapter.emitirNfce({
            ...nfceData,
            config: config_nfce,
          });
        } else {
          resultado = await focusAdapter.emitirNfce({
            ...nfceData,
            config: config_nfce,
          });
        }

        if (resultado.sucesso) {
          await registrarNfce(tenantId, resultado, nfceData);
          return resultado;
        }
      } catch (fallbackError) {
        console.error(`Erro no provedor fallback:`, fallbackError);
      }
    }

    // Se ambos os provedores falharem, ativar contingência offline
    console.log('Ativando contingência offline...');
    return await ativarContingencia(tenantId, uf, nfceData);
  } catch (error) {
    console.error('Erro ao emitir NFC-e:', error);
    throw error;
  }
};

/**
 * Ativar contingência offline
 */
const ativarContingencia = async (tenantId, uf, nfceData) => {
  try {
    // Gerar número de NFC-e
    const numResult = await db.query(
      `
      SELECT numero_nfce_atual FROM configuracoes_nfce
      WHERE estabelecimento_id = $1 AND sefaz_uf = $2
      `,
      [tenantId, uf]
    );

    const numeroNfce = (numResult.rows[0]?.numero_nfce_atual || 0) + 1;

    // Criar registro de NFC-e em contingência
    const nfceResult = await db.query(
      `
      INSERT INTO nfces (
        estabelecimento_id, numero_nfce, serie_nfce, status, contingencia,
        valor_total, valor_desconto, valor_acrescimo
      )
      VALUES ($1, $2, 1, 'contingencia', true, $3, $4, $5)
      RETURNING *
      `,
      [
        tenantId,
        numeroNfce,
        nfceData.valor_total,
        nfceData.valor_desconto || 0,
        nfceData.valor_acrescimo || 0,
      ]
    );

    // Armazenar na fila de contingência
    await db.query(
      `
      INSERT INTO fila_nfce_contingencia (
        estabelecimento_id, nfce_id, xml_nfce, status, proxima_tentativa
      )
      VALUES ($1, $2, $3, 'pendente', NOW() + INTERVAL '5 minutes')
      `,
      [tenantId, nfceResult.rows[0].id, JSON.stringify(nfceData)]
    );

    // Atualizar configuração
    await db.query(
      `
      UPDATE configuracoes_nfce
      SET contingencia_ativa = true, contingencia_desde = NOW()
      WHERE estabelecimento_id = $1 AND sefaz_uf = $2
      `,
      [tenantId, uf]
    );

    return {
      sucesso: true,
      contingencia: true,
      numeroNfce,
      mensagem: 'NFC-e emitida em contingência offline. Será sincronizada quando a conexão for restaurada.',
    };
  } catch (error) {
    console.error('Erro ao ativar contingência:', error);
    throw error;
  }
};

/**
 * Registrar NFC-e no banco de dados
 */
const registrarNfce = async (tenantId, resultado, nfceData) => {
  try {
    const { itens } = nfceData;

    // Inserir NFC-e
    const nfceResult = await db.query(
      `
      INSERT INTO nfces (
        estabelecimento_id, numero_nfce, serie_nfce, chave_nfce, status,
        data_emissao, data_autorizacao, protocolo_autorizacao,
        valor_total, valor_desconto, valor_acrescimo, qrcode_nfce
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        tenantId,
        resultado.numeroNfce,
        resultado.serieNfce || 1,
        resultado.chaveNfce,
        'autorizada',
        resultado.protocoloAutorizacao,
        nfceData.valor_total,
        nfceData.valor_desconto || 0,
        nfceData.valor_acrescimo || 0,
        resultado.qrCode,
      ]
    );

    // Inserir itens da NFC-e
    for (const item of itens) {
      await db.query(
        `
        INSERT INTO itens_nfce (
          nfce_id, descricao, quantidade, unidade_medida,
          valor_unitario, valor_total
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          nfceResult.rows[0].id,
          item.descricao,
          item.quantidade,
          item.unidade || 'un',
          item.valor_unitario,
          item.valor_total,
        ]
      );
    }

    return nfceResult.rows[0];
  } catch (error) {
    console.error('Erro ao registrar NFC-e:', error);
    throw error;
  }
};

// ============================================================================
// REPROCESSAMENTO DE CONTINGÊNCIA
// ============================================================================

/**
 * Reprocessar NFC-es em contingência
 */
export const reprocessarContingencia = async (tenantId) => {
  try {
    // Obter NFC-es pendentes
    const result = await db.query(
      `
      SELECT fc.*, n.chave_nfce, cn.sefaz_uf
      FROM fila_nfce_contingencia fc
      JOIN nfces n ON fc.nfce_id = n.id
      JOIN configuracoes_nfce cn ON n.estabelecimento_id = cn.estabelecimento_id
      WHERE fc.estabelecimento_id = $1 AND fc.status = 'pendente'
      AND fc.proxima_tentativa <= NOW()
      LIMIT 10
      `,
      [tenantId]
    );

    const nfcesPendentes = result.rows;
    const resultados = [];

    for (const nfce of nfcesPendentes) {
      try {
        const provedor = config.nfce.provider || 'focus';
        let resultado = null;

        if (provedor === 'focus') {
          resultado = await focusAdapter.consultarNfce(nfce.chave_nfce);
        } else {
          resultado = await plugnotasAdapter.consultarNfce(nfce.chave_nfce);
        }

        if (resultado.status === 'autorizada') {
          // Atualizar NFC-e
          await db.query(
            `
            UPDATE nfces
            SET status = 'autorizada', contingencia = false
            WHERE id = $1
            `,
            [nfce.nfce_id]
          );

          // Remover da fila
          await db.query(
            `
            UPDATE fila_nfce_contingencia
            SET status = 'sucesso'
            WHERE id = $1
            `,
            [nfce.id]
          );

          resultados.push({
            id: nfce.id,
            status: 'sucesso',
            chaveNfce: nfce.chave_nfce,
          });
        } else {
          throw new Error(`Status: ${resultado.status}`);
        }
      } catch (error) {
        // Incrementar tentativas
        const proximaTentativa = new Date();
        proximaTentativa.setSeconds(
          proximaTentativa.getSeconds() +
            (config.nfce.contingencia.retryIntervalSeconds || 300)
        );

        await db.query(
          `
          UPDATE fila_nfce_contingencia
          SET tentativas = tentativas + 1,
              proxima_tentativa = $1,
              status = CASE WHEN tentativas >= $2 THEN 'erro' ELSE 'pendente' END,
              motivo_erro = $3
          WHERE id = $4
          `,
          [
            proximaTentativa,
            config.nfce.contingencia.maxRetries || 5,
            error.message,
            nfce.id,
          ]
        );

        resultados.push({
          id: nfce.id,
          status: 'erro',
          erro: error.message,
        });
      }
    }

    return resultados;
  } catch (error) {
    console.error('Erro ao reprocessar contingência:', error);
    throw error;
  }
};

// ============================================================================
// CONSULTA E CANCELAMENTO
// ============================================================================

/**
 * Consultar status de NFC-e
 */
export const consultarNfce = async (chaveNfce) => {
  try {
    const provedor = config.nfce.provider || 'focus';

    if (provedor === 'focus') {
      return await focusAdapter.consultarNfce(chaveNfce);
    } else {
      return await plugnotasAdapter.consultarNfce(chaveNfce);
    }
  } catch (error) {
    console.error('Erro ao consultar NFC-e:', error);
    throw error;
  }
};

/**
 * Cancelar NFC-e
 */
export const cancelarNfce = async (chaveNfce, justificativa) => {
  try {
    const provedor = config.nfce.provider || 'focus';

    if (provedor === 'focus') {
      return await focusAdapter.cancelarNfce(chaveNfce, justificativa);
    } else {
      return await plugnotasAdapter.cancelarNfce(chaveNfce, justificativa);
    }
  } catch (error) {
    console.error('Erro ao cancelar NFC-e:', error);
    throw error;
  }
};

export default {
  emitirNfce,
  reprocessarContingencia,
  consultarNfce,
  cancelarNfce,
  SEFAZ_CONFIG,
};

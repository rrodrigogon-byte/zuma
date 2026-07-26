/**
 * ============================================================================
 * CONTROLLERS DE PAGAMENTOS - ERP MODULAR
 * ============================================================================
 * Arquivo: modules/pagamentos/controllers/pagamentos.js
 * Descrição: Processamento de pagamentos multiadquirente
 * ============================================================================
 */

import * as dbPg from '../../../db-pg.js';
import { processarComTEF } from '../../../adapters/payment/tef.js';
import { gerarQrPix, simularConfirmacaoPix } from '../../../adapters/payment/pix.js';
import axios from 'axios';

/**
 * Processar pagamento
 */
export async function processarPagamento(req, res) {
  try {
    const { venda_id, forma_pagamento_id, valor, parcelas = 1 } = req.body;

    if (!venda_id || !forma_pagamento_id || !valor) {
      return res.status(400).json({ erro: 'Venda, forma de pagamento e valor são obrigatórios' });
    }

    // Validar venda
    const venda = await dbPg.findById('vendas', venda_id, req.empresaId);
    if (!venda) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }

    if (venda.status !== 'fechada') {
      return res.status(400).json({ erro: 'Venda deve estar fechada' });
    }

    // Validar forma de pagamento
    const formaResult = await dbPg.query(
      `SELECT * FROM formas_pagamento WHERE empresa_id = $1 AND id = $2`,
      [req.empresaId, forma_pagamento_id]
    );

    if (formaResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Forma de pagamento não encontrada' });
    }

    const forma = formaResult.rows[0];

    // Processar pagamento conforme forma
    let resultadoPagamento;

    switch (forma.tipo) {
      case 'dinheiro':
        resultadoPagamento = await processarDinheiro(req, venda, valor);
        break;
      case 'cartao_credito':
        resultadoPagamento = await processarCartaoCredito(req, venda, valor, parcelas);
        break;
      case 'cartao_debito':
        resultadoPagamento = await processarCartaoDebito(req, venda, valor);
        break;
      case 'pix':
        resultadoPagamento = await processarPix(req, venda, valor);
        break;
      case 'tef':
        resultadoPagamento = await processarTefPagamento(req, venda, valor);
        break;
      default:
        return res.status(400).json({ erro: 'Forma de pagamento não suportada' });
    }

    if (!resultadoPagamento.sucesso) {
      return res.status(400).json({
        erro: 'Pagamento recusado',
        mensagem: resultadoPagamento.mensagem
      });
    }

    // Registrar pagamento
    const pagamentoResult = await dbPg.query(
      `INSERT INTO pagamentos
       (empresa_id, venda_id, forma_pagamento_id, valor, parcelas, status, nsu, autorizacao, referencia_externa)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.empresaId,
        venda_id,
        forma_pagamento_id,
        valor,
        parcelas,
        'confirmado',
        resultadoPagamento.nsu || null,
        resultadoPagamento.autorizacao || null,
        resultadoPagamento.referencia_externa || null
      ]
    );

    const pagamento = pagamentoResult.rows[0];

    // Atualizar venda para paga
    await dbPg.update('vendas', venda_id, {
      status: 'paga',
      pagamento_id: pagamento.id
    }, req.empresaId);

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'pagamentos',
      operacao: 'INSERT',
      registro_id: pagamento.id,
      dados_novo: { valor, forma: forma.tipo, status: 'confirmado' },
      ip_address: req.ip
    });

    res.status(201).json({
      sucesso: true,
      pagamento,
      venda: { id: venda_id, status: 'paga' },
      mensagem: 'Pagamento processado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
    res.status(500).json({ erro: 'Erro ao processar pagamento' });
  }
}

/**
 * Processar pagamento em dinheiro
 */
async function processarDinheiro(req, venda, valor) {
  // Validar valor
  if (valor < venda.valor_final) {
    return {
      sucesso: false,
      mensagem: `Valor insuficiente. Esperado: R$ ${venda.valor_final}, Recebido: R$ ${valor}`
    };
  }

  const troco = valor - venda.valor_final;

  return {
    sucesso: true,
    nsu: `DINHEIRO-${Date.now()}`,
    troco,
    mensagem: `Pagamento recebido. Troco: R$ ${troco.toFixed(2)}`
  };
}

/**
 * Processar cartão de crédito
 */
async function processarCartaoCredito(req, venda, valor, parcelas) {
  try {
    // Integrar com Stone/Cielo/PagBank
    const resultado = await processarComAdquirente('credito', {
      valor,
      parcelas,
      referencia: `VENDA-${venda.id}`
    });

    if (!resultado.sucesso) {
      return resultado;
    }

    return {
      sucesso: true,
      nsu: resultado.nsu,
      autorizacao: resultado.autorizacao,
      bandeira: resultado.bandeira,
      mensagem: 'Cartão de crédito aprovado'
    };
  } catch (error) {
    return {
      sucesso: false,
      mensagem: 'Erro ao processar cartão de crédito'
    };
  }
}

/**
 * Processar cartão de débito
 */
async function processarCartaoDebito(req, venda, valor) {
  try {
    const resultado = await processarComAdquirente('debito', {
      valor,
      referencia: `VENDA-${venda.id}`
    });

    if (!resultado.sucesso) {
      return resultado;
    }

    return {
      sucesso: true,
      nsu: resultado.nsu,
      autorizacao: resultado.autorizacao,
      bandeira: resultado.bandeira,
      mensagem: 'Cartão de débito aprovado'
    };
  } catch (error) {
    return {
      sucesso: false,
      mensagem: 'Erro ao processar cartão de débito'
    };
  }
}

/**
 * Processar Pix
 */
async function processarPix(req, venda, valor) {
  try {
    // Gerar QR Code Pix
    const qrResult = await gerarQrPix({
      valor,
      chave_pix: process.env.PIX_CHAVE || 'empresa@example.com',
      descricao: `Venda #${venda.id}`,
      id_transacao: venda.id
    });

    // Simular confirmação (em produção, usar webhook)
    const confirmacao = await simularConfirmacaoPix({
      txid: qrResult.txid,
      valor,
      chave_pix: qrResult.chave_pix
    });

    return {
      sucesso: confirmacao.sucesso,
      nsu: confirmacao.nsu,
      referencia_externa: confirmacao.txid,
      qr_code: qrResult.qr_code,
      mensagem: 'Pix confirmado'
    };
  } catch (error) {
    return {
      sucesso: false,
      mensagem: 'Erro ao processar Pix'
    };
  }
}

/**
 * Processar TEF (máquina de cartão)
 */
async function processarTefPagamento(req, venda, valor) {
  try {
    const resultado = await processarComTEF({
      tipo_transacao: 'credito',
      valor,
      nsu_host: `NSU-${venda.id}`,
      operadora_id: '1'
    });

    if (!resultado.sucesso) {
      return {
        sucesso: false,
        mensagem: resultado.mensagem
      };
    }

    return {
      sucesso: true,
      nsu: resultado.nsu,
      autorizacao: resultado.autorizacao,
      mensagem: 'Transação TEF aprovada'
    };
  } catch (error) {
    return {
      sucesso: false,
      mensagem: 'Erro ao processar TEF'
    };
  }
}

/**
 * Processar com adquirente (Stone/Cielo/PagBank)
 */
async function processarComAdquirente(tipo, dados) {
  // Simular resposta de adquirente
  // Em produção, integrar com APIs reais

  const sucesso = Math.random() > 0.05; // 95% de sucesso

  if (!sucesso) {
    return {
      sucesso: false,
      mensagem: 'Transação recusada pela adquirente'
    };
  }

  return {
    sucesso: true,
    nsu: `NSU-${Date.now()}`,
    autorizacao: `AUTH-${Math.random().toString(36).substring(7).toUpperCase()}`,
    bandeira: 'VISA',
    tipo
  };
}

/**
 * Reembolsar pagamento
 */
export async function reembolsarPagamento(req, res) {
  try {
    const { pagamento_id } = req.params;
    const { motivo } = req.body;

    // Validar pagamento
    const pagamento = await dbPg.findById('pagamentos', pagamento_id, req.empresaId);
    if (!pagamento) {
      return res.status(404).json({ erro: 'Pagamento não encontrado' });
    }

    if (pagamento.status === 'reembolsado') {
      return res.status(400).json({ erro: 'Pagamento já foi reembolsado' });
    }

    // Registrar reembolso
    const reembolsoResult = await dbPg.query(
      `INSERT INTO reembolsos
       (empresa_id, pagamento_id, valor, motivo, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.empresaId, pagamento_id, pagamento.valor, motivo || null, 'processado']
    );

    // Atualizar pagamento
    await dbPg.update('pagamentos', pagamento_id, {
      status: 'reembolsado'
    }, req.empresaId);

    // Atualizar venda
    const venda = await dbPg.findById('vendas', pagamento.venda_id, req.empresaId);
    if (venda) {
      await dbPg.update('vendas', pagamento.venda_id, {
        status: 'cancelada'
      }, req.empresaId);
    }

    res.json({
      sucesso: true,
      reembolso: reembolsoResult.rows[0],
      mensagem: 'Reembolso processado'
    });
  } catch (error) {
    console.error('Erro ao reembolsar:', error);
    res.status(500).json({ erro: 'Erro ao reembolsar' });
  }
}

/**
 * Listar pagamentos
 */
export async function listarPagamentos(req, res) {
  try {
    const { venda_id, status, data_inicio, data_fim } = req.query;

    let sql = `SELECT * FROM pagamentos WHERE empresa_id = $1`;
    const params = [req.empresaId];
    let paramIndex = 2;

    if (venda_id) {
      sql += ` AND venda_id = $${paramIndex}`;
      params.push(venda_id);
      paramIndex++;
    }

    if (status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (data_inicio) {
      sql += ` AND data_criacao >= $${paramIndex}`;
      params.push(data_inicio);
      paramIndex++;
    }

    if (data_fim) {
      sql += ` AND data_criacao <= $${paramIndex}`;
      params.push(data_fim);
      paramIndex++;
    }

    sql += ` ORDER BY data_criacao DESC`;

    const result = await dbPg.query(sql, params);

    res.json({
      sucesso: true,
      pagamentos: result.rows
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao listar pagamentos' });
  }
}

/**
 * Reconciliar pagamentos com adquirente
 */
export async function reconciliarPagamentos(req, res) {
  try {
    const { data_inicio, data_fim } = req.query;

    // Buscar pagamentos não reconciliados
    let sql = `
      SELECT p.*, v.id as venda_id
      FROM pagamentos p
      JOIN vendas v ON p.venda_id = v.id
      WHERE p.empresa_id = $1 AND p.status = 'confirmado' AND p.reconciliado = false
    `;
    const params = [req.empresaId];
    let paramIndex = 2;

    if (data_inicio) {
      sql += ` AND p.data_criacao >= $${paramIndex}`;
      params.push(data_inicio);
      paramIndex++;
    }

    if (data_fim) {
      sql += ` AND p.data_criacao <= $${paramIndex}`;
      params.push(data_fim);
      paramIndex++;
    }

    const result = await dbPg.query(sql, params);

    // Simular reconciliação
    let reconciliados = 0;
    for (const pagamento of result.rows) {
      await dbPg.update('pagamentos', pagamento.id, {
        reconciliado: true
      }, req.empresaId);
      reconciliados++;
    }

    res.json({
      sucesso: true,
      pagamentos_reconciliados: reconciliados,
      total_processado: result.rows.reduce((sum, p) => sum + p.valor, 0)
    });
  } catch (error) {
    console.error('Erro ao reconciliar:', error);
    res.status(500).json({ erro: 'Erro ao reconciliar pagamentos' });
  }
}

export default {
  processarPagamento,
  reembolsarPagamento,
  listarPagamentos,
  reconciliarPagamentos
};

/**
 * Service: Crediário Próprio
 * SetPoint Ultra — Módulo ERP Comercial
 * Funcionalidades: Contas a prazo, Carnê, Régua de cobrança, Inadimplência,
 * Renegociação, Extrato do cliente, Integração WhatsApp
 */
import { db } from '../../core/database.js';
import {
  notificarParcelaVencendo,
  notificarParcelaVencida,
} from '../../core/whatsapp.js';

// ─── Constantes ───────────────────────────────────────────────────────────────
const TAXA_MULTA = 0.02;       // 2% ao mês
const TAXA_JUROS_DIA = 0.001;  // 0.1% ao dia (mora)

// ─── Contas / Carnês ─────────────────────────────────────────────────────────

export async function listarContas(tenantId, filtros = {}) {
  const params = [tenantId];
  let where = 'WHERE c.tenant_id = $1';

  if (filtros.status)     { params.push(filtros.status);     where += ` AND c.status = $${params.length}`; }
  if (filtros.cliente_id) { params.push(filtros.cliente_id); where += ` AND c.cliente_id = $${params.length}`; }
  if (filtros.vencidas)   { where += ` AND c.status = 'aberta' AND c.data_vencimento < CURRENT_DATE`; }

  const result = await db.query(
    `SELECT c.*,
            cl.nome AS cliente_nome, cl.telefone AS cliente_telefone,
            (SELECT COUNT(*) FROM crediario_parcelas p WHERE p.conta_id = c.id AND p.status = 'paga') AS parcelas_pagas,
            (SELECT COUNT(*) FROM crediario_parcelas p WHERE p.conta_id = c.id) AS total_parcelas,
            (SELECT SUM(p.valor_atualizado) FROM crediario_parcelas p WHERE p.conta_id = c.id AND p.status = 'aberta') AS saldo_devedor
     FROM crediario_contas c
     JOIN clientes cl ON cl.id = c.cliente_id
     ${where}
     ORDER BY c.created_at DESC`,
    params
  );
  return result.rows;
}

export async function criarConta(tenantId, dados) {
  const {
    cliente_id, valor_total, entrada = 0,
    num_parcelas, dia_vencimento = 10,
    taxa_juros_mensal = 0, // 0 = sem juros (crediário direto)
    descricao, venda_id = null,
  } = dados;

  const valorFinanciado = parseFloat(valor_total) - parseFloat(entrada);
  if (valorFinanciado <= 0) throw new Error('Valor financiado deve ser maior que zero');
  if (num_parcelas < 1 || num_parcelas > 60) throw new Error('Número de parcelas deve ser entre 1 e 60');

  // Calcular parcelas com fórmula Price (se houver juros) ou divisão simples
  let valorParcela;
  if (parseFloat(taxa_juros_mensal) > 0) {
    const i = parseFloat(taxa_juros_mensal) / 100;
    valorParcela = valorFinanciado * (i * Math.pow(1 + i, num_parcelas)) / (Math.pow(1 + i, num_parcelas) - 1);
  } else {
    valorParcela = valorFinanciado / num_parcelas;
  }
  valorParcela = Math.round(valorParcela * 100) / 100;

  // Ajuste de centavos na última parcela
  const totalCalculado = valorParcela * num_parcelas;
  const ajuste = Math.round((valorFinanciado - totalCalculado) * 100) / 100;

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    // Criar conta
    const contaResult = await client.query(
      `INSERT INTO crediario_contas
        (tenant_id, cliente_id, venda_id, descricao, valor_total, entrada,
         valor_financiado, num_parcelas, taxa_juros_mensal, dia_vencimento, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'aberta')
       RETURNING *`,
      [tenantId, cliente_id, venda_id, descricao,
       parseFloat(valor_total), parseFloat(entrada), valorFinanciado,
       num_parcelas, parseFloat(taxa_juros_mensal), dia_vencimento]
    );
    const conta = contaResult.rows[0];

    // Gerar parcelas
    const hoje = new Date();
    for (let n = 1; n <= num_parcelas; n++) {
      // Calcular data de vencimento
      const venc = new Date(hoje.getFullYear(), hoje.getMonth() + n, dia_vencimento);
      const valorEsta = n === num_parcelas ? valorParcela + ajuste : valorParcela;

      await client.query(
        `INSERT INTO crediario_parcelas
          (tenant_id, conta_id, numero, valor, valor_atualizado, data_vencimento, status)
         VALUES ($1,$2,$3,$4,$4,$5,'aberta')`,
        [tenantId, conta.id, n, Math.round(valorEsta * 100) / 100,
         venc.toISOString().split('T')[0]]
      );
    }

    await client.query('COMMIT');
    return conta;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function buscarCarne(tenantId, contaId) {
  const contaResult = await db.query(
    `SELECT c.*, cl.nome AS cliente_nome, cl.cpf, cl.telefone, cl.endereco
     FROM crediario_contas c
     JOIN clientes cl ON cl.id = c.cliente_id
     WHERE c.tenant_id = $1 AND c.id = $2`,
    [tenantId, contaId]
  );
  if (!contaResult.rows.length) throw new Error('Conta não encontrada');

  const parcelasResult = await db.query(
    `SELECT * FROM crediario_parcelas
     WHERE conta_id = $1 ORDER BY numero`,
    [contaId]
  );

  return {
    conta: contaResult.rows[0],
    parcelas: parcelasResult.rows,
  };
}

// ─── Pagamento de parcela ─────────────────────────────────────────────────────

export async function registrarPagamento(tenantId, parcelaId, dados) {
  const { valor_pago, forma_pagamento, observacoes } = dados;

  const parcelaResult = await db.query(
    `SELECT p.*, c.cliente_id, c.num_parcelas
     FROM crediario_parcelas p
     JOIN crediario_contas c ON c.id = p.conta_id
     WHERE p.id = $1 AND p.tenant_id = $2`,
    [parcelaId, tenantId]
  );
  if (!parcelaResult.rows.length) throw new Error('Parcela não encontrada');

  const parcela = parcelaResult.rows[0];
  if (parcela.status === 'paga') throw new Error('Parcela já foi paga');

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    // Atualizar parcela
    await client.query(
      `UPDATE crediario_parcelas
       SET status = 'paga', valor_pago = $1, data_pagamento = NOW(),
           forma_pagamento = $2, observacoes = $3, updated_at = NOW()
       WHERE id = $4`,
      [parseFloat(valor_pago), forma_pagamento, observacoes, parcelaId]
    );

    // Verificar se todas as parcelas foram pagas
    const abertas = await client.query(
      `SELECT COUNT(*) AS total FROM crediario_parcelas
       WHERE conta_id = $1 AND status = 'aberta'`,
      [parcela.conta_id]
    );

    if (parseInt(abertas.rows[0].total) === 0) {
      await client.query(
        `UPDATE crediario_contas SET status = 'quitada', quitada_em = NOW()
         WHERE id = $1`,
        [parcela.conta_id]
      );
    }

    await client.query('COMMIT');
    return { ok: true, parcela_id: parcelaId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Atualizar juros e multa nas parcelas vencidas ────────────────────────────

export async function atualizarJurosVencidos(tenantId) {
  const hoje = new Date().toISOString().split('T')[0];

  const result = await db.query(
    `SELECT p.*, c.taxa_juros_mensal
     FROM crediario_parcelas p
     JOIN crediario_contas c ON c.id = p.conta_id
     WHERE p.tenant_id = $1
       AND p.status = 'aberta'
       AND p.data_vencimento < $2`,
    [tenantId, hoje]
  );

  let atualizadas = 0;
  for (const parcela of result.rows) {
    const diasAtraso = Math.floor(
      (new Date() - new Date(parcela.data_vencimento + 'T12:00')) / (1000 * 60 * 60 * 24)
    );
    const multa = parseFloat(parcela.valor) * TAXA_MULTA;
    const juros = parseFloat(parcela.valor) * TAXA_JUROS_DIA * diasAtraso;
    const valorAtualizado = parseFloat(parcela.valor) + multa + juros;

    await db.query(
      `UPDATE crediario_parcelas
       SET valor_atualizado = $1, dias_atraso = $2, updated_at = NOW()
       WHERE id = $3`,
      [Math.round(valorAtualizado * 100) / 100, diasAtraso, parcela.id]
    );
    atualizadas++;
  }
  return { atualizadas };
}

// ─── Régua de cobrança automática ────────────────────────────────────────────

export async function executarReguaCobranca(tenant) {
  const tenantId = tenant.id;
  const hoje = new Date().toISOString().split('T')[0];
  const em2Dias = new Date();
  em2Dias.setDate(em2Dias.getDate() + 2);
  const data2Dias = em2Dias.toISOString().split('T')[0];

  const resultados = { vencendo: 0, vencidas: 0, erros: 0 };

  // 1. Parcelas vencendo em 2 dias
  const vencendo = await db.query(
    `SELECT p.*, c.cliente_id, cl.nome AS cliente_nome, cl.telefone AS cliente_telefone
     FROM crediario_parcelas p
     JOIN crediario_contas c ON c.id = p.conta_id
     JOIN clientes cl ON cl.id = c.cliente_id
     WHERE p.tenant_id = $1
       AND p.status = 'aberta'
       AND p.data_vencimento = $2
       AND p.notificacao_vencendo_enviada = FALSE`,
    [tenantId, data2Dias]
  );

  for (const p of vencendo.rows) {
    try {
      await notificarParcelaVencendo(tenant, {
        cliente_nome: p.cliente_nome,
        cliente_telefone: p.cliente_telefone,
        numero_parcela: p.numero,
        valor: p.valor_atualizado || p.valor,
        data_vencimento: p.data_vencimento,
      });
      await db.query(
        `UPDATE crediario_parcelas SET notificacao_vencendo_enviada = TRUE WHERE id = $1`,
        [p.id]
      );
      resultados.vencendo++;
      await new Promise(r => setTimeout(r, 1200));
    } catch { resultados.erros++; }
  }

  // 2. Parcelas vencidas (1, 3, 7, 15, 30 dias)
  const diasCobranca = [1, 3, 7, 15, 30];
  for (const dias of diasCobranca) {
    const dataAlvo = new Date();
    dataAlvo.setDate(dataAlvo.getDate() - dias);
    const dataStr = dataAlvo.toISOString().split('T')[0];

    const vencidas = await db.query(
      `SELECT p.*, c.cliente_id, cl.nome AS cliente_nome, cl.telefone AS cliente_telefone
       FROM crediario_parcelas p
       JOIN crediario_contas c ON c.id = p.conta_id
       JOIN clientes cl ON cl.id = c.cliente_id
       WHERE p.tenant_id = $1
         AND p.status = 'aberta'
         AND p.data_vencimento = $2
         AND (p.ultima_cobranca IS NULL OR p.ultima_cobranca < CURRENT_DATE - INTERVAL '3 days')`,
      [tenantId, dataStr]
    );

    for (const p of vencidas.rows) {
      try {
        const diasAtraso = dias;
        const multa = parseFloat(p.valor) * TAXA_MULTA;
        const juros = parseFloat(p.valor) * TAXA_JUROS_DIA * diasAtraso;
        const valorComJuros = parseFloat(p.valor) + multa + juros;

        await notificarParcelaVencida(tenant, {
          cliente_nome: p.cliente_nome,
          cliente_telefone: p.cliente_telefone,
          numero_parcela: p.numero,
          valor: p.valor,
          dias_atraso: diasAtraso,
          valor_com_juros: valorComJuros,
        });
        await db.query(
          `UPDATE crediario_parcelas SET ultima_cobranca = NOW() WHERE id = $1`,
          [p.id]
        );
        resultados.vencidas++;
        await new Promise(r => setTimeout(r, 1200));
      } catch { resultados.erros++; }
    }
  }

  return resultados;
}

// ─── Renegociação ─────────────────────────────────────────────────────────────

export async function renegociarConta(tenantId, contaId, dados) {
  const { novo_num_parcelas, novo_dia_vencimento, desconto_juros = 0 } = dados;

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    // Calcular saldo devedor atual
    const saldoResult = await client.query(
      `SELECT SUM(valor_atualizado) AS saldo
       FROM crediario_parcelas
       WHERE conta_id = $1 AND status = 'aberta'`,
      [contaId]
    );
    const saldo = parseFloat(saldoResult.rows[0]?.saldo || 0);
    const saldoComDesconto = saldo * (1 - parseFloat(desconto_juros) / 100);

    // Cancelar parcelas abertas
    await client.query(
      `UPDATE crediario_parcelas SET status = 'renegociada'
       WHERE conta_id = $1 AND status = 'aberta'`,
      [contaId]
    );

    // Criar nova conta de renegociação
    const novaContaResult = await client.query(
      `INSERT INTO crediario_contas
        (tenant_id, cliente_id, venda_id, descricao, valor_total, entrada,
         valor_financiado, num_parcelas, taxa_juros_mensal, dia_vencimento, status, conta_origem_id)
       SELECT tenant_id, cliente_id, venda_id,
              'Renegociação de ' || descricao, $2, 0, $2, $3, 0, $4, 'aberta', id
       FROM crediario_contas WHERE id = $1
       RETURNING *`,
      [contaId, saldoComDesconto, novo_num_parcelas, novo_dia_vencimento || 10]
    );
    const novaConta = novaContaResult.rows[0];

    // Gerar novas parcelas
    const valorParcela = Math.round((saldoComDesconto / novo_num_parcelas) * 100) / 100;
    const hoje = new Date();
    for (let n = 1; n <= novo_num_parcelas; n++) {
      const venc = new Date(hoje.getFullYear(), hoje.getMonth() + n, novo_dia_vencimento || 10);
      await client.query(
        `INSERT INTO crediario_parcelas
          (tenant_id, conta_id, numero, valor, valor_atualizado, data_vencimento, status)
         VALUES ($1,$2,$3,$4,$4,$5,'aberta')`,
        [tenantId, novaConta.id, n, valorParcela, venc.toISOString().split('T')[0]]
      );
    }

    await client.query('COMMIT');
    return novaConta;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Relatórios ───────────────────────────────────────────────────────────────

export async function relatorioInadimplencia(tenantId) {
  const result = await db.query(
    `SELECT cl.nome, cl.telefone,
            COUNT(p.id) AS parcelas_vencidas,
            SUM(p.valor_atualizado) AS total_vencido,
            MIN(p.data_vencimento) AS mais_antiga,
            MAX(p.dias_atraso) AS max_dias_atraso
     FROM crediario_parcelas p
     JOIN crediario_contas c ON c.id = p.conta_id
     JOIN clientes cl ON cl.id = c.cliente_id
     WHERE p.tenant_id = $1
       AND p.status = 'aberta'
       AND p.data_vencimento < CURRENT_DATE
     GROUP BY cl.id, cl.nome, cl.telefone
     ORDER BY total_vencido DESC`,
    [tenantId]
  );
  return result.rows;
}

export async function resumoCrediario(tenantId) {
  const result = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'aberta') AS contas_abertas,
       COUNT(*) FILTER (WHERE status = 'quitada') AS contas_quitadas,
       SUM(valor_financiado) FILTER (WHERE status = 'aberta') AS carteira_ativa,
       (SELECT SUM(p.valor_atualizado) FROM crediario_parcelas p
        WHERE p.tenant_id = $1 AND p.status = 'aberta'
          AND p.data_vencimento >= CURRENT_DATE) AS a_receber,
       (SELECT SUM(p.valor_atualizado) FROM crediario_parcelas p
        WHERE p.tenant_id = $1 AND p.status = 'aberta'
          AND p.data_vencimento < CURRENT_DATE) AS inadimplente
     FROM crediario_contas
     WHERE tenant_id = $1`,
    [tenantId]
  );
  return result.rows[0];
}

/**
 * Service: Compras e Gestão de Fornecedores
 * SetPoint Ultra — Pedidos de Compra, Cotações, Recebimento, Aprovação por Alçada
 */
import { db } from '../../core/database.js';

// ============================================================================
// FORNECEDORES
// ============================================================================

export async function listarFornecedores(tenantId, filtros = {}) {
  const params = [tenantId];
  let where = 'WHERE tenant_id = $1 AND ativo = TRUE';
  if (filtros.busca) {
    params.push(`%${filtros.busca}%`);
    where += ` AND (razao_social ILIKE $${params.length} OR nome_fantasia ILIKE $${params.length} OR cnpj_cpf ILIKE $${params.length})`;
  }
  const result = await db.query(
    `SELECT * FROM compras_fornecedores ${where} ORDER BY razao_social LIMIT 100`,
    params
  );
  return result.rows;
}

export async function criarFornecedor(tenantId, dados) {
  const result = await db.query(
    `INSERT INTO compras_fornecedores
      (tenant_id, razao_social, nome_fantasia, cnpj_cpf, ie, email, telefone, celular,
       contato_nome, endereco, prazo_pagamento_dias, limite_credito, categoria, observacoes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [tenantId, dados.razao_social, dados.nome_fantasia, dados.cnpj_cpf, dados.ie,
     dados.email, dados.telefone, dados.celular, dados.contato_nome,
     JSON.stringify(dados.endereco || {}), dados.prazo_pagamento_dias || 30,
     dados.limite_credito || 0, dados.categoria, dados.observacoes]
  );
  return result.rows[0];
}

export async function atualizarFornecedor(fornecedorId, tenantId, dados) {
  const result = await db.query(
    `UPDATE compras_fornecedores
     SET razao_social=$1, nome_fantasia=$2, email=$3, telefone=$4,
         contato_nome=$5, prazo_pagamento_dias=$6, updated_at=NOW()
     WHERE id=$7 AND tenant_id=$8
     RETURNING *`,
    [dados.razao_social, dados.nome_fantasia, dados.email, dados.telefone,
     dados.contato_nome, dados.prazo_pagamento_dias, fornecedorId, tenantId]
  );
  return result.rows[0];
}

// ============================================================================
// PEDIDOS DE COMPRA
// ============================================================================

/**
 * Criar pedido de compra com aprovação por alçada
 * Pedidos acima do limite configurado vão para aprovação do gestor
 */
export async function criarPedidoCompra(tenantId, dados, solicitanteId) {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    // Número sequencial
    const seqResult = await client.query(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(numero, '[^0-9]', '', 'g') AS INTEGER)), 0) + 1 AS proximo
       FROM compras_pedidos WHERE tenant_id = $1`,
      [tenantId]
    );
    const numero = `PC${new Date().getFullYear()}${String(seqResult.rows[0].proximo).padStart(6, '0')}`;

    // Calcular total
    let subtotal = 0;
    const itens = (dados.itens || []).map(item => {
      const total = item.quantidade * item.valor_unitario;
      subtotal += total;
      return { ...item, valor_total: Number(total.toFixed(2)) };
    });
    const valorTotal = subtotal + (dados.valor_frete || 0);

    // Verificar limite de aprovação (padrão R$ 5.000)
    const limiteAprovacao = 5000; // Pode ser configurável por tenant
    const status = valorTotal > limiteAprovacao ? 'aguardando_aprovacao' : 'aprovado';

    const pedidoResult = await client.query(
      `INSERT INTO compras_pedidos
        (tenant_id, numero, fornecedor_id, solicitante_id, status,
         data_previsao_entrega, valor_subtotal, valor_frete, valor_total,
         condicao_pagamento, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [tenantId, numero, dados.fornecedor_id, solicitanteId, status,
       dados.data_previsao_entrega, subtotal, dados.valor_frete || 0,
       valorTotal, dados.condicao_pagamento, dados.observacoes]
    );
    const pedido = pedidoResult.rows[0];

    for (const item of itens) {
      await client.query(
        `INSERT INTO compras_pedido_itens
          (pedido_id, produto_id, descricao, quantidade, unidade, valor_unitario, valor_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [pedido.id, item.produto_id, item.descricao, item.quantidade,
         item.unidade || 'UN', item.valor_unitario, item.valor_total]
      );
    }

    await client.query('COMMIT');
    return { pedido, requer_aprovacao: status === 'aguardando_aprovacao' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function aprovarPedidoCompra(pedidoId, tenantId, aprovadorId) {
  const result = await db.query(
    `UPDATE compras_pedidos
     SET status = 'aprovado', aprovador_id = $1, aprovado_em = NOW(), updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3 AND status = 'aguardando_aprovacao'
     RETURNING *`,
    [aprovadorId, pedidoId, tenantId]
  );
  if (!result.rows[0]) throw new Error('Pedido não encontrado ou não está aguardando aprovação');
  return result.rows[0];
}

/**
 * Registrar recebimento parcial ou total de um pedido de compra
 */
export async function registrarRecebimento(pedidoId, tenantId, itensRecebidos) {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    for (const item of itensRecebidos) {
      // Atualizar quantidade recebida no item
      await client.query(
        `UPDATE compras_pedido_itens
         SET quantidade_recebida = quantidade_recebida + $1,
             status_item = CASE
               WHEN quantidade_recebida + $1 >= quantidade THEN 'recebido'
               ELSE 'parcial'
             END
         WHERE id = $2`,
        [item.quantidade_recebida, item.item_id]
      );

      // Dar entrada no estoque
      if (item.produto_id) {
        await client.query(
          `INSERT INTO produto_estoques (tenant_id, produto_id, quantidade)
           VALUES ($1,$2,$3)
           ON CONFLICT (tenant_id, produto_id)
           DO UPDATE SET quantidade = produto_estoques.quantidade + EXCLUDED.quantidade`,
          [tenantId, item.produto_id, item.quantidade_recebida]
        );
      }
    }

    // Verificar se todos os itens foram recebidos
    const pendentesResult = await client.query(
      `SELECT COUNT(*) FROM compras_pedido_itens
       WHERE pedido_id = $1 AND status_item != 'recebido'`,
      [pedidoId]
    );
    const pendentes = parseInt(pendentesResult.rows[0].count);
    const novoStatus = pendentes === 0 ? 'recebido' : 'parcialmente_recebido';

    await client.query(
      'UPDATE compras_pedidos SET status = $1, updated_at = NOW() WHERE id = $2',
      [novoStatus, pedidoId]
    );

    await client.query('COMMIT');
    return { status: novoStatus, pendentes };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listarPedidos(tenantId, filtros = {}) {
  const params = [tenantId];
  let where = 'WHERE p.tenant_id = $1';
  if (filtros.status) { params.push(filtros.status); where += ` AND p.status = $${params.length}`; }
  if (filtros.fornecedor_id) { params.push(filtros.fornecedor_id); where += ` AND p.fornecedor_id = $${params.length}`; }

  const result = await db.query(
    `SELECT p.*, f.razao_social AS fornecedor_nome,
            u.nome AS solicitante_nome
     FROM compras_pedidos p
     JOIN compras_fornecedores f ON f.id = p.fornecedor_id
     LEFT JOIN usuarios u ON u.id = p.solicitante_id
     ${where}
     ORDER BY p.created_at DESC LIMIT 100`,
    params
  );
  return result.rows;
}

// ============================================================================
// COTAÇÕES
// ============================================================================

export async function criarCotacao(tenantId, dados) {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    const seqResult = await client.query(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(numero, '[^0-9]', '', 'g') AS INTEGER)), 0) + 1 AS proximo
       FROM compras_cotacoes WHERE tenant_id = $1`,
      [tenantId]
    );
    const numero = `COT${new Date().getFullYear()}${String(seqResult.rows[0].proximo).padStart(6, '0')}`;

    const cotResult = await client.query(
      `INSERT INTO compras_cotacoes (tenant_id, numero, descricao, data_limite)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [tenantId, numero, dados.descricao, dados.data_limite]
    );
    const cotacao = cotResult.rows[0];

    // Vincular fornecedores
    for (const fornecedorId of (dados.fornecedores || [])) {
      await client.query(
        `INSERT INTO compras_cotacao_fornecedores (cotacao_id, fornecedor_id)
         VALUES ($1,$2)`,
        [cotacao.id, fornecedorId]
      );
    }

    await client.query('COMMIT');
    return cotacao;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Registrar resposta de fornecedor na cotação
 */
export async function responderCotacao(cotacaoFornecedorId, dados) {
  const result = await db.query(
    `UPDATE compras_cotacao_fornecedores
     SET status = 'respondido', valor_total = $1,
         prazo_entrega_dias = $2, observacoes = $3, respondido_em = NOW()
     WHERE id = $1
     RETURNING *`,
    [dados.valor_total, dados.prazo_entrega_dias, dados.observacoes, cotacaoFornecedorId]
  );
  return result.rows[0];
}

/**
 * Comparar propostas de uma cotação
 */
export async function compararCotacao(cotacaoId, tenantId) {
  const result = await db.query(
    `SELECT cf.*, f.razao_social AS fornecedor_nome
     FROM compras_cotacao_fornecedores cf
     JOIN compras_fornecedores f ON f.id = cf.fornecedor_id
     WHERE cf.cotacao_id = $1
     ORDER BY cf.valor_total ASC NULLS LAST`,
    [cotacaoId]
  );

  const propostas = result.rows;
  const melhorProposta = propostas.find(p => p.valor_total !== null);

  return {
    cotacao_id: cotacaoId,
    total_propostas: propostas.filter(p => p.status === 'respondido').length,
    melhor_proposta: melhorProposta,
    propostas
  };
}

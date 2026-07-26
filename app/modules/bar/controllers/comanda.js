/**
 * Controllers do Módulo BAR - Comanda Eletrônica
 * SetPoint Ultra
 */

import { db } from '../../../core/database.js';

// ============================================================================
// COMANDA
// ============================================================================

/**
 * Listar todas as comandas
 */
export const listarComandas = async (req, res) => {
  try {
    const { status, mesa_id, limit = 20, offset = 0 } = req.query;
    const tenantId = req.tenantId;

    let query = `
      SELECT c.*, m.numero_mesa
      FROM comandas c
      LEFT JOIN mesas m ON c.mesa_id = m.id
      WHERE c.estabelecimento_id = $1
    `;

    const values = [tenantId];
    let paramCount = 2;

    if (status) {
      query += ` AND c.status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    if (mesa_id) {
      query += ` AND c.mesa_id = $${paramCount}`;
      values.push(mesa_id);
      paramCount++;
    }

    query += ` ORDER BY c.data_abertura DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await db.query(query, values);

    res.json({
      data: result.rows,
      pagination: {
        limit,
        offset,
        total: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Erro ao listar comandas:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obter detalhes de uma comanda
 */
export const obterComanda = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const comandaResult = await db.query(
      `
      SELECT c.*, m.numero_mesa
      FROM comandas c
      LEFT JOIN mesas m ON c.mesa_id = m.id
      WHERE c.id = $1 AND c.estabelecimento_id = $2
      `,
      [id, tenantId]
    );

    if (comandaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comanda não encontrada' });
    }

    const comanda = comandaResult.rows[0];

    // Obter itens da comanda
    const itensResult = await db.query(
      `
      SELECT ic.*, p.nome, p.valor_venda
      FROM itens_comanda ic
      JOIN produtos p ON ic.produto_id = p.id
      WHERE ic.comanda_id = $1
      ORDER BY ic.data_pedido DESC
      `,
      [id]
    );

    // Obter divisões
    const divisoesResult = await db.query(
      `
      SELECT * FROM divisoes_comanda
      WHERE comanda_id = $1
      ORDER BY numero_divisao
      `,
      [id]
    );

    res.json({
      comanda,
      itens: itensResult.rows,
      divisoes: divisoesResult.rows,
    });
  } catch (error) {
    console.error('Erro ao obter comanda:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Abrir nova comanda
 */
export const abrirComanda = async (req, res) => {
  try {
    const { mesa_id, numero_comanda, observacoes } = req.body;
    const tenantId = req.tenantId;

    // Validar mesa se fornecida
    if (mesa_id) {
      const mesaResult = await db.query(
        `
        SELECT id FROM mesas
        WHERE id = $1 AND estabelecimento_id = $2
        `,
        [mesa_id, tenantId]
      );

      if (mesaResult.rows.length === 0) {
        return res.status(404).json({ error: 'Mesa não encontrada' });
      }
    }

    // Gerar número de comanda se não fornecido
    let numComanda = numero_comanda;
    if (!numComanda) {
      const lastComanda = await db.query(
        `
        SELECT MAX(numero_comanda) as max_numero
        FROM comandas
        WHERE estabelecimento_id = $1
        `,
        [tenantId]
      );

      numComanda = (lastComanda.rows[0].max_numero || 0) + 1;
    }

    // Criar comanda
    const result = await db.query(
      `
      INSERT INTO comandas (
        estabelecimento_id, mesa_id, numero_comanda, status, observacoes
      )
      VALUES ($1, $2, $3, 'aberta', $4)
      RETURNING *
      `,
      [tenantId, mesa_id || null, numComanda, observacoes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao abrir comanda:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Atualizar comanda
 */
export const atualizarComanda = async (req, res) => {
  try {
    const { id } = req.params;
    const { mesa_id, observacoes } = req.body;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      UPDATE comandas
      SET mesa_id = COALESCE($1, mesa_id),
          observacoes = COALESCE($2, observacoes),
          atualizado_em = NOW()
      WHERE id = $3 AND estabelecimento_id = $4
      RETURNING *
      `,
      [mesa_id || null, observacoes || null, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comanda não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar comanda:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Fechar comanda
 */
export const fecharComanda = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    // Calcular totais
    const totaisResult = await db.query(
      `
      SELECT 
        SUM(valor_total - COALESCE(desconto_valor, 0)) as total_bruto,
        SUM(COALESCE(desconto_valor, 0)) as total_desconto
      FROM itens_comanda
      WHERE comanda_id = $1
      `,
      [id]
    );

    const totais = totaisResult.rows[0];
    const totalBruto = totais.total_bruto || 0;
    const totalDesconto = totais.total_desconto || 0;
    const totalLiquido = totalBruto - totalDesconto;

    // Atualizar comanda
    const result = await db.query(
      `
      UPDATE comandas
      SET status = 'fechada',
          data_fechamento = NOW(),
          total_bruto = $1,
          total_desconto = $2,
          total_liquido = $3,
          atualizado_em = NOW()
      WHERE id = $4 AND estabelecimento_id = $5
      RETURNING *
      `,
      [totalBruto, totalDesconto, totalLiquido, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comanda não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao fechar comanda:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Cancelar comanda
 */
export const cancelarComanda = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      UPDATE comandas
      SET status = 'cancelada',
          observacoes = COALESCE(observacoes || ' | ', '') || 'CANCELADA: ' || $1,
          atualizado_em = NOW()
      WHERE id = $2 AND estabelecimento_id = $3
      RETURNING *
      `,
      [motivo || 'Sem motivo especificado', id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comanda não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao cancelar comanda:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// ITENS DA COMANDA
// ============================================================================

/**
 * Adicionar item à comanda
 */
export const adicionarItem = async (req, res) => {
  try {
    const { id: comandaId } = req.params;
    const {
      produto_id,
      quantidade,
      valor_unitario,
      desconto_percentual = 0,
      observacoes,
    } = req.body;
    const tenantId = req.tenantId;

    // Validar comanda
    const comandaResult = await db.query(
      `
      SELECT id FROM comandas
      WHERE id = $1 AND estabelecimento_id = $2 AND status = 'aberta'
      `,
      [comandaId, tenantId]
    );

    if (comandaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comanda aberta não encontrada' });
    }

    // Validar produto
    const produtoResult = await db.query(
      `
      SELECT valor_venda FROM produtos
      WHERE id = $1 AND estabelecimento_id = $2
      `,
      [produto_id, tenantId]
    );

    if (produtoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const valorUnitario = valor_unitario || produtoResult.rows[0].valor_venda;
    const valorTotal = quantidade * valorUnitario;
    const descontoValor = (valorTotal * desconto_percentual) / 100;

    // Inserir item
    const result = await db.query(
      `
      INSERT INTO itens_comanda (
        comanda_id, produto_id, quantidade, valor_unitario, valor_total,
        desconto_percentual, desconto_valor, observacoes, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendente')
      RETURNING *
      `,
      [
        comandaId,
        produto_id,
        quantidade,
        valorUnitario,
        valorTotal,
        desconto_percentual,
        descontoValor,
        observacoes || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao adicionar item:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Atualizar item da comanda
 */
export const atualizarItem = async (req, res) => {
  try {
    const { comandaId, itemId } = req.params;
    const { quantidade, desconto_percentual, observacoes } = req.body;
    const tenantId = req.tenantId;

    // Obter item atual
    const itemResult = await db.query(
      `
      SELECT ic.*, p.valor_venda
      FROM itens_comanda ic
      JOIN produtos p ON ic.produto_id = p.id
      WHERE ic.id = $1 AND ic.comanda_id = $2
      `,
      [itemId, comandaId]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    const item = itemResult.rows[0];
    const novaQuantidade = quantidade || item.quantidade;
    const novoDesconto = desconto_percentual !== undefined ? desconto_percentual : item.desconto_percentual;

    const valorTotal = novaQuantidade * item.valor_unitario;
    const descontoValor = (valorTotal * novoDesconto) / 100;

    // Atualizar item
    const result = await db.query(
      `
      UPDATE itens_comanda
      SET quantidade = $1,
          valor_total = $2,
          desconto_percentual = $3,
          desconto_valor = $4,
          observacoes = COALESCE($5, observacoes),
          atualizado_em = NOW()
      WHERE id = $6 AND comanda_id = $7
      RETURNING *
      `,
      [novaQuantidade, valorTotal, novoDesconto, descontoValor, observacoes || null, itemId, comandaId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar item:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Remover item da comanda
 */
export const removerItem = async (req, res) => {
  try {
    const { comandaId, itemId } = req.params;

    const result = await db.query(
      `
      DELETE FROM itens_comanda
      WHERE id = $1 AND comanda_id = $2
      RETURNING *
      `,
      [itemId, comandaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    res.json({ mensagem: 'Item removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover item:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Atualizar status do item
 */
export const atualizarStatusItem = async (req, res) => {
  try {
    const { comandaId, itemId } = req.params;
    const { status } = req.body;

    const result = await db.query(
      `
      UPDATE itens_comanda
      SET status = $1,
          data_servido = CASE WHEN $1 = 'servido' THEN NOW() ELSE data_servido END,
          atualizado_em = NOW()
      WHERE id = $2 AND comanda_id = $3
      RETURNING *
      `,
      [status, itemId, comandaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar status do item:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// MESAS
// ============================================================================

/**
 * Listar todas as mesas
 */
export const listarMesas = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      SELECT m.*, 
        (SELECT COUNT(*) FROM comandas WHERE mesa_id = m.id AND status = 'aberta') as comandas_abertas
      FROM mesas m
      WHERE m.estabelecimento_id = $1
      ORDER BY m.numero_mesa
      `,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar mesas:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Criar nova mesa
 */
export const criarMesa = async (req, res) => {
  try {
    const { numero_mesa, capacidade_pessoas, localizacao } = req.body;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      INSERT INTO mesas (
        estabelecimento_id, numero_mesa, capacidade_pessoas, localizacao
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [tenantId, numero_mesa, capacidade_pessoas || null, localizacao || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar mesa:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Atualizar mesa
 */
export const atualizarMesa = async (req, res) => {
  try {
    const { id } = req.params;
    const { capacidade_pessoas, localizacao, ativa } = req.body;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      UPDATE mesas
      SET capacidade_pessoas = COALESCE($1, capacidade_pessoas),
          localizacao = COALESCE($2, localizacao),
          ativa = COALESCE($3, ativa),
          atualizado_em = NOW()
      WHERE id = $4 AND estabelecimento_id = $5
      RETURNING *
      `,
      [capacidade_pessoas || null, localizacao || null, ativa !== undefined ? ativa : null, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mesa não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar mesa:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Deletar mesa
 */
export const deletarMesa = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      DELETE FROM mesas
      WHERE id = $1 AND estabelecimento_id = $2
      RETURNING *
      `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mesa não encontrada' });
    }

    res.json({ mensagem: 'Mesa deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar mesa:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obter comanda aberta de uma mesa
 */
export const obterComandaMesa = async (req, res) => {
  try {
    const { id: mesaId } = req.params;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      SELECT * FROM comandas
      WHERE mesa_id = $1 AND estabelecimento_id = $2 AND status = 'aberta'
      LIMIT 1
      `,
      [mesaId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nenhuma comanda aberta para esta mesa' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter comanda da mesa:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// RELATÓRIOS
// ============================================================================

/**
 * Relatório de vendas
 */
export const relatorioVendas = async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      SELECT 
        DATE(c.data_abertura) as data,
        COUNT(DISTINCT c.id) as total_comandas,
        SUM(c.total_bruto) as total_bruto,
        SUM(c.total_desconto) as total_desconto,
        SUM(c.total_liquido) as total_liquido
      FROM comandas c
      WHERE c.estabelecimento_id = $1
        AND c.status = 'fechada'
        AND DATE(c.data_abertura) >= $2
        AND DATE(c.data_abertura) <= $3
      GROUP BY DATE(c.data_abertura)
      ORDER BY data DESC
      `,
      [tenantId, data_inicio || '2000-01-01', data_fim || '2099-12-31']
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao gerar relatório de vendas:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Relatório de produtos
 */
export const relatorioProdutos = async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      SELECT 
        p.nome,
        COUNT(ic.id) as quantidade_vendida,
        SUM(ic.valor_total) as valor_total,
        AVG(ic.valor_unitario) as valor_medio
      FROM itens_comanda ic
      JOIN produtos p ON ic.produto_id = p.id
      JOIN comandas c ON ic.comanda_id = c.id
      WHERE c.estabelecimento_id = $1
        AND c.status = 'fechada'
        AND DATE(c.data_abertura) >= $2
        AND DATE(c.data_abertura) <= $3
      GROUP BY p.id, p.nome
      ORDER BY quantidade_vendida DESC
      `,
      [tenantId, data_inicio || '2000-01-01', data_fim || '2099-12-31']
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao gerar relatório de produtos:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Relatório por garçom
 */
export const relatorioGarcom = async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    const tenantId = req.tenantId;

    // Nota: Esta query assume que há um campo usuario_id ou garcom_id
    // Você pode precisar ajustar conforme sua estrutura
    const result = await db.query(
      `
      SELECT 
        u.nome as garcom,
        COUNT(DISTINCT c.id) as total_comandas,
        SUM(c.total_liquido) as total_vendido
      FROM comandas c
      LEFT JOIN usuarios u ON c.criado_em::date = u.criado_em::date
      WHERE c.estabelecimento_id = $1
        AND c.status = 'fechada'
        AND DATE(c.data_abertura) >= $2
        AND DATE(c.data_abertura) <= $3
      GROUP BY u.id, u.nome
      ORDER BY total_vendido DESC
      `,
      [tenantId, data_inicio || '2000-01-01', data_fim || '2099-12-31']
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao gerar relatório por garçom:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  listarComandas,
  obterComanda,
  abrirComanda,
  atualizarComanda,
  fecharComanda,
  cancelarComanda,
  adicionarItem,
  atualizarItem,
  removerItem,
  atualizarStatusItem,
  listarMesas,
  criarMesa,
  atualizarMesa,
  deletarMesa,
  obterComandaMesa,
  relatorioVendas,
  relatorioProdutos,
  relatorioGarcom,
};

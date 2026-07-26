/**
 * Controllers do Módulo ESTOQUE - Fichas Técnicas e Receitas
 * SetPoint Ultra - Gestão de drinks, receitas e custos
 */

import { db } from '../../../core/database.js';

// ============================================================================
// FICHAS TÉCNICAS
// ============================================================================

/**
 * Criar ficha técnica (receita)
 */
export const criarReceita = async (req, res) => {
  try {
    const {
      nome,
      descricao,
      tipo,
      categoria,
      modo_preparo,
      tempo_preparo_minutos,
      ingredientes,
      observacoes,
    } = req.body;
    const tenantId = req.tenantId;

    if (!ingredientes || ingredientes.length === 0) {
      return res.status(400).json({ error: 'Nenhum ingrediente informado' });
    }

    // Calcular custo total
    let custo_total = 0;
    for (const ingrediente of ingredientes) {
      const produtoResult = await db.query(
        `
        SELECT valor_custo FROM produtos
        WHERE id = $1 AND estabelecimento_id = $2
        `,
        [ingrediente.produto_id, tenantId]
      );

      if (produtoResult.rows.length > 0) {
        const valor_custo = produtoResult.rows[0].valor_custo || 0;
        const custo_ingrediente = (valor_custo * ingrediente.quantidade) / (ingrediente.unidade_medida === 'ml' ? 1000 : 1);
        custo_total += custo_ingrediente;
      }
    }

    // Criar receita
    const receitaResult = await db.query(
      `
      INSERT INTO receitas (
        estabelecimento_id, nome, descricao, tipo, categoria,
        modo_preparo, tempo_preparo_minutos, custo_total, observacoes, ativa
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *
      `,
      [
        tenantId,
        nome,
        descricao,
        tipo || 'drink',
        categoria,
        modo_preparo,
        tempo_preparo_minutos || 5,
        custo_total,
        observacoes,
      ]
    );

    const receita = receitaResult.rows[0];

    // Inserir ingredientes
    for (const ingrediente of ingredientes) {
      await db.query(
        `
        INSERT INTO ingredientes_receita (
          receita_id, produto_id, quantidade, unidade_medida, observacoes
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          receita.id,
          ingrediente.produto_id,
          ingrediente.quantidade,
          ingrediente.unidade_medida || 'ml',
          ingrediente.observacoes || null,
        ]
      );
    }

    res.status(201).json({
      receita,
      ingredientes_inseridos: ingredientes.length,
    });
  } catch (error) {
    console.error('Erro ao criar receita:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obter receita com ingredientes
 */
export const obterReceita = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const receitaResult = await db.query(
      `
      SELECT * FROM receitas
      WHERE id = $1 AND estabelecimento_id = $2
      `,
      [id, tenantId]
    );

    if (receitaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Receita não encontrada' });
    }

    const receita = receitaResult.rows[0];

    // Obter ingredientes
    const ingredientesResult = await db.query(
      `
      SELECT ir.*, p.nome as produto_nome, p.sku, p.valor_custo
      FROM ingredientes_receita ir
      JOIN produtos p ON ir.produto_id = p.id
      WHERE ir.receita_id = $1
      `,
      [id]
    );

    res.json({
      receita,
      ingredientes: ingredientesResult.rows,
    });
  } catch (error) {
    console.error('Erro ao obter receita:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Listar receitas
 */
export const listarReceitas = async (req, res) => {
  try {
    const { categoria, tipo } = req.query;
    const tenantId = req.tenantId;

    let query = `
      SELECT * FROM receitas
      WHERE estabelecimento_id = $1 AND ativa = true
    `;

    const values = [tenantId];
    let paramCount = 2;

    if (categoria) {
      query += ` AND categoria = $${paramCount}`;
      values.push(categoria);
      paramCount++;
    }

    if (tipo) {
      query += ` AND tipo = $${paramCount}`;
      values.push(tipo);
      paramCount++;
    }

    query += ` ORDER BY nome`;

    const result = await db.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar receitas:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Atualizar receita
 */
export const atualizarReceita = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descricao, modo_preparo, tempo_preparo_minutos, ativa } = req.body;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      UPDATE receitas
      SET nome = COALESCE($1, nome),
          descricao = COALESCE($2, descricao),
          modo_preparo = COALESCE($3, modo_preparo),
          tempo_preparo_minutos = COALESCE($4, tempo_preparo_minutos),
          ativa = COALESCE($5, ativa),
          atualizado_em = NOW()
      WHERE id = $6 AND estabelecimento_id = $7
      RETURNING *
      `,
      [nome || null, descricao || null, modo_preparo || null, tempo_preparo_minutos || null, ativa !== undefined ? ativa : null, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Receita não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar receita:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Calcular custo de uma receita
 */
export const calcularCusto = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const ingredientesResult = await db.query(
      `
      SELECT ir.quantidade, ir.unidade_medida, p.valor_custo
      FROM ingredientes_receita ir
      JOIN produtos p ON ir.produto_id = p.id
      JOIN receitas r ON ir.receita_id = r.id
      WHERE r.id = $1 AND r.estabelecimento_id = $2
      `,
      [id, tenantId]
    );

    let custo_total = 0;
    const detalhes = [];

    for (const item of ingredientesResult.rows) {
      const valor_custo = item.valor_custo || 0;
      const custo_ingrediente = (valor_custo * item.quantidade) / (item.unidade_medida === 'ml' ? 1000 : 1);
      custo_total += custo_ingrediente;

      detalhes.push({
        quantidade: item.quantidade,
        unidade: item.unidade_medida,
        valor_unitario: valor_custo,
        custo_total: custo_ingrediente,
      });
    }

    res.json({
      custo_total,
      detalhes,
    });
  } catch (error) {
    console.error('Erro ao calcular custo:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  criarReceita,
  obterReceita,
  listarReceitas,
  atualizarReceita,
  calcularCusto,
};

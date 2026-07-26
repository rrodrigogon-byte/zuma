/**
 * Controllers do Módulo LOJA - Vendedor
 * SetPoint Ultra
 */

import { db } from '../../../core/database.js';

/**
 * Listar vendedores
 */
export const listarVendedores = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      SELECT u.id, u.nome, u.email, u.ativo,
        COUNT(DISTINCT c.id) as total_vendas,
        SUM(c.total_liquido) as total_vendido
      FROM usuarios u
      LEFT JOIN comandas c ON u.id = c.id AND c.status = 'fechada'
      WHERE u.tenant_id = $1 AND 'vendedor' = ANY(u.roles)
      GROUP BY u.id
      ORDER BY u.nome
      `,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar vendedores:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Criar vendedor
 */
export const criarVendedor = async (req, res) => {
  try {
    const { nome, email, comissao_percentual = 5 } = req.body;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      INSERT INTO usuarios (
        email, password_hash, tenant_id, nome, roles, ativo
      )
      VALUES ($1, '', $2, $3, ARRAY['vendedor'], true)
      RETURNING id, nome, email
      `,
      [email, tenantId, nome]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar vendedor:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obter comissões de vendedor
 */
export const obterComissoes = async (req, res) => {
  try {
    const { id: vendedorId } = req.params;
    const { data_inicio, data_fim } = req.query;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      SELECT 
        DATE(c.data_abertura) as data,
        COUNT(*) as total_vendas,
        SUM(c.total_liquido) as total_vendido,
        ROUND(SUM(c.total_liquido) * 0.05, 2) as comissao
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
    console.error('Erro ao obter comissões:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  listarVendedores,
  criarVendedor,
  obterComissoes,
};

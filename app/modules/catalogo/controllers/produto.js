/**
 * ============================================================================
 * MÓDULO CATÁLOGO - CONTROLLER DE PRODUTOS COM CLASSIFICAÇÃO FISCAL
 * ============================================================================
 * Arquivo: app/modules/catalogo/controllers/produto.js
 * Descrição: CRUD de produtos com NCM, CEST, CFOP, CST/CSOSN, tributação
 * Versão: 2.0 (Kytto ERP)
 * ============================================================================
 */

import * as dbPg from '../../../db-pg.js';

/**
 * ============================================================================
 * CRIAR PRODUTO
 * ============================================================================
 */

/**
 * POST /catalogo/produtos
 * Criar novo produto com classificação fiscal
 * 
 * Body:
 *   - codigo_interno: VARCHAR (código único da empresa)
 *   - codigo_barras: VARCHAR (EAN, opcional)
 *   - nome: VARCHAR (nome do produto)
 *   - descricao: TEXT (opcional)
 *   - categoria_id: UUID (categoria do produto)
 *   - preco_custo: DECIMAL (preço de custo)
 *   - preco_venda: DECIMAL (preço de venda)
 *   - preco_promocao: DECIMAL (opcional)
 *   - unidade_medida: VARCHAR (un, kg, l, ml, dose, etc)
 *   - estoque_minimo: DECIMAL (opcional)
 *   - estoque_maximo: DECIMAL (opcional)
 *   - ncm: VARCHAR (8 dígitos, obrigatório)
 *   - cest: VARCHAR (7 dígitos, opcional)
 *   - cfop: VARCHAR (4 dígitos, opcional)
 *   - cst_icms: VARCHAR (CST ICMS, ex: 00, 20, 60, etc)
 *   - aliquota_icms: DECIMAL (%, ex: 7.00, 18.00)
 *   - cst_pis: VARCHAR (CST PIS, ex: 01, 02, 03, etc)
 *   - aliquota_pis: DECIMAL (%, ex: 1.65, 7.65)
 *   - cst_cofins: VARCHAR (CST COFINS)
 *   - aliquota_cofins: DECIMAL (%, ex: 7.60, 15.00)
 *   - csosn: VARCHAR (CSOSN para simples nacional, ex: 101, 102, 201, etc)
 *   - marca: VARCHAR (marca do produto, opcional)
 *   - fornecedor_id: UUID (fornecedor padrão, opcional)
 *   - imagem_url: VARCHAR (URL da imagem, opcional)
 * 
 * Response: { produto, mensagem }
 */
export const criarProduto = async (req, res) => {
  try {
    const {
      codigo_interno,
      codigo_barras,
      nome,
      descricao,
      categoria_id,
      preco_custo,
      preco_venda,
      preco_promocao,
      unidade_medida = 'un',
      estoque_minimo,
      estoque_maximo,
      ncm,
      cest,
      cfop,
      cst_icms,
      aliquota_icms,
      cst_pis,
      aliquota_pis,
      cst_cofins,
      aliquota_cofins,
      csosn,
      marca,
      fornecedor_id,
      imagem_url
    } = req.body;

    const empresaId = req.tenantId || req.empresaId;
    const usuarioId = req.user?.id || req.usuario?.usuario_id;

    // Validações obrigatórias
    if (!codigo_interno || !nome || !categoria_id || preco_custo === undefined || preco_venda === undefined || !ncm) {
      return res.status(400).json({
        erro: 'Campos obrigatórios: codigo_interno, nome, categoria_id, preco_custo, preco_venda, ncm'
      });
    }

    // Validar NCM (8 dígitos)
    if (!/^\d{8}$/.test(ncm)) {
      return res.status(400).json({ erro: 'NCM deve ter 8 dígitos' });
    }

    // Validar CEST (7 dígitos) se informado
    if (cest && !/^\d{7}$/.test(cest)) {
      return res.status(400).json({ erro: 'CEST deve ter 7 dígitos' });
    }

    // Validar preços
    if (preco_custo < 0 || preco_venda < 0) {
      return res.status(400).json({ erro: 'Preços não podem ser negativos' });
    }

    if (preco_venda < preco_custo) {
      return res.status(400).json({ erro: 'Preço de venda não pode ser menor que o custo' });
    }

    // Verificar categoria
    const categoria = await dbPg.findById('categorias', categoria_id, empresaId);
    if (!categoria) {
      return res.status(404).json({ erro: 'Categoria não encontrada' });
    }

    // Verificar código interno único
    const produtoExistente = await dbPg.query(
      `SELECT id FROM produtos WHERE empresa_id = $1 AND codigo_interno = $2`,
      [empresaId, codigo_interno]
    );

    if (produtoExistente.rows.length > 0) {
      return res.status(400).json({ erro: 'Código interno já existe nesta empresa' });
    }

    // Criar produto
    const result = await dbPg.query(
      `INSERT INTO produtos (
        empresa_id, categoria_id, codigo_interno, codigo_barras, nome, descricao,
        preco_custo, preco_venda, preco_promocao, unidade_medida,
        estoque_minimo, estoque_maximo, ativo, imagem_url,
        ncm, cest, cfop, cst_icms, aliquota_icms,
        cst_pis, aliquota_pis, cst_cofins, aliquota_cofins, csosn,
        marca, fornecedor_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
      )
      RETURNING *`,
      [
        empresaId, categoria_id, codigo_interno, codigo_barras || null, nome, descricao || null,
        preco_custo, preco_venda, preco_promocao || null, unidade_medida,
        estoque_minimo || null, estoque_maximo || null, imagem_url || null,
        ncm, cest || null, cfop || null, cst_icms || null, aliquota_icms || null,
        cst_pis || null, aliquota_pis || null, cst_cofins || null, aliquota_cofins || null, csosn || null,
        marca || null, fornecedor_id || null
      ]
    );

    const produto = result.rows[0];

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: empresaId,
      usuario_id: usuarioId,
      tabela: 'produtos',
      operacao: 'INSERT',
      registro_id: produto.id,
      dados_novo: {
        codigo_interno,
        nome,
        ncm,
        preco_venda
      },
      ip_address: req.ip
    });

    res.status(201).json({
      sucesso: true,
      produto,
      mensagem: 'Produto criado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({ erro: 'Erro ao criar produto', detalhes: error.message });
  }
};

/**
 * ============================================================================
 * ATUALIZAR PRODUTO
 * ============================================================================
 */

/**
 * PUT /catalogo/produtos/:produto_id
 * Atualizar produto
 * 
 * Body: Qualquer campo do produto (exceto id, empresa_id, data_criacao)
 * 
 * Response: { produto, mensagem }
 */
export const atualizarProduto = async (req, res) => {
  try {
    const { produto_id } = req.params;
    const empresaId = req.tenantId || req.empresaId;
    const usuarioId = req.user?.id || req.usuario?.usuario_id;

    // Verificar produto
    const produtoAtual = await dbPg.findById('produtos', produto_id, empresaId);
    if (!produtoAtual) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    // Validar NCM se informado
    if (req.body.ncm && !/^\d{8}$/.test(req.body.ncm)) {
      return res.status(400).json({ erro: 'NCM deve ter 8 dígitos' });
    }

    // Validar CEST se informado
    if (req.body.cest && !/^\d{7}$/.test(req.body.cest)) {
      return res.status(400).json({ erro: 'CEST deve ter 7 dígitos' });
    }

    // Validar preços se informados
    if (req.body.preco_custo !== undefined && req.body.preco_custo < 0) {
      return res.status(400).json({ erro: 'Preço de custo não pode ser negativo' });
    }

    if (req.body.preco_venda !== undefined && req.body.preco_venda < 0) {
      return res.status(400).json({ erro: 'Preço de venda não pode ser negativo' });
    }

    // Preparar dados para atualização
    const dadosAtualizacao = {};
    const camposPermitidos = [
      'codigo_barras', 'nome', 'descricao', 'preco_custo', 'preco_venda',
      'preco_promocao', 'unidade_medida', 'estoque_minimo', 'estoque_maximo',
      'ativo', 'imagem_url', 'ncm', 'cest', 'cfop', 'cst_icms', 'aliquota_icms',
      'cst_pis', 'aliquota_pis', 'cst_cofins', 'aliquota_cofins', 'csosn',
      'marca', 'fornecedor_id'
    ];

    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) {
        dadosAtualizacao[campo] = req.body[campo];
      }
    }

    if (Object.keys(dadosAtualizacao).length === 0) {
      return res.status(400).json({ erro: 'Nenhum campo para atualizar' });
    }

    // Atualizar produto
    const result = await dbPg.query(
      `UPDATE produtos 
       SET ${Object.keys(dadosAtualizacao).map((k, i) => `${k} = $${i + 1}`).join(', ')},
           data_atualizacao = NOW()
       WHERE id = $${Object.keys(dadosAtualizacao).length + 1} AND empresa_id = $${Object.keys(dadosAtualizacao).length + 2}
       RETURNING *`,
      [...Object.values(dadosAtualizacao), produto_id, empresaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    const produto = result.rows[0];

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: empresaId,
      usuario_id: usuarioId,
      tabela: 'produtos',
      operacao: 'UPDATE',
      registro_id: produto_id,
      dados_anterior: produtoAtual,
      dados_novo: dadosAtualizacao,
      ip_address: req.ip
    });

    res.json({
      sucesso: true,
      produto,
      mensagem: 'Produto atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ erro: 'Erro ao atualizar produto', detalhes: error.message });
  }
};

/**
 * ============================================================================
 * LISTAR PRODUTOS
 * ============================================================================
 */

/**
 * GET /catalogo/produtos
 * Listar produtos com filtros
 * 
 * Query:
 *   - categoria_id: UUID (opcional)
 *   - ativo: BOOLEAN (opcional)
 *   - busca: STRING (busca por nome ou código, opcional)
 *   - limit: INT (padrão 100)
 *   - offset: INT (padrão 0)
 * 
 * Response: [ { produto } ]
 */
export const listarProdutos = async (req, res) => {
  try {
    const { categoria_id, ativo, busca, limit = 100, offset = 0 } = req.query;
    const empresaId = req.tenantId || req.empresaId;

    let sql = `
      SELECT 
        p.*,
        c.nome as categoria_nome,
        f.nome as fornecedor_nome
      FROM produtos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN fornecedores f ON p.fornecedor_id = f.id
      WHERE p.empresa_id = $1
    `;
    const params = [empresaId];
    let paramIndex = 2;

    if (categoria_id) {
      sql += ` AND p.categoria_id = $${paramIndex}`;
      params.push(categoria_id);
      paramIndex++;
    }

    if (ativo !== undefined) {
      sql += ` AND p.ativo = $${paramIndex}`;
      params.push(ativo === 'true' || ativo === true);
      paramIndex++;
    }

    if (busca) {
      sql += ` AND (p.nome ILIKE $${paramIndex} OR p.codigo_interno ILIKE $${paramIndex} OR p.codigo_barras ILIKE $${paramIndex})`;
      params.push(`%${busca}%`);
      paramIndex++;
    }

    sql += ` ORDER BY p.nome ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await dbPg.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    res.status(500).json({ erro: 'Erro ao listar produtos', detalhes: error.message });
  }
};

/**
 * GET /catalogo/produtos/:produto_id
 * Obter detalhes de um produto
 * 
 * Response: { produto }
 */
export const obterProduto = async (req, res) => {
  try {
    const { produto_id } = req.params;
    const empresaId = req.tenantId || req.empresaId;

    const result = await dbPg.query(
      `SELECT 
        p.*,
        c.nome as categoria_nome,
        f.nome as fornecedor_nome
      FROM produtos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN fornecedores f ON p.fornecedor_id = f.id
      WHERE p.id = $1 AND p.empresa_id = $2`,
      [produto_id, empresaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter produto:', error);
    res.status(500).json({ erro: 'Erro ao obter produto', detalhes: error.message });
  }
};

/**
 * ============================================================================
 * DELETAR PRODUTO
 * ============================================================================
 */

/**
 * DELETE /catalogo/produtos/:produto_id
 * Deletar produto (soft delete - marcar como inativo)
 * 
 * Response: { mensagem }
 */
export const deletarProduto = async (req, res) => {
  try {
    const { produto_id } = req.params;
    const empresaId = req.tenantId || req.empresaId;
    const usuarioId = req.user?.id || req.usuario?.usuario_id;

    // Verificar produto
    const produto = await dbPg.findById('produtos', produto_id, empresaId);
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    // Soft delete (marcar como inativo)
    await dbPg.query(
      `UPDATE produtos SET ativo = false, data_atualizacao = NOW() WHERE id = $1 AND empresa_id = $2`,
      [produto_id, empresaId]
    );

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: empresaId,
      usuario_id: usuarioId,
      tabela: 'produtos',
      operacao: 'UPDATE',
      registro_id: produto_id,
      dados_novo: { ativo: false },
      ip_address: req.ip
    });

    res.json({
      sucesso: true,
      mensagem: 'Produto deletado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    res.status(500).json({ erro: 'Erro ao deletar produto', detalhes: error.message });
  }
};

export default {
  criarProduto,
  atualizarProduto,
  listarProdutos,
  obterProduto,
  deletarProduto
};

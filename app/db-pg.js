/**
 * ============================================================================
 * ERP MODULAR - MÓDULO DE BANCO DE DADOS POSTGRESQL
 * ============================================================================
 * Arquivo: db-pg.js
 * Descrição: Interface de acesso ao PostgreSQL com pool de conexões,
 *            transações, queries preparadas e helpers para o ERP
 * ============================================================================
 */

import pg from 'pg';
import { promisify } from 'util';

const { Pool } = pg;

// Configuração do pool de conexões
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'erp_modular',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20, // Máximo de conexões
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Tratamento de erros do pool
pool.on('error', (err) => {
  console.error('Erro não esperado no pool de conexões:', err);
  process.exit(-1);
});

/**
 * Executar query com pool
 */
export async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[SLOW QUERY] ${duration}ms: ${text.substring(0, 50)}...`);
    }
    return result;
  } catch (error) {
    console.error('Erro na query:', text, params, error);
    throw error;
  }
}

/**
 * Iniciar transação
 */
export async function beginTransaction() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    return client;
  } catch (error) {
    client.release();
    throw error;
  }
}

/**
 * Commit de transação
 */
export async function commit(client) {
  try {
    await client.query('COMMIT');
  } finally {
    client.release();
  }
}

/**
 * Rollback de transação
 */
export async function rollback(client) {
  try {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}

/**
 * Executar query dentro de transação
 */
export async function queryInTransaction(client, text, params = []) {
  return await client.query(text, params);
}

/**
 * ============================================================================
 * HELPERS PARA OPERAÇÕES COMUNS
 * ============================================================================
 */

/**
 * Buscar por ID
 */
export async function findById(table, id, empresaId = null) {
  let sql = `SELECT * FROM ${table} WHERE id = $1`;
  const params = [id];
  
  if (empresaId) {
    sql += ` AND empresa_id = $2`;
    params.push(empresaId);
  }
  
  const result = await query(sql, params);
  return result.rows[0] || null;
}

/**
 * Buscar todos com filtros
 */
export async function findAll(table, filters = {}, empresaId = null, limit = 100, offset = 0) {
  let sql = `SELECT * FROM ${table}`;
  const params = [];
  const conditions = [];
  let paramIndex = 1;

  if (empresaId) {
    conditions.push(`empresa_id = $${paramIndex}`);
    params.push(empresaId);
    paramIndex++;
  }

  // Adicionar filtros dinâmicos
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      conditions.push(`${key} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return result.rows;
}

/**
 * Contar registros
 */
export async function count(table, filters = {}, empresaId = null) {
  let sql = `SELECT COUNT(*) as total FROM ${table}`;
  const params = [];
  const conditions = [];
  let paramIndex = 1;

  if (empresaId) {
    conditions.push(`empresa_id = $${paramIndex}`);
    params.push(empresaId);
    paramIndex++;
  }

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      conditions.push(`${key} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  const result = await query(sql, params);
  return parseInt(result.rows[0].total, 10);
}

/**
 * Inserir registro
 */
export async function insert(table, data) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  const sql = `INSERT INTO ${table} (${columns.join(', ')}) 
               VALUES (${placeholders}) 
               RETURNING *`;

  const result = await query(sql, values);
  return result.rows[0];
}

/**
 * Atualizar registro
 */
export async function update(table, id, data, empresaId = null) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  let paramIndex = values.length + 1;

  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
  let sql = `UPDATE ${table} SET ${setClause}, data_atualizacao = NOW() WHERE id = $${paramIndex}`;
  const params = [...values, id];

  if (empresaId) {
    paramIndex++;
    sql += ` AND empresa_id = $${paramIndex}`;
    params.push(empresaId);
  }

  sql += ` RETURNING *`;

  const result = await query(sql, params);
  return result.rows[0] || null;
}

/**
 * Deletar registro
 */
export async function deleteRecord(table, id, empresaId = null) {
  let sql = `DELETE FROM ${table} WHERE id = $1`;
  const params = [id];

  if (empresaId) {
    sql += ` AND empresa_id = $2`;
    params.push(empresaId);
  }

  const result = await query(sql, params);
  return result.rowCount > 0;
}

/**
 * ============================================================================
 * OPERAÇÕES ESPECÍFICAS DO ERP
 * ============================================================================
 */

/**
 * Criar empresa
 */
export async function criarEmpresa(dados) {
  const sql = `
    INSERT INTO empresas 
    (nome, cnpj, razao_social, inscricao_estadual, tipo_negocio, ativa)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  const result = await query(sql, [
    dados.nome,
    dados.cnpj,
    dados.razao_social,
    dados.inscricao_estadual || null,
    dados.tipo_negocio || 'outro',
    true
  ]);
  return result.rows[0];
}

/**
 * Criar usuário
 */
export async function criarUsuario(dados) {
  const sql = `
    INSERT INTO usuarios
    (empresa_id, email, senha_hash, nome_completo, cpf, role, ativo)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, email, nome_completo, role
  `;
  const result = await query(sql, [
    dados.empresa_id,
    dados.email,
    dados.senha_hash,
    dados.nome_completo,
    dados.cpf || null,
    dados.role || 'operador',
    true
  ]);
  return result.rows[0];
}

/**
 * Buscar usuário por email
 */
export async function buscarUsuarioPorEmail(email, empresaId) {
  const sql = `
    SELECT * FROM usuarios 
    WHERE email = $1 AND empresa_id = $2 AND ativo = true
  `;
  const result = await query(sql, [email, empresaId]);
  return result.rows[0] || null;
}

/**
 * Registrar auditoria
 */
export async function registrarAuditoria(dados) {
  const sql = `
    INSERT INTO auditoria
    (empresa_id, usuario_id, tabela, operacao, registro_id, dados_anterior, dados_novo, ip_address)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `;
  await query(sql, [
    dados.empresa_id,
    dados.usuario_id || null,
    dados.tabela,
    dados.operacao,
    dados.registro_id,
    dados.dados_anterior ? JSON.stringify(dados.dados_anterior) : null,
    dados.dados_novo ? JSON.stringify(dados.dados_novo) : null,
    dados.ip_address || null
  ]);
}

/**
 * Criar produto
 */
export async function criarProduto(dados) {
  const sql = `
    INSERT INTO produtos
    (empresa_id, categoria_id, codigo_interno, nome, preco_custo, preco_venda, unidade_medida, ativo)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  const result = await query(sql, [
    dados.empresa_id,
    dados.categoria_id,
    dados.codigo_interno,
    dados.nome,
    dados.preco_custo,
    dados.preco_venda,
    dados.unidade_medida || 'un',
    true
  ]);
  return result.rows[0];
}

/**
 * Atualizar estoque
 */
export async function atualizarEstoque(empresaId, produtoId, quantidade, tipo = 'ajuste', motivo = null) {
  const client = await beginTransaction();
  try {
    // Buscar estoque atual
    const estoqueResult = await queryInTransaction(
      client,
      `SELECT quantidade FROM estoque WHERE empresa_id = $1 AND produto_id = $2`,
      [empresaId, produtoId]
    );

    const quantidadeAtual = estoqueResult.rows[0]?.quantidade || 0;
    const novaQuantidade = quantidadeAtual + quantidade;

    // Validar se não fica negativo
    if (novaQuantidade < 0) {
      throw new Error('Estoque insuficiente');
    }

    // Atualizar estoque
    await queryInTransaction(
      client,
      `UPDATE estoque SET quantidade = $1 WHERE empresa_id = $2 AND produto_id = $3`,
      [novaQuantidade, empresaId, produtoId]
    );

    // Registrar movimentação
    await queryInTransaction(
      client,
      `INSERT INTO movimentacoes_estoque
       (empresa_id, produto_id, tipo, quantidade, motivo, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [empresaId, produtoId, tipo, quantidade, motivo, null]
    );

    await commit(client);
    return novaQuantidade;
  } catch (error) {
    await rollback(client);
    throw error;
  }
}

/**
 * Criar venda
 */
export async function criarVenda(dados) {
  const sql = `
    INSERT INTO vendas
    (empresa_id, numero_venda, usuario_vendedor_id, tipo_venda, status, valor_bruto, valor_liquido)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const result = await query(sql, [
    dados.empresa_id,
    dados.numero_venda,
    dados.usuario_vendedor_id,
    dados.tipo_venda || 'pdv',
    'aberta',
    dados.valor_bruto || 0,
    dados.valor_liquido || 0
  ]);
  return result.rows[0];
}

/**
 * Adicionar item à venda
 */
export async function adicionarItemVenda(dados) {
  const sql = `
    INSERT INTO itens_venda
    (venda_id, produto_id, quantidade, valor_unitario, valor_total)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const result = await query(sql, [
    dados.venda_id,
    dados.produto_id,
    dados.quantidade,
    dados.valor_unitario,
    dados.quantidade * dados.valor_unitario
  ]);
  return result.rows[0];
}

/**
 * Fechar venda
 */
export async function fecharVenda(empresaId, vendaId) {
  const sql = `
    UPDATE vendas 
    SET status = 'fechada', valor_liquido = (
      SELECT COALESCE(SUM(valor_total), 0) FROM itens_venda WHERE venda_id = $1
    )
    WHERE id = $1 AND empresa_id = $2
    RETURNING *
  `;
  const result = await query(sql, [vendaId, empresaId]);
  return result.rows[0] || null;
}

/**
 * Registrar pagamento
 */
export async function registrarPagamento(dados) {
  const sql = `
    INSERT INTO pagamentos
    (empresa_id, venda_id, forma_pagamento_id, valor, status, usuario_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  const result = await query(sql, [
    dados.empresa_id,
    dados.venda_id,
    dados.forma_pagamento_id,
    dados.valor,
    dados.status || 'pendente',
    dados.usuario_id
  ]);
  return result.rows[0];
}

/**
 * Buscar relatório de vendas
 */
export async function relatorioVendas(empresaId, dataInicio, dataFim) {
  const sql = `
    SELECT 
      DATE(v.data_venda) as data,
      COUNT(v.id) as quantidade_vendas,
      SUM(v.valor_liquido) as total_vendas,
      AVG(v.valor_liquido) as ticket_medio,
      u.nome_completo as vendedor_top,
      COUNT(DISTINCT u.id) as quantidade_vendedores
    FROM vendas v
    LEFT JOIN usuarios u ON v.usuario_vendedor_id = u.id
    WHERE v.empresa_id = $1 
      AND v.data_venda >= $2 
      AND v.data_venda <= $3
      AND v.status = 'fechada'
    GROUP BY DATE(v.data_venda), u.nome_completo
    ORDER BY data DESC
  `;
  const result = await query(sql, [empresaId, dataInicio, dataFim]);
  return result.rows;
}

/**
 * Fechar conexão do pool
 */
export async function closePool() {
  await pool.end();
  console.log('Pool de conexões PostgreSQL fechado');
}

/**
 * Health check do banco de dados
 */
export async function healthCheck() {
  try {
    const result = await query('SELECT NOW()');
    return { status: 'ok', timestamp: result.rows[0].now };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

export default {
  query,
  beginTransaction,
  commit,
  rollback,
  queryInTransaction,
  findById,
  findAll,
  count,
  insert,
  update,
  deleteRecord,
  criarEmpresa,
  criarUsuario,
  buscarUsuarioPorEmail,
  registrarAuditoria,
  criarProduto,
  atualizarEstoque,
  criarVenda,
  adicionarItemVenda,
  fecharVenda,
  registrarPagamento,
  relatorioVendas,
  closePool,
  healthCheck
};

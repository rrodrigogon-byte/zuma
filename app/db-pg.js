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

// Configuração do pool de conexões. Em produção, a URL gerenciada tem
// precedência; nenhuma credencial é impressa ou persistida pelo executor.
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const poolConfig = connectionString
  ? {
      connectionString,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'erp_modular',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    };
const pool = new Pool({
  ...poolConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Tratamento de erros do pool
pool.on('error', (err) => {
  console.error('Aviso no pool de conexões (conexão descartada):', err?.message || err);
});

/**
 * Executar query com pool
 */
export async function query(text, params = []) {
  let attempts = 0;
  while (true) {
    const start = Date.now();
    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`[SLOW QUERY] ${duration}ms: ${text.substring(0, 50)}...`);
      }
      return result;
    } catch (error) {
      attempts++;
      const isTransient =
        error?.code === '57P03' ||
        error?.code === '57P01' ||
        error?.code === 'ECONNREFUSED' ||
        error?.code === 'ETIMEDOUT' ||
        error?.message?.includes('not yet accepting connections') ||
        error?.message?.includes('timeout exceeded');
      if (isTransient && attempts < 5) {
        console.warn(`[db-pg query] Conexão transitória com PostgreSQL (${error.code || error.message}), retry ${attempts}/5 em 2s...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      console.error('Erro na query:', text, params, error);
      throw error;
    }
  }
}

/**
 * Adquirir uma conexão dedicada do pool para operações que dependem da
 * mesma sessão PostgreSQL, como advisory locks e migrations.
 */
export async function acquireClient() {
  let attempts = 0;
  while (true) {
    try {
      return await pool.connect();
    } catch (err) {
      attempts++;
      const isTransient =
        err?.code === '57P03' ||
        err?.code === '57P01' ||
        err?.code === 'ECONNREFUSED' ||
        err?.code === 'ETIMEDOUT' ||
        err?.message?.includes('not yet accepting connections') ||
        err?.message?.includes('timeout exceeded');
      if (isTransient && attempts < 10) {
        console.warn(`[db-pg acquireClient] PostgreSQL inicializando (${err.code || err.message}), retry ${attempts}/10 em 3s...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Liberar uma conexão dedicada previamente adquirida.
 */
export function releaseClient(client) {
  client.release();
}

/**
 * Iniciar transação
 */
export async function beginTransaction() {
  const client = await acquireClient();
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
export async function findById(table, id, empresaId = null, lojaId = null) {
  let sql = `SELECT * FROM ${table} WHERE id = $1`;
  const params = [id];
  let paramIndex = 2;

  if (empresaId) {
    sql += ` AND empresa_id = $${paramIndex++}`;
    params.push(empresaId);
  }
  if (lojaId) {
    sql += ` AND loja_id = $${paramIndex++}`;
    params.push(lojaId);
  }

  const result = await query(sql, params);
  return result.rows[0] || null;
}

/**
 * Buscar todos com filtros
 */
export async function findAll(table, filters = {}, empresaId = null, limit = 100, offset = 0, lojaId = null) {
  let sql = `SELECT * FROM ${table}`;
  const params = [];
  const conditions = [];
  let paramIndex = 1;

  if (empresaId) {
    conditions.push(`empresa_id = $${paramIndex}`);
    params.push(empresaId);
    paramIndex++;
  }
  if (lojaId) {
    conditions.push(`loja_id = $${paramIndex}`);
    params.push(lojaId);
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
export async function update(table, id, data, empresaId = null, lojaId = null) {
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
  if (lojaId) {
    paramIndex++;
    sql += ` AND loja_id = $${paramIndex}`;
    params.push(lojaId);
  }

  sql += ` RETURNING *`;

  const result = await query(sql, params);
  return result.rows[0] || null;
}

/**
 * Deletar registro
 */
export async function deleteRecord(table, id, empresaId = null, lojaId = null) {
  let sql = `DELETE FROM ${table} WHERE id = $1`;
  const params = [id];
  let paramIndex = 2;

  if (empresaId) {
    sql += ` AND empresa_id = $${paramIndex++}`;
    params.push(empresaId);
  }
  if (lojaId) {
    sql += ` AND loja_id = $${paramIndex++}`;
    params.push(lojaId);
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
    (empresa_id, loja_id, usuario_id, tabela, operacao, registro_id, dados_anterior, dados_novo, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `;
  await query(sql, [
    dados.empresa_id,
    dados.loja_id || null,
    dados.usuario_id || null,
    dados.tabela,
    dados.operacao,
    dados.registro_id,
    dados.dados_anterior ? JSON.stringify(dados.dados_anterior) : null,
    dados.dados_novo ? JSON.stringify(dados.dados_novo) : null,
    dados.ip_address || null,
    dados.user_agent || null
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
export async function atualizarEstoque(empresaId, produtoId, quantidade, tipo = 'ajuste', motivo = null, lojaId = null, usuarioId = null) {
  const client = await beginTransaction();
  try {
    // Compatibilidade com chamadas legadas: o saldo sem loja explícita é
    // direcionado somente à matriz, nunca a uma unidade arbitrária.
    let lojaEfetivaId = lojaId;
    if (!lojaEfetivaId) {
      const matriz = await queryInTransaction(
        client,
        `SELECT id FROM lojas WHERE empresa_id = $1 AND ativa = true
         ORDER BY CASE WHEN codigo = 'MATRIZ' THEN 0 ELSE 1 END, data_criacao LIMIT 1`,
        [empresaId]
      );
      lojaEfetivaId = matriz.rows[0]?.id;
      if (!lojaEfetivaId) throw new Error('Não há loja ativa para registrar o estoque');
    }

    const estoqueResult = await queryInTransaction(
      client,
      `SELECT id, quantidade FROM estoque
       WHERE empresa_id = $1 AND loja_id = $2 AND produto_id = $3
       ORDER BY data_atualizacao DESC NULLS LAST
       LIMIT 1 FOR UPDATE`,
      [empresaId, lojaEfetivaId, produtoId]
    );
    const quantidadeAtual = Number(estoqueResult.rows[0]?.quantidade || 0);
    const novaQuantidade = quantidadeAtual + Number(quantidade);
    if (!Number.isFinite(novaQuantidade)) throw new Error('Quantidade inválida');
    if (novaQuantidade < 0) throw new Error('Estoque insuficiente');

    if (estoqueResult.rows.length > 0) {
      await queryInTransaction(
        client,
        `UPDATE estoque SET quantidade = $1, data_atualizacao = CURRENT_TIMESTAMP WHERE id = $2`,
        [novaQuantidade, estoqueResult.rows[0].id]
      );
    } else {
      await queryInTransaction(
        client,
        `INSERT INTO estoque (empresa_id, loja_id, produto_id, quantidade)
         VALUES ($1, $2, $3, $4)`,
        [empresaId, lojaEfetivaId, produtoId, novaQuantidade]
      );
    }

    await queryInTransaction(
      client,
      `INSERT INTO movimentacoes_estoque
       (empresa_id, loja_id, produto_id, tipo, quantidade, motivo, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [empresaId, lojaEfetivaId, produtoId, tipo, quantidade, motivo, usuarioId]
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
    (empresa_id, loja_id, numero_venda, usuario_vendedor_id, tipo_venda, status, valor_bruto, valor_liquido)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  const result = await query(sql, [
    dados.empresa_id,
    dados.loja_id,
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
export async function fecharVenda(empresaId, vendaId, lojaId = null) {
  let sql = `
    UPDATE vendas
    SET status = 'fechada', valor_liquido = (
      SELECT COALESCE(SUM(valor_total), 0) FROM itens_venda WHERE venda_id = $1
    )
    WHERE id = $1 AND empresa_id = $2
  `;
  const params = [vendaId, empresaId];
  if (lojaId) {
    sql += ' AND loja_id = $3';
    params.push(lojaId);
  }
  sql += ' RETURNING *';
  const result = await query(sql, params);
  return result.rows[0] || null;
}

/**
 * Registrar pagamento
 */
export async function registrarPagamento(dados) {
  const lojaId = dados.loja_id || (await query(
    `SELECT loja_id FROM vendas WHERE id = $1 AND empresa_id = $2`,
    [dados.venda_id, dados.empresa_id]
  )).rows[0]?.loja_id;
  if (!lojaId) throw new Error('Loja da venda não encontrada para registrar pagamento');

  const sql = `
    INSERT INTO pagamentos
    (empresa_id, loja_id, venda_id, forma_pagamento_id, valor, status, usuario_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const result = await query(sql, [
    dados.empresa_id,
    lojaId,
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
export async function relatorioVendas(empresaId, dataInicio, dataFim, lojaId = null) {
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
      AND ($4::uuid IS NULL OR v.loja_id = $4::uuid)
    GROUP BY DATE(v.data_venda), u.nome_completo
    ORDER BY data DESC
  `;
  const result = await query(sql, [empresaId, dataInicio, dataFim, lojaId]);
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
  acquireClient,
  releaseClient,
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

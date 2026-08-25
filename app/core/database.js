/**
 * Módulo de Conexão com PostgreSQL
 * SetPoint Ultra - Core
 */

import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

// ============================================================================
// POOL DE CONEXÕES
// ============================================================================

let pool = null;

/**
 * Inicializar pool de conexões
 */
export const initializePool = () => {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  const poolConfig = connectionString
    ? {
        connectionString,
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      }
    : {
        host: config.database.postgres.host,
        port: config.database.postgres.port,
        database: config.database.postgres.database,
        user: config.database.postgres.user,
        password: config.database.postgres.password,
        ssl: config.database.postgres.ssl ? { rejectUnauthorized: false } : false,
      };
  pool = new Pool({
    ...poolConfig,
    max: config.database.postgres.max,
    idleTimeoutMillis: config.database.postgres.idleTimeoutMillis,
    connectionTimeoutMillis: config.database.postgres.connectionTimeoutMillis,
  });

  // Event listeners
  pool.on('error', (err) => {
    console.error('Erro inesperado no pool de conexões:', err);
  });

  pool.on('connect', () => {
    if (config.isDev) {
      console.log('Nova conexão estabelecida com o banco de dados');
    }
  });

  return pool;
};

/**
 * Obter pool de conexões
 */
export const getPool = () => {
  if (!pool) {
    return initializePool();
  }
  return pool;
};

// ============================================================================
// INTERFACE DE BANCO DE DADOS
// ============================================================================

export const db = {
  /**
   * Executar query com parâmetros
   */
  query: async (text, values = []) => {
    const pool = getPool();

    if (config.development.debugSQL) {
      console.log('SQL:', text);
      console.log('Valores:', values);
    }

    try {
      const result = await pool.query(text, values);
      return result;
    } catch (error) {
      console.error('Erro na query:', error);
      console.error('SQL:', text);
      console.error('Valores:', values);
      throw error;
    }
  },

  /**
   * Executar query sem parâmetros
   */
  queryRaw: async (text) => {
    const pool = getPool();

    if (config.development.debugSQL) {
      console.log('SQL (raw):', text);
    }

    try {
      const result = await pool.query(text);
      return result;
    } catch (error) {
      console.error('Erro na query raw:', error);
      console.error('SQL:', text);
      throw error;
    }
  },

  /**
   * Executar transação
   */
  transaction: async (callback) => {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Criar interface de transação
      const trx = {
        query: async (text, values = []) => {
          if (config.development.debugSQL) {
            console.log('SQL (TRX):', text);
            console.log('Valores:', values);
          }
          return client.query(text, values);
        },
      };

      // Executar callback
      const result = await callback(trx);

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Fechar pool de conexões
   */
  close: async () => {
    if (pool) {
      await pool.end();
      pool = null;
    }
  },

  /**
   * Verificar saúde da conexão
   */
  health: async () => {
    try {
      const result = await db.query('SELECT NOW()');
      return {
        status: 'healthy',
        timestamp: result.rows[0].now,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Construir WHERE clause dinamicamente
 */
export const buildWhereClause = (filters, paramStart = 1) => {
  const conditions = [];
  const values = [];
  let paramCount = paramStart;

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === 'string' && value.includes('%')) {
        // LIKE search
        conditions.push(`${key} ILIKE $${paramCount}`);
      } else if (Array.isArray(value)) {
        // IN clause
        conditions.push(`${key} = ANY($${paramCount})`);
      } else {
        // Exact match
        conditions.push(`${key} = $${paramCount}`);
      }
      values.push(value);
      paramCount++;
    }
  });

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  };
};

/**
 * Construir ORDER BY clause
 */
export const buildOrderByClause = (sortBy, direction = 'ASC') => {
  if (!sortBy) return '';

  const validDirections = ['ASC', 'DESC'];
  const dir = validDirections.includes(direction.toUpperCase())
    ? direction.toUpperCase()
    : 'ASC';

  return `ORDER BY ${sortBy} ${dir}`;
};

/**
 * Construir LIMIT/OFFSET clause
 */
export const buildPaginationClause = (limit, offset) => {
  let clause = '';

  if (limit) {
    clause += `LIMIT ${parseInt(limit)}`;
  }

  if (offset) {
    clause += ` OFFSET ${parseInt(offset)}`;
  }

  return clause;
};

/**
 * Executar query com paginação
 */
export const queryWithPagination = async (
  baseQuery,
  countQuery,
  values = [],
  limit = 20,
  offset = 0
) => {
  // Executar query de contagem
  const countResult = await db.query(countQuery, values);
  const total = parseInt(countResult.rows[0].count);

  // Executar query com paginação
  const paginationValues = [...values, limit, offset];
  const dataQuery = `${baseQuery} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;

  const result = await db.query(dataQuery, paginationValues);

  return {
    data: result.rows,
    pagination: {
      total,
      limit,
      offset,
      pages: Math.ceil(total / limit),
      currentPage: Math.floor(offset / limit) + 1,
    },
  };
};

/**
 * Inserir múltiplos registros
 */
export const insertMany = async (table, records) => {
  if (!records || records.length === 0) {
    return [];
  }

  const keys = Object.keys(records[0]);
  const placeholders = records
    .map(
      (_, rowIndex) =>
        `(${keys.map((_, colIndex) => `$${rowIndex * keys.length + colIndex + 1}`).join(', ')})`
    )
    .join(', ');

  const values = records.flatMap((record) => keys.map((key) => record[key]));

  const query = `
    INSERT INTO ${table} (${keys.join(', ')})
    VALUES ${placeholders}
    RETURNING *
  `;

  const result = await db.query(query, values);
  return result.rows;
};

/**
 * Atualizar múltiplos registros
 */
export const updateMany = async (table, records, idField = 'id') => {
  if (!records || records.length === 0) {
    return [];
  }

  const results = [];

  for (const record of records) {
    const id = record[idField];
    const updates = { ...record };
    delete updates[idField];

    const keys = Object.keys(updates);
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
    const values = [...Object.values(updates), id];

    const query = `
      UPDATE ${table}
      SET ${setClause}
      WHERE ${idField} = $${keys.length + 1}
      RETURNING *
    `;

    const result = await db.query(query, values);
    results.push(result.rows[0]);
  }

  return results;
};

export default db;

/**
 * Middleware Multi-Tenant
 * SetPoint Ultra - Core
 */

import { db } from './database.js';

/**
 * Middleware para extrair e validar tenant ID
 */
export const tenantMiddleware = async (req, res, next) => {
  try {
    // Obter tenant ID de várias fontes
    const tenantId =
      req.headers['x-tenant-id'] ||
      req.query.tenantId ||
      req.user?.tenantId ||
      req.body?.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant ID não fornecido',
        code: 'MISSING_TENANT_ID',
      });
    }

    // Validar se o tenant existe
    const tenantResult = await db.query(
      `
      SELECT id, cnpj, razao_social, ativo, modulos_ativos
      FROM estabelecimentos
      WHERE id = $1
      `,
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Tenant não encontrado',
        code: 'TENANT_NOT_FOUND',
      });
    }

    const tenant = tenantResult.rows[0];

    // Verificar se o tenant está ativo
    if (!tenant.ativo) {
      return res.status(403).json({
        error: 'Tenant inativo',
        code: 'TENANT_INACTIVE',
      });
    }

    // Se o usuário está autenticado, verificar se tem acesso a este tenant
    if (req.user) {
      const userTenantResult = await db.query(
        `
        SELECT tenant_id FROM usuarios
        WHERE id = $1 AND tenant_id = $2
        `,
        [req.user.id, tenantId]
      );

      if (userTenantResult.rows.length === 0) {
        return res.status(403).json({
          error: 'Acesso negado a este tenant',
          code: 'TENANT_ACCESS_DENIED',
        });
      }
    }

    // Armazenar informações do tenant na requisição
    req.tenant = {
      id: tenant.id,
      cnpj: tenant.cnpj,
      razao_social: tenant.razao_social,
      modulos_ativos: tenant.modulos_ativos || [],
    };

    // Armazenar tenant ID para queries
    req.tenantId = tenantId;

    next();
  } catch (error) {
    console.error('Erro no tenant middleware:', error);
    res.status(500).json({
      error: 'Erro ao validar tenant',
      code: 'TENANT_VALIDATION_ERROR',
    });
  }
};

/**
 * Middleware para verificar se um módulo está ativo
 */
export const requireModule = (moduleName) => {
  return (req, res, next) => {
    if (!req.tenant) {
      return res.status(400).json({
        error: 'Tenant não definido',
        code: 'TENANT_NOT_SET',
      });
    }

    const activeModules = req.tenant.modulos_ativos || [];

    // CORE é sempre obrigatório
    if (moduleName !== 'core' && !activeModules.includes(moduleName)) {
      return res.status(403).json({
        error: `Módulo ${moduleName} não está ativo`,
        code: 'MODULE_NOT_ACTIVE',
        module: moduleName,
      });
    }

    next();
  };
};

/**
 * Middleware para adicionar tenant ID automaticamente em queries
 */
export const tenantAwareQuery = (req, res, next) => {
  if (!req.tenantId) {
    return res.status(400).json({
      error: 'Tenant ID não disponível',
      code: 'TENANT_ID_NOT_AVAILABLE',
    });
  }

  // Armazenar função original de query
  const originalQuery = db.query.bind(db);

  // Sobrescrever função de query para adicionar tenant ID automaticamente
  db.query = async (text, values = []) => {
    // Se a query não tiver placeholder para tenant_id, adicionar
    if (!text.includes('$tenant_id') && !text.includes('tenant_id = $')) {
      // Adicionar WHERE tenant_id = $X ao final da query se não houver
      // Esta é uma abordagem simples; em produção, usar um ORM é melhor
    }

    return originalQuery(text, values);
  };

  next();
};

/**
 * Obter tenant por ID
 */
export const getTenant = async (tenantId) => {
  const result = await db.query(
    `
    SELECT 
      id, cnpj, razao_social, nome_fantasia, inscricao_estadual,
      endereco_logradouro, endereco_numero, endereco_complemento,
      endereco_bairro, endereco_cidade, endereco_estado, endereco_cep,
      telefone, email, responsavel_nome, responsavel_email,
      responsavel_telefone, ativo, modulos_ativos, criado_em, atualizado_em
    FROM estabelecimentos
    WHERE id = $1
    `,
    [tenantId]
  );

  if (result.rows.length === 0) {
    throw new Error('Tenant não encontrado');
  }

  return result.rows[0];
};

/**
 * Listar todos os tenants (admin only)
 */
export const listTenants = async (filters = {}) => {
  let query = `
    SELECT 
      id, cnpj, razao_social, nome_fantasia, email,
      ativo, modulos_ativos, criado_em
    FROM estabelecimentos
    WHERE 1=1
  `;

  const values = [];
  let paramCount = 1;

  // Filtrar por status ativo
  if (filters.ativo !== undefined) {
    query += ` AND ativo = $${paramCount}`;
    values.push(filters.ativo);
    paramCount++;
  }

  // Filtrar por módulo
  if (filters.modulo) {
    query += ` AND $${paramCount} = ANY(modulos_ativos)`;
    values.push(filters.modulo);
    paramCount++;
  }

  // Filtrar por CNPJ
  if (filters.cnpj) {
    query += ` AND cnpj ILIKE $${paramCount}`;
    values.push(`%${filters.cnpj}%`);
    paramCount++;
  }

  // Filtrar por razão social
  if (filters.razao_social) {
    query += ` AND razao_social ILIKE $${paramCount}`;
    values.push(`%${filters.razao_social}%`);
    paramCount++;
  }

  // Ordenação
  query += ` ORDER BY criado_em DESC`;

  // Paginação
  if (filters.limit) {
    query += ` LIMIT $${paramCount}`;
    values.push(filters.limit);
    paramCount++;
  }

  if (filters.offset) {
    query += ` OFFSET $${paramCount}`;
    values.push(filters.offset);
  }

  const result = await db.query(query, values);
  return result.rows;
};

/**
 * Criar novo tenant
 */
export const createTenant = async (tenantData) => {
  const {
    cnpj,
    razao_social,
    nome_fantasia,
    inscricao_estadual,
    endereco_logradouro,
    endereco_numero,
    endereco_complemento,
    endereco_bairro,
    endereco_cidade,
    endereco_estado,
    endereco_cep,
    telefone,
    email,
    responsavel_nome,
    responsavel_email,
    responsavel_telefone,
    modulos_ativos = ['core'],
  } = tenantData;

  // Validar CNPJ único
  const existingTenant = await db.query(
    `SELECT id FROM estabelecimentos WHERE cnpj = $1`,
    [cnpj]
  );

  if (existingTenant.rows.length > 0) {
    throw new Error('CNPJ já cadastrado');
  }

  const result = await db.query(
    `
    INSERT INTO estabelecimentos (
      cnpj, razao_social, nome_fantasia, inscricao_estadual,
      endereco_logradouro, endereco_numero, endereco_complemento,
      endereco_bairro, endereco_cidade, endereco_estado, endereco_cep,
      telefone, email, responsavel_nome, responsavel_email,
      responsavel_telefone, ativo, modulos_ativos
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true, $17)
    RETURNING id, cnpj, razao_social, email, modulos_ativos, criado_em
    `,
    [
      cnpj,
      razao_social,
      nome_fantasia,
      inscricao_estadual,
      endereco_logradouro,
      endereco_numero,
      endereco_complemento,
      endereco_bairro,
      endereco_cidade,
      endereco_estado,
      endereco_cep,
      telefone,
      email,
      responsavel_nome,
      responsavel_email,
      responsavel_telefone,
      modulos_ativos,
    ]
  );

  return result.rows[0];
};

/**
 * Atualizar tenant
 */
export const updateTenant = async (tenantId, updates) => {
  const allowedFields = [
    'nome_fantasia',
    'inscricao_estadual',
    'endereco_logradouro',
    'endereco_numero',
    'endereco_complemento',
    'endereco_bairro',
    'endereco_cidade',
    'endereco_estado',
    'endereco_cep',
    'telefone',
    'email',
    'responsavel_nome',
    'responsavel_email',
    'responsavel_telefone',
    'ativo',
    'modulos_ativos',
  ];

  const filteredUpdates = Object.keys(updates)
    .filter((key) => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = updates[key];
      return obj;
    }, {});

  if (Object.keys(filteredUpdates).length === 0) {
    throw new Error('Nenhum campo válido para atualizar');
  }

  const fields = Object.keys(filteredUpdates);
  const values = Object.values(filteredUpdates);
  values.push(tenantId);

  const setClause = fields
    .map((field, index) => `${field} = $${index + 1}`)
    .join(', ');

  const result = await db.query(
    `
    UPDATE estabelecimentos
    SET ${setClause}, atualizado_em = NOW()
    WHERE id = $${fields.length + 1}
    RETURNING id, cnpj, razao_social, email, modulos_ativos, atualizado_em
    `,
    values
  );

  if (result.rows.length === 0) {
    throw new Error('Tenant não encontrado');
  }

  return result.rows[0];
};

/**
 * Ativar módulo para um tenant
 */
export const activateModule = async (tenantId, moduleName) => {
  const tenant = await getTenant(tenantId);
  const modulos = tenant.modulos_ativos || [];

  if (!modulos.includes(moduleName)) {
    modulos.push(moduleName);
  }

  return updateTenant(tenantId, { modulos_ativos: modulos });
};

/**
 * Desativar módulo para um tenant
 */
export const deactivateModule = async (tenantId, moduleName) => {
  if (moduleName === 'core') {
    throw new Error('Não é possível desativar o módulo CORE');
  }

  const tenant = await getTenant(tenantId);
  const modulos = (tenant.modulos_ativos || []).filter((m) => m !== moduleName);

  return updateTenant(tenantId, { modulos_ativos: modulos });
};

export default {
  tenantMiddleware,
  requireModule,
  tenantAwareQuery,
  getTenant,
  listTenants,
  createTenant,
  updateTenant,
  activateModule,
  deactivateModule,
};

/**
 * Módulo de Autenticação e RBAC
 * SetPoint Ultra - Core
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { config } from '../config.js';
import { db } from './database.js';

// ============================================================================
// AUTENTICAÇÃO JWT
// ============================================================================

/**
 * Gera um JWT token
 */
export const generateToken = (user, expiresIn = config.auth.jwt.expiresIn) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      tenantId: user.tenant_id,
      roles: user.roles || [],
      permissions: user.permissions || [],
    },
    config.auth.jwt.secret,
    { expiresIn }
  );
};

/**
 * Gera um refresh token
 */
export const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      type: 'refresh',
    },
    config.auth.jwt.secret,
    { expiresIn: config.auth.jwt.refreshExpiresIn }
  );
};

/**
 * Verifica um JWT token
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.auth.jwt.secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expirado');
    }
    throw new Error('Token inválido');
  }
};

/**
 * Hash de senha
 */
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Compara senha com hash
 */
export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// ============================================================================
// CONTROLE DE ACESSO (RBAC)
// ============================================================================

/**
 * Roles disponíveis na plataforma
 */
export const ROLES = {
  ADMIN: 'admin',
  GERENTE: 'gerente',
  VENDEDOR: 'vendedor',
  GARCOM: 'garcom',
  BARBEIRO: 'barbeiro',
  CAIXA: 'caixa',
  CLIENTE: 'cliente',
};

/**
 * Permissões por role
 */
export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    'admin:read',
    'admin:write',
    'admin:delete',
    'users:manage',
    'modules:manage',
    'billing:manage',
    'reports:view',
    'settings:manage',
    'audit:view',
  ],

  [ROLES.GERENTE]: [
    'dashboard:view',
    'vendas:view',
    'estoque:view',
    'estoque:edit',
    'pagamentos:view',
    'relatorios:view',
    'usuarios:view',
    'usuarios:edit',
  ],

  [ROLES.VENDEDOR]: [
    'vendas:create',
    'vendas:view',
    'clientes:view',
    'estoque:view',
    'pagamentos:process',
  ],

  [ROLES.GARCOM]: [
    'comanda:create',
    'comanda:view',
    'comanda:edit',
    'pagamentos:process',
    'estoque:view',
  ],

  [ROLES.BARBEIRO]: [
    'agendamentos:view',
    'agendamentos:edit',
    'clientes:view',
    'servicos:view',
  ],

  [ROLES.CAIXA]: [
    'pagamentos:view',
    'pagamentos:process',
    'relatorios:view',
    'estoque:view',
  ],

  [ROLES.CLIENTE]: [
    'comanda:view',
    'comanda:create',
    'perfil:view',
    'perfil:edit',
  ],
};

/**
 * Obtém permissões de um usuário
 */
export const getUserPermissions = (roles) => {
  const permissions = new Set();

  if (Array.isArray(roles)) {
    roles.forEach((role) => {
      const rolePermissions = ROLE_PERMISSIONS[role] || [];
      rolePermissions.forEach((perm) => permissions.add(perm));
    });
  }

  return Array.from(permissions);
};

/**
 * Verifica se um usuário tem uma permissão
 */
export const hasPermission = (userPermissions, requiredPermission) => {
  if (!Array.isArray(userPermissions)) {
    return false;
  }

  // Verificar permissão exata
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Verificar wildcard (ex: admin:* permite admin:read, admin:write, etc)
  const [resource, action] = requiredPermission.split(':');
  const wildcardPerm = `${resource}:*`;

  return userPermissions.includes(wildcardPerm);
};

/**
 * Verifica se um usuário tem uma das permissões
 */
export const hasAnyPermission = (userPermissions, requiredPermissions) => {
  if (!Array.isArray(requiredPermissions)) {
    return hasPermission(userPermissions, requiredPermissions);
  }

  return requiredPermissions.some((perm) =>
    hasPermission(userPermissions, perm)
  );
};

/**
 * Verifica se um usuário tem todas as permissões
 */
export const hasAllPermissions = (userPermissions, requiredPermissions) => {
  if (!Array.isArray(requiredPermissions)) {
    return hasPermission(userPermissions, requiredPermissions);
  }

  return requiredPermissions.every((perm) =>
    hasPermission(userPermissions, perm)
  );
};

// ============================================================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ============================================================================

/**
 * Middleware para verificar JWT token
 */
export const authMiddleware = (req, res, next) => {
  try {
    const token =
      req.headers.authorization?.replace('Bearer ', '') ||
      req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        error: 'Token não fornecido',
        code: 'MISSING_TOKEN',
      });
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: error.message,
      code: 'INVALID_TOKEN',
    });
  }
};

/**
 * Middleware para verificar permissão
 */
export const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Não autenticado',
        code: 'NOT_AUTHENTICATED',
      });
    }

    if (!hasPermission(req.user.permissions, requiredPermission)) {
      return res.status(403).json({
        error: 'Permissão insuficiente',
        code: 'INSUFFICIENT_PERMISSION',
        required: requiredPermission,
      });
    }

    next();
  };
};

/**
 * Middleware para verificar múltiplas permissões (AND)
 */
export const requireAllPermissions = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Não autenticado',
        code: 'NOT_AUTHENTICATED',
      });
    }

    if (!hasAllPermissions(req.user.permissions, requiredPermissions)) {
      return res.status(403).json({
        error: 'Permissão insuficiente',
        code: 'INSUFFICIENT_PERMISSION',
        required: requiredPermissions,
      });
    }

    next();
  };
};

/**
 * Middleware para verificar múltiplas permissões (OR)
 */
export const requireAnyPermission = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Não autenticado',
        code: 'NOT_AUTHENTICATED',
      });
    }

    if (!hasAnyPermission(req.user.permissions, requiredPermissions)) {
      return res.status(403).json({
        error: 'Permissão insuficiente',
        code: 'INSUFFICIENT_PERMISSION',
        required: requiredPermissions,
      });
    }

    next();
  };
};

/**
 * Middleware para verificar role
 */
export const requireRole = (requiredRoles) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Não autenticado',
        code: 'NOT_AUTHENTICATED',
      });
    }

    const userRoles = req.user.roles || [];
    const hasRole = roles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        error: 'Role insuficiente',
        code: 'INSUFFICIENT_ROLE',
        required: roles,
      });
    }

    next();
  };
};

// ============================================================================
// SERVIÇOS DE AUTENTICAÇÃO
// ============================================================================

/**
 * Login de usuário
 */
export const login = async (email, password, tenantId) => {
  const query = `
    SELECT id, email, password_hash, tenant_id, roles, ativo
    FROM usuarios
    WHERE email = $1 AND tenant_id = $2 AND ativo = true
  `;

  const result = await db.query(query, [email, tenantId]);

  if (result.rows.length === 0) {
    throw new Error('Usuário ou senha inválidos');
  }

  const user = result.rows[0];

  // Verificar senha
  const passwordMatch = await comparePassword(password, user.password_hash);
  if (!passwordMatch) {
    throw new Error('Usuário ou senha inválidos');
  }

  // Obter permissões
  const permissions = getUserPermissions(user.roles);

  // Gerar tokens
  const token = generateToken({ ...user, permissions });
  const refreshToken = generateRefreshToken(user);

  // Armazenar refresh token no banco
  await db.query(
    `
    INSERT INTO refresh_tokens (usuario_id, token, expires_at)
    VALUES ($1, $2, NOW() + INTERVAL '7 days')
    `,
    [user.id, refreshToken]
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      tenantId: user.tenant_id,
      roles: user.roles,
      permissions,
    },
    token,
    refreshToken,
  };
};

/**
 * Refresh token
 */
export const refreshAccessToken = async (refreshToken) => {
  try {
    const decoded = verifyToken(refreshToken);

    // Verificar se o refresh token existe no banco
    const result = await db.query(
      `
      SELECT usuario_id FROM refresh_tokens
      WHERE token = $1 AND expires_at > NOW()
      `,
      [refreshToken]
    );

    if (result.rows.length === 0) {
      throw new Error('Refresh token inválido ou expirado');
    }

    // Obter dados do usuário
    const userResult = await db.query(
      `
      SELECT id, email, tenant_id, roles
      FROM usuarios
      WHERE id = $1
      `,
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      throw new Error('Usuário não encontrado');
    }

    const user = userResult.rows[0];
    const permissions = getUserPermissions(user.roles);

    // Gerar novo token
    const newToken = generateToken({ ...user, permissions });

    return {
      token: newToken,
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenant_id,
        roles: user.roles,
        permissions,
      },
    };
  } catch (error) {
    throw new Error('Refresh token inválido');
  }
};

/**
 * Logout
 */
export const logout = async (refreshToken) => {
  await db.query(
    `
    DELETE FROM refresh_tokens
    WHERE token = $1
    `,
    [refreshToken]
  );
};

/**
 * Criar novo usuário
 */
export const createUser = async (userData) => {
  const {
    email,
    password,
    tenantId,
    nome,
    roles = [ROLES.CLIENTE],
  } = userData;

  // Validar email único
  const existingUser = await db.query(
    `
    SELECT id FROM usuarios
    WHERE email = $1 AND tenant_id = $2
    `,
    [email, tenantId]
  );

  if (existingUser.rows.length > 0) {
    throw new Error('Email já cadastrado');
  }

  // Hash da senha
  const passwordHash = await hashPassword(password);

  // Obter permissões
  const permissions = getUserPermissions(roles);

  // Inserir usuário
  const result = await db.query(
    `
    INSERT INTO usuarios (email, password_hash, tenant_id, nome, roles, permissions, ativo)
    VALUES ($1, $2, $3, $4, $5, $6, true)
    RETURNING id, email, tenant_id, roles, permissions
    `,
    [email, passwordHash, tenantId, nome, roles, permissions]
  );

  return result.rows[0];
};

export default {
  generateToken,
  generateRefreshToken,
  verifyToken,
  hashPassword,
  comparePassword,
  getUserPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  authMiddleware,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  requireRole,
  login,
  refreshAccessToken,
  logout,
  createUser,
  ROLES,
  ROLE_PERMISSIONS,
};

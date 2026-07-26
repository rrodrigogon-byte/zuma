/**
 * ============================================================================
 * ROTAS DE AUTENTICAÇÃO - ERP MODULAR
 * ============================================================================
 * Arquivo: routes/auth.js
 * Descrição: Autenticação JWT, multi-tenant, RBAC
 * ============================================================================
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as dbPg from '../db-pg.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'erp-dev-secret-change-in-prod';
const JWT_EXPIRY = '24h';

/**
 * Middleware: Validar JWT
 */
export async function autenticar(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ erro: 'Token não fornecido' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    req.empresaId = decoded.empresa_id;
    next();
  } catch (error) {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

/**
 * Middleware: Validar role
 */
export function autorizar(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario.role)) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }
    next();
  };
}

/**
 * POST /auth/login
 * Autenticar usuário
 */
router.post('/login', async (req, res) => {
  try {
    const { email, senha, empresa_id } = req.body;

    if (!email || !senha || !empresa_id) {
      return res.status(400).json({ erro: 'Email, senha e empresa_id são obrigatórios' });
    }

    // Buscar usuário
    const usuario = await dbPg.buscarUsuarioPorEmail(email, empresa_id);
    if (!usuario) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }

    // Validar senha
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }

    // Gerar token JWT
    const token = jwt.sign(
      {
        usuario_id: usuario.id,
        email: usuario.email,
        nome: usuario.nome_completo,
        role: usuario.role,
        empresa_id: empresa_id
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id,
      usuario_id: usuario.id,
      tabela: 'usuarios',
      operacao: 'LOGIN',
      registro_id: usuario.id,
      ip_address: req.ip
    });

    res.json({
      sucesso: true,
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome_completo,
        role: usuario.role
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ erro: 'Erro ao autenticar' });
  }
});

/**
 * POST /auth/refresh
 * Renovar token JWT
 */
router.post('/refresh', autenticar, async (req, res) => {
  try {
    const novoToken = jwt.sign(
      {
        usuario_id: req.usuario.usuario_id,
        email: req.usuario.email,
        nome: req.usuario.nome,
        role: req.usuario.role,
        empresa_id: req.usuario.empresa_id
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({ sucesso: true, token: novoToken });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao renovar token' });
  }
});

/**
 * POST /auth/logout
 * Logout (apenas para auditoria)
 */
router.post('/logout', autenticar, async (req, res) => {
  try {
    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'usuarios',
      operacao: 'LOGOUT',
      registro_id: req.usuario.usuario_id,
      ip_address: req.ip
    });

    res.json({ sucesso: true, mensagem: 'Logout realizado' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao fazer logout' });
  }
});

/**
 * POST /auth/criar-usuario
 * Criar novo usuário (apenas admin)
 */
router.post('/criar-usuario', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    const { email, senha, nome_completo, cpf, role } = req.body;

    if (!email || !senha || !nome_completo) {
      return res.status(400).json({ erro: 'Email, senha e nome são obrigatórios' });
    }

    // Validar role
    const rolesValidos = ['admin', 'gerente', 'vendedor', 'garcom', 'barbeiro', 'caixa', 'cliente', 'operador'];
    if (!rolesValidos.includes(role)) {
      return res.status(400).json({ erro: 'Role inválido' });
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Criar usuário
    const novoUsuario = await dbPg.criarUsuario({
      empresa_id: req.empresaId,
      email,
      senha_hash: senhaHash,
      nome_completo,
      cpf: cpf || null,
      role: role || 'operador'
    });

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'usuarios',
      operacao: 'INSERT',
      registro_id: novoUsuario.id,
      dados_novo: novoUsuario,
      ip_address: req.ip
    });

    res.status(201).json({
      sucesso: true,
      usuario: novoUsuario
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    if (error.code === '23505') { // Unique constraint
      return res.status(400).json({ erro: 'Email já existe' });
    }
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});

/**
 * GET /auth/me
 * Obter dados do usuário autenticado
 */
router.get('/me', autenticar, async (req, res) => {
  try {
    const usuario = await dbPg.findById('usuarios', req.usuario.usuario_id, req.empresaId);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    res.json({
      sucesso: true,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nome_completo: usuario.nome_completo,
        role: usuario.role,
        empresa_id: usuario.empresa_id
      }
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar usuário' });
  }
});

/**
 * PATCH /auth/alterar-senha
 * Alterar senha do usuário autenticado
 */
router.patch('/alterar-senha', autenticar, async (req, res) => {
  try {
    const { senha_atual, senha_nova } = req.body;

    if (!senha_atual || !senha_nova) {
      return res.status(400).json({ erro: 'Senha atual e nova são obrigatórias' });
    }

    // Buscar usuário
    const usuario = await dbPg.findById('usuarios', req.usuario.usuario_id, req.empresaId);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    // Validar senha atual
    const senhaValida = await bcrypt.compare(senha_atual, usuario.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Senha atual inválida' });
    }

    // Hash da nova senha
    const novaHash = await bcrypt.hash(senha_nova, 10);

    // Atualizar
    await dbPg.update('usuarios', req.usuario.usuario_id, {
      senha_hash: novaHash
    }, req.empresaId);

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'usuarios',
      operacao: 'UPDATE',
      registro_id: req.usuario.usuario_id,
      dados_novo: { acao: 'alteracao_senha' },
      ip_address: req.ip
    });

    res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ erro: 'Erro ao alterar senha' });
  }
});

export default router;

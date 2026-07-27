/**
 * ============================================================================
 * ROTAS DE AUTENTICAÇÃO — KYTTO ERP
 * ============================================================================
 * JWT multiempresa com contexto obrigatório de loja e RBAC por função.
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as dbPg from '../db-pg.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'erp-dev-secret-change-in-prod';
const JWT_EXPIRY = '24h';
const ROLES_VALIDOS = ['admin', 'gerente', 'vendedor', 'garcom', 'barbeiro', 'caixa', 'cliente', 'operador'];

function obterLojaSolicitada(req, payload = {}) {
  return (
    req.headers['x-loja-id'] ||
    req.query?.loja_id ||
    payload.loja_id ||
    null
  );
}

async function listarLojasAcessiveis({ empresaId, usuarioId, role }) {
  const params = [empresaId];
  let sql = `
    SELECT l.id, l.empresa_id, l.codigo, l.nome, l.nome_fantasia, l.ativa,
           ul.role_loja, COALESCE(ul.permissoes, '{}'::jsonb) AS permissoes
    FROM lojas l
    LEFT JOIN usuarios_lojas ul
      ON ul.loja_id = l.id
     AND ul.usuario_id = $2
     AND ul.ativo = true
    WHERE l.empresa_id = $1
      AND l.ativa = true
  `;
  params.push(usuarioId);

  if (role !== 'admin') {
    sql += ' AND ul.id IS NOT NULL';
  }

  sql += ' ORDER BY CASE WHEN l.codigo = \'MATRIZ\' THEN 0 ELSE 1 END, l.nome';
  const result = await dbPg.query(sql, params);
  return result.rows;
}

function selecionarLoja(lojas, lojaIdSolicitada) {
  if (lojas.length === 0) return null;

  if (lojaIdSolicitada) {
    return lojas.find((loja) => loja.id === lojaIdSolicitada) || null;
  }

  return lojas.find((loja) => loja.codigo === 'MATRIZ') || lojas[0];
}

function emitirToken(usuario, lojaId) {
  return jwt.sign(
    {
      usuario_id: usuario.id,
      email: usuario.email,
      nome: usuario.nome_completo,
      role: usuario.role,
      empresa_id: usuario.empresa_id,
      loja_id: lojaId,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Middleware: valida JWT e fixa o contexto de loja autorizado.
 * A loja pode ser trocada pelo cabeçalho X-Loja-Id, desde que o usuário tenha
 * vínculo ativo com ela. Administradores continuam limitados à própria empresa.
 */
export async function autenticar(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ erro: 'Token não fornecido', codigo: 'TOKEN_AUSENTE' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const lojas = await listarLojasAcessiveis({
      empresaId: decoded.empresa_id,
      usuarioId: decoded.usuario_id,
      role: decoded.role,
    });
    const lojaIdSolicitada = obterLojaSolicitada(req, decoded);
    const loja = selecionarLoja(lojas, lojaIdSolicitada);

    if (!loja) {
      return res.status(403).json({
        erro: lojaIdSolicitada
          ? 'Usuário não possui acesso à loja solicitada'
          : 'Usuário não possui acesso a nenhuma loja ativa',
        codigo: 'LOJA_ACESSO_NEGADO',
      });
    }

    req.usuario = decoded;
    req.empresaId = decoded.empresa_id;
    req.lojaId = loja.id;
    req.loja = loja;
    req.lojasAcessiveis = lojas;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ erro: 'Token inválido ou expirado', codigo: 'TOKEN_INVALIDO' });
    }
    console.error('Erro ao validar contexto de autenticação:', error);
    return res.status(500).json({ erro: 'Erro ao validar a sessão', codigo: 'SESSAO_ERRO' });
  }
}

/** Middleware: valida uma das roles fornecidas. */
export function autorizar(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.role)) {
      return res.status(403).json({ erro: 'Acesso negado', codigo: 'ROLE_INSUFICIENTE' });
    }
    next();
  };
}

/**
 * POST /auth/login
 * Autentica um usuário e fixa a loja padrão ou a loja explicitamente solicitada.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, senha, empresa_id, loja_id } = req.body;

    if (!email || !senha || !empresa_id) {
      return res.status(400).json({ erro: 'Email, senha e empresa_id são obrigatórios' });
    }

    const usuario = await dbPg.buscarUsuarioPorEmail(email, empresa_id);
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }

    const lojas = await listarLojasAcessiveis({
      empresaId: empresa_id,
      usuarioId: usuario.id,
      role: usuario.role,
    });
    const loja = selecionarLoja(lojas, loja_id);

    if (!loja) {
      return res.status(403).json({
        erro: loja_id
          ? 'Usuário não possui acesso à loja solicitada'
          : 'Usuário não possui vínculo com uma loja ativa',
        codigo: 'LOJA_ACESSO_NEGADO',
      });
    }

    const token = emitirToken(usuario, loja.id);

    await dbPg.registrarAuditoria({
      empresa_id,
      loja_id: loja.id,
      usuario_id: usuario.id,
      tabela: 'usuarios',
      operacao: 'LOGIN',
      registro_id: usuario.id,
      dados_novo: { evento: 'login', loja_id: loja.id },
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.json({
      sucesso: true,
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome_completo,
        role: usuario.role,
        empresa_id,
      },
      loja,
      lojas_acessiveis: lojas,
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ erro: 'Erro ao autenticar' });
  }
});

/** POST /auth/refresh — renova o token preservando o contexto de loja validado. */
router.post('/refresh', autenticar, async (req, res) => {
  try {
    const token = jwt.sign(
      {
        usuario_id: req.usuario.usuario_id,
        email: req.usuario.email,
        nome: req.usuario.nome,
        role: req.usuario.role,
        empresa_id: req.empresaId,
        loja_id: req.lojaId,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    res.json({ sucesso: true, token, loja: req.loja });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao renovar token' });
  }
});

/** POST /auth/logout — encerra a sessão logicamente e registra o evento. */
router.post('/logout', autenticar, async (req, res) => {
  try {
    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      loja_id: req.lojaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'usuarios',
      operacao: 'LOGOUT',
      registro_id: req.usuario.usuario_id,
      dados_novo: { evento: 'logout', loja_id: req.lojaId },
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });
    res.json({ sucesso: true, mensagem: 'Logout realizado' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao fazer logout' });
  }
});

/**
 * POST /auth/criar-usuario
 * Cria o usuário na empresa atual e associa explicitamente as lojas permitidas.
 */
router.post('/criar-usuario', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    const { email, senha, nome_completo, cpf, role = 'operador', lojas_ids } = req.body;

    if (!email || !senha || !nome_completo) {
      return res.status(400).json({ erro: 'Email, senha e nome são obrigatórios' });
    }
    if (!ROLES_VALIDOS.includes(role)) {
      return res.status(400).json({ erro: 'Role inválido' });
    }

    const lojasIds = Array.isArray(lojas_ids) && lojas_ids.length > 0
      ? [...new Set(lojas_ids)]
      : [req.lojaId];

    const lojasValidas = await dbPg.query(
      `SELECT id FROM lojas WHERE empresa_id = $1 AND ativa = true AND id = ANY($2::uuid[])`,
      [req.empresaId, lojasIds]
    );
    if (lojasValidas.rows.length !== lojasIds.length) {
      return res.status(400).json({ erro: 'Uma ou mais lojas são inválidas para esta empresa' });
    }

    // Gerentes só podem atribuir usuários às lojas a que já têm acesso.
    if (req.usuario.role !== 'admin') {
      const acessiveis = new Set(req.lojasAcessiveis.map((loja) => loja.id));
      if (lojasIds.some((id) => !acessiveis.has(id))) {
        return res.status(403).json({ erro: 'Gerente não pode atribuir usuários a loja sem acesso' });
      }
    }

    const novoUsuario = await dbPg.criarUsuario({
      empresa_id: req.empresaId,
      email,
      senha_hash: await bcrypt.hash(senha, 10),
      nome_completo,
      cpf: cpf || null,
      role,
    });

    const valores = [];
    const placeholders = lojasIds.map((lojaId, index) => {
      const offset = index * 3;
      valores.push(novoUsuario.id, lojaId, role);
      return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
    });
    await dbPg.query(
      `INSERT INTO usuarios_lojas (usuario_id, loja_id, role_loja) VALUES ${placeholders.join(', ')}`,
      valores
    );

    res.status(201).json({
      sucesso: true,
      usuario: novoUsuario,
      lojas_ids: lojasIds,
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    if (error.code === '23505') return res.status(400).json({ erro: 'Email ou CPF já existe' });
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});

/** GET /auth/me — retorna sessão, loja ativa e todas as lojas permitidas. */
router.get('/me', autenticar, async (req, res) => {
  try {
    const usuario = await dbPg.findById('usuarios', req.usuario.usuario_id, req.empresaId);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });

    res.json({
      sucesso: true,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nome_completo: usuario.nome_completo,
        role: usuario.role,
        empresa_id: usuario.empresa_id,
      },
      loja_ativa: req.loja,
      lojas_acessiveis: req.lojasAcessiveis,
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar usuário' });
  }
});

/** PATCH /auth/alterar-senha — atualiza a credencial do usuário autenticado. */
router.patch('/alterar-senha', autenticar, async (req, res) => {
  try {
    const { senha_atual, senha_nova } = req.body;
    if (!senha_atual || !senha_nova) {
      return res.status(400).json({ erro: 'Senha atual e nova são obrigatórias' });
    }
    if (senha_nova.length < 8) {
      return res.status(400).json({ erro: 'A nova senha deve ter ao menos 8 caracteres' });
    }

    const usuario = await dbPg.findById('usuarios', req.usuario.usuario_id, req.empresaId);
    if (!usuario || !(await bcrypt.compare(senha_atual, usuario.senha_hash))) {
      return res.status(401).json({ erro: 'Senha atual inválida' });
    }

    await dbPg.update('usuarios', req.usuario.usuario_id, {
      senha_hash: await bcrypt.hash(senha_nova, 10),
    }, req.empresaId);

    res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ erro: 'Erro ao alterar senha' });
  }
});

export default router;

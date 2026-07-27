/**
 * ============================================================================
 * ROTAS DE LOJAS — KYTTO ERP
 * ============================================================================
 * Gestão multiunidade, acesso de operadores e verificação de auditoria.
 */

import express from 'express';
import * as dbPg from '../db-pg.js';
import { autenticar, autorizar } from './auth.js';

const router = express.Router();

const CAMPOS_LOJA = [
  'codigo',
  'nome',
  'nome_fantasia',
  'cnpj',
  'inscricao_estadual',
  'inscricao_municipal',
  'telefone',
  'email',
  'endereco_logradouro',
  'endereco_numero',
  'endereco_complemento',
  'endereco_bairro',
  'endereco_cidade',
  'endereco_estado',
  'endereco_cep',
  'timezone',
  'configuracoes',
  'ativa',
];

function payloadPermitido(body) {
  return Object.fromEntries(
    Object.entries(body || {}).filter(([campo, valor]) => CAMPOS_LOJA.includes(campo) && valor !== undefined)
  );
}

function usuarioPodeAcessarLoja(req, lojaId) {
  return req.usuario.role === 'admin' || req.lojasAcessiveis.some((loja) => loja.id === lojaId);
}

async function buscarLojaDaEmpresa(empresaId, lojaId) {
  const resultado = await dbPg.query(
    `SELECT * FROM lojas WHERE id = $1 AND empresa_id = $2`,
    [lojaId, empresaId]
  );
  return resultado.rows[0] || null;
}

/** GET /lojas — lista lojas visíveis ao usuário autenticado. */
router.get('/', autenticar, async (req, res) => {
  try {
    const { incluir_inativas = 'false' } = req.query;
    const filtros = [req.empresaId];
    let sql = `SELECT l.* FROM lojas l WHERE l.empresa_id = $1`;

    if (incluir_inativas !== 'true') sql += ' AND l.ativa = true';
    if (req.usuario.role !== 'admin') {
      sql += ' AND l.id = ANY($2::uuid[])';
      filtros.push(req.lojasAcessiveis.map((loja) => loja.id));
    }
    sql += ' ORDER BY CASE WHEN l.codigo = \'MATRIZ\' THEN 0 ELSE 1 END, l.nome';

    const resultado = await dbPg.query(sql, filtros);
    res.json({ sucesso: true, lojas: resultado.rows, loja_ativa_id: req.lojaId });
  } catch (error) {
    console.error('Erro ao listar lojas:', error);
    res.status(500).json({ erro: 'Erro ao listar lojas' });
  }
});

/** GET /lojas/:id — detalhe de uma loja e seus operadores ativos. */
router.get('/:id', autenticar, async (req, res) => {
  try {
    if (!usuarioPodeAcessarLoja(req, req.params.id)) {
      return res.status(403).json({ erro: 'Sem acesso à loja solicitada' });
    }

    const loja = await buscarLojaDaEmpresa(req.empresaId, req.params.id);
    if (!loja) return res.status(404).json({ erro: 'Loja não encontrada' });

    const operadores = await dbPg.query(
      `SELECT ul.id, ul.usuario_id, ul.role_loja, ul.permissoes, ul.ativo,
              u.nome_completo, u.email, u.role
       FROM usuarios_lojas ul
       JOIN usuarios u ON u.id = ul.usuario_id
       WHERE ul.loja_id = $1
       ORDER BY u.nome_completo`,
      [loja.id]
    );

    res.json({ sucesso: true, loja, operadores: operadores.rows });
  } catch (error) {
    console.error('Erro ao buscar loja:', error);
    res.status(500).json({ erro: 'Erro ao buscar loja' });
  }
});

/** POST /lojas — cria uma nova unidade na empresa atual. */
router.post('/', autenticar, autorizar('admin'), async (req, res) => {
  try {
    const dados = payloadPermitido(req.body);
    if (!dados.codigo || !dados.nome) {
      return res.status(400).json({ erro: 'Código e nome da loja são obrigatórios' });
    }
    if (!/^[A-Za-z0-9_-]+$/.test(dados.codigo)) {
      return res.status(400).json({ erro: 'Código aceita apenas letras, números, hífen e sublinhado' });
    }

    const colunas = ['empresa_id', ...Object.keys(dados)];
    const valores = [req.empresaId, ...Object.values(dados)];
    const placeholders = valores.map((_, indice) => `$${indice + 1}`).join(', ');
    const resultado = await dbPg.query(
      `INSERT INTO lojas (${colunas.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      valores
    );
    const loja = resultado.rows[0];

    await dbPg.query(
      `INSERT INTO usuarios_lojas (usuario_id, loja_id, role_loja)
       VALUES ($1, $2, $3)
       ON CONFLICT (usuario_id, loja_id) DO UPDATE SET ativo = true, role_loja = EXCLUDED.role_loja`,
      [req.usuario.usuario_id, loja.id, req.usuario.role]
    );

    res.status(201).json({ sucesso: true, loja });
  } catch (error) {
    console.error('Erro ao criar loja:', error);
    if (error.code === '23505') return res.status(409).json({ erro: 'Já existe uma loja com esse código' });
    res.status(500).json({ erro: 'Erro ao criar loja' });
  }
});

/** PATCH /lojas/:id — atualiza os dados de uma unidade. */
router.patch('/:id', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    if (!usuarioPodeAcessarLoja(req, req.params.id)) {
      return res.status(403).json({ erro: 'Sem acesso à loja solicitada' });
    }
    const dados = payloadPermitido(req.body);
    if (Object.keys(dados).length === 0) {
      return res.status(400).json({ erro: 'Nenhum campo válido foi informado' });
    }
    if (dados.codigo && !/^[A-Za-z0-9_-]+$/.test(dados.codigo)) {
      return res.status(400).json({ erro: 'Código aceita apenas letras, números, hífen e sublinhado' });
    }
    // Somente administradores podem desativar uma unidade.
    if (dados.ativa === false && req.usuario.role !== 'admin') {
      return res.status(403).json({ erro: 'Apenas administradores podem desativar lojas' });
    }

    const campos = Object.keys(dados);
    const valores = Object.values(dados);
    const atribuicoes = campos.map((campo, indice) => `${campo} = $${indice + 1}`);
    valores.push(req.params.id, req.empresaId);

    const resultado = await dbPg.query(
      `UPDATE lojas
       SET ${atribuicoes.join(', ')}, data_atualizacao = CURRENT_TIMESTAMP
       WHERE id = $${campos.length + 1} AND empresa_id = $${campos.length + 2}
       RETURNING *`,
      valores
    );
    if (resultado.rows.length === 0) return res.status(404).json({ erro: 'Loja não encontrada' });

    res.json({ sucesso: true, loja: resultado.rows[0] });
  } catch (error) {
    console.error('Erro ao atualizar loja:', error);
    if (error.code === '23505') return res.status(409).json({ erro: 'Já existe uma loja com esse código' });
    res.status(500).json({ erro: 'Erro ao atualizar loja' });
  }
});

/**
 * PUT /lojas/:id/usuarios/:usuarioId
 * Cria ou atualiza o vínculo de um usuário com uma loja. A exclusão é lógica.
 */
router.put('/:id/usuarios/:usuarioId', autenticar, autorizar('admin'), async (req, res) => {
  try {
    const loja = await buscarLojaDaEmpresa(req.empresaId, req.params.id);
    if (!loja) return res.status(404).json({ erro: 'Loja não encontrada' });

    const { role_loja = null, permissoes = {}, ativo = true } = req.body;
    const usuario = await dbPg.query(
      `SELECT id FROM usuarios WHERE id = $1 AND empresa_id = $2`,
      [req.params.usuarioId, req.empresaId]
    );
    if (usuario.rows.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });

    const resultado = await dbPg.query(
      `INSERT INTO usuarios_lojas (usuario_id, loja_id, role_loja, permissoes, ativo)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (usuario_id, loja_id)
       DO UPDATE SET
         role_loja = EXCLUDED.role_loja,
         permissoes = EXCLUDED.permissoes,
         ativo = EXCLUDED.ativo,
         data_atualizacao = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.params.usuarioId, loja.id, role_loja, JSON.stringify(permissoes), ativo]
    );

    res.json({ sucesso: true, vinculo: resultado.rows[0] });
  } catch (error) {
    console.error('Erro ao atribuir usuário à loja:', error);
    res.status(500).json({ erro: 'Erro ao atribuir usuário à loja' });
  }
});

/** GET /lojas/:id/auditoria/verificar — valida a hash chain da empresa. */
router.get('/:id/auditoria/verificar', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    if (!usuarioPodeAcessarLoja(req, req.params.id)) {
      return res.status(403).json({ erro: 'Sem acesso à loja solicitada' });
    }
    const loja = await buscarLojaDaEmpresa(req.empresaId, req.params.id);
    if (!loja) return res.status(404).json({ erro: 'Loja não encontrada' });

    const resultado = await dbPg.query(
      `SELECT * FROM verificar_cadeia_auditoria($1::uuid)`,
      [req.empresaId]
    );
    const verificacao = resultado.rows[0] || { valida: true, motivo: 'Cadeia sem eventos' };

    res.json({
      sucesso: verificacao.valida,
      empresa_id: req.empresaId,
      loja_id: loja.id,
      verificacao,
    });
  } catch (error) {
    console.error('Erro ao verificar auditoria:', error);
    res.status(500).json({ erro: 'Erro ao verificar a auditoria' });
  }
});

export default router;

/**
 * Camada de Segurança ENTERPRISE
 * SetPoint Ultra - PCI-DSS, LGPD, Criptografia
 */

import crypto from 'crypto';
import { db } from './database.js';
import { config } from '../config.js';

// ============================================================================
// CRIPTOGRAFIA
// ============================================================================

/**
 * Criptografar dados sensíveis
 */
export const criptografar = (dados) => {
  try {
    const chave = Buffer.from(config.auth.jwt.secret.substring(0, 32).padEnd(32, '0'));
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-gcm', chave, iv);
    let encrypted = cipher.update(JSON.stringify(dados), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      encrypted,
      authTag: authTag.toString('hex'),
    };
  } catch (error) {
    console.error('Erro ao criptografar:', error);
    throw error;
  }
};

/**
 * Descriptografar dados sensíveis
 */
export const descriptografar = (dados) => {
  try {
    const chave = Buffer.from(config.auth.jwt.secret.substring(0, 32).padEnd(32, '0'));
    const iv = Buffer.from(dados.iv, 'hex');
    const authTag = Buffer.from(dados.authTag, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', chave, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(dados.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Erro ao descriptografar:', error);
    throw error;
  }
};

// ============================================================================
// PCI-DSS
// ============================================================================

/**
 * Tokenizar dados de cartão (PCI-DSS)
 */
export const tokenizarCartao = async (dadosCartao) => {
  try {
    // Validar formato
    if (!validarCartao(dadosCartao.numero)) {
      throw new Error('Número de cartão inválido');
    }

    // Criptografar dados
    const criptografado = criptografar(dadosCartao);

    // Armazenar token
    const token = crypto.randomBytes(32).toString('hex');

    await db.query(
      `
      INSERT INTO tokens_cartao (
        token, dados_criptografados, ultimos_digitos, bandeira,
        data_criacao, data_expiracao
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '1 year')
      `,
      [
        token,
        JSON.stringify(criptografado),
        dadosCartao.numero.slice(-4),
        dadosCartao.bandeira,
      ]
    );

    return token;
  } catch (error) {
    console.error('Erro ao tokenizar cartão:', error);
    throw error;
  }
};

/**
 * Validar número de cartão (Luhn)
 */
const validarCartao = (numero) => {
  const digitos = numero.replace(/\D/g, '');

  if (digitos.length < 13 || digitos.length > 19) {
    return false;
  }

  let soma = 0;
  let dobro = false;

  for (let i = digitos.length - 1; i >= 0; i--) {
    let digito = parseInt(digitos[i], 10);

    if (dobro) {
      digito *= 2;
      if (digito > 9) {
        digito -= 9;
      }
    }

    soma += digito;
    dobro = !dobro;
  }

  return soma % 10 === 0;
};

/**
 * Mascarar dados sensíveis
 */
export const mascarar = (dados, tipo = 'cartao') => {
  if (tipo === 'cartao') {
    return `****-****-****-${dados.slice(-4)}`;
  } else if (tipo === 'cpf') {
    return `***-***-***-${dados.slice(-2)}`;
  } else if (tipo === 'email') {
    const [local, dominio] = dados.split('@');
    return `${local.substring(0, 2)}***@${dominio}`;
  }

  return '***';
};

// ============================================================================
// LGPD
// ============================================================================

/**
 * Registrar consentimento LGPD
 */
export const registrarConsentimento = async (usuarioId, tipo, consentimento) => {
  try {
    await db.query(
      `
      INSERT INTO consentimentos_lgpd (
        usuario_id, tipo_consentimento, consentimento,
        data_consentimento, ip_address, user_agent
      )
      VALUES ($1, $2, $3, NOW(), $4, $5)
      `,
      [usuarioId, tipo, consentimento, '0.0.0.0', 'unknown']
    );
  } catch (error) {
    console.error('Erro ao registrar consentimento:', error);
    throw error;
  }
};

/**
 * Anonimizar dados de usuário (direito ao esquecimento)
 */
export const anonimizarUsuario = async (usuarioId) => {
  try {
    await db.query(
      `
      UPDATE usuarios
      SET nome = 'Usuário Anonimizado',
          email = 'anonimizado-' || id || '@anonimizado.local',
          password_hash = '',
          ativo = false,
          anonimizado = true,
          data_anonimizacao = NOW()
      WHERE id = $1
      `,
      [usuarioId]
    );

    // Deletar dados pessoais
    await db.query(
      `
      DELETE FROM consentimentos_lgpd WHERE usuario_id = $1
      `,
      [usuarioId]
    );
  } catch (error) {
    console.error('Erro ao anonimizar usuário:', error);
    throw error;
  }
};

/**
 * Exportar dados de usuário (portabilidade de dados)
 */
export const exportarDadosUsuario = async (usuarioId) => {
  try {
    const usuarioResult = await db.query(
      `
      SELECT * FROM usuarios WHERE id = $1
      `,
      [usuarioId]
    );

    const comandasResult = await db.query(
      `
      SELECT * FROM comandas WHERE operador_id = $1 LIMIT 1000
      `,
      [usuarioId]
    );

    const pagamentosResult = await db.query(
      `
      SELECT * FROM pagamentos WHERE usuario_id = $1 LIMIT 1000
      `,
      [usuarioId]
    );

    return {
      usuario: usuarioResult.rows[0],
      comandas: comandasResult.rows,
      pagamentos: pagamentosResult.rows,
      data_exportacao: new Date(),
    };
  } catch (error) {
    console.error('Erro ao exportar dados:', error);
    throw error;
  }
};

// ============================================================================
// AUDITORIA
// ============================================================================

/**
 * Registrar ação para auditoria
 */
export const registrarAuditoria = async (usuarioId, acao, tabela, registro_id, dados) => {
  try {
    await db.query(
      `
      INSERT INTO auditoria (
        usuario_id, acao, tabela, registro_id, dados,
        data_acao, ip_address
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), $6)
      `,
      [usuarioId, acao, tabela, registro_id, JSON.stringify(dados), '0.0.0.0']
    );
  } catch (error) {
    console.error('Erro ao registrar auditoria:', error);
  }
};

/**
 * Obter log de auditoria
 */
export const obterLogAuditoria = async (filtros = {}) => {
  try {
    const { usuario_id, tabela, data_inicio, data_fim, limite = 100 } = filtros;

    let query = 'SELECT * FROM auditoria WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (usuario_id) {
      query += ` AND usuario_id = $${paramCount}`;
      values.push(usuario_id);
      paramCount++;
    }

    if (tabela) {
      query += ` AND tabela = $${paramCount}`;
      values.push(tabela);
      paramCount++;
    }

    if (data_inicio) {
      query += ` AND data_acao >= $${paramCount}`;
      values.push(data_inicio);
      paramCount++;
    }

    if (data_fim) {
      query += ` AND data_acao <= $${paramCount}`;
      values.push(data_fim);
      paramCount++;
    }

    query += ` ORDER BY data_acao DESC LIMIT $${paramCount}`;
    values.push(limite);

    const result = await db.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('Erro ao obter log de auditoria:', error);
    throw error;
  }
};

export default {
  criptografar,
  descriptografar,
  tokenizarCartao,
  validarCartao,
  mascarar,
  registrarConsentimento,
  anonimizarUsuario,
  exportarDadosUsuario,
  registrarAuditoria,
  obterLogAuditoria,
};

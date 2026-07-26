/**
 * ============================================================================
 * MÓDULO BAR - CONTROLLER DE PIPAS E BARRIS
 * ============================================================================
 * Arquivo: app/modules/bar/controllers/pipas.js
 * Descrição: Controle de pipas/barris com coleta manual e interface de dispositivo
 * Versão: 1.0 (Kytto ERP)
 * ============================================================================
 */

import * as dbPg from '../../../db-pg.js';

/**
 * ============================================================================
 * CADASTRO DE PIPAS
 * ============================================================================
 */

/**
 * POST /bar/pipas
 * Cadastrar nova pipa/barril
 * 
 * Body:
 *   - numero_pipa: VARCHAR (identificador único, ex: "PIPA-001", "BRAHMA-001")
 *   - produto_id: UUID (referência ao produto bebida)
 *   - capacidade_litros: DECIMAL (capacidade total em litros)
 *   - fornecedor_id: UUID (fornecedor da pipa)
 *   - data_entrada: DATE (data de entrada)
 *   - observacoes: TEXT (opcional)
 * 
 * Response: { pipa, mensagem }
 */
export const cadastrarPipa = async (req, res) => {
  try {
    const {
      numero_pipa,
      produto_id,
      capacidade_litros,
      fornecedor_id,
      data_entrada,
      observacoes
    } = req.body;

    const empresaId = req.tenantId || req.empresaId;
    const usuarioId = req.user?.id || req.usuario?.usuario_id;

    // Validações
    if (!numero_pipa || !produto_id || !capacidade_litros) {
      return res.status(400).json({
        erro: 'Campos obrigatórios: numero_pipa, produto_id, capacidade_litros'
      });
    }

    if (capacidade_litros <= 0) {
      return res.status(400).json({ erro: 'Capacidade deve ser maior que zero' });
    }

    // Verificar produto
    const produto = await dbPg.findById('produtos', produto_id, empresaId);
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    // Verificar número único
    const pipaExistente = await dbPg.query(
      `SELECT id FROM pipas WHERE empresa_id = $1 AND numero_pipa = $2`,
      [empresaId, numero_pipa]
    );

    if (pipaExistente.rows.length > 0) {
      return res.status(400).json({ erro: 'Número de pipa já existe' });
    }

    // Criar pipa
    const result = await dbPg.query(
      `INSERT INTO pipas (
        empresa_id, numero_pipa, produto_id, capacidade_litros,
        fornecedor_id, data_entrada, status, observacoes
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'ativa', $7)
      RETURNING *`,
      [
        empresaId, numero_pipa, produto_id, capacidade_litros,
        fornecedor_id || null, data_entrada || new Date().toISOString().split('T')[0], observacoes || null
      ]
    );

    const pipa = result.rows[0];

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: empresaId,
      usuario_id: usuarioId,
      tabela: 'pipas',
      operacao: 'INSERT',
      registro_id: pipa.id,
      dados_novo: {
        numero_pipa,
        capacidade_litros,
        status: 'ativa'
      },
      ip_address: req.ip
    });

    res.status(201).json({
      sucesso: true,
      pipa,
      mensagem: 'Pipa cadastrada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao cadastrar pipa:', error);
    res.status(500).json({ erro: 'Erro ao cadastrar pipa', detalhes: error.message });
  }
};

/**
 * ============================================================================
 * LEITURA DE NÍVEL DE PIPA
 * ============================================================================
 */

/**
 * POST /bar/pipas/:pipa_id/leitura
 * Registrar leitura de nível (coleta manual ou de dispositivo)
 * 
 * Body:
 *   - nivel_litros: DECIMAL (nível atual em litros)
 *   - metodo_leitura: VARCHAR (manual, balanca, sensor_ultrassonico, medidor_fluxo)
 *   - dispositivo_id: VARCHAR (opcional, ID do dispositivo físico)
 *   - observacoes: TEXT (opcional)
 * 
 * Response: { leitura, consumo_estimado, mensagem }
 */
export const registrarLeitura = async (req, res) => {
  try {
    const { pipa_id } = req.params;
    const {
      nivel_litros,
      metodo_leitura = 'manual',
      dispositivo_id,
      observacoes
    } = req.body;

    const empresaId = req.tenantId || req.empresaId;
    const usuarioId = req.user?.id || req.usuario?.usuario_id;

    // Validações
    if (nivel_litros === undefined || nivel_litros < 0) {
      return res.status(400).json({ erro: 'Nível deve ser um valor não-negativo' });
    }

    // Verificar pipa
    const pipa = await dbPg.findById('pipas', pipa_id, empresaId);
    if (!pipa) {
      return res.status(404).json({ erro: 'Pipa não encontrada' });
    }

    if (pipa.status !== 'ativa') {
      return res.status(400).json({ erro: 'Pipa não está ativa' });
    }

    if (nivel_litros > pipa.capacidade_litros) {
      return res.status(400).json({
        erro: `Nível não pode exceder a capacidade (${pipa.capacidade_litros}L)`
      });
    }

    // Buscar última leitura
    const ultimaLeitura = await dbPg.query(
      `SELECT * FROM leituras_pipa 
       WHERE pipa_id = $1 
       ORDER BY data_leitura DESC 
       LIMIT 1`,
      [pipa_id]
    );

    let consumo_estimado = 0;
    if (ultimaLeitura.rows.length > 0) {
      const ultima = ultimaLeitura.rows[0];
      consumo_estimado = parseFloat(ultima.nivel_litros) - nivel_litros;
    }

    // Registrar leitura
    const result = await dbPg.query(
      `INSERT INTO leituras_pipa (
        pipa_id, nivel_litros, metodo_leitura, dispositivo_id, consumo_estimado, observacoes
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [pipa_id, nivel_litros, metodo_leitura, dispositivo_id || null, consumo_estimado, observacoes || null]
    );

    const leitura = result.rows[0];

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: empresaId,
      usuario_id: usuarioId,
      tabela: 'leituras_pipa',
      operacao: 'INSERT',
      registro_id: leitura.id,
      dados_novo: {
        numero_pipa: pipa.numero_pipa,
        nivel_litros,
        consumo_estimado,
        metodo_leitura
      },
      ip_address: req.ip
    });

    // Verificar alerta de baixo estoque
    const percentual_ocupacao = (nivel_litros / pipa.capacidade_litros) * 100;
    let alerta = null;

    if (percentual_ocupacao < 20) {
      alerta = {
        tipo: 'CRITICO',
        mensagem: `Pipa ${pipa.numero_pipa} com ${percentual_ocupacao.toFixed(1)}% de ocupação`
      };
    } else if (percentual_ocupacao < 50) {
      alerta = {
        tipo: 'AVISO',
        mensagem: `Pipa ${pipa.numero_pipa} com ${percentual_ocupacao.toFixed(1)}% de ocupação`
      };
    }

    res.status(201).json({
      sucesso: true,
      leitura,
      consumo_estimado,
      percentual_ocupacao: (nivel_litros / pipa.capacidade_litros) * 100,
      alerta,
      mensagem: 'Leitura registrada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao registrar leitura:', error);
    res.status(500).json({ erro: 'Erro ao registrar leitura', detalhes: error.message });
  }
};

/**
 * GET /bar/pipas/:pipa_id/leituras
 * Obter histórico de leituras de uma pipa
 * 
 * Query:
 *   - dias: INT (últimos N dias, padrão 30)
 * 
 * Response: [ { leitura com dados de usuário } ]
 */
export const obterHistoricoLeituras = async (req, res) => {
  try {
    const { pipa_id } = req.params;
    const { dias = 30 } = req.query;
    const empresaId = req.tenantId || req.empresaId;

    // Verificar pipa
    const pipa = await dbPg.findById('pipas', pipa_id, empresaId);
    if (!pipa) {
      return res.status(404).json({ erro: 'Pipa não encontrada' });
    }

    const result = await dbPg.query(
      `SELECT 
        lp.*,
        u.nome_completo as usuario_nome
      FROM leituras_pipa lp
      LEFT JOIN usuarios u ON lp.usuario_id = u.id
      WHERE lp.pipa_id = $1 AND lp.data_leitura >= NOW() - INTERVAL '${dias} days'
      ORDER BY lp.data_leitura DESC`,
      [pipa_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao obter histórico de leituras:', error);
    res.status(500).json({ erro: 'Erro ao obter histórico de leituras', detalhes: error.message });
  }
};

/**
 * ============================================================================
 * LISTAR E CONSULTAR PIPAS
 * ============================================================================
 */

/**
 * GET /bar/pipas
 * Listar pipas com status
 * 
 * Query:
 *   - status: VARCHAR (ativa, inativa, descartada)
 *   - produto_id: UUID (opcional)
 * 
 * Response: [ { pipa com dados de produto e última leitura } ]
 */
export const listarPipas = async (req, res) => {
  try {
    const { status = 'ativa', produto_id } = req.query;
    const empresaId = req.tenantId || req.empresaId;

    let sql = `
      SELECT 
        p.*,
        prod.nome as produto_nome,
        f.nome as fornecedor_nome,
        (SELECT nivel_litros FROM leituras_pipa WHERE pipa_id = p.id ORDER BY data_leitura DESC LIMIT 1) as nivel_atual,
        (SELECT data_leitura FROM leituras_pipa WHERE pipa_id = p.id ORDER BY data_leitura DESC LIMIT 1) as ultima_leitura
      FROM pipas p
      LEFT JOIN produtos prod ON p.produto_id = prod.id
      LEFT JOIN fornecedores f ON p.fornecedor_id = f.id
      WHERE p.empresa_id = $1 AND p.status = $2
    `;
    const params = [empresaId, status];

    if (produto_id) {
      sql += ` AND p.produto_id = $3`;
      params.push(produto_id);
    }

    sql += ` ORDER BY p.numero_pipa ASC`;

    const result = await dbPg.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar pipas:', error);
    res.status(500).json({ erro: 'Erro ao listar pipas', detalhes: error.message });
  }
};

/**
 * GET /bar/pipas/:pipa_id
 * Obter detalhes de uma pipa
 * 
 * Response: { pipa com dados completos }
 */
export const obterPipa = async (req, res) => {
  try {
    const { pipa_id } = req.params;
    const empresaId = req.tenantId || req.empresaId;

    const result = await dbPg.query(
      `SELECT 
        p.*,
        prod.nome as produto_nome,
        prod.preco_custo,
        f.nome as fornecedor_nome,
        (SELECT nivel_litros FROM leituras_pipa WHERE pipa_id = p.id ORDER BY data_leitura DESC LIMIT 1) as nivel_atual,
        (SELECT data_leitura FROM leituras_pipa WHERE pipa_id = p.id ORDER BY data_leitura DESC LIMIT 1) as ultima_leitura
      FROM pipas p
      LEFT JOIN produtos prod ON p.produto_id = prod.id
      LEFT JOIN fornecedores f ON p.fornecedor_id = f.id
      WHERE p.id = $1 AND p.empresa_id = $2`,
      [pipa_id, empresaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Pipa não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter pipa:', error);
    res.status(500).json({ erro: 'Erro ao obter pipa', detalhes: error.message });
  }
};

/**
 * ============================================================================
 * ATUALIZAR STATUS DE PIPA
 * ============================================================================
 */

/**
 * PUT /bar/pipas/:pipa_id/status
 * Atualizar status de pipa (ativa, inativa, descartada)
 * 
 * Body:
 *   - status: VARCHAR (ativa, inativa, descartada)
 *   - motivo: TEXT (opcional)
 * 
 * Response: { pipa, mensagem }
 */
export const atualizarStatusPipa = async (req, res) => {
  try {
    const { pipa_id } = req.params;
    const { status, motivo } = req.body;
    const empresaId = req.tenantId || req.empresaId;
    const usuarioId = req.user?.id || req.usuario?.usuario_id;

    // Validar status
    const statusValidos = ['ativa', 'inativa', 'descartada'];
    if (!statusValidos.includes(status)) {
      return res.status(400).json({
        erro: `Status deve ser um de: ${statusValidos.join(', ')}`
      });
    }

    // Verificar pipa
    const pipa = await dbPg.findById('pipas', pipa_id, empresaId);
    if (!pipa) {
      return res.status(404).json({ erro: 'Pipa não encontrada' });
    }

    // Atualizar status
    const result = await dbPg.query(
      `UPDATE pipas 
       SET status = $1, observacoes = COALESCE($2, observacoes), data_atualizacao = NOW()
       WHERE id = $3 AND empresa_id = $4
       RETURNING *`,
      [status, motivo || null, pipa_id, empresaId]
    );

    const pipaAtualizada = result.rows[0];

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: empresaId,
      usuario_id: usuarioId,
      tabela: 'pipas',
      operacao: 'UPDATE',
      registro_id: pipa_id,
      dados_novo: { status, motivo },
      ip_address: req.ip
    });

    res.json({
      sucesso: true,
      pipa: pipaAtualizada,
      mensagem: `Status da pipa atualizado para ${status}`
    });
  } catch (error) {
    console.error('Erro ao atualizar status da pipa:', error);
    res.status(500).json({ erro: 'Erro ao atualizar status da pipa', detalhes: error.message });
  }
};

/**
 * ============================================================================
 * INTEGRAÇÃO COM DISPOSITIVOS FÍSICOS
 * ============================================================================
 */

/**
 * POST /bar/pipas/dispositivo/registrar-leitura
 * Endpoint para integração com dispositivos físicos (balança, sensor ultrassônico, etc)
 * 
 * Body:
 *   - numero_pipa: VARCHAR (identificador da pipa)
 *   - nivel_litros: DECIMAL (leitura do dispositivo)
 *   - dispositivo_id: VARCHAR (ID único do dispositivo)
 *   - timestamp: TIMESTAMP (timestamp do dispositivo, opcional)
 *   - dados_brutos: JSONB (dados brutos do dispositivo, opcional)
 * 
 * Response: { leitura, alerta }
 * 
 * Nota: Este endpoint é extensível para integração com:
 *   - Balança de pipa (peso -> litros)
 *   - Sensor ultrassônico (altura -> litros)
 *   - Medidor de fluxo (volume consumido)
 *   - Torneira inteligente (consumo em tempo real)
 */
export const registrarLeituraDispositivo = async (req, res) => {
  try {
    const { numero_pipa, nivel_litros, dispositivo_id, timestamp, dados_brutos } = req.body;
    const empresaId = req.tenantId || req.empresaId;

    // Validações
    if (!numero_pipa || nivel_litros === undefined) {
      return res.status(400).json({
        erro: 'Campos obrigatórios: numero_pipa, nivel_litros'
      });
    }

    // Buscar pipa por número
    const pipaResult = await dbPg.query(
      `SELECT * FROM pipas WHERE empresa_id = $1 AND numero_pipa = $2`,
      [empresaId, numero_pipa]
    );

    if (pipaResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Pipa não encontrada' });
    }

    const pipa = pipaResult.rows[0];

    // Validar nível
    if (nivel_litros < 0 || nivel_litros > pipa.capacidade_litros) {
      return res.status(400).json({
        erro: `Nível deve estar entre 0 e ${pipa.capacidade_litros}L`
      });
    }

    // Registrar leitura
    const result = await dbPg.query(
      `INSERT INTO leituras_pipa (
        pipa_id, nivel_litros, metodo_leitura, dispositivo_id, dados_brutos, data_leitura
      )
      VALUES ($1, $2, 'dispositivo', $3, $4, $5)
      RETURNING *`,
      [
        pipa.id,
        nivel_litros,
        dispositivo_id || null,
        dados_brutos ? JSON.stringify(dados_brutos) : null,
        timestamp || new Date().toISOString()
      ]
    );

    const leitura = result.rows[0];

    // Verificar alertas
    const percentual_ocupacao = (nivel_litros / pipa.capacidade_litros) * 100;
    let alerta = null;

    if (percentual_ocupacao < 20) {
      alerta = {
        tipo: 'CRITICO',
        mensagem: `Pipa ${numero_pipa} com ${percentual_ocupacao.toFixed(1)}% de ocupação`,
        percentual: percentual_ocupacao
      };
    } else if (percentual_ocupacao < 50) {
      alerta = {
        tipo: 'AVISO',
        mensagem: `Pipa ${numero_pipa} com ${percentual_ocupacao.toFixed(1)}% de ocupação`,
        percentual: percentual_ocupacao
      };
    }

    res.status(201).json({
      sucesso: true,
      leitura,
      alerta,
      mensagem: 'Leitura do dispositivo registrada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao registrar leitura do dispositivo:', error);
    res.status(500).json({ erro: 'Erro ao registrar leitura do dispositivo', detalhes: error.message });
  }
};

export default {
  cadastrarPipa,
  registrarLeitura,
  obterHistoricoLeituras,
  listarPipas,
  obterPipa,
  atualizarStatusPipa,
  registrarLeituraDispositivo
};

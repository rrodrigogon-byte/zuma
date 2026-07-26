/**
 * ============================================================================
 * CONTROLLERS DE PDV - ERP MODULAR
 * ============================================================================
 * Arquivo: modules/pdv/controllers/pdv.js
 * Descrição: Abertura, venda, fechamento de caixa com integração TEF
 * ============================================================================
 */

import * as dbPg from '../../../db-pg.js';
import { gerarQrPix } from '../../../adapters/payment/pix.js';
import { processarTef } from '../../../adapters/payment/tef.js';

/**
 * Abrir caixa
 */
export async function abrirCaixa(req, res) {
  try {
    const { valor_inicial = 0, observacoes } = req.body;

    // Verificar se já existe caixa aberto
    const caixaAberto = await dbPg.query(
      `SELECT * FROM caixas WHERE empresa_id = $1 AND status = 'aberto' AND DATE(data_abertura) = CURRENT_DATE`,
      [req.empresaId]
    );

    if (caixaAberto.rows.length > 0) {
      return res.status(400).json({ erro: 'Já existe um caixa aberto hoje' });
    }

    // Criar caixa
    const caixaResult = await dbPg.query(
      `INSERT INTO caixas 
       (empresa_id, usuario_id, valor_inicial, status, observacoes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.empresaId, req.usuario.usuario_id, valor_inicial, 'aberto', observacoes || null]
    );

    const caixa = caixaResult.rows[0];

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'caixas',
      operacao: 'INSERT',
      registro_id: caixa.id,
      dados_novo: { valor_inicial, status: 'aberto' },
      ip_address: req.ip
    });

    res.status(201).json({
      sucesso: true,
      caixa,
      mensagem: 'Caixa aberto com sucesso'
    });
  } catch (error) {
    console.error('Erro ao abrir caixa:', error);
    res.status(500).json({ erro: 'Erro ao abrir caixa' });
  }
}

/**
 * Criar venda no PDV
 */
export async function criarVenda(req, res) {
  try {
    const { caixa_id, tipo_venda = 'presencial', observacoes } = req.body;

    if (!caixa_id) {
      return res.status(400).json({ erro: 'Caixa é obrigatório' });
    }

    // Validar caixa
    const caixa = await dbPg.findById('caixas', caixa_id, req.empresaId);
    if (!caixa) {
      return res.status(404).json({ erro: 'Caixa não encontrado' });
    }

    if (caixa.status !== 'aberto') {
      return res.status(400).json({ erro: 'Caixa deve estar aberto' });
    }

    // Criar venda
    const vendaResult = await dbPg.query(
      `INSERT INTO vendas 
       (empresa_id, caixa_id, tipo_venda, status, observacoes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.empresaId, caixa_id, tipo_venda, 'aberta', observacoes || null]
    );

    const venda = vendaResult.rows[0];

    res.status(201).json({
      sucesso: true,
      venda,
      mensagem: 'Venda criada'
    });
  } catch (error) {
    console.error('Erro ao criar venda:', error);
    res.status(500).json({ erro: 'Erro ao criar venda' });
  }
}

/**
 * Adicionar item à venda
 */
export async function adicionarItem(req, res) {
  try {
    const { venda_id } = req.params;
    const { produto_id, quantidade, valor_unitario, desconto = 0 } = req.body;

    if (!produto_id || !quantidade || !valor_unitario) {
      return res.status(400).json({ erro: 'Produto, quantidade e valor são obrigatórios' });
    }

    // Validar venda
    const venda = await dbPg.findById('vendas', venda_id, req.empresaId);
    if (!venda) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }

    if (venda.status !== 'aberta') {
      return res.status(400).json({ erro: 'Venda deve estar aberta' });
    }

    // Validar estoque
    const estoqueResult = await dbPg.query(
      `SELECT saldo FROM estoque WHERE empresa_id = $1 AND produto_id = $2`,
      [req.empresaId, produto_id]
    );

    if (estoqueResult.rows.length === 0 || estoqueResult.rows[0].saldo < quantidade) {
      return res.status(400).json({ erro: 'Estoque insuficiente' });
    }

    // Calcular valores
    const valor_total = quantidade * valor_unitario;
    const valor_liquido = valor_total - desconto;

    // Adicionar item
    const itemResult = await dbPg.query(
      `INSERT INTO itens_venda 
       (empresa_id, venda_id, produto_id, quantidade, valor_unitario, desconto, valor_total, valor_liquido)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.empresaId, venda_id, produto_id, quantidade, valor_unitario, desconto, valor_total, valor_liquido]
    );

    // Atualizar total da venda
    const totalResult = await dbPg.query(
      `SELECT SUM(valor_liquido) as total FROM itens_venda WHERE empresa_id = $1 AND venda_id = $2`,
      [req.empresaId, venda_id]
    );

    const novoTotal = totalResult.rows[0].total || 0;

    await dbPg.query(
      `UPDATE vendas SET valor_liquido = $1 WHERE id = $2`,
      [novoTotal, venda_id]
    );

    res.status(201).json({
      sucesso: true,
      item: itemResult.rows[0],
      total_venda: novoTotal,
      mensagem: 'Item adicionado'
    });
  } catch (error) {
    console.error('Erro ao adicionar item:', error);
    res.status(500).json({ erro: 'Erro ao adicionar item' });
  }
}

/**
 * Fechar venda (preparar para pagamento)
 */
export async function fecharVenda(req, res) {
  try {
    const { venda_id } = req.params;
    const { desconto_adicional = 0, acrescimo = 0 } = req.body;

    // Validar venda
    const venda = await dbPg.findById('vendas', venda_id, req.empresaId);
    if (!venda) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }

    if (venda.status !== 'aberta') {
      return res.status(400).json({ erro: 'Venda já foi fechada' });
    }

    // Calcular total final
    const valor_final = venda.valor_liquido - desconto_adicional + acrescimo;

    if (valor_final <= 0) {
      return res.status(400).json({ erro: 'Valor final deve ser maior que zero' });
    }

    // Atualizar venda
    const vendaAtualizada = await dbPg.update('vendas', venda_id, {
      desconto_adicional,
      acrescimo,
      valor_final,
      status: 'fechada'
    }, req.empresaId);

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'vendas',
      operacao: 'UPDATE',
      registro_id: venda_id,
      dados_novo: { status: 'fechada', valor_final },
      ip_address: req.ip
    });

    res.json({
      sucesso: true,
      venda: vendaAtualizada,
      mensagem: 'Venda fechada, pronta para pagamento'
    });
  } catch (error) {
    console.error('Erro ao fechar venda:', error);
    res.status(500).json({ erro: 'Erro ao fechar venda' });
  }
}

/**
 * Cancelar venda
 */
export async function cancelarVenda(req, res) {
  try {
    const { venda_id } = req.params;
    const { motivo } = req.body;

    // Validar venda
    const venda = await dbPg.findById('vendas', venda_id, req.empresaId);
    if (!venda) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }

    if (venda.status === 'cancelada' || venda.status === 'paga') {
      return res.status(400).json({ erro: 'Venda não pode ser cancelada' });
    }

    // Cancelar venda
    const vendaCancelada = await dbPg.update('vendas', venda_id, {
      status: 'cancelada',
      motivo_cancelamento: motivo || null
    }, req.empresaId);

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'vendas',
      operacao: 'UPDATE',
      registro_id: venda_id,
      dados_novo: { status: 'cancelada', motivo },
      ip_address: req.ip
    });

    res.json({
      sucesso: true,
      venda: vendaCancelada,
      mensagem: 'Venda cancelada'
    });
  } catch (error) {
    console.error('Erro ao cancelar venda:', error);
    res.status(500).json({ erro: 'Erro ao cancelar venda' });
  }
}

/**
 * Listar vendas do caixa
 */
export async function listarVendas(req, res) {
  try {
    const { caixa_id, status } = req.query;

    let sql = `SELECT * FROM vendas WHERE empresa_id = $1`;
    const params = [req.empresaId];
    let paramIndex = 2;

    if (caixa_id) {
      sql += ` AND caixa_id = $${paramIndex}`;
      params.push(caixa_id);
      paramIndex++;
    }

    if (status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += ` ORDER BY data_criacao DESC`;

    const result = await dbPg.query(sql, params);

    res.json({
      sucesso: true,
      vendas: result.rows
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao listar vendas' });
  }
}

/**
 * Obter detalhes da venda
 */
export async function obterVenda(req, res) {
  try {
    const { venda_id } = req.params;

    const venda = await dbPg.findById('vendas', venda_id, req.empresaId);
    if (!venda) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }

    // Buscar itens
    const itensResult = await dbPg.query(
      `SELECT iv.*, p.nome FROM itens_venda iv
       JOIN produtos p ON iv.produto_id = p.id
       WHERE iv.empresa_id = $1 AND iv.venda_id = $2`,
      [req.empresaId, venda_id]
    );

    res.json({
      sucesso: true,
      venda: {
        ...venda,
        itens: itensResult.rows
      }
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter venda' });
  }
}

export default {
  abrirCaixa,
  criarVenda,
  adicionarItem,
  fecharVenda,
  cancelarVenda,
  listarVendas,
  obterVenda
};

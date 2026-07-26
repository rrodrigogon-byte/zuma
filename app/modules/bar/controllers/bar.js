/**
 * ============================================================================
 * MÓDULO BAR - COMANDA, KDS E DIVISÃO DE CONTA
 * ============================================================================
 * Arquivo: modules/bar/controllers/bar.js
 * Descrição: Gerenciar comandas, itens, KDS e divisão de conta
 * ============================================================================
 */

import * as dbPg from '../../../db-pg.js';

/**
 * Abrir comanda
 */
export async function abrirComanda(req, res) {
  try {
    const { empresa_id, mesa_numero, garcom_id, observacoes } = req.body;

    const result = await dbPg.query(
      `INSERT INTO comandas (empresa_id, mesa_numero, garcom_id, status, observacoes, data_abertura)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [empresa_id, mesa_numero, garcom_id, 'aberta', observacoes]
    );

    res.json({
      sucesso: true,
      comanda: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Adicionar item à comanda
 */
export async function adicionarItemComanda(req, res) {
  try {
    const { comanda_id, produto_id, quantidade, observacoes } = req.body;

    // Obter preço do produto
    const produtoResult = await dbPg.query(
      `SELECT preco FROM produtos WHERE id = $1`,
      [produto_id]
    );

    if (produtoResult.rows.length === 0) {
      return res.status(404).json({ sucesso: false, erro: 'Produto não encontrado' });
    }

    const preco = produtoResult.rows[0].preco;
    const valor_total = preco * quantidade;

    const result = await dbPg.query(
      `INSERT INTO itens_comanda (comanda_id, produto_id, quantidade, preco_unitario, valor_total, status, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [comanda_id, produto_id, quantidade, preco, valor_total, 'pendente', observacoes]
    );

    // Atualizar total da comanda
    await atualizarTotalComanda(comanda_id);

    res.json({
      sucesso: true,
      item: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Remover item da comanda
 */
export async function removerItemComanda(req, res) {
  try {
    const { item_id, comanda_id } = req.body;

    await dbPg.query(
      `DELETE FROM itens_comanda WHERE id = $1`,
      [item_id]
    );

    // Atualizar total da comanda
    await atualizarTotalComanda(comanda_id);

    res.json({ sucesso: true });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Enviar para KDS (Kitchen Display System)
 */
export async function enviarParaKds(req, res) {
  try {
    const { comanda_id } = req.body;

    // Atualizar status dos itens para 'enviado_kds'
    await dbPg.query(
      `UPDATE itens_comanda SET status = 'enviado_kds', data_envio_kds = NOW()
       WHERE comanda_id = $1 AND status = 'pendente'`,
      [comanda_id]
    );

    res.json({ sucesso: true });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Marcar item como pronto (KDS)
 */
export async function marcarComoPronto(req, res) {
  try {
    const { item_id } = req.body;

    const result = await dbPg.query(
      `UPDATE itens_comanda SET status = 'pronto', data_pronto = NOW()
       WHERE id = $1
       RETURNING *`,
      [item_id]
    );

    res.json({
      sucesso: true,
      item: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Servir item
 */
export async function servirItem(req, res) {
  try {
    const { item_id } = req.body;

    const result = await dbPg.query(
      `UPDATE itens_comanda SET status = 'servido', data_servido = NOW()
       WHERE id = $1
       RETURNING *`,
      [item_id]
    );

    res.json({
      sucesso: true,
      item: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Dividir comanda
 */
export async function dividirComanda(req, res) {
  try {
    const { comanda_id, divisoes } = req.body;

    // divisoes = [{ garcom_id, itens_ids, desconto }, ...]

    const resultados = [];

    for (const divisao of divisoes) {
      const result = await dbPg.query(
        `INSERT INTO divisoes_comanda (comanda_id, garcom_id, desconto, data_criacao)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [comanda_id, divisao.garcom_id, divisao.desconto || 0]
      );

      const divisao_id = result.rows[0].id;

      // Associar itens à divisão
      for (const item_id of divisao.itens_ids) {
        await dbPg.query(
          `UPDATE itens_comanda SET divisao_id = $1 WHERE id = $2`,
          [divisao_id, item_id]
        );
      }

      resultados.push(result.rows[0]);
    }

    res.json({
      sucesso: true,
      divisoes: resultados
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Fechar comanda
 */
export async function fecharComanda(req, res) {
  try {
    const { comanda_id, pagamentos } = req.body;

    // Atualizar status da comanda
    const result = await dbPg.query(
      `UPDATE comandas SET status = 'fechada', data_fechamento = NOW()
       WHERE id = $1
       RETURNING *`,
      [comanda_id]
    );

    // Registrar pagamentos
    for (const pagamento of pagamentos) {
      await dbPg.query(
        `INSERT INTO pagamentos (comanda_id, forma, valor, status)
         VALUES ($1, $2, $3, $4)`,
        [comanda_id, pagamento.forma, pagamento.valor, 'confirmado']
      );
    }

    res.json({
      sucesso: true,
      comanda: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Obter comanda com itens
 */
export async function obterComanda(req, res) {
  try {
    const { comanda_id } = req.params;

    const comandaResult = await dbPg.query(
      `SELECT * FROM comandas WHERE id = $1`,
      [comanda_id]
    );

    if (comandaResult.rows.length === 0) {
      return res.status(404).json({ sucesso: false, erro: 'Comanda não encontrada' });
    }

    const itensResult = await dbPg.query(
      `SELECT ic.*, p.nome, p.descricao FROM itens_comanda ic
       JOIN produtos p ON ic.produto_id = p.id
       WHERE ic.comanda_id = $1
       ORDER BY ic.data_criacao`,
      [comanda_id]
    );

    const divisoesResult = await dbPg.query(
      `SELECT * FROM divisoes_comanda WHERE comanda_id = $1`,
      [comanda_id]
    );

    res.json({
      sucesso: true,
      comanda: comandaResult.rows[0],
      itens: itensResult.rows,
      divisoes: divisoesResult.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Listar comandas abertas
 */
export async function listarComandasAbertas(req, res) {
  try {
    const { empresa_id } = req.params;

    const result = await dbPg.query(
      `SELECT c.*, COUNT(ic.id) as total_itens, SUM(ic.valor_total) as valor_total
       FROM comandas c
       LEFT JOIN itens_comanda ic ON c.id = ic.comanda_id
       WHERE c.empresa_id = $1 AND c.status = 'aberta'
       GROUP BY c.id
       ORDER BY c.data_abertura DESC`,
      [empresa_id]
    );

    res.json({
      sucesso: true,
      comandas: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Obter KDS (itens prontos para servir)
 */
export async function obterKds(req, res) {
  try {
    const { empresa_id } = req.params;

    const result = await dbPg.query(
      `SELECT ic.*, c.mesa_numero, p.nome as produto_nome
       FROM itens_comanda ic
       JOIN comandas c ON ic.comanda_id = c.id
       JOIN produtos p ON ic.produto_id = p.id
       WHERE c.empresa_id = $1 AND ic.status IN ('enviado_kds', 'pronto')
       ORDER BY ic.data_envio_kds ASC`,
      [empresa_id]
    );

    res.json({
      sucesso: true,
      itens: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Atualizar total da comanda
 */
async function atualizarTotalComanda(comanda_id) {
  const result = await dbPg.query(
    `SELECT SUM(valor_total) as total FROM itens_comanda WHERE comanda_id = $1`,
    [comanda_id]
  );

  const total = result.rows[0].total || 0;

  await dbPg.query(
    `UPDATE comandas SET valor_total = $1 WHERE id = $2`,
    [total, comanda_id]
  );
}

export default {
  abrirComanda,
  adicionarItemComanda,
  removerItemComanda,
  enviarParaKds,
  marcarComoPronto,
  servirItem,
  dividirComanda,
  fecharComanda,
  obterComanda,
  listarComandasAbertas,
  obterKds
};

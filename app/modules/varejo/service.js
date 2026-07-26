/**
 * Service: Varejo Geral
 * SetPoint Ultra — Orçamentos, Pedidos, Entregas, Multi-Estoque, Tabelas de Preço
 */
import { db } from '../../core/database.js';

// ============================================================================
// ORÇAMENTOS E PEDIDOS DE VENDA
// ============================================================================

/**
 * Criar orçamento com número sequencial automático
 */
export async function criarOrcamento(tenantId, dados) {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    // Número sequencial
    const seqResult = await client.query(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(numero, '[^0-9]', '', 'g') AS INTEGER)), 0) + 1 AS proximo
       FROM varejo_orcamentos WHERE tenant_id = $1`,
      [tenantId]
    );
    const numero = `ORC${new Date().getFullYear()}${String(seqResult.rows[0].proximo).padStart(6, '0')}`;

    // Calcular totais dos itens
    let subtotal = 0;
    const itensProcessados = (dados.itens || []).map(item => {
      const desconto = item.desconto_percentual || 0;
      const valorTotal = item.quantidade * item.valor_unitario * (1 - desconto / 100);
      subtotal += valorTotal;
      return { ...item, valor_total: Number(valorTotal.toFixed(2)) };
    });

    const descontoValor = dados.desconto_valor || (subtotal * (dados.desconto_percentual || 0) / 100);
    const valorTotal = subtotal - descontoValor + (dados.valor_frete || 0);

    const orcResult = await client.query(
      `INSERT INTO varejo_orcamentos
        (tenant_id, numero, cliente_id, cliente_nome, vendedor_id, validade_dias,
         valor_subtotal, desconto_percentual, desconto_valor, valor_frete, valor_total, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [tenantId, numero, dados.cliente_id, dados.cliente_nome, dados.vendedor_id,
       dados.validade_dias || 7, subtotal, dados.desconto_percentual || 0,
       descontoValor, dados.valor_frete || 0, valorTotal, dados.observacoes]
    );
    const orc = orcResult.rows[0];

    for (const item of itensProcessados) {
      await client.query(
        `INSERT INTO varejo_orcamento_itens
          (orcamento_id, produto_id, descricao, quantidade, unidade, valor_unitario, desconto_percentual, valor_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [orc.id, item.produto_id, item.descricao, item.quantidade,
         item.unidade || 'UN', item.valor_unitario, item.desconto_percentual || 0, item.valor_total]
      );
    }

    await client.query('COMMIT');
    return { orcamento: orc, itens: itensProcessados };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Converter orçamento em pedido de venda
 */
export async function converterOrcamentoPedido(orcamentoId, tenantId) {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    const orcResult = await client.query(
      'SELECT * FROM varejo_orcamentos WHERE id = $1 AND tenant_id = $2 AND status = $3',
      [orcamentoId, tenantId, 'aberto']
    );
    const orc = orcResult.rows[0];
    if (!orc) throw new Error('Orçamento não encontrado ou já convertido');

    // Verificar validade
    if (new Date(orc.data_validade) < new Date()) {
      await client.query("UPDATE varejo_orcamentos SET status = 'expirado' WHERE id = $1", [orcamentoId]);
      throw new Error('Orçamento expirado. Emita um novo orçamento.');
    }

    // Gerar número do pedido
    const seqResult = await client.query(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(numero, '[^0-9]', '', 'g') AS INTEGER)), 0) + 1 AS proximo
       FROM pedidos_venda WHERE tenant_id = $1`,
      [tenantId]
    );
    const numeroPedido = `PED${new Date().getFullYear()}${String(seqResult.rows[0].proximo).padStart(6, '0')}`;

    // Criar pedido de venda
    const pedidoResult = await client.query(
      `INSERT INTO pedidos_venda
        (tenant_id, numero, cliente_id, cliente_nome, vendedor_id,
         valor_subtotal, desconto_valor, valor_frete, valor_total,
         orcamento_id, status, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'confirmado',$11)
       RETURNING *`,
      [tenantId, numeroPedido, orc.cliente_id, orc.cliente_nome, orc.vendedor_id,
       orc.valor_subtotal, orc.desconto_valor, orc.valor_frete, orc.valor_total,
       orcamentoId, orc.observacoes]
    );
    const pedido = pedidoResult.rows[0];

    // Copiar itens do orçamento para o pedido
    await client.query(
      `INSERT INTO pedidos_venda_itens (pedido_id, produto_id, descricao, quantidade, unidade, valor_unitario, valor_total)
       SELECT $1, produto_id, descricao, quantidade, unidade, valor_unitario, valor_total
       FROM varejo_orcamento_itens WHERE orcamento_id = $2`,
      [pedido.id, orcamentoId]
    );

    // Atualizar status do orçamento
    await client.query(
      "UPDATE varejo_orcamentos SET status = 'convertido', pedido_id = $1 WHERE id = $2",
      [pedido.id, orcamentoId]
    );

    await client.query('COMMIT');
    return pedido;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listarOrcamentos(tenantId, filtros = {}) {
  const params = [tenantId];
  let where = 'WHERE o.tenant_id = $1';
  if (filtros.status) { params.push(filtros.status); where += ` AND o.status = $${params.length}`; }
  if (filtros.cliente_id) { params.push(filtros.cliente_id); where += ` AND o.cliente_id = $${params.length}`; }

  const result = await db.query(
    `SELECT o.*,
            COUNT(oi.id) AS total_itens
     FROM varejo_orcamentos o
     LEFT JOIN varejo_orcamento_itens oi ON oi.orcamento_id = o.id
     ${where}
     GROUP BY o.id
     ORDER BY o.created_at DESC
     LIMIT 100`,
    params
  );
  return result.rows;
}

// ============================================================================
// GESTÃO DE ESTOQUES MÚLTIPLOS
// ============================================================================

export async function listarEstoques(tenantId) {
  const result = await db.query(
    'SELECT * FROM varejo_estoques WHERE tenant_id = $1 AND ativo = TRUE ORDER BY nome',
    [tenantId]
  );
  return result.rows;
}

export async function criarEstoque(tenantId, dados) {
  const result = await db.query(
    `INSERT INTO varejo_estoques (tenant_id, nome, tipo, endereco, responsavel)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [tenantId, dados.nome, dados.tipo || 'loja', dados.endereco, dados.responsavel]
  );
  return result.rows[0];
}

/**
 * Transferir mercadoria entre estoques com rastreabilidade
 */
export async function transferirEstoque(tenantId, dados) {
  const { estoque_origem_id, estoque_destino_id, produto_id, quantidade, observacao } = dados;
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    // Verificar saldo no estoque de origem
    const saldoResult = await client.query(
      `SELECT quantidade FROM produto_estoques
       WHERE tenant_id = $1 AND estoque_id = $2 AND produto_id = $3`,
      [tenantId, estoque_origem_id, produto_id]
    );
    const saldo = saldoResult.rows[0]?.quantidade || 0;
    if (saldo < quantidade) throw new Error(`Saldo insuficiente. Disponível: ${saldo}`);

    // Baixa no origem
    await client.query(
      `UPDATE produto_estoques SET quantidade = quantidade - $1
       WHERE tenant_id = $2 AND estoque_id = $3 AND produto_id = $4`,
      [quantidade, tenantId, estoque_origem_id, produto_id]
    );

    // Entrada no destino (upsert)
    await client.query(
      `INSERT INTO produto_estoques (tenant_id, estoque_id, produto_id, quantidade)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (tenant_id, estoque_id, produto_id)
       DO UPDATE SET quantidade = produto_estoques.quantidade + EXCLUDED.quantidade`,
      [tenantId, estoque_destino_id, produto_id, quantidade]
    );

    // Registrar movimentação
    await client.query(
      `INSERT INTO estoque_movimentacoes
        (tenant_id, tipo, produto_id, estoque_origem_id, estoque_destino_id, quantidade, observacao)
       VALUES ($1,'transferencia',$2,$3,$4,$5,$6)`,
      [tenantId, produto_id, estoque_origem_id, estoque_destino_id, quantidade, observacao]
    );

    await client.query('COMMIT');
    return { sucesso: true, quantidade_transferida: quantidade };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================================
// TABELAS DE PREÇO
// ============================================================================

export async function listarTabelasPreco(tenantId) {
  const result = await db.query(
    'SELECT * FROM varejo_tabelas_preco WHERE tenant_id = $1 AND ativo = TRUE ORDER BY nome',
    [tenantId]
  );
  return result.rows;
}

export async function criarTabelaPreco(tenantId, dados) {
  const result = await db.query(
    `INSERT INTO varejo_tabelas_preco (tenant_id, nome, tipo, desconto_percentual)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [tenantId, dados.nome, dados.tipo || 'varejo', dados.desconto_percentual || 0]
  );
  return result.rows[0];
}

/**
 * Aplicar tabela de preço a um cliente (retorna preços ajustados)
 */
export async function aplicarTabelaPreco(tenantId, clienteId, produtos) {
  // Buscar tabela de preço do cliente
  const clienteResult = await db.query(
    'SELECT tabela_preco_id FROM clientes WHERE id = $1 AND tenant_id = $2',
    [clienteId, tenantId]
  );
  const tabelaId = clienteResult.rows[0]?.tabela_preco_id;

  if (!tabelaId) return produtos; // Sem tabela especial, retorna preço padrão

  const tabelaResult = await db.query(
    'SELECT * FROM varejo_tabelas_preco WHERE id = $1',
    [tabelaId]
  );
  const tabela = tabelaResult.rows[0];
  if (!tabela) return produtos;

  return produtos.map(p => ({
    ...p,
    preco_aplicado: Number((p.preco_venda * (1 - tabela.desconto_percentual / 100)).toFixed(2)),
    tabela_aplicada: tabela.nome
  }));
}

// ============================================================================
// GESTÃO DE ENTREGAS
// ============================================================================

export async function criarEntrega(tenantId, dados) {
  const result = await db.query(
    `INSERT INTO varejo_entregas
      (tenant_id, pedido_id, cliente_id, endereco_entrega, motorista_id,
       data_entrega_prevista, valor_frete, observacoes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [tenantId, dados.pedido_id, dados.cliente_id,
     JSON.stringify(dados.endereco_entrega), dados.motorista_id,
     dados.data_entrega_prevista, dados.valor_frete || 0, dados.observacoes]
  );
  return result.rows[0];
}

/**
 * Roteirizar entregas do dia (ordenar por região/bairro)
 */
export async function roteirizarEntregasDia(tenantId, data) {
  const result = await db.query(
    `SELECT e.*,
            c.nome AS cliente_nome, c.telefone AS cliente_telefone,
            u.nome AS motorista_nome
     FROM varejo_entregas e
     LEFT JOIN clientes c ON c.id = e.cliente_id
     LEFT JOIN usuarios u ON u.id = e.motorista_id
     WHERE e.tenant_id = $1
       AND e.data_entrega_prevista = $2
       AND e.status IN ('pendente','saiu_entrega')
     ORDER BY e.endereco_entrega->>'bairro', e.created_at`,
    [tenantId, data]
  );

  return {
    data,
    total_entregas: result.rows.length,
    entregas: result.rows
  };
}

export async function atualizarStatusEntrega(entregaId, tenantId, status, dados = {}) {
  const result = await db.query(
    `UPDATE varejo_entregas
     SET status = $1,
         data_entrega_real = CASE WHEN $1 = 'entregue' THEN NOW() ELSE data_entrega_real END,
         assinatura_url = COALESCE($2, assinatura_url),
         foto_entrega_url = COALESCE($3, foto_entrega_url)
     WHERE id = $4 AND tenant_id = $5
     RETURNING *`,
    [status, dados.assinatura_url, dados.foto_entrega_url, entregaId, tenantId]
  );
  return result.rows[0];
}

export async function gerarRomaneio(tenantId, data, motoristaId) {
  const roteiro = await roteirizarEntregasDia(tenantId, data);
  const entregas = motoristaId
    ? roteiro.entregas.filter(e => e.motorista_id === motoristaId)
    : roteiro.entregas;

  return {
    data,
    motorista_id: motoristaId,
    total_entregas: entregas.length,
    entregas: entregas.map((e, i) => ({
      ordem: i + 1,
      id: e.id,
      cliente: e.cliente_nome,
      telefone: e.cliente_telefone,
      endereco: e.endereco_entrega,
      status: e.status
    }))
  };
}

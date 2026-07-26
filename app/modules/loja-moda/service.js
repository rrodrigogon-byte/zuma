/**
 * Service: Loja de Moda
 * SetPoint Ultra — Módulo ERP Comercial
 * Funcionalidades: Matriz Grade (Cor × Tamanho), Crediário, Condicional, Vale-Presente, Comissões
 */
import { db } from '../../core/database.js';

// ============================================================================
// PRODUTOS E GRADE
// ============================================================================

/**
 * Criar produto com grade de variações
 */
export async function criarProdutoComGrade(tenantId, dados) {
  const { produto, variacoes } = dados;
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    // Inserir produto principal
    const prodResult = await client.query(
      `INSERT INTO loja_produtos
        (tenant_id, codigo, nome, descricao, categoria, marca, genero,
         preco_custo, preco_venda, preco_atacado, preco_construtor, imagem_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [tenantId, produto.codigo, produto.nome, produto.descricao,
       produto.categoria, produto.marca, produto.genero,
       produto.preco_custo || 0, produto.preco_venda,
       produto.preco_atacado, produto.preco_construtor, produto.imagem_url]
    );
    const prod = prodResult.rows[0];

    // Inserir variações da grade
    const gradesInseridas = [];
    for (const v of (variacoes || [])) {
      // Gerar SKU automático se não fornecido: CODIGO-COR-TAM
      const sku = v.sku || `${produto.codigo || prod.id.slice(0,8)}-${v.cor.toUpperCase()}-${v.tamanho.toUpperCase()}`;
      const gradeResult = await client.query(
        `INSERT INTO loja_grades
          (produto_id, tenant_id, cor, tamanho, sku, codigo_barras,
           estoque_atual, estoque_minimo, preco_venda_override)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [prod.id, tenantId, v.cor, v.tamanho, sku, v.codigo_barras,
         v.estoque_inicial || 0, v.estoque_minimo || 0, v.preco_venda_override]
      );
      gradesInseridas.push(gradeResult.rows[0]);
    }

    await client.query('COMMIT');
    return { produto: prod, variacoes: gradesInseridas };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Listar produtos com estoque consolidado por grade
 */
export async function listarProdutos(tenantId, filtros = {}) {
  const params = [tenantId];
  let where = 'WHERE p.tenant_id = $1 AND p.ativo = TRUE';

  if (filtros.categoria) { params.push(filtros.categoria); where += ` AND p.categoria = $${params.length}`; }
  if (filtros.genero)    { params.push(filtros.genero);    where += ` AND p.genero = $${params.length}`; }
  if (filtros.busca)     { params.push(`%${filtros.busca}%`); where += ` AND (p.nome ILIKE $${params.length} OR p.codigo ILIKE $${params.length})`; }

  const result = await db.query(
    `SELECT p.*,
            COUNT(g.id) AS total_variacoes,
            SUM(g.estoque_atual) AS estoque_total,
            json_agg(json_build_object(
              'id', g.id, 'cor', g.cor, 'tamanho', g.tamanho,
              'sku', g.sku, 'estoque', g.estoque_atual, 'preco', COALESCE(g.preco_venda_override, p.preco_venda)
            ) ORDER BY g.cor, g.tamanho) AS variacoes
     FROM loja_produtos p
     LEFT JOIN loja_grades g ON g.produto_id = p.id AND g.ativo = TRUE
     ${where}
     GROUP BY p.id
     ORDER BY p.nome`,
    params
  );
  return result.rows;
}

/**
 * Buscar variação por SKU ou código de barras (para PDV)
 */
export async function buscarVariacaoPorCodigo(tenantId, codigo) {
  const result = await db.query(
    `SELECT g.*, p.nome AS produto_nome, p.preco_venda AS preco_base,
            p.categoria, p.marca
     FROM loja_grades g
     JOIN loja_produtos p ON p.id = g.produto_id
     WHERE p.tenant_id = $1 AND g.ativo = TRUE
       AND (g.sku = $2 OR g.codigo_barras = $2)`,
    [tenantId, codigo]
  );
  return result.rows[0] || null;
}

/**
 * Atualizar estoque de uma variação
 */
export async function atualizarEstoqueGrade(gradeId, quantidade, operacao = 'adicionar') {
  const op = operacao === 'adicionar' ? '+' : '-';
  const result = await db.query(
    `UPDATE loja_grades SET estoque_atual = estoque_atual ${op} $1
     WHERE id = $2 RETURNING *`,
    [Math.abs(quantidade), gradeId]
  );
  return result.rows[0];
}

// ============================================================================
// CREDIÁRIO PRÓPRIO
// ============================================================================

/**
 * Criar cliente no crediário com análise de limite
 */
export async function criarClienteCrediario(tenantId, dados) {
  const result = await db.query(
    `INSERT INTO loja_crediario_clientes
      (tenant_id, cliente_id, nome, cpf, telefone, limite_credito, observacoes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [tenantId, dados.cliente_id, dados.nome, dados.cpf,
     dados.telefone, dados.limite_credito || 0, dados.observacoes]
  );
  return result.rows[0];
}

/**
 * Realizar venda no crediário com geração automática de parcelas
 */
export async function realizarVendaCrediario(tenantId, dados) {
  const { crediario_cliente_id, valor_total, num_parcelas, taxa_juros = 0, data_primeira_parcela } = dados;
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    // Verificar limite disponível
    const clienteResult = await client.query(
      'SELECT * FROM loja_crediario_clientes WHERE id = $1 AND tenant_id = $2',
      [crediario_cliente_id, tenantId]
    );
    const clienteCrediario = clienteResult.rows[0];
    if (!clienteCrediario) throw new Error('Cliente de crediário não encontrado');

    const limiteDisponivel = clienteCrediario.limite_credito - clienteCrediario.saldo_devedor;
    if (valor_total > limiteDisponivel) {
      throw new Error(`Limite insuficiente. Disponível: R$ ${limiteDisponivel.toFixed(2)}`);
    }

    // Calcular valor com juros
    let valorComJuros = valor_total;
    if (taxa_juros > 0 && num_parcelas > 1) {
      // Fórmula Price: PMT = PV * [i*(1+i)^n] / [(1+i)^n - 1]
      const i = taxa_juros / 100;
      const pmt = valor_total * (i * Math.pow(1 + i, num_parcelas)) / (Math.pow(1 + i, num_parcelas) - 1);
      valorComJuros = pmt * num_parcelas;
    }

    // Criar venda
    const vendaResult = await client.query(
      `INSERT INTO loja_crediario_vendas
        (tenant_id, crediario_cliente_id, valor_total, num_parcelas, taxa_juros, data_venda)
       VALUES ($1,$2,$3,$4,$5,CURRENT_DATE)
       RETURNING *`,
      [tenantId, crediario_cliente_id, valorComJuros, num_parcelas, taxa_juros]
    );
    const venda = vendaResult.rows[0];

    // Gerar parcelas
    const valorParcela = Number((valorComJuros / num_parcelas).toFixed(2));
    const primeiraData = data_primeira_parcela ? new Date(data_primeira_parcela) : new Date();
    primeiraData.setMonth(primeiraData.getMonth() + 1);

    for (let i = 0; i < num_parcelas; i++) {
      const dataVenc = new Date(primeiraData);
      dataVenc.setMonth(dataVenc.getMonth() + i);
      // Ajuste para última parcela (diferença de arredondamento)
      const valor = i === num_parcelas - 1
        ? Number((valorComJuros - valorParcela * (num_parcelas - 1)).toFixed(2))
        : valorParcela;

      await client.query(
        `INSERT INTO loja_crediario_parcelas
          (tenant_id, venda_id, numero_parcela, valor, data_vencimento)
         VALUES ($1,$2,$3,$4,$5)`,
        [tenantId, venda.id, i + 1, valor, dataVenc.toISOString().split('T')[0]]
      );
    }

    // Atualizar saldo devedor do cliente
    await client.query(
      'UPDATE loja_crediario_clientes SET saldo_devedor = saldo_devedor + $1 WHERE id = $2',
      [valorComJuros, crediario_cliente_id]
    );

    await client.query('COMMIT');
    return venda;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Registrar pagamento de parcela com cálculo de multa e juros
 */
export async function pagarParcela(parcelaId, valorPago) {
  const parcelaResult = await db.query(
    'SELECT * FROM loja_crediario_parcelas WHERE id = $1',
    [parcelaId]
  );
  const parcela = parcelaResult.rows[0];
  if (!parcela) throw new Error('Parcela não encontrada');

  const hoje = new Date();
  const vencimento = new Date(parcela.data_vencimento);
  let multa = 0;
  let juros = 0;

  if (hoje > vencimento) {
    const diasAtraso = Math.floor((hoje - vencimento) / (1000 * 60 * 60 * 24));
    multa = Number((parcela.valor * 0.02).toFixed(2));        // 2% de multa
    juros = Number((parcela.valor * 0.001 * diasAtraso).toFixed(2)); // 0,1% ao dia
  }

  const result = await db.query(
    `UPDATE loja_crediario_parcelas
     SET status = 'paga', data_pagamento = CURRENT_DATE,
         valor_pago = $1, multa = $2, juros = $3
     WHERE id = $4
     RETURNING *`,
    [valorPago, multa, juros, parcelaId]
  );

  // Atualizar saldo devedor
  await db.query(
    `UPDATE loja_crediario_clientes
     SET saldo_devedor = saldo_devedor - $1
     WHERE id = (SELECT crediario_cliente_id FROM loja_crediario_vendas WHERE id = $2)`,
    [parcela.valor, parcela.venda_id]
  );

  return result.rows[0];
}

/**
 * Listar parcelas vencidas para régua de cobrança
 */
export async function listarParcelasVencidas(tenantId) {
  const result = await db.query(
    `SELECT p.*, v.crediario_cliente_id, c.nome AS cliente_nome,
            c.telefone AS cliente_telefone,
            CURRENT_DATE - p.data_vencimento AS dias_atraso
     FROM loja_crediario_parcelas p
     JOIN loja_crediario_vendas v ON v.id = p.venda_id
     JOIN loja_crediario_clientes c ON c.id = v.crediario_cliente_id
     WHERE c.tenant_id = $1
       AND p.status = 'aberta'
       AND p.data_vencimento < CURRENT_DATE
     ORDER BY p.data_vencimento ASC`,
    [tenantId]
  );
  return result.rows;
}

// ============================================================================
// CONDICIONAL (MALINHA)
// ============================================================================

/**
 * Abrir condicional com lista de peças
 */
export async function abrirCondicional(tenantId, dados) {
  const { cliente_nome, cliente_telefone, vendedor_id, data_retorno_prevista, itens } = dados;
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    const condResult = await client.query(
      `INSERT INTO loja_condicionais
        (tenant_id, cliente_nome, cliente_telefone, vendedor_id, data_retorno_prevista)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [tenantId, cliente_nome, cliente_telefone, vendedor_id, data_retorno_prevista]
    );
    const cond = condResult.rows[0];

    // Inserir itens e reservar estoque
    for (const item of (itens || [])) {
      await client.query(
        `INSERT INTO loja_condicionais_itens
          (condicional_id, grade_id, quantidade, preco_unitario)
         VALUES ($1,$2,$3,$4)`,
        [cond.id, item.grade_id, item.quantidade, item.preco_unitario]
      );
      // Reservar estoque (decrementar)
      await client.query(
        'UPDATE loja_grades SET estoque_atual = estoque_atual - $1 WHERE id = $2',
        [item.quantidade, item.grade_id]
      );
    }

    await client.query('COMMIT');
    return cond;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Retornar condicional: devolver peças não compradas ao estoque
 */
export async function retornarCondicional(condicionalId, itensRetornados) {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    for (const itemId of itensRetornados) {
      const itemResult = await client.query(
        'SELECT * FROM loja_condicionais_itens WHERE id = $1',
        [itemId]
      );
      const item = itemResult.rows[0];
      if (item && !item.faturado) {
        // Devolver ao estoque
        await client.query(
          'UPDATE loja_grades SET estoque_atual = estoque_atual + $1 WHERE id = $2',
          [item.quantidade, item.grade_id]
        );
        await client.query(
          'UPDATE loja_condicionais_itens SET retornado = TRUE WHERE id = $1',
          [itemId]
        );
      }
    }

    // Verificar se todos os itens foram retornados ou faturados
    const pendentesResult = await client.query(
      `SELECT COUNT(*) FROM loja_condicionais_itens
       WHERE condicional_id = $1 AND retornado = FALSE AND faturado = FALSE`,
      [condicionalId]
    );
    const pendentes = parseInt(pendentesResult.rows[0].count);

    const novoStatus = pendentes === 0 ? 'retornada' : 'aberta';
    await client.query(
      `UPDATE loja_condicionais SET status = $1, data_retorno_real = CURRENT_DATE
       WHERE id = $2`,
      [novoStatus, condicionalId]
    );

    await client.query('COMMIT');
    return { status: novoStatus, pendentes };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================================
// VALE-PRESENTE
// ============================================================================

/**
 * Emitir vale-presente com código único
 */
export async function emitirValePresente(tenantId, dados) {
  // Gerar código único de 10 caracteres
  const codigo = `VP${Date.now().toString(36).toUpperCase().slice(-8)}`;
  const result = await db.query(
    `INSERT INTO loja_vale_presentes
      (tenant_id, codigo, valor_original, saldo_atual, cpf_destinatario,
       nome_destinatario, data_validade)
     VALUES ($1,$2,$3,$3,$4,$5,$6)
     RETURNING *`,
    [tenantId, codigo, dados.valor, dados.cpf_destinatario,
     dados.nome_destinatario, dados.data_validade]
  );
  return result.rows[0];
}

/**
 * Utilizar vale-presente no PDV
 */
export async function utilizarValePresente(tenantId, codigo, valorUtilizar) {
  const result = await db.query(
    `SELECT * FROM loja_vale_presentes
     WHERE tenant_id = $1 AND codigo = $2 AND status = 'ativo'`,
    [tenantId, codigo]
  );
  const vale = result.rows[0];
  if (!vale) throw new Error('Vale-presente não encontrado ou inativo');
  if (vale.data_validade && new Date(vale.data_validade) < new Date()) {
    await db.query("UPDATE loja_vale_presentes SET status = 'expirado' WHERE id = $1", [vale.id]);
    throw new Error('Vale-presente expirado');
  }
  if (valorUtilizar > vale.saldo_atual) throw new Error('Saldo insuficiente no vale-presente');

  const novoSaldo = Number((vale.saldo_atual - valorUtilizar).toFixed(2));
  const novoStatus = novoSaldo === 0 ? 'utilizado' : 'ativo';

  const updated = await db.query(
    `UPDATE loja_vale_presentes SET saldo_atual = $1, status = $2 WHERE id = $3 RETURNING *`,
    [novoSaldo, novoStatus, vale.id]
  );
  return updated.rows[0];
}

// ============================================================================
// COMISSÕES DE VENDEDORES
// ============================================================================

/**
 * Calcular comissões do período por vendedor
 */
export async function calcularComissoesPeriodo(tenantId, dataInicio, dataFim) {
  const result = await db.query(
    `SELECT
       v.vendedor_id,
       u.nome AS vendedor_nome,
       COUNT(v.id) AS total_vendas,
       SUM(v.valor_total) AS valor_total_vendas,
       AVG(v.percentual_comissao) AS percentual_medio,
       SUM(v.valor_total * v.percentual_comissao / 100) AS total_comissao
     FROM vendas v
     JOIN usuarios u ON u.id = v.vendedor_id
     WHERE v.tenant_id = $1
       AND v.data_venda BETWEEN $2 AND $3
       AND v.status = 'finalizada'
     GROUP BY v.vendedor_id, u.nome
     ORDER BY total_comissao DESC`,
    [tenantId, dataInicio, dataFim]
  );
  return result.rows;
}

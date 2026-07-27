/**
 * Service: Supermercado
 * SetPoint Ultra — Módulo ERP Comercial
 * Funcionalidades: Produtos com balança, Lotes e Validade, Promoções complexas,
 * Açougue/Padaria com ficha técnica, Etiquetas de gôndola, Inventário
 */
import { db } from '../../core/database.js';

// ============================================================================
// PRODUTOS
// ============================================================================

export async function listarProdutos(tenantId, filtros = {}) {
  const params = [tenantId];
  let where = 'WHERE p.tenant_id = $1 AND p.ativo = TRUE';

  if (filtros.categoria) { params.push(filtros.categoria); where += ` AND p.categoria = $${params.length}`; }
  if (filtros.setor)     { params.push(filtros.setor);     where += ` AND p.setor = $${params.length}`; }
  if (filtros.busca) {
    params.push(`%${filtros.busca}%`);
    where += ` AND (p.nome ILIKE $${params.length} OR p.codigo_barras = $${params.length} OR p.codigo_interno ILIKE $${params.length})`;
  }
  if (filtros.alerta_estoque) {
    where += ` AND p.estoque_atual <= p.estoque_minimo`;
  }

  const result = await db.query(
    `SELECT p.*,
            COALESCE(
              (SELECT MIN(l.data_validade)
               FROM super_lotes l
               WHERE l.produto_id = p.id AND l.quantidade_atual > 0
                 AND l.data_validade IS NOT NULL),
              NULL
            ) AS proxima_validade,
            COALESCE(
              (SELECT SUM(l.quantidade_atual)
               FROM super_lotes l
               WHERE l.produto_id = p.id),
              p.estoque_atual
            ) AS estoque_lotes
     FROM super_produtos p
     ${where}
     ORDER BY p.nome
     LIMIT 200`,
    params
  );
  return result.rows;
}

export async function buscarPorCodigoBarras(tenantId, codigoBarras) {
  // Suporte a código de balança: 2XXXXXPPPPP (X=código produto, P=peso*1000)
  let codigo = codigoBarras;
  let pesoBalanca = null;

  if (codigoBarras.startsWith('2') && codigoBarras.length === 13) {
    const codigoProduto = codigoBarras.substring(1, 6);
    const pesoRaw = codigoBarras.substring(7, 12);
    pesoBalanca = parseInt(pesoRaw) / 1000; // em kg
    codigo = codigoProduto;
  }

  const result = await db.query(
    `SELECT p.*, s.nome AS setor_nome
     FROM super_produtos p
     LEFT JOIN super_setores s ON s.id = p.setor_id
     WHERE p.tenant_id = $1
       AND (p.codigo_barras = $2 OR p.codigo_interno = $2 OR p.codigo_balanca = $2)
       AND p.ativo = TRUE`,
    [tenantId, codigo]
  );

  const produto = result.rows[0];
  if (!produto) return null;

  // Buscar promoção ativa
  const promo = await buscarPromocaoAtiva(tenantId, produto.id);

  return {
    ...produto,
    peso_balanca: pesoBalanca,
    preco_final: promo ? calcularPrecoPromocao(produto.preco_venda, promo) : produto.preco_venda,
    promocao: promo || null,
  };
}

export async function criarProduto(tenantId, dados) {
  const {
    codigo_interno, codigo_barras, codigo_balanca, nome, descricao,
    categoria, setor_id, unidade, preco_custo, preco_venda,
    estoque_atual, estoque_minimo, controla_lote, pesavel,
    ncm, cest, cfop, cst_icms, aliquota_icms, cst_pis, cst_cofins
  } = dados;

  const result = await db.query(
    `INSERT INTO super_produtos
      (tenant_id, codigo_interno, codigo_barras, codigo_balanca, nome, descricao,
       categoria, setor_id, unidade, preco_custo, preco_venda,
       estoque_atual, estoque_minimo, controla_lote, pesavel,
       ncm, cest, cfop, cst_icms, aliquota_icms, cst_pis, cst_cofins)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     RETURNING *`,
    [tenantId, codigo_interno, codigo_barras, codigo_balanca, nome, descricao,
     categoria, setor_id, unidade || 'UN', parseFloat(preco_custo) || 0, parseFloat(preco_venda) || 0,
     parseFloat(estoque_atual) || 0, parseFloat(estoque_minimo) || 0,
     controla_lote || false, pesavel || false,
     ncm, cest, cfop, cst_icms, parseFloat(aliquota_icms) || 0, cst_pis, cst_cofins]
  );
  return result.rows[0];
}

export async function atualizarProduto(tenantId, produtoId, dados) {
  const campos = [];
  const params = [tenantId, produtoId];
  const permitidos = [
    'nome', 'descricao', 'preco_custo', 'preco_venda', 'estoque_minimo',
    'categoria', 'setor_id', 'unidade', 'pesavel', 'controla_lote',
    'ncm', 'cest', 'aliquota_icms'
  ];

  for (const campo of permitidos) {
    if (dados[campo] !== undefined) {
      params.push(dados[campo]);
      campos.push(`${campo} = $${params.length}`);
    }
  }

  if (!campos.length) throw new Error('Nenhum campo para atualizar');

  const result = await db.query(
    `UPDATE super_produtos SET ${campos.join(', ')}, updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2
     RETURNING *`,
    params
  );
  return result.rows[0];
}

// ============================================================================
// SETORES
// ============================================================================

export async function listarSetores(tenantId) {
  const result = await db.query(
    `SELECT s.*, COUNT(p.id) AS total_produtos
     FROM super_setores s
     LEFT JOIN super_produtos p ON p.setor_id = s.id AND p.ativo = TRUE
     WHERE s.tenant_id = $1
     GROUP BY s.id
     ORDER BY s.nome`,
    [tenantId]
  );
  return result.rows;
}

export async function criarSetor(tenantId, dados) {
  const result = await db.query(
    `INSERT INTO super_setores (tenant_id, nome, descricao, responsavel)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [tenantId, dados.nome, dados.descricao, dados.responsavel]
  );
  return result.rows[0];
}

// ============================================================================
// LOTES E VALIDADE
// ============================================================================

export async function listarLotes(tenantId, filtros = {}) {
  const params = [tenantId];
  let where = 'WHERE l.tenant_id = $1';

  if (filtros.produto_id) {
    params.push(filtros.produto_id);
    where += ` AND l.produto_id = $${params.length}`;
  }
  if (filtros.vencendo_em_dias) {
    params.push(parseInt(filtros.vencendo_em_dias));
    where += ` AND l.data_validade <= CURRENT_DATE + INTERVAL '$${params.length} days'
               AND l.data_validade >= CURRENT_DATE`;
  }
  if (filtros.apenas_ativos) {
    where += ` AND l.quantidade_atual > 0`;
  }

  const result = await db.query(
    `SELECT l.*,
            p.nome AS produto_nome, p.codigo_barras, p.unidade,
            l.data_validade - CURRENT_DATE AS dias_para_vencer,
            CASE
              WHEN l.data_validade < CURRENT_DATE THEN 'vencido'
              WHEN l.data_validade <= CURRENT_DATE + INTERVAL '7 days' THEN 'critico'
              WHEN l.data_validade <= CURRENT_DATE + INTERVAL '30 days' THEN 'atencao'
              ELSE 'ok'
            END AS status_validade
     FROM super_lotes l
     JOIN super_produtos p ON p.id = l.produto_id
     ${where}
     ORDER BY l.data_validade ASC NULLS LAST`,
    params
  );
  return result.rows;
}

export async function registrarLote(tenantId, dados) {
  const {
    produto_id, numero_lote, data_fabricacao, data_validade,
    quantidade, preco_custo, fornecedor_id, nota_fiscal
  } = dados;

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    const loteResult = await client.query(
      `INSERT INTO super_lotes
        (tenant_id, produto_id, numero_lote, data_fabricacao, data_validade,
         quantidade_inicial, quantidade_atual, preco_custo, fornecedor_id, nota_fiscal)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9)
       RETURNING *`,
      [tenantId, produto_id, numero_lote, data_fabricacao, data_validade,
       parseFloat(quantidade), parseFloat(preco_custo) || 0, fornecedor_id, nota_fiscal]
    );

    // Atualizar estoque do produto
    await client.query(
      `UPDATE super_produtos
       SET estoque_atual = estoque_atual + $1, updated_at = NOW()
       WHERE tenant_id = $2 AND id = $3`,
      [parseFloat(quantidade), tenantId, produto_id]
    );

    await client.query('COMMIT');
    return loteResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function contarLotesVencendo(tenantId, dias = 7) {
  const result = await db.query(
    `SELECT COUNT(*) AS total
     FROM super_lotes l
     JOIN super_produtos p ON p.id = l.produto_id
     WHERE p.tenant_id = $1
       AND l.quantidade_atual > 0
       AND l.data_validade IS NOT NULL
       AND l.data_validade <= CURRENT_DATE + INTERVAL '${parseInt(dias)} days'
       AND l.data_validade >= CURRENT_DATE`,
    [tenantId]
  );
  return parseInt(result.rows[0]?.total || 0);
}

// ============================================================================
// PROMOÇÕES
// ============================================================================

export async function listarPromocoes(tenantId, apenasAtivas = false) {
  let where = 'WHERE p.tenant_id = $1';
  if (apenasAtivas) {
    where += ` AND p.ativo = TRUE
               AND (p.data_inicio IS NULL OR p.data_inicio <= CURRENT_DATE)
               AND (p.data_fim IS NULL OR p.data_fim >= CURRENT_DATE)`;
  }

  const result = await db.query(
    `SELECT p.*,
            COUNT(pi.id) AS total_produtos
     FROM super_promocoes p
     LEFT JOIN super_promocoes_itens pi ON pi.promocao_id = p.id
     ${where}
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [tenantId]
  );
  return result.rows;
}

export async function criarPromocao(tenantId, dados) {
  const {
    nome, tipo, valor_desconto, percentual_desconto,
    quantidade_leve, quantidade_pague, preco_fixo,
    data_inicio, data_fim, produtos = []
  } = dados;

  // Tipos: 'percentual' | 'valor_fixo' | 'leve_x_pague_y' | 'preco_especial'
  const tiposValidos = ['percentual', 'valor_fixo', 'leve_x_pague_y', 'preco_especial'];
  if (!tiposValidos.includes(tipo)) throw new Error(`Tipo inválido. Use: ${tiposValidos.join(', ')}`);

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    const promoResult = await client.query(
      `INSERT INTO super_promocoes
        (tenant_id, nome, tipo, valor_desconto, percentual_desconto,
         quantidade_leve, quantidade_pague, preco_fixo,
         data_inicio, data_fim, ativo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE)
       RETURNING *`,
      [tenantId, nome, tipo,
       parseFloat(valor_desconto) || null, parseFloat(percentual_desconto) || null,
       parseInt(quantidade_leve) || null, parseInt(quantidade_pague) || null,
       parseFloat(preco_fixo) || null,
       data_inicio || null, data_fim || null]
    );
    const promo = promoResult.rows[0];

    // Vincular produtos
    for (const produtoId of produtos) {
      await client.query(
        `INSERT INTO super_promocoes_itens (promocao_id, produto_id, tenant_id)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [promo.id, produtoId, tenantId]
      );
    }

    await client.query('COMMIT');
    return promo;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function buscarPromocaoAtiva(tenantId, produtoId) {
  const result = await db.query(
    `SELECT p.*
     FROM super_promocoes p
     JOIN super_promocoes_itens pi ON pi.promocao_id = p.id
     WHERE p.tenant_id = $1
       AND pi.produto_id = $2
       AND p.ativo = TRUE
       AND (p.data_inicio IS NULL OR p.data_inicio <= CURRENT_DATE)
       AND (p.data_fim IS NULL OR p.data_fim >= CURRENT_DATE)
     ORDER BY p.created_at DESC
     LIMIT 1`,
    [tenantId, produtoId]
  );
  return result.rows[0] || null;
}

function calcularPrecoPromocao(precoBase, promocao) {
  const preco = parseFloat(precoBase);
  switch (promocao.tipo) {
    case 'percentual':
      return preco * (1 - parseFloat(promocao.percentual_desconto) / 100);
    case 'valor_fixo':
      return Math.max(0, preco - parseFloat(promocao.valor_desconto));
    case 'preco_especial':
      return parseFloat(promocao.preco_fixo);
    default:
      return preco;
  }
}

// ============================================================================
// AÇOUGUE E PADARIA — FICHA TÉCNICA
// ============================================================================

export async function listarFichasTecnicas(tenantId, tipo = null) {
  const params = [tenantId];
  let where = 'WHERE f.tenant_id = $1';
  if (tipo) { params.push(tipo); where += ` AND f.tipo = $${params.length}`; }

  const result = await db.query(
    `SELECT f.*,
            p.nome AS produto_final_nome
     FROM super_fichas_tecnicas f
     LEFT JOIN super_produtos p ON p.id = f.produto_id
     ${where}
     ORDER BY f.nome`,
    params
  );
  return result.rows;
}

export async function criarFichaTecnica(tenantId, dados) {
  // tipo: 'desossa' | 'receita_padaria' | 'preparo'
  const {
    nome, tipo, produto_id, rendimento_kg, rendimento_unidades,
    tempo_preparo_min, custo_mao_obra, observacoes, ingredientes = []
  } = dados;

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    // Calcular custo total dos ingredientes
    let custoIngredientes = 0;
    for (const ing of ingredientes) {
      const prodResult = await client.query(
        'SELECT preco_custo FROM super_produtos WHERE id = $1',
        [ing.produto_id]
      );
      const precoCusto = parseFloat(prodResult.rows[0]?.preco_custo || 0);
      custoIngredientes += precoCusto * parseFloat(ing.quantidade);
    }

    const custoTotal = custoIngredientes + parseFloat(custo_mao_obra || 0);
    const custoPorKg = rendimento_kg ? custoTotal / parseFloat(rendimento_kg) : null;
    const custoPorUnidade = rendimento_unidades ? custoTotal / parseFloat(rendimento_unidades) : null;

    const fichaResult = await client.query(
      `INSERT INTO super_fichas_tecnicas
        (tenant_id, nome, tipo, produto_id, rendimento_kg, rendimento_unidades,
         tempo_preparo_min, custo_ingredientes, custo_mao_obra, custo_total,
         custo_por_kg, custo_por_unidade, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [tenantId, nome, tipo || 'receita_padaria', produto_id,
       parseFloat(rendimento_kg) || null, parseInt(rendimento_unidades) || null,
       parseInt(tempo_preparo_min) || null,
       custoIngredientes, parseFloat(custo_mao_obra) || 0, custoTotal,
       custoPorKg, custoPorUnidade, observacoes]
    );
    const ficha = fichaResult.rows[0];

    // Inserir ingredientes
    for (const ing of ingredientes) {
      await client.query(
        `INSERT INTO super_fichas_ingredientes
          (ficha_id, produto_id, quantidade, unidade, observacao)
         VALUES ($1,$2,$3,$4,$5)`,
        [ficha.id, ing.produto_id, parseFloat(ing.quantidade),
         ing.unidade || 'kg', ing.observacao]
      );
    }

    await client.query('COMMIT');
    return ficha;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================================
// ETIQUETAS DE GÔNDOLA
// ============================================================================

export async function gerarDadosEtiqueta(tenantId, produtoId) {
  const result = await db.query(
    `SELECT p.*,
            s.nome AS setor_nome,
            (SELECT pr.percentual_desconto FROM super_promocoes pr
             JOIN super_promocoes_itens pi ON pi.promocao_id = pr.id
             WHERE pi.produto_id = p.id AND pr.ativo = TRUE
               AND (pr.data_fim IS NULL OR pr.data_fim >= CURRENT_DATE)
             LIMIT 1) AS promo_percentual
     FROM super_produtos p
     LEFT JOIN super_setores s ON s.id = p.setor_id
     WHERE p.tenant_id = $1 AND p.id = $2`,
    [tenantId, produtoId]
  );

  const produto = result.rows[0];
  if (!produto) throw new Error('Produto não encontrado');

  const precoPromo = produto.promo_percentual
    ? produto.preco_venda * (1 - produto.promo_percentual / 100)
    : null;

  return {
    codigo_barras: produto.codigo_barras,
    nome: produto.nome,
    setor: produto.setor_nome,
    preco_normal: parseFloat(produto.preco_venda).toFixed(2),
    preco_promocional: precoPromo ? precoPromo.toFixed(2) : null,
    unidade: produto.unidade,
    pesavel: produto.pesavel,
  };
}

// ============================================================================
// INVENTÁRIO
// ============================================================================

export async function iniciarInventario(tenantId, dados) {
  const { nome, setor_id, tipo = 'geral' } = dados;

  const result = await db.query(
    `INSERT INTO super_inventarios
      (tenant_id, nome, tipo, setor_id, status)
     VALUES ($1,$2,$3,$4,'aberto')
     RETURNING *`,
    [tenantId, nome, tipo, setor_id || null]
  );
  return result.rows[0];
}

export async function registrarContagemInventario(tenantId, inventarioId, itens) {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    for (const item of itens) {
      await client.query(
        `INSERT INTO super_inventario_itens
          (inventario_id, produto_id, tenant_id, quantidade_sistema, quantidade_contada, divergencia)
         VALUES ($1,$2,$3,
           (SELECT estoque_atual FROM super_produtos WHERE id = $2),
           $4,
           $4 - (SELECT estoque_atual FROM super_produtos WHERE id = $2))
         ON CONFLICT (inventario_id, produto_id)
         DO UPDATE SET quantidade_contada = EXCLUDED.quantidade_contada,
                       divergencia = EXCLUDED.divergencia,
                       updated_at = NOW()`,
        [inventarioId, item.produto_id, tenantId, parseFloat(item.quantidade_contada)]
      );
    }

    await client.query('COMMIT');
    return { registrados: itens.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function fecharInventario(tenantId, inventarioId, aplicarAjustes = false) {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    if (aplicarAjustes) {
      // Aplicar divergências ao estoque real
      const itensResult = await client.query(
        `SELECT * FROM super_inventario_itens
         WHERE inventario_id = $1 AND divergencia != 0`,
        [inventarioId]
      );

      for (const item of itensResult.rows) {
        await client.query(
          `UPDATE super_produtos
           SET estoque_atual = quantidade_contada, updated_at = NOW()
           WHERE id = $1`,
          [item.produto_id]
        );
      }
    }

    const result = await client.query(
      `UPDATE super_inventarios
       SET status = 'fechado', fechado_em = NOW(), ajustes_aplicados = $2
       WHERE tenant_id = $1 AND id = $3
       RETURNING *`,
      [tenantId, aplicarAjustes, inventarioId]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================================
// RELATÓRIOS
// ============================================================================

export async function relatorioVendasPorSetor(tenantId, dataInicio, dataFim) {
  const result = await db.query(
    `SELECT s.nome AS setor,
            COUNT(vi.id) AS total_itens_vendidos,
            SUM(vi.quantidade) AS total_quantidade,
            SUM(vi.valor_total) AS faturamento,
            SUM(vi.valor_total - (vi.quantidade * p.preco_custo)) AS margem_bruta
     FROM super_vendas_itens vi
     JOIN super_produtos p ON p.id = vi.produto_id
     LEFT JOIN super_setores s ON s.id = p.setor_id
     JOIN super_vendas v ON v.id = vi.venda_id
     WHERE v.tenant_id = $1
       AND v.created_at::date BETWEEN $2 AND $3
     GROUP BY s.nome
     ORDER BY faturamento DESC`,
    [tenantId, dataInicio, dataFim]
  );
  return result.rows;
}

export async function curvABC(tenantId, dataInicio, dataFim) {
  const result = await db.query(
    `WITH vendas AS (
       SELECT vi.produto_id, p.nome, SUM(vi.valor_total) AS faturamento
       FROM super_vendas_itens vi
       JOIN super_produtos p ON p.id = vi.produto_id
       JOIN super_vendas v ON v.id = vi.venda_id
       WHERE v.tenant_id = $1 AND v.created_at::date BETWEEN $2 AND $3
       GROUP BY vi.produto_id, p.nome
     ),
     total AS (SELECT SUM(faturamento) AS total FROM vendas),
     ranking AS (
       SELECT *, faturamento / total.total * 100 AS percentual,
              SUM(faturamento / total.total * 100) OVER (ORDER BY faturamento DESC) AS acumulado
       FROM vendas, total
     )
     SELECT *,
            CASE WHEN acumulado <= 80 THEN 'A'
                 WHEN acumulado <= 95 THEN 'B'
                 ELSE 'C' END AS curva
     FROM ranking
     ORDER BY faturamento DESC`,
    [tenantId, dataInicio, dataFim]
  );
  return result.rows;
}

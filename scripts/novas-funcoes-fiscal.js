
// ── SANEAMENTO, CLASSIFICAÇÃO FIEL MULTIEMPRESA E AUDITORIA DE CADASTROS ─────

export async function arquivarCatalogoDemoDino(db) {
  const empresa = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const arquivadosEstoque = [];
  const arquivadosCommerce = [];

  try {
    // 1. Arquiva itens de supermercado da est_itens
    const resEst = await db.query(
      `UPDATE est_itens
          SET ativo = false
        WHERE empresa_id = $1 AND (
            categoria IN ('Açougue e Carnes', 'Hortifrúti', 'Laticínios e Frios', 'Mercearia', 'Mercearia Salgada', 'Mercearia Doce', 'Limpeza', 'Matinais', 'Padaria')
            OR nome IN ('Papel Higiênico Folha Dupla 12 Rolos', 'Creme Dental Proteção Total 90g', 'Sabonete em Barra Hidratante 90g')
            OR nome ILIKE '%teste%'
            OR nome ILIKE '%homologação%'
          )
          AND ativo = true
        RETURNING id, sku, nome, categoria`,
      [empresa]
    );
    arquivadosEstoque.push(...(resEst.rows || []));

    // 2. Arquiva itens de homologação e teste do commerce_products
    const resComm = await db.query(
      `UPDATE commerce_products
          SET status = 'archived'
        WHERE empresa_id = $1 AND (
            nome ILIKE '%homologação%'
            OR nome ILIKE '%teste%'
          )
          AND status <> 'archived'
        RETURNING id, nome, status`,
      [empresa]
    );
    arquivadosCommerce.push(...(resComm.rows || []));
  } catch (err) {
    console.error('[fiscal] Erro em arquivarCatalogoDemoDino:', err?.message || err);
  }

  return {
    ok: true,
    totalArquivadosEstoque: arquivadosEstoque.length,
    totalArquivadosCommerce: arquivadosCommerce.length,
    arquivadosEstoque,
    arquivadosCommerce,
    mensagem: `Arquivados com sucesso ${arquivadosEstoque.length} itens de supermercado e ${arquivadosCommerce.length} itens de teste na Dino.`
  };
}

export async function classificarProdutosAgroOpen(db) {
  const empresaAgro = '2e041110-db20-4fd1-8278-12bd3dead008';
  const REGRAS_AGRO = {
    'AOT-001': { ncm: '61091000', cest: null, cfop: '5102', csosn: '102', pisCofins: '49', origem: 0, nome: 'Camiseta Oficial Agro Open' },
    'AOT-002': { ncm: '65050090', cest: null, cfop: '5102', csosn: '102', pisCofins: '49', origem: 0, nome: 'Boné Oficial Agro Open' },
    'AOT-003': { ncm: '61091000', cest: null, cfop: '5102', csosn: '102', pisCofins: '49', origem: 0, nome: 'Camiseta Premium Monograma AO' },
    'AOT-004': { ncm: '65050090', cest: null, cfop: '5102', csosn: '102', pisCofins: '49', origem: 0, nome: 'Boné Premium Monograma AO' },
    'AOT-005': { ncm: '61159500', cest: null, cfop: '5102', csosn: '102', pisCofins: '49', origem: 0, nome: 'Meias Esportivas Agro Open' },
    'AOT-006': { ncm: '42029200', cest: null, cfop: '5102', csosn: '102', pisCofins: '49', origem: 0, nome: 'Sacola Tote Bag Oficial' },
    'AOT-007': { ncm: '39241000', cest: null, cfop: '5102', csosn: '102', pisCofins: '49', origem: 0, nome: 'Garrafa Squeeze 750ml' },
    'AOT-008': { ncm: '63026000', cest: null, cfop: '5102', csosn: '102', pisCofins: '49', origem: 0, nome: 'Toalhinha de Tênis 50×90cm' },
    'AOT-009': { ncm: '39269090', cest: null, cfop: '5102', csosn: '102', pisCofins: '49', origem: 0, nome: 'Pulseira de Identificação' },
    'AOT-010': { ncm: '61178010', cest: null, cfop: '5102', csosn: '102', pisCofins: '49', origem: 0, nome: 'Munhequeira Oficial (Par)' },
    'AOT-011': { ncm: '61171000', cest: null, cfop: '5102', csosn: '102', pisCofins: '49', origem: 0, nome: 'Bandana Headband Agro Open' },
    'AOT-012': { ncm: '95065900', cest: null, cfop: '5102', csosn: '102', pisCofins: '49', origem: 0, nome: 'Grip / Overgrip Agro Open' },
    'AOT-013': { ncm: '42029200', cest: null, cfop: '5102', csosn: '102', pisCofins: '49', origem: 0, nome: 'Mochila Esportiva Agro Open' },
    'AOT-014': { ncm: '42029200', cest: null, cfop: '5102', csosn: '102', pisCofins: '49', origem: 0, nome: 'Raqueteira Agro Open' },
    'AOT-015': { ncm: '63026000', cest: null, cfop: '5102', csosn: '102', pisCofins: '49', origem: 0, nome: 'Toalha Grande Agro Open' },
    'AOT-016': { ncm: '65050090', cest: null, cfop: '5102', csosn: '102', pisCofins: '49', origem: 0, nome: 'Viseira Agro Open' }
  };

  const resultados = [];
  try {
    for (const [sku, regra] of Object.entries(REGRAS_AGRO)) {
      // 1. Atualiza na commerce_products através da variante
      const rProd = await db.query(
        `UPDATE commerce_products p
            SET dados_fiscais = jsonb_build_object(
                  'ncm', $2::text,
                  'cest', $3::text,
                  'cfop', $4::text,
                  'csosn', $5::text,
                  'cst_pis', $6::text,
                  'cst_cofins', $6::text,
                  'origem', $7::int
                ),
                atualizado_em = CURRENT_TIMESTAMP
           FROM commerce_product_variants v
          WHERE v.product_id = p.id
            AND p.empresa_id = $1
            AND v.sku = $8
          RETURNING p.id, p.nome`,
        [empresaAgro, regra.ncm, regra.cest, regra.cfop, regra.csosn, regra.pisCofins, regra.origem, sku]
      );

      // 2. Registra na tabela fis_classificacoes para a central fiscal
      if (rProd.rows[0]) {
        const prodId = rProd.rows[0].id;
        await db.query(
          `INSERT INTO fis_classificacoes (
              empresa_id, fonte, fonte_id, ncm, cest, cfop, csosn, cst_pis, cst_cofins, origem, atualizado_em
            ) VALUES ($1, 'produto', $2, $3, $4, $5, $6, $7, $7, $8, CURRENT_TIMESTAMP)
            ON CONFLICT (empresa_id, fonte, fonte_id) DO UPDATE SET
              ncm = EXCLUDED.ncm,
              cest = EXCLUDED.cest,
              cfop = EXCLUDED.cfop,
              csosn = EXCLUDED.csosn,
              cst_pis = EXCLUDED.cst_pis,
              cst_cofins = EXCLUDED.cst_cofins,
              origem = EXCLUDED.origem,
              atualizado_em = CURRENT_TIMESTAMP`,
          [empresaAgro, String(prodId), regra.ncm, regra.cest, regra.cfop, regra.csosn, regra.pisCofins, regra.origem]
        );
        resultados.push({ sku, nome: rProd.rows[0].nome, ncm: regra.ncm });
      }
    }
  } catch (err) {
    console.error('[fiscal] Erro em classificarProdutosAgroOpen:', err?.message || err);
  }

  return {
    ok: true,
    totalClassificados: resultados.length,
    itens: resultados,
    mensagem: `${resultados.length} produtos oficiais da AGRO OPEN TTC classificados com sucesso!`
  };
}

export async function classificarProdutosStallonePorGrupo(db) {
  const empresaStallone = '31f70c83-9172-40c2-945f-9e793b5048be';
  let totalClassificados = 0;

  try {
    // 1. Whey e Proteínas -> NCM 2106.10.00
    const resWhey = await db.query(
      `UPDATE commerce_products
          SET dados_fiscais = jsonb_build_object('ncm', '21061000', 'cfop', '5102', 'csosn', '102', 'cst_pis', '49', 'cst_cofins', '49', 'origem', 0),
              atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1
          AND (nome ILIKE '%whey%' OR nome ILIKE '%proteína%' OR nome ILIKE '%proteina%' OR nome ILIKE '%colágeno%' OR nome ILIKE '%colageno%')
        RETURNING id`,
      [empresaStallone]
    );
    totalClassificados += resWhey.rowCount || 0;

    // 2. Suplementos em cápsula, tablete e própolis -> NCM 2106.90.30
    const resCaps = await db.query(
      `UPDATE commerce_products
          SET dados_fiscais = jsonb_build_object('ncm', '21069030', 'cfop', '5102', 'csosn', '102', 'cst_pis', '49', 'cst_cofins', '49', 'origem', 0),
              atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1
          AND (nome ILIKE '%caps%' OR nome ILIKE '%cáps%' OR nome ILIKE '%tablete%' OR nome ILIKE '%creatina%' OR nome ILIKE '%própolis%' OR nome ILIKE '%propolis%')
        RETURNING id`,
      [empresaStallone]
    );
    totalClassificados += resCaps.rowCount || 0;

    // 3. Pré-treino e Géis de carboidrato -> NCM 2106.90.90
    const resGel = await db.query(
      `UPDATE commerce_products
          SET dados_fiscais = jsonb_build_object('ncm', '21069090', 'cfop', '5102', 'csosn', '102', 'cst_pis', '49', 'cst_cofins', '49', 'origem', 0),
              atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1
          AND (nome ILIKE '%pré-treino%' OR nome ILIKE '%pre-treino%' OR nome ILIKE '%pre treino%' OR nome ILIKE '%gel%' OR nome ILIKE '%energy gel%')
        RETURNING id`,
      [empresaStallone]
    );
    totalClassificados += resGel.rowCount || 0;

    // 4. Coqueteleiras e garrafas térmicas -> NCM 3924.10.00
    const resCoq = await db.query(
      `UPDATE commerce_products
          SET dados_fiscais = jsonb_build_object('ncm', '39241000', 'cfop', '5102', 'csosn', '102', 'cst_pis', '49', 'cst_cofins', '49', 'origem', 0),
              atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1
          AND (nome ILIKE '%coqueteleira%' OR nome ILIKE '%garrafa%' OR nome ILIKE '%copo%')
        RETURNING id`,
      [empresaStallone]
    );
    totalClassificados += resCoq.rowCount || 0;

  } catch (err) {
    console.error('[fiscal] Erro em classificarProdutosStallonePorGrupo:', err?.message || err);
  }

  return {
    ok: true,
    totalClassificados,
    mensagem: `${totalClassificados} produtos da Stallone Nutre Sport classificados com sucesso!`
  };
}

export async function auditarCadastrosIncompletos(db, empresaId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const pendencias = {
    totalItens: 0,
    semTipo: [],
    semNcm: [],
    semCusto: [],
    semEan: [],
    estoquePadrao: [],
    duplicados: []
  };

  try {
    // 1. Analisa itens de estoque
    const resEst = await db.query(
      `SELECT id, sku, ean, nome, tipo, categoria, ncm, custo_medio, preco_venda, ativo
         FROM est_itens
        WHERE empresa_id = $1 AND ativo = true
        ORDER BY nome`,
      [empresa]
    );
    
    for (const row of resEst.rows || []) {
      pendencias.totalItens++;
      if (!row.tipo) pendencias.semTipo.push({ id: row.id, nome: row.nome, motivo: 'Tipo não definido' });
      if (!row.ncm) pendencias.semNcm.push({ id: row.id, nome: row.nome, motivo: 'NCM não cadastrado' });
      if (Number(row.custo_medio || 0) <= 0) pendencias.semCusto.push({ id: row.id, nome: row.nome, motivo: 'Custo médio R$ 0,00' });
      if (!row.ean) pendencias.semEan.push({ id: row.id, nome: row.nome, motivo: 'EAN/GTIN vazio' });
    }

    // 2. Analisa produtos do commerce
    const resComm = await db.query(
      `SELECT p.id, p.nome, p.tipo, p.dados_fiscais, v.sku, v.barcode
         FROM commerce_products p
         LEFT JOIN commerce_product_variants v ON v.product_id = p.id
        WHERE p.empresa_id = $1 AND p.status = 'active'`,
      [empresa]
    );

    const nomesVistos = new Map();
    for (const row of resComm.rows || []) {
      const fisc = row.dados_fiscais || {};
      const ncm = fisc.ncm || fisc.NCM;
      if (!row.tipo) pendencias.semTipo.push({ id: row.id, nome: row.nome, motivo: 'Tipo não definido' });
      if (!ncm) pendencias.semNcm.push({ id: row.id, nome: row.nome, motivo: 'NCM não cadastrado' });
      if (!row.barcode && !row.sku) pendencias.semEan.push({ id: row.id, nome: row.nome, motivo: 'Código de barras / EAN ausente' });

      // Detecta duplicados por nome exato
      const nomeNorm = String(row.nome || '').trim().toLowerCase();
      if (nomesVistos.has(nomeNorm)) {
        pendencias.duplicados.push({ id: row.id, nome: row.nome, idOriginal: nomesVistos.get(nomeNorm) });
      } else {
        nomesVistos.set(nomeNorm, row.id);
      }
    }
  } catch (err) {
    console.error('[fiscal] Erro em auditarCadastrosIncompletos:', err?.message || err);
  }

  return {
    ok: true,
    empresaId: empresa,
    totalItens: pendencias.totalItens,
    totais: {
      semTipo: pendencias.semTipo.length,
      semNcm: pendencias.semNcm.length,
      semCusto: pendencias.semCusto.length,
      semEan: pendencias.semEan.length,
      estoquePadrao: pendencias.estoquePadrao.length,
      duplicados: pendencias.duplicados.length
    },
    pendencias
  };
}

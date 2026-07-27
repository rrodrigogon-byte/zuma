/**
 * PDV Multi-Operador — Offline-First com RBAC Granular
 * SetPoint Ultra · P4 do KYTTO ERP
 * Suporte: múltiplos caixas simultâneos, modo offline com sync, turno de operador
 */

import { db } from '../../core/database.js';
import { emitirDocumentoFiscal } from '../../core/fiscal-nfe.js';

// ─────────────────────────────────────────────────────────────────────────────
// PERMISSÕES RBAC DO PDV
// ─────────────────────────────────────────────────────────────────────────────

export const PERMISSOES_PDV = {
  ABRIR_CAIXA:          'pdv:abrir_caixa',
  FECHAR_CAIXA:         'pdv:fechar_caixa',
  REALIZAR_VENDA:       'pdv:realizar_venda',
  CANCELAR_VENDA:       'pdv:cancelar_venda',
  APLICAR_DESCONTO:     'pdv:aplicar_desconto',
  DESCONTO_ACIMA_10:    'pdv:desconto_acima_10',
  SANGRIA:              'pdv:sangria',
  SUPRIMENTO:           'pdv:suprimento',
  VER_RELATORIO_TURNO:  'pdv:ver_relatorio_turno',
  EMITIR_NFC_E:         'pdv:emitir_nfce',
  CANCELAR_NFC_E:       'pdv:cancelar_nfce',
  TROCAR_PRECO:         'pdv:trocar_preco',
  VENDA_FIADO:          'pdv:venda_fiado',
};

export const PERFIS_PDV = {
  operador: [
    PERMISSOES_PDV.REALIZAR_VENDA,
    PERMISSOES_PDV.EMITIR_NFC_E,
    PERMISSOES_PDV.APLICAR_DESCONTO,
  ],
  supervisor: [
    ...Object.values(PERMISSOES_PDV).filter(p => p !== PERMISSOES_PDV.FECHAR_CAIXA),
  ],
  gerente: Object.values(PERMISSOES_PDV),
};

export async function verificarPermissaoPdv(tenantId, usuarioId, permissao) {
  const pool = db.getPool();
  const res  = await pool.query(
    `SELECT u.perfil, u.permissoes_extras
     FROM usuarios u WHERE u.id = $1 AND u.empresa_id = $2`,
    [usuarioId, tenantId]
  );
  if (!res.rows[0]) return false;
  const { perfil, permissoes_extras } = res.rows[0];
  const perms = [...(PERFIS_PDV[perfil] || []), ...(permissoes_extras || [])];
  return perms.includes(permissao) || perms.includes('*');
}

// ─────────────────────────────────────────────────────────────────────────────
// TURNO DE OPERADOR
// ─────────────────────────────────────────────────────────────────────────────

export async function abrirTurno(tenantId, usuarioId, caixaId, fundoCaixa = 0) {
  const pool = db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar se caixa já tem turno aberto
    const turnoAberto = await client.query(
      `SELECT id FROM turnos_caixa
       WHERE empresa_id = $1 AND caixa_id = $2 AND status = 'aberto'`,
      [tenantId, caixaId]
    );
    if (turnoAberto.rows.length > 0) {
      throw new Error('Caixa já possui turno aberto');
    }

    const turno = await client.query(
      `INSERT INTO turnos_caixa
         (empresa_id, caixa_id, usuario_id, fundo_caixa, status, abertura_em)
       VALUES ($1, $2, $3, $4, 'aberto', NOW())
       RETURNING *`,
      [tenantId, caixaId, usuarioId, fundoCaixa]
    );

    // Registrar suprimento inicial
    if (fundoCaixa > 0) {
      await client.query(
        `INSERT INTO movimentacoes_caixa
           (empresa_id, caixa_id, turno_id, tipo, valor, descricao, usuario_id)
         VALUES ($1, $2, $3, 'suprimento', $4, 'Fundo de caixa inicial', $5)`,
        [tenantId, caixaId, turno.rows[0].id, fundoCaixa, usuarioId]
      );
    }

    await client.query('COMMIT');
    return turno.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function fecharTurno(tenantId, turnoId, usuarioId, conferencia) {
  const pool = db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Calcular totais do turno
    const totais = await client.query(
      `SELECT
         COALESCE(SUM(CASE WHEN v.status = 'finalizada' THEN v.valor_liquido ELSE 0 END), 0) AS total_vendas,
         COUNT(CASE WHEN v.status = 'finalizada' THEN 1 END) AS qtd_vendas,
         COUNT(CASE WHEN v.status = 'cancelada' THEN 1 END) AS qtd_canceladas
       FROM vendas v
       WHERE v.empresa_id = $1 AND v.turno_id = $2`,
      [tenantId, turnoId]
    );

    const pagamentos = await client.query(
      `SELECT fp.nome, SUM(p.valor) AS total
       FROM pagamentos p
       JOIN formas_pagamento fp ON fp.id = p.forma_pagamento_id
       JOIN vendas v ON v.id = p.venda_id
       WHERE v.empresa_id = $1 AND v.turno_id = $2 AND p.status = 'aprovado'
       GROUP BY fp.nome`,
      [tenantId, turnoId]
    );

    const movimentacoes = await client.query(
      `SELECT tipo, SUM(valor) AS total
       FROM movimentacoes_caixa
       WHERE empresa_id = $1 AND turno_id = $2
       GROUP BY tipo`,
      [tenantId, turnoId]
    );

    const turnoRes = await client.query(
      'SELECT * FROM turnos_caixa WHERE id = $1', [turnoId]
    );
    const turno = turnoRes.rows[0];

    const suprimentos = movimentacoes.rows.find(m => m.tipo === 'suprimento')?.total || 0;
    const sangrias    = movimentacoes.rows.find(m => m.tipo === 'sangria')?.total || 0;
    const dinheiro    = pagamentos.rows.find(p => p.nome?.toLowerCase().includes('dinheiro'))?.total || 0;
    const saldoEsperado = Number(turno.fundo_caixa) + Number(dinheiro) + Number(suprimentos) - Number(sangrias);
    const diferenca   = Number(conferencia.dinheiro_contado || 0) - saldoEsperado;

    await client.query(
      `UPDATE turnos_caixa SET
         status = 'fechado',
         fechamento_em = NOW(),
         total_vendas = $1,
         qtd_vendas = $2,
         saldo_esperado = $3,
         saldo_contado = $4,
         diferenca = $5,
         observacoes_fechamento = $6
       WHERE id = $7`,
      [
        totais.rows[0].total_vendas,
        totais.rows[0].qtd_vendas,
        saldoEsperado,
        conferencia.dinheiro_contado || 0,
        diferenca,
        conferencia.observacoes || '',
        turnoId
      ]
    );

    await client.query('COMMIT');
    return {
      turno_id: turnoId,
      total_vendas: totais.rows[0].total_vendas,
      qtd_vendas: totais.rows[0].qtd_vendas,
      qtd_canceladas: totais.rows[0].qtd_canceladas,
      pagamentos_por_forma: pagamentos.rows,
      saldo_esperado: saldoEsperado,
      saldo_contado: conferencia.dinheiro_contado || 0,
      diferenca,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDA PDV — Fluxo completo com emissão de NFC-e
// ─────────────────────────────────────────────────────────────────────────────

export async function iniciarVenda(tenantId, usuarioId, caixaId, segmento = 'varejo') {
  const pool = db.getPool();

  // Verificar turno aberto
  const turno = await pool.query(
    `SELECT id FROM turnos_caixa
     WHERE empresa_id = $1 AND caixa_id = $2 AND status = 'aberto' AND usuario_id = $3`,
    [tenantId, caixaId, usuarioId]
  );
  if (!turno.rows[0]) throw new Error('Operador sem turno aberto neste caixa');

  // Próximo número de venda
  const numRes = await pool.query(
    `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(numero_venda, '[^0-9]', '', 'g') AS BIGINT)), 0) + 1 AS proximo
     FROM vendas WHERE empresa_id = $1`,
    [tenantId]
  );
  const numero = `V${new Date().getFullYear()}${String(numRes.rows[0].proximo).padStart(8, '0')}`;

  const venda = await pool.query(
    `INSERT INTO vendas
       (empresa_id, numero_venda, usuario_vendedor_id, tipo_venda, status, turno_id, terminal_id, valor_bruto, valor_liquido)
     VALUES ($1, $2, $3, $4, 'aberta', $5, $6, 0, 0)
     RETURNING *`,
    [tenantId, numero, usuarioId, segmento, turno.rows[0].id, caixaId]
  );

  return venda.rows[0];
}

export async function adicionarItem(tenantId, vendaId, item) {
  const pool = db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Buscar produto com dados fiscais
    const prodRes = await client.query(
      `SELECT p.*, pf.ncm, pf.cst_icms, pf.csosn, pf.aliquota_icms, pf.cst_pis, pf.aliquota_pis,
              pf.cst_cofins, pf.aliquota_cofins, pf.cfop_padrao_interno, pf.unidade_medida
       FROM produtos p
       LEFT JOIN produto_fiscal pf ON pf.produto_id = p.id AND pf.empresa_id = p.empresa_id
       WHERE p.id = $1 AND p.empresa_id = $2`,
      [item.produto_id, tenantId]
    );
    const produto = prodRes.rows[0];
    if (!produto) throw new Error('Produto não encontrado');

    // Resolver preço (promoção > tabela cliente > tabela loja > preço base)
    const preco = await resolverPreco(client, tenantId, item.produto_id, item.cliente_id, item.loja_id);

    const valorTotal = Number(item.quantidade) * preco - (item.desconto || 0);

    const itemRes = await client.query(
      `INSERT INTO itens_venda
         (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_item, lote)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [vendaId, item.produto_id, item.quantidade, preco, valorTotal, item.desconto || 0, item.lote || null]
    );

    // Atualizar total da venda
    await client.query(
      `UPDATE vendas SET
         valor_bruto = (SELECT SUM(valor_total + desconto_item) FROM itens_venda WHERE venda_id = $1),
         valor_liquido = (SELECT SUM(valor_total) FROM itens_venda WHERE venda_id = $1)
       WHERE id = $1`,
      [vendaId]
    );

    await client.query('COMMIT');
    return { ...itemRes.rows[0], produto_nome: produto.nome, preco_resolvido: preco };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function resolverPreco(client, tenantId, produtoId, clienteId, lojaId) {
  // 1. Promoção vigente
  const promo = await client.query(
    `SELECT tpi.preco_promocional
     FROM tabela_preco_item tpi
     JOIN tabela_preco tp ON tp.id = tpi.tabela_id
     WHERE tpi.produto_id = $1 AND tp.empresa_id = $2
       AND tpi.preco_promocional IS NOT NULL
       AND CURRENT_DATE BETWEEN COALESCE(tpi.promocao_inicio, CURRENT_DATE) AND COALESCE(tpi.promocao_fim, CURRENT_DATE)
     ORDER BY tpi.preco_promocional ASC LIMIT 1`,
    [produtoId, tenantId]
  );
  if (promo.rows[0]) return Number(promo.rows[0].preco_promocional);

  // 2. Tabela do cliente (se informado)
  if (clienteId) {
    const tabelaCliente = await client.query(
      `SELECT tpi.preco FROM tabela_preco_item tpi
       JOIN tabela_preco tp ON tp.id = tpi.tabela_id
       JOIN clientes c ON c.tabela_preco_id = tp.id
       WHERE tpi.produto_id = $1 AND c.id = $2 AND tp.ativa = true LIMIT 1`,
      [produtoId, clienteId]
    );
    if (tabelaCliente.rows[0]) return Number(tabelaCliente.rows[0].preco);
  }

  // 3. Tabela da loja
  if (lojaId) {
    const tabelaLoja = await client.query(
      `SELECT tpi.preco FROM tabela_preco_item tpi
       WHERE tpi.produto_id = $1 AND tpi.loja_id = $2 LIMIT 1`,
      [produtoId, lojaId]
    );
    if (tabelaLoja.rows[0]) return Number(tabelaLoja.rows[0].preco);
  }

  // 4. Preço base do produto
  const base = await client.query(
    'SELECT preco_venda FROM produtos WHERE id = $1', [produtoId]
  );
  return Number(base.rows[0]?.preco_venda || 0);
}

export async function finalizarVenda(tenantId, vendaId, pagamentos, opcoes = {}) {
  const pool = db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const vendaRes = await client.query(
      'SELECT * FROM vendas WHERE id = $1 AND empresa_id = $2 FOR UPDATE',
      [vendaId, tenantId]
    );
    const venda = vendaRes.rows[0];
    if (!venda) throw new Error('Venda não encontrada');
    if (venda.status !== 'aberta') throw new Error(`Venda já está ${venda.status}`);

    // Registrar pagamentos
    let totalPago = 0;
    for (const pag of pagamentos) {
      await client.query(
        `INSERT INTO pagamentos
           (empresa_id, venda_id, forma_pagamento_id, valor, status, usuario_id, parcelas, parcela_numero)
         VALUES ($1, $2, $3, $4, 'aprovado', $5, $6, 1)`,
        [tenantId, vendaId, pag.forma_pagamento_id, pag.valor, venda.usuario_vendedor_id, pag.parcelas || 1]
      );
      totalPago += Number(pag.valor);
    }

    const troco = Math.max(0, totalPago - Number(venda.valor_liquido));

    // Baixar estoque
    const itens = await client.query(
      'SELECT * FROM itens_venda WHERE venda_id = $1', [vendaId]
    );
    for (const item of itens.rows) {
      await client.query(
        `UPDATE estoque SET quantidade = quantidade - $1
         WHERE empresa_id = $2 AND produto_id = $3
         AND quantidade >= $1`,
        [item.quantidade, tenantId, item.produto_id]
      );
    }

    // Finalizar venda
    await client.query(
      `UPDATE vendas SET status = 'finalizada', finalizada_em = NOW()
       WHERE id = $1`,
      [vendaId]
    );

    await client.query('COMMIT');

    // Emitir NFC-e (assíncrono, não bloqueia o caixa)
    let nfce = null;
    if (opcoes.emitir_nfce !== false) {
      try {
        nfce = await emitirNfceVenda(tenantId, vendaId, opcoes);
      } catch (err) {
        console.error(`[PDV] Erro ao emitir NFC-e para venda ${vendaId}:`, err.message);
        // Não falhar a venda por erro fiscal — registrar para reprocessamento
        nfce = { contingencia: true, erro: err.message };
      }
    }

    return { venda_id: vendaId, numero: venda.numero_venda, troco, nfce };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function emitirNfceVenda(tenantId, vendaId, opcoes) {
  const pool = db.getPool();
  const [vendaRes, itensRes, pagRes, empRes] = await Promise.all([
    pool.query('SELECT * FROM vendas WHERE id = $1', [vendaId]),
    pool.query(`SELECT iv.*, p.nome as descricao, p.codigo_interno as codigo,
                       pf.ncm, pf.cst_icms, pf.csosn, pf.aliquota_icms,
                       pf.cst_pis, pf.aliquota_pis, pf.cst_cofins, pf.aliquota_cofins,
                       pf.cfop_padrao_interno as cfop, pf.unidade_medida as unidade
                FROM itens_venda iv
                JOIN produtos p ON p.id = iv.produto_id
                LEFT JOIN produto_fiscal pf ON pf.produto_id = iv.produto_id AND pf.empresa_id = p.empresa_id
                WHERE iv.venda_id = $1`, [vendaId]),
    pool.query(`SELECT p.valor, fp.codigo_tpag, fp.nome
                FROM pagamentos p
                JOIN formas_pagamento fp ON fp.id = p.forma_pagamento_id
                WHERE p.venda_id = $1`, [vendaId]),
    pool.query('SELECT * FROM empresas WHERE id = $1', [tenantId]),
  ]);

  const venda   = vendaRes.rows[0];
  const empresa = empRes.rows[0];

  const dadosNfce = {
    modelo: '65',
    ambiente: opcoes.ambiente || empresa.ambiente_fiscal || 'homologacao',
    venda_id: vendaId,
    empresa,
    itens: itensRes.rows.map(i => ({
      codigo: i.codigo,
      descricao: i.descricao,
      ncm: i.ncm,
      cfop: i.cfop || '5102',
      unidade: i.unidade || 'UN',
      quantidade: i.quantidade,
      valor_unitario: i.valor_unitario,
      valor_total: i.valor_total,
      cst_icms: i.cst_icms,
      csosn: i.csosn,
      aliquota_icms: i.aliquota_icms,
      cst_pis: i.cst_pis,
      aliquota_pis: i.aliquota_pis,
      cst_cofins: i.cst_cofins,
      aliquota_cofins: i.aliquota_cofins,
    })),
    pagamentos: pagRes.rows,
    totais: {
      valor_produtos: venda.valor_bruto,
      desconto: Number(venda.valor_desconto || 0),
      valor_total: venda.valor_liquido,
    },
    info: { numero: 0, natureza_operacao: 'VENDA A CONSUMIDOR' },
  };

  // Certificado: descriptografar em memória
  if (empresa.certificado_a1_encrypted) {
    const pfxBuffer = Buffer.from(empresa.certificado_a1_encrypted, 'base64');
    const senha = empresa.certificado_a1_senha_enc; // Em produção: descriptografar com KMS
    return emitirDocumentoFiscal(tenantId, dadosNfce, pfxBuffer, senha);
  }

  // Sem certificado: modo contingência
  return { contingencia: true, motivo: 'Certificado digital não configurado' };
}

export async function cancelarVenda(tenantId, vendaId, usuarioId, motivo) {
  const pool = db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const venda = await client.query(
      'SELECT * FROM vendas WHERE id = $1 AND empresa_id = $2 FOR UPDATE',
      [vendaId, tenantId]
    );
    if (!venda.rows[0]) throw new Error('Venda não encontrada');
    if (venda.rows[0].status !== 'finalizada') throw new Error('Apenas vendas finalizadas podem ser canceladas');

    // Estornar estoque
    const itens = await client.query('SELECT * FROM itens_venda WHERE venda_id = $1', [vendaId]);
    for (const item of itens.rows) {
      await client.query(
        `UPDATE estoque SET quantidade = quantidade + $1
         WHERE empresa_id = $2 AND produto_id = $3`,
        [item.quantidade, tenantId, item.produto_id]
      );
    }

    await client.query(
      `UPDATE vendas SET status = 'cancelada', cancelada_em = NOW(), motivo_cancelamento = $1
       WHERE id = $2`,
      [motivo, vendaId]
    );

    await client.query('COMMIT');
    return { sucesso: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SANGRIA E SUPRIMENTO
// ─────────────────────────────────────────────────────────────────────────────

export async function registrarMovimentacaoCaixa(tenantId, caixaId, turnoId, tipo, valor, descricao, usuarioId) {
  const pool = db.getPool();
  return pool.query(
    `INSERT INTO movimentacoes_caixa
       (empresa_id, caixa_id, turno_id, tipo, valor, descricao, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [tenantId, caixaId, turnoId, tipo, valor, descricao, usuarioId]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SINCRONIZAÇÃO OFFLINE — receber lote de vendas do terminal local
// ─────────────────────────────────────────────────────────────────────────────

export async function sincronizarVendasOffline(tenantId, vendasOffline) {
  const resultados = [];
  for (const venda of vendasOffline) {
    try {
      // Verificar se já foi sincronizada (idempotência por uuid_offline)
      const pool = db.getPool();
      const existe = await pool.query(
        'SELECT id FROM vendas WHERE empresa_id = $1 AND uuid_offline = $2',
        [tenantId, venda.uuid_offline]
      );
      if (existe.rows[0]) {
        resultados.push({ uuid_offline: venda.uuid_offline, status: 'ja_sincronizada' });
        continue;
      }

      // Processar venda offline
      const vendaId = await processarVendaOffline(tenantId, venda);
      resultados.push({ uuid_offline: venda.uuid_offline, venda_id: vendaId, status: 'sincronizada' });
    } catch (err) {
      resultados.push({ uuid_offline: venda.uuid_offline, status: 'erro', erro: err.message });
    }
  }
  return resultados;
}

async function processarVendaOffline(tenantId, vendaOffline) {
  const pool = db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const venda = await client.query(
      `INSERT INTO vendas
         (empresa_id, numero_venda, usuario_vendedor_id, tipo_venda, status, uuid_offline,
          valor_bruto, valor_desconto, valor_liquido, finalizada_em)
       VALUES ($1, $2, $3, $4, 'finalizada', $5, $6, $7, $8, $9)
       RETURNING id`,
      [tenantId, vendaOffline.numero_venda, vendaOffline.usuario_id, vendaOffline.tipo_venda,
       vendaOffline.uuid_offline, vendaOffline.valor_bruto, vendaOffline.valor_desconto || 0,
       vendaOffline.valor_liquido, new Date(vendaOffline.finalizada_em)]
    );
    const vendaId = venda.rows[0].id;

    for (const item of vendaOffline.itens) {
      await client.query(
        `INSERT INTO itens_venda (venda_id, produto_id, quantidade, valor_unitario, valor_total)
         VALUES ($1, $2, $3, $4, $5)`,
        [vendaId, item.produto_id, item.quantidade, item.valor_unitario, item.valor_total]
      );
    }

    for (const pag of vendaOffline.pagamentos) {
      await client.query(
        `INSERT INTO pagamentos (empresa_id, venda_id, forma_pagamento_id, valor, status, usuario_id)
         VALUES ($1, $2, $3, $4, 'aprovado', $5)`,
        [tenantId, vendaId, pag.forma_pagamento_id, pag.valor, vendaOffline.usuario_id]
      );
    }

    await client.query('COMMIT');
    return vendaId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

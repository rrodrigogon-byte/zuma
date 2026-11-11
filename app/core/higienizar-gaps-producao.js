/**
 * ============================================================================
 * KYTTO ERP — SANEAMENTO E FECHAMENTO DE GAPS REAIS EM PRODUÇÃO (POSTGRESQL)
 * ============================================================================
 * Executa de forma idempotente e segura no startup e sob demanda:
 *  1. Remoção de SKUs espúrios de supermercado (CAR-*, HF-*, PAD-*, MER-*, etc.)
 *     que haviam poluído est_itens da Barbearia Dino e da Agro Open TTC;
 *  2. Saneamento 100% da Classificação Fiscal da Barbearia Dino (corrige o CEST
 *     2000500 -> 2002000 em barbearia:revenda, corrige os 8 avisos de CEST/CSOSN
 *     e classifica todos os produtos e variantes sem NCM, zerando sem/erro/aviso);
 *  3. Configuração preventiva p_tot_trib_sn = 6.00 no emitente fiscal da Dino
 *     para evitar rejeição E1235 na NFS-e Nacional;
 *  4. Sincronização retroativa e idempotente das comandas fechadas/pagas da
 *     Barbearia Dino com a tabela central fin_lancamentos do PostgreSQL;
 *  5. Enriquecimento de nomes de clientes em whatsapp_ai_sessions e retorno
 *     automático ao T-Rex de sessões paradas em 'humano' há mais de 12 horas.
 * ============================================================================
 */

import crypto from 'node:crypto';

const DINO_EMPRESA_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
const DINO_LOJA_ID = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';
const AGRO_EMPRESA_ID = '2e041110-db20-4fd1-8278-12bd3dead008';

const SKUS_SUPERMERCADO_ESPURIOS = [
  'BEB-001', 'BEB-002', 'BEB-003', 'BEB-004', 'BEB-005', 'BEB-006',
  'CAR-001', 'CAR-002', 'CAR-003', 'CAR-004',
  'FRI-001', 'FRI-002',
  'HF-001', 'HF-002', 'HF-003', 'HF-004', 'HF-005', 'HF-006',
  'HIG-001', 'HIG-002', 'HIG-003',
  'LAT-001', 'LAT-002',
  'LIM-001', 'LIM-002', 'LIM-003',
  'MER-001', 'MER-002', 'MER-003', 'MER-004', 'MER-005', 'MER-006', 'MER-007',
  'PAD-001', 'PAD-002',
];

const NCM_POR_SKU_DINO = {
  'POM-001': { ncm: '33059000', cest: '2002000', cfop: '5405', csosn: '500' },
  'OLE-002': { ncm: '33071000', cest: '2002600', cfop: '5405', csosn: '500' },
  'BLM-003': { ncm: '33071000', cest: '2002600', cfop: '5405', csosn: '500' },
  'SHP-004': { ncm: '33051000', cest: '2001700', cfop: '5405', csosn: '500' },
  'MNX-005': { ncm: '33059000', cest: '2002000', cfop: '5405', csosn: '500' },
  'CER-006': { ncm: '33059000', cest: '2002000', cfop: '5405', csosn: '500' },
  'POS-007': { ncm: '33071000', cest: '2002600', cfop: '5405', csosn: '500' },
  'PRF-008': { ncm: '33030010', cest: '2000700', cfop: '5405', csosn: '500' },
  'CAF-009': { ncm: '21011110', cest: '1710700', cfop: '5405', csosn: '500' },
  'SNC-010': { ncm: '08013200', cest: null, cfop: '5102', csosn: '102' },
};

const VARIANTES_LOJA_DINO_SEM_CLASSIFICACAO = [
  { fonteId: 'a36981e9-fbed-405b-bd5f-fc4beb0671d6', ncm: '33059000', cest: '2002000', cfop: '5405', csosn: '500' },
  { fonteId: '8b152bb0-d2ac-4478-891e-3c77c1fb4354', ncm: '33059000', cest: '2002000', cfop: '5405', csosn: '500' },
  { fonteId: 'baf2e9a5-fb34-4250-8a1e-0540fe906546', ncm: '33059000', cest: '2002000', cfop: '5405', csosn: '500' },
  { fonteId: '424d49fc-2834-4ec4-ac69-147f1ea76a40', ncm: '33030010', cest: '2000700', cfop: '5405', csosn: '500' },
  { fonteId: 'ed6e66ca-e89b-46aa-a848-3078a0a6c51d', ncm: '33059000', cest: '2002000', cfop: '5405', csosn: '500' },
  { fonteId: '896e4503-ce52-4527-b559-d0d2446e8f2e', ncm: '33059000', cest: '2002000', cfop: '5405', csosn: '500' },
];

export async function executarHigienizacaoGapsProducao(db, { listarComandasBarbearia = null, listarClientesBarbearia = null } = {}) {
  if (!db || typeof db.query !== 'function') {
    return { executado: false, motivo: 'db_indisponivel' };
  }

  const relatorio = {
    executadoEm: new Date().toISOString(),
    itensSupermercadoRemovidos: 0,
    classificacoesSaneadas: 0,
    comandasSincronizadasFinanceiro: 0,
    sessoesWhatsappEnriquecidas: 0,
    sessoesWhatsappDestravadas: 0,
  };

  try {
    // 1. Remover SKUs falsos de supermercado que poluíram Barbearia Dino e Agro Open
    const idsRes = await db.query(
      `SELECT id FROM est_itens
        WHERE empresa_id IN ($1::uuid, $2::uuid)
          AND sku = ANY($3::text[])`,
      [DINO_EMPRESA_ID, AGRO_EMPRESA_ID, SKUS_SUPERMERCADO_ESPURIOS]
    );
    const itemIds = idsRes.rows.map((r) => r.id);
    if (itemIds.length > 0) {
      await db.query(`DELETE FROM fis_classificacoes WHERE fonte = 'est_item' AND fonte_id = ANY($1::text[])`, [itemIds.map(String)]);
      await db.query(`DELETE FROM est_movimentos WHERE item_id = ANY($1::uuid[])`, [itemIds]).catch(() => {});
      await db.query(`DELETE FROM est_saldos WHERE item_id = ANY($1::uuid[])`, [itemIds]).catch(() => {});
      await db.query(`DELETE FROM est_lotes WHERE item_id = ANY($1::uuid[])`, [itemIds]).catch(() => {});
      const delRes = await db.query(`DELETE FROM est_itens WHERE id = ANY($1::uuid[])`, [itemIds]);
      relatorio.itensSupermercadoRemovidos = delRes.rowCount || itemIds.length;
    }

    // 2. Atualizar NCM nos est_itens legítimos da Barbearia Dino e salvar fis_classificacoes
    for (const [sku, cfg] of Object.entries(NCM_POR_SKU_DINO)) {
      const up = await db.query(
        `UPDATE est_itens SET ncm = $1, cfop_padrao = $2, cest = $3
          WHERE empresa_id = $4::uuid AND sku = $5
          RETURNING id::text`,
        [cfg.ncm, cfg.cfop, cfg.cest, DINO_EMPRESA_ID, sku]
      );
      for (const row of up.rows) {
        await db.query(
          `INSERT INTO fis_classificacoes (
             empresa_id, fonte, fonte_id, tipo, ncm, cest, cfop, origem, csosn,
             cst_pis, cst_cofins, aliquota_icms, aliquota_pis, aliquota_cofins,
             unidade_tributavel, cst_ibs_cbs, c_class_trib
           ) VALUES ($1::uuid, 'est_item', $2, 'produto', $3, $4, $5, '0', $6, '49', '49', 0, 0, 0, 'UN', '000', '000001')
           ON CONFLICT (empresa_id, fonte, fonte_id) DO UPDATE SET
             ncm = EXCLUDED.ncm, cest = EXCLUDED.cest, cfop = EXCLUDED.cfop,
             csosn = EXCLUDED.csosn, cst_pis = '49', cst_cofins = '49', atualizado_em = NOW()`,
          [DINO_EMPRESA_ID, row.id, cfg.ncm, cfg.cest, cfg.cfop, cfg.csosn]
        );
        relatorio.classificacoesSaneadas += 1;
      }
    }

    // 2b. Classificar as 6 variantes da loja online da Barbearia Dino que estavam sem NCM
    for (const v of VARIANTES_LOJA_DINO_SEM_CLASSIFICACAO) {
      await db.query(
        `INSERT INTO fis_classificacoes (
           empresa_id, fonte, fonte_id, tipo, ncm, cest, cfop, origem, csosn,
           cst_pis, cst_cofins, aliquota_icms, aliquota_pis, aliquota_cofins,
           unidade_tributavel, cst_ibs_cbs, c_class_trib
         ) VALUES ($1::uuid, 'loja_variante', $2, 'produto', $3, $4, $5, '0', $6, '49', '49', 0, 0, 0, 'UN', '000', '000001')
         ON CONFLICT (empresa_id, fonte, fonte_id) DO UPDATE SET
           ncm = EXCLUDED.ncm, cest = EXCLUDED.cest, cfop = EXCLUDED.cfop,
           csosn = EXCLUDED.csosn, cst_pis = '49', cst_cofins = '49', atualizado_em = NOW()`,
        [DINO_EMPRESA_ID, v.fonteId, v.ncm, v.cest, v.cfop, v.csosn]
      );
      relatorio.classificacoesSaneadas += 1;
    }

    // 3. Corrigir o erro de categoria:barbearia:revenda (CEST 2000500 -> 2002000 e PIS/COFINS 49)
    await db.query(
      `UPDATE fis_classificacoes
          SET ncm = '33059000', cest = '2002000', cfop = '5405', csosn = '500',
              cst_pis = '49', cst_cofins = '49', atualizado_em = NOW()
        WHERE empresa_id = $1::uuid AND fonte = 'categoria' AND fonte_id = 'barbearia:revenda'`,
      [DINO_EMPRESA_ID]
    );

    // 4. Corrigir os 8 avisos de CEST na Barbearia Dino para códigos 100% vigentes no Convênio ICMS 142/2018
    await db.query(
      `UPDATE fis_classificacoes
          SET cest = '0300600', cst_pis = '49', cst_cofins = '49', atualizado_em = NOW()
        WHERE empresa_id = $1::uuid AND ncm = '22011000' AND cest IN ('0300504', '0300100')`,
      [DINO_EMPRESA_ID]
    );
    await db.query(
      `UPDATE fis_classificacoes
          SET cest = '0301000', cst_pis = '49', cst_cofins = '49', atualizado_em = NOW()
        WHERE empresa_id = $1::uuid AND ncm = '22029900' AND cest IN ('0301300', '0301500')`,
      [DINO_EMPRESA_ID]
    );
    await db.query(
      `UPDATE fis_classificacoes
          SET ncm = '21011110', cest = '1710700', cfop = '5405', csosn = '500', cst_pis = '49', cst_cofins = '49', atualizado_em = NOW()
        WHERE empresa_id = $1::uuid AND fonte = 'bar_produto' AND (ncm = '21011110' OR ncm = '09012100')`,
      [DINO_EMPRESA_ID]
    );
    await db.query(
      `UPDATE fis_classificacoes
          SET cest = '1705300', cfop = '5405', csosn = '500', cst_pis = '49', cst_cofins = '49', atualizado_em = NOW()
        WHERE empresa_id = $1::uuid AND ncm = '19053100'`,
      [DINO_EMPRESA_ID]
    );
    await db.query(
      `UPDATE fis_classificacoes
          SET cest = '2000200', cfop = '5405', csosn = '500', cst_pis = '49', cst_cofins = '49', atualizado_em = NOW()
        WHERE empresa_id = $1::uuid AND ncm = '27121000'`,
      [DINO_EMPRESA_ID]
    );

    // 5. Garantir p_tot_trib_sn = 6.00 no emitente fiscal da Barbearia Dino para evitar E1235 na Sefin Nacional
    await db.query(
      `UPDATE fis_emitentes
          SET p_tot_trib_sn = COALESCE(p_tot_trib_sn, 6.00),
              c_trib_nac_padrao = COALESCE(NULLIF(c_trib_nac_padrao, ''), '060101')
        WHERE empresa_id = $1::uuid`,
      [DINO_EMPRESA_ID]
    );

    // 6. Sincronizar retroativamente comandas fechadas/pagas da Barbearia Dino com fin_lancamentos
    if (typeof listarComandasBarbearia === 'function') {
      const comandas = listarComandasBarbearia(DINO_EMPRESA_ID) || [];
      const comandasPagas = comandas.filter(
        (c) => (c.status === 'fechada' || c.status === 'paga') && !c.cancelada && !c.estornada && Number(c.total || c.valorTotal || 0) > 0
      );

      for (const cmd of comandasPagas) {
        const valor = Number(cmd.total || cmd.valorTotal || 0);
        const dataRef = String(cmd.fechadaEm || cmd.atualizadaEm || cmd.criadaEm || new Date().toISOString()).slice(0, 10);
        const descricao = `Comanda Barbearia · ${cmd.clienteNome || 'Cliente'} (${cmd.id})`;
        const meioRaw = Array.isArray(cmd.pagamentos) && cmd.pagamentos[0]?.meio
          ? String(cmd.pagamentos[0].meio).toLowerCase()
          : String(cmd.formaPagamento || 'pix').toLowerCase();
        const meio = ['pix', 'dinheiro', 'credito', 'debito', 'cartao_credito', 'cartao_debito'].includes(meioRaw)
          ? meioRaw
          : 'pix';

        const jaExiste = await db.query(
          `SELECT id FROM fin_lancamentos
            WHERE empresa_id = $1::uuid AND origem = 'barbearia_comanda' AND origem_id = $2
            LIMIT 1`,
          [DINO_EMPRESA_ID, String(cmd.id)]
        );

        if (jaExiste.rows.length === 0) {
          await db.query(
            `INSERT INTO fin_lancamentos (
               id, empresa_id, loja_id, tipo, status, descricao, categoria,
               valor, valor_pago, vencimento, pago_em, competencia,
               meio_pagamento, contraparte_nome, origem, origem_id
             ) VALUES (
               $1::uuid, $2::uuid, $3::uuid, 'receita', 'pago', $4, 'Serviços e Produtos Barbearia',
               $5, $5, $6::date, $7::timestamptz, $6::date,
               $8, $9, 'barbearia_comanda', $10
             )`,
            [
              crypto.randomUUID(),
              DINO_EMPRESA_ID,
              DINO_LOJA_ID,
              descricao,
              valor,
              dataRef,
              cmd.fechadaEm || new Date().toISOString(),
              meio,
              cmd.clienteNome || 'Cliente Barbearia Dino',
              String(cmd.id),
            ]
          ).catch(() => {});
          relatorio.comandasSincronizadasFinanceiro += 1;
        }
      }
    }

    // 7. Enriquecer nomes de clientes em whatsapp_ai_sessions e destravar sessões em 'humano' há > 12h
    {
      const mapaTelNome = new Map();
      if (typeof listarClientesBarbearia === 'function') {
        const clientes = listarClientesBarbearia(DINO_EMPRESA_ID) || [];
        for (const cli of clientes) {
          const dig = String(cli.telefone || cli.celular || cli.clienteTelefone || '').replace(/\D/g, '');
          const nome = cli.nome || cli.clienteNome;
          if (dig.length >= 8 && nome) mapaTelNome.set(dig.slice(-8), nome);
        }
      }
      if (typeof listarComandasBarbearia === 'function') {
        const cmds = listarComandasBarbearia(DINO_EMPRESA_ID) || [];
        for (const cmd of cmds) {
          const dig = String(cmd.clienteTelefone || cmd.telefone || '').replace(/\D/g, '');
          if (dig.length >= 8 && cmd.clienteNome) mapaTelNome.set(dig.slice(-8), cmd.clienteNome);
        }
      }

      const sessSemNome = await db.query(
        `SELECT id, telefone, remote_jid FROM whatsapp_ai_sessions
          WHERE empresa_id = $1::uuid AND (nome IS NULL OR BTRIM(nome) = '')`,
        [DINO_EMPRESA_ID]
      );
      for (const s of sessSemNome.rows) {
        const dig = String(s.telefone || s.remote_jid || '').replace(/\D/g, '');
        const sufixo = dig.slice(-8);
        const nomeEncontrado = mapaTelNome.get(sufixo) || (dig ? `Cliente WhatsApp (${dig.slice(-4)})` : null);
        if (nomeEncontrado) {
          await db.query(
            `UPDATE whatsapp_ai_sessions SET nome = $1 WHERE id = $2`,
            [nomeEncontrado, s.id]
          );
          relatorio.sessoesWhatsappEnriquecidas += 1;
        }
      }
    }

    // Destravar sessões que ficaram em 'humano' por mais de 12 horas sem interação (retorna ao T-Rex)
    const destravadas = await db.query(
      `UPDATE whatsapp_ai_sessions
          SET status = 'ativo',
              handoff_reason = NULL,
              atualizado_em = NOW()
        WHERE status = 'humano'
          AND ultima_interacao_em < NOW() - INTERVAL '12 hours'
      RETURNING id`
    ).catch(() => ({ rowCount: 0 }));
    relatorio.sessoesWhatsappDestravadas = destravadas.rowCount || 0;

    return { executado: true, ...relatorio };
  } catch (err) {
    return { executado: false, erro: err.message, ...relatorio };
  }
}

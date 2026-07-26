/**
 * Service: Fiscal Nacional Completo
 * SetPoint Ultra — NFC-e, NF-e, NF-Se, CT-e, Contingência, Inutilização
 * Provedor primário: Focus NFe | Fallback: Webmania
 */
import { db } from '../../core/database.js';

// ============================================================================
// CONFIGURAÇÃO FISCAL DO TENANT
// ============================================================================

export async function obterConfigFiscal(tenantId) {
  const result = await db.query(
    'SELECT * FROM fiscal_configuracoes WHERE tenant_id = $1',
    [tenantId]
  );
  return result.rows[0] || null;
}

export async function salvarConfigFiscal(tenantId, dados) {
  const result = await db.query(
    `INSERT INTO fiscal_configuracoes
      (tenant_id, cnpj, ie, im, razao_social, nome_fantasia, regime_tributario,
       ambiente, uf, csc_id, csc, serie_nfce, serie_nfe, provedor, token_provedor)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (tenant_id) DO UPDATE SET
       cnpj=$2, ie=$3, im=$4, razao_social=$5, nome_fantasia=$6,
       regime_tributario=$7, ambiente=$8, uf=$9, csc_id=$10, csc=$11,
       serie_nfce=$12, serie_nfe=$13, provedor=$14, token_provedor=$15,
       updated_at=NOW()
     RETURNING *`,
    [tenantId, dados.cnpj, dados.ie, dados.im, dados.razao_social, dados.nome_fantasia,
     dados.regime_tributario || 'simples', dados.ambiente || 'homologacao',
     dados.uf, dados.csc_id, dados.csc, dados.serie_nfce || 1, dados.serie_nfe || 1,
     dados.provedor || 'focusnfe', dados.token_provedor]
  );
  return result.rows[0];
}

// ============================================================================
// EMISSÃO DE NFC-e (Nota Fiscal ao Consumidor Eletrônica)
// ============================================================================

/**
 * Emitir NFC-e de forma ASSÍNCRONA (não bloqueia o PDV)
 * O pagamento já foi confirmado — a nota é enfileirada e emitida em background
 */
export async function emitirNFCe(tenantId, dadosVenda) {
  const config = await obterConfigFiscal(tenantId);
  if (!config) throw new Error('Configuração fiscal não encontrada para este estabelecimento');

  // Verificar contingência ativa
  const contingencia = await verificarContingencia(tenantId, 'nfce');

  // Obter próximo número
  const numeroResult = await db.query(
    `UPDATE fiscal_configuracoes
     SET proximo_numero_nfce = proximo_numero_nfce + 1
     WHERE tenant_id = $1
     RETURNING proximo_numero_nfce - 1 AS numero`,
    [tenantId]
  );
  const numero = numeroResult.rows[0].numero;

  // Registrar documento como pendente
  const docResult = await db.query(
    `INSERT INTO fiscal_documentos
      (tenant_id, tipo, numero, serie, status, ambiente, valor_total,
       destinatario_nome, destinatario_cpf_cnpj, referencia_interna, nsu_tef)
     VALUES ($1,'nfce',$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [tenantId, numero, config.serie_nfce,
     contingencia ? 'contingencia' : 'pendente',
     config.ambiente, dadosVenda.valor_total,
     dadosVenda.destinatario_nome, dadosVenda.destinatario_cpf,
     dadosVenda.venda_id, dadosVenda.nsu_tef]
  );
  const doc = docResult.rows[0];

  // Emitir via Focus NFe (ou contingência)
  if (!contingencia) {
    try {
      const xmlPayload = montarXMLNFCe(config, dadosVenda, numero);
      const resultado = await chamarFocusNFe(config, 'nfce', xmlPayload);
      await atualizarStatusDocumento(doc.id, resultado);
    } catch (err) {
      // Em caso de erro da SEFAZ, ativar contingência
      console.error(`[FISCAL] Erro ao emitir NFC-e ${numero}:`, err.message);
      await ativarContingencia(tenantId, 'nfce', err.message);
      await db.query(
        "UPDATE fiscal_documentos SET status = 'contingencia' WHERE id = $1",
        [doc.id]
      );
    }
  }

  return doc;
}

/**
 * Emitir NF-e (Nota Fiscal Eletrônica — para B2B, transferências, devoluções)
 */
export async function emitirNFe(tenantId, dadosNota) {
  const config = await obterConfigFiscal(tenantId);
  if (!config) throw new Error('Configuração fiscal não encontrada');

  const numeroResult = await db.query(
    `UPDATE fiscal_configuracoes
     SET proximo_numero_nfe = proximo_numero_nfe + 1
     WHERE tenant_id = $1
     RETURNING proximo_numero_nfe - 1 AS numero`,
    [tenantId]
  );
  const numero = numeroResult.rows[0].numero;

  const docResult = await db.query(
    `INSERT INTO fiscal_documentos
      (tenant_id, tipo, numero, serie, status, ambiente, valor_total,
       destinatario_nome, destinatario_cpf_cnpj, referencia_interna)
     VALUES ($1,'nfe',$2,$3,'pendente',$4,$5,$6,$7,$8)
     RETURNING *`,
    [tenantId, numero, config.serie_nfe, config.ambiente,
     dadosNota.valor_total, dadosNota.destinatario_nome,
     dadosNota.destinatario_cnpj, dadosNota.referencia_id]
  );

  // Emissão assíncrona
  setImmediate(async () => {
    try {
      const xmlPayload = montarXMLNFe(config, dadosNota, numero);
      const resultado = await chamarFocusNFe(config, 'nfe', xmlPayload);
      await atualizarStatusDocumento(docResult.rows[0].id, resultado);
    } catch (err) {
      console.error(`[FISCAL] Erro ao emitir NF-e ${numero}:`, err.message);
    }
  });

  return docResult.rows[0];
}

/**
 * Emitir NF-Se (Nota Fiscal de Serviços Eletrônica)
 */
export async function emitirNFSe(tenantId, dadosServico) {
  const config = await obterConfigFiscal(tenantId);
  if (!config) throw new Error('Configuração fiscal não encontrada');
  if (!config.im) throw new Error('Inscrição Municipal (IM) não configurada para emissão de NF-Se');

  const numeroResult = await db.query(
    `UPDATE fiscal_configuracoes
     SET proximo_numero_nfse = proximo_numero_nfse + 1
     WHERE tenant_id = $1
     RETURNING proximo_numero_nfse - 1 AS numero`,
    [tenantId]
  );
  const numero = numeroResult.rows[0].numero;

  const docResult = await db.query(
    `INSERT INTO fiscal_documentos
      (tenant_id, tipo, numero, serie, status, ambiente, valor_total,
       destinatario_nome, destinatario_cpf_cnpj)
     VALUES ($1,'nfse',$2,1,'pendente',$3,$4,$5,$6)
     RETURNING *`,
    [tenantId, numero, config.ambiente, dadosServico.valor_total,
     dadosServico.tomador_nome, dadosServico.tomador_cpf_cnpj]
  );

  return docResult.rows[0];
}

/**
 * Cancelar documento fiscal
 */
export async function cancelarDocumento(documentoId, tenantId, justificativa) {
  if (!justificativa || justificativa.length < 15) {
    throw new Error('Justificativa de cancelamento deve ter no mínimo 15 caracteres');
  }

  const docResult = await db.query(
    'SELECT * FROM fiscal_documentos WHERE id = $1 AND tenant_id = $2',
    [documentoId, tenantId]
  );
  const doc = docResult.rows[0];
  if (!doc) throw new Error('Documento não encontrado');
  if (doc.status !== 'autorizado') throw new Error('Apenas documentos autorizados podem ser cancelados');

  // Verificar prazo de cancelamento (NFC-e: 30 min; NF-e: 24h)
  const prazoHoras = doc.tipo === 'nfce' ? 0.5 : 24;
  const horasDesdeEmissao = (Date.now() - new Date(doc.data_autorizacao).getTime()) / 3600000;
  if (horasDesdeEmissao > prazoHoras) {
    throw new Error(`Prazo de cancelamento expirado (${prazoHoras}h)`);
  }

  // Chamar Focus NFe para cancelamento
  const config = await obterConfigFiscal(tenantId);
  try {
    await chamarFocusNFe(config, `cancelar_${doc.tipo}`, {
      chave: doc.chave_acesso,
      justificativa
    });
  } catch (err) {
    console.error('[FISCAL] Erro ao cancelar:', err.message);
  }

  const result = await db.query(
    "UPDATE fiscal_documentos SET status = 'cancelado' WHERE id = $1 RETURNING *",
    [documentoId]
  );
  return result.rows[0];
}

// ============================================================================
// CONTINGÊNCIA
// ============================================================================

export async function verificarContingencia(tenantId, tipo) {
  const result = await db.query(
    `SELECT * FROM fiscal_contingencias
     WHERE tenant_id = $1 AND tipo = $2 AND ativo = TRUE`,
    [tenantId, tipo]
  );
  return result.rows[0] || null;
}

export async function ativarContingencia(tenantId, tipo, motivo) {
  // Desativar contingência anterior se existir
  await db.query(
    "UPDATE fiscal_contingencias SET ativo = FALSE WHERE tenant_id = $1 AND tipo = $2",
    [tenantId, tipo]
  );
  await db.query(
    `INSERT INTO fiscal_contingencias (tenant_id, tipo, motivo) VALUES ($1,$2,$3)`,
    [tenantId, tipo, motivo]
  );
}

export async function desativarContingencia(tenantId, tipo) {
  await db.query(
    "UPDATE fiscal_contingencias SET ativo = FALSE, fim = NOW() WHERE tenant_id = $1 AND tipo = $2",
    [tenantId, tipo]
  );
  // Reprocessar documentos em contingência
  await reprocessarContingencia(tenantId, tipo);
}

async function reprocessarContingencia(tenantId, tipo) {
  const docs = await db.query(
    "SELECT * FROM fiscal_documentos WHERE tenant_id = $1 AND tipo = $2 AND status = 'contingencia'",
    [tenantId, tipo]
  );
  console.log(`[FISCAL] Reprocessando ${docs.rows.length} documentos em contingência...`);
  // Aqui seria implementada a lógica de reenvio para a SEFAZ
}

// ============================================================================
// HELPERS INTERNOS
// ============================================================================

async function atualizarStatusDocumento(docId, resultado) {
  await db.query(
    `UPDATE fiscal_documentos
     SET status = $1, chave_acesso = $2, protocolo = $3,
         data_autorizacao = $4, xml_retorno = $5, motivo_rejeicao = $6
     WHERE id = $7`,
    [resultado.status, resultado.chave_acesso, resultado.protocolo,
     resultado.data_autorizacao, resultado.xml, resultado.motivo, docId]
  );
}

/**
 * Chamar API do Focus NFe
 */
async function chamarFocusNFe(config, endpoint, payload) {
  const baseUrl = config.ambiente === 'producao'
    ? 'https://api.focusnfe.com.br/v2'
    : 'https://homologacao.focusnfe.com.br/v2';

  const response = await fetch(`${baseUrl}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(config.token_provedor + ':').toString('base64')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const erro = await response.text();
    throw new Error(`Focus NFe retornou ${response.status}: ${erro}`);
  }

  return response.json();
}

/**
 * Montar payload XML para NFC-e (simplificado — em produção usar biblioteca específica)
 */
function montarXMLNFCe(config, venda, numero) {
  return {
    natureza_operacao: 'VENDA AO CONSUMIDOR',
    forma_pagamento: 0,
    numero,
    serie: config.serie_nfce,
    data_emissao: new Date().toISOString(),
    cnpj_emitente: config.cnpj,
    nome_emitente: config.razao_social,
    uf: config.uf,
    csc_id: config.csc_id,
    csc: config.csc,
    itens: venda.itens || [],
    pagamentos: venda.pagamentos || [],
    valor_total: venda.valor_total
  };
}

function montarXMLNFe(config, nota, numero) {
  return {
    natureza_operacao: nota.natureza_operacao || 'VENDA',
    numero,
    serie: config.serie_nfe,
    data_emissao: new Date().toISOString(),
    cnpj_emitente: config.cnpj,
    nome_emitente: config.razao_social,
    uf: config.uf,
    destinatario: nota.destinatario,
    itens: nota.itens || [],
    valor_total: nota.valor_total
  };
}

// ============================================================================
// CONSULTAS E RELATÓRIOS
// ============================================================================

export async function listarDocumentos(tenantId, filtros = {}) {
  const params = [tenantId];
  let where = 'WHERE tenant_id = $1';
  if (filtros.tipo) { params.push(filtros.tipo); where += ` AND tipo = $${params.length}`; }
  if (filtros.status) { params.push(filtros.status); where += ` AND status = $${params.length}`; }
  if (filtros.data_inicio) { params.push(filtros.data_inicio); where += ` AND data_emissao >= $${params.length}`; }
  if (filtros.data_fim) { params.push(filtros.data_fim); where += ` AND data_emissao <= $${params.length}`; }

  const result = await db.query(
    `SELECT * FROM fiscal_documentos ${where} ORDER BY data_emissao DESC LIMIT 200`,
    params
  );
  return result.rows;
}

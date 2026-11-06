// ============================================================================
// SERVIÇO CENTRAL KYTTO ERP 360
// Implementa os módulos de classe empresarial inspirados em ERPNext, Map-OS e Odoo:
// 1. Propostas Comerciais & Orçamentos (Cotações B2B/B2C)
// 2. Ordens de Serviço & Manutenção Universal (OS 360)
// 3. Expedição, Logística & Romaneio de Carga (Picking & Entregas)
// 4. Gestão de Patrimônio & Ativos Imobilizados (Tombamento & Depreciação)
// ============================================================================
import crypto from 'crypto';
import { ErroDominio, exigirTexto, exigirUuid } from '../acesso/banco.js';
import { db as getJsonDb, save as saveJsonDb } from '../../db.js';

let tablesCreated = false;

export async function bootstrapErpTables(db) {
  if (tablesCreated) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS erp_propostas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
        loja_id UUID REFERENCES lojas(id) ON DELETE SET NULL,
        numero VARCHAR(30) NOT NULL,
        versao INT DEFAULT 1,
        cliente_id UUID,
        cliente_nome VARCHAR(255) NOT NULL,
        cliente_documento VARCHAR(30),
        cliente_telefone VARCHAR(30),
        cliente_email VARCHAR(255),
        vendedor_nome VARCHAR(255),
        status VARCHAR(30) DEFAULT 'rascunho',
        data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
        validade_dias INT DEFAULT 15,
        data_validade DATE,
        condicao_pagamento VARCHAR(100),
        forma_pagamento VARCHAR(50),
        prazo_entrega VARCHAR(100),
        tipo_frete VARCHAR(20) DEFAULT 'sem_frete',
        valor_frete NUMERIC(12,2) DEFAULT 0,
        itens JSONB NOT NULL DEFAULT '[]',
        subtotal NUMERIC(12,2) DEFAULT 0,
        desconto_total NUMERIC(12,2) DEFAULT 0,
        valor_total NUMERIC(12,2) DEFAULT 0,
        observacoes TEXT,
        termos_garantia TEXT,
        faturado_em TIMESTAMPTZ,
        faturamento_ref VARCHAR(100),
        criado_por VARCHAR(100),
        criado_em TIMESTAMPTZ DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(empresa_id, numero)
      );

      CREATE TABLE IF NOT EXISTS erp_ordens_servico (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
        loja_id UUID REFERENCES lojas(id) ON DELETE SET NULL,
        numero VARCHAR(30) NOT NULL,
        cliente_id UUID,
        cliente_nome VARCHAR(255) NOT NULL,
        cliente_documento VARCHAR(30),
        cliente_telefone VARCHAR(30),
        cliente_email VARCHAR(255),
        tecnico_responsavel VARCHAR(255),
        status VARCHAR(30) DEFAULT 'aberta',
        prioridade VARCHAR(20) DEFAULT 'normal',
        equipamento_tipo VARCHAR(100),
        equipamento_marca VARCHAR(100),
        equipamento_modelo VARCHAR(100),
        equipamento_serie VARCHAR(100),
        equipamento_patrimonio VARCHAR(100),
        defeito_reclamado TEXT,
        laudo_tecnico TEXT,
        solucao_aplicada TEXT,
        checklist JSONB DEFAULT '[]',
        pecas JSONB DEFAULT '[]',
        servicos JSONB DEFAULT '[]',
        valor_pecas NUMERIC(12,2) DEFAULT 0,
        valor_servicos NUMERIC(12,2) DEFAULT 0,
        desconto NUMERIC(12,2) DEFAULT 0,
        valor_total NUMERIC(12,2) DEFAULT 0,
        data_abertura TIMESTAMPTZ DEFAULT NOW(),
        previsao_entrega DATE,
        data_conclusao TIMESTAMPTZ,
        garantia_dias INT DEFAULT 90,
        termo_garantia TEXT,
        assinatura_cliente TEXT,
        faturado_em TIMESTAMPTZ,
        faturamento_ref VARCHAR(100),
        criado_por VARCHAR(100),
        criado_em TIMESTAMPTZ DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(empresa_id, numero)
      );

      CREATE TABLE IF NOT EXISTS erp_romaneios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
        loja_id UUID REFERENCES lojas(id) ON DELETE SET NULL,
        numero VARCHAR(30) NOT NULL,
        data_saida DATE NOT NULL DEFAULT CURRENT_DATE,
        motorista_nome VARCHAR(255),
        veiculo_placa VARCHAR(20),
        veiculo_modelo VARCHAR(100),
        status VARCHAR(30) DEFAULT 'em_preparacao',
        entregas JSONB NOT NULL DEFAULT '[]',
        total_pedidos INT DEFAULT 0,
        total_volumes INT DEFAULT 0,
        valor_total_mercadorias NUMERIC(12,2) DEFAULT 0,
        valor_a_receber_destino NUMERIC(12,2) DEFAULT 0,
        observacoes TEXT,
        criado_por VARCHAR(100),
        criado_em TIMESTAMPTZ DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(empresa_id, numero)
      );

      CREATE TABLE IF NOT EXISTS erp_ativos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
        loja_id UUID REFERENCES lojas(id) ON DELETE SET NULL,
        codigo_tombamento VARCHAR(50) NOT NULL,
        descricao VARCHAR(255) NOT NULL,
        categoria VARCHAR(100) NOT NULL,
        marca VARCHAR(100),
        modelo VARCHAR(100),
        numero_serie VARCHAR(100),
        data_aquisicao DATE NOT NULL,
        valor_aquisicao NUMERIC(12,2) NOT NULL,
        vida_util_anos INT DEFAULT 5,
        taxa_depreciacao_anual NUMERIC(5,2) DEFAULT 20.00,
        nf_compra VARCHAR(50),
        fornecedor_nome VARCHAR(255),
        localizacao_setor VARCHAR(100),
        responsavel VARCHAR(255),
        estado_conservacao VARCHAR(30) DEFAULT 'otimo',
        historico_manutencoes JSONB DEFAULT '[]',
        criado_em TIMESTAMPTZ DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(empresa_id, codigo_tombamento)
      );
    `);
    tablesCreated = true;
  } catch (err) {
    console.warn('[KYTTO ERP] Tabelas já existentes ou banco somente leitura, seguindo com resiliência:', err.message);
    tablesCreated = true;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 1. PROPOSTAS COMERCIAIS & ORÇAMENTOS
// ────────────────────────────────────────────────────────────────────────────

export async function listarPropostas(db, empresaId, { status = '', busca = '', limit = 50, offset = 0 } = {}) {
  await bootstrapErpTables(db);
  try {
    let sql = 'SELECT * FROM erp_propostas WHERE empresa_id = $1';
    const params = [empresaId];
    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }
    if (busca) {
      params.push(`%${busca}%`);
      sql += ` AND (numero ILIKE $${params.length} OR cliente_nome ILIKE $${params.length} OR cliente_documento ILIKE $${params.length})`;
    }
    sql += ' ORDER BY criado_em DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);
    const res = await db.query(sql, params);
    return res.rows;
  } catch (err) {
    // Fallback JSON-DB
    const d = getJsonDb();
    d.erp_propostas ||= [];
    let list = d.erp_propostas.filter(p => p.empresa_id === empresaId);
    if (status) list = list.filter(p => p.status === status);
    if (busca) {
      const b = busca.toLowerCase();
      list = list.filter(p => (p.numero || '').toLowerCase().includes(b) || (p.cliente_nome || '').toLowerCase().includes(b));
    }
    return list.slice(offset, offset + limit);
  }
}

export async function obterProposta(db, empresaId, id) {
  await bootstrapErpTables(db);
  try {
    const res = await db.query('SELECT * FROM erp_propostas WHERE empresa_id = $1 AND id = $2', [empresaId, id]);
    if (res.rows[0]) return res.rows[0];
  } catch {}
  const d = getJsonDb();
  d.erp_propostas ||= [];
  const found = d.erp_propostas.find(p => p.empresa_id === empresaId && p.id === id);
  if (!found) throw new ErroDominio('NOT_FOUND', 'Proposta comercial não encontrada', 404);
  return found;
}

export async function salvarProposta(db, empresaId, dados, usuario = 'admin') {
  await bootstrapErpTables(db);
  const clienteNome = exigirTexto(dados.cliente_nome, 'Nome do cliente');
  const itens = Array.isArray(dados.itens) ? dados.itens : [];
  
  // Calcular totais
  let subtotal = 0;
  let descontoTotal = Number(dados.desconto_total || 0);
  let somaDescontoItens = 0;
  for (const it of itens) {
    const q = Number(it.quantidade || 1);
    const vu = Number(it.valor_unitario || 0);
    const desc = Number(it.valor_desconto || 0);
    somaDescontoItens += desc;
    const st = (q * vu) - desc;
    it.subtotal = Math.round(st * 100) / 100;
    subtotal += (q * vu);
  }
  subtotal = Math.round(subtotal * 100) / 100;
  if (!descontoTotal && somaDescontoItens > 0) {
    descontoTotal = Math.round(somaDescontoItens * 100) / 100;
  }
  const valorFrete = Number(dados.valor_frete || 0);
  const valorTotal = Math.max(0, Math.round((subtotal - descontoTotal + valorFrete) * 100) / 100);

  const agora = new Date();
  const validadeDias = Number(dados.validade_dias || 15);
  const dataValidade = new Date(agora.getTime() + validadeDias * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let id = dados.id;
  let numero = dados.numero;

  if (!id) {
    id = crypto.randomUUID();
    if (!numero) {
      const ano = agora.getFullYear();
      const countRes = await db.query('SELECT COUNT(*) as total FROM erp_propostas WHERE empresa_id = $1', [empresaId]).catch(() => ({ rows: [{ total: 0 }] }));
      const seq = Number(countRes.rows[0]?.total || 0) + 1;
      numero = `PROP-${ano}/${String(seq).padStart(4, '0')}`;
    }
  }

  const payload = {
    id,
    empresa_id: empresaId,
    loja_id: dados.loja_id || null,
    numero,
    versao: Number(dados.versao || 1),
    cliente_id: dados.cliente_id || null,
    cliente_nome: clienteNome,
    cliente_documento: dados.cliente_documento || '',
    cliente_telefone: dados.cliente_telefone || '',
    cliente_email: dados.cliente_email || '',
    vendedor_nome: dados.vendedor_nome || usuario,
    status: dados.status || 'rascunho',
    data_emissao: dados.data_emissao || agora.toISOString().split('T')[0],
    validade_dias: validadeDias,
    data_validade: dados.data_validade || dataValidade,
    condicao_pagamento: dados.condicao_pagamento || 'À vista',
    forma_pagamento: dados.forma_pagamento || 'Pix',
    prazo_entrega: dados.prazo_entrega || 'Imediato',
    tipo_frete: dados.tipo_frete || 'sem_frete',
    valor_frete: valorFrete,
    itens: JSON.stringify(itens),
    subtotal,
    desconto_total: descontoTotal,
    valor_total: valorTotal,
    observacoes: dados.observacoes || '',
    termos_garantia: dados.termos_garantia || 'Garantia de 90 dias para defeitos de fabricação conforme CDC.',
    criado_por: usuario,
    atualizado_em: agora.toISOString()
  };

  try {
    const sql = `
      INSERT INTO erp_propostas (
        id, empresa_id, loja_id, numero, versao, cliente_id, cliente_nome, cliente_documento, cliente_telefone, cliente_email,
        vendedor_nome, status, data_emissao, validade_dias, data_validade, condicao_pagamento, forma_pagamento,
        prazo_entrega, tipo_frete, valor_frete, itens, subtotal, desconto_total, valor_total, observacoes,
        termos_garantia, criado_por, atualizado_em
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28
      )
      ON CONFLICT (empresa_id, numero) DO UPDATE SET
        cliente_id = EXCLUDED.cliente_id,
        cliente_nome = EXCLUDED.cliente_nome,
        cliente_documento = EXCLUDED.cliente_documento,
        cliente_telefone = EXCLUDED.cliente_telefone,
        cliente_email = EXCLUDED.cliente_email,
        vendedor_nome = EXCLUDED.vendedor_nome,
        status = EXCLUDED.status,
        validade_dias = EXCLUDED.validade_dias,
        data_validade = EXCLUDED.data_validade,
        condicao_pagamento = EXCLUDED.condicao_pagamento,
        forma_pagamento = EXCLUDED.forma_pagamento,
        prazo_entrega = EXCLUDED.prazo_entrega,
        tipo_frete = EXCLUDED.tipo_frete,
        valor_frete = EXCLUDED.valor_frete,
        itens = EXCLUDED.itens,
        subtotal = EXCLUDED.subtotal,
        desconto_total = EXCLUDED.desconto_total,
        valor_total = EXCLUDED.valor_total,
        observacoes = EXCLUDED.observacoes,
        termos_garantia = EXCLUDED.termos_garantia,
        atualizado_em = NOW()
      RETURNING *;
    `;
    const res = await db.query(sql, Object.values(payload));
    payload.itens = itens;
    return res.rows[0] || payload;
  } catch (err) {
    console.warn('[KYTTO ERP] Salvando proposta no fallback json-db:', err.message);
    const d = getJsonDb();
    d.erp_propostas ||= [];
    payload.itens = itens;
    const idx = d.erp_propostas.findIndex(p => p.empresa_id === empresaId && p.id === id);
    if (idx >= 0) d.erp_propostas[idx] = payload;
    else d.erp_propostas.push(payload);
    saveJsonDb();
    return payload;
  }
}

export async function alterarStatusProposta(db, empresaId, id, { status, motivo = '' } = {}, usuario = 'admin') {
  await bootstrapErpTables(db);
  const statusValidos = ['rascunho', 'enviada', 'aprovada', 'rejeitada', 'cancelada', 'faturada'];
  if (!statusValidos.includes(status)) throw new ErroDominio('INVALID_STATUS', `Status inválido: ${status}`);

  try {
    const res = await db.query(
      `UPDATE erp_propostas SET status = $1, atualizado_em = NOW() WHERE empresa_id = $2 AND id = $3 RETURNING *`,
      [status, empresaId, id]
    );
    if (res.rows[0]) return res.rows[0];
  } catch {}

  const d = getJsonDb();
  d.erp_propostas ||= [];
  const p = d.erp_propostas.find(x => x.empresa_id === empresaId && x.id === id);
  if (!p) throw new ErroDominio('NOT_FOUND', 'Proposta não encontrada', 404);
  p.status = status;
  p.atualizado_em = new Date().toISOString();
  saveJsonDb();
  return p;
}

export async function converterPropostaEmVenda(db, empresaId, id, { destino = 'razao' } = {}, usuario = 'admin') {
  const proposta = await obterProposta(db, empresaId, id);
  if (proposta.status === 'faturada') throw new ErroDominio('ALREADY_BILLED', 'Esta proposta já foi faturada');

  const agora = new Date().toISOString();
  const valorTotal = Number(proposta.valor_total || 0);

  // 1. Criar lançamento a receber no razão financeiro se tabela existir
  let refLancamento = `PROPOSTA-${proposta.numero}`;
  try {
    const lancamentoId = crypto.randomUUID();
    await db.query(`
      INSERT INTO fin_lancamentos (
        id, empresa_id, loja_id, tipo, status, descricao, valor, data_competencia, data_vencimento,
        categoria_id, centro_custo_id, cliente_nome, documento_ref, criado_por
      ) VALUES (
        $1, $2, $3, 'receita', 'pendente', $4, $5, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
        NULL, NULL, $6, $7, $8
      ) ON CONFLICT DO NOTHING;
    `, [
      lancamentoId, empresaId, proposta.loja_id, `Recebimento Ref. ${proposta.numero} - ${proposta.cliente_nome}`,
      valorTotal, proposta.cliente_nome, proposta.numero, usuario
    ]);
    refLancamento = lancamentoId;
  } catch (err) {
    console.warn('[KYTTO ERP] Lançamento financeiro integrado:', err.message);
  }

  // 2. Marcar proposta como faturada
  try {
    await db.query(`
      UPDATE erp_propostas SET status = 'faturada', faturado_em = NOW(), faturamento_ref = $1 WHERE empresa_id = $2 AND id = $3
    `, [refLancamento, empresaId, id]);
  } catch {}

  const d = getJsonDb();
  d.erp_propostas ||= [];
  const p = d.erp_propostas.find(x => x.empresa_id === empresaId && x.id === id);
  if (p) {
    p.status = 'faturada';
    p.faturado_em = agora;
    p.faturamento_ref = refLancamento;
    saveJsonDb();
  }

  return {
    sucesso: true,
    mensagem: `Proposta ${proposta.numero} aprovada e faturada com sucesso! Lançamento a receber gerado no valor de R$ ${valorTotal.toFixed(2)}.`,
    propostaId: id,
    referenciaFinanceira: refLancamento
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. ORDENS DE SERVIÇO & MANUTENÇÃO (OS 360)
// ────────────────────────────────────────────────────────────────────────────

export async function listarOS(db, empresaId, { status = '', prioridade = '', busca = '', limit = 50, offset = 0 } = {}) {
  await bootstrapErpTables(db);
  try {
    let sql = 'SELECT * FROM erp_ordens_servico WHERE empresa_id = $1';
    const params = [empresaId];
    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }
    if (prioridade) {
      params.push(prioridade);
      sql += ` AND prioridade = $${params.length}`;
    }
    if (busca) {
      params.push(`%${busca}%`);
      sql += ` AND (numero ILIKE $${params.length} OR cliente_nome ILIKE $${params.length} OR equipamento_marca ILIKE $${params.length} OR equipamento_modelo ILIKE $${params.length})`;
    }
    sql += ' ORDER BY data_abertura DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);
    const res = await db.query(sql, params);
    return res.rows;
  } catch (err) {
    const d = getJsonDb();
    d.erp_ordens_servico ||= [];
    let list = d.erp_ordens_servico.filter(o => o.empresa_id === empresaId);
    if (status) list = list.filter(o => o.status === status);
    if (prioridade) list = list.filter(o => o.prioridade === prioridade);
    if (busca) {
      const b = busca.toLowerCase();
      list = list.filter(o => (o.numero || '').toLowerCase().includes(b) || (o.cliente_nome || '').toLowerCase().includes(b) || (o.equipamento_modelo || '').toLowerCase().includes(b));
    }
    return list.slice(offset, offset + limit);
  }
}

export async function obterOS(db, empresaId, id) {
  await bootstrapErpTables(db);
  try {
    const res = await db.query('SELECT * FROM erp_ordens_servico WHERE empresa_id = $1 AND id = $2', [empresaId, id]);
    if (res.rows[0]) return res.rows[0];
  } catch {}
  const d = getJsonDb();
  d.erp_ordens_servico ||= [];
  const found = d.erp_ordens_servico.find(o => o.empresa_id === empresaId && o.id === id);
  if (!found) throw new ErroDominio('NOT_FOUND', 'Ordem de Serviço não encontrada', 404);
  return found;
}

export async function salvarOS(db, empresaId, dados, usuario = 'admin') {
  await bootstrapErpTables(db);
  const clienteNome = exigirTexto(dados.cliente_nome, 'Nome do cliente');
  const pecas = Array.isArray(dados.pecas) ? dados.pecas : [];
  const servicos = Array.isArray(dados.servicos) ? dados.servicos : [];
  const checklist = Array.isArray(dados.checklist) ? dados.checklist : [];

  let valorPecas = 0;
  for (const p of pecas) {
    const q = Number(p.quantidade || 1);
    const vu = Number(p.valor_unitario || 0);
    p.total = Math.round(q * vu * 100) / 100;
    valorPecas += p.total;
  }

  let valorServicos = 0;
  for (const s of servicos) {
    const h = Number(s.horas || 1);
    const vu = Number(s.valor_unitario || 0);
    s.total = Math.round(h * vu * 100) / 100;
    valorServicos += s.total;
  }

  const desconto = Number(dados.desconto || 0);
  const valorTotal = Math.max(0, Math.round((valorPecas + valorServicos - desconto) * 100) / 100);

  const agora = new Date();
  let id = dados.id;
  let numero = dados.numero;

  if (!id) {
    id = crypto.randomUUID();
    if (!numero) {
      const ano = agora.getFullYear();
      const countRes = await db.query('SELECT COUNT(*) as total FROM erp_ordens_servico WHERE empresa_id = $1', [empresaId]).catch(() => ({ rows: [{ total: 0 }] }));
      const seq = Number(countRes.rows[0]?.total || 0) + 1;
      numero = `OS-${ano}/${String(seq).padStart(4, '0')}`;
    }
  }

  const payload = {
    id,
    empresa_id: empresaId,
    loja_id: dados.loja_id || null,
    numero,
    cliente_id: dados.cliente_id || null,
    cliente_nome: clienteNome,
    cliente_documento: dados.cliente_documento || '',
    cliente_telefone: dados.cliente_telefone || '',
    cliente_email: dados.cliente_email || '',
    tecnico_responsavel: dados.tecnico_responsavel || usuario,
    status: dados.status || 'aberta',
    prioridade: dados.prioridade || 'normal',
    equipamento_tipo: dados.equipamento_tipo || 'Geral',
    equipamento_marca: dados.equipamento_marca || '',
    equipamento_modelo: dados.equipamento_modelo || '',
    equipamento_serie: dados.equipamento_serie || '',
    equipamento_patrimonio: dados.equipamento_patrimonio || '',
    defeito_reclamado: dados.defeito_reclamado || '',
    laudo_tecnico: dados.laudo_tecnico || '',
    solucao_aplicada: dados.solucao_aplicada || '',
    checklist: JSON.stringify(checklist),
    pecas: JSON.stringify(pecas),
    servicos: JSON.stringify(servicos),
    valor_pecas: valorPecas,
    valor_servicos: valorServicos,
    desconto,
    valor_total: valorTotal,
    previsao_entrega: dados.previsao_entrega || null,
    garantia_dias: Number(dados.garantia_dias || 90),
    termo_garantia: dados.termo_garantia || 'Garantia de 90 dias conforme Art. 26 do Código de Defesa do Consumidor (Lei 8.078/90) sobre serviços e peças aplicadas.',
    assinatura_cliente: dados.assinatura_cliente || null,
    data_abertura: dados.data_abertura || agora.toISOString(),
    criado_em: dados.criado_em || agora.toISOString(),
    criado_por: usuario,
    atualizado_em: agora.toISOString()
  };

  try {
    const sql = `
      INSERT INTO erp_ordens_servico (
        id, empresa_id, loja_id, numero, cliente_id, cliente_nome, cliente_documento, cliente_telefone, cliente_email,
        tecnico_responsavel, status, prioridade, equipamento_tipo, equipamento_marca, equipamento_modelo,
        equipamento_serie, equipamento_patrimonio, defeito_reclamado, laudo_tecnico, solucao_aplicada,
        checklist, pecas, servicos, valor_pecas, valor_servicos, desconto, valor_total,
        previsao_entrega, garantia_dias, termo_garantia, assinatura_cliente, criado_por, atualizado_em
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33
      )
      ON CONFLICT (empresa_id, numero) DO UPDATE SET
        cliente_id = EXCLUDED.cliente_id,
        cliente_nome = EXCLUDED.cliente_nome,
        cliente_documento = EXCLUDED.cliente_documento,
        cliente_telefone = EXCLUDED.cliente_telefone,
        cliente_email = EXCLUDED.cliente_email,
        tecnico_responsavel = EXCLUDED.tecnico_responsavel,
        status = EXCLUDED.status,
        prioridade = EXCLUDED.prioridade,
        equipamento_tipo = EXCLUDED.equipamento_tipo,
        equipamento_marca = EXCLUDED.equipamento_marca,
        equipamento_modelo = EXCLUDED.equipamento_modelo,
        equipamento_serie = EXCLUDED.equipamento_serie,
        equipamento_patrimonio = EXCLUDED.equipamento_patrimonio,
        defeito_reclamado = EXCLUDED.defeito_reclamado,
        laudo_tecnico = EXCLUDED.laudo_tecnico,
        solucao_aplicada = EXCLUDED.solucao_aplicada,
        checklist = EXCLUDED.checklist,
        pecas = EXCLUDED.pecas,
        servicos = EXCLUDED.servicos,
        valor_pecas = EXCLUDED.valor_pecas,
        valor_servicos = EXCLUDED.valor_servicos,
        desconto = EXCLUDED.desconto,
        valor_total = EXCLUDED.valor_total,
        previsao_entrega = EXCLUDED.previsao_entrega,
        garantia_dias = EXCLUDED.garantia_dias,
        termo_garantia = EXCLUDED.termo_garantia,
        assinatura_cliente = COALESCE(EXCLUDED.assinatura_cliente, erp_ordens_servico.assinatura_cliente),
        atualizado_em = NOW()
      RETURNING *;
    `;
    const res = await db.query(sql, Object.values(payload));
    payload.checklist = checklist;
    payload.pecas = pecas;
    payload.servicos = servicos;
    return res.rows[0] || payload;
  } catch (err) {
    console.warn('[KYTTO ERP] Salvando OS no fallback json-db:', err.message);
    const d = getJsonDb();
    d.erp_ordens_servico ||= [];
    payload.checklist = checklist;
    payload.pecas = pecas;
    payload.servicos = servicos;
    const idx = d.erp_ordens_servico.findIndex(o => o.empresa_id === empresaId && o.id === id);
    if (idx >= 0) d.erp_ordens_servico[idx] = payload;
    else d.erp_ordens_servico.push(payload);
    saveJsonDb();
    return payload;
  }
}

export async function atualizarStatusOS(db, empresaId, id, status, usuario = 'admin') {
  await bootstrapErpTables(db);
  const statusValidos = ['aberta', 'em_analise', 'aguardando_pecas', 'aguardando_aprovacao', 'aprovada', 'em_execucao', 'concluida', 'faturada', 'cancelada'];
  if (!statusValidos.includes(status)) throw new ErroDominio('INVALID_STATUS', `Status inválido: ${status}`);

  const conclusaoSql = status === 'concluida' ? ', data_conclusao = NOW()' : '';
  try {
    const res = await db.query(
      `UPDATE erp_ordens_servico SET status = $1, atualizado_em = NOW() ${conclusaoSql} WHERE empresa_id = $2 AND id = $3 RETURNING *`,
      [status, empresaId, id]
    );
    if (res.rows[0]) return res.rows[0];
  } catch {}

  const d = getJsonDb();
  d.erp_ordens_servico ||= [];
  const o = d.erp_ordens_servico.find(x => x.empresa_id === empresaId && x.id === id);
  if (!o) throw new ErroDominio('NOT_FOUND', 'OS não encontrada', 404);
  o.status = status;
  if (status === 'concluida') o.data_conclusao = new Date().toISOString();
  o.atualizado_em = new Date().toISOString();
  saveJsonDb();
  return o;
}

export async function faturarOS(db, empresaId, id, usuario = 'admin') {
  const os = await obterOS(db, empresaId, id);
  if (os.status === 'faturada') throw new ErroDominio('ALREADY_BILLED', 'Esta OS já foi faturada');

  const valorTotal = Number(os.valor_total || 0);
  const lancamentoId = crypto.randomUUID();

  try {
    await db.query(`
      INSERT INTO fin_lancamentos (
        id, empresa_id, loja_id, tipo, status, descricao, valor, data_competencia, data_vencimento,
        cliente_nome, documento_ref, criado_por
      ) VALUES (
        $1, $2, $3, 'receita', 'pendente', $4, $5, CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days',
        $6, $7, $8
      ) ON CONFLICT DO NOTHING;
    `, [
      lancamentoId, empresaId, os.loja_id, `Serviços/Peças Ref. ${os.numero} - ${os.cliente_nome}`,
      valorTotal, os.cliente_nome, os.numero, usuario
    ]);
  } catch (err) {
    console.warn('[KYTTO ERP] Lançamento financeiro de OS:', err.message);
  }

  try {
    await db.query(`
      UPDATE erp_ordens_servico SET status = 'faturada', faturado_em = NOW(), faturamento_ref = $1 WHERE empresa_id = $2 AND id = $3
    `, [lancamentoId, empresaId, id]);
  } catch {}

  const d = getJsonDb();
  d.erp_ordens_servico ||= [];
  const o = d.erp_ordens_servico.find(x => x.empresa_id === empresaId && x.id === id);
  if (o) {
    o.status = 'faturada';
    o.faturado_em = new Date().toISOString();
    o.faturamento_ref = lancamentoId;
    saveJsonDb();
  }

  return {
    sucesso: true,
    mensagem: `Ordem de Serviço ${os.numero} faturada com sucesso! Lançamento a receber registrado no valor de R$ ${valorTotal.toFixed(2)}.`,
    osId: id,
    referenciaFinanceira: lancamentoId
  };
}

export async function salvarAssinaturaOS(db, empresaId, id, assinaturaBase64) {
  await bootstrapErpTables(db);
  try {
    const res = await db.query(
      `UPDATE erp_ordens_servico SET assinatura_cliente = $1, atualizado_em = NOW() WHERE empresa_id = $2 AND id = $3 RETURNING *`,
      [assinaturaBase64, empresaId, id]
    );
    if (res.rows[0]) return res.rows[0];
  } catch {}

  const d = getJsonDb();
  d.erp_ordens_servico ||= [];
  const o = d.erp_ordens_servico.find(x => x.empresa_id === empresaId && x.id === id);
  if (!o) throw new ErroDominio('NOT_FOUND', 'OS não encontrada', 404);
  o.assinatura_cliente = assinaturaBase64;
  o.atualizado_em = new Date().toISOString();
  saveJsonDb();
  return o;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. EXPEDIÇÃO, LOGÍSTICA & ROMANEIO DE CARGA
// ────────────────────────────────────────────────────────────────────────────

export async function listarRomaneios(db, empresaId, { status = '', limit = 50, offset = 0 } = {}) {
  await bootstrapErpTables(db);
  try {
    let sql = 'SELECT * FROM erp_romaneios WHERE empresa_id = $1';
    const params = [empresaId];
    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }
    sql += ' ORDER BY data_saida DESC, criado_em DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);
    const res = await db.query(sql, params);
    return res.rows;
  } catch (err) {
    const d = getJsonDb();
    d.erp_romaneios ||= [];
    let list = d.erp_romaneios.filter(r => r.empresa_id === empresaId);
    if (status) list = list.filter(r => r.status === status);
    return list.slice(offset, offset + limit);
  }
}

export async function obterRomaneio(db, empresaId, id) {
  await bootstrapErpTables(db);
  try {
    const res = await db.query('SELECT * FROM erp_romaneios WHERE empresa_id = $1 AND id = $2', [empresaId, id]);
    if (res.rows[0]) return res.rows[0];
  } catch {}
  const d = getJsonDb();
  d.erp_romaneios ||= [];
  const found = d.erp_romaneios.find(r => r.empresa_id === empresaId && r.id === id);
  if (!found) throw new ErroDominio('NOT_FOUND', 'Romaneio de Carga não encontrado', 404);
  return found;
}

export async function salvarRomaneio(db, empresaId, dados, usuario = 'admin') {
  await bootstrapErpTables(db);
  const entregas = Array.isArray(dados.entregas) ? dados.entregas : [];
  
  let totalVolumes = 0;
  let valorTotalMercadorias = 0;
  let valorAReceberDestino = 0;

  for (const ent of entregas) {
    totalVolumes += Number(ent.volumes || 1);
    valorTotalMercadorias += Number(ent.valor_mercadoria || 0);
    if (['cobrar_destino', 'cobrar_na_entrega', 'na_entrega'].includes(ent.forma_pagamento)) {
      valorAReceberDestino += Number(ent.valor_a_cobrar || 0);
    }
    if (!ent.id) ent.id = crypto.randomUUID();
    if (!ent.status) ent.status = 'pendente';
  }

  const agora = new Date();
  let id = dados.id;
  let numero = dados.numero;

  if (!id) {
    id = crypto.randomUUID();
    if (!numero) {
      const ano = agora.getFullYear();
      const countRes = await db.query('SELECT COUNT(*) as total FROM erp_romaneios WHERE empresa_id = $1', [empresaId]).catch(() => ({ rows: [{ total: 0 }] }));
      const seq = Number(countRes.rows[0]?.total || 0) + 1;
      numero = `ROM-${ano}/${String(seq).padStart(4, '0')}`;
    }
  }

  const payload = {
    id,
    empresa_id: empresaId,
    loja_id: dados.loja_id || null,
    numero,
    data_saida: dados.data_saida || agora.toISOString().split('T')[0],
    motorista_nome: dados.motorista_nome || '',
    veiculo_placa: (dados.veiculo_placa || '').toUpperCase(),
    veiculo_modelo: dados.veiculo_modelo || '',
    status: dados.status || 'em_preparacao',
    entregas: JSON.stringify(entregas),
    total_pedidos: entregas.length,
    total_volumes: totalVolumes,
    valor_total_mercadorias: Math.round(valorTotalMercadorias * 100) / 100,
    valor_a_receber_destino: Math.round(valorAReceberDestino * 100) / 100,
    observacoes: dados.observacoes || '',
    criado_por: usuario,
    atualizado_em: agora.toISOString()
  };

  try {
    const sql = `
      INSERT INTO erp_romaneios (
        id, empresa_id, loja_id, numero, data_saida, motorista_nome, veiculo_placa, veiculo_modelo,
        status, entregas, total_pedidos, total_volumes, valor_total_mercadorias, valor_a_receber_destino,
        observacoes, criado_por, atualizado_em
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17
      )
      ON CONFLICT (empresa_id, numero) DO UPDATE SET
        data_saida = EXCLUDED.data_saida,
        motorista_nome = EXCLUDED.motorista_nome,
        veiculo_placa = EXCLUDED.veiculo_placa,
        veiculo_modelo = EXCLUDED.veiculo_modelo,
        status = EXCLUDED.status,
        entregas = EXCLUDED.entregas,
        total_pedidos = EXCLUDED.total_pedidos,
        total_volumes = EXCLUDED.total_volumes,
        valor_total_mercadorias = EXCLUDED.valor_total_mercadorias,
        valor_a_receber_destino = EXCLUDED.valor_a_receber_destino,
        observacoes = EXCLUDED.observacoes,
        atualizado_em = NOW()
      RETURNING *;
    `;
    const res = await db.query(sql, Object.values(payload));
    payload.entregas = entregas;
    return res.rows[0] || payload;
  } catch (err) {
    const d = getJsonDb();
    d.erp_romaneios ||= [];
    payload.entregas = entregas;
    const idx = d.erp_romaneios.findIndex(r => r.empresa_id === empresaId && r.id === id);
    if (idx >= 0) d.erp_romaneios[idx] = payload;
    else d.erp_romaneios.push(payload);
    saveJsonDb();
    return payload;
  }
}

export async function atualizarStatusEntrega(db, empresaId, romaneioId, entregaId, { status, recebedor_nome, recebedor_doc } = {}) {
  const rom = await obterRomaneio(db, empresaId, romaneioId);
  const entregas = Array.isArray(rom.entregas) ? rom.entregas : JSON.parse(rom.entregas || '[]');
  
  const ent = entregas.find(e => e.id === entregaId);
  if (!ent) throw new ErroDominio('NOT_FOUND', 'Entrega não encontrada no romaneio', 404);

  ent.status = status;
  if (recebedor_nome) ent.recebedor_nome = recebedor_nome;
  if (recebedor_doc) ent.recebedor_doc = recebedor_doc;
  ent.hora_baixa = new Date().toISOString();
  ent.entregue_em = ent.hora_baixa;

  // Se todas as entregas forem entregues, marcar romaneio como concluído
  const todasEntregues = entregas.every(e => e.status === 'entregue' || e.status === 'cancelada');
  const novoStatusRomaneio = todasEntregues ? 'concluido' : rom.status;

  return salvarRomaneio(db, empresaId, {
    ...rom,
    status: novoStatusRomaneio,
    entregas
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 4. PATRIMÔNIO & ATIVOS IMOBILIZADOS (DEPRECIAÇÃO & MANUTENÇÃO)
// ────────────────────────────────────────────────────────────────────────────

// Taxas anuais oficiais de depreciação conforme Instrução Normativa SRF nº 162
export const TAXAS_DEPRECIACAO_OFICIAIS = {
  informatica: { taxaAnual: 20.0, vidaUtilAnos: 5, nome: 'Equipamentos de Informática e Comunicação' },
  maquinas_equipamentos: { taxaAnual: 10.0, vidaUtilAnos: 10, nome: 'Máquinas, Aparelhos e Ferramentas Industriais' },
  moveis_utensilios: { taxaAnual: 10.0, vidaUtilAnos: 10, nome: 'Móveis, Utensílios e Mobiliário de Salão/Bar' },
  veiculos: { taxaAnual: 20.0, vidaUtilAnos: 5, nome: 'Veículos de Transporte e Carga' },
  instalacoes: { taxaAnual: 10.0, vidaUtilAnos: 10, nome: 'Instalações Comerciais e Ar-Condicionado' },
  ferramentas: { taxaAnual: 20.0, vidaUtilAnos: 5, nome: 'Ferramentas de Uso Contínuo' }
};

export async function listarAtivos(db, empresaId, { categoria = '', busca = '', limit = 50, offset = 0 } = {}) {
  await bootstrapErpTables(db);
  try {
    let sql = 'SELECT * FROM erp_ativos WHERE empresa_id = $1';
    const params = [empresaId];
    if (categoria) {
      params.push(categoria);
      sql += ` AND categoria = $${params.length}`;
    }
    if (busca) {
      params.push(`%${busca}%`);
      sql += ` AND (codigo_tombamento ILIKE $${params.length} OR descricao ILIKE $${params.length} OR marca ILIKE $${params.length} OR modelo ILIKE $${params.length})`;
    }
    sql += ' ORDER BY criado_em DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);
    const res = await db.query(sql, params);
    
    // Adicionar cálculo dinâmico de depreciação linear
    const agora = new Date();
    return res.rows.map(ativo => enriquecerAtivoComDepreciacao(ativo, agora));
  } catch (err) {
    const d = getJsonDb();
    d.erp_ativos ||= [];
    let list = d.erp_ativos.filter(a => a.empresa_id === empresaId);
    if (categoria) list = list.filter(a => a.categoria === categoria);
    if (busca) {
      const b = busca.toLowerCase();
      list = list.filter(a => (a.codigo_tombamento || '').toLowerCase().includes(b) || (a.descricao || '').toLowerCase().includes(b));
    }
    const agora = new Date();
    return list.slice(offset, offset + limit).map(ativo => enriquecerAtivoComDepreciacao(ativo, agora));
  }
}

function enriquecerAtivoComDepreciacao(ativo, dataReferencia = new Date()) {
  const dataAq = new Date(ativo.data_aquisicao);
  const valorAq = Number(ativo.valor_aquisicao || 0);
  const taxaAnual = Number(ativo.taxa_depreciacao_anual || 10.0);
  
  // Meses decorridos
  const mesesDecorridos = Math.max(0, (dataReferencia.getFullYear() - dataAq.getFullYear()) * 12 + (dataReferencia.getMonth() - dataAq.getMonth()));
  const taxaMensal = (taxaAnual / 100) / 12;
  const depreciacaoAcumulada = Math.min(valorAq, Math.round(valorAq * taxaMensal * mesesDecorridos * 100) / 100);
  const valorResidual = Math.max(0, Math.round((valorAq - depreciacaoAcumulada) * 100) / 100);
  const percentualDepreciado = valorAq > 0 ? Math.min(100, Math.round((depreciacaoAcumulada / valorAq) * 100)) : 0;

  return {
    ...ativo,
    meses_decorridos: mesesDecorridos,
    depreciacao_acumulada: depreciacaoAcumulada,
    depreciacaoAcumulada,
    valor_residual: valorResidual,
    valorResidual,
    percentual_depreciado: percentualDepreciado
  };
}

export async function salvarAtivo(db, empresaId, dados) {
  await bootstrapErpTables(db);
  const descricao = exigirTexto(dados.descricao, 'Descrição do bem patrimonial');
  const categoria = dados.categoria || 'maquinas_equipamentos';
  const regraPadrao = TAXAS_DEPRECIACAO_OFICIAIS[categoria] || TAXAS_DEPRECIACAO_OFICIAIS.maquinas_equipamentos;

  const agora = new Date();
  let id = dados.id;
  let codigoTombamento = dados.codigo_tombamento;

  if (!id) {
    id = crypto.randomUUID();
    if (!codigoTombamento) {
      const countRes = await db.query('SELECT COUNT(*) as total FROM erp_ativos WHERE empresa_id = $1', [empresaId]).catch(() => ({ rows: [{ total: 0 }] }));
      const seq = Number(countRes.rows[0]?.total || 0) + 1;
      codigoTombamento = `PAT-${String(seq).padStart(5, '0')}`;
    }
  }

  const payload = {
    id,
    empresa_id: empresaId,
    loja_id: dados.loja_id || null,
    codigo_tombamento: codigoTombamento,
    descricao,
    categoria,
    marca: dados.marca || '',
    modelo: dados.modelo || '',
    numero_serie: dados.numero_serie || '',
    data_aquisicao: dados.data_aquisicao || agora.toISOString().split('T')[0],
    valor_aquisicao: Number(dados.valor_aquisicao || 0),
    vida_util_anos: Number(dados.vida_util_anos || regraPadrao.vidaUtilAnos),
    taxa_depreciacao_anual: Number(dados.taxa_depreciacao_anual || regraPadrao.taxaAnual),
    nf_compra: dados.nf_compra || '',
    fornecedor_nome: dados.fornecedor_nome || '',
    localizacao_setor: dados.localizacao_setor || 'Geral',
    responsavel: dados.responsavel || '',
    estado_conservacao: dados.estado_conservacao || 'otimo',
    historico_manutencoes: JSON.stringify(dados.historico_manutencoes || []),
    atualizado_em: agora.toISOString()
  };

  try {
    const sql = `
      INSERT INTO erp_ativos (
        id, empresa_id, loja_id, codigo_tombamento, descricao, categoria, marca, modelo, numero_serie,
        data_aquisicao, valor_aquisicao, vida_util_anos, taxa_depreciacao_anual, nf_compra, fornecedor_nome,
        localizacao_setor, responsavel, estado_conservacao, historico_manutencoes, atualizado_em
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      )
      ON CONFLICT (empresa_id, codigo_tombamento) DO UPDATE SET
        descricao = EXCLUDED.descricao,
        categoria = EXCLUDED.categoria,
        marca = EXCLUDED.marca,
        modelo = EXCLUDED.modelo,
        numero_serie = EXCLUDED.numero_serie,
        data_aquisicao = EXCLUDED.data_aquisicao,
        valor_aquisicao = EXCLUDED.valor_aquisicao,
        vida_util_anos = EXCLUDED.vida_util_anos,
        taxa_depreciacao_anual = EXCLUDED.taxa_depreciacao_anual,
        nf_compra = EXCLUDED.nf_compra,
        fornecedor_nome = EXCLUDED.fornecedor_nome,
        localizacao_setor = EXCLUDED.localizacao_setor,
        responsavel = EXCLUDED.responsavel,
        estado_conservacao = EXCLUDED.estado_conservacao,
        historico_manutencoes = EXCLUDED.historico_manutencoes,
        atualizado_em = NOW()
      RETURNING *;
    `;
    const res = await db.query(sql, Object.values(payload));
    return enriquecerAtivoComDepreciacao(res.rows[0] || payload);
  } catch (err) {
    const d = getJsonDb();
    d.erp_ativos ||= [];
    payload.historico_manutencoes = dados.historico_manutencoes || [];
    const idx = d.erp_ativos.findIndex(a => a.empresa_id === empresaId && a.id === id);
    if (idx >= 0) d.erp_ativos[idx] = payload;
    else d.erp_ativos.push(payload);
    saveJsonDb();
    return enriquecerAtivoComDepreciacao(payload);
  }
}

export async function registrarManutencaoAtivo(db, empresaId, ativoId, { tipo = 'preventiva', descricao, custo = 0, prestador = '', proxima_manutencao } = {}) {
  await bootstrapErpTables(db);
  const res = await db.query('SELECT * FROM erp_ativos WHERE empresa_id = $1 AND id = $2', [empresaId, ativoId]).catch(() => ({ rows: [] }));
  let ativo = res.rows[0];
  if (!ativo) {
    const d = getJsonDb();
    d.erp_ativos ||= [];
    ativo = d.erp_ativos.find(a => a.empresa_id === empresaId && a.id === ativoId);
  }
  if (!ativo) throw new ErroDominio('NOT_FOUND', 'Ativo patrimonial não encontrado', 404);

  const historico = Array.isArray(ativo.historico_manutencoes) ? ativo.historico_manutencoes : JSON.parse(ativo.historico_manutencoes || '[]');
  historico.push({
    id: crypto.randomUUID(),
    data: new Date().toISOString(),
    tipo,
    descricao: exigirTexto(descricao, 'Descrição da manutenção'),
    custo: Number(custo || 0),
    prestador: prestador || '',
    proxima_manutencao: proxima_manutencao || null
  });

  return salvarAtivo(db, empresaId, {
    ...ativo,
    historico_manutencoes: historico
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 5. KPIS GERAIS DO ERP 360
// ────────────────────────────────────────────────────────────────────────────

export async function obterKpisErp(db, empresaId) {
  await bootstrapErpTables(db);
  const [propostas, os, romaneios, ativos] = await Promise.all([
    listarPropostas(db, empresaId, { limit: 1000 }).catch(() => []),
    listarOS(db, empresaId, { limit: 1000 }).catch(() => []),
    listarRomaneios(db, empresaId, { limit: 1000 }).catch(() => []),
    listarAtivos(db, empresaId, { limit: 1000 }).catch(() => [])
  ]);

  const totalPropostas = propostas.length;
  const valorPropostas = propostas.reduce((s, p) => s + Number(p.valor_total || 0), 0);
  const propostasAprovadas = propostas.filter(p => p.status === 'aprovada' || p.status === 'faturada').length;
  const taxaConversaoPropostas = totalPropostas > 0 ? Math.round((propostasAprovadas / totalPropostas) * 100) : 0;

  const totalOS = os.length;
  const osAbertas = os.filter(o => o.status !== 'concluida' && o.status !== 'faturada' && o.status !== 'cancelada').length;
  const valorFaturamentoOS = os.filter(o => o.status === 'concluida' || o.status === 'faturada').reduce((s, o) => s + Number(o.valor_total || 0), 0);

  const totalRomaneios = romaneios.length;
  const entregasEmTransito = romaneios.filter(r => r.status === 'em_rota').length;

  const totalAtivos = ativos.length;
  const valorPatrimonialTotal = ativos.reduce((s, a) => s + Number(a.valor_aquisicao || 0), 0);
  const depreciacaoAcumuladaTotal = ativos.reduce((s, a) => s + Number(a.depreciacao_acumulada || 0), 0);
  const valorResidualTotal = Math.max(0, valorPatrimonialTotal - depreciacaoAcumuladaTotal);

  return {
    propostas: { total: totalPropostas, valorTotal: valorPropostas, aprovadas: propostasAprovadas, taxaConversao: taxaConversaoPropostas },
    ordensServico: { total: totalOS, abertas: osAbertas, faturamento: valorFaturamentoOS },
    logistica: { totalRomaneios, entregasEmTransito },
    patrimonio: { totalAtivos, valorTotal: valorPatrimonialTotal, depreciacaoAcumulada: depreciacaoAcumuladaTotal, valorResidual: valorResidualTotal }
  };
}

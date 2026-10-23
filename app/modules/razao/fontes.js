// Fontes do razão: cada módulo que mexe com dinheiro entra aqui pela própria tabela, sem mudar o
// fluxo dele. A leitura é idempotente (chave única por fato na fonte) e pode rodar quantas vezes
// for preciso: ao abrir o Financeiro e numa rotina periódica.
//
// Fonte                     | Chave                         | Vira
// bar_comanda_pagamentos    | bar_pagamento:<id>            | receita paga; "conta" (fiado) = conta a receber
// clube_pagamentos_recebidos| clube:<pagamento_id>          | receita paga (Mensalidades)
// a2_contas_receber         | a2_conta:<id>                 | conta a receber; baixa na fonte → pago aqui
// commerce_payments         | loja_online:<id>              | receita paga (Loja online); devolução → estorno
// financeiro JSON (legado)  | json:<empresa legada>:<id>    | importação dos lançamentos antigos
import { ErroDominio, exigirUuid, transacao } from '../acesso/banco.js';
import { FUSO_PADRAO, garantirCategorias } from './servico.js';

async function existeTabela(db, nome) {
  const r = await db.query('SELECT to_regclass($1) AS t', [nome]);
  return Boolean(r.rows[0]?.t);
}

async function marcar(db, empresa, fonte, { lidos = 0, inseridos = 0, atualizados = 0, erro = null }) {
  await db.query(
    `INSERT INTO fin_fontes_sincronizadas (empresa_id, fonte, sincronizado_em, lidos, inseridos, atualizados, erro)
     VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6)
     ON CONFLICT (empresa_id, fonte) DO UPDATE SET sincronizado_em = CURRENT_TIMESTAMP, lidos = EXCLUDED.lidos,
       inseridos = EXCLUDED.inseridos, atualizados = EXCLUDED.atualizados, erro = EXCLUDED.erro`,
    [empresa, fonte, lidos, inseridos, atualizados, erro ? String(erro).slice(0, 240) : null],
  );
}

// Colunas na mesma ordem do INSERT dos SELECTs abaixo.
const INSERT_COLS = `(empresa_id, loja_id, tipo, categoria, descricao, valor, data_competencia, vencimento, status, pago_em,
  meio_pagamento, natureza, contraparte_tipo, contraparte_id, contraparte_nome, origem, origem_id, chave, automatico, criado_por)`;

/** Pagamentos de comandas do bar (inclui pagamentos parciais: dinheiro que já entrou). */
export async function sincronizarBar(db, empresaId, { fuso = FUSO_PADRAO } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!(await existeTabela(db, 'bar_comanda_pagamentos'))) return { fonte: 'bar', ignorada: true };
  const r = await db.query(
    `INSERT INTO fin_lancamentos ${INSERT_COLS}
     SELECT p.empresa_id, NULL, 'receita', 'Bar e restaurante',
            left('Comanda ' || COALESCE(NULLIF(c.nome, ''), 'do bar') || CASE WHEN p.meio IS NOT NULL THEN ' · ' || p.meio ELSE '' END, 240),
            p.valor, (p.criado_em AT TIME ZONE $2)::date,
            -- "conta" é venda fiada: vira conta a receber do cliente, com 30 dias para pagar
            CASE WHEN lower(p.meio) = 'conta' THEN (p.criado_em AT TIME ZONE $2)::date + 30 ELSE (p.criado_em AT TIME ZONE $2)::date END,
            CASE WHEN lower(p.meio) = 'conta' THEN 'pendente' ELSE 'pago' END,
            CASE WHEN lower(p.meio) = 'conta' THEN NULL ELSE p.criado_em END,
            CASE lower(p.meio) WHEN 'cartao' THEN 'credito' WHEN 'tef' THEN 'credito' WHEN 'pix' THEN 'pix'
              WHEN 'dinheiro' THEN 'dinheiro' WHEN 'carteira' THEN 'voucher' WHEN 'conta' THEN NULL ELSE 'outro' END,
            CASE WHEN lower(p.meio) = 'conta' THEN 'receber' ELSE 'avulso' END,
            CASE WHEN c.cliente_id IS NOT NULL THEN 'cliente' END, c.cliente_id, cc.nome,
            'bar_comanda', c.id::text, 'bar_pagamento:' || p.id, true, 'sistema'
       FROM bar_comanda_pagamentos p
       JOIN bar_comandas c ON c.empresa_id = p.empresa_id AND c.id = p.comanda_id
       LEFT JOIN commerce_customers cc ON cc.empresa_id = c.empresa_id AND cc.id = c.cliente_id
      WHERE p.empresa_id = $1 AND p.valor > 0
     ON CONFLICT (empresa_id, chave) DO NOTHING`,
    [empresa, fuso],
  );
  const total = await db.query('SELECT count(*)::int AS n FROM bar_comanda_pagamentos WHERE empresa_id = $1', [empresa]);
  const res = { fonte: 'bar', lidos: total.rows[0].n, inseridos: r.rowCount, atualizados: 0 };
  await marcar(db, empresa, 'bar', res);
  return res;
}

/** Pagamentos do clube (Pix da recepção, link de cobrança, crediário, gateway): um por pagamento_id. */
export async function sincronizarClube(db, empresaId, { fuso = FUSO_PADRAO } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!(await existeTabela(db, 'clube_pagamentos_recebidos'))) return { fonte: 'clube', ignorada: true };
  const temCobranca = await existeTabela(db, 'clube_cobrancas');
  const r = await db.query(
    `INSERT INTO fin_lancamentos ${INSERT_COLS}
     SELECT p.empresa_id, NULL, 'receita', 'Mensalidades',
            left(COALESCE(${temCobranca ? 'cb.descricao' : 'NULL'}, 'Pagamento do clube') || ' · ' || COALESCE(cc.nome, 'aluno'), 240),
            p.valor, (p.criado_em AT TIME ZONE $2)::date, (p.criado_em AT TIME ZONE $2)::date, 'pago', p.criado_em,
            CASE WHEN p.pagamento_id LIKE 'clube-cobranca:%' THEN 'pix' ELSE NULL END,
            'avulso', 'cliente', p.customer_id, cc.nome,
            'clube_pagamento', p.pagamento_id, 'clube:' || p.pagamento_id, true, 'sistema'
       FROM clube_pagamentos_recebidos p
       LEFT JOIN commerce_customers cc ON cc.empresa_id = p.empresa_id AND cc.id = p.customer_id
       ${temCobranca ? `LEFT JOIN clube_cobrancas cb ON cb.empresa_id = p.empresa_id AND p.pagamento_id = 'clube-cobranca:' || cb.id::text` : ''}
      WHERE p.empresa_id = $1 AND p.valor IS NOT NULL AND p.valor > 0
     ON CONFLICT (empresa_id, chave) DO NOTHING`,
    [empresa, fuso],
  );
  const total = await db.query('SELECT count(*)::int AS n FROM clube_pagamentos_recebidos WHERE empresa_id = $1', [empresa]);
  const res = { fonte: 'clube', lidos: total.rows[0].n, inseridos: r.rowCount, atualizados: 0 };
  await marcar(db, empresa, 'clube', res);
  return res;
}

/** Contas a receber do A2: nascem pendentes; quando a fonte dá baixa, o razão marca como pago. */
export async function sincronizarContasReceber(db, empresaId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!(await existeTabela(db, 'a2_contas_receber'))) return { fonte: 'a2', ignorada: true };
  const ins = await db.query(
    `INSERT INTO fin_lancamentos ${INSERT_COLS}
     SELECT a.empresa_id, NULL, 'receita', 'Contas de clientes', left(a.descricao, 240), a.valor,
            a.criado_em::date, a.data_vencimento,
            CASE WHEN a.data_pagamento IS NULL THEN 'pendente' ELSE 'pago' END, a.data_pagamento,
            NULL, 'receber', 'cliente', a.cliente_id, cc.nome,
            'a2_conta', a.id::text, 'a2_conta:' || a.id, true, 'sistema'
       FROM a2_contas_receber a
       LEFT JOIN commerce_customers cc ON cc.empresa_id = a.empresa_id AND cc.id = a.cliente_id
      WHERE a.empresa_id = $1
     ON CONFLICT (empresa_id, chave) DO NOTHING`,
    [empresa],
  );
  const upd = await db.query(
    `UPDATE fin_lancamentos l SET status = 'pago', pago_em = a.data_pagamento, atualizado_em = CURRENT_TIMESTAMP
       FROM a2_contas_receber a
      WHERE l.empresa_id = $1 AND a.empresa_id = l.empresa_id AND l.chave = 'a2_conta:' || a.id
        AND l.status = 'pendente' AND a.data_pagamento IS NOT NULL`,
    [empresa],
  );
  const total = await db.query('SELECT count(*)::int AS n FROM a2_contas_receber WHERE empresa_id = $1', [empresa]);
  const res = { fonte: 'a2', lidos: total.rows[0].n, inseridos: ins.rowCount, atualizados: upd.rowCount };
  await marcar(db, empresa, 'a2', res);
  return res;
}

/** Pagamentos capturados da loja online; devolução vira estorno ligado ao original. */
export async function sincronizarLojaOnline(db, empresaId, { fuso = FUSO_PADRAO } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!(await existeTabela(db, 'commerce_payments'))) return { fonte: 'loja_online', ignorada: true };
  const ins = await db.query(
    `INSERT INTO fin_lancamentos ${INSERT_COLS}
     SELECT p.empresa_id, o.loja_id, 'receita', 'Loja online', left('Pedido ' || o.public_code, 240), p.amount,
            (COALESCE(p.captured_at, p.criado_em) AT TIME ZONE $2)::date, (COALESCE(p.captured_at, p.criado_em) AT TIME ZONE $2)::date,
            'pago', COALESCE(p.captured_at, p.criado_em),
            CASE p.method WHEN 'pix' THEN 'pix' WHEN 'credit_card' THEN 'credito' WHEN 'debit_card' THEN 'debito'
              WHEN 'boleto' THEN 'boleto' WHEN 'cash' THEN 'dinheiro' ELSE 'outro' END,
            'avulso', CASE WHEN o.customer_id IS NOT NULL THEN 'cliente' END, o.customer_id, cc.nome,
            'loja_online', o.id::text, 'loja_online:' || p.id, true, 'sistema'
       FROM commerce_payments p
       JOIN commerce_orders o ON o.empresa_id = p.empresa_id AND o.id = p.order_id
       LEFT JOIN commerce_customers cc ON cc.empresa_id = o.empresa_id AND cc.id = o.customer_id
      WHERE p.empresa_id = $1 AND p.amount > 0 AND (p.status IN ('captured', 'refunded', 'partially_refunded') OR p.captured_at IS NOT NULL)
     ON CONFLICT (empresa_id, chave) DO NOTHING`,
    [empresa, fuso],
  );
  // devolução integral: estorno do valor capturado (parcial fica para conferência manual)
  const est = await db.query(
    `INSERT INTO fin_lancamentos (empresa_id, loja_id, tipo, categoria, descricao, valor, data_competencia, vencimento, status, pago_em,
        meio_pagamento, natureza, contraparte_tipo, contraparte_id, contraparte_nome, origem, origem_id, chave, automatico, estorno_de, criado_por, observacao)
     SELECT l.empresa_id, l.loja_id, 'despesa', 'Estornos e devoluções', left('Estorno: ' || l.descricao, 240), l.valor,
            (p.refunded_at AT TIME ZONE $2)::date, (p.refunded_at AT TIME ZONE $2)::date, 'pago', p.refunded_at,
            l.meio_pagamento, 'avulso', l.contraparte_tipo, l.contraparte_id, l.contraparte_nome,
            'estorno', l.id::text, 'estorno:' || l.id, true, l.id, 'sistema', 'Devolução registrada na loja online'
       FROM commerce_payments p
       JOIN fin_lancamentos l ON l.empresa_id = p.empresa_id AND l.chave = 'loja_online:' || p.id
      WHERE p.empresa_id = $1 AND p.status = 'refunded' AND p.refunded_at IS NOT NULL
     ON CONFLICT (empresa_id, chave) DO NOTHING`,
    [empresa, fuso],
  );
  const total = await db.query("SELECT count(*)::int AS n FROM commerce_payments WHERE empresa_id = $1 AND (status IN ('captured','refunded','partially_refunded') OR captured_at IS NOT NULL)", [empresa]);
  const res = { fonte: 'loja_online', lidos: total.rows[0].n, inseridos: ins.rowCount + est.rowCount, atualizados: 0 };
  await marcar(db, empresa, 'loja_online', res);
  return res;
}

export const FONTES = { bar: sincronizarBar, clube: sincronizarClube, a2: sincronizarContasReceber, loja_online: sincronizarLojaOnline };

/**
 * Lê todas as fontes da empresa. Uma fonte com erro não impede as outras: o erro fica gravado
 * em fin_fontes_sincronizadas e aparece no painel de saúde do Financeiro.
 */
export async function sincronizarEmpresa(db, empresaId, opcoes = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  await garantirCategorias(db, empresa);
  const resultado = [];
  for (const [nome, fn] of Object.entries(FONTES)) {
    try {
      resultado.push(await fn(db, empresa, opcoes));
    } catch (error) {
      const mensagem = error instanceof ErroDominio ? error.message : `${error?.code || 'erro'}: ${String(error?.message || '').slice(0, 160)}`;
      await marcar(db, empresa, nome, { erro: mensagem }).catch(() => {});
      resultado.push({ fonte: nome, erro: mensagem });
    }
  }
  return resultado;
}

export async function saudeDasFontes(db, empresaId) {
  const r = await db.query('SELECT fonte, sincronizado_em, lidos, inseridos, atualizados, erro FROM fin_fontes_sincronizadas WHERE empresa_id = $1 ORDER BY fonte', [exigirUuid(empresaId, 'empresa')]);
  return r.rows.map((row) => ({ fonte: row.fonte, sincronizadoEm: row.sincronizado_em, lidos: row.lidos, inseridos: row.inseridos, atualizados: row.atualizados, erro: row.erro || null }));
}

// ── importação do financeiro antigo (JSON do disco) ───────────────────────────
const STATUS_JSON = { pago: 'pago', pendente: 'pendente', cancelado: 'cancelado', aberto: 'pendente', quitado: 'pago' };

/**
 * Importa os lançamentos do financeiro JSON de uma empresa para o razão.
 * `lancamentos` = Object.values(db().financeiroKytto.empresas[chaveLegada].lancamentos).
 * `mapaUnidades` = { lojaIdLegado: lojaUuid } (o que não estiver no mapa entra sem unidade).
 * `aplicar=false` só simula e devolve o relatório; nada é gravado.
 */
export async function importarJsonLegado(db, empresaId, { chaveLegada, lancamentos = [], mapaUnidades = {}, aplicar = false, fuso = FUSO_PADRAO } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!chaveLegada) throw new ErroDominio('VALIDATION_ERROR', 'chaveLegada é obrigatória');
  const relatorio = { chaveLegada, lidos: 0, validos: 0, ignorados: [], porStatus: {}, porTipo: {}, totais: { receitaPaga: 0, despesaPaga: 0, aReceber: 0, aPagar: 0 }, semUnidade: 0, inseridos: 0, jaExistiam: 0, aplicado: aplicar === true };
  const linhas = [];
  for (const item of Array.isArray(lancamentos) ? lancamentos : []) {
    relatorio.lidos += 1;
    const id = String(item?.id || '').trim();
    const valor = Math.round(Number(item?.valor) * 100) / 100;
    const tipo = String(item?.tipo || '').toLowerCase();
    const status = STATUS_JSON[String(item?.status || '').toLowerCase()];
    const venc = String(item?.vencimento || item?.dataOperacao || item?.criadoEm || '').slice(0, 10);
    if (!id || !['receita', 'despesa'].includes(tipo) || !(valor > 0) || !status || !/^\d{4}-\d{2}-\d{2}$/.test(venc)) {
      relatorio.ignorados.push({ id: id || null, motivo: 'campos obrigatórios ausentes ou inválidos' });
      continue;
    }
    const lojaLegada = String(item?.lojaId || '').trim();
    const loja = lojaLegada && mapaUnidades[lojaLegada] ? exigirUuid(mapaUnidades[lojaLegada], 'unidade') : null;
    if (!loja) relatorio.semUnidade += 1;
    const pagoEm = status === 'pago' ? new Date(item.pagoEm || item.dataOperacao || `${venc}T12:00:00Z`) : null;
    if (pagoEm && Number.isNaN(pagoEm.getTime())) { relatorio.ignorados.push({ id, motivo: 'data de pagamento inválida' }); continue; }
    relatorio.validos += 1;
    relatorio.porStatus[status] = (relatorio.porStatus[status] || 0) + 1;
    relatorio.porTipo[tipo] = (relatorio.porTipo[tipo] || 0) + 1;
    if (status === 'pago') relatorio.totais[tipo === 'receita' ? 'receitaPaga' : 'despesaPaga'] += valor;
    if (status === 'pendente') relatorio.totais[tipo === 'receita' ? 'aReceber' : 'aPagar'] += valor;
    const competencia = String(item?.dataOperacao || venc).slice(0, 10);
    linhas.push([
      empresa, loja, tipo, String(item.categoria || 'Outros').slice(0, 80), String(item.descricao || 'Lançamento importado').slice(0, 240), valor,
      /^\d{4}-\d{2}-\d{2}$/.test(competencia) ? competencia : venc, venc, status, pagoEm, item.meioPagamento ? String(item.meioPagamento).slice(0, 30) : null,
      status === 'pago' ? 'avulso' : (tipo === 'receita' ? 'receber' : 'pagar'),
      `legado_${String(item.origem || 'manual').slice(0, 32)}`, id.slice(0, 160), `json:${chaveLegada}:${id}`.slice(0, 200),
      item.automatico === true, String(item.usuario || 'importação').slice(0, 180), item.observacao ? String(item.observacao).slice(0, 2000) : null,
      status === 'cancelado' ? new Date(item.canceladoEm || item.atualizadoEm || Date.now()) : null,
    ]);
  }
  for (const k of Object.keys(relatorio.totais)) relatorio.totais[k] = Math.round(relatorio.totais[k] * 100) / 100;
  if (!aplicar || !linhas.length) return relatorio;
  await transacao(db, async (q) => {
    for (const l of linhas) {
      const r = await q(
        `INSERT INTO fin_lancamentos (empresa_id, loja_id, tipo, categoria, descricao, valor, data_competencia, vencimento, status, pago_em,
           meio_pagamento, natureza, origem, origem_id, chave, automatico, criado_por, observacao, cancelado_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT (empresa_id, chave) DO NOTHING`,
        l,
      );
      if (r.rowCount) relatorio.inseridos += 1; else relatorio.jaExistiam += 1;
    }
  });
  await garantirCategorias(db, empresa);
  void fuso;
  return relatorio;
}

/**
 * Leitura contínua do financeiro JSON (a barbearia ainda grava lá): insere o que for novo e
 * avança a situação dos já importados só para a frente (pendente → pago/cancelado). Uma baixa
 * feita no razão nunca é desfeita pelo JSON.
 */
export async function sincronizarJson(db, empresaId, { chaveLegada, lancamentos = [], mapaUnidades = {}, fuso = FUSO_PADRAO } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const rel = await importarJsonLegado(db, empresa, { chaveLegada, lancamentos, mapaUnidades, aplicar: true, fuso });
  let atualizados = 0;
  for (const item of Array.isArray(lancamentos) ? lancamentos : []) {
    const status = STATUS_JSON[String(item?.status || '').toLowerCase()];
    if (!item?.id || !status || status === 'pendente') continue;
    const chave = `json:${chaveLegada}:${String(item.id)}`.slice(0, 200);
    const pagoEm = status === 'pago' ? new Date(item.pagoEm || item.dataOperacao || Date.now()) : null;
    const r = await db.query(
      `UPDATE fin_lancamentos SET status = $3::varchar, pago_em = $4::timestamptz,
              cancelado_em = CASE WHEN $3::varchar = 'cancelado' THEN CURRENT_TIMESTAMP ELSE NULL END, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND chave = $2 AND status = 'pendente'`,
      [empresa, chave, status, pagoEm && !Number.isNaN(pagoEm.getTime()) ? pagoEm : (status === 'pago' ? new Date() : null)],
    );
    atualizados += r.rowCount;
  }
  const res = { fonte: 'json', lidos: rel.lidos, inseridos: rel.inseridos, atualizados, ignorados: rel.ignorados.length };
  await marcar(db, empresa, 'json', res);
  return res;
}

// Fontes do razão: cada módulo que mexe com dinheiro entra aqui pela própria tabela, sem mudar o
// fluxo dele. A leitura é idempotente (chave única por fato na fonte) e pode rodar quantas vezes
// for preciso: ao abrir o Financeiro e numa rotina periódica.
//
// Fonte                     | Chave                         | Vira
// bar_comanda_pagamentos    | bar_pagamento:<id>            | receita paga; "conta" (fiado) = conta a receber;
//                           |                               | venda do PDV offline leva a unidade do terminal
// clube_pagamentos_recebidos| clube:<pagamento_id>          | receita paga (Mensalidades)
// a2_contas_receber         | a2_conta:<id>                 | conta a receber; baixa na fonte → pago aqui
// commerce_payments         | loja_online:<id>              | receita paga (Loja online); devolução → estorno
// financeiro JSON (legado)  | json:<empresa legada>:<id>    | importação dos lançamentos antigos
import { ErroDominio, exigirUuid, transacao } from '../acesso/banco.js';
import { FUSO_PADRAO, garantirCategorias, hojeNoFuso, lojaPadraoDaFonte, marcarRazaoLigado, obterConfig } from './servico.js';
import { createHash } from 'node:crypto';

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
  const temFechamento = await existeTabela(db, 'fin_fechamentos');
  // venda do PDV offline: a unidade é a do terminal (o bar não guarda unidade na comanda)
  const temPdvOffline = await existeTabela(db, 'pdv_eventos');
  const { razaoDesde } = await obterConfig(db, empresa);
  // Só os pagamentos que ainda não estão no razão (anti-join pela chave): reler 50 mil pagamentos
  // a cada minuto custava mais de 1 s por leitura.
  const r = await db.query(
    `INSERT INTO fin_lancamentos ${INSERT_COLS}
     WITH novos AS MATERIALIZED (
       SELECT p.* FROM bar_comanda_pagamentos p
        WHERE p.empresa_id = $1 AND p.valor > 0
          AND NOT EXISTS (SELECT 1 FROM fin_lancamentos l WHERE l.empresa_id = $1 AND l.chave = 'bar_pagamento:' || p.id))
     SELECT p.empresa_id, LOJA, 'receita', 'Bar e restaurante',
            left('Comanda ' || COALESCE(NULLIF(c.nome, ''), 'do bar') || CASE WHEN p.meio IS NOT NULL THEN ' · ' || p.meio ELSE '' END
                 || CASE WHEN lower(p.meio) = 'conta' AND NOT fi.aberto THEN ' · fiado anterior ao Financeiro' ELSE '' END, 240),
            p.valor, d.competencia,
            -- "conta" é venda fiada: vira conta a receber do cliente, com 30 dias para pagar. Fiado de antes
            -- do Financeiro novo entra como recebido: a baixa aconteceu fora do sistema e viraria inadimplência falsa.
            CASE WHEN fi.aberto THEN d.competencia + 30 ELSE d.competencia END,
            CASE WHEN fi.aberto THEN 'pendente' ELSE 'pago' END,
            CASE WHEN fi.aberto THEN NULL ELSE p.criado_em END,
            CASE lower(p.meio) WHEN 'cartao' THEN 'credito' WHEN 'cartao_debito' THEN 'debito' WHEN 'tef' THEN 'credito' WHEN 'pix' THEN 'pix'
              WHEN 'dinheiro' THEN 'dinheiro' WHEN 'carteira' THEN 'voucher' WHEN 'conta' THEN NULL ELSE 'outro' END,
            CASE WHEN fi.aberto THEN 'receber' ELSE 'avulso' END,
            CASE WHEN c.cliente_id IS NOT NULL THEN 'cliente' END, c.cliente_id, cc.nome,
            'bar_comanda', c.id::text, 'bar_pagamento:' || p.id, true, 'sistema'
       FROM novos p
       JOIN bar_comandas c ON c.empresa_id = p.empresa_id AND c.id = p.comanda_id
       LEFT JOIN commerce_customers cc ON cc.empresa_id = c.empresa_id AND cc.id = c.cliente_id
       ${temPdvOffline ? `LEFT JOIN LATERAL (SELECT t.loja_id FROM pdv_eventos e JOIN pdv_terminais t ON t.empresa_id = e.empresa_id AND t.id = e.terminal_id
                                         WHERE e.empresa_id = c.empresa_id AND e.comanda_id = c.id LIMIT 1) pdv ON true` : ''}
       -- pagamento com data de um dia já fechado (venda que chegou atrasada) entra no dia de hoje
       CROSS JOIN LATERAL (SELECT CASE WHEN ${temFechamento ? `EXISTS (SELECT 1 FROM fin_fechamentos f WHERE f.empresa_id = p.empresa_id AND (f.loja_id IS NULL OR f.loja_id = LOJA) AND f.data = (p.criado_em AT TIME ZONE $2)::date)` : 'false'}
                                       THEN (CURRENT_TIMESTAMP AT TIME ZONE $2)::date ELSE (p.criado_em AT TIME ZONE $2)::date END AS competencia) d
       CROSS JOIN LATERAL (SELECT lower(p.meio) = 'conta' AND ($4::timestamptz IS NULL OR (p.criado_em AT TIME ZONE $2)::date >= ($4::timestamptz AT TIME ZONE $2)::date) AS aberto) fi
     ON CONFLICT (empresa_id, chave) DO NOTHING`.replaceAll('LOJA', temPdvOffline ? 'COALESCE(pdv.loja_id, $3::uuid)' : '$3::uuid'),
    [empresa, fuso, await lojaPadraoDaFonte(db, empresa, 'bar'), razaoDesde],
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
  const loja = await lojaPadraoDaFonte(db, empresa, 'clube');
  // cobrança em aberto (mensalidade, acordo, avulsa) já aparece como conta a receber; a mesma
  // chave do pagamento faz o pagamento dar baixa nela em vez de virar outro lançamento
  let aReceber = { rowCount: 0 };
  if (temCobranca) {
    aReceber = await db.query(
      `INSERT INTO fin_lancamentos ${INSERT_COLS}
       SELECT cb.empresa_id, $3::uuid, 'receita', 'Mensalidades', left(cb.descricao || ' · ' || COALESCE(cc.nome, 'aluno'), 240), cb.valor,
              (cb.enviar_em AT TIME ZONE $2)::date, (cb.enviar_em AT TIME ZONE $2)::date, 'pendente', NULL, NULL,
              'receber', 'cliente', cb.customer_id, cc.nome,
              'clube_pagamento', 'clube-cobranca:' || cb.id, 'clube:clube-cobranca:' || cb.id, true, 'sistema'
         FROM clube_cobrancas cb
         LEFT JOIN commerce_customers cc ON cc.empresa_id = cb.empresa_id AND cc.id = cb.customer_id
        WHERE cb.empresa_id = $1 AND cb.status = 'pendente'
          AND NOT EXISTS (SELECT 1 FROM fin_lancamentos l WHERE l.empresa_id = $1 AND l.chave = 'clube:clube-cobranca:' || cb.id)
       ON CONFLICT (empresa_id, chave) DO NOTHING`,
      [empresa, fuso, loja]);
  }
  const r = await db.query(
    `INSERT INTO fin_lancamentos ${INSERT_COLS}
     SELECT p.empresa_id, $3::uuid, 'receita', 'Mensalidades',
            left(COALESCE(${temCobranca ? 'cb.descricao' : 'NULL'}, 'Pagamento do clube') || ' · ' || COALESCE(cc.nome, 'aluno'), 240),
            p.valor, (p.criado_em AT TIME ZONE $2)::date, (p.criado_em AT TIME ZONE $2)::date, 'pago', p.criado_em,
            CASE WHEN p.pagamento_id LIKE 'clube-cobranca:%' THEN 'pix' ELSE NULL END,
            'avulso', 'cliente', p.customer_id, cc.nome,
            'clube_pagamento', p.pagamento_id, 'clube:' || p.pagamento_id, true, 'sistema'
       FROM clube_pagamentos_recebidos p
       LEFT JOIN commerce_customers cc ON cc.empresa_id = p.empresa_id AND cc.id = p.customer_id
       ${temCobranca ? `LEFT JOIN clube_cobrancas cb ON cb.empresa_id = p.empresa_id AND p.pagamento_id = 'clube-cobranca:' || cb.id::text` : ''}
      WHERE p.empresa_id = $1 AND p.valor IS NOT NULL AND p.valor > 0
        AND NOT EXISTS (SELECT 1 FROM fin_lancamentos l WHERE l.empresa_id = $1 AND l.chave = 'clube:' || p.pagamento_id)
     ON CONFLICT (empresa_id, chave) DO NOTHING`,
    [empresa, fuso, loja],
  );
  let baixados = 0;
  if (temCobranca) {
    // pagamento de uma cobrança que já estava a receber: baixa nela (valor e data do pagamento)
    const b = await db.query(
      `UPDATE fin_lancamentos l SET status = 'pago', pago_em = p.criado_em, valor = p.valor, meio_pagamento = 'pix', atualizado_em = CURRENT_TIMESTAMP
         FROM clube_pagamentos_recebidos p
        WHERE l.empresa_id = $1 AND p.empresa_id = l.empresa_id AND l.chave = 'clube:' || p.pagamento_id
          AND l.status = 'pendente' AND p.valor IS NOT NULL AND p.valor > 0`, [empresa]);
    // cobrança cancelada (inclusive paga na recepção por outro meio): a conta a receber sai
    const c = await db.query(
      `UPDATE fin_lancamentos l SET status = 'cancelado', cancelado_em = COALESCE(cb.cancelado_em, CURRENT_TIMESTAMP), atualizado_em = CURRENT_TIMESTAMP
         FROM clube_cobrancas cb
        WHERE l.empresa_id = $1 AND cb.empresa_id = l.empresa_id AND l.chave = 'clube:clube-cobranca:' || cb.id
          AND l.status = 'pendente' AND cb.status = 'cancelada'`, [empresa]);
    baixados = b.rowCount + c.rowCount;
  }
  const total = await db.query('SELECT count(*)::int AS n FROM clube_pagamentos_recebidos WHERE empresa_id = $1', [empresa]);
  const res = { fonte: 'clube', lidos: total.rows[0].n, inseridos: r.rowCount + aReceber.rowCount, atualizados: baixados };
  await marcar(db, empresa, 'clube', res);
  return res;
}

/** Contas a receber do A2: nascem pendentes; quando a fonte dá baixa, o razão marca como pago. */
export async function sincronizarContasReceber(db, empresaId, { fuso = FUSO_PADRAO } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!(await existeTabela(db, 'a2_contas_receber'))) return { fonte: 'a2', ignorada: true };
  const ins = await db.query(
    `INSERT INTO fin_lancamentos ${INSERT_COLS}
     SELECT a.empresa_id, $3::uuid, 'receita', 'Contas de clientes', left(a.descricao, 240), a.valor,
            (a.criado_em AT TIME ZONE $2)::date, a.data_vencimento,
            CASE WHEN a.data_pagamento IS NULL THEN 'pendente' ELSE 'pago' END, a.data_pagamento,
            NULL, 'receber', 'cliente', a.cliente_id, cc.nome,
            'a2_conta', a.id::text, 'a2_conta:' || a.id, true, 'sistema'
       FROM a2_contas_receber a
       LEFT JOIN commerce_customers cc ON cc.empresa_id = a.empresa_id AND cc.id = a.cliente_id
      WHERE a.empresa_id = $1
        AND NOT EXISTS (SELECT 1 FROM fin_lancamentos l WHERE l.empresa_id = $1 AND l.chave = 'a2_conta:' || a.id)
     ON CONFLICT (empresa_id, chave) DO NOTHING`,
    [empresa, fuso, await lojaPadraoDaFonte(db, empresa, 'a2')],
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
     SELECT p.empresa_id, COALESCE(o.loja_id, $3::uuid), 'receita', 'Loja online', left('Pedido ' || o.public_code, 240), p.amount,
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
        AND NOT EXISTS (SELECT 1 FROM fin_lancamentos l WHERE l.empresa_id = $1 AND l.chave = 'loja_online:' || p.id)
     ON CONFLICT (empresa_id, chave) DO NOTHING`,
    [empresa, fuso, await lojaPadraoDaFonte(db, empresa, 'loja_online')],
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
        AND NOT EXISTS (SELECT 1 FROM fin_lancamentos e WHERE e.empresa_id = $1 AND e.chave = 'estorno:' || l.id)
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
  await marcarRazaoLigado(db, empresa);
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

// Categorias do financeiro antigo que não existem no razão → equivalente no plano de contas.
export const CATEGORIAS_LEGADAS = {
  receita: { 'Barbearia - Revenda': 'Vendas de produtos', 'Bar/Lanchonete': 'Bar e restaurante', 'Comissões - estorno': 'Estorno de comissões' },
  despesa: { 'Comissões - vale': 'Comissões', 'Alimentação/Bebidas': 'Compras de mercadoria' },
};

/** Dia do fato no fuso da empresa: data pura fica como está; data e hora (ISO) é convertida. */
function diaNoFuso(valor, fuso) {
  const t = String(valor || '').trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : hojeNoFuso(d, fuso);
}

/**
 * Importa os lançamentos do financeiro JSON de uma empresa para o razão.
 * `lancamentos` = Object.values(db().financeiroKytto.empresas[chaveLegada].lancamentos).
 * `mapaUnidades` = { lojaIdLegado: lojaUuid } (o que não estiver no mapa entra sem unidade).
 * Itens sem unidade nenhuma estão em quarentena no financeiro antigo (a tela antiga não mostra):
 * ficam de fora, salvo `incluirQuarentena`. Reversões do antigo viram estorno do original no
 * razão (o razão não deixa estornar de novo). `aplicar=false` só simula; nada é gravado.
 */
export async function importarJsonLegado(db, empresaId, { chaveLegada, lancamentos = [], mapaUnidades = {}, aplicar = false, incluirQuarentena = false, fuso = FUSO_PADRAO } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!chaveLegada) throw new ErroDominio('VALIDATION_ERROR', 'chaveLegada é obrigatória');
  const relatorio = { chaveLegada, lidos: 0, validos: 0, ignorados: [], quarentena: 0, reversoes: 0, porStatus: {}, porTipo: {}, totais: { receitaPaga: 0, despesaPaga: 0, aReceber: 0, aPagar: 0 }, semUnidade: 0, inseridos: 0, jaExistiam: 0, aplicado: aplicar === true };
  const linhas = [];
  for (const item of Array.isArray(lancamentos) ? lancamentos : []) {
    relatorio.lidos += 1;
    const id = String(item?.id || '').trim();
    const valor = Math.round(Number(item?.valor) * 100) / 100;
    const tipo = String(item?.tipo || '').toLowerCase();
    const status = STATUS_JSON[String(item?.status || '').toLowerCase()];
    const venc = diaNoFuso(item?.vencimento || item?.dataOperacao || item?.criadoEm, fuso);
    if (!id || !['receita', 'despesa'].includes(tipo) || !(valor > 0) || !status || !venc) {
      relatorio.ignorados.push({ id: id || null, motivo: 'campos obrigatórios ausentes ou inválidos' });
      continue;
    }
    const lojaLegada = String(item?.lojaId || '').trim();
    if (!lojaLegada && !incluirQuarentena) { relatorio.quarentena += 1; continue; }
    const loja = lojaLegada && mapaUnidades[lojaLegada] ? exigirUuid(mapaUnidades[lojaLegada], 'unidade') : null;
    if (!loja) relatorio.semUnidade += 1;
    const pagoEm = status === 'pago' ? new Date(item.pagoEm || item.dataOperacao || `${venc}T12:00:00Z`) : null;
    if (pagoEm && Number.isNaN(pagoEm.getTime())) { relatorio.ignorados.push({ id, motivo: 'data de pagamento inválida' }); continue; }
    relatorio.validos += 1;
    relatorio.porStatus[status] = (relatorio.porStatus[status] || 0) + 1;
    relatorio.porTipo[tipo] = (relatorio.porTipo[tipo] || 0) + 1;
    if (status === 'pago') relatorio.totais[tipo === 'receita' ? 'receitaPaga' : 'despesaPaga'] += valor;
    if (status === 'pendente') relatorio.totais[tipo === 'receita' ? 'aReceber' : 'aPagar'] += valor;
    const original = String(item?.lancamentoOriginalId || '').trim() || null;
    if (original) relatorio.reversoes += 1;
    const categoriaBruta = String(item.categoria || 'Outros').slice(0, 80);
    linhas.push({
      original,
      valores: [
        empresa, loja, tipo, CATEGORIAS_LEGADAS[tipo]?.[categoriaBruta] || categoriaBruta, String(item.descricao || 'Lançamento importado').slice(0, 240), valor,
        diaNoFuso(item?.dataOperacao, fuso) || venc, venc, status, pagoEm, item.meioPagamento ? String(item.meioPagamento).slice(0, 30) : null,
        status === 'pago' ? 'avulso' : (tipo === 'receita' ? 'receber' : 'pagar'),
        `legado_${String(item.origem || 'manual').slice(0, 32)}`, id.slice(0, 160), `json:${chaveLegada}:${id}`.slice(0, 200),
        item.automatico === true, String(item.usuario || 'importação').slice(0, 180), item.observacao ? String(item.observacao).slice(0, 2000) : null,
        status === 'cancelado' ? new Date(item.canceladoEm || item.atualizadoEm || Date.now()) : null,
      ],
    });
  }
  for (const k of Object.keys(relatorio.totais)) relatorio.totais[k] = Math.round(relatorio.totais[k] * 100) / 100;
  if (!aplicar || !linhas.length) return relatorio;
  // só o que ainda não está no razão (a leitura contínua não reenvia milhares de linhas a cada vez)
  const existentes = new Set((await db.query('SELECT chave FROM fin_lancamentos WHERE empresa_id = $1 AND chave = ANY($2::text[])', [empresa, linhas.map((l) => l.valores[14])])).rows.map((r) => r.chave));
  relatorio.jaExistiam += existentes.size;
  const novas = linhas.filter((l) => !existentes.has(l.valores[14]));
  if (!novas.length) return relatorio;
  // Em lote (jsonb_to_recordset, 1.000 por vez): um INSERT por lançamento gerava 18 mil queries e
  // centenas de MB de memória nativa numa importação de 20 mil lançamentos.
  const colunas = ['empresa_id', 'loja_id', 'tipo', 'categoria', 'descricao', 'valor', 'data_competencia', 'vencimento', 'status', 'pago_em',
    'meio_pagamento', 'natureza', 'origem', 'origem_id', 'chave', 'automatico', 'criado_por', 'observacao', 'cancelado_em'];
  const tipos = ['uuid', 'uuid', 'text', 'text', 'text', 'numeric', 'date', 'date', 'text', 'timestamptz', 'text', 'text', 'text', 'text', 'text', 'boolean', 'text', 'text', 'timestamptz'];
  const comoRegistro = (valores, estornoDe = null) => Object.fromEntries([...colunas.map((c, i) => [c, valores[i] instanceof Date ? valores[i].toISOString() : valores[i]]), ['estorno_de', estornoDe]]);
  await transacao(db, async (q) => {
    const inserir = async (registros) => {
      for (let i = 0; i < registros.length; i += 1000) {
        const r = await q(
          `INSERT INTO fin_lancamentos (${colunas.join(', ')}, estorno_de)
           SELECT ${colunas.map((c) => `x.${c}`).join(', ')}, x.estorno_de
             FROM jsonb_to_recordset($1::jsonb) AS x(${colunas.map((c, j) => `${c} ${tipos[j]}`).join(', ')}, estorno_de uuid)
           ON CONFLICT (empresa_id, chave) DO NOTHING`, [JSON.stringify(registros.slice(i, i + 1000))]);
        relatorio.inseridos += r.rowCount;
        relatorio.jaExistiam += Math.min(1000, registros.length - i) - r.rowCount;
      }
    };
    // originais antes das reversões, para a reversão achar o original já no razão
    await inserir(novas.filter((x) => !x.original).map((l) => comoRegistro(l.valores)));
    const reversoes = novas.filter((x) => x.original);
    if (reversoes.length) {
      const chavesOriginais = reversoes.map((l) => `json:${chaveLegada}:${l.original}`.slice(0, 200));
      const idPorChave = new Map((await q('SELECT chave, id FROM fin_lancamentos WHERE empresa_id = $1 AND chave = ANY($2::text[])', [empresa, chavesOriginais])).rows.map((r) => [r.chave, r.id]));
      await inserir(reversoes.map((l, i) => {
        const valores = [...l.valores];
        const estornoDe = idPorChave.get(chavesOriginais[i]) || null;
        if (estornoDe) {
          valores[12] = 'estorno';
          valores[14] = `estorno:${estornoDe}`; // mesma chave do estorno feito no razão: nunca dois estornos
        }
        return comoRegistro(valores, estornoDe);
      }));
    }
  });
  await garantirCategorias(db, empresa);
  return relatorio;
}

/**
 * Leitura contínua do financeiro JSON (a barbearia ainda grava lá): insere o que for novo e
 * avança a situação dos já importados só para a frente (pendente → pago/cancelado), num único
 * UPDATE. Uma baixa feita no razão nunca é desfeita pelo JSON.
 */
const IMPRESSAO_JSON = new Map(); // empresa:chave legada → hash do último JSON lido

export async function sincronizarJson(db, empresaId, { chaveLegada, lancamentos = [], mapaUnidades = {}, fuso = FUSO_PADRAO } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  // só depois do ensaio conferido e liberado pela administração da plataforma
  const cfg = await obterConfig(db, empresa);
  if (!cfg.jsonLiberadoEm) return { fonte: 'json', aguardandoLiberacao: true };
  // JSON igual ao da última leitura: nada a fazer (a rotina e as telas leem a cada poucos minutos)
  const impressao = createHash('sha1').update(JSON.stringify([lancamentos, mapaUnidades, cfg.jsonIncluirQuarentena, String(cfg.jsonLiberadoEm)])).digest('hex');
  const chaveImpressao = `${empresa}:${chaveLegada}`;
  if (IMPRESSAO_JSON.get(chaveImpressao) === impressao) return { fonte: 'json', semMudanca: true };
  const rel = await importarJsonLegado(db, empresa, { chaveLegada, lancamentos, mapaUnidades, aplicar: true, incluirQuarentena: cfg.jsonIncluirQuarentena, fuso });
  const chaves = []; const situacoes = []; const pagos = [];
  for (const item of Array.isArray(lancamentos) ? lancamentos : []) {
    const status = STATUS_JSON[String(item?.status || '').toLowerCase()];
    if (!item?.id || !status || status === 'pendente') continue;
    const pagoEm = status === 'pago' ? new Date(item.pagoEm || item.dataOperacao || Date.now()) : null;
    chaves.push(`json:${chaveLegada}:${String(item.id)}`.slice(0, 200));
    situacoes.push(status);
    pagos.push(status === 'pago' ? (pagoEm && !Number.isNaN(pagoEm.getTime()) ? pagoEm.toISOString() : new Date().toISOString()) : null);
  }
  let atualizados = 0;
  if (chaves.length) {
    const r = await db.query(
      `UPDATE fin_lancamentos l SET status = u.status, pago_em = u.pago_em,
              cancelado_em = CASE WHEN u.status = 'cancelado' THEN CURRENT_TIMESTAMP ELSE NULL END, atualizado_em = CURRENT_TIMESTAMP
         FROM unnest($2::text[], $3::text[], $4::timestamptz[]) AS u(chave, status, pago_em)
        WHERE l.empresa_id = $1 AND l.chave = u.chave AND l.status = 'pendente'`,
      [empresa, chaves, situacoes, pagos],
    );
    atualizados = r.rowCount;
  }
  // lançamento apagado do JSON que no razão ainda está em aberto: sai (cancelado), como saiu de lá
  const todasAsChaves = (Array.isArray(lancamentos) ? lancamentos : []).filter((i) => i?.id).map((i) => `json:${chaveLegada}:${String(i.id)}`.slice(0, 200));
  // JSON vazio ou que encolheu de repente (restauração, arquivo corrompido) não apaga nada: só
  // cancela quando a lista lida tem pelo menos 80% do que já entrou no razão
  const jaNoRazao = Number((await db.query("SELECT count(*)::int AS n FROM fin_lancamentos WHERE empresa_id = $1 AND chave LIKE $2", [empresa, `json:${chaveLegada.replace(/[\\%_]/g, (c) => `\\${c}`)}:%`])).rows[0].n);
  const confiavel = todasAsChaves.length > 0 && todasAsChaves.length >= jaNoRazao * 0.8;
  const apagados = !confiavel ? { rowCount: 0 } : await db.query(
    `UPDATE fin_lancamentos SET status = 'cancelado', cancelado_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP,
            observacao = left(COALESCE(observacao || ' · ', '') || 'apagado no financeiro antigo', 2000)
      WHERE empresa_id = $1 AND chave LIKE $2 AND status = 'pendente' AND NOT (chave = ANY($3::text[]))`,
    [empresa, `json:${chaveLegada.replace(/[\\%_]/g, (c) => `\\${c}`)}:%`, todasAsChaves]);
  atualizados += apagados.rowCount;
  const res = { fonte: 'json', lidos: rel.lidos, inseridos: rel.inseridos, atualizados, ignorados: rel.ignorados.length, quarentena: rel.quarentena };
  await marcar(db, empresa, 'json', res);
  IMPRESSAO_JSON.set(chaveImpressao, impressao);
  return res;
}

/**
 * Conferência da migração do financeiro antigo: o que o JSON tem (válidos, quarentena sem
 * unidade, ignorados) × o que está no razão com a chave do JSON, por tipo e situação, centavo a
 * centavo, e a lista do que falta. Não grava nada.
 */
export async function conferirJsonLegado(db, empresaId, { chaveLegada, lancamentos = [], mapaUnidades = {}, incluirQuarentena = false, fuso = FUSO_PADRAO } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const ensaio = await importarJsonLegado(db, empresa, { chaveLegada, lancamentos, mapaUnidades, aplicar: false, incluirQuarentena, fuso });
  const lista = Array.isArray(lancamentos) ? lancamentos : [];
  const quarentena = []; const porUnidadeLegada = {};
  const esperado = {}; const chaves = [];
  for (const item of lista) {
    const id = String(item?.id || '').trim();
    const tipo = String(item?.tipo || '').toLowerCase();
    const status = STATUS_JSON[String(item?.status || '').toLowerCase()];
    const valor = Math.round(Number(item?.valor) * 100) / 100;
    if (!id || !['receita', 'despesa'].includes(tipo) || !(valor > 0) || !status) continue;
    const lojaLegada = String(item?.lojaId || '').trim();
    porUnidadeLegada[lojaLegada || '(sem unidade)'] = (porUnidadeLegada[lojaLegada || '(sem unidade)'] || 0) + 1;
    if (!lojaLegada && !incluirQuarentena) {
      if (quarentena.length < 300) quarentena.push({ id, tipo, status, valor, data: String(item.vencimento || item.dataOperacao || item.criadoEm || '').slice(0, 10), descricao: String(item.descricao || '').slice(0, 120), origem: String(item.origem || 'manual').slice(0, 40) });
      continue;
    }
    if (ensaio.ignorados.some((x) => x.id === id)) continue;
    const k = `${tipo}:${status}`;
    esperado[k] = esperado[k] || { tipo, status, quantidade: 0, valor: 0 };
    esperado[k].quantidade += 1; esperado[k].valor = Math.round((esperado[k].valor + valor) * 100) / 100;
    chaves.push(`json:${chaveLegada}:${id}`.slice(0, 200));
  }
  const noRazao = {};
  const presentes = new Set();
  if (chaves.length) {
    // reversão do antigo entra como estorno do original (chave estorno:…), com o id do JSON em origem_id
    const ids = chaves.map((c) => c.split(':').slice(2).join(':'));
    const conjunto = new Set(chaves);
    const r = await db.query(
      `SELECT CASE WHEN origem = 'estorno' AND chave LIKE 'estorno:%' THEN $3 || origem_id ELSE chave END AS chave, tipo, status, valor
         FROM fin_lancamentos WHERE empresa_id = $1 AND (chave = ANY($2::text[]) OR (origem = 'estorno' AND origem_id = ANY($4::text[]) AND criado_por <> 'sistema'))`,
      [empresa, chaves, `json:${chaveLegada}:`, ids]);
    for (const row of r.rows) {
      if (!conjunto.has(row.chave) || presentes.has(row.chave)) continue;
      presentes.add(row.chave);
      const k = `${row.tipo}:${row.status}`;
      noRazao[k] = noRazao[k] || { tipo: row.tipo, status: row.status, quantidade: 0, valor: 0 };
      noRazao[k].quantidade += 1; noRazao[k].valor = Math.round((noRazao[k].valor + Number(row.valor)) * 100) / 100;
    }
  }
  const linhas = [...new Set([...Object.keys(esperado), ...Object.keys(noRazao)])].sort().map((k) => {
    const a = esperado[k] || { quantidade: 0, valor: 0 }; const b = noRazao[k] || { quantidade: 0, valor: 0 };
    const [tipo, status] = k.split(':');
    return { tipo, status, json: { quantidade: a.quantidade, valor: a.valor }, razao: { quantidade: b.quantidade, valor: b.valor }, diferenca: Math.round((a.valor - b.valor) * 100) / 100 };
  });
  const faltando = chaves.filter((c) => !presentes.has(c)).slice(0, 300).map((c) => c.split(':').slice(2).join(':'));
  return {
    chaveLegada, ensaio, conferencia: linhas,
    fecha: linhas.every((l) => l.diferenca === 0 && l.json.quantidade === l.razao.quantidade),
    faltandoNoRazao: faltando, totalFaltando: chaves.length - presentes.size,
    quarentena: { quantidade: ensaio.quarentena, itens: quarentena, incluida: incluirQuarentena === true },
    porUnidadeLegada,
  };
}

/** Libera a leitura contínua do JSON (depois do ensaio) e importa agora. */
export async function liberarJsonLegado(db, empresaId, { chaveLegada, lancamentos = [], mapaUnidades = {}, incluirQuarentena = false, usuario = null, fuso = FUSO_PADRAO } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const relatorio = await importarJsonLegado(db, empresa, { chaveLegada, lancamentos, mapaUnidades, aplicar: true, incluirQuarentena, fuso });
  await db.query(
    `INSERT INTO fin_config (empresa_id, json_liberado_em, json_liberado_por, json_incluir_quarentena) VALUES ($1, CURRENT_TIMESTAMP, $2, $3)
     ON CONFLICT (empresa_id) DO UPDATE SET json_liberado_em = CURRENT_TIMESTAMP, json_liberado_por = EXCLUDED.json_liberado_por,
       json_incluir_quarentena = EXCLUDED.json_incluir_quarentena, atualizado_em = CURRENT_TIMESTAMP`,
    [empresa, String(usuario || 'plataforma').slice(0, 180), incluirQuarentena === true]);
  await garantirCategorias(db, empresa);
  return { relatorio, conferencia: await conferirJsonLegado(db, empresa, { chaveLegada, lancamentos, mapaUnidades, incluirQuarentena, fuso }) };
}

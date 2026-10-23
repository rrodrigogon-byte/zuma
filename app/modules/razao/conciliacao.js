// Conciliação bancária (migração 093): extrato OFX × razão.
//
// - importar: lê o OFX, cria/acha a conta bancária e grava as linhas (FITID único: reimportar
//   não duplica);
// - sugerir: para cada linha pendente, lançamentos do razão com o mesmo tipo e valor exato, pagos
//   perto da data (±3 dias) ou pendentes vencendo perto (±10 dias);
// - conciliar: liga a linha ao lançamento; se ele estava pendente (Pix de cliente, boleto pago),
//   dá a baixa com a data do extrato — e a baixa vale na origem (A2) como qualquer baixa do razão;
// - automático: só concilia sozinho quando há um candidato só, ou um claramente melhor.
import crypto from 'node:crypto';
import { ErroDominio, exigirTexto, exigirUuid, transacao } from '../acesso/banco.js';
import * as svc from './servico.js';
import { lerOfx, decodificarOfx } from './ofx.js';

const dinheiro = (v) => Math.round(Number(v || 0) * 100) / 100;
const textoOpcional = (v, max) => { const t = String(v ?? '').trim(); return t ? t.slice(0, max) : null; };
const normalizar = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const diasEntre = (a, b) => Math.round((new Date(`${a}T12:00:00Z`) - new Date(`${b}T12:00:00Z`)) / 864e5);
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || '').slice(0, 10));

/** Um "db" que roda tudo dentro da transação aberta (para reaproveitar os serviços do razão). */
function naTransacao(q) {
  return { query: q, beginTransaction: async () => null, queryInTransaction: (_c, t, v) => q(t, v), commit: async () => {}, rollback: async () => {} };
}

// ── contas ───────────────────────────────────────────────────────────────────
function contaDto(r) { return { id: r.id, lojaId: r.loja_id || null, nome: r.nome, banco: r.banco || null, agencia: r.agencia || null, conta: r.conta || null, ativo: r.ativo }; }

export async function listarContas(db, empresaId) {
  const r = await db.query('SELECT * FROM fin_contas_bancarias WHERE empresa_id = $1 ORDER BY ativo DESC, nome', [exigirUuid(empresaId, 'empresa')]);
  return r.rows.map(contaDto);
}

export async function salvarConta(db, empresaId, dados = {}, id = null) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const loja = dados.lojaId ? exigirUuid(dados.lojaId, 'unidade') : null;
  if (loja && !(await db.query('SELECT 1 FROM lojas WHERE empresa_id = $1 AND id = $2', [empresa, loja])).rows[0]) throw new ErroDominio('NOT_FOUND', 'Unidade não encontrada nesta empresa', 404);
  const valores = [empresa, loja, exigirTexto(dados.nome, 'Nome da conta', { min: 2, max: 120 }), textoOpcional(dados.banco, 10), textoOpcional(dados.agencia, 20), textoOpcional(dados.conta, 30), dados.ativo !== false];
  try {
    if (id) {
      const r = await db.query('UPDATE fin_contas_bancarias SET loja_id = $2, nome = $3, banco = $4, agencia = $5, conta = $6, ativo = $7 WHERE empresa_id = $1 AND id = $8 RETURNING *', [...valores, exigirUuid(id, 'conta')]);
      if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Conta não encontrada', 404);
      return contaDto(r.rows[0]);
    }
    return contaDto((await db.query('INSERT INTO fin_contas_bancarias (empresa_id, loja_id, nome, banco, agencia, conta, ativo) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', valores)).rows[0]);
  } catch (error) {
    if (error?.code === '23505') throw new ErroDominio('CONFLICT', 'Já existe uma conta com este banco, agência e número', 409);
    throw error;
  }
}

// ── importação ───────────────────────────────────────────────────────────────
/**
 * Importa um OFX (base64 ou texto). Sem `contaId`, acha a conta pelo banco/agência/número do
 * arquivo ou cria uma. Devolve quantas linhas eram novas e o resultado da conciliação automática.
 */
export async function importarOfx(db, empresaId, { arquivoBase64 = null, texto = null, nomeArquivo = null, contaId = null, lojaId = null, conciliar = true }, { usuario = null, fuso = svc.FUSO_PADRAO } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const buffer = arquivoBase64 ? Buffer.from(String(arquivoBase64).replace(/^data:[^,]*,/, ''), 'base64') : Buffer.from(String(texto || ''), 'utf8');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new ErroDominio('VALIDATION_ERROR', 'Envie o arquivo OFX (até 5 MB)');
  const ofx = lerOfx(decodificarOfx(buffer));
  const sha = crypto.createHash('sha256').update(buffer).digest('hex');
  const res = await transacao(db, async (q) => {
    let conta = null;
    if (contaId) {
      conta = (await q('SELECT * FROM fin_contas_bancarias WHERE empresa_id = $1 AND id = $2', [empresa, exigirUuid(contaId, 'conta')])).rows[0];
      if (!conta) throw new ErroDominio('NOT_FOUND', 'Conta não encontrada', 404);
      if (lojaId && conta.loja_id && conta.loja_id !== lojaId) throw new ErroDominio('NOT_FOUND', 'Conta não encontrada', 404);
    } else if (ofx.conta) {
      await q('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`fin:conta:${empresa}:${ofx.banco}:${ofx.agencia}:${ofx.conta}`]);
      conta = (await q("SELECT * FROM fin_contas_bancarias WHERE empresa_id = $1 AND COALESCE(banco, '') = COALESCE($2, '') AND COALESCE(agencia, '') = COALESCE($3, '') AND conta = $4", [empresa, ofx.banco, ofx.agencia, ofx.conta])).rows[0];
      if (!conta) conta = (await q('INSERT INTO fin_contas_bancarias (empresa_id, loja_id, nome, banco, agencia, conta) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [empresa, lojaId || null, `Banco ${ofx.banco || ''} · ${ofx.conta}`.trim().slice(0, 120), ofx.banco, ofx.agencia, ofx.conta])).rows[0];
    }
    if (!conta) throw new ErroDominio('VALIDATION_ERROR', 'O arquivo não informa a conta: escolha a conta bancária', 422);
    if (lojaId && conta.loja_id && conta.loja_id !== lojaId) throw new ErroDominio('NOT_FOUND', 'Conta não encontrada', 404);
    const extrato = (await q(
      `INSERT INTO fin_extratos (empresa_id, conta_id, arquivo, sha256, inicio, fim, saldo_final, linhas, importado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [empresa, conta.id, textoOpcional(nomeArquivo, 200), sha, ofx.inicio, ofx.fim, ofx.saldoFinal, ofx.transacoes.length, textoOpcional(usuario, 180)])).rows[0];
    let novas = 0;
    for (const t of ofx.transacoes) {
      const r = await q(
        `INSERT INTO fin_extrato_linhas (empresa_id, conta_id, extrato_id, fitid, data, valor, tipo, descricao, documento) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (empresa_id, conta_id, fitid) DO NOTHING`,
        [empresa, conta.id, extrato.id, t.fitid, t.data, t.valor, t.tipo, t.descricao, t.documento]);
      novas += r.rowCount;
    }
    await q('UPDATE fin_extratos SET novas = $3 WHERE empresa_id = $1 AND id = $2', [empresa, extrato.id, novas]);
    return { conta: contaDto(conta), extratoId: extrato.id, lidas: ofx.transacoes.length, novas, descartadas: ofx.descartadas.length, saldoFinal: ofx.saldoFinal, inicio: ofx.inicio, fim: ofx.fim };
  });
  if (conciliar) res.automatico = await conciliarAutomatico(db, empresa, { contaId: res.conta.id, usuario, fuso });
  return res;
}

// ── sugestões e conciliação ──────────────────────────────────────────────────
function linhaDto(r) {
  return { id: r.id, contaId: r.conta_id, fitid: r.fitid, data: iso(r.data), valor: Number(r.valor), tipo: r.tipo || null, descricao: r.descricao, documento: r.documento || null, status: r.status, lancamentoId: r.lancamento_id || null, regra: r.regra || null, conciliadoPor: r.conciliado_por || null, conciliadoEm: r.conciliado_em };
}

async function candidatos(q, empresa, linha, { fuso = svc.FUSO_PADRAO, lojaConta = null } = {}) {
  const tipo = Number(linha.valor) > 0 ? 'receita' : 'despesa';
  const valor = dinheiro(Math.abs(Number(linha.valor)));
  const data = iso(linha.data);
  const r = await q(
    `SELECT l.*, (l.pago_em AT TIME ZONE $6)::date AS dia_pago FROM fin_lancamentos l
      WHERE l.empresa_id = $1 AND l.tipo = $2 AND l.valor = $3 AND l.status IN ('pago', 'pendente')
        AND NOT EXISTS (SELECT 1 FROM fin_extrato_linhas x WHERE x.empresa_id = l.empresa_id AND x.lancamento_id = l.id)
        AND ((l.status = 'pago' AND (l.pago_em AT TIME ZONE $6)::date BETWEEN $4::date - 3 AND $4::date + 3)
          OR (l.status = 'pendente' AND l.vencimento BETWEEN $4::date - 10 AND $4::date + 10))
        AND ($5::uuid IS NULL OR l.loja_id IS NULL OR l.loja_id = $5::uuid)
      LIMIT 50`,
    [empresa, tipo, valor, data, lojaConta, fuso]);
  const texto = normalizar(linha.descricao);
  return r.rows.map((l) => {
    const referencia = l.status === 'pago' ? iso(l.dia_pago) : iso(l.vencimento);
    const dist = Math.abs(diasEntre(data, referencia));
    const nome = normalizar(l.contraparte_nome).split(/\s+/).filter((p) => p.length >= 3);
    const casaNome = nome.length > 0 && nome.some((p) => texto.includes(p));
    const casaDoc = l.documento && texto.includes(normalizar(l.documento));
    const pontos = 100 - dist * 6 + (casaNome ? 25 : 0) + (casaDoc ? 25 : 0) + (l.status === 'pago' ? 5 : 0);
    return { lancamento: svc.dto(l), pontos, dias: dist, casaNome: Boolean(casaNome || casaDoc) };
  }).sort((a, b) => b.pontos - a.pontos);
}

export async function listarLinhas(db, empresaId, { contaId = null, status = 'pendente', lojaId = null, limite = 300, fuso = svc.FUSO_PADRAO, comSugestoes = true } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const v = [empresa]; let sql = 'SELECT x.*, c.loja_id AS loja_conta FROM fin_extrato_linhas x JOIN fin_contas_bancarias c ON c.empresa_id = x.empresa_id AND c.id = x.conta_id WHERE x.empresa_id = $1';
  if (contaId) { v.push(exigirUuid(contaId, 'conta')); sql += ` AND x.conta_id = $${v.length}`; }
  if (status && ['pendente', 'conciliado', 'ignorado'].includes(status)) { v.push(status); sql += ` AND x.status = $${v.length}`; }
  if (lojaId) { v.push(exigirUuid(lojaId, 'unidade')); sql += ` AND c.loja_id = $${v.length}`; }
  const r = await db.query(`${sql} ORDER BY x.data DESC, x.criado_em DESC LIMIT ${Math.min(Math.max(Number(limite) || 300, 1), 1000)}`, v);
  const saida = [];
  for (const row of r.rows) {
    const item = linhaDto(row);
    if (comSugestoes && row.status === 'pendente') item.sugestoes = (await candidatos((t, vv) => db.query(t, vv), empresa, row, { fuso, lojaConta: row.loja_conta })).slice(0, 5);
    saida.push(item);
  }
  return saida;
}

/** Liga a linha ao lançamento; lançamento pendente recebe a baixa com a data do extrato. */
export async function conciliar(db, empresaId, linhaId, lancamentoId, { usuario = null, regra = 'manual', fuso = svc.FUSO_PADRAO, lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  return transacao(db, async (q) => {
    const linha = (await q('SELECT x.*, c.loja_id AS loja_conta FROM fin_extrato_linhas x JOIN fin_contas_bancarias c ON c.empresa_id = x.empresa_id AND c.id = x.conta_id WHERE x.empresa_id = $1 AND x.id = $2 FOR UPDATE OF x', [empresa, exigirUuid(linhaId, 'linha')])).rows[0];
    if (!linha || (lojaRestrita && linha.loja_conta !== lojaRestrita)) throw new ErroDominio('NOT_FOUND', 'Linha do extrato não encontrada', 404);
    if (linha.status !== 'pendente') throw new ErroDominio('ALREADY_RECONCILED', 'Esta linha já foi conciliada ou ignorada', 409);
    const l = (await q('SELECT * FROM fin_lancamentos WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, exigirUuid(lancamentoId, 'lançamento')])).rows[0];
    if (!l || (lojaRestrita && l.loja_id !== lojaRestrita)) throw new ErroDominio('NOT_FOUND', 'Lançamento não encontrado', 404);
    const tipo = Number(linha.valor) > 0 ? 'receita' : 'despesa';
    if (l.tipo !== tipo || dinheiro(l.valor) !== dinheiro(Math.abs(Number(linha.valor)))) throw new ErroDominio('VALUE_MISMATCH', 'Tipo ou valor do lançamento não bate com a linha do extrato', 422);
    if (l.status === 'cancelado') throw new ErroDominio('CANCELLED', 'Lançamento cancelado não se concilia', 409);
    if ((await q('SELECT 1 FROM fin_extrato_linhas WHERE empresa_id = $1 AND lancamento_id = $2', [empresa, l.id])).rows[0]) throw new ErroDominio('ALREADY_RECONCILED', 'Este lançamento já está conciliado com outra linha', 409);
    let baixado = false;
    if (l.status === 'pendente') {
      // a baixa segue as regras do razão (dia fechado, origem A2…) dentro desta transação
      await svc.atualizar(naTransacao(q), empresa, l.id, { status: 'pago', pagoEm: iso(linha.data), meioPagamento: l.meio_pagamento || (String(linha.tipo).includes('PIX') || /pix/i.test(linha.descricao) ? 'pix' : 'transferencia') }, { fuso });
      baixado = true;
    }
    await q('UPDATE fin_lancamentos SET conta_bancaria_id = $3 WHERE empresa_id = $1 AND id = $2', [empresa, l.id, linha.conta_id]);
    const r = await q("UPDATE fin_extrato_linhas SET status = 'conciliado', lancamento_id = $3, regra = $4, conciliado_por = $5, conciliado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *", [empresa, linha.id, l.id, String(regra).slice(0, 40), textoOpcional(usuario, 180)]);
    return { linha: linhaDto(r.rows[0]), baixado };
  });
}

/** Lançamento novo a partir da linha (tarifa, rendimento, pagamento não lançado) já conciliado. */
export async function criarLancamentoDaLinha(db, empresaId, linhaId, { categoria, descricao = null, lojaId = null }, { usuario = null, fuso = svc.FUSO_PADRAO, lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  return transacao(db, async (q) => {
    const linha = (await q('SELECT x.*, c.loja_id AS loja_conta FROM fin_extrato_linhas x JOIN fin_contas_bancarias c ON c.empresa_id = x.empresa_id AND c.id = x.conta_id WHERE x.empresa_id = $1 AND x.id = $2 FOR UPDATE OF x', [empresa, exigirUuid(linhaId, 'linha')])).rows[0];
    if (!linha || (lojaRestrita && linha.loja_conta !== lojaRestrita)) throw new ErroDominio('NOT_FOUND', 'Linha do extrato não encontrada', 404);
    if (linha.status !== 'pendente') throw new ErroDominio('ALREADY_RECONCILED', 'Esta linha já foi conciliada ou ignorada', 409);
    const [l] = await svc.criarManual(naTransacao(q), empresa, {
      tipo: Number(linha.valor) > 0 ? 'receita' : 'despesa', categoria: categoria || 'Outros', descricao: descricao || linha.descricao || 'Lançamento do extrato',
      valor: Math.abs(Number(linha.valor)), vencimento: iso(linha.data), competencia: iso(linha.data), status: 'pago', pagoEm: iso(linha.data),
      meioPagamento: /pix/i.test(`${linha.tipo} ${linha.descricao}`) ? 'pix' : 'transferencia', lojaId: lojaRestrita || lojaId || linha.loja_conta || null, documento: linha.documento,
    }, { usuario, fuso });
    await q('UPDATE fin_lancamentos SET conta_bancaria_id = $3 WHERE empresa_id = $1 AND id = $2', [empresa, l.id, linha.conta_id]);
    const r = await q("UPDATE fin_extrato_linhas SET status = 'conciliado', lancamento_id = $3, regra = 'criado_do_extrato', conciliado_por = $4, conciliado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *", [empresa, linha.id, l.id, textoOpcional(usuario, 180)]);
    return { linha: linhaDto(r.rows[0]), lancamento: l };
  });
}

export async function ignorarLinha(db, empresaId, linhaId, { usuario = null, lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const r = await db.query(
    `UPDATE fin_extrato_linhas x SET status = 'ignorado', regra = 'ignorado', conciliado_por = $3, conciliado_em = CURRENT_TIMESTAMP
       FROM fin_contas_bancarias c WHERE x.empresa_id = $1 AND x.id = $2 AND x.status = 'pendente' AND c.empresa_id = x.empresa_id AND c.id = x.conta_id AND ($4::uuid IS NULL OR c.loja_id = $4::uuid) RETURNING x.*`,
    [empresa, exigirUuid(linhaId, 'linha'), textoOpcional(usuario, 180), lojaRestrita]);
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Linha pendente não encontrada', 404);
  return linhaDto(r.rows[0]);
}

/** Desfaz: a linha volta a pendente; a baixa feita pela conciliação NÃO é desfeita (use estorno). */
export async function desfazer(db, empresaId, linhaId, { lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  return transacao(db, async (q) => {
    const linha = (await q('SELECT x.*, c.loja_id AS loja_conta FROM fin_extrato_linhas x JOIN fin_contas_bancarias c ON c.empresa_id = x.empresa_id AND c.id = x.conta_id WHERE x.empresa_id = $1 AND x.id = $2 FOR UPDATE OF x', [empresa, exigirUuid(linhaId, 'linha')])).rows[0];
    if (!linha || (lojaRestrita && linha.loja_conta !== lojaRestrita)) throw new ErroDominio('NOT_FOUND', 'Linha do extrato não encontrada', 404);
    if (linha.lancamento_id) await q('UPDATE fin_lancamentos SET conta_bancaria_id = NULL WHERE empresa_id = $1 AND id = $2', [empresa, linha.lancamento_id]);
    const r = await q("UPDATE fin_extrato_linhas SET status = 'pendente', lancamento_id = NULL, regra = NULL, conciliado_por = NULL, conciliado_em = NULL WHERE empresa_id = $1 AND id = $2 RETURNING *", [empresa, linha.id]);
    return linhaDto(r.rows[0]);
  });
}

/**
 * Concilia sozinho o que é inequívoco: um candidato só, ou o melhor com nome/documento batendo e
 * 30 pontos à frente do segundo. Baixa de dia já fechado fica para conferência manual.
 */
export async function conciliarAutomatico(db, empresaId, { contaId = null, usuario = null, fuso = svc.FUSO_PADRAO, lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const linhas = await listarLinhas(db, empresa, { contaId, status: 'pendente', lojaId: lojaRestrita, limite: 1000, fuso });
  let conciliadas = 0; let baixas = 0; const conferir = [];
  for (const linha of linhas) {
    const [a, b] = linha.sugestoes || [];
    if (!a) continue;
    const inequivoco = !b ? a.dias <= 3 || a.casaNome : a.casaNome && a.pontos - b.pontos >= 30;
    if (!inequivoco) { conferir.push(linha.id); continue; }
    try {
      const r = await conciliar(db, empresa, linha.id, a.lancamento.id, { usuario: usuario || 'conciliação automática', regra: 'automatica', fuso, lojaRestrita });
      conciliadas += 1; if (r.baixado) baixas += 1;
    } catch (error) {
      if (!(error instanceof ErroDominio)) throw error;
      conferir.push(linha.id);
    }
  }
  return { conciliadas, baixas, paraConferir: conferir.length };
}

/** Resumo por conta: saldo do último extrato × saldo do razão conciliado, e o que falta conciliar. */
export async function resumoContas(db, empresaId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const r = await db.query(
    `SELECT c.*,
       (SELECT saldo_final FROM fin_extratos e WHERE e.empresa_id = c.empresa_id AND e.conta_id = c.id AND e.saldo_final IS NOT NULL ORDER BY e.fim DESC NULLS LAST, e.criado_em DESC LIMIT 1) AS saldo_banco,
       (SELECT fim FROM fin_extratos e WHERE e.empresa_id = c.empresa_id AND e.conta_id = c.id ORDER BY e.fim DESC NULLS LAST, e.criado_em DESC LIMIT 1) AS ate,
       COUNT(x.*) FILTER (WHERE x.status = 'pendente') AS pendentes,
       COALESCE(SUM(x.valor) FILTER (WHERE x.status = 'pendente'), 0) AS valor_pendente,
       COUNT(x.*) FILTER (WHERE x.status = 'conciliado') AS conciliadas
     FROM fin_contas_bancarias c LEFT JOIN fin_extrato_linhas x ON x.empresa_id = c.empresa_id AND x.conta_id = c.id
     WHERE c.empresa_id = $1 GROUP BY c.id ORDER BY c.nome`, [empresa]);
  return r.rows.map((c) => ({ ...contaDto(c), saldoBanco: c.saldo_banco === null ? null : Number(c.saldo_banco), extratoAte: c.ate ? iso(c.ate) : null, pendentes: Number(c.pendentes), valorPendente: dinheiro(c.valor_pendente), conciliadas: Number(c.conciliadas) }));
}

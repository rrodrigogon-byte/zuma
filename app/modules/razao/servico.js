// Razão financeiro único por empresa e unidade (migração 090).
//
// Regras:
// - todo valor é por empresa; a unidade (loja_id) é opcional: NULL = "sem unidade", aparece no
//   consolidado da empresa e pode ser atribuída depois;
// - todo lançamento tem uma chave única por empresa: reprocessar a mesma fonte nunca duplica;
// - lançamento automático (vindo de outro módulo) não muda de valor nem é cancelado aqui: a
//   correção é um estorno, que fica registrado ao lado do original;
// - datas do negócio (competência, vencimento, "mês", "hoje") seguem o fuso da empresa.
import { randomUUID } from 'node:crypto';
import { ErroDominio, exigirData, exigirTexto, exigirUuid, transacao } from '../acesso/banco.js';
import { perdasDoPeriodo } from '../suprimentos/estoque.js';

export const FUSO_PADRAO = 'America/Cuiaba';

export const CATEGORIAS_PADRAO = {
  receita: [
    ['Serviços', 'receita_bruta'], ['Vendas de produtos', 'receita_bruta'], ['Bar e restaurante', 'receita_bruta'],
    ['Mensalidades', 'receita_bruta'], ['Loja online', 'receita_bruta'], ['Contas de clientes', 'receita_bruta'],
    ['Repasses de parceiros', 'receita_bruta'], ['Estorno de comissões', 'pessoal'], ['Rendimentos', 'financeiro'], ['Outros', 'outros'],
  ],
  despesa: [
    ['Compras de mercadoria', 'cmv'], ['Insumos', 'cmv'], ['Perdas e quebras', 'cmv'],
    ['Salários e encargos', 'pessoal'], ['Comissões', 'pessoal'], ['Aluguel', 'operacional'],
    ['Energia, água e internet', 'operacional'], ['Manutenção', 'operacional'], ['Marketing', 'operacional'],
    ['Sistemas e assinaturas', 'operacional'], ['Taxas de cartão e Pix', 'deducao'], ['Estornos e devoluções', 'deducao'],
    ['Impostos', 'impostos'], ['Juros e tarifas bancárias', 'financeiro'], ['Investimentos', 'investimento'], ['Outros', 'outros'],
  ],
};

const STATUS = new Set(['pendente', 'pago', 'cancelado']);
const NATUREZAS = new Set(['avulso', 'pagar', 'receber']);
const MEIOS = new Set(['dinheiro', 'pix', 'credito', 'debito', 'boleto', 'transferencia', 'cheque', 'voucher', 'misto', 'outro']);
const CONTRAPARTES = new Set(['cliente', 'fornecedor', 'funcionario', 'outro']);

const dinheiro = (v) => Math.round(Number(v || 0) * 100) / 100;

export function hojeNoFuso(agora = new Date(), fuso = FUSO_PADRAO) {
  return new Date(agora).toLocaleDateString('en-CA', { timeZone: fuso });
}

function valorPositivo(valor, campo = 'valor') {
  const n = Number(typeof valor === 'string' ? valor.replace(',', '.') : valor);
  if (!Number.isFinite(n) || n <= 0 || n > 99_999_999) throw new ErroDominio('VALIDATION_ERROR', `${campo} deve ser maior que zero`);
  return Math.round(n * 100) / 100;
}

/**
 * Instante do pagamento. Data pura ('2026-10-10') vira meio-dia UTC (manhã no Brasil), para cair
 * no mesmo dia em qualquer fuso das Américas e não no dia anterior.
 */
export function instanteDePagamento(valor, agora = new Date()) {
  if (valor === undefined || valor === null || valor === '') return agora;
  const texto = String(valor).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(texto) ? new Date(`${texto}T12:00:00Z`) : new Date(texto);
  if (Number.isNaN(d.getTime())) throw new ErroDominio('VALIDATION_ERROR', 'data de pagamento inválida');
  return d;
}

/** A unidade precisa ser desta empresa (evita sujar relatórios com unidade de outra empresa). */
async function exigirUnidadeDaEmpresa(q, empresa, lojaId) {
  if (!lojaId) return null;
  const r = await q('SELECT id FROM lojas WHERE empresa_id = $1 AND id = $2', [empresa, lojaId]);
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Unidade não encontrada nesta empresa', 404);
  return lojaId;
}

/** Dia já fechado (da unidade ou da empresa toda) não aceita pagamento novo nele. */
async function exigirDiaAberto(q, empresa, lojaId, pagoEm, fuso = FUSO_PADRAO) {
  if (!pagoEm) return;
  const dia = hojeNoFuso(pagoEm, fuso);
  const r = await q('SELECT 1 FROM fin_fechamentos WHERE empresa_id = $1 AND data = $2::date AND (loja_id IS NULL OR loja_id = $3::uuid) LIMIT 1', [empresa, dia, lojaId || null]);
  if (r.rows[0]) throw new ErroDominio('DAY_CLOSED', `O dia ${dia.split('-').reverse().join('/')} já foi fechado. Lance o pagamento em outra data.`, 409);
}

function uuidOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return null;
  return exigirUuid(valor, campo);
}

function textoOpcional(valor, max = 240) {
  const t = String(valor ?? '').trim();
  return t ? t.slice(0, max) : null;
}

function meioOpcional(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const m = String(valor).trim().toLowerCase();
  const aliases = { cartao: 'credito', cartao_credito: 'credito', credit_card: 'credito', debit_card: 'debito', cartao_debito: 'debito', cash: 'dinheiro', especie: 'dinheiro', ted: 'transferencia', doc: 'transferencia' };
  const normal = aliases[m] || m;
  return MEIOS.has(normal) ? normal : 'outro';
}

/** Escopo de leitura: { lojaId: uuid } filtra a unidade; { lojaId: 'sem' } só os sem unidade; nada = empresa toda. */
function filtroUnidade(lojaId, valores) {
  if (!lojaId || lojaId === 'todas') return '';
  if (lojaId === 'sem') return ' AND l.loja_id IS NULL';
  valores.push(exigirUuid(lojaId, 'unidade'));
  return ` AND l.loja_id = $${valores.length}`;
}

export function dto(row) {
  if (!row) return null;
  return {
    id: row.id,
    empresaId: row.empresa_id,
    lojaId: row.loja_id || null,
    tipo: row.tipo,
    categoria: row.categoria,
    centroCustoId: row.centro_custo_id || null,
    descricao: row.descricao,
    valor: Number(row.valor),
    competencia: row.data_competencia instanceof Date ? row.data_competencia.toISOString().slice(0, 10) : String(row.data_competencia || '').slice(0, 10),
    vencimento: row.vencimento instanceof Date ? row.vencimento.toISOString().slice(0, 10) : String(row.vencimento || '').slice(0, 10),
    status: row.status,
    pagoEm: row.pago_em ? new Date(row.pago_em).toISOString() : null,
    meioPagamento: row.meio_pagamento || null,
    natureza: row.natureza,
    contraparteTipo: row.contraparte_tipo || null,
    contraparteId: row.contraparte_id || null,
    contraparteNome: row.contraparte_nome || null,
    origem: row.origem,
    origemId: row.origem_id || null,
    automatico: row.automatico === true,
    serieId: row.serie_id || null,
    parcela: row.parcela || null,
    parcelas: row.parcelas || null,
    documento: row.documento || null,
    observacao: row.observacao || null,
    estornoDe: row.estorno_de || null,
    criadoPor: row.criado_por || null,
    canceladoEm: row.cancelado_em ? new Date(row.cancelado_em).toISOString() : null,
    motivoCancelamento: row.motivo_cancelamento || null,
    criadoEm: row.criado_em ? new Date(row.criado_em).toISOString() : null,
  };
}

/** Garante as categorias padrão da empresa (idempotente). */
export async function garantirCategorias(db, empresaId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const linhas = [];
  const valores = [empresa];
  for (const [tipo, lista] of Object.entries(CATEGORIAS_PADRAO)) {
    for (const [nome, grupo] of lista) {
      valores.push(tipo, nome, grupo);
      linhas.push(`($1, $${valores.length - 2}, $${valores.length - 1}, $${valores.length})`);
    }
  }
  await db.query(`INSERT INTO fin_categorias (empresa_id, tipo, nome, grupo_dre) VALUES ${linhas.join(', ')} ON CONFLICT (empresa_id, tipo, nome) DO NOTHING`, valores);
}

export async function listarCategorias(db, empresaId) {
  await garantirCategorias(db, empresaId);
  const r = await db.query('SELECT id, tipo, nome, grupo_dre, ativo FROM fin_categorias WHERE empresa_id = $1 AND ativo = true ORDER BY tipo, nome', [exigirUuid(empresaId, 'empresa')]);
  const saida = { receita: [], despesa: [], grupos: {} };
  for (const row of r.rows) { saida[row.tipo].push(row.nome); saida.grupos[`${row.tipo}:${row.nome}`] = row.grupo_dre; }
  return saida;
}

export async function criarCategoria(db, empresaId, { tipo, nome, grupoDre = 'operacional' } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!['receita', 'despesa'].includes(tipo)) throw new ErroDominio('VALIDATION_ERROR', 'tipo deve ser receita ou despesa');
  const n = exigirTexto(nome, 'Nome da categoria', { min: 2, max: 80 });
  const grupos = ['receita_bruta', 'deducao', 'cmv', 'operacional', 'pessoal', 'financeiro', 'impostos', 'investimento', 'outros'];
  if (!grupos.includes(grupoDre)) throw new ErroDominio('VALIDATION_ERROR', 'grupo do DRE inválido');
  await db.query('INSERT INTO fin_categorias (empresa_id, tipo, nome, grupo_dre) VALUES ($1, $2, $3, $4) ON CONFLICT (empresa_id, tipo, nome) DO UPDATE SET ativo = true, grupo_dre = EXCLUDED.grupo_dre', [empresa, tipo, n, grupoDre]);
  return listarCategorias(db, empresa);
}

// ── centros de custo ─────────────────────────────────────────────────────────
export async function listarCentros(db, empresaId) {
  const r = await db.query('SELECT id, codigo, nome, ativo FROM fin_centros_custo WHERE empresa_id = $1 ORDER BY ativo DESC, codigo', [exigirUuid(empresaId, 'empresa')]);
  return r.rows;
}

export async function salvarCentro(db, empresaId, entrada = {}, id = null) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const nome = exigirTexto(entrada.nome, 'Nome do centro de custo', { min: 2, max: 120 });
  const ativo = entrada.ativo === undefined ? true : entrada.ativo === true;
  try {
    if (id) {
      const r = await db.query('UPDATE fin_centros_custo SET nome = $3, ativo = $4, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING id, codigo, nome, ativo', [empresa, exigirUuid(id, 'centro de custo'), nome, ativo]);
      if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Centro de custo não encontrado', 404);
      return r.rows[0];
    }
    const codigo = exigirTexto(entrada.codigo, 'Código', { min: 1, max: 30 }).toUpperCase();
    if (!/^[A-Z0-9_.-]+$/.test(codigo)) throw new ErroDominio('VALIDATION_ERROR', 'Código aceita letras, números, ponto, hífen e sublinhado');
    const r = await db.query('INSERT INTO fin_centros_custo (empresa_id, codigo, nome, ativo) VALUES ($1, $2, $3, $4) RETURNING id, codigo, nome, ativo', [empresa, codigo, nome, ativo]);
    return r.rows[0];
  } catch (error) {
    if (error?.code === '23505') throw new ErroDominio('CONFLICT', 'Já existe um centro de custo com este código', 409);
    throw error;
  }
}

// ── escrita ─────────────────────────────────────────────────────────────────
function prepararDados(empresa, dados, { fuso = FUSO_PADRAO, agora = new Date() } = {}) {
  const tipo = String(dados.tipo || '').toLowerCase();
  if (!['receita', 'despesa'].includes(tipo)) throw new ErroDominio('VALIDATION_ERROR', 'tipo deve ser receita ou despesa');
  const descricao = exigirTexto(dados.descricao, 'Descrição', { min: 2, max: 240 });
  const valor = valorPositivo(dados.valor);
  const hoje = hojeNoFuso(agora, fuso);
  const vencimento = dados.vencimento ? exigirData(String(dados.vencimento).slice(0, 10), 'Vencimento') : hoje;
  const competencia = dados.competencia ? exigirData(String(dados.competencia).slice(0, 10), 'Competência') : vencimento;
  const status = String(dados.status || 'pendente').toLowerCase();
  if (!STATUS.has(status) || status === 'cancelado') throw new ErroDominio('VALIDATION_ERROR', 'situação deve ser pendente ou pago');
  const natureza = String(dados.natureza || (status === 'pago' ? 'avulso' : tipo === 'receita' ? 'receber' : 'pagar')).toLowerCase();
  if (!NATUREZAS.has(natureza)) throw new ErroDominio('VALIDATION_ERROR', 'natureza deve ser avulso, pagar ou receber');
  const contraparteTipo = dados.contraparteTipo ? String(dados.contraparteTipo).toLowerCase() : null;
  if (contraparteTipo && !CONTRAPARTES.has(contraparteTipo)) throw new ErroDominio('VALIDATION_ERROR', 'contraparte inválida');
  const pagoEm = status === 'pago' ? instanteDePagamento(dados.pagoEm, agora) : null;
  return {
    empresa_id: empresa,
    loja_id: uuidOpcional(dados.lojaId, 'unidade'),
    tipo,
    categoria: textoOpcional(dados.categoria, 80) || 'Outros',
    centro_custo_id: uuidOpcional(dados.centroCustoId, 'centro de custo'),
    descricao,
    valor,
    data_competencia: competencia,
    vencimento,
    status,
    pago_em: pagoEm,
    meio_pagamento: meioOpcional(dados.meioPagamento),
    natureza,
    contraparte_tipo: contraparteTipo,
    contraparte_id: uuidOpcional(dados.contraparteId, 'contraparte'),
    contraparte_nome: textoOpcional(dados.contraparteNome, 240),
    documento: textoOpcional(dados.documento, 80),
    observacao: textoOpcional(dados.observacao ?? dados.obs, 2000),
  };
}

const COLS = ['empresa_id', 'loja_id', 'tipo', 'categoria', 'centro_custo_id', 'descricao', 'valor', 'data_competencia', 'vencimento', 'status', 'pago_em',
  'meio_pagamento', 'natureza', 'contraparte_tipo', 'contraparte_id', 'contraparte_nome', 'documento', 'observacao',
  'origem', 'origem_id', 'chave', 'automatico', 'serie_id', 'parcela', 'parcelas', 'estorno_de', 'criado_por'];

async function inserir(q, linha) {
  const valores = COLS.map((c) => (linha[c] === undefined ? null : linha[c]));
  const r = await q(
    `INSERT INTO fin_lancamentos (${COLS.join(', ')}) VALUES (${COLS.map((_, i) => `$${i + 1}`).join(', ')})
     ON CONFLICT (empresa_id, chave) DO NOTHING RETURNING *`,
    valores,
  );
  if (r.rows[0]) return { row: r.rows[0], criado: true };
  const existente = await q('SELECT * FROM fin_lancamentos WHERE empresa_id = $1 AND chave = $2', [linha.empresa_id, linha.chave]);
  return { row: existente.rows[0], criado: false };
}

/**
 * Lançamento vindo de outro módulo (atendimento, comanda, mensalidade, pedido, compra…).
 * `chave` identifica o fato na fonte: a mesma chave nunca gera dois lançamentos.
 */
export async function registrarAutomatico(db, empresaId, dados, { chave, origem, origemId = null, fuso, agora } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!chave || String(chave).length > 200) throw new ErroDominio('VALIDATION_ERROR', 'chave do lançamento automático é obrigatória');
  const linha = { ...prepararDados(empresa, dados, { fuso, agora }), origem: String(origem || 'automatico').slice(0, 40), origem_id: origemId ? String(origemId).slice(0, 160) : null, chave: String(chave), automatico: true, criado_por: 'sistema' };
  const r = await inserir((t, v) => db.query(t, v), linha);
  return { lancamento: dto(r.row), criado: r.criado };
}

/** Igual a registrarAutomatico, dentro de uma transação já aberta (`q` = query da transação). */
export async function registrarAutomaticoNaTransacao(q, empresaId, dados, { chave, origem, origemId = null, fuso, agora } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!chave || String(chave).length > 200) throw new ErroDominio('VALIDATION_ERROR', 'chave do lançamento automático é obrigatória');
  const linha = { ...prepararDados(empresa, dados, { fuso, agora }), origem: String(origem || 'automatico').slice(0, 40), origem_id: origemId ? String(origemId).slice(0, 160) : null, chave: String(chave), automatico: true, criado_por: 'sistema' };
  const r = await inserir(q, linha);
  return { lancamento: dto(r.row), criado: r.criado };
}

// ── rateio entre centros de custo ─────────────────────────────────────────────
/** [{ centroCustoId, percentual }] → linhas validadas (percentuais somando 100, centros distintos). */
export function validarRateio(rateio) {
  if (rateio === undefined || rateio === null) return null;
  if (!Array.isArray(rateio)) throw new ErroDominio('VALIDATION_ERROR', 'Rateio inválido');
  if (!rateio.length) return [];
  const linhas = rateio.map((r) => ({ centro: exigirUuid(r?.centroCustoId, 'centro de custo'), percentual: Math.round(Number(r?.percentual) * 10000) / 10000 }));
  if (linhas.some((l) => !(l.percentual > 0) || l.percentual > 100)) throw new ErroDominio('VALIDATION_ERROR', 'Cada centro do rateio leva de 0,01% a 100%');
  if (new Set(linhas.map((l) => l.centro)).size !== linhas.length) throw new ErroDominio('VALIDATION_ERROR', 'Centro de custo repetido no rateio');
  const soma = linhas.reduce((t, l) => t + l.percentual, 0);
  if (Math.abs(soma - 100) > 0.001) throw new ErroDominio('VALIDATION_ERROR', `O rateio precisa somar 100% (está em ${soma.toFixed(2).replace('.', ',')}%)`);
  return linhas;
}

async function gravarRateio(q, empresa, lancamentoId, linhas) {
  if (linhas === null) return;
  if (linhas.length) {
    const ok = await q('SELECT count(*)::int AS n FROM fin_centros_custo WHERE empresa_id = $1 AND id = ANY($2::uuid[])', [empresa, linhas.map((l) => l.centro)]);
    if (ok.rows[0].n !== linhas.length) throw new ErroDominio('NOT_FOUND', 'Centro de custo não encontrado nesta empresa', 404);
  }
  await q('DELETE FROM fin_rateios WHERE empresa_id = $1 AND lancamento_id = $2', [empresa, lancamentoId]);
  for (const l of linhas) await q('INSERT INTO fin_rateios (empresa_id, lancamento_id, centro_custo_id, percentual) VALUES ($1,$2,$3,$4)', [empresa, lancamentoId, l.centro, l.percentual]);
}

async function rateiosDe(db, empresa, ids) {
  if (!ids.length || !(await db.query("SELECT to_regclass('fin_rateios') AS t")).rows[0]?.t) return new Map();
  const r = await db.query('SELECT lancamento_id, centro_custo_id, percentual FROM fin_rateios WHERE empresa_id = $1 AND lancamento_id = ANY($2::uuid[])', [empresa, ids]);
  const mapa = new Map();
  for (const row of r.rows) {
    if (!mapa.has(row.lancamento_id)) mapa.set(row.lancamento_id, []);
    mapa.get(row.lancamento_id).push({ centroCustoId: row.centro_custo_id, percentual: Number(row.percentual) });
  }
  return mapa;
}

/** Divide um total em n parcelas em centavos; a diferença dos centavos vai para a última. */
export function dividirEmParcelas(total, n) {
  const centavos = Math.round(Number(total) * 100);
  const base = Math.floor(centavos / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? centavos - base * (n - 1) : base) / 100);
}

/**
 * Lançamento manual, com recorrência mensal opcional (1 a 24 meses). Com `parcelarTotal`, o
 * valor informado é o total e é dividido nas parcelas (uma conta de R$ 1.000 em 3x); sem ele,
 * cada mês repete o valor (aluguel). `rateio` divide o lançamento entre centros de custo.
 */
export async function criarManual(db, empresaId, dados = {}, { usuario = null, fuso, agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const base = prepararDados(empresa, dados, { fuso, agora });
  const meses = dados.recorrencia?.meses === undefined && dados.meses === undefined ? 1 : Number(dados.recorrencia?.meses ?? dados.meses);
  if (!Number.isInteger(meses) || meses < 1 || meses > 24) throw new ErroDominio('VALIDATION_ERROR', 'A recorrência vai de 1 a 24 meses');
  const parcelarTotal = dados.parcelarTotal === true && meses > 1;
  const valores = parcelarTotal ? dividirEmParcelas(base.valor, meses) : null;
  if (valores && valores.some((v) => !(v > 0))) throw new ErroDominio('VALIDATION_ERROR', 'Total pequeno demais para tantas parcelas');
  const rateio = validarRateio(dados.rateio);
  if (rateio?.length) base.centro_custo_id = null;
  const serieId = meses > 1 ? randomUUID() : null;
  const criadoPor = textoOpcional(usuario, 180);
  return transacao(db, async (q) => {
    await exigirUnidadeDaEmpresa(q, empresa, base.loja_id);
    if (base.status === 'pago') await exigirDiaAberto(q, empresa, base.loja_id, base.pago_em, fuso);
    const criados = [];
    for (let i = 0; i < meses; i += 1) {
      const vencimento = i === 0 ? base.vencimento : somarMeses(base.vencimento, i);
      const competencia = i === 0 ? base.data_competencia : somarMeses(base.data_competencia, i);
      const pago = i === 0 && base.status === 'pago';
      const linha = {
        ...base,
        vencimento,
        data_competencia: competencia,
        status: pago ? 'pago' : 'pendente',
        pago_em: pago ? base.pago_em : null,
        natureza: pago ? base.natureza : (base.natureza === 'avulso' ? (base.tipo === 'receita' ? 'receber' : 'pagar') : base.natureza),
        ...(valores ? { valor: valores[i] } : {}),
        descricao: serieId ? `${base.descricao} (${i + 1}/${meses})`.slice(0, 240) : base.descricao,
        origem: 'manual', chave: `manual:${randomUUID()}`, automatico: false,
        serie_id: serieId, parcela: serieId ? i + 1 : null, parcelas: serieId ? meses : null, criado_por: criadoPor,
      };
      const r = await inserir(q, linha);
      if (rateio?.length) await gravarRateio(q, empresa, r.row.id, rateio);
      criados.push({ ...dto(r.row), ...(rateio?.length ? { rateio: rateio.map((l) => ({ centroCustoId: l.centro, percentual: l.percentual })) } : {}) });
    }
    return criados;
  });
}

/** Mesmo dia do mês seguinte; dia 31 vira o último dia do mês quando o mês é mais curto. */
export function somarMeses(dataIso, meses) {
  const [a, m, d] = String(dataIso).split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

async function travar(q, empresa, id) {
  const r = await q('SELECT * FROM fin_lancamentos WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, exigirUuid(id, 'lançamento')]);
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Lançamento não encontrado nesta empresa', 404);
  return r.rows[0];
}

function dataTexto(v) { return v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 10); }
/** O pedido tenta mudar o que vem do módulo de origem (valor, datas, descrição, tipo)? */
function alteraCampoDaFonte(atual, dados) {
  if (dados.valor !== undefined && Math.abs(Number(dados.valor) - Number(atual.valor)) > 0.004) return true;
  if (dados.descricao !== undefined && String(dados.descricao).trim() !== atual.descricao) return true;
  if (dados.tipo !== undefined && dados.tipo !== atual.tipo) return true;
  if (dados.vencimento !== undefined && String(dados.vencimento).slice(0, 10) !== dataTexto(atual.vencimento)) return true;
  if (dados.competencia !== undefined && String(dados.competencia).slice(0, 10) !== dataTexto(atual.data_competencia)) return true;
  return false;
}

/** Edição. Automático: só unidade, centro de custo, categoria, documento e observação. */
export async function atualizar(db, empresaId, id, dados = {}, { fuso = FUSO_PADRAO, agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  return transacao(db, async (q) => {
    const atual = await travar(q, empresa, id);
    if (atual.status === 'cancelado') throw new ErroDominio('CANCELLED', 'Lançamento cancelado não pode ser editado', 409);
    const sets = {};
    if (dados.lojaId !== undefined) sets.loja_id = await exigirUnidadeDaEmpresa(q, empresa, uuidOpcional(dados.lojaId, 'unidade'));
    if (dados.centroCustoId !== undefined) sets.centro_custo_id = uuidOpcional(dados.centroCustoId, 'centro de custo');
    // rateio é classificação (como o centro): vale também para lançamento automático ou pago
    const rateio = validarRateio(dados.rateio);
    if (rateio !== null) { await gravarRateio(q, empresa, atual.id, rateio); if (rateio.length) sets.centro_custo_id = null; }
    if (dados.categoria !== undefined) sets.categoria = textoOpcional(dados.categoria, 80) || 'Outros';
    if (dados.documento !== undefined) sets.documento = textoOpcional(dados.documento, 80);
    if (dados.observacao !== undefined || dados.obs !== undefined) sets.observacao = textoOpcional(dados.observacao ?? dados.obs, 2000);
    // Valor, datas e descrição ficam presos quando vêm de outro módulo, quando o lançamento é um
    // estorno ou quando já foi pago: a correção, nesses casos, é o estorno.
    const travado = atual.automatico || Boolean(atual.estorno_de) || atual.status === 'pago';
    if (!travado) {
      if (dados.descricao !== undefined) sets.descricao = exigirTexto(dados.descricao, 'Descrição', { min: 2, max: 240 });
      if (dados.valor !== undefined) sets.valor = valorPositivo(dados.valor);
      if (dados.vencimento !== undefined) sets.vencimento = exigirData(String(dados.vencimento).slice(0, 10), 'Vencimento');
      if (dados.competencia !== undefined) sets.data_competencia = exigirData(String(dados.competencia).slice(0, 10), 'Competência');
      if (dados.contraparteNome !== undefined) sets.contraparte_nome = textoOpcional(dados.contraparteNome, 240);
      if (dados.meioPagamento !== undefined) sets.meio_pagamento = meioOpcional(dados.meioPagamento);
    } else if (alteraCampoDaFonte(atual, dados)) {
      const msg = atual.automatico ? 'Lançamento automático: valor, data e descrição vêm do módulo de origem. Use estorno para corrigir.'
        : atual.estorno_de ? 'Estorno não é editado.' : 'Lançamento já pago: valor e datas não mudam. Use estorno para corrigir.';
      throw new ErroDominio(atual.automatico ? 'AUTOMATIC_ENTRY' : 'LOCKED_ENTRY', msg, 409);
    }
    if (dados.status !== undefined && dados.status !== atual.status) {
      if (dados.status === 'pago') {
        sets.status = 'pago'; sets.pago_em = instanteDePagamento(dados.pagoEm, agora); sets.meio_pagamento = meioOpcional(dados.meioPagamento) || atual.meio_pagamento;
        await exigirDiaAberto(q, empresa, sets.loja_id !== undefined ? sets.loja_id : atual.loja_id, sets.pago_em, fuso);
        // conta do A2: a baixa feita aqui também baixa lá (alertas, cobrança e fechamento do A2)
        if (atual.origem === 'a2_conta' && atual.origem_id) {
          await q('UPDATE a2_contas_receber SET data_pagamento = COALESCE(data_pagamento, $3), atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id::text = $2', [empresa, atual.origem_id, sets.pago_em]);
        }
      } else if (dados.status === 'pendente') {
        if (atual.automatico) throw new ErroDominio('AUTOMATIC_ENTRY', 'Lançamento automático pago não volta a pendente; use estorno.', 409);
        if (atual.estorno_de) throw new ErroDominio('LOCKED_ENTRY', 'Estorno não volta a pendente.', 409);
        const temEstorno = await q('SELECT 1 FROM fin_lancamentos WHERE empresa_id = $1 AND estorno_de = $2 LIMIT 1', [empresa, atual.id]);
        if (temEstorno.rows[0]) throw new ErroDominio('ALREADY_REVERSED', 'Lançamento já estornado não volta a pendente.', 409);
        await exigirDiaAberto(q, empresa, atual.loja_id, atual.pago_em, fuso);
        sets.status = 'pendente'; sets.pago_em = null;
      } else throw new ErroDominio('VALIDATION_ERROR', 'Para cancelar, use a ação de cancelar');
    }
    const campos = Object.keys(sets);
    if (!campos.length) return { ...dto(atual), ...(rateio !== null ? { rateio: rateio.map((l) => ({ centroCustoId: l.centro, percentual: l.percentual })) } : {}) };
    const r = await q(
      `UPDATE fin_lancamentos SET ${campos.map((c, i) => `${c} = $${i + 3}`).join(', ')}, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *`,
      [empresa, atual.id, ...campos.map((c) => sets[c])],
    );
    return dto(r.rows[0]);
  });
}

/** Baixa: marca como pago (recebido ou pago ao fornecedor). */
export function baixar(db, empresaId, id, { pagoEm, meioPagamento } = {}, opcoes = {}) {
  return atualizar(db, empresaId, id, { status: 'pago', pagoEm, meioPagamento }, opcoes);
}

/** Cancelamento de lançamento manual (com motivo). Automático não se cancela: estorna-se. */
export async function cancelar(db, empresaId, id, { usuario, motivo } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  return transacao(db, async (q) => {
    const atual = await travar(q, empresa, id);
    if (atual.status === 'cancelado') return dto(atual);
    if (atual.automatico) throw new ErroDominio('AUTOMATIC_ENTRY', 'Lançamento automático não é cancelado; use estorno.', 409);
    if (atual.estorno_de) throw new ErroDominio('LOCKED_ENTRY', 'Estorno não é cancelado.', 409);
    if (atual.status === 'pago') throw new ErroDominio('PAID', 'Lançamento pago não é cancelado: use estorno (o dinheiro já entrou ou saiu).', 409);
    const r = await q(
      `UPDATE fin_lancamentos SET status = 'cancelado', pago_em = NULL, cancelado_em = CURRENT_TIMESTAMP, cancelado_por = $3, motivo_cancelamento = $4, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND id = $2 RETURNING *`,
      [empresa, atual.id, textoOpcional(usuario, 180) || 'gestor', textoOpcional(motivo, 240)],
    );
    return dto(r.rows[0]);
  });
}

/** Cancela as parcelas pendentes de uma série (recorrência), mantendo as pagas. */
export async function cancelarSerie(db, empresaId, serieId, { usuario, motivo } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const r = await db.query(
    `UPDATE fin_lancamentos SET status = 'cancelado', cancelado_em = CURRENT_TIMESTAMP, cancelado_por = $3, motivo_cancelamento = $4, atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND serie_id = $2 AND status = 'pendente' AND automatico = false RETURNING id`,
    [empresa, exigirUuid(serieId, 'série'), textoOpcional(usuario, 180) || 'gestor', textoOpcional(motivo, 240) || 'série cancelada'],
  );
  return { cancelados: r.rows.length };
}

/**
 * Estorno: cria o lançamento oposto, ligado ao original. Serve para corrigir automático pago
 * (devolução de pedido, comanda paga errado). Um lançamento só tem um estorno.
 */
export async function estornar(db, empresaId, id, { usuario, motivo, agora = new Date(), fuso } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const razao = exigirTexto(motivo, 'Motivo do estorno', { min: 3, max: 240 });
  return transacao(db, async (q) => {
    const original = await travar(q, empresa, id);
    if (original.status !== 'pago') throw new ErroDominio('NOT_PAID', 'Só lançamento pago tem estorno; pendente se cancela.', 409);
    if (original.estorno_de) throw new ErroDominio('IS_REVERSAL', 'Este lançamento já é um estorno.', 409);
    const hoje = hojeNoFuso(agora, fuso);
    const linha = {
      empresa_id: empresa, loja_id: original.loja_id, tipo: original.tipo === 'receita' ? 'despesa' : 'receita',
      categoria: original.tipo === 'receita' ? 'Estornos e devoluções' : original.categoria, centro_custo_id: original.centro_custo_id,
      descricao: `Estorno: ${original.descricao}`.slice(0, 240), valor: original.valor, data_competencia: hoje, vencimento: hoje,
      status: 'pago', pago_em: agora, meio_pagamento: original.meio_pagamento, natureza: 'avulso',
      contraparte_tipo: original.contraparte_tipo, contraparte_id: original.contraparte_id, contraparte_nome: original.contraparte_nome,
      origem: 'estorno', origem_id: original.id, chave: `estorno:${original.id}`, automatico: original.automatico, estorno_de: original.id,
      observacao: razao, criado_por: textoOpcional(usuario, 180) || 'gestor',
    };
    const r = await inserir(q, linha);
    if (!r.criado) throw new ErroDominio('ALREADY_REVERSED', 'Este lançamento já foi estornado.', 409);
    return dto(r.row);
  });
}

// ── leitura ─────────────────────────────────────────────────────────────────
export async function listar(db, empresaId, filtros = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const v = [empresa];
  let sql = 'SELECT l.* FROM fin_lancamentos l WHERE l.empresa_id = $1';
  sql += filtroUnidade(filtros.lojaId, v);
  if (filtros.tipo && ['receita', 'despesa'].includes(filtros.tipo)) { v.push(filtros.tipo); sql += ` AND l.tipo = $${v.length}`; }
  if (filtros.status && STATUS.has(filtros.status)) { v.push(filtros.status); sql += ` AND l.status = $${v.length}`; }
  if (filtros.natureza && NATUREZAS.has(filtros.natureza)) { v.push(filtros.natureza); sql += ` AND l.natureza = $${v.length}`; }
  if (filtros.categoria) { v.push(String(filtros.categoria).slice(0, 80)); sql += ` AND l.categoria = $${v.length}`; }
  if (filtros.origem) { v.push(String(filtros.origem).slice(0, 40)); sql += ` AND l.origem = $${v.length}`; }
  if (filtros.centroCustoId) { v.push(exigirUuid(filtros.centroCustoId, 'centro de custo')); sql += ` AND l.centro_custo_id = $${v.length}`; }
  if (filtros.de) { v.push(exigirData(filtros.de, 'De')); sql += ` AND l.vencimento >= $${v.length}`; }
  if (filtros.ate) { v.push(exigirData(filtros.ate, 'Até')); sql += ` AND l.vencimento <= $${v.length}`; }
  if (filtros.q) { v.push(`%${String(filtros.q).slice(0, 80).replace(/[%_\\]/g, (c) => `\\${c}`)}%`); sql += ` AND (l.descricao ILIKE $${v.length} OR l.contraparte_nome ILIKE $${v.length})`; }
  const limite = Math.min(Math.max(Number(filtros.limite) || 500, 1), 2000);
  // pendentes: o que vence primeiro vem primeiro (nenhuma conta antiga some da lista)
  sql += filtros.status === 'pendente' ? ` ORDER BY l.vencimento ASC, l.criado_em ASC LIMIT ${limite}` : ` ORDER BY l.vencimento DESC, l.criado_em DESC LIMIT ${limite}`;
  const r = await db.query(sql, v);
  const rateios = await rateiosDe(db, empresa, r.rows.map((row) => row.id));
  return r.rows.map((row) => ({ ...dto(row), ...(rateios.has(row.id) ? { rateio: rateios.get(row.id) } : {}) }));
}

// ── configuração do Financeiro da empresa ────────────────────────────────────
const temTabela = async (db, nome) => Boolean((await db.query('SELECT to_regclass($1) AS t', [nome])).rows[0]?.t);

export async function obterConfig(db, empresaId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!(await temTabela(db, 'fin_config'))) return { lojaPadrao: null, jsonLiberadoEm: null, jsonLiberadoPor: null, jsonIncluirQuarentena: false, razaoDesde: null };
  const r = (await db.query('SELECT * FROM fin_config WHERE empresa_id = $1', [empresa])).rows[0];
  return { lojaPadrao: r?.loja_padrao || null, jsonLiberadoEm: r?.json_liberado_em || null, jsonLiberadoPor: r?.json_liberado_por || null, jsonIncluirQuarentena: r?.json_incluir_quarentena === true, razaoDesde: r?.razao_desde || null };
}

/** Marca (uma vez) o início do uso do Financeiro novo na empresa; devolve a data. */
export async function marcarRazaoLigado(db, empresaId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!(await temTabela(db, 'fin_config'))) return null;
  const r = await db.query(
    `INSERT INTO fin_config (empresa_id, razao_desde) VALUES ($1, CURRENT_TIMESTAMP)
     ON CONFLICT (empresa_id) DO UPDATE SET razao_desde = COALESCE(fin_config.razao_desde, EXCLUDED.razao_desde)
     RETURNING razao_desde`, [empresa]);
  return r.rows[0]?.razao_desde || null;
}

/**
 * Unidade das receitas automáticas que chegam sem unidade (bar, clube, contas do A2). Ao trocar,
 * as que já entraram sem unidade passam para ela, fora de dia já fechado.
 */
export async function salvarLojaPadrao(db, empresaId, lojaId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const loja = uuidOpcional(lojaId, 'unidade');
  return transacao(db, async (q) => {
    await exigirUnidadeDaEmpresa(q, empresa, loja);
    await q(`INSERT INTO fin_config (empresa_id, loja_padrao) VALUES ($1, $2)
             ON CONFLICT (empresa_id) DO UPDATE SET loja_padrao = EXCLUDED.loja_padrao, atualizado_em = CURRENT_TIMESTAMP`, [empresa, loja]);
    let atribuidos = 0;
    if (loja) {
      const r = await q(
        `UPDATE fin_lancamentos l SET loja_id = $2, atualizado_em = CURRENT_TIMESTAMP
          WHERE l.empresa_id = $1 AND l.loja_id IS NULL AND l.automatico AND l.origem IN ('bar_comanda', 'clube_pagamento', 'a2_conta', 'loja_online')
            AND NOT EXISTS (SELECT 1 FROM fin_fechamentos f WHERE f.empresa_id = l.empresa_id AND f.data = l.data_competencia)`, [empresa, loja]);
      atribuidos = r.rowCount;
    }
    return { lojaPadrao: loja, atribuidos };
  });
}

/**
 * Unidade que uma fonte usa quando o fato não traz unidade: o bar usa a unidade do bar configurada
 * no Estoque; as demais, a unidade padrão do Financeiro; empresa com uma unidade só usa ela.
 */
export async function lojaPadraoDaFonte(db, empresaId, fonte) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (fonte === 'bar' && await temTabela(db, 'est_config')) {
    const bar = (await db.query('SELECT loja_bar FROM est_config WHERE empresa_id = $1', [empresa])).rows[0]?.loja_bar;
    if (bar) return bar;
  }
  const cfg = await obterConfig(db, empresa);
  if (cfg.lojaPadrao) return cfg.lojaPadrao;
  const lojas = (await db.query("SELECT id FROM lojas l WHERE l.empresa_id = $1 AND COALESCE((to_jsonb(l)->>'ativa')::boolean, true) LIMIT 2", [empresa])).rows;
  return lojas.length === 1 ? lojas[0].id : null;
}

export async function obter(db, empresaId, id) {
  const r = await db.query('SELECT * FROM fin_lancamentos WHERE empresa_id = $1 AND id = $2', [exigirUuid(empresaId, 'empresa'), exigirUuid(id, 'lançamento')]);
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Lançamento não encontrado nesta empresa', 404);
  return dto(r.rows[0]);
}

/** Números do topo da tela: saldo realizado, a receber, a pagar, mês, vencidos e sem unidade. */
export async function resumo(db, empresaId, { lojaId = null, agora = new Date(), fuso = FUSO_PADRAO } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const hoje = hojeNoFuso(agora, fuso);
  const mes = hoje.slice(0, 7);
  const v = [empresa, hoje, mes, fuso];
  const unidade = filtroUnidade(lojaId, v);
  const r = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN l.status = 'pago' AND l.tipo = 'receita' THEN l.valor END), 0) AS receitas_pagas,
       COALESCE(SUM(CASE WHEN l.status = 'pago' AND l.tipo = 'despesa' THEN l.valor END), 0) AS despesas_pagas,
       COALESCE(SUM(CASE WHEN l.status = 'pendente' AND l.tipo = 'receita' THEN l.valor END), 0) AS a_receber,
       COALESCE(SUM(CASE WHEN l.status = 'pendente' AND l.tipo = 'despesa' THEN l.valor END), 0) AS a_pagar,
       COALESCE(SUM(CASE WHEN l.status = 'pago' AND l.tipo = 'receita' AND to_char(l.pago_em AT TIME ZONE $4, 'YYYY-MM') = $3 THEN l.valor END), 0) AS rec_mes,
       COALESCE(SUM(CASE WHEN l.status = 'pago' AND l.tipo = 'despesa' AND to_char(l.pago_em AT TIME ZONE $4, 'YYYY-MM') = $3 THEN l.valor END), 0) AS desp_mes,
       COUNT(*) FILTER (WHERE l.status = 'pendente' AND l.tipo = 'receita' AND l.vencimento < $2::date) AS receber_vencidos,
       COALESCE(SUM(CASE WHEN l.status = 'pendente' AND l.tipo = 'receita' AND l.vencimento < $2::date THEN l.valor END), 0) AS receber_vencidos_valor,
       COUNT(*) FILTER (WHERE l.status = 'pendente' AND l.tipo = 'despesa' AND l.vencimento < $2::date) AS pagar_vencidos,
       COALESCE(SUM(CASE WHEN l.status = 'pendente' AND l.tipo = 'despesa' AND l.vencimento < $2::date THEN l.valor END), 0) AS pagar_vencidos_valor,
       COUNT(*) FILTER (WHERE l.status = 'pendente' AND l.vencimento BETWEEN $2::date AND ($2::date + 3)) AS vencendo,
       COUNT(*) FILTER (WHERE l.loja_id IS NULL AND l.status <> 'cancelado') AS sem_unidade
     FROM fin_lancamentos l WHERE l.empresa_id = $1${unidade}`,
    v,
  );
  const x = r.rows[0];
  const n = (k) => dinheiro(x[k]);
  return {
    hoje, mesAtual: mes,
    saldo: dinheiro(n('receitas_pagas') - n('despesas_pagas')),
    totalReceitas: n('receitas_pagas'), totalDespesas: n('despesas_pagas'),
    aReceber: n('a_receber'), aPagar: n('a_pagar'),
    recMes: n('rec_mes'), despMes: n('desp_mes'), resultadoMes: dinheiro(n('rec_mes') - n('desp_mes')),
    receberVencidos: Number(x.receber_vencidos), receberVencidosValor: n('receber_vencidos_valor'),
    pagarVencidos: Number(x.pagar_vencidos), pagarVencidosValor: n('pagar_vencidos_valor'),
    inadimplentes: Number(x.receber_vencidos),
    vencendo3Dias: Number(x.vencendo),
    semUnidade: Number(x.sem_unidade),
  };
}

/** Receitas e despesas pagas por mês (últimos N meses), pelo mês do pagamento no fuso da empresa. */
export async function fluxo(db, empresaId, { meses = 12, lojaId = null, agora = new Date(), fuso = FUSO_PADRAO } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const n = Math.min(Math.max(Number(meses) || 12, 1), 36);
  const hoje = hojeNoFuso(agora, fuso);
  const periodo = [];
  for (let i = n - 1; i >= 0; i -= 1) periodo.push(somarMeses(`${hoje.slice(0, 7)}-01`, -i).slice(0, 7));
  const v = [empresa, fuso, `${periodo[0]}-01`];
  const unidade = filtroUnidade(lojaId, v);
  const r = await db.query(
    `SELECT to_char(l.pago_em AT TIME ZONE $2, 'YYYY-MM') AS mes,
            COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor END), 0) AS receitas,
            COALESCE(SUM(CASE WHEN l.tipo = 'despesa' THEN l.valor END), 0) AS despesas
       FROM fin_lancamentos l
      WHERE l.empresa_id = $1 AND l.status = 'pago' AND (l.pago_em AT TIME ZONE $2)::date >= $3::date${unidade}
      GROUP BY 1`,
    v,
  );
  const porMes = new Map(r.rows.map((row) => [row.mes, row]));
  return periodo.map((mes) => {
    const row = porMes.get(mes);
    const receitas = dinheiro(row?.receitas); const despesas = dinheiro(row?.despesas);
    return { mes, receitas, despesas, saldo: dinheiro(receitas - despesas) };
  });
}

const ORDEM_DRE = ['receita_bruta', 'deducao', 'cmv', 'pessoal', 'operacional', 'impostos', 'financeiro', 'investimento', 'outros'];
const ROTULO_DRE = {
  receita_bruta: 'Receita bruta', deducao: 'Deduções (taxas, estornos)', cmv: 'Custo das mercadorias e insumos (CMV)',
  pessoal: 'Pessoal', operacional: 'Despesas operacionais', impostos: 'Impostos', financeiro: 'Resultado financeiro',
  investimento: 'Investimentos', outros: 'Outros',
};

/**
 * DRE por competência (o mês a que o fato pertence), só com lançamentos não cancelados.
 * Receita do grupo "financeiro" soma; despesa do mesmo grupo subtrai.
 */
export async function dre(db, empresaId, { de, ate, lojaId = null, centroCustoId = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  await garantirCategorias(db, empresa);
  const inicio = exigirData(de, 'De');
  const fim = exigirData(ate, 'Até');
  if (fim < inicio) throw new ErroDominio('VALIDATION_ERROR', 'Período inválido');
  const v = [empresa, inicio, fim];
  let filtro = filtroUnidade(lojaId, v);
  // com centro: lançamento do centro inteiro, ou a fração dele no rateio
  let fator = '1';
  let juncaoRateio = '';
  if (centroCustoId) {
    v.push(exigirUuid(centroCustoId, 'centro de custo'));
    const temRateio = (await db.query("SELECT to_regclass('fin_rateios') AS t")).rows[0]?.t;
    if (temRateio) {
      juncaoRateio = ` LEFT JOIN fin_rateios rt ON rt.empresa_id = l.empresa_id AND rt.lancamento_id = COALESCE(l.estorno_de, l.id) AND rt.centro_custo_id = $${v.length}`;
      fator = 'COALESCE(rt.percentual / 100.0, 1)';
      filtro += ` AND (rt.lancamento_id IS NOT NULL OR (l.centro_custo_id = $${v.length} AND NOT EXISTS (SELECT 1 FROM fin_rateios rx WHERE rx.empresa_id = l.empresa_id AND rx.lancamento_id = COALESCE(l.estorno_de, l.id))))`;
    } else filtro += ` AND l.centro_custo_id = $${v.length}`;
  }
  const r = await db.query(
    // Estorno entra no grupo do original com o sinal contrário: estorno de despesa reduz aquela
    // despesa (não vira receita); estorno de receita é dedução (devolução).
    `SELECT CASE WHEN o.tipo = 'receita' THEN 'despesa' ELSE COALESCE(o.tipo, l.tipo) END AS tipo,
            CASE WHEN o.tipo = 'receita' THEN l.categoria ELSE COALESCE(o.categoria, l.categoria) END AS categoria,
            CASE WHEN o.tipo = 'receita' THEN 'deducao'
                 ELSE COALESCE(c.grupo_dre,
                   CASE
                     WHEN COALESCE(o.tipo, l.tipo) = 'receita' THEN 'receita_bruta'
                     WHEN LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%fornecedor%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%compra%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%mercadoria%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%insumo%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%cmv%' THEN 'cmv'
                     WHEN LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%comiss%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%salario%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%folha%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%pessoal%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%barbeiro%' THEN 'pessoal'
                     WHEN LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%taxa%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%cartao%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%cartão%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%maquin%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%desconto%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%estorno%' THEN 'deducao'
                     WHEN LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%imposto%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%tribut%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%simples%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%icms%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%iss%' THEN 'impostos'
                     WHEN LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%juros%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%tarifa%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%bancaria%' OR LOWER(COALESCE(o.categoria, l.categoria)) LIKE '%bancária%' THEN 'financeiro'
                     ELSE 'operacional'
                   END) END AS grupo,
            SUM(CASE WHEN o.tipo = 'despesa' THEN -l.valor ELSE l.valor END * ${fator}) AS total
       FROM fin_lancamentos l
       LEFT JOIN fin_lancamentos o ON o.empresa_id = l.empresa_id AND o.id = l.estorno_de${juncaoRateio}
       LEFT JOIN fin_categorias c ON c.empresa_id = l.empresa_id AND c.tipo = COALESCE(o.tipo, l.tipo) AND c.nome = COALESCE(o.categoria, l.categoria)
      WHERE l.empresa_id = $1 AND l.status <> 'cancelado' AND l.data_competencia BETWEEN $2 AND $3${filtro}
      GROUP BY 1, 2, 3`,
    v,
  );
  const grupos = Object.fromEntries(ORDEM_DRE.map((g) => [g, { grupo: g, rotulo: ROTULO_DRE[g], total: 0, linhas: [] }]));
  for (const row of r.rows) {
    if (!Number(row.total)) continue;
    const sinal = row.tipo === 'receita' ? 1 : -1;
    const valor = dinheiro(Number(row.total) * sinal);
    const g = grupos[row.grupo] || grupos.outros;
    g.total = dinheiro(g.total + valor);
    g.linhas.push({ tipo: row.tipo, categoria: row.categoria, valor });
  }
  // Perdas, quebras e diferenças de inventário (custo, líquidas das sobras): informação gerencial.
  // Não entram no total do CMV, que já é a compra lançada no razão (somar seria contar duas vezes).
  let perdasEstoque = null;
  if ((await db.query("SELECT to_regclass('est_movimentos') AS t")).rows[0]?.t && !centroCustoId) {
    const p = await perdasDoPeriodo(db, empresa, { de: inicio, ate: fim, lojaId });
    if (p.movimentos) perdasEstoque = p;
  }
  for (const g of Object.values(grupos)) g.linhas.sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
  const receitaLiquida = dinheiro(grupos.receita_bruta.total + grupos.deducao.total);
  const lucroBruto = dinheiro(receitaLiquida + grupos.cmv.total);
  const resultadoOperacional = dinheiro(lucroBruto + grupos.pessoal.total + grupos.operacional.total);
  const resultadoLiquido = dinheiro(resultadoOperacional + grupos.impostos.total + grupos.financeiro.total + grupos.outros.total);
  return {
    de: inicio, ate: fim,
    grupos: ORDEM_DRE.map((g) => grupos[g]),
    receitaBruta: grupos.receita_bruta.total, receitaLiquida, lucroBruto, resultadoOperacional, resultadoLiquido, perdasEstoque,
    investimentos: grupos.investimento.total,
    margemLiquida: grupos.receita_bruta.total > 0 ? Math.round((resultadoLiquido / grupos.receita_bruta.total) * 1000) / 10 : null,
  };
}

/** Totais do dia (recebido por meio, pago, pendências) — base do fechamento. */
export async function totaisDoDia(db, empresaId, { data, lojaId = null, fuso = FUSO_PADRAO } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const dia = exigirData(data, 'Data');
  const v = [empresa, dia, fuso];
  const unidade = filtroUnidade(lojaId, v);
  const r = await db.query(
    `SELECT l.tipo, COALESCE(l.meio_pagamento, 'nao_informado') AS meio, COUNT(*) AS n, SUM(l.valor) AS total
       FROM fin_lancamentos l
      WHERE l.empresa_id = $1 AND l.status = 'pago' AND (l.pago_em AT TIME ZONE $3)::date = $2::date${unidade}
      GROUP BY 1, 2`,
    v,
  );
  const recebidoPorMeio = {}; const pagoPorMeio = {}; let recebido = 0; let pago = 0; let lancamentos = 0;
  for (const row of r.rows) {
    const valor = dinheiro(row.total); lancamentos += Number(row.n);
    if (row.tipo === 'receita') { recebidoPorMeio[row.meio] = valor; recebido += valor; } else { pagoPorMeio[row.meio] = valor; pago += valor; }
  }
  const v2 = [empresa, dia];
  const unidade2 = filtroUnidade(lojaId, v2);
  const pend = await db.query(
    `SELECT COUNT(*) FILTER (WHERE l.tipo = 'receita') AS receber_n, COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'receita'), 0) AS receber,
            COUNT(*) FILTER (WHERE l.tipo = 'despesa') AS pagar_n, COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'despesa'), 0) AS pagar
       FROM fin_lancamentos l WHERE l.empresa_id = $1 AND l.status = 'pendente' AND l.vencimento <= $2::date${unidade2}`,
    v2,
  );
  const p = pend.rows[0];
  return {
    data: dia, lancamentos, recebido: dinheiro(recebido), pago: dinheiro(pago), saldoDoDia: dinheiro(recebido - pago),
    recebidoPorMeio, pagoPorMeio,
    vencidosAteHoje: { receber: Number(p.receber_n), receberValor: dinheiro(p.receber), pagar: Number(p.pagar_n), pagarValor: dinheiro(p.pagar) },
  };
}

export async function fecharDia(db, empresaId, { data, lojaId = null, responsavel, observacao = null, fuso = FUSO_PADRAO, agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const dia = data ? exigirData(data, 'Data') : hojeNoFuso(agora, fuso);
  if (dia > hojeNoFuso(agora, fuso)) throw new ErroDominio('VALIDATION_ERROR', 'Não dá para fechar um dia que ainda não chegou');
  if (lojaId === 'sem') throw new ErroDominio('VALIDATION_ERROR', 'Feche o dia de uma unidade ou da empresa toda');
  const unidade = lojaId && lojaId !== 'todas' ? exigirUuid(lojaId, 'unidade') : null;
  const totais = await totaisDoDia(db, empresa, { data: dia, lojaId: unidade, fuso });
  try {
    const r = await db.query(
      'INSERT INTO fin_fechamentos (empresa_id, loja_id, data, totais, responsavel, observacao) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [empresa, unidade, dia, JSON.stringify(totais), exigirTexto(responsavel || 'Sistema', 'Responsável', { max: 180 }), textoOpcional(observacao, 2000)],
    );
    return fechamentoDto(r.rows[0]);
  } catch (error) {
    if (error?.code === '23505') throw new ErroDominio('ALREADY_CLOSED', 'Este dia já foi fechado para esta unidade', 409);
    throw error;
  }
}

function fechamentoDto(row) {
  return { id: row.id, lojaId: row.loja_id || null, data: row.data instanceof Date ? row.data.toISOString().slice(0, 10) : String(row.data).slice(0, 10), totais: row.totais, responsavel: row.responsavel, observacao: row.observacao || null, criadoEm: row.criado_em };
}

export async function listarFechamentos(db, empresaId, { lojaId = null, limite = 60 } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const v = [empresa];
  const unidade = filtroUnidade(lojaId, v).replace(/\bl\./g, '');
  const r = await db.query(`SELECT * FROM fin_fechamentos WHERE empresa_id = $1${unidade} ORDER BY data DESC, criado_em DESC LIMIT ${Math.min(Math.max(Number(limite) || 60, 1), 365)}`, v);
  return r.rows.map(fechamentoDto);
}

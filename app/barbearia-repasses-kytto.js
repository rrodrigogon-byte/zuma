// KYTTO — Extrato, vale (adiantamento), repasse com recibo e comissão sobre plano.
//
// Extrato: cada serviço e venda do período com bruto, taxa, material, base,
// percentual e comissão, mais a parte do pote dos planos, vales e repasses.
// Repasse: registra o pagamento feito ao profissional (fora do sistema), gera
// recibo numerado, abate os vales em aberto e lança a despesa no financeiro.
// Um período já repassado não pode ser repassado de novo; o estorno mantém o
// histórico. Pote: parte da mensalidade dos planos (percentualPote) dividida
// entre os profissionais pelo valor de tabela dos serviços que atenderam pelo plano.

import crypto from 'node:crypto';
import { db, save } from './db.js';
import * as barbearia from './barbearia-erp-kytto.js';
import * as captacao from './dino-captacao-kytto.js';
import * as financeiroKytto from './financeiro-central-kytto.js';

export class RepasseError extends Error {
  constructor(message, code = 'REPASSE_ERRO', status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const texto = (valor, limite = 240) => String(valor ?? '').trim().replace(/\s+/g, ' ').slice(0, limite);
const dinheiro = (valor) => Number((Number(valor) || 0).toFixed(2));
const novoId = (prefixo) => `${prefixo}-${crypto.randomBytes(5).toString('hex')}`;
const dataValida = (valor) => /^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''));
const agoraIso = (opcoes = {}) => new Date(opcoes.agora ? new Date(opcoes.agora).valueOf() : Date.now()).toISOString();
const MEIOS = new Set(['pix', 'dinheiro', 'transferencia', 'outro']);

function estado(empresaId) {
  const raiz = db();
  raiz.barbeariaRepasses ||= {};
  const chave = String(empresaId || '');
  raiz.barbeariaRepasses[chave] ||= {};
  const atual = raiz.barbeariaRepasses[chave];
  atual.repasses ||= {};
  atual.vales ||= {};
  atual.sequenciaRecibo = Number(atual.sequenciaRecibo || 0);
  return atual;
}

function validarPeriodo(inicio, fim) {
  if (!dataValida(inicio) || !dataValida(fim)) throw new RepasseError('Informe o período (início e fim, AAAA-MM-DD).', 'PERIODO_INVALIDO');
  if (inicio > fim) throw new RepasseError('O início do período é depois do fim.', 'PERIODO_INVALIDO');
}

function profissional(empresaId, profissionalId) {
  const item = barbearia.listarProfissionais(empresaId, { incluirInativos: true }).find((p) => p.id === String(profissionalId || ''));
  if (!item) throw new RepasseError('Profissional não encontrado.', 'PROFISSIONAL_NAO_ENCONTRADO', 404);
  return item;
}

// ── Pote dos planos ─────────────────────────────────────────────────────────

/**
 * Para cada plano com percentualPote, soma a parte das mensalidades pagas no
 * período e divide pelos pontos (valor de tabela dos serviços usados pelo plano
 * no período) de cada profissional. Pote sem uso no período fica "sem rateio".
 */
export function poteDosPlanos(empresaId, { inicio, fim }) {
  validarPeriodo(inicio, fim);
  const planos = new Map(barbearia.listarPlanos(empresaId, { incluirInativos: true }).map((p) => [p.id, p]));
  const agendamentos = new Map(barbearia.listarAgendamentos(empresaId, {}).map((a) => [a.id, a]));
  const noPeriodo = (iso) => { const d = String(iso || '').slice(0, 10); return d >= inicio && d <= fim; };
  const porPlano = new Map();
  for (const assinatura of barbearia.listarAssinaturas(empresaId)) {
    const plano = planos.get(assinatura.planoId);
    const percentual = Number(plano?.percentualPote || 0);
    if (!plano || percentual <= 0) continue;
    const { usos, pagamentos } = captacao.movimentosAssinatura(empresaId, assinatura.id);
    const grupo = porPlano.get(plano.id) || { planoId: plano.id, plano: plano.nome, percentualPote: percentual, receita: 0, pote: 0, pontos: new Map(), pontosSemProfissional: 0 };
    for (const pagamento of pagamentos) if (noPeriodo(pagamento.registradoEm)) grupo.receita += Number(pagamento.valor || 0);
    for (const uso of usos) {
      if (!noPeriodo(uso.registradoEm)) continue;
      const pontos = Number(uso.valorAvulso || 0);
      const profissionalId = agendamentos.get(uso.agendamentoId)?.profissionalId || uso.profissionalId || '';
      if (!profissionalId) { grupo.pontosSemProfissional += pontos; continue; }
      grupo.pontos.set(profissionalId, (grupo.pontos.get(profissionalId) || 0) + pontos);
    }
    porPlano.set(plano.id, grupo);
  }
  const porProfissional = new Map();
  const planosResumo = [];
  for (const grupo of porPlano.values()) {
    grupo.pote = grupo.receita * grupo.percentualPote / 100;
    const totalPontos = [...grupo.pontos.values()].reduce((s, p) => s + p, 0);
    let distribuido = 0;
    for (const [profissionalId, pontos] of grupo.pontos) {
      const valor = totalPontos > 0 ? grupo.pote * pontos / totalPontos : 0;
      distribuido += valor;
      const atual = porProfissional.get(profissionalId) || { valor: 0, detalhes: [] };
      atual.valor += valor;
      atual.detalhes.push({ planoId: grupo.planoId, plano: grupo.plano, pontos: dinheiro(pontos), totalPontos: dinheiro(totalPontos), valor: dinheiro(valor) });
      porProfissional.set(profissionalId, atual);
    }
    planosResumo.push({ planoId: grupo.planoId, plano: grupo.plano, percentualPote: grupo.percentualPote, receita: dinheiro(grupo.receita), pote: dinheiro(grupo.pote), distribuido: dinheiro(distribuido), semRateio: dinheiro(grupo.pote - distribuido) });
  }
  return { inicio, fim, planos: planosResumo, porProfissional };
}

// ── Vales (adiantamentos) ───────────────────────────────────────────────────

export function listarVales(empresaId, { profissionalId = '', status = '' } = {}) {
  return Object.values(estado(empresaId).vales)
    .filter((v) => (!profissionalId || v.profissionalId === String(profissionalId)) && (!status || v.status === status))
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .map((v) => ({ ...v }));
}

/** Saldo de comissão ainda não repassada, de depois do último repasse até hoje. */
export function saldoDisponivel(empresaId, profissionalId, opcoes = {}) {
  const hoje = agoraIso(opcoes).slice(0, 10);
  const pagos = listarRepasses(empresaId, { profissionalId }).filter((r) => r.status === 'pago');
  const ultimoFim = pagos.reduce((max, r) => (r.fim > max ? r.fim : max), '');
  const inicio = ultimoFim ? new Date(Date.parse(`${ultimoFim}T12:00:00Z`) + 86400000).toISOString().slice(0, 10) : '2000-01-01';
  if (inicio > hoje) return { inicio, fim: hoje, comissao: 0, valesAbertos: 0, disponivel: 0 };
  const extrato = extratoProfissional(empresaId, profissionalId, { inicio, fim: hoje }, opcoes);
  return { inicio, fim: hoje, comissao: extrato.totais.comissaoTotal, valesAbertos: extrato.totais.valesAbertos, disponivel: dinheiro(Math.max(0, extrato.totais.comissaoTotal - extrato.totais.valesAbertos)) };
}

export function registrarVale(empresaId, dados = {}, opcoes = {}) {
  const prof = profissional(empresaId, dados.profissionalId);
  const valor = dinheiro(dados.valor);
  if (valor <= 0) throw new RepasseError('Informe o valor do vale.', 'VALOR_INVALIDO');
  if (dados.confirmado !== true) throw new RepasseError('Confirme o vale.', 'CONFIRMACAO_OBRIGATORIA');
  const saldo = saldoDisponivel(empresaId, prof.id, opcoes);
  if (valor > saldo.disponivel) throw new RepasseError(`O vale passa da comissão já realizada e não repassada (disponível: R$ ${saldo.disponivel.toFixed(2).replace('.', ',')}).`, 'VALE_ACIMA_DO_SALDO', 409);
  const atual = estado(empresaId);
  const chave = texto(dados.chaveIdempotencia, 120);
  if (chave) {
    const existente = Object.values(atual.vales).find((v) => v.chaveIdempotencia === chave);
    if (existente) return { ...existente, repetido: true };
  }
  const agora = agoraIso(opcoes);
  const vale = { id: novoId('vale'), profissionalId: prof.id, profissionalNome: prof.nome, valor, meio: MEIOS.has(dados.meio) ? dados.meio : 'pix', motivo: texto(dados.motivo, 200), status: 'aberto', chaveIdempotencia: chave || null, criadoEm: agora, criadoPor: texto(dados.usuario, 160) || null };
  atual.vales[vale.id] = vale;
  try {
    financeiroKytto.registrarLancamento(empresaId, { tipo: 'despesa', categoria: 'Comissões - vale', descricao: `Vale de comissão · ${prof.nome}`, valor, origem: 'barbearia_vale_comissao', status: 'pago', meioPagamento: vale.meio, dataOperacao: agora, pagoEm: agora, chaveIdempotencia: `barbearia_vale:${empresaId}:${vale.id}`, referencia: { valeId: vale.id, profissionalId: prof.id } });
  } catch (erro) { vale.erroFinanceiro = texto(erro?.message || erro, 200); }
  save();
  return { ...vale };
}

// ── Extrato ────────────────────────────────────────────────────────────────

export function extratoProfissional(empresaId, profissionalId, { inicio, fim }, opcoes = {}) {
  validarPeriodo(inicio, fim);
  const prof = profissional(empresaId, profissionalId);
  const comissoes = barbearia.obterComissoes(empresaId, { inicio, fim, detalhar: true, profissionalId: prof.id });
  const linha = comissoes.porProfissional.find((item) => item.profissionalId === prof.id) || { linhas: [], bruto: 0, taxas: 0, materiais: 0, comissaoServicos: 0, comissaoProdutos: 0, atendimentos: 0, vendasProdutos: 0 };
  const pote = poteDosPlanos(empresaId, { inicio, fim }).porProfissional.get(prof.id) || { valor: 0, detalhes: [] };
  const valesAbertos = listarVales(empresaId, { profissionalId: prof.id, status: 'aberto' });
  const repasses = listarRepasses(empresaId, { profissionalId: prof.id }).filter((r) => r.status === 'pago' && r.inicio <= fim && r.fim >= inicio);
  const comissaoTotal = dinheiro(Number(linha.comissaoServicos || 0) + Number(linha.comissaoProdutos || 0) + pote.valor);
  const totalVales = dinheiro(valesAbertos.reduce((s, v) => s + v.valor, 0));
  return {
    profissional: { id: prof.id, nome: prof.nome, percentualComissao: prof.percentualComissao, percentualComissaoProduto: prof.percentualComissaoProduto, descontaTaxaMaquininha: prof.descontaTaxaMaquininha !== false, descontaMaterial: Boolean(prof.descontaMaterial) },
    inicio,
    fim,
    linhas: linha.linhas || [],
    pote: pote.detalhes,
    vales: valesAbertos,
    repassesNoPeriodo: repasses.map((r) => ({ id: r.id, recibo: r.recibo, inicio: r.inicio, fim: r.fim, valor: r.valorPago, pagoEm: r.pagoEm })),
    totais: {
      atendimentos: linha.atendimentos || 0,
      vendasProdutos: linha.vendasProdutos || 0,
      bruto: dinheiro(linha.bruto),
      taxas: dinheiro(linha.taxas),
      materiais: dinheiro(linha.materiais),
      comissaoServicos: dinheiro(linha.comissaoServicos),
      comissaoProdutos: dinheiro(linha.comissaoProdutos),
      comissaoPlanos: dinheiro(pote.valor),
      comissaoTotal,
      valesAbertos: totalVales,
      jaRepassado: dinheiro(repasses.reduce((s, r) => s + r.valorPago, 0)),
      aReceber: dinheiro(Math.max(0, comissaoTotal - totalVales - repasses.reduce((s, r) => s + r.comissaoTotal, 0))),
    },
    taxasConfiguradas: comissoes.taxasConfiguradas,
    meiosSemTaxaConfigurada: comissoes.meiosSemTaxaConfigurada,
  };
}

// ── Repasses ───────────────────────────────────────────────────────────────

export function listarRepasses(empresaId, { profissionalId = '' } = {}) {
  return Object.values(estado(empresaId).repasses)
    .filter((r) => !profissionalId || r.profissionalId === String(profissionalId))
    .sort((a, b) => String(b.pagoEm).localeCompare(String(a.pagoEm)))
    .map((r) => ({ ...r, vales: (r.vales || []).map((v) => ({ ...v })) }));
}

export function obterRepasse(empresaId, repasseId) {
  const r = estado(empresaId).repasses[String(repasseId)];
  return r ? { ...r, vales: (r.vales || []).map((v) => ({ ...v })) } : null;
}

export function registrarRepasse(empresaId, dados = {}, opcoes = {}) {
  if (dados.confirmado !== true) throw new RepasseError('Confirme o repasse.', 'CONFIRMACAO_OBRIGATORIA');
  const { inicio, fim } = dados;
  validarPeriodo(inicio, fim);
  const prof = profissional(empresaId, dados.profissionalId);
  const atual = estado(empresaId);
  const conflito = Object.values(atual.repasses).find((r) => r.profissionalId === prof.id && r.status === 'pago' && r.inicio <= fim && r.fim >= inicio);
  if (conflito) throw new RepasseError(`Já existe o repasse ${conflito.recibo} cobrindo ${conflito.inicio} a ${conflito.fim}.`, 'PERIODO_JA_REPASSADO', 409);
  const extrato = extratoProfissional(empresaId, prof.id, { inicio, fim }, opcoes);
  const valorPago = dinheiro(extrato.totais.comissaoTotal - extrato.totais.valesAbertos);
  if (extrato.totais.comissaoTotal <= 0) throw new RepasseError('Não há comissão no período.', 'SEM_COMISSAO', 409);
  const meio = MEIOS.has(dados.meio) ? dados.meio : 'pix';
  atual.sequenciaRecibo += 1;
  const agora = agoraIso(opcoes);
  const repasse = {
    id: novoId('rep'),
    recibo: `REC-${String(atual.sequenciaRecibo).padStart(5, '0')}`,
    profissionalId: prof.id,
    profissionalNome: prof.nome,
    inicio,
    fim,
    status: 'pago',
    meio,
    comissaoServicos: extrato.totais.comissaoServicos,
    comissaoProdutos: extrato.totais.comissaoProdutos,
    comissaoPlanos: extrato.totais.comissaoPlanos,
    comissaoTotal: extrato.totais.comissaoTotal,
    bruto: extrato.totais.bruto,
    taxas: extrato.totais.taxas,
    materiais: extrato.totais.materiais,
    atendimentos: extrato.totais.atendimentos,
    vendasProdutos: extrato.totais.vendasProdutos,
    vales: extrato.vales.map((v) => ({ id: v.id, valor: v.valor, criadoEm: v.criadoEm })),
    valesAbatidos: extrato.totais.valesAbertos,
    valorPago: Math.max(0, valorPago),
    // Vale maior que a comissão do período: a diferença continua em aberto.
    saldoVale: dinheiro(Math.max(0, -valorPago)),
    observacao: texto(dados.observacao, 300),
    pagoEm: agora,
    pagoPor: texto(dados.usuario, 160) || null,
  };
  for (const v of extrato.vales) {
    const vale = atual.vales[v.id];
    if (!vale) continue;
    vale.status = 'abatido';
    vale.repasseId = repasse.id;
    vale.abatidoEm = agora;
  }
  if (repasse.saldoVale > 0) {
    const resto = { id: novoId('vale'), profissionalId: prof.id, profissionalNome: prof.nome, valor: repasse.saldoVale, meio: 'outro', motivo: `Saldo do vale após o repasse ${repasse.recibo}`, status: 'aberto', criadoEm: agora, criadoPor: 'sistema', origemRepasseId: repasse.id };
    atual.vales[resto.id] = resto;
  }
  atual.repasses[repasse.id] = repasse;
  if (repasse.valorPago > 0 && dados.lancarDespesa !== false) {
    try {
      const lanc = financeiroKytto.registrarLancamento(empresaId, { tipo: 'despesa', categoria: 'Comissões', descricao: `Repasse ${repasse.recibo} · ${prof.nome} · ${inicio} a ${fim}`, valor: repasse.valorPago, origem: 'barbearia_repasse_comissao', status: 'pago', meioPagamento: meio, dataOperacao: agora, pagoEm: agora, chaveIdempotencia: `barbearia_repasse:${empresaId}:${repasse.id}`, referencia: { repasseId: repasse.id, profissionalId: prof.id } });
      repasse.financeiroLancamentoId = lanc?.id || null;
    } catch (erro) { repasse.erroFinanceiro = texto(erro?.message || erro, 200); }
  }
  save();
  return obterRepasse(empresaId, repasse.id);
}

/** Estorno: o repasse fica registrado como estornado e os vales voltam a abrir. */
export function estornarRepasse(empresaId, repasseId, { motivo = '', usuario = '' } = {}, opcoes = {}) {
  const atual = estado(empresaId);
  const repasse = atual.repasses[String(repasseId)];
  if (!repasse) throw new RepasseError('Repasse não encontrado.', 'REPASSE_NAO_ENCONTRADO', 404);
  if (repasse.status === 'estornado') return obterRepasse(empresaId, repasse.id);
  if (texto(motivo).length < 5) throw new RepasseError('Informe o motivo do estorno.', 'MOTIVO_OBRIGATORIO');
  const agora = agoraIso(opcoes);
  Object.assign(repasse, { status: 'estornado', estornadoEm: agora, estornadoPor: texto(usuario, 160) || null, motivoEstorno: texto(motivo, 300) });
  for (const vale of Object.values(atual.vales)) {
    if (vale.repasseId === repasse.id) { vale.status = 'aberto'; delete vale.repasseId; delete vale.abatidoEm; }
    if (vale.origemRepasseId === repasse.id && vale.status === 'aberto') vale.status = 'cancelado';
  }
  if (repasse.valorPago > 0) {
    try {
      financeiroKytto.registrarLancamento(empresaId, { tipo: 'receita', categoria: 'Comissões - estorno', descricao: `Estorno do repasse ${repasse.recibo} · ${repasse.profissionalNome}`, valor: repasse.valorPago, origem: 'barbearia_repasse_estorno', status: 'pago', meioPagamento: repasse.meio, dataOperacao: agora, pagoEm: agora, chaveIdempotencia: `barbearia_repasse_estorno:${empresaId}:${repasse.id}`, referencia: { repasseId: repasse.id } });
    } catch (erro) { repasse.erroFinanceiroEstorno = texto(erro?.message || erro, 200); }
  }
  save();
  return obterRepasse(empresaId, repasse.id);
}

// ── Recibo ─────────────────────────────────────────────────────────────────

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const MEIO_ROTULO = { pix: 'Pix', dinheiro: 'Dinheiro', transferencia: 'Transferência', outro: 'Outro' };

export function reciboHtml(empresaId, repasseId, { empresaNome = '' } = {}) {
  const r = obterRepasse(empresaId, repasseId);
  if (!r) throw new RepasseError('Repasse não encontrado.', 'REPASSE_NAO_ENCONTRADO', 404);
  const linha = (rotulo, valor) => `<tr><td>${esc(rotulo)}</td><td class="v">${valor}</td></tr>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recibo ${esc(r.recibo)}</title>
<style>body{font:13px/1.45 Arial,Helvetica,sans-serif;color:#111;background:#f2f2f2;margin:0}.pg{max-width:640px;margin:16px auto;background:#fff;border:1px solid #222;padding:22px;position:relative}h1{font-size:17px;margin:0 0 2px}.sub{color:#555;font-size:12px}table{width:100%;border-collapse:collapse;margin:14px 0}td{padding:5px 0;border-bottom:1px solid #e5e5e5}.v{text-align:right;font-weight:600}.tot td{font-size:15px;border-bottom:2px solid #111}.ass{margin-top:46px;display:grid;grid-template-columns:1fr 1fr;gap:28px}.ass div{border-top:1px solid #111;padding-top:4px;text-align:center;font-size:12px}.tarja{position:absolute;top:40%;left:0;right:0;text-align:center;transform:rotate(-18deg);font:700 40px Arial;color:rgba(200,0,0,.2)}.acoes{text-align:center;margin:12px}.acoes button{font:600 13px Arial;padding:8px 18px;border:1px solid #222;background:#fff;border-radius:6px;cursor:pointer}@media print{body{background:#fff}.pg{margin:0;border:0}.acoes{display:none}}</style></head><body>
<div class="acoes"><button onclick="window.print()">Imprimir / salvar em PDF</button></div>
<div class="pg">${r.status === 'estornado' ? '<div class="tarja">ESTORNADO</div>' : ''}
<h1>Recibo de repasse de comissão ${esc(r.recibo)}</h1>
<div class="sub">${esc(empresaNome || 'Barbearia')} · pago em ${esc(dataBr(r.pagoEm))} · ${esc(MEIO_ROTULO[r.meio] || r.meio)}</div>
<p>Recebi de <b>${esc(empresaNome || 'Barbearia')}</b> a quantia de <b>${moeda(r.valorPago)}</b>, referente às comissões de <b>${esc(dataBr(r.inicio))} a ${esc(dataBr(r.fim))}</b>, conforme o demonstrativo abaixo.</p>
<table>${linha('Profissional', esc(r.profissionalNome))}${linha('Atendimentos', r.atendimentos)}${linha('Vendas de produtos', r.vendasProdutos)}${linha('Valor bruto atendido', moeda(r.bruto))}${linha('Taxas descontadas da base', moeda(r.taxas))}${linha('Material descontado da base', moeda(r.materiais))}${linha('Comissão de serviços', moeda(r.comissaoServicos))}${linha('Comissão de produtos', moeda(r.comissaoProdutos))}${linha('Comissão de planos (pote)', moeda(r.comissaoPlanos))}${linha('Vales abatidos', `− ${moeda(r.valesAbatidos)}`)}
<tr class="tot"><td>Valor pago</td><td class="v">${moeda(r.valorPago)}</td></tr></table>
${r.saldoVale > 0 ? `<p class="sub">Vale maior que a comissão: ${moeda(r.saldoVale)} continuam em aberto para o próximo repasse.</p>` : ''}
${r.observacao ? `<p class="sub">Observação: ${esc(r.observacao)}</p>` : ''}
${r.status === 'estornado' ? `<p class="sub">Estornado em ${esc(dataBr(r.estornadoEm))}: ${esc(r.motivoEstorno)}</p>` : ''}
<div class="ass"><div>${esc(r.profissionalNome)}</div><div>${esc(empresaNome || 'Barbearia')}</div></div>
</div></body></html>`;
}

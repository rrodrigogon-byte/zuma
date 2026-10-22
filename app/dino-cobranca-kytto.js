// ============================================================================
// COBRANÇAS DA BARBEARIA (fase 2): sinal no agendamento, cobrança do clube e
// cashback.
//
// Provedores, na ordem:
//   - InfinitePay (link de checkout Pix/cartão), quando INFINITEPAY_HANDLE ou
//     INFINITEPAY_TAG estiver no ambiente. A confirmação NUNCA confia no corpo do
//     webhook: é conferida na própria InfinitePay (payment_check) com o número do
//     pedido, o valor esperado e o método;
//   - Pix com a chave da barbearia (copia e cola), confirmado pela equipe no admin;
//   - nenhum: as cobranças ficam desligadas (nada é cobrado nem simulado).
//
// Tudo nasce desligado. Dinheiro só muda de estado por uma confirmação verificada
// (webhook conferido, retorno conferido ou confirmação manual registrada com o
// nome de quem confirmou), e cada efeito é idempotente.
// ============================================================================

import crypto from 'node:crypto';
import { db, save } from './db.js';
import * as barbearia from './barbearia-erp-kytto.js';
import * as clientesKytto from './clientes-contas-kytto.js';
import * as captacao from './dino-captacao-kytto.js';
import * as financeiroKytto from './financeiro-central-kytto.js';
import { gerarBrCode } from './pagamentos.js';
import { telefoneChave } from './dino-clientes-vinculo.js';
import { createInfinitePayAdapter, infinitePayConfigured } from './core/infinitepay-adapter.js';

const DIA_MS = 24 * 60 * 60 * 1000;

export class CobrancaError extends Error {
  constructor(message, code = 'COBRANCA_INVALIDA', status = 400) {
    super(message);
    this.name = 'CobrancaError';
    this.code = code;
    this.status = status;
  }
}

function texto(valor, limite = 240) {
  return String(valor ?? '').replace(/\u0000/g, '').trim().slice(0, limite);
}
function numero(valor, padrao = 0) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}
function dinheiro(valor) {
  return Math.round(Math.max(0, numero(valor)) * 100) / 100;
}
function agoraMs(opcoes = {}) {
  return Number.isFinite(opcoes.agora) ? opcoes.agora : Date.now();
}
function iso(ms) {
  return new Date(ms).toISOString();
}

function configuracaoPadrao() {
  return {
    sinal: { ativo: false, tipo: 'percentual', valor: 30, prazoMinutos: 30 },
    // Régua do clube: 1º aviso N dias antes; tentativas no vencimento e a cada
    // intervalo; sem pagamento após bloquearAposDias do vencimento, o plano é pausado.
    cobrancaClube: { ativa: false, diasAntes: 3, tentativas: 3, intervaloDias: 2, bloquearAposDias: 5, bloquearAutomatico: true },
    pix: { chave: '', nomeRecebedor: '', cidade: '' },
    cashback: { percentual: 0, validadeDias: 90 },
    vale: { ativo: false },
  };
}

function estado(empresaId) {
  const raiz = db();
  raiz.barbeariaCobranca ||= {};
  raiz.barbeariaCobrancaIndice ||= {};
  const chave = String(empresaId || '');
  raiz.barbeariaCobranca[chave] ||= {};
  const atual = raiz.barbeariaCobranca[chave];
  atual.cobrancas ||= {};
  atual.carteiras ||= {};
  const padrao = configuracaoPadrao();
  const salvo = atual.configuracao || {};
  atual.configuracao = {
    sinal: { ...padrao.sinal, ...(salvo.sinal || {}) },
    cobrancaClube: { ...padrao.cobrancaClube, ...(salvo.cobrancaClube || {}) },
    pix: { ...padrao.pix, ...(salvo.pix || {}) },
    cashback: { ...padrao.cashback, ...(salvo.cashback || {}) },
    vale: { ...padrao.vale, ...(salvo.vale || {}) },
  };
  return atual;
}

// ── Configuração ───────────────────────────────────────────────────────────

/**
 * A InfiniteTag do ambiente é de UMA conta. Só as empresas listadas em
 * INFINITEPAY_BARBEARIA_EMPRESAS (ids separados por vírgula) recebem por ela;
 * as outras usam a própria chave Pix. Assim o dinheiro de uma empresa nunca cai
 * na conta de outra.
 */
export function infinitePayDaEmpresa(empresaId) {
  if (!infinitePayConfigured()) return false;
  const liberadas = String(process.env.INFINITEPAY_BARBEARIA_EMPRESAS || '').split(',').map((item) => item.trim()).filter(Boolean);
  return liberadas.includes(String(empresaId));
}

export function provedorCobranca(empresaId) {
  if (infinitePayDaEmpresa(empresaId)) return 'infinitepay';
  const pix = estado(empresaId).configuracao.pix;
  if (pix.chave && pix.nomeRecebedor && pix.cidade) return 'pix_manual';
  return null;
}

export function obterConfiguracaoCobranca(empresaId) {
  const atual = estado(empresaId).configuracao;
  return { ...JSON.parse(JSON.stringify(atual)), provedor: provedorCobranca(empresaId), infinitePayDisponivel: infinitePayDaEmpresa(empresaId) };
}

function limitar(valor, anterior, min, max) {
  if (valor === undefined || valor === null || valor === '') return anterior;
  return Math.max(min, Math.min(max, numero(valor, anterior)));
}

// Chave Pix: CPF/CNPJ (só dígitos), e-mail, telefone +55 ou chave aleatória (UUID).
function chavePixValida(valor) {
  const chave = texto(valor, 77);
  if (!chave) return '';
  const digitos = chave.replace(/\D/g, '');
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chave)) return chave.toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chave)) return chave.toLowerCase();
  if (/^\+55\d{10,11}$/.test(chave.replace(/[\s()-]/g, ''))) return chave.replace(/[\s()-]/g, '');
  if (digitos.length === 11 || digitos.length === 14) return digitos;
  throw new CobrancaError('Chave Pix inválida. Use CPF/CNPJ, e-mail, telefone com +55 ou chave aleatória.', 'PIX_CHAVE_INVALIDA');
}

function semAcentoMaiusculo(valor, limite) {
  return texto(valor, 60).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().slice(0, limite).trim();
}

export function salvarConfiguracaoCobranca(empresaId, dados = {}) {
  const atual = estado(empresaId);
  const c = atual.configuracao;
  const sinal = dados.sinal || {};
  const clube = dados.cobrancaClube || {};
  const pix = dados.pix || {};
  const cashback = dados.cashback || {};
  const configuracao = {
    sinal: {
      ativo: sinal.ativo === undefined ? c.sinal.ativo : sinal.ativo === true,
      tipo: ['percentual', 'fixo'].includes(sinal.tipo) ? sinal.tipo : c.sinal.tipo,
      valor: limitar(sinal.valor, c.sinal.valor, 0, sinal.tipo === 'fixo' || (!sinal.tipo && c.sinal.tipo === 'fixo') ? 1000 : 100),
      prazoMinutos: Math.round(limitar(sinal.prazoMinutos, c.sinal.prazoMinutos, 10, 1440)),
    },
    cobrancaClube: {
      ativa: clube.ativa === undefined ? c.cobrancaClube.ativa : clube.ativa === true,
      diasAntes: Math.round(limitar(clube.diasAntes, c.cobrancaClube.diasAntes, 0, 10)),
      tentativas: Math.round(limitar(clube.tentativas, c.cobrancaClube.tentativas, 1, 5)),
      intervaloDias: Math.round(limitar(clube.intervaloDias, c.cobrancaClube.intervaloDias, 1, 10)),
      bloquearAposDias: Math.round(limitar(clube.bloquearAposDias, c.cobrancaClube.bloquearAposDias, 1, 30)),
      bloquearAutomatico: clube.bloquearAutomatico === undefined ? c.cobrancaClube.bloquearAutomatico !== false : clube.bloquearAutomatico === true,
    },
    pix: {
      chave: pix.chave === undefined ? c.pix.chave : chavePixValida(pix.chave),
      nomeRecebedor: pix.nomeRecebedor === undefined ? c.pix.nomeRecebedor : semAcentoMaiusculo(pix.nomeRecebedor, 25),
      cidade: pix.cidade === undefined ? c.pix.cidade : semAcentoMaiusculo(pix.cidade, 15),
    },
    cashback: {
      percentual: limitar(cashback.percentual, c.cashback.percentual, 0, 30),
      validadeDias: Math.round(limitar(cashback.validadeDias, c.cashback.validadeDias, 7, 365)),
    },
    vale: { ativo: dados.vale?.ativo === undefined ? c.vale.ativo : dados.vale.ativo === true },
  };
  const provedorDisponivel = infinitePayDaEmpresa(empresaId)
    || Boolean(configuracao.pix.chave && configuracao.pix.nomeRecebedor && configuracao.pix.cidade);
  if ((configuracao.sinal.ativo || configuracao.cobrancaClube.ativa || configuracao.vale.ativo) && !provedorDisponivel) {
    throw new CobrancaError('Configure a InfinitePay no servidor ou a chave Pix da barbearia antes de ligar as cobranças.', 'PROVEDOR_AUSENTE', 409);
  }
  atual.configuracao = configuracao;
  save();
  return obterConfiguracaoCobranca(empresaId);
}

// ── Cobranças ──────────────────────────────────────────────────────────────

function basePublica() {
  const base = texto(process.env.PUBLIC_BASE_URL || process.env.SERVER_URL, 300).replace(/\/+$/, '');
  return /^https:\/\//.test(base) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base) ? base : '';
}

function contaInfinitePay(empresaId) {
  const base = basePublica();
  const slug = texto(barbearia.obterConfiguracao(empresaId)?.slugPublico, 80);
  return {
    secretRef: process.env.INFINITEPAY_HANDLE ? 'env:INFINITEPAY_HANDLE' : 'env:INFINITEPAY_TAG',
    publicConfig: {
      // O domínio público só vale para o slug que ele serve (mesma regra das meta tags).
      redirectUrl: base && slug === 'dino' ? `${base}/agendar/${encodeURIComponent(slug)}?pagamento=retorno` : undefined,
      webhookUrl: base ? `${base}/api/webhooks/infinitepay/barbearia` : undefined,
    },
  };
}

function novoNumeroPedido(tipo) {
  return `DINO${tipo === 'sinal' ? 'S' : tipo === 'assinatura' ? 'C' : tipo === 'vale' ? 'V' : 'X'}${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

function visaoCobranca(item) {
  if (!item) return null;
  return {
    id: item.id,
    tipo: item.tipo,
    referencia: item.referencia,
    valor: item.valor,
    descricao: item.descricao,
    status: item.status,
    provedor: item.provedor,
    url: item.url || null,
    pixCopiaECola: item.pixCopiaECola || null,
    expiraEm: item.expiraEm || null,
    criadoEm: item.criadoEm,
    pagoEm: item.pagoEm || null,
    confirmadoPor: item.confirmadoPor || null,
    clienteNome: item.clienteNome || '',
    pagoAposExpirar: item.pagoAposExpirar === true,
    pagoAposCancelar: item.pagoAposCancelar === true,
    duplicada: item.duplicada === true,
    lojaId: item.lojaId || '',
    efeitoErro: item.efeitoErro || null,
    receitaFinanceiraPendente: item.receitaFinanceiraPendente === true,
    receitaFinanceiraErro: item.receitaFinanceiraErro || null,
    revisar: item.revisar || null,
  };
}

/**
 * Cria (ou devolve a já existente) a cobrança de uma referência. Idempotente por
 * tipo + referência enquanto a cobrança estiver pendente ou paga.
 */
export async function criarCobranca(empresaId, dados = {}, opcoes = {}) {
  const tipo = ['sinal', 'assinatura', 'vale'].includes(dados.tipo) ? dados.tipo : null;
  if (!tipo) throw new CobrancaError('Tipo de cobrança inválido.');
  const referencia = texto(dados.referencia, 160);
  const valor = dinheiro(dados.valor);
  if (!referencia) throw new CobrancaError('Referência da cobrança obrigatória.');
  if (valor < 1) throw new CobrancaError('Valor mínimo da cobrança: R$ 1,00.', 'VALOR_INVALIDO');
  const atual = estado(empresaId);
  const lojaId = texto(dados.lojaId, 120);
  const existente = Object.values(atual.cobrancas).find((item) => item.tipo === tipo && item.referencia === referencia && (!lojaId || item.lojaId === lojaId) && ['pendente', 'paga'].includes(item.status));
  if (existente) return visaoCobranca(existente);
  const provedor = opcoes.provedor || provedorCobranca(empresaId);
  if (!provedor) throw new CobrancaError('Nenhum meio de cobrança configurado.', 'PROVEDOR_AUSENTE', 409);
  const ms = agoraMs(opcoes);
  const orderNsu = novoNumeroPedido(tipo);
  const item = {
    id: `cob-${crypto.randomBytes(6).toString('hex')}`,
    empresaId: String(empresaId),
    tipo,
    referencia,
    valor,
    descricao: texto(dados.descricao, 120) || (tipo === 'sinal' ? 'Sinal do agendamento' : tipo === 'vale' ? 'Vale-presente' : 'Mensalidade do clube'),
    clienteId: texto(dados.clienteId, 120),
    clienteNome: texto(dados.clienteNome, 120),
    telefone: texto(dados.telefone, 30),
    lojaId,
    status: 'pendente',
    provedor,
    orderNsu,
    criadoEm: iso(ms),
    expiraEm: dados.expiraEm || null,
  };
  if (provedor === 'infinitepay') {
    const adapter = opcoes.adapter || createInfinitePayAdapter();
    const checkout = await adapter.createCheckout({ order: { publicCode: orderNsu, total: valor }, account: contaInfinitePay(empresaId) });
    item.url = checkout?.publicData?.url || '';
    if (!item.url) throw new CobrancaError('A InfinitePay não devolveu o link de pagamento.', 'PROVEDOR_SEM_LINK', 502);
    item.invoiceSlug = texto(checkout?.publicData?.invoice_slug || checkout?.publicData?.invoiceSlug || checkout?.publicData?.slug, 180);
    if (!item.invoiceSlug) throw new CobrancaError('A InfinitePay não devolveu o invoice_slug do pagamento.', 'PROVEDOR_SEM_INVOICE_SLUG', 502);
  } else if (provedor === 'pix_manual') {
    const pix = atual.configuracao.pix;
    item.pixCopiaECola = gerarBrCode({ chave: pix.chave, nome: pix.nomeRecebedor, cidade: pix.cidade, valor, txid: orderNsu.slice(0, 25) });
  } else {
    throw new CobrancaError('Meio de cobrança desconhecido.', 'PROVEDOR_AUSENTE', 409);
  }
  atual.cobrancas[item.id] = item;
  db().barbeariaCobrancaIndice[orderNsu] = { empresaId: String(empresaId), id: item.id };
  save();
  return visaoCobranca(item);
}

export function obterCobranca(empresaId, cobrancaId, lojaId = '') {
  const item = estado(empresaId).cobrancas[String(cobrancaId)];
  return item && (!lojaId || item.lojaId === String(lojaId)) ? visaoCobranca(item) : null;
}

export function listarCobrancas(empresaId, { status = '', tipo = '', lojaId = '', limite = 200 } = {}) {
  return Object.values(estado(empresaId).cobrancas)
    .filter((item) => (!status || item.status === status) && (!tipo || item.tipo === tipo) && (!lojaId || item.lojaId === String(lojaId)))
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .slice(0, Math.min(500, Math.max(1, numero(limite, 200))))
    .map(visaoCobranca);
}

function registrarReceita(empresaId, item, meio) {
  try {
    return financeiroKytto.registrarLancamento(empresaId, {
      tipo: 'receita',
      categoria: item.tipo === 'sinal' ? 'Sinais de agendamento' : item.tipo === 'vale' ? 'Vale-presente' : 'Clube de assinatura',
      descricao: `${item.descricao}${item.clienteNome ? ` · ${item.clienteNome}` : ''}`,
      valor: item.valor,
      origem: 'barbearia_cobranca',
      status: 'pago',
      meioPagamento: meio,
      dataOperacao: item.pagoEm,
      pagoEm: item.pagoEm,
      automatico: true,
      lojaId: item.lojaId || '',
      chaveIdempotencia: `barbearia_cobranca:${empresaId}:${item.id}`,
      referencia: { cobrancaId: item.id, tipo: item.tipo, referencia: item.referencia },
    });
  } catch (erro) {
    item.receitaFinanceiraPendente = true;
    item.receitaFinanceiraErro = texto(erro?.message || erro, 200);
    item.revisar = item.revisar || 'receita_financeira_pendente';
    save();
    console.error('[Cobrança] lançamento financeiro:', erro?.message || erro);
    return null;
  }
}

function aplicarEfeitos(empresaId, item) {
  if (item.tipo === 'vale') {
    // Cancelado pela equipe: a equipe decide. Só vencido (pagou no dia seguinte): o vale vale.
    if (item.pagoAposCancelar) { item.revisar = item.revisar || 'cobranca_cancelada'; return; }
    const vale = estado(empresaId).vales?.[item.referencia.replace(/^vale:/, '')];
    if (vale?.canceladoPor) { item.revisar = 'cobranca_cancelada'; return; }
    if (vale && vale.status === 'cancelado' && item.pagoAposExpirar) vale.status = 'aguardando_pagamento';
    ativarVale(empresaId, item.referencia.replace(/^vale:/, ''), { cobrancaId: item.id });
    if (item.pagoAposExpirar) item.revisar = undefined;
    return;
  }
  if (item.tipo === 'sinal') {
    const agendamentoId = item.referencia.replace(/^sinal:/, '');
    const agendamento = barbearia.listarAgendamentos(empresaId, {}).find((ag) => ag.id === agendamentoId);
    if (agendamento?.status === 'agendado' && !item.pagoAposExpirar && !item.pagoAposCancelar) {
      barbearia.alterarStatusAgendamento(empresaId, agendamentoId, 'confirmado', { observacoes: texto(`${agendamento.observacoes || ''} · Sinal de R$ ${item.valor.toFixed(2).replace('.', ',')} pago`, 600) });
    } else if (!agendamento || !['agendado', 'confirmado', 'em_atendimento', 'concluido'].includes(agendamento.status)) {
      // Horário já liberado: o dinheiro entrou e a equipe precisa remarcar ou devolver.
      item.revisar = item.revisar || 'horario_liberado';
    }
  } else if (item.tipo === 'assinatura') {
    if (item.pagoAposCancelar) { item.revisar = 'cobranca_cancelada'; return; }
    const assinaturaId = item.referencia.split(':ate:')[0];
    const resultado = captacao.registrarPagamentoAssinatura(empresaId, assinaturaId, { valor: item.valor, meio: item.provedor === 'infinitepay' ? 'infinitepay' : 'pix', referencia: item.referencia, usuario: item.confirmadoPor || 'cobranca_automatica' });
    reativarSeBloqueadaPorAtraso(empresaId, assinaturaId);
    // O período já tinha sido pago no balcão: o cliente pagou duas vezes.
    if (resultado?.repetido) { item.duplicada = true; item.revisar = 'pagamento_em_dobro'; }
  }
}

/**
 * Marca como paga e aplica o efeito (confirma o horário ou quita o ciclo).
 * Chamado só depois de uma verificação: webhook conferido na InfinitePay,
 * retorno conferido ou confirmação manual da equipe (Pix da chave).
 */
export function confirmarCobranca(empresaId, cobrancaId, { origem = 'manual', usuario = '', transacao = '', lojaId = '' } = {}, opcoes = {}) {
  const atual = estado(empresaId);
  const item = atual.cobrancas[String(cobrancaId)];
  if (!item || (lojaId && item.lojaId !== String(lojaId))) throw new CobrancaError('Cobrança não encontrada.', 'COBRANCA_NAO_ENCONTRADA', 404);
  if (item.status === 'paga') return { ...visaoCobranca(item), repetida: true };
  if (origem === 'manual' && item.provedor !== 'pix_manual') throw new CobrancaError('Pagamento pela InfinitePay é confirmado automaticamente.', 'CONFIRMACAO_AUTOMATICA', 409);
  // Dinheiro que entrou é sempre registrado, mesmo em cobrança vencida ou
  // cancelada: o efeito (confirmar horário, quitar ciclo) é que pode não valer
  // mais, e a cobrança fica marcada para a equipe resolver.
  item.pagoAposExpirar = item.status === 'expirada' ? true : undefined;
  item.pagoAposCancelar = item.status === 'cancelada' ? true : undefined;
  item.status = 'paga';
  item.pagoEm = iso(agoraMs(opcoes));
  item.confirmadoPor = origem === 'manual' ? (texto(usuario, 120) || 'equipe') : origem;
  item.transacao = texto(transacao, 120) || null;
  if (item.pagoAposExpirar || item.pagoAposCancelar) item.revisar = item.pagoAposCancelar ? 'cobranca_cancelada' : 'horario_liberado';
  save();
  try {
    aplicarEfeitos(empresaId, item);
  } catch (erro) {
    item.efeitoErro = texto(erro?.message || erro, 200);
    item.revisar = item.revisar || 'efeito_nao_aplicado';
    console.error('[Cobrança] efeito do pagamento:', item.efeitoErro);
  }
  save();
  registrarReceita(empresaId, item, item.provedor === 'infinitepay' ? 'infinitepay' : 'pix');
  return visaoCobranca(item);
}

export function cancelarCobranca(empresaId, cobrancaId, { usuario = '', lojaId = '' } = {}) {
  const item = estado(empresaId).cobrancas[String(cobrancaId)];
  if (!item || (lojaId && item.lojaId !== String(lojaId))) throw new CobrancaError('Cobrança não encontrada.', 'COBRANCA_NAO_ENCONTRADA', 404);
  if (item.status === 'paga') throw new CobrancaError('Cobrança paga não pode ser cancelada aqui; faça o estorno pelo meio de pagamento.', 'COBRANCA_PAGA', 409);
  item.status = 'cancelada';
  item.canceladoPor = texto(usuario, 120) || 'equipe';
  item.canceladoEm = new Date().toISOString();
  save();
  return visaoCobranca(item);
}

/** Horário cancelado: o sinal pendente deixa de valer (pago depois, vira "revisar"). */
export function cancelarSinalPendente(empresaId, agendamentoId, lojaId = '') {
  const atual = estado(empresaId);
  let mudou = false;
  for (const item of Object.values(atual.cobrancas)) {
    if (item.tipo === 'sinal' && item.status === 'pendente' && item.referencia === `sinal:${agendamentoId}` && (!lojaId || item.lojaId === String(lojaId))) {
      item.status = 'cancelada'; item.canceladoPor = 'horario_cancelado'; item.canceladoEm = new Date().toISOString(); mudou = true;
    }
  }
  if (mudou) save();
  return mudou;
}

/** Período pago no balcão: cancela a cobrança pendente do clube que cobria esse período. */
export function cancelarCobrancasClubeQuitadas(empresaId, assinaturaId) {
  const resumo = captacao.resumoAssinatura(empresaId, assinaturaId);
  const pagoAte = resumo?.pagoAte ? new Date(resumo.pagoAte).valueOf() : null;
  if (!pagoAte) return 0;
  const atual = estado(empresaId);
  let canceladas = 0;
  for (const item of Object.values(atual.cobrancas)) {
    if (item.tipo !== 'assinatura' || item.status !== 'pendente' || !item.referencia.startsWith(`${assinaturaId}:ate:`)) continue;
    const inicioPeriodo = new Date(`${item.referencia.split(':ate:')[1]}T00:00:00Z`).valueOf();
    if (Number.isFinite(inicioPeriodo) && inicioPeriodo < pagoAte - DIA_MS) {
      item.status = 'cancelada'; item.canceladoPor = 'pago_no_balcao'; item.canceladoEm = new Date().toISOString(); canceladas += 1;
    }
  }
  if (canceladas) save();
  return canceladas;
}

/**
 * Confirmação pela InfinitePay (webhook ou retorno do checkout). O corpo recebido
 * só serve para localizar a cobrança: o pagamento é conferido na própria
 * InfinitePay (payment_check), com número do pedido, valor e método.
 */
export async function confirmarPelaInfinitePay(payload = {}, opcoes = {}) {
  const orderNsu = texto(payload.order_nsu || payload.orderNsu, 40);
  const invoiceSlug = texto(payload.invoice_slug || payload.invoiceSlug, 180);
  const indice = db().barbeariaCobrancaIndice?.[orderNsu];
  if (!indice) throw new CobrancaError('Cobrança não encontrada.', 'COBRANCA_NAO_ENCONTRADA', 404);
  const item = estado(indice.empresaId).cobrancas[indice.id];
  if (!item || item.provedor !== 'infinitepay') throw new CobrancaError('Cobrança não encontrada.', 'COBRANCA_NAO_ENCONTRADA', 404);
  if (!invoiceSlug) throw new CobrancaError('O invoice_slug do pagamento é obrigatório.', 'PAGAMENTO_INVOICE_SLUG_AUSENTE', 400);
  if (!item.invoiceSlug || item.invoiceSlug !== invoiceSlug) throw new CobrancaError('O invoice_slug do pagamento não corresponde à cobrança.', 'PAGAMENTO_INVOICE_SLUG_DIVERGENTE', 400);
  if (item.status === 'paga') return { ...visaoCobranca(item), repetida: true, empresaId: indice.empresaId };
  const adapter = opcoes.adapter || createInfinitePayAdapter();
  const verificado = await adapter.verifyWebhook({
    payload,
    context: { expectedOrderNsu: orderNsu, expectedAmount: item.valor, account: contaInfinitePay(indice.empresaId) },
  });
  if (verificado?.status !== 'captured') return { ...visaoCobranca(item), pendente: true, empresaId: indice.empresaId };
  const valorVerificado = Number(verificado.amount);
  const metodoVerificado = String(verificado.summary?.captureMethod || verificado.captureMethod || '').trim().toLowerCase();
  if (!Number.isFinite(valorVerificado) || Math.abs(valorVerificado - item.valor) > 0.01) throw new CobrancaError('A InfinitePay confirmou valor divergente da cobrança.', 'PAGAMENTO_VALOR_DIVERGENTE', 400);
  if (!['pix', 'credit_card'].includes(metodoVerificado)) throw new CobrancaError('A InfinitePay confirmou método de pagamento inválido.', 'PAGAMENTO_METODO_DIVERGENTE', 400);
  return { ...confirmarCobranca(indice.empresaId, item.id, { origem: 'infinitepay', transacao: verificado.providerPaymentId }, opcoes), empresaId: indice.empresaId };
}

// ── Sinal do agendamento ───────────────────────────────────────────────────

export function valorDoSinal(empresaId, valorServico) {
  const { sinal } = estado(empresaId).configuracao;
  if (!sinal.ativo || !provedorCobranca(empresaId)) return 0;
  const bruto = sinal.tipo === 'fixo' ? numero(sinal.valor) : numero(valorServico) * numero(sinal.valor) / 100;
  const valor = dinheiro(Math.min(bruto, numero(valorServico) || bruto));
  return valor >= 1 ? valor : 0;
}

export function sinalExigido(empresaId) {
  return Boolean(estado(empresaId).configuracao.sinal.ativo && provedorCobranca(empresaId));
}

export async function criarSinalDoAgendamento(empresaId, agendamento, opcoes = {}) {
  const valor = valorDoSinal(empresaId, agendamento?.valor);
  if (!valor) return null;
  const prazo = estado(empresaId).configuracao.sinal.prazoMinutos;
  return criarCobranca(empresaId, {
    tipo: 'sinal',
    referencia: `sinal:${agendamento.id}`,
    valor,
    descricao: 'Sinal do agendamento',
    clienteId: agendamento.clienteId,
    clienteNome: agendamento.clienteNome,
    telefone: agendamento.clienteTelefone,
    lojaId: agendamento.lojaId,
    expiraEm: iso(agoraMs(opcoes) + prazo * 60000),
  }, opcoes);
}

export function sinalDoAgendamento(empresaId, agendamentoId, lojaId = '') {
  const item = Object.values(estado(empresaId).cobrancas)
    .filter((cob) => cob.tipo === 'sinal' && cob.referencia === `sinal:${agendamentoId}` && (!lojaId || cob.lojaId === String(lojaId)))
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))[0];
  return visaoCobranca(item);
}

/**
 * Sinal não pago no prazo: a cobrança expira e o horário é liberado (o
 * agendamento é cancelado). Devolve os agendamentos liberados para avisar a
 * lista de espera.
 */
export function expirarSinais(opcoes = {}) {
  const ms = agoraMs(opcoes);
  const liberados = [];
  for (const [empresaId] of Object.entries(db().barbeariaCobranca || {})) {
    const atual = estado(empresaId);
    let mudou = false;
    for (const item of Object.values(atual.cobrancas)) {
      if (!['sinal', 'vale'].includes(item.tipo) || item.status !== 'pendente' || !item.expiraEm) continue;
      // 5 minutos de tolerância: quem está pagando no limite do prazo não perde o horário.
      if (new Date(item.expiraEm).valueOf() + 5 * 60000 > ms) continue;
      item.status = 'expirada';
      item.expirouEm = iso(ms);
      mudou = true;
      if (item.tipo === 'vale') {
        const vale = atual.vales?.[item.referencia.replace(/^vale:/, '')];
        if (vale && vale.status === 'aguardando_pagamento') vale.status = 'cancelado';
        continue;
      }
      const agendamentoId = item.referencia.replace(/^sinal:/, '');
      const agendamento = barbearia.listarAgendamentos(empresaId, {}).find((ag) => ag.id === agendamentoId);
      if (agendamento?.status === 'agendado') {
        try {
          const cancelado = barbearia.alterarStatusAgendamento(empresaId, agendamentoId, 'cancelado', { observacoes: texto(`${agendamento.observacoes || ''} · Cancelado: sinal não pago no prazo`, 600) });
          if (cancelado) liberados.push({ empresaId, agendamento: cancelado });
        } catch (_) { /* já mudou de status */ }
      }
    }
    // Minimização: vale online que nunca foi pago some com nome e telefone após 30 dias.
    for (const vale of Object.values(atual.vales || {})) {
      if (vale.origem === 'online' && vale.status === 'cancelado' && !vale.ativadoEm && !vale.anonimizado && ms - new Date(vale.criadoEm).valueOf() > 30 * DIA_MS) {
        vale.deNome = ''; vale.deTelefone = ''; vale.paraNome = ''; vale.mensagem = ''; vale.anonimizado = true; mudou = true;
      }
    }
    if (mudou) save();
  }
  return liberados;
}

// ── Cobrança recorrente do clube ───────────────────────────────────────────

/**
 * Assinaturas ativas cujo período pago termina em até N dias (ou já terminou)
 * ganham a cobrança do próximo ciclo. A referência é a mesma do pagamento
 * manual (assinatura:ate:data), então pagar no balcão e pelo link nunca soma.
 */
export async function gerarCobrancasDoClube(empresaId, opcoes = {}) {
  const atual = estado(empresaId);
  if (!atual.configuracao.cobrancaClube.ativa || !provedorCobranca(empresaId)) return [];
  const ms = agoraMs(opcoes);
  const limite = ms + atual.configuracao.cobrancaClube.diasAntes * DIA_MS;
  const criadas = [];
  for (const assinatura of barbearia.listarAssinaturas(empresaId).filter((item) => item.status === 'ativa')) {
    if (opcoes.lojaId && assinatura.lojaId && String(assinatura.lojaId) !== String(opcoes.lojaId)) continue;
    const resumo = captacao.resumoAssinatura(empresaId, assinatura.id, opcoes);
    if (!resumo?.plano || numero(resumo.plano.preco) < 1) continue;
    const pagoAte = resumo.pagoAte ? new Date(resumo.pagoAte).valueOf() : null;
    const base = pagoAte ?? new Date(assinatura.inicio).valueOf();
    if (!Number.isFinite(base) || base > limite) continue;
    const referencia = `${assinatura.id}:ate:${iso(base).slice(0, 10)}`;
    const cliente = assinatura.clienteId ? clientesKytto.obterCliente(String(empresaId), String(assinatura.clienteId)) : null;
    try {
      const cobranca = await criarCobranca(empresaId, {
        tipo: 'assinatura',
        referencia,
        valor: resumo.plano.preco,
        descricao: `Mensalidade ${texto(resumo.plano.nome, 60)}`,
        clienteId: assinatura.clienteId,
        clienteNome: assinatura.clienteNome || cliente?.nome || '',
        telefone: cliente?.telefone || '',
        lojaId: opcoes.lojaId || assinatura.lojaId || '',
      }, opcoes);
      criadas.push(cobranca);
    } catch (erro) {
      console.error('[Cobrança] clube:', erro?.message || erro);
    }
  }
  return criadas;
}

// ── Régua do clube: tentativas, bloqueio e reativação ──────────────────────

function bloqueiosClube(empresaId) {
  const atual = estado(empresaId);
  atual.bloqueiosClube ||= {};
  return atual.bloqueiosClube;
}

/** Plano pausado pela régua volta a ficar ativo quando o atraso é pago. */
export function reativarSeBloqueadaPorAtraso(empresaId, assinaturaId, opcoes = {}) {
  const bloqueios = bloqueiosClube(empresaId);
  const bloqueio = bloqueios[String(assinaturaId)];
  if (!bloqueio || bloqueio.reativadoEm) return null;
  const assinatura = barbearia.listarAssinaturas(empresaId).find((item) => item.id === String(assinaturaId));
  if (!assinatura || assinatura.status !== 'pausada') return null;
  const resumo = captacao.resumoAssinatura(empresaId, assinaturaId, opcoes);
  const pagoAte = resumo?.pagoAte ? new Date(resumo.pagoAte).valueOf() : 0;
  if (pagoAte <= agoraMs(opcoes)) return null; // ainda há período em aberto
  const reativada = barbearia.alterarStatusAssinatura(empresaId, assinaturaId, 'ativa', { confirmadoSemCobranca: true, pagamentoConfirmado: true });
  bloqueio.reativadoEm = iso(agoraMs(opcoes));
  save();
  return reativada;
}

/**
 * Roda de hora em hora. Para cada mensalidade pendente do clube:
 *  - tentativa 2 no vencimento, 3 depois de intervaloDias (até o limite);
 *  - passados bloquearAposDias do vencimento sem pagamento, pausa o plano
 *    (o uso já é recusado para inadimplente; a pausa deixa isso explícito).
 * Devolve o que deve ser reenviado e o que foi bloqueado. Não cobra nada:
 * só reenvia o mesmo link/Pix da cobrança.
 */
export function processarReguaClube(empresaId, opcoes = {}) {
  const atual = estado(empresaId);
  const regra = atual.configuracao.cobrancaClube;
  const ms = agoraMs(opcoes);
  const reenviar = [];
  const bloqueadas = [];
  if (!regra.ativa) return { reenviar, bloqueadas };
  const bloqueios = bloqueiosClube(empresaId);
  let mudou = false;
  for (const item of Object.values(atual.cobrancas)) {
    if (item.tipo !== 'assinatura' || item.status !== 'pendente') continue;
    const [assinaturaId, vencimentoTxt] = item.referencia.split(':ate:');
    const vencimento = Date.parse(`${vencimentoTxt}T12:00:00Z`);
    if (!Number.isFinite(vencimento)) continue;
    item.tentativas = Math.max(1, Number(item.tentativas || 1));
    item.tentativasEm ||= [item.criadoEm];
    if (item.tentativas < regra.tentativas) {
      const proxima = vencimento + (item.tentativas - 1) * regra.intervaloDias * DIA_MS;
      if (ms >= proxima) {
        item.tentativas += 1;
        item.tentativasEm.push(iso(ms));
        reenviar.push({ cobranca: visaoCobranca(item), tentativa: item.tentativas });
        mudou = true;
      }
    }
    if (regra.bloquearAutomatico && ms >= vencimento + regra.bloquearAposDias * DIA_MS && !bloqueios[assinaturaId]?.cobrancaId?.includes(item.id)) {
      const assinatura = barbearia.listarAssinaturas(empresaId).find((a) => a.id === assinaturaId);
      if (assinatura?.status === 'ativa') {
        try {
          barbearia.alterarStatusAssinatura(empresaId, assinaturaId, 'pausada', {});
          bloqueios[assinaturaId] = { em: iso(ms), cobrancaId: item.id, motivo: 'inadimplencia', tentativas: item.tentativas };
          bloqueadas.push({ assinaturaId, clienteNome: assinatura.clienteNome || item.clienteNome || '', cobrancaId: item.id });
          mudou = true;
        } catch (erro) { console.error('[Cobrança] bloqueio do clube:', erro?.message || erro); }
      }
    }
  }
  if (mudou) save();
  return { reenviar, bloqueadas };
}

export function painelReguaClube(empresaId) {
  const atual = estado(empresaId);
  const pendentes = Object.values(atual.cobrancas).filter((item) => item.tipo === 'assinatura' && item.status === 'pendente');
  const bloqueios = Object.entries(bloqueiosClube(empresaId)).map(([assinaturaId, b]) => ({ assinaturaId, ...b }));
  return {
    regra: { ...atual.configuracao.cobrancaClube },
    pendentes: pendentes.map((item) => ({ ...visaoCobranca(item), tentativas: Number(item.tentativas || 1), vencimento: item.referencia.split(':ate:')[1] || null })),
    bloqueadas: bloqueios.filter((b) => !b.reativadoEm),
    reativadas: bloqueios.filter((b) => b.reativadoEm),
  };
}

// ── Cashback ───────────────────────────────────────────────────────────────

function chaveCarteira(telefone) {
  return telefoneChave(telefone);
}

function carteira(empresaId, telefone) {
  const chave = chaveCarteira(telefone);
  if (!chave) return null;
  const atual = estado(empresaId);
  atual.carteiras[chave] ||= { movimentos: [] };
  return atual.carteiras[chave];
}

/** Saldo por ordem de chegada: o uso consome primeiro o crédito mais antigo; crédito vencido some. */
function calcularSaldo(movimentos, ms) {
  const creditos = movimentos.filter((m) => m.tipo === 'credito').map((m) => ({ ...m, resta: m.valor })).sort((a, b) => String(a.em).localeCompare(String(b.em)));
  const debitos = movimentos.filter((m) => m.tipo === 'debito').sort((a, b) => String(a.em).localeCompare(String(b.em)));
  for (const debito of debitos) {
    let falta = debito.valor;
    for (const credito of creditos) {
      if (falta <= 0) break;
      // Só créditos que valiam no momento do uso.
      if (credito.em > debito.em || (credito.expiraEm && credito.expiraEm < debito.em)) continue;
      const usa = Math.min(credito.resta, falta);
      credito.resta = dinheiro(credito.resta - usa);
      falta = dinheiro(falta - usa);
    }
  }
  const agora = iso(ms);
  const validos = creditos.filter((c) => c.resta > 0 && (!c.expiraEm || c.expiraEm >= agora));
  const proximo = validos.map((c) => c.expiraEm).filter(Boolean).sort()[0] || null;
  return { saldo: dinheiro(validos.reduce((soma, c) => soma + c.resta, 0)), proximoVencimento: proximo };
}

export function saldoCashback(empresaId, telefone, opcoes = {}) {
  const chave = chaveCarteira(telefone);
  const registro = chave ? estado(empresaId).carteiras[chave] : null;
  const { percentual, validadeDias } = estado(empresaId).configuracao.cashback;
  const movimentos = opcoes.lojaId ? (registro?.movimentos || []).filter((item) => item.lojaId === String(opcoes.lojaId)) : (registro?.movimentos || []);
  const { saldo, proximoVencimento } = calcularSaldo(movimentos, agoraMs(opcoes));
  return { saldo, proximoVencimento, percentual, validadeDias, ativo: percentual > 0 };
}

/** Crédito do atendimento concluído e pago (idempotente por agendamento). */
export function creditarCashback(empresaId, agendamento, opcoes = {}) {
  const { percentual, validadeDias } = estado(empresaId).configuracao.cashback;
  if (!(percentual > 0) || agendamento?.status !== 'concluido') return null;
  // Base: o que foi recebido, nunca acima do preço do serviço (valor digitado errado não vira crédito).
  const informado = opcoes.base !== undefined ? numero(opcoes.base) : numero(agendamento.valorRecebido);
  const base = dinheiro(Math.min(informado, numero(agendamento.valor) || informado));
  const valor = dinheiro(base * percentual / 100);
  if (valor < 0.01) return null;
  const conta = carteira(empresaId, agendamento.clienteTelefone);
  if (!conta) return null;
  const referencia = `credito:${agendamento.id}`;
  if (conta.movimentos.some((m) => m.referencia === referencia)) return saldoCashback(empresaId, agendamento.clienteTelefone, opcoes);
  const ms = agoraMs(opcoes);
  conta.movimentos.push({ tipo: 'credito', valor, referencia, lojaId: texto(opcoes.lojaId, 120), em: iso(ms), expiraEm: iso(ms + validadeDias * DIA_MS) });
  save();
  return { creditado: valor, ...saldoCashback(empresaId, agendamento.clienteTelefone, opcoes) };
}

/** Uso do saldo num atendimento (idempotente por referência); nunca deixa negativo. */
export function usarCashback(empresaId, { telefone, valor, referencia, usuario = '' } = {}, opcoes = {}) {
  const conta = carteira(empresaId, telefone);
  if (!conta) throw new CobrancaError('Informe o telefone do cliente.', 'TELEFONE_INVALIDO');
  const ref = texto(referencia, 160);
  if (!ref) throw new CobrancaError('Referência obrigatória.');
  const repetido = conta.movimentos.find((m) => m.referencia === `debito:${ref}`);
  if (repetido) return { usado: repetido.valor, repetido: true, ...saldoCashback(empresaId, telefone, opcoes) };
  const movimentos = opcoes.lojaId ? conta.movimentos.filter((item) => item.lojaId === String(opcoes.lojaId)) : conta.movimentos;
  const { saldo } = calcularSaldo(movimentos, agoraMs(opcoes));
  const pedido = dinheiro(valor);
  if (pedido <= 0) throw new CobrancaError('Informe o valor a usar.', 'VALOR_INVALIDO');
  if (pedido > saldo) throw new CobrancaError(`Saldo de cashback insuficiente (R$ ${saldo.toFixed(2).replace('.', ',')}).`, 'SALDO_INSUFICIENTE', 409);
  conta.movimentos.push({ tipo: 'debito', valor: pedido, referencia: `debito:${ref}`, lojaId: texto(opcoes.lojaId, 120), em: iso(agoraMs(opcoes)), usuario: texto(usuario, 120) || null });
  save();
  return { usado: pedido, ...saldoCashback(empresaId, telefone, opcoes) };
}

// ── Painel ─────────────────────────────────────────────────────────────────

export function painelCobrancas(empresaId, opcoes = {}) {
  const lista = Object.values(estado(empresaId).cobrancas).filter((item) => !opcoes.lojaId || item.lojaId === String(opcoes.lojaId));
  const soma = (filtro) => dinheiro(lista.filter(filtro).reduce((total, item) => total + item.valor, 0));
  const desde = agoraMs(opcoes) - 30 * DIA_MS;
  const recentes = (item) => new Date(item.criadoEm).valueOf() >= desde;
  const carteiras = Object.values(estado(empresaId).carteiras);
  return {
    configuracao: obterConfiguracaoCobranca(empresaId),
    ultimos30Dias: {
      sinaisPagos: soma((i) => recentes(i) && i.tipo === 'sinal' && i.status === 'paga'),
      sinaisExpirados: lista.filter((i) => recentes(i) && i.tipo === 'sinal' && i.status === 'expirada').length,
      clubeRecebido: soma((i) => recentes(i) && i.tipo === 'assinatura' && i.status === 'paga'),
      clubePendente: soma((i) => i.tipo === 'assinatura' && i.status === 'pendente'),
    },
    cashbackEmAberto: dinheiro(carteiras.reduce((total, conta) => {
      const movimentos = opcoes.lojaId ? conta.movimentos.filter((item) => item.lojaId === String(opcoes.lojaId)) : conta.movimentos;
      return total + calcularSaldo(movimentos, agoraMs(opcoes)).saldo;
    }, 0)),
    cobrancas: listarCobrancas(empresaId, { lojaId: opcoes.lojaId, limite: 100 }),
  };
}


// ── Vale-presente ──────────────────────────────────────────────────────────
// Compra online (cobrança tipo 'vale') ou venda no balcão. O código só passa a
// valer depois do pagamento confirmado. Uso no atendimento com desconto
// calculado no servidor (como o cashback), idempotente por atendimento.

const ALFABETO_VALE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function codigoVale() {
  const bytes = crypto.randomBytes(10);
  let codigo = '';
  for (let i = 0; i < 10; i += 1) codigo += ALFABETO_VALE[bytes[i] % ALFABETO_VALE.length];
  return `${codigo.slice(0, 5)}-${codigo.slice(5)}`;
}

function normalizarCodigoVale(valor) {
  const limpo = texto(valor, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return limpo.length === 10 ? `${limpo.slice(0, 5)}-${limpo.slice(5)}` : '';
}

function vales(empresaId) {
  const atual = estado(empresaId);
  atual.vales ||= {};
  return atual.vales;
}

function saldoVale(vale) {
  const usado = (vale.usos || []).reduce((soma, uso) => soma + uso.valor, 0);
  return dinheiro(vale.valor - usado);
}

function visaoVale(vale, { comCodigo = false } = {}) {
  if (!vale) return null;
  const vencido = vale.validoAte && new Date(vale.validoAte).valueOf() < Date.now();
  return {
    id: vale.id,
    ...(comCodigo ? { codigo: vale.codigo } : { codigoFinal: vale.codigo.slice(-4) }),
    valor: vale.valor,
    saldo: saldoVale(vale),
    status: vale.status === 'ativo' && vencido ? 'vencido' : vale.status,
    paraNome: vale.paraNome || '',
    deNome: vale.deNome || '',
    validoAte: vale.validoAte || null,
    criadoEm: vale.criadoEm,
    origem: vale.origem,
    lojaId: vale.lojaId || '',
  };
}

const VALE_MIN = 20;
const VALE_MAX = 2000;

function novoVale(empresaId, { valor, deNome, deTelefone, paraNome, mensagem, origem, lojaId = '' }) {
  const v = dinheiro(valor);
  if (v < VALE_MIN || v > VALE_MAX) throw new CobrancaError(`O vale-presente vai de R$ ${VALE_MIN} a R$ ${VALE_MAX}.`, 'VALE_VALOR_INVALIDO');
  const lista = vales(empresaId);
  const usados = new Set(Object.values(lista).map((item) => item.codigo));
  let codigo = codigoVale();
  while (usados.has(codigo)) codigo = codigoVale();
  const vale = {
    id: `vale-${crypto.randomBytes(6).toString('hex')}`,
    codigo,
    valor: v,
    status: 'aguardando_pagamento',
    deNome: texto(deNome, 80),
    deTelefone: texto(deTelefone, 30),
    paraNome: texto(paraNome, 80),
    mensagem: texto(mensagem, 200),
    origem,
    lojaId: texto(lojaId, 120),
    usos: [],
    criadoEm: new Date().toISOString(),
  };
  lista[vale.id] = vale;
  return vale;
}

/** Compra online: cria o vale (inativo) e a cobrança. O código é mostrado ao comprador, mas só vale depois de pago. */
export async function comprarVale(empresaId, dados = {}, opcoes = {}) {
  if (!provedorCobranca(empresaId)) throw new CobrancaError('A barbearia ainda não recebe pagamentos online.', 'PROVEDOR_AUSENTE', 409);
  if (!estado(empresaId).configuracao.vale?.ativo) throw new CobrancaError('Vale-presente indisponível nesta barbearia.', 'VALE_DESLIGADO', 409);
  if (texto(dados.deNome, 80).length < 2 || String(dados.deTelefone || '').replace(/\D/g, '').length < 10) throw new CobrancaError('Informe seu nome e telefone.', 'DADOS_INVALIDOS');
  const chave = telefoneChave(dados.deTelefone);
  const pendentes = Object.values(vales(empresaId)).filter((item) => item.origem === 'online' && item.status === 'aguardando_pagamento' && telefoneChave(item.deTelefone) === chave).length;
  if (pendentes >= 3) throw new CobrancaError('Você já tem vales aguardando pagamento. Pague ou aguarde expirarem para gerar outro.', 'VALE_LIMITE_PENDENTE', 429);
  const vale = novoVale(empresaId, { ...dados, origem: 'online' });
  save();
  try {
    const cobranca = await criarCobranca(empresaId, {
      tipo: 'vale', referencia: `vale:${vale.id}`, valor: vale.valor,
      descricao: `Vale-presente${vale.paraNome ? ` para ${vale.paraNome}` : ''}`,
      clienteNome: vale.deNome, telefone: vale.deTelefone,
      lojaId: vale.lojaId,
      expiraEm: iso(agoraMs(opcoes) + 24 * 60 * 60 * 1000),
    }, opcoes);
    return { vale: visaoVale(vale, { comCodigo: true }), pagamento: { valor: cobranca.valor, url: cobranca.url, pixCopiaECola: cobranca.pixCopiaECola, provedor: cobranca.provedor } };
  } catch (erro) {
    vale.status = 'cancelado';
    save();
    throw erro;
  }
}

/** Venda no balcão: a gestão confirma o recebimento; o vale já nasce ativo e a receita é lançada. */
export function venderValeNoBalcao(empresaId, dados = {}, { usuario = '', lojaId = '' } = {}) {
  const meio = texto(dados.meioPagamento, 40).toLowerCase();
  if (!meio) throw new CobrancaError('Informe o meio de pagamento.', 'DADOS_INVALIDOS');
  const vale = novoVale(empresaId, { ...dados, lojaId: lojaId || dados.lojaId, origem: 'balcao' });
  const pagoEm = new Date().toISOString();
  try {
    // Receita primeiro: sem lançamento, o vale não é emitido.
    financeiroKytto.registrarLancamento(empresaId, {
      tipo: 'receita', categoria: 'Vale-presente', descricao: `Vale-presente ${vale.codigo.slice(-4)}${vale.paraNome ? ` · ${vale.paraNome}` : ''}`,
      valor: vale.valor, origem: 'barbearia_cobranca', status: 'pago', meioPagamento: meio,
      dataOperacao: pagoEm, pagoEm, automatico: true, usuario,
      chaveIdempotencia: `barbearia_vale:${empresaId}:${vale.id}`,
      referencia: { valeId: vale.id },
    });
  } catch (erro) {
    delete vales(empresaId)[vale.id];
    save();
    throw new CobrancaError(`Não foi possível lançar a receita do vale: ${texto(erro?.message || erro, 120)}`, 'FINANCEIRO_INDISPONIVEL', 500);
  }
  ativarVale(empresaId, vale.id, { usuario });
  return visaoVale(vales(empresaId)[vale.id], { comCodigo: true });
}

function ativarVale(empresaId, valeId, { cobrancaId = null, usuario = '' } = {}) {
  const vale = vales(empresaId)[String(valeId)];
  if (!vale || vale.status === 'ativo') return vale || null;
  // Cancelado pela equipe ou já usado nunca volta a valer sozinho.
  if (vale.canceladoPor || vale.status === 'usado') return null;
  vale.status = 'ativo';
  vale.ativadoEm = new Date().toISOString();
  vale.validoAte = new Date(Date.now() + 365 * DIA_MS).toISOString();
  vale.cobrancaId = cobrancaId;
  vale.ativadoPor = texto(usuario, 120) || (cobrancaId ? 'pagamento' : 'equipe');
  save();
  return vale;
}

export function consultarVale(empresaId, codigo, lojaId = '') {
  const normalizado = normalizarCodigoVale(codigo);
  const vale = normalizado ? Object.values(vales(empresaId)).find((item) => item.codigo === normalizado && (!lojaId || item.lojaId === String(lojaId))) : null;
  if (!vale) throw new CobrancaError('Vale-presente não encontrado.', 'VALE_NAO_ENCONTRADO', 404);
  return visaoVale(vale);
}

export function listarVales(empresaId, lojaId = '') {
  return Object.values(vales(empresaId)).filter((vale) => !lojaId || vale.lojaId === String(lojaId)).sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm))).slice(0, 300).map((vale) => visaoVale(vale));
}

export function cancelarVale(empresaId, valeId, { usuario = '', motivo = '', meioEstorno = '', lojaId = '' } = {}) {
  const vale = vales(empresaId)[String(valeId)];
  if (!vale || (lojaId && vale.lojaId !== String(lojaId))) throw new CobrancaError('Vale-presente não encontrado.', 'VALE_NAO_ENCONTRADO', 404);
  if ((vale.usos || []).length) throw new CobrancaError('Vale já usado não pode ser cancelado.', 'VALE_USADO', 409);
  if (vale.status === 'cancelado') return visaoVale(vale);
  const pago = vale.status === 'ativo';
  if (pago && (texto(motivo, 200).length < 5 || !texto(meioEstorno, 40))) {
    throw new CobrancaError('Vale pago: informe o motivo e como o valor foi devolvido; o estorno é lançado no financeiro.', 'ESTORNO_OBRIGATORIO', 409);
  }
  // Cobrança online pendente deixa de valer junto.
  for (const item of Object.values(estado(empresaId).cobrancas)) {
    if (item.tipo === 'vale' && item.referencia === `vale:${vale.id}` && item.status === 'pendente') {
      item.status = 'cancelada'; item.canceladoPor = texto(usuario, 120) || 'equipe'; item.canceladoEm = new Date().toISOString();
    }
  }
  if (pago) {
    const agora = new Date().toISOString();
    financeiroKytto.registrarLancamento(empresaId, {
      tipo: 'despesa', categoria: 'Estorno de vale-presente', descricao: `Estorno do vale ${vale.codigo.slice(-4)} · ${texto(motivo, 120)}`,
      valor: vale.valor, origem: 'barbearia_cobranca', status: 'pago', meioPagamento: texto(meioEstorno, 40).toLowerCase(),
      dataOperacao: agora, pagoEm: agora, automatico: true, usuario: texto(usuario, 120),
      chaveIdempotencia: `barbearia_vale_estorno:${empresaId}:${vale.id}`,
      referencia: { valeId: vale.id },
    });
  }
  vale.status = 'cancelado';
  vale.canceladoPor = texto(usuario, 120) || 'equipe';
  vale.canceladoEm = new Date().toISOString();
  vale.motivoCancelamento = texto(motivo, 200) || null;
  save();
  return visaoVale(vale);
}

/** Valor que o vale pode cobrir agora (sem debitar): saldo, ativo e dentro da validade. */
export function saldoUtilVale(empresaId, codigo, lojaId = '') {
  const normalizado = normalizarCodigoVale(codigo);
  const vale = normalizado ? Object.values(vales(empresaId)).find((item) => item.codigo === normalizado && (!lojaId || item.lojaId === String(lojaId))) : null;
  if (!vale) throw new CobrancaError('Vale-presente não encontrado.', 'VALE_NAO_ENCONTRADO', 404);
  if (vale.status !== 'ativo') throw new CobrancaError(vale.status === 'aguardando_pagamento' ? 'Este vale ainda não foi pago.' : 'Este vale não está ativo.', 'VALE_INATIVO', 409);
  if (vale.validoAte && new Date(vale.validoAte).valueOf() < Date.now()) throw new CobrancaError('Este vale está vencido.', 'VALE_VENCIDO', 409);
  return { vale, saldo: saldoVale(vale) };
}

export function usarVale(empresaId, { codigo, valor, referencia, usuario = '', lojaId = '' } = {}) {
  const { vale, saldo } = saldoUtilVale(empresaId, codigo, lojaId);
  const ref = texto(referencia, 160);
  if (!ref) throw new CobrancaError('Referência obrigatória.');
  const repetido = (vale.usos || []).find((uso) => uso.referencia === ref);
  if (repetido) return { usado: repetido.valor, repetido: true, saldo: saldoVale(vale) };
  const pedido = dinheiro(valor);
  if (pedido <= 0) throw new CobrancaError('Informe o valor a usar.', 'VALE_VALOR_INVALIDO');
  if (pedido > saldo + 0.001) throw new CobrancaError(`Saldo do vale insuficiente (R$ ${saldo.toFixed(2).replace('.', ',')}).`, 'SALDO_INSUFICIENTE', 409);
  vale.usos.push({ valor: pedido, referencia: ref, em: new Date().toISOString(), usuario: texto(usuario, 120) || null });
  if (saldoVale(vale) <= 0) vale.status = 'usado';
  save();
  return { usado: pedido, saldo: saldoVale(vale) };
}

/** Uso já registrado com esta referência (repetição da mesma conclusão). */
export function usoDeValeExistente(empresaId, codigo, referencia) {
  const normalizado = normalizarCodigoVale(codigo);
  const vale = normalizado ? Object.values(vales(empresaId)).find((item) => item.codigo === normalizado) : null;
  return vale ? (vale.usos || []).find((uso) => uso.referencia === texto(referencia, 160)) || null : null;
}

/** Desfaz um uso (vale ou cashback) quando a conclusão do atendimento não foi gravada. */
export function desfazerUsos(empresaId, { codigoVale, telefone, referencia } = {}) {
  const ref = texto(referencia, 160);
  const normalizado = normalizarCodigoVale(codigoVale);
  const vale = normalizado ? Object.values(vales(empresaId)).find((item) => item.codigo === normalizado) : null;
  if (vale) {
    vale.usos = (vale.usos || []).filter((uso) => uso.referencia !== ref);
    if (vale.status === 'usado' && saldoVale(vale) > 0) vale.status = 'ativo';
  }
  const conta = telefone ? carteira(empresaId, telefone) : null;
  if (conta) conta.movimentos = conta.movimentos.filter((m) => m.referencia !== `debito:${ref}`);
  save();
}

export function usoDeCashbackExistente(empresaId, telefone, referencia) {
  const chave = chaveCarteira(telefone);
  const conta = chave ? estado(empresaId).carteiras[chave] : null;
  return conta ? conta.movimentos.find((m) => m.referencia === `debito:${texto(referencia, 160)}`) || null : null;
}

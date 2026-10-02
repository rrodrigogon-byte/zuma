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
    cobrancaClube: { ativa: false, diasAntes: 3 },
    pix: { chave: '', nomeRecebedor: '', cidade: '' },
    cashback: { percentual: 0, validadeDias: 90 },
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
  atual.configuracao = {
    sinal: {
      ativo: sinal.ativo === undefined ? c.sinal.ativo : sinal.ativo === true,
      tipo: ['percentual', 'fixo'].includes(sinal.tipo) ? sinal.tipo : c.sinal.tipo,
      valor: limitar(sinal.valor, c.sinal.valor, 0, sinal.tipo === 'fixo' || (!sinal.tipo && c.sinal.tipo === 'fixo') ? 1000 : 100),
      prazoMinutos: Math.round(limitar(sinal.prazoMinutos, c.sinal.prazoMinutos, 10, 1440)),
    },
    cobrancaClube: {
      ativa: clube.ativa === undefined ? c.cobrancaClube.ativa : clube.ativa === true,
      diasAntes: Math.round(limitar(clube.diasAntes, c.cobrancaClube.diasAntes, 0, 10)),
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
  };
  if ((atual.configuracao.sinal.ativo || atual.configuracao.cobrancaClube.ativa) && !provedorCobranca(empresaId)) {
    throw new CobrancaError('Configure a InfinitePay no servidor ou a chave Pix da barbearia antes de ligar as cobranças.', 'PROVEDOR_AUSENTE', 409);
  }
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
  return `DINO${tipo === 'sinal' ? 'S' : tipo === 'assinatura' ? 'C' : 'X'}${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
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
    efeitoErro: item.efeitoErro || null,
    revisar: item.revisar || null,
  };
}

/**
 * Cria (ou devolve a já existente) a cobrança de uma referência. Idempotente por
 * tipo + referência enquanto a cobrança estiver pendente ou paga.
 */
export async function criarCobranca(empresaId, dados = {}, opcoes = {}) {
  const tipo = ['sinal', 'assinatura'].includes(dados.tipo) ? dados.tipo : null;
  if (!tipo) throw new CobrancaError('Tipo de cobrança inválido.');
  const referencia = texto(dados.referencia, 160);
  const valor = dinheiro(dados.valor);
  if (!referencia) throw new CobrancaError('Referência da cobrança obrigatória.');
  if (valor < 1) throw new CobrancaError('Valor mínimo da cobrança: R$ 1,00.', 'VALOR_INVALIDO');
  const atual = estado(empresaId);
  const existente = Object.values(atual.cobrancas).find((item) => item.tipo === tipo && item.referencia === referencia && ['pendente', 'paga'].includes(item.status));
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
    descricao: texto(dados.descricao, 120) || (tipo === 'sinal' ? 'Sinal do agendamento' : 'Mensalidade do clube'),
    clienteId: texto(dados.clienteId, 120),
    clienteNome: texto(dados.clienteNome, 120),
    telefone: texto(dados.telefone, 30),
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

export function obterCobranca(empresaId, cobrancaId) {
  return visaoCobranca(estado(empresaId).cobrancas[String(cobrancaId)]);
}

export function listarCobrancas(empresaId, { status = '', tipo = '', limite = 200 } = {}) {
  return Object.values(estado(empresaId).cobrancas)
    .filter((item) => (!status || item.status === status) && (!tipo || item.tipo === tipo))
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .slice(0, Math.min(500, Math.max(1, numero(limite, 200))))
    .map(visaoCobranca);
}

function registrarReceita(empresaId, item, meio) {
  try {
    return financeiroKytto.registrarLancamento(empresaId, {
      tipo: 'receita',
      categoria: item.tipo === 'sinal' ? 'Sinais de agendamento' : 'Clube de assinatura',
      descricao: `${item.descricao}${item.clienteNome ? ` · ${item.clienteNome}` : ''}`,
      valor: item.valor,
      origem: 'barbearia_cobranca',
      status: 'pago',
      meioPagamento: meio,
      dataOperacao: item.pagoEm,
      pagoEm: item.pagoEm,
      automatico: true,
      chaveIdempotencia: `barbearia_cobranca:${empresaId}:${item.id}`,
      referencia: { cobrancaId: item.id, tipo: item.tipo, referencia: item.referencia },
    });
  } catch (erro) {
    console.error('[Cobrança] lançamento financeiro:', erro?.message || erro);
    return null;
  }
}

function aplicarEfeitos(empresaId, item) {
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
    // O período já tinha sido pago no balcão: o cliente pagou duas vezes.
    if (resultado?.repetido) { item.duplicada = true; item.revisar = 'pagamento_em_dobro'; }
  }
}

/**
 * Marca como paga e aplica o efeito (confirma o horário ou quita o ciclo).
 * Chamado só depois de uma verificação: webhook conferido na InfinitePay,
 * retorno conferido ou confirmação manual da equipe (Pix da chave).
 */
export function confirmarCobranca(empresaId, cobrancaId, { origem = 'manual', usuario = '', transacao = '' } = {}, opcoes = {}) {
  const atual = estado(empresaId);
  const item = atual.cobrancas[String(cobrancaId)];
  if (!item) throw new CobrancaError('Cobrança não encontrada.', 'COBRANCA_NAO_ENCONTRADA', 404);
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

export function cancelarCobranca(empresaId, cobrancaId, { usuario = '' } = {}) {
  const item = estado(empresaId).cobrancas[String(cobrancaId)];
  if (!item) throw new CobrancaError('Cobrança não encontrada.', 'COBRANCA_NAO_ENCONTRADA', 404);
  if (item.status === 'paga') throw new CobrancaError('Cobrança paga não pode ser cancelada aqui; faça o estorno pelo meio de pagamento.', 'COBRANCA_PAGA', 409);
  item.status = 'cancelada';
  item.canceladoPor = texto(usuario, 120) || 'equipe';
  item.canceladoEm = new Date().toISOString();
  save();
  return visaoCobranca(item);
}

/** Horário cancelado: o sinal pendente deixa de valer (pago depois, vira "revisar"). */
export function cancelarSinalPendente(empresaId, agendamentoId) {
  const atual = estado(empresaId);
  let mudou = false;
  for (const item of Object.values(atual.cobrancas)) {
    if (item.tipo === 'sinal' && item.status === 'pendente' && item.referencia === `sinal:${agendamentoId}`) {
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
  const indice = db().barbeariaCobrancaIndice?.[orderNsu];
  if (!indice) throw new CobrancaError('Cobrança não encontrada.', 'COBRANCA_NAO_ENCONTRADA', 404);
  const item = estado(indice.empresaId).cobrancas[indice.id];
  if (!item || item.provedor !== 'infinitepay') throw new CobrancaError('Cobrança não encontrada.', 'COBRANCA_NAO_ENCONTRADA', 404);
  if (item.status === 'paga') return { ...visaoCobranca(item), repetida: true, empresaId: indice.empresaId };
  const adapter = opcoes.adapter || createInfinitePayAdapter();
  const verificado = await adapter.verifyWebhook({
    payload,
    context: { expectedOrderNsu: orderNsu, expectedAmount: item.valor, account: contaInfinitePay(indice.empresaId) },
  });
  if (verificado?.status !== 'captured') return { ...visaoCobranca(item), pendente: true, empresaId: indice.empresaId };
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
    expiraEm: iso(agoraMs(opcoes) + prazo * 60000),
  }, opcoes);
}

export function sinalDoAgendamento(empresaId, agendamentoId) {
  const item = Object.values(estado(empresaId).cobrancas)
    .filter((cob) => cob.tipo === 'sinal' && cob.referencia === `sinal:${agendamentoId}`)
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
      if (item.tipo !== 'sinal' || item.status !== 'pendente' || !item.expiraEm) continue;
      // 5 minutos de tolerância: quem está pagando no limite do prazo não perde o horário.
      if (new Date(item.expiraEm).valueOf() + 5 * 60000 > ms) continue;
      item.status = 'expirada';
      item.expirouEm = iso(ms);
      mudou = true;
      const agendamentoId = item.referencia.replace(/^sinal:/, '');
      const agendamento = barbearia.listarAgendamentos(empresaId, {}).find((ag) => ag.id === agendamentoId);
      if (agendamento?.status === 'agendado') {
        try {
          const cancelado = barbearia.alterarStatusAgendamento(empresaId, agendamentoId, 'cancelado', { observacoes: texto(`${agendamento.observacoes || ''} · Cancelado: sinal não pago no prazo`, 600) });
          if (cancelado) liberados.push({ empresaId, agendamento: cancelado });
        } catch (_) { /* já mudou de status */ }
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
      }, opcoes);
      criadas.push(cobranca);
    } catch (erro) {
      console.error('[Cobrança] clube:', erro?.message || erro);
    }
  }
  return criadas;
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
  const { saldo, proximoVencimento } = calcularSaldo(registro?.movimentos || [], agoraMs(opcoes));
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
  conta.movimentos.push({ tipo: 'credito', valor, referencia, em: iso(ms), expiraEm: iso(ms + validadeDias * DIA_MS) });
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
  const { saldo } = calcularSaldo(conta.movimentos, agoraMs(opcoes));
  const pedido = dinheiro(valor);
  if (pedido <= 0) throw new CobrancaError('Informe o valor a usar.', 'VALOR_INVALIDO');
  if (pedido > saldo) throw new CobrancaError(`Saldo de cashback insuficiente (R$ ${saldo.toFixed(2).replace('.', ',')}).`, 'SALDO_INSUFICIENTE', 409);
  conta.movimentos.push({ tipo: 'debito', valor: pedido, referencia: `debito:${ref}`, em: iso(agoraMs(opcoes)), usuario: texto(usuario, 120) || null });
  save();
  return { usado: pedido, ...saldoCashback(empresaId, telefone, opcoes) };
}

// ── Painel ─────────────────────────────────────────────────────────────────

export function painelCobrancas(empresaId, opcoes = {}) {
  const lista = Object.values(estado(empresaId).cobrancas);
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
    cashbackEmAberto: dinheiro(carteiras.reduce((total, conta) => total + calcularSaldo(conta.movimentos, agoraMs(opcoes)).saldo, 0)),
    cobrancas: listarCobrancas(empresaId, { limite: 100 }),
  };
}

import { serviceGroup } from './core/service-groups.js';
import { validarAgendamentoComPlano, estornarUsosDaComanda } from './dino-captacao-kytto.js';
import { subscriptionStart } from './core/subscription-calendar.js';
import crypto from 'node:crypto';
import { identificarCliente, indiceIdentidadeClientes } from './barbearia-identidade.js';
import { canonizarRegistroAvec, historicoAvecVigente } from './dino-historico-avec.js';
import { legacyLojaIdFromCommerce, lojasEquivalentes } from './core/legacy-commerce-scope.js';
import { db, save, nextId } from './db.js';
import * as financeiroKytto from './financeiro-central-kytto.js';
import * as clientesKytto from './clientes-contas-kytto.js';
import * as caixaKytto from './caixa-diario-kytto.js';
import * as canaisFidelidadeKytto from './canais-fidelidade-kytto.js';
import { executeDinoReversal, getDinoReversalMemoryAdapter } from './core/dino-reversal-coordinator.js';
import { kyttoEventBus } from './core/kytto-event-bus.js';
import { isProdutoBebida } from './core/dino-regras-comissoes.js';

const STATUS = new Set(['agendado', 'confirmado', 'em_atendimento', 'concluido', 'cancelado', 'nao_compareceu']);
const TRANSICOES = {
  agendado: new Set(['confirmado', 'em_atendimento', 'cancelado', 'nao_compareceu']),
  confirmado: new Set(['agendado', 'em_atendimento', 'cancelado', 'nao_compareceu']),
  em_atendimento: new Set(['confirmado', 'agendado', 'concluido', 'cancelado', 'nao_compareceu']),
  concluido: new Set(['em_atendimento']),
  cancelado: new Set(['agendado', 'confirmado']),
  nao_compareceu: new Set(['agendado', 'confirmado']),
};

function texto(value, limite = 240) {
  return String(value ?? '').trim().slice(0, limite);
}

function numero(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function dinheiro(value, fallback = 0) {
  return Number(Math.max(0, numero(value, fallback)).toFixed(2));
}

function rejeitarPagamentoNaAgenda(dados) {
  if (['meioPagamento', 'meio_pagamento', 'valorRecebido', 'valor_recebido', 'financeiroLancamentoId', 'financeiro_lancamento_id'].some((campo) => Object.hasOwn(dados, campo))) {
    throw new Error('Dados de pagamento só podem ser registrados pelo fluxo de recebimento com lançamento financeiro.');
  }
}

function dataAtual() {
  return new Date().toISOString();
}

function chaveDia(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
}

// Dia operacional no fuso da unidade (Cuiabá por padrão). toISOString() vira o dia
// seguinte depois das 20h locais e jogava comissão e caixa para a data errada.
function diaOperacional(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return String(value).slice(0, 10);
  return formatadorOperacional('dia', process.env.KYTTO_TIMEZONE || 'America/Cuiaba').format(date);
}

// Intl.DateTimeFormat é caro de construir; reaproveita um formatador por fuso/tipo.
const FORMATADORES_OPERACIONAIS = new Map();
function formatadorOperacional(tipo, timeZone) {
  const chave = `${tipo}:${timeZone}`;
  let formatador = FORMATADORES_OPERACIONAIS.get(chave);
  if (!formatador) {
    formatador = tipo === 'dia'
      ? new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
      : new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    FORMATADORES_OPERACIONAIS.set(chave, formatador);
  }
  return formatador;
}

function horaOperacional(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  return formatadorOperacional('hora', process.env.KYTTO_TIMEZONE || 'America/Cuiaba').format(date);
}

function novoId(prefixo, bucket) {
  return `${prefixo}-${Date.now().toString(36)}-${String(Object.keys(bucket).length + 1).padStart(3, '0')}`;
}

// Vários itens lançados no mesmo milissegundo recebiam o mesmo id (o sufixo era a
// contagem de comandas). Agora cada linha tem um id único.
function novoIdItemComanda() {
  return `citem-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

function fingerprintPagamentoComanda({ clienteId, lojaId, dataVencimento, pagamentos }) {
  const payload = {
    clienteId: texto(clienteId, 120) || null,
    lojaId: texto(lojaId, 120) || null,
    dataVencimento: texto(dataVencimento, 40) || null,
    pagamentos: (Array.isArray(pagamentos) ? pagamentos : []).map((item) => ({
      meio: texto(item?.meio ?? item?.meioPagamento, 40).toLowerCase(),
      valor: dinheiro(item?.valor),
      caixaId: texto(item?.caixaId ?? item?.caixa_id, 120) || null,
      id: texto(item?.id, 120) || null,
      chaveIdempotencia: texto(item?.chaveIdempotencia ?? item?.chave_idempotencia, 220) || null,
    })),
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

const STATUS_COMANDA_BARBEARIA = new Set(['aberta', 'aguardando_pagamento', 'parcialmente_paga', 'em_conta', 'paga', 'cancelada']);
const TRANSICOES_COMANDA_BARBEARIA = {
  aberta: new Set(['aguardando_pagamento', 'parcialmente_paga', 'em_conta', 'paga', 'cancelada']),
  aguardando_pagamento: new Set(['parcialmente_paga', 'em_conta', 'paga', 'cancelada']),
  parcialmente_paga: new Set(['em_conta', 'paga', 'cancelada']),
  em_conta: new Set(),
  paga: new Set(),
  cancelada: new Set(),
};
const MEIOS_PAGAMENTO_COMANDA_BARBEARIA = new Set(['dinheiro', 'pix', 'cartao', 'credito', 'cartao_credito', 'debito', 'cartao_debito', 'transferencia', 'tef', 'carteira', 'conta', 'cheque', 'boleto', 'voucher', 'cortesia', 'permuta', 'credito_utilizado']);
const MEIOS_TAXA_COMISSAO = new Set(['pix', 'cartao', 'credito', 'cartao_credito', 'debito', 'cartao_debito', 'transferencia', 'tef', 'carteira']);

function estadoVazio() {
  return {
    profissionais: {},
    servicos: {},
    agendamentos: {},
    bloqueios: {},
    filaEspera: {},
    filaSequencia: 0,
    planos: {},
    assinaturas: {},
    produtosRevenda: {},
    movimentosEstoque: {},
    movimentosComissao: {},
    inventoryReservations: {},
    inventoryReservationEvents: {},
    inventoryReservationActions: {},
    reservasEstoque: {},
    eventosReservasEstoque: {},
    acoesReservasEstoque: {},
    vendasRevenda: {},
    comandas: {},
    historicoAtendimentos: {},
    historicoComandas: {},
    configuracao: {
      horarioAbertura: '08:00',
      horarioFechamento: '20:00',
      intervaloMinutos: 15,
      tempoAtendimentoDinoMinutos: null,
      diasFuncionamento: [1, 2, 3, 4, 5, 6],
      antecedenciaMinutos: 60,
      janelaReservaDias: 60,
      politicaCancelamentoHoras: 4,
      feriados: [],
      taxasPagamento: {},
      lojas: {},
    },
  };
}

export function estadoEmpresa(empresaId, criar = true) {
  const raiz = db();
  const key = String(empresaId || '');
  const existente = raiz.barbearias?.[key];
  if (!criar && !existente) return estadoVazio();
  raiz.barbearias ||= {};
  raiz.barbearias[key] ||= estadoVazio();
  const estado = raiz.barbearias[key];
  if (!criar) {
    const vazio = estadoVazio();
    return {
      ...vazio,
      ...estado,
      profissionais: estado.profissionais || {},
      servicos: estado.servicos || {},
      agendamentos: estado.agendamentos || {},
      bloqueios: estado.bloqueios || {},
      filaEspera: estado.filaEspera || {},
      filaSequencia: Number(estado.filaSequencia || 0),
      planos: estado.planos || {},
      assinaturas: estado.assinaturas || {},
      produtosRevenda: estado.produtosRevenda || {},
      movimentosEstoque: estado.movimentosEstoque || {},
      movimentosComissao: estado.movimentosComissao || {},
      inventoryReservations: estado.inventoryReservations || estado.reservasEstoque || {},
      inventoryReservationEvents: estado.inventoryReservationEvents || estado.eventosReservasEstoque || {},
      inventoryReservationActions: estado.inventoryReservationActions || estado.acoesReservasEstoque || {},
      reservasEstoque: estado.reservasEstoque || estado.inventoryReservations || {},
      eventosReservasEstoque: estado.eventosReservasEstoque || estado.inventoryReservationEvents || {},
      acoesReservasEstoque: estado.acoesReservasEstoque || estado.inventoryReservationActions || {},
      vendasRevenda: estado.vendasRevenda || {},
      comandas: estado.comandas || {},
      historicoAtendimentos: estado.historicoAtendimentos || {},
      historicoComandas: estado.historicoComandas || {},
      configuracao: { ...vazio.configuracao, ...(estado.configuracao || {}), lojas: { ...(vazio.configuracao.lojas || {}), ...(estado.configuracao?.lojas || {}) } },
    };
  }
  estado.profissionais ||= {};
  estado.servicos ||= {};
  estado.agendamentos ||= {};
  estado.bloqueios ||= {};
  estado.filaEspera ||= {};
  estado.filaSequencia = Number(estado.filaSequencia || 0);
  estado.planos ||= {};
  estado.assinaturas ||= {};
  estado.produtosRevenda ||= {};
  estado.movimentosEstoque ||= {};
  estado.movimentosComissao ||= {};
  estado.inventoryReservations ||= {};
  estado.inventoryReservationEvents ||= {};
  estado.inventoryReservationActions ||= {};
  estado.reservasEstoque = estado.inventoryReservations || estado.reservasEstoque || {};
  estado.eventosReservasEstoque = estado.inventoryReservationEvents || estado.eventosReservasEstoque || {};
  estado.acoesReservasEstoque = estado.inventoryReservationActions || estado.acoesReservasEstoque || {};
  estado.vendasRevenda ||= {};
  estado.comandas ||= {};
  estado.historicoAtendimentos ||= {};
  estado.historicoComandas ||= {};
  // Bases legadas podem ter apenas {comandas:{...}} ou configuracao parcial.
  // Mesclar o estado vazio aqui evita que a validação da agenda tente usar
  // horarioAbertura/horarioFechamento indefinidos ao operar uma nova unidade.
  const configuracaoPadrao = estadoVazio().configuracao;
  estado.configuracao = {
    ...configuracaoPadrao,
    ...(estado.configuracao || {}),
    lojas: { ...(configuracaoPadrao.lojas || {}), ...(estado.configuracao?.lojas || {}) },
  };
  return estado;
}

// ── Reserva de estoque por operação (JSON ERP) ─────────────────────────────
// Este domínio é deliberadamente local ao ERP legado. Ele não simula uma
// transação PostgreSQL: snapshots servem somente para que uma operação deste
// processo não deixe efeitos parciais no JSON quando uma etapa falhar.
const STATUS_RESERVA_ESTOQUE = new Set(['held', 'confirmed', 'consumed', 'released', 'expired', 'cancelled']);
const STATUS_RESERVA_ATIVA = new Set(['held', 'confirmed']);

function erroEstoqueReserva(message, code, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

// Histórico importado (Avec e afins): é o grosso do banco e nenhuma operação que usa o
// snapshot o altera — só a importação (importarHistoricoAtendimentos/migração), que não
// passa por aqui. Ele entra no snapshot por referência, sem cópia. Todo o resto é copiado
// num único structuredClone, como antes, para manter os apelidos internos
// (ex.: reservasEstoque === inventoryReservations).
const CHAVES_HISTORICO_SO_LEITURA = Object.freeze(['historicoAtendimentos', 'historicoComandas']);
const metricasSnapshot = { snapshots: 0, restauracoes: 0, ultimaDuracaoMs: 0, maiorDuracaoMs: 0 };

export function estadoSnapshotsBarbearia() { return { ...metricasSnapshot }; }

/** Cópia do estado de uma empresa sem copiar o histórico importado (que segue por referência). */
export function copiarEstadoEmpresaSemHistorico(estado) {
  if (!estado || typeof estado !== 'object') return structuredClone(estado);
  const resto = { ...estado };
  for (const chave of CHAVES_HISTORICO_SO_LEITURA) delete resto[chave];
  const copia = structuredClone(resto);
  const ordenado = {};
  for (const chave of Object.keys(estado)) ordenado[chave] = CHAVES_HISTORICO_SO_LEITURA.includes(chave) ? estado[chave] : copia[chave];
  return ordenado;
}

function raizSnapshot() {
  const inicio = Date.now();
  const raiz = db();
  const barbearias = raiz.barbearias && typeof raiz.barbearias === 'object' ? raiz.barbearias : null;
  let copia;
  if (!barbearias) copia = structuredClone(raiz);
  else {
    const historicos = {};
    const semHistorico = {};
    for (const [empresa, estado] of Object.entries(barbearias)) {
      if (!estado || typeof estado !== 'object') { semHistorico[empresa] = estado; continue; }
      const resto = { ...estado };
      for (const chave of CHAVES_HISTORICO_SO_LEITURA) {
        if (!(chave in resto)) continue;
        (historicos[empresa] ||= {})[chave] = resto[chave];
        delete resto[chave];
      }
      semHistorico[empresa] = resto;
    }
    copia = structuredClone({ ...raiz, barbearias: semHistorico });
    for (const [empresa, chaves] of Object.entries(historicos)) {
      const estado = copia.barbearias[empresa];
      // mantém a ordem original das chaves do estado (o arquivo gravado não muda)
      const ordenado = {};
      for (const chave of Object.keys(barbearias[empresa])) ordenado[chave] = chave in chaves ? chaves[chave] : estado[chave];
      copia.barbearias[empresa] = ordenado;
    }
  }
  const duracao = Date.now() - inicio;
  metricasSnapshot.snapshots += 1;
  metricasSnapshot.ultimaDuracaoMs = duracao;
  metricasSnapshot.maiorDuracaoMs = Math.max(metricasSnapshot.maiorDuracaoMs, duracao);
  return copia;
}

// O snapshot é privado de quem o tirou e não é reutilizado depois da restauração:
// volta para o banco como está, sem nova cópia (o histórico continua o mesmo objeto).
function restaurarRaiz(snapshot) {
  const raiz = db();
  for (const chave of Object.keys(raiz)) delete raiz[chave];
  Object.assign(raiz, snapshot);
  metricasSnapshot.restauracoes += 1;
}

// só para os testes de snapshot (barbearia-snapshot.test.js)
export const _snapshotBarbeariaParaTeste = Object.freeze({ raizSnapshot, restaurarRaiz });

function validarEscopoInventario(empresaId, lojaId) {
  const empresa = texto(empresaId, 120);
  const loja = texto(lojaId, 120);
  if (!empresa) throw erroEstoqueReserva('empresaId é obrigatório para reservar estoque.', 'COMPANY_REQUIRED');
  if (!loja) throw erroEstoqueReserva('lojaId é obrigatório para reservar estoque.', 'STORE_REQUIRED');
  return { empresaId: empresa, lojaId: loja };
}

function hashReserva(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function fingerprintReserva(dados) {
  const informado = texto(dados.fingerprint, 160);
  return informado && /^[0-9a-f]{64}$/i.test(informado) ? informado.toLowerCase() : hashReserva(informado || dados.payloadFingerprint);
}

function reservaAgora(dados = {}) {
  const valor = dados.agora ?? dados.now ?? dataAtual();
  const date = new Date(valor);
  if (Number.isNaN(date.valueOf())) throw erroEstoqueReserva('Data de referência da reserva inválida.', 'DATE_INVALID');
  return date;
}

function reservaExpiraEm(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.valueOf())) throw erroEstoqueReserva('expiresAt é obrigatório e deve ser uma data válida.', 'EXPIRES_AT_INVALID');
  return date.toISOString();
}

function normalizarQuantidadeReserva(value) {
  const quantidade = Number(value);
  if (!Number.isFinite(quantidade) || quantidade <= 0) throw erroEstoqueReserva('Quantidade de reserva deve ser positiva.', 'QUANTITY_INVALID');
  return Number(quantidade.toFixed(4));
}

function normalizarReservaArgs(empresaId, lojaOuDados = {}, talvezDados = {}) {
  const dados = typeof lojaOuDados === 'string' ? { ...(talvezDados || {}), lojaId: lojaOuDados } : { ...(lojaOuDados || {}) };
  const escopo = validarEscopoInventario(empresaId, dados.lojaId ?? dados.loja_id);
  const produtoId = texto(dados.produtoId ?? dados.produto_id ?? dados.productId ?? dados.itemRef ?? dados.item_ref, 180);
  const quantidade = normalizarQuantidadeReserva(dados.quantidade ?? dados.quantity ?? dados.qtd);
  const origem = texto(dados.origem ?? dados.origin, 120);
  if (!produtoId) throw erroEstoqueReserva('produtoId/itemRef é obrigatório para reservar estoque.', 'PRODUCT_REQUIRED');
  if (!origem) throw erroEstoqueReserva('origem é obrigatória para reservar estoque.', 'ORIGIN_REQUIRED');
  const idempotencyKey = texto(dados.idempotencyKey ?? dados.idempotency_key ?? dados.chaveIdempotencia ?? dados.chave_idempotencia ?? dados.actionId ?? dados.action_id, 255);
  if (!idempotencyKey) throw erroEstoqueReserva('idempotencyKey ou actionId é obrigatório para reservar estoque.', 'IDEMPOTENCY_REQUIRED');
  const expiresAt = reservaExpiraEm(dados.expiresAt ?? dados.expires_at);
  const payload = {
    empresaId: escopo.empresaId,
    lojaId: escopo.lojaId,
    produtoId,
    quantidade,
    origem,
    idempotencyKey,
    expiresAt,
    referencia: texto(dados.referencia ?? dados.reference, 180) || null,
    correlationId: texto(dados.correlationId ?? dados.correlation_id, 180) || null,
  };
  const payloadFingerprint = hashReserva(JSON.stringify(payload));
  return { ...payload, fingerprint: fingerprintReserva({ ...dados, payloadFingerprint }), payloadFingerprint, payloadSanitizado: { ...payload } };
}

function normalizarTransicaoReservaArgs(empresaId, alvo = {}, talvezDados = {}, acao = '') {
  const dados = typeof alvo === 'string' ? { ...(talvezDados || {}), reservationId: alvo } : { ...(alvo || {}) };
  const escopo = validarEscopoInventario(empresaId, dados.lojaId ?? dados.loja_id);
  const reservationId = texto(dados.reservationId ?? dados.reservation_id ?? dados.id, 180);
  const reservationKey = texto(dados.reservationKey ?? dados.reservation_key, 255);
  if (!reservationId && !reservationKey) throw erroEstoqueReserva('reservationId ou reservationKey é obrigatório.', 'RESERVATION_REQUIRED');
  const actionKey = texto(dados.actionId ?? dados.action_id ?? dados.idempotencyKey ?? dados.idempotency_key ?? dados.chaveIdempotencia ?? dados.chave_idempotencia, 255)
    || `${reservationId || reservationKey}:${acao}`;
  const payload = {
    empresaId: escopo.empresaId,
    lojaId: escopo.lojaId,
    reservationId: reservationId || null,
    reservationKey: reservationKey || null,
    action: acao,
    motivo: texto(dados.motivo ?? dados.reason, 300) || null,
  };
  const payloadFingerprint = hashReserva(JSON.stringify(payload));
  return { ...payload, actionKey, fingerprint: fingerprintReserva({ ...dados, payloadFingerprint }), payloadFingerprint, payloadSanitizado: { ...payload } };
}

function produtoReservaNoEscopo(estado, empresaId, lojaId, produtoId) {
  const produto = estado.produtosRevenda[String(produtoId)];
  if (!produto || produto.empresaId !== String(empresaId)) throw erroEstoqueReserva('Produto não encontrado na empresa ativa.', 'PRODUCT_NOT_FOUND', 404);
  if (produto.ativo === false) throw erroEstoqueReserva('Produto inativo não pode ser reservado.', 'PRODUCT_INACTIVE', 409);
  // Produto legado sem loja não é compartilhado implicitamente nem sofre
  // backfill. O chamador precisa corrigir o cadastro antes de reservar.
  if (!produto.lojaId) throw erroEstoqueReserva('Produto legado sem loja está em quarentena; informe uma unidade antes de reservar.', 'SCOPE_QUARANTINED', 409);
  if (produto.lojaId !== lojaId) throw erroEstoqueReserva('Produto não pertence à unidade ativa.', 'CROSS_STORE', 409);
  return produto;
}

function reservaAtivaAgora(reserva, agora) {
  return STATUS_RESERVA_ATIVA.has(reserva.status) && Date.parse(reserva.expiresAt) > agora.valueOf();
}

function reservasAtivasProduto(estado, empresaId, lojaId, produtoId, agora, excluirId = '') {
  return Object.values(estado.inventoryReservations)
    .filter((item) => item.empresaId === String(empresaId) && item.lojaId === String(lojaId) && item.produtoId === String(produtoId))
    .filter((item) => item.id !== excluirId && reservaAtivaAgora(item, agora));
}

function copiarReserva(reserva, extras = {}) {
  if (!reserva) return null;
  const { actions: _actions, ...visivel } = reserva;
  return { ...structuredClone(visivel), ...structuredClone(extras) };
}

function registrarEventoReserva(estado, reserva, eventType, status, fingerprint, payload = {}) {
  const eventId = novoId('rsv-event', estado.inventoryReservationEvents);
  estado.inventoryReservationEvents[eventId] = {
    id: eventId,
    empresaId: reserva.empresaId,
    lojaId: reserva.lojaId,
    reservationId: reserva.id,
    eventType,
    status,
    fingerprint,
    expiresAt: reserva.expiresAt,
    payloadSanitizado: structuredClone(payload),
    ocorridoEm: dataAtual(),
  };
  reserva.eventIds = [...(reserva.eventIds || []), eventId];
  return estado.inventoryReservationEvents[eventId];
}

function localizarReserva(estado, dados) {
  const reserva = dados.reservationId ? estado.inventoryReservations[dados.reservationId] : Object.values(estado.inventoryReservations).find((item) => item.reservationKey === dados.reservationKey);
  return reserva || null;
}

function localizarReservaPorChaveGlobal(empresaId, reservationKey) {
  const estado = estadoEmpresa(empresaId, false);
  return Object.values(estado.inventoryReservations).find((item) => item.reservationKey === reservationKey) || null;
}

function aplicarAcaoReserva(estado, reserva, args, novoStatus, eventType, movimento = null) {
  const actionId = `${reserva.id}:${args.actionKey}`;
  const anterior = estado.inventoryReservationActions[actionId];
  if (anterior) {
    if (anterior.fingerprint !== args.fingerprint || anterior.payloadFingerprint !== args.payloadFingerprint) throw erroEstoqueReserva('A ação de reserva foi reutilizada com payload diferente.', 'IDEMPOTENCY_CONFLICT', 409);
    return { reserva: copiarReserva(reserva, { replayed: true, movimento: anterior.movimento || null }), movimento: anterior.movimento || null };
  }
  if (reserva.status !== 'held' && reserva.status !== 'confirmed') throw erroEstoqueReserva(`Reserva já está em estado terminal (${reserva.status}).`, 'RESERVATION_STATE_CONFLICT', 409);
  reserva.status = novoStatus;
  reserva.atualizadoEm = dataAtual();
  if (novoStatus === 'consumed') reserva.confirmadoEm = reserva.atualizadoEm;
  if (novoStatus === 'released' || novoStatus === 'expired' || novoStatus === 'cancelled') reserva.liberadoEm = reserva.atualizadoEm;
  const evento = registrarEventoReserva(estado, reserva, eventType, novoStatus, args.fingerprint, args.payloadSanitizado);
  const resultado = { reserva: copiarReserva(reserva, { movimento: movimento ? structuredClone(movimento) : null }), movimento: movimento ? structuredClone(movimento) : null };
  estado.inventoryReservationActions[actionId] = {
    id: actionId,
    empresaId: reserva.empresaId,
    lojaId: reserva.lojaId,
    reservationId: reserva.id,
    actionKey: args.actionKey,
    action: eventType,
    fingerprint: args.fingerprint,
    payloadFingerprint: args.payloadFingerprint,
    status: novoStatus,
    eventId: evento.id,
    movimento: movimento ? structuredClone(movimento) : null,
    resultado: structuredClone(resultado),
    criadoEm: dataAtual(),
  };
  return resultado;
}

export function reserveInventoryForOperation(empresaId, lojaOuDados = {}, talvezDados = {}) {
  const args = normalizarReservaArgs(empresaId, lojaOuDados, talvezDados);
  const snapshot = raizSnapshot();
  try {
    const estado = estadoEmpresa(args.empresaId);
    const existenteGlobal = localizarReservaPorChaveGlobal(args.empresaId, args.idempotencyKey);
    if (existenteGlobal) {
      if (existenteGlobal.lojaId !== args.lojaId || existenteGlobal.fingerprint !== args.fingerprint || existenteGlobal.payloadFingerprint !== args.payloadFingerprint) {
        throw erroEstoqueReserva('A chave de idempotência já foi usada com payload ou unidade diferente.', 'IDEMPOTENCY_CONFLICT', 409);
      }
      return copiarReserva(existenteGlobal, { replayed: true });
    }
    const produto = produtoReservaNoEscopo(estado, args.empresaId, args.lojaId, args.produtoId);
    const agora = reservaAgora(args);
    const reservado = reservasAtivasProduto(estado, args.empresaId, args.lojaId, produto.id, agora).reduce((soma, item) => soma + Number(item.quantidade || 0), 0);
    const estoque = Number(produto.estoqueAtual || 0);
    const disponivel = Number((estoque - reservado).toFixed(4));
    if (disponivel + 1e-9 < args.quantidade) throw erroEstoqueReserva(`Estoque disponível insuficiente para ${produto.nome} (disponível: ${disponivel}, necessário: ${args.quantidade}).`, 'INVENTORY_INSUFFICIENT', 409);
    const id = novoId('rsv', estado.inventoryReservations);
    const reserva = {
      id,
      empresaId: args.empresaId,
      lojaId: args.lojaId,
      reservationKey: args.idempotencyKey,
      itemRef: produto.id,
      produtoId: produto.id,
      quantidade: args.quantidade,
      status: 'held',
      fingerprint: args.fingerprint,
      payloadFingerprint: args.payloadFingerprint,
      expiresAt: args.expiresAt,
      origem: args.origem,
      referencia: args.referencia,
      correlationId: args.correlationId,
      payloadSanitizado: args.payloadSanitizado,
      eventIds: [],
      actions: {},
      criadoEm: dataAtual(),
      atualizadoEm: dataAtual(),
    };
    estado.inventoryReservations[id] = reserva;
    registrarEventoReserva(estado, reserva, 'reserved', 'held', args.fingerprint, args.payloadSanitizado);
    save();
    return copiarReserva(reserva, { replayed: false, disponivelAnterior: disponivel });
  } catch (error) {
    restaurarRaiz(snapshot);
    throw error;
  }
}

export function releaseInventoryReservation(empresaId, alvo = {}, talvezDados = {}) {
  return transicionarInventoryReservation(empresaId, alvo, talvezDados, 'released', 'released');
}

export function commitInventoryReservation(empresaId, alvo = {}, talvezDados = {}) {
  return transicionarInventoryReservation(empresaId, alvo, talvezDados, 'consumed', 'committed');
}

function transicionarInventoryReservation(empresaId, alvo, talvezDados, novoStatus, eventType) {
  const args = normalizarTransicaoReservaArgs(empresaId, alvo, talvezDados, eventType);
  const snapshot = raizSnapshot();
  try {
    const estado = estadoEmpresa(args.empresaId);
    const reserva = localizarReserva(estado, args);
    if (!reserva || reserva.empresaId !== args.empresaId || reserva.lojaId !== args.lojaId) throw erroEstoqueReserva('Reserva não encontrada na empresa/unidade ativa.', 'RESERVATION_NOT_FOUND', 404);
    const actionId = `${reserva.id}:${args.actionKey}`;
    const anterior = estado.inventoryReservationActions[actionId];
    if (anterior) {
      if (anterior.fingerprint !== args.fingerprint || anterior.payloadFingerprint !== args.payloadFingerprint) throw erroEstoqueReserva('A ação de reserva foi reutilizada com payload diferente.', 'IDEMPOTENCY_CONFLICT', 409);
      return copiarReserva(reserva, { replayed: true, movimento: anterior.movimento || null });
    }
    if (novoStatus === 'consumed') {
      if (Date.parse(reserva.expiresAt) <= Date.now()) throw erroEstoqueReserva('A reserva expirou e precisa ser liberada antes da baixa.', 'RESERVATION_EXPIRED', 409);
      const produto = produtoReservaNoEscopo(estado, args.empresaId, args.lojaId, reserva.produtoId);
      if (Number(produto.estoqueAtual || 0) < Number(reserva.quantidade || 0)) throw erroEstoqueReserva(`Estoque atual insuficiente para confirmar a reserva de ${produto.nome}.`, 'INVENTORY_INSUFFICIENT_AT_COMMIT', 409);
      const anteriorEstoque = Number(produto.estoqueAtual || 0);
      const agora = dataAtual();
      produto.estoqueAtual = Number((anteriorEstoque - Number(reserva.quantidade || 0)).toFixed(4));
      produto.atualizadoEm = agora;
      produto.ultimoMovimentoEm = agora;
      const movimentoId = novoId('mov', estado.movimentosEstoque);
      const origemComanda = reserva.origem === 'comanda_barbearia';
      const origemVenda = reserva.origem === 'venda_revenda';
      const movimento = {
        id: movimentoId,
        empresaId: args.empresaId,
        lojaId: args.lojaId,
        produtoId: produto.id,
        // A reserva continua sendo a trava concorrente, mas o ledger de estoque
        // conserva a origem operacional para relatórios e estornos coordenados.
        tipo: origemComanda ? 'saida_comanda' : origemVenda ? 'saida_venda' : 'saida_reserva',
        quantidade: reserva.quantidade,
        estoqueAnterior: anteriorEstoque,
        estoquePosterior: produto.estoqueAtual,
        origem: reserva.origem,
        referencia: reserva.referencia || null,
        ...(origemComanda ? { comandaId: reserva.referencia || null } : {}),
        ...(origemVenda ? { vendaId: reserva.referencia || null } : {}),
        reservationId: reserva.id,
        reservationKey: reserva.reservationKey,
        correlationId: reserva.correlationId || null,
        observacao: `Baixa da reserva ${reserva.id}.`,
        criadoEm: agora,
      };
      estado.movimentosEstoque[movimentoId] = movimento;
      const resultado = aplicarAcaoReserva(estado, reserva, args, novoStatus, eventType, movimento);
      save();
      return resultado.reserva;
    }
    const resultado = aplicarAcaoReserva(estado, reserva, args, novoStatus, eventType);
    save();
    return resultado.reserva;
  } catch (error) {
    restaurarRaiz(snapshot);
    throw error;
  }
}

export function expireInventoryReservations(empresaId, lojaOuDados = {}, talvezDados = {}) {
  const dados = typeof lojaOuDados === 'string' ? { ...(talvezDados || {}), lojaId: lojaOuDados } : { ...(lojaOuDados || {}) };
  const { empresaId: empresa, lojaId } = validarEscopoInventario(empresaId, dados.lojaId ?? dados.loja_id);
  const agora = reservaAgora(dados);
  const snapshot = raizSnapshot();
  try {
    const estado = estadoEmpresa(empresa);
    const expiradas = [];
    for (const reserva of Object.values(estado.inventoryReservations)) {
      if (reserva.empresaId !== empresa || reserva.lojaId !== lojaId || !STATUS_RESERVA_ATIVA.has(reserva.status)) continue;
      if (Date.parse(reserva.expiresAt) > agora.valueOf()) continue;
      const args = {
        actionKey: `expire:${reserva.id}:${reserva.expiresAt}`,
        fingerprint: hashReserva(JSON.stringify({ reservationId: reserva.id, lojaId, status: 'expired', expiresAt: reserva.expiresAt })),
        payloadFingerprint: hashReserva(JSON.stringify({ reservationId: reserva.id, lojaId, status: 'expired', expiresAt: reserva.expiresAt })),
        payloadSanitizado: { reservationId: reserva.id, lojaId, action: 'expired', expiresAt: reserva.expiresAt },
      };
      const resultado = aplicarAcaoReserva(estado, reserva, args, 'expired', 'expired');
      expiradas.push(resultado.reserva);
    }
    if (expiradas.length) save();
    return { empresaId: empresa, lojaId, agora: agora.toISOString(), expiradas, expired: expiradas, total: expiradas.length };
  } catch (error) {
    restaurarRaiz(snapshot);
    throw error;
  }
}

export function listarInventoryReservations(empresaId, { lojaId = '', produtoId = '', status = '' } = {}) {
  const estado = estadoEmpresa(empresaId, false);
  return Object.values(estado.inventoryReservations)
    .filter((item) => item.empresaId === String(empresaId))
    .filter((item) => !lojaId || item.lojaId === String(lojaId))
    .filter((item) => !produtoId || item.produtoId === String(produtoId))
    .filter((item) => !status || item.status === String(status))
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .map((item) => copiarReserva(item));
}

function comissoesPorServicoNormalizadas(valor) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
  const saida = {};
  for (const [servicoId, percentual] of Object.entries(valor).slice(0, 200)) {
    const id = texto(servicoId, 100);
    if (!id || percentual === null || percentual === '' || percentual === undefined) continue;
    const n = Number(percentual);
    if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error('Comissão por serviço deve ficar entre 0 e 100%.');
    saida[id] = Math.round(n * 100) / 100;
  }
  return saida;
}

// Percentual de comissão de um serviço para o profissional (exceção ou padrão).
export function percentualComissaoServico(profissional = {}, servicoId = '') {
  const excecao = profissional.comissoesPorServico?.[String(servicoId || '')];
  return Number.isFinite(Number(excecao)) ? Number(excecao) : Number(profissional.percentualComissao || 0);
}

export function normalizarFaixasComissao(faixas) {
  if (!Array.isArray(faixas)) return [];
  return faixas
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const meta = dinheiro(item.metaFaturamento ?? item.meta_faturamento ?? item.meta ?? item.valor);
      const bonus = numero(item.bonusPercentual ?? item.bonus_percentual ?? item.bonus ?? item.percentualAdicional, 0);
      const desc = texto(item.descricao ?? item.label ?? item.nome, 120);
      return meta > 0 ? { metaFaturamento: meta, bonusPercentual: Math.min(100, Math.max(0, bonus)), descricao: desc || `Meta R$ ${meta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.metaFaturamento - b.metaFaturamento);
}

export function calcularFaixaBonificacao(faturamento, percentualBase, faixas = []) {
  const fat = dinheiro(faturamento);
  const base = Number(percentualBase || 0);
  const lista = normalizarFaixasComissao(faixas);

  if (!lista.length) {
    return {
      faturamento: fat,
      percentualBase: base,
      faixaAtual: null,
      bonusPercentual: 0,
      percentualEfetivo: base,
      proximaFaixa: null,
      faltaParaProxima: 0,
      progressoPct: 100,
      mensagemStatus: `Comissão padrão de ${base}%. Nenhuma meta configurada.`,
      todasFaixas: [],
    };
  }

  let faixaAtual = null;
  let proximaFaixa = null;

  for (let i = 0; i < lista.length; i++) {
    const f = lista[i];
    if (fat >= f.metaFaturamento) {
      faixaAtual = f;
    } else {
      proximaFaixa = f;
      break;
    }
  }

  const bonus = faixaAtual ? faixaAtual.bonusPercentual : 0;
  const percentualEfetivo = Math.min(100, base + bonus);
  const faltaParaProxima = proximaFaixa ? dinheiro(Math.max(0, proximaFaixa.metaFaturamento - fat)) : 0;
  const piso = faixaAtual ? faixaAtual.metaFaturamento : 0;
  const teto = proximaFaixa ? proximaFaixa.metaFaturamento : (faixaAtual ? faixaAtual.metaFaturamento : 1);
  const progressoPct = proximaFaixa
    ? Math.min(100, Math.max(0, Number(((fat - piso) / (teto - piso) * 100).toFixed(1))))
    : 100;

  let mensagemStatus = '';
  if (proximaFaixa) {
    if (faixaAtual) {
      mensagemStatus = `Já faturou R$ ${fat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, atingiu ${faixaAtual.descricao} (${percentualEfetivo}%) e faltam R$ ${faltaParaProxima.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para alcançar a próxima meta (${base + proximaFaixa.bonusPercentual}%).`;
    } else {
      mensagemStatus = `Já faturou R$ ${fat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (comissão base de ${base}%) e faltam R$ ${faltaParaProxima.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para alcançar a 1ª meta (${base + proximaFaixa.bonusPercentual}%).`;
    }
  } else {
    mensagemStatus = `Parabéns! Faturou R$ ${fat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} e alcançou o teto máximo de bonificação: ${percentualEfetivo}%.`;
  }

  return {
    faturamento: fat,
    percentualBase: base,
    faixaAtual,
    bonusPercentual: bonus,
    percentualEfetivo,
    proximaFaixa,
    faltaParaProxima,
    progressoPct,
    mensagemStatus,
    todasFaixas: lista,
  };
}

export function ehProfissionalDino(profissional) {
  if (!profissional) return false;
  if (profissional.atendimento24x7 === true) return true;
  const nome = String(profissional.nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const apelido = String(profissional.apelido || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const id = String(profissional.id || '').toLowerCase();
  return nome.includes('dino') || nome.includes('guilherme cunha') || apelido.includes('dino') || id.includes('dino');
}

export function ehHorarioExtraDino(horaLocal) {
  if (!horaValida(horaLocal)) return false;
  const [h, m] = String(horaLocal).split(':').map(Number);
  const minutos = h * 60 + m;
  // Após as 18h09 (> 1089 min) até as 06h00 (< 360 min)
  return minutos > 1089 || minutos < 360;
}

export function calcularPrecoServicoHorario(servico, profissional, horaLocal) {
  const precoBase = Number(servico?.preco || 0);
  if (ehProfissionalDino(profissional)) {
    if (ehHorarioExtraDino(horaLocal)) {
      return 600; // Depois das 18h09 até as 06h00 da manhã o corte com Dino é R$ 600
    }
    return Math.max(300, precoBase);
  }
  return precoBase;
}

function profissionalNormalizado(dados = {}, anterior = {}) {
  const nomeProf = texto(dados.nome ?? anterior.nome, 120);
  const isDinoAuto = String(nomeProf).toLowerCase().includes('dino') || String(nomeProf).toLowerCase().includes('guilherme cunha');
  const atendimento24x7 = Boolean(dados.atendimento24x7 ?? anterior.atendimento24x7 ?? isDinoAuto);
  const diasPadrao = atendimento24x7 ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
  const dias = Array.isArray(dados.diasTrabalho ?? dados.dias_trabalho ?? anterior.diasTrabalho)
    ? [...new Set((dados.diasTrabalho ?? dados.dias_trabalho ?? anterior.diasTrabalho).map((item) => numero(item, -1)).filter((item) => item >= 0 && item <= 6))].sort()
    : diasPadrao;
  return {
    nome: nomeProf,
    telefone: texto(dados.telefone ?? anterior.telefone, 30),
    email: texto(dados.email ?? anterior.email, 160).toLowerCase(),
    especialidade: texto(dados.especialidade ?? anterior.especialidade, 100) || 'Barbeiro',
    tipo: ['funcionario', 'parceiro', 'autonomo'].includes(String(dados.tipo ?? anterior.tipo)) ? String(dados.tipo ?? anterior.tipo) : 'parceiro',
    percentualComissao: Math.min(100, Math.max(0, numero(dados.percentualComissao ?? dados.percentual_comissao ?? anterior.percentualComissao, 50))),
    percentualComissaoProduto: Math.min(100, Math.max(0, numero(dados.percentualComissaoProduto ?? dados.percentual_comissao_produto ?? anterior.percentualComissaoProduto, 30))),
    // Exceções por serviço ({ servicoId: percentual }). Sem exceção vale percentualComissao.
    comissoesPorServico: comissoesPorServicoNormalizadas(dados.comissoesPorServico ?? dados.comissoes_por_servico ?? anterior.comissoesPorServico),
    // Faixas progressivas de bonificação por metas alcançadas (serviços e produtos independentes)
    faixasComissaoServico: normalizarFaixasComissao(dados.faixasComissaoServico ?? dados.faixas_comissao_servico ?? anterior.faixasComissaoServico),
    faixasComissaoProduto: normalizarFaixasComissao(dados.faixasComissaoProduto ?? dados.faixas_comissao_produto ?? anterior.faixasComissaoProduto),
    descontaTaxaMaquininha: dados.descontaTaxaMaquininha ?? dados.desconta_taxa_maquininha ?? anterior.descontaTaxaMaquininha ?? true,
    // Desconta da base da comissão o custo do material usado no serviço (padrão: não).
    descontaMaterial: Boolean(dados.descontaMaterial ?? dados.desconta_material ?? anterior.descontaMaterial ?? false),
    duracaoAtendimentoMinutos: dados.duracaoAtendimentoMinutos !== undefined
      ? (Number(dados.duracaoAtendimentoMinutos) > 0 ? Math.max(5, Math.min(480, Math.round(Number(dados.duracaoAtendimentoMinutos)))) : null)
      : (anterior.duracaoAtendimentoMinutos || null),
    atendimento24x7,
    horarioInicio: texto(dados.horarioInicio ?? dados.horario_inicio ?? anterior.horarioInicio, 5) || (atendimento24x7 ? '00:00' : '08:00'),
    horarioFim: texto(dados.horarioFim ?? dados.horario_fim ?? anterior.horarioFim, 5) || (atendimento24x7 ? '23:59' : '18:00'),
    diasTrabalho: dias,
    ativo: dados.ativo ?? anterior.ativo ?? true,
    fotoUrl: texto(dados.fotoUrl ?? dados.foto_url ?? anterior.fotoUrl, 500),
  };
}

// Como o preço é apresentado: fixo, "a partir de" (valor mínimo) ou sob consulta
// (sem valor de tabela; o valor final é definido no atendimento).
export const TIPOS_PRECO_SERVICO = Object.freeze(['fixo', 'a_partir_de', 'sob_consulta']);
function tipoPrecoNormalizado(valor, anterior) {
  const bruto = String(valor ?? anterior ?? 'fixo').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const alias = { a_partir: 'a_partir_de', apartir: 'a_partir_de', minimo: 'a_partir_de', consulta: 'sob_consulta', sob: 'sob_consulta' }[bruto] || bruto;
  if (!TIPOS_PRECO_SERVICO.includes(alias)) throw new Error('Tipo de preço inválido. Use fixo, a partir de ou sob consulta.');
  return alias;
}

// Texto do preço para cliente, IA e agendamento online.
export function rotuloPrecoServico(servico = {}) {
  const valor = Number(servico.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (servico.tipoPreco === 'sob_consulta') return 'Sob consulta';
  if (servico.tipoPreco === 'a_partir_de') return `A partir de ${valor}`;
  return valor;
}

function validarPrecoServico(servico) {
  if (servico.tipoPreco === 'sob_consulta') {
    if (servico.preco < 0) throw new Error('Preço do serviço não pode ser negativo.');
    return;
  }
  if (servico.preco < 0) throw new Error('Preço do serviço não pode ser negativo.');
}

function custoMaterialNormalizado(valor, anterior) {
  if (valor === undefined) return anterior ?? null;
  if (valor === null || valor === '') return null;
  const custo = dinheiro(valor);
  if (custo < 0) throw new Error('Custo de material não pode ser negativo.');
  return custo;
}

function servicoNormalizado(dados = {}, anterior = {}) {
  const tipoPreco = tipoPrecoNormalizado(dados.tipoPreco ?? dados.tipo_preco, anterior.tipoPreco);
  const preco = dinheiro(dados.preco ?? anterior.preco);
  const duracao = Math.max(5, Math.min(480, Math.round(numero(dados.duracaoMinutos ?? dados.duracao_minutos ?? anterior.duracaoMinutos, 30))));
  return {
    nome: texto(dados.nome ?? anterior.nome, 120),
    descricao: texto(dados.descricao ?? anterior.descricao, 500),
    categoria: texto(dados.categoria ?? anterior.categoria, 80) || 'Geral',
    grupoServico: ['convencionais','extras'].includes(dados.grupoServico ?? anterior.grupoServico) ? (dados.grupoServico ?? anterior.grupoServico) : 'nao_classificado',
    duracaoMinutos: duracao,
    intervaloRecomendacaoDias: Math.max(0, Math.min(3650, Math.round(numero(dados.intervaloRecomendacaoDias ?? dados.intervalo_recomendacao_dias ?? anterior.intervaloRecomendacaoDias, 0)))),
    preco,
    tipoPreco,
    ativo: dados.ativo ?? anterior.ativo ?? true,
    permiteAgendamentoOnline: dados.permiteAgendamentoOnline ?? dados.permite_agendamento_online ?? anterior.permiteAgendamentoOnline ?? true,
    // Custo de material por atendimento (R$). Vazio = soma do custo dos insumos da ficha técnica.
    custoMaterial: custoMaterialNormalizado(dados.custoMaterial ?? dados.custo_material, anterior.custoMaterial),
    // Quem faz este serviço (ex.: manicure só com a Nathy). Vazio = qualquer profissional ativo.
    profissionaisIds: Array.isArray(dados.profissionaisIds ?? dados.profissionais_ids ?? anterior.profissionaisIds)
      ? [...new Set((dados.profissionaisIds ?? dados.profissionais_ids ?? anterior.profissionaisIds).map((id) => texto(id, 100)).filter(Boolean))].slice(0, 50)
      : [],
    consumoInterno: (Array.isArray(dados.consumoInterno ?? dados.consumo_interno) ? (dados.consumoInterno ?? dados.consumo_interno) : (anterior.consumoInterno || [])).map((item) => ({ produtoId: texto(item?.produtoId ?? item?.produto_id, 120), quantidade: Math.max(1, Math.round(numero(item?.quantidade ?? item?.qtd, 1))) })).filter((item) => item.produtoId),
  };
}

function horaValida(valor) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(valor || ''));
}

function diasNormalizados(valor, fallback) {
  return Array.isArray(valor)
    ? [...new Set(valor.map((item) => numero(item, -1)).filter((item) => item >= 0 && item <= 6))].sort()
    : actualOrDefault(fallback, [1, 2, 3, 4, 5, 6]);
}

function feriadosNormalizados(valor, fallback = []) {
  return Array.isArray(valor)
    ? [...new Set(valor.map((item) => texto(item, 10)).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item)))].sort()
    : actualOrDefault(fallback, []);
}

function taxasPagamentoNormalizadas(dados = {}, anterior = {}) {
  const recebidas = dados.taxasPagamento ?? dados.taxas_pagamento;
  if (recebidas === undefined) return { ...(anterior.taxasPagamento || {}) };
  if (!recebidas || typeof recebidas !== 'object' || Array.isArray(recebidas)) throw new Error('Configuração de taxas por pagamento inválida.');
  const taxas = {};
  for (const [meioRecebido, regraRecebida] of Object.entries(recebidas)) {
    const meio = texto(meioRecebido, 30).toLowerCase();
    if (!MEIOS_TAXA_COMISSAO.has(meio) || !regraRecebida || typeof regraRecebida !== 'object' || Array.isArray(regraRecebida)) continue;
    const percentual = Math.max(0, Math.min(100, numero(regraRecebida.percentual)));
    const fixa = dinheiro(regraRecebida.fixa);
    const fonte = texto(regraRecebida.fonte, 160);
    if (percentual <= 0 && fixa <= 0) continue;
    if (!fonte) throw new Error(`Informe a fonte da taxa real de ${meio}.`);
    taxas[meio] = { percentual: Number(percentual.toFixed(4)), fixa, fonte };
  }
  return taxas;
}

function configuracaoPublicaNormalizada(dados = {}, anterior = {}) {
  const slugRecebido = texto(dados.slugPublico ?? dados.slug_publico ?? anterior.slugPublico, 100)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const ativoRecebido = dados.agendamentoPublicoAtivo ?? dados.agendamento_publico_ativo;
  const confirmacaoRecebida = dados.confirmacaoAutomaticaAtiva ?? dados.confirmacao_automatica_ativa;
  return {
    slugPublico: slugRecebido,
    nomePublico: texto(dados.nomePublico ?? dados.nome_publico ?? anterior.nomePublico, 160),
    whatsappPublico: texto(dados.whatsappPublico ?? dados.whatsapp_publico ?? anterior.whatsappPublico, 30),
    enderecoPublico: texto(dados.enderecoPublico ?? dados.endereco_publico ?? anterior.enderecoPublico, 240),
    emojiPublico: texto(dados.emojiPublico ?? dados.emoji_publico ?? anterior.emojiPublico, 8) || '✂️',
    lojaPublicaId: texto(dados.lojaPublicaId ?? dados.loja_publica_id ?? anterior.lojaPublicaId, 120),
    agendamentoPublicoAtivo: ativoRecebido === undefined ? anterior.agendamentoPublicoAtivo !== false : Boolean(ativoRecebido),
    // Opt-in explícito: nenhum tenant começa a cancelar horários automaticamente.
    confirmacaoAutomaticaAtiva: confirmacaoRecebida === undefined ? anterior.confirmacaoAutomaticaAtiva === true : confirmacaoRecebida === true,
    taxasPagamento: taxasPagamentoNormalizadas(dados, anterior),
  };
}

function calendarioNormalizado(dados = {}, anterior = {}) {
  const horarioAbertura = texto(dados.horarioAbertura ?? dados.horario_abertura ?? anterior.horarioAbertura, 5) || '08:00';
  const horarioFechamento = texto(dados.horarioFechamento ?? dados.horario_fechamento ?? anterior.horarioFechamento, 5) || '20:00';
  if (!horaValida(horarioAbertura) || !horaValida(horarioFechamento) || horarioFechamento <= horarioAbertura) throw new Error('Horário de funcionamento inválido.');
  const tempoAtendimentoDinoMinutos = dados.tempoAtendimentoDinoMinutos !== undefined
    ? (Number(dados.tempoAtendimentoDinoMinutos) > 0 ? Math.max(5, Math.min(480, Math.round(Number(dados.tempoAtendimentoDinoMinutos)))) : null)
    : (anterior.tempoAtendimentoDinoMinutos || null);
  return {
    horarioAbertura,
    horarioFechamento,
    intervaloMinutos: Math.max(5, Math.min(240, Math.round(numero(dados.intervaloMinutos ?? dados.intervalo_minutos ?? anterior.intervaloMinutos, 15)))),
    tempoAtendimentoDinoMinutos,
    diasFuncionamento: diasNormalizados(dados.diasFuncionamento ?? dados.dias_funcionamento, anterior.diasFuncionamento),
    feriados: feriadosNormalizados(dados.feriados, anterior.feriados),
    antecedenciaMinutos: Math.max(0, Math.min(10080, Math.round(numero(dados.antecedenciaMinutos ?? dados.antecedencia_minutos ?? anterior.antecedenciaMinutos, 60)))),
    janelaReservaDias: Math.max(1, Math.min(365, Math.round(numero(dados.janelaReservaDias ?? dados.janela_reserva_dias ?? anterior.janelaReservaDias, 60)))),
    politicaCancelamentoHoras: Math.max(0, Math.min(168, Math.round(numero(dados.politicaCancelamentoHoras ?? dados.politica_cancelamento_horas ?? anterior.politicaCancelamentoHoras, 4)))),
  };
}

export function duracaoAtendimentoProfissional(servico, profissional, calendario = {}) {
  if (profissional && Number(profissional.duracaoAtendimentoMinutos) > 0) {
    return Number(profissional.duracaoAtendimentoMinutos);
  }
  // A duração do procedimento reflete primariamente o tempo necessário cadastrado no Catálogo de Serviços do ERP
  // (ex: Corte 40min, Barba 30min, Corte e Barba 60min, Selagem 45min, Prótese 90min, etc.).
  if (servico && Number(servico.duracaoMinutos) > 0) {
    // Se tempoAtendimentoDinoMinutos foi configurado explicitamente no painel e o serviço é o genérico básico de 30 min:
    if (ehProfissionalDino(profissional) && Number(calendario?.tempoAtendimentoDinoMinutos) > 0 && servico.duracaoMinutos === 30 && !String(servico.nome || '').toLowerCase().includes('barba')) {
      return Number(calendario.tempoAtendimentoDinoMinutos);
    }
    return Number(servico.duracaoMinutos);
  }
  if (ehProfissionalDino(profissional) && Number(calendario?.tempoAtendimentoDinoMinutos) > 0) {
    return Number(calendario.tempoAtendimentoDinoMinutos);
  }
  return Number(calendario?.intervaloMinutos) || 15;
}

function agendamentoNormalizado(dados = {}, anterior = {}, opcoes = {}) {
  const dataHoraRecebida = texto(dados.dataHora ?? dados.data_hora ?? anterior.dataHora, 40);
  const temNovoDataHora = Boolean(dados.dataHora || dados.data_hora);
  const horaLocalExplicita = texto(dados.horaLocal ?? dados.hora_local ?? dados.hora, 5);
  const dataAgendaExplicita = texto(dados.dataAgenda ?? dados.data_agenda ?? dados.data, 10);
  const horaLocalRecebida = horaLocalExplicita || (temNovoDataHora ? horaOperacional(dataHoraRecebida) : texto(anterior.horaLocal, 5));
  const dataAgendaRecebida = dataAgendaExplicita || (temNovoDataHora ? diaOperacional(dataHoraRecebida) : texto(anterior.dataAgenda, 10));
  const dataAgendaOperacional = dataAgendaRecebida || (opcoes.horaOperacionalEstrita ? diaOperacional(dataHoraRecebida) : chaveDia(dataHoraRecebida));
  const horaLocalOperacional = horaLocalRecebida || horaOperacional(dataHoraRecebida);
  // A API administrativa recebe data e hora operacional, não a zona do navegador.
  // Quando o contrato estrito está ativo, o instante é reconstruído no fuso Cuiabá.
  const dataHora = opcoes.horaOperacionalEstrita && /^\d{4}-\d{2}-\d{2}$/.test(dataAgendaOperacional) && horaValida(horaLocalOperacional)
    ? dataHoraPublica(dataAgendaOperacional, horaLocalOperacional)
    : dataHoraRecebida;
  const status = STATUS.has(String(dados.status ?? anterior.status)) ? String(dados.status ?? anterior.status) : 'agendado';
  return {
    clienteId: texto(dados.clienteId ?? dados.cliente_id ?? anterior.clienteId, 100),
    clienteNome: texto(dados.clienteNome ?? dados.cliente_nome ?? anterior.clienteNome, 160),
    clienteTelefone: texto(dados.clienteTelefone ?? dados.cliente_telefone ?? anterior.clienteTelefone, 30),
    clienteCpf: texto(dados.clienteCpf ?? dados.cliente_cpf ?? anterior.clienteCpf, 20),
    clienteEmail: texto(dados.clienteEmail ?? dados.cliente_email ?? anterior.clienteEmail, 160).toLowerCase(),
    lojaId: texto(dados.lojaId ?? dados.loja_id ?? anterior.lojaId, 120),
    // Quando o cliente/admin envia somente dataHora, a jornada é validada no
    // fuso operacional do servidor, nunca no fuso do navegador.
    horaLocal: horaLocalOperacional,
    profissionalId:
 texto(dados.profissionalId ?? dados.profissional_id ?? anterior.profissionalId, 100),
    servicoId: texto(dados.servicoId ?? dados.servico_id ?? anterior.servicoId, 100),
    dataHora,
    dataAgenda: dataAgendaOperacional,
    duracaoMinutos: Math.max(5, Math.min(480, Math.round(numero(dados.duracaoMinutos ?? dados.duracao_minutos ?? anterior.duracaoMinutos, 30)))),
    valor: dinheiro(dados.valor ?? anterior.valor),
    status,
    observacoes: texto(dados.observacoes ?? anterior.observacoes, 600),
    origem: texto(dados.origem ?? anterior.origem, 40) || 'admin',
    usarPlano: dados.usarPlano === true || (dados.usarPlano === undefined && anterior.usarPlano === true),
    assinaturaId: dados.usarPlano === false ? null : (anterior.assinaturaId || null),
    codigoConfirmacao: texto(dados.codigoConfirmacao ?? dados.codigo_confirmacao ?? anterior.codigoConfirmacao, 20).toUpperCase(),
    meioPagamento: texto(anterior.meioPagamento, 40).toLowerCase(),
    valorRecebido: dinheiro(anterior.valorRecebido),
    financeiroLancamentoId: texto(anterior.financeiroLancamentoId, 120),
  };
}

function ordenarPorData(a, b) {
  return new Date(a.dataHora).valueOf() - new Date(b.dataHora).valueOf();
}

export function obterConfiguracao(empresaId) {
  const configuracao = estadoEmpresa(empresaId, false).configuracao;
  const isDino = ['d0d0ac01-8e50-4b61-8c79-de4aaa916da6', 'emp_dino', 'emp-kytto-001', 'dino'].includes(String(empresaId || '').toLowerCase());
  // Na Dino Barbearia, NUNCA ativar cancelamento automático por falta de confirmação!
  const ativa = isDino ? false : configuracao.confirmacaoAutomaticaAtiva === true;
  const horarioFechamento = isDino
    ? (configuracao.horarioFechamento === '20:00' ? '19:00' : (configuracao.horarioFechamento || '19:00'))
    : (configuracao.horarioFechamento || '20:00');
  return {
    ...configuracao,
    horarioFechamento,
    confirmacaoAutomaticaAtiva: ativa,
    cancelamentoAutomaticoPorFaltaConfirmacao: false,
    lojas: { ...(configuracao.lojas || {}) },
  };
}

function obterCalendarioLoja(estado, lojaId) {
  const id = String(lojaId || '');
  const base = { ...estado.configuracao };
  if (base.horarioFechamento === '20:00') base.horarioFechamento = '19:00';
  return id && estado.configuracao.lojas?.[id]
    ? { ...base, ...estado.configuracao.lojas[id], lojas: undefined }
    : { ...base, lojas: undefined };
}

export function obterConfiguracaoLoja(empresaId, lojaId) {
  const id = texto(lojaId, 120);
  if (!id) throw new Error('Unidade ativa não informada na sessão.');
  const estado = estadoEmpresa(empresaId, false);
  const calendario = obterCalendarioLoja(estado, id);
  return { lojaId: id, herdadaDaEmpresa: !estado.configuracao.lojas?.[id], calendario: { ...calendario, lojas: undefined } };
}

export function atualizarConfiguracao(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado.configuracao;
  Object.assign(atual, calendarioNormalizado(dados, atual), configuracaoPublicaNormalizada(dados, atual));
  save();
  return { ...atual, lojas: { ...(atual.lojas || {}) } };
}

export function atualizarConfiguracaoLoja(empresaId, lojaId, dados = {}) {
  const id = texto(lojaId, 120);
  if (!id) throw new Error('Unidade ativa não informada na sessão.');
  const estado = estadoEmpresa(empresaId);
  const atual = estado.configuracao.lojas[id] || obterCalendarioLoja(estado, id);
  estado.configuracao.lojas[id] = { lojaId: id, ...calendarioNormalizado(dados, atual), atualizadoEm: dataAtual() };
  save();
  return { lojaId: id, herdadaDaEmpresa: false, calendario: { ...estado.configuracao.lojas[id] } };
}

function actualOrDefault(value, fallback) {
  return Array.isArray(value) ? [...value] : [...fallback];
}


export function resolverProfissionalIdSeguro(estado, profissionalId) {
  if (!profissionalId) return null;
  const pId = String(profissionalId).trim();
  if (!pId) return null;

  // 1. Chave direta em estado.profissionais
  if (estado.profissionais && estado.profissionais[pId]) {
    const prof = estado.profissionais[pId];
    if (prof.ativo === false && /bruno/i.test(prof.nome || '') && !/bruno rafael/i.test(prof.nome || '')) {
      prof.ativo = true;
      prof.removidoEm = null;
      prof.excluido = false;
    }
    return pId;
  }

  // 2. Busca por nome, apelido, email ou match flexível
  const pNorm = pId.toLowerCase();
  const encontrado = Object.values(estado.profissionais || {}).find((p) => {
    const nomeNorm = String(p.nome || '').toLowerCase();
    const apelidoNorm = String(p.apelido || '').toLowerCase();
    return (
      p.id.toLowerCase() === pNorm ||
      nomeNorm === pNorm ||
      apelidoNorm === pNorm ||
      (pNorm.includes('bruno') && (nomeNorm.includes('bruno') || apelidoNorm === 'bruno') && !nomeNorm.includes('bruno rafael')) ||
      (pNorm.includes('nati') && (nomeNorm.includes('natani') || apelidoNorm === 'nati')) ||
      (pNorm.includes('dino') && (nomeNorm.includes('guilherme') || apelidoNorm === 'dino')) ||
      (pNorm.includes('ster') && (nomeNorm.includes('steffany') || apelidoNorm === 'ster' || apelidoNorm === 'ester'))
    );
  });

  if (encontrado) {
    if (encontrado.ativo === false && /bruno/i.test(encontrado.nome || '') && !/bruno rafael/i.test(encontrado.nome || '')) {
      encontrado.ativo = true;
      encontrado.removidoEm = null;
      encontrado.excluido = false;
    }
    return encontrado.id;
  }

  return pId;
}

export function listarProfissionais(empresaId, { incluirInativos = false } = {}) {
  const est = estadoEmpresa(empresaId, false);
  // Auto-recuperação garantida e deduplicação de Bruno (mantém apenas o registro canônico prof-mtj69hhx-002 ativo)
  const brunosValidos = Object.values(est.profissionais || {}).filter((p) => {
    const n = String(p.nome || '').toLowerCase();
    const ap = String(p.apelido || '').toLowerCase();
    return (n.includes('bruno') || ap === 'bruno') && !n.includes('bruno rafael');
  });
  if (brunosValidos.length > 0) {
    const titular = brunosValidos.find((p) => p.id === 'prof-mtj69hhx-002')
      || brunosValidos.find((p) => p.ativo !== false && !p.removidoEm && !p.excluido)
      || brunosValidos[0];
    if (titular.ativo === false || titular.removidoEm || titular.excluido) {
      titular.ativo = true;
      titular.removidoEm = null;
      titular.excluido = false;
    }
    for (const dup of brunosValidos) {
      if (dup.id !== titular.id) {
        if (dup.ativo !== false || !dup.excluido) {
          dup.ativo = false;
          dup.excluido = true;
          dup.removidoEm = dup.removidoEm || new Date().toISOString();
        }
        for (const ag of Object.values(est.agendamentos || {})) {
          if (ag && ag.profissionalId === dup.id) {
            ag.profissionalId = titular.id;
          }
        }
      }
    }
  }
  return Object.values(est.profissionais)
    .filter((item) => incluirInativos || (item.ativo !== false && !item.removidoEm && !item.excluido))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function criarProfissional(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const profissional = profissionalNormalizado(dados);
  if (!profissional.nome) throw new Error('Nome do profissional é obrigatório.');
  const id = novoId('prof', estado.profissionais);
  const agora = dataAtual();
  estado.profissionais[id] = { id, empresaId: String(empresaId), ...profissional, criadoEm: agora, atualizadoEm: agora };
  save();
  return { ...estado.profissionais[id] };
}

export function atualizarProfissional(empresaId, profissionalId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado.profissionais[String(profissionalId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;
  const profissional = profissionalNormalizado(dados, atual);
  if (!profissional.nome) throw new Error('Nome do profissional é obrigatório.');
  Object.assign(atual, profissional, { atualizadoEm: dataAtual() });
  restaurarSeReativado(atual, dados);
  save();
  return { ...atual };
}

// Exclusão lógica: profissionais podem estar referenciados por agenda,
// comandas e comissões. Mantemos o registro histórico e retiramos o acesso
// às novas operações ao marcar ativo=false.
// Lista de profissionais protegidos da Dino Barbearia (imunes a exclusão acidental)
export const PROFISSIONAIS_PROTEGIDOS_DINO = ['dino', 'bruno', 'bruno mendes', 'bruno mendes pedroso', 'nati', 'ester', 'ster', 'steffany', 'jhenyffer'];

export function isProfissionalProtegido(nome = '', apelido = '') {
  const n = String(nome || '').trim().toLowerCase();
  const a = String(apelido || '').trim().toLowerCase();
  return PROFISSIONAIS_PROTEGIDOS_DINO.some(prot => n.includes(prot) || a === prot);
}

export function excluirProfissional(empresaId, profissionalId, { forcar = false } = {}) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado.profissionais[String(profissionalId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;

  // Trava de segurança: impede exclusão acidental de profissionais titulares oficiais
  const isDinoTenant = ['d0d0ac01-8e50-4b61-8c79-de4aaa916da6', 'emp_dino', 'dino'].includes(String(empresaId || '').toLowerCase());
  if (isDinoTenant && isProfissionalProtegido(atual.nome, atual.apelido) && !forcar) {
    throw new Error(`O profissional titular ${atual.nome} é protegido e essencial para a operação da Dino Barbearia. Ação bloqueada.`);
  }

  const agora = dataAtual();
  Object.assign(atual, { ativo: false, removidoEm: atual.removidoEm || agora, atualizadoEm: agora });
  save();
  return { ...atual };
}

// Reativar um cadastro excluído (ativo: true) o devolve às listas; a marca de exclusão sai.
function restaurarSeReativado(atual, dados = {}) {
  if (dados.ativo === true && atual.removidoEm) {
    atual.restauradoEm = dataAtual();
    delete atual.removidoEm;
  }
}

// Desativar/reativar sem mexer no resto do cadastro: não revalida preço, serviços do plano
// ou unidade de registros antigos (ex.: importados do Avec), que travariam a ação.
function somenteAlternarAtivo(atual, dados = {}) {
  const chaves = Object.keys(dados || {}).filter((chave) => !['lojaId', 'loja_id'].includes(chave));
  if (chaves.length !== 1 || chaves[0] !== 'ativo' || typeof dados.ativo !== 'boolean') return false;
  Object.assign(atual, { ativo: dados.ativo, atualizadoEm: dataAtual() });
  restaurarSeReativado(atual, dados);
  save();
  return true;
}

// Exclusão lógica comum a serviços, planos e produtos de revenda: o registro sai das
// listas e das novas operações, mas continua no banco para agenda, comandas, vendas,
// comissões, assinaturas e histórico do Avec que o referenciam.
function arquivarCadastro(empresaId, colecao, id) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado[colecao]?.[String(id)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;
  const agora = dataAtual();
  Object.assign(atual, { ativo: false, removidoEm: atual.removidoEm || agora, atualizadoEm: agora });
  save();
  return { ...atual };
}

export function excluirServico(empresaId, servicoId) {
  return arquivarCadastro(empresaId, 'servicos', servicoId);
}

export function excluirPlano(empresaId, planoId) {
  return arquivarCadastro(empresaId, 'planos', planoId);
}

export function excluirProdutoRevenda(empresaId, produtoId) {
  return arquivarCadastro(empresaId, 'produtosRevenda', produtoId);
}

export function listarServicos(empresaId, { incluirInativos = false } = {}) {
  return Object.values(estadoEmpresa(empresaId, false).servicos)
    .filter((item) => incluirInativos || item.ativo !== false)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map(item=>({...item,grupoServico:serviceGroup(item),grupoServicoSugerido:!item.grupoServico}));
}

function validarConsumoInternoServico(estado, empresaId, servico) {
  for (const insumo of servico.consumoInterno || []) {
    const produto = estado.produtosRevenda[insumo.produtoId];
    if (!produto || produto.empresaId !== String(empresaId) || produto.ativo === false) throw new Error('Insumo de consumo interno inválido para a empresa ativa.');
  }
}

export function criarServico(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const servico = servicoNormalizado(dados);
  if (!servico.nome) throw new Error('Nome do serviço é obrigatório.');
  validarPrecoServico(servico);
  validarConsumoInternoServico(estado, empresaId, servico);
  if (Object.values(estado.servicos).some((item) => item.ativo !== false && item.nome.toLowerCase() === servico.nome.toLowerCase())) {
    throw new Error('Já existe um serviço ativo com este nome.');
  }
  const id = novoId('srv', estado.servicos);
  const agora = dataAtual();
  estado.servicos[id] = { id, empresaId: String(empresaId), ...servico, criadoEm: agora, atualizadoEm: agora };
  save();
  return { ...estado.servicos[id] };
}

export function atualizarServico(empresaId, servicoId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado.servicos[String(servicoId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;
  if (somenteAlternarAtivo(atual, dados)) return { ...atual };
  const servico = servicoNormalizado(dados, atual);
  if (!servico.nome) throw new Error('Nome do serviço é obrigatório.');
  validarPrecoServico(servico);
  validarConsumoInternoServico(estado, empresaId, servico);
  Object.assign(atual, servico, { atualizadoEm: dataAtual() });
  restaurarSeReativado(atual, dados);
  save();
  return { ...atual };
}

function identidadeCliente(registro) {
  const clientes = Object.values(db().clientesKytto?.empresas?.[String(registro.empresaId)]?.clientes || {});
  return identificarCliente(registro, clientes, registro.empresaId);
}

export function listarAgendamentos(empresaId, filtros = {}) {
  const telFiltro = filtros.telefone ? String(filtros.telefone).replace(/\D/g, '') : '';
  const itens = Object.values(estadoEmpresa(empresaId, false).agendamentos)
    .filter((item) => !filtros.data || String(item.dataAgenda || chaveDia(item.dataHora)).slice(0, 10) === String(filtros.data).slice(0, 10))
    .filter((item) => !filtros.de || String(item.dataAgenda || chaveDia(item.dataHora)).slice(0, 10) >= String(filtros.de).slice(0, 10))
    .filter((item) => !filtros.ate || String(item.dataAgenda || chaveDia(item.dataHora)).slice(0, 10) <= String(filtros.ate).slice(0, 10))
    .filter((item) => !filtros.status || item.status === String(filtros.status))
    .filter((item) => !filtros.profissionalId || String(filtros.profissionalId).split(',').map(id => id.trim()).includes(item.profissionalId))
    .filter((item) => !filtros.lojaId || lojasEquivalentes(empresaId, item.lojaId, filtros.lojaId))
    .filter((item) => {
      if (!telFiltro) return true;
      const tItem = String(item.clienteTelefone || '').replace(/\D/g, '');
      return tItem && (tItem === telFiltro || tItem.slice(-8) === telFiltro.slice(-8));
    })
    .sort(ordenarPorData);
  if (!itens.length) return [];
  // Um índice por empresa para a lista inteira (antes: uma varredura da base por agendamento).
  const indices = new Map();
  return itens.map((item) => {
    const chave = String(item.empresaId);
    if (!indices.has(chave)) indices.set(chave, indiceIdentidadeClientes(Object.values(db().clientesKytto?.empresas?.[chave]?.clientes || {}), item.empresaId));
    return identificarCliente(item, null, item.empresaId, indices.get(chave));
  });
}

const STATUS_FILA = new Set(['aguardando', 'chamado', 'atendido', 'ausente', 'cancelado']);
const TRANSICOES_FILA = {
  aguardando: new Set(['chamado', 'cancelado']),
  chamado: new Set(['atendido', 'ausente', 'cancelado']),
  atendido: new Set(),
  ausente: new Set(),
  cancelado: new Set(),
};
const STATUS_ASSINATURA = new Set(['pendente_ativacao', 'ativa', 'pausada', 'cancelada', 'expirada']);
const TRANSICOES_ASSINATURA = {
  pendente_ativacao: new Set(['ativa', 'cancelada']),
  ativa: new Set(['pausada', 'cancelada', 'expirada']),
  pausada: new Set(['ativa', 'cancelada']),
  cancelada: new Set(),
  expirada: new Set(),
};

function intervaloValido(inicio, fim) {
  const inicioMs = new Date(inicio).valueOf();
  const fimMs = new Date(fim).valueOf();
  if (!Number.isFinite(inicioMs) || !Number.isFinite(fimMs) || fimMs <= inicioMs) throw new Error('Intervalo de datas inválido.');
  return { inicioMs, fimMs };
}

function sobrepoe(inicioA, fimA, inicioB, fimB) {
  const a = intervaloValido(inicioA, fimA);
  const b = intervaloValido(inicioB, fimB);
  return a.inicioMs < b.fimMs && b.inicioMs < a.fimMs;
}

function bloqueioNormalizado(dados = {}, anterior = {}) {
  const inicio = texto(dados.inicio ?? dados.inicioEm ?? anterior.inicio, 40);
  const fim = texto(dados.fim ?? dados.fimEm ?? anterior.fim, 40);
  intervaloValido(inicio, fim);
  return {
    titulo: texto(dados.titulo ?? dados.nome ?? anterior.titulo, 160) || 'Bloqueio de agenda',
    motivo: texto(dados.motivo ?? anterior.motivo, 300),
    inicio,
    fim,
    profissionalId: texto(dados.profissionalId ?? dados.profissional_id ?? anterior.profissionalId, 100),
    ativo: dados.ativo ?? anterior.ativo ?? true,
    lojaId: texto(dados.lojaId ?? dados.loja_id ?? anterior.lojaId, 120),
  };
}

export function listarBloqueios(empresaId, filtros = {}) {
  return Object.values(estadoEmpresa(empresaId, false).bloqueios)
    .filter((item) => filtros.incluirInativos || item.ativo !== false)
    .filter((item) => {
      const dataInicio = chaveDia(item.inicio);
      const dataFim = chaveDia(item.fim);
      if (filtros.data) return dataInicio <= String(filtros.data).slice(0, 10) && dataFim >= String(filtros.data).slice(0, 10);
      if (filtros.de && filtros.ate) return dataInicio <= String(filtros.ate).slice(0, 10) && dataFim >= String(filtros.de).slice(0, 10);
      return true;
    })
    .filter((item) => !filtros.profissionalId || !item.profissionalId || String(filtros.profissionalId).split(',').map(id => id.trim()).includes(item.profissionalId))
    .filter((item) => !filtros.lojaId || !item.lojaId || item.lojaId === String(filtros.lojaId))
    .sort((a, b) => new Date(a.inicio).valueOf() - new Date(b.inicio).valueOf())
    .map((item) => ({ ...item }));
}

export function criarBloqueio(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const bloqueio = bloqueioNormalizado(dados);
  if (bloqueio.profissionalId && (!estado.profissionais[bloqueio.profissionalId] || estado.profissionais[bloqueio.profissionalId].ativo === false)) throw new Error('Profissional do bloqueio não encontrado ou inativo.');
  const id = novoId('blk', estado.bloqueios);
  const agora = dataAtual();
  estado.bloqueios[id] = { id, empresaId: String(empresaId), ...bloqueio, criadoEm: agora, atualizadoEm: agora };
  save();
  // Detecta agendamentos já existentes que colidem com este novo bloqueio
  const blkInicio = new Date(bloqueio.inicio).valueOf();
  const blkFim = new Date(bloqueio.fim).valueOf();
  const conflitos = Object.values(estado.agendamentos || {}).filter((ag) => {
    if (ag.status === 'cancelado' || ag.status === 'nao_compareceu' || ag.status === 'concluido') return false;
    if (bloqueio.profissionalId && ag.profissionalId !== bloqueio.profissionalId) return false;
    const agInicio = new Date(ag.dataHora).valueOf();
    const agFim = agInicio + (ag.duracaoMinutos || 30) * 60000;
    return agInicio < blkFim && agFim > blkInicio;
  }).map((ag) => ({
    id: ag.id,
    clienteNome: ag.clienteNome,
    clienteTelefone: ag.clienteTelefone,
    dataHora: ag.dataHora,
    horaLocal: ag.horaLocal,
    servicoNome: estado.servicos[ag.servicoId]?.nome || 'Serviço',
    profissionalNome: estado.profissionais[ag.profissionalId]?.nome || 'Profissional',
  }));
  return { ...estado.bloqueios[id], conflitos };
}

export function atualizarBloqueio(empresaId, bloqueioId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado.bloqueios[String(bloqueioId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;
  const bloqueio = bloqueioNormalizado(dados, atual);
  if (bloqueio.profissionalId && (!estado.profissionais[bloqueio.profissionalId] || estado.profissionais[bloqueio.profissionalId].ativo === false)) throw new Error('Profissional do bloqueio não encontrado ou inativo.');
  Object.assign(atual, bloqueio, { atualizadoEm: dataAtual() });
  save();
  return { ...atual };
}

export function desativarBloqueio(empresaId, bloqueioId) {
  return atualizarBloqueio(empresaId, bloqueioId, { ativo: false });
}

export function listarConflitosBloqueio(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId, false);
  if (!estado) return [];
  const inicio = dados.inicio ? new Date(dados.inicio).valueOf() : NaN;
  const fim = dados.fim ? new Date(dados.fim).valueOf() : NaN;
  if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return [];
  const profId = dados.profissionalId ? String(dados.profissionalId) : '';
  const lojaId = dados.lojaId ? String(dados.lojaId) : '';

  return Object.values(estado.agendamentos || {})
    .filter((ag) => {
      if (ag.status === 'cancelado' || ag.status === 'nao_compareceu' || ag.status === 'concluido') return false;
      if (profId && ag.profissionalId && String(ag.profissionalId) !== profId) return false;
      if (lojaId && ag.lojaId && String(ag.lojaId) !== lojaId) return false;
      const agIni = new Date(ag.dataHora).valueOf();
      const agFim = agIni + (Number(ag.duracaoMinutos) || 30) * 60 * 1000;
      return inicio < agFim && agIni < fim;
    })
    .map((ag) => ({
      id: ag.id,
      clienteNome: ag.clienteNome || 'Cliente',
      clienteTelefone: ag.clienteTelefone || '',
      profissionalId: ag.profissionalId,
      profissionalNome: estado.profissionais[ag.profissionalId]?.nome || 'Barbeiro',
      dataAgenda: ag.dataAgenda || ag.dataHora?.slice(0, 10),
      horaLocal: ag.horaLocal || '',
      servicoNome: ag.servicoNome || 'Atendimento',
      status: ag.status,
    }));
}

function filaNormalizada(dados = {}, anterior = {}) {
  return {
    clienteId: texto(dados.clienteId ?? dados.cliente_id ?? anterior.clienteId, 100),
    clienteNome: texto(dados.clienteNome ?? dados.cliente_nome ?? anterior.clienteNome, 160),
    clienteTelefone: texto(dados.clienteTelefone ?? dados.telefone ?? dados.cliente_telefone ?? anterior.clienteTelefone, 30),
    servicoId: texto(dados.servicoId ?? dados.servico_id ?? anterior.servicoId, 100),
    preferenciaProfissionalId: texto(dados.preferenciaProfissionalId ?? dados.profissionalId ?? anterior.preferenciaProfissionalId, 100),
    previsaoMinutos: Math.max(0, Math.min(720, Math.round(numero(dados.previsaoMinutos ?? dados.previsao_minutos ?? anterior.previsaoMinutos, 30)))),
    observacoes: texto(dados.observacoes ?? dados.observacao ?? anterior.observacoes, 500),
    dataAgenda: texto(dados.dataAgenda ?? dados.data_agenda ?? anterior.dataAgenda, 10) || diaOperacional(dataAtual()),
    lojaId: texto(dados.lojaId ?? dados.loja_id ?? anterior.lojaId, 120),
  };
}

export function listarFilaEspera(empresaId, filtros = {}) {
  return Object.values(estadoEmpresa(empresaId, false).filaEspera)
    .filter((item) => !filtros.status || item.status === String(filtros.status))
    .filter((item) => !filtros.data || String(item.dataAgenda || chaveDia(item.criadoEm)).slice(0, 10) === String(filtros.data).slice(0, 10))
    .filter((item) => !filtros.lojaId || !item.lojaId || item.lojaId === String(filtros.lojaId))
    .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0) || String(a.criadoEm).localeCompare(String(b.criadoEm)))
    .map((item) => ({ ...item }));
}

export function criarFilaEspera(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const item = filaNormalizada(dados);
  if (!item.clienteNome && !item.clienteId) throw new Error('Informe o cliente para entrar na fila.');
  if (item.servicoId && (!estado.servicos[item.servicoId] || estado.servicos[item.servicoId].ativo === false)) throw new Error('Serviço da fila não encontrado ou inativo.');
  if (item.preferenciaProfissionalId && (!estado.profissionais[item.preferenciaProfissionalId] || estado.profissionais[item.preferenciaProfissionalId].ativo === false)) throw new Error('Profissional preferencial não encontrado ou inativo.');
  estado.filaSequencia += 1;
  const id = novoId('fila', estado.filaEspera);
  const agora = dataAtual();
  const ordem = Math.max(0, ...Object.values(estado.filaEspera).filter((fila) => fila.dataAgenda === item.dataAgenda && ['aguardando', 'chamado'].includes(fila.status)).map((fila) => Number(fila.ordem || 0))) + 1;
  estado.filaEspera[id] = { id, empresaId: String(empresaId), senha: `B${String(estado.filaSequencia).padStart(3, '0')}`, ordem, status: 'aguardando', ...item, criadoEm: agora, atualizadoEm: agora };
  save();
  return { ...estado.filaEspera[id] };
}

export function alterarStatusFila(empresaId, filaId, status, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado.filaEspera[String(filaId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;
  const novoStatus = String(status || '');
  if (!STATUS_FILA.has(novoStatus)) throw new Error('Status de fila inválido.');
  if (novoStatus !== atual.status && !TRANSICOES_FILA[atual.status]?.has(novoStatus)) throw new Error(`Transição de fila ${atual.status} para ${novoStatus} não permitida.`);
  Object.assign(atual, {
    status: novoStatus,
    mesaOuPosicao: texto(dados.mesaOuPosicao ?? dados.posicao ?? atual.mesaOuPosicao, 60),
    observacoes: texto(dados.observacoes ?? dados.observacao ?? atual.observacoes, 500),
    chamadoEm: novoStatus === 'chamado' && !atual.chamadoEm ? dataAtual() : atual.chamadoEm,
    finalizadoEm: ['atendido', 'ausente', 'cancelado'].includes(novoStatus) ? dataAtual() : atual.finalizadoEm,
    atualizadoEm: dataAtual(),
  });
  save();
  return { ...atual };
}

export function chamarFila(empresaId, filaId, dados = {}) {
  return alterarStatusFila(empresaId, filaId, 'chamado', dados);
}

function condicoesDoPlano(plano) {
  plano=planoNormalizado({},plano);
  return {
    ...Object.fromEntries(['nome','preco','ciclo','regraRenovacao','validadeDias','sessoesIncluidas','percentualPote','rateioPote','valorFixoPorUso','ehVip','categoriaPlano','tipoProfissional','profissionalId','profissionalNome'].map(key=>[key,plano[key]])),
    servicosIds:[...(plano.servicosIds||[])],
    profissionaisIds:[...(plano.profissionaisIds||[])],
    precosPorProfissional:{...(plano.precosPorProfissional||{})},
  };
}

function planoNormalizado(dados = {}, anterior = {}) {
  const ciclo = ['mensal', 'trimestral', 'anual'].includes(String(dados.ciclo ?? anterior.ciclo)) ? String(dados.ciclo ?? anterior.ciclo) : 'mensal';
  const servicosIds = Array.isArray(dados.servicosIds ?? dados.servicos_ids ?? anterior.servicosIds) ? [...new Set((dados.servicosIds ?? dados.servicos_ids ?? anterior.servicosIds).map((id) => texto(id, 100)).filter(Boolean))] : [];

  const tipoProfissional = ['todos', 'especifico', 'selecionados'].includes(String(dados.tipoProfissional ?? anterior.tipoProfissional))
    ? String(dados.tipoProfissional ?? anterior.tipoProfissional)
    : ((dados.profissionalId ?? anterior.profissionalId) ? 'especifico' : 'todos');

  const profissionalId = tipoProfissional === 'especifico'
    ? texto(dados.profissionalId ?? anterior.profissionalId, 100)
    : '';

  const profissionalNome = tipoProfissional === 'especifico'
    ? texto(dados.profissionalNome ?? anterior.profissionalNome, 160)
    : '';

  const profissionaisIds = tipoProfissional === 'selecionados'
    ? (Array.isArray(dados.profissionaisIds ?? anterior.profissionaisIds)
        ? [...new Set((dados.profissionaisIds ?? anterior.profissionaisIds).map((id) => texto(id, 100)).filter(Boolean))]
        : [])
    : (tipoProfissional === 'especifico' && profissionalId ? [profissionalId] : []);

  const precosPorProfissional = (typeof (dados.precosPorProfissional ?? anterior.precosPorProfissional) === 'object' && (dados.precosPorProfissional ?? anterior.precosPorProfissional) !== null)
    ? Object.fromEntries(
        Object.entries(dados.precosPorProfissional ?? anterior.precosPorProfissional)
          .filter(([k, v]) => k && Number(v) > 0)
          .map(([k, v]) => [texto(k, 100), dinheiro(v)])
      )
    : {};

  const ehVip = Boolean(dados.ehVip ?? anterior.ehVip ?? (dados.nome && /vip/i.test(dados.nome)));
  const categoriaPlano = ['vip', 'recorrencia', 'pacote', 'padrao'].includes(String(dados.categoriaPlano ?? anterior.categoriaPlano))
    ? String(dados.categoriaPlano ?? anterior.categoriaPlano)
    : (ehVip ? 'vip' : 'recorrencia');

  return {
    nome: texto(dados.nome ?? anterior.nome, 140),
    descricao: texto(dados.descricao ?? anterior.descricao, 500),
    ciclo,
    regraRenovacao: ['aniversario','dias'].includes(dados.regraRenovacao ?? anterior.regraRenovacao) ? (dados.regraRenovacao ?? anterior.regraRenovacao) : 'dias',
    preco: dinheiro(dados.preco ?? anterior.preco),
    sessoesIncluidas: Math.max(1, Math.min(100, Math.round(numero(dados.sessoesIncluidas ?? dados.sessoes_incluidas ?? anterior.sessoesIncluidas, 1)))),
    validadeDias: Math.max(1, Math.min(730, Math.round(numero(dados.validadeDias ?? dados.validade_dias ?? anterior.validadeDias, ciclo === 'anual' ? 365 : ciclo === 'trimestral' ? 90 : 30)))),
    servicosIds,
    tipoProfissional,
    profissionalId,
    profissionalNome,
    profissionaisIds,
    precosPorProfissional,
    ehVip,
    categoriaPlano,
    // Parte da mensalidade (%) que vai para o pote de comissão dos profissionais.
    percentualPote: Math.min(100, Math.max(0, numero(dados.percentualPote ?? dados.percentual_pote ?? anterior.percentualPote, 0))),
    // Como o pote é dividido: pelo valor de tabela dos serviços usados ("valor_tabela")
    // ou em partes iguais por atendimento pelo plano ("atendimento", como era no Avec).
    rateioPote: ['valor_tabela', 'atendimento'].includes(String(dados.rateioPote ?? dados.rateio_pote ?? anterior.rateioPote)) ? String(dados.rateioPote ?? dados.rateio_pote ?? anterior.rateioPote) : 'valor_tabela',
    // Valor fixo (R$) pago ao profissional por atendimento feito pelo plano; soma ao pote, se houver.
    valorFixoPorUso: Math.max(0, dinheiro(dados.valorFixoPorUso ?? dados.valor_fixo_por_uso ?? anterior.valorFixoPorUso ?? 0)),
    ativo: dados.ativo ?? anterior.ativo ?? true,
  };
}

export function listarPlanos(empresaId, { incluirInativos = false } = {}) {
  const estado = estadoEmpresa(empresaId, false);
  return Object.values(estado.planos || {})
    .filter((item) => incluirInativos || item.ativo !== false)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((item) => {
      const plano = { ...item };
      if ((/5\s*proc|pacote\s*5/i.test(plano.nome) || Number(plano.sessoesIncluidas) === 5) && Number(plano.preco) === 400) {
        plano.preco = 425;
      }
      const profParam = plano.profissionalId ? `&prof=${encodeURIComponent(plano.profissionalId)}` : '';
      plano.linkAdesao = `/clube?plano=${encodeURIComponent(plano.id)}${profParam}`;
      plano.linkAdesaoCompleto = `https://kytto.com.br/clube?plano=${encodeURIComponent(plano.id)}${profParam}`;
      plano.linkAdmin = `https://kytto.com.br/admin/barbearia-erp?area=catalogo&tab=Planos+e+assinaturas&planoId=${encodeURIComponent(plano.id)}`;
      return plano;
    });
}

export function obterPlano(empresaId, planoId) {
  const plano = estadoEmpresa(empresaId, false).planos[String(planoId)];
  if (!plano) return null;
  const p = { ...plano };
  if ((/5\s*proc|pacote\s*5/i.test(p.nome) || Number(p.sessoesIncluidas) === 5) && Number(p.preco) === 400) {
    p.preco = 425;
  }
  const profParam = p.profissionalId ? `&prof=${encodeURIComponent(p.profissionalId)}` : '';
  p.linkAdesao = `/clube?plano=${encodeURIComponent(p.id)}${profParam}`;
  p.linkAdesaoCompleto = `https://kytto.com.br/clube?plano=${encodeURIComponent(p.id)}${profParam}`;
  p.linkAdmin = `https://kytto.com.br/admin/barbearia-erp?area=catalogo&tab=Planos+e+assinaturas&planoId=${encodeURIComponent(p.id)}`;
  return p;
}

export function criarPlano(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const plano = planoNormalizado(dados);
  if (!plano.nome) throw new Error('Nome do plano é obrigatório.');
  if (plano.preco < 0) throw new Error('Preço do plano não pode ser negativo.');
  if (plano.regraRenovacao==='aniversario'&&!plano.servicosIds.length) throw new Error('Selecione os serviços cobertos pelo pacote.');
  if (Object.values(estado.planos).some((item) => item.ativo !== false && item.nome.toLowerCase() === plano.nome.toLowerCase())) throw new Error('Já existe um plano ativo com este nome.');
  const servicoInvalido = plano.servicosIds.find((id) => !estado.servicos[id] || estado.servicos[id].ativo === false);
  if (servicoInvalido) throw new Error('O plano referencia um serviço inexistente ou inativo.');
  const id = novoId('plano', estado.planos);
  const agora = dataAtual();
  estado.planos[id] = { id, empresaId: String(empresaId), ...plano, criadoEm: agora, atualizadoEm: agora };
  save();
  return { ...estado.planos[id] };
}

export function atualizarPlano(empresaId, planoId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado.planos[String(planoId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;
  if (somenteAlternarAtivo(atual, dados)) return { ...atual };
  const plano = planoNormalizado(dados, atual);
  if (!plano.nome || plano.preco < 0) throw new Error('Nome e preço válido são obrigatórios para o plano.');
  if (plano.regraRenovacao==='aniversario'&&!plano.servicosIds.length) throw new Error('Selecione os serviços cobertos pelo pacote.');
  // Serviços que já estavam no plano podem ter sido desativados depois; só os novos precisam estar ativos.
  const jaNoPlano = new Set(atual.servicosIds || []);
  const servicoInvalido = plano.servicosIds.find((id) => !jaNoPlano.has(id) && (!estado.servicos[id] || estado.servicos[id].ativo === false));
  if (servicoInvalido) throw new Error('O plano referencia um serviço inexistente ou inativo.');
  for(const assinatura of Object.values(estado.assinaturas||{})){
    if(assinatura.planoId===atual.id&&!assinatura.condicoesContratadas) assinatura.condicoesContratadas=condicoesDoPlano(atual);
  }
  Object.assign(atual, plano, { atualizadoEm: dataAtual() });
  restaurarSeReativado(atual, dados);
  save();
  return { ...atual };
}

export function semearPacotesPadrao(empresaId) {
  const estado = estadoEmpresa(empresaId, false);
  if (!estado) return false;
  const planosExistentes = Object.values(estado.planos || {});
  const nomesExistentes = new Set(planosExistentes.map((p) => p.nome.toLowerCase()));

  const servicos = Object.values(estado.servicos || {});
  const idValido = (s) => s && s.ativo !== false;
  const srvNatiBrunoCorte = servicos.find((s) => idValido(s) && s.nome.toLowerCase().includes('corte') && s.nome.toLowerCase().includes('bruno'))?.id;
  const srvNatiBrunoBarba = servicos.find((s) => idValido(s) && s.nome.toLowerCase().includes('barba') && s.nome.toLowerCase().includes('bruno'))?.id;
  const srvDavidCorte = servicos.find((s) => idValido(s) && s.nome.toLowerCase().includes('corte') && s.nome.toLowerCase().includes('david'))?.id;
  const srvDavidBarba = servicos.find((s) => idValido(s) && s.nome.toLowerCase().includes('barba') && s.nome.toLowerCase().includes('david'))?.id;

  const pacotes = [
    {
      nome: 'Pacote 4 Procedimentos (Bruno e Nati)',
      preco: 360,
      sessoesIncluidas: 4,
      ciclo: 'mensal',
      validadeDias: 30,
      servicosIds: [srvNatiBrunoCorte, srvNatiBrunoBarba].filter(Boolean),
      descricao: 'Pacote mensal de 4 procedimentos com Bruno ou Nati. 10% de desconto sobre o valor avulso (de R$ 400 por R$ 360, economia de R$ 40).',
    },
    {
      nome: 'Pacote 6 Procedimentos (Bruno e Nati)',
      preco: 510,
      sessoesIncluidas: 6,
      ciclo: 'mensal',
      validadeDias: 30,
      servicosIds: [srvNatiBrunoCorte, srvNatiBrunoBarba].filter(Boolean),
      descricao: 'Pacote mensal de 6 procedimentos com Bruno ou Nati. 15% de desconto sobre o valor avulso (de R$ 600 por R$ 510, economia de R$ 90).',
    },
    {
      nome: 'Pacote 8 Procedimentos (Bruno e Nati)',
      preco: 640,
      sessoesIncluidas: 8,
      ciclo: 'mensal',
      validadeDias: 30,
      servicosIds: [srvNatiBrunoCorte, srvNatiBrunoBarba].filter(Boolean),
      descricao: 'Pacote mensal de 8 procedimentos com Bruno ou Nati. 20% de desconto sobre o valor avulso (de R$ 800 por R$ 640, economia de R$ 160).',
    },
    {
      nome: 'Pacote 4 Procedimentos (David)',
      preco: 288,
      sessoesIncluidas: 4,
      ciclo: 'mensal',
      validadeDias: 30,
      servicosIds: [srvDavidCorte, srvDavidBarba].filter(Boolean),
      descricao: 'Pacote mensal de 4 procedimentos com David. 10% de desconto sobre o valor avulso (de R$ 320 por R$ 288, economia de R$ 32).',
    },
    {
      nome: 'Pacote 6 Procedimentos (David)',
      preco: 408,
      sessoesIncluidas: 6,
      ciclo: 'mensal',
      validadeDias: 30,
      servicosIds: [srvDavidCorte, srvDavidBarba].filter(Boolean),
      descricao: 'Pacote mensal de 6 procedimentos com David. 15% de desconto sobre o valor avulso (de R$ 480 por R$ 408, economia de R$ 72).',
    },
    {
      nome: 'Pacote 8 Procedimentos (David)',
      preco: 512,
      sessoesIncluidas: 8,
      ciclo: 'mensal',
      validadeDias: 30,
      servicosIds: [srvDavidCorte, srvDavidBarba].filter(Boolean),
      descricao: 'Pacote mensal de 8 procedimentos com David. 20% de desconto sobre o valor avulso (de R$ 640 por R$ 512, economia de R$ 128).',
    },
  ];

  let adicionou = false;
  for (const pct of pacotes) {
    if (!nomesExistentes.has(pct.nome.toLowerCase())) {
      try {
        criarPlano(empresaId, pct);
        adicionou = true;
      } catch (err) {
        console.warn(`[barbearia] semear plano ${pct.nome}:`, err.message);
      }
    }
  }
  return adicionou;
}

export function semearPlanosVipDino(empresaId) {
  const estado = estadoEmpresa(empresaId, false);
  if (!estado) return false;
  const planosExistentes = Object.values(estado.planos || {});
  const nomesExistentes = new Set(planosExistentes.map((p) => p.nome.toLowerCase()));

  const profs = Object.values(estado.profissionais || {});
  const profDino = profs.find((p) => p.ativo !== false && (p.nome.toLowerCase().includes('guilherme') || p.nome.toLowerCase().includes('dino')));
  const profBruno = profs.find((p) => p.ativo !== false && p.nome.toLowerCase().includes('bruno'));
  const profDavid = profs.find((p) => p.ativo !== false && p.nome.toLowerCase().includes('david'));
  const profsEquipe = profs.filter((p) => p.ativo !== false && p.id !== profDino?.id);

  const servicos = Object.values(estado.servicos || {}).filter((s) => s.ativo !== false);
  const srvCorte = servicos.find((s) => s.nome.toLowerCase().includes('corte'))?.id;
  const srvBarba = servicos.find((s) => s.nome.toLowerCase().includes('barba'))?.id;
  let servicosIds = [srvCorte, srvBarba].filter(Boolean);
  if (!servicosIds.length) {
    if (servicos.length) {
      servicosIds = [servicos[0].id];
    } else {
      try {
        const srvCriado = criarServico(empresaId, {
          nome: 'Corte de Cabelo Tradicional',
          preco: 60,
          duracaoMinutos: 30,
        });
        servicosIds = [srvCriado.id];
      } catch (_) {
        servicosIds = [];
      }
    }
  }

  const pacotesVip = [
    {
      nome: 'Plano VIP Gold — Exclusivo Dino',
      preco: 600,
      sessoesIncluidas: 4,
      ciclo: 'mensal',
      validadeDias: 30,
      servicosIds,
      ehVip: true,
      categoriaPlano: 'vip',
      tipoProfissional: 'especifico',
      profissionalId: profDino?.id || '',
      profissionalNome: profDino?.nome || 'Dino (Guilherme Cunha Martins)',
      profissionaisIds: profDino ? [profDino.id] : [],
      descricao: 'Atendimento VIP e prioritário exclusivo com o Mestre Barbeiro Dino. 4 procedimentos mensais (Corte, Barba e Visagismo), flexibilidade de horários e padrão executivo.',
    },
    {
      nome: 'Plano VIP Silver — Equipe Barbearia Dino',
      preco: 250,
      sessoesIncluidas: 4,
      ciclo: 'mensal',
      validadeDias: 30,
      servicosIds,
      ehVip: true,
      categoriaPlano: 'vip',
      tipoProfissional: 'selecionados',
      profissionaisIds: profsEquipe.map((p) => p.id),
      precosPorProfissional: Object.fromEntries(profsEquipe.map((p) => [p.id, 250])),
      descricao: 'Plano VIP com a equipe de barbeiros especialistas da Dino (Bruno, David, Amanda, Gabi, Pacheco, Denis e Kauan). 4 procedimentos mensais com desconto especial.',
    },
    {
      nome: 'Clube Recorrência Barbearia Dino',
      preco: 220,
      sessoesIncluidas: 4,
      ciclo: 'mensal',
      validadeDias: 30,
      servicosIds,
      ehVip: false,
      categoriaPlano: 'recorrencia',
      tipoProfissional: 'todos',
      precosPorProfissional: {
        ...(profDino ? { [profDino.id]: 500 } : {}),
        ...(profBruno ? { [profBruno.id]: 220 } : {}),
        ...(profDavid ? { [profDavid.id]: 200 } : {}),
      },
      descricao: 'Assinatura mensal para manter o visual em dia. Preço diferenciado conforme o profissional escolhido: Dino R$ 500,00 | Equipe a partir de R$ 200,00.',
    },
  ];

  const resultado = [];
  for (const pct of pacotesVip) {
    let pExistente = planosExistentes.find((p) => p.nome.toLowerCase() === pct.nome.toLowerCase());
    if (!pExistente) {
      try {
        pExistente = criarPlano(empresaId, pct);
      } catch (err) {
        console.warn(`[barbearia] semear plano VIP ${pct.nome}:`, err.message);
      }
    }
    if (pExistente) resultado.push(pExistente);
  }
  return resultado;
}

function assinaturaNormalizada(dados = {}, anterior = {}, plano = {}) {
  const inicio = texto(dados.inicio ?? dados.inicioEm ?? anterior.inicio, 40) || dataAtual();
  const fim = texto(dados.fim ?? dados.fimEm ?? anterior.fim, 40);
  if (fim) intervaloValido(inicio, fim);
  const profissionalId = texto(dados.profissionalId ?? dados.profissional_id ?? anterior.profissionalId ?? plano.profissionalId, 100);
  const profissionalNome = texto(dados.profissionalNome ?? dados.profissional_nome ?? anterior.profissionalNome ?? plano.profissionalNome, 160);
  const precoContratado = (profissionalId && plano.precosPorProfissional?.[profissionalId])
    ? dinheiro(plano.precosPorProfissional[profissionalId])
    : dinheiro(dados.precoContratado ?? dados.preco ?? anterior.precoContratado ?? plano.preco);
  const ehVip = Boolean(dados.ehVip ?? anterior.ehVip ?? plano.ehVip);
  return {
    clienteId: texto(dados.clienteId ?? dados.cliente_id ?? anterior.clienteId, 100),
    clienteNome: texto(dados.clienteNome ?? dados.cliente_nome ?? anterior.clienteNome, 160),
    planoId: texto(dados.planoId ?? dados.plano_id ?? anterior.planoId, 100),
    regraRenovacao: ['aniversario','dias'].includes(dados.regraRenovacao ?? anterior.regraRenovacao ?? plano.regraRenovacao) ? (dados.regraRenovacao ?? anterior.regraRenovacao ?? plano.regraRenovacao) : 'dias',
    inicio,
    fim,
    status: STATUS_ASSINATURA.has(String(dados.status ?? anterior.status)) ? String(dados.status ?? anterior.status) : 'pendente_ativacao',
    sessoesContratadas: Math.max(0, Math.round(numero(dados.sessoesContratadas ?? anterior.sessoesContratadas, plano.sessoesIncluidas || 0))),
    sessoesUsadas: Math.max(0, Math.round(numero(dados.sessoesUsadas ?? anterior.sessoesUsadas, 0))),
    cobrancaAutomatica: false,
    pagamentoConfirmado: Boolean(dados.pagamentoConfirmado ?? anterior.pagamentoConfirmado ?? false),
    observacoes: texto(dados.observacoes ?? anterior.observacoes, 500),
    profissionalId,
    profissionalNome,
    precoContratado,
    ehVip,
    comandaId: texto(dados.comandaId ?? dados.comanda_id ?? anterior.comandaId, 120) || null,
    origem: texto(dados.origem ?? anterior.origem, 60) || null,
  };
}

export function listarAssinaturas(empresaId, filtros = {}) {
  const estado = estadoEmpresa(empresaId, false);
  return Object.values(estado.assinaturas || {})
    .filter((item) => !filtros.status || item.status === String(filtros.status))
    .filter((item) => !filtros.clienteId || item.clienteId === String(filtros.clienteId))
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .map((item) => {
      const ass = { ...item };
      ass.linkVinculo = `https://kytto.com.br/admin/barbearia-erp?area=catalogo&tab=Planos+e+assinaturas&assinaturaId=${encodeURIComponent(ass.id)}`;
      ass.linkExtrato = `https://kytto.com.br/perfil?aba=pacotes&assinatura=${encodeURIComponent(ass.id)}`;
      return ass;
    });
}

export function obterAssinatura(empresaId, assinaturaId) {
  const estado = estadoEmpresa(empresaId, false);
  const assinatura = estado.assinaturas?.[String(assinaturaId)];
  if (!assinatura) return null;
  const ass = { ...assinatura };
  ass.linkVinculo = `https://kytto.com.br/admin/barbearia-erp?area=catalogo&tab=Planos+e+assinaturas&assinaturaId=${encodeURIComponent(ass.id)}`;
  ass.linkExtrato = `https://kytto.com.br/perfil?aba=pacotes&assinatura=${encodeURIComponent(ass.id)}`;
  return ass;
}

function assinaturaHash(item) {
  return crypto.createHash('sha256').update(JSON.stringify(['clienteId','clienteNome','planoId','inicio','fim','sessoesContratadas','observacoes','regraRenovacao','profissionalId'].map(k=>item[k]??null))).digest('hex');
}

export function criarAssinatura(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const chave=texto(dados.chaveIdempotencia,160);
  const anterior=chave ? Object.values(estado.assinaturas).find(a=>a.chaveIdempotencia===chave) : null;
  if(anterior){
    const pedido=assinaturaNormalizada({...dados,inicio:dados.inicio??dados.inicioEm??anterior.inicio},{},anterior.condicoesContratadas||estado.planos[anterior.planoId]);
    if(anterior.condicoesContratadas?.regraRenovacao==='aniversario')pedido.inicio=subscriptionStart(pedido.inicio);
    if(assinaturaHash(pedido)!==anterior.solicitacaoHash)throw new Error('Esta solicitação já foi utilizada com dados diferentes. Recarregue o cadastro.');
    return {...structuredClone(anterior),idempotente:true};
  }
  const plano = estado.planos[String(dados.planoId ?? dados.plano_id)];
  if (!plano || plano.ativo === false) throw new Error('Plano ativo é obrigatório.');
  const assinatura = assinaturaNormalizada(dados, {}, plano);
  if (assinatura.regraRenovacao === 'aniversario') assinatura.inicio = subscriptionStart(assinatura.inicio);
  assinatura.condicoesContratadas = {...condicoesDoPlano(plano),regraRenovacao:assinatura.regraRenovacao};
  if(assinatura.regraRenovacao==='aniversario'){
    if(!plano.servicosIds.length)throw new Error('Configure os serviços cobertos no plano antes de contratar o pacote.');
    const cliente=clientesKytto.obterCliente(empresaId,assinatura.clienteId);
    if(!cliente||cliente.bloqueado||cliente.anonimizadoEm)throw new Error('Selecione um cliente ativo cadastrado nesta empresa.');
  }
  if (!assinatura.clienteId && !assinatura.clienteNome) throw new Error('Informe o cliente da assinatura.');
  if (assinatura.status === 'ativa') throw new Error('A assinatura deve ser criada como pendente de ativação; a ativação é uma ação separada e sem cobrança automática.');
  const id = novoId('ass', estado.assinaturas);
  const agora = dataAtual();
  estado.assinaturas[id] = { id, empresaId: String(empresaId), ...assinatura, ...(chave?{chaveIdempotencia:chave,solicitacaoHash:assinaturaHash(assinatura)}:{}), criadoEm: agora, atualizadoEm: agora };
  save();
  return { ...estado.assinaturas[id] };
}

export function alterarStatusAssinatura(empresaId, assinaturaId, status, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado.assinaturas[String(assinaturaId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;
  const novoStatus = String(status || '');
  if (!STATUS_ASSINATURA.has(novoStatus)) throw new Error('Status de assinatura inválido.');
  if (novoStatus === 'ativa' && dados.confirmadoSemCobranca !== true) throw new Error('A ativação exige confirmação explícita sem cobrança automática.');
  if (novoStatus !== atual.status && !TRANSICOES_ASSINATURA[atual.status]?.has(novoStatus)) throw new Error(`Transição de assinatura ${atual.status} para ${novoStatus} não permitida.`);
  Object.assign(atual, { status: novoStatus, pagamentoConfirmado: novoStatus === 'ativa' ? Boolean(dados.pagamentoConfirmado) : atual.pagamentoConfirmado, atualizadoEm: dataAtual() });
  save();
  return { ...atual };
}

function produtoRevendaNormalizado(dados = {}, anterior = {}) {
  const stockProvided = [dados.estoqueAtual, dados.estoque_atual].some((value) => value !== undefined && value !== null && value !== '');
  const estoqueInformado = typeof anterior.estoqueInformado === 'boolean'
    ? anterior.estoqueInformado
    : stockProvided || (anterior.estoqueAtual !== undefined && anterior.estoqueAtual !== null);
  return {
    lojaId: texto(dados.lojaId ?? dados.loja_id ?? anterior.lojaId, 120),
    nome: texto(dados.nome ?? anterior.nome, 140),
    sku: texto(dados.sku ?? anterior.sku, 80),
    // Código de barras (GTIN/EAN): casa o item da nota fiscal de entrada com o produto.
    ean: texto(dados.ean ?? dados.gtin ?? anterior.ean, 20).replace(/\D/g, ''),
    categoria: texto(dados.categoria ?? anterior.categoria, 80) || 'Revenda',
    fornecedorPadraoId: texto(dados.fornecedorPadraoId ?? dados.fornecedor_padrao_id ?? anterior.fornecedorPadraoId, 120),
    unidade: texto(dados.unidade ?? anterior.unidade, 20) || 'un',
    precoVenda: dinheiro(dados.precoVenda ?? dados.preco_venda ?? anterior.precoVenda),
    custoUnitario: dinheiro(dados.custoUnitario ?? dados.custo_unitario ?? anterior.custoUnitario),
    estoqueInformado,
    estoqueAtual: Math.max(0, Math.round(numero(dados.estoqueAtual ?? dados.estoque_atual ?? anterior.estoqueAtual, 0))),
    estoqueMinimo: Math.max(0, Math.round(numero(dados.estoqueMinimo ?? dados.estoque_minimo ?? anterior.estoqueMinimo, 0))),
    intervaloRecompraDias: Math.max(0, Math.min(3650, Math.round(numero(dados.intervaloRecompraDias ?? dados.intervalo_recompra_dias ?? anterior.intervaloRecompraDias, 30)))),
    ativo: dados.ativo ?? anterior.ativo ?? true,
  };
}

function statusEstoque(item) {
  if (Number(item.estoqueAtual || 0) <= 0) return 'sem_estoque';
  if (Number(item.estoqueAtual || 0) <= Number(item.estoqueMinimo || 0)) return 'baixo';
  return 'ok';
}

export function listarProdutosRevenda(empresaId, { incluirInativos = false, lojaId = '', incluirSemLoja = false } = {}) {
  const estado = estadoEmpresa(empresaId, false);
  const knownStockProductIds = new Set(Object.values(estado.movimentosEstoque || {}).map((movement) => String(movement.produtoId || '')));
  return Object.values(estado.produtosRevenda)
    .filter((item) => incluirInativos || item.ativo !== false)
    .filter((item) => !lojaId || item.lojaId === String(lojaId) || (incluirSemLoja && !item.lojaId))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((item) => ({ ...item, estoqueInformado: typeof item.estoqueInformado === 'boolean' ? item.estoqueInformado : knownStockProductIds.has(String(item.id)), statusEstoque: statusEstoque(item) }));
}

export function criarProdutoRevenda(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const produto = produtoRevendaNormalizado(dados);
  if (!produto.nome) throw new Error('Nome do produto de revenda é obrigatório.');
  if (produto.precoVenda < 0) throw new Error('Preço de venda não pode ser negativo.');
  if (Object.values(estado.produtosRevenda).some((item) => item.ativo !== false
    && item.nome.toLowerCase() === produto.nome.toLowerCase()
    && item.lojaId === produto.lojaId)) throw new Error('Já existe produto ativo de revenda com este nome nesta unidade.');
  const id = novoId('rev', estado.produtosRevenda);
  const agora = dataAtual();
  estado.produtosRevenda[id] = { id, empresaId: String(empresaId), ...produto, criadoEm: agora, atualizadoEm: agora };
  if (produto.estoqueAtual > 0) {
    const movimentoId = novoId('mov', estado.movimentosEstoque);
    estado.movimentosEstoque[movimentoId] = { id: movimentoId, empresaId: String(empresaId), lojaId: produto.lojaId || null, produtoId: id, tipo: 'entrada_inicial', quantidade: produto.estoqueAtual, estoqueAnterior: 0, estoquePosterior: produto.estoqueAtual, observacao: 'Estoque inicial informado no cadastro.', criadoEm: agora };
  }
  save();
  return { ...estado.produtosRevenda[id], statusEstoque: statusEstoque(estado.produtosRevenda[id]) };
}

export function atualizarProdutoRevenda(empresaId, produtoId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado.produtosRevenda[String(produtoId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;
  const lojaId = texto(dados.lojaId ?? dados.loja_id, 120);
  // Produtos importados do Avec guardam a unidade pelo id legado; ele equivale ao canônico.
  const mesmaUnidade = !lojaId || !atual.lojaId || atual.lojaId === lojaId
    || legacyLojaIdFromCommerce(atual.lojaId, empresaId) === legacyLojaIdFromCommerce(lojaId, empresaId);
  if (!mesmaUnidade) return null;
  if (somenteAlternarAtivo(atual, dados)) return { ...atual, statusEstoque: statusEstoque(atual) };
  const produto = produtoRevendaNormalizado({ ...dados, lojaId: atual.lojaId || lojaId }, atual);
  if (!produto.nome || produto.precoVenda < 0) throw new Error('Nome e preço válido são obrigatórios para o produto.');
  if (produto.estoqueAtual !== atual.estoqueAtual) throw new Error('Use o endpoint de ajuste para alterar estoque e manter o histórico.');
  Object.assign(atual, produto, { atualizadoEm: dataAtual() });
  restaurarSeReativado(atual, dados);
  save();
  return { ...atual, statusEstoque: statusEstoque(atual) };
}

export function ajustarEstoqueRevenda(empresaId, produtoId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const produto = estado.produtosRevenda[String(produtoId)];
  if (!produto || produto.empresaId !== String(empresaId)) return null;
  const lojaId = texto(dados.lojaId ?? dados.loja_id, 120);
  if (lojaId && produto.lojaId && produto.lojaId !== lojaId) return null;
  const tipo = String(dados.tipo || 'ajuste');
  const quantidade = Math.round(numero(dados.quantidade ?? dados.qtd, NaN));
  if (!Number.isFinite(quantidade) || quantidade <= 0) throw new Error('Quantidade positiva é obrigatória.');
  if (!['entrada', 'saida_manual', 'ajuste'].includes(tipo)) throw new Error('Tipo de movimento inválido.');
  const anterior = Number(produto.estoqueAtual || 0);
  const posterior = tipo === 'entrada' ? anterior + quantidade : tipo === 'saida_manual' ? anterior - quantidade : quantidade;
  if (posterior < 0) throw new Error('Estoque insuficiente para esta saída.');
  const agora = dataAtual();
  const movimentoId = novoId('mov', estado.movimentosEstoque);
  estado.movimentosEstoque[movimentoId] = { id: movimentoId, empresaId: String(empresaId), lojaId: produto.lojaId || lojaId || null, produtoId: produto.id, tipo, quantidade, estoqueAnterior: anterior, estoquePosterior: posterior, observacao: texto(dados.observacao ?? dados.motivo, 300), criadoEm: agora };
  produto.estoqueAtual = posterior;
  produto.estoqueInformado = true;
  produto.atualizadoEm = agora;
  produto.ultimoMovimentoEm = agora;
  save();
  return { produto: { ...produto, statusEstoque: statusEstoque(produto) }, movimento: { ...estado.movimentosEstoque[movimentoId] } };
}

// Entrada de mercadoria (recebimento de compra ou nota fiscal de entrada): soma ao
// saldo, recalcula o custo médio ponderado e registra o movimento com a origem.
// Idempotente pela chave: reprocessar a mesma nota não duplica o estoque.
export function entradaEstoqueRevenda(empresaId, produtoId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const produto = estado.produtosRevenda[String(produtoId)];
  if (!produto || produto.empresaId !== String(empresaId)) throw new Error('Produto de revenda não encontrado.');
  const lojaId = texto(dados.lojaId ?? dados.loja_id, 120);
  if (lojaId && produto.lojaId && produto.lojaId !== lojaId) throw new Error('Produto de revenda não pertence à unidade ativa.');
  const quantidade = Math.round(numero(dados.quantidade, NaN));
  if (!Number.isFinite(quantidade) || quantidade <= 0) throw new Error('Quantidade de entrada deve ser positiva.');
  const chave = texto(dados.chaveIdempotencia, 220);
  if (chave) {
    const repetido = Object.values(estado.movimentosEstoque).find((item) => item.chaveIdempotencia === chave);
    if (repetido) return { produto: { ...produto, statusEstoque: statusEstoque(produto) }, movimento: { ...repetido }, repetido: true };
  }
  const custoEntrada = dados.custoUnitario === undefined || dados.custoUnitario === null || dados.custoUnitario === '' ? null : dinheiro(dados.custoUnitario);
  if (custoEntrada !== null && custoEntrada < 0) throw new Error('Custo unitário não pode ser negativo.');
  const anterior = Math.max(0, Number(produto.estoqueAtual || 0));
  const custoAnterior = Number(produto.custoUnitario || 0);
  const posterior = anterior + quantidade;
  if (custoEntrada !== null) {
    produto.custoUltimaCompra = custoEntrada;
    produto.custoUnitario = anterior > 0 && custoAnterior > 0
      ? Number(((anterior * custoAnterior + quantidade * custoEntrada) / posterior).toFixed(4))
      : custoEntrada;
  }
  const agora = dataAtual();
  const movimentoId = novoId('mov', estado.movimentosEstoque);
  estado.movimentosEstoque[movimentoId] = {
    id: movimentoId,
    empresaId: String(empresaId),
    lojaId: produto.lojaId || lojaId || null,
    produtoId: produto.id,
    tipo: 'entrada_compra',
    quantidade,
    estoqueAnterior: anterior,
    estoquePosterior: posterior,
    custoUnitario: custoEntrada,
    custoMedioAnterior: custoAnterior,
    custoMedioPosterior: Number(produto.custoUnitario || 0),
    origem: texto(dados.origem, 40) || 'compra',
    referencia: texto(dados.referencia, 160) || null,
    fornecedorId: texto(dados.fornecedorId, 120) || null,
    chaveIdempotencia: chave || null,
    observacao: texto(dados.observacao, 300),
    usuario: texto(dados.usuario, 160) || null,
    criadoEm: agora,
  };
  produto.estoqueAtual = posterior;
  produto.estoqueInformado = true;
  if (dados.fornecedorId) produto.fornecedorPadraoId = texto(dados.fornecedorId, 120);
  produto.atualizadoEm = agora;
  produto.ultimoMovimentoEm = agora;
  save();
  return { produto: { ...produto, statusEstoque: statusEstoque(produto) }, movimento: { ...estado.movimentosEstoque[movimentoId] } };
}

// Custo do material de um atendimento: valor fixo do serviço, ou a soma do custo
// dos insumos da ficha técnica (quantidade × custo médio do produto).
export function custoMaterialServicoEstado(estado, servicoId) {
  const servico = estado.servicos[String(servicoId || '')];
  if (!servico) return 0;
  if (servico.custoMaterial !== null && servico.custoMaterial !== undefined) return dinheiro(servico.custoMaterial);
  return dinheiro((servico.consumoInterno || []).reduce((soma, insumo) => {
    const produto = estado.produtosRevenda[insumo.produtoId];
    return soma + Number(insumo.quantidade || 0) * Number(produto?.custoUnitario || 0);
  }, 0));
}

export function custoMaterialServico(empresaId, servicoId) {
  return custoMaterialServicoEstado(estadoEmpresa(empresaId, false), servicoId);
}

export function listarMovimentosEstoque(empresaId, filtros = {}) {
  return Object.values(estadoEmpresa(empresaId, false).movimentosEstoque)
    .filter((item) => !filtros.produtoId || item.produtoId === String(filtros.produtoId))
    .filter((item) => !filtros.lojaId || item.lojaId === String(filtros.lojaId))
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .map((item) => ({ ...item }));
}

function itensVendaNormalizados(estado, empresaId, itens = [], lojaId = '') {
  if (!Array.isArray(itens) || itens.length === 0) throw new Error('A venda deve conter pelo menos um produto.');
  const normalizados = itens.map((item) => {
    const produtoId = String(item?.produtoId || item?.produto_id || '');
    const produto = estado.produtosRevenda[produtoId];
    const quantidade = Math.round(numero(item?.quantidade ?? item?.qtd, NaN));
    if (!produto || produto.empresaId !== String(empresaId) || (lojaId && produto.lojaId && produto.lojaId !== String(lojaId))) throw new Error('Produto de revenda inválido para a empresa/unidade ativa.');
    if (produto.ativo === false) throw new Error(`Produto inativo: ${produto.nome}.`);
    if (!Number.isFinite(quantidade) || quantidade <= 0) throw new Error('Quantidade positiva é obrigatória para cada produto.');
    return { produtoId, nome: produto.nome, unidade: produto.unidade, quantidade, precoUnitario: produto.precoVenda, subtotal: dinheiro(produto.precoVenda * quantidade) };
  });
  return normalizados;
}

function estoqueVendaDisponivel(estado, itens) {
  const porProduto = new Map();
  for (const item of itens) porProduto.set(item.produtoId, (porProduto.get(item.produtoId) || 0) + item.quantidade);
  for (const [produtoId, quantidade] of porProduto) {
    const produto = estado.produtosRevenda[produtoId];
    if (Number(produto.estoqueAtual || 0) < quantidade) throw new Error(`Estoque insuficiente para ${produto.nome} (disponível: ${produto.estoqueAtual || 0}).`);
  }
}

export function listarVendasRevenda(empresaId, filtros = {}) {
  return Object.values(estadoEmpresa(empresaId, false).vendasRevenda)
    .filter((item) => !filtros.status || item.status === String(filtros.status))
    .filter((item) => !filtros.data || String(item.criadoEm).slice(0, 10) === String(filtros.data).slice(0, 10))
    .filter((item) => !filtros.profissionalId || item.profissionalId === String(filtros.profissionalId))
    .filter((item) => !filtros.lojaId || item.lojaId === String(filtros.lojaId))
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .map((item) => ({ ...item, itens: item.itens.map((linha) => ({ ...linha })) }));
}

export function obterVendaRevenda(empresaId, vendaId, { lojaId = '' } = {}) {
  const venda = estadoEmpresa(empresaId, false).vendasRevenda[String(vendaId)];
  if (!venda || venda.empresaId !== String(empresaId) || (lojaId && venda.lojaId !== String(lojaId))) return null;
  return { ...venda, itens: venda.itens.map((item) => ({ ...item })) };
}

export function criarVendaRevenda(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const chaveIdempotencia = texto(dados.chaveIdempotencia ?? dados.chave_idempotencia, 220);
  const lojaId = texto(dados.lojaId ?? dados.loja_id, 120);
  if (chaveIdempotencia) {
    const existente = Object.values(estado.vendasRevenda).find((item) => item.chaveIdempotencia === chaveIdempotencia);
    if (existente) {
      if (lojaId && existente.lojaId !== lojaId) throw Object.assign(new Error('A chave de idempotência já foi usada em outra unidade.'), { code: 'IDEMPOTENCY_CONFLICT' });
      return { ...existente, itens: existente.itens.map((item) => ({ ...item })) };
    }
  }
  const itens = itensVendaNormalizados(estado, empresaId, dados.itens, lojaId);
  const profissionalId = resolverProfissionalIdSeguro(estado, texto(dados.profissionalId ?? dados.profissional_id, 120));
  if (profissionalId) {
    const p = estado.profissionais[profissionalId];
    if (p && /bruno/i.test(p.nome || '') && !/bruno rafael/i.test(p.nome || '') && p.ativo === false) {
      p.ativo = true;
      p.removidoEm = null;
      p.excluido = false;
    }
    if (!p || p.ativo === false) throw new Error('Profissional responsável não encontrado ou inativo.');
  }
  const agora = dataAtual();
  const id = novoId('vrev', estado.vendasRevenda);
  const venda = {
    id,
    empresaId: String(empresaId),
    lojaId,
    clienteId: texto(dados.clienteId ?? dados.cliente_id, 120),
    clienteNome: texto(dados.clienteNome ?? dados.cliente_nome, 160),
    profissionalId,
    observacao: texto(dados.observacao ?? dados.obs, 300),
    itens,
    total: dinheiro(itens.reduce((total, item) => total + item.subtotal, 0)),
    status: 'aguardando_pagamento',
    estoqueBaixado: false,
    pagamento: null,
    financeiroLancamentoId: null,
    chaveIdempotencia: chaveIdempotencia || null,
    reservasEstoqueIds: [],
    inventoryReservationIds: [],
    reservaEstoqueStatus: 'sem_necessidade',
    reservaEstoqueExpiresAt: expiresReservaOperacao(dados.expiresAt ?? dados.expires_at),
    reservaEstoqueBloqueio: null,
    criadoEm: agora,
    atualizadoEm: agora,
  };
  const snapshotReserva = raizSnapshot();
  try {
    estado.vendasRevenda[id] = venda;
    sincronizarReservasOperacao(empresaId, venda, estado, { origem: 'venda_revenda', expiresAt: dados.expiresAt ?? dados.expires_at });
  } catch (error) {
    restaurarRaiz(snapshotReserva);
    throw error;
  }
  save();
  return { ...venda, itens: venda.itens.map((item) => ({ ...item })) };
}

export function finalizarVendaRevenda(empresaId, vendaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const venda = estado.vendasRevenda[String(vendaId)];
  if (!venda || venda.empresaId !== String(empresaId)) return null;
  const lojaId = texto(dados.lojaId ?? dados.loja_id, 120);
  if (lojaId && venda.lojaId !== lojaId) return null;
  if (venda.status === 'cancelada') throw Object.assign(new Error('Venda cancelada não pode ser finalizada.'), { code: 'SALE_CANCELLED', status: 409 });
  if (venda.status === 'pago') return { ...venda, itens: venda.itens.map((item) => ({ ...item })) };
  if (dados.confirmadoPagamento !== true) throw new Error('A confirmação explícita do pagamento é obrigatória.');
  const meioPagamento = texto(dados.meioPagamento ?? dados.meio_pagamento, 40).toLowerCase();
  if (!meioPagamento) throw new Error('Meio de pagamento é obrigatório.');
  const valorRecebido = dinheiro(dados.valorRecebido ?? dados.valor_recebido, venda.total);
  if (valorRecebido !== venda.total) throw new Error(`Valor recebido deve ser ${venda.total.toFixed(2)}.`);
  estoqueVendaDisponivel(estado, venda.itens);
  const reservaComitada = commitarReservasOperacao(empresaId, venda, estado);
  const agora = dataAtual();
  const financeiro = financeiroKytto.registrarLancamento(empresaId, {
    tipo: 'receita',
    categoria: 'Barbearia - Revenda',
    descricao: `Revenda Barbearia ${venda.id}`,
    valor: venda.total,
    origem: 'barbearia_revenda',
    status: 'pago',
    dataOperacao: agora,
    pagoEm: agora,
    meioPagamento,
    lojaId: venda.lojaId || lojaId || null,
    usuario: dados.usuario,
    referencia: { pedidoId: venda.id },
    chaveIdempotencia: `barbearia_revenda:${empresaId}:${venda.id}`,
  });
  if (!reservaComitada.committed) for (const item of venda.itens) {
    const produto = estado.produtosRevenda[item.produtoId];
    const anterior = Number(produto.estoqueAtual || 0);
    produto.estoqueAtual = anterior - item.quantidade;
    produto.atualizadoEm = agora;
    produto.ultimoMovimentoEm = agora;
    const movimentoId = novoId('mov', estado.movimentosEstoque);
    estado.movimentosEstoque[movimentoId] = { id: movimentoId, empresaId: String(empresaId), lojaId: produto.lojaId || venda.lojaId || lojaId || null, produtoId: produto.id, tipo: 'saida_venda', quantidade: item.quantidade, estoqueAnterior: anterior, estoquePosterior: produto.estoqueAtual, vendaId: venda.id, observacao: `Baixa da venda ${venda.id}.`, criadoEm: agora };
  }
  Object.assign(venda, { status: 'pago', estoqueBaixado: true, pagamento: { meioPagamento, valorRecebido, confirmadoEm: agora }, financeiroLancamentoId: financeiro.id, atualizadoEm: agora });
  save();
  return { ...venda, itens: venda.itens.map((item) => ({ ...item })) };
}

export function cancelarVendaRevenda(empresaId, vendaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const venda = estado.vendasRevenda[String(vendaId)];
  if (!venda || venda.empresaId !== String(empresaId)) return null;
  const lojaId = texto(dados.lojaId ?? dados.loja_id, 120);
  if (lojaId && venda.lojaId !== lojaId) return null;
  if (venda.status === 'pago') throw Object.assign(new Error('Venda já paga não pode ser cancelada neste fluxo.'), { code: 'SALE_ALREADY_PAID', status: 409 });
  if (venda.status === 'cancelada') return { ...venda, itens: venda.itens.map((item) => ({ ...item })), idempotente: true };
  const snapshot = raizSnapshot();
  try {
    liberarReservasOperacao(empresaId, venda, estado, 'cancelamento_venda');
    venda.status = 'cancelada';
    venda.canceladaEm = dataAtual();
    venda.motivoCancelamento = texto(dados.motivo ?? dados.reason, 300);
    venda.atualizadoEm = venda.canceladaEm;
    save();
    return { ...venda, itens: venda.itens.map((item) => ({ ...item })) };
  } catch (error) {
    restaurarRaiz(snapshot);
    throw error;
  }
}

function copiarComandaBarbearia(comanda, idempotente = false) {
  if (!comanda) return null;
  const subtotal = Number((comanda.itens || []).reduce((soma, item) => soma + Number(item.subtotal || 0), 0).toFixed(2));
  const desconto = Number(Math.min(subtotal, Math.max(0, Number(comanda.desconto || 0))).toFixed(2));
  const gorjeta = Number(Math.max(0, Number(comanda.gorjeta || 0)).toFixed(2));
  const total = Number(Math.max(0, subtotal - desconto + gorjeta).toFixed(2));
  return {
    ...identidadeCliente(comanda),
    subtotal,
    desconto,
    gorjeta,
    total,
    totalFaturado: Number((comanda.totalFaturado ?? (comanda.pagamentos || []).reduce((soma, item) => soma + Number(item.valor || 0), 0)).toFixed(2)),
    totalPago: Number((comanda.totalPago ?? (comanda.pagamentos || []).filter((item) => item.meio !== 'conta').reduce((soma, item) => soma + Number(item.valor || 0), 0)).toFixed(2)),
    saldoPendente: Number(Math.max(0, total - Number(comanda.totalFaturado ?? 0)).toFixed(2)),
    itens: (comanda.itens || []).map((item) => ({ ...item })),
    pagamentos: (comanda.pagamentos || []).map(({ idempotenciaFingerprint: _idempotenciaFingerprint, ...item }) => ({ ...item })),
    financeiroLancamentoIds: [...(comanda.financeiroLancamentoIds || [])],
    contasReceberIds: [...(comanda.contasReceberIds || [])],
    idempotente,
  };
}

function itemLojaComandaNormalizado(estado, comanda, dados = {}) {
  // Item da loja virtual (Commerce). Os dados vêm do servidor, que consulta o
  // catálogo e o estoque da loja da unidade; nunca do corpo da requisição.
  const loja = dados.itemLoja;
  if (!loja || typeof loja !== 'object' || loja.verificadoPeloServidor !== true) throw new Error('Produto da loja não verificado. Busque o produto pelo catálogo da loja.');
  const quantidade = Math.max(1, Math.round(numero(dados.quantidade ?? dados.qtd, 1)));
  const precoUnitario = dinheiro(loja.preco);
  if (precoUnitario <= 0) throw new Error(`O produto ${texto(loja.nome, 120)} não tem preço ativo na loja.`);
  if (Number(loja.disponivel || 0) < quantidade) throw new Error(`Estoque insuficiente na loja para ${texto(loja.nome, 120)} (disponível: ${Number(loja.disponivel || 0)}).`);
  const profissionalId = resolverProfissionalIdSeguro(estado, texto(dados.profissionalId ?? dados.profissional_id ?? comanda.profissionalId, 120));
  if (profissionalId) {
    const p = estado.profissionais[profissionalId];
    if (p && /bruno/i.test(p.nome || '') && !/bruno rafael/i.test(p.nome || '') && p.ativo === false) {
      p.ativo = true;
      p.removidoEm = null;
      p.excluido = false;
    }
    if (!p || p.ativo === false) throw new Error('Profissional responsável não encontrado ou inativo.');
  }
  return {
    id: novoIdItemComanda(),
    tipo: 'loja',
    servicoId: null,
    produtoId: null,
    lojaVarianteId: texto(loja.variantId, 60),
    lojaProdutoId: texto(loja.productId, 60),
    lojaLocalEstoqueId: texto(loja.locationId, 60),
    sku: texto(loja.sku, 80),
    nome: texto(loja.nome, 160),
    categoria: texto(loja.categoria, 100) || 'Loja',
    quantidade,
    precoUnitario,
    subtotal: dinheiro(precoUnitario * quantidade),
    duracaoMinutos: 0,
    profissionalId: profissionalId || null,
    estoqueLoja: { status: 'pendente', movimento: null, erro: null, atualizadoEm: null },
    observacao: texto(dados.observacao ?? dados.obs, 400),
    criadoEm: dataAtual(),
  };
}

function itemComandaBarbeariaNormalizado(estado, comanda, dados = {}) {
  let tipo = String(dados.tipo || (dados.servicoId || dados.servico_id ? 'servico' : 'produto')).toLowerCase();
  if (tipo === 'bebida' || tipo === 'bar') {
    const idBeb = String(dados.itemId || dados.produtoId || dados.produto_id || '').trim();
    const prodBeb = estado.produtosRevenda[idBeb] || Object.values(estado.produtosRevenda || {}).find(p => p.id === idBeb || p.nome.toLowerCase() === String(dados.nome || '').toLowerCase());
    if (prodBeb) {
      tipo = 'produto';
      dados.produtoId = prodBeb.id;
      dados.itemId = prodBeb.id;
    } else {
      tipo = 'outro';
      dados.categoria = 'Bebidas & Bar';
    }
  }
  if (tipo === 'loja') return itemLojaComandaNormalizado(estado, comanda, dados);
  // Suporte a Pacotes e Planos de Procedimentos na comanda
  if (tipo === 'pacote' || tipo === 'plano') {
    const id = String(dados.itemId || dados.planoId || dados.plano_id || dados.pacoteId || '').trim();
    const quantidade = Math.max(1, Math.round(numero(dados.quantidade ?? dados.qtd, 1)));
    const plano = estado.planos?.[id] || Object.values(estado.planos || {}).find((p) => p.id === id || p.nome === dados.nome);
    const precoUnitario = dados.preco !== undefined ? dinheiro(dados.preco) : dinheiro(plano?.preco || 0);
    if (precoUnitario < 0) throw new Error('O pacote não pode ter preço negativo.');
    const profissionalId = resolverProfissionalIdSeguro(estado, texto(dados.profissionalId ?? dados.profissional_id ?? comanda.profissionalId, 120));
    if (profissionalId) {
      const p = estado.profissionais[profissionalId];
      if (p && /bruno/i.test(p.nome || '') && !/bruno rafael/i.test(p.nome || '') && p.ativo === false) {
        p.ativo = true;
        p.removidoEm = null;
        p.excluido = false;
      }
      if (!p || p.ativo === false) {
        throw new Error('Profissional responsável não encontrado ou inativo.');
      }
    }
    const nome = texto(dados.nome || plano?.nome || 'Pacote de Procedimentos', 160);
    return {
      id: novoIdItemComanda(),
      tipo: 'pacote',
      servicoId: null,
      produtoId: null,
      planoId: plano?.id || id || null,
      nome,
      categoria: texto(plano?.categoriaPlano || 'Pacotes e Planos', 100),
      quantidade,
      precoUnitario,
      subtotal: dinheiro(precoUnitario * quantidade),
      duracaoMinutos: 0,
      profissionalId: profissionalId || null,
      observacao: texto(dados.observacao ?? dados.obs ?? (plano?.descricao || ''), 400),
      criadoEm: dataAtual(),
    };
  }
  // Suporte a Outro item / Taxa / Serviço avulso na comanda
  if (tipo === 'outro' || tipo === 'avulso') {
    const quantidade = Math.max(1, Math.round(numero(dados.quantidade ?? dados.qtd, 1)));
    const precoUnitario = dinheiro(dados.preco ?? dados.precoUnitario ?? dados.valor ?? 0);
    if (precoUnitario < 0) throw new Error('O item não pode ter preço negativo.');
    const nome = texto(dados.nome || dados.descricao || dados.detalhe || 'Outro item / Taxa', 160);
    const profissionalId = resolverProfissionalIdSeguro(estado, texto(dados.profissionalId ?? dados.profissional_id ?? comanda.profissionalId, 120));
    if (profissionalId) {
      const p = estado.profissionais[profissionalId];
      if (p && /bruno/i.test(p.nome || '') && !/bruno rafael/i.test(p.nome || '') && p.ativo === false) {
        p.ativo = true;
        p.removidoEm = null;
        p.excluido = false;
      }
      if (!p || p.ativo === false) {
        throw new Error('Profissional responsável não encontrado ou inativo.');
      }
    }
    return {
      id: novoIdItemComanda(),
      tipo: 'outro',
      servicoId: null,
      produtoId: null,
      nome,
      categoria: texto(dados.categoria || 'Outros', 100),
      quantidade,
      precoUnitario,
      subtotal: dinheiro(precoUnitario * quantidade),
      duracaoMinutos: 0,
      profissionalId: profissionalId || null,
      observacao: texto(dados.observacao ?? dados.obs ?? dados.detalhe, 400),
      criadoEm: dataAtual(),
    };
  }
  const id = String(dados.itemId || dados.servicoId || dados.servico_id || dados.produtoId || dados.produto_id || '').trim();
  const quantidade = Math.max(1, Math.round(numero(dados.quantidade ?? dados.qtd, 1)));
  if (!id) throw new Error('Informe o serviço ou produto do item.');
  if (!['servico', 'produto'].includes(tipo)) throw new Error('Tipo de item inválido.');
  const cadastro = tipo === 'servico' ? estado.servicos[id] : estado.produtosRevenda[id];
  if (!cadastro || cadastro.empresaId !== String(comanda.empresaId) || cadastro.ativo === false) throw new Error(`${tipo === 'servico' ? 'Serviço' : 'Produto'} não encontrado ou inativo na empresa ativa.`);
  if (tipo === 'produto' && comanda.lojaId && cadastro.lojaId && cadastro.lojaId !== comanda.lojaId) throw new Error('Produto de revenda não pertence à unidade da comanda.');
  const profissionalId = resolverProfissionalIdSeguro(estado, texto(dados.profissionalId ?? dados.profissional_id ?? comanda.profissionalId, 120));
  if (profissionalId) {
    const p = estado.profissionais[profissionalId];
    if (p && /bruno/i.test(p.nome || '') && !/bruno rafael/i.test(p.nome || '') && p.ativo === false) {
      p.ativo = true;
      p.removidoEm = null;
      p.excluido = false;
    }
    if (!p || p.ativo === false) throw new Error('Profissional responsável não encontrado ou inativo.');
  }
  const precoUnitario = dinheiro(tipo === 'servico' ? cadastro.preco : cadastro.precoVenda);
  if (precoUnitario < 0) throw new Error('O item não pode ter preço negativo.');
  if (tipo === 'produto' && Number(cadastro.estoqueAtual || 0) < quantidade && cadastro.bloquearSemEstoque === true) {
    throw new Error(`Estoque insuficiente para ${cadastro.nome} (disponível: ${cadastro.estoqueAtual || 0}).`);
  }
  // Cobertura de plano: preparada e validada pelo servidor (barbearia-comanda-plano.js).
  const cobertura = tipo === 'servico' && dados.coberturaPlano && dados.coberturaPlano.verificadoPeloServidor === true ? dados.coberturaPlano : null;
  if (cobertura && quantidade !== 1) throw new Error('Item coberto pelo plano entra com quantidade 1 por linha.');
  return {
    id: dados.id ? texto(dados.id, 120) : novoIdItemComanda(),
    tipo,
    servicoId: tipo === 'servico' ? cadastro.id : null,
    produtoId: tipo === 'produto' ? cadastro.id : null,
    nome: texto(cadastro.nome, 160),
    categoria: texto(cadastro.categoria, 100),
    quantidade,
    precoUnitario,
    // Coberto pelo plano: o preço de tabela fica registrado, mas a linha não soma na conta.
    subtotal: cobertura ? 0 : dinheiro(precoUnitario * quantidade),
    ...(cobertura ? {
      coberturaPlano: {
        assinaturaId: texto(cobertura.assinaturaId, 120),
        planoId: texto(cobertura.planoId, 120),
        planoNome: texto(cobertura.planoNome, 160),
        valorAbatido: dinheiro(precoUnitario * quantidade),
        usoId: null,
        consumidoEm: null,
      },
    } : {}),
    agendamentoId: texto(dados.agendamentoId ?? dados.agendamento_id, 120) || null,
    duracaoMinutos: tipo === 'servico' ? Number(cadastro.duracaoMinutos || 0) : 0,
    profissionalId: profissionalId || null,
    observacao: texto(dados.observacao ?? dados.obs, 400),
    criadoEm: dataAtual(),
  };
}

function planejarConsumoInternoComanda(estado, comanda) {
  const porProduto = new Map();
  for (const item of comanda.itens || []) {
    if (item.tipo !== 'servico' || !item.servicoId) continue;
    const servico = estado.servicos[item.servicoId];
    for (const insumo of servico?.consumoInterno || []) {
      const produtoId = String(insumo.produtoId || '');
      const quantidade = Math.max(1, Math.round(numero(insumo.quantidade, 1))) * Math.max(1, Math.round(numero(item.quantidade, 1)));
      if (!produtoId || quantidade <= 0) continue;
      const atual = porProduto.get(produtoId) || { produtoId, quantidade: 0, servicoIds: [] };
      atual.quantidade += quantidade;
      if (!atual.servicoIds.includes(item.servicoId)) atual.servicoIds.push(item.servicoId);
      porProduto.set(produtoId, atual);
    }
  }
  return [...porProduto.values()];
}

function validarEstoqueComandaBarbearia(estado, comanda, consumoPlanejado = planejarConsumoInternoComanda(estado, comanda)) {
  const quantidades = new Map();
  for (const item of comanda.itens || []) {
    if (item.tipo !== 'produto' || !item.produtoId) continue;
    quantidades.set(item.produtoId, (quantidades.get(item.produtoId) || 0) + Number(item.quantidade || 0));
  }
  for (const consumo of consumoPlanejado) quantidades.set(consumo.produtoId, (quantidades.get(consumo.produtoId) || 0) + consumo.quantidade);
  for (const [produtoId, quantidade] of quantidades) {
    const produto = estado.produtosRevenda[produtoId];
    if (!produto || produto.ativo === false) throw new Error('Existe produto de revenda inativo na comanda ou na ficha técnica.');
    if (comanda.lojaId && produto.lojaId && produto.lojaId !== comanda.lojaId) throw new Error('Existe produto de revenda de outra unidade na comanda.');
    if (Number(produto.estoqueAtual || 0) < quantidade) throw new Error(`Estoque insuficiente para ${produto.nome} (disponível: ${produto.estoqueAtual || 0}, necessário: ${quantidade}).`);
  }
}

function demandasInventarioComanda(estado, comanda) {
  const porProduto = new Map();
  for (const item of comanda.itens || []) {
    // Vendas de revenda usam linhas sem `tipo`; somente serviços de comanda
    // ficam fora desta parte (seus insumos entram no planejamento abaixo).
    if (!item.produtoId || (item.tipo && item.tipo !== 'produto')) continue;
    const atual = porProduto.get(item.produtoId) || { produtoId: item.produtoId, quantidade: 0 };
    atual.quantidade += Number(item.quantidade || 0);
    porProduto.set(item.produtoId, atual);
  }
  for (const consumo of planejarConsumoInternoComanda(estado, comanda)) {
    const atual = porProduto.get(consumo.produtoId) || { produtoId: consumo.produtoId, quantidade: 0 };
    atual.quantidade += Number(consumo.quantidade || 0);
    porProduto.set(consumo.produtoId, atual);
  }
  return [...porProduto.values()].map((item) => ({ ...item, quantidade: Number(item.quantidade.toFixed(4)) }));
}

function expiresReservaOperacao(value) {
  const informado = value ? new Date(value) : new Date(Date.now() + 30 * 60 * 1000);
  if (Number.isNaN(informado.valueOf())) throw erroEstoqueReserva('expiresAt da operação é inválido.', 'EXPIRES_AT_INVALID');
  return informado.toISOString();
}

function marcarBloqueioReservaOperacao(operacao, motivo, code = 'STORE_REQUIRED') {
  operacao.reservasEstoqueIds = [];
  operacao.inventoryReservationIds = [];
  operacao.reservaEstoqueStatus = 'bloqueado';
  operacao.reservaEstoqueBloqueio = { code, motivo, em: dataAtual() };
  return { status: 'bloqueado', code, ids: [] };
}

function sincronizarReservasOperacao(empresaId, operacao, estado, { origem = 'operacao_pendente', expiresAt } = {}) {
  const demandas = demandasInventarioComanda(estado, operacao);
  if (!demandas.length) {
    operacao.reservaEstoqueStatus = 'sem_necessidade';
    operacao.reservasEstoqueIds = [];
    operacao.inventoryReservationIds = [];
    return { status: 'sem_necessidade', ids: [] };
  }
  if (!operacao.lojaId) return marcarBloqueioReservaOperacao(operacao, 'A operação não possui loja; reserva de estoque fica bloqueada para não compartilhar legado.', 'STORE_REQUIRED');
  const incompatibilidade = demandas.find((item) => {
    const produto = estado.produtosRevenda[item.produtoId];
    return !produto?.lojaId || produto.lojaId !== operacao.lojaId;
  });
  if (incompatibilidade) return marcarBloqueioReservaOperacao(operacao, `Produto ${incompatibilidade.produtoId} não possui vínculo seguro com a loja ${operacao.lojaId}.`, 'SCOPE_QUARANTINED');

  const idsAtuais = new Set(operacao.reservasEstoqueIds || operacao.inventoryReservationIds || []);
  const porProduto = new Map(demandas.map((item) => [item.produtoId, item]));
  const idsNovos = [];
  for (const id of idsAtuais) {
    const reserva = estado.inventoryReservations[id];
    if (!reserva || !STATUS_RESERVA_ATIVA.has(reserva.status)) continue;
    const demanda = porProduto.get(reserva.produtoId);
    if (demanda && Number(reserva.quantidade) === Number(demanda.quantidade)) {
      idsNovos.push(id);
      porProduto.delete(reserva.produtoId);
    } else {
      releaseInventoryReservation(empresaId, { lojaId: operacao.lojaId, reservationId: id, actionId: `release-sync:${operacao.id}:${id}` });
    }
  }
  for (const demanda of porProduto.values()) {
    const prefixo = `${origem}:${operacao.id}:${demanda.produtoId}`;
    const historicas = Object.values(estado.inventoryReservations).filter((item) => item.reservationKey === prefixo || item.reservationKey.startsWith(`${prefixo}:v`));
    const versao = historicas.reduce((max, item) => Math.max(max, Number(String(item.reservationKey).match(/:v(\d+)$/)?.[1] || (item.reservationKey === prefixo ? 1 : 0))), 0) + (historicas.length ? 1 : 0);
    const chave = historicas.length ? `${prefixo}:v${versao}` : prefixo;
    const reserva = reserveInventoryForOperation(empresaId, {
      lojaId: operacao.lojaId,
      produtoId: demanda.produtoId,
      quantidade: demanda.quantidade,
      origem,
      idempotencyKey: chave,
      actionId: chave,
      expiresAt: expiresReservaOperacao(expiresAt || operacao.reservaEstoqueExpiresAt),
      referencia: operacao.id,
      correlationId: operacao.id,
    });
    idsNovos.push(reserva.id);
  }
  operacao.reservasEstoqueIds = idsNovos;
  operacao.inventoryReservationIds = [...idsNovos];
  operacao.reservaEstoqueStatus = 'ativo';
  operacao.reservaEstoqueExpiresAt = expiresReservaOperacao(expiresAt || operacao.reservaEstoqueExpiresAt);
  operacao.reservaEstoqueBloqueio = null;
  return { status: 'ativo', ids: [...idsNovos] };
}

function reservasOperacaoAtivas(estado, operacao) {
  const ids = operacao.reservasEstoqueIds || operacao.inventoryReservationIds || [];
  return ids.map((id) => estado.inventoryReservations[id]).filter((item) => item && STATUS_RESERVA_ATIVA.has(item.status));
}

function commitarReservasOperacao(empresaId, operacao, estado) {
  const reservas = reservasOperacaoAtivas(estado, operacao);
  if (!reservas.length || operacao.reservaEstoqueStatus !== 'ativo') return { committed: false, movimentos: [] };
  const snapshot = raizSnapshot();
  try {
    const movimentos = [];
    for (const reserva of reservas) {
      const resultado = commitInventoryReservation(empresaId, { lojaId: operacao.lojaId, reservationId: reserva.id, actionId: `commit:${operacao.id}:${reserva.id}` });
      if (resultado?.movimento) movimentos.push(resultado.movimento);
    }
    operacao.reservaEstoqueStatus = 'consumida';
    operacao.reservaEstoqueMovimentoIds = movimentos.map((item) => item.id);
    return { committed: true, movimentos };
  } catch (error) {
    restaurarRaiz(snapshot);
    throw error;
  }
}

function liberarReservasOperacao(empresaId, operacao, estado, motivo = 'cancelamento') {
  const reservas = reservasOperacaoAtivas(estado, operacao);
  if (!reservas.length) return [];
  const snapshot = raizSnapshot();
  try {
    const liberadas = [];
    for (const reserva of reservas) {
      liberadas.push(releaseInventoryReservation(empresaId, { lojaId: operacao.lojaId, reservationId: reserva.id, actionId: `release:${motivo}:${operacao.id}:${reserva.id}`, motivo }));
    }
    operacao.reservaEstoqueStatus = 'liberada';
    return liberadas;
  } catch (error) {
    restaurarRaiz(snapshot);
    throw error;
  }
}

function aplicarConsumoInternoComanda(estado, comanda, consumoPlanejado = planejarConsumoInternoComanda(estado, comanda)) {
  if (comanda.consumoInternoBaixado) return [];
  const movimentos = [];
  const agora = dataAtual();
  for (const consumo of consumoPlanejado) {
    const produto = estado.produtosRevenda[consumo.produtoId];
    const anterior = Number(produto.estoqueAtual || 0);
    produto.estoqueAtual = anterior - consumo.quantidade;
    produto.atualizadoEm = agora;
    produto.ultimoMovimentoEm = agora;
    const movimentoId = novoId('mov', estado.movimentosEstoque);
    const movimento = { id: movimentoId, empresaId: String(comanda.empresaId), lojaId: comanda.lojaId || null, produtoId: produto.id, tipo: 'consumo_servico', quantidade: consumo.quantidade, estoqueAnterior: anterior, estoquePosterior: produto.estoqueAtual, comandaId: comanda.id, servicoIds: consumo.servicoIds, observacao: `Consumo interno da comanda ${comanda.id}`, criadoEm: agora };
    estado.movimentosEstoque[movimentoId] = movimento;
    movimentos.push(movimento);
  }
  comanda.consumoInternoBaixado = true;
  comanda.consumoInternoMovimentoIds = movimentos.map((item) => item.id);
  return movimentos;
}

export function registrarConsumoInternoComandaBarbearia(empresaId, comandaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  if (dados.confirmado !== true) throw new Error('A confirmação explícita do consumo interno é obrigatória.');
  if (!['paga', 'em_conta'].includes(comanda.status)) throw new Error('O consumo interno só pode ocorrer após faturamento integral da comanda.');
  if (comanda.consumoInternoBaixado) return { comanda: copiarComandaBarbearia(comanda), movimentos: [] };
  const consumoPlanejado = planejarConsumoInternoComanda(estado, comanda);
  validarEstoqueComandaBarbearia(estado, { ...comanda, itens: [] }, consumoPlanejado);
  const movimentos = aplicarConsumoInternoComanda(estado, comanda, consumoPlanejado);
  save();
  return { comanda: copiarComandaBarbearia(comanda), movimentos };
}

export function listarComandasBarbearia(empresaId, filtros = {}) {
  const dataFiltro = filtros.data ? String(filtros.data).slice(0, 10) : null;
  const lojaId = legacyLojaIdFromCommerce(filtros.lojaId, empresaId);
  return Object.values(estadoEmpresa(empresaId, false).comandas)
    .filter((item) => !filtros.agendamentoId || item.agendamentoId === String(filtros.agendamentoId) || (item.itens || []).some(i => i.agendamentoId === String(filtros.agendamentoId)))
    .filter((item) => !filtros.pendentes || ['aberta', 'aguardando_pagamento', 'parcialmente_paga'].includes(item.status))
    .filter((item) => !filtros.status || item.status === String(filtros.status))
    .filter((item) => !lojaId || legacyLojaIdFromCommerce(item.lojaId, empresaId) === lojaId)
    .filter((item) => !filtros.clienteId || item.clienteId === String(filtros.clienteId))
    .filter((item) => !filtros.caixaId || item.caixaId === String(filtros.caixaId) || (item.pagamentos || []).some(p => String(p.caixaId) === String(filtros.caixaId)))
    .filter((item) => {
      if (!dataFiltro) return true;
      const dAtend = item.dataAtendimento ? String(item.dataAtendimento).slice(0, 10) : null;
      if (dAtend) return dAtend === dataFiltro;
      const dOp = diaOperacional(item.dataAtendimento || item.criadoEm);
      if (dOp === dataFiltro) return true;
      if (item.fechadaEm && diaOperacional(item.fechadaEm) === dataFiltro) return true;
      if ((item.pagamentos || []).some(p => !p.estornado && !p.cancelado && diaOperacional(p.registradoEm || p.criadoEm) === dataFiltro)) return true;
      if (item.canceladaEm && diaOperacional(item.canceladaEm) === dataFiltro) return true;
      return false;
    })
    .sort((a, b) => String(b.fechadaEm || b.atualizadoEm || b.criadoEm).localeCompare(String(a.fechadaEm || a.atualizadoEm || a.criadoEm)))
    .map((item) => copiarComandaBarbearia(item));
}

export function obterComandaBarbearia(empresaId, comandaId) {
  const comanda = estadoEmpresa(empresaId, false).comandas[String(comandaId)];
  return comanda && comanda.empresaId === String(empresaId) ? copiarComandaBarbearia(comanda) : null;
}

export function criarComandaBarbearia(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const chaveIdempotencia = texto(dados.chaveIdempotencia ?? dados.chave_idempotencia, 220);
  if (chaveIdempotencia) {
    const existente = Object.values(estado.comandas).find((item) => item.chaveIdempotencia === chaveIdempotencia);
    if (existente) return copiarComandaBarbearia(existente, true);
  }
  const agendamentoId = texto(dados.agendamentoId ?? dados.agendamento_id, 120);
  const agendamento = agendamentoId ? estado.agendamentos[agendamentoId] : null;
  if (agendamentoId && (!agendamento || agendamento.empresaId !== String(empresaId))) throw new Error('Agendamento não encontrado na empresa ativa.');
  const lojaId = texto(dados.lojaId ?? dados.loja_id ?? agendamento?.lojaId, 120);
  const profissionalIdBruto = texto(dados.profissionalId ?? dados.profissional_id ?? agendamento?.profissionalId, 120);
  const profissionalId = resolverProfissionalIdSeguro(empresaId, profissionalIdBruto);
  if (profissionalIdBruto && !profissionalId) throw new Error('Profissional responsável não encontrado ou inativo.');
  const agora = dataAtual();
  const id = novoId('cmdbar', estado.comandas);
  const dataAtendExplicita = texto(dados.dataAtendimento ?? dados.data_atendimento ?? dados.data, 30) || null;
  const dataAg = texto(agendamento?.dataAgenda ?? agendamento?.dataHora, 30) || null;
  const hojeOp = diaOperacional(agora);
  const dataAtend = dataAtendExplicita || (dataAg && String(dataAg).slice(0, 10) <= hojeOp ? dataAg : null);
  const criadoEmEfetivo = dados.criadoEm || (dataAtend ? `${String(dataAtend).slice(0, 10)}T${agora.slice(11)}` : agora);
  const comanda = {
    id,
    empresaId: String(empresaId),
    lojaId,
    clienteId: texto(dados.clienteId ?? dados.cliente_id ?? agendamento?.clienteId, 120),
    clienteNome: texto(dados.clienteNome ?? dados.cliente_nome ?? agendamento?.clienteNome, 160),
    clienteTelefone: texto(dados.clienteTelefone ?? dados.cliente_telefone ?? agendamento?.clienteTelefone, 30),
    agendamentoId: agendamento?.id || null,
    dataAtendimento: dataAtend,
    profissionalId,
    status: 'aberta',
    itens: [],
    pagamentos: [],
    desconto: dinheiro(dados.desconto),
    descontoMotivo: texto(dados.descontoMotivo ?? dados.desconto_motivo, 240),
    gorjeta: dinheiro(dados.gorjeta),
    totalPago: 0,
    totalFaturado: 0,
    saldoPendente: 0,
    estoqueBaixado: false,
    financeiroLancamentoIds: [],
    contasReceberIds: [],
    reservasEstoqueIds: [],
    inventoryReservationIds: [],
    reservaEstoqueStatus: 'sem_necessidade',
    reservaEstoqueExpiresAt: expiresReservaOperacao(dados.expiresAt ?? dados.expires_at),
    reservaEstoqueBloqueio: null,
    chaveIdempotencia: chaveIdempotencia || null,
    lancamentosEquipe: Array.isArray(dados.lancamentosEquipe) ? dados.lancamentosEquipe.slice(0, 1).map(o => ({ chave: String(o.chave), hash: String(o.hash) })) : [],
    observacoes: texto(dados.observacoes ?? dados.observacao, 600),
    criadoPor: texto(dados.usuario, 120),
    criadoEm: criadoEmEfetivo,
    atualizadoEm: agora,
    fechadaEm: null,
  };
  const itensIniciais = Array.isArray(dados.itens) ? dados.itens : (agendamento?.servicoId ? [{ tipo: 'servico', servicoId: agendamento.servicoId, profissionalId }] : []);
  if (itensIniciais.length) {
    const itens = itensIniciais.map((item) => itemComandaBarbeariaNormalizado(estado, comanda, item));
    comanda.itens.push(...itens);
  }
  const snapshotReserva = raizSnapshot();
  try {
    estado.comandas[id] = comanda;
    sincronizarReservasOperacao(empresaId, comanda, estado, { origem: 'comanda_barbearia', expiresAt: dados.expiresAt ?? dados.expires_at });
  } catch (error) {
    restaurarRaiz(snapshotReserva);
    throw error;
  }
  save();
  return copiarComandaBarbearia(comanda);
}

export function atualizarComandaBarbearia(empresaId, comandaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  const isFinalizada = ['paga', 'em_conta'].includes(comanda.status);
  const ehAjusteMetadados = (dados.dataAtendimento !== undefined || dados.data_atendimento !== undefined || dados.data !== undefined || dados.dataFechamento !== undefined || dados.profissionalId !== undefined || dados.observacoes !== undefined || dados.observacao !== undefined) && dados.desconto === undefined && dados.gorjeta === undefined;
  if (!['aberta', 'aguardando_pagamento', 'parcialmente_paga'].includes(comanda.status) && !isFinalizada) throw new Error('A comanda não está aberta para edição.');
  if (isFinalizada && !ehAjusteMetadados && dados.permitirFinalizada !== true) throw new Error('A comanda está finalizada. Permite alteração de data, barbeiro e observações.');
  if ('financeiroLancamentoIds' in dados || 'contasReceberIds' in dados) throw new Error('Vínculos financeiros só podem ser gerados no fluxo de recebimento confirmado.');
  const subtotal = Number((comanda.itens || []).reduce((soma, item) => soma + Number(item.subtotal || 0), 0).toFixed(2));
  const descontoNovo = dados.desconto !== undefined ? dinheiro(dados.desconto) : Number(comanda.desconto || 0);
  const gorjetaNova = dados.gorjeta !== undefined ? dinheiro(dados.gorjeta) : Number(comanda.gorjeta || 0);
  const totalNovo = Number(Math.max(0, subtotal - Math.min(subtotal, descontoNovo) + gorjetaNova).toFixed(2));
  const permiteAbaixo = dados.permitirAbaixoFaturado === true || dados.autorizadoGerente === true || Boolean(comanda.reabertaEm) || Boolean(comanda.statusAnteriorReabertura) || Boolean(comanda.reaberta);
  if (!isFinalizada && !permiteAbaixo && totalNovo + 0.02 < Number(comanda.totalFaturado || 0)) throw erroEstoqueReserva('O total da comanda não pode ficar abaixo do total já faturado.', 'TOTAL_BELOW_BILLED', 409);
  const snapshot = raizSnapshot();
  try {
    if (dados.desconto !== undefined) comanda.desconto = descontoNovo;
    if (dados.descontoMotivo !== undefined || dados.desconto_motivo !== undefined) comanda.descontoMotivo = texto(dados.descontoMotivo ?? dados.desconto_motivo, 240);
    if (dados.gorjeta !== undefined) comanda.gorjeta = gorjetaNova;
    if (dados.observacoes !== undefined || dados.observacao !== undefined) comanda.observacoes = texto(dados.observacoes ?? dados.observacao, 600);
    comanda.subtotal = subtotal;
    comanda.total = totalNovo;
    comanda.saldoPendente = Number(Math.max(0, totalNovo - Number(comanda.totalPago || 0)).toFixed(2));
    if (dados.profissionalId !== undefined || dados.profissional_id !== undefined) {
      const pId = texto(dados.profissionalId ?? dados.profissional_id, 120) || null;
      if (pId && (!estado.profissionais[pId] || estado.profissionais[pId].ativo === false)) {
        throw new Error('Profissional responsável não encontrado ou inativo.');
      }
      comanda.profissionalId = pId;
    }
    // Atualização da data exata informada da comanda (retroativa ou futura)
    if (dados.dataAtendimento || dados.data_atendimento || dados.data || dados.dataFechamento) {
      const novaData = texto(dados.dataAtendimento ?? dados.data_atendimento ?? dados.data ?? dados.dataFechamento, 30);
      comanda.dataAtendimento = novaData ? String(novaData).slice(0, 10) : comanda.dataAtendimento;
      if (novaData && String(novaData).length >= 10) {
        const diaStr = String(novaData).slice(0, 10);
        const horaStr = comanda.criadoEm ? String(comanda.criadoEm).slice(11) : '12:00:00.000Z';
        comanda.criadoEm = `${diaStr}T${horaStr}`;
        if (comanda.fechadaEm || isFinalizada) {
          comanda.fechadaEm = `${diaStr}T12:00:00.000Z`;
        }
        let caixaDestino = null;
        try {
          const caixasNovaData = caixaKytto.listarCaixas(empresaId, { data: diaStr, lojaId: comanda.lojaId });
          caixaDestino = caixasNovaData.find(cx => cx.status === 'aberto') || caixasNovaData[0] || null;
        } catch (e) {}
        if (Array.isArray(comanda.pagamentos)) {
          for (const p of comanda.pagamentos) {
            p.registradoEm = `${diaStr}T12:00:00.000Z`;
            p.caixaId = caixaDestino ? caixaDestino.id : null;
          }
        }
        comanda.caixaId = caixaDestino ? caixaDestino.id : null;
        if (comanda.agendamentoId && estado.agendamentos?.[comanda.agendamentoId]) {
          const ag = estado.agendamentos[comanda.agendamentoId];
          ag.data = diaStr;
          ag.dataAtendimento = diaStr;
          if (ag.dataHora && ag.dataHora.length >= 10) {
            ag.dataHora = `${diaStr}${ag.dataHora.slice(10)}`;
          }
          ag.atualizadoEm = dataAtual();
        }
        if (Array.isArray(comanda.financeiroLancamentoIds)) {
          for (const lancId of comanda.financeiroLancamentoIds) {
            try {
              financeiroKytto.atualizarLancamento(empresaId, lancId, {
                dataCompetencia: diaStr,
                dataOperacao: diaStr,
                data: diaStr,
              });
            } catch {}
          }
        }
      }
    }
    sincronizarReservasOperacao(empresaId, comanda, estado, { origem: 'comanda_barbearia', expiresAt: comanda.reservaEstoqueExpiresAt });
    comanda.atualizadoEm = dataAtual();
    save();
    return copiarComandaBarbearia(comanda);
  } catch (error) {
    restaurarRaiz(snapshot);
    throw error;
  }
}

export function adicionarItensComandaBarbearia(empresaId, comandaId, itens = [], operacaoEquipe = null, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  const isFinalizada = ['paga', 'em_conta'].includes(comanda.status);
  if (!['aberta', 'aguardando_pagamento', 'parcialmente_paga'].includes(comanda.status) && !comanda.reabertaEm && !dados.autorizadoGerente && !isFinalizada) throw new Error('A comanda não está disponível para novos itens.');
  if (operacaoEquipe) {
    const anterior = (comanda.lancamentosEquipe || []).find(o => o.chave === operacaoEquipe.chave);
    if (anterior) {
      if (anterior.hash !== operacaoEquipe.hash) throw new Error('Operação reutilizada com outros itens.');
      return copiarComandaBarbearia(comanda, true);
    }
    if ((comanda.lancamentosEquipe || []).length >= 500) throw new Error('Limite de lançamentos alcançado. Consulte o caixa.');
  }
  const entradas = Array.isArray(itens) ? itens : [itens];
  if (!entradas.length) throw new Error('Inclua ao menos um item na comanda.');
  const novos = entradas.map((item) => itemComandaBarbeariaNormalizado(estado, comanda, item));
  const snapshot = raizSnapshot();
  try {
    comanda.itens.push(...novos);
    if (operacaoEquipe) comanda.lancamentosEquipe = [...(comanda.lancamentosEquipe || []), { ...operacaoEquipe }];
    if (!['aguardando_pagamento', 'parcialmente_paga'].includes(comanda.status)) {
      comanda.status = 'aberta';
    }
    const subtotalNovo = Number((comanda.itens || []).reduce((soma, item) => soma + Number(item.subtotal || 0), 0).toFixed(2));
    const descontoNovo = Number(Math.min(subtotalNovo, Math.max(0, Number(comanda.desconto || 0))).toFixed(2));
    const totalNovo = Number(Math.max(0, subtotalNovo - descontoNovo + Math.max(0, Number(comanda.gorjeta || 0))).toFixed(2));
    comanda.subtotal = subtotalNovo;
    comanda.desconto = descontoNovo;
    comanda.total = totalNovo;
    comanda.saldoPendente = Number(Math.max(0, totalNovo - Number(comanda.totalPago || 0)).toFixed(2));
    sincronizarReservasOperacao(empresaId, comanda, estado, { origem: 'comanda_barbearia', expiresAt: comanda.reservaEstoqueExpiresAt });
    comanda.atualizadoEm = dataAtual();
    save();
    return copiarComandaBarbearia(comanda);
  } catch (error) {
    restaurarRaiz(snapshot);
    throw error;
  }
}

export function atualizarItemComandaBarbearia(empresaId, comandaId, itemId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  if (['paga', 'em_conta'].includes(comanda.status)) {
    return alterarItemComandaFinalizada(empresaId, comandaId, itemId, dados);
  }
  if (!['aberta', 'aguardando_pagamento', 'parcialmente_paga'].includes(comanda.status) && !comanda.reabertaEm && !dados.autorizadoGerente) throw new Error('A comanda não está disponível para edição.');
  const atual = (comanda.itens || []).find((item, idx) => String(item.id) === String(itemId) || `${item.tipo}-${idx}` === String(itemId) || String(idx) === String(itemId) || (item.servicoId && String(item.servicoId) === String(itemId)) || (item.produtoId && String(item.produtoId) === String(itemId)));
  if (!atual) return null;
  const quantidade = dados.quantidade !== undefined || dados.qtd !== undefined ? Math.max(1, Math.round(numero(dados.quantidade ?? dados.qtd, atual.quantidade))) : atual.quantidade;
  if (quantidade !== atual.quantidade && (atual.coberturaPlano || atual.tipo === 'loja')) throw new Error('Para mudar a quantidade deste item, remova a linha e lance de novo.');
  if (atual.tipo === 'produto') {
    const produto = estado.produtosRevenda[atual.produtoId];
    if (!produto || Number(produto.estoqueAtual || 0) < quantidade) throw new Error(`Estoque insuficiente para ${atual.nome}.`);
  }
  const precoUnitario = (dados.preco !== undefined || dados.precoUnitario !== undefined) ? dinheiro(dados.preco ?? dados.precoUnitario) : atual.precoUnitario;
  const subtotalAtual = Number((comanda.itens || []).reduce((soma, item) => soma + Number(item.subtotal || 0), 0).toFixed(2));
  const subtotalNovo = Number((subtotalAtual - Number(atual.subtotal || 0) + (atual.coberturaPlano ? 0 : dinheiro(precoUnitario * quantidade))).toFixed(2));
  const desconto = Number(Math.min(subtotalNovo, Math.max(0, Number(comanda.desconto || 0))).toFixed(2));
  const totalNovo = Number(Math.max(0, subtotalNovo - desconto + Math.max(0, Number(comanda.gorjeta || 0))).toFixed(2));
  const permiteAbaixoItem = dados.permitirAbaixoFaturado === true || dados.autorizadoGerente === true || Boolean(comanda.reabertaEm) || Boolean(comanda.statusAnteriorReabertura) || Boolean(comanda.reaberta);
  if (!permiteAbaixoItem && totalNovo + 0.02 < Number(comanda.totalFaturado || 0)) throw erroEstoqueReserva('O total da comanda não pode ficar abaixo do total já faturado.', 'TOTAL_BELOW_BILLED', 409);
  const snapshot = raizSnapshot();
  try {
    atual.quantidade = quantidade;
    atual.precoUnitario = precoUnitario;
    atual.subtotal = atual.coberturaPlano ? 0 : dinheiro(precoUnitario * quantidade);
    if (dados.profissionalId !== undefined || dados.profissional_id !== undefined) {
      const pId = texto(dados.profissionalId ?? dados.profissional_id, 120) || null;
      if (pId && (!estado.profissionais[pId] || estado.profissionais[pId].ativo === false)) {
        throw new Error('Profissional responsável não encontrado ou inativo.');
      }
      atual.profissionalId = pId;
    }
    if (dados.observacao !== undefined || dados.obs !== undefined) atual.observacao = texto(dados.observacao ?? dados.obs, 400);
    atual.atualizadoEm = dataAtual();
    comanda.subtotal = subtotalNovo;
    comanda.desconto = desconto;
    comanda.total = totalNovo;
    comanda.saldoPendente = Number(Math.max(0, totalNovo - Number(comanda.totalPago || 0)).toFixed(2));
    sincronizarReservasOperacao(empresaId, comanda, estado, { origem: 'comanda_barbearia', expiresAt: comanda.reservaEstoqueExpiresAt });
    comanda.atualizadoEm = atual.atualizadoEm;
    save();
    return copiarComandaBarbearia(comanda);
  } catch (error) {
    restaurarRaiz(snapshot);
    throw error;
  }
}


function estornarCaixaComanda(empresaId, caixaId, lojaId, comandaId, valorEstorno, motivo, usuario, chaveIdempotencia) {
  try {
    const movs = caixaKytto.movimentosDoCaixa(empresaId, caixaId);
    const movRec = movs.find(m => m.tipo === 'recebimento' && (m.referencia === comandaId || String(m.descricao || '').includes(comandaId)));
    if (movRec) {
      caixaKytto.registrarEstornoRecebimento(empresaId, {
        caixaId,
        lojaId,
        movimentoOriginalId: movRec.id,
        valor: valorEstorno,
        motivo: texto(motivo || 'Estorno em comanda', 300),
        usuario: texto(usuario || 'Gerente', 120),
        chaveIdempotencia: chaveIdempotencia || `estorno_cx:${empresaId}:${comandaId}:${Date.now()}`,
      });
    } else {
      caixaKytto.registrarMovimento(empresaId, {
        caixaId,
        lojaId,
        tipo: 'sangria',
        valor: valorEstorno,
        descricao: texto(motivo || `Estorno em comanda ${comandaId}`, 200),
        usuario: texto(usuario || 'Gerente', 120),
      });
    }
  } catch (err) {
    console.warn('[estornarCaixaComanda] Aviso:', err.message);
  }
}

export function alterarItemComandaFinalizada(empresaId, comandaId, itemId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  if (!['paga', 'em_conta', 'parcialmente_paga'].includes(comanda.status)) {
    throw new Error('Apenas comandas já faturadas (pagas ou em conta) utilizam este fluxo de alteração.');
  }
  const atual = (comanda.itens || []).find((item, idx) => String(item.id) === String(itemId) || `${item.tipo}-${idx}` === String(itemId) || String(idx) === String(itemId));
  if (!atual) return null;

  const quantidade = dados.quantidade !== undefined || dados.qtd !== undefined
    ? Math.max(1, Math.round(numero(dados.quantidade ?? dados.qtd, atual.quantidade)))
    : (atual.quantidade || 1);

  const precoUnitario = (dados.preco !== undefined || dados.precoUnitario !== undefined || dados.valor !== undefined)
    ? dinheiro(dados.preco ?? dados.precoUnitario ?? dados.valor)
    : atual.precoUnitario;

  const valorUnitarioAntigo = Number(atual.precoUnitario || atual.preco || 0);
  const subtotalAntigoItem = (atual.subtotal !== undefined && atual.subtotal !== null && atual.subtotal !== '')
    ? Number(atual.subtotal)
    : (valorUnitarioAntigo * (atual.quantidade || 1));
  const subtotalNovoItem = atual.coberturaPlano ? 0 : dinheiro(precoUnitario * quantidade);

  const subtotalAtual = Number((comanda.itens || []).reduce((soma, item) => soma + Number(item.subtotal || 0), 0).toFixed(2));
  const descontoAntigo = Number(Math.min(subtotalAtual, Math.max(0, Number(comanda.desconto || 0))).toFixed(2));
  const gorjetaAntiga = Number(Math.max(0, Number(comanda.gorjeta || 0)).toFixed(2));
  const totalAntigo = Number(Math.max(0, subtotalAtual - descontoAntigo + gorjetaAntiga).toFixed(2));
  const subtotalNovo = Number((subtotalAtual - subtotalAntigoItem + subtotalNovoItem).toFixed(2));
  const desconto = Number(Math.min(subtotalNovo, Math.max(0, Number(comanda.desconto || 0))).toFixed(2));
  const totalNovo = Number(Math.max(0, subtotalNovo - desconto + Math.max(0, Number(comanda.gorjeta || 0))).toFixed(2));
  const diferenca = Number((totalNovo - totalAntigo).toFixed(2));

  const snapshot = raizSnapshot();
  try {
    atual.quantidade = quantidade;
    atual.precoUnitario = precoUnitario;
    atual.preco = precoUnitario;
    atual.subtotal = subtotalNovoItem;
    if (dados.profissionalId !== undefined || dados.profissional_id !== undefined) {
      const pId = texto(dados.profissionalId ?? dados.profissional_id, 120) || null;
      if (pId && (!estado.profissionais[pId] || estado.profissionais[pId].ativo === false)) {
        throw new Error('Profissional responsável não encontrado ou inativo.');
      }
      atual.profissionalId = pId;
    }
    if (dados.observacao !== undefined || dados.obs !== undefined) atual.observacao = texto(dados.observacao ?? dados.obs, 400);
    atual.atualizadoEm = dataAtual();

    comanda.subtotal = subtotalNovo;
    comanda.desconto = desconto;
    comanda.total = totalNovo;
    comanda.atualizadoEm = atual.atualizadoEm;

    if (comanda.status === 'em_conta') {
      comanda.totalFaturado = totalNovo;
      comanda.saldoPendente = 0;
      const pagConta = (comanda.pagamentos || []).find((p) => p.meio === 'conta');
      if (pagConta) {
        pagConta.valor = totalNovo;
        pagConta.atualizadoEm = atual.atualizadoEm;
      }
      const contaId = (comanda.contasReceberIds && comanda.contasReceberIds[0]) || (pagConta && pagConta.contaReceberId);
      if (contaId) {
        try {
          clientesKytto.atualizarContaReceber(empresaId, contaId, {
            valor: totalNovo,
            descricao: `Comanda ${comanda.id} - ${comanda.clienteNome || 'Cliente'} (ajustada)`,
          });
        } catch {}
      }
      if (comanda.financeiroLancamentoIds && comanda.financeiroLancamentoIds[0]) {
        try {
          financeiroKytto.atualizarLancamento(empresaId, comanda.financeiroLancamentoIds[0], {
            valorBruto: totalNovo,
            valorLiquido: totalNovo,
            valor: totalNovo,
            descricao: `Venda comanda barbearia ${comanda.id} (ajustada)`,
          });
        } catch {}
      }
    } else if (comanda.status === 'paga') {
      if (diferenca < 0) {
        comanda.totalFaturado = totalNovo;
        comanda.totalPago = totalNovo;
        comanda.saldoPendente = 0;
        if (comanda.financeiroLancamentoIds && comanda.financeiroLancamentoIds[0]) {
          try {
            financeiroKytto.atualizarLancamento(empresaId, comanda.financeiroLancamentoIds[0], {
              valorBruto: totalNovo,
              valorLiquido: totalNovo,
              valor: totalNovo,
            });
          } catch {}
        }
        const pagDinheiro = (comanda.pagamentos || []).find((p) => p.meio === 'dinheiro' && p.caixaId);
        if (pagDinheiro) {
          const valorEstorno = Math.min(pagDinheiro.valor, Math.abs(diferenca));
          pagDinheiro.valor = Number((pagDinheiro.valor - valorEstorno).toFixed(2));
          try {
            caixaKytto.registrarMovimentoCaixa(empresaId, {
              caixaId: pagDinheiro.caixaId,
              lojaId: comanda.lojaId,
              tipo: 'estorno_recebimento',
              valor: valorEstorno,
              descricao: `Ajuste de item (${atual.nome}) na comanda ${comanda.id}`,
              referencia: comanda.id,
              usuario: texto(dados.gerente || dados.usuario || 'Gerente', 120),
              chaveIdempotencia: `barbearia_comanda:${empresaId}:${comanda.id}:ajuste_item:${itemId}:${Date.now()}`,
            });
          } catch {}
        }
      } else if (diferenca > 0) {
        comanda.saldoPendente = Number((totalNovo - Number(comanda.totalPago || 0)).toFixed(2));
        if (comanda.saldoPendente > 0.02) {
          comanda.status = 'parcialmente_paga';
        }
      }
    }

    comanda.historicoAlteracoes = comanda.historicoAlteracoes || [];
    comanda.historicoAlteracoes.push({
      tipo: 'alteracao_item_finalizado',
      itemId: String(itemId),
      itemNome: atual.nome,
      valorAntigo: valorUnitarioAntigo,
      valorNovo: precoUnitario,
      totalAntigo,
      totalNovo,
      diferenca,
      dataHora: dataAtual(),
      gerente: texto(dados.gerente || dados.usuario || 'Gerente', 120),
      motivo: texto(dados.motivo || 'Ajuste de valor em comanda finalizada', 400),
    });

    save();
    return copiarComandaBarbearia(comanda);
  } catch (error) {
    restaurarRaiz(snapshot);
    throw error;
  }
}

export function reabrirComandaBarbearia(empresaId, comandaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  if (!['paga', 'em_conta', 'parcialmente_paga'].includes(comanda.status)) {
    throw new Error('Apenas comandas finalizadas (pagas ou em conta) podem ser reabertas.');
  }
  const snapshot = raizSnapshot();
  try {
    const statusAnterior = comanda.status;
    comanda.statusAnteriorReabertura = statusAnterior;
    comanda.totalFaturadoAnterior = Number(comanda.totalFaturado ?? comanda.totalPago ?? comanda.total ?? 0);
    comanda.totalPagoAnterior = Number(comanda.totalPago ?? 0);
    comanda.pagamentosAnteriores = (comanda.pagamentos || []).map(p => ({ ...p }));

    comanda.reaberta = true;
    comanda.reabertaEm = dataAtual();
    comanda.reabertaPor = texto(dados.gerente || dados.usuario || 'Gerente', 120);
    comanda.motivoReabertura = texto(dados.motivo || 'Reabertura para ajuste e correção de itens', 400);
    comanda.status = 'aguardando_pagamento';
    comanda.atualizadoEm = dataAtual();

    const subtotal = Number((comanda.itens || []).reduce((soma, item) => soma + Number(item.subtotal || 0), 0).toFixed(2));
    const desconto = Number(Math.min(subtotal, Math.max(0, Number(comanda.desconto || 0))).toFixed(2));
    const total = Number(Math.max(0, subtotal - desconto + Math.max(0, Number(comanda.gorjeta || 0))).toFixed(2));
    comanda.subtotal = subtotal;
    comanda.desconto = desconto;
    comanda.total = total;
    comanda.saldoPendente = Number(Math.max(0, total - Number(comanda.totalPago || 0)).toFixed(2));

    comanda.historicoAlteracoes = comanda.historicoAlteracoes || [];
    comanda.historicoAlteracoes.push({
      tipo: 'reabertura_comanda',
      statusAnterior,
      dataHora: comanda.reabertaEm,
      gerente: comanda.reabertaPor,
      motivo: comanda.motivoReabertura,
    });

    save();
    return copiarComandaBarbearia(comanda);
  } catch (error) {
    restaurarRaiz(snapshot);
    throw error;
  }
}

export function refecharComandaEmContaBarbearia(empresaId, comandaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;

  const subtotal = Number((comanda.itens || []).reduce((soma, item) => soma + Number(item.subtotal || 0), 0).toFixed(2));
  const desconto = Number(Math.min(subtotal, Math.max(0, Number(comanda.desconto || 0))).toFixed(2));
  const gorjeta = Number(Math.max(0, Number(comanda.gorjeta || 0)).toFixed(2));
  const total = Number(Math.max(0, subtotal - desconto + gorjeta).toFixed(2));
  comanda.totalFaturado = total;
  comanda.saldoPendente = 0;
  comanda.status = 'em_conta';
  comanda.atualizadoEm = dataAtual();
  comanda.fechadaEm = comanda.atualizadoEm;

  const pagConta = (comanda.pagamentos || []).find((p) => p.meio === 'conta');
  if (pagConta) {
    pagConta.valor = total;
    pagConta.atualizadoEm = comanda.atualizadoEm;
  } else {
    comanda.pagamentos = comanda.pagamentos || [];
    comanda.pagamentos.push({
      id: novoId('pag', estado.comandas),
      meio: 'conta',
      valor: total,
      registradoEm: comanda.atualizadoEm,
    });
  }

  const contaId = (comanda.contasReceberIds && comanda.contasReceberIds[0]) || (pagConta && pagConta.contaReceberId);
  if (contaId) {
    try {
      clientesKytto.atualizarContaReceber(empresaId, contaId, {
        valor: total,
        descricao: `Comanda ${comanda.id} - ${comanda.clienteNome || 'Cliente'} (refechada)`,
      });
    } catch {}
  } else if (comanda.clienteId) {
    try {
      const novaConta = clientesKytto.criarContaReceber(empresaId, {
        clienteId: comanda.clienteId,
        descricao: `Comanda ${comanda.id} - ${comanda.clienteNome || 'Cliente'} (refechada)`,
        valor: total,
      });
      comanda.contasReceberIds = [novaConta.id];
      if (pagConta) pagConta.contaReceberId = novaConta.id;
    } catch {}
  }

  if (comanda.financeiroLancamentoIds && comanda.financeiroLancamentoIds[0]) {
    try {
      financeiroKytto.atualizarLancamento(empresaId, comanda.financeiroLancamentoIds[0], {
        valorBruto: total,
        valorLiquido: total,
        valor: total,
      });
    } catch {}
  }

  save();
  return copiarComandaBarbearia(comanda);
}

export function refecharComandaBarbearia(empresaId, comandaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;

  const subtotal = Number((comanda.itens || []).reduce((soma, item) => soma + Number(item.subtotal || 0), 0).toFixed(2));
  const desconto = Number(Math.min(subtotal, Math.max(0, Number(comanda.desconto || 0))).toFixed(2));
  const gorjeta = Number(Math.max(0, Number(comanda.gorjeta || 0)).toFixed(2));
  const totalNovo = Number(Math.max(0, subtotal - desconto + gorjeta).toFixed(2));

  const meio = String(dados.meio || dados.meioPagamento || 'manter_pagamentos').toLowerCase();

  // Se foi pedido expressamente em conta ou status anterior era em conta
  if (meio === 'conta' || (meio === 'manter_pagamentos' && comanda.statusAnteriorReabertura === 'em_conta')) {
    return refecharComandaEmContaBarbearia(empresaId, comandaId, dados);
  }

  const snapshot = raizSnapshot();
  try {
    const dataFechamento = dados.dataPagamento || dados.dataAtendimento || (comanda.dataAtendimento ? String(comanda.dataAtendimento).slice(0, 10) : null);
    const dataReg = dataFechamento ? `${String(dataFechamento).slice(0, 10)}T12:00:00.000Z` : dataAtual();

    const pagamentosAtuais = comanda.pagamentos || [];
    const totalPagoAnterior = Number(pagamentosAtuais.reduce((soma, p) => soma + Number(p.valor || 0), 0).toFixed(2));
    const diferenca = Number((totalNovo - totalPagoAnterior).toFixed(2));

    // Opção 1: Substituição total do pagamento
    if (dados.substituirPagamentos === true && meio !== 'manter_pagamentos') {
      let caixaId = texto(dados.caixaId, 120) || null;
      if (!caixaId) {
        const abertos = caixaKytto.listarCaixas(empresaId, { status: 'aberto' });
        if (abertos.length >= 1) caixaId = abertos[0].id;
      }
      comanda.pagamentos = [{
        id: `pagbar-${crypto.randomUUID()}`,
        meio,
        bandeira: texto(dados.bandeira, 50) || null,
        valor: totalNovo,
        caixaId,
        registradoEm: dataReg,
        chaveIdempotencia: `refechamento_subst:${empresaId}:${comanda.id}:${Date.now()}`,
      }];
      comanda.total = totalNovo;
      comanda.subtotal = subtotal;
      comanda.desconto = desconto;
      comanda.gorjeta = gorjeta;
      comanda.totalPago = totalNovo;
      comanda.totalFaturado = totalNovo;
      comanda.saldoPendente = 0;
      comanda.status = 'paga';
      comanda.fechadaEm = dataReg;
      comanda.atualizadoEm = dataAtual();
      comanda.reaberta = false;
    } else {
      // Opção 2: Manter pagamentos existentes e ajustar diferença
      if (diferenca === 0) {
        // Total idêntico
        comanda.total = totalNovo;
        comanda.subtotal = subtotal;
        comanda.desconto = desconto;
        comanda.gorjeta = gorjeta;
        comanda.totalFaturado = totalNovo;
        comanda.totalPago = totalNovo;
        comanda.saldoPendente = 0;
        comanda.status = 'paga';
        comanda.fechadaEm = dataReg;
        comanda.atualizadoEm = dataAtual();
        comanda.reaberta = false;
      } else if (diferenca > 0) {
        // Valor aumentou: registrar pagamento da diferença
        const meioDiferenca = (meio === 'manter_pagamentos' || !meio) ? (dados.meioDiferenca || 'pix') : meio;
        let caixaId = texto(dados.caixaId, 120) || null;
        if (!caixaId) {
          const abertos = caixaKytto.listarCaixas(empresaId, { status: 'aberto' });
          if (abertos.length >= 1) caixaId = abertos[0].id;
        }
        comanda.pagamentos = comanda.pagamentos || [];
        comanda.pagamentos.push({
          id: `pagbar-${crypto.randomUUID()}`,
          meio: meioDiferenca,
          bandeira: texto(dados.bandeira, 50) || null,
          valor: diferenca,
          caixaId,
          registradoEm: dataReg,
          observacao: 'Diferença de itens comanda refechada',
        });
        comanda.total = totalNovo;
        comanda.subtotal = subtotal;
        comanda.desconto = desconto;
        comanda.gorjeta = gorjeta;
        comanda.totalFaturado = totalNovo;
        comanda.totalPago = totalNovo;
        comanda.saldoPendente = 0;
        comanda.status = 'paga';
        comanda.fechadaEm = dataReg;
        comanda.atualizadoEm = dataAtual();
        comanda.reaberta = false;
      } else {
        // Valor diminuiu (diferenca < 0): estorno / crédito
        const valorEstorno = Math.abs(diferenca);
        const pagDinheiro = (comanda.pagamentos || []).find(p => p.meio === 'dinheiro' && p.caixaId);
        if (pagDinheiro) {
          const estornoCaixa = Math.min(pagDinheiro.valor, valorEstorno);
          pagDinheiro.valor = Number((pagDinheiro.valor - estornoCaixa).toFixed(2));
          estornarCaixaComanda(
            empresaId,
            pagDinheiro.caixaId,
            comanda.lojaId,
            comanda.id,
            estornoCaixa,
            `Estorno de diferença na comanda ${comanda.id} (R$ ${totalPagoAnterior} -> R$ ${totalNovo})`,
            texto(dados.gerente || dados.usuario || 'Gerente', 120),
            `barbearia_comanda:${empresaId}:${comanda.id}:estorno_refechar:${Date.now()}`
          );
        } else if (comanda.pagamentos && comanda.pagamentos[0]) {
          comanda.pagamentos[0].valor = Number(Math.max(0, comanda.pagamentos[0].valor - valorEstorno).toFixed(2));
        }
        comanda.total = totalNovo;
        comanda.subtotal = subtotal;
        comanda.desconto = desconto;
        comanda.gorjeta = gorjeta;
        comanda.totalFaturado = totalNovo;
        comanda.totalPago = totalNovo;
        comanda.saldoPendente = 0;
        comanda.status = 'paga';
        comanda.fechadaEm = dataReg;
        comanda.atualizadoEm = dataAtual();
        comanda.reaberta = false;
      }
    }

    // Atualizar lançamentos financeiros vinculados
    if (comanda.financeiroLancamentoIds && comanda.financeiroLancamentoIds[0]) {
      try {
        financeiroKytto.atualizarLancamento(empresaId, comanda.financeiroLancamentoIds[0], {
          valorBruto: totalNovo,
          valorLiquido: totalNovo,
          valor: totalNovo,
          descricao: `Venda comanda barbearia ${comanda.id} (refechada)`,
        });
      } catch {}
    }

    // Sincronizar agendamentos vinculados para concluído quando a comanda está paga
    const idsAgendamentosRefechados = [...new Set([comanda.agendamentoId, ...(comanda.itens || []).map((i) => i?.agendamentoId)].filter(Boolean))];
    for (const agId of idsAgendamentosRefechados) {
      const ag = estado.agendamentos?.[String(agId)];
      if (ag && ag.status !== 'cancelado') {
        ag.status = 'concluido';
        ag.comandaId = comanda.id;
        ag.concluidoEm = ag.concluidoEm || comanda.fechadaEm || dataAtual();
        ag.atualizadoEm = dataAtual();
      }
    }

    // Emitir evento para o ecossistema (metas, roleta, DRE, conciliação)
    try {
      kyttoEventBus.emitir('comanda.fechada', {
        comandaId: comanda.id,
        clienteId: comanda.clienteId,
        clienteNome: comanda.clienteNome,
        total: comanda.totalFaturado,
        totalPago: comanda.totalPago,
        itens: comanda.itens,
        pagamentos: comanda.pagamentos,
      }, { empresaId, lojaId: comanda.lojaId, usuario: dados.usuario || 'operador' });
    } catch {}

    comanda.historicoAlteracoes = comanda.historicoAlteracoes || [];
    comanda.historicoAlteracoes.push({
      tipo: 'refechamento_comanda',
      totalAnterior: totalPagoAnterior,
      totalNovo,
      diferenca,
      dataHora: dataAtual(),
      gerente: texto(dados.gerente || dados.usuario || 'Gerente', 120),
      motivo: texto(dados.motivo || 'Refinalização de comanda após ajustes de itens', 400),
    });

    save();
    return copiarComandaBarbearia(comanda);
  } catch (error) {
    restaurarRaiz(snapshot);
    throw error;
  }
}

export function removerItemComandaBarbearia(empresaId, comandaId, itemId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  const isFinalizada = ['paga', 'em_conta'].includes(comanda.status);
  if (!['aberta', 'aguardando_pagamento', 'parcialmente_paga'].includes(comanda.status) && !comanda.reabertaEm && !dados.autorizadoGerente && !isFinalizada) {
    throw new Error('A comanda não está disponível para edição.');
  }
  const indice = (comanda.itens || []).findIndex((item, idx) => 
    String(item.id) === String(itemId) 
    || `${item.tipo}-${idx}` === String(itemId) 
    || String(idx) === String(itemId)
    || (item.servicoId && String(item.servicoId) === String(itemId))
    || (item.produtoId && String(item.produtoId) === String(itemId))
  );
  if (indice < 0) return null;
  const itemRemovido = comanda.itens[indice];
  const subtotalNovo = Number((comanda.itens.reduce((soma, item, index) => soma + (index === indice ? 0 : Number(item.subtotal || 0)), 0)).toFixed(2));
  const desconto = Number(Math.min(subtotalNovo, Math.max(0, Number(comanda.desconto || 0))).toFixed(2));
  const totalNovo = Number(Math.max(0, subtotalNovo - desconto + Math.max(0, Number(comanda.gorjeta || 0))).toFixed(2));
  
  const permiteAbaixo = dados.permitirAbaixoFaturado === true || dados.autorizadoGerente === true || Boolean(comanda.reabertaEm) || Boolean(comanda.statusAnteriorReabertura) || Boolean(comanda.reaberta) || isFinalizada;
  if (!permiteAbaixo && totalNovo + 0.02 < Number(comanda.totalFaturado || 0)) {
    throw erroEstoqueReserva('O total da comanda não pode ficar abaixo do total já faturado.', 'TOTAL_BELOW_BILLED', 409);
  }
  const snapshot = raizSnapshot();
  try {
    comanda.itens.splice(indice, 1);
    comanda.subtotal = subtotalNovo;
    comanda.desconto = desconto;
    comanda.total = totalNovo;
    comanda.saldoPendente = Number(Math.max(0, totalNovo - Number(comanda.totalPago || 0)).toFixed(2));

    if (isFinalizada) {
      const diferenca = Number((totalNovo - Number(comanda.totalFaturado || 0)).toFixed(2));
      comanda.totalFaturado = totalNovo;
      if (comanda.status === 'paga') {
        comanda.totalPago = totalNovo;
        const pagDinheiro = (comanda.pagamentos || []).find((p) => p.meio === 'dinheiro' && p.caixaId);
        if (pagDinheiro && diferenca < 0) {
          const valorEstorno = Math.min(pagDinheiro.valor, Math.abs(diferenca));
          pagDinheiro.valor = Number((pagDinheiro.valor - valorEstorno).toFixed(2));
          try {
            caixaKytto.registrarMovimentoCaixa(empresaId, {
              caixaId: pagDinheiro.caixaId,
              lojaId: comanda.lojaId,
              tipo: 'estorno_recebimento',
              valor: valorEstorno,
              descricao: `Remoção de item (${itemRemovido.nome}) na comanda ${comanda.id}`,
              referencia: comanda.id,
              usuario: texto(dados.gerente || dados.usuario || 'Gerente', 120),
              chaveIdempotencia: `barbearia_comanda:${empresaId}:${comanda.id}:remocao_item:${itemId}:${Date.now()}`,
            });
          } catch {}
        }
      } else if (comanda.status === 'em_conta') {
        const pagConta = (comanda.pagamentos || []).find((p) => p.meio === 'conta');
        if (pagConta) pagConta.valor = totalNovo;
        const contaId = (comanda.contasReceberIds && comanda.contasReceberIds[0]) || (pagConta && pagConta.contaReceberId);
        if (contaId) {
          try {
            clientesKytto.atualizarContaReceber(empresaId, contaId, {
              valor: totalNovo,
              descricao: `Comanda ${comanda.id} - ${comanda.clienteNome || 'Cliente'} (item removido)`,
            });
          } catch {}
        }
      }
    }

    sincronizarReservasOperacao(empresaId, comanda, estado, { origem: 'comanda_barbearia', expiresAt: comanda.reservaEstoqueExpiresAt });
    if (itemRemovido.coberturaPlano) {
      try {
        estornarUsosDaComanda(empresaId, comanda.id);
      } catch {}
    }
    if (itemRemovido.tipo === 'pacote' || itemRemovido.tipo === 'plano') {
      const chaveItem = `comanda-${comanda.id}-item-${itemRemovido.id}`;
      for (const ass of Object.values(estado.assinaturas || {})) {
        if ((ass.comandaId === comanda.id || ass.chaveIdempotencia === chaveItem) && ass.status !== 'cancelada') {
          ass.status = 'cancelada';
          ass.canceladaEm = dataAtual();
          ass.motivoCancelamento = 'Item de pacote removido da comanda';
        }
      }
    }
    comanda.atualizadoEm = dataAtual();
    comanda.historicoAlteracoes = comanda.historicoAlteracoes || [];
    comanda.historicoAlteracoes.push({
      tipo: 'remocao_item',
      itemId: String(itemId),
      itemNome: itemRemovido.nome,
      totalNovo,
      dataHora: dataAtual(),
      gerente: texto(dados.gerente || dados.usuario || 'Gerente', 120),
      motivo: texto(dados.motivo || 'Remoção de item da comanda', 400),
    });
    save();
    return copiarComandaBarbearia(comanda);
  } catch (error) {
    restaurarRaiz(snapshot);
    throw error;
  }
}

export function alterarStatusComandaBarbearia(empresaId, comandaId, status, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  const novoStatus = String(status || '').toLowerCase();
  if (!STATUS_COMANDA_BARBEARIA.has(novoStatus)) throw new Error('Status de comanda inválido.');
  if (novoStatus !== comanda.status && !TRANSICOES_COMANDA_BARBEARIA[comanda.status]?.has(novoStatus)) throw new Error(`Transição de comanda ${comanda.status} para ${novoStatus} não permitida.`);
  if (novoStatus === 'aguardando_pagamento' && !comanda.itens.length) throw new Error('Inclua ao menos um item antes de aguardar pagamento.');
  if (['parcialmente_paga', 'em_conta', 'paga'].includes(novoStatus)) throw new Error('Use o fluxo de recebimento confirmado para registrar pagamentos e lançar o ledger da comanda.');
  if (novoStatus === 'cancelada' && (Number(comanda.totalPago || 0) > 0 || Number(comanda.totalFaturado || 0) > 0 || (comanda.pagamentos || []).length > 0)) throw new Error('Uma comanda com cobrança registrada só pode ser cancelada pelo fluxo financeiro apropriado.');
  comanda.status = novoStatus;
  comanda.observacoes = dados.observacoes !== undefined ? texto(dados.observacoes, 600) : comanda.observacoes;
  if (novoStatus === 'cancelada') {
    comanda.canceladaEm = dataAtual();
    cancelarPacotesEEstornarUsosComanda(empresaId, comanda, dados);
  }
  comanda.atualizadoEm = dataAtual();
  save();
  return copiarComandaBarbearia(comanda);
}

export function registrarPagamentoComandaBarbearia(empresaId, comandaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  if (comanda.status === 'cancelada') throw new Error('Não é possível receber uma comanda cancelada.');
  if (dados.confirmado !== true) throw new Error('A confirmação explícita do pagamento é obrigatória.');
  const chaveIdempotencia = texto(dados.chaveIdempotencia ?? dados.chave_idempotencia, 220);
  if (!comanda.itens.length) throw new Error('Não é possível receber uma comanda sem itens.');
  const subtotal = Number((comanda.itens || []).reduce((soma, item) => soma + Number(item.subtotal || 0), 0).toFixed(2));
  const desconto = Number(Math.min(subtotal, Math.max(0, Number(comanda.desconto || 0))).toFixed(2));
  const total = Number(Math.max(0, subtotal - desconto + Math.max(0, Number(comanda.gorjeta || 0))).toFixed(2));
  const pagamentosEntrada = Array.isArray(dados.pagamentos) && dados.pagamentos.length ? dados.pagamentos : [{ meio: dados.meio ?? dados.meioPagamento ?? dados.meio_pagamento, valor: dados.valor }];
  const lojaIdOperacao = texto(dados.lojaId ?? comanda.lojaId, 120) || null;
  const clienteId = texto(dados.clienteId ?? dados.cliente_id ?? comanda.clienteId, 120) || null;
  // Saldo considera o que já foi faturado (inclusive lançado em conta), não só o recebido.
  // Se a comanda foi reaberta, o saldo a quitar é a diferença entre o total atual e o já pago
  const jaPago = comanda.reaberta ? Number(comanda.totalPago || 0) : Number(comanda.totalFaturado ?? comanda.totalPago ?? 0);
  const saldoAnterior = Number(Math.max(0, total - jaPago).toFixed(2));
  // Fingerprint do pedido, não do caixa inferido nem de IDs/horários gerados.
  // Replay deve continuar sem efeito após o fechamento ou troca do caixa.
  const pagamentosPedido = pagamentosEntrada.map(item => ({
    ...item,
    caixaId: texto(item?.caixaId ?? item?.caixa_id ?? dados.caixaId ?? dados.caixa_id, 120) || null,
  }));
  const fingerprint = chaveIdempotencia ? fingerprintPagamentoComanda({ clienteId, lojaId: lojaIdOperacao, dataVencimento: dados.dataVencimento, pagamentos: pagamentosPedido }) : null;
  const pagamentosExistentes = chaveIdempotencia ? (comanda.pagamentos || []).filter(item => (item.idempotenciaBatchKey || item.chaveIdempotencia) === chaveIdempotencia) : [];
  if (pagamentosExistentes.length) {
    const persistedHashes = [...new Set(pagamentosExistentes.map(item => item.idempotenciaFingerprint).filter(Boolean))];
    // Registros antigos não possuem fingerprint. Compare o lote inteiro,
    // sem inventar o caixa automático ou ID que não vieram no novo pedido.
    const legacyFingerprint = persistedHashes.length ? null : fingerprintPagamentoComanda({
      clienteId: comanda.clienteId, lojaId: comanda.lojaId,
      pagamentos: pagamentosExistentes.map((item, index) => ({
        meio: item.meio, valor: item.valor,
        caixaId: pagamentosPedido[index]?.caixaId ? item.caixaId : null,
        id: pagamentosPedido[index]?.id ? item.id : null,
        chaveIdempotencia: pagamentosPedido[index]?.chaveIdempotencia || pagamentosPedido[index]?.chave_idempotencia ? item.chaveIdempotencia : null,
      })),
    });
    const batchMatches = pagamentosExistentes.length === pagamentosPedido.length && pagamentosExistentes.every((item, index) => {
      const pedido = pagamentosPedido[index];
      return item.meio === texto(pedido?.meio ?? pedido?.meioPagamento, 40).toLowerCase()
        && item.valor === dinheiro(pedido?.valor)
        && (!pedido?.caixaId || item.caixaId === pedido.caixaId)
        && (!pedido?.id || item.id === texto(pedido.id, 120))
        && (!(pedido?.chaveIdempotencia || pedido?.chave_idempotencia) || item.chaveIdempotencia === texto(pedido.chaveIdempotencia ?? pedido.chave_idempotencia, 220));
    });
    const compatible = batchMatches && (persistedHashes.length === 1
      ? pagamentosExistentes.every(item => item.idempotenciaFingerprint === fingerprint)
      : persistedHashes.length === 0 && legacyFingerprint === fingerprint);
    if (!compatible) throw Object.assign(new Error('A chave de idempotência foi reutilizada com payload diferente.'), { code: 'IDEMPOTENCY_CONFLICT' });
    return copiarComandaBarbearia(comanda, true);
  }
  if ((comanda.status === 'paga' || comanda.status === 'em_conta') && !comanda.reaberta) return copiarComandaBarbearia(comanda, true);
  const explicitIds = pagamentosPedido.map(item => texto(item?.id, 120)).filter(Boolean);
  const explicitKeys = pagamentosPedido.map(item => texto(item?.chaveIdempotencia ?? item?.chave_idempotencia, 220)).filter(Boolean);
  const existing = comanda.pagamentos || [];
  if (new Set(explicitIds).size !== explicitIds.length || new Set(explicitKeys).size !== explicitKeys.length
    || existing.some(item => explicitIds.includes(item.id) || explicitKeys.includes(item.chaveIdempotencia))) {
    throw Object.assign(new Error('Um identificador de pagamento já pertence a outro recebimento.'), { code: 'IDEMPOTENCY_CONFLICT' });
  }
  const pagamentos = pagamentosEntrada.map((item) => {
    const meio = texto(item?.meio ?? item?.meioPagamento, 40).toLowerCase();
    const valor = dinheiro(item?.valor);
    if (!MEIOS_PAGAMENTO_COMANDA_BARBEARIA.has(meio) || valor <= 0) throw new Error('Informe meio e valor válidos para cada pagamento.');
    let caixaId = texto(item?.caixaId ?? item?.caixa_id ?? dados.caixaId ?? dados.caixa_id, 120) || null;
    if (!caixaId) {
      // Qualquer meio de pagamento vincula automaticamente ao caixa aberto da unidade se houver. Se houver múltiplos caixas abertos, usa o primeiro aberto ativo.
      const abertos = caixaKytto.listarCaixas(empresaId, { status: 'aberto', ...(lojaIdOperacao ? { lojaId: lojaIdOperacao } : {}) });
      if (abertos.length >= 1) caixaId = abertos[0].id;
    }
    if (meio === 'dinheiro' && caixaId) {
      const caixa = caixaKytto.obterCaixa(empresaId, caixaId);
      if (!caixa || caixa.status !== 'aberto' || (lojaIdOperacao && caixa.lojaId !== lojaIdOperacao)) throw new Error('O caixa informado não está aberto ou não pertence à unidade ativa.');
    }
    const bandeira = texto(item?.bandeira ?? item?.cardBrand, 50) || null;
    const dataAlvo = item?.data || dados.data || dados.dataOperacao || dados.dataPagamento || (comanda.dataAtendimento ? String(comanda.dataAtendimento).slice(0, 10) : null);
    const dataReg = dataAlvo ? `${String(dataAlvo).slice(0, 10)}T12:00:00.000Z` : dataAtual();
    return { id: texto(item?.id, 120) || `pagbar-${crypto.randomUUID()}`, meio, bandeira, valor, caixaId, ...(meio === 'dinheiro' && !caixaId ? { semCaixa: true } : {}), chaveIdempotencia: texto(item?.chaveIdempotencia ?? item?.chave_idempotencia ?? chaveIdempotencia, 220) || null, registradoEm: dataReg };
  });
  const valorNovo = Number(pagamentos.reduce((soma, item) => soma + item.valor, 0).toFixed(2));
  const isRefinalizacaoTotal = comanda.reaberta && Math.abs(valorNovo - total) <= 0.02;
  if (!isRefinalizacaoTotal && valorNovo - saldoAnterior > 0.02) throw new Error(`O pagamento excede o saldo pendente de ${saldoAnterior.toFixed(2)}.`);
  const faturamentoCompleto = saldoAnterior - valorNovo <= 0.02;
  const consumoPlanejado = faturamentoCompleto ? planejarConsumoInternoComanda(estado, comanda) : [];
  validarEstoqueComandaBarbearia(estado, comanda, consumoPlanejado);
  const valorEmConta = Number(pagamentos.filter((item) => item.meio === 'conta').reduce((soma, item) => soma + item.valor, 0).toFixed(2));
  if (valorEmConta > 0) {
    const credito = clienteId ? clientesKytto.obterSituacaoCredito(empresaId, clienteId, valorEmConta) : null;
    if (!credito) throw new Error('Para lançar em conta, selecione um cliente cadastrado da empresa ativa.');
    if (!credito.permitido) { // Ignorado atualmente pela modelagem em clientes-contas
      if (!credito.limite) throw new Error('O cliente não possui limite de crédito configurado para pagar na conta.');
      throw new Error(`Limite de crédito insuficiente. Disponível: R$ ${credito.disponivel.toFixed(2)}.`);
    }
  }
  // Pagamento parcial mantém a reserva held. No fechamento, o commit é feito
  // antes do ledger para que uma reserva expirada/insuficiente não seja paga.
  const snapshotAntesCommitReserva = raizSnapshot();
  let reservaComitada = { committed: false, movimentos: [] };
  try {
    if (faturamentoCompleto) reservaComitada = commitarReservasOperacao(empresaId, comanda, estado);
  } catch (error) {
    restaurarRaiz(snapshotAntesCommitReserva);
    throw error;
  }
  const lancamentosFinanceiros = [];
  const contasReceber = [];
  const recebimentosCaixa = [];
  for (const pagamento of pagamentos) {
    let conta = null;
    if (pagamento.meio === 'conta') {
      const cliente = clienteId ? clientesKytto.obterCliente(empresaId, clienteId) : null;
      if (!cliente || cliente.padrao) throw new Error('Para lançar em conta, selecione um cliente cadastrado da empresa ativa.');
      conta = clientesKytto.criarContaReceber(empresaId, { clienteId: cliente.id, descricao: `Comanda de barbearia ${comanda.id}`, valor: pagamento.valor, dataVencimento: dados.dataVencimento || undefined, observacao: 'Pagamento em conta gerado pela comanda da Barbearia.' });
      contasReceber.push(conta);
    }
    const dataOpEfetiva = String(pagamento.registradoEm).slice(0, 10);
    const lancamento = financeiroKytto.registrarLancamento(empresaId, {
      tipo: 'receita', categoria: pagamento.meio === 'conta' ? 'Contas a receber' : 'Barbearia',
      descricao: `Comanda de barbearia ${comanda.id} — ${comanda.clienteNome || 'Atendimento'} (${pagamento.meio})`,
      valor: pagamento.valor, origem: 'barbearia_comanda', status: pagamento.meio === 'conta' ? 'pendente' : 'pago',
      vencimento: pagamento.meio === 'conta' ? conta?.dataVencimento : dataOpEfetiva, dataOperacao: dataOpEfetiva,
      pagoEm: pagamento.meio === 'conta' ? null : dataOpEfetiva, meioPagamento: pagamento.meio,
      lojaId: lojaIdOperacao,
      usuario: texto(dados.usuario, 120), automatico: true,
      chaveIdempotencia: `barbearia_comanda:${empresaId}:${comanda.id}:pagamento:${pagamento.id}`,
      referencia: { comandaId: comanda.id, clienteId: clienteId || undefined, profissionalId: comanda.profissionalId || undefined, contaReceberId: conta?.id, caixaId: pagamento.caixaId || undefined },
    });
    pagamento.financeiroLancamentoId = lancamento.id;
    pagamento.contaReceberId = conta?.id || null;
    if (pagamento.meio === 'dinheiro' && pagamento.caixaId) {
      const recebimento = caixaKytto.registrarRecebimento(empresaId, {
        caixaId: pagamento.caixaId,
        lojaId: lojaIdOperacao,
        valor: pagamento.valor,
        descricao: `Recebimento em dinheiro da comanda ${comanda.id}`,
        referencia: comanda.id,
        usuario: texto(dados.usuario, 120),
        dataOperacao: pagamento.registradoEm,
        chaveIdempotencia: `barbearia_comanda:${empresaId}:${comanda.id}:caixa_recebimento:${pagamento.id}`,
      });
      pagamento.caixaMovimentoId = recebimento.id;
      recebimentosCaixa.push(recebimento);
    }
    lancamentosFinanceiros.push(lancamento);
  }
  comanda.pagamentos = [...(comanda.pagamentos || []), ...pagamentos.map((item) => ({ ...item, ...(fingerprint ? { idempotenciaFingerprint: fingerprint, idempotenciaBatchKey: chaveIdempotencia } : {}) }))];
  const valorRecebido = Number(pagamentos.filter((item) => item.meio !== 'conta').reduce((soma, item) => soma + item.valor, 0).toFixed(2));
  comanda.totalPago = Number((Number(comanda.totalPago || 0) + valorRecebido).toFixed(2));
  comanda.totalFaturado = Number((Number(comanda.totalFaturado || 0) + valorNovo).toFixed(2));
  comanda.saldoPendente = Number(Math.max(0, total - comanda.totalFaturado).toFixed(2));
  comanda.pagamento = comanda.pagamentos[0]?.meio || null;
  comanda.financeiroLancamentoIds = [...new Set([...(comanda.financeiroLancamentoIds || []), ...lancamentosFinanceiros.map((item) => item.id)].map(String))];
  comanda.contasReceberIds = [...new Set([...(comanda.contasReceberIds || []), ...contasReceber.map((item) => item.id)].map(String))];
  const faturada = comanda.saldoPendente <= 0.02;
  const possuiConta = comanda.pagamentos.some((item) => item.meio === 'conta');
  comanda.status = faturada ? (possuiConta ? 'em_conta' : 'paga') : (comanda.totalPago > 0 ? 'parcialmente_paga' : 'aguardando_pagamento');
  comanda.estoqueBaixado = Boolean(comanda.estoqueBaixado || faturada);
  if (faturada && reservaComitada.committed) {
    comanda.estoqueBaixadoAntes = true;
    comanda.reservaEstoqueMovimentoIds = reservaComitada.movimentos.map((item) => item.id);
    comanda.consumoInternoBaixado = true;
    comanda.consumoInternoMovimentoIds = [...(comanda.consumoInternoMovimentoIds || []), ...reservaComitada.movimentos.map((item) => item.id)];
  }
  if (faturada && !reservaComitada.committed && !comanda.estoqueBaixadoAntes) {
    for (const item of comanda.itens.filter((linha) => linha.tipo === 'produto')) {
      const produto = estado.produtosRevenda[item.produtoId];
      const anterior = Number(produto.estoqueAtual || 0);
      produto.estoqueAtual = anterior - item.quantidade;
      produto.atualizadoEm = dataAtual();
      produto.ultimoMovimentoEm = produto.atualizadoEm;
      const movimentoId = novoId('mov', estado.movimentosEstoque);
      estado.movimentosEstoque[movimentoId] = { id: movimentoId, empresaId: String(empresaId), lojaId: produto.lojaId || comanda.lojaId || null, produtoId: produto.id, tipo: 'saida_comanda', quantidade: item.quantidade, estoqueAnterior: anterior, estoquePosterior: produto.estoqueAtual, comandaId: comanda.id, criadoEm: produto.atualizadoEm };
    }
    comanda.estoqueBaixadoAntes = true;
  }
  if (faturada && !reservaComitada.committed) aplicarConsumoInternoComanda(estado, comanda, consumoPlanejado);
  comanda.atualizadoEm = dataAtual();
  if (faturada) {
    const dataFechEfetiva = dados.data || dados.dataOperacao || dados.dataPagamento || (comanda.dataAtendimento ? String(comanda.dataAtendimento).slice(0, 10) : null);
    comanda.fechadaEm = dataFechEfetiva ? `${String(dataFechEfetiva).slice(0, 10)}T12:00:00.000Z` : comanda.atualizadoEm;
    if (dataFechEfetiva) {
      comanda.dataAtendimento = String(dataFechEfetiva).slice(0, 10);
      const horaCriacao = comanda.criadoEm ? String(comanda.criadoEm).slice(11) : '12:00:00.000Z';
      comanda.criadoEm = `${comanda.dataAtendimento}T${horaCriacao}`;
    }
    const idsAgendamentosVinculados = [...new Set([comanda.agendamentoId, ...(comanda.itens || []).map((i) => i?.agendamentoId)].filter(Boolean))];
    for (const agId of idsAgendamentosVinculados) {
      const ag = estado.agendamentos?.[String(agId)];
      if (ag && ag.status !== 'cancelado') {
        ag.status = 'concluido';
        ag.comandaId = comanda.id;
        ag.concluidoEm = ag.concluidoEm || comanda.fechadaEm || comanda.atualizadoEm;
        ag.atualizadoEm = comanda.atualizadoEm;
      }
    }
  }
  if (faturada && !possuiConta && clienteId && comanda.totalPago > Number(comanda.fidelidadeValorPontuado || 0)) {
    const valorElegivel = Number((comanda.totalPago - Number(comanda.fidelidadeValorPontuado || 0)).toFixed(2));
    const credito = canaisFidelidadeKytto.creditarFidelidade(empresaId, clienteId, valorElegivel, 'barbearia_comanda', {
      chaveIdempotencia: `barbearia_comanda:${empresaId}:${comanda.id}:fidelidade:${comanda.totalPago.toFixed(2)}`,
      lojaId: lojaIdOperacao,
      legacyMigration: true,
      bridge: 'legacy-loyalty-bridge',
    });
    if (credito) {
      comanda.fidelidadeValorPontuado = Number((Number(comanda.fidelidadeValorPontuado || 0) + valorElegivel).toFixed(2));
      comanda.fidelidadeMovimentoId = credito.movimento?.id || comanda.fidelidadeMovimentoId || null;
    }
  }
  save();
  if (faturada) {
    try {
      kyttoEventBus.emitir('comanda.fechada', {
        comandaId: comanda.id,
        clienteId: comanda.clienteId,
        clienteNome: comanda.clienteNome,
        total: comanda.totalFaturado,
        totalPago: comanda.totalPago,
        itens: comanda.itens,
        pagamentos: comanda.pagamentos
      }, { empresaId, lojaId: comanda.lojaId, usuario: dados.usuario || 'operador' });
    } catch (e) {
      console.warn('[EventBus] Falha ao emitir comanda.fechada:', e.message);
    }
  }
  return copiarComandaBarbearia(comanda);
}


export function alterarPagamentoComandaBarbearia(empresaId, comandaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) throw new Error('Comanda não encontrada na empresa ativa.');

  const pagamentoId = texto(dados.pagamentoId ?? dados.pagamento_id, 120);
  const pagamentos = comanda.pagamentos || [];
  const pagamentoIndex = pagamentoId
    ? pagamentos.findIndex((p) => String(p.id) === pagamentoId)
    : 0;
  if (pagamentoIndex === -1 || !pagamentos[pagamentoIndex]) throw new Error('Pagamento não encontrado na comanda.');

  const pagAtual = pagamentos[pagamentoIndex];

  // Validação: se o pagamento estiver associado a um caixa, ele precisa estar ABERTO
  if (pagAtual.caixaId) {
    const caixa = caixaKytto.obterCaixa(empresaId, pagAtual.caixaId);
    if (caixa && caixa.status !== 'aberto') {
      throw new Error('Para alterar a forma de pagamento, reabra o caixa correspondente.');
    }
  }

  const novoMeio = dados.meio ? texto(dados.meio, 40).toLowerCase() : pagAtual.meio;
  const novaBandeira = dados.bandeira !== undefined ? texto(dados.bandeira, 50) : pagAtual.bandeira;
  const novoValor = dados.valor !== undefined ? dinheiro(dados.valor) : pagAtual.valor;
  const motivo = texto(dados.motivo || 'Correção de forma de pagamento com caixa reaberto', 300);
  const usuario = texto(dados.usuario || 'gestao@kytto.local', 120);

  if (!MEIOS_PAGAMENTO_COMANDA_BARBEARIA.has(novoMeio)) throw new Error('Meio de pagamento inválido.');
  if (novoValor <= 0) throw new Error('Valor do pagamento deve ser positivo.');

  // Se mudou de/para dinheiro, ajusta movimentação no caixa
  if (pagAtual.meio === 'dinheiro' && novoMeio !== 'dinheiro' && pagAtual.caixaMovimentoId) {
    try {
      caixaKytto.registrarEstornoRecebimento(empresaId, {
        lojaId: comanda.lojaId,
        movimentoOriginalId: pagAtual.caixaMovimentoId,
        valor: pagAtual.valor,
        actionId: `estorno-correcao-${Date.now()}`,
        motivo: `Correção de forma de pagamento de Dinheiro para ${novoMeio}: ${motivo}`,
        usuario,
      });
    } catch (e) {
      // continua
    }
    pagAtual.caixaMovimentoId = null;
  } else if (pagAtual.meio !== 'dinheiro' && novoMeio === 'dinheiro' && pagAtual.caixaId) {
    const recebimento = caixaKytto.registrarRecebimento(empresaId, {
      caixaId: pagAtual.caixaId,
      lojaId: comanda.lojaId,
      valor: novoValor,
      descricao: `Recebimento corrigido em dinheiro da comanda ${comanda.id}`,
      referencia: comanda.id,
      usuario,
    });
    pagAtual.caixaMovimentoId = recebimento.id;
  }

  pagAtual.historicoAlteracoes ||= [];
  pagAtual.historicoAlteracoes.push({
    meioAnterior: pagAtual.meio,
    bandeiraAnterior: pagAtual.bandeira,
    valorAnterior: pagAtual.valor,
    alteradoEm: dataAtual(),
    alteradoPor: usuario,
    motivo,
  });

  pagAtual.meio = novoMeio;
  pagAtual.bandeira = novaBandeira || null;
  pagAtual.valor = novoValor;
  pagAtual.atualizadoEm = dataAtual();

  comanda.pagamento = comanda.pagamentos[0]?.meio || null;
  comanda.atualizadoEm = dataAtual();
  save();

  return copiarComandaBarbearia(comanda);
}

/**
 * Ao cancelar uma comanda:
 * 1. Cancela qualquer pacote/plano adquirido/lançado nesta comanda, inativando a assinatura na ficha do cliente.
 * 2. Estorna todas as sessões de pacotes consumidas nesta comanda, devolvendo o saldo integralmente ao cliente.
 */
export function cancelarPacotesEEstornarUsosComanda(empresaId, comanda, dados = {}) {
  if (!comanda) return { assinaturasCanceladas: [], usosEstornados: 0 };
  const estado = estadoEmpresa(empresaId);
  const cmdId = String(comanda.id || '');
  const clienteId = comanda.clienteId ? String(comanda.clienteId) : null;
  const agora = dataAtual();
  const motivo = dados.motivo || comanda.cancelamentoMotivo || 'Comanda cancelada';
  const operador = dados.usuario || dados.operador || comanda.canceladoPor || 'operador';

  // 1. Estorna as sessões consumidas na comanda (volta o saldo ao cliente)
  for (const item of comanda.itens || []) {
    if (item.coberturaPlano) {
      item.coberturaPlano.usoId = null;
      item.coberturaPlano.estornadoEm = agora;
    }
  }
  let usosEstornados = 0;
  try {
    usosEstornados = estornarUsosDaComanda(empresaId, comanda.id, comanda.agendamentoId);
  } catch (err) {
    console.warn(`[comanda] aviso ao estornar usos de plano da comanda ${comanda.id}:`, err.message);
  }

  // 2. Cancela qualquer pacote/plano adquirido/lançado nesta comanda
  const planosIdsItens = new Set(
    (comanda.itens || [])
      .filter((item) => (item.tipo === 'pacote' || item.tipo === 'plano' || item.categoria === 'Pacotes e Planos') && item.planoId)
      .map((item) => String(item.planoId))
  );

  const assinaturasCanceladas = [];
  for (const ass of Object.values(estado.assinaturas || {})) {
    if (ass.empresaId !== String(empresaId)) continue;
    if (ass.status === 'cancelada') continue;

    let deveCancelar = false;

    // A) Criada por esta comanda diretamente
    if (ass.comandaId && String(ass.comandaId) === cmdId) {
      deveCancelar = true;
    }
    // B) Chave de idempotência vinculada à comanda
    else if (ass.chaveIdempotencia && String(ass.chaveIdempotencia).includes(cmdId)) {
      deveCancelar = true;
    }
    // C) Assinatura do mesmo cliente com o mesmo planoId do item da comanda, criada na mesma data
    else if (clienteId && String(ass.clienteId) === clienteId && planosIdsItens.has(String(ass.planoId))) {
      const dataCriacaoAss = String(ass.criadoEm || '').slice(0, 10);
      const dataComanda = String(comanda.criadoEm || comanda.dataAtendimento || '').slice(0, 10);
      if (dataCriacaoAss && dataComanda && dataCriacaoAss === dataComanda) {
        deveCancelar = true;
      }
    }

    if (deveCancelar) {
      ass.status = 'cancelada';
      ass.canceladaEm = agora;
      ass.canceladoPor = operador;
      ass.motivoCancelamento = motivo;
      ass.atualizadoEm = agora;
      assinaturasCanceladas.push(ass.id);
    }
  }

  if (assinaturasCanceladas.length > 0 || usosEstornados > 0) {
    save();
  }

  return { assinaturasCanceladas, usosEstornados };
}

export async function cancelarComandaBarbearia(empresaId, comandaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  if (comanda.status === 'cancelada') return copiarComandaBarbearia(comanda, true);

  if (['paga', 'em_conta', 'parcialmente_paga', 'aguardando_pagamento'].includes(comanda.status) || Number(comanda.totalPago || 0) > 0 || (comanda.pagamentos || []).length > 0 || comanda.dinoReversal) {
    const permitirEstorno = dados.estornoManual !== false && (dados.estornoManual === true || dados.cancelarFinalizada === true || dados.origem === 'caixa' || Boolean(dados.motivo));
    if (!permitirEstorno) {
      if (comanda.status === 'paga' || comanda.status === 'em_conta') throw new Error('Uma comanda já faturada não pode ser cancelada neste fluxo.');
      throw new Error('Uma comanda com cobrança registrada só pode ser cancelada pelo fluxo financeiro apropriado.');
    }
    const idempotencyKey = dados.idempotencyKey || `comanda-cancel-${comanda.id}-${Date.now()}`;
    const actionId = dados.actionId || (comanda.dinoReversal?.actionId ? comanda.dinoReversal.actionId : `act-cancel-${comanda.id}-${Date.now().toString(36)}`);
    const motivo = dados.motivo || 'Cancelamento manual de comanda finalizada solicitado no caixa';
    const lojaId = dados.lojaId || comanda.lojaId;
    let estorno = null;
    try {
      estorno = await estornarPagamentoComandaBarbearia(empresaId, comanda.id, {
        ...dados,
        lojaId,
        idempotencyKey,
        actionId,
        motivo,
        confirmado: true,
        estornoManual: true,
        confirmarEstornoManual: true,
        cancelarFinalizada: true,
        forceReversal: true,
        forcar: true,
        reabrirAgendamento: dados.reabrirAgendamento === true,
        operador: dados.usuario || dados.operador || 'operador',
      });
    } catch (errEstorno) {
      console.warn(`[comanda] aviso ao processar estorno da comanda ${comanda.id}:`, errEstorno.message);
    }
    liberarReservasOperacao(empresaId, comanda, estado, 'cancelamento_comanda');
    comanda.status = 'cancelada';
    comanda.estornada = true;
    comanda.canceladaEm = dataAtual();
    comanda.canceladoPor = dados.usuario || dados.operador || 'operador';
    comanda.cancelamentoMotivo = motivo;
    comanda.observacoes = [comanda.observacoes, motivo ? `Cancelamento: ${motivo}` : 'Cancelamento manual.'].filter(Boolean).join(' · ');
    if (Array.isArray(comanda.pagamentos)) {
      for (const p of comanda.pagamentos) {
        p.estornado = true;
        p.cancelado = true;
        p.caixaId = null;
      }
    }
    comanda.caixaId = null;
    comanda.saldoPendente = 0;
    if (comanda.agendamentoId && estado.agendamentos[comanda.agendamentoId]) {
      const ag = estado.agendamentos[comanda.agendamentoId];
      if (dados.reabrirAgendamento !== false) {
        ag.status = 'confirmado';
        ag.comandaId = null;
      } else {
        ag.status = 'cancelado';
        ag.comandaId = null;
      }
      ag.atualizadoEm = dataAtual();
    }
    cancelarPacotesEEstornarUsosComanda(empresaId, comanda, dados);
    comanda.atualizadoEm = dataAtual();
    save();
    const atualizada = estado.comandas[String(comandaId)];
    return { ...copiarComandaBarbearia(atualizada), estorno };
  }

  const snapshot = raizSnapshot();
  try {
    liberarReservasOperacao(empresaId, comanda, estado, 'cancelamento_comanda');
    comanda.status = 'cancelada';
    comanda.observacoes = [comanda.observacoes, texto(dados.motivo, 300) ? `Cancelamento: ${texto(dados.motivo, 300)}` : 'Cancelamento manual.'].filter(Boolean).join(' · ');
    comanda.canceladaEm = dataAtual();
    comanda.canceladoPor = dados.usuario || dados.operador || 'operador';
    comanda.cancelamentoMotivo = dados.motivo || 'Cancelamento manual';
    cancelarPacotesEEstornarUsosComanda(empresaId, comanda, dados);
    comanda.atualizadoEm = dataAtual();
    save();
    return copiarComandaBarbearia(comanda);
  } catch (error) {
    restaurarRaiz(snapshot);
    throw error;
  }
}

export function desvincularCaixaComandaBarbearia(empresaId, comandaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  comanda.caixaId = null;
  if (Array.isArray(comanda.pagamentos)) {
    for (const p of comanda.pagamentos) {
      p.caixaId = null;
    }
  }
  if (dados.novaData) {
    const diaStr = String(dados.novaData).slice(0, 10);
    comanda.dataAtendimento = diaStr;
    comanda.data = diaStr;
    const horaStr = comanda.criadoEm ? String(comanda.criadoEm).slice(11) : '12:00:00.000Z';
    comanda.criadoEm = `${diaStr}T${horaStr}`;
    if (comanda.fechadaEm) comanda.fechadaEm = `${diaStr}T12:00:00.000Z`;
    if (Array.isArray(comanda.pagamentos)) {
      for (const p of comanda.pagamentos) {
        p.registradoEm = `${diaStr}T12:00:00.000Z`;
      }
    }
  }
  comanda.atualizadoEm = dataAtual();
  save();
  return copiarComandaBarbearia(comanda);
}

/** Itens cobertos por plano que ainda não registraram o uso na assinatura. */
export function itensPlanoNaoConsumidos(empresaId) {
  const estado = estadoEmpresa(empresaId);
  const lista = [];
  for (const comanda of Object.values(estado.comandas || {})) {
    if (comanda.empresaId !== String(empresaId) || comanda.status === 'cancelada') continue;
    for (const item of comanda.itens || []) {
      if (item.coberturaPlano && !item.coberturaPlano.usoId) lista.push({ comandaId: comanda.id, status: comanda.status, agendamentoId:comanda.agendamentoId, criadoEm:comanda.criadoEm, itemId: item.id, assinaturaId: item.coberturaPlano.assinaturaId });
    }
  }
  return lista;
}

/** Serviço do agendamento vinculado (para não consumir o plano duas vezes). */
export function servicoDoAgendamento(empresaId, agendamentoId) {
  const agendamento = estadoEmpresa(empresaId).agendamentos?.[String(agendamentoId || '')];
  return agendamento && agendamento.empresaId === String(empresaId) ? agendamento.servicoId || null : null;
}

/**
 * Fecha a comanda cujos itens foram todos cobertos por plano (total zero):
 * não há dinheiro a receber, mas o atendimento precisa sair da fila, baixar os
 * insumos da ficha técnica e liberar o consumo das sessões do plano.
 */
export function fecharComandaSemSaldoBarbearia(empresaId, comandaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  if (dados.confirmado !== true) throw new Error('Confirme o fechamento da comanda coberta pelo plano.');
  if (comanda.status === 'paga') return copiarComandaBarbearia(comanda, true);
  if (!['aberta', 'aguardando_pagamento'].includes(comanda.status)) throw new Error('A comanda não está aberta para fechamento.');
  if (!comanda.itens.length) throw new Error('Inclua ao menos um item antes de fechar a comanda.');
  const subtotal = Number(comanda.itens.reduce((soma, item) => soma + Number(item.subtotal || 0), 0).toFixed(2));
  if (subtotal > 0.009 || Number(comanda.gorjeta || 0) > 0) throw new Error('Há valor a receber nesta comanda: use o recebimento.');
  // if (comanda.itens.some((item) => !item.coberturaPlano)) throw new Error('Só fecha sem recebimento a comanda em que todos os itens são cobertos pelo plano.');
  const consumoPlanejado = planejarConsumoInternoComanda(estado, comanda);
  validarEstoqueComandaBarbearia(estado, comanda, consumoPlanejado);
  const snapshot = raizSnapshot();
  try {
    const reserva = commitarReservasOperacao(empresaId, comanda, estado);
    if (reserva.committed) {
      comanda.reservaEstoqueMovimentoIds = reserva.movimentos.map((item) => item.id);
      comanda.consumoInternoBaixado = true;
      comanda.consumoInternoMovimentoIds = [...(comanda.consumoInternoMovimentoIds || []), ...reserva.movimentos.map((item) => item.id)];
    } else {
      aplicarConsumoInternoComanda(estado, comanda, consumoPlanejado);
    }
    comanda.status = 'paga';
    comanda.estoqueBaixado = true;
    comanda.estoqueBaixadoAntes = true;
    comanda.saldoPendente = 0;
    comanda.fechadaPeloPlano = true;
    comanda.fechadaPor = texto(dados.usuario, 120) || null;
    comanda.atualizadoEm = dataAtual();
    const dataFechSemSaldo = dados.data || dados.dataOperacao || (comanda.dataAtendimento ? String(comanda.dataAtendimento).slice(0, 10) : null);
    comanda.fechadaEm = dataFechSemSaldo ? `${String(dataFechSemSaldo).slice(0, 10)}T12:00:00.000Z` : comanda.atualizadoEm;
    if (dataFechSemSaldo) {
      comanda.dataAtendimento = String(dataFechSemSaldo).slice(0, 10);
      const horaCriacao = comanda.criadoEm ? String(comanda.criadoEm).slice(11) : '12:00:00.000Z';
      comanda.criadoEm = `${comanda.dataAtendimento}T${horaCriacao}`;
    }
    save();
    try {
      kyttoEventBus.emitir('comanda.fechada', {
        comandaId: comanda.id,
        clienteId: comanda.clienteId,
        clienteNome: comanda.clienteNome,
        total: 0,
        totalPago: 0,
        fechadaPeloPlano: true,
        itens: comanda.itens
      }, { empresaId, lojaId: comanda.lojaId, usuario: dados.usuario || 'operador' });
    } catch (e) {
      console.warn('[EventBus] Falha ao emitir comanda.fechada:', e.message);
    }
    return copiarComandaBarbearia(comanda);
  } catch (error) {
    restaurarRaiz(snapshot);
    throw error;
  }
}

/** Grava, no item coberto, o uso do plano que foi registrado na assinatura. */
export function registrarUsoPlanoNoItemComanda(empresaId, comandaId, itemId, { usoId = null, erro = null } = {}) {
  const comanda = estadoEmpresa(empresaId).comandas[String(comandaId)];
  const item = comanda?.itens?.find((linha) => linha.id === String(itemId));
  if (!item?.coberturaPlano) return null;
  if (usoId) {
    item.coberturaPlano.usoId = texto(usoId, 120);
    item.coberturaPlano.consumidoEm = item.coberturaPlano.consumidoEm || dataAtual();
    item.coberturaPlano.erro = null;
  } else if (erro) {
    item.coberturaPlano.erro = texto(erro, 300);
  }
  save();
  return { ...item.coberturaPlano };
}

/** Resultado da baixa de estoque na loja virtual para um item da comanda. */
export function registrarBaixaLojaNoItemComanda(empresaId, comandaId, itemId, { ok = false, movimento = null, erro = null } = {}) {
  const comanda = estadoEmpresa(empresaId).comandas[String(comandaId)];
  const item = comanda?.itens?.find((linha) => linha.id === String(itemId));
  if (!item || item.tipo !== 'loja') return null;
  item.estoqueLoja = {
    status: ok ? 'baixado' : 'pendente',
    movimento: ok ? movimento : (item.estoqueLoja?.movimento || null),
    erro: ok ? null : texto(erro, 300) || 'Baixa não realizada.',
    atualizadoEm: dataAtual(),
  };
  save();
  return { ...item.estoqueLoja };
}

export function validarCalendarioAgendamento(estado, agendamento, profissional) {
  const dataAgenda = String(agendamento.dataAgenda || chaveDia(agendamento.dataHora)).slice(0, 10);
  const calendario = obterCalendarioLoja(estado, agendamento.lojaId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAgenda)) throw new Error('Data operacional inválida.');
  if (!horaValida(agendamento.horaLocal)) throw new Error('Horário operacional inválido. Use HH:MM.');
  if (!Number.isFinite(new Date(agendamento.dataHora).valueOf())) throw new Error('Data e horário do atendimento são inválidos.');
  const dataLocal = new Date(`${dataAgenda}T12:00:00Z`);
  if (Number.isNaN(dataLocal.valueOf())) throw new Error('Data operacional inválida.');
  const diaSemana = dataLocal.getUTCDay();
  const isDino24x7 = ehProfissionalDino(profissional);
  if (!isDino24x7 && calendario.feriados?.includes(dataAgenda)) {
    throw new Error('A unidade não recebe reservas nesta data: feriado configurado.');
  }
  // Escala e dias de trabalho do profissional: SEMPRE checados e respeitados
  if (profissional && Array.isArray(profissional.diasTrabalho) && profissional.diasTrabalho.length > 0) {
    if (!profissional.diasTrabalho.includes(diaSemana)) {
      throw new Error(`O profissional ${profissional.nome || ''} não atende neste dia da semana.`);
    }
  }
  if (!isDino24x7) {
    if (Array.isArray(calendario.diasFuncionamento) && !calendario.diasFuncionamento.includes(diaSemana)) throw new Error('A unidade não funciona neste dia da semana.');
    const [hora, minuto] = agendamento.horaLocal.split(':').map(Number);
    const inicioMinutos = hora * 60 + minuto;
    const fimMinutos = inicioMinutos + agendamento.duracaoMinutos;
    const abertura = calendario.horarioAbertura.split(':').map(Number);
    const fechamento = calendario.horarioFechamento.split(':').map(Number);
    if (inicioMinutos < abertura[0] * 60 + abertura[1] || fimMinutos > fechamento[0] * 60 + fechamento[1]) throw new Error('Horário fora do funcionamento da unidade.');
    if (profissional) {
      if (Array.isArray(profissional.diasTrabalho) && !profissional.diasTrabalho.includes(dataLocal.getUTCDay())) throw new Error('O profissional não trabalha neste dia.');
      const inicioProf = profissional.horarioInicio.split(':').map(Number);
      const fimProf = profissional.horarioFim.split(':').map(Number);
      if (inicioMinutos < inicioProf[0] * 60 + inicioProf[1] || fimMinutos > fimProf[0] * 60 + fimProf[1]) throw new Error('Horário fora da jornada do profissional.');
    }
  }
}

export function checarConflitoAgendamento(empresaId, dados, ignorarId = '') {
  const estado = estadoEmpresa(empresaId);
  return verificarConflito(estado, dados, ignorarId);
}

function verificarConflito(estado, dados, ignorarId = '') {
  const inicio = new Date(dados.dataHora).valueOf();
  if (!Number.isFinite(inicio)) throw new Error('Data e horário do atendimento são inválidos.');
  const fim = inicio + dados.duracaoMinutos * 60 * 1000;
  const bloqueio = Object.values(estado.bloqueios).find((item) => item.ativo !== false && (!dados.lojaId || !item.lojaId || item.lojaId === dados.lojaId) && (!item.profissionalId || item.profissionalId === dados.profissionalId) && sobrepoe(dados.dataHora, new Date(fim).toISOString(), item.inicio, item.fim));
  if (bloqueio) return { tipo: 'bloqueio', ...bloqueio };
  return Object.values(estado.agendamentos).find((item) => {
    if (item.id === ignorarId || item.status === 'cancelado' || item.status === 'nao_compareceu') return false;
    if (!dados.profissionalId || item.profissionalId !== dados.profissionalId) return false;
    if (dados.lojaId && item.lojaId && item.lojaId !== dados.lojaId) return false;
    const outroInicio = new Date(item.dataHora).valueOf();
    const outroFim = outroInicio + item.duracaoMinutos * 60 * 1000;
    return inicio < outroFim && outroInicio < fim;
  });
}

function minutosHoraPublica(valor) {
  if (!horaValida(valor)) return NaN;
  const [hora, minuto] = String(valor).split(':').map(Number);
  return hora * 60 + minuto;
}

function horaPublica(minutos) {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

function offsetPublico(valor) {
  const recebido = texto(valor || process.env.BUSINESS_TIMEZONE_OFFSET || '-04:00', 6);
  return /^(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(recebido) ? recebido : '-04:00';
}

function dataHoraPublica(dataAgenda, horaLocal, utcOffset) {
  const iso = new Date(`${dataAgenda}T${horaLocal}:00${offsetPublico(utcOffset)}`).toISOString();
  if (!iso) throw new Error('Data e horário do atendimento são inválidos.');
  return iso;
}

function contextoDisponibilidadePublica(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId, false);
  const dataAgenda = texto(dados.data ?? dados.dataAgenda ?? dados.data_agenda, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAgenda)) throw new Error('Data do agendamento é obrigatória e deve usar o formato AAAA-MM-DD.');
  const servicoId = texto(dados.servicoId ?? dados.servico_id, 100);
  const servico = estado.servicos[servicoId];
  if (!servico || servico.ativo === false || servico.permiteAgendamentoOnline === false) throw new Error('Serviço indisponível para agendamento online.');
  const lojaId = texto(dados.lojaId ?? dados.loja_id, 120);
  const calendario = obterCalendarioLoja(estado, lojaId);
  const dia = new Date(`${dataAgenda}T12:00:00Z`);
  if (Number.isNaN(dia.valueOf())) throw new Error('Data operacional inválida.');
  const profFocoId = texto(dados.profissionalId ?? dados.profissional_id, 100);
  const profFoco = profFocoId && profFocoId !== 'qualquer' ? estado.profissionais[profFocoId] : null;
  if (!ehProfissionalDino(profFoco)) {
    if (calendario.feriados?.includes(dataAgenda) || (Array.isArray(calendario.diasFuncionamento) && !calendario.diasFuncionamento.includes(dia.getUTCDay()))) {
      return { estado, dataAgenda, servico, lojaId, calendario, profissionais: [] };
    }
  }
  const limiteHoje = new Date();
  limiteHoje.setUTCHours(12, 0, 0, 0);
  const limiteFinal = new Date(limiteHoje);
  limiteFinal.setUTCDate(limiteFinal.getUTCDate() + Number(calendario.janelaReservaDias || 60));
  const profissionalId = texto(dados.profissionalId ?? dados.profissional_id, 100);
  const habilitados = Array.isArray(servico.profissionaisIds) && servico.profissionaisIds.length ? new Set(servico.profissionaisIds) : null;
  const diaSemana = dia.getUTCDay();
  const ehEsteticaServico = /dermaplaning|limpeza de pele|estetica/i.test(String(servico.nome || ''));
  const profissionais = Object.values(estado.profissionais)
    .filter((item) => item.ativo !== false && item.atendeCliente !== false)
    .filter((item) => !/jhenyffer|jo[aã]o victor|david|amanda/i.test(String(item.nome || '')))
    .filter((item) => ehEsteticaServico || !/steffany|ester/i.test(String(item.nome || '')))
    .filter((item) => !habilitados || habilitados.has(item.id))
    .filter((item) => !profissionalId || profissionalId === 'qualquer' || item.id === profissionalId)
    .filter((item) => !Array.isArray(item.diasTrabalho) || item.diasTrabalho.length === 0 || item.diasTrabalho.includes(diaSemana))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const ehDinoFoco = (profissionalId && profissionalId !== 'qualquer' && profissionais.length === 1 && ehProfissionalDino(profissionais[0])) ||
                      (!profissionalId && habilitados && habilitados.size === 1 && ehProfissionalDino(estado.profissionais[[...habilitados][0]]));

  if (!ehDinoFoco && (dia < limiteHoje || dia > limiteFinal)) return { estado, dataAgenda, servico, lojaId, calendario, profissionais: [] };
  if (profissionalId && profissionalId !== 'qualquer' && habilitados && !habilitados.has(profissionalId)) throw new Error('Este profissional não realiza este serviço.');
  if (profissionalId && profissionalId !== 'qualquer' && profissionais.length === 0) throw new Error('Profissional indisponível para agendamento online.');
  const ignorarAgendamentoId = texto(dados.ignorarAgendamentoId ?? dados.ignorar_agendamento_id, 100);
  return { estado, dataAgenda, servico, lojaId, calendario, profissionais, ignorarAgendamentoId };
}

function profissionaisDisponiveisNoHorario(contexto, horaLocal, utcOffset) {
  const { estado, dataAgenda, servico, lojaId, calendario, profissionais, ignorarAgendamentoId } = contexto;
  const dataHora = dataHoraPublica(dataAgenda, horaLocal, utcOffset);
  if (new Date(dataHora).valueOf() < Date.now() + Number(calendario.antecedenciaMinutos || 0) * 60000) return [];
  const livres = [];
  for (const profissional of profissionais) {
    const duracaoMinutos = duracaoAtendimentoProfissional(servico, profissional, calendario);
    const candidato = {
      dataAgenda,
      horaLocal,
      dataHora,
      duracaoMinutos,
      servicoId: servico.id,
      profissionalId: profissional.id,
      lojaId,
    };
    try {
      validarCalendarioAgendamento(estado, candidato, profissional);
      if (!verificarConflito(estado, candidato, ignorarAgendamentoId || '')) {
        livres.push({ profissional, dataHora, duracaoMinutos });
      }
    } catch (_) {}
  }
  return livres;
}

function disponibilidadeNoHorario(contexto, horaLocal, utcOffset) {
  const livres = profissionaisDisponiveisNoHorario(contexto, horaLocal, utcOffset);
  return livres[0] || null;
}

export function listarHorariosDisponiveis(empresaId, dados = {}) {
  const contexto = contextoDisponibilidadePublica(empresaId, dados);
  if (contexto.profissionais.length === 0) return [];
  const ehDino = contexto.profissionais.length === 1 && ehProfissionalDino(contexto.profissionais[0]);
  const aberturaLoja = minutosHoraPublica(contexto.calendario.horarioAbertura || "08:00");
  const fechamentoLoja = minutosHoraPublica(contexto.calendario.horarioFechamento || "20:00");
  const abertura = (ehDino && dados.permitirMadrugada === true) ? 0 : aberturaLoja;
  const fechamento = (ehDino && dados.permitirMadrugada === true) ? 1440 : fechamentoLoja;
  const intervalo = Math.max(5, Number(contexto.calendario.intervaloMinutos || 15));
  if (!Number.isFinite(abertura) || !Number.isFinite(fechamento) || fechamento <= abertura) throw new Error('Horário de funcionamento inválido.');
  const duracao = contexto.profissionais.length === 1
    ? duracaoAtendimentoProfissional(contexto.servico, contexto.profissionais[0], contexto.calendario)
    : (contexto.servico.duracaoMinutos || 15);
  const horarios = [];
  for (let minuto = abertura; minuto + duracao <= fechamento; minuto += intervalo) {
    const horario = horaPublica(minuto);
    const livres = profissionaisDisponiveisNoHorario(contexto, horario, dados.utcOffset ?? dados.utc_offset);
    const livre = livres[0] || null;
    const nomeCurtoProf = (p) => {
      if (ehProfissionalDino(p)) return 'Dino';
      const ap = String(p.apelido || '').trim();
      if (ap) return ap;
      const n = String(p.nome || '').trim();
      if (/natani/i.test(n)) return 'Nati';
      if (/bruno/i.test(n)) return 'Bruno';
      return n.split(' ')[0] || n;
    };
    const nomesLivres = [...new Set(livres.map((item) => nomeCurtoProf(item.profissional)).filter(Boolean))];
    horarios.push({
      horario,
      disponivel: Boolean(livre),
      profissionalId: livre?.profissional?.id || null,
      profissionalNome: nomesLivres.length > 1 ? nomesLivres.join(' ou ') : (nomesLivres[0] || null),
      profissionaisDisponiveis: nomesLivres,
    });
  }
  return horarios;
}

export function resolverProfissionalDisponivel(empresaId, dados = {}) {
  const contexto = contextoDisponibilidadePublica(empresaId, dados);
  const horaLocal = texto(dados.horario ?? dados.horaLocal ?? dados.hora_local, 5);
  if (!horaValida(horaLocal)) throw new Error('Horário do agendamento é inválido.');
  const livre = disponibilidadeNoHorario(contexto, horaLocal, dados.utcOffset ?? dados.utc_offset);
  if (!livre) throw new Error('Horário indisponível. Escolha outra opção.');
  return { profissional: { ...livre.profissional }, dataHora: livre.dataHora, dataAgenda: contexto.dataAgenda, horaLocal };
}

function chaveVagaAgendamento(agendamento) {
  const { empresaId, lojaId, profissionalId, dataAgenda, horaLocal } = agendamento;
  return profissionalId && dataAgenda && horaLocal
    ? JSON.stringify([empresaId, lojaId || '', profissionalId, dataAgenda, horaLocal])
    : null;
}

function ocupaVagaRecuperada(agendamento) {
  return !agendamento.encaixe && ['agendado', 'confirmado', 'em_atendimento', 'concluido'].includes(agendamento.status);
}

function cancelamentoLiberaVaga(agendamento, chave, criadoEm) {
  if (agendamento?.status !== 'cancelado' || agendamento.encaixe
    || chaveVagaAgendamento(agendamento) !== chave) return false;
  const canceladoEm = Date.parse(agendamento.canceladoEm);
  return canceladoEm < Date.parse(criadoEm)
    && !(agendamento.historicoRemarcacoes || []).some((mudanca) => Date.parse(mudanca.registradoEm) >= canceladoEm);
}

function identificarVagaLiberada(agendamentos, novo) {
  const chave = chaveVagaAgendamento(novo);
  if (!chave || !ocupaVagaRecuperada(novo)) return null;
  let cancelamento = null;
  for (const agendamento of Object.values(agendamentos)) {
    if (!agendamento || chaveVagaAgendamento(agendamento) !== chave) continue;
    if (ocupaVagaRecuperada(agendamento)) return null;
    if (cancelamentoLiberaVaga(agendamento, chave, novo.criadoEm)
      && (!cancelamento || Date.parse(agendamento.canceladoEm) > Date.parse(cancelamento.canceladoEm))) {
      cancelamento = agendamento;
    }
  }
  return cancelamento?.id ?? null;
}

// `opcoes.permitirEncaixe`: só o painel da equipe passa (nunca o link público nem a IA).
// O encaixe aceita sobreposição com outro atendimento do mesmo profissional e fica marcado.
export function criarAgendamento(empresaId, dados = {}, opcoes = {}) {
  if (dados.encaixe === true || dados.permitirEncaixe === true) {
    opcoes = { ...opcoes, permitirEncaixe: true };
  }
  rejeitarPagamentoNaAgenda(dados);
  if (dados.status && dados.status !== 'agendado') throw new Error('Status inicial do agendamento deve ser agendado.');
  const estado = estadoEmpresa(empresaId);
  const agendamento = agendamentoNormalizado(dados, {}, opcoes);
  if (obterConfiguracao(empresaId).confirmacaoAutomaticaAtiva === true && agendamento.status === 'agendado') {
    agendamento.confirmacaoAutomatica = estadoConfirmacaoInicial();
  }
  if (!agendamento.clienteNome && !agendamento.clienteId) throw new Error('Informe o cliente do atendimento.');
  if (!agendamento.servicoId || !estado.servicos[agendamento.servicoId] || estado.servicos[agendamento.servicoId].ativo === false) throw new Error('Serviço ativo é obrigatório.');
  if (agendamento.profissionalId && (!estado.profissionais[agendamento.profissionalId] || estado.profissionais[agendamento.profissionalId].ativo === false)) throw new Error('Profissional não encontrado ou inativo.');
  const profissional = agendamento.profissionalId ? estado.profissionais[agendamento.profissionalId] : null;
  const servico = estado.servicos[agendamento.servicoId];
  if (dados.duracaoMinutos) {
    agendamento.duracaoMinutos = Math.max(5, Math.min(480, Math.round(Number(dados.duracaoMinutos))));
  } else if (false) {
    agendamento.duracaoMinutos = atual.duracaoMinutos;
  } else {
    agendamento.duracaoMinutos = duracaoAtendimentoProfissional(servico, profissional, obterCalendarioLoja(estado, agendamento.lojaId));
  }
  const precoCalculado = calcularPrecoServicoHorario(servico, profissional, agendamento.horaLocal);
  if (dados.valor !== undefined && Math.round(Number(dados.valor) * 100) !== Math.round(Number(precoCalculado) * 100) && Math.round(Number(dados.valor) * 100) !== Math.round(Number(servico.preco) * 100)) {
    throw new Error('O valor do agendamento deve corresponder ao preço cadastrado do serviço. Use a comanda para ajustes auditados.');
  }
  agendamento.valor = precoCalculado;
  validarCalendarioAgendamento(estado, agendamento, profissional);
  if (verificarConflito(estado, agendamento)) {
    if (opcoes.permitirEncaixe !== true) throw new Error('Horário indisponível para o profissional selecionado.');
    agendamento.encaixe = true;
  }
  if(agendamento.usarPlano) agendamento.assinaturaId=validarAgendamentoComPlano(empresaId,agendamento,opcoes);
  const id = novoId('age', estado.agendamentos);
  const agora = dataAtual();
  const novo = { id, empresaId: String(empresaId), ...agendamento, criadoEm: agora, atualizadoEm: agora };
  const vagaOrigemId = identificarVagaLiberada(estado.agendamentos, novo);
  estado.agendamentos[id] = vagaOrigemId ? { ...novo, vagaOrigemId } : novo;
  save();
  return { ...estado.agendamentos[id] };
}

export function atualizarAgendamento(empresaId, agendamentoId, dados = {}, opcoes = {}) {
  rejeitarPagamentoNaAgenda(dados);
  const estado = estadoEmpresa(empresaId);
  const atual = estado.agendamentos[String(agendamentoId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;
  const lojaInformada = dados.lojaId !== undefined ? texto(dados.lojaId, 120) : '';
  const lojaAtual = texto(atual.lojaId, 120);
  if (!lojasEquivalentes(empresaId, lojaAtual, lojaInformada)) return null;
  const statusAntes = atual.status;
  const antes = { dataHora: atual.dataHora, dataAgenda: atual.dataAgenda, horaLocal: atual.horaLocal, profissionalId: atual.profissionalId, servicoId: atual.servicoId };
  const agendamento = agendamentoNormalizado(dados, atual, opcoes);
  if (!agendamento.lojaId && lojaInformada) {
    agendamento.lojaId = legacyLojaIdFromCommerce(lojaInformada, empresaId);
  }
  const STATUS_VALIDOS = ['agendado', 'confirmado', 'concluido', 'cancelado', 'nao_compareceu'];
  agendamento.status = (dados.status && STATUS_VALIDOS.includes(dados.status)) ? dados.status : atual.status;
  if (agendamento.status === 'cancelado') {
    const motivoInformado = texto(dados.motivoCancelamento ?? dados.motivo_cancelamento ?? dados.motivo ?? atual.motivoCancelamento, 120);
    if (!motivoInformado && opcoes.permitirSemMotivoLegado !== true) {
      const err = new Error('Selecione um motivo de cancelamento da lista oficial antes de confirmar.');
      err.code = 'CANCEL_REASON_REQUIRED';
      throw err;
    }
    agendamento.motivoCancelamento = motivoInformado || 'pedido_do_cliente';
    agendamento.canceladoPor = texto(dados.canceladoPor ?? dados.cancelado_por ?? dados.usuario ?? atual.canceladoPor ?? 'equipe', 80);
    agendamento.canceladoEm = statusAntes === 'cancelado' && atual.canceladoEm ? atual.canceladoEm : dataAtual();
    agendamento.canalCancelamento = texto(dados.canalCancelamento ?? dados.canal ?? dados.origem ?? atual.canalCancelamento ?? 'painel_admin', 60);
    agendamento.origemCancelamento = agendamento.canalCancelamento;
  }
  if (!agendamento.servicoId || !estado.servicos[agendamento.servicoId] || estado.servicos[agendamento.servicoId].ativo === false) throw new Error('Serviço ativo é obrigatório.');
  const profissional = agendamento.profissionalId ? estado.profissionais[agendamento.profissionalId] : null;
  const servico = estado.servicos[agendamento.servicoId];
  agendamento.duracaoMinutos = dados.duracaoMinutos
    ? Math.max(5, Math.min(480, Math.round(Number(dados.duracaoMinutos))))
    : duracaoAtendimentoProfissional(servico, profissional, obterCalendarioLoja(estado, agendamento.lojaId));
  const precoCalculado = calcularPrecoServicoHorario(servico, profissional, agendamento.horaLocal);
  const valorEsperado = agendamento.servicoId === atual.servicoId && Number(atual.valor) > 0 ? atual.valor : precoCalculado;
  if (dados.valor !== undefined && (!Number.isFinite(Number(dados.valor)) || Math.round(Number(dados.valor) * 100) !== Math.round(valorEsperado * 100))) {
    throw new Error('O valor do agendamento não pode ser alterado. Use a comanda para ajustes auditados.');
  }
  agendamento.valor = valorEsperado;
  const mudouHorarioOuProf = ['dataHora', 'dataAgenda', 'horaLocal', 'profissionalId'].some((campo) => String(antes[campo] || '') !== String(agendamento[campo] || ''));
  if (mudouHorarioOuProf) {
    if (atual.vagaOrigemId) agendamento.vagaOrigemId = null;
    validarCalendarioAgendamento(estado, agendamento, agendamento.profissionalId ? estado.profissionais[agendamento.profissionalId] : null);
    if (verificarConflito(estado, agendamento, atual.id)) {
      if (opcoes.permitirEncaixe !== true) throw new Error('Horário indisponível para o profissional selecionado.');
      agendamento.encaixe = true;
    } else {
      agendamento.encaixe = false;
    }
  }
  if(agendamento.usarPlano) agendamento.assinaturaId=validarAgendamentoComPlano(empresaId,agendamento,{...opcoes,ignorarAgendamentoId:atual.id});
  const remarcado = ['dataHora', 'dataAgenda', 'profissionalId', 'servicoId'].some((campo) => String(antes[campo] || '') !== String(agendamento[campo] || ''));
  if (remarcado) {
    atual.historicoRemarcacoes ||= [];
    atual.historicoRemarcacoes.unshift({
      id: `rem-${Date.now().toString(36)}-${atual.historicoRemarcacoes.length + 1}`,
      antes,
      depois: { dataHora: agendamento.dataHora, dataAgenda: agendamento.dataAgenda, profissionalId: agendamento.profissionalId, servicoId: agendamento.servicoId },
      origem: texto(dados.origem || 'admin', 60),
      responsavel: texto(dados.usuario, 120) || null,
      registradoEm: dataAtual(),
    });
    atual.historicoRemarcacoes = atual.historicoRemarcacoes.slice(0, 50);
    if (statusAntes === 'confirmado' && agendamento.status === 'confirmado') agendamento.status = 'agendado';
    if (obterConfiguracao(empresaId).confirmacaoAutomaticaAtiva === true && agendamento.status === 'agendado') {
      agendamento.confirmacaoAutomatica = estadoConfirmacaoInicial();
    } else if (atual.confirmacaoAutomatica) {
      agendamento.confirmacaoAutomatica = { ...atual.confirmacaoAutomatica, ativa: false, status: 'remarcado', prazoRespostaAte: null };
    }
  }
  Object.assign(atual, agendamento, { atualizadoEm: dataAtual() });
  save();
  return { ...atual };
}

export function alterarStatusAgendamento(empresaId, agendamentoId, status, dados = {}) {
  rejeitarPagamentoNaAgenda(dados);
  const estado = estadoEmpresa(empresaId);
  const atual = estado.agendamentos[String(agendamentoId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;
  const lojaInformada = dados.lojaId !== undefined ? texto(dados.lojaId, 120) : '';
  const lojaAtual = texto(atual.lojaId, 120);
  if (!lojasEquivalentes(empresaId, lojaAtual, lojaInformada)) return null;
  if (!atual.lojaId && lojaInformada) {
    atual.lojaId = legacyLojaIdFromCommerce(lojaInformada, empresaId);
  }
  const novoStatus = String(status || '');
  if (!STATUS.has(novoStatus)) throw new Error('Status de atendimento inválido.');
  if (novoStatus !== atual.status && !TRANSICOES[atual.status]?.has(novoStatus)) {
    throw new Error(`Transição de ${atual.status} para ${novoStatus} não permitida.`);
  }
  const isDino = ['d0d0ac01-8e50-4b61-8c79-de4aaa916da6', 'emp_dino', 'dino'].includes(String(empresaId || '').toLowerCase());
  if (isDino && novoStatus === 'cancelado') {
    const origem = String(dados.origem || dados.canceladoPor || '').toLowerCase();
    if (['sistema', 'confirmacao_automatica', 'expiracao_sinal', 'robo', 'bot_autonomo', 'worker_autonomo'].includes(origem)) {
      const erro = new Error('Na Barbearia Dino, cancelamentos automáticos do sistema são proibidos. O cancelamento só pode ser solicitado pelo cliente ou realizado manualmente pelo atendente.');
      erro.code = 'CANCELAMENTO_AUTOMATICO_BLOQUEADO';
      throw erro;
    }
  }
  const canceladoPor = novoStatus === 'cancelado'
    ? texto(dados.canceladoPor ?? dados.cancelado_por ?? (dados.origem === 'cliente' ? 'cliente' : (dados.origem === 'atendente' ? 'atendente' : atual.canceladoPor || 'equipe')), 80)
    : atual.canceladoPor;
  const motivoCancelamentoResolvido = novoStatus === 'cancelado'
    ? texto(dados.motivoCancelamento ?? dados.motivo_cancelamento ?? dados.motivo ?? atual.motivoCancelamento, 120)
    : atual.motivoCancelamento;
  if (novoStatus === 'cancelado' && !motivoCancelamentoResolvido && dados.permitirSemMotivoLegado !== true) {
    const erroMotivo = new Error('Selecione um motivo de cancelamento da lista oficial antes de confirmar.');
    erroMotivo.code = 'CANCEL_REASON_REQUIRED';
    throw erroMotivo;
  }
  if (atual.status === 'concluido' && atual.financeiroLancamentoId && novoStatus !== 'concluido') {
    throw new Error('Não é possível alterar status de atendimento já faturado no financeiro.');
  }
  // Na Barbearia Dino e Kytto: Confirmação de cliente e recepção NUNCA expira nem é bloqueada!
  // Se o cliente ou a equipe confirmou, o agendamento é imediatamente confirmado com sucesso.
  const canalCancelamento = novoStatus === 'cancelado'
    ? texto(dados.canalCancelamento ?? dados.canal ?? dados.origem ?? atual.canalCancelamento ?? canceladoPor ?? 'painel_admin', 80)
    : atual.canalCancelamento;
  Object.assign(atual, {
    status: novoStatus,
    observacoes: texto(dados.observacoes ?? atual.observacoes, 600),
    motivoCancelamento: motivoCancelamentoResolvido,
    canceladoPor,
    canceladoEm: novoStatus === 'cancelado' && (atual.status !== 'cancelado' || !atual.canceladoEm) ? dataAtual() : atual.canceladoEm,
    canalCancelamento,
    origemCancelamento: novoStatus === 'cancelado' ? canalCancelamento : atual.origemCancelamento,
    atualizadoEm: dataAtual(),
  });
  if (novoStatus === 'confirmado') {
    if (atual.confirmacaoAutomatica) {
      atual.confirmacaoAutomatica = { ...atual.confirmacaoAutomatica, ativa: false, status: 'confirmado', confirmadoEm: dataAtual(), prazoRespostaAte: null };
    }
    if (atual.motivoCancelamento === 'falta_confirmacao') atual.motivoCancelamento = '';
  } else if (novoStatus === 'cancelado' && atual.confirmacaoAutomatica) {
    atual.confirmacaoAutomatica = { ...atual.confirmacaoAutomatica, status: 'cancelado', prazoRespostaAte: null };
  }
  save();
  return { ...atual };
}

function estadoConfirmacaoInicial() {
  return { ativa: true, status: 'aguardando', primeiraEnviadaEm: null, segundaEnviadaEm: null, prazoRespostaAte: null, confirmadoEm: null };
}

export function inicializarConfirmacaoAutomatica(empresaId, agendamentoId, { lojaId = '' } = {}) {
  if (obterConfiguracao(empresaId).confirmacaoAutomaticaAtiva !== true) return null;
  const atual = estadoEmpresa(empresaId).agendamentos[String(agendamentoId)];
  if (!atual || atual.empresaId !== String(empresaId) || (lojaId && !lojasEquivalentes(empresaId, atual.lojaId, lojaId))) return null;
  if (atual.status !== 'agendado') return null;
  if (atual.confirmacaoAutomatica?.ativa === true) return { ...atual };
  atual.confirmacaoAutomatica = estadoConfirmacaoInicial();
  atual.atualizadoEm = dataAtual();
  save();
  return { ...atual };
}

export function registrarConfirmacaoAutomaticaEnviada(empresaId, agendamentoId, etapa, { lojaId = '', enviadoEm = new Date() } = {}) {
  if (obterConfiguracao(empresaId).confirmacaoAutomaticaAtiva !== true) return null;
  const atual = estadoEmpresa(empresaId).agendamentos[String(agendamentoId)];
  if (!atual || atual.empresaId !== String(empresaId) || (lojaId && !lojasEquivalentes(empresaId, atual.lojaId, lojaId)) || atual.status !== 'agendado') return null;
  if (atual.confirmacaoAutomatica?.ativa !== true) atual.confirmacaoAutomatica = estadoConfirmacaoInicial();
  const instante = new Date(enviadoEm);
  if (!Number.isFinite(instante.valueOf())) return null;
  if (etapa === 'primeira') {
    if (atual.confirmacaoAutomatica.status !== 'aguardando') return { ...atual };
    atual.confirmacaoAutomatica = { ...atual.confirmacaoAutomatica, status: 'primeira_enviada', primeiraEnviadaEm: instante.toISOString() };
  } else if (etapa === 'segunda') {
    if (atual.confirmacaoAutomatica.status !== 'primeira_enviada' || !atual.confirmacaoAutomatica.primeiraEnviadaEm) return null;
    const horaMarcada = new Date(atual.dataHora).valueOf();
    if (!Number.isFinite(horaMarcada) || horaMarcada - instante.valueOf() < 2 * 60 * 60 * 1000) return null;
    const prazo = new Date(instante.valueOf() + 60 * 60 * 1000);
    if (horaMarcada - prazo.valueOf() < 60 * 60 * 1000) return null;
    atual.confirmacaoAutomatica = { ...atual.confirmacaoAutomatica, status: 'segunda_enviada', segundaEnviadaEm: instante.toISOString(), prazoRespostaAte: prazo.toISOString() };
  } else return null;
  atual.atualizadoEm = dataAtual();
  save();
  return { ...atual };
}

export function cancelarPorFaltaConfirmacao(empresaId, agendamentoId, { lojaId = '', agora = new Date() } = {}) {
  // BLINDAGEM PERMANENTE: NUNCA cancelar agendamentos automaticamente por timeout ou falta de confirmação!
  // Todos os agendamentos são firmes, garantidos e não possuem tempo limite de resposta nem expiração.
  return null;
  const isDino = ['d0d0ac01-8e50-4b61-8c79-de4aaa916da6', 'emp_dino', 'dino'].includes(String(empresaId || '').toLowerCase());
  const cfg = obterConfiguracao(empresaId);
  if (isDino || cfg.confirmacaoAutomaticaAtiva !== true || cfg.cancelamentoAutomaticoPorFaltaConfirmacao !== true) return null;
  const atual = estadoEmpresa(empresaId).agendamentos[String(agendamentoId)];
  if (!atual || atual.empresaId !== String(empresaId) || (lojaId && atual.lojaId && String(atual.lojaId) !== String(lojaId))
      || atual.status !== 'agendado' || atual.confirmacaoAutomatica?.ativa !== true
      || atual.confirmacaoAutomatica.status !== 'segunda_enviada' || !atual.confirmacaoAutomatica.prazoRespostaAte) return null;
  const nowMs = new Date(agora).valueOf();
  const deadlineMs = new Date(atual.confirmacaoAutomatica.prazoRespostaAte).valueOf();
  const appointmentMs = new Date(atual.dataHora).valueOf();
  if (!Number.isFinite(nowMs) || !Number.isFinite(deadlineMs) || !Number.isFinite(appointmentMs)
      || nowMs < deadlineMs || nowMs >= appointmentMs || appointmentMs - deadlineMs < 60 * 60 * 1000) return null;
  const anterior = atual.status;
  const registradoEm = new Date(nowMs).toISOString();
  atual.status = 'cancelado';
  atual.motivoCancelamento = 'falta_confirmacao';
  atual.historicoStatus ||= [];
  atual.historicoStatus.unshift({ statusAnterior: anterior, status: 'cancelado', motivo: 'falta_confirmacao', registradoEm, origem: 'confirmacao_automatica' });
  atual.historicoStatus = atual.historicoStatus.slice(0, 100);
  atual.confirmacaoAutomatica = { ...atual.confirmacaoAutomatica, status: 'cancelado_falta_confirmacao', prazoRespostaAte: null, canceladoEm: registradoEm };
  atual.atualizadoEm = registradoEm;
  save();
  return { ...atual, historicoStatus: atual.historicoStatus.map((item) => ({ ...item })) };
}

export function sanearConfirmacoesDino(empresaId) {
  const estado = estadoEmpresa(empresaId);
  let restaurados = 0;
  let prazosLimpos = 0;
  let concluidosSincronizados = 0;
  let motivosPreenchidos = 0;

  // 0. Garantir profissionais históricos da AVEC (ex.: prof-mv1a1nmm-008 -> David Kauã Araújo Moraes) e unificar Bruno
  estado.profissionais ||= {};
  if (!estado.profissionais['prof-mv1a1nmm-008']) {
    estado.profissionais['prof-mv1a1nmm-008'] = {
      id: 'prof-mv1a1nmm-008',
      empresaId: String(empresaId),
      nome: 'David Kauã Araújo Moraes',
      apelido: 'David',
      especialidade: 'Barbeiro (Histórico AVEC)',
      tipo: 'parceiro',
      percentualComissao: 40,
      percentualComissaoProduto: 10,
      ativo: false,
      atendeAgenda: false,
      historicoAvec: true,
      removidoEm: dataAtual(),
      criadoEm: dataAtual(),
      atualizadoEm: dataAtual(),
    };
  } else {
    estado.profissionais['prof-mv1a1nmm-008'].nome = 'David Kauã Araújo Moraes';
    estado.profissionais['prof-mv1a1nmm-008'].apelido = 'David';
    estado.profissionais['prof-mv1a1nmm-008'].ativo = false;
  }
  if (estado.profissionais['prof-mvsqchmy-023'] && estado.profissionais['prof-mtj69hhx-002']) {
    estado.profissionais['prof-mtj69hhx-002'].nome = 'Bruno Mendes Pedroso';
    estado.profissionais['prof-mtj69hhx-002'].apelido = 'Bruno';
    estado.profissionais['prof-mvsqchmy-023'].ativo = false;
    estado.profissionais['prof-mvsqchmy-023'].oculto = true;
    estado.profissionais['prof-mvsqchmy-023'].consolidadoEm = 'prof-mtj69hhx-002';
    for (const ag of Object.values(estado.agendamentos || {})) {
      if (ag && ag.profissionalId === 'prof-mvsqchmy-023') ag.profissionalId = 'prof-mtj69hhx-002';
    }
    for (const cmd of Object.values(estado.comandas || {})) {
      if (cmd && cmd.profissionalId === 'prof-mvsqchmy-023') cmd.profissionalId = 'prof-mtj69hhx-002';
      for (const it of cmd?.itens || []) {
        if (it && it.profissionalId === 'prof-mvsqchmy-023') it.profissionalId = 'prof-mtj69hhx-002';
      }
    }
  }

  // 0.1 Sincronizar comandas pagas com seus agendamentos vinculados
  for (const cmd of Object.values(estado.comandas || {})) {
    if (!cmd || (cmd.status !== 'paga' && cmd.status !== 'em_conta')) continue;
    const agIds = [...new Set([cmd.agendamentoId, ...(cmd.itens || []).map((i) => i?.agendamentoId)].filter(Boolean))];
    for (const agId of agIds) {
      const ag = estado.agendamentos?.[String(agId)];
      if (ag && ag.status !== 'concluido' && ag.status !== 'cancelado') {
        ag.status = 'concluido';
        ag.comandaId = cmd.id;
        ag.concluidoEm = ag.concluidoEm || cmd.fechadaEm || dataAtual();
        ag.atualizadoEm = dataAtual();
        concluidosSincronizados++;
      }
    }
  }

  for (const ag of Object.values(estado.agendamentos || {})) {
    // Garantir profissional vinculado em 100% dos agendamentos
    if (!ag.profissionalId || !estado.profissionais[ag.profissionalId]) {
      const srvNome = String(estado.servicos?.[ag.servicoId]?.nome || ag.servicoNome || '').toLowerCase();
      const cliNome = String(ag.clienteNome || '').toLowerCase();
      if (srvNome.includes('dino') || srvNome.includes('prótese') || srvNome.includes('protese') || cliNome.includes('dino')) {
        ag.profissionalId = 'prof-mtj67o7r-001';
      } else if (srvNome.includes('nati') || cliNome.includes('nati')) {
        ag.profissionalId = estado.profissionais['prof-mtj6b9fg-003'] ? 'prof-mtj6b9fg-003' : 'prof-mtj69hhx-002';
      } else {
        ag.profissionalId = 'prof-mtj69hhx-002';
      }
      ag.profissionalAtribuidoAutomaticamente = true;
    }
    // 1. Limpar travas de prazo em todos os agendamentos
    if (ag.confirmacaoAutomatica?.prazoRespostaAte || ag.confirmacaoAutomatica?.status === 'segunda_enviada') {
      ag.confirmacaoAutomatica.prazoRespostaAte = null;
      if (ag.confirmacaoAutomatica.status === 'segunda_enviada') {
        ag.confirmacaoAutomatica.status = ag.status === 'confirmado' ? 'confirmado' : 'primeira_enviada';
      }
      ag.confirmacaoAutomatica.ativa = false;
      prazosLimpos++;
    }
    // 2. Restaurar agendamentos cancelados indevidamente por falta_confirmacao
    if (ag.status === 'cancelado' && (ag.motivoCancelamento === 'falta_confirmacao' || ag.confirmacaoAutomatica?.status === 'cancelado_falta_confirmacao')) {
      const dAg = String(ag.dataAgenda || ag.dataHora || '').slice(0, 10);
      if (dAg >= '2026-11-05') {
        ag.status = (ag.observacoes && ag.observacoes.toLowerCase().includes('confirmad')) ? 'confirmado' : 'agendado';
        ag.motivoCancelamento = '';
        if (ag.confirmacaoAutomatica) {
          ag.confirmacaoAutomatica.status = ag.status === 'confirmado' ? 'confirmado' : 'aguardando';
          ag.confirmacaoAutomatica.canceladoEm = null;
          ag.confirmacaoAutomatica.prazoRespostaAte = null;
          ag.confirmacaoAutomatica.ativa = false;
        }
        ag.atualizadoEm = dataAtual();
        restaurados++;
      }
    }
    // 3. Preencher motivo e trilha de auditoria em cancelamentos legados que estavam em branco
    if (ag.status === 'cancelado' && !String(ag.motivoCancelamento || '').trim()) {
      ag.motivoCancelamento = ag.origem === 'avec' ? 'importado_cancelado_avec' : 'cancelamento_operacional_balcao';
      ag.canceladoPor = ag.canceladoPor || 'equipe';
      ag.canceladoEm = ag.canceladoEm || ag.atualizadoEm || ag.criadoEm || dataAtual();
      ag.canalCancelamento = ag.canalCancelamento || ag.origem || 'painel_admin';
      motivosPreenchidos++;
    }
  }
  // 4. Saneamento de comandas canceladas: cancelamento de pacotes pendentes e estorno de saldo
  const resPacotes = sanearComandasCanceladasEPacotes(empresaId);

  if (prazosLimpos > 0 || restaurados > 0 || concluidosSincronizados > 0 || motivosPreenchidos > 0 || resPacotes.totalAssinaturasCanceladas > 0 || resPacotes.totalUsosEstornados > 0) save();
  return { prazosLimpos, restaurados, concluidosSincronizados, motivosPreenchidos, ...resPacotes };
}

/**
 * Saneamento de comandas canceladas e pacotes:
 * Garante que nenhuma assinatura permaneça ativa a partir de comanda cancelada,
 * e que nenhum saldo de sessão fique indevidamente debitado.
 */
export function sanearComandasCanceladasEPacotes(empresaId) {
  const estado = estadoEmpresa(empresaId);
  let totalAssinaturasCanceladas = 0;
  let totalUsosEstornados = 0;

  for (const comanda of Object.values(estado.comandas || {})) {
    if (comanda.empresaId !== String(empresaId)) continue;
    if (comanda.status !== 'cancelada') continue;

    const res = cancelarPacotesEEstornarUsosComanda(empresaId, comanda, {
      motivo: 'Saneamento automático: cancelamento de pacote e estorno de saldo de comanda cancelada',
      usuario: 'Saneamento Automático'
    });
    totalAssinaturasCanceladas += res.assinaturasCanceladas.length;
    totalUsosEstornados += res.usosEstornados;
  }

  // Também varre assinaturas cujo comandaId aponte para comanda cancelada
  for (const ass of Object.values(estado.assinaturas || {})) {
    if (ass.empresaId !== String(empresaId)) continue;
    if (ass.status === 'cancelada') continue;
    if (ass.comandaId) {
      const cmd = estado.comandas[ass.comandaId];
      if (!cmd || cmd.status === 'cancelada') {
        ass.status = 'cancelada';
        ass.canceladaEm = dataAtual();
        ass.motivoCancelamento = 'Comanda de origem cancelada';
        ass.atualizadoEm = dataAtual();
        totalAssinaturasCanceladas++;
      }
    }
  }

  if (totalAssinaturasCanceladas > 0 || totalUsosEstornados > 0) save();
  return { totalAssinaturasCanceladas, totalUsosEstornados };
}

export function recebimentoAgendamentoVerificado(empresaId, agendamento) {
  if (!agendamento?.financeiroLancamentoId || agendamento.status !== 'concluido') return null;
  const lancamento = financeiroKytto.obterLancamento(empresaId, agendamento.financeiroLancamentoId);
  const chave = `barbearia_atendimento:${empresaId}:${agendamento.id}`;
  return lancamento?.tipo === 'receita' && lancamento.status === 'pago'
    && lancamento.origem === 'barbearia_atendimento' && lancamento.chaveIdempotencia === chave
    && Number(lancamento.valor) > 0 ? lancamento : null;
}

export function calcularComissoesEstado(estado, empresaId, { data = '', lojaId = '', inicio = '', fim = '', detalhar = false, profissionalId: somenteProfissional = '', strictUnit = false, capturedOnly = false, recebimentoAgendamento = null, custoMaterialServicoFn = null, semBonificacao = false } = {}) {
  // Função pura: `estado` é somente lido; callbacks permitem usar um snapshot sem tocar no db global.
  // Filtro por dia (data) ou por período (inicio/fim, AAAA-MM-DD inclusivos).
  const diaIni = String(inicio || '').slice(0, 10);
  const diaFim = String(fim || '').slice(0, 10);
  const noFiltro = (dia) => {
    const d = String(dia || '').slice(0, 10);
    if (data) return d === String(data).slice(0, 10);
    if (diaIni && d < diaIni) return false;
    if (diaFim && d > diaFim) return false;
    return true;
  };
  const filtrarLoja = (item) => strictUnit
    ? Boolean(lojaId) && item?.lojaId === String(lojaId)
    : (!lojaId || !item?.lojaId || item.lojaId === String(lojaId));
  const comandasTodas = Object.values(estado.comandas || {})
    .filter(filtrarLoja)
    .filter((item) => capturedOnly ? item.status === 'paga' : (item.status === 'paga' || item.status === 'em_conta'));
  const dataOperacionalComanda = (comanda) => {
    const dAtend = comanda?.dataAtendimento ? String(comanda.dataAtendimento).slice(0, 10) : '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dAtend)) return dAtend;
    return diaOperacional(comanda?.fechadaEm || comanda?.atualizadoEm || comanda?.criadoEm);
  };
  const obterSubtotalItem = (item) => {
    if (item && item.subtotal !== undefined && item.subtotal !== null && item.subtotal !== '') {
      const val = Number(item.subtotal);
      if (Number.isFinite(val)) return Number(val.toFixed(2));
    }
    return Number((Number(item?.precoUnitario ?? item?.preco ?? 0) * Number(item?.quantidade ?? 1)).toFixed(2));
  };
  const comandasPagas = comandasTodas
    .filter((item) => noFiltro(dataOperacionalComanda(item)));
  // Atendimento que virou comanda conta só pela comanda, mesmo que ela seja paga em outro dia.
  const agendamentosEmComanda = new Set(comandasTodas.flatMap((item) => [item.agendamentoId, ...(item.itens || []).map(i => i.agendamentoId)]).filter(Boolean));
  // Desconto da comanda reduz a base de comissão proporcionalmente em cada item.
  const fatorDesconto = (comanda) => {
    const subtotal = (comanda.itens || []).reduce((soma, item) => soma + obterSubtotalItem(item), 0);
    if (subtotal <= 0) return 1;
    const desconto = Math.min(subtotal, Math.max(0, Number(comanda.desconto || 0)));
    const somaPags = (comanda.pagamentos || [])
      .filter((p) => !p.estornado && !p.cancelado)
      .reduce((s, p) => s + Number(p.valor || 0), 0);
    const liquidoRef = (somaPags > 0 && somaPags < subtotal && desconto === 0)
      ? somaPags
      : Math.max(0, subtotal - desconto);
    return liquidoRef / subtotal;
  };
  // Comanda paga com mais de um meio: a taxa de maquininha é rateada pelo valor de cada meio.
  const rateioPagamentos = (comanda) => {
    const pagamentos = (comanda.pagamentos || []).filter((pagamento) => Number(pagamento.valor) > 0);
    const soma = pagamentos.reduce((total, pagamento) => total + Number(pagamento.valor), 0);
    return soma > 0 ? pagamentos.map((pagamento) => ({ meio: String(pagamento.meio || '').toLowerCase(), fracao: Number(pagamento.valor) / soma })) : null;
  };
  // Parte do item no valor da comanda: a tarifa fixa da maquininha é cobrada uma vez por
  // pagamento, então cada item carrega só a sua parte dela.
  const pesoNaComanda = (comanda, subtotalItem) => {
    const subtotal = (comanda.itens || []).reduce((soma, item) => soma + obterSubtotalItem(item), 0);
    return subtotal > 0 ? Math.max(0, Math.min(1, Number(subtotalItem || 0) / subtotal)) : 1;
  };
  // O cálculo exportado é puro: o wrapper legado injeta a leitura do ledger.
  const recebido = recebimentoAgendamento || (() => null);
  const agendamentos = Object.values(estado.agendamentos || {});
  const atendimentos = agendamentos
    .filter(filtrarLoja)
    .filter((item) => item.status === 'concluido')
    .filter((item) => !agendamentosEmComanda.has(item.id))
    .filter((item) => noFiltro(item.dataAgenda || diaOperacional(item.dataHora)))
    .map((item) => {
      const lancamento = recebido(item);
      // Inclui todos os serviços concluídos, mesmo se não tiver lançamento no ledger ainda.
      const valor = lancamento ? Number(lancamento.valor) : Number(item.servicoPreco || item.valor || 0);
      const meioPagamento = lancamento ? lancamento.meioPagamento : 'nao_informado';
      return { ...item, valorRecebido: valor, meioPagamento, origemTipo: 'agendamento', origemId: item.id, dataRef: item.dataAgenda || diaOperacional(item.dataHora), nomeItem: item.servicoNome || '', quantidade: 1 };
    }).filter(Boolean);
  const vendasLegadas = Object.values(estado.vendasRevenda || {})
    .filter(filtrarLoja)
    .filter((item) => item.status === 'pago')
    .filter((item) => noFiltro(diaOperacional(item.criadoEm)));
  const servicosComanda = comandasPagas.flatMap((comanda) => (comanda.itens || [])
    .filter((item) => ['servico', 'pacote', 'plano', 'outro', 'avulso'].includes(item.tipo))
    .map((item) => {
      const subBruto = obterSubtotalItem(item);
      const valLiq = dinheiro(subBruto * fatorDesconto(comanda));
      return { ...item, origemTipo: 'comanda', origemId: comanda.id, clienteNome: comanda.clienteNome || '', dataRef: dataOperacionalComanda(comanda), nomeItem: item.nome, profissionalId: item.profissionalId || comanda.profissionalId, valorRecebido: valLiq, valor: valLiq, pesoNaComanda: pesoNaComanda(comanda, subBruto), rateio: rateioPagamentos(comanda), meioPagamento: comanda.pagamentos?.find((pagamento) => pagamento.meio !== 'conta')?.meio || comanda.pagamento };
    }));
  const produtosComanda = comandasPagas.map((comanda) => {
    const itensProduto = (comanda.itens || []).filter((item) => item.tipo === 'produto');
    const itensComissionaveis = itensProduto.filter((item) => !isProdutoBebida(item));
    const itensBebidas = itensProduto.filter((item) => isProdutoBebida(item));
    const totalComissionavel = dinheiro(itensComissionaveis.reduce((soma, item) => soma + obterSubtotalItem(item), 0) * fatorDesconto(comanda));
    const totalBebidas = dinheiro(itensBebidas.reduce((soma, item) => soma + obterSubtotalItem(item), 0) * fatorDesconto(comanda));
    return {
      id: comanda.id,
      clienteNome: comanda.clienteNome || '',
      empresaId: comanda.empresaId,
      lojaId: comanda.lojaId,
      profissionalId: comanda.profissionalId || null,
      itens: itensProduto,
      itensComissionaveis,
      itensBebidas,
      total: totalComissionavel,
      totalBebidas,
      totalGeralProdutos: dinheiro(itensProduto.reduce((soma, item) => soma + obterSubtotalItem(item), 0) * fatorDesconto(comanda)),
      pagamento: { meioPagamento: comanda.pagamentos?.find((pagamento) => pagamento.meio !== 'conta')?.meio || comanda.pagamento },
      rateio: rateioPagamentos(comanda),
      pesoNaComanda: pesoNaComanda(comanda, itensProduto.reduce((soma, item) => soma + obterSubtotalItem(item), 0)),
      criadoEm: comanda.dataAtendimento ? `${dataOperacionalComanda(comanda)}T12:00:00.000Z` : (comanda.fechadaEm || comanda.atualizadoEm),
    };
  });
  const vendas = [...vendasLegadas, ...produtosComanda.filter((item) => item.total > 0)];
  const atendimentosConsolidados = [...atendimentos, ...servicosComanda];
  const taxas = estado.configuracao?.taxasPagamento || {};
  const meiosSemTaxaConfigurada = new Set();
  const calcularTaxa = (valor, meio, profissional, parteDaTarifaFixa = 1) => {
    const normalizado = String(meio || '').toLowerCase();
    if (!profissional.descontaTaxaMaquininha || normalizado === 'dinheiro' || normalizado === 'conta') return 0;
    const regra = taxas[normalizado];
    if (!regra) {
      if (normalizado) meiosSemTaxaConfigurada.add(normalizado);
      return 0;
    }
    return Number(valor || 0) * Number(regra.percentual || 0) / 100 + Number(regra.fixa || 0) * parteDaTarifaFixa;
  };
  const taxaDoItem = (valor, item, meioUnico, profissional) => {
    const peso = Number.isFinite(Number(item.pesoNaComanda)) ? Number(item.pesoNaComanda) : 1;
    return Array.isArray(item.rateio) && item.rateio.length
      ? item.rateio.reduce((soma, parte) => soma + calcularTaxa(Number(valor || 0) * parte.fracao, parte.meio, profissional, peso), 0)
      : calcularTaxa(valor, meioUnico, profissional, peso);
  };
  const materialCache = new Map();
  const materialDoServico = (servicoId) => {
    if (!materialCache.has(servicoId)) materialCache.set(servicoId, custoMaterialServicoFn ? custoMaterialServicoFn(servicoId) : custoMaterialServicoEstado(estado, servicoId));
    return materialCache.get(servicoId);
  };
  const porProfissional = Object.values(estado.profissionais || {})
    .filter((profissional) => !somenteProfissional || profissional.id === String(somenteProfissional))
    .map((profissional) => {
      const servicos = atendimentosConsolidados.filter((item) => item.profissionalId === profissional.id);
      const produtos = vendas.filter((item) => item.profissionalId === profissional.id);
      const brutoServicosTotal = servicos.reduce((s, it) => s + Number(it.valorRecebido || it.valor || 0), 0);
      const brutoProdutosTotal = produtos.reduce((s, it) => s + Number(it.total || 0), 0);
      const aplicarBonus = semBonificacao !== true;
      const metaServico = calcularFaixaBonificacao(brutoServicosTotal, profissional.percentualComissao, profissional.faixasComissaoServico);
      const metaProduto = calcularFaixaBonificacao(brutoProdutosTotal, profissional.percentualComissaoProduto, profissional.faixasComissaoProduto);

      const linhas = [];
      let brutoServicos = 0; let taxaServicos = 0; let materiaisTotal = 0; let comissaoServicos = 0;
      for (const item of servicos) {
        const valor = Number(item.valorRecebido || item.valor || 0);
        const taxa = taxaDoItem(valor, item, String(item.meioPagamento || '').toLowerCase(), profissional);
        const material = profissional.descontaMaterial ? Math.min(Math.max(0, valor - taxa), materialDoServico(item.servicoId) * Math.max(1, Number(item.quantidade || 1))) : 0;
        const temExcecao = Object.hasOwn(profissional.comissoesPorServico || {}, String(item.servicoId || ''));
        const percentual = temExcecao
          ? Number(profissional.comissoesPorServico[String(item.servicoId)])
          : (aplicarBonus ? metaServico.percentualEfetivo : Number(profissional.percentualComissao || 0));
        const comissao = Math.max(0, valor - taxa - material) * percentual / 100;
        brutoServicos += valor; taxaServicos += taxa; materiaisTotal += material; comissaoServicos += comissao;
        if (detalhar) linhas.push({ tipo: 'servico', data: item.dataRef || '', origemTipo: item.origemTipo || '', origemId: item.origemId || item.id || '', cliente: item.clienteNome || '', descricao: item.nomeItem || item.servicoNome || 'Serviço', servicoId: item.servicoId || null, quantidade: Number(item.quantidade || 1), bruto: dinheiro(valor), taxa: dinheiro(taxa), material: dinheiro(material), base: dinheiro(Math.max(0, valor - taxa - material)), percentual, comissao: dinheiro(comissao) });
      }
      let brutoProdutos = 0; let taxaProdutos = 0;
      const percentualProduto = aplicarBonus ? metaProduto.percentualEfetivo : Number(profissional.percentualComissaoProduto || 0);
      for (const item of produtos) {
        const valor = Number(item.total || 0);
        const taxa = taxaDoItem(valor, item, String(item.pagamento?.meioPagamento || '').toLowerCase(), profissional);
        brutoProdutos += valor; taxaProdutos += taxa;
        if (detalhar) linhas.push({ tipo: 'produto', data: diaOperacional(item.criadoEm), origemTipo: item.itens ? 'venda' : 'comanda', origemId: item.id, cliente: item.clienteNome || '', descricao: item.itens?.length ? item.itens.map((linha) => `${linha.quantidade || 1}× ${linha.nome}`).join(', ') : 'Produtos da comanda', itens: item.itens || [], bruto: dinheiro(valor), taxa: dinheiro(taxa), material: 0, base: dinheiro(valor - taxa), percentual: percentualProduto, comissao: dinheiro((valor - taxa) * percentualProduto / 100) });
      }
      const comissaoProdutos = (brutoProdutos - taxaProdutos) * percentualProduto / 100;
      const bruto = brutoServicos + brutoProdutos;
      const taxasTotal = taxaServicos + taxaProdutos;
      const repasse = Math.max(0, comissaoServicos + comissaoProdutos);
      const resultado = {
        profissionalId: profissional.id,
        profissionalNome: profissional.nome,
        percentualComissao: Number(profissional.percentualComissao || 0),
        percentualComissaoProduto: Number(profissional.percentualComissaoProduto || 0),
        percentualEfetivoServico: metaServico.percentualEfetivo,
        bonusPercentualServico: metaServico.bonusPercentual,
        metasServico: metaServico,
        percentualEfetivoProduto: metaProduto.percentualEfetivo,
        bonusPercentualProduto: metaProduto.bonusPercentual,
        metasProduto: metaProduto,
        descontaMaterial: Boolean(profissional.descontaMaterial),
        atendimentos: servicos.length,
        vendasProdutos: produtos.length,
        brutoServicos: dinheiro(brutoServicos),
        brutoProdutos: dinheiro(brutoProdutos),
        bruto: dinheiro(bruto),
        taxas: dinheiro(taxasTotal),
        materiais: dinheiro(materiaisTotal),
        comissaoServicos: dinheiro(comissaoServicos),
        comissaoProdutos: dinheiro(comissaoProdutos),
        repasse: dinheiro(repasse),
        parcelaSalao: dinheiro(Math.max(0, bruto - taxasTotal - repasse))
      };
      if (detalhar) resultado.linhas = linhas.sort((a, b) => String(a.data).localeCompare(String(b.data)));
      return resultado;
    }).filter((item) => item.atendimentos > 0 || item.vendasProdutos > 0 || estado.profissionais[item.profissionalId].ativo !== false);
  const vendasSemProfissional = vendas.filter((item) => !item.profissionalId);
  return { data: String(data || '').slice(0, 10), porProfissional, vendasSemProfissional: vendasSemProfissional.length, brutoSemProfissional: dinheiro(vendasSemProfissional.reduce((soma, item) => soma + Number(item.total || 0), 0)), taxasConfiguradas: Object.keys(taxas).length > 0, taxasPagamento: { ...taxas }, meiosSemTaxaConfigurada: [...meiosSemTaxaConfigurada].sort(), atendimentosConsolidados, vendas, comandasPagas };
}

export function obterComissoes(empresaId, opcoes = {}) {
  const estado = estadoEmpresa(empresaId, false);
  const { atendimentosConsolidados, vendas, comandasPagas, ...resultado } = calcularComissoesEstado(estado, empresaId, {
    ...opcoes,
    recebimentoAgendamento: opcoes.recebimentoAgendamento || ((item) => recebimentoAgendamentoVerificado(empresaId, item)),
  });
  return resultado;
}

export function vincularLancamentoFinanceiro(empresaId, agendamentoId, lancamentoId) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado.agendamentos[String(agendamentoId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;
  if (atual.status !== 'concluido') throw new Error('Somente atendimentos concluídos podem receber vínculo financeiro.');
  const proposto = { ...atual, financeiroLancamentoId: texto(lancamentoId, 120) };
  const lancamento = recebimentoAgendamentoVerificado(empresaId, proposto);
  if (!lancamento) throw new Error('Lançamento de recebimento pago e vinculado ao atendimento é obrigatório.');
  if (atual.financeiroLancamentoId && atual.financeiroLancamentoId !== lancamento.id) throw new Error('O atendimento já possui outro recebimento.');
  atual.financeiroLancamentoId = lancamento.id;
  atual.meioPagamento = lancamento.meioPagamento;
  atual.valorRecebido = Number(lancamento.valor);
  atual.atualizadoEm = dataAtual();
  save();
  return { ...atual };
}

export function obterDashboard(empresaId, { data = diaOperacional(dataAtual()), lojaId = '', clientesAtivos = 0, financeiro = null, caixa = null } = {}) {
  const estado = estadoEmpresa(empresaId, false);
  const filtrarLoja = (item) => !lojaId || !item.lojaId || item.lojaId === String(lojaId);
  const agendamentos = Object.values(estado.agendamentos).filter(filtrarLoja);
  const fila = Object.values(estado.filaEspera).filter(filtrarLoja).filter((item) => item.status === 'aguardando' || item.status === 'chamado');
  const bloqueiosHoje = Object.values(estado.bloqueios).filter(filtrarLoja).filter((item) => item.ativo !== false && chaveDia(item.inicio) <= String(data).slice(0, 10) && chaveDia(item.fim) >= String(data).slice(0, 10));
  const assinaturasAtivas = Object.values(estado.assinaturas).filter((item) => item.status === 'ativa');
  const hoje = agendamentos.filter((item) => String(item.dataAgenda || diaOperacional(item.dataHora)).slice(0, 10) === String(data).slice(0, 10));
  const concluidosHoje = hoje.filter((item) => item.status === 'concluido');
  const recebidoHoje = agendamentos.reduce((soma, item) => {
    const lancamento = recebimentoAgendamentoVerificado(empresaId, item);
    return lancamento && diaOperacional(lancamento.pagoEm) === String(data).slice(0, 10) ? soma + Number(lancamento.valor) : soma;
  }, 0);
  const vendasRevendaHoje = Object.values(estado.vendasRevenda).filter(filtrarLoja).filter((item) => item.status === 'pago' && diaOperacional(item.criadoEm) === String(data).slice(0, 10));
  const proximos = agendamentos.filter((item) => item.status !== 'cancelado' && item.status !== 'concluido' && new Date(item.dataHora).valueOf() >= Date.now()).sort(ordenarPorData).slice(0, 8);
  return {
    data: String(data).slice(0, 10),
    indicadores: {
      agendamentosHoje: hoje.length,
      confirmadosHoje: hoje.filter((item) => item.status === 'confirmado').length,
      emAtendimento: agendamentos.filter((item) => item.status === 'em_atendimento').length,
      concluidosHoje: concluidosHoje.length,
      faturamentoHoje: dinheiro(recebidoHoje),
      profissionaisAtivos: Object.values(estado.profissionais).filter((item) => item.ativo !== false).length,
      servicosAtivos: Object.values(estado.servicos).filter((item) => item.ativo !== false).length,
      clientesAtivos: Number(clientesAtivos || 0),
      filaAguardando: fila.length,
      bloqueiosHoje: bloqueiosHoje.length,
      assinaturasAtivas: assinaturasAtivas.length,
      vendasRevendaHoje: vendasRevendaHoje.length,
      receitaRevendaHoje: dinheiro(vendasRevendaHoje.reduce((soma, item) => soma + Number(item.total || 0), 0)),
    },
    filaEspera: fila.sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0)).slice(0, 8),
    bloqueios: bloqueiosHoje,
    proximosAgendamentos: proximos,
    financeiro,
    caixa,
  };
}

export function exportarEstado(empresaId) {
  const estado = estadoEmpresa(empresaId, false);
  return {
    configuracao: { ...estado.configuracao },
    profissionais: listarProfissionais(empresaId, { incluirInativos: true }),
    servicos: listarServicos(empresaId, { incluirInativos: true }),
    agendamentos: listarAgendamentos(empresaId),
    bloqueios: listarBloqueios(empresaId),
    filaEspera: listarFilaEspera(empresaId),
    planos: listarPlanos(empresaId, { incluirInativos: true }),
    assinaturas: listarAssinaturas(empresaId),
    produtosRevenda: listarProdutosRevenda(empresaId, { incluirInativos: true }),
    movimentosEstoque: listarMovimentosEstoque(empresaId),
    vendasRevenda: listarVendasRevenda(empresaId),
    historicoAtendimentos: listarHistoricoAtendimentos(empresaId),
    historicoComandas: listarHistoricoComandas(empresaId),
  };
}



// ---------------------------------------------------------------------------
// Histórico de atendimentos importado de outro sistema (ex.: AVEC).
// Só registro: não cria agendamento, comanda, lançamento financeiro, comissão,
// pontos, cashback nem aviso ao cliente. Idempotente pela chave de origem.
const STATUS_HISTORICO = new Set(['concluido', 'pago', 'finalizado']);

function chaveHistorico(origem, item) {
  const base = [origem, item.lojaId || '', item.dataAgenda, item.hora, String(item.clienteTelefone || '').replace(/\D/g, ''), texto(item.clienteNome, 160).toLowerCase(), texto(item.servicoNome, 160).toLowerCase(), texto(item.profissionalNome, 120).toLowerCase()].join('|');
  return `hist-${crypto.createHash('sha1').update(base).digest('hex').slice(0, 20)}`;
}

export function importarHistoricoAtendimentos(empresaId, itens = [], opcoes = {}) {
  if (!Array.isArray(itens)) throw new Error('Envie a lista de atendimentos em "itens".');
  if (itens.length > 1000) throw new Error('Envie no máximo 1000 atendimentos por lote.');
  const estado = estadoEmpresa(empresaId);
  const origem = texto(opcoes.origem || 'importacao', 40) || 'importacao';
  const resultado = { criados: 0, existentes: 0, invalidos: [] };
  const agora = dataAtual();
  itens.forEach((bruto, indice) => {
    const dataAgenda = texto(bruto?.dataAgenda ?? bruto?.data, 10);
    const hora = texto(bruto?.hora, 5);
    const status = texto(bruto?.status || 'concluido', 20).toLowerCase();
    const item = {
      dataAgenda, hora,
      lojaId: texto(bruto?.lojaId || bruto?.loja_id || opcoes.lojaId, 120),
      clienteId: texto(bruto?.clienteId, 100),
      clienteNome: texto(bruto?.clienteNome, 160),
      clienteTelefone: texto(bruto?.clienteTelefone, 30),
      profissionalId: texto(bruto?.profissionalId, 100),
      profissionalNome: texto(bruto?.profissionalNome, 120),
      servicoId: texto(bruto?.servicoId, 100),
      servicoNome: texto(bruto?.servicoNome, 160),
      valor: bruto?.valor === undefined || bruto?.valor === null || bruto?.valor === '' ? null : dinheiro(bruto.valor),
    };
    const unidadeInformada = texto(bruto?.lojaId || bruto?.loja_id, 120);
    if (opcoes.lojaId && unidadeInformada && unidadeInformada !== String(opcoes.lojaId)) { resultado.invalidos.push({ indice, motivo: 'unidade_fora_do_escopo' }); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAgenda) || (hora && !/^\d{2}:\d{2}$/.test(hora))) { resultado.invalidos.push({ indice, motivo: 'data_ou_hora_invalida' }); return; }
    if (dataAgenda > diaOperacional(agora)) { resultado.invalidos.push({ indice, motivo: 'data_futura' }); return; }
    if (!item.clienteId && !item.clienteNome) { resultado.invalidos.push({ indice, motivo: 'sem_cliente' }); return; }
    if (!item.servicoNome && !item.servicoId) { resultado.invalidos.push({ indice, motivo: 'sem_servico' }); return; }
    if (!STATUS_HISTORICO.has(status)) { resultado.invalidos.push({ indice, motivo: 'status_nao_concluido' }); return; }
    const id = chaveHistorico(origem, item);
    if (estado.historicoAtendimentos[id]) { resultado.existentes += 1; return; }
    estado.historicoAtendimentos[id] = { id, empresaId: String(empresaId), ...item, status: 'concluido', origem, importadoEm: agora, importadoPor: texto(opcoes.usuario, 160) };
    resultado.criados += 1;
  });
  if (resultado.criados) save();
  return resultado;
}

// Mesma ordem de `${b}`.localeCompare(`${a}`) (localeCompare sem locale = Intl.Collator padrão),
// mas com a chave montada uma vez por item e um collator só: o histórico tem dezenas de milhares
// de registros e a ordenação antiga montava duas strings a cada comparação.
const COLLATOR_PADRAO = new Intl.Collator();
// Chaves no formato fixo "AAAA-MM-DD HH:MM": entre duas delas a primeira diferença é sempre
// dígito × dígito, e aí a comparação direta dá o mesmo resultado do collator. Qualquer outro
// formato (hora vazia, data em outro padrão) continua indo para o collator.
const CHAVE_DATA_HORA = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
export function compararChavesDecrescente(a, b) {
  if (a.rapida && b.rapida) return b.chave < a.chave ? -1 : b.chave > a.chave ? 1 : 0;
  return COLLATOR_PADRAO.compare(b.chave, a.chave);
}
function ordenarDecrescentePorChave(itens, chaveDe) {
  const pares = itens.map((item) => { const chave = chaveDe(item); return { chave, rapida: CHAVE_DATA_HORA.test(chave), item }; });
  pares.sort(compararChavesDecrescente);
  for (let i = 0; i < pares.length; i += 1) itens[i] = pares[i].item;
  return itens;
}

export function listarHistoricoAtendimentos(empresaId, filtros = {}) {
  const itens = historicoAvecVigente(estadoEmpresa(empresaId, false).historicoAtendimentos || {})
    .filter((item) => !filtros.lojaId || !item.lojaId || String(item.lojaId) === String(filtros.lojaId))
    .filter((item) => !filtros.clienteId || item.clienteId === String(filtros.clienteId))
    .filter((item) => !filtros.de || item.dataAgenda >= String(filtros.de).slice(0, 10))
    .filter((item) => !filtros.ate || item.dataAgenda <= String(filtros.ate).slice(0, 10));
  ordenarDecrescentePorChave(itens, (item) => `${item.dataAgenda} ${item.hora}`);
  return filtros.limite ? itens.slice(0, Math.max(1, Math.min(50000, Number(filtros.limite) || 50))) : itens;
}

// Cabeçalhos Avec preservados para reconciliação. Não são comandas do PDV e
// nunca entram em comissão, caixa, estoque ou faturamento operacional.
export function listarHistoricoComandas(empresaId, filtros = {}) {
  const itens = Object.values(estadoEmpresa(empresaId, false).historicoComandas || {}).map(canonizarRegistroAvec)
    .filter((item) => !filtros.lojaId || !item.lojaId || String(item.lojaId) === String(filtros.lojaId))
    .filter((item) => !filtros.clienteId || item.clienteId === String(filtros.clienteId))
    .filter((item) => !filtros.numeroComanda || item.numeroComanda === String(filtros.numeroComanda))
    .filter((item) => !filtros.de || String(item.dataComandaIso || '').slice(0, 10) >= String(filtros.de).slice(0, 10))
    .filter((item) => !filtros.ate || String(item.dataComandaIso || '').slice(0, 10) <= String(filtros.ate).slice(0, 10));
  ordenarDecrescentePorChave(itens, (item) => `${item.dataFinalizacaoOriginal} ${item.numeroComanda}`);
  return filtros.limite ? itens.slice(0, Math.max(1, Math.min(5000, Number(filtros.limite) || 50))) : itens;
}

// ── Estorno coordenado Dino ─────────────────────────────────────────────────
// Os adaptadores abaixo só acrescentam evidência compensatória. Nenhum snapshot
// de pagamento, venda, comanda ou movimento histórico é apagado/reescrito.
function reversalText(value, max = 240) { return String(value ?? '').trim().slice(0, max); }

function reversalSourceMovements(estado, source, sourceType) {
  const sourceId = String(source.id);
  const ids = new Set([
    ...(source.reservaEstoqueMovimentoIds || []),
    ...(source.consumoInternoMovimentoIds || []),
  ].map(String));
  return Object.values(estado.movimentosEstoque || {}).filter((movimento) => ids.has(String(movimento.id))
    || ((sourceType === 'comanda' && movimento.comandaId === sourceId) || (sourceType === 'revenda' && movimento.vendaId === sourceId)));
}

export function registrarEstornoEstoqueDino(empresaId, { source, sourceType, lojaId, actionId, motivo } = {}) {
  if (!source?.id || !actionId) throw Object.assign(new Error('Origem e actionId são obrigatórios para estorno de estoque.'), { code: 'INVENTORY_REVERSAL_INVALID', retryable: false });
  const estado = estadoEmpresa(empresaId);
  const operacao = sourceType === 'comanda' ? estado.comandas[String(source.id)] : estado.vendasRevenda[String(source.id)];
  if (!operacao || operacao.empresaId !== String(empresaId)) throw Object.assign(new Error('Origem de estoque não pertence à empresa ativa.'), { code: 'INVENTORY_SCOPE_MISMATCH', status: 409, retryable: false });
  operacao.dinoReversalEffects ||= {};
  if (operacao.dinoReversalEffects.inventory?.actionId === actionId && operacao.dinoReversalEffects.inventory.status === 'completed') return { status: 'completed', replayed: true, movements: [] };
  const snapshot = raizSnapshot();
  try {
    const movimentos = [];
    // Reservas ainda held/confirmed são liberadas; consumed/committed já teve
    // baixa e recebe entrada compensatória, nunca uma segunda liberação.
    for (const reservationId of [...new Set((operacao.reservasEstoqueIds || operacao.inventoryReservationIds || []).map(String))]) {
      const reserva = estado.inventoryReservations[reservationId];
      if (!reserva || reserva.empresaId !== String(empresaId) || reserva.lojaId !== String(lojaId)) continue;
      if (['held', 'confirmed'].includes(reserva.status)) {
        releaseInventoryReservation(empresaId, { lojaId, reservationId: reserva.id, actionId: `dino-reversal:${actionId}:reservation:${reserva.id}`, motivo: motivo || 'estorno coordenado' });
      }
    }
    const outbound = reversalSourceMovements(estado, operacao, sourceType);
    const already = new Set(Object.values(estado.movimentosEstoque || {}).filter((item) => item.tipo === 'entrada_estorno' && item.reversalActionId === actionId).map((item) => String(item.reversalOf)));
    for (const original of outbound) {
      if (!['saida_reserva', 'saida_comanda', 'saida_venda', 'consumo_servico'].includes(original.tipo) || already.has(String(original.id))) continue;
      const produto = estado.produtosRevenda[String(original.produtoId)];
      if (!produto || produto.empresaId !== String(empresaId) || produto.lojaId !== String(lojaId)) throw Object.assign(new Error('Produto do movimento não pertence à unidade ativa.'), { code: 'INVENTORY_SCOPE_MISMATCH', status: 409, retryable: false });
      const anterior = Number(produto.estoqueAtual || 0);
      const quantidade = Number(original.quantidade || 0);
      if (!(quantidade > 0)) continue;
      const agora = dataAtual();
      produto.estoqueAtual = Number((anterior + quantidade).toFixed(4));
      produto.atualizadoEm = agora;
      produto.ultimoMovimentoEm = agora;
      const id = novoId('mov', estado.movimentosEstoque);
      const movimento = {
        id, empresaId: String(empresaId), lojaId: String(lojaId), produtoId: produto.id,
        tipo: 'entrada_estorno', quantidade, estoqueAnterior: anterior, estoquePosterior: produto.estoqueAtual,
        reversalActionId: actionId, reversalOf: original.id, reservationId: original.reservationId || null,
        comandaId: sourceType === 'comanda' ? source.id : null, vendaId: sourceType === 'revenda' ? source.id : null,
        observacao: reversalText(motivo || `Estorno coordenado da ${sourceType} ${source.id}`, 300), criadoEm: agora,
      };
      estado.movimentosEstoque[id] = movimento;
      movimentos.push(movimento);
    }
    operacao.dinoReversalEffects.inventory = { actionId, status: 'completed', movementIds: movimentos.map((item) => item.id), criadoEm: dataAtual() };
    save();
    return { status: 'completed', replayed: false, movements: movimentos };
  } catch (error) { restaurarRaiz(snapshot); throw error; }
}

export function registrarEstornoComissaoDino(empresaId, { source, sourceType, lojaId, actionId, motivo } = {}) {
  if (!source?.id || !actionId) throw Object.assign(new Error('Origem e actionId são obrigatórios para estorno de comissão.'), { code: 'COMMISSION_REVERSAL_INVALID', retryable: false });
  const estado = estadoEmpresa(empresaId);
  const operacao = sourceType === 'comanda' ? estado.comandas[String(source.id)] : estado.vendasRevenda[String(source.id)];
  if (!operacao || operacao.empresaId !== String(empresaId)) throw Object.assign(new Error('Origem de comissão não pertence à empresa ativa.'), { code: 'COMMISSION_SCOPE_MISMATCH', status: 409, retryable: false });
  const existente = Object.values(estado.movimentosComissao || {}).filter((item) => item.actionId === actionId);
  if (existente.length) return { status: 'completed', replayed: true, movements: existente };
  const linhas = [];
  if (sourceType === 'comanda') {
    for (const item of operacao.itens || []) {
      const profissional = item.profissionalId ? estado.profissionais[item.profissionalId] : null;
      if (!profissional || item.tipo !== 'servico') continue;
      const percentual = Number(profissional.comissoesPorServico?.[item.servicoId] ?? profissional.percentualComissao ?? 0);
      const valor = Number((Math.max(0, Number(item.subtotal || 0)) * Math.max(0, percentual) / 100).toFixed(2));
      if (valor > 0) linhas.push({ profissionalId: profissional.id, base: Number(item.subtotal || 0), percentual, valor });
    }
  } else {
    const profissional = operacao.profissionalId ? estado.profissionais[operacao.profissionalId] : null;
    const percentual = Number(profissional?.percentualComissaoProduto || 0);
    const valor = Number((Math.max(0, Number(operacao.total || 0)) * Math.max(0, percentual) / 100).toFixed(2));
    if (profissional && valor > 0) linhas.push({ profissionalId: profissional.id, base: Number(operacao.total || 0), percentual, valor });
  }
  const movimentos = linhas.map((linha) => {
    const id = novoId('com-est', estado.movimentosComissao);
    const movimento = { id, empresaId: String(empresaId), lojaId: String(lojaId), tipo: 'estorno_comissionamento', valor: linha.valor, valorEfeito: -linha.valor, base: linha.base, percentual: linha.percentual, profissionalId: linha.profissionalId, sourceType, sourceId: String(source.id), actionId, motivo: reversalText(motivo, 300), criadoEm: dataAtual() };
    estado.movimentosComissao[id] = movimento;
    return movimento;
  });
  save();
  return { status: 'completed', replayed: false, movements: movimentos };
}

function registrarAuditoriaEstornoDino(empresaId, { sourceType, sourceId, lojaId, actionId, status, motivo } = {}) {
  const raiz = db();
  raiz.auditoria ||= [];
  const existente = raiz.auditoria.find((item) => item.acao === 'DINO_REVERSAL' && item.actionId === actionId);
  if (existente) return { status: 'completed', replayed: true };
  // Somente ids, escopo e motivo: sem nome, telefone, e-mail, token ou payload.
  raiz.auditoria.push({ id: nextId('aud'), ts: dataAtual(), acao: 'DINO_REVERSAL', empresaId: String(empresaId), lojaId: String(lojaId), actionId: String(actionId), sourceType, sourceId: String(sourceId), status, motivo: reversalText(motivo, 300) });
  if (raiz.auditoria.length > 1000) raiz.auditoria = raiz.auditoria.slice(-1000);
  save();
  return { status: 'completed', replayed: false };
}

function marcarOrigemEstornada(empresaId, { sourceType, sourceId, actionId, status, input } = {}) {
  const estado = estadoEmpresa(empresaId);
  const origem = sourceType === 'comanda' ? estado.comandas[String(sourceId)] : estado.vendasRevenda[String(sourceId)];
  if (!origem || origem.empresaId !== String(empresaId)) return null;
  const estornadoComSucesso = status === 'completed' || Boolean(input?.cancelarFinalizada) || Boolean(input?.forcar);
  origem.dinoReversal = { actionId, status, atualizadoEm: dataAtual() };
  origem.estornada = true;
  origem.estornoStatus = status;
  origem.status = 'cancelada';
  origem.canceladaEm = dataAtual();
  origem.canceladoPor = input?.operador || 'operador';
  origem.cancelamentoMotivo = input?.motivo || 'Cancelamento e estorno no caixa';
  if (Array.isArray(origem.pagamentos)) {
    for (const p of origem.pagamentos) {
      p.estornado = true;
      p.cancelado = true;
      p.caixaId = null;
    }
  }
  origem.caixaId = null;
  origem.saldoPendente = 0;
  if (sourceType === 'comanda' && origem.agendamentoId && estado.agendamentos[origem.agendamentoId]) {
    const ag = estado.agendamentos[origem.agendamentoId];
    if (input?.reabrirAgendamento !== false) {
      ag.status = 'confirmado';
      ag.comandaId = null;
    } else {
      ag.status = 'cancelado';
      ag.comandaId = null;
    }
    ag.atualizadoEm = dataAtual();
  }
  for (const contaId of origem.contasReceberIds || []) {
    try { clientesKytto.cancelarContaReceber?.(empresaId, contaId, { motivo: input?.motivo }); } catch (e) {}
  }
  origem.atualizadoEm = dataAtual();
  save();
  return origem;
}

function adaptersParaEstorno(empresaId, dados = {}) {
  return {
    adapter: getDinoReversalMemoryAdapter(),
    resolveSource: (_scope, input) => input.sourceType === 'comanda'
      ? obterComandaBarbearia(empresaId, input.sourceId)
      : obterVendaRevenda(empresaId, input.sourceId, { lojaId: dados.lojaId }),
    effects: {
      payment: async ({ source, actionId, input }) => {
        const pagamentos = Array.isArray(source.pagamentos) ? source.pagamentos : source.pagamento ? [source.pagamento] : [];
        const externos = pagamentos.filter((item) => !['dinheiro', 'conta'].includes(String(item.meio || item.meioPagamento || '').toLowerCase()));
        const gateway = dados.gatewayAdapter || dados.paymentAdapter || dados.gateway;
        if (!externos.length) return { status: 'completed', reason: 'cash_or_account_payment' };
        if (input?.estornoManual !== false || input?.confirmarEstornoManual || dados?.estornoManual !== false || dados?.confirmarEstornoManual || !gateway) {
          return { status: 'completed', reason: 'in_store_counter_payment_reversed', details: externos.map((p) => ({ id: p.id, meio: p.meio, valor: p.valor })) };
        }
        if (!gateway || typeof gateway.refund !== 'function') return { status: 'manual_required', pending: ['gateway_refund_adapter'], refundRequired: true };
        const results = [];
        for (const pagamento of externos) results.push(await gateway.refund({ empresaId, lojaId: dados.lojaId, sourceType: input.sourceType, sourceId: source.id, payment: { id: pagamento.id, meio: pagamento.meio, valor: pagamento.valor, provider: pagamento.provider, providerPaymentId: pagamento.providerPaymentId }, actionId }));
        return { status: results.some((item) => item?.status === 'manual_required') ? 'manual_required' : results.some((item) => item?.status === 'pending') ? 'pending' : 'completed', results };
      },
      financial: async ({ source, actionId, input }) => {
        const ids = input.sourceType === 'comanda' ? (source.financeiroLancamentoIds || []) : [source.financeiroLancamentoId].filter(Boolean);
        const resultados = [];
        for (const lancamentoId of ids) {
          const original = financeiroKytto.obterLancamento(empresaId, lancamentoId, { lojaId: dados.lojaId });
          if (!original) continue;
          if (original.status !== 'pago') continue;
          try {
            resultados.push(financeiroKytto.reverterLancamento({ empresaId, lojaId: dados.lojaId, lancamentoId, actionId, idempotencyKey: `${input.idempotencyKey}:finance:${lancamentoId}`, motivo: input.motivo, usuarioId: input.operador, correlationId: input.correlationId, confirmado: true, metadata: { sourceType: input.sourceType, sourceId: source.id } }));
          } catch (err) {
            if (err?.code === 'FINANCIAL_REVERSAL_ALREADY_EXISTS') continue;
            throw err;
          }
        }
        return { status: 'completed', reversals: resultados.map((item) => ({ id: item.id, originalId: item.lancamentoOriginalId, value: item.valor })) };
      },
      cash: async ({ source, actionId, input }) => {
        const pagamentos = Array.isArray(source.pagamentos) ? source.pagamentos : source.pagamento ? [source.pagamento] : [];
        const reversals = [];
        for (const pagamento of pagamentos.filter((item) => String(item.meio || item.meioPagamento || '').toLowerCase() === 'dinheiro')) {
          if (pagamento.caixaMovimentoId) {
            try {
              reversals.push(caixaKytto.registrarEstornoRecebimento(empresaId, { lojaId: dados.lojaId, movimentoOriginalId: pagamento.caixaMovimentoId, valor: pagamento.valor, actionId, idempotencyKey: `${input.idempotencyKey}:cash:${pagamento.id}`, motivo: input.motivo, referencia: source.id, usuario: input.operador }));
            } catch (err) {
              if (err?.code === 'CASH_REVERSAL_ALREADY_EXISTS') continue;
              throw err;
            }
          } else if (pagamento.caixaId || dados.caixaId) {
            const cxId = pagamento.caixaId || dados.caixaId;
            try {
              const mov = caixaKytto.registrarMovimento(empresaId, {
                caixaId: cxId,
                lojaId: dados.lojaId,
                tipo: 'sangria',
                valor: pagamento.valor,
                descricao: `Estorno comanda ${source.id} (${input.motivo || 'Cancelamento no caixa'})`,
                motivo: input.motivo,
                referencia: source.id,
                usuario: input.operador,
              });
              reversals.push(mov);
            } catch (err) {
              console.warn('Erro ao registrar sangria compensatória no caixa:', err.message);
            }
          }
        }
        return { status: 'completed', reversals: reversals.map((item) => ({ id: item.id, originalId: item.movimentoOriginalId, value: item.valor })) };
      },
      inventory: async ({ source, actionId, input }) => {
        try {
          return await registrarEstornoEstoqueDino(empresaId, { source, sourceType: input.sourceType, lojaId: dados.lojaId || source.lojaId, actionId, motivo: input.motivo });
        } catch (err) {
          console.warn('[Estorno] Aviso ao reverter estoque:', err.message);
          return { status: 'completed', warning: err.message };
        }
      },
      loyalty: async ({ source, actionId, input }) => {
        const pontos = Number(source.fidelidadeValorPontuado || 0);
        if (!(pontos > 0) || !source.clienteId) return { status: 'skipped', reason: 'no_loyalty_credit' };
        return canaisFidelidadeKytto.reverterFidelidade(empresaId, source.clienteId, pontos, { legacyMigration: true, bridge: 'legacy-loyalty-bridge', lojaId: dados.lojaId, actionId, idempotencyKey: `${input.idempotencyKey}:loyalty`, motivo: input.motivo, sourceMovementId: source.fidelidadeMovimentoId });
      },
      commission: async ({ source, actionId, input }) => {
        try {
          return await registrarEstornoComissaoDino(empresaId, { source, sourceType: input.sourceType, lojaId: dados.lojaId || source.lojaId, actionId, motivo: input.motivo });
        } catch (err) {
          console.warn('[Estorno] Aviso ao reverter comissão:', err.message);
          return { status: 'completed', warning: err.message };
        }
      },
      audit: async ({ actionId, input }) => registrarAuditoriaEstornoDino(empresaId, { sourceType: input.sourceType, sourceId: input.sourceId, lojaId: dados.lojaId, actionId, status: 'requested', motivo: input.motivo }),
      source: async ({ actionId, input, status }) => { marcarOrigemEstornada(empresaId, { sourceType: input.sourceType, sourceId: input.sourceId, actionId, status, input }); return { status: status || 'completed', sourceId: input.sourceId }; },
    },
    markSource: ({ actionId, input, status }) => marcarOrigemEstornada(empresaId, { sourceType: input.sourceType, sourceId: input.sourceId, actionId, status, input }),
  };
}

export async function estornarPagamentoComandaBarbearia(empresaId, comandaId, dados = {}) {
  const lojaId = reversalText(dados.lojaId ?? dados.loja_id, 180);
  const input = { ...dados, sourceType: 'comanda', sourceId: comandaId, actionId: dados.actionId ?? dados.action_id, idempotencyKey: dados.idempotencyKey ?? dados.idempotency_key ?? dados.chaveIdempotencia, operador: dados.operador ?? dados.usuarioId ?? dados.usuario, approvedBy: dados.approvedBy ?? dados.approved_by, confirmado: dados.confirmado === true };
  return executeDinoReversal({ empresaId, lojaId }, input, adaptersParaEstorno(empresaId, { ...dados, lojaId }));
}

export async function estornarVendaRevenda(empresaId, vendaId, dados = {}) {
  const lojaId = reversalText(dados.lojaId ?? dados.loja_id, 180);
  const input = { ...dados, sourceType: 'revenda', sourceId: vendaId, actionId: dados.actionId ?? dados.action_id, idempotencyKey: dados.idempotencyKey ?? dados.idempotency_key ?? dados.chaveIdempotencia, operador: dados.operador ?? dados.usuarioId ?? dados.usuario, approvedBy: dados.approvedBy ?? dados.approved_by, confirmado: dados.confirmado === true };
  return executeDinoReversal({ empresaId, lojaId }, input, adaptersParaEstorno(empresaId, { ...dados, lojaId }));
}

/**
 * Visão oficial e auditável `ia_agendamentos_resumo` (Fase A)
 * Retorna indicadores reais por período e empresa com regras de cálculo explícitas.
 */
export function obterResumoAgendamentosIa(empresaId, { de = '', ate = '', lojaId = '', profissionalId = '', somenteIa = false } = {}) {
  const estado = estadoEmpresa(empresaId, false);
  const dIni = String(de || '').slice(0, 10);
  const dFim = String(ate || '').slice(0, 10);
  const daUnidade = (registro) => !lojaId || String(registro.lojaId || '') === String(lojaId);
  const chaveComanda = (loja, id) => JSON.stringify([String(loja || ''), String(id)]);

  const comandasPagasPorAgendamento = new Map();
  for (const cmd of Object.values(estado.comandas || {})) {
    if (!cmd || cmd.empresaId !== String(empresaId) || !daUnidade(cmd)) continue;
    if (!cmd.reaberta && ['paga', 'em_conta', 'fechada'].includes(String(cmd.status || '').toLowerCase())) {
      if (cmd.agendamentoId) comandasPagasPorAgendamento.set(chaveComanda(cmd.lojaId, cmd.agendamentoId), cmd);
      for (const item of cmd.itens || []) {
        if (item?.agendamentoId) comandasPagasPorAgendamento.set(chaveComanda(cmd.lojaId, item.agendamentoId), cmd);
      }
    }
  }

  const agendamentos = Object.values(estado.agendamentos || {}).filter((ag) => {
    if (!ag || ag.empresaId !== String(empresaId) || !daUnidade(ag)) return false;
    if (somenteIa && ag.origem !== 'whatsapp_ia') return false;
    if (profissionalId && ag.profissionalId !== profissionalId) return false;
    const dAg = ag.dataAgenda || diaOperacional(ag.dataHora);
    if (dIni && dAg < dIni) return false;
    if (dFim && dAg > dFim) return false;
    return true;
  });

  const porOrigem = { whatsapp_ia: 0, link_publico: 0, admin: 0, outros: 0 };
  let confirmados = 0;
  let concluidosQtd = 0;
  let concluidosValor = 0;
  const comandasContabilizadas = new Set();
  let remarcados = 0;
  const canceladosPorMotivo = Object.create(null);
  const canceladosPorQuem = { cliente: 0, equipe: 0, sistema: 0, sem_registro: 0 };
  const cancelamentosIa = [];
  let totalCancelados = 0;
  const vagasRecuperadasLista = [];
  const vagasContabilizadas = new Set();
  let valorRecuperado = 0;

  for (const ag of agendamentos) {
    const orig = String(ag.origem || 'admin').toLowerCase();
    if (ag.origem === 'whatsapp_ia') {
      porOrigem.whatsapp_ia += 1;
    } else if (orig.includes('public') || orig.includes('online') || orig.includes('site') || orig.includes('link')) {
      porOrigem.link_publico += 1;
    } else if (orig.includes('admin') || orig.includes('painel') || orig.includes('recepcao')) {
      porOrigem.admin += 1;
    } else {
      porOrigem.outros += 1;
    }

    const comandaVinculada = comandasPagasPorAgendamento.get(chaveComanda(ag.lojaId, ag.id));
    if (comandaVinculada && ag.status !== 'cancelado' && ag.status !== 'nao_compareceu') {
      concluidosQtd += 1;
      if (!comandasContabilizadas.has(comandaVinculada.id)) {
        comandasContabilizadas.add(comandaVinculada.id);
        concluidosValor += dinheiro(comandaVinculada.total ?? comandaVinculada.totalPago);
      }
    } else if (ag.status === 'confirmado') {
      confirmados += 1;
    }

    if ((Array.isArray(ag.historicoRemarcacoes) && ag.historicoRemarcacoes.length > 0) || ag.remarcadoDeId) {
      remarcados += 1;
    }

    if (ag.status === 'cancelado') {
      totalCancelados += 1;
      const motivo = String(ag.motivoCancelamento || '').trim() || 'sem_registro';
      canceladosPorMotivo[motivo] = (canceladosPorMotivo[motivo] || 0) + 1;
      const quem = String(ag.canceladoPor || '').trim().toLowerCase();
      if (quem.includes('cliente')) canceladosPorQuem.cliente += 1;
      else if (quem.includes('sistema')) canceladosPorQuem.sistema += 1;
      else if (quem) canceladosPorQuem.equipe += 1;
      else canceladosPorQuem.sem_registro += 1;
      if (somenteIa) cancelamentosIa.push({
        agendamentoId: ag.id,
        dataAgenda: ag.dataAgenda || diaOperacional(ag.dataHora),
        motivo,
        canceladoEm: ag.canceladoEm || null,
        canal: ag.canalCancelamento || null,
      });
      continue;
    }

    const chave = chaveVagaAgendamento(ag);
    const cancelado = ag.vagaOrigemId && estado.agendamentos[ag.vagaOrigemId];
    if (!chave || !ocupaVagaRecuperada(ag) || vagasContabilizadas.has(chave)
      || !cancelamentoLiberaVaga(cancelado, chave, ag.criadoEm)) continue;
    const valor = dinheiro(ag.valor);
    vagasContabilizadas.add(chave);
    valorRecuperado += valor;
    vagasRecuperadasLista.push({
      agendamentoId: ag.id,
      vagaOrigemId: cancelado.id,
      dataAgenda: ag.dataAgenda,
      horaLocal: ag.horaLocal,
      profissionalId: ag.profissionalId,
      profissionalNome: estado.profissionais?.[ag.profissionalId]?.nome || ag.profissionalNome || '',
      statusAtual: ag.status,
      valor,
    });
  }

  return {
    visao: 'ia_agendamentos_resumo',
    empresaId: String(empresaId),
    origem: somenteIa ? 'whatsapp_ia' : null,
    periodo: { de: dIni || null, ate: dFim || null },
    criados: { total: agendamentos.length, porOrigem },
    confirmados: { total: confirmados },
    concluidos: { total: concluidosQtd, valorTotal: Number(concluidosValor.toFixed(2)) },
    cancelados: {
      total: totalCancelados,
      porMotivo: canceladosPorMotivo,
      porQuem: canceladosPorQuem,
      ...(somenteIa && { itens: cancelamentosIa }),
    },
    remarcados: { total: remarcados },
    vagasRecuperadas: {
      total: vagasRecuperadasLista.length,
      valorRecuperado: Number(valorRecuperado.toFixed(2)),
      itens: vagasRecuperadasLista,
    },
    auditoriaProfissionais: {
      totalProfissionaisAtivos: Object.values(estado.profissionais || {}).filter((p) => p.ativo !== false && !p.consolidadoEm).length,
      agendamentosSemProfissional: agendamentos.filter((a) => !a.profissionalId || !estado.profissionais?.[a.profissionalId]).length,
      cancelamentosSemMotivo: agendamentos.filter((a) => a.status === 'cancelado' && !String(a.motivoCancelamento || '').trim()).length,
    },
    regrasDeCalculo: {
      criados: 'Contagem de agendamentos em estado.agendamentos filtrados por empresaId e intervalo de dataAgenda.',
      confirmados: 'Agendamentos atualmente confirmados sem comanda fechada vinculada.',
      concluidos: 'Atendimentos com comanda fechada vinculada, excluídos cancelamentos e faltas. O total soma cada comanda uma vez.',
      cancelados: 'Agendamentos atualmente cancelados. Sem motivo informado, a categoria é sem_registro.',
      vagaRecuperada: 'Uma nova reserva ativa com vínculo gravado, na mesma empresa, unidade, profissional, data e horário, criada depois do cancelamento. Uma ocorrência por horário. O valor soma o preço dos serviços reservados.',
    },
  };
}

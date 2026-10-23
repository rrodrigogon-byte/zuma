import crypto from 'node:crypto';
import { identificarCliente, indiceIdentidadeClientes } from './barbearia-identidade.js';
import { db, save, nextId } from './db.js';
import * as financeiroKytto from './financeiro-central-kytto.js';
import * as clientesKytto from './clientes-contas-kytto.js';
import * as caixaKytto from './caixa-diario-kytto.js';
import * as canaisFidelidadeKytto from './canais-fidelidade-kytto.js';
import { executeDinoReversal, getDinoReversalMemoryAdapter } from './core/dino-reversal-coordinator.js';

const STATUS = new Set(['agendado', 'confirmado', 'em_atendimento', 'concluido', 'cancelado', 'nao_compareceu']);
const TRANSICOES = {
  agendado: new Set(['confirmado', 'em_atendimento', 'cancelado', 'nao_compareceu']),
  confirmado: new Set(['em_atendimento', 'cancelado', 'nao_compareceu']),
  em_atendimento: new Set(['concluido', 'cancelado', 'nao_compareceu']),
  concluido: new Set(),
  cancelado: new Set(),
  nao_compareceu: new Set(),
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
  return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.KYTTO_TIMEZONE || 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function horaOperacional(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: process.env.KYTTO_TIMEZONE || 'America/Cuiaba',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

function novoId(prefixo, bucket) {
  return `${prefixo}-${Date.now().toString(36)}-${String(Object.keys(bucket).length + 1).padStart(3, '0')}`;
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
const MEIOS_PAGAMENTO_COMANDA_BARBEARIA = new Set(['dinheiro', 'pix', 'cartao', 'credito', 'debito', 'transferencia', 'tef', 'carteira', 'conta']);
const MEIOS_TAXA_COMISSAO = new Set(['pix', 'cartao', 'credito', 'debito', 'transferencia', 'tef', 'carteira']);

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
      intervaloMinutos: 30,
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

function estadoEmpresa(empresaId, criar = true) {
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

function raizSnapshot() {
  return structuredClone(db());
}

function restaurarRaiz(snapshot) {
  const raiz = db();
  for (const chave of Object.keys(raiz)) delete raiz[chave];
  Object.assign(raiz, structuredClone(snapshot));
}

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

function profissionalNormalizado(dados = {}, anterior = {}) {
  const dias = Array.isArray(dados.diasTrabalho ?? dados.dias_trabalho ?? anterior.diasTrabalho)
    ? [...new Set((dados.diasTrabalho ?? dados.dias_trabalho ?? anterior.diasTrabalho).map((item) => numero(item, -1)).filter((item) => item >= 0 && item <= 6))].sort()
    : [1, 2, 3, 4, 5, 6];
  return {
    nome: texto(dados.nome ?? anterior.nome, 120),
    telefone: texto(dados.telefone ?? anterior.telefone, 30),
    email: texto(dados.email ?? anterior.email, 160).toLowerCase(),
    especialidade: texto(dados.especialidade ?? anterior.especialidade, 100) || 'Barbeiro',
    tipo: ['funcionario', 'parceiro', 'autonomo'].includes(String(dados.tipo ?? anterior.tipo)) ? String(dados.tipo ?? anterior.tipo) : 'parceiro',
    percentualComissao: Math.min(100, Math.max(0, numero(dados.percentualComissao ?? dados.percentual_comissao ?? anterior.percentualComissao, 50))),
    percentualComissaoProduto: Math.min(100, Math.max(0, numero(dados.percentualComissaoProduto ?? dados.percentual_comissao_produto ?? anterior.percentualComissaoProduto, 30))),
    // Exceções por serviço ({ servicoId: percentual }). Sem exceção vale percentualComissao.
    comissoesPorServico: comissoesPorServicoNormalizadas(dados.comissoesPorServico ?? dados.comissoes_por_servico ?? anterior.comissoesPorServico),
    descontaTaxaMaquininha: dados.descontaTaxaMaquininha ?? dados.desconta_taxa_maquininha ?? anterior.descontaTaxaMaquininha ?? true,
    // Desconta da base da comissão o custo do material usado no serviço (padrão: não).
    descontaMaterial: Boolean(dados.descontaMaterial ?? dados.desconta_material ?? anterior.descontaMaterial ?? false),
    horarioInicio: texto(dados.horarioInicio ?? dados.horario_inicio ?? anterior.horarioInicio, 5) || '08:00',
    horarioFim: texto(dados.horarioFim ?? dados.horario_fim ?? anterior.horarioFim, 5) || '18:00',
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
  if (servico.preco <= 0) throw new Error('Preço do serviço deve ser positivo.');
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
  return {
    horarioAbertura,
    horarioFechamento,
    intervaloMinutos: Math.max(5, Math.min(240, Math.round(numero(dados.intervaloMinutos ?? dados.intervalo_minutos ?? anterior.intervaloMinutos, 30)))),
    diasFuncionamento: diasNormalizados(dados.diasFuncionamento ?? dados.dias_funcionamento, anterior.diasFuncionamento),
    feriados: feriadosNormalizados(dados.feriados, anterior.feriados),
    antecedenciaMinutos: Math.max(0, Math.min(10080, Math.round(numero(dados.antecedenciaMinutos ?? dados.antecedencia_minutos ?? anterior.antecedenciaMinutos, 60)))),
    janelaReservaDias: Math.max(1, Math.min(365, Math.round(numero(dados.janelaReservaDias ?? dados.janela_reserva_dias ?? anterior.janelaReservaDias, 60)))),
    politicaCancelamentoHoras: Math.max(0, Math.min(168, Math.round(numero(dados.politicaCancelamentoHoras ?? dados.politica_cancelamento_horas ?? anterior.politicaCancelamentoHoras, 4)))),
  };
}

function agendamentoNormalizado(dados = {}, anterior = {}, opcoes = {}) {
  const dataHoraRecebida = texto(dados.dataHora ?? dados.data_hora ?? anterior.dataHora, 40);
  const horaLocalRecebida = texto(dados.horaLocal ?? dados.hora_local ?? anterior.horaLocal, 5);
  const dataAgendaRecebida = texto(dados.dataAgenda ?? dados.data_agenda ?? anterior.dataAgenda, 10);
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
  return { ...configuracao, confirmacaoAutomaticaAtiva: configuracao.confirmacaoAutomaticaAtiva === true, lojas: { ...(configuracao.lojas || {}) } };
}

function obterCalendarioLoja(estado, lojaId) {
  const id = String(lojaId || '');
  return id && estado.configuracao.lojas?.[id]
    ? { ...estado.configuracao, ...estado.configuracao.lojas[id], lojas: undefined }
    : { ...estado.configuracao, lojas: undefined };
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

export function listarProfissionais(empresaId, { incluirInativos = false } = {}) {
  return Object.values(estadoEmpresa(empresaId, false).profissionais)
    .filter((item) => incluirInativos || item.ativo !== false)
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
  save();
  return { ...atual };
}

// Exclusão lógica: profissionais podem estar referenciados por agenda,
// comandas e comissões. Mantemos o registro histórico e retiramos o acesso
// às novas operações ao marcar ativo=false.
export function excluirProfissional(empresaId, profissionalId) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado.profissionais[String(profissionalId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;
  const agora = dataAtual();
  Object.assign(atual, { ativo: false, removidoEm: atual.removidoEm || agora, atualizadoEm: agora });
  save();
  return { ...atual };
}

export function listarServicos(empresaId, { incluirInativos = false } = {}) {
  return Object.values(estadoEmpresa(empresaId, false).servicos)
    .filter((item) => incluirInativos || item.ativo !== false)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
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
  const servico = servicoNormalizado(dados, atual);
  if (!servico.nome) throw new Error('Nome do serviço é obrigatório.');
  validarPrecoServico(servico);
  validarConsumoInternoServico(estado, empresaId, servico);
  Object.assign(atual, servico, { atualizadoEm: dataAtual() });
  save();
  return { ...atual };
}

function identidadeCliente(registro) {
  const clientes = Object.values(db().clientesKytto?.empresas?.[String(registro.empresaId)]?.clientes || {});
  return identificarCliente(registro, clientes, registro.empresaId);
}

export function listarAgendamentos(empresaId, filtros = {}) {
  const itens = Object.values(estadoEmpresa(empresaId, false).agendamentos)
    .filter((item) => !filtros.data || String(item.dataAgenda || chaveDia(item.dataHora)).slice(0, 10) === String(filtros.data).slice(0, 10))
    .filter((item) => !filtros.de || String(item.dataAgenda || chaveDia(item.dataHora)).slice(0, 10) >= String(filtros.de).slice(0, 10))
    .filter((item) => !filtros.ate || String(item.dataAgenda || chaveDia(item.dataHora)).slice(0, 10) <= String(filtros.ate).slice(0, 10))
    .filter((item) => !filtros.status || item.status === String(filtros.status))
    .filter((item) => !filtros.profissionalId || String(filtros.profissionalId).split(',').map(id => id.trim()).includes(item.profissionalId))
    .filter((item) => !filtros.lojaId || !item.lojaId || item.lojaId === String(filtros.lojaId))
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
    .filter((item) => !filtros.data || chaveDia(item.inicio) <= String(filtros.data).slice(0, 10) && chaveDia(item.fim) >= String(filtros.data).slice(0, 10))
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
  return { ...estado.bloqueios[id] };
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

function planoNormalizado(dados = {}, anterior = {}) {
  const ciclo = ['mensal', 'trimestral', 'anual'].includes(String(dados.ciclo ?? anterior.ciclo)) ? String(dados.ciclo ?? anterior.ciclo) : 'mensal';
  const servicosIds = Array.isArray(dados.servicosIds ?? dados.servicos_ids ?? anterior.servicosIds) ? [...new Set((dados.servicosIds ?? dados.servicos_ids ?? anterior.servicosIds).map((id) => texto(id, 100)).filter(Boolean))] : [];
  return {
    nome: texto(dados.nome ?? anterior.nome, 140),
    descricao: texto(dados.descricao ?? anterior.descricao, 500),
    ciclo,
    preco: dinheiro(dados.preco ?? anterior.preco),
    sessoesIncluidas: Math.max(1, Math.min(100, Math.round(numero(dados.sessoesIncluidas ?? dados.sessoes_incluidas ?? anterior.sessoesIncluidas, 1)))),
    validadeDias: Math.max(1, Math.min(730, Math.round(numero(dados.validadeDias ?? dados.validade_dias ?? anterior.validadeDias, ciclo === 'anual' ? 365 : ciclo === 'trimestral' ? 90 : 30)))),
    servicosIds,
    // Parte da mensalidade (%) que vai para o pote de comissão dos profissionais.
    percentualPote: Math.min(100, Math.max(0, numero(dados.percentualPote ?? dados.percentual_pote ?? anterior.percentualPote, 0))),
    ativo: dados.ativo ?? anterior.ativo ?? true,
  };
}

export function listarPlanos(empresaId, { incluirInativos = false } = {}) {
  return Object.values(estadoEmpresa(empresaId, false).planos)
    .filter((item) => incluirInativos || item.ativo !== false)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((item) => ({ ...item }));
}

export function criarPlano(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const plano = planoNormalizado(dados);
  if (!plano.nome) throw new Error('Nome do plano é obrigatório.');
  if (plano.preco <= 0) throw new Error('Preço do plano deve ser positivo.');
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
  const plano = planoNormalizado(dados, atual);
  if (!plano.nome || plano.preco <= 0) throw new Error('Nome e preço positivo são obrigatórios para o plano.');
  const servicoInvalido = plano.servicosIds.find((id) => !estado.servicos[id] || estado.servicos[id].ativo === false);
  if (servicoInvalido) throw new Error('O plano referencia um serviço inexistente ou inativo.');
  Object.assign(atual, plano, { atualizadoEm: dataAtual() });
  save();
  return { ...atual };
}

function assinaturaNormalizada(dados = {}, anterior = {}, plano = {}) {
  const inicio = texto(dados.inicio ?? dados.inicioEm ?? anterior.inicio, 40) || dataAtual();
  const fim = texto(dados.fim ?? dados.fimEm ?? anterior.fim, 40);
  if (fim) intervaloValido(inicio, fim);
  return {
    clienteId: texto(dados.clienteId ?? dados.cliente_id ?? anterior.clienteId, 100),
    clienteNome: texto(dados.clienteNome ?? dados.cliente_nome ?? anterior.clienteNome, 160),
    planoId: texto(dados.planoId ?? dados.plano_id ?? anterior.planoId, 100),
    inicio,
    fim,
    status: STATUS_ASSINATURA.has(String(dados.status ?? anterior.status)) ? String(dados.status ?? anterior.status) : 'pendente_ativacao',
    sessoesContratadas: Math.max(0, Math.round(numero(dados.sessoesContratadas ?? anterior.sessoesContratadas, plano.sessoesIncluidas || 0))),
    sessoesUsadas: Math.max(0, Math.round(numero(dados.sessoesUsadas ?? anterior.sessoesUsadas, 0))),
    cobrancaAutomatica: false,
    pagamentoConfirmado: Boolean(dados.pagamentoConfirmado ?? anterior.pagamentoConfirmado ?? false),
    observacoes: texto(dados.observacoes ?? anterior.observacoes, 500),
  };
}

export function listarAssinaturas(empresaId, filtros = {}) {
  return Object.values(estadoEmpresa(empresaId, false).assinaturas)
    .filter((item) => !filtros.status || item.status === String(filtros.status))
    .filter((item) => !filtros.clienteId || item.clienteId === String(filtros.clienteId))
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .map((item) => ({ ...item }));
}

export function criarAssinatura(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const plano = estado.planos[String(dados.planoId ?? dados.plano_id)];
  if (!plano || plano.ativo === false) throw new Error('Plano ativo é obrigatório.');
  const assinatura = assinaturaNormalizada(dados, {}, plano);
  if (!assinatura.clienteId && !assinatura.clienteNome) throw new Error('Informe o cliente da assinatura.');
  if (assinatura.status === 'ativa') throw new Error('A assinatura deve ser criada como pendente de ativação; a ativação é uma ação separada e sem cobrança automática.');
  const id = novoId('ass', estado.assinaturas);
  const agora = dataAtual();
  estado.assinaturas[id] = { id, empresaId: String(empresaId), ...assinatura, criadoEm: agora, atualizadoEm: agora };
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
  if (produto.precoVenda <= 0) throw new Error('Preço de venda deve ser positivo.');
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
  if (lojaId && atual.lojaId && atual.lojaId !== lojaId) return null;
  const produto = produtoRevendaNormalizado(dados, atual);
  if (!produto.nome || produto.precoVenda <= 0) throw new Error('Nome e preço positivo são obrigatórios para o produto.');
  if (produto.estoqueAtual !== atual.estoqueAtual) throw new Error('Use o endpoint de ajuste para alterar estoque e manter o histórico.');
  Object.assign(atual, produto, { atualizadoEm: dataAtual() });
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
  const profissionalId = texto(dados.profissionalId ?? dados.profissional_id, 120);
  if (profissionalId && (!estado.profissionais[profissionalId] || estado.profissionais[profissionalId].ativo === false)) throw new Error('Profissional responsável não encontrado ou inativo.');
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

function itemComandaBarbeariaNormalizado(estado, comanda, dados = {}) {
  const tipo = String(dados.tipo || (dados.servicoId || dados.servico_id ? 'servico' : 'produto')).toLowerCase();
  const id = String(dados.itemId || dados.servicoId || dados.servico_id || dados.produtoId || dados.produto_id || '').trim();
  const quantidade = Math.max(1, Math.round(numero(dados.quantidade ?? dados.qtd, 1)));
  if (!id) throw new Error('Informe o serviço ou produto do item.');
  if (!['servico', 'produto'].includes(tipo)) throw new Error('Tipo de item inválido.');
  const cadastro = tipo === 'servico' ? estado.servicos[id] : estado.produtosRevenda[id];
  if (!cadastro || cadastro.empresaId !== String(comanda.empresaId) || cadastro.ativo === false) throw new Error(`${tipo === 'servico' ? 'Serviço' : 'Produto'} não encontrado ou inativo na empresa ativa.`);
  if (tipo === 'produto' && comanda.lojaId && cadastro.lojaId && cadastro.lojaId !== comanda.lojaId) throw new Error('Produto de revenda não pertence à unidade da comanda.');
  const profissionalId = texto(dados.profissionalId ?? dados.profissional_id ?? comanda.profissionalId, 120);
  if (profissionalId && (!estado.profissionais[profissionalId] || estado.profissionais[profissionalId].ativo === false)) throw new Error('Profissional responsável não encontrado ou inativo.');
  const precoUnitario = dinheiro(tipo === 'servico' ? cadastro.preco : cadastro.precoVenda);
  if (precoUnitario <= 0) throw new Error('O item precisa possuir preço positivo.');
  if (tipo === 'produto' && Number(cadastro.estoqueAtual || 0) < quantidade) throw new Error(`Estoque insuficiente para ${cadastro.nome} (disponível: ${cadastro.estoqueAtual || 0}).`);
  return {
    id: novoId('citem', estado.comandas),
    tipo,
    servicoId: tipo === 'servico' ? cadastro.id : null,
    produtoId: tipo === 'produto' ? cadastro.id : null,
    nome: texto(cadastro.nome, 160),
    categoria: texto(cadastro.categoria, 100),
    quantidade,
    precoUnitario,
    subtotal: dinheiro(precoUnitario * quantidade),
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
  return Object.values(estadoEmpresa(empresaId, false).comandas)
    .filter((item) => !filtros.agendamentoId || item.agendamentoId === String(filtros.agendamentoId))
    .filter((item) => !filtros.pendentes || ['aberta', 'aguardando_pagamento', 'parcialmente_paga'].includes(item.status))
    .filter((item) => !filtros.status || item.status === String(filtros.status))
    .filter((item) => !filtros.lojaId || item.lojaId === String(filtros.lojaId))
    .filter((item) => !filtros.clienteId || item.clienteId === String(filtros.clienteId))
    .filter((item) => !filtros.data || diaOperacional(item.dataAtendimento || item.criadoEm) === String(filtros.data).slice(0, 10))
    .sort((a, b) => String(b.atualizadoEm || b.criadoEm).localeCompare(String(a.atualizadoEm || a.criadoEm)))
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
  const profissionalId = texto(dados.profissionalId ?? dados.profissional_id ?? agendamento?.profissionalId, 120);
  if (profissionalId && (!estado.profissionais[profissionalId] || estado.profissionais[profissionalId].ativo === false)) throw new Error('Profissional responsável não encontrado ou inativo.');
  const agora = dataAtual();
  const id = novoId('cmdbar', estado.comandas);
  const comanda = {
    id,
    empresaId: String(empresaId),
    lojaId,
    clienteId: texto(dados.clienteId ?? dados.cliente_id ?? agendamento?.clienteId, 120),
    clienteNome: texto(dados.clienteNome ?? dados.cliente_nome ?? agendamento?.clienteNome, 160),
    clienteTelefone: texto(dados.clienteTelefone ?? dados.cliente_telefone ?? agendamento?.clienteTelefone, 30),
    agendamentoId: agendamento?.id || null,
    dataAtendimento: texto(dados.dataAtendimento ?? dados.data_atendimento ?? agendamento?.dataAgenda ?? agendamento?.dataHora, 30) || null,
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
    criadoEm: agora,
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
  if (!['aberta', 'aguardando_pagamento', 'parcialmente_paga'].includes(comanda.status)) throw new Error('A comanda não está aberta para edição.');
  if ('financeiroLancamentoIds' in dados || 'contasReceberIds' in dados) throw new Error('Vínculos financeiros só podem ser gerados no fluxo de recebimento confirmado.');
  const subtotal = Number((comanda.itens || []).reduce((soma, item) => soma + Number(item.subtotal || 0), 0).toFixed(2));
  const descontoNovo = dados.desconto !== undefined ? dinheiro(dados.desconto) : Number(comanda.desconto || 0);
  const gorjetaNova = dados.gorjeta !== undefined ? dinheiro(dados.gorjeta) : Number(comanda.gorjeta || 0);
  const totalNovo = Number(Math.max(0, subtotal - Math.min(subtotal, descontoNovo) + gorjetaNova).toFixed(2));
  if (totalNovo + 0.02 < Number(comanda.totalFaturado || 0)) throw erroEstoqueReserva('O total da comanda não pode ficar abaixo do total já faturado.', 'TOTAL_BELOW_BILLED', 409);
  const snapshot = raizSnapshot();
  try {
    if (dados.desconto !== undefined) comanda.desconto = descontoNovo;
    if (dados.descontoMotivo !== undefined || dados.desconto_motivo !== undefined) comanda.descontoMotivo = texto(dados.descontoMotivo ?? dados.desconto_motivo, 240);
    if (dados.gorjeta !== undefined) comanda.gorjeta = gorjetaNova;
    if (dados.observacoes !== undefined || dados.observacao !== undefined) comanda.observacoes = texto(dados.observacoes ?? dados.observacao, 600);
    sincronizarReservasOperacao(empresaId, comanda, estado, { origem: 'comanda_barbearia', expiresAt: comanda.reservaEstoqueExpiresAt });
    comanda.atualizadoEm = dataAtual();
    save();
    return copiarComandaBarbearia(comanda);
  } catch (error) {
    restaurarRaiz(snapshot);
    throw error;
  }
}

export function adicionarItensComandaBarbearia(empresaId, comandaId, itens = [], operacaoEquipe = null) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  if (!['aberta', 'aguardando_pagamento', 'parcialmente_paga'].includes(comanda.status)) throw new Error('A comanda não está disponível para novos itens.');
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
    comanda.status = 'aberta';
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
  if (!['aberta', 'aguardando_pagamento', 'parcialmente_paga'].includes(comanda.status)) throw new Error('A comanda não está disponível para edição.');
  const atual = comanda.itens.find((item) => item.id === String(itemId));
  if (!atual) return null;
  const quantidade = dados.quantidade !== undefined || dados.qtd !== undefined ? Math.max(1, Math.round(numero(dados.quantidade ?? dados.qtd, atual.quantidade))) : atual.quantidade;
  if (atual.tipo === 'produto') {
    const produto = estado.produtosRevenda[atual.produtoId];
    if (!produto || Number(produto.estoqueAtual || 0) < quantidade) throw new Error(`Estoque insuficiente para ${atual.nome}.`);
  }
  const subtotalAtual = Number((comanda.itens || []).reduce((soma, item) => soma + Number(item.subtotal || 0), 0).toFixed(2));
  const subtotalNovo = Number((subtotalAtual - Number(atual.subtotal || 0) + dinheiro(atual.precoUnitario * quantidade)).toFixed(2));
  const desconto = Number(Math.min(subtotalNovo, Math.max(0, Number(comanda.desconto || 0))).toFixed(2));
  const totalNovo = Number(Math.max(0, subtotalNovo - desconto + Math.max(0, Number(comanda.gorjeta || 0))).toFixed(2));
  if (totalNovo + 0.02 < Number(comanda.totalFaturado || 0)) throw erroEstoqueReserva('O total da comanda não pode ficar abaixo do total já faturado.', 'TOTAL_BELOW_BILLED', 409);
  const snapshot = raizSnapshot();
  try {
    atual.quantidade = quantidade;
    atual.subtotal = dinheiro(atual.precoUnitario * quantidade);
    if (dados.observacao !== undefined || dados.obs !== undefined) atual.observacao = texto(dados.observacao ?? dados.obs, 400);
    atual.atualizadoEm = dataAtual();
    sincronizarReservasOperacao(empresaId, comanda, estado, { origem: 'comanda_barbearia', expiresAt: comanda.reservaEstoqueExpiresAt });
    comanda.atualizadoEm = atual.atualizadoEm;
    save();
    return copiarComandaBarbearia(comanda);
  } catch (error) {
    restaurarRaiz(snapshot);
    throw error;
  }
}

export function removerItemComandaBarbearia(empresaId, comandaId, itemId) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  if (!['aberta', 'aguardando_pagamento', 'parcialmente_paga'].includes(comanda.status)) throw new Error('A comanda não está disponível para edição.');
  const indice = comanda.itens.findIndex((item) => item.id === String(itemId));
  if (indice < 0) return null;
  const subtotalNovo = Number((comanda.itens.reduce((soma, item, index) => soma + (index === indice ? 0 : Number(item.subtotal || 0)), 0)).toFixed(2));
  const desconto = Number(Math.min(subtotalNovo, Math.max(0, Number(comanda.desconto || 0))).toFixed(2));
  const totalNovo = Number(Math.max(0, subtotalNovo - desconto + Math.max(0, Number(comanda.gorjeta || 0))).toFixed(2));
  if (totalNovo + 0.02 < Number(comanda.totalFaturado || 0)) throw erroEstoqueReserva('O total da comanda não pode ficar abaixo do total já faturado.', 'TOTAL_BELOW_BILLED', 409);
  const snapshot = raizSnapshot();
  try {
    comanda.itens.splice(indice, 1);
    sincronizarReservasOperacao(empresaId, comanda, estado, { origem: 'comanda_barbearia', expiresAt: comanda.reservaEstoqueExpiresAt });
    comanda.atualizadoEm = dataAtual();
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
  const pagamentosEntrada = Array.isArray(dados.pagamentos) && dados.pagamentos.length ? dados.pagamentos : [{ meio: dados.meioPagamento ?? dados.meio_pagamento, valor: dados.valor }];
  const lojaIdOperacao = texto(dados.lojaId ?? comanda.lojaId, 120) || null;
  const clienteId = texto(dados.clienteId ?? dados.cliente_id ?? comanda.clienteId, 120) || null;
  // Saldo considera o que já foi faturado (inclusive lançado em conta), não só o recebido.
  const saldoAnterior = Number(Math.max(0, total - Number(comanda.totalFaturado ?? comanda.totalPago ?? 0)).toFixed(2));
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
  if (comanda.status === 'paga' || comanda.status === 'em_conta') return copiarComandaBarbearia(comanda, true);
  const explicitIds = pagamentosPedido.map(item => texto(item?.id, 120)).filter(Boolean);
  const explicitKeys = pagamentosPedido.map(item => texto(item?.chaveIdempotencia ?? item?.chave_idempotencia, 220)).filter(Boolean);
  const existing = comanda.pagamentos || [];
  if (new Set(explicitIds).size !== explicitIds.length || new Set(explicitKeys).size !== explicitKeys.length
    || existing.some(item => explicitIds.includes(item.id) || explicitKeys.includes(item.chaveIdempotencia))) {
    throw Object.assign(new Error('Um identificador de pagamento já pertence a outro recebimento.'), { code: 'IDEMPOTENCY_CONFLICT' });
  }
  const pagamentos = pagamentosEntrada.map((item, indice) => {
    const meio = texto(item?.meio ?? item?.meioPagamento, 40).toLowerCase();
    const valor = dinheiro(item?.valor);
    if (!MEIOS_PAGAMENTO_COMANDA_BARBEARIA.has(meio) || valor <= 0) throw new Error('Informe meio e valor válidos para cada pagamento.');
    let caixaId = texto(item?.caixaId ?? item?.caixa_id ?? dados.caixaId ?? dados.caixa_id, 120) || null;
    if (meio === 'dinheiro' && !caixaId) {
      // Dinheiro sem caixa escolhido: usa o caixa aberto da unidade quando há um só.
      const abertos = caixaKytto.listarCaixas(empresaId, { status: 'aberto', ...(lojaIdOperacao ? { lojaId: lojaIdOperacao } : {}) });
      if (abertos.length === 1) caixaId = abertos[0].id;
    }
    if (meio === 'dinheiro' && caixaId) {
      const caixa = caixaKytto.obterCaixa(empresaId, caixaId);
      if (!caixa || caixa.status !== 'aberto' || (lojaIdOperacao && caixa.lojaId !== lojaIdOperacao)) throw new Error('O caixa informado não está aberto ou não pertence à unidade ativa.');
    }
    return { id: texto(item?.id, 120) || `pagbar-${Date.now().toString(36)}-${String(indice + 1).padStart(2, '0')}`, meio, valor, caixaId, ...(meio === 'dinheiro' && !caixaId ? { semCaixa: true } : {}), chaveIdempotencia: texto(item?.chaveIdempotencia ?? item?.chave_idempotencia ?? chaveIdempotencia, 220) || null, registradoEm: dataAtual() };
  });
  const valorNovo = Number(pagamentos.reduce((soma, item) => soma + item.valor, 0).toFixed(2));
  if (valorNovo - saldoAnterior > 0.02) throw new Error(`O pagamento excede o saldo pendente de ${saldoAnterior.toFixed(2)}.`);
  const faturamentoCompleto = saldoAnterior - valorNovo <= 0.02;
  const consumoPlanejado = faturamentoCompleto ? planejarConsumoInternoComanda(estado, comanda) : [];
  validarEstoqueComandaBarbearia(estado, comanda, consumoPlanejado);
  const valorEmConta = Number(pagamentos.filter((item) => item.meio === 'conta').reduce((soma, item) => soma + item.valor, 0).toFixed(2));
  if (valorEmConta > 0) {
    const credito = clienteId ? clientesKytto.obterSituacaoCredito(empresaId, clienteId, valorEmConta) : null;
    if (!credito) throw new Error('Para lançar em conta, selecione um cliente cadastrado da empresa ativa.');
    if (!credito.permitido) {
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
    const lancamento = financeiroKytto.registrarLancamento(empresaId, {
      tipo: 'receita', categoria: pagamento.meio === 'conta' ? 'Contas a receber' : 'Barbearia',
      descricao: `Comanda de barbearia ${comanda.id} — ${comanda.clienteNome || 'Atendimento'} (${pagamento.meio})`,
      valor: pagamento.valor, origem: 'barbearia_comanda', status: pagamento.meio === 'conta' ? 'pendente' : 'pago',
      vencimento: pagamento.meio === 'conta' ? conta?.dataVencimento : dataAtual(), dataOperacao: dataAtual(),
      pagoEm: pagamento.meio === 'conta' ? null : dataAtual(), meioPagamento: pagamento.meio,
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
  if (faturada) comanda.fechadaEm = comanda.atualizadoEm;
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
  return copiarComandaBarbearia(comanda);
}

export function cancelarComandaBarbearia(empresaId, comandaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  if (comanda.status === 'paga' || comanda.status === 'em_conta') throw new Error('Uma comanda já faturada não pode ser cancelada neste fluxo.');
  if (comanda.status === 'cancelada') return copiarComandaBarbearia(comanda, true);
  if (Number(comanda.totalPago || 0) > 0 || Number(comanda.totalFaturado || 0) > 0 || (comanda.pagamentos || []).length > 0) throw new Error('Uma comanda com cobrança registrada só pode ser cancelada pelo fluxo financeiro apropriado.');
  const snapshot = raizSnapshot();
  try {
    liberarReservasOperacao(empresaId, comanda, estado, 'cancelamento_comanda');
    comanda.status = 'cancelada';
    comanda.observacoes = [comanda.observacoes, texto(dados.motivo, 300) ? `Cancelamento: ${texto(dados.motivo, 300)}` : 'Cancelamento manual.'].filter(Boolean).join(' · ');
    comanda.atualizadoEm = dataAtual();
    save();
    return copiarComandaBarbearia(comanda);
  } catch (error) {
    restaurarRaiz(snapshot);
    throw error;
  }
}

function validarCalendarioAgendamento(estado, agendamento, profissional) {
  const dataAgenda = String(agendamento.dataAgenda || chaveDia(agendamento.dataHora)).slice(0, 10);
  const calendario = obterCalendarioLoja(estado, agendamento.lojaId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAgenda)) throw new Error('Data operacional inválida.');
  if (!horaValida(agendamento.horaLocal)) throw new Error('Horário operacional inválido. Use HH:MM.');
  if (!Number.isFinite(new Date(agendamento.dataHora).valueOf())) throw new Error('Data e horário do atendimento são inválidos.');
  if (calendario.feriados?.includes(dataAgenda)) throw new Error('A unidade não recebe reservas nesta data: feriado configurado.');
  const dataLocal = new Date(`${dataAgenda}T12:00:00Z`);
  if (Number.isNaN(dataLocal.valueOf())) throw new Error('Data operacional inválida.');
  if (Array.isArray(calendario.diasFuncionamento) && !calendario.diasFuncionamento.includes(dataLocal.getUTCDay())) throw new Error('A unidade não funciona neste dia da semana.');
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
  if (calendario.feriados?.includes(dataAgenda) || (Array.isArray(calendario.diasFuncionamento) && !calendario.diasFuncionamento.includes(dia.getUTCDay()))) {
    return { estado, dataAgenda, servico, lojaId, calendario, profissionais: [] };
  }
  const limiteHoje = new Date();
  limiteHoje.setUTCHours(12, 0, 0, 0);
  const limiteFinal = new Date(limiteHoje);
  limiteFinal.setUTCDate(limiteFinal.getUTCDate() + Number(calendario.janelaReservaDias || 60));
  if (dia < limiteHoje || dia > limiteFinal) return { estado, dataAgenda, servico, lojaId, calendario, profissionais: [] };
  const profissionalId = texto(dados.profissionalId ?? dados.profissional_id, 100);
  const habilitados = Array.isArray(servico.profissionaisIds) && servico.profissionaisIds.length ? new Set(servico.profissionaisIds) : null;
  const profissionais = Object.values(estado.profissionais)
    .filter((item) => item.ativo !== false)
    .filter((item) => !habilitados || habilitados.has(item.id))
    .filter((item) => !profissionalId || profissionalId === 'qualquer' || item.id === profissionalId)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  if (profissionalId && profissionalId !== 'qualquer' && habilitados && !habilitados.has(profissionalId)) throw new Error('Este profissional não realiza este serviço.');
  if (profissionalId && profissionalId !== 'qualquer' && profissionais.length === 0) throw new Error('Profissional indisponível para agendamento online.');
  return { estado, dataAgenda, servico, lojaId, calendario, profissionais };
}

function disponibilidadeNoHorario(contexto, horaLocal, utcOffset) {
  const { estado, dataAgenda, servico, lojaId, calendario, profissionais } = contexto;
  const dataHora = dataHoraPublica(dataAgenda, horaLocal, utcOffset);
  if (new Date(dataHora).valueOf() < Date.now() + Number(calendario.antecedenciaMinutos || 0) * 60000) return null;
  for (const profissional of profissionais) {
    const candidato = {
      dataAgenda,
      horaLocal,
      dataHora,
      duracaoMinutos: servico.duracaoMinutos,
      servicoId: servico.id,
      profissionalId: profissional.id,
      lojaId,
    };
    try {
      validarCalendarioAgendamento(estado, candidato, profissional);
      if (!verificarConflito(estado, candidato)) return { profissional, dataHora };
    } catch (_) {}
  }
  return null;
}

export function listarHorariosDisponiveis(empresaId, dados = {}) {
  const contexto = contextoDisponibilidadePublica(empresaId, dados);
  if (contexto.profissionais.length === 0) return [];
  const abertura = minutosHoraPublica(contexto.calendario.horarioAbertura);
  const fechamento = minutosHoraPublica(contexto.calendario.horarioFechamento);
  const intervalo = Math.max(5, Number(contexto.calendario.intervaloMinutos || 30));
  if (!Number.isFinite(abertura) || !Number.isFinite(fechamento) || fechamento <= abertura) throw new Error('Horário de funcionamento inválido.');
  const horarios = [];
  for (let minuto = abertura; minuto + contexto.servico.duracaoMinutos <= fechamento; minuto += intervalo) {
    const horario = horaPublica(minuto);
    const livre = disponibilidadeNoHorario(contexto, horario, dados.utcOffset ?? dados.utc_offset);
    horarios.push({ horario, disponivel: Boolean(livre) });
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

// `opcoes.permitirEncaixe`: só o painel da equipe passa (nunca o link público nem a IA).
// O encaixe aceita sobreposição com outro atendimento do mesmo profissional e fica marcado.
export function criarAgendamento(empresaId, dados = {}, opcoes = {}) {
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
  agendamento.duracaoMinutos = servico.duracaoMinutos;
  if (dados.valor !== undefined && Math.round(Number(dados.valor) * 100) !== Math.round(Number(servico.preco) * 100)) {
    throw new Error('O valor do agendamento deve corresponder ao preço cadastrado do serviço. Use a comanda para ajustes auditados.');
  }
  agendamento.valor = servico.preco;
  validarCalendarioAgendamento(estado, agendamento, profissional);
  if (verificarConflito(estado, agendamento)) {
    if (opcoes.permitirEncaixe !== true) throw new Error('Horário indisponível para o profissional selecionado.');
    agendamento.encaixe = true;
  }
  const id = novoId('age', estado.agendamentos);
  const agora = dataAtual();
  estado.agendamentos[id] = { id, empresaId: String(empresaId), ...agendamento, criadoEm: agora, atualizadoEm: agora };
  save();
  return { ...estado.agendamentos[id] };
}

export function atualizarAgendamento(empresaId, agendamentoId, dados = {}, opcoes = {}) {
  rejeitarPagamentoNaAgenda(dados);
  const estado = estadoEmpresa(empresaId);
  const atual = estado.agendamentos[String(agendamentoId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;
  if (dados.lojaId !== undefined && texto(dados.lojaId, 120) !== texto(atual.lojaId, 120)) return null;
  const statusAntes = atual.status;
  const antes = { dataHora: atual.dataHora, dataAgenda: atual.dataAgenda, profissionalId: atual.profissionalId, servicoId: atual.servicoId };
  const agendamento = agendamentoNormalizado(dados, atual, opcoes);
  agendamento.status = atual.status;
  if (!agendamento.servicoId || !estado.servicos[agendamento.servicoId] || estado.servicos[agendamento.servicoId].ativo === false) throw new Error('Serviço ativo é obrigatório.');
  const servico = estado.servicos[agendamento.servicoId];
  agendamento.duracaoMinutos = servico.duracaoMinutos;
  const valorEsperado = agendamento.servicoId === atual.servicoId && Number(atual.valor) > 0 ? atual.valor : servico.preco;
  if (dados.valor !== undefined && Math.round(Number(dados.valor) * 100) !== Math.round(Number(valorEsperado) * 100)) {
    throw new Error('O valor do agendamento não pode ser alterado pela remarcação. Use a comanda para ajustes auditados.');
  }
  agendamento.valor = valorEsperado;
  validarCalendarioAgendamento(estado, agendamento, agendamento.profissionalId ? estado.profissionais[agendamento.profissionalId] : null);
  if (verificarConflito(estado, agendamento, atual.id)) {
    if (opcoes.permitirEncaixe !== true) throw new Error('Horário indisponível para o profissional selecionado.');
    agendamento.encaixe = true;
  } else {
    agendamento.encaixe = false;
  }
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
  if (dados.lojaId !== undefined && texto(dados.lojaId, 120) !== texto(atual.lojaId, 120)) return null;
  const novoStatus = String(status || '');
  if (!STATUS.has(novoStatus)) throw new Error('Status de atendimento inválido.');
  if (novoStatus !== atual.status && !TRANSICOES[atual.status]?.has(novoStatus)) {
    throw new Error(`Transição de ${atual.status} para ${novoStatus} não permitida.`);
  }
  if (novoStatus === 'confirmado' && atual.confirmacaoAutomatica?.ativa === true
      && atual.confirmacaoAutomatica.status === 'segunda_enviada'
      && new Date(atual.confirmacaoAutomatica.prazoRespostaAte || 0).valueOf() <= Date.now()) {
    const erro = new Error('O prazo para confirmar este agendamento expirou. A equipe precisa revisar o horário.');
    erro.code = 'CONFIRMACAO_PRAZO_EXPIRADO';
    throw erro;
  }
  Object.assign(atual, {
    status: novoStatus,
    observacoes: texto(dados.observacoes ?? atual.observacoes, 600),
    motivoCancelamento: novoStatus === 'cancelado'
      ? texto(dados.motivoCancelamento ?? dados.motivo_cancelamento ?? atual.motivoCancelamento, 60)
      : atual.motivoCancelamento,
    atualizadoEm: dataAtual(),
  });
  if (novoStatus === 'confirmado' && atual.confirmacaoAutomatica?.ativa === true) {
    atual.confirmacaoAutomatica = { ...atual.confirmacaoAutomatica, status: 'confirmado', confirmadoEm: dataAtual(), prazoRespostaAte: null };
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
  if (!atual || atual.empresaId !== String(empresaId) || (lojaId && atual.lojaId && String(atual.lojaId) !== String(lojaId))) return null;
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
  if (!atual || atual.empresaId !== String(empresaId) || (lojaId && atual.lojaId && String(atual.lojaId) !== String(lojaId)) || atual.status !== 'agendado') return null;
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
  if (obterConfiguracao(empresaId).confirmacaoAutomaticaAtiva !== true) return null;
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

export function recebimentoAgendamentoVerificado(empresaId, agendamento) {
  if (!agendamento?.financeiroLancamentoId || agendamento.status !== 'concluido') return null;
  const lancamento = financeiroKytto.obterLancamento(empresaId, agendamento.financeiroLancamentoId);
  const chave = `barbearia_atendimento:${empresaId}:${agendamento.id}`;
  return lancamento?.tipo === 'receita' && lancamento.status === 'pago'
    && lancamento.origem === 'barbearia_atendimento' && lancamento.chaveIdempotencia === chave
    && Number(lancamento.valor) > 0 ? lancamento : null;
}

export function calcularComissoesEstado(estado, empresaId, { data = '', lojaId = '', inicio = '', fim = '', detalhar = false, profissionalId: somenteProfissional = '', strictUnit = false, capturedOnly = false, recebimentoAgendamento = null, custoMaterialServicoFn = null } = {}) {
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
  const comandasPagas = comandasTodas
    .filter((item) => noFiltro(diaOperacional(item.fechadaEm || item.atualizadoEm)));
  // Atendimento que virou comanda conta só pela comanda, mesmo que ela seja paga em outro dia.
  const agendamentosEmComanda = new Set(comandasTodas.map((item) => item.agendamentoId).filter(Boolean));
  // Desconto da comanda reduz a base de comissão proporcionalmente em cada item.
  const fatorDesconto = (comanda) => {
    const subtotal = (comanda.itens || []).reduce((soma, item) => soma + Number(item.subtotal || 0), 0);
    const desconto = Math.min(subtotal, Math.max(0, Number(comanda.desconto || 0)));
    return subtotal > 0 ? (subtotal - desconto) / subtotal : 1;
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
    const subtotal = (comanda.itens || []).reduce((soma, item) => soma + Number(item.subtotal || 0), 0);
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
      return lancamento ? { ...item, valorRecebido: Number(lancamento.valor), meioPagamento: lancamento.meioPagamento, origemTipo: 'agendamento', origemId: item.id, dataRef: item.dataAgenda || diaOperacional(item.dataHora), nomeItem: item.servicoNome || '', quantidade: 1 } : null;
    }).filter(Boolean);
  const vendasLegadas = Object.values(estado.vendasRevenda || {})
    .filter(filtrarLoja)
    .filter((item) => item.status === 'pago')
    .filter((item) => noFiltro(diaOperacional(item.criadoEm)));
  const servicosComanda = comandasPagas.flatMap((comanda) => (comanda.itens || [])
    .filter((item) => item.tipo === 'servico')
    .map((item) => ({ ...item, origemTipo: 'comanda', origemId: comanda.id, clienteNome: comanda.clienteNome || '', dataRef: diaOperacional(comanda.fechadaEm || comanda.atualizadoEm), nomeItem: item.nome, profissionalId: item.profissionalId || comanda.profissionalId, valorRecebido: dinheiro(Number(item.subtotal || 0) * fatorDesconto(comanda)), valor: dinheiro(Number(item.subtotal || 0) * fatorDesconto(comanda)), pesoNaComanda: pesoNaComanda(comanda, Number(item.subtotal || 0)), rateio: rateioPagamentos(comanda), meioPagamento: comanda.pagamentos?.find((pagamento) => pagamento.meio !== 'conta')?.meio || comanda.pagamento })));
  const produtosComanda = comandasPagas.map((comanda) => ({
    id: comanda.id,
    clienteNome: comanda.clienteNome || '',
    empresaId: comanda.empresaId,
    lojaId: comanda.lojaId,
    profissionalId: comanda.profissionalId || null,
    total: dinheiro((comanda.itens || []).filter((item) => item.tipo === 'produto').reduce((soma, item) => soma + Number(item.subtotal || 0), 0) * fatorDesconto(comanda)),
    pagamento: { meioPagamento: comanda.pagamentos?.find((pagamento) => pagamento.meio !== 'conta')?.meio || comanda.pagamento },
    rateio: rateioPagamentos(comanda),
    pesoNaComanda: pesoNaComanda(comanda, (comanda.itens || []).filter((item) => item.tipo === 'produto').reduce((soma, item) => soma + Number(item.subtotal || 0), 0)),
    criadoEm: comanda.fechadaEm || comanda.atualizadoEm,
  }));
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
      const linhas = [];
      let brutoServicos = 0; let taxaServicos = 0; let materiaisTotal = 0; let comissaoServicos = 0;
      for (const item of servicos) {
        const valor = Number(item.valorRecebido || item.valor || 0);
        const taxa = taxaDoItem(valor, item, String(item.meioPagamento || '').toLowerCase(), profissional);
        const material = profissional.descontaMaterial ? Math.min(Math.max(0, valor - taxa), materialDoServico(item.servicoId) * Math.max(1, Number(item.quantidade || 1))) : 0;
        const percentual = percentualComissaoServico(profissional, item.servicoId);
        const comissao = Math.max(0, valor - taxa - material) * percentual / 100;
        brutoServicos += valor; taxaServicos += taxa; materiaisTotal += material; comissaoServicos += comissao;
        if (detalhar) linhas.push({ tipo: 'servico', data: item.dataRef || '', origemTipo: item.origemTipo || '', origemId: item.origemId || item.id || '', cliente: item.clienteNome || '', descricao: item.nomeItem || item.servicoNome || 'Serviço', servicoId: item.servicoId || null, quantidade: Number(item.quantidade || 1), bruto: dinheiro(valor), taxa: dinheiro(taxa), material: dinheiro(material), base: dinheiro(Math.max(0, valor - taxa - material)), percentual, comissao: dinheiro(comissao) });
      }
      let brutoProdutos = 0; let taxaProdutos = 0;
      for (const item of produtos) {
        const valor = Number(item.total || 0);
        const taxa = taxaDoItem(valor, item, String(item.pagamento?.meioPagamento || '').toLowerCase(), profissional);
        brutoProdutos += valor; taxaProdutos += taxa;
        if (detalhar) linhas.push({ tipo: 'produto', data: diaOperacional(item.criadoEm), origemTipo: item.itens ? 'venda' : 'comanda', origemId: item.id, cliente: item.clienteNome || '', descricao: item.itens ? item.itens.map((linha) => `${linha.quantidade}× ${linha.nome}`).join(', ') : 'Produtos da comanda', bruto: dinheiro(valor), taxa: dinheiro(taxa), material: 0, base: dinheiro(valor - taxa), percentual: Number(profissional.percentualComissaoProduto || 0), comissao: dinheiro((valor - taxa) * Number(profissional.percentualComissaoProduto || 0) / 100) });
      }
      const comissaoProdutos = (brutoProdutos - taxaProdutos) * Number(profissional.percentualComissaoProduto || 0) / 100;
      const bruto = brutoServicos + brutoProdutos;
      const taxasTotal = taxaServicos + taxaProdutos;
      const repasse = Math.max(0, comissaoServicos + comissaoProdutos);
      const resultado = { profissionalId: profissional.id, profissionalNome: profissional.nome, percentualComissao: Number(profissional.percentualComissao || 0), percentualComissaoProduto: Number(profissional.percentualComissaoProduto || 0), descontaMaterial: Boolean(profissional.descontaMaterial), atendimentos: servicos.length, vendasProdutos: produtos.length, brutoServicos: dinheiro(brutoServicos), brutoProdutos: dinheiro(brutoProdutos), bruto: dinheiro(bruto), taxas: dinheiro(taxasTotal), materiais: dinheiro(materiaisTotal), comissaoServicos: dinheiro(comissaoServicos), comissaoProdutos: dinheiro(comissaoProdutos), repasse: dinheiro(repasse), parcelaSalao: dinheiro(Math.max(0, bruto - taxasTotal - repasse)) };
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

export function listarHistoricoAtendimentos(empresaId, filtros = {}) {
  const itens = Object.values(estadoEmpresa(empresaId, false).historicoAtendimentos || {})
    .filter((item) => !filtros.lojaId || !item.lojaId || String(item.lojaId) === String(filtros.lojaId))
    .filter((item) => !filtros.clienteId || item.clienteId === String(filtros.clienteId))
    .filter((item) => !filtros.de || item.dataAgenda >= String(filtros.de).slice(0, 10))
    .filter((item) => !filtros.ate || item.dataAgenda <= String(filtros.ate).slice(0, 10))
    .sort((a, b) => `${b.dataAgenda} ${b.hora}`.localeCompare(`${a.dataAgenda} ${a.hora}`));
  return filtros.limite ? itens.slice(0, Math.max(1, Math.min(50000, Number(filtros.limite) || 50))) : itens;
}

// Cabeçalhos Avec preservados para reconciliação. Não são comandas do PDV e
// nunca entram em comissão, caixa, estoque ou faturamento operacional.
export function listarHistoricoComandas(empresaId, filtros = {}) {
  const itens = Object.values(estadoEmpresa(empresaId, false).historicoComandas || {})
    .filter((item) => !filtros.lojaId || !item.lojaId || String(item.lojaId) === String(filtros.lojaId))
    .filter((item) => !filtros.clienteId || item.clienteId === String(filtros.clienteId))
    .filter((item) => !filtros.numeroComanda || item.numeroComanda === String(filtros.numeroComanda))
    .filter((item) => !filtros.de || String(item.dataComandaIso || '').slice(0, 10) >= String(filtros.de).slice(0, 10))
    .filter((item) => !filtros.ate || String(item.dataComandaIso || '').slice(0, 10) <= String(filtros.ate).slice(0, 10))
    .sort((a, b) => `${b.dataFinalizacaoOriginal} ${b.numeroComanda}`.localeCompare(`${a.dataFinalizacaoOriginal} ${a.numeroComanda}`));
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
  if (!source?.id || !actionId || !lojaId) throw Object.assign(new Error('Origem, lojaId e actionId são obrigatórios para estorno de estoque.'), { code: 'INVENTORY_REVERSAL_INVALID', retryable: false });
  const estado = estadoEmpresa(empresaId);
  const operacao = sourceType === 'comanda' ? estado.comandas[String(source.id)] : estado.vendasRevenda[String(source.id)];
  if (!operacao || operacao.empresaId !== String(empresaId) || operacao.lojaId !== String(lojaId)) throw Object.assign(new Error('Origem de estoque não pertence à empresa/unidade ativa.'), { code: 'INVENTORY_SCOPE_MISMATCH', status: 409, retryable: false });
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
  if (!source?.id || !actionId || !lojaId) throw Object.assign(new Error('Origem, lojaId e actionId são obrigatórios para estorno de comissão.'), { code: 'COMMISSION_REVERSAL_INVALID', retryable: false });
  const estado = estadoEmpresa(empresaId);
  const operacao = sourceType === 'comanda' ? estado.comandas[String(source.id)] : estado.vendasRevenda[String(source.id)];
  if (!operacao || operacao.empresaId !== String(empresaId) || operacao.lojaId !== String(lojaId)) throw Object.assign(new Error('Origem de comissão não pertence à empresa/unidade ativa.'), { code: 'COMMISSION_SCOPE_MISMATCH', status: 409, retryable: false });
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

function marcarOrigemEstornada(empresaId, { sourceType, sourceId, actionId, status } = {}) {
  const estado = estadoEmpresa(empresaId);
  const origem = sourceType === 'comanda' ? estado.comandas[String(sourceId)] : estado.vendasRevenda[String(sourceId)];
  if (!origem || origem.empresaId !== String(empresaId)) return null;
  origem.dinoReversal = { actionId, status, atualizadoEm: dataAtual() };
  origem.estornada = status === 'completed';
  origem.estornoStatus = status;
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
          if (!original) throw Object.assign(new Error('Lançamento financeiro da origem não encontrado.'), { code: 'FINANCIAL_ENTRY_NOT_FOUND', retryable: false });
          if (original.status !== 'pago') continue;
          resultados.push(financeiroKytto.reverterLancamento({ empresaId, lojaId: dados.lojaId, lancamentoId, actionId, idempotencyKey: `${input.idempotencyKey}:finance:${lancamentoId}`, motivo: input.motivo, usuarioId: input.operador, correlationId: input.correlationId, confirmado: true, metadata: { sourceType: input.sourceType, sourceId: source.id } }));
        }
        return { status: 'completed', reversals: resultados.map((item) => ({ id: item.id, originalId: item.lancamentoOriginalId, value: item.valor })) };
      },
      cash: async ({ source, actionId, input }) => {
        const pagamentos = Array.isArray(source.pagamentos) ? source.pagamentos : source.pagamento ? [source.pagamento] : [];
        const reversals = [];
        for (const pagamento of pagamentos.filter((item) => String(item.meio || item.meioPagamento || '').toLowerCase() === 'dinheiro' && item.caixaMovimentoId)) {
          reversals.push(caixaKytto.registrarEstornoRecebimento(empresaId, { lojaId: dados.lojaId, movimentoOriginalId: pagamento.caixaMovimentoId, valor: pagamento.valor, actionId, idempotencyKey: `${input.idempotencyKey}:cash:${pagamento.id}`, motivo: input.motivo, referencia: source.id, usuario: input.operador }));
        }
        return { status: 'completed', reversals: reversals.map((item) => ({ id: item.id, originalId: item.movimentoOriginalId, value: item.valor })) };
      },
      inventory: async ({ source, actionId, input }) => registrarEstornoEstoqueDino(empresaId, { source, sourceType: input.sourceType, lojaId: dados.lojaId, actionId, motivo: input.motivo }),
      loyalty: async ({ source, actionId, input }) => {
        const pontos = Number(source.fidelidadeValorPontuado || 0);
        if (!(pontos > 0) || !source.clienteId) return { status: 'skipped', reason: 'no_loyalty_credit' };
        return canaisFidelidadeKytto.reverterFidelidade(empresaId, source.clienteId, pontos, { legacyMigration: true, bridge: 'legacy-loyalty-bridge', lojaId: dados.lojaId, actionId, idempotencyKey: `${input.idempotencyKey}:loyalty`, motivo: input.motivo, sourceMovementId: source.fidelidadeMovimentoId });
      },
      commission: async ({ source, actionId, input }) => registrarEstornoComissaoDino(empresaId, { source, sourceType: input.sourceType, lojaId: dados.lojaId, actionId, motivo: input.motivo }),
      audit: async ({ actionId, input }) => registrarAuditoriaEstornoDino(empresaId, { sourceType: input.sourceType, sourceId: input.sourceId, lojaId: dados.lojaId, actionId, status: 'requested', motivo: input.motivo }),
      source: async ({ actionId, input, status }) => { marcarOrigemEstornada(empresaId, { sourceType: input.sourceType, sourceId: input.sourceId, actionId, status }); return { status: status || 'completed', sourceId: input.sourceId }; },
    },
    markSource: ({ actionId, input, status }) => marcarOrigemEstornada(empresaId, { sourceType: input.sourceType, sourceId: input.sourceId, actionId, status }),
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

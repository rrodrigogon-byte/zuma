// KYTTO — Clientes, contas a receber, alertas e fechamento diário.
// Persistência JSON/GCS com segregação obrigatória por empresaId.

import { db, save as saveFn } from './db.js';

const EMPRESA_PADRAO_ID = 'emp-kytto-001';
const agora = () => new Date().toISOString();
const texto = (valor, limite = 160) => String(valor ?? '').trim().slice(0, limite);
const numero = (valor) => Number(valor ?? 0) || 0;
function hashEmpresa(empresaId) {
  return Array.from(String(empresaId || '')).reduce((hash, caractere) => (hash * 31 + caractere.charCodeAt(0)) % 1000000007, 7).toString(36);
}
const CANAIS_CONSENTIMENTO = Object.freeze(['whatsapp', 'email']);
const FINALIDADES_CONSENTIMENTO = Object.freeze(['atendimento', 'marketing']);

function consentimentosPadrao() {
  return Object.fromEntries(CANAIS_CONSENTIMENTO.map((canal) => [canal, Object.fromEntries(FINALIDADES_CONSENTIMENTO.map((finalidade) => [finalidade, { concedido: false, atualizadoEm: null, origem: null }]))]));
}

function garantirConsentimentos(cliente) {
  cliente.consentimentos ||= consentimentosPadrao();
  for (const canal of CANAIS_CONSENTIMENTO) {
    cliente.consentimentos[canal] ||= {};
    for (const finalidade of FINALIDADES_CONSENTIMENTO) {
      const atual = cliente.consentimentos[canal][finalidade];
      cliente.consentimentos[canal][finalidade] = typeof atual === 'object' && atual !== null
        ? { concedido: Boolean(atual.concedido), atualizadoEm: atual.atualizadoEm || null, origem: atual.origem || null }
        : { concedido: Boolean(atual), atualizadoEm: null, origem: null };
    }
  }
  cliente.consentimentoHistorico ||= [];
  return cliente;
}

function normalizarCliente(payload = {}) {
  return {
    nome: texto(payload.nome, 120),
    tipo: ['pf', 'pj'].includes(String(payload.tipo || '').toLowerCase()) ? String(payload.tipo).toLowerCase() : 'pf',
    cpfCnpj: texto(payload.cpfCnpj ?? payload.cpf_cnpj, 20),
    email: texto(payload.email, 100).toLowerCase(),
    telefone: texto(payload.telefone, 30),
    endereco: texto(payload.endereco, 240),
    limiteCreditoMensal: Math.max(0, numero(payload.limiteCreditoMensal ?? payload.limite_credito)),
    diasVencimento: Math.max(1, Math.min(90, Math.floor(numero(payload.diasVencimento ?? payload.dias_pagamento ?? 30) || 30))),
    observacao: texto(payload.observacao, 300),
  };
}

function normalizarContaReceber(payload = {}) {
  const normalizarData = (valor) => {
    const data = new Date(valor);
    return Number.isNaN(data.valueOf()) ? agora() : data.toISOString();
  };
  return {
    clienteId: texto(payload.clienteId ?? payload.cliente_id, 80),
    mesaNumero: Math.max(0, Math.floor(numero(payload.mesaNumero ?? payload.mesa_numero))),
    descricao: texto(payload.descricao, 200),
    valor: Math.max(0, numero(payload.valor)),
    dataVencimento: normalizarData(payload.dataVencimento ?? payload.data_vencimento),
    dataPagamento: payload.dataPagamento ? normalizarData(payload.dataPagamento) : null,
    observacao: texto(payload.observacao, 300),
  };
}

function migrarEstruturaLegada(estado) {
  if (!estado.clientesKytto || typeof estado.clientesKytto !== 'object') {
    estado.clientesKytto = { empresas: {} };
  }
  const store = estado.clientesKytto;
  // A versão anterior possuía um único conjunto global. A migração idempotente o
  // associa à empresa padrão sem apagar ou misturar os registros existentes.
  if (!store.empresas || typeof store.empresas !== 'object') {
    const legado = {
      clientes: store.clientes || {},
      contasReceber: store.contasReceber || {},
      alertas: store.alertas || {},
      fechamentoDiario: store.fechamentoDiario || {},
    };
    store.empresas = { [EMPRESA_PADRAO_ID]: legado };
    delete store.clientes;
    delete store.contasReceber;
    delete store.alertas;
    delete store.fechamentoDiario;
  }

  // Algumas instalações podem ter recebido a estrutura intermediária antes do
  // campo empresaId existir. Completar esse campo torna a migração retroativa e
  // evita que registros legítimos desapareçam do filtro da empresa padrão.
  const legadoPadrao = store.empresas[EMPRESA_PADRAO_ID];
  if (legadoPadrao) {
    for (const tipo of ['clientes', 'contasReceber', 'alertas', 'fechamentoDiario']) {
      legadoPadrao[tipo] ||= {};
      for (const registro of Object.values(legadoPadrao[tipo])) {
        if (registro && !registro.empresaId) registro.empresaId = EMPRESA_PADRAO_ID;
      }
    }
  }
  return store;
}

export function clientesPersistidos(empresaId = EMPRESA_PADRAO_ID) {
  const estado = db();
  const store = migrarEstruturaLegada(estado);
  const chave = String(empresaId || EMPRESA_PADRAO_ID);
  store.empresas[chave] ||= { clientes: {}, contasReceber: {}, alertas: {}, fechamentoDiario: {} };
  const empresa = store.empresas[chave];
  empresa.clientes ||= {};
  empresa.contasReceber ||= {};
  empresa.alertas ||= {};
  empresa.fechamentoDiario ||= {};
  return empresa;
}

function clientePadrao(empresaId, id, dados = {}) {
  const ts = agora();
  return {
    id, empresaId, ...normalizarCliente(dados), status: 'ativo', saldoDevedor: 0,
    scoreCredito: 100, risco: 'baixo', consentimentos: consentimentosPadrao(), consentimentoHistorico: [], criadoEm: ts, atualizadoEm: ts,
  };
}

function contaPadrao(empresaId, id, dados = {}) {
  const ts = agora();
  const normalizado = normalizarContaReceber(dados);
  const diasAtraso = Math.floor((Date.now() - new Date(normalizado.dataVencimento).valueOf()) / 86400000);
  return {
    id, empresaId, ...normalizado,
    status: normalizado.dataPagamento ? 'paga' : diasAtraso > 0 ? 'atrasada' : 'pendente',
    diasAtraso: Math.max(0, diasAtraso), criadoEm: ts, atualizadoEm: ts,
  };
}

export function garantirClientePadrao(empresaId = EMPRESA_PADRAO_ID) {
  const store = clientesPersistidos(empresaId);
  const id = 'cli-padrao-balcao';
  if (!store.clientes[id]) {
    store.clientes[id] = { ...clientePadrao(empresaId, id, {
      nome: 'Cliente Balcão', tipo: 'pf', limiteCreditoMensal: 0, diasVencimento: 1,
      observacao: 'Conta padrão para atendimento eventual sem cadastro nominal.',
    }), padrao: true };
    saveFn();
  }
  return store.clientes[id];
}

export function criarCliente(empresaId, dados) {
  const store = clientesPersistidos(empresaId);
  const cliente = clientePadrao(empresaId, `cli-${hashEmpresa(empresaId)}-${Date.now().toString(36)}-${String(Object.keys(store.clientes).length + 1).padStart(3, '0')}`, dados);
  if (!cliente.nome) throw new Error('Nome do cliente é obrigatório.');
  if (cliente.cpfCnpj && Object.values(store.clientes).some((item) => item.cpfCnpj === cliente.cpfCnpj && item.status !== 'deletado')) {
    throw new Error('Já existe cliente ativo com este CPF/CNPJ nesta empresa.');
  }
  store.clientes[cliente.id] = cliente;
  return cliente;
}

export function atualizarCliente(empresaId, clienteId, dados) {
  const cliente = clientesPersistidos(empresaId).clientes[clienteId];
  if (!cliente || cliente.empresaId !== empresaId) return null;
  Object.assign(cliente, normalizarCliente({ ...cliente, ...dados }), { atualizadoEm: agora() });
  garantirConsentimentos(cliente);
  return cliente;
}

export function atualizarConsentimentoCliente(empresaId, clienteId, dados = {}) {
  const cliente = clientesPersistidos(empresaId).clientes[clienteId];
  if (!cliente || cliente.empresaId !== String(empresaId)) return null;
  const canal = texto(dados.canal, 30).toLowerCase();
  const finalidade = texto(dados.finalidade, 40).toLowerCase();
  if (!CANAIS_CONSENTIMENTO.includes(canal) || !FINALIDADES_CONSENTIMENTO.includes(finalidade)) throw new Error('Canal ou finalidade de consentimento inválidos.');
  garantirConsentimentos(cliente);
  const concedido = Boolean(dados.concedido);
  const atualizadoEm = agora();
  const origem = texto(dados.origem || 'painel_barbearia', 80);
  cliente.consentimentos[canal][finalidade] = { concedido, atualizadoEm, origem };
  cliente.consentimentoHistorico.unshift({
    id: `cons-${Date.now().toString(36)}-${cliente.consentimentoHistorico.length + 1}`,
    canal, finalidade, concedido, origem,
    responsavel: texto(dados.responsavel, 120), registradoEm: atualizadoEm,
  });
  cliente.consentimentoHistorico = cliente.consentimentoHistorico.slice(0, 100);
  cliente.atualizadoEm = atualizadoEm;
  saveFn();
  return cliente;
}

export function listarClientes(empresaId) {
  garantirClientePadrao(empresaId);
  return Object.values(clientesPersistidos(empresaId).clientes)
    .filter((cliente) => cliente.status !== 'deletado' && cliente.empresaId === empresaId)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function obterCliente(empresaId, clienteId) {
  const cliente = clientesPersistidos(empresaId).clientes[clienteId];
  return cliente?.empresaId === empresaId ? garantirConsentimentos(cliente) : null;
}

export function criarContaReceber(empresaId, dados) {
  const store = clientesPersistidos(empresaId);
  const cliente = obterCliente(empresaId, dados?.clienteId);
  if (!cliente) throw new Error('Cliente não encontrado no escopo da empresa ativa.');
  const conta = contaPadrao(empresaId, `ctr-${Date.now().toString(36)}-${String(Object.keys(store.contasReceber).length + 1).padStart(3, '0')}`, dados);
  if (!conta.descricao || conta.valor <= 0) throw new Error('Descrição e valor positivo são obrigatórios.');
  store.contasReceber[conta.id] = conta;
  if (conta.status !== 'paga') cliente.saldoDevedor = Number(cliente.saldoDevedor || 0) + conta.valor;
  return conta;
}

export function atualizarContaReceber(empresaId, contaId, dados) {
  const store = clientesPersistidos(empresaId);
  const conta = store.contasReceber[contaId];
  if (!conta || conta.empresaId !== empresaId) return null;
  const clienteAnterior = obterCliente(empresaId, conta.clienteId);
  const saldoAntes = conta.status !== 'paga' ? Number(conta.valor || 0) : 0;
  const normalizada = normalizarContaReceber({ ...conta, ...dados });
  const clienteNovo = obterCliente(empresaId, normalizada.clienteId);
  if (!clienteNovo) throw new Error('Cliente não encontrado no escopo da empresa ativa.');
  Object.assign(conta, normalizada, { atualizadoEm: agora() });
  const diasAtraso = Math.floor((Date.now() - new Date(conta.dataVencimento).valueOf()) / 86400000);
  conta.status = conta.dataPagamento ? 'paga' : diasAtraso > 0 ? 'atrasada' : 'pendente';
  conta.diasAtraso = Math.max(0, diasAtraso);
  const saldoDepois = conta.status !== 'paga' ? Number(conta.valor || 0) : 0;
  if (clienteAnterior?.id === clienteNovo.id) {
    clienteNovo.saldoDevedor = Math.max(0, Number(clienteNovo.saldoDevedor || 0) - saldoAntes + saldoDepois);
  } else {
    if (clienteAnterior) clienteAnterior.saldoDevedor = Math.max(0, Number(clienteAnterior.saldoDevedor || 0) - saldoAntes);
    clienteNovo.saldoDevedor = Math.max(0, Number(clienteNovo.saldoDevedor || 0) + saldoDepois);
  }
  return conta;
}

export function listarContasReceber(empresaId, filtros = {}) {
  return Object.values(clientesPersistidos(empresaId).contasReceber)
    .filter((conta) => conta.empresaId === empresaId)
    .filter((conta) => !filtros.clienteId || conta.clienteId === filtros.clienteId)
    .filter((conta) => !filtros.status || conta.status === filtros.status)
    .sort((a, b) => new Date(a.dataVencimento) - new Date(b.dataVencimento));
}

export function verificarAlertasVencimento(empresaId) {
  const store = clientesPersistidos(empresaId);
  const ts = agora();
  const alertas = [];
  for (const conta of Object.values(store.contasReceber)) {
    if (conta.empresaId !== empresaId || conta.status === 'paga') continue;
    const diasAteVenc = Math.floor((new Date(conta.dataVencimento).valueOf() - Date.now()) / 86400000);
    const diasAtraso = Math.floor((Date.now() - new Date(conta.dataVencimento).valueOf()) / 86400000);
    if (diasAteVenc >= 0 && diasAteVenc <= 3) alertas.push({
      id: `alt-${conta.id}`, empresaId, tipo: 'vencimento_proximo', contaId: conta.id, clienteId: conta.clienteId,
      valor: conta.valor, dataVencimento: conta.dataVencimento, diasAteVenc,
      severidade: diasAteVenc === 0 ? 'critica' : 'alta', criadoEm: ts,
    });
    if (diasAtraso > 0) alertas.push({
      id: `alt-${conta.id}`, empresaId, tipo: 'vencimento_atrasado', contaId: conta.id, clienteId: conta.clienteId,
      valor: conta.valor, dataVencimento: conta.dataVencimento, diasAtraso,
      severidade: diasAtraso > 7 ? 'critica' : 'alta', criadoEm: ts,
    });
  }
  store.alertas = Object.fromEntries(alertas.map((alerta) => [alerta.contaId, alerta]));
  return alertas;
}

export function listarAlertas(empresaId) {
  return Object.values(clientesPersistidos(empresaId).alertas).filter((alerta) => alerta.empresaId === empresaId);
}

export function criarFechamentoDiario(empresaId, dados = {}) {
  const store = clientesPersistidos(empresaId);
  const dataFechamento = String(dados.dataFechamento || agora().slice(0, 10)).slice(0, 10);
  const contas = Object.values(store.contasReceber).filter((conta) => conta.empresaId === empresaId);
  const abertas = contas.filter((conta) => conta.status !== 'paga');
  const totalReceber = abertas.reduce((soma, conta) => soma + Number(conta.valor || 0), 0);
  const totalRecebido = contas.filter((conta) => conta.status === 'paga' && String(conta.dataPagamento || '').slice(0, 10) === dataFechamento).reduce((soma, conta) => soma + Number(conta.valor || 0), 0);
  const totalPendente = abertas.filter((conta) => conta.status === 'pendente').reduce((soma, conta) => soma + Number(conta.valor || 0), 0);
  const totalAtrasado = abertas.filter((conta) => conta.status === 'atrasada').reduce((soma, conta) => soma + Number(conta.valor || 0), 0);
  const fechamento = {
    id: `fec-${empresaId}-${dataFechamento}-${Date.now().toString(36)}`, empresaId, dataFechamento,
    totalClientes: Object.values(store.clientes).filter((cliente) => cliente.status !== 'deletado').length,
    totalContasReceber: contas.length, totalReceber, totalRecebido, totalPendente, totalAtrasado,
    alertas: Object.values(store.alertas).length, observacao: texto(dados.observacao, 300),
    responsavel: texto(dados.responsavel, 120) || 'admin@setpoint-ultra.local',
    origem: texto(dados.origem, 30) || 'manual', status: 'fechado', criadoEm: agora(),
  };
  store.fechamentoDiario[fechamento.id] = fechamento;
  return fechamento;
}

export function listarFechamentosDiarios(empresaId) {
  return Object.values(clientesPersistidos(empresaId).fechamentoDiario)
    .filter((fechamento) => fechamento.empresaId === empresaId)
    .sort((a, b) => new Date(b.dataFechamento) - new Date(a.dataFechamento));
}

export function obterFechamentoDiario(empresaId, dataFechamento) {
  return Object.values(clientesPersistidos(empresaId).fechamentoDiario)
    .find((fechamento) => fechamento.empresaId === empresaId && fechamento.dataFechamento === dataFechamento) || null;
}

export { saveFn as save };

export default {
  clientesPersistidos, garantirClientePadrao, criarCliente, atualizarCliente, atualizarConsentimentoCliente, listarClientes, obterCliente,
  criarContaReceber, atualizarContaReceber, listarContasReceber, verificarAlertasVencimento,
  listarAlertas, criarFechamentoDiario, listarFechamentosDiarios, obterFechamentoDiario,
};

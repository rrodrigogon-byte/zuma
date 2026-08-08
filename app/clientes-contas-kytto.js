// Módulo de Clientes, Contas a Receber, Alertas e Fechamento Diário para Setpoint Kytto
// Persistência: JSON em Google Cloud Storage (db.js)

export function clientesPersistidos() {
  const estado = require('./db.js').db();
  if (!estado.clientesKytto || typeof estado.clientesKytto !== 'object') {
    estado.clientesKytto = { clientes: {}, contasReceber: {}, alertas: {}, fechamentoDiario: {} };
  }
  estado.clientesKytto.clientes ||= {};
  estado.clientesKytto.contasReceber ||= {};
  estado.clientesKytto.alertas ||= {};
  estado.clientesKytto.fechamentoDiario ||= {};
  return estado.clientesKytto;
}

function normalizarCliente(payload = {}) {
  const texto = (valor, limite = 120) => String(valor ?? '').trim().slice(0, limite);
  const numero = (valor) => Number(valor ?? 0);
  return {
    nome: texto(payload.nome),
    tipo: ['pf', 'pj'].includes(String(payload.tipo).toLowerCase()) ? String(payload.tipo).toLowerCase() : 'pf',
    cpfCnpj: texto(payload.cpfCnpj ?? payload.cpf_cnpj, 20),
    email: texto(payload.email, 100),
    telefone: texto(payload.telefone, 20),
    endereco: texto(payload.endereco, 200),
    limiteCreditoMensal: Math.max(0, numero(payload.limiteCreditoMensal ?? payload.limite_credito ?? 0)),
    diasVencimento: Math.max(1, Math.min(90, numero(payload.diasVencimento ?? payload.dias_pagamento ?? 30))),
    observacao: texto(payload.observacao, 300),
  };
}

function clientePadrao(id, dados = {}) {
  const agora = new Date().toISOString();
  const normalizado = normalizarCliente(dados);
  return {
    id,
    ...normalizado,
    status: 'ativo',
    saldoDevedor: 0,
    scoreCredito: 100,
    risco: 'baixo',
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

function normalizarContaReceber(payload = {}) {
  const texto = (valor, limite = 200) => String(valor ?? '').trim().slice(0, limite);
  const numero = (valor) => Number(valor ?? 0);
  const data = (valor) => {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  };
  return {
    clienteId: texto(payload.clienteId ?? payload.cliente_id, 50),
    mesaNumero: Math.max(0, numero(payload.mesaNumero ?? payload.mesa_numero ?? 0)),
    descricao: texto(payload.descricao, 200),
    valor: Math.max(0, numero(payload.valor)),
    dataVencimento: data(payload.dataVencimento ?? payload.data_vencimento),
    dataPagamento: payload.dataPagamento ? data(payload.dataPagamento) : null,
    observacao: texto(payload.observacao, 300),
  };
}

function contaReceberPadrao(id, dados = {}) {
  const agora = new Date().toISOString();
  const normalizado = normalizarContaReceber(dados);
  const dataVenc = new Date(normalizado.dataVencimento);
  const diasAtraso = Math.floor((new Date() - dataVenc) / (1000 * 60 * 60 * 24));
  return {
    id,
    ...normalizado,
    status: normalizado.dataPagamento ? 'paga' : diasAtraso > 0 ? 'atrasada' : 'pendente',
    diasAtraso: Math.max(0, diasAtraso),
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

export function criarCliente(dados) {
  const store = clientesPersistidos();
  const id = `cli-${Date.now().toString(36)}-${String(Object.keys(store.clientes).length + 1).padStart(3, '0')}`;
  const cliente = clientePadrao(id, dados);
  store.clientes[id] = cliente;
  return cliente;
}

export function atualizarCliente(clienteId, dados) {
  const store = clientesPersistidos();
  const cliente = store.clientes[clienteId];
  if (!cliente) return null;
  const normalizado = normalizarCliente(dados);
  Object.assign(cliente, normalizado, { atualizadoEm: new Date().toISOString() });
  return cliente;
}

export function listarClientes() {
  const store = clientesPersistidos();
  return Object.values(store.clientes)
    .filter(c => c.status !== 'deletado')
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

export function obterCliente(clienteId) {
  return clientesPersistidos().clientes[clienteId] || null;
}

export function criarContaReceber(dados) {
  const store = clientesPersistidos();
  const id = `ctr-${Date.now().toString(36)}-${String(Object.keys(store.contasReceber).length + 1).padStart(3, '0')}`;
  const conta = contaReceberPadrao(id, dados);
  store.contasReceber[id] = conta;
  
  // Atualizar saldo devedor do cliente
  const cliente = store.clientes[conta.clienteId];
  if (cliente && conta.status !== 'paga') {
    cliente.saldoDevedor = (cliente.saldoDevedor || 0) + conta.valor;
  }
  
  return conta;
}

export function atualizarContaReceber(contaId, dados) {
  const store = clientesPersistidos();
  const contaAnterior = store.contasReceber[contaId];
  if (!contaAnterior) return null;
  
  const normalizado = normalizarContaReceber(dados);
  const statusAnterior = contaAnterior.status;
  Object.assign(contaAnterior, normalizado, { atualizadoEm: new Date().toISOString() });
  
  // Recalcular status
  const dataVenc = new Date(contaAnterior.dataVencimento);
  const diasAtraso = Math.floor((new Date() - dataVenc) / (1000 * 60 * 60 * 24));
  contaAnterior.status = contaAnterior.dataPagamento ? 'paga' : diasAtraso > 0 ? 'atrasada' : 'pendente';
  contaAnterior.diasAtraso = Math.max(0, diasAtraso);
  
  // Atualizar saldo devedor
  const cliente = store.clientes[contaAnterior.clienteId];
  if (cliente) {
    const diferenca = (statusAnterior !== 'paga' ? contaAnterior.valor : 0) - (contaAnterior.status !== 'paga' ? contaAnterior.valor : 0);
    cliente.saldoDevedor = Math.max(0, (cliente.saldoDevedor || 0) + diferenca);
  }
  
  return contaAnterior;
}

export function listarContasReceber(filtros = {}) {
  const store = clientesPersistidos();
  return Object.values(store.contasReceber)
    .filter(c => {
      if (filtros.clienteId && c.clienteId !== filtros.clienteId) return false;
      if (filtros.status && c.status !== filtros.status) return false;
      return true;
    })
    .sort((a, b) => new Date(a.dataVencimento) - new Date(b.dataVencimento));
}

export function verificarAlertasVencimento() {
  const store = clientesPersistidos();
  const agora = new Date();
  const alertas = [];
  
  for (const conta of Object.values(store.contasReceber)) {
    if (conta.status === 'paga') continue;
    
    const dataVenc = new Date(conta.dataVencimento);
    const diasAteVenc = Math.floor((dataVenc - agora) / (1000 * 60 * 60 * 24));
    const diasAtraso = Math.floor((agora - dataVenc) / (1000 * 60 * 60 * 24));
    
    // Alerta: vencimento em até 3 dias
    if (diasAteVenc >= 0 && diasAteVenc <= 3) {
      alertas.push({
        tipo: 'vencimento_proximo',
        contaId: conta.id,
        clienteId: conta.clienteId,
        valor: conta.valor,
        dataVencimento: conta.dataVencimento,
        diasAteVenc,
        severidade: diasAteVenc === 0 ? 'critica' : 'alta',
        criadoEm: agora.toISOString(),
      });
    }
    
    // Alerta: vencimento atrasado
    if (diasAtraso > 0) {
      alertas.push({
        tipo: 'vencimento_atrasado',
        contaId: conta.id,
        clienteId: conta.clienteId,
        valor: conta.valor,
        dataVencimento: conta.dataVencimento,
        diasAtraso,
        severidade: diasAtraso > 7 ? 'critica' : 'alta',
        criadoEm: agora.toISOString(),
      });
    }
  }
  
  store.alertas = alertas.reduce((acc, alerta) => {
    acc[alerta.contaId] = alerta;
    return acc;
  }, {});
  
  return alertas;
}

export function listarAlertas() {
  return Object.values(clientesPersistidos().alertas);
}

export function criarFechamentoDiario(dados = {}) {
  const store = clientesPersistidos();
  const agora = new Date();
  const dataFechamento = agora.toISOString().split('T')[0];
  
  // Calcular totais
  const contasReceber = Object.values(store.contasReceber);
  const totalReceber = contasReceber.reduce((soma, c) => soma + (c.status !== 'paga' ? c.valor : 0), 0);
  const totalRecebido = contasReceber.reduce((soma, c) => soma + (c.status === 'paga' && new Date(c.dataPagamento).toISOString().split('T')[0] === dataFechamento ? c.valor : 0), 0);
  const totalPendente = totalReceber - totalRecebido;
  const totalAtrasado = contasReceber.reduce((soma, c) => soma + (c.status === 'atrasada' ? c.valor : 0), 0);
  
  const fechamento = {
    id: `fec-${dataFechamento}-${Date.now().toString(36)}`,
    dataFechamento,
    totalClientes: Object.keys(store.clientes).filter(id => store.clientes[id].status !== 'deletado').length,
    totalContasReceber,
    totalReceber,
    totalRecebido,
    totalPendente,
    totalAtrasado,
    alertas: Object.values(store.alertas).length,
    observacao: dados.observacao || '',
    responsavel: dados.responsavel || 'admin@setpoint-ultra.local',
    status: 'fechado',
    criadoEm: agora.toISOString(),
  };
  
  store.fechamentoDiario[fechamento.id] = fechamento;
  return fechamento;
}

export function listarFechamentosDiarios() {
  return Object.values(clientesPersistidos().fechamentoDiario)
    .sort((a, b) => new Date(b.dataFechamento) - new Date(a.dataFechamento));
}

export function obterFechamentoDiario(dataFechamento) {
  const store = clientesPersistidos();
  return Object.values(store.fechamentoDiario).find(f => f.dataFechamento === dataFechamento) || null;
}

export default {
  clientesPersistidos,
  criarCliente,
  atualizarCliente,
  listarClientes,
  obterCliente,
  criarContaReceber,
  atualizarContaReceber,
  listarContasReceber,
  verificarAlertasVencimento,
  listarAlertas,
  criarFechamentoDiario,
  listarFechamentosDiarios,
  obterFechamentoDiario,
};

import { db, save } from './db.js';

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

function dataAtual() {
  return new Date().toISOString();
}

function chaveDia(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
}

function novoId(prefixo, bucket) {
  return `${prefixo}-${Date.now().toString(36)}-${String(Object.keys(bucket).length + 1).padStart(3, '0')}`;
}

function estadoVazio() {
  return {
    profissionais: {},
    servicos: {},
    agendamentos: {},
    configuracao: {
      horarioAbertura: '08:00',
      horarioFechamento: '20:00',
      intervaloMinutos: 30,
      diasFuncionamento: [1, 2, 3, 4, 5, 6],
      antecedenciaMinutos: 60,
      janelaReservaDias: 60,
      politicaCancelamentoHoras: 4,
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
      configuracao: { ...vazio.configuracao, ...(estado.configuracao || {}) },
    };
  }
  estado.profissionais ||= {};
  estado.servicos ||= {};
  estado.agendamentos ||= {};
  estado.configuracao ||= {};
  return estado;
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
    descontaTaxaMaquininha: dados.descontaTaxaMaquininha ?? dados.desconta_taxa_maquininha ?? anterior.descontaTaxaMaquininha ?? true,
    horarioInicio: texto(dados.horarioInicio ?? dados.horario_inicio ?? anterior.horarioInicio, 5) || '08:00',
    horarioFim: texto(dados.horarioFim ?? dados.horario_fim ?? anterior.horarioFim, 5) || '18:00',
    diasTrabalho: dias,
    ativo: dados.ativo ?? anterior.ativo ?? true,
    fotoUrl: texto(dados.fotoUrl ?? dados.foto_url ?? anterior.fotoUrl, 500),
  };
}

function servicoNormalizado(dados = {}, anterior = {}) {
  const preco = dinheiro(dados.preco ?? anterior.preco);
  const duracao = Math.max(5, Math.min(480, Math.round(numero(dados.duracaoMinutos ?? dados.duracao_minutos ?? anterior.duracaoMinutos, 30))));
  return {
    nome: texto(dados.nome ?? anterior.nome, 120),
    descricao: texto(dados.descricao ?? anterior.descricao, 500),
    categoria: texto(dados.categoria ?? anterior.categoria, 80) || 'Geral',
    duracaoMinutos: duracao,
    preco,
    ativo: dados.ativo ?? anterior.ativo ?? true,
    permiteAgendamentoOnline: dados.permiteAgendamentoOnline ?? dados.permite_agendamento_online ?? anterior.permiteAgendamentoOnline ?? true,
  };
}

function agendamentoNormalizado(dados = {}, anterior = {}) {
  const dataHora = texto(dados.dataHora ?? dados.data_hora ?? anterior.dataHora, 40);
  const status = STATUS.has(String(dados.status ?? anterior.status)) ? String(dados.status ?? anterior.status) : 'agendado';
  return {
    clienteId: texto(dados.clienteId ?? dados.cliente_id ?? anterior.clienteId, 100),
    clienteNome: texto(dados.clienteNome ?? dados.cliente_nome ?? anterior.clienteNome, 160),
    clienteTelefone: texto(dados.clienteTelefone ?? dados.cliente_telefone ?? anterior.clienteTelefone, 30),
    clienteEmail: texto(dados.clienteEmail ?? dados.cliente_email ?? anterior.clienteEmail, 160).toLowerCase(),
    profissionalId: texto(dados.profissionalId ?? dados.profissional_id ?? anterior.profissionalId, 100),
    servicoId: texto(dados.servicoId ?? dados.servico_id ?? anterior.servicoId, 100),
    dataHora,
    dataAgenda: texto(dados.dataAgenda ?? dados.data_agenda ?? anterior.dataAgenda, 10) || chaveDia(dataHora),
    duracaoMinutos: Math.max(5, Math.min(480, Math.round(numero(dados.duracaoMinutos ?? dados.duracao_minutos ?? anterior.duracaoMinutos, 30)))),
    valor: dinheiro(dados.valor ?? anterior.valor),
    status,
    observacoes: texto(dados.observacoes ?? anterior.observacoes, 600),
    origem: texto(dados.origem ?? anterior.origem, 40) || 'admin',
    meioPagamento: texto(dados.meioPagamento ?? dados.meio_pagamento ?? anterior.meioPagamento, 40).toLowerCase(),
    valorRecebido: dinheiro(dados.valorRecebido ?? dados.valor_recebido ?? anterior.valorRecebido),
    financeiroLancamentoId: texto(dados.financeiroLancamentoId ?? dados.financeiro_lancamento_id ?? anterior.financeiroLancamentoId, 120),
  };
}

function ordenarPorData(a, b) {
  return new Date(a.dataHora).valueOf() - new Date(b.dataHora).valueOf();
}

export function obterConfiguracao(empresaId) {
  return { ...estadoEmpresa(empresaId, false).configuracao };
}

export function atualizarConfiguracao(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado.configuracao;
  const dias = Array.isArray(dados.diasFuncionamento ?? dados.dias_funcionamento)
    ? [...new Set((dados.diasFuncionamento ?? dados.dias_funcionamento).map((item) => numero(item, -1)).filter((item) => item >= 0 && item <= 6))].sort()
    : actualOrDefault(atual.diasFuncionamento, [1, 2, 3, 4, 5, 6]);
  Object.assign(atual, {
    horarioAbertura: texto(dados.horarioAbertura ?? dados.horario_abertura ?? atual.horarioAbertura, 5) || '08:00',
    horarioFechamento: texto(dados.horarioFechamento ?? dados.horario_fechamento ?? atual.horarioFechamento, 5) || '20:00',
    intervaloMinutos: Math.max(5, Math.min(240, Math.round(numero(dados.intervaloMinutos ?? dados.intervalo_minutos ?? atual.intervaloMinutos, 30)))),
    diasFuncionamento: dias,
    antecedenciaMinutos: Math.max(0, Math.min(10080, Math.round(numero(dados.antecedenciaMinutos ?? dados.antecedencia_minutos ?? atual.antecedenciaMinutos, 60)))),
    janelaReservaDias: Math.max(1, Math.min(365, Math.round(numero(dados.janelaReservaDias ?? dados.janela_reserva_dias ?? atual.janelaReservaDias, 60)))),
    politicaCancelamentoHoras: Math.max(0, Math.min(168, Math.round(numero(dados.politicaCancelamentoHoras ?? dados.politica_cancelamento_horas ?? atual.politicaCancelamentoHoras, 4)))),
  });
  save();
  return { ...atual };
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

export function listarServicos(empresaId, { incluirInativos = false } = {}) {
  return Object.values(estadoEmpresa(empresaId, false).servicos)
    .filter((item) => incluirInativos || item.ativo !== false)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function criarServico(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const servico = servicoNormalizado(dados);
  if (!servico.nome) throw new Error('Nome do serviço é obrigatório.');
  if (servico.preco <= 0) throw new Error('Preço do serviço deve ser positivo.');
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
  if (servico.preco <= 0) throw new Error('Preço do serviço deve ser positivo.');
  Object.assign(atual, servico, { atualizadoEm: dataAtual() });
  save();
  return { ...atual };
}

export function listarAgendamentos(empresaId, filtros = {}) {
  const itens = Object.values(estadoEmpresa(empresaId, false).agendamentos)
    .filter((item) => !filtros.data || String(item.dataAgenda || chaveDia(item.dataHora)).slice(0, 10) === String(filtros.data).slice(0, 10))
    .filter((item) => !filtros.status || item.status === String(filtros.status))
    .filter((item) => !filtros.profissionalId || item.profissionalId === String(filtros.profissionalId))
    .sort(ordenarPorData);
  return itens.map((item) => ({ ...item }));
}

function verificarConflito(estado, dados, ignorarId = '') {
  const inicio = new Date(dados.dataHora).valueOf();
  if (!Number.isFinite(inicio)) throw new Error('Data e horário do atendimento são inválidos.');
  const fim = inicio + dados.duracaoMinutos * 60 * 1000;
  return Object.values(estado.agendamentos).find((item) => {
    if (item.id === ignorarId || item.status === 'cancelado' || item.status === 'nao_compareceu') return false;
    if (!dados.profissionalId || item.profissionalId !== dados.profissionalId) return false;
    const outroInicio = new Date(item.dataHora).valueOf();
    const outroFim = outroInicio + item.duracaoMinutos * 60 * 1000;
    return inicio < outroFim && outroInicio < fim;
  });
}

export function criarAgendamento(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const agendamento = agendamentoNormalizado(dados);
  if (!agendamento.clienteNome && !agendamento.clienteId) throw new Error('Informe o cliente do atendimento.');
  if (!agendamento.servicoId || !estado.servicos[agendamento.servicoId] || estado.servicos[agendamento.servicoId].ativo === false) throw new Error('Serviço ativo é obrigatório.');
  if (agendamento.profissionalId && (!estado.profissionais[agendamento.profissionalId] || estado.profissionais[agendamento.profissionalId].ativo === false)) throw new Error('Profissional não encontrado ou inativo.');
  const servico = estado.servicos[agendamento.servicoId];
  agendamento.duracaoMinutos = servico.duracaoMinutos;
  agendamento.valor = agendamento.valor > 0 ? agendamento.valor : servico.preco;
  if (verificarConflito(estado, agendamento)) throw new Error('Horário indisponível para o profissional selecionado.');
  const id = novoId('age', estado.agendamentos);
  const agora = dataAtual();
  estado.agendamentos[id] = { id, empresaId: String(empresaId), ...agendamento, criadoEm: agora, atualizadoEm: agora };
  save();
  return { ...estado.agendamentos[id] };
}

export function atualizarAgendamento(empresaId, agendamentoId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado.agendamentos[String(agendamentoId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;
  const agendamento = agendamentoNormalizado(dados, atual);
  agendamento.status = atual.status;
  if (!agendamento.servicoId || !estado.servicos[agendamento.servicoId] || estado.servicos[agendamento.servicoId].ativo === false) throw new Error('Serviço ativo é obrigatório.');
  agendamento.duracaoMinutos = estado.servicos[agendamento.servicoId].duracaoMinutos;
  agendamento.valor = agendamento.valor > 0 ? agendamento.valor : estado.servicos[agendamento.servicoId].preco;
  if (verificarConflito(estado, agendamento, atual.id)) throw new Error('Horário indisponível para o profissional selecionado.');
  Object.assign(atual, agendamento, { atualizadoEm: dataAtual() });
  save();
  return { ...atual };
}

export function alterarStatusAgendamento(empresaId, agendamentoId, status, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado.agendamentos[String(agendamentoId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;
  const novoStatus = String(status || '');
  if (!STATUS.has(novoStatus)) throw new Error('Status de atendimento inválido.');
  if (novoStatus !== atual.status && !TRANSICOES[atual.status]?.has(novoStatus)) {
    throw new Error(`Transição de ${atual.status} para ${novoStatus} não permitida.`);
  }
  Object.assign(atual, {
    status: novoStatus,
    meioPagamento: texto(dados.meioPagamento ?? dados.meio_pagamento ?? atual.meioPagamento, 40).toLowerCase(),
    valorRecebido: dinheiro(dados.valorRecebido ?? dados.valor_recebido ?? (novoStatus === 'concluido' ? atual.valor : atual.valorRecebido)),
    observacoes: texto(dados.observacoes ?? atual.observacoes, 600),
    atualizadoEm: dataAtual(),
  });
  save();
  return { ...atual };
}

export function vincularLancamentoFinanceiro(empresaId, agendamentoId, lancamentoId) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado.agendamentos[String(agendamentoId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;
  if (atual.status !== 'concluido') throw new Error('Somente atendimentos concluídos podem receber vínculo financeiro.');
  atual.financeiroLancamentoId = texto(lancamentoId, 120);
  atual.atualizadoEm = dataAtual();
  save();
  return { ...atual };
}

export function obterDashboard(empresaId, { data = chaveDia(dataAtual()), clientesAtivos = 0, financeiro = null, caixa = null } = {}) {
  const estado = estadoEmpresa(empresaId, false);
  const agendamentos = Object.values(estado.agendamentos);
  const hoje = agendamentos.filter((item) => String(item.dataAgenda || chaveDia(item.dataHora)).slice(0, 10) === String(data).slice(0, 10));
  const concluidosHoje = hoje.filter((item) => item.status === 'concluido');
  const proximos = agendamentos.filter((item) => item.status !== 'cancelado' && item.status !== 'concluido' && new Date(item.dataHora).valueOf() >= Date.now()).sort(ordenarPorData).slice(0, 8);
  return {
    data: String(data).slice(0, 10),
    indicadores: {
      agendamentosHoje: hoje.length,
      confirmadosHoje: hoje.filter((item) => item.status === 'confirmado').length,
      emAtendimento: agendamentos.filter((item) => item.status === 'em_atendimento').length,
      concluidosHoje: concluidosHoje.length,
      faturamentoHoje: dinheiro(concluidosHoje.reduce((soma, item) => soma + Number(item.valorRecebido || item.valor || 0), 0)),
      profissionaisAtivos: Object.values(estado.profissionais).filter((item) => item.ativo !== false).length,
      servicosAtivos: Object.values(estado.servicos).filter((item) => item.ativo !== false).length,
      clientesAtivos: Number(clientesAtivos || 0),
    },
    proximosAgendamentos: proximos,
    financeiro,
    caixa,
  };
}

export function exportarEstado(empresaId) {
  const estado = estadoEmpresa(empresaId);
  return {
    configuracao: { ...estado.configuracao },
    profissionais: listarProfissionais(empresaId, { incluirInativos: true }),
    servicos: listarServicos(empresaId, { incluirInativos: true }),
    agendamentos: listarAgendamentos(empresaId),
  };
}

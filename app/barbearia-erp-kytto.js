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
    bloqueios: {},
    filaEspera: {},
    filaSequencia: 0,
    planos: {},
    assinaturas: {},
    produtosRevenda: {},
    movimentosEstoque: {},
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
      bloqueios: estado.bloqueios || {},
      filaEspera: estado.filaEspera || {},
      filaSequencia: Number(estado.filaSequencia || 0),
      planos: estado.planos || {},
      assinaturas: estado.assinaturas || {},
      produtosRevenda: estado.produtosRevenda || {},
      movimentosEstoque: estado.movimentosEstoque || {},
      configuracao: { ...vazio.configuracao, ...(estado.configuracao || {}) },
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
  };
}

export function listarBloqueios(empresaId, filtros = {}) {
  return Object.values(estadoEmpresa(empresaId, false).bloqueios)
    .filter((item) => filtros.incluirInativos || item.ativo !== false)
    .filter((item) => !filtros.data || chaveDia(item.inicio) <= String(filtros.data).slice(0, 10) && chaveDia(item.fim) >= String(filtros.data).slice(0, 10))
    .filter((item) => !filtros.profissionalId || !item.profissionalId || item.profissionalId === String(filtros.profissionalId))
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
    dataAgenda: texto(dados.dataAgenda ?? dados.data_agenda ?? anterior.dataAgenda, 10) || chaveDia(dataAtual()),
  };
}

export function listarFilaEspera(empresaId, filtros = {}) {
  return Object.values(estadoEmpresa(empresaId, false).filaEspera)
    .filter((item) => !filtros.status || item.status === String(filtros.status))
    .filter((item) => !filtros.data || String(item.dataAgenda || chaveDia(item.criadoEm)).slice(0, 10) === String(filtros.data).slice(0, 10))
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
  return {
    nome: texto(dados.nome ?? anterior.nome, 140),
    sku: texto(dados.sku ?? anterior.sku, 80),
    categoria: texto(dados.categoria ?? anterior.categoria, 80) || 'Revenda',
    unidade: texto(dados.unidade ?? anterior.unidade, 20) || 'un',
    precoVenda: dinheiro(dados.precoVenda ?? dados.preco_venda ?? anterior.precoVenda),
    custoUnitario: dinheiro(dados.custoUnitario ?? dados.custo_unitario ?? anterior.custoUnitario),
    estoqueAtual: Math.max(0, Math.round(numero(dados.estoqueAtual ?? dados.estoque_atual ?? anterior.estoqueAtual, 0))),
    estoqueMinimo: Math.max(0, Math.round(numero(dados.estoqueMinimo ?? dados.estoque_minimo ?? anterior.estoqueMinimo, 0))),
    ativo: dados.ativo ?? anterior.ativo ?? true,
  };
}

function statusEstoque(item) {
  if (Number(item.estoqueAtual || 0) <= 0) return 'sem_estoque';
  if (Number(item.estoqueAtual || 0) <= Number(item.estoqueMinimo || 0)) return 'baixo';
  return 'ok';
}

export function listarProdutosRevenda(empresaId, { incluirInativos = false } = {}) {
  return Object.values(estadoEmpresa(empresaId, false).produtosRevenda)
    .filter((item) => incluirInativos || item.ativo !== false)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((item) => ({ ...item, statusEstoque: statusEstoque(item) }));
}

export function criarProdutoRevenda(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const produto = produtoRevendaNormalizado(dados);
  if (!produto.nome) throw new Error('Nome do produto de revenda é obrigatório.');
  if (produto.precoVenda <= 0) throw new Error('Preço de venda deve ser positivo.');
  if (Object.values(estado.produtosRevenda).some((item) => item.ativo !== false && item.nome.toLowerCase() === produto.nome.toLowerCase())) throw new Error('Já existe produto ativo de revenda com este nome.');
  const id = novoId('rev', estado.produtosRevenda);
  const agora = dataAtual();
  estado.produtosRevenda[id] = { id, empresaId: String(empresaId), ...produto, criadoEm: agora, atualizadoEm: agora };
  if (produto.estoqueAtual > 0) {
    const movimentoId = novoId('mov', estado.movimentosEstoque);
    estado.movimentosEstoque[movimentoId] = { id: movimentoId, empresaId: String(empresaId), produtoId: id, tipo: 'entrada_inicial', quantidade: produto.estoqueAtual, estoqueAnterior: 0, estoquePosterior: produto.estoqueAtual, observacao: 'Estoque inicial informado no cadastro.', criadoEm: agora };
  }
  save();
  return { ...estado.produtosRevenda[id], statusEstoque: statusEstoque(estado.produtosRevenda[id]) };
}

export function atualizarProdutoRevenda(empresaId, produtoId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const atual = estado.produtosRevenda[String(produtoId)];
  if (!atual || atual.empresaId !== String(empresaId)) return null;
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
  const tipo = String(dados.tipo || 'ajuste');
  const quantidade = Math.round(numero(dados.quantidade ?? dados.qtd, NaN));
  if (!Number.isFinite(quantidade) || quantidade <= 0) throw new Error('Quantidade positiva é obrigatória.');
  if (!['entrada', 'saida_manual', 'ajuste'].includes(tipo)) throw new Error('Tipo de movimento inválido.');
  const anterior = Number(produto.estoqueAtual || 0);
  const posterior = tipo === 'entrada' ? anterior + quantidade : tipo === 'saida_manual' ? anterior - quantidade : quantidade;
  if (posterior < 0) throw new Error('Estoque insuficiente para esta saída.');
  const agora = dataAtual();
  const movimentoId = novoId('mov', estado.movimentosEstoque);
  estado.movimentosEstoque[movimentoId] = { id: movimentoId, empresaId: String(empresaId), produtoId: produto.id, tipo, quantidade, estoqueAnterior: anterior, estoquePosterior: posterior, observacao: texto(dados.observacao ?? dados.motivo, 300), criadoEm: agora };
  produto.estoqueAtual = posterior;
  produto.atualizadoEm = agora;
  produto.ultimoMovimentoEm = agora;
  save();
  return { produto: { ...produto, statusEstoque: statusEstoque(produto) }, movimento: { ...estado.movimentosEstoque[movimentoId] } };
}

export function listarMovimentosEstoque(empresaId, filtros = {}) {
  return Object.values(estadoEmpresa(empresaId, false).movimentosEstoque)
    .filter((item) => !filtros.produtoId || item.produtoId === String(filtros.produtoId))
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .map((item) => ({ ...item }));
}

function verificarConflito(estado, dados, ignorarId = '') {
  const inicio = new Date(dados.dataHora).valueOf();
  if (!Number.isFinite(inicio)) throw new Error('Data e horário do atendimento são inválidos.');
  const fim = inicio + dados.duracaoMinutos * 60 * 1000;
  const bloqueio = Object.values(estado.bloqueios).find((item) => item.ativo !== false && (!item.profissionalId || item.profissionalId === dados.profissionalId) && sobrepoe(dados.dataHora, new Date(fim).toISOString(), item.inicio, item.fim));
  if (bloqueio) return { tipo: 'bloqueio', ...bloqueio };
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
  const fila = Object.values(estado.filaEspera).filter((item) => item.status === 'aguardando' || item.status === 'chamado');
  const bloqueiosHoje = Object.values(estado.bloqueios).filter((item) => item.ativo !== false && chaveDia(item.inicio) <= String(data).slice(0, 10) && chaveDia(item.fim) >= String(data).slice(0, 10));
  const assinaturasAtivas = Object.values(estado.assinaturas).filter((item) => item.status === 'ativa');
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
      filaAguardando: fila.length,
      bloqueiosHoje: bloqueiosHoje.length,
      assinaturasAtivas: assinaturasAtivas.length,
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
  };
}

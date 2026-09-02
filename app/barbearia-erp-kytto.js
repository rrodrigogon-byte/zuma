import { db, save } from './db.js';
import * as financeiroKytto from './financeiro-central-kytto.js';
import * as clientesKytto from './clientes-contas-kytto.js';
import * as caixaKytto from './caixa-diario-kytto.js';
import * as canaisFidelidadeKytto from './canais-fidelidade-kytto.js';

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
    vendasRevenda: {},
    comandas: {},
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
      vendasRevenda: estado.vendasRevenda || {},
      comandas: estado.comandas || {},
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
  estado.vendasRevenda ||= {};
  estado.comandas ||= {};
  estado.configuracao ||= {};
  estado.configuracao.lojas ||= {};
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
  return {
    slugPublico: slugRecebido,
    nomePublico: texto(dados.nomePublico ?? dados.nome_publico ?? anterior.nomePublico, 160),
    whatsappPublico: texto(dados.whatsappPublico ?? dados.whatsapp_publico ?? anterior.whatsappPublico, 30),
    enderecoPublico: texto(dados.enderecoPublico ?? dados.endereco_publico ?? anterior.enderecoPublico, 240),
    emojiPublico: texto(dados.emojiPublico ?? dados.emoji_publico ?? anterior.emojiPublico, 8) || '✂️',
    lojaPublicaId: texto(dados.lojaPublicaId ?? dados.loja_publica_id ?? anterior.lojaPublicaId, 120),
    agendamentoPublicoAtivo: ativoRecebido === undefined ? anterior.agendamentoPublicoAtivo !== false : Boolean(ativoRecebido),
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

function agendamentoNormalizado(dados = {}, anterior = {}) {
  const dataHora = texto(dados.dataHora ?? dados.data_hora ?? anterior.dataHora, 40);
  const status = STATUS.has(String(dados.status ?? anterior.status)) ? String(dados.status ?? anterior.status) : 'agendado';
  return {
    clienteId: texto(dados.clienteId ?? dados.cliente_id ?? anterior.clienteId, 100),
    clienteNome: texto(dados.clienteNome ?? dados.cliente_nome ?? anterior.clienteNome, 160),
    clienteTelefone: texto(dados.clienteTelefone ?? dados.cliente_telefone ?? anterior.clienteTelefone, 30),
        clienteEmail: texto(dados.clienteEmail ?? dados.cliente_email ?? anterior.clienteEmail, 160).toLowerCase(),
    lojaId: texto(dados.lojaId ?? dados.loja_id ?? anterior.lojaId, 120),
    horaLocal: texto(dados.horaLocal ?? dados.hora_local ?? anterior.horaLocal, 5),
    profissionalId:
 texto(dados.profissionalId ?? dados.profissional_id ?? anterior.profissionalId, 100),
    servicoId: texto(dados.servicoId ?? dados.servico_id ?? anterior.servicoId, 100),
    dataHora,
    dataAgenda: texto(dados.dataAgenda ?? dados.data_agenda ?? anterior.dataAgenda, 10) || chaveDia(dataHora),
    duracaoMinutos: Math.max(5, Math.min(480, Math.round(numero(dados.duracaoMinutos ?? dados.duracao_minutos ?? anterior.duracaoMinutos, 30)))),
    valor: dinheiro(dados.valor ?? anterior.valor),
    status,
    observacoes: texto(dados.observacoes ?? anterior.observacoes, 600),
    origem: texto(dados.origem ?? anterior.origem, 40) || 'admin',
    codigoConfirmacao: texto(dados.codigoConfirmacao ?? dados.codigo_confirmacao ?? anterior.codigoConfirmacao, 20).toUpperCase(),
    meioPagamento: texto(dados.meioPagamento ?? dados.meio_pagamento ?? anterior.meioPagamento, 40).toLowerCase(),
    valorRecebido: dinheiro(dados.valorRecebido ?? dados.valor_recebido ?? anterior.valorRecebido),
    financeiroLancamentoId: texto(dados.financeiroLancamentoId ?? dados.financeiro_lancamento_id ?? anterior.financeiroLancamentoId, 120),
  };
}

function ordenarPorData(a, b) {
  return new Date(a.dataHora).valueOf() - new Date(b.dataHora).valueOf();
}

export function obterConfiguracao(empresaId) {
  const configuracao = estadoEmpresa(empresaId, false).configuracao;
  return { ...configuracao, lojas: { ...(configuracao.lojas || {}) } };
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
  if (servico.preco <= 0) throw new Error('Preço do serviço deve ser positivo.');
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
  if (servico.preco <= 0) throw new Error('Preço do serviço deve ser positivo.');
  validarConsumoInternoServico(estado, empresaId, servico);
  Object.assign(atual, servico, { atualizadoEm: dataAtual() });
  save();
  return { ...atual };
}

export function listarAgendamentos(empresaId, filtros = {}) {
  const itens = Object.values(estadoEmpresa(empresaId, false).agendamentos)
    .filter((item) => !filtros.data || String(item.dataAgenda || chaveDia(item.dataHora)).slice(0, 10) === String(filtros.data).slice(0, 10))
    .filter((item) => !filtros.status || item.status === String(filtros.status))
    .filter((item) => !filtros.profissionalId || item.profissionalId === String(filtros.profissionalId))
    .filter((item) => !filtros.lojaId || !item.lojaId || item.lojaId === String(filtros.lojaId))
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
    lojaId: texto(dados.lojaId ?? dados.loja_id ?? anterior.lojaId, 120),
  };
}

export function listarBloqueios(empresaId, filtros = {}) {
  return Object.values(estadoEmpresa(empresaId, false).bloqueios)
    .filter((item) => filtros.incluirInativos || item.ativo !== false)
    .filter((item) => !filtros.data || chaveDia(item.inicio) <= String(filtros.data).slice(0, 10) && chaveDia(item.fim) >= String(filtros.data).slice(0, 10))
    .filter((item) => !filtros.profissionalId || !item.profissionalId || item.profissionalId === String(filtros.profissionalId))
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
    dataAgenda: texto(dados.dataAgenda ?? dados.data_agenda ?? anterior.dataAgenda, 10) || chaveDia(dataAtual()),
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

function itensVendaNormalizados(estado, empresaId, itens = []) {
  if (!Array.isArray(itens) || itens.length === 0) throw new Error('A venda deve conter pelo menos um produto.');
  const normalizados = itens.map((item) => {
    const produtoId = String(item?.produtoId || item?.produto_id || '');
    const produto = estado.produtosRevenda[produtoId];
    const quantidade = Math.round(numero(item?.quantidade ?? item?.qtd, NaN));
    if (!produto || produto.empresaId !== String(empresaId)) throw new Error('Produto de revenda inválido para a empresa ativa.');
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
    .filter((item) => !filtros.lojaId || !item.lojaId || item.lojaId === String(filtros.lojaId))
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .map((item) => ({ ...item, itens: item.itens.map((linha) => ({ ...linha })) }));
}

export function obterVendaRevenda(empresaId, vendaId) {
  const venda = estadoEmpresa(empresaId, false).vendasRevenda[String(vendaId)];
  return venda && venda.empresaId === String(empresaId) ? { ...venda, itens: venda.itens.map((item) => ({ ...item })) } : null;
}

export function criarVendaRevenda(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const chaveIdempotencia = texto(dados.chaveIdempotencia ?? dados.chave_idempotencia, 220);
  if (chaveIdempotencia) {
    const existente = Object.values(estado.vendasRevenda).find((item) => item.chaveIdempotencia === chaveIdempotencia);
    if (existente) return { ...existente, itens: existente.itens.map((item) => ({ ...item })) };
  }
  const itens = itensVendaNormalizados(estado, empresaId, dados.itens);
  const profissionalId = texto(dados.profissionalId ?? dados.profissional_id, 120);
  if (profissionalId && (!estado.profissionais[profissionalId] || estado.profissionais[profissionalId].ativo === false)) throw new Error('Profissional responsável não encontrado ou inativo.');
  const agora = dataAtual();
  const id = novoId('vrev', estado.vendasRevenda);
  const venda = {
    id,
    empresaId: String(empresaId),
    lojaId: texto(dados.lojaId ?? dados.loja_id, 120),
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
    criadoEm: agora,
    atualizadoEm: agora,
  };
  estado.vendasRevenda[id] = venda;
  save();
  return { ...venda, itens: venda.itens.map((item) => ({ ...item })) };
}

export function finalizarVendaRevenda(empresaId, vendaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const venda = estado.vendasRevenda[String(vendaId)];
  if (!venda || venda.empresaId !== String(empresaId)) return null;
  if (venda.status === 'pago') return { ...venda, itens: venda.itens.map((item) => ({ ...item })) };
  if (dados.confirmadoPagamento !== true) throw new Error('A confirmação explícita do pagamento é obrigatória.');
  const meioPagamento = texto(dados.meioPagamento ?? dados.meio_pagamento, 40).toLowerCase();
  if (!meioPagamento) throw new Error('Meio de pagamento é obrigatório.');
  const valorRecebido = dinheiro(dados.valorRecebido ?? dados.valor_recebido, venda.total);
  if (valorRecebido !== venda.total) throw new Error(`Valor recebido deve ser ${venda.total.toFixed(2)}.`);
  estoqueVendaDisponivel(estado, venda.itens);
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
    usuario: dados.usuario,
    referencia: { pedidoId: venda.id },
    chaveIdempotencia: `barbearia_revenda:${empresaId}:${venda.id}`,
  });
  for (const item of venda.itens) {
    const produto = estado.produtosRevenda[item.produtoId];
    const anterior = Number(produto.estoqueAtual || 0);
    produto.estoqueAtual = anterior - item.quantidade;
    produto.atualizadoEm = agora;
    produto.ultimoMovimentoEm = agora;
    const movimentoId = novoId('mov', estado.movimentosEstoque);
    estado.movimentosEstoque[movimentoId] = { id: movimentoId, empresaId: String(empresaId), produtoId: produto.id, tipo: 'saida_venda', quantidade: item.quantidade, estoqueAnterior: anterior, estoquePosterior: produto.estoqueAtual, vendaId: venda.id, observacao: `Baixa da venda ${venda.id}.`, criadoEm: agora };
  }
  Object.assign(venda, { status: 'pago', estoqueBaixado: true, pagamento: { meioPagamento, valorRecebido, confirmadoEm: agora }, financeiroLancamentoId: financeiro.id, atualizadoEm: agora });
  save();
  return { ...venda, itens: venda.itens.map((item) => ({ ...item })) };
}

function copiarComandaBarbearia(comanda, idempotente = false) {
  if (!comanda) return null;
  const subtotal = Number((comanda.itens || []).reduce((soma, item) => soma + Number(item.subtotal || 0), 0).toFixed(2));
  const desconto = Number(Math.min(subtotal, Math.max(0, Number(comanda.desconto || 0))).toFixed(2));
  const gorjeta = Number(Math.max(0, Number(comanda.gorjeta || 0)).toFixed(2));
  const total = Number(Math.max(0, subtotal - desconto + gorjeta).toFixed(2));
  return {
    ...comanda,
    subtotal,
    desconto,
    gorjeta,
    total,
    totalFaturado: Number((comanda.totalFaturado ?? (comanda.pagamentos || []).reduce((soma, item) => soma + Number(item.valor || 0), 0)).toFixed(2)),
    totalPago: Number((comanda.totalPago ?? (comanda.pagamentos || []).filter((item) => item.meio !== 'conta').reduce((soma, item) => soma + Number(item.valor || 0), 0)).toFixed(2)),
    saldoPendente: Number(Math.max(0, total - Number(comanda.totalFaturado ?? 0)).toFixed(2)),
    itens: (comanda.itens || []).map((item) => ({ ...item })),
    pagamentos: (comanda.pagamentos || []).map((item) => ({ ...item })),
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
    if (Number(produto.estoqueAtual || 0) < quantidade) throw new Error(`Estoque insuficiente para ${produto.nome} (disponível: ${produto.estoqueAtual || 0}, necessário: ${quantidade}).`);
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
    .filter((item) => !filtros.status || item.status === String(filtros.status))
    .filter((item) => !filtros.lojaId || item.lojaId === String(filtros.lojaId))
    .filter((item) => !filtros.clienteId || item.clienteId === String(filtros.clienteId))
    .filter((item) => !filtros.data || String(item.dataAtendimento || item.criadoEm).slice(0, 10) === String(filtros.data).slice(0, 10))
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
    chaveIdempotencia: chaveIdempotencia || null,
    observacoes: texto(dados.observacoes ?? dados.observacao, 600),
    criadoPor: texto(dados.usuario, 120),
    criadoEm: agora,
    atualizadoEm: agora,
    fechadaEm: null,
  };
  estado.comandas[id] = comanda;
  const itensIniciais = Array.isArray(dados.itens) ? dados.itens : (agendamento?.servicoId ? [{ tipo: 'servico', servicoId: agendamento.servicoId, profissionalId }] : []);
  if (itensIniciais.length) {
    const itens = itensIniciais.map((item) => itemComandaBarbeariaNormalizado(estado, comanda, item));
    comanda.itens.push(...itens);
  }
  save();
  return copiarComandaBarbearia(comanda);
}

export function atualizarComandaBarbearia(empresaId, comandaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  if (!['aberta', 'aguardando_pagamento', 'parcialmente_paga'].includes(comanda.status)) throw new Error('A comanda não está aberta para edição.');
  if (dados.desconto !== undefined) comanda.desconto = dinheiro(dados.desconto);
  if (dados.descontoMotivo !== undefined || dados.desconto_motivo !== undefined) comanda.descontoMotivo = texto(dados.descontoMotivo ?? dados.desconto_motivo, 240);
  if (dados.gorjeta !== undefined) comanda.gorjeta = dinheiro(dados.gorjeta);
  if (dados.observacoes !== undefined || dados.observacao !== undefined) comanda.observacoes = texto(dados.observacoes ?? dados.observacao, 600);
  if (Array.isArray(dados.financeiroLancamentoIds)) comanda.financeiroLancamentoIds = [...new Set(dados.financeiroLancamentoIds.map((item) => texto(item, 120)).filter(Boolean))];
  if (Array.isArray(dados.contasReceberIds)) comanda.contasReceberIds = [...new Set(dados.contasReceberIds.map((item) => texto(item, 120)).filter(Boolean))];
  comanda.atualizadoEm = dataAtual();
  save();
  return copiarComandaBarbearia(comanda);
}

export function adicionarItensComandaBarbearia(empresaId, comandaId, itens = []) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  if (!['aberta', 'aguardando_pagamento'].includes(comanda.status)) throw new Error('A comanda não está disponível para novos itens.');
  const entradas = Array.isArray(itens) ? itens : [itens];
  if (!entradas.length) throw new Error('Inclua ao menos um item na comanda.');
  const novos = entradas.map((item) => itemComandaBarbeariaNormalizado(estado, comanda, item));
  comanda.itens.push(...novos);
  comanda.status = 'aberta';
  comanda.atualizadoEm = dataAtual();
  save();
  return copiarComandaBarbearia(comanda);
}

export function atualizarItemComandaBarbearia(empresaId, comandaId, itemId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  if (!['aberta', 'aguardando_pagamento'].includes(comanda.status)) throw new Error('A comanda não está disponível para edição.');
  const atual = comanda.itens.find((item) => item.id === String(itemId));
  if (!atual) return null;
  const quantidade = dados.quantidade !== undefined || dados.qtd !== undefined ? Math.max(1, Math.round(numero(dados.quantidade ?? dados.qtd, atual.quantidade))) : atual.quantidade;
  if (atual.tipo === 'produto') {
    const produto = estado.produtosRevenda[atual.produtoId];
    if (!produto || Number(produto.estoqueAtual || 0) < quantidade) throw new Error(`Estoque insuficiente para ${atual.nome}.`);
  }
  atual.quantidade = quantidade;
  atual.subtotal = dinheiro(atual.precoUnitario * quantidade);
  if (dados.observacao !== undefined || dados.obs !== undefined) atual.observacao = texto(dados.observacao ?? dados.obs, 400);
  atual.atualizadoEm = dataAtual();
  comanda.atualizadoEm = atual.atualizadoEm;
  save();
  return copiarComandaBarbearia(comanda);
}

export function removerItemComandaBarbearia(empresaId, comandaId, itemId) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  if (!['aberta', 'aguardando_pagamento'].includes(comanda.status)) throw new Error('A comanda não está disponível para edição.');
  const indice = comanda.itens.findIndex((item) => item.id === String(itemId));
  if (indice < 0) return null;
  comanda.itens.splice(indice, 1);
  comanda.atualizadoEm = dataAtual();
  save();
  return copiarComandaBarbearia(comanda);
}

export function alterarStatusComandaBarbearia(empresaId, comandaId, status, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const comanda = estado.comandas[String(comandaId)];
  if (!comanda || comanda.empresaId !== String(empresaId)) return null;
  const novoStatus = String(status || '').toLowerCase();
  if (!STATUS_COMANDA_BARBEARIA.has(novoStatus)) throw new Error('Status de comanda inválido.');
  if (novoStatus !== comanda.status && !TRANSICOES_COMANDA_BARBEARIA[comanda.status]?.has(novoStatus)) throw new Error(`Transição de comanda ${comanda.status} para ${novoStatus} não permitida.`);
  if (novoStatus === 'aguardando_pagamento' && !comanda.itens.length) throw new Error('Inclua ao menos um item antes de aguardar pagamento.');
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
  if (comanda.status === 'paga' || comanda.status === 'em_conta') return copiarComandaBarbearia(comanda, true);
  if (comanda.status === 'cancelada') throw new Error('Não é possível receber uma comanda cancelada.');
  if (dados.confirmado !== true) throw new Error('A confirmação explícita do pagamento é obrigatória.');
  const chaveIdempotencia = texto(dados.chaveIdempotencia ?? dados.chave_idempotencia, 220);
  if (chaveIdempotencia && (comanda.pagamentos || []).some((item) => item.chaveIdempotencia === chaveIdempotencia)) return copiarComandaBarbearia(comanda, true);
  if (!comanda.itens.length) throw new Error('Não é possível receber uma comanda sem itens.');
  const subtotal = Number((comanda.itens || []).reduce((soma, item) => soma + Number(item.subtotal || 0), 0).toFixed(2));
  const desconto = Number(Math.min(subtotal, Math.max(0, Number(comanda.desconto || 0))).toFixed(2));
  const total = Number(Math.max(0, subtotal - desconto + Math.max(0, Number(comanda.gorjeta || 0))).toFixed(2));
  const pagamentosEntrada = Array.isArray(dados.pagamentos) && dados.pagamentos.length ? dados.pagamentos : [{ meio: dados.meioPagamento ?? dados.meio_pagamento, valor: dados.valor }];
  const lojaIdOperacao = texto(dados.lojaId ?? comanda.lojaId, 120) || null;
  const saldoAnterior = Number(Math.max(0, total - Number(comanda.totalPago || 0)).toFixed(2));
  const pagamentos = pagamentosEntrada.map((item, indice) => {
    const meio = texto(item?.meio ?? item?.meioPagamento, 40).toLowerCase();
    const valor = dinheiro(item?.valor);
    if (!MEIOS_PAGAMENTO_COMANDA_BARBEARIA.has(meio) || valor <= 0) throw new Error('Informe meio e valor válidos para cada pagamento.');
    const caixaId = texto(item?.caixaId ?? item?.caixa_id ?? dados.caixaId ?? dados.caixa_id, 120) || null;
    if (meio === 'dinheiro' && caixaId) {
      const caixa = caixaKytto.obterCaixa(empresaId, caixaId);
      if (!caixa || caixa.status !== 'aberto' || (lojaIdOperacao && caixa.lojaId !== lojaIdOperacao)) throw new Error('O caixa informado não está aberto ou não pertence à unidade ativa.');
    }
    return { id: texto(item?.id, 120) || `pagbar-${Date.now().toString(36)}-${String(indice + 1).padStart(2, '0')}`, meio, valor, caixaId, chaveIdempotencia: texto(item?.chaveIdempotencia ?? item?.chave_idempotencia ?? chaveIdempotencia, 220) || null, registradoEm: dataAtual() };
  });
  const valorNovo = Number(pagamentos.reduce((soma, item) => soma + item.valor, 0).toFixed(2));
  if (valorNovo - saldoAnterior > 0.02) throw new Error(`O pagamento excede o saldo pendente de ${saldoAnterior.toFixed(2)}.`);
  const faturamentoCompleto = saldoAnterior - valorNovo <= 0.02;
  const consumoPlanejado = faturamentoCompleto ? planejarConsumoInternoComanda(estado, comanda) : [];
  validarEstoqueComandaBarbearia(estado, comanda, consumoPlanejado);
  const clienteId = texto(dados.clienteId ?? dados.cliente_id ?? comanda.clienteId, 120) || null;
  const valorEmConta = Number(pagamentos.filter((item) => item.meio === 'conta').reduce((soma, item) => soma + item.valor, 0).toFixed(2));
  if (valorEmConta > 0) {
    const credito = clienteId ? clientesKytto.obterSituacaoCredito(empresaId, clienteId, valorEmConta) : null;
    if (!credito) throw new Error('Para lançar em conta, selecione um cliente cadastrado da empresa ativa.');
    if (!credito.permitido) {
      if (!credito.limite) throw new Error('O cliente não possui limite de crédito configurado para pagar na conta.');
      throw new Error(`Limite de crédito insuficiente. Disponível: R$ ${credito.disponivel.toFixed(2)}.`);
    }
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
  comanda.pagamentos = [...(comanda.pagamentos || []), ...pagamentos];
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
  if (faturada && !comanda.estoqueBaixadoAntes) {
    for (const item of comanda.itens.filter((linha) => linha.tipo === 'produto')) {
      const produto = estado.produtosRevenda[item.produtoId];
      const anterior = Number(produto.estoqueAtual || 0);
      produto.estoqueAtual = anterior - item.quantidade;
      produto.atualizadoEm = dataAtual();
      produto.ultimoMovimentoEm = produto.atualizadoEm;
      const movimentoId = novoId('mov', estado.movimentosEstoque);
      estado.movimentosEstoque[movimentoId] = { id: movimentoId, empresaId: String(empresaId), produtoId: produto.id, tipo: 'saida_comanda', quantidade: item.quantidade, estoqueAnterior: anterior, estoquePosterior: produto.estoqueAtual, comandaId: comanda.id, criadoEm: produto.atualizadoEm };
    }
    comanda.estoqueBaixadoAntes = true;
  }
  if (faturada) aplicarConsumoInternoComanda(estado, comanda, consumoPlanejado);
  comanda.atualizadoEm = dataAtual();
  if (faturada) comanda.fechadaEm = comanda.atualizadoEm;
  if (faturada && !possuiConta && clienteId && comanda.totalPago > Number(comanda.fidelidadeValorPontuado || 0)) {
    const valorElegivel = Number((comanda.totalPago - Number(comanda.fidelidadeValorPontuado || 0)).toFixed(2));
    const credito = canaisFidelidadeKytto.creditarFidelidade(empresaId, clienteId, valorElegivel, 'barbearia_comanda', {
      chaveIdempotencia: `barbearia_comanda:${empresaId}:${comanda.id}:fidelidade:${comanda.totalPago.toFixed(2)}`,
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
  comanda.status = 'cancelada';
  comanda.observacoes = [comanda.observacoes, texto(dados.motivo, 300) ? `Cancelamento: ${texto(dados.motivo, 300)}` : 'Cancelamento manual.'].filter(Boolean).join(' · ');
  comanda.atualizadoEm = dataAtual();
  save();
  return copiarComandaBarbearia(comanda);
}

function validarCalendarioAgendamento(estado, agendamento, profissional) {
  const dataAgenda = String(agendamento.dataAgenda || chaveDia(agendamento.dataHora)).slice(0, 10);
  const calendario = obterCalendarioLoja(estado, agendamento.lojaId);
  if (calendario.feriados?.includes(dataAgenda)) throw new Error('A unidade não recebe reservas nesta data: feriado configurado.');
  const dataLocal = new Date(`${dataAgenda}T12:00:00Z`);
  if (Number.isNaN(dataLocal.valueOf())) throw new Error('Data operacional inválida.');
  if (Array.isArray(calendario.diasFuncionamento) && !calendario.diasFuncionamento.includes(dataLocal.getUTCDay())) throw new Error('A unidade não funciona neste dia da semana.');
  if (!agendamento.horaLocal) return;
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
  const profissionais = Object.values(estado.profissionais)
    .filter((item) => item.ativo !== false)
    .filter((item) => !profissionalId || profissionalId === 'qualquer' || item.id === profissionalId)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
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

export function criarAgendamento(empresaId, dados = {}) {
  const estado = estadoEmpresa(empresaId);
  const agendamento = agendamentoNormalizado(dados);
  if (!agendamento.clienteNome && !agendamento.clienteId) throw new Error('Informe o cliente do atendimento.');
  if (!agendamento.servicoId || !estado.servicos[agendamento.servicoId] || estado.servicos[agendamento.servicoId].ativo === false) throw new Error('Serviço ativo é obrigatório.');
  if (agendamento.profissionalId && (!estado.profissionais[agendamento.profissionalId] || estado.profissionais[agendamento.profissionalId].ativo === false)) throw new Error('Profissional não encontrado ou inativo.');
  const profissional = agendamento.profissionalId ? estado.profissionais[agendamento.profissionalId] : null;
  const servico = estado.servicos[agendamento.servicoId];
  agendamento.duracaoMinutos = servico.duracaoMinutos;
  agendamento.valor = agendamento.valor > 0 ? agendamento.valor : servico.preco;
  validarCalendarioAgendamento(estado, agendamento, profissional);
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
  const antes = { dataHora: atual.dataHora, dataAgenda: atual.dataAgenda, profissionalId: atual.profissionalId, servicoId: atual.servicoId };
  const agendamento = agendamentoNormalizado(dados, atual);
  agendamento.status = atual.status;
  if (!agendamento.servicoId || !estado.servicos[agendamento.servicoId] || estado.servicos[agendamento.servicoId].ativo === false) throw new Error('Serviço ativo é obrigatório.');
  agendamento.duracaoMinutos = estado.servicos[agendamento.servicoId].duracaoMinutos;
  agendamento.valor = agendamento.valor > 0 ? agendamento.valor : estado.servicos[agendamento.servicoId].preco;
  validarCalendarioAgendamento(estado, agendamento, agendamento.profissionalId ? estado.profissionais[agendamento.profissionalId] : null);
  if (verificarConflito(estado, agendamento, atual.id)) throw new Error('Horário indisponível para o profissional selecionado.');
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
  }
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

export function obterComissoes(empresaId, { data = '', lojaId = '' } = {}) {
  const estado = estadoEmpresa(empresaId, false);
  const filtrarLoja = (item) => !lojaId || !item.lojaId || item.lojaId === String(lojaId);
  const comandasPagas = Object.values(estado.comandas)
    .filter(filtrarLoja)
    .filter((item) => item.status === 'paga')
    .filter((item) => !data || String(item.fechadaEm || item.atualizadoEm).slice(0, 10) === String(data).slice(0, 10));
  const agendamentosEmComanda = new Set(comandasPagas.map((item) => item.agendamentoId).filter(Boolean));
  const atendimentos = Object.values(estado.agendamentos)
    .filter(filtrarLoja)
    .filter((item) => item.status === 'concluido')
    .filter((item) => !agendamentosEmComanda.has(item.id))
    .filter((item) => !data || String(item.dataAgenda || chaveDia(item.dataHora)).slice(0, 10) === String(data).slice(0, 10));
  const vendasLegadas = Object.values(estado.vendasRevenda)
    .filter(filtrarLoja)
    .filter((item) => item.status === 'pago')
    .filter((item) => !data || String(item.criadoEm).slice(0, 10) === String(data).slice(0, 10));
  const servicosComanda = comandasPagas.flatMap((comanda) => (comanda.itens || [])
    .filter((item) => item.tipo === 'servico')
    .map((item) => ({ ...item, profissionalId: item.profissionalId || comanda.profissionalId, valorRecebido: item.subtotal, valor: item.subtotal, meioPagamento: comanda.pagamentos?.find((pagamento) => pagamento.meio !== 'conta')?.meio || comanda.pagamento })));
  const produtosComanda = comandasPagas.map((comanda) => ({
    id: comanda.id,
    empresaId: comanda.empresaId,
    lojaId: comanda.lojaId,
    profissionalId: comanda.profissionalId || null,
    total: dinheiro((comanda.itens || []).filter((item) => item.tipo === 'produto').reduce((soma, item) => soma + Number(item.subtotal || 0), 0)),
    pagamento: { meioPagamento: comanda.pagamentos?.find((pagamento) => pagamento.meio !== 'conta')?.meio || comanda.pagamento },
    criadoEm: comanda.fechadaEm || comanda.atualizadoEm,
  }));
  const vendas = [...vendasLegadas, ...produtosComanda.filter((item) => item.total > 0)];
  const atendimentosConsolidados = [...atendimentos, ...servicosComanda];
  const taxas = estado.configuracao.taxasPagamento || {};
  const meiosSemTaxaConfigurada = new Set();
  const calcularTaxa = (valor, meio, profissional) => {
    const normalizado = String(meio || '').toLowerCase();
    if (!profissional.descontaTaxaMaquininha || normalizado === 'dinheiro' || normalizado === 'conta') return 0;
    const regra = taxas[normalizado];
    if (!regra) {
      if (normalizado) meiosSemTaxaConfigurada.add(normalizado);
      return 0;
    }
    return Number(valor || 0) * Number(regra.percentual || 0) / 100 + Number(regra.fixa || 0);
  };
  const porProfissional = Object.values(estado.profissionais).map((profissional) => {
    const servicos = atendimentosConsolidados.filter((item) => item.profissionalId === profissional.id);
    const produtos = vendas.filter((item) => item.profissionalId === profissional.id);
    const brutoServicos = servicos.reduce((soma, item) => soma + Number(item.valorRecebido || item.valor || 0), 0);
    const brutoProdutos = produtos.reduce((soma, item) => soma + Number(item.total || 0), 0);
    const taxaServicos = servicos.reduce((soma, item) => {
      const meio = String(item.meioPagamento || '').toLowerCase();
      return soma + calcularTaxa(Number(item.valorRecebido || item.valor || 0), meio, profissional);
    }, 0);
    const taxaProdutos = produtos.reduce((soma, item) => {
      const meio = String(item.pagamento?.meioPagamento || '').toLowerCase();
      return soma + calcularTaxa(Number(item.total || 0), meio, profissional);
    }, 0);
    const comissaoServicos = (brutoServicos - taxaServicos) * Number(profissional.percentualComissao || 0) / 100;
    const comissaoProdutos = (brutoProdutos - taxaProdutos) * Number(profissional.percentualComissaoProduto || 0) / 100;
    const bruto = brutoServicos + brutoProdutos;
    const taxasTotal = taxaServicos + taxaProdutos;
    const repasse = Math.max(0, comissaoServicos + comissaoProdutos);
    return { profissionalId: profissional.id, profissionalNome: profissional.nome, percentualComissao: Number(profissional.percentualComissao || 0), percentualComissaoProduto: Number(profissional.percentualComissaoProduto || 0), atendimentos: servicos.length, vendasProdutos: produtos.length, brutoServicos: dinheiro(brutoServicos), brutoProdutos: dinheiro(brutoProdutos), bruto: dinheiro(bruto), taxas: dinheiro(taxasTotal), comissaoServicos: dinheiro(comissaoServicos), comissaoProdutos: dinheiro(comissaoProdutos), repasse: dinheiro(repasse), parcelaSalao: dinheiro(Math.max(0, bruto - taxasTotal - repasse)) };
  }).filter((item) => item.atendimentos > 0 || item.vendasProdutos > 0 || estado.profissionais[item.profissionalId].ativo !== false);
  const vendasSemProfissional = vendas.filter((item) => !item.profissionalId);
  return { data: String(data || '').slice(0, 10), porProfissional, vendasSemProfissional: vendasSemProfissional.length, brutoSemProfissional: dinheiro(vendasSemProfissional.reduce((soma, item) => soma + Number(item.total || 0), 0)), taxasConfiguradas: Object.keys(taxas).length > 0, taxasPagamento: { ...taxas }, meiosSemTaxaConfigurada: [...meiosSemTaxaConfigurada].sort() };
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

export function obterDashboard(empresaId, { data = chaveDia(dataAtual()), lojaId = '', clientesAtivos = 0, financeiro = null, caixa = null } = {}) {
  const estado = estadoEmpresa(empresaId, false);
  const filtrarLoja = (item) => !lojaId || !item.lojaId || item.lojaId === String(lojaId);
  const agendamentos = Object.values(estado.agendamentos).filter(filtrarLoja);
  const fila = Object.values(estado.filaEspera).filter(filtrarLoja).filter((item) => item.status === 'aguardando' || item.status === 'chamado');
  const bloqueiosHoje = Object.values(estado.bloqueios).filter(filtrarLoja).filter((item) => item.ativo !== false && chaveDia(item.inicio) <= String(data).slice(0, 10) && chaveDia(item.fim) >= String(data).slice(0, 10));
  const assinaturasAtivas = Object.values(estado.assinaturas).filter((item) => item.status === 'ativa');
  const hoje = agendamentos.filter((item) => String(item.dataAgenda || chaveDia(item.dataHora)).slice(0, 10) === String(data).slice(0, 10));
  const concluidosHoje = hoje.filter((item) => item.status === 'concluido');
  const vendasRevendaHoje = Object.values(estado.vendasRevenda).filter(filtrarLoja).filter((item) => item.status === 'pago' && String(item.criadoEm).slice(0, 10) === String(data).slice(0, 10));
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
  };
}

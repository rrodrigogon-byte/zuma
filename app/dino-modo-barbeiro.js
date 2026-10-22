import { buildDinoCustomerAssistant } from './core/dino-customer-assistant.js';

// Modo barbeiro: a tela do celular de cada profissional.
//
// O barbeiro entra com o próprio login (perfil de equipe) e vê só a SUA agenda:
// o vínculo é o e-mail do login igual ao e-mail do cadastro de profissional.
// A gestão (admin, organizador, gerente) pode escolher qualquer profissional.
//
// Retorna só o necessário para o dia: horários, cliente (nome e telefone para
// ligar ou chamar no WhatsApp), serviço, status, bloqueios, totais e comissão.
// Nada de dados financeiros de outros profissionais.

const PAPEIS_GESTAO = new Set(['admin', 'organizador', 'gerente', 'gerente_operacional']);

export class ModoBarbeiroError extends Error {
  constructor(message, code, status = 400) { super(message); this.code = code; this.status = status; }
}

function dinheiro(valor) { return Math.round(Number(valor || 0) * 100) / 100; }
function dataValida(data) { return /^\d{4}-\d{2}-\d{2}$/.test(String(data || '')); }

export function ehGestao(usuario = {}) {
  return usuario.platformAdmin === true || PAPEIS_GESTAO.has(String(usuario.role || '').toLowerCase());
}

export function profissionalDoUsuario(profissionais = [], usuario = {}) {
  const email = String(usuario.email || '').trim().toLowerCase();
  if (!email) return null;
  return profissionais.find((p) => p.ativo !== false && String(p.email || '').trim().toLowerCase() === email) || null;
}

function resumoComissao(comissoes, profissionalId) {
  const item = (comissoes?.porProfissional || []).find((linha) => linha.profissionalId === profissionalId);
  return item
    ? { atendimentos: item.atendimentos, bruto: item.bruto, repasse: item.repasse, comissaoServicos: item.comissaoServicos, comissaoProdutos: item.comissaoProdutos }
    : { atendimentos: 0, bruto: 0, repasse: 0, comissaoServicos: 0, comissaoProdutos: 0 };
}

export function painelBarbeiro(erp, { empresaId, lojaId = '', usuario = {}, profissionalId = '', data, agora = new Date() } = {}) {
  if (!dataValida(data)) throw new ModoBarbeiroError('Data inválida.', 'DATA_INVALIDA');
  const gestao = ehGestao(usuario);
  const profissionais = erp.listarProfissionais(empresaId);
  const eu = profissionalDoUsuario(profissionais, usuario);
  let escolhido = null;
  if (gestao) {
    escolhido = profissionalId ? profissionais.find((p) => p.id === String(profissionalId)) : eu;
    if (profissionalId && !escolhido) throw new ModoBarbeiroError('Profissional não encontrado.', 'PROFISSIONAL_NAO_ENCONTRADO', 404);
  } else {
    // Equipe vê só a própria agenda, mesmo que peça outro profissional.
    escolhido = eu;
  }
  const base = {
    data,
    gestao,
    vinculado: Boolean(eu),
    profissionais: gestao ? profissionais.map((p) => ({ id: p.id, nome: p.nome })) : [],
  };
  if (!escolhido) {
    return {
      ...base,
      profissional: null,
      mensagem: gestao
        ? 'Escolha um profissional para ver a agenda.'
        : 'Seu login ainda não está ligado a um profissional. Peça à gestão para colocar o seu e-mail no seu cadastro de profissional.',
      agendamentos: [], bloqueios: [], servicos: [], resumo: null, comissao: null,
    };
  }

  const automaticoAtivo = erp.obterConfiguracao?.(empresaId)?.confirmacaoAutomaticaAtiva === true;
  const servicos = erp.listarServicos(empresaId);
  const servicoPorId = new Map(servicos.map((s) => [s.id, s]));
  const agendamentos = erp.listarAgendamentos(empresaId, { data, profissionalId: escolhido.id, lojaId })
    .map((a) => {
      const servico = servicoPorId.get(a.servicoId);
      return {
        id: a.id,
        dataHora: a.dataHora,
        horaLocal: a.horaLocal || '',
        status: a.status,
        motivoCancelamento: a.motivoCancelamento || '',
        confirmacaoAutomatica: automaticoAtivo && a.confirmacaoAutomatica?.ativa === true ? { ativa: true, status: a.confirmacaoAutomatica.status } : null,
        clienteNome: a.clienteNome || '',
        clienteTelefone: a.clienteTelefone || '',
        servicoId: a.servicoId,
        servicoNome: servico?.nome || 'Serviço',
        valor: dinheiro(a.valor ?? servico?.preco),
        duracaoMinutos: Number(a.duracaoMinutos || servico?.duracaoMinutos || 30),
        observacoes: a.observacoes || '',
        origem: a.origem || '',
      };
    });
  const ativos = agendamentos.filter((a) => a.status !== 'cancelado');
  const agoraMs = agora.valueOf();
  const proximo = ativos
    .filter((a) => ['agendado', 'confirmado'].includes(a.status) && new Date(a.dataHora).valueOf() >= agoraMs - 15 * 60 * 1000)
    .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora))[0] || null;
  const resumo = {
    total: ativos.length,
    pendentes: ativos.filter((a) => ['agendado', 'confirmado'].includes(a.status)).length,
    emAtendimento: ativos.filter((a) => a.status === 'em_atendimento').length,
    concluidos: ativos.filter((a) => a.status === 'concluido').length,
    faltas: ativos.filter((a) => a.status === 'nao_compareceu').length,
    previsto: dinheiro(ativos.filter((a) => a.status !== 'nao_compareceu').reduce((soma, a) => soma + a.valor, 0)),
    proximoId: proximo?.id || null,
  };
  const inicioMes = `${data.slice(0, 7)}-01`;
  const comissao = {
    percentualServicos: Number(escolhido.percentualComissao || 0),
    percentualProdutos: Number(escolhido.percentualComissaoProduto || 0),
    dia: resumoComissao(erp.obterComissoes(empresaId, { data, lojaId }), escolhido.id),
    mes: { ...resumoComissao(erp.obterComissoes(empresaId, { inicio: inicioMes, fim: data, lojaId }), escolhido.id), inicio: inicioMes, fim: data },
  };
  const bloqueios = erp.listarBloqueios(empresaId, { data, profissionalId: escolhido.id, lojaId })
    .map((b) => ({ id: b.id, titulo: b.titulo, inicio: b.inicio, fim: b.fim, geral: !b.profissionalId }));
  return {
    ...base,
    profissional: {
      id: escolhido.id, nome: escolhido.nome, especialidade: escolhido.especialidade, fotoUrl: escolhido.fotoUrl || '',
      horarioInicio: escolhido.horarioInicio, horarioFim: escolhido.horarioFim, diasTrabalho: escolhido.diasTrabalho,
      souEu: Boolean(eu && eu.id === escolhido.id),
    },
    agendamentos, bloqueios, resumo, comissao,
    servicos: servicos.filter(s => s.ativo !== false && (!s.profissionaisIds?.length || s.profissionaisIds.includes(escolhido.id))).map((s) => ({ id: s.id, nome: s.nome, preco: dinheiro(s.preco), duracaoMinutos: s.duracaoMinutos })),
  };
}


/** Contexto interno de atendimento. Staff só consulta cliente de um agendamento seu;
 * a resposta contém histórico operacional e sugestões, nunca contato ou observações pessoais. */
export function assistenteAtendimento(erp, {
  empresaId, lojaId = '', usuario = {}, profissionalId = '', agendamentoId = '', clientes = null, agora = new Date(),
} = {}) {
  if (!String(agendamentoId || '').trim()) throw new ModoBarbeiroError('Informe o atendimento.', 'AGENDAMENTO_NAO_INFORMADO');
  const agenda = erp.listarAgendamentos(empresaId, { lojaId });
  const agendamento = agenda.find((item) => String(item.id) === String(agendamentoId));
  if (!agendamento || (lojaId && agendamento.lojaId && String(agendamento.lojaId) !== String(lojaId))) {
    throw new ModoBarbeiroError('Atendimento não encontrado nesta unidade.', 'AGENDAMENTO_NAO_ENCONTRADO', 404);
  }
  const gestao = ehGestao(usuario);
  const profissionais = erp.listarProfissionais(empresaId);
  const eu = profissionalDoUsuario(profissionais, usuario);
  if (!gestao && (!eu || String(agendamento.profissionalId || '') !== String(eu.id))) {
    throw new ModoBarbeiroError('Você só pode consultar clientes dos seus próprios atendimentos.', 'ASSISTENTE_FORBIDDEN', 403);
  }
  if (gestao && profissionalId && String(agendamento.profissionalId || '') !== String(profissionalId)) {
    throw new ModoBarbeiroError('O atendimento não pertence ao profissional selecionado.', 'ASSISTENTE_FORBIDDEN', 403);
  }
  const customerId = String(agendamento.clienteId || '');
  const cliente = customerId && clientes?.obterCliente ? clientes.obterCliente(empresaId, customerId) : null;
  const identityVerified = Boolean(customerId && cliente && cliente.padrao !== true && !cliente.anonimizadoEm);
  const scoped = (item) => String(item?.clienteId ?? item?.cliente_id ?? '') === customerId;
  const comandas = erp.listarComandasBarbearia(empresaId, { lojaId }).filter(scoped);
  const retailSales = erp.listarVendasRevenda(empresaId, { lojaId }).filter(scoped);
  const historicalAppointments = erp.listarHistoricoAtendimentos(empresaId, { clienteId: customerId, lojaId, limite: 50000 });
  const products = erp.listarProdutosRevenda(empresaId, { incluirInativos: true })
    .filter((item) => !lojaId || !item.lojaId || String(item.lojaId) === String(lojaId));
  return buildDinoCustomerAssistant({
    customerId,
    identityVerified,
    appointments: agenda.filter(scoped),
    comandas,
    retailSales,
    historicalAppointments,
    services: erp.listarServicos(empresaId, { incluirInativos: true }),
    products,
    currentServiceId: agendamento.servicoId || '',
    now: agora,
    storeId: lojaId,
  });
}

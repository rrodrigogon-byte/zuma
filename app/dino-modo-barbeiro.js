import { buildDinoCustomerAssistant } from './core/dino-customer-assistant.js';
import * as dinoGamificacao from './dino-metas-gamificacao.js';

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

export function clientesRecentesDoBarbeiro(erp, { empresaId, lojaId = '', profissionalId = '', agora = new Date() } = {}) {
  if (!empresaId || !profissionalId) return [];
  try {
    const todosAgendamentos = erp.listarAgendamentos(empresaId, { profissionalId, lojaId });
    const mapa = new Map();
    for (const a of todosAgendamentos) {
      if (a.status !== 'concluido' && a.status !== 'agendado') continue;
      const chave = String(a.clienteTelefone || a.clienteNome || '').trim();
      if (!chave) continue;
      const dataIso = String(a.dataAgenda || a.dataHora || '').slice(0, 10);
      const item = mapa.get(chave) || {
        nome: a.clienteNome || 'Cliente',
        telefone: a.clienteTelefone || '',
        ultimoServico: a.servicoNome || 'Serviço',
        ultimaData: dataIso,
        totalAtendimentos: 0,
        status: a.status,
      };
      item.totalAtendimentos += 1;
      if (dataIso >= item.ultimaData) {
        item.ultimaData = dataIso;
        item.ultimoServico = a.servicoNome || item.ultimoServico;
      }
      mapa.set(chave, item);
    }
    const agoraMs = agora.valueOf();
    const lista = Array.from(mapa.values()).map((c) => {
      const diffDias = c.ultimaData ? Math.floor((agoraMs - new Date(`${c.ultimaData}T12:00:00`).valueOf()) / 86400000) : 0;
      return {
        ...c,
        diasDesdeUltimo: Math.max(0, diffDias),
        statusRetorno: diffDias <= 15 ? 'em_dia' : diffDias <= 30 ? 'ideal_retorno' : 'atrasado',
      };
    });
    return lista.sort((a, b) => b.ultimaData.localeCompare(a.ultimaData)).slice(0, 30);
  } catch {
    return [];
  }
}

export function ehGestao(usuario = {}) {
  return usuario.platformAdmin === true || PAPEIS_GESTAO.has(String(usuario.role || '').toLowerCase());
}

export function profissionalDoUsuario(profissionais = [], usuario = {}) {
  if (!usuario) return null;
  const email = String(usuario.email || '').trim().toLowerCase();
  const username = String(usuario.username || (email ? email.split('@')[0] : '')).trim().toLowerCase();
  const userId = String(usuario.id || '').trim();
  const nome = String(usuario.nome || usuario.nome_completo || '').trim().toLowerCase();

  return profissionais.find((p) => {
    if (p.ativo === false) return false;
    const pEmail = String(p.email || '').trim().toLowerCase();
    if (email && pEmail && pEmail === email) return true;
    if (username && pEmail && pEmail.split('@')[0] === username) return true;
    if (userId && (p.usuarioId === userId || p.userId === userId)) return true;
    const pNome = String(p.nome || '').trim().toLowerCase();
    if (username && pNome && (pNome === username || pNome.split(' ')[0] === username)) return true;
    if (nome && pNome && pNome === nome) return true;
    return false;
  }) || null;
}

function resumoComissao(comissoes, profissionalId) {
  const item = (comissoes?.porProfissional || []).find((linha) => linha.profissionalId === profissionalId);
  return item
    ? {
        atendimentos: item.atendimentos || 0,
        vendasProdutos: item.vendasProdutos || 0,
        brutoServicos: item.brutoServicos || 0,
        brutoProdutos: item.brutoProdutos || 0,
        bruto: item.bruto || 0,
        repasse: item.repasse || 0,
        comissaoServicos: item.comissaoServicos || 0,
        comissaoProdutos: item.comissaoProdutos || 0,
        taxas: item.taxas || 0,
        materiais: item.materiais || 0,
        percentualEfetivoServico: item.percentualEfetivoServico || item.percentualComissao || 0,
        percentualEfetivoProduto: item.percentualEfetivoProduto || item.percentualComissaoProduto || 0,
        linhas: (item.linhas || []).slice(0, 50),
      }
    : {
        atendimentos: 0,
        vendasProdutos: 0,
        brutoServicos: 0,
        brutoProdutos: 0,
        bruto: 0,
        repasse: 0,
        comissaoServicos: 0,
        comissaoProdutos: 0,
        taxas: 0,
        materiais: 0,
        percentualEfetivoServico: 0,
        percentualEfetivoProduto: 0,
        linhas: [],
      };
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
  const dObj = new Date(`${data}T12:00:00Z`);
  const diaSemana = (dObj.getUTCDay() + 6) % 7;
  const dSemana = new Date(dObj);
  dSemana.setUTCDate(dSemana.getUTCDate() - diaSemana);
  const inicioSemana = dSemana.toISOString().slice(0, 10);

  const comissaoDia = resumoComissao(erp.obterComissoes(empresaId, { data, lojaId }), escolhido.id);
  const comissaoMes = resumoComissao(erp.obterComissoes(empresaId, { inicio: inicioMes, fim: data, lojaId }), escolhido.id);
  const comissaoSemana = resumoComissao(erp.obterComissoes(empresaId, { inicio: inicioSemana, fim: data, lojaId }), escolhido.id);

  const pendentesHoje = ativos.filter((a) => ['agendado', 'confirmado', 'em_atendimento'].includes(a.status));
  const valorPendenteHoje = pendentesHoje.reduce((soma, a) => soma + (a.valor || 0), 0);
  const percServ = Number(escolhido.percentualComissao || 50) / 100;
  const comissaoPendente = dinheiro(valorPendenteHoje * percServ);
  const totalPrevistoHoje = dinheiro(comissaoDia.repasse + comissaoPendente);
  const ticketMedioHoje = comissaoDia.atendimentos > 0 ? dinheiro(comissaoDia.bruto / comissaoDia.atendimentos) : 0;

  const comissao = {
    percentualServicos: Number(escolhido.percentualComissao || 0),
    percentualProdutos: Number(escolhido.percentualComissaoProduto || 0),
    dia: { ...comissaoDia, previsaoTotal: totalPrevistoHoje, pendenteEstimado: comissaoPendente, ticketMedio: ticketMedioHoje },
    semana: { ...comissaoSemana, inicio: inicioSemana, fim: data },
    mes: { ...comissaoMes, inicio: inicioMes, fim: data },
  };
  const bloqueios = erp.listarBloqueios(empresaId, { data, profissionalId: escolhido.id, lojaId })
    .map((b) => ({ id: b.id, titulo: b.titulo, inicio: b.inicio, fim: b.fim, geral: !b.profissionalId }));

  let gamificacao = null;
  try {
    const painelGamif = dinoGamificacao.avaliarMetasESincronizarGiros(empresaId, { dataIso: data, lojaId });
    const listaProfs = painelGamif.profissionais || painelGamif.apuracao?.profissionais || [];
    const meuDesempenho = listaProfs.find((p) => p.profissionalId === escolhido.id);
    if (meuDesempenho) {
      gamificacao = {
        dia: meuDesempenho.dia,
        semana: meuDesempenho.semana,
        girosPendentes: meuDesempenho.girosPendentes || [],
        config: painelGamif.config || null,
      };
    }
  } catch {
    // Não bloqueia a agenda se gamificação falhar
  }

  return {
    ...base,
    gamificacao,
    clientesRecentes: clientesRecentesDoBarbeiro(erp, { empresaId, lojaId, profissionalId: escolhido.id, agora }),
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

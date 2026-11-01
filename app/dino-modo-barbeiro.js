import { listarCarteiraClientes } from './dino-carteira-clientes.js';
import { buildDinoCustomerAssistant } from './core/dino-customer-assistant.js';
import * as dinoGamificacao from './dino-metas-gamificacao.js';
import * as dinoMetas from './dino-metas.js';

// Modo barbeiro: a tela do celular de cada profissional.
//
// O barbeiro entra com o próprio login (perfil de equipe) e vê só a SUA agenda:
// o vínculo é o e-mail do login igual ao e-mail do cadastro de profissional.
// A gestão (admin, organizador, gerente) pode escolher qualquer profissional e
// também visualiza o painel consolidado de toda a equipe.

const PAPEIS_GESTAO = new Set(['admin', 'organizador', 'gerente', 'gerente_operacional']);

export class ModoBarbeiroError extends Error {
  constructor(message, code, status = 400) { super(message); this.code = code; this.status = status; }
}

function dinheiro(valor) { return Math.round(Number(valor || 0) * 100) / 100; }
function dataValida(data) { return /^\d{4}-\d{2}-\d{2}$/.test(String(data || '')); }
function normStr(s) { return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

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
        id: a.clienteId || null,
        clienteId: a.clienteId || null,
        nome: a.clienteNome || 'Cliente',
        telefone: a.clienteTelefone || '',
        ultimoServico: a.servicoNome || 'Serviço',
        ultimaData: dataIso,
        totalAtendimentos: 0,
        status: a.status,
      };
      item.totalAtendimentos += 1;
      if (!item.clienteId && a.clienteId) {
        item.id = a.clienteId;
        item.clienteId = a.clienteId;
      }
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
    const pApelido = String(p.apelido || '').trim().toLowerCase();
    if (username && pApelido && (pApelido === username || username.startsWith(pApelido) || pApelido.startsWith(username))) return true;
    if (nome && pApelido && (pApelido === nome || nome.startsWith(pApelido) || pApelido.startsWith(nome))) return true;
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

function encontrarDesempenhoProfissional(listaProfs = [], prof = {}) {
  if (!prof || !listaProfs.length) return null;
  const nEsc = normStr(prof.nome);
  const apEsc = normStr(prof.apelido);
  return listaProfs.find((p) => {
    if (p.profissionalId === prof.id) return true;
    if (Array.isArray(p.aliasesIds) && p.aliasesIds.includes(prof.id)) return true;
    const nP = normStr(p.nome);
    const apP = normStr(p.apelido);
    if (nEsc && nP && (nEsc === nP || nEsc.includes(nP) || nP.includes(nEsc))) return true;
    if (apEsc && apP && apEsc === apP) return true;
    if ((nEsc.includes('guilherme') || nEsc.includes('dino')) && nP.includes('dino')) return true;
    if ((nEsc.includes('steffany') || nEsc.includes('ester')) && nP.includes('ester')) return true;
    if ((nEsc.includes('natani') || nEsc.includes('nati')) && nP.includes('nati')) return true;
    return false;
  }) || null;
}

export function painelBarbeiro(erp, { empresaId, lojaId = '', usuario = {}, profissionalId = '', data, agora = new Date() } = {}) {
  if (!dataValida(data)) throw new ModoBarbeiroError('Data inválida.', 'DATA_INVALIDA');
  const gestao = ehGestao(usuario);
  let profissionais = erp.listarProfissionais(empresaId);
  if ((!profissionais || profissionais.length === 0) && (empresaId === 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' || empresaId === 'emp-kytto-001' || empresaId === 'dino')) {
    for (const altId of ['d0d0ac01-8e50-4b61-8c79-de4aaa916da6', 'emp-kytto-001', 'dino']) {
      const altList = erp.listarProfissionais(altId);
      if (altList && altList.length > 0) {
        profissionais = altList;
        break;
      }
    }
  }
  const eu = profissionalDoUsuario(profissionais, usuario);
  let escolhido = null;
  if (gestao) {
    escolhido = profissionalId ? profissionais.find((p) => p.id === String(profissionalId)) : eu;
    if (profissionalId && !escolhido) throw new ModoBarbeiroError('Profissional não encontrado.', 'PROFISSIONAL_NAO_ENCONTRADO', 404);
    if (!escolhido && profissionais.length > 0) {
      escolhido = profissionais[0];
    }
  } else {
    // Equipe vê só a própria agenda, mesmo que peça outro profissional.
    escolhido = eu;
  }
  const base = {
    data,
    gestao,
    vinculado: Boolean(eu),
    profissionais: gestao ? profissionais.map((p) => ({
      id: p.id,
      nome: p.nome,
      apelido: p.apelido || p.nome.split(' ')[0],
      especialidade: p.especialidade || '',
      fotoUrl: p.fotoUrl || '',
    })) : [],
  };
  if (!escolhido) {
    return {
      ...base,
      profissional: null,
      mensagem: gestao
        ? 'Nenhum profissional ativo cadastrado nesta unidade.'
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
        clienteId: a.clienteId || null,
        servicoId: a.servicoId,
        servicoNome: servico?.nome || a.servicoNome || 'Serviço',
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

  const comissoesDiaRaw = erp.obterComissoes(empresaId, { data, lojaId });
  const comissoesMesRaw = erp.obterComissoes(empresaId, { inicio: inicioMes, fim: data, lojaId });
  const comissoesSemanaRaw = erp.obterComissoes(empresaId, { inicio: inicioSemana, fim: data, lojaId });

  const comissaoDia = resumoComissao(comissoesDiaRaw, escolhido.id);
  const comissaoMes = resumoComissao(comissoesMesRaw, escolhido.id);
  const comissaoSemana = resumoComissao(comissoesSemanaRaw, escolhido.id);

  const pendentesHoje = ativos.filter((a) => ['agendado', 'confirmado', 'em_atendimento'].includes(a.status));
  const valorPendenteHoje = pendentesHoje.reduce((soma, a) => soma + (a.valor || 0), 0);
  const percServ = Number(escolhido.percentualComissao || 50) / 100;
  const comissaoPendente = dinheiro(valorPendenteHoje * percServ);
  const totalPrevistoHoje = dinheiro(comissaoDia.repasse + comissaoPendente);
  const ticketMedioHoje = comissaoDia.atendimentos > 0 ? dinheiro(comissaoDia.bruto / comissaoDia.atendimentos) : (ativos.length > 0 ? dinheiro(resumo.previsto / ativos.length) : 0);

  const comissao = {
    percentualServicos: Number(escolhido.percentualComissao || 0),
    percentualProdutos: Number(escolhido.percentualComissaoProduto || 0),
    dia: { ...comissaoDia, previsaoTotal: totalPrevistoHoje, pendenteEstimado: comissaoPendente, ticketMedio: ticketMedioHoje },
    semana: { ...comissaoSemana, inicio: inicioSemana, fim: data },
    mes: { ...comissaoMes, inicio: inicioMes, fim: data },
  };
  const bloqueios = erp.listarBloqueios(empresaId, { data, profissionalId: escolhido.id, lojaId })
    .map((b) => ({ id: b.id, titulo: b.titulo, inicio: b.inicio, fim: b.fim, geral: !b.profissionalId }));

  // Gamificação, Metas Diárias, Semanais, Mensais e Ranking
  let gamificacao = null;
  let painelGamif = null;
  try {
    painelGamif = dinoGamificacao.avaliarMetasESincronizarGiros(empresaId, { dataIso: data, lojaId });
  } catch {
    painelGamif = null;
  }

  try {
    const configGamif = painelGamif?.config || dinoGamificacao.obterConfiguracao(empresaId);
    const listaProfs = painelGamif?.profissionais || painelGamif?.apuracao?.profissionais || [];
    const meuDesempenho = encontrarDesempenhoProfissional(listaProfs, escolhido);

    const metasEmpresa = dinoMetas.obterMetas(empresaId);
    const qtdProfsAtivos = Math.max(1, profissionais.length);
    const metaFaturamentoMensalProf = Math.round((Number(metasEmpresa?.faturamentoMensal || 35000) / qtdProfsAtivos) * 100) / 100;
    const metaAtendimentosMensalProf = Math.max(20, Math.round(Number(metasEmpresa?.atendimentosMensal || 320) / qtdProfsAtivos));
    const metaTicketMedio = Number(metasEmpresa?.ticketMedio || 110);

    const faturamentoMesAtual = Math.max(Number(comissaoMes.bruto || 0), Number(meuDesempenho?.semana?.faturamentoTotal || 0));
    const atendimentosMesAtual = Math.max(Number(comissaoMes.atendimentos || 0), Number(meuDesempenho?.semana?.servicosTotal || 0));
    const ticketMedioMesAtual = atendimentosMesAtual > 0 ? dinheiro(faturamentoMesAtual / atendimentosMesAtual) : ticketMedioHoje;

    const anoMes = data.slice(0, 7).split('-').map(Number);
    const ultimoDiaMes = new Date(anoMes[0], anoMes[1], 0).getDate();
    const diaAtualMes = Math.max(1, Number(data.slice(8, 10)) || 1);
    const diasRestantesMes = Math.max(1, ultimoDiaMes - diaAtualMes);
    const faltaFaturamentoMes = Math.max(0, dinheiro(metaFaturamentoMensalProf - faturamentoMesAtual));
    const metaDiariaNecessaria = dinheiro(faltaFaturamentoMes / diasRestantesMes);
    const projecaoFechamentoMes = dinheiro((faturamentoMesAtual / diaAtualMes) * ultimoDiaMes);

    const alvoExtrasDia = Number(configGamif?.metasDiarias?.servicosExtrasQtd || 6);
    const alvoProdutosDia = Number(configGamif?.metasDiarias?.produtosQtd || 2);
    const servicosExtrasHoje = meuDesempenho?.dia?.servicosExtras || 0;
    const produtosQtdHoje = Math.max(meuDesempenho?.dia?.produtosQtd || 0, comissaoDia.vendasProdutos || 0);
    const produtosValorHoje = Math.max(meuDesempenho?.dia?.produtosValor || 0, comissaoDia.brutoProdutos || 0);

    const diaObj = meuDesempenho?.dia || {
      dataIso: data,
      servicosTotal: Math.max(resumo.concluidos, comissaoDia.atendimentos || 0),
      servicosExtras: servicosExtrasHoje,
      servicosExtrasLista: [],
      faturamentoServicos: comissaoDia.brutoServicos || resumo.previsto || 0,
      produtosValor: produtosValorHoje,
      produtosQtd: produtosQtdHoje,
      produtosLista: [],
      faturamentoTotal: Math.max(comissaoDia.bruto || 0, resumo.previsto || 0),
      comandasAtendidas: comissaoDia.atendimentos || resumo.concluidos || 0,
      metaExtrasAtingida: servicosExtrasHoje >= alvoExtrasDia,
      metaExtrasAlvo: alvoExtrasDia,
      metaExtrasProgresso: Math.min(100, Math.round((servicosExtrasHoje / Math.max(1, alvoExtrasDia)) * 100)),
      metaProdutosAtingida: produtosQtdHoje >= alvoProdutosDia,
      metaProdutosAlvo: alvoProdutosDia,
      metaProdutosTipo: 'quantidade',
      metaProdutosProgresso: Math.min(100, Math.round((produtosQtdHoje / Math.max(1, alvoProdutosDia)) * 100)),
    };

    const alvoFatSemana = Number(configGamif?.metasSemanais?.faturamentoValor || 2500);
    const alvoProdQtdSemana = Number(configGamif?.metasSemanais?.produtosQtd || 10);
    const alvoProdValSemana = Number(configGamif?.metasSemanais?.produtosValor || 500);
    const fatSemana = Math.max(meuDesempenho?.semana?.faturamentoTotal || 0, comissaoSemana.bruto || 0);
    const prodValSemana = Math.max(meuDesempenho?.semana?.produtosValor || 0, comissaoSemana.brutoProdutos || 0);
    const prodQtdSemana = Math.max(meuDesempenho?.semana?.produtosQtd || 0, comissaoSemana.vendasProdutos || 0);

    const semanaObj = meuDesempenho?.semana || {
      inicioIso: inicioSemana,
      fimIso: data,
      servicosTotal: comissaoSemana.atendimentos || 0,
      servicosExtras: servicosExtrasHoje,
      faturamentoServicos: comissaoSemana.brutoServicos || 0,
      produtosValor: prodValSemana,
      produtosQtd: prodQtdSemana,
      faturamentoTotal: fatSemana,
      comandasAtendidas: comissaoSemana.atendimentos || 0,
      metaFaturamentoAlvo: alvoFatSemana,
      progressoFaturamento: Math.min(100, Math.round((fatSemana / Math.max(1, alvoFatSemana)) * 100)),
      metaProdutosAlvo: alvoProdQtdSemana || alvoProdValSemana,
      metaProdutosTipo: alvoProdQtdSemana > 0 ? 'quantidade' : 'valor',
      progressoProdutos: alvoProdQtdSemana > 0
        ? Math.min(100, Math.round((prodQtdSemana / alvoProdQtdSemana) * 100))
        : Math.min(100, Math.round((prodValSemana / Math.max(1, alvoProdValSemana)) * 100)),
      progressoDesafio: Math.max(
        Math.min(100, Math.round((fatSemana / Math.max(1, alvoFatSemana)) * 100)),
        alvoProdQtdSemana > 0
          ? Math.min(100, Math.round((prodQtdSemana / alvoProdQtdSemana) * 100))
          : Math.min(100, Math.round((prodValSemana / Math.max(1, alvoProdValSemana)) * 100))
      ),
      metaDesafioAtingida: fatSemana >= alvoFatSemana || (alvoProdQtdSemana > 0 && prodQtdSemana >= alvoProdQtdSemana) || (alvoProdValSemana > 0 && prodValSemana >= alvoProdValSemana),
    };

    const ranking = listaProfs
      .map((p) => ({
        profissionalId: p.profissionalId,
        nome: p.nome,
        apelido: p.apelido || p.nome.split(' ')[0],
        faturamentoSemana: p.semana?.faturamentoTotal || 0,
        faturamentoDia: p.dia?.faturamentoTotal || 0,
        servicosExtrasDia: p.dia?.servicosExtras || 0,
        servicosExtrasSemana: p.semana?.servicosExtras || 0,
        produtosQtdDia: p.dia?.produtosQtd || 0,
        produtosValorSemana: p.semana?.produtosValor || 0,
        progressoDesafio: p.semana?.progressoDesafio || 0,
      }))
      .sort((a, b) => (b.faturamentoSemana - a.faturamentoSemana) || (b.servicosExtrasSemana - a.servicosExtrasSemana));

    gamificacao = {
      dia: diaObj,
      semana: semanaObj,
      mes: {
        inicioIso: inicioMes,
        fimIso: data,
        faturamentoRealizado: dinheiro(faturamentoMesAtual),
        metaFaturamentoMensal: dinheiro(metaFaturamentoMensalProf),
        progressoFaturamentoMensal: Math.min(100, Math.round((faturamentoMesAtual / Math.max(1, metaFaturamentoMensalProf)) * 100)),
        faltaFaturamentoMensal: faltaFaturamentoMes,
        metaDiariaNecessaria,
        diasRestantesMes,
        projecaoFechamentoMes,
        atendimentosRealizados: atendimentosMesAtual,
        metaAtendimentosMensal: metaAtendimentosMensalProf,
        progressoAtendimentosMensal: Math.min(100, Math.round((atendimentosMesAtual / Math.max(1, metaAtendimentosMensalProf)) * 100)),
        ticketMedioRealizado: ticketMedioMesAtual,
        metaTicketMedio: dinheiro(metaTicketMedio),
        comissaoAcumulada: dinheiro(comissaoMes.repasse || 0),
      },
      girosPendentes: meuDesempenho?.girosPendentes || [],
      girosAguardandoEntrega: meuDesempenho?.girosAguardandoEntrega || [],
      girosEntregues: meuDesempenho?.girosEntregues || [],
      config: configGamif,
      ranking,
    };
  } catch {
    // Não bloqueia se falhar
  }

  // Visão consolidada de todos os profissionais para o Gestor / Admin
  let visaoGeralEquipe = null;
  if (gestao) {
    try {
      const listaGamif = painelGamif?.profissionais || [];
      const cardsEquipe = profissionais.map((p) => {
        const agProf = erp.listarAgendamentos(empresaId, { data, profissionalId: p.id, lojaId }).filter((a) => a.status !== 'cancelado');
        const cDia = resumoComissao(comissoesDiaRaw, p.id);
        const cMes = resumoComissao(comissoesMesRaw, p.id);
        const cSem = resumoComissao(comissoesSemanaRaw, p.id);
        const gProf = encontrarDesempenhoProfissional(listaGamif, p);
        const previstoDia = dinheiro(agProf.filter((a) => a.status !== 'nao_compareceu').reduce((s, a) => s + Number(a.valor ?? servicoPorId.get(a.servicoId)?.preco ?? 0), 0));
        return {
          id: p.id,
          nome: p.nome,
          apelido: p.apelido || p.nome.split(' ')[0],
          especialidade: p.especialidade || '',
          fotoUrl: p.fotoUrl || '',
          agendamentosHoje: agProf.length,
          concluidosHoje: agProf.filter((a) => a.status === 'concluido').length,
          emAtendimentoHoje: agProf.filter((a) => a.status === 'em_atendimento').length,
          pendentesHoje: agProf.filter((a) => ['agendado', 'confirmado'].includes(a.status)).length,
          previstoHoje: Math.max(previstoDia, cDia.bruto || 0, gProf?.dia?.faturamentoTotal || 0),
          comissaoHoje: cDia.repasse || 0,
          faturamentoSemana: Math.max(cSem.bruto || 0, gProf?.semana?.faturamentoTotal || 0),
          faturamentoMes: Math.max(cMes.bruto || 0, cSem.bruto || 0, gProf?.semana?.faturamentoTotal || 0),
          comissaoMes: cMes.repasse || 0,
          atendimentosMes: cMes.atendimentos || 0,
          servicosExtrasHoje: gProf?.dia?.servicosExtras || 0,
          metaExtrasAlvo: gProf?.dia?.metaExtrasAlvo || 6,
          metaExtrasProgresso: gProf?.dia?.metaExtrasProgresso || 0,
          produtosQtdHoje: Math.max(gProf?.dia?.produtosQtd || 0, cDia.vendasProdutos || 0),
          metaProdutosAlvo: gProf?.dia?.metaProdutosAlvo || 2,
          metaProdutosProgresso: gProf?.dia?.metaProdutosProgresso || 0,
          progressoSemana: gProf?.semana?.progressoDesafio || 0,
          girosPendentesCount: (gProf?.girosPendentes || []).length,
        };
      });

      visaoGeralEquipe = {
        totais: {
          totalProfissionais: cardsEquipe.length,
          agendamentosHoje: cardsEquipe.reduce((s, c) => s + c.agendamentosHoje, 0),
          concluidosHoje: cardsEquipe.reduce((s, c) => s + c.concluidosHoje, 0),
          emAtendimentoHoje: cardsEquipe.reduce((s, c) => s + c.emAtendimentoHoje, 0),
          previstoHoje: dinheiro(cardsEquipe.reduce((s, c) => s + c.previstoHoje, 0)),
          faturamentoMes: dinheiro(cardsEquipe.reduce((s, c) => s + c.faturamentoMes, 0)),
          comissaoMes: dinheiro(cardsEquipe.reduce((s, c) => s + c.comissaoMes, 0)),
          girosPendentes: cardsEquipe.reduce((s, c) => s + c.girosPendentesCount, 0),
        },
        profissionais: cardsEquipe,
      };
    } catch {
      visaoGeralEquipe = null;
    }
  }

  return {
    ...base,
    visaoGeralEquipe,
    gamificacao,
    clientesRecentes: (() => {
      try {
        const cart = listarCarteiraClientes(empresaId, { profissionalId: escolhido.id, lojaId });
        if (cart && cart.clientes && cart.clientes.length > 0) return cart.clientes;
      } catch {}
      return clientesRecentesDoBarbeiro(erp, { empresaId, lojaId, profissionalId: escolhido.id, agora });
    })(),
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

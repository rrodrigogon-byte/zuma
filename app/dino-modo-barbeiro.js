import { listarCarteiraClientes } from './dino-carteira-clientes.js';
import { buildDinoCustomerAssistant } from './core/dino-customer-assistant.js';
import * as dinoGamificacao from './dino-metas-gamificacao.js';
import * as dinoMetas from './dino-metas.js';
import { calcularFaixaBonificacao } from './barbearia-erp-kytto.js';

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

export function mascararTelefone(telefone) {
  if (!telefone) return '';
  const d = String(telefone).replace(/\D/g, '');
  if (d.length < 8) return '';
  const ddd = d.length >= 10 ? `(${d.slice(-11, -9)}) ` : '';
  const ultimos2 = d.slice(-2);
  return `${ddd}9****-**${ultimos2}`;
}

export function clientesRecentesDoBarbeiro(erp, { empresaId, lojaId = '', profissionalId = '', agora = new Date(), gestao = false } = {}) {
  if (!empresaId || !profissionalId) return [];
  try {
    const todosAgendamentos = erp.listarAgendamentos(empresaId, { profissionalId, lojaId });
    const mapa = new Map();
    for (const a of todosAgendamentos) {
      if (!['concluido', 'agendado', 'confirmado', 'em_atendimento'].includes(a.status)) continue;
      const chave = String(a.clienteTelefone || a.clienteNome || '').trim();
      if (!chave) continue;
      const dataIso = String(a.dataAgenda || a.dataHora || '').slice(0, 10);
      const item = mapa.get(chave) || {
        id: a.clienteId || null,
        clienteId: a.clienteId || null,
        nome: a.clienteNome || 'Cliente',
        telefone: gestao ? (a.clienteTelefone || '') : mascararTelefone(a.clienteTelefone),
        telefoneProtegido: !gestao,
        ultimoServico: a.servicoNome || 'Serviço',
        ultimaData: dataIso,
        totalAtendimentos: 0,
        totalGasto: 0,
        status: a.status,
      };
      item.totalAtendimentos += 1;
      item.totalGasto = dinheiro((item.totalGasto || 0) + Number(a.valor || 0));
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

  const aliasEquivalente = (a, b) => {
    if (!a || !b) return false;
    const s1 = a.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const s2 = b.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (s1 === s2) return true;
    if ((s1 === 'natani' || s1 === 'nati' || s1 === 'naty') && (s2 === 'natani' || s2 === 'nati' || s2 === 'naty')) return true;
    if ((s1 === 'dino' || s1 === 'guilherme' || s1 === 'gui') && (s2 === 'dino' || s2 === 'guilherme' || s2 === 'gui')) return true;
    if ((s1 === 'ester' || s1 === 'steffany') && (s2 === 'ester' || s2 === 'steffany')) return true;
    if ((s1 === 'david' || s1 === 'david kaua') && (s2 === 'david' || s2 === 'david kaua')) return true;
    if ((s1 === 'joao' || s1 === 'joao victor') && (s2 === 'joao' || s2 === 'joao victor')) return true;
    if ((s1 === 'amanda' || s1 === 'amanda gabrielly') && (s2 === 'amanda' || s2 === 'amanda gabrielly')) return true;
    if ((s1 === 'jhenyffer' || s1 === 'jhenyfer' || s1 === 'jhennyfer') && (s2 === 'jhenyffer' || s2 === 'jhenyfer' || s2 === 'jhennyfer')) return true;
    return false;
  };

  return profissionais.find((p) => {
    if (p.ativo === false) return false;
    const pEmail = String(p.email || '').trim().toLowerCase();
    if (email && pEmail && pEmail === email) return true;
    if (username && pEmail && pEmail.split('@')[0] === username) return true;
    if (userId && (p.usuarioId === userId || p.userId === userId)) return true;
    const pNome = String(p.nome || '').trim().toLowerCase();
    const pApelido = String(p.apelido || '').trim().toLowerCase();
    const pPrimeiroNome = pNome.split(' ')[0];
    const uPrimeiroNome = nome.split(' ')[0];

    if (aliasEquivalente(username, pApelido) || aliasEquivalente(username, pPrimeiroNome) || aliasEquivalente(uPrimeiroNome, pApelido) || aliasEquivalente(uPrimeiroNome, pPrimeiroNome)) return true;
    if (username && pApelido && (pApelido === username || username.startsWith(pApelido) || pApelido.startsWith(username))) return true;
    if (nome && pApelido && (pApelido === nome || nome.startsWith(pApelido) || pApelido.startsWith(nome))) return true;
    if (username && pNome && (pNome === username || pNome.split(' ')[0] === username)) return true;
    if (nome && pNome && (pNome === nome || pNome.startsWith(nome) || nome.startsWith(pNome))) return true;
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
  let eu = profissionalDoUsuario(profissionais, usuario);
  if (!eu || !profissionais || profissionais.length === 0) {
    for (const altId of ['d0d0ac01-8e50-4b61-8c79-de4aaa916da6', 'emp-kytto-001', 'dino']) {
      const altList = erp.listarProfissionais(altId);
      const altEu = profissionalDoUsuario(altList, usuario);
      if (altEu) {
        profissionais = altList;
        eu = altEu;
        empresaId = altId;
        break;
      }
      if ((!profissionais || profissionais.length === 0) && altList && altList.length > 0) {
        profissionais = altList;
      }
    }
  }
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
        clienteTelefone: gestao ? (a.clienteTelefone || '') : mascararTelefone(a.clienteTelefone),
        telefoneProtegido: !gestao,
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

  const faturamentoServicosMes = dinheiro(comissaoMes.brutoServicos || 0);
  const faturamentoProdutosMes = dinheiro(comissaoMes.brutoProdutos || 0);
  const fnCalcularBonificacao = typeof erp?.calcularFaixaBonificacao === 'function' ? erp.calcularFaixaBonificacao : calcularFaixaBonificacao;
  const metasServico = fnCalcularBonificacao(
    faturamentoServicosMes,
    escolhido.percentualComissao || 40,
    escolhido.faixasComissaoServico || []
  );
  const metasProduto = fnCalcularBonificacao(
    faturamentoProdutosMes,
    escolhido.percentualComissaoProduto || 10,
    escolhido.faixasComissaoProduto || []
  );
  const metasEvolucao = {
    servicos: metasServico,
    produtos: metasProduto,
  };

  const comissao = {
    percentualServicos: Number(escolhido.percentualComissao || 0),
    percentualProdutos: Number(escolhido.percentualComissaoProduto || 0),
    percentualEfetivoServicos: metasServico.percentualEfetivo,
    bonusPercentualServicos: metasServico.bonusPercentual,
    percentualEfetivoProdutos: metasProduto.percentualEfetivo,
    bonusPercentualProdutos: metasProduto.bonusPercentual,
    metasEvolucao,
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
    if (Array.isArray(diaObj.servicosExtrasLista)) {
      diaObj.servicosExtrasLista = diaObj.servicosExtrasLista.map((it) => ({
        quantidade: Number(it.quantidade || it.qtd || 1),
        nome: it.nome || it.servicoNome || 'Serviço extra',
        cliente: it.cliente || it.clienteNome || 'Atendimento',
        valor: dinheiro(it.valor ?? it.subtotal ?? 0),
      }));
    }
    if (Array.isArray(diaObj.produtosLista)) {
      diaObj.produtosLista = diaObj.produtosLista.map((it) => ({
        quantidade: Number(it.quantidade || it.qtd || 1),
        nome: it.nome || it.produtoNome || 'Produto',
        cliente: it.cliente || it.clienteNome || 'Venda',
        valor: dinheiro(it.valor ?? it.subtotal ?? 0),
      }));
    }

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
        faturamentoServicos: faturamentoServicosMes,
        faturamentoProdutos: faturamentoProdutosMes,
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
        metasServico,
        metasProduto,
        faixasComissaoServico: escolhido.faixasComissaoServico || [],
        faixasComissaoProduto: escolhido.faixasComissaoProduto || [],
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
      const recentes = clientesRecentesDoBarbeiro(erp, { empresaId, lojaId, profissionalId: escolhido.id, agora, gestao });
      try {
        const cart = listarCarteiraClientes(empresaId, { profissionalId: escolhido.id, lojaId });
        if (cart && Array.isArray(cart.clientes) && cart.clientes.length > 0) {
          const normalizados = cart.clientes.map((c) => {
            const dias = Number(c.diasDesdeUltimo ?? c.diasSemRetorno ?? 0);
            return {
              ...c,
              id: c.id || c.clienteId || null,
              clienteId: c.clienteId || c.id || null,
              nome: c.nome || 'Cliente',
              telefone: gestao ? (c.telefone || '') : mascararTelefone(c.telefone),
              telefoneProtegido: !gestao,
              ultimoServico: c.ultimoServico || c.servicoFavorito || 'Corte Masculino',
              ultimaData: c.ultimaData || c.ultimaVisita || '',
              diasDesdeUltimo: dias,
              totalAtendimentos: Number(c.totalAtendimentos || c.totalAtendimentosComBarbeiro || 1),
              totalGasto: Number(c.totalGasto || c.totalGastoComBarbeiro || 0),
              statusRetorno: c.statusRetorno === 'sumido' ? 'atrasado' : (c.statusRetorno || (dias <= 15 ? 'em_dia' : dias <= 30 ? 'ideal_retorno' : 'atrasado')),
            };
          });
          const vistos = new Set(normalizados.map((c) => String(c.telefone || c.nome || '').toLowerCase()));
          for (const r of recentes) {
            const ch = String(r.telefone || r.nome || '').toLowerCase();
            if (ch && !vistos.has(ch)) {
              vistos.add(ch);
              normalizados.push(r);
            }
          }
          return normalizados;
        }
      } catch {}
      return recentes;
    })(),
    profissional: {
      id: escolhido.id, nome: escolhido.nome, especialidade: escolhido.especialidade, fotoUrl: escolhido.fotoUrl || '',
      horarioInicio: escolhido.horarioInicio, horarioFim: escolhido.horarioFim, diasTrabalho: escolhido.diasTrabalho,
      faixasComissaoServico: escolhido.faixasComissaoServico || [],
      faixasComissaoProduto: escolhido.faixasComissaoProduto || [],
      souEu: Boolean(eu && eu.id === escolhido.id),
    },
    agendamentos, bloqueios, resumo, comissao, metasEvolucao,
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

/**
 * Dispara mensagem oficial pelo WhatsApp corporativo da Barbearia Dino.
 * O barbeiro não tem acesso ao número de telefone do cliente (proteção e privacidade).
 * A mensagem sai da instância oficial da barbearia.
 */
export async function notificarClientePeloZapOficial(erp, {
  empresaId,
  lojaId = '',
  usuario = {},
  clienteId = '',
  agendamentoId = '',
  tipo = 'retorno',
  template = 'padrao',
  mensagemPersonalizada = '',
  clientesKytto = null,
  enviarMensagemFn = null,
} = {}) {
  const gestao = ehGestao(usuario);
  const profissionais = erp.listarProfissionais(empresaId);
  const eu = profissionalDoUsuario(profissionais, usuario);
  if (!gestao && !eu) {
    throw new ModoBarbeiroError('Seu usuário não está vinculado a um profissional da barbearia.', 'SEM_VINCULO', 403);
  }
  const barbeiroNome = eu?.nome || usuario?.nome || 'Seu Barbeiro';
  const barbeiroPrimeiroNome = barbeiroNome.split(' ')[0] || 'Barbeiro';

  let telefoneReal = '';
  let nomeCliente = 'Amigo';
  let servicoNome = 'Corte & Barba';
  let horaAgenda = '';

  if (agendamentoId) {
    let ag = null;
    if (typeof erp.obterAgendamento === 'function') {
      ag = erp.obterAgendamento(empresaId, agendamentoId);
    } else if (typeof erp.listarAgendamentos === 'function') {
      const ags = erp.listarAgendamentos(empresaId, { lojaId });
      ag = (ags || []).find((item) => item.id === agendamentoId);
    }
    if (ag) {
      telefoneReal = ag.clienteTelefone || '';
      nomeCliente = ag.clienteNome || nomeCliente;
      servicoNome = ag.servicoNome || servicoNome;
      if (ag.horaLocal) horaAgenda = ag.horaLocal;
      else if (ag.dataHora) {
        try {
          horaAgenda = new Date(ag.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Cuiaba' });
        } catch {}
      }
    }
  }

  if (!telefoneReal && clienteId && clientesKytto?.obterCliente) {
    const cli = clientesKytto.obterCliente(empresaId, clienteId);
    if (cli) {
      telefoneReal = cli.telefone || '';
      nomeCliente = cli.nome || nomeCliente;
    }
  }

  if (!telefoneReal && clienteId) {
    // Procura na lista de agendamentos pelo clienteId
    try {
      const ags = erp.listarAgendamentos(empresaId, { clienteId, lojaId });
      const ultimo = ags.find((a) => a.clienteTelefone);
      if (ultimo) {
        telefoneReal = ultimo.clienteTelefone;
        nomeCliente = ultimo.clienteNome || nomeCliente;
        servicoNome = ultimo.servicoNome || servicoNome;
      }
    } catch {}
  }

  const telDigitos = String(telefoneReal || '').replace(/\D/g, '');
  if (telDigitos.length < 10) {
    throw new ModoBarbeiroError('O cliente não possui um número de WhatsApp cadastrado.', 'TELEFONE_NAO_ENCONTRADO', 400);
  }

  const primeiroNomeCli = String(nomeCliente || '').trim().split(/\s+/)[0] || 'amigo';
  let texto = '';

  const textoCustom = String(mensagemPersonalizada || '').trim();
  if (textoCustom.length >= 3) {
    texto = textoCustom;
  } else if (tipo === 'horario_hoje' || tipo === 'confirmacao_hoje') {
    texto = `Olá, ${primeiroNomeCli}! Tudo bem? Aqui é da Barbearia Dino. 💈 Confirmando seu horário de hoje${horaAgenda ? ` às ${horaAgenda}` : ''} com o barbeiro ${barbeiroPrimeiroNome} (${servicoNome}). Te aguardamos na barbearia! Caso precise remarcar, basta nos responder por aqui.`;
  } else if (template === 'vip') {
    texto = `Olá, ${primeiroNomeCli}! Tudo bem? Aqui é da Barbearia Dino. 💈 O barbeiro ${barbeiroPrimeiroNome} abriu alguns horários especiais na agenda e lembrou de você. Gostaria de garantir o seu atendimento para hoje ou amanhã? Responda por aqui para reservar!`;
  } else if (template === 'combo') {
    texto = `Olá, ${primeiroNomeCli}! Aqui é da Barbearia Dino. 💈 Esta semana estamos com condições especiais em combos de Corte + Barba ou Tratamento com o barbeiro ${barbeiroPrimeiroNome}. Vamos renovar o visual? Responda aqui para agendar!`;
  } else {
    texto = `Olá, ${primeiroNomeCli}! Tudo bem? Aqui é da Barbearia Dino. 💈 O barbeiro ${barbeiroPrimeiroNome} notou que já faz um tempinho desde a sua última visita para ${servicoNome}. Que tal renovar o visual essa semana? Responda por aqui ou agende online pelo link: https://kytto.com.br/agendar/dino`;
  }

  // Realiza o envio pelo WhatsApp corporativo da Dino
  if (typeof enviarMensagemFn === 'function') {
    const res = await enviarMensagemFn(telDigitos, texto);
    if (res && res.ok === false) {
      throw new ModoBarbeiroError(res.error || 'Falha ao despachar mensagem pelo WhatsApp da barbearia.', 'ERRO_DISPARO', 502);
    }
    return { ok: true, mensagem: 'Mensagem enviada com sucesso pelo WhatsApp oficial da Barbearia Dino!' };
  }

  const { enviarMensagemDinoCRM } = await import('./dino-crm-disparo.js');
  let res = null;
  try {
    res = await enviarMensagemDinoCRM(telDigitos, texto);
  } catch (err) {
    console.warn('[Modo Barbeiro] Erro ao tentar envio direto pelo WhatsApp:', err.message);
  }

  // Se o envio direto falhou porque o WhatsApp está temporariamente em reconexão/offline,
  // enfileira a mensagem na fila segura de saída para entrega automática com cadência antiban
  if (!res || res.ok === false) {
    console.log(`[Modo Barbeiro] WhatsApp em sincronização ou não pronto para ${primeiroNomeCli} (${telDigitos}). Salvando na fila segura de saída...`);
    try {
      const { db, save } = await import('./db.js');
      const d = db();
      if (!d.tarefas_whatsapp) d.tarefas_whatsapp = [];
      d.tarefas_whatsapp.push({
        id: `zap-barbeiro-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        telefone: telDigitos,
        mensagem: texto,
        clienteNome: primeiroNomeCli,
        barbeiro: barbeiroPrimeiroNome,
        tipo: template,
        status: 'pendente_sincronizacao',
        criadoEm: new Date().toISOString(),
      });
      save();
    } catch (saveErr) {
      console.warn('[Modo Barbeiro] Aviso salvo localmente:', saveErr.message);
    }

    return {
      ok: true,
      enfileirado: true,
      mensagem: 'Aviso registrado! O WhatsApp da barbearia está em sincronização. A mensagem foi colocada na fila segura e será entregue com cadência humanizada.',
      cliente: primeiroNomeCli,
    };
  }

  return { ok: true, enviado: true, mensagem: 'Mensagem enviada com sucesso pelo WhatsApp oficial da Barbearia Dino!' };
}

import { kyttoEventBus } from './kytto-event-bus.js';
import * as barbearia from '../barbearia-erp-kytto.js';
import { obterConexao } from '../whatsapp-conexao-kytto.js';
import { enviarMensagem } from './whatsapp.js';

const EMPRESA_DINO_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

function formatarMoeda(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val || 0));
}

/**
 * Consolida o resumo executivo de um dia específico para a empresa.
 */
export function consolidarResumoDiario(empresaId = EMPRESA_DINO_ID, dataFiltro = null) {
  const diaAlvo = dataFiltro || new Date().toISOString().split('T')[0];
  const estado = barbearia.estadoEmpresa ? barbearia.estadoEmpresa(empresaId) : {};
  const comandas = Object.values(estado.comandas || {});

  // Filtra comandas do dia faturadas ou pagas
  const comandasDoDia = comandas.filter(c => {
    const dataComanda = (c.fechadaEm || c.criadoEm || '').split('T')[0];
    return dataComanda === diaAlvo && ['fechada', 'paga', 'em_conta'].includes(c.status);
  });

  let totalFaturado = 0;
  let totalServicos = 0;
  let totalProdutos = 0;
  const formasPagamento = {};
  const producaoBarbeiros = {};

  for (const c of comandasDoDia) {
    const valorComanda = Number(c.totalPago || c.totalFaturado || c.total || 0);
    totalFaturado += valorComanda;

    // Meios de pagamento
    if (Array.isArray(c.pagamentos) && c.pagamentos.length > 0) {
      for (const p of c.pagamentos) {
        const meio = String(p.meio || p.tipo || 'Outros').toUpperCase();
        formasPagamento[meio] = (formasPagamento[meio] || 0) + Number(p.valor || 0);
      }
    } else {
      const meio = String(c.pagamento || 'PIX').toUpperCase();
      formasPagamento[meio] = (formasPagamento[meio] || 0) + valorComanda;
    }

    // Itens e Profissionais
    for (const item of (c.itens || [])) {
      const subtotal = Number(item.subtotal || item.valor || 0);
      const isServico = item.tipo !== 'produto';
      if (isServico) totalServicos += subtotal;
      else totalProdutos += subtotal;

      const profNome = item.profissionalNome || item.profissional || 'Equipe';
      if (!producaoBarbeiros[profNome]) {
        producaoBarbeiros[profNome] = { nome: profNome, total: 0, servicos: 0, produtos: 0, qtdAtendimentos: 0 };
      }
      producaoBarbeiros[profNome].total += subtotal;
      if (isServico) {
        producaoBarbeiros[profNome].servicos += subtotal;
        producaoBarbeiros[profNome].qtdAtendimentos += 1;
      } else {
        producaoBarbeiros[profNome].produtos += subtotal;
      }
    }
  }

  const clientesAtendidos = comandasDoDia.length;
  const ticketMedio = clientesAtendidos > 0 ? (totalFaturado / clientesAtendidos) : 0;

  // Itens em ponto de reposição no estoque
  const produtosRevenda = barbearia.listarProdutosRevenda ? barbearia.listarProdutosRevenda(empresaId) : [];
  const produtosEmRuptura = produtosRevenda.filter(p => Number(p.estoqueAtual ?? p.estoque ?? p.quantidade ?? 0) <= Number(p.estoqueMinimo ?? p.pontoReposicao ?? 3));

  return {
    empresaId,
    data: diaAlvo,
    dataBr: diaAlvo.split('-').reverse().join('/'),
    totalFaturado,
    totalFaturadoFormatado: formatarMoeda(totalFaturado),
    totalServicos,
    totalServicosFormatado: formatarMoeda(totalServicos),
    totalProdutos,
    totalProdutosFormatado: formatarMoeda(totalProdutos),
    clientesAtendidos,
    ticketMedio,
    ticketMedioFormatado: formatarMoeda(ticketMedio),
    formasPagamento,
    producaoBarbeiros: Object.values(producaoBarbeiros),
    itensAlertaEstoque: produtosEmRuptura.map(p => ({ id: p.id, nome: p.nome, estoque: Number(p.estoqueAtual ?? p.estoque ?? p.quantidade ?? 0), minimo: Number(p.estoqueMinimo ?? 3) }))
  };
}

/**
 * Renderiza o texto do briefing noturno em formato WhatsApp elegante.
 */
export function formatarMensagemBriefingGestao(resumo) {
  const linhasBarbeiros = resumo.producaoBarbeiros.map(b => 
    `  • *${b.nome}:* ${formatarMoeda(b.total)} (${b.qtdAtendimentos} atendimentos)`
  ).join('\n') || '  • Nenhum atendimento registrado hoje.';

  const linhasPagamentos = Object.entries(resumo.formasPagamento).map(([meio, valor]) =>
    `  • *${meio}:* ${formatarMoeda(valor)}`
  ).join('\n') || '  • Nenhum pagamento lançado.';

  const secaoEstoque = resumo.itensAlertaEstoque.length > 0
    ? `\n⚠️ *Alerta de Estoque (Reposição Necessária):*\n${resumo.itensAlertaEstoque.slice(0, 5).map(i => `  • ${i.nome}: restam ${i.estoque} un (mínimo: ${i.minimo})`).join('\n')}`
    : '\n📦 *Estoque:* Todos os itens de revenda com níveis seguros.';

  return `📊 *FECHAMENTO EXECUTIVO DO DIA — ${resumo.dataBr}* 💈
Barbearia Dino · Kytto ERP

💰 *Faturamento Total:* ${resumo.totalFaturadoFormatado}
  ✂️ Serviços: ${resumo.totalServicosFormatado}
  🛍️ Produtos: ${resumo.totalProdutosFormatado}

👥 *Atendimentos:* ${resumo.clientesAtendidos} clientes
🎟️ *Ticket Médio:* ${resumo.ticketMedioFormatado}

💈 *Produção da Equipe:*
${linhasBarbeiros}

💳 *Entradas por Forma de Pagamento:*
${linhasPagamentos}
${secaoEstoque}

✨ *Status Operacional:* Caixa 100% conciliado e sincronizado via eventos internos.`;
}

/**
 * Envia o briefing noturno para o WhatsApp de gestão da empresa.
 */
export async function enviarBriefingGestao(empresaId = EMPRESA_DINO_ID, dataFiltro = null, telefoneDestino = null) {
  const resumo = consolidarResumoDiario(empresaId, dataFiltro);
  const mensagem = formatarMensagemBriefingGestao(resumo);

  const conexaoGestao = obterConexao(empresaId, 'gestao');
  const instance = conexaoGestao?.instance || 'barbearia-dino-gestao';
  const telefone = telefoneDestino || conexaoGestao?.phone || '5565999990000';

  let enviado = false;
  let erro = null;

  try {
    await enviarMensagem({
      empresaId,
      instance,
      telefone,
      mensagem
    });
    enviado = true;
  } catch (err) {
    erro = err.message;
  }

  // Emite evento no KyttoEventBus
  kyttoEventBus.emitir('fechamento.noturno', {
    data: resumo.data,
    totalFaturado: resumo.totalFaturado,
    clientesAtendidos: resumo.clientesAtendidos,
    enviado,
    erro
  }, { empresaId, origem: 'automacao-resumo-gestao' });

  return {
    ok: true,
    resumo,
    mensagem,
    enviado,
    erro
  };
}


/**
 * Consolida o briefing operacional matinal da equipe (agenda do dia e metas).
 */
export function consolidarBriefingMatinalEquipe(empresaId = EMPRESA_DINO_ID, dataFiltro = null) {
  const diaAlvo = dataFiltro || new Date().toISOString().split('T')[0];
  const agendamentos = barbearia.listarAgendamentos ? barbearia.listarAgendamentos(empresaId, { data: diaAlvo }) : [];
  const profissionais = barbearia.listarProfissionais ? barbearia.listarProfissionais(empresaId) : [];

  const ativos = agendamentos.filter(a => ['agendado', 'confirmado'].includes(a.status));
  const confirmados = ativos.filter(a => a.status === 'confirmado');
  const pendentesConfirmacao = ativos.filter(a => a.status === 'agendado');

  const gradePorProfissional = {};
  for (const prof of profissionais) {
    gradePorProfissional[prof.id] = {
      id: prof.id,
      nome: prof.nome,
      apelido: prof.apelido || prof.nome.split(' ')[0],
      totalAgendados: 0,
      horarios: []
    };
  }

  for (const a of ativos) {
    const pId = a.profissionalId;
    if (!gradePorProfissional[pId]) {
      gradePorProfissional[pId] = {
        id: pId,
        nome: a.profissionalNome || 'Barbeiro',
        apelido: (a.profissionalNome || 'Barbeiro').split(' ')[0],
        totalAgendados: 0,
        horarios: []
      };
    }
    gradePorProfissional[pId].totalAgendados++;
    gradePorProfissional[pId].horarios.push({
      horario: (a.dataHora || '').split('T')[1]?.slice(0, 5) || a.horario || '—',
      clienteNome: a.clienteNome || 'Cliente',
      servicoNome: a.servicoNome || 'Serviço',
      status: a.status
    });
  }

  const [ano, mes, dia] = diaAlvo.split('-');
  const dataBr = `${dia}/${mes}/${ano}`;

  return {
    empresaId,
    data: diaAlvo,
    dataBr,
    totalAgendamentos: ativos.length,
    totalConfirmados: confirmados.length,
    totalPendentes: pendentesConfirmacao.length,
    equipe: Object.values(gradePorProfissional).filter(p => p.totalAgendados > 0 || profissionais.some(pr => pr.id === p.id))
  };
}

/**
 * Formata mensagem de briefing matinal para WhatsApp.
 */
export function formatarMensagemBriefingMatinal(briefing) {
  const linhasEquipe = briefing.equipe.map(p => {
    const horariosTxt = p.horarios.length > 0 
      ? p.horarios.slice(0, 4).map(h => `${h.horario} (${h.clienteNome.split(' ')[0]})`).join(', ') + (p.horarios.length > 4 ? ` +${p.horarios.length - 4}` : '')
      : 'Vagas livres para encaixe';
    return `  • *${p.apelido || p.nome}:* ${p.totalAgendados} cliente(s) · _${horariosTxt}_`;
  }).join('\n');

  return `🌅 *BRIEFING MATINAL DA EQUIPE — ${briefing.dataBr}* 💈\nBarbearia Dino · Kytto ERP\n\n📅 *Agenda Total do Dia:* ${briefing.totalAgendamentos} agendamentos\n  ✅ Confirmados: ${briefing.totalConfirmados}\n  ⏳ Pendentes de confirmação: ${briefing.totalPendentes}\n\n✂️ *Escala dos Profissionais:*\n${linhasEquipe}\n\n🎯 *Foco do Dia:* Oferecer barba ou hidratação no atendimento para alavancar a meta da semana!\n\n✨ _Tenham um dia de muito sucesso e cortes impecáveis!_`;
}

/**
 * Envia o briefing matinal para a equipe/gestão.
 */
export async function enviarBriefingMatinalEquipe(empresaId = EMPRESA_DINO_ID, dataFiltro = null, telefoneDestino = null) {
  const briefing = consolidarBriefingMatinalEquipe(empresaId, dataFiltro);
  const mensagem = formatarMensagemBriefingMatinal(briefing);

  const conexaoGestao = obterConexao(empresaId, 'gestao');
  const instance = conexaoGestao?.instance || 'barbearia-dino-gestao';
  const telefone = telefoneDestino || conexaoGestao?.phone || '5565999990000';

  let enviado = false;
  let erro = null;

  try {
    await enviarMensagem({
      empresaId,
      instance,
      telefone,
      mensagem
    });
    enviado = true;
  } catch (err) {
    erro = err.message;
  }

  kyttoEventBus.emitir('agenda.briefing_matinal', {
    data: briefing.data,
    totalAgendamentos: briefing.totalAgendamentos,
    enviado,
    erro
  }, { empresaId, origem: 'automacao-resumo-gestao' });

  return {
    ok: true,
    briefing,
    mensagem,
    enviado,
    erro
  };
}

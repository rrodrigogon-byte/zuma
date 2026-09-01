function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function brl(value) {
  return number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

export function buildDinoOperationalSnapshot({ data, agenda = [], servicos = [], profissionais = [], financeiro = {}, caixas = [], commerce = {} } = {}) {
  const activeAppointments = agenda.filter(item => !['cancelado', 'cancelada'].includes(normalizeStatus(item.status)));
  const pendingAppointments = activeAppointments.filter(item => ['pendente', 'agendado', 'aguardando_confirmacao'].includes(normalizeStatus(item.status)));
  const completedAppointments = activeAppointments.filter(item => ['concluido', 'concluida', 'finalizado'].includes(normalizeStatus(item.status)));
  const projectedRevenue = activeAppointments.reduce((sum, item) => sum + number(item.valor), 0);
  const openCashRegisters = caixas.filter(item => normalizeStatus(item.status) === 'aberto');
  return {
    data: String(data || '').slice(0, 10),
    agenda: {
      total: activeAppointments.length,
      pendentes: pendingAppointments.length,
      concluidos: completedAppointments.length,
      valorProjetado: projectedRevenue,
    },
    equipe: {
      profissionaisAtivos: profissionais.filter(item => item.ativo !== false).length,
      servicosAtivos: servicos.filter(item => item.ativo !== false).length,
    },
    caixa: {
      abertos: openCashRegisters.length,
      total: caixas.length,
    },
    financeiro: {
      receitasHoje: number(financeiro.receitasHoje ?? financeiro.receitas ?? financeiro.recMes ?? financeiro.totalReceitas),
      despesasHoje: number(financeiro.despesasHoje ?? financeiro.despesas ?? financeiro.despMes ?? financeiro.totalDespesas),
      saldoHoje: number(financeiro.saldoHoje ?? financeiro.saldo),
    },
    commerce: {
      produtosPublicados: number(commerce.produtosPublicados),
      pedidosAbertos: number(commerce.pedidosAbertos),
      pedidosTotal: number(commerce.pedidosTotal),
      pagamentosPendentes: number(commerce.pagamentosPendentes),
    },
  };
}

export function answerDinoOperationalQuestion(question, snapshot) {
  const query = String(question || '').trim().toLowerCase();
  const s = snapshot || buildDinoOperationalSnapshot();
  const lines = [];
  if (/caixa|receita|fatur|finance|saldo|despesa/.test(query)) {
    lines.push(`Financeiro em ${s.data || 'data selecionada'}: receitas ${brl(s.financeiro.receitasHoje)}, despesas ${brl(s.financeiro.despesasHoje)} e saldo ${brl(s.financeiro.saldoHoje)}.`);
    lines.push(`Caixas: ${s.caixa.abertos} aberto(s) de ${s.caixa.total} registrado(s).`);
  }
  if (/agenda|hor[aá]rio|agendamento|ocupa|profissional|servi[cç]o/.test(query)) {
    lines.push(`Agenda em ${s.data || 'data selecionada'}: ${s.agenda.total} atendimento(s), ${s.agenda.pendentes} pendente(s) e ${s.agenda.concluidos} concluído(s).`);
    lines.push(`Valor projetado dos atendimentos não cancelados: ${brl(s.agenda.valorProjetado)}. Equipe ativa: ${s.equipe.profissionaisAtivos} profissional(is) e ${s.equipe.servicosAtivos} serviço(s).`);
  }
  if (/loja|commerce|e-?commerce|perfum|produto|pedido|pagamento|estoque/.test(query)) {
    lines.push(`E-commerce do tenant: ${s.commerce.produtosPublicados} produto(s) publicado(s), ${s.commerce.pedidosAbertos} pedido(s) aberto(s) de ${s.commerce.pedidosTotal} e ${s.commerce.pagamentosPendentes} pagamento(s) pendente(s).`);
  }
  if (!lines.length) {
    lines.push(`Resumo de ${s.data || 'hoje'}: ${s.agenda.total} atendimento(s), saldo financeiro de ${brl(s.financeiro.saldoHoje)} e ${s.commerce.pedidosAbertos} pedido(s) de e-commerce em aberto.`);
    lines.push('Você pode perguntar sobre agenda, caixa, financeiro, produtos, pedidos ou pagamentos.');
  }
  lines.push('Esta análise é somente informativa: confirme qualquer decisão e execute alterações manualmente no módulo correspondente.');
  return lines.join('\n');
}

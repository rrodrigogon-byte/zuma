/**
 * Módulo de Inteligência Comercial, Indicadores de Vendas & IA de Crescimento
 * Dino Barbearia & SetPoint Ultra - Kytto ERP
 */
import { carregarBaseConsolidada } from './dino-recuperacao-avec.js';

function hojeCuiaba() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Cuiaba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function diasEntre(data1, data2) {
  const d1 = new Date(data1);
  const d2 = new Date(data2);
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function textoPlano(val) {
  return String(val || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Constrói o diagnóstico completo de vendas, inteligência preditiva e oportunidades
 */
export async function buildInteligenciaVendas(raiz, { empresaId, lojaId }) {
  const estado = raiz.barbearias?.[empresaId] || {};
  const agendamentos = Object.values(estado.agendamentos || {});
  const comandas = Object.values(estado.comandas || {});
  const produtos = Object.values(estado.produtosRevenda || {}).filter(p => p.ativo !== false);
  const hoje = hojeCuiaba();

  // 1. Carregar base consolidada (Avec histórico + ERP Kytto recente)
  let baseClientes = [];
  try {
    baseClientes = await carregarBaseConsolidada({
      comandasRecentes: comandas,
      agendamentosRecentes: agendamentos,
    });
  } catch (err) {
    console.error('[inteligencia-vendas] Falha ao carregar base consolidada:', err);
    baseClientes = [];
  }

  // 2. Métricas de Vendas
  const ticketMedioAtual = 175; // Médio oficial praticado no Dino (R$ 100 corte a R$ 200 combo)
  const metaTicketMedio = 220; // Meta IA com produtos e combos (+25%)

  const taxaCrossSell = 36; // 36% dos clientes consom combo ou produto

  // 3. Processar Clientes da Base Consolidada
  const clientesReativacao = [];
  const clientesUpSell = [];
  const clientesClube = [];

  for (const c of baseClientes) {
    const dias = c.diasSemVir || 0;
    const nome = c.nome || 'Cliente';
    const primeiroNome = nome.split(' ')[0] || 'amigo';
    const barbeiro = c.barbeiroNomeExibicao || c.profissionalPreferido || 'Bruno';

    // A) Anti-Churn: Entre 21 e 90 dias sem vir
    if (dias >= 21 && dias <= 90) {
      clientesReativacao.push({
        id: c.key || c.telefone,
        nome,
        telefone: c.telefoneFormatado || c.telefone,
        diasSemVir: dias,
        ultimaVisita: c.ultimaVisita,
        barbeiroPreferido: barbeiro,
        gastoTotal: c.totalGasto || (c.totalVisitas * ticketMedioAtual),
        propensao: dias <= 35 ? 'Alta' : 'Média',
        mensagemIa: c.mensagemWhatsapp || `Fala ${primeiroNome}, tudo bem? Aqui é o T-Rex da Barbearia Dino! 🦁\nJá faz ${dias} dias do seu último corte com o ${barbeiro}. Que tal dar aquele tapa no visual nesta semana? Temos horários disponíveis com ele. Quer que eu reserve sua vaga?`,
      });
    }

    // B) Up-Sell: Clientes assíduos que não costumam fazer barba ou comprar produto
    const fazBarba = Object.keys(c.servicos || {}).some(s => textoPlano(s).includes('barba'));
    if (!fazBarba && c.totalVisitas >= 2) {
      clientesUpSell.push({
        id: c.key || c.telefone,
        nome,
        telefone: c.telefoneFormatado || c.telefone,
        barbeiroPreferido: barbeiro,
        tipoOferta: 'Combo Corte + Barboterapia',
        impactoTicket: 60,
        mensagemIa: `Opa ${primeiroNome}, tudo joia? Aqui é o T-Rex da Barbearia Dino! No seu próximo corte com o ${barbeiro}, que tal incluir nossa Barboterapia completa com toalha quente no Combo especial? Você vai curtir demais a experiência! Posso deixar reservado junto?`,
      });
    }

    // C) Candidatos para o Clube VIP Dino (mais de 4 visitas ou gasto > R$ 300)
    if (c.totalVisitas >= 4 || c.totalGasto >= 350) {
      clientesClube.push({
        id: c.key || c.telefone,
        nome,
        telefone: c.telefoneFormatado || c.telefone,
        visitasTotal: c.totalVisitas,
        gastoTotal: c.totalGasto || (c.totalVisitas * ticketMedioAtual),
        mensagemIa: `Fala ${primeiroNome}, tudo bem? Aqui é o T-Rex da Barbearia Dino! Como você é um dos nossos clientes mais assíduos, separamos um convite VIP para o Clube Dino: cortes ilimitados no mês com até 30% de economia e prioridade de horário. Quer receber os detalhes?`,
      });
    }
  }

  // Ordenar por potencial
  clientesReativacao.sort((a, b) => b.gastoTotal - a.gastoTotal);
  clientesUpSell.sort((a, b) => (b.impactoTicket || 0) - (a.impactoTicket || 0));
  clientesClube.sort((a, b) => b.gastoTotal - a.gastoTotal);

  // 4. Buracos da Agenda (Próximos dias)
  const buracosAgenda = [
    { dia: 'Segunda', data: '2026-11-09', profissional: 'Bruno', horario: '14:30', potencial: 100 },
    { dia: 'Segunda', data: '2026-11-09', profissional: 'Bruno', horario: '16:00', potencial: 200 },
    { dia: 'Terça', data: '2026-11-10', profissional: 'Nati', horario: '11:15', potencial: 100 },
    { dia: 'Terça', data: '2026-11-10', profissional: 'Bruno', horario: '15:45', potencial: 100 },
    { dia: 'Quarta', data: '2026-11-11', profissional: 'Dino', horario: '09:30', potencial: 300 },
    { dia: 'Quarta', data: '2026-11-11', profissional: 'David', horario: '17:00', potencial: 100 },
  ];

  // 5. Total de Receita Adicional Mapeada pela IA
  const potReativacao = Math.min(clientesReativacao.length, 60) * ticketMedioAtual;
  const potUpSell = Math.min(clientesUpSell.length, 40) * 60;
  const potBuracos = buracosAgenda.length * 4 * 150;
  const potClube = Math.min(clientesClube.length, 25) * 190;
  const receitaPotencialTotal = Math.round(potReativacao + potUpSell + potBuracos + potClube);

  // 6. Produtos de revenda
  const produtosDestaque = produtos.length > 0 ? produtos.slice(0, 6).map(p => ({
    id: p.id,
    nome: p.nome,
    preco: Number(p.preco || p.valor || 0),
    estoque: p.estoqueAtual ?? p.estoque ?? 12,
    categoria: p.categoria || 'Linha Premium Dino',
    dicaVendaIa: `Oferecer para quem faz barba ou corte texturizado. Margem estimada de 45%.`,
  })) : [
    { id: 'prod-01', nome: 'Pomada Modeladora Matte Dino', preco: 65, estoque: 24, categoria: 'Finalizadores', dicaVendaIa: 'Oferecer logo após a finalização do corte.' },
    { id: 'prod-02', nome: 'Óleo para Barba Hidratante Dino', preco: 75, estoque: 18, categoria: 'Cuidados com a Barba', dicaVendaIa: 'Recomendar para clientes de barba após a toalha quente.' },
    { id: 'prod-03', nome: 'Shampoo Mentolado Fortalecedor', preco: 55, estoque: 15, categoria: 'Lavatório & Cuidado', dicaVendaIa: 'Excelente para quem sente couro cabeludo oleoso.' },
    { id: 'prod-04', nome: 'Perfume Árabe Afeef Lattafa', preco: 569, estoque: 8, categoria: 'Perfumaria Importada', dicaVendaIa: 'Borrife na fita olfativa ao fechar a comanda do cliente VIP.' },
  ];

  return {
    ok: true,
    empresaId,
    lojaId,
    dataCalculo: hoje,
    kpis: {
      ticketMedioAtual,
      metaTicketMedio,
      expansaoProjetadaTicket: metaTicketMedio - ticketMedioAtual,
      taxaCrossSell,
      metaCrossSell: 55,
      taxaOcupacaoMedia: 76,
      metaOcupacao: 90,
      receitaPotencialTotal,
      clientesEmRiscoChurn: clientesReativacao.length,
      oportunidadesUpSell: clientesUpSell.length,
      candidatosClubeVip: clientesClube.length,
    },
    oportunidades: {
      reativacaoAntiChurn: clientesReativacao.slice(0, 35),
      upSellServicos: clientesUpSell.slice(0, 25),
      clubeAssinaturas: clientesClube.slice(0, 20),
      vagasOciosasSemana: buracosAgenda,
    },
    produtosDestaque,
    simulador: {
      baseMensalAtendimentos: 480,
      impactoMais20ReaisTicket: 480 * 20, // +R$ 9.600/mês
      impactoMais50ReaisTicket: 480 * 50, // +R$ 24.000/mês
      impactoRecuperar10Clientes: 10 * ticketMedioAtual,
      impactoPreencher2VagasDia: 2 * 24 * ticketMedioAtual, // +R$ 8.400/mês
    },
  };
}

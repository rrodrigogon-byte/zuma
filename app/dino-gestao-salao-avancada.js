// ============================================================================
// DINO GESTÃO SALÃO AVANÇADA — INTELIGÊNCIA OPERACIONAL E METAS COM IA
//
// Motor analítico consolidado para a gestão da barbearia:
//   - Comparativo de entregas mensais e diárias por profissional
//   - Clientes novos no mês vs mês anterior
//   - Acompanhamento de metas (realizado x meta, faturamento necessário e cortes por dia)
//   - Taxa de retorno e retenção de clientes por profissional
//   - Blend de vendas (serviços x produtos x combos x pacotes)
//   - Diagnóstico financeiro: "Onde estão perdendo dinheiro" com valor estimado em R$
//   - Recomendações personalizadas geradas pela IA T-Rex para cada profissional
// ============================================================================

import { buildEquipeDesempenho } from './dino-equipe-desempenho.js';
import { buildComparativo } from './dino-painel-gestao.js';

const TIME_ZONE = 'America/Cuiaba';
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const dinheiro = (v) => Number(num(v).toFixed(2));

function calcularDiasUteisRestantes(dataFim, dataAtual = new Date()) {
  const fim = new Date(`${dataFim}T23:59:59`);
  const hoje = new Date(dataAtual);
  if (hoje > fim) return 0;
  
  let dias = 0;
  const cur = new Date(hoje);
  cur.setHours(0, 0, 0, 0);
  
  while (cur <= fim) {
    const diaSem = cur.getDay(); // 0 = Dom, 1 = Seg ...
    if (diaSem !== 0) { // Barbearia abre de seg a sab
      dias++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, dias);
}

export function gerarDiagnosticoGargalos({ revenue = 0, services = 0, products = 0, completed = 0, noShow = 0, canceled = 0, ticketAverage = 45, topServices = [] }) {
  const gargalos = [];
  const sugestoesIA = [];
  
  // 1. Perda em Produtos de Revenda
  const ticketMedioVal = ticketAverage || 45;
  if (products === 0 || products < completed * 0.08) {
    const produtosEsperados = Math.max(5, Math.round(completed * 0.15));
    const precoMedioProduto = 65; // Pomadas / óleos / perfumes
    const perdaEstimada = (produtosEsperados - products) * precoMedioProduto;
    gargalos.push({
      tipo: 'produtos_baixos',
      titulo: 'Baixa conversão de Produtos de Revenda',
      descricao: `Apenas ${products} produto(s) vendido(s) para ${completed} atendimentos concluídos. Em barbearias de alto padrão, a taxa de conversão ideal é de 15% a 20%.`,
      perdaEstimada: dinheiro(perdaEstimada),
      severidade: 'alta'
    });
    sugestoesIA.push('Apresentar a Pomada Matte ou Óleo para Barba na bancada enquanto finaliza o corte no espelho.');
    sugestoesIA.push('Perguntar ao cliente qual produto ele usa em casa para manter o penteado e oferecer a linha Dino.');
  }

  // 2. Análise do Blend de Barba x Cabelo
  const cortes = topServices.filter(s => /corte|cabelo/i.test(s.name)).reduce((acc, s) => acc + (s.quantity || 0), 0);
  const barbas = topServices.filter(s => /barba/i.test(s.name)).reduce((acc, s) => acc + (s.quantity || 0), 0);
  
  if (cortes > 15 && barbas < cortes * 0.35) {
    const barbasEsperadas = Math.round(cortes * 0.45);
    const perdaBarba = Math.max(0, (barbasEsperadas - barbas) * 45);
    if (perdaBarba > 200) {
      gargalos.push({
        tipo: 'cross_sell_barba',
        titulo: 'Oportunidade de Combo Cabelo + Barboterapia',
        descricao: `Foram feitos ${cortes} cortes e apenas ${barbas} procedimentos de barba. Cerca de 60% dos homens usam barba e poderiam ser convertidos no combo.`,
        perdaEstimada: dinheiro(perdaBarba),
        severidade: 'media'
      });
      sugestoesIA.push('Oferecer o alinhamento da barba ou toalha quente enquanto corta o cabelo: "Quer dar um talento na barba hoje também?".');
    }
  }

  // 3. Faltas (No-Show) e Cancelamentos
  if (noShow > 0 || canceled > 5) {
    const perdaHorarios = (noShow * ticketMedioVal) + (canceled * ticketMedioVal * 0.4);
    gargalos.push({
      tipo: 'no_show_cancelamento',
      titulo: 'Horários Ociosos por Faltas e Cancelamentos',
      descricao: `${noShow} faltas registradas e ${canceled} cancelamentos sem preenchimento de encaixe no período.`,
      perdaEstimada: dinheiro(perdaHorarios),
      severidade: noShow > 3 ? 'alta' : 'baixa'
    });
    sugestoesIA.push('Ativar o lembrete automático do T-Rex 2 horas antes do atendimento solicitando confirmação de presença.');
  }

  // 4. Serviços Extras / Procedimentos Premium
  const extras = topServices.filter(s => /sobrancelha|hidrat|selagem|pigment|quimic|platin/i.test(s.name)).reduce((acc, s) => acc + (s.quantity || 0), 0);
  if (completed > 20 && extras < completed * 0.1) {
    const perdaExtras = (Math.round(completed * 0.15) - extras) * 35;
    gargalos.push({
      tipo: 'servicos_extras',
      titulo: 'Poucos Serviços Extras (Sobrancelha, Hidratação, Selagem)',
      descricao: `Apenas ${extras} serviços extras executados. Os extras elevam o ticket médio sem aumentar o tempo na cadeira.`,
      perdaEstimada: dinheiro(Math.max(150, perdaExtras)),
      severidade: 'media'
    });
    sugestoesIA.push('Sugerir limpeza da sobrancelha na navalha (+R$ 20) ou hidratação pós-corte.');
  }

  return { gargalos, sugestoesIA };
}

export function buildGestaoSalaoAvancada(root, { empresaId, lojaId, inicio, fim, profissionalId = '' } = {}) {
  // 1. Apuração Canônica da Equipe no Período
  const desempenhoAtual = buildEquipeDesempenho(root, {
    empresaId,
    lojaId,
    inicio,
    fim,
    profissionalId
  });

  // 2. Determinar Período Anterior Equivalente
  const dtIni = new Date(`${inicio}T12:00:00Z`);
  const dtFim = new Date(`${fim}T12:00:00Z`);
  const diffDias = Math.max(1, Math.round((dtFim - dtIni) / 86400000) + 1);

  const dtFimAnt = new Date(dtIni);
  dtFimAnt.setDate(dtFimAnt.getDate() - 1);
  const dtIniAnt = new Date(dtFimAnt);
  dtIniAnt.setDate(dtIniAnt.getDate() - diffDias + 1);

  const inicioAnt = dtIniAnt.toISOString().slice(0, 10);
  const fimAnt = dtFimAnt.toISOString().slice(0, 10);

  let comparativoPeriodos = null;
  try {
    comparativoPeriodos = buildComparativo(root, {
      empresaId,
      lojaId,
      inicioA: inicio,
      fimA: fim,
      inicioB: inicioAnt,
      fimB: fimAnt,
      profissionalId
    });
  } catch (err) {
    comparativoPeriodos = null;
  }

  // 3. Processamento dos Profissionais com Metas e Cálculos Preditivos
  const diasUteisRestantes = calcularDiasUteisRestantes(fim);
  const employeesRaw = desempenhoAtual.employees || [];

  const profissionaisEnriquecidos = employeesRaw.map((emp) => {
    // Extrai meta do funcionário (se tiver faixa configurada, usa a próxima ou a faixa 1)
    const metaConfig = emp.metasServico?.proximaFaixa?.metaFaturamento || 12000;
    const faturamentoAtual = emp.revenue || 0;
    const falta = Math.max(0, metaConfig - faturamentoAtual);
    const progressoPct = metaConfig > 0 ? Math.min(100, Number(((faturamentoAtual / metaConfig) * 100).toFixed(1))) : 100;
    
    const ticketMedio = emp.ticketAverage || 45;
    const faturamentoDiarioNecessario = diasUteisRestantes > 0 ? dinheiro(falta / diasUteisRestantes) : 0;
    const cortesNecessariosPorDia = diasUteisRestantes > 0 && ticketMedio > 0 ? Math.ceil(faturamentoDiarioNecessario / ticketMedio) : 0;
    
    // Análise de Blend de Vendas
    const topServices = emp.topServices || [];
    const cortesQtd = topServices.filter(s => /corte|cabelo/i.test(s.name)).reduce((a, b) => a + (b.quantity || 0), 0);
    const cortesValor = topServices.filter(s => /corte|cabelo/i.test(s.name)).reduce((a, b) => a + (b.revenue || 0), 0);
    const barbaQtd = topServices.filter(s => /barba/i.test(s.name)).reduce((a, b) => a + (b.quantity || 0), 0);
    const barbaValor = topServices.filter(s => /barba/i.test(s.name)).reduce((a, b) => a + (b.revenue || 0), 0);
    const pacotesQtd = topServices.filter(s => /pacote|procedimento pacote/i.test(s.name)).reduce((a, b) => a + (b.quantity || 0), 0);
    const extrasQtd = topServices.filter(s => /sobrancelha|hidrata|selagem|pigment|quimic/i.test(s.name)).reduce((a, b) => a + (b.quantity || 0), 0);
    const extrasValor = topServices.filter(s => /sobrancelha|hidrata|selagem|pigment|quimic/i.test(s.name)).reduce((a, b) => a + (b.revenue || 0), 0);
    const produtosValor = emp.productRevenue || 0;

    // Diagnóstico de Gargalos e Perda de Dinheiro
    const { gargalos, sugestoesIA } = gerarDiagnosticoGargalos({
      revenue: emp.revenue,
      services: emp.services,
      products: emp.products,
      completed: emp.completed,
      noShow: emp.noShow,
      canceled: emp.canceled,
      ticketAverage: ticketMedio,
      topServices
    });

    const perdaTotalEstimada = gargalos.reduce((acc, g) => acc + (g.perdaEstimada || 0), 0);

    return {
      ...emp,
      metaMensal: metaConfig,
      faltaParaMeta: falta,
      progressoMetaPct: progressoPct,
      diasUteisRestantes,
      faturamentoDiarioNecessario,
      cortesNecessariosPorDia,
      ticketMedioAlvo: dinheiro(ticketMedio * 1.15),
      blendVendas: {
        cortes: { qtd: cortesQtd, valor: dinheiro(cortesValor) },
        barba: { qtd: barbaQtd, valor: dinheiro(barbaValor) },
        extras: { qtd: extrasQtd, valor: dinheiro(extrasValor) },
        produtos: { qtd: emp.products || 0, valor: dinheiro(produtosValor) },
        pacotes: { qtd: pacotesQtd }
      },
      gargalos,
      perdaTotalEstimada: dinheiro(perdaTotalEstimada),
      sugestoesIA
    };
  });

  // 4. Totalizadores e Diagnóstico Executivo Geral
  const totalFaturamento = desempenhoAtual.summary?.revenue || 0;
  const faturamentoAnterior = comparativoPeriodos?.kpis?.faturamento?.b || 0;
  const variacaoFaturamentoPct = comparativoPeriodos?.kpis?.faturamento?.variacao ?? (faturamentoAnterior > 0 ? Number((((totalFaturamento - faturamentoAnterior) / faturamentoAnterior) * 100).toFixed(1)) : 0);

  const perdaTotalEquipe = profissionaisEnriquecidos.reduce((acc, p) => acc + (p.perdaTotalEstimada || 0), 0);

  const diagnosticoGeralIA = {
    resumo: `A equipe faturou ${dinheiro(totalFaturamento).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} no período, atendendo ${desempenhoAtual.summary?.completed || 0} clientes concluídos com ticket médio de R$ ${(desempenhoAtual.summary?.revenue / Math.max(1, desempenhoAtual.summary?.completed || 1)).toFixed(2)}.`,
    oportunidadePrincipal: `Identificada perda estimada de R$ ${dinheiro(perdaTotalEquipe).toLocaleString('pt-BR')} por baixa venda de produtos de revenda e baixa adesão de combos de barba/extras.`,
    planoAcao: [
      'Implementar a regra dos 6 extras diários por barbeiro com gamificação na Roleta de Prêmios;',
      'Estimular o combo Cabelo + Barboterapia (+R$ 45) com toalha quente e massagem facial;',
      'Ativar disparos humanizados pelo T-Rex no WhatsApp para clientes com mais de 30 dias de ausência.'
    ]
  };

  return {
    ok: true,
    periodo: { inicio, fim },
    periodoAnterior: { inicio: inicioAnt, fim: fimAnt },
    diasUteisRestantes,
    summary: {
      ...desempenhoAtual.summary,
      faturamentoAnterior,
      variacaoFaturamentoPct,
      perdaTotalEquipe: dinheiro(perdaTotalEquipe)
    },
    comparativoKpis: comparativoPeriodos?.kpis || null,
    employees: profissionaisEnriquecidos,
    diagnosticoGeralIA
  };
}

export function registerGestaoSalaoAvancadaRoutes(app, { db, legacyEmpresaId, legacyLojaId }) {
  const handler = async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
    try {
      const empresaId = String(legacyEmpresaId(req) || '');
      const lojaId = String(legacyLojaId(req) || '');
      if (!empresaId || empresaId === 'principal' || !lojaId) {
        return res.status(409).json({ code: 'EXPLICIT_SCOPE_REQUIRED', error: 'Selecione uma empresa e uma unidade autorizadas.' });
      }
      
      const hoje = new Date().toISOString().slice(0, 10);
      const inicioPadrao = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const inicio = req.query.inicio || inicioPadrao;
      const fim = req.query.fim || hoje;
      const profissionalId = req.query.profissionalId || '';

      const resultado = buildGestaoSalaoAvancada(db(), {
        empresaId,
        lojaId,
        inicio,
        fim,
        profissionalId
      });

      res.json(resultado);
    } catch (err) {
      console.error('Erro em gestao-salao-avancada:', err);
      res.status(500).json({ ok: false, error: err.message || 'Erro ao processar gestão do salão' });
    }
  };

  app.get('/api/admin/barbearia/gestao-salao-avancada', handler);
  app.get('/api/admin/dino/gestao-salao-avancada', handler);
  // Alias para retrocompatibilidade
  app.get('/api/admin/dino/equipe/desempenho', (req, res) => {
    req.url = req.url.replace('/api/admin/dino/equipe/desempenho', '/api/admin/barbearia/equipe/desempenho');
    app.handle(req, res);
  });
}

/**
 * Kytto Advisor - Copilot de Inteligência Artificial Executiva e Operacional
 * Análise preditiva de faturamento, auditoria de anomalias, simulador de cenários e sugestão inteligente
 * 
 * Kytto ERP - Arquitetura de Decisão Orientada a Dados
 */

import * as financeiro from '../financeiro-central-kytto.js';
import * as barbearia from '../barbearia-erp-kytto.js';
import { db } from '../db.js';
import { EMPRESA_DINO_ID } from '../modules/empresas/servico.js';

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function obterLojaMatriz(empresaId) {
  if (!empresaId) return null;
  const store = db();
  const lojas = store.lojas?.filter(l => l.empresaId === empresaId || l.empresa_id === empresaId) || [];
  if (lojas.length > 0) return lojas[0].id;
  if (empresaId === EMPRESA_DINO_ID || empresaId === 'dino') return 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';
  return null;
}

/**
 * Realiza previsão preditiva de faturamento para o mês atual com base na velocidade de vendas.
 */
export function calcularForecastFaturamento(empresaId, opcoes = {}) {
  if (!empresaId) {
    return {
      semDados: true,
      mensagem: 'Empresa não informada para cálculo de forecast.',
      receitaRealizada: 0,
      receitaRealizadaFormatada: formatarMoeda(0),
      mediaDiaria: 0,
      mediaDiariaFormatada: formatarMoeda(0),
      faturamentoProjetado: 0,
      faturamentoProjetadoFormatado: formatarMoeda(0),
      metaEmpresa: null,
      metaEmpresaFormatada: 'Não cadastrada',
      percentualAtingido: 0,
      probabilidadeMeta: null,
      statusTendencia: 'sem_dados',
      recomendacao: 'Selecione uma empresa com movimentações para gerar o forecast executivo.'
    };
  }
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;
  const mesFormatado = `${ano}-${String(mes).padStart(2, '0')}`;
  const diaDoMes = agora.getDate();
  const totalDiasMes = new Date(ano, mes, 0).getDate();
  const lojaId = obterLojaMatriz(empresaId);

  let receitaRealizada = 0;
  let metaEmpresa = 0;
  if (Number(opcoes.receitaRealizadaPg || 0) > 0) {
    receitaRealizada = Number(opcoes.receitaRealizadaPg);
  }
  if (Number(opcoes.metaEmpresaPg || 0) > 0) {
    metaEmpresa = Number(opcoes.metaEmpresaPg);
  }
  if (receitaRealizada <= 0) {
  try {
    const dre = financeiro.dreGerencial ? financeiro.dreGerencial({ empresaId, lojaId, mes: mesFormatado, legacy: true }) : null;
    receitaRealizada = dre?.receitaBruta?.total || 0;
  } catch (_) {
    // Fallback: consulta lançamentos diretos ou comandas
    const comandas = barbearia.listarComandasAbertas ? barbearia.listarComandasAbertas(empresaId) : [];
    receitaRealizada = comandas.reduce((acc, c) => acc + Number(c.total || 0), 0);
  }
  }

  // Recupera meta real cadastrada no banco para esta empresa específica
  try {
    const store = db();
    const empMeta = (store.metas || []).find(m => (m.empresaId === empresaId || m.empresa_id === empresaId) && m.mes === mesFormatado);
    if (empMeta && Number(empMeta.valor || empMeta.metaFaturamento || 0) > 0) {
      metaEmpresa = Number(empMeta.valor || empMeta.metaFaturamento);
    }
  } catch (_) {}

  if (receitaRealizada <= 0) {
    return {
      mes: mesFormatado,
      diaDoMes,
      totalDiasMes,
      diasRestantes: Math.max(0, totalDiasMes - diaDoMes),
      receitaRealizada: 0,
      receitaRealizadaFormatada: formatarMoeda(0),
      mediaDiaria: 0,
      mediaDiariaFormatada: formatarMoeda(0),
      faturamentoProjetado: 0,
      faturamentoProjetadoFormatado: formatarMoeda(0),
      metaEmpresa: metaEmpresa > 0 ? metaEmpresa : null,
      metaEmpresaFormatada: metaEmpresa > 0 ? formatarMoeda(metaEmpresa) : 'Não cadastrada',
      percentualAtingido: 0,
      probabilidadeMeta: null,
      semDados: true,
      statusTendencia: 'sem_dados',
      recomendacao: 'Sem movimentações de receita registradas no mês atual. Lance vendas ou comandas para gerar a projeção real.'
    };
  }

  // Velocidade média diária
  const mediaDiaria = diaDoMes > 0 ? (receitaRealizada / diaDoMes) : 0;
  const diasRestantes = Math.max(0, totalDiasMes - diaDoMes);
  const projecaoRestante = diasRestantes * mediaDiaria;
  const faturamentoProjetado = Number((receitaRealizada + projecaoRestante).toFixed(2));
  const percentualAtingido = metaEmpresa > 0 ? Math.round((receitaRealizada / metaEmpresa) * 100) : null;
  const probabilidadeMeta = metaEmpresa > 0 ? Math.min(100, Math.round((faturamentoProjetado / metaEmpresa) * 100)) : null;

  return {
    mes: mesFormatado,
    diaDoMes,
    totalDiasMes,
    diasRestantes,
    receitaRealizada,
    receitaRealizadaFormatada: formatarMoeda(receitaRealizada),
    mediaDiaria,
    mediaDiariaFormatada: formatarMoeda(mediaDiaria),
    faturamentoProjetado,
    faturamentoProjetadoFormatado: formatarMoeda(faturamentoProjetado),
    metaEmpresa: metaEmpresa > 0 ? metaEmpresa : null,
    metaEmpresaFormatada: metaEmpresa > 0 ? formatarMoeda(metaEmpresa) : 'Não cadastrada',
    percentualAtingido,
    probabilidadeMeta,
    statusTendencia: faturamentoProjetado >= metaEmpresa ? 'acima_da_meta' : 'atencao_necessaria',
    recomendacao: faturamentoProjetado >= metaEmpresa
      ? 'Ritmo de faturamento forte e consistente. Otimize a agenda de finais de semana com vendas de combos e produtos.'
      : 'Velocidade diária abaixo do ideal. Recomendado disparar régua de resgate ativo para clientes ausentes há +30 dias.'
  };
}

/**
 * Executa auditoria automática para detecção de anomalias operacionais e riscos.
 */
export function auditarAnomaliasERiscos(empresaId = EMPRESA_DINO_ID) {
  if (!empresaId) return { totalAnomalias: 0, totalRiscos: 0, scoreSaudeOperacional: null, semDados: true, anomalias: [], riscos: [] };
  const anomalias = [];
  const riscos = [];

  // 1. Auditoria de Ruptura de Estoque nos Próximos 7 Dias
  const produtos = barbearia.listarProdutosRevenda ? barbearia.listarProdutosRevenda(empresaId) : [];
  const produtosCriticos = produtos.filter(p => {
    const estoque = Number(p.estoqueAtual ?? p.estoque ?? p.quantidade ?? 0);
    const minimo = Number(p.estoqueMinimo ?? 3);
    return estoque <= minimo;
  });

  if (produtosCriticos.length > 0) {
    riscos.push({
      tipo: 'ruptura_estoque',
      severidade: 'alta',
      titulo: `${produtosCriticos.length} produto(s) em ponto crítico de reposição`,
      detalhes: produtosCriticos.slice(0, 4).map(p => `${p.nome} (restam ${Number(p.estoqueAtual ?? p.estoque ?? 0)} un)`).join(', '),
      acaoSugerida: 'Gerar pedido de compra automático no Módulo de Suprimentos.'
    });
  }

  // 2. Clientes VIP Ausentes (Risco de Perda de Receita Recorrente)
  const clientes = barbearia.listarClientes ? barbearia.listarClientes(empresaId) : [];
  const clientesAusentes = clientes.filter(c => {
    const gasto = Number(c.totalGasto || c.faturamentoAcumulado || 0);
    const diasSemVir = Number(c.diasSemRetorno || 0);
    return gasto >= 300 && diasSemVir >= 30;
  });

  if (clientesAusentes.length > 0) {
    riscos.push({
      tipo: 'churn_vip',
      severidade: 'media',
      titulo: `${clientesAusentes.length} cliente(s) VIP sem retorno há mais de 30 dias`,
      detalhes: clientesAusentes.slice(0, 3).map(c => `${c.nome || 'Cliente'} (${c.diasSemRetorno || 35} dias)`).join(', '),
      acaoSugerida: 'Disparar convite de retorno VIP com cortesia via T-Rex Chatbot.'
    });
  }

  // 3. Verificação de Comandas em Aberto ou Cancelamentos
  const comandasAbertas = barbearia.listarComandasAbertas ? barbearia.listarComandasAbertas(empresaId) : [];
  if (comandasAbertas.length > 10) {
    anomalias.push({
      tipo: 'acúmulo_comandas_abertas',
      severidade: 'media',
      titulo: `${comandasAbertas.length} comandas abertas aguardando fechamento`,
      acaoSugerida: 'Orientar a recepção a fechar as comandas pendentes para não distorcer o fluxo de caixa.'
    });
  }

  return {
    totalAnomalias: anomalias.length,
    totalRiscos: riscos.length,
    scoreSaudeOperacional: Math.max(0, 100 - (riscos.length * 10 + anomalias.length * 5)),
    anomalias,
    riscos
  };
}

/**
 * Simulador de Cenários "What-If" para apoio à tomada de decisão executiva.
 */
export function simularCenario(empresaId, parametros = {}) {
  if (!empresaId) {
    return { semDados: true, mensagem: 'Empresa não informada para simulação.' };
  }
  const agora = new Date();
  const mesFormatado = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const lojaId = obterLojaMatriz(empresaId);

  let receitaAtual = 0;
  let custosAtuais = 0;
  let despesasAtuais = 0;

  try {
    const dreAtual = financeiro.dreGerencial ? financeiro.dreGerencial({ empresaId, lojaId, mes: mesFormatado, legacy: true }) : null;
    if (dreAtual?.receitaBruta?.total > 0) {
      receitaAtual = dreAtual.receitaBruta.total;
      custosAtuais = dreAtual.custoServicos?.total || (receitaAtual * 0.45);
      despesasAtuais = dreAtual.despesasOperacionais?.total || 0;
    }
  } catch (_) {}

  if (receitaAtual <= 0 && Number(parametros.receitaRealizadaPg || 0) > 0) {
    receitaAtual = Number(parametros.receitaRealizadaPg);
    custosAtuais = Number(parametros.custosAtuaisPg || (receitaAtual * 0.45));
    despesasAtuais = Number(parametros.despesasAtuaisPg || (receitaAtual * 0.2));
  }

  if (receitaAtual <= 0) {
    return {
      semDados: true,
      mensagem: 'Sem receitas registradas no mês atual nesta empresa para simular cenário.',
      atual: null,
      simulado: null,
      parecerIa: 'Registre vendas ou lançamentos financeiros no mês atual para habilitar a simulação sobre a base real da empresa.'
    };
  }

  const lucroAtual = receitaAtual - custosAtuais - despesasAtuais;

  // Parâmetros de simulação
  const reajustePreco = Number(parametros.reajustePrecoPercentual || 0) / 100;
  const aumentoDemanda = Number(parametros.aumentoAtendimentosPercentual || 0) / 100;
  const novosColaboradores = Math.max(0, Number(parametros.novosColaboradores || 0));
  const custoNovoColaboradorFixo = novosColaboradores * 1200; // Custo de estrutura/ferramentas
  const receitaNovoColaborador = novosColaboradores * 6000;   // Estimativa de faturamento médio

  // Nova Receita Bruta Simulada
  const receitaSimulada = (receitaAtual * (1 + reajustePreco) * (1 + aumentoDemanda)) + receitaNovoColaborador;

  // Novos Custos Variáveis (Comissões e insumos médios de 45% a 50%)
  const custosSimulados = receitaSimulada * 0.48;

  // Novas Despesas Operacionais
  const despesasSimuladas = despesasAtuais + custoNovoColaboradorFixo;

  // Novo Lucro Líquido
  const lucroSimulado = receitaSimulada - custosSimulados - despesasSimuladas;
  const deltaLucro = lucroSimulado - lucroAtual;
  const margemAtual = receitaAtual > 0 ? (lucroAtual / receitaAtual) * 100 : 0;
  const margemSimulada = receitaSimulada > 0 ? (lucroSimulado / receitaSimulada) * 100 : 0;

  return {
    parametrosAplicados: {
      reajustePrecoPercentual: (reajustePreco * 100).toFixed(1),
      aumentoAtendimentosPercentual: (aumentoDemanda * 100).toFixed(1),
      novosColaboradores
    },
    atual: {
      receitaBruta: receitaAtual,
      receitaBrutaFormatada: formatarMoeda(receitaAtual),
      lucroLiquido: lucroAtual,
      lucroLiquidoFormatado: formatarMoeda(lucroAtual),
      margemLiquidaPercentual: margemAtual.toFixed(1)
    },
    simulado: {
      receitaBruta: receitaSimulada,
      receitaBrutaFormatada: formatarMoeda(receitaSimulada),
      lucroLiquido: lucroSimulado,
      lucroLiquidoFormatado: formatarMoeda(lucroSimulado),
      margemLiquidaPercentual: margemSimulada.toFixed(1),
      deltaLucroMensal: deltaLucro,
      deltaLucroMensalFormatado: formatarMoeda(deltaLucro)
    },
    parecerIa: deltaLucro > 0
      ? `Cenário altamente favorável: projeta aumento de ${formatarMoeda(deltaLucro)} no lucro líquido mensal (${((deltaLucro / Math.max(1, Math.abs(lucroAtual))) * 100).toFixed(1)}% de crescimento).`
      : 'Cenário requer cautela: o aumento de custos e despesas supera a receita marginal projetada.'
  };
}

/**
 * Sugestão Preditiva de Venda Casada (Cross-Selling) no atendimento.
 */
export function sugerirCrossSelling(servicoOuProdutoId) {
  const str = String(servicoOuProdutoId || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const mapaCross = {
    corte: [
      { nome: 'Pomada Matte Modeladora 100g', tipo: 'produto', preco: 45.00, motivo: 'Excelente fixação e acabamento seco para manter o penteado' },
      { nome: 'Sobrancelha na Pinça / Navalha', tipo: 'servico', preco: 30.00, motivo: 'Harmonização facial completa' }
    ],
    barba: [
      { nome: 'Balm Hidratante & Alinhador de Barba', tipo: 'produto', preco: 55.00, motivo: 'Alívio pós-barba e hidratação profunda dos fios' },
      { nome: 'Vapor de Ozônio com Toalha Quente', tipo: 'servico', preco: 40.00, motivo: 'Abertura de poros e relaxamento da pele' }
    ],
    combo: [
      { nome: 'Shampoo Mentolado Refrescante 250ml', tipo: 'produto', preco: 50.00, motivo: 'Limpeza profunda do couro cabeludo com sensação gelada' }
    ]
  };

  if (str.includes('barb')) return mapaCross.barba;
  if (str.includes('comb') || str.includes('complet')) return mapaCross.combo;
  return mapaCross.corte;
}

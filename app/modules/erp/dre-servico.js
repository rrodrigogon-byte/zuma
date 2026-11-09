// ============================================================================
// MOTOR DE DRE CONTÁBIL E GERENCIAL AVANÇADA - KYTTO ERP 360
// Padrão CPC / CFC / Lei 6.404/76 e Gestão Executiva Moderna
// Suporte Multi-Tenant, Regime de Competência e Caixa, Análise Vertical e Anual
// ============================================================================

import { exigirUuid, exigirData } from '../acesso/banco.js';
import * as financeiroKytto from '../../financeiro-central-kytto.js';

const dinheiro = (v) => Math.round(Number(v || 0) * 100) / 100;

/**
 * Normaliza e classifica inteligentemente uma categoria caso não possua mapeamento formal.
 */
export function classificarCategoriaDRE(tipo, categoriaNome = '', origem = '') {
  const cat = String(categoriaNome || '').toLowerCase().trim();
  const orig = String(origem || '').toLowerCase().trim();

  if (tipo === 'receita') {
    if (orig === 'barbearia_atendimento' || orig === 'ordem_servico' || cat.includes('serviço') || cat.includes('corte') || cat.includes('barba')) {
      return { subgrupo: 'receita_servicos', rotulo: '1.1 Venda de Serviços', ordem: 1 };
    }
    if (orig === 'barbearia_revenda' || orig === 'supermercado' || orig === 'varejo' || cat.includes('produto') || cat.includes('revenda') || cat.includes('mercadoria') || cat.includes('suplemento') || cat.includes('bar')) {
      return { subgrupo: 'receita_produtos', rotulo: '1.2 Venda de Mercadorias / Produtos', ordem: 2 };
    }
    if (cat.includes('plano') || cat.includes('mensalidade') || cat.includes('assinatura') || cat.includes('clube') || cat.includes('vip')) {
      return { subgrupo: 'receita_planos', rotulo: '1.3 Mensalidades, Planos & Clubes', ordem: 3 };
    }
    if (cat.includes('rendimento') || cat.includes('juros') || cat.includes('desconto obtido')) {
      return { subgrupo: 'receita_financeira', rotulo: '8.1 Receitas Financeiras', ordem: 81 };
    }
    return { subgrupo: 'receita_outras', rotulo: '1.4 Outras Receitas Operacionais', ordem: 4 };
  }

  // DESPESAS
  // 1. Custos Diretos / CMV / CSP (avaliados antes para não colidir com tributos)
  if (cat.includes('comiss') || cat.includes('repasse') || cat.includes('barbeiro') || cat.includes('diária técnica') || cat.includes('csp')) {
    return { subgrupo: 'custo_csp', rotulo: '4.2 Custo dos Serviços Prestados (CSP) / Comissões', ordem: 42 };
  }
  if (cat.includes('fornecedor') || cat.includes('compra de mercadoria') || cat.includes('mercadoria') || cat.includes('estoque') || cat.includes('insumo') || cat.includes('cmv') || orig === 'nfe_compra') {
    return { subgrupo: 'custo_cmv', rotulo: '4.1 Custo das Mercadorias Vendidas (CMV) / Insumos', ordem: 41 };
  }
  // 2. Deduções da Receita Bruta
  if (cat.includes('estorno') || cat.includes('devolu') || cat.includes('cancelamento')) {
    return { subgrupo: 'deducoes_devolucoes', rotulo: '2.1 Devoluções e Cancelamentos', ordem: 21 };
  }
  if (cat.includes('taxa') || cat.includes('cartão') || cat.includes('cartao') || cat.includes('maquin') || cat.includes('asaas') || cat.includes('split') || cat.includes('gateway')) {
    return { subgrupo: 'deducoes_taxas', rotulo: '2.2 Taxas de Intermediação & Adquirência', ordem: 22 };
  }
  if (cat.includes('imposto') || cat.includes('tributo') || cat.includes('simples nacional') || cat.includes('simples') || cat.includes('icms') || /\\biss\\b/i.test(cat) || cat.includes('issqn') || cat.includes('pis') || cat.includes('cofins')) {
    return { subgrupo: 'deducoes_tributos', rotulo: '2.3 Tributos e Impostos sobre Vendas', ordem: 23 };
  }
  if (cat.includes('desconto') || cat.includes('abatimento')) {
    return { subgrupo: 'deducoes_descontos', rotulo: '2.4 Descontos Concedidos e Abatimentos', ordem: 24 };
  }
  // Despesas Operacionais
  if (cat.includes('salário') || cat.includes('salario') || cat.includes('folha') || cat.includes('pessoal') || cat.includes('pró-labore') || cat.includes('pro-labore') || cat.includes('encargo') || cat.includes('fgts') || cat.includes('inss')) {
    return { subgrupo: 'despesa_pessoal', rotulo: '6.1 Despesas com Pessoal & Pró-labore', ordem: 61 };
  }
  if (cat.includes('aluguel') || cat.includes('condomínio') || cat.includes('condominio') || cat.includes('energia') || cat.includes('luz') || cat.includes('água') || cat.includes('agua') || cat.includes('internet') || cat.includes('telefonia') || cat.includes('iptu')) {
    return { subgrupo: 'despesa_ocupacao', rotulo: '6.2 Ocupação, Utilidades & Instalações', ordem: 62 };
  }
  if (cat.includes('marketing') || cat.includes('tráfego') || cat.includes('trafego') || cat.includes('anúncio') || cat.includes('anuncio') || cat.includes('propaganda') || cat.includes('publicidade') || cat.includes('redes sociais')) {
    return { subgrupo: 'despesa_marketing', rotulo: '6.3 Comercial, Marketing & Tráfego Pago', ordem: 63 };
  }
  if (cat.includes('software') || cat.includes('sistema') || cat.includes('assinatura') || cat.includes('manutenção') || cat.includes('manutencao') || cat.includes('contabilidade') || cat.includes('jurídico') || cat.includes('juridico') || cat.includes('segurança')) {
    return { subgrupo: 'despesa_administrativa', rotulo: '6.4 Administrativas, Sistemas & Honorários', ordem: 64 };
  }
  if (cat.includes('juros') || cat.includes('tarifa') || cat.includes('bancária') || cat.includes('bancaria') || cat.includes('iof') || cat.includes('antecipação') || cat.includes('antecipacao')) {
    return { subgrupo: 'despesa_financeira', rotulo: '8.2 Despesas Financeiras & Juros', ordem: 82 };
  }
  if (cat.includes('investimento') || cat.includes('reforma') || cat.includes('ativo') || cat.includes('equipamento') || cat.includes('máquina') || cat.includes('maquina')) {
    return { subgrupo: 'investimentos', rotulo: '13. Investimentos & Ativos Imobilizados', ordem: 130 };
  }

  return { subgrupo: 'despesa_geral', rotulo: '6.5 Outras Despesas Operacionais', ordem: 65 };
}

/**
 * Coleta lançamentos do PostgreSQL com fallback automático para o store em memória.
 */
async function coletarLancamentos({ db, empresaId, de, ate, regime = 'competencia', lojaId = null, centroCustoId = null }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const inicio = exigirData(de, 'De');
  const fim = exigirData(ate, 'Até');

  let itens = [];

  // Tenta consultar no PostgreSQL primeiro
  if (db && typeof db.query === 'function') {
    try {
      const temTabela = (await db.query("SELECT to_regclass('fin_lancamentos') AS t")).rows[0]?.t;
      if (temTabela) {
        const campoData = regime === 'caixa' ? "l.pago_em::date" : "l.data_competencia";
        const condStatus = regime === 'caixa' ? "l.status = 'pago'" : "l.status <> 'cancelado'";
        const v = [empresa, inicio, fim];
        let filtroUnidade = '';
        if (lojaId) {
          v.push(lojaId);
          filtroUnidade = ` AND (l.loja_id = $${v.length} OR l.loja_id IS NULL)`;
        }
        let filtroCentro = '';
        if (centroCustoId) {
          v.push(centroCustoId);
          filtroCentro = ` AND l.centro_custo_id = $${v.length}`;
        }

        const sql = `
          SELECT l.id, l.tipo, l.categoria, l.descricao, l.valor, l.data_competencia, l.vencimento,
                 l.pago_em, l.status, l.origem, l.meio_pagamento, c.grupo_dre
            FROM fin_lancamentos l
            LEFT JOIN fin_categorias c ON c.empresa_id = l.empresa_id AND c.tipo = l.tipo AND c.nome = l.categoria
           WHERE l.empresa_id = $1
             AND ${condStatus}
             AND ${campoData} BETWEEN $2 AND $3
             ${filtroUnidade}
             ${filtroCentro}
           ORDER BY ${campoData} ASC
        `;
        const res = await db.query(sql, v);
        itens = res.rows.map(r => ({
          id: r.id,
          tipo: r.tipo,
          categoria: r.categoria,
          descricao: r.descricao,
          valor: Number(r.valor || 0),
          dataCompetencia: r.data_competencia ? String(r.data_competencia).slice(0, 10) : null,
          vencimento: r.vencimento ? String(r.vencimento).slice(0, 10) : null,
          pagoEm: r.pago_em ? String(r.pago_em).slice(0, 10) : null,
          status: r.status,
          origem: r.origem,
          meioPagamento: r.meio_pagamento,
          grupoDreConfigurado: r.grupo_dre
        }));
      }
    } catch (e) {
      console.warn('[dre-servico] Falha ao consultar PostgreSQL, recorrendo ao fallback:', e.message);
    }
  }

  // Se o PostgreSQL não retornou nada ou não estiver configurado, usa financeiroKytto
  if (!itens.length && financeiroKytto && typeof financeiroKytto.listarLancamentos === 'function') {
    const todos = financeiroKytto.listarLancamentos(empresa, { lojaId });
    for (const item of todos) {
      if (item.status === 'cancelado') continue;
      const refData = regime === 'caixa'
        ? String(item.pagoEm || '').slice(0, 10)
        : String(item.dataCompetencia || item.vencimento || item.pagoEm || item.dataOperacao || '').slice(0, 10);

      if (!refData) continue;
      if (refData < inicio || refData > fim) continue;
      if (regime === 'caixa' && item.status !== 'pago') continue;

      itens.push({
        id: item.id,
        tipo: item.tipo,
        categoria: item.categoria || 'Outros',
        descricao: item.descricao || '',
        valor: Number(item.valor || 0),
        dataCompetencia: String(item.dataCompetencia || item.vencimento || '').slice(0, 10),
        vencimento: String(item.vencimento || '').slice(0, 10),
        pagoEm: String(item.pagoEm || '').slice(0, 10),
        status: item.status,
        origem: item.origem || 'manual',
        meioPagamento: item.meioPagamento || 'outros',
        grupoDreConfigurado: null
      });
    }
  }

  return itens;
}

/**
 * Calcula a DRE completa para um período específico.
 */
export async function calcularDreCompleta(db, empresaId, {
  de = null,
  ate = null,
  mes = null,
  ano = null,
  regime = 'competencia',
  lojaId = null,
  centroCustoId = null
} = {}) {
  const agora = new Date();
  let dataInicio = de;
  let dataFim = ate;

  if (mes) {
    const [y, m] = mes.split('-').map(Number);
    const ultimoDia = new Date(y, m, 0).getDate();
    dataInicio = `${mes}-01`;
    dataFim = `${mes}-${String(ultimoDia).padStart(2, '0')}`;
  } else if (ano) {
    dataInicio = `${ano}-01-01`;
    dataFim = `${ano}-12-31`;
  } else if (!dataInicio || !dataFim) {
    const y = agora.getFullYear();
    const m = String(agora.getMonth() + 1).padStart(2, '0');
    const ultimoDia = new Date(y, agora.getMonth() + 1, 0).getDate();
    dataInicio = `${y}-${m}-01`;
    dataFim = `${y}-${m}-${String(ultimoDia).padStart(2, '0')}`;
  }

  const lancamentos = await coletarLancamentos({
    db, empresaId, de: dataInicio, ate: dataFim, regime, lojaId, centroCustoId
  });

  // Estrutura acumuladora por subgrupos
  const acumuladores = {
    receita_servicos: { rotulo: '1.1 Venda de Serviços', total: 0, linhas: {} },
    receita_produtos: { rotulo: '1.2 Venda de Mercadorias / Produtos', total: 0, linhas: {} },
    receita_planos: { rotulo: '1.3 Mensalidades, Planos & Clubes', total: 0, linhas: {} },
    receita_outras: { rotulo: '1.4 Outras Receitas Operacionais', total: 0, linhas: {} },

    deducoes_devolucoes: { rotulo: '2.1 Devoluções e Cancelamentos', total: 0, linhas: {} },
    deducoes_taxas: { rotulo: '2.2 Taxas de Intermediação & Adquirência', total: 0, linhas: {} },
    deducoes_tributos: { rotulo: '2.3 Tributos e Impostos sobre Vendas', total: 0, linhas: {} },
    deducoes_descontos: { rotulo: '2.4 Descontos Concedidos e Abatimentos', total: 0, linhas: {} },

    custo_cmv: { rotulo: '4.1 Custo das Mercadorias Vendidas (CMV) / Insumos', total: 0, linhas: {} },
    custo_csp: { rotulo: '4.2 Custo dos Serviços Prestados (CSP) / Comissões', total: 0, linhas: {} },

    despesa_pessoal: { rotulo: '6.1 Despesas com Pessoal & Pró-labore', total: 0, linhas: {} },
    despesa_ocupacao: { rotulo: '6.2 Ocupação, Utilidades & Instalações', total: 0, linhas: {} },
    despesa_marketing: { rotulo: '6.3 Comercial, Marketing & Tráfego Pago', total: 0, linhas: {} },
    despesa_administrativa: { rotulo: '6.4 Administrativas, Sistemas & Honorários', total: 0, linhas: {} },
    despesa_geral: { rotulo: '6.5 Outras Despesas Operacionais', total: 0, linhas: {} },

    receita_financeira: { rotulo: '8.1 Receitas Financeiras (Juros / Descontos Obtidos)', total: 0, linhas: {} },
    despesa_financeira: { rotulo: '8.2 Despesas Financeiras & Tarifas Bancárias', total: 0, linhas: {} },

    investimentos: { rotulo: '13. Investimentos & Ativos Imobilizados', total: 0, linhas: {} }
  };

  for (const l of lancamentos) {
    const classif = classificarCategoriaDRE(l.tipo, l.categoria, l.origem);
    const alvo = acumuladores[classif.subgrupo] || acumuladores.despesa_geral;
    const cat = l.categoria || 'Não Categorizado';

    alvo.total = dinheiro(alvo.total + l.valor);
    alvo.linhas[cat] = dinheiro((alvo.linhas[cat] || 0) + l.valor);
  }

  // 1. Receita Operacional Bruta
  const receitaBruta = dinheiro(
    acumuladores.receita_servicos.total +
    acumuladores.receita_produtos.total +
    acumuladores.receita_planos.total +
    acumuladores.receita_outras.total
  );

  // 2. Deduções
  const totalDeducoes = dinheiro(
    acumuladores.deducoes_devolucoes.total +
    acumuladores.deducoes_taxas.total +
    acumuladores.deducoes_tributos.total +
    acumuladores.deducoes_descontos.total
  );

  // 3. Receita Operacional Líquida (ROL)
  const receitaLiquida = dinheiro(receitaBruta - totalDeducoes);

  // 4. Custos Diretos
  const totalCustos = dinheiro(
    acumuladores.custo_cmv.total +
    acumuladores.custo_csp.total
  );

  // 5. Lucro Bruto
  const lucroBruto = dinheiro(receitaLiquida - totalCustos);
  const margemBrutaPct = receitaBruta > 0 ? Number(((lucroBruto / receitaBruta) * 100).toFixed(1)) : 0;

  // 6. Despesas Operacionais
  const totalDespesasOperacionais = dinheiro(
    acumuladores.despesa_pessoal.total +
    acumuladores.despesa_ocupacao.total +
    acumuladores.despesa_marketing.total +
    acumuladores.despesa_administrativa.total +
    acumuladores.despesa_geral.total
  );

  // 7. EBITDA / LAJIDA
  const ebitda = dinheiro(lucroBruto - totalDespesasOperacionais);
  const margemEbitdaPct = receitaBruta > 0 ? Number(((ebitda / receitaBruta) * 100).toFixed(1)) : 0;

  // 8. Resultado Financeiro
  const resultadoFinanceiro = dinheiro(
    acumuladores.receita_financeira.total - acumuladores.despesa_financeira.total
  );

  // 9. LAIR
  const lair = dinheiro(ebitda + resultadoFinanceiro);

  // 10. Provisão Tributos sobre o Lucro
  const impostosSobreLucro = 0; // se aplicável a Lucro Real / Presumido

  // 11. Resultado Líquido
  const resultadoLiquido = dinheiro(lair - impostosSobreLucro);
  const margemLiquidaPct = receitaBruta > 0 ? Number(((resultadoLiquido / receitaBruta) * 100).toFixed(1)) : 0;

  // 12. Ponto de Equilíbrio Operacional (Break-even Point)
  // Custos Fixos / (Margem de Contribuição / Receita Bruta)
  const margemContribuicao = dinheiro(receitaLiquida - totalCustos);
  const mcFator = receitaBruta > 0 ? (margemContribuicao / receitaBruta) : 0;
  const pontoEquilibrio = mcFator > 0 ? dinheiro(totalDespesasOperacionais / mcFator) : 0;

  // Montagem da árvore hierárquica contábil
  const fmtLinhas = (mapObj) => Object.entries(mapObj)
    .map(([cat, val]) => ({ categoria: cat, valor: val }))
    .sort((a, b) => b.valor - a.valor);

  const calcAv = (val) => receitaBruta > 0 ? Number(((val / receitaBruta) * 100).toFixed(1)) : 0;

  const linhas = [
    // 1. Receita Bruta
    {
      codigo: '1',
      grupo: 'receita_bruta',
      descricao: '1. RECEITA OPERACIONAL BRUTA',
      valor: receitaBruta,
      av: 100.0,
      tipo: 'receita',
      natureza: 'sintetica',
      destaque: true,
      filhos: [
        { codigo: '1.1', descricao: '1.1 Venda de Serviços', valor: acumuladores.receita_servicos.total, av: calcAv(acumuladores.receita_servicos.total), detalhe: fmtLinhas(acumuladores.receita_servicos.linhas) },
        { codigo: '1.2', descricao: '1.2 Venda de Mercadorias / Produtos', valor: acumuladores.receita_produtos.total, av: calcAv(acumuladores.receita_produtos.total), detalhe: fmtLinhas(acumuladores.receita_produtos.linhas) },
        { codigo: '1.3', descricao: '1.3 Mensalidades, Planos & Clubes', valor: acumuladores.receita_planos.total, av: calcAv(acumuladores.receita_planos.total), detalhe: fmtLinhas(acumuladores.receita_planos.linhas) },
        { codigo: '1.4', descricao: '1.4 Outras Receitas Operacionais', valor: acumuladores.receita_outras.total, av: calcAv(acumuladores.receita_outras.total), detalhe: fmtLinhas(acumuladores.receita_outras.linhas) },
      ]
    },
    // 2. Deduções
    {
      codigo: '2',
      grupo: 'deducoes',
      descricao: '2. (-) DEDUÇÕES DA RECEITA BRUTA',
      valor: -totalDeducoes,
      av: -calcAv(totalDeducoes),
      tipo: 'deducao',
      natureza: 'sintetica',
      destaque: false,
      filhos: [
        { codigo: '2.1', descricao: '2.1 Devoluções e Cancelamentos', valor: -acumuladores.deducoes_devolucoes.total, av: -calcAv(acumuladores.deducoes_devolucoes.total), detalhe: fmtLinhas(acumuladores.deducoes_devolucoes.linhas) },
        { codigo: '2.2', descricao: '2.2 Taxas de Intermediação & Meios de Pagamento', valor: -acumuladores.deducoes_taxas.total, av: -calcAv(acumuladores.deducoes_taxas.total), detalhe: fmtLinhas(acumuladores.deducoes_taxas.linhas) },
        { codigo: '2.3', descricao: '2.3 Tributos e Impostos sobre Vendas', valor: -acumuladores.deducoes_tributos.total, av: -calcAv(acumuladores.deducoes_tributos.total), detalhe: fmtLinhas(acumuladores.deducoes_tributos.linhas) },
        { codigo: '2.4', descricao: '2.4 Descontos Concedidos e Abatimentos', valor: -acumuladores.deducoes_descontos.total, av: -calcAv(acumuladores.deducoes_descontos.total), detalhe: fmtLinhas(acumuladores.deducoes_descontos.linhas) },
      ]
    },
    // 3. Receita Líquida
    {
      codigo: '3',
      grupo: 'receita_liquida',
      descricao: '3. (=) RECEITA OPERACIONAL LÍQUIDA (ROL)',
      valor: receitaLiquida,
      av: calcAv(receitaLiquida),
      tipo: 'subtotal',
      natureza: 'sintetica',
      destaque: true
    },
    // 4. Custos
    {
      codigo: '4',
      grupo: 'custos',
      descricao: '4. (-) CUSTOS DAS VENDAS (CPV / CMV / CSP)',
      valor: -totalCustos,
      av: -calcAv(totalCustos),
      tipo: 'custo',
      natureza: 'sintetica',
      destaque: false,
      filhos: [
        { codigo: '4.1', descricao: '4.1 Custo das Mercadorias Vendidas (CMV) / Insumos', valor: -acumuladores.custo_cmv.total, av: -calcAv(acumuladores.custo_cmv.total), detalhe: fmtLinhas(acumuladores.custo_cmv.linhas) },
        { codigo: '4.2', descricao: '4.2 Custo dos Serviços Prestados (CSP) / Comissões', valor: -acumuladores.custo_csp.total, av: -calcAv(acumuladores.custo_csp.total), detalhe: fmtLinhas(acumuladores.custo_csp.linhas) },
      ]
    },
    // 5. Lucro Bruto
    {
      codigo: '5',
      grupo: 'lucro_bruto',
      descricao: `5. (=) LUCRO BRUTO (Margem Bruta: ${margemBrutaPct}%)`,
      valor: lucroBruto,
      av: calcAv(lucroBruto),
      tipo: 'subtotal',
      natureza: 'sintetica',
      destaque: true
    },
    // 6. Despesas Operacionais
    {
      codigo: '6',
      grupo: 'despesas_operacionais',
      descricao: '6. (-) DESPESAS OPERACIONAIS FIXAS & ADMINISTRATIVAS',
      valor: -totalDespesasOperacionais,
      av: -calcAv(totalDespesasOperacionais),
      tipo: 'despesa',
      natureza: 'sintetica',
      destaque: false,
      filhos: [
        { codigo: '6.1', descricao: '6.1 Despesas com Pessoal & Pró-labore', valor: -acumuladores.despesa_pessoal.total, av: -calcAv(acumuladores.despesa_pessoal.total), detalhe: fmtLinhas(acumuladores.despesa_pessoal.linhas) },
        { codigo: '6.2', descricao: '6.2 Ocupação, Utilidades & Instalações', valor: -acumuladores.despesa_ocupacao.total, av: -calcAv(acumuladores.despesa_ocupacao.total), detalhe: fmtLinhas(acumuladores.despesa_ocupacao.linhas) },
        { codigo: '6.3', descricao: '6.3 Comercial, Marketing & Tráfego Pago', valor: -acumuladores.despesa_marketing.total, av: -calcAv(acumuladores.despesa_marketing.total), detalhe: fmtLinhas(acumuladores.despesa_marketing.linhas) },
        { codigo: '6.4', descricao: '6.4 Administrativas, Softwares & Honorários', valor: -acumuladores.despesa_administrativa.total, av: -calcAv(acumuladores.despesa_administrativa.total), detalhe: fmtLinhas(acumuladores.despesa_administrativa.linhas) },
        { codigo: '6.5', descricao: '6.5 Outras Despesas Operacionais', valor: -acumuladores.despesa_geral.total, av: -calcAv(acumuladores.despesa_geral.total), detalhe: fmtLinhas(acumuladores.despesa_geral.linhas) },
      ]
    },
    // 7. EBITDA
    {
      codigo: '7',
      grupo: 'ebitda',
      descricao: `7. (=) EBITDA / LAJIDA (Margem EBITDA: ${margemEbitdaPct}%)`,
      valor: ebitda,
      av: calcAv(ebitda),
      tipo: 'subtotal',
      natureza: 'sintetica',
      destaque: true
    },
    // 8. Resultado Financeiro
    {
      codigo: '8',
      grupo: 'resultado_financeiro',
      descricao: '8. (+/-) RESULTADO FINANCEIRO LÍQUIDO',
      valor: resultadoFinanceiro,
      av: calcAv(resultadoFinanceiro),
      tipo: 'financeiro',
      natureza: 'sintetica',
      destaque: false,
      filhos: [
        { codigo: '8.1', descricao: '8.1 (+) Receitas Financeiras (Juros / Rendimentos)', valor: acumuladores.receita_financeira.total, av: calcAv(acumuladores.receita_financeira.total), detalhe: fmtLinhas(acumuladores.receita_financeira.linhas) },
        { codigo: '8.2', descricao: '8.2 (-) Despesas Financeiras & Tarifas Bancárias', valor: -acumuladores.despesa_financeira.total, av: -calcAv(acumuladores.despesa_financeira.total), detalhe: fmtLinhas(acumuladores.despesa_financeira.linhas) },
      ]
    },
    // 9. LAIR
    {
      codigo: '9',
      grupo: 'lair',
      descricao: '9. (=) RESULTADO ANTES DOS TRIBUTOS (LAIR)',
      valor: lair,
      av: calcAv(lair),
      tipo: 'subtotal',
      natureza: 'sintetica',
      destaque: true
    },
    // 10. Provisão de Tributos
    {
      codigo: '10',
      grupo: 'impostos_lucro',
      descricao: '10. (-) PROVISÃO PARA IRPJ E CSLL',
      valor: -impostosSobreLucro,
      av: -calcAv(impostosSobreLucro),
      tipo: 'deducao',
      natureza: 'sintetica',
      destaque: false
    },
    // 11. Lucro Líquido
    {
      codigo: '11',
      grupo: 'lucro_liquido',
      descricao: `11. (=) RESULTADO LÍQUIDO DO EXERCÍCIO (Margem Líquida: ${margemLiquidaPct}%)`,
      valor: resultadoLiquido,
      av: calcAv(resultadoLiquido),
      tipo: 'resultado_final',
      natureza: 'sintetica',
      destaque: true
    }
  ];

  // Gráficos e Composição
  const composicaoReceita = [
    { nome: 'Serviços', valor: acumuladores.receita_servicos.total, pct: calcAv(acumuladores.receita_servicos.total) },
    { nome: 'Mercadorias / Produtos', valor: acumuladores.receita_produtos.total, pct: calcAv(acumuladores.receita_produtos.total) },
    { nome: 'Planos & Clubes', valor: acumuladores.receita_planos.total, pct: calcAv(acumuladores.receita_planos.total) },
    { nome: 'Outras Receitas', valor: acumuladores.receita_outras.total, pct: calcAv(acumuladores.receita_outras.total) },
  ].filter(i => i.valor > 0);

  const composicaoCustosDespesas = [
    { nome: 'Custos Diretos (CMV / Insumos)', valor: acumuladores.custo_cmv.total, cor: '#f87171' },
    { nome: 'Comissões de Atendimento (CSP)', valor: acumuladores.custo_csp.total, cor: '#fb923c' },
    { nome: 'Pessoal & Pró-labore', valor: acumuladores.despesa_pessoal.total, cor: '#fbbf24' },
    { nome: 'Ocupação & Instalações', valor: acumuladores.despesa_ocupacao.total, cor: '#60a5fa' },
    { nome: 'Marketing & Tráfego', valor: acumuladores.despesa_marketing.total, cor: '#c084fc' },
    { nome: 'Administrativo & Sistemas', valor: acumuladores.despesa_administrativa.total, cor: '#34d399' },
    { nome: 'Taxas & Meios de Pagamento', valor: acumuladores.deducoes_taxas.total, cor: '#f43f5e' },
    { nome: 'Impostos & Tributos', valor: acumuladores.deducoes_tributos.total, cor: '#e879f9' },
  ].filter(i => i.valor > 0);

  return {
    periodo: {
      de: dataInicio,
      ate: dataFim,
      mes: mes || dataInicio.slice(0, 7),
      ano: ano || dataInicio.slice(0, 4),
      regime
    },
    resumo: {
      receitaBruta,
      totalDeducoes,
      receitaLiquida,
      totalCustos,
      lucroBruto,
      margemBrutaPct,
      totalDespesasOperacionais,
      ebitda,
      margemEbitdaPct,
      resultadoFinanceiro,
      lair,
      resultadoLiquido,
      margemLiquidaPct,
      pontoEquilibrio,
      investimentos: acumuladores.investimentos.total,
      totalLancamentosApurados: lancamentos.length
    },
    linhas,
    graficos: {
      composicaoReceita,
      composicaoCustosDespesas
    }
  };
}

/**
 * Calcula a DRE Anual Comparativa (12 Meses Jan-Dez + Total YTD) para a empresa.
 */
export async function calcularDreAnual12Meses(db, empresaId, {
  ano = new Date().getFullYear(),
  regime = 'competencia',
  lojaId = null
} = {}) {
  const y = Number(ano) || new Date().getFullYear();
  const meses = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`);

  const colunasMeses = [];
  for (const mesStr of meses) {
    const d = await calcularDreCompleta(db, empresaId, { mes: mesStr, regime, lojaId });
    colunasMeses.push({
      mes: mesStr,
      nomeMes: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][Number(mesStr.slice(5, 7)) - 1],
      resumo: d.resumo,
      linhas: d.linhas
    });
  }

  // Acumulado do ano completo (YTD)
  const totalAno = await calcularDreCompleta(db, empresaId, { ano: y, regime, lojaId });

  return {
    ano: y,
    regime,
    meses: colunasMeses,
    totalAno
  };
}

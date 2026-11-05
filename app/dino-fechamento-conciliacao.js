// ============================================================================
// DINO FECHAMENTO CONCILIAÇÃO - MÓDULO INTEGRADO DE FECHAMENTO E GESTÃO
// ============================================================================
// Realiza a conciliação completa entre o Fechamento Diário da Operação de Caixa
// (Balcão, Gavetas Físicas, Comandas, Meios) e o Fechamento do ERP Financeiro
// Central (Livro-Caixa, Despesas, Contas a Pagar/Receber, DRE e Saldos).
// ============================================================================

import * as caixaKytto from './caixa-diario-kytto.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';
import * as financeiroKytto from './financeiro-central-kytto.js';
import * as clientesKytto from './clientes-contas-kytto.js';
import { db, save } from './db.js';

export const DINO_EMPRESA_CANONICA = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

function dataHojeIso() {
  const agora = new Date();
  return agora.toLocaleDateString('sv', { timeZone: 'America/Cuiaba' });
}

function normalizarMeio(meioBruto = '') {
  const m = String(meioBruto || '').toLowerCase().trim();
  if (['debito', 'cartao_debito', 'cartao debito'].includes(m)) return 'cartao_debito';
  if (['credito', 'cartao_credito', 'cartao credito', 'cartao'].includes(m)) return 'cartao_credito';
  if (['pix'].includes(m)) return 'pix';
  if (['dinheiro'].includes(m)) return 'dinheiro';
  if (['conta', 'fiado', 'dividas', 'divida'].includes(m)) return 'conta';
  if (['cheque'].includes(m)) return 'cheque';
  if (['voucher', 'cortesia', 'permuta', 'fidelidade', 'plano'].includes(m)) return 'plano';
  return 'outros';
}

function labelMeio(meio) {
  const mapa = {
    dinheiro: 'Dinheiro Físico',
    pix: 'Pix Instantâneo',
    cartao_debito: 'Cartão de Débito',
    cartao_credito: 'Cartão de Crédito',
    conta: 'Lançado em Conta (Crediário)',
    cheque: 'Cheque',
    plano: 'Cobertura de Plano / Cortesia',
    outros: 'Outros Meios',
  };
  return mapa[meio] || meio;
}

export function obterFechamentoDiarioEConciliacao(empresaId, dataParam, options = {}) {
  const empresa = String(empresaId || DINO_EMPRESA_CANONICA).trim();
  const data = dataParam ? String(dataParam).slice(0, 10) : dataHojeIso();
  const lojaId = options.lojaId || undefined;

  // 1. DADOS DOS CAIXAS OPERACIONAIS
  const caixas = caixaKytto.listarCaixas(empresa, { data, lojaId }) || [];
  const caixasAbertos = caixas.filter((c) => c.status === 'aberto');
  const caixasFechados = caixas.filter((c) => c.status === 'fechado');
  const totalAbertura = Number(caixas.reduce((soma, c) => soma + Number(c.valorAbertura || 0), 0).toFixed(2));

  // Movimentos de gaveta (sangrias e suprimentos) de todos os caixas da data
  const movimentosTodos = caixas.flatMap((c) => caixaKytto.movimentosDoCaixa(empresa, c.id) || []);
  const totalSangriasCaixa = Number(movimentosTodos.filter((m) => m.tipo === 'sangria').reduce((soma, m) => soma + Number(m.valor || 0), 0).toFixed(2));
  const totalSuprimentosCaixa = Number(movimentosTodos.filter((m) => m.tipo === 'suprimento').reduce((soma, m) => soma + Number(m.valor || 0), 0).toFixed(2));
  const totalRecebimentosDinheiroGaveta = Number(movimentosTodos.filter((m) => m.tipo === 'recebimento').reduce((soma, m) => soma + Number(m.valor || 0), 0).toFixed(2));

  // 2. DADOS DAS COMANDAS DO DIA (OPERAÇÃO)
  const comandas = barbeariaErpKytto.listarComandasBarbearia(empresa, { data, lojaId }) || [];
  const comandasAtivas = comandas.filter((c) => c.status !== 'cancelada');
  const comandasFechadas = comandas.filter((c) => ['paga', 'em_conta'].includes(c.status));
  const comandasAbertas = comandas.filter((c) => ['aberta', 'aguardando_pagamento', 'parcialmente_paga'].includes(c.status));

  // Faturamento e itens
  const faturamentoComandas = Number(comandasAtivas.reduce((soma, c) => soma + Number(c.totalFaturado ?? c.total ?? 0), 0).toFixed(2));
  
  const servicosRealizados = comandasAtivas.flatMap((c) => c.itens || []).filter((i) => i.tipo === 'servico' || i.tipo === 'pacote');
  const produtosVendidos = comandasAtivas.flatMap((c) => c.itens || []).filter((i) => i.tipo === 'produto');
  
  const valorServicos = Number(servicosRealizados.reduce((soma, i) => soma + Number(i.subtotal ?? (Number(i.preco || i.precoUnitario || 0) * Number(i.quantidade || 1))), 0).toFixed(2));
  const valorProdutos = Number(produtosVendidos.reduce((soma, i) => soma + Number(i.subtotal ?? (Number(i.preco || i.precoUnitario || 0) * Number(i.quantidade || 1))), 0).toFixed(2));

  // Pagamentos registrados nas comandas por meio normalizado
  const pagamentosOperacao = {
    dinheiro: 0,
    pix: 0,
    cartao_debito: 0,
    cartao_credito: 0,
    conta: 0,
    plano: 0,
    outros: 0,
  };

  const bandeirasCartao = {
    debito: {},
    credito: {},
  };

  for (const c of comandasAtivas) {
    for (const p of c.pagamentos || []) {
      const meioNorm = normalizarMeio(p.meio);
      const val = Number(p.valor || 0);
      pagamentosOperacao[meioNorm] = Number(((pagamentosOperacao[meioNorm] || 0) + val).toFixed(2));

      if (p.bandeira) {
        const bandKey = String(p.bandeira).trim();
        const tipoCartao = meioNorm === 'cartao_debito' ? 'debito' : 'credito';
        bandeirasCartao[tipoCartao][bandKey] = Number(((bandeirasCartao[tipoCartao][bandKey] || 0) + val).toFixed(2));
      }
    }
  }

  const totalRecebidoBalcao = Number((pagamentosOperacao.dinheiro + pagamentosOperacao.pix + pagamentosOperacao.cartao_debito + pagamentosOperacao.cartao_credito + pagamentosOperacao.outros).toFixed(2));
  const totalEmConta = pagamentosOperacao.conta;

  // 3. DADOS DO FINANCEIRO CENTRAL DO ERP (RAZÃO)
  const lancamentosErp = (financeiroKytto.listarLancamentos(empresa, { lojaId, incluirQuarentena: false }) || [])
    .filter((l) => {
      if (l.status === 'cancelado') return false;
      const dataOp = String(l.dataOperacao || l.criadoEm || l.pagoEm || '').slice(0, 10);
      const dataPag = String(l.pagoEm || '').slice(0, 10);
      const dataVenc = String(l.vencimento || '').slice(0, 10);
      return dataOp === data || dataPag === data || dataVenc === data;
    });

  const receitasPagasErp = lancamentosErp.filter((l) => l.tipo === 'receita' && l.status === 'pago');
  const despesasPagasErp = lancamentosErp.filter((l) => l.tipo === 'despesa' && l.status === 'pago');
  const contasReceberPendentesErp = lancamentosErp.filter((l) => l.tipo === 'receita' && l.status === 'pendente');
  const contasPagarPendentesErp = lancamentosErp.filter((l) => l.tipo === 'despesa' && l.status === 'pendente');

  const totalReceitasPagasErp = Number(receitasPagasErp.reduce((soma, l) => soma + Number(l.valor || 0), 0).toFixed(2));
  const totalDespesasPagasErp = Number(despesasPagasErp.reduce((soma, l) => soma + Number(l.valor || 0), 0).toFixed(2));
  const totalContasReceberPendentesErp = Number(contasReceberPendentesErp.reduce((soma, l) => soma + Number(l.valor || 0), 0).toFixed(2));
  const totalContasPagarPendentesErp = Number(contasPagarPendentesErp.reduce((soma, l) => soma + Number(l.valor || 0), 0).toFixed(2));

  // Mapeamento por meio de pagamento registrado no ERP
  const pagamentosErpPorMeio = {
    dinheiro: 0,
    pix: 0,
    cartao_debito: 0,
    cartao_credito: 0,
    conta: 0,
    outros: 0,
  };

  for (const l of receitasPagasErp) {
    const meioNorm = normalizarMeio(l.meioPagamento || l.meio);
    pagamentosErpPorMeio[meioNorm] = Number(((pagamentosErpPorMeio[meioNorm] || 0) + Number(l.valor || 0)).toFixed(2));
  }
  for (const l of contasReceberPendentesErp) {
    pagamentosErpPorMeio.conta = Number((pagamentosErpPorMeio.conta + Number(l.valor || 0)).toFixed(2));
  }

  // 4. MATRIZ DE CONCILIAÇÃO CAIXA OPERAÇÃO ⟷ ERP FINANCEIRO
  const itensConciliacao = [
    {
      chave: 'dinheiro',
      label: 'Dinheiro Físico',
      tipo: 'receita',
      operacao: pagamentosOperacao.dinheiro,
      erp: pagamentosErpPorMeio.dinheiro,
      esperadoGaveta: Number((totalAbertura + pagamentosOperacao.dinheiro + totalSuprimentosCaixa - totalSangriasCaixa).toFixed(2)),
      informadoGaveta: Number(caixas.reduce((soma, c) => soma + (c.valorFechamento != null ? Number(c.valorFechamento) : 0), 0).toFixed(2)),
    },
    {
      chave: 'pix',
      label: 'Pix Instantâneo',
      tipo: 'receita',
      operacao: pagamentosOperacao.pix,
      erp: pagamentosErpPorMeio.pix,
    },
    {
      chave: 'cartao_debito',
      label: 'Cartão de Débito',
      tipo: 'receita',
      operacao: pagamentosOperacao.cartao_debito,
      erp: pagamentosErpPorMeio.cartao_debito,
      bandeiras: bandeirasCartao.debito,
    },
    {
      chave: 'cartao_credito',
      label: 'Cartão de Crédito',
      tipo: 'receita',
      operacao: pagamentosOperacao.cartao_credito,
      erp: pagamentosErpPorMeio.cartao_credito,
      bandeiras: bandeirasCartao.credito,
    },
    {
      chave: 'conta',
      label: 'Lançado em Conta (Crediário)',
      tipo: 'receita',
      operacao: pagamentosOperacao.conta,
      erp: pagamentosErpPorMeio.conta,
    },
    {
      chave: 'sangrias',
      label: 'Sangrias / Retiradas de Caixa',
      tipo: 'movimento_caixa',
      operacao: totalSangriasCaixa,
      erp: totalSangriasCaixa,
    },
    {
      chave: 'suprimentos',
      label: 'Suprimentos de Fundo de Troco',
      tipo: 'movimento_caixa',
      operacao: totalSuprimentosCaixa,
      erp: totalSuprimentosCaixa,
    },
  ].map((item) => {
    const diferenca = Number((item.operacao - item.erp).toFixed(2));
    const conciliado = Math.abs(diferenca) < 0.05;
    return {
      ...item,
      diferenca,
      status: conciliado ? 'conciliado' : 'divergente',
    };
  });

  const totalDivergenciaReceitas = Number(itensConciliacao.filter((i) => i.tipo !== 'movimento_caixa').reduce((soma, i) => soma + Math.abs(i.diferenca), 0).toFixed(2));
  const totalQuebraCaixas = Number(caixas.reduce((soma, c) => soma + (c.diferencaFechamento != null ? Math.abs(Number(c.diferencaFechamento)) : 0), 0).toFixed(2));
  const totalDivergenciaValor = Number((totalDivergenciaReceitas + totalQuebraCaixas).toFixed(2));
  
  // Status Geral da Conciliação
  let statusGeral = 'conciliado';
  let mensagemStatus = 'Operação de caixa e lançamentos do ERP 100% conciliados e alinhados.';
  
  if (caixasAbertos.length > 0 || comandasAbertas.length > 0) {
    statusGeral = 'pendente';
    mensagemStatus = `Dia em operação: ${caixasAbertos.length} caixa(s) aberto(s) e ${comandasAbertas.length} comanda(s) em atendimento.`;
  } else if (totalDivergenciaValor > 0.05) {
    statusGeral = 'divergente';
    mensagemStatus = `Divergência apurada de R$ ${totalDivergenciaValor.toFixed(2)} entre o caixa operacional e o ERP.`;
  }

  // 5. FECHAMENTOS OFICIAIS REGISTRADOS
  const fechamentosOficiais = financeiroKytto.listarFechamentos(empresa, { lojaId }) || [];
  const fechamentoOficialDia = fechamentosOficiais.find((f) => String(f.data).slice(0, 10) === data) || null;
  const fechamentoClientesDia = clientesKytto.obterFechamentoDiario(empresa, data);

  // 6. CAIXAS DETALHADOS PARA AUDITORIA
  const caixasFormatados = caixas.map((c) => {
    const movsCaixa = movimentosTodos.filter((m) => m.caixaId === c.id);
    const sangs = movsCaixa.filter((m) => m.tipo === 'sangria').reduce((s, m) => s + Number(m.valor || 0), 0);
    const sups = movsCaixa.filter((m) => m.tipo === 'suprimento').reduce((s, m) => s + Number(m.valor || 0), 0);
    const recsDinheiro = movsCaixa.filter((m) => m.tipo === 'recebimento').reduce((s, m) => s + Number(m.valor || 0), 0);
    const esperado = Number((Number(c.valorAbertura || 0) + recsDinheiro + sups - sangs).toFixed(2));
    const informado = c.valorInformado != null ? Number(c.valorInformado) : (c.valorFechamento != null ? Number(c.valorFechamento) : null);
    const quebra = c.divergencia != null ? Number(c.divergencia) : (informado != null ? Number((informado - esperado).toFixed(2)) : null);

    return {
      id: c.id,
      numeroCaixa: c.numeroCaixa || 1,
      nomeCaixa: c.nomeCaixa || `Caixa ${c.numeroCaixa || 1}`,
      responsavel: c.responsavel || 'Operador',
      status: c.status,
      valorAbertura: Number(c.valorAbertura || 0),
      abertoEm: c.abertoEm,
      fechadoEm: c.fechadoEm,
      recebimentosDinheiro: recsDinheiro,
      sangrias: sangs,
      suprimentos: sups,
      valorEsperado: esperado,
      valorInformado: informado,
      quebraCaixa: quebra,
      observacao: c.observacao || '',
    };
  });

  return {
    ok: true,
    data,
    empresaId: empresa,
    lojaId: lojaId || null,
    statusGeral,
    mensagemStatus,
    fechamentoOficial: fechamentoOficialDia || fechamentoClientesDia || null,
    diaFechado: Boolean(fechamentoOficialDia || (caixas.length > 0 && caixas.every((c) => c.status === 'fechado'))),
    
    // KPIs de Gestão da Empresa
    kpisGestao: {
      faturamentoBruto: faturamentoComandas,
      totalRecebidoLiquido: totalRecebidoBalcao,
      totalEmConta,
      totalDespesasPagas: totalDespesasPagasErp,
      saldoLiquidoDia: Number((totalRecebidoBalcao - totalDespesasPagasErp).toFixed(2)),
      totalComandas: comandasAtivas.length,
      comandasFechadas: comandasFechadas.length,
      comandasAbertas: comandasAbertas.length,
      totalServicos: servicosRealizados.length,
      valorServicos,
      totalProdutos: produtosVendidos.reduce((s, i) => s + Number(i.quantidade || 1), 0),
      valorProdutos,
      contasReceberPendentes: totalContasReceberPendentesErp,
      contasPagarPendentes: totalContasPagarPendentesErp,
      totalCaixas: caixas.length,
      caixasAbertos: caixasAbertos.length,
      caixasFechados: caixasFechados.length,
      totalDivergencias: totalDivergenciaValor,
    },

    // Conciliação detalhada Meio a Meio
    conciliacao: itensConciliacao,

    // Caixas Operacionais
    caixas: caixasFormatados,

    // Comandas do Dia (resumo estruturado)
    comandas: comandas.map((c) => ({
      id: c.id,
      numeroComanda: c.numeroComanda,
      clienteNome: c.clienteNome || 'Cliente Eventual',
      clienteTelefone: c.clienteTelefone || '',
      profissionalNome: c.profissionalNome || 'Profissional',
      status: c.status,
      total: Number(c.total || 0),
      totalFaturado: Number(c.totalFaturado || c.total || 0),
      itensQuantidade: (c.itens || []).length,
      itensResumo: (c.itens || []).map((i) => `${i.nome} (${i.quantidade || 1}x)`).join(', '),
      pagamentos: (c.pagamentos || []).map((p) => ({ meio: p.meio, valor: p.valor, bandeira: p.bandeira || '' })),
      fechadaEm: c.fechadaEm || c.atualizadaEm || c.criadoEm,
    })),

    // Histórico de Fechamentos Recentes
    historicoFechamentos: fechamentosOficiais.slice(0, 30),
  };
}

export function executarFechamentoDiarioIntegrado(empresaId, dados = {}) {
  const empresa = String(empresaId || DINO_EMPRESA_CANONICA).trim();
  const data = dados.data ? String(dados.data).slice(0, 10) : dataHojeIso();
  const lojaId = dados.lojaId || undefined;
  const usuario = dados.usuario || dados.responsavel || 'Gerente / Sistema';

  // 1. Fechar caixas abertos da data se solicitado
  const caixas = caixaKytto.listarCaixas(empresa, { data, lojaId }) || [];
  const caixasAbertos = caixas.filter((c) => c.status === 'aberto');
  const caixasFechadosResultados = [];

  for (const c of caixasAbertos) {
    const movs = caixaKytto.movimentosDoCaixa(empresa, c.id) || [];
    const sangs = movs.filter((m) => m.tipo === 'sangria').reduce((s, m) => s + Number(m.valor || 0), 0);
    const sups = movs.filter((m) => m.tipo === 'suprimento').reduce((s, m) => s + Number(m.valor || 0), 0);
    const recsDin = movs.filter((m) => m.tipo === 'recebimento').reduce((s, m) => s + Number(m.valor || 0), 0);
    const esperado = Number((Number(c.valorAbertura || 0) + recsDin + sups - sangs).toFixed(2));
    
    // Se não informou valor contado específico para este caixa, assume o esperado conferido
    const valorInformado = dados.valoresCaixas?.[c.id] != null
      ? Number(dados.valoresCaixas[c.id])
      : esperado;

    const fech = caixaKytto.fecharCaixa(empresa, {
      caixaId: c.id,
      lojaId,
      valorInformado,
      observacao: dados.observacao || 'Fechamento diário unificado',
      usuario,
    });
    caixasFechadosResultados.push(fech);
  }

  // 2. Coleta o resumo conciliado completo
  const resumoConciliado = obterFechamentoDiarioEConciliacao(empresa, data, { lojaId });

  // 3. Registra o Fechamento no Financeiro Central do ERP
  const fechamentoFinanceiro = financeiroKytto.fecharDia(empresa, data, usuario, {
    lojaId,
    resumoOperacao: resumoConciliado.kpisGestao,
    conciliacao: resumoConciliado.conciliacao,
  });

  // 4. Registra no snapshot de clientes e contas
  let fechamentoClientes = clientesKytto.obterFechamentoDiario(empresa, data);
  if (!fechamentoClientes) {
    fechamentoClientes = clientesKytto.criarFechamentoDiario(empresa, {
      dataFechamento: data,
      responsavel: usuario,
      observacao: dados.observacao || 'Fechamento diário integrado e conciliado.',
      origem: 'gestao_fechamento_integrado',
    });
  }

  save();

  return {
    ok: true,
    data,
    empresaId: empresa,
    caixasFechados: caixasFechadosResultados.length,
    fechamentoFinanceiro,
    fechamentoClientes,
    resumo: resumoConciliado,
  };
}

export function reabrirFechamentoDiarioIntegrado(empresaId, dataParam, dados = {}) {
  const empresa = String(empresaId || DINO_EMPRESA_CANONICA).trim();
  const data = dataParam ? String(dataParam).slice(0, 10) : dataHojeIso();
  const usuario = dados.usuario || 'Gerente';

  // 1. Remove o fechamento do Financeiro Central
  const storeFin = db().financeiroKytto?.empresas?.[empresa];
  if (storeFin?.fechamentos) {
    const chaveLoja = dados.lojaId ? `${dados.lojaId}:${data}` : null;
    if (chaveLoja && storeFin.fechamentos[chaveLoja]) delete storeFin.fechamentos[chaveLoja];
    if (storeFin.fechamentos[`__legacy__:${data}`]) delete storeFin.fechamentos[`__legacy__:${data}`];
    if (storeFin.fechamentos[data]) delete storeFin.fechamentos[data];
  }

  // 2. Reabre caixas fechados da data se solicitado
  const caixas = caixaKytto.listarCaixas(empresa, { data, lojaId: dados.lojaId }) || [];
  const caixasReabertos = [];
  if (dados.reabrirCaixas !== false) {
    for (const c of caixas.filter((c) => c.status === 'fechado')) {
      caixaKytto.reabrirCaixa(empresa, {
        caixaId: c.id,
        lojaId: dados.lojaId,
        usuario,
        motivo: dados.motivo || 'Reabertura do fechamento diário integrado',
      });
      caixasReabertos.push(c.id);
    }
  }

  save();

  return {
    ok: true,
    data,
    reaberto: true,
    caixasReabertos: caixasReabertos.length,
  };
}

// ============================================================================
// DINO FECHAMENTO CONCILIAÇÃO - MÓDULO INTEGRADO MULTI-EMPRESA E GESTÃO ERP
// ============================================================================
// Realiza a conciliação completa entre o Fechamento Diário da Operação de Caixa
// (Balcão, Gavetas Físicas, Comandas, Vendas PDV, Meios) e o Fechamento do ERP
// Financeiro Central (Livro-Caixa, Despesas, Contas a Pagar/Receber, DRE e Saldos).
// Suporta todas as empresas do sistema Kytto (Dino Barbearia, Stallone, Agro, etc.)
// ============================================================================

import * as caixaKytto from './caixa-diario-kytto.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';
import * as financeiroKytto from './financeiro-central-kytto.js';
import * as clientesKytto from './clientes-contas-kytto.js';
import * as cadastrosMestres from './cadastros-mestres-kytto.js';
import { db, save } from './db.js';

export const DINO_EMPRESA_CANONICA = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

export const EMPRESAS_PREDEFINIDAS = [
  {
    id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    nome: 'Barbearia Dino',
    razaoSocial: 'DINO BARBEARIA LTDA',
    tipo: 'barbearia',
    slug: 'dino',
    cnpj: '14.229.191/0001-90',
    lojas: [
      { id: 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8', nome: 'Dino Matriz' }
    ]
  },
  {
    id: '31f70c83-9172-40c2-945f-9e793b5048be',
    nome: 'Stallone Nutre Sport',
    razaoSocial: 'E. P. DE SOUZA LTDA',
    tipo: 'varejo',
    slug: 'stallone',
    cnpj: '31.497.083/0001-95',
    lojas: [
      { id: '6a15e943-2570-4f29-a2d5-d900d2812911', nome: 'Stallone Matriz' }
    ]
  },
  {
    id: '2e041110-db20-4fd1-8278-12bd3dead008',
    nome: 'AGRO OPEN TTC',
    razaoSocial: 'AGRO OPEN TTC',
    tipo: 'bar',
    slug: 'agroopen',
    cnpj: '46.041.110/0001-20',
    lojas: [
      { id: '17b057ab-a13f-4fee-ae42-bc70578ec756', nome: 'Loja Web - AGRO OPEN' }
    ]
  },
  {
    id: 'emp-kytto-001',
    nome: 'Kytto Clube Tangará',
    razaoSocial: 'Kytto — Sistemas Inteligentes para Negócios',
    tipo: 'geral',
    slug: 'kytto',
    cnpj: '54.518.772/0001-49',
    lojas: [
      { id: 'loja-principal', nome: 'Sede Tangará' }
    ]
  }
];

export function listarEmpresasParaFechamento() {
  const mapa = new Map();
  for (const e of EMPRESAS_PREDEFINIDAS) {
    mapa.set(e.id, { ...e });
  }

  // Enriquecer com empresas de cadastros mestres
  try {
    const mestres = cadastrosMestres.listarEmpresas({ incluirInativas: false }) || [];
    for (const m of mestres) {
      if (m && m.id && !mapa.has(m.id)) {
        mapa.set(m.id, {
          id: m.id,
          nome: m.nome || m.nomeFantasia || 'Empresa',
          razaoSocial: m.nomeFantasia || m.nome || '',
          tipo: 'geral',
          slug: m.id,
          cnpj: m.cnpj || '',
          lojas: [{ id: `loja-${m.id}`, nome: 'Matriz' }]
        });
      }
    }
  } catch {}

  // Enriquecer com db().empresas se houver
  const d = db();
  if (Array.isArray(d.empresas)) {
    for (const e of d.empresas) {
      if (e && e.id && !mapa.has(e.id)) {
        mapa.set(e.id, {
          id: e.id,
          nome: e.nome || e.razaoSocial || 'Empresa',
          razaoSocial: e.razaoSocial || e.nome || '',
          tipo: e.tipo || e.tipoNegocio || 'geral',
          slug: e.slug || e.id,
          cnpj: e.cnpj || '',
          lojas: Array.isArray(e.lojas) && e.lojas.length ? e.lojas : [{ id: `loja-${e.id}`, nome: 'Matriz' }]
        });
      }
    }
  }

  return Array.from(mapa.values());
}

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
  let caixas = caixaKytto.listarCaixas(empresa, { data, lojaId }) || [];
  
  // Inclui caixas esquecidos/abertos de turnos anteriores que continuam aguardando fechamento
  const todosCaixasEmpresa = caixaKytto.listarCaixas(empresa, { lojaId }) || [];
  for (const c of todosCaixasEmpresa) {
    if (c.status === 'aberto' && !caixas.some((exist) => exist.id === c.id)) {
      caixas.push(c);
    }
  }

  const caixasAbertos = caixas.filter((c) => c.status === 'aberto');
  const caixasFechados = caixas.filter((c) => c.status === 'fechado');
  const totalAbertura = Number(caixas.reduce((soma, c) => soma + Number(c.valorAbertura || 0), 0).toFixed(2));

  // Movimentos de gaveta (sangrias e suprimentos) de todos os caixas da data
  const movimentosTodos = caixas.flatMap((c) => caixaKytto.movimentosDoCaixa(empresa, c.id) || []);
  const totalSangriasCaixa = Number(movimentosTodos.filter((m) => m.tipo === 'sangria').reduce((soma, m) => soma + Number(m.valor || 0), 0).toFixed(2));
  const totalSuprimentosCaixa = Number(movimentosTodos.filter((m) => m.tipo === 'suprimento').reduce((soma, m) => soma + Number(m.valor || 0), 0).toFixed(2));
  const totalRecebimentosDinheiroGaveta = Number(movimentosTodos.filter((m) => m.tipo === 'recebimento').reduce((soma, m) => soma + Number(m.valor || 0), 0).toFixed(2));

  // 2. DADOS DAS COMANDAS E VENDAS DO DIA (MÓDULOS DE BARBEARIA, BAR, PDV E VAREJO)
  const comandasBarbearia = barbeariaErpKytto.listarComandasBarbearia(empresa, { data, lojaId }) || [];
  
  const d = db();
  const comandasGerais = (d.comandas || []).concat(d.bar_comandas || []).filter((c) => {
    const empMatch = !c.empresaId || c.empresaId === empresa || (empresa === DINO_EMPRESA_CANONICA && c.empresaId === 'principal');
    if (!empMatch) return false;
    const dOp = String(c.fechadaEm || c.abertaEm || c.criadoEm || c.data || '').slice(0, 10);
    return dOp === data || (['aberta', 'aguardando_pagamento', 'parcialmente_paga'].includes(c.status) && dOp <= data);
  }).map((c) => ({
    id: String(c.id),
    numeroComanda: c.numero || c.numeroComanda || c.nome || String(c.id).slice(0, 8),
    clienteNome: c.clienteNome || c.cliente || 'Cliente Balcão',
    clienteTelefone: c.clienteTelefone || '',
    profissionalNome: c.atendente || c.operador || 'Operador Balcão',
    status: c.status || 'paga',
    total: Number(c.total || c.valorFinal || 0),
    totalFaturado: Number(c.total || c.valorFinal || 0),
    itens: (c.itens || []).map((i) => ({
      nome: i.nome || i.descricao || 'Item',
      quantidade: Number(i.qtd || i.quantidade || 1),
      preco: Number(i.preco || i.valorUnitario || i.valor || 0),
      tipo: i.tipo || 'produto'
    })),
    itensQuantidade: (c.itens || []).length,
    itensResumo: (c.itens || []).map((i) => `${i.nome || i.descricao} (${i.qtd || i.quantidade || 1}x)`).join(', '),
    pagamentos: Array.isArray(c.pagamentos) ? c.pagamentos : (c.meioPagamento ? [{ meio: c.meioPagamento, valor: c.total }] : []),
    fechadaEm: c.fechadaEm || c.criadoEm,
    moduloOrigem: 'Bar / Balcão',
  }));

  const vendasLoja = (d.vendasLoja || []).concat(d.vendas || []).filter((v) => {
    const empMatch = !v.empresaId || v.empresaId === empresa;
    if (!empMatch) return false;
    const dOp = String(v.data || v.criadoEm || v.fechadaEm || '').slice(0, 10);
    return dOp === data;
  }).map((v) => ({
    id: String(v.id),
    numeroComanda: `VENDA-${v.numero || String(v.id).slice(0, 6)}`,
    clienteNome: v.clienteNome || v.cliente?.nome || 'Cliente Loja',
    clienteTelefone: v.clienteTelefone || '',
    profissionalNome: v.vendedor || v.operador || 'Vendedor',
    status: v.status || 'paga',
    total: Number(v.total || v.valor || 0),
    totalFaturado: Number(v.total || v.valor || 0),
    itens: (v.itens || []).map((i) => ({
      nome: i.nome || i.produtoNome || 'Produto',
      quantidade: Number(i.quantidade || 1),
      preco: Number(i.precoUnitario || i.preco || 0),
      tipo: 'produto'
    })),
    itensQuantidade: (v.itens || []).length,
    itensResumo: (v.itens || []).map((i) => `${i.nome || i.produtoNome} (${i.quantidade || 1}x)`).join(', '),
    pagamentos: Array.isArray(v.pagamentos) ? v.pagamentos : [{ meio: v.formaPagamento || 'dinheiro', valor: v.total }],
    fechadaEm: v.data || v.criadoEm,
    moduloOrigem: 'Varejo / Loja',
  }));

  // Unifica todas as comandas e vendas sem duplicação
  const mapComandas = new Map();
  for (const c of comandasBarbearia) {
    mapComandas.set(String(c.id), {
      ...c,
      moduloOrigem: 'Barbearia / Serviços',
    });
  }
  for (const c of comandasGerais) {
    if (!mapComandas.has(c.id)) mapComandas.set(c.id, c);
  }
  for (const v of vendasLoja) {
    if (!mapComandas.has(v.id)) mapComandas.set(v.id, v);
  }

  const comandas = Array.from(mapComandas.values());
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
    mensagemStatus = `Dia em operação: ${caixasAbertos.length} caixa(s) aberto(s) e ${comandasAbertas.length} comanda(s)/venda(s) em aberto.`;
  } else if (totalDivergenciaValor > 0.05) {
    statusGeral = 'divergente';
    mensagemStatus = `Divergência apurada de R$ ${totalDivergenciaValor.toFixed(2)} entre o caixa operacional e o ERP.`;
  }

  // 5. HISTÓRICO CONSOLIDADO DE FECHAMENTOS (FINANCEIRO + CLIENTES + CAIXAS HISTÓRICOS)
  const fechamentosOficiais = financeiroKytto.listarFechamentos(empresa, { lojaId }) || [];
  const fechamentosClientes = clientesKytto.listarFechamentosDiarios?.(empresa) || [];
  
  const mapaFechamentosPorData = new Map();

  for (const f of fechamentosOficiais) {
    const diaF = String(f.data || '').slice(0, 10);
    if (!diaF) continue;
    mapaFechamentosPorData.set(diaF, {
      id: f.id || `fech-oficial-${empresa}-${diaF}`,
      data: diaF,
      origem: 'financeiro_central',
      responsavel: f.usuario || f.responsavel || 'Gerência',
      faturamentoBruto: Number(f.resumoOperacao?.faturamentoTotal ?? f.faturamento ?? 0),
      totalRecebidoLiquido: Number(f.resumoOperacao?.totalRecebidoBalcao ?? f.recebimentos ?? 0),
      totalDespesasPagas: Number(f.resumoOperacao?.totalDespesasPagas ?? f.despesas ?? 0),
      saldoLiquidoDia: Number(f.resumoOperacao?.saldoLiquidoDia ?? f.saldoLiquido ?? 0),
      caixasFechados: Number(f.resumoOperacao?.caixasFechados ?? 1),
      status: 'fechado_oficial',
      criadoEm: f.criadoEm || f.fechadoEm || diaF,
    });
  }

  for (const fc of fechamentosClientes) {
    const diaF = String(fc.data || '').slice(0, 10);
    if (!diaF || mapaFechamentosPorData.has(diaF)) continue;
    mapaFechamentosPorData.set(diaF, {
      id: fc.id || `fech-cli-${empresa}-${diaF}`,
      data: diaF,
      origem: 'modulo_clientes',
      responsavel: fc.usuario || 'Operador',
      faturamentoBruto: Number(fc.totalVendas ?? fc.faturamento ?? 0),
      totalRecebidoLiquido: Number(fc.totalRecebido ?? 0),
      totalDespesasPagas: Number(fc.totalDespesas ?? 0),
      saldoLiquidoDia: Number(fc.saldoFinal ?? 0),
      caixasFechados: 1,
      status: 'fechado',
      criadoEm: fc.criadoEm || diaF,
    });
  }

  // Agrupa todos os caixas com status 'fechado' na empresa para compor o histórico de dias encerrados
  const todosCaixasFechados = (caixaKytto.listarCaixas(empresa, { lojaId }) || []).filter((c) => c.status === 'fechado');
  const caixasPorDia = {};
  for (const c of todosCaixasFechados) {
    const diaC = String(c.data || c.fechadoEm || c.abertoEm || '').slice(0, 10);
    if (!diaC) continue;
    caixasPorDia[diaC] = caixasPorDia[diaC] || [];
    caixasPorDia[diaC].push(c);
  }

  for (const [diaC, caixasDoDia] of Object.entries(caixasPorDia)) {
    if (!mapaFechamentosPorData.has(diaC)) {
      const somaRecs = caixasDoDia.reduce((s, c) => s + Number(c.recebimentosDinheiroAtual || 0), 0);
      const somaFech = caixasDoDia.reduce((s, c) => s + (c.valorFechamento != null ? Number(c.valorFechamento) : Number(c.valorEsperadoAtual || c.valorAbertura || 0)), 0);
      mapaFechamentosPorData.set(diaC, {
        id: `fech-cx-${empresa}-${diaC}`,
        data: diaC,
        origem: 'caixa_operacional',
        responsavel: caixasDoDia.map((c) => c.responsavel || `Caixa ${c.numeroCaixa}`).join(', '),
        faturamentoBruto: Number((somaRecs || somaFech).toFixed(2)),
        totalRecebidoLiquido: Number(somaFech.toFixed(2)),
        totalDespesasPagas: 0,
        saldoLiquidoDia: Number(somaFech.toFixed(2)),
        caixasFechados: caixasDoDia.length,
        status: 'fechado_caixa',
        criadoEm: caixasDoDia[0].fechadoEm || `${diaC}T23:59:59`,
      });
    }
  }

  const historicoConsolidado = Array.from(mapaFechamentosPorData.values())
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));

  const fechamentoOficialDia = mapaFechamentosPorData.get(data) || null;

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
      data: c.data,
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
    fechamentoOficial: fechamentoOficialDia,
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

    // Comandas & Vendas do Dia (resumo estruturado)
    comandas: comandas.map((c) => ({
      id: c.id,
      numeroComanda: c.numeroComanda,
      clienteNome: c.clienteNome || 'Cliente Eventual',
      clienteTelefone: c.clienteTelefone || '',
      profissionalNome: c.profissionalNome || 'Profissional',
      moduloOrigem: c.moduloOrigem || 'Operação',
      status: c.status,
      total: Number(c.total || 0),
      totalFaturado: Number(c.totalFaturado || c.total || 0),
      itensQuantidade: (c.itens || []).length,
      itensResumo: (c.itens || []).map((i) => `${i.nome} (${i.quantidade || 1}x)`).join(', '),
      pagamentos: (c.pagamentos || []).map((p) => ({ meio: p.meio, valor: p.valor, bandeira: p.bandeira || '' })),
      fechadaEm: c.fechadaEm || c.atualizadaEm || c.criadoEm,
    })),

    // Histórico de Fechamentos Recentes
    historicoFechamentos: historicoConsolidado.slice(0, 60),
    empresas: listarEmpresasParaFechamento(),
  };
}

export function executarFechamentoDiarioIntegrado(empresaId, dados = {}) {
  const empresa = String(empresaId || DINO_EMPRESA_CANONICA).trim();
  const data = dados.data ? String(dados.data).slice(0, 10) : dataHojeIso();
  const empDef = EMPRESAS_PREDEFINIDAS.find((e) => e.id === empresa);
  const lojaId = dados.lojaId || (empDef?.lojas?.[0]?.id) || 'loja-matriz';
  const usuario = dados.usuario || dados.responsavel || 'Gerente / Sistema';

  // 1. Opcionalmente fecha todos os caixas abertos da empresa na data
  let caixasFechadosCount = 0;
  if (dados.fecharCaixasAbertos !== false) {
    const caixas = caixaKytto.listarCaixas(empresa, { data, lojaId }) || [];
    for (const c of caixas) {
      if (c.status === 'aberto') {
        const valEsp = c.valorEsperadoAtual != null ? c.valorEsperadoAtual : (c.valorAbertura || 0);
        try {
          caixaKytto.fecharCaixa(empresa, {
            caixaId: c.id,
            lojaId: c.lojaId || lojaId,
            valorInformado: dados.valoresPorCaixa?.[c.id] != null ? Number(dados.valoresPorCaixa[c.id]) : valEsp,
            observacao: dados.observacao || 'Fechamento automático integrado pelo ERP',
            usuario,
            confirmado: true,
          });
          caixasFechadosCount++;
        } catch (err) {
          console.warn(`[FECHAMENTO] Aviso ao fechar caixa ${c.id}:`, err.message);
        }
      }
    }
  }

  // 2. Apura os números consolidados finais do dia
  const resumoDia = obterFechamentoDiarioEConciliacao(empresa, data, { lojaId });

  // 3. Grava o fechamento oficial no Financeiro Central
  const fechamentoErp = financeiroKytto.fecharDia(empresa, data, usuario, {
    lojaId,
    observacao: dados.observacao || '',
    resumoOperacao: {
      faturamentoTotal: resumoDia.kpisGestao.faturamentoBruto,
      totalRecebidoBalcao: resumoDia.kpisGestao.totalRecebidoLiquido,
      totalEmConta: resumoDia.kpisGestao.totalEmConta,
      totalDespesasPagas: resumoDia.kpisGestao.totalDespesasPagas,
      saldoLiquidoDia: resumoDia.kpisGestao.saldoLiquidoDia,
      caixasFechados: caixasFechadosCount,
      conciliacaoStatus: resumoDia.statusGeral,
    },
  });

  // 4. Grava no módulo de contas de clientes
  try {
    clientesKytto.criarFechamentoDiario(empresa, {
      data,
      usuario,
      observacoes: dados.observacao || '',
      totalVendas: resumoDia.kpisGestao.faturamentoBruto,
      totalRecebido: resumoDia.kpisGestao.totalRecebidoLiquido,
      totalDespesas: resumoDia.kpisGestao.totalDespesasPagas,
      saldoFinal: resumoDia.kpisGestao.saldoLiquidoDia,
    });
  } catch (err) {
    console.warn('[FECHAMENTO] Aviso ao gravar fechamento de clientes:', err.message);
  }

  return {
    ok: true,
    empresaId: empresa,
    data,
    fechamento: fechamentoErp,
    caixasFechados: caixasFechadosCount,
    resumo: resumoDia,
  };
}

export function fecharTodosOsCaixasDaEmpresa(empresaId, dados = {}) {
  const empresa = String(empresaId || DINO_EMPRESA_CANONICA).trim();
  const data = dados.data ? String(dados.data).slice(0, 10) : dataHojeIso();
  const empDef = EMPRESAS_PREDEFINIDAS.find((e) => e.id === empresa);
  const lojaId = dados.lojaId || (empDef?.lojas?.[0]?.id) || 'loja-matriz';
  const usuario = dados.usuario || 'Gerente / Sistema';

  // 1. Busca todos os caixas abertos da empresa (se lojaId não foi explicitamente filtrada, busca de todas as unidades)
  const filtrosListagem = dados.lojaId ? { lojaId: dados.lojaId } : {};
  const todosCaixas = caixaKytto.listarCaixas(empresa, filtrosListagem) || [];
  const caixasAbertos = todosCaixas.filter((c) => c.status === 'aberto');
  
  const fechamentosRealizados = [];
  for (const c of caixasAbertos) {
    const valorInf = dados.valoresPorCaixa?.[c.id] != null
      ? Number(dados.valoresPorCaixa[c.id])
      : (c.valorEsperadoAtual != null ? Number(c.valorEsperadoAtual) : Number(c.valorAbertura || 0));
    
    const resFechamento = caixaKytto.fecharCaixa(empresa, {
      caixaId: c.id,
      lojaId: c.lojaId || lojaId,
      valorInformado: valorInf,
      observacao: dados.observacao || 'Fechamento em lote dos caixas da empresa',
      usuario,
      confirmado: true,
    });
    fechamentosRealizados.push(resFechamento);
  }

  // 2. Executa o Fechamento Diário Integrado no ERP
  const fechamentoErp = executarFechamentoDiarioIntegrado(empresa, {
    ...dados,
    data,
    lojaId,
    usuario,
    confirmado: true,
    fecharCaixasAbertos: false,
  });

  return {
    ok: true,
    empresaId: empresa,
    data,
    caixasFechados: fechamentosRealizados.length,
    detalhesCaixas: fechamentosRealizados,
    fechamentoErp,
  };
}

export function fecharCaixaIndividualEmpresa(empresaId, caixaId, dados = {}) {
  const empresa = String(empresaId || DINO_EMPRESA_CANONICA).trim();
  return caixaKytto.fecharCaixa(empresa, {
    caixaId,
    ...dados,
    confirmado: true,
  });
}

export function abrirNovoCaixaEmpresa(empresaId, dados = {}) {
  const empresa = String(empresaId || DINO_EMPRESA_CANONICA).trim();
  const empDef = EMPRESAS_PREDEFINIDAS.find((e) => e.id === empresa);
  const lojaId = dados.lojaId || (empDef?.lojas?.[0]?.id) || 'loja-matriz';
  return caixaKytto.abrirCaixa(empresa, {
    ...dados,
    lojaId,
    data: dados.data || dataHojeIso(),
  });
}

export function reabrirFechamentoDiarioIntegrado(empresaId, dados = {}) {
  const empresa = String(empresaId || DINO_EMPRESA_CANONICA).trim();
  const data = dados.data ? String(dados.data).slice(0, 10) : dataHojeIso();
  const lojaId = dados.lojaId || undefined;
  const motivo = dados.motivo || 'Reabertura de fechamento diário solicitada pela gerência';

  // 1. Remove ou desativa o fechamento do dia no financeiro central
  const d = db();
  d.financeiroKytto = d.financeiroKytto || { empresas: {} };
  const storeFin = d.financeiroKytto.empresas[empresa];
  if (storeFin && Array.isArray(storeFin.fechamentos)) {
    storeFin.fechamentos = storeFin.fechamentos.filter((f) => String(f.data).slice(0, 10) !== data);
    save();
  }

  // 2. Opcionalmente reabre os caixas fechados da data
  let caixasReabertosCount = 0;
  if (dados.reabrirCaixas !== false) {
    const caixas = caixaKytto.listarCaixas(empresa, { data, lojaId }) || [];
    for (const c of caixas) {
      if (c.status === 'fechado') {
        try {
          caixaKytto.reabrirCaixa(empresa, {
            caixaId: c.id,
            motivo,
            usuario: dados.usuario || 'Gerente',
          });
          caixasReabertosCount++;
        } catch (err) {
          console.warn(`[REABERTURA] Aviso ao reabrir caixa ${c.id}:`, err.message);
        }
      }
    }
  }

  return {
    ok: true,
    empresaId: empresa,
    data,
    reaberto: true,
    caixasReabertos: caixasReabertosCount,
    motivo,
  };
}

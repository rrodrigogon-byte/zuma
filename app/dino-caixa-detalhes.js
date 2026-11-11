// ============================================================================
// DINO CAIXA DETALHES - RELATÓRIO CONSOLIDADO E DRILLDOWN DE COMANDAS
// ============================================================================
// Suporta visão no padrão AVEC com agrupamento por forma de pagamento e
// bandeiras (MasterCard, Visa, ELO), drilldown de comandas por meio e
// emissão do relatório oficial de fechamento de caixa.
// ============================================================================

import * as caixaKytto from './caixa-diario-kytto.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';
import {
  isProdutoBebida,
  obterPercentualComissaoServico,
  obterPercentualComissaoProduto,
} from './core/dino-regras-comissoes.js';

function formatarDataHora(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (e) {
    return String(iso);
  }
}

function normalizarMeio(meioBruto = '') {
  const m = String(meioBruto || '').toLowerCase().trim();
  if (['debito', 'cartao_debito', 'cartao debito'].includes(m)) return 'cartao_debito';
  if (['credito', 'cartao_credito', 'cartao credito'].includes(m)) return 'cartao_credito';
  if (['cartao'].includes(m)) return 'cartao_credito';
  if (['pix'].includes(m)) return 'pix';
  if (['dinheiro'].includes(m)) return 'dinheiro';
  if (['conta', 'fiado', 'dividas', 'divida'].includes(m)) return 'dividas';
  if (['credito_utilizado', 'pacote', 'fidelidade'].includes(m)) return 'credito_utilizado';
  if (['cheque'].includes(m)) return 'cheque';
  if (['boleto'].includes(m)) return 'boleto';
  if (['transferencia', 'ted', 'doc'].includes(m)) return 'transferencia';
  if (['deposito'].includes(m)) return 'deposito';
  if (['cortesia'].includes(m)) return 'cortesia';
  if (['permuta'].includes(m)) return 'permuta';
  if (['voucher'].includes(m)) return 'voucher';
  return 'outros';
}

function labelMeio(meio) {
  const mapa = {
    cartao_debito: 'Cartão Débito',
    cartao_credito: 'Cartão Crédito',
    pix: 'Pix',
    dinheiro: 'Dinheiro',
    dividas: 'Dívidas / Em Conta',
    credito_utilizado: 'Crédito Utilizado',
    cheque: 'Cheque',
    boleto: 'Boleto',
    transferencia: 'Transferência',
    deposito: 'Depósito',
    cortesia: 'Cortesia',
    permuta: 'Permuta',
    voucher: 'Voucher',
    outros: 'Outros',
  };
  return mapa[meio] || meio;
}

/**
 * Obtém o subtotal real de um item da comanda respeitando subtotal === 0
 * (ex: procedimentos inclusos em pacote ou clube, onde precoUnitario > 0 mas subtotal === 0).
 */
export function obterSubtotalBrutoItemComanda(it) {
  if (!it) return 0;
  if (it.subtotal !== undefined && it.subtotal !== null && it.subtotal !== '') {
    const val = Number(it.subtotal);
    if (Number.isFinite(val)) return Number(val.toFixed(2));
  }
  const unit = Number(it.precoUnitario ?? it.preco ?? 0);
  const qtd = Number(it.quantidade ?? 1);
  return Number((unit * qtd).toFixed(2));
}

export function obterDetalhesCaixaOperacao(empresaId, caixaId, options = {}) {
  const caixa = caixaKytto.obterCaixa(empresaId, caixaId);
  if (!caixa) return null;
  const estado = barbeariaErpKytto.estadoEmpresa(empresaId, false);
  const mapaProf = estado?.profissionais || {};

  const movimentos = caixaKytto.movimentosDoCaixa(empresaId, caixa.id);
  const sangrias = movimentos.filter((m) => m.tipo === 'sangria');
  const suprimentos = movimentos.filter((m) => m.tipo === 'suprimento');

  // Comandas associadas ao dia e unidade deste caixa
  const comandasDia = barbeariaErpKytto.listarComandasBarbearia(empresaId, {
    data: caixa.data,
    lojaId: caixa.lojaId,
  }) || [];

  // Também busca qualquer comanda que tenha pagamentos explicitamente apontando para este caixaId
  const todasComandasEmpresa = barbeariaErpKytto.listarComandasBarbearia(empresaId, {}) || [];
  const comandasPorIdCaixa = todasComandasEmpresa.filter((c) =>
    c.status !== 'cancelada' &&
    !c.estornada &&
    (c.pagamentos || []).some((p) => String(p.caixaId) === String(caixa.id) && !p.estornado && !p.cancelado)
  );

  // Unifica sem duplicidade
  const mapaComandas = new Map();
  for (const c of [...comandasDia, ...comandasPorIdCaixa]) {
    if (c.status !== 'cancelada' && !c.estornada) {
      const dataAtend = c.dataAtendimento ? String(c.dataAtendimento).slice(0, 10) : (c.criadoEm ? String(c.criadoEm).slice(0, 10) : caixa.data);
      if (dataAtend !== caixa.data && !comandasPorIdCaixa.some((cp) => cp.id === c.id)) {
        continue;
      }
      mapaComandas.set(c.id, c);
    }
  }
  const comandas = Array.from(mapaComandas.values());

  // Inicializa estrutura de formas de pagamento
  const formasPagamento = {
    dinheiro: { meio: 'dinheiro', label: 'Dinheiro', total: 0, quantidade: 0, bandeiras: {} },
    cartao_credito: { meio: 'cartao_credito', label: 'Cartão Crédito', total: 0, quantidade: 0, bandeiras: {} },
    cartao_debito: { meio: 'cartao_debito', label: 'Cartão Débito', total: 0, quantidade: 0, bandeiras: {} },
    cheque: { meio: 'cheque', label: 'Cheque', total: 0, quantidade: 0, bandeiras: {} },
    boleto: { meio: 'boleto', label: 'Boleto', total: 0, quantidade: 0, bandeiras: {} },
    transferencia: { meio: 'transferencia', label: 'Transferência', total: 0, quantidade: 0, bandeiras: {} },
    pix: { meio: 'pix', label: 'Pix', total: 0, quantidade: 0, bandeiras: {} },
    deposito: { meio: 'deposito', label: 'Depósito', total: 0, quantidade: 0, bandeiras: {} },
    voucher: { meio: 'voucher', label: 'Voucher', total: 0, quantidade: 0, bandeiras: {} },
    permuta: { meio: 'permuta', label: 'Permuta', total: 0, quantidade: 0, bandeiras: {} },
    cortesia: { meio: 'cortesia', label: 'Cortesia', total: 0, quantidade: 0, bandeiras: {} },
    credito_utilizado: { meio: 'credito_utilizado', label: 'Crédito Utilizado', total: 0, quantidade: 0, bandeiras: {} },
    dividas: { meio: 'dividas', label: 'Dívidas', total: 0, quantidade: 0, bandeiras: {} },
  };

  const comandasPorMeio = {};
  const itensRelatorioFechamento = [];
  const faturadoPorComandaNoCaixa = new Map();
  let totalFaturado = 0;

  for (const c of comandas) {
    const pags = (c.pagamentos || []).filter((p) => {
      if (p.estornado || p.cancelado) return false;
      if (p.caixaId && String(p.caixaId) !== String(caixa.id)) {
        const dataAtend = c.dataAtendimento ? String(c.dataAtendimento).slice(0, 10) : '';
        if (dataAtend !== caixa.data) return false;
      }
      return true;
    });

    const numeroComanda = c.numeroComanda ? `Nº${c.numeroComanda}` : `Nº${String(c.id).slice(-4)}`;
    const clienteNome = c.clienteNome || 'Avulso';
    const itensFormatados = (c.itens || []).map((it) => ({
      id: it.id,
      nome: it.nome,
      tipo: it.tipo,
      quantidade: it.quantidade || 1,
      precoUnitario: it.precoUnitario ?? it.preco ?? 0,
      subtotal: obterSubtotalBrutoItemComanda(it),
      profissionalId: it.profissionalId || c.profissionalId || null,
      profissionalNome: mapaProf[it.profissionalId]?.nome || mapaProf[c.profissionalId]?.nome || 'Barbeiro',
    }));
    const dataAtendFormatada = c.dataAtendimento || (c.criadoEm ? String(c.criadoEm).slice(0, 10) : caixa.data);

    let somaPagamentosComanda = 0;

    for (const p of pags) {
      const meioNorm = normalizarMeio(p.meio);
      const valor = Number(p.valor || 0);
      const bandeira = p.bandeira ? String(p.bandeira).trim() : null;

      somaPagamentosComanda = Number((somaPagamentosComanda + valor).toFixed(2));

      if (!formasPagamento[meioNorm]) {
        formasPagamento[meioNorm] = { meio: meioNorm, label: labelMeio(meioNorm), total: 0, quantidade: 0, bandeiras: {} };
      }

      formasPagamento[meioNorm].total = Number((formasPagamento[meioNorm].total + valor).toFixed(2));
      formasPagamento[meioNorm].quantidade += 1;

      if (bandeira) {
        if (!formasPagamento[meioNorm].bandeiras[bandeira]) {
          formasPagamento[meioNorm].bandeiras[bandeira] = { nome: bandeira, total: 0, quantidade: 0 };
        }
        formasPagamento[meioNorm].bandeiras[bandeira].total = Number((formasPagamento[meioNorm].bandeiras[bandeira].total + valor).toFixed(2));
        formasPagamento[meioNorm].bandeiras[bandeira].quantidade += 1;
      }

      totalFaturado = Number((totalFaturado + valor).toFixed(2));

      // Item para Drilldown por meio geral (ex: 'cartao_debito', 'pix', etc.)
      const chaveGeral = meioNorm;
      comandasPorMeio[chaveGeral] ||= {
        chave: chaveGeral,
        titulo: labelMeio(meioNorm),
        total: 0,
        comandas: [],
      };
      comandasPorMeio[chaveGeral].total = Number((comandasPorMeio[chaveGeral].total + valor).toFixed(2));
      comandasPorMeio[chaveGeral].comandas.push({
        titulo: `Comanda ${numeroComanda} - ${clienteNome}`,
        comandaId: c.id,
        numeroComanda: c.numeroComanda,
        clienteNome,
        valor,
        totalComanda: c.total,
        desconto: Number(c.desconto || 0),
        meio: p.meio,
        meioFormatado: labelMeio(meioNorm),
        bandeira: bandeira || '',
        pagamentoId: p.id,
        registradoEm: p.registradoEm || c.atualizadoEm || c.criadoEm,
        dataAtendimento: dataAtendFormatada,
        profissionalId: c.profissionalId || null,
        profissionalNome: mapaProf[c.profissionalId]?.nome || 'Barbeiro',
        status: c.status,
        itens: itensFormatados,
      });

      // Item para Drilldown específico por bandeira (ex: 'cartao_debito_mastercard')
      if (bandeira) {
        const chaveBandeira = `${meioNorm}_${bandeira.toLowerCase().replace(/\s+/g, '_')}`;
        comandasPorMeio[chaveBandeira] ||= {
          chave: chaveBandeira,
          titulo: `${labelMeio(meioNorm)} / ${bandeira}`,
          total: 0,
          comandas: [],
        };
        comandasPorMeio[chaveBandeira].total = Number((comandasPorMeio[chaveBandeira].total + valor).toFixed(2));
        comandasPorMeio[chaveBandeira].comandas.push({
          titulo: `Comanda ${numeroComanda} - ${clienteNome}`,
          comandaId: c.id,
          numeroComanda: c.numeroComanda,
          clienteNome,
          valor,
          totalComanda: c.total,
          desconto: Number(c.desconto || 0),
          meio: p.meio,
          meioFormatado: labelMeio(meioNorm),
          bandeira,
          pagamentoId: p.id,
          registradoEm: p.registradoEm || c.atualizadoEm || c.criadoEm,
          dataAtendimento: dataAtendFormatada,
          profissionalId: c.profissionalId || null,
          profissionalNome: mapaProf[c.profissionalId]?.nome || 'Barbeiro',
          status: c.status,
          itens: itensFormatados,
        });
      }

      // Linha do Relatório de Fechamento (Impressão / PDF)
      const labelRelatorio = bandeira ? `${labelMeio(meioNorm)} ${bandeira}` : labelMeio(meioNorm);
      itensRelatorioFechamento.push({
        formaPagamento: labelRelatorio,
        comandaTexto: `Comanda ${numeroComanda} - ${clienteNome}`,
        valor,
        comandaId: c.id,
        pagamentoId: p.id,
        clienteNome,
        meio: p.meio,
        bandeira,
        registradoEm: p.registradoEm || c.atualizadoEm,
      });
    }

    faturadoPorComandaNoCaixa.set(c.id, somaPagamentosComanda);
  }

  // Ordena itens do relatório por data/hora ou comanda
  itensRelatorioFechamento.sort((a, b) => String(a.formaPagamento).localeCompare(String(b.formaPagamento)));

  const totalSangrias = Number(sangrias.reduce((s, m) => s + Number(m.valor || 0), 0).toFixed(2));
  const totalSuprimentos = Number(suprimentos.reduce((s, m) => s + Number(m.valor || 0), 0).toFixed(2));
  const dinheiroEsperado = Number((Number(caixa.valorAbertura || 0) + Number(formasPagamento.dinheiro.total || 0) + totalSuprimentos - totalSangrias).toFixed(2));

  // Cálculo consolidado de comissões dos barbeiros nas comandas deste caixa
  // Conciliado 100% com o valor efetivamente faturado no caixa (respeitando subtotal === 0 de pacotes/clubes e descontos de comanda)
  const mapaComissoesProf = {};
  let totalGorjetas = 0;
  let totalDescontosCaixa = 0;

  for (const c of comandas) {
    if (c.status === 'cancelada' || c.estornada) continue;

    const itens = c.itens || [];
    const subtotaisBrutos = itens.map((it) => obterSubtotalBrutoItemComanda(it));
    const somaBrutaComanda = Number(subtotaisBrutos.reduce((s, v) => s + v, 0).toFixed(2));
    const pagoComandaNoCaixa = Number(faturadoPorComandaNoCaixa.get(c.id) || 0);

    // Se a comanda possui valor bruto > 0 mas ainda não teve nenhum pagamento/fechamento no caixa (ex: comanda aberta),
    // ela não entrou no Total Faturado deste caixa e não deve inflar o rateio de comissões do caixa.
    if (somaBrutaComanda > 0 && pagoComandaNoCaixa === 0) {
      continue;
    }

    totalGorjetas = Number((totalGorjetas + Number(c.gorjeta || 0)).toFixed(2));
    if (somaBrutaComanda > pagoComandaNoCaixa) {
      totalDescontosCaixa = Number((totalDescontosCaixa + (somaBrutaComanda - pagoComandaNoCaixa)).toFixed(2));
    }

    const indicesComValor = subtotaisBrutos.map((v, idx) => (v > 0 ? idx : -1)).filter((idx) => idx >= 0);
    const ultimoIdxComValor = indicesComValor.length > 0 ? indicesComValor[indicesComValor.length - 1] : -1;
    let acumuladoLiquidoComanda = 0;

    for (let idx = 0; idx < itens.length; idx++) {
      const it = itens[idx];
      const subtotalBruto = subtotaisBrutos[idx];
      let subtotalItem = 0;

      if (somaBrutaComanda > 0 && subtotalBruto > 0) {
        if (idx === ultimoIdxComValor) {
          subtotalItem = Number(Math.max(0, pagoComandaNoCaixa - acumuladoLiquidoComanda).toFixed(2));
        } else {
          subtotalItem = Number((subtotalBruto * (pagoComandaNoCaixa / somaBrutaComanda)).toFixed(2));
          acumuladoLiquidoComanda = Number((acumuladoLiquidoComanda + subtotalItem).toFixed(2));
        }
      }

      const profId = it.profissionalId || c.profissionalId || '__sem_profissional__';
      const prof = mapaProf[profId];
      const nomeProf = prof?.nome || (profId === '__sem_profissional__' ? 'Sem Barbeiro Definido' : 'Profissional');
      const comissaoPercent = obterPercentualComissaoServico(prof, null, profId);
      const comissaoServItemPercent = obterPercentualComissaoServico(prof, it, profId);
      const comissaoProdPadrao = profId === '__sem_profissional__'
        ? 0
        : Number(prof?.percentualComissaoProduto ?? prof?.comissaoProdutos ?? 10);

      if (!mapaComissoesProf[profId]) {
        mapaComissoesProf[profId] = {
          profissionalId: profId,
          nome: nomeProf,
          totalServicos: 0,
          totalProdutos: 0,
          totalFaturado: 0,
          totalDescontos: 0,
          comissaoPercent,
          comissaoProdPercent: comissaoProdPadrao,
          valorComissao: 0,
          valorComissaoServicos: 0,
          valorComissaoProdutos: 0,
          quantidadeServicos: 0,
          quantidadeProdutos: 0,
        };
      }

      if (subtotalBruto > subtotalItem) {
        mapaComissoesProf[profId].totalDescontos = Number(
          ((mapaComissoesProf[profId].totalDescontos || 0) + (subtotalBruto - subtotalItem)).toFixed(2)
        );
      }

      if (it.tipo === 'produto') {
        const isBebida = isProdutoBebida(it);
        const comissaoProdPercent = obterPercentualComissaoProduto(prof, it, profId);
        mapaComissoesProf[profId].totalProdutos = Number((mapaComissoesProf[profId].totalProdutos + subtotalItem).toFixed(2));
        mapaComissoesProf[profId].quantidadeProdutos += Number(it.quantidade || 1);
        if (isBebida) {
          mapaComissoesProf[profId].totalBebidas = Number(((mapaComissoesProf[profId].totalBebidas || 0) + subtotalItem).toFixed(2));
          mapaComissoesProf[profId].quantidadeBebidas = (mapaComissoesProf[profId].quantidadeBebidas || 0) + Number(it.quantidade || 1);
        } else {
          mapaComissoesProf[profId].totalRevenda = Number(((mapaComissoesProf[profId].totalRevenda || 0) + subtotalItem).toFixed(2));
          mapaComissoesProf[profId].quantidadeRevenda = (mapaComissoesProf[profId].quantidadeRevenda || 0) + Number(it.quantidade || 1);
          const valorComissaoProd = Number((subtotalItem * (comissaoProdPercent / 100)).toFixed(2));
          mapaComissoesProf[profId].valorComissaoProdutos = Number(((mapaComissoesProf[profId].valorComissaoProdutos || 0) + valorComissaoProd).toFixed(2));
          mapaComissoesProf[profId].valorComissao = Number((mapaComissoesProf[profId].valorComissao + valorComissaoProd).toFixed(2));
        }
      } else {
        mapaComissoesProf[profId].totalServicos = Number((mapaComissoesProf[profId].totalServicos + subtotalItem).toFixed(2));
        mapaComissoesProf[profId].quantidadeServicos += Number(it.quantidade || 1);
        const valorComissaoServ = Number((subtotalItem * (comissaoServItemPercent / 100)).toFixed(2));
        mapaComissoesProf[profId].valorComissaoServicos = Number(((mapaComissoesProf[profId].valorComissaoServicos || 0) + valorComissaoServ).toFixed(2));
        mapaComissoesProf[profId].valorComissao = Number((mapaComissoesProf[profId].valorComissao + valorComissaoServ).toFixed(2));
      }

      mapaComissoesProf[profId].totalFaturado = Number((mapaComissoesProf[profId].totalServicos + mapaComissoesProf[profId].totalProdutos).toFixed(2));
    }
  }

  const listaComissoes = Object.values(mapaComissoesProf);
  const totalComissoesGeral = Number(listaComissoes.reduce((soma, p) => soma + p.valorComissao, 0).toFixed(2));
  const totalServicosGeral = Number(listaComissoes.reduce((soma, p) => soma + p.totalServicos, 0).toFixed(2));
  const totalProdutosGeral = Number(listaComissoes.reduce((soma, p) => soma + p.totalProdutos, 0).toFixed(2));
  const totalFaturadoRateio = Number((totalServicosGeral + totalProdutosGeral).toFixed(2));

  return {
    caixa: {
      ...caixa,
      abertoEmFormatado: formatarDataHora(caixa.abertoEm),
      fechadoEmFormatado: formatarDataHora(caixa.fechadoEm),
      atualizadoEmFormatado: formatarDataHora(caixa.atualizadoEm),
      responsavelNome: caixa.responsavel ? caixa.responsavel.split('@')[0] : 'Sistema',
      responsavelEmail: caixa.responsavel && caixa.responsavel.includes('@') ? caixa.responsavel : '',
    },
    movimentacoes: {
      sangrias,
      totalSangrias,
      suprimentos,
      totalSuprimentos,
      temMovimentacao: sangrias.length > 0 || suprimentos.length > 0,
    },
    formasPagamento,
    totalFaturado,
    totalDescontosCaixa,
    dinheiroEsperado,
    totalGorjetas,
    comissoes: {
      profissionais: listaComissoes,
      totalComissoes: totalComissoesGeral,
      totalServicos: totalServicosGeral,
      totalProdutos: totalProdutosGeral,
      totalFaturadoRateio,
      conciliadoComCaixa: Math.abs(totalFaturado - totalFaturadoRateio) < 0.01,
    },
    comandasPorMeio,
    itensRelatorioFechamento,
    totalComandas: comandas.length,
    todasComandas: comandas.map((c) => ({
      id: c.id,
      numeroComanda: c.numeroComanda,
      clienteNome: c.clienteNome || 'Avulso',
      subtotal: c.subtotal,
      desconto: Number(c.desconto || 0),
      total: c.total,
      totalPago: c.totalPago,
      status: c.status,
      dataAtendimento: c.dataAtendimento || (c.criadoEm ? String(c.criadoEm).slice(0, 10) : caixa.data),
      profissionalId: c.profissionalId || null,
      profissionalNome: mapaProf[c.profissionalId]?.nome || 'Barbeiro',
      pagamentos: (c.pagamentos || []).filter((p) => !p.estornado && !p.cancelado),
      itens: (c.itens || []).map((it) => ({
        id: it.id,
        nome: it.nome,
        tipo: it.tipo,
        quantidade: it.quantidade || 1,
        precoUnitario: it.precoUnitario ?? it.preco ?? 0,
        subtotal: obterSubtotalBrutoItemComanda(it),
        profissionalId: it.profissionalId || c.profissionalId || null,
        profissionalNome: mapaProf[it.profissionalId]?.nome || mapaProf[c.profissionalId]?.nome || 'Barbeiro',
      })),
    })),
    dataImpressao: formatarDataHora(new Date().toISOString()),
  };
}

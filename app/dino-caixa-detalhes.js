// ============================================================================
// DINO CAIXA DETALHES - RELATÓRIO CONSOLIDADO E DRILLDOWN DE COMANDAS
// ============================================================================
// Suporta visão no padrão AVEC com agrupamento por forma de pagamento e
// bandeiras (MasterCard, Visa, ELO), drilldown de comandas por meio e
// emissão do relatório oficial de fechamento de caixa.
// ============================================================================

import * as caixaKytto from './caixa-diario-kytto.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';

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

export function obterDetalhesCaixaOperacao(empresaId, caixaId, options = {}) {
  const caixa = caixaKytto.obterCaixa(empresaId, caixaId);
  if (!caixa) return null;

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
    (c.pagamentos || []).some((p) => String(p.caixaId) === String(caixa.id))
  );

  // Unifica sem duplicidade
  const mapaComandas = new Map();
  for (const c of [...comandasDia, ...comandasPorIdCaixa]) {
    if (c.status !== 'cancelada') {
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
  let totalFaturado = 0;

  for (const c of comandas) {
    const pags = c.pagamentos || [];
    const numeroComanda = c.numeroComanda ? `Nº${c.numeroComanda}` : `Nº${String(c.id).slice(-4)}`;
    const clienteNome = c.clienteNome || 'Avulso';

    for (const p of pags) {
      const meioNorm = normalizarMeio(p.meio);
      const valor = Number(p.valor || 0);
      const bandeira = p.bandeira ? String(p.bandeira).trim() : null;

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
        meio: p.meio,
        meioFormatado: labelMeio(meioNorm),
        bandeira: bandeira || '',
        pagamentoId: p.id,
        registradoEm: p.registradoEm || c.atualizadoEm || c.criadoEm,
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
          meio: p.meio,
          meioFormatado: labelMeio(meioNorm),
          bandeira,
          pagamentoId: p.id,
          registradoEm: p.registradoEm || c.atualizadoEm || c.criadoEm,
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
  }

  // Ordena itens do relatório por data/hora ou comanda
  itensRelatorioFechamento.sort((a, b) => String(a.formaPagamento).localeCompare(String(b.formaPagamento)));

  const totalSangrias = Number(sangrias.reduce((s, m) => s + Number(m.valor || 0), 0).toFixed(2));
  const totalSuprimentos = Number(suprimentos.reduce((s, m) => s + Number(m.valor || 0), 0).toFixed(2));
  const dinheiroEsperado = Number((Number(caixa.valorAbertura || 0) + Number(formasPagamento.dinheiro.total || 0) + totalSuprimentos - totalSangrias).toFixed(2));

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
    dinheiroEsperado,
    comandasPorMeio,
    itensRelatorioFechamento,
    totalComandas: comandas.length,
    dataImpressao: formatarDataHora(new Date().toISOString()),
  };
}

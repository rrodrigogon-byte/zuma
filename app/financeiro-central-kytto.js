// ============================================================================
// FINANCEIRO CENTRAL KYTTO
// Livro-caixa multientidade com rastreabilidade de eventos operacionais.
// A persistência é delegada ao servidor chamador para agrupar alterações em save().
// ============================================================================

import { db } from './db.js';

const MOEDA = 'BRL';
const TIPOS = new Set(['receita', 'despesa']);
const STATUS = new Set(['pendente', 'pago', 'cancelado']);

const agora = () => new Date().toISOString();
const valorMonetario = (valor) => Number(Number(valor || 0).toFixed(2));
const texto = (valor, limite = 240) => String(valor ?? '').trim().slice(0, limite);

function dataIso(valor, fallback = agora()) {
  const data = valor ? new Date(valor) : new Date(fallback);
  return Number.isNaN(data.valueOf()) ? new Date(fallback).toISOString() : data.toISOString();
}

function dataCurta(valor) {
  return dataIso(valor).slice(0, 10);
}

function storeEmpresa(empresaId) {
  const estado = db();
  estado.financeiroKytto ||= { empresas: {} };
  estado.financeiroKytto.empresas ||= {};
  const chave = String(empresaId || 'emp-kytto-001');
  estado.financeiroKytto.empresas[chave] ||= {
    lancamentos: {},
    fechamentos: {},
    sequencia: 0,
  };
  const empresa = estado.financeiroKytto.empresas[chave];
  empresa.lancamentos ||= {};
  empresa.fechamentos ||= {};
  empresa.sequencia ||= 0;
  return empresa;
}

function novoId(empresaId, prefixo) {
  const store = storeEmpresa(empresaId);
  store.sequencia += 1;
  return `${prefixo}-${Date.now().toString(36)}-${String(store.sequencia).padStart(5, '0')}`;
}

function normalizarReferencia(referencia = {}) {
  if (!referencia || typeof referencia !== 'object') return {};
  const permitidos = ['comandaId', 'contaReceberId', 'fornecedorId', 'produtoId', 'documentoId', 'pedidoId', 'movimentoId', 'clienteId', 'notaNumero'];
  return Object.fromEntries(
    permitidos
      .filter((campo) => referencia[campo] !== undefined && referencia[campo] !== null && referencia[campo] !== '')
      .map((campo) => [campo, texto(referencia[campo], 120)])
  );
}

function serializar(lancamento) {
  return {
    ...lancamento,
    referencia: { ...(lancamento.referencia || {}) },
  };
}

export function obterLancamento(empresaId, id) {
  const lancamento = db().financeiroKytto?.empresas?.[String(empresaId)]?.lancamentos?.[String(id)];
  return lancamento?.empresaId === String(empresaId) ? serializar(lancamento) : null;
}

export function registrarLancamento(empresaId, dados = {}) {
  const store = storeEmpresa(empresaId);
  const tipo = String(dados.tipo || '').toLowerCase();
  const valor = valorMonetario(dados.valor);
  if (!TIPOS.has(tipo)) throw new Error('Tipo financeiro deve ser receita ou despesa.');
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('Valor financeiro deve ser positivo.');

  const chaveIdempotencia = texto(dados.chaveIdempotencia, 220);
  if (chaveIdempotencia) {
    const existente = Object.values(store.lancamentos).find((item) => item.chaveIdempotencia === chaveIdempotencia);
    if (existente) return serializar(existente);
  }

  const status = STATUS.has(String(dados.status || '').toLowerCase())
    ? String(dados.status).toLowerCase()
    : 'pendente';
  const dataOperacao = dataIso(dados.dataOperacao);
  const vencimento = dataCurta(dados.vencimento || dataOperacao);
  const pagoEm = status === 'pago' ? dataIso(dados.pagoEm || dataOperacao) : null;
  const id = novoId(empresaId, 'fin');
  const lancamento = {
    id,
    empresaId: String(empresaId),
    tipo,
    categoria: texto(dados.categoria || 'Outros', 100),
    descricao: texto(dados.descricao || 'Lançamento financeiro', 240),
    valor,
    moeda: MOEDA,
    origem: texto(dados.origem || 'manual', 60),
    status,
    vencimento,
    dataOperacao,
    pagoEm,
    meioPagamento: texto(dados.meioPagamento || '', 40).toLowerCase() || null,
    lojaId: texto(dados.lojaId, 120),
    observacao: texto(dados.observacao || dados.obs || '', 500),
    referencia: normalizarReferencia(dados.referencia),
    usuario: texto(dados.usuario || 'sistema@kytto.local', 120),
    automatico: dados.automatico === true,
    chaveIdempotencia: chaveIdempotencia || null,
    criadoEm: agora(),
    atualizadoEm: agora(),
  };
  store.lancamentos[id] = lancamento;
  return serializar(lancamento);
}

export function atualizarLancamento(empresaId, id, dados = {}, { permitirAutomatico = false } = {}) {
  const store = storeEmpresa(empresaId);
  const lancamento = store.lancamentos[String(id)];
  if (!lancamento || lancamento.empresaId !== String(empresaId)) return null;
  if (lancamento.automatico && !permitirAutomatico) {
    const camposPermitidos = new Set(['status', 'pagoEm', 'meioPagamento', 'observacao', 'obs']);
    if (Object.keys(dados).some((campo) => !camposPermitidos.has(campo))) {
      throw new Error('Lançamentos automáticos só podem ter status, pagamento ou observação atualizados.');
    }
  }

  if (dados.tipo !== undefined) {
    const tipo = String(dados.tipo).toLowerCase();
    if (!TIPOS.has(tipo)) throw new Error('Tipo financeiro inválido.');
    lancamento.tipo = tipo;
  }
  if (dados.valor !== undefined) {
    const valor = valorMonetario(dados.valor);
    if (!Number.isFinite(valor) || valor <= 0) throw new Error('Valor financeiro deve ser positivo.');
    lancamento.valor = valor;
  }
  if (dados.categoria !== undefined) lancamento.categoria = texto(dados.categoria, 100) || 'Outros';
  if (dados.descricao !== undefined) lancamento.descricao = texto(dados.descricao, 240) || lancamento.descricao;
  if (dados.vencimento !== undefined) lancamento.vencimento = dataCurta(dados.vencimento);
  if (dados.meioPagamento !== undefined) lancamento.meioPagamento = texto(dados.meioPagamento, 40).toLowerCase() || null;
  if (dados.lojaId !== undefined) lancamento.lojaId = texto(dados.lojaId, 120);
  if (dados.observacao !== undefined || dados.obs !== undefined) lancamento.observacao = texto(dados.observacao ?? dados.obs, 500);
  if (dados.referencia !== undefined) lancamento.referencia = normalizarReferencia(dados.referencia);

  if (dados.status !== undefined) {
    const status = String(dados.status).toLowerCase();
    if (!STATUS.has(status)) throw new Error('Status financeiro inválido.');
    lancamento.status = status;
    lancamento.pagoEm = status === 'pago' ? dataIso(dados.pagoEm || lancamento.pagoEm || agora()) : null;
  } else if (dados.pagoEm !== undefined) {
    lancamento.pagoEm = dados.pagoEm ? dataIso(dados.pagoEm) : null;
    if (lancamento.pagoEm) lancamento.status = 'pago';
  }

  lancamento.atualizadoEm = agora();
  return serializar(lancamento);
}

export function cancelarLancamento(empresaId, id, usuario = 'sistema@kytto.local') {
  return atualizarLancamento(empresaId, id, {
    status: 'cancelado',
    observacao: `Cancelado por ${usuario}`,
  }, { permitirAutomatico: true });
}

export function listarLancamentos(empresaId, filtros = {}) {
  const store = storeEmpresa(empresaId);
  const tipo = texto(filtros.tipo, 20).toLowerCase();
  const status = texto(filtros.status, 20).toLowerCase();
  const origem = texto(filtros.origem, 60).toLowerCase();
  const categoria = texto(filtros.categoria, 100);
  const de = texto(filtros.de, 10);
  const ate = texto(filtros.ate, 10);
  const lojaId = texto(filtros.lojaId, 120);

  return Object.values(store.lancamentos)
    .filter((item) => item.empresaId === String(empresaId))
    .filter((item) => !tipo || item.tipo === tipo)
    .filter((item) => !status || item.status === status)
    .filter((item) => !origem || item.origem === origem)
    .filter((item) => !categoria || item.categoria === categoria)
    .filter((item) => !de || item.vencimento >= de)
    .filter((item) => !ate || item.vencimento <= ate)
    .filter((item) => !lojaId || item.lojaId === lojaId)
    .sort((a, b) => String(b.dataOperacao).localeCompare(String(a.dataOperacao)) || String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .map(serializar);
}

export function registrarVendaComanda(empresaId, { comanda, pagamentos = [], contasReceber = [], usuario, dataOperacao } = {}) {
  if (!comanda?.id) throw new Error('Comanda é obrigatória para registrar o recebimento.');
  const contasPorIndice = new Map((contasReceber || []).map((conta, indice) => [indice, conta]));
  const registros = [];
  (pagamentos || []).forEach((pagamento, indice) => {
    const meioPagamento = texto(pagamento?.meio, 40).toLowerCase() || 'dinheiro';
    const conta = meioPagamento === 'conta' ? contasPorIndice.get(registros.filter((registro) => registro.meioPagamento === 'conta').length) : null;
    const pendente = meioPagamento === 'conta';
    registros.push(registrarLancamento(empresaId, {
      tipo: 'receita',
      categoria: 'Bar/Lanchonete',
      descricao: `Comanda ${comanda.id} — ${comanda.nome || comanda.mesa || 'Atendimento'} (${meioPagamento})`,
      valor: pagamento?.valor,
      origem: 'comanda',
      status: pendente ? 'pendente' : 'pago',
      vencimento: pendente ? conta?.dataVencimento : dataOperacao,
      dataOperacao,
      pagoEm: pendente ? null : dataOperacao,
      meioPagamento,
      referencia: {
        comandaId: comanda.id,
        contaReceberId: conta?.id,
        clienteId: conta?.clienteId,
      },
      usuario,
      automatico: true,
      chaveIdempotencia: `comanda:${comanda.id}:pagamento:${pagamento?.id || indice}`,
    }));
  });
  return registros;
}

export function registrarEntradaEstoque(empresaId, { produtoId, produtoNome, qtd, custo, valorTotal, fornecedorId, documento, usuario, dataOperacao, meioPagamento, status = 'pendente', movimentoId } = {}) {
  const quantidade = Number(qtd || 0);
  const custoUnitario = Number(custo || 0);
  const valor = valorTotal === undefined ? valorMonetario(quantidade * custoUnitario) : valorMonetario(valorTotal);
  if (!produtoId || quantidade <= 0 || !Number.isFinite(custoUnitario) || custoUnitario <= 0 || valor <= 0) return null;
  return registrarLancamento(empresaId, {
    tipo: 'despesa',
    categoria: 'Alimentação/Bebidas',
    descricao: `Entrada de estoque — ${texto(produtoNome || produtoId, 160)} (${quantidade} un.)`,
    valor,
    origem: 'estoque',
    status,
    vencimento: dataOperacao,
    dataOperacao,
    pagoEm: status === 'pago' ? dataOperacao : null,
    meioPagamento,
    referencia: { produtoId, fornecedorId, documentoId: documento, movimentoId },
    usuario,
    automatico: true,
    chaveIdempotencia: movimentoId ? `estoque:${movimentoId}` : '',
  });
}

export function sincronizarContaReceber(empresaId, conta, { usuario, meioPagamento } = {}) {
  if (!conta?.id) return null;
  const store = storeEmpresa(empresaId);
  const existente = Object.values(store.lancamentos).find((item) => item.referencia?.contaReceberId === conta.id);
  const statusConta = conta.status === 'paga' ? 'pago' : 'pendente';
  if (existente) {
    return atualizarLancamento(empresaId, existente.id, {
      status: statusConta,
      pagoEm: conta.dataPagamento || null,
      vencimento: conta.dataVencimento,
      meioPagamento: meioPagamento || existente.meioPagamento,
      observacao: conta.observacao || existente.observacao,
    }, { permitirAutomatico: true });
  }
  return registrarLancamento(empresaId, {
    tipo: 'receita',
    categoria: 'Bar/Lanchonete',
    descricao: conta.descricao || `Conta a receber ${conta.id}`,
    valor: conta.valor,
    origem: 'contas_receber',
    status: statusConta,
    vencimento: conta.dataVencimento,
    dataOperacao: conta.criadoEm,
    pagoEm: conta.dataPagamento,
    meioPagamento: meioPagamento || 'conta',
    referencia: { contaReceberId: conta.id, clienteId: conta.clienteId },
    usuario,
    automatico: true,
    chaveIdempotencia: `conta-receber:${conta.id}`,
  });
}

export function fecharDia(empresaId, data, usuario = 'sistema@kytto.local') {
  const store = storeEmpresa(empresaId);
  const dia = dataCurta(data);
  const existente = store.fechamentos[dia];
  if (existente) return { ...existente, criadoAgora: false };
  const lancamentos = listarLancamentos(empresaId).filter((item) => item.dataOperacao.slice(0, 10) === dia && item.status !== 'cancelado');
  const recebimentos = lancamentos.filter((item) => item.tipo === 'receita' && item.status === 'pago').reduce((soma, item) => soma + item.valor, 0);
  const pagamentos = lancamentos.filter((item) => item.tipo === 'despesa' && item.status === 'pago').reduce((soma, item) => soma + item.valor, 0);
  const pendenteReceber = lancamentos.filter((item) => item.tipo === 'receita' && item.status === 'pendente').reduce((soma, item) => soma + item.valor, 0);
  const pendentePagar = lancamentos.filter((item) => item.tipo === 'despesa' && item.status === 'pendente').reduce((soma, item) => soma + item.valor, 0);
  const fechamento = {
    id: `fin-fec-${empresaId}-${dia}`,
    empresaId: String(empresaId),
    data: dia,
    recebimentos: valorMonetario(recebimentos),
    pagamentos: valorMonetario(pagamentos),
    pendenteReceber: valorMonetario(pendenteReceber),
    pendentePagar: valorMonetario(pendentePagar),
    saldoDia: valorMonetario(recebimentos - pagamentos),
    totalLancamentos: lancamentos.length,
    responsavel: texto(usuario, 120),
    criadoEm: agora(),
  };
  store.fechamentos[dia] = fechamento;
  return { ...fechamento, criadoAgora: true };
}

export function listarFechamentos(empresaId) {
  const store = storeEmpresa(empresaId);
  return Object.values(store.fechamentos)
    .filter((item) => item.empresaId === String(empresaId))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)))
    .map((item) => ({ ...item }));
}

export function resumoFinanceiro(empresaId, { hoje = dataCurta(agora()) } = {}) {
  const lancamentos = listarLancamentos(empresaId);
  const mesAtual = String(hoje).slice(0, 7);
  const ativos = lancamentos.filter((item) => item.status !== 'cancelado');
  const receitasPagas = ativos.filter((item) => item.tipo === 'receita' && item.status === 'pago');
  const despesasPagas = ativos.filter((item) => item.tipo === 'despesa' && item.status === 'pago');
  const receitasMes = receitasPagas.filter((item) => item.pagoEm?.slice(0, 7) === mesAtual);
  const despesasMes = despesasPagas.filter((item) => item.pagoEm?.slice(0, 7) === mesAtual);
  const aReceber = ativos.filter((item) => item.tipo === 'receita' && item.status === 'pendente');
  const aPagar = ativos.filter((item) => item.tipo === 'despesa' && item.status === 'pendente');
  const recBar = receitasPagas.filter((item) => item.origem === 'comanda').reduce((soma, item) => soma + item.valor, 0);
  const inadimplentes = aReceber.filter((item) => item.vencimento < hoje).length;

  const totalReceitas = receitasPagas.reduce((soma, item) => soma + item.valor, 0);
  const totalDespesas = despesasPagas.reduce((soma, item) => soma + item.valor, 0);
  return {
    empresaId: String(empresaId), hoje, mesAtual,
    saldo: valorMonetario(totalReceitas - totalDespesas),
    totalReceitas: valorMonetario(totalReceitas),
    totalDespesas: valorMonetario(totalDespesas),
    recBar: valorMonetario(recBar),
    recMes: valorMonetario(receitasMes.reduce((soma, item) => soma + item.valor, 0)),
    despMes: valorMonetario(despesasMes.reduce((soma, item) => soma + item.valor, 0)),
    aReceber: valorMonetario(aReceber.reduce((soma, item) => soma + item.valor, 0)),
    aPagar: valorMonetario(aPagar.reduce((soma, item) => soma + item.valor, 0)),
    inadimplentes,
    mensRecebidas: 0,
    mensPendentes: 0,
    mensVencidas: 0,
    inscRec: 0,
  };
}

export function fluxoFinanceiro(empresaId, meses = 12, dataReferencia = agora()) {
  const referencia = new Date(dataReferencia || agora());
  const periodo = [];
  for (let i = Math.max(1, meses) - 1; i >= 0; i -= 1) {
    const data = new Date(referencia.getFullYear(), referencia.getMonth() - i, 1);
    periodo.push(`${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`);
  }
  const lancamentos = listarLancamentos(empresaId);
  return periodo.map((mes) => {
    const pagos = lancamentos.filter((item) => item.status === 'pago' && item.pagoEm?.slice(0, 7) === mes);
    const receitas = pagos.filter((item) => item.tipo === 'receita').reduce((soma, item) => soma + item.valor, 0);
    const despesas = pagos.filter((item) => item.tipo === 'despesa').reduce((soma, item) => soma + item.valor, 0);
    return { mes, receitas: valorMonetario(receitas), despesas: valorMonetario(despesas), saldo: valorMonetario(receitas - despesas) };
  });
}

export const CATEGORIAS_FINANCEIRAS = {
  receita: ['Mensalidade', 'Inscrição Torneio', 'Ingresso Evento', 'Bar/Lanchonete', 'Loja', 'Aula/Escola', 'Patrocínio', 'Aluguel de Quadra', 'Outros'],
  despesa: ['Pessoal/RH', 'Manutenção', 'Utilities (Água/Luz)', 'Material Esportivo', 'Alimentação/Bebidas', 'Marketing', 'Equipamentos', 'Impostos/Taxas', 'Serviços Terceiros', 'Outros'],
};

export { dataCurta };

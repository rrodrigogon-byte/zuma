// ============================================================================
// CAIXA DIÁRIO KYTTO
// Persistência JSON multientidade para abertura, sangria, suprimento e fechamento.
// ============================================================================

import { db, save } from './db.js';

const agora = () => new Date().toISOString();
const texto = (valor, limite = 300) => String(valor ?? '').trim().slice(0, limite);
const dinheiro = (valor) => Number(Number(valor || 0).toFixed(2));

// Data do caixa no fuso da unidade: um caixa aberto às 21h de Cuiabá é do mesmo dia.
export function dataDia(valor = agora()) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''))) return String(valor);
  const data = new Date(valor || agora());
  if (Number.isNaN(data.valueOf())) throw new Error('Data operacional inválida.');
  return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.KYTTO_TIMEZONE || 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(data);
}

function storeEmpresa(empresaId, criar = true) {
  const estado = db();
  const chave = String(empresaId || 'emp-kytto-001');
  const existente = estado.caixaKytto?.empresas?.[chave];
  if (!criar && !existente) return { caixas: {}, movimentos: {} };
  estado.caixaKytto ||= { empresas: {} };
  estado.caixaKytto.empresas ||= {};
  estado.caixaKytto.empresas[chave] ||= { caixas: {}, movimentos: {} };
  const store = estado.caixaKytto.empresas[chave];
  store.caixas ||= {};
  store.movimentos ||= {};
  return store;
}

function serializarCaixa(caixa) {
  return { ...caixa };
}

export function abrirCaixa(empresaId, dados = {}) {
  const numeroCaixa = Math.floor(Number(dados.numeroCaixa ?? dados.numero_caixa));
  const valorAbertura = dinheiro(dados.valorAbertura ?? dados.valor_abertura);
  if (!Number.isInteger(numeroCaixa) || numeroCaixa < 1) throw new Error('Número do caixa é obrigatório.');
  if (!Number.isFinite(valorAbertura) || valorAbertura < 0) throw new Error('Valor de abertura não pode ser negativo.');
  const data = dataDia(dados.dataOperacao);
  const lojaId = texto(dados.lojaId ?? dados.loja_id, 120) || null;
  const store = storeEmpresa(empresaId);
  const existente = Object.values(store.caixas).find((item) => item.numeroCaixa === numeroCaixa && item.data === data && item.status === 'aberto' && (item.lojaId || null) === lojaId);
  if (existente) throw new Error('Já existe um caixa aberto para este número e data.');
  const idUnidade = encodeURIComponent(lojaId || 'corporativo');
  const id = `cx-${empresaId}-${data}-${idUnidade}-${numeroCaixa}`;
  const caixa = {
    id,
    empresaId: String(empresaId),
    numeroCaixa,
    data,
    lojaId,
    valorAbertura,
    status: 'aberto',
    observacao: texto(dados.observacao),
    responsavel: texto(dados.usuario || 'sistema@kytto.local', 120),
    abertoEm: dados.dataOperacao ? new Date(dados.dataOperacao).toISOString() : agora(),
    fechadoEm: null,
    valorEsperado: null,
    valorInformado: null,
    divergencia: null,
    criadoEm: agora(),
    atualizadoEm: agora(),
  };
  store.caixas[id] = caixa;
  return serializarCaixa(caixa);
}

export function obterCaixa(empresaId, caixaId) {
  const caixa = storeEmpresa(empresaId, false).caixas[String(caixaId)];
  return caixa?.empresaId === String(empresaId) ? serializarCaixa(caixa) : null;
}

export function listarCaixas(empresaId, filtros = {}) {
  const data = filtros.data ? dataDia(filtros.data) : '';
  const dataInicio = filtros.dataInicio ? dataDia(filtros.dataInicio) : '';
  const dataFim = filtros.dataFim ? dataDia(filtros.dataFim) : '';
  const status = texto(filtros.status, 20).toLowerCase();
  return Object.values(storeEmpresa(empresaId, false).caixas)
    .filter((item) => item.empresaId === String(empresaId))
    .filter((item) => !data || item.data === data || item.status === 'aberto')
    .filter((item) => !dataInicio || item.data >= dataInicio)
    .filter((item) => !dataFim || item.data <= dataFim)
    .filter((item) => !status || item.status === status)
    .filter((item) => !filtros.lojaId || item.lojaId === String(filtros.lojaId))
    .sort((a, b) => String(b.abertoEm).localeCompare(String(a.abertoEm)))
    .map(serializarCaixa);
}

export function registrarMovimento(empresaId, dados = {}) {
  const caixa = storeEmpresa(empresaId).caixas[String(dados.caixaId || dados.caixa_id)];
  if (!caixa || caixa.empresaId !== String(empresaId)) throw new Error('Caixa não encontrado na empresa ativa.');
  if (dados.lojaId && caixa.lojaId !== String(dados.lojaId)) throw new Error('Caixa não pertence à unidade ativa.');
  if (caixa.status !== 'aberto') throw new Error('O caixa deve estar aberto para receber movimentações.');
  const tipo = String(dados.tipo || '').toLowerCase();
  if (!['sangria', 'suprimento'].includes(tipo)) throw new Error('Movimentação deve ser sangria ou suprimento.');
  const valor = dinheiro(dados.valor);
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('Valor da movimentação deve ser positivo.');
  const store = storeEmpresa(empresaId);
  const id = `cxmov-${Date.now().toString(36)}-${Object.keys(store.movimentos).length + 1}`;
  const movimento = {
    id,
    empresaId: String(empresaId),
    lojaId: caixa.lojaId || null,
    caixaId: caixa.id,
    tipo,
    valor,
    descricao: texto(dados.descricao),
    usuario: texto(dados.usuario || 'sistema@kytto.local', 120),
    dataOperacao: dados.dataOperacao ? new Date(dados.dataOperacao).toISOString() : agora(),
    criadoEm: agora(),
  };
  store.movimentos[id] = movimento;
  caixa.atualizadoEm = agora();
  return { ...movimento };
}

export function registrarRecebimento(empresaId, dados = {}) {
  const caixaId = String(dados.caixaId || dados.caixa_id || '');
  const caixa = storeEmpresa(empresaId).caixas[caixaId];
  if (!caixa || caixa.empresaId !== String(empresaId)) throw new Error('Caixa não encontrado na empresa ativa.');
  if (dados.lojaId && caixa.lojaId !== String(dados.lojaId)) throw new Error('Caixa não pertence à unidade ativa.');
  if (caixa.status !== 'aberto') throw new Error('O caixa deve estar aberto para receber movimentações.');
  const valor = dinheiro(dados.valor);
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('Valor do recebimento deve ser positivo.');
  const store = storeEmpresa(empresaId);
  const chaveIdempotencia = texto(dados.chaveIdempotencia ?? dados.chave_idempotencia, 220);
  if (chaveIdempotencia) {
    const existente = Object.values(store.movimentos).find((item) => item.tipo === 'recebimento' && item.chaveIdempotencia === chaveIdempotencia);
    if (existente) return { ...existente };
  }
  const id = `cxrec-${Date.now().toString(36)}-${Object.keys(store.movimentos).length + 1}`;
  const movimento = {
    id, empresaId: String(empresaId), lojaId: caixa.lojaId || null, caixaId: caixa.id,
    tipo: 'recebimento', valor, descricao: texto(dados.descricao || 'Recebimento em dinheiro'),
    usuario: texto(dados.usuario || 'sistema@kytto.local', 120),
    referencia: texto(dados.referencia || '', 160) || null,
    chaveIdempotencia: chaveIdempotencia || null,
    dataOperacao: dados.dataOperacao ? new Date(dados.dataOperacao).toISOString() : agora(), criadoEm: agora(),
  };
  store.movimentos[id] = movimento;
  caixa.atualizadoEm = agora();
  return { ...movimento };
}

// Estorno de recebimento é um movimento compensatório: o recebimento original
// permanece intacto para auditoria e fechamento histórico. Pode ser registrado
// mesmo depois do fechamento do caixa, desde que a origem pertença à mesma
// empresa/unidade. A chave é única no escopo da empresa e evita duplicação em
// retries do coordenador de estorno.
export function registrarEstornoRecebimento(empresaId, dados = {}) {
  const lojaId = texto(dados.lojaId ?? dados.loja_id, 120);
  if (!lojaId) throw new Error('lojaId é obrigatório para estornar recebimento.');
  const originalId = texto(dados.movimentoOriginalId ?? dados.movimento_original_id ?? dados.recebimentoId ?? dados.recebimento_id, 180);
  if (!originalId) throw new Error('movimentoOriginalId é obrigatório para estornar recebimento.');
  const actionId = texto(dados.actionId ?? dados.action_id, 180);
  const chave = texto(dados.idempotencyKey ?? dados.idempotency_key ?? dados.chaveIdempotencia ?? dados.chave_idempotencia ?? actionId, 220);
  if (!actionId || !chave) throw new Error('actionId e idempotencyKey são obrigatórios para estornar recebimento.');
  const motivo = texto(dados.motivo ?? dados.reason, 300);
  if (!motivo) throw new Error('Motivo é obrigatório para estornar recebimento.');
  const store = storeEmpresa(empresaId);
  const original = store.movimentos[originalId];
  if (!original || original.empresaId !== String(empresaId) || original.tipo !== 'recebimento' || original.lojaId !== lojaId) {
    throw new Error('Recebimento original não encontrado na empresa/unidade ativa.');
  }
  const valor = dinheiro(dados.valor ?? original.valor);
  if (!(valor > 0) || valor > Number(original.valor || 0)) throw new Error('Valor do estorno de recebimento inválido.');
  const existente = Object.values(store.movimentos).find((item) => item.tipo === 'estorno_recebimento' && item.chaveIdempotencia === chave);
  if (existente) {
    if (existente.movimentoOriginalId !== original.id || Number(existente.valor) !== valor || existente.actionId !== actionId) {
      throw Object.assign(new Error('A chave de estorno do caixa foi reutilizada com dados divergentes.'), { code: 'CASH_REVERSAL_IDEMPOTENCY_CONFLICT', status: 409 });
    }
    return { ...existente, replayed: true, idempotente: true };
  }
  const jaEstornado = Object.values(store.movimentos)
    .filter((item) => item.tipo === 'estorno_recebimento' && item.movimentoOriginalId === original.id)
    .reduce((total, item) => total + Number(item.valor || 0), 0);
  if (jaEstornado + valor > Number(original.valor || 0) + 0.001) {
    throw Object.assign(new Error('O recebimento já possui estorno integral.'), { code: 'CASH_REVERSAL_ALREADY_EXISTS', status: 409 });
  }
  const id = `cxest-${Date.now().toString(36)}-${Object.keys(store.movimentos).length + 1}`;
  const movimento = {
    id,
    empresaId: String(empresaId),
    lojaId,
    caixaId: original.caixaId,
    tipo: 'estorno_recebimento',
    valor,
    valorEfeito: -valor,
    movimentoOriginalId: original.id,
    actionId,
    motivo,
    descricao: texto(dados.descricao || `Estorno do recebimento ${original.id}`),
    usuario: texto(dados.usuario || 'sistema@kytto.local', 120),
    referencia: texto(dados.referencia || original.referencia || '', 160) || null,
    chaveIdempotencia: chave,
    dataOperacao: dados.dataOperacao ? new Date(dados.dataOperacao).toISOString() : agora(),
    criadoEm: agora(),
  };
  store.movimentos[id] = movimento;
  const caixa = store.caixas[String(original.caixaId)];
  if (caixa) caixa.atualizadoEm = agora();
  save();
  return { ...movimento, replayed: false, idempotente: false };
}

export function movimentosDoCaixa(empresaId, caixaId) {
  return Object.values(storeEmpresa(empresaId, false).movimentos)
    .filter((item) => item.empresaId === String(empresaId) && item.caixaId === String(caixaId))
    .sort((a, b) => String(a.dataOperacao).localeCompare(String(b.dataOperacao)))
    .map((item) => ({ ...item }));
}

export function fecharCaixa(empresaId, dados = {}) {
  const caixa = storeEmpresa(empresaId).caixas[String(dados.caixaId || dados.caixa_id)];
  if (!caixa || caixa.empresaId !== String(empresaId)) throw new Error('Caixa não encontrado na empresa ativa.');
  if (dados.lojaId && caixa.lojaId !== String(dados.lojaId)) throw new Error('Caixa não pertence à unidade ativa.');
  if (caixa.status !== 'aberto') throw new Error('O caixa já está fechado.');
  const movimentos = movimentosDoCaixa(empresaId, caixa.id);
  const recebimentosRegistrados = movimentos.filter((item) => item.tipo === 'recebimento').reduce((soma, item) => soma + item.valor, 0);
  const estornosRecebimento = movimentos.filter((item) => item.tipo === 'estorno_recebimento').reduce((soma, item) => soma + item.valor, 0);
  const recebimentosDinheiro = dinheiro(recebimentosRegistrados - estornosRecebimento);
  const sangrias = movimentos.filter((item) => item.tipo === 'sangria').reduce((soma, item) => soma + item.valor, 0);
  const suprimentos = movimentos.filter((item) => item.tipo === 'suprimento').reduce((soma, item) => soma + item.valor, 0);
  const valorEsperado = dinheiro(caixa.valorAbertura + recebimentosDinheiro + suprimentos - sangrias);
  const valorInformado = dinheiro(dados.valorInformado ?? dados.valor_informado ?? valorEsperado);
  if (!Number.isFinite(valorInformado) || valorInformado < 0) throw new Error('Valor informado no fechamento é inválido.');
  caixa.status = 'fechado';
  caixa.valorEsperado = valorEsperado;
  caixa.valorInformado = valorInformado;
  caixa.divergencia = dinheiro(valorInformado - valorEsperado);
  caixa.fechadoEm = dados.dataOperacao ? new Date(dados.dataOperacao).toISOString() : agora();
  caixa.observacaoFechamento = texto(dados.observacao);
  caixa.atualizadoEm = agora();
  return {
    caixa: serializarCaixa(caixa),
    movimentos,
    resumo: { recebimentosDinheiro, recebimentosRegistrados: dinheiro(recebimentosRegistrados), estornosRecebimento: dinheiro(estornosRecebimento), recebimentosLiquidos: recebimentosDinheiro, sangrias: dinheiro(sangrias), suprimentos: dinheiro(suprimentos), valorEsperado, valorInformado, divergencia: caixa.divergencia },
  };
}

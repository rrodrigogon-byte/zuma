// KYTTO — Ponte fiscal governada da Barbearia.
// Prepara rascunhos auditáveis; nunca emite, transmite ou simula documento fiscal.

import { db, save as saveFn } from './db.js';

const texto = (valor, limite = 240) => String(valor ?? '').trim().slice(0, limite);
const dinheiro = (valor) => Number(Math.max(0, Number(valor || 0)).toFixed(2));
const agora = () => new Date().toISOString();

function storeFiscal(empresaId) {
  const raiz = db();
  const chave = String(empresaId || '');
  raiz.barbeariaFiscal ||= { empresas: {} };
  raiz.barbeariaFiscal.empresas[chave] ||= { documentos: {} };
  return raiz.barbeariaFiscal.empresas[chave];
}

function itensNormalizados(itens = []) {
  if (!Array.isArray(itens) || itens.length === 0) throw new Error('Inclua ao menos um item no rascunho fiscal.');
  return itens.slice(0, 200).map((item, indice) => {
    const descricao = texto(item?.descricao ?? item?.nome, 180);
    const quantidade = Math.max(0.001, Number(item?.quantidade ?? item?.qtd ?? 1));
    const valorUnitario = dinheiro(item?.valorUnitario ?? item?.precoUnitario ?? item?.preco);
    if (!descricao || !Number.isFinite(quantidade) || valorUnitario <= 0) throw new Error(`Item fiscal ${indice + 1} inválido.`);
    return {
      tipo: ['servico', 'produto'].includes(String(item?.tipo)) ? String(item.tipo) : 'servico',
      descricao,
      quantidade: Number(quantidade.toFixed(3)),
      valorUnitario,
      total: dinheiro(item?.total ?? item?.subtotal ?? quantidade * valorUnitario),
      referenciaId: texto(item?.referenciaId ?? item?.servicoId ?? item?.produtoId, 120) || null,
    };
  });
}

export function prepararDocumentoFiscal(empresaId, dados = {}) {
  const empresa = String(empresaId || '');
  if (!empresa) throw new Error('Empresa ativa não informada.');
  if (dados.confirmado !== true) throw new Error('A confirmação explícita do rascunho fiscal é obrigatória.');
  const lojaId = texto(dados.lojaId ?? dados.loja_id, 120);
  const origemTipo = texto(dados.origemTipo ?? dados.origem_tipo, 40).toLowerCase();
  const origemId = texto(dados.origemId ?? dados.origem_id, 120);
  const chaveIdempotencia = texto(dados.chaveIdempotencia ?? dados.chave_idempotencia, 220);
  if (!lojaId || !['comanda', 'venda_revenda'].includes(origemTipo) || !origemId || !chaveIdempotencia) throw new Error('Loja, origem e chave de idempotência são obrigatórias.');
  const store = storeFiscal(empresa);
  const existente = Object.values(store.documentos).find((item) => item.chaveIdempotencia === chaveIdempotencia);
  if (existente) {
    if (existente.lojaId !== lojaId || existente.origemTipo !== origemTipo || existente.origemId !== origemId) throw new Error('A chave de idempotência já representa outro rascunho fiscal.');
    return { documento: { ...existente }, idempotente: true };
  }
  const itens = itensNormalizados(dados.itens);
  const subtotal = dinheiro(itens.reduce((soma, item) => soma + item.total, 0));
  const gorjeta = dinheiro(dados.gorjeta);
  const desconto = Math.min(subtotal + gorjeta, dinheiro(dados.desconto));
  const total = dinheiro(dados.total ?? subtotal + gorjeta - desconto);
  if (total <= 0 || Math.abs(total - dinheiro(subtotal + gorjeta - desconto)) > 0.02) throw new Error('Total do rascunho fiscal diverge dos itens, gorjeta e descontos informados.');
  const id = `fisc-${Date.now().toString(36)}-${String(Object.keys(store.documentos).length + 1).padStart(3, '0')}`;
  const timestamp = agora();
  const documento = {
    id,
    empresaId: empresa,
    lojaId,
    origemTipo,
    origemId,
    chaveIdempotencia,
    status: 'rascunho_pendente_integracao',
    itens,
    subtotal,
    gorjeta,
    desconto,
    total,
    destinatarioId: texto(dados.destinatarioId ?? dados.clienteId, 120) || null,
    observacoes: texto(dados.observacoes, 500),
    emissaoAutomatica: false,
    transmitido: false,
    numeroFiscal: null,
    provedor: null,
    criadoPor: texto(dados.usuario, 120) || null,
    criadoEm: timestamp,
    atualizadoEm: timestamp,
  };
  store.documentos[id] = documento;
  saveFn();
  return { documento: { ...documento }, idempotente: false };
}

export function listarDocumentosFiscais(empresaId, filtros = {}) {
  const empresa = String(empresaId || '');
  return Object.values(storeFiscal(empresa).documentos)
    .filter((item) => item.empresaId === empresa)
    .filter((item) => !filtros.lojaId || item.lojaId === String(filtros.lojaId))
    .filter((item) => !filtros.origemTipo || item.origemTipo === String(filtros.origemTipo))
    .filter((item) => !filtros.origemId || item.origemId === String(filtros.origemId))
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
}

export default { prepararDocumentoFiscal, listarDocumentosFiscais };

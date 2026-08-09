import crypto from 'node:crypto';
import { db, save } from './db.js';

function tenantKey(valor = 'principal') {
  return String(valor || 'principal').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'principal';
}
function texto(valor, tamanho = 160) { return String(valor ?? '').trim().slice(0, tamanho); }
function numero(valor, padrao = 0) { const n = Number(String(valor ?? '').replace(',', '.')); return Number.isFinite(n) ? n : padrao; }
function dinheiro(valor) { return Number(Math.max(0, numero(valor)).toFixed(2)); }
function quantidade(valor, padrao = 1) { return Number(Math.max(0.001, numero(valor, padrao)).toFixed(4)); }

function store() {
  const estado = db();
  estado.modificadoresCombosKytto ||= { gruposPorEmpresa: {}, combosPorEmpresa: {} };
  estado.modificadoresCombosKytto.gruposPorEmpresa ||= {};
  estado.modificadoresCombosKytto.combosPorEmpresa ||= {};
  return estado.modificadoresCombosKytto;
}
function grupos(empresaId) { const chave = tenantKey(empresaId); store().gruposPorEmpresa[chave] ||= {}; return store().gruposPorEmpresa[chave]; }
function combos(empresaId) { const chave = tenantKey(empresaId); store().combosPorEmpresa[chave] ||= {}; return store().combosPorEmpresa[chave]; }

function normalizarOpcao(raw = {}, indice = 0) {
  const nome = texto(raw.nome, 100);
  if (!nome) throw new Error(`A opção ${indice + 1} precisa de nome.`);
  const produtoId = texto(raw.produtoId, 100) || null;
  return {
    id: texto(raw.id, 100) || `opcao-${Date.now().toString(36)}-${indice + 1}-${crypto.randomBytes(2).toString('hex')}`,
    nome, ativo: raw.ativo !== false, precoAdicional: dinheiro(raw.precoAdicional ?? raw.preco ?? 0),
    custoAdicional: dinheiro(raw.custoAdicional ?? raw.custo ?? 0),
    produtoId, quantidadeEstoque: produtoId ? quantidade(raw.quantidadeEstoque ?? raw.qtd ?? 1) : 0,
    setor: texto(raw.setor, 30) || null,
  };
}

function normalizarGrupo(raw = {}, anterior = null) {
  const nome = texto(raw.nome, 100);
  if (!nome) throw new Error('Informe o nome do grupo de modificadores.');
  const opcoes = Array.isArray(raw.opcoes) ? raw.opcoes.map(normalizarOpcao) : (anterior?.opcoes || []);
  if (!opcoes.length) throw new Error('O grupo de modificadores precisa ter ao menos uma opção.');
  const minimo = Math.max(0, Math.floor(numero(raw.minimo ?? raw.min ?? anterior?.minimo, 0)));
  const maximo = Math.max(minimo, Math.floor(numero(raw.maximo ?? raw.max ?? anterior?.maximo, 1)));
  return {
    id: texto(raw.id, 100) || anterior?.id || `grupo-mod-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    nome, descricao: texto(raw.descricao, 300), obrigatorio: raw.obrigatorio === true || minimo > 0,
    minimo, maximo, ativo: raw.ativo !== false,
    opcoes, atualizadoEm: new Date().toISOString(), criadoEm: anterior?.criadoEm || new Date().toISOString(),
  };
}

export function listarGruposModificadores(empresaId) {
  return Object.values(grupos(empresaId)).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')).map((grupo) => structuredClone(grupo));
}
export function criarGrupoModificadores(empresaId, raw) {
  const grupo = normalizarGrupo(raw); grupos(empresaId)[grupo.id] = grupo; save(); return structuredClone(grupo);
}
export function atualizarGrupoModificadores(empresaId, id, raw) {
  const atual = grupos(empresaId)[id]; if (!atual) throw new Error('Grupo de modificadores não encontrado.');
  const grupo = normalizarGrupo({ ...atual, ...raw, id }, atual); grupos(empresaId)[id] = grupo; save(); return structuredClone(grupo);
}
export function excluirGrupoModificadores(empresaId, id) {
  const atual = grupos(empresaId)[id]; if (!atual) throw new Error('Grupo de modificadores não encontrado.');
  delete grupos(empresaId)[id]; save(); return { id, nome: atual.nome };
}

export function resolverModificadoresProduto(empresaId, produto = {}, selecoes = []) {
  const ids = Array.isArray(produto.modificadorGrupoIds) ? produto.modificadorGrupoIds.map(String) : [];
  const catalogo = grupos(empresaId);
  const gruposAplicaveis = ids.map((id) => catalogo[id]).filter((grupo) => grupo?.ativo !== false);
  const lista = Array.isArray(selecoes) ? selecoes : [];
  const resultado = [];
  for (const grupo of gruposAplicaveis) {
    const escolhas = lista.filter((selecao) => String(selecao?.grupoId || '') === grupo.id);
    if (escolhas.length < grupo.minimo) throw new Error(`Selecione ao menos ${grupo.minimo} opção(ões) em “${grupo.nome}”.`);
    if (escolhas.length > grupo.maximo) throw new Error(`Selecione no máximo ${grupo.maximo} opção(ões) em “${grupo.nome}”.`);
    const opcaoPorId = new Map((grupo.opcoes || []).filter((opcao) => opcao.ativo !== false).map((opcao) => [opcao.id, opcao]));
    for (const selecao of escolhas) {
      const opcao = opcaoPorId.get(String(selecao?.opcaoId || ''));
      if (!opcao) throw new Error(`Opção inválida ou inativa para o grupo “${grupo.nome}”.`);
      resultado.push({ grupoId: grupo.id, grupo: grupo.nome, opcaoId: opcao.id, nome: opcao.nome, precoAdicional: dinheiro(opcao.precoAdicional), custoAdicional: dinheiro(opcao.custoAdicional), produtoId: opcao.produtoId, quantidadeEstoque: opcao.quantidadeEstoque, setor: opcao.setor });
    }
  }
  const gruposEnviados = new Set(lista.map((item) => String(item?.grupoId || '')).filter(Boolean));
  for (const grupoId of gruposEnviados) if (!ids.includes(grupoId)) throw new Error('Há modificador que não pertence ao produto selecionado.');
  return {
    itens: resultado,
    adicionalPreco: Number(resultado.reduce((soma, item) => soma + item.precoAdicional, 0).toFixed(2)),
    adicionalCusto: Number(resultado.reduce((soma, item) => soma + item.custoAdicional, 0).toFixed(2)),
  };
}

function normalizarComponente(raw = {}, indice = 0) {
  const produtoId = texto(raw.produtoId, 100);
  if (!produtoId) throw new Error(`Informe o produto do componente ${indice + 1}.`);
  const modificadores = Array.isArray(raw.modificadores)
    ? raw.modificadores.map((selecao) => ({ grupoId: texto(selecao?.grupoId, 100), opcaoId: texto(selecao?.opcaoId, 100) })).filter((selecao) => selecao.grupoId && selecao.opcaoId)
    : [];
  return { produtoId, qtd: quantidade(raw.qtd ?? raw.quantidade ?? 1), observacao: texto(raw.observacao, 200), modificadores };
}
function normalizarCombo(raw = {}, anterior = null) {
  const nome = texto(raw.nome, 120);
  if (!nome) throw new Error('Informe o nome do combo.');
  const componentes = Array.isArray(raw.componentes) ? raw.componentes.map(normalizarComponente) : (anterior?.componentes || []);
  if (!componentes.length) throw new Error('O combo precisa ter ao menos um componente.');
  return {
    id: texto(raw.id, 100) || anterior?.id || `combo-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    nome, descricao: texto(raw.descricao, 300), preco: dinheiro(raw.preco ?? anterior?.preco), setor: texto(raw.setor, 30) || 'bar',
    componentes, ativo: raw.ativo !== false, criadoEm: anterior?.criadoEm || new Date().toISOString(), atualizadoEm: new Date().toISOString(),
  };
}
export function listarCombos(empresaId) { return Object.values(combos(empresaId)).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')).map((combo) => structuredClone(combo)); }
export function criarCombo(empresaId, raw) { const combo = normalizarCombo(raw); combos(empresaId)[combo.id] = combo; save(); return structuredClone(combo); }
export function atualizarCombo(empresaId, id, raw) { const atual = combos(empresaId)[id]; if (!atual) throw new Error('Combo não encontrado.'); const combo = normalizarCombo({ ...atual, ...raw, id }, atual); combos(empresaId)[id] = combo; save(); return structuredClone(combo); }
export function excluirCombo(empresaId, id) { const atual = combos(empresaId)[id]; if (!atual) throw new Error('Combo não encontrado.'); delete combos(empresaId)[id]; save(); return { id, nome: atual.nome }; }
export function obterCombo(empresaId, id) { const combo = combos(empresaId)[String(id)]; return combo ? structuredClone(combo) : null; }

export default { listarGruposModificadores, criarGrupoModificadores, atualizarGrupoModificadores, excluirGrupoModificadores, resolverModificadoresProduto, listarCombos, criarCombo, atualizarCombo, excluirCombo, obterCombo };

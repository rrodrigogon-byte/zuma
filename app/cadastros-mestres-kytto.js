// KYTTO — Base cadastral mestre multientidade (persistência JSON/GCS)
// Todos os registros são fisicamente segregados por empresaId e jamais devem ser
// acessados fora do escopo resolvido pela sessão autenticada.

import { db, save } from './db.js';
import { normalizarPerfis, resumoAcessoUsuario, tipoDoUsuario, validarConfiguracaoUsuario } from './perfis-usuarios-kytto.js';

export const EMPRESA_PADRAO_ID = 'emp-kytto-001';

function agora() { return new Date().toISOString(); }
function texto(valor, limite = 160) { return String(valor ?? '').trim().slice(0, limite); }
function numeroNaoNegativo(valor) { return Math.max(0, Number(valor || 0) || 0); }
function cnpjNormalizado(valor) { return String(valor ?? '').replace(/\D/g, ''); }
function id(prefixo) { return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }

const MODULOS_INICIAIS = ['pdv', 'fiscal', 'financeiro', 'estoque', 'compras', 'cardapio', 'mesas', 'kds', 'pagamentos'];

function base() {
  const estado = db();
  if (!estado.cadastrosMestresKytto || typeof estado.cadastrosMestresKytto !== 'object') {
    estado.cadastrosMestresKytto = {};
  }
  const store = estado.cadastrosMestresKytto;
  store.empresas ||= {};
  store.usuarios ||= {};
  store.funcionarios ||= {};
  store.fornecedores ||= {};
  return store;
}

function bucket(tipo, empresaId) {
  const store = base();
  store[tipo] ||= {};
  store[tipo][empresaId] ||= {};
  return store[tipo][empresaId];
}

function empresaPadrao() {
  return {
    id: EMPRESA_PADRAO_ID,
    nome: 'Kytto Clube Tangará',
    nomeFantasia: 'Kytto — Sistemas Inteligentes para Negócios',
    cnpj: '54.518.772/0001-49',
    inscricaoEstadual: '',
    endereco: 'Tangará da Serra, Mato Grosso, Brasil',
    telefone: '',
    email: 'contato@kytto.com.br',
    ativa: true,
    plano: 'premium',
    modulos: ['pdv', 'fiscal', 'financeiro', 'estoque', 'compras', 'rh', 'cardapio', 'mesas'],
    permitirEstoqueNegativo: true,
    criadaEm: agora(),
    atualizadaEm: agora(),
  };
}

export function garantirEmpresaPadrao() {
  const store = base();
  if (!store.empresas[EMPRESA_PADRAO_ID]) {
    store.empresas[EMPRESA_PADRAO_ID] = empresaPadrao();
    save();
  }
  return store.empresas[EMPRESA_PADRAO_ID];
}

export function obterEmpresa(empresaId) {
  garantirEmpresaPadrao();
  return base().empresas[String(empresaId || '')] || null;
}

export function listarEmpresas({ incluirInativas = false } = {}) {
  garantirEmpresaPadrao();
  return Object.values(base().empresas)
    .filter((empresa) => incluirInativas || empresa.ativa !== false)
    .sort((a, b) => String(a.nomeFantasia || a.nome).localeCompare(String(b.nomeFantasia || b.nome), 'pt-BR'));
}

export function criarEmpresa(payload = {}) {
  const nome = texto(payload.nome, 160);
  if (!nome) throw new Error('Nome da empresa é obrigatório.');
  const cnpj = texto(payload.cnpj, 20);
  const documento = cnpjNormalizado(cnpj);
  if (documento && documento.length !== 14) throw new Error('Informe um CNPJ com 14 dígitos ou deixe o campo em branco durante o rascunho.');
  const store = base();
  if (documento && Object.values(store.empresas).some((empresa) => cnpjNormalizado(empresa.cnpj) === documento)) {
    throw new Error('Já existe uma empresa cadastrada com este CNPJ.');
  }
  const empresa = {
    id: id('emp'),
    nome,
    nomeFantasia: texto(payload.nomeFantasia || payload.nome_fantasia, 160) || nome,
    cnpj,
    cnpjNormalizado: documento,
    inscricaoEstadual: texto(payload.inscricaoEstadual || payload.inscricao_estadual, 30),
    endereco: texto(payload.endereco, 240),
    telefone: texto(payload.telefone, 30),
    email: texto(payload.email, 120).toLowerCase(),
    ativa: payload.ativa !== false,
    plano: texto(payload.plano, 40) || 'standard',
    modulos: Array.isArray(payload.modulos)
      ? payload.modulos.map((modulo) => texto(modulo, 40)).filter(Boolean)
      : [...MODULOS_INICIAIS],
    permitirEstoqueNegativo: payload.permitirEstoqueNegativo !== false,
    statusOnboarding: ['rascunho', 'configuracao', 'pronta'].includes(String(payload.statusOnboarding)) ? String(payload.statusOnboarding) : 'configuracao',
    criadoPorUsuarioId: texto(payload.criadoPorUsuarioId, 80),
    criadaEm: agora(),
    atualizadaEm: agora(),
  };
  store.empresas[empresa.id] = empresa;
  save();
  return empresa;
}

export function atualizarEmpresa(empresaId, payload = {}) {
  const empresa = obterEmpresa(empresaId);
  if (!empresa) return null;
  const campos = ['nome', 'nomeFantasia', 'inscricaoEstadual', 'endereco', 'telefone', 'email', 'plano'];
  for (const campo of campos) {
    if (payload[campo] !== undefined) empresa[campo] = texto(payload[campo], campo === 'endereco' ? 240 : 160);
  }
  if (payload.cnpj !== undefined) {
    const cnpj = texto(payload.cnpj, 20);
    const documento = cnpjNormalizado(cnpj);
    if (documento && documento.length !== 14) throw new Error('Informe um CNPJ com 14 dígitos ou deixe o campo em branco durante o rascunho.');
    const duplicada = documento && Object.values(base().empresas).some((item) => item.id !== empresa.id && cnpjNormalizado(item.cnpj) === documento);
    if (duplicada) throw new Error('Já existe outra empresa cadastrada com este CNPJ.');
    empresa.cnpj = cnpj;
    empresa.cnpjNormalizado = documento;
  }
  if (payload.ativa !== undefined) empresa.ativa = Boolean(payload.ativa);
  if (Array.isArray(payload.modulos)) empresa.modulos = payload.modulos.map((modulo) => texto(modulo, 40)).filter(Boolean);
  if (payload.permitirEstoqueNegativo !== undefined) empresa.permitirEstoqueNegativo = Boolean(payload.permitirEstoqueNegativo);
  if (payload.statusOnboarding !== undefined && ['rascunho', 'configuracao', 'pronta'].includes(String(payload.statusOnboarding))) {
    empresa.statusOnboarding = String(payload.statusOnboarding);
  }
  empresa.atualizadaEm = agora();
  save();
  return empresa;
}

function normalizarUsuario(payload = {}) {
  const tipoUsuario = tipoDoUsuario(payload);
  const perfis = normalizarPerfis(payload.perfis || payload.roles || [payload.role || payload.tipo], tipoUsuario);
  const acesso = resumoAcessoUsuario({ ...payload, tipoUsuario, perfis });
  return {
    nome: texto(payload.nome, 120),
    email: texto(payload.email, 120).toLowerCase(),
    telefone: texto(payload.telefone, 30),
    tipoUsuario: acesso.tipoUsuario,
    perfis: acesso.perfis,
    // Compatibilidade transitória com integrações antigas que ainda leem roles.
    roles: acesso.perfis,
    role: acesso.perfis[0] || 'operador_pdv',
    permissoes: acesso.permissoes,
    permissoesExtras: payload.permissoesExtras && typeof payload.permissoesExtras === 'object' && !Array.isArray(payload.permissoesExtras) ? payload.permissoesExtras : {},
    ativo: payload.ativo !== false,
    funcionarioId: texto(payload.funcionarioId || payload.funcionario_id, 80),
    platformAdmin: Boolean(payload.platformAdmin),
    platformConsultor: Boolean(payload.platformConsultor),
  };
}

export function criarUsuario(empresaId, payload = {}) {
  if (!obterEmpresa(empresaId)?.ativa) throw new Error('Empresa não encontrada ou inativa.');
  const configuracao = validarConfiguracaoUsuario(payload);
  const dados = normalizarUsuario({ ...payload, ...configuracao });
  if (!dados.nome || !dados.email) throw new Error('Nome e email do usuário são obrigatórios.');
  const usuarios = bucket('usuarios', empresaId);
  const existente = Object.values(usuarios).find((usuario) => usuario.email === dados.email);
  if (existente) throw new Error('Já existe um usuário com este email nesta empresa.');
  const empresasAcessiveis = Array.isArray(payload.empresasAcessiveis)
    ? [...new Set(payload.empresasAcessiveis.map((item) => texto(item, 80)).filter(Boolean))]
    : [empresaId];
  if (!empresasAcessiveis.includes(empresaId)) empresasAcessiveis.unshift(empresaId);
  const usuario = { id: id('usr'), empresaId, empresasAcessiveis, ...dados, senhaHash: texto(payload.senhaHash, 250), criadoEm: agora(), atualizadoEm: agora() };
  usuarios[usuario.id] = usuario;
  save();
  return usuario;
}

export function atualizarUsuario(empresaId, usuarioId, payload = {}) {
  const usuario = bucket('usuarios', empresaId)[usuarioId];
  if (!usuario || usuario.empresaId !== empresaId) return null;
  const configuracao = validarConfiguracaoUsuario({
    tipoUsuario: payload.tipoUsuario ?? usuario.tipoUsuario ?? tipoDoUsuario(usuario),
    perfis: payload.perfis ?? payload.roles ?? usuario.perfis ?? usuario.roles,
    permissoesExtras: payload.permissoesExtras ?? usuario.permissoesExtras,
  });
  const dados = normalizarUsuario({ ...usuario, ...payload, ...configuracao });
  Object.assign(usuario, dados, { atualizadoEm: agora() });
  if (payload.senhaHash) usuario.senhaHash = texto(payload.senhaHash, 250);
  if (Array.isArray(payload.empresasAcessiveis)) {
    usuario.empresasAcessiveis = [...new Set(payload.empresasAcessiveis.map((item) => texto(item, 80)).filter(Boolean))];
    if (!usuario.empresasAcessiveis.includes(empresaId)) usuario.empresasAcessiveis.unshift(empresaId);
  }
  save();
  return usuario;
}

export function migrarPerfisUsuarios() {
  const store = base();
  let migrados = 0;
  for (const usuariosDaEmpresa of Object.values(store.usuarios || {})) {
    for (const usuario of Object.values(usuariosDaEmpresa || {})) {
      const acesso = resumoAcessoUsuario(usuario);
      const precisaMigrar = usuario.tipoUsuario !== acesso.tipoUsuario
        || JSON.stringify(usuario.perfis || []) !== JSON.stringify(acesso.perfis)
        || JSON.stringify(usuario.roles || []) !== JSON.stringify(acesso.perfis)
        || JSON.stringify(usuario.permissoes || {}) !== JSON.stringify(acesso.permissoes);
      if (precisaMigrar) {
        usuario.tipoUsuario = acesso.tipoUsuario;
        usuario.perfis = acesso.perfis;
        usuario.roles = acesso.perfis;
        usuario.role = acesso.perfis[0] || 'operador_pdv';
        usuario.permissoes = acesso.permissoes;
        usuario.permissoesExtras ||= {};
        usuario.atualizadoEm = agora();
        migrados += 1;
      }
    }
  }
  if (migrados) save();
  return migrados;
}

export function obterUsuario(empresaId, usuarioId) {
  const usuario = bucket('usuarios', empresaId)[String(usuarioId || '')];
  if (!usuario || usuario.empresaId !== empresaId) return null;
  return usuario;
}

export function listarUsuarios(empresaId) {
  return Object.values(bucket('usuarios', empresaId))
    .filter((usuario) => usuario.ativo !== false || usuario.incluirInativos)
    .map(({ senhaHash, ...usuario }) => ({ ...usuario, ...resumoAcessoUsuario(usuario) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function obterUsuarioPorEmail(email) {
  const procurado = texto(email, 120).toLowerCase();
  if (!procurado) return null;
  garantirEmpresaPadrao();
  const store = base();
  for (const [empresaId, usuarios] of Object.entries(store.usuarios)) {
    const usuario = Object.values(usuarios).find((item) => item.email === procurado && item.ativo !== false);
    if (usuario) return { ...usuario, empresaId };
  }
  return null;
}

function normalizarFuncionario(payload = {}) {
  return {
    nome: texto(payload.nome, 120),
    cpf: texto(payload.cpf, 20),
    email: texto(payload.email, 120).toLowerCase(),
    telefone: texto(payload.telefone, 30),
    cargo: texto(payload.cargo, 100),
    departamento: texto(payload.departamento, 100),
    dataAdmissao: texto(payload.dataAdmissao || payload.data_admissao, 10),
    salario: numeroNaoNegativo(payload.salario),
    observacao: texto(payload.observacao, 300),
    status: ['ativo', 'afastado', 'desligado'].includes(String(payload.status)) ? String(payload.status) : 'ativo',
  };
}

export function criarFuncionario(empresaId, payload = {}) {
  if (!obterEmpresa(empresaId)?.ativa) throw new Error('Empresa não encontrada ou inativa.');
  const dados = normalizarFuncionario(payload);
  if (!dados.nome) throw new Error('Nome do funcionário é obrigatório.');
  const funcionarios = bucket('funcionarios', empresaId);
  if (dados.cpf && Object.values(funcionarios).some((item) => item.cpf === dados.cpf && item.status !== 'desligado')) throw new Error('Já existe funcionário ativo com este CPF nesta empresa.');
  const funcionario = { id: id('fun'), empresaId, ...dados, criadoEm: agora(), atualizadoEm: agora() };
  funcionarios[funcionario.id] = funcionario;
  save();
  return funcionario;
}

export function atualizarFuncionario(empresaId, funcionarioId, payload = {}) {
  const funcionario = bucket('funcionarios', empresaId)[funcionarioId];
  if (!funcionario || funcionario.empresaId !== empresaId) return null;
  Object.assign(funcionario, normalizarFuncionario({ ...funcionario, ...payload }), { atualizadoEm: agora() });
  save();
  return funcionario;
}

export function listarFuncionarios(empresaId, { incluirDesligados = false } = {}) {
  return Object.values(bucket('funcionarios', empresaId))
    .filter((funcionario) => incluirDesligados || funcionario.status !== 'desligado')
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function normalizarFornecedor(payload = {}) {
  return {
    nome: texto(payload.nome, 160),
    cnpj: texto(payload.cnpj, 20),
    inscricaoEstadual: texto(payload.inscricaoEstadual || payload.inscricao_estadual, 30),
    email: texto(payload.email, 120).toLowerCase(),
    telefone: texto(payload.telefone, 30),
    endereco: texto(payload.endereco, 240),
    condicaoPagamento: texto(payload.condicaoPagamento || payload.condicao_pagamento, 120),
    observacao: texto(payload.observacao, 300),
    status: ['ativo', 'inativo'].includes(String(payload.status)) ? String(payload.status) : 'ativo',
  };
}

export function criarFornecedor(empresaId, payload = {}) {
  if (!obterEmpresa(empresaId)?.ativa) throw new Error('Empresa não encontrada ou inativa.');
  const dados = normalizarFornecedor(payload);
  if (!dados.nome) throw new Error('Nome do fornecedor é obrigatório.');
  const fornecedores = bucket('fornecedores', empresaId);
  if (dados.cnpj && Object.values(fornecedores).some((item) => item.cnpj === dados.cnpj && item.status === 'ativo')) throw new Error('Já existe fornecedor ativo com este CNPJ nesta empresa.');
  const fornecedor = { id: id('for'), empresaId, ...dados, criadoEm: agora(), atualizadoEm: agora() };
  fornecedores[fornecedor.id] = fornecedor;
  save();
  return fornecedor;
}

export function atualizarFornecedor(empresaId, fornecedorId, payload = {}) {
  const fornecedor = bucket('fornecedores', empresaId)[fornecedorId];
  if (!fornecedor || fornecedor.empresaId !== empresaId) return null;
  Object.assign(fornecedor, normalizarFornecedor({ ...fornecedor, ...payload }), { atualizadoEm: agora() });
  save();
  return fornecedor;
}

export function listarFornecedores(empresaId, { incluirInativos = false } = {}) {
  return Object.values(bucket('fornecedores', empresaId))
    .filter((fornecedor) => incluirInativos || fornecedor.status === 'ativo')
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function empresasDoUsuario(usuario) {
  if (!usuario) return [];
  const acessiveis = Array.isArray(usuario.empresasAcessiveis) ? usuario.empresasAcessiveis : [usuario.empresaId || EMPRESA_PADRAO_ID];
  return acessiveis.map((empresaId) => obterEmpresa(empresaId)).filter((empresa) => empresa?.ativa !== false);
}

export default {
  EMPRESA_PADRAO_ID,
  garantirEmpresaPadrao,
  obterEmpresa,
  listarEmpresas,
  criarEmpresa,
  atualizarEmpresa,
  criarUsuario,
  atualizarUsuario,
  obterUsuario,
  listarUsuarios,
  obterUsuarioPorEmail,
  criarFuncionario,
  atualizarFuncionario,
  listarFuncionarios,
  criarFornecedor,
  atualizarFornecedor,
  listarFornecedores,
  empresasDoUsuario,
};

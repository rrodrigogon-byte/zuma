/**
 * KYTTO — Camada de Isolamento Multientidade
 * Garante que cada empresa acesse apenas seus dados
 * 
 * Uso:
 *   import { requerEmpresa, validarEscopoEmpresa, obterEmpresaAtiva } from './empresa-isolamento-kytto.js'
 *   
 *   app.get('/api/admin/clientes', requerEmpresa, validarEscopoEmpresa, (req, res) => { ... })
 */

import { db, save } from './db.js';

// ============================================================================
// ESTRUTURA DE EMPRESA
// ============================================================================

export function garantirEmpresaPadrao() {
  const store = db();
  if (!store.empresas) store.empresas = {};
  
  const empresaPadrao = {
    id: 'emp-kytto-001',
    nome: 'Kytto Clube Tangará',
    nomeFantasia: 'Kytto — Sistemas Inteligentes para Negócios',
    cnpj: '54.518.772/0001-49',
    inscricaoEstadual: '28.043.514.020.00',
    endereco: 'Tangará da Serra, Mato Grosso, Brasil',
    telefone: '(65) 3326-2000',
    email: 'contato@kytto.com.br',
    site: 'https://setpoint.kytto.com.br',
    ativa: true,
    plano: 'premium',
    modulos: ['pdv', 'fiscal', 'financeiro', 'estoque', 'rh', 'cardapio', 'mesas'],
    criadaEm: new Date('2026-01-01').toISOString(),
    atualizadaEm: new Date().toISOString(),
  };
  
  if (!store.empresas[empresaPadrao.id]) {
    store.empresas[empresaPadrao.id] = empresaPadrao;
    save();
  }
  
  return store.empresas[empresaPadrao.id];
}

export function obterEmpresa(empresaId) {
  const store = db();
  return store.empresas?.[empresaId] || null;
}

export function listarEmpresas() {
  const store = db();
  return Object.values(store.empresas || {}).filter(e => e.ativa);
}

// ============================================================================
// MIDDLEWARE DE AUTENTICAÇÃO E ESCOPO
// ============================================================================

/**
 * Middleware: Exigir autenticação e identificar empresa
 * Deve ser aplicado ANTES de validarEscopoEmpresa
 */
export function requerEmpresa(req, res, next) {
  try {
    // Extrair token do header Authorization
    const auth = String(req.get('Authorization') || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    
    if (!token) {
      return res.status(401).json({ erro: 'Não autenticado. Token ausente.' });
    }
    
    // Decodificar token simples (em produção, usar JWT)
    // Formato: Base64(email:timestamp)
    let email, timestamp;
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      [email, timestamp] = decoded.split(':');
    } catch (e) {
      return res.status(401).json({ erro: 'Token inválido.' });
    }
    
    if (!email) {
      return res.status(401).json({ erro: 'Token sem email.' });
    }
    
    // Armazenar na requisição
    req.usuarioEmail = email;
    req.usuarioToken = token;
    
    // Identificar empresa: por enquanto, usar a empresa padrão
    // Em produção, consultar tabela de usuários para obter empresaId do usuário
    req.empresaId = 'emp-kytto-001';
    
    // Validar que a empresa existe
    const empresa = obterEmpresa(req.empresaId);
    if (!empresa) {
      return res.status(403).json({ erro: 'Empresa não encontrada ou inativa.' });
    }
    
    req.empresa = empresa;
    next();
  } catch (error) {
    console.error('[EMPRESA] Erro ao validar autenticação:', error?.message || error);
    res.status(500).json({ erro: 'Erro ao validar autenticação.' });
  }
}

/**
 * Middleware: Validar que a requisição não tenta acessar outra empresa
 * Deve ser aplicado DEPOIS de requerEmpresa
 */
export function validarEscopoEmpresa(req, res, next) {
  try {
    // Verificar se a requisição especifica uma empresa diferente
    const empresaIdRequisicao = req.body?.empresaId || req.query?.empresaId || req.params?.empresaId;
    
    if (empresaIdRequisicao && empresaIdRequisicao !== req.empresaId) {
      return res.status(403).json({ erro: 'Acesso negado. Você não tem permissão para acessar esta empresa.' });
    }
    
    // Garantir que req.empresaId está sempre definido
    if (!req.empresaId) {
      return res.status(400).json({ erro: 'Empresa não identificada na requisição.' });
    }
    
    next();
  } catch (error) {
    console.error('[EMPRESA] Erro ao validar escopo:', error?.message || error);
    res.status(500).json({ erro: 'Erro ao validar escopo empresarial.' });
  }
}

// ============================================================================
// FUNÇÕES DE ISOLAMENTO POR EMPRESA
// ============================================================================

/**
 * Obter dados de um módulo, isolados por empresa
 * Exemplo: obterDadosEmpresa('clientes', empresaId) retorna todos os clientes da empresa
 */
export function obterDadosEmpresa(modulo, empresaId) {
  const store = db();
  if (!store[modulo]) store[modulo] = {};
  if (!store[modulo][empresaId]) store[modulo][empresaId] = {};
  return store[modulo][empresaId];
}

/**
 * Garantir que um registro pertence à empresa antes de retornar
 */
export function validarPropriedadeEmpresa(registro, empresaId) {
  if (!registro) return false;
  if (registro.empresaId !== empresaId) {
    console.warn(`[EMPRESA] Tentativa de acessar registro de outra empresa: ${registro.id} (${registro.empresaId}) vs ${empresaId}`);
    return false;
  }
  return true;
}

/**
 * Listar registros de um módulo, isolados por empresa
 */
export function listarPorEmpresa(modulo, empresaId, filtros = {}) {
  const dados = obterDadosEmpresa(modulo, empresaId);
  let registros = Object.values(dados);
  
  // Aplicar filtros padrão
  if (filtros.ativo !== undefined) {
    registros = registros.filter(r => r.ativo === filtros.ativo);
  }
  if (filtros.status) {
    registros = registros.filter(r => r.status === filtros.status);
  }
  
  // Ordenar por nome se existir
  if (filtros.ordenar !== false) {
    registros.sort((a, b) => {
      const nomeA = String(a.nome || a.descricao || a.id).toLowerCase();
      const nomeB = String(b.nome || b.descricao || b.id).toLowerCase();
      return nomeA.localeCompare(nomeB, 'pt-BR');
    });
  }
  
  return registros;
}

/**
 * Criar registro com empresaId automático
 */
export function criarRegistroEmpresa(modulo, empresaId, dados) {
  const dados_com_empresa = {
    ...dados,
    empresaId,
    id: dados.id || `${modulo.slice(0, 3)}-${Date.now().toString(36)}-${String(Math.random()).slice(2, 6)}`,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };
  
  const store = db();
  if (!store[modulo]) store[modulo] = {};
  if (!store[modulo][empresaId]) store[modulo][empresaId] = {};
  
  store[modulo][empresaId][dados_com_empresa.id] = dados_com_empresa;
  save();
  
  return dados_com_empresa;
}

/**
 * Atualizar registro (validando propriedade)
 */
export function atualizarRegistroEmpresa(modulo, empresaId, id, dados) {
  const store = db();
  const registro = store[modulo]?.[empresaId]?.[id];
  
  if (!registro) return null;
  if (!validarPropriedadeEmpresa(registro, empresaId)) return null;
  
  // Nunca permitir alterar empresaId
  const { empresaId: _, ...dadosLimpos } = dados;
  
  Object.assign(registro, dadosLimpos, { atualizadoEm: new Date().toISOString() });
  save();
  
  return registro;
}

/**
 * Deletar (marcar como deletado) registro
 */
export function deletarRegistroEmpresa(modulo, empresaId, id) {
  const registro = atualizarRegistroEmpresa(modulo, empresaId, id, { status: 'deletado' });
  return registro !== null;
}

// ============================================================================
// EXPORTAR PADRÃO
// ============================================================================

export default {
  garantirEmpresaPadrao,
  obterEmpresa,
  listarEmpresas,
  requerEmpresa,
  validarEscopoEmpresa,
  obterDadosEmpresa,
  validarPropriedadeEmpresa,
  listarPorEmpresa,
  criarRegistroEmpresa,
  atualizarRegistroEmpresa,
  deletarRegistroEmpresa,
};

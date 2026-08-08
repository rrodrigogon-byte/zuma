// Perfis, tipos de usuário e permissões operacionais do Setpoint Kytto.
// As permissões são sempre avaliadas após a resolução da empresa ativa na sessão.

export const TIPOS_USUARIO = [
  { id: 'administrador', nome: 'Administrador', descricao: 'Administração completa da empresa', perfilPadrao: 'administrador' },
  { id: 'gerente', nome: 'Gerente', descricao: 'Gestão operacional e financeira', perfilPadrao: 'gerente_operacional' },
  { id: 'operador_pdv', nome: 'Operador de PDV', descricao: 'Vendas e atendimento no ponto de venda', perfilPadrao: 'operador_pdv' },
  { id: 'caixa', nome: 'Caixa', descricao: 'Recebimentos e fechamento de caixa', perfilPadrao: 'caixa' },
  { id: 'estoque', nome: 'Gerente de Estoque', descricao: 'Inventário e movimentações de estoque', perfilPadrao: 'gerente_estoque' },
  { id: 'garcom', nome: 'Garçom', descricao: 'Mesas, comandas e lançamento de pedidos', perfilPadrao: 'garcom' },
  { id: 'cozinha', nome: 'Cozinha / KDS', descricao: 'Preparo e atualização de pedidos', perfilPadrao: 'cozinha' },
  { id: 'consultor', nome: 'Consultor', descricao: 'Consulta de indicadores e relatórios', perfilPadrao: 'consultor' },
];

export const MODULOS_PERMISSAO = [
  { id: 'dashboard', nome: 'Dashboard' },
  { id: 'cardapio', nome: 'Cardápio' },
  { id: 'estoque', nome: 'Estoque' },
  { id: 'mesas', nome: 'Mesas e comandas' },
  { id: 'clientes', nome: 'Clientes' },
  { id: 'contas_receber', nome: 'Contas a receber' },
  { id: 'pagamentos', nome: 'Pagamentos' },
  { id: 'pdv', nome: 'PDV' },
  { id: 'cozinha', nome: 'Cozinha / KDS' },
  { id: 'relatorios', nome: 'Relatórios' },
  { id: 'fiscal', nome: 'Configuração fiscal' },
  { id: 'usuarios', nome: 'Cadastros mestres e usuários' },
  { id: 'fechamento', nome: 'Fechamento diário' },
  { id: 'canais_delivery', nome: 'Canais, delivery e fidelidade' },
];

const TODAS_ACOES = ['ler', 'criar', 'editar', 'excluir'];
const LER = ['ler'];
const CRIAR_LER = ['ler', 'criar'];
const EDITAR_LER = ['ler', 'editar'];
const OPERAR = ['ler', 'criar', 'editar'];

export const PERFIS_ACESSO = [
  {
    id: 'administrador', nome: 'Administrador', tipoUsuario: 'administrador', descricao: 'Controle completo da empresa e dos cadastros locais.',
    permissoes: Object.fromEntries(MODULOS_PERMISSAO.map(({ id }) => [id, TODAS_ACOES])),
  },
  {
    id: 'gerente_operacional', nome: 'Gerente Operacional', tipoUsuario: 'gerente', descricao: 'Gestão de operação, clientes, estoque, mesas, recebimentos e relatórios.',
    permissoes: {
      dashboard: LER, cardapio: OPERAR, estoque: OPERAR, mesas: OPERAR, clientes: OPERAR,
      contas_receber: OPERAR, pagamentos: LER, relatorios: LER, fechamento: LER, canais_delivery: OPERAR,
    },
  },
  {
    id: 'operador_pdv', nome: 'Operador de PDV', tipoUsuario: 'operador_pdv', descricao: 'Registra vendas e pagamentos no atendimento.',
    permissoes: { dashboard: LER, pdv: OPERAR, cardapio: LER, estoque: LER, pagamentos: OPERAR, clientes: CRIAR_LER, mesas: LER },
  },
  {
    id: 'caixa', nome: 'Caixa', tipoUsuario: 'caixa', descricao: 'Controla recebimentos, transações e fechamento de caixa.',
    permissoes: { dashboard: LER, pagamentos: OPERAR, contas_receber: OPERAR, fechamento: OPERAR, relatorios: LER, clientes: LER },
  },
  {
    id: 'gerente_estoque', nome: 'Gerente de Estoque', tipoUsuario: 'estoque', descricao: 'Controla estoque, inventário e consulta de produtos.',
    permissoes: { dashboard: LER, estoque: TODAS_ACOES, cardapio: LER, relatorios: LER },
  },
  {
    id: 'garcom', nome: 'Garçom', tipoUsuario: 'garcom', descricao: 'Opera mesas e registra pedidos.',
    permissoes: { mesas: OPERAR, cardapio: LER, pagamentos: LER, clientes: LER },
  },
  {
    id: 'cozinha', nome: 'Cozinha / KDS', tipoUsuario: 'cozinha', descricao: 'Acompanha e atualiza o preparo dos pedidos.',
    permissoes: { cozinha: OPERAR, cardapio: LER },
  },
  {
    id: 'consultor', nome: 'Consultor', tipoUsuario: 'consultor', descricao: 'Acesso de consulta a indicadores e relatórios.',
    permissoes: { dashboard: LER, relatorios: LER, estoque: LER, clientes: LER, contas_receber: LER, pagamentos: LER },
  },
];

const PERFIS_POR_ID = new Map(PERFIS_ACESSO.map((perfil) => [perfil.id, perfil]));
const TIPOS_POR_ID = new Map(TIPOS_USUARIO.map((tipo) => [tipo.id, tipo]));
const ALIASES_LEGADOS = {
  admin: 'administrador', administrador: 'administrador', gerente: 'gerente_operacional',
  'gerente-financeiro': 'gerente_operacional', operador: 'operador_pdv', pdv: 'operador_pdv',
  caixa: 'caixa', estoque: 'gerente_estoque', garcom: 'garcom', cozinha: 'cozinha', consultor: 'consultor',
};

export function listarTiposUsuario() { return TIPOS_USUARIO; }
export function listarPerfisAcesso() { return PERFIS_ACESSO.map(({ permissoes, ...perfil }) => perfil); }
export function obterPerfil(id) { return PERFIS_POR_ID.get(String(id || '').trim()) || null; }
export function obterTipo(id) { return TIPOS_POR_ID.get(String(id || '').trim()) || null; }

export function normalizarPerfis(perfis, tipoUsuario = '') {
  const recebidos = Array.isArray(perfis) ? perfis : (typeof perfis === 'string' ? perfis.split(',') : []);
  const normalizados = recebidos
    .map((perfil) => String(perfil || '').trim().toLowerCase())
    .map((perfil) => ALIASES_LEGADOS[perfil] || perfil)
    .filter((perfil) => PERFIS_POR_ID.has(perfil));
  const tipo = obterTipo(tipoUsuario);
  if (!normalizados.length && tipo?.perfilPadrao) normalizados.push(tipo.perfilPadrao);
  return [...new Set(normalizados)];
}

export function tipoDoUsuario({ tipoUsuario, perfis, roles, role, tipo } = {}) {
  const tipoSolicitado = String(tipoUsuario || '').trim().toLowerCase();
  if (TIPOS_POR_ID.has(tipoSolicitado)) return tipoSolicitado;
  const perfisNormalizados = normalizarPerfis(perfis || roles || [role || tipo]);
  return obterPerfil(perfisNormalizados[0])?.tipoUsuario || 'operador_pdv';
}

export function permissoesDoUsuario(usuario = {}) {
  const perfis = normalizarPerfis(usuario.perfis || usuario.roles || [usuario.role || usuario.tipo], usuario.tipoUsuario);
  const consolidado = {};
  for (const perfilId of perfis) {
    const perfil = obterPerfil(perfilId);
    if (!perfil) continue;
    for (const [modulo, acoes] of Object.entries(perfil.permissoes || {})) {
      consolidado[modulo] ||= new Set();
      for (const acao of acoes) consolidado[modulo].add(acao);
    }
  }
  for (const [modulo, acoes] of Object.entries(usuario.permissoesExtras || {})) {
    if (!MODULOS_PERMISSAO.some((item) => item.id === modulo)) continue;
    consolidado[modulo] ||= new Set();
    for (const acao of (Array.isArray(acoes) ? acoes : [])) {
      if (TODAS_ACOES.includes(acao)) consolidado[modulo].add(acao);
    }
  }
  return Object.fromEntries(Object.entries(consolidado).map(([modulo, acoes]) => [modulo, [...acoes]]));
}

export function temPermissao(usuario, modulo, acao = 'ler') {
  if (!usuario || usuario.ativo === false) return false;
  if (usuario.platformAdmin === true) return true;
  const permissoes = permissoesDoUsuario(usuario);
  return Boolean(permissoes[String(modulo || '')]?.includes(acao));
}

export function resumoAcessoUsuario(usuario = {}) {
  const tipoUsuario = tipoDoUsuario(usuario);
  const perfis = normalizarPerfis(usuario.perfis || usuario.roles || [usuario.role || usuario.tipo], tipoUsuario);
  return {
    tipoUsuario,
    tipo: obterTipo(tipoUsuario),
    perfis,
    permissoes: permissoesDoUsuario({ ...usuario, tipoUsuario, perfis }),
  };
}

export function validarConfiguracaoUsuario({ tipoUsuario, perfis, permissoesExtras } = {}) {
  const tipo = obterTipo(tipoUsuario);
  if (!tipo) throw new Error('Selecione um tipo de usuário válido.');
  const perfisNormalizados = normalizarPerfis(perfis, tipo.id);
  if (!perfisNormalizados.length) throw new Error('Selecione pelo menos um perfil de acesso.');
  const perfisIncompativeis = perfisNormalizados.filter((perfilId) => !obterPerfil(perfilId));
  if (perfisIncompativeis.length) throw new Error('Há perfis de acesso inválidos na configuração.');
  if (permissoesExtras !== undefined && (typeof permissoesExtras !== 'object' || Array.isArray(permissoesExtras))) {
    throw new Error('As permissões extras devem ser organizadas por módulo.');
  }
  return { tipoUsuario: tipo.id, perfis: perfisNormalizados };
}

export function acaoDaRequisicao(method) {
  const verbo = String(method || 'GET').toUpperCase();
  if (verbo === 'GET' || verbo === 'HEAD') return 'ler';
  if (verbo === 'POST') return 'criar';
  if (verbo === 'PATCH' || verbo === 'PUT') return 'editar';
  if (verbo === 'DELETE') return 'excluir';
  return 'ler';
}

export function moduloDaRota(pathname = '') {
  const path = String(pathname || '').toLowerCase();
  if (path.includes('/fiscal')) return 'fiscal';
  if (path.includes('/cardapio')) return 'cardapio';
  if (path.includes('/estoque')) return 'estoque';
  if (path.includes('/mesas')) return 'mesas';
  if (path.includes('/clientes')) return 'clientes';
  if (path.includes('/contas-receber') || path.includes('/alertas-vencimento')) return 'contas_receber';
  if (path.includes('/fechamento')) return 'fechamento';
  if (path.includes('/pagamentos')) return 'pagamentos';
  if (path.includes('/relatorios')) return 'relatorios';
  if (path.includes('/canais-venda') || path.includes('/fidelidade') || path.includes('/delivery')) return 'canais_delivery';
  if (path.includes('/funcionarios') || path.includes('/fornecedores') || path.includes('/usuarios') || path.includes('/plataforma/empresas')) return 'usuarios';
  if (path.includes('/kds') || path.includes('/cozinha')) return 'cozinha';
  if (path.includes('/pdv')) return 'pdv';
  return 'dashboard';
}

export const ACOES_VALIDAS = TODAS_ACOES;

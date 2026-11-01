// Perfis de acesso de toda empresa do Kytto: admin, operador e profissional.
//
// - admin: tudo na empresa (dono, administrador da loja, gestor);
// - operador: a operação do dia (agenda, comandas, clientes, vendas, caixa e fechamento, lançar
//   despesa), sem comissões, sem metas e sem indicadores em número da empresa;
// - profissional (barbeiro, manicure…): só o app do profissional e os próprios dados.
//
// A regra é do servidor: o menu só esconde. Rotas fora da lista do perfil são negadas por padrão,
// então uma tela nova não fica aberta ao operador ou ao profissional sem alguém decidir.

export const PERFIS = Object.freeze(['admin', 'operador', 'profissional'])

// Papel legado (usuários do db.json) → perfil.
const PAPEIS_ADMIN = new Set(['admin', 'organizador', 'gerente', 'gerente_operacional'])
// Papel do Commerce (contas PostgreSQL) → perfil.
const ROLES_ADMIN = new Set(['platform_owner', 'tenant_owner', 'store_admin'])
export const ROLE_OPERADOR = 'operator'
export const ROLE_PROFISSIONAL = 'professional'

/** Papel do Commerce → papel da sessão no painel (o que as rotas antigas conferem). */
export function papelLegadoDoRole(roleCode) {
  const role = String(roleCode || '')
  if (role === 'customer') return 'cliente'
  if (ROLES_ADMIN.has(role)) return 'admin'
  if (role === ROLE_OPERADOR) return 'operador'
  if (role === ROLE_PROFISSIONAL) return 'profissional'
  return 'organizador'
}

/** Perfil da sessão; null = perfil antigo/especializado (equipe legada, financeiro, catálogo…), que segue a regra de antes. */
export function perfilDoUsuario(usuario = {}) {
  if (!usuario) return null
  if (usuario.platformAdmin === true) return 'admin'
  if (usuario.pgAccount === true) {
    const role = String(usuario.commerceRoleCode || '')
    if (ROLES_ADMIN.has(role)) return 'admin'
    if (role === ROLE_OPERADOR) return 'operador'
    if (role === ROLE_PROFISSIONAL) return 'profissional'
    return null
  }
  const papel = String(usuario.role || '').trim().toLowerCase()
  if (PAPEIS_ADMIN.has(papel)) return 'admin'
  if (papel === 'operador') return 'operador'
  if (papel === 'profissional') return 'profissional'
  return null
}

const casa = (lista, metodo, caminho) => lista.some(([m, re]) => (m === '*' || m === metodo) && re.test(caminho))

// ── profissional: só o app do profissional ───────────────────────────────────
// Caminhos relativos a /api/admin. A posse (agenda/bloqueio dele) é conferida na rota.
const PROFISSIONAL = [
  ['GET', /^\/commerce-session$/],
  ['GET', /^\/minhas-permissoes$/],
  ['*', /^\/notificacoes(?:\/|$)/],
  ['GET', /^\/barbearia\/modo-barbeiro(?:\/.*)?$/],
  ['POST', /^\/barbearia\/modo-barbeiro\/comandas$/],
  ['POST', /^\/barbearia\/gamificacao\/giros\/executar$/],
  ['GET', /^\/(?:barbearia|dino)\/clientes\/[^/]+\/360$/],
  ['POST', /^\/barbearia\/push\/(?:situacao|assinar|cancelar|teste)$/],
  ['POST', /^\/barbearia\/agenda$/],
  ['PATCH', /^\/barbearia\/agenda\/[^/]+\/status$/],
  ['POST', /^\/barbearia\/bloqueios$/],
]

/** O profissional pode chamar esta rota de /api/admin? (a posse do registro é conferida depois) */
export function profissionalPode(metodo, caminho) {
  return casa(PROFISSIONAL, String(metodo || '').toUpperCase(), String(caminho || '').split('?')[0])
}

// ── operador: operação do dia na barbearia ───────────────────────────────────
// Caminhos relativos a /api/admin/barbearia.
const OPERADOR_LEITURA = [
  // a tela da barbearia carrega tudo pela visão geral; os números da empresa saem na resposta
  /^\/overview$/,
  /^\/agenda$/, /^\/agenda\/[^/]+$/, /^\/agenda\/[^/]+\/sinal$/, /^\/agenda-periodo$/, /^\/horarios-livres$/, /^\/bloqueios$/, /^\/fila$/,
  /^\/clientes$/, /^\/clientes\/[^/]+$/, /^\/clientes\/aniversariantes$/,
  /^\/comandas$/, /^\/comandas\/[^/]+$/, /^\/historico-comandas$/,
  /^\/servicos$/, /^\/profissionais$/, /^\/planos$/, /^\/assinaturas$/, /^\/cobrancas$/,
  /^\/estoque-revenda$/, /^\/vendas-revenda$/, /^\/vendas-revenda\/[^/]+$/,
  /^\/operacao\/caixas$/, /^\/operacao\/caixas\/[^/]+\/movimentos$/,
  /^\/configuracoes$/, /^\/configuracoes\/unidade-ativa$/,
  /^\/fidelidade$/, /^\/vales$/,
  /^\/captacao\/lista-espera$/, /^\/captacao\/retornos$/, /^\/captacao\/indicacoes$/,
  // categorias para lançar despesa; a lista de lançamentos mostra o dinheiro da empresa
  /^\/financeiro\/categorias$/,
  /^\/modo-barbeiro(?:\/.*)?$/,
]
const OPERADOR_ESCRITA = [
  ['POST', /^\/agenda$/], ['PATCH', /^\/agenda\/[^/]+(?:\/status)?$/],
  ['POST', /^\/bloqueios$/], ['PATCH', /^\/bloqueios\/[^/]+$/], ['DELETE', /^\/bloqueios\/[^/]+$/],
  ['POST', /^\/fila$/], ['PATCH', /^\/fila\/[^/]+\/status$/],
  ['POST', /^\/clientes$/], ['PATCH', /^\/clientes\/[^/]+$/], ['PATCH', /^\/clientes\/[^/]+\/consentimentos$/],
  // cancelar, estornar e consumo interno de comanda ficam com a gestão
  ['POST', /^\/comandas$/], ['PATCH', /^\/comandas\/[^/]+$/], ['PATCH', /^\/comandas\/[^/]+\/status$/],
  ['POST', /^\/comandas\/[^/]+\/(?:itens|pagamentos|aguardar-pagamento|fiscal\/rascunho)$/],
  ['PATCH', /^\/comandas\/[^/]+\/itens\/[^/]+$/], ['DELETE', /^\/comandas\/[^/]+\/itens\/[^/]+$/],
  ['POST', /^\/vendas-revenda$/], ['POST', /^\/vendas-revenda\/[^/]+\/confirmar-pagamento$/],
  ['POST', /^\/operacao\/caixas$/], ['POST', /^\/operacao\/caixas\/[^/]+\/(?:fechamento|movimentos)$/], ['POST', /^\/operacao\/fechar-dia$/],
  ['POST', /^\/financeiro\/lancamentos$/],
  ['POST', /^\/vales$/], ['POST', /^\/vales\/consulta$/], ['POST', /^\/cashback\/consulta$/],
  ['POST', /^\/fidelidade\/membros$/],
  ['POST', /^\/captacao\/lista-espera$/], ['PATCH', /^\/captacao\/lista-espera\/[^/]+$/],
  ['POST', /^\/assinaturas$/], ['PATCH', /^\/assinaturas\/[^/]+\/status$/],
  ['POST', /^\/modo-barbeiro\/comandas$/], ['POST', /^\/push\/(?:situacao|assinar|cancelar|teste)$/],
]

/** O operador pode chamar esta rota da barbearia? Resposta com o motivo, para a mensagem. */
export function operadorPodeNaBarbearia(metodo, caminho, corpo = {}) {
  const m = String(metodo || '').toUpperCase()
  const c = String(caminho || '').split('?')[0].replace(/\/+$/, '') || '/'
  if (m === 'GET' || m === 'HEAD') return OPERADOR_LEITURA.some((re) => re.test(c))
  if (!casa(OPERADOR_ESCRITA, m, c)) return false
  // operador lança despesa; receita entra pelas comandas e vendas
  if (c === '/financeiro/lancamentos' && String(corpo?.tipo || '').toLowerCase() !== 'despesa') return false
  // desconto, gorjeta e vínculo financeiro numa comanda são decisão da gestão
  if (m === 'PATCH' && /^\/comandas\/[^/]+$/.test(c)
    && ['desconto', 'descontoMotivo', 'desconto_motivo', 'gorjeta', 'financeiroLancamentoIds', 'contasReceberIds'].some((k) => corpo?.[k] !== undefined)) return false
  // fechamento cego: o operador informa o que contou (sem isso o sistema usaria o valor esperado)
  if (/^\/operacao\/caixas\/[^/]+\/fechamento$/.test(c) && !(corpo?.valorInformado !== undefined || corpo?.valor_informado !== undefined)) return false
  // marcar atendimento como recebido direto no financeiro (sem comanda) é da gestão
  if (/^\/agenda\/[^/]+\/status$/.test(c) && corpo?.registrarFinanceiro === true) return false
  return true
}

// ── números ocultos para o operador ──────────────────────────────────────────
const CAMPOS_COMISSAO = /comiss|repasse|^pote|salario/i
const CAMPOS_ESPERADOS_CAIXA = /^(?:esperado|valorEsperado|saldoEsperado|totalEsperado|diferenca|diferencaTotal|divergencia|quebra|sobra|falta|totalCalculado|totaisPorMeio|resumoEsperado|recebimentosDinheiro|recebimentosRegistrados|recebimentosLiquidos|estornosRecebimento)$/i
// indicadores em dinheiro da visão geral (as contagens do dia ficam: são da operação)
const INDICADORES_EM_DINHEIRO = /^(?:faturamento|receita|ticket|lucro|margem|valor|total)/i

/** Remove de um objeto (recursivo) os campos cujo nome bate com o padrão. */
export function semCampos(valor, padrao) {
  if (Array.isArray(valor)) return valor.map((v) => semCampos(v, padrao))
  if (!valor || typeof valor !== 'object' || valor instanceof Date) return valor
  const saida = {}
  for (const [k, v] of Object.entries(valor)) if (!padrao.test(k)) saida[k] = semCampos(v, padrao)
  return saida
}

// Recebimentos no caixa somados à abertura dariam o valor esperado: no fechamento às cegas o operador
// vê só o que ele mesmo lançou (abertura, sangria, suprimento).
const TIPOS_DE_RECEBIMENTO = new Set(['recebimento', 'estorno_recebimento'])
function semRecebimentos(valor) {
  if (Array.isArray(valor)) return valor.filter((v) => !TIPOS_DE_RECEBIMENTO.has(String(v?.tipo || ''))).map(semRecebimentos)
  if (!valor || typeof valor !== 'object' || valor instanceof Date) return valor
  return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, semRecebimentos(v)]))
}

/** Resposta da barbearia vista pelo operador: sem comissões e, no caixa, sem o valor esperado (fechamento cego). */
export function respostaParaOperador(caminho, corpo) {
  const c = String(caminho || '').split('?')[0]
  let saida = semCampos(corpo, CAMPOS_COMISSAO)
  if (/^\/operacao\/caixas/.test(c)) saida = semRecebimentos(semCampos(saida, CAMPOS_ESPERADOS_CAIXA))
  // fechamento do dia: só a confirmação, sem os totais
  if (/^\/operacao\/fechar-dia/.test(c) && saida?.fechamento) {
    const f = saida.fechamento
    saida = { ...saida, fechamento: { data: f.data ?? null, fechadoEm: f.fechadoEm ?? f.fechado_em ?? null, fechadoPor: f.fechadoPor ?? f.usuario ?? null, status: f.status ?? 'fechado' } }
  }
  if (c === '/overview' && saida && typeof saida === 'object') {
    const d = saida.dashboard || {}
    const indicadores = Object.fromEntries(Object.entries(d.indicadores || {}).filter(([k]) => !INDICADORES_EM_DINHEIRO.test(k)))
    saida = {
      ...saida,
      dashboard: { ...d, indicadores, financeiro: null, caixa: semCampos(d.caixa ?? null, CAMPOS_ESPERADOS_CAIXA) },
      relatorio: null, comissoes: null, operacao: null, documentosFiscais: null,
      // vendas de revenda: só as do dia (o histórico inteiro somaria o faturamento da revenda)
      vendas: Array.isArray(saida.vendas) && d.data ? saida.vendas.filter((v) => String(v?.criadoEm || v?.data || v?.dataVenda || '').slice(0, 10) === d.data) : null,
      resumoComandas: saida.resumoComandas ? Object.fromEntries(Object.entries(saida.resumoComandas).filter(([k]) => !INDICADORES_EM_DINHEIRO.test(k))) : saida.resumoComandas,
      numerosOcultos: true,
    }
  }
  return saida
}

export const MENSAGEM_PERFIL = {
  operador: 'Seu perfil é de operador: esta área (comissões, metas, indicadores e configurações) é da administração.',
  profissional: 'Seu perfil é de profissional: use o app do profissional, que mostra só a sua agenda e os seus números.',
}

// ── permissões do Commerce por perfil ────────────────────────────────────────
// O operador usa as permissões do vínculo (Commerce) só na operação: catálogo, estoque, pedidos e
// clientes. Dinheiro (payments.*) só nas rotas do dia a dia: caixa do bar, pagar comanda, lançar
// despesa. Relatórios, configurações, usuários e auditoria nunca. Vale também para o usuário antigo
// que virou operador mas tem um vínculo mais amplo no Commerce: o perfil limita o vínculo.
const OPERADOR_PERMISSOES_LIVRES = new Set(['catalog.read', 'inventory.read', 'orders.read', 'orders.write', 'customers.read', 'customers.write'])
const OPERADOR_DINHEIRO = {
  'payments.read': [
    ['GET', /^\/api\/admin\/bar\/caixa(?:\/hoje)?$/],
    ['GET', /^\/api\/admin\/razao\/(?:estado|categorias)$/],
  ],
  'payments.write': [
    ['POST', /^\/api\/admin\/bar\/caixa\/(?:abrir|movimento)$/],
    ['POST', /^\/api\/admin\/bar\/comanda\/[^/]+\/(?:pagar|pagamento-parcial)$/],
    ['POST', /^\/api\/admin\/razao\/lancamentos$/, (corpo) => String(corpo?.tipo || '').toLowerCase() === 'despesa'],
  ],
}

/** Motivo para negar a permissão do Commerce a esta sessão por causa do perfil; null = segue a regra do vínculo. */
export function restricaoDePermissao(req, permissao) {
  const perfil = perfilDoUsuario(req?.user)
  if (perfil !== 'operador' && perfil !== 'profissional') return null
  if (perfil === 'profissional') return MENSAGEM_PERFIL.profissional
  const codigo = String(permissao || '')
  if (OPERADOR_PERMISSOES_LIVRES.has(codigo)) return null
  const metodo = String(req?.method || '').toUpperCase()
  const caminho = String(req?.originalUrl || req?.url || '').split('?')[0].replace(/\/+$/, '')
  const regra = (OPERADOR_DINHEIRO[codigo] || []).find(([m, re, corpo]) => m === metodo && re.test(caminho) && (!corpo || corpo(req?.body)))
  return regra ? null : MENSAGEM_PERFIL.operador
}

/** Permissões do vínculo vistas pela interface (menu), já limitadas pelo perfil. */
export function permissoesDoPerfil(usuario, permissoes = []) {
  const perfil = perfilDoUsuario(usuario)
  if (perfil === 'profissional') return []
  if (perfil !== 'operador') return permissoes
  return permissoes.filter((p) => OPERADOR_PERMISSOES_LIVRES.has(p))
}

/** Módulos de /api/admin fechados ao operador mesmo com vínculo (gestão de pessoas e trilha de auditoria). */
export const MODULOS_FECHADOS_AO_OPERADOR = new Set(['auditoria', 'usuarios', 'usuarios-diretorio', 'platform'])

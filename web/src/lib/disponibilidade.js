// Disponibilidade das telas em produção.
//
// EM_IMPLANTACAO: telas cujo backend ainda não está montado no server.js de produção (o código
// está em app/modules/* ou app/routes/*, ligado só no server-v2). Elas saem do menu e, se alguém
// abrir pelo endereço, mostram "em implantação" em vez de erros 404. Ao ligar o módulo no
// server.js (com testes), basta remover a rota daqui.
//
// GLOBAIS_DO_EVENTO: telas que ainda usam o banco global do evento Agro Open (JSON, sem
// separação por empresa). O servidor nega essas APIs a usuário de empresa (403), então o menu só
// as mostra para a administração da plataforma, sinalizadas. Ao migrar para o PostgreSQL por
// empresa, remover daqui.

export const EM_IMPLANTACAO = {
  '/admin/agropecuaria': 'Agropecuária e petshop',
  '/admin/cadastros-mestres': 'Cadastros mestres (funcionários e fornecedores)',
  '/admin/clientes': 'Clientes e contas',
  '/admin/compras': 'Compras e fornecedores',
  '/admin/contas-receber': 'Contas a receber',
  '/admin/fechamento-diario': 'Fechamento diário',
  '/admin/fichas-tecnicas': 'Fichas técnicas',
  '/admin/fiscal/classificacao': 'Classificação fiscal',
  '/admin/fiscal/config': 'Configuração de NF-e e NFC-e',
  '/admin/loja-moda': 'Loja de moda',
  '/admin/lojas': 'Unidades operacionais',
  '/admin/notas': 'Central fiscal (NF-e e NFC-e)',
  '/admin/oficina': 'Oficina mecânica',
  '/admin/pdv-offline': 'PDV offline e periféricos',
  '/admin/perdas-inventario': 'Perdas e inventário',
  '/admin/reservas': 'Reservas de mesa e lista de espera',
  '/admin/supermercado': 'Supermercado',
  '/admin/varejo': 'Varejo geral',
}

export const GLOBAIS_DO_EVENTO = [
  '/admin/torneios', '/admin/agenda', '/admin/sumula', '/admin/inscricoes', '/admin/quadras', '/admin/pontos',
  '/admin/ranking', '/admin/ligas', '/admin/mesas', '/admin/cardapio', '/admin/estoque', '/admin/pagamentos',
  '/admin/socios', '/admin/mensalidades', '/admin/aulas', '/admin/crm', '/admin/loja', '/admin/noticias',
  '/admin/contatos', '/admin/relatorios',
  '/pdv', '/admin/pdv', '/garcom', '/kds', '/admin/kds', '/portaria', '/admin/portaria',
]

const caminho = (to) => String(to || '').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'

/** Título do módulo quando a tela ainda não está no ar; null quando está disponível. */
export function moduloEmImplantacao(to) {
  return EM_IMPLANTACAO[caminho(to)] || null
}

export function ehGlobalDoEvento(to) {
  return GLOBAIS_DO_EVENTO.includes(caminho(to))
}

/**
 * O item de menu aparece para esta sessão?
 * - em implantação: nunca;
 * - global do evento: só para a administração da plataforma ou usuário legado sem empresa.
 */
export function rotaVisivel(to, { isPlatformAdmin = false, usuarioDeEmpresa = false } = {}) {
  if (moduloEmImplantacao(to)) return false
  if (ehGlobalDoEvento(to)) return isPlatformAdmin || !usuarioDeEmpresa
  return true
}

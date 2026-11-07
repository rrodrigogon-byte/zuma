import { moduloOculto, permissaoQueFalta } from './permissoes-rota.js'

export const EM_IMPLANTACAO = {}

export const GLOBAIS_DO_EVENTO = [
  '/admin/torneios', '/admin/agenda', '/admin/sumula', '/admin/inscricoes', '/admin/quadras', '/admin/pontos',
  '/admin/ranking', '/admin/ligas', '/admin/pagamentos',
  '/admin/socios', '/admin/mensalidades', '/admin/aulas', '/admin/crm', '/admin/loja', '/admin/noticias',
  '/admin/contatos', '/admin/relatorios',
  '/portaria', '/admin/portaria',
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
 * O item de menu dos menus de marca aparece para esta sessão?
 * - Consolidação de Holding: EXCLUSIVO da administração da plataforma (Superadmin);
 * - em implantação: nunca;
 * - global do evento: só para a administração da plataforma ou usuário legado sem empresa;
 * - tela do backoffice cuja permissão a pessoa não tem na empresa ativa: some (`permissoes`).
 */
export function rotaVisivel(to, { isPlatformAdmin = false, usuarioDeEmpresa = false, permissoes = null, modulosOcultos = null } = {}) {
  const p = caminho(to)
  // 🔒 SEGURANÇA MULTIEMPRESA: Consolidação de Holding é restrita exclusivamente ao Superadmin da plataforma Kytto
  if (p === '/admin/consolidacao-grupo' && !isPlatformAdmin) return false
  if (moduloEmImplantacao(to)) return false
  if (!isPlatformAdmin && moduloOculto(to, modulosOcultos)) return false
  if (permissaoQueFalta(to, permissoes)) return false
  if (ehGlobalDoEvento(to)) return isPlatformAdmin || !usuarioDeEmpresa
  return true
}

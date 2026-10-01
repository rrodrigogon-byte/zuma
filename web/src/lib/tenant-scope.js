import { isDinoBrandContext } from './brand.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A tela deve usar os módulos da empresa (e não os globais da plataforma)?
 * Sim quando o usuário pertence a uma empresa, quando a empresa ativa é um
 * tenant do Commerce (UUID) ou quando é a marca Dino.
 */
export function isTenantScope(user, empresaAtiva) {
  if (user?.empresaId) return true
  if (UUID.test(String(empresaAtiva?.id || ''))) return true
  return isDinoBrandContext(empresaAtiva)
}

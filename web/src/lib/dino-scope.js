import { ehHostDino } from './dominios-dino.js'

// O portal administrativo dedicado da Dino deve continuar no tenant/unidade
// Dino mesmo quando o navegador ainda guarda cabeçalhos de outra empresa.
// A regra é explícita para o host e nunca infere escopo para outros domínios.
export const DINO_SCOPE = Object.freeze({
  empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
  lojaId: 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8',
})

export const DINO_COMPANY = Object.freeze({
  id: DINO_SCOPE.empresaId,
  nome: 'Barbearia Dino',
  nome_fantasia: 'Barbearia Dino',
  ativa: true,
})

// Fallback visual mínimo para o host dedicado quando a sessão não devolve
// a lista de lojas no primeiro carregamento. O backend continua sendo a
// autoridade de autorização e valida o mesmo par canônico.
export const DINO_STORE = Object.freeze({
  id: DINO_SCOPE.lojaId,
  empresaId: 'emp-kytto-001',
  commerceEmpresaId: DINO_SCOPE.empresaId,
  codigo: 'DINO-MATRIZ',
  nome: 'Barbearia Dino',
  nome_fantasia: 'Barbearia Dino',
  ativa: true,
})

export function isDinoDedicatedHost(host = typeof window === 'undefined' ? '' : window.location.hostname) {
  return ehHostDino(host)
}

export function isDinoPath(pathname = typeof window === 'undefined' ? '' : window.location?.pathname) {
  return /^\/(?:barbeiro\/dino|admin\/barbearia)(?:\/|$|-erp)/i.test(String(pathname || ''))
}

export function scopeDinoAdminHeaders(path, headers = {}, host = typeof window === 'undefined' ? '' : window.location.hostname) {
  const route = String(path || '').split('?')[0]
  const isBarbeariaRoute = /^\/api\/admin\/(?:barbearia|dino)(?:\/|$)/.test(route)
  if (!isBarbeariaRoute) return headers
  if (isDinoDedicatedHost(host)) {
    return {
      ...headers,
      'X-Empresa-Id': DINO_SCOPE.empresaId,
      'X-Loja-Id': DINO_SCOPE.lojaId,
    }
  }
  return headers
}

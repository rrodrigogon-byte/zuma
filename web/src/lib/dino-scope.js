import { ehHostDino } from './dominios-dino.js'

// O portal administrativo dedicado da Dino deve continuar no tenant/unidade
// Dino mesmo quando o navegador ainda guarda cabeçalhos de outra empresa.
// A regra é explícita para o host e nunca infere escopo para outros domínios.
export const DINO_SCOPE = Object.freeze({
  empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
  lojaId: 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8',
})

export function isDinoDedicatedHost(host = typeof window === 'undefined' ? '' : window.location.hostname) {
  return ehHostDino(host)
}

export function scopeDinoAdminHeaders(path, headers = {}, host = typeof window === 'undefined' ? '' : window.location.hostname) {
  const route = String(path || '').split('?')[0]
  if (!isDinoDedicatedHost(host) || !/^\/api\/admin\/barbearia(?:\/|$)/.test(route)) return headers
  return {
    ...headers,
    'X-Empresa-Id': DINO_SCOPE.empresaId,
    'X-Loja-Id': DINO_SCOPE.lojaId,
  }
}

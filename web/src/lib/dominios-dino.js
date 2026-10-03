// Domínios próprios da Dino (registro.br), servidos pela mesma publicação.
// - dinoperfumaria.com.br: loja (perfumaria).
// - dinobarbearia.com.br: barbearia (agendamento, app do cliente e da equipe).
// dino.kytto.com.br continua valendo: pagamentos e links antigos apontam para ele.
export const HOST_LOJA_DINO_LEGADO = 'dino.kytto.com.br'
export const HOSTS_LOJA_DINO = new Set([HOST_LOJA_DINO_LEGADO, 'dinoperfumaria.com.br', 'www.dinoperfumaria.com.br'])
export const HOSTS_BARBEARIA_DINO = new Set(['dinobarbearia.com.br', 'www.dinobarbearia.com.br'])

function normalizar(host) {
  return String(host || '').trim().toLowerCase().replace(/\.$/, '')
}

export function ehHostLojaDino(host) {
  return HOSTS_LOJA_DINO.has(normalizar(host))
}

export function ehHostBarbeariaDino(host) {
  return HOSTS_BARBEARIA_DINO.has(normalizar(host))
}

export function ehHostDino(host) {
  return ehHostLojaDino(host) || ehHostBarbeariaDino(host)
}

// O domínio antigo é resolvido pelo cadastro de domínios do storefront. Os
// domínios novos usam o endereço da loja Dino, que não depende desse cadastro.
export function lojaDinoPorEndereco(host) {
  const h = normalizar(host)
  return HOSTS_LOJA_DINO.has(h) && h !== HOST_LOJA_DINO_LEGADO
}

// Página inicial de cada domínio próprio (null = comportamento padrão).
export function destinoInicialDino(host) {
  if (ehHostBarbeariaDino(host)) return '/agendar/dino'
  if (lojaDinoPorEndereco(host)) return '/perfumaria/dino'
  return null
}

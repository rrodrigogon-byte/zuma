// Permissão que cada tela do backoffice novo exige para abrir (a mesma que a API dela confere na
// leitura). O menu esconde e a tela mostra "sem acesso" em vez de uma página cheia de erros 403.
//
// Só entram telas cujo backend é um módulo por empresa (app/modules/*). O Financeiro fica de
// fora: sem o razão ligado (FINANCEIRO_RAZAO), a tela é a antiga, com outra regra de acesso.
// `permissoes` undefined = carregando; null = não se aplica (administração da plataforma, sessão legada): nada é filtrado.

export const PERMISSAO_DA_ROTA = {
  '/admin/compras': 'inventory.read',
  '/admin/perdas-inventario': 'inventory.read',
  '/admin/fichas-tecnicas': 'inventory.read',
  '/admin/notas': 'payments.read',
  '/admin/fiscal/config': 'settings.write',
  '/admin/fiscal/classificacao': 'catalog.read',
  '/admin/reservas': 'customers.read',
  '/admin/pdv-offline': 'settings.write',
  '/admin/supermercado': 'catalog.read',
}

const caminho = (to) => String(to || '').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'

/** A permissão que falta para abrir a rota; null quando abre (ou quando não se aplica). */
export function permissaoQueFalta(to, permissoes) {
  if (!Array.isArray(permissoes)) return null
  const exigida = PERMISSAO_DA_ROTA[caminho(to)]
  return exigida && !permissoes.includes(exigida) ? exigida : null
}

/** Tela do mapa com as permissões ainda carregando (undefined): espera antes de montar. */
export function aguardandoPermissoes(to, permissoes) {
  return permissoes === undefined && Boolean(PERMISSAO_DA_ROTA[caminho(to)])
}

export const NOME_DA_PERMISSAO = {
  'inventory.read': 'consultar estoque e compras',
  'payments.read': 'consultar o financeiro e as notas',
  'settings.write': 'alterar configurações da empresa',
  'catalog.read': 'consultar o catálogo de produtos',
  'customers.read': 'consultar clientes e reservas',
}

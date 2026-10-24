// O que o operador vê no menu e nas abas da barbearia. O servidor nega o resto (comissões, metas,
// indicadores, configurações); aqui só não se mostra o que daria "sem acesso".

// Abas da tela da barbearia que o operador usa no dia a dia.
export const ABAS_DO_OPERADOR = new Set([
  'Agenda', 'Atendimento', 'Caixa e fechamento', 'Fila e bloqueios',
  'Clientes', 'Retorno previsto', 'Lista de espera', 'Indicações', 'Fidelidade',
  'Estoque de revenda', 'Vendas de revenda',
])

const ROTAS_DA_GESTAO = [
  /^\/admin\/?$/, // painel com os números da empresa
  /^\/admin\/(?:bi|relatorios|relatorios-operacionais|auditoria|configuracoes|usuarios|lojas|cadastros-mestres|cerebro-ia|whatsapp-gestao|whatsapp-lancamentos|plataforma|erp|contas-receber|contas-pagar|fechamento-diario|conciliacao)(?:\/|$)/,
]

/** O item de menu aparece para o perfil? (admin e perfis antigos: sim; operador: sem a gestão) */
export function itemVisivelNoPerfil(to, perfil) {
  if (perfil !== 'operador') return true
  const [caminho, busca = ''] = String(to || '').split('?')
  if (ROTAS_DA_GESTAO.some((re) => re.test(caminho))) return false
  if (caminho === '/admin/ecommerce' && /(?:^|&)tab=(?:users|domains|payments|overview)(?:&|$)/.test(busca)) return false
  if (caminho === '/admin/barbearia-erp') {
    const aba = new URLSearchParams(busca).get('tab')
    return Boolean(aba && ABAS_DO_OPERADOR.has(aba))
  }
  return true
}

/** Tela inicial do operador: a agenda (Dino) ou o PDV. */
export function inicioDoOperador(ehDino) {
  return ehDino ? '/admin/barbearia-erp?area=operacao&tab=Agenda' : '/pdv'
}

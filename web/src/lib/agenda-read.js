// Recuperação limitada exclusivamente para leituras. Nunca repetir vendas/pagamentos.
export async function lerAgenda(consultar, { ativo = () => true, esperar = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  for (let tentativa = 0; ; tentativa++) {
    if (!ativo()) return undefined
    try { return await consultar() }
    catch (error) {
      if (tentativa >= 2 || ![502, 503, 504].includes(Number(error.status))) throw error
      await esperar(tentativa === 0 ? 600 : 1600)
    }
  }
}
export function erroAgenda(error) {
  return [502, 503, 504].includes(Number(error?.status))
    ? 'O servidor está temporariamente indisponível. Não foi possível atualizar os dados. Tente novamente em instantes.'
    : error?.message || 'Não foi possível consultar a agenda.'
}

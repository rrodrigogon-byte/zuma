// Regras puras da nova comanda: busca de cliente, prévia do plano e totais.
// O servidor recalcula tudo; aqui é só para o atendente ver antes de salvar.

export function normalizarBusca(valor) {
  return String(valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

const soDigitos = (valor) => String(valor ?? '').replace(/\D/g, '')

/**
 * Busca rápida de clientes por nome, telefone ou e-mail. Cada palavra digitada
 * precisa aparecer no nome (em qualquer ordem); números buscam no telefone.
 * Quem começa com o termo vem primeiro.
 */
export function buscarClientes(clientes, termo, limite = 8) {
  const texto = normalizarBusca(termo)
  if (texto.length < 2) return []
  const digitos = soDigitos(termo)
  const palavras = texto.split(/\s+/).filter(Boolean)
  const achados = []
  for (const cliente of clientes || []) {
    if (!cliente || cliente.padrao === true) continue
    const nome = normalizarBusca(cliente.nome)
    const fone = soDigitos(cliente.telefone)
    const email = normalizarBusca(cliente.email)
    let pontos = 0
    if (digitos.length >= 3 && fone.includes(digitos)) pontos = fone.endsWith(digitos) ? 3 : 2
    else if (palavras.every((p) => nome.includes(p))) pontos = nome.startsWith(texto) ? 4 : nome.split(/\s+/).some((parte) => parte.startsWith(palavras[0])) ? 3 : 1
    else if (texto.includes('@') && email.includes(texto)) pontos = 2
    if (pontos) achados.push({ cliente, pontos })
    if (achados.length > 400) break
  }
  return achados
    .sort((a, b) => b.pontos - a.pontos || String(a.cliente.nome).localeCompare(String(b.cliente.nome), 'pt-BR'))
    .slice(0, limite)
    .map((item) => item.cliente)
}

export function filtrarCatalogo(lista, termo, campos = ['nome'], limite = 12) {
  const texto = normalizarBusca(termo)
  const base = (lista || []).filter((item) => item && item.ativo !== false)
  if (!texto) return base.slice(0, limite)
  const palavras = texto.split(/\s+/)
  return base.filter((item) => {
    const alvo = normalizarBusca(campos.map((campo) => item[campo] || '').join(' '))
    return palavras.every((p) => alvo.includes(p))
  }).slice(0, limite)
}

const cobre = (plano, servicoId) => plano.todosOsServicos || (plano.servicosIds || []).includes(servicoId)

/** Plano que cobriria o serviço agora (prévia), considerando o que já está no carrinho. */
export function previaCobertura(planos, carrinho, servicoId, ignorarLinha = null) {
  const usados = new Map()
  for (const linha of carrinho || []) {
    if (linha === ignorarLinha || linha.tipo !== 'servico' || !linha.usarPlano || !linha.planoPrevisto) continue
    usados.set(linha.planoPrevisto, (usados.get(linha.planoPrevisto) || 0) + 1)
  }
  return (planos || []).find((plano) => plano.utilizavel && cobre(plano, servicoId) && (plano.sessoesRestantes - (usados.get(plano.assinaturaId) || 0)) > 0) || null
}

/** Planos que cobririam o serviço, mesmo que hoje não possam ser usados (para explicar o motivo). */
export function planosDoServico(planos, servicoId) {
  return (planos || []).filter((plano) => cobre(plano, servicoId))
}

/** Recalcula a prévia de cobertura do carrinho inteiro, linha a linha. */
export function aplicarPreviaPlanos(planos, carrinho) {
  const resultado = []
  for (const linha of carrinho) {
    if (linha.tipo !== 'servico') { resultado.push(linha); continue }
    const plano = linha.usarPlano !== false ? previaCobertura(planos, resultado, linha.itemId) : null
    resultado.push({ ...linha, planoPrevisto: plano ? plano.assinaturaId : null, planoNome: plano ? plano.planoNome : null, quantidade: plano ? 1 : linha.quantidade })
  }
  return resultado
}

export function totaisCarrinho(carrinho, { desconto = 0, gorjeta = 0 } = {}) {
  let tabela = 0
  let abatido = 0
  for (const linha of carrinho || []) {
    const valor = Number(linha.preco || 0) * Number(linha.quantidade || 1)
    tabela += valor
    if (linha.tipo === 'servico' && linha.planoPrevisto) abatido += valor
  }
  const subtotal = Math.max(0, tabela - abatido)
  const descontoAplicado = Math.min(subtotal, Math.max(0, Number(desconto) || 0))
  const total = Math.max(0, subtotal - descontoAplicado + Math.max(0, Number(gorjeta) || 0))
  const r = (n) => Number(n.toFixed(2))
  return { tabela: r(tabela), abatido: r(abatido), subtotal: r(subtotal), desconto: r(descontoAplicado), total: r(total) }
}

/** Corpo dos itens para a API (o servidor confere preço, estoque e plano). */
export function itensParaApi(carrinho, profissionalPadrao = '') {
  return (carrinho || []).map((linha) => {
    const valorItem = linha.preco !== undefined && linha.preco !== null && !isNaN(Number(linha.preco))
      ? Number(linha.preco)
      : (linha.precoUnitario !== undefined && linha.precoUnitario !== null && !isNaN(Number(linha.precoUnitario)) ? Number(linha.precoUnitario) : undefined);
    const base = {
      tipo: linha.tipo,
      quantidade: Number(linha.quantidade || 1),
      profissionalId: linha.profissionalId || profissionalPadrao || undefined,
      ...(linha.agendamentoId ? { agendamentoId: linha.agendamentoId } : {}),
      ...(valorItem !== undefined ? { preco: valorItem, precoUnitario: valorItem, valor: valorItem } : {}),
    }
    if (linha.tipo === 'servico') return { ...base, servicoId: linha.itemId, usarPlano: linha.usarPlano !== false }
    if (linha.tipo === 'produto') return { ...base, produtoId: linha.itemId }
    if (linha.tipo === 'bebida' || linha.tipo === 'bar') {
      return { ...base, tipo: 'bebida', produtoId: linha.itemId, itemId: linha.itemId, nome: linha.nome }
    }
    if (linha.tipo === 'pacote' || linha.tipo === 'plano') return { ...base, planoId: linha.itemId || linha.planoId, itemId: linha.itemId, nome: linha.nome }
    if (linha.tipo === 'outro') return { ...base, nome: linha.nome, ...(linha.obs || linha.detalhe ? { obs: linha.obs || linha.detalhe } : {}) }
    return { ...base, variantId: linha.itemId }
  })
}

export function linkInstagram(usuario) {
  const u = String(usuario || '').replace(/^@/, '').trim()
  return u ? `https://www.instagram.com/${encodeURIComponent(u)}/` : ''
}

export const RELACOES = [
  ['esposa', 'Esposa'], ['marido', 'Marido'], ['conjuge', 'Cônjuge'], ['namorada', 'Namorada'], ['namorado', 'Namorado'],
  ['filho', 'Filho'], ['filha', 'Filha'], ['enteado', 'Enteado'], ['enteada', 'Enteada'],
  ['pai', 'Pai'], ['mae', 'Mãe'], ['irmao', 'Irmão'], ['irma', 'Irmã'], ['outro', 'Outro'],
]
export const nomeRelacao = (valor) => (RELACOES.find(([chave]) => chave === valor) || [valor, valor])[1]

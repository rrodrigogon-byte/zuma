import test from 'node:test'
import assert from 'node:assert/strict'
import { aplicarPreviaPlanos, buscarClientes, itensParaApi, linkInstagram, totaisCarrinho } from './comanda-nova.js'

const clientes = [
  { id: 'c1', nome: 'João da Silva', telefone: '(65) 99999-1234' },
  { id: 'c2', nome: 'Joana Prado', telefone: '(65) 98888-0000' },
  { id: 'c3', nome: 'Pedro João', email: 'pedro@exemplo.com' },
  { id: 'pad', nome: 'Cliente padrão', padrao: true },
]

test('busca de cliente ignora acentos, aceita palavras fora de ordem e prioriza o início do nome', () => {
  assert.deepEqual(buscarClientes(clientes, 'joao').map((c) => c.id), ['c1', 'c3'])
  assert.deepEqual(buscarClientes(clientes, 'silva joão').map((c) => c.id), ['c1'])
  assert.deepEqual(buscarClientes(clientes, '1234').map((c) => c.id), ['c1'])
  assert.deepEqual(buscarClientes(clientes, 'pedro@exemplo').map((c) => c.id), ['c3'])
  assert.deepEqual(buscarClientes(clientes, 'j'), [], 'uma letra não dispara busca')
  assert.equal(buscarClientes(clientes, 'cliente').length, 0, 'cliente padrão não aparece')
})

const vip = { assinaturaId: 'a1', planoNome: 'Clube VIP', utilizavel: true, sessoesRestantes: 1, servicosIds: ['corte', 'barba'] }

test('prévia: Clube VIP abate corte e barba e cobra o que não está no plano', () => {
  const carrinho = aplicarPreviaPlanos([{ ...vip, sessoesRestantes: 4 }], [
    { tipo: 'servico', itemId: 'corte', preco: 60, quantidade: 1, usarPlano: true },
    { tipo: 'servico', itemId: 'barba', preco: 40, quantidade: 1, usarPlano: true },
    { tipo: 'servico', itemId: 'sobrancelha', preco: 20, quantidade: 1, usarPlano: true },
    { tipo: 'loja', itemId: 'v1', preco: 89.9, quantidade: 1 },
  ])
  assert.deepEqual(carrinho.map((l) => l.planoPrevisto || null), ['a1', 'a1', null, undefined].map((v) => v ?? null))
  assert.deepEqual(totaisCarrinho(carrinho, { gorjeta: 10 }), { tabela: 209.9, abatido: 100, subtotal: 109.9, desconto: 0, total: 119.9 })
})

test('prévia respeita o saldo de sessões e a opção de não usar o plano', () => {
  const dois = aplicarPreviaPlanos([vip], [
    { tipo: 'servico', itemId: 'corte', preco: 60, quantidade: 1, usarPlano: true },
    { tipo: 'servico', itemId: 'barba', preco: 40, quantidade: 1, usarPlano: true },
  ])
  assert.deepEqual(dois.map((l) => l.planoPrevisto), ['a1', null])
  const semPlano = aplicarPreviaPlanos([vip], [{ tipo: 'servico', itemId: 'corte', preco: 60, quantidade: 1, usarPlano: false }])
  assert.equal(semPlano[0].planoPrevisto, null)
  const inadimplente = aplicarPreviaPlanos([{ ...vip, utilizavel: false }], [{ tipo: 'servico', itemId: 'corte', preco: 60, quantidade: 1, usarPlano: true }])
  assert.equal(inadimplente[0].planoPrevisto, null)
})

test('corpo para a API não leva preço nem cobertura (o servidor decide)', () => {
  const corpo = itensParaApi([
    { tipo: 'servico', itemId: 'corte', preco: 1, quantidade: 1, usarPlano: true, planoPrevisto: 'a1' },
    { tipo: 'produto', itemId: 'p1', preco: 1, quantidade: 2 },
    { tipo: 'loja', itemId: 'var-1', preco: 1, quantidade: 1 },
  ], 'prof-1')
  assert.deepEqual(corpo, [
    { tipo: 'servico', quantidade: 1, profissionalId: 'prof-1', servicoId: 'corte', usarPlano: true },
    { tipo: 'produto', quantidade: 2, profissionalId: 'prof-1', produtoId: 'p1' },
    { tipo: 'loja', quantidade: 1, profissionalId: 'prof-1', variantId: 'var-1' },
  ])
  assert.equal(linkInstagram('@dino.barber'), 'https://www.instagram.com/dino.barber/')
})

test('corpo para a API aceita pacote de serviços e item avulso/outro', () => {
  const corpo = itensParaApi([
    { tipo: 'pacote', itemId: 'plano-vip-1', nome: 'Pacote 4 Procedimentos', preco: 250, quantidade: 1 },
    { tipo: 'outro', itemId: 'outro-1', nome: 'Taxa de deslocamento', preco: 35, quantidade: 1, obs: 'Atendimento no hotel' },
  ], 'prof-1')
  assert.deepEqual(corpo, [
    { tipo: 'pacote', quantidade: 1, profissionalId: 'prof-1', planoId: 'plano-vip-1', itemId: 'plano-vip-1', nome: 'Pacote 4 Procedimentos', preco: 250 },
    { tipo: 'outro', quantidade: 1, profissionalId: 'prof-1', nome: 'Taxa de deslocamento', preco: 35, obs: 'Atendimento no hotel' },
  ])
})

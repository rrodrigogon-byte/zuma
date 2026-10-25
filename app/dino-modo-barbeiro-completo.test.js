import test from 'node:test'
import assert from 'node:assert/strict'
import { db } from './db.js'
import * as barbeariaErpKytto from './barbearia-erp-kytto.js'
import * as dinoModoBarbeiro from './dino-modo-barbeiro.js'
import * as dinoGamificacao from './dino-metas-gamificacao.js'
import { provisionarEquipeDino, PROFISSIONAIS_DINO_OFICIAIS } from './dino-equipe-seed.js'

test('Dino Modo Barbeiro Completo: seed, login, agenda, comanda, comissão e metas', async (t) => {
  const empId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'
  const lojaId = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8'

  // 1. Garante que os 8 profissionais existem no seed
  const resSeed = provisionarEquipeDino()
  assert.equal(resSeed.ok, true)
  assert.equal(resSeed.totalMembros, 8)

  const profs = barbeariaErpKytto.listarProfissionais(empId)
  assert.ok(profs.length >= 8, 'Deve conter pelo menos os 8 profissionais cadastrados')

  const bruno = profs.find(p => p.nome.toLowerCase().includes('bruno'))
  assert.ok(bruno, 'Bruno deve estar cadastrado como profissional')

  // 2. Painel do barbeiro autenticado
  const hoje = new Date().toISOString().slice(0, 10)
  const painel = dinoModoBarbeiro.painelBarbeiro(barbeariaErpKytto, {
    empresaId: empId,
    lojaId,
    profissionalId: bruno.id,
    data: hoje,
    usuario: { id: 'usr-dino-bruno', email: 'bruno@barbeariadino.com.br', role: 'profissional' }
  })
  assert.equal(painel.profissional.id, bruno.id)
  assert.equal(painel.profissional.souEu, true)
  assert.ok(painel.resumo, 'Resumo do dia deve estar presente')
  assert.ok(painel.comissao, 'Comissão do dia e mês deve estar calculada')
  assert.ok(painel.gamificacao, 'Painel de gamificação deve estar integrado')

  // 3. Criação de serviço e produto para teste de comanda
  const uid = Date.now();
  const servicoCorte = barbeariaErpKytto.criarServico(empId, {
    nome: 'Corte Degradê Dino Teste ' + uid,
    preco: 60.0,
    duracaoMinutos: 40,
    categoria: 'Cabelo',
    comissaoPercentual: 50
  })

  const servicoExtra = barbeariaErpKytto.criarServico(empId, {
    nome: 'Barboterapia com Toalha Quente Teste ' + uid,
    preco: 45.0,
    duracaoMinutos: 30,
    categoria: 'Barba',
    comissaoPercentual: 50
  })

  const produtoPomada = barbeariaErpKytto.criarProdutoRevenda(empId, {
    nome: 'Pomada Modeladora Matte Dino Teste ' + uid,
    precoVenda: 50.0,
    estoqueAtual: 20,
    lojaId,
    comissaoPercentual: 20
  })

  // 4. Cria agendamento para Bruno
  const diaUtil = '2026-10-26'
  const agendamento = barbeariaErpKytto.criarAgendamento(empId, {
    clienteNome: 'Cliente Teste Dino',
    clienteTelefone: '(65) 99999-1234',
    profissionalId: bruno.id,
    servicoId: servicoCorte.id,
    dataHora: `${diaUtil}T14:00:00`,
    dataAgenda: diaUtil,
    lojaId,
    origem: 'teste'
  }, { permitirEncaixe: true })
  assert.ok(agendamento.id, 'Agendamento deve ser criado com sucesso')

  // 5. Transição de status pelo barbeiro (Iniciar Atendimento)
  const statusIniciado = barbeariaErpKytto.alterarStatusAgendamento(empId, agendamento.id, 'em_atendimento', {
    registrarFinanceiro: false
  })
  assert.equal(statusIniciado.status, 'em_atendimento')

  // 6. Barbeiro adiciona serviço extra e produto na comanda
  const comanda = barbeariaErpKytto.criarComandaBarbearia(empId, {
    clienteNome: 'Cliente Teste Dino',
    clienteTelefone: '(65) 99999-1234',
    profissionalId: bruno.id,
    agendamentoId: agendamento.id,
    lojaId,
    itens: [
      { tipo: 'servico', servicoId: servicoCorte.id, quantidade: 1 },
      { tipo: 'servico', servicoId: servicoExtra.id, quantidade: 1 },
      { tipo: 'produto', produtoId: produtoPomada.id, quantidade: 2 } // 2 x 50 = 100 em produtos
    ]
  })

  assert.ok(comanda.id, 'Comanda deve ser aberta')
  assert.equal(comanda.itens.length, 3)

  // 7. Pagamento da comanda e apuração das metas
  const comandaPaga = barbeariaErpKytto.registrarPagamentoComandaBarbearia(empId, comanda.id, {
    confirmado: true,
    pagamentos: [{ meio: 'pix', valor: comanda.total }]
  })
  assert.equal(comandaPaga.status, 'paga')

  // Conclui o agendamento
  const statusConcluido = barbeariaErpKytto.alterarStatusAgendamento(empId, agendamento.id, 'concluido', {
    registrarFinanceiro: false
  })
  assert.equal(statusConcluido.status, 'concluido')

  // 8. Avalia e sincroniza metas e giros
  const sincronizacao = dinoGamificacao.avaliarMetasESincronizarGiros(empId, { dataIso: hoje, lojaId })
  const profAtualizado = sincronizacao.profissionais.find(p => p.profissionalId === bruno.id)
  assert.ok(profAtualizado, 'Profissional deve estar listado na sincronização')
  assert.ok(profAtualizado.dia.servicosExtras >= 1, 'Deve registrar pelo menos 1 serviço extra')
  assert.ok(profAtualizado.dia.produtosValor >= 100, 'Deve registrar R$ 100 em venda de produtos')
  assert.equal(profAtualizado.dia.metaProdutosAtingida, true, 'Meta diária de produtos deve estar batida!')

  // 9. Concessão de Giro, Giro na Roleta e Confirmação de Entrega
  const giroBonus = dinoGamificacao.concederGiroBonus(empId, {
    profissionalId: bruno.id,
    profissionalNome: bruno.nome,
    motivo: 'Giro Teste Integração ' + uid,
    usuario: 'Guilherme Cunha (Dino)'
  })
  assert.ok(giroBonus.id, 'Giro deve ser gerado')
  assert.equal(giroBonus.status, 'pendente_giro')

  const giro = dinoGamificacao.executarGiro(empId, {
    giroId: giroBonus.id,
    premioId: 'premio-pix-50',
    usuario: 'Guilherme Cunha (Dino)'
  })
  assert.equal(giro.status, 'girado')
  assert.ok(giro.premioGanho, 'Prêmio deve estar registrado')

  // Confirmação de entrega do prêmio
  const entrega = dinoGamificacao.confirmarEntregaPremio(empId, giroBonus.id, { entreguePor: 'Guilherme Cunha (Dino)' })
  assert.equal(entrega.status, 'entregue')
  assert.ok(entrega.entregueEm, 'Data de entrega deve estar registrada')
  assert.equal(entrega.entreguePor, 'Guilherme Cunha (Dino)')
})

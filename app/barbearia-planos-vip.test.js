import test from 'node:test'
import assert from 'node:assert/strict'
import * as barbearia from './barbearia-erp-kytto.js'
import * as comandaPlano from './barbearia-comanda-plano.js'
import * as clientesKytto from './clientes-contas-kytto.js'

test('Planos VIP e Preços Diferenciados por Profissional', async (t) => {
  const empId = `test-vip-planos-${Date.now()}`

  await t.test('1. semearPlanosVipDino cria planos VIP com distinção Dino vs Equipe', () => {
    // Cria profissionais para o teste
    const profDino = barbearia.criarProfissional(empId, {
      nome: 'Guilherme Cunha (Dino)',
      apelido: 'Dino',
      especialidade: 'Mestre Barbeiro',
      tipo: 'parceiro',
    })
    const profBruno = barbearia.criarProfissional(empId, {
      nome: 'Bruno Mendes',
      apelido: 'Bruno',
      especialidade: 'Barbeiro',
      tipo: 'parceiro',
    })

    const semeados = barbearia.semearPlanosVipDino(empId)
    assert.ok(Array.isArray(semeados), 'deve retornar array de planos semeados')
    assert.ok(semeados.length >= 2, 'deve semear ao menos 2 planos VIP/recorrência')

    const planos = barbearia.listarPlanos(empId)
    const planoDinoVip = planos.find((p) => p.nome.includes('Exclusivo Dino'))
    assert.ok(planoDinoVip, 'deve existir o plano VIP do Dino')
    assert.equal(planoDinoVip.ehVip, true, 'deve ser marcado como VIP')
    assert.equal(planoDinoVip.preco, 600, 'preço base do plano VIP do Dino deve ser 600')
    assert.equal(planoDinoVip.profissionalId, profDino.id, 'deve estar atrelado ao profissional Dino')

    const planoEquipe = planos.find((p) => p.nome.includes('Clube Recorrência'))
    assert.ok(planoEquipe, 'deve existir o plano de recorrência')
    assert.equal(planoEquipe.precosPorProfissional?.[profDino.id], 500, 'deve ter preço diferenciado de 500 para o Dino')
  })

  await t.test('2. obterPlano e links de adesão e compartilhamento', () => {
    const planos = barbearia.listarPlanos(empId)
    const plano = planos[0]
    const recuperado = barbearia.obterPlano(empId, plano.id)
    assert.ok(recuperado, 'deve recuperar plano por id')
    assert.equal(recuperado.id, plano.id)
    assert.ok(recuperado.linkAdesao.includes(encodeURIComponent(plano.id)), 'link de adesão deve conter id do plano')
    assert.ok(recuperado.linkAdesaoCompleto.startsWith('https://kytto.com.br/clube'), 'link completo deve apontar para o clube')
  })

  await t.test('3. Criar assinatura atrelada ao profissional e validação de cobertura por profissional', () => {
    const profs = barbearia.listarProfissionais(empId)
    const profDino = profs.find((p) => p.nome.includes('Dino'))
    const profBruno = profs.find((p) => p.nome.includes('Bruno'))
    const planoDinoVip = barbearia.listarPlanos(empId).find((p) => p.nome.includes('Exclusivo Dino'))

    // Cria um serviço para teste de comanda
    const servico = barbearia.criarServico(empId, {
      nome: 'Corte Cabelo & Barba VIP',
      preco: 150,
      duracaoMinutos: 45,
    })

    // Adiciona o serviço ao plano ANTES de criar a assinatura para compor as condições contratadas
    barbearia.atualizarPlano(empId, planoDinoVip.id, {
      servicosIds: [servico.id],
    })

    const cli1 = clientesKytto.criarCliente(empId, {
      nome: 'Cliente VIP Dino',
      telefone: '66999887766',
    })

    const ass = barbearia.criarAssinatura(empId, {
      clienteId: cli1.id,
      clienteNome: cli1.nome,
      clienteTelefone: cli1.telefone,
      planoId: planoDinoVip.id,
      profissionalId: profDino.id,
      profissionalNome: profDino.nome,
      precoContratado: 600,
      ehVip: true,
      inicio: '2026-10-25',
    })

    assert.ok(ass.id, 'deve criar assinatura com id')
    assert.equal(ass.profissionalId, profDino.id, 'deve vincular ao profissional Dino')
    assert.equal(ass.precoContratado, 600, 'deve registrar o valor contratado de 600')

    const ativada = barbearia.alterarStatusAssinatura(empId, ass.id, 'ativa', { confirmadoSemCobranca: true, pagamentoConfirmado: true })
    assert.equal(ativada.status, 'ativa')

    // Verifica coberturas do cliente
    const coberturas = comandaPlano.coberturasDoCliente(empId, cli1.id)
    assert.ok(coberturas.length > 0, 'cliente deve ter coberturas ativas')
    assert.equal(coberturas[0].profissionalId, profDino.id, 'cobertura deve ter profissionalId do Dino')

    // Se atender com o Dino: plano cobre!
    const resDino = comandaPlano.aplicarPlanoAosItens(empId, {
      clienteId: cli1.id,
      itens: [{ tipo: 'servico', servicoId: servico.id, quantidade: 1, profissionalId: profDino.id }],
    })
    assert.equal(resDino.cobertos, 1, 'atendimento com o Dino deve ser coberto pelo plano VIP do Dino')

    // Se atender com outro profissional (Bruno) quando o plano é exclusivo do Dino: não cobre!
    const resBruno = comandaPlano.aplicarPlanoAosItens(empId, {
      clienteId: cli1.id,
      itens: [{ tipo: 'servico', servicoId: servico.id, quantidade: 1, profissionalId: profBruno.id }],
    })
    assert.equal(resBruno.cobertos, 0, 'atendimento com outro profissional não deve ser coberto por plano exclusivo')
  })
})

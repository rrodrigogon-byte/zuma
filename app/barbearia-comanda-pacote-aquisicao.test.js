import assert from 'node:assert/strict';
import test from 'node:test';
import * as barbearia from './barbearia-erp-kytto.js';
import * as captacao from './dino-captacao-kytto.js';
import * as clientes from './clientes-contas-kytto.js';
import * as comandaPlano from './barbearia-comanda-plano.js';

const EMPRESA = 'dino-barbearia-teste-pacote';

function setupEmpresa() {
  const estado = barbearia.estadoEmpresa(EMPRESA);
  estado.profissionais = {};
  estado.servicos = {};
  estado.produtosRevenda = {};
  estado.planos = {};
  estado.assinaturas = {};
  estado.comandas = {};
  estado.clientes = {};

  const profBruno = barbearia.criarProfissional(EMPRESA, {
    nome: 'Bruno Mendes Pedroso',
    cargo: 'Barbeiro Master',
    ativo: true,
  });

  const servProcedimento = barbearia.criarServico(EMPRESA, {
    nome: 'Procedimento pacote',
    preco: 60.00,
    duracaoMinutos: 30,
    ativo: true,
  });

  const servCorte = barbearia.criarServico(EMPRESA, {
    nome: 'Corte Tradicional',
    preco: 70.00,
    duracaoMinutos: 40,
    ativo: true,
  });

  const pacote4 = barbearia.criarPlano(EMPRESA, {
    nome: 'Pacote 4 Procedimentos Premiun',
    preco: 360.00,
    sessoesIncluidas: 4,
    validadeDias: 30,
    categoriaPlano: 'pacote',
    todosOsServicos: true,
    ativo: true,
  });

  const cliente = clientes.criarCliente(EMPRESA, {
    nome: 'Cliente Teste Pacote Kytto',
    telefone: '65999998888',
  });

  return { profBruno, servProcedimento, servCorte, pacote4, cliente };
}

test('Comanda com Pacote em Aquisição cobre procedimentos a R$ 0,00 na mesma comanda', () => {
  const { profBruno, servProcedimento, pacote4, cliente } = setupEmpresa();

  const itensEntrada = [
    {
      tipo: 'pacote',
      itemId: pacote4.id,
      planoId: pacote4.id,
      nome: pacote4.nome,
      preco: 360.00,
      quantidade: 1,
      profissionalId: profBruno.id,
    },
    {
      tipo: 'servico',
      itemId: servProcedimento.id,
      servicoId: servProcedimento.id,
      nome: servProcedimento.nome,
      preco: 60.00,
      quantidade: 1,
      usarPlano: true,
      profissionalId: profBruno.id,
    },
    {
      tipo: 'servico',
      itemId: servProcedimento.id,
      servicoId: servProcedimento.id,
      nome: servProcedimento.nome,
      preco: 60.00,
      quantidade: 1,
      usarPlano: true,
      profissionalId: profBruno.id,
    },
  ];

  // 1. Preparo dos itens pelo servidor (aplicarPlanoAosItens)
  const preparo = comandaPlano.aplicarPlanoAosItens(EMPRESA, {
    clienteId: cliente.id,
    itens: itensEntrada,
  });

  assert.equal(preparo.cobertos, 2, 'Dois serviços devem ser cobertos pelo pacote em aquisição');
  const servicosPreparados = preparo.itens.filter((i) => i.tipo === 'servico');
  for (const s of servicosPreparados) {
    assert.ok(s.coberturaPlano, 'Serviço deve conter coberturaPlano');
    assert.equal(s.coberturaPlano.verificadoPeloServidor, true);
    assert.equal(s.coberturaPlano.emAquisicaoNaComanda, true);
  }

  // 2. Abertura da comanda no ERP
  const comanda = barbearia.criarComandaBarbearia(EMPRESA, {
    lojaId: 'loja-dino',
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    profissionalId: profBruno.id,
    itens: preparo.itens,
  });

  assert.equal(comanda.status, 'aberta');
  assert.equal(comanda.itens.length, 3);
  const servicosComanda = comanda.itens.filter((i) => i.tipo === 'servico');
  for (const s of servicosComanda) {
    assert.equal(s.subtotal, 0, 'Subtotal do serviço coberto na comanda deve ser R$ 0,00');
    assert.equal(s.coberturaPlano.valorAbatido, 60.00, 'Valor abatido deve ser R$ 60,00');
  }
  // O subtotal da comanda deve ser EXATAMENTE R$ 360,00 (apenas o pacote, sem cobrança extra dos serviços)
  const subtotalComanda = comanda.itens.reduce((acc, i) => acc + Number(i.subtotal || 0), 0);
  assert.equal(subtotalComanda, 360.00, 'Subtotal da comanda deve ser R$ 360,00');

  // 3. Validação antes do faturamento não deve dar erro
  assert.doesNotThrow(() => {
    comandaPlano.validarCoberturasDaComanda(EMPRESA, comanda);
  }, 'validarCoberturasDaComanda não deve rejeitar pacote em aquisição');

  // 4. Faturamento / Pagamento da comanda
  const paga = barbearia.registrarPagamentoComandaBarbearia(EMPRESA, comanda.id, {
    confirmado: true,
    meioPagamento: 'pix',
    valor: 360.00,
    chaveIdempotencia: `pg-cmd-${comanda.id}`,
  });
  assert.equal(paga.status, 'paga');

  // 5. Simulação do posFaturamentoComanda (como no app/server.js)
  // Ativação do pacote:
  const assinatura = barbearia.criarAssinatura(EMPRESA, {
    clienteId: paga.clienteId,
    clienteNome: paga.clienteNome,
    planoId: pacote4.id,
    profissionalId: profBruno.id,
    origem: 'comanda',
    comandaId: paga.id,
    valorContratado: 360.00,
    chaveIdempotencia: `comanda-${paga.id}-pacote`,
  });
  barbearia.alterarStatusAssinatura(EMPRESA, assinatura.id, 'ativa', { confirmadoSemCobranca: true });

  // Consumo dos planos na comanda
  const consumidos = comandaPlano.consumirPlanosDaComanda(EMPRESA, paga);
  assert.equal(consumidos.length, 2, 'Deve ter registrado o consumo de 2 procedimentos');
  assert.ok(consumidos.every((c) => c.ok), 'Todos os consumos devem ter tido sucesso');

  // 6. Conferência de saldo restante no pacote do cliente
  const resumoAss = captacao.resumoAssinatura(EMPRESA, assinatura.id);
  assert.equal(resumoAss.limiteNoCiclo, 4, 'Limite total era 4');
  assert.equal(resumoAss.usosNoCiclo, 2, 'Usos no ciclo deve ser 2');
  assert.equal(resumoAss.sessoesRestantes, 2, 'Restam exatamente 2 sessões no pacote');
});

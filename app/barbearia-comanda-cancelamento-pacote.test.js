import test from 'node:test';
import assert from 'node:assert/strict';
import * as barbearia from './barbearia-erp-kytto.js';
import * as captacao from './dino-captacao-kytto.js';
import * as comandaPlano from './barbearia-comanda-plano.js';

const EMPRESA = 'emp_teste_cancelamento_pacote_' + Date.now();
const LOJA = 'loja_teste_1';

test('Fluxo completo: cancelamento de comanda com pacote cancela o pacote e devolve o saldo de sessoes ao cliente', async () => {
  // 1. Setup: Criar barbeiro, serviços e cliente
  const prof = barbearia.criarProfissional(EMPRESA, { nome: 'Bruno Mendes Pedroso', ativo: true });
  const servCorte = barbearia.criarServico(EMPRESA, { nome: 'CORTE PREMIUM', preco: 100, duracaoMinutos: 30, ativo: true });
  const servBarba = barbearia.criarServico(EMPRESA, { nome: 'BARBA PREMIUM', preco: 80, duracaoMinutos: 30, ativo: true });
  const servProc = barbearia.criarServico(EMPRESA, { nome: 'Procedimento pacote', preco: 90, duracaoMinutos: 30, ativo: true });

  // Criar pacote de 4 procedimentos
  const pacotePlano = barbearia.criarPlano(EMPRESA, {
    nome: 'Pacote 4 Procedimentos Premiun',
    preco: 300,
    categoriaPlano: 'pacote',
    sessoesIncluidas: 4,
    validadeDias: 30,
    servicosIds: [servCorte.id, servBarba.id, servProc.id],
    ativo: true,
  });

  const clienteId = 'cli_joao_carlito_teste';
  const clienteNome = 'Joao Carlito ( Bruno )';

  // 2. Teste A: Cliente compra o pacote em uma comanda
  const comandaVenda = barbearia.criarComandaBarbearia(EMPRESA, {
    lojaId: LOJA,
    clienteId,
    clienteNome,
    profissionalId: prof.id,
    itens: [
      {
        tipo: 'pacote',
        planoId: pacotePlano.id,
        nome: pacotePlano.nome,
        preco: 300,
        quantidade: 1,
        profissionalId: prof.id,
      }
    ],
  });

  // Simular faturamento da comanda (recebimento que ativa o pacote)
  barbearia.registrarPagamentoComandaBarbearia(EMPRESA, comandaVenda.id, {
    confirmado: true,
    pagamentos: [{ meio: 'pix', valor: 300 }],
  });

  // Ativação da assinatura gerada pela comanda
  const assVenda = barbearia.criarAssinatura(EMPRESA, {
    clienteId,
    clienteNome,
    planoId: pacotePlano.id,
    origem: 'comanda',
    comandaId: comandaVenda.id,
    valorContratado: 300,
    chaveIdempotencia: `comanda-${comandaVenda.id}-item-pacote`,
  });
  barbearia.alterarStatusAssinatura(EMPRESA, assVenda.id, 'ativa', { confirmadoSemCobranca: true });

  // Verificar que o cliente agora tem o plano ativo com 4 sessões disponíveis
  let coberturas = comandaPlano.coberturasDoCliente(EMPRESA, clienteId);
  assert.equal(coberturas.length, 1);
  assert.equal(coberturas[0].planoNome, 'Pacote 4 Procedimentos Premiun');
  assert.equal(coberturas[0].sessoesRestantes, 4);
  assert.equal(coberturas[0].utilizavel, true);

  // 3. Teste B: Cliente consome 2 procedimentos em uma nova comanda
  const comandaUso = barbearia.criarComandaBarbearia(EMPRESA, {
    lojaId: LOJA,
    clienteId,
    clienteNome,
    profissionalId: prof.id,
    itens: [
      { tipo: 'servico', servicoId: servProc.id, preco: 90, quantidade: 1, profissionalId: prof.id },
      { tipo: 'servico', servicoId: servProc.id, preco: 90, quantidade: 1, profissionalId: prof.id },
    ],
  });

  // Aplicar o plano aos itens da comanda
  const aplicacao = comandaPlano.aplicarPlanoAosItens(EMPRESA, clienteId, comandaUso.itens, { comandaId: comandaUso.id });
  assert.equal(aplicacao.cobertos, 2);
  comandaUso.itens = aplicacao.itens.map((it) => ({
    ...it,
    id: it.id || 'item-' + Math.random(),
    subtotal: it.coberturaPlano ? 0 : it.preco,
  }));

  // Fechar comanda sem saldo (ou com pagamento) para registrar o consumo
  comandaUso.status = 'paga';
  comandaPlano.consumirPlanosDaComanda(EMPRESA, comandaUso);

  // Verificar que o saldo de sessões caiu de 4 para 2
  coberturas = comandaPlano.coberturasDoCliente(EMPRESA, clienteId);
  assert.equal(coberturas[0].sessoesRestantes, 2, 'Saldo deve ter diminuído para 2 sessões');

  // 4. Teste C: A comanda de uso é cancelada -> O saldo deve VOLTAR para 4 sessões!
  await barbearia.cancelarComandaBarbearia(EMPRESA, comandaUso.id, {
    motivo: 'Cliente precisou remarcar e comanda foi cancelada',
    cancelarFinalizada: true,
  });

  coberturas = comandaPlano.coberturasDoCliente(EMPRESA, clienteId);
  assert.equal(coberturas[0].sessoesRestantes, 4, 'Saldo de sessões deve ter voltado para 4 após cancelamento da comanda de uso!');

  // 5. Teste D: A comanda original de VENDA do pacote é cancelada -> O pacote deve ser CANCELADO!
  await barbearia.cancelarComandaBarbearia(EMPRESA, comandaVenda.id, {
    motivo: 'Venda de pacote cancelada e estornada no balcão',
    cancelarFinalizada: true,
  });

  // Verificar que a assinatura foi cancelada e não aparece mais em coberturas ativas
  const assAtualizada = barbearia.obterAssinatura(EMPRESA, assVenda.id);
  assert.equal(assAtualizada.status, 'cancelada', 'Assinatura gerada pela comanda deve estar cancelada');

  coberturas = comandaPlano.coberturasDoCliente(EMPRESA, clienteId);
  assert.equal(coberturas.length, 0, 'Cliente não pode mais ter pacote ativo após cancelamento da comanda que o vendeu');

  // 6. Teste E: Saneamento retroativo (caso João Carlito no print)
  // Criar uma assinatura órfã simulando a comanda que já havia sido cancelada antes do patch
  const comandaPrevia = barbearia.criarComandaBarbearia(EMPRESA, {
    lojaId: LOJA,
    clienteId: 'cli_orfao',
    clienteNome: 'Cliente Orfao',
    itens: [{ tipo: 'pacote', planoId: pacotePlano.id, preco: 300, quantidade: 1 }],
  });
  const estado = barbearia.estadoEmpresa(EMPRESA);
  estado.comandas[comandaPrevia.id].status = 'cancelada';
  estado.comandas[comandaPrevia.id].canceladaEm = '2026-11-12T10:00:00.000Z';

  const assOrfa = barbearia.criarAssinatura(EMPRESA, {
    clienteId: 'cli_orfao',
    clienteNome: 'Cliente Orfao',
    planoId: pacotePlano.id,
    origem: 'comanda',
    comandaId: comandaPrevia.id,
    criadoEm: '2026-11-12T10:00:00.000Z',
  });
  barbearia.alterarStatusAssinatura(EMPRESA, assOrfa.id, 'ativa', { confirmadoSemCobranca: true });

  // Executar o saneamento automático
  const resSaneamento = barbearia.sanearComandasCanceladasEPacotes(EMPRESA);
  assert.ok(resSaneamento.totalAssinaturasCanceladas >= 1);

  const assOrfaAtual = barbearia.obterAssinatura(EMPRESA, assOrfa.id);
  assert.equal(assOrfaAtual.status, 'cancelada', 'Assinatura órfã deve ter sido cancelada pelo saneamento');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as barbeariaErpKytto from './app/barbearia-erp-kytto.js';
import { obterDetalhesCaixaOperacao } from './app/dino-caixa-detalhes.js';
import * as caixaKytto from './app/caixa-diario-kytto.js';

test('Barbearia Dino - Caixa e Comandas: Alteração de data, multi-profissional por item e cancelamento', async (t) => {
  const empresaId = 'emp_teste_dino_melhorias_' + Date.now();
  const lojaId = 'loja-dino-01';
  const estado = barbeariaErpKytto.estadoEmpresa(empresaId);
  estado.lojas ||= {};
  estado.lojas[lojaId] = { id: lojaId, empresaId, nome: 'Dino Barbearia Central', ativo: true };

  // Cadastra barbeiros
  estado.profissionais['prof-bruno'] = { id: 'prof-bruno', empresaId, nome: 'Bruno', ativo: true, comissaoPercentual: 50 };
  estado.profissionais['prof-nati'] = { id: 'prof-nati', empresaId, nome: 'Nati', ativo: true, comissaoPercentual: 50 };
  estado.profissionais['prof-mineiro'] = { id: 'prof-mineiro', empresaId, nome: 'Mineiro', ativo: true, comissaoPercentual: 40 };

  // Cadastra serviços
  estado.servicos['srv-corte'] = { id: 'srv-corte', empresaId, nome: 'Corte Adulto', preco: 60, ativo: true };
  estado.servicos['srv-barba'] = { id: 'srv-barba', empresaId, nome: 'Barba Terapia', preco: 40, ativo: true };
  estado.servicos['srv-sobrancelha'] = { id: 'srv-sobrancelha', empresaId, nome: 'Sobrancelha', preco: 25, ativo: true };

  // Abre caixa
  const caixa = caixaKytto.abrirCaixa(empresaId, {
    lojaId,
    numeroCaixa: 1,
    valorAbertura: 100,
    usuario: 'jhenyffer@dino.com',
    data: '2026-11-09',
  });
  assert.ok(caixa.id, 'Caixa aberto com sucesso');

  // Cria comanda com 2 serviços com barbeiros diferentes
  const comanda = barbeariaErpKytto.criarComandaBarbearia(empresaId, {
    lojaId,
    clienteNome: 'Waltemir Teste',
    dataAtendimento: '2026-11-09',
    profissionalId: 'prof-bruno',
    itens: [
      { tipo: 'servico', servicoId: 'srv-corte', profissionalId: 'prof-bruno' },
      { tipo: 'servico', servicoId: 'srv-barba', profissionalId: 'prof-nati' },
      { tipo: 'servico', servicoId: 'srv-sobrancelha', profissionalId: 'prof-bruno' },
    ],
  });

  assert.equal(comanda.itens.length, 3);
  assert.equal(comanda.itens[0].profissionalId, 'prof-bruno');
  assert.equal(comanda.itens[1].profissionalId, 'prof-nati');

  // 1. Recebe a comanda
  const comandaPaga = barbeariaErpKytto.registrarPagamentoComandaBarbearia(empresaId, comanda.id, {
    lojaId,
    confirmado: true,
    data: '2026-11-09',
    dataPagamento: '2026-11-09',
    pagamentos: [{ meio: 'debito', bandeira: 'MasterCard', valor: 125, caixaId: caixa.id }],
  });
  assert.equal(comandaPaga.status, 'paga');

  // 2. Testa alteração pontual de valor de item na comanda finalizada (ex.: sobrancelha de 25 para 20)
  const itemSobrancelha = comandaPaga.itens.find(i => i.nome === 'Sobrancelha');
  const comandaItemAlterado = barbeariaErpKytto.alterarItemComandaFinalizada(empresaId, comandaPaga.id, itemSobrancelha.id, {
    preco: 20,
    quantidade: 1,
  });
  assert.equal(comandaItemAlterado.itens.find(i => i.id === itemSobrancelha.id).precoUnitario, 20);
  assert.equal(comandaItemAlterado.total, 120);

  // 3. Testa alteração de profissional de item na comanda finalizada (muda Barba para Bruno ou Nati)
  const comandaProfAlterado = barbeariaErpKytto.alterarItemComandaFinalizada(empresaId, comandaPaga.id, itemSobrancelha.id, {
    profissionalId: 'prof-nati',
  });
  assert.equal(comandaProfAlterado.itens.find(i => i.id === itemSobrancelha.id).profissionalId, 'prof-nati');

  // 4. Testa alteração de data de comanda finalizada (retroativa ou futura, ex.: 2026-11-03)
  const comandaDataAlterada = barbeariaErpKytto.atualizarComandaBarbearia(empresaId, comandaPaga.id, {
    dataAtendimento: '2026-11-03',
    data: '2026-11-03',
    permitirFinalizada: true,
  });
  assert.equal(comandaDataAlterada.dataAtendimento, '2026-11-03');
  assert.equal(String(comandaDataAlterada.fechadaEm).slice(0, 10), '2026-11-03');

  // 5. Testa detalhes do caixa e drilldown
  const detalhes = obterDetalhesCaixaOperacao(empresaId, caixa.id);
  assert.ok(detalhes, 'Detalhes do caixa obtidos');
  assert.ok(detalhes.formasPagamento.cartao_debito, 'Tem cartão débito registrado');

  // 6. Testa cancelamento de comanda finalizada com estorno
  const comandaCancelada = await barbeariaErpKytto.cancelarComandaBarbearia(empresaId, comandaPaga.id, {
    confirmado: true,
    motivo: 'Comanda de teste indevida',
    usuario: 'jhenyffer@dino.com',
  });
  assert.equal(comandaCancelada.status, 'cancelada');
  assert.equal(comandaCancelada.estornada, true);

  // Confirma que a comanda cancelada foi excluída do caixa
  const detalhesAposCancelamento = obterDetalhesCaixaOperacao(empresaId, caixa.id);
  const comandaNoCaixa = (detalhesAposCancelamento.todasComandas || []).find(c => c.id === comandaPaga.id);
  assert.equal(comandaNoCaixa, undefined, 'Comanda cancelada não deve mais aparecer no caixa');

  console.log('Todos os testes de caixa, comanda, multi-profissional e cancelamento passaram com sucesso!');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as barbearia from './barbearia-erp-kytto.js';
import { DINO_EMPRESA_CANONICA } from './dino-equipe-seed.js';

test('alterarStatusAgendamento confirma agendamento mesmo com prazoRespostaAte expirado', () => {
  const servicos = barbearia.listarServicos(DINO_EMPRESA_CANONICA);
  const servico = servicos[0] || barbearia.criarServico(DINO_EMPRESA_CANONICA, { nome: "Corte Teste Prazo", preco: 60, duracaoMinutos: 40 });
  const profissional = barbearia.criarProfissional(DINO_EMPRESA_CANONICA, {
    nome: `Dino Teste Prazo ${Date.now()}`,
    servicosIds: [servico.id],
    atendimento24x7: true,
  });

  const dataLivre = new Date(Date.now() + 5 * 24 * 3600 * 1000);
  dataLivre.setHours(15, 0, 0, 0);

  const agendamento = barbearia.criarAgendamento(DINO_EMPRESA_CANONICA, {
    clienteNome: 'Cliente Teste Prazo',
    clienteTelefone: `556599999${Math.floor(1000 + Math.random() * 9000)}`,
    dataHora: dataLivre.toISOString(),
    servicoId: servico.id,
    profissionalId: profissional.id,
  });

  // Simular estado antigo que causava bloqueio na comanda da Jhe
  const estado = barbearia.estadoEmpresa(DINO_EMPRESA_CANONICA);
  estado.agendamentos[agendamento.id].confirmacaoAutomatica = {
    ativa: true,
    status: 'segunda_enviada',
    prazoRespostaAte: new Date(Date.now() - 3600000).toISOString(), // 1 hora atras
  };

  // Testar confirmacao pelo balcao / comanda / T-Rex
  assert.doesNotThrow(() => {
    const atualizado = barbearia.alterarStatusAgendamento(DINO_EMPRESA_CANONICA, agendamento.id, 'confirmado');
    assert.equal(atualizado.status, 'confirmado');
    assert.equal(atualizado.confirmacaoAutomatica.status, 'confirmado');
    assert.equal(atualizado.confirmacaoAutomatica.prazoRespostaAte, null);
  }, 'Confirmação não pode mais lançar CONFIRMACAO_PRAZO_EXPIRADO');
});

test('sanearConfirmacoesDino destrava agendamentos presos em prazo expirado', () => {
  const servicos = barbearia.listarServicos(DINO_EMPRESA_CANONICA);
  const servico = servicos[0] || barbearia.criarServico(DINO_EMPRESA_CANONICA, { nome: "Corte Teste Saneamento", preco: 60, duracaoMinutos: 40 });
  const profissional = barbearia.criarProfissional(DINO_EMPRESA_CANONICA, {
    nome: `Dino Teste Saneamento ${Date.now()}`,
    servicosIds: [servico.id],
    atendimento24x7: true,
  });

  const dataLivre = new Date(Date.now() + 6 * 24 * 3600 * 1000);
  dataLivre.setHours(16, 0, 0, 0);

  const agendamento = barbearia.criarAgendamento(DINO_EMPRESA_CANONICA, {
    clienteNome: 'Cliente Para Sanear',
    clienteTelefone: `556599999${Math.floor(1000 + Math.random() * 9000)}`,
    dataHora: dataLivre.toISOString(),
    servicoId: servico.id,
    profissionalId: profissional.id,
  });

  const estado = barbearia.estadoEmpresa(DINO_EMPRESA_CANONICA);
  estado.agendamentos[agendamento.id].confirmacaoAutomatica = {
    ativa: true,
    status: 'segunda_enviada',
    prazoRespostaAte: new Date(Date.now() - 7200000).toISOString(),
  };

  const resultado = barbearia.sanearConfirmacoesDino(DINO_EMPRESA_CANONICA);
  assert.ok(resultado.prazosLimpos >= 1);
  assert.equal(estado.agendamentos[agendamento.id].confirmacaoAutomatica.prazoRespostaAte, null);
});

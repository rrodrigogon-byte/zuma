import test from 'node:test';
import assert from 'node:assert/strict';
import * as barbearia from './barbearia-erp-kytto.js';
import * as captacao from './dino-captacao-kytto.js';
import {
  DINO_COMMERCE_EMPRESA_ID,
  DINO_COMMERCE_LOJA_ID,
  DINO_LEGACY_LOJA_ID,
  lojasEquivalentes,
  legacyLojaIdFromCommerce,
} from './core/legacy-commerce-scope.js';

test('lojasEquivalentes normaliza corretamente lojas da Dino Barbearia', () => {
  // Loja vazia ou indefinida deve ser compatível com a loja ativa
  assert.equal(lojasEquivalentes(DINO_COMMERCE_EMPRESA_ID, undefined, DINO_COMMERCE_LOJA_ID), true);
  assert.equal(lojasEquivalentes(DINO_COMMERCE_EMPRESA_ID, '', DINO_COMMERCE_LOJA_ID), true);
  assert.equal(lojasEquivalentes(DINO_COMMERCE_EMPRESA_ID, null, DINO_COMMERCE_LOJA_ID), true);

  // Id legado dino-web-estoque equivale à matriz canônica ab049a75-...
  assert.equal(lojasEquivalentes(DINO_COMMERCE_EMPRESA_ID, DINO_LEGACY_LOJA_ID, DINO_COMMERCE_LOJA_ID), true);
  assert.equal(lojasEquivalentes(DINO_COMMERCE_EMPRESA_ID, DINO_COMMERCE_LOJA_ID, DINO_LEGACY_LOJA_ID), true);
  assert.equal(lojasEquivalentes(DINO_COMMERCE_EMPRESA_ID, DINO_COMMERCE_LOJA_ID, DINO_COMMERCE_LOJA_ID), true);

  // Outra unidade diferente NÃO é compatível
  assert.equal(lojasEquivalentes(DINO_COMMERCE_EMPRESA_ID, 'outra-filial-123', DINO_COMMERCE_LOJA_ID), false);
});

test('atendente consegue cancelar agendamento com lojaId vazio na Dino Barbearia', () => {
  const agId = `age-teste-sem-loja-${Date.now()}-${Math.random()}`;
  const estado = barbearia.estadoEmpresa(DINO_COMMERCE_EMPRESA_ID);

  // Cria agendamento sem lojaId (cenário real legado/migrado)
  estado.agendamentos[agId] = {
    id: agId,
    empresaId: DINO_COMMERCE_EMPRESA_ID,
    clienteNome: 'Cliente Sem Loja',
    clienteTelefone: '5565999881122',
    dataHora: new Date(Date.now() + 86400000).toISOString(),
    status: 'agendado',
    lojaId: undefined,
  };

  // Atendente da barbearia tenta cancelar passando a loja ativa da matriz
  const cancelado = barbearia.alterarStatusAgendamento(
    DINO_COMMERCE_EMPRESA_ID,
    agId,
    'cancelado',
    {
      lojaId: DINO_COMMERCE_LOJA_ID,
      origem: 'atendente',
      canceladoPor: 'Recepcionista Dino',
      motivoCancelamento: 'Cliente solicitou cancelamento por imprevisto',
    }
  );

  assert.ok(cancelado, 'Cancelamento não deve retornar null para agendamento sem lojaId');
  assert.equal(cancelado.status, 'cancelado');
  assert.equal(cancelado.canceladoPor, 'Recepcionista Dino');
  assert.equal(cancelado.motivoCancelamento, 'Cliente solicitou cancelamento por imprevisto');
  // O agendamento deve ter sido associado à loja matriz canônica
  assert.equal(cancelado.lojaId, DINO_COMMERCE_LOJA_ID);
});

test('atendente consegue cancelar agendamento com lojaId legado dino-web-estoque', () => {
  const agId = `age-teste-loja-legada-${Date.now()}-${Math.random()}`;
  const estado = barbearia.estadoEmpresa(DINO_COMMERCE_EMPRESA_ID);

  // Cria agendamento com id legado dino-web-estoque
  estado.agendamentos[agId] = {
    id: agId,
    empresaId: DINO_COMMERCE_EMPRESA_ID,
    clienteNome: 'Cliente Loja Legada',
    clienteTelefone: '5565999883344',
    dataHora: new Date(Date.now() + 86400000).toISOString(),
    status: 'agendado',
    lojaId: DINO_LEGACY_LOJA_ID,
  };

  // Atendente da barbearia tenta cancelar passando a loja canônica
  const cancelado = barbearia.alterarStatusAgendamento(
    DINO_COMMERCE_EMPRESA_ID,
    agId,
    'cancelado',
    {
      lojaId: DINO_COMMERCE_LOJA_ID,
      origem: 'atendente',
      canceladoPor: 'Carlos Atendente',
      motivoCancelamento: 'Desistência do cliente',
    }
  );

  assert.ok(cancelado, 'Cancelamento não deve retornar null para agendamento com loja legada');
  assert.equal(cancelado.status, 'cancelado');
  assert.equal(cancelado.canceladoPor, 'Carlos Atendente');
});

test('atualizarAgendamento aceita agendamento sem lojaId e atribui a loja canônica', () => {
  const agId = `age-teste-remarcar-${Date.now()}-${Math.random()}`;
  const estado = barbearia.estadoEmpresa(DINO_COMMERCE_EMPRESA_ID);

  const servicos = barbearia.listarServicos(DINO_COMMERCE_EMPRESA_ID);
  const servico = servicos[0] || barbearia.criarServico(DINO_COMMERCE_EMPRESA_ID, { nome: 'Corte Teste Remarcar', preco: 70, duracaoMinutos: 35 });
  const profissionais = barbearia.listarProfissionais(DINO_COMMERCE_EMPRESA_ID);
  const profissional = profissionais[0] || barbearia.criarProfissional(DINO_COMMERCE_EMPRESA_ID, { nome: 'Barbeiro Teste Remarcar', servicosIds: [servico.id] });

  estado.agendamentos[agId] = {
    id: agId,
    empresaId: DINO_COMMERCE_EMPRESA_ID,
    clienteNome: 'Cliente Remarcacao',
    clienteTelefone: '5565999885566',
    dataHora: new Date(Date.now() + 86400000).toISOString(),
    dataAgenda: '2026-11-20',
    horaLocal: '14:00',
    servicoId: servico.id,
    profissionalId: profissional.id,
    status: 'agendado',
    lojaId: '',
  };

  const atualizado = barbearia.atualizarAgendamento(
    DINO_COMMERCE_EMPRESA_ID,
    agId,
    {
      lojaId: DINO_COMMERCE_LOJA_ID,
      horaLocal: '15:00',
    },
    { permitirEncaixe: true }
  );

  assert.ok(atualizado, 'atualizarAgendamento não deve retornar null para agendamento sem lojaId');
  assert.equal(atualizado.horaLocal, '15:00');
  assert.equal(atualizado.lojaId, DINO_COMMERCE_LOJA_ID);
});

test('cliente consegue cancelar agendamento pelo autoatendimento mesmo com lojaId vazio', () => {
  const agId = `age-teste-autoatend-${Date.now()}-${Math.random()}`;
  const telefone = `5565999${Math.floor(100000 + Math.random() * 900000)}`;
  const codigo = `C${Math.floor(1000000 + Math.random() * 9000000)}`;
  const estado = barbearia.estadoEmpresa(DINO_COMMERCE_EMPRESA_ID);

  // Agendamento futuro (dentro do prazo permitido para autoatendimento)
  const dataHoraFutura = new Date(Date.now() + 3 * 86400000);

  estado.agendamentos[agId] = {
    id: agId,
    empresaId: DINO_COMMERCE_EMPRESA_ID,
    clienteNome: 'Cliente Autoatendimento',
    clienteTelefone: telefone,
    dataHora: dataHoraFutura.toISOString(),
    dataAgenda: dataHoraFutura.toISOString().slice(0, 10),
    horaLocal: '16:00',
    status: 'agendado',
    codigoConfirmacao: codigo,
    lojaId: undefined, // Sem lojaId
  };

  // Cliente cancela informando código, telefone e a loja pública da matriz
  const resultado = captacao.cancelarAgendamentoCliente(
    DINO_COMMERCE_EMPRESA_ID,
    {
      codigo,
      telefone,
      motivo: 'Imprevisto pessoal de viagem',
      lojaId: DINO_COMMERCE_LOJA_ID,
    }
  );

  assert.ok(resultado.agendamento, 'Cliente deve conseguir cancelar');
  assert.equal(resultado.agendamento.status, 'cancelado');
  assert.equal(resultado.agendamento.canceladoPor, 'cliente');
  assert.equal(resultado.visao.status, 'cancelado');
});

test('listarAgendamentos retorna agendamentos sem lojaId e agendamentos com loja legada ao filtrar pela matriz', () => {
  const agSemLoja = `age-lista-sem-${Date.now()}-${Math.random()}`;
  const agLegado = `age-lista-leg-${Date.now()}-${Math.random()}`;
  const estado = barbearia.estadoEmpresa(DINO_COMMERCE_EMPRESA_ID);

  estado.agendamentos[agSemLoja] = {
    id: agSemLoja,
    empresaId: DINO_COMMERCE_EMPRESA_ID,
    clienteNome: 'Lista Sem Loja',
    clienteTelefone: '5565991112233',
    dataHora: new Date().toISOString(),
    status: 'agendado',
    lojaId: '',
  };

  estado.agendamentos[agLegado] = {
    id: agLegado,
    empresaId: DINO_COMMERCE_EMPRESA_ID,
    clienteNome: 'Lista Loja Legada',
    clienteTelefone: '5565991112244',
    dataHora: new Date().toISOString(),
    status: 'agendado',
    lojaId: DINO_LEGACY_LOJA_ID,
  };

  const lista = barbearia.listarAgendamentos(DINO_COMMERCE_EMPRESA_ID, {
    lojaId: DINO_COMMERCE_LOJA_ID,
  });

  const ids = lista.map((item) => item.id);
  assert.ok(ids.includes(agSemLoja), 'Agendamento sem loja deve aparecer na lista da matriz');
  assert.ok(ids.includes(agLegado), 'Agendamento com loja legada deve aparecer na lista da matriz');
});

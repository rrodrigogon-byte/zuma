import test from 'node:test';
import assert from 'node:assert/strict';
import { validarCpf, formatarCpf } from './modules/barbearia/routes-publico.js';
import { vincularClienteAoAtendimento, encontrarClientePorCpf, encontrarClientePorTelefone } from './dino-clientes-vinculo.js';
import * as clientesKytto from './clientes-contas-kytto.js';
import * as barbearia from './barbearia-erp-kytto.js';

test('validarCpf valida corretamente CPFs válidos e rejeita inválidos', () => {
  // Teste de algoritmo
  assert.equal(validarCpf('52998224725'), true, 'CPF válido sem formatação');
  assert.equal(validarCpf('529.982.247-25'), true, 'CPF válido com formatação');
  assert.equal(validarCpf('11111111111'), false, 'Dígitos repetidos rejeitados');
  assert.equal(validarCpf('12345678901'), false, 'Dígitos verificadores errados rejeitados');
  assert.equal(validarCpf('123'), false, 'Menos de 11 dígitos rejeitados');
  assert.equal(formatarCpf('52998224725'), '529.982.247-25');
});

test('vincularClienteAoAtendimento cria novo cliente ativo quando não existe e vincula quando já existe por CPF', () => {
  const empresaId = `empresa-teste-${Date.now()}`;
  const cpfValido = '529.982.247-25';
  const telValido = '(65) 99999-1234';

  // 1. Cliente novo: não existe na base
  const resultado1 = vincularClienteAoAtendimento(empresaId, {
    clienteNome: 'Marcos Vinicius da Silva',
    clienteCpf: cpfValido,
    clienteTelefone: telValido,
  }, { origem: 'agendamento_online' });

  assert.equal(resultado1.vinculado, true);
  assert.equal(resultado1.criado, true);
  assert.ok(resultado1.clienteId);

  // Confere que o cliente foi salvo na base de clientes da empresa com status ativo e CPF
  const clienteCriado = clientesKytto.obterCliente(empresaId, resultado1.clienteId);
  assert.equal(clienteCriado.nome, 'Marcos Vinicius da Silva');
  assert.equal(clienteCriado.cpfCnpj, cpfValido);
  assert.equal(clienteCriado.telefone, telValido);
  assert.notEqual(clienteCriado.status, 'deletado');

  // 2. Cliente existente: novo agendamento com o mesmo CPF
  const resultado2 = vincularClienteAoAtendimento(empresaId, {
    clienteNome: 'Marcos Vinicius da Silva',
    clienteCpf: '52998224725', // sem formatação
    clienteTelefone: '(65) 98888-5555', // telefone atualizado
  }, { origem: 'agendamento_online' });

  assert.equal(resultado2.vinculado, true);
  assert.equal(resultado2.criado, false, 'reaproveita cadastro existente');
  assert.equal(resultado2.clienteId, resultado1.clienteId, 'mesmo ID do cliente anterior');

  // 3. Cliente existente por telefone quando não informou CPF na 1ª vez e informa depois
  const telCliente2 = '(65) 99111-2222';
  const resultado3 = vincularClienteAoAtendimento(empresaId, {
    clienteNome: 'Lucas Oliveira',
    clienteTelefone: telCliente2,
  }, { origem: 'agenda' });

  assert.equal(resultado3.criado, true);
  const cliente2Id = resultado3.clienteId;

  // Próximo agendamento do Lucas informando o CPF
  const cpfLucas = '71250891000'; // CPF válido
  const resultado4 = vincularClienteAoAtendimento(empresaId, {
    clienteNome: 'Lucas Oliveira Santos',
    clienteTelefone: '5565991112222',
    clienteCpf: cpfLucas,
  }, { origem: 'agendamento_online' });

  assert.equal(resultado4.vinculado, true);
  assert.equal(resultado4.criado, false);
  assert.equal(resultado4.clienteId, cliente2Id, 'vinculado ao cadastro do Lucas existente');
  
  // Confere que o CPF foi preenchido no cadastro existente
  const lucasAtualizado = clientesKytto.obterCliente(empresaId, cliente2Id);
  assert.equal(lucasAtualizado.cpfCnpj, cpfLucas);
});

test('barbearia.criarAgendamento preserva clienteCpf e clienteId', () => {
  const empresaId = `empresa-agenda-${Date.now()}`;
  const prof = barbearia.criarProfissional(empresaId, { nome: 'Carlos Barbeiro', ativo: true });
  const serv = barbearia.criarServico(empresaId, { nome: 'Corte Degradê', preco: 45, duracaoMinutos: 30, ativo: true });

  const agendamento = barbearia.criarAgendamento(empresaId, {
    clienteId: 'cli-12345',
    clienteNome: 'Gabriel Santos',
    clienteCpf: '529.982.247-25',
    clienteTelefone: '65999998888',
    profissionalId: prof.id,
    servicoId: serv.id,
    dataHora: '2026-11-05T14:00:00.000Z',
    dataAgenda: '2026-11-05',
    horaLocal: '10:00',
    origem: 'agendamento_online',
  });

  assert.equal(agendamento.clienteId, 'cli-12345');
  assert.equal(agendamento.clienteCpf, '529.982.247-25');
  assert.equal(agendamento.clienteNome, 'Gabriel Santos');
  assert.equal(agendamento.clienteTelefone, '65999998888');

  // Listagem pública de horários não expõe dados sensíveis de agendamento (somente livre/ocupado)
  const horarios = barbearia.listarHorariosDisponiveis(empresaId, {
    data: '2026-11-05',
    servicoId: serv.id,
    profissionalId: prof.id,
  });

  assert.ok(Array.isArray(horarios));
  for (const h of horarios) {
    assert.equal(typeof h.horario, 'string');
    assert.equal(typeof h.disponivel, 'boolean');
    assert.equal(h.clienteNome, undefined, 'nunca vaza nome do cliente');
    assert.equal(h.clienteCpf, undefined, 'nunca vaza CPF do cliente');
    assert.equal(h.clienteTelefone, undefined, 'nunca vaza telefone');
    assert.equal(h.id, undefined, 'nunca vaza id do agendamento');
  }
});

test('serviço restrito a profissional só pode ser agendado por quem está habilitado', () => {
  const empresaId = `empresa-servicos-${Date.now()}`;
  const profNati = barbearia.criarProfissional(empresaId, { nome: 'Nati', ativo: true });
  const profDino = barbearia.criarProfissional(empresaId, { nome: 'Dino', ativo: true });

  // Serviço restrito ao Dino (ex: Barba com Dino)
  const servDino = barbearia.criarServico(empresaId, {
    nome: 'Barba com Dino',
    preco: 300,
    duracaoMinutos: 30,
    ativo: true,
    profissionaisIds: [profDino.id],
  });

  // Serviço feito pela Nati
  const servNati = barbearia.criarServico(empresaId, {
    nome: 'Corte Premium Nati',
    preco: 100,
    duracaoMinutos: 40,
    ativo: true,
    profissionaisIds: [profNati.id],
  });

  // Dino consultando Barba com Dino -> OK
  const horariosDino = barbearia.listarHorariosDisponiveis(empresaId, {
    data: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    servicoId: servDino.id,
    profissionalId: profDino.id,
  });
  assert.ok(Array.isArray(horariosDino));

  // Nati consultando Barba com Dino -> Erro "Este profissional não realiza este serviço."
  assert.throws(
    () => barbearia.listarHorariosDisponiveis(empresaId, {
      data: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      servicoId: servDino.id,
      profissionalId: profNati.id,
    }),
    /não realiza este serviço/i
  );

  // Nati consultando Corte Premium Nati -> OK
  const horariosNati = barbearia.listarHorariosDisponiveis(empresaId, {
    data: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    servicoId: servNati.id,
    profissionalId: profNati.id,
  });
  assert.ok(Array.isArray(horariosNati));
});

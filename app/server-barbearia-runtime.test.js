import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function proximaDataOperacional() {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() + 2);
  data.setUTCHours(12, 0, 0, 0);
  while (data.getUTCDay() === 0) data.setUTCDate(data.getUTCDate() + 1);
  return data.toISOString().slice(0, 10);
}

async function aguardarServidor(base, processo) {
  const inicio = Date.now();
  while (Date.now() - inicio < 12000) {
    if (processo.exitCode !== null) throw new Error(`server.js encerrou antes do healthcheck: ${processo.exitCode}`);
    try {
      const { response } = await request(base, '/api/info');
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Tempo excedido aguardando server.js iniciar.');
}

test('server.js efetivo expõe Barbearia no contrato administrativo', async () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'setpoint-barbearia-runtime-'));
  const dbPath = path.join(diretorio, 'db.json');
  const senhaTeste = 'runtime-only-test-pass';
  fs.writeFileSync(dbPath, JSON.stringify({
    seq: 1,
    usuarios: [{ id: 1, nome: 'Usuário de Teste', email: 'runtime@example.com', senhaHash: bcrypt.hashSync(senhaTeste, 4), role: 'admin', ativo: true, empresaId: 'empresa-runtime', lojaId: 'loja-runtime' }],
  }));
  const port = 32000 + Math.floor(Math.random() * 500);
  const base = `http://127.0.0.1:${port}`;
  const processo = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'app'),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port), DB_PATH: dbPath, JWT_SECRET: 'runtime-only-jwt-secret', COMMERCE_CORE_ENABLED: '0', SEED_DEMO: '0', WPP_BASE_URL: '', WPP_APIKEY: '', AI_API_KEY: '', OPENAI_API_KEY: '' },
    stdio: 'ignore',
  });

  try {
    await aguardarServidor(base, processo);
    const semSessao = await request(base, '/api/admin/barbearia/dashboard');
    assert.equal(semSessao.response.status, 401);
    const login = await request(base, '/api/admin/login', { method: 'POST', body: JSON.stringify({ user: 'runtime@example.com', pass: senhaTeste }) });
    assert.equal(login.response.status, 200);
    const token = login.body.token;
    assert.ok(token);
    const headers = { Authorization: `Bearer ${token}` };

    const integracoes = await request(base, '/api/admin/barbearia/integracoes', { headers });
    assert.equal(integracoes.response.status, 200);
    assert.equal(integracoes.body.whatsapp.envioManualDisponivel, false);
    assert.equal(integracoes.body.ia.configurada, false);
    assert.equal(integracoes.body.commerce.estoqueCompartilhado, false);
    const clienteSemConsentimento = await request(base, '/api/admin/barbearia/clientes', { method: 'POST', headers, body: JSON.stringify({ nome: 'Cliente consentimento runtime', telefone: '65999999999' }) });
    assert.equal(clienteSemConsentimento.response.status, 201);
    const whatsappSemConsentimento = await request(base, '/api/admin/barbearia/whatsapp/enviar', { method: 'POST', headers, body: JSON.stringify({ confirmado: true, clienteId: clienteSemConsentimento.body.cliente.id, finalidade: 'atendimento', mensagem: 'teste' }) });
    assert.equal(whatsappSemConsentimento.response.status, 403);
    assert.equal(whatsappSemConsentimento.body.code, 'TENANT_USE_SCOPED_MODULE');
    const whatsappSemConfirmacao = await request(base, '/api/admin/barbearia/whatsapp/enviar', { method: 'POST', headers, body: JSON.stringify({ telefone: '65999999999', mensagem: 'teste' }) });
    assert.equal(whatsappSemConfirmacao.response.status, 403);
    const statusWppGlobal = await request(base, '/api/admin/whatsapp/status', { headers });
    assert.equal(statusWppGlobal.response.status, 403);
    for (const rota of ['/api/admin/whatsapp/testar', '/api/admin/whatsapp/cobrar']) {
      const negado = await request(base, rota, { method: 'POST', headers, body: JSON.stringify({ telefone: '65999999999' }) });
      assert.equal(negado.response.status, 403, `${rota} não pode operar via tenant`);
      assert.equal(negado.body.code, 'TENANT_USE_SCOPED_MODULE');
    }
    const assistenteSemConfig = await request(base, '/api/admin/barbearia/ia/assistente', { method: 'POST', headers, body: JSON.stringify({ pergunta: 'Quais são os horários livres?' }) });
    assert.equal(assistenteSemConfig.response.status, 200);
    assert.equal(assistenteSemConfig.body.modo, 'local');
    assert.equal(assistenteSemConfig.body.modelo, 'regras-dino-local');
    assert.match(assistenteSemConfig.body.resposta, /somente informativa/i);

    const configuracoes = await request(base, '/api/admin/barbearia/configuracoes', { headers });
    assert.equal(configuracoes.response.status, 200);
    assert.equal(configuracoes.body.configuracao.intervaloMinutos, 30);
    const unidade = await request(base, '/api/admin/barbearia/configuracoes/unidade-ativa', { headers });
    assert.equal(unidade.response.status, 200);
    assert.equal(unidade.body.lojaId, 'loja-runtime');
    const unidadeHeaderArbitrario = await request(base, '/api/admin/barbearia/configuracoes/unidade-ativa', { headers: { ...headers, 'X-Loja-Id': 'loja-fora-do-escopo' } });
    assert.equal(unidadeHeaderArbitrario.response.status, 200);
    assert.equal(unidadeHeaderArbitrario.body.lojaId, 'loja-runtime');
    const unidadeAtualizada = await request(base, '/api/admin/barbearia/configuracoes/unidade-ativa', { method: 'PATCH', headers, body: JSON.stringify({ horarioAbertura: '09:00', horarioFechamento: '19:00', feriados: ['2030-06-20'] }) });
    assert.equal(unidadeAtualizada.response.status, 200);
    const configuracaoPublica = await request(base, '/api/admin/barbearia/configuracoes', { method: 'PATCH', headers, body: JSON.stringify({ slugPublico: 'runtime-dino', nomePublico: 'Dino Runtime', whatsappPublico: '65999990000', lojaPublicaId: 'loja-runtime', agendamentoPublicoAtivo: true, antecedenciaMinutos: 0, janelaReservaDias: 365 }) });
    assert.equal(configuracaoPublica.response.status, 200);
    assert.equal(configuracaoPublica.body.configuracao.slugPublico, 'runtime-dino');

    const servico = await request(base, '/api/admin/barbearia/servicos', { method: 'POST', headers, body: JSON.stringify({ nome: 'Corte runtime', duracaoMinutos: 45, preco: 50 }) });
    assert.equal(servico.response.status, 201);
    const profissional = await request(base, '/api/admin/barbearia/profissionais', { method: 'POST', headers, body: JSON.stringify({ nome: 'Profissional runtime' }) });
    assert.equal(profissional.response.status, 201);

    const slugInexistente = await request(base, '/api/publico/agendamento/inexistente-runtime');
    assert.equal(slugInexistente.response.status, 404);
    const catalogoPublico = await request(base, '/api/publico/agendamento/runtime-dino');
    assert.equal(catalogoPublico.response.status, 200);
    assert.equal(catalogoPublico.body.estabelecimento.nome, 'Dino Runtime');
    assert.equal(catalogoPublico.body.servicos[0].id, servico.body.servico.id);
    assert.equal(catalogoPublico.body.profissionais[0].id, profissional.body.profissional.id);
    const dataPublica = proximaDataOperacional();
    const horariosPublicos = await request(base, `/api/publico/agendamento/runtime-dino/horarios?data=${dataPublica}&servico_id=${servico.body.servico.id}&profissional_id=${profissional.body.profissional.id}`);
    assert.equal(horariosPublicos.response.status, 200);
    const horarioLivre = horariosPublicos.body.horarios.find((item) => item.disponivel)?.horario;
    assert.ok(horarioLivre);
    const payloadPublico = { servico_id: servico.body.servico.id, profissional_id: profissional.body.profissional.id, data: dataPublica, horario: horarioLivre, cliente_nome: 'Cliente público runtime', cliente_telefone: '65999998888', observacoes: 'Contrato público isolado.' };
    const confirmacaoPublica = await request(base, '/api/publico/agendamento/runtime-dino/confirmar', { method: 'POST', body: JSON.stringify(payloadPublico) });
    assert.equal(confirmacaoPublica.response.status, 201);
    assert.match(confirmacaoPublica.body.agendamento.codigo, /^[A-F0-9]{8}$/);
    assert.equal(confirmacaoPublica.body.agendamento.status, 'agendado');
    assert.equal(confirmacaoPublica.body.agendamento.profissional, 'Profissional runtime');
    const conflitoPublico = await request(base, '/api/publico/agendamento/runtime-dino/confirmar', { method: 'POST', body: JSON.stringify(payloadPublico) });
    assert.equal(conflitoPublico.response.status, 409);
    const livres = horariosPublicos.body.horarios.filter((item) => item.disponivel && item.horario !== horarioLivre).map((item) => item.horario);
    const segundo = await request(base, '/api/publico/agendamento/runtime-dino/confirmar', { method: 'POST', body: JSON.stringify({ ...payloadPublico, horario: livres.at(-1), cliente_telefone: '556599998888' }) });
    assert.equal(segundo.response.status, 201, 'segundo horário do mesmo telefone é aceito');
    const terceiro = await request(base, '/api/publico/agendamento/runtime-dino/confirmar', { method: 'POST', body: JSON.stringify({ ...payloadPublico, horario: livres.at(-4), cliente_telefone: '(65) 99999-8888' }) });
    assert.equal(terceiro.response.status, 409, 'terceiro horário do mesmo telefone (em outro formato) é recusado');
    assert.equal(terceiro.body.code, 'LIMITE_AGENDAMENTOS_TELEFONE');
    const telefoneInvalido = await request(base, '/api/publico/agendamento/runtime-dino/confirmar', { method: 'POST', body: JSON.stringify({ ...payloadPublico, horario: horariosPublicos.body.horarios.find((item) => item.disponivel && item.horario !== horarioLivre)?.horario || horarioLivre, cliente_telefone: '123' }) });
    assert.equal(telefoneInvalido.response.status, 400);
    const canalDesativado = await request(base, '/api/admin/barbearia/configuracoes', { method: 'PATCH', headers, body: JSON.stringify({ agendamentoPublicoAtivo: false }) });
    assert.equal(canalDesativado.response.status, 200);
    const catalogoDesativado = await request(base, '/api/publico/agendamento/runtime-dino');
    assert.equal(catalogoDesativado.response.status, 404);
    const canalReativado = await request(base, '/api/admin/barbearia/configuracoes', { method: 'PATCH', headers, body: JSON.stringify({ agendamentoPublicoAtivo: true }) });
    assert.equal(canalReativado.response.status, 200);
    const agendaPublicaPersistida = await request(base, `/api/admin/barbearia/agenda?data=${dataPublica}`, { headers });
    assert.equal(agendaPublicaPersistida.response.status, 200);
    assert.equal(agendaPublicaPersistida.body.agendamentos.length, 2);
    const primeiroPublico = agendaPublicaPersistida.body.agendamentos.find((item) => item.codigoConfirmacao === confirmacaoPublica.body.agendamento.codigo);
    assert.equal(primeiroPublico?.origem, 'agendamento_online');

    const agenda = await request(base, '/api/admin/barbearia/agenda', { method: 'POST', headers, body: JSON.stringify({ clienteNome: 'Cliente runtime', profissionalId: profissional.body.profissional.id, servicoId: servico.body.servico.id, dataAgenda: '2030-06-10', dataHora: '2030-06-10T13:00:00.000Z' }) });
    assert.equal(agenda.response.status, 201);
    assert.equal(agenda.body.agendamento.lojaId, 'loja-runtime');
    assert.equal(agenda.body.notificacao.skipped, true);
    assert.equal(agenda.body.notificacao.reason, 'commerce_scope_unavailable');
    const remarcado = await request(base, `/api/admin/barbearia/agenda/${agenda.body.agendamento.id}`, { method: 'PATCH', headers, body: JSON.stringify({ dataAgenda: '2030-06-10', dataHora: '2030-06-10T14:30:00.000Z', horaLocal: '10:30' }) });
    assert.equal(remarcado.response.status, 200);
    assert.equal(remarcado.body.agendamento.historicoRemarcacoes.length, 1);
    assert.equal(remarcado.body.notificacao.skipped, true);

    const listagem = await request(base, '/api/admin/barbearia/agenda?data=2030-06-10', { headers });
    assert.equal(listagem.response.status, 200);
    assert.equal(listagem.body.total, 1);
    assert.equal(listagem.body.agendamentos[0].servicoNome, 'Corte runtime');

    const confirmado = await request(base, `/api/admin/barbearia/agenda/${agenda.body.agendamento.id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'confirmado' }) });
    assert.equal(confirmado.response.status, 200);

    const fila = await request(base, '/api/admin/barbearia/fila', { method: 'POST', headers, body: JSON.stringify({ clienteNome: 'Fila runtime', dataAgenda: '2030-06-10', servicoId: servico.body.servico.id }) });
    assert.equal(fila.response.status, 201);
    assert.match(fila.body.item.senha, /^B/);
    const filaListada = await request(base, '/api/admin/barbearia/fila?data=2030-06-10', { headers });
    assert.equal(filaListada.response.status, 200);
    assert.equal(filaListada.body.fila.length, 1);

    const bloqueio = await request(base, '/api/admin/barbearia/bloqueios', { method: 'POST', headers, body: JSON.stringify({ titulo: 'Bloqueio runtime', inicio: '2030-06-10T15:00:00.000Z', fim: '2030-06-10T16:00:00.000Z', profissionalId: profissional.body.profissional.id }) });
    assert.equal(bloqueio.response.status, 201);
    const bloqueios = await request(base, '/api/admin/barbearia/bloqueios?data=2030-06-10', { headers });
    assert.equal(bloqueios.response.status, 200);
    assert.equal(bloqueios.body.bloqueios.length, 1);

    const plano = await request(base, '/api/admin/barbearia/planos', { method: 'POST', headers, body: JSON.stringify({ nome: 'Plano runtime', preco: 100, sessoesIncluidas: 4, validadeDias: 30, servicosIds: [servico.body.servico.id] }) });
    assert.equal(plano.response.status, 201);
    const assinatura = await request(base, '/api/admin/barbearia/assinaturas', { method: 'POST', headers, body: JSON.stringify({ clienteNome: 'Cliente assinatura runtime', planoId: plano.body.plano.id }) });
    assert.equal(assinatura.response.status, 201);
    assert.equal(assinatura.body.assinatura.status, 'pendente_ativacao');
    const assinaturas = await request(base, '/api/admin/barbearia/assinaturas', { headers });
    assert.equal(assinaturas.response.status, 200);
    assert.equal(assinaturas.body.assinaturas.length, 1);

    const fidelidade = await request(base, '/api/admin/barbearia/fidelidade', { headers });
    assert.equal(fidelidade.response.status, 200);
    assert.equal(Array.isArray(fidelidade.body.fidelidade.membros), true);

    const produto = await request(base, '/api/admin/barbearia/estoque-revenda', { method: 'POST', headers, body: JSON.stringify({ nome: 'Pomada runtime', precoVenda: 30, estoqueAtual: 2, estoqueMinimo: 1 }) });
    assert.equal(produto.response.status, 201);
    const venda = await request(base, '/api/admin/barbearia/vendas-revenda', { method: 'POST', headers, body: JSON.stringify({ clienteNome: 'Cliente venda runtime', profissionalId: profissional.body.profissional.id, itens: [{ produtoId: produto.body.produto.id, quantidade: 1 }] }) });
    assert.equal(venda.response.status, 201);
    assert.equal(venda.body.venda.status, 'aguardando_pagamento');
    const recebimento = await request(base, `/api/admin/barbearia/vendas-revenda/${venda.body.venda.id}/confirmar-pagamento`, { method: 'POST', headers, body: JSON.stringify({ confirmadoPagamento: true, meioPagamento: 'pix', valorRecebido: 30 }) });
    assert.equal(recebimento.response.status, 200);
    assert.equal(recebimento.body.venda.status, 'pago');
    const vendasPagas = await request(base, '/api/admin/barbearia/vendas-revenda?status=pago', { headers });
    assert.equal(vendasPagas.response.status, 200);
    assert.equal(vendasPagas.body.vendas.length, 1);
    const comissoes = await request(base, '/api/admin/barbearia/comissoes', { headers });
    assert.equal(comissoes.response.status, 200);
    assert.equal(comissoes.body.comissoes.porProfissional.find((item) => item.profissionalId === profissional.body.profissional.id).vendasProdutos, 1);

    const comanda = await request(base, '/api/admin/barbearia/comandas', { method: 'POST', headers, body: JSON.stringify({ clienteNome: 'Cliente comanda runtime', profissionalId: profissional.body.profissional.id, agendamentoId: agenda.body.agendamento.id, itens: [{ tipo: 'servico', servicoId: servico.body.servico.id, quantidade: 1 }, { tipo: 'produto', produtoId: produto.body.produto.id, quantidade: 1 }] }) });
    assert.equal(comanda.response.status, 201);
    assert.equal(comanda.body.comanda.status, 'aberta');
    assert.equal(comanda.body.comanda.itens.length, 2);
    const comandaAjustada = await request(base, `/api/admin/barbearia/comandas/${comanda.body.comanda.id}`, { method: 'PATCH', headers, body: JSON.stringify({ gorjeta: 5, desconto: 2, descontoMotivo: 'Cortesia de teste', observacoes: 'Comanda de integração HTTP.' }) });
    assert.equal(comandaAjustada.response.status, 200);
    assert.equal(comandaAjustada.body.comanda.gorjeta, 5);
    const comandaPagamentoPendente = await request(base, `/api/admin/barbearia/comandas/${comanda.body.comanda.id}/aguardar-pagamento`, { method: 'POST', headers, body: '{}' });
    assert.equal(comandaPagamentoPendente.response.status, 200);
    assert.equal(comandaPagamentoPendente.body.comanda.status, 'aguardando_pagamento');
    const pagamentoComandaPayload = { confirmado: true, chaveIdempotencia: 'runtime-comanda-payment-1', pagamentos: [{ meio: 'pix', valor: 83 }] };
    const comandaPaga = await request(base, `/api/admin/barbearia/comandas/${comanda.body.comanda.id}/pagamentos`, { method: 'POST', headers, body: JSON.stringify(pagamentoComandaPayload) });
    assert.equal(comandaPaga.response.status, 200);
    assert.equal(comandaPaga.body.comanda.status, 'paga');
    assert.equal(comandaPaga.body.comanda.totalPago, 83);
    const comandaPagaRepetida = await request(base, `/api/admin/barbearia/comandas/${comanda.body.comanda.id}/pagamentos`, { method: 'POST', headers, body: JSON.stringify(pagamentoComandaPayload) });
    assert.equal(comandaPagaRepetida.response.status, 200);
    assert.equal(comandaPagaRepetida.body.comanda.pagamentos.length, 1);
    const fiscal = await request(base, `/api/admin/barbearia/comandas/${comanda.body.comanda.id}/fiscal/rascunho`, { method: 'POST', headers, body: JSON.stringify({ confirmado: true, chaveIdempotencia: `runtime:fiscal:${comanda.body.comanda.id}` }) });
    assert.equal(fiscal.response.status, 201);
    assert.equal(fiscal.body.documento.status, 'rascunho_pendente_integracao');
    assert.equal(fiscal.body.documento.transmitido, false);

    const dashboard = await request(base, '/api/admin/barbearia/dashboard?data=2030-06-10', { headers });
    assert.equal(dashboard.response.status, 200);
    assert.equal(dashboard.body.indicadores.agendamentosHoje, 1);
    assert.equal(dashboard.body.indicadores.vendasRevendaHoje, 0);

    const overview = await request(base, '/api/admin/barbearia/overview?data=2030-06-10', { headers });
    assert.equal(overview.response.status, 200);
    assert.equal(overview.body.dashboard.indicadores.agendamentosHoje, 1);
    assert.equal(overview.body.agendamentos.length, 1);
    assert.equal(overview.body.agendamentos[0].servicoNome, 'Corte runtime');
    assert.equal(overview.body.profissionais.length, 1);
    assert.equal(overview.body.servicos.length, 1);
    // O agendamento online com nome + telefone agora gera/vincula o cadastro do cliente.
    assert.equal(overview.body.clientes.length, 2);
    assert.ok(overview.body.clientes.some((item) => item.id === clienteSemConsentimento.body.cliente.id));
    assert.ok(overview.body.clientes.some((item) => item.nome === 'Cliente público runtime'));
    assert.equal(overview.body.fidelidade.membros.length, 0);
    assert.equal(overview.body.produtos.length, 1);
    assert.equal(overview.body.vendas.length, 1);
    assert.equal(overview.body.comandas.length, 1);
    assert.equal(overview.body.resumoComandas.pagas, 1);
    assert.equal(overview.body.comissoes.porProfissional.length, 1);
    assert.deepEqual(overview.body.notificacoesAgenda, { queued: 0, sent: 0, failed: 0, canceled: 0 });
    assert.equal(overview.body.documentosFiscais.length, 1);
    assert.equal(overview.body.integracoes.whatsapp.envioManualDisponivel, false);
    assert.equal(overview.body.integracoes.commerce.sincronizacaoAutomatica, false);
  } finally {
    processo.kill('SIGTERM');
    await Promise.race([once(processo, 'exit'), new Promise((resolve) => setTimeout(resolve, 3000))]);
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
});

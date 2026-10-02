// Contrato HTTP das cobranças (onda 3). Base copiada do teste da captação.
// Contrato HTTP da captação (server.js real): consentimento e indicação no
// agendamento online, lista de espera, autoatendimento por código + telefone e
// os painéis do admin (clube, indicações, retornos, ocupação, metas).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function dataFutura(dias) {
  const data = new Date(Date.now() + dias * 86400000);
  data.setUTCHours(12, 0, 0, 0);
  return data.toISOString().slice(0, 10);
}

async function aguardarServidor(base, processo) {
  const inicio = Date.now();
  while (Date.now() - inicio < 12000) {
    if (processo.exitCode !== null) throw new Error(`server.js encerrou: ${processo.exitCode}`);
    try { if ((await request(base, '/api/info')).response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('server.js não subiu');
}

test('cobranças: sinal no link público, confirmação da equipe, cashback, canais, receita da IA e dados estruturados', async () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'cobranca-runtime-'));
  const dbPath = path.join(diretorio, 'db.json');
  const senha = 'cobranca-runtime-pass';
  fs.writeFileSync(dbPath, JSON.stringify({ seq: 1, usuarios: [{ id: 1, nome: 'Admin Cobrança', email: 'cobranca@example.com', senhaHash: bcrypt.hashSync(senha, 4), role: 'admin', ativo: true, empresaId: 'empresa-cobranca', lojaId: 'loja-cobranca' }] }));
  const port = 33600 + Math.floor(Math.random() * 300);
  const base = `http://127.0.0.1:${port}`;
  const processo = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'app'),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port), DB_PATH: dbPath, JWT_SECRET: 'cobranca-jwt', PUBLIC_BASE_URL: `http://127.0.0.1:${port}`, SERVER_URL: '', INFINITEPAY_HANDLE: '', INFINITEPAY_TAG: '', COMMERCE_CORE_ENABLED: '0', SEED_DEMO: '0', WPP_BASE_URL: '', WPP_APIKEY: '', AI_API_KEY: '', OPENAI_API_KEY: '' },
    stdio: 'ignore',
  });
  try {
    await aguardarServidor(base, processo);
    const login = await request(base, '/api/admin/login', { method: 'POST', body: JSON.stringify({ user: 'cobranca@example.com', pass: senha }) });
    const headers = { Authorization: `Bearer ${login.body.token}` };
    await request(base, '/api/admin/barbearia/configuracoes', { method: 'PATCH', headers, body: JSON.stringify({ slugPublico: 'dino', nomePublico: 'Dino Cobrança', whatsappPublico: '65993360000', enderecoPublico: 'Rua A, 80', lojaPublicaId: 'loja-cobranca', agendamentoPublicoAtivo: true, antecedenciaMinutos: 0, janelaReservaDias: 365, diasFuncionamento: [0, 1, 2, 3, 4, 5, 6], horarioAbertura: '08:00', horarioFechamento: '20:00' }) });
    const servico = (await request(base, '/api/admin/barbearia/servicos', { method: 'POST', headers, body: JSON.stringify({ nome: 'Corte', duracaoMinutos: 30, preco: 60 }) })).body.servico;
    const profissional = (await request(base, '/api/admin/barbearia/profissionais', { method: 'POST', headers, body: JSON.stringify({ nome: 'Bruno', horarioInicio: '08:00', horarioFim: '20:00', diasTrabalho: [0, 1, 2, 3, 4, 5, 6] }) })).body.profissional;

    const semMeio = await request(base, '/api/admin/barbearia/cobrancas/configuracao', { method: 'PUT', headers, body: JSON.stringify({ sinal: { ativo: true } }) });
    assert.equal(semMeio.response.status, 409);
    const config = await request(base, '/api/admin/barbearia/cobrancas/configuracao', { method: 'PUT', headers, body: JSON.stringify({ pix: { chave: 'financeiro@dino.com.br', nomeRecebedor: 'Dino', cidade: 'Tangara' }, sinal: { ativo: true, tipo: 'percentual', valor: 50, prazoMinutos: 30 }, cashback: { percentual: 10, validadeDias: 60 } }) });
    assert.equal(config.response.status, 200, JSON.stringify(config.body));
    assert.equal(config.body.configuracao.provedor, 'pix_manual');

    const publico = await request(base, '/api/publico/agendamento/dino');
    assert.deepEqual(publico.body.politicas.sinal, { tipo: 'percentual', valor: 50, prazoMinutos: 30 });
    const data = dataFutura(2);
    const confirmar = await request(base, '/api/publico/agendamento/dino/confirmar', { method: 'POST', body: JSON.stringify({ servico_id: servico.id, profissional_id: profissional.id, data, horario: '10:00', cliente_nome: 'Lucas Sinal', cliente_telefone: '65977770010', canal: 'instagram', campanha: 'bio' }) });
    assert.equal(confirmar.response.status, 201, JSON.stringify(confirmar.body));
    assert.equal(confirmar.body.pagamento.valor, 30);
    assert.match(confirmar.body.pagamento.pixCopiaECola, /^000201/);
    const codigo = confirmar.body.agendamento.codigo;

    const meu = await request(base, '/api/publico/agendamento/dino/meu-agendamento', { method: 'POST', body: JSON.stringify({ codigo, cliente_telefone: '65977770010' }) });
    assert.equal(meu.body.agendamento.sinal.status, 'pendente');
    assert.match(meu.body.agendamento.sinal.pixCopiaECola, /^000201/);

    const painel = await request(base, '/api/admin/barbearia/cobrancas', { headers });
    const sinal = painel.body.cobrancas[0];
    assert.equal(sinal.tipo, 'sinal');
    const semConfirmar = await request(base, `/api/admin/barbearia/cobrancas/${sinal.id}/confirmar`, { method: 'POST', headers, body: '{}' });
    assert.equal(semConfirmar.response.status, 400);
    const pago = await request(base, `/api/admin/barbearia/cobrancas/${sinal.id}/confirmar`, { method: 'POST', headers, body: JSON.stringify({ confirmado: true }) });
    assert.equal(pago.body.cobranca.status, 'paga');
    const agenda = (await request(base, `/api/admin/barbearia/agenda?data=${data}`, { headers })).body.agendamentos;
    const ag = agenda.find((item) => item.codigoConfirmacao === codigo);
    assert.equal(ag.status, 'confirmado');

    // Webhook de cobrança desconhecida não pede reenvio nem confirma nada.
    const webhook = await request(base, '/api/webhooks/infinitepay/barbearia', { method: 'POST', body: JSON.stringify({ order_nsu: 'DINOSFALSO', transaction_nsu: 'x', invoice_slug: 'y' }) });
    assert.equal(webhook.response.status, 200);
    assert.equal(webhook.body.ok, false);

    // Conclusão: credita 10% de cashback; uso maior que o saldo é recusado antes de concluir.
    await request(base, `/api/admin/barbearia/agenda/${ag.id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'em_atendimento' }) });
    const excesso = await request(base, `/api/admin/barbearia/agenda/${ag.id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'concluido', registrarFinanceiro: true, confirmado: true, meioPagamento: 'pix', valorRecebido: 25, usarCashback: 5 }) });
    assert.equal(excesso.response.status, 409, 'sem saldo de cashback');
    // Sinal de R$ 30 já pago: cobrar o serviço cheio é recusado; o devido é R$ 30.
    const cheio = await request(base, `/api/admin/barbearia/agenda/${ag.id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'concluido', registrarFinanceiro: true, confirmado: true, meioPagamento: 'pix', valorRecebido: 60 }) });
    assert.equal(cheio.response.status, 409);
    assert.equal(cheio.body.code, 'RECEIPT_AMOUNT_MISMATCH');
    const concluido = await request(base, `/api/admin/barbearia/agenda/${ag.id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'concluido', registrarFinanceiro: true, confirmado: true, meioPagamento: 'pix', valorRecebido: 30 }) });
    assert.equal(concluido.response.status, 200, JSON.stringify(concluido.body));
    assert.equal(concluido.body.financeiro.valor, 30);
    assert.equal(concluido.body.cashback.credito.creditado, 6, '10% sobre o que foi pago em dinheiro (sinal + restante)');
    const saldo = await request(base, '/api/admin/barbearia/cashback/consulta', { method: 'POST', headers, body: JSON.stringify({ telefone: '(65) 97777-0010' }) });
    assert.equal(saldo.body.cashback.saldo, 6);

    const canais = await request(base, `/api/admin/barbearia/captacao/canais?inicio=${data}&fim=${data}`, { headers });
    assert.equal(canais.body.canais[0].canal, 'Instagram');
    assert.equal(canais.body.canais[0].receita, 60);
    const receitaIa = await request(base, `/api/admin/barbearia/captacao/receita-ia?inicio=${data}&fim=${data}`, { headers });
    assert.equal(receitaIa.response.status, 200);

    const html = await (await fetch(`${base}/agendar/dino`)).text();
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
    assert.equal(ld['@type'], 'HairSalon');
    assert.equal(ld.telephone, '+5565993360000');
    assert.equal(ld.potentialAction['@type'], 'ReserveAction');
  } finally {
    processo.kill('SIGTERM');
  }
});

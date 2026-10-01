import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const SENHA = 'dino-admin-test-pass';

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function aguardar(base, processo) {
  const inicio = Date.now();
  while (Date.now() - inicio < 15000) {
    if (processo.exitCode !== null) throw new Error(`server.js encerrou: ${processo.exitCode}`);
    try { const { response } = await request(base, '/api/info'); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('server.js não iniciou');
}

// Backend falso com o mesmo contrato do chatbot-backend do NossaGente.
function fakeBackend() {
  const calls = [];
  let state = 'close';
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      calls.push({ method: req.method, url: req.url, auth: req.headers.authorization, apikey: req.headers.apikey, body: raw ? JSON.parse(raw) : null });
      const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
      if (req.headers.authorization !== 'Bearer chave-teste') return send(401, { message: 'unauthorized' });
      if (req.url === '/api/v1/whats-app/instances/dino-1/status') return send(200, { instance: 'dino-1', state, phone: '5565993360000' });
      if (req.url === '/api/v1/whats-app/instances/dino-1/qr') { state = 'qr'; return send(200, { qrcode: '2@AbCdEfGhIjKlMnOpQrStUvWxYz0123456789,abc,def', pairingCode: 'ABCD-1234' }); }
      if (req.url === '/api/v1/whats-app/instances/dino-1/messages/text' && req.method === 'POST') return send(201, { id: 'msg-1', status: 'sent' });
      if (req.url === '/api/v1/whats-app/instances/fora-da-lista/status') return send(404, { message: 'instance not enabled' });
      return send(404, { message: 'not found' });
    });
  });
  return { server, calls, setState: (value) => { state = value; } };
}

test('admin da empresa: isolamento, guardas legados, BI, cliente automático e WhatsApp NossaGente', async () => {
  const backend = fakeBackend();
  await new Promise((resolve) => backend.server.listen(0, '127.0.0.1', resolve));
  const backendUrl = `http://127.0.0.1:${backend.server.address().port}`;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dino-admin-'));
  const dbPath = path.join(dir, 'db.json');
  const hash = bcrypt.hashSync(SENHA, 4);
  fs.writeFileSync(dbPath, JSON.stringify({
    seq: 1,
    lancamentos: [{ id: 900, tipo: 'receita', categoria: 'Inscrição Torneio', descricao: 'Receita do evento', valor: 300, status: 'pendente', vencimento: '2026-01-01' }],
    usuarios: [
      { id: 1, nome: 'Gestor A', email: 'a@dino.test', senhaHash: hash, role: 'admin', ativo: true, empresaId: 'emp-a', lojaId: 'loja-a' },
      { id: 2, nome: 'Barbeiro A', email: 'staff@dino.test', senhaHash: hash, role: 'staff', ativo: true, empresaId: 'emp-a', lojaId: 'loja-a' },
      { id: 3, nome: 'Gestor B', email: 'b@outra.test', senhaHash: hash, role: 'admin', ativo: true, empresaId: 'emp-b', lojaId: 'loja-b' },
      { id: 4, nome: 'Organização evento', email: 'evento@setpoint.test', senhaHash: hash, role: 'admin', ativo: true },
    ],
  }));
  const port = 33000 + Math.floor(Math.random() * 500);
  const base = `http://127.0.0.1:${port}`;
  const processo = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'app'),
    env: {
      ...process.env, NODE_ENV: 'development', PORT: String(port), DB_PATH: dbPath, JWT_SECRET: 'dino-admin-jwt', COMMERCE_CORE_ENABLED: '0', SEED_DEMO: '0',
      WPP_BASE_URL: '', WPP_APIKEY: '', PLATFORM_ADMIN_EMAILS: '',
      WHATSAPP_PROVIDER: 'chatbot_backend', CHATBOT_BACKEND_URL: backendUrl, CHATBOT_BACKEND_KEY: 'chave-teste', CHATBOT_BACKEND_INSTANCE: 'dino-1', WHATSAPP_CONNECTION_WATCHDOG: 'false',
    },
    stdio: 'ignore',
  });

  try {
    await aguardar(base, processo);
    const login = async (email) => {
      const result = await request(base, '/api/admin/login', { method: 'POST', body: JSON.stringify({ user: email, pass: SENHA }) });
      assert.equal(result.response.status, 200, email);
      return { Authorization: `Bearer ${result.body.token}` };
    };
    const A = await login('a@dino.test');
    const staffA = await login('staff@dino.test');
    const B = await login('b@outra.test');
    const evento = await login('evento@setpoint.test');

    // ── Financeiro separado por empresa ──
    const criado = await request(base, '/api/admin/barbearia/financeiro/lancamentos', { method: 'POST', headers: A, body: JSON.stringify({ tipo: 'despesa', categoria: 'Aluguel', descricao: 'Aluguel setembro', valor: 1500, vencimento: '2026-09-30', obs: 'contrato 12m' }) });
    assert.equal(criado.response.status, 201);
    assert.equal(criado.body.obs, 'contrato 12m');
    const listaA = await request(base, '/api/admin/barbearia/financeiro/lancamentos', { headers: A });
    assert.equal(listaA.body.length, 1);
    assert.equal(listaA.body[0].descricao, 'Aluguel setembro');
    const listaB = await request(base, '/api/admin/barbearia/financeiro/lancamentos', { headers: B });
    assert.equal(listaB.body.length, 0, 'empresa B não vê lançamentos da A');
    const resumoA = await request(base, '/api/admin/barbearia/financeiro/resumo', { headers: A });
    assert.equal(resumoA.body.aPagar, 1500);
    assert.equal(resumoA.body.aReceber, 0, 'receita do evento legado não aparece');
    const pago = await request(base, `/api/admin/barbearia/financeiro/lancamentos/${criado.body.id}`, { method: 'PATCH', headers: A, body: JSON.stringify({ status: 'pago' }) });
    assert.equal(pago.body.status, 'pago');
    const alheio = await request(base, `/api/admin/barbearia/financeiro/lancamentos/${criado.body.id}`, { method: 'PATCH', headers: B, body: JSON.stringify({ status: 'cancelado' }) });
    assert.equal(alheio.response.status, 404, 'B não altera lançamento da A');
    const staffFin = await request(base, '/api/admin/barbearia/financeiro/lancamentos', { headers: staffA });
    assert.equal(staffFin.response.status, 403, 'barbeiro não vê o financeiro');

    // ── Despesa recorrente: 12 parcelas mensais, série encerrável ──
    const serie = await request(base, '/api/admin/barbearia/financeiro/lancamentos', { method: 'POST', headers: A, body: JSON.stringify({ tipo: 'despesa', categoria: 'Internet e telefone', descricao: 'Internet', valor: 150, vencimento: '2026-01-31', status: 'pago', recorrencia: { meses: 12 } }) });
    assert.equal(serie.response.status, 201);
    assert.equal(serie.body.serie.parcelas.length, 12);
    assert.deepEqual(serie.body.serie.parcelas.slice(0, 3).map((item) => item.vencimento), ['2026-01-31', '2026-02-28', '2026-03-31']);
    assert.equal(serie.body.serie.parcelas[0].status, 'pago');
    assert.ok(serie.body.serie.parcelas.slice(1).every((item) => item.status === 'pendente'), 'futuras nascem pendentes');
    assert.equal((await request(base, '/api/admin/barbearia/financeiro/lancamentos', { method: 'POST', headers: A, body: JSON.stringify({ tipo: 'despesa', descricao: 'x', valor: 1, vencimento: '2026-01-01', recorrencia: { meses: 30 } }) })).response.status, 400);
    assert.equal((await request(base, `/api/admin/barbearia/financeiro/series/${serie.body.serie.id}`, { method: 'DELETE', headers: B })).response.status, 404, 'B não encerra série da A');
    const encerrada = await request(base, `/api/admin/barbearia/financeiro/series/${serie.body.serie.id}`, { method: 'DELETE', headers: A });
    assert.equal(encerrada.body.canceladas, 11);

    // ── Metas do mês ──
    assert.equal((await request(base, '/api/admin/barbearia/metas', { method: 'PUT', headers: staffA, body: JSON.stringify({ receita: 1 }) })).response.status, 403);
    const metas = await request(base, '/api/admin/barbearia/metas', { method: 'PUT', headers: A, body: JSON.stringify({ receita: 20000, atendimentos: 250 }) });
    assert.equal(metas.body.metas.receita, 20000);
    assert.equal((await request(base, '/api/admin/barbearia/metas', { headers: B })).body.metas.receita, null, 'metas são por empresa');
    const painel = await request(base, '/api/admin/barbearia/analytics?period=30', { headers: A });
    assert.equal(painel.response.status, 200);
    assert.equal(painel.body.goals.configured, true);
    assert.deepEqual(painel.body.goals.items.map((item) => item.id), ['receita', 'atendimentos']);

    // ── Módulos globais legados bloqueados para usuários de empresa ──
    const legadoA = await request(base, '/api/admin/financeiro/lancamentos', { headers: A });
    assert.equal(legadoA.response.status, 403);
    assert.equal(legadoA.body.code, 'TENANT_USE_SCOPED_MODULE');
    const legadoEvento = await request(base, '/api/admin/financeiro/lancamentos', { headers: evento });
    assert.equal(legadoEvento.response.status, 200);
    assert.equal(legadoEvento.body[0].descricao, 'Receita do evento');
    assert.equal((await request(base, '/api/admin/reset', { method: 'POST', headers: A, body: JSON.stringify({ tipo: 'auditoria' }) })).response.status, 403);
    assert.equal((await request(base, '/api/admin/config', { method: 'PATCH', headers: A, body: JSON.stringify({}) })).response.status, 403);

    // ── Auditoria por empresa ──
    const audA = await request(base, '/api/admin/barbearia/auditoria', { headers: A });
    assert.equal(audA.response.status, 200);
    assert.ok(audA.body.itens.some((item) => item.acao === 'FINANCEIRO LANCAMENTO'));
    const audB = await request(base, '/api/admin/barbearia/auditoria', { headers: B });
    assert.ok(!audB.body.itens.some((item) => item.acao === 'FINANCEIRO LANCAMENTO'), 'B não vê auditoria da A');
    const audLegadoA = await request(base, '/api/admin/auditoria', { headers: A });
    assert.ok(audLegadoA.body.length > 0 && audLegadoA.body.every((item) => item.empresaId === 'emp-a' && item.ip === ''));
    const audLegadoEvento = await request(base, '/api/admin/auditoria', { headers: evento });
    assert.ok(audLegadoEvento.body.every((item) => !item.empresaId), 'equipe do evento não vê auditoria das empresas');
    assert.equal((await request(base, '/api/admin/barbearia/auditoria', { headers: staffA })).response.status, 403);

    // ── Cadastro automático de cliente pela agenda ──
    const prof = await request(base, '/api/admin/barbearia/profissionais', { method: 'POST', headers: A, body: JSON.stringify({ nome: 'Bruno', percentualComissao: 50, ativo: true, agenda: {} }) });
    assert.equal(prof.response.status, 201);
    const serv = await request(base, '/api/admin/barbearia/servicos', { method: 'POST', headers: A, body: JSON.stringify({ nome: 'Corte BI', preco: 60, duracaoMinutos: 30 }) });
    assert.equal(serv.response.status, 201);
    const agendar = (hora, extra = {}) => request(base, '/api/admin/barbearia/agenda', { method: 'POST', headers: A, body: JSON.stringify({ clienteNome: 'Carlos Novo', clienteTelefone: '(65) 99811-2233', profissionalId: prof.body.profissional.id, servicoId: serv.body.servico.id, dataAgenda: '2030-06-11', dataHora: `2030-06-11T${hora}:00.000Z`, ...extra }) });
    const ag1 = await agendar('13:00');
    assert.equal(ag1.response.status, 201, JSON.stringify(ag1.body));
    assert.ok(ag1.body.cliente.id);
    assert.equal(ag1.body.cliente.criado, true);
    const ag2 = await agendar('14:00', { clienteTelefone: '65 9 9811-2233' });
    assert.equal(ag2.body.cliente.id, ag1.body.cliente.id, 'mesmo telefone reaproveita o cadastro');
    assert.equal(ag2.body.cliente.criado, false);
    const balcao = await agendar('15:00', { clienteNome: 'Cliente Balcão' });
    assert.equal(balcao.body.cliente.id, null, 'balcão segue sem cadastro');

    // ── BI da barbearia ──
    const concluir = await request(base, `/api/admin/barbearia/agenda/${ag1.body.agendamento.id}/status`, { method: 'PATCH', headers: A, body: JSON.stringify({ status: 'concluido' }) });
    assert.ok([200, 400].includes(concluir.response.status));
    const bi = await request(base, '/api/admin/barbearia/bi?periodo=30', { headers: A });
    assert.equal(bi.response.status, 200);
    assert.ok(bi.body.resultado && typeof bi.body.resultado.resultado === 'number');
    assert.ok(Array.isArray(bi.body.profissionais));
    assert.ok(bi.body.agenda && typeof bi.body.agenda.total === 'number');
    assert.equal((await request(base, '/api/admin/barbearia/bi', { headers: staffA })).response.status, 403);

    // ── WhatsApp pelo backend do NossaGente ──
    const status0 = await request(base, '/api/admin/barbearia/whatsapp-conexao?atualizar=1', { headers: A });
    assert.equal(status0.response.status, 200);
    assert.equal(status0.body.conexao.provider, 'chatbot_backend');
    assert.equal(status0.body.conexao.instance, 'dino-1');
    assert.equal(status0.body.conexao.keyConfigured, true);
    assert.equal(status0.body.conexao.state, 'close');
    assert.equal(JSON.stringify(status0.body).includes('chave-teste'), false, 'a chave nunca sai na resposta');
    const qrStaff = await request(base, '/api/admin/barbearia/whatsapp-conexao/qr', { method: 'POST', headers: staffA });
    assert.equal(qrStaff.response.status, 403);
    const qr = await request(base, '/api/admin/barbearia/whatsapp-conexao/qr', { method: 'POST', headers: A });
    assert.equal(qr.response.status, 200, JSON.stringify(qr.body));
    assert.ok(qr.body.qr.startsWith('data:image/png;base64,'), 'QR cru desenhado no servidor');
    assert.equal(qr.body.pairingCode, 'ABCD-1234');
    backend.setState('open');
    const aberto = await request(base, '/api/admin/barbearia/whatsapp-conexao?atualizar=1', { headers: A });
    assert.equal(aberto.body.conexao.state, 'open');
    assert.equal(aberto.body.conexao.phoneMasked, '5565•••••0000');
    assert.ok(aberto.body.conexao.history.some((item) => item.tipo === 'conectado'));
    const teste = await request(base, '/api/admin/barbearia/whatsapp-conexao/teste', { method: 'POST', headers: A, body: JSON.stringify({ confirmado: true, telefone: '65 99811-2233' }) });
    assert.equal(teste.response.status, 200, JSON.stringify(teste.body));
    const envio = backend.calls.find((call) => call.url.endsWith('/messages/text'));
    assert.ok(envio, 'envio pela rota de mensagens da instância');
    assert.equal(envio.body.number, '5565998112233');
    assert.equal(envio.apikey, 'chave-teste');
    // Queda + vigia: reconecta com espera crescente
    backend.setState('close');
    const verificar = await request(base, '/api/admin/barbearia/whatsapp-conexao/verificar', { method: 'POST', headers: A });
    assert.equal(verificar.body.resultado.action, 'reconnect');
    assert.equal(verificar.body.conexao.reconnectAttempts, 1);
    const espera = await request(base, '/api/admin/barbearia/whatsapp-conexao/verificar', { method: 'POST', headers: A });
    assert.equal(espera.body.resultado.action, 'waiting', 'respeita o intervalo antes da próxima tentativa');
    const instanciaRuim = await request(base, '/api/admin/barbearia/whatsapp-conexao/config', { method: 'PUT', headers: A, body: JSON.stringify({ instance: 'Inválida!' }) });
    assert.equal(instanciaRuim.response.status, 400);
    // A instância é atribuída pela plataforma: a empresa não troca nem pega a de outra.
    const trocaPelaEmpresa = await request(base, '/api/admin/barbearia/whatsapp-conexao/config', { method: 'PUT', headers: A, body: JSON.stringify({ instance: 'fora-da-lista' }) });
    assert.equal(trocaPelaEmpresa.response.status, 400);
    assert.match(trocaPelaEmpresa.body.error, /administração da plataforma/);
    const conexaoB = await request(base, '/api/admin/barbearia/whatsapp-conexao', { headers: B });
    assert.equal(conexaoB.body.conexao.instance, '', 'empresa B não herda a instância da A');
    const testeB = await request(base, '/api/admin/barbearia/whatsapp-conexao/teste', { method: 'POST', headers: B, body: JSON.stringify({ confirmado: true, telefone: '65 99811-2233' }) });
    assert.equal(testeB.response.status, 409, 'sem instância, não envia pelo número de outra empresa');
    const qrB = await request(base, '/api/admin/barbearia/whatsapp-conexao/qr', { method: 'POST', headers: B, body: JSON.stringify({}) });
    assert.notEqual(qrB.response.status, 200, 'B não pareia a instância da A');
    const semConfirmar = await request(base, '/api/admin/barbearia/whatsapp-conexao/desconectar', { method: 'POST', headers: A, body: JSON.stringify({}) });
    assert.equal(semConfirmar.response.status, 400);
  } finally {
    processo.kill('SIGTERM');
    backend.server.close();
  }
});

// Perfis de acesso no servidor real: operador sem comissões nem números da empresa e com o
// caixa às cegas; profissional só no app dele e só na própria agenda.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const EMPRESA = 'empresa-perfis';
const LOJA = 'loja-perfis';
const SENHA = 'perfis-only-test-pass';

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

test('perfis admin, operador e profissional na barbearia', { timeout: 120000 }, async () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'setpoint-perfis-'));
  const dbPath = path.join(diretorio, 'db.json');
  // o dia de operação é o do fuso da empresa (o servidor usa America/Cuiaba), não o UTC:
  // entre 20h e meia-noite em Cuiabá o UTC já está no dia seguinte.
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const usuario = (id, email, role) => ({ id, nome: email, email, senhaHash: bcrypt.hashSync(SENHA, 4), role, ativo: true, empresaId: EMPRESA, lojaId: LOJA });
  fs.writeFileSync(dbPath, JSON.stringify({
    seq: 10,
    usuarios: [usuario(1, 'dono@example.com', 'admin'), usuario(2, 'caixa@example.com', 'operador'), usuario(3, 'ana@example.com', 'profissional'),
      { ...usuario(4, 'solto@example.com', 'operador'), empresaId: undefined, lojaId: undefined }],
    barbearias: { [EMPRESA]: {
      profissionais: {
        'prof-1': { id: 'prof-1', empresaId: EMPRESA, nome: 'Ana', email: 'ana@example.com', ativo: true, percentualComissao: 50 },
        'prof-2': { id: 'prof-2', empresaId: EMPRESA, nome: 'Bruno', email: 'bruno@example.com', ativo: true, percentualComissao: 40 },
      },
      servicos: { 'srv-1': { id: 'srv-1', empresaId: EMPRESA, nome: 'Corte', preco: 50, duracaoMinutos: 30, ativo: true } },
      agendamentos: {
        'age-bruno': { id: 'age-bruno', empresaId: EMPRESA, lojaId: LOJA, clienteNome: 'Cliente', profissionalId: 'prof-2', servicoId: 'srv-1', dataAgenda: hoje, dataHora: `${hoje}T15:00:00.000Z`, duracaoMinutos: 30, status: 'agendado', valor: 50 },
      },
    } },
  }));
  const port = 34000 + Math.floor(Math.random() * 500);
  const base = `http://127.0.0.1:${port}`;
  const processo = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'app'),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port), DB_PATH: dbPath, JWT_SECRET: 'perfis-only-jwt', COMMERCE_CORE_ENABLED: '0', SEED_DEMO: '0', WPP_BASE_URL: '', WPP_APIKEY: '', AI_API_KEY: '', OPENAI_API_KEY: '', GEMINI_API_KEY: '' },
    stdio: 'ignore',
  });
  try {
    const inicio = Date.now();
    while (Date.now() - inicio < 20000) {
      try { if ((await fetch(`${base}/api/info`)).ok) break; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    const entrar = async (email) => {
      const login = await request(base, '/api/admin/login', { method: 'POST', body: JSON.stringify({ user: email, pass: SENHA }) });
      assert.equal(login.status, 200, JSON.stringify(login.body));
      return { Authorization: `Bearer ${login.body.token}` };
    };
    const dono = await entrar('dono@example.com');
    const caixa = await entrar('caixa@example.com');
    const ana = await entrar('ana@example.com');

    // admin vê tudo
    const visaoDono = await request(base, `/api/admin/barbearia/overview?data=${hoje}`, { headers: dono });
    assert.equal(visaoDono.status, 200);
    assert.ok('faturamentoHoje' in visaoDono.body.dashboard.indicadores);
    assert.equal(visaoDono.body.profissionais.find((p) => p.id === 'prof-1').percentualComissao, 50);

    // operador: opera o dia, sem comissões e sem números da empresa
    const visao = await request(base, `/api/admin/barbearia/overview?data=${hoje}`, { headers: caixa });
    assert.equal(visao.status, 200, JSON.stringify(visao.body).slice(0, 200));
    assert.equal(visao.body.numerosOcultos, true);
    assert.ok(!('faturamentoHoje' in visao.body.dashboard.indicadores));
    assert.equal(visao.body.dashboard.indicadores.agendamentosHoje, 1, 'as contagens do dia ficam');
    assert.equal(visao.body.comissoes, null);
    assert.equal(visao.body.relatorio, null);
    assert.equal(visao.body.profissionais.find((p) => p.id === 'prof-1').percentualComissao, undefined);
    assert.equal((await request(base, '/api/admin/barbearia/comissoes', { headers: caixa })).status, 403);
    assert.equal((await request(base, '/api/admin/barbearia/metas', { headers: caixa })).status, 403);
    assert.equal((await request(base, '/api/admin/barbearia/configuracoes', { method: 'PATCH', headers: caixa, body: '{}' })).status, 403);
    assert.equal((await request(base, '/api/admin/barbearia/financeiro/lancamentos', { method: 'POST', headers: caixa, body: JSON.stringify({ tipo: 'receita', valor: 10 }) })).status, 403);
    const despesa = await request(base, '/api/admin/barbearia/financeiro/lancamentos', { method: 'POST', headers: caixa, body: JSON.stringify({ tipo: 'despesa', descricao: 'Café', categoria: 'Outros', valor: 12, vencimento: hoje }) });
    assert.notEqual(despesa.status, 403, 'operador lança despesa');
    // caixa às cegas: abre, não fecha sem o valor contado e não vê o esperado
    const aberto = await request(base, '/api/admin/barbearia/operacao/caixas', { method: 'POST', headers: caixa, body: JSON.stringify({ confirmado: true, numeroCaixa: 1, valorAbertura: 100 }) });
    assert.equal(aberto.status, 201, JSON.stringify(aberto.body));
    const semValor = await request(base, `/api/admin/barbearia/operacao/caixas/${aberto.body.caixa.id}/fechamento`, { method: 'POST', headers: caixa, body: JSON.stringify({ confirmado: true }) });
    assert.equal(semValor.status, 400);
    assert.equal(semValor.body.code, 'VALOR_CONTADO_OBRIGATORIO');
    const nulo = await request(base, `/api/admin/barbearia/operacao/caixas/${aberto.body.caixa.id}/fechamento`, { method: 'POST', headers: caixa, body: JSON.stringify({ confirmado: true, valorInformado: null }) });
    assert.equal(nulo.status, 400, 'valor nulo não vira o esperado');
    const movs = await request(base, `/api/admin/barbearia/operacao/caixas/${aberto.body.caixa.id}/movimentos`, { headers: caixa });
    assert.equal(movs.status, 200);
    assert.ok(!(movs.body.movimentos || []).some((m) => m.tipo === 'recebimento'), 'sem os recebimentos');
    const fechado = await request(base, `/api/admin/barbearia/operacao/caixas/${aberto.body.caixa.id}/fechamento`, { method: 'POST', headers: caixa, body: JSON.stringify({ confirmado: true, valorInformado: 90 }) });
    assert.equal(fechado.status, 200, JSON.stringify(fechado.body));
    assert.ok(!JSON.stringify(fechado.body).includes('valorEsperado'));
    assert.ok(!JSON.stringify(fechado.body).includes('divergencia'));
    const lista = await request(base, `/api/admin/barbearia/operacao/caixas?data=${hoje}`, { headers: caixa });
    assert.equal(lista.status, 200);
    assert.ok(!JSON.stringify(lista.body).includes('valorEsperado'));
    // a gestão vê a diferença
    const listaDono = await request(base, `/api/admin/barbearia/operacao/caixas?data=${hoje}`, { headers: dono });
    assert.equal(listaDono.body.caixas[0].divergencia, -10);

    // operador fora da auditoria e dos usuários; operador sem empresa não entra
    assert.equal((await request(base, '/api/admin/auditoria', { headers: caixa })).status, 403);
    assert.equal((await request(base, '/api/admin/usuarios', { headers: caixa })).status, 403);
    const solto = await entrar('solto@example.com');
    assert.equal((await request(base, '/api/admin/bi', { headers: solto })).status, 403);
    assert.equal((await request(base, '/api/admin/dashboard', { headers: solto })).status, 403);
    // a gestão da empresa cria o operador já na empresa dela
    const criar = await request(base, '/api/admin/usuarios', { method: 'POST', headers: dono, body: JSON.stringify({ nome: 'X', email: 'x@example.com', senha: SENHA, role: 'operador' }) });
    assert.equal(criar.status, 200, JSON.stringify(criar.body));

    // profissional: só o app e só a própria agenda
    assert.equal((await request(base, `/api/admin/barbearia/overview?data=${hoje}`, { headers: ana })).status, 403);
    assert.equal((await request(base, '/api/admin/barbearia/comissoes', { headers: ana })).status, 403);
    assert.equal((await request(base, '/api/admin/bi', { headers: ana })).status, 403);
    const app = await request(base, `/api/admin/barbearia/modo-barbeiro?data=${hoje}`, { headers: ana });
    assert.equal(app.status, 200, JSON.stringify(app.body).slice(0, 200));
    assert.equal((await request(base, '/api/admin/barbearia/agenda/age-bruno/status', { method: 'PATCH', headers: ana, body: JSON.stringify({ status: 'confirmado' }) })).status, 403);
    assert.equal((await request(base, '/api/admin/barbearia/bloqueios', { method: 'POST', headers: ana, body: JSON.stringify({ profissionalId: 'prof-2', titulo: 'x', inicio: `${hoje}T20:00:00.000Z`, fim: `${hoje}T21:00:00.000Z` }) })).status, 403);
    const meu = await request(base, '/api/admin/barbearia/bloqueios', { method: 'POST', headers: ana, body: JSON.stringify({ titulo: 'Almoço', inicio: `${hoje}T16:00:00.000Z`, fim: `${hoje}T17:00:00.000Z` }) });
    assert.equal(meu.status, 201, JSON.stringify(meu.body));
    assert.equal(meu.body.bloqueio.profissionalId, 'prof-1', 'o bloqueio vai para a agenda dela');
  } finally {
    processo.kill('SIGTERM');
  }
});

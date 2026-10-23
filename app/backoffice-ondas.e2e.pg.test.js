// Ponta a ponta do backoffice (ondas 0 a 5) com o server.js de verdade, o schema completo do
// runner de migrações e contas multiempresa reais (login, X-Empresa-Id, papéis e unidade presa).
// Roda com BACKOFFICE_E2E_DATABASE_URL apontando para um banco com `npm run commerce:schema:apply`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const DSN = process.env.BACKOFFICE_E2E_DATABASE_URL;
const APP = path.dirname(fileURLToPath(import.meta.url));
const SENHA = 'Senha-Local-Forte-123!';
const hojeCuiaba = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Cuiaba' });

test('backoffice integrado: Financeiro, estoque e compras, fiscal, conciliação, salão, PDV offline e supermercado', { skip: !DSN && 'defina BACKOFFICE_E2E_DATABASE_URL', timeout: 120_000 }, async (t) => {
  const sql = new pg.Client({ connectionString: DSN }); await sql.connect();
  const sufixo = crypto.randomBytes(4).toString('hex');
  const empresa = async (nome) => (await sql.query(`INSERT INTO empresas (nome, cnpj, razao_social, tipo_negocio, ativa) VALUES ($1, $2, $1, 'bar', true) RETURNING id`, [`${nome} ${sufixo}`, String(10 ** 13 + crypto.randomInt(10 ** 12)).slice(0, 14)])).rows[0].id;
  const A = await empresa('Empresa A'); const B = await empresa('Empresa B');
  const loja = async (emp, cod) => (await sql.query(`INSERT INTO lojas (empresa_id, codigo, nome, ativa) VALUES ($1, $2, $3, true) RETURNING id`, [emp, `${cod}-${sufixo}`, `Unidade ${cod}`])).rows[0].id;
  const A1 = await loja(A, 'a1'); const A2 = await loja(A, 'a2'); const B1 = await loja(B, 'b1');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backoffice-e2e-'));
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify({ seq: 10, usuarios: [{ id: 1, nome: 'Administrador local', email: 'admin', senhaHash: bcrypt.hashSync(SENHA, 4), role: 'admin', ativo: true }] }));
  const porta = 36200 + crypto.randomInt(300); const base = `http://127.0.0.1:${porta}`;
  let log = '';
  const filho = spawn(process.execPath, ['server.js'], { cwd: APP, env: { ...process.env, NODE_ENV: 'development', PORT: String(porta), DB_PATH: path.join(dir, 'db.json'), JWT_SECRET: 'backoffice-e2e-local', COMMERCE_CORE_ENABLED: '1', DATABASE_URL: DSN, DB_SSL: 'false', ADMIN_USER: 'admin', SEED_DEMO: '0', FINANCEIRO_RAZAO: '1', FISCAL_CERT_MASTER_KEY: crypto.randomBytes(32).toString('base64'), WHATSAPP_CONNECTION_WATCHDOG: 'false', WPP_BASE_URL: '', WPP_APIKEY: '', RESEND_API_KEY: '', OPERATIONAL_INVITE_RESEND_API_KEY: '', GEMINI_API_KEY: '', OPENAI_API_KEY: '', AI_AUTOMATION_SCHEDULER: 'false', AI_LEARNING_SCHEDULER: 'false', FISCAL_TRANSMITIR_HOMOLOGACAO: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  filho.stdout.on('data', (d) => { log += d; }); filho.stderr.on('data', (d) => { log += d; });
  const req = async (url, method = 'GET', corpo = null, headers = {}) => {
    const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...headers }, ...(corpo ? { body: JSON.stringify(corpo) } : {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  // falha com o corpo da resposta e o fim do log do servidor, para achar a causa sem rodar de novo
  const ok = (r, status, msg) => assert.equal(r.status, status, `${msg}: ${JSON.stringify(r.body).slice(0, 400)}\n--- log ---\n${log.slice(-1500)}`);

  try {
    let pronto = false;
    for (let i = 0; i < 120; i++) { if (filho.exitCode !== null) break; try { if ((await req('/api/info')).status === 200) { pronto = true; break; } } catch {} await new Promise((r) => setTimeout(r, 150)); }
    assert.ok(pronto, `servidor não subiu\n${log.slice(-3000)}`);
    const adm = await req('/api/admin/login', 'POST', { user: 'admin', pass: SENHA }); ok(adm, 200, 'login admin');
    const admin = { Authorization: `Bearer ${adm.body.token}` };
    const conta = async (nome, access) => {
      const email = `${nome}-${sufixo}@example.invalid`;
      ok(await req('/api/admin/platform/accounts', 'POST', { nome, email, senha: SENHA, access }, admin), 201, `conta ${nome}`);
      const l = await req('/api/admin/login', 'POST', { user: email, pass: SENHA }); ok(l, 200, `login ${nome}`);
      return l.body.token;
    };
    const dono = { Authorization: `Bearer ${await conta('dono-a', [{ empresaId: A, roleCode: 'store_admin' }])}`, 'X-Empresa-Id': A };
    const gerenteA2 = { Authorization: `Bearer ${await conta('gerente-a2', [{ empresaId: A, roleCode: 'store_admin', lojaId: A2 }])}`, 'X-Empresa-Id': A, 'X-Loja-Id': A2 };
    const donoB = { Authorization: `Bearer ${await conta('dono-b', [{ empresaId: B, roleCode: 'store_admin' }])}`, 'X-Empresa-Id': B };
    const suporte = { Authorization: `Bearer ${await conta('suporte-a', [{ empresaId: A, roleCode: 'support' }])}`, 'X-Empresa-Id': A };
    const dia = hojeCuiaba();

    await t.test('onda 0: unidades por escopo', async () => {
      const u = await req('/api/admin/unidades', 'GET', null, dono); ok(u, 200, 'unidades');
      assert.deepEqual(u.body.unidades.map((x) => x.id).sort(), [A1, A2].sort());
      const g = await req('/api/admin/unidades', 'GET', null, gerenteA2); ok(g, 200, 'unidades gerente');
      assert.deepEqual(g.body.unidades.map((x) => x.id), [A2]);
      ok(await req('/api/admin/unidades', 'GET', null, { ...dono, 'X-Empresa-Id': B }), 403, 'outra empresa');
    });

    await t.test('menu: permissões da pessoa na empresa ativa', async () => {
      const s = await req('/api/admin/minhas-permissoes', 'GET', null, suporte); ok(s, 200, 'suporte');
      assert.equal(s.body.aplicavel, true);
      assert.ok(s.body.permissoes.includes('customers.read') && !s.body.permissoes.includes('payments.read'));
      const g = await req('/api/admin/minhas-permissoes', 'GET', null, gerenteA2); ok(g, 200, 'gerente');
      assert.equal(g.body.alcance['inventory.read'], 'unidade');
      assert.equal((await req('/api/admin/minhas-permissoes', 'GET', null, admin)).body.aplicavel, false, 'plataforma não filtra');
    });

    await t.test('onda 1: razão, unidade presa e isolamento', async () => {
      ok(await req('/api/admin/razao/estado', 'GET', null, dono), 200, 'estado');
      const c = await req('/api/admin/razao/lancamentos', 'POST', { tipo: 'despesa', categoria: 'Aluguel', descricao: 'Aluguel A1', valor: '1500,00', vencimento: dia, lojaId: A1 }, dono); ok(c, 201, 'criar');
      const g = await req('/api/admin/razao/lancamentos', 'POST', { tipo: 'receita', descricao: 'Venda A2', valor: 80, status: 'pago', meioPagamento: 'dinheiro', vencimento: dia, pagoEm: new Date().toISOString(), lojaId: A1 }, gerenteA2); ok(g, 201, 'gerente lança');
      const doGerente = (Array.isArray(g.body) ? g.body : g.body.lancamentos || [g.body])[0];
      assert.equal(doGerente.lojaId, A2, 'unidade do gerente prevalece sobre a pedida');
      const listaG = await req('/api/admin/razao/lancamentos', 'GET', null, gerenteA2); ok(listaG, 200, 'listar gerente');
      const itensG = listaG.body.lancamentos || listaG.body.itens || listaG.body;
      assert.ok(itensG.every((l) => l.lojaId === A2), 'gerente só vê a unidade dele');
      const idA1 = (Array.isArray(c.body) ? c.body : c.body.lancamentos || [c.body])[0].id;
      ok(await req(`/api/admin/razao/lancamentos/${idA1}/baixar`, 'POST', { meioPagamento: 'pix' }, gerenteA2), 404, 'gerente não baixa da outra unidade');
      ok(await req(`/api/admin/razao/lancamentos/${idA1}/baixar`, 'POST', { meioPagamento: 'pix' }, donoB), 404, 'outra empresa não baixa');
      ok(await req(`/api/admin/razao/lancamentos/${idA1}/baixar`, 'POST', { meioPagamento: 'pix' }, dono), 200, 'dono baixa');
      ok(await req('/api/admin/razao/lancamentos', 'GET', null, suporte), 403, 'suporte sem payments.read');
      const listaB = await req('/api/admin/razao/lancamentos', 'GET', null, donoB); ok(listaB, 200, 'B lista');
      assert.equal((listaB.body.lancamentos || listaB.body.itens || listaB.body).length, 0, 'B não vê A');
      ok(await req(`/api/admin/razao/dre?de=${dia.slice(0, 8)}01&ate=${dia}`, 'GET', null, dono), 200, 'DRE');
      ok(await req('/api/admin/razao/categorias', 'POST', { nome: 'Teste', tipo: 'despesa' }, gerenteA2), 403, 'categoria exige empresa toda');
    });

    let itemId;
    await t.test('onda 2: item, pedido, recebimento vira estoque e conta a pagar', async () => {
      const it = await req('/api/admin/suprimentos/itens', 'POST', { nome: 'Cerveja lata', sku: `cerv-${sufixo}`, unidade: 'un' }, dono); ok(it, 201, 'item');
      itemId = (it.body.item || it.body).id;
      const ped = await req('/api/admin/suprimentos/pedidos', 'POST', { fornecedorNome: 'Distribuidora', lojaId: A1, condicaoPagamento: '30', itens: [{ itemId, quantidade: 24, custoUnitario: 4 }] }, dono); ok(ped, 201, 'pedido');
      const pedidoId = (ped.body.pedido || ped.body).id;
      const rec = await req('/api/admin/suprimentos/recebimentos', 'POST', { pedidoId, lojaId: A1, idempotencia: `rec-${sufixo}`, itens: [{ itemId, quantidade: 24, custoUnitario: 4 }] }, dono); ok(rec, 201, 'recebimento');
      const itens = await req(`/api/admin/suprimentos/itens?lojaId=${A1}`, 'GET', null, dono); ok(itens, 200, 'itens');
      assert.equal((itens.body.itens || itens.body).find((i) => i.id === itemId).saldo, 24);
      const contas = await req('/api/admin/razao/lancamentos?tipo=despesa&status=pendente', 'GET', null, dono);
      assert.ok((contas.body.lancamentos || contas.body.itens || contas.body).some((l) => l.valor === 96), 'conta a pagar de R$ 96');
      ok(await req('/api/admin/suprimentos/itens', 'GET', null, donoB), 200, 'B lista itens');
    });

    await t.test('onda 3: fiscal só em homologação', async () => {
      const e = await req('/api/admin/fiscal/estado', 'GET', null, dono); ok(e, 200, 'estado fiscal');
      const em = await req('/api/admin/fiscal/emitentes', 'PUT', { ambiente: 'producao', cnpj: '11222333000181', razaoSocial: 'A', uf: 'MT' }, dono);
      assert.ok([400, 422].includes(em.status), `produção recusada: ${em.status} ${JSON.stringify(em.body)}`);
    });

    await t.test('onda 4: OFX importa uma vez e só na conta certa', async () => {
      const ct = await req('/api/admin/razao/conciliacao/contas', 'POST', { nome: 'Conta movimento', banco: '001', agencia: '1234', conta: '56789-0', lojaId: A1 }, dono); ok(ct, 201, 'conta bancária');
      const contaId = ct.body.id;
      const ofx = `OFXHEADER:100\nCHARSET:1252\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>001<BRANCHID>1234<ACCTID>56789-0</BANKACCTFROM><BANKTRANLIST><DTSTART>${dia.replace(/-/g, '')}<DTEND>${dia.replace(/-/g, '')}<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>${dia.replace(/-/g, '')}120000<TRNAMT>80.00<FITID>F1-${sufixo}<NAME>PIX RECEBIDO</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
      const corpo = { contaId, nomeArquivo: 'extrato.ofx', arquivoBase64: Buffer.from(ofx, 'latin1').toString('base64'), conciliar: false };
      ok(await req('/api/admin/razao/conciliacao/importar', 'POST', corpo, dono), 201, 'importar');
      const de2 = await req('/api/admin/razao/conciliacao/importar', 'POST', corpo, dono); ok(de2, 201, 'reimportar');
      const linhas = await req(`/api/admin/razao/conciliacao/linhas?contaId=${contaId}`, 'GET', null, dono); ok(linhas, 200, 'linhas');
      assert.equal((linhas.body.linhas || linhas.body).length, 1, 'FITID não duplica');
      const alheia = await req('/api/admin/razao/conciliacao/importar', 'POST', corpo, gerenteA2);
      assert.ok([403, 404].includes(alheia.status), 'gerente de outra unidade não importa na conta da A1');
    });

    await t.test('onda 5: reserva, PDV offline com terminal e supermercado', async () => {
      ok(await req('/api/admin/bar/mesas', 'POST', { numero: 9, nome: 'Varanda' }, dono), 201, 'mesa');
      const inicio = new Date(Date.now() + 3 * 3600e3).toLocaleString('sv-SE', { timeZone: 'America/Cuiaba' }).slice(0, 16).replace(' ', 'T');
      const r = await req('/api/admin/salao/reservas', 'POST', { clienteNome: 'Ana', pessoas: 2, mesaNum: 9, inicioEm: inicio }, dono); ok(r, 201, 'reserva');
      ok(await req('/api/admin/salao/reservas', 'POST', { clienteNome: 'Bia', pessoas: 2, mesaNum: 9, inicioEm: inicio }, dono), 409, 'mesma mesa e horário');
      const term = await req('/api/pdv-offline/terminais', 'POST', { loja_id: A1, codigo: `CX-${sufixo}`, nome: 'Caixa 1' }, dono); ok(term, 201, 'terminal');
      const agente = { 'X-Terminal-Id': term.body.terminal.id, 'X-Terminal-Token': term.body.token_provisionamento };
      const prod = await req('/api/admin/bar/produtos', 'POST', { nome: 'Água', categoria: 'Bebidas', setor: 'bar', preco: 5, estoqueAtual: 10 }, dono); ok(prod, 201, 'produto do bar');
      const produtoId = (prod.body.produto || prod.body).id;
      const evento = { id: crypto.randomUUID(), sequencia: 1, tipo: 'venda_offline', payload: { id_externo: crypto.randomUUID(), ocorreu_em: new Date().toISOString(), itens: [{ produto_id: produtoId, quantidade: 2, valor_unitario: 5 }], pagamentos: [{ tipo: 'dinheiro', valor: 10 }] } };
      const s = await req('/api/pdv-offline/sincronizar', 'POST', { lote_cliente_id: crypto.randomUUID(), eventos: [evento] }, agente); ok(s, 200, 'sincronizar');
      assert.equal(s.body.eventos[0].status, 'processado');
      ok(await req('/api/pdv-offline/sincronizar', 'POST', { lote_cliente_id: crypto.randomUUID(), eventos: [evento] }, { ...agente, 'X-Terminal-Token': 'kytto_term_errado' }), 401, 'token errado');
      ok(await req('/api/pdv-offline/terminais', 'GET', null, donoB), 200, 'B lista terminais');
      const v = await req(`/api/admin/varejo/produtos?lojaId=${A1}`, 'GET', null, dono); ok(v, 200, 'produtos do varejo');
      assert.ok(v.body.produtos.some((p) => p.id === itemId && p.saldo === 24));
      ok(await req(`/api/admin/varejo/produtos/${itemId}`, 'PATCH', { precoBase: 7.5 }, gerenteA2), 403, 'gerente não muda cadastro');
      ok(await req(`/api/admin/varejo/produtos/${itemId}`, 'PATCH', { precoUnidade: 7, lojaId: A2 }, gerenteA2), 200, 'gerente muda preço da unidade dele');
      const tr = await req('/api/admin/varejo/transferencias', 'POST', { origemId: A1, destinoId: A2, itens: [{ itemId, quantidade: 4 }] }, dono); ok(tr, 201, 'transferência');
      ok(await req(`/api/admin/varejo/transferencias/${tr.body.id}/enviar`, 'POST', {}, dono), 200, 'enviar');
      ok(await req(`/api/admin/varejo/transferencias/${tr.body.id}/receber`, 'POST', { recebidos: [{ itemId, quantidade: 4 }] }, gerenteA2), 200, 'destino recebe');
      const depois = await req(`/api/admin/varejo/produtos?lojaId=${A2}`, 'GET', null, gerenteA2);
      assert.equal(depois.body.produtos.find((p) => p.id === itemId).saldo, 4);
    });

    await t.test('razão lê o bar: a venda offline vira receita da empresa', async () => {
      ok(await req('/api/admin/razao/sincronizar', 'POST', {}, dono), 200, 'sincronizar fontes');
      const l = await req('/api/admin/razao/lancamentos?origem=bar_comanda', 'GET', null, dono); ok(l, 200, 'lançamentos do bar');
      const venda = (l.body.lancamentos || l.body.itens || l.body).find((x) => x.valor === 10);
      assert.ok(venda, 'venda offline no razão');
      assert.equal(venda.lojaId, A1, 'com a unidade do terminal');
    });
  } finally {
    filho.kill('SIGTERM');
    await sql.end();
  }
});

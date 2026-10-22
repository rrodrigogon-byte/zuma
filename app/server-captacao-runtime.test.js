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

test('captação: agendamento online com consentimento e indicação, lista de espera, autoatendimento e painéis', async () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'captacao-runtime-'));
  const dbPath = path.join(diretorio, 'db.json');
  const senha = 'captacao-runtime-pass';
  fs.writeFileSync(dbPath, JSON.stringify({ seq: 1, usuarios: [{ id: 1, nome: 'Admin Captação', email: 'captacao@example.com', senhaHash: bcrypt.hashSync(senha, 4), role: 'admin', ativo: true, empresaId: 'empresa-captacao', lojaId: 'loja-captacao' }] }));
  const port = 33000 + Math.floor(Math.random() * 500);
  const base = `http://127.0.0.1:${port}`;
  const processo = spawn(process.execPath, ['server.js'], {
    cwd: path.join(ROOT, 'app'),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port), DB_PATH: dbPath, JWT_SECRET: 'captacao-jwt', PUBLIC_BASE_URL: `http://127.0.0.1:${port}`, SERVER_URL: '', COMMERCE_CORE_ENABLED: '0', SEED_DEMO: '0', WPP_BASE_URL: '', WPP_APIKEY: '', AI_API_KEY: '', OPENAI_API_KEY: '', GEMINI_API_KEY: '', ANTHROPIC_API_KEY: '' },
    stdio: 'ignore',
  });
  try {
    await aguardarServidor(base, processo);
    const login = await request(base, '/api/admin/login', { method: 'POST', body: JSON.stringify({ user: 'captacao@example.com', pass: senha }) });
    const headers = { Authorization: `Bearer ${login.body.token}` };
    await request(base, '/api/admin/barbearia/configuracoes', { method: 'PATCH', headers, body: JSON.stringify({ slugPublico: 'dino-captacao', nomePublico: 'Dino Captação', lojaPublicaId: 'loja-captacao', agendamentoPublicoAtivo: true, antecedenciaMinutos: 0, janelaReservaDias: 365, diasFuncionamento: [0, 1, 2, 3, 4, 5, 6], horarioAbertura: '08:00', horarioFechamento: '20:00', politicaCancelamentoHoras: 4 }) });
    const servico = (await request(base, '/api/admin/barbearia/servicos', { method: 'POST', headers, body: JSON.stringify({ nome: 'Corte', duracaoMinutos: 30, preco: 50 }) })).body.servico;
    const profissional = (await request(base, '/api/admin/barbearia/profissionais', { method: 'POST', headers, body: JSON.stringify({ nome: 'Bruno', horarioInicio: '08:00', horarioFim: '20:00', diasTrabalho: [0, 1, 2, 3, 4, 5, 6] }) })).body.profissional;

    const catalogo = await request(base, '/api/publico/agendamento/dino-captacao');
    assert.equal(catalogo.response.status, 200);
    assert.equal(catalogo.body.politicas.cancelamentoHoras, 4);

    // Quem indica: cliente cadastrado no admin, com link de indicação.
    const indicador = (await request(base, '/api/admin/barbearia/clientes', { method: 'POST', headers, body: JSON.stringify({ nome: 'Rafael Indicador', telefone: '65977770001' }) })).body.cliente;
    const link = await request(base, `/api/admin/barbearia/captacao/clientes/${indicador.id}/indicacao`, { headers });
    assert.equal(link.response.status, 200);
    assert.match(link.body.link, /^\/agendar\/dino-captacao\?indicacao=[A-Z0-9]{6,7}$/);

    const data = dataFutura(3);
    const confirmar = await request(base, '/api/publico/agendamento/dino-captacao/confirmar', { method: 'POST', body: JSON.stringify({ servico_id: servico.id, profissional_id: profissional.id, data, horario: '10:00', cliente_nome: 'Lucas Novo', cliente_telefone: '65977770002', consentimento_whatsapp: true, indicacao: link.body.codigo }) });
    assert.equal(confirmar.response.status, 201);
    const codigo = confirmar.body.agendamento.codigo;
    const clientes = (await request(base, '/api/admin/barbearia/clientes', { headers })).body.clientes || [];
    const lucas = clientes.find((item) => item.nome === 'Lucas Novo');
    assert.equal(lucas?.consentimentos?.whatsapp?.atendimento?.concedido, true, 'consentimento registrado a partir do checkbox');
    const indicacoes = await request(base, '/api/admin/barbearia/captacao/indicacoes', { headers });
    assert.equal(indicacoes.body.total, 1);

    // Lista de espera para o mesmo dia.
    const espera = await request(base, '/api/publico/agendamento/dino-captacao/lista-espera', { method: 'POST', body: JSON.stringify({ servico_id: servico.id, data, periodo: 'manha', cliente_nome: 'Ana Espera', cliente_telefone: '65911110001', consentimento_whatsapp: true }) });
    assert.equal(espera.response.status, 201);

    // Autoatendimento: telefone errado não revela nada; certo mostra e cancela.
    const errado = await request(base, '/api/publico/agendamento/dino-captacao/meu-agendamento', { method: 'POST', body: JSON.stringify({ codigo, cliente_telefone: '65900000000' }) });
    assert.equal(errado.response.status, 404);
    const meu = await request(base, '/api/publico/agendamento/dino-captacao/meu-agendamento', { method: 'POST', body: JSON.stringify({ codigo, cliente_telefone: '(65) 97777-0002' }) });
    assert.equal(meu.response.status, 200);
    assert.equal(meu.body.agendamento.podeCancelar, true);
    assert.equal(meu.body.agendamento.profissional.nome, 'Bruno');
    const remarcar = await request(base, '/api/publico/agendamento/dino-captacao/meu-agendamento/remarcar', { method: 'POST', body: JSON.stringify({ codigo, cliente_telefone: '65977770002', data, horario: '11:00' }) });
    assert.equal(remarcar.response.status, 200);
    assert.equal(remarcar.body.agendamento.horaLocal, '11:00');
    const cancelar = await request(base, '/api/publico/agendamento/dino-captacao/meu-agendamento/cancelar', { method: 'POST', body: JSON.stringify({ codigo, cliente_telefone: '65977770002' }) });
    assert.equal(cancelar.response.status, 200);
    assert.equal(cancelar.body.agendamento.status, 'cancelado');

    const lista = await request(base, `/api/admin/barbearia/captacao/lista-espera?data=${data}`, { headers });
    assert.equal(lista.body.total, 1);
    assert.equal(lista.body.itens[0].avisos.length, 0, 'sem canal de WhatsApp ativo ninguém fica marcado como avisado');

    // Painéis do admin respondem para a empresa da sessão.
    for (const rota of ['/api/admin/barbearia/captacao/clube', '/api/admin/barbearia/captacao/retornos', `/api/admin/barbearia/captacao/ocupacao?inicio=${data}&fim=${data}`, '/api/admin/barbearia/captacao/metas-profissionais', '/api/admin/barbearia/captacao/projecao-faturamento?horizonte=6', '/api/admin/barbearia/captacao/configuracao']) {
      const resposta = await request(base, rota, { headers });
      assert.equal(resposta.response.status, 200, rota);
    }
    const meta = await request(base, '/api/admin/barbearia/captacao/metas-profissionais', { method: 'PUT', headers, body: JSON.stringify({ profissionalId: profissional.id, mes: data.slice(0, 7), receita: 4000, atendimentos: 80 }) });
    assert.equal(meta.response.status, 200);
    const projecao = await request(base, `/api/admin/barbearia/captacao/projecao-faturamento?mes=${data.slice(0, 7)}&horizonte=6`, { headers });
    assert.equal(projecao.response.status, 200);
    assert.equal(projecao.body.previsoes.length, 6);
    assert.equal(projecao.body.escopo.empresaId, 'empresa-captacao');
    const horizonteInvalido = await request(base, '/api/admin/barbearia/captacao/projecao-faturamento?horizonte=7', { headers });
    assert.equal(horizonteInvalido.response.status, 400);
    assert.equal(horizonteInvalido.body.code, 'HORIZONTE_INVALIDO');
    const inteligencia = await request(base, `/api/admin/barbearia/captacao/projecao-faturamento/inteligencia?mes=${data.slice(0, 7)}&horizonte=6`, { headers });
    assert.equal(inteligencia.response.status, 200, JSON.stringify(inteligencia.body));
    assert.equal(inteligencia.body.inteligencia.status, 'fallback', 'escopo JSON legado deve usar leitura local segura');
    const simulacao = await request(base, '/api/admin/barbearia/captacao/projecao-faturamento/simular', { method: 'POST', headers, body: JSON.stringify({ mes: data.slice(0, 7), fatores: { atendimentos: 1.1, ticket: 1, revenda: 1.2, ocupacao: 1 } }) });
    assert.equal(simulacao.response.status, 200);
    assert.ok(Number.isFinite(simulacao.body.simulacao.resultado.total));
    const filaSemEscopoCanonico = await request(base, '/api/admin/barbearia/captacao/projecao-faturamento/inteligencia/atualizar', { method: 'POST', headers, body: JSON.stringify({ mes: data.slice(0, 7) }) });
    assert.equal(filaSemEscopoCanonico.response.status, 409);
    // Assinante concluindo atendimento: cobrado avulso não consome o plano; sem cobrança, consome.
    const assinante = (await request(base, '/api/admin/barbearia/clientes', { method: 'POST', headers, body: JSON.stringify({ nome: 'Assinante', telefone: '65966660001' }) })).body.cliente;
    const plano = (await request(base, '/api/admin/barbearia/planos', { method: 'POST', headers, body: JSON.stringify({ nome: 'Clube', preco: 90, sessoesIncluidas: 4, validadeDias: 30, servicosIds: [servico.id] }) })).body.plano;
    const assinatura = (await request(base, '/api/admin/barbearia/assinaturas', { method: 'POST', headers, body: JSON.stringify({ planoId: plano.id, clienteId: assinante.id, clienteNome: assinante.nome, inicio: new Date(Date.now() - 86400000).toISOString() }) })).body.assinatura;
    const ativa = await request(base, `/api/admin/barbearia/assinaturas/${assinatura.id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'ativa', confirmadoSemCobranca: true, pagamentoConfirmado: true }) });
    assert.equal(ativa.response.status, 200, JSON.stringify(ativa.body));
    const concluirAtendimento = async (hora, extra) => {
      const criado = (await request(base, '/api/admin/barbearia/agenda', { method: 'POST', headers, body: JSON.stringify({ clienteId: assinante.id, clienteNome: assinante.nome, clienteTelefone: assinante.telefone, profissionalId: profissional.id, servicoId: servico.id, dataAgenda: data, horaLocal: hora, dataHora: new Date(`${data}T${hora}:00-04:00`).toISOString() }) })).body.agendamento;
      await request(base, `/api/admin/barbearia/agenda/${criado.id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'em_atendimento' }) });
      return request(base, `/api/admin/barbearia/agenda/${criado.id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'concluido', ...extra }) });
    };
    const avulso = await concluirAtendimento('15:00', { registrarFinanceiro: true, confirmado: true, meioPagamento: 'pix', valorRecebido: 50 });
    assert.equal(avulso.response.status, 200, JSON.stringify(avulso.body));
    assert.equal(avulso.body.assinatura, null, 'cobrado avulso não gasta sessão do plano');
    assert.equal(typeof avulso.body.avaliacao?.queued, 'number', 'conclusão com financeiro sempre reporta o estado da pesquisa');
    const peloPlano = await concluirAtendimento('16:00', {});
    assert.equal(peloPlano.body.assinatura.usosNoCiclo, 1, 'sem cobrança avulsa, usa o plano');
    assert.equal(typeof peloPlano.body.avaliacao?.queued, 'number', 'conclusão por plano também reporta o estado da pesquisa');

    // NPS: o atendimento concluído pelo plano pode ser avaliado com código + telefone.
    const agendaAdmin = (await request(base, `/api/admin/barbearia/agenda?data=${data}`, { headers })).body;
    const listaAdmin = agendaAdmin.agendamentos || agendaAdmin.itens || [];
    const codigoNps = listaAdmin.find((item) => item.id === peloPlano.body.agendamento.id)?.codigoConfirmacao;
    assert.match(String(codigoNps || ''), /^[A-F0-9]{8}$/, 'agendamento do balcão ganha código ao concluir');
    {
      const avaliar = await request(base, '/api/publico/agendamento/dino-captacao/avaliar', { method: 'POST', body: JSON.stringify({ codigo: codigoNps, cliente_telefone: '65966660001', nota: 9, comentario: 'Ótimo' }) });
      assert.equal(avaliar.response.status, 201, JSON.stringify(avaliar.body));
      assert.deepEqual(avaliar.body.avaliacao, { repetida: false, nota: 9 }, 'nenhum convite externo sai na resposta');
      const repetida = await request(base, '/api/publico/agendamento/dino-captacao/avaliar', { method: 'POST', body: JSON.stringify({ codigo: codigoNps, cliente_telefone: '65966660001', nota: 1 }) });
      assert.deepEqual(repetida.body.avaliacao, { repetida: true, nota: 9 }, 'replay não muda avaliação');
      const nps = await request(base, `/api/admin/barbearia/captacao/nps?inicio=${data}&fim=${data}`, { headers });
      assert.equal(nps.body.respostas, 1);
      assert.equal(nps.body.nps, 100);
      assert.equal(nps.body.atendimentosConcluidos, 2);
      assert.equal(nps.body.taxaResposta, 50);
      assert.equal(nps.body.distribuicao[9].respostas, 1);
      assert.equal(nps.body.notificacoesPesquisa, null, 'fila PG indisponível não vira contador falso');
      assert.equal(nps.body.armazenamentoDuravel, true, 'ambiente local com DB_PATH temporário pode testar NPS');
      assert.equal(JSON.stringify(nps.body).includes('65966660001'), false, 'sem telefone no painel');
      const externo = await request(base, '/api/admin/barbearia/captacao/configuracao', { method: 'PUT', headers, body: JSON.stringify({ googleReviewUrl: 'https://g.page/r/teste/review' }) });
      assert.equal(externo.response.status, 400);
      assert.equal(externo.body.code, 'EXTERNAL_REVIEW_DISABLED');
      const configuracaoNps = await request(base, '/api/admin/barbearia/captacao/configuracao', { headers });
      assert.equal(Object.hasOwn(configuracaoNps.body.configuracao, 'googleReviewUrl'), false);
    }
    const errada = await request(base, '/api/publico/agendamento/dino-captacao/avaliar', { method: 'POST', body: JSON.stringify({ codigo: 'ZZZZZZZZ', cliente_telefone: '65966660001', nota: 9 }) });
    assert.equal(errada.response.status, 404);

    // Meta tags do link compartilhado (sem dado pessoal; avaliação fora do índice).
    const pagina = await fetch(`${base}/agendar/dino-captacao`);
    const html = await pagina.text();
    assert.match(html, /<title>Agende seu horário \| Dino Captação<\/title>/);
    assert.doesNotMatch(html, /og:url" content="[^"]*\/agendar\/dino-captacao"/, 'PUBLIC_BASE_URL da Dino não canoniza outro slug');
    const paginaAvaliar = await (await fetch(`${base}/avaliar/dino-captacao?codigo=ABC`)).text();
    assert.match(paginaAvaliar, /noindex, nofollow/);
    const desconhecida = await (await fetch(`${base}/agendar/nao-existe`)).text();
    assert.doesNotMatch(desconhecida, /Agende seu horário/);

    await request(base, '/api/admin/barbearia/configuracoes', { method: 'PATCH', headers, body: JSON.stringify({ slugPublico: 'dino' }) });
    const dinoHtml = await (await fetch(`${base}/agendar/dino`)).text();
    assert.ok(dinoHtml.includes(`og:url" content="${base}/agendar/dino"`));
    await request(base, '/api/admin/barbearia/configuracoes', { method: 'PATCH', headers, body: JSON.stringify({ slugPublico: 'dino-captacao' }) });

    // Nome com aspas, tags e "$'" não quebra o HTML nem vira padrão do replace.
    await request(base, '/api/admin/barbearia/configuracoes', { method: 'PATCH', headers, body: JSON.stringify({ nomePublico: `Dino "Top" $' <b>` }) });
    const estranha = await (await fetch(`${base}/agendar/dino-captacao`)).text();
    assert.match(estranha, /<title>Agende seu horário \| Dino &quot;Top&quot; \$&#39; &lt;b&gt;<\/title>/);
    assert.equal((estranha.match(/<\/head>/g) || []).length, 1, 'o documento não foi duplicado');

    const semSessao = await request(base, '/api/admin/barbearia/captacao/clube');
    assert.equal(semSessao.response.status, 401);
    const projecaoSemSessao = await request(base, '/api/admin/barbearia/captacao/projecao-faturamento');
    assert.equal(projecaoSemSessao.response.status, 401);
  } finally {
    processo.kill('SIGTERM');
  }
});

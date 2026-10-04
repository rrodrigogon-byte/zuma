// Resumo diário do Dino: números da agenda, texto do WhatsApp, motivos legíveis
// e envio. O ciclo completo com PostgreSQL (idempotência e fila da equipe) está
// no simulador (cenário 42).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'resumo-')), 'db.json');

const test = (await import('node:test')).default;
const assert = (await import('node:assert/strict')).default;
const barbearia = await import('../barbearia-erp-kytto.js');
const { motivoLegivel } = await import('./whatsapp-handoff-labels.js');
const { numerosDaAgenda, textoDoResumo, enviarResumo, diaLocal, configuracaoResumoPublica, tickResumoDiario } = await import('./dino-resumo-diario.js');

const EMPRESA = '0f0e0d0c-1b2a-4c3d-8e9f-0123456789ab';
const TODOS = [0, 1, 2, 3, 4, 5, 6];

function iso(dia, hora) { return new Date(`${dia}T${hora}:00-04:00`).toISOString(); }
function maisUmDia(dia) { const [a, m, d] = dia.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d + 1, 12)).toISOString().slice(0, 10); }

test('números da agenda: concluídos, valor atendido, faltas, IA de hoje e amanhã', () => {
  barbearia.atualizarConfiguracao(EMPRESA, { horarioAbertura: '08:00', horarioFechamento: '20:00', intervaloMinutos: 30, diasFuncionamento: TODOS, antecedenciaMinutos: 0, janelaReservaDias: 60 });
  const p = barbearia.criarProfissional(EMPRESA, { nome: 'Bruno', horarioInicio: '08:00', horarioFim: '20:00', diasTrabalho: TODOS });
  const s = barbearia.criarServico(EMPRESA, { nome: 'Corte', duracaoMinutos: 30, preco: 45 });
  const hoje = diaLocal();
  const amanha = maisUmDia(hoje);
  const base = { profissionalId: p.id, servicoId: s.id, clienteNome: 'Cliente', duracaoMinutos: 30, valor: 45 };
  const a1 = barbearia.criarAgendamento(EMPRESA, { ...base, clienteTelefone: '65999990001', dataHora: iso(hoje, '08:00'), origem: 'whatsapp_ia' });
  const a2 = barbearia.criarAgendamento(EMPRESA, { ...base, clienteTelefone: '65999990002', dataHora: iso(hoje, '09:00') });
  const a3 = barbearia.criarAgendamento(EMPRESA, { ...base, clienteTelefone: '65999990003', dataHora: iso(hoje, '10:00') });
  barbearia.criarAgendamento(EMPRESA, { ...base, clienteTelefone: '65999990004', dataHora: iso(amanha, '14:30') });
  barbearia.criarAgendamento(EMPRESA, { ...base, clienteTelefone: '65999990005', dataHora: iso(amanha, '09:30'), origem: 'whatsapp_ia' });
  for (const a of [a1, a2]) { barbearia.alterarStatusAgendamento(EMPRESA, a.id, 'em_atendimento'); barbearia.alterarStatusAgendamento(EMPRESA, a.id, 'concluido'); }
  barbearia.alterarStatusAgendamento(EMPRESA, a3.id, 'nao_compareceu');

  const n = numerosDaAgenda(EMPRESA, { dia: hoje });
  assert.equal(n.atendimentos, 3);
  assert.equal(n.concluidos, 2);
  assert.equal(n.faltas, 1);
  assert.equal(n.faturamento, 90);
  assert.equal(n.ia.agendamentos, 2, 'criados pela IA hoje (um para hoje, outro para amanhã)');
  assert.equal(n.amanha.agendamentos, 2);
  assert.equal(n.amanha.primeiro, '09:30', 'primeiro horário de amanhã em ordem');
});

test('texto do WhatsApp: números, fila por motivo e agenda de amanhã', () => {
  const agenda = { dia: '2026-10-02', atendimentos: 12, concluidos: 10, faltas: 1, cancelados: 1, faturamento: 1234.5, ia: { agendamentos: 4, valorPrevisto: 210 }, amanha: { dia: '2026-10-03', agendamentos: 9, primeiro: '08:30' } };
  const atendente = { conversas: 17, remarcacoes: 2, cancelamentos: 1, pedidos: 1, valorPedidos: 430, filaEquipe: 3, filaPorMotivo: { 'equipe respondendo pelo celular': 2, 'cliente pediu uma pessoa': 1 } };
  const t = textoDoResumo({ nomeLoja: 'Barbearia Dino', agenda, atendente });
  assert.match(t, /^\*Fechamento do dia · Barbearia Dino\*/);
  assert.match(t, /sexta-feira 02\/10/);
  assert.match(t, /\*10\* atendimento\(s\) concluído\(s\) de 12/);
  assert.match(t, /R\$ 1\.234,50/);
  assert.match(t, /17 conversa\(s\) atendida\(s\)/);
  assert.match(t, /4 horário\(s\) marcado\(s\) sozinha · R\$ 210,00 previstos/);
  assert.match(t, /1 pedido\(s\) da loja · R\$ 430,00/);
  assert.match(t, /\*3\* conversa\(s\) com a equipe agora \(2 equipe respondendo pelo celular, 1 cliente pediu uma pessoa\)/);
  assert.match(t, /Amanhã: \*9\* horário\(s\), o primeiro às 08:30/);
  const semAtendente = textoDoResumo({ agenda: { ...agenda, amanha: { agendamentos: 0 } }, atendente: null });
  assert.match(semAtendente, /dados de conversas indisponíveis/);
  assert.match(semAtendente, /agenda ainda livre/);
});

test('motivos de handoff legíveis', () => {
  assert.equal(motivoLegivel('equipe_no_celular'), 'equipe respondendo pelo celular');
  assert.equal(motivoLegivel('security:sensitive_card'), 'dado sensível enviado');
  assert.equal(motivoLegivel('security:prompt_injection'), 'segurança');
  assert.equal(motivoLegivel('gemini:TIMEOUT'), 'IA indisponível');
  assert.equal(motivoLegivel(''), 'revisão humana');
  assert.equal(motivoLegivel('algo_novo'), 'algo novo');
});

test('envio: conta sucessos, mascara falhas e nunca expõe o número no painel', async () => {
  const enviados = [];
  const r = await enviarResumo({ texto: 'oi', telefones: ['5565999990001', '5565999990002'] }, async (_t, tel, texto) => {
    enviados.push([tel, texto]);
    return tel.endsWith('2') ? { ok: false } : { ok: true };
  });
  assert.deepEqual(r, { enviados: 1, falhas: ['***0002'] });
  const scoped = await enviarResumo({ texto: 'oi', telefones: ['5565999990001'], instance: 'dino' }, async (tenant) => {
    assert.equal(tenant.whatsapp_instance, 'dino');
    return { ok: true };
  });
  assert.equal(scoped.enviados, 1);
  const antes = { ...process.env };
  try {
    process.env.DINO_RESUMO_TELEFONES = '(65) 99999-0001, 5565999990002';
    process.env.DINO_RESUMO_HORA = '25:99';
    const cfg = configuracaoResumoPublica();
    assert.deepEqual(cfg.destinatarios, ['***0001', '***0002']);
    assert.equal(cfg.hora, '21:00', 'hora inválida cai no padrão');
    assert.equal(cfg.ativo, false, 'desligado por padrão');
    delete process.env.DINO_RESUMO_DIARIO;
    assert.deepEqual(await tickResumoDiario(), { skipped: 'desligado' });
  } finally {
    process.env = antes;
  }
});

test('resumo diário multi-instância não reserva nem envia se empresa/canal divergirem', async () => {
  const antes = { ...process.env };
  let writes = 0;
  let sends = 0;
  const executor = { queryRead: async () => ({ rows: [{ instance: 'isa' }] }), query: async () => { writes += 1; return { rows: [] }; } };
  try {
    Object.assign(process.env, { DINO_RESUMO_DIARIO: 'on', DINO_RESUMO_EMPRESA_ID: EMPRESA, DINO_RESUMO_TELEFONES: '65999990001', WHATSAPP_PROVIDER: 'chatbot_backend', CHATBOT_BACKEND_MODE: 'instancias', CHATBOT_BACKEND_INSTANCE: 'dino', CHATBOT_BACKEND_EMPRESA_ID: '00000000-0000-4000-8000-000000000002' });
    const opts = { forcar: true, executor, enviar: async () => { sends += 1; return { ok: true }; } };
    assert.deepEqual(await tickResumoDiario(opts), { skipped: 'instance_scope_mismatch' });
    process.env.CHATBOT_BACKEND_EMPRESA_ID = EMPRESA;
    assert.deepEqual(await tickResumoDiario(opts), { skipped: 'instance_scope_mismatch' });
    assert.equal(writes, 0);
    assert.equal(sends, 0);
  } finally { process.env = antes; }
});

test('loja do canal: sessão em "todas as lojas" usa a loja do WhatsApp ativo', async () => {
  const { lojaDoCanal } = await import('./dino-resumo-diario.js');
  const consultas = [];
  const executor = { queryRead: async (sql, params) => { consultas.push(params); return { rows: [{ loja_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' }] }; } };
  assert.equal(await lojaDoCanal(EMPRESA, executor), 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  assert.deepEqual(consultas[0], [EMPRESA]);
  assert.equal(await lojaDoCanal('principal', executor), '', 'empresa legada sem UUID não consulta o banco');
  assert.equal(consultas.length, 1);
  const falha = { queryRead: async () => { throw new Error('fora do ar'); } };
  assert.equal(await lojaDoCanal(EMPRESA, falha), '', 'banco fora do ar não quebra o resumo');
});

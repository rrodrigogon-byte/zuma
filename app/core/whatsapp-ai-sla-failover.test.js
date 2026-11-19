import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './database.js';
import { listWhatsappAiSessions, executarFailoverAutomaticoHandoff } from './whatsapp-ai.js';

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const LOJA = '22222222-2222-4222-8222-222222222222';
const USUARIO = '33333333-3333-4333-8333-333333333333';
const context = () => ({ empresaId: EMPRESA, lojaId: LOJA, usuarioId: USUARIO });

const originals = () => ({ queryRead: db.queryRead, query: db.query, transaction: db.transaction });
function restore(o) { Object.assign(db, o); }

test('listWhatsappAiSessions calcula métricas de SLA de 5m e failover de 10m', async () => {
  const o = originals();
  const agora = new Date();
  const seisMinutosAtras = new Date(agora.getTime() - 6 * 60000).toISOString();
  const quatroMinutosAtras = new Date(agora.getTime() - 4 * 60000).toISOString();
  const doisMinutosAtras = new Date(agora.getTime() - 2 * 60000).toISOString();

  db.queryRead = async () => ({
    rows: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        telefone: '5565999991111',
        nome: 'Cliente SLA Estourado',
        status: 'humano',
        handoff_requested_at: seisMinutosAtras,
        assigned_at: seisMinutosAtras,
        assigned_to: USUARIO,
        ultima_interacao_em: seisMinutosAtras,
        ultima_msg_cliente_em: seisMinutosAtras,
        ultima_msg_equipe_em: null,
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        telefone: '5565999992222',
        nome: 'Cliente Alerta Amarelo',
        status: 'humano',
        handoff_requested_at: quatroMinutosAtras,
        assigned_at: null,
        assigned_to: null,
        ultima_interacao_em: quatroMinutosAtras,
        ultima_msg_cliente_em: quatroMinutosAtras,
        ultima_msg_equipe_em: null,
      },
      {
        id: '66666666-6666-4666-8666-666666666666',
        telefone: '5565999993333',
        nome: 'Cliente No Prazo',
        status: 'humano',
        handoff_requested_at: doisMinutosAtras,
        assigned_at: doisMinutosAtras,
        assigned_to: USUARIO,
        ultima_interacao_em: doisMinutosAtras,
        ultima_msg_cliente_em: doisMinutosAtras,
        ultima_msg_equipe_em: null,
      },
      {
        id: '77777777-7777-4777-8777-777777777777',
        telefone: '5565999994444',
        nome: 'Cliente Já Respondido Pela Equipe',
        status: 'humano',
        handoff_requested_at: seisMinutosAtras,
        assigned_at: seisMinutosAtras,
        assigned_to: USUARIO,
        ultima_interacao_em: agora.toISOString(),
        ultima_msg_cliente_em: seisMinutosAtras,
        ultima_msg_equipe_em: agora.toISOString(),
      },
    ],
  });

  try {
    const list = await listWhatsappAiSessions(context(), { limit: 10 });
    assert.equal(list.length, 4);

    // Cliente 1: 6 min sem resposta -> SLA estourado (>= 5 min)
    const c1 = list[0];
    assert.equal(c1.slaMinutos, 5);
    assert.ok(c1.tempoEsperaMinutos >= 6);
    assert.equal(c1.slaExcedido, true);
    assert.equal(c1.precisa_atendente, true); // Alerta urgente ativado por SLA estourado mesmo atribuído!
    assert.equal(c1.statusSla, 'sla_estourado');
    assert.ok(c1.tempoParaFailoverMinutos <= 4);

    // Cliente 2: 4 min sem resposta -> Alerta amarelo (>= 3 min e < 5 min)
    const c2 = list[1];
    assert.equal(c2.slaExcedido, false);
    assert.equal(c2.slaAlerta, true);
    assert.equal(c2.statusSla, 'alerta_amarelo');

    // Cliente 3: 2 min sem resposta -> Dentro do SLA
    const c3 = list[2];
    assert.equal(c3.slaExcedido, false);
    assert.equal(c3.slaAlerta, false);
    assert.equal(c3.statusSla, 'dentro_do_sla');

    // Cliente 4: Equipe já respondeu após a mensagem do cliente -> Respondido
    const c4 = list[3];
    assert.equal(c4.slaExcedido, false);
    assert.equal(c4.statusSla, 'respondido');
  } finally {
    restore(o);
  }
});

test('executarFailoverAutomaticoHandoff resgata conversas paradas há mais de 10 minutos', async () => {
  const o = originals();
  const agora = new Date();
  const dozeMinutosAtras = new Date(agora.getTime() - 12 * 60000).toISOString();
  const cincoMinutosAtras = new Date(agora.getTime() - 5 * 60000).toISOString();

  const updates = [];
  const inserts = [];

  db.queryRead = async () => ({
    rows: [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        empresa_id: EMPRESA,
        loja_id: LOJA,
        canal_id: '99999999-9999-4999-8999-999999999999',
        telefone: '5565999998888',
        nome: 'Rennan Posca',
        status: 'humano',
        handoff_requested_at: dozeMinutosAtras,
        assigned_to: USUARIO,
        assigned_at: dozeMinutosAtras,
        ultima_interacao_em: dozeMinutosAtras,
        ultima_msg_cliente: 'Quero cortar com o Bruno hoje às 15h',
        ultima_msg_cliente_em: dozeMinutosAtras,
        ultima_msg_equipe_em: null,
        canal_nome: 'Barbearia Dino WhatsApp',
        configuracao: {},
      },
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        empresa_id: EMPRESA,
        loja_id: LOJA,
        canal_id: '99999999-9999-4999-8999-999999999999',
        telefone: '5565999997777',
        nome: 'Cliente Recente',
        status: 'humano',
        handoff_requested_at: cincoMinutosAtras,
        assigned_to: USUARIO,
        assigned_at: cincoMinutosAtras,
        ultima_interacao_em: cincoMinutosAtras,
        ultima_msg_cliente: 'Qual o valor?',
        ultima_msg_cliente_em: cincoMinutosAtras,
        ultima_msg_equipe_em: null,
        canal_nome: 'Barbearia Dino WhatsApp',
        configuracao: {},
      },
    ],
  });

  db.transaction = async (fn) => {
    return fn({
      query: async (sql, params) => {
        updates.push({ sql, params });
        return { rows: [{ id: params[0] }] };
      },
    });
  };

  db.query = async (sql, params) => {
    inserts.push({ sql, params });
    return { rows: [{ id: 'msg-id' }] };
  };

  try {
    const report = await executarFailoverAutomaticoHandoff({ empresaId: EMPRESA, lojaId: LOJA }, { limiteMinutos: 10, enviar: false });

    assert.equal(report.totalVerificadas, 2);
    assert.equal(report.totalResgatadas, 1);
    assert.equal(report.resgatadas[0].sessionId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    assert.equal(report.resgatadas[0].profissionalDetectado, 'bruno');
    assert.equal(report.resgatadas[0].linkAgendamento, 'https://kytto.com.br/agendar/dino/bruno');

    // Valida que atualizou o status para 'ativo' e motivo para 'failover_automatico_sla_10min'
    assert.equal(updates.length, 1);
    assert.match(updates[0].sql, /status = 'ativo'/);
    assert.match(updates[0].sql, /failover_automatico_sla_10min/);
  } finally {
    restore(o);
  }
});

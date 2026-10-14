import { test } from 'node:test';
import assert from 'node:assert/strict';
import { painelBarbeiro, profissionalDoUsuario, ehGestao, ModoBarbeiroError } from './dino-modo-barbeiro.js';
import * as push from './dino-push-equipe.js';

const profissionais = [
  { id: 'p1', nome: 'Carlos Barbeiro', email: 'carlos@dino.test', ativo: true, percentualComissao: 50, percentualComissaoProduto: 30 },
  { id: 'p2', nome: 'Rafael', email: 'rafael@dino.test', ativo: true, percentualComissao: 40 },
  { id: 'p3', nome: 'Inativo', email: 'velho@dino.test', ativo: false },
];
const servicos = [{ id: 's1', nome: 'Corte', preco: 45, duracaoMinutos: 30 }, { id: 's2', nome: 'Corte Premium', preco: 1000, duracaoMinutos: 60 }];
function erpFalso() {
  const chamadas = [];
  return {
    chamadas,
    listarProfissionais: () => profissionais.filter((p) => p.ativo !== false),
    listarServicos: () => servicos,
    listarAgendamentos: (empresaId, filtros) => {
      chamadas.push(['agenda', filtros]);
      const todos = [
        { id: 'a1', profissionalId: 'p1', servicoId: 's1', status: 'concluido', dataHora: '2026-10-02T13:00:00.000Z', clienteNome: 'João', clienteTelefone: '65999990001', valor: 45 },
        { id: 'a2', profissionalId: 'p1', servicoId: 's2', status: 'confirmado', dataHora: '2026-10-02T15:00:00.000Z', clienteNome: 'Marcos', valor: 1000 },
        { id: 'a3', profissionalId: 'p1', servicoId: 's1', status: 'cancelado', dataHora: '2026-10-02T16:00:00.000Z', clienteNome: 'Pedro', valor: 45 },
        { id: 'a4', profissionalId: 'p1', servicoId: 's1', status: 'nao_compareceu', dataHora: '2026-10-02T12:00:00.000Z', clienteNome: 'Lucas', valor: 45 },
        { id: 'b1', profissionalId: 'p2', servicoId: 's1', status: 'agendado', dataHora: '2026-10-02T15:00:00.000Z', clienteNome: 'Outro', valor: 45 },
      ];
      return todos.filter((a) => a.profissionalId === filtros.profissionalId);
    },
    listarBloqueios: () => [{ id: 'blk', titulo: 'Almoço', inicio: '2026-10-02T16:00:00.000Z', fim: '2026-10-02T17:00:00.000Z', profissionalId: 'p1' }],
    obterComissoes: (empresaId, filtros) => {
      chamadas.push(['comissoes', filtros]);
      return { porProfissional: [{ profissionalId: 'p1', atendimentos: filtros.data ? 1 : 10, bruto: 45, repasse: filtros.data ? 22.5 : 300, comissaoServicos: 22.5, comissaoProdutos: 0 }, { profissionalId: 'p2', atendimentos: 3, repasse: 99 }] };
    },
  };
}

test('vínculo pelo e-mail do login, sem diferenciar maiúsculas, ignorando inativos', () => {
  assert.equal(profissionalDoUsuario(profissionais, { email: 'CARLOS@dino.test' })?.id, 'p1');
  assert.equal(profissionalDoUsuario(profissionais, { email: 'velho@dino.test' }), null);
  assert.equal(profissionalDoUsuario(profissionais, { email: '' }), null);
});

test('papéis de gestão', () => {
  assert.equal(ehGestao({ role: 'staff' }), false);
  assert.equal(ehGestao({ role: 'organizador' }), true);
  assert.equal(ehGestao({ role: 'staff', platformAdmin: true }), true);
});

test('barbeiro vê só a própria agenda, mesmo pedindo a de outro', () => {
  const erp = erpFalso();
  const painel = painelBarbeiro(erp, { empresaId: 'e1', usuario: { role: 'staff', email: 'carlos@dino.test' }, profissionalId: 'p2', data: '2026-10-02', agora: new Date('2026-10-02T14:00:00Z') });
  assert.equal(painel.profissional.id, 'p1');
  assert.equal(painel.profissional.souEu, true);
  assert.equal(painel.gestao, false);
  assert.deepEqual(painel.profissionais, []);
  assert.ok(painel.agendamentos.every((a) => !String(a.id).startsWith('b')));
  // Resumo: cancelado fora; falta conta como falta e não entra no previsto.
  assert.equal(painel.resumo.total, 3);
  assert.equal(painel.resumo.concluidos, 1);
  assert.equal(painel.resumo.faltas, 1);
  assert.equal(painel.resumo.previsto, 1045);
  assert.equal(painel.resumo.proximoId, 'a2');
  assert.equal(painel.comissao.dia.repasse, 22.5);
  assert.equal(painel.comissao.mes.repasse, 300);
  assert.equal(painel.comissao.mes.inicio, '2026-10-01');
  assert.deepEqual(erp.chamadas.find(([tipo, f]) => tipo === 'comissoes' && f.inicio)[1], { inicio: '2026-10-01', fim: '2026-10-02', lojaId: '' });
  assert.equal(painel.agendamentos.find((a) => a.id === 'a2').servicoNome, 'Corte Premium');
  assert.equal(painel.bloqueios[0].titulo, 'Almoço');
});

test('barbeiro sem vínculo recebe orientação e nenhuma agenda', () => {
  const painel = painelBarbeiro(erpFalso(), { empresaId: 'e1', usuario: { role: 'staff', email: 'novo@dino.test' }, data: '2026-10-02' });
  assert.equal(painel.profissional, null);
  assert.equal(painel.vinculado, false);
  assert.match(painel.mensagem, /e-mail/);
  assert.deepEqual(painel.agendamentos, []);
});

test('gestão escolhe qualquer profissional e recebe a lista', () => {
  const painel = painelBarbeiro(erpFalso(), { empresaId: 'e1', usuario: { role: 'organizador', email: 'gestor@dino.test' }, profissionalId: 'p2', data: '2026-10-02' });
  assert.equal(painel.profissional.id, 'p2');
  assert.equal(painel.profissional.souEu, false);
  assert.equal(painel.profissionais.length, 2);
  assert.throws(() => painelBarbeiro(erpFalso(), { empresaId: 'e1', usuario: { role: 'admin' }, profissionalId: 'nao-existe', data: '2026-10-02' }), ModoBarbeiroError);
});

test('data inválida é recusada', () => {
  assert.throws(() => painelBarbeiro(erpFalso(), { empresaId: 'e1', usuario: { role: 'admin' }, data: '02/10/2026' }), /Data inválida/);
});

// ── Push da equipe ──────────────────────────────────────────────────────────
test('push: só aceita endpoints HTTPS dos serviços de push conhecidos', () => {
  assert.equal(push.endpointPermitido('https://fcm.googleapis.com/fcm/send/abc'), true);
  assert.equal(push.endpointPermitido('https://web.push.apple.com/QWERTY'), true);
  assert.equal(push.endpointPermitido('https://updates.push.services.mozilla.com/wpush/v2/x'), true);
  assert.equal(push.endpointPermitido('http://fcm.googleapis.com/fcm/send/abc'), false);
  assert.equal(push.endpointPermitido('https://fcm.googleapis.com:8443/x'), false);
  assert.equal(push.endpointPermitido('https://169.254.169.254/latest'), false);
  assert.equal(push.endpointPermitido('https://fcm.googleapis.com.evil.test/x'), false);
  assert.equal(push.endpointPermitido('https://localhost/x'), false);
});

test('push: desligado sem as chaves VAPID', () => {
  assert.equal(push.pushConfigurado({}), false);
  assert.equal(push.pushConfigurado({ VAPID_PUBLIC_KEY: 'x', VAPID_PRIVATE_KEY: 'y', VAPID_SUBJECT: 'nada' }), false);
  assert.equal(push.chavePublica({}), '');
});

test('push: payload genérico sem PII', () => {
  const m = push.montarMensagem({ id: 'a1', clienteNome: 'João da Silva', clienteTelefone: '65999990001', dataHora: '2026-10-02T13:00:00.000Z', dataAgenda: '2026-10-02' }, 'criado', 'Corte');
  assert.deepEqual(m, { title: 'Novo agendamento', body: 'Abra o app Dino Equipe para conferir a agenda.' });
});
test('push: validação das chaves da assinatura', () => {
  const ok = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } };
  assert.equal(push.validarAssinatura(ok).endpoint, ok.endpoint);
  assert.throws(() => push.validarAssinatura({ ...ok, keys: { p256dh: 'curta', auth: 'a'.repeat(22) } }), /Chaves/);
  assert.throws(() => push.validarAssinatura({ ...ok, endpoint: 'https://exemplo.test/x' }), /não aceito/);
});

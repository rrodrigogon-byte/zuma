import test from 'node:test';
import assert from 'node:assert/strict';
import { decidirAcesso, validadeOffline, CODIGOS, ACOES } from '../modules/acesso/regras.js';

// Quarta-feira, 21/10/2026, 18:30 em Cuiabá (UTC-4) = 22:30 UTC
const AGORA = new Date('2026-10-21T22:30:00Z');
const dias = (n) => new Date(AGORA.getTime() + n * 86400000);

function ctxBase(extra = {}) {
  return {
    agora: AGORA,
    fuso: 'America/Cuiaba',
    unidadeId: 'u1',
    pessoa: { id: 'p1', nome: 'Ana Souza' },
    matricula: { pagoAte: dias(10), plano: {} },
    contrato: { status: 'aceito' },
    acessosRecentes: [],
    reservas: [],
    ...extra,
  };
}

test('aluno em dia entra com mensagem de boas-vindas', () => {
  const d = decidirAcesso(ctxBase());
  assert.equal(d.liberado, true);
  assert.equal(d.codigo, CODIGOS.LIBERADO);
  assert.equal(d.mensagem, 'Bom treino, Ana!');
  assert.equal(d.acao, ACOES.REGISTRAR_PRESENCA);
});

test('bloqueio manual vence todas as outras regras', () => {
  const d = decidirAcesso(ctxBase({ pessoa: { id: 'p1', nome: 'Ana', bloqueada: true }, matricula: null }));
  assert.equal(d.codigo, CODIGOS.BLOQUEIO_MANUAL);
  assert.equal(d.mensagem, 'Procure a recepção');
});

test('sem matrícula é bloqueado', () => {
  assert.equal(decidirAcesso(ctxBase({ matricula: null })).codigo, CODIGOS.SEM_PLANO);
});

test('contrato pendente só bloqueia após o prazo de 7 dias', () => {
  const dentroDoPrazo = decidirAcesso(ctxBase({ contrato: { status: 'enviado', enviadoEm: dias(-6) } }));
  assert.equal(dentroDoPrazo.liberado, true);
  const vencido = decidirAcesso(ctxBase({ contrato: { status: 'enviado', enviadoEm: dias(-7) } }));
  assert.equal(vencido.codigo, CODIGOS.CONTRATO_PENDENTE);
  assert.equal(vencido.acao, ACOES.REENVIAR_CONTRATO);
});

test('inadimplência respeita a tolerância de 5 dias', () => {
  assert.equal(decidirAcesso(ctxBase({ matricula: { pagoAte: dias(-5), plano: {} } })).liberado, true);
  const d = decidirAcesso(ctxBase({ matricula: { pagoAte: dias(-6), plano: {} } }));
  assert.equal(d.codigo, CODIGOS.INADIMPLENTE);
  assert.equal(d.acao, ACOES.ENVIAR_LINK_PAGAMENTO);
  assert.equal(d.diasAtraso, 6);
});

test('tolerância do plano sobrescreve o padrão', () => {
  const d = decidirAcesso(ctxBase({ matricula: { pagoAte: dias(-2), plano: { toleranciaDias: 0 } } }));
  assert.equal(d.codigo, CODIGOS.INADIMPLENTE);
});

test('horário do plano usa o fuso da academia, não o do servidor', () => {
  // 18:30 local de quarta (3): plano manhã bloqueia
  const manha = { 3: [{ inicio: '06:00', fim: '12:00' }] };
  const d = decidirAcesso(ctxBase({ matricula: { pagoAte: dias(10), plano: { horarios: manha } } }));
  assert.equal(d.codigo, CODIGOS.FORA_DO_HORARIO);
  assert.equal(d.mensagem, 'Seu plano libera das 06h às 12h');
  assert.equal(d.acao, ACOES.OFERECER_UPGRADE);

  const noite = { 3: [{ inicio: '17:00', fim: '23:00' }] };
  assert.equal(decidirAcesso(ctxBase({ matricula: { pagoAte: dias(10), plano: { horarios: noite } } })).liberado, true);
});

test('dia sem janela no plano bloqueia', () => {
  const soSabado = { 6: [{ inicio: '08:00', fim: '12:00' }] };
  const d = decidirAcesso(ctxBase({ matricula: { pagoAte: dias(10), plano: { horarios: soSabado } } }));
  assert.equal(d.mensagem, 'Seu plano não libera acesso hoje');
});

test('janela que atravessa a meia-noite funciona', () => {
  const madrugada = { 3: [{ inicio: '18:00', fim: '02:00' }] };
  assert.equal(decidirAcesso(ctxBase({ matricula: { pagoAte: dias(10), plano: { horarios: madrugada } } })).liberado, true);
});

test('limite diário conta acessos do dia local', () => {
  const plano = { limitePorDia: 1 };
  const manhaDeHoje = new Date('2026-10-21T11:00:00Z'); // 07:00 local
  const ontemNoite = new Date('2026-10-21T02:00:00Z'); // 22:00 local de ontem
  assert.equal(
    decidirAcesso(ctxBase({ matricula: { pagoAte: dias(10), plano }, acessosRecentes: [ontemNoite] })).liberado,
    true,
  );
  const d = decidirAcesso(ctxBase({ matricula: { pagoAte: dias(10), plano }, acessosRecentes: [manhaDeHoje] }));
  assert.equal(d.codigo, CODIGOS.LIMITE_ATINGIDO);
  assert.equal(d.acao, ACOES.OFERECER_DIARIA);
});

test('limite semanal', () => {
  const plano = { limitePorSemana: 3 };
  const acessos = [dias(-1), dias(-3), dias(-5)];
  assert.equal(
    decidirAcesso(ctxBase({ matricula: { pagoAte: dias(10), plano }, acessosRecentes: acessos })).codigo,
    CODIGOS.LIMITE_ATINGIDO,
  );
  const antigos = [dias(-1), dias(-3), dias(-8)];
  assert.equal(
    decidirAcesso(ctxBase({ matricula: { pagoAte: dias(10), plano }, acessosRecentes: antigos })).liberado,
    true,
  );
});

test('plano que exige reserva libera só na janela da aula', () => {
  const plano = { exigeReserva: true };
  const semReserva = decidirAcesso(ctxBase({ matricula: { pagoAte: dias(10), plano } }));
  assert.equal(semReserva.codigo, CODIGOS.SEM_RESERVA);
  assert.equal(semReserva.acao, ACOES.MOSTRAR_VAGAS);

  const aula1845 = new Date('2026-10-21T22:45:00Z');
  assert.equal(
    decidirAcesso(ctxBase({ matricula: { pagoAte: dias(10), plano }, reservas: [{ inicio: aula1845, status: 'reservada' }] }))
      .liberado,
    true,
  );
  const cancelada = [{ inicio: aula1845, status: 'cancelada' }];
  assert.equal(
    decidirAcesso(ctxBase({ matricula: { pagoAte: dias(10), plano }, reservas: cancelada })).codigo,
    CODIGOS.SEM_RESERVA,
  );
  const aula2000 = [{ inicio: new Date('2026-10-22T00:00:00Z'), status: 'reservada' }];
  assert.equal(
    decidirAcesso(ctxBase({ matricula: { pagoAte: dias(10), plano }, reservas: aula2000 })).codigo,
    CODIGOS.SEM_RESERVA,
  );
});

test('unidade fora do plano', () => {
  const d = decidirAcesso(ctxBase({ matricula: { pagoAte: dias(10), plano: { unidades: ['u2'] } } }));
  assert.equal(d.codigo, CODIGOS.UNIDADE_NAO_PERMITIDA);
});

test('anti-dupla entrada em 90 minutos', () => {
  const ha30min = new Date(AGORA.getTime() - 30 * 60000);
  assert.equal(decidirAcesso(ctxBase({ acessosRecentes: [ha30min] })).codigo, CODIGOS.JA_DENTRO);
  const ha2h = new Date(AGORA.getTime() - 120 * 60000);
  assert.equal(decidirAcesso(ctxBase({ acessosRecentes: [ha2h] })).liberado, true);
});

test('ordem: inadimplência vem antes de horário', () => {
  const plano = { horarios: { 3: [{ inicio: '06:00', fim: '07:00' }] } };
  const d = decidirAcesso(ctxBase({ matricula: { pagoAte: dias(-30), plano } }));
  assert.equal(d.codigo, CODIGOS.INADIMPLENTE);
});

test('validade offline = pago até + tolerância, em segundos', () => {
  const pagoAte = new Date('2026-11-01T00:00:00Z');
  const v = validadeOffline({ pagoAte, plano: {} });
  assert.equal(v.end_time, Math.floor(new Date('2026-11-06T00:00:00Z').getTime() / 1000));
  assert.deepEqual(validadeOffline(null), { begin_time: 0, end_time: 1 });
});

test('online e offline cortam no mesmo instante (fim do último dia de tolerância)', () => {
  const pagoAte = new Date('2026-11-02T03:59:59Z'); // fim de 01/11 em Cuiabá
  const matricula = { pagoAte, plano: {} };
  const corte = validadeOffline(matricula).end_time * 1000;
  const ctx = (agora) => ({ agora, pessoa: { nome: 'A' }, matricula, contrato: null, acessosRecentes: [], reservas: [] });
  assert.equal(decidirAcesso(ctx(new Date(corte - 1000))).liberado, true, '1 s antes do corte entra');
  assert.equal(decidirAcesso(ctx(new Date(corte + 1000))).codigo, CODIGOS.INADIMPLENTE, '1 s depois do corte bloqueia');
});

test('prazo do contrato vem do próprio contrato quando informado', () => {
  const contrato = { status: 'enviado', enviadoEm: dias(-2), prazoAceiteEm: dias(-1) };
  assert.equal(decidirAcesso(ctxBase({ contrato })).codigo, CODIGOS.CONTRATO_PENDENTE);
  const folgado = { status: 'enviado', enviadoEm: dias(-10), prazoAceiteEm: dias(5) };
  assert.equal(decidirAcesso(ctxBase({ contrato: folgado })).liberado, true);
});

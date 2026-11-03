import test from 'node:test';
import assert from 'node:assert/strict';
import {
  processarSpintax,
  gerarMensagemHumanizadaDino,
  calcularCadenciaHumanizada,
  verificarCooldownLote,
  estaEmJanelaSeguraEnvio,
  normalizarTelefone,
  obterConfiguracaoAntiban,
  registrarOptOut,
  estaEmOptOut,
  podeEnviarMensagemAtiva,
  registrarEnvioRealizado,
  atualizarConfiguracaoAntiban,
  ESTAGIOS_AQUECIMENTO,
} from './whatsapp-antiban.js';

test('processarSpintax resolve opções alternadas corretamente', () => {
  // Teste com RNG determinístico
  const rngMin = () => 0.0;
  const rngMax = () => 0.99;

  const template = '{Olá|Oi|E aí} {amigo|camarada}!';

  const minResult = processarSpintax(template, rngMin);
  assert.equal(minResult, 'Olá amigo!');

  const maxResult = processarSpintax(template, rngMax);
  assert.equal(maxResult, 'E aí camarada!');
});

test('processarSpintax mantém texto comum sem spintax inalterado', () => {
  const texto = 'Mensagem direta sem chaves.';
  assert.equal(processarSpintax(texto), texto);
});

test('gerarMensagemHumanizadaDino gera variações e inclui opt-out', () => {
  const cliente = { nome: 'Rodrigo Gonçalves', ultimaVisita: '2026-08-10', diasSemVir: 85 };
  const msg = gerarMensagemHumanizadaDino({
    cliente,
    profissional: 'Dino',
    modelo: 'essencial',
    incluirOptOut: true,
  });

  assert.match(msg, /Rodrigo/);
  assert.match(msg, /Barbearia Dino/i);
  assert.match(msg, /SAIR/i); // Deve conter instrução explícita de opt-out
});

test('calcularCadenciaHumanizada gera intervalo seguro aleatório entre min e max', () => {
  const rngMid = () => 0.5;
  const ms = calcularCadenciaHumanizada({ minSec: 20, maxSec: 40, rng: rngMid });
  assert.equal(ms, 30000); // 20 + 0.5 * 20 = 30s = 30000ms

  // Intervalo mínimo nunca menor que 10s
  const msMin = calcularCadenciaHumanizada({ minSec: 5, rng: () => 0 });
  assert.ok(msMin >= 10000);
});

test('verificarCooldownLote aciona pausa nos intervalos corretos', () => {
  const semCooldown = verificarCooldownLote(5, { aCada: 10 });
  assert.equal(semCooldown.necessario, false);

  const comCooldown = verificarCooldownLote(10, { aCada: 10, pausaMinSec: 120, pausaMaxSec: 180, rng: () => 0.5 });
  assert.equal(comCooldown.necessario, true);
  assert.equal(comCooldown.pausaSegundos, 150);
});

test('estaEmJanelaSeguraEnvio bloqueia fora de horário e permite em horário comercial', () => {
  // Segunda-feira às 14h00 Cuiabá (horário válido)
  const seg14h = new Date('2026-11-02T18:00:00.000Z'); // 18h UTC = 14h Cuiabá (-4)
  const resValido = estaEmJanelaSeguraEnvio(seg14h);
  assert.equal(resValido.ok, true);

  // Segunda-feira às 23h00 Cuiabá (horário noturno bloqueado)
  const seg23h = new Date('2026-11-03T03:00:00.000Z');
  const resNoturno = estaEmJanelaSeguraEnvio(seg23h);
  assert.equal(resNoturno.ok, false);
  assert.match(resNoturno.motivo, /Horário noturno/i);

  // Domingo bloqueado
  const dom14h = new Date('2026-11-01T18:00:00.000Z');
  const resDomingo = estaEmJanelaSeguraEnvio(dom14h, { permitirDomingo: false });
  assert.equal(resDomingo.ok, false);
  assert.match(resDomingo.motivo, /domingo/i);
});

test('normalizarTelefone formata DDI 55 corretamente', () => {
  assert.equal(normalizarTelefone('65999990000'), '5565999990000');
  assert.equal(normalizarTelefone('+55 (65) 99999-0000'), '5565999990000');
  assert.equal(normalizarTelefone('5565999990000'), '5565999990000');
});

test('fluxo de Opt-Out impede envio e respeita recusa do cliente', () => {
  const empId = `teste_antiban_${Date.now()}_${Math.random()}`;
  const tel = '65988887777';

  // Antes do opt-out
  assert.equal(estaEmOptOut(empId, tel), false);

  // Registra opt-out
  const registrado = registrarOptOut(empId, tel, 'cliente_mandou_sair');
  assert.equal(registrado, true);
  assert.equal(estaEmOptOut(empId, tel), true);

  // Tentativa de envio deve ser barrada
  const validacao = podeEnviarMensagemAtiva(empId, tel, { ignorarJanelaHorario: true, ignorarLimiteDiario: true });
  assert.equal(validacao.ok, false);
  assert.match(validacao.motivo, /SAIR/i);
});

test('aquecimento de chip e cota diária funcionam com segurança', () => {
  const empId = `teste_warmup_${Date.now()}_${Math.random()}`;

  // Configura limite de 2 envios para testar exaustão
  atualizarConfiguracaoAntiban(empId, { estagio: 'novo', limiteDiarioPersonalizado: 2 });

  const cfg = obterConfiguracaoAntiban(empId);
  assert.equal(cfg.limiteDiario, 2);

  // Primeiro envio liberado
  const val1 = podeEnviarMensagemAtiva(empId, '65991112222', { ignorarJanelaHorario: true });
  assert.equal(val1.ok, true);
  registrarEnvioRealizado(empId, '65991112222');

  // Segundo envio liberado
  const val2 = podeEnviarMensagemAtiva(empId, '65991113333', { ignorarJanelaHorario: true });
  assert.equal(val2.ok, true);
  registrarEnvioRealizado(empId, '65991113333');

  // Terceiro envio bloqueado por cota diária
  const val3 = podeEnviarMensagemAtiva(empId, '65991114444', { ignorarJanelaHorario: true });
  assert.equal(val3.ok, false);
  assert.equal(val3.limiteAtingido, true);
  assert.match(val3.motivo, /Cota diária de aquecimento atingida/i);
});

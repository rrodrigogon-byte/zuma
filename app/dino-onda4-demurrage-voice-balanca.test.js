import test from 'node:test';
import assert from 'node:assert';
import {
  registrarMarcoViagemBetoneira,
  listarRelatorioDemurrage,
  FRANQUIA_DESCARGA_MINUTOS,
  TARIFA_DEMURRAGE_HORA
} from './modules/concreto/demurrage-telemetria.js';
import {
  sintetizarAudioTRex,
  listarAudiosSintetizadosTRex,
  MOTOR_IA_OFICIAL
} from './core/dino-trex-voice-synth.js';
import {
  decodificarFrameToledo,
  calcularItemPesado,
  emularLeituraBalancaToledo
} from './modules/supermercado/balanca-toledo-service.js';

test('1. Concreto: Registro de telemetria e apuração de Demurrage NBR 7212', async () => {
  const cargaId = `crg-test-${Date.now()}`;
  const betoneiraId = 'BT-04';
  const agora = Date.now();

  // 1. Saída da Usina às 08:00
  await registrarMarcoViagemBetoneira({
    cargaId,
    betoneiraId,
    motoristaNome: 'Marcos Silveira',
    etapa: 'saida_usina',
    timestamp: new Date(agora - 100 * 60 * 1000).toISOString(),
    lacreNumero: 'LACRE-8910'
  });

  // 2. Chegada na Obra às 08:25 (75 minutos atrás)
  await registrarMarcoViagemBetoneira({
    cargaId,
    betoneiraId,
    etapa: 'chegada_obra',
    timestamp: new Date(agora - 75 * 60 * 1000).toISOString(),
    engenheiroResponsavel: 'Eng. Roberto Alcantara'
  });

  // 3. Início da Descarga com Slump de 14cm
  await registrarMarcoViagemBetoneira({
    cargaId,
    betoneiraId,
    etapa: 'inicio_descarga',
    timestamp: new Date(agora - 40 * 60 * 1000).toISOString(),
    slumpMedido: 14.5
  });

  // 4. Fim da Descarga agora (ficou 75 min na obra. Franquia de 30 min -> 45 min excedentes)
  const resFim = await registrarMarcoViagemBetoneira({
    cargaId,
    betoneiraId,
    etapa: 'fim_descarga',
    timestamp: new Date(agora).toISOString()
  });

  assert.strictEqual(resFim.ok, true);
  assert.strictEqual(resFim.viagem.status, 'finalizada');
  assert.strictEqual(resFim.viagem.demurrage.apurado, true);
  assert.strictEqual(resFim.viagem.demurrage.minutosExcedentes, 45); // 75 - 30 = 45 min
  assert.strictEqual(resFim.viagem.demurrage.valorTotal, 135.00);    // 45 min * R$ 3,00 = R$ 135,00

  // Relatório geral de Demurrage
  const relatorio = listarRelatorioDemurrage({ cargaId });
  assert.strictEqual(relatorio.viagensComDemurrage, 1);
  assert.strictEqual(relatorio.valorTotalDemurrage, 135.00);
});

test('2. Barbearia Dino: Síntese de áudio humanizado do T-Rex via Motor KyttoIA', async () => {
  const synth = await sintetizarAudioTRex({
    clienteNome: 'Rodrigo',
    tipoMensagem: 'aniversario'
  });

  assert.strictEqual(synth.ok, true);
  assert.strictEqual(synth.audio.motorIa, MOTOR_IA_OFICIAL);
  assert.ok(synth.audio.scriptFala.includes('T-Rex da Barbearia Dino'));
  assert.ok(synth.audio.scriptFala.includes('Barboterapia'));
  assert.strictEqual(synth.audio.status, 'pronto_para_envio');

  // Listar áudios gerados
  const lista = listarAudiosSintetizadosTRex(5);
  assert.ok(lista.total >= 1);
});

test('3. Supermercado: Decodificação serial de balança Toledo Prix 3 Fit', () => {
  // Teste 1: Frame em gramas "01250" -> 1.250 kg
  const dec1 = decodificarFrameToledo('\x0201250\x03');
  assert.strictEqual(dec1.pesoKg, 1.250);
  assert.strictEqual(dec1.estavel, true);

  // Teste 2: Emulação de pesagem de hortifrúti
  const emu = emularLeituraBalancaToledo(2.350);
  assert.strictEqual(emu.sucesso, true);
  assert.strictEqual(emu.leitura.pesoKg, 2.350);

  // Teste 3: Cálculo de preço de item pesado (ex: Melancia R$ 4,50/kg)
  const item = calcularItemPesado(
    { id: 'prod-melancia-01', nome: 'Melancia Baby Doce', precoVenda: 4.50 },
    emu.leitura.pesoKg,
    0.050 // 50g de tara da sacola
  );
  assert.strictEqual(item.pesoLiquidoKg, 2.300); // 2.350 - 0.050
  assert.strictEqual(item.valorTotal, 10.35);    // 2.300 * 4.50 = 10.35
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  obterStatusConectores,
  configurarModbusTCP,
  acionarCoilModbus,
  processarFrameBalanca,
  executarCicloSimuladoCLP
} from './conectores-industriais.js';

test('1. Conectores Industriais: Status inicial do gateway e leitura traduzida de sensores', () => {
  const status = obterStatusConectores();
  assert.equal(status.ok, true);
  assert.equal(status.modbus.conectado, true);
  assert.equal(typeof status.modbus.sensoresTraduzidos.pesoAgregadosKg, 'number');
  assert.equal(typeof status.modbus.sensoresTraduzidos.pesoCimentoKg, 'number');
  assert.ok(status.balancas.fabricantesSuportados.length >= 4);
});

test('2. Conectores Industriais: Configuração de parâmetros Modbus TCP e acionamento de Coils', () => {
  const config = configurarModbusTCP({
    host: '10.0.0.120',
    porta: 502,
    unidadeId: 2,
    clpFabricante: 'Siemens S7-1500'
  });
  assert.equal(config.ok, true);
  assert.equal(config.modbus.host, '10.0.0.120');

  // Acionar coil 1 (Comporta de agregados)
  const acionamento = acionarCoilModbus(1, true);
  assert.equal(acionamento.ok, true);
  assert.equal(acionamento.novoEstado, true);

  const desligar = acionarCoilModbus(1, false);
  assert.equal(desligar.ok, true);
  assert.equal(desligar.novoEstado, false);
});

test('3. Conectores Industriais: Parser de frame para balanças Toledo Prix 9094, Filizola e Alfa', () => {
  // Toledo
  const resToledo = processarFrameBalanca('toledo_prix_9094', '\x020042850\x03');
  assert.equal(resToledo.ok, true);
  assert.equal(resToledo.leitura.pesoBrutoKg, 42850);

  // Filizola
  const resFilizola = processarFrameBalanca('filizola_cs15', '\x0238900\r');
  assert.equal(resFilizola.ok, true);
  assert.equal(resFilizola.leitura.pesoBrutoKg, 38900);

  // Alfa Instrumentos
  const resAlfa = processarFrameBalanca('alfa_3100c', '31500 kg');
  assert.equal(resAlfa.ok, true);
  assert.equal(resAlfa.leitura.pesoBrutoKg, 31500);
});

test('4. Conectores Industriais: Execução de ciclo de dosagem CLP sob ABNT NBR 7212', () => {
  const ciclo = executarCicloSimuladoCLP({ volumeM3: 8, fck: 35 });
  assert.equal(ciclo.ok, true);
  assert.equal(ciclo.dosagemPlanejada.volumeM3, 8);
  assert.ok(ciclo.dosagemPlanejada.cimentoKg > 0);
  assert.ok(ciclo.dosagemPlanejada.aguaL > 0);
});

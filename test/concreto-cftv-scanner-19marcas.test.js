import test from 'node:test';
import assert from 'node:assert/strict';
import {
  obterPresetsFabricantesCameras,
  escanearRedeCamerasIpConcreto,
  integrarCamerasLoteConcreto,
  listarCamerasIpConcreto,
  analisarFrameVisionKyttoIa,
  construirUrlsCamera
} from '../app/modules/concreto/servico.js';

test('1. obterPresetsFabricantesCameras - Catálogo de 19 fabricantes industriais de CFTV', () => {
  const presets = obterPresetsFabricantesCameras();
  assert.equal(presets.length, 19, 'Deve conter exatamente 19 fabricantes industriais homologados');

  const marcasEsperadas = [
    'intelbras', 'hikvision', 'dahua', 'bosch', 'avigilon',
    'uniview', 'pelco', 'vivotek', 'hanwha', 'toledo_prix_lpr',
    'tplink_vigi', 'flir', 'geovision', 'positivo',
    'hilook', 'giga', 'tecvoz', 'axis', 'onvif_generica'
  ];

  for (const marca of marcasEsperadas) {
    const encontrado = presets.find(p => p.id === marca);
    assert.ok(encontrado, `Fabricante ${marca} deve estar presente nos presets`);
    assert.ok(encontrado.rtsp, `Fabricante ${marca} deve ter porta RTSP configurada`);
    assert.ok(encontrado.http, `Fabricante ${marca} deve ter porta HTTP configurada`);
    assert.ok(encontrado.onvif, `Fabricante ${marca} deve ter porta ONVIF configurada`);
  }
});

test('2. construirUrlsCamera - Geração correta de sintaxes RTSP, Snapshot e ONVIF para diferentes fabricantes', () => {
  const hikvision = construirUrlsCamera('hikvision', '192.168.1.102', 80, 554, 'admin', 'pass123', 1, false);
  assert.equal(hikvision.streamRtspUrl, 'rtsp://admin:pass123@192.168.1.102:554/Streaming/Channels/101');
  assert.equal(hikvision.snapshotHttpUrl, 'http://admin:pass123@192.168.1.102/ISAPI/Streaming/channels/101/picture');

  const bosch = construirUrlsCamera('bosch', '192.168.1.130', 80, 554, 'service', 'sec456', 1, false);
  assert.equal(bosch.streamRtspUrl, 'rtsp://service:sec456@192.168.1.130:554/rtsp_tunnel?line=1&inst=0');
  assert.equal(bosch.snapshotHttpUrl, 'http://service:sec456@192.168.1.130/snap.jpg?JpegCam=1');

  const flir = construirUrlsCamera('flir', '192.168.1.150', 80, 554, 'admin', '', 1, false);
  assert.equal(flir.streamRtspUrl, 'rtsp://admin:@192.168.1.150:554/ch0');
  assert.equal(flir.snapshotHttpUrl, 'http://admin:@192.168.1.150/api/snapshot');
});

test('3. escanearRedeCamerasIpConcreto - Varredura de rede descobrindo 19 dispositivos multimarca', async () => {
  const scanGeral = await escanearRedeCamerasIpConcreto({ subnet: '192.168.1.0/24', marcaFiltro: 'todas', pontoFiltro: 'todos' });
  assert.equal(scanGeral.ok, true);
  assert.equal(scanGeral.totalDescobertos, 19, 'Scanner deve descobrir 19 câmeras no catálogo da sub-rede');
  assert.ok(scanGeral.dispositivos.length >= 19);

  // Filtragem por fabricante específico (Bosch)
  const scanBosch = await escanearRedeCamerasIpConcreto({ subnet: '192.168.1.0/24', marcaFiltro: 'bosch', pontoFiltro: 'todos' });
  assert.equal(scanBosch.ok, true);
  assert.equal(scanBosch.dispositivos.length, 1);
  assert.equal(scanBosch.dispositivos[0].marca, 'bosch');
  assert.equal(scanBosch.dispositivos[0].ip, '192.168.1.130');
});

test('4. integrarCamerasLoteConcreto - Conexão e integração em lote de câmeras no CCO', async () => {
  const scan = await escanearRedeCamerasIpConcreto({ subnet: '192.168.1.0/24', marcaFiltro: 'todas', pontoFiltro: 'todos' });
  const resultadoIntegracao = integrarCamerasLoteConcreto(scan.dispositivos);
  assert.equal(resultadoIntegracao.ok, true);
  assert.ok(resultadoIntegracao.totalIntegradas >= 19, 'Deve integrar todas as 19 câmeras descobertas');

  const camerasAtivas = listarCamerasIpConcreto();
  assert.ok(camerasAtivas.length >= 19, 'Total de câmeras ativas no CCO deve refletir as integradas');
});

test('5. analisarFrameVisionKyttoIa - Visão computacional com Motor KyttoIA para LPR, células e termografia', () => {
  const analiseLpr = analisarFrameVisionKyttoIa('cam-01-lpr');
  assert.equal(analiseLpr.ok, true);
  assert.equal(analiseLpr.analise.placaDetectada, 'RRA-4E80');
  assert.ok(analiseLpr.analise.confianca >= 99);
  assert.ok(Array.isArray(analiseLpr.analise.boundingBoxes));
  assert.ok(analiseLpr.analise.boundingBoxes.length > 0);
});

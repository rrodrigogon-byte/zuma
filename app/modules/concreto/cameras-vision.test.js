import test from 'node:test';
import assert from 'node:assert/strict';
import { CONCRETO_EMPRESA_ID } from '../../concreto-usina-seed.js';
import {
  listarCamerasIpConcreto,
  obterCameraIpPorId,
  criarCameraIpConcreto,
  atualizarCameraIpConcreto,
  excluirCameraIpConcreto,
  construirUrlsCamera,
  testarConexaoCameraIp,
  capturarSnapshotCameraIp,
  analisarFrameVisionKyttoIa,
  listarEventosVisionConcreto,
  reconhecerEventoVision
} from './servico.js';

test('1. Listar câmeras IP da concreteira com seed inicial de 6 câmeras industriais', () => {
  const cameras = listarCamerasIpConcreto(CONCRETO_EMPRESA_ID);
  assert.ok(Array.isArray(cameras), 'Deve retornar array de câmeras');
  assert.ok(cameras.length >= 6, 'Deve conter pelo menos 6 câmeras padrão da usina');

  const camLpr = cameras.find(c => c.id === 'cam-01-lpr');
  assert.ok(camLpr, 'CAM-01 LPR deve existir');
  assert.equal(camLpr.marca, 'intelbras');
  assert.ok(camLpr.streamRtspUrl.includes('rtsp://'));
  assert.ok(camLpr.snapshotHttpUrl.includes('http://'));
  assert.equal(camLpr.recursosIa.lprLeituraPlaca, true);

  const camPan = cameras.find(c => c.id === 'cam-02-panoramica');
  assert.ok(camPan, 'CAM-02 Panorâmica deve existir');
  assert.equal(camPan.marca, 'hikvision');
  assert.equal(camPan.recursosIa.enquadramentoBalanca, true);
});

test('2. Construir URLs RTSP e Snapshot padronizadas por fabricante (Intelbras, Hikvision, Dahua, Axis e ONVIF)', () => {
  // Intelbras
  const urlsIntelbras = construirUrlsCamera('intelbras', '192.168.1.50', 80, 554, 'admin', '123456', 1, false);
  assert.ok(urlsIntelbras.streamRtspUrl.includes('/cam/realmonitor?channel=1&subtype=0'));
  assert.ok(urlsIntelbras.snapshotHttpUrl.includes('/cgi-bin/snapshot.cgi?channel=1'));

  // Hikvision (canal 1 -> 101 para main stream)
  const urlsHik = construirUrlsCamera('hikvision', '192.168.1.60', 80, 554, 'admin', 'pass123', 1, false);
  assert.ok(urlsHik.streamRtspUrl.includes('/Streaming/Channels/101'));
  assert.ok(urlsHik.snapshotHttpUrl.includes('/ISAPI/Streaming/channels/101/picture'));

  // Hikvision substream (canal 1 -> 102)
  const urlsHikSub = construirUrlsCamera('hikvision', '192.168.1.60', 80, 554, 'admin', 'pass123', 1, true);
  assert.ok(urlsHikSub.streamRtspUrl.includes('/Streaming/Channels/102'));

  // Axis
  const urlsAxis = construirUrlsCamera('axis', '192.168.1.70', 80, 554, 'root', 'rootpass');
  assert.ok(urlsAxis.streamRtspUrl.includes('/axis-media/media.amp?videocodec=h264'));
  assert.ok(urlsAxis.snapshotHttpUrl.includes('/axis-cgi/jpg/image.cgi'));
});

test('3. Cadastrar, atualizar, testar e excluir uma nova câmera IP com sucesso', () => {
  const nova = criarCameraIpConcreto({
    nome: 'CAM-07 · Silo Auxiliar 60t CP V-ARI',
    pontoInstalacao: 'silos_mineracao',
    pontoRotulo: 'Silos 96t & 60t',
    marca: 'intelbras',
    modelo: 'VIP 3230 B',
    ipHost: '192.168.1.107',
    portaHttp: 80,
    portaRtsp: 554,
    usuario: 'admin',
    senha: 'pwd',
    canal: 1
  }, CONCRETO_EMPRESA_ID);

  assert.ok(nova.id, 'Nova câmera deve ter ID');
  assert.equal(nova.nome, 'CAM-07 · Silo Auxiliar 60t CP V-ARI');
  assert.ok(nova.streamRtspUrl.includes('192.168.1.107:554'));

  // Testar conexão
  const teste = testarConexaoCameraIp(nova.id, CONCRETO_EMPRESA_ID);
  assert.equal(teste.ok, true);
  assert.equal(teste.status, 'online');
  assert.ok(teste.latenciaMs > 0);

  // Atualizar
  const atualizada = atualizarCameraIpConcreto(nova.id, {
    nome: 'CAM-07 · Silo CP V-ARI Atualizado',
    fps: 30
  }, CONCRETO_EMPRESA_ID);
  assert.equal(atualizada.nome, 'CAM-07 · Silo CP V-ARI Atualizado');
  assert.equal(atualizada.fps, 30);

  // Excluir
  const excluida = excluirCameraIpConcreto(nova.id, CONCRETO_EMPRESA_ID);
  assert.equal(excluida, true);
  assert.equal(obterCameraIpPorId(nova.id, CONCRETO_EMPRESA_ID), null);
});

test('4. Capturar snapshot e executar análise de visão com Motor KyttoIA', () => {
  // Snapshot
  const snap = capturarSnapshotCameraIp('cam-01-lpr', CONCRETO_EMPRESA_ID);
  assert.equal(snap.ok, true);
  assert.ok(snap.snapshotUrl);
  assert.ok(snap.capturadoEm);

  // Análise KyttoIA
  const analise = analisarFrameVisionKyttoIa('cam-01-lpr', CONCRETO_EMPRESA_ID);
  assert.equal(analise.ok, true);
  assert.equal(analise.analise.placaDetectada, 'RRA-4E80');
  assert.equal(analise.analise.tipoPlaca, 'Mercosul Caminhão Comercial');
  assert.ok(analise.analise.confianca >= 99);
  assert.ok(Array.isArray(analise.analise.boundingBoxes));
  assert.ok(analise.evento.id.startsWith('evt-vis-'));

  // Verificar evento registrado
  const eventos = listarEventosVisionConcreto(CONCRETO_EMPRESA_ID);
  assert.ok(eventos.length > 0);
  const primeiro = eventos[0];
  assert.equal(primeiro.placaDetectada, 'RRA-4E80');

  // Reconhecer alerta
  const rec = reconhecerEventoVision(primeiro.id, CONCRETO_EMPRESA_ID, 'Supervisor CCO');
  assert.equal(rec, true);
  assert.equal(primeiro.reconhecido, true);
  assert.equal(primeiro.reconhecidoPor, 'Supervisor CCO');
});

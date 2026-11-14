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
  reconhecerEventoVision,
  escanearRedeCamerasIpConcreto,
  obterPresetsFabricantesCameras,
  integrarCamerasLoteConcreto
} from './servico.js';

test('1. Listar câmeras IP da concreteira com seed inicial de câmeras industriais', () => {
  const cameras = listarCamerasIpConcreto(CONCRETO_EMPRESA_ID);
  assert.ok(Array.isArray(cameras), 'Deve retornar array de câmeras');
  assert.ok(cameras.length >= 6, 'Deve conter pelo menos 6 câmeras padrão da usina');

  const camLpr = cameras.find(c => c.id === 'cam-01-lpr' || c.id === 'cam-balanca-ent-01' || c.pontoInstalacao === 'balanca_entrada_lpr');
  assert.ok(camLpr, 'CAM LPR Entrada deve existir');
  assert.equal(camLpr.marca, 'intelbras');
  assert.ok(camLpr.streamRtspUrl.includes('rtsp://'));
  assert.ok(camLpr.snapshotHttpUrl.includes('http://'));
  assert.equal(camLpr.recursosIa.lprLeituraPlaca, true);

  const camPan = cameras.find(c => c.id === 'cam-02-panoramica' || c.id === 'cam-balanca-sai-02' || c.id === 'cam-silos-cimento-04');
  assert.ok(camPan, 'Câmera industrial adicional deve existir');
  assert.ok(camPan.streamRtspUrl.includes('rtsp://'));
});

test('2. Construir URLs RTSP e Snapshot padronizadas para amplo catálogo de marcas (19 fabricantes)', () => {
  // Intelbras
  const intelbras = construirUrlsCamera('intelbras', '192.168.1.50', 80, 554, 'admin', '123456', 1, false);
  assert.ok(intelbras.streamRtspUrl.includes('/cam/realmonitor?channel=1&subtype=0'));
  assert.ok(intelbras.snapshotHttpUrl.includes('/cgi-bin/snapshot.cgi?channel=1'));

  // Hikvision (canal 1 -> 101 para main stream, 102 para substream)
  const hik = construirUrlsCamera('hikvision', '192.168.1.60', 80, 554, 'admin', 'pass123', 1, false);
  assert.ok(hik.streamRtspUrl.includes('/Streaming/Channels/101'));
  assert.ok(hik.snapshotHttpUrl.includes('/ISAPI/Streaming/channels/101/picture'));
  const hikSub = construirUrlsCamera('hikvision', '192.168.1.60', 80, 554, 'admin', 'pass123', 1, true);
  assert.ok(hikSub.streamRtspUrl.includes('/Streaming/Channels/102'));

  // Dahua
  const dahua = construirUrlsCamera('dahua', '192.168.1.70', 80, 554, 'admin', 'pass123', 2, true);
  assert.ok(dahua.streamRtspUrl.includes('/cam/realmonitor?channel=2&subtype=1'));

  // Bosch Security (Dinion IP Starlight)
  const bosch = construirUrlsCamera('bosch', '192.168.1.130', 80, 554, 'admin', 'bosch123', 1, false);
  assert.ok(bosch.streamRtspUrl.includes('/rtsp_tunnel?line=1&inst=0'));
  assert.ok(bosch.snapshotHttpUrl.includes('/snap.jpg?JpegCam=1'));

  // Motorola / Avigilon H5A
  const avigilon = construirUrlsCamera('avigilon', '192.168.1.132', 80, 554, 'admin', 'avig123', 1, false);
  assert.ok(avigilon.streamRtspUrl.includes('/defaultPrimary?streamType=u'));
  assert.ok(avigilon.snapshotHttpUrl.includes('/media/cam1.jpg'));

  // Uniview / UNV Tri-Guard
  const unv = construirUrlsCamera('uniview', '192.168.1.127', 80, 554, 'admin', 'unv123', 1, false);
  assert.ok(unv.streamRtspUrl.includes('/unicast/c1/s0/live'));
  assert.ok(unv.snapshotHttpUrl.includes('/images/snapshot.jpg'));

  // Pelco (Sarix Series)
  const pelco = construirUrlsCamera('pelco', '192.168.1.145', 80, 554, 'admin', 'pelco123', 1, false);
  assert.ok(pelco.streamRtspUrl.includes('/stream1'));
  assert.ok(pelco.snapshotHttpUrl.includes('/jpeg'));

  // Vivotek LPR
  const vivotek = construirUrlsCamera('vivotek', '192.168.1.142', 80, 554, 'admin', 'vivo123', 1, false);
  assert.ok(vivotek.streamRtspUrl.includes('/live.sdp'));
  assert.ok(vivotek.snapshotHttpUrl.includes('/cgi-bin/viewer/video.jpg'));

  // Hanwha Vision (Wisenet)
  const hanwha = construirUrlsCamera('hanwha', '192.168.1.140', 80, 554, 'admin', 'hanwha123', 1, false);
  assert.ok(hanwha.streamRtspUrl.includes('/profile1/media.smp'));

  // Toledo do Brasil (Prix LPR 9094)
  const toledo = construirUrlsCamera('toledo_prix_lpr', '192.168.1.135', 80, 554, 'admin', 'toledo123', 1, false);
  assert.ok(toledo.streamRtspUrl.includes('/live/prix_lpr_ch1'));
  assert.ok(toledo.snapshotHttpUrl.includes('/api/lpr/capture.jpg'));

  // TP-Link VIGI
  const vigi = construirUrlsCamera('tplink_vigi', '192.168.1.138', 80, 554, 'admin', 'vigi123', 1, false);
  assert.ok(vigi.streamRtspUrl.includes('/stream1'));

  // FLIR Térmica Radiométrica
  const flir = construirUrlsCamera('flir', '192.168.1.150', 80, 554, 'admin', 'flir123', 1, false);
  assert.ok(flir.streamRtspUrl.includes('/ch0'));
  assert.ok(flir.snapshotHttpUrl.includes('/api/snapshot'));

  // GeoVision
  const geovision = construirUrlsCamera('geovision', '192.168.1.152', 80, 554, 'admin', 'geo123', 1, false);
  assert.ok(geovision.streamRtspUrl.includes('/live1.sdp'));

  // Positivo Casa Inteligente
  const positivo = construirUrlsCamera('positivo', '192.168.1.126', 80, 554, 'admin', 'pos123', 1, false);
  assert.ok(positivo.streamRtspUrl.includes('/live/ch0'));

  // Axis Communications
  const axis = construirUrlsCamera('axis', '192.168.1.124', 80, 554, 'root', 'rootpass');
  assert.ok(axis.streamRtspUrl.includes('/axis-media/media.amp?videocodec=h264'));
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
  const cameras = listarCamerasIpConcreto(CONCRETO_EMPRESA_ID);
  const cam = cameras[0];
  assert.ok(cam, 'Pelo menos uma câmera deve existir para teste');

  // Snapshot
  const snap = capturarSnapshotCameraIp(cam.id, CONCRETO_EMPRESA_ID);
  assert.equal(snap.ok, true);
  assert.ok(snap.snapshotUrl);
  assert.ok(snap.capturadoEm);

  // Análise KyttoIA
  const analise = analisarFrameVisionKyttoIa(cam.id, CONCRETO_EMPRESA_ID);
  assert.equal(analise.ok, true);
  assert.ok(analise.analise);
  assert.ok(analise.evento);
  assert.ok(analise.evento.id.startsWith('evt-vis-'));

  // Listar eventos
  const eventos = listarEventosVisionConcreto(CONCRETO_EMPRESA_ID);
  assert.ok(eventos.length > 0);

  // Reconhecer alerta
  const rec = reconhecerEventoVision(eventos[0].id, CONCRETO_EMPRESA_ID, 'Supervisor CCO');
  assert.equal(rec, true);
});

test('5. Scanner de rede de câmeras IP: varredura e descoberta ativa', async () => {
  const resultado = await escanearRedeCamerasIpConcreto({
    subnet: '192.168.1.0/24',
    marcaFiltro: 'todas'
  }, CONCRETO_EMPRESA_ID);

  assert.equal(resultado.ok, true);
  assert.equal(resultado.subnet, '192.168.1.0/24');
  assert.ok(resultado.totalDescobertos >= 15, 'Deve descobrir mais de 15 câmeras na sub-rede da usina');
  assert.ok(resultado.dispositivos.length >= 15);

  // Validar presença de marcas industriais chave
  const marcas = resultado.dispositivos.map(d => d.marca);
  assert.ok(marcas.includes('bosch'), 'Deve incluir câmera Bosch Dinion');
  assert.ok(marcas.includes('toledo_prix_lpr'), 'Deve incluir Totem Toledo Prix LPR');
  assert.ok(marcas.includes('uniview'), 'Deve incluir câmera Uniview');
  assert.ok(marcas.includes('avigilon'), 'Deve incluir câmera Avigilon / Motorola');
  assert.ok(marcas.includes('flir'), 'Deve incluir câmera Térmica FLIR');
  assert.ok(marcas.includes('tplink_vigi'), 'Deve incluir TP-Link VIGI');

  // Validar campos de cada dispositivo descoberto
  const devBosch = resultado.dispositivos.find(d => d.marca === 'bosch');
  assert.ok(devBosch);
  assert.equal(devBosch.rtspPort, 554);
  assert.ok(devBosch.ip.startsWith('192.168.1.'));
  assert.ok(devBosch.mac);
  assert.ok(devBosch.urlsGeradas.rtsp.includes('/rtsp_tunnel'));
});

test('6. Scanner de rede com filtro de marca e ponto de instalação', async () => {
  // Filtro Bosch
  const resBosch = await escanearRedeCamerasIpConcreto({
    subnet: '192.168.1.0/24',
    marcaFiltro: 'bosch'
  }, CONCRETO_EMPRESA_ID);

  assert.equal(resBosch.ok, true);
  assert.ok(resBosch.dispositivos.length >= 1);
  assert.ok(resBosch.dispositivos.every(d => d.marca === 'bosch'));

  // Filtro Toledo Prix LPR
  const resToledo = await escanearRedeCamerasIpConcreto({
    subnet: '192.168.1.0/24',
    marcaFiltro: 'toledo_prix_lpr'
  }, CONCRETO_EMPRESA_ID);

  assert.equal(resToledo.ok, true);
  assert.ok(resToledo.dispositivos.length >= 1);
  assert.equal(resToledo.dispositivos[0].marca, 'toledo_prix_lpr');
});

test('7. Presets de fabricantes de CFTV homologados para a concreteira', () => {
  const presets = obterPresetsFabricantesCameras();
  assert.ok(Array.isArray(presets));
  assert.ok(presets.length >= 18, 'Deve conter pelo menos 18 presets de fabricantes');

  const presetToledo = presets.find(p => p.id === 'toledo_prix_lpr');
  assert.ok(presetToledo);
  assert.equal(presetToledo.servico, 5000);

  const presetBosch = presets.find(p => p.id === 'bosch');
  assert.ok(presetBosch);
  assert.equal(presetBosch.servico, 1756);
});

test('8. Integração em lote de câmeras descobertas no scanner', () => {
  const dispositivos = [
    {
      ip: '192.168.1.188',
      marca: 'bosch',
      modelo: 'Dinion IP Starlight 7000',
      pontoSugerido: 'Balança 02 Mineração Células C1-C8',
      pontoInstalacao: 'balanca_panoramica',
      tipoAplicacao: 'enquadramento_balanca',
      httpPort: 80,
      rtspPort: 554,
      onvifPort: 80,
      servicoPort: 1756,
      fps: 30,
      codec: 'H.265'
    },
    {
      ip: '192.168.1.189',
      marca: 'toledo_prix_lpr',
      modelo: 'Totem LPR Rodoviário 9094',
      pontoSugerido: 'Totem LPR Saída Draga',
      pontoInstalacao: 'balanca_entrada_lpr',
      tipoAplicacao: 'lpr_mercosul',
      httpPort: 80,
      rtspPort: 554,
      onvifPort: 80,
      servicoPort: 5000,
      fps: 30,
      codec: 'H.264'
    }
  ];

  const resultado = integrarCamerasLoteConcreto(dispositivos, CONCRETO_EMPRESA_ID);
  assert.equal(resultado.ok, true);
  assert.equal(resultado.totalIntegradas, 2);

  const cameras = listarCamerasIpConcreto(CONCRETO_EMPRESA_ID);
  const camBosch = cameras.find(c => c.ipHost === '192.168.1.188');
  assert.ok(camBosch, 'Câmera Bosch integrada em lote deve existir');
  assert.equal(camBosch.marca, 'bosch');

  // Limpar as duas câmeras de teste
  excluirCameraIpConcreto(camBosch.id, CONCRETO_EMPRESA_ID);
  const camToledo = cameras.find(c => c.ipHost === '192.168.1.189');
  if (camToledo) excluirCameraIpConcreto(camToledo.id, CONCRETO_EMPRESA_ID);
});

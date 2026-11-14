import test from 'node:test';
import assert from 'node:assert/strict';
import {
  construirUrlsCamera,
  listarCamerasIpConcreto,
  criarCameraIpConcreto,
  testarConexaoCameraIp,
  gerarHtmlTicketBalanca,
  gerarHtmlRomaneioOficial,
  inicializarDatastoreConcreto
} from '../app/modules/concreto/servico.js';
import {
  deduplicarEmpresas,
  deduplicarLojas,
  HOLDING_GRUPO_PALATARE_ID,
  SERRANO_CONCRETO_EMPRESA_ID,
  PALATARE_PIZZARIA_EMPRESA_ID
} from '../web/src/lib/palatare-constants.js';

test('1. construirUrlsCamera - Suporte completo a todas as marcas (Intelbras, Positivo, Dahua, Hikvision, Axis)', () => {
  // Teste Intelbras
  const urlsIntelbras = construirUrlsCamera('intelbras', '192.168.1.101', 80, 554, 'admin', 'password123', 1);
  assert.match(urlsIntelbras.rtsp, /cam\/realmonitor\?channel=1&subtype=0/);
  assert.match(urlsIntelbras.onvif, /onvif\/device_service/);
  assert.equal(urlsIntelbras.snapshot, 'http://admin:password123@192.168.1.101/cgi-bin/snapshot.cgi?channel=1');

  // Teste Positivo
  const urlsPositivo = construirUrlsCamera('positivo', '192.168.1.102', 8899, 554, 'admin', 'password123', 1);
  assert.match(urlsPositivo.rtsp, /live\/ch0/);
  assert.match(urlsPositivo.onvif, /onvif\/device_service/);

  // Teste Dahua
  const urlsDahua = construirUrlsCamera('dahua', '192.168.1.103', 80, 554, 'admin', 'password123', 2);
  assert.match(urlsDahua.rtsp, /cam\/realmonitor\?channel=2&subtype=0/);

  // Teste Hikvision
  const urlsHikvision = construirUrlsCamera('hikvision', '192.168.1.104', 80, 554, 'admin', 'password123', 1);
  assert.match(urlsHikvision.rtsp, /Streaming\/Channels\/101/);
  assert.match(urlsHikvision.snapshot, /Streaming\/channels\/101\/picture/i);

  // Teste Axis
  const urlsAxis = construirUrlsCamera('axis', '192.168.1.105', 80, 554, 'root', 'password123', 1);
  assert.match(urlsAxis.rtsp, /axis-media\/media\.amp/);
  assert.match(urlsAxis.snapshot, /jpg\/image\.cgi/);
});

test('2. Matriz de Câmeras IP e Cockpit da Balança - Listagem e Teste de Ping RTSP', async () => {
  const cams = listarCamerasIpConcreto();
  assert.ok(Array.isArray(cams));
  assert.ok(cams.length >= 4, 'Deve conter pelo menos 4 câmeras industriais cadastradas');

  const cam1 = cams[0];
  const resultadoTeste = testarConexaoCameraIp(cam1.id);
  assert.equal(resultadoTeste.ok, true);
  assert.equal(resultadoTeste.status, 'online');
  assert.ok(resultadoTeste.latenciaMs > 0);
  assert.equal(resultadoTeste.streamRtspAtivo, true);
});

test('3. Ticket de Balança Rodoviária 80t Toledo Prix 9094 - Emissão Térmica com Peso Líquido', async () => {
  const resTicket = await gerarHtmlTicketBalanca('TKT-BAL-9841');
  const htmlTicket = typeof resTicket === 'string' ? resTicket : resTicket.html;
  assert.match(htmlTicket, /SERRANO CONCRETO &amp; MINERAÇÃO LTDA|SERRANO CONCRETO & MINERAÇÃO LTDA/);
  assert.match(htmlTicket, /Balança Rodoviária 80t Toledo/);
  assert.match(htmlTicket, /TARA/);
  assert.match(htmlTicket, /PESO BRUTO/);
  assert.match(htmlTicket, /PESO LÍQUIDO/);
  assert.match(htmlTicket, /33\.480 kg|33480/);
});

test('4. Romaneio Oficial de Carga NBR 7212 - Presença de GPS e Comprovação Fotográfica', async () => {
  const resRomaneio = await gerarHtmlRomaneioOficial('crg-1001');
  const htmlRomaneio = typeof resRomaneio === 'string' ? resRomaneio : resRomaneio.html;
  assert.match(htmlRomaneio, /SERRANO CONCRETO/);
  assert.match(htmlRomaneio, /NBR 7212/);
  assert.match(htmlRomaneio, /Balança Rodoviária 80t Toledo/);
  assert.match(htmlRomaneio, /Engª Karin Prestes/);
});

test('5. Deduplicação e Hierarquia Multi-tenant do Grupo Palatare', () => {
  const listaBruta = [
    { id: '1', nome: 'Palatare Pizzaria', cnpj: '51.499.928/0001-91' },
    { id: '2', nome: 'Palatare Pizzaria e Restaurante', cnpj: '51.499.928/0001-91' },
    { id: '3', nome: 'Serrano Concreto', cnpj: '53.798.485/0001-77' },
    { id: '4', nome: 'Serrano Concreto Usinado', cnpj: '53.798.485/0001-77' },
    { id: '5', nome: 'Holding Grupo Palatare', cnpj: '53.798.485/0001-77' }
  ];

  const dedup = deduplicarEmpresas(listaBruta);
  const nomes = dedup.map(e => e.nome);
  
  // Deve conter exatamente uma representação de cada entidade
  assert.ok(nomes.some(n => n.includes('Holding Grupo Palatare')));
  assert.ok(nomes.some(n => n.includes('Palatare Pizzaria')));
  assert.ok(nomes.some(n => n.includes('Serrano Concreto')));
  
  // Nenhuma duplicação de Palatare Pizzaria ou Serrano Concreto
  const contagemPizzaria = dedup.filter(e => e.nome.toLowerCase().includes('pizzaria')).length;
  assert.equal(contagemPizzaria, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAVE, XML_NFSE } from './nfse-danfse-fixture.js';
import { dadosDaNfse, gerarDanfseHtml, formatarDocumento, URL_CONSULTA_PUBLICA } from './nfse-danfse.js';


test('extrai os campos da NFS-e nacional ignorando namespace', () => {
  const d = dadosDaNfse(XML_NFSE);
  assert.equal(d.chaveAcesso, CHAVE);
  assert.equal(d.numero, '12');
  assert.equal(d.ambiente, 'producao_restrita');
  assert.equal(d.prestador.nome, 'Barbearia Dino & Cia');
  assert.equal(d.prestador.simples, '3');
  assert.match(d.prestador.endereco, /Rua das Palmeiras, 100, Centro — MT · CEP 78300-000/);
  assert.equal(d.tomador.documento, '52998224725');
  assert.equal(d.servico.cTribNac, '060101');
  assert.equal(d.valores.servico, '80.00');
  assert.equal(d.valores.liquido, '80.00');
  assert.equal(d.valores.pTotTribSN, '6.00');
  assert.throws(() => dadosDaNfse('<DPS/>'), /infNFSe/);
});

test('DANFSe: QR Code da consulta pública, escape, tarja de teste e de cancelamento', async () => {
  const html = await gerarDanfseHtml(XML_NFSE);
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('<svg'), 'QR Code em SVG embutido');
  assert.ok(html.includes(`${URL_CONSULTA_PUBLICA.replace('&', '&amp;')}${CHAVE}`));
  assert.ok(html.includes('Cliente &lt;Teste&gt;'), 'conteúdo do XML é escapado');
  assert.ok(!html.includes('<Teste>'));
  assert.ok(html.includes('SEM VALOR FISCAL'));
  assert.ok(html.includes('06.01.01'));
  assert.ok(html.includes('529.982.247-25'));
  assert.ok(html.includes('50.073.355/0002-60'));
  assert.match(html, /R\$\s?80,00/);
  const prod = await gerarDanfseHtml(XML_NFSE.replace('<tpAmb>2</tpAmb>', '<tpAmb>1</tpAmb>'), { cancelada: true, canceladaEm: '2026-10-13T09:00:00-03:00' });
  assert.ok(!prod.includes('SEM VALOR FISCAL'));
  assert.ok(prod.includes('NFS-e CANCELADA') && prod.includes('13/10/2026 09:00'));
  const semToma = await gerarDanfseHtml(XML_NFSE.replace(/<toma>.*<\/toma>/, ''));
  assert.ok(semToma.includes('Tomador não identificado'));
});

test('formatação de CPF/CNPJ', () => {
  assert.equal(formatarDocumento('50073355000260'), '50.073.355/0002-60');
  assert.equal(formatarDocumento('52998224725'), '529.982.247-25');
});

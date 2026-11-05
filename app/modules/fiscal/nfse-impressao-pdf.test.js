import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarDanfseHtml, dadosDaNfse, formatarIe, formatarDocumento } from '../../core/nfse-danfse.js';
import { XML_NFSE } from '../../core/nfse-danfse-fixture.js';

test('formatarIe formata 9 dígitos de Mato Grosso corretamente', () => {
  assert.equal(formatarIe('142291919'), '14.229.191-9');
  assert.equal(formatarIe('14.229.191-9'), '14.229.191-9');
  assert.equal(formatarIe('ISENTO'), 'ISENTO');
});

test('gerarDanfseHtml inclui Inscrição Estadual (14.229.191-9), Inscrição Municipal e botões de impressão/PDF', async () => {
  const emitente = {
    razao_social: 'DINO BARBEARIA LTDA',
    nome_fantasia: 'Barbearia Dino',
    cnpj: '50073355000260',
    ie: '142291919',
    im: '12345',
  };

  const html = await gerarDanfseHtml(XML_NFSE, {
    emitente,
    ambiente: 'producao',
    autoPrint: true,
  });

  assert.ok(html.includes('DANFSe — Documento Auxiliar da NFS-e'), 'deve conter o título do DANFSe');
  assert.ok(html.includes('14.229.191-9'), 'deve conter a Inscrição Estadual formatada da Barbearia Dino');
  assert.ok(html.includes('12345'), 'deve conter a Inscrição Municipal informada');
  assert.ok(html.includes('Imprimir / Salvar em PDF'), 'deve conter botão de impressão/PDF');
  assert.ok(html.includes('Consultar no Portal Nacional'), 'deve conter botão do Portal Nacional');
  assert.ok(html.includes('window.print()'), 'deve conter acionador de impressão/PDF');
  assert.ok(html.includes('50.073.355/0002-60'), 'deve conter CNPJ formatado');
});

test('gerarDanfseHtml exibe isenção/dispensa quando Inscrição Municipal não informada', async () => {
  const xmlSemIm = XML_NFSE.replace(/<IM>[^<]*<\/IM>/g, '');
  const emitenteSemIm = {
    razao_social: 'DINO BARBEARIA LTDA',
    nome_fantasia: 'Barbearia Dino',
    cnpj: '50073355000260',
    ie: '142291919',
    im: '',
  };

  const html = await gerarDanfseHtml(xmlSemIm, { emitente: emitenteSemIm });
  assert.ok(html.includes('14.229.191-9'), 'deve conter a IE');
  assert.ok(html.includes('Isento / Dispensa Sefin Nacional'), 'deve indicar dispensa de IM na Sefin Nacional');
});

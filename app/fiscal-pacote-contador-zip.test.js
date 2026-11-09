import test from 'node:test';
import assert from 'node:assert/strict';
import { montarZipBuffer } from './modules/fiscal/contador.js';

test('montarZipBuffer gera buffer PKZip válido e legível', () => {
  const arquivos = [
    { nome: 'relatorio.csv', conteudo: 'COMPETENCIA;VALOR\n2026-11;1500.00\n' },
    { nome: 'xml/nfe-55-1.xml', conteudo: '<nfeProc><NFe><infNFe Id="NFe512611..."></infNFe></nfeProc>' },
    { nome: 'SPED-FISCAL.txt', conteudo: '|0000|017|0|20261101|20261130|EMPRESA|\n|9999|3|\n' },
  ];

  const buffer = montarZipBuffer(arquivos);
  assert.ok(Buffer.isBuffer(buffer), 'Retorno deve ser Buffer');
  assert.ok(buffer.length > 100, 'Buffer deve ter tamanho suficiente');

  // Verifica assinatura PK\x03\x04 no início
  assert.equal(buffer.readUInt32LE(0), 0x04034b50, 'Deve iniciar com cabeçalho PKZip 0x04034b50');

  // Verifica se contém o nome dos arquivos no buffer
  const textoBuffer = buffer.toString('utf8');
  assert.ok(textoBuffer.includes('relatorio.csv'), 'Deve conter relatorio.csv');
  assert.ok(textoBuffer.includes('xml/nfe-55-1.xml'), 'Deve conter xml/nfe-55-1.xml');
  assert.ok(textoBuffer.includes('SPED-FISCAL.txt'), 'Deve conter SPED-FISCAL.txt');
});

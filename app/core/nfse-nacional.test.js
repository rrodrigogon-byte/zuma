import test from 'node:test';
import assert from 'node:assert/strict';
import * as n from './nfse-nacional.js';
import { pfxDeTeste } from './nfse-teste-certificado.js';

const cfg = n.normalizarConfigNfse({ cnpj: '50.073.355/0002-60', inscricaoMunicipal: '12345', cTribNacPadrao: '060101', pTotTribSN: 6 });

test('Id da DPS tem 45 caracteres e segue o padrão nacional', () => {
  const id = n.montarIdDps({ codigoMunicipio: '5107958', cnpj: '50073355000260', serie: '1', numero: 7 });
  assert.equal(id, 'DPS510795825007335500026000001000000000000007');
  assert.match(id, /^DPS[0-9]{42}$/);
});

test('DPS: ordem dos campos, tomador opcional, escape e totTrib do Simples', () => {
  const { xml, idDps } = n.montarDpsXml(cfg, { numero: 12, dataEmissao: new Date('2026-10-12T13:00:00Z'), servico: { cTribNac: '060101', descricao: 'Corte & barba <premium>' }, valorServico: 80 });
  assert.ok(xml.startsWith(`<DPS xmlns="${n.NS_NFSE}" versao="1.00"><infDPS Id="${idDps}">`));
  const ordem = ['tpAmb', 'dhEmi', 'verAplic', 'serie', 'nDPS', 'dCompet', 'tpEmit', 'cLocEmi', 'prest', 'serv', 'valores'].map((tag) => xml.indexOf(`<${tag}>`));
  assert.deepEqual([...ordem].sort((a, b) => a - b), ordem);
  assert.ok(!xml.includes('<toma>'), 'tomador não identificado omite <toma>');
  assert.ok(xml.includes('<tpAmb>2</tpAmb>'), 'padrão é produção restrita');
  assert.ok(xml.includes('<dhEmi>2026-10-12T10:00:00-03:00</dhEmi>'));
  assert.ok(xml.includes('Corte &amp; barba &lt;premium&gt;'));
  assert.ok(xml.includes('<regTrib><opSimpNac>3</opSimpNac><regApTribSN>1</regApTribSN><regEspTrib>0</regEspTrib></regTrib>'));
  assert.ok(xml.includes('<totTrib><pTotTribSN>6.00</pTotTribSN></totTrib>'));
  assert.ok(xml.includes('<vServ>80.00</vServ>'));
  const comToma = n.montarDpsXml(cfg, { numero: 13, servico: { cTribNac: '060101', descricao: 'Corte' }, valorServico: 50, tomador: { cpf: '529.982.247-25', nome: 'Ana' } }).xml;
  assert.ok(comToma.includes('<toma><CPF>52998224725</CPF><xNome>Ana</xNome></toma>'));
  assert.throws(() => n.montarDpsXml(cfg, { numero: 1, servico: { cTribNac: '0601', descricao: 'x' }, valorServico: 10 }), /cTribNac/);
  assert.throws(() => n.montarDpsXml(cfg, { numero: 1, servico: { cTribNac: '060101', descricao: 'x' }, valorServico: 0 }), /positivo/);
  assert.throws(() => n.montarDpsXml(cfg, { numero: 1, servico: { cTribNac: '060101', descricao: 'x' }, valorServico: 10, tomador: { cpf: '123' } }), /CPF/);
});

test('assinatura XMLDSig RSA-SHA256 válida, irmã de infDPS, e gzip+base64 reversível', () => {
  const cert = n.lerCertificadoPfx(pfxDeTeste(), 'senha-teste');
  const { xml } = n.montarDpsXml(cfg, { numero: 1, servico: { cTribNac: '060101', descricao: 'Corte' }, valorServico: 50 });
  const assinado = n.assinarElemento(xml, 'infDPS', cert);
  assert.ok(n.verificarAssinatura(assinado, cert.certPem));
  assert.match(assinado, /<\/infDPS><Signature xmlns="http:\/\/www.w3.org\/2000\/09\/xmldsig#">/);
  assert.match(assinado, /<\/Signature><\/DPS>$/);
  assert.ok(assinado.includes('rsa-sha256') && assinado.includes('xmlenc#sha256'));
  const adulterado = assinado.replace('<vServ>50.00</vServ>', '<vServ>5.00</vServ>');
  assert.equal(n.verificarAssinatura(adulterado, cert.certPem), false);
  const ida = n.gunzipB64(n.gzipB64(assinado));
  assert.equal(ida, `<?xml version="1.0" encoding="UTF-8"?>${assinado}`);
  assert.throws(() => n.lerCertificadoPfx(pfxDeTeste(), 'senha-errada'), /certificado/);
});

test('cancelamento e101101: Id com 62 caracteres, nPedRegEvento e validações', () => {
  const chave = '5'.repeat(50);
  const { xml, id } = n.montarPedidoCancelamento(cfg, { chaveAcesso: chave, cMotivo: 2, xMotivo: 'Serviço não foi prestado ao cliente' });
  assert.equal(id, `PRE${chave}101101001`);
  assert.equal(id.length, 62);
  assert.ok(xml.includes('<nPedRegEvento>1</nPedRegEvento>'));
  assert.ok(xml.indexOf('<chNFSe>') < xml.indexOf('<nPedRegEvento>') && xml.indexOf('<nPedRegEvento>') < xml.indexOf('<e101101>'));
  assert.throws(() => n.montarPedidoCancelamento(cfg, { chaveAcesso: chave, cMotivo: 5, xMotivo: 'x'.repeat(20) }), /Motivo/);
  assert.throws(() => n.montarPedidoCancelamento(cfg, { chaveAcesso: chave, cMotivo: 1, xMotivo: 'curto' }), /15/);
});

test('configuração: valida campos e recusa segredo no lugar do nome da variável', () => {
  assert.throws(() => n.normalizarConfigNfse({ cnpj: '123' }), /CNPJ/);
  assert.throws(() => n.normalizarConfigNfse({ envPfxBase64: 'MIIK...base64' }), /NOME da variável/);
  const p = n.prontidaoNfse(n.normalizarConfigNfse({ cnpj: '50073355000260' }), {});
  assert.equal(p.pronto, false);
  assert.ok(p.pendencias.some((x) => /Inscrição municipal/.test(x)));
});

test('erros da Sefin são normalizados sem diferenciar maiúsculas', () => {
  assert.deepEqual(n.normalizarErros({ erros: [{ Codigo: 'E0004', Descricao: 'Id inválido' }] }), [{ codigo: 'E0004', descricao: 'Id inválido', complemento: undefined }]);
  assert.deepEqual(n.normalizarErros({ erro: { codigo: 'E999', descricao: 'Erro não catalogado' } })[0].codigo, 'E999');
});

test('serviço do documento: só serviços, desconto proporcional e cTribNac por serviço', () => {
  const doc = { desconto: 10, itens: [{ tipo: 'servico', descricao: 'Corte', total: 60, referenciaId: 'srv-1', quantidade: 1 }, { tipo: 'servico', descricao: 'Barba', total: 40, referenciaId: 'srv-2', quantidade: 1 }, { tipo: 'produto', descricao: 'Pomada', total: 100, referenciaId: 'rev-1' }] };
  const s = n.servicoDoDocumento(doc, cfg);
  assert.equal(s.valor, 95); // 100 de serviço − 10 × (100/200)
  assert.equal(s.cTribNac, '060101');
  assert.equal(s.descricao, 'Corte; Barba.');
  const misto = n.normalizarConfigNfse({ ...cfg, cTribNacPorServico: { 'srv-2': '060102' } });
  assert.throws(() => n.servicoDoDocumento(doc, misto), /códigos de tributação diferentes/);
  assert.throws(() => n.servicoDoDocumento({ itens: [{ tipo: 'produto', total: 10 }] }, cfg), /NFC-e/);
});

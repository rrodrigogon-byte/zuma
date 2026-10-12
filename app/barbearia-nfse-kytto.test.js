import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { reset } from './db.js';
import * as fiscal from './barbearia-fiscal-kytto.js';
import * as nfseBarbearia from './barbearia-nfse-kytto.js';
import * as n from './core/nfse-nacional.js';
import { pfxDeTeste } from './core/nfse-teste-certificado.js';
import { XML_NFSE } from './core/nfse-danfse-fixture.js';

const EMPRESA = 'empresa-nfse';
const PFX = pfxDeTeste('s3nha');
const ENV = { NFSE_PFX_B64_DINO: PFX, NFSE_PFX_SENHA_DINO: 's3nha' };

beforeEach(() => reset());
afterEach(() => reset());

function configurar(extra = {}) {
  return nfseBarbearia.atualizarConfiguracao(EMPRESA, { ativo: true, cnpj: '50073355000260', inscricaoMunicipal: '12345', cTribNacPadrao: '060101', envPfxBase64: 'NFSE_PFX_B64_DINO', envPfxSenha: 'NFSE_PFX_SENHA_DINO', ...extra }, ENV);
}

function documento(id = 'cmd-1') {
  return fiscal.prepararDocumentoFiscal(EMPRESA, { confirmado: true, lojaId: 'loja-1', origemTipo: 'comanda', origemId: id, chaveIdempotencia: `k-${id}`, total: 130, itens: [{ tipo: 'servico', descricao: 'Corte', valorUnitario: 80, total: 80, referenciaId: 'srv-1' }, { tipo: 'produto', descricao: 'Pomada', valorUnitario: 50, total: 50, referenciaId: 'rev-1' }] }).documento;
}

// Sefin falsa: registra as chamadas e responde conforme o roteiro.
function sefinFalsa(roteiro) {
  const chamadas = [];
  const factory = () => async (req) => { chamadas.push(req); return roteiro(req, chamadas.length); };
  return { factory, chamadas };
}

test('configuração não aceita segredo no banco e exige homologação antes de produção', () => {
  assert.throws(() => nfseBarbearia.atualizarConfiguracao(EMPRESA, { pfx: 'MIIK' }, ENV), /variáveis de ambiente/);
  const r = configurar();
  assert.equal(r.prontidao.pronto, true);
  assert.equal(r.configuracao.ambiente, 'producao_restrita');
  assert.throws(() => configurar({ ambiente: 'producao' }), /produção restrita/);
  assert.equal(nfseBarbearia.configuracaoPublica(EMPRESA, {}).prontidao.pronto, false);
});

test('emite NFS-e: DPS assinada, só serviços, numeração e idempotência', async () => {
  configurar();
  const doc = documento();
  const cert = n.lerCertificadoPfx(PFX, 's3nha');
  const { factory, chamadas } = sefinFalsa((req) => {
    assert.equal(req.metodo, 'POST');
    assert.equal(req.url, 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse');
    const xml = n.gunzipB64(req.corpo.dpsXmlGZipB64);
    assert.ok(n.verificarAssinatura(xml.replace(/^<\?xml[^>]*>/, ''), cert.certPem));
    assert.ok(xml.includes('<vServ>80.00</vServ>'), 'produto fica fora da NFS-e');
    assert.ok(xml.includes('<nDPS>1</nDPS>'));
    return { status: 201, corpo: { chaveAcesso: '5'.repeat(50), idDps: 'x', nfseXmlGZipB64: n.gzipB64('<NFSe/>'), alertas: [] } };
  });
  const r = await nfseBarbearia.emitirNfse(EMPRESA, doc.id, { env: ENV, transporteFactory: factory });
  assert.equal(r.documento.nfse.status, 'autorizada');
  assert.equal(r.documento.status, 'nfse_autorizada');
  assert.equal(r.documento.nfse.chaveAcesso, '5'.repeat(50));
  assert.equal(nfseBarbearia.xmlNfse(EMPRESA, doc.id), '<?xml version="1.0" encoding="UTF-8"?><NFSe/>');
  const de_novo = await nfseBarbearia.emitirNfse(EMPRESA, doc.id, { env: ENV, transporteFactory: factory });
  assert.equal(de_novo.idempotente, true);
  assert.equal(chamadas.length, 1);
  assert.equal(nfseBarbearia.documentoParaPainel(de_novo.documento).nfse.nfseXmlGZipB64, undefined);
  // Próximo documento usa o número seguinte.
  const doc2 = documento('cmd-2');
  const segunda = sefinFalsa((req) => { assert.ok(n.gunzipB64(req.corpo.dpsXmlGZipB64).includes('<nDPS>2</nDPS>')); return { status: 201, corpo: { chaveAcesso: '6'.repeat(50) } }; });
  await nfseBarbearia.emitirNfse(EMPRESA, doc2.id, { env: ENV, transporteFactory: segunda.factory });
});

test('rejeição guarda os erros e o reenvio reaproveita o mesmo número', async () => {
  configurar();
  const doc = documento();
  const rejeita = sefinFalsa(() => ({ status: 400, corpo: { erros: [{ Codigo: 'E0004', Descricao: 'Id da DPS inválido' }] } }));
  const r = await nfseBarbearia.emitirNfse(EMPRESA, doc.id, { env: ENV, transporteFactory: rejeita.factory });
  assert.equal(r.rejeitada, true);
  assert.equal(r.erros[0].codigo, 'E0004');
  assert.equal(r.documento.nfse.status, 'rejeitada');
  const aceita = sefinFalsa((req) => { assert.ok(n.gunzipB64(req.corpo.dpsXmlGZipB64).includes('<nDPS>1</nDPS>')); return { status: 201, corpo: { chaveAcesso: '7'.repeat(50) } }; });
  const ok = await nfseBarbearia.emitirNfse(EMPRESA, doc.id, { env: ENV, transporteFactory: aceita.factory });
  assert.equal(ok.documento.nfse.status, 'autorizada');
});

test('falha de comunicação: o reenvio consulta a DPS antes de emitir de novo', async () => {
  configurar();
  const doc = documento();
  const cai = sefinFalsa(() => { throw new Error('ECONNRESET'); });
  await assert.rejects(nfseBarbearia.emitirNfse(EMPRESA, doc.id, { env: ENV, transporteFactory: cai.factory }), /comunicação/);
  assert.equal(fiscal.obterDocumentoFiscal(EMPRESA, doc.id).nfse.status, 'falha_comunicacao');
  const recupera = sefinFalsa((req, i) => { assert.equal(req.metodo, 'GET'); if (i === 1) assert.match(req.url, /\/dps\/DPS\d{42}$/); return { status: 200, corpo: { chaveAcesso: '8'.repeat(50) } }; });
  const r = await nfseBarbearia.emitirNfse(EMPRESA, doc.id, { env: ENV, transporteFactory: recupera.factory });
  assert.equal(r.idempotente, true);
  assert.equal(r.documento.nfse.chaveAcesso, '8'.repeat(50));
  assert.ok(recupera.chamadas.every((c) => c.metodo === 'GET'), 'não reenviou a DPS');
});

test('cancelamento registra o evento e libera a produção após o ciclo em produção restrita', async () => {
  configurar();
  const doc = documento();
  await nfseBarbearia.emitirNfse(EMPRESA, doc.id, { env: ENV, transporteFactory: sefinFalsa(() => ({ status: 201, corpo: { chaveAcesso: '9'.repeat(50) } })).factory });
  const evento = sefinFalsa((req) => {
    assert.equal(req.url, `https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse/${'9'.repeat(50)}/eventos`);
    const xml = n.gunzipB64(req.corpo.pedidoRegistroEventoXmlGZipB64);
    assert.ok(xml.includes('<cMotivo>1</cMotivo>') && xml.includes(`Id="PRE${'9'.repeat(50)}101101001"`));
    return { status: 201, corpo: { eventoXmlGZipB64: n.gzipB64('<evento/>') } };
  });
  await assert.rejects(nfseBarbearia.cancelarNfse(EMPRESA, 'inexistente', { cMotivo: 1, xMotivo: 'Erro na emissão do valor', env: ENV }), /autorizada/);
  const c = await nfseBarbearia.cancelarNfse(EMPRESA, doc.id, { cMotivo: 1, xMotivo: 'Teste de homologação da integração', env: ENV, transporteFactory: evento.factory });
  assert.equal(c.cancelada, true);
  assert.equal(c.documento.nfse.status, 'cancelada');
  assert.ok(fiscal.obterConfigNfse(EMPRESA).homologadoEm);
  assert.equal(configurar({ ambiente: 'producao' }).configuracao.ambiente, 'producao');
  await assert.rejects(nfseBarbearia.emitirNfse(EMPRESA, doc.id, { env: ENV }), /cancelada/);
});

test('emissão desativada ou sem certificado não chama a Sefin', async () => {
  configurar({ ativo: false });
  const doc = documento();
  const s = sefinFalsa(() => ({ status: 201, corpo: {} }));
  await assert.rejects(nfseBarbearia.emitirNfse(EMPRESA, doc.id, { env: ENV, transporteFactory: s.factory }), /desativada/);
  configurar({ ativo: true });
  await assert.rejects(nfseBarbearia.emitirNfse(EMPRESA, doc.id, { env: {}, transporteFactory: s.factory }), /incompleta/);
  assert.equal(s.chamadas.length, 0);
});

test('nota recuperada sem XML: sincroniza pela chave e então imprime o DANFSe', async () => {
  configurar();
  const doc = documento();
  const chave = '51079582250073355000260000000000000126101234567890';
  await nfseBarbearia.emitirNfse(EMPRESA, doc.id, { env: ENV, transporteFactory: sefinFalsa(() => ({ status: 201, corpo: { chaveAcesso: chave } })).factory });
  await assert.rejects(nfseBarbearia.danfseHtml(EMPRESA, doc.id), /Atualizar da Sefin/);
  const consulta = sefinFalsa((req) => {
    assert.equal(req.metodo, 'GET');
    assert.equal(req.url, `https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse/${chave}`);
    return { status: 200, corpo: { chaveAcesso: chave, nfseXmlGZipB64: n.gzipB64(XML_NFSE.replace(/^<\?xml[^>]*>/, '')) } };
  });
  const s = await nfseBarbearia.sincronizarNfse(EMPRESA, doc.id, { env: ENV, transporteFactory: consulta.factory });
  assert.equal(s.xmlObtido, true);
  assert.equal(nfseBarbearia.documentoParaPainel(s.documento).nfse.xmlDisponivel, true);
  const html = await nfseBarbearia.danfseHtml(EMPRESA, doc.id);
  assert.ok(html.includes('DANFSe') && html.includes('SEM VALOR FISCAL'));
  await assert.rejects(nfseBarbearia.sincronizarNfse(EMPRESA, documento('cmd-9').id, { env: ENV }), /chave de acesso/);
});

test('recuperação após falha de comunicação já baixa o XML da nota', async () => {
  configurar();
  const doc = documento();
  await assert.rejects(nfseBarbearia.emitirNfse(EMPRESA, doc.id, { env: ENV, transporteFactory: sefinFalsa(() => { throw new Error('timeout'); }).factory }));
  const recupera = sefinFalsa((req) => (req.url.includes('/dps/') ? { status: 200, corpo: { chaveAcesso: '8'.repeat(50) } } : { status: 200, corpo: { nfseXmlGZipB64: n.gzipB64('<NFSe/>') } }));
  const r = await nfseBarbearia.emitirNfse(EMPRESA, doc.id, { env: ENV, transporteFactory: recupera.factory });
  assert.equal(recupera.chamadas.length, 2);
  assert.equal(nfseBarbearia.documentoParaPainel(r.documento).nfse.xmlDisponivel, true);
});

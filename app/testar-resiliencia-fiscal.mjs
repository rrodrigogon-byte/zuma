import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.DB_PATH = `/tmp/kytto-fiscal-resiliencia-${Date.now()}.json`;
process.env.GCS_BUCKET = '';
process.env.FISCAL_CERT_MASTER_KEY = 'chave-de-teste-fiscal-com-mais-de-24-caracteres';

const fiscal = await import('./fiscal-kytto.js');
const fiscalXml = await import('./fiscal-xml-kytto.js');
const { gerarRepresentacaoAuxiliarNfce } = await import('./representacao-fiscal-kytto.js');
const { db } = await import('./db.js');

let total = 0;
async function testar(nome, fn) {
  try { await fn(); total += 1; console.log(`✓ ${nome}`); }
  catch (erro) { console.error(`✗ ${nome}: ${erro.message}`); process.exitCode = 1; }
}

const tenant = 'empresa-resiliencia';
const cnpj = '13246882000111';
fiscal.salvarConfiguracaoFiscal(tenant, {
  cnpj, ie: '123456789', razaoSocial: 'Empresa Fiscal Teste', nomeFantasia: 'Kytto Teste', uf: 'MT',
  regimeTributario: 'simples', crt: '1', ambiente: 'homologacao', serieNfce: 1,
  endereco: { logradouro: 'Rua Teste', numero: '1', bairro: 'Centro', cidade: 'Cuiabá', codigoMunicipio: '5103403', cep: '78000000' },
});
const estado = db();
estado.fiscalKytto.certificados['cert-resiliencia'] = { id: 'cert-resiliencia', tenantId: tenant, cnpj, ativo: true, validTo: '2027-12-31T00:00:00.000Z', fingerprint: crypto.createHash('sha256').update('resiliencia').digest('hex') };
estado.fiscalKytto.configuracoes[tenant].certificadoAtivoId = 'cert-resiliencia';

const documento = fiscal.criarDocumentoFiscalRascunho(tenant, { valorTotal: 10, itens: [{ produtoId: 'p1' }], pagamentos: [{ meio: 'dinheiro', valor: 10 }] }, { modelo: '65', origemId: 'comanda-resiliencia-001' });
const chave = documento.chaveAcesso;
const config = fiscal.obterConfiguracaoFiscal(tenant);
const item = {
  produtoId: 'p1', descricao: 'Produto de Teste', quantidade: 1, valorUnitario: 10, valorProduto: 10, desconto: 0,
  fiscal: { ncm: '22030000', cfop: '5102', origem: '0', unidadeTributavel: 'UN', csosn: '102', cstPis: '49', cstCofins: '49' },
  icms: { origem: '0', csosn: '102', baseCalculo: 10, aliquota: 0, valor: 0, baseSt: 0, aliquotaSt: 0, valorSt: 0, aliquotaFcp: 0, valorFcp: 0 },
  pis: { cst: '49', baseCalculo: 10, aliquota: 0, valor: 0 }, cofins: { cst: '49', baseCalculo: 10, aliquota: 0, valor: 0 },
};
const totais = { valorProdutos: 10, desconto: 0, baseIcms: 10, valorIcms: 0, baseSt: 0, valorSt: 0, valorFcp: 0, valorPis: 0, valorCofins: 0, valorTotal: 10 };
const xml = fiscalXml.montarXmlFiscalV400({
  config, modelo: '65', numero: documento.numero, serie: documento.serie, chaveAcesso: chave, codigoNumerico: documento.codigoNumerico,
  itens: [item], totais, pagamentos: [{ meio: 'dinheiro', valor: 10 }],
  qrCodeUrl: 'https://homologacao.sefaz.mt.gov.br/nfce/qrcode', urlChave: 'https://homologacao.sefaz.mt.gov.br/nfce/consultanfce', qrCodeVersao: '3',
});
fiscal.atualizarDocumentoFiscalRascunho(tenant, documento.id, {
  status: 'validado_local', itens: [item], pagamentos: [{ meio: 'dinheiro', valor: 10 }], tributos: totais, valorTotal: 10,
  xmlBruto: xml, xmlAssinado: xml, hashXmlAssinado: crypto.createHash('sha256').update(xml).digest('hex'), schema: { versao: 'teste' }, validacao: { valido: true, erros: [] },
});

await testar('gera representação auxiliar marcada como rascunho sem valor fiscal', async () => {
  const html = await gerarRepresentacaoAuxiliarNfce({ xmlAssinado: xml, documento: { ambiente: 'homologacao', hashXmlAssinado: crypto.createHash('sha256').update(xml).digest('hex') } });
  assert.match(html, /REPRESENTAÇÃO AUXILIAR DE NFC-e/);
  assert.match(html, /SEM VALOR FISCAL/);
  assert.match(html, /Produto de Teste/);
});

await testar('arquiva XML assinado com retenção mínima de cinco anos', () => {
  const arquivo = fiscal.arquivarDocumentoFiscal(tenant, documento.id);
  assert.equal(arquivo.imutavel, true);
  assert.ok(new Date(arquivo.retencaoAte) > new Date(Date.now() + (365 * 4 * 86400000)));
  assert.equal(fiscal.listarArquivosFiscais(tenant, documento.id).length, 1);
});

await testar('bloqueia alteração de XML após o registro da guarda legal', () => {
  assert.throws(() => fiscal.atualizarDocumentoFiscalRascunho(tenant, documento.id, { xmlAssinado: '<NFe/>' }), /guarda legal/);
});

await testar('registra intenção de evento sem efeito perante a SEFAZ', () => {
  const evento = fiscal.registrarEventoInternoFiscal(tenant, documento.id, 'intencao_cancelamento', { motivo: 'Teste de auditoria' });
  assert.equal(evento.natureza, 'interna_sem_efeito_sefaz');
});

await testar('enfileira e resolve contingência interna sem transmissão automática', () => {
  const contingencia = fiscal.enfileirarContingenciaFiscal(tenant, documento.id, { motivo: 'Falha de conectividade simulada', usuario: 'teste@kytto.local' });
  assert.equal(contingencia.status, 'pendente');
  assert.match(contingencia.bloqueio, /Nenhuma transmissão automática/);
  const resolvida = fiscal.resolverContingenciaInterna(tenant, contingencia.id, { observacao: 'Conectividade restaurada', usuario: 'teste@kytto.local' });
  assert.equal(resolvida.status, 'resolvida');
});

await testar('expõe métricas de guarda, contingência e certificado sem segredos', () => {
  const observabilidade = fiscal.obterObservabilidadeFiscal(tenant);
  assert.equal(observabilidade.arquivoLegal.conforme, true);
  assert.equal(observabilidade.contingencia.pendentes, 0);
  assert.equal(observabilidade.contingencia.transmissaoAutomatica, false);
  assert.equal(observabilidade.certificado.alerta, false);
});

if (!process.exitCode) console.log(`\n✅ Resiliência fiscal: ${total} testes passaram`);
process.exit(process.exitCode || 0);

import crypto from 'crypto';
import {
  carregarMaterialAtivo,
  gerarChaveAcessoFiscal,
  obterUrlsNfce,
} from './fiscal-kytto.js';
import { totalizarDocumentoFiscal } from './tributacao-kytto.js';
import {
  montarXmlFiscalV400,
  assinarXmlFiscal,
  validarXmlFiscal,
  verificarAssinaturaXmlFiscal,
} from './fiscal-xml-kytto.js';

const tenantId = process.env.FISCAL_TENANT_ID || 'empresa-emp-kytto-001';

function fail(message) {
  console.error(JSON.stringify({ ok: false, erro: message }, null, 2));
  process.exit(1);
}

try {
  const { config, cert, pfx, password } = await carregarMaterialAtivo(tenantId);
  const urls = obterUrlsNfce(config.uf, config.ambiente);
  const dataEmissao = new Date();
  const numero = 999999;
  const serie = Number(config.serieNfce || 1);
  const codigoNumerico = '12345678';
  const chaveAcesso = gerarChaveAcessoFiscal({
    uf: config.uf,
    dhEmi: dataEmissao.toISOString(),
    cnpj: config.cnpj,
    modelo: '65',
    serie,
    numero,
    codigoNumerico,
  });
  const item = {
    produtoId: 'teste-isolado-001',
    descricao: 'DOCUMENTO DE TESTE TECNICO — SEM VALOR FISCAL',
    quantidade: 1,
    valorUnitario: 1.00,
    fiscal: {
      ncm: '22030000',
      cfop: '5102',
      origem: '0',
      unidadeTributavel: 'UN',
      csosn: '102',
      cstPis: '49',
      cstCofins: '49',
    },
  };
  const calculo = totalizarDocumentoFiscal([item], {
    regimeTributario: config.regimeTributario,
    exigirNcm: true,
  });
  const xmlBruto = montarXmlFiscalV400({
    config,
    modelo: '65',
    numero,
    serie,
    chaveAcesso,
    codigoNumerico,
    dataEmissao: dataEmissao.toISOString(),
    itens: calculo.itens,
    totais: calculo.totais,
    pagamentos: [{ meio: 'dinheiro', valor: calculo.totais.valorTotal }],
    qrCodeUrl: urls.qrCodeUrl,
    urlChave: urls.urlChave,
    qrCodeVersao: urls.versaoQrCode,
  });
  const assinado = assinarXmlFiscal(xmlBruto, { pfx, password });
  const assinatura = verificarAssinaturaXmlFiscal(assinado.xml, assinado.certificadoPem);
  const validacao = validarXmlFiscal(assinado.xml);
  if (!assinatura.valida) fail(`Assinatura XMLDSig inválida: ${assinatura.erros.join(' | ')}`);
  if (!validacao.estrutura.valido) fail(`Estrutura XML inválida: ${validacao.estrutura.erros.join(' | ')}`);
  if (!validacao.xsd.valido) fail(`XSD inválido: ${validacao.xsd.erros.join(' | ')}`);

  console.log(JSON.stringify({
    ok: true,
    escopo: 'validacao_isolada_sem_transmissao_e_sem_persistencia',
    tenantId,
    ambiente: config.ambiente,
    emitente: {
      cnpj: config.cnpj,
      uf: config.uf,
      ie: config.ie,
    },
    certificado: {
      id: cert.id,
      commonName: cert.commonName,
      validoAte: cert.validTo,
      fingerprintSha256: cert.fingerprint,
    },
    documento: {
      modelo: '65',
      chaveAcesso,
      valorTotal: calculo.totais.valorTotal,
      sha256XmlAssinado: crypto.createHash('sha256').update(assinado.xml, 'utf8').digest('hex'),
    },
    validacoes: {
      assinaturaXmlDsig: assinatura.valida,
      estruturaXml: validacao.estrutura.valido,
      schemaXsdOficial: validacao.xsd.valido,
      qrCodeV3: true,
    },
  }, null, 2));
} catch (error) {
  fail(error.message);
}

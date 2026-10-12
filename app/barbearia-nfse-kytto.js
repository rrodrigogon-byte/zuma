// KYTTO — Emissão de NFS-e Nacional a partir dos documentos fiscais da Barbearia.
// Orquestra configuração, numeração, assinatura, envio, reconsulta e cancelamento.
// Só a gestão aciona; nada é enviado sem confirmação explícita.

import * as fiscal from './barbearia-fiscal-kytto.js';
import * as nfse from './core/nfse-nacional.js';
import { gerarDanfseHtml } from './core/nfse-danfse.js';

const CAMPOS_SEGREDO = ['pfx', 'pfxBase64', 'senha', 'password', 'certificado'];

export function configuracaoPublica(empresaId, env = process.env) {
  const cfg = nfse.normalizarConfigNfse({}, fiscal.obterConfigNfse(empresaId));
  return { configuracao: cfg, prontidao: nfse.prontidaoNfse(cfg, env) };
}

export function atualizarConfiguracao(empresaId, entrada = {}, env = process.env) {
  if (CAMPOS_SEGREDO.some((k) => Object.prototype.hasOwnProperty.call(entrada, k))) {
    throw new nfse.NfseError('O certificado e a senha não são gravados no banco: cadastre-os como variáveis de ambiente e informe aqui só o nome delas.', 'NFSE_SEGREDO_NO_BANCO');
  }
  const atual = fiscal.obterConfigNfse(empresaId);
  const { proximoNumero, ...semNumero } = entrada; // numeração não é editável pela tela
  const cfg = nfse.normalizarConfigNfse(semNumero, atual);
  if (cfg.ambiente === 'producao' && !atual.homologadoEm) {
    throw new nfse.NfseError('Antes de usar produção, emita e cancele uma NFS-e em produção restrita.', 'NFSE_HOMOLOGACAO_PENDENTE');
  }
  fiscal.salvarConfigNfse(empresaId, { ...atual, ...cfg, proximoNumero: atual.proximoNumero || cfg.proximoNumero, homologadoEm: atual.homologadoEm || null });
  return configuracaoPublica(empresaId, env);
}

function contexto(empresaId, env, transporteFactory) {
  const cfg = nfse.normalizarConfigNfse({}, fiscal.obterConfigNfse(empresaId));
  const prontidao = nfse.prontidaoNfse(cfg, env);
  if (!prontidao.pronto) throw new nfse.NfseError(`Configuração da NFS-e incompleta: ${prontidao.pendencias.join(', ')}.`, 'NFSE_CONFIG_INCOMPLETA', prontidao);
  if (!cfg.ativo) throw new nfse.NfseError('A emissão de NFS-e está desativada na configuração.', 'NFSE_DESATIVADA');
  const cert = nfse.certificadoDoAmbiente(cfg, env);
  const transporte = (transporteFactory || nfse.transporteHttps)({ certPem: cert.certPem, keyPem: cert.keyPem });
  return { cfg, cert, cliente: nfse.clienteSefin(cfg, transporte) };
}

export async function consultarConvenio(empresaId, { env = process.env, transporteFactory } = {}) {
  const cfg = nfse.normalizarConfigNfse({}, fiscal.obterConfigNfse(empresaId));
  const cert = nfse.certificadoDoAmbiente(cfg, env);
  const cliente = nfse.clienteSefin(cfg, (transporteFactory || nfse.transporteHttps)({ certPem: cert.certPem, keyPem: cert.keyPem }));
  return cliente.convenioMunicipio(cfg.codigoMunicipio);
}

export async function emitirNfse(empresaId, documentoId, { tomador = null, usuario = '', servicos = [], env = process.env, transporteFactory, agora = new Date() } = {}) {
  const documento = fiscal.obterDocumentoFiscal(empresaId, documentoId);
  if (!documento) throw new nfse.NfseError('Documento fiscal não encontrado.', 'NFSE_DOCUMENTO_INEXISTENTE');
  if (documento.nfse?.status === 'autorizada') return { idempotente: true, documento };
  if (documento.nfse?.status === 'cancelada') throw new nfse.NfseError('A NFS-e deste documento foi cancelada.', 'NFSE_CANCELADA');
  const { cfg, cert, cliente } = contexto(empresaId, env, transporteFactory);

  // Reenvio após falha/timeout: a mesma DPS pode já ter virado NFS-e.
  if (documento.nfse?.idDps && ['enviando', 'falha_comunicacao'].includes(documento.nfse.status)) {
    const c = await cliente.consultarDps(documento.nfse.idDps).catch(() => null);
    if (c?.chaveAcesso) {
      const xmlRecuperado = await cliente.consultarPorChave(c.chaveAcesso).then((r) => r?.corpo?.nfseXmlGZipB64 || r?.corpo?.NfseXmlGZipB64 || null).catch(() => null);
      const atualizado = fiscal.atualizarNfseDocumento(empresaId, documentoId, { status: 'autorizada', chaveAcesso: c.chaveAcesso, ambiente: cfg.ambiente, recuperadaEm: agora.toISOString(), ...(xmlRecuperado ? { nfseXmlGZipB64: xmlRecuperado } : {}) });
      return { idempotente: true, documento: atualizado };
    }
  }

  const servico = nfse.servicoDoDocumento(documento, cfg, servicos);
  const numero = documento.nfse?.numero && documento.nfse?.status !== 'autorizada' ? documento.nfse.numero : fiscal.reservarNumeroDps(empresaId);
  const dps = nfse.montarDpsXml(cfg, { numero, dataEmissao: agora, competencia: String(documento.criadoEm || agora.toISOString()).slice(0, 10), tomador, servico: { cTribNac: servico.cTribNac, descricao: servico.descricao }, valorServico: servico.valor });
  const assinado = nfse.assinarElemento(dps.xml, 'infDPS', cert);
  fiscal.atualizarNfseDocumento(empresaId, documentoId, { status: 'enviando', numero, serie: cfg.serie, idDps: dps.idDps, ambiente: cfg.ambiente, valorServico: servico.valor, cTribNac: servico.cTribNac, enviadoPor: usuario, enviadoEm: agora.toISOString(), tomadorIdentificado: Boolean(tomador?.cpf || tomador?.cnpj) });

  let resposta;
  try {
    resposta = await cliente.emitir(assinado);
  } catch (error) {
    fiscal.atualizarNfseDocumento(empresaId, documentoId, { status: 'falha_comunicacao', erro: String(error.message).slice(0, 300) });
    throw new nfse.NfseError('Falha de comunicação com a Sefin Nacional. Tente de novo: o sistema confere se a nota já foi gerada antes de reenviar.', 'NFSE_FALHA_COMUNICACAO');
  }
  if (!resposta.ok) {
    const atualizado = fiscal.atualizarNfseDocumento(empresaId, documentoId, { status: 'rejeitada', erros: resposta.erros });
    return { idempotente: false, rejeitada: true, erros: resposta.erros, documento: atualizado };
  }
  const atualizado = fiscal.atualizarNfseDocumento(empresaId, documentoId, {
    status: 'autorizada', chaveAcesso: resposta.chaveAcesso, nfseXmlGZipB64: resposta.nfseXmlGZipB64, alertas: resposta.alertas, autorizadaEm: resposta.processadoEm || agora.toISOString(), erros: [],
  });
  return { idempotente: false, documento: atualizado };
}

export async function cancelarNfse(empresaId, documentoId, { cMotivo, xMotivo, usuario = '', env = process.env, transporteFactory, agora = new Date() } = {}) {
  const documento = fiscal.obterDocumentoFiscal(empresaId, documentoId);
  if (!documento?.nfse?.chaveAcesso || documento.nfse.status !== 'autorizada') throw new nfse.NfseError('Só NFS-e autorizada pode ser cancelada.', 'NFSE_NAO_AUTORIZADA');
  const { cfg, cert, cliente } = contexto(empresaId, env, transporteFactory);
  const seq = Number(documento.nfse.eventosCancelamento || 0) + 1;
  const pedido = nfse.montarPedidoCancelamento(cfg, { chaveAcesso: documento.nfse.chaveAcesso, cMotivo, xMotivo, dataEvento: agora, nPedRegEvento: seq });
  const assinado = nfse.assinarElemento(pedido.xml, 'infPedReg', cert);
  const resposta = await cliente.registrarEvento(documento.nfse.chaveAcesso, assinado);
  if (!resposta.ok) {
    fiscal.atualizarNfseDocumento(empresaId, documentoId, { eventosCancelamento: seq, ultimoErroCancelamento: resposta.erros });
    return { cancelada: false, erros: resposta.erros };
  }
  const atualizado = fiscal.atualizarNfseDocumento(empresaId, documentoId, { status: 'cancelada', eventosCancelamento: seq, canceladaEm: agora.toISOString(), canceladaPor: usuario, motivoCancelamento: { cMotivo: String(cMotivo), xMotivo }, eventoXmlGZipB64: resposta.eventoXmlGZipB64 });
  // Primeiro ciclo emitir+cancelar em produção restrita libera o uso de produção.
  if (cfg.ambiente === 'producao_restrita') {
    const atual = fiscal.obterConfigNfse(empresaId);
    if (!atual.homologadoEm) fiscal.salvarConfigNfse(empresaId, { ...atual, homologadoEm: agora.toISOString() });
  }
  return { cancelada: true, documento: atualizado };
}

// Reconsulta a NFS-e na Sefin pela chave: baixa o XML quando ainda não foi
// guardado (ex.: nota recuperada após falha de comunicação) e registra a
// situação devolvida. Só leitura na Sefin; nada é emitido ou cancelado aqui.
export async function sincronizarNfse(empresaId, documentoId, { env = process.env, transporteFactory, agora = new Date() } = {}) {
  const documento = fiscal.obterDocumentoFiscal(empresaId, documentoId);
  if (!documento?.nfse?.chaveAcesso) throw new nfse.NfseError('Este documento ainda não tem NFS-e com chave de acesso.', 'NFSE_SEM_CHAVE');
  const cfg = nfse.normalizarConfigNfse({}, fiscal.obterConfigNfse(empresaId));
  const cert = nfse.certificadoDoAmbiente(cfg, env);
  const cliente = nfse.clienteSefin({ ...cfg, ambiente: documento.nfse.ambiente || cfg.ambiente }, (transporteFactory || nfse.transporteHttps)({ certPem: cert.certPem, keyPem: cert.keyPem }));
  const r = await cliente.consultarPorChave(documento.nfse.chaveAcesso);
  if (r.status < 200 || r.status >= 300) return { sincronizada: false, erros: r.erros.length ? r.erros : [{ codigo: String(r.status), descricao: 'A Sefin não devolveu a NFS-e.' }], documento };
  const xmlB64 = r.corpo?.nfseXmlGZipB64 || r.corpo?.NfseXmlGZipB64 || null;
  const patch = { sincronizadaEm: agora.toISOString() };
  if (xmlB64) patch.nfseXmlGZipB64 = xmlB64;
  const atualizado = fiscal.atualizarNfseDocumento(empresaId, documentoId, patch);
  return { sincronizada: true, xmlObtido: Boolean(xmlB64), documento: atualizado };
}

export async function danfseHtml(empresaId, documentoId) {
  const documento = fiscal.obterDocumentoFiscal(empresaId, documentoId);
  if (!documento?.nfse?.nfseXmlGZipB64) throw new nfse.NfseError('XML da NFS-e indisponível: use "Atualizar da Sefin" para baixá-lo antes de imprimir.', 'NFSE_SEM_XML');
  return gerarDanfseHtml(nfse.gunzipB64(documento.nfse.nfseXmlGZipB64), { cancelada: documento.nfse.status === 'cancelada', canceladaEm: documento.nfse.canceladaEm, ambiente: documento.nfse.ambiente });
}

export function xmlNfse(empresaId, documentoId) {
  const documento = fiscal.obterDocumentoFiscal(empresaId, documentoId);
  if (!documento?.nfse?.nfseXmlGZipB64) throw new nfse.NfseError('XML da NFS-e indisponível para este documento.', 'NFSE_SEM_XML');
  return nfse.gunzipB64(documento.nfse.nfseXmlGZipB64);
}

// Retira campos volumosos/sensíveis antes de responder ao painel.
export function documentoParaPainel(documento) {
  if (!documento) return documento;
  const { nfseXmlGZipB64, eventoXmlGZipB64, ...nfseResumo } = documento.nfse || {};
  return { ...documento, nfse: documento.nfse ? { ...nfseResumo, xmlDisponivel: Boolean(nfseXmlGZipB64) } : undefined };
}

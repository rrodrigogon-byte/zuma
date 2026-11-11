/**
 * Motor TEF Multi-Maquininhas do Brasil
 * Suporte às principais adquirentes (Stone, PagBank, Cielo, Rede, Getnet, SafraPay, Mercado Pago, Vero/Sicredi, SiTef)
 * e bandeiras (Visa, Mastercard, Elo, Amex, Hipercard, Diners, Alelo, Pluxee/Sodexo, Ticket, VR, Pix no Pinpad).
 *
 * Regra de integridade:
 * - Zero terminais fictícios pré-cadastrados em código.
 * - Zero IPs locais simulados na nuvem (ex.: 192.168.1.150:4000) ou pings inventados.
 * - Taxas MDR vêm exclusivamente do contrato cadastrado pela empresa em Configurações › TEF.
 */

import crypto from 'node:crypto';
import { db } from '../db.js';

export const ADQUIRENTES_BRASIL = [
  {
    id: 'stone',
    nome: 'Stone / Ton',
    razaoSocial: 'Stone Pagamentos S.A.',
    protocolo: 'Stone Connect / SiTef / Webhook API',
    modelosMaquininhas: ['Stone Smart P2', 'Ton T3 Smart', 'Ton T3 Pro', 'Pinpad Gertec PPC930'],
    taxasPadrao: null,
    exigeTaxaContrato: true,
    prazoLiquidacao: { debito: 'D+1', credito_avista: 'D+30', credito_parcelado: 'D+30', pix: 'D+0' },
    cor: '#00A868',
    ativoPadrao: false,
  },
  {
    id: 'pagbank',
    nome: 'PagBank / PagSeguro',
    razaoSocial: 'PagSeguro Internet S.A.',
    protocolo: 'PlugPag / Prototec / SiTef',
    modelosMaquininhas: ['Moderninha Pro 2', 'Moderninha Smart 2', 'Moderninha Plus 2', 'Pinpad PAX S300'],
    taxasPadrao: null,
    exigeTaxaContrato: true,
    prazoLiquidacao: { debito: 'D+0 (Na hora)', credito_avista: 'D+30', credito_parcelado: 'D+30', pix: 'D+0' },
    cor: '#00B488',
    ativoPadrao: false,
  },
  {
    id: 'cielo',
    nome: 'Cielo',
    razaoSocial: 'Cielo S.A.',
    protocolo: 'Cielo LIO / SiTef / Client TEF Cielo',
    modelosMaquininhas: ['Cielo LIO V2', 'Cielo Flash', 'Pinpad Gertec MP20', 'Ingenico Lane 3000'],
    taxasPadrao: null,
    exigeTaxaContrato: true,
    prazoLiquidacao: { debito: 'D+1', credito_avista: 'D+30', credito_parcelado: 'D+30', pix: 'D+0' },
    cor: '#0067B8',
    ativoPadrao: false,
  },
  {
    id: 'rede',
    nome: 'Rede (Itaú)',
    razaoSocial: 'Redecard S.A.',
    protocolo: 'Rede TEF / SiTef / Itaú Pagamentos',
    modelosMaquininhas: ['Maquininha Smart Rede', 'Rede Sem Fio', 'Pinpad Gertec PPC920'],
    taxasPadrao: null,
    exigeTaxaContrato: true,
    prazoLiquidacao: { debito: 'D+1', credito_avista: 'D+30', credito_parcelado: 'D+30', pix: 'D+0' },
    cor: '#FF6200',
    ativoPadrao: false,
  },
  {
    id: 'getnet',
    nome: 'Getnet (Santander)',
    razaoSocial: 'Getnet Adquirência e Serviços para Meios de Pagamento S.A.',
    protocolo: 'Getnet TEF / SiTef / POS Integrado',
    modelosMaquininhas: ['Getnet Smart', 'Getnet Clássica', 'Pinpad PAX D200'],
    taxasPadrao: null,
    exigeTaxaContrato: true,
    prazoLiquidacao: { debito: 'D+1', credito_avista: 'D+30', credito_parcelado: 'D+30', pix: 'D+0' },
    cor: '#CC0000',
    ativoPadrao: false,
  },
  {
    id: 'safrapay',
    nome: 'SafraPay',
    razaoSocial: 'Banco Safra S.A.',
    protocolo: 'SafraPay Connect / SiTef',
    modelosMaquininhas: ['SafraPay Smart', 'SafraPay Pro', 'Pinpad Gertec'],
    taxasPadrao: null,
    exigeTaxaContrato: true,
    prazoLiquidacao: { debito: 'D+1', credito_avista: 'D+30', credito_parcelado: 'D+30', pix: 'D+0' },
    cor: '#1B365D',
    ativoPadrao: false,
  },
  {
    id: 'mercadopago',
    nome: 'Mercado Pago',
    razaoSocial: 'Mercado Pago Instituição de Pagamento LTDA',
    protocolo: 'Mercado Pago Point API / Integrado',
    modelosMaquininhas: ['Point Smart 2', 'Point Pro 2', 'Point Mini'],
    taxasPadrao: null,
    exigeTaxaContrato: true,
    prazoLiquidacao: { debito: 'D+0 (Na hora)', credito_avista: 'D+30', credito_parcelado: 'D+30', pix: 'D+0' },
    cor: '#009EE3',
    ativoPadrao: false,
  },
  {
    id: 'vero_sicredi',
    nome: 'Vero / Sicredi Cartões',
    razaoSocial: 'Banrisul Cartões S.A. / Sicredi Cartões',
    protocolo: 'Vero TEF / SiTef Fiserv',
    modelosMaquininhas: ['Vero Smart', 'Sicredi POS', 'Pinpad Gertec PPC930'],
    taxasPadrao: null,
    exigeTaxaContrato: true,
    prazoLiquidacao: { debito: 'D+1', credito_avista: 'D+30', credito_parcelado: 'D+30', pix: 'D+0' },
    cor: '#008542',
    ativoPadrao: false,
  },
  {
    id: 'sitef_fiserv',
    nome: 'SiTef (Software Express / Fiserv)',
    razaoSocial: 'Fiserv do Brasil Instituição de Pagamento LTDA',
    protocolo: 'SiTef DLL / Socket TCP/IP / Client Modular',
    modelosMaquininhas: [
      'Pinpads Gertec PPC900/PPC910/PPC920/PPC930',
      'Ingenico iPP320/Lane 3000',
      'Verifone Vx805/P400',
      'PAX S300/Q80',
    ],
    taxasPadrao: null,
    exigeTaxaContrato: true,
    prazoLiquidacao: { debito: 'D+1', credito_avista: 'D+30', credito_parcelado: 'D+30', pix: 'D+0' },
    cor: '#2D3748',
    ativoPadrao: false,
  },
];

export const BANDEIRAS_BRASIL = [
  { id: 'visa', nome: 'Visa', tipo: 'credito_debito', icone: '💳', cor: '#1A1F71' },
  { id: 'mastercard', nome: 'Mastercard', tipo: 'credito_debito', icone: '💳', cor: '#EB001B' },
  { id: 'elo', nome: 'Elo (Bandeira Nacional)', tipo: 'credito_debito', icone: '💳', cor: '#00A4E4' },
  { id: 'amex', nome: 'American Express', tipo: 'credito', icone: '💳', cor: '#002663' },
  { id: 'hipercard', nome: 'Hipercard', tipo: 'credito', icone: '💳', cor: '#B00000' },
  { id: 'hiper', nome: 'Hiper', tipo: 'credito', icone: '💳', cor: '#ED1C24' },
  { id: 'diners', nome: 'Diners Club', tipo: 'credito', icone: '💳', cor: '#004B87' },
  { id: 'cabal', nome: 'Cabal', tipo: 'credito_debito', icone: '💳', cor: '#005CA9' },
  { id: 'alelo', nome: 'Alelo', tipo: 'voucher', icone: '🍽️', cor: '#007A33' },
  { id: 'sodexo_pluxee', nome: 'Pluxee (Sodexo)', tipo: 'voucher', icone: '🍽️', cor: '#E2001A' },
  { id: 'sodexo', nome: 'Sodexo Benefícios', tipo: 'voucher', icone: '🍽️', cor: '#E2001A' },
  { id: 'ticket', nome: 'Ticket', tipo: 'voucher', icone: '🍽️', cor: '#ED1C24' },
  { id: 'vr', nome: 'VR Benefícios', tipo: 'voucher', icone: '🍽️', cor: '#008542' },
  { id: 'pix_pinpad', nome: 'Pix no TEF (QR Code Dinâmico)', tipo: 'pix', icone: '💠', cor: '#32BCAD' },
];

const TERMINAIS_FICTICIOS_LEGADOS_IDS = new Set(['term-dino-01', 'term-dino-02', 'term-dino-03']);
const SERIAIS_FICTICIOS_LEGADOS = new Set(['STN-MT-50073-01', 'PAG-MT-50073-02', 'VRO-MT-50073-03', 'STN-DINO-01']);
const MERCHANTS_FICTICIOS_LEGADOS = new Set(['984210772', 'PAG-50073355-DINO', 'SICREDI-AG0812-DINO']);

function ehTerminalFicticioLegado(t) {
  if (!t || typeof t !== 'object') return true;
  if (SERIAIS_FICTICIOS_LEGADOS.has(String(t.serialNumber || ''))) return true;
  if (MERCHANTS_FICTICIOS_LEGADOS.has(String(t.merchantId || ''))) return true;
  if (String(t.ipPorta || '') === '192.168.1.150:4000') return true;
  if (/^PPC-[A-Z0-9]{5}-01$/.test(String(t.serialNumber || ''))) return true;
  return false;
}

function criarConfiguracaoTefVazia(empresaId) {
  return {
    empresaId,
    configurado: false,
    status: 'nao_configurado',
    adquirentePadrao: null,
    modeloConexao: 'agente_local',
    agenteUrl: '',
    taxasCustomizadas: {},
    taxasNegociadas: {},
    adquirentesAtivas: [],
    terminais: [],
  };
}

export const CONFIGURACAO_PADRAO_DINO = criarConfiguracaoTefVazia(null);

function ensureTefStore() {
  const store = db();
  if (!store.tefTransacoes) {
    store.tefTransacoes = [];
  }
  store.tefTransacoes = store.tefTransacoes.filter(
    (t) =>
      !t.simulado &&
      t.status !== 'simulada' &&
      !TERMINAIS_FICTICIOS_LEGADOS_IDS.has(String(t.terminalId || '')) &&
      !SERIAIS_FICTICIOS_LEGADOS.has(String(t.terminalSerial || ''))
  );
  if (!store.tefConfiguracoes) {
    store.tefConfiguracoes = {};
  }
  for (const [empId, cfg] of Object.entries(store.tefConfiguracoes)) {
    if (!cfg || typeof cfg !== 'object') {
      store.tefConfiguracoes[empId] = criarConfiguracaoTefVazia(empId);
      continue;
    }
    const terminaisAntes = Array.isArray(cfg.terminais) ? cfg.terminais : [];
    const terminaisLimpos = terminaisAntes.filter((t) => !ehTerminalFicticioLegado(t));
    if (terminaisLimpos.length !== terminaisAntes.length) {
      cfg.terminais = terminaisLimpos;
      if (cfg.stoneCode === '984210772') {
        delete cfg.stoneCode;
        cfg.taxasCustomizadas = {};
        cfg.adquirentesAtivas = [];
        cfg.adquirentePadrao = null;
      }
    }
    cfg.configurado = Array.isArray(cfg.terminais) && cfg.terminais.length > 0;
    cfg.status = cfg.configurado ? 'configurado' : 'nao_configurado';
  }
  return store;
}

export function obterConfiguracoesTef(empresaId) {
  const store = ensureTefStore();
  if (!store.tefConfiguracoes[empresaId]) {
    store.tefConfiguracoes[empresaId] = criarConfiguracaoTefVazia(empresaId);
  }
  const cfg = store.tefConfiguracoes[empresaId];
  cfg.configurado = Array.isArray(cfg.terminais) && cfg.terminais.length > 0;
  cfg.status = cfg.configurado ? 'configurado' : 'nao_configurado';
  return cfg;
}

export function salvarConfiguracoesTef(empresaId, dados) {
  const store = ensureTefStore();
  const anterior = obterConfiguracoesTef(empresaId);
  const terminais = Array.isArray(dados?.terminais)
    ? dados.terminais.filter((t) => !ehTerminalFicticioLegado(t))
    : anterior.terminais || [];
  store.tefConfiguracoes[empresaId] = {
    ...anterior,
    ...dados,
    terminais,
    configurado: terminais.length > 0,
    status: terminais.length > 0 ? 'configurado' : 'nao_configurado',
    empresaId,
    atualizadoEm: new Date().toISOString(),
  };
  return store.tefConfiguracoes[empresaId];
}

export function listarTerminaisTef(empresaId) {
  const cfg = obterConfiguracoesTef(empresaId);
  return cfg.terminais || [];
}

export function adicionarTerminalTef(empresaId, dadosTerminal = {}) {
  const nome = String(dadosTerminal.nome || '').trim();
  const adquirenteId = String(dadosTerminal.adquirenteId || '').trim();
  const modelo = String(dadosTerminal.modelo || '').trim();
  const serialNumber = String(dadosTerminal.serialNumber || '').trim();

  if (!nome || !adquirenteId || !modelo || !serialNumber) {
    throw new Error('Informe nome, adquirente, modelo e número de série real do Pinpad para cadastrar o terminal.');
  }

  const cfg = obterConfiguracoesTef(empresaId);
  if (!cfg.terminais) cfg.terminais = [];

  const novoTerminal = {
    id: String(dadosTerminal.id || '').trim() || `term-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    nome,
    adquirenteId,
    modelo,
    serialNumber,
    localizacao: String(dadosTerminal.localizacao || 'Balcão de Caixa').trim(),
    tipoConexao: String(dadosTerminal.tipoConexao || 'agente_local').trim(),
    ipPorta: String(dadosTerminal.ipPorta || '').trim(),
    merchantId: String(dadosTerminal.merchantId || '').trim(),
    status: 'nao_testado',
    suportaPix: dadosTerminal.suportaPix !== false,
    suportaVoucher: dadosTerminal.suportaVoucher === true,
    criadoEm: new Date().toISOString(),
    ultimoPing: null,
  };

  cfg.terminais.push(novoTerminal);
  if (!cfg.adquirentesAtivas.includes(adquirenteId)) {
    cfg.adquirentesAtivas.push(adquirenteId);
  }
  if (!cfg.adquirentePadrao) {
    cfg.adquirentePadrao = adquirenteId;
  }
  salvarConfiguracoesTef(empresaId, cfg);
  return novoTerminal;
}

export function atualizarTerminalTef(empresaId, terminalId, dados) {
  const cfg = obterConfiguracoesTef(empresaId);
  if (!cfg.terminais) cfg.terminais = [];

  const index = cfg.terminais.findIndex((t) => t.id === terminalId);
  if (index === -1) {
    throw new Error(`Terminal ${terminalId} não encontrado.`);
  }

  cfg.terminais[index] = {
    ...cfg.terminais[index],
    ...dados,
    id: terminalId,
    atualizadoEm: new Date().toISOString(),
  };

  salvarConfiguracoesTef(empresaId, cfg);
  return cfg.terminais[index];
}

export function excluirTerminalTef(empresaId, terminalId) {
  const cfg = obterConfiguracoesTef(empresaId);
  if (!cfg.terminais) cfg.terminais = [];

  const totalAntes = cfg.terminais.length;
  cfg.terminais = cfg.terminais.filter((t) => t.id !== terminalId);

  if (cfg.terminais.length === totalAntes) {
    throw new Error(`Terminal ${terminalId} não encontrado.`);
  }

  salvarConfiguracoesTef(empresaId, cfg);
  return { sucesso: true, mensagem: `Terminal ${terminalId} removido.` };
}

export function testarConexaoTerminal(empresaId, terminalId, opcoes = {}) {
  const heartbeatLocalConfirmado = Boolean(opcoes.heartbeatLocalConfirmado || opcoes.agenteLocalConectado);
  const latenciaRealMs = opcoes.latenciaRealMs ?? null;
  const firmwarePinpad = opcoes.firmwarePinpad || null;
  const cfg = obterConfiguracoesTef(empresaId);
  const terminal = (cfg.terminais || []).find((t) => t.id === terminalId);
  if (!terminal) {
    throw new Error(`Terminal ${terminalId} não encontrado na empresa.`);
  }

  if (!heartbeatLocalConfirmado) {
    terminal.status = 'nao_testado';
    terminal.ultimoPing = null;
    salvarConfiguracoesTef(empresaId, cfg);
    return {
      sucesso: false,
      terminalId,
      terminalNome: terminal.nome,
      adquirenteId: terminal.adquirenteId,
      modelo: terminal.modelo,
      serialNumber: terminal.serialNumber,
      status: 'nao_testado',
      latenciaMs: null,
      mensagem:
        'O servidor em nuvem não simula ping para Pinpad em rede local. Inicie o Agente Local Kytto no computador do caixa para testar a conexão física.',
    };
  }

  terminal.ultimoPing = new Date().toISOString();
  terminal.status = 'ativo';
  salvarConfiguracoesTef(empresaId, cfg);

  return {
    sucesso: true,
    terminalId,
    terminalNome: terminal.nome,
    adquirenteId: terminal.adquirenteId,
    modelo: terminal.modelo,
    serialNumber: terminal.serialNumber,
    status: 'conectado',
    latenciaMs: Number(latenciaRealMs || 0),
    firmwarePinpad,
    mensagem: `Conexão confirmada pelo Agente Local com ${terminal.nome} (${terminal.modelo}).`,
  };
}

export function excluirTransacaoTef(empresaId, transacaoId) {
  const store = ensureTefStore();
  const idx = (store.tefTransacoes || []).findIndex((t) => t.id === transacaoId && t.empresaId === empresaId);
  if (idx === -1) {
    throw new Error(`Transação TEF ${transacaoId} não encontrada para a empresa.`);
  }
  const removida = store.tefTransacoes.splice(idx, 1)[0];
  return { sucesso: true, mensagem: `Transação TEF ${transacaoId} removida com sucesso.`, transacao: removida };
}

export function expurgarTransacoesSimuladas(empresaId) {
  const store = ensureTefStore();
  const antes = store.tefTransacoes.length;
  store.tefTransacoes = store.tefTransacoes.filter((t) => {
    if (t.empresaId !== empresaId) return true;
    return !t.simulado && t.status !== 'simulada';
  });
  const removidas = antes - store.tefTransacoes.length;
  return { sucesso: true, removidas, mensagem: `${removidas} transação(ões) simulada(s) expurgada(s) com sucesso.` };
}

export function processarTransacaoTef({
  empresaId,
  valor,
  modalidade = 'debito',
  parcelas = 1,
  adquirenteId = 'stone',
  bandeiraId = 'visa',
  terminalId = null,
  referenciaVenda = null,
  clienteNome = 'Cliente Balcão',
  operador = 'Operador de Caixa',
  nsu = null,
  codigoAutorizacao = null,
  tid = null,
}) {
  const store = ensureTefStore();
  const cfg = obterConfiguracoesTef(empresaId);
  if (!Array.isArray(cfg.terminais) || cfg.terminais.length === 0) {
    throw new Error('TEF não configurado. Cadastre um terminal Pinpad real em Configurações › TEF antes de processar transações.');
  }

  const terminalObj = terminalId
    ? cfg.terminais.find((t) => t.id === terminalId)
    : cfg.terminais[0];
  if (!terminalObj) {
    throw new Error('Terminal TEF selecionado não está cadastrado nesta empresa.');
  }

  const adquirente = ADQUIRENTES_BRASIL.find((a) => a.id === (adquirenteId || terminalObj.adquirenteId)) || ADQUIRENTES_BRASIL[0];
  const bandeira = BANDEIRAS_BRASIL.find((b) => b.id === bandeiraId) || BANDEIRAS_BRASIL[0];

  const taxasContrato = cfg.taxasNegociadas?.[adquirente.id] || cfg.taxasCustomizadas?.[adquirente.id];
  if (!taxasContrato || typeof taxasContrato !== 'object') {
    throw new Error(`Cadastre as taxas de contrato da adquirente ${adquirente.nome} em Configurações › TEF antes de registrar transações.`);
  }

  let taxaMdrPercentual = taxasContrato[modalidade];
  if (modalidade === 'credito_avista') {
    taxaMdrPercentual = taxasContrato.credito_avista ?? taxasContrato.creditoAvista ?? 0;
  }
  if (modalidade === 'credito_parcelado') {
    taxaMdrPercentual = parcelas <= 6
      ? (taxasContrato.credito_parcelado_2_6 ?? taxasContrato.creditoParcelado2a6 ?? 0)
      : (taxasContrato.credito_parcelado_7_12 ?? taxasContrato.creditoParcelado7a12 ?? 0);
  }
  taxaMdrPercentual = Number(taxaMdrPercentual ?? 0);

  const valorNum = Number(valor || 0);
  const valorTaxaMdr = Number(((valorNum * taxaMdrPercentual) / 100).toFixed(2));
  const valorLiquido = Number((valorNum - valorTaxaMdr).toFixed(2));

  const hoje = new Date();
  let diasParaLiquidar = 30;
  if (modalidade === 'debito') diasParaLiquidar = 1;
  else if (modalidade === 'pix' || bandeiraId === 'pix_pinpad') diasParaLiquidar = 0;

  const dataPrevisao = new Date(hoje.getTime() + diasParaLiquidar * 24 * 60 * 60 * 1000);
  const dataPrevisaoStr = dataPrevisao.toISOString().slice(0, 10);
  const horaFormatada = hoje.toLocaleTimeString('pt-BR', { timeZone: 'America/Cuiaba' });
  const dataFormatada = hoje.toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' });

  const nsuFinal = String(nsu || '').trim() || `NSU-${Date.now().toString().slice(-9)}`;
  const autFinal = String(codigoAutorizacao || '').trim() || `AUT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const tidFinal = String(tid || '').trim() || `TID-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  const razaoSocialEmitente = String(cfg.razaoSocial || 'ESTABELECIMENTO CREDENCIADO').toUpperCase();
  const cnpjEmitente = String(cfg.cnpj || '').trim();
  const imEmitente = String(cfg.inscricaoMunicipal || '').trim();
  const cabecalhoFiscal = [razaoSocialEmitente, cnpjEmitente ? `CNPJ: ${cnpjEmitente}` : null, imEmitente ? `IM: ${imEmitente}` : null].filter(Boolean).join(' · ');
  const comprovanteCliente = [
    'COMPROVANTE DE PAGAMENTO VIA TEF (VIA CLIENTE)',
    cabecalhoFiscal,
    `ADQUIRENTE: ${adquirente.nome.toUpperCase()} · BANDEIRA: ${bandeira.nome.toUpperCase()}`,
    `MODALIDADE: ${modalidade.toUpperCase()} (${parcelas}x) · VALOR TOTAL: R$ ${valorNum.toFixed(2)}`,
    `NSU: ${nsuFinal} · AUT: ${autFinal} · TID: ${tidFinal}`,
  ].join('\n');
  const comprovanteEstabelecimento = [
    'COMPROVANTE DE PAGAMENTO VIA TEF (VIA ESTABELECIMENTO)',
    cabecalhoFiscal,
    `TERMINAL: ${terminalObj.nome} (${terminalObj.serialNumber})`,
    `VALOR BRUTO: R$ ${valorNum.toFixed(2)} · TAXA MDR (${taxaMdrPercentual}%): R$ ${valorTaxaMdr.toFixed(2)}`,
    `LÍQUIDO A RECEBER: R$ ${valorLiquido.toFixed(2)} · LIQUIDAÇÃO: ${dataPrevisaoStr}`,
    `NSU: ${nsuFinal} · AUT: ${autFinal} · TID: ${tidFinal}`,
  ].join('\n');

  const transacao = {
    id: `tef-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    empresaId,
    criadoEm: hoje.toISOString(),
    data: hoje.toISOString().slice(0, 10),
    hora: horaFormatada,
    dataFormatada,
    status: 'autorizada',
    simulado: false,
    valor: valorNum,
    modalidade,
    parcelas,
    adquirenteId: adquirente.id,
    adquirenteNome: adquirente.nome,
    bandeiraId: bandeira.id,
    bandeiraNome: bandeira.nome,
    terminalId: terminalObj.id,
    terminalNome: terminalObj.nome,
    terminalSerial: terminalObj.serialNumber,
    nsu: nsuFinal,
    codigoAutorizacao: autFinal,
    tid: tidFinal,
    taxaMdrPercentual,
    valorTaxaMdr,
    valorLiquido,
    previsaoLiquidacao: dataPrevisaoStr,
    referenciaVenda,
    clienteNome,
    operador,
    comprovanteCliente,
    comprovanteEstabelecimento,
    conciliadoComExtrato: false,
    extratoLinhaId: null,
  };

  store.tefTransacoes.unshift(transacao);
  if (store.tefTransacoes.length > 5000) {
    store.tefTransacoes = store.tefTransacoes.slice(0, 5000);
  }

  return transacao;
}

export function listarTransacoesTef(empresaId, filtros = {}) {
  const store = ensureTefStore();
  let itens = (store.tefTransacoes || []).filter((t) => t.empresaId === empresaId);

  if (filtros.adquirenteId) itens = itens.filter((t) => t.adquirenteId === filtros.adquirenteId);
  if (filtros.bandeiraId) itens = itens.filter((t) => t.bandeiraId === filtros.bandeiraId);
  if (filtros.modalidade) itens = itens.filter((t) => t.modalidade === filtros.modalidade);
  if (filtros.status) itens = itens.filter((t) => t.status === filtros.status);
  if (filtros.de) itens = itens.filter((t) => t.data >= filtros.de);
  if (filtros.ate) itens = itens.filter((t) => t.data <= filtros.ate);

  return itens;
}

export function conciliarLoteTefComExtrato(empresaId, { extratoLinhaId, adquirenteId, valorDeposito }) {
  const store = ensureTefStore();
  const transacoes = (store.tefTransacoes || []).filter(
    (t) =>
      t.empresaId === empresaId &&
      !t.conciliadoComExtrato &&
      t.status === 'autorizada' &&
      (!adquirenteId || t.adquirenteId === adquirenteId)
  );

  const conciliadas = [];
  let somaLiquida = 0;

  for (const t of transacoes) {
    if (somaLiquida + t.valorLiquido <= valorDeposito + 0.05) {
      t.conciliadoComExtrato = true;
      t.status = 'conciliada';
      t.extratoLinhaId = extratoLinhaId;
      t.conciliadoEm = new Date().toISOString();
      conciliadas.push(t);
      somaLiquida += t.valorLiquido;
    }
    if (Math.abs(somaLiquida - valorDeposito) < 0.05) {
      break;
    }
  }

  return {
    sucesso: true,
    totalTransacoesConciliadas: conciliadas.length,
    somaLiquida: Number(somaLiquida.toFixed(2)),
    valorDeposito,
    diferencaCentavos: Number((valorDeposito - somaLiquida).toFixed(2)),
    transacoesConciliadas: conciliadas,
  };
}

export function resumoPrevisaoRecebiveis(empresaId) {
  const transacoes = listarTransacoesTef(empresaId);
  const pendentes = transacoes.filter((t) => !t.conciliadoComExtrato && t.status === 'autorizada' && !t.simulado);

  const porAdquirente = {};
  const porData = {};
  let totalBrutoPendente = 0;
  let totalLiquidoPendente = 0;
  let totalTaxasMdr = 0;

  for (const t of pendentes) {
    totalBrutoPendente += t.valor;
    totalLiquidoPendente += t.valorLiquido;
    totalTaxasMdr += t.valorTaxaMdr;

    if (!porAdquirente[t.adquirenteNome]) {
      porAdquirente[t.adquirenteNome] = { bruto: 0, liquido: 0, taxa: 0, quantidade: 0 };
    }
    porAdquirente[t.adquirenteNome].bruto += t.valor;
    porAdquirente[t.adquirenteNome].liquido += t.valorLiquido;
    porAdquirente[t.adquirenteNome].taxa += t.valorTaxaMdr;
    porAdquirente[t.adquirenteNome].quantidade += 1;

    const dataPrev = t.previsaoLiquidacao || t.data;
    if (!porData[dataPrev]) {
      porData[dataPrev] = { data: dataPrev, liquido: 0, bruto: 0, transacoes: 0 };
    }
    porData[dataPrev].liquido += t.valorLiquido;
    porData[dataPrev].bruto += t.valor;
    porData[dataPrev].transacoes += 1;
  }

  return {
    totalTransacoesPendentes: pendentes.length,
    totalBrutoPendente: Number(totalBrutoPendente.toFixed(2)),
    totalLiquidoPendente: Number(totalLiquidoPendente.toFixed(2)),
    totalTaxasMdr: Number(totalTaxasMdr.toFixed(2)),
    porAdquirente,
    agendaDiaria: Object.values(porData).sort((a, b) => a.data.localeCompare(b.data)),
    agendaDatas: Object.values(porData).sort((a, b) => a.data.localeCompare(b.data)),
  };
}

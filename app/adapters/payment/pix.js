/**
 * ============================================================================
 * ADAPTADOR PIX - QR DINÂMICO
 * ============================================================================
 * Arquivo: adapters/payment/pix.js
 * Descrição: Geração de QR Code dinâmico e confirmação de Pix
 * ============================================================================
 */

import crypto from 'crypto';
import qrcode from 'qrcode';

/**
 * Gerar QR Code Pix dinâmico
 */
export async function gerarQrPix(dados) {
  const { valor, chave_pix, descricao = 'Pagamento', id_transacao } = dados;

  if (!valor || !chave_pix) {
    throw new Error('Valor e chave Pix são obrigatórios');
  }

  // Gerar TXID único
  const txid = gerarTxid(id_transacao);

  // Montar payload EMV (Pix)
  const payload = montarPayloadPix({
    chave_pix,
    valor,
    descricao,
    txid
  });

  // Gerar QR Code
  const qrCode = await qrcode.toDataURL(payload);

  return {
    sucesso: true,
    qr_code: qrCode,
    payload,
    txid,
    valor,
    chave_pix,
    descricao
  };
}

/**
 * Gerar TXID único
 */
function gerarTxid(id_transacao) {
  // TXID = até 35 caracteres, alfanuméricos
  // Formato: timestamp + hash do ID
  const timestamp = Date.now().toString().slice(-8);
  const hash = crypto
    .createHash('md5')
    .update(id_transacao || Date.now().toString())
    .digest('hex')
    .slice(0, 27);

  return (timestamp + hash).slice(0, 35);
}

/**
 * Montar payload EMV para Pix
 */
function montarPayloadPix(dados) {
  const { chave_pix, valor, descricao, txid } = dados;

  // Estrutura EMV (Pix)
  let payload = '';

  // ID do Pix (00)
  payload += '00020126'; // Identificador do Pix

  // Chave (26)
  const chavePart = montarCampoEmv('26', montarChavePix(chave_pix));
  payload += chavePart;

  // Valor (54)
  const valorFormatado = String(valor).replace('.', '').padStart(13, '0');
  payload += montarCampoEmv('54', valorFormatado);

  // Descrição (05)
  if (descricao) {
    payload += montarCampoEmv('05', descricao.slice(0, 79));
  }

  // TXID (80)
  if (txid) {
    payload += montarCampoEmv('80', txid);
  }

  // Código de verificação (81)
  payload += '5802BR'; // País

  // CRC (checksum)
  const crc = calcularCrc16(payload + '6304');
  payload += '6304' + crc;

  return payload;
}

/**
 * Montar campo EMV
 */
function montarCampoEmv(id, valor) {
  const tamanho = String(valor.length).padStart(2, '0');
  return id + tamanho + valor;
}

/**
 * Montar chave Pix
 */
function montarChavePix(chave) {
  // Organização: 0014 (Banco do Brasil)
  // Chave: CPF/CNPJ/Email/Telefone/Aleatória
  const org = '0014br.gov.bcb.brcode';
  const chaveFormatada = `01051.0.0${chave}`;

  return org + chaveFormatada;
}

/**
 * Calcular CRC16
 */
function calcularCrc16(payload) {
  let crc = 0xffff;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;

    for (let j = 0; j < 8; j++) {
      crc <<= 1;

      if (crc & 0x10000) {
        crc ^= 0x1021;
      }

      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Simular confirmação de Pix (em produção, usar webhook do banco)
 */
export async function simularConfirmacaoPix(dados) {
  const { txid, valor, chave_pix } = dados;

  // Simular confirmação após 5-10 segundos
  return new Promise((resolve) => {
    const delay = Math.random() * 5000 + 5000;

    setTimeout(() => {
      resolve({
        sucesso: true,
        txid,
        valor,
        chave_pix,
        status: 'confirmado',
        timestamp: new Date().toISOString(),
        nsu: gerarNsu()
      });
    }, delay);
  });
}

/**
 * Gerar NSU para Pix
 */
function gerarNsu() {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}

/**
 * Validar confirmação de Pix
 */
export async function validarConfirmacaoPix(dados) {
  const { txid, valor, chave_pix, timestamp_confirmacao } = dados;

  // Validar TXID
  if (!txid || txid.length > 35) {
    return {
      valido: false,
      erro: 'TXID inválido'
    };
  }

  // Validar valor
  if (valor <= 0) {
    return {
      valido: false,
      erro: 'Valor deve ser maior que zero'
    };
  }

  // Validar chave Pix
  if (!validarChavePix(chave_pix)) {
    return {
      valido: false,
      erro: 'Chave Pix inválida'
    };
  }

  // Validar timestamp (não deve ser muito antigo)
  const agora = Date.now();
  const confirmacao = new Date(timestamp_confirmacao).getTime();
  const diferenca = (agora - confirmacao) / 1000; // em segundos

  if (diferenca > 3600) { // 1 hora
    return {
      valido: false,
      erro: 'Confirmação expirada'
    };
  }

  return {
    valido: true,
    txid,
    valor,
    chave_pix
  };
}

/**
 * Validar chave Pix
 */
function validarChavePix(chave) {
  if (!chave) return false;

  // CPF: 11 dígitos
  if (/^\d{11}$/.test(chave)) return true;

  // CNPJ: 14 dígitos
  if (/^\d{14}$/.test(chave)) return true;

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chave)) return true;

  // Telefone: +55 + 11 dígitos
  if (/^\+55\d{11}$/.test(chave)) return true;

  // Aleatória: 36 caracteres
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(chave)) return true;

  return false;
}

/**
 * Listar transações Pix
 */
export async function listarTransacoesPix(dados) {
  const { chave_pix, data_inicio, data_fim, limite = 100 } = dados;

  // Em produção, consultar API do banco
  // Aqui é apenas estrutura de exemplo

  return {
    sucesso: true,
    chave_pix,
    transacoes: [],
    total: 0,
    periodo: {
      inicio: data_inicio,
      fim: data_fim
    }
  };
}

/**
 * Devolver Pix
 */
export async function devolverPix(dados) {
  const { txid_original, valor, motivo } = dados;

  // Gerar novo TXID para devolução
  const txid_devolucao = gerarTxid('devolucao_' + txid_original);

  return {
    sucesso: true,
    txid_original,
    txid_devolucao,
    valor,
    motivo,
    status: 'processando',
    timestamp: new Date().toISOString()
  };
}

export default {
  gerarQrPix,
  simularConfirmacaoPix,
  validarConfirmacaoPix,
  validarChavePix,
  listarTransacoesPix,
  devolverPix
};

// Camada de pagamentos (cap. 12.3 / 15) — Pix e cartão.
// Modos de operação (em ordem de prioridade):
//   1. PIX_CHAVE definida → gera BR Code EMV com a chave estática real, sem gateway externo.
//   2. MP_ACCESS_TOKEN definido → usa Mercado Pago (cobranças dinâmicas com QR único por valor).
//   3. Nenhum → modo SIMULAÇÃO para desenvolvimento local.
import crypto from 'crypto';

const MP_TOKEN  = process.env.MP_ACCESS_TOKEN || '';
const PIX_CHAVE = (process.env.PIX_CHAVE || '').trim();
const PIX_NOME  = (process.env.PIX_NOME  || 'AGRO OPEN TTC').slice(0, 25).toUpperCase();
const PIX_CIDADE= (process.env.PIX_CIDADE|| 'TANGARA DA SERRA').slice(0, 15).toUpperCase();
const PLATFORM_FEE = Number(process.env.PLATFORM_FEE_PCT || 5);

export const pagamentosAtivos = !!(PIX_CHAVE || MP_TOKEN);
export const pixInfo = PIX_CHAVE
  ? { chave: PIX_CHAVE, nome: PIX_NOME, cidade: PIX_CIDADE, modo: 'estatico' }
  : null;

// ── Gerador de BR Code EMV (Pix estático) ──────────────────────────────────
// Especificação: BCB "Manual de Padrões para iniciação do Pix" v2.x
// Produz copia-e-cola válido para qualquer app bancário brasileiro.

function _tlv(id, valor) {
  const len = String(valor.length).padStart(2, '0');
  return `${id}${len}${valor}`;
}

function _crc16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

export function gerarBrCode({ chave, nome, cidade, valor = null, txid = '***' }) {
  // GUI = Mercado do aplicativo de pagamento
  const gui      = _tlv('00', 'BR.GOV.BCB.PIX');
  const key      = _tlv('01', chave);
  const mai      = _tlv('26', gui + key);           // Merchant Account Information
  const ref      = _tlv('05', txid.slice(0, 25));   // Reference Label (campo 62)
  const addData  = _tlv('62', ref);

  let payload = '';
  payload += _tlv('00', '01');                      // Payload Format Indicator
  payload += mai;
  payload += _tlv('52', '0000');                    // MCC (genérico)
  payload += _tlv('53', '986');                     // BRL
  if (valor && valor > 0) payload += _tlv('54', Number(valor).toFixed(2)); // valor (opcional)
  payload += _tlv('58', 'BR');                      // País
  payload += _tlv('59', nome);                      // Nome do beneficiário
  payload += _tlv('60', cidade);                    // Cidade
  payload += addData;
  payload += '6304';                                // CRC tag (sem valor ainda)
  payload += _crc16(payload);                       // CRC16-CCITT
  return payload;
}

// ── API pública ────────────────────────────────────────────────────────────

// Cria uma cobrança Pix. Retorna { provedor, status, copiaECola, externalId? }.
export async function criarPix({ valor, descricao, email }) {
  const valorNum = Math.round(Number(valor) * 100) / 100;
  if (!(valorNum > 0)) throw new Error('valor inválido');

  // ── Modo 1: Pix Estático (chave configurada, sem gateway) ──
  if (PIX_CHAVE) {
    const txid = 'AO' + crypto.randomBytes(6).toString('hex').toUpperCase();
    const copiaECola = gerarBrCode({
      chave: PIX_CHAVE,
      nome: PIX_NOME,
      cidade: PIX_CIDADE,
      valor: valorNum,
      txid,
    });
    return {
      provedor: 'pix-estatico',
      status: 'pendente',
      externalId: txid,
      copiaECola,
      chave: PIX_CHAVE,
      nomeBeneficiario: PIX_NOME,
      valor: valorNum,
      taxaPlataforma: 0, // sem split no modo estático
    };
  }

  // ── Modo 2: Mercado Pago ──
  if (MP_TOKEN) {
    const idem = crypto.randomUUID();
    const r = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MP_TOKEN}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': idem },
      body: JSON.stringify({
        transaction_amount: valorNum,
        description: descricao || 'SetPoint',
        payment_method_id: 'pix',
        payer: { email: email || 'cliente@setpoint.app' },
        application_fee: +(valorNum * PLATFORM_FEE / 100).toFixed(2),
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || 'falha ao criar cobrança Pix');
    const tx = d.point_of_interaction?.transaction_data || {};
    return {
      provedor: 'mercadopago',
      status: d.status === 'approved' ? 'aprovado' : 'pendente',
      externalId: String(d.id),
      copiaECola: tx.qr_code,
      qrBase64: tx.qr_code_base64,
      taxaPlataforma: +(valorNum * PLATFORM_FEE / 100).toFixed(2),
    };
  }

  // ── Modo 3: Simulação (desenvolvimento) ──
  const txid = 'SIMPIX' + crypto.randomBytes(8).toString('hex').toUpperCase();
  const copiaECola = gerarBrCode({
    chave: '00000000000000',
    nome: 'SETPOINT DEMO',
    cidade: 'TANGARA MT',
    valor: valorNum,
    txid,
  });
  return {
    provedor: 'simulado',
    status: 'pendente',
    externalId: txid,
    copiaECola,
    taxaPlataforma: +(valorNum * PLATFORM_FEE / 100).toFixed(2),
  };
}

// Consulta status de um pagamento no provedor.
export async function consultarStatus(externalId) {
  if (PIX_CHAVE) return null;   // estático: confirmação manual
  if (!MP_TOKEN) return null;   // simulação: confirmação manual
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${externalId}`, {
    headers: { 'Authorization': `Bearer ${MP_TOKEN}` },
  });
  const d = await r.json();
  if (!r.ok) return null;
  return d.status === 'approved' ? 'aprovado' : (d.status === 'rejected' ? 'recusado' : 'pendente');
}

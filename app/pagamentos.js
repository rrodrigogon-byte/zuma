// Camada de pagamentos (cap. 12.3 / 15) — Pix e cartão.
// Em produção usa o Mercado Pago (defina MP_ACCESS_TOKEN). Sem token, opera em modo
// SIMULAÇÃO para permitir testar todo o fluxo (cobrança -> confirmação -> liberação).
import crypto from 'crypto';

const MP_TOKEN = process.env.MP_ACCESS_TOKEN || '';
const PLATFORM_FEE = Number(process.env.PLATFORM_FEE_PCT || 5); // % retido pela plataforma (split)
export const pagamentosAtivos = !!MP_TOKEN;

// Cria uma cobrança Pix. Retorna { provedor, status, qr, copiaECola, externalId? }.
export async function criarPix({ valor, descricao, email }){
  const valorNum = Math.round(Number(valor) * 100) / 100;
  if(!(valorNum > 0)) throw new Error('valor inválido');

  if(!MP_TOKEN){
    // SIMULAÇÃO: gera um payload Pix fictício (válido para testes/QR), sem cobrança real.
    const txid = 'SIMPIX' + crypto.randomBytes(8).toString('hex').toUpperCase();
    const copiaECola = `00020126SETPOINT-SIMULADO-${txid}5204000053039865802BR5913SETPOINT DEMO6009TANGARA MT62070503***6304SIMU`;
    return { provedor:'simulado', status:'pendente', externalId:txid, copiaECola, taxaPlataforma: +(valorNum*PLATFORM_FEE/100).toFixed(2) };
  }

  // PRODUÇÃO: Mercado Pago (Pix)
  const idem = crypto.randomUUID();
  const r = await fetch('https://api.mercadopago.com/v1/payments', {
    method:'POST',
    headers:{ 'Authorization':`Bearer ${MP_TOKEN}`, 'Content-Type':'application/json', 'X-Idempotency-Key':idem },
    body: JSON.stringify({
      transaction_amount: valorNum,
      description: descricao || 'SetPoint',
      payment_method_id: 'pix',
      payer: { email: email || 'cliente@setpoint.app' },
      application_fee: +(valorNum*PLATFORM_FEE/100).toFixed(2) // split: taxa da plataforma
    })
  });
  const d = await r.json();
  if(!r.ok) throw new Error(d.message || 'falha ao criar cobrança Pix');
  const tx = d.point_of_interaction?.transaction_data || {};
  return { provedor:'mercadopago', status: d.status==='approved'?'aprovado':'pendente',
    externalId: String(d.id), copiaECola: tx.qr_code, qrBase64: tx.qr_code_base64,
    taxaPlataforma: +(valorNum*PLATFORM_FEE/100).toFixed(2) };
}

// Consulta status de um pagamento no provedor (produção). Na simulação, retorna o status informado.
export async function consultarStatus(externalId){
  if(!MP_TOKEN) return null; // simulação: confirmação é manual via endpoint /confirmar
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${externalId}`, { headers:{ 'Authorization':`Bearer ${MP_TOKEN}` } });
  const d = await r.json();
  if(!r.ok) return null;
  return d.status==='approved' ? 'aprovado' : (d.status==='rejected'?'recusado':'pendente');
}

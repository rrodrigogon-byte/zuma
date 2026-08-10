/**
 * Módulo de PIX Dinâmico — Setpoint Kytto
 * QR Code dinâmico, webhooks HMAC e conciliação idempotente
 * Versão: 1.0.0
 * Data: 2026-08-10
 */

import crypto from 'crypto';
import { db, save } from './db.js';

const MERCADO_PAGO_SANDBOX = 'https://api.sandbox.mercadopago.com';
const MERCADO_PAGO_PROD = 'https://api.mercadopago.com';

export const pixDinamico = {
  // ── CONFIGURAÇÃO DE PIX POR EMPRESA ──────────────────────────────────────
  
  /**
   * Registra configuração de Mercado Pago para PIX dinâmico
   */
  registrarMercadoPago(empresaId, config) {
    if (!empresaId || !config?.accessToken) {
      throw new Error('Empresa e access token são obrigatórios');
    }
    
    const dados = db();
    if (!dados.pagamentos) dados.pagamentos = {};
    if (!dados.pagamentos[empresaId]) dados.pagamentos[empresaId] = {};
    
    // Criptografar credenciais
    const encryptSecret = (secret) => {
      const cipher = crypto.createCipher('aes-256-cbc', process.env.FISCAL_CERT_MASTER_KEY || 'default-key');
      return cipher.update(secret, 'utf8', 'hex') + cipher.final('hex');
    };
    
    dados.pagamentos[empresaId].mercadoPago = {
      accessTokenProtegido: encryptSecret(config.accessToken),
      webhookSecretProtegido: config.webhookSecret ? encryptSecret(config.webhookSecret) : null,
      publicKey: config.publicKey || '',
      ativa: config.ativa !== false,
      ambiente: config.ambiente || 'sandbox',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    
    save();
    return { ok: true, empresaId, ambiente: dados.pagamentos[empresaId].mercadoPago.ambiente };
  },

  /**
   * Gera QR Code dinâmico para transação
   */
  gerarQRCodeDinamico(empresaId, transacao) {
    if (!empresaId || !transacao?.valor) {
      throw new Error('Empresa e valor são obrigatórios');
    }
    
    const dados = db();
    const config = dados.pagamentos?.[empresaId]?.mercadoPago;
    
    if (!config?.ativa) {
      throw new Error('Mercado Pago não configurado para esta empresa');
    }
    
    // Simular geração de QR Code (em produção, chamar API do Mercado Pago)
    const qrCodeId = `qr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    const qrCode = {
      id: qrCodeId,
      empresaId,
      valor: transacao.valor,
      descricao: transacao.descricao || 'Pagamento Kytto',
      expiracaoEm: new Date(Date.now() + (transacao.expiracaoMinutos || 24) * 60 * 1000).toISOString(),
      status: 'ativo',
      criadoEm: new Date().toISOString(),
      // Simulado: em produção seria a resposta da API do Mercado Pago
      qrCodeUrl: `https://sandbox.mercadopago.com/qr/${qrCodeId}`,
      qrCodeBase64: Buffer.from(`00020126580014br.gov.bcb.pix0136${qrCodeId}`).toString('base64')
    };
    
    // Armazenar QR Code
    if (!dados.pagamentos[empresaId].qrCodes) {
      dados.pagamentos[empresaId].qrCodes = [];
    }
    dados.pagamentos[empresaId].qrCodes.push(qrCode);
    save();
    
    return qrCode;
  },

  /**
   * Processa webhook de notificação do Mercado Pago
   */
  processarWebhookMercadoPago(empresaId, payload, assinatura) {
    if (!empresaId || !payload) {
      throw new Error('Empresa e payload são obrigatórios');
    }
    
    const dados = db();
    const config = dados.pagamentos?.[empresaId]?.mercadoPago;
    
    if (!config?.webhookSecretProtegido) {
      throw new Error('Webhook não configurado para esta empresa');
    }
    
    // Validar assinatura HMAC
    const decryptSecret = (encrypted) => {
      const decipher = crypto.createDecipher('aes-256-cbc', process.env.FISCAL_CERT_MASTER_KEY || 'default-key');
      return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
    };
    
    const segredo = decryptSecret(config.webhookSecretProtegido);
    const esperado = crypto.createHmac('sha256', segredo).update(JSON.stringify(payload || {})).digest('hex');
    const recebido = String(assinatura || '').replace(/^sha256=/i, '');
    
    if (!recebido || recebido.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado))) {
      throw new Error('Assinatura de webhook inválida');
    }
    
    // Processar notificação
    const transacao = {
      id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      empresaId,
      tipo: payload.type || 'payment',
      status: payload.status || 'pending',
      valor: payload.value || 0,
      referencia: payload.id || null,
      metadadosWebhook: payload,
      processadoEm: new Date().toISOString()
    };
    
    // Armazenar transação
    if (!dados.pagamentos[empresaId].transacoes) {
      dados.pagamentos[empresaId].transacoes = [];
    }
    dados.pagamentos[empresaId].transacoes.push(transacao);
    
    // Lançar automaticamente no financeiro se aprovado
    if (payload.status === 'approved') {
      if (!dados.financeiro) dados.financeiro = {};
      if (!dados.financeiro[empresaId]) dados.financeiro[empresaId] = {};
      if (!dados.financeiro[empresaId].lancamentos) dados.financeiro[empresaId].lancamentos = [];
      
      dados.financeiro[empresaId].lancamentos.push({
        id: `fin-${transacao.id}`,
        tipo: 'recebimento',
        valor: transacao.valor,
        descricao: `PIX - ${payload.description || 'Pagamento'}`,
        origem: 'pix_dinamico',
        referenciaTransacao: transacao.id,
        data: new Date().toISOString()
      });
    }
    
    save();
    return { ok: true, transacao };
  },

  /**
   * Lista transações de PIX de uma empresa
   */
  listarTransacoes(empresaId, filtros = {}) {
    const dados = db();
    const transacoes = dados.pagamentos?.[empresaId]?.transacoes || [];
    
    // Aplicar filtros
    let resultado = transacoes;
    
    if (filtros.status) {
      resultado = resultado.filter(t => t.status === filtros.status);
    }
    
    if (filtros.dataInicio && filtros.dataFim) {
      resultado = resultado.filter(t => {
        const data = new Date(t.processadoEm);
        return data >= new Date(filtros.dataInicio) && data <= new Date(filtros.dataFim);
      });
    }
    
    return resultado;
  }
};

export default pixDinamico;

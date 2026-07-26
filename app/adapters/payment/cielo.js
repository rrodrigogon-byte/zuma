/**
 * Adaptador Cielo
 * Integração com Cielo para processamento de pagamentos
 */

import axios from 'axios';
import { config } from '../../config.js';

const cieloAPI = axios.create({
  baseURL: config.payment.cielo.apiUrl,
  headers: {
    'MerchantId': config.payment.cielo.merchantId,
    'MerchantKey': config.payment.cielo.merchantKey,
    'Content-Type': 'application/json',
  },
});

/**
 * Processar pagamento com cartão de crédito
 */
export const processarCartaoCredito = async (pagamentoData) => {
  try {
    const {
      valor,
      cartao,
      cliente,
      descricao,
      referencia,
      parcelamento = 1,
    } = pagamentoData;

    const payload = {
      MerchantOrderId: referencia,
      Customer: {
        Name: cliente.nome,
        Email: cliente.email,
        Identity: cliente.cpf,
        IdentityType: 'CPF',
        Address: {
          Street: cliente.rua || 'N/A',
          Number: cliente.numero || '0',
          Complement: cliente.complemento || '',
          ZipCode: cliente.cep || '00000000',
          City: cliente.cidade || 'N/A',
          State: cliente.estado || 'SP',
          Country: 'BRA',
        },
        DeliveryAddress: {
          Street: cliente.rua || 'N/A',
          Number: cliente.numero || '0',
          Complement: cliente.complemento || '',
          ZipCode: cliente.cep || '00000000',
          City: cliente.cidade || 'N/A',
          State: cliente.estado || 'SP',
          Country: 'BRA',
        },
      },
      Payment: {
        Provider: 'Cielo',
        Type: 'CreditCard',
        Amount: Math.round(valor * 100),
        Installments: parcelamento,
        SoftDescriptor: descricao.substring(0, 13),
        CreditCard: {
          CardNumber: cartao.numero.replace(/\s/g, ''),
          Holder: cartao.titular,
          ExpirationDate: `${cartao.mes}/${cartao.ano}`,
          SecurityCode: cartao.cvv,
          Brand: cartao.bandeira || 'Visa',
        },
      },
    };

    const response = await cieloAPI.post('/1/sales', payload);

    if (response.data.Payment.Status === 1 || response.data.Payment.Status === 2) {
      return {
        sucesso: true,
        idTransacao: response.data.Payment.PaymentId,
        idAutorizacao: response.data.Payment.AuthorizationCode,
        nsu: response.data.Payment.ProofOfSale,
        bandeira: response.data.Payment.CreditCard.Brand,
        ultimosDigitos: response.data.Payment.CreditCard.CardNumber.slice(-4),
        valor: response.data.Payment.Amount / 100,
        dataAprovacao: new Date(),
      };
    } else {
      throw new Error(`Pagamento recusado: ${response.data.Payment.ReturnMessage}`);
    }
  } catch (error) {
    console.error('Erro ao processar cartão de crédito via Cielo:', error);
    throw error;
  }
};

/**
 * Processar pagamento com cartão de débito
 */
export const processarCartaoDebito = async (pagamentoData) => {
  try {
    const {
      valor,
      cartao,
      cliente,
      descricao,
      referencia,
    } = pagamentoData;

    const payload = {
      MerchantOrderId: referencia,
      Customer: {
        Name: cliente.nome,
        Email: cliente.email,
        Identity: cliente.cpf,
        IdentityType: 'CPF',
      },
      Payment: {
        Provider: 'Cielo',
        Type: 'DebitCard',
        Amount: Math.round(valor * 100),
        ReturnUrl: config.server.url + '/webhook/cielo/debit',
        DebitCard: {
          CardNumber: cartao.numero.replace(/\s/g, ''),
          Holder: cartao.titular,
          ExpirationDate: `${cartao.mes}/${cartao.ano}`,
          SecurityCode: cartao.cvv,
        },
      },
    };

    const response = await cieloAPI.post('/1/sales', payload);

    if (response.data.Payment.Status === 1 || response.data.Payment.Status === 2) {
      return {
        sucesso: true,
        idTransacao: response.data.Payment.PaymentId,
        idAutorizacao: response.data.Payment.AuthorizationCode,
        nsu: response.data.Payment.ProofOfSale,
        bandeira: response.data.Payment.DebitCard.Brand,
        ultimosDigitos: response.data.Payment.DebitCard.CardNumber.slice(-4),
        valor: response.data.Payment.Amount / 100,
        dataAprovacao: new Date(),
      };
    } else {
      throw new Error(`Pagamento recusado: ${response.data.Payment.ReturnMessage}`);
    }
  } catch (error) {
    console.error('Erro ao processar cartão de débito via Cielo:', error);
    throw error;
  }
};

/**
 * Reembolsar transação
 */
export const reembolsarTransacao = async (idTransacao, valor) => {
  try {
    const payload = {
      Amount: valor ? Math.round(valor * 100) : undefined,
    };

    const response = await cieloAPI.put(
      `/1/sales/${idTransacao}/void`,
      payload
    );

    return {
      idReembolso: response.data.Payment.PaymentId,
      status: response.data.Payment.Status,
      valor: response.data.Payment.Amount / 100,
      dataReembolso: new Date(),
    };
  } catch (error) {
    console.error('Erro ao reembolsar transação:', error);
    throw error;
  }
};

export default {
  processarCartaoCredito,
  processarCartaoDebito,
  reembolsarTransacao,
};

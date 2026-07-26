/**
 * Adaptador PagBank
 * Integração com PagBank para processamento de pagamentos
 */

import axios from 'axios';
import { config } from '../../config.js';

const pagbankAPI = axios.create({
  baseURL: config.payment.pagbank.apiUrl,
  headers: {
    'Authorization': `Bearer ${config.payment.pagbank.token}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Processar pagamento com Pix
 */
export const processarPix = async (pagamentoData) => {
  try {
    const {
      valor,
      cliente,
      descricao,
      referencia,
    } = pagamentoData;

    const payload = {
      reference_id: referencia,
      description: descricao,
      amount: {
        value: Math.round(valor * 100),
        currency: 'BRL',
      },
      customer: {
        name: cliente.nome,
        email: cliente.email,
        tax_id: cliente.cpf,
        phones: [
          {
            country: '55',
            area: cliente.telefone?.substring(0, 2) || '11',
            number: cliente.telefone?.substring(2) || '0000000000',
            type: 'MOBILE',
          },
        ],
      },
      qr_codes: [
        {
          amount: {
            value: Math.round(valor * 100),
          },
          expiration_date: new Date(Date.now() + 3600000).toISOString(),
        },
      ],
    };

    const response = await pagbankAPI.post('/qr_codes', payload);

    if (response.data.qr_codes && response.data.qr_codes.length > 0) {
      const qrCode = response.data.qr_codes[0];
      return {
        sucesso: true,
        idTransacao: response.data.id,
        qrCode: qrCode.text,
        qrCodeUrl: qrCode.url,
        chavePix: qrCode.id,
        expiresIn: 3600,
        valor: valor,
      };
    } else {
      throw new Error('Erro ao gerar QR Code');
    }
  } catch (error) {
    console.error('Erro ao processar Pix via PagBank:', error);
    throw error;
  }
};

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
      reference_id: referencia,
      description: descricao,
      amount: {
        value: Math.round(valor * 100),
        currency: 'BRL',
      },
      customer: {
        name: cliente.nome,
        email: cliente.email,
        tax_id: cliente.cpf,
      },
      payment_method: {
        type: 'CREDIT_CARD',
        credit_card: {
          number: cartao.numero.replace(/\s/g, ''),
          holder_name: cartao.titular,
          expiration_month: parseInt(cartao.mes),
          expiration_year: parseInt(cartao.ano),
          security_code: cartao.cvv,
        },
        installments: parcelamento,
      },
    };

    const response = await pagbankAPI.post('/charges', payload);

    if (response.data.status === 'AUTHORIZED' || response.data.status === 'PAID') {
      return {
        sucesso: true,
        idTransacao: response.data.id,
        idAutorizacao: response.data.payment_method?.credit_card?.auth_code,
        nsu: response.data.payment_method?.credit_card?.nsu,
        bandeira: response.data.payment_method?.credit_card?.brand,
        ultimosDigitos: response.data.payment_method?.credit_card?.last_digits,
        valor: response.data.amount.value / 100,
        dataAprovacao: new Date(),
      };
    } else {
      throw new Error(`Pagamento recusado: ${response.data.status}`);
    }
  } catch (error) {
    console.error('Erro ao processar cartão via PagBank:', error);
    throw error;
  }
};

/**
 * Consultar status de transação
 */
export const consultarTransacao = async (idTransacao) => {
  try {
    const response = await pagbankAPI.get(`/charges/${idTransacao}`);

    return {
      idTransacao: response.data.id,
      status: response.data.status,
      valor: response.data.amount.value / 100,
      metodo: response.data.payment_method?.type,
      dataAprovacao: response.data.created_at,
    };
  } catch (error) {
    console.error('Erro ao consultar transação:', error);
    throw error;
  }
};

/**
 * Reembolsar transação
 */
export const reembolsarTransacao = async (idTransacao, valor) => {
  try {
    const payload = {
      amount: valor ? Math.round(valor * 100) : undefined,
    };

    const response = await pagbankAPI.post(
      `/charges/${idTransacao}/cancel`,
      payload
    );

    return {
      idReembolso: response.data.id,
      status: response.data.status,
      valor: response.data.amount.value / 100,
      dataReembolso: new Date(),
    };
  } catch (error) {
    console.error('Erro ao reembolsar transação:', error);
    throw error;
  }
};

export default {
  processarPix,
  processarCartaoCredito,
  consultarTransacao,
  reembolsarTransacao,
};

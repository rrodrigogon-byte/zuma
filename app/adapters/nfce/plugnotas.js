/**
 * Adaptador PlugNotas
 * Integração com PlugNotas para emissão de NFC-e (fallback)
 */

import axios from 'axios';
import { config } from '../../config.js';

const plugnotasAPI = axios.create({
  baseURL: config.nfce.plugnotas.apiUrl,
  headers: {
    'Authorization': `Bearer ${config.nfce.plugnotas.apiKey}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Emitir NFC-e via PlugNotas
 */
export const emitirNfce = async (nfceData) => {
  try {
    const {
      numero,
      serie,
      dataEmissao,
      cliente,
      itens,
      valorTotal,
      valorDesconto,
      valorServico,
      config: config_nfce,
    } = nfceData;

    // Montar payload para PlugNotas
    const payload = {
      naturezaOperacao: 'VENDA',
      serie,
      numero,
      dataEmissao: dataEmissao.toISOString(),
      cliente: {
        nome: cliente.nome || 'Consumidor',
        cpf: cliente.cpf,
        cnpj: cliente.cnpj,
      },
      produtos: itens.map((item) => ({
        descricao: item.descricao,
        quantidade: item.quantidade,
        unidade: item.unidade || 'un',
        valor: item.valorUnitario,
        desconto: item.desconto || 0,
      })),
      totalizadores: {
        valorSubtotal: valorTotal,
        valorDesconto: valorDesconto || 0,
        valorServico: valorServico || 0,
        valorTotal: valorTotal - (valorDesconto || 0) + (valorServico || 0),
      },
      ambiente: config_nfce.ambiente === 'producao' ? 'producao' : 'homologacao',
    };

    // Enviar para PlugNotas
    const response = await plugnotasAPI.post('/nfce', payload);

    if (response.data.status === 'autorizado') {
      return {
        sucesso: true,
        numeroNfce: response.data.numero,
        serieNfce: response.data.serie,
        chaveNfce: response.data.chave,
        protocoloAutorizacao: response.data.protocolo,
        qrCode: response.data.qrCode,
        urlConsulta: response.data.urlConsulta,
      };
    } else if (response.data.status === 'rejeitado') {
      throw new Error(`NFC-e rejeitada: ${response.data.motivo}`);
    } else {
      throw new Error(`Status desconhecido: ${response.data.status}`);
    }
  } catch (error) {
    console.error('Erro ao emitir NFC-e via PlugNotas:', error);
    throw error;
  }
};

/**
 * Consultar status de NFC-e
 */
export const consultarNfce = async (chaveNfce) => {
  try {
    const response = await plugnotasAPI.get(`/nfce/${chaveNfce}`);

    return {
      chaveNfce: response.data.chave,
      status: response.data.status === 'autorizado' ? 'autorizada' : response.data.status,
      protocoloAutorizacao: response.data.protocolo,
      dataAutorizacao: response.data.dataAutorizacao,
      qrCode: response.data.qrCode,
    };
  } catch (error) {
    console.error('Erro ao consultar NFC-e:', error);
    throw error;
  }
};

/**
 * Cancelar NFC-e
 */
export const cancelarNfce = async (chaveNfce, justificativa) => {
  try {
    const response = await plugnotasAPI.post(`/nfce/${chaveNfce}/cancelamento`, {
      justificativa,
    });

    return {
      chaveNfce: response.data.chave,
      status: response.data.status,
      protocoloCancelamento: response.data.protocolo,
    };
  } catch (error) {
    console.error('Erro ao cancelar NFC-e:', error);
    throw error;
  }
};

export default {
  emitirNfce,
  consultarNfce,
  cancelarNfce,
};

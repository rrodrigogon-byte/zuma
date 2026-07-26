/**
 * ============================================================================
 * ADAPTADOR FOCUS NFe - NFC-e NACIONAL
 * ============================================================================
 * Arquivo: adapters/nfce/focus/index.js
 * Descrição: Integração com Focus NFe para emissão de NFC-e em 27 UFs
 * ============================================================================
 */

import axios from 'axios';
import crypto from 'crypto';
import * as dbPg from '../../../db-pg.js';

const FOCUS_API_BASE = 'https://api.focusnfe.com.br/v2';
const FOCUS_HOMOLOG_BASE = 'https://homolog.focusnfe.com.br/v2';

export class FocusNFeAdapter {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.FOCUS_API_KEY;
    this.ambiente = config.ambiente || 'producao'; // producao ou homologacao
    this.baseUrl = this.ambiente === 'producao' ? FOCUS_API_BASE : FOCUS_HOMOLOG_BASE;
    this.client = axios.create({
      baseURL: this.baseUrl,
      auth: {
        username: this.apiKey,
        password: ''
      },
      timeout: 30000
    });
  }

  /**
   * Emitir NFC-e
   */
  async emitirNfce(dados) {
    try {
      const payload = this.montarPayloadNfce(dados);

      const response = await this.client.post('/nfce', payload);

      if (response.data.status === 'autorizado') {
        return {
          sucesso: true,
          numero: response.data.numero,
          serie: response.data.serie,
          protocolo: response.data.protocolo,
          chave: response.data.chave,
          url_consulta: response.data.url_consulta,
          xml: response.data.xml,
          qrcode: response.data.qrcode
        };
      } else if (response.data.status === 'processando') {
        return {
          sucesso: false,
          status: 'processando',
          referencia: response.data.referencia,
          mensagem: 'NFC-e em processamento'
        };
      } else {
        return {
          sucesso: false,
          status: 'erro',
          mensagem: response.data.mensagem_erro || 'Erro ao emitir NFC-e',
          erros: response.data.erros
        };
      }
    } catch (error) {
      console.error('Erro ao emitir NFC-e com Focus:', error);
      return {
        sucesso: false,
        status: 'erro',
        mensagem: error.message
      };
    }
  }

  /**
   * Consultar status de NFC-e
   */
  async consultarNfce(referencia) {
    try {
      const response = await this.client.get(`/nfce/${referencia}`);

      return {
        sucesso: true,
        status: response.data.status,
        numero: response.data.numero,
        protocolo: response.data.protocolo,
        chave: response.data.chave,
        xml: response.data.xml,
        qrcode: response.data.qrcode
      };
    } catch (error) {
      console.error('Erro ao consultar NFC-e:', error);
      return {
        sucesso: false,
        mensagem: error.message
      };
    }
  }

  /**
   * Cancelar NFC-e
   */
  async cancelarNfce(referencia, justificativa) {
    try {
      const payload = {
        justificativa
      };

      const response = await this.client.post(`/nfce/${referencia}/cancelamento`, payload);

      return {
        sucesso: response.data.status === 'cancelado',
        status: response.data.status,
        protocolo: response.data.protocolo_cancelamento,
        xml: response.data.xml
      };
    } catch (error) {
      console.error('Erro ao cancelar NFC-e:', error);
      return {
        sucesso: false,
        mensagem: error.message
      };
    }
  }

  /**
   * Montar payload da NFC-e
   */
  montarPayloadNfce(dados) {
    const {
      empresa_id,
      numero,
      serie,
      data_emissao,
      uf,
      natureza_operacao,
      itens,
      pagamentos,
      cliente,
      observacoes
    } = dados;

    // Estrutura XML da NFC-e
    const payload = {
      referencia: `${empresa_id}-${numero}`,
      natureza_operacao: natureza_operacao || 'VENDA',
      serie,
      numero_nf: numero,
      data_emissao,
      tipo_documento: 'nfce',
      uf,
      cliente: cliente ? {
        cpf: cliente.cpf,
        cnpj: cliente.cnpj,
        nome: cliente.nome,
        endereco: cliente.endereco,
        numero: cliente.numero,
        complemento: cliente.complemento,
        bairro: cliente.bairro,
        municipio: cliente.municipio,
        uf: cliente.uf,
        cep: cliente.cep
      } : undefined,
      itens: itens.map(item => ({
        descricao: item.descricao,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        ncm: item.ncm || '99999999',
        cfop: item.cfop || '5102',
        icms_situacao_tributaria: item.icms_st || '00',
        icms_aliquota: item.icms_aliquota || 0,
        pis_situacao_tributaria: item.pis_st || '07',
        cofins_situacao_tributaria: item.cofins_st || '07'
      })),
      pagamentos: pagamentos.map(pag => ({
        forma: this.mapearFormaPagamento(pag.forma),
        valor: pag.valor,
        parcelas: pag.parcelas || 1,
        bandeira: pag.bandeira,
        autorizacao: pag.autorizacao
      })),
      observacoes
    };

    return payload;
  }

  /**
   * Mapear forma de pagamento para código Focus
   */
  mapearFormaPagamento(forma) {
    const mapeamento = {
      'dinheiro': '01',
      'cartao_credito': '03',
      'cartao_debito': '04',
      'pix': '26',
      'cheque': '02',
      'boleto': '05',
      'transferencia': '22'
    };

    return mapeamento[forma] || '01';
  }

  /**
   * Obter QR Code da NFC-e
   */
  async obterQrCode(chave) {
    try {
      const response = await this.client.get(`/nfce/${chave}/qrcode`);
      return {
        sucesso: true,
        qrcode: response.data.qrcode,
        url: response.data.url
      };
    } catch (error) {
      return {
        sucesso: false,
        mensagem: error.message
      };
    }
  }

  /**
   * Listar NFC-e emitidas
   */
  async listarNfce(filtros = {}) {
    try {
      const params = new URLSearchParams();

      if (filtros.data_inicio) params.append('data_inicio', filtros.data_inicio);
      if (filtros.data_fim) params.append('data_fim', filtros.data_fim);
      if (filtros.status) params.append('status', filtros.status);

      const response = await this.client.get('/nfce', { params });

      return {
        sucesso: true,
        nfces: response.data.nfces,
        total: response.data.total
      };
    } catch (error) {
      return {
        sucesso: false,
        mensagem: error.message
      };
    }
  }
}

/**
 * Emitir NFC-e com Focus
 */
export async function emitirNfceComFocus(dados) {
  const config = {
    apiKey: process.env.FOCUS_API_KEY,
    ambiente: process.env.NODE_ENV === 'production' ? 'producao' : 'homologacao'
  };

  const focus = new FocusNFeAdapter(config);
  return await focus.emitirNfce(dados);
}

/**
 * Consultar NFC-e com Focus
 */
export async function consultarNfceComFocus(referencia) {
  const config = {
    apiKey: process.env.FOCUS_API_KEY,
    ambiente: process.env.NODE_ENV === 'production' ? 'producao' : 'homologacao'
  };

  const focus = new FocusNFeAdapter(config);
  return await focus.consultarNfce(referencia);
}

/**
 * Cancelar NFC-e com Focus
 */
export async function cancelarNfceComFocus(referencia, justificativa) {
  const config = {
    apiKey: process.env.FOCUS_API_KEY,
    ambiente: process.env.NODE_ENV === 'production' ? 'producao' : 'homologacao'
  };

  const focus = new FocusNFeAdapter(config);
  return await focus.cancelarNfce(referencia, justificativa);
}

export default {
  FocusNFeAdapter,
  emitirNfceComFocus,
  consultarNfceComFocus,
  cancelarNfceComFocus
};

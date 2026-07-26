/**
 * Adaptador TEF - Transferência Eletrônica de Fundos
 * Integração com máquinas de cartão físicas (Gertec, Ingenico, Verifone)
 */

import net from 'net';
import { EventEmitter } from 'events';
import { db } from '../../core/database.js';

class TEFAdapter extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.socket = null;
    this.buffer = '';
    this.sequencia = 0;
  }

  /**
   * Conectar à máquina TEF
   */
  conectar() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(
        this.config.porta || 20000,
        this.config.host || 'localhost'
      );

      this.socket.on('connect', () => {
        console.log('Conectado à máquina TEF');
        resolve();
      });

      this.socket.on('data', (data) => {
        this.processarResposta(data.toString());
      });

      this.socket.on('error', (error) => {
        console.error('Erro na conexão TEF:', error);
        reject(error);
      });

      this.socket.on('close', () => {
        console.log('Desconectado da máquina TEF');
      });

      setTimeout(() => {
        reject(new Error('Timeout na conexão TEF'));
      }, 5000);
    });
  }

  /**
   * Desconectar da máquina TEF
   */
  desconectar() {
    if (this.socket) {
      this.socket.end();
    }
  }

  /**
   * Processar transação de débito/crédito
   */
  async processarTransacao(dadosTransacao) {
    try {
      const {
        valor,
        tipo_cartao, // 'credito' | 'debito'
        numero_parcelas = 1,
        referencia,
      } = dadosTransacao;

      // Montar comando TEF
      const comando = this.montarComandoTransacao({
        valor: Math.round(valor * 100), // Converter para centavos
        tipo_cartao,
        numero_parcelas,
        referencia,
      });

      // Enviar para máquina
      return await this.enviarComando(comando);
    } catch (error) {
      console.error('Erro ao processar transação TEF:', error);
      throw error;
    }
  }

  /**
   * Montar comando TEF
   */
  montarComandoTransacao(dados) {
    this.sequencia++;

    // Formato: TIPO|SEQUENCIA|VALOR|TIPO_CARTAO|PARCELAS|REFERENCIA
    const comando = [
      '01', // Tipo de mensagem (01 = venda)
      String(this.sequencia).padStart(6, '0'),
      String(dados.valor).padStart(12, '0'),
      dados.tipo_cartao === 'credito' ? '01' : '02', // 01 = crédito, 02 = débito
      String(dados.numero_parcelas).padStart(2, '0'),
      dados.referencia || '',
    ].join('|');

    return this.adicionarChecksum(comando);
  }

  /**
   * Adicionar checksum ao comando
   */
  adicionarChecksum(comando) {
    let checksum = 0;
    for (let i = 0; i < comando.length; i++) {
      checksum ^= comando.charCodeAt(i);
    }
    return comando + '|' + checksum.toString(16).padStart(2, '0');
  }

  /**
   * Enviar comando para máquina
   */
  enviarComando(comando) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.writable) {
        return reject(new Error('Máquina TEF não conectada'));
      }

      const timeout = setTimeout(() => {
        reject(new Error('Timeout na resposta da máquina TEF'));
      }, 30000);

      const resposta = (dados) => {
        clearTimeout(timeout);
        this.removeListener('resposta', resposta);
        resolve(dados);
      };

      this.once('resposta', resposta);
      this.socket.write(comando + '\n');
    });
  }

  /**
   * Processar resposta da máquina
   */
  processarResposta(dados) {
    this.buffer += dados;

    // Procurar por linhas completas (terminadas com \n)
    let linhas = this.buffer.split('\n');
    this.buffer = linhas.pop(); // Guardar última linha incompleta

    for (const linha of linhas) {
      if (linha.trim()) {
        const resposta = this.parseResposta(linha);
        this.emit('resposta', resposta);
      }
    }
  }

  /**
   * Parse da resposta TEF
   */
  parseResposta(linha) {
    const partes = linha.split('|');

    return {
      tipo: partes[0],
      sequencia: parseInt(partes[1]),
      status: partes[2], // '00' = sucesso, '01' = recusado, etc
      autorizacao: partes[3],
      nsu: partes[4],
      rede: partes[5],
      bandeira: partes[6],
      ultimosDigitos: partes[7],
      valor: parseInt(partes[8]) / 100,
      parcelas: parseInt(partes[9]),
      mensagem: partes[10],
    };
  }

  /**
   * Consultar transação
   */
  async consultarTransacao(nsu) {
    const comando = this.montarComandoConsulta(nsu);
    return await this.enviarComando(comando);
  }

  /**
   * Montar comando de consulta
   */
  montarComandoConsulta(nsu) {
    this.sequencia++;
    const comando = [
      '05', // Tipo de mensagem (05 = consulta)
      String(this.sequencia).padStart(6, '0'),
      nsu,
    ].join('|');

    return this.adicionarChecksum(comando);
  }

  /**
   * Fazer reembolso
   */
  async reembolsar(nsu, valor) {
    const comando = this.montarComandoReembolso(nsu, valor);
    return await this.enviarComando(comando);
  }

  /**
   * Montar comando de reembolso
   */
  montarComandoReembolso(nsu, valor) {
    this.sequencia++;
    const comando = [
      '03', // Tipo de mensagem (03 = reembolso)
      String(this.sequencia).padStart(6, '0'),
      String(Math.round(valor * 100)).padStart(12, '0'),
      nsu,
    ].join('|');

    return this.adicionarChecksum(comando);
  }
}

/**
 * Factory para criar adaptador TEF
 */
export const criarAdaptadorTEF = (config) => {
  return new TEFAdapter(config);
};

/**
 * Processar pagamento com TEF
 */
export const processarComTEF = async (pagamentoData, configTEF) => {
  try {
    const { valor, tipo_cartao, numero_parcelas, referencia } = pagamentoData;

    const tef = criarAdaptadorTEF(configTEF);

    // Conectar à máquina
    await tef.conectar();

    // Processar transação
    const resposta = await tef.processarTransacao({
      valor,
      tipo_cartao,
      numero_parcelas,
      referencia,
    });

    // Desconectar
    tef.desconectar();

    if (resposta.status === '00') {
      return {
        sucesso: true,
        nsu: resposta.nsu,
        autorizacao: resposta.autorizacao,
        bandeira: resposta.bandeira,
        ultimosDigitos: resposta.ultimosDigitos,
        valor: resposta.valor,
        parcelas: resposta.parcelas,
        rede: resposta.rede,
      };
    } else {
      throw new Error(`Transação recusada: ${resposta.mensagem}`);
    }
  } catch (error) {
    console.error('Erro ao processar com TEF:', error);
    throw error;
  }
};

/**
 * Consultar transação TEF
 */
export const consultarTransacaoTEF = async (nsu, configTEF) => {
  try {
    const tef = criarAdaptadorTEF(configTEF);
    await tef.conectar();

    const resposta = await tef.consultarTransacao(nsu);
    tef.desconectar();

    return resposta;
  } catch (error) {
    console.error('Erro ao consultar transação TEF:', error);
    throw error;
  }
};

/**
 * Reembolsar transação TEF
 */
export const reembolsarTEF = async (nsu, valor, configTEF) => {
  try {
    const tef = criarAdaptadorTEF(configTEF);
    await tef.conectar();

    const resposta = await tef.reembolsar(nsu, valor);
    tef.desconectar();

    if (resposta.status === '00') {
      return {
        sucesso: true,
        nsu: resposta.nsu,
        valor: resposta.valor,
      };
    } else {
      throw new Error(`Reembolso recusado: ${resposta.mensagem}`);
    }
  } catch (error) {
    console.error('Erro ao reembolsar TEF:', error);
    throw error;
  }
};

export default {
  criarAdaptadorTEF,
  processarComTEF,
  consultarTransacaoTEF,
  reembolsarTEF,
};

/**
 * Serviço de Sincronização Offline
 * SetPoint Ultra - Sincronização resiliente com retry automático
 */

import axios from 'axios';
import * as Network from 'expo-network';
import { database } from '../database';

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.syncInterval = null;
    this.retryCount = 0;
    this.maxRetries = 5;
  }

  /**
   * Iniciar sincronização periódica
   */
  iniciarSincronizacaoPeriodica(intervaloMs = 30000) {
    if (this.syncInterval) clearInterval(this.syncInterval);

    this.syncInterval = setInterval(() => {
      this.sincronizar();
    }, intervaloMs);

    // Sincronizar imediatamente
    this.sincronizar();
  }

  /**
   * Parar sincronização periódica
   */
  pararSincronizacaoPeriodica() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Sincronizar dados
   */
  async sincronizar() {
    try {
      if (this.isSyncing) return;

      // Verificar conexão
      const isOnline = await this.verificarConexao();
      if (!isOnline) {
        console.log('Offline - sincronização adiada');
        return;
      }

      this.isSyncing = true;

      // Sincronizar dados do servidor
      await this.sincronizarDoServidor();

      // Sincronizar dados locais
      await this.sincronizarParaServidor();

      this.retryCount = 0;
    } catch (error) {
      console.error('Erro na sincronização:', error);
      this.tratarErroSincronizacao(error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Verificar conexão com internet
   */
  async verificarConexao() {
    try {
      const state = await Network.getNetworkStateAsync();
      return state.isConnected;
    } catch (error) {
      console.error('Erro ao verificar conexão:', error);
      return false;
    }
  }

  /**
   * Sincronizar dados do servidor
   */
  async sincronizarDoServidor() {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/sync/pull`,
        {
          headers: {
            'Authorization': `Bearer ${await this.obterToken()}`,
          },
        }
      );

      const { produtos, categorias, mesas, comandas } = response.data;

      // Atualizar produtos
      if (produtos && produtos.length > 0) {
        await this.atualizarProdutos(produtos);
      }

      // Atualizar categorias
      if (categorias && categorias.length > 0) {
        await this.atualizarCategorias(categorias);
      }

      // Atualizar mesas
      if (mesas && mesas.length > 0) {
        await this.atualizarMesas(mesas);
      }

      // Atualizar comandas
      if (comandas && comandas.length > 0) {
        await this.atualizarComandas(comandas);
      }

      console.log('Sincronização do servidor concluída');
    } catch (error) {
      console.error('Erro ao sincronizar do servidor:', error);
      throw error;
    }
  }

  /**
   * Sincronizar dados para servidor
   */
  async sincronizarParaServidor() {
    try {
      const filaSync = database.get('fila_sincronizacao');
      const operacoesPendentes = await filaSync
        .query()
        .where('status', 'pendente')
        .fetch();

      for (const operacao of operacoesPendentes) {
        try {
          await this.executarOperacao(operacao);

          // Marcar como sincronizada
          await database.write(async () => {
            await operacao.update((op) => {
              op.status = 'sincronizado';
              op.data_sincronizacao = Date.now();
            });
          });
        } catch (error) {
          // Incrementar tentativas
          await database.write(async () => {
            await operacao.update((op) => {
              op.tentativas = (op.tentativas || 0) + 1;
              if (op.tentativas >= this.maxRetries) {
                op.status = 'erro';
              }
            });
          });

          console.error(`Erro ao sincronizar operação ${operacao.id}:`, error);
        }
      }

      console.log('Sincronização para servidor concluída');
    } catch (error) {
      console.error('Erro ao sincronizar para servidor:', error);
      throw error;
    }
  }

  /**
   * Executar operação de sincronização
   */
  async executarOperacao(operacao) {
    const { tipo_operacao, tabela, registro_id, dados } = operacao;

    const payload = {
      tipo_operacao,
      tabela,
      registro_id,
      dados: JSON.parse(dados),
    };

    const response = await axios.post(
      `${process.env.EXPO_PUBLIC_API_URL}/api/sync/push`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${await this.obterToken()}`,
        },
      }
    );

    return response.data;
  }

  /**
   * Atualizar produtos
   */
  async atualizarProdutos(produtos) {
    const produtosTable = database.get('produtos');

    await database.write(async () => {
      for (const produto of produtos) {
        try {
          const existente = await produtosTable
            .query()
            .where('server_id', produto.id)
            .fetchOne()
            .catch(() => null);

          if (existente) {
            await existente.update((p) => {
              Object.assign(p, produto);
              p.sincronizado = true;
            });
          } else {
            await produtosTable.create((p) => {
              Object.assign(p, produto);
              p.server_id = produto.id;
              p.sincronizado = true;
            });
          }
        } catch (error) {
          console.error(`Erro ao atualizar produto ${produto.id}:`, error);
        }
      }
    });
  }

  /**
   * Atualizar categorias
   */
  async atualizarCategorias(categorias) {
    const categoriasTable = database.get('categorias');

    await database.write(async () => {
      for (const categoria of categorias) {
        try {
          const existente = await categoriasTable
            .query()
            .where('server_id', categoria.id)
            .fetchOne()
            .catch(() => null);

          if (existente) {
            await existente.update((c) => {
              Object.assign(c, categoria);
            });
          } else {
            await categoriasTable.create((c) => {
              Object.assign(c, categoria);
              c.server_id = categoria.id;
            });
          }
        } catch (error) {
          console.error(`Erro ao atualizar categoria ${categoria.id}:`, error);
        }
      }
    });
  }

  /**
   * Atualizar mesas
   */
  async atualizarMesas(mesas) {
    const mesasTable = database.get('mesas');

    await database.write(async () => {
      for (const mesa of mesas) {
        try {
          const existente = await mesasTable
            .query()
            .where('server_id', mesa.id)
            .fetchOne()
            .catch(() => null);

          if (existente) {
            await existente.update((m) => {
              Object.assign(m, mesa);
            });
          } else {
            await mesasTable.create((m) => {
              Object.assign(m, mesa);
              m.server_id = mesa.id;
            });
          }
        } catch (error) {
          console.error(`Erro ao atualizar mesa ${mesa.id}:`, error);
        }
      }
    });
  }

  /**
   * Atualizar comandas
   */
  async atualizarComandas(comandas) {
    const comandasTable = database.get('comandas');

    await database.write(async () => {
      for (const comanda of comandas) {
        try {
          const existente = await comandasTable
            .query()
            .where('server_id', comanda.id)
            .fetchOne()
            .catch(() => null);

          if (existente) {
            await existente.update((c) => {
              Object.assign(c, comanda);
              c.sincronizado = true;
            });
          } else {
            await comandasTable.create((c) => {
              Object.assign(c, comanda);
              c.server_id = comanda.id;
              c.sincronizado = true;
            });
          }
        } catch (error) {
          console.error(`Erro ao atualizar comanda ${comanda.id}:`, error);
        }
      }
    });
  }

  /**
   * Registrar operação para sincronizar
   */
  async registrarOperacao(tipo, tabela, registro_id, dados) {
    const filaSync = database.get('fila_sincronizacao');

    await database.write(async () => {
      await filaSync.create((op) => {
        op.tipo_operacao = tipo;
        op.tabela = tabela;
        op.registro_id = registro_id;
        op.dados = JSON.stringify(dados);
        op.status = 'pendente';
        op.tentativas = 0;
        op.data_criacao = Date.now();
      });
    });
  }

  /**
   * Obter token de autenticação
   */
  async obterToken() {
    // Implementar obtenção do token (AsyncStorage, etc)
    return 'seu-token-aqui';
  }

  /**
   * Tratar erro de sincronização
   */
  tratarErroSincronizacao(error) {
    this.retryCount++;

    if (this.retryCount < this.maxRetries) {
      const delayMs = Math.pow(2, this.retryCount) * 1000; // Exponential backoff
      console.log(`Retry em ${delayMs}ms...`);

      setTimeout(() => {
        this.sincronizar();
      }, delayMs);
    } else {
      console.error('Máximo de tentativas de sincronização atingido');
    }
  }
}

export const syncService = new SyncService();

export default syncService;

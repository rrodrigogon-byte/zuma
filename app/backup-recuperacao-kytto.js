/**
 * Módulo de Backup e Recuperação Kytto v3.0.0
 * 
 * Responsabilidades:
 * - Criar snapshots manuais do db.json no GCS com timestamp
 * - Listar snapshots disponíveis
 * - Restaurar snapshot específico (apenas admin)
 * - Backup automático agendado (últimos 30 snapshots diários)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Storage } from '@google-cloud/storage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class BackupRecuperacaoKytto {
  constructor() {
    this.gcsClient = null;
    this.bucket = null;
    this.dbPath = process.env.DB_PATH || path.join(__dirname, 'db.json');
    this.gcsBucket = process.env.GCS_BUCKET || '';
    this.config = {
      maxSnapshotsRetidos: 30,
      intervaloBackupAutomatico: 3600000, // 1 hora
      prefixoSnapshot: 'setpoint-ultra/snapshots/',
    };
    
    this.inicializarGCS();
    this.iniciarBackupAutomatico();
  }

  /**
   * Inicializar cliente GCS se configurado
   */
  inicializarGCS() {
    if (!this.gcsBucket) {
      console.log('[BACKUP] GCS não configurado. Usando apenas snapshots locais.');
      return;
    }
    
    try {
      this.gcsClient = new Storage();
      this.bucket = this.gcsClient.bucket(this.gcsBucket);
      console.log(`[BACKUP] Cliente GCS inicializado para bucket: ${this.gcsBucket}`);
    } catch (erro) {
      console.error('[BACKUP] Erro ao inicializar GCS:', erro.message);
      this.gcsClient = null;
      this.bucket = null;
    }
  }

  /**
   * Criar snapshot manual do banco de dados
   */
  async criarSnapshot(descricao = '') {
    try {
      // Ler banco de dados atual
      if (!fs.existsSync(this.dbPath)) {
        throw new Error(`Arquivo de banco de dados não encontrado: ${this.dbPath}`);
      }
      
      const conteudoDB = fs.readFileSync(this.dbPath, 'utf8');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const nomeSnapshot = `snapshot-${timestamp}.json`;
      const metadados = {
        timestamp: new Date().toISOString(),
        descricao,
        tamanho: Buffer.byteLength(conteudoDB, 'utf8'),
        nomeArquivo: nomeSnapshot,
      };
      
      // Salvar localmente em diretório de backups
      const dirBackups = path.join(__dirname, 'backups');
      if (!fs.existsSync(dirBackups)) {
        fs.mkdirSync(dirBackups, { recursive: true });
      }
      
      const caminhoLocal = path.join(dirBackups, nomeSnapshot);
      fs.writeFileSync(caminhoLocal, conteudoDB, 'utf8');
      
      // Salvar metadados
      const caminhoMetadados = path.join(dirBackups, `${nomeSnapshot}.meta.json`);
      fs.writeFileSync(caminhoMetadados, JSON.stringify(metadados, null, 2), 'utf8');
      
      console.log(`[BACKUP] Snapshot local criado: ${nomeSnapshot}`);
      
      // Tentar salvar no GCS se configurado
      if (this.bucket) {
        await this.salvarNoGCS(nomeSnapshot, conteudoDB, metadados);
      }
      
      // Limpeza de snapshots antigos
      await this.limparSnapshotsAntigos();
      
      return {
        ok: true,
        snapshot: nomeSnapshot,
        metadados,
        caminhoLocal,
      };
    } catch (erro) {
      console.error('[BACKUP] Erro ao criar snapshot:', erro);
      throw erro;
    }
  }

  /**
   * Salvar snapshot no GCS
   */
  async salvarNoGCS(nomeSnapshot, conteudoDB, metadados) {
    try {
      const caminhoGCS = this.config.prefixoSnapshot + nomeSnapshot;
      const arquivo = this.bucket.file(caminhoGCS);
      
      await arquivo.save(conteudoDB, {
        metadata: {
          contentType: 'application/json',
          metadata: metadados,
        },
      });
      
      console.log(`[BACKUP] Snapshot salvo no GCS: ${caminhoGCS}`);
    } catch (erro) {
      console.error('[BACKUP] Erro ao salvar no GCS:', erro.message);
      // Não falhar se GCS não funcionar; o backup local já foi criado
    }
  }

  /**
   * Listar snapshots disponíveis
   */
  async listarSnapshots() {
    try {
      const dirBackups = path.join(__dirname, 'backups');
      let snapshots = [];
      
      // Listar snapshots locais
      if (fs.existsSync(dirBackups)) {
        const arquivos = fs.readdirSync(dirBackups);
        snapshots = arquivos
          .filter(f => f.startsWith('snapshot-') && f.endsWith('.json') && !f.endsWith('.meta.json'))
          .map(f => {
            const caminhoMetadados = path.join(dirBackups, `${f}.meta.json`);
            let metadados = {};
            if (fs.existsSync(caminhoMetadados)) {
              metadados = JSON.parse(fs.readFileSync(caminhoMetadados, 'utf8'));
            }
            return {
              nome: f,
              local: true,
              metadados,
            };
          })
          .sort((a, b) => new Date(b.metadados.timestamp) - new Date(a.metadados.timestamp));
      }
      
      // Listar snapshots no GCS se configurado
      if (this.bucket) {
        try {
          const [arquivosGCS] = await this.bucket.getFiles({
            prefix: this.config.prefixoSnapshot,
          });
          
          const snapshotsGCS = arquivosGCS
            .filter(f => f.name.endsWith('.json') && !f.name.endsWith('.meta.json'))
            .map(f => ({
              nome: path.basename(f.name),
              local: false,
              metadados: f.metadata?.metadata || {},
            }));
          
          snapshots = [...snapshots, ...snapshotsGCS];
        } catch (erro) {
          console.error('[BACKUP] Erro ao listar snapshots no GCS:', erro.message);
        }
      }
      
      return snapshots;
    } catch (erro) {
      console.error('[BACKUP] Erro ao listar snapshots:', erro);
      throw erro;
    }
  }

  /**
   * Restaurar snapshot específico
   */
  async restaurarSnapshot(nomeSnapshot, usuarioEmail = null) {
    try {
      console.log(`[BACKUP] Iniciando restauração de snapshot: ${nomeSnapshot} por ${usuarioEmail}`);
      
      let conteudoDB = null;
      
      // Tentar restaurar do local primeiro
      const dirBackups = path.join(__dirname, 'backups');
      const caminhoLocal = path.join(dirBackups, nomeSnapshot);
      
      if (fs.existsSync(caminhoLocal)) {
        conteudoDB = fs.readFileSync(caminhoLocal, 'utf8');
        console.log(`[BACKUP] Snapshot local encontrado: ${nomeSnapshot}`);
      } else if (this.bucket) {
        // Tentar restaurar do GCS
        try {
          const caminhoGCS = this.config.prefixoSnapshot + nomeSnapshot;
          const arquivo = this.bucket.file(caminhoGCS);
          const [conteudo] = await arquivo.download();
          conteudoDB = conteudo.toString('utf8');
          console.log(`[BACKUP] Snapshot do GCS encontrado: ${nomeSnapshot}`);
        } catch (erro) {
          console.error('[BACKUP] Snapshot não encontrado no GCS:', erro.message);
        }
      }
      
      if (!conteudoDB) {
        throw new Error(`Snapshot não encontrado: ${nomeSnapshot}`);
      }
      
      // Validar JSON antes de restaurar
      try {
        JSON.parse(conteudoDB);
      } catch (erro) {
        throw new Error(`Snapshot corrompido ou inválido: ${erro.message}`);
      }
      
      // Criar backup do estado atual antes de restaurar
      await this.criarSnapshot(`Backup pré-restauração de ${nomeSnapshot}`);
      
      // Restaurar snapshot
      fs.writeFileSync(this.dbPath, conteudoDB, 'utf8');
      
      console.log(`[BACKUP] Snapshot restaurado com sucesso: ${nomeSnapshot}`);
      
      return {
        ok: true,
        mensagem: `Snapshot ${nomeSnapshot} restaurado com sucesso`,
        timestamp: new Date().toISOString(),
        usuarioEmail,
      };
    } catch (erro) {
      console.error('[BACKUP] Erro ao restaurar snapshot:', erro);
      throw erro;
    }
  }

  /**
   * Limpar snapshots antigos (manter últimos 30)
   */
  async limparSnapshotsAntigos() {
    try {
      const snapshots = await this.listarSnapshots();
      
      if (snapshots.length > this.config.maxSnapshotsRetidos) {
        const aRemover = snapshots.slice(this.config.maxSnapshotsRetidos);
        
        for (const snapshot of aRemover) {
          try {
            if (snapshot.local) {
              const dirBackups = path.join(__dirname, 'backups');
              const caminhoLocal = path.join(dirBackups, snapshot.nome);
              const caminhoMetadados = path.join(dirBackups, `${snapshot.nome}.meta.json`);
              
              if (fs.existsSync(caminhoLocal)) {
                fs.unlinkSync(caminhoLocal);
              }
              if (fs.existsSync(caminhoMetadados)) {
                fs.unlinkSync(caminhoMetadados);
              }
              
              console.log(`[BACKUP] Snapshot local removido: ${snapshot.nome}`);
            } else if (this.bucket) {
              const caminhoGCS = this.config.prefixoSnapshot + snapshot.nome;
              await this.bucket.file(caminhoGCS).delete();
              console.log(`[BACKUP] Snapshot do GCS removido: ${snapshot.nome}`);
            }
          } catch (erro) {
            console.error(`[BACKUP] Erro ao remover snapshot ${snapshot.nome}:`, erro.message);
          }
        }
      }
    } catch (erro) {
      console.error('[BACKUP] Erro ao limpar snapshots antigos:', erro);
    }
  }

  /**
   * Iniciar backup automático agendado
   */
  iniciarBackupAutomatico() {
    setInterval(async () => {
      try {
        await this.criarSnapshot('Backup automático agendado');
      } catch (erro) {
        console.error('[BACKUP] Erro no backup automático:', erro.message);
      }
    }, this.config.intervaloBackupAutomatico);
    
    console.log(`[BACKUP] Backup automático agendado a cada ${this.config.intervaloBackupAutomatico / 60000} minutos`);
  }

  /**
   * Obter informações de backup
   */
  async obterInformacoes() {
    try {
      const snapshots = await this.listarSnapshots();
      const tamanhoDBAtual = fs.existsSync(this.dbPath)
        ? fs.statSync(this.dbPath).size
        : 0;
      
      return {
        ok: true,
        banco: {
          caminho: this.dbPath,
          tamanho: tamanhoDBAtual,
          ultimaModificacao: fs.existsSync(this.dbPath)
            ? fs.statSync(this.dbPath).mtime.toISOString()
            : null,
        },
        snapshots: {
          total: snapshots.length,
          maxRetidos: this.config.maxSnapshotsRetidos,
          lista: snapshots.slice(0, 10), // Últimos 10
        },
        gcs: {
          configurado: !!this.bucket,
          bucket: this.gcsBucket,
        },
      };
    } catch (erro) {
      console.error('[BACKUP] Erro ao obter informações:', erro);
      throw erro;
    }
  }
}

// Singleton global
export const backupRecuperacao = new BackupRecuperacaoKytto();

export default BackupRecuperacaoKytto;

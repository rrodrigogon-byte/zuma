/**
 * Script de Backup Agendado para Kytto v3.0.0
 * 
 * Executado via Cloud Scheduler a cada 1 hora
 * Cria snapshot do db.json no GCS com retenção de 30 dias
 * 
 * Uso: node app/backup-scheduler-kytto.js
 * Variáveis de Ambiente:
 * - DB_PATH: caminho do banco de dados (padrão: app/db.json)
 * - GCS_BUCKET: bucket GCS para armazenar backups
 * - GCS_OBJECT: objeto GCS principal (padrão: setpoint-ultra/db.json)
 * - BACKUP_RETENTION_DAYS: dias para manter backups (padrão: 30)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Storage } from '@google-cloud/storage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class BackupSchedulerKytto {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, 'db.json');
    this.gcsBucket = process.env.GCS_BUCKET || '';
    this.gcsObject = process.env.GCS_OBJECT || 'setpoint-ultra/db.json';
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30');
    this.backupPrefix = 'setpoint-ultra/backups/';
    this.gcsClient = null;
    this.bucket = null;
    
    this.inicializarGCS();
  }

  /**
   * Inicializar cliente GCS
   */
  inicializarGCS() {
    if (!this.gcsBucket) {
      throw new Error('GCS_BUCKET não configurado. Backup durável não será realizado.');
    }
    
    try {
      this.gcsClient = new Storage();
      this.bucket = this.gcsClient.bucket(this.gcsBucket);
      console.log(`[BACKUP-SCHEDULER] Cliente GCS inicializado para bucket: ${this.gcsBucket}`);
    } catch (erro) {
      throw new Error(`Erro ao inicializar GCS: ${erro.message}`);
    }
  }

  /**
   * Executar backup agendado
   */
  async executar() {
    try {
      console.log(`[BACKUP-SCHEDULER] Iniciando backup agendado em ${new Date().toISOString()}`);
      
      // 1. Ler banco de dados
      if (!fs.existsSync(this.dbPath)) {
        throw new Error(`Arquivo de banco de dados não encontrado: ${this.dbPath}`);
      }
      
      const conteudoDB = fs.readFileSync(this.dbPath, 'utf8');
      
      // 2. Validar JSON
      try {
        JSON.parse(conteudoDB);
      } catch (erro) {
        throw new Error(`Banco de dados corrompido: ${erro.message}`);
      }
      
      // 3. Criar snapshot
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const nomeSnapshot = `db-snapshot-${timestamp}.json`;
      const caminhoGCS = this.backupPrefix + nomeSnapshot;
      
      console.log(`[BACKUP-SCHEDULER] Criando snapshot: ${nomeSnapshot}`);
      
      const arquivo = this.bucket.file(caminhoGCS);
      await arquivo.save(conteudoDB, {
        metadata: {
          contentType: 'application/json',
          metadata: {
            timestamp: new Date().toISOString(),
            tamanho: Buffer.byteLength(conteudoDB, 'utf8'),
            tipo: 'snapshot-agendado',
          },
        },
      });
      
      console.log(`[BACKUP-SCHEDULER] ✅ Snapshot criado com sucesso: ${caminhoGCS}`);
      
      // 4. Atualizar objeto principal
      console.log(`[BACKUP-SCHEDULER] Atualizando objeto principal: ${this.gcsObject}`);
      const arquivoPrincipal = this.bucket.file(this.gcsObject);
      await arquivoPrincipal.save(conteudoDB, {
        metadata: {
          contentType: 'application/json',
          metadata: {
            timestamp: new Date().toISOString(),
            tamanho: Buffer.byteLength(conteudoDB, 'utf8'),
            tipo: 'principal',
          },
        },
      });
      
      console.log(`[BACKUP-SCHEDULER] ✅ Objeto principal atualizado`);
      
      // 5. Limpar backups antigos
      await this.limparBackupsAntigos();
      
      // 6. Retornar resultado
      const resultado = {
        ok: true,
        timestamp: new Date().toISOString(),
        snapshot: nomeSnapshot,
        tamanho: Buffer.byteLength(conteudoDB, 'utf8'),
        bucket: this.gcsBucket,
      };
      
      console.log(`[BACKUP-SCHEDULER] ✅ Backup concluído com sucesso`);
      console.log(JSON.stringify(resultado, null, 2));
      
      return resultado;
    } catch (erro) {
      console.error(`[BACKUP-SCHEDULER] ❌ Erro ao executar backup: ${erro.message}`);
      console.error(erro);
      process.exit(1);
    }
  }

  /**
   * Limpar backups antigos (manter últimos 30 dias)
   */
  async limparBackupsAntigos() {
    try {
      console.log(`[BACKUP-SCHEDULER] Limpando backups com mais de ${this.retentionDays} dias`);
      
      const [arquivos] = await this.bucket.getFiles({
        prefix: this.backupPrefix,
      });
      
      const agora = Date.now();
      const limiteMs = this.retentionDays * 24 * 60 * 60 * 1000;
      
      let removidos = 0;
      for (const arquivo of arquivos) {
        const idade = agora - new Date(arquivo.metadata.timeCreated).getTime();
        
        if (idade > limiteMs) {
          try {
            await arquivo.delete();
            removidos++;
            console.log(`[BACKUP-SCHEDULER] Removido: ${arquivo.name}`);
          } catch (erro) {
            console.error(`[BACKUP-SCHEDULER] Erro ao remover ${arquivo.name}: ${erro.message}`);
          }
        }
      }
      
      console.log(`[BACKUP-SCHEDULER] ✅ Limpeza concluída: ${removidos} backups removidos`);
    } catch (erro) {
      console.error(`[BACKUP-SCHEDULER] ⚠️  Erro ao limpar backups antigos: ${erro.message}`);
      // Não falhar o backup se a limpeza falhar
    }
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const scheduler = new BackupSchedulerKytto();
  scheduler.executar().catch(erro => {
    console.error('Erro fatal:', erro);
    process.exit(1);
  });
}

export default BackupSchedulerKytto;

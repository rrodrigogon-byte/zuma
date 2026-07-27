/**
 * ============================================================================
 * EXECUTOR VERSIONADO DE MIGRAÇÕES SQL — KYTTO ERP
 * ============================================================================
 * Executa arquivos .sql em ordem determinística e persiste checksum para evitar
 * reaplicações ou alterações silenciosas em migrações já registradas.
 */

import { createHash } from 'crypto';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dbPg from '../db-pg.js';

const diretorioAtual = path.dirname(fileURLToPath(import.meta.url));
const CHAVE_LOCK = 825410731;

function checksum(conteudo) {
  return createHash('sha256').update(conteudo).digest('hex');
}

async function listarArquivosDeMigracao() {
  const arquivos = await readdir(diretorioAtual);
  return arquivos
    .filter((arquivo) => /^\d{3,}_.+\.sql$/i.test(arquivo))
    .sort((a, b) => a.localeCompare(b, 'en'));
}

async function prepararControleDeMigracoes() {
  await dbPg.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      arquivo VARCHAR(255) NOT NULL UNIQUE,
      checksum CHAR(64) NOT NULL,
      aplicado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function executarMigracoes() {
  const arquivos = await listarArquivosDeMigracao();
  await prepararControleDeMigracoes();
  await dbPg.query('SELECT pg_advisory_lock($1)', [CHAVE_LOCK]);

  const aplicadas = [];
  try {
    for (const arquivo of arquivos) {
      const caminho = path.join(diretorioAtual, arquivo);
      const sql = await readFile(caminho, 'utf8');
      const hash = checksum(sql);
      const registro = await dbPg.query(
        'SELECT checksum FROM schema_migrations WHERE arquivo = $1',
        [arquivo]
      );

      if (registro.rows.length > 0) {
        if (registro.rows[0].checksum !== hash) {
          throw new Error(
            `A migração ${arquivo} foi alterada depois de aplicada. Crie uma nova migração incremental.`
          );
        }
        console.log(`↷ ${arquivo} já aplicada`);
        continue;
      }

      console.log(`→ Aplicando ${arquivo}`);
      const client = await dbPg.beginTransaction();
      try {
        // O conteúdo das migrações é mantido no repositório e revisado; não há
        // interpolação de entrada externa nesta execução.
        await dbPg.queryInTransaction(client, sql);
        await dbPg.queryInTransaction(
          client,
          'INSERT INTO schema_migrations (arquivo, checksum) VALUES ($1, $2)',
          [arquivo, hash]
        );
        await dbPg.commit(client);
        aplicadas.push(arquivo);
        console.log(`✓ ${arquivo} aplicada`);
      } catch (error) {
        await dbPg.rollback(client);
        throw new Error(`Falha na migração ${arquivo}: ${error.message}`);
      }
    }
  } finally {
    await dbPg.query('SELECT pg_advisory_unlock($1)', [CHAVE_LOCK]);
  }

  return aplicadas;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  executarMigracoes()
    .then((aplicadas) => {
      console.log(`Migrações concluídas. Novas: ${aplicadas.length}.`);
      process.exit(0);
    })
    .catch((error) => {
      console.error(`Erro ao executar migrações: ${error.message}`);
      process.exit(1);
    });
}

export { executarMigracoes, listarArquivosDeMigracao };

#!/usr/bin/env node
/**
 * ============================================================================
 * SCRIPT DE CORTE E CONSOLIDAÇÃO DO APRENDIZADO HISTÓRICO DO T-REX (KYTTOIA)
 * Executado durante o pre-deploy no Render Cloud para processar todas as
 * conversas desde a criação e gravar fatos, resumos e perfis no PostgreSQL.
 * ============================================================================
 */
import { db } from '../core/database.js';
import { runFullHistoricalAnalysis } from '../core/trex-historical-learner.js';

const DINO_EMPRESA_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

async function main() {
  console.log('--- INICIANDO CONSOLIDAÇÃO DE APRENDIZADO HISTÓRICO DO T-REX (MOTOR KYTTOIA) ---');
  try {
    const res = await runFullHistoricalAnalysis({
      empresaId: DINO_EMPRESA_ID,
      query: db.query.bind(db),
      force: true,
      log: console.log,
    });
    console.log('--- CONSOLIDAÇÃO CONCLUÍDA COM SUCESSO ---');
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('--- ERRO NA CONSOLIDAÇÃO HISTÓRICA (NÃO IMPEDE DEPLOY) ---', error);
    process.exit(0);
  }
}

main();

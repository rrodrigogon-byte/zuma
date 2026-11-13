#!/usr/bin/env node
/**
 * ============================================================================
 * SCRIPT CLI: AUTO-APRENDIZADO CONTÍNUO E AUDITORIA T-REX (KYTTO ERP)
 * ============================================================================
 * Executa a auditoria de atendimentos do WhatsApp AI / T-Rex, calcula a taxa
 * de sucesso autônomo, motivos de transbordo e executa o ciclo de auto-aprendizado.
 * Uso: node scripts/run-trex-auto-learning.js [--dia 2026-11-13] [--empresa UUID]
 * ============================================================================
 */

import { runTrexAutoLearner, getDynamicLearnedGuidance, auditDailySessions } from '../app/core/trex-auto-learner.js';
import { localDateIso } from '../app/core/whatsapp-ai-tools.js';

const EMPRESA_DINO_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

async function main() {
  const args = process.argv.slice(2);
  let dia = localDateIso();
  let empresaId = EMPRESA_DINO_ID;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dia' && args[i + 1]) {
      dia = args[i + 1];
      i++;
    } else if (args[i] === '--empresa' && args[i + 1]) {
      empresaId = args[i + 1];
      i++;
    }
  }

  console.log(`================================================================`);
  console.log(`🤖 T-REX AUTO-LEARNING LOOP & TELEMETRIA DE ATENDIMENTO`);
  console.log(`📅 Data: ${dia} | Empresa: ${empresaId}`);
  console.log(`================================================================\n`);

  try {
    const resultado = await runTrexAutoLearner({ empresaId, dia, force: true });

    console.log(`📊 MÉTRICAS GERAIS DE HOJE:`);
    console.log(`• Total de sessões ativas: ${resultado.totalSessoes}`);
    console.log(`• Total de mensagens processadas: ${resultado.totalMensagens}`);
    console.log(`• Resoluções autônomas diretas: ${resultado.sessoesAutonomas} (${resultado.taxaSucessoAutonomo}%)`);
    console.log(`• Transbordos para equipe humana: ${resultado.sessoesHandoff} (${resultado.taxaHandoff}%)\n`);

    console.log(`🔍 MOTIVOS DE TRANSBORDO HUMANO:`);
    console.log(`• Ambiguidade em remarcação/lembrete: ${resultado.motivosHandoff.ambiguidade_remarcacao}`);
    console.log(`• Horários incompatíveis (madrugada): ${resultado.motivosHandoff.horario_incompativel}`);
    console.log(`• Dúvidas ou serviços não encontrados: ${resultado.motivosHandoff.duvida_nao_respondida}`);
    console.log(`• Pedido explícito de atendente humano: ${resultado.motivosHandoff.pedido_humano}`);
    console.log(`• Intervenção manual da recepção: ${resultado.motivosHandoff.solicitacao_manual_equipe}\n`);

    console.log(`🧠 APRENDIZADO AUTOMÁTICO (KyttoIA Continuous Loop):`);
    console.log(`• Propostas operacionais geradas: ${resultado.propostasCriadas}`);
    console.log(`• Regras auto-aprovadas para produção: ${resultado.aprovadas}\n`);

    const diretrizes = await getDynamicLearnedGuidance(empresaId);
    if (diretrizes) {
      console.log(`📋 DIRETRIZES ATIVAS INJETADAS EM TEMPO REAL NO T-REX:`);
      console.log(diretrizes);
    }

    console.log(`\n================================================================`);
    console.log(`✅ Ciclo de auto-aprendizado concluído com sucesso!`);
    console.log(`================================================================`);
    process.exit(0);
  } catch (err) {
    console.error(`❌ Erro ao executar auto-aprendizado:`, err.message);
    process.exit(1);
  }
}

main();

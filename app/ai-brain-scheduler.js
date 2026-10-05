// Agendadores do cérebro do atendente (só rodam com Commerce Core ativo):
// - aprendizado: todo dia depois das 2h (Cuiabá), processa o dia anterior;
// - automações: a cada 30 min entre 9h e 20h, para empresas com cérebro e alguma automação ligada.

import { db } from './core/database.js';
import { startAiLearningScheduler } from './core/ai-learning.js';
import { localHour, runAutomationRound } from './core/ai-automations.js';
import { loadBrainGraph } from './ai-brain-data.js';

export async function runAutomationTick({ now = new Date() } = {}) {
  const hour = localHour(now);
  if (hour < 9 || hour >= 20) return [];
  const empresas = await db.queryRead(
    `SELECT s.empresa_id,
            (SELECT c.loja_id FROM canais_integracao c WHERE c.empresa_id = s.empresa_id AND c.provedor = 'whatsapp' AND c.status = 'ativo'
              ORDER BY c.data_atualizacao DESC NULLS LAST LIMIT 1) AS loja_id
       FROM ai_brain_settings s
      WHERE s.ativo = true AND EXISTS (SELECT 1 FROM jsonb_each_text(s.automacoes) a WHERE a.value = 'true')`,
  ).catch(() => ({ rows: [] }));
  const results = [];
  for (const row of empresas.rows) {
    if (!row.loja_id) continue;
    try {
      const result = await runAutomationRound({
        empresaId: row.empresa_id,
        lojaId: row.loja_id,
        // No store JSON da barbearia a empresa do Commerce usa o mesmo id (padrão já usado pelos lembretes de agenda).
        loadGraph: () => loadBrainGraph({ legacyEmpresaId: row.empresa_id, empresaId: row.empresa_id, commerceLojaId: row.loja_id, legacyLojaId: row.loja_id }),
        now,
      });
      results.push({ empresa: String(row.empresa_id).slice(0, 8), ...result });
    } catch (error) {
      console.warn('[Cérebro] rodada de automações falhou:', String(error?.code || error?.message || 'erro').slice(0, 120));
    }
  }
  return results;
}

export function startAiBrainSchedulers() {
  if (process.env.COMMERCE_CORE_ENABLED !== '1') return { learning: null, automations: null };
  const learning = startAiLearningScheduler();
  let automations = null;
  if (process.env.AI_AUTOMATION_SCHEDULER !== 'false') {
    let running = false;
    automations = setInterval(async () => {
      if (running) return;
      running = true;
      try {
        const results = await runAutomationTick();
        for (const item of results) if (item.queued) console.log(JSON.stringify({ worker: 'ai-automations', ...item }));
      } finally { running = false; }
    }, 30 * 60 * 1000);
    automations.unref?.();
  }
  return { learning, automations };
}


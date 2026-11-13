/**
 * ============================================================================
 * MOTOR DE AUTO-APRENDIZADO CONTÍNUO DO T-REX (AUTO-LEARNING LOOP)
 * Barbearia Dino & Kytto ERP - WhatsApp AI
 * ============================================================================
 * Monitora e audita diariamente os atendimentos do T-Rex, calcula a taxa de
 * resolução autônoma direta vs. transbordo humano, diagnostica atritos e
 * alimenta automaticamente a base dinâmica de conhecimento e diretrizes da IA.
 * ============================================================================
 */

import { db } from './database.js';
import { runAiTask } from './ai-router.js';
import { proposalKey } from './ai-learning.js';
import { localDateIso } from './whatsapp-ai-tools.js';

const TZ = 'America/Cuiaba';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value, limit = 500) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

/**
 * Audita detalhadamente as sessões e mensagens de um dia específico.
 * Calcula a taxa de sucesso autônomo, transbordo para humanos e motivos de atrito.
 */
export async function auditDailySessions({ empresaId, lojaId = null, dia = localDateIso(), query = db.query.bind(db) } = {}) {
  const params = [empresaId, dia];
  let lojaFilter = '';
  if (lojaId && UUID_REGEX.test(String(lojaId))) {
    params.push(lojaId);
    lojaFilter = ` AND s.loja_id = $3`;
  }

  // 1. Total de sessões ativas no dia
  const sessionsResult = await query(
    `SELECT s.id, s.telefone, s.nome, s.status, s.assigned_to, s.acao_pendente, s.estado, s.criado_em, s.atualizado_em,
            COUNT(m.id) AS total_mensagens,
            COUNT(m.id) FILTER (WHERE m.papel = 'user') AS mensagens_cliente,
            COUNT(m.id) FILTER (WHERE m.papel = 'assistant') AS mensagens_assistente
       FROM whatsapp_ai_sessions s
       JOIN whatsapp_ai_messages m ON m.sessao_id = s.id AND m.empresa_id = s.empresa_id
      WHERE s.empresa_id = $1
        AND (m.criado_em AT TIME ZONE '${TZ}')::date = $2::date
        ${lojaFilter}
      GROUP BY s.id, s.telefone, s.nome, s.status, s.assigned_to, s.acao_pendente, s.estado, s.criado_em, s.atualizado_em
      ORDER BY s.atualizado_em DESC`,
    params
  );

  const totalSessoes = sessionsResult.rows.length;
  let totalMensagens = 0;
  let sessoesHandoff = 0;
  let sessoesAutonomas = 0;
  const motivosHandoff = {
    pedido_humano: 0,
    ambiguidade_remarcacao: 0,
    horario_incompativel: 0,
    duvida_nao_respondida: 0,
    solicitacao_manual_equipe: 0,
    outros: 0
  };

  const detalhesSessoes = [];

  for (const s of sessionsResult.rows) {
    const msgs = Number(s.total_mensagens || 0);
    totalMensagens += msgs;

    const foiHandoff = s.status === 'humano' || Boolean(s.assigned_to);

    if (foiHandoff) {
      sessoesHandoff += 1;
      // Inspecionar histórico para categorizar o motivo
      const msgsHist = await query(
        `SELECT papel, conteudo, metadados FROM whatsapp_ai_messages
          WHERE sessao_id = $1 ORDER BY criado_em ASC LIMIT 25`,
        [s.id]
      ).catch(() => ({ rows: [] }));

      const textoCompleto = msgsHist.rows.map((m) => m.conteudo || '').join(' ').toLowerCase();

      if (/falar com (humano|atendente|pessoa|alguem)|humano/i.test(textoCompleto)) {
        motivosHandoff.pedido_humano += 1;
      } else if (/qual deles|v[aá]rios agendamentos|qual agendamento/i.test(textoCompleto)) {
        motivosHandoff.ambiguidade_remarcacao += 1;
      } else if (/6h|06:00|cedo demais|madrugada|hor[aá]rio n[aã]o d[aá]/i.test(textoCompleto)) {
        motivosHandoff.horario_incompativel += 1;
      } else if (/n[aã]o consegui encontrar|c[oó]digo|erro/i.test(textoCompleto)) {
        motivosHandoff.duvida_nao_respondida += 1;
      } else {
        motivosHandoff.solicitacao_manual_equipe += 1;
      }
    } else {
      sessoesAutonomas += 1;
    }

    detalhesSessoes.push({
      sessionId: s.id,
      telefone: s.telefone,
      nome: s.nome,
      mensagens: msgs,
      autonoma: !foiHandoff,
      status: s.status,
      assignedTo: s.assigned_to
    });
  }

  const taxaSucessoAutonomo = totalSessoes > 0 ? Number(((sessoesAutonomas / totalSessoes) * 100).toFixed(1)) : 100.0;
  const taxaHandoff = totalSessoes > 0 ? Number(((sessoesHandoff / totalSessoes) * 100).toFixed(1)) : 0.0;

  return {
    dia,
    totalSessoes,
    totalMensagens,
    sessoesAutonomas,
    sessoesHandoff,
    taxaSucessoAutonomo,
    taxaHandoff,
    motivosHandoff,
    detalhesSessoes
  };
}

/**
 * Registra ou atualiza proposta de conhecimento/resposta na tabela ai_learning_proposals
 */
export async function recordLearningProposal({ empresaId, tipo, chave, titulo, proposta = null, status = 'proposto', evidencia = {}, query = db.query.bind(db) }) {
  if (!UUID_REGEX.test(String(empresaId || ''))) return false;
  const key = (chave || proposalKey(titulo)).slice(0, 160);
  if (key.length < 5) return false;

  await query(
    `INSERT INTO ai_learning_proposals (empresa_id, tipo, chave, titulo, proposta, status, evidencias, ocorrencias, atualizado_em)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 1, CURRENT_TIMESTAMP)
     ON CONFLICT (empresa_id, tipo, chave) DO UPDATE SET
       ocorrencias = ai_learning_proposals.ocorrencias + 1,
       proposta = COALESCE(EXCLUDED.proposta, ai_learning_proposals.proposta),
       status = CASE WHEN EXCLUDED.status = 'aprovado' THEN 'aprovado' ELSE ai_learning_proposals.status END,
       evidencias = CASE WHEN jsonb_array_length(ai_learning_proposals.evidencias) >= 8 THEN ai_learning_proposals.evidencias
                         ELSE ai_learning_proposals.evidencias || EXCLUDED.evidencias END,
       atualizado_em = CURRENT_TIMESTAMP`,
    [empresaId, tipo, key, clean(titulo, 200), proposta ? clean(proposta, 600) : null, status, JSON.stringify([evidencia])]
  );
  return true;
}

/**
 * Auto-aprova padrões aprendidos de alta frequência (recorrência >= 2)
 */
export async function autoApproveHighConfidenceLearnings(empresaId, { query = db.query.bind(db) } = {}) {
  if (!UUID_REGEX.test(String(empresaId || ''))) return 0;
  const res = await query(
    `UPDATE ai_learning_proposals
        SET status = 'aprovado', decidido_por = 'kyttoia_auto_learner', decidido_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND status = 'proposto' AND proposta IS NOT NULL AND ocorrencias >= 2
      RETURNING id`,
    [empresaId]
  );
  return res.rows.length;
}

/**
 * Retorna as diretrizes aprendidas dinamicamente pelo Auto-Learner para injetar no prompt do T-Rex em tempo real.
 */
export async function getDynamicLearnedGuidance(empresaId, { query = db.query.bind(db), limit = 10 } = {}) {
  if (!UUID_REGEX.test(String(empresaId || ''))) return '';
  try {
    const result = await query(
      `SELECT tipo, titulo, proposta FROM ai_learning_proposals
        WHERE empresa_id = $1 AND status = 'aprovado' AND proposta IS NOT NULL
        ORDER BY ocorrencias DESC, atualizado_em DESC LIMIT $2`,
      [empresaId, limit]
    );

    if (!result.rows.length) return '';

    const linhas = result.rows.map((r) => {
      const tag = r.tipo === 'faq' ? 'Dúvida Frequente' : 'Objeção/Preferência';
      return `• [${tag}] "${r.titulo}": ${r.proposta}`;
    });

    return `\nDIRETRIZES E RESPOSTAS AUTO-APRENDIDAS (KyttoIA Continuous Learning Loop):\n${linhas.join('\n')}`;
  } catch (err) {
    if (err?.code === '42P01') return '';
    return '';
  }
}

/**
 * Executa o ciclo completo de auto-aprendizado do T-Rex para uma data.
 */
export async function runTrexAutoLearner({ empresaId, lojaId = null, dia = localDateIso(), force = false, query = db.query.bind(db), router = runAiTask } = {}) {
  if (!UUID_REGEX.test(String(empresaId || ''))) throw new Error('empresaId inválido');

  const auditoria = await auditDailySessions({ empresaId, lojaId, dia, query });

  // Iniciar registro de run
  const runInsert = await query(
    `INSERT INTO ai_learning_runs (empresa_id, dia, status, resumo, iniciado_em)
     VALUES ($1, $2, 'executando', $3::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (empresa_id, dia) DO UPDATE SET
       status = 'executando', iniciado_em = CURRENT_TIMESTAMP, concluido_em = NULL
     RETURNING id`,
    [empresaId, dia, JSON.stringify(auditoria)]
  );
  const runId = runInsert.rows[0]?.id;

  let propostasCriadas = 0;

  // Registrar propostas operacionais preventivas baseadas nos atritos do dia
  if (auditoria.motivosHandoff.ambiguidade_remarcacao > 0) {
    await recordLearningProposal({
      empresaId,
      tipo: 'faq',
      chave: 'remarcacao_focal_lembrete',
      titulo: 'Cliente respondeu "Remarca" ou pediu outro horário após lembrete',
      proposta: 'Vincular diretamente a remarcação ao agendamento lembrado sem gerar ambiguidade.',
      status: 'aprovado',
      evidencia: { dia, ocorrencias: auditoria.motivosHandoff.ambiguidade_remarcacao },
      query
    });
    propostasCriadas += 1;
  }

  if (auditoria.motivosHandoff.horario_incompativel > 0) {
    await recordLearningProposal({
      empresaId,
      tipo: 'objecao',
      chave: 'horarios_fora_expediente_madrugada',
      titulo: 'Cliente recusou horários antes das 08h da manhã',
      proposta: 'Nunca sugerir horários entre 06h00 e 07h30 da manhã a menos que solicitado expressamente.',
      status: 'aprovado',
      evidencia: { dia, ocorrencias: auditoria.motivosHandoff.horario_incompativel },
      query
    });
    propostasCriadas += 1;
  }

  if (auditoria.motivosHandoff.duvida_nao_respondida > 0) {
    await recordLearningProposal({
      empresaId,
      tipo: 'faq',
      chave: 'servico_combo_corte_e_barba',
      titulo: 'Cliente pediu corte e barba e código do serviço gerou atrito',
      proposta: 'Mapear automaticamente corte e barba para Combo Corte + Barba sem mensagens de erro de código.',
      status: 'aprovado',
      evidencia: { dia, ocorrencias: auditoria.motivosHandoff.duvida_nao_respondida },
      query
    });
    propostasCriadas += 1;
  }

  const aprovadas = await autoApproveHighConfidenceLearnings(empresaId, { query });

  // Finalizar run com sucesso
  const resumoFinal = {
    ...auditoria,
    propostasCriadas,
    aprovadas
  };

  if (runId) {
    await query(
      `UPDATE ai_learning_runs
          SET status = 'concluido', resumo = $2::jsonb, concluido_em = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [runId, JSON.stringify(resumoFinal)]
    );
  }

  return resumoFinal;
}

export default {
  auditDailySessions,
  recordLearningProposal,
  autoApproveHighConfidenceLearnings,
  getDynamicLearnedGuidance,
  runTrexAutoLearner
};

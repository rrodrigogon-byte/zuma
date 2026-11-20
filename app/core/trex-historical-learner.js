/**
 * ============================================================================
 * MOTOR KYTTOIA — REANÁLISE EXAUSTIVA HISTÓRICA DO T-REX
 * Barbearia Dino & Kytto ERP
 * ============================================================================
 * Executa uma análise profunda de todas as conversas do T-Rex desde a sua criação,
 * extrai e consolida todos os fatos aprendidos em ai_customer_facts, resumos em
 * ai_conversation_summaries, diretrizes em ai_learning_proposals e enriquece o
 * cadastro do cliente em clientes e db().clientes.
 * ============================================================================
 */
import { db } from './database.js';
import { memoryPhone, upsertFacts, FACT_CATEGORIES } from './ai-memory.js';
import { recordLearningProposal, autoApproveHighConfidenceLearnings } from './trex-auto-learner.js';

const TZ = 'America/Cuiaba';
const DINO_EMPRESA_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

function localDateIso(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date instanceof Date ? date : new Date(date));
}

function clean(value, limit = 300) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function dataFormatada(date) {
  if (!date) return '';
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

/**
 * Extrator semântico profundo de fatos comportamentais e preferências a partir
 * de um conjunto de mensagens reais de WhatsApp.
 */
export function extractFactsFromMessages(messages = []) {
  const fatos = [];
  const historicoTexto = messages.map((m) => `${m.papel === 'user' ? 'Cliente' : 'T-Rex'}: ${m.conteudo || m.texto || ''}`).join('\n');
  const userMessages = messages.filter((m) => m.papel === 'user');

  for (const m of userMessages) {
    const texto = String(m.conteudo || m.texto || '');
    const textoNorm = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 1. Barbeiro preferido
    if (/\b(com o bruno|marcar com bruno|bruno mendes|o bruno ta|com bruno)\b/.test(textoNorm)) {
      fatos.push({ chave: 'profissional_preferido', valor: 'Bruno Mendes Pedroso', categoria: 'profissional_preferido', confianca: 0.95, trecho: clean(texto, 150) });
    } else if (/\b(com a nati|com a nat|com a nath|com a natani|natani ta|com nati)\b/.test(textoNorm)) {
      fatos.push({ chave: 'profissional_preferido', valor: 'Natani (Nati)', categoria: 'profissional_preferido', confianca: 0.95, trecho: clean(texto, 150) });
    } else if (/\b(com o dino|mestre dino|corte com dino|com dino|com o guilherme)\b/.test(textoNorm)) {
      fatos.push({ chave: 'profissional_preferido', valor: 'Guilherme Cunha (Dino)', categoria: 'profissional_preferido', confianca: 0.95, trecho: clean(texto, 150) });
    }

    // 2. Serviços de interesse e hábitos
    if (/\b(corte e barba|cabelo e barba|barba e corte)\b/.test(textoNorm)) {
      fatos.push({ chave: 'servico_interesse_combo', valor: 'Combo Corte + Barba', categoria: 'servico_interesse', confianca: 0.95, trecho: clean(texto, 150) });
    } else if (/\b(corte infantil|meu filho|pro menino|corte pro meu filho)\b/.test(textoNorm)) {
      fatos.push({ chave: 'servico_interesse_infantil', valor: 'Corte Infantil', categoria: 'servico_interesse', confianca: 0.92, trecho: clean(texto, 150) });
    } else if (/\b(sobrancelha|sombrancelha|design de sobrancelha)\b/.test(textoNorm)) {
      fatos.push({ chave: 'servico_interesse_sobrancelha', valor: 'Design de Sobrancelha', categoria: 'servico_interesse', confianca: 0.90, trecho: clean(texto, 150) });
    } else if (/\b(limpeza de pele|esfoliacao facial|dermaplaning)\b/.test(textoNorm)) {
      fatos.push({ chave: 'servico_interesse_facial', valor: 'Limpeza de Pele Facial', categoria: 'servico_interesse', confianca: 0.90, trecho: clean(texto, 150) });
    } else if (/\b(desondulacao|selagem|progressiva|relaxamento)\b/.test(textoNorm)) {
      fatos.push({ chave: 'servico_interesse_quimica', valor: 'Selagem / Desondulação', categoria: 'servico_interesse', confianca: 0.90, trecho: clean(texto, 150) });
    } else if (/\b(barba premium|barboterapia|toalha quente|fazer a barba|so a barba|barba club)\b/.test(textoNorm)) {
      fatos.push({ chave: 'servico_interesse_barba', valor: 'Barba / Barboterapia', categoria: 'servico_interesse', confianca: 0.92, trecho: clean(texto, 150) });
    } else if (/\b(cortar cabelo|fazer o corte|so o corte|corte degrad[eê]|corte visagista)\b/.test(textoNorm)) {
      fatos.push({ chave: 'servico_interesse_corte', valor: 'Corte Masculino', categoria: 'servico_interesse', confianca: 0.92, trecho: clean(texto, 150) });
    }

    // 3. Estilo e corte
    if (/\b(degrade navalhado|navalhado|na navalha)\b/.test(textoNorm)) {
      fatos.push({ chave: 'estilo_corte', valor: 'Degradê Navalhado', categoria: 'estilo', confianca: 0.90, trecho: clean(texto, 150) });
    } else if (/\b(corte social|socialzinho|tesoura)\b/.test(textoNorm)) {
      fatos.push({ chave: 'estilo_corte', valor: 'Corte Social / Tesoura', categoria: 'estilo', confianca: 0.90, trecho: clean(texto, 150) });
    } else if (/\b(low fade|mid fade|high fade|taper fade)\b/.test(textoNorm)) {
      fatos.push({ chave: 'estilo_corte', valor: 'Fade Moderno', categoria: 'estilo', confianca: 0.90, trecho: clean(texto, 150) });
    }

    // 4. Preferência de horário
    const matchHorario = texto.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/);
    if (matchHorario) {
      const hh = matchHorario[1].padStart(2, '0');
      const mm = matchHorario[2] || '00';
      const horaStr = `${hh}:${mm}`;
      fatos.push({ chave: `horario_costume_${hh}`, valor: `Horário de costume: ${horaStr}`, categoria: 'preferencia_horario', confianca: 0.88, trecho: clean(texto, 150) });
    } else if (/\b(final de tarde|depois do trabalho|fim de tarde)\b/.test(textoNorm)) {
      fatos.push({ chave: 'periodo_costume', valor: 'Final de tarde (17h - 19h)', categoria: 'preferencia_horario', confianca: 0.85, trecho: clean(texto, 150) });
    } else if (/\b(parte da manha|de manha|cedo|primeiro horario)\b/.test(textoNorm)) {
      fatos.push({ chave: 'periodo_costume', valor: 'Manhã', categoria: 'preferencia_horario', confianca: 0.85, trecho: clean(texto, 150) });
    } else if (/\b(sabado|sabadao)\b/.test(textoNorm)) {
      fatos.push({ chave: 'dia_costume_sabado', valor: 'Sábado', categoria: 'preferencia_horario', confianca: 0.85, trecho: clean(texto, 150) });
    }

    // 5. Produtos de interesse e perfumaria
    if (/\b(pomada|matte|efeito seco|modeladora)\b/.test(textoNorm)) {
      fatos.push({ chave: 'produto_pomada_matte', valor: 'Pomada Modeladora Efeito Matte Dino', categoria: 'produto_interesse', confianca: 0.92, trecho: clean(texto, 150) });
    }
    if (/\b(oleo de barba|balm|hidratante de barba)\b/.test(textoNorm)) {
      fatos.push({ chave: 'produto_oleo_barba', valor: 'Óleo Hidratante de Barba Dino', categoria: 'produto_interesse', confianca: 0.92, trecho: clean(texto, 150) });
    }
    if (/\b(good girl)\b/.test(textoNorm)) {
      fatos.push({ chave: 'produto_good_girl', valor: 'Perfume Good Girl', categoria: 'produto_interesse', confianca: 0.95, trecho: clean(texto, 150) });
    }
    if (/\b(marina de bourbon)\b/.test(textoNorm)) {
      fatos.push({ chave: 'produto_marina_bourbon', valor: 'Perfume Marina de Bourbon', categoria: 'produto_interesse', confianca: 0.95, trecho: clean(texto, 150) });
    }
    if (/\b(ck be|calvin klein)\b/.test(textoNorm)) {
      fatos.push({ chave: 'produto_ck_be', valor: 'Perfume CK Be', categoria: 'produto_interesse', confianca: 0.95, trecho: clean(texto, 150) });
    }
    if (/\b(sauvage|dior)\b/.test(textoNorm)) {
      fatos.push({ chave: 'produto_sauvage', valor: 'Perfume Sauvage / Linha Dior', categoria: 'produto_interesse', confianca: 0.95, trecho: clean(texto, 150) });
    }
    if (/\b(212|vip black|one million|invictus|silver scent)\b/.test(textoNorm)) {
      fatos.push({ chave: 'produto_perfumaria_importada', valor: 'Perfumaria Importada de Alto Padrão', categoria: 'produto_interesse', confianca: 0.90, trecho: clean(texto, 150) });
    }
    if (/\b(feminino doce|perfume doce|adocicado)\b/.test(textoNorm)) {
      fatos.push({ chave: 'familia_olfativa_doce', valor: 'Feminino Doce / Floral', categoria: 'familia_olfativa', confianca: 0.90, trecho: clean(texto, 150) });
    } else if (/\b(amadeirado|oriental|caminho amadeirado)\b/.test(textoNorm)) {
      fatos.push({ chave: 'familia_olfativa_amadeirado', valor: 'Amadeirado / Oriental', categoria: 'familia_olfativa', confianca: 0.90, trecho: clean(texto, 150) });
    }

    // 6. Bebidas e recepção
    if (/\b(cafezinho|cafe sem acucar|cafe puro|tomar cafe)\b/.test(textoNorm)) {
      fatos.push({ chave: 'bebida_preferida', valor: 'Café sem açúcar', categoria: 'outro', confianca: 0.88, trecho: clean(texto, 150) });
    } else if (/\b(cerveja|chopp|cervejinha|gelada)\b/.test(textoNorm)) {
      fatos.push({ chave: 'bebida_preferida', valor: 'Cerveja gelada', categoria: 'outro', confianca: 0.88, trecho: clean(texto, 150) });
    } else if (/\b(agua com gas)\b/.test(textoNorm)) {
      fatos.push({ chave: 'bebida_preferida', valor: 'Água com gás', categoria: 'outro', confianca: 0.88, trecho: clean(texto, 150) });
    }

    // 7. Família e acompanhantes
    const matchFilho = texto.match(/\bfilho(?: dele| meu)?(?:\s+(?:chamado|chama|se chama))?\s+([A-ZÁÉÍÓÚ][a-záéíóú]+)/);
    if (matchFilho) {
      fatos.push({ chave: 'familiar_filho', valor: `Filho: ${matchFilho[1]}`, categoria: 'outro', confianca: 0.88, trecho: clean(texto, 150) });
    }
    const matchEsposa = texto.match(/\besposa(?:\s+(?:chamada|chama|se chama))?\s+([A-ZÁÉÍÓÚ][a-záéíóú]+)/);
    if (matchEsposa) {
      fatos.push({ chave: 'familiar_esposa', valor: `Esposa: ${matchEsposa[1]}`, categoria: 'outro', confianca: 0.88, trecho: clean(texto, 150) });
    }

    // 8. Pacote / Clube
    if (/\b(meu pacote|assinei o plano|club dino|plano mensal|tenho pacote)\b/.test(textoNorm)) {
      fatos.push({ chave: 'clube_assinatura', valor: 'Assinante / Membro Club Dino', categoria: 'outro', confianca: 0.95, trecho: clean(texto, 150) });
    }
  }

  // Deduplicação por chave
  const mapaUnico = new Map();
  for (const f of fatos) {
    if (!f.tipo && f.categoria) f.tipo = f.categoria;
    if (!mapaUnico.has(f.chave) || mapaUnico.get(f.chave).confianca < f.confianca) {
      mapaUnico.set(f.chave, f);
    }
  }

  return Array.from(mapaUnico.values());
}

/**
 * Gera resumo estruturado da conversa.
 */
export function summarizeSessionConversation(messages = []) {
  if (!messages.length) return null;
  const textos = messages.map((m) => String(m.conteudo || m.texto || '')).join(' ');
  const userTexts = messages.filter((m) => m.papel === 'user').map((m) => String(m.conteudo || m.texto || '')).join(' ');
  const norm = textos.toLowerCase();
  const userNorm = userTexts.toLowerCase();

  let resultado = 'duvida';
  if (/confirmad|t[aá] marcado|fechado!|agendamento confirmado|c[oó]digo: [0-9a-f]{8}/i.test(norm)) {
    resultado = 'agendou';
  } else if (/compr|pedido|pix|pagamento/i.test(norm) && /pago|recebido|separado/i.test(norm)) {
    resultado = 'comprou';
  } else if (/reclam|atras|insatisf|ruim|estrag/i.test(userNorm)) {
    resultado = 'reclamacao';
  } else if (/chamei algu[eé]m|equipe humana|transbordo|passar para atendente/i.test(norm)) {
    resultado = 'humano';
  }

  let sentimento = 'positivo';
  if (/obrigad|valeu|top|show|maravilha|perfeito|excelente|bom demais/i.test(userNorm)) {
    sentimento = 'positivo';
  } else if (/reclam|chato|demor|atraso|pessimo|horrivel|insatisfeito/i.test(userNorm)) {
    sentimento = 'negativo';
  } else {
    sentimento = 'neutro';
  }

  // Síntese concisa de 1 a 2 frases
  let resumoTexto = '';
  if (resultado === 'agendou') {
    resumoTexto = 'Cliente consultou disponibilidade e concluiu agendamento de horário com a equipe da Barbearia Dino.';
  } else if (resultado === 'comprou') {
    resumoTexto = 'Cliente tirou dúvidas comerciais e negociou aquisição de produtos/perfumaria.';
  } else if (resultado === 'reclamacao') {
    resumoTexto = 'Cliente manifestou insatisfação ou atrito operacional e recebeu acolhimento da equipe.';
  } else if (resultado === 'humano') {
    resumoTexto = 'Atendimento necessitou de suporte ou intervenção da recepção/gestão humana.';
  } else {
    resumoTexto = 'Cliente interagiu com o T-Rex para consulta de serviços, catálogo ou esclarecimento de dúvidas.';
  }

  return {
    resultado,
    sentimento,
    resumo: resumoTexto,
  };
}

/**
 * Executa a reanálise completa de todas as conversas do T-Rex desde a sua criação.
 */
export async function runFullHistoricalAnalysis({
  empresaId = DINO_EMPRESA_ID,
  query = db.query.bind(db),
  force = true,
  log = console.log,
} = {}) {
  if (!force) {
    try {
      const checkSummaries = await query(
        `SELECT COUNT(*)::int AS total FROM ai_conversation_summaries WHERE empresa_id = $1 AND dia >= CURRENT_DATE - 1`,
        [empresaId]
      );
      if ((checkSummaries.rows[0]?.total || 0) > 0) {
        log(`[KyttoIA Historical Learner] Base histórica consolidada recentemente (${checkSummaries.rows[0].total} resumos). Inicialização otimizada.`);
        return {
          ok: true,
          motivo: 'ja_consolidado_recentemente',
          resumosRecentes: checkSummaries.rows[0].total,
        };
      }
    } catch (errCheck) {
      // Continua se a verificação falhar
    }
  }
  const inicioMs = Date.now();
  log(`[KyttoIA Historical Learner] Iniciando análise exaustiva de todas as conversas para empresa ${empresaId}...`);

  // 1. Obter todas as sessões e total de mensagens da empresa
  const sessionsRes = await query(
    `SELECT s.id, s.telefone, s.nome, s.loja_id, s.criado_em, s.atualizado_em,
            COUNT(m.id) AS total_mensagens
       FROM whatsapp_ai_sessions s
       LEFT JOIN whatsapp_ai_messages m ON m.sessao_id = s.id AND m.empresa_id = s.empresa_id
      WHERE s.empresa_id = $1
      GROUP BY s.id, s.telefone, s.nome, s.loja_id, s.criado_em, s.atualizado_em
      ORDER BY s.atualizado_em DESC`,
    [empresaId]
  );

  const totalSessoes = sessionsRes.rows.length;
  log(`[KyttoIA Historical Learner] ${totalSessoes} sessões encontradas.`);

  // 2. Obter todas as mensagens ordenadas cronologicamente
  const messagesRes = await query(
    `SELECT m.id, m.sessao_id, m.papel, m.conteudo, m.criado_em, s.telefone, s.nome, s.loja_id
       FROM whatsapp_ai_messages m
       JOIN whatsapp_ai_sessions s ON s.id = m.sessao_id AND s.empresa_id = m.empresa_id
      WHERE m.empresa_id = $1 AND m.conteudo IS NOT NULL AND m.papel IN ('user', 'assistant')
      ORDER BY s.telefone, m.criado_em ASC`,
    [empresaId]
  );

  const totalMensagens = messagesRes.rows.length;
  log(`[KyttoIA Historical Learner] ${totalMensagens} mensagens ordenadas para processamento.`);

  // 3. Agrupar mensagens por telefone e por dia
  const conversasPorTelefone = new Map();
  for (const m of messagesRes.rows) {
    const fone = memoryPhone(m.telefone);
    if (!fone) continue;
    if (!conversasPorTelefone.has(fone)) {
      conversasPorTelefone.set(fone, {
        telefone: fone,
        nome: m.nome,
        lojaId: m.loja_id,
        sessaoId: m.sessao_id,
        mensagens: [],
        porDia: new Map(),
      });
    }
    const c = conversasPorTelefone.get(fone);
    c.mensagens.push(m);

    const diaStr = dataFormatada(m.criado_em);
    if (!c.porDia.has(diaStr)) c.porDia.set(diaStr, []);
    c.porDia.get(diaStr).push(m);
  }

  const totalClientes = conversasPorTelefone.size;
  log(`[KyttoIA Historical Learner] ${totalClientes} clientes únicos com conversas identificados.`);

  let totalFatosCriados = 0;
  let totalResumosCriados = 0;
  let clientesAtualizados = 0;

  // 4. Processar cada cliente
  for (const [fone, dadosCliente] of conversasPorTelefone.entries()) {
    // A) Extrair todos os fatos das mensagens do cliente
    const fatosExtraidos = extractFactsFromMessages(dadosCliente.mensagens);

    // B) Gerar resumos para cada dia em que houve conversa
    let ultimoResumoId = null;
    for (const [diaStr, msgsDia] of dadosCliente.porDia.entries()) {
      const analiseResumo = summarizeSessionConversation(msgsDia);
      if (analiseResumo) {
        try {
          const insertResumo = await query(
            `INSERT INTO ai_conversation_summaries 
             (empresa_id, loja_id, sessao_id, telefone, dia, mensagens, resultado, sentimento, resumo, modelo)
             VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10)
             ON CONFLICT (empresa_id, telefone, dia) DO UPDATE SET
               mensagens = EXCLUDED.mensagens,
               resultado = EXCLUDED.resultado,
               sentimento = EXCLUDED.sentimento,
               resumo = EXCLUDED.resumo,
               modelo = EXCLUDED.modelo
             RETURNING id`,
            [
              empresaId,
              dadosCliente.lojaId,
              dadosCliente.sessaoId,
              fone,
              diaStr,
              msgsDia.length,
              analiseResumo.resultado,
              analiseResumo.sentimento,
              analiseResumo.resumo,
              'kyttoia-historical-engine',
            ]
          );
          if (insertResumo.rows[0]?.id) {
            ultimoResumoId = insertResumo.rows[0].id;
            totalResumosCriados += 1;
          }
        } catch (errResumo) {
          // Ignora conflitos de chave ou esquema antigo
        }
      }
    }

    // C) Gravar fatos aprendidos em ai_customer_facts
    if (fatosExtraidos.length > 0) {
      try {
        const resultadoUpsert = await upsertFacts(query, {
          empresaId,
          telefone: fone,
          facts: fatosExtraidos,
          autonomia: 2,
          resumoId: ultimoResumoId,
          modelo: 'Motor KyttoIA 2.5 Flash (Aprendizado Histórico)',
          validadeDias: 365,
        });
        totalFatosCriados += (resultadoUpsert.saved || 0);
      } catch (errFacts) {
        log(`[KyttoIA Historical Learner] Erro ao gravar fatos de ${fone}: ${errFacts?.message}`);
      }
    }

    // D) Enriquecer o cadastro do cliente em clientes
    try {
      const profPref = fatosExtraidos.find((f) => f.categoria === 'profissional_preferido')?.valor;
      const servPref = fatosExtraidos.find((f) => f.categoria === 'servico_interesse')?.valor;
      const horaPref = fatosExtraidos.find((f) => f.categoria === 'preferencia_horario')?.valor;

      const tagsNovas = [];
      if (profPref) tagsNovas.push(`Barbeiro: ${profPref}`);
      if (servPref) tagsNovas.push(`Serviço: ${servPref}`);
      if (fatosExtraidos.some((f) => f.chave === 'clube_assinatura')) tagsNovas.push('Club Dino');
      if (fatosExtraidos.some((f) => f.categoria === 'produto_interesse')) tagsNovas.push('Interesse Produtos');

      if (tagsNovas.length > 0) {
        await query(
          `UPDATE clientes
              SET tags = COALESCE(tags, '[]'::jsonb) || $2::jsonb
            WHERE empresa_id = $1 AND (telefone = $3 OR telefone = $4)`,
          [empresaId, JSON.stringify(tagsNovas), fone, fone.replace(/^55/, '')]
        );
        clientesAtualizados += 1;
      }
    } catch (_) {}
  }

  // 5. Consolidar e auto-aprovar propostas no cérebro
  let propostasConsolidadas = 0;
  try {
    await recordLearningProposal({
      empresaId,
      tipo: 'faq',
      chave: 'barbeiros_ativos_dino',
      titulo: 'Quais barbeiros atendem corte e barba na Barbearia Dino?',
      proposta: 'Os barbeiros ativos para corte e barba são Bruno, Nati e Dino. Ester e Jhenyffer atuam na administração/recepção.',
      status: 'aprovado',
      evidencia: { motivo: 'consolidacao_historica', totalConversas: totalSessoes },
      query,
    });
    await recordLearningProposal({
      empresaId,
      tipo: 'faq',
      chave: 'combo_corte_barba_prioridade',
      titulo: 'Cliente solicita corte e barba juntos',
      proposta: 'Alocar automaticamente o Combo Corte + Barba com o profissional de preferência do cliente.',
      status: 'aprovado',
      evidencia: { motivo: 'consolidacao_historica', totalConversas: totalSessoes },
      query,
    });
    await recordLearningProposal({
      empresaId,
      tipo: 'objecao',
      chave: 'pontualidade_e_agilidade',
      titulo: 'Cliente tem pressa ou pede atendimento rápido',
      proposta: 'Acolher cordialmente, avisar o barbeiro e garantir alinhamento sem atrasos.',
      status: 'aprovado',
      evidencia: { motivo: 'consolidacao_historica', totalConversas: totalSessoes },
      query,
    });
    propostasConsolidadas = await autoApproveHighConfidenceLearnings(empresaId, { query });
  } catch (errProp) {
    log(`[KyttoIA Historical Learner] Aviso em propostas: ${errProp?.message}`);
  }

  const duracaoSegundos = Math.round((Date.now() - inicioMs) / 1000);
  const resultadoFinal = {
    ok: true,
    empresaId,
    totalSessoes,
    totalMensagens,
    totalClientes,
    totalFatosCriados,
    totalResumosCriados,
    clientesAtualizados,
    propostasConsolidadas,
    duracaoSegundos,
  };

  log(`[KyttoIA Historical Learner] Concluído em ${duracaoSegundos}s:`, resultadoFinal);
  return resultadoFinal;
}

export default {
  extractFactsFromMessages,
  summarizeSessionConversation,
  runFullHistoricalAnalysis,
};

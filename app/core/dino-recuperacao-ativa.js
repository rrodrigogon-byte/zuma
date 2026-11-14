/**
 * Módulo: Recuperação Ativa Diária de Clientes Inativos (> 60 dias)
 * Barbearia Dino & Perfumaria — Motor KyttoIA
 *
 * Responsável por selecionar diariamente 10 clientes da base que não comparecem
 * há mais de 60 dias e enviar uma abordagem humanizada, personalizada e consultiva
 * em nome do T-Rex, oferecendo benefícios de retorno, resgate de vínculo e link de agendamento.
 */
import { db } from './database.js';
import { enviarMensagem } from './whatsapp.js';
import { db as getDb, save } from '../db.js';

export const EMPRESA_DINO_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

function extrairPrimeiroNome(nomeCompleto) {
  if (!nomeCompleto) return 'Amigo';
  const limpo = String(nomeCompleto).trim().replace(/^(Lead\s+WhatsApp|\(\d+\)|Cliente\s+WhatsApp|Sr\.?|Dr\.?)/i, '').trim();
  const primeiro = limpo.split(/\s+/)[0];
  if (!primeiro || primeiro.length < 2 || /^\d+$/.test(primeiro)) return 'Amigo';
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
}

/**
 * Garante a criação da tabela de auditoria e controle de disparos
 */
export async function criarTabelaLogRecuperacao() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_ai_recuperacoes_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      empresa_id UUID NOT NULL,
      cliente_id UUID,
      cliente_nome VARCHAR(255),
      cliente_telefone VARCHAR(50) NOT NULL,
      mensagem TEXT NOT NULL,
      dias_inativo INTEGER,
      status VARCHAR(50) DEFAULT 'enviado',
      disparado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_recuperacoes_telefone ON whatsapp_ai_recuperacoes_log(cliente_telefone);
    CREATE INDEX IF NOT EXISTS idx_recuperacoes_data ON whatsapp_ai_recuperacoes_log(disparado_em);
  `).catch((err) => console.warn('[RecuperacaoAtiva] Erro ao criar tabela:', err.message));
}

/**
 * Lista clientes da base que estão há mais de X dias sem interação ou atendimento
 * e que não receberam mensagem de recuperação nos últimos 30 dias.
 */
export async function listarClientesElegiveisRecuperacao({ diasInativo = 60, limite = 10 } = {}) {
  await criarTabelaLogRecuperacao();

  const query = `
    WITH ultimas_interacoes AS (
      SELECT 
        s.telefone,
        s.nome AS nome_sessao,
        MAX(m.criado_em) AS ultima_data,
        COUNT(m.id) AS total_historico
      FROM whatsapp_ai_sessions s
      JOIN whatsapp_ai_messages m ON m.sessao_id = s.id
      WHERE s.empresa_id = $1 OR s.empresa_id IS NULL
      GROUP BY s.telefone, s.nome
    ),
    recuperacoes_recentes AS (
      SELECT cliente_telefone
      FROM whatsapp_ai_recuperacoes_log
      WHERE disparado_em >= CURRENT_TIMESTAMP - INTERVAL '30 days'
    )
    SELECT 
      c.id AS cliente_id,
      COALESCE(NULLIF(c.nome, ''), u.nome_sessao, 'Cliente Dino') AS nome,
      c.telefone,
      u.ultima_data,
      COALESCE(u.total_historico, 0) AS total_interacoes,
      ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - u.ultima_data)) / 86400) AS dias_sem_visita
    FROM clientes c
    LEFT JOIN ultimas_interacoes u ON (
      u.telefone = c.telefone 
      OR u.telefone = REPLACE(c.telefone, '+', '')
      OR RIGHT(u.telefone, 8) = RIGHT(c.telefone, 8)
    )
    LEFT JOIN recuperacoes_recentes r ON (
      r.cliente_telefone = c.telefone 
      OR RIGHT(r.cliente_telefone, 8) = RIGHT(c.telefone, 8)
    )
    WHERE c.empresa_id = $1
      AND c.ativo = TRUE
      AND r.cliente_telefone IS NULL
      AND (
        u.ultima_data IS NULL 
        OR u.ultima_data <= CURRENT_TIMESTAMP - ($2 || ' days')::INTERVAL
      )
      AND LENGTH(REGEXP_REPLACE(c.telefone, '\\D', '', 'g')) >= 10
    ORDER BY u.ultima_data ASC NULLS FIRST, c.criado_em ASC
    LIMIT $3;
  `;

  try {
    const res = await db.query(query, [EMPRESA_DINO_ID, diasInativo, limite]);
    return res.rows;
  } catch (error) {
    console.error('[RecuperacaoAtiva] Erro ao listar clientes elegíveis:', error);
    return [];
  }
}

/**
 * Gera mensagem humanizada do T-Rex com tom consultivo e acolhedor
 */
export function gerarMensagemRecuperacaoTrex(cliente) {
  const primeiroNome = extrairPrimeiroNome(cliente.nome);
  const dias = cliente.dias_sem_visita ? `faz mais de ${Math.floor(cliente.dias_sem_visita)} dias` : 'faz um tempinho';

  return `Fala, ${primeiroNome}! Tudo bem por aí? Aqui é o T-Rex da Barbearia Dino! 💈🦖

Notei aqui que ${dias} que você não passa para dar aquele talento no visual com a nossa equipe! Como estão as coisas?

Preparamos uma condição especial para o seu retorno nesta semana: no seu corte ou barba com o Bruno ou a Nati, você ganha um café espresso gourmet ou uma cerveja artesanal trincando da nossa chopeira, além de concorrer aos nossos sorteios semanais da roleta! 🎁

Qual dia fica melhor pra você passar aqui: quinta, sexta ou sábado?

Se preferir conferir os horários livres e garantir direto na agenda online:
👉 https://kytto.com.br/agendar/dino

Abraço e te esperamos por aqui!`;
}

/**
 * Executa o disparo ativo para até 10 clientes inativos
 */
export async function executarRecuperacaoAtivaDiaria(tenant = {}, { limite = 10, simular = false } = {}) {
  await criarTabelaLogRecuperacao();
  const elegiveis = await listarClientesElegiveisRecuperacao({ diasInativo: 60, limite });

  const resultados = [];
  console.log(`[RecuperacaoAtiva] Iniciando rotina diária para ${elegiveis.length} clientes inativos...`);

  for (const cliente of elegiveis) {
    const mensagem = gerarMensagemRecuperacaoTrex(cliente);
    let statusEnvio = simular ? 'simulado' : 'enviado';

    if (!simular) {
      try {
        const tenantConfig = {
          ...tenant,
          empresa_id: EMPRESA_DINO_ID,
          whatsapp_instance: tenant?.whatsapp_instance || process.env.EVOLUTION_INSTANCE || 'dino',
        };
        await enviarMensagem(tenantConfig, cliente.telefone, mensagem);
      } catch (err) {
        console.warn(`[RecuperacaoAtiva] Falha no envio para ${cliente.telefone}:`, err.message);
        statusEnvio = 'erro: ' + err.message;
      }
    }

    // Gravar no log de recuperação
    await db.query(
      `INSERT INTO whatsapp_ai_recuperacoes_log 
        (empresa_id, cliente_id, cliente_nome, cliente_telefone, mensagem, dias_inativo, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        EMPRESA_DINO_ID,
        cliente.cliente_id,
        cliente.nome,
        cliente.telefone,
        mensagem,
        cliente.dias_sem_visita || 60,
        statusEnvio,
      ]
    ).catch((e) => console.warn('[RecuperacaoAtiva] Erro ao gravar log:', e.message));

    resultados.push({
      cliente_id: cliente.cliente_id,
      nome: cliente.nome,
      telefone: cliente.telefone,
      dias_sem_visita: cliente.dias_sem_visita,
      status: statusEnvio,
    });
  }

  return {
    total_processados: resultados.length,
    resultados,
    executado_em: new Date().toISOString(),
  };
}

/**
 * Worker contínuo de Recuperação Ativa
 * Executa todos os dias às 09:30 da manhã (horário local de Cuiabá/MT UTC-4)
 */
export function startDinoRecuperacaoAtivaWorker() {
  console.log('[RecuperacaoAtiva] Worker de recuperação diária de 10 clientes inativos inicializado.');

  setInterval(async () => {
    try {
      // Obter hora local de Cuiabá (UTC-4)
      const agora = new Date();
      const horaCuiabaStr = agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit' });
      const diaChave = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' });

      // Disparar às 09:30 da manhã
      const [hora, minuto] = horaCuiabaStr.split(':').map(Number);
      if (hora === 9 && minuto >= 30 && minuto <= 45) {
        // Verificar se já rodou hoje
        const dbLocal = getDb();
        if (dbLocal?.dinoRecuperacaoUltimoDia === diaChave) return;

        console.log(`[RecuperacaoAtiva] Disparando lote diário de 10 clientes inativos em ${diaChave} às ${horaCuiabaStr}...`);
        await executarRecuperacaoAtivaDiaria({}, { limite: 10, simular: false });

        if (dbLocal) {
          dbLocal.dinoRecuperacaoUltimoDia = diaChave;
          save();
        }
      }
    } catch (err) {
      console.warn('[RecuperacaoAtiva] Erro no ciclo do worker:', err.message);
    }
  }, 10 * 60 * 1000); // Checa a cada 10 minutos
}

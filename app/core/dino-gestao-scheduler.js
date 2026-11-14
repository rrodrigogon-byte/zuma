/**
 * dino-gestao-scheduler.js
 * Agendador Operacional Autônomo para Governança do Ecossistema Dino:
 * - 08h30 (Cuiabá/MT): Pauta Diária do Instagram & Roteiro de Reels do Motor KyttoIA 2.5 Flash
 * - 20h00 (Cuiabá/MT): Fechamento Consolidado Noturno (SocialBlade, Vitrine LTK e Ocupação Trex)
 * 
 * Canais oficiais: WhatsApp Rodrigo (5514997462929) e Grupo Gestão Dino (5565996722055 / 556596722055).
 */

import { dispararPautaDiariaWhatsApp, formatarPautaDiariaWhatsApp, NUMEROS_GESTAO_DINO } from './dino-ltk-commerce-engine.js';
import { dispararReportDiarioWhatsApp, formatarReportDiarioWhatsApp, hojeCuiaba } from './dino-influencer-growth-engine.js';

// Estado em memória do agendador
const estadoAgendador = {
  ativo: true,
  intervaloMs: 60000, // 60 segundos
  ultimoCheck: null,
  ultimaPautaEnviada: null, // YYYY-MM-DD
  ultimoFechamentoEnviado: null, // YYYY-MM-DD
  historicoExecucoes: [],
  errosRecentes: []
};

let timerRef = null;

/**
 * Retorna as horas e minutos atuais no fuso horário de Cuiabá/MT (America/Cuiaba - GMT-4)
 */
export function obterHoraMinutoCuiaba(data = new Date()) {
  const formatador = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Cuiaba',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const partes = formatador.formatToParts(data);
  const hora = parseInt(partes.find(p => p.type === 'hour')?.value || '0', 10);
  const minuto = parseInt(partes.find(p => p.type === 'minute')?.value || '0', 10);
  return { hora, minuto, texto: `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}` };
}

/**
 * Registra uma execução no histórico em memória
 */
function registrarHistorico(tipo, status, detalhes = {}) {
  const registro = {
    id: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    tipo,
    status,
    timestamp: new Date().toISOString(),
    dataCuiaba: hojeCuiaba(),
    horaCuiaba: obterHoraMinutoCuiaba().texto,
    detalhes
  };
  estadoAgendador.historicoExecucoes.unshift(registro);
  if (estadoAgendador.historicoExecucoes.length > 50) {
    estadoAgendador.historicoExecucoes.pop();
  }
  return registro;
}

/**
 * Executa o disparo da pauta diária matinal (08h30 Cuiabá)
 */
export async function executarPautaDiaria({ forcar = false, targetPhones = null } = {}) {
  const dataHoje = hojeCuiaba();
  if (!forcar && estadoAgendador.ultimaPautaEnviada === dataHoje) {
    return { executado: false, motivo: 'Pauta de hoje já foi enviada', dataReferencia: dataHoje };
  }

  try {
    const resultado = await dispararPautaDiariaWhatsApp({ targetPhones });
    estadoAgendador.ultimaPautaEnviada = dataHoje;
    registrarHistorico('PAUTA_MATINAL_08H30', 'SUCESSO', {
      totalDisparados: resultado.totalDisparados,
      sucessos: resultado.sucessos,
      falhas: resultado.falhas
    });
    return {
      executado: true,
      dataReferencia: dataHoje,
      resultado
    };
  } catch (error) {
    const erroMsg = error?.message || 'Falha ao disparar pauta matinal';
    estadoAgendador.errosRecentes.unshift({ timestamp: new Date().toISOString(), tipo: 'PAUTA_MATINAL', erro: erroMsg });
    registrarHistorico('PAUTA_MATINAL_08H30', 'ERRO', { erro: erroMsg });
    throw error;
  }
}

/**
 * Executa o disparo do fechamento consolidado noturno (20h00 Cuiabá)
 */
export async function executarFechamentoNoturno({ forcar = false, targetPhones = null, db = null } = {}) {
  const dataHoje = hojeCuiaba();
  if (!forcar && estadoAgendador.ultimoFechamentoEnviado === dataHoje) {
    return { executado: false, motivo: 'Fechamento de hoje já foi enviado', dataReferencia: dataHoje };
  }

  try {
    const resultado = await dispararReportDiarioWhatsApp({ dataReferencia: dataHoje, targetPhones, db });
    estadoAgendador.ultimoFechamentoEnviado = dataHoje;
    const totalDisparados = (resultado.envios || []).length;
    const sucessos = (resultado.envios || []).filter(e => e.ok).length;
    registrarHistorico('FECHAMENTO_NOTURNO_20H00', 'SUCESSO', {
      totalDisparados,
      sucessos,
      falhas: totalDisparados - sucessos
    });
    return {
      executado: true,
      dataReferencia: dataHoje,
      resultado
    };
  } catch (error) {
    const erroMsg = error?.message || 'Falha ao disparar fechamento noturno';
    estadoAgendador.errosRecentes.unshift({ timestamp: new Date().toISOString(), tipo: 'FECHAMENTO_NOTURNO', erro: erroMsg });
    registrarHistorico('FECHAMENTO_NOTURNO_20H00', 'ERRO', { erro: erroMsg });
    throw error;
  }
}

/**
 * Avalia se o horário atual coincide com a janela de disparo programada
 */
export async function verificarGatilhosHorario(data = new Date(), { db = null } = {}) {
  const { hora, minuto, texto } = obterHoraMinutoCuiaba(data);
  const dataHoje = hojeCuiaba(data);
  estadoAgendador.ultimoCheck = new Date().toISOString();

  const acoesExecutadas = [];

  // Janela da Pauta Matinal: 08:30 até 08:59
  if (hora === 8 && minuto >= 30 && estadoAgendador.ultimaPautaEnviada !== dataHoje) {
    console.log(`[Dino Scheduler] Gatilho de Pauta Matinal acionado às ${texto} (Cuiabá/MT)...`);
    try {
      const res = await executarPautaDiaria();
      acoesExecutadas.push({ tipo: 'pauta_matinal', res });
    } catch (err) {
      console.error('[Dino Scheduler] Erro ao disparar pauta matinal:', err.message);
    }
  }

  // Janela do Fechamento Noturno: 20:00 até 20:59
  if (hora === 20 && minuto >= 0 && estadoAgendador.ultimoFechamentoEnviado !== dataHoje) {
    console.log(`[Dino Scheduler] Gatilho de Fechamento Noturno acionado às ${texto} (Cuiabá/MT)...`);
    try {
      const res = await executarFechamentoNoturno({ db });
      acoesExecutadas.push({ tipo: 'fechamento_noturno', res });
    } catch (err) {
      console.error('[Dino Scheduler] Erro ao disparar fechamento noturno:', err.message);
    }
  }

  return {
    horarioCuiaba: texto,
    dataHoje,
    acoesExecutadas
  };
}

/**
 * Inicia o loop do agendador em segundo plano
 */
export function iniciarAgendadorDinoGestao({ intervaloMs = 60000, db = null } = {}) {
  if (timerRef) {
    clearInterval(timerRef);
  }
  estadoAgendador.ativo = true;
  estadoAgendador.intervaloMs = intervaloMs;

  console.log(`[Dino Scheduler] Agendador operacional iniciado (verificação a cada ${intervaloMs / 1000}s). Janelas: 08h30 (Pauta) e 20h00 (Fechamento). Fuso: America/Cuiaba.`);

  timerRef = setInterval(() => {
    verificarGatilhosHorario(new Date(), { db }).catch(err => {
      console.error('[Dino Scheduler] Erro na verificação cíclica:', err);
    });
  }, intervaloMs);

  if (timerRef.unref) {
    timerRef.unref();
  }

  return {
    status: 'iniciado',
    intervaloMs,
    parar: pararAgendadorDinoGestao
  };
}

/**
 * Para o loop do agendador
 */
export function pararAgendadorDinoGestao() {
  if (timerRef) {
    clearInterval(timerRef);
    timerRef = null;
  }
  estadoAgendador.ativo = false;
  console.log('[Dino Scheduler] Agendador operacional finalizado.');
}

/**
 * Retorna o status operacional detalhado do agendador
 */
export function obterStatusAgendadorDino() {
  const agora = new Date();
  const horaCuiaba = obterHoraMinutoCuiaba(agora);
  const dataHoje = hojeCuiaba(agora);

  return {
    ativo: estadoAgendador.ativo,
    intervaloMs: estadoAgendador.intervaloMs,
    agoraUtc: agora.toISOString(),
    dataHojeCuiaba: dataHoje,
    horaCuiaba: horaCuiaba.texto,
    janelaPautaMatinal: '08:30 às 08:59 (America/Cuiaba)',
    janelaFechamentoNoturno: '20:00 às 20:59 (America/Cuiaba)',
    ultimaPautaEnviada: estadoAgendador.ultimaPautaEnviada,
    ultimoFechamentoEnviado: estadoAgendador.ultimoFechamentoEnviado,
    destinatariosOficiais: NUMEROS_GESTAO_DINO,
    totalExecucoesHistorico: estadoAgendador.historicoExecucoes.length,
    ultimasExecucoes: estadoAgendador.historicoExecucoes.slice(0, 10),
    errosRecentes: estadoAgendador.errosRecentes.slice(0, 5)
  };
}

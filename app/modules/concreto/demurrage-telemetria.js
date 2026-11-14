/**
 * ============================================================================
 * KYTTO ERP · SERRANO CONCRETO: TELEMETRIA DE BETONEIRAS & DEMURRAGE (NBR 7212)
 * ============================================================================
 * Monitoramento dos marcos temporais de entrega do concreto usinado:
 * 1. Saída da Usina (Início da contagem da água de amassamento)
 * 2. Chegada na Obra (Apresentação do romaneio e conferência do lacre)
 * 3. Início da Descarga (Slump teste NBR NM 67)
 * 4. Fim da Descarga (Lavagem do balão e retorno)
 *
 * Apura automaticamente o Demurrage (estadia excedente > 30 min a R$ 180/h)
 * e emite eventos de sincronização interna para Ultra e Nossa Gente.
 */
import { db, save } from '../../db.js';
import { kyttoEventBus } from '../../core/kytto-event-bus.js';

export const FRANQUIA_DESCARGA_MINUTOS = 30; // 30 minutos livres por contrato
export const TARIFA_DEMURRAGE_HORA = 180.00;  // R$ 180,00 por hora de espera excedente
export const TARIFA_DEMURRAGE_MINUTO = 3.00;  // R$ 3,00 por minuto
export const LIMITE_NBR7212_MINUTOS = 150;    // 2h30min máximo da água até fim da descarga

/**
 * Registra ou atualiza o marco temporal de uma viagem de betoneira
 */
export async function registrarMarcoViagemBetoneira(dados = {}) {
  const {
    cargaId,
    betoneiraId,
    motoristaNome,
    etapa, // 'saida_usina' | 'chegada_obra' | 'inicio_descarga' | 'fim_descarga'
    timestamp = new Date().toISOString(),
    slumpMedido = null,
    engenheiroResponsavel = '',
    lacreNumero = '',
    observacoes = '',
    usuario = 'motorista_app'
  } = dados;

  if (!cargaId || !betoneiraId || !etapa) {
    throw new Error('cargaId, betoneiraId e etapa são obrigatórios.');
  }

  const data = db();
  data.concreto_viagens_telemetria ||= [];

  // Localizar ou criar a viagem
  let viagem = data.concreto_viagens_telemetria.find(
    v => v.cargaId === cargaId && v.betoneiraId === betoneiraId && v.status !== 'finalizada'
  );

  if (!viagem) {
    viagem = {
      id: `vt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      cargaId,
      betoneiraId,
      motoristaNome: motoristaNome || 'Motorista Betoneira',
      status: 'em_transito',
      lacreNumero,
      marcos: {},
      slumpMedido: null,
      engenheiroResponsavel: '',
      demurrage: {
        tempoEsperaMinutos: 0,
        minutosExcedentes: 0,
        valorTotal: 0.0,
        apurado: false
      },
      alertaNbr7212: false,
      criadoEm: new Date().toISOString()
    };
    data.concreto_viagens_telemetria.unshift(viagem);
  }

  // Atualizar o marco temporal
  viagem.marcos[etapa] = {
    horario: timestamp,
    registradoPor: usuario,
    observacoes
  };

  if (slumpMedido != null) viagem.slumpMedido = Number(slumpMedido);
  if (engenheiroResponsavel) viagem.engenheiroResponsavel = engenheiroResponsavel;
  if (lacreNumero) viagem.lacreNumero = lacreNumero;

  // Atualizar status geral
  if (etapa === 'saida_usina') {
    viagem.status = 'em_transito';
  } else if (etapa === 'chegada_obra') {
    viagem.status = 'na_obra';
  } else if (etapa === 'inicio_descarga') {
    viagem.status = 'descarregando';
  } else if (etapa === 'fim_descarga') {
    viagem.status = 'finalizada';

    // ── CÁLCULO DE DEMURRAGE E LIMITES NBR 7212 ──
    const tChegada = viagem.marcos.chegada_obra?.horario ? new Date(viagem.marcos.chegada_obra.horario) : null;
    const tFim = new Date(timestamp);
    const tSaida = viagem.marcos.saida_usina?.horario ? new Date(viagem.marcos.saida_usina.horario) : null;

    if (tChegada && tFim > tChegada) {
      const duracaoObraMs = tFim.getTime() - tChegada.getTime();
      const duracaoObraMin = Math.round(duracaoObraMs / (1000 * 60));
      viagem.demurrage.tempoEsperaMinutos = duracaoObraMin;

      if (duracaoObraMin > FRANQUIA_DESCARGA_MINUTOS) {
        const excedente = duracaoObraMin - FRANQUIA_DESCARGA_MINUTOS;
        viagem.demurrage.minutosExcedentes = excedente;
        viagem.demurrage.valorTotal = Number((excedente * TARIFA_DEMURRAGE_MINUTO).toFixed(2));
        viagem.demurrage.apurado = true;

        // Disparar evento interno de Demurrage para faturamento no Ultra e Nossa Gente
        try {
          kyttoEventBus.emitirEvento('concreto.demurrage_apurado', {
            viagemId: viagem.id,
            cargaId: viagem.cargaId,
            betoneiraId: viagem.betoneiraId,
            motoristaNome: viagem.motoristaNome,
            tempoTotalObraMinutos: duracaoObraMin,
            franquiaMinutos: FRANQUIA_DESCARGA_MINUTOS,
            minutosExcedentes: excedente,
            valorDemurrage: viagem.demurrage.valorTotal,
            engenheiroResponsavel: viagem.engenheiroResponsavel
          }, {
            sistemaOrigem: 'Serrano Concreto Usinado',
            sistemaDestino: 'Ultra / Faturamento Construtoras',
            tipo: 'evento_interno_sincronizado'
          });
        } catch (e) {
          console.warn('[EventBus Demurrage] Erro:', e.message);
        }
      }
    }

    // Checar limite de 150 minutos da água
    if (tSaida && tFim > tSaida) {
      const tempoTotalCargaMin = Math.round((tFim.getTime() - tSaida.getTime()) / (1000 * 60));
      if (tempoTotalCargaMin > LIMITE_NBR7212_MINUTOS) {
        viagem.alertaNbr7212 = true;
        viagem.tempoTotalAguaMinutos = tempoTotalCargaMin;
      }
    }

    // Disparar evento de viagem concluída
    try {
      kyttoEventBus.emitirEvento('concreto.viagem_concluida', {
        viagemId: viagem.id,
        cargaId: viagem.cargaId,
        betoneiraId: viagem.betoneiraId,
        status: 'finalizada',
        slumpMedido: viagem.slumpMedido,
        alertaNbr7212: viagem.alertaNbr7212
      }, {
        sistemaOrigem: 'Serrano Concreto Usinado',
        sistemaDestino: 'Ultra / Nossa Gente',
        tipo: 'evento_interno_sincronizado'
      });
    } catch (e) {
      console.warn('[EventBus Viagem] Erro:', e.message);
    }
  }

  save();
  return {
    ok: true,
    mensagem: `Marco '${etapa}' registrado com sucesso para a betoneira ${betoneiraId}!`,
    viagem
  };
}

/**
 * Lista o relatório de telemetria e estadias excedentes (Demurrage)
 */
export function listarRelatorioDemurrage(filtros = {}) {
  const data = db();
  const viagens = data.concreto_viagens_telemetria || [];

  const filtradas = viagens.filter(v => {
    if (filtros.apenasComDemurrage && (!v.demurrage || v.demurrage.valorTotal <= 0)) return false;
    if (filtros.cargaId && v.cargaId !== filtros.cargaId) return false;
    return true;
  });

  const totalDemurrage = filtradas.reduce((acc, v) => acc + (v.demurrage?.valorTotal || 0), 0);
  const totalMinutosExcedentes = filtradas.reduce((acc, v) => acc + (v.demurrage?.minutosExcedentes || 0), 0);

  return {
    totalViagens: filtradas.length,
    viagensComDemurrage: filtradas.filter(v => v.demurrage?.valorTotal > 0).length,
    totalMinutosExcedentes,
    valorTotalDemurrage: Number(totalDemurrage.toFixed(2)),
    tarifaPorMinuto: TARIFA_DEMURRAGE_MINUTO,
    tarifaPorHora: TARIFA_DEMURRAGE_HORA,
    franquiaMinutos: FRANQUIA_DESCARGA_MINUTOS,
    viagens: filtradas
  };
}

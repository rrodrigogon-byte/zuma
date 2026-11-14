/**
 * ============================================================================
 * KYTTO ERP · MÓDULO BARBEARIA DINO: MOTOR DO CLUB DINO (RECORRÊNCIA MENSAL)
 * ============================================================================
 * Gestão de assinaturas com débito mensal automático (PIX / Cartão),
 * franquia de serviços, renovação de créditos e benefícios de perfumaria.
 */
import { db, save } from '../db.js';
import { kyttoEventBus } from './kytto-event-bus.js';

export const DINO_EMPRESA_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa914001';

export const PLANOS_CLUB_DINO = {
  silver: {
    id: 'plano-dino-silver',
    codigo: 'silver',
    nome: 'Club Silver (Corte VIP)',
    mensalidade: 139.00,
    descricao: '2 Cortes Masculinos Dino por mês + 10% de desconto em perfumaria',
    franquiaMensal: {
      cortes: 2,
      barbas: 0,
      ilimitado: false
    },
    descontoPerfumariaPercent: 10,
    beneficios: [
      '2 Cortes Masculinos completos por mês',
      '10% de desconto em toda a linha de perfumaria e pomadas',
      'Agendamento prioritário com o T-Rex no WhatsApp',
      'Livre escolha entre Nati, Bruno ou Dino'
    ]
  },
  gold: {
    id: 'plano-dino-gold',
    codigo: 'gold',
    nome: 'Club Gold (Corte & Barba Master)',
    mensalidade: 229.00,
    descricao: '2 Cortes + 2 Barboterapias por mês + 15% de desconto em perfumaria + 1 Decant 5ml',
    franquiaMensal: {
      cortes: 2,
      barbas: 2,
      ilimitado: false
    },
    descontoPerfumariaPercent: 15,
    beneficios: [
      '2 Cortes Masculinos por mês',
      '2 Barboterapias tradicionais na toalha quente por mês',
      '15% de desconto em toda a linha de perfumaria',
      '1 Miniatura Decant Árabe 5ml cortesia todo mês',
      'Agendamento prioritário VIP'
    ]
  },
  black: {
    id: 'plano-dino-black',
    codigo: 'black',
    nome: 'Club Black Unlimited',
    mensalidade: 399.00,
    descricao: 'Cortes e Barbas Ilimitados + 20% em perfumaria + Bebida Cortesia',
    franquiaMensal: {
      cortes: 999,
      barbas: 999,
      ilimitado: true
    },
    descontoPerfumariaPercent: 20,
    beneficios: [
      'Cortes de Cabelo Ilimitados durante o mês',
      'Barboterapias na toalha quente Ilimitadas',
      '20% de desconto em toda a linha de perfumaria de luxo',
      'Café espresso e cerveja artesanal cortesia em cada visita',
      'Acesso à Roleta VIP de Prêmios todo mês'
    ]
  }
};

/**
 * Lista todos os planos disponíveis do Club Dino
 */
export function listarPlanosClubDino() {
  return Object.values(PLANOS_CLUB_DINO);
}

/**
 * Contrata ou renova uma assinatura do Club Dino para um cliente
 */
export async function contratarPlanoClubDino(dados = {}) {
  const {
    clienteNome,
    clienteTelefone,
    planoCodigo = 'silver',
    formaPagamento = 'pix',
    profissionalPreferidoId = null,
    lojaId = 'loja-dino-matriz'
  } = dados;

  if (!clienteNome || !clienteTelefone) {
    throw new Error('Nome e WhatsApp do cliente são obrigatórios para adesão ao Club Dino.');
  }

  const plano = PLANOS_CLUB_DINO[planoCodigo] || PLANOS_CLUB_DINO.silver;
  const data = db();
  data.dino_club_assinaturas ||= [];

  const telefoneLimpo = String(clienteTelefone).replace(/\D/g, '');
  const dataInicio = new Date();
  const dataFim = new Date(dataInicio.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 dias de validade

  // Gerar ID e fatura
  const assinaturaId = `sub-dino-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const novaAssinatura = {
    id: assinaturaId,
    empresaId: DINO_EMPRESA_ID,
    lojaId,
    clienteNome,
    clienteTelefone: telefoneLimpo,
    planoId: plano.id,
    planoCodigo: plano.codigo,
    planoNome: plano.nome,
    valorMensal: plano.mensalidade,
    formaPagamento,
    status: 'ativa',
    dataInicio: dataInicio.toISOString(),
    dataVencimento: dataFim.toISOString(),
    proximaRenovacao: dataFim.toISOString().slice(0, 10),
    creditosDisponiveis: {
      cortes: plano.franquiaMensal.cortes,
      barbas: plano.franquiaMensal.barbas,
      ilimitado: plano.franquiaMensal.ilimitado
    },
    creditosUtilizados: {
      cortes: 0,
      barbas: 0
    },
    descontoPerfumariaPercent: plano.descontoPerfumariaPercent,
    profissionalPreferidoId,
    historicoUsos: [],
    criadoEm: new Date().toISOString()
  };

  data.dino_club_assinaturas.unshift(novaAssinatura);
  save();

  // Emitir evento de sincronização interna
  try {
    kyttoEventBus.emitirEvento('barbearia.clube_adesao', {
      assinaturaId,
      clienteNome,
      clienteTelefone: telefoneLimpo,
      planoNome: plano.nome,
      valorMensal: plano.mensalidade,
      formaPagamento
    }, {
      sistemaOrigem: 'Barbearia Dino ERP',
      sistemaDestino: 'Ultra / Nossa Gente',
      tipo: 'evento_interno_sincronizado'
    });
  } catch (e) {
    console.warn('[EventBus Club Dino] Erro:', e.message);
  }

  return {
    ok: true,
    mensagem: `Assinatura ${plano.nome} ativada com sucesso para ${clienteNome}!`,
    assinatura: novaAssinatura,
    cobranca: {
      valor: plano.mensalidade,
      formaPagamento,
      vencimento: dataFim.toISOString().slice(0, 10),
      pixCopiaCola: `00020126580014br.gov.bcb.pix0136dino-club-${assinaturaId}520400005303986540${plano.mensalidade.toFixed(2)}5802BR5915BARBEARIA DINO6014TANGARA DA SER62070503***6304ABCD`
    }
  };
}

/**
 * Consulta o status e saldo de créditos de uma assinatura ativa por telefone
 */
export function consultarAssinaturaCliente(telefone) {
  const telLimpo = String(telefone).replace(/\D/g, '');
  const data = db();
  const assinaturas = data.dino_club_assinaturas || [];
  const ativa = assinaturas.find(a => a.clienteTelefone === telLimpo && a.status === 'ativa');
  if (!ativa) return null;

  return ativa;
}

/**
 * Consome 1 crédito da franquia quando o cliente faz corte ou barba
 */
export function abaterCreditoAssinatura(telefone, tipoServico = 'corte', detalhes = {}) {
  const telLimpo = String(telefone).replace(/\D/g, '');
  const data = db();
  const assinaturas = data.dino_club_assinaturas || [];
  const ativa = assinaturas.find(a => a.clienteTelefone === telLimpo && a.status === 'ativa');

  if (!ativa) {
    return { ok: false, mensagem: 'Cliente não possui plano do Club Dino ativo.' };
  }

  const s = tipoServico.toLowerCase().includes('barba') ? 'barbas' : 'cortes';
  if (!ativa.creditosDisponiveis.ilimitado && ativa.creditosDisponiveis[s] <= 0) {
    return {
      ok: false,
      mensagem: `Franquia de ${s} do plano ${ativa.planoNome} esgotada no ciclo atual. Cobrar valor avulso no balcão.`
    };
  }

  if (!ativa.creditosDisponiveis.ilimitado) {
    ativa.creditosDisponiveis[s] -= 1;
  }
  ativa.creditosUtilizados[s] = (ativa.creditosUtilizados[s] || 0) + 1;

  const uso = {
    id: `uso-${Date.now()}`,
    data: new Date().toISOString(),
    servico: s,
    profissionalNome: detalhes.profissionalNome || 'Profissional Dino',
    comandaId: detalhes.comandaId || null
  };
  ativa.historicoUsos.push(uso);
  save();

  return {
    ok: true,
    mensagem: `1 crédito de ${s} abatido com sucesso pelo Club Dino!`,
    creditosRestantes: ativa.creditosDisponiveis,
    uso
  };
}

/**
 * Retorna o painel geral de métricas do Club Dino (MRR, Total Assinantes, Faturamento)
 */
export function painelMetricasClubDino() {
  const data = db();
  const assinaturas = data.dino_club_assinaturas || [];
  const ativas = assinaturas.filter(a => a.status === 'ativa');

  const mrr = ativas.reduce((acc, a) => acc + Number(a.valorMensal || 0), 0);
  const arr = mrr * 12;

  const porPlano = {
    silver: ativas.filter(a => a.planoCodigo === 'silver').length,
    gold: ativas.filter(a => a.planoCodigo === 'gold').length,
    black: ativas.filter(a => a.planoCodigo === 'black').length
  };

  return {
    totalAssinantes: ativas.length,
    mrr: Number(mrr.toFixed(2)),
    arr: Number(arr.toFixed(2)),
    ticketMedio: ativas.length > 0 ? Number((mrr / ativas.length).toFixed(2)) : 0,
    distribuicaoPorPlano: porPlano,
    ultimasAssinaturas: ativas.slice(0, 10)
  };
}

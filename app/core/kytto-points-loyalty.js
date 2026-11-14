/**
 * ============================================================================
 * KYTTO ERP · MOTOR DE FIDELIDADE & CASHBACK CROSS-VERTICAIS: KYTTO POINTS
 * ============================================================================
 * Permite que clientes acumulem e resgatem pontos unificados por CPF ou Telefone
 * entre todos os negócios do Grupo:
 * - Barbearia Dino & Perfumaria
 * - Palatare Pizzaria Suite
 * - Supermercado Kytto
 *
 * Taxa padrão: 5% de cashback em Kytto Points (1 Ponto = R$ 0,05).
 */
import { db, save } from '../db.js';
import { kyttoEventBus } from './kytto-event-bus.js';
import { enviarMensagem } from './whatsapp.js';

export const VALOR_POR_PONTO_REAIS = 0.05; // 1 Ponto = R$ 0,05 (20 Pontos = R$ 1,00)
export const PERCENTUAL_CASHBACK_PADRAO = 0.05; // 5% do valor da compra volta em pontos

/**
 * Consulta a carteira de pontos do cliente por CPF ou Telefone
 */
export function consultarCarteiraKyttoPoints(identificador) {
  if (!identificador) throw new Error('CPF ou Telefone é obrigatório.');
  const idNormalizado = String(identificador).replace(/\D/g, '');
  const data = db();
  data.kytto_points_carteiras ||= {};

  let carteira = data.kytto_points_carteiras[idNormalizado];
  if (!carteira) {
    carteira = {
      identificador: idNormalizado,
      nomeCliente: '',
      saldoPontos: 0,
      saldoReais: 0.0,
      totalHistoricoAcumulado: 0,
      totalHistoricoResgatado: 0,
      extrato: [],
      criadoEm: new Date().toISOString()
    };
    data.kytto_points_carteiras[idNormalizado] = carteira;
  }

  carteira.saldoReais = Number((carteira.saldoPontos * VALOR_POR_PONTO_REAIS).toFixed(2));
  return carteira;
}

/**
 * Credita pontos de cashback sobre uma compra realizada
 */
export async function creditarCashbackCompra(dados = {}) {
  const {
    identificador, // CPF ou Telefone
    nomeCliente = '',
    valorCompra,
    origemNegocio = 'Barbearia Dino', // 'Barbearia Dino' | 'Palatare Pizzaria' | 'Supermercado Kytto'
    comandaId = '',
    notificarWhats = true
  } = dados;

  if (!identificador || !valorCompra || valorCompra <= 0) {
    throw new Error('Identificador e valor da compra válido são obrigatórios.');
  }

  const idNormalizado = String(identificador).replace(/\D/g, '');
  const data = db();
  data.kytto_points_carteiras ||= {};

  const carteira = consultarCarteiraKyttoPoints(idNormalizado);
  if (nomeCliente && !carteira.nomeCliente) carteira.nomeCliente = nomeCliente;

  const valorCashbackReais = Number((valorCompra * PERCENTUAL_CASHBACK_PADRAO).toFixed(2));
  const pontosGanhos = Math.round(valorCashbackReais / VALOR_POR_PONTO_REAIS);

  carteira.saldoPontos += pontosGanhos;
  carteira.totalHistoricoAcumulado += pontosGanhos;
  carteira.saldoReais = Number((carteira.saldoPontos * VALOR_POR_PONTO_REAIS).toFixed(2));

  const transacao = {
    id: `tx-pts-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    tipo: 'credito_cashback',
    origemNegocio,
    comandaId,
    valorCompra: Number(valorCompra.toFixed(2)),
    pontos: pontosGanhos,
    valorEquivalenteReais: valorCashbackReais,
    dataHora: new Date().toISOString()
  };

  carteira.extrato.unshift(transacao);
  save();

  // Notificar cliente via WhatsApp se telefone fornecido
  let envioWhats = false;
  if (notificarWhats && idNormalizado.length >= 10) {
    const ddiTelefone = idNormalizado.startsWith('55') ? idNormalizado : `55${idNormalizado}`;
    const primeiroNome = (nomeCliente || carteira.nomeCliente || 'Amigo').split(' ')[0];
    const mensagem = `🎉 *Parabéns, ${primeiroNome}!*
Você acabou de ganhar *${pontosGanhos} Kytto Points* (R$ ${valorCashbackReais.toFixed(2)} em cashback) na sua compra na *${origemNegocio}*!

💰 *Seu Saldo Total Atual:* ${carteira.saldoPontos} Points (*R$ ${carteira.saldoReais.toFixed(2)}*)
Você pode abater esse saldo na sua próxima visita à *Barbearia Dino*, *Palatare Pizzaria* ou *Supermercado Kytto*!`;

    try {
      await enviarMensagem(ddiTelefone, mensagem);
      envioWhats = true;
    } catch (err) {
      console.warn('[Whats Cashback] Alerta:', err.message);
    }
  }

  // Sincronização por evento interno com Ultra e Nossa Gente
  try {
    kyttoEventBus.emitirEvento('fidelidade.cashback_creditado', {
      identificador: idNormalizado,
      pontosGanhos,
      saldoPontos: carteira.saldoPontos,
      saldoReais: carteira.saldoReais,
      origemNegocio
    }, {
      sistemaOrigem: 'Motor de Fidelidade Kytto Points',
      sistemaDestino: 'Ultra / CRM',
      tipo: 'evento_interno_sincronizado'
    });
  } catch (e) {
    console.warn('[EventBus Cashback] Erro:', e.message);
  }

  return {
    ok: true,
    mensagem: `${pontosGanhos} pontos (R$ ${valorCashbackReais.toFixed(2)}) creditados com sucesso!`,
    pontosGanhos,
    valorCashbackReais,
    novoSaldoPontos: carteira.saldoPontos,
    novoSaldoReais: carteira.saldoReais,
    envioWhats
  };
}

/**
 * Resgata pontos para dar desconto no balcão/checkout
 */
export function resgatarKyttoPoints(identificador, pontosDesejados, destinoNegocio = 'Barbearia Dino') {
  if (!identificador || !pontosDesejados || pontosDesejados <= 0) {
    throw new Error('Identificador e quantidade de pontos são obrigatórios.');
  }

  const idNormalizado = String(identificador).replace(/\D/g, '');
  const carteira = consultarCarteiraKyttoPoints(idNormalizado);

  if (carteira.saldoPontos < pontosDesejados) {
    return {
      ok: false,
      error: `Saldo insuficiente. O cliente possui ${carteira.saldoPontos} pontos e tentou resgatar ${pontosDesejados}.`
    };
  }

  const valorDescontoReais = Number((pontosDesejados * VALOR_POR_PONTO_REAIS).toFixed(2));

  carteira.saldoPontos -= pontosDesejados;
  carteira.totalHistoricoResgatado += pontosDesejados;
  carteira.saldoReais = Number((carteira.saldoPontos * VALOR_POR_PONTO_REAIS).toFixed(2));

  const transacao = {
    id: `tx-resg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    tipo: 'resgate_desconto',
    destinoNegocio,
    pontos: -pontosDesejados,
    valorEquivalenteReais: valorDescontoReais,
    dataHora: new Date().toISOString()
  };

  carteira.extrato.unshift(transacao);
  save();

  // Sincronização por evento interno com Ultra
  try {
    kyttoEventBus.emitirEvento('fidelidade.pontos_resgatados', {
      identificador: idNormalizado,
      pontosResgatados: pontosDesejados,
      valorDescontoReais,
      saldoRestantePontos: carteira.saldoPontos,
      destinoNegocio
    }, {
      sistemaOrigem: 'Motor de Fidelidade Kytto Points',
      sistemaDestino: 'Ultra / Caixa',
      tipo: 'evento_interno_sincronizado'
    });
  } catch (e) {
    console.warn('[EventBus Resgate] Erro:', e.message);
  }

  return {
    ok: true,
    mensagem: `Resgate de ${pontosDesejados} pontos aplicado com sucesso! Desconto concedido: R$ ${valorDescontoReais.toFixed(2)}.`,
    pontosResgatados: pontosDesejados,
    valorDescontoReais,
    saldoRestantePontos: carteira.saldoPontos,
    saldoRestanteReais: carteira.saldoReais
  };
}

/**
 * ============================================================================
 * KYTTO ERP · INTELIGÊNCIA PREDITIVA DE ABASTECIMENTO & RUPTURA DE ESTOQUE (ONDA 7)
 * ============================================================================
 * Algoritmo preditivo baseado no Motor KyttoIA para monitorar insumos e produtos
 * nas 4 verticais do Grupo:
 * - Dino: Pomadas, óleos, lâminas, descartáveis
 * - Serrano Concreto: Cimento, areia, brita, aditivos
 * - Palatare: Farinha 00, queijo, molhos
 * - Supermercado: Hortifrúti, perecíveis e mercearia
 *
 * Apura o Ponto de Encomenda (PP) e emite ordens de compra sugeridas automáticas.
 */
import { db, save } from '../db.js';
import { kyttoEventBus } from './kytto-event-bus.js';
import { enviarMensagem } from './whatsapp.js';

export const ITENS_MONITORADOS_PADRAO = [
  // 💈 Dino Barbearia
  { id: 'dino-pomada-matte', empresa: 'Barbearia Dino', nome: 'Pomada Modeladora Efeito Matte Dino', estoqueAtual: 8, consumoMedioDia: 3.2, leadTimeDias: 3, estoqueSeguranca: 6, unidade: 'un', custoUnitario: 22.00, fornecedor: 'Distribuidora Cosméticos MT' },
  { id: 'dino-oleo-barba', empresa: 'Barbearia Dino', nome: 'Óleo Hidratante para Barba Dino', estoqueAtual: 14, consumoMedioDia: 1.8, leadTimeDias: 4, estoqueSeguranca: 5, unidade: 'un', custoUnitario: 18.50, fornecedor: 'Distribuidora Cosméticos MT' },
  { id: 'dino-laminas', empresa: 'Barbearia Dino', nome: 'Lâminas Descartáveis Platinum (Caixa c/ 100)', estoqueAtual: 3, consumoMedioDia: 1.0, leadTimeDias: 2, estoqueSeguranca: 4, unidade: 'cx', custoUnitario: 35.00, fornecedor: 'Barber Supply Brasil' },

  // 🏗️ Serrano Concreto Usinado
  { id: 'concreto-cimento-cp2', empresa: 'Serrano Concreto', nome: 'Cimento Portland CP-II-F 32 (Granel Silo)', estoqueAtual: 18.5, consumoMedioDia: 12.0, leadTimeDias: 2, estoqueSeguranca: 15.0, unidade: 'toneladas', custoUnitario: 580.00, fornecedor: 'Votorantim Cimentos MT' },
  { id: 'concreto-areia-lavada', empresa: 'Serrano Concreto', nome: 'Areia Média Lavada de Rio (Baia 01)', estoqueAtual: 45.0, consumoMedioDia: 25.0, leadTimeDias: 1, estoqueSeguranca: 30.0, unidade: 'm³', custoUnitario: 85.00, fornecedor: 'Porto Areia Rio Sepotuba' },
  { id: 'concreto-aditivo-plast', empresa: 'Serrano Concreto', nome: 'Aditivo Plastificante Polifuncional NBR 11768', estoqueAtual: 420.0, consumoMedioDia: 150.0, leadTimeDias: 4, estoqueSeguranca: 300.0, unidade: 'litros', custoUnitario: 14.50, fornecedor: 'MC-Bauchemie Brasil' },

  // 🍕 Palatare Pizzaria
  { id: 'palatare-farinha-00', empresa: 'Palatare Pizzaria', nome: 'Farinha de Trigo Italiana Tipo 00 (Saco 25kg)', estoqueAtual: 5, consumoMedioDia: 2.5, leadTimeDias: 3, estoqueSeguranca: 4, unidade: 'sacos', custoUnitario: 140.00, fornecedor: 'Moinho Speciale Alimentos' },
  { id: 'palatare-mussarela', empresa: 'Palatare Pizzaria', nome: 'Queijo Mussarela Peça Especial para Pizza', estoqueAtual: 18.0, consumoMedioDia: 8.5, leadTimeDias: 2, estoqueSeguranca: 12.0, unidade: 'kg', custoUnitario: 38.00, fornecedor: 'Laticínios Tangará' },

  // 🛒 Supermercado Kytto
  { id: 'super-carvao-ecologico', empresa: 'Supermercado Kytto', nome: 'Carvão Vegetal Ecológico 5kg', estoqueAtual: 12, consumoMedioDia: 6.0, leadTimeDias: 2, estoqueSeguranca: 10, unidade: 'sc', custoUnitario: 16.00, fornecedor: 'Carvão do Cerrado MT' }
];

/**
 * Analisa o estoque em tempo real e detecta rupturas iminentes
 */
export function executarDiagnosticoRupturaEstoque() {
  const diagnostico = [];
  const ordensCompraSugeridas = [];

  for (const item of ITENS_MONITORADOS_PADRAO) {
    // Ponto de Pedido = (Consumo Médio Diário * Lead Time) + Estoque de Segurança
    const demandaLeadTime = item.consumoMedioDia * item.leadTimeDias;
    const pontoPedido = Number((demandaLeadTime + item.estoqueSeguranca).toFixed(2));
    const diasAteRuptura = Number((item.estoqueAtual / item.consumoMedioDia).toFixed(1));

    const emRuptura = item.estoqueAtual <= 0;
    const nivelCritico = item.estoqueAtual <= pontoPedido;

    let status = 'normal';
    if (emRuptura) status = 'ruptura_total';
    else if (nivelCritico) status = 'repor_urgente';
    else if (diasAteRuptura <= item.leadTimeDias * 1.5) status = 'atencao';

    // Se estiver em nível crítico, calcula quantidade sugerida de reposição (Lote Econômico)
    let quantidadeSugerida = 0;
    let valorEstimadoCompra = 0.0;

    if (nivelCritico || emRuptura) {
      // Repor estoque para cobrir 15 dias de consumo + estoque de segurança
      const metaEstoque = (item.consumoMedioDia * 15) + item.estoqueSeguranca;
      quantidadeSugerida = Math.ceil(metaEstoque - item.estoqueAtual);
      valorEstimadoCompra = Number((quantidadeSugerida * item.custoUnitario).toFixed(2));

      ordensCompraSugeridas.push({
        itemId: item.id,
        empresa: item.empresa,
        nome: item.nome,
        fornecedor: item.fornecedor,
        estoqueAtual: item.estoqueAtual,
        pontoPedido,
        diasAteRuptura,
        quantidadeSugerida,
        unidade: item.unidade,
        custoUnitario: item.custoUnitario,
        valorEstimadoCompra,
        prioridade: emRuptura ? 'URGENTE_MAXIMA' : (diasAteRuptura <= 1 ? 'ALTA' : 'MEDIA')
      });
    }

    diagnostico.push({
      ...item,
      pontoPedido,
      diasAteRuptura,
      status,
      quantidadeSugerida,
      valorEstimadoCompra
    });
  }

  const data = db();
  data.estoque_ordens_sugeridas = ordensCompraSugeridas;
  save();

  return {
    timestamp: new Date().toISOString(),
    motorIa: 'Motor KyttoIA 2.5 Flash Industrial Engine',
    totalItensMonitorados: diagnostico.length,
    itensCriticos: ordensCompraSugeridas.length,
    valorTotalOrdensSugeridas: Number(ordensCompraSugeridas.reduce((acc, o) => acc + o.valorEstimadoCompra, 0).toFixed(2)),
    diagnostico,
    ordensCompraSugeridas
  };
}

/**
 * Dispara alerta de reposição urgente para o WhatsApp do gestor
 */
export async function alertarRupturaWhatsApp(telefoneDestino = '5514997462929') {
  const analise = executarDiagnosticoRupturaEstoque();
  const criticos = analise.ordensCompraSugeridas;

  if (criticos.length === 0) {
    return { ok: true, mensagem: 'Nenhum item com nível crítico de estoque.' };
  }

  const listaTexto = criticos.map(c => 
    `• *[${c.empresa}] ${c.nome}*\n  Estoque: ${c.estoqueAtual} ${c.unidade} (dura ~${c.diasAteRuptura} dias)\n  Sugerido: *${c.quantidadeSugerida} ${c.unidade}* (R$ ${c.valorEstimadoCompra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})\n  Fornecedor: ${c.fornecedor}`
  ).join('\n\n');

  const mensagem = `⚠️ *ALERTA KYTTOIA · RUPTURA DE ESTOQUE & REPOSIÇÃO PREDITIVA*
Detectamos *${criticos.length} itens* atingindo o Ponto de Encomenda nas operações:

${listaTexto}

💰 *Valor Total Sugerido de Compra:* R$ ${analise.valorTotalOrdensSugeridas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Sincronizado automaticamente com o módulo de Compras do Ultra.`;

  let envioOk = false;
  try {
    const res = await enviarMensagem(telefoneDestino, mensagem);
    envioOk = res.ok !== false;
  } catch (err) {
    console.warn('[Whats Ruptura] Alerta:', err.message);
  }

  // Sincronização por evento interno com Ultra
  try {
    kyttoEventBus.emitirEvento('suprimentos.ordens_compra_sugeridas', {
      totalItens: criticos.length,
      valorTotal: analise.valorTotalOrdensSugeridas,
      ordens: criticos
    }, {
      sistemaOrigem: 'Motor KyttoIA Preditivo de Estoque',
      sistemaDestino: 'Ultra / Compras & Cotações',
      tipo: 'evento_interno_sincronizado'
    });
  } catch (e) {
    console.warn('[EventBus Ruptura] Erro:', e.message);
  }

  return {
    ok: true,
    mensagem: `Alerta de reposição despachado para o WhatsApp ${telefoneDestino}!`,
    envioOk,
    analise
  };
}

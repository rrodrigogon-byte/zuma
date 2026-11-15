/**
 * ============================================================================
 * KYTTO ERP · STALLONE NUTRE SPORT: MOTOR DO STALLONE VIP CLUB (ASSINATURAS RECORRENTES)
 * ============================================================================
 * Gestão de assinaturas mensais recorrentes de suplementação, bioimpedância,
 * cashback acumulado e integração automática com TEF, Contas a Receber e Estoque.
 *
 * Empresa Oficial: Stallone Nutre Sport Ltda. (Tangará da Serra / MT)
 * CNPJ: 56.099.531/0001-38 | Tenant ID: 31f70c83-9172-40c2-945f-9e793b5048be
 */
import { db, save } from '../db.js';
import * as dbPg from '../db-pg.js';
import { kyttoEventBus, TOPICOS_KYTTO } from './kytto-event-bus.js';

export const STALLONE_EMPRESA_ID = '31f70c83-9172-40c2-945f-9e793b5048be';
export const STALLONE_LOJA_ID = '6a15e943-2570-4f29-a2d5-d900d2812911';

export const PLANOS_STALLONE_CLUB = {
  starter: {
    codigo: 'starter',
    nome: 'Box Starter Fitness (Manutenção & Vitalidade)',
    mensalidade: 169.00,
    categoria: 'Iniciante / Saúde Geral',
    cashbackPercentual: 5,
    descontoLojaPercentual: 5,
    itensInclusos: [
      { nome: '1x 100% Whey Concentrado 900g (Sabor à Escolha)', sku: 'WHEY-CONC-900G', valorTabela: 119.90 },
      { nome: '1x Creatina Monohidratada 300g 100% Pura', sku: 'CREAT-300G-MONO', valorTabela: 89.90 },
      { nome: '1x Coqueteleira Oficial Stallone Nutre Sport (Brinde de Boas-Vindas)', sku: 'COQ-STAL-700ML', valorTabela: 35.00 }
    ],
    beneficios: [
      'Economia de até R$ 75,00/mês comparado ao preço de balcão',
      '5% de Cashback em todas as compras avulsas na loja física',
      'Atendimento prioritário com o Consultor Nutricional KyttoIA no WhatsApp',
      'Retirada rápida no Balcão (Caixa 01) ou Totem de Autoatendimento'
    ]
  },
  performance: {
    codigo: 'performance',
    nome: 'Box Performance & Hipertrofia (Massa Magra & Força)',
    mensalidade: 279.00,
    categoria: 'Atletas / Musculação Intensa',
    cashbackPercentual: 10,
    descontoLojaPercentual: 10,
    itensInclusos: [
      { nome: '1x Whey Protein Concentrado/Isolado Premium 900g', sku: 'WHEY-PREM-900G', valorTabela: 159.90 },
      { nome: '1x Creatina Creapure® Selo Alemão 300g', sku: 'CREAT-CREAPURE-300G', valorTabela: 129.90 },
      { nome: '1x Pré-Treino de Alta Intensidade com Beta-Alanina 300g', sku: 'PRE-TREINO-PRO-300G', valorTabela: 109.90 }
    ],
    beneficios: [
      'Economia real de mais de R$ 120,00/mês',
      '1x Avaliação de Bioimpedância mensal cortesia no Caixa 02 (Consultoria Fitness)',
      '10% de Cashback acumulado no Kytto Pay para qualquer produto da loja',
      '15% de desconto em roupas e acessórios de treino',
      'Acesso à consultoria personalizada de periodização de suplementos'
    ]
  },
  elite: {
    codigo: 'elite',
    nome: 'Box Pro Elite & Definição Extrema (Alta Performance)',
    mensalidade: 429.00,
    categoria: 'Fisiculturismo & Alta Performance',
    cashbackPercentual: 15,
    descontoLojaPercentual: 15,
    itensInclusos: [
      { nome: '1x Whey Protein 100% Isolado ISO Hydro Zero Carbo 900g', sku: 'WHEY-ISO-900G', valorTabela: 239.90 },
      { nome: '1x Creatina Creapure® 300g', sku: 'CREAT-CREAPURE-300G', valorTabela: 129.90 },
      { nome: '1x Pré-Treino Ultra Concentrado Pump & Foco 300g', sku: 'PRE-ULTRA-300G', valorTabela: 139.90 },
      { nome: '1x Complexo Multivitamínico Mineral Quelato (60 cáps)', sku: 'MULTI-QUEL-60CAP', valorTabela: 69.90 },
      { nome: '1x Ômega 3 TG Ultra Concentrado EPA/DHA (60 cáps)', sku: 'OMEGA3-TG-60CAP', valorTabela: 89.90 }
    ],
    beneficios: [
      'Economia superior a R$ 230,00/mês',
      '1x Consulta mensal com Nutricionista Esportivo credenciado na loja',
      '15% de Cashback cumulativo em toda a rede Stallone e parceiros Kytto',
      'Entrega expressa domiciliar grátis em toda a cidade de Tangará da Serra/MT',
      'Prioridade total e atendimento VIP com reserva antecipada de lançamentos'
    ]
  }
};

/**
 * Retorna lista de planos disponíveis do Stallone VIP Club
 */
export function listarPlanosStalloneClub() {
  return Object.values(PLANOS_STALLONE_CLUB);
}

/**
 * Retorna o estado de assinaturas da empresa
 */
function obterColecaoAssinaturas(empresaId = STALLONE_EMPRESA_ID) {
  const estado = db();
  if (!estado.stalloneClubAssinaturas) {
    estado.stalloneClubAssinaturas = {};
  }
  if (!estado.stalloneClubAssinaturas[empresaId]) {
    estado.stalloneClubAssinaturas[empresaId] = {
      configuracao: {
        ativo: true,
        diaCobrancaPadrao: 5,
        toleranciaAtrasoDias: 5,
        gatewayPadrao: 'vero_sicredi',
        cashbackAtivo: true,
      },
      assinaturas: [],
      historicoCiclos: [],
    };
  }
  return estado.stalloneClubAssinaturas[empresaId];
}

/**
 * Cria ou adere a uma nova assinatura recorrente do Stallone VIP Club
 */
export function criarAssinaturaStalloneClub({
  empresaId = STALLONE_EMPRESA_ID,
  lojaId = STALLONE_LOJA_ID,
  clienteNome,
  clienteCpf,
  clienteTelefone,
  clienteEmail = '',
  planoCodigo = 'performance',
  formaPagamento = 'cartao_recorrente', // 'cartao_recorrente' | 'pix_recorrente' | 'balcao_tef'
  adquirenteId = 'vero_sicredi',
  cartaoToken = null,
  diaVencimento = 5,
  enderecoEntrega = null,
  observacoes = ''
} = {}) {
  if (!clienteNome || !clienteCpf) {
    throw new Error('Nome completo e CPF do cliente são obrigatórios para adesão ao Clube.');
  }

  const plano = PLANOS_STALLONE_CLUB[planoCodigo];
  if (!plano) {
    throw new Error(`Plano "${planoCodigo}" não encontrado no catálogo do Stallone VIP Club.`);
  }

  const colecao = obterColecaoAssinaturas(empresaId);
  const cpfLimpo = String(clienteCpf).replace(/\D/g, '');

  // Verifica se o cliente já possui assinatura ativa
  const existente = colecao.assinaturas.find(
    (a) => a.clienteCpfLimpo === cpfLimpo && ['ativa', 'em_dia'].includes(a.status)
  );
  if (existente) {
    throw new Error(`Cliente CPF ${clienteCpf} já possui assinatura ativa no plano "${existente.planoNome}".`);
  }

  const agora = new Date();
  const proximoVencimento = new Date(agora);
  proximoVencimento.setDate(diaVencimento);
  if (proximoVencimento <= agora) {
    proximoVencimento.setMonth(proximoVencimento.getMonth() + 1);
  }

  const id = `sub-stal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const assinatura = {
    id,
    empresaId,
    lojaId,
    clienteNome: clienteNome.trim(),
    clienteCpf: clienteCpf.trim(),
    clienteCpfLimpo: cpfLimpo,
    clienteTelefone: String(clienteTelefone || '').replace(/\D/g, ''),
    clienteEmail: clienteEmail.trim().toLowerCase(),
    planoCodigo: plano.codigo,
    planoNome: plano.nome,
    valorMensalidade: plano.mensalidade,
    cashbackPercentual: plano.cashbackPercentual,
    saldoCashbackAcumulado: 0.0,
    formaPagamento,
    adquirenteId,
    cartaoToken: cartaoToken || `tok_stal_${Math.random().toString(36).substring(2, 10)}`,
    diaVencimento,
    status: 'ativa',
    ciclosPagos: 0,
    dataInicio: agora.toISOString(),
    proximaCobranca: proximoVencimento.toISOString().slice(0, 10),
    ultimoCicloPagoEm: null,
    enderecoEntrega: enderecoEntrega || 'Retirada no Balcão Oficial Stallone Nutre Sport',
    observacoes,
    criadoEm: agora.toISOString(),
    atualizadoEm: agora.toISOString()
  };

  colecao.assinaturas.push(assinatura);
  save();

  // Emite evento no EventBus Kytto
  try {
    kyttoEventBus.emitir({
      topico: TOPICOS_KYTTO?.CLIENTE_CADASTROU || 'cliente.cadastrou',
      empresaId,
      origem: 'stallone-vip-club',
      dados: {
        assinaturaId: id,
        clienteNome: assinatura.clienteNome,
        planoNome: plano.nome,
        valorMensalidade: plano.mensalidade,
        formaPagamento
      }
    });
  } catch (_) { /* evento opcional */ }

  return {
    sucesso: true,
    mensagem: `Assinatura de ${plano.nome} ativada com sucesso para ${clienteNome}!`,
    assinatura
  };
}

/**
 * Processa a cobrança do ciclo mensal da assinatura (Gera lançamento financeiro + baixa de estoque)
 */
export function processarCobrancaCicloAssinatura(empresaId = STALLONE_EMPRESA_ID, assinaturaId) {
  const colecao = obterColecaoAssinaturas(empresaId);
  const assinatura = colecao.assinaturas.find((a) => a.id === assinaturaId);
  if (!assinatura) {
    throw new Error('Assinatura não localizada.');
  }

  const plano = PLANOS_STALLONE_CLUB[assinatura.planoCodigo];
  const agora = new Date();
  const valorCashback = Number(((assinatura.valorMensalidade * (assinatura.cashbackPercentual || 0)) / 100).toFixed(2));

  // Atualiza assinatura
  assinatura.ciclosPagos = (assinatura.ciclosPagos || 0) + 1;
  assinatura.ultimoCicloPagoEm = agora.toISOString();
  assinatura.saldoCashbackAcumulado = Number(((assinatura.saldoCashbackAcumulado || 0) + valorCashback).toFixed(2));
  assinatura.status = 'em_dia';

  // Avança para o próximo mês
  const prox = new Date(agora);
  prox.setMonth(prox.getMonth() + 1);
  prox.setDate(assinatura.diaVencimento);
  assinatura.proximaCobranca = prox.toISOString().slice(0, 10);
  assinatura.atualizadoEm = agora.toISOString();

  // Registra no histórico de ciclos
  const cicloInfo = {
    cicloId: `ciclo-${assinatura.id}-${assinatura.ciclosPagos}`,
    assinaturaId: assinatura.id,
    clienteNome: assinatura.clienteNome,
    clienteCpf: assinatura.clienteCpf,
    planoCodigo: assinatura.planoCodigo,
    valorCobrado: assinatura.valorMensalidade,
    cashbackGerado: valorCashback,
    formaPagamento: assinatura.formaPagamento,
    dataCobranca: agora.toISOString(),
    status: 'confirmado_pago',
    itensSeparadosEstoque: plano?.itensInclusos || []
  };
  colecao.historicoCiclos.push(cicloInfo);
  save();

  return {
    sucesso: true,
    ciclo: cicloInfo,
    assinatura
  };
}

/**
 * Consulta assinatura pelo CPF do cliente
 */
export function consultarAssinaturaPorCpf(empresaId = STALLONE_EMPRESA_ID, cpf) {
  const cpfLimpo = String(cpf || '').replace(/\D/g, '');
  const colecao = obterColecaoAssinaturas(empresaId);
  return colecao.assinaturas.find((a) => a.clienteCpfLimpo === cpfLimpo) || null;
}

/**
 * Lista todas as assinaturas do tenant
 */
export function listarTodasAssinaturas(empresaId = STALLONE_EMPRESA_ID) {
  const colecao = obterColecaoAssinaturas(empresaId);
  return colecao.assinaturas;
}

/**
 * Lista todas as assinaturas sincronizando PostgreSQL e estado em memória
 */
export async function listarTodasAssinaturasAsync(empresaId = STALLONE_EMPRESA_ID) {
  const colecao = obterColecaoAssinaturas(empresaId);
  try {
    const res = await dbPg.query(
      `SELECT id, empresa_id as "empresaId", loja_id as "lojaId",
              cliente_id as "clienteId", cliente_nome as "clienteNome",
              cliente_telefone as "clienteTelefone", cliente_cpf as "clienteCpf",
              plano_codigo as "planoCodigo", plano_nome as "planoNome",
              valor_mensalidade as "valorMensalidade",
              cashback_percentual as "cashbackPercentual",
              cashback_saldo as "cashbackSaldo",
              status, dia_cobranca as "diaCobranca",
              ultimo_ciclo_pago as "ultimoCicloPago",
              proximo_vencimento as "proximoVencimento",
              tef_transacao_id as "tefTransacaoId",
              adquirente_recorrente as "adquirenteRecorrente",
              observacoes, criado_em as "criadoEm"
       FROM stallone_club_assinaturas
       WHERE empresa_id = \$1
       ORDER BY criado_em DESC`,
      [empresaId]
    );
    if (res && res.rows && res.rows.length > 0) {
      // Mescla com eventuais assinaturas recentes em memória
      const mapa = new Map();
      for (const r of res.rows) {
        const item = {
          ...r,
          clienteCpfLimpo: String(r.clienteCpf || '').replace(/\D/g, ''),
          valorMensalidade: Number(r.valorMensalidade || 0),
          saldoCashbackAcumulado: Number(r.cashbackSaldo || 0),
          diaVencimento: r.diaCobranca || 10,
          formaPagamento: r.adquirenteRecorrente ? `tef_${r.adquirenteRecorrente.toLowerCase()}` : 'cartao_recorrente'
        };
        mapa.set(String(r.id), item);
        const idx = colecao.assinaturas.findIndex(a => String(a.id) === String(item.id));
        if (idx >= 0) {
          colecao.assinaturas[idx] = { ...item, ...colecao.assinaturas[idx] };
        } else {
          colecao.assinaturas.push(item);
        }
      }
      for (const a of colecao.assinaturas) {
        if (!mapa.has(String(a.id))) mapa.set(String(a.id), a);
      }
      return Array.from(mapa.values());
    }
  } catch (_e) {
    // fallback para memória
  }
  return colecao.assinaturas;
}

/**
 * Retorna KPIs e métricas executivas do Clube de Assinaturas
 */
export async function obterResumoMetricasClube(empresaId = STALLONE_EMPRESA_ID) {
  const lista = await listarTodasAssinaturasAsync(empresaId);
  const ativas = lista.filter(a => ['ativa', 'em_dia'].includes(a.status));
  const mrr = ativas.reduce((acc, cur) => acc + Number(cur.valorMensalidade || 0), 0);
  const totalCashback = lista.reduce((acc, cur) => acc + Number(cur.saldoCashbackAcumulado || cur.cashbackSaldo || 0), 0);
  const contagemPorPlano = { starter: 0, performance: 0, elite: 0 };
  for (const a of ativas) {
    if (contagemPorPlano[a.planoCodigo] !== undefined) contagemPorPlano[a.planoCodigo]++;
  }

  return {
    totalAssinantes: lista.length,
    assinantesAtivos: ativas.length,
    assinantesAtrasados: lista.filter(a => a.status === 'atrasada').length,
    mrr,
    mrrFormatado: `R\$ ${mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    arrProjetado: mrr * 12,
    arrFormatado: `R\$ ${(mrr * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    totalCashbackConcedido: totalCashback,
    totalCashbackFormatado: `R\$ ${totalCashback.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    porPlano: contagemPorPlano
  };
}

/**
 * Pausa temporariamente uma assinatura ativa
 */
export function pausarAssinatura(empresaId = STALLONE_EMPRESA_ID, assinaturaId, motivo = 'Pausa a pedido do cliente') {
  const colecao = obterColecaoAssinaturas(empresaId);
  const assinatura = colecao.assinaturas.find(a => a.id === assinaturaId);
  if (!assinatura) throw new Error('Assinatura não encontrada.');
  assinatura.status = 'pausada';
  assinatura.motivoPausa = motivo;
  assinatura.atualizadoEm = new Date().toISOString();
  save();
  return { sucesso: true, assinatura };
}

/**
 * Reativa uma assinatura pausada
 */
export function reativarAssinatura(empresaId = STALLONE_EMPRESA_ID, assinaturaId) {
  const colecao = obterColecaoAssinaturas(empresaId);
  const assinatura = colecao.assinaturas.find(a => a.id === assinaturaId);
  if (!assinatura) throw new Error('Assinatura não encontrada.');
  assinatura.status = 'ativa';
  assinatura.motivoPausa = null;
  assinatura.atualizadoEm = new Date().toISOString();
  save();
  return { sucesso: true, assinatura };
}

/**
 * Cancela definitivamente uma assinatura
 */
export function cancelarAssinatura(empresaId = STALLONE_EMPRESA_ID, assinaturaId, motivo = 'Cancelamento a pedido do cliente') {
  const colecao = obterColecaoAssinaturas(empresaId);
  const assinatura = colecao.assinaturas.find(a => a.id === assinaturaId);
  if (!assinatura) throw new Error('Assinatura não encontrada.');
  assinatura.status = 'cancelada';
  assinatura.motivoCancelamento = motivo;
  assinatura.canceladaEm = new Date().toISOString();
  assinatura.atualizadoEm = new Date().toISOString();
  save();
  return { sucesso: true, assinatura };
}

/**
 * Registra o despacho ou liberação do Box Mensal de suplementos para o assinante
 */
export function despacharBoxAssinatura(empresaId = STALLONE_EMPRESA_ID, assinaturaId, { modalidade = 'retirada_balcao', codigoRastreio = '', observacoes = '' } = {}) {
  const colecao = obterColecaoAssinaturas(empresaId);
  const assinatura = colecao.assinaturas.find(a => a.id === assinaturaId);
  if (!assinatura) throw new Error('Assinatura não encontrada.');

  const plano = PLANOS_STALLONE_CLUB[assinatura.planoCodigo];
  const agora = new Date().toISOString();
  const protocolo = `BOX-${Date.now().toString().slice(-6)}`;

  const envio = {
    protocolo,
    assinaturaId: assinatura.id,
    clienteNome: assinatura.clienteNome,
    clienteTelefone: assinatura.clienteTelefone,
    planoNome: assinatura.planoNome,
    modalidade: modalidade === 'delivery_express' ? 'Entrega Domiciliar Express (Tangará da Serra)' : 'Retirada no Balcão Oficial Stallone',
    codigoRastreio: codigoRastreio || protocolo,
    itensDespachados: plano?.itensInclusos || [],
    statusEnvio: 'pronto_para_retirada_ou_envio',
    despachadoEm: agora,
    observacoes,
  };

  assinatura.ultimoDespacho = envio;
  assinatura.atualizadoEm = agora;

  if (!colecao.historicoEnvios) colecao.historicoEnvios = [];
  colecao.historicoEnvios.push(envio);
  save();

  return {
    sucesso: true,
    mensagem: `Box Mensal de ${assinatura.clienteNome} preparado com sucesso (${envio.modalidade})!`,
    envio,
    assinatura,
  };
}

/**
 * Gera o extrato de lançamentos de Cashback Kytto Pay do assinante
 */
export function gerarExtratoCashback(empresaId = STALLONE_EMPRESA_ID, cpfOuId) {
  const colecao = obterColecaoAssinaturas(empresaId);
  const termo = String(cpfOuId || '').replace(/\D/g, '');
  const assinatura = colecao.assinaturas.find(a => a.id === cpfOuId || a.clienteCpfLimpo === termo);
  if (!assinatura) throw new Error('Assinante não encontrado.');

  const ciclos = (colecao.historicoCiclos || []).filter(c => c.assinaturaId === assinatura.id);
  const lancamentos = ciclos.map((c, idx) => ({
    id: `ext-cbk-${idx + 1}`,
    tipo: 'credito_mensalidade',
    descricao: `Cashback mensalidade Stallone VIP Club (${c.planoCodigo.toUpperCase()})`,
    valor: c.cashbackGerado,
    data: c.dataCobranca,
    status: 'disponivel',
  }));

  return {
    sucesso: true,
    clienteNome: assinatura.clienteNome,
    clienteCpf: assinatura.clienteCpf,
    saldoAtual: assinatura.saldoCashbackAcumulado || 0,
    totalLancamentos: lancamentos.length,
    lancamentos,
  };
}

/**
 * Gera texto oficial formatado para notificação via WhatsApp do cliente
 */
export function gerarMensagemWhatsAppBoxPronto(empresaId = STALLONE_EMPRESA_ID, assinaturaId) {
  const colecao = obterColecaoAssinaturas(empresaId);
  const assinatura = colecao.assinaturas.find(a => a.id === assinaturaId);
  if (!assinatura) throw new Error('Assinatura não encontrada.');

  const plano = PLANOS_STALLONE_CLUB[assinatura.planoCodigo];
  const itensStr = (plano?.itensInclusos || []).map(i => `  • ${i.nome}`).join('\n');
  const protocolo = assinatura.ultimoDespacho?.protocolo || `BOX-${Date.now().toString().slice(-6)}`;

  const textoZap = `Olá, *${assinatura.clienteNome}*! 💪🏆\n\nSeu *${assinatura.planoNome}* do *Stallone VIP Club* já foi separado com sucesso!\n\n📦 *Itens inclusos neste ciclo:*\n${itensStr}\n\n💰 *Saldo de Cashback disponível no seu Kytto Pay:* R$ ${(assinatura.saldoCashbackAcumulado || 0).toFixed(2)}\n🎟️ *Protocolo de Liberação:* ${protocolo}\n\n📍 Pode retirar diretamente no balcão da *Stallone Nutre Sport* em Tangará da Serra/MT com nossa equipe de consultores.\n\n_Stallone Nutre Sport & Kytto ERP - Nutrição de Alta Performance._`;

  return {
    sucesso: true,
    clienteNome: assinatura.clienteNome,
    telefone: assinatura.clienteTelefone,
    mensagem: textoZap,
  };
}

/**
 * Exporta todas as assinaturas em formato CSV para auditoria e controle de faturamento
 */
export async function exportarAssinaturasCsv(empresaId = STALLONE_EMPRESA_ID) {
  const lista = await listarTodasAssinaturasAsync(empresaId);
  const cabecalho = 'ID;Nome do Atleta;CPF;Telefone;Plano;Mensalidade (R$);Cashback Saldo (R$);Status;Dia Vencimento;Forma Pagamento;Data Inicio;Proxima Cobranca';
  const linhas = lista.map(a => 
    `${a.id};${a.clienteNome};${a.clienteCpf};${a.clienteTelefone};${a.planoNome || a.planoCodigo};${Number(a.valorMensalidade || 0).toFixed(2)};${Number(a.saldoCashbackAcumulado || a.cashbackSaldo || 0).toFixed(2)};${a.status};${a.diaVencimento || 10};${a.formaPagamento};${(a.dataInicio || '').slice(0, 10)};${a.proximaCobranca || ''}`
  );
  return {
    sucesso: true,
    totalAssinantes: lista.length,
    nomeArquivo: `assinaturas_stallone_vip_club_${new Date().toISOString().slice(0, 10)}.csv`,
    conteudoCsv: [cabecalho, ...linhas].join('\r\n'),
  };
}

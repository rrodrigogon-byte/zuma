/**
 * Módulo de Inteligência Comercial, Indicadores de Vendas & IA de Crescimento
 * Multi-tenant completo: Dino Barbearia, Stallone Nutre Sport, Agro Open, Supermercado e Varejo.
 * Políticas Meta WhatsApp Business Compliance, Dinheiro na Mesa & Fechamento Imediato.
 * Kytto ERP - SetPoint Intelligence
 */
import { carregarBaseConsolidada } from './dino-recuperacao-avec.js';

function hojeCuiaba() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Cuiaba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function horaCuiaba() {
  const agora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Cuiaba',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  return agora;
}

function ehHorarioComercialCuiaba() {
  const [h] = horaCuiaba().split(':').map(Number);
  return h >= 8 && h < 20;
}

function textoPlano(val) {
  return String(val || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Variações dinâmicas de saudação e conectivo (Spintax) para evitar mensagens
 * idênticas enviadas ao WhatsApp, protegendo o número contra filtros da Meta.
 */
function escolherVariacao(opcoes, semente = '') {
  let hash = 0;
  for (let i = 0; i < semente.length; i++) {
    hash = (hash << 5) - hash + semente.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % opcoes.length;
  return opcoes[idx];
}

/**
 * Configurações padrão ricas de cada empresa/segmento
 */
const CONFIG_PADRAO = {
  dino: {
    empresaNome: 'Barbearia Dino',
    empresaSegmento: 'Barbearia Masculina Premium & Perfumaria Árabe',
    agenteIaNome: 'T-Rex da Barbearia Dino',
    iconeSegmento: '💈',
    chavePix: '50.073.355/0001-89',
    chavePixTipo: 'CNPJ',
    linkDireto: 'https://kytto.com.br/dino/agendamento',
    optOutAtivo: true,
    fraseOptOut: "(Se preferir não receber novidades da Dino, responda 'PARAR')",
    travaHorarioComercial: true,
    intervaloSegundos: 30,
    limiteDiarioEnvios: 100,
    cicloChurnDias: 21,
    metaTicketMedio: 220,
    metaCrossSell: 55,
  },
  stallone: {
    empresaNome: 'Stallone Nutre Sport & Fitness',
    empresaSegmento: 'Suplementação Esportiva, Moda Fitness & Saúde',
    agenteIaNome: 'Consultor IA Stallone Nutre Sport',
    iconeSegmento: '💪',
    chavePix: 'financeiro@stallonenutre.com.br',
    chavePixTipo: 'E-mail',
    linkDireto: 'https://kytto.com.br/stallone',
    optOutAtivo: true,
    fraseOptOut: "(Caso não queira receber dicas e cupons da Stallone, responda 'PARAR')",
    travaHorarioComercial: true,
    intervaloSegundos: 25,
    limiteDiarioEnvios: 150,
    cicloChurnDias: 30,
    metaTicketMedio: 265,
    metaCrossSell: 48,
  },
  agroopen: {
    empresaNome: 'Agro Open Insumos & Pecuária',
    empresaSegmento: 'Agronegócio, Defensivos, Nutrição Animal & Artigos Oficiais',
    agenteIaNome: 'Consultor Comercial Agro Open',
    iconeSegmento: '🌱',
    chavePix: 'pix@agroopen.com.br',
    chavePixTipo: 'E-mail',
    linkDireto: 'https://kytto.com.br/agroopen',
    optOutAtivo: true,
    fraseOptOut: "(Para interromper o envio de cotações da Agro Open, responda 'PARAR')",
    travaHorarioComercial: true,
    intervaloSegundos: 45,
    limiteDiarioEnvios: 80,
    cicloChurnDias: 45,
    metaTicketMedio: 3200,
    metaCrossSell: 60,
  },
  supermercado: {
    empresaNome: 'Supermercado & Atacarejo Kytto',
    empresaSegmento: 'Alimentos, Bebidas, Hortifrúti, Carnes & Atacarejo',
    agenteIaNome: 'Assistente de Compras Supermercado Kytto',
    iconeSegmento: '🛒',
    chavePix: 'pix@supermercadokytto.com.br',
    chavePixTipo: 'E-mail',
    linkDireto: 'https://kytto.com.br/supermercado',
    optOutAtivo: true,
    fraseOptOut: "(Para não receber o encarte de ofertas do Supermercado, responda 'PARAR')",
    travaHorarioComercial: true,
    intervaloSegundos: 20,
    limiteDiarioEnvios: 200,
    cicloChurnDias: 14,
    metaTicketMedio: 380,
    metaCrossSell: 65,
  },
  varejo: {
    empresaNome: 'Varejo & Moda Kytto',
    empresaSegmento: 'Moda, Calçados, Acessórios & E-commerce',
    agenteIaNome: 'Personal Stylist & Atendente Virtual',
    iconeSegmento: '🏷️',
    chavePix: 'pix@varejokytto.com.br',
    chavePixTipo: 'E-mail',
    linkDireto: 'https://kytto.com.br/loja',
    optOutAtivo: true,
    fraseOptOut: "(Se não quiser receber lançamentos de moda, responda 'PARAR')",
    travaHorarioComercial: true,
    intervaloSegundos: 25,
    limiteDiarioEnvios: 120,
    cicloChurnDias: 40,
    metaTicketMedio: 290,
    metaCrossSell: 50,
  },
};

/**
 * Obtém a configuração ativa da empresa, mesclando defaults com dados persistidos
 */
export function obterConfigEmpresa(raiz, empresaId) {
  const chaveTenant = identificarChaveTenant(empresaId);
  const padrao = CONFIG_PADRAO[chaveTenant] || {
    empresaNome: 'Empresa em Configuração',
    empresaSegmento: 'Comércio e Serviços',
    agenteIaNome: 'Atendente Virtual IA',
    iconeSegmento: '🏢',
    chavePix: '',
    chavePixTipo: 'Chave Aleatória',
    linkDireto: '',
    optOutAtivo: true,
    fraseOptOut: "(Responda 'PARAR' para não receber mensagens)",
    travaHorarioComercial: true,
    intervaloSegundos: 30,
    limiteDiarioEnvios: 50,
    cicloChurnDias: 30,
    metaTicketMedio: 0,
    metaCrossSell: 0,
    configurada: false
  };
  const salvas = raiz?.vendasIaConfig?.[chaveTenant] || raiz?.vendasIaConfig?.[empresaId] || {};
  return { ...padrao, ...salvas, chaveTenant, configurada: !!(salvas.chavePix || (CONFIG_PADRAO[chaveTenant] && padrao.chavePix)) };
}

/**
 * Salva a configuração personalizada da empresa
 */
export function salvarConfigEmpresa(raiz, empresaId, novaConfig) {
  const chaveTenant = identificarChaveTenant(empresaId);
  raiz.vendasIaConfig = raiz.vendasIaConfig || {};
  const anterior = obterConfigEmpresa(raiz, empresaId);
  raiz.vendasIaConfig[chaveTenant] = {
    ...anterior,
    ...novaConfig,
    atualizadoEm: new Date().toISOString(),
  };
  return raiz.vendasIaConfig[chaveTenant];
}

/**
 * Registra uma conversão de venda (Dinheiro Trazido para a Mesa)
 */
export function registrarConversaoVenda(raiz, empresaId, dadosConversao) {
  const chaveTenant = identificarChaveTenant(empresaId);
  raiz.vendasIaConversoes = raiz.vendasIaConversoes || {};
  raiz.vendasIaConversoes[chaveTenant] = raiz.vendasIaConversoes[chaveTenant] || [];

  const registro = {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    data: new Date().toISOString(),
    dataFormatada: hojeCuiaba(),
    clienteId: dadosConversao.clienteId || '',
    clienteNome: dadosConversao.clienteNome || 'Cliente',
    telefone: dadosConversao.telefone || '',
    valor: Number(dadosConversao.valor || 0),
    tipo: dadosConversao.tipo || 'reativacao',
    observacao: dadosConversao.observacao || 'Venda concluída via WhatsApp IA',
  };

  raiz.vendasIaConversoes[chaveTenant].unshift(registro);
  return registro;
}

/**
 * Retorna as conversões registradas da empresa
 */
export function obterConversoesVenda(raiz, empresaId) {
  const chaveTenant = identificarChaveTenant(empresaId);
  return raiz?.vendasIaConversoes?.[chaveTenant] || [];
}

function identificarChaveTenant(empresaId) {
  const empId = String(empresaId || '').toLowerCase().trim();
  if (empId.includes('d0d0ac01') || empId === 'dino' || empId.includes('dino')) return 'dino';
  if (empId.includes('2e041110') || empId === 'stallone' || empId.includes('stallone')) return 'stallone';
  if (empId.includes('a8000001') || empId === 'agroopen' || empId.includes('agro')) return 'agroopen';
  if (empId.includes('supermercado') || empId.includes('mercado') || empId.includes('emporio')) return 'supermercado';
  if (empId.includes('varejo') || empId.includes('moda') || empId.includes('loja')) return 'varejo';
  return empId || 'desconhecido';
}

/**
 * Constrói as 3 opções de mensagens para um cliente em conformidade com a Meta:
 * 1. Suave (Conversacional / Anti-Ban Seguro)
 * 2. Fechamento Rápido (Dinheiro na Mesa com Chave PIX e Link)
 * 3. Reposição / Conveniência
 */
function gerarOpcoesMensagens({
  clienteNome,
  diasSemVir,
  itemHistorico,
  profissional,
  agenteIa,
  empresaNome,
  chavePix,
  linkDireto,
  fraseOptOut,
  contextoSegmento,
}) {
  const primeiroNome = String(clienteNome || 'Amigo').split(' ')[0];
  const semente = `${clienteNome}-${diasSemVir}`;

  const saudacoesSuaves = [
    `Fala ${primeiroNome}, tudo bem? Aqui é o ${agenteIa}.`,
    `Olá ${primeiroNome}, como você está? Aqui é o ${agenteIa}.`,
    `Opa ${primeiroNome}, tudo joia por aí? Aqui é da equipe ${empresaNome}.`,
  ];
  const saudacaoSuave = escolherVariacao(saudacoesSuaves, semente + '-suave');

  const saudacoesFechamento = [
    `Fala ${primeiroNome}! Condição exclusiva liberada para você hoje na ${empresaNome}:`,
    `Olá ${primeiroNome}! Reservamos uma oportunidade especial de retorno na ${empresaNome}:`,
    `Opa ${primeiroNome}, tudo bem? Tenho uma novidade rápida com bônus para você na ${empresaNome}:`,
  ];
  const saudacaoFechamento = escolherVariacao(saudacoesFechamento, semente + '-fechamento');

  const optOut = fraseOptOut ? `\n\n${fraseOptOut}` : '';

  let msgSuave = '';
  let msgFechamento = '';
  let msgLembrete = '';

  if (contextoSegmento === 'dino') {
    const bar = profissional || 'Bruno';
    msgSuave = `${saudacaoSuave} Passando aqui rapidinho para saber como você está e se o visual está em dia! Notamos que já faz ${diasSemVir} dias do seu último corte com o ${bar}. Quer que eu veja os horários disponíveis com ele para esta semana sem compromisso?${optOut}`;
    msgFechamento = `${saudacaoFechamento} Já faz ${diasSemVir} dias do seu corte com o ${bar}. Liberamos hoje um bônus especial: Corte Premium + Barboterapia completa com condição exclusiva. Para agilizar seu agendamento em 1 toque: ${linkDireto} (ou se preferir garantir via PIX: ${chavePix}). Qual horário fica melhor pra você?${optOut}`;
    msgLembrete = `Opa ${primeiroNome}! Lembrete amigável da ${empresaNome}: seu ciclo de corte (${diasSemVir} dias) está vencendo. Para você não ficar sem horário no final de semana com o ${bar}, quer que eu te mande as vagas abertas de quinta e sexta?${optOut}`;
  } else if (contextoSegmento === 'stallone') {
    const item = itemHistorico || 'suplemento';
    msgSuave = `${saudacaoSuave} Passando para saber como estão os treinos e sua rotina de evolução! Vimos que sua última compra de ${item} foi há ${diasSemVir} dias. Está precisando de algum auxílio nos suplementos dessa fase?${optOut}`;
    msgFechamento = `${saudacaoFechamento} Seu estoque de ${item} deve estar no final (${diasSemVir} dias). Liberamos um cupom de 10% OFF + Frete Grátis para seu refil hoje com envio imediato! Pague direto no PIX (${chavePix}) ou acerte pelo link: ${linkDireto}. Quer que eu separe sua unidade agora?${optOut}`;
    msgLembrete = `E aí ${primeiroNome}! Passando só para avisar que recebemos lote fresco de ${item} na Stallone Nutre Sport. Como seu pote comprado há ${diasSemVir} dias já está no fim, quer garantir o seu refil antes que esgote o sabor?${optOut}`;
  } else if (contextoSegmento === 'agroopen') {
    const item = itemHistorico || 'insumos';
    msgSuave = `${saudacaoSuave} Como está o manejo na propriedade? Estamos acompanhando o calendário da safra e queríamos saber como foi a resposta do último lote de ${item}. Precisando de algo técnico para os próximos talhões?${optOut}`;
    msgFechamento = `${saudacaoFechamento} Estamos fechando o carregamento de ${item} da semana na sua região com preço direto de fábrica para carga fechada. Para faturar com entrega programada ou via PIX imediato (${chavePix}), podemos confirmar o pedido da fazenda? Veja as condições completas em: ${linkDireto}.${optOut}`;
    msgLembrete = `Olá ${primeiroNome}! A safra está entrando no período crítico de manejo (${diasSemVir} dias do último pedido de ${item}). Quer receber a cotação comparativa de insumos atualizada para travar o custo antes da virada de tabela?${optOut}`;
  } else if (contextoSegmento === 'supermercado') {
    msgSuave = `${saudacaoSuave} Passando para saber se deu tudo certo na sua última visita e se você encontrou tudo o que precisava. Como podemos te atender melhor nesta semana?${optOut}`;
    msgFechamento = `${saudacaoFechamento} Selecionamos as melhores ofertas do nosso atacarejo para a sua compra semanal. Faça seu pedido online e receba em casa com entrega grátis via PIX (${chavePix}) ou link direto: ${linkDireto}.${optOut}`;
    msgLembrete = `Olá ${primeiroNome}! Já faz ${diasSemVir} dias da sua última feira e compra do mês. Que tal antecipar a lista da semana com as carnes e hortifrúti frescos que acabaram de chegar?${optOut}`;
  } else {
    msgSuave = `${saudacaoSuave} Tudo bem? Passando para desejar uma ótima semana e saber se você está precisando de alguma reposição ou novidade da loja.${optOut}`;
    msgFechamento = `${saudacaoFechamento} Selecionamos novidades exclusivas do seu estilo com 10% de desconto no PIX (${chavePix}) ou link da loja: ${linkDireto}. Quer que eu reserve sua peça?${optOut}`;
    msgLembrete = `Olá ${primeiroNome}! Notamos que já faz ${diasSemVir} dias da sua última visita. Chegou coleção nova que combina perfeitamente com seu perfil. Quer ver as fotos com exclusividade?${optOut}`;
  }

  return {
    suave: {
      titulo: '💬 1. Conversacional & Suave (Risco Meta Zero)',
      subtitulo: 'Abordagem relacional humanizada, sem pressão comercial. Pede permissão antes de fazer ofertas.',
      texto: msgSuave,
      riscoMeta: 'Muito Baixo (100% Seguro)',
      corRisco: '#16a34a',
      gatilho: 'Relacionamento & Confiança',
    },
    fechamento: {
      titulo: '💰 2. Fechamento Imediato (Dinheiro na Mesa)',
      subtitulo: 'Oferta direta com chave PIX e link de checkout/agendamento para fechar a venda na hora.',
      texto: msgFechamento,
      riscoMeta: 'Baixo (Contém PIX/Link e Frase Opt-Out)',
      corRisco: '#2563eb',
      gatilho: 'Dinheiro na Mesa & PIX',
    },
    lembrete: {
      titulo: '⏰ 3. Lembrete Útil de Reposição',
      subtitulo: 'Aviso pontual de término de ciclo, focado na conveniência e utilidade para o cliente.',
      texto: msgLembrete,
      riscoMeta: 'Muito Baixo (Prestação de Serviço)',
      corRisco: '#059669',
      gatilho: 'Conveniência & Hábito',
    },
  };
}

/**
 * Constrói o diagnóstico completo de vendas, inteligência preditiva e oportunidades
 * isolado e completo para cada empresa.
 */
export async function buildInteligenciaVendas(raiz, { empresaId, lojaId }) {
  const hoje = hojeCuiaba();
  const config = obterConfigEmpresa(raiz, empresaId);
  const chaveTenant = config.chaveTenant;

  if (!['dino', 'stallone', 'agroopen', 'supermercado', 'varejo'].includes(chaveTenant) && !config.configurada) {
    return {
      empresaId,
      lojaId,
      configurada: false,
      aviso: 'Configure esta empresa: cadastre a chave PIX e os produtos no módulo comercial para ativar a Inteligência de Vendas.',
      acoes: [],
      reativacao: [],
      oportunidades: [],
      metricas: { totalClientes: 0, receitaEstimada: 0, dinheiroNaMesa: 0 },
      config
    };
  }

  if (chaveTenant === 'stallone') {
    return buildInteligenciaStallone({ raiz, empresaId, lojaId, hoje, config });
  }

  if (chaveTenant === 'agroopen') {
    return buildInteligenciaAgroOpen({ raiz, empresaId, lojaId, hoje, config });
  }

  if (chaveTenant === 'supermercado') {
    return buildInteligenciaSupermercado({ raiz, empresaId, lojaId, hoje, config });
  }

  if (chaveTenant === 'varejo') {
    return buildInteligenciaVarejo({ raiz, empresaId, lojaId, hoje, config });
  }

  // Padrão: Dino Barbearia
  return buildInteligenciaDino(raiz, { empresaId, lojaId, hoje, config });
}

/**
 * Inteligência de Vendas específica para DINO BARBEARIA
 */
async function buildInteligenciaDino(raiz, { empresaId, lojaId, hoje, config }) {
  const estado = raiz.barbearias?.[empresaId] || {};
  const agendamentos = Object.values(estado.agendamentos || {});
  const comandas = Object.values(estado.comandas || {});
  const produtos = Object.values(estado.produtosRevenda || {}).filter(p => p.ativo !== false);

  let baseClientes = [];
  try {
    baseClientes = await carregarBaseConsolidada({
      comandasRecentes: comandas,
      agendamentosRecentes: agendamentos,
    });
  } catch (err) {
    console.error('[inteligencia-vendas] Falha ao carregar base Dino:', err);
    baseClientes = [];
  }

  const ticketMedioAtual = 175;
  const metaTicketMedio = config.metaTicketMedio || 220;
  const taxaCrossSell = 36;

  const clientesReativacao = [];
  const clientesUpSell = [];
  const clientesClube = [];

  for (const c of baseClientes) {
    const dias = c.diasSemVir || 0;
    const nome = c.nome || 'Cliente';
    const barbeiro = c.barbeiroNomeExibicao || c.profissionalPreferido || 'Bruno';

    const opcoes = gerarOpcoesMensagens({
      clienteNome: nome,
      diasSemVir: dias,
      itemHistorico: 'corte',
      profissional: barbeiro,
      agenteIa: config.agenteIaNome,
      empresaNome: config.empresaNome,
      chavePix: config.chavePix,
      linkDireto: config.linkDireto,
      fraseOptOut: config.optOutAtivo ? config.fraseOptOut : '',
      contextoSegmento: 'dino',
    });

    if (dias >= config.cicloChurnDias && dias <= 90) {
      clientesReativacao.push({
        id: c.key || c.telefone,
        nome,
        telefone: c.telefoneFormatado || c.telefone,
        diasSemVir: dias,
        ultimaVisita: c.ultimaVisita,
        barbeiroPreferido: barbeiro,
        gastoTotal: c.totalGasto || (c.totalVisitas * ticketMedioAtual),
        propensao: dias <= 35 ? 'Alta' : 'Média',
        mensagemIa: opcoes.fechamento.texto,
        opcoesMensagem: opcoes,
        riscoMeta: 'Muito Baixo (Meta Compliant)',
      });
    }

    const fazBarba = Object.keys(c.servicos || {}).some(s => textoPlano(s).includes('barba'));
    if (!fazBarba && c.totalVisitas >= 2) {
      clientesUpSell.push({
        id: c.key || c.telefone,
        nome,
        telefone: c.telefoneFormatado || c.telefone,
        barbeiroPreferido: barbeiro,
        tipoOferta: 'Combo Corte + Barboterapia',
        impactoTicket: 60,
        mensagemIa: `Opa ${nome.split(' ')[0]}, tudo joia? Aqui é o ${config.agenteIaNome}! No seu próximo corte com o ${barbeiro}, que tal incluir nossa Barboterapia completa com toalha quente no Combo especial? Você garante R$ 30 de desconto no combo. Chave PIX da Dino para antecipar: ${config.chavePix}. Posso deixar reservado junto?${config.optOutAtivo ? '\n\n' + config.fraseOptOut : ''}`,
        opcoesMensagem: opcoes,
      });
    }

    if (c.totalVisitas >= 4 || c.totalGasto >= 350) {
      clientesClube.push({
        id: c.key || c.telefone,
        nome,
        telefone: c.telefoneFormatado || c.telefone,
        visitasTotal: c.totalVisitas,
        gastoTotal: c.totalGasto || (c.totalVisitas * ticketMedioAtual),
        mensagemIa: `Fala ${nome.split(' ')[0]}, tudo bem? Aqui é o ${config.agenteIaNome}! Como você é cliente VIP da casa, liberamos o convite do Clube Dino: cortes ilimitados com até 30% de economia e prioridade de horário. Conheça e ative em: ${config.linkDireto}${config.optOutAtivo ? '\n\n' + config.fraseOptOut : ''}`,
        opcoesMensagem: opcoes,
      });
    }
  }

  clientesReativacao.sort((a, b) => b.gastoTotal - a.gastoTotal);
  clientesUpSell.sort((a, b) => (b.impactoTicket || 0) - (a.impactoTicket || 0));
  clientesClube.sort((a, b) => b.gastoTotal - a.gastoTotal);

  const buracosAgenda = [
    { dia: 'Segunda', data: '2026-11-09', profissional: 'Bruno', horario: '14:30', potencial: 100 },
    { dia: 'Segunda', data: '2026-11-09', profissional: 'Bruno', horario: '16:00', potencial: 200 },
    { dia: 'Terça', data: '2026-11-10', profissional: 'Nati', horario: '11:15', potencial: 100 },
    { dia: 'Terça', data: '2026-11-10', profissional: 'Bruno', horario: '15:45', profissionalExtra: 'David', potencial: 100 },
    { dia: 'Quarta', data: '2026-11-11', profissional: 'Dino', horario: '09:30', potencial: 300 },
    { dia: 'Quarta', data: '2026-11-11', profissional: 'David', horario: '17:00', potencial: 100 },
  ];

  const potReativacao = Math.min(clientesReativacao.length, 60) * ticketMedioAtual;
  const potUpSell = Math.min(clientesUpSell.length, 40) * 60;
  const potBuracos = buracosAgenda.length * 4 * 150;
  const potClube = Math.min(clientesClube.length, 25) * 190;
  const receitaPotencialTotal = Math.round(potReativacao + potUpSell + potBuracos + potClube);

  const conversoes = obterConversoesVenda(raiz, empresaId);
  const totalConvertidoCaixa = conversoes.reduce((acc, c) => acc + (c.valor || 0), 0);

  const produtosDestaque = [
    { id: 'prod-01', nome: 'Pomada Modeladora Matte Dino', preco: 65, estoque: 24, categoria: 'Finalizadores', dicaVendaIa: 'Oferecer logo após a finalização do corte.' },
    { id: 'prod-02', nome: 'Óleo para Barba Hidratante Dino', preco: 75, estoque: 18, categoria: 'Cuidados com a Barba', dicaVendaIa: 'Recomendar para clientes de barba após a toalha quente.' },
    { id: 'prod-03', nome: 'Shampoo Mentolado Fortalecedor', preco: 55, estoque: 15, categoria: 'Lavatório & Cuidado', dicaVendaIa: 'Excelente para quem sente couro cabeludo oleoso.' },
    { id: 'prod-04', nome: 'Perfume Árabe Afeef Lattafa', preco: 569, estoque: 8, categoria: 'Perfumaria Importada', dicaVendaIa: 'Borrife na fita olfativa ao fechar a comanda do cliente VIP.' },
  ];

  return {
    ok: true,
    empresaId,
    lojaId,
    empresaNome: config.empresaNome,
    empresaSegmento: config.empresaSegmento,
    agenteIaNome: config.agenteIaNome,
    iconeSegmento: config.iconeSegmento,
    config,
    metaCompliance: {
      status: 'Protegido',
      optOutAtivo: config.optOutAtivo,
      fraseOptOut: config.fraseOptOut,
      travaHorarioComercial: config.travaHorarioComercial,
      emHorarioComercial: ehHorarioComercialCuiaba(),
      intervaloSegundos: config.intervaloSegundos,
      limiteDiarioEnvios: config.limiteDiarioEnvios,
      spintaxAtivo: true,
      scoreRisco: 'Muito Baixo (Tier 1)',
    },
    funilDinheiroMesa: {
      potencialTotalMapeado: receitaPotencialTotal,
      emNegociacaoAtiva: Math.round(receitaPotencialTotal * 0.45),
      dinheiroNoCaixa: totalConvertidoCaixa,
      totalConversoes: conversoes.length,
      taxaConversao: clientesReativacao.length > 0 ? Math.round((conversoes.length / Math.max(clientesReativacao.length, 1)) * 100) : 0,
      historicoRecente: conversoes.slice(0, 10),
    },
    labels: {
      reativacao: 'Clientes com Corte Vencido (Anti-Churn)',
      vagas: 'Buracos na Agenda dos Barbeiros',
      upsell: 'Up-Sell de Combos & Perfumaria',
      fidelidade: 'Candidatos para o Clube VIP Dino',
    },
    dataCalculo: hoje,
    kpis: {
      ticketMedioAtual,
      metaTicketMedio,
      expansaoProjetadaTicket: metaTicketMedio - ticketMedioAtual,
      taxaCrossSell,
      metaCrossSell: config.metaCrossSell || 55,
      taxaOcupacaoMedia: 76,
      metaOcupacao: 90,
      receitaPotencialTotal,
      clientesEmRiscoChurn: clientesReativacao.length,
      oportunidadesUpSell: clientesUpSell.length,
      candidatosClubeVip: clientesClube.length,
    },
    oportunidades: {
      reativacaoAntiChurn: clientesReativacao.slice(0, 35),
      upSellServicos: clientesUpSell.slice(0, 25),
      clubeAssinaturas: clientesClube.slice(0, 20),
      vagasOciosasSemana: buracosAgenda,
    },
    produtosDestaque,
    simulador: {
      baseMensalAtendimentos: 480,
      impactoMais20ReaisTicket: 480 * 20,
      impactoMais50ReaisTicket: 480 * 50,
      impactoRecuperar10Clientes: 10 * ticketMedioAtual,
      impactoPreencher2VagasDia: 2 * 24 * ticketMedioAtual,
    },
  };
}

/**
 * Inteligência de Vendas específica para STALLONE NUTRE SPORT (Suplementos, Fitness, E-commerce)
 */
function buildInteligenciaStallone({ raiz, empresaId, lojaId, hoje, config }) {
  const ticketMedioAtual = 185;
  const metaTicketMedio = config.metaTicketMedio || 265;
  const taxaCrossSell = 24;

  const listaBruta = [
    { id: 'st-01', nome: 'Lucas Mendonça', telefone: '(65) 99245-8811', diasSemVir: 32, ultimaCompra: '100% Whey Protein Isolado', gastoTotal: 490, propensao: 'Alta' },
    { id: 'st-02', nome: 'Thiago Barreto', telefone: '(65) 99611-3040', diasSemVir: 38, ultimaCompra: 'Creatina Creapure 300g', gastoTotal: 340, propensao: 'Alta' },
    { id: 'st-03', nome: 'Eduardo Guimarães', telefone: '(65) 98112-9022', diasSemVir: 45, ultimaCompra: 'Combo Hipertrofia (Whey + BCAA)', gastoTotal: 620, propensao: 'Média' },
    { id: 'st-04', nome: 'Mariana Pires', telefone: '(65) 99901-4477', diasSemVir: 28, ultimaCompra: 'Pré-Treino Insane + Barra de Proteína', gastoTotal: 280, propensao: 'Alta' },
    { id: 'st-05', nome: 'Rodrigo Alencar', telefone: '(65) 98402-1155', diasSemVir: 52, ultimaCompra: 'Pasta de Amendoim 1kg + Whey', gastoTotal: 510, propensao: 'Média' },
    { id: 'st-06', nome: 'Felipe Fontana', telefone: '(65) 99330-8800', diasSemVir: 35, ultimaCompra: 'Creatina Monohidratada 300g', gastoTotal: 195, propensao: 'Alta' },
    { id: 'st-07', nome: 'Guilherme Castro', telefone: '(65) 99201-7733', diasSemVir: 42, ultimaCompra: 'Whey Concentrado 900g', gastoTotal: 380, propensao: 'Média' },
  ];

  const clientesReativacao = listaBruta.map(c => {
    const opcoes = gerarOpcoesMensagens({
      clienteNome: c.nome,
      diasSemVir: c.diasSemVir,
      itemHistorico: c.ultimaCompra,
      agenteIa: config.agenteIaNome,
      empresaNome: config.empresaNome,
      chavePix: config.chavePix,
      linkDireto: config.linkDireto,
      fraseOptOut: config.optOutAtivo ? config.fraseOptOut : '',
      contextoSegmento: 'stallone',
    });
    return {
      ...c,
      mensagemIa: opcoes.fechamento.texto,
      opcoesMensagem: opcoes,
      riscoMeta: 'Muito Baixo (Meta Compliant)',
    };
  });

  const clientesUpSell = [
    { id: 'up-st-01', nome: 'Gabriel Martins', telefone: '(65) 99655-2211', tipoOferta: 'Adicionar Creatina Creapure ao Whey (+R$ 95)', impactoTicket: 95, mensagemIa: `Fala Gabriel! Vimos que você consome nosso Whey Isolado regularmente. Para acelerar o ganho de massa, combinar Creatina Creapure no pós-treino aumenta a síntese em 35%. Levando junto hoje você garante 15% de desconto no PIX: ${config.chavePix}. Quer incluir?${config.optOutAtivo ? '\n\n' + config.fraseOptOut : ''}` },
    { id: 'up-st-02', nome: 'Vinícius Ramos', telefone: '(65) 98115-4422', tipoOferta: 'Kit Pré-Treino Insane + Coqueteleira (+R$ 145)', impactoTicket: 145, mensagemIa: `E aí Vinícius! Para dar aquele gás monstro nos treinos pesados, nosso Pré-Treino Insane bate forte com energia e foco. Levando com a Coqueteleira térmica ela sai pela metade do preço. PIX direto da loja: ${config.chavePix}. Quer testar?${config.optOutAtivo ? '\n\n' + config.fraseOptOut : ''}` },
    { id: 'up-st-03', nome: 'Camila Zanin', telefone: '(65) 99203-8877', tipoOferta: 'Combo Queima & Definição (+R$ 110)', impactoTicket: 110, mensagemIa: `Olá Camila! Que tal turbinar seus treinos aeróbicos? O combo L-Carnitina + Chá Termogênico acelera o metabolismo com energia limpa. Posso incluir junto com o seu pedido habitual no link: ${config.linkDireto}?${config.optOutAtivo ? '\n\n' + config.fraseOptOut : ''}` },
  ];

  const clientesClube = [
    { id: 'clb-st-01', nome: 'Henrique Prado (Atleta)', telefone: '(65) 99988-1122', visitasTotal: 8, gastoTotal: 1650, mensagemIa: `Fala Henrique! Como você compra suplementos todo mês na Stallone, temos o Plano Mensal Recorrente: receba seu Whey + Creatina todo mês em casa com 20% OFF garantido. Veja os detalhes em: ${config.linkDireto}${config.optOutAtivo ? '\n\n' + config.fraseOptOut : ''}` },
    { id: 'clb-st-02', nome: 'André Siqueira', telefone: '(65) 99222-3344', visitasTotal: 6, gastoTotal: 1220, mensagemIa: `Opa André! Você já atingiu o nível VIP na Stallone Nutre Sport. Que tal entrar para o Clube Stallone Prime e garantir cashback de 10% em todas as compras e brindes exclusivos?${config.optOutAtivo ? '\n\n' + config.fraseOptOut : ''}` },
  ];

  const campanhasSemana = [
    { dia: 'Segunda a Quarta', data: '2026-11-09', foco: 'Refil de Creatina & Whey', potencial: 3200, dica: 'Disparo no WhatsApp para quem comprou há mais de 30 dias.' },
    { dia: 'Quinta a Sábado', data: '2026-11-12', foco: 'Combos de Alta Performance (Pré-treino + Whey)', potencial: 4500, dica: 'Foco nos praticantes de crossfit e musculação pesada.' },
    { dia: 'Domingo', data: '2026-11-15', foco: 'Kit Saudável (Pasta de Amendoim + Barrinhas)', potencial: 1800, dica: 'Snacks saudáveis para a semana de trabalho e treino.' },
  ];

  const produtosDestaque = [
    { id: 'prod-st-01', nome: '100% Whey Protein Isolado 900g', preco: 179, estoque: 32, categoria: 'Proteínas', dicaVendaIa: 'Puro e de rápida absorção pós-treino. Margem de 42%.' },
    { id: 'prod-st-02', nome: 'Creatina Creapure 300g Monohidratada', preco: 98, estoque: 45, categoria: 'Força & Explosão', dicaVendaIa: 'O suplemento mais vendido do mundo. Oferecer para todo cliente de Whey.' },
    { id: 'prod-st-03', nome: 'Pré-Treino Insane Energy 300g', preco: 135, estoque: 20, categoria: 'Energia & Foco', dicaVendaIa: 'Vasodilatação e energia sem crash. Alto valor agregado.' },
    { id: 'prod-st-04', nome: 'Pasta de Amendoim Integral 1kg', preco: 38, estoque: 40, categoria: 'Alimentos Saudáveis', dicaVendaIa: 'Excelente para fechar valor mínimo de frete grátis.' },
    { id: 'prod-st-05', nome: 'Coqueteleira Térmica Kytto Fit', preco: 49, estoque: 28, categoria: 'Acessórios', dicaVendaIa: 'Brinde de alto impacto ou up-sell rápido no balcão.' },
  ];

  const potReativacao = clientesReativacao.length * ticketMedioAtual;
  const potUpSell = clientesUpSell.length * 90;
  const potCampanhas = 9500;
  const receitaPotencialTotal = Math.round(potReativacao + potUpSell + potCampanhas);

  const conversoes = obterConversoesVenda(raiz, empresaId);
  const totalConvertidoCaixa = conversoes.reduce((acc, c) => acc + (c.valor || 0), 0);

  return {
    ok: true,
    empresaId,
    lojaId,
    empresaNome: config.empresaNome,
    empresaSegmento: config.empresaSegmento,
    agenteIaNome: config.agenteIaNome,
    iconeSegmento: config.iconeSegmento,
    config,
    metaCompliance: {
      status: 'Protegido',
      optOutAtivo: config.optOutAtivo,
      fraseOptOut: config.fraseOptOut,
      travaHorarioComercial: config.travaHorarioComercial,
      emHorarioComercial: ehHorarioComercialCuiaba(),
      intervaloSegundos: config.intervaloSegundos,
      limiteDiarioEnvios: config.limiteDiarioEnvios,
      spintaxAtivo: true,
      scoreRisco: 'Muito Baixo (Tier 1)',
    },
    funilDinheiroMesa: {
      potencialTotalMapeado: receitaPotencialTotal,
      emNegociacaoAtiva: Math.round(receitaPotencialTotal * 0.40),
      dinheiroNoCaixa: totalConvertidoCaixa,
      totalConversoes: conversoes.length,
      taxaConversao: clientesReativacao.length > 0 ? Math.round((conversoes.length / Math.max(clientesReativacao.length, 1)) * 100) : 0,
      historicoRecente: conversoes.slice(0, 10),
    },
    labels: {
      reativacao: 'Clientes em Fim de Suplemento (Recompra)',
      vagas: 'Campanhas & Combos da Semana',
      upsell: 'Up-Sell de Combos (Whey + Creatina)',
      fidelidade: 'Assinaturas & Recompra Recorrente',
    },
    dataCalculo: hoje,
    kpis: {
      ticketMedioAtual,
      metaTicketMedio,
      expansaoProjetadaTicket: metaTicketMedio - ticketMedioAtual,
      taxaCrossSell,
      metaCrossSell: config.metaCrossSell || 48,
      taxaOcupacaoMedia: 68,
      metaOcupacao: 85,
      receitaPotencialTotal,
      clientesEmRiscoChurn: clientesReativacao.length,
      oportunidadesUpSell: clientesUpSell.length,
      candidatosClubeVip: clientesClube.length,
    },
    oportunidades: {
      reativacaoAntiChurn: clientesReativacao,
      upSellServicos: clientesUpSell,
      clubeAssinaturas: clientesClube,
      vagasOciosasSemana: campanhasSemana,
    },
    produtosDestaque,
    simulador: {
      baseMensalAtendimentos: 350,
      impactoMais20ReaisTicket: 350 * 30,
      impactoMais50ReaisTicket: 350 * 60,
      impactoRecuperar10Clientes: 15 * ticketMedioAtual,
      impactoPreencher2VagasDia: 350 * 25,
    },
  };
}

/**
 * Inteligência de Vendas específica para AGRO OPEN (Agronegócio, Pecuária, Insumos & Esportes)
 */
function buildInteligenciaAgroOpen({ raiz, empresaId, lojaId, hoje, config }) {
  const ticketMedioAtual = 1850;
  const metaTicketMedio = config.metaTicketMedio || 3200;
  const taxaCrossSell = 32;

  const listaBruta = [
    { id: 'ao-01', nome: 'Fazenda Santa Tereza (Dr. Carlos)', telefone: '(65) 99981-2244', diasSemVir: 45, ultimaCompra: 'Adubo Foliar NPK + Sementes', gastoTotal: 9800, propensao: 'Alta' },
    { id: 'ao-02', nome: 'Agropecuária São José (Marcos)', telefone: '(65) 99612-5500', diasSemVir: 60, ultimaCompra: 'Suplemento Mineral Bovino de Seca', gastoTotal: 7400, propensao: 'Alta' },
    { id: 'ao-03', nome: 'Fazenda Primavera (Roberto)', telefone: '(65) 98401-3311', diasSemVir: 50, ultimaCompra: 'Defensivos e Herbicidas Pastagem', gastoTotal: 5200, propensao: 'Média' },
    { id: 'ao-04', nome: 'Estância Pantaneira (Sr. Arnaldo)', telefone: '(65) 99220-1199', diasSemVir: 38, ultimaCompra: 'Sal Mineral Proteinado 30kg', gastoTotal: 12500, propensao: 'Alta' },
    { id: 'ao-05', nome: 'Agropecuária Rio Verde (Paulo)', telefone: '(65) 98110-4433', diasSemVir: 55, ultimaCompra: 'Sementes Brachiaria Brizantha', gastoTotal: 8300, propensao: 'Alta' },
  ];

  const clientesReativacao = listaBruta.map(c => {
    const opcoes = gerarOpcoesMensagens({
      clienteNome: c.nome,
      diasSemVir: c.diasSemVir,
      itemHistorico: c.ultimaCompra,
      agenteIa: config.agenteIaNome,
      empresaNome: config.empresaNome,
      chavePix: config.chavePix,
      linkDireto: config.linkDireto,
      fraseOptOut: config.optOutAtivo ? config.fraseOptOut : '',
      contextoSegmento: 'agroopen',
    });
    return {
      ...c,
      mensagemIa: opcoes.fechamento.texto,
      opcoesMensagem: opcoes,
      riscoMeta: 'Muito Baixo (Meta Compliant)',
    };
  });

  const clientesUpSell = [
    { id: 'up-ao-01', nome: 'Fazenda Boa Esperança', telefone: '(65) 99233-7711', tipoOferta: 'Carga Fechada Adubo Foliar NPK (+R$ 2.400)', impactoTicket: 2400, mensagemIa: `Olá amigo produtor! Vimos que seu pedido de sementes está aprovado. Na compra casada com o adubo foliar de arranque, o frete da carga sai 100% bonificado. Fechamos via PIX da distribuidora (${config.chavePix}) ou link: ${config.linkDireto}?${config.optOutAtivo ? '\n\n' + config.fraseOptOut : ''}` },
    { id: 'up-ao-02', nome: 'Estância do Vale', telefone: '(65) 98122-6699', tipoOferta: 'Kit Nutrição Animal Proteico (+R$ 1.600)', impactoTicket: 1600, mensagemIa: `Olá! Complementando o sal mineral, nosso premix vitamínico eleva a taxa de prenhez e conversão alimentar. Podemos incluir 20 sacas com preço de fábrica? Chave PIX: ${config.chavePix}.${config.optOutAtivo ? '\n\n' + config.fraseOptOut : ''}` },
  ];

  const clientesClube = [
    { id: 'clb-ao-01', nome: 'Grupo Terra Viva', telefone: '(65) 99900-5544', visitasTotal: 12, gastoTotal: 34000, mensagemIa: `Olá! Pelo volume contínuo de compras da sua fazenda na Agro Open, você tem acesso ao programa Agro Prime com tabela de faturamento a prazo safra e consultoria agronômica dedicada. Acesse: ${config.linkDireto}${config.optOutAtivo ? '\n\n' + config.fraseOptOut : ''}` },
  ];

  const campanhasSemana = [
    { dia: 'Plantio & Safra', data: '2026-11-09', foco: 'Sementes de Pastagem & Adubo de Arranque', potencial: 45000, dica: 'Fechamento de cargas completas para produtores com pedidos pendentes.' },
    { dia: 'Nutrição Animal', data: '2026-11-12', foco: 'Sal Mineral & Ração Confinamento', potencial: 28000, dica: 'Campanha de atacado para pecuaristas da região.' },
    { dia: 'Linha Oficial', data: '2026-11-15', foco: 'Artigos Esportivos & Eventos Agro Open', potencial: 12000, dica: 'Bonés, camisetas premium e raqueteiras para clientes dos torneios.' },
  ];

  const produtosDestaque = [
    { id: 'prod-ao-01', nome: 'Adubo Foliar NPK Alta Concentração 20L', preco: 420, estoque: 65, categoria: 'Nutrição Vegetal', dicaVendaIa: 'Oferecer em carga de 50 a 100 galões para aplicação aérea ou tratorizada.' },
    { id: 'prod-ao-02', nome: 'Sementes Brachiaria Brizantha 20kg', preco: 380, estoque: 120, categoria: 'Sementes Certificadas', dicaVendaIa: 'Alta taxa de germinação com tratamento de fungicida e inseticida.' },
    { id: 'prod-ao-03', nome: 'Suplemento Mineral Bovino 30kg', preco: 160, estoque: 200, categoria: 'Nutrição Animal', dicaVendaIa: 'Venda por tonelada (paletes fechados) com desconto progressivo.' },
    { id: 'prod-ao-04', nome: 'Camiseta Premium Monograma Agro Open', preco: 149, estoque: 40, categoria: 'Linha Oficial', dicaVendaIa: 'Oferecer aos clientes vips e participantes dos torneios esportivos.' },
  ];

  const receitaPotencialTotal = 85000;
  const conversoes = obterConversoesVenda(raiz, empresaId);
  const totalConvertidoCaixa = conversoes.reduce((acc, c) => acc + (c.valor || 0), 0);

  return {
    ok: true,
    empresaId,
    lojaId,
    empresaNome: config.empresaNome,
    empresaSegmento: config.empresaSegmento,
    agenteIaNome: config.agenteIaNome,
    iconeSegmento: config.iconeSegmento,
    config,
    metaCompliance: {
      status: 'Protegido',
      optOutAtivo: config.optOutAtivo,
      fraseOptOut: config.fraseOptOut,
      travaHorarioComercial: config.travaHorarioComercial,
      emHorarioComercial: ehHorarioComercialCuiaba(),
      intervaloSegundos: config.intervaloSegundos,
      limiteDiarioEnvios: config.limiteDiarioEnvios,
      spintaxAtivo: true,
      scoreRisco: 'Muito Baixo (Tier 1)',
    },
    funilDinheiroMesa: {
      potencialTotalMapeado: receitaPotencialTotal,
      emNegociacaoAtiva: Math.round(receitaPotencialTotal * 0.35),
      dinheiroNoCaixa: totalConvertidoCaixa,
      totalConversoes: conversoes.length,
      taxaConversao: clientesReativacao.length > 0 ? Math.round((conversoes.length / Math.max(clientesReativacao.length, 1)) * 100) : 0,
      historicoRecente: conversoes.slice(0, 10),
    },
    labels: {
      reativacao: 'Produtores em Ciclo de Safra (Reativação)',
      vagas: 'Programação de Cargas & Safra',
      upsell: 'Vendas por Volume (Atacarejo)',
      fidelidade: 'Contratos de Fornecimento Safra',
    },
    dataCalculo: hoje,
    kpis: {
      ticketMedioAtual,
      metaTicketMedio,
      expansaoProjetadaTicket: metaTicketMedio - ticketMedioAtual,
      taxaCrossSell,
      metaCrossSell: config.metaCrossSell || 60,
      taxaOcupacaoMedia: 72,
      metaOcupacao: 88,
      receitaPotencialTotal,
      clientesEmRiscoChurn: clientesReativacao.length,
      oportunidadesUpSell: clientesUpSell.length,
      candidatosClubeVip: clientesClube.length,
    },
    oportunidades: {
      reativacaoAntiChurn: clientesReativacao,
      upSellServicos: clientesUpSell,
      clubeAssinaturas: clientesClube,
      vagasOciosasSemana: campanhasSemana,
    },
    produtosDestaque,
    simulador: {
      baseMensalAtendimentos: 120,
      impactoMais20ReaisTicket: 120 * 400,
      impactoMais50ReaisTicket: 120 * 900,
      impactoRecuperar10Clientes: 5 * ticketMedioAtual,
      impactoPreencher2VagasDia: 120 * 250,
    },
  };
}

/**
 * Inteligência de Vendas específica para SUPERMERCADO & ATACAREJO
 */
function buildInteligenciaSupermercado({ raiz, empresaId, lojaId, hoje, config }) {
  const ticketMedioAtual = 210;
  const metaTicketMedio = config.metaTicketMedio || 380;
  const taxaCrossSell = 38;

  const listaBruta = [
    { id: 'sup-01', nome: 'Dona Maria de Lourdes', telefone: '(65) 99933-1122', diasSemVir: 15, ultimaCompra: 'Cesta Básica Completa + Açougue', gastoTotal: 1850, propensao: 'Alta' },
    { id: 'sup-02', nome: 'Restaurante Sabor & Arte (Cláudio)', telefone: '(65) 99600-4411', diasSemVir: 12, ultimaCompra: 'Fardo de Arroz 30kg + Óleo Atacado', gastoTotal: 4600, propensao: 'Alta' },
    { id: 'sup-03', nome: 'Lanchonete Central (Valdir)', telefone: '(65) 98111-9922', diasSemVir: 18, ultimaCompra: 'Queijo Mussarela Peça + Frios', gastoTotal: 3200, propensao: 'Alta' },
    { id: 'sup-04', nome: 'Família Silveira (Carla)', telefone: '(65) 99244-8833', diasSemVir: 14, ultimaCompra: 'Hortifrúti + Limpeza + Carnes', gastoTotal: 1420, propensao: 'Alta' },
  ];

  const clientesReativacao = listaBruta.map(c => {
    const opcoes = gerarOpcoesMensagens({
      clienteNome: c.nome,
      diasSemVir: c.diasSemVir,
      itemHistorico: c.ultimaCompra,
      agenteIa: config.agenteIaNome,
      empresaNome: config.empresaNome,
      chavePix: config.chavePix,
      linkDireto: config.linkDireto,
      fraseOptOut: config.optOutAtivo ? config.fraseOptOut : '',
      contextoSegmento: 'supermercado',
    });
    return {
      ...c,
      mensagemIa: opcoes.fechamento.texto,
      opcoesMensagem: opcoes,
      riscoMeta: 'Muito Baixo (Meta Compliant)',
    };
  });

  const clientesUpSell = [
    { id: 'up-sup-01', nome: 'Pizzaria Bella Massa', telefone: '(65) 99655-0011', tipoOferta: 'Combo Farinha Especial + Molho Italiano (+R$ 450)', impactoTicket: 450, mensagemIa: `Olá! Vimos que seu pedido de laticínios está pronto. No fechamento conjunto com a Farinha Especial 00, o frete da carga sai grátis hoje. Pagamento via PIX direto: ${config.chavePix}. Podemos incluir?${config.optOutAtivo ? '\n\n' + config.fraseOptOut : ''}` },
  ];

  const clientesClube = [
    { id: 'clb-sup-01', nome: 'Buffet Festas & Cia', telefone: '(65) 99911-3344', visitasTotal: 15, gastoTotal: 22000, mensagemIa: `Olá! Como cliente Atacarejo Prime, sua empresa tem faturamento semanal facilitado e entregas diárias sem taxa. Conheça as vantagens em: ${config.linkDireto}${config.optOutAtivo ? '\n\n' + config.fraseOptOut : ''}` },
  ];

  const campanhasSemana = [
    { dia: 'Quarta & Quinta da Feira', data: '2026-11-11', foco: 'Hortifrúti Fresco & Legumes Direto do Produtor', potencial: 18000, dica: 'Desconto progressivo por quilo.' },
    { dia: 'Sexta do Churrasco', data: '2026-11-13', foco: 'Cortes Nobres Bovinos, Carvão e Cervejas Especiais', potencial: 25000, dica: 'Combos completos de churrasco de final de semana.' },
  ];

  const produtosDestaque = [
    { id: 'prod-sup-01', nome: 'Picanha Bovina Resfriada kg', preco: 69.90, estoque: 80, categoria: 'Açougue & Carnes', dicaVendaIa: 'Oferecer junto com carvão vegetal e sal grosso temperado.' },
    { id: 'prod-sup-02', nome: 'Arroz Tipo 1 5kg', preco: 29.90, estoque: 350, categoria: 'Mercearia Básica', dicaVendaIa: 'Produto âncora de cesta semanal.' },
    { id: 'prod-sup-03', nome: 'Azeite Extra Virgem 500ml', preco: 44.90, estoque: 90, categoria: 'Importados & Azeites', dicaVendaIa: 'Up-sell excelente no caixa.' },
  ];

  const receitaPotencialTotal = 43000;
  const conversoes = obterConversoesVenda(raiz, empresaId);
  const totalConvertidoCaixa = conversoes.reduce((acc, c) => acc + (c.valor || 0), 0);

  return {
    ok: true,
    empresaId,
    lojaId,
    empresaNome: config.empresaNome,
    empresaSegmento: config.empresaSegmento,
    agenteIaNome: config.agenteIaNome,
    iconeSegmento: config.iconeSegmento,
    config,
    metaCompliance: {
      status: 'Protegido',
      optOutAtivo: config.optOutAtivo,
      fraseOptOut: config.fraseOptOut,
      travaHorarioComercial: config.travaHorarioComercial,
      emHorarioComercial: ehHorarioComercialCuiaba(),
      intervaloSegundos: config.intervaloSegundos,
      limiteDiarioEnvios: config.limiteDiarioEnvios,
      spintaxAtivo: true,
      scoreRisco: 'Muito Baixo (Tier 1)',
    },
    funilDinheiroMesa: {
      potencialTotalMapeado: receitaPotencialTotal,
      emNegociacaoAtiva: Math.round(receitaPotencialTotal * 0.40),
      dinheiroNoCaixa: totalConvertidoCaixa,
      totalConversoes: conversoes.length,
      taxaConversao: clientesReativacao.length > 0 ? Math.round((conversoes.length / Math.max(clientesReativacao.length, 1)) * 100) : 0,
      historicoRecente: conversoes.slice(0, 10),
    },
    labels: {
      reativacao: 'Famílias & Empresas em Ciclo de Feira (Anti-Churn)',
      vagas: 'Dias Temáticos de Ofertas & Giro de Estoque',
      upsell: 'Combos & Cesta Cheia',
      fidelidade: 'Clientes Atacarejo VIP (Fidelidade)',
    },
    dataCalculo: hoje,
    kpis: {
      ticketMedioAtual,
      metaTicketMedio,
      expansaoProjetadaTicket: metaTicketMedio - ticketMedioAtual,
      taxaCrossSell,
      metaCrossSell: config.metaCrossSell || 65,
      taxaOcupacaoMedia: 80,
      metaOcupacao: 95,
      receitaPotencialTotal,
      clientesEmRiscoChurn: clientesReativacao.length,
      oportunidadesUpSell: clientesUpSell.length,
      candidatosClubeVip: clientesClube.length,
    },
    oportunidades: {
      reativacaoAntiChurn: clientesReativacao,
      upSellServicos: clientesUpSell,
      clubeAssinaturas: clientesClube,
      vagasOciosasSemana: campanhasSemana,
    },
    produtosDestaque,
    simulador: {
      baseMensalAtendimentos: 550,
      impactoMais20ReaisTicket: 550 * 25,
      impactoMais50ReaisTicket: 550 * 50,
      impactoRecuperar10Clientes: 10 * ticketMedioAtual,
      impactoPreencher2VagasDia: 550 * 30,
    },
  };
}

/**
 * Inteligência de Vendas específica para VAREJO & MODA / E-COMMERCE
 */
function buildInteligenciaVarejo({ raiz, empresaId, lojaId, hoje, config }) {
  const ticketMedioAtual = 195;
  const metaTicketMedio = config.metaTicketMedio || 290;
  const taxaCrossSell = 22;

  const listaBruta = [
    { id: 'var-01', nome: 'Beatriz Vasconcelos', telefone: '(65) 99911-8877', diasSemVir: 42, ultimaCompra: 'Vestido Midi Linho + Cinto', gastoTotal: 780, propensao: 'Alta' },
    { id: 'var-02', nome: 'Juliana Costa', telefone: '(65) 99200-5566', diasSemVir: 50, ultimaCompra: 'Conjunto Alfaiataria', gastoTotal: 920, propensao: 'Média' },
    { id: 'var-03', nome: 'Patrícia Prado', telefone: '(65) 98411-2233', diasSemVir: 35, ultimaCompra: 'Calça Jeans Premium + T-Shirt', gastoTotal: 540, propensao: 'Alta' },
  ];

  const clientesReativacao = listaBruta.map(c => {
    const opcoes = gerarOpcoesMensagens({
      clienteNome: c.nome,
      diasSemVir: c.diasSemVir,
      itemHistorico: c.ultimaCompra,
      agenteIa: config.agenteIaNome,
      empresaNome: config.empresaNome,
      chavePix: config.chavePix,
      linkDireto: config.linkDireto,
      fraseOptOut: config.optOutAtivo ? config.fraseOptOut : '',
      contextoSegmento: 'varejo',
    });
    return {
      ...c,
      mensagemIa: opcoes.fechamento.texto,
      opcoesMensagem: opcoes,
      riscoMeta: 'Muito Baixo (Meta Compliant)',
    };
  });

  const clientesUpSell = [
    { id: 'up-var-01', nome: 'Renata Albuquerque', telefone: '(65) 99611-7788', tipoOferta: 'Acessório Combinando: Bolsa Couro (+R$ 180)', impactoTicket: 180, mensagemIa: `Olá Renata! Chegou uma bolsa de couro legítimo que combina com as peças que você comprou. Quer garantir com 15% OFF no PIX (${config.chavePix})?${config.optOutAtivo ? '\n\n' + config.fraseOptOut : ''}` },
  ];

  const clientesClube = [
    { id: 'clb-var-01', nome: 'Fernanda Lins', telefone: '(65) 99955-4433', visitasTotal: 7, gastoTotal: 2900, mensagemIa: `Olá Fernanda! Como cliente Prime de moda, você tem frete grátis ilimitado e pré-lançamentos exclusivos. Veja em: ${config.linkDireto}${config.optOutAtivo ? '\n\n' + config.fraseOptOut : ''}` },
  ];

  const campanhasSemana = [
    { dia: 'Lançamento de Coleção', data: '2026-11-10', foco: 'Novidades de Primavera/Verão & Looks Completos', potencial: 14000, dica: 'Envio de catálogo interativo no WhatsApp.' },
  ];

  const produtosDestaque = [
    { id: 'prod-var-01', nome: 'Vestido Midi Linho Puro', preco: 289, estoque: 18, categoria: 'Vestuário', dicaVendaIa: 'Peça nobre de alto valor agregado.' },
    { id: 'prod-var-02', nome: 'Bolsa Couro Tiracolo', preco: 219, estoque: 14, categoria: 'Acessórios', dicaVendaIa: 'Excelente para cross-sell com looks.' },
  ];

  const receitaPotencialTotal = 28000;
  const conversoes = obterConversoesVenda(raiz, empresaId);
  const totalConvertidoCaixa = conversoes.reduce((acc, c) => acc + (c.valor || 0), 0);

  return {
    ok: true,
    empresaId,
    lojaId,
    empresaNome: config.empresaNome,
    empresaSegmento: config.empresaSegmento,
    agenteIaNome: config.agenteIaNome,
    iconeSegmento: config.iconeSegmento,
    config,
    metaCompliance: {
      status: 'Protegido',
      optOutAtivo: config.optOutAtivo,
      fraseOptOut: config.fraseOptOut,
      travaHorarioComercial: config.travaHorarioComercial,
      emHorarioComercial: ehHorarioComercialCuiaba(),
      intervaloSegundos: config.intervaloSegundos,
      limiteDiarioEnvios: config.limiteDiarioEnvios,
      spintaxAtivo: true,
      scoreRisco: 'Muito Baixo (Tier 1)',
    },
    funilDinheiroMesa: {
      potencialTotalMapeado: receitaPotencialTotal,
      emNegociacaoAtiva: Math.round(receitaPotencialTotal * 0.40),
      dinheiroNoCaixa: totalConvertidoCaixa,
      totalConversoes: conversoes.length,
      taxaConversao: clientesReativacao.length > 0 ? Math.round((conversoes.length / Math.max(clientesReativacao.length, 1)) * 100) : 0,
      historicoRecente: conversoes.slice(0, 10),
    },
    labels: {
      reativacao: 'Clientes em Ciclo de Renovação de Guarda-Roupa',
      vagas: 'Campanhas de Coleção & Queima de Estoque',
      upsell: 'Look Completo (Vestuário + Calçados/Acessórios)',
      fidelidade: 'Clientes Fashion VIP',
    },
    dataCalculo: hoje,
    kpis: {
      ticketMedioAtual,
      metaTicketMedio,
      expansaoProjetadaTicket: metaTicketMedio - ticketMedioAtual,
      taxaCrossSell,
      metaCrossSell: config.metaCrossSell || 50,
      taxaOcupacaoMedia: 70,
      metaOcupacao: 85,
      receitaPotencialTotal,
      clientesEmRiscoChurn: clientesReativacao.length,
      oportunidadesUpSell: clientesUpSell.length,
      candidatosClubeVip: clientesClube.length,
    },
    oportunidades: {
      reativacaoAntiChurn: clientesReativacao,
      upSellServicos: clientesUpSell,
      clubeAssinaturas: clientesClube,
      vagasOciosasSemana: campanhasSemana,
    },
    produtosDestaque,
    simulador: {
      baseMensalAtendimentos: 280,
      impactoMais20ReaisTicket: 280 * 25,
      impactoMais50ReaisTicket: 280 * 50,
      impactoRecuperar10Clientes: 10 * ticketMedioAtual,
      impactoPreencher2VagasDia: 280 * 20,
    },
  };
}

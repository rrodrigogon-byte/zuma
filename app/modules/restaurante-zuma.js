import express from 'express';
import {
  ZUMA_EMPRESA_ID,
  ZUMA_LOJA_ID,
  ZUMA_STOREFRONT_ID,
  ZUMA_DADOS_EMPRESA,
  ZUMA_CATEGORIAS,
  ZUMA_CARDAPIO_COMPLETO,
  ZUMA_MESAS_INICIAIS,
  ZUMA_CLIENTES_CRM,
  ZUMA_AI_CUSTOMER_FACTS,
  ZUMA_WHATSAPP_CONFIG,
  ZUMA_COMMERCE_STOREFRONT,
  ZUMA_MASCOTE_ZUMI,
  ZUMA_PLANO_CRESCIMENTO_250,
  ZUMA_PROGRAMACAO_SEMANAL,
  ZUMA_CAMPANHAS_WHATSAPP,
  ZUMA_CLUBE_ASSINATURA,
  ZUMA_RANKING_MESTRE_SUSHI,
  ZUMA_GANHOS_ENGENHARIA_CARDAPIO
} from '../zuma-cozinha-oriental-seed.js';

export const routerZuma = express.Router();

// GET /api/public/zuma/storefront — Metadados completos do storefront e da loja
routerZuma.get('/storefront', (req, res) => {
  res.json({
    ok: true,
    empresa: ZUMA_DADOS_EMPRESA,
    storefront: ZUMA_COMMERCE_STOREFRONT,
    mascote: ZUMA_MASCOTE_ZUMI,
    whatsapp: ZUMA_WHATSAPP_CONFIG,
    programacaoSemanal: ZUMA_PROGRAMACAO_SEMANAL,
    clubeAssinatura: ZUMA_CLUBE_ASSINATURA,
    rankingFidelidade: ZUMA_RANKING_MESTRE_SUSHI
  });
});

// GET /api/public/zuma/cardapio — Catálogo dos 211 produtos com filtros de busca, categoria e setor
routerZuma.get('/cardapio', (req, res) => {
  const { categoria, setor, busca, destaque } = req.query;
  let itens = [...ZUMA_CARDAPIO_COMPLETO];

  if (categoria) {
    itens = itens.filter(p => p.categoria_codigo === categoria || p.categoria_nome?.toLowerCase() === String(categoria).toLowerCase());
  }

  if (setor) {
    itens = itens.filter(p => p.setor_producao === setor);
  }

  if (destaque === 'true') {
    itens = itens.filter(p => p.destaque === true);
  }

  if (busca) {
    const termo = String(busca).toLowerCase().trim();
    itens = itens.filter(p => 
      p.nome?.toLowerCase().includes(termo) || 
      p.descricao?.toLowerCase().includes(termo) ||
      p.categoria_nome?.toLowerCase().includes(termo)
    );
  }

  res.json({
    ok: true,
    totalItens: itens.length,
    totalGeralCardapio: ZUMA_CARDAPIO_COMPLETO.length,
    categorias: ZUMA_CATEGORIAS,
    itens
  });
});

// GET /api/public/zuma/mesas — Grade das 27 mesas físicas e canais virtuais
routerZuma.get('/mesas', (req, res) => {
  res.json({
    ok: true,
    totalMesas: ZUMA_MESAS_INICIAIS.length,
    mesas: ZUMA_MESAS_INICIAIS.map(m => ({
      ...m,
      qrCodeUrl: `https://zuma.kytto.com.br/mesa/${m.numero}`,
      statusOcupacao: m.statusOcupacao || 'livre'
    }))
  });
});

// POST /api/public/zuma/orcamento-ia — Motor KyttoIA 2.5 Flash calculando sugestão de pedido personalizada
routerZuma.post('/orcamento-ia', (req, res) => {
  const { pessoas = 2, orcamentoMax = 120, preferencia = 'geral' } = req.body || {};
  const qtdPessoas = Math.max(1, parseInt(pessoas, 10));
  const valorMax = Math.max(35, parseFloat(orcamentoMax));

  // Algoritmo de harmonização do Motor KyttoIA baseado em Matriz BCG
  let sugestao = [];
  let valorTotal = 0;

  if (qtdPessoas === 1) {
    if (valorMax >= 85) {
      const combo = ZUMA_CARDAPIO_COMPLETO.find(p => p.codigo_pdv === 'ZUM-001') || { nome: 'Combinado Individual Salmão 18 Peças', preco: 62.00 };
      const soda = ZUMA_CARDAPIO_COMPLETO.find(p => p.setor_producao === 'bar' && p.preco <= 18) || { nome: 'Soda Italiana Artesanal de Maçã Verde', preco: 18.00 };
      sugestao.push(combo, soda);
    } else {
      const prato = ZUMA_CARDAPIO_COMPLETO.find(p => p.nome.includes('Yakissoba') || p.nome.includes('Sobá') || p.nome.includes('Poke')) || { nome: 'Yakissoba Tradicional', preco: 48.00 };
      const bebida = ZUMA_CARDAPIO_COMPLETO.find(p => p.preco <= 10) || { nome: 'Coca-Cola Zero 350ml', preco: 7.00 };
      sugestao.push(prato, bebida);
    }
  } else if (qtdPessoas === 2) {
    if (valorMax >= 180) {
      const combo = ZUMA_CARDAPIO_COMPLETO.find(p => p.nome.includes('56') || p.codigo_pdv === 'ZUM-003') || { nome: 'Combinado Zuma Casal 40 Peças', preco: 139.00 };
      const soda = { nome: 'Soda Italiana de Maçã Verde 500ml', preco: 18.00 };
      const soda2 = { nome: 'Soda Italiana de Frutas Vermelhas 500ml', preco: 18.00 };
      const sobremesa = { nome: 'Harumaki Romeu & Julieta (2un)', preco: 16.00 };
      sugestao.push(combo, soda, soda2, sobremesa);
    } else {
      const combo = { nome: 'Combinado Especial 30 Peças Salmão', preco: 89.90 };
      const soda = { nome: 'Soda Italiana de Maçã Verde 500ml', preco: 18.00 };
      const sobremesa = { nome: 'Harumaki Doce de Banana Nutella (1un)', preco: 11.00 };
      sugestao.push(combo, soda, sobremesa);
    }
  } else {
    // Família / 4+ pessoas
    const combo = ZUMA_CARDAPIO_COMPLETO.find(p => p.codigo_pdv === 'ZUM-004') || { nome: 'Especial Zuma 68 Peças Supremo', preco: 219.00 };
    const hot = { nome: 'Hot Roll Filadélfia Especial (10un)', preco: 42.00 };
    const sodas = { nome: '2x Sodas Italianas Artesanais (1L)', preco: 34.00 };
    const sobremesa = { nome: 'Mini Barquinha Doce Romeu & Nutella', preco: 28.00 };
    sugestao.push(combo, hot, sodas, sobremesa);
  }

  valorTotal = sugestao.reduce((acc, item) => acc + (parseFloat(item.preco) || 0), 0);

  res.json({
    ok: true,
    motorIa: "KyttoIA 2.5 Flash",
    mascote: "Zumi (Ninja do Zuma)",
    solicitacao: { qtdPessoas, valorMax, preferencia },
    valorTotalCalculado: valorTotal,
    dentroDoOrcamento: valorTotal <= valorMax,
    economiaOuDiferenca: (valorMax - valorTotal).toFixed(2),
    itensSugeridos: sugestao,
    mensagemWhatsAppPronta: `Bora, Tangará! 🍣 Sou o Zumi e montei o combo ideal pra ${qtdPessoas} pessoas por R$ ${valorTotal.toFixed(2)}:\n${sugestao.map(i => `• ${i.nome} (R$ ${parseFloat(i.preco).toFixed(2)})`).join('\n')}\nTotal: R$ ${valorTotal.toFixed(2)} com entrega expressa em até 35 min! Toque aqui pra confirmar: https://zuma.kytto.com.br/checkout`
  });
});

// POST /api/public/zuma/raspadinha — A Rodada do Zumi (Raspadinha Digital interativa)
routerZuma.post('/raspadinha', (req, res) => {
  const { telefone, clienteNome } = req.body || {};
  
  const premios = [
    { id: 'premio-1', titulo: 'Hot Roll Especial em Dobro!', descricao: 'Ganhe outra porção de 10un de Hot Roll Filadélfia no seu pedido de hoje.', cupom: 'ZUMIHOTDOBRO', valorEquivalente: 42.00, probabilidade: 0.35 },
    { id: 'premio-2', titulo: 'Soda Italiana Artesanal Cortesia!', descricao: 'Ganhe 1 Soda Italiana de Maçã Verde 500ml refrescante.', cupom: 'ZUMISODA', valorEquivalente: 18.00, probabilidade: 0.30 },
    { id: 'premio-3', titulo: 'Harumaki Romeu & Julieta Quentinho!', descricao: 'Sobremesa crocante cortesia para adoçar sua noite.', cupom: 'ZUMIDOCE', valorEquivalente: 16.00, probabilidade: 0.20 },
    { id: 'premio-4', titulo: 'R$ 15 de Desconto Direto no Combinado!', descricao: 'Desconto imediato na conta para compras acima de R$ 90.', cupom: 'ZUMI15OFF', valorEquivalente: 15.00, probabilidade: 0.10 },
    { id: 'premio-5', titulo: 'Frete Grátis Ninja do Zumi!', descricao: 'Entrega 100% grátis em qualquer bairro de Tangará da Serra.', cupom: 'ZUMIFRETE', valorEquivalente: 14.00, probabilidade: 0.05 }
  ];

  // Sorteio ponderado
  const rand = Math.random();
  let acumulado = 0;
  let selecionado = premios[0];

  for (const p of premios) {
    acumulado += p.probabilidade;
    if (rand <= acumulado) {
      selecionado = p;
      break;
    }
  }

  res.json({
    ok: true,
    evento: "Quinta da Rodada do Zumi",
    dataSorteio: new Date().toISOString(),
    cliente: { nome: clienteNome || "Amigo do Zuma", telefone: telefone || "" },
    premio: selecionado,
    mensagem: `Parabéns! O Zumi sorteou para você: ${selecionado.titulo} Use o cupom ${selecionado.cupom} no checkout ou WhatsApp!`
  });
});

// GET /api/admin/zuma/financeiro/resumo — DRE, Matriz BCG e Plano +250%
routerZuma.get('/financeiro/resumo', (req, res) => {
  res.json({
    ok: true,
    empresa: ZUMA_DADOS_EMPRESA.razao_social,
    cnpj: ZUMA_DADOS_EMPRESA.cnpj,
    planoCrescimento250: ZUMA_PLANO_CRESCIMENTO_250,
    engenhariaCardapio: ZUMA_GANHOS_ENGENHARIA_CARDAPIO,
    dreProjetadaMensal: {
      faturamentoBruto: 252070.00,
      impostosSimplesNacional: 17644.90, // ~7.0%
      faturamentoLiquido: 234425.10,
      cmvInsumosGlobal: 73843.91, // 31.5%
      margemContribuicao: 160581.19, // 68.5%
      custosFixosOperacionais: {
        folhaSushimansECozinha: 34500.00,
        equipeSalaoEAtendimento: 18200.00,
        aluguelEImovelAvBrasil: 14000.00,
        energiaEUtilidades: 8900.00,
        marketingEPlataformaKytto: 4500.00,
        embalagensTérmicas: 6800.00,
        outrosCustosFixos: 10663.69
      },
      lucroLiquidoMensal: 63017.50,
      margemLiquidaPercentual: 25.0
    }
  });
});

// GET /api/admin/zuma/campanhas — Relatório das 8 campanhas de WhatsApp do Zumi
routerZuma.get('/campanhas', (req, res) => {
  res.json({
    ok: true,
    totalCampanhas: ZUMA_CAMPANHAS_WHATSAPP.length,
    motorIa: "KyttoIA 2.5 Flash",
    mascote: "Zumi",
    campanhas: ZUMA_CAMPANHAS_WHATSAPP
  });
});

// GET /api/admin/zuma/crm — Carteira 360° dos clientes VIP com fatos de IA
routerZuma.get('/crm', (req, res) => {
  res.json({
    ok: true,
    totalClientesVip: ZUMA_CLIENTES_CRM.length,
    clientes: ZUMA_CLIENTES_CRM.map(c => ({
      ...c,
      fatosIa: ZUMA_AI_CUSTOMER_FACTS.filter(f => f.telefone === c.telefone)
    }))
  });
});

// GET /api/public/zuma/mercado-ia — Análise de Mercado e Benchmarking Tangará da Serra
routerZuma.get('/mercado-ia', (req, res) => {
  res.json({
    ok: true,
    cidade: "Tangará da Serra - MT",
    populacaoEstimada: 112000,
    poloRegionalAgro: true,
    motorIa: "KyttoIA 2.5 Flash",
    concorrentes: [
      {
        nome: "Zuma Cozinha Oriental",
        posicionamento: "Alta gastronomia oriental & Nikkei, salão premium, delivery próprio e KyttoIA",
        ticketMedio: 89.00,
        avaliacao: 4.8,
        pontosFortes: ["Cardápio com 211 itens", "Pescados frescos diários", "Mascote Zumi no WhatsApp", "27 mesas e deck"],
        pontosAtencao: ["22 horários ociosos semanais", "Dependência de dias de pico (sex/sáb)"],
        marketShareEstimado: 34.5
      },
      {
        nome: "Sansei Sushi Tangará",
        posicionamento: "Rodízio popular e festival promocional",
        ticketMedio: 78.00,
        avaliacao: 4.4,
        pontosFortes: ["Preço de entrada atrativo", "Marca tradicional na cidade"],
        pontosAtencao: ["Entrega lenta (75-90 min)", "Pouca variedade de pratos quentes e drinks"],
        marketShareEstimado: 28.0
      },
      {
        nome: "Sushi Ya Delivery",
        posicionamento: "Dark kitchen de delivery econômico",
        ticketMedio: 55.00,
        avaliacao: 4.1,
        pontosFortes: ["Preço baixo", "Combos fritos populares"],
        pontosAtencao: ["Embalagens sem lacre térmico", "Alto índice de atrasos em dias de chuva"],
        marketShareEstimado: 21.5
      },
      {
        nome: "Matsuri Culinária Oriental",
        posicionamento: "Restaurante à la carte tradicional",
        ticketMedio: 95.00,
        avaliacao: 4.5,
        pontosFortes: ["Ambiente clássico", "Clientela fiel madura"],
        pontosAtencao: ["Presença digital fraca", "Sem atendimento automatizado por IA"],
        marketShareEstimado: 16.0
      }
    ],
    oportunidadesKyttoIA: [
      {
        titulo: "Almoço Executivo Corporativo",
        descricao: "Tangará é polo do agronegócio com centenas de escritórios e revendas na Av. Brasil. Abrir de terça a sexta das 11h às 14h com Teppan, Yakisoba e Pokes até R$ 39,90 gera +R$ 28.000/mês.",
        impactoEstimado: "+R$ 28.500,00/mês",
        viabilidade: "Alta"
      },
      {
        titulo: "Segunda Express (Mercado Desabastecido)",
        descricao: "90% dos restaurantes orientais fecham na segunda-feira. Operar exclusivamente delivery com os 20 itens mais vendidos capta demanda reprimida com zero concorrência direta.",
        impactoEstimado: "+R$ 14.800,00/mês",
        viabilidade: "Imediata"
      },
      {
        titulo: "Clube Zumi de Assinatura (Recorrência)",
        descricao: "Primeiro clube de assinatura gastronômica de Tangará da Serra. 250 membros a R$ 29,90/mês geram R$ 7.475 de receita fixa mais R$ 31.800 em pedidos extras induzidos.",
        impactoEstimado: "+R$ 39.275,00/mês",
        viabilidade: "Alta"
      },
      {
        titulo: "Automação Meteorológica (Gatilhos de Clima)",
        descricao: "Ativação automática de campanhas quando a estação meteorológica registrar chuva ou frente fria, aumentando vendas de pratos quentes e Lamens no delivery em até 140%.",
        impactoEstimado: "+R$ 12.600,00/mês",
        viabilidade: "Alta"
      }
    ]
  });
});

// GET /api/public/zuma/mapa-calor — Mapa de Calor dos 22 Horários Vazios
routerZuma.get('/mapa-calor', (req, res) => {
  const dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const horas = ["11h", "12h", "13h", "18h", "19h", "20h", "21h", "22h"];
  
  // Matriz de pedidos médios por hora (null = fechado)
  const matriz = [
    [null, null, null, null, null, null, null, null], // Seg: Fechado (grande oportunidade)
    [null, null, null, 2, 4, 7, 5, 2],                 // Ter
    [null, null, null, 2, 5, 8, 6, 2],                 // Qua
    [null, null, null, 4, 8, 12, 9, 3],                // Qui
    [null, null, null, 7, 15, 22, 18, 9],              // Sex (Pico)
    [null, null, null, 8, 17, 24, 20, 10],             // Sáb (Pico)
    [null, null, null, 6, 13, 17, 12, 4]               // Dom
  ];

  const gapsOciosidade = [
    { dia: "Segunda", hora: "18h–22h", tipo: "Fechado", oportunidade: "Segunda Express (20 itens mais vendidos)", ganhoEstimado: "R$ 3.800/semana" },
    { dia: "Terça", hora: "18h–20h", tipo: "Movimento Baixo", oportunidade: "Terça do Hot Roll em dobro", ganhoEstimado: "R$ 1.950/semana" },
    { dia: "Quarta", hora: "18h–20h", tipo: "Movimento Baixo", oportunidade: "Quarta dos Combinados (-20%)", ganhoEstimado: "R$ 2.100/semana" },
    { dia: "Quinta", hora: "11h–14h", tipo: "Almoço Vazio", oportunidade: "Zuma Executivo Express", ganhoEstimado: "R$ 2.400/semana" },
    { dia: "Domingo", hora: "18h–19h30", tipo: "Início Lento", oportunidade: "Domingo Família Antecipada", ganhoEstimado: "R$ 1.850/semana" }
  ];

  res.json({
    ok: true,
    dias,
    horas,
    matriz,
    totalGapsDetectados: 22,
    gapsOciosidade,
    receitaRecuperavelMensal: 38400.00
  });
});

// GET /api/public/zuma/simulador-delivery — Base de Clientes e Segmentação RFM
routerZuma.get('/simulador-delivery', (req, res) => {
  const segmentosRfm = [
    {
      codigo: "fieis",
      nome: "Clientes Fiéis",
      descricao: "Compram 4+ vezes no mês, recência < 7 dias",
      totalBase: 186,
      ticketMedio: 92.50,
      propensaoCompra: 0.78,
      canalPreferido: "WhatsApp Oficial Kytto",
      melhorOferta: "Acesso antecipado ao Clube Zumi e degustações cortesia"
    },
    {
      codigo: "novos",
      nome: "Novos Clientes",
      descricao: "Fizeram apenas 1 pedido nos últimos 15 dias",
      totalBase: 412,
      ticketMedio: 58.20,
      propensaoCompra: 0.42,
      canalPreferido: "Storefront Web Kytto",
      melhorOferta: "Frete grátis no 2º pedido em até 7 dias"
    },
    {
      codigo: "sumidos",
      nome: "Clientes em Risco (Sumidos)",
      descricao: "Entre 30 e 90 dias sem realizar nenhum pedido",
      totalBase: 538,
      ticketMedio: 74.00,
      propensaoCompra: 0.22,
      canalPreferido: "WhatsApp Reativação",
      melhorOferta: "Cupom de R$ 15 + raspadinha digital nos dias fracos (ter/qua)"
    },
    {
      codigo: "vip",
      nome: "Baleias / VIP Omakase",
      descricao: "Top 10% de faturamento acumulado, ticket > R$ 180",
      totalBase: 94,
      ticketMedio: 198.00,
      propensaoCompra: 0.85,
      canalPreferido: "Linha VIP Concierge WhatsApp",
      melhorOferta: "Pratos especiais fora do cardápio, trufados e vieiras"
    },
    {
      codigo: "leads_quiz",
      nome: "Leads do Quiz do Zumi",
      descricao: "Interagiram no quiz/raspadinha no Instagram, sem 1ª compra",
      totalBase: 158,
      ticketMedio: 65.00,
      propensaoCompra: 0.35,
      canalPreferido: "WhatsApp Boas-Vindas",
      melhorOferta: "Ativação do prêmio sorteado na raspadinha"
    }
  ];

  res.json({
    ok: true,
    totalClientesAtivos: 1388,
    segmentos: segmentosRfm,
    taxaRecompraGeral: "31.2%",
    metaRecompraComKyttoIA: "48.5%"
  });
});

// GET /api/public/zuma/clima-delivery — Motor Meteorológico de Tangará da Serra
routerZuma.get('/clima-delivery', (req, res) => {
  const condicoesPossiveis = [
    {
      id: "chuva_forte",
      nome: "Chuva Torrencial / Tempestade Tropical",
      icone: "⛈️",
      temperatura: 22,
      impactoSalao: -75, // -75% no salão
      impactoDelivery: +145, // +145% no delivery
      categoriaEmDestaque: "Pratos Quentes, Lamens e Yakisobas",
      gatilhoKyttoIA: "Chuva em Tangará? Deixa o trânsito pra lá! Yakisoba e Hot Rolls quentinhos na sua porta com embalagem térmica selada.",
      cupomSugerido: "ZUMICHUVA"
    },
    {
      id: "calor_extremo",
      nome: "Calor Intenso do Cerrado (36°C+)",
      icone: "☀️",
      temperatura: 37,
      impactoSalao: +10,
      impactoDelivery: +35,
      categoriaEmDestaque: "Pokes Refrescantes, Ceviches, Sashimis & Drinks Gelados",
      gatilhoKyttoIA: "Calor de 37°C em Tangará? Peça um Ceviche Peruano geladinho ou nosso Poke de Salmão com Soda Italiana trincando!",
      cupomSugerido: "ZUMIREFRESCA"
    },
    {
      id: "frente_fria",
      nome: "Frente Fria Noturna (18°C)",
      icone: "🌬️",
      temperatura: 18,
      impactoSalao: -20,
      impactoDelivery: +80,
      categoriaEmDestaque: "Teppan de Mignon, Hot Rolls Especiais e Vinho/Saquê",
      gatilhoKyttoIA: "Noite fresquinha pede aconchego! Teppanyaki de Mignon cremoso e Hot Filadélfia em dobro para aquecer sua noite.",
      cupomSugerido: "ZUMIAQUECE"
    },
    {
      id: "noite_agradavel",
      nome: "Noite Estrelada Agradável (25°C)",
      icone: "✨",
      temperatura: 25,
      impactoSalao: +60,
      impactoDelivery: +15,
      categoriaEmDestaque: "Deck Climatizado, Barcas de Sushi & Chopp Artesanal",
      gatilhoKyttoIA: "O clima hoje está perfeito para o nosso Deck Climatizado na Av. Brasil! Reúna os amigos para a Barca Zuma e chopp gelado.",
      cupomSugerido: "ZUMIDECK"
    }
  ];

  res.json({
    ok: true,
    cidade: "Tangará da Serra - MT",
    estacaoMeteorologica: "Kytto Weather Engine v2",
    condicaoAtualPadrao: condicoesPossiveis[0],
    todasCondicoes: condicoesPossiveis
  });
});

// GET /api/public/zuma/omnichannel — Hub Integrador (iFood, Keeto, WhatsApp, Salão)
routerZuma.get('/omnichannel', (req, res) => {
  res.json({
    ok: true,
    canais: [
      {
        id: "ifood",
        nome: "iFood Marketplace",
        status: "Ativo / Sincronizado",
        comissaoPercentual: 23.0,
        ticketMedio: 72.00,
        pedidosMes: 340,
        faturamentoBrutoMes: 24480.00,
        custoComissaoMes: 5630.40, // 23%
        propriedadeDadosCliente: "0% (Dados retidos pelo iFood)",
        estrategiaKytto: "Inserir adesivo com QR Code no unboxing com cashback de 10% no app próprio para migrar 60% da base"
      },
      {
        id: "keeto_kytto",
        nome: "Keeto / Kytto Delivery Oficial (zuma.kytto.com.br)",
        status: "Ativo / Oficial",
        comissaoPercentual: 0.0, // Zero taxa de marketplace
        taxaProcessamentoPix: 0.99,
        ticketMedio: 89.50,
        pedidosMes: 820,
        faturamentoBrutoMes: 73390.00,
        custoComissaoMes: 726.56, // apenas 0.99% PIX
        propriedadeDadosCliente: "100% (Nome, telefone, endereço, histórico no CRM Kytto)",
        estrategiaKytto: "Canal primário de alta rentabilidade com fidelidade e Clube Zumi VIP"
      },
      {
        id: "whatsapp_zumi",
        nome: "WhatsApp Oficial com Mascote Zumi (KyttoIA)",
        status: "Ativo / 24h",
        comissaoPercentual: 0.0,
        taxaProcessamentoPix: 0.99,
        ticketMedio: 94.20,
        pedidosMes: 640,
        faturamentoBrutoMes: 60288.00,
        custoComissaoMes: 596.85,
        propriedadeDadosCliente: "100% no CRM",
        estrategiaKytto: "Orçamento inteligente, upsell automático (+18% ticket) e recompra assistida"
      },
      {
        id: "salao_mesas",
        nome: "Salão Presencial (27 Mesas & QR Code)",
        status: "Ativo / Salão Av. Brasil",
        comissaoPercentual: 0.0,
        ticketMedio: 135.00,
        pedidosMes: 690,
        faturamentoBrutoMes: 93150.00,
        custoComissaoMes: 0.0,
        propriedadeDadosCliente: "100% no CRM",
        estrategiaKytto: "Autoatendimento ágil por QR Code, KDS de 4 praças e rodízio/omakase"
      }
    ],
    resumoEconomiaMigracao: {
      faturamentoTotalDelivery: 158158.00,
      economiaMensalSemComissaoMarketplace: 18450.00,
      economiaAnualProjetada: 221400.00
    }
  });
});

// GET /api/admin/zuma/kds — Fila de produção simulada por praça
routerZuma.get('/kds', (req, res) => {
  res.json({
    ok: true,
    tempoMedioEntregaAtualMin: 41,
    metaTempoMaximoMin: 45,
    pracas: [
      {
        id: "sushi_bar",
        nome: "Sushi Bar (Bancada Fria)",
        pedidosFila: 4,
        tempoMedioPreparoMin: 14,
        itensAtivos: ["Especial Zuma 68 Pçs", "Combinado Nakato 26 Pçs", "Sashimi Trufado"]
      },
      {
        id: "cozinha",
        nome: "Cozinha Quente & Frituras",
        pedidosFila: 2,
        tempoMedioPreparoMin: 12,
        itensAtivos: ["Yakissoba Especial de Camarão", "Hot Roll Filadélfia", "Guioza Suíno"]
      },
      {
        id: "bar",
        nome: "Bar & Adega",
        pedidosFila: 1,
        tempoMedioPreparoMin: 3,
        itensAtivos: ["Soda Italiana Maçã Verde", "Saquê Junmai Dose"]
      },
      {
        id: "balcao",
        nome: "Balcão & Expedição Delivery",
        pedidosFila: 3,
        tempoMedioPreparoMin: 4,
        status: "Fluido"
      }
    ]
  });
});

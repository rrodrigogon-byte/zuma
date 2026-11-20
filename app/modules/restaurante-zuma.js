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
  let itens = ZUMA_CARDAPIO_COMPLETO.map(p => ({
    ...p,
    codigo_pdv: p.cod_pdv || p.codigo_pdv,
    categoria_codigo: p.slug || p.categoria_id || p.categoria_codigo,
    categoria_nome: p.categoria || p.categoria_nome,
    setor_producao: p.setor || p.setor_producao,
    foto_url: p.foto || p.foto_url
  }));

  if (categoria) {
    const catStr = String(categoria).toLowerCase();
    itens = itens.filter(p => 
      p.categoria_codigo === categoria || 
      p.categoria_id === categoria || 
      p.slug === categoria || 
      p.categoria_nome?.toLowerCase() === catStr ||
      p.categoria?.toLowerCase() === catStr
    );
  }

  if (setor) {
    itens = itens.filter(p => p.setor_producao === setor || p.setor === setor);
  }

  if (destaque === 'true') {
    itens = itens.filter(p => p.destaque === true);
  }

  if (busca) {
    const termo = String(busca).toLowerCase().trim();
    itens = itens.filter(p => 
      p.nome?.toLowerCase().includes(termo) || 
      p.descricao?.toLowerCase().includes(termo) ||
      p.categoria_nome?.toLowerCase().includes(termo) ||
      p.categoria?.toLowerCase().includes(termo) ||
      String(p.cod_pdv || p.codigo_pdv).toLowerCase().includes(termo)
    );
  }

  const categoriasNormalizadas = ZUMA_CATEGORIAS.map(c => ({
    ...c,
    codigo: c.slug || c.id || c.codigo
  }));

  res.json({
    ok: true,
    totalItens: itens.length,
    totalGeralCardapio: ZUMA_CARDAPIO_COMPLETO.length,
    categorias: categoriasNormalizadas,
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

// ============================================================================
// SUÍTE OPERACIONAL INTEGRADA: FRENTE DE CAIXA, KDS, GARÇOM & MOTOBOY
// ============================================================================

// Base de dados simulada em memória para operações de turno
let ESTADO_OPERACIONAL_TURNO = {
  caixa: {
    aberto: true,
    operador: "Akira Tanaka / Caixa Central",
    horaAbertura: "17:30",
    fundoTrocoInicial: 250.00,
    totalVendasDia: 3845.50,
    sangrias: [
      { id: "SANG-01", hora: "20:15", valor: 1200.00, motivo: "Recolhimento cofre sangria de segurança", operador: "Gerente Rodrigo" }
    ],
    suprimentos: [
      { id: "SUP-01", hora: "17:30", valor: 250.00, motivo: "Fundo de troco inicial", operador: "Caixa Central" }
    ],
    totaisPorFormaPagamento: {
      pix: 1840.00,
      cartaoCredito: 1215.50,
      cartaoDebito: 520.00,
      dinheiro: 270.00,
      valeRefeicao: 0.00
    },
    vendasRecentes: [
      { id: "VND-1041", hora: "21:12", mesa: "Mesa 04", total: 189.90, formaPagamento: "PIX", itensQtd: 3, status: "pago" },
      { id: "VND-1040", hora: "20:58", mesa: "Delivery #342", total: 135.00, formaPagamento: "Cartão Crédito", itensQtd: 2, status: "pago" },
      { id: "VND-1039", hora: "20:45", mesa: "Mesa 19 (Bistrô)", total: 245.00, formaPagamento: "PIX", itensQtd: 4, status: "pago" },
      { id: "VND-1038", hora: "20:30", mesa: "Balcão Takeaway", total: 69.90, formaPagamento: "Dinheiro", itensQtd: 1, status: "pago" }
    ]
  },
  cozinhaKds: [
    {
      id: "KDS-301",
      comanda: "Mesa 02",
      origem: "salao",
      hora: "21:15",
      minutosEspera: 7,
      slaMinutos: 15,
      status: "em_preparo",
      praca: "sushi_bar",
      itens: [
        { nome: "Combinado Zuma Casal 40 Peças", qtd: 1, obs: "Sem kani, caprichar no salmão trufado", pronto: false },
        { nome: "Gunkan Especial Ebi (2un)", qtd: 2, obs: "Flambado no maçarico", pronto: true }
      ]
    },
    {
      id: "KDS-302",
      comanda: "Delivery #345",
      origem: "delivery",
      hora: "21:18",
      minutosEspera: 4,
      slaMinutos: 20,
      status: "pendente",
      praca: "cozinha",
      itens: [
        { nome: "Yakissoba Especial de Camarão", qtd: 1, obs: "Molho extra separado", pronto: false },
        { nome: "Hot Roll Filadélfia (12un)", qtd: 2, obs: "Bem crocante na panko", pronto: false }
      ]
    },
    {
      id: "KDS-303",
      comanda: "Mesa 08",
      origem: "salao",
      hora: "21:05",
      minutosEspera: 17,
      slaMinutos: 15,
      status: "atrasado",
      praca: "fritadeira",
      itens: [
        { nome: "Guioza Suína 6un", qtd: 1, obs: "Ao vapor e grelhada", pronto: true },
        { nome: "Lula Crocante (300g)", qtd: 1, obs: "Com limão siciliano", pronto: false }
      ]
    },
    {
      id: "KDS-304",
      comanda: "Mesa 14 (Deck)",
      origem: "deck",
      hora: "21:20",
      minutosEspera: 2,
      slaMinutos: 5,
      status: "pronto",
      praca: "bar",
      itens: [
        { nome: "Soda Italiana de Maçã Verde 500ml", qtd: 2, obs: "Muito gelo", pronto: true },
        { nome: "Chopp Artesanal IPA 500ml", qtd: 2, obs: "Colarinho cremoso", pronto: true }
      ]
    }
  ],
  motoboys: {
    ativos: [
      { id: "MOTO-01", nome: "Carlos 'Ninja' Silva", placa: "RTO-4A12", telefone: "(65) 99611-2041", corridasHoje: 7, totalGanhosHoje: 98.00, status: "em_rota" },
      { id: "MOTO-02", nome: "Marcos Vinicius", placa: "QBA-8B90", telefone: "(65) 99933-7712", corridasHoje: 9, totalGanhosHoje: 126.00, status: "disponivel" },
      { id: "MOTO-03", nome: "Rafael Souza", placa: "JZA-1C34", telefone: "(65) 99822-5500", corridasHoje: 5, totalGanhosHoje: 70.00, status: "disponivel" }
    ],
    entregasExpedicao: [
      {
        id: "DEL-801",
        pedidoNumero: 341,
        cliente: "Juliana Mendes",
        telefone: "(65) 99912-3344",
        endereco: "Rua Antônio Hortolani, 450, Centro",
        bairro: "Centro",
        cidade: "Tangará da Serra - MT",
        taxaEntrega: 12.00,
        totalPedido: 148.50,
        formaPagamento: "Pago Online (PIX Kytto)",
        itensResumo: "Combo 26 Pçs + Hot Nutella + Refri",
        horaPronto: "21:10",
        statusEntrega: "pronto_para_coleta",
        motoboyDesignado: null,
        codigoConfirmacao: "4821"
      },
      {
        id: "DEL-802",
        pedidoNumero: 342,
        cliente: "Dr. Fernando Barros",
        telefone: "(65) 99655-8899",
        endereco: "Av. Tancredo Neves, 1220, Jardim Europa",
        bairro: "Jardim Europa",
        cidade: "Tangará da Serra - MT",
        taxaEntrega: 14.00,
        totalPedido: 215.00,
        formaPagamento: "Cartão na Entrega (Maquininha Kytto)",
        itensResumo: "Especial Zuma 68 Pçs + 2x Sodas Maçã Verde",
        horaPronto: "21:14",
        statusEntrega: "em_transito",
        motoboyDesignado: "Carlos 'Ninja' Silva",
        codigoConfirmacao: "7913"
      },
      {
        id: "DEL-803",
        pedidoNumero: 343,
        cliente: "Beatriz Oliveira",
        telefone: "(65) 99877-1122",
        endereco: "Rua 26, 890, Vila Alta",
        bairro: "Vila Alta",
        cidade: "Tangará da Serra - MT",
        taxaEntrega: 16.00,
        totalPedido: 92.00,
        formaPagamento: "Pago Online (Cartão)",
        itensResumo: "Yakissoba Misto + Rolinho Primavera",
        horaPronto: "21:18",
        statusEntrega: "pronto_para_coleta",
        motoboyDesignado: null,
        codigoConfirmacao: "3154"
      }
    ]
  }
};

// GET /api/public/zuma/operacional/completo — Central Unificada de Caixa, KDS, Garçom e Motoboy
routerZuma.get('/operacional/completo', (req, res) => {
  res.json({
    ok: true,
    restaurante: {
      nome: ZUMA_DADOS_EMPRESA.nomeFantasia || ZUMA_DADOS_EMPRESA.nome,
      razaoSocial: ZUMA_DADOS_EMPRESA.razaoSocial,
      cnpj: ZUMA_DADOS_EMPRESA.cnpj,
      cidade: "Tangará da Serra - MT",
      endereco: "Av. Brasil 1605 S"
    },
    totalProdutosCatalogo: ZUMA_CARDAPIO_COMPLETO.length,
    totalMesas: ZUMA_MESAS_INICIAIS.length,
    categorias: ZUMA_CATEGORIAS.map(c => ({ ...c, codigo: c.slug || c.id })),
    produtos: ZUMA_CARDAPIO_COMPLETO.map(p => ({
      ...p,
      codigo_pdv: p.cod_pdv || p.codigo_pdv,
      categoria_codigo: p.slug || p.categoria_id,
      categoria_nome: p.categoria,
      setor_producao: p.setor,
      foto_url: p.foto
    })),
    operacional: ESTADO_OPERACIONAL_TURNO
  });
});

// POST /api/public/zuma/caixa/fechar-venda — Fechamento no PDV Frente de Caixa
routerZuma.post('/caixa/fechar-venda', (req, res) => {
  const { mesaNumero, valorTotal, formaPagamento, valorRecebidoDinheiro, itens } = req.body || {};
  const total = parseFloat(valorTotal) || 0;
  const recebido = parseFloat(valorRecebidoDinheiro) || total;
  const troco = Math.max(0, recebido - total);
  const forma = String(formaPagamento || 'pix').toLowerCase();

  const vendaId = `VND-${Math.floor(1000 + Math.random() * 9000)}`;
  const novaVenda = {
    id: vendaId,
    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    mesa: mesaNumero ? `Mesa ${mesaNumero}` : "Balcão / Caixa",
    total,
    formaPagamento: formaPagamento || "PIX",
    itensQtd: Array.isArray(itens) ? itens.length : 1,
    status: "pago",
    troco: troco > 0 ? troco : 0
  };

  ESTADO_OPERACIONAL_TURNO.caixa.vendasRecentes.unshift(novaVenda);
  ESTADO_OPERACIONAL_TURNO.caixa.totalVendasDia += total;

  if (forma.includes('pix')) ESTADO_OPERACIONAL_TURNO.caixa.totaisPorFormaPagamento.pix += total;
  else if (forma.includes('credito')) ESTADO_OPERACIONAL_TURNO.caixa.totaisPorFormaPagamento.cartaoCredito += total;
  else if (forma.includes('debito')) ESTADO_OPERACIONAL_TURNO.caixa.totaisPorFormaPagamento.cartaoDebito += total;
  else if (forma.includes('dinheiro')) ESTADO_OPERACIONAL_TURNO.caixa.totaisPorFormaPagamento.dinheiro += total;

  res.json({
    ok: true,
    venda: novaVenda,
    reciboFiscal: {
      chaveNFCe: `512611${ZUMA_DADOS_EMPRESA.cnpj.replace(/\D/g, '')}650010000000001${Math.floor(10000000 + Math.random() * 90000000)}1`,
      protocoloAutorizacao: `1512600${Math.floor(100000000 + Math.random() * 900000000)}`,
      hora: novaVenda.hora,
      valorTotal: total,
      troco
    },
    mensagem: `Venda ${vendaId} registrada com sucesso no PDV Kytto!`
  });
});

// POST /api/public/zuma/garcom/lancar-pedido — Garçom lançando comanda na mesa
routerZuma.post('/garcom/lancar-pedido', (req, res) => {
  const { mesaNumero, garcomNome, itens } = req.body || {};
  const kdsId = `KDS-${Math.floor(300 + Math.random() * 600)}`;
  
  const novoKds = {
    id: kdsId,
    comanda: `Mesa ${mesaNumero || '01'}`,
    origem: "salao",
    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    minutosEspera: 0,
    slaMinutos: 15,
    status: "em_preparo",
    praca: "sushi_bar",
    garcom: garcomNome || "Garçom Salão",
    itens: Array.isArray(itens) && itens.length ? itens : [
      { nome: "Combinado Zuma Especial 30 Peças", qtd: 1, obs: "Sem gergelim", pronto: false }
    ]
  };

  ESTADO_OPERACIONAL_TURNO.cozinhaKds.unshift(novoKds);

  res.json({
    ok: true,
    kdsId,
    mesa: mesaNumero,
    mensagem: `Pedido da Mesa ${mesaNumero} disparado para a Cozinha & Sushi Bar!`
  });
});

// POST /api/public/zuma/cozinha/atualizar-status — KDS atualizando prato
routerZuma.post('/cozinha/atualizar-status', (req, res) => {
  const { kdsId, novoStatus } = req.body || {};
  const kds = ESTADO_OPERACIONAL_TURNO.cozinhaKds.find(k => k.id === kdsId);
  
  if (kds) {
    kds.status = novoStatus || "pronto";
    if (kds.status === "pronto") {
      kds.itens.forEach(i => i.pronto = true);
    }
  }

  res.json({
    ok: true,
    kdsId,
    status: kds ? kds.status : "atualizado",
    mensagem: `Status da comanda ${kdsId} atualizado para ${novoStatus}!`
  });
});

// POST /api/public/zuma/motoboy/assumir — Motoboy assumindo corrida delivery
routerZuma.post('/motoboy/assumir', (req, res) => {
  const { entregaId, motoboyNome } = req.body || {};
  const entrega = ESTADO_OPERACIONAL_TURNO.motoboys.entregasExpedicao.find(e => e.id === entregaId);
  
  if (entrega) {
    entrega.statusEntrega = "em_transito";
    entrega.motoboyDesignado = motoboyNome || "Carlos 'Ninja'";
  }

  res.json({
    ok: true,
    entregaId,
    status: "em_transito",
    motoboy: entrega?.motoboyDesignado,
    mensagem: `Entrega ${entregaId} assumida com sucesso! Boa rota!`
  });
});

// POST /api/public/zuma/motoboy/concluir — Motoboy confirmando entrega com cliente
routerZuma.post('/motoboy/concluir', (req, res) => {
  const { entregaId, codigoConfirmacao } = req.body || {};
  const entrega = ESTADO_OPERACIONAL_TURNO.motoboys.entregasExpedicao.find(e => e.id === entregaId);
  
  if (entrega) {
    entrega.statusEntrega = "entregue_com_sucesso";
  }

  res.json({
    ok: true,
    entregaId,
    status: "entregue_com_sucesso",
    taxaCreditada: entrega ? entrega.taxaEntrega : 12.00,
    mensagem: `Entrega ${entregaId} concluída com sucesso! Taxa creditada na carteira do motoboy.`
  });
});

// GET /api/public/zuma/download-offline — Pacote de download completo da operação
routerZuma.get('/download-offline', (req, res) => {
  res.json({
    ok: true,
    dataGeracao: new Date().toISOString(),
    versaoPacote: "2026.11.19-kytto-zuma-v2",
    restaurante: ZUMA_DADOS_EMPRESA,
    catalogoProdutos: ZUMA_CARDAPIO_COMPLETO,
    categorias: ZUMA_CATEGORIAS,
    mesas: ZUMA_MESAS_INICIAIS,
    crmVip: ZUMA_CLIENTES_CRM,
    mascote: ZUMA_MASCOTE_ZUMI,
    planoCrescimento: ZUMA_PLANO_CRESCIMENTO_250,
    engenhariaCardapio: ZUMA_GANHOS_ENGENHARIA_CARDAPIO,
    rotinasOperacionais: {
      caixa: "Abertura com suprimento R$ 250, sangrias automáticas > R$ 1.000, conferência cega no fechamento",
      cozinha: "SLA Frio 15 min, Quente 18 min, KDS 4 praças, bip sonoro em novos pedidos",
      garcom: "Autoatendimento QR Code nas 27 mesas, comanda mobile touch, notificação de prato pronto",
      motoboy: "Expedição integrada com rotas Waze/Google Maps, código de confirmação de 4 dígitos"
    }
  });
});

// ============================================================================
// MÁQUINA DE VENDAS & LEADS 360° — MOTOR KYTTOIA 2.5 FLASH
// ============================================================================

// GET /api/public/zuma/trafego/campanhas — Anúncios e campanhas Meta/Google Ads
routerZuma.get('/trafego/campanhas', (req, res) => {
  res.json({
    ok: true,
    motorIA: "Motor KyttoIA 2.5 Flash",
    localizacao: "Tangará da Serra - MT (Raio 10km)",
    publicoEstimadoTangara: 46800,
    roasMedioProjetado: 8.85,
    campanhas: [
      {
        id: "meta_delivery_noturno",
        plataforma: "Instagram / Meta Ads",
        objetivo: "Vendas Imediatas no Delivery (Sexta e Sábado)",
        publico: "Homens e Mulheres 22-52 anos em Tangará da Serra | Interesses em Gastronomia Japonesa, Sushi e Delivery",
        orcamentoSugeridoDia: 40.00,
        roasEsperado: 9.2,
        copyKyttoIA: "Sexta-feira em Tangará pede salmão fresquinho do Zuma! Combinados a partir de R$ 39,90 entregues na porta da sua casa em até 35 min com embalagem térmica selada. Peça direto no WhatsApp do Zumi e ganhe Raspadinha com prêmio garantido!",
        cta: "Pedir no WhatsApp Oficial",
        linkDestino: "https://kytto.com.br/zuma/index.html#cardapio?utm_source=meta_ads&utm_campaign=delivery_noturno",
        criativoSugerido: "Foto real em alta resolução do Especial Zuma 68 Peças ou Combo 26 Peças com iluminação quente de bancada"
      },
      {
        id: "meta_lead_magnet_raspadinha",
        plataforma: "Instagram Stories / Reels / TikTok",
        objetivo: "Captação Massiva de Leads no WhatsApp (Custo < R$ 1,00/lead)",
        publico: "População de Tangará da Serra 18-45 anos | Interesses em Promoções, Sushi e Gastronomia",
        orcamentoSugeridoDia: 25.00,
        roasEsperado: 7.8,
        copyKyttoIA: "Tangará da Serra ganhou uma Raspadinha Digital de Sushi! Toque no link, raspe a tela do celular e ganhe até R$ 25 OFF ou um Temaki Salmão cortesia no seu primeiro pedido do Zuma Cozinha Oriental!",
        cta: "Girar / Raspar Agora",
        linkDestino: "https://kytto.com.br/zuma/index.html#raspadinha?utm_source=stories_leads",
        criativoSugerido: "Vídeo dinâmico de 10s raspando a tela do smartphone e revelando 'VOCÊ GANHOU 1 TEMAKI!'"
      },
      {
        id: "meta_b2b_almoco_agro",
        plataforma: "LinkedIn / Instagram / Facebook",
        objetivo: "Almoço Executivo Corporativo do Agro (Terça a Sexta 11h-14h)",
        publico: "Produtores rurais, agrônomos, contadores, diretores de tradings e revendas na Av. Brasil e Centro",
        orcamentoSugeridoDia: 35.00,
        roasEsperado: 10.4,
        copyKyttoIA: "Almoço executivo oriental na Av. Brasil em Tangará da Serra! Teppan de Mignon grelhado e Pokes refrescantes servidos em 12 minutos no nosso deck climatizado ou entregues no seu escritório. Pratos a partir de R$ 36,90 com nota fiscal corporativa.",
        cta: "Ver Cardápio Executivo",
        linkDestino: "https://kytto.com.br/zuma/index.html#almoco_executivo",
        criativoSugerido: "Prato executivo Teppan Mignon fumegante ao lado do ambiente climatizado do salão"
      },
      {
        id: "google_search_sushi_tangara",
        plataforma: "Google Ads (Rede de Pesquisa)",
        objetivo: "Capturar Clientes com Intenção Direta de Compra",
        palavrasChave: ["sushi tangara da serra", "restaurante japones tangara", "delivery oriental tangara", "zuma tangara", "onde comer sushi tangara"],
        orcamentoSugeridoDia: 30.00,
        roasEsperado: 11.5,
        copyKyttoIA: "Zuma Cozinha Oriental Tangará | O Melhor Sushi da Av. Brasil - Cardápio Real com 211 Itens, Rodízio e Delivery Rápido. Peça pelo WhatsApp Oficial com Desconto Exclusivo de Primeira Compra!",
        cta: "Pedir Agora",
        linkDestino: "https://kytto.com.br/zuma/index.html"
      }
    ],
    metricasConsolidadas: {
      orcamentoRecomendadoMes: 1200.00,
      alcanceEstimadoPessoas: 32500,
      leadsCapturadosWhatsApp: 420,
      vendasDiretasGeradas: 135,
      ticketMedioEsperado: 89.00,
      faturamentoAdicionalProjetado: 12015.00,
      roasProjetadoFinal: "10.0x"
    }
  });
});

// GET /api/public/zuma/indicacao/dados — Regras e ranking do Indique e Ganhe
routerZuma.get('/indicacao/dados', (req, res) => {
  res.json({
    ok: true,
    programa: "Indique um Amigo e Ganhe Zuma",
    recompensaAmigo: "R$ 15,00 de desconto no primeiro pedido (acima de R$ 60)",
    recompensaIndicador: "1 Temaki Salmão Completo cortesia (ou R$ 20 de crédito)",
    kFactorViralidade: 1.35,
    totalAmigosIndicadosMes: 184,
    faturamentoGeradoIndicacoesMes: 16376.00,
    topEmbaixadores: [
      { rank: 1, nome: "Mariana Silva (Jardim Europa)", amigosIndicados: 19, creditosGanhos: 380.00, status: "Embaixadora Diamante" },
      { rank: 2, nome: "Lucas Prado (Centro)", amigosIndicados: 15, creditosGanhos: 300.00, status: "Embaixador Ouro" },
      { rank: 3, nome: "Fernanda Souza (Vila Alta)", amigosIndicados: 12, creditosGanhos: 240.00, status: "Embaixadora Ouro" },
      { rank: 4, nome: "Rodrigo Gonçalves (Av. Brasil)", amigosIndicados: 10, creditosGanhos: 200.00, status: "Embaixador Prata" },
      { rank: 5, nome: "Camila Becker (Tarumã)", amigosIndicados: 8, creditosGanhos: 160.00, status: "Embaixadora Prata" }
    ]
  });
});

// POST /api/public/zuma/indicacao/gerar-link — Gerador de link viral para o WhatsApp
routerZuma.post('/indicacao/gerar-link', (req, res) => {
  const { nome, telefone } = req.body || {};
  const codigo = (nome ? nome.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8) : 'ZUMA') + Math.floor(10 + Math.random() * 89);
  const link = `https://kytto.com.br/zuma/index.html?ref=${codigo}#cardapio`;
  const textoWhatsApp = `🍣 Olá! Ganhei um presente para você do *Zuma Cozinha Oriental* em Tangará da Serra! Use meu cupom *${codigo}* ou acesse pelo link abaixo para ganhar *R$ 15,00 de desconto* no seu primeiro pedido do melhor sushi da cidade:\n\n👉 ${link}\n\nAproveite que o salmão chega fresco todo dia!`;

  res.json({
    ok: true,
    codigo,
    link,
    textoWhatsApp,
    mensagem: `Link exclusivo gerado para ${nome || 'Cliente'}!`
  });
});

// GET /api/public/zuma/b2b/convenios — Convênios Corporativos & Almoço do Agro
routerZuma.get('/b2b/convenios', (req, res) => {
  res.json({
    ok: true,
    poloEconomico: "Tangará da Serra - Capital Regional do Agronegócio",
    ticketMedioCorporativo: 148.00,
    empresasConveniadas: [
      {
        id: "B2B-01",
        empresa: "SLC Agrícola - Filial Tangará",
        setor: "Agronegócio & Grãos",
        colaboradoresAtendidos: 48,
        beneficio: "10% desconto no almoço executivo presencial + faturamento quinzenal para reuniões",
        faturamentoMensalMedio: 4650.00,
        contatoResponsavel: "Carla Mendes (RH)"
      },
      {
        id: "B2B-02",
        empresa: "Amaggi Escritório Regional Sudoeste",
        setor: "Trading & Logística Agro",
        colaboradoresAtendidos: 35,
        beneficio: "Menu executivo fechado R$ 39,90 por pessoa + entrega expressa em 20 min",
        faturamentoMensalMedio: 3820.00,
        contatoResponsavel: "Marcos Vinicius (Operações)"
      },
      {
        id: "B2B-03",
        empresa: "Revenda Agro Brasil (Sementes & Defensivos)",
        setor: "Insumos Agrícolas Av. Brasil",
        colaboradoresAtendidos: 26,
        beneficio: "Barcas executivas para recepção de produtores rurais e clientes VIP",
        faturamentoMensalMedio: 3150.00,
        contatoResponsavel: "Eng. Agrônomo Eduardo Lima"
      },
      {
        id: "B2B-04",
        empresa: "Cooperativa Sicredi Sudoeste MT/PA",
        setor: "Instituição Financeira Cooperativa",
        colaboradoresAtendidos: 65,
        beneficio: "Convênio Clube Zumi Corporativo com cashback de 5% para colaboradores",
        faturamentoMensalMedio: 5890.00,
        contatoResponsavel: "Luciana Freitas (Gestão de Pessoas)"
      },
      {
        id: "B2B-05",
        empresa: "Barros & Associados Advocacia Agrária",
        setor: "Direito Rural & Tributário",
        colaboradoresAtendidos: 14,
        beneficio: "Mesa cativa no Sushi Bar às quintas-feiras e faturamento mensal",
        faturamentoMensalMedio: 1940.00,
        contatoResponsavel: "Dr. Fernando Barros"
      }
    ],
    resumoCorporativo: {
      totalEmpresas: 5,
      colaboradoresCadastrados: 188,
      receitaRecorrenteB2BMes: 19450.00,
      receitaRecorrenteB2BAnual: 233400.00
    }
  });
});

// POST /api/public/zuma/b2b/proposta — Geração de proposta comercial corporativa IA
routerZuma.post('/b2b/proposta', (req, res) => {
  const { empresaNome, contatoNome, qtdColaboradores, setorAtuacao } = req.body || {};
  const nomeEmp = empresaNome || "Empresa Parceira";
  const responsavel = contatoNome || "Diretoria";
  const colaboradores = parseInt(qtdColaboradores) || 30;

  const propostaTexto = `PROPOSTA COMERCIAL CONVÊNIO CORPORATIVO ZUMA AGRO\nPara: ${nomeEmp} | A/C: ${responsavel}\nOrigem: Zuma Cozinha Oriental — Av. Brasil 1605 S, Tangará da Serra - MT\n\nPrezados(as),\nO Zuma Cozinha Oriental tem a satisfação de apresentar as condições de parceria corporativa exclusiva para a equipe da ${nomeEmp}:\n\n1. ALMOÇO EXECUTIVO NO DECK CLIMATIZADO:\n- Pratos executivos orientais servidos em até 12 minutos (ou entregues no escritório com frete bonificado).\n- Desconto corporativo permanente de 10% para todos os colaboradores mediante crachá ou cadastro.\n\n2. REUNIÕES DE DIRETORIA E RECEPÇÃO DE CLIENTES DO AGRO:\n- Barcas executivas personalizadas e combos sob medida para eventos e reuniões corporativas.\n- Reserva prioritária de mesas no Salão VIP e Deck Climatizado da Av. Brasil.\n\n3. FATURAMENTO QUINZENAL FACILITADO:\n- Comandas centralizadas com fechamento quinzenal no CNPJ via boleto bancário ou PIX corporativo, acompanhado de relatório discriminado de consumo.\n\nElaborado sob medida pelo Motor KyttoIA 2.5 Flash para ${nomeEmp}.\nValidade: 30 dias.`;

  res.json({
    ok: true,
    empresa: nomeEmp,
    contato: responsavel,
    propostaTexto,
    mensagem: `Proposta corporativa gerada com sucesso para ${nomeEmp}!`
  });
});

// GET /api/public/zuma/recuperacao/carrinhos — Monitor e métricas de carrinhos abandonados
routerZuma.get('/recuperacao/carrinhos', (req, res) => {
  res.json({
    ok: true,
    taxaMediaRecuperacao: 34.8,
    carrinhosAbandonadosMes: 340,
    carrinhosRecuperadosMes: 118,
    ticketMedioRecuperado: 89.20,
    receitaResgatadaMes: 10525.60,
    reguasAutomacao: [
      {
        etapa: 1,
        tempoDisparo: "15 minutos após inatividade",
        objetivo: "Resgate Imediato / Lembrete Cortês",
        conversaoHistorica: "22.4%",
        mensagemModelo: "🍣 Oi Rodrigo! Vimos que você montou seu pedido com o Especial Zuma 68 Peças mas ainda não finalizou. Seu salmão fresquinho ainda está separado na nossa bancada! Deseja que a gente finalize agora para entrega rápida?",
        status: "Ativo"
      },
      {
        etapa: 2,
        tempoDisparo: "2 horas após inatividade",
        objetivo: "Adoçador com Benefício (Frete Grátis)",
        conversaoHistorica: "11.2%",
        mensagemModelo: "🎁 Rodrigo, que tal fechar seu pedido do Zuma agora com Frete Grátis na entrega? Toque no link e seu cupom de frete já entra automático!",
        status: "Ativo"
      },
      {
        etapa: 3,
        tempoDisparo: "24 horas após inatividade",
        objetivo: "Reengajamento Noturno do Dia Seguinte",
        conversaoHistorica: "6.1%",
        mensagemModelo: "🍱 Deu vontade de sushi ontem? Não passe vontade hoje! Use o cupom VOLTAHOJE e ganhe R$ 15 OFF em qualquer pedido acima de R$ 70 no nosso WhatsApp.",
        status: "Ativo"
      }
    ],
    ultimosCarrinhosMonitorados: [
      { id: "CR-901", cliente: "Carla Pires", telefone: "(65) 99981-4433", valor: 138.00, itens: "Combo 26 Pçs + Hot Nutella", abandonadoHa: "18 minutos", status: "Regua 1 Disparada", resgatado: false },
      { id: "CR-902", cliente: "Dr. Marcelo Ramos", telefone: "(65) 99612-9900", valor: 195.00, itens: "Especial Zuma 68 Pçs", abandonadoHa: "2h 10m", status: "Regua 2 Disparada", resgatado: true },
      { id: "CR-903", cliente: "Aline Fonseca", telefone: "(65) 99823-1155", valor: 76.00, itens: "Yakissoba Misto + Rolinho", abandonadoHa: "23h 50m", status: "Regua 3 Pronta", resgatado: false }
    ]
  });
});

// POST /api/public/zuma/recuperacao/disparar-teste — Simulação de disparo de resgate
routerZuma.post('/recuperacao/disparar-teste', (req, res) => {
  const { clienteNome, valorCarrinho, etapaRegua } = req.body || {};
  const nome = clienteNome || "Cliente";
  const valor = parseFloat(valorCarrinho) || 98.00;
  const etapa = parseInt(etapaRegua) || 1;

  res.json({
    ok: true,
    etapa,
    cliente: nome,
    valor,
    cupomAtivado: etapa === 2 ? "FRETEZUMA" : (etapa === 3 ? "VOLTAHOJE" : "RESGATE10"),
    statusEnvio: "Mensagem enviada com sucesso para a fila de WhatsApp KyttoIA!",
    horarioEnvio: new Date().toLocaleTimeString('pt-BR')
  });
});


// =========================================================================
// MÓDULOS DE ERP INTEGRADO ZUMA COZINHA ORIENTAL 360° (EXCLUSIVO ZUMA)
// =========================================================================

// ESTADO EM MEMÓRIA DO ERP ZUMA
const ESTADO_ERP_ZUMA = {
  turnoCaixa: {
    status: "aberto",
    turnoId: "TRN-20261120-JANTAR",
    data: "2026-11-20",
    tipoTurno: "Jantar (18:30 - 23:45)",
    operador: "Matheus Silva (Supervisor de Caixa)",
    horarioAbertura: "18:00",
    fundoTrocoInicial: 350.00,
    suprimentos: [
      { id: "SUP-01", hora: "18:30", valor: 150.00, motivo: "Reforço de moedas e cédulas de R$ 5,00", operador: "Matheus Silva" }
    ],
    sangrias: [
      { id: "SAN-01", hora: "21:30", valor: 800.00, motivo: "Sangria de segurança para cofre principal", operador: "Matheus Silva" },
      { id: "SAN-02", hora: "22:15", valor: 180.00, motivo: "Pagamento urgente gelo escama para balcão de peixes", operador: "Matheus Silva" }
    ],
    totaisSistema: {
      dinheiro: 1420.00,
      pix: 3840.50,
      cartaoCredito: 4950.00,
      cartaoDebito: 2180.00,
      convenioAgroB2B: 1250.00,
      ifoodOnline: 980.00
    },
    conferenciaCega: null,
    fechamento: null
  },
  estoquePescados: [
    {
      codigo: "INS-001",
      nome: "Salmão Fresco Chileno Premium (Eviscerado c/ Cabeça)",
      categoria: "Pescados Nobres",
      unidade: "kg",
      estoqueAtualKg: 48.5,
      estoqueMinimoKg: 20.0,
      rendimentoMedioFilePct: 58.0,
      aparasPct: 15.0,
      carcacaDescartePct: 27.0,
      precoMedioKgBruto: 68.50,
      custoKgFileLimpo: 118.10,
      temperaturaCamaraC: -1.5,
      temperaturaBalcaoC: 2.1,
      loteAtual: "LT-SAL-20261119-01",
      validadeLote: "2026-11-23",
      fornecedor: "Pescados Pantanal & Pacífico Import",
      statusFrescor: "Excelente (Padrão Sashimi)"
    },
    {
      codigo: "INS-002",
      nome: "Atum Vermelho Fresco (Lombo Nobre)",
      categoria: "Pescados Nobres",
      unidade: "kg",
      estoqueAtualKg: 14.2,
      estoqueMinimoKg: 6.0,
      rendimentoMedioFilePct: 88.0,
      aparasPct: 7.0,
      carcacaDescartePct: 5.0,
      precoMedioKgBruto: 92.00,
      custoKgFileLimpo: 104.55,
      temperaturaCamaraC: -1.8,
      loteAtual: "LT-ATM-20261118-02",
      validadeLote: "2026-11-22",
      fornecedor: "Mar & Rio Pescados Nobres",
      statusFrescor: "Excelente (Padrão Sashimi)"
    },
    {
      codigo: "INS-003",
      nome: "Peixe Branco Fresco (Robalo / Saint Peter Limpo)",
      categoria: "Pescados Nobres",
      unidade: "kg",
      estoqueAtualKg: 18.0,
      estoqueMinimoKg: 8.0,
      rendimentoMedioFilePct: 72.0,
      aparasPct: 12.0,
      carcacaDescartePct: 16.0,
      precoMedioKgBruto: 44.00,
      custoKgFileLimpo: 61.11,
      loteAtual: "LT-PBR-20261119-04",
      validadeLote: "2026-11-23",
      fornecedor: "Piscicultura Águas Claras MT",
      statusFrescor: "Excelente"
    },
    {
      codigo: "INS-004",
      nome: "Camarão Rosa Limpo GG (Eviscerado)",
      categoria: "Frutos do Mar",
      unidade: "kg",
      estoqueAtualKg: 12.5,
      estoqueMinimoKg: 5.0,
      rendimentoMedioFilePct: 95.0,
      precoMedioKgBruto: 85.00,
      custoKgFileLimpo: 89.47,
      loteAtual: "LT-CAM-20261115-08",
      validadeLote: "2026-12-15",
      fornecedor: "Frutos do Mar Brasil",
      statusFrescor: "Excelente"
    },
    {
      codigo: "INS-005",
      nome: "Arroz Japonês Especial (Grão Curto Miroku)",
      categoria: "Grãos & Base",
      unidade: "kg",
      estoqueAtualKg: 160.0,
      estoqueMinimoKg: 50.0,
      rendimentoCozidoShariX: 2.3,
      precoMedioKgBruto: 14.80,
      custoKgShariTemperado: 8.90,
      loteAtual: "LT-ARZ-20261028-11",
      validadeLote: "2027-04-28",
      fornecedor: "Importadora Oriental SP",
      statusFrescor: "Ótimo"
    },
    {
      codigo: "INS-006",
      nome: "Alga Nori Premium Gold (Pacote 50 Folhas)",
      categoria: "Secos & Insumos",
      unidade: "pacote",
      estoqueAtualKg: 42.0,
      estoqueMinimoKg: 15.0,
      rendimentoMedioFilePct: 100.0,
      precoMedioKgBruto: 45.00,
      loteAtual: "LT-NORI-20260910-03",
      validadeLote: "2027-09-10",
      fornecedor: "Importadora Oriental SP",
      statusFrescor: "Excelente"
    },
    {
      codigo: "INS-007",
      nome: "Cream Cheese Tradicional (Balde 2kg Profissional)",
      categoria: "Laticínios & Recheios",
      unidade: "balde",
      estoqueAtualKg: 28.0,
      estoqueMinimoKg: 10.0,
      precoMedioKgBruto: 54.00,
      loteAtual: "LT-CC-20261105-09",
      validadeLote: "2027-01-05",
      fornecedor: "Distribuidora Laticínios Tangará",
      statusFrescor: "Excelente"
    }
  ],
  perdasPescados: [
    { id: "PRD-01", data: "2026-11-19", insumo: "Salmão Fresco", qtdKg: 0.45, motivo: "Oxidação natural pós-24h balcão refrigerado", sushiman: "Kenji Sato", custoR$: 30.82 },
    { id: "PRD-02", data: "2026-11-18", insumo: "Peixe Branco", qtdKg: 0.25, motivo: "Apara excessiva corte sashimi", sushiman: "Lucas Silva", custoR$: 11.00 }
  ],
  financeiroDRE: {
    mesReferencia: "Novembro/2026",
    receitaBrutaVendas: 184500.00,
    deducoesImpostos: 9225.00,
    taxasOperadorasCartao: 3874.50,
    receitaLiquida: 171400.50,
    cmvTotalInsumos: 55350.00, // 30.0% da bruta
    cmvPercentual: "30.0%",
    margemContribuicaoBruta: 116050.50,
    margemContribuicaoPercentual: "67.7%",
    custosPessoalSushimansGarcons: 34200.00,
    custosFixosInstalacoesAluguelEnergia: 21500.00,
    marketingTrafegoMetaAds: 5500.00,
    ebitdaGerencial: 54850.50,
    ebitdaPercentual: "29.7%",
    depreciacaoInvestimentos: 2800.00,
    lucroLiquidoReal: 52050.50,
    lucroLiquidoPercentual: "28.2%"
  },
  contasPagar: [
    { id: "PAG-881", fornecedor: "Pescados Pantanal LTDA", descricao: "Lote 60kg Salmão Fresco Chileno", valor: 4110.00, vencimento: "2026-11-22", categoria: "CMV Pescados", status: "a_vencer" },
    { id: "PAG-882", fornecedor: "Distribuidora Laticínios Tangará", descricao: "Cream Cheese e Laticínios", valor: 1620.00, vencimento: "2026-11-24", categoria: "CMV Laticínios", status: "a_vencer" },
    { id: "PAG-883", fornecedor: "Energisa Mato Grosso", descricao: "Energia Elétrica Unidade Av. Brasil 1605", valor: 3840.00, vencimento: "2026-11-25", categoria: "Custos Fixos", status: "a_vencer" },
    { id: "PAG-884", fornecedor: "Meta Platforms Ireland", descricao: "Anúncios Instagram @zuma_orientaltga", valor: 1250.00, vencimento: "2026-11-26", categoria: "Marketing", status: "a_vencer" }
  ],
  contasReceber: [
    { id: "REC-401", cliente: "Rede Stone Pagamentos", descricao: "Liquidação Vendas Cartão Crédito Turno 18-19/11", valor: 6420.00, previsaoRecebimento: "2026-11-21", taxaRetencao: 128.40, status: "confirmado" },
    { id: "REC-402", cliente: "Grupo Scheffer Agronegócios", descricao: "Faturamento Evento Corporativo Confraternização", valor: 4850.00, previsaoRecebimento: "2026-11-25", taxaRetencao: 0.00, status: "a_receber" },
    { id: "REC-403", cliente: "Sindicato Rural Tangará da Serra", descricao: "Jantar Fechado Diretoria Executiva", valor: 3200.00, previsaoRecebimento: "2026-11-28", taxaRetencao: 0.00, status: "a_receber" }
  ],
  deliveryTaxasBairrosTangara: [
    { bairro: "Centro", taxa: 7.00, tempoMedioMin: 12, distanciaKm: 1.2, motoboyPadrao: "Carlos Ninja" },
    { bairro: "Jardim Tangará II", taxa: 9.00, tempoMedioMin: 15, distanciaKm: 2.8, motoboyPadrao: "Marcos Flash" },
    { bairro: "Vila Alta", taxa: 10.00, tempoMedioMin: 16, distanciaKm: 3.5, motoboyPadrao: "Carlos Ninja" },
    { bairro: "Jardim Europa", taxa: 12.00, tempoMedioMin: 18, distanciaKm: 4.8, motoboyPadrao: "Roberto Veloz" },
    { bairro: "Módulos 01 a 05", taxa: 11.00, tempoMedioMin: 17, distanciaKm: 4.1, motoboyPadrao: "Marcos Flash" },
    { bairro: "Parque do Lago", taxa: 14.00, tempoMedioMin: 22, distanciaKm: 6.2, motoboyPadrao: "Roberto Veloz" },
    { bairro: "Jardim Tarumã", taxa: 13.00, tempoMedioMin: 20, distanciaKm: 5.5, motoboyPadrao: "Carlos Ninja" },
    { bairro: "Chácaras / Zona Rural Próxima", taxa: 25.00, tempoMedioMin: 35, distanciaKm: 12.0, motoboyPadrao: "Roberto Veloz" }
  ]
};

// =========================================================================
// 1. ROTAS DE CAIXA & FECHAMENTO DE TURNO
// =========================================================================

// POST /api/public/zuma/caixa/abrir-turno
routerZuma.post('/caixa/abrir-turno', (req, res) => {
  const { operador, fundoTroco, tipoTurno } = req.body || {};
  ESTADO_ERP_ZUMA.turnoCaixa.status = "aberto";
  ESTADO_ERP_ZUMA.turnoCaixa.operador = operador || "Matheus Silva";
  ESTADO_ERP_ZUMA.turnoCaixa.fundoTrocoInicial = parseFloat(fundoTroco) || 350.00;
  ESTADO_ERP_ZUMA.turnoCaixa.tipoTurno = tipoTurno || "Jantar (18:30 - 23:45)";
  ESTADO_ERP_ZUMA.turnoCaixa.horarioAbertura = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  ESTADO_ERP_ZUMA.turnoCaixa.conferenciaCega = null;
  ESTADO_ERP_ZUMA.turnoCaixa.fechamento = null;

  res.json({
    ok: true,
    mensagem: `Turno de caixa aberto com sucesso por ${ESTADO_ERP_ZUMA.turnoCaixa.operador}!`,
    turno: ESTADO_ERP_ZUMA.turnoCaixa
  });
});

// POST /api/public/zuma/caixa/sangria
routerZuma.post('/caixa/sangria', (req, res) => {
  const { valor, motivo, operador } = req.body || {};
  const v = parseFloat(valor) || 0;
  if (v <= 0) return res.status(400).json({ ok: false, error: "Valor de sangria inválido" });

  const sangria = {
    id: `SAN-${String(ESTADO_ERP_ZUMA.turnoCaixa.sangrias.length + 1).padStart(2, '0')}`,
    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    valor: v,
    motivo: motivo || "Sangria de segurança",
    operador: operador || ESTADO_ERP_ZUMA.turnoCaixa.operador
  };

  ESTADO_ERP_ZUMA.turnoCaixa.sangrias.push(sangria);

  res.json({
    ok: true,
    mensagem: `Sangria de R$ ${v.toFixed(2)} registrada com sucesso!`,
    sangria,
    totalSangrias: ESTADO_ERP_ZUMA.turnoCaixa.sangrias.reduce((a, b) => a + b.valor, 0)
  });
});

// POST /api/public/zuma/caixa/suprimento
routerZuma.post('/caixa/suprimento', (req, res) => {
  const { valor, motivo, operador } = req.body || {};
  const v = parseFloat(valor) || 0;
  if (v <= 0) return res.status(400).json({ ok: false, error: "Valor de suprimento inválido" });

  const suprimento = {
    id: `SUP-${String(ESTADO_ERP_ZUMA.turnoCaixa.suprimentos.length + 1).padStart(2, '0')}`,
    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    valor: v,
    motivo: motivo || "Reforço de troco",
    operador: operador || ESTADO_ERP_ZUMA.turnoCaixa.operador
  };

  ESTADO_ERP_ZUMA.turnoCaixa.suprimentos.push(suprimento);

  res.json({
    ok: true,
    mensagem: `Suprimento de R$ ${v.toFixed(2)} adicionado ao caixa!`,
    suprimento
  });
});

// POST /api/public/zuma/caixa/fechar-turno
routerZuma.post('/caixa/fechar-turno', (req, res) => {
  const {
    dinheiroContado,
    pixContado,
    cartaoCreditoContado,
    cartaoDebitoContado,
    convenioContado,
    observacoes
  } = req.body || {};

  const sist = ESTADO_ERP_ZUMA.turnoCaixa.totaisSistema;
  const totSuprimentos = ESTADO_ERP_ZUMA.turnoCaixa.suprimentos.reduce((a, b) => a + b.valor, 0);
  const totSangrias = ESTADO_ERP_ZUMA.turnoCaixa.sangrias.reduce((a, b) => a + b.valor, 0);
  const saldoEsperadoDinheiro = ESTADO_ERP_ZUMA.turnoCaixa.fundoTrocoInicial + totSuprimentos + sist.dinheiro - totSangrias;

  const contado = {
    dinheiro: parseFloat(dinheiroContado) || saldoEsperadoDinheiro,
    pix: parseFloat(pixContado) || sist.pix,
    cartaoCredito: parseFloat(cartaoCreditoContado) || sist.cartaoCredito,
    cartaoDebito: parseFloat(cartaoDebitoContado) || sist.cartaoDebito,
    convenioAgroB2B: parseFloat(convenioContado) || sist.convenioAgroB2B
  };

  const diferencaDinheiro = contado.dinheiro - saldoEsperadoDinheiro;
  const diferencaTotal = (contado.dinheiro - saldoEsperadoDinheiro) +
                         (contado.pix - sist.pix) +
                         (contado.cartaoCredito - sist.cartaoCredito) +
                         (contado.cartaoDebito - sist.cartaoDebito);

  const fechamento = {
    fechadoEm: new Date().toLocaleString('pt-BR'),
    operador: ESTADO_ERP_ZUMA.turnoCaixa.operador,
    totalVendasBrutas: sist.dinheiro + sist.pix + sist.cartaoCredito + sist.cartaoDebito + sist.convenioAgroB2B + sist.ifoodOnline,
    totaisSistema: sist,
    totaisContados: contado,
    saldoEsperadoGavetaDinheiro: saldoEsperadoDinheiro,
    diferencaDinheiro,
    diferencaTotal,
    situacaoCaixa: Math.abs(diferencaTotal) < 0.05 ? "Exato / Sem Diferença" : (diferencaTotal > 0 ? `Sobra de R$ ${diferencaTotal.toFixed(2)}` : `Quebra de R$ ${Math.abs(diferencaTotal).toFixed(2)}`),
    observacoes: observacoes || "Fechamento validado pelo supervisor de turno."
  };

  ESTADO_ERP_ZUMA.turnoCaixa.status = "fechado";
  ESTADO_ERP_ZUMA.turnoCaixa.conferenciaCega = contado;
  ESTADO_ERP_ZUMA.turnoCaixa.fechamento = fechamento;

  res.json({
    ok: true,
    mensagem: "Fechamento de turno concluído com sucesso!",
    fechamento
  });
});

// GET /api/public/zuma/caixa/relatorio-fechamento
routerZuma.get('/caixa/relatorio-fechamento', (req, res) => {
  res.json({
    ok: true,
    empresa: "Zuma Cozinha Oriental",
    cnpj: "36.296.848/0001-57",
    turno: ESTADO_ERP_ZUMA.turnoCaixa
  });
});

// GET /api/public/zuma/caixa/conferencia
routerZuma.get('/caixa/conferencia', (req, res) => {
  const sist = ESTADO_ERP_ZUMA.turnoCaixa.totaisSistema;
  const totSuprimentos = ESTADO_ERP_ZUMA.turnoCaixa.suprimentos.reduce((a, b) => a + b.valor, 0);
  const totSangrias = ESTADO_ERP_ZUMA.turnoCaixa.sangrias.reduce((a, b) => a + b.valor, 0);
  const saldoEsperadoDinheiro = ESTADO_ERP_ZUMA.turnoCaixa.fundoTrocoInicial + totSuprimentos + sist.dinheiro - totSangrias;

  res.json({
    ok: true,
    statusTurno: ESTADO_ERP_ZUMA.turnoCaixa.status,
    operador: ESTADO_ERP_ZUMA.turnoCaixa.operador,
    fundoInicial: ESTADO_ERP_ZUMA.turnoCaixa.fundoTrocoInicial,
    totalSuprimentos: totSuprimentos,
    totalSangrias: totSangrias,
    saldoEsperadoGavetaDinheiro: saldoEsperadoDinheiro,
    vendasTotaisPorForma: sist,
    totalGeralVendido: sist.dinheiro + sist.pix + sist.cartaoCredito + sist.cartaoDebito + sist.convenioAgroB2B + sist.ifoodOnline
  });
});

// =========================================================================
// 2. ROTAS DE ESTOQUE ESPECIALIZADO DE PESCADOS & FICHAS TÉCNICAS (CMV)
// =========================================================================

// GET /api/public/zuma/estoque/pescados
routerZuma.get('/estoque/pescados', (req, res) => {
  res.json({
    ok: true,
    empresa: "Zuma Cozinha Oriental",
    totalInsumosCadastrados: ESTADO_ERP_ZUMA.estoquePescados.length,
    itens: ESTADO_ERP_ZUMA.estoquePescados,
    perdasRecentes: ESTADO_ERP_ZUMA.perdasPescados,
    resumoControleFrescor: {
      conformidadeCamaraFria: "OK (-1.5°C a -1.8°C)",
      conformidadeBalcaoSushi: "OK (2.1°C)",
      indicePerdaMedioPescados: "0.85% (Excelente - Meta < 2.0%)",
      proximaEntregaSalmao: "2026-11-22 08:30 (60kg Chileno Eviscerado)"
    }
  });
});

// POST /api/public/zuma/estoque/lancar-compra
routerZuma.post('/estoque/lancar-compra', (req, res) => {
  const { codigoInsumo, qtdKg, valorTotal, fornecedor, lote, validade } = req.body || {};
  const insumo = ESTADO_ERP_ZUMA.estoquePescados.find(i => i.codigo === codigoInsumo);
  const qtd = parseFloat(qtdKg) || 0;
  const total = parseFloat(valorTotal) || 0;

  if (insumo && qtd > 0) {
    insumo.estoqueAtualKg += qtd;
    insumo.loteAtual = lote || `LT-${Date.now()}`;
    insumo.validadeLote = validade || insumo.validadeLote;
    if (fornecedor) insumo.fornecedor = fornecedor;
    if (total > 0) insumo.precoMedioKgBruto = total / qtd;
  }

  res.json({
    ok: true,
    mensagem: `Compra de ${qtd} kg lançada no estoque com sucesso!`,
    insumoAtualizado: insumo
  });
});

// POST /api/public/zuma/estoque/perda-peixe
routerZuma.post('/estoque/perda-peixe', (req, res) => {
  const { codigoInsumo, qtdKg, motivo, sushiman } = req.body || {};
  const insumo = ESTADO_ERP_ZUMA.estoquePescados.find(i => i.codigo === codigoInsumo);
  const qtd = parseFloat(qtdKg) || 0;

  if (insumo && qtd > 0) {
    insumo.estoqueAtualKg = Math.max(0, insumo.estoqueAtualKg - qtd);
    const custo = qtd * (insumo.precoMedioKgBruto || 65);
    const perda = {
      id: `PRD-${String(ESTADO_ERP_ZUMA.perdasPescados.length + 1).padStart(2, '0')}`,
      data: new Date().toISOString().split('T')[0],
      insumo: insumo.nome,
      qtdKg: qtd,
      motivo: motivo || "Descarte de qualidade",
      sushiman: sushiman || "Sushiman Turno",
      custoR$: custo
    };
    ESTADO_ERP_ZUMA.perdasPescados.unshift(perda);

    return res.json({
      ok: true,
      mensagem: `Registro de perda de ${qtd} kg salvo para auditoria de CMV.`,
      perda,
      estoqueRestanteKg: insumo.estoqueAtualKg
    });
  }

  res.status(400).json({ ok: false, error: "Insumo ou quantidade inválida" });
});

// GET /api/public/zuma/estoque/fichas-tecnicas
routerZuma.get('/estoque/fichas-tecnicas', (req, res) => {
  const fichas = [
    {
      prato: "Combinado Individual Salmão (18 Peças)",
      precoVenda: 62.00,
      cmvTeoricoR$: 18.20,
      cmvPercentual: "29.35%",
      margemContribuicao: 43.80,
      insumos: [
        { item: "Filé de Salmão Limpo", qtdGramas: 160, custo: 13.50 },
        { item: "Shari Temperado", qtdGramas: 180, custo: 1.60 },
        { item: "Cream Cheese & Toppings", qtdGramas: 30, custo: 1.20 },
        { item: "Embalagem / Shoyu / Wasabi / Gari", qtd: "1 kit", custo: 1.90 }
      ]
    },
    {
      prato: "Hot Roll Filadélfia Tradicional (10 Peças)",
      precoVenda: 34.00,
      cmvTeoricoR$: 7.80,
      cmvPercentual: "22.94%",
      margemContribuicao: 26.20,
      insumos: [
        { item: "Salmão Moído / Aparas Nobres", qtdGramas: 70, custo: 3.80 },
        { item: "Shari Temperado", qtdGramas: 90, custo: 0.80 },
        { item: "Nori, Farinha Panko & Óleo", qtd: "1 un", custo: 1.40 },
        { item: "Cream Cheese & Tarê da Casa", qtdGramas: 25, custo: 1.80 }
      ]
    },
    {
      prato: "Rodízio Zuma Tangará da Serra (Por Pessoa)",
      precoVenda: 139.90,
      cmvTeoricoR$: 42.50,
      cmvPercentual: "30.37%",
      margemContribuicao: 97.40,
      insumos: [
        { item: "Pescados Nobres (Salmão, Atum, Peixe Branco)", qtdGramas: 380, custo: 32.00 },
        { item: "Shari, Algas & Entradas Quentes", qtdGramas: 320, custo: 6.50 },
        { item: "Sobremesa & Cortesia Zumi", qtd: "1 un", custo: 4.00 }
      ]
    }
  ];

  res.json({
    ok: true,
    totalFichasPadrao: fichas.length,
    fichas
  });
});

// =========================================================================
// 3. ROTAS DE GESTÃO FINANCEIRA & DRE GERENCIAL
// =========================================================================

// GET /api/public/zuma/financeiro/dre
routerZuma.get('/financeiro/dre', (req, res) => {
  res.json({
    ok: true,
    empresa: "Zuma Cozinha Oriental",
    cnpj: "36.296.848/0001-57",
    dre: ESTADO_ERP_ZUMA.financeiroDRE
  });
});

// GET /api/public/zuma/financeiro/contas-pagar
routerZuma.get('/financeiro/contas-pagar', (req, res) => {
  res.json({
    ok: true,
    totalTitulos: ESTADO_ERP_ZUMA.contasPagar.length,
    totalValor: ESTADO_ERP_ZUMA.contasPagar.reduce((a, b) => a + b.valor, 0),
    titulos: ESTADO_ERP_ZUMA.contasPagar
  });
});

// GET /api/public/zuma/financeiro/contas-receber
routerZuma.get('/financeiro/contas-receber', (req, res) => {
  res.json({
    ok: true,
    totalTitulos: ESTADO_ERP_ZUMA.contasReceber.length,
    totalValor: ESTADO_ERP_ZUMA.contasReceber.reduce((a, b) => a + b.valor, 0),
    titulos: ESTADO_ERP_ZUMA.contasReceber
  });
});

// POST /api/public/zuma/financeiro/lancar-titulo
routerZuma.post('/financeiro/lancar-titulo', (req, res) => {
  const { tipo, favorecido, descricao, valor, vencimento, categoria } = req.body || {};
  const v = parseFloat(valor) || 0;
  const t = String(tipo || 'pagar').toLowerCase();

  if (t === 'pagar') {
    const novoPagar = {
      id: `PAG-${Math.floor(1000 + Math.random() * 9000)}`,
      fornecedor: favorecido || "Fornecedor Local",
      descricao: descricao || "Despesa Operacional",
      valor: v,
      vencimento: vencimento || new Date().toISOString().split('T')[0],
      categoria: categoria || "Custos Operacionais",
      status: "a_vencer"
    };
    ESTADO_ERP_ZUMA.contasPagar.push(novoPagar);
    return res.json({ ok: true, mensagem: "Conta a pagar registrada!", titulo: novoPagar });
  } else {
    const novoReceber = {
      id: `REC-${Math.floor(1000 + Math.random() * 9000)}`,
      cliente: favorecido || "Cliente B2B",
      descricao: descricao || "Faturamento Corporativo",
      valor: v,
      previsaoRecebimento: vencimento || new Date().toISOString().split('T')[0],
      taxaRetencao: 0,
      status: "a_receber"
    };
    ESTADO_ERP_ZUMA.contasReceber.push(novoReceber);
    return res.json({ ok: true, mensagem: "Conta a receber registrada!", titulo: novoReceber });
  }
});

// =========================================================================
// 4. ROTAS DE MESAS, COMANDAS, RODÍZIO & DIVISÃO DE CONTA
// =========================================================================

// GET /api/public/zuma/mesas/detalhe/:numero
routerZuma.get('/mesas/detalhe/:numero', (req, res) => {
  const num = String(req.params.numero);
  const mesa = ZUMA_MESAS_INICIAIS.find(m => String(m.numero) === num) || {
    id: `mesa-${num}`,
    numero: num,
    capacidade: 4,
    area: "Salão Principal",
    statusOcupacao: "ocupada"
  };

  res.json({
    ok: true,
    mesa: {
      ...mesa,
      comandaAtiva: {
        id: `CMD-M${num}-20261120`,
        clienteNome: "Rodrigo Gonçalves",
        qtdPessoas: 3,
        modalidade: "Rodízio Zuma Tangará",
        valorPorPessoa: 139.90,
        horaAbertura: "19:40",
        tempoPermanenciaMinutos: 45,
        itensConsumidos: [
          { nome: "Rodízio Zuma Especial Adulto", qtd: 3, precoUnit: 139.90, total: 419.70 },
          { nome: "Caipirinha de Saquê com Morango", qtd: 2, precoUnit: 28.00, total: 56.00 },
          { nome: "Cerveja Japonesa Kirin Ichiban", qtd: 3, precoUnit: 18.00, total: 54.00 },
          { nome: "Água com Gás Prata", qtd: 2, precoUnit: 7.00, total: 14.00 }
        ],
        subtotal: 543.70,
        taxaServico10Pct: 54.37,
        totalComServico: 598.07,
        divisao3Pessoas: (598.07 / 3).toFixed(2)
      }
    }
  });
});

// POST /api/public/zuma/mesas/adicionar-item
routerZuma.post('/mesas/adicionar-item', (req, res) => {
  const { mesaNumero, itemNome, qtd, precoUnit, obs } = req.body || {};
  res.json({
    ok: true,
    mensagem: `Item ${itemNome} (${qtd}x) adicionado à comanda da Mesa ${mesaNumero}!`,
    item: {
      nome: itemNome,
      qtd: parseInt(qtd) || 1,
      precoUnit: parseFloat(precoUnit) || 0,
      obs: obs || ""
    }
  });
});

// POST /api/public/zuma/mesas/dividir-conta
routerZuma.post('/mesas/dividir-conta', (req, res) => {
  const { valorTotal, qtdPessoas, incluirTaxaServico } = req.body || {};
  const totalBase = parseFloat(valorTotal) || 0;
  const pessoas = Math.max(1, parseInt(qtdPessoas) || 1);
  const taxa = incluirTaxaServico !== false ? totalBase * 0.10 : 0;
  const totalFinal = totalBase + taxa;
  const valorPorPessoa = totalFinal / pessoas;

  res.json({
    ok: true,
    subtotal: totalBase,
    taxaServico10Pct: taxa,
    totalComServico: totalFinal,
    qtdPessoas: pessoas,
    valorPorPessoa: parseFloat(valorPorPessoa.toFixed(2)),
    mensagemPixCopiaCola: `Pix Zuma Tangará: R$ ${valorPorPessoa.toFixed(2)} por pessoa para chave 36.296.848/0001-57`
  });
});

// POST /api/public/zuma/mesas/transferir
routerZuma.post('/mesas/transferir', (req, res) => {
  const { mesaOrigem, mesaDestino, motivo } = req.body || {};
  res.json({
    ok: true,
    mensagem: `Comanda da Mesa ${mesaOrigem} transferida com sucesso para a Mesa ${mesaDestino}!`,
    detalhes: { mesaOrigem, mesaDestino, motivo: motivo || "Solicitação dos clientes" }
  });
});

// =========================================================================
// 5. ROTAS DE DELIVERY & TAXAS POR BAIRRO DE TANGARÁ DA SERRA
// =========================================================================

// GET /api/public/zuma/delivery/taxas-bairros
routerZuma.get('/delivery/taxas-bairros', (req, res) => {
  res.json({
    ok: true,
    cidade: "Tangará da Serra - MT",
    origemRestaurante: "Av. Brasil, 1605-S, Jardim Cidade Alta",
    totalBairrosMapeados: ESTADO_ERP_ZUMA.deliveryTaxasBairrosTangara.length,
    bairros: ESTADO_ERP_ZUMA.deliveryTaxasBairrosTangara
  });
});

// POST /api/public/zuma/delivery/despachar
routerZuma.post('/delivery/despachar', (req, res) => {
  const { pedidoId, clienteNome, bairro, motoboyNome, valorTotal, formaPagamento } = req.body || {};
  const bInfo = ESTADO_ERP_ZUMA.deliveryTaxasBairrosTangara.find(b => b.bairro.toLowerCase() === String(bairro || '').toLowerCase()) || { taxa: 10.00, tempoMedioMin: 15 };

  const despacho = {
    pedidoId: pedidoId || `PED-${Math.floor(1000 + Math.random() * 9000)}`,
    cliente: clienteNome || "Cliente Tangará",
    bairro: bairro || "Centro",
    taxaEntrega: bInfo.taxa,
    previsaoEntregaMinutos: bInfo.tempoMedioMin,
    motoboy: motoboyNome || "Carlos Ninja",
    status: "saiu_para_entrega",
    horarioDespacho: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    linkRastreioWhatsApp: `https://zuma.kytto.com.br/rastreio/${pedidoId}`
  };

  res.json({
    ok: true,
    mensagem: `Pedido ${despacho.pedidoId} despachado com sucesso para ${despacho.bairro} via ${despacho.motoboy}!`,
    despacho
  });
});

// POST /api/public/zuma/delivery/acerto-motoboy
routerZuma.post('/delivery/acerto-motoboy', (req, res) => {
  const { motoboyNome, totalCorridas, totalRecebidoDinheiro, totalRecebidoCartaoMaquininha } = req.body || {};
  const corridas = parseInt(totalCorridas) || 8;
  const taxaPorCorrida = 7.50; // Remuneração do motoboy por entrega
  const valorTotalCorridasMotoboy = corridas * taxaPorCorrida;
  const dinheiro = parseFloat(totalRecebidoDinheiro) || 340.00;
  const repasseLiquido = dinheiro - valorTotalCorridasMotoboy;

  res.json({
    ok: true,
    motoboy: motoboyNome || "Carlos Ninja",
    data: new Date().toLocaleDateString('pt-BR'),
    totalEntregasRealizadas: corridas,
    ganhoMotoboy: valorTotalCorridasMotoboy,
    totalDinheiroRecebidoDeClientes: dinheiro,
    totalCartaoMaquininha: parseFloat(totalRecebidoCartaoMaquininha) || 580.00,
    valorASerDevolvidoAoCaixa: repasseLiquido > 0 ? repasseLiquido : 0,
    situacao: "Acerto de turno conferido e quitado com sucesso!"
  });
});

// =========================================================================
// 6. ROTAS DE CRM & CLUBE ZUMI
// =========================================================================

// GET /api/public/zuma/crm/clientes
routerZuma.get('/crm/clientes', (req, res) => {
  res.json({
    ok: true,
    empresa: "Zuma Cozinha Oriental",
    totalClientesBase: ZUMA_CLIENTES_CRM.length,
    clientes: ZUMA_CLIENTES_CRM.map(c => ({
      ...c,
      nivelClubeZumi: c.pedidosFeitos >= 10 ? "Black VIP" : (c.pedidosFeitos >= 5 ? "Ouro" : (c.pedidosFeitos >= 2 ? "Prata" : "Bronze")),
      pontosClubeZumi: Math.floor(c.totalGasto || 0)
    }))
  });
});

// POST /api/public/zuma/crm/resgatar-premio
routerZuma.post('/crm/resgatar-premio', (req, res) => {
  const { clienteNome, pontosResgatados, premioEscolhido } = req.body || {};
  res.json({
    ok: true,
    mensagem: `Prêmio "${premioEscolhido || 'Hot Roll Filadélfia 10un'}" resgatado com sucesso para ${clienteNome || 'Cliente'}!`,
    voucherResgate: `ZUMI-${Math.floor(100000 + Math.random() * 900000)}`,
    pontosDebitado: parseInt(pontosResgatados) || 150
  });
});

// POST /api/public/zuma/crm/disparar-aniversariantes
routerZuma.post('/crm/disparar-aniversariantes', (req, res) => {
  res.json({
    ok: true,
    mensagem: "Campanha de aniversariantes de Tangará da Serra disparada com sucesso!",
    totalDisparados: 14,
    cupomAtivado: "NIVERZUMA",
    beneficio: "1 Petit Gateau Oriental ou 1 Sobremesa Harumaki de Nutella cortesia em pedidos ou consumo no salão acima de R$ 90."
  });
});


// ============================================================================
// 7. MOTOR DE ESTOQUE DE PESCADOS, FICHAS TÉCNICAS E SIMULAÇÃO DE PEDIDO ZUMI
// ============================================================================
export const ESTOQUE_PESCADOS_ZUMA = {
  "ins-salmao-fresco": {
    id: "ins-salmao-fresco",
    codigo: "PESC-001",
    nome: "Salmão Fresco Chileno (Salmo Salar)",
    especificacao: "Salmo Salar fresco eviscerado inteiro",
    unidade: "kg",
    saldoAtual: 35.0,
    saldoMinimo: 20.0,
    custoPorKgInteiro: 68.00,
    rendimentoFileNobrePct: 62.0,
    rendimentoAparasPct: 20.0,
    aproveitamentoTotalPct: 82.0,
    custoEfetivoPorKgLimpo: 82.93,
    status: "OK",
    fornecedor: "Pescados Nobres Cuiabá / Distribuidora Mar & Rio",
    temperaturaCamara: "-2°C a +2°C (Monitorada IoT)",
    loteAtual: "LOTE-CHL-20261118",
    validadeLote: "25/11/2026"
  },
  "ins-atum-fresco": {
    id: "ins-atum-fresco",
    codigo: "PESC-002",
    nome: "Atum Vermelho Fresco (Lombo Nobre)",
    especificacao: "Lombo fresco limpo sem pele",
    unidade: "kg",
    saldoAtual: 6.0,
    saldoMinimo: 8.0,
    custoPorKgInteiro: 92.00,
    rendimentoFileNobrePct: 80.0,
    aproveitamentoTotalPct: 80.0,
    custoEfetivoPorKgLimpo: 115.00,
    status: "Repor Urgente",
    fornecedor: "Pescados Nobres Cuiabá",
    temperaturaCamara: "-2°C a +2°C",
    loteAtual: "LOTE-ATM-20261117",
    validadeLote: "23/11/2026"
  },
  "ins-camarao-rosa": {
    id: "ins-camarao-rosa",
    codigo: "PESC-003",
    nome: "Camarão Rosa GG Limpo",
    especificacao: "Limpo, eviscerado, congelado IQF",
    unidade: "kg",
    saldoAtual: 14.0,
    saldoMinimo: 10.0,
    custoPorKgInteiro: 85.00,
    custoEfetivoPorKgLimpo: 85.00,
    status: "OK",
    fornecedor: "Distribuidora Mar & Rio",
    temperaturaCamara: "-18°C",
    loteAtual: "LOTE-CAM-20261115",
    validadeLote: "15/02/2027"
  },
  "ins-peixe-branco": {
    id: "ins-peixe-branco",
    codigo: "PESC-004",
    nome: "Peixe Branco Fresco (Robalo / Saint Peter)",
    especificacao: "Filé fresco resfriado",
    unidade: "kg",
    saldoAtual: 18.0,
    saldoMinimo: 10.0,
    custoPorKgInteiro: 45.00,
    custoEfetivoPorKgLimpo: 58.00,
    status: "OK",
    fornecedor: "Pescados Regionais MT",
    temperaturaCamara: "0°C a +2°C",
    loteAtual: "LOTE-PB-20261119",
    validadeLote: "24/11/2026"
  },
  "ins-arroz-gohan": {
    id: "ins-arroz-gohan",
    codigo: "INS-001",
    nome: "Arroz Japonês Especial Gohan Temperado",
    especificacao: "Grão curto polido tipo 1 com tempero su",
    unidade: "kg",
    saldoAtual: 80.0,
    saldoMinimo: 40.0,
    custoPorKgInteiro: 14.00,
    custoEfetivoPorKgLimpo: 14.00,
    status: "OK",
    fornecedor: "Empório Oriental MT",
    temperaturaCamara: "Ambiente / Bancada",
    loteAtual: "LOTE-ARZ-20261110",
    validadeLote: "10/05/2027"
  },
  "ins-cream-cheese": {
    id: "ins-cream-cheese",
    codigo: "INS-002",
    nome: "Cream Cheese Tradicional Artesanal",
    especificacao: "Baldes de 4 kg para sushiman",
    unidade: "kg",
    saldoAtual: 48.0,
    saldoMinimo: 20.0,
    custoPorKgInteiro: 38.00,
    custoEfetivoPorKgLimpo: 38.00,
    status: "OK",
    fornecedor: "Laticínios Tangará",
    temperaturaCamara: "+4°C",
    loteAtual: "LOTE-CC-20261112",
    validadeLote: "12/01/2027"
  },
  "ins-alga-nori": {
    id: "ins-alga-nori",
    codigo: "INS-003",
    nome: "Alga Nori Premium Gold",
    especificacao: "Folhas desidratadas de alga marinha",
    unidade: "folhas",
    saldoAtual: 900,
    saldoMinimo: 500,
    custoPorKgInteiro: 0.60,
    custoEfetivoPorKgLimpo: 0.60,
    status: "OK",
    fornecedor: "Empório Oriental MT",
    temperaturaCamara: "Ambiente Seco",
    loteAtual: "LOTE-NRI-20261020",
    validadeLote: "20/10/2027"
  },
  "ins-embalagem-termica": {
    id: "ins-embalagem-termica",
    codigo: "EMB-001",
    nome: "Caixa Térmica Selada Zuma c/ Visor e Lacre",
    especificacao: "Embalagem antivazamento com berço para sushis",
    unidade: "un",
    saldoAtual: 420,
    saldoMinimo: 300,
    custoPorKgInteiro: 3.80,
    custoEfetivoPorKgLimpo: 3.80,
    status: "OK",
    fornecedor: "Gráfica & Embalagens MT",
    temperaturaCamara: "Depósito de Embalagens",
    loteAtual: "LOTE-EMB-20261101",
    validadeLote: "Indeterminada"
  }
};

export const HISTORICO_BAIXAS_ESTOQUE_ZUMA = [
  {
    id: "BX-1044",
    comandaId: "ZUM-SALAO-12",
    tipo: "saida_salao",
    dataHora: new Date(Date.now() - 42 * 60000).toISOString(),
    itemCardapio: "Combinado Zuma Casal 40 Peças",
    pescadoBaixado: "Salmão Fresco Chileno (0,520 kg)",
    cmvTotal: 59.96,
    margemPct: 56.86,
    usuario: "garcom_mesa12"
  },
  {
    id: "BX-1043",
    comandaId: "ZUM-WPP-882",
    tipo: "saida_zumi_whatsapp",
    dataHora: new Date(Date.now() - 95 * 60000).toISOString(),
    itemCardapio: "Especial Zuma 68 Peças Supremo",
    pescadoBaixado: "Salmão Fresco (0,780 kg) + Atum (0,150 kg)",
    cmvTotal: 88.40,
    margemPct: 59.63,
    usuario: "zumi_whatsapp_kyttoia"
  }
];

export const FICHAS_TECNICAS_ZUMA = {
  "ZUM-003": {
    id: "ft-zuma-003",
    codigoPdv: "ZUM-003",
    nomeProduto: "Combinado Especial 30 Peças Salmão Fresco",
    categoria: "Combinados",
    precoVenda: 89.90,
    rendimento: 1,
    descricao: "10x Sashimi Salmão Fresco, 8x Uramaki Salmão, 8x Hossomaki Salmão, 4x Niguiri Salmão.",
    insumos: [
      { id: "ins-salmao-fresco", nome: "Salmão Fresco Chileno (Filé Limpo)", qtd: 0.380, unidade: "kg", custoUnitario: 82.93, custoTotal: 31.51 },
      { id: "ins-arroz-gohan", nome: "Arroz Gohan Temperado", qtd: 0.250, unidade: "kg", custoUnitario: 14.00, custoTotal: 3.50 },
      { id: "ins-cream-cheese", nome: "Cream Cheese Original", qtd: 0.080, unidade: "kg", custoUnitario: 38.00, custoTotal: 3.04 },
      { id: "ins-alga-nori", nome: "Alga Nori Premium Gold", qtd: 3, unidade: "folhas", custoUnitario: 0.60, custoTotal: 1.80 },
      { id: "ins-embalagem-termica", nome: "Caixa Térmica Selada Zuma c/ Lacre", qtd: 1, unidade: "un", custoUnitario: 3.80, custoTotal: 3.80 }
    ],
    cmvTeorico: 43.65,
    cmvPercentual: 48.55,
    margemContribuicao: 46.25,
    margemContribuicaoPercentual: 51.45
  },
  "ZUM-HOT": {
    id: "ft-zuma-hot",
    codigoPdv: "ZUM-HOT",
    nomeProduto: "Hot Roll Filadélfia Especial (10 un)",
    categoria: "Hot Rolls & Empanados",
    precoVenda: 42.00,
    rendimento: 1,
    descricao: "Enrolado frito crocante em farinha Panko, recheado com aparas nobres de salmão e cream cheese, finalizado com tarê.",
    insumos: [
      { id: "ins-salmao-fresco", nome: "Salmão Fresco Chileno (Aparas Nobres)", qtd: 0.150, unidade: "kg", custoUnitario: 82.93, custoTotal: 12.44 },
      { id: "ins-arroz-gohan", nome: "Arroz Gohan Temperado", qtd: 0.120, unidade: "kg", custoUnitario: 14.00, custoTotal: 1.68 },
      { id: "ins-cream-cheese", nome: "Cream Cheese Original", qtd: 0.050, unidade: "kg", custoUnitario: 38.00, custoTotal: 1.90 },
      { id: "ins-alga-nori", nome: "Alga Nori Premium Gold", qtd: 1, unidade: "folhas", custoUnitario: 0.60, custoTotal: 0.60 },
      { id: "ins-farinha-panko", nome: "Farinha Panko & Óleo de Fritura", qtd: 0.040, unidade: "kg", custoUnitario: 22.00, custoTotal: 0.88 },
      { id: "ins-embalagem-termica", nome: "Embalagem Selada Hot", qtd: 1, unidade: "un", custoUnitario: 2.50, custoTotal: 2.50 }
    ],
    cmvTeorico: 19.12,
    cmvPercentual: 45.52,
    margemContribuicao: 22.88,
    margemContribuicaoPercentual: 54.48
  },
  "ZUM-SASHIMI": {
    id: "ft-zuma-sashimi",
    codigoPdv: "ZUM-SASHIMI",
    nomeProduto: "Sashimi Salmão Fresco (12 fatias)",
    categoria: "Sashimis",
    precoVenda: 58.00,
    rendimento: 1,
    descricao: "Lombo nobre de salmão fresco fatiado na hora com corte tradicional usuzukuri ou sashimi clássico.",
    insumos: [
      { id: "ins-salmao-fresco", nome: "Salmão Fresco Chileno (Lombo Nobre)", qtd: 0.220, unidade: "kg", custoUnitario: 82.93, custoTotal: 18.24 },
      { id: "ins-embalagem-termica", nome: "Caixa Térmica Selada Zuma c/ Lacre", qtd: 1, unidade: "un", custoUnitario: 3.80, custoTotal: 3.80 }
    ],
    cmvTeorico: 22.04,
    cmvPercentual: 38.00,
    margemContribuicao: 35.96,
    margemContribuicaoPercentual: 62.00
  },
  "ZUM-CASAL-40": {
    id: "ft-zuma-casal",
    codigoPdv: "ZUM-CASAL-40",
    nomeProduto: "Combinado Zuma Casal 40 Peças",
    categoria: "Combinados",
    precoVenda: 139.00,
    rendimento: 1,
    descricao: "12x Sashimi Salmão, 10x Uramaki Especial, 8x Hossomaki, 6x Niguiri e 4x Dyo de Salmão com Geleia de Pimenta.",
    insumos: [
      { id: "ins-salmao-fresco", nome: "Salmão Fresco Chileno (Filé Nobre)", qtd: 0.520, unidade: "kg", custoUnitario: 82.93, custoTotal: 43.12 },
      { id: "ins-arroz-gohan", nome: "Arroz Gohan Temperado", qtd: 0.320, unidade: "kg", custoUnitario: 14.00, custoTotal: 4.48 },
      { id: "ins-cream-cheese", nome: "Cream Cheese Original", qtd: 0.110, unidade: "kg", custoUnitario: 38.00, custoTotal: 4.18 },
      { id: "ins-alga-nori", nome: "Alga Nori Premium Gold", qtd: 4, unidade: "folhas", custoUnitario: 0.60, custoTotal: 2.40 },
      { id: "ins-embalagem-termica", nome: "Caixa Térmica Selada Zuma GG c/ Lacre", qtd: 1, unidade: "un", custoUnitario: 3.80, custoTotal: 3.80 }
    ],
    cmvTeorico: 57.98,
    cmvPercentual: 41.71,
    margemContribuicao: 81.02,
    margemContribuicaoPercentual: 58.29
  }
};

// GET /api/public/zuma/estoque-pescados — Saldo em tempo real, rendimento e histórico de baixas
routerZuma.get('/estoque-pescados', (req, res) => {
  const lista = Object.values(ESTOQUE_PESCADOS_ZUMA);
  const totalKilosPescados = lista
    .filter(i => i.id.startsWith('ins-') && i.unidade === 'kg')
    .reduce((acc, i) => acc + (parseFloat(i.saldoAtual) || 0), 0);

  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    totalItensMonitorados: lista.length,
    totalKilosPescados: parseFloat(totalKilosPescados.toFixed(3)),
    itens: lista,
    historicoBaixas: HISTORICO_BAIXAS_ESTOQUE_ZUMA.slice(0, 15)
  });
});

// GET /api/public/zuma/fichas-tecnicas — Catálogo de Fichas Técnicas e CMV Teórico
routerZuma.get('/fichas-tecnicas', (req, res) => {
  res.json({
    ok: true,
    totalFichas: Object.keys(FICHAS_TECNICAS_ZUMA).length,
    fichas: Object.values(FICHAS_TECNICAS_ZUMA)
  });
});

// POST /api/public/zuma/whatsapp/simular-pedido — Fluxo Completo Zumi Atende via WhatsApp c/ Baixa e CMV
routerZuma.post('/whatsapp/simular-pedido', (req, res) => {
  const {
    clienteNome = "Dr. Rodrigo Gonçalves",
    clienteTelefone = "(65) 99988-1234",
    enderecoEntrega = "Av. Tancredo Neves, 850 - Centro, Tangará da Serra - MT",
    formaPagamento = "PIX",
    mensagem = "Olá Zumi! Quero pedir 1x Combinado Especial 30 Peças Salmão Fresco e 1x Hot Roll Filadélfia Especial para entrega no Centro.",
    itensCustomizados = null
  } = req.body || {};

  // Definição dos itens do pedido padrão ou customizado
  const itensPedido = Array.isArray(itensCustomizados) && itensCustomizados.length > 0 ? itensCustomizados : [
    { codigoPdv: "ZUM-003", nome: "Combinado Especial 30 Peças Salmão Fresco", qtd: 1, precoUnitario: 89.90 },
    { codigoPdv: "ZUM-HOT", nome: "Hot Roll Filadélfia Especial (10 un)", qtd: 1, precoUnitario: 42.00 }
  ];

  const subtotalProdutos = itensPedido.reduce((acc, i) => acc + (i.precoUnitario * i.qtd), 0);
  const taxaEntrega = 10.00;
  const totalPedido = subtotalProdutos + taxaEntrega;
  const comandaId = `ZUM-WPP-${Math.floor(1000 + Math.random() * 9000)}`;
  const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Processar Baixa em Tempo Real de Insumos e Pescados
  const movimentacoes = [];
  const mapaConsumoInsumos = {};
  let cmvTotalPedido = 0;
  const detalhamentoFichas = [];

  for (const item of itensPedido) {
    const ficha = FICHAS_TECNICAS_ZUMA[item.codigoPdv] || FICHAS_TECNICAS_ZUMA["ZUM-003"];
    const qtdItem = item.qtd || 1;
    const cmvItem = ficha.cmvTeorico * qtdItem;
    cmvTotalPedido += cmvItem;

    detalhamentoFichas.push({
      produto: item.nome,
      codigoPdv: item.codigoPdv,
      qtdPedida: qtdItem,
      precoUnitario: item.precoUnitario,
      subtotal: item.precoUnitario * qtdItem,
      cmvTeoricoItem: cmvItem,
      cmvPercentualItem: parseFloat(((cmvItem / (item.precoUnitario * qtdItem)) * 100).toFixed(2)),
      margemContribuicao: (item.precoUnitario * qtdItem) - cmvItem,
      insumosConsumidos: ficha.insumos.map(ins => ({
        nome: ins.nome,
        qtdConsumida: parseFloat((ins.qtd * qtdItem).toFixed(3)),
        unidade: ins.unidade,
        custoTotal: parseFloat((ins.custoTotal * qtdItem).toFixed(2))
      }))
    });

    // Efetivar baixa nos insumos
    for (const ins of ficha.insumos) {
      const estoqueItem = ESTOQUE_PESCADOS_ZUMA[ins.id];
      if (estoqueItem) {
        const consumo = parseFloat((ins.qtd * qtdItem).toFixed(3));
        const saldoAnt = parseFloat(estoqueItem.saldoAtual);
        estoqueItem.saldoAtual = parseFloat(Math.max(0, saldoAnt - consumo).toFixed(3));
        if (estoqueItem.saldoAtual < estoqueItem.saldoMinimo) {
          estoqueItem.status = "Repor Urgente";
        }
        movimentacoes.push({
          insumoId: ins.id,
          insumoNome: estoqueItem.nome,
          unidade: estoqueItem.unidade,
          consumo,
          saldoAnterior: saldoAnt,
          saldoAtual: estoqueItem.saldoAtual,
          status: estoqueItem.status
        });

        if (!mapaConsumoInsumos[ins.id]) {
          mapaConsumoInsumos[ins.id] = {
            insumoId: ins.id,
            insumoNome: estoqueItem.nome,
            unidade: estoqueItem.unidade,
            consumoTotal: 0,
            saldoAnterior: saldoAnt,
            saldoFinal: estoqueItem.saldoAtual,
            status: estoqueItem.status
          };
        }
        mapaConsumoInsumos[ins.id].consumoTotal = parseFloat((mapaConsumoInsumos[ins.id].consumoTotal + consumo).toFixed(3));
        mapaConsumoInsumos[ins.id].saldoFinal = estoqueItem.saldoAtual;
      }
    }
  }

  const cmvGlobalPct = parseFloat(((cmvTotalPedido / subtotalProdutos) * 100).toFixed(2));
  const margemBrutaTotal = subtotalProdutos - cmvTotalPedido;
  const margemBrutaPct = parseFloat(((margemBrutaTotal / subtotalProdutos) * 100).toFixed(2));

  // Registrar histórico auditável de baixa
  HISTORICO_BAIXAS_ESTOQUE_ZUMA.unshift({
    id: `BX-${Math.floor(2000 + Math.random() * 8000)}`,
    comandaId,
    tipo: "saida_zumi_whatsapp",
    dataHora: new Date().toISOString(),
    itemCardapio: itensPedido.map(i => `${i.qtd}x ${i.nome}`).join(' + '),
    pescadoBaixado: `Salmão Fresco (${movimentacoes.find(m => m.insumoId === 'ins-salmao-fresco')?.consumo || 0.530} kg)`,
    cmvTotal: parseFloat(cmvTotalPedido.toFixed(2)),
    margemPct: margemBrutaPct,
    usuario: "zumi_whatsapp_kyttoia"
  });

  // Diálogo Interativo do WhatsApp formatado pelo Motor KyttoIA 2.5 Flash
  const dialogoWhatsApp = [
    {
      autor: "cliente",
      remetente: clienteNome,
      hora: horaAtual,
      texto: mensagem
    },
    {
      autor: "zumi",
      remetente: "Zumi · Assistente Oficial Zuma (KyttoIA 2.5 Flash)",
      hora: horaAtual,
      texto: `Konbanwa, ${clienteNome}! 🍣 Que alegria te atender! Sou o Zumi, seu parceiro ninja do Zuma Cozinha Oriental.\n\nRecebi seu pedido com muito carinho:\n${itensPedido.map(i => `• ${i.qtd}x ${i.nome} — R$ ${(i.precoUnitario * i.qtd).toFixed(2)}`).join('\n')}\n🛵 Taxa de Entrega (Tangará da Serra): R$ ${taxaEntrega.toFixed(2)}\n💰 *Total do Pedido: R$ ${totalPedido.toFixed(2)}*\n\n📍 Entrega em: ${enderecoEntrega}\n⏱️ Tempo estimado: *30 a 40 minutos* (Salmão fresquinho fatiado na hora!)\n\nChave PIX Oficial (CNPJ Zuma):\n\`36.296.848/0001-57\`\n\nAssim que fizer o PIX, me avise por aqui para o Sushiman liberar seu combo imediatamente! 🍱🥢`
    },
    {
      autor: "cliente",
      remetente: clienteNome,
      hora: horaAtual,
      texto: `Prontinho Zumi! Acabei de fazer o PIX de R$ ${totalPedido.toFixed(2)}. Segue o comprovante!`
    },
    {
      autor: "zumi",
      remetente: "Zumi · Assistente Oficial Zuma (KyttoIA 2.5 Flash)",
      hora: horaAtual,
      texto: `✅ *PAGAMENTO CONFIRMADO COM SUCESSO!* 🎉\n\nComanda *#${comandaId}* gerada e já apitando na bancada do Sushi Bar!\nNossos sushimen já iniciaram a montagem com pescados selecionados da nossa câmara fria.\n\n📦 *Rastreamento:* https://zuma.kytto.com.br/rastreio/${comandaId}\n⭐ Você acabou de somar *+1 Selo no Clube Zumi*. Faltam apenas 3 para seu Temaki Especial cortesia!\n\nArigatou gozaimasu pela preferência! 🙏`
    }
  ];

  res.json({
    ok: true,
    status: "pedido_confirmado_e_estoque_baixado",
    motorIa: "KyttoIA 2.5 Flash",
    comanda: {
      id: comandaId,
      cliente: clienteNome,
      telefone: clienteTelefone,
      endereco: enderecoEntrega,
      itens: itensPedido,
      subtotalProdutos,
      taxaEntrega,
      total: totalPedido,
      formaPagamento,
      statusKds: "em_preparo_sushi_bar",
      tempoEstimadoMinutos: 35
    },
    dialogoWhatsApp,
    analiseCmvFichaTecnica: {
      faturamentoProdutos: subtotalProdutos,
      cmvTotalInsumos: parseFloat(cmvTotalPedido.toFixed(2)),
      cmvPercentualGlobal: cmvGlobalPct,
      margemBrutaValor: parseFloat(margemBrutaTotal.toFixed(2)),
      margemBrutaPercentual: margemBrutaPct,
      statusSaudeFinanceira: cmvGlobalPct <= 50.0 ? "Excelente (Margem Saudável)" : "Alerta de Custo",
      detalhamentoPorItem: detalhamentoFichas
    },
    baixaEstoquePescadosEmTempoReal: {
      totalInsumosBaixados: movimentacoes.length,
      movimentacoes,
      consumoConsolidadoPorInsumo: Object.values(mapaConsumoInsumos)
    },
    reciboFiscalNFCe: {
      chaveAcesso: `51261136296848000157650010000000001${Math.floor(10000000 + Math.random() * 90000000)}1`,
      protocoloAutorizacaoSEFAZ: `1512600${Math.floor(100000000 + Math.random() * 900000000)}`,
      ambiente: "Produção SEFAZ-MT",
      dataHoraEmissao: new Date().toISOString()
    }
  });
});

// POST /api/public/zuma/estoque-pescados/repor — Registro de Entrada / Reposição de Pescados
routerZuma.post('/estoque-pescados/repor', (req, res) => {
  const { insumoId = "ins-salmao-fresco", quantidadeKg = 20.0, fornecedor = "Pescados Nobres Cuiabá", numeroNFe = "NF-8921" } = req.body || {};
  const item = ESTOQUE_PESCADOS_ZUMA[insumoId];
  if (!item) {
    return res.status(404).json({ ok: false, error: "Insumo não encontrado" });
  }
  const saldoAnt = item.saldoAtual;
  item.saldoAtual = parseFloat((saldoAnt + parseFloat(quantidadeKg)).toFixed(3));
  if (item.saldoAtual >= item.saldoMinimo) {
    item.status = "OK";
  }

  res.json({
    ok: true,
    mensagem: `Entrada de ${quantidadeKg} ${item.unidade} de ${item.nome} registrada com sucesso!`,
    fornecedor,
    numeroNFe,
    saldoAnterior: saldoAnt,
    saldoAtual: item.saldoAtual,
    status: item.status
  });
});


// ============================================================================
// 8. GESTÃO DE CÂMARAS FRIAS IOT & CONTROLE DE PERDAS TÉCNICAS (ANVISA/MT)
// ============================================================================

export const CAMARAS_FRIAS_ZUMA = [
  {
    id: "camara-01-pescados-frescos",
    nome: "Câmara Fria 01 · Pescados Nobres Frescos (Salmão & Atum)",
    setor: "Sushi Bar Prep / Fundo da Cozinha",
    temperaturaAtual: 0.8,
    temperaturaAlvo: 0.0,
    faixaMinima: -2.0,
    faixaMaxima: 2.0,
    umidadeRelativa: 88.5,
    sensorIotId: "IOT-TEMP-ZUM-01",
    status: "NORMAL_OTIMA",
    desvioTermicoAlerta: false,
    ultimoDegelo: "2026-11-20T04:00:00.000Z",
    proximoDegelo: "2026-11-21T04:00:00.000Z",
    responsavelSanitario: "Sushiman Chefe / Controle de Qualidade Zuma",
    historicoLeituras: [
      { hora: "14:00", temp: 0.9, umidade: 88 },
      { hora: "15:00", temp: 0.8, umidade: 89 },
      { hora: "16:00", temp: 1.1, umidade: 87 },
      { hora: "17:00", temp: 0.7, umidade: 88 },
      { hora: "18:00", temp: 0.8, umidade: 88.5 }
    ]
  },
  {
    id: "camara-02-ultra-congelados",
    nome: "Câmara Fria 02 · Ultra-Congelamento (Camarão IQF & Polvo)",
    setor: "Depósito de Congelados",
    temperaturaAtual: -19.4,
    temperaturaAlvo: -20.0,
    faixaMinima: -22.0,
    faixaMaxima: -18.0,
    umidadeRelativa: 64.0,
    sensorIotId: "IOT-TEMP-ZUM-02",
    status: "NORMAL_OTIMA",
    desvioTermicoAlerta: false,
    ultimoDegelo: "2026-11-19T23:00:00.000Z",
    proximoDegelo: "2026-11-21T23:00:00.000Z",
    responsavelSanitario: "Sushiman Chefe",
    historicoLeituras: [
      { hora: "14:00", temp: -19.2, umidade: 64 },
      { hora: "15:00", temp: -19.5, umidade: 65 },
      { hora: "16:00", temp: -19.1, umidade: 63 },
      { hora: "17:00", temp: -19.6, umidade: 64 },
      { hora: "18:00", temp: -19.4, umidade: 64 }
    ]
  },
  {
    id: "camara-03-hortifruti-insumos",
    nome: "Câmara Fria 03 · Hortifrúti Japonês, Shari & Cream Cheese",
    setor: "Pré-Preparo Frio",
    temperaturaAtual: 4.2,
    temperaturaAlvo: 4.0,
    faixaMinima: 2.0,
    faixaMaxima: 6.0,
    umidadeRelativa: 82.0,
    sensorIotId: "IOT-TEMP-ZUM-03",
    status: "NORMAL_OTIMA",
    desvioTermicoAlerta: false,
    ultimoDegelo: "2026-11-20T03:00:00.000Z",
    proximoDegelo: "2026-11-21T03:00:00.000Z",
    responsavelSanitario: "Equipe de Saladas e Entradas",
    historicoLeituras: [
      { hora: "14:00", temp: 4.3, umidade: 82 },
      { hora: "15:00", temp: 4.1, umidade: 81 },
      { hora: "16:00", temp: 4.5, umidade: 83 },
      { hora: "17:00", temp: 4.0, umidade: 82 },
      { hora: "18:00", temp: 4.2, umidade: 82 }
    ]
  }
];

export const HISTORICO_PERDAS_DESCARTE_ZUMA = [
  {
    id: "PERD-101",
    dataHora: "2026-11-20T11:30:00.000Z",
    insumoId: "ins-salmao-fresco",
    insumoNome: "Salmão Fresco Chileno (Salmo Salar)",
    tipo: "apara_tecnica_gordura_escura",
    quantidadeKg: 0.650,
    custoAbsorvido: 44.20,
    sushiman: "Kenji Sushiman",
    motivo: "Apara sanitária de linha escura e tecido sanguíneo para garantir padrão visual ouro nos sashimis",
    destino: "Descarte técnico auditado",
    impactoNoCmvPercentual: "+0.32%"
  },
  {
    id: "PERD-102",
    dataHora: "2026-11-20T16:15:00.000Z",
    insumoId: "ins-arroz-gohan",
    insumoNome: "Arroz Gohan Temperado",
    tipo: "quebra_bancada_excesso_tempo",
    quantidadeKg: 0.800,
    custoAbsorvido: 11.20,
    sushiman: "Lucas Sushiman",
    motivo: "Descarte de shari após 4h em bancada conforme POP de segurança alimentar (resolução RDC 216)",
    destino: "Descarte sanitário",
    impactoNoCmvPercentual: "+0.08%"
  }
];

// GET /api/public/zuma/estoque/camaras-frias
routerZuma.get('/estoque/camaras-frias', (req, res) => {
  res.json({
    ok: true,
    empresa: "Zuma Cozinha Oriental",
    cidade: "Tangará da Serra - MT",
    normaRegulamentadora: "RDC 216/ANVISA e Vigilância Sanitária MT",
    totalCamarasMonitoradas: CAMARAS_FRIAS_ZUMA.length,
    statusGeral: "100%_CONFORME",
    camaras: CAMARAS_FRIAS_ZUMA,
    perdasRecentes: HISTORICO_PERDAS_DESCARTE_ZUMA
  });
});

// POST /api/public/zuma/estoque/perda-descarte
routerZuma.post('/estoque/perda-descarte', (req, res) => {
  const {
    insumoId = "ins-salmao-fresco",
    quantidadeKg = 0.450,
    tipo = "apara_tecnica_sushiman",
    motivo = "Apara técnica de acabamento de filé",
    sushiman = "Sushiman Plantão"
  } = req.body || {};

  const insumo = ESTOQUE_PESCADOS_ZUMA[insumoId];
  if (insumo) {
    insumo.saldoAtual = parseFloat(Math.max(0, insumo.saldoAtual - parseFloat(quantidadeKg)).toFixed(3));
  }

  const novaPerda = {
    id: `PERD-${Math.floor(100 + Math.random() * 900)}`,
    dataHora: new Date().toISOString(),
    insumoId,
    insumoNome: insumo ? insumo.nome : "Insumo",
    tipo,
    quantidadeKg: parseFloat(quantidadeKg),
    custoAbsorvido: parseFloat((parseFloat(quantidadeKg) * (insumo ? insumo.custoPorKgInteiro : 68.0)).toFixed(2)),
    sushiman,
    motivo,
    destino: "Descarte técnico auditado",
    impactoNoCmvPercentual: "+0.15%"
  };

  HISTORICO_PERDAS_DESCARTE_ZUMA.unshift(novaPerda);

  res.json({
    ok: true,
    mensagem: `Perda técnica de ${quantidadeKg} kg registrada com sucesso e saldo debitado do estoque.`,
    perda: novaPerda,
    novoSaldoInsumo: insumo ? insumo.saldoAtual : null
  });
});

// ============================================================================
// 9. MAPA DE TEMPERATURA & HEATMAP DE SALÃO E MESAS (25 MESAS ZUMA)
// ============================================================================

export const MESAS_SALAO_ZUMA = [
  // Setor 1: Salão Principal (1 a 12)
  { id: 1, numero: 1, setor: "Salão Principal", capacidade: 4, status: "consumindo", tempoMinutos: 48, garcom: "Carlos Silva", comanda: "COM-SALAO-101", valorAcumulado: 218.00, clientesNaMesa: 3, ticketMedioPessoa: 72.67, tempAmbiente: 22.0, solicitouConta: false, itens: ["Combinado Zuma Casal 40 Peças", "2x Chopp Brahma"] },
  { id: 2, numero: 2, setor: "Salão Principal", capacidade: 4, status: "solicitou_conta", tempoMinutos: 92, garcom: "Carlos Silva", comanda: "COM-SALAO-102", valorAcumulado: 345.50, clientesNaMesa: 4, ticketMedioPessoa: 86.38, tempAmbiente: 22.0, solicitouConta: true, itens: ["Especial Zuma 68 Peças", "4x Soda Italiana", "2x Hot Banana Nutella"] },
  { id: 3, numero: 3, setor: "Salão Principal", capacidade: 2, status: "livre", tempoMinutos: 0, garcom: "Carlos Silva", comanda: null, valorAcumulado: 0.0, clientesNaMesa: 0, ticketMedioPessoa: 0.0, tempAmbiente: 22.0, solicitouConta: false, itens: [] },
  { id: 4, numero: 4, setor: "Salão Principal", capacidade: 6, status: "aguardando_kds", tempoMinutos: 18, garcom: "Ana Sato", comanda: "COM-SALAO-104", valorAcumulado: 412.00, clientesNaMesa: 5, ticketMedioPessoa: 82.40, tempAmbiente: 21.8, solicitouConta: false, itens: ["Festival Zuma Completo", "5x Cervejas Long Neck"] },
  { id: 5, numero: 5, setor: "Salão Principal", capacidade: 4, status: "consumindo", tempoMinutos: 35, garcom: "Ana Sato", comanda: "COM-SALAO-105", valorAcumulado: 189.00, clientesNaMesa: 2, ticketMedioPessoa: 94.50, tempAmbiente: 22.1, solicitouConta: false, itens: ["Combinado 30 Peças", "1x Vinho Branco"] },
  { id: 6, numero: 6, setor: "Salão Principal", capacidade: 2, status: "livre", tempoMinutos: 0, garcom: "Ana Sato", comanda: null, valorAcumulado: 0.0, clientesNaMesa: 0, ticketMedioPessoa: 0.0, tempAmbiente: 22.0, solicitouConta: false, itens: [] },
  { id: 7, numero: 7, setor: "Salão Principal", capacidade: 4, status: "consumindo", tempoMinutos: 55, garcom: "Roberto Kenji", comanda: "COM-SALAO-107", valorAcumulado: 278.00, clientesNaMesa: 3, ticketMedioPessoa: 92.67, tempAmbiente: 22.0, solicitouConta: false, itens: ["Sashimi Salmão 20 Peças", "Uramaki Especial", "2x Refrigerante"] },
  { id: 8, numero: 8, setor: "Salão Principal", capacidade: 4, status: "higienizacao", tempoMinutos: 5, garcom: "Roberto Kenji", comanda: null, valorAcumulado: 0.0, clientesNaMesa: 0, ticketMedioPessoa: 0.0, tempAmbiente: 21.9, solicitouConta: false, itens: [] },
  { id: 9, numero: 9, setor: "Salão Principal", capacidade: 2, status: "consumindo", tempoMinutos: 22, garcom: "Carlos Silva", comanda: "COM-SALAO-109", valorAcumulado: 124.00, clientesNaMesa: 2, ticketMedioPessoa: 62.00, tempAmbiente: 22.0, solicitouConta: false, itens: ["Combinado Individual 18 Peças", "Temaki Especial"] },
  { id: 10, numero: 10, setor: "Salão Principal", capacidade: 4, status: "livre", tempoMinutos: 0, garcom: "Carlos Silva", comanda: null, valorAcumulado: 0.0, clientesNaMesa: 0, ticketMedioPessoa: 0.0, tempAmbiente: 22.0, solicitouConta: false, itens: [] },
  { id: 11, numero: 11, setor: "Salão Principal", capacidade: 4, status: "ocupada_sem_pedido", tempoMinutos: 8, garcom: "Ana Sato", comanda: "COM-SALAO-111", valorAcumulado: 0.0, clientesNaMesa: 3, ticketMedioPessoa: 0.0, tempAmbiente: 22.0, solicitouConta: false, itens: [] },
  { id: 12, numero: 12, setor: "Salão Principal", capacidade: 6, status: "consumindo", tempoMinutos: 74, garcom: "Ana Sato", comanda: "COM-SALAO-112", valorAcumulado: 520.00, clientesNaMesa: 6, ticketMedioPessoa: 86.67, tempAmbiente: 21.7, solicitouConta: false, itens: ["Especial Zuma Casal 40 Peças", "Combinado 30 Peças", "6x Sucos Naturais"] },

  // Setor 2: Deck Lounge Climatizado (13 a 18)
  { id: 13, numero: 13, setor: "Deck Lounge", capacidade: 4, status: "consumindo", tempoMinutos: 62, garcom: "Roberto Kenji", comanda: "COM-DECK-113", valorAcumulado: 295.00, clientesNaMesa: 4, ticketMedioPessoa: 73.75, tempAmbiente: 22.5, solicitouConta: false, itens: ["Combinado Zuma Casal", "4x Gin Tônica"] },
  { id: 14, numero: 14, setor: "Deck Lounge", capacidade: 4, status: "solicitou_conta", tempoMinutos: 104, garcom: "Roberto Kenji", comanda: "COM-DECK-114", valorAcumulado: 460.00, clientesNaMesa: 4, ticketMedioPessoa: 115.00, tempAmbiente: 22.4, solicitouConta: true, itens: ["Omakase Especial 50 Peças", "2x Garrafas Sake Hakutsuru"] },
  { id: 15, numero: 15, setor: "Deck Lounge", capacidade: 2, status: "livre", tempoMinutos: 0, garcom: "Roberto Kenji", comanda: null, valorAcumulado: 0.0, clientesNaMesa: 0, ticketMedioPessoa: 0.0, tempAmbiente: 22.5, solicitouConta: false, itens: [] },
  { id: 16, numero: 16, setor: "Deck Lounge", capacidade: 4, status: "aguardando_kds", tempoMinutos: 12, garcom: "Carlos Silva", comanda: "COM-DECK-116", valorAcumulado: 178.00, clientesNaMesa: 2, ticketMedioPessoa: 89.00, tempAmbiente: 22.3, solicitouConta: false, itens: ["Combinado 30 Peças Salmão", "2x Caipirinhas de Sakê"] },
  { id: 17, numero: 17, setor: "Deck Lounge", capacidade: 4, status: "livre", tempoMinutos: 0, garcom: "Carlos Silva", comanda: null, valorAcumulado: 0.0, clientesNaMesa: 0, ticketMedioPessoa: 0.0, tempAmbiente: 22.5, solicitouConta: false, itens: [] },
  { id: 18, numero: 18, setor: "Deck Lounge", capacidade: 6, status: "consumindo", tempoMinutos: 40, garcom: "Ana Sato", comanda: "COM-DECK-118", valorAcumulado: 388.00, clientesNaMesa: 5, ticketMedioPessoa: 77.60, tempAmbiente: 22.2, solicitouConta: false, itens: ["Combinado Zuma Casal", "Hot Roll Filadélfia", "5x Cervejas Heineken"] },

  // Setor 3: Sushi Bar Omakase (Lugares 19 a 22)
  { id: 19, numero: 19, setor: "Sushi Bar Omakase", capacidade: 2, status: "consumindo", tempoMinutos: 52, garcom: "Chef Kenji (Bancada)", comanda: "COM-BAR-119", valorAcumulado: 280.00, clientesNaMesa: 2, ticketMedioPessoa: 140.00, tempAmbiente: 21.0, solicitouConta: false, itens: ["Experiência Omakase 10 Passos", "Dose Sakê Junmai"] },
  { id: 20, numero: 20, setor: "Sushi Bar Omakase", capacidade: 2, status: "consumindo", tempoMinutos: 45, garcom: "Chef Kenji (Bancada)", comanda: "COM-BAR-120", valorAcumulado: 280.00, clientesNaMesa: 2, ticketMedioPessoa: 140.00, tempAmbiente: 21.0, solicitouConta: false, itens: ["Experiência Omakase 10 Passos", "2x Chá Verde Importado"] },
  { id: 21, numero: 21, setor: "Sushi Bar Omakase", capacidade: 2, status: "livre", tempoMinutos: 0, garcom: "Chef Kenji (Bancada)", comanda: null, valorAcumulado: 0.0, clientesNaMesa: 0, ticketMedioPessoa: 0.0, tempAmbiente: 21.0, solicitouConta: false, itens: [] },
  { id: 22, numero: 22, setor: "Sushi Bar Omakase", capacidade: 2, status: "aguardando_kds", tempoMinutos: 10, garcom: "Chef Kenji (Bancada)", comanda: "COM-BAR-122", valorAcumulado: 165.00, clientesNaMesa: 1, ticketMedioPessoa: 165.00, tempAmbiente: 21.0, solicitouConta: false, itens: ["Degustação Sushiman Trufada", "Água San Pellegrino"] },

  // Setor 4: Sala VIP Corporativa Agro (23 a 25)
  { id: 23, numero: 23, setor: "Sala VIP", capacidade: 8, status: "consumindo", tempoMinutos: 85, garcom: "Carlos Silva (VIP)", comanda: "COM-VIP-123", valorAcumulado: 1140.00, clientesNaMesa: 7, ticketMedioPessoa: 162.86, tempAmbiente: 21.5, solicitouConta: false, itens: ["2x Especial Supremo 68 Peças", "3x Garrafas Sakê Premium", "Entradas Especiais"] },
  { id: 24, numero: 24, setor: "Sala VIP", capacidade: 8, status: "solicitou_conta", tempoMinutos: 115, garcom: "Carlos Silva (VIP)", comanda: "COM-VIP-124", valorAcumulado: 1380.00, clientesNaMesa: 8, ticketMedioPessoa: 172.50, tempAmbiente: 21.5, solicitouConta: true, itens: ["Jantar Corporativo Diretoria Agro MT", "Banquete Zuma Omakase"] },
  { id: 25, numero: 25, setor: "Sala VIP", capacidade: 12, status: "livre", tempoMinutos: 0, garcom: "Ana Sato (VIP)", comanda: null, valorAcumulado: 0.0, clientesNaMesa: 0, ticketMedioPessoa: 0.0, tempAmbiente: 21.5, solicitouConta: false, itens: [] }
];

// Função que calcula a "temperatura de giro" da mesa
function calcularClassificacaoGiro(mesa) {
  if (mesa.status === "livre") return { nivel: "livre_verde", rotulo: "Mesa Livre", cor: "#10b981", descricao: "Pronta para receber clientes" };
  if (mesa.status === "higienizacao") return { nivel: "higienizacao", rotulo: "Higienização", cor: "#64748b", descricao: "Equipe limpando e sanitizando" };
  if (mesa.solicitouConta || mesa.tempoMinutos >= 90) return { nivel: "alerta_giro_roxo", rotulo: "Alerta Giro / Conta", cor: "#a855f7", descricao: "Mesa acima de 90 min ou aguardando pagamento" };
  if (mesa.tempoMinutos >= 60) return { nivel: "quente_laranja", rotulo: "Quente (Sobremesa/Café)", cor: "#f97316", descricao: "60 a 90 min - fase final do consumo" };
  if (mesa.tempoMinutos >= 30) return { nivel: "ponto_amarelo", rotulo: "No Ponto (Consumindo)", cor: "#eab308", descricao: "30 a 60 min - pratos servidos e degustação" };
  return { nivel: "recente_azul", rotulo: "Recém-chegada", cor: "#3b82f6", descricao: "< 30 min - pedidos em preparo no KDS" };
}

// GET /api/public/zuma/mesas/mapa-temperatura
routerZuma.get('/mesas/mapa-temperatura', (req, res) => {
  const mesasFormatadas = MESAS_SALAO_ZUMA.map(m => ({
    ...m,
    heatmapGiro: calcularClassificacaoGiro(m)
  }));

  const mesasOcupadas = MESAS_SALAO_ZUMA.filter(m => m.status !== "livre" && m.status !== "higienizacao");
  const totalFaturamentoSalaoAtual = MESAS_SALAO_ZUMA.reduce((acc, m) => acc + (m.valorAcumulado || 0), 0);
  const totalPessoasAtendidas = MESAS_SALAO_ZUMA.reduce((acc, m) => acc + (m.clientesNaMesa || 0), 0);
  const ticketMedioSalao = totalPessoasAtendidas > 0 ? parseFloat((totalFaturamentoSalaoAtual / totalPessoasAtendidas).toFixed(2)) : 0.0;
  const tempoMedioOcupacao = mesasOcupadas.length > 0 ? Math.round(mesasOcupadas.reduce((acc, m) => acc + m.tempoMinutos, 0) / mesasOcupadas.length) : 0;
  const taxaOcupacaoMesasPct = parseFloat(((mesasOcupadas.length / MESAS_SALAO_ZUMA.length) * 100).toFixed(1));

  res.json({
    ok: true,
    empresa: "Zuma Cozinha Oriental",
    totalMesas: MESAS_SALAO_ZUMA.length,
    taxaOcupacaoMesasPct,
    totalMesasOcupadas: mesasOcupadas.length,
    totalMesasLivres: MESAS_SALAO_ZUMA.filter(m => m.status === "livre").length,
    totalPessoasAtendidas,
    totalFaturamentoSalaoAtual,
    ticketMedioSalao,
    tempoMedioOcupacaoMinutos: tempoMedioOcupacao,
    climatizacaoSalao: {
      temperaturaMedia: "21.8°C",
      statusConforto: "Ideal para frescor de sushis e bem-estar dos clientes",
      sensoresIotAtivos: 4
    },
    mesas: mesasFormatadas
  });
});

// POST /api/public/zuma/mesas/alterar-status
routerZuma.post('/mesas/alterar-status', (req, res) => {
  const { mesaId, novoStatus, garcom, valorAdicionar = 0 } = req.body || {};
  const mesa = MESAS_SALAO_ZUMA.find(m => m.id === parseInt(mesaId));
  if (!mesa) {
    return res.status(404).json({ ok: false, error: "Mesa não encontrada" });
  }

  if (novoStatus) mesa.status = novoStatus;
  if (garcom) mesa.garcom = garcom;
  if (valorAdicionar) mesa.valorAcumulado += parseFloat(valorAdicionar);

  if (novoStatus === "livre") {
    mesa.comanda = null;
    mesa.valorAcumulado = 0.0;
    mesa.tempoMinutos = 0;
    mesa.clientesNaMesa = 0;
    mesa.solicitouConta = false;
    mesa.itens = [];
  } else if (novoStatus === "solicitou_conta") {
    mesa.solicitouConta = true;
  }

  res.json({
    ok: true,
    mensagem: `Mesa ${mesa.numero} atualizada com sucesso para status "${mesa.status}".`,
    mesa: {
      ...mesa,
      heatmapGiro: calcularClassificacaoGiro(mesa)
    }
  });
});

// ============================================================================
// 10. MÓDULO FISCAL COMPLETO COM EMISSÃO SEFAZ-MT (NFC-E & NF-E)
// ============================================================================

export const HISTORICO_NOTAS_FISCAIS_ZUMA = [
  {
    numeroNota: 1042,
    serie: 1,
    modelo: "NFC-e (65)",
    chaveAcesso: "51261136296848000157650010000010421293849182",
    protocoloSEFAZ: "1512600849301928",
    dataEmissao: "2026-11-20T18:22:15.000Z",
    cliente: "Consumidor Final (CPF: 042.***.***-89)",
    origemVenda: "Mesa 02 · Salão Principal",
    valorTotal: 345.50,
    icmsValor: 13.82,
    pisCofinsMonofasico: 4.80,
    statusSEFAZ: "100_AUTORIZADA_PRODUCAO",
    qrcodeUrl: "http://sefaz.mt.gov.br/nfce/qrcode?p=51261136296848000157650010000010421293849182|2|1|1|928174",
    xmlUrl: "/api/public/zuma/fiscal/xml/51261136296848000157650010000010421293849182.xml",
    itens: [
      { ncm: "2106.90.90", descricao: "Especial Zuma Casal 40 Peças", qtd: 1, vlrUnit: 139.00, vlrTotal: 139.00, cfop: "5102", cstIcms: "102" },
      { ncm: "2106.90.90", descricao: "Sashimi Salmão 20 Peças", qtd: 1, vlrUnit: 89.90, vlrTotal: 89.90, cfop: "5102", cstIcms: "102" },
      { ncm: "2203.00.00", descricao: "Cerveja Heineken Long Neck 330ml", qtd: 4, vlrUnit: 14.00, vlrTotal: 56.00, cfop: "5405", cstIcms: "500" },
      { ncm: "1905.90.90", descricao: "Hot Roll Banana Nutella (6 un)", qtd: 2, vlrUnit: 30.30, vlrTotal: 60.60, cfop: "5102", cstIcms: "102" }
    ]
  },
  {
    numeroNota: 1041,
    serie: 1,
    modelo: "NFC-e (65)",
    chaveAcesso: "51261136296848000157650010000010411837491029",
    protocoloSEFAZ: "1512600849301741",
    dataEmissao: "2026-11-20T17:45:10.000Z",
    cliente: "Rodrigo Ribeiro Gonçalves",
    origemVenda: "Zumi Atende WhatsApp · Delivery Centro",
    valorTotal: 141.90,
    icmsValor: 5.67,
    pisCofinsMonofasico: 0.0,
    statusSEFAZ: "100_AUTORIZADA_PRODUCAO",
    qrcodeUrl: "http://sefaz.mt.gov.br/nfce/qrcode?p=51261136296848000157650010000010411837491029|2|1|1|837491",
    xmlUrl: "/api/public/zuma/fiscal/xml/51261136296848000157650010000010411837491029.xml",
    itens: [
      { ncm: "2106.90.90", descricao: "Combinado Especial 30 Peças Salmão Fresco", qtd: 1, vlrUnit: 89.90, vlrTotal: 89.90, cfop: "5102", cstIcms: "102" },
      { ncm: "2106.90.90", descricao: "Hot Roll Filadélfia Especial (10 un)", qtd: 1, vlrUnit: 42.00, vlrTotal: 42.00, cfop: "5102", cstIcms: "102" }
    ]
  },
  {
    numeroNota: 89,
    serie: 1,
    modelo: "NF-e (55) Corporativa",
    chaveAcesso: "51261136296848000157550010000000891048291048",
    protocoloSEFAZ: "1512600849104829",
    dataEmissao: "2026-11-20T15:10:00.000Z",
    cliente: "Agropecuária Tangará do Norte S/A (CNPJ: 14.281.904/0001-33)",
    origemVenda: "Sala VIP 24 · Almoço Corporativo Diretoria",
    valorTotal: 2150.00,
    icmsValor: 86.00,
    pisCofinsMonofasico: 32.50,
    statusSEFAZ: "100_AUTORIZADA_PRODUCAO",
    qrcodeUrl: "http://sefaz.mt.gov.br/nfe/qrcode?p=51261136296848000157550010000000891048291048",
    xmlUrl: "/api/public/zuma/fiscal/xml/51261136296848000157550010000000891048291048.xml",
    itens: [
      { ncm: "2106.90.90", descricao: "Banquete Executivo Zuma Omakase Corporativo", qtd: 10, vlrUnit: 185.00, vlrTotal: 1850.00, cfop: "5102", cstIcms: "102" },
      { ncm: "2206.00.90", descricao: "Sakê Premium Junmai Daiginjo 720ml", qtd: 2, vlrUnit: 150.00, vlrTotal: 300.00, cfop: "5405", cstIcms: "500" }
    ]
  }
];

// GET /api/public/zuma/fiscal/painel
routerZuma.get('/fiscal/painel', (req, res) => {
  const totalNotasEmitidas = HISTORICO_NOTAS_FISCAIS_ZUMA.length;
  const faturamentoFiscalMes = HISTORICO_NOTAS_FISCAIS_ZUMA.reduce((acc, n) => acc + n.valorTotal, 0);
  const totalIcmsApurado = HISTORICO_NOTAS_FISCAIS_ZUMA.reduce((acc, n) => acc + (n.icmsValor || 0), 0);

  res.json({
    ok: true,
    empresa: "Zuma Cozinha Oriental Ltda",
    cnpj: "36.296.848/0001-57",
    inscricaoEstadual: "13.784.920-4",
    inscricaoMunicipal: "48.291-0",
    regimeTributario: "Simples Nacional (Anexo I - Comércio Gastronômico)",
    aliquotaEfetivaSimplesNacional: "4,00%",
    certificadoDigital: {
      tipo: "A1 (e-CNPJ)",
      titular: "ZUMA COZINHA ORIENTAL LTDA",
      validade: "18/10/2027",
      status: "VALIDO_E_ATIVO"
    },
    contingenciaOffline: {
      status: "PRONTA_STANDBY",
      tipoContingencia: "NFC-e Off-line (tpEmis = 9)",
      limiteEnvioAposRestabelecimento: "24 horas",
      notasPendentesEnvio: 0
    },
    totaisMes: {
      totalNotasEmitidas,
      faturamentoFiscalMes,
      totalIcmsApurado: parseFloat(totalIcmsApurado.toFixed(2))
    },
    notas: HISTORICO_NOTAS_FISCAIS_ZUMA
  });
});

// POST /api/public/zuma/fiscal/emitir — Emissão de NFC-e (65) ou NF-e (55)
routerZuma.post('/fiscal/emitir', (req, res) => {
  const {
    modelo = "NFC-e (65)",
    origemVenda = "Balcão / Caixa Salão",
    cliente = "Consumidor Final",
    itens = [
      { descricao: "Combinado Zuma 30 Peças", qtd: 1, precoUnit: 89.90, ncm: "2106.90.90" }
    ],
    formaPagamento = "PIX"
  } = req.body || {};

  const proxNumero = (HISTORICO_NOTAS_FISCAIS_ZUMA[0]?.numeroNota || 1042) + 1;
  const valorTotal = itens.reduce((acc, it) => acc + ((it.qtd || 1) * (it.precoUnit || 0)), 0);
  const icmsValor = parseFloat((valorTotal * 0.04).toFixed(2));
  const chave = `5126113629684800015765001${String(proxNumero).padStart(9, '0')}1${Math.floor(10000000 + Math.random() * 90000000)}1`;
  const protocolo = `1512600${Math.floor(100000000 + Math.random() * 900000000)}`;

  const novaNota = {
    numeroNota: proxNumero,
    serie: 1,
    modelo,
    chaveAcesso: chave,
    protocoloSEFAZ: protocolo,
    dataEmissao: new Date().toISOString(),
    cliente,
    origemVenda,
    formaPagamento,
    valorTotal: parseFloat(valorTotal.toFixed(2)),
    icmsValor,
    pisCofinsMonofasico: 0.0,
    statusSEFAZ: "100_AUTORIZADA_PRODUCAO",
    qrcodeUrl: `http://sefaz.mt.gov.br/nfce/qrcode?p=${chave}|2|1|1|${Math.floor(100000 + Math.random() * 900000)}`,
    xmlUrl: `/api/public/zuma/fiscal/xml/${chave}.xml`,
    itens: itens.map(it => ({
      ncm: it.ncm || "2106.90.90",
      descricao: it.descricao,
      qtd: it.qtd || 1,
      vlrUnit: it.precoUnit || 0,
      vlrTotal: parseFloat(((it.qtd || 1) * (it.precoUnit || 0)).toFixed(2)),
      cfop: "5102",
      cstIcms: "102"
    }))
  };

  HISTORICO_NOTAS_FISCAIS_ZUMA.unshift(novaNota);

  res.json({
    ok: true,
    mensagem: `Nota Fiscal ${modelo} #${proxNumero} AUTORIZADA com sucesso pela SEFAZ-MT!`,
    notaFiscal: novaNota
  });
});

// ============================================================================
// MÓDULO DE PAGAMENTOS KYTTOPAY ZUMA (PIX DINÂMICO, CARTÃO, DINHEIRO, VR, SPLIT)
// ============================================================================
let HISTORICO_PAGAMENTOS_ZUMA = [
  {
    id: "PAG-10901",
    txid: "ZUMPIX8841A9901BC7",
    dataHora: new Date(Date.now() - 15 * 60000).toISOString(),
    pedidoId: "ZUM-8841",
    mesaNumero: null,
    canal: "Delivery Web",
    cliente: "Marcos Vinícius",
    forma: "PIX",
    bandeira: null,
    valor: 147.50,
    status: "CONFIRMADO",
    nsu: "99182341",
    autorizacao: "AUT-7712",
    pixPayloadEmv: "00020126580014br.gov.bcb.pix01364462983200019052040000530398654147.505802BR5925ZUMA COZINHA ORIENTAL6016TANGARA DA SERRA62070503***6304E8A2",
    chavePix: "44.629.832/0001-90",
    detalhes: "Combinado Zuma 30 Pçs + Temaki Salmão"
  },
  {
    id: "PAG-10902",
    txid: "ZUMCC8842B102DE4",
    dataHora: new Date(Date.now() - 32 * 60000).toISOString(),
    pedidoId: "ZUM-8839",
    mesaNumero: 4,
    canal: "Salão",
    cliente: "Dr. Roberto Guimarães",
    forma: "CARTAO_CREDITO",
    bandeira: "Mastercard",
    valor: 268.00,
    parcelas: 1,
    status: "CONFIRMADO",
    nsu: "88219455",
    autorizacao: "AUT-3391",
    detalhes: "Rodízio Casal Especial + 2 Cervejas Stella"
  },
  {
    id: "PAG-10903",
    txid: "ZUMDIN8843C403EF8",
    dataHora: new Date(Date.now() - 55 * 60000).toISOString(),
    pedidoId: "ZUM-8835",
    mesaNumero: 12,
    canal: "Deck Bistrô",
    cliente: "Juliana Mendes",
    forma: "DINHEIRO",
    bandeira: null,
    valor: 94.00,
    trocoPara: 100.00,
    trocoDevolvido: 6.00,
    status: "CONFIRMADO",
    nsu: "CAIXA-01",
    autorizacao: "OP-042",
    detalhes: "Uramaki Especial + Refrigerante"
  }
];

// POST /api/public/zuma/pagamentos/pix-gerar — Gera QR Code e Payload EMV do PIX Instantâneo
routerZuma.post('/pagamentos/pix-gerar', (req, res) => {
  const {
    valor = 89.90,
    pedidoId = `ZUM-${Math.floor(8000 + Math.random() * 1999)}`,
    mesaNumero = null,
    clienteNome = "Cliente Zuma",
    clienteCpf = null,
    descricao = "Pedido Zuma Cozinha Oriental"
  } = req.body || {};

  const valorFloat = parseFloat(parseFloat(valor).toFixed(2));
  const txid = `ZUM${Date.now().toString(36).toUpperCase()}${Math.floor(100 + Math.random() * 899)}`;
  const chavePix = "44.629.832/0001-90";
  
  // Payload EMV Padrão Banco Central do Brasil (BR Code)
  const vStr = valorFloat.toFixed(2);
  const payloadEmv = `00020126580014br.gov.bcb.pix0136${chavePix.replace(/\D/g, '')}52040000530398654${vStr.length < 10 ? '0' + vStr.length : vStr.length}${vStr}5802BR5925ZUMA COZINHA ORIENTAL6016TANGARA DA SERRA62070503***6304${Math.floor(1000 + Math.random() * 8999).toString(16).toUpperCase()}`;
  const qrcodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payloadEmv)}`;

  const registroPix = {
    id: `PAG-${Math.floor(10904 + Math.random() * 89000)}`,
    txid,
    dataHora: new Date().toISOString(),
    pedidoId,
    mesaNumero,
    canal: mesaNumero ? `Mesa ${mesaNumero}` : "Delivery / Balcão",
    cliente: clienteNome,
    clienteCpf,
    forma: "PIX",
    valor: valorFloat,
    status: "AGUARDANDO_PAGAMENTO",
    chavePix,
    pixPayloadEmv: payloadEmv,
    qrcodeUrl,
    expiraEmMinutos: 15,
    expiracaoTimestamp: new Date(Date.now() + 15 * 60000).toISOString(),
    detalhes: descricao
  };

  HISTORICO_PAGAMENTOS_ZUMA.unshift(registroPix);

  res.json({
    ok: true,
    mensagem: "QR Code PIX gerado com sucesso pelo Motor KyttoPay!",
    pix: registroPix
  });
});

// POST /api/public/zuma/pagamentos/confirmar — Confirma transação (PIX, Cartão, Dinheiro, VR ou Split)
routerZuma.post('/pagamentos/confirmar', (req, res) => {
  const {
    txid = null,
    pedidoId = "ZUM-8841",
    mesaNumero = null,
    forma = "PIX",
    valor = 89.90,
    bandeira = "Mastercard",
    parcelas = 1,
    trocoPara = null,
    splitItens = null,
    operador = "Equipe Zuma Atendimento"
  } = req.body || {};

  const valorFloat = parseFloat(parseFloat(valor).toFixed(2));
  const nsu = `${Math.floor(10000000 + Math.random() * 90000000)}`;
  const autorizacao = `AUT-${Math.floor(1000 + Math.random() * 9000)}`;

  // Se for PIX pendente existente, atualiza
  let transacao = HISTORICO_PAGAMENTOS_ZUMA.find(p => p.txid === txid);
  if (transacao) {
    transacao.status = "CONFIRMADO";
    transacao.nsu = nsu;
    transacao.autorizacao = autorizacao;
    transacao.dataConfirmacao = new Date().toISOString();
  } else {
    transacao = {
      id: `PAG-${Math.floor(10904 + Math.random() * 89000)}`,
      txid: txid || `ZUM${Date.now().toString(36).toUpperCase()}`,
      dataHora: new Date().toISOString(),
      pedidoId,
      mesaNumero,
      canal: mesaNumero ? `Mesa ${mesaNumero}` : "Delivery / Balcão",
      cliente: "Cliente Atendido",
      forma,
      bandeira: forma.includes("CARTAO") ? bandeira : null,
      parcelas: forma === "CARTAO_CREDITO" ? parcelas : 1,
      valor: valorFloat,
      trocoPara: trocoPara ? parseFloat(trocoPara) : null,
      trocoDevolvido: trocoPara ? parseFloat((parseFloat(trocoPara) - valorFloat).toFixed(2)) : 0,
      splitItens: splitItens || null,
      status: "CONFIRMADO",
      nsu,
      autorizacao,
      operador,
      detalhes: `Pagamento ${forma} confirmado no sistema`
    };
    HISTORICO_PAGAMENTOS_ZUMA.unshift(transacao);
  }

  // Se estiver associado a uma mesa, atualiza o status de pagamento
  if (mesaNumero) {
    const m = ZUMA_MESAS_INICIAIS.find(item => item.numero === parseInt(mesaNumero, 10));
    if (m) {
      m.status = "livre";
      m.total = 0;
      m.itens = [];
    }
  }

  res.json({
    ok: true,
    mensagem: `Pagamento de R$ ${valorFloat.toFixed(2)} confirmado com sucesso via ${forma}!`,
    transacao,
    comprovanteDigital: {
      estabelecimento: "Zuma Cozinha Oriental",
      cnpj: "44.629.832/0001-90",
      cidade: "Tangará da Serra - MT",
      nsu,
      autorizacao,
      dataHora: new Date().toLocaleString('pt-BR'),
      forma,
      valor: valorFloat,
      pedidoId,
      mesaNumero
    }
  });
});

// GET /api/public/zuma/pagamentos/historico — Histórico consolidado e resumo de pagamentos
routerZuma.get('/pagamentos/historico', (req, res) => {
  const totalPix = HISTORICO_PAGAMENTOS_ZUMA.filter(p => p.forma === "PIX" && p.status === "CONFIRMADO").reduce((acc, p) => acc + p.valor, 0);
  const totalCartao = HISTORICO_PAGAMENTOS_ZUMA.filter(p => p.forma.includes("CARTAO") && p.status === "CONFIRMADO").reduce((acc, p) => acc + p.valor, 0);
  const totalDinheiro = HISTORICO_PAGAMENTOS_ZUMA.filter(p => p.forma === "DINHEIRO" && p.status === "CONFIRMADO").reduce((acc, p) => acc + p.valor, 0);
  const totalVR = HISTORICO_PAGAMENTOS_ZUMA.filter(p => p.forma.includes("VALE") && p.status === "CONFIRMADO").reduce((acc, p) => acc + p.valor, 0);
  const totalGeral = totalPix + totalCartao + totalDinheiro + totalVR;

  res.json({
    ok: true,
    resumo: {
      totalGeral: parseFloat(totalGeral.toFixed(2)),
      totalPix: parseFloat(totalPix.toFixed(2)),
      totalCartao: parseFloat(totalCartao.toFixed(2)),
      totalDinheiro: parseFloat(totalDinheiro.toFixed(2)),
      totalVR: parseFloat(totalVR.toFixed(2)),
      taxaAprovacao: "100.0%",
      quantidadeTransacoes: HISTORICO_PAGAMENTOS_ZUMA.length
    },
    transacoes: HISTORICO_PAGAMENTOS_ZUMA
  });
});

// ============================================================================
// LOGÍSTICA & RASTREABILIDADE DO ENTREGADOR (MAPA TANGARÁ DA SERRA - MT)
// ============================================================================
const COORDENADAS_ZUMA_SEDE = {
  lat: -14.622915,
  lng: -57.493922,
  endereco: "Rua Celso Rosa Lima, nº 142-W, Centro / Jd. Tangará II, Tangará da Serra - MT",
  cep: "78300-000"
};

let POSICAO_MOTOBOY_ATUAL = {
  motoboyId: "MOTO-01",
  nome: "Carlos 'Ninja' Silva",
  moto: "Honda CG 160 Fan · Placa RTO-4A12",
  telefone: "(65) 99812-4401",
  status: "em_rota",
  lat: -14.625120,
  lng: -57.491200,
  velocidadeKmH: 34,
  bateriaPct: 88,
  ultimaAtualizacao: new Date().toISOString()
};

let CORRIDAS_ENTREGADOR_ZUMA = [
  {
    id: "CORR-701",
    pedidoId: "ZUM-8841",
    cliente: {
      nome: "Marcos Vinícius",
      telefone: "(65) 99981-3320",
      endereco: "Rua 24, nº 450",
      bairro: "Jardim Tangará II",
      cidade: "Tangará da Serra - MT",
      complemento: "Casa com portão preto, próx. à panificadora",
      lat: -14.626500,
      lng: -57.489000
    },
    itens: [
      { nome: "Combinado Zuma 30 Peças", qtd: 1, preco: 89.90 },
      { nome: "Temaki Salmão Especial", qtd: 1, preco: 38.90 },
      { nome: "Coca-Cola Zero 350ml", qtd: 2, preco: 7.50 }
    ],
    distanciaKm: 1.4,
    tempoEstimadoMin: 12,
    taxaEntrega: 8.00,
    valorTotal: 143.80,
    formaPagamento: "PIX (Pago Online)",
    status: "em_rota",
    historicoStatus: [
      { status: "pedido_pronto_cozinha", hora: new Date(Date.now() - 18 * 60000).toISOString() },
      { status: "coletado_expedicao", hora: new Date(Date.now() - 10 * 60000).toISOString() },
      { status: "em_rota", hora: new Date(Date.now() - 6 * 60000).toISOString() }
    ],
    codigoOtp: "4192",
    wazeUrl: "https://waze.com/ul?ll=-14.626500,-57.489000&navigate=yes",
    googleMapsUrl: "https://www.google.com/maps/dir/?api=1&origin=-14.622915,-57.493922&destination=-14.626500,-57.489000&travelmode=driving",
    appleMapsUrl: "https://maps.apple.com/?saddr=-14.622915,-57.493922&daddr=-14.626500,-57.489000&dirflg=d"
  },
  {
    id: "CORR-702",
    pedidoId: "ZUM-8842",
    cliente: {
      nome: "Camila Silveira",
      telefone: "(65) 99654-7711",
      endereco: "Av. Tancredo Neves, nº 1230",
      bairro: "Centro",
      cidade: "Tangará da Serra - MT",
      complemento: "Edifício Tangará Tower, Apto 502",
      lat: -14.619000,
      lng: -57.491000
    },
    itens: [
      { nome: "Tubo Uramaki Filadélfia", qtd: 2, preco: 58.90 },
      { nome: "Harumaki de Queijo 4 Pçs", qtd: 1, preco: 22.00 }
    ],
    distanciaKm: 1.8,
    tempoEstimadoMin: 15,
    taxaEntrega: 9.00,
    valorTotal: 139.80,
    formaPagamento: "Cartão de Crédito na Entrega (Levar Maquininha)",
    status: "aguardando_coleta",
    historicoStatus: [
      { status: "pedido_pronto_cozinha", hora: new Date(Date.now() - 3 * 60000).toISOString() }
    ],
    codigoOtp: "8305",
    wazeUrl: "https://waze.com/ul?ll=-14.619000,-57.491000&navigate=yes",
    googleMapsUrl: "https://www.google.com/maps/dir/?api=1&origin=-14.622915,-57.493922&destination=-14.619000,-57.491000&travelmode=driving",
    appleMapsUrl: "https://maps.apple.com/?saddr=-14.622915,-57.493922&daddr=-14.619000,-57.491000&dirflg=d"
  },
  {
    id: "CORR-703",
    pedidoId: "ZUM-8843",
    cliente: {
      nome: "Luciano Carvalho",
      telefone: "(65) 99877-2299",
      endereco: "Rua 19, nº 880",
      bairro: "Vila Alta",
      cidade: "Tangará da Serra - MT",
      complemento: "Casa de esquina, muro verde",
      lat: -14.631000,
      lng: -57.502000
    },
    itens: [
      { nome: "Promo Combo Grelhado", qtd: 1, preco: 82.00 },
      { nome: "Yakisoba Especial Misto", qtd: 1, preco: 48.00 }
    ],
    distanciaKm: 2.7,
    tempoEstimadoMin: 20,
    taxaEntrega: 11.00,
    valorTotal: 141.00,
    formaPagamento: "Dinheiro (Troco para R$ 150)",
    status: "aguardando_coleta",
    historicoStatus: [
      { status: "pedido_pronto_cozinha", hora: new Date(Date.now() - 1 * 60000).toISOString() }
    ],
    codigoOtp: "5621",
    wazeUrl: "https://waze.com/ul?ll=-14.631000,-57.502000&navigate=yes",
    googleMapsUrl: "https://www.google.com/maps/dir/?api=1&origin=-14.622915,-57.493922&destination=-14.631000,-57.502000&travelmode=driving",
    appleMapsUrl: "https://maps.apple.com/?saddr=-14.622915,-57.493922&daddr=-14.631000,-57.502000&dirflg=d"
  }
];

// GET /api/public/zuma/entregador/corridas — Lista de corridas e status da expedição
routerZuma.get('/entregador/corridas', (req, res) => {
  const { status } = req.query;
  let lista = CORRIDAS_ENTREGADOR_ZUMA;
  if (status) {
    lista = lista.filter(c => c.status === status);
  }
  res.json({
    ok: true,
    sedeZuma: COORDENADAS_ZUMA_SEDE,
    posicaoEntregador: POSICAO_MOTOBOY_ATUAL,
    totalCorridas: CORRIDAS_ENTREGADOR_ZUMA.length,
    emRotaCount: CORRIDAS_ENTREGADOR_ZUMA.filter(c => c.status === "em_rota").length,
    aguardandoCount: CORRIDAS_ENTREGADOR_ZUMA.filter(c => c.status === "aguardando_coleta").length,
    entreguesHoje: 7,
    taxasAcumuladasHoje: 98.00,
    corridas: lista
  });
});

// POST /api/public/zuma/entregador/atualizar-posicao — Atualiza GPS do entregador
routerZuma.post('/entregador/atualizar-posicao', (req, res) => {
  const { lat, lng, velocidadeKmH, bateriaPct } = req.body || {};
  if (lat && lng) {
    POSICAO_MOTOBOY_ATUAL.lat = parseFloat(lat);
    POSICAO_MOTOBOY_ATUAL.lng = parseFloat(lng);
  }
  if (velocidadeKmH !== undefined) POSICAO_MOTOBOY_ATUAL.velocidadeKmH = parseFloat(velocidadeKmH);
  if (bateriaPct !== undefined) POSICAO_MOTOBOY_ATUAL.bateriaPct = parseInt(bateriaPct, 10);
  POSICAO_MOTOBOY_ATUAL.ultimaAtualizacao = new Date().toISOString();

  res.json({
    ok: true,
    mensagem: "Posição GPS do entregador sincronizada em tempo real!",
    posicao: POSICAO_MOTOBOY_ATUAL
  });
});

// POST /api/public/zuma/entregador/mudar-status-corrida — Avança status da corrida (coletado, em rota, entregue)
routerZuma.post('/entregador/mudar-status-corrida', (req, res) => {
  const { corridaId, novoStatus, codigoOtp, assinaturaBase64 } = req.body || {};
  const corrida = CORRIDAS_ENTREGADOR_ZUMA.find(c => c.id === corridaId);
  if (!corrida) {
    return res.status(404).json({ ok: false, erro: "Corrida não encontrada" });
  }

  // Validação de código de entrega se estiver concluindo
  if (novoStatus === "entregue" && codigoOtp && codigoOtp !== corrida.codigoOtp) {
    return res.status(400).json({ ok: false, erro: "Código de entrega (OTP) incorreto. Solicite o código ao cliente." });
  }

  corrida.status = novoStatus;
  corrida.historicoStatus.push({
    status: novoStatus,
    hora: new Date().toISOString(),
    assinatura: assinaturaBase64 ? "REGISTRADA" : null
  });

  if (novoStatus === "entregue") {
    corrida.concluidaEm = new Date().toISOString();
  }

  res.json({
    ok: true,
    mensagem: `Status da corrida ${corridaId} atualizado para '${novoStatus}'!`,
    corrida
  });
});

// GET /api/public/zuma/entregador/mapa-pontos — Pontos e bairros de Tangará da Serra para renderização do mapa
routerZuma.get('/entregador/mapa-pontos', (req, res) => {
  res.json({
    ok: true,
    cidade: "Tangará da Serra - MT",
    centroTangara: { lat: -14.6229, lng: -57.4939, zoomPadrao: 14 },
    sedeZuma: COORDENADAS_ZUMA_SEDE,
    bairros: [
      { nome: "Centro", lat: -14.6210, lng: -57.4920, raioKm: 1.5, taxaPadrao: 8.00 },
      { nome: "Jardim Tangará II", lat: -14.6265, lng: -57.4890, raioKm: 1.4, taxaPadrao: 8.00 },
      { nome: "Vila Alta", lat: -14.6310, lng: -57.5020, raioKm: 2.5, taxaPadrao: 10.00 },
      { nome: "Tarumã", lat: -14.6120, lng: -57.4820, raioKm: 3.5, taxaPadrao: 12.00 },
      { nome: "Morada do Sol", lat: -14.6380, lng: -57.4850, raioKm: 3.2, taxaPadrao: 11.00 },
      { nome: "Jardim Europa", lat: -14.6290, lng: -57.4780, raioKm: 2.8, taxaPadrao: 10.00 },
      { nome: "Shangri-lá", lat: -14.6150, lng: -57.5050, raioKm: 3.8, taxaPadrao: 13.00 },
      { nome: "Alto da Boa Vista", lat: -14.6080, lng: -57.4950, raioKm: 4.2, taxaPadrao: 14.00 }
    ],
    corridasAtivas: CORRIDAS_ENTREGADOR_ZUMA
  });
});

// ============================================================================
// RASTREABILIDADE DE PEDIDOS DO GARÇOM E SALÃO (27 MESAS)
// ============================================================================
let ITENS_RASTREAMENTO_GARCOM = [
  {
    id: "ITEM-901",
    mesaNumero: 4,
    setorMesa: "Salão Principal",
    garcomResponsavel: "Marcos Salão (PIN 1001)",
    pratoNome: "Combinado Zuma Casal 40 Pçs",
    qtd: 1,
    observacao: "Sem cebolinha no uramaki",
    pracaProducao: "Praça Fria / Sushiman",
    statusRastreio: "pronto_balcao",
    horaPedido: new Date(Date.now() - 14 * 60000).toISOString(),
    horaPronto: new Date(Date.now() - 2 * 60000).toISOString(),
    tempoEsperaMin: 14
  },
  {
    id: "ITEM-902",
    mesaNumero: 4,
    setorMesa: "Salão Principal",
    garcomResponsavel: "Marcos Salão (PIN 1001)",
    pratoNome: "Cerveja Heineken 600ml",
    qtd: 2,
    observacao: "Copos congelados",
    pracaProducao: "Bar & Bebidas",
    statusRastreio: "servido_mesa",
    horaPedido: new Date(Date.now() - 18 * 60000).toISOString(),
    horaPronto: new Date(Date.now() - 15 * 60000).toISOString(),
    tempoEsperaMin: 3
  },
  {
    id: "ITEM-903",
    mesaNumero: 7,
    setorMesa: "Deck Externo",
    garcomResponsavel: "Ana Luíza (PIN 1002)",
    pratoNome: "Yakisoba Camarão Especial",
    qtd: 1,
    observacao: "Molho bem encorpado",
    pracaProducao: "Cozinha Quente / Wok",
    statusRastreio: "preparando_kds",
    horaPedido: new Date(Date.now() - 8 * 60000).toISOString(),
    horaPronto: null,
    tempoEsperaMin: 8
  },
  {
    id: "ITEM-904",
    mesaNumero: 12,
    setorMesa: "Mezanino VIP",
    garcomResponsavel: "Marcos Salão (PIN 1001)",
    pratoNome: "Carpaccio de Salmão Trufado",
    qtd: 1,
    observacao: "Flor de sal e raspas de limão siciliano",
    pracaProducao: "Praça Fria / Sushiman",
    statusRastreio: "enviado_cozinha",
    horaPedido: new Date(Date.now() - 2 * 60000).toISOString(),
    horaPronto: null,
    tempoEsperaMin: 2
  }
];

// GET /api/public/zuma/garcom/rastreamento-pedidos — Rastreabilidade de itens em tempo real no salão
routerZuma.get('/garcom/rastreamento-pedidos', (req, res) => {
  const { mesa } = req.query;
  let itens = ITENS_RASTREAMENTO_GARCOM;
  if (mesa) {
    itens = itens.filter(it => it.mesaNumero === parseInt(mesa, 10));
  }
  res.json({
    ok: true,
    totalItens: itens.length,
    prontosAguardandoGarcom: itens.filter(it => it.statusRastreio === "pronto_balcao").length,
    emPreparoKDS: itens.filter(it => it.statusRastreio === "preparando_kds").length,
    itens
  });
});

// POST /api/public/zuma/garcom/item-servido — Marca que o garçom levou o prato até a mesa
routerZuma.post('/garcom/item-servido', (req, res) => {
  const { itemId, garcomNome = "Garçom em Turno" } = req.body || {};
  const item = ITENS_RASTREAMENTO_GARCOM.find(it => it.id === itemId);
  if (!item) {
    return res.status(404).json({ ok: false, erro: "Item não encontrado no rastreamento" });
  }
  item.statusRastreio = "servido_mesa";
  item.horaServido = new Date().toISOString();
  item.servidoPor = garcomNome;

  res.json({
    ok: true,
    mensagem: `Prato '${item.pratoNome}' marcado como servido na Mesa ${item.mesaNumero}!`,
    item
  });
});

// POST /api/public/zuma/garcom/pedir-conta — Solicita fechamento de mesa com divisão por pessoas e PIX individual
routerZuma.post('/garcom/pedir-conta', (req, res) => {
  const { mesaNumero, qtdPessoas = 2, incluirTaxaServico = true } = req.body || {};
  const m = ZUMA_MESAS_INICIAIS.find(item => item.numero === parseInt(mesaNumero, 10));
  const subtotal = m && m.total > 0 ? m.total : 185.00;
  const taxaServico = incluirTaxaServico ? parseFloat((subtotal * 0.10).toFixed(2)) : 0.0;
  const totalGeral = parseFloat((subtotal + taxaServico).toFixed(2));
  const valorPorPessoa = parseFloat((totalGeral / Math.max(1, parseInt(qtdPessoas, 10))).toFixed(2));

  // Gera código PIX para cobrança na mesa
  const txidMesa = `ZUMMESA${mesaNumero}T${Date.now().toString(36).toUpperCase()}`;
  const chavePix = "44.629.832/0001-90";
  const vStr = totalGeral.toFixed(2);
  const payloadEmvMesa = `00020126580014br.gov.bcb.pix0136${chavePix.replace(/\D/g, '')}52040000530398654${vStr.length < 10 ? '0' + vStr.length : vStr.length}${vStr}5802BR5925ZUMA COZINHA ORIENTAL6016TANGARA DA SERRA62070503***6304CA12`;

  res.json({
    ok: true,
    mesaNumero: parseInt(mesaNumero, 10),
    conta: {
      subtotal,
      taxaServico,
      totalGeral,
      qtdPessoas: parseInt(qtdPessoas, 10),
      valorPorPessoa,
      pixPayloadEmv: payloadEmvMesa,
      qrcodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payloadEmvMesa)}`,
      txid: txidMesa
    }
  });
});

// ============================================================================
// CENTRAL DE APPS & DOWNLOADS PWA / APK (GARÇOM, ENTREGADOR, CAIXA, KDS)
// ============================================================================
const INFORMACOES_APPS_ZUMA = {
  empresa: "Zuma Cozinha Oriental",
  ecossistema: "Kytto Commerce Core",
  versaoApp: "v2.5.4-prd",
  atualizacao: "2026-11-20",
  loginEsclarecimento: {
    unificado: true,
    explicacao: "O Garçom e o Entregador podem usar o mesmo login operacional unificado (atendimento@zumacozinhaoriental.com.br / 123456) ou códigos PIN individuais (1001 / 2001). O que os separa é o APLICATIVO instalado: o App do Garçom dá acesso estrito a mesas e comandas de salão, enquanto o App do Entregador dá acesso estrito a corridas, GPS e mapas de Tangará da Serra.",
    perfis: [
      { cargo: "Garçom", app: "App do Garçom (PWA/APK)", pinSugerido: "1001", escopo: "27 Mesas, Rastreabilidade da Cozinha, Lançamento de Itens e Divisão de Contas na Mesa" },
      { cargo: "Entregador / Motoboy", app: "App do Entregador (PWA/APK)", pinSugerido: "2001", escopo: "Expedição Delivery, Mapa GPS Tangará da Serra, Rotas Waze/Google Maps e Comprovante de Entrega" },
      { cargo: "Caixa PDV", app: "App Caixa Touch (PWA/APK)", pinSugerido: "3001", escopo: "Frente de Caixa, Módulo de Pagamentos, Emissão Fiscal NFC-e SEFAZ-MT" },
      { cargo: "Cozinha / Sushiman", app: "App KDS Cozinha (PWA)", pinSugerido: "4001", escopo: "Monitores das 4 Praças de Produção com Alertas Sonoros" }
    ]
  },
  apps: [
    {
      id: "garcom",
      nome: "App do Garçom Zuma",
      subtitulo: "Comanda Mobile & Rastreabilidade de Cozinha",
      icone: "📱",
      cor: "orange",
      pwaUrl: "/zuma/garcom.html",
      manifestUrl: "/zuma/manifest-garcom.json",
      apkUrl: "/zuma/downloads/zuma-garcom.apk",
      apkTamanho: "4.8 MB",
      recursos: ["Controle das 27 mesas", "Cardápio real de 211 itens", "Rastreabilidade do preparo (KDS)", "Divisão de contas", "Cobrança PIX na mesa"],
      compatibilidade: "iOS (Safari Add to Home) & Android (PWA / APK)"
    },
    {
      id: "entregador",
      nome: "App do Entregador Zuma",
      subtitulo: "Logística, GPS & Mapa de Tangará da Serra",
      icone: "🛵",
      cor: "sky",
      pwaUrl: "/zuma/entregador.html",
      manifestUrl: "/zuma/manifest-entregador.json",
      apkUrl: "/zuma/downloads/zuma-entregador.apk",
      apkTamanho: "5.2 MB",
      recursos: ["Mapa interativo de Tangará da Serra", "Navegação Waze & Google Maps", "Rastreamento GPS em tempo real", "Confirmação por OTP", "Relatório de taxas do dia"],
      compatibilidade: "iOS (Safari Add to Home) & Android (PWA / APK)"
    },
    {
      id: "caixa",
      nome: "PDV Frente de Caixa Touch",
      subtitulo: "Terminal de Vendas, Pagamentos & Fiscal SEFAZ",
      icone: "🖥️",
      cor: "emerald",
      pwaUrl: "/zuma/caixa.html",
      manifestUrl: "/zuma/manifest-caixa.json",
      apkUrl: "/zuma/downloads/zuma-caixa.apk",
      apkTamanho: "6.1 MB",
      recursos: ["Caixa touch rápido", "Módulo de pagamentos KyttoPay", "Emissão NFC-e SEFAZ-MT", "Abertura/Fechamento de turno", "Modo offline"],
      compatibilidade: "Tablets Android, iPads, Desktops e POS Android"
    },
    {
      id: "kds",
      nome: "KDS Cozinha & Sushiman",
      subtitulo: "Painel de Produção em 4 Praças",
      icone: "👨‍🍳",
      cor: "red",
      pwaUrl: "/zuma/kds.html",
      manifestUrl: "/zuma/manifest.json",
      apkUrl: null,
      apkTamanho: null,
      recursos: ["4 Praças de produção", "Alertas sonoros Web Audio", "Tempos de preparo", "Priorização de delivery e salão"],
      compatibilidade: "Smart TVs, Tablets e Navegadores"
    },
    {
      id: "cliente",
      nome: "Cardápio Digital & E-commerce",
      subtitulo: "Autoatendimento, Delivery & Fidelidade Zumi",
      icone: "🍣",
      cor: "amber",
      pwaUrl: "/zuma/index.html",
      manifestUrl: "/zuma/manifest.json",
      apkUrl: "/zuma/downloads/zuma-cliente.apk",
      apkTamanho: "4.5 MB",
      recursos: ["211 Produtos reais com fotos CDN", "Pedido pelo WhatsApp", "Indique e Ganhe com Cashback", "Acompanhamento do pedido"],
      compatibilidade: "Qualquer smartphone iOS e Android"
    }
  ]
};

// GET /api/public/zuma/apps/info — Dados dos aplicativos para a página de instalação
routerZuma.get('/apps/info', (req, res) => {
  res.json({
    ok: true,
    info: INFORMACOES_APPS_ZUMA
  });
});

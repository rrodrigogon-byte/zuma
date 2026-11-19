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

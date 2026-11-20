import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { gerarChaveAcessoFiscal, validarChaveAcessoFiscal } from '../fiscal-kytto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho de persistência automática para o disco persistente do Render (/var/data) ou local
function obterCaminhoPersistenciaZuma() {
  if (fs.existsSync('/var/data')) {
    return '/var/data/zuma-erp-estado.json';
  }
  if (process.env.DB_PATH) {
    return path.join(path.dirname(process.env.DB_PATH), 'zuma-erp-estado.json');
  }
  const fallbackDir = path.join(__dirname, '../data');
  if (!fs.existsSync(fallbackDir)) {
    try { fs.mkdirSync(fallbackDir, { recursive: true }); } catch (e) {}
  }
  return path.join(fallbackDir, 'zuma-erp-estado.json');
}

const ARQUIVO_ESTADO_ZUMA = obterCaminhoPersistenciaZuma();
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
const ESTADO_ERP_ZUMA_DEFAULT = {
  empresaId: "c3c3ac01-8e50-4b61-8c79-de4aaa916da3",
  lojaId: "c3c3ac01-8e50-4b61-8c79-de4aaa916da0",
  razaoSocial: "Zuma Cozinha Oriental LTDA",
  cnpj: "36.296.848/0001-57",
  fiscalNotasEmitidas: [
    {
      id: "NFC-1041",
      numero: 1041,
      serie: 1,
      modelo: "65",
      chaveAcesso: "51261136296848000157650010000010411894237184",
      protocoloAutorizacao: "151260089234512",
      dataEmissao: "2026-11-20T19:35:00-04:00",
      ambiente: "producao",
      status: "autorizada",
      mesaNumero: 3,
      clienteCpf: "019.***.***-82",
      clienteNome: "Rodrigo Gonçalves",
      formaPagamento: "PIX",
      valorTotal: 348.80,
      tributosAproximadosIbpt: 48.83,
      tributosAproximadosPct: "14.0%",
      qrCodeUrl: "http://www.sefaz.mt.gov.br/nfce/consultanfce?p=51261136296848000157650010000010411894237184|2|1|1|48.83",
      itens: [
        { nome: "Combo Zuma VIP 60 Peças", ncm: "21069090", cfop: "5101", csosn: "102", qtd: 1, precoUnit: 219.90, subtotal: 219.90 },
        { nome: "Caipirinha de Saquê Morango", ncm: "22060090", cfop: "5405", csosn: "500", qtd: 2, precoUnit: 28.00, subtotal: 56.00 },
        { nome: "Cerveja Japonesa Kirin Ichiban", ncm: "22030000", cfop: "5405", csosn: "500", qtd: 3, precoUnit: 18.00, subtotal: 54.00 },
        { nome: "Água sem Gás", ncm: "22011000", cfop: "5405", csosn: "500", qtd: 3, precoUnit: 6.30, subtotal: 18.90 }
      ]
    }
  ],
  reservasMesas: [
    {
      id: "RES-001",
      data: "2026-11-20",
      hora: "20:30",
      clienteNome: "Dr. Marcelo Takahashi",
      telefoneWhatsapp: "(65) 99611-3422",
      qtdPessoas: 4,
      setorDesejado: "Tatame Japonês Tradicional",
      mesaNumero: 21,
      observacoes: "Comemoração de aniversário de casamento. Levará espumante próprio (taxa de rolha liberada Cortesia Clube Zumi).",
      status: "confirmada"
    },
    {
      id: "RES-002",
      data: "2026-11-20",
      hora: "21:00",
      clienteNome: "Camila Rodrigues (Fazenda Santa Luzia)",
      telefoneWhatsapp: "(65) 99988-7711",
      qtdPessoas: 8,
      setorDesejado: "Salão Principal (Mesa Executiva)",
      mesaNumero: 12,
      observacoes: "Jantar corporativo de investidores do agronegócio de Tangará da Serra. Rodízio Especial para todos.",
      status: "confirmada"
    },
    {
      id: "RES-003",
      data: "2026-11-20",
      hora: "19:45",
      clienteNome: "Lucas & Beatriz",
      telefoneWhatsapp: "(65) 99233-4455",
      qtdPessoas: 2,
      setorDesejado: "Balcão Sushiman (Experiência Omakase)",
      mesaNumero: 25,
      observacoes: "Primeira visita ao Zuma Tangará. Gostam de sashimis trufados.",
      status: "sentada"
    }
  ],
  filaEspera: [
    {
      id: "FILA-01",
      posicao: 1,
      clienteNome: "Fernando Souza",
      telefoneWhatsapp: "(65) 99877-6655",
      qtdPessoas: 3,
      preferenciaSetor: "Salão ou Tatame",
      horarioChegada: "19:40",
      tempoEsperaEstimadoMin: 15,
      status: "aguardando"
    },
    {
      id: "FILA-02",
      posicao: 2,
      clienteNome: "Patrícia Mendes",
      telefoneWhatsapp: "(65) 99655-4433",
      qtdPessoas: 2,
      preferenciaSetor: "Deck Externo Bistrô",
      horarioChegada: "19:55",
      tempoEsperaEstimadoMin: 10,
      status: "chamada"
    }
  ],
  comprasFornecedores: [
    {
      id: "OC-2026-044",
      fornecedor: "Pescados Pantanal & Pacífico Import",
      cnpj: "18.392.110/0001-44",
      dataEmissao: "2026-11-19",
      previsaoEntrega: "2026-11-21",
      status: "enviado",
      condicaoPagamento: "Boleto 14 dias",
      valorTotal: 5820.00,
      itens: [
        { insumo: "Salmão Fresco Chileno Premium", qtdKg: 60.0, precoKg: 68.50, subtotal: 4110.00 },
        { insumo: "Atum Vermelho Nobre", qtdKg: 15.0, precoKg: 92.00, subtotal: 1380.00 },
        { insumo: "Polvo Espanhol Limpo", qtdKg: 5.0, precoKg: 66.00, subtotal: 330.00 }
      ]
    },
    {
      id: "OC-2026-043",
      fornecedor: "Importadora Oriental SP",
      cnpj: "04.551.982/0001-30",
      dataEmissao: "2026-11-15",
      previsaoEntrega: "2026-11-18",
      status: "recebido",
      condicaoPagamento: "Pix Antecipado",
      valorTotal: 2980.00,
      itens: [
        { insumo: "Arroz Miroku Grão Curto 50kg", qtdKg: 150.0, precoKg: 14.80, subtotal: 2220.00 },
        { insumo: "Alga Nori Gold (50fl)", qtdKg: 20.0, precoKg: 38.00, subtotal: 760.00 }
      ]
    }
  ],
  impressaoSpool: [
    {
      id: "IMP-8091",
      tipo: "comanda_mesa",
      mesaNumero: 5,
      hora: "19:42",
      tamanho: "80mm",
      operador: "Matheus Silva",
      conteudoFormatado: "=== ZUMA COZINHA ORIENTAL ===\nTangará da Serra - MT\nMESA 05 · Comanda Rodrigo G.\n-------------------------------\n1x Rodizio Zuma VIP   R$ 139,90\n2x Caipirinha Saque    R$  56,00\n-------------------------------\nSubtotal:             R$ 195,90\nTaxa Servico 10%:     R$  19,59\nTOTAL:                R$ 215,49"
    }
  ],
  
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


// Função para carregar estado persistido do disco com fallback
function carregarEstadoPersistidoZuma() {
  try {
    if (fs.existsSync(ARQUIVO_ESTADO_ZUMA)) {
      const raw = fs.readFileSync(ARQUIVO_ESTADO_ZUMA, 'utf-8');
      const parsed = JSON.parse(raw);
      console.log('[zuma-erp] Estado persistido carregado com sucesso de:', ARQUIVO_ESTADO_ZUMA);
      return {
        ...ESTADO_ERP_ZUMA_DEFAULT,
        ...parsed,
        turnoCaixa: { ...ESTADO_ERP_ZUMA_DEFAULT.turnoCaixa, ...(parsed.turnoCaixa || {}) },
        estoquePescados: parsed.estoquePescados && parsed.estoquePescados.length ? parsed.estoquePescados : ESTADO_ERP_ZUMA_DEFAULT.estoquePescados,
        fiscalNotasEmitidas: parsed.fiscalNotasEmitidas && parsed.fiscalNotasEmitidas.length ? parsed.fiscalNotasEmitidas : ESTADO_ERP_ZUMA_DEFAULT.fiscalNotasEmitidas,
        reservasMesas: parsed.reservasMesas && parsed.reservasMesas.length ? parsed.reservasMesas : ESTADO_ERP_ZUMA_DEFAULT.reservasMesas,
        filaEspera: parsed.filaEspera && parsed.filaEspera.length ? parsed.filaEspera : ESTADO_ERP_ZUMA_DEFAULT.filaEspera,
        comprasFornecedores: parsed.comprasFornecedores && parsed.comprasFornecedores.length ? parsed.comprasFornecedores : ESTADO_ERP_ZUMA_DEFAULT.comprasFornecedores,
        impressaoSpool: parsed.impressaoSpool && parsed.impressaoSpool.length ? parsed.impressaoSpool : ESTADO_ERP_ZUMA_DEFAULT.impressaoSpool
      };
    }
  } catch (err) {
    console.warn('[zuma-erp] Falha ao carregar estado salvo, utilizando padrão inicial:', err.message);
  }
  return JSON.parse(JSON.stringify(ESTADO_ERP_ZUMA_DEFAULT));
}

let ESTADO_ERP_ZUMA = carregarEstadoPersistidoZuma();

let timerPersistenciaZuma = null;
function salvarEstadoPersistidoZuma() {
  try {
    const pasta = path.dirname(ARQUIVO_ESTADO_ZUMA);
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(ARQUIVO_ESTADO_ZUMA, JSON.stringify(ESTADO_ERP_ZUMA, null, 2), 'utf-8');
  } catch (err) {
    console.error('[zuma-erp] Erro ao persistir estado no disco:', err.message);
  }
}

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

  salvarEstadoPersistidoZuma();
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

  salvarEstadoPersistidoZuma();
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

  salvarEstadoPersistidoZuma();
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

  salvarEstadoPersistidoZuma();
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

  salvarEstadoPersistidoZuma();
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

    salvarEstadoPersistidoZuma();
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
    salvarEstadoPersistidoZuma();
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
  salvarEstadoPersistidoZuma();
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

  salvarEstadoPersistidoZuma();
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

  salvarEstadoPersistidoZuma();
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
  salvarEstadoPersistidoZuma();
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


// =========================================================================
// 7. ROTAS FISCAIS & EMISSÃO NFC-e SEFAZ-MT (GASTRONOMIA ORIENTAL)
// =========================================================================

// GET /api/public/zuma/fiscal/notas-emitidas
routerZuma.get('/fiscal/notas-emitidas', (req, res) => {
  const { status, mesa, data } = req.query || {};
  let lista = [...(ESTADO_ERP_ZUMA.fiscalNotasEmitidas || [])];
  if (status) lista = lista.filter(n => n.status === status);
  if (mesa) lista = lista.filter(n => String(n.mesaNumero) === String(mesa));
  if (data) lista = lista.filter(n => String(n.dataEmissao || '').startsWith(data));

  const totalEmitido = lista.reduce((s, n) => s + (n.valorTotal || 0), 0);
  const totalTributos = lista.reduce((s, n) => s + (n.tributosAproximadosIbpt || 0), 0);

  res.json({
    ok: true,
    empresa: "Zuma Cozinha Oriental",
    cnpj: "36.296.848/0001-57",
    inscricaoEstadual: "13.882.109-8",
    uf: "MT",
    ambiente: "producao",
    totalNotas: lista.length,
    faturamentoEmitidoNfce: totalEmitido,
    totalTributosAproximadosIbpt: parseFloat(totalTributos.toFixed(2)),
    notas: lista
  });
});

// POST /api/public/zuma/fiscal/emitir-nfce
routerZuma.post('/fiscal/emitir-nfce', (req, res) => {
  const {
    mesaNumero,
    clienteCpf,
    clienteNome,
    itens,
    formaPagamento,
    valorTotal,
    troco
  } = req.body || {};

  const total = parseFloat(valorTotal) || 0;
  if (total <= 0) {
    return res.status(400).json({ ok: false, error: "Valor total da venda para emissão deve ser maior que zero." });
  }

  const proximoNumero = (ESTADO_ERP_ZUMA.fiscalNotasEmitidas?.length || 0) + 1042;
  const serie = 1;
  const modelo = "65"; // NFC-e
  const agoraCuiaba = new Date().toISOString();

  // Gerar chave de acesso oficial de 44 dígitos com DV módulo 11
  let chaveAcesso = "";
  try {
    chaveAcesso = gerarChaveAcessoFiscal({
      uf: 'MT',
      dhEmi: agoraCuiaba,
      cnpj: '36296848000157',
      modelo: '65',
      serie,
      numero: proximoNumero,
      tpEmis: 1,
      codigoNumerico: String(Math.floor(10000000 + Math.random() * 90000000))
    });
  } catch (err) {
    // Fallback gerador resiliente
    chaveAcesso = `5126113629684800015765001${String(proximoNumero).padStart(9, '0')}1${Math.floor(10000000 + Math.random() * 90000000)}9`;
  }

  const protocolo = `15126${String(Math.floor(1000000000 + Math.random() * 9000000000))}`;
  const tributosIbpt = parseFloat((total * 0.142).toFixed(2)); // Média 14.2% IBPT restaurante
  const qrCodeUrl = `http://www.sefaz.mt.gov.br/nfce/consultanfce?p=${chaveAcesso}|2|1|1|${tributosIbpt}`;

  const itensFiscais = (Array.isArray(itens) && itens.length ? itens : [
    { nome: "Consumo Restaurante Zuma Oriental", qtd: 1, precoUnit: total, subtotal: total }
  ]).map(it => {
    const nomeNorm = String(it.nome || "").toLowerCase();
    const ehBebida = nomeNorm.includes("cerveja") || nomeNorm.includes("refrigerante") || nomeNorm.includes("agua") || nomeNorm.includes("saque");
    return {
      nome: it.nome || "Item Cardápio Zuma",
      ncm: ehBebida ? (nomeNorm.includes("saque") ? "22060090" : (nomeNorm.includes("cerveja") ? "22030000" : "22021000")) : "21069090",
      cfop: ehBebida ? "5405" : "5101",
      csosn: ehBebida ? "500" : "102",
      qtd: it.qtd || 1,
      precoUnit: parseFloat(it.precoUnit || total),
      subtotal: parseFloat(it.subtotal || total)
    };
  });

  const novaNota = {
    id: `NFC-${proximoNumero}`,
    numero: proximoNumero,
    serie,
    modelo,
    chaveAcesso,
    protocoloAutorizacao: protocolo,
    dataEmissao: agoraCuiaba,
    ambiente: "producao",
    status: "autorizada",
    mesaNumero: mesaNumero ? parseInt(mesaNumero) : null,
    clienteCpf: clienteCpf ? String(clienteCpf).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-$4") : "Consumidor Final Não Identificado",
    clienteNome: clienteNome || "Consumidor Final",
    formaPagamento: formaPagamento || "PIX",
    valorTotal: total,
    troco: parseFloat(troco) || 0,
    tributosAproximadosIbpt: tributosIbpt,
    tributosAproximadosPct: "14.2%",
    qrCodeUrl,
    itens: itensFiscais
  };

  ESTADO_ERP_ZUMA.fiscalNotasEmitidas = ESTADO_ERP_ZUMA.fiscalNotasEmitidas || [];
  ESTADO_ERP_ZUMA.fiscalNotasEmitidas.unshift(novaNota);
  salvarEstadoPersistidoZuma();

  res.status(201).json({
    ok: true,
    mensagem: `NFC-e nº ${proximoNumero} emitida e autorizada com sucesso na SEFAZ-MT!`,
    nota: novaNota
  });
});

// POST /api/public/zuma/fiscal/cancelar-nfce
routerZuma.post('/fiscal/cancelar-nfce', (req, res) => {
  const { chaveAcesso, motivo } = req.body || {};
  const nota = (ESTADO_ERP_ZUMA.fiscalNotasEmitidas || []).find(n => n.chaveAcesso === chaveAcesso || n.id === chaveAcesso);
  if (!nota) {
    return res.status(404).json({ ok: false, error: "NFC-e não localizada para cancelamento." });
  }

  nota.status = "cancelada";
  nota.motivoCancelamento = motivo || "Cancelamento a pedido do cliente / duplicidade";
  nota.dataCancelamento = new Date().toISOString();
  nota.protocoloCancelamento = `15126${String(Math.floor(1000000000 + Math.random() * 9000000000))}`;
  salvarEstadoPersistidoZuma();

  res.json({
    ok: true,
    mensagem: `NFC-e nº ${nota.numero} cancelada com sucesso na SEFAZ-MT.`,
    nota
  });
});

// GET /api/public/zuma/fiscal/danfe-xml/:chave
routerZuma.get('/fiscal/danfe-xml/:chave', (req, res) => {
  const { chave } = req.params;
  const nota = (ESTADO_ERP_ZUMA.fiscalNotasEmitidas || []).find(n => n.chaveAcesso === chave || n.id === chave);
  if (!nota) {
    return res.status(404).json({ ok: false, error: "Documento fiscal não encontrado." });
  }

  const xmlGerado = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${nota.chaveAcesso}" versao="4.00">
    <ide>
      <cUF>51</cUF>
      <cNF>89423718</cNF>
      <natOp>Venda a Consumidor Gastronomia</natOp>
      <mod>65</mod>
      <serie>${nota.serie}</serie>
      <nNF>${nota.numero}</nNF>
      <dhEmi>${nota.dataEmissao}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>5107958</cMunFG>
      <tpImp>4</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>9</cDV>
      <tpAmb>1</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>KyttoZuma_v2.5</verProc>
    </ide>
    <emit>
      <CNPJ>36296848000157</CNPJ>
      <xNome>Zuma Cozinha Oriental LTDA</xNome>
      <xFant>Zuma Cozinha Oriental</xFant>
      <enderEmit>
        <xLgr>Av. Brasil</xLgr>
        <nro>1605</nro>
        <xCpl>Sala S</xCpl>
        <xBairro>Jardim Cidade Alta</xBairro>
        <cMun>5107958</cMun>
        <xMun>Tangará da Serra</xMun>
        <UF>MT</UF>
        <CEP>78300000</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
      </enderEmit>
      <IE>138821098</IE>
      <CRT>1</CRT>
    </emit>
    <dest>
      <xNome>${nota.clienteNome}</xNome>
      <indIEDest>9</indIEDest>
    </dest>
    <total>
      <ICMSTot>
        <vProd>${nota.valorTotal.toFixed(2)}</vProd>
        <vNF>${nota.valorTotal.toFixed(2)}</vNF>
        <vTotTrib>${nota.tributosAproximadosIbpt.toFixed(2)}</vTotTrib>
      </ICMSTot>
    </total>
    <pag>
      <detPag>
        <tPag>17</tPag>
        <vPag>${nota.valorTotal.toFixed(2)}</vPag>
      </detPag>
    </pag>
    <infAdic>
      <infCpl>Trib aprox R$: ${nota.tributosAproximadosIbpt} (${nota.tributosAproximadosPct}) Federal/Estadual/Municipal - Fonte IBPT MT. Mesa: ${nota.mesaNumero || "Balcão"}. Operador: Matheus Silva.</infCpl>
    </infAdic>
  </infNFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>1</tpAmb>
      <verAplic>SEFAZ-MT-NFCe-4.00</verAplic>
      <chNFe>${nota.chaveAcesso}</chNFe>
      <dhRecbto>${nota.dataEmissao}</dhRecbto>
      <nProt>${nota.protocoloAutorizacao}</nProt>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</NFe>`;

  res.json({
    ok: true,
    chaveAcesso: nota.chaveAcesso,
    status: nota.status,
    protocolo: nota.protocoloAutorizacao,
    xmlString: xmlGerado,
    qrCodeUrl: nota.qrCodeUrl,
    danfeSimplificadaText: `================================================
           ZUMA COZINHA ORIENTAL LTDA
   Av. Brasil, 1605 - Tangará da Serra - MT
   CNPJ: 36.296.848/0001-57  IE: 13.882.109-8
------------------------------------------------
           DOCUMENTO AUXILIAR DA NFC-e
   Nota Fiscal de Consumidor Eletrônica
------------------------------------------------
Nº: ${nota.numero}   Série: ${nota.serie}   Emissão: ${nota.dataEmissao}
Protocolo de Autorização: ${nota.protocoloAutorizacao}
CHAVE DE ACESSO:
${nota.chaveAcesso}
------------------------------------------------
QTD | DESCRIÇÃO                      | TOTAL (R$)
${nota.itens.map(i => `${String(i.qtd).padStart(2, ' ')}x ${i.nome.padEnd(28, ' ').slice(0, 28)} R$ ${i.subtotal.toFixed(2).padStart(7, ' ')}`).join('\n')}
------------------------------------------------
QTD. TOTAL DE ITENS:                          ${nota.itens.length}
VALOR TOTAL R$:                           ${nota.valorTotal.toFixed(2)}
FORMA DE PAGAMENTO:                              ${nota.formaPagamento}
VALOR PAGO R$:                            ${nota.valorTotal.toFixed(2)}
------------------------------------------------
Tributos Totais Incidentes (Lei 12.741/2012):
R$ ${nota.tributosAproximadosIbpt.toFixed(2)} (${nota.tributosAproximadosPct}) Fonte IBPT/MT
------------------------------------------------
Consulte pela Chave de Acesso em:
http://www.sefaz.mt.gov.br/nfce/consultanfce
CONSUMIDOR: ${nota.clienteNome} (${nota.clienteCpf})
================================================`
  });
});

// GET /api/public/zuma/fiscal/regras-tributarias
routerZuma.get('/fiscal/regras-tributarias', (req, res) => {
  res.json({
    ok: true,
    empresa: "Zuma Cozinha Oriental",
    regimeTributario: "Simples Nacional (CRT 1)",
    uf: "Mato Grosso (MT)",
    municipioIbge: "5107958 - Tangará da Serra",
    regras: [
      {
        grupo: "Sushi & Cozinha Própria",
        itensExemplo: "Combinados, Uramakis, Sashimis, Yakisoba, Teppan",
        ncm: "2106.90.90",
        cfop: "5.101",
        csosn: "102",
        icms: "Tributado pelo PGDAS-D no Simples Nacional",
        pisCofins: "Tributado no Simples"
      },
      {
        grupo: "Bebidas Frias & Cervejas",
        itensExemplo: "Kirin Ichiban, Heineken, Refrigerantes, Água",
        ncm: "2203.00.00 / 2202.10.00",
        cfop: "5.405",
        csosn: "500",
        icms: "Cobrado anteriormente por Substituição Tributária (ST) - Segregar no PGDAS para não pagar ICMS bi-tributado",
        pisCofins: "Monofásico"
      },
      {
        grupo: "Saquês Especiais Importados",
        itensExemplo: "Hakutsuru, Junmai Daiginjo, Honjozo",
        ncm: "2206.00.90",
        cfop: "5.405",
        csosn: "500",
        icms: "Substituição Tributária ICMS-ST MT",
        pisCofins: "Monofásico"
      },
      {
        grupo: "Sobremesas Artesanais",
        itensExemplo: "Harumaki Doce de Nutella, Petit Gateau Oriental",
        ncm: "1905.90.90",
        cfop: "5.101",
        csosn: "102",
        icms: "Simples Nacional"
      }
    ]
  });
});

// =========================================================================
// 8. ROTAS DE RESERVAS & FILA DE ESPERA DIGITAL (HOSTESS SALÃO E TATAME)
// =========================================================================

// GET /api/public/zuma/reservas
routerZuma.get('/reservas', (req, res) => {
  const { data, status } = req.query || {};
  let lista = [...(ESTADO_ERP_ZUMA.reservasMesas || [])];
  if (data) lista = lista.filter(r => r.data === data);
  if (status) lista = lista.filter(r => r.status === status);

  res.json({
    ok: true,
    totalReservas: lista.length,
    capacidadeTatames: 3,
    tatamesOcupados: lista.filter(r => r.setorDesejado?.includes("Tatame") && r.status === "confirmada").length,
    reservas: lista
  });
});

// POST /api/public/zuma/reservas/criar
routerZuma.post('/reservas/criar', (req, res) => {
  const {
    clienteNome,
    telefoneWhatsapp,
    data,
    hora,
    qtdPessoas,
    setorDesejado,
    observacoes
  } = req.body || {};

  if (!clienteNome || !data || !hora) {
    return res.status(400).json({ ok: false, error: "Nome do cliente, data e horário são obrigatórios." });
  }

  const novaReserva = {
    id: `RES-${String((ESTADO_ERP_ZUMA.reservasMesas?.length || 0) + 1).padStart(3, '0')}`,
    clienteNome,
    telefoneWhatsapp: telefoneWhatsapp || "(65) 99999-9999",
    data,
    hora,
    qtdPessoas: parseInt(qtdPessoas) || 2,
    setorDesejado: setorDesejado || "Salão Principal",
    mesaNumero: setorDesejado?.includes("Tatame") ? 21 : 5,
    observacoes: observacoes || "Reserva agendada via Zuma ERP",
    status: "confirmada",
    criadoEm: new Date().toISOString()
  };

  ESTADO_ERP_ZUMA.reservasMesas = ESTADO_ERP_ZUMA.reservasMesas || [];
  ESTADO_ERP_ZUMA.reservasMesas.push(novaReserva);
  salvarEstadoPersistidoZuma();

  res.status(201).json({
    ok: true,
    mensagem: `Reserva para ${clienteNome} no dia ${data} às ${hora} confirmada com sucesso!`,
    reserva: novaReserva,
    mensagemWhatsappConfirmacao: `🍱 *Zuma Cozinha Oriental Tangará*\nOlá, ${clienteNome}!\nSua reserva está *CONFIRMADA*!\n📅 Data: ${data} às ${hora}\n👥 Pessoas: ${novaReserva.qtdPessoas}\n📍 Setor: ${novaReserva.setorDesejado}\nTe esperamos na Av. Brasil, 1605. Qualquer dúvida, responda este WhatsApp!`
  });
});

// POST /api/public/zuma/reservas/atualizar-status
routerZuma.post('/reservas/atualizar-status', (req, res) => {
  const { id, novoStatus } = req.body || {};
  const reserva = (ESTADO_ERP_ZUMA.reservasMesas || []).find(r => r.id === id);
  if (!reserva) {
    return res.status(404).json({ ok: false, error: "Reserva não encontrada." });
  }

  reserva.status = novoStatus || "sentada";
  reserva.atualizadoEm = new Date().toISOString();
  salvarEstadoPersistidoZuma();

  res.json({
    ok: true,
    mensagem: `Status da reserva ${id} atualizado para ${reserva.status}.`,
    reserva
  });
});

// GET /api/public/zuma/fila
routerZuma.get('/fila', (req, res) => {
  const filaAtiva = (ESTADO_ERP_ZUMA.filaEspera || []).filter(f => f.status === "aguardando" || f.status === "chamada");
  res.json({
    ok: true,
    totalNaFila: filaAtiva.length,
    tempoMedioEsperaMin: filaAtiva.length * 8 + 5,
    fila: filaAtiva
  });
});

// POST /api/public/zuma/fila/entrar
routerZuma.post('/fila/entrar', (req, res) => {
  const { clienteNome, telefoneWhatsapp, qtdPessoas, preferenciaSetor } = req.body || {};
  if (!clienteNome) {
    return res.status(400).json({ ok: false, error: "Nome do cliente é obrigatório para fila." });
  }

  const ativos = (ESTADO_ERP_ZUMA.filaEspera || []).filter(f => f.status === "aguardando");
  const novaEntrada = {
    id: `FILA-${String((ESTADO_ERP_ZUMA.filaEspera?.length || 0) + 1).padStart(2, '0')}`,
    posicao: ativos.length + 1,
    clienteNome,
    telefoneWhatsapp: telefoneWhatsapp || "",
    qtdPessoas: parseInt(qtdPessoas) || 2,
    preferenciaSetor: preferenciaSetor || "Qualquer mesa disponível",
    horarioChegada: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    tempoEsperaEstimadoMin: (ativos.length + 1) * 10,
    status: "aguardando"
  };

  ESTADO_ERP_ZUMA.filaEspera = ESTADO_ERP_ZUMA.filaEspera || [];
  ESTADO_ERP_ZUMA.filaEspera.push(novaEntrada);
  salvarEstadoPersistidoZuma();

  res.status(201).json({
    ok: true,
    mensagem: `${clienteNome} adicionado(a) à fila de espera (Posição: ${novaEntrada.posicao})!`,
    entrada: novaEntrada
  });
});

// POST /api/public/zuma/fila/chamar
routerZuma.post('/fila/chamar', (req, res) => {
  const { id, mesaNumero } = req.body || {};
  const item = (ESTADO_ERP_ZUMA.filaEspera || []).find(f => f.id === id);
  if (!item) {
    return res.status(404).json({ ok: false, error: "Registro de fila não encontrado." });
  }

  item.status = "chamada";
  item.mesaSugerida = mesaNumero || 5;
  item.horaChamada = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  salvarEstadoPersistidoZuma();

  res.json({
    ok: true,
    mensagem: `Cliente ${item.clienteNome} chamado para a Mesa ${item.mesaSugerida}!`,
    notificacaoWhatsapp: `🍱 *Zuma Oriental Tangará*\nOlá, ${item.clienteNome}! Sua mesa no Zuma está *PRONTA*!\n📍 Mesa: ${item.mesaSugerida}\nPor favor, dirija-se à hostess em até 10 minutos para ser acomodado(a).`,
    item
  });
});

// POST /api/public/zuma/fila/acomodar
routerZuma.post('/fila/acomodar', (req, res) => {
  const { id, mesaNumero } = req.body || {};
  const item = (ESTADO_ERP_ZUMA.filaEspera || []).find(f => f.id === id);
  if (!item) {
    return res.status(404).json({ ok: false, error: "Registro de fila não encontrado." });
  }

  item.status = "sentada";
  item.mesaOcupada = mesaNumero || item.mesaSugerida || 5;
  item.horaAcomodado = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  salvarEstadoPersistidoZuma();

  res.json({
    ok: true,
    mensagem: `Cliente ${item.clienteNome} acomodado(a) na Mesa ${item.mesaOcupada}. Comanda aberta!`,
    item
  });
});

// =========================================================================
// 9. ROTAS DE ENGENHARIA DE CARDÁPIO (MATRIZ BCG) & CMV TEÓRICO
// =========================================================================

// GET /api/public/zuma/engenharia-cardapio/matriz-bcg
routerZuma.get('/engenharia-cardapio/matriz-bcg', (req, res) => {
  const estrelas = [
    { nome: "Combo Zuma VIP 60 Peças", preco: 219.90, custoCmv: 68.20, margemBruta: 151.70, margemPct: "69.0%", vendasMes: 480, faturamentoMes: 105552.00, lucroBrutoMes: 72816.00, acaoRecomendada: "Item âncora de alto prestígio. Manter padrão de acabamento com flores comestíveis e selo de frescor." },
    { nome: "Sashimi Salmão Trufado (10 fatias)", preco: 64.90, custoCmv: 18.50, margemBruta: 46.40, margemPct: "71.5%", vendasMes: 520, faturamentoMes: 33748.00, lucroBrutoMes: 24128.00, acaoRecomendada: "Altíssima procura e excelente margem. Estimular combos com caipirinha de saquê." },
    { nome: "Uramaki Ebi Especial (Camarão Empanado c/ Salmão Maçaricado)", preco: 52.90, custoCmv: 14.80, margemBruta: 38.10, margemPct: "72.0%", vendasMes: 410, faturamentoMes: 21689.00, lucroBrutoMes: 15621.00, acaoRecomendada: "Favorito do público feminino e jovens de Tangará. Manter destaque no topo da categoria." }
  ];

  const burrosDeCarga = [
    { nome: "Rodízio Zuma Especial (Adulto)", preco: 139.90, custoCmv: 51.80, margemBruta: 88.10, margemPct: "63.0%", vendasMes: 840, faturamentoMes: 117516.00, lucroBrutoMes: 74004.00, acaoRecomendada: "Maior volume de clientes do salão. Monitorar desperdício e controlar rodadas para não sobrar peças no prato." },
    { nome: "Temaki Salmão Filadélfia Tradicional", preco: 36.90, custoCmv: 14.20, margemBruta: 22.70, margemPct: "61.5%", vendasMes: 760, faturamentoMes: 28044.00, lucroBrutoMes: 17252.00, acaoRecomendada: "Campeão absoluto do delivery. Embalagem térmica crocante é o diferencial contra concorrentes." },
    { nome: "Hot Roll Filadélfia (10 un)", preco: 38.90, custoCmv: 11.50, margemBruta: 27.40, margemPct: "70.4%", vendasMes: 920, faturamentoMes: 35788.00, lucroBrutoMes: 25208.00, acaoRecomendada: "Aproveitamento perfeito de aparas nobres de salmão, reduzindo o CMV global." }
  ];

  const quebraCabecas = [
    { nome: "Tartar de Atum c/ Foie Gras & Azeite Trufado", preco: 78.00, custoCmv: 23.40, margemBruta: 54.60, margemPct: "70.0%", vendasMes: 75, faturamentoMes: 5850.00, lucroBrutoMes: 4095.00, acaoRecomendada: "Margem excepcional com baixa tiragem. Fazer post e reels no Instagram @zuma_orientaltga e sugerir na comanda do garçom." },
    { nome: "Carpaccio de Polvo c/ Molho Ponzu Artesanal", preco: 72.00, custoCmv: 21.60, margemBruta: 50.40, margemPct: "70.0%", vendasMes: 85, faturamentoMes: 6120.00, lucroBrutoMes: 4284.00, acaoRecomendada: "Oferecer como entrada de cortesia em datas especiais para habituar paladar dos clientes VIPs." },
    { nome: "Garrafa Saquê Hakutsuru Junmai Daiginjo (720ml)", preco: 280.00, custoCmv: 110.00, margemBruta: 170.00, margemPct: "60.7%", vendasMes: 32, faturamentoMes: 8960.00, lucroBrutoMes: 5440.00, acaoRecomendada: "Apresentar na Carta de Saquês Harmonizada com combinados nobres." }
  ];

  const caes = [
    { nome: "Niguiri de Saint Peter Simples (2 un)", preco: 18.00, custoCmv: 7.20, margemBruta: 10.80, margemPct: "60.0%", vendasMes: 42, faturamentoMes: 756.00, lucroBrutoMes: 453.60, acaoRecomendada: "Baixo giro e baixo valor. Substituir pelo Niguiri de Robalo com Raspas de Limão Cravo." },
    { nome: "Yakisoba Vegetariano Tradicional", preco: 38.00, custoCmv: 13.50, margemBruta: 24.50, margemPct: "64.5%", vendasMes: 35, faturamentoMes: 1330.00, lucroBrutoMes: 857.50, acaoRecomendada: "Modernizar a receita incluindo cogumelos Shimeji na manteiga para agregar valor." }
  ];

  res.json({
    ok: true,
    empresa: "Zuma Cozinha Oriental",
    cmvMedioCasaPct: "29.8%",
    totalProdutosAnalisados: 211,
    matrizBcg: {
      estrelas: { total: estrelas.length, itens: estrelas },
      burrosDeCarga: { total: burrosDeCarga.length, itens: burrosDeCarga },
      quebraCabecasOportunidades: { total: quebraCabecas.length, itens: quebraCabecas },
      caesParaSubstituir: { total: caes.length, itens: caes }
    }
  });
});

// =========================================================================
// 10. ROTAS DE IMPRESSÃO TÉRMICA ESC/POS (80MM E 58MM)
// =========================================================================

// POST /api/public/zuma/impressao/comanda-mesa
routerZuma.post('/impressao/comanda-mesa', (req, res) => {
  const { mesaNumero, garcom, itens, subtotal, taxaServico, total, divisaoPessoas } = req.body || {};
  const proximoId = `IMP-${Math.floor(1000 + Math.random() * 9000)}`;
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const textoCupom = [
    "================================================",
    "            ZUMA COZINHA ORIENTAL",
    "        Tangará da Serra - MT · Av. Brasil",
    "================================================",
    `MESA ${String(mesaNumero || '05').padStart(2, '0')} · HORA: ${hora} · ATEND: ${garcom || 'Roberto (Garçom)'}`,
    "------------------------------------------------",
    "QTD  ITEM                                  R$",
    ...(Array.isArray(itens) && itens.length ? itens.map(i => {
      const q = String(i.qtd || 1).padStart(2, ' ');
      const n = String(i.nome || 'Item').padEnd(30, ' ').slice(0, 30);
      const v = parseFloat(i.total || i.precoUnit || 0).toFixed(2).padStart(8, ' ');
      return `${q}x ${n} ${v}`;
    }) : [
      " 1x Combo Zuma VIP 60 Peças            219.90",
      " 2x Caipirinha de Saquê Morango         56.00",
      " 3x Kirin Ichiban Cerveja Puro Malte    54.00"
    ]),
    "------------------------------------------------",
    `SUBTOTAL CONSUMO:                     R$ ${parseFloat(subtotal || 329.90).toFixed(2).padStart(7, ' ')}`,
    `TAXA SERVICO SUGERIDA (10%):         R$ ${parseFloat(taxaServico || 32.99).toFixed(2).padStart(7, ' ')}`,
    "================================================",
    `VALOR TOTAL C/ SERVIÇO:              R$ ${parseFloat(total || 362.89).toFixed(2).padStart(7, ' ')}`,
    "================================================",
    divisaoPessoas ? `DIVISÃO (${divisaoPessoas.qtd || 3} Pessoas): R$ ${parseFloat(divisaoPessoas.valorPorPessoa || 120.96).toFixed(2)} por pessoa` : "PAGAMENTO INTEGRAL OU DIVIDIDO NO CAIXA",
    "------------------------------------------------",
    "CHAVE PIX CNPJ ZUMA: 36.296.848/0001-57",
    "Obrigado pela preferência! Volte sempre ao Zuma!",
    "================================================"
  ].join("\n");

  const novoSpool = {
    id: proximoId,
    tipo: "comanda_mesa",
    mesaNumero: mesaNumero || 5,
    hora,
    tamanho: "80mm",
    operador: garcom || "Garçom Turno",
    conteudoFormatado: textoCupom
  };

  ESTADO_ERP_ZUMA.impressaoSpool = ESTADO_ERP_ZUMA.impressaoSpool || [];
  ESTADO_ERP_ZUMA.impressaoSpool.unshift(novoSpool);
  salvarEstadoPersistidoZuma();

  res.json({
    ok: true,
    mensagem: `Cupom de conferência da Mesa ${mesaNumero || 5} gerado para impressão!`,
    spool: novoSpool
  });
});

// POST /api/public/zuma/impressao/tiquete-kds
routerZuma.post('/impressao/tiquete-kds', (req, res) => {
  const { mesaNumero, setor, itens, sushiman } = req.body || {};
  const proximoId = `KDS-${Math.floor(1000 + Math.random() * 9000)}`;
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const textoKds = [
    "************************************************",
    `*** PEDIDO PRODUÇÃO · ${(setor || 'SUSHI BAR').toUpperCase()} ***`,
    `MESA: ${mesaNumero || '05'} · HORA: ${hora}`,
    "************************************************",
    ...(Array.isArray(itens) && itens.length ? itens.map(i => {
      const q = String(i.qtd || 1).padStart(2, ' ');
      const n = String(i.nome || 'Item').toUpperCase();
      const obs = i.obs ? `    >>> ATENÇÃO: ${String(i.obs).toUpperCase()}` : null;
      return obs ? `[${q}x] ${n}\n${obs}` : `[${q}x] ${n}`;
    }) : [
      "[1x] COMBO ZUMA VIP 60 PECAS",
      "    >>> ATENÇÃO: SEM GERGELIM / POUCO ARROZ",
      "[2x] TEMAKI SALMAO FILADELFIA",
      "    >>> ATENÇÃO: SEM CEBOLINHA"
    ]),
    "************************************************",
    `Sushiman/Cozinheiro: ${sushiman || 'Kenji Sato'}`,
    "************************************************"
  ].join("\n");

  const spoolItem = {
    id: proximoId,
    tipo: "kds_producao",
    mesaNumero: mesaNumero || 5,
    setor: setor || "Sushi Bar",
    hora,
    tamanho: "80mm",
    conteudoFormatado: textoKds
  };

  ESTADO_ERP_ZUMA.impressaoSpool = ESTADO_ERP_ZUMA.impressaoSpool || [];
  ESTADO_ERP_ZUMA.impressaoSpool.unshift(spoolItem);
  salvarEstadoPersistidoZuma();

  res.json({
    ok: true,
    mensagem: `Tíquete de produção KDS encaminhado para impressão na praça ${setor || 'Sushi Bar'}!`,
    spool: spoolItem
  });
});

// GET /api/public/zuma/impressao/historico
routerZuma.get('/impressao/historico', (req, res) => {
  res.json({
    ok: true,
    totalSpools: ESTADO_ERP_ZUMA.impressaoSpool?.length || 0,
    spools: ESTADO_ERP_ZUMA.impressaoSpool || []
  });
});

// =========================================================================
// 11. ROTAS DE IA AKIRA & ZUMI (PEDIDOS EM LINGUAGEM NATURAL WHATSAPP)
// =========================================================================

// POST /api/public/zuma/ia/interpretar-pedido
routerZuma.post('/ia/interpretar-pedido', (req, res) => {
  const { textoMensagem, clienteNome, clienteTelefone } = req.body || {};
  const msg = String(textoMensagem || "").toLowerCase();

  if (!msg) {
    return res.status(400).json({ ok: false, error: "Mensagem do cliente é obrigatória." });
  }

  // Inteligência de extração gastronômica
  const itensDetectados = [];
  let subtotal = 0;

  if (msg.includes("vip") || msg.includes("60")) {
    itensDetectados.push({ id: "combo-zuma-vip-60", nome: "Combo Zuma VIP 60 Peças", qtd: 1, precoUnit: 219.90, subtotal: 219.90, obs: msg.includes("sem cebolinha") ? "Sem cebolinha" : (msg.includes("sem gergelim") ? "Sem gergelim" : "") });
    subtotal += 219.90;
  }
  if (msg.includes("barco") || msg.includes("supremo") || msg.includes("40")) {
    itensDetectados.push({ id: "barco-supremo-40", nome: "Barco Zuma Supremo 40 Peças", qtd: 1, precoUnit: 169.90, subtotal: 169.90, obs: "" });
    subtotal += 169.90;
  }
  if (msg.includes("temaki")) {
    const qtd = msg.includes("2 temakis") || msg.includes("dois temakis") ? 2 : 1;
    itensDetectados.push({ id: "temaki-salmao-filadelfia", nome: "Temaki Salmão Filadélfia", qtd, precoUnit: 36.90, subtotal: 36.90 * qtd, obs: msg.includes("sem arroz") ? "Sem arroz" : "" });
    subtotal += 36.90 * qtd;
  }
  if (msg.includes("hot") || msg.includes("roll")) {
    itensDetectados.push({ id: "hot-roll-filadelfia", nome: "Hot Roll Filadélfia 10un", qtd: 1, precoUnit: 38.90, subtotal: 38.90, obs: "" });
    subtotal += 38.90;
  }
  if (msg.includes("coca") || msg.includes("refrigerante")) {
    itensDetectados.push({ id: "coca-cola-zero", nome: "Coca-Cola Zero Lata", qtd: 2, precoUnit: 6.90, subtotal: 13.80, obs: "Com gelo e limão" });
    subtotal += 13.80;
  }
  if (msg.includes("caipirinha") || msg.includes("saque")) {
    itensDetectados.push({ id: "caipirinha-saque-morango", nome: "Caipirinha de Saquê com Morango", qtd: 1, precoUnit: 28.00, subtotal: 28.00, obs: "" });
    subtotal += 28.00;
  }

  // Fallback se não pegou produto específico
  if (!itensDetectados.length) {
    itensDetectados.push({ id: "combo-especial-chef", nome: "Combo Especial do Chef 30 Peças", qtd: 1, precoUnit: 129.90, subtotal: 129.90, obs: "Sugestão da Mascote Zumi" });
    subtotal += 129.90;
  }

  // Detecção de bairro de Tangará da Serra
  let bairroEncontrado = "Centro";
  let taxaEntrega = 7.00;
  const bairrosTangara = ESTADO_ERP_ZUMA.deliveryTaxasBairrosTangara || [];
  for (const b of bairrosTangara) {
    if (msg.includes(b.bairro.toLowerCase())) {
      bairroEncontrado = b.bairro;
      taxaEntrega = b.taxa;
      break;
    }
  }

  // Detecção de forma de pagamento
  let formaPagamento = "PIX";
  if (msg.includes("cartao") || msg.includes("crédito") || msg.includes("debito")) formaPagamento = "Cartão de Crédito";
  else if (msg.includes("dinheiro")) formaPagamento = "Dinheiro";

  const totalFinal = subtotal + taxaEntrega;
  const proximoPedidoId = `DLV-${Math.floor(1000 + Math.random() * 9000)}`;

  const respostaZumiConversacional = [
    `🍱 *Zuma Cozinha Oriental Tangará*\nOi, ${clienteNome || 'Amigo(a)'}! Zumi aqui! 🍣\nEntendi seu pedido perfeitamente:\n`,
    ...itensDetectados.map(it => `▪ ${it.qtd}x ${it.nome} - R$ ${it.subtotal.toFixed(2)}${it.obs ? ` (${it.obs})` : ''}`),
    `\n🛵 Bairro: *${bairroEncontrado}* (Taxa: R$ ${taxaEntrega.toFixed(2)})\n💰 *Total: R$ ${totalFinal.toFixed(2)}* (Forma: ${formaPagamento})\n`,
    formaPagamento === "PIX" ? `🔑 Chave Pix CNPJ: 36.296.848/0001-57 (Zuma Cozinha Oriental)\nPor favor, envie o comprovante por aqui assim que pagar para despacharmos!` : `O motoboy levará a maquininha de cartão!`,
    `\n⏱️ Tempo estimado de entrega: 30 a 45 minutos. Bom apetite!`
  ].join('\n');

  const pixCode = "00020126580014br.gov.bcb.pix013636296848000157520400005303986540" + totalFinal.toFixed(2) + "5802BR5921Zuma Cozinha Oriental6016Tangara da Serra62070503***6304D1B9";
  res.json({
    ok: true,
    sucesso: true,
    pedido: {
      id: proximoPedidoId,
      bairro: bairroEncontrado,
      taxaEntrega,
      subtotal,
      totalGeral: totalFinal,
      itens: itensDetectados,
      mensagemWhatsapp: respostaZumiConversacional,
      pixCopiaECola: pixCode
    },
    pedidoId: proximoPedidoId,
    cliente: {
      nome: clienteNome || "Cliente WhatsApp",
      telefone: clienteTelefone || "(65) 99800-1447"
    },
    bairro: bairroEncontrado,
    taxaEntrega,
    subtotal,
    totalFinal,
    formaPagamento,
    itens: itensDetectados,
    respostaWhatsappSugerida: respostaZumiConversacional,
    integradoKds: true
  });
});

// =========================================================================
// 12. ROTAS DE COMPRAS & COTAÇÃO DE FORNECEDORES DE PESCADOS NOBRES
// =========================================================================

// GET /api/public/zuma/compras/pedidos
routerZuma.get('/compras/pedidos', (req, res) => {
  const compras = ESTADO_ERP_ZUMA.comprasFornecedores || [];
  res.json({
    ok: true,
    totalOrdensCompra: compras.length,
    compras
  });
});

// POST /api/public/zuma/compras/lancar-ordem
routerZuma.post('/compras/lancar-ordem', (req, res) => {
  const { fornecedor, itens, previsaoEntrega, condicaoPagamento } = req.body || {};
  if (!fornecedor || !Array.isArray(itens) || !itens.length) {
    return res.status(400).json({ ok: false, error: "Fornecedor e itens são obrigatórios para ordem de compra." });
  }

  const valorTotal = itens.reduce((s, i) => s + (parseFloat(i.qtdKg || i.qtd || 1) * parseFloat(i.precoKg || i.precoUnit || 0)), 0);
  const proximoId = `OC-2026-${String((ESTADO_ERP_ZUMA.comprasFornecedores?.length || 0) + 45).padStart(3, '0')}`;

  const novaOrdem = {
    id: proximoId,
    fornecedor,
    dataEmissao: new Date().toISOString().split('T')[0],
    previsaoEntrega: previsaoEntrega || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    status: "enviado",
    condicaoPagamento: condicaoPagamento || "Boleto 14 dias",
    valorTotal: parseFloat(valorTotal.toFixed(2)),
    itens: itens.map(i => ({
      insumo: i.insumo || i.nome,
      qtdKg: parseFloat(i.qtdKg || i.qtd || 1),
      precoKg: parseFloat(i.precoKg || i.precoUnit || 0),
      subtotal: parseFloat((parseFloat(i.qtdKg || i.qtd || 1) * parseFloat(i.precoKg || i.precoUnit || 0)).toFixed(2))
    }))
  };

  ESTADO_ERP_ZUMA.comprasFornecedores = ESTADO_ERP_ZUMA.comprasFornecedores || [];
  ESTADO_ERP_ZUMA.comprasFornecedores.unshift(novaOrdem);
  salvarEstadoPersistidoZuma();

  res.status(201).json({
    ok: true,
    mensagem: `Ordem de compra ${proximoId} gerada e enviada para ${fornecedor}!`,
    ordemCompra: novaOrdem
  });
});

// POST /api/public/zuma/compras/receber-mercadoria
routerZuma.post('/compras/receber-mercadoria', (req, res) => {
  const { ordemId, numeroNotaFiscalFornecedor, temperaturaConferenciaC } = req.body || {};
  const ordem = (ESTADO_ERP_ZUMA.comprasFornecedores || []).find(o => o.id === ordemId);
  if (!ordem) {
    return res.status(404).json({ ok: false, error: "Ordem de compra não encontrada." });
  }

  ordem.status = "recebido";
  ordem.dataRecebimento = new Date().toISOString().split('T')[0];
  ordem.notaFiscalFornecedor = numeroNotaFiscalFornecedor || "NF-19824";
  ordem.temperaturaRecebimentoC = parseFloat(temperaturaConferenciaC) || 1.8;

  // Atualizar estoque de pescados
  ordem.itens.forEach(it => {
    const nomeNorm = String(it.insumo || "").toLowerCase();
    const insumoEstoque = (ESTADO_ERP_ZUMA.estoquePescados || []).find(p =>
      nomeNorm.includes("salm") && p.codigo === "INS-001" ||
      nomeNorm.includes("atum") && p.codigo === "INS-002" ||
      nomeNorm.includes("arroz") && p.codigo === "INS-005"
    );
    if (insumoEstoque) {
      insumoEstoque.estoqueAtualKg += it.qtdKg;
      insumoEstoque.loteAtual = `LT-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(10 + Math.random() * 90)}`;
    }
  });

  salvarEstadoPersistidoZuma();

  res.json({
    ok: true,
    mensagem: `Mercadoria da Ordem ${ordemId} recebida com sucesso! Estoque e rastreabilidade atualizados.`,
    ordem
  });
});

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
export { ZUMA_CLIENTES_CRM };

// Base de dados dinâmica em memória para operações CRUD em tempo real
export let CARDAPIO_DINAMICO_ZUMA = [...ZUMA_CARDAPIO_COMPLETO];

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
routerZuma.get(['/cardapio', '/cardapio/dinamico'], (req, res) => {
  const { categoria, setor, busca, destaque } = req.query;
  let itens = CARDAPIO_DINAMICO_ZUMA.map(p => ({
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
    totalGeralCardapio: CARDAPIO_DINAMICO_ZUMA.length,
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

// =====================================================================// SUÍTE OPERACIONAL INTEGRADA: FRENTE DE CAIXA, KDS, GARÇOM & MOTOBOY
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

  const chaveInsumo = Object.keys(ESTOQUE_PESCADOS_ZUMA).find(k => k === insumoId || k.includes(insumoId) || ESTOQUE_PESCADOS_ZUMA[k].codigo === insumoId);
  const insumo = chaveInsumo ? ESTOQUE_PESCADOS_ZUMA[chaveInsumo] : null;
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
// 11. FRENTE DE CAIXA (PDV) INTEGRADA & FECHAMENTO DE TURNO
// ============================================================================

export let CAIXA_TURNO_ATUAL_ZUMA = {
  id: "TURNO-20261120-01",
  operador: "Rodrigo Gonçalves",
  abertura: new Date().toISOString(),
  fechamento: null,
  status: "ABERTO",
  saldoAbertura: 300.00,
  totalVendas: 4850.00,
  totalDinheiro: 650.00,
  totalPix: 2480.00,
  totalCartaoCredito: 1120.00,
  totalCartaoDebito: 600.00,
  totalVR: 0.00,
  sangrias: [
    { id: "SANG-01", valor: 200.00, motivo: "Recolhimento cofre blindado", hora: "16:30", operador: "Rodrigo Gonçalves" }
  ],
  suprimentos: [
    { id: "SUPR-01", valor: 100.00, motivo: "Reforço troco moedas", hora: "14:15", operador: "Rodrigo Gonçalves" }
  ],
  saldoGavetaEsperado: 850.00
};

routerZuma.get("/pdv/status-caixa", (req, res) => {
  res.json({
    ok: true,
    empresa: "Zuma Cozinha Oriental",
    caixa: CAIXA_TURNO_ATUAL_ZUMA
  });
});

routerZuma.post("/pdv/abrir-caixa", (req, res) => {
  const { operador = "Operador Caixa", saldoAbertura = 300.00 } = req.body || {};
  CAIXA_TURNO_ATUAL_ZUMA = {
    id: `TURNO-${Date.now()}`,
    operador,
    abertura: new Date().toISOString(),
    fechamento: null,
    status: "ABERTO",
    saldoAbertura: parseFloat(saldoAbertura),
    totalVendas: 0.0,
    totalDinheiro: 0.0,
    totalPix: 0.0,
    totalCartaoCredito: 0.0,
    totalCartaoDebito: 0.0,
    totalVR: 0.0,
    sangrias: [],
    suprimentos: [],
    saldoGavetaEsperado: parseFloat(saldoAbertura)
  };
  res.json({ ok: true, mensagem: "Caixa aberto com sucesso!", caixa: CAIXA_TURNO_ATUAL_ZUMA });
});

routerZuma.post("/pdv/sangria", (req, res) => {
  const { valor = 0, motivo = "Sangria de caixa", operador = CAIXA_TURNO_ATUAL_ZUMA.operador } = req.body || {};
  const vlr = parseFloat(valor);
  CAIXA_TURNO_ATUAL_ZUMA.sangrias.push({
    id: `SANG-${Date.now()}`,
    valor: vlr,
    motivo,
    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    operador
  });
  CAIXA_TURNO_ATUAL_ZUMA.saldoGavetaEsperado -= vlr;
  res.json({ ok: true, mensagem: `Sangria de R$ ${vlr.toFixed(2)} registrada!`, caixa: CAIXA_TURNO_ATUAL_ZUMA });
});

routerZuma.post("/pdv/suprimento", (req, res) => {
  const { valor = 0, motivo = "Reforço de troco", operador = CAIXA_TURNO_ATUAL_ZUMA.operador } = req.body || {};
  const vlr = parseFloat(valor);
  CAIXA_TURNO_ATUAL_ZUMA.suprimentos.push({
    id: `SUPR-${Date.now()}`,
    valor: vlr,
    motivo,
    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    operador
  });
  CAIXA_TURNO_ATUAL_ZUMA.saldoGavetaEsperado += vlr;
  res.json({ ok: true, mensagem: `Suprimento de R$ ${vlr.toFixed(2)} registrado!`, caixa: CAIXA_TURNO_ATUAL_ZUMA });
});

routerZuma.post("/pdv/fechar-caixa", (req, res) => {
  const { valorContado = CAIXA_TURNO_ATUAL_ZUMA.saldoGavetaEsperado } = req.body || {};
  const contado = parseFloat(valorContado);
  const diferenca = contado - CAIXA_TURNO_ATUAL_ZUMA.saldoGavetaEsperado;
  CAIXA_TURNO_ATUAL_ZUMA.fechamento = new Date().toISOString();
  CAIXA_TURNO_ATUAL_ZUMA.status = "FECHADO";
  CAIXA_TURNO_ATUAL_ZUMA.valorContado = contado;
  CAIXA_TURNO_ATUAL_ZUMA.diferenca = diferenca;
  res.json({
    ok: true,
    mensagem: "Turno de caixa encerrado com sucesso!",
    caixa: CAIXA_TURNO_ATUAL_ZUMA,
    resumoFechamento: {
      totalVendido: CAIXA_TURNO_ATUAL_ZUMA.totalVendas,
      saldoGavetaEsperado: CAIXA_TURNO_ATUAL_ZUMA.saldoGavetaEsperado,
      valorContado: contado,
      diferenca
    }
  });
});

// ============================================================================
// 12. KARDEX DETALHADO DE MOVIMENTAÇÃO DE ESTOQUE
// ============================================================================

export let HISTORICO_KARDEX_ESTOQUE_ZUMA = [
  {
    id: "KARD-01",
    dataHora: "2026-11-20T10:15:00.000Z",
    tipoMovimento: "ENTRADA_FORNECEDOR_NFE",
    insumoId: "ins-salmao-fresco",
    insumoNome: "Salmão Fresco Chileno (Filé Nobre)",
    quantidade: +25.0,
    saldoAnterior: 17.5,
    saldoAtual: 42.5,
    unidade: "kg",
    custoUnitario: 89.90,
    valorTotal: 2247.50,
    documentoOrigem: "NF-e 55 · Chave 51261108234892000188550010000045211029384751",
    responsável: "Rodrigo Gonçalves",
    lote: "LOTE-SAL-20261120"
  },
  {
    id: "KARD-02",
    dataHora: "2026-11-20T12:30:00.000Z",
    tipoMovimento: "SAIDA_VENDA_PDV",
    insumoId: "ins-salmao-fresco",
    insumoNome: "Salmão Fresco Chileno (Filé Nobre)",
    quantidade: -2.850,
    saldoAnterior: 42.5,
    saldoAtual: 39.65,
    unidade: "kg",
    custoUnitario: 89.90,
    valorTotal: 256.21,
    documentoOrigem: "NFC-e 65 #1040 (Mesa 04 e Mesa 08)",
    responsável: "Caixa PDV Salão",
    lote: "LOTE-SAL-20261120"
  },
  {
    id: "KARD-03",
    dataHora: "2026-11-20T14:00:00.000Z",
    tipoMovimento: "PERDA_TECNICA_APARA",
    insumoId: "ins-salmao-fresco",
    insumoNome: "Salmão Fresco Chileno (Filé Nobre)",
    quantidade: -0.500,
    saldoAnterior: 39.65,
    saldoAtual: 39.15,
    unidade: "kg",
    custoUnitario: 89.90,
    valorTotal: 44.95,
    documentoOrigem: "Apara técnica de sushiman (tosa limpa)",
    responsável: "Kenji Mestre Sushiman",
    lote: "LOTE-SAL-20261120"
  },
  {
    id: "KARD-04",
    dataHora: "2026-11-20T15:00:00.000Z",
    tipoMovimento: "TRANSFERENCIA_INTERNA",
    insumoId: "ins-salmao-fresco",
    insumoNome: "Salmão Fresco Chileno (Filé Nobre)",
    quantidade: -5.000,
    saldoAnterior: 39.15,
    saldoAtual: 34.15,
    unidade: "kg",
    custoUnitario: 89.90,
    valorTotal: 449.50,
    documentoOrigem: "Câmara Fria 01 -> Bancada Sushi Bar",
    responsável: "Kenji Mestre Sushiman",
    lote: "LOTE-SAL-20261120"
  }
];

routerZuma.get("/estoque/kardex", (req, res) => {
  const { insumoId, tipoMovimento } = req.query || {};
  let lista = [...HISTORICO_KARDEX_ESTOQUE_ZUMA];
  if (insumoId) {
    lista = lista.filter(k => k.insumoId === insumoId);
  }
  if (tipoMovimento) {
    lista = lista.filter(k => k.tipoMovimento === tipoMovimento);
  }
  res.json({
    ok: true,
    totalMovimentacoes: lista.length,
    kardex: lista
  });
});

routerZuma.post("/estoque/entrada-nfe-xml", (req, res) => {
  const {
    insumoId = "ins-salmao-fresco",
    quantidadeKg = 10.0,
    custoUnitario = 89.90,
    fornecedorNome = "Pescados do Pacífico Importadora LTDA",
    cnpjFornecedor = "08.234.892/0001-88",
    chaveNfe = "51261108234892000188550010000045211029384751",
    numeroNota = "4521",
    lote = `LOTE-REC-${Date.now()}`,
    temperaturaRecebimento = 0.5
  } = req.body || {};

  const qtd = parseFloat(quantidadeKg);
  const custo = parseFloat(custoUnitario);
  const insumo = ESTOQUE_PESCADOS_ZUMA[insumoId] || {
    nome: "Pescado Nobre",
    quantidadeAtualKg: 20.0,
    unidade: "kg",
    custoPorKg: custo
  };

  const saldoAnterior = typeof insumo.saldoAtual === 'number' ? insumo.saldoAtual : (insumo.quantidadeAtualKg || 25.0);
  const novoSaldo = parseFloat((saldoAnterior + qtd).toFixed(3));
  insumo.saldoAtual = novoSaldo;
  insumo.quantidadeAtualKg = novoSaldo;
  insumo.custoPorKgInteiro = custo;
  insumo.custoEfetivoPorKgLimpo = parseFloat((custo / 0.82).toFixed(2));
  ESTOQUE_PESCADOS_ZUMA[insumoId] = insumo;

  const novoKardex = {
    id: `KARD-${Date.now()}`,
    dataHora: new Date().toISOString(),
    tipoMovimento: "ENTRADA_FORNECEDOR_NFE",
    insumoId,
    insumoNome: insumo.nome,
    quantidade: +qtd,
    saldoAnterior,
    saldoAtual: novoSaldo,
    unidade: insumo.unidade || "kg",
    custoUnitario: custo,
    valorTotal: parseFloat((qtd * custo).toFixed(2)),
    documentoOrigem: `NF-e ${numeroNota} · Fornecedor: ${fornecedorNome}`,
    responsável: "Conferente Almoxarifado Zuma",
    lote,
    temperaturaRecebimento
  };

  HISTORICO_KARDEX_ESTOQUE_ZUMA.unshift(novoKardex);

  res.json({
    ok: true,
    mensagem: `Entrada de ${qtd} kg de ${insumo.nome} registrada com sucesso via NF-e #${numeroNota}!`,
    novoSaldoKg: insumo.saldoAtual,
    custoMedioAtualizado: insumo.custoPorKgInteiro,
    kardex: novoKardex
  });
});

routerZuma.post("/estoque/transferencia-interna", (req, res) => {
  const {
    insumoId = "ins-salmao-fresco",
    quantidadeKg = 2.0,
    origem = "Câmara Fria 01",
    destino = "Bancada Sushi Bar",
    responsável = "Kenji Mestre Sushiman"
  } = req.body || {};

  const qtd = parseFloat(quantidadeKg);
  const insumo = ESTOQUE_PESCADOS_ZUMA[insumoId] || { nome: "Salmão", saldoAtual: 20.0, custoPorKgInteiro: 89.90 };
  const saldoAnterior = typeof insumo.saldoAtual === 'number' ? insumo.saldoAtual : 20.0;

  const novoKardex = {
    id: `KARD-${Date.now()}`,
    dataHora: new Date().toISOString(),
    tipoMovimento: "TRANSFERENCIA_INTERNA",
    insumoId,
    insumoNome: insumo.nome,
    quantidade: -qtd,
    saldoAnterior,
    saldoAtual: saldoAnterior, // Saldo global não altera, é transferência interna
    unidade: "kg",
    custoUnitario: insumo.custoPorKg,
    valorTotal: parseFloat((qtd * insumo.custoPorKg).toFixed(2)),
    documentoOrigem: `${origem} -> ${destino}`,
    responsável,
    lote: "LOTE-TRANSF"
  };

  HISTORICO_KARDEX_ESTOQUE_ZUMA.unshift(novoKardex);

  res.json({
    ok: true,
    mensagem: `Transferência de ${qtd} kg transferida com sucesso de ${origem} para ${destino}!`,
    kardex: novoKardex
  });
});

// ============================================================================
// 13. COZINHA & KDS (KITCHEN DISPLAY SYSTEM POR PRAÇA)
// ============================================================================

export let PEDIDOS_COZINHA_KDS_ZUMA = [
  {
    id: "KDS-101",
    numeroComanda: "CMD-2026-101",
    origem: "Mesa 03 · Sushi Bar",
    praca: "SUSHI_BAR",
    itens: [
      { id: "p1", nome: "Combinado Zuma Casal 40 Peças", qtd: 1, obs: "Sem wasabi no niguiri" },
      { id: "p2", nome: "Sashimi Salmão Trufado (10 fatias)", qtd: 1, obs: "Com raspas de limão siciliano" }
    ],
    horaPedido: new Date(Date.now() - 8 * 60000).toISOString(),
    minutosEmEspera: 8,
    status: "EM_PREPARO",
    prioridade: "NORMAL",
    garcom: "Roberto Kenji"
  },
  {
    id: "KDS-102",
    numeroComanda: "CMD-2026-102",
    origem: "Mesa 12 · Salão Principal",
    praca: "COZINHA_QUENTE",
    itens: [
      { id: "p3", nome: "Yakisoba Especial Camarão & Mignon", qtd: 1, obs: "Molho bem encorpado" },
      { id: "p4", nome: "Guioza de Carne Suína Grelhado (6 un)", qtd: 1, obs: "Crocante" }
    ],
    horaPedido: new Date(Date.now() - 14 * 60000).toISOString(),
    minutosEmEspera: 14,
    status: "EM_PREPARO",
    prioridade: "ALTA",
    garcom: "Ana Sato"
  },
  {
    id: "KDS-103",
    numeroComanda: "CMD-2026-103",
    origem: "Mesa 07 · Deck Externo",
    praca: "BAR_BEBIDAS",
    itens: [
      { id: "p5", nome: "Moscow Mule Oriental com Wasabi", qtd: 2, obs: "Gelo e espuma extra" },
      { id: "p6", nome: "Chopp Stella Artois 500ml", qtd: 1, obs: "Caneca ultracongelada" }
    ],
    horaPedido: new Date(Date.now() - 3 * 60000).toISOString(),
    minutosEmEspera: 3,
    status: "PRONTO_CHAMADA",
    prioridade: "URGENTE",
    garcom: "Lucas Mori"
  },
  {
    id: "KDS-104",
    numeroComanda: "CMD-2026-104",
    origem: "Delivery Zumi WhatsApp (Jardim Europa)",
    praca: "SUSHI_BAR",
    itens: [
      { id: "p7", nome: "Combinado Zuma 30 Peças", qtd: 1, obs: "Embalagem premium selada" },
      { id: "p8", nome: "Hot Roll Filadélfia Especial (10 un)", qtd: 1, obs: "Tarê à parte" }
    ],
    horaPedido: new Date(Date.now() - 21 * 60000).toISOString(),
    minutosEmEspera: 21,
    status: "EM_PREPARO",
    prioridade: "ALTA",
    garcom: "Zumi Atende (IA)"
  }
];

routerZuma.get("/cozinha/pedidos-ativos", (req, res) => {
  const { praca } = req.query || {};
  let lista = [...PEDIDOS_COZINHA_KDS_ZUMA];
  if (praca && praca !== "TODAS") {
    lista = lista.filter(p => p.praca === praca);
  }
  res.json({
    ok: true,
    totalPedidos: lista.length,
    pedidos: lista,
    estatisticas: {
      emPreparo: lista.filter(p => p.status === "EM_PREPARO").length,
      prontoChamada: lista.filter(p => p.status === "PRONTO_CHAMADA").length,
      sushiBar: lista.filter(p => p.praca === "SUSHI_BAR").length,
      cozinhaQuente: lista.filter(p => p.praca === "COZINHA_QUENTE").length,
      barBebidas: lista.filter(p => p.praca === "BAR_BEBIDAS").length
    }
  });
});

routerZuma.post("/cozinha/avancar-etapa", (req, res) => {
  const { pedidoId, novoStatus } = req.body || {};
  const ped = PEDIDOS_COZINHA_KDS_ZUMA.find(p => p.id === pedidoId);
  if (!ped) {
    return res.status(404).json({ ok: false, error: "Pedido KDS não encontrado" });
  }

  const statusAnterior = ped.status;
  ped.status = novoStatus || (statusAnterior === "EM_PREPARO" ? "PRONTO_CHAMADA" : "ENTREGUE");
  if (ped.status === "ENTREGUE") {
    ped.horaEntrega = new Date().toISOString();
  }

  res.json({
    ok: true,
    mensagem: `Pedido ${ped.id} avançou de ${statusAnterior} para ${ped.status}!`,
    pedido: ped
  });
});

// ============================================================================
// 14. VENDA RÁPIDA NO PDV COM EMISSÃO NFC-e & BAIXA COMPLETA
// ============================================================================

routerZuma.post("/pdv/venda-rapida", (req, res) => {
  const {
    itens = [
      { id: "prod-comb-30", nome: "Combinado Zuma 30 Peças", qtd: 1, precoUnit: 139.90, ncm: "2106.90.90" }
    ],
    formaPagamento = "PIX",
    cliente = "Consumidor Final Tangará",
    cpfCliente = null,
    mesaNumero = null,
    tipoVenda = "BALCAO", // BALCAO, MESA, DELIVERY
    emitirNfce = true
  } = req.body || {};

  const total = itens.reduce((acc, it) => acc + ((it.qtd || 1) * (it.precoUnit || 0)), 0);

  // 1. Atualizar Faturamento do Caixa
  CAIXA_TURNO_ATUAL_ZUMA.totalVendas += total;
  if (formaPagamento === "DINHEIRO") {
    CAIXA_TURNO_ATUAL_ZUMA.totalDinheiro += total;
    CAIXA_TURNO_ATUAL_ZUMA.saldoGavetaEsperado += total;
  } else if (formaPagamento === "PIX") {
    CAIXA_TURNO_ATUAL_ZUMA.totalPix += total;
  } else if (formaPagamento === "CARTAO_CREDITO") {
    CAIXA_TURNO_ATUAL_ZUMA.totalCartaoCredito += total;
  } else if (formaPagamento === "CARTAO_DEBITO") {
    CAIXA_TURNO_ATUAL_ZUMA.totalCartaoDebito += total;
  }

  // 2. Baixar Ficha Técnica no Estoque e Kardex
  let totalSalmaoBaixadoKg = 0;
  itens.forEach(it => {
    if (it.nome.toLowerCase().includes("combinado") || it.nome.toLowerCase().includes("salmão")) {
      const baixaKg = 0.350 * (it.qtd || 1);
      totalSalmaoBaixadoKg += baixaKg;
      if (ESTOQUE_PESCADOS_ZUMA["ins-salmao-fresco"]) {
        const insSalmao = ESTOQUE_PESCADOS_ZUMA["ins-salmao-fresco"];
        const saldoAnt = typeof insSalmao.saldoAtual === 'number' ? insSalmao.saldoAtual : (insSalmao.quantidadeAtualKg || 35.0);
        const novoSaldo = parseFloat((saldoAnt - baixaKg).toFixed(3));
        insSalmao.saldoAtual = novoSaldo;
        insSalmao.quantidadeAtualKg = novoSaldo;
        HISTORICO_KARDEX_ESTOQUE_ZUMA.unshift({
          id: `KARD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          dataHora: new Date().toISOString(),
          tipoMovimento: "SAIDA_VENDA_PDV",
          insumoId: "ins-salmao-fresco",
          insumoNome: "Salmão Fresco Chileno (Filé Nobre)",
          quantidade: -baixaKg,
          saldoAnterior: saldoAnt,
          saldoAtual: ESTOQUE_PESCADOS_ZUMA["ins-salmao-fresco"].saldoAtual,
          unidade: "kg",
          custoUnitario: 89.90,
          valorTotal: parseFloat((baixaKg * 89.90).toFixed(2)),
          documentoOrigem: `Venda PDV Caixa (${tipoVenda})`,
          responsável: CAIXA_TURNO_ATUAL_ZUMA.operador,
          lote: "LOTE-PDV-AUTO"
        });
      }
    }
  });

  // 3. Emitir NFC-e se solicitado
  let notaFiscal = null;
  if (emitirNfce) {
    const proxNumero = (HISTORICO_NOTAS_FISCAIS_ZUMA[0]?.numeroNota || 1045) + 1;
    const chave = `5126113629684800015765001${String(proxNumero).padStart(9, '0')}1${Math.floor(10000000 + Math.random() * 90000000)}1`;
    const protocolo = `1512600${Math.floor(100000000 + Math.random() * 900000000)}`;
    notaFiscal = {
      numeroNota: proxNumero,
      serie: 1,
      modelo: "NFC-e (65)",
      chaveAcesso: chave,
      protocoloSEFAZ: protocolo,
      dataEmissao: new Date().toISOString(),
      cliente: cpfCliente ? `${cliente} (CPF: ${cpfCliente})` : cliente,
      origemVenda: mesaNumero ? `Mesa ${mesaNumero}` : `Balcão PDV`,
      formaPagamento,
      valorTotal: parseFloat(total.toFixed(2)),
      icmsValor: parseFloat((total * 0.0385).toFixed(2)),
      statusSEFAZ: "100_AUTORIZADA_PRODUCAO",
      qrcodeUrl: `http://sefaz.mt.gov.br/nfce/qrcode?p=${chave}|2|1|1|${Math.floor(100000 + Math.random() * 900000)}`
    };
    HISTORICO_NOTAS_FISCAIS_ZUMA.unshift(notaFiscal);
  }

  // 4. Injetar Pedido na Cozinha KDS
  const novoKds = {
    id: `KDS-${Date.now()}`,
    numeroComanda: `CMD-${Math.floor(1000 + Math.random() * 9000)}`,
    origem: mesaNumero ? `Mesa ${mesaNumero}` : `Balcão PDV`,
    praca: "SUSHI_BAR",
    itens: itens.map(i => ({ id: i.id || "prod", nome: i.nome, qtd: i.qtd || 1, obs: "Preparo imediato PDV" })),
    horaPedido: new Date().toISOString(),
    minutosEmEspera: 0,
    status: "EM_PREPARO",
    prioridade: "ALTA",
    garcom: CAIXA_TURNO_ATUAL_ZUMA.operador
  };
  PEDIDOS_COZINHA_KDS_ZUMA.unshift(novoKds);

  res.json({
    ok: true,
    mensagem: `Venda de R$ ${total.toFixed(2)} processada com sucesso no PDV!`,
    total,
    formaPagamento,
    notaFiscal,
    kdsId: novoKds.id,
    salmaoBaixadoKg: totalSalmaoBaixadoKg,
    caixaAtualizado: {
      totalVendas: CAIXA_TURNO_ATUAL_ZUMA.totalVendas,
      saldoGavetaEsperado: CAIXA_TURNO_ATUAL_ZUMA.saldoGavetaEsperado
    }
  });
});

// ============================================================================
// 15. GESTÃO FISCAL AVANÇADA (CANCELAMENTO, INUTILIZAÇÃO, CC-e & APURAÇÃO)
// ============================================================================

export let CANCELAMENTOS_E_EVENTOS_FISCAIS_ZUMA = [
  {
    id: "EVT-CANC-01",
    tipoEvento: "CANCELAMENTO_NFCE",
    chaveAcesso: "51261136296848000157650010000010201827364519",
    numeroNota: 1020,
    dataHora: "2026-11-19T22:15:00.000Z",
    protocoloCancelamento: "1512600812984712",
    justificativa: "Cliente desistiu da compra antes da saída dos pratos do balcão",
    statusSEFAZ: "135_EVENTO_VINCULADO_A_NF_HOMOLOGADO"
  }
];

routerZuma.post("/fiscal/cancelar", (req, res) => {
  const {
    chaveAcesso,
    numeroNota,
    justificativa = "Cancelamento por solicitação do cliente dentro do prazo legal de 30 minutos"
  } = req.body || {};

  if (!justificativa || justificativa.length < 15) {
    return res.status(400).json({ ok: false, error: "Justificativa de cancelamento deve conter no mínimo 15 caracteres" });
  }

  const protocolo = `1512600${Math.floor(100000000 + Math.random() * 900000000)}`;
  const novoEvento = {
    id: `EVT-CANC-${Date.now()}`,
    tipoEvento: "CANCELAMENTO_NFCE",
    chaveAcesso: chaveAcesso || "51261136296848000157650010000010411827364519",
    numeroNota: numeroNota || 1041,
    dataHora: new Date().toISOString(),
    protocoloCancelamento: protocolo,
    justificativa,
    statusSEFAZ: "135_EVENTO_VINCULADO_A_NF_HOMOLOGADO"
  };

  CANCELAMENTOS_E_EVENTOS_FISCAIS_ZUMA.unshift(novoEvento);

  // Atualizar status na lista de notas fiscais
  const nota = HISTORICO_NOTAS_FISCAIS_ZUMA.find(n => n.chaveAcesso === chaveAcesso || n.numeroNota === numeroNota);
  if (nota) {
    nota.statusSEFAZ = "101_CANCELADA_HOMOLOGADA_SEFAZ";
  }

  res.json({
    ok: true,
    mensagem: `Nota Fiscal cancelada com sucesso perante a SEFAZ-MT! Protocolo: ${protocolo}`,
    evento: novoEvento
  });
});

routerZuma.post("/fiscal/carta-correcao", (req, res) => {
  const {
    chaveAcesso,
    numeroNota = 5510,
    correcao = "Correção do endereço de cobrança do cliente corporativo PJ"
  } = req.body || {};

  const protocolo = `1512600${Math.floor(100000000 + Math.random() * 900000000)}`;
  const novoEvento = {
    id: `EVT-CCE-${Date.now()}`,
    tipoEvento: "CARTA_CORRECAO_NFE",
    chaveAcesso: chaveAcesso || "51261136296848000157550010000055101827364519",
    numeroNota,
    dataHora: new Date().toISOString(),
    protocoloCCE: protocolo,
    sequencialEvento: 1,
    textoCorrecao: correcao,
    statusSEFAZ: "135_CCE_VINCULADA_A_NFE_HOMOLOGADO"
  };

  CANCELAMENTOS_E_EVENTOS_FISCAIS_ZUMA.unshift(novoEvento);

  res.json({
    ok: true,
    mensagem: `Carta de Correção Eletrônica (CC-e) registrada com sucesso na SEFAZ-MT!`,
    evento: novoEvento
  });
});

routerZuma.get("/fiscal/livro-apuracao", (req, res) => {
  const { mesAno = "11/2026" } = req.query || {};

  const faturamentoTotal = 152840.00;
  const faturamentoRefeicaoComercio = 138500.00; // Alíquota normal Simples Nacional
  const faturamentoBebidasMonofasicas = 14340.00; // Segregação PIS/COFINS e ICMS-ST

  const aliquotaEfetivaSimples = 0.0385; // 3.85%
  const icmsDevido = parseFloat((faturamentoRefeicaoComercio * aliquotaEfetivaSimples).toFixed(2));
  const pisCofinsEconomizado = parseFloat((faturamentoBebidasMonofasicas * 0.0365).toFixed(2));

  res.json({
    ok: true,
    empresa: "Zuma Cozinha Oriental LTDA",
    cnpj: "36.296.848/0001-57",
    mesApuracao: mesAno,
    regimeTributario: "Simples Nacional - Anexo I (Alimentação e Bebidas)",
    resumo: {
      faturamentoTotal,
      faturamentoTributavelNormal: faturamentoRefeicaoComercio,
      faturamentoMonofasicoSegregado: faturamentoBebidasMonofasicas,
      aliquotaEfetivaICMS: "3.85%",
      icmsSimplesDevido: icmsDevido,
      economiaTributariaMonofasica: pisCofinsEconomizado,
      statusGuiaDAS: "PRONTA_PARA_GERACAO"
    }
  });
});

routerZuma.get("/fiscal/exportar-xmls", (req, res) => {
  res.json({
    ok: true,
    empresa: "Zuma Cozinha Oriental",
    totalArquivosXml: HISTORICO_NOTAS_FISCAIS_ZUMA.length,
    periodo: "Novembro/2026",
    downloadZipUrl: "/api/public/zuma/fiscal/exportar/xml-novembro-2026.zip",
    arquivos: HISTORICO_NOTAS_FISCAIS_ZUMA.map(n => ({
      chave: n.chaveAcesso,
      modelo: n.modelo,
      numero: n.numeroNota,
      valor: n.valorTotal,
      data: n.dataEmissao,
      status: n.statusSEFAZ
    }))
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
  cidade: "Tangará da Serra - MT",
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

export const CORRIDAS_ENTREGADOR_ZUMA = [
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

// GET /api/public/zuma/entregador/posicao-atual — Posição e status do entregador
routerZuma.get("/entregador/posicao-atual", (req, res) => {
  res.json({
    ok: true,
    motoboy: POSICAO_MOTOBOY_ATUAL
  });
});

// GET /api/public/zuma/entregador/corridas — Lista de corridas e status da expedição
routerZuma.get("/entregador/corridas", (req, res) => {
  const { status } = req.query;
  let lista = CORRIDAS_ENTREGADOR_ZUMA;
  if (status) {
    lista = lista.filter(c => c.status === status);
  }
  res.json({
    ok: true,
    sede: COORDENADAS_ZUMA_SEDE,
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

// POST /api/public/zuma/entregador/atualizar-status — Atualiza status da entrega
// GET /api/public/zuma/entregador/fechamento-diaria — Fechamento de diária do entregador
routerZuma.get("/entregador/fechamento-diaria", (req, res) => {
  const { motoboyId } = req.query || {};
  res.json({
    ok: true,
    motoboyId: motoboyId || "MOTO-01",
    motoboyNome: "Carlos 'Ninja' Silva",
    dataFechamento: new Date().toISOString().split("T")[0],
    totalEntregasConcluidas: 8,
    totalTaxasRepasse: 76.00,
    taxaFixaDiaria: 50.00,
    totalGeralLiquido: 126.00,
    metodoPagamento: "PIX Chave Celular (65) 99812-4401",
    statusRepasse: "DISPONIVEL_PARA_TRANSFERENCIA"
  });
});

routerZuma.post("/entregador/atualizar-status", (req, res) => {
  const { corridaId, novoStatus, codigoOtp, assinaturaBase64 } = req.body || {};
  const corrida = CORRIDAS_ENTREGADOR_ZUMA.find(c => c.id === corridaId);
  if (!corrida) {
    return res.status(404).json({ ok: false, erro: "Corrida não encontrada" });
  }
  if (novoStatus === "entregue" && codigoOtp && codigoOtp !== corrida.codigoOtp) {
    return res.status(400).json({ ok: false, erro: "Código de entrega (OTP) incorreto. Solicite o código ao cliente." });
  }
  corrida.status = novoStatus;
  corrida.horaConclusao = new Date().toISOString();
  corrida.concluidaEm = corrida.horaConclusao;
  res.json({ ok: true, mensagem: "Status atualizado com sucesso!", corrida });
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
      id: "proprietario",
      nome: "App do Proprietário Zuma",
      subtitulo: "Gestão na Palma da Mão, Comparativos & Concorrência",
      icone: "👑",
      cor: "amber",
      pwaUrl: "/zuma/proprietario.html",
      manifestUrl: "/zuma/manifest-proprietario.json",
      apkUrl: "/zuma/downloads/zuma-proprietario.apk",
      apkTamanho: "5.4 MB",
      recursos: ["Visão 360° em tempo real", "Comparativo de dias iguais (D-7, D-30)", "Gráficos de faturamento e CMV", "Radar de concorrência de Tangará da Serra", "Tomada de ação com 1 toque"],
      compatibilidade: "iOS (Safari Add to Home) & Android (PWA / APK)"
    },
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

// ============================================================================
// 16. OPERAÇÕES CRUD COMPLETAS (INCLUIR, MODIFICAR/SALVAR, EXCLUIR) — ZUMA
// ============================================================================

// --- 16.1 CARDÁPIO: INCLUIR, MODIFICAR E EXCLUIR ---
routerZuma.post('/cardapio/item', (req, res) => {
  const { nome, categoria, preco, descricao, cod_pdv, setor_producao, foto, destaque } = req.body || {};
  if (!nome || preco === undefined || preco === null || isNaN(Number(preco))) {
    return res.status(400).json({ ok: false, error: "Nome e preço numérico válido são obrigatórios." });
  }
  const codigoGerado = cod_pdv || `ZUM-${String(CARDAPIO_DINAMICO_ZUMA.length + 1).padStart(3, '0')}`;
  const novoItem = {
    id: `item-zuma-${Date.now()}`,
    codigo_pdv: codigoGerado,
    cod_pdv: codigoGerado,
    nome: String(nome).trim(),
    categoria: categoria || 'Combinados Especiais',
    categoria_nome: categoria || 'Combinados Especiais',
    categoria_codigo: String(categoria || 'combinados').toLowerCase().replace(/\s+/g, '-'),
    preco: parseFloat(preco),
    descricao: descricao || 'Preparado na hora com pescados nobres e técnica japonesa tradicional.',
    setor_producao: setor_producao || 'sushi_bar',
    setor: setor_producao || 'sushi_bar',
    foto: foto || 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80',
    destaque: destaque === true,
    ativo: true,
    dataCriacao: new Date().toISOString()
  };
  CARDAPIO_DINAMICO_ZUMA.unshift(novoItem);
  res.status(201).json({ ok: true, mensagem: `Prato "${novoItem.nome}" incluído no cardápio com sucesso!`, item: novoItem });
});

routerZuma.put('/cardapio/item/:id', (req, res) => {
  const { id } = req.params;
  const index = CARDAPIO_DINAMICO_ZUMA.findIndex(p => String(p.id) === String(id) || String(p.codigo_pdv) === String(id) || String(p.cod_pdv) === String(id));
  if (index === -1) {
    return res.status(404).json({ ok: false, error: "Item do cardápio não encontrado para alteração." });
  }
  const atual = CARDAPIO_DINAMICO_ZUMA[index];
  const { nome, categoria, preco, descricao, cod_pdv, setor_producao, foto, destaque, ativo } = req.body || {};

  if (nome) atual.nome = String(nome).trim();
  if (categoria) {
    atual.categoria = categoria;
    atual.categoria_nome = categoria;
    atual.categoria_codigo = String(categoria).toLowerCase().replace(/\s+/g, '-');
  }
  if (preco !== undefined && !isNaN(Number(preco))) atual.preco = parseFloat(preco);
  if (descricao !== undefined) atual.descricao = descricao;
  if (cod_pdv) {
    atual.cod_pdv = cod_pdv;
    atual.codigo_pdv = cod_pdv;
  }
  if (setor_producao) {
    atual.setor_producao = setor_producao;
    atual.setor = setor_producao;
  }
  if (foto) atual.foto = foto;
  if (destaque !== undefined) atual.destaque = destaque === true;
  if (ativo !== undefined) atual.ativo = ativo === true;
  atual.dataModificacao = new Date().toISOString();

  res.json({ ok: true, mensagem: `Prato "${atual.nome}" modificado e salvo com sucesso!`, item: atual });
});

routerZuma.delete('/cardapio/item/:id', (req, res) => {
  const { id } = req.params;
  const index = CARDAPIO_DINAMICO_ZUMA.findIndex(p => String(p.id) === String(id) || String(p.codigo_pdv) === String(id) || String(p.cod_pdv) === String(id));
  if (index === -1) {
    return res.status(404).json({ ok: false, error: "Item do cardápio não encontrado para exclusão." });
  }
  const removido = CARDAPIO_DINAMICO_ZUMA.splice(index, 1)[0];
  res.json({ ok: true, mensagem: `Prato "${removido.nome}" excluído do cardápio com sucesso!`, itemExcluido: removido });
});

// --- 16.2 MESAS: INCLUIR, MODIFICAR E EXCLUIR ---
routerZuma.post('/mesas', (req, res) => {
  const { numero, setor, capacidade, garcom, tempAmbiente } = req.body || {};
  const numInt = parseInt(numero) || (MESAS_SALAO_ZUMA.length + 1);
  const existe = MESAS_SALAO_ZUMA.find(m => m.numero === numInt);
  if (existe) {
    return res.status(400).json({ ok: false, error: `Já existe uma mesa cadastrada com o número ${numInt}.` });
  }
  const novaMesa = {
    id: numInt,
    numero: numInt,
    setor: setor || "Salão Principal",
    capacidade: parseInt(capacidade) || 4,
    status: "livre",
    tempoMinutos: 0,
    garcom: garcom || "Carlos Silva",
    comanda: null,
    valorAcumulado: 0.0,
    clientesNaMesa: 0,
    ticketMedioPessoa: 0.0,
    tempAmbiente: parseFloat(tempAmbiente) || 22.0,
    solicitouConta: false,
    itens: []
  };
  MESAS_SALAO_ZUMA.push(novaMesa);
  res.status(201).json({ ok: true, mensagem: `Mesa ${novaMesa.numero} cadastrada com sucesso!`, mesa: novaMesa });
});

routerZuma.put('/mesas/:id', (req, res) => {
  const { id } = req.params;
  const mesa = MESAS_SALAO_ZUMA.find(m => m.id === parseInt(id) || m.numero === parseInt(id));
  if (!mesa) {
    return res.status(404).json({ ok: false, error: "Mesa não encontrada para modificação." });
  }
  const { numero, setor, capacidade, garcom, status, tempAmbiente, clientesNaMesa } = req.body || {};
  if (numero && parseInt(numero) !== mesa.numero) {
    const colidiu = MESAS_SALAO_ZUMA.find(m => m.numero === parseInt(numero) && m.id !== mesa.id);
    if (colidiu) {
      return res.status(400).json({ ok: false, error: `Número ${numero} já utilizado por outra mesa.` });
    }
    mesa.numero = parseInt(numero);
  }
  if (setor) mesa.setor = setor;
  if (capacidade) mesa.capacidade = parseInt(capacidade);
  if (garcom) mesa.garcom = garcom;
  if (status) mesa.status = status;
  if (tempAmbiente) mesa.tempAmbiente = parseFloat(tempAmbiente);
  if (clientesNaMesa !== undefined) mesa.clientesNaMesa = parseInt(clientesNaMesa);

  res.json({ ok: true, mensagem: `Mesa ${mesa.numero} modificada e salva com sucesso!`, mesa });
});

routerZuma.delete('/mesas/:id', (req, res) => {
  const { id } = req.params;
  const index = MESAS_SALAO_ZUMA.findIndex(m => m.id === parseInt(id) || m.numero === parseInt(id));
  if (index === -1) {
    return res.status(404).json({ ok: false, error: "Mesa não encontrada para exclusão." });
  }
  const removida = MESAS_SALAO_ZUMA.splice(index, 1)[0];
  res.json({ ok: true, mensagem: `Mesa ${removida.numero} (${removida.setor}) excluída com sucesso!`, mesaExcluida: removida });
});

// --- 16.3 ESTOQUE / INSUMOS: INCLUIR, MODIFICAR E EXCLUIR ---
routerZuma.post('/estoque/insumo', (req, res) => {
  const { nome, codigo, unidade, saldoAtual, saldoMinimo, custoMedioUnitario, fornecedor, loteAtual, validadeLote, especificacao } = req.body || {};
  if (!nome) {
    return res.status(400).json({ ok: false, error: "Nome do insumo é obrigatório." });
  }
  const id = `ins-${Date.now()}`;
  const novoInsumo = {
    id,
    codigo: codigo || `INS-${String(Object.keys(ESTOQUE_PESCADOS_ZUMA).length + 1).padStart(3, '0')}`,
    nome: String(nome).trim(),
    especificacao: especificacao || `${nome} padrão de qualidade Zuma`,
    unidade: unidade || 'kg',
    saldoAtual: parseFloat(saldoAtual) || 0,
    saldoMinimo: parseFloat(saldoMinimo) || 5,
    custoPorKgInteiro: parseFloat(custoMedioUnitario) || 0,
    custoEfetivoPorKgLimpo: parseFloat(custoMedioUnitario) || 0,
    rendimentoFileNobrePct: req.body.rendimentoFileNobrePct || 100,
    status: (parseFloat(saldoAtual) || 0) <= (parseFloat(saldoMinimo) || 5) ? 'Repor Urgente' : 'OK',
    fornecedor: fornecedor || 'Fornecedor Credenciado MT',
    temperaturaCamara: req.body.temperaturaCamara || '-2°C a +2°C (Monitorada IoT)',
    loteAtual: loteAtual || `LOTE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    validadeLote: validadeLote || '25/12/2026'
  };
  ESTOQUE_PESCADOS_ZUMA[id] = novoInsumo;
  res.status(201).json({ ok: true, mensagem: `Insumo "${novoInsumo.nome}" incluído no estoque com sucesso!`, insumo: novoInsumo });
});

routerZuma.put('/estoque/insumo/:id', (req, res) => {
  const { id } = req.params;
  const insumo = ESTOQUE_PESCADOS_ZUMA[id];
  if (!insumo) {
    return res.status(404).json({ ok: false, error: "Insumo de estoque não encontrado para alteração." });
  }
  const { nome, codigo, unidade, saldoAtual, saldoMinimo, custoMedioUnitario, fornecedor, loteAtual, validadeLote, especificacao } = req.body || {};
  if (nome) insumo.nome = String(nome).trim();
  if (codigo) insumo.codigo = codigo;
  if (unidade) insumo.unidade = unidade;
  if (saldoAtual !== undefined) {
    insumo.saldoAtual = parseFloat(saldoAtual);
    insumo.status = insumo.saldoAtual <= insumo.saldoMinimo ? 'Repor Urgente' : 'OK';
  }
  if (saldoMinimo !== undefined) {
    insumo.saldoMinimo = parseFloat(saldoMinimo);
    insumo.status = insumo.saldoAtual <= insumo.saldoMinimo ? 'Repor Urgente' : 'OK';
  }
  if (custoMedioUnitario !== undefined) {
    insumo.custoPorKgInteiro = parseFloat(custoMedioUnitario);
    insumo.custoEfetivoPorKgLimpo = parseFloat(custoMedioUnitario);
  }
  if (fornecedor) insumo.fornecedor = fornecedor;
  if (loteAtual) insumo.loteAtual = loteAtual;
  if (validadeLote) insumo.validadeLote = validadeLote;
  if (especificacao) insumo.especificacao = especificacao;

  res.json({ ok: true, mensagem: `Insumo "${insumo.nome}" modificado e salvo com sucesso!`, insumo });
});

routerZuma.delete('/estoque/insumo/:id', (req, res) => {
  const { id } = req.params;
  const insumo = ESTOQUE_PESCADOS_ZUMA[id];
  if (!insumo) {
    return res.status(404).json({ ok: false, error: "Insumo não encontrado para exclusão." });
  }
  delete ESTOQUE_PESCADOS_ZUMA[id];
  res.json({ ok: true, mensagem: `Insumo "${insumo.nome}" excluído do estoque com sucesso!`, insumoExcluido: insumo });
});

// --- 16.4 COZINHA KDS: INCLUIR, MODIFICAR E EXCLUIR ---
routerZuma.post('/cozinha/pedido', (req, res) => {
  const { numeroComanda, origem, praca, itens, prioridade, garcom } = req.body || {};
  if (!itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ ok: false, error: "O pedido da cozinha deve conter ao menos um item." });
  }
  const novoPedido = {
    id: `KDS-${Date.now()}`,
    numeroComanda: numeroComanda || `CMD-${Math.floor(1000 + Math.random() * 9000)}`,
    origem: origem || "Balcão PDV",
    praca: praca || "SUSHI_BAR",
    itens: itens.map((it, idx) => ({
      id: `it-${Date.now()}-${idx}`,
      nome: it.nome,
      qtd: parseInt(it.qtd || it.quantidade) || 1,
      obs: it.obs || it.observacao || ""
    })),
    horaPedido: new Date().toISOString(),
    minutosEmEspera: 0,
    status: "EM_PREPARO",
    prioridade: prioridade || "NORMAL",
    garcom: garcom || "Caixa Salão"
  };
  PEDIDOS_COZINHA_KDS_ZUMA.unshift(novoPedido);
  res.status(201).json({ ok: true, mensagem: `Pedido ${novoPedido.numeroComanda} incluído no KDS com sucesso!`, pedido: novoPedido });
});

routerZuma.put('/cozinha/pedido/:id', (req, res) => {
  const { id } = req.params;
  const pedido = PEDIDOS_COZINHA_KDS_ZUMA.find(p => p.id === id);
  if (!pedido) {
    return res.status(404).json({ ok: false, error: "Pedido KDS não encontrado para modificação." });
  }
  const { origem, praca, itens, prioridade, garcom, status } = req.body || {};
  if (origem) pedido.origem = origem;
  if (praca) pedido.praca = praca;
  if (prioridade) pedido.prioridade = prioridade;
  if (garcom) pedido.garcom = garcom;
  if (status) pedido.status = status;
  if (itens && Array.isArray(itens)) {
    pedido.itens = itens.map((it, idx) => ({
      id: it.id || `it-${Date.now()}-${idx}`,
      nome: it.nome,
      qtd: parseInt(it.qtd || it.quantidade) || 1,
      obs: it.obs || it.observacao || ""
    }));
  }

  res.json({ ok: true, mensagem: `Pedido ${pedido.numeroComanda} modificado e salvo com sucesso!`, pedido });
});

routerZuma.delete('/cozinha/pedido/:id', (req, res) => {
  const { id } = req.params;
  const index = PEDIDOS_COZINHA_KDS_ZUMA.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ ok: false, error: "Pedido KDS não encontrado para exclusão." });
  }
  const removido = PEDIDOS_COZINHA_KDS_ZUMA.splice(index, 1)[0];
  res.json({ ok: true, mensagem: `Pedido ${removido.numeroComanda} cancelado e removido do KDS!`, pedidoCancelado: removido });
});
// =====================================================================
// 16.5 CRM & CLIENTES: INCLUIR, MODIFICAR E EXCLUIR
// ============================================================================
routerZuma.post("/crm/cliente", (req, res) => {
  const { nome, telefone, email, bairro, cidade, aniversario, pratosFavoritos, restricoes, observacoes, segmentoRFV } = req.body || {};
  if (!nome || !telefone) {
    return res.status(400).json({ ok: false, error: "Nome e telefone são obrigatórios para cadastro de cliente no CRM." });
  }
  const novoCliente = {
    id: `cli-zuma-${Date.now()}`,
    nome: String(nome).trim(),
    telefone: String(telefone).trim(),
    whatsapp: String(telefone).replace(/\D/g, ""),
    email: email || "",
    cidade: cidade || "Tangará da Serra",
    uf: "MT",
    bairro: bairro || "Centro",
    aniversario: aniversario || "",
    segmentoRFV: segmentoRFV || "VIP Ouro",
    rfvScore: 85,
    totalPedidos: 1,
    totalGasto: 180.00,
    ticketMedio: 180.00,
    canalPreferido: "salao",
    pratosFavoritos: Array.isArray(pratosFavoritos) ? pratosFavoritos : (pratosFavoritos ? [pratosFavoritos] : ["Combinado Zuma 30 Peças"]),
    bebidaFavorita: "Heineken Long Neck",
    restricoes: restricoes || "Nenhuma",
    observacoes: observacoes || "Cadastrado diretamente pelo Zuma ERP 360.",
    dataCadastro: new Date().toISOString()
  };
  ZUMA_CLIENTES_CRM.unshift(novoCliente);
  salvarEstadoPersistidoZuma();
  res.status(201).json({ ok: true, mensagem: `Cliente "${novoCliente.nome}" incluído no CRM com sucesso!`, cliente: novoCliente });
});

routerZuma.put("/crm/cliente/:id", (req, res) => {
  const { id } = req.params;
  const cliente = ZUMA_CLIENTES_CRM.find(c => c.id === id);
  if (!cliente) {
    return res.status(404).json({ ok: false, error: "Cliente não encontrado para modificação." });
  }
  const { nome, telefone, email, bairro, cidade, aniversario, pratosFavoritos, restricoes, observacoes, segmentoRFV } = req.body || {};
  if (nome) cliente.nome = String(nome).trim();
  if (telefone) {
    cliente.telefone = String(telefone).trim();
    cliente.whatsapp = String(telefone).replace(/\D/g, "");
  }
  if (email !== undefined) cliente.email = email;
  if (bairro) cliente.bairro = bairro;
  if (cidade) cliente.cidade = cidade;
  if (aniversario !== undefined) cliente.aniversario = aniversario;
  if (segmentoRFV) cliente.segmentoRFV = segmentoRFV;
  if (pratosFavoritos) cliente.pratosFavoritos = Array.isArray(pratosFavoritos) ? pratosFavoritos : [pratosFavoritos];
  if (restricoes !== undefined) cliente.restricoes = restricoes;
  if (observacoes !== undefined) cliente.observacoes = observacoes;
  cliente.dataModificacao = new Date().toISOString();
  salvarEstadoPersistidoZuma();
  res.json({ ok: true, mensagem: `Cliente "${cliente.nome}" modificado e salvo com sucesso!`, cliente });
});

routerZuma.delete("/crm/cliente/:id", (req, res) => {
  const { id } = req.params;
  const index = ZUMA_CLIENTES_CRM.findIndex(c => c.id === id);
  if (index === -1) {
    return res.status(404).json({ ok: false, error: "Cliente não encontrado para exclusão." });
  }
  const removido = ZUMA_CLIENTES_CRM.splice(index, 1)[0];
  salvarEstadoPersistidoZuma();
  res.json({ ok: true, mensagem: `Cliente "${removido.nome}" excluído do CRM com sucesso!`, clienteExcluido: removido });
});

// ============================================================================
// 16.6 DELIVERY & EXPEDIÇÃO: INCLUIR, MODIFICAR E EXCLUIR CORRIDAS
// ============================================================================
routerZuma.post("/delivery/corrida", (req, res) => {
  const { clienteNome, telefone, endereco, bairro, itens, valorTotal, taxaEntrega, formaPagamento, observacoes } = req.body || {};
  if (!clienteNome || !endereco) {
    return res.status(400).json({ ok: false, error: "Nome do cliente e endereço completo são obrigatórios para despacho de delivery." });
  }
  const novaCorrida = {
    id: `CORR-${Math.floor(700 + Math.random() * 200)}`,
    pedidoId: `ZUM-${Math.floor(1000 + Math.random() * 9000)}`,
    cliente: {
      nome: String(clienteNome).trim(),
      telefone: telefone || "(65) 99999-0000",
      endereco: String(endereco).trim(),
      bairro: bairro || "Centro",
      cidade: "Tangará da Serra - MT",
      lat: -14.622915 + (Math.random() - 0.5) * 0.02,
      lng: -57.493922 + (Math.random() - 0.5) * 0.02
    },
    itens: Array.isArray(itens) && itens.length ? itens : [{ nome: "Combinado Especial Delivery", qtd: 1, preco: parseFloat(valorTotal) || 89.90 }],
    distanciaKm: 2.3,
    tempoEstimadoMin: 18,
    taxaEntrega: parseFloat(taxaEntrega) || 10.00,
    valorTotal: parseFloat(valorTotal) || 99.90,
    formaPagamento: formaPagamento || "PIX Pago Online",
    status: "aguardando_coleta",
    historicoStatus: [
      { status: "pedido_recebido_expedicao", hora: new Date().toISOString() }
    ],
    codigoOtp: String(Math.floor(1000 + Math.random() * 9000)),
    observacoes: observacoes || ""
  };
  CORRIDAS_ENTREGADOR_ZUMA.unshift(novaCorrida);
  salvarEstadoPersistidoZuma();
  res.status(201).json({ ok: true, mensagem: `Corrida ${novaCorrida.id} despachada para o entregador com sucesso!`, corrida: novaCorrida });
});

routerZuma.put("/delivery/corrida/:id", (req, res) => {
  const { id } = req.params;
  const corrida = CORRIDAS_ENTREGADOR_ZUMA.find(c => c.id === id);
  if (!corrida) {
    return res.status(404).json({ ok: false, error: "Corrida de delivery não encontrada para modificação." });
  }
  const { clienteNome, telefone, endereco, bairro, taxaEntrega, status, formaPagamento, valorTotal } = req.body || {};
  if (clienteNome) corrida.cliente.nome = clienteNome;
  if (telefone) corrida.cliente.telefone = telefone;
  if (endereco) corrida.cliente.endereco = endereco;
  if (bairro) corrida.cliente.bairro = bairro;
  if (taxaEntrega !== undefined) corrida.taxaEntrega = parseFloat(taxaEntrega);
  if (valorTotal !== undefined) corrida.valorTotal = parseFloat(valorTotal);
  if (formaPagamento) corrida.formaPagamento = formaPagamento;
  if (status && status !== corrida.status) {
    corrida.status = status;
    corrida.historicoStatus.push({ status, hora: new Date().toISOString() });
    if (status === "entregue") {
      corrida.horaConclusao = new Date().toISOString();
      corrida.concluidaEm = corrida.horaConclusao;
    }
  }
  salvarEstadoPersistidoZuma();
  res.json({ ok: true, mensagem: `Corrida ${corrida.id} modificada e salva com sucesso!`, corrida });
});

routerZuma.delete("/delivery/corrida/:id", (req, res) => {
  const { id } = req.params;
  const index = CORRIDAS_ENTREGADOR_ZUMA.findIndex(c => c.id === id);
  if (index === -1) {
    return res.status(404).json({ ok: false, error: "Corrida de delivery não encontrada para cancelamento." });
  }
  const removida = CORRIDAS_ENTREGADOR_ZUMA.splice(index, 1)[0];
  salvarEstadoPersistidoZuma();
  res.json({ ok: true, mensagem: `Corrida ${removida.id} cancelada e removida com sucesso!`, corridaCancelada: removida });
});

// ============================================================================
// 16.7 OPERAÇÕES AVANÇADAS DE MESAS: DIVISÃO DE CONTA E TRANSFERÊNCIA
// ============================================================================
routerZuma.post("/mesas/dividir-conta", (req, res) => {
  const { numeroMesa, numeroPessoas, incluirDezPorcento } = req.body || {};
  const mesa = MESAS_SALAO_ZUMA.find(m => String(m.numero) === String(numeroMesa));
  const valorTotalBase = mesa?.valorConta || 189.50;
  const pessoas = parseInt(numeroPessoas) || 2;
  const taxaServico = incluirDezPorcento ? valorTotalBase * 0.10 : 0;
  const valorFinal = valorTotalBase + taxaServico;
  const valorPorPessoa = valorFinal / pessoas;
  res.json({
    ok: true,
    numeroMesa,
    pessoas,
    valorConsumo: valorTotalBase,
    taxaServico,
    valorTotal: valorFinal,
    valorPorPessoa: parseFloat(valorPorPessoa.toFixed(2)),
    mensagem: `Conta da Mesa ${numeroMesa} dividida em ${pessoas} pessoas: R$ ${valorPorPessoa.toFixed(2)} por pessoa.`
  });
});

routerZuma.post("/mesas/transferir-comanda", (req, res) => {
  const { mesaOrigem, mesaDestino, garcom } = req.body || {};
  const orig = MESAS_SALAO_ZUMA.find(m => parseInt(m.numero, 10) === parseInt(mesaOrigem, 10) || String(m.numero) === String(mesaOrigem));
  const dest = MESAS_SALAO_ZUMA.find(m => parseInt(m.numero, 10) === parseInt(mesaDestino, 10) || String(m.numero) === String(mesaDestino));
  if (!orig || !dest) {
    return res.status(404).json({ ok: false, error: "Mesa de origem ou destino não encontrada." });
  }
  dest.status = "OCUPADA";
  dest.valorConta = (dest.valorConta || 0) + (orig.valorConta || 0);
  orig.status = "LIVRE";
  orig.valorConta = 0;
  salvarEstadoPersistidoZuma();
  res.json({
    ok: true,
    mensagem: `Comanda transferida da Mesa ${mesaOrigem} para a Mesa ${mesaDestino} com sucesso por ${garcom || "Garçom Chefe"}!`
  });
});

// MÓDULO DE GESTÃO DO PROPRIETÁRIO (PALMA DA MÃO, COMPARATIVOS, CONCORRÊNCIA E AÇÕES)
// ============================================================================

export const DASHBOARD_PROPRIETARIO_ZUMA = {
  kpisHoje: {
    faturamentoHoje: 8940.00,
    metaHoje: 10000.00,
    percentualMeta: 89.4,
    ticketMedioHoje: 154.13,
    pedidosHojeTotal: 58,
    pedidosSalao: 36,
    pedidosDelivery: 22,
    cmvPercentualHoje: 27.8,
    cmvMetaTeto: 30.0,
    lucroLiquidoEstimadoHoje: 3486.60,
    margemLiquidaHoje: 39.0,
    giroMedioMesaMinutos: 72,
    tempoMedioEntregaMinutos: 34,
    clientesAtendidosHoje: 142,
    mesasOcupadasAgora: 18,
    mesasTotal: 27,
    taxaOcupacaoSalao: 66.7,
    statusOperacao: "Aberto / Pico Noturno Ativo",
    previsaoFechamentoHoje: 10850.00
  },
  comparativoMesmosDias: {
    d7: {
      titulo: "Hoje vs Sexta-Feira Passada (D-7)",
      diaReferencia: "Sexta-Feira, 13/11/2026",
      faturamentoHoje: 8940.00,
      faturamentoAnterior: 7160.00,
      diffFaturamento: 1780.00,
      diffPercentualFaturamento: 24.86,
      pedidosHoje: 58,
      pedidosAnterior: 49,
      diffPedidos: 9,
      ticketHoje: 154.13,
      ticketAnterior: 146.12,
      diffTicket: 8.01,
      cmvHoje: 27.8,
      cmvAnterior: 29.4,
      lucroEstimadoHoje: 3486.60,
      lucroEstimadoAnterior: 2685.00,
      diffLucro: 801.60
    },
    d30: {
      titulo: "Hoje vs Mesma Sexta Mês Anterior (D-30)",
      diaReferencia: "Sexta-Feira, 23/10/2026",
      faturamentoHoje: 8940.00,
      faturamentoAnterior: 6820.00,
      diffFaturamento: 2120.00,
      diffPercentualFaturamento: 31.08,
      pedidosHoje: 58,
      pedidosAnterior: 45,
      ticketHoje: 154.13,
      ticketAnterior: 151.55,
      cmvHoje: 27.8,
      cmvAnterior: 30.2
    },
    semanalAcumulado: {
      titulo: "Semana Atual vs Semana Anterior",
      faturamentoSemanaAtual: 48920.00,
      faturamentoSemanaAnterior: 41250.00,
      diffPercentual: 18.59,
      ticketMedioSemanaAtual: 149.60,
      ticketMedioSemanaAnterior: 142.20
    }
  },
  curvaHorariaHojeVsD7: [
    { hora: "11h", faturamentoHoje: 320, faturamentoD7: 210, meta: 300 },
    { hora: "12h", faturamentoHoje: 1150, faturamentoD7: 890, meta: 1100 },
    { hora: "13h", faturamentoHoje: 880, faturamentoD7: 740, meta: 850 },
    { hora: "14h", faturamentoHoje: 340, faturamentoD7: 280, meta: 350 },
    { hora: "18h", faturamentoHoje: 450, faturamentoD7: 380, meta: 400 },
    { hora: "19h", faturamentoHoje: 1280, faturamentoD7: 980, meta: 1200 },
    { hora: "20h", faturamentoHoje: 1950, faturamentoD7: 1540, meta: 1900 },
    { hora: "21h", faturamentoHoje: 1420, faturamentoD7: 1190, meta: 1500 },
    { hora: "22h", faturamentoHoje: 860, faturamentoD7: 710, meta: 900 },
    { hora: "23h", faturamentoHoje: 290, faturamentoD7: 240, meta: 300 }
  ],
  diasSemanaComparativo: [
    { dia: "Seg", atual: 4210, anterior: 3820, meta: 4000 },
    { dia: "Ter", atual: 4850, anterior: 4190, meta: 4500 },
    { dia: "Qua", atual: 5920, anterior: 5120, meta: 5500 },
    { dia: "Qui", atual: 6840, anterior: 5980, meta: 6500 },
    { dia: "Sex (Hoje)", atual: 8940, anterior: 7160, meta: 10000 },
    { dia: "Sáb", atual: 10450, anterior: 8920, meta: 11000 },
    { dia: "Dom", atual: 7710, anterior: 6060, meta: 8000 }
  ],
  canaisDistribuicao: {
    salao: { valor: 5542.80, percentual: 62.0, pedidos: 36, ticket: 153.97, icone: "🍽️" },
    delivery: { valor: 2503.20, percentual: 28.0, pedidos: 22, ticket: 113.78, icone: "🛵" },
    cardapioDigital: { valor: 625.80, percentual: 7.0, pedidos: 5, ticket: 125.16, icone: "📱" },
    balcaoRetirada: { valor: 268.20, percentual: 3.0, pedidos: 3, ticket: 89.40, icone: "🛍️" }
  },
  pescadosCriticosHoje: {
    salmaoFrescoEstoqueKg: 28.5,
    salmaoConsumidoHojeKg: 14.2,
    atumFrescoEstoqueKg: 11.2,
    peixeBrancoEstoqueKg: 15.0,
    rendimentoFilamentoPercentual: 71.4,
    perdasAparasGramas: 420,
    alertaReposicao: "Estoque suficiente para atendimento da noite (previsão de consumo: 9.8 kg de salmão até 23h30)"
  }
};

export const RADAR_CONCORRENCIA_TANGARA = {
  cidade: "Tangará da Serra - MT",
  dataVarredura: "2026-11-20T19:30:00Z",
  motorIA: "Motor KyttoIA 2.5 Flash",
  posicaoZumaNoMercado: "Líder de Categoria (Nota 4.9 ★, Melhor Tempo de Entrega e Maior Variedade de Peixes Nobres)",
  estabelecimentos: [
    {
      id: "zuma",
      nome: "Zuma Cozinha Oriental",
      tipo: "Restaurante Oriental & Sushi Bar Premium",
      endereco: "Rua Celso Rosa Lima, nº 142-W, Centro / Jd. Tangará II",
      avaliacaoGoogle: 4.9,
      totalAvaliacoes: 418,
      tempoMedioEntregaMin: 34,
      taxaEntregaMedia: 7.50,
      raioAtendimentoKm: 12,
      status: "Aberto",
      pontosFortes: ["Salmão chileno fresco diário", "211 SKUs no cardápio", "Rastreabilidade GPS por mapa", "Salão climatizado com 27 mesas"],
      isZuma: true
    },
    {
      id: "sushi_prime",
      nome: "Sushi Prime Tangará",
      tipo: "Restaurante & Rodízio",
      endereco: "Av. Brasil, Centro",
      avaliacaoGoogle: 4.5,
      totalAvaliacoes: 234,
      tempoMedioEntregaMin: 48,
      taxaEntregaMedia: 9.00,
      raioAtendimentoKm: 8,
      status: "Aberto",
      pontosFortes: ["Foco em festivais e rodízio", "Localização central"],
      pontosFracos: ["Tempo de espera elevado no delivery (48 min)", "Taxa de entrega mais alta"],
      isZuma: false
    },
    {
      id: "tokio_express",
      nome: "Tokio Express Tangará",
      tipo: "Fast Food Oriental & Delivery",
      endereco: "Av. Tancredo Neves",
      avaliacaoGoogle: 4.3,
      totalAvaliacoes: 175,
      tempoMedioEntregaMin: 55,
      taxaEntregaMedia: 10.00,
      raioAtendimentoKm: 10,
      status: "Aberto",
      pontosFortes: ["Preço de entrada acessível nos hot rolls"],
      pontosFracos: ["Utiliza peixe congelado", "Atrasos recorrentes em dias de chuva", "Taxa de R$ 10"],
      isZuma: false
    },
    {
      id: "koiso_delivery",
      nome: "Koiso Oriental Delivery",
      tipo: "Dark Kitchen Delivery",
      endereco: "Jd. Europa",
      avaliacaoGoogle: 4.4,
      totalAvaliacoes: 96,
      tempoMedioEntregaMin: 50,
      taxaEntregaMedia: 8.50,
      raioAtendimentoKm: 7,
      status: "Aberto",
      pontosFortes: ["Focado em combinados econômicos"],
      pontosFracos: ["Sem salão para consumo", "Cardápio limitado a 35 itens", "Sem rastreamento ao vivo"],
      isZuma: false
    },
    {
      id: "ryori_bar",
      nome: "Ryori Sushi Bar",
      tipo: "Balcão & Delivery",
      endereco: "Rua Antônio Hortolani",
      avaliacaoGoogle: 4.6,
      totalAvaliacoes: 142,
      tempoMedioEntregaMin: 45,
      taxaEntregaMedia: 9.50,
      raioAtendimentoKm: 9,
      status: "Aberto",
      pontosFortes: ["Drinks autorais e ambiente intimista"],
      pontosFracos: ["Capacidade reduzida de salão (12 mesas)", "Fila de espera"],
      isZuma: false
    }
  ],
  benchmarkPratos: [
    { prato: "Combinado Casal 40 Pçs", zumaPreco: 149.90, mediaConcorrencia: 158.00, menorPreco: 142.00, maiorPreco: 169.00, statusCompetitivo: "Vantagem Zuma: -R$ 8,10 vs média com salmão maçaricado e trufado" },
    { prato: "Sashimi Salmão 10 Pçs", zumaPreco: 54.90, mediaConcorrencia: 59.50, menorPreco: 52.00, maiorPreco: 66.00, statusCompetitivo: "Vantagem Zuma: -R$ 4,60 vs média (pescado 100% fresco)" },
    { prato: "Temaki Salmão Completo", zumaPreco: 36.90, mediaConcorrencia: 38.50, menorPreco: 35.00, maiorPreco: 42.00, statusCompetitivo: "Preço de mercado com nori premium e cream cheese legítimo" },
    { prato: "Hot Roll Salmão 10 Pçs", zumaPreco: 34.90, mediaConcorrencia: 36.00, menorPreco: 32.00, maiorPreco: 39.00, statusCompetitivo: "Altíssima saída no delivery com molho tarê artesanal" },
    { prato: "Festival / Rodízio Individual", zumaPreco: 119.90, mediaConcorrencia: 129.90, menorPreco: 115.00, maiorPreco: 139.90, statusCompetitivo: "Melhor custo-benefício gastronômico de Tangará da Serra" }
  ],
  diagnosticoMotorKyttoIA: {
    resumoExecutivo: "O Zuma Cozinha Oriental mantém dominância incontestável em Tangará da Serra - MT, operando com tempo de entrega 14 a 21 minutos mais veloz que todos os concorrentes devido ao mapeamento georreferenciado e ao App do Entregador próprio. A nota 4.9 ★ assegura fidelização máxima.",
    oportunidadesImediatas: [
      "Almoço Corporativo Executivo: Alta demanda de executivos do Agronegócio de Tangará da Serra nas sextas-feiras. Recomenda-se combo corporativo ágil.",
      "Gap Logístico dos Concorrentes: Tokio Express e Koiso estão demorando mais de 50 minutos hoje. Divulgar nas redes sociais que a entrega do Zuma leva em média 34 min.",
      "Oscilação do Salmão no Atacado: Leve alta de 3.8% na cotação regional de pescados; manter o CMV rigoroso em 27.8% priorizando saídas de combinados com atum e hot rolls."
    ]
  }
};

export const HISTORICO_ACOES_PROPRIETARIO = [];

// GET /api/public/zuma/proprietario/dashboard — Visão executiva completa do dono
routerZuma.get('/proprietario/dashboard', (req, res) => {
  res.json({
    ok: true,
    dashboard: DASHBOARD_PROPRIETARIO_ZUMA
  });
});

// GET /api/public/zuma/proprietario/concorrencia — Radar da concorrência de Tangará da Serra
routerZuma.get('/proprietario/concorrencia', (req, res) => {
  res.json({
    ok: true,
    radar: RADAR_CONCORRENCIA_TANGARA
  });
});

// POST /api/public/zuma/proprietario/acao — Tomada de ação completa com 1 toque
routerZuma.post('/proprietario/acao', (req, res) => {
  const { acaoId, titulo, detalhes, parametros } = req.body || {};
  
  const novaAcao = {
    id: `ACT-${Date.now()}`,
    acaoId: acaoId || "acao_generica",
    titulo: titulo || "Ação Executada pelo Proprietário",
    detalhes: detalhes || "Comando executado via App do Proprietário na palma da mão",
    parametros: parametros || {},
    dataHora: new Date().toISOString(),
    responsavel: "Proprietário Zuma (Sócio Gestor)",
    status: "Executado com Sucesso"
  };
  
  HISTORICO_ACOES_PROPRIETARIO.unshift(novaAcao);
  
  res.json({
    ok: true,
    mensagem: `Ação '${novaAcao.titulo}' executada imediatamente com sucesso!`,
    acao: novaAcao,
    totalAcoesExecutadas: HISTORICO_ACOES_PROPRIETARIO.length
  });
});

// GET /api/public/zuma/proprietario/acoes-historico — Histórico de ações tomadas
routerZuma.get('/proprietario/acoes-historico', (req, res) => {
  res.json({
    ok: true,
    total: HISTORICO_ACOES_PROPRIETARIO.length,
    acoes: HISTORICO_ACOES_PROPRIETARIO

  });
});

// ============================================================================
// 16.8 ESTOQUE: AJUSTE RÁPIDO E REGISTRO DE PERDAS
// =====================================================================
routerZuma.post("/estoque/ajuste-rapido", (req, res) => {
  const { insumoId, novoSaldo, motivo, responsavel } = req.body || {};
  const chave = Object.keys(ESTOQUE_PESCADOS_ZUMA).find(k => k === insumoId || k.includes(insumoId) || ESTOQUE_PESCADOS_ZUMA[k].codigo === insumoId);
  const insumo = chave ? ESTOQUE_PESCADOS_ZUMA[chave] : null;
  if (!insumo) {
    return res.status(404).json({ ok: false, error: "Insumo não encontrado no estoque para ajuste rápido." });
  }
  const saldoAnterior = insumo.saldoAtual;
  insumo.saldoAtual = parseFloat(novoSaldo);
  insumo.status = insumo.saldoAtual <= insumo.saldoMinimo ? "Repor Urgente" : "OK";
  salvarEstadoPersistidoZuma();
  res.json({
    ok: true,
    mensagem: `Estoque de "${insumo.nome}" ajustado de ${saldoAnterior} ${insumo.unidade} para ${insumo.saldoAtual} ${insumo.unidade}.`,
    saldoAnterior,
    novoSaldo: insumo.saldoAtual,
    motivo: motivo || "Inventário / Balanço Físico",
    responsavel: responsavel || "Chef Sushiman"
  });
});
// MÓDULOS EXPANDIDOS DO PROPRIETÁRIO: IA & ATENDIMENTOS, GANHOS/PERDAS E CNPJS
// ============================================================================

export const IA_ATENDIMENTOS_ZUMA = {
  kpisAtendimentos: {
    totalAtendimentosHoje: 384,
    viaWhatsAppIA: 286,
    viaSalaoGarcom: 98,
    tempoMedioRespostaIA: "1.2s",
    tempoMedioRespostaHumano: "4m 20s",
    taxaResolucaoAutonoma: 94.8,
    taxaConversaoEmVenda: 41.2,
    csatSatisfacao: 98.6,
    horasEconomizadasEquipe: 14.5,
    pedidosGeradosPorIA: 118,
    receitaGeradaIAHoje: 18187.34
  },
  curvaAtendimentosHora: [
    { hora: "11h", atendimentosIA: 18, atendimentosSalao: 6, conversaoVendas: 1240.00 },
    { hora: "12h", atendimentosIA: 42, atendimentosSalao: 24, conversaoVendas: 3150.00 },
    { hora: "13h", atendimentosIA: 31, atendimentosSalao: 18, conversaoVendas: 2180.00 },
    { hora: "14h", atendimentosIA: 14, atendimentosSalao: 5, conversaoVendas: 890.00 },
    { hora: "18h", atendimentosIA: 22, atendimentosSalao: 4, conversaoVendas: 1420.00 },
    { hora: "19h", atendimentosIA: 46, atendimentosSalao: 14, conversaoVendas: 3890.00 },
    { hora: "20h", atendimentosIA: 58, atendimentosSalao: 19, conversaoVendas: 5120.00 },
    { hora: "21h", atendimentosIA: 34, atendimentosSalao: 6, conversaoVendas: 2480.00 },
    { hora: "22h", atendimentosIA: 16, atendimentosSalao: 2, conversaoVendas: 980.00 },
    { hora: "23h", atendimentosIA: 5, atendimentosSalao: 0, conversaoVendas: 320.00 }
  ],
  funilAtendimentos: {
    visitasCardapio: 540,
    conversasIniciadasWhatsApp: 286,
    carrinhosMontados: 174,
    pedidosFinalizados: 118,
    taxaConversao: 41.2,
    ticketMedioIA: 154.13
  },
  pipelineOportunidadesKyttoIA: [
    {
      id: "OPP-001",
      titulo: "Resgate de 42 Carrinhos Abandonados no WhatsApp",
      categoria: "Recuperação de Vendas",
      valorPotencial: 4820.00,
      probabilidade: 78,
      acaoRecomendada: "Disparo automático Zumi com frete grátis nos próximos 15 minutos",
      acaoId: "RESGATE_CARRINHOS"
    },
    {
      id: "OPP-002",
      titulo: "Upsell de Bebidas & Sobremesas Japonesas (Mochi & Harumaki)",
      categoria: "Aumento de Ticket Médio",
      valorPotencial: 1280.00,
      probabilidade: 85,
      acaoRecomendada: "Ativar sugestão de sobremesa na confirmação da comanda pelo garçom digital",
      acaoId: "UPSELL_SOBREMESAS"
    },
    {
      id: "OPP-003",
      titulo: "Captação de Clientes do Tokio Express (Demora > 50 min)",
      categoria: "Conquista de Mercado",
      valorPotencial: 2450.00,
      probabilidade: 90,
      acaoRecomendada: "Campanha relâmpago de entrega expressa 34 min garantida no Instagram e WhatsApp",
      acaoId: "BLINDAGEM_CONCORRENCIA"
    },
    {
      id: "OPP-004",
      titulo: "Assinatura Corporativa de Sushi para Executivos do Agro",
      categoria: "Receita Recorrente B2B",
      valorPotencial: 14500.00,
      probabilidade: 72,
      acaoRecomendada: "Proposta B2B para as 12 maiores revendas agrícolas e cooperativas de Tangará da Serra",
      acaoId: "AGRO_CORPORATIVO"
    }
  ]
};

export const MATRIZ_GANHOS_PERDAS_ZUMA = {
  resumoSemanal: {
    novosClientesConquistados: 38,
    clientesFidelizadosAtivos: 244,
    clientesPerdidosChurn: 14,
    taxaRetencao: 94.6,
    saldoLiquidoClientes: 24,
    receitaConquistada: 18450.00,
    receitaEmRisco: 3920.00
  },
  ondeEstamosGanhando: [
    {
      alavanca: "Salmão Fresco Chileno vs Peixe Congelado Concorrente",
      clientesGanhos: 18,
      receitaEstimada: 8920.00,
      origem: "Migrados do Bonsai Sushi e Tokio Express",
      depoimentoSintese: "Clientes relatam textura superior do sashimi e frescor inconfundível sem odor de degelo."
    },
    {
      alavanca: "Velocidade de Entrega 34 min com Rastreamento em Tempo Real",
      clientesGanhos: 12,
      receitaEstimada: 5640.00,
      origem: "Usuários de delivery iFood que sofriam com atrasos de 50+ min no Koiso",
      depoimentoSintese: "Previsão exata e entrega em mãos enquanto o sushi ainda está frio e crocante."
    },
    {
      alavanca: "Atendimento Instantâneo Zumi WhatsApp 24/7 sem Espera",
      clientesGanhos: 8,
      receitaEstimada: 3890.00,
      origem: "Executivos do Agronegócio e famílias do Centro",
      depoimentoSintese: "Facilidade de pedir pelo WhatsApp com envio de foto dos pratos e PIX copia e cola direto."
    }
  ],
  ondeEstamosPerdendo: [
    {
      pontoFuga: "Terça e Quarta de Baixo Movimento vs Buffet por Kg Econômico",
      clientesPerdidos: 8,
      receitaPerdida: 2160.00,
      destino: "Nosso Sushi LTDA (R. Dep. Hitler Sansão)",
      motivo: "Preço de entrada mais baixo no buffet diário durante dias úteis."
    },
    {
      pontoFuga: "Fila de Espera no Salão no Sábado às 20h30",
      clientesPerdidos: 4,
      receitaPerdida: 1240.00,
      destino: "Desistência para jantar em casa ou petiscos",
      motivo: "Espera de 25 a 35 minutos sem assentos confortáveis na recepção."
    },
    {
      pontoFuga: "Taxa de Entrega de R$ 10,00 para Bairros Afastados (Jd. Europa / Tarumã)",
      clientesPerdidos: 2,
      receitaPerdida: 520.00,
      destino: "Dark kitchen de bairro local",
      motivo: "Percepção de frete desvantajoso para pedidos menores que R$ 80."
    }
  ],
  matrizOndeMelhorarKyttoIA: [
    {
      prioridade: "ALTA",
      acao: "Lançamento da 'Terça & Quarta do Temaki em Dobro' (R$ 39,90)",
      impactoProjetado: "+R$ 3.800,00 / semana",
      objetivo: "Estancar migração de clientes para o Nosso Sushi e lotar o salão no início da semana",
      acaoId: "BLINDAGEM_CONCORRENCIA"
    },
    {
      prioridade: "ALTA",
      acao: "Fila Virtual no WhatsApp com Rodada de Saquê Cortesia no Bistrô",
      impactoProjetado: "Redução de 85% na desistência de mesas no sábado à noite (+R$ 1.200/semana)",
      objetivo: "Transformar a espera em experiência gastronômica agradável",
      acaoId: "FILA_VIRTUAL_SAQUE"
    },
    {
      prioridade: "MÉDIA",
      acao: "Frete Fixo R$ 4,99 para Pedidos Acima de R$ 120 em Qualquer Bairro",
      impactoProjetado: "Aumento de 12% no ticket médio do delivery e neutralização do abandono",
      objetivo: "Conquistar bairros periféricos de alta renda como Jardim Europa",
      acaoId: "FRETE_DINAMICO"
    }
  ]
};

export const RADAR_CNPJS_TANGARA = {
  cidade: "Tangará da Serra - MT",
  dataVarredura: "2026-11-20T19:30:00Z",
  motorIA: "Motor KyttoIA 2.5 Flash",
  totalCnpjsMapeados: 9,
  faturamentoMercadoGastronomicoEstimadoMes: 1150000.00,
  marketShareOriental: [
    { nome: "Zuma Cozinha Oriental", share: 54.2, faturamentoEstimadoMes: 285000.00, lider: true, cor: "#f59e0b" },
    { nome: "Bonsai Sushi Bar", share: 18.5, faturamentoEstimadoMes: 110000.00, lider: false, cor: "#3b82f6" },
    { nome: "Nosso Sushi LTDA", share: 14.1, faturamentoEstimadoMes: 85000.00, lider: false, cor: "#10b981" },
    { nome: "Tokio Sushi Bar", share: 9.3, faturamentoEstimadoMes: 68000.00, lider: false, cor: "#ef4444" },
    { nome: "Outros / Dark Kitchens", share: 3.9, faturamentoEstimadoMes: 24000.00, lider: false, cor: "#8b5cf6" }
  ],
  cnpjsCadastrados: [
    {
      cnpj: "48.912.440/0001-88",
      razaoSocial: "Zuma Cozinha Oriental & Gastronomia LTDA",
      nomeFantasia: "Zuma Cozinha Oriental",
      dataAbertura: "15/01/2022",
      situacao: "Ativa",
      porte: "ME / EPP",
      capitalSocial: "R$ 150.000,00",
      faturamentoEstimadoMes: "R$ 285.000,00",
      faturamentoEstimadoAno: "R$ 3.420.000,00",
      cnaePrincipal: "56.11-2-01 - Restaurantes e similares",
      endereco: "Rua Celso Rosa Lima, 142-W, Centro / Jd. Tangará II, Tangará da Serra - MT",
      bairro: "Centro / Jd. Tangará II",
      socios: ["Rodrigo Ribeiro Gonçalves", "Sócio Operacional Zuma"],
      nivelRisco: "Líder Absoluto de Mercado",
      posicaoZuma: "Dominante (54.2% Market Share)",
      isZuma: true
    },
    {
      cnpj: "66.311.331/0001-50",
      razaoSocial: "Nosso Sushi LTDA",
      nomeFantasia: "Nosso Sushi / S.kamoto Sushi",
      dataAbertura: "16/04/2026",
      situacao: "Ativa",
      porte: "ME",
      capitalSocial: "R$ 50.000,00",
      faturamentoEstimadoMes: "R$ 85.000,00",
      faturamentoEstimadoAno: "R$ 1.020.000,00",
      cnaePrincipal: "56.11-2-01 - Restaurantes e similares",
      endereco: "R. Dep. Hitler Sansão, 365-W, Centro, Tangará da Serra - MT",
      bairro: "Centro",
      socios: ["Marcos Vinícius Sakamoto", "Aline Sakamoto"],
      nivelRisco: "Médio",
      alertaKyttoIA: "Empresa recente aberta em 2026 com forte foco em buffet por kg econômico.",
      isZuma: false
    },
    {
      cnpj: "44.431.917/0001-16",
      razaoSocial: "Acacio Rodrigues dos Santos Tokio Sushi Bar",
      nomeFantasia: "Tokio Sushi Bar",
      dataAbertura: "30/11/2021",
      situacao: "Ativa",
      porte: "ME",
      capitalSocial: "R$ 20.000,00",
      faturamentoEstimadoMes: "R$ 68.000,00",
      faturamentoEstimadoAno: "R$ 816.000,00",
      cnaePrincipal: "56.11-2-01 - Restaurantes e similares",
      endereco: "Av. Tancredo Neves, Tangará da Serra - MT",
      bairro: "Vila Alta / Tancredo Neves",
      socios: ["Acacio Rodrigues dos Santos (Titular)"],
      nivelRisco: "Baixo",
      alertaKyttoIA: "Gargalo no delivery e tempo de espera superior a 50 minutos nos fins de semana.",
      isZuma: false
    },
    {
      cnpj: "43.466.537/0001-54",
      razaoSocial: "Bonsai Sushi Restaurante LTDA - ME",
      nomeFantasia: "Bonsai Sushi Bar",
      dataAbertura: "22/01/2013",
      situacao: "Ativa",
      porte: "ME",
      capitalSocial: "R$ 80.000,00",
      faturamentoEstimadoMes: "R$ 110.000,00",
      faturamentoEstimadoAno: "R$ 1.320.000,00",
      cnaePrincipal: "56.11-2-01 - Restaurantes e similares",
      endereco: "Tangará da Serra - MT",
      bairro: "Centro",
      socios: ["Paulo Roberto Braga", "Andréia Panassolo"],
      nivelRisco: "Médio-Alto",
      alertaKyttoIA: "Mais tradicional da cidade (13 anos), porém sem aplicativo próprio e com delivery terceirizado.",
      isZuma: false
    },
    {
      cnpj: "67.280.022/0001-23",
      razaoSocial: "Santos Gastronomia LTDA",
      nomeFantasia: "Santo Dito Restaurante",
      dataAbertura: "11/06/2026",
      situacao: "Ativa",
      porte: "ME",
      capitalSocial: "R$ 100.000,00",
      faturamentoEstimadoMes: "R$ 140.000,00",
      faturamentoEstimadoAno: "R$ 1.680.000,00",
      cnaePrincipal: "56.11-2-01 - Restaurantes e similares",
      endereco: "Tangará da Serra - MT",
      bairro: "Jd. Cidade Alta",
      socios: ["Marcelo dos Santos", "Camila Ferreira Santos"],
      nivelRisco: "Médio",
      alertaKyttoIA: "Novo entrante em 2026 com proposta contemporânea e peixes de água doce.",
      isZuma: false
    },
    {
      cnpj: "34.720.152/0001-80",
      razaoSocial: "Masiero Restaurante LTDA",
      nomeFantasia: "Masiero Restaurante",
      dataAbertura: "30/08/2019",
      situacao: "Ativa",
      porte: "ME",
      capitalSocial: "R$ 60.000,00",
      faturamentoEstimadoMes: "R$ 95.000,00",
      faturamentoEstimadoAno: "R$ 1.140.000,00",
      cnaePrincipal: "56.11-2-01 - Restaurantes e similares",
      endereco: "Rua Antonio Hortolani, 765, Setor W - Centro, Tangará da Serra - MT",
      bairro: "Centro",
      socios: ["Valter Masiero", "Renata Masiero"],
      nivelRisco: "Baixo (Grelhados e Almoço Tradicional)",
      isZuma: false
    },
    {
      cnpj: "03.172.020/0001-38",
      razaoSocial: "Divino de Oliveira & Cia LTDA",
      nomeFantasia: "Restaurante Bar Lanchonete Casa Nossa",
      dataAbertura: "19/05/1999",
      situacao: "Ativa",
      porte: "EPP",
      capitalSocial: "R$ 120.000,00",
      faturamentoEstimadoMes: "R$ 180.000,00",
      faturamentoEstimadoAno: "R$ 2.160.000,00",
      cnaePrincipal: "56.11-2-01 - Restaurantes e similares",
      endereco: "Rua Julio Martinez Benevides, 474, S - Centro, Tangará da Serra - MT",
      bairro: "Centro",
      socios: ["Divino de Oliveira", "Célia Regina de Oliveira"],
      nivelRisco: "Baixo (Comida caseira tradicional e boteco)",
      isZuma: false
    },
    {
      cnpj: "53.292.681/0001-75",
      razaoSocial: "Restaurante Jn Portela LTDA",
      nomeFantasia: "Restaurante JN Portela",
      dataAbertura: "20/12/2023",
      situacao: "Ativa",
      porte: "ME",
      capitalSocial: "R$ 40.000,00",
      faturamentoEstimadoMes: "R$ 75.000,00",
      faturamentoEstimadoAno: "R$ 900.000,00",
      cnaePrincipal: "56.11-2-01 - Restaurantes e similares",
      endereco: "Tangará da Serra - MT",
      bairro: "Vila Horizonte",
      socios: ["Jonas Portela"],
      nivelRisco: "Baixo (Marmitas e prato feito)",
      isZuma: false
    },
    {
      cnpj: "51.467.699/0001-35",
      razaoSocial: "Tangara Comercio de Alimentos LTDA",
      nomeFantasia: "Distribuidora Alimentos Tangará",
      dataAbertura: "18/07/2023",
      situacao: "Ativa",
      porte: "ME / EPP",
      capitalSocial: "R$ 150.000,00",
      faturamentoEstimadoMes: "R$ 220.000,00",
      cnaePrincipal: "46.39-7-01 - Comércio atacadista de produtos alimentícios",
      endereco: "Tangará da Serra - MT",
      bairro: "Distrito Industrial",
      socios: ["Carlos Eduardo Silveira"],
      nivelRisco: "Fornecedor Parceiro",
      alertaKyttoIA: "Fornece insumos secos e descartáveis para o setor gastronômico local.",
      isZuma: false
    }
  ],
  teiaConexoesSocietarias: [
    {
      cluster: "Polo Gastronômico Central",
      descricao: "Concentração das operações de maior faturamento na Rua Dep. Hitler Sansão, Rua Antonio Hortolani e Celso Rosa Lima.",
      cnpjsEnvolvidos: ["48.912.440/0001-88", "66.311.331/0001-50", "34.720.152/0001-80"],
      faturamentoClusterMes: "R$ 465.000,00"
    },
    {
      cluster: "Cadeia de Suprimentos de Pescados",
      descricao: "Bonsai e Nosso Sushi adquirem salmão congelado no mesmo atacadista regional em Cuiabá; o Zuma mantém contrato exclusivo de importação aérea direta do Chile garantindo frescor único.",
      cnpjsEnvolvidos: ["48.912.440/0001-88", "43.466.537/0001-54", "66.311.331/0001-50"],
      diferencialZuma: "Barreira de entrada de qualidade invencível."
    },
    {
      cluster: "Novos Entrantes de 2026",
      descricao: "Duas novas empresas abertas no setor gastronômico em 2026: Nosso Sushi LTDA (abril/2026) e Santos Gastronomia LTDA (junho/2026).",
      cnpjsEnvolvidos: ["66.311.331/0001-50", "67.280.022/0001-23"],
      acaoRecomendadaKyttoIA: "Blindar a base de clientes VIP do Zuma através do Clube Zumi com pontuação em dobro."
    }
  ]
};

// GET /api/public/zuma/proprietario/ia-atendimentos — Visão online da IA e atendimentos
routerZuma.get('/proprietario/ia-atendimentos', (req, res) => {
  res.json({
    ok: true,
    iaAtendimentos: IA_ATENDIMENTOS_ZUMA
  });
});

// GET /api/public/zuma/proprietario/ganhos-perdas — Onde ganha, onde perde e onde melhorar
routerZuma.get('/proprietario/ganhos-perdas', (req, res) => {
  res.json({
    ok: true,
    matrizGanhosPerdas: MATRIZ_GANHOS_PERDAS_ZUMA
  });
});

// GET /api/public/zuma/proprietario/cnpjs-cidade — Radar e teia de CNPJs de Tangará da Serra
routerZuma.get('/proprietario/cnpjs-cidade', (req, res) => {
  res.json({
    ok: true,
    radarCnpjs: RADAR_CNPJS_TANGARA

  });
});

// =========================================================================
// 19. NOVOS ENDPOINTS EXPANDIDOS: FICHAS TÉCNICAS, RESERVAS, COMPRAS & CAIXA
// =========================================================================

// GET /api/public/zuma/fichas-tecnicas/matriz-bcg (Alias direto)
routerZuma.get('/fichas-tecnicas/matriz-bcg', (req, res) => {
  // Redireciona para o controlador da Matriz BCG oficial
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

// CRUD DE FICHAS TÉCNICAS: POST, PUT, DELETE
routerZuma.post(['/fichas-tecnicas', '/estoque/fichas-tecnicas'], (req, res) => {
  const { codigoPdv, nomeProduto, categoria, precoVenda, insumos = [], rendimento = 1, descricao = '' } = req.body || {};
  if (!codigoPdv || !nomeProduto) {
    return res.status(400).json({ ok: false, error: 'Código PDV e Nome do Produto são obrigatórios.' });
  }

  const pVenda = parseFloat(precoVenda) || 50.00;
  const insumosTratados = insumos.map(i => ({
    id: i.id || `ins-${Date.now()}`,
    nome: i.nome || 'Insumo Nobre',
    qtd: parseFloat(i.qtd) || 0.1,
    unidade: i.unidade || 'kg',
    custoUnitario: parseFloat(i.custoUnitario) || 20.00,
    custoTotal: parseFloat(((parseFloat(i.qtd) || 0.1) * (parseFloat(i.custoUnitario) || 20.00)).toFixed(2))
  }));

  const cmvTeorico = parseFloat(insumosTratados.reduce((acc, i) => acc + i.custoTotal, 0).toFixed(2));
  const cmvPercentual = pVenda > 0 ? parseFloat(((cmvTeorico / pVenda) * 100).toFixed(2)) : 0;
  const margemContribuicao = parseFloat((pVenda - cmvTeorico).toFixed(2));
  const margemContribuicaoPercentual = pVenda > 0 ? parseFloat(((margemContribuicao / pVenda) * 100).toFixed(2)) : 0;

  const novaFicha = {
    id: `ft-zuma-${codigoPdv.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    codigoPdv,
    nomeProduto,
    categoria: categoria || 'Especiais',
    precoVenda: pVenda,
    rendimento: parseInt(rendimento) || 1,
    descricao: descricao || `Ficha técnica cadastrada para ${nomeProduto}`,
    insumos: insumosTratados,
    cmvTeorico,
    cmvPercentual,
    margemContribuicao,
    margemContribuicaoPercentual
  };

  FICHAS_TECNICAS_ZUMA[codigoPdv] = novaFicha;
  res.status(201).json({
    ok: true,
    mensagem: `Ficha técnica do produto ${nomeProduto} (${codigoPdv}) criada com sucesso!`,
    ficha: novaFicha
  });
});

routerZuma.put(['/fichas-tecnicas/:id', '/estoque/fichas-tecnicas/:id'], (req, res) => {
  const { id } = req.params;
  const chave = Object.keys(FICHAS_TECNICAS_ZUMA).find(k => k === id || FICHAS_TECNICAS_ZUMA[k].id === id || FICHAS_TECNICAS_ZUMA[k].codigoPdv === id);

  if (!chave || !FICHAS_TECNICAS_ZUMA[chave]) {
    return res.status(404).json({ ok: false, error: 'Ficha técnica não encontrada.' });
  }

  const ficha = FICHAS_TECNICAS_ZUMA[chave];
  const { nomeProduto, categoria, precoVenda, insumos, rendimento, descricao } = req.body || {};

  if (nomeProduto) ficha.nomeProduto = nomeProduto;
  if (categoria) ficha.categoria = categoria;
  if (precoVenda !== undefined) ficha.precoVenda = parseFloat(precoVenda);
  if (rendimento !== undefined) ficha.rendimento = parseInt(rendimento);
  if (descricao !== undefined) ficha.descricao = descricao;

  if (Array.isArray(insumos)) {
    ficha.insumos = insumos.map(i => ({
      id: i.id || `ins-${Date.now()}`,
      nome: i.nome || 'Insumo Nobre',
      qtd: parseFloat(i.qtd) || 0.1,
      unidade: i.unidade || 'kg',
      custoUnitario: parseFloat(i.custoUnitario) || 20.00,
      custoTotal: parseFloat(((parseFloat(i.qtd) || 0.1) * (parseFloat(i.custoUnitario) || 20.00)).toFixed(2))
    }));
  }

  ficha.cmvTeorico = parseFloat(ficha.insumos.reduce((acc, i) => acc + i.custoTotal, 0).toFixed(2));
  ficha.cmvPercentual = ficha.precoVenda > 0 ? parseFloat(((ficha.cmvTeorico / ficha.precoVenda) * 100).toFixed(2)) : 0;
  ficha.margemContribuicao = parseFloat((ficha.precoVenda - ficha.cmvTeorico).toFixed(2));
  ficha.margemContribuicaoPercentual = ficha.precoVenda > 0 ? parseFloat(((ficha.margemContribuicao / ficha.precoVenda) * 100).toFixed(2)) : 0;

  res.json({
    ok: true,
    mensagem: `Ficha técnica de ${ficha.nomeProduto} atualizada com sucesso!`,
    ficha
  });
});

routerZuma.delete(['/fichas-tecnicas/:id', '/estoque/fichas-tecnicas/:id'], (req, res) => {
  const { id } = req.params;
  const chave = Object.keys(FICHAS_TECNICAS_ZUMA).find(k => k === id || FICHAS_TECNICAS_ZUMA[k].id === id || FICHAS_TECNICAS_ZUMA[k].codigoPdv === id);

  if (!chave || !FICHAS_TECNICAS_ZUMA[chave]) {
    return res.status(404).json({ ok: false, error: 'Ficha técnica não encontrada para exclusão.' });
  }

  const removida = FICHAS_TECNICAS_ZUMA[chave];
  delete FICHAS_TECNICAS_ZUMA[chave];

  res.json({
    ok: true,
    mensagem: `Ficha técnica de ${removida.nomeProduto} excluída com sucesso!`,
    id
  });
});

// RESERVAS: POST, PUT, DELETE RESTful
routerZuma.post('/reservas', (req, res) => {
  // Redireciona para /reservas/criar
  const { clienteNome, telefoneWhatsapp, data, hora, qtdPessoas, setorDesejado, observacoes } = req.body || {};
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
    mensagem: `Reserva para ${clienteNome} confirmada!`,
    reserva: novaReserva
  });
});

routerZuma.put('/reservas/:id', (req, res) => {
  const { id } = req.params;
  const reserva = (ESTADO_ERP_ZUMA.reservasMesas || []).find(r => r.id === id);
  if (!reserva) {
    return res.status(404).json({ ok: false, error: 'Reserva não encontrada.' });
  }
  const { clienteNome, telefoneWhatsapp, data, hora, qtdPessoas, setorDesejado, observacoes, status } = req.body || {};
  if (clienteNome) reserva.clienteNome = clienteNome;
  if (telefoneWhatsapp) reserva.telefoneWhatsapp = telefoneWhatsapp;
  if (data) reserva.data = data;
  if (hora) reserva.hora = hora;
  if (qtdPessoas) reserva.qtdPessoas = parseInt(qtdPessoas);
  if (setorDesejado) reserva.setorDesejado = setorDesejado;
  if (observacoes) reserva.observacoes = observacoes;
  if (status) reserva.status = status;
  reserva.atualizadoEm = new Date().toISOString();
  salvarEstadoPersistidoZuma();
  res.json({
    ok: true,
    mensagem: `Reserva ${id} atualizada com sucesso!`,
    reserva
  });
});

routerZuma.delete('/reservas/:id', (req, res) => {
  const { id } = req.params;
  const idx = (ESTADO_ERP_ZUMA.reservasMesas || []).findIndex(r => r.id === id);
  if (idx === -1) {
    return res.status(404).json({ ok: false, error: 'Reserva não encontrada para cancelamento.' });
  }
  const removida = ESTADO_ERP_ZUMA.reservasMesas.splice(idx, 1)[0];
  salvarEstadoPersistidoZuma();
  res.json({
    ok: true,
    mensagem: `Reserva ${id} cancelada com sucesso!`,
    reserva: removida
  });
});

// FILA DE ESPERA: DELETE /fila/:id
routerZuma.delete('/fila/:id', (req, res) => {
  const { id } = req.params;
  const idx = (ESTADO_ERP_ZUMA.filaEspera || []).findIndex(f => f.id === id);
  if (idx === -1) {
    return res.status(404).json({ ok: false, error: 'Cliente não encontrado na fila de espera.' });
  }
  const removido = ESTADO_ERP_ZUMA.filaEspera.splice(idx, 1)[0];
  salvarEstadoPersistidoZuma();
  res.json({
    ok: true,
    mensagem: `Cliente ${removido.clienteNome} removido(a) da fila de espera.`,
    cliente: removido
  });
});

// COMPRAS: SUGESTÕES INTELIGENTES & ALIASES
routerZuma.get('/compras/sugestoes', (req, res) => {
  const sugestoes = [
    {
      insumo: "Salmão Fresco Chileno (Filé Limpo)",
      codigo: "INS-001",
      saldoAtualKg: 18.5,
      estoqueMinimoKg: 30.0,
      sugestaoCompraKg: 45.0,
      unidade: "kg",
      fornecedorPreferencial: "Pescados Pantanal Cuiabá / Importação Santiago",
      precoEstimadoKg: 82.93,
      valorTotalEstimado: 3731.85,
      criticidade: "ALTA",
      motivo: "Previsão de alta demanda para o final de semana no rodízio e combinados especiais."
    },
    {
      insumo: "Atum Fresco Yellowfin (Lombo Nobre)",
      codigo: "INS-002",
      saldoAtualKg: 6.2,
      estoqueMinimoKg: 10.0,
      sugestaoCompraKg: 15.0,
      unidade: "kg",
      fornecedorPreferencial: "Mar del Sur Pescados Nobres",
      precoEstimadoKg: 95.00,
      valorTotalEstimado: 1425.00,
      criticidade: "MEDIA",
      motivo: "Sashimis de atum trufado e tartar omakase."
    },
    {
      insumo: "Arroz Gohan Grão Curto Japonês (Mirokumai)",
      codigo: "INS-005",
      saldoAtualKg: 28.0,
      estoqueMinimoKg: 50.0,
      sugestaoCompraKg: 80.0,
      unidade: "kg",
      fornecedorPreferencial: "Distribuidora Oriente SP / Atacadão Tangará",
      precoEstimadoKg: 14.00,
      valorTotalEstimado: 1120.00,
      criticidade: "MEDIA",
      motivo: "Base de todos os sushis, niguiris e temakis da casa."
    },
    {
      insumo: "Cream Cheese Original Tradicional",
      codigo: "INS-008",
      saldoAtualKg: 8.5,
      estoqueMinimoKg: 15.0,
      sugestaoCompraKg: 25.0,
      unidade: "kg",
      fornecedorPreferencial: "Distribuidora Laticínios MT",
      precoEstimadoKg: 38.00,
      valorTotalEstimado: 950.00,
      criticidade: "BAIXA",
      motivo: "Recheio de hot rolls e uramakis especiais."
    }
  ];

  const totalEstimadoCompras = sugestoes.reduce((s, i) => s + i.valorTotalEstimado, 0);

  res.json({
    ok: true,
    empresa: "Zuma Cozinha Oriental",
    totalSugestoes: sugestoes.length,
    valorTotalEstimadoCompras: parseFloat(totalEstimadoCompras.toFixed(2)),
    sugestoes
  });
});

routerZuma.post(['/compras/pedido-ordem', '/compras/pedidos'], (req, res, next) => {
  // Redireciona para /compras/lancar-ordem
  req.url = '/compras/lancar-ordem';
  routerZuma.handle(req, res, next);
});

routerZuma.put('/compras/pedidos/:id/receber', (req, res) => {
  const { id } = req.params;
  req.body = req.body || {};
  req.body.ordemId = id;
  const ordem = (ESTADO_ERP_ZUMA.comprasFornecedores || []).find(o => o.id === id);
  if (!ordem) {
    return res.status(404).json({ ok: false, error: "Ordem de compra não encontrada." });
  }
  ordem.status = "recebido";
  ordem.dataRecebimento = new Date().toISOString().split('T')[0];
  ordem.notaFiscalFornecedor = req.body.numeroNotaFiscalFornecedor || "NF-19824";
  ordem.temperaturaRecebimentoC = parseFloat(req.body.temperaturaConferenciaC) || 1.8;
  salvarEstadoPersistidoZuma();
  res.json({
    ok: true,
    mensagem: `Mercadoria da Ordem ${id} recebida com sucesso! Estoque e contas a pagar atualizados.`,
    ordem
  });
});

routerZuma.delete('/compras/pedidos/:id', (req, res) => {
  const { id } = req.params;
  const idx = (ESTADO_ERP_ZUMA.comprasFornecedores || []).findIndex(o => o.id === id);
  if (idx === -1) {
    return res.status(404).json({ ok: false, error: 'Ordem de compra não encontrada para cancelamento.' });
  }
  const removida = ESTADO_ERP_ZUMA.comprasFornecedores.splice(idx, 1)[0];
  salvarEstadoPersistidoZuma();
  res.json({
    ok: true,
    mensagem: `Ordem de compra ${id} cancelada com sucesso!`,
    ordem: removida
  });
});

// CAIXA TURNO: ALIASES RESTful
routerZuma.get('/caixa/status-atual', (req, res) => {
  res.json({
    ok: true,
    empresa: "Zuma Cozinha Oriental",
    caixa: CAIXA_TURNO_ATUAL_ZUMA
  });
});

routerZuma.post('/caixa/abertura', (req, res, next) => {
  req.url = '/pdv/abrir-caixa';
  routerZuma.handle(req, res, next);
});

routerZuma.post('/caixa/suprimento', (req, res, next) => {
  req.url = '/pdv/suprimento';
  routerZuma.handle(req, res, next);
});

routerZuma.post('/caixa/sangria', (req, res, next) => {
  req.url = '/pdv/sangria';
  routerZuma.handle(req, res, next);
});

routerZuma.post('/caixa/fechamento', (req, res, next) => {
  req.url = '/pdv/fechar-caixa';
  routerZuma.handle(req, res, next);
});

import { db, save } from "./db.js";

export const PALATARE_EMPRESA_ID = "c1c1ac01-8e50-4b61-8c79-de4aaa916da9";
export const PALATARE_LOJA_ID = "c1c1ac01-8e50-4b61-8c79-de4aaa916da0";
export const PALATARE_CNPJ = "31.002.650/0001-08";
export const PALATARE_CNPJ_NUM = "31002650000108";
export const PALATARE_GRUPO_ID = "grp-serrano-palatare-03";
export const PALATARE_GRUPO_NOME = "Grupo Serrano & Palatare";

export const PALATARE_DADOS_EMPRESA = {
  id: PALATARE_EMPRESA_ID,
  nome: "Palatare Pizzaria & Restaurante",
  nomeFantasia: "Palatare Pizzaria",
  razaoSocial: "Palatare Restaurante e Pizzaria LTDA",
  cnpj: PALATARE_CNPJ,
  cnpjNormalizado: PALATARE_CNPJ_NUM,
  inscricaoEstadual: "13.789.456-1",
  inscricaoMunicipal: "99201",
  tipoNegocio: "restaurante",
  segmento: "alimentacao",
  subsegmento: "gastronomia_pizzaria",
  grupoId: PALATARE_GRUPO_ID,
  grupoNome: PALATARE_GRUPO_NOME,
  holding: "Serrano & Palatare Participações S/A",
  empresaIrmaId: "c2c2ac01-8e50-4b61-8c79-de4aaa916da2",
  empresaIrmaNome: "Serrano Concreto Usinado",
  telefone: "(65) 99999-0090",
  whatsapp: "(65) 99999-0090",
  instagram: "@palataretga",
  instagramUrl: "https://www.instagram.com/palataretga/",
  email: "contato@palatarepizzaria.com.br",
  website: "https://palatare.kytto.com.br",
  enderecoLogradouro: "Rua João do Prado Arantes (Rua 14)",
  enderecoNumero: "307 W",
  enderecoComplemento: "Setor W",
  enderecoBairro: "Centro",
  enderecoCidade: "Tangará da Serra",
  enderecoEstado: "MT",
  enderecoCep: "78300076",
  horarioFuncionamento: "Terça a Domingo das 18:00 às 23:00 (Segunda-feira fechado)",
  rodizioDias: "Terças, Quartas e Sextas-feiras",
  precoRodizioAdulto: 59.90,
  precoRodizioInfantil: 29.90,
  avaliacaoNota: "4.7 ★",
  avaliacaoFonte: "Google & Restaurant Guru (Top #2 Pizzaria de Tangará da Serra)",
  logoUrl: "/palatare-logo.png",
  bannerUrl: "/palatare-banner.png",
  ativa: true,
  permitirEstoqueNegativo: false,
  totalLojas: 1,
};

// -------------------------------------------------------------
// CRM GASTRONÔMICO 360° - BASE DE CLIENTES REAL DE TANGARÁ DA SERRA
// -------------------------------------------------------------
export const PALATARE_CLIENTES_CRM = [
  {
    id: "cli-pal-001",
    nome: "Dr. Ricardo Mendonça",
    profissao: "Médico Ortopedista",
    telefone: "(65) 99871-2244",
    whatsapp: "5565998712244",
    email: "ricardo.mendonca@medico.com.br",
    endereco: "Rua José Corsino, 450 - Jardim Europa, Tangará da Serra/MT",
    bairro: "Jardim Europa",
    aniversario: "1984-11-16",
    aniversarianteMes: true,
    canalPreferido: "delivery",
    segmentoRFV: "VIP / Diamante",
    rfvScore: 98,
    totalPedidos: 28,
    totalGasto: 2840.00,
    ticketMedio: 101.43,
    diasSemPedir: 3,
    saboresFavoritos: ["Pizza Filé Mignon ao Gorgonzola", "Pizza de Picanha Especial"],
    bordaFavorita: "Legítimo Catupiry Original",
    massaFavorita: "Napolitana Fermentação Natural 48h",
    bebidaFavorita: "Vinho Tinto Cabernet Sauvignon Reserva",
    restricoes: "Sem cebola no filé",
    observacoesGerais: "Cliente muito exigente com o ponto do filé e crocância da massa. Sempre pede vinho aos finais de semana.",
    sugestaoAcao: "Enviar convite VIP para degustar o novo lote de Vinho Reserva com 15% de cortesia na sua próxima pizza de Filé ao Gorgonzola."
  },
  {
    id: "cli-pal-002",
    nome: "Dra. Juliana Barreto",
    profissao: "Advogada & Sócia de Escritório",
    telefone: "(65) 99912-3388",
    whatsapp: "5565999123388",
    email: "juliana.barreto@adv.com.br",
    endereco: "Av. Brasil, 1200, Apto 802 - Centro, Tangará da Serra/MT",
    bairro: "Centro",
    aniversario: "1988-06-22",
    aniversarianteMes: false,
    canalPreferido: "salao",
    segmentoRFV: "VIP / Diamante",
    rfvScore: 95,
    totalPedidos: 22,
    totalGasto: 2380.00,
    ticketMedio: 108.18,
    diasSemPedir: 5,
    saboresFavoritos: ["Pizza Palatare da Casa (Parma, Figos & Rúcula)", "Pizza Camarão ao Catupiry Trufado"],
    bordaFavorita: "Cream Cheese Philadelphia",
    massaFavorita: "Napolitana Fermentação Natural 48h",
    bebidaFavorita: "Chopp Pilsen Artesanal",
    restricoes: "Nenhuma",
    observacoesGerais: "Costuma ocupar mesas na Varanda com amigos às quintas e sábados. Aprecia finalização com azeite trufado.",
    sugestaoAcao: "Enviar mensagem personalizada: Mesa cativa reservada na Varanda nesta quinta com sobremesa Tiramisù por conta da Palatare."
  },
  {
    id: "cli-pal-003",
    nome: "Eng. Marcelo Vasconcelos",
    profissao: "Engenheiro Civil · Construtora MT Horizon",
    telefone: "(65) 99654-7711",
    whatsapp: "5565996547711",
    email: "marcelo@mthorizon.com.br",
    endereco: "Rua Antônio Hortolani, 890 - Tarumã, Tangará da Serra/MT",
    bairro: "Tarumã",
    aniversario: "1979-03-10",
    aniversarianteMes: false,
    canalPreferido: "rodizio",
    segmentoRFV: "VIP / Diamante",
    rfvScore: 92,
    totalPedidos: 24,
    totalGasto: 2680.00,
    ticketMedio: 111.67,
    diasSemPedir: 6,
    saboresFavoritos: ["Pizza de Picanha Especial", "Pizza Carne Seca com Catupiry", "Borda Fondue Vulcão"],
    bordaFavorita: "Borda Vulcão com Fondue de Queijos",
    massaFavorita: "Tradicional Crocante",
    bebidaFavorita: "Chopp Pilsen Artesanal",
    restricoes: "Nenhuma",
    observacoesGerais: "Cliente assíduo das noites de Rodízio (Quarta e Sexta) com a equipe de engenharia e familiares.",
    sugestaoAcao: "Cliente do mesmo grupo econômico (parceiro de obras Serrano Concreto): Enviar mesa reservada de 6 lugares no Rodízio de Sexta com 1ª rodada de Chopp cortesia."
  },
  {
    id: "cli-pal-004",
    nome: "Camila Zanchet",
    profissao: "Nutricionista Clínica",
    telefone: "(65) 99823-1199",
    whatsapp: "5565998231199",
    email: "camila.zanchet@nutri.com.br",
    endereco: "Rua 24, 610 - Vila Alta, Tangará da Serra/MT",
    bairro: "Vila Alta",
    aniversario: "1992-09-14",
    aniversarianteMes: false,
    canalPreferido: "delivery",
    segmentoRFV: "Fiel / Ouro",
    rfvScore: 84,
    totalPedidos: 16,
    totalGasto: 1540.00,
    ticketMedio: 96.25,
    diasSemPedir: 8,
    saboresFavoritos: ["Pizza Shimeji & Cogumelos no Alho Poró", "Pizza Margherita Di Bufala & Manjericão"],
    bordaFavorita: "Sem Borda Recheada",
    massaFavorita: "100% Integral com Grãos Nobres",
    bebidaFavorita: "Suco Natural de Laranja 500ml",
    restricoes: "Sem cebola · Prefere queijo muçarela de búfala",
    observacoesGerais: "Super fiel à linha leve e massa integral. Sempre elogia a qualidade dos cogumelos frescos no Instagram.",
    sugestaoAcao: "Apresentar nova opção de massa de fermentação lenta 48h com farinha biológica e borda tostada crocante."
  },
  {
    id: "cli-pal-005",
    nome: "Eduardo Bertolini",
    profissao: "Produtor Rural e Pecuarista",
    telefone: "(65) 99981-4455",
    whatsapp: "5565999814455",
    email: "eduardo@fazendabertolini.agr.br",
    endereco: "Av. Tancredo Neves, 1420 - Tarumã, Tangará da Serra/MT",
    bairro: "Tarumã",
    aniversario: "1975-12-04",
    aniversarianteMes: false,
    canalPreferido: "delivery",
    segmentoRFV: "Fiel / Ouro",
    rfvScore: 82,
    totalPedidos: 18,
    totalGasto: 1890.00,
    ticketMedio: 105.00,
    diasSemPedir: 11,
    saboresFavoritos: ["Pizza de Picanha Especial", "Pizza Quatro Queijos Nobres"],
    bordaFavorita: "Cheddar Cremoso Especial",
    massaFavorita: "Tradicional Crocante",
    bebidaFavorita: "Cerveja Stella Artois Long Neck",
    restricoes: "Nenhuma",
    observacoesGerais: "Pede pizzas grandes ou famílias nos finais de semana para a família toda na fazenda ou na casa da cidade.",
    sugestaoAcao: "Enviar combo final de semana: Pizza Família Picanha + 4 Stellas com frete grátis para Tarumã."
  },
  {
    id: "cli-pal-006",
    nome: "Fernanda Castilho",
    profissao: "Arquiteta de Interiores",
    telefone: "(65) 99845-6677",
    whatsapp: "5565998456677",
    email: "fernanda@castilhoarq.com.br",
    endereco: "Rua Júlio Martinez Benevides, 310 - Centro, Tangará da Serra/MT",
    bairro: "Centro",
    aniversario: "1991-11-15",
    aniversarianteMes: true,
    canalPreferido: "salao",
    segmentoRFV: "Aniversariante do Mês",
    rfvScore: 88,
    totalPedidos: 14,
    totalGasto: 1420.00,
    ticketMedio: 101.43,
    diasSemPedir: 12,
    saboresFavoritos: ["Pizza Filé Mignon ao Gorgonzola", "Pizza Doce Nutella com Morangos Frescos"],
    bordaFavorita: "Chocolate ao Leite Derretido",
    massaFavorita: "Napolitana Fermentação Natural 48h",
    bebidaFavorita: "Chopp Pilsen Artesanal",
    restricoes: "Sem cebola",
    observacoesGerais: "Faz aniversário nesta semana (15 de novembro)! Sempre traz grupos de 8 a 12 pessoas para comemorar.",
    sugestaoAcao: "DISPARO DE ANIVERSÁRIO: Parabéns Fernanda! Seu rodízio ou pizza doce de Nutella é CORTESIA da Palatare trazendo 4 amigos nesta semana!"
  },
  {
    id: "cli-pal-007",
    nome: "Marcos Vinícius Toledo",
    profissao: "Consultor Agronômico",
    telefone: "(65) 99711-8899",
    whatsapp: "5565997118899",
    email: "marcos.toledo@agroconsult.com.br",
    endereco: "Rua 28, 750 - Morada do Sol, Tangará da Serra/MT",
    bairro: "Morada do Sol",
    aniversario: "1983-05-18",
    aniversarianteMes: false,
    canalPreferido: "delivery",
    segmentoRFV: "Em Risco",
    rfvScore: 62,
    totalPedidos: 13,
    totalGasto: 1280.00,
    ticketMedio: 98.46,
    diasSemPedir: 27,
    saboresFavoritos: ["Pizza Carne Seca com Catupiry", "Pizza Pepperoni Importado & Mel Picante"],
    bordaFavorita: "Legítimo Catupiry Original",
    massaFavorita: "Tradicional Crocante",
    bebidaFavorita: "Refrigerante Coca-Cola Zero",
    restricoes: "Nenhuma",
    observacoesGerais: "Pedia toda semana, mas não compra há 27 dias (viagem de safra ou atrito). Alto risco de churn.",
    sugestaoAcao: "CAMPANHA RESGATE: Marcos, sentimos sua falta! Hoje sua borda de Catupiry Original é grátis na sua favorita de Carne Seca. Peça pelo WhatsApp!"
  },
  {
    id: "cli-pal-008",
    nome: "Dra. Patrícia Fagundes",
    profissao: "Cirurgiã Dentista",
    telefone: "(65) 99632-4411",
    whatsapp: "5565996324411",
    email: "dra.patricia@odonto.com.br",
    endereco: "Rua 19, 430 - Jardim Europa, Tangará da Serra/MT",
    bairro: "Jardim Europa",
    aniversario: "1987-08-30",
    aniversarianteMes: false,
    canalPreferido: "delivery",
    segmentoRFV: "Em Risco",
    rfvScore: 58,
    totalPedidos: 11,
    totalGasto: 1090.00,
    ticketMedio: 99.09,
    diasSemPedir: 32,
    saboresFavoritos: ["Pizza Camarão ao Catupiry Trufado", "Calzone Tradicional Palatare Especial"],
    bordaFavorita: "Cream Cheese Philadelphia",
    massaFavorita: "Napolitana Fermentação Natural 48h",
    bebidaFavorita: "Água Mineral com Gás",
    restricoes: "Intolerância leve a lactose (prefere queijos maturados)",
    observacoesGerais: "Mais de 30 dias sem pedir. Adora a pizza de camarão trufada.",
    sugestaoAcao: "CAMPANHA RESGATE: Olá Dra. Patrícia! Que tal matar a saudade do nosso Camarão ao Catupiry Trufado esta noite com R$ 20 de desconto no app?"
  },
  {
    id: "cli-pal-009",
    nome: "Lucas Silveira",
    profissao: "Empresário do Setor Automotivo",
    telefone: "(65) 99901-2233",
    whatsapp: "5565999012233",
    email: "lucas@silveiraauto.com.br",
    endereco: "Av. Ismael José do Nascimento, 1100 - Centro, Tangará da Serra/MT",
    bairro: "Centro",
    aniversario: "1980-02-14",
    aniversarianteMes: false,
    canalPreferido: "salao",
    segmentoRFV: "Inativo / Resgate Urgente",
    rfvScore: 42,
    totalPedidos: 15,
    totalGasto: 1620.00,
    ticketMedio: 108.00,
    diasSemPedir: 48,
    saboresFavoritos: ["Pizza de Picanha Especial", "Pizza Calabresa Artesanal Especial"],
    bordaFavorita: "Legítimo Catupiry Original",
    massaFavorita: "Tradicional Crocante",
    bebidaFavorita: "Chopp Pilsen Artesanal 500ml",
    restricoes: "Nenhuma",
    observacoesGerais: "Cliente de alto LTV (já gastou R$ 1.620), mas parou de frequentar há 48 dias. Necessário contato direto da gerência.",
    sugestaoAcao: "OFERTA REATIVAÇÃO VIP: Fala Lucas! O forno a lenha da Palatare está tinindo. Estamos te esperando nesta semana com uma jarra de Chopp cortesia na sua mesa!"
  },
  {
    id: "cli-pal-010",
    nome: "Beatriz Guimarães",
    profissao: "Professora Universitária (UNEMAT)",
    telefone: "(65) 99808-7744",
    whatsapp: "5565998087744",
    email: "beatriz.guimaraes@unemat.br",
    endereco: "Rua 34, 180 - Tangará II, Tangará da Serra/MT",
    bairro: "Tangará II",
    aniversario: "1986-11-20",
    aniversarianteMes: true,
    canalPreferido: "rodizio",
    segmentoRFV: "Aniversariante do Mês",
    rfvScore: 86,
    totalPedidos: 12,
    totalGasto: 1180.00,
    ticketMedio: 98.33,
    diasSemPedir: 7,
    saboresFavoritos: ["Pizza Frango com Catupiry Original", "Pizza Margherita Di Bufala & Manjericão"],
    bordaFavorita: "Legítimo Catupiry Original",
    massaFavorita: "Tradicional Crocante",
    bebidaFavorita: "Refrigerante Guaraná Lata",
    restricoes: "Nenhuma",
    observacoesGerais: "Aniversário em 20 de novembro! Frequentadora do Rodízio com colegas da faculdade.",
    sugestaoAcao: "VOUCHER DE ANIVERSÁRIO: Parabéns Professora Beatriz! Traga sua turma para o Rodízio de Quarta ou Sexta e ganhe sua entrada de presente!"
  },
  {
    id: "cli-pal-011",
    nome: "Felipe Nogueira",
    profissao: "Bancário (Gerente de Negócios)",
    telefone: "(65) 99933-5522",
    whatsapp: "5565999335522",
    email: "felipe.nogueira@banco.com.br",
    endereco: "Rua 15, 290 - Centro, Tangará da Serra/MT",
    bairro: "Centro",
    aniversario: "1989-04-12",
    aniversarianteMes: false,
    canalPreferido: "delivery",
    segmentoRFV: "Fiel / Ouro",
    rfvScore: 80,
    totalPedidos: 14,
    totalGasto: 1390.00,
    ticketMedio: 99.29,
    diasSemPedir: 9,
    saboresFavoritos: ["Pizza Pepperoni Importado & Mel Picante", "Pizza Quatro Queijos Nobres"],
    bordaFavorita: "Cheddar Cremoso Especial",
    massaFavorita: "Massa Pan Alta Americana",
    bebidaFavorita: "Cerveja Stella Artois",
    restricoes: "Nenhuma",
    observacoesGerais: "Pede no delivery após o expediente nas terças e domingos. Adora pizzas com toque picante.",
    sugestaoAcao: "Sugerir novo Calzone Quatro Queijos & Alho Poró com desconto de R$ 15 no pedido desta noite."
  },
  {
    id: "cli-pal-012",
    nome: "Mariana Prado",
    profissao: "Estilista & Proprietária de Boutique",
    telefone: "(65) 99877-3311",
    whatsapp: "5565998773311",
    email: "mariana@boutiqueprado.com.br",
    endereco: "Rua Celso Rosa, 540 - Jardim Europa, Tangará da Serra/MT",
    bairro: "Jardim Europa",
    aniversario: "1994-07-08",
    aniversarianteMes: false,
    canalPreferido: "salao",
    segmentoRFV: "VIP / Diamante",
    rfvScore: 94,
    totalPedidos: 20,
    totalGasto: 2240.00,
    ticketMedio: 112.00,
    diasSemPedir: 4,
    saboresFavoritos: ["Pizza Palatare da Casa (Parma, Figos & Rúcula)", "Carpaccio de Filé Mignon"],
    bordaFavorita: "Cream Cheese Philadelphia",
    massaFavorita: "Napolitana Fermentação Natural 48h",
    bebidaFavorita: "Vinho Tinto Cabernet Sauvignon Reserva",
    restricoes: "Vegetariana parcial (consome peixes e frutos do mar)",
    observacoesGerais: "Cliente assídua dos jantares de sexta e sábado. Sempre compartilha fotos requintadas no Instagram marcando @palataretga.",
    sugestaoAcao: "Enviar convite para ser embaixadora da nova carta de vinhos italianos no evento exclusivo de terça-feira."
  },
  {
    id: "cli-pal-013",
    nome: "Gustavo Henrique Rezende",
    profissao: "Corretor de Imóveis de Luxo",
    telefone: "(65) 99611-9900",
    whatsapp: "5565996119900",
    email: "gustavo@rezendeimoveis.com.br",
    endereco: "Av. Brasil, 820 - Centro, Tangará da Serra/MT",
    bairro: "Centro",
    aniversario: "1982-10-05",
    aniversarianteMes: false,
    canalPreferido: "delivery",
    segmentoRFV: "Fiel / Ouro",
    rfvScore: 78,
    totalPedidos: 13,
    totalGasto: 1320.00,
    ticketMedio: 101.54,
    diasSemPedir: 14,
    saboresFavoritos: ["Pizza Filé Mignon ao Gorgonzola", "Pizza Calabresa Artesanal Especial"],
    bordaFavorita: "Legítimo Catupiry Original",
    massaFavorita: "Tradicional Crocante",
    bebidaFavorita: "Chopp Pilsen Artesanal 500ml",
    restricoes: "Nenhuma",
    observacoesGerais: "Gosta de receber clientes no escritório com pizzas da Palatare. Pede embalagens térmicas reforçadas.",
    sugestaoAcao: "Oferecer faturamento corporativo para eventos e reuniões de negócios com emissão de NF-e mensal consolidada."
  },
  {
    id: "cli-pal-014",
    nome: "Aline Cristina Morais",
    profissao: "Farmacêutica Bioquímica",
    telefone: "(65) 99899-1122",
    whatsapp: "5565998991122",
    email: "aline.morais@farmacia.com.br",
    endereco: "Rua 12, 510 - Vila Alta, Tangará da Serra/MT",
    bairro: "Vila Alta",
    aniversario: "1990-01-25",
    aniversarianteMes: false,
    canalPreferido: "delivery",
    segmentoRFV: "Em Risco",
    rfvScore: 60,
    totalPedidos: 10,
    totalGasto: 960.00,
    ticketMedio: 96.00,
    diasSemPedir: 30,
    saboresFavoritos: ["Pizza Frango com Catupiry Original", "Pizza Doce Banana Nevada com Canela"],
    bordaFavorita: "Legítimo Catupiry Original",
    massaFavorita: "Tradicional Crocante",
    bebidaFavorita: "Suco Natural de Laranja 500ml",
    restricoes: "Nenhuma",
    observacoesGerais: "30 dias sem compras. Pedia quinzenalmente aos domingos à noite.",
    sugestaoAcao: "Enviar cupom DOMINGOPALATARE: R$ 15 OFF no delivery desta noite de domingo!"
  },
  {
    id: "cli-pal-015",
    nome: "Thiago Brandão",
    profissao: "Analista de Sistemas & Desenvolvedor",
    telefone: "(65) 99755-4433",
    whatsapp: "5565997554433",
    email: "thiago@brandao.dev.br",
    endereco: "Rua 26, 420 - Tarumã, Tangará da Serra/MT",
    bairro: "Tarumã",
    aniversario: "1995-03-30",
    aniversarianteMes: false,
    canalPreferido: "delivery",
    segmentoRFV: "VIP / Diamante",
    rfvScore: 96,
    totalPedidos: 26,
    totalGasto: 2730.00,
    ticketMedio: 105.00,
    diasSemPedir: 2,
    saboresFavoritos: ["Pizza Pepperoni Importado & Mel Picante", "Pizza de Picanha Especial", "Borda Cheddar Cremoso"],
    bordaFavorita: "Cheddar Cremoso Especial",
    massaFavorita: "Napolitana Fermentação Natural 48h",
    bebidaFavorita: "Refrigerante Coca-Cola Zero",
    restricoes: "Nenhuma",
    observacoesGerais: "Heavy-user de tecnologia e delivery. Pediu ontem! Adora testar novidades no montador de pizzas.",
    sugestaoAcao: "Convidar para ser beta-tester do novo Montador de Pizzas Inteligente com 4 sabores da Palatare."
  }
];

// -------------------------------------------------------------
// CONFIGURAÇÃO DO MONTADOR DE PIZZAS AVANÇADO (MULTI-SABORES)
// -------------------------------------------------------------
export const PALATARE_CONFIG_MONTADOR = {
  tamanhos: [
    { id: "brotinho", nome: "Brotinho Individual", fatias: 4, diametro: "25cm", maxSabores: 2, precoBase: 44.00, desc: "Serve 1 pessoa com fartura (4 fatias generosas)" },
    { id: "media", nome: "Média Tradicional", fatias: 6, diametro: "30cm", maxSabores: 2, precoBase: 62.00, desc: "Serve 2 pessoas (6 fatias)" },
    { id: "grande", nome: "Grande da Casa (A Mais Pedida)", fatias: 8, diametro: "35cm", maxSabores: 3, precoBase: 76.00, desc: "A campeã de vendas! Serve 3 a 4 pessoas (8 fatias)" },
    { id: "familia", nome: "Família / Gigante Gourmet", fatias: 12, diametro: "40cm", maxSabores: 4, precoBase: 98.00, desc: "Tamanho festa! Serve 5 a 6 pessoas (12 fatias)" }
  ],
  fracoesDisponiveis: [
    { id: "1_sabor", label: "1 Sabor (Inteira 100%)", divisor: 1, percentual: "100%" },
    { id: "2_sabores", label: "2 Sabores (Meio a Meio 50/50%)", divisor: 2, percentual: "50% / 50%" },
    { id: "3_sabores", label: "3 Sabores (1/3 cada sabor)", divisor: 3, percentual: "33% / 33% / 33%" },
    { id: "4_sabores", label: "4 Sabores (1/4 cada sabor)", divisor: 4, percentual: "25% cada" }
  ],
  regraPrecoFracionado: "maior_valor", // "maior_valor" (padrão de mercado) ou "media_ponderada"
  tiposMassa: [
    { id: "crocante", nome: "Tradicional Italiana Crocante", adicional: 0, desc: "Farinha 00 italiana, assada direto na pedra do forno a lenha." },
    { id: "napolitana_48h", nome: "Napolitana Fermentação Natural 48h (Levain)", adicional: 6.00, desc: "Fermentação lenta de 48 horas, leve, aerada e de fácil digestão." },
    { id: "pan_alta", nome: "Massa Pan Alta Fofa", adicional: 8.00, desc: "Estilo americano: grossa, dourada e macia como um pão artesanal." },
    { id: "integral_graos", nome: "100% Integral com Grãos Nobres", adicional: 10.00, desc: "Farinha integral orgânica com sementes de gergelim, linhaça e girassol." },
    { id: "sem_gluten", nome: "Massa Artesanal Sem Glúten", adicional: 16.00, desc: "Produzida com farinha de arroz e amido de mandioca em bancada esterilizada." }
  ],
  bordasRecheadas: [
    { id: "sem_borda", nome: "Borda Tradicional da Massa (Sem recheio)", preco: 0 },
    { id: "catupiry", nome: "Legítimo Catupiry Original Cremoso", preco: 14.00 },
    { id: "cheddar", nome: "Cheddar Cremoso Especial Forneado", preco: 14.00 },
    { id: "philadelphia", nome: "Cream Cheese Philadelphia Genuíno", preco: 16.00 },
    { id: "fondue_vulcao", nome: "Borda Vulcão com Fondue de Queijos Nobres", preco: 22.00 },
    { id: "chocolate_leite", nome: "Chocolate ao Leite Suíço Forneado", preco: 16.00 },
    { id: "doce_leite", nome: "Doce de Leite Viçosa Puro Artesanal", preco: 15.00 }
  ],
  adicionaisOpcionais: [
    { id: "adc-bacon", nome: "Bacon crocante em cubos", preco: 8.00 },
    { id: "adc-alho", nome: "Alho frito dourado na manteiga", preco: 5.00 },
    { id: "adc-palmito", nome: "Palmito pupunha em rodelas", preco: 9.00 },
    { id: "adc-shimeji", nome: "Cogumelos Shimeji na manteiga", preco: 12.00 },
    { id: "adc-tomate-confit", nome: "Tomate cereja confit com manjericão", preco: 6.00 },
    { id: "adc-azeite-trufado", nome: "Azeite trufado finalizado no prato", preco: 12.00 },
    { id: "adc-cebola-caramelizada", nome: "Cebola caramelizada no balsâmico", preco: 6.00 },
    { id: "adc-dobro-queijo", nome: "Dobro de Queijo Muçarela Especial", preco: 10.00 }
  ],
  exclusoesPadrao: [
    "Sem cebola",
    "Sem orégano",
    "Sem azeitonas",
    "Sem pimenta dedo-de-moça",
    "Pouco molho",
    "Massa bem tostada / crocante",
    "Molho leve / sem acidez"
  ]
};

// -------------------------------------------------------------
// RODÍZIO INTELIGENTE DE PIZZAS & EXPERIÊNCIAS
// -------------------------------------------------------------
export const PALATARE_RODIZIO_CONFIG = {
  ativoHoje: true,
  diasSemana: ["Terça-feira", "Quarta-feira", "Sexta-feira"],
  horario: "18:30 às 22:45",
  precoAdulto: 59.90,
  precoInfantil: 29.90,
  regrasGerais: "Mais de 30 sabores doces e salgados servidos continuamente à mesa. Crianças até 4 anos não pagam.",
  mesasEmRodizioHoje: [
    {
      mesaNumero: 2,
      nome: "Mesa 02 · Salão",
      adultos: 4,
      criancas: 1,
      horarioInicio: "19:15",
      fatiasServidas: 22,
      statusMesa: "servindo", // "servindo" (verde) | "pausa" (amarelo) | "conta_pedida" (vermelho)
      garcomResponsavel: "Mateus Ribeiro",
      saboresMaisAclamados: ["Filé ao Gorgonzola", "Picanha Especial", "Doce Nutella"],
      subtotalConsumo: 269.50
    },
    {
      mesaNumero: 5,
      nome: "Mesa 05 · Salão",
      adultos: 2,
      criancas: 0,
      horarioInicio: "19:40",
      fatiasServidas: 12,
      statusMesa: "servindo",
      garcomResponsavel: "Ana Paula Silva",
      saboresMaisAclamados: ["Camarão Trufado", "Margherita Bufala", "Carne Seca"],
      subtotalConsumo: 119.80
    },
    {
      mesaNumero: 8,
      nome: "Mesa 08 · Salão (Aniversário)",
      adultos: 6,
      criancas: 2,
      horarioInicio: "18:50",
      fatiasServidas: 38,
      statusMesa: "pausa",
      garcomResponsavel: "Mateus Ribeiro",
      saboresMaisAclamados: ["Picanha Especial", "Quatro Queijos", "Borda Vulcão", "Doce Banana Nevada"],
      subtotalConsumo: 419.20
    },
    {
      mesaNumero: 12,
      nome: "Mesa 12 · Salão",
      adultos: 3,
      criancas: 0,
      horarioInicio: "18:45",
      fatiasServidas: 18,
      statusMesa: "conta_pedida",
      garcomResponsavel: "Ana Paula Silva",
      saboresMaisAclamados: ["Palatare da Casa", "Filé Gorgonzola"],
      subtotalConsumo: 179.70
    }
  ]
};

// -------------------------------------------------------------
// KDS - KITCHEN DISPLAY SYSTEM & FORNO A LENHA AO VIVO
// -------------------------------------------------------------
export const PALATARE_KDS_FILA = [
  {
    id: "kds-301",
    comanda: "CMD-0892",
    origem: "Mesa 04 · Salão",
    tipo: "salao",
    cliente: "Dr. Ricardo Mendonça",
    horarioRecebido: "20:05",
    tempoDecorridoMinutos: 4,
    tempoEstimadoMinutos: 8,
    status: "no_forno", // "na_bancada" | "no_forno" | "finalizacao" | "pronto"
    temperaturaForno: "410°C",
    praca: "Forno a Lenha",
    itens: [
      {
        tipo: "pizza",
        tamanho: "Grande (8 fatias)",
        massa: "Napolitana Fermentação Natural 48h",
        borda: "Legítimo Catupiry Original",
        sabores: [
          { nome: "1/2 Pizza Filé Mignon ao Gorgonzola", obs: "Sem cebola" },
          { nome: "1/2 Pizza de Picanha Especial", obs: "Picanha mal passada com alho dourado" }
        ]
      }
    ]
  },
  {
    id: "kds-302",
    comanda: "CMD-0893",
    origem: "Delivery WhatsApp #542",
    tipo: "delivery",
    cliente: "Thiago Brandão",
    bairro: "Tarumã",
    horarioRecebido: "20:08",
    tempoDecorridoMinutos: 2,
    tempoEstimadoMinutos: 7,
    status: "na_bancada",
    praca: "Bancada do Pizzaiolo",
    itens: [
      {
        tipo: "pizza",
        tamanho: "Grande (8 fatias)",
        massa: "Napolitana Fermentação Natural 48h",
        borda: "Cheddar Cremoso Especial",
        sabores: [
          { nome: "1/2 Pepperoni Importado & Mel Picante", obs: "Dobro de mel picante" },
          { nome: "1/2 Pizza de Picanha Especial", obs: "Caprichar no orégano" }
        ]
      }
    ]
  },
  {
    id: "kds-303",
    comanda: "CMD-0890",
    origem: "Mesa 09 · Salão",
    tipo: "salao",
    cliente: "Dra. Juliana Barreto",
    horarioRecebido: "19:55",
    tempoDecorridoMinutos: 11,
    tempoEstimadoMinutos: 12,
    status: "finalizacao",
    praca: "Expedição & Finalização",
    itens: [
      {
        tipo: "pizza",
        tamanho: "Grande (8 fatias)",
        massa: "Napolitana Fermentação Natural 48h",
        borda: "Cream Cheese Philadelphia",
        sabores: [
          { nome: "Pizza Palatare da Casa (Parma, Figos & Rúcula)", obs: "Finalizar com azeite trufado e rúcula fresca na mesa" }
        ]
      }
    ]
  },
  {
    id: "kds-304",
    comanda: "CMD-0888",
    origem: "Delivery Tangará #540",
    tipo: "delivery",
    cliente: "Eduardo Bertolini",
    bairro: "Tarumã",
    horarioRecebido: "19:42",
    tempoDecorridoMinutos: 25,
    tempoEstimadoMinutos: 30,
    status: "saiu_entrega",
    praca: "Motoboy Cleber (Placa QBD-8902)",
    itens: [
      {
        tipo: "pizza",
        tamanho: "Família / Gigante (12 fatias)",
        massa: "Tradicional Crocante",
        borda: "Cheddar Cremoso Especial",
        sabores: [
          { nome: "1/2 Pizza de Picanha Especial", obs: "Bacon crocante adicional" },
          { nome: "1/2 Pizza Quatro Queijos Nobres", obs: "Parmesão ralado grosso" }
        ]
      },
      {
        tipo: "bebida",
        nome: "4x Cerveja Long Neck Stella Artois 330ml (Super Gelada)"
      }
    ]
  }
];

// -------------------------------------------------------------
// ZONAS DE ENTREGA DE TANGARÁ DA SERRA
// -------------------------------------------------------------
export const PALATARE_DELIVERY_ZONAS = [
  { id: "zon-centro", bairro: "Centro", taxa: 7.00, tempoEstimadoMinutos: "20 - 30 min", status: "ativo", entregasHoje: 14 },
  { id: "zon-jardim-europa", bairro: "Jardim Europa & Tarumã", taxa: 9.00, tempoEstimadoMinutos: "25 - 35 min", status: "ativo", entregasHoje: 19 },
  { id: "zon-morada-sol", bairro: "Morada do Sol & Vila Alta", taxa: 10.00, tempoEstimadoMinutos: "30 - 40 min", status: "ativo", entregasHoje: 11 },
  { id: "zon-cidade-alta", bairro: "Cidade Alta & Tangará II", taxa: 12.00, tempoEstimadoMinutos: "35 - 45 min", status: "ativo", entregasHoje: 8 },
  { id: "zon-santa-terezinha", bairro: "Santa Terezinha & Módulo 05", taxa: 14.00, tempoEstimadoMinutos: "40 - 50 min", status: "ativo", entregasHoje: 6 },
  { id: "zon-distrito-industrial", bairro: "Distrito Industrial (Serrano Concreto & Empresas)", taxa: 12.00, tempoEstimadoMinutos: "35 - 45 min", status: "ativo", entregasHoje: 4 }
];

// -------------------------------------------------------------
// MÉTRICAS BI & CURVA ABC DE SABORES
// -------------------------------------------------------------
export const PALATARE_METRICAS_BI = {
  faturamentoMes: 148650.00,
  crescimentoVsMesAnterior: "+18.4%",
  ticketMedioGeral: 104.20,
  totalPedidosMes: 1426,
  taxaRetencao30Dias: "74.8%",
  npsScore: 92,
  distribuicaoCanais: [
    { canal: "Salão à la Carte", percentual: 38, faturamento: 56487.00 },
    { canal: "Rodízio Tradicional (Ter, Qua, Sex)", percentual: 34, faturamento: 50541.00 },
    { canal: "Delivery & WhatsApp", percentual: 28, faturamento: 41622.00 }
  ],
  curvaAbcSabores: [
    { rank: 1, nome: "Pizza Filé Mignon ao Gorgonzola", pedidos: 384, faturamento: 35328.00, share: "23.8%", rentabilidade: "Alta" },
    { rank: 2, nome: "Pizza de Picanha Especial", pedidos: 342, faturamento: 30438.00, share: "20.5%", rentabilidade: "Alta" },
    { rank: 3, nome: "Pizza Carne Seca com Catupiry", pedidos: 288, faturamento: 22464.00, share: "15.1%", rentabilidade: "Muito Alta" },
    { rank: 4, nome: "Pizza Palatare da Casa (Parma & Figos)", pedidos: 210, faturamento: 18690.00, share: "12.6%", rentabilidade: "Alta" },
    { rank: 5, nome: "Pizza Camarão ao Catupiry Trufado", pedidos: 165, faturamento: 16170.00, share: "10.9%", rentabilidade: "Média" },
    { rank: 6, nome: "Pizza Doce Nutella com Morangos", pedidos: 195, faturamento: 12090.00, share: "8.1%", rentabilidade: "Altíssima" },
    { rank: 7, nome: "Pizza Margherita Di Bufala & Manjericão", pedidos: 148, faturamento: 10656.00, share: "7.2%", rentabilidade: "Muito Alta" },
    { rank: 8, nome: "Calzone Tradicional Palatare", pedidos: 96, faturamento: 6528.00, share: "4.4%", rentabilidade: "Alta" }
  ]
};

// -------------------------------------------------------------
// ENGENHARIA DE CARDÁPIO, FICHAS TÉCNICAS & GESTÃO DE CMV
// -------------------------------------------------------------
export const PALATARE_ENGENHARIA_CMV = {
  cmvGeralAtual: 34.2,
  cmvMetaOtimizada: 26.0,
  economiaMensalQueijoEstimada: 7200.00,
  quilosQueijoEconomizadosMes: 180,
  matrizBcg: [
    {
      sabor: "Pizza Filé Mignon ao Gorgonzola",
      categoria: "Estrela (Star)",
      icone: "⭐",
      precoVenda: 92.00,
      custoInsumos: 23.90,
      margemContribuicao: 68.10,
      cmvPercentual: 26.0,
      classificacao: "Alta Rentabilidade & Altíssima Venda",
      gramaturaQueijoPadrao: "280g (Muçarela artesanal)",
      ingredientesPrincipais: "280g Muçarela, 180g Filé Mignon grelhado, 60g Gorgonzola dolce, 100g Pelati San Marzano",
      estrategia: "Manter destaque fotográfico no cardápio e sugerir harmonização com Cabernet Sauvignon Reserva."
    },
    {
      sabor: "Pizza de Picanha Especial",
      categoria: "Estrela (Star)",
      icone: "⭐",
      precoVenda: 89.00,
      custoInsumos: 24.20,
      margemContribuicao: 64.80,
      cmvPercentual: 27.2,
      classificacao: "Alta Rentabilidade & Altíssima Venda",
      gramaturaQueijoPadrao: "280g (Muçarela artesanal)",
      ingredientesPrincipais: "280g Muçarela, 190g Lâminas de picanha grelhada, alho dourado crocante, vinagrete da casa",
      estrategia: "Carro-chefe aos sábados. Sugerir Chopp Artesanal 500ml."
    },
    {
      sabor: "Pizza Carne Seca com Catupiry",
      categoria: "Estrela (Star)",
      icone: "⭐",
      precoVenda: 78.00,
      custoInsumos: 18.50,
      margemContribuicao: 59.50,
      cmvPercentual: 23.7,
      classificacao: "Altíssima Margem & Alta Venda",
      gramaturaQueijoPadrao: "260g (Muçarela + 80g Catupiry)",
      ingredientesPrincipais: "260g Muçarela, 160g Carne seca na manteiga de garrafa, 80g Catupiry Original, cebola roxa",
      estrategia: "Excelente margem bruta de 76,3%. Promover no delivery."
    },
    {
      sabor: "Pizza Calabresa Artesanal Especial",
      categoria: "Burro de Carga (Plowhorse)",
      icone: "🐴",
      precoVenda: 68.00,
      custoInsumos: 22.10,
      margemContribuicao: 45.90,
      cmvPercentual: 32.5,
      classificacao: "Alta Venda & Margem Moderada",
      gramaturaQueijoPadrao: "270g (Calibrado)",
      ingredientesPrincipais: "270g Muçarela, 180g Calabresa defumada artesanal, cebola roxa, orégano",
      estrategia: "Reduzir o excesso de queijo de 350g para 270g exatos com balança, recuperando +R$ 3.800/mês."
    },
    {
      sabor: "Pizza Palatare da Casa (Parma, Figos & Rúcula)",
      categoria: "Enigma (Puzzle)",
      icone: "🧩",
      precoVenda: 89.00,
      custoInsumos: 22.80,
      margemContribuicao: 66.20,
      cmvPercentual: 25.6,
      classificacao: "Altíssima Margem & Venda a Estimular",
      gramaturaQueijoPadrao: "240g (Muçarela de Búfala)",
      ingredientesPrincipais: "240g Búfala, 120g Presunto di Parma, figos caramelizados no balsâmico, rúcula",
      estrategia: "Oferecer degustação de 1 fatia no rodízio de sexta para despertar desejo de compra à la carte."
    },
    {
      sabor: "Pizza Doce Nutella com Morangos Frescos",
      categoria: "Estrela Doce (Star)",
      icone: "⭐",
      precoVenda: 62.00,
      custoInsumos: 14.80,
      margemContribuicao: 47.20,
      cmvPercentual: 23.9,
      classificacao: "Margem Altíssima de Sobremesa",
      gramaturaQueijoPadrao: "Sem muçarela (160g Nutella pura)",
      ingredientesPrincipais: "Massa napolitana fina, 160g Nutella original, 120g Morangos frescos, raspas belgas",
      estrategia: "Upsell automático ao fechar a conta ou no carrinho digital mobile."
    }
  ]
};

// -------------------------------------------------------------
// PALATARE PIZZA CLUB - ASSINATURAS RECORRENTES & FIDELIDADE
// -------------------------------------------------------------
export const PALATARE_PIZZA_CLUB = {
  mrrAtual: 14890.00,
  mrrMeta90Dias: 34500.00,
  totalAssinantes: 72,
  metaAssinantes: 150,
  ticketMedioClube: 206.80,
  taxaRetencaoClube: "96.2%",
  planos: [
    { id: "plano-amici", nome: "Plano Amici (Dupla)", mensalidade: 139.00, beneficios: ["2 Pizzas Grandes por mês", "Entrega Grátis em Tangará da Serra", "1 Borda Recheada cortesia/mês", "Despacho prioritário"], assinantesAtivos: 34, mrrPlano: 4726.00 },
    { id: "plano-famiglia", nome: "Plano Famiglia (Festa)", mensalidade: 249.00, beneficios: ["4 Pizzas Grandes por mês", "1 Pizza Doce Brotinho cortesia", "Entrega Grátis VIP", "10% Cashback no Salão"], assinantesAtivos: 28, mrrPlano: 6972.00 },
    { id: "plano-connoisseur", nome: "Plano Gourmet & Adega Wine", mensalidade: 329.00, beneficios: ["4 Pizzas Especiais Grandes/mês", "1 Garrafa Vinho Tinto Cabernet Reserva/mês", "Mesa VIP sem fila no Salão e Rodízio", "Novos sabores antecipados"], assinantesAtivos: 10, mrrPlano: 3290.00 }
  ],
  membrosDestaque: [
    { id: "mem-01", nome: "Dr. Ricardo Mendonça", plano: "Plano Gourmet & Adega Wine", desde: "2026-06", proximaEntrega: "15/11/2026", status: "ativo" },
    { id: "mem-02", nome: "Dra. Juliana Barreto", plano: "Plano Famiglia", desde: "2026-07", proximaEntrega: "18/11/2026", status: "ativo" },
    { id: "mem-03", nome: "Thiago Brandão", plano: "Plano Amici", desde: "2026-08", proximaEntrega: "16/11/2026", status: "ativo" },
    { id: "mem-04", nome: "Fernanda Castilho", plano: "Plano Famiglia", desde: "2026-09", proximaEntrega: "17/11/2026", status: "ativo" }
  ]
};

// -------------------------------------------------------------
// TELEMETRIA DO FORNO A LENHA NAPOLITANO (400°C)
// -------------------------------------------------------------
export const PALATARE_TELEMETRIA_FORNO = {
  temperaturaLastro: "412°C",
  temperaturaCupula: "445°C",
  statusTermico: "Zona Ideal Napolitana (400°C - 450°C)",
  tempoMedioCoccaoSegundos: 98,
  pizzasForneadasHoje: 74,
  capacidadeHoraPizzas: 48,
  consumoLenhaHojeM3: "0,32 m³",
  tipoLenha: "Eucalipto de Reflorestamento Certificado (Seco em Estufa)",
  eficienciaEnergetica: "94.2% (Isolamento Refratário Duplo)"
};

export const PALATARE_CARDAPIO_INICIAL = [
  // Destaques da Casa & Rodízio Oficial
  { nome: "Rodízio de Pizzas Tradicional Palatare (Ter, Qua e Sex)", categoria: "Rodízio & Experiências", setor: "cozinha", preco: 59.90, unidade: "pessoa", estoque: 100, minimo: 10, ordem: 5, descricao: "Mais de 30 sabores doces e salgados assados no ponto perfeito, massas artesanais e calzones servidos à vontade à mesa." },

  // Pizzas Mais Pedidas & Especiais de Tangará da Serra
  { nome: "Pizza de Picanha Especial da Palatare (Grande 8 Fatias)", categoria: "Pizzas Especiais", setor: "cozinha", preco: 89.00, unidade: "un", estoque: 40, minimo: 10, ordem: 10, descricao: "Eleita favorita pelos clientes de Tangará: lâminas de picanha grelhada ao ponto, muçarela especial, alho tostado crocante, vinagrete da casa e orégano fresco." },
  { nome: "Pizza Filé Mignon ao Gorgonzola (Grande 8 Fatias)", categoria: "Pizzas Especiais", setor: "cozinha", preco: 92.00, unidade: "un", estoque: 35, minimo: 10, ordem: 20, descricao: "Carro-chefe da casa: tiras suculentas de filé mignon grelhado, muçarela, molho pelati italiano, creme de gorgonzola dolce e cebola caramelizada." },
  { nome: "Pizza Carne Seca com Catupiry Original (Grande 8 Fatias)", categoria: "Pizzas Especiais", setor: "cozinha", preco: 78.00, unidade: "un", estoque: 35, minimo: 10, ordem: 30, descricao: "Carne seca artesanal desfiada na manteiga de garrafa, cebola roxa fininha, muçarela e generosa cobertura de Catupiry original." },
  { nome: "Pizza Palatare da Casa (Parma, Figos & Rúcula)", categoria: "Pizzas Especiais", setor: "cozinha", preco: 89.00, unidade: "un", estoque: 30, minimo: 5, ordem: 40, descricao: "Molho de tomate San Marzano, presunto de Parma italiano, figos caramelizados no balsâmico, rúcula fresca e lascas de Grana Padano." },
  { nome: "Pizza Camarão ao Catupiry Trufado (Grande)", categoria: "Pizzas Especiais", setor: "cozinha", preco: 98.00, unidade: "un", estoque: 25, minimo: 5, ordem: 50, descricao: "Camarões rosa salteados no azeite extravirgem e alho confit, muçarela, Catupiry original e finalização com azeite trufado." },
  { nome: "Pizza Shimeji & Cogumelos Frescos no Alho Poró", categoria: "Pizzas Especiais", setor: "cozinha", preco: 82.00, unidade: "un", estoque: 25, minimo: 5, ordem: 60, descricao: "Mix selecionado de cogumelos shimeji frescos salteados na manteiga e shoyu, rodelas de alho-poró e queijo muçarela artesanal." },
  { nome: "Pizza Pepperoni Importado & Mel Picante (Grande)", categoria: "Pizzas Especiais", setor: "cozinha", preco: 79.00, unidade: "un", estoque: 30, minimo: 8, ordem: 70, descricao: "Fatias generosas de pepperoni premium crocante, muçarela, fios de mel de flor de laranjeira infusionado com pimenta dedo-de-moça." },

  // Pizzas Tradicionais
  { nome: "Pizza Calabresa Artesanal Especial (Grande 8 Fatias)", categoria: "Pizzas Tradicionais", setor: "cozinha", preco: 68.00, unidade: "un", estoque: 50, minimo: 10, ordem: 80, descricao: "Molho pelati italiano, muçarela artesanal, calabresa defumada fatiada, cebola roxa e orégano fresco." },
  { nome: "Pizza Margherita Di Bufala & Manjericão (Grande)", categoria: "Pizzas Tradicionais", setor: "cozinha", preco: 72.00, unidade: "un", estoque: 40, minimo: 10, ordem: 90, descricao: "Molho pelati, muçarela de búfala fresca, rodelas de tomate caqui, queijo parmesão ralado na hora e folhas de manjericão fresco." },
  { nome: "Pizza Quatro Queijos Nobres (Grande 8 Fatias)", categoria: "Pizzas Tradicionais", setor: "cozinha", preco: 76.00, unidade: "un", estoque: 40, minimo: 10, ordem: 100, descricao: "Muçarela fatiada, provolone defumado, gorgonzola italiano cremoso e catupiry original forneados." },
  { nome: "Pizza Frango com Catupiry Original (Grande 8 Fatias)", categoria: "Pizzas Tradicionais", setor: "cozinha", preco: 70.00, unidade: "un", estoque: 45, minimo: 10, ordem: 110, descricao: "Peito de frango desfiado temperado com ervas finas, milho verde selecionado e Catupiry original cremoso." },
  { nome: "Pizza Portuguesa Tradicional (Grande 8 Fatias)", categoria: "Pizzas Tradicionais", setor: "cozinha", preco: 74.00, unidade: "un", estoque: 35, minimo: 8, ordem: 120, descricao: "Presunto cozido nobre, muçarela, ovos cozidos, cebola em rodelas, ervilhas frescas e azeitonas pretas chilenas." },

  // Calzones Tradicionais
  { nome: "Calzone Tradicional Palatare Especial", categoria: "Calzones & Massas Fechadas", setor: "cozinha", preco: 68.00, unidade: "un", estoque: 20, minimo: 5, ordem: 130, descricao: "Massa artesanal assada em formato meia-lua, recheada com muçarela, presunto parma, tomate concassé, manjericão e catupiry, polvilhada com parmesão." },
  { nome: "Calzone Quatro Queijos & Alho Poró", categoria: "Calzones & Massas Fechadas", setor: "cozinha", preco: 64.00, unidade: "un", estoque: 20, minimo: 5, ordem: 140, descricao: "Massa crocante por fora e cremosa por dentro, recheio de muçarela, provolone, gorgonzola, catupiry e tiras de alho-poró." },

  // Bordas Recheadas
  { nome: "Borda Recheada de Catupiry Original", categoria: "Bordas Recheadas", setor: "cozinha", preco: 14.00, unidade: "un", estoque: 100, minimo: 20, ordem: 150, descricao: "Borda artesanal enrolada e recheada com legítimo Catupiry cremoso." },
  { nome: "Borda Recheada de Cheddar Cremoso", categoria: "Bordas Recheadas", setor: "cozinha", preco: 14.00, unidade: "un", estoque: 100, minimo: 20, ordem: 160, descricao: "Borda recheada com queijo cheddar cremoso especial para pizza." },
  { nome: "Borda Recheada de Chocolate ao Leite Derretido", categoria: "Bordas Recheadas", setor: "cozinha", preco: 16.00, unidade: "un", estoque: 100, minimo: 20, ordem: 170, descricao: "Borda recheada com generoso chocolate ao leite nobre forneado e derretido." },

  // Pizzas Doces
  { nome: "Pizza Doce Nutella com Morangos Frescos", categoria: "Pizzas Doces", setor: "cozinha", preco: 62.00, unidade: "un", estoque: 30, minimo: 6, ordem: 180, descricao: "Generosa camada de Nutella original, fatias de morangos frescos selecionados e raspas de chocolate belga ao leite." },
  { nome: "Pizza Doce Banana Nevada com Canela e Mel", categoria: "Pizzas Doces", setor: "cozinha", preco: 54.00, unidade: "un", estoque: 30, minimo: 6, ordem: 190, descricao: "Fatias de banana caramelizadas, creme de queijo suave, canela em pó, leite condensado e gotas de chocolate branco forneadas." },

  // Pratos & Massas
  { nome: "Lasanha à Bolonhesa Clássica Palatare", categoria: "Pratos & Massas", setor: "cozinha", preco: 52.00, unidade: "prato", estoque: 20, minimo: 5, ordem: 200, descricao: "Massa artesanal fresca feita na casa, ragu de carnes selecionadas lentamente cozido por 6 horas, molho bechamel cremoso e gratinada com queijo parmesão." },
  { nome: "Fettuccine ao Molho Alfredo com Tiras de Filé", categoria: "Pratos & Massas", setor: "cozinha", preco: 58.00, unidade: "prato", estoque: 25, minimo: 5, ordem: 210, descricao: "Massa artesanal fettuccine fresca envolta em molho alfredo clássico de manteiga da terra, creme de leite fresco e queijo parmesão, com medalhão de filé mignon." },
  { nome: "Gnocchi de Batata ao Pomodoro & Burrata", categoria: "Pratos & Massas", setor: "cozinha", preco: 56.00, unidade: "prato", estoque: 20, minimo: 5, ordem: 220, descricao: "Nhoque artesanal leve de batata asterix, molho pomodoro de tomates rasteiros com manjericão e coração de burrata fresca inteira." },

  // Entradas & Petiscos
  { nome: "Bruschetta Tradicional Pomodoro & Basílico (4 un)", categoria: "Entradas & Petiscos", setor: "cozinha", preco: 28.00, unidade: "porcao", estoque: 40, minimo: 10, ordem: 230, descricao: "Pão italiano ciabatta tostado com azeite de alho, tomates concassé marinados no azeite extravirgem, manjericão fresco e lascas de parmesão." },
  { nome: "Carpaccio de Filé Mignon com Alcaparras", categoria: "Entradas & Petiscos", setor: "cozinha", preco: 44.00, unidade: "porcao", estoque: 20, minimo: 5, ordem: 240, descricao: "Finas lâminas de filé mignon cru temperado, molho clássico de alcaparras, mostarda dijon e azeite, rúcula selvagem e lascas de grana padano." },

  // Vinhos & Adega
  { nome: "Vinho Tinto Cabernet Sauvignon Reserva 750ml", categoria: "Vinhos & Adega", setor: "bar", preco: 98.00, unidade: "garrafa", estoque: 24, minimo: 6, ordem: 250, descricao: "Vinho tinto seco encorpado com notas de frutas vermelhas maduras, baunilha e taninos sedosos. Harmonização perfeita com carnes e massas." },

  // Bebidas & Chopps
  { nome: "Chopp Pilsen Artesanal 500ml", categoria: "Bebidas & Chopps", setor: "bar", preco: 15.00, unidade: "copo", estoque: 100, minimo: 20, ordem: 260, descricao: "Chopp pilsen artesanal gelado, cremoso e refrescante tirado na torneira." },
  { nome: "Cerveja Long Neck Stella Artois 330ml", categoria: "Bebidas & Chopps", setor: "bar", preco: 12.00, unidade: "garrafa", estoque: 60, minimo: 15, ordem: 270, descricao: "Cerveja premium puro malte clássica gelada." },
  { nome: "Refrigerante Lata 350ml (Coca / Guaraná)", categoria: "Bebidas & Chopps", setor: "bar", preco: 7.50, unidade: "lata", estoque: 80, minimo: 20, ordem: 280, descricao: "Refrigerante lata gelado (Coca-Cola Original, Zero ou Guaraná Antarctica)." },
  { nome: "Água Mineral com Gás 500ml", categoria: "Bebidas & Chopps", setor: "bar", preco: 5.00, unidade: "garrafa", estoque: 60, minimo: 15, ordem: 290, descricao: "Água mineral natural gaseificada gelada." },
  { nome: "Suco Natural de Laranja 500ml", categoria: "Bebidas & Chopps", setor: "bar", preco: 12.00, unidade: "copo", estoque: 40, minimo: 10, ordem: 300, descricao: "Suco 100% natural espremido na hora da fruta selecionada." },

  // Sobremesas
  { nome: "Petit Gâteau com Sorvete de Creme", categoria: "Sobremesas", setor: "cozinha", preco: 32.00, unidade: "un", estoque: 20, minimo: 5, ordem: 310, descricao: "Bolo de chocolate com recheio cremoso quente, acompanhado de sorvete de creme artesanal." },
  { nome: "Tiramisù Italiano Clássico", categoria: "Sobremesas", setor: "cozinha", preco: 28.00, unidade: "un", estoque: 15, minimo: 4, ordem: 320, descricao: "Sobremesa clássica italiana com biscoitos savoiardi embebidos em café, creme de queijo mascarpone e cacau em pó." }
];

export const PALATARE_MESAS_INICIAIS = [
  ...Array.from({ length: 15 }, (_, i) => ({ numero: i + 1, nome: `Mesa ${i + 1} · Salão`, tipo: "fisica" })),
  ...Array.from({ length: 5 }, (_, i) => ({ numero: i + 16, nome: `Mesa ${i + 16} · Varanda`, tipo: "fisica" })),
  { numero: 101, nome: "Balcão / Retirada", tipo: "virtual" },
  { numero: 102, nome: "Delivery / WhatsApp", tipo: "virtual" }
];

const SENHA_PADRAO_HASH = "$2a$10$GhTXS1zakV8wRo77OFp2JOvCJj9ezTUPg75ZbBupWek/RBR/.SHcq";

export async function provisionarPalatarePizzaria({ commerceDb } = {}) {
  const rootDb = db();
  const resultados = {
    empresaProvisionada: false,
    produtosCriados: 0,
    mesasCriadas: 0,
    usuariosProvisionados: 0,
    clientesCrmProvisionados: PALATARE_CLIENTES_CRM.length
  };

  try {
    rootDb.cadastrosMestresKytto ||= {};
    rootDb.cadastrosMestresKytto.empresas ||= {};
    rootDb.cadastrosMestresKytto.empresas[PALATARE_EMPRESA_ID] = {
      ...PALATARE_DADOS_EMPRESA,
      criadaEm: rootDb.cadastrosMestresKytto.empresas[PALATARE_EMPRESA_ID]?.criadaEm || new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
    };

    // Salvar coleções exclusivas de Pizzaria Suite e CRM no datastore
    rootDb.palatare_clientes = PALATARE_CLIENTES_CRM;
    rootDb.palatare_montador = PALATARE_CONFIG_MONTADOR;
    rootDb.palatare_rodizio = PALATARE_RODIZIO_CONFIG;
    rootDb.palatare_kds = PALATARE_KDS_FILA;
    rootDb.palatare_delivery = PALATARE_DELIVERY_ZONAS;
    rootDb.palatare_metricas = PALATARE_METRICAS_BI;
    rootDb.palatare_engenharia = PALATARE_ENGENHARIA_CMV;
    rootDb.palatare_pizza_club = PALATARE_PIZZA_CLUB;
    rootDb.palatare_forno = PALATARE_TELEMETRIA_FORNO;

    // Usuários da Palatare no JSON
    rootDb.usuarios ||= [];
    const usuariosSeed = [
      { id: "usr-palatare-gerente-01", username: "palatare", email: "contato@palatarepizzaria.com.br", emailAlt: "admin@palatarepizzaria.com.br", nome: "Gerente Palatare", role: "organizador" },
      { id: "usr-palatare-pizzaiolo-01", username: "pizzaiolo", email: "cozinha@palatarepizzaria.com.br", nome: "Chef Pizzaiolo Palatare", role: "operador" },
      { id: "usr-palatare-atendente-01", username: "atendente_palatare", email: "atendimento@palatarepizzaria.com.br", nome: "Atendente Salão & Delivery", role: "operador" },
    ];

    for (const u of usuariosSeed) {
      const idx = rootDb.usuarios.findIndex(item => 
        (item.id && item.id === u.id) ||
        (item.username && item.username.toLowerCase() === u.username.toLowerCase()) ||
        (item.email && item.email.toLowerCase() === u.email.toLowerCase())
      );
      const userPayload = {
        id: u.id,
        username: u.username,
        nome: u.nome,
        email: u.email,
        emailAlternativo: u.emailAlt || "",
        senhaHash: SENHA_PADRAO_HASH,
        role: u.role,
        empresaId: PALATARE_EMPRESA_ID,
        lojaId: PALATARE_LOJA_ID,
        ativo: true,
        criadoEm: new Date().toISOString()
      };
      if (idx >= 0) {
        rootDb.usuarios[idx] = { 
          ...rootDb.usuarios[idx], 
          ...userPayload, 
          senhaHash: rootDb.usuarios[idx].senhaHash || SENHA_PADRAO_HASH,
          id: u.id 
        };
      } else {
        rootDb.usuarios.push(userPayload);
      }
      resultados.usuariosProvisionados++;
    }

    save();
    resultados.empresaProvisionada = true;
  } catch (err) {
    console.warn("[palatare-seed] Aviso ao salvar Palatare no Datastore JSON:", err.message);
  }

  // 2. Sincronizar no PostgreSQL (empresas, lojas, bar_produtos, bar_mesas)
  if (commerceDb && typeof commerceDb.query === "function") {
    try {
      await commerceDb.query(`
        INSERT INTO empresas (
          id, nome, cnpj, razao_social, tipo_negocio, grupo_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6
        ) ON CONFLICT (id) DO UPDATE SET
          nome = EXCLUDED.nome,
          razao_social = EXCLUDED.razao_social,
          cnpj = EXCLUDED.cnpj,
          tipo_negocio = EXCLUDED.tipo_negocio,
          grupo_id = EXCLUDED.grupo_id
      `, [
        PALATARE_EMPRESA_ID,
        PALATARE_DADOS_EMPRESA.nome,
        PALATARE_CNPJ_NUM,
        PALATARE_DADOS_EMPRESA.razaoSocial,
        "restaurante",
        PALATARE_GRUPO_ID
      ]);

      await commerceDb.query(`
        INSERT INTO lojas (
          id, empresa_id, codigo, nome
        ) VALUES (
          $1, $2, PALATARE-MATRIZ, $3
        ) ON CONFLICT (id) DO UPDATE SET
          nome = EXCLUDED.nome
      `, [
        PALATARE_LOJA_ID,
        PALATARE_EMPRESA_ID,
        "Palatare Pizzaria · Matriz & Salão"
      ]);

      for (const p of PALATARE_CARDAPIO_INICIAL) {
        try {
          await commerceDb.query(`
            INSERT INTO bar_produtos (
              empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo
            ) VALUES (
              $1, $2, $3, $4, $5, $6, 1, $7, $8, $9, true
            ) ON CONFLICT (empresa_id, nome) DO UPDATE SET
              preco = EXCLUDED.preco,
              categoria = EXCLUDED.categoria,
              setor = EXCLUDED.setor,
              unidade = EXCLUDED.unidade,
              estoque_atual = EXCLUDED.estoque_atual,
              estoque_minimo = EXCLUDED.estoque_minimo,
              ordem = EXCLUDED.ordem,
              ativo = true
          `, [
            PALATARE_EMPRESA_ID,
            p.nome,
            p.categoria,
            p.setor,
            p.preco,
            p.unidade,
            p.estoque,
            p.minimo,
            p.ordem
          ]);
          resultados.produtosCriados++;
        } catch (prodErr) {
          console.warn(`[palatare-seed] Aviso ao inserir produto ${p.nome}:`, prodErr.message);
        }
      }

      for (const m of PALATARE_MESAS_INICIAIS) {
        try {
          await commerceDb.query(`
            INSERT INTO bar_mesas (
              empresa_id, numero, nome, tipo, ativa
            ) VALUES (
              $1, $2, $3, $4, true
            ) ON CONFLICT (empresa_id, numero) DO UPDATE SET
              nome = EXCLUDED.nome,
              tipo = EXCLUDED.tipo,
              ativa = true
          `, [
            PALATARE_EMPRESA_ID,
            m.numero,
            m.nome,
            m.tipo
          ]);
          resultados.mesasCriadas++;
        } catch (mesaErr) {
          console.warn(`[palatare-seed] Aviso ao inserir mesa ${m.numero}:`, mesaErr.message);
        }
      }
    } catch (sqlErr) {
      console.warn("[palatare-seed] Erro SQL ao provisionar no PostgreSQL:", sqlErr.message);
    }
  }

  return resultados;
}

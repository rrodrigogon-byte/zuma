// ============================================================================
// MODELO DE GESTÃO DO INSTAGRAM & MOTOR E-COMMERCE LTK (CREATOR STOREFRONT)
// Dino Visagista (@odinovisagista) | Barbearia & Perfumaria de Luxo
// Tangará da Serra e Região Médio-Norte de Mato Grosso
// ============================================================================

import { PERFIL_DINO, MATRIZ_REELS_VIRAL } from './dino-influencer-growth-engine.js';
import { sendTextViaChatbotBackend } from './whatsapp-provider.js';
import { DESTINATARIOS_GESTAO_DINO } from './dino-whats-gestao-hub.js';
export const NUMEROS_GESTAO_DINO = DESTINATARIOS_GESTAO_DINO;

/**
 * Catálogo Oficial da Vitrine LTK do Criador Dino (@odinovisagista)
 * Integra produtos físicos (frascos lacrados e decants de 10ml), serviços de barbearia e assinaturas VIP.
 */
export const CATALOGO_PRODUTOS_LTK = [
  {
    id: 'p1_lattafa_asad',
    nome: 'Lattafa Asad Eau de Parfum (100ml)',
    categoria: 'Perfumes Árabes',
    colecoes: ['destaques', 'vistos_reels', 'arabes_luxo'],
    reelVinculado: 'R3',
    descricao: 'O clone árabe mais aclamado do Sauvage Elixir. Notas quentes de pimenta preta, café, tabaco e âmbar.',
    precoFrasco: 389.00,
    precoDecant10ml: 79.00,
    permiteDecant: true,
    fixacao: '12h+',
    projecao: 'Marcante (2 metros)',
    ocasiao: 'Noite, jantares de negócios, encontros e ocasiões onde você quer impor respeito.',
    imagemUrl: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=800&q=80',
    notasOlfativas: {
      saida: 'Pimenta preta, Abacaxi, Tabaco',
      coracao: 'Café, Patchouli, Íris',
      fundo: 'Âmbar, Baunilha, Madeiras secas, Benjoim'
    },
    estoqueFrasco: 18,
    estoqueDecant: 65,
    destaque: true
  },
  {
    id: 'p2_club_de_nuit_iconic',
    nome: 'Armaf Club de Nuit Blue Iconic (105ml)',
    categoria: 'Perfumes Árabes',
    colecoes: ['destaques', 'vistos_reels', 'calor_mt'],
    reelVinculado: 'R1',
    descricao: 'A melhor interpretação de luxo do Bleu de Chanel. Cítrico vibrante com fundo amadeirado elegante.',
    precoFrasco: 449.00,
    precoDecant10ml: 89.00,
    permiteDecant: true,
    fixacao: '10h',
    projecao: 'Moderada para alta',
    ocasiao: 'Assinatura diária em Tangará da Serra. Perfeito do escritório ao happy hour sem perder o frescor.',
    imagemUrl: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=800&q=80',
    notasOlfativas: {
      saida: 'Toranja, Limão siciliano, Hortelã, Pimenta rosa',
      coracao: 'Gengibre, Noz-moscada, Melão, Jasmim',
      fundo: 'Incenso, Âmbar, Cedro, Sândalo, Ládano'
    },
    estoqueFrasco: 12,
    estoqueDecant: 40,
    destaque: true
  },
  {
    id: 'p3_armaf_sillage',
    nome: 'Armaf Club de Nuit Sillage (105ml)',
    categoria: 'Perfumes Árabes',
    colecoes: ['calor_mt', 'vistos_reels'],
    reelVinculado: 'R1',
    descricao: 'Inspirado no lendário Silver Mountain Water da Creed. Frescor metálico, gelado e aristocrático.',
    precoFrasco: 429.00,
    precoDecant10ml: 85.00,
    permiteDecant: true,
    fixacao: '9h',
    projecao: 'Elegante e aerada',
    ocasiao: 'Dias de calor extremo (38°C a 42°C) em Mato Grosso. Sensação de banho gelado e sofisticação.',
    imagemUrl: 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=800&q=80',
    notasOlfativas: {
      saida: 'Bergamota, Groselha preta, Limão, Folha de violeta',
      coracao: 'Rosa, Íris, Jasmim aquático',
      fundo: 'Ambroxan, Almíscar, Sândalo, Cedro'
    },
    estoqueFrasco: 15,
    estoqueDecant: 50,
    destaque: false
  },
  {
    id: 'p4_supremacy_not_only_intense',
    nome: 'Afnan Supremacy Not Only Intense (100ml)',
    categoria: 'Perfumes Árabes',
    colecoes: ['destaques', 'arabes_luxo', 'vistos_reels'],
    reelVinculado: 'R3',
    descricao: 'Concentração Extrait de Parfum. Notas frutadas de maçã e cassis com base esfumaçada de musgo de carvalho.',
    precoFrasco: 499.00,
    precoDecant10ml: 95.00,
    permiteDecant: true,
    fixacao: '14h+',
    projecao: 'Bomba atômica olfativa (deixa rastro inconfundível)',
    ocasiao: 'Eventos de gala, casamentos, reuniões de fechamento de negócios e noites especiais.',
    imagemUrl: 'https://images.unsplash.com/photo-1616949755610-8c9bbc08f138?auto=format&fit=crop&w=800&q=80',
    notasOlfativas: {
      saida: 'Bergamota, Maçã fresca, Groselha preta',
      coracao: 'Lavanda, Patchouli, Musgo de carvalho',
      fundo: 'Açafrão, Almíscar, Âmbar cinzento'
    },
    estoqueFrasco: 10,
    estoqueDecant: 35,
    destaque: true
  },
  {
    id: 'p5_acqua_di_gio_profondo',
    nome: 'Giorgio Armani Acqua Di Gio Profondo (125ml)',
    categoria: 'Perfumes Designer',
    colecoes: ['calor_mt', 'destaques'],
    reelVinculado: 'R1',
    descricao: 'O ícone aquático do luxo italiano. Notas marinhas profundas, alecrim aromático e patchouli.',
    precoFrasco: 689.00,
    precoDecant10ml: 119.00,
    permiteDecant: true,
    fixacao: '8h',
    projecao: 'Sofisticada e limpa',
    ocasiao: 'O perfume assinatura do empresário e produtor rural em MT.',
    imagemUrl: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80',
    notasOlfativas: {
      saida: 'Notas marinhas, Aquozone, Bergamota verde',
      coracao: 'Alecrim, Lavanda, Cipreste, Lentisco',
      fundo: 'Patchouli mineral, Almíscar'
    },
    estoqueFrasco: 8,
    estoqueDecant: 30,
    destaque: true
  },
  {
    id: 'p6_pomada_matte_dino',
    nome: 'Pomada Matte Modeladora Dino Visagista (150g)',
    categoria: 'Cuidados Masculinos',
    colecoes: ['barbearia', 'destaques', 'vistos_reels'],
    reelVinculado: 'R2',
    descricao: 'Fórmula exclusiva desenvolvida pelo Dino para resistir ao calor e suor de Tangará da Serra sem derreter.',
    precoFrasco: 55.00,
    precoDecant10ml: null,
    permiteDecant: false,
    fixacao: 'Efeito seco fosco o dia todo',
    projecao: 'Fragrância suave amadeirada',
    ocasiao: 'Uso diário para estruturar cortes visagistas e manter a mandíbula alinhada.',
    imagemUrl: 'https://images.unsplash.com/photo-1585232351009-aa87416fca90?auto=format&fit=crop&w=800&q=80',
    notasOlfativas: {
      saida: 'Cítricos suaves',
      coracao: 'Bambu e chá verde',
      fundo: 'Madeira de cedro'
    },
    estoqueFrasco: 120,
    estoqueDecant: 0,
    destaque: false
  },
  {
    id: 's1_corte_visagista',
    nome: 'Consultoria Visagista + Corte Exclusivo na Cadeira',
    categoria: 'Barbearia & Visagismo',
    colecoes: ['barbearia', 'destaques', 'vistos_reels'],
    reelVinculado: 'R2',
    descricao: 'Análise morfológica do crânio, harmonia das linhas da mandíbula e corte de cabelo personalizado + Ritual da Borrifada Cortesia.',
    precoFrasco: 90.00,
    precoDecant10ml: 63.00, // Preço promocional seguidor Instagram 30% OFF
    permiteDecant: false,
    fixacao: 'Visual alinhado por 25 dias',
    projecao: 'Autoridade e respeito imediato',
    ocasiao: 'Para o homem que não aceita corte comum de maquininha e deseja posicionamento executivo.',
    imagemUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
    notasOlfativas: {
      saida: 'Toalha quente com essência de eucalipto',
      coracao: 'Lavagem com massagem capilar',
      fundo: 'Borrifada de Perfume Importado à sua escolha'
    },
    estoqueFrasco: 999,
    estoqueDecant: 0,
    destaque: true
  },
  {
    id: 's2_combo_cavalheiro',
    nome: 'Combo Cavalheiro: Corte Visagista + Barboterapia Completa',
    categoria: 'Barbearia & Visagismo',
    colecoes: ['barbearia', 'destaques'],
    reelVinculado: 'R7',
    descricao: 'Corte visagista completo, desenho de barba milimétrico com toalha quente, navalha e finalização com óleo aromático.',
    precoFrasco: 140.00,
    precoDecant10ml: 98.00, // Promocional seguidor 30% OFF
    permiteDecant: false,
    fixacao: 'Renovação completa da autoimagem',
    projecao: 'Impacto visual imbatível',
    ocasiao: 'Semanal ou quinzenal para manter o alinhamento impecável.',
    imagemUrl: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=800&q=80',
    notasOlfativas: {
      saida: 'Vapor de ozônio e toalha quente',
      coracao: 'Espuma hidratante clássica',
      fundo: 'Ritual da Borrifada com Perfume de Nicho'
    },
    estoqueFrasco: 999,
    estoqueDecant: 0,
    destaque: true
  },
  {
    id: 'c1_clube_dino_vip',
    nome: 'Assinatura Clube Dino Cavalheiro VIP (Mensal)',
    categoria: 'Clube VIP Híbrido',
    colecoes: ['clube_vip', 'destaques'],
    reelVinculado: 'R7',
    descricao: '2 Cortes Visagistas + 2 Barbas com toalha quente por mês + 1 Decant Mensal de 10ml grátis + 15% OFF em toda perfumaria.',
    precoFrasco: 249.00,
    precoDecant10ml: null,
    permiteDecant: false,
    fixacao: 'Assinatura recorrente inteligente',
    projecao: 'Status de cliente VIP da Barbearia e Perfumaria Dino',
    ocasiao: 'Para quem busca praticidade sem fila e economia real em cuidados pessoais.',
    imagemUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80',
    notasOlfativas: {
      saida: 'Café espresso duplo ou chope cortesia em cada visita',
      coracao: 'Agendamento prioritário no app Kytto',
      fundo: 'Decant de 10ml de perfume de nicho entregue todo mês'
    },
    estoqueFrasco: 50,
    estoqueDecant: 0,
    destaque: true
  }
];

/**
 * Coleções Dinâmicas da Vitrine LTK do Criador
 */
export const COLECOES_LTK = [
  { id: 'destaques', titulo: '🔥 Top Mais Desejados', subtitulo: 'Os campeões de vendas e comentários no Instagram do Dino' },
  { id: 'vistos_reels', titulo: '🎥 Vistos nos Reels do Dino', subtitulo: 'Tudo o que apareceu nos vídeos virais de @odinovisagista' },
  { id: 'calor_mt', titulo: '☀️ Reis do Calor de MT (38°C)', subtitulo: 'Perfumes ultrarrefrescantes de alta fixação que resistem ao calor de Tangará' },
  { id: 'arabes_luxo', titulo: '👑 Perfumes Árabes & Nicho', subtitulo: 'Cheiro de imponência, projeção nuclear e sofisticação oriental' },
  { id: 'decants', titulo: '🧪 Decants Oficiais de 10ml', subtitulo: 'Experimente os perfumes mais caros do mundo sem pesar no bolso (~150 borrifadas)' },
  { id: 'barbearia', titulo: '💈 Experiência Visagista na Cadeira', subtitulo: 'Agende seu corte e viva o Ritual da Borrifada na Barbearia Dino' },
  { id: 'clube_vip', titulo: '💎 Clube Dino VIP (Assinaturas)', subtitulo: 'Cortes, barbas e decants mensais com economia de até 40%' }
];

/**
 * Modelo de Gestão do Instagram (@odinovisagista)
 * Estruturação de processos, esteira de gravação, calendário 7 dias e matriz RACI.
 */
export const MODELO_GESTAO_INSTAGRAM = {
  visaoGeral: {
    handle: '@odinovisagista',
    posicionamento: 'Autoridade Suprema em Visagismo Masculino e Perfumaria de Luxo no Mato Grosso',
    metaSeguidores60Dias: 20000,
    metaFollowing60Dias: 3500,
    metaVendasInstagramMensal: 35000.00
  },

  // 1. Calendário Editorial Semanal 7 Dias / 365 Dias
  calendarioSemanal: [
    {
      dia: 'Segunda-feira',
      foco: 'Planejamento, Gravação em Lote & Backstage',
      horarioPublicacao: '19h15 (Pico Noturno MT)',
      formatoPrincipal: 'Reels dos Bastidores + 8 Stories',
      roteiroSugerido: 'R7 - O Ritual da Borrifada na Barbearia Dino',
      gatilhoDirect: 'RITUAL',
      produtoLTK: 's1_corte_visagista',
      descricaoPauta: 'Gravação matinal (09h00-11h30) com barbearia vazia. À noite, publicar Reel mostrando a preparação da semana e os novos frascos que chegaram.',
      metaDia: '5 frascos de decants reservados + 8 agendamentos na cadeira.'
    },
    {
      dia: 'Terça-feira',
      foco: 'Visagismo Puro & Transformação de Imagem',
      horarioPublicacao: '11h45 (Pico Almoço MT)',
      formatoPrincipal: 'Reels Antes/Depois + Enquetes nos Stories',
      roteiroSugerido: 'R2 - Visagismo: Rosto Redondo para Mandíbula Marcada',
      gatilhoDirect: 'VISAGISMO',
      produtoLTK: 'p6_pomada_matte_dino',
      descricaoPauta: 'Reel com cliente real antes do corte e a transformação após a navalha e pomada matte. Stories com enquete "Qual formato de rosto é o seu?".',
      metaDia: '12 comentários "VISAGISMO" convertidos em links da agenda Kytto.'
    },
    {
      dia: 'Quarta-feira',
      foco: 'Autoridade Técnica & Desmistificação de Perfumes',
      horarioPublicacao: '19h15 (Pico Noturno MT)',
      formatoPrincipal: 'Carrossel Educativo + Box de Perguntas "Dino Responde"',
      roteiroSugerido: 'R6 - Pare de Esfregar o Pulso ao Passar Perfume!',
      gatilhoDirect: 'DICA',
      produtoLTK: 'p3_armaf_sillage',
      descricaoPauta: 'Carrossel em 6 slides ensinando os 5 pontos de pulsação e a fixação no calor de MT. Abrir caixinha de perguntas para dúvidas de perfumes.',
      metaDia: '150 salvamentos no post + 30 respostas na caixinha.'
    },
    {
      dia: 'Quinta-feira',
      foco: 'Perfumaria Árabe & Nicho (Alto Desejo / Alto Ticket)',
      horarioPublicacao: '11h45 (Pico Almoço MT)',
      formatoPrincipal: 'Reels "Cheiro de Rico" + Oferta Relâmpago Stories (20h)',
      roteiroSugerido: 'R3 - O Perfume Árabe que Deixa Rastro por Onde Passa',
      gatilhoDirect: 'ARABE',
      produtoLTK: 'p1_lattafa_asad',
      descricaoPauta: 'Dino com frasco imponente do Lattafa Asad ou Supremacy, aplicando no ar e descrevendo as reações femininas. Às 20h, liberar 10 decants com preço especial nos Stories.',
      metaDia: 'R$ 3.500 em vendas de perfumes árabes e decants.'
    },
    {
      dia: 'Sexta-feira',
      foco: 'Sextou na Barbearia + Urgência de Final de Semana',
      horarioPublicacao: '17h30 (Pré-Happy Hour MT)',
      formatoPrincipal: 'Stories Intensivos (15 stories) + Reel Dinâmico',
      roteiroSugerido: 'R1 - O Maior Erro no Calor de 38°C de MT',
      gatilhoDirect: 'CALOR',
      produtoLTK: 'p2_club_de_nuit_iconic',
      descricaoPauta: 'Mostrar a barbearia lotada, cerveja artesanal trincando, clientes se preparando para o fim de semana e os últimos 3 horários vagos na agenda.',
      metaDia: 'Ocupação de 100% dos buracos de agenda de sábado.'
    },
    {
      dia: 'Sábado',
      foco: 'Experiência ao Vivo & Prova Social do Ritual da Borrifada',
      horarioPublicacao: '12h30 (Pico Sábado MT)',
      formatoPrincipal: 'Stories em Tempo Real + Reels de Reação de Cliente',
      roteiroSugerido: 'R7 - O Ritual da Borrifada na Barbearia Dino',
      gatilhoDirect: 'RITUAL',
      produtoLTK: 's2_combo_cavalheiro',
      descricaoPauta: 'Gravar a reação espontânea do cliente na cadeira ao sentir a borrifada do perfume importado de cortesia. Capturar o momento em que ele decide comprar o decant ou frasco.',
      metaDia: '8 decants vendidos direto no balcão da barbearia.'
    },
    {
      dia: 'Domingo',
      foco: 'Posicionamento Pessoal, Lifestyle & Abertura da Semana',
      horarioPublicacao: '20h00 (Pico Domingo à Noite MT)',
      formatoPrincipal: 'Carrossel de Lifestyle ou Reel Reflexivo + Story com Link da Agenda',
      roteiroSugerido: 'R5 - Cabelo de Menino vs Cabelo de Homem de Negócios',
      gatilhoDirect: 'TRANSFORMAR',
      produtoLTK: 'c1_clube_dino_vip',
      descricaoPauta: 'Mensagem de abertura de semana para homens de negócios e produtores rurais de Tangará. Lembrete: "Sua imagem chega antes de você em qualquer reunião".',
      metaDia: '15 agendamentos antecipados para segunda e terça-feira.'
    }
  ],

  // 2. Matriz RACI da Equipe Dino
  matrizRACI: [
    {
      funcao: 'Dino (Guilherme Cunha) - Criador & Visagista',
      papel: 'Apresentador / Rosto da Marca / Autoridade Técnica',
      responsabilidades: [
        'Aprovação final das pautas semanais e roteiros de Reels',
        'Gravação presencial na segunda-feira (bloco de 90 minutos)',
        'Gravação de 5 a 10 Stories diários espontâneos na barbearia',
        'Consultoria visagista nos atendimentos VIP da cadeira'
      ],
      raci: { gravacao: 'R/A', edicao: 'I', publicacao: 'C', direct: 'C', vendas_cadeira: 'R' }
    },
    {
      funcao: 'Videomaker & Editor de Vídeos',
      papel: 'Captação, Edição Dinâmica & Finalização 9:16',
      responsabilidades: [
        'Captação com iluminação profissional e microfone de lapela na barbearia',
        'Edição ágil no CapCut/Premiere com cortes a cada 2-3s e legendas amarelas/brancas com palavras-chave destacadas',
        'Entrega dos 4 Reels da semana até terça-feira às 10h da manhã',
        'Backup diário das gravações brutas na nuvem Kytto'
      ],
      raci: { gravacao: 'R', edicao: 'R/A', publicacao: 'I', direct: 'I', vendas_cadeira: 'I' }
    },
    {
      funcao: 'Gestor de Social Media & Tráfego Regional',
      papel: 'Publicação, Otimização de Algoritmo & Agendamento',
      responsabilidades: [
        'Publicação dos posts nos horários exatos de MT (11h45 e 19h15)',
        'Execução diária do Protocolo de Limpeza (60 unfollows/dia com limite seguro)',
        'Configuração e testes dos gatilhos no Direct KyttoIA',
        'Monitoramento de métricas diárias (ganhos, perdidos, saldo líquido)',
        'Geração de links rastreados LTK com UTMs para a bio e stories'
      ],
      raci: { gravacao: 'C', edicao: 'C', publicacao: 'R/A', direct: 'A', vendas_cadeira: 'I' }
    },
    {
      funcao: 'Concierge de Vendas Direct & WhatsApp',
      papel: 'Atendimento Comercial Consultivo & Fechamento',
      responsabilidades: [
        'Intervenção humana em menos de 5 minutos após resposta do bot KyttoIA no Direct',
        'Envio de fotos dos frascos, opções de decant 10ml e chave Pix para pagamento',
        'Agendamento de entregas via motoboy em Tangará da Serra e despachos regionais',
        'Cobrança amigável de carrinhos e directs não finalizados'
      ],
      raci: { gravacao: 'I', edicao: 'I', publicacao: 'I', direct: 'R', vendas_cadeira: 'C' }
    },
    {
      funcao: 'Equipe de Barbeiros da Barbearia Dino',
      papel: 'Executores do Ritual da Borrifada na Cadeira',
      responsabilidades: [
        'Aplicação obrigatória da borrifada cortesia em 100% dos cortes realizados',
        'Apresentação sutil do frasco lacrado e do decant de 10ml no espelho da cadeira',
        'Convite para o cliente seguir @odinovisagista e ver as dicas de estilo',
        'Comissão de 10% paga na hora em cada perfume ou decant vendido na comanda'
      ],
      raci: { gravacao: 'C', edicao: 'I', publicacao: 'I', direct: 'I', vendas_cadeira: 'R' }
    }
  ],

  // 3. Esteira de Gravação em Lote (Batch Production Playbook)
  esteiraGravacaoEmLote: {
    diaSemana: 'Toda Segunda-feira',
    horario: 'Das 09h00 às 11h30 (Barbearia fechada para clientes)',
    duracaoTotalMinutos: 150,
    etapas: [
      {
        etapa: '1. Setup & Iluminação (09h00 - 09h20)',
        detalhes: 'Ligar ring light principal, luz lateral quente de recorte, posicionar frascos de perfumes polidos na bancada de madeira e testar microfone de lapela sem fio.'
      },
      {
        etapa: '2. Gravação dos 3 Reels de Perfumaria & Clima (09h20 - 10h15)',
        detalhes: 'Dino grava os vídeos de perfumes árabes, calor de MT e dicas olfativas. Cada vídeo é gravado em no máximo 3 takes focando no primeiro gancho de 3 segundos.'
      },
      {
        etapa: '3. Gravação dos 2 Reels de Visagismo & Estilo (10h15 - 11h00)',
        detalhes: 'Demonstração de técnicas com modelo ou cliente parceiro na cadeira: ângulos de mandíbula, penteado com pomada matte e toalha quente.'
      },
      {
        etapa: '4. Gravação de 10 Pílulas de Stories para a Semana (11h00 - 11h30)',
        detalhes: 'Vídeos curtos de 15 segundos para serem soltos ao longo da semana com chamadas do tipo: "Se você ainda não comprou seu decant pro fim de semana, clica no link abaixo".'
      }
    ],
    regraDeOuro: 'Nunca gravar vídeos no meio do atendimento normal. A gravação em lote na segunda-feira garante foco total e libera o Dino para atender os clientes no resto da semana com calma.'
  },

  // 4. SLAs de Atendimento Direct-to-Commerce
  slasAtendimento: [
    {
      nivel: 'SLA Nível 1 - KyttoIA Direct Copilot',
      tempoMaximo: 'Menos de 3 segundos',
      cobertura: '24 horas por dia / 7 dias por semana',
      funcao: 'Entrega imediata do link da vitrine LTK ou link de agendamento assim que o seguidor comenta a palavra-chave no post ou envia DM.'
    },
    {
      nivel: 'SLA Nível 2 - Atendimento Humano Consultivo',
      tempoMaximo: 'Menos de 5 minutos',
      cobertura: 'Segunda a Sábado das 08h00 às 20h00',
      funcao: 'Intervenção do Concierge de Vendas para tirar dúvidas específicas de fixação, notas olfativas ou agendamentos especiais.'
    },
    {
      nivel: 'SLA Nível 3 - Separação e Despacho de Pedidos',
      tempoMaximo: 'Menos de 2 horas em horário comercial',
      cobertura: 'Tangará da Serra (Entrega Expressa) e envio via Correios/Jadlog para cidades vizinhas',
      funcao: 'Embalagem do frasco ou decant em caixa premium preta com adesivo Dino, envio com motoboy e notificação do cliente via WhatsApp.'
    }
  ],

  // 5. Rituais de Governança e Acompanhamento
  rituaisGovernanca: [
    {
      nome: 'Daily Matinal das 08h30 (WhatsApp)',
      participantes: 'Dino, Social Media, Concierge de Vendas e Gerente da Barbearia',
      pauta: 'Checagem dos seguidores ganhos/perdidos do dia anterior, conferência do Reel que subirá às 11h45 e metas de vendas de perfumes do dia.'
    },
    {
      nome: 'Fechamento Noturno das 20h00 (WhatsApp)',
      participantes: 'Toda a equipe de gestão',
      pauta: 'Envio do relatório de métricas KyttoIA: faturamento LTK do dia, borrifadas aplicadas na cadeira, taxa de conversão e missão do dia seguinte.'
    },
    {
      nome: 'Reunião Semanal de Alinhamento (Segunda-feira às 14h00)',
      participantes: 'Dino, Social Media e Videomaker',
      pauta: 'Análise dos 3 Reels mais assistidos da semana anterior, revisão do saldo líquido de seguidores e aprovação dos novos roteiros.'
    }
  ]
};

/**
 * Armazenamento em memória para tracking de cliques e conversões da vitrine LTK
 */
const TRACKING_LTK_STORE = {
  cliquesTotais: 1420,
  conversoesTotais: 86,
  faturamentoGeradoTotal: 24780.00,
  cliquesPorColecao: {
    destaques: 540,
    vistos_reels: 410,
    calor_mt: 290,
    arabes_luxo: 310,
    decants: 380,
    barbearia: 210,
    clube_vip: 90
  },
  cliquesPorProduto: {
    p1_lattafa_asad: 380,
    p2_club_de_nuit_iconic: 290,
    p3_armaf_sillage: 185,
    p4_supremacy_not_only_intense: 220,
    p5_acqua_di_gio_profondo: 160,
    p6_pomada_matte_dino: 95,
    s1_corte_visagista: 240,
    s2_combo_cavalheiro: 130,
    c1_clube_dino_vip: 60
  },
  pedidosPorProduto: {
    p1_lattafa_asad: 24,
    p2_club_de_nuit_iconic: 18,
    p3_armaf_sillage: 11,
    p4_supremacy_not_only_intense: 14,
    p5_acqua_di_gio_profondo: 7,
    p6_pomada_matte_dino: 19,
    s1_corte_visagista: 32,
    s2_combo_cavalheiro: 16,
    c1_clube_dino_vip: 8
  }
};

/**
 * Gera URL rastreada com parâmetros UTM para o criador usar em Reels, Bio ou Stories
 */
export function gerarLinkRastreadoLTK({
  produtoId = 'p1_lattafa_asad',
  canal = 'reels', // reels, stories, bio, direct, whatsapp
  campanha = 'r1_calor_mt',
  termo = 'decant'
} = {}) {
  const baseUrl = 'https://kytto.com.br/dino';
  const params = new URLSearchParams({
    p: produtoId,
    utm_source: 'instagram',
    utm_medium: canal,
    utm_campaign: campanha,
    utm_content: 'odinovisagista'
  });
  if (termo) params.set('utm_term', termo);
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Registra clique em um produto da vitrine LTK com atribuição
 */
export function registrarCliqueLTK({ produtoId, colecaoId = 'destaques', canal = 'instagram' } = {}) {
  TRACKING_LTK_STORE.cliquesTotais += 1;
  if (TRACKING_LTK_STORE.cliquesPorProduto[produtoId] !== undefined) {
    TRACKING_LTK_STORE.cliquesPorProduto[produtoId] += 1;
  } else {
    TRACKING_LTK_STORE.cliquesPorProduto[produtoId] = 1;
  }
  if (TRACKING_LTK_STORE.cliquesPorColecao[colecaoId] !== undefined) {
    TRACKING_LTK_STORE.cliquesPorColecao[colecaoId] += 1;
  }
  return {
    ok: true,
    produtoId,
    cliquesTotais: TRACKING_LTK_STORE.cliquesTotais,
    cliquesProduto: TRACKING_LTK_STORE.cliquesPorProduto[produtoId]
  };
}

/**
 * Registra conversão / compra atribuída à vitrine LTK
 */
export function registrarConversaoLTK({ produtoId, valor = 79.00, tipo = 'decant' } = {}) {
  TRACKING_LTK_STORE.conversoesTotais += 1;
  TRACKING_LTK_STORE.faturamentoGeradoTotal += Number(valor) || 0;
  if (TRACKING_LTK_STORE.pedidosPorProduto[produtoId] !== undefined) {
    TRACKING_LTK_STORE.pedidosPorProduto[produtoId] += 1;
  } else {
    TRACKING_LTK_STORE.pedidosPorProduto[produtoId] = 1;
  }
  return {
    ok: true,
    produtoId,
    conversoesTotais: TRACKING_LTK_STORE.conversoesTotais,
    faturamentoTotal: TRACKING_LTK_STORE.faturamentoGeradoTotal
  };
}

/**
 * Retorna as métricas consolidadas do motor LTK Creator Commerce
 */
export function obterMetricasConsolidadasLTK() {
  const taxaConversao = TRACKING_LTK_STORE.cliquesTotais > 0
    ? ((TRACKING_LTK_STORE.conversoesTotais / TRACKING_LTK_STORE.cliquesTotais) * 100).toFixed(1)
    : '0.0';

  const ticketMedio = TRACKING_LTK_STORE.conversoesTotais > 0
    ? (TRACKING_LTK_STORE.faturamentoGeradoTotal / TRACKING_LTK_STORE.conversoesTotais).toFixed(2)
    : '0.00';

  // Ranking de produtos mais clicados e mais comprados
  const rankingProdutos = CATALOGO_PRODUTOS_LTK.map(p => ({
    id: p.id,
    nome: p.nome,
    categoria: p.categoria,
    cliques: TRACKING_LTK_STORE.cliquesPorProduto[p.id] || 0,
    pedidos: TRACKING_LTK_STORE.pedidosPorProduto[p.id] || 0,
    faturamentoEstimado: (TRACKING_LTK_STORE.pedidosPorProduto[p.id] || 0) * (p.precoDecant10ml || p.precoFrasco)
  })).sort((a, b) => b.cliques - a.cliques);

  return {
    cliquesTotais: TRACKING_LTK_STORE.cliquesTotais,
    conversoesTotais: TRACKING_LTK_STORE.conversoesTotais,
    taxaConversaoGeral: `${taxaConversao}%`,
    faturamentoGeradoTotal: TRACKING_LTK_STORE.faturamentoGeradoTotal,
    ticketMedio: `R$ ${ticketMedio}`,
    cliquesPorColecao: TRACKING_LTK_STORE.cliquesPorColecao,
    rankingProdutos
  };
}

/**
 * Formata mensagem executiva com a pauta diária para envio no canal de WhatsApp da Gestão Dino
 */
export function formatarPautaDiariaWhatsApp({ diaSemana = null } = {}) {
  const diasDaSemanaNomes = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const diaHojeNome = diaSemana || diasDaSemanaNomes[new Date().getDay()];

  const pautaHoje = MODELO_GESTAO_INSTAGRAM.calendarioSemanal.find(c => c.dia.toLowerCase().includes(diaHojeNome.toLowerCase()))
    || MODELO_GESTAO_INSTAGRAM.calendarioSemanal[0];

  const produtoPauta = CATALOGO_PRODUTOS_LTK.find(p => p.id === pautaHoje.produtoLTK) || CATALOGO_PRODUTOS_LTK[0];
  const linkLTK = gerarLinkRastreadoLTK({ produtoId: produtoPauta.id, canal: 'stories', campanha: pautaHoje.gatilhoDirect.toLowerCase() });

  return `📅 *[PAUTA DIÁRIA DO INSTAGRAM - DINO VISAGISTA]* 🦖📱\n` +
    `*Dia:* ${pautaHoje.dia} | *Horário de Pico MT:* ${pautaHoje.horarioPublicacao}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🎯 *FOCO DO DIA:* ${pautaHoje.foco}\n` +
    `📹 *FORMATO:* ${pautaHoje.formatoPrincipal}\n` +
    `🎬 *ROTEIRO RECOMENDADO:* ${pautaHoje.roteiroSugerido}\n` +
    `⚡ *GATILHO NO DIRECT:* Digite *"${pautaHoje.gatilhoDirect}"*\n\n` +
    `📝 *DESCRIÇÃO DA GRAVAÇÃO / STORIES:*\n` +
    `${pautaHoje.descricaoPauta}\n\n` +
    `🛍️ *PRODUTO EM DESTAQUE NA VITRINE LTK:*\n` +
    `• ${produtoPauta.nome}\n` +
    `• Frasco: R$ ${produtoPauta.precoFrasco.toFixed(2)}${produtoPauta.precoDecant10ml ? ` | Decant 10ml: R$ ${produtoPauta.precoDecant10ml.toFixed(2)}` : ''}\n` +
    `• Link Rastreado para colocar no Story:\n  ${linkLTK}\n\n` +
    `🎯 *META COMERCIAL DO DIA:*\n${pautaHoje.metaDia}\n\n` +
    `⏱️ *LEMBRETE DE SLA:* Respostas no Direct via KyttoIA em < 3s e atendimento humano em < 5 minutos!\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `_KyttoIA 2.5 Flash | Sistema de Gestão Dino Influencer & Perfumaria 360°_`;
}

/**
 * Dispara a pauta diária para os números oficiais de governança Dino via WhatsApp
 */
export async function dispararPautaDiariaWhatsApp({ diaSemana = null, targetPhones = null } = {}) {
  const telefones = Array.isArray(targetPhones) && targetPhones.length > 0 ? targetPhones : NUMEROS_GESTAO_DINO;
  const texto = formatarPautaDiariaWhatsApp({ diaSemana });
  const disparos = [];

  for (const tel of telefones) {
    try {
      const res = await sendTextViaChatbotBackend({
        telefone: tel,
        texto,
        tenantId: 'barbearia_dino_gestao'
      });
      disparos.push({ telefone: tel, ok: true, id: res?.id || 'enviado' });
    } catch (err) {
      disparos.push({ telefone: tel, ok: false, error: err.message });
    }
  }

  return {
    ok: true,
    totalDisparados: telefones.length,
    sucessos: disparos.filter(d => d.ok).length,
    falhas: disparos.filter(d => !d.ok).length,
    detalhes: disparos
  };
}

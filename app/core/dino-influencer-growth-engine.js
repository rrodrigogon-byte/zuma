// ============================================================================
// MOTOR DE ACELERAÇÃO DINO INFLUENCER, BARBEARIA & PERFUMARIA 360° (KYTTOIA)
// Integração Omnichannel: @odinovisagista + Barbearia Dino + Perfumaria de Luxo
// Tangará da Serra e Região Médio-Norte de Mato Grosso
// ============================================================================

export const PERFIL_DINO = {
  handle: '@odinovisagista',
  url: 'https://www.instagram.com/odinovisagista',
  nome: 'Guilherme Cunha (Dino Visagista)',
  localizacao: 'Tangará da Serra - MT',
  regiaoAtendida: ['Tangará da Serra', 'Campo Novo do Parecis', 'Barra do Bugres', 'Nova Olímpia', 'Arenápolis', 'Denise', 'Cuiabá'],
  metricasSocialBlade: {
    seguidores: 17020,
    seguindo: 8234,
    postsPublicados: 1640,
    variacao30Dias: -124,
    variacao14Dias: -41,
    mediaDiariaSeguidores: -4.0,
    mediaDiariaFollowing: +2.0,
    diagnosticoAlgoritmico: 'Alerta Vermelho: Perda contínua de base por dependência de Stories e excesso de Following distorcendo a autoridade.'
  }
};

/**
 * Protocolo de Limpeza e Otimização do Perfil (Algoritmo Reset)
 */
export const PROTOCOLO_RESET_ALGORITMO = {
  fase1_desintoxicacao_following: {
    metaSeguindo: 750,
    unfollowDiarioRecomendado: 60, // Limite seguro Meta anti-ban
    duracaoEstimadaDias: 125,
    beneficio: 'Restaura a proporção de autoridade para 22:1 e limpa o feed algorítmico do Dino.'
  },
  fase2_redistribuicao_formatos: {
    stories: '40% do esforço (Foco exclusivo em bastidores, enquetes e conversão de quem já é cliente)',
    reels: '45% do esforço (Foco em descoberta, atração de novos seguidores e viralização regional)',
    carrossel: '15% do esforço (Foco em tutoriais de visagismo, guias de perfumaria e salvamentos)'
  }
};

/**
 * Matriz de 14 Roteiros de Reels de Alta Viralidade (Visagismo x Perfumes x Mato Grosso)
 */
export const MATRIZ_REELS_VIRAL = [
  {
    id: 'R1',
    titulo: 'O Maior Erro no Calor de 38°C de MT',
    categoria: 'Perfumaria & Clima',
    gancho: 'Você está usando o perfume errado no calor de Tangará da Serra e sufocando todo mundo ao redor.',
    conteudo: 'Explica a diferença entre notas doces/pesadas (inverno) e notas cítricas/aquáticas (calor). Apresenta Acqua Di Gio, Versace Eros Energy e Armaf Sillage.',
    cta: 'Comente CALOR que eu te mando a lista dos 3 perfumes que duram o dia todo sem enjoar.',
    produtoRelacionado: 'Acqua Di Gio / Armaf Sillage',
    palavraChaveDirect: 'CALOR'
  },
  {
    id: 'R2',
    titulo: 'Visagismo: Rosto Redondo para Mandíbula Marcada',
    categoria: 'Visagismo & Barbearia',
    gancho: 'Se você tem rosto redondo e usa barba cheia dos lados, você está parecendo mais gordinho do que realmente é.',
    conteudo: 'Demonstração prática na cadeira da barbearia: tirando volume lateral e criando ponta no queixo, alinhando com degradê médio.',
    cta: 'Comente VISAGISMO para agendar uma consultoria exclusiva comigo na Barbearia Dino.',
    produtoRelacionado: 'Corte + Barba Visagista',
    palavraChaveDirect: 'VISAGISMO'
  },
  {
    id: 'R3',
    titulo: 'Perfume Árabe de R$ 350 vs Designer de R$ 2.000',
    categoria: 'Perfumaria Árabe',
    gancho: 'Esse perfume árabe de R$ 350 projeta e fixa mais do que muito importado de R$ 2.000 que você vê no shopping.',
    conteudo: 'Batalha sensorial entre Lattafa Asad e Dior Sauvage Elixir. Mostra o frasco, notas de especiarias e a reação de alguém na barbearia.',
    cta: 'Comente ARABE que eu te mando o link direto do Lattafa original no WhatsApp da nossa Perfumaria.',
    produtoRelacionado: 'Lattafa Asad EDP',
    palavraChaveDirect: 'ARABE'
  },
  {
    id: 'R4',
    titulo: 'O Perfume Mais Elogiado pelas Mulheres em Tangará',
    categoria: 'Perfumaria & Sedução',
    gancho: 'Perguntei para 10 mulheres aqui em Tangará qual perfume masculino é impossível não virar o pescoço pra olhar.',
    conteudo: 'Mostra o top 3: Animale for Men, Invictus Victory e BDK Gris Charnel.',
    cta: 'Comente ELOGIO para receber uma consultoria olfativa rápida no Direct.',
    produtoRelacionado: 'Animale / Invictus / BDK Gris Charnel',
    palavraChaveDirect: 'ELOGIO'
  },
  {
    id: 'R5',
    titulo: 'Antes e Depois: Do Visual Cansado ao Visual Empresário',
    categoria: 'Visagismo & Transformação',
    gancho: 'Esse cliente do Agro chegou aqui achando que o cabelo dele não tinha jeito.',
    conteudo: 'Time-lapse rápido da transformação com análise dos ângulos do rosto, corte personalizado, sobrancelha e barba alinhada.',
    cta: 'Quer ter uma transformação assim? Clica no link da bio e garanta seu horário.',
    produtoRelacionado: 'Pacote Executivo Barbearia Dino',
    palavraChaveDirect: 'TRANSFORMAR'
  },
  {
    id: 'R6',
    titulo: 'Pare de Esfregar o Pulso ao Passar Perfume!',
    categoria: 'Dica Rápida de Autoridade',
    gancho: 'Se você faz isso aqui com o seu perfume importado, você acabou de quebrar as moléculas e jogar metade do seu dinheiro no lixo.',
    conteudo: 'Mostra o gesto clássico de esfregar os pulsos e explica por que quebra as notas de saída. Ensina os 5 pontos estratégicos de pulsação.',
    cta: 'Salva esse vídeo para não esquecer e compartilha com aquele amigo que toma banho de perfume.',
    produtoRelacionado: 'Consultoria Olfativa Dino',
    palavraChaveDirect: 'DICA'
  },
  {
    id: 'R7',
    titulo: 'O Ritual da Borrifada na Barbearia Dino',
    categoria: 'Experiência & Cross-Sell',
    gancho: 'Aqui na Barbearia Dino ninguém sai apenas com o cabelo cortado. Você sai com a assinatura olfativa de um vencedor.',
    conteudo: 'Vídeo dinâmico mostrando o barbeiro finalizando o corte e oferecendo a escolha entre um árabe marcante ou um cítrico refrescante.',
    cta: 'Vem viver essa experiência. Agende pelo Kytto no nosso link da bio.',
    produtoRelacionado: 'Atendimento Barbearia + Borrifada Cortesia',
    palavraChaveDirect: 'RITUAL'
  }
];

/**
 * Simulador de Resposta do Direct-to-Commerce (KyttoIA Direct Copilot)
 */
export function processarGatilhoDirect({ palavraChave = 'ARABE', nomeSeguidor = 'Amigo' } = {}) {
  const chave = String(palavraChave).trim().toUpperCase();
  const primeiroNome = String(nomeSeguidor).trim().split(/\s+/)[0];

  const catalogoRespostas = {
    ARABE: {
      texto: `Fala, ${primeiroNome}! Aqui é o Dino! 🦖✨ Vi que você curtiu o Reel dos Perfumes Árabes!\n\nOs frascos do *Lattafa Asad* e do *Club de Nuit Iconic* estão saindo muito rápido aqui na Perfumaria Dino em Tangará da Serra.\n\n🔥 *Condição Especial de Seguidor:* Se fechar hoje, você garante *10% OFF no cartão* ou *Frete Grátis Express* para Tangará e toda a região (Campo Novo, Barra, Nova Olímpia).\n\n👇 Clica no botão abaixo para ver as fotos e notas olfativas no catálogo:`,
      linkCatalogo: 'https://kytto.com.br/perfumaria/arabes',
      whatsappDireto: 'https://wa.me/5565993360000?text=Ol%C3%A1%20Dino!%20Vim%20pelo%20Reel%20do%20Instagram%20e%20quero%20o%20Lattafa%20Asad'
    },
    VISAGISMO: {
      texto: `Fala, ${primeiroNome}! Show demais! 💈 O visagismo não é só cortar o cabelo, é desenhar a sua imagem de autoridade e respeito.\n\nNa Barbearia Dino nós analisamos o formato do seu crânio, linhas da mandíbula e estilo de vida para encontrar o visual perfeito.\n\n✂️ *Aproveita que temos horários promocionais com 30% OFF* em dias estratégicos da semana!\n\n👇 Clica aqui para escolher o seu melhor dia e horário:`,
      linkCatalogo: 'https://kytto.com.br/agenda/dino-barbearia',
      whatsappDireto: 'https://wa.me/5565993360000?text=Ol%C3%A1%20Dino!%20Quero%20agendar%20minha%20consultoria%20de%20visagismo'
    },
    CALOR: {
      texto: `E aí, ${primeiroNome}! O calor de Tangará não perdoa, né? ☀️🔥\n\nSeparei para você os 3 campões em fixação e frescor pro nosso clima de MT:\n1️⃣ *Acqua Di Gio EDT* (O rei marinho e cítrico)\n2️⃣ *Armaf Club de Nuit Sillage* (Elegante e gelado)\n3️⃣ *Versace Eros EDT* (Marcante e fresco)\n\n👇 Quer receber em casa hoje mesmo em Tangará ou retirar aqui na barbearia?`,
      linkCatalogo: 'https://kytto.com.br/perfumaria/frescos-mt',
      whatsappDireto: 'https://wa.me/5565993360000?text=Ol%C3%A1%20Dino!%20Quero%20ver%20os%20perfumes%20para%20o%20calor%20de%20MT'
    }
  };

  return catalogoRespostas[chave] || {
    texto: `Fala, ${primeiroNome}! Obrigado por acompanhar os conteúdos do Dino Visagista! 🦖💈\n\nComo posso te ajudar hoje? Quer consultoria de visagismo na barbearia ou conhecer os perfumes importados e árabes da nossa perfumaria?`,
    linkCatalogo: 'https://kytto.com.br',
    whatsappDireto: 'https://wa.me/5565993360000'
  };
}

/**
 * Modelo de Clube Dino Híbrido (Barbearia + Perfumaria)
 */
export const PLANOS_CLUBE_DINO_HIBRIDO = [
  {
    planoId: 'estilo_essencial',
    nome: 'Clube Dino Essencial',
    mensalidade: 159.00,
    beneficios: [
      '2 Cortes Masculinos Premium por mês',
      '10% OFF em qualquer frasco de perfume da loja',
      'Prioridade na fila de agendamento online Kytto'
    ]
  },
  {
    planoId: 'cavalheiro_vip',
    nome: 'Clube Dino Cavalheiro VIP',
    mensalidade: 249.00,
    beneficios: [
      '2 Cortes + 2 Barbas com toalha quente por mês',
      '1 Decant Exclusivo Mensal de 10ml (Perfume de Nicho ou Árabe da sua escolha)',
      '15% OFF em toda a linha de Perfumaria e Cosméticos',
      'Café Espresso Duplo ou Chope Artesanal em cada visita'
    ]
  },
  {
    planoId: 'black_visagista',
    nome: 'Clube Dino Black Visagista',
    mensalidade: 489.00,
    beneficios: [
      'Cortes e Barbas Ilimitados no mês com Dino ou equipe titular',
      '1 Frasco Fechado de Perfume Importado/Árabe a cada 3 meses',
      'Consultoria Visagista Semestral de Imagem Pessoal',
      'Atendimento em sala VIP privativa com bar livre'
    ]
  }
];

/**
 * Projeção Financeira Consolidada de Faturamento Integrado
 */
export function calcularPotencialAceleracaoDino() {
  const barbeariaBuracosRecuperados = 17000.0; // 40% dos R$ 42.500 resgatados pelo T-Rex
  const ritualBorrifadaCadeira = 150 * 380.0 * 0.40; // 150 frascos/decants vendidos na cadeira (margem líquida 40%) = R$ 22.800
  const receitaBrutaPerfumesCadeira = 150 * 380.0; // R$ 57.000 bruto
  const vendasDirectInstagram = 30 * 480.0; // 30 vendas via Reels/Direct para TGA e região = R$ 14.400
  const receitaClubeAssinatura = 80 * 249.0; // 80 assinantes do plano VIP = R$ 19.920/mês recorrente

  const faturamentoNovoBruto = barbeariaBuracosRecuperados + receitaBrutaPerfumesCadeira + vendasDirectInstagram + receitaClubeAssinatura;

  return {
    barbeariaBuracosRecuperados,
    receitaBrutaPerfumesCadeira,
    vendasDirectInstagram,
    receitaClubeAssinatura,
    faturamentoNovoBruto,
    faturamentoNovoBrutoFormatado: `R$ ${faturamentoNovoBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    impactoAnualProjetado: faturamentoNovoBruto * 12,
    impactoAnualProjetadoFormatado: `R$ ${(faturamentoNovoBruto * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  };
}

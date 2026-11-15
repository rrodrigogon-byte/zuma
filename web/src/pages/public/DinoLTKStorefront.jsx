import React, { useState, useEffect, useMemo } from 'react'
import {
  Sparkles,
  Search,
  ShoppingBag,
  ExternalLink,
  MessageCircle,
  Scissors,
  CheckCircle2,
  Flame,
  Award,
  Zap,
  Star,
  ChevronRight,
  ShieldCheck,
  Tag,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  Compass,
  Truck,
  MapPin,
  Check,
  RotateCcw
} from 'lucide-react'

// Dados estáticos de fallback para renderização imediata com suporte offline/rápido
const PERFIL_DINO_DEFAULT = {
  handle: '@odinovisagista',
  url: 'https://www.instagram.com/odinovisagista',
  nome: 'Dino Visagista (Tangará da Serra)',
  localizacao: 'Tangará da Serra - MT',
  bio: 'Visagismo Masculino de Alta Performance & Perfumaria de Luxo e Árabes. Experiência olfativa na cadeira e entrega expressa para MT.'
}

const COLECOES_DEFAULT = [
  { id: 'destaques', titulo: '🔥 Top Mais Vendidos', subtitulo: 'Os preferidos dos clientes em Tangará' },
  { id: 'vistos_reels', titulo: '🎥 Vistos nos Reels', subtitulo: 'Frascos e cortes que viralizaram' },
  { id: 'calor_mt', titulo: '☀️ Clima MT 38°C', subtitulo: 'Frescor gelado e fixação extrema' },
  { id: 'arabes_luxo', titulo: '👑 Árabes & Nicho', subtitulo: 'Cheiro de imponência e respeito' },
  { id: 'decants', titulo: '🧪 Decants 10ml', subtitulo: 'Experimente o luxo (~150 borrifadas)' },
  { id: 'barbearia', titulo: '💈 Barbearia & Cadeira', subtitulo: 'Cortes com visagismo personalizado' },
  { id: 'clube_vip', titulo: '💎 Clube Dino VIP', subtitulo: 'Assinaturas mensais com decant incluso' }
]

const PRODUTOS_DEFAULT = [
  {
    id: 'p1_lattafa_asad',
    nome: 'Lattafa Asad Eau de Parfum (100ml)',
    categoria: 'Perfumes Árabes',
    colecoes: ['destaques', 'vistos_reels', 'arabes_luxo'],
    reelVinculado: 'R3',
    descricao: 'O clone árabe mais aclamado do Sauvage Elixir. Notas de pimenta preta, café, tabaco e âmbar.',
    precoFrasco: 389.00,
    precoDecant10ml: 79.00,
    permiteDecant: true,
    fixacao: '12h+',
    projecao: 'Marcante (2 metros)',
    ocasiao: 'Noite, jantares e reuniões de negócios.',
    imagemUrl: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=800&q=80',
    notasOlfativas: {
      saida: 'Pimenta preta, Abacaxi, Tabaco',
      coracao: 'Café, Patchouli, Íris',
      fundo: 'Âmbar, Baunilha, Madeiras secas'
    },
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
    ocasiao: 'Assinatura diária para o dia todo em MT.',
    imagemUrl: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=800&q=80',
    notasOlfativas: {
      saida: 'Toranja, Limão siciliano, Hortelã, Pimenta rosa',
      coracao: 'Gengibre, Noz-moscada, Melão, Jasmim',
      fundo: 'Incenso, Âmbar, Cedro, Sândalo'
    },
    destaque: true
  },
  {
    id: 'p3_armaf_sillage',
    nome: 'Armaf Club de Nuit Sillage (105ml)',
    categoria: 'Perfumes Árabes',
    colecoes: ['calor_mt', 'vistos_reels'],
    reelVinculado: 'R1',
    descricao: 'Inspirado no Silver Mountain Water da Creed. Frescor metálico, gelado e aristocrático.',
    precoFrasco: 429.00,
    precoDecant10ml: 85.00,
    permiteDecant: true,
    fixacao: '9h',
    projecao: 'Elegante e aerada',
    ocasiao: 'Dias de calor extremo (38°C a 42°C) em MT.',
    imagemUrl: 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=800&q=80',
    notasOlfativas: {
      saida: 'Bergamota, Groselha preta, Limão',
      coracao: 'Rosa, Íris, Jasmim aquático',
      fundo: 'Ambroxan, Almíscar, Sândalo, Cedro'
    },
    destaque: false
  },
  {
    id: 'p4_supremacy_not_only_intense',
    nome: 'Afnan Supremacy Not Only Intense (100ml)',
    categoria: 'Perfumes Árabes',
    colecoes: ['destaques', 'arabes_luxo', 'vistos_reels'],
    reelVinculado: 'R3',
    descricao: 'Extrait de Parfum. Notas frutadas de maçã e cassis com base esfumaçada de musgo de carvalho.',
    precoFrasco: 499.00,
    precoDecant10ml: 95.00,
    permiteDecant: true,
    fixacao: '14h+',
    projecao: 'Nuclear (deixa rastro inconfundível)',
    ocasiao: 'Eventos de gala, casamentos e noites de impacto.',
    imagemUrl: 'https://images.unsplash.com/photo-1616949755610-8c9bbc08f138?auto=format&fit=crop&w=800&q=80',
    notasOlfativas: {
      saida: 'Bergamota, Maçã fresca, Groselha preta',
      coracao: 'Lavanda, Patchouli, Musgo de carvalho',
      fundo: 'Açafrão, Almíscar, Âmbar cinzento'
    },
    destaque: true
  },
  {
    id: 'p5_acqua_di_gio_profondo',
    nome: 'Giorgio Armani Acqua Di Gio Profondo (125ml)',
    categoria: 'Perfumes Designer',
    colecoes: ['calor_mt', 'destaques'],
    reelVinculado: 'R1',
    descricao: 'O ícone aquático do luxo italiano. Notas marinhas profundas, alecrim e patchouli.',
    precoFrasco: 689.00,
    precoDecant10ml: 119.00,
    permiteDecant: true,
    fixacao: '8h',
    projecao: 'Sofisticada e limpa',
    ocasiao: 'Perfume assinatura do homem executivo.',
    imagemUrl: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80',
    notasOlfativas: {
      saida: 'Notas marinhas, Aquozone, Bergamota verde',
      coracao: 'Alecrim, Lavanda, Cipreste',
      fundo: 'Patchouli mineral, Almíscar'
    },
    destaque: true
  },
  {
    id: 's1_corte_visagista',
    nome: 'Consultoria Visagista + Corte na Cadeira',
    categoria: 'Barbearia & Visagismo',
    colecoes: ['barbearia', 'destaques', 'vistos_reels'],
    reelVinculado: 'R2',
    descricao: 'Análise morfológica facial, corte personalizado e Ritual da Borrifada com Perfume de Luxo Cortesia.',
    precoFrasco: 90.00,
    precoDecant10ml: 63.00, // Preço promocional seguidor Instagram 30% OFF
    permiteDecant: false,
    fixacao: 'Visual alinhado por 25 dias',
    projecao: 'Autoridade e respeito imediato',
    ocasiao: 'Para quem busca imagem de líder e respeito.',
    imagemUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
    notasOlfativas: {
      saida: 'Toalha quente com eucalipto',
      coracao: 'Lavagem com massagem capilar',
      fundo: 'Borrifada de Perfume Importado à escolha'
    },
    destaque: true
  },
  {
    id: 's2_combo_cavalheiro',
    nome: 'Combo Cavalheiro: Corte Visagista + Barboterapia',
    categoria: 'Barbearia & Visagismo',
    colecoes: ['barbearia', 'destaques'],
    reelVinculado: 'R7',
    descricao: 'Corte visagista completo, desenho de barba milimétrico com toalha quente e finalização com óleo aromático.',
    precoFrasco: 140.00,
    precoDecant10ml: 98.00,
    permiteDecant: false,
    fixacao: 'Renovação da autoimagem',
    projecao: 'Impacto visual imbatível',
    ocasiao: 'Semanal ou quinzenal para manter o alinhamento impecável.',
    imagemUrl: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=800&q=80',
    notasOlfativas: {
      saida: 'Vapor de ozônio e toalha quente',
      coracao: 'Espuma hidratante clássica',
      fundo: 'Ritual da Borrifada com Perfume de Nicho'
    },
    destaque: true
  },
  {
    id: 'c1_clube_dino_vip',
    nome: 'Assinatura Clube Dino Cavalheiro VIP',
    categoria: 'Clube VIP Híbrido',
    colecoes: ['clube_vip', 'destaques'],
    reelVinculado: 'R7',
    descricao: '2 Cortes Visagistas + 2 Barbas por mês + 1 Decant de 10ml grátis todo mês + 15% OFF em perfumes.',
    precoFrasco: 249.00,
    precoDecant10ml: null,
    permiteDecant: false,
    fixacao: 'Assinatura recorrente inteligente',
    projecao: 'Status de cliente VIP Dino',
    ocasiao: 'Para quem busca praticidade sem fila e economia real.',
    imagemUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80',
    notasOlfativas: {
      saida: 'Café espresso ou chope cortesia',
      coracao: 'Agendamento prioritário no app Kytto',
      fundo: 'Decant de 10ml entregue todo mês'
    },
    destaque: true
  }
]

export default function DinoLTKStorefront() {
  const [colecaoAtiva, setColecaoAtiva] = useState('destaques')
  const [busca, setBusca] = useState('')
  const [produtos, setProdutos] = useState(PRODUTOS_DEFAULT)
  const [produtoModal, setProdutoModal] = useState(null)
  const [opcaoPreco, setOpcaoPreco] = useState('decant') // 'decant' ou 'frasco'
  const [loading, setLoading] = useState(false)
  const [quizAberto, setQuizAberto] = useState(false)
  const [quizEtapa, setQuizEtapa] = useState(1)
  const [quizRespostas, setQuizRespostas] = useState({ ocasiao: '', intensidade: '', formato: '' })
  const [quizResultado, setQuizResultado] = useState(null)
  const [modalFreteAberto, setModalFreteAberto] = useState(false)

  // Carrega produtos dinâmicos do backend caso disponível
  useEffect(() => {
    fetch('/api/public/dino/ltk/storefront')
      .then(r => r.json())
      .then(d => {
        if (d.ok && Array.isArray(d.produtos) && d.produtos.length > 0) {
          setProdutos(d.produtos)
        }
      })
      .catch(() => {
        // Fallback gracioso com dados locais
      })
  }, [])

  // Filtragem de produtos por coleção e busca
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      const matchBusca = busca.trim() === '' ||
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        p.categoria.toLowerCase().includes(busca.toLowerCase()) ||
        p.descricao.toLowerCase().includes(busca.toLowerCase())

      if (colecaoAtiva === 'todos') return matchBusca
      if (colecaoAtiva === 'decants') return matchBusca && p.permiteDecant
      return matchBusca && Array.isArray(p.colecoes) && p.colecoes.includes(colecaoAtiva)
    })
  }, [produtos, colecaoAtiva, busca])

  // Rastreamento de clique no produto
  const handleProdutoClick = (produto) => {
    setProdutoModal(produto)
    setOpcaoPreco(produto.permiteDecant ? 'decant' : 'frasco')
    try {
      fetch('/api/public/dino/ltk/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produtoId: produto.id, colecaoId: colecaoAtiva, canal: 'storefront_web' })
      }).catch(() => {})
    } catch (_) {}
  }

  // Gera link do WhatsApp com mensagem contextualizada
  const abrirWhatsAppComProduto = (produto, tipo = 'decant') => {
    const isDecant = tipo === 'decant' && produto.permiteDecant
    const valor = isDecant ? produto.precoDecant10ml : produto.precoFrasco
    const itemNome = isDecant ? `${produto.nome} (Decant 10ml)` : produto.nome

    const msg = encodeURIComponent(
      `Olá, Dino! Vi o produto na sua vitrine do Instagram (@odinovisagista):\n\n` +
      `🔥 *${itemNome}*\n` +
      `💰 *Valor:* R$ ${valor ? valor.toFixed(2) : ''}\n\n` +
      `Gostaria de fechar o pedido e receber em Tangará da Serra/região!`
    )
    window.open(`https://wa.me/5565993360000?text=${msg}`, '_blank')
  }

  // Lógica do Consultor Olfativo KyttoIA 2.5 Flash
  const responderQuiz = (chave, valor) => {
    const novasRespostas = { ...quizRespostas, [chave]: valor }
    setQuizRespostas(novasRespostas)
    if (quizEtapa < 3) {
      setQuizEtapa(quizEtapa + 1)
    } else {
      // Finalizar e calcular resultado
      const { ocasiao, intensidade, formato } = novasRespostas
      let produtoRecomendado = produtos.find(p => p.id === 'lattafa-khamrah') || produtos[0]
      let matchPct = 98
      let justificativa = ''

      if (ocasiao === 'calor') {
        if (intensidade === 'frescor') {
          produtoRecomendado = produtos.find(p => p.id === 'roja-elysium') || produtos[0]
          matchPct = 99
          justificativa = 'A combinação perfeita de toranja, limão e vetiver aristocrático. Não desanda sob 38°C e confere sensação de banho gelado revigorante o dia inteiro.'
        } else if (intensidade === 'elegancia') {
          produtoRecomendado = produtos.find(p => p.id === 'nishane-hacivat') || produtos[0]
          matchPct = 99
          justificativa = 'Extrait de Parfum com altíssima concentração de óleos nobres. Abacaxi frutado e musgo de carvalho com 14h+ de fixação blindada contra o calor de MT.'
        } else {
          produtoRecomendado = produtos.find(p => p.id === 'armaf-club-de-nuit') || produtos[0]
          matchPct = 98
          justificativa = 'O campeão absoluto de elogios em Tangará da Serra. Projeção intensa de limão siciliano e bétula defumada que domina o ambiente com presença marcante.'
        }
      } else if (ocasiao === 'noite') {
        produtoRecomendado = produtos.find(p => p.id === 'lattafa-khamrah') || produtos[0]
        matchPct = 99
        justificativa = 'Uma obra-prima oriental com canela, tâmaras, pralinê e baunilha. Projeção doce e especiada envolvente que atrai olhares e elogios imediatos em encontros e eventos.'
      } else if (ocasiao === 'fazenda') {
        produtoRecomendado = produtos.find(p => p.id === 'lattafa-asad') || produtos[0]
        matchPct = 97
        justificativa = 'Âmbar especiado com notas de pimenta preta, tabaco e café. Perfeito para clima de fazenda, negócios agro e rodeios, mantendo rusticidade e alta masculinidade.'
      } else {
        produtoRecomendado = produtos.find(p => p.id === 'creed-aventus') || produtos[0]
        matchPct = 98
        justificativa = 'O ícone mundial de autoridade e liderança masculina. Abacaxi real, bétula e âmbar gris para reuniões executivas e presença imponente.'
      }

      setQuizResultado({
        produto: produtoRecomendado,
        matchPct,
        justificativa,
        formatoRecomendado: formato === 'frasco' ? 'frasco' : 'decant'
      })
    }
  }

  const reiniciarQuiz = () => {
    setQuizEtapa(1)
    setQuizRespostas({ ocasiao: '', intensidade: '', formato: '' })
    setQuizResultado(null)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* HEADER DO CRIADOR (ESTILO LTK STOREFRONT) */}
      <header className="relative bg-gradient-to-b from-slate-900 to-slate-950 border-b border-amber-900/30 pt-8 pb-6 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
          {/* Avatar com Borda Dourada e Selo de Verificado */}
          <div className="relative mb-3">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-tr from-amber-500 via-amber-300 to-yellow-600 shadow-xl shadow-amber-500/20">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
                alt="Dino Visagista"
                className="w-full h-full object-cover rounded-full border-2 border-slate-950"
              />
            </div>
            <span
              className="absolute bottom-1 right-1 bg-blue-500 text-white rounded-full p-1 shadow-md border-2 border-slate-950"
              title="Criador Verificado Oficial"
            >
              <CheckCircle2 className="w-4 h-4 fill-current text-blue-500" />
            </span>
          </div>

          {/* Nome, Handle e Badges */}
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            Dino Visagista
            <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-medium">
              Dino Visagista 🦖
            </span>
          </h1>

          <p className="text-amber-400 font-medium text-sm mt-0.5">
            @odinovisagista • Tangará da Serra - MT
          </p>

          <p className="text-slate-300 text-xs sm:text-sm max-w-xl mt-2 leading-relaxed">
            Visagismo Masculino de Alta Performance & Perfumaria de Nicho & Árabes.
            Compre os produtos vistos nos Reels ou agende sua consultoria na cadeira.
          </p>

          {/* Métricas Rápidas de Autoridade */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-4 text-xs text-slate-400 border-t border-slate-800/80 pt-3 w-full max-w-md">
            <div>
              <strong className="text-white text-sm">17,1k</strong> seguidores
            </div>
            <div>
              <strong className="text-white text-sm">4.9 ★</strong> (340 clientes)
            </div>
            <div className="flex items-center gap-1 text-emerald-400">
              <Zap className="w-3.5 h-3.5" /> Entrega Expressa MT
            </div>
          </div>

          {/* Botões de Ação Rápida */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
            <a
              href="https://www.instagram.com/odinovisagista"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-semibold hover:opacity-90 transition shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Seguir no Instagram
            </a>

            <a
              href="https://wa.me/5565993360000?text=Ol%C3%A1%20Dino!%20Vim%20pelo%20seu%20Instagram%20e%20quero%20conhecer%20os%20perfumes"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition shadow-sm"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp Consultivo
            </a>

            <a
              href="/agenda/dino-barbearia"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition shadow-sm"
            >
              <Scissors className="w-3.5 h-3.5" /> Agendar Cadeira (30% OFF)
            </a>
          </div>
        </div>
      </header>

      {/* CARDS DE DESTAQUE INTERATIVO: QUIZ OLFATIVO KYTTOIA & FRETE / RETIRADA NA CADEIRA */}
      <section className="max-w-4xl mx-auto px-4 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Card do Quiz Olfativo */}
        <div
          onClick={() => { reiniciarQuiz(); setQuizAberto(true); }}
          className="bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-900/40 border border-amber-500/40 hover:border-amber-400 rounded-2xl p-4 flex items-center justify-between gap-3 cursor-pointer transition shadow-lg group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Compass className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wider block font-bold">
                Motor KyttoIA 2.5 Flash
              </span>
              <h3 className="text-sm font-extrabold text-white group-hover:text-amber-200 transition">
                Descubra seu Perfume Assinatura
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                3 perguntas rápidas para achar seu match no calor de MT
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-amber-400 shrink-0 group-hover:translate-x-1 transition-transform" />
        </div>

        {/* Card de Retirada na Cadeira & Frete */}
        <div
          onClick={() => setModalFreteAberto(true)}
          className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-500/30 hover:border-emerald-400 rounded-2xl p-4 flex items-center justify-between gap-3 cursor-pointer transition shadow-lg group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Truck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider block font-bold">
                Tangará da Serra & MT
              </span>
              <h3 className="text-sm font-extrabold text-white group-hover:text-emerald-200 transition">
                Retirada na Cadeira & Sedex
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Retire na Barbearia c/ borrifada grátis ou Motoboy
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-emerald-400 shrink-0 group-hover:translate-x-1 transition-transform" />
        </div>
      </section>

      {/* BANNER DO MOTOR DIRECT-TO-COMMERCE KYTTOIA */}
      <section className="max-w-4xl mx-auto px-4 mt-4">
        <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/60 border border-amber-500/30 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-white block">
                Comente nos Reels do Dino para receber no Direct
              </span>
              <span className="text-slate-400">
                Digite <strong className="text-amber-300">ARABE</strong>, <strong className="text-amber-300">CALOR</strong> ou <strong className="text-amber-300">VISAGISMO</strong> para receber o checkout em 3 segundos!
              </span>
            </div>
          </div>
          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-md font-mono text-[11px] whitespace-nowrap">
            Motor KyttoIA 2.5 Flash
          </span>
        </div>
      </section>

      {/* CAMPO DE BUSCA */}
      <section className="max-w-4xl mx-auto px-4 mt-5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar perfumes, decants, visagismo ou notas olfativas..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition"
          />
        </div>
      </section>

      {/* ABAS DE COLEÇÕES ESTILO LTK (PILLS COM SCROLL HORIZONTAL) */}
      <section className="max-w-4xl mx-auto px-4 mt-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setColecaoAtiva('todos')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
              colecaoAtiva === 'todos'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            Todos ({produtos.length})
          </button>
          {COLECOES_DEFAULT.map(c => (
            <button
              key={c.id}
              onClick={() => setColecaoAtiva(c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
                colecaoAtiva === c.id
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              {c.titulo}
            </button>
          ))}
        </div>
      </section>

      {/* GRID DE PRODUTOS DA VITRINE LTK */}
      <main className="max-w-4xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {produtosFiltrados.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-200 group shadow-lg"
            >
              {/* Imagem do Produto com Badge de Reel */}
              <div
                className="relative h-48 w-full overflow-hidden bg-slate-950 cursor-pointer"
                onClick={() => handleProdutoClick(item)}
              >
                <img
                  src={item.imagemUrl}
                  alt={item.nome}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100"
                />
                {item.reelVinculado && (
                  <span className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-400" />
                    Visto no Reel {item.reelVinculado}
                  </span>
                )}
                {item.permiteDecant && (
                  <span className="absolute top-2 right-2 bg-emerald-950/80 backdrop-blur-md text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md">
                    Decant 10ml Disponível
                  </span>
                )}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] text-slate-300 bg-slate-950/70 backdrop-blur-sm px-2 py-1 rounded-md">
                  <span>Fixação: <strong className="text-white">{item.fixacao}</strong></span>
                  <span className="text-amber-400 font-medium">★ 4.9</span>
                </div>
              </div>

              {/* Corpo do Card */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 block mb-1">
                    {item.categoria}
                  </span>
                  <h3
                    onClick={() => handleProdutoClick(item)}
                    className="font-bold text-white text-sm line-clamp-2 hover:text-amber-300 cursor-pointer transition leading-snug"
                  >
                    {item.nome}
                  </h3>
                  <p className="text-slate-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                    {item.descricao}
                  </p>

                  {/* Notas Olfativas Rápidas */}
                  {item.notasOlfativas && (
                    <div className="mt-2 text-[11px] bg-slate-950/50 p-2 rounded-lg border border-slate-800 text-slate-400">
                      <span className="text-slate-500 block text-[9px] uppercase font-bold">Saída & Fundo:</span>
                      <span className="text-slate-300 truncate block">{item.notasOlfativas.saida}</span>
                    </div>
                  )}
                </div>

                {/* Preços e Ações */}
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <div className="flex items-baseline justify-between mb-2">
                    <div>
                      {item.permiteDecant && item.precoDecant10ml ? (
                        <>
                          <span className="text-[10px] text-slate-400 block">Decant 10ml a partir de</span>
                          <span className="text-lg font-extrabold text-amber-400">
                            R$ {item.precoDecant10ml.toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] text-slate-400 block">Valor</span>
                          <span className="text-lg font-extrabold text-amber-400">
                            R$ {item.precoFrasco.toFixed(2)}
                          </span>
                        </>
                      )}
                    </div>
                    {item.permiteDecant && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">Frasco 100ml</span>
                        <span className="text-xs text-slate-300 font-medium">
                          R$ {item.precoFrasco.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Botões do Card */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleProdutoClick(item)}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2 px-2 rounded-xl text-xs flex items-center justify-center gap-1 transition"
                    >
                      <Info className="w-3.5 h-3.5 text-slate-400" /> Detalhes
                    </button>
                    <button
                      onClick={() => abrirWhatsAppComProduto(item, item.permiteDecant ? 'decant' : 'frasco')}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 px-2 rounded-xl text-xs flex items-center justify-center gap-1 transition shadow-md shadow-amber-500/20"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" /> Pedir Agora
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {produtosFiltrados.length === 0 && (
          <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800 mt-4">
            <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-300 text-sm font-semibold">Nenhum produto encontrado nesta coleção.</p>
            <p className="text-slate-500 text-xs mt-1">Tente buscar por outro termo ou selecione "Todos".</p>
          </div>
        )}
      </main>

      {/* MODAL DE DETALHES DO PRODUTO (EXPERIÊNCIA LTK COMPLETA) */}
      {produtoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto p-5 text-slate-100 shadow-2xl relative">
            {/* Botão Fechar */}
            <button
              onClick={() => setProdutoModal(null)}
              className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full p-1.5 transition text-xs"
            >
              ✕
            </button>

            {/* Imagem do Produto no Modal */}
            <div className="relative h-56 w-full rounded-xl overflow-hidden bg-slate-950 mb-4">
              <img
                src={produtoModal.imagemUrl}
                alt={produtoModal.nome}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-2 left-2 bg-slate-950/80 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-md">
                {produtoModal.categoria}
              </span>
            </div>

            <h2 className="text-xl font-extrabold text-white leading-tight">
              {produtoModal.nome}
            </h2>

            <p className="text-slate-300 text-xs mt-2 leading-relaxed">
              {produtoModal.descricao}
            </p>

            {/* Pirâmide Olfativa Detalhada */}
            {produtoModal.notasOlfativas && (
              <div className="mt-4 bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs">
                <span className="font-bold text-amber-400 text-[11px] uppercase tracking-wide block mb-2">
                  Pirâmide Olfativa Completa
                </span>
                <div className="space-y-1.5 text-slate-300">
                  <div>
                    <strong className="text-white">Notas de Saída:</strong> {produtoModal.notasOlfativas.saida}
                  </div>
                  <div>
                    <strong className="text-white">Notas de Coração:</strong> {produtoModal.notasOlfativas.coracao}
                  </div>
                  <div>
                    <strong className="text-white">Notas de Fundo:</strong> {produtoModal.notasOlfativas.fundo}
                  </div>
                </div>
              </div>
            )}

            {/* Informações de Desempenho */}
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Fixação na Pele</span>
                <strong className="text-emerald-400">{produtoModal.fixacao}</strong>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Projeção</span>
                <strong className="text-amber-400">{produtoModal.projecao}</strong>
              </div>
            </div>

            {/* Seletor de Opção: Decant vs Frasco (se aplicável) */}
            {produtoModal.permiteDecant && (
              <div className="mt-4">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-2">
                  Escolha o Formato:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setOpcaoPreco('decant')}
                    className={`p-3 rounded-xl border text-left transition ${
                      opcaoPreco === 'decant'
                        ? 'border-amber-500 bg-amber-500/10 text-white shadow-sm'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-[10px] block font-bold text-amber-400">Decant Oficial 10ml</span>
                    <span className="text-sm font-extrabold text-white">
                      R$ {produtoModal.precoDecant10ml.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">~150 borrifadas</span>
                  </button>

                  <button
                    onClick={() => setOpcaoPreco('frasco')}
                    className={`p-3 rounded-xl border text-left transition ${
                      opcaoPreco === 'frasco'
                        ? 'border-amber-500 bg-amber-500/10 text-white shadow-sm'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-[10px] block font-bold text-amber-400">Frasco Lacrado Original</span>
                    <span className="text-sm font-extrabold text-white">
                      R$ {produtoModal.precoFrasco.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">100ml a 125ml</span>
                  </button>
                </div>
              </div>
            )}

            {/* Botões de Ação do Modal */}
            <div className="mt-5 space-y-2">
              <button
                onClick={() => {
                  abrirWhatsAppComProduto(produtoModal, opcaoPreco)
                  setProdutoModal(null)
                }}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/20"
              >
                <ShoppingBag className="w-4 h-4" />
                Pedir via WhatsApp com o Dino
              </button>

              <p className="text-center text-[11px] text-slate-500">
                📦 Entrega no mesmo dia para Tangará da Serra e envio para todo MT.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DO QUIZ OLFATIVO KYTTOIA 2.5 FLASH */}
      {quizAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setQuizAberto(false)}
              className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full p-1.5 transition text-xs"
            >
              ✕
            </button>

            {/* Header do Quiz */}
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
                <Compass className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest block font-bold">
                  Motor KyttoIA 2.5 Flash
                </span>
                <h2 className="text-base font-extrabold text-white">
                  Consultor Olfativo Inteligente
                </h2>
              </div>
            </div>

            {!quizResultado ? (
              <div>
                {/* Barra de Progresso */}
                <div className="w-full bg-slate-800 rounded-full h-1.5 mb-5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-yellow-400 h-1.5 transition-all duration-300"
                    style={{ width: `${(quizEtapa / 3) * 100}%` }}
                  />
                </div>

                {/* Etapa 1: Ocasião */}
                {quizEtapa === 1 && (
                  <div className="space-y-3">
                    <span className="text-xs text-amber-400 font-bold block uppercase tracking-wide">
                      Passo 1 de 3 • Ocasião Principal
                    </span>
                    <h3 className="text-sm font-bold text-white leading-snug">
                      Onde você pretende mais usar esse perfume?
                    </h3>
                    <div className="space-y-2 mt-3">
                      {[
                        { id: 'calor', label: '🔥 Calor de Tangará (38°C) & Trabalho Diário', desc: 'Resistência ao sol sem desandar na pele' },
                        { id: 'noite', label: '🌙 Noites, Baladas & Encontros a Dois', desc: 'Sedução, doçura e mistério' },
                        { id: 'fazenda', label: '🚜 Fazenda, Agro, Lida & Rodeio', desc: 'Couro, café e especiarias de alta virilidade' },
                        { id: 'escritorio', label: '💼 Reuniões & Escritório Climatizado', desc: 'Presença executiva e liderança refinada' }
                      ].map(op => (
                        <button
                          key={op.id}
                          onClick={() => responderQuiz('ocasiao', op.id)}
                          className="w-full text-left p-3 rounded-xl border border-slate-800 bg-slate-950/70 hover:border-amber-500/60 hover:bg-amber-500/10 transition group"
                        >
                          <strong className="text-xs text-white group-hover:text-amber-200 block">{op.label}</strong>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">{op.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Etapa 2: Intensidade e Projeção */}
                {quizEtapa === 2 && (
                  <div className="space-y-3">
                    <span className="text-xs text-amber-400 font-bold block uppercase tracking-wide">
                      Passo 2 de 3 • Aura e Projeção
                    </span>
                    <h3 className="text-sm font-bold text-white leading-snug">
                      Qual sensação você quer provocar no ambiente?
                    </h3>
                    <div className="space-y-2 mt-3">
                      {[
                        { id: 'frescor', label: '🧊 Frescor Gelado & Sensação de Banho Tomado', desc: 'Leveza aristocrática que não sufoca ninguém' },
                        { id: 'marcante', label: '💥 Projeção Monstruosa (Chega Antes no Ambiente)', desc: 'Campeão de elogios imediatos por onde passa' },
                        { id: 'elegancia', label: '👑 Aura de Riqueza & Exclusividade de Nicho', desc: 'Extrait de Parfum com fixação de mais de 12h' }
                      ].map(op => (
                        <button
                          key={op.id}
                          onClick={() => responderQuiz('intensidade', op.id)}
                          className="w-full text-left p-3 rounded-xl border border-slate-800 bg-slate-950/70 hover:border-amber-500/60 hover:bg-amber-500/10 transition group"
                        >
                          <strong className="text-xs text-white group-hover:text-amber-200 block">{op.label}</strong>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">{op.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Etapa 3: Formato */}
                {quizEtapa === 3 && (
                  <div className="space-y-3">
                    <span className="text-xs text-amber-400 font-bold block uppercase tracking-wide">
                      Passo 3 de 3 • Formato Ideal
                    </span>
                    <h3 className="text-sm font-bold text-white leading-snug">
                      Como prefere começar sua experiência?
                    </h3>
                    <div className="space-y-2 mt-3">
                      {[
                        { id: 'decant', label: '✨ Decant Oficial 10ml (~150 borrifadas)', desc: 'Preço acessível (R$ 79 a R$ 139), cabe no porta-luvas/bolso' },
                        { id: 'frasco', label: '👑 Frasco Lacrado de Colecionador (100ml)', desc: 'Frasco original lacrado com selo de originalidade' }
                      ].map(op => (
                        <button
                          key={op.id}
                          onClick={() => responderQuiz('formato', op.id)}
                          className="w-full text-left p-3 rounded-xl border border-slate-800 bg-slate-950/70 hover:border-amber-500/60 hover:bg-amber-500/10 transition group"
                        >
                          <strong className="text-xs text-white group-hover:text-amber-200 block">{op.label}</strong>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">{op.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Tela de Resultado do Motor KyttoIA */
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-transparent border border-amber-500/40 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-extrabold text-amber-300">
                      Match Perfeito KyttoIA
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30">
                    {quizResultado.matchPct}% de Compatibilidade
                  </span>
                </div>

                <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 flex gap-3.5 items-center">
                  <img
                    src={quizResultado.produto.imagemUrl}
                    alt={quizResultado.produto.nome}
                    className="w-16 h-16 rounded-lg object-cover shrink-0 border border-amber-500/30"
                  />
                  <div>
                    <h4 className="text-sm font-extrabold text-white leading-tight">
                      {quizResultado.produto.nome}
                    </h4>
                    <span className="text-[11px] text-amber-400 font-medium block mt-0.5">
                      {quizResultado.produto.categoria}
                    </span>
                    <span className="text-xs font-bold text-white block mt-1">
                      {quizResultado.formatoRecomendado === 'decant' && quizResultado.produto.permiteDecant
                        ? `Decant 10ml: R$ ${quizResultado.produto.precoDecant10ml.toFixed(2)}`
                        : `Frasco: R$ ${quizResultado.produto.precoFrasco.toFixed(2)}`}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
                  <strong className="text-amber-300 block mb-1">Por que é o perfume perfeito para você em MT?</strong>
                  {quizResultado.justificativa}
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => {
                      abrirWhatsAppComProduto(quizResultado.produto, quizResultado.formatoRecomendado)
                      setQuizAberto(false)
                    }}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/20"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Pedir {quizResultado.formatoRecomendado === 'decant' ? 'Decant 10ml' : 'Frasco'} no WhatsApp do Dino
                  </button>

                  <button
                    onClick={reiniciarQuiz}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Refazer Quiz
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE OPÇÕES DE FRETE E RETIRADA NA CADEIRA */}
      {modalFreteAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl max-w-md w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setModalFreteAberto(false)}
              className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full p-1.5 transition text-xs"
            >
              ✕
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
                <Truck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest block font-bold">
                  Logística Regional Dino
                </span>
                <h2 className="text-base font-extrabold text-white">
                  Como Receber seu Perfume
                </h2>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              {/* Opção 1: Retirada na Cadeira */}
              <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-1">
                  <strong className="text-white flex items-center gap-1.5 text-xs">
                    <Scissors className="w-3.5 h-3.5 text-amber-400" /> Retirada na Barbearia (Cadeira)
                  </strong>
                  <span className="text-emerald-400 font-bold font-mono">GRÁTIS</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Retire no Centro de Tangará da Serra. Você ganha de cortesia uma borrifada teste de degustação na cadeira com a consultoria do Dino ou barbeiro!
                </p>
              </div>

              {/* Opção 2: Motoboy Tangará */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-1">
                  <strong className="text-white flex items-center gap-1.5 text-xs">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" /> Motoboy Express Tangará da Serra
                  </strong>
                  <span className="text-amber-300 font-bold font-mono">R$ 15,00</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Entrega no mesmo dia em qualquer bairro de Tangará da Serra/MT. Grátis em pedidos acima de R$ 150,00!
                </p>
              </div>

              {/* Opção 3: Sedex MT */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-1">
                  <strong className="text-white flex items-center gap-1.5 text-xs">
                    <Truck className="w-3.5 h-3.5 text-blue-400" /> Sedex Regional Mato Grosso
                  </strong>
                  <span className="text-slate-300 font-bold font-mono">1 a 3 dias</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Envio expresso para Cuiabá, Rondonópolis, Sinop, Lucas do Rio Verde, Sorriso, Nova Mutum e Campo Novo do Parecis com rastreamento seguro.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <button
                onClick={() => setModalFreteAberto(false)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition"
              >
                Entendi, voltar para vitrine
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

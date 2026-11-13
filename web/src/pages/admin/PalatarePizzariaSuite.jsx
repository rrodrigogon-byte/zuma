import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Pizza,
  Utensils,
  ChefHat,
  Flame,
  Clock,
  Truck,
  Users,
  TrendingUp,
  Building2,
  Sparkles,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Share2,
  ExternalLink,
  Wine,
  ShoppingBag,
  Send,
  Heart,
  Award,
  Smile
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const TABS = [
  { id: 'montador', label: 'Montador de Pizzas', icon: Pizza, badge: 'Multi-Sabores' },
  { id: 'rodizio', label: 'Rodízio Inteligente', icon: Utensils, badge: 'Ter, Qua, Sex' },
  { id: 'kds', label: 'KDS Forno a Lenha', icon: ChefHat, badge: '400°C Ao Vivo' },
  { id: 'delivery', label: 'Delivery Tangará', icon: Truck, badge: 'Zonas & Motoboy' },
  { id: 'crm', label: 'Clientes 360° & CRM', icon: Users, badge: 'RFV & Paladar' },
  { id: 'bi', label: 'Inteligência de Vendas', icon: TrendingUp, badge: 'Curva ABC' },
  { id: 'grupo', label: 'Grupo Serrano & Palatare', icon: Building2, badge: 'Holding' },
];

export default function PalatarePizzariaSuite() {
  const navigate = useNavigate();
  const { user, empresaAtiva } = useAuth();
  
  // Obter tab inicial da URL
  const queryParams = new URLSearchParams(window.location.search);
  const initialTab = queryParams.get('tab') || 'montador';
  const [tabAtiva, setTabAtiva] = useState(initialTab);

  const [carregando, setCarregando] = useState(true);
  const [dadosSuite, setDadosSuite] = useState(null);
  const [erro, setErro] = useState(null);

  // Estados do Montador de Pizzas
  const [tamanhoSel, setTamanhoSel] = useState('grande');
  const [fracaoSel, setFracaoSel] = useState('2_sabores'); // 1_sabor, 2_sabores, 3_sabores, 4_sabores
  const [saboresEscolhidos, setSaboresEscolhidos] = useState([
    'Pizza Filé Mignon ao Gorgonzola (Grande 8 Fatias)',
    'Pizza de Picanha Especial da Palatare (Grande 8 Fatias)',
    '',
    ''
  ]);
  const [massaSel, setMassaSel] = useState('napolitana_48h');
  const [bordaSel, setBordaSel] = useState('catupiry');
  const [adicionaisSel, setAdicionaisSel] = useState(['adc-bacon']);
  const [exclusoesSel, setExclusoesSel] = useState(['Sem cebola']);
  const [observacaoLivre, setObservacaoLivre] = useState('');
  const [tipoDestino, setTipoDestino] = useState('mesa'); // 'mesa', 'delivery', 'balcao'
  const [numeroMesa, setNumeroMesa] = useState('4');
  const [nomeClientePedido, setNomeClientePedido] = useState('');
  const [pedidoSucesso, setPedidoSucesso] = useState(null);

  // Estados do CRM
  const [buscaCrm, setBuscaCrm] = useState('');
  const [filtroRfv, setFiltroRfv] = useState('todos');
  const [filtroBairro, setFiltroBairro] = useState('todos');
  const [clienteModalWhats, setClienteModalWhats] = useState(null);
  const [mensagemWhatsEditada, setMensagemWhatsEditada] = useState('');

  // Carregar dados da suíte da Palatare
  const carregarDados = async () => {
    try {
      setCarregando(true);
      setErro(null);
      const res = await api.get('/api/admin/palatare/dados');
      setDadosSuite(res);
    } catch (err) {
      console.warn('Erro ao carregar dados da Palatare:', err);
      setErro(err.message || 'Falha ao carregar dados da pizzaria');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Sincronizar tab na URL
  const handleSelectTab = (id) => {
    setTabAtiva(id);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', id);
    window.history.replaceState({}, '', url.toString());
  };

  // Cardápio de pizzas disponíveis para o montador
  const catalogoPizzas = useMemo(() => {
    if (!dadosSuite) return [];
    const lista = (dadosSuite.montador?.saboresDisponiveis || []);
    if (lista.length > 0) return lista;
    // Fallback inteligente com as pizzas consagradas da Palatare
    return [
      { id: 'pz-1', nome: 'Pizza Filé Mignon ao Gorgonzola', categoria: 'Pizzas Especiais', preco: 92.00, desc: 'Tiras de filé mignon grelhado, muçarela, molho pelati e gorgonzola dolce' },
      { id: 'pz-2', nome: 'Pizza de Picanha Especial', categoria: 'Pizzas Especiais', preco: 89.00, desc: 'Lâminas de picanha grelhada ao ponto, alho tostado e muçarela artesanal' },
      { id: 'pz-3', nome: 'Pizza Carne Seca com Catupiry', categoria: 'Pizzas Especiais', preco: 78.00, desc: 'Carne seca desfiada na manteiga de garrafa e Catupiry Original' },
      { id: 'pz-4', nome: 'Pizza Palatare da Casa (Parma & Figos)', categoria: 'Pizzas Especiais', preco: 89.00, desc: 'Presunto de Parma, figos caramelizados no balsâmico e rúcula fresca' },
      { id: 'pz-5', nome: 'Pizza Camarão ao Catupiry Trufado', categoria: 'Pizzas Especiais', preco: 98.00, desc: 'Camarões rosa salteados, Catupiry legítimo e azeite trufado' },
      { id: 'pz-6', nome: 'Pizza Shimeji no Alho Poró', categoria: 'Pizzas Especiais', preco: 82.00, desc: 'Mix de shimeji na manteiga e shoyu, alho-poró e muçarela' },
      { id: 'pz-7', nome: 'Pizza Pepperoni Importado & Mel Picante', categoria: 'Pizzas Especiais', preco: 79.00, desc: 'Pepperoni crocante e fios de mel especial com pimenta dedo-de-moça' },
      { id: 'pz-8', nome: 'Pizza Calabresa Artesanal Especial', categoria: 'Pizzas Tradicionais', preco: 68.00, desc: 'Calabresa defumada artesanal, cebola roxa e orégano' },
      { id: 'pz-9', nome: 'Pizza Margherita Di Bufala & Manjericão', categoria: 'Pizzas Tradicionais', preco: 72.00, desc: 'Muçarela de búfala fresca, tomates caqui e manjericão fresco' },
      { id: 'pz-10', nome: 'Pizza Quatro Queijos Nobres', categoria: 'Pizzas Tradicionais', preco: 76.00, desc: 'Muçarela, provolone, gorgonzola e catupiry original' },
      { id: 'pz-11', nome: 'Pizza Frango com Catupiry Original', categoria: 'Pizzas Tradicionais', preco: 70.00, desc: 'Peito de frango desfiado temperado com ervas e Catupiry' },
      { id: 'pz-12', nome: 'Pizza Portuguesa Tradicional', categoria: 'Pizzas Tradicionais', preco: 74.00, desc: 'Presunto cozido, ovos, ervilhas, azeitonas chilenas e cebola' },
      { id: 'pz-13', nome: 'Pizza Doce Nutella com Morangos Frescos', categoria: 'Pizzas Doces', preco: 62.00, desc: 'Nutella original, morangos frescos e raspas de chocolate belga' },
      { id: 'pz-14', nome: 'Pizza Doce Banana Nevada com Canela e Mel', categoria: 'Pizzas Doces', preco: 54.00, desc: 'Bananas caramelizadas, queijo suave, canela e gotas de chocolate branco' }
    ];
  }, [dadosSuite]);

  // Lista de tamanhos configurados
  const tamanhosConfig = useMemo(() => {
    return dadosSuite?.montador?.tamanhos || [
      { id: 'brotinho', nome: 'Brotinho Individual', fatias: 4, diametro: '25cm', maxSabores: 2, precoBase: 44.00, desc: 'Serve 1 pessoa com fartura (4 fatias)' },
      { id: 'media', nome: 'Média Tradicional', fatias: 6, diametro: '30cm', maxSabores: 2, precoBase: 62.00, desc: 'Serve 2 pessoas (6 fatias)' },
      { id: 'grande', nome: 'Grande da Casa', fatias: 8, diametro: '35cm', maxSabores: 3, precoBase: 76.00, desc: 'A campeã de vendas! Serve 3 a 4 pessoas (8 fatias)' },
      { id: 'familia', nome: 'Família / Gigante Gourmet', fatias: 12, diametro: '40cm', maxSabores: 4, precoBase: 98.00, desc: 'Tamanho festa! Serve 5 a 6 pessoas (12 fatias)' }
    ];
  }, [dadosSuite]);

  const tamanhoAtualObj = tamanhosConfig.find(t => t.id === tamanhoSel) || tamanhosConfig[2];

  // Quantidade de sabores ativa conforme fração
  const qtdSaboresAtivos = useMemo(() => {
    if (fracaoSel === '1_sabor') return 1;
    if (fracaoSel === '2_sabores') return 2;
    if (fracaoSel === '3_sabores') return 3;
    if (fracaoSel === '4_sabores') return 4;
    return 2;
  }, [fracaoSel]);

  // Massas e Bordas
  const tiposMassa = useMemo(() => {
    return dadosSuite?.montador?.tiposMassa || [
      { id: 'crocante', nome: 'Tradicional Italiana Crocante', adicional: 0, desc: 'Farinha 00 italiana assada na pedra' },
      { id: 'napolitana_48h', nome: 'Napolitana Fermentação Natural 48h (Levain)', adicional: 6.00, desc: 'Lenta fermentação de 48h, leve e aerada' },
      { id: 'pan_alta', nome: 'Massa Pan Alta Fofa', adicional: 8.00, desc: 'Estilo americano: grossa, dourada e macia' },
      { id: 'integral_graos', nome: '100% Integral com Grãos Nobres', adicional: 10.00, desc: 'Farinha integral orgânica com sementes' },
      { id: 'sem_gluten', nome: 'Massa Artesanal Sem Glúten', adicional: 16.00, desc: 'Farinha de arroz e amido em bancada dedicada' }
    ];
  }, [dadosSuite]);

  const bordasRecheadas = useMemo(() => {
    return dadosSuite?.montador?.bordasRecheadas || [
      { id: 'sem_borda', nome: 'Borda Tradicional da Massa (Sem recheio)', preco: 0 },
      { id: 'catupiry', nome: 'Legítimo Catupiry Original Cremoso', preco: 14.00 },
      { id: 'cheddar', nome: 'Cheddar Cremoso Especial Forneado', preco: 14.00 },
      { id: 'philadelphia', nome: 'Cream Cheese Philadelphia Genuíno', preco: 16.00 },
      { id: 'fondue_vulcao', nome: 'Borda Vulcão com Fondue de Queijos Nobres', preco: 22.00 },
      { id: 'chocolate_leite', nome: 'Chocolate ao Leite Suíço Forneado', preco: 16.00 },
      { id: 'doce_leite', nome: 'Doce de Leite Viçosa Puro Artesanal', preco: 15.00 }
    ];
  }, [dadosSuite]);

  const adicionaisConfig = useMemo(() => {
    return dadosSuite?.montador?.adicionaisOpcionais || [
      { id: 'adc-bacon', nome: 'Bacon crocante em cubos', preco: 8.00 },
      { id: 'adc-alho', nome: 'Alho frito dourado na manteiga', preco: 5.00 },
      { id: 'adc-palmito', nome: 'Palmito pupunha em rodelas', preco: 9.00 },
      { id: 'adc-shimeji', nome: 'Cogumelos Shimeji na manteiga', preco: 12.00 },
      { id: 'adc-tomate-confit', nome: 'Tomate cereja confit com manjericão', preco: 6.00 },
      { id: 'adc-azeite-trufado', nome: 'Azeite trufado finalizado no prato', preco: 12.00 },
      { id: 'adc-cebola-caramelizada', nome: 'Cebola caramelizada no balsâmico', preco: 6.00 },
      { id: 'adc-dobro-queijo', nome: 'Dobro de Queijo Muçarela Especial', preco: 10.00 }
    ];
  }, [dadosSuite]);

  // Cálculo Dinâmico de Preço do Montador (Regra da Maior Fração)
  const precoCalculado = useMemo(() => {
    // 1. Sabores selecionados
    const precosSabores = [];
    for (let i = 0; i < qtdSaboresAtivos; i++) {
      const nomeSabor = saboresEscolhidos[i];
      const p = catalogoPizzas.find(x => x.nome === nomeSabor || nomeSabor.includes(x.nome));
      if (p) precosSabores.push(p.preco);
    }
    const maiorSaborPreco = precosSabores.length > 0 ? Math.max(...precosSabores) : (tamanhoAtualObj?.precoBase || 76);

    // 2. Fator de tamanho (tamanho grande é base 1.0, brotinho 0.6, media 0.8, família 1.25)
    let fatorTamanho = 1.0;
    if (tamanhoSel === 'brotinho') fatorTamanho = 0.60;
    else if (tamanhoSel === 'media') fatorTamanho = 0.82;
    else if (tamanhoSel === 'grande') fatorTamanho = 1.00;
    else if (tamanhoSel === 'familia') fatorTamanho = 1.28;

    const precoBasePizza = maiorSaborPreco * fatorTamanho;

    // 3. Adicional de massa
    const massaObj = tiposMassa.find(m => m.id === massaSel);
    const precoMassa = massaObj?.adicional || 0;

    // 4. Adicional de borda
    const bordaObj = bordasRecheadas.find(b => b.id === bordaSel);
    const precoBorda = bordaObj?.preco || 0;

    // 5. Adicionais extras
    const precoAdicionais = adicionaisSel.reduce((total, adcId) => {
      const adc = adicionaisConfig.find(a => a.id === adcId);
      return total + (adc?.preco || 0);
    }, 0);

    return precoBasePizza + precoMassa + precoBorda + precoAdicionais;
  }, [qtdSaboresAtivos, saboresEscolhidos, catalogoPizzas, tamanhoAtualObj, tamanhoSel, massaSel, tiposMassa, bordaSel, bordasRecheadas, adicionaisSel, adicionaisConfig]);

  // Ação de Lançar Pedido do Montador
  const handleLancarPedido = async () => {
    const saboresEfetivos = [];
    for (let i = 0; i < qtdSaboresAtivos; i++) {
      saboresEfetivos.push({
        fracao: fracaoSel === '1_sabor' ? '1/1' : fracaoSel === '2_sabores' ? '1/2' : fracaoSel === '3_sabores' ? '1/3' : '1/4',
        nome: saboresEscolhidos[i] || 'Pizza Margherita Tradicional',
        obs: exclusoesSel.join(', ')
      });
    }

    const massaNome = tiposMassa.find(m => m.id === massaSel)?.nome;
    const bordaNome = bordasRecheadas.find(b => b.id === bordaSel)?.nome;

    const payload = {
      origem: tipoDestino === 'mesa' ? `Mesa ${numeroMesa} · Salão` : tipoDestino === 'delivery' ? 'Delivery Tangará' : 'Balcão / Retirada',
      tipo: tipoDestino,
      cliente: nomeClientePedido || (tipoDestino === 'mesa' ? `Mesa ${numeroMesa}` : 'Cliente Avulso'),
      total: precoCalculado,
      tempoEstimado: 8,
      itens: [
        {
          tipo: 'pizza_customizada',
          tamanho: tamanhoAtualObj.nome,
          massa: massaNome,
          borda: bordaNome,
          sabores: saboresEfetivos,
          adicionais: adicionaisSel.map(id => adicionaisConfig.find(a => a.id === id)?.nome).filter(Boolean),
          observacaoGeral: observacaoLivre
        }
      ]
    };

    try {
      const res = await api.post('/api/admin/palatare/pedidos', payload);
      setPedidoSucesso(res.pedido || payload);
      // Atualizar lista de KDS localmente
      if (dadosSuite) {
        setDadosSuite({
          ...dadosSuite,
          kds: [res.pedido || payload, ...(dadosSuite.kds || [])]
        });
      }
      setTimeout(() => setPedidoSucesso(null), 6000);
    } catch (err) {
      alert('Erro ao enviar pedido para o KDS: ' + err.message);
    }
  };

  // Clientes filtrados para a aba de CRM 360°
  const clientesFiltrados = useMemo(() => {
    const lista = dadosSuite?.clientes || [];
    return lista.filter(cli => {
      const matchBusca = !buscaCrm || 
        cli.nome?.toLowerCase().includes(buscaCrm.toLowerCase()) ||
        cli.telefone?.includes(buscaCrm) ||
        cli.bairro?.toLowerCase().includes(buscaCrm.toLowerCase()) ||
        cli.saboresFavoritos?.some(s => s.toLowerCase().includes(buscaCrm.toLowerCase()));
      
      const matchRfv = filtroRfv === 'todos' || cli.segmentoRFV === filtroRfv || (filtroRfv === 'Aniversariante' && cli.aniversarianteMes);
      const matchBairro = filtroBairro === 'todos' || cli.bairro === filtroBairro;

      return matchBusca && matchRfv && matchBairro;
    });
  }, [dadosSuite, buscaCrm, filtroRfv, filtroBairro]);

  // Bairros únicos para filtro
  const bairrosUnicos = useMemo(() => {
    const lista = dadosSuite?.clientes || [];
    return Array.from(new Set(lista.map(c => c.bairro).filter(Boolean)));
  }, [dadosSuite]);

  // Abertura do Modal de WhatsApp do CRM
  const abrirModalWhats = (cliente) => {
    setClienteModalWhats(cliente);
    setMensagemWhatsEditada(cliente.sugestaoAcao || `Olá ${cliente.nome}! Passando para desejar uma excelente noite e convidar você para provar nossa nova fornada de ${cliente.saboresFavoritos?.[0] || 'Pizza'} na Palatare!`);
  };

  // Disparo oficial do link do WhatsApp
  const enviarWhats = () => {
    if (!clienteModalWhats) return;
    const foneLimpo = clienteModalWhats.whatsapp?.replace(/\D/g, '') || clienteModalWhats.telefone?.replace(/\D/g, '');
    const numOficial = foneLimpo.startsWith('55') ? foneLimpo : `55${foneLimpo}`;
    const url = `https://wa.me/${numOficial}?text=${encodeURIComponent(mensagemWhatsEditada)}`;
    window.open(url, '_blank');
    setClienteModalWhats(null);
  };

  // Avançar status no KDS
  const handleAvancarKds = async (pedidoId, statusAtual) => {
    let proximoStatus = 'no_forno';
    let proximaPraca = 'Forno a Lenha (400°C)';
    if (statusAtual === 'na_bancada') {
      proximoStatus = 'no_forno';
      proximaPraca = 'Forno a Lenha';
    } else if (statusAtual === 'no_forno') {
      proximoStatus = 'finalizacao';
      proximaPraca = 'Expedição & Finalização';
    } else if (statusAtual === 'finalizacao') {
      proximoStatus = 'entregue';
      proximaPraca = 'Entregue / Garçom';
    }

    try {
      await api.patch(`/api/admin/palatare/kds/${pedidoId}/status`, { status: proximoStatus, praca: proximaPraca });
      // Atualiza local
      if (dadosSuite?.kds) {
        setDadosSuite({
          ...dadosSuite,
          kds: dadosSuite.kds.map(p => p.id === pedidoId ? { ...p, status: proximoStatus, praca: proximaPraca } : p)
        });
      }
    } catch (e) {
      alert('Erro ao atualizar KDS: ' + e.message);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep, #140D09)', color: '#F7EDE2', padding: '24px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* CABEÇALHO DA PALATARE COM IDENTIDADE VISUAL DE ALTO PADRÃO */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(38, 20, 14, 0.95) 0%, rgba(20, 13, 9, 0.98) 100%)',
        border: '1px solid rgba(255, 107, 44, 0.3)',
        borderRadius: 16,
        padding: '24px 28px',
        marginBottom: 24,
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          
          {/* Logo e Nome da Empresa */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: '#0F0906',
              border: '2px solid #FF6B2C',
              padding: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 18px rgba(255, 107, 44, 0.35)'
            }}>
              <img src="/palatare-logo.png" alt="Palatare Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', color: '#FFF' }}>
                  Palatare Pizzaria & Restaurante
                </h1>
                <span style={{ background: '#FF6B2C', color: '#FFF', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Forno a Lenha & Rodízio
                </span>
                <span style={{ background: 'rgba(212, 175, 55, 0.2)', border: '1px solid #D4AF37', color: '#D4AF37', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>
                  4.7 ★ Top #2 Tangará
                </span>
              </div>
              
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#C8B6A6', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={14} color="#FF6B2C" /> Rua 14, 307 W · Centro, Tangará da Serra/MT
                </span>
                <span>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Phone size={14} color="#FF6B2C" /> (65) 99999-0090
                </span>
                <span>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Calendar size={14} color="#FF6B2C" /> Terça a Domingo 18h às 23h
                </span>
              </p>
            </div>
          </div>

          {/* Sinergia de Grupo Econômico: Serrano Concreto Usinado & Holding */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 12,
            padding: '12px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minWidth: 260
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#D4AF37', textTransform: 'uppercase' }}>
                <Building2 size={14} /> Grupo Serrano & Palatare
              </div>
              <span style={{ fontSize: 10, background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', padding: '2px 6px', borderRadius: 10, fontWeight: 800 }}>
                Mesmo Grupo
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => navigate('/admin/concreto')}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #1E293B, #0F172A)',
                  color: '#93C5FD',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  padding: '7px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Truck size={14} /> Serrano Concreto
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin/consolidacao-grupo')}
                style={{
                  background: 'rgba(255, 107, 44, 0.15)',
                  color: '#FF6B2C',
                  border: '1px solid rgba(255, 107, 44, 0.3)',
                  padding: '7px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                Holding
              </button>
            </div>
          </div>

        </div>

        {/* BARRA DE NAVEGAÇÃO DAS ABAS DA SUÍTE */}
        <div style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingTop: 18,
          marginTop: 18,
          borderTop: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const ativa = tabAtiva === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTab(tab.id)}
                style={{
                  background: ativa ? '#FF6B2C' : 'rgba(255, 255, 255, 0.05)',
                  color: ativa ? '#FFF' : '#C8B6A6',
                  border: ativa ? '1px solid #FF6B2C' : '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '9px 16px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  boxShadow: ativa ? '0 4px 14px rgba(255, 107, 44, 0.4)' : 'none'
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 8,
                    background: ativa ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 107, 44, 0.2)',
                    color: ativa ? '#FFF' : '#FF6B2C'
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* FEEDBACK DE SUCESSO DE PEDIDO */}
      {pedidoSucesso && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%)',
          border: '1px solid #10B981',
          color: '#A7F3D0',
          padding: '14px 20px',
          borderRadius: 12,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={22} color="#10B981" />
            <div>
              <strong style={{ color: '#FFF' }}>Pedido {pedidoSucesso.comanda || 'enviado'} lançado com sucesso no Forno a Lenha!</strong>
              <div style={{ fontSize: 12, marginTop: 2 }}>Destino: {pedidoSucesso.origem} · Total: R$ {Number(pedidoSucesso.total || 0).toFixed(2)} · Fila do KDS atualizada.</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleSelectTab('kds')}
            style={{ background: '#10B981', color: '#064E3B', border: 'none', padding: '6px 14px', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
          >
            Ver no KDS →
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ABA 1: MONTADOR DE PIZZAS PROFISSIONAL (SURPASSING CONCORRÊNCIA) */}
      {/* ------------------------------------------------------------- */}
      {tabAtiva === 'montador' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 360px', gap: 24, alignItems: 'start' }}>
          
          {/* Lado Esquerdo: Customizador de Etapas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* ETAPA 1: TAMANHO DA PIZZA */}
            <div style={{ background: '#1C130D', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: '#FF6B2C', textTransform: 'uppercase' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 11, background: '#FF6B2C', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>1</span>
                  Escolha o Tamanho da Pizza
                </div>
                <span style={{ fontSize: 12, color: '#A8998C' }}>Diâmetro e Fatias</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {tamanhosConfig.map(tam => {
                  const sel = tamanhoSel === tam.id;
                  return (
                    <div
                      key={tam.id}
                      onClick={() => setTamanhoSel(tam.id)}
                      style={{
                        background: sel ? 'rgba(255, 107, 44, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        border: sel ? '2px solid #FF6B2C' : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 12,
                        padding: 14,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: sel ? '#FF6B2C' : '#FFF', fontSize: 14 }}>{tam.nome}</strong>
                        <span style={{ fontSize: 11, background: 'rgba(255, 255, 255, 0.1)', padding: '2px 6px', borderRadius: 6 }}>{tam.diametro}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#C8B6A6', marginTop: 4 }}>{tam.fatias} fatias · Até {tam.maxSabores} sabores</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#FFF', marginTop: 8 }}>Base R$ {tam.precoBase.toFixed(2)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ETAPA 2: DIVISÃO DE SABORES (FRAÇÕES) */}
            <div style={{ background: '#1C130D', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: '#FF6B2C', textTransform: 'uppercase' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 11, background: '#FF6B2C', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>2</span>
                  Divisão de Sabores (Frações)
                </div>
                <span style={{ fontSize: 12, color: '#10B981', fontWeight: 700 }}>Cobrança pela Maior Fração</span>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                {[
                  { id: '1_sabor', label: '1 Sabor (Inteira 100%)', desc: '1 sabor exclusivo' },
                  { id: '2_sabores', label: '2 Sabores (Meio a Meio 50/50)', desc: 'Metade / Metade' },
                  { id: '3_sabores', label: '3 Sabores (1/3 cada)', desc: '1/3 para cada', disabled: tamanhoSel === 'brotinho' },
                  { id: '4_sabores', label: '4 Sabores (1/4 cada)', desc: '1/4 para cada', disabled: tamanhoSel === 'brotinho' || tamanhoSel === 'media' },
                ].map(frac => {
                  const sel = fracaoSel === frac.id;
                  return (
                    <button
                      key={frac.id}
                      type="button"
                      disabled={frac.disabled}
                      onClick={() => setFracaoSel(frac.id)}
                      style={{
                        flex: 1,
                        minWidth: 160,
                        background: sel ? '#FF6B2C' : 'rgba(255, 255, 255, 0.03)',
                        color: sel ? '#FFF' : frac.disabled ? '#554A40' : '#E8DDD4',
                        border: sel ? '1px solid #FF6B2C' : '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '10px 14px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: frac.disabled ? 'not-allowed' : 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div>{frac.label}</div>
                      <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{frac.desc}</div>
                    </button>
                  );
                })}
              </div>

              {/* Seleção dos Sabores Específicos para cada fração */}
              <div style={{ display: 'grid', gap: 12 }}>
                {Array.from({ length: qtdSaboresAtivos }).map((_, idx) => {
                  const fractionLabel = fracaoSel === '1_sabor' ? 'Pizza Inteira (100%)' : fracaoSel === '2_sabores' ? `Fração ${idx + 1} de 2 (50%)` : fracaoSel === '3_sabores' ? `Fração ${idx + 1} de 3 (33%)` : `Fração ${idx + 1} de 4 (25%)`;
                  return (
                    <div key={idx} style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 10, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#FF6B2C', textTransform: 'uppercase' }}>
                          🍕 {fractionLabel}
                        </span>
                        {saboresEscolhidos[idx] && (
                          <span style={{ fontSize: 11, color: '#10B981', fontWeight: 700 }}>
                            R$ {(catalogoPizzas.find(x => x.nome === saboresEscolhidos[idx] || saboresEscolhidos[idx].includes(x.nome))?.preco || 0).toFixed(2)}
                          </span>
                        )}
                      </div>

                      <select
                        value={saboresEscolhidos[idx] || ''}
                        onChange={(e) => {
                          const novos = [...saboresEscolhidos];
                          novos[idx] = e.target.value;
                          setSaboresEscolhidos(novos);
                        }}
                        style={{
                          width: '100%',
                          background: '#140D09',
                          color: '#FFF',
                          border: '1px solid rgba(255, 107, 44, 0.3)',
                          borderRadius: 8,
                          padding: '10px 12px',
                          fontSize: 13,
                          fontWeight: 600
                        }}
                      >
                        <option value="">Selecione o sabor desta fração...</option>
                        {catalogoPizzas.map(p => (
                          <option key={p.id} value={p.nome}>
                            {p.nome} — R$ {p.preco.toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ETAPA 3: MASSA ARTESANAL & BORDA RECHEADA */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Massa */}
              <div style={{ background: '#1C130D', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#FF6B2C', textTransform: 'uppercase', marginBottom: 12 }}>
                  🌾 Tipo de Massa Artesanal
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {tiposMassa.map(m => (
                    <label
                      key={m.id}
                      onClick={() => setMassaSel(m.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: massaSel === m.id ? 'rgba(255, 107, 44, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                        border: massaSel === m.id ? '1px solid #FF6B2C' : '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 12
                      }}
                    >
                      <div>
                        <strong style={{ color: massaSel === m.id ? '#FF6B2C' : '#FFF' }}>{m.nome}</strong>
                        <div style={{ fontSize: 10, color: '#A8998C' }}>{m.desc}</div>
                      </div>
                      <span style={{ fontWeight: 800, color: m.adicional > 0 ? '#10B981' : '#A8998C' }}>
                        {m.adicional > 0 ? `+ R$ ${m.adicional.toFixed(2)}` : 'Inclusa'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Borda Recheada */}
              <div style={{ background: '#1C130D', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#FF6B2C', textTransform: 'uppercase', marginBottom: 12 }}>
                  🧀 Borda Recheada Especial
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {bordasRecheadas.map(b => (
                    <label
                      key={b.id}
                      onClick={() => setBordaSel(b.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: bordaSel === b.id ? 'rgba(255, 107, 44, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                        border: bordaSel === b.id ? '1px solid #FF6B2C' : '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 12
                      }}
                    >
                      <strong style={{ color: bordaSel === b.id ? '#FF6B2C' : '#FFF' }}>{b.nome}</strong>
                      <span style={{ fontWeight: 800, color: b.preco > 0 ? '#10B981' : '#A8998C' }}>
                        {b.preco > 0 ? `+ R$ ${b.preco.toFixed(2)}` : 'Sem borda'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* ETAPA 4: ADICIONAIS & EXCLUSÕES/OBSERVAÇÕES */}
            <div style={{ background: '#1C130D', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#FF6B2C', textTransform: 'uppercase', marginBottom: 12 }}>
                ✨ Ingredientes Adicionais & Observações de Cozinha
              </div>

              {/* Adicionais Pills */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {adicionaisConfig.map(adc => {
                  const sel = adicionaisSel.includes(adc.id);
                  return (
                    <button
                      key={adc.id}
                      type="button"
                      onClick={() => {
                        if (sel) setAdicionaisSel(adicionaisSel.filter(x => x !== adc.id));
                        else setAdicionaisSel([...adicionaisSel, adc.id]);
                      }}
                      style={{
                        background: sel ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                        color: sel ? '#10B981' : '#C8B6A6',
                        border: sel ? '1px solid #10B981' : '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '6px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {sel ? '✓ ' : '+ '}{adc.nome} (+R$ {adc.preco.toFixed(2)})
                    </button>
                  );
                })}
              </div>

              {/* Exclusões comuns */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {['Sem cebola', 'Sem orégano', 'Sem azeitonas', 'Sem pimenta', 'Pouco molho', 'Massa bem tostada'].map(exc => {
                  const sel = exclusoesSel.includes(exc);
                  return (
                    <button
                      key={exc}
                      type="button"
                      onClick={() => {
                        if (sel) setExclusoesSel(exclusoesSel.filter(x => x !== exc));
                        else setExclusoesSel([...exclusoesSel, exc]);
                      }}
                      style={{
                        background: sel ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                        color: sel ? '#EF4444' : '#887B70',
                        border: sel ? '1px solid #EF4444' : '1px solid rgba(255, 255, 255, 0.05)',
                        padding: '5px 10px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {sel ? '✕ ' : ''}{exc}
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                placeholder="Observação livre para o pizzaiolo (ex: caprichar no azeite na mesa 04)..."
                value={observacaoLivre}
                onChange={(e) => setObservacaoLivre(e.target.value)}
                style={{
                  width: '100%',
                  background: '#140D09',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: '#FFF',
                  fontSize: 12
                }}
              />
            </div>

          </div>

          {/* Lado Direito: Preview Visual da Pizza & Comanda do Pedido */}
          <div style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* CARD DE VISUALIZAÇÃO GRÁFICA DA PIZZA MONTADA */}
            <div style={{
              background: 'linear-gradient(135deg, #1C130D 0%, #26160F 100%)',
              border: '2px solid rgba(255, 107, 44, 0.4)',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
              textAlign: 'center'
            }}>
              
              <div style={{ fontSize: 12, fontWeight: 800, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                Visualizador Gráfico de Fornada
              </div>

              {/* RENDERIZADOR CIRCULAR DA PIZZA */}
              <div style={{
                width: 190,
                height: 190,
                borderRadius: '50%',
                margin: '0 auto 16px',
                background: '#D97706',
                border: bordaSel !== 'sem_borda' ? '10px solid #B45309' : '4px solid #92400E',
                boxShadow: '0 0 25px rgba(255, 107, 44, 0.4)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {/* Linhas de divisão de fração */}
                {qtdSaboresAtivos === 2 && (
                  <div style={{ position: 'absolute', width: 2, height: '100%', background: 'rgba(0,0,0,0.5)' }} />
                )}
                {qtdSaboresAtivos === 3 && (
                  <>
                    <div style={{ position: 'absolute', width: 2, height: '50%', background: 'rgba(0,0,0,0.5)', top: 0 }} />
                    <div style={{ position: 'absolute', width: '50%', height: 2, background: 'rgba(0,0,0,0.5)', bottom: '25%', left: 0 }} />
                    <div style={{ position: 'absolute', width: '50%', height: 2, background: 'rgba(0,0,0,0.5)', bottom: '25%', right: 0 }} />
                  </>
                )}
                {qtdSaboresAtivos === 4 && (
                  <>
                    <div style={{ position: 'absolute', width: 2, height: '100%', background: 'rgba(0,0,0,0.5)' }} />
                    <div style={{ position: 'absolute', width: '100%', height: 2, background: 'rgba(0,0,0,0.5)' }} />
                  </>
                )}

                <div style={{
                  background: 'rgba(20, 13, 9, 0.85)',
                  padding: '6px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#FFF',
                  zIndex: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
                }}>
                  {tamanhoAtualObj.fatias} Fatias · {tamanhoAtualObj.diametro}
                </div>
              </div>

              {/* Resumo do Pedido */}
              <div style={{ textAlign: 'left', background: 'rgba(0, 0, 0, 0.3)', padding: 14, borderRadius: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#FFF', marginBottom: 6 }}>
                  {tamanhoAtualObj.nome} ({qtdSaboresAtivos} {qtdSaboresAtivos === 1 ? 'Sabor' : 'Sabores'})
                </div>

                <div style={{ fontSize: 12, color: '#C8B6A6', lineHeight: 1.5 }}>
                  {Array.from({ length: qtdSaboresAtivos }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#FF6B2C' }}>•</span>
                      <strong>{fracaoSel === '1_sabor' ? '100%' : fracaoSel === '2_sabores' ? '1/2' : fracaoSel === '3_sabores' ? '1/3' : '1/4'}:</strong>
                      <span>{saboresEscolhidos[i] ? saboresEscolhidos[i].split(' (')[0] : 'Sabor pendente'}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 4, color: '#93C5FD' }}>
                    🌾 Massa: {tiposMassa.find(m => m.id === massaSel)?.nome}
                  </div>
                  {bordaSel !== 'sem_borda' && (
                    <div style={{ color: '#FCD34D' }}>
                      🧀 Borda: {bordasRecheadas.find(b => b.id === bordaSel)?.nome}
                    </div>
                  )}
                  {adicionaisSel.length > 0 && (
                    <div style={{ color: '#A7F3D0' }}>
                      ➕ Adicionais: {adicionaisSel.map(id => adicionaisConfig.find(a => a.id === id)?.nome).join(', ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Totalizador */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#A8998C' }}>Valor Total do Pedido:</span>
                <span style={{ fontSize: 26, fontWeight: 900, color: '#10B981' }}>
                  R$ {precoCalculado.toFixed(2)}
                </span>
              </div>

              {/* Destino do Pedido */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {[
                  { id: 'mesa', label: 'Mesa Salão' },
                  { id: 'delivery', label: 'Delivery' },
                  { id: 'balcao', label: 'Balcão' }
                ].map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setTipoDestino(d.id)}
                    style={{
                      flex: 1,
                      background: tipoDestino === d.id ? '#FF6B2C' : 'rgba(255,255,255,0.05)',
                      color: '#FFF',
                      border: 'none',
                      padding: '7px 4px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {tipoDestino === 'mesa' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 12, color: '#C8B6A6' }}>Número da Mesa:</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={numeroMesa}
                    onChange={(e) => setNumeroMesa(e.target.value)}
                    style={{ width: 60, padding: '6px 8px', borderRadius: 6, background: '#140D09', border: '1px solid #FF6B2C', color: '#FFF', textAlign: 'center', fontWeight: 800 }}
                  />
                </div>
              )}

              {/* Botão de Lançar Pedido */}
              <button
                type="button"
                onClick={handleLancarPedido}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #FF6B2C 0%, #EA580C 100%)',
                  color: '#FFF',
                  border: 'none',
                  padding: '14px 20px',
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 6px 20px rgba(255, 107, 44, 0.45)'
                }}
              >
                <Flame size={18} />
                Lançar Fornada no KDS
              </button>

            </div>

          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ABA 2: RODÍZIO INTELIGENTE & EXPERIÊNCIAS (TER, QUA, SEX) */}
      {/* ------------------------------------------------------------- */}
      {tabAtiva === 'rodizio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Banner do Rodízio */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.15) 0%, rgba(212, 175, 55, 0.15) 100%)',
            border: '1px solid rgba(234, 88, 12, 0.3)',
            borderRadius: 14,
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Utensils size={24} color="#FF6B2C" />
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#FFF' }}>
                  Rodízio Tradicional de Pizzas da Palatare
                </h2>
                <span style={{ background: '#10B981', color: '#064E3B', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 20 }}>
                  ● EM OPERAÇÃO HOJE
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#C8B6A6' }}>
                Dias Oficiais: Terças, Quartas e Sextas-feiras · Mais de 30 sabores doces e salgados assados no forno a lenha servidos à vontade na mesa.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#A8998C', fontWeight: 700, textTransform: 'uppercase' }}>Adulto por Pessoa</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#10B981' }}>R$ 59,90</div>
              </div>
              <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#A8998C', fontWeight: 700, textTransform: 'uppercase' }}>Crianças (5 a 10 anos)</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#FCD34D' }}>R$ 29,90</div>
              </div>
            </div>
          </div>

          {/* MESAS ATIVAS NO RODÍZIO DE HOJE */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#FFF' }}>
                Mesas Ativas no Salão ({dadosSuite?.rodizio?.mesasEmRodizioHoje?.length || 4} mesas)
              </h3>
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: '#10B981' }} /> 🟢 Servindo Fatias</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: '#F59E0B' }} /> 🟡 Pausa / Conversando</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: '#EF4444' }} /> 🔴 Conta Pedida</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {(dadosSuite?.rodizio?.mesasEmRodizioHoje || []).map((mesa, idx) => {
                const statusColor = mesa.statusMesa === 'servindo' ? '#10B981' : mesa.statusMesa === 'pausa' ? '#F59E0B' : '#EF4444';
                const statusLabel = mesa.statusMesa === 'servindo' ? 'Servindo Ativamente' : mesa.statusMesa === 'pausa' ? 'Pausa / Descanso' : 'Conta Pedida';

                return (
                  <div
                    key={idx}
                    style={{
                      background: '#1C130D',
                      border: `2px solid ${statusColor}`,
                      borderRadius: 14,
                      padding: 18,
                      boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 14
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: '#FFF' }}>
                          Mesa {mesa.mesaNumero}
                        </span>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 12,
                          background: `${statusColor}22`,
                          color: statusColor,
                          border: `1px solid ${statusColor}`
                        }}>
                          {statusLabel}
                        </span>
                      </div>

                      <div style={{ fontSize: 12, color: '#C8B6A6', marginTop: 8, display: 'flex', gap: 12 }}>
                        <span>👥 {mesa.adultos} Adultos</span>
                        {mesa.criancas > 0 && <span>👶 {mesa.criancas} Crianças</span>}
                        <span>🕒 Início: {mesa.horarioInicio}</span>
                      </div>

                      <div style={{
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        marginTop: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: 10, color: '#A8998C', fontWeight: 800, textTransform: 'uppercase' }}>Fatias Servidas</div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: '#FF6B2C' }}>{mesa.fatiasServidas} fatias</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: '#A8998C', fontWeight: 800, textTransform: 'uppercase' }}>Subtotal Mesa</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#10B981' }}>R$ {mesa.subtotalConsumo?.toFixed(2)}</div>
                        </div>
                      </div>

                      {mesa.saboresMaisAclamados?.length > 0 && (
                        <div style={{ marginTop: 10, fontSize: 11, color: '#C8B6A6' }}>
                          <strong style={{ color: '#D4AF37' }}>Mais pedidos: </strong>
                          {mesa.saboresMaisAclamados.join(', ')}
                        </div>
                      )}
                    </div>

                    {/* Ações da Mesa */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await api.patch(`/api/admin/palatare/rodizio/${mesa.mesaNumero}/status`, { adicionarFatias: 4 });
                            carregarDados();
                          } catch (e) {
                            alert(e.message);
                          }
                        }}
                        style={{
                          flex: 1,
                          background: 'rgba(255, 107, 44, 0.2)',
                          color: '#FF6B2C',
                          border: '1px solid rgba(255, 107, 44, 0.4)',
                          padding: '7px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        +4 Fatias
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const prox = mesa.statusMesa === 'servindo' ? 'pausa' : mesa.statusMesa === 'pausa' ? 'conta_pedida' : 'servindo';
                          try {
                            await api.patch(`/api/admin/palatare/rodizio/${mesa.mesaNumero}/status`, { statusMesa: prox });
                            carregarDados();
                          } catch (e) {
                            alert(e.message);
                          }
                        }}
                        style={{
                          flex: 1,
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: '#FFF',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          padding: '7px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Mudar Semáforo
                      </button>

                      <button
                        type="button"
                        onClick={() => alert(`Pré-conta Mesa ${mesa.mesaNumero}:\nSubtotal: R$ ${mesa.subtotalConsumo?.toFixed(2)}\nTaxa de Serviço 10% (opcional): R$ ${(mesa.subtotalConsumo * 0.1).toFixed(2)}\nTotal Final: R$ ${(mesa.subtotalConsumo * 1.1).toFixed(2)}\n\nCupom pronto para impressão 80mm!`)}
                        style={{
                          background: '#10B981',
                          color: '#064E3B',
                          border: 'none',
                          padding: '7px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        Pré-Conta
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ABA 3: KDS FORNO A LENHA & COZINHA AO VIVO */}
      {/* ------------------------------------------------------------- */}
      {tabAtiva === 'kds' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#FFF' }}>
                KDS Forno a Lenha & Expedição da Palatare
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#C8B6A6' }}>
                Controle em tempo real de preparação na bancada, cocção a 400°C no forno a lenha e expedição.
              </p>
            </div>
            <button
              type="button"
              onClick={carregarDados}
              style={{ background: 'rgba(255,255,255,0.08)', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} /> Atualizar Fila
            </button>
          </div>

          {/* 4 PRAÇAS KDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, alignItems: 'start' }}>
            
            {/* Praça 1: Bancada do Pizzaiolo */}
            <div style={{ background: '#18110D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '2px solid #3B82F6', paddingBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#93C5FD', textTransform: 'uppercase' }}>
                  👨‍🍳 1. Bancada (Montagem)
                </span>
                <span style={{ fontSize: 11, background: '#1E3A8A', color: '#BFDBFE', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>
                  {(dadosSuite?.kds || []).filter(p => p.status === 'na_bancada').length}
                </span>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                {(dadosSuite?.kds || []).filter(p => p.status === 'na_bancada').map(pedido => (
                  <div key={pedido.id} style={{ background: '#241812', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#FFF', fontSize: 13 }}>{pedido.comanda}</strong>
                      <span style={{ fontSize: 11, color: '#A8998C' }}>{pedido.horarioRecebido} ({pedido.tempoDecorridoMinutos}m)</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#FF6B2C', fontWeight: 700, marginTop: 4 }}>{pedido.origem} · {pedido.cliente}</div>
                    
                    <div style={{ marginTop: 8, fontSize: 12, color: '#E8DDD4', lineHeight: 1.4 }}>
                      {pedido.itens?.map((it, i) => (
                        <div key={i}>
                          <strong>{it.tamanho || it.nome}</strong>
                          {it.sabores?.map((s, si) => (
                            <div key={si} style={{ fontSize: 11, color: '#C8B6A6', paddingLeft: 8 }}>
                              • {s.nome || s.fracao} {s.obs && <span style={{ color: '#F87171' }}>({s.obs})</span>}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAvancarKds(pedido.id, 'na_bancada')}
                      style={{
                        width: '100%',
                        marginTop: 12,
                        background: '#FF6B2C',
                        color: '#FFF',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                    >
                      <Flame size={14} /> Colocar no Forno (400°C) →
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Praça 2: No Forno a Lenha (400°C) */}
            <div style={{ background: '#18110D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '2px solid #FF6B2C', paddingBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#FF6B2C', textTransform: 'uppercase' }}>
                  🔥 2. Forno a Lenha (400°C)
                </span>
                <span style={{ fontSize: 11, background: '#7C2D12', color: '#FED7AA', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>
                  {(dadosSuite?.kds || []).filter(p => p.status === 'no_forno').length}
                </span>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                {(dadosSuite?.kds || []).filter(p => p.status === 'no_forno').map(pedido => (
                  <div key={pedido.id} style={{ background: '#241812', border: '2px solid #FF6B2C', borderRadius: 10, padding: 14, boxShadow: '0 4px 14px rgba(255, 107, 44, 0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#FFF', fontSize: 13 }}>{pedido.comanda}</strong>
                      <span style={{ fontSize: 12, background: '#FF6B2C', color: '#FFF', padding: '2px 6px', borderRadius: 6, fontWeight: 800 }}>
                        {pedido.temperaturaForno || '410°C'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#D4AF37', fontWeight: 700, marginTop: 4 }}>{pedido.origem} · {pedido.cliente}</div>
                    
                    <div style={{ marginTop: 8, fontSize: 12, color: '#E8DDD4', lineHeight: 1.4 }}>
                      {pedido.itens?.map((it, i) => (
                        <div key={i}>
                          <strong>{it.tamanho || it.nome}</strong>
                          {it.sabores?.map((s, si) => (
                            <div key={si} style={{ fontSize: 11, color: '#C8B6A6', paddingLeft: 8 }}>
                              • {s.nome || s.fracao} {s.obs && <span style={{ color: '#F87171' }}>({s.obs})</span>}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#10B981', fontWeight: 700 }}>
                      <Clock size={14} /> Tempo no forno: {pedido.tempoDecorridoMinutos}m / 8m estimados
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAvancarKds(pedido.id, 'no_forno')}
                      style={{
                        width: '100%',
                        marginTop: 12,
                        background: '#D97706',
                        color: '#FFF',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                    >
                      Retirar do Forno → Cortar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Praça 3: Finalização & Expedição */}
            <div style={{ background: '#18110D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '2px solid #D97706', paddingBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#FCD34D', textTransform: 'uppercase' }}>
                  ✂️ 3. Corte & Finalização
                </span>
                <span style={{ fontSize: 11, background: '#78350F', color: '#FEF3C7', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>
                  {(dadosSuite?.kds || []).filter(p => p.status === 'finalizacao').length}
                </span>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                {(dadosSuite?.kds || []).filter(p => p.status === 'finalizacao').map(pedido => (
                  <div key={pedido.id} style={{ background: '#241812', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#FFF', fontSize: 13 }}>{pedido.comanda}</strong>
                      <span style={{ fontSize: 11, color: '#10B981', fontWeight: 800 }}>PRONTO P/ ENTREGA</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#FF6B2C', fontWeight: 700, marginTop: 4 }}>{pedido.origem} · {pedido.cliente}</div>
                    
                    <button
                      type="button"
                      onClick={() => handleAvancarKds(pedido.id, 'finalizacao')}
                      style={{
                        width: '100%',
                        marginTop: 12,
                        background: '#10B981',
                        color: '#064E3B',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 900,
                        cursor: 'pointer'
                      }}
                    >
                      ✓ Despachar Garçom / Motoboy
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Praça 4: Entregue / Em Rota */}
            <div style={{ background: '#18110D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '2px solid #10B981', paddingBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#A7F3D0', textTransform: 'uppercase' }}>
                  🛵 4. Em Rota / Entregues
                </span>
                <span style={{ fontSize: 11, background: '#065F46', color: '#D1FAE5', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>
                  {(dadosSuite?.kds || []).filter(p => p.status === 'saiu_entrega' || p.status === 'entregue').length}
                </span>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                {(dadosSuite?.kds || []).filter(p => p.status === 'saiu_entrega' || p.status === 'entregue').map(pedido => (
                  <div key={pedido.id} style={{ background: '#241812', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#FFF', fontSize: 13 }}>{pedido.comanda}</strong>
                      <span style={{ fontSize: 10, background: '#10B981', color: '#064E3B', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>
                        {pedido.status === 'saiu_entrega' ? 'EM ROTA' : 'CONCLUÍDO'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#C8B6A6', marginTop: 4 }}>{pedido.origem} · {pedido.cliente}</div>
                    {pedido.praca && <div style={{ fontSize: 11, color: '#93C5FD', marginTop: 4 }}>{pedido.praca}</div>}
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ABA 4: DELIVERY TANGARÁ DA SERRA (ZONAS & MOTOBOYS) */}
      {/* ------------------------------------------------------------- */}
      {tabAtiva === 'delivery' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#FFF' }}>
              Zonas de Entrega & Delivery em Tangará da Serra
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#C8B6A6' }}>
              Gestão de taxas fixas por bairro, tempos médios de entrega e despacho térmico com QR Code Pix.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {(dadosSuite?.delivery || []).map(zona => (
              <div
                key={zona.id}
                style={{
                  background: '#1C130D',
                  border: '1px solid rgba(255, 107, 44, 0.25)',
                  borderRadius: 14,
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={18} color="#FF6B2C" />
                    <strong style={{ fontSize: 15, color: '#FFF' }}>{zona.bairro}</strong>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#10B981' }}>
                    R$ {zona.taxa.toFixed(2)}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: '#C8B6A6', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tempo de trânsito:</span>
                  <strong style={{ color: '#FFF' }}>{zona.tempoEstimadoMinutos}</strong>
                </div>

                <div style={{ fontSize: 12, color: '#C8B6A6', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Entregas realizadas hoje:</span>
                  <strong style={{ color: '#FF6B2C' }}>{zona.entregasHoje} pedidos</strong>
                </div>

                <button
                  type="button"
                  onClick={() => alert(`Zona ${zona.bairro} configurada.\nTaxa: R$ ${zona.taxa.toFixed(2)}\nTempo estimado: ${zona.tempoEstimadoMinutos}\nStatus: Ativo no WhatsApp e Cardápio Digital.`)}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: '#FFF',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Configurar Taxa & Raio
                </button>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ABA 5: CRM GASTRONÔMICO 360° (ENTENDIMENTO PROFUNDO DA BASE) */}
      {/* ------------------------------------------------------------- */}
      {tabAtiva === 'crm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* TOPO: INDICADORES EXECUTIVOS DO CRM */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            {[
              { label: 'Base Ativa Cadastrada', valor: `${dadosSuite?.clientes?.length || 15} clientes`, cor: '#FF6B2C', desc: 'Em Tangará da Serra' },
              { label: 'Clientes VIP / Diamante', valor: `${(dadosSuite?.clientes || []).filter(c => c.segmentoRFV === 'VIP / Diamante').length}`, cor: '#93C5FD', desc: 'Pedem semanalmente' },
              { label: 'Aniversariantes do Mês', valor: `${(dadosSuite?.clientes || []).filter(c => c.aniversarianteMes).length}`, cor: '#FCD34D', desc: 'Prontos para convite' },
              { label: 'Em Risco de Perda', valor: `${(dadosSuite?.clientes || []).filter(c => c.segmentoRFV === 'Em Risco').length}`, cor: '#F87171', desc: '> 25 dias sem pedir' },
              { label: 'Taxa Retenção 30d', valor: '74.8%', cor: '#10B981', desc: 'Benchmark Setor: 48%' }
            ].map((kpi, idx) => (
              <div key={idx} style={{ background: '#1C130D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: '#A8998C', fontWeight: 800, textTransform: 'uppercase' }}>{kpi.label}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: kpi.cor, marginTop: 4 }}>{kpi.valor}</div>
                <div style={{ fontSize: 11, color: '#C8B6A6', marginTop: 2 }}>{kpi.desc}</div>
              </div>
            ))}
          </div>

          {/* FILTROS E BUSCA INTELIGENTE */}
          <div style={{
            background: '#1C130D',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14,
            padding: 16,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
              <Search size={18} color="#FF6B2C" />
              <input
                type="text"
                placeholder="Buscar por nome, telefone, bairro ou sabor favorito (ex: Gorgonzola, Picanha)..."
                value={buscaCrm}
                onChange={(e) => setBuscaCrm(e.target.value)}
                style={{
                  width: '100%',
                  background: '#140D09',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  padding: '9px 12px',
                  color: '#FFF',
                  fontSize: 13
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <select
                value={filtroRfv}
                onChange={(e) => setFiltroRfv(e.target.value)}
                style={{ background: '#140D09', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700 }}
              >
                <option value="todos">Todos os Segmentos RFV</option>
                <option value="VIP / Diamante">💎 VIP / Diamante</option>
                <option value="Fiel / Ouro">🥇 Fiel / Ouro</option>
                <option value="Em Risco">⚠️ Em Risco (Churn)</option>
                <option value="Inativo / Resgate Urgente">💤 Inativo / Resgate</option>
                <option value="Aniversariante">🎂 Aniversariante do Mês</option>
              </select>

              <select
                value={filtroBairro}
                onChange={(e) => setFiltroBairro(e.target.value)}
                style={{ background: '#140D09', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700 }}
              >
                <option value="todos">Todos os Bairros</option>
                {bairrosUnicos.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          {/* GRID DE CARDS 360° DE CLIENTES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
            {clientesFiltrados.map(cli => {
              const rfvBadgeColor = cli.segmentoRFV === 'VIP / Diamante' ? '#3B82F6' : cli.segmentoRFV === 'Fiel / Ouro' ? '#10B981' : cli.segmentoRFV === 'Em Risco' ? '#F59E0B' : cli.aniversarianteMes ? '#D4AF37' : '#EF4444';

              return (
                <div
                  key={cli.id}
                  style={{
                    background: '#1C130D',
                    border: `1px solid ${rfvBadgeColor}44`,
                    borderRadius: 14,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 14,
                    boxShadow: '0 6px 18px rgba(0,0,0,0.35)'
                  }}
                >
                  <div>
                    {/* Cabeçalho do Card */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong style={{ fontSize: 16, color: '#FFF' }}>{cli.nome}</strong>
                          {cli.aniversarianteMes && <span title="Aniversariante do Mês!">🎂</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#C8B6A6', marginTop: 2 }}>{cli.profissao}</div>
                      </div>

                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 12,
                        background: `${rfvBadgeColor}22`,
                        color: rfvBadgeColor,
                        border: `1px solid ${rfvBadgeColor}`
                      }}>
                        {cli.segmentoRFV}
                      </span>
                    </div>

                    {/* Contato & Localização */}
                    <div style={{ fontSize: 12, color: '#A8998C', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span>📍 {cli.bairro} ({cli.endereco?.split(' - ')[0]})</span>
                      <span>📱 {cli.telefone} · Canal: <strong>{cli.canalPreferido?.toUpperCase()}</strong></span>
                    </div>

                    {/* O DNA GASTRONÔMICO (SABORES & PREFERÊNCIAS) */}
                    <div style={{ background: 'rgba(0, 0, 0, 0.3)', borderRadius: 10, padding: 12, marginTop: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#FF6B2C', textTransform: 'uppercase', marginBottom: 6 }}>
                        🍕 Sabores & Paladar Favorito
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {cli.saboresFavoritos?.map((sab, si) => (
                          <span key={si} style={{ fontSize: 11, background: 'rgba(255, 107, 44, 0.15)', color: '#FF6B2C', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                            {sab}
                          </span>
                        ))}
                      </div>

                      <div style={{ fontSize: 11, color: '#C8B6A6', marginTop: 8, lineHeight: 1.4 }}>
                        {cli.bordaFavorita && <div>🧀 Borda: <strong>{cli.bordaFavorita}</strong></div>}
                        {cli.massaFavorita && <div>🌾 Massa: <strong>{cli.massaFavorita}</strong></div>}
                        {cli.restricoes && cli.restricoes !== 'Nenhuma' && (
                          <div style={{ color: '#F87171', marginTop: 2 }}>⚠️ Restrição: <strong>{cli.restricoes}</strong></div>
                        )}
                      </div>
                    </div>

                    {/* Indicadores RFV Numéricos */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 12, textAlign: 'center' }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: 6, borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: '#A8998C', textTransform: 'uppercase' }}>Pedidos</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#FFF' }}>{cli.totalPedidos}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: 6, borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: '#A8998C', textTransform: 'uppercase' }}>LTV Total</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#10B981' }}>R${cli.totalGasto}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: 6, borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: '#A8998C', textTransform: 'uppercase' }}>Ticket Méd.</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#FCD34D' }}>R${cli.ticketMedio?.toFixed(0)}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: 6, borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: '#A8998C', textTransform: 'uppercase' }}>Último Ped.</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: cli.diasSemPedir > 25 ? '#EF4444' : '#FFF' }}>{cli.diasSemPedir}d atrás</div>
                      </div>
                    </div>

                  </div>

                  {/* Botão de Disparo no WhatsApp com 1 Clique */}
                  <button
                    type="button"
                    onClick={() => abrirModalWhats(cli)}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#FFF',
                      border: 'none',
                      padding: '10px 14px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
                    }}
                  >
                    <Send size={15} />
                    WhatsApp Inteligente (1 Clique)
                  </button>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ABA 6: BI & INTELIGÊNCIA DE VENDAS (CURVA ABC) */}
      {/* ------------------------------------------------------------- */}
      {tabAtiva === 'bi' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#FFF' }}>
              Inteligência de Vendas & Curva ABC da Palatare
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#C8B6A6' }}>
              Faturamento consolidado do mês: R$ 148.650,00 (+18.4% vs mês anterior) · Ticket Médio: R$ 104,20
            </p>
          </div>

          {/* Gráfico / Distribuição por Canais */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {(dadosSuite?.metricas?.distribuicaoCanais || []).map((canal, idx) => (
              <div key={idx} style={{ background: '#1C130D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 15, color: '#FFF' }}>{canal.canal}</strong>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#FF6B2C' }}>{canal.percentual}%</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#10B981', marginTop: 10 }}>
                  R$ {canal.faturamento.toFixed(2)}
                </div>
                <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 12, overflow: 'hidden' }}>
                  <div style={{ width: `${canal.percentual}%`, height: '100%', background: '#FF6B2C' }} />
                </div>
              </div>
            ))}
          </div>

          {/* TABELA DA CURVA ABC DE SABORES */}
          <div style={{ background: '#1C130D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#FFF' }}>
              Curva ABC de Sabores Mais Pedidos (Top 8 Sabores)
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#A8998C', fontSize: 11, textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 8px' }}>Rank</th>
                    <th style={{ padding: '10px 8px' }}>Sabor da Pizza</th>
                    <th style={{ padding: '10px 8px' }}>Pizzas Vendidas</th>
                    <th style={{ padding: '10px 8px' }}>Faturamento</th>
                    <th style={{ padding: '10px 8px' }}>Share %</th>
                    <th style={{ padding: '10px 8px' }}>Margem / Rentab.</th>
                  </tr>
                </thead>
                <tbody>
                  {(dadosSuite?.metricas?.curvaAbcSabores || []).map(item => (
                    <tr key={item.rank} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 900, color: item.rank <= 3 ? '#FF6B2C' : '#FFF' }}>
                        #{item.rank}
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 700, color: '#FFF' }}>
                        {item.nome}
                      </td>
                      <td style={{ padding: '12px 8px', color: '#E8DDD4' }}>
                        {item.pedidos} unidades
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 800, color: '#10B981' }}>
                        R$ {item.faturamento.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 8px', color: '#FCD34D', fontWeight: 700 }}>
                        {item.share}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 10, background: item.rentabilidade.includes('Alta') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.2)', color: item.rentabilidade.includes('Alta') ? '#10B981' : '#FCD34D' }}>
                          {item.rentabilidade}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ABA 7: GRUPO SERRANO & PALATARE (HOLDING & SINERGIAS) */}
      {/* ------------------------------------------------------------- */}
      {tabAtiva === 'grupo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div style={{
            background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
            border: '2px solid rgba(59, 130, 246, 0.4)',
            borderRadius: 16,
            padding: 28,
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#60A5FA', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  HOLDING EMPRESARIAL INTEGRADA
                </span>
                <h2 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 900, color: '#FFF' }}>
                  Grupo Palatare
                </h2>
                <p style={{ margin: '8px 0 0', fontSize: 14, color: '#94A3B8', maxWidth: 700, lineHeight: 1.5 }}>
                  Holding controladora fundada por <strong>Alexandre Palatare</strong>, unificando a <strong>Palatare Pizzaria &amp; Restaurante</strong> (Gastronomia &amp; Delivery) e a <strong>Serrano Concreto Usinado &amp; Mineração</strong> (Central Dosadora NBR 7212, Silos 96t e Frota de Betoneiras).
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => navigate('/admin/concreto?secao=empresa-holding')}
                  style={{
                    background: '#C5A059',
                    color: '#16181B',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 16px rgba(197, 160, 89, 0.4)'
                  }}
                >
                  🏢 Holding Grupo Palatare
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/admin/concreto')}
                  style={{
                    background: '#3B82F6',
                    color: '#FFF',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)'
                  }}
                >
                  <Truck size={18} /> Acessar Serrano Concreto ERP
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/admin/consolidacao-grupo')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#FFF',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    padding: '12px 20px',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Relatório Consolidado Holding
                </button>
              </div>
            </div>
          </div>

          {/* Cards das duas empresas do Grupo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Empresa 1: Palatare */}
            <div style={{ background: '#1C130D', border: '1px solid rgba(255, 107, 44, 0.3)', borderRadius: 14, padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <img src="/palatare-logo.png" alt="Palatare" style={{ width: 48, height: 48, objectFit: 'contain', background: '#0F0906', borderRadius: 10, border: '1px solid #FF6B2C', padding: 4 }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#FFF' }}>Palatare Pizzaria & Restaurante</h3>
                  <div style={{ fontSize: 12, color: '#FF6B2C', fontWeight: 700 }}>Gastronomia, Forno a Lenha & Delivery</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#C8B6A6', lineHeight: 1.5 }}>
                Localizada no Centro de Tangará da Serra. Forno a lenha a 400°C, mais de 30 sabores doces e salgados, rodízio tradicional e base de clientes VIP no CRM.
              </p>
              <div style={{ marginTop: 14, fontSize: 12, color: '#A8998C' }}>
                CNPJ: 31.002.650/0001-08 · Tangará da Serra/MT
              </div>
            </div>

            {/* Empresa 2: Serrano Concreto */}
            <div style={{ background: '#0F172A', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 14, padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <img src="/brand/concreto-usina-logo.png" alt="Serrano Concreto" style={{ width: 48, height: 48, objectFit: 'contain', background: '#0B1120', borderRadius: 10, border: '1px solid #3B82F6', padding: 4 }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#FFF' }}>Serrano Concreto Usinado</h3>
                  <div style={{ fontSize: 12, color: '#60A5FA', fontWeight: 700 }}>Central Dosadora, Betoneiras & FCK</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.5 }}>
                Localizada no Distrito Industrial de Tangará da Serra. Usina de concreto com capacidade de 80 m³/h, frota de 8 betoneiras e 2 bombas lança, atendendo obras civis e industriais.
              </p>
              <div style={{ marginTop: 14, fontSize: 12, color: '#64748B' }}>
                CNPJ: 51.499.928/0001-01 · Tangará da Serra/MT
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL DE DISPARO DE WHATSAPP INTELIGENTE (1 CLIQUE) */}
      {/* ------------------------------------------------------------- */}
      {clienteModalWhats && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            background: '#1C130D',
            border: '2px solid #10B981',
            borderRadius: 16,
            padding: 24,
            maxWidth: 540,
            width: '100%',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#10B981', textTransform: 'uppercase' }}>
                  WhatsApp Gastronômico 1 Clique
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 900, color: '#FFF' }}>
                  Mensagem Personalizada para {clienteModalWhats.nome}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setClienteModalWhats(null)}
                style={{ background: 'none', border: 'none', color: '#A8998C', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, fontSize: 12, color: '#C8B6A6' }}>
              <div>📱 <strong>WhatsApp:</strong> {clienteModalWhats.telefone} ({clienteModalWhats.bairro})</div>
              <div>🍕 <strong>Sabor Favorito:</strong> {clienteModalWhats.saboresFavoritos?.join(', ')}</div>
              <div>📊 <strong>Classificação RFV:</strong> {clienteModalWhats.segmentoRFV} ({clienteModalWhats.diasSemPedir} dias sem pedir)</div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#FFF', marginBottom: 6 }}>
                Texto da Abordagem Inteligente:
              </label>
              <textarea
                rows={4}
                value={mensagemWhatsEditada}
                onChange={(e) => setMensagemWhatsEditada(e.target.value)}
                style={{
                  width: '100%',
                  background: '#140D09',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8,
                  padding: 12,
                  color: '#FFF',
                  fontSize: 13,
                  lineHeight: 1.5,
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setClienteModalWhats(null)}
                style={{ background: 'rgba(255,255,255,0.08)', color: '#FFF', border: 'none', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={enviarWhats}
                style={{
                  background: '#10B981',
                  color: '#064E3B',
                  border: 'none',
                  padding: '10px 22px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                }}
              >
                <Send size={16} /> Abrir WhatsApp Web / App
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

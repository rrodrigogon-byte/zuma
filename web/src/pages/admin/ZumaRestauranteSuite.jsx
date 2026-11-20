import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Utensils,
  TrendingUp,
  Sparkles,
  ShoppingBag,
  Truck,
  Users,
  DollarSign,
  Layers,
  ChefHat,
  Search,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Phone,
  MapPin,
  Calendar,
  Award,
  Zap,
  Maximize2
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  ZUMA_EMPRESA_ID,
  ZUMA_COMPANY,
  ZUMA_STORE,
  ZUMA_CNPJ,
  ZUMA_INSCRICAO_ESTADUAL,
  ZUMA_INSCRICAO_MUNICIPAL
} from '../../lib/zuma-constants';

const TABS = [
  { id: 'cockpit', label: 'Cockpit Executivo', icon: TrendingUp, badge: 'Ao Vivo' },
  { id: 'mercado', label: 'Mercado & IA 360°', icon: Zap, badge: 'Radar Tangará' },
  { id: 'cardapio', label: 'Cardápio & Sushi Bar', icon: Utensils, badge: '211 Itens' },
  { id: 'mesas', label: 'Mesas & Salão', icon: Layers, badge: '25 Mesas' },
  { id: 'zumi', label: 'Zumi Atende (KyttoIA)', icon: Sparkles, badge: 'WhatsApp IA' },
  { id: 'estoque', label: 'Estoque de Pescados', icon: ChefHat, badge: 'Salmão & Insumos' },
  { id: 'financeiro', label: 'DRE & Financeiro', icon: DollarSign, badge: 'CMV & Margens' },
  { id: 'crm', label: 'Clientes & Clube Zumi', icon: Users, badge: 'Fidelidade' },
  { id: 'delivery', label: 'Delivery & Canais', icon: Truck, badge: 'Omnichannel' },
  { id: 'pilot', label: 'Pilot Inteligente', icon: ExternalLink, badge: 'Completo' },
];

export default function ZumaRestauranteSuite() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { empresaAtiva, trocarEmpresa } = useAuth();

  const abaAtiva = searchParams.get('tab') || 'cockpit';
  const setAbaAtiva = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  // Garante contexto ativo no Zuma
  useEffect(() => {
    if (empresaAtiva?.id !== ZUMA_EMPRESA_ID && typeof trocarEmpresa === 'function') {
      trocarEmpresa(ZUMA_EMPRESA_ID);
    }
  }, [empresaAtiva?.id, trocarEmpresa]);

  // Estado dos dados
  const [carregando, setCarregando] = useState(false);
  const [cardapio, setCardapio] = useState([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [busca, setBusca] = useState('');
  const [mesas, setMesas] = useState([]);
  const [storefront, setStorefront] = useState(null);

  // Carregar dados de Zuma da API
  const carregarDadosZuma = async () => {
    setCarregando(true);
    try {
      const [resCardapio, resStorefront, resMesas] = await Promise.allSettled([
        api.get('/api/public/zuma/cardapio'),
        api.get('/api/public/zuma/storefront'),
        api.get('/api/admin/mesas')
      ]);

      if (resCardapio.status === 'fulfilled' && resCardapio.value) {
        const itens = Array.isArray(resCardapio.value.itens)
          ? resCardapio.value.itens
          : (Array.isArray(resCardapio.value) ? resCardapio.value : []);
        setCardapio(itens);
      }

      if (resStorefront.status === 'fulfilled' && resStorefront.value) {
        setStorefront(resStorefront.value);
      }

      if (resMesas.status === 'fulfilled' && resMesas.value) {
        const m = resMesas.value.fisicas || [];
        setMesas(m);
      }
    } catch (e) {
      console.warn('Aviso ao carregar dados do Zuma:', e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDadosZuma();
  }, []);

  // Categorias únicas
  const categorias = useMemo(() => {
    const setCats = new Set();
    cardapio.forEach(p => {
      const c = p.categoria_nome || p.categoria || p.cat;
      if (c) setCats.add(c);
    });
    return Array.from(setCats);
  }, [cardapio]);

  // Produtos filtrados
  const produtosFiltrados = useMemo(() => {
    return cardapio.filter(p => {
      const cat = p.categoria_nome || p.categoria || p.cat || '';
      if (categoriaFiltro !== 'todas' && cat !== categoriaFiltro) return false;
      if (!busca.trim()) return true;
      const b = busca.toLowerCase();
      const n = (p.nome || '').toLowerCase();
      const d = (p.descricao || '').toLowerCase();
      return n.includes(b) || d.includes(b);
    });
  }, [cardapio, categoriaFiltro, busca]);

  return (
    <div style={{ padding: '24px 20px', minHeight: '100vh', background: 'var(--bg, #0b0c10)', color: 'var(--text, #f8fafc)' }}>
      {/* CABEÇALHO OFICIAL ZUMA */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(230, 57, 70, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)',
        border: '1px solid rgba(230, 57, 70, 0.35)',
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 20,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #E63946 0%, #D90429 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              boxShadow: '0 4px 14px rgba(230, 57, 70, 0.5)',
              flexShrink: 0
            }}>
              🍣
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.3px' }}>
                  Zuma Cozinha Oriental
                </h1>
                <span style={{
                  background: 'rgba(230, 57, 70, 0.2)',
                  color: '#FF6B6B',
                  border: '1px solid rgba(230, 57, 70, 0.4)',
                  padding: '3px 9px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 800
                }}>
                  Empresa Independente · Kytto ERP
                </span>
                <span style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '3px 9px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700
                }}>
                  ● Domínio: zuma.kytto.com.br
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
                <span><strong>CNPJ:</strong> {ZUMA_CNPJ}</span>
                <span>·</span>
                <span style={{ color: '#10b981' }}><strong>IE:</strong> {ZUMA_INSCRICAO_ESTADUAL} (SEFAZ-MT)</span>
                <span>·</span>
                <span style={{ color: '#38bdf8' }}><strong>IM:</strong> {ZUMA_INSCRICAO_MUNICIPAL} (Tangará da Serra)</span>
                <span>·</span>
                <span>📍 Av. Brasil, 1605, Jardim Cidade Alta</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => carregarDadosZuma()}
              disabled={carregando}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                background: 'var(--card, #1e293b)',
                border: '1px solid var(--line, #334155)',
                color: 'var(--text, #f8fafc)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} className={carregando ? 'spin' : ''} />
              Sincronizar
            </button>
            <a
              href="https://zuma.kytto.com.br"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                background: 'rgba(230, 57, 70, 0.2)',
                border: '1px solid #E63946',
                color: '#FF6B6B',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none'
              }}
            >
              <ExternalLink size={14} />
              Abrir Storefront
            </a>
            <a
              href="/zuma/pilot.html?locale=pt-BR#mercado"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                background: '#E63946',
                color: '#ffffff',
                border: 'none',
                fontSize: 12,
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(230, 57, 70, 0.4)'
              }}
            >
              <Zap size={14} />
              Radar Pilot Tangará
            </a>
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO POR ABAS */}
      <div style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 8,
        marginBottom: 20,
        borderBottom: '1px solid var(--line, #334155)'
      }}>
        {TABS.map(tab => {
          const Icone = tab.icon;
          const ativa = abaAtiva === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setAbaAtiva(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: '10px 10px 0 0',
                background: ativa ? '#E63946' : 'var(--card, #0f172a)',
                color: ativa ? '#ffffff' : 'var(--muted, #94a3b8)',
                border: '1px solid',
                borderColor: ativa ? '#E63946' : 'var(--line, #334155)',
                fontSize: 13,
                fontWeight: ativa ? 800 : 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icone size={15} />
              {tab.label}
              {tab.badge && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: ativa ? 'rgba(255, 255, 255, 0.25)' : 'rgba(230, 57, 70, 0.15)',
                  color: ativa ? '#ffffff' : '#FF6B6B'
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* CONTEÚDO DAS ABAS */}
      {/* 1. ABA COCKPIT */}
      {abaAtiva === 'cockpit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Alerta de Inteligência de Mercado */}
          <div style={{
            background: 'linear-gradient(90deg, rgba(46, 90, 76, 0.4) 0%, rgba(22, 25, 32, 0.9) 100%)',
            border: '1px solid #2E5A4C',
            borderRadius: 12,
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>🎯</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#6FB39B' }}>
                  INTELIGÊNCIA COMPETITIVA & RADAR MERCADO TANGARÁ DA SERRA
                </div>
                <div style={{ fontSize: 13, color: '#f8fafc', marginTop: 2 }}>
                  Zuma lidera o mercado contemporâneo com <b>34,5% de market share</b>. Potencial mapeado de <b>+R$ 95.175/mês</b> em 4 avenidas de expansão.
                </div>
              </div>
            </div>
            <button
              onClick={() => setAbaAtiva('mercado')}
              style={{
                background: '#2E5A4C',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Ver Radar Completo →
            </button>
          </div>

          {/* Cards de Métricas Principais */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted, #94a3b8)', textTransform: 'uppercase' }}>Faturamento Estimado Mês</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', marginTop: 6 }}>R$ 176.000</div>
              <div style={{ fontSize: 12, color: '#10b981', fontWeight: 700, marginTop: 4 }}>▲ 34,5% Market Share em Tangará</div>
            </div>

            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted, #94a3b8)', textTransform: 'uppercase' }}>Mesas Físicas & Salão</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', marginTop: 6 }}>25 Mesas</div>
              <div style={{ fontSize: 12, color: '#38bdf8', fontWeight: 700, marginTop: 4 }}>Av. Brasil 1605 · Tangará da Serra</div>
            </div>

            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted, #94a3b8)', textTransform: 'uppercase' }}>Catálogo Oficial de Sushis</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', marginTop: 6 }}>211 Produtos</div>
              <div style={{ fontSize: 12, color: '#E63946', fontWeight: 700, marginTop: 4 }}>23 Categorias Orientais</div>
            </div>

            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted, #94a3b8)', textTransform: 'uppercase' }}>Margem Delivery Próprio</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981', marginTop: 6 }}>38,5%</div>
              <div style={{ fontSize: 12, color: '#10b981', fontWeight: 700, marginTop: 4 }}>+24,3 p.p. vs Taxas iFood</div>
            </div>
          </div>

          {/* Atalhos Rápidos para Módulos ERP Kytto */}
          <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 800 }}>Módulos Integrados do ERP Kytto para o Zuma</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div onClick={() => navigate('/pdv')} style={{ cursor: 'pointer', padding: 14, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🛒</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>PDV Frente de Caixa</div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Vendas balcão e recebimentos</div>
                </div>
              </div>

              <div onClick={() => navigate('/admin/mesas')} style={{ cursor: 'pointer', padding: 14, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🪑</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Mesas & Comandas</div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>25 mesas ativas do salão</div>
                </div>
              </div>

              <div onClick={() => navigate('/kds')} style={{ cursor: 'pointer', padding: 14, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🍣</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Sushi Bar KDS</div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Fila de preparo em tempo real</div>
                </div>
              </div>

              <div onClick={() => navigate('/admin/cardapio')} style={{ cursor: 'pointer', padding: 14, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🥢</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Cardápio & Preços</div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>211 itens em 23 categorias</div>
                </div>
              </div>

              <div onClick={() => navigate('/admin/estoque')} style={{ cursor: 'pointer', padding: 14, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>📦</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Estoque de Pescados</div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Salmão chileno e insumos</div>
                </div>
              </div>

              <div onClick={() => navigate('/admin/contas-receber')} style={{ cursor: 'pointer', padding: 14, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>💳</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Contas a Receber</div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Cartões, PIX e convênios</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. ABA MERCADO & IA 360° (REQUISIÇÃO ESPECÍFICA DO USUÁRIO BASEADA NO PILOT.HTML#MERCADO) */}
      {abaAtiva === 'mercado' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Banner Principal do Radar */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(46, 90, 76, 0.45) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1px solid #2E5A4C',
            borderRadius: 14,
            padding: 22
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#6FB39B', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  INTELIGÊNCIA COMPETITIVA &amp; RADAR DE EXPANSÃO · TANGARÁ DA SERRA (112.000 HAB)
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', margin: '6px 0' }}>
                  Mercado, Concorrência &amp; Canais Omnichannel Zuma
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: '#cbd5e1', maxWidth: 750 }}>
                  Benchmarking dos 4 restaurantes orientais de Tangará da Serra, simulação de market share, calculadora de desintermediação de taxas (iFood vs Kytto) e formulação de estratégias com Motor KyttoIA 2.5 Flash.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ background: 'rgba(46, 125, 79, 0.25)', color: '#5BC489', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                  Polo Regional do Agro
                </span>
                <span style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                  4 Players Mapeados
                </span>
                <span style={{ background: 'rgba(230, 57, 70, 0.25)', color: '#FF6B6B', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                  Motor KyttoIA 2.5 Flash
                </span>
              </div>
            </div>

            {/* 4 KPIs de Mercado */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 18 }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(46, 90, 76, 0.4)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Market Share Zuma</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#5BC489', marginTop: 4 }}>34,5%</div>
                <div style={{ fontSize: 11, color: '#5BC489', marginTop: 2 }}>▲ Líder Nikkei Contemporâneo (~R$ 176k/mês)</div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(46, 90, 76, 0.4)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>TAM Oriental Estimado</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', marginTop: 4 }}>R$ 510.000</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Mercado mensal total em Tangará da Serra</div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(46, 90, 76, 0.4)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Margem Delivery Próprio</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#5BC489', marginTop: 4 }}>38,5%</div>
                <div style={{ fontSize: 11, color: '#5BC489', marginTop: 2 }}>▲ vs 14,2% no iFood (+24,3 p.p. retidos)</div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(46, 90, 76, 0.4)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Potencial de Expansão Mapeado</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#F07A52', marginTop: 4 }}>+R$ 95.175</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Almoço, 2ª-feira, Clube Zumi e Chuva</div>
              </div>
            </div>
          </div>

          {/* Comparativo de Concorrência e Benchmarking */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
            {/* Market Share Atual */}
            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: 15, fontWeight: 800 }}>Market Share em Tangará da Serra (R$ 510k/mês)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, color: '#E63946' }}>🍣 Zuma Cozinha Oriental (Você)</span>
                    <span style={{ fontWeight: 800 }}>34,5% · R$ 176.000/mês</span>
                  </div>
                  <div style={{ width: '100%', height: 10, background: '#0f172a', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ width: '34.5%', height: '100%', background: '#E63946' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>Sansei Sushi Bar (Rodízio & Salão)</span>
                    <span>29,4% · R$ 150.000/mês</span>
                  </div>
                  <div style={{ width: '100%', height: 10, background: '#0f172a', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ width: '29.4%', height: '100%', background: '#64748b' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>Sushi Ya Delivery (Preço de Entrada)</span>
                    <span>20,1% · R$ 102.500/mês</span>
                  </div>
                  <div style={{ width: '100%', height: 10, background: '#0f172a', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ width: '20.1%', height: '100%', background: '#475569' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>Hanabi Sushi & Pratos Quentes</span>
                    <span>16,0% · R$ 81.500/mês</span>
                  </div>
                  <div style={{ width: '100%', height: 10, background: '#0f172a', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ width: '16%', height: '100%', background: '#334155' }} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: 'rgba(230, 57, 70, 0.08)', border: '1px solid rgba(230, 57, 70, 0.25)', fontSize: 12, color: '#f8fafc' }}>
                <b>Diagnóstico KyttoIA:</b> O Zuma lidera no segmento contemporâneo e alta gastronomia, mas 49,5% do mercado ainda está fragmentado entre o Sansei (rodízio/volume) e Sushi Ya (preço de entrada). Com os canais digitais do Kytto, o Zuma captura mais 12% da concorrência retendo margem.
              </div>
            </div>

            {/* As 4 Avenidas de Crescimento Mapeadas */}
            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: 15, fontWeight: 800 }}>4 Avenidas de Crescimento (+R$ 95.175/mês)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#ffffff' }}>🍱 Almoço Executivo Poké & Teishoku</span>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#10b981' }}>+R$ 38.500/mês</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                    Apenas 1 concorrente atende o almoço corporativo do agro e escritórios em Tangará.
                  </div>
                </div>

                <div style={{ padding: 10, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#ffffff' }}>🌙 Segunda-feira Sem Concorrência</span>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#10b981' }}>+R$ 22.400/mês</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                    Todos os 3 concorrentes fecham na segunda-feira. Zuma captura 100% da demanda reprimida.
                  </div>
                </div>

                <div style={{ padding: 10, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#ffffff' }}>👑 Clube Zumi (Assinaturas Mensais MRR)</span>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#10b981' }}>+R$ 19.800/mês</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                    Recorrência garantida com 80 assinantes nos planos Bronze, Prata e Gold.
                  </div>
                </div>

                <div style={{ padding: 10, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#ffffff' }}>🌧️ Gatilhos de Clima &amp; Chuva Automáticos</span>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#10b981' }}>+R$ 14.475/mês</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                    Disparo de combos quentes (yakisoba, lámen, hot roll) nos dias chuvosos pelo WhatsApp.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Botão de Integração e Acesso ao Pilot Completo */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(230, 57, 70, 0.15) 0%, rgba(15, 23, 42, 0.9) 100%)',
            border: '1px solid rgba(230, 57, 70, 0.4)',
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
                Deseja explorar a experiência completa do Zuma Pilot?
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                O arquivo pilot.html oficial do Zuma com simuladores, matriz RFM e previsão de demanda está 100% ativo na plataforma.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setAbaAtiva('pilot')}
                style={{
                  background: 'var(--card, #1e293b)',
                  color: '#ffffff',
                  border: '1px solid var(--line, #334155)',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Embutir Aqui
              </button>
              <a
                href="/zuma/pilot.html?locale=pt-BR#mercado"
                target="_blank"
                rel="noreferrer"
                style={{
                  background: '#E63946',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 800,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Maximize2 size={14} />
                Abrir em Nova Aba
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 3. ABA CARDÁPIO & SUSHI BAR */}
      {abaAtiva === 'cardapio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Barra de Filtro e Busca */}
          <div style={{
            background: 'var(--card, #1e293b)',
            border: '1px solid var(--line, #334155)',
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 300px' }}>
              <Search size={16} color="var(--muted, #94a3b8)" />
              <input
                type="text"
                placeholder="Buscar por sushis, sashimis, temakis, combinados..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', maxWidth: '100%' }}>
              <button
                onClick={() => setCategoriaFiltro('todas')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid',
                  borderColor: categoriaFiltro === 'todas' ? '#E63946' : 'var(--line, #334155)',
                  background: categoriaFiltro === 'todas' ? '#E63946' : 'var(--surface, #0f172a)',
                  color: categoriaFiltro === 'todas' ? '#ffffff' : 'var(--muted, #94a3b8)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Todas ({cardapio.length})
              </button>
              {categorias.slice(0, 8).map(c => (
                <button
                  key={c}
                  onClick={() => setCategoriaFiltro(c)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid',
                    borderColor: categoriaFiltro === c ? '#E63946' : 'var(--line, #334155)',
                    background: categoriaFiltro === c ? '#E63946' : 'var(--surface, #0f172a)',
                    color: categoriaFiltro === c ? '#ffffff' : 'var(--muted, #94a3b8)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Grid dos Produtos Oficiais Zuma */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {produtosFiltrados.slice(0, 48).map(p => (
              <div
                key={p.id || p.nome}
                style={{
                  background: 'var(--card, #1e293b)',
                  border: '1px solid var(--line, #334155)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {p.foto && (
                  <div style={{ width: '100%', height: 120, background: '#0f172a', overflow: 'hidden' }}>
                    <img src={p.foto} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#E63946', textTransform: 'uppercase' }}>
                      {p.categoria_nome || p.categoria || 'Oriental'}
                    </span>
                    {p.cod_pdv && (
                      <span style={{ fontSize: 9, background: 'var(--surface, #0f172a)', padding: '2px 5px', borderRadius: 4, color: 'var(--muted, #94a3b8)' }}>
                        PDV #{p.cod_pdv}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', marginTop: 4 }}>
                    {p.nome}
                  </div>
                  {p.descricao && (
                    <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 4, flex: 1, lineClamp: 2 }}>
                      {p.descricao}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line, #334155)' }}>
                    <span style={{ fontSize: 15, fontWeight: 900, color: '#10b981' }}>
                      R$ {Number(p.preco || 0).toFixed(2).replace('.', ',')}
                    </span>
                    <button
                      onClick={() => navigate('/pdv')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        background: 'rgba(230, 57, 70, 0.2)',
                        border: '1px solid #E63946',
                        color: '#FF6B6B',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Lançar no PDV
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. ABA MESAS & SALÃO */}
      {abaAtiva === 'mesas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{
            background: 'var(--card, #1e293b)',
            border: '1px solid var(--line, #334155)',
            borderRadius: 12,
            padding: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Salão Oficial Zuma · 25 Mesas</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
                Controle de ocupação, tempo de permanência, conta pedida e fechamento sincronizado com o PDV.
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/mesas')}
              style={{
                background: '#E63946',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Abrir Mapa Completo de Mesas →
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
            {Array.from({ length: 25 }, (_, i) => i + 1).map(num => (
              <div
                key={num}
                onClick={() => navigate('/admin/mesas')}
                style={{
                  background: 'var(--card, #1e293b)',
                  border: '1px solid var(--line, #334155)',
                  borderRadius: 10,
                  padding: 14,
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontSize: 18 }}>🪑</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#ffffff', marginTop: 4 }}>
                  Mesa {num}
                </div>
                <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, marginTop: 4 }}>
                  Livre
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. ABA ZUMI ATENDE (KYTTOIA) */}
      {abaAtiva === 'zumi' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(230, 57, 70, 0.2) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1px solid #E63946',
            borderRadius: 14,
            padding: 22
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 32 }}>🤖</span>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#ffffff' }}>
                  Zumi · Agente de Atendimento &amp; Vendas WhatsApp (KyttoIA 2.5 Flash)
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: 12.5, color: '#cbd5e1' }}>
                  Atendimento ágil e humanizado treinado com o cardápio oficial, cálculo automático de frete para Tangará da Serra e recuperação de carrinhos abandonados.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 18 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 800 }}>Regras de Atendimento do Zumi</h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.8 }}>
                <li>Responde em menos de 3 segundos com saudações orientais corteses ("Konbanwa!").</li>
                <li>Identifica se o cliente prefere sushi cru, maçaricado ou pratos quentes.</li>
                <li>Oferece upsell automático de sobremesa (ex: Hot Roll de Banana com Nutella).</li>
                <li>Gera o código Copia e Cola do PIX oficial do Zuma.</li>
                <li>Notifica a equipe do Sushi Bar no KDS imediatamente ao confirmar o pagamento.</li>
              </ul>
            </div>

            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 18 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 800 }}>Canais Conectados</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 8, background: 'var(--surface, #0f172a)' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800 }}>WhatsApp Oficial Zuma</div>
                    <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>(65) 99800-1447</div>
                  </div>
                  <span style={{ fontSize: 10, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>● Ativo</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 8, background: 'var(--surface, #0f172a)' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800 }}>Instagram Direct</div>
                    <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>@zuma_orientaltga</div>
                  </div>
                  <span style={{ fontSize: 10, background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>Integrado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. ABA ESTOQUE DE PESCADOS */}
      {abaAtiva === 'estoque' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{
            background: 'var(--card, #1e293b)',
            border: '1px solid var(--line, #334155)',
            borderRadius: 12,
            padding: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Estoque de Pescados Frescos &amp; Insumos Nobres</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
                Rastreabilidade por lote, controle de temperatura e rendimento por filé de salmão (CMV).
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/estoque')}
              style={{
                background: '#E63946',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Gerenciar Estoque Completo →
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>🐟 Salmão Fresco Chileno (Filé)</span>
                <span style={{ fontSize: 11, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Em Dia</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', marginTop: 8 }}>18,4 kg</div>
              <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>Mínimo: 8,0 kg · Custo médio: R$ 88,00/kg</div>
            </div>

            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>🍚 Arroz Grão Japonês (Shari)</span>
                <span style={{ fontSize: 11, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Em Dia</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', marginTop: 8 }}>45,0 kg</div>
              <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>Mínimo: 20,0 kg · Custo médio: R$ 14,50/kg</div>
            </div>

            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>🍙 Alga Nori Especial (Folhas)</span>
                <span style={{ fontSize: 11, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Em Dia</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', marginTop: 8 }}>320 un</div>
              <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>Mínimo: 100 un · Custo médio: R$ 0,95/un</div>
            </div>
          </div>
        </div>
      )}

      {/* 7. ABA FINANCEIRO & DRE */}
      {abaAtiva === 'financeiro' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{
            background: 'var(--card, #1e293b)',
            border: '1px solid var(--line, #334155)',
            borderRadius: 12,
            padding: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Demonstrativo de Resultado (DRE) · Zuma Cozinha Oriental</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
                Isolamento financeiro estrito com apuração de CMV real, despesas operacionais e margem líquida.
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/financeiro')}
              style={{
                background: '#E63946',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Módulo Financeiro Geral →
            </button>
          </div>

          <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line, #334155)', fontSize: 13, fontWeight: 800 }}>
                <span>(+) Receita Bruta Total</span>
                <span>R$ 176.000,00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line, #334155)', fontSize: 13, color: '#f87171' }}>
                <span>(-) Impostos &amp; Simples Nacional (4,5%)</span>
                <span>R$ 7.920,00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line, #334155)', fontSize: 13, fontWeight: 800, color: '#38bdf8' }}>
                <span>(=) Receita Líquida</span>
                <span>R$ 168.080,00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line, #334155)', fontSize: 13, color: '#f87171' }}>
                <span>(-) CMV Pescados &amp; Insumos (32%)</span>
                <span>R$ 53.785,60</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line, #334155)', fontSize: 13, fontWeight: 800, color: '#10b981' }}>
                <span>(=) Margem de Contribuição Bruta (68%)</span>
                <span>R$ 114.294,40</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line, #334155)', fontSize: 13, color: '#f87171' }}>
                <span>(-) Custos Fixos &amp; Equipe de Sushimans</span>
                <span>R$ 46.500,00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #E63946', fontSize: 15, fontWeight: 900, color: '#10b981' }}>
                <span>(=) Lucro Operacional Líquido (EBITDA)</span>
                <span>R$ 67.794,40 (38,5%)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. ABA PILOT EMBUTIDO COMPLETO */}
      {abaAtiva === 'pilot' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--card, #1e293b)',
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid var(--line, #334155)'
          }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              Visualizando Zuma Pilot (pilot.html) em Modo Integrado
            </span>
            <a
              href="/zuma/pilot.html?locale=pt-BR#mercado"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                color: '#FF6B6B',
                textDecoration: 'none'
              }}
            >
              <ExternalLink size={14} />
              Abrir em Tela Cheia Externa
            </a>
          </div>

          <div style={{ width: '100%', height: '80vh', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line, #334155)' }}>
            <iframe
              src="/zuma/pilot.html?locale=pt-BR#mercado"
              title="Zuma Pilot"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </div>
        </div>
      )}

      {/* DEMAIS ABAS (CRM / DELIVERY) */}
      {(abaAtiva === 'crm' || abaAtiva === 'delivery') && (
        <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 24, textAlign: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
            {abaAtiva === 'crm' ? 'Clientes & Clube Zumi' : 'Delivery & Canais Omnichannel'}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted, #94a3b8)', marginTop: 8, maxWidth: 500, marginInline: 'auto' }}>
            {abaAtiva === 'crm'
              ? 'Gestão da carteira de clientes, cálculo de LTV, preferências gastronômicas e assinaturas mensais.'
              : 'Roteirização de entregas em Tangará da Serra, integração com WhatsApp Zumi e desintermediação de taxas de marketplace.'}
          </p>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 10 }}>
            <button
              onClick={() => navigate(abaAtiva === 'crm' ? '/admin/clientes' : '/admin/zuma?tab=mercado')}
              style={{
                background: '#E63946',
                color: '#ffffff',
                border: 'none',
                padding: '8px 18px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {abaAtiva === 'crm' ? 'Ver Base no ERP →' : 'Ver Calculadora de Margem →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

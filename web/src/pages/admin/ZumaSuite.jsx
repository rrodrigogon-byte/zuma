import React, { useState, useEffect } from 'react';
import {
  Utensils,
  ChefHat,
  ShoppingBag,
  Users,
  TrendingUp,
  Sparkles,
  Clock,
  Truck,
  ExternalLink,
  CheckCircle2,
  DollarSign,
  Layers,
  Fish,
  QrCode,
  Share2,
  Award,
  Zap,
  Building2,
  Flame,
  ArrowRight,
  ShieldCheck,
  Search,
  RefreshCw,
  Gift
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export const ZUMA_EMPRESA_ID = 'c3c3ac01-8e50-4b61-8c79-de4aaa916da3';

export default function ZumaSuite() {
  const { user, empresaAtiva, trocarEmpresa } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState('cockpit');
  const [carregando, setCarregando] = useState(false);
  const [metricas, setMetricas] = useState({
    totalItens: 211,
    totalCategorias: 23,
    mesasAtivas: 27,
    pedidosHoje: 48,
    faturamentoHoje: 5890.00,
    ticketMedio: 122.70,
    tempoMedioSushi: 14,
    rodiziosServidos: 22,
    clientesVip: 184,
    conveniosAgro: 8
  });

  useEffect(() => {
    // Carregar dados de cardápio e operacionais reais
    async function carregarDados() {
      try {
        setCarregando(true);
        const resCardapio = await api.get('/api/zuma/cardapio').catch(() => null);
        if (resCardapio && resCardapio.totalItens) {
          setMetricas(prev => ({
            ...prev,
            totalItens: resCardapio.totalItens || 211,
            totalCategorias: resCardapio.categorias?.length || 23
          }));
        }
      } catch (e) {
        console.warn('Erro ao carregar métricas Zuma:', e);
      } finally {
        setCarregando(false);
      }
    }
    carregarDados();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#090D16', color: '#F8FAFC', padding: '24px 28px' }}>
      {/* ── HEADER PRINCIPAL DO ZUMA ── */}
      <div style={{
        background: 'linear-gradient(135deg, #111827 0%, #1E1B4B 50%, #0F172A 100%)',
        borderRadius: 16,
        padding: '24px 28px',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
        marginBottom: 24,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 280 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            boxShadow: '0 6px 18px rgba(220, 38, 38, 0.35)',
            border: '2px solid rgba(254, 202, 202, 0.2)'
          }}>
            🍣
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                Zuma Cozinha Oriental
              </h1>
              <span style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#F87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Restaurante Oriental & Rodízio
              </span>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34D399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 800
              }}>
                ● Barramento A2 Síncrono
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>📍 Tangará da Serra - MT</span>
              <span>•</span>
              <span>CNPJ: 36.296.848/0001-57</span>
              <span>•</span>
              <span>IE: 13.882.109-8</span>
              <span>•</span>
              <a
                href="https://www.instagram.com/zuma_orientaltga/"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#F472B6', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                📸 @zuma_orientaltga ↗
              </a>
            </div>
          </div>
        </div>

        {/* ── BOTÕES DE ACESSO RÁPIDO ÀS SUÍTES ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <a
            href="/zuma/pilot.html"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
              color: '#FFFFFF',
              padding: '10px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            <span>🚀</span> Abrir Zuma Pilot 360°
            <ExternalLink size={14} />
          </a>
          <a
            href="/zuma/operacao.html"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(30, 41, 59, 0.8)',
              color: '#E2E8F0',
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              transition: 'all 0.2s ease'
            }}
          >
            <span>🍱</span> Central Operacional (PDV/KDS)
            <ExternalLink size={14} />
          </a>
          <a
            href="/zuma/"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(30, 41, 59, 0.8)',
              color: '#FCD34D',
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              border: '1px solid rgba(252, 211, 77, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            <span>📱</span> Cardápio Digital PWA
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* ── CARDS DE KPIS EM TEMPO REAL ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        <div style={{
          background: '#111827',
          padding: '18px 20px',
          borderRadius: 14,
          border: '1px solid rgba(55, 65, 81, 0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94A3B8', fontSize: 12, fontWeight: 700 }}>
            <span>TOTAL DE SKUS (CARDÁPIO)</span>
            <span style={{ fontSize: 16 }}>🍣</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF', marginTop: 8 }}>
            {metricas.totalItens} <span style={{ fontSize: 14, color: '#94A3B8', fontWeight: 500 }}>itens</span>
          </div>
          <div style={{ fontSize: 12, color: '#34D399', marginTop: 4, fontWeight: 600 }}>
            {metricas.totalCategorias} categorias ativas (Sushi bar + Cozinha)
          </div>
        </div>

        <div style={{
          background: '#111827',
          padding: '18px 20px',
          borderRadius: 14,
          border: '1px solid rgba(55, 65, 81, 0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94A3B8', fontSize: 12, fontWeight: 700 }}>
            <span>MESAS FÍSICAS & SALÃO</span>
            <span style={{ fontSize: 16 }}>🪑</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF', marginTop: 8 }}>
            {metricas.mesasAtivas} <span style={{ fontSize: 14, color: '#94A3B8', fontWeight: 500 }}>mesas</span>
          </div>
          <div style={{ fontSize: 12, color: '#60A5FA', marginTop: 4, fontWeight: 600 }}>
            Salão, Deck, Bistrô e Sushi Bar com QR Code
          </div>
        </div>

        <div style={{
          background: '#111827',
          padding: '18px 20px',
          borderRadius: 14,
          border: '1px solid rgba(55, 65, 81, 0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94A3B8', fontSize: 12, fontWeight: 700 }}>
            <span>MODO RODÍZIO</span>
            <span style={{ fontSize: 16 }}>🍱</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF', marginTop: 8 }}>
            R$ 99,90 <span style={{ fontSize: 14, color: '#94A3B8', fontWeight: 500 }}>/ pessoa</span>
          </div>
          <div style={{ fontSize: 12, color: '#F59E0B', marginTop: 4, fontWeight: 600 }}>
            Segunda a Sábado (Salão & Deck)
          </div>
        </div>

        <div style={{
          background: '#111827',
          padding: '18px 20px',
          borderRadius: 14,
          border: '1px solid rgba(55, 65, 81, 0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94A3B8', fontSize: 12, fontWeight: 700 }}>
            <span>CONVÊNIOS B2B AGRO TANGARÁ</span>
            <span style={{ fontSize: 16 }}>🤝</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF', marginTop: 8 }}>
            {metricas.conveniosAgro} <span style={{ fontSize: 14, color: '#94A3B8', fontWeight: 500 }}>empresas</span>
          </div>
          <div style={{ fontSize: 12, color: '#A78BFA', marginTop: 4, fontWeight: 600 }}>
            Fazendas, Revendas & Cooperativas cadastradas
          </div>
        </div>
      </div>

      {/* ── SELETOR DE ABAS DO DASHBOARD ── */}
      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid rgba(55, 65, 81, 0.8)',
        paddingBottom: 12,
        marginBottom: 24,
        overflowX: 'auto'
      }}>
        {[
          { id: 'cockpit', label: '🚀 Cockpit & 18 Módulos', icone: '🚀' },
          { id: 'operacao', label: '🍱 Central Operacional (4 Estações)', icone: '🍱' },
          { id: 'cardapio_bcg', label: '🏷️ Cardápio & Matriz BCG', icone: '🏷️' },
          { id: 'b2b_agro', label: '🤝 Convênios B2B Agro Tangará', icone: '🌾' },
          { id: 'clube_zumi', label: '👑 Clube Zumi & Fidelidade VIP', icone: '👑' },
          { id: 'concorrencia', label: '🎯 Inteligência Competitiva (KyttoIA)', icone: '🎯' },
        ].map(aba => {
          const ativa = abaAtiva === aba.id;
          return (
            <button
              key={aba.id}
              type="button"
              onClick={() => setAbaAtiva(aba.id)}
              style={{
                background: ativa ? 'rgba(220, 38, 38, 0.2)' : 'transparent',
                border: ativa ? '1px solid #DC2626' : '1px solid transparent',
                color: ativa ? '#F87171' : '#94A3B8',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{aba.icone}</span>
              <span>{aba.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── CONTEÚDO DA ABA SELECIONADA ── */}
      {abaAtiva === 'cockpit' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* Card 1: Zuma Pilot */}
          <div style={{
            background: '#111827',
            borderRadius: 14,
            border: '1px solid rgba(55, 65, 81, 0.8)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 24 }}>🚀</span>
                <span style={{ fontSize: 11, background: 'rgba(239, 68, 68, 0.15)', color: '#F87171', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>
                  18 MÓDULOS INTEGRADOS
                </span>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px 0', color: '#FFFFFF' }}>
                Zuma Pilot 360° (Gestão Executiva)
              </h3>
              <p style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.5, margin: 0 }}>
                Cockpit executivo unificado com Inteligência Competitiva, Engenharia de Cardápio BCG, Matriz RFM de clientes fiéis, Estação Meteorológica Tangará e DRE Gastronômica gerencial.
              </p>
            </div>
            <div style={{ marginTop: 20 }}>
              <a
                href="/zuma/pilot.html"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
                  color: '#FFFFFF',
                  padding: '10px 0',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: 'none'
                }}
              >
                Abrir Zuma Pilot 360° <ArrowRight size={14} />
              </a>
            </div>
          </div>

          {/* Card 2: Central Operacional */}
          <div style={{
            background: '#111827',
            borderRadius: 14,
            border: '1px solid rgba(55, 65, 81, 0.8)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 24 }}>🍱</span>
                <span style={{ fontSize: 11, background: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>
                  4 ESTAÇÕES OPERACIONAIS
                </span>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px 0', color: '#FFFFFF' }}>
                Central Operacional (PDV, KDS, Garçom, Motoboy)
              </h3>
              <p style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.5, margin: 0 }}>
                Frente de caixa rápida, painel KDS de produção para o Sushiman e Cozinha, comanda eletrônica para os garçons nas 27 mesas e despacho ágil para motoboys em Tangará da Serra.
              </p>
            </div>
            <div style={{ marginTop: 20 }}>
              <a
                href="/zuma/operacao.html"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  background: '#1E293B',
                  color: '#E2E8F0',
                  padding: '10px 0',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: 'none',
                  border: '1px solid rgba(148, 163, 184, 0.2)'
                }}
              >
                Abrir Central Operacional <ArrowRight size={14} />
              </a>
            </div>
          </div>

          {/* Card 3: Cardápio PWA */}
          <div style={{
            background: '#111827',
            borderRadius: 14,
            border: '1px solid rgba(55, 65, 81, 0.8)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 24 }}>📱</span>
                <span style={{ fontSize: 11, background: 'rgba(245, 158, 11, 0.15)', color: '#FCD34D', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>
                  EXPERIÊNCIA DO CLIENTE
                </span>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px 0', color: '#FFFFFF' }}>
                Cardápio Digital PWA & Autoatendimento
              </h3>
              <p style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.5, margin: 0 }}>
                Catálogo interativo com 211 produtos e 23 categorias, montador dinâmico de barcas personalizadas, sommelier de saquês, cupom de boas-vindas INSTAZUMA e fotos de alta resolução.
              </p>
            </div>
            <div style={{ marginTop: 20 }}>
              <a
                href="/zuma/"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  background: '#1E293B',
                  color: '#FCD34D',
                  padding: '10px 0',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: 'none',
                  border: '1px solid rgba(252, 211, 77, 0.3)'
                }}
              >
                Abrir Cardápio do Cliente <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      )}

      {abaAtiva === 'operacao' && (
        <div style={{
          background: '#111827',
          borderRadius: 14,
          padding: 24,
          border: '1px solid rgba(55, 65, 81, 0.8)'
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>
            🍣 Central Operacional Unificada do Zuma
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div style={{ padding: 16, background: '#0F172A', borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#F87171', marginBottom: 6 }}>1. PDV / Caixa Balcão</div>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Fechamento rápido de comandas, TEF síncrono, PIX QR Code Dinâmico e emissão de NFC-e Mod 65.</p>
            </div>
            <div style={{ padding: 16, background: '#0F172A', borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#60A5FA', marginBottom: 6 }}>2. KDS Sushi Bar & Cozinha</div>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Fila de preparo dos sushimens com separação de pratos quentes e sushis frios e alarme de atraso.</p>
            </div>
            <div style={{ padding: 16, background: '#0F172A', borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#34D399', marginBottom: 6 }}>3. App Garçom / Salão</div>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Lançamento rápido na mesa, controle das 27 mesas físicas, adição de adicionais e conta parcial.</p>
            </div>
            <div style={{ padding: 16, background: '#0F172A', borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#FBBF24', marginBottom: 6 }}>4. App Motoboy / Delivery</div>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Roteirização em Tangará da Serra, cálculo de frete por bairro e status de entrega em tempo real.</p>
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <a
              href="/zuma/operacao.html"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
                color: '#FFF',
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 800,
                textDecoration: 'none'
              }}
            >
              Acessar Central Operacional Completa <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}

      {abaAtiva === 'cardapio_bcg' && (
        <div style={{
          background: '#111827',
          borderRadius: 14,
          padding: 24,
          border: '1px solid rgba(55, 65, 81, 0.8)'
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
            📊 Matriz BCG de Engenharia de Cardápio (211 SKUs)
          </h3>
          <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 20 }}>
            Classificação estratégica de margem de contribuição e volume de vendas de todos os 211 produtos do Zuma Cozinha Oriental.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div style={{ padding: 16, background: '#0F172A', borderRadius: 10, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#FCD34D', marginBottom: 6 }}>⭐ Estrelas (Alto Volume / Alta Margem)</div>
              <ul style={{ fontSize: 12, color: '#94A3B8', margin: 0, paddingLeft: 18 }}>
                <li>Combinado Zuma Prime (42 peças) - R$ 169,00</li>
                <li>Barca Shogun Imperial (60 peças) - R$ 229,00</li>
                <li>Hot Philadelphia Especial Trufado - R$ 42,90</li>
              </ul>
            </div>
            <div style={{ padding: 16, background: '#0F172A', borderRadius: 10, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#34D399', marginBottom: 6 }}>🐄 Vacas Leiteiras (Alto Volume / Margem Média)</div>
              <ul style={{ fontSize: 12, color: '#94A3B8', margin: 0, paddingLeft: 18 }}>
                <li>Rodízio Oriental Tradicional - R$ 99,90</li>
                <li>Temaki Salmão Completo Grelhado - R$ 34,90</li>
                <li>Uramaki Salmão Philadelphia - R$ 36,00</li>
              </ul>
            </div>
            <div style={{ padding: 16, background: '#0F172A', borderRadius: 10, border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#60A5FA', marginBottom: 6 }}>🐎 Oportunidades (Baixo Volume / Alta Margem)</div>
              <ul style={{ fontSize: 12, color: '#94A3B8', margin: 0, paddingLeft: 18 }}>
                <li>Saquê Junmai Dourado Importado - R$ 145,00</li>
                <li>Sashimi de Polvo & Trufas Negras - R$ 78,00</li>
                <li>Carpaccio de Salmão com Flor de Sal - R$ 56,00</li>
              </ul>
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <a
              href="/zuma/pilot.html#engenharia"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#1E293B',
                color: '#FCD34D',
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                border: '1px solid rgba(252, 211, 77, 0.3)'
              }}
            >
              Ver Tabela Completa dos 211 SKUs no Zuma Pilot <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}

      {abaAtiva === 'b2b_agro' && (
        <div style={{
          background: '#111827',
          borderRadius: 14,
          padding: 24,
          border: '1px solid rgba(55, 65, 81, 0.8)'
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
            🌾 Convênios Corporativos com o Agronegócio de Tangará da Serra
          </h3>
          <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 20 }}>
            Mecanismo B2B de faturamento direto e cartões corporativos para eventos, jantares de diretores de fazendas e confraternizações.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div style={{ padding: 16, background: '#0F172A', borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontWeight: 800, color: '#FFFFFF', marginBottom: 4 }}>Grupo Amaggi / Fazenda Tangará</div>
              <div style={{ fontSize: 12, color: '#34D399' }}>Convênio Executivo (Desconto 10% + Faturamento Mensal)</div>
            </div>
            <div style={{ padding: 16, background: '#0F172A', borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontWeight: 800, color: '#FFFFFF', marginBottom: 4 }}>SLC Agrícola Tangará</div>
              <div style={{ fontSize: 12, color: '#34D399' }}>Eventos & Jantares Corporativos com Rodízio</div>
            </div>
            <div style={{ padding: 16, background: '#0F172A', borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontWeight: 800, color: '#FFFFFF', marginBottom: 4 }}>Agro Baggio (John Deere)</div>
              <div style={{ fontSize: 12, color: '#34D399' }}>Vouchers de Premiação de Vendas</div>
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <a
              href="/zuma/pilot.html#b2b"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#1E293B',
                color: '#60A5FA',
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                border: '1px solid rgba(96, 165, 250, 0.3)'
              }}
            >
              Gerenciar Convênios B2B no Zuma Pilot <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}

      {abaAtiva === 'clube_zumi' && (
        <div style={{
          background: '#111827',
          borderRadius: 14,
          padding: 24,
          border: '1px solid rgba(55, 65, 81, 0.8)'
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
            👑 Clube Zumi & Programa de Recompra VIP
          </h3>
          <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 20 }}>
            Fidelização baseada na Mascote Zumi com cashback em pontos e resgate de combinados exclusivos.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div style={{ padding: 16, background: '#0F172A', borderRadius: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#FCD34D' }}>Nível Bronze (Zumi Baby)</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>1x na semana · 5% cashback · Sobremesa grátis no mês do aniversário</div>
            </div>
            <div style={{ padding: 16, background: '#0F172A', borderRadius: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#E2E8F0' }}>Nível Prata (Zumi Samurai)</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>2x na semana · 8% cashback · Saquê cortesia nas quintas-feiras</div>
            </div>
            <div style={{ padding: 16, background: '#0F172A', borderRadius: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#F59E0B' }}>Nível Ouro (Zumi Shogun)</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Ticket mensal &gt; R$ 800 · 12% cashback · Reserva prioritária de mesas</div>
            </div>
          </div>
        </div>
      )}

      {abaAtiva === 'concorrencia' && (
        <div style={{
          background: '#111827',
          borderRadius: 14,
          padding: 24,
          border: '1px solid rgba(55, 65, 81, 0.8)'
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
            🎯 Inteligência Competitiva de Mercado KyttoIA (Tangará da Serra)
          </h3>
          <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 20 }}>
            Benchmarking automático contra concorrentes gastronômicos locais para manutenção do melhor custo-benefício e maior velocidade de entrega.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <div style={{ padding: 16, background: '#0F172A', borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontWeight: 800, color: '#FFFFFF' }}>🍣 Zuma Cozinha Oriental (Nossa Operação)</div>
              <div style={{ fontSize: 12, color: '#34D399', marginTop: 4 }}>Rodízio R$ 99,90 | 211 SKUs | Entrega média 28min | PWA próprio</div>
            </div>
            <div style={{ padding: 16, background: '#0F172A', borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontWeight: 800, color: '#94A3B8' }}>Sansei Sushi Bar Tangará</div>
              <div style={{ fontSize: 12, color: '#CBD5E1', marginTop: 4 }}>Rodízio R$ 119,00 | 85 SKUs | Dependente iFood (comissão 23%)</div>
            </div>
            <div style={{ padding: 16, background: '#0F172A', borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontWeight: 800, color: '#94A3B8' }}>Sushi Ya & Delivery</div>
              <div style={{ fontSize: 12, color: '#CBD5E1', marginTop: 4 }}>A la carte apenas | 60 SKUs | Tempo médio 45min</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

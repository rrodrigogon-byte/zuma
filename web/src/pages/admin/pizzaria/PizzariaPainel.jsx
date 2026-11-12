import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api, fmtR } from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';
import PizzaBuilderModal from './PizzaBuilderModal';
import FecharMesaModal from './FecharMesaModal';

export default function PizzariaPainel() {
  const { toast } = useToast();
  const [abaAtiva, setAbaAtiva] = useState('mesas'); // 'mesas', 'kds', 'rodizio', 'cardapio'
  const [loading, setLoading] = useState(true);
  const [mesas, setMesas] = useState([]);
  const [cardapio, setCardapio] = useState(null);
  const [kdsPedidos, setKdsPedidos] = useState([]);
  const [kdsMetricas, setKdsMetricas] = useState({ total: 0, pendentes: 0, preparando: 0, prontos: 0 });
  const [kpis, setKpis] = useState(null);

  // Modais
  const [mesaSelecionada, setMesaSelecionada] = useState(null);
  const [modalPizzaAberto, setModalPizzaAberto] = useState(false);
  const [modalFecharAberto, setModalFecharAberto] = useState(false);
  const [comandaAtiva, setComandaAtiva] = useState(null);

  // Lançamento rápido de itens avulsos
  const [modalItensAberto, setModalItensAberto] = useState(false);
  const [filtroKdsSetor, setFiltroKdsSetor] = useState('todos');

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      const [resMesas, resCardapio, resKds, resKpis] = await Promise.all([
        api.get('/api/admin/pizzaria/mesas').catch(() => ({ mesas: [] })),
        api.get('/api/admin/pizzaria/cardapio').catch(() => null),
        api.get('/api/admin/pizzaria/kds').catch(() => ({ pedidos: [], metricas: {} })),
        api.get('/api/admin/pizzaria/kpis').catch(() => null),
      ]);

      setMesas(resMesas.mesas || []);
      setCardapio(resCardapio);
      setKdsPedidos(resKds.pedidos || []);
      setKdsMetricas(resKds.metricas || { total: 0, pendentes: 0, preparando: 0, prontos: 0 });
      setKpis(resKpis);
    } catch (err) {
      console.error(err);
      toast({ title: 'Aviso', description: 'Erro ao carregar dados da pizzaria', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    carregarDados();
    const interval = setInterval(carregarDados, 15000); // Auto-refresh a cada 15 segundos
    return () => clearInterval(interval);
  }, [carregarDados]);

  // Abertura do Montador de Pizza
  const handleAbrirMontadorPizza = (mesa) => {
    setMesaSelecionada(mesa);
    setModalPizzaAberto(true);
  };

  // Lançamento da Pizza montada
  const handleConfirmarPizza = async (pizzaPayload) => {
    if (!mesaSelecionada) return;
    try {
      const num = mesaSelecionada.num || mesaSelecionada.numero;
      await api.post(`/api/admin/pizzaria/mesas/${num}/pizza`, pizzaPayload);
      toast({ title: 'Sucesso', description: `Pizza lançada na Mesa ${num} e enviada ao Forno!`, variant: 'success' });
      carregarDados();
    } catch (err) {
      toast({ title: 'Erro', description: err.message || 'Falha ao lançar pizza', variant: 'error' });
    }
  };

  // Lançamento de Rodízio Rápido
  const handleLancarRodizio = async (mesa, adultos, criancas) => {
    try {
      const num = mesa.num || mesa.numero;
      await api.post(`/api/admin/pizzaria/mesas/${num}/rodizio`, { adultos, criancas });
      toast({ title: 'Sucesso', description: `Rodízio lançado na Mesa ${num}!`, variant: 'success' });
      carregarDados();
    } catch (err) {
      toast({ title: 'Erro', description: err.message || 'Falha ao lançar rodízio', variant: 'error' });
    }
  };

  // Abertura do Modal de Fechamento de Conta
  const handleAbrirFecharConta = async (mesa) => {
    setMesaSelecionada(mesa);
    if (mesa.comandaId) {
      try {
        const cmd = await api.get(`/api/admin/bar/comanda/${mesa.comandaId}`);
        setComandaAtiva(cmd);
      } catch {
        setComandaAtiva(null);
      }
    } else {
      setComandaAtiva(null);
    }
    setModalFecharAberto(true);
  };

  // Confirmação do Fechamento de Conta
  const handleConfirmarFechamento = async (dadosFechamento) => {
    try {
      await api.post(`/api/admin/pizzaria/mesas/${dadosFechamento.mesaNumero}/fechar`, dadosFechamento);
      toast({ title: 'Sucesso', description: `Mesa ${dadosFechamento.mesaNumero} finalizada e liberada!`, variant: 'success' });
      carregarDados();
    } catch (err) {
      toast({ title: 'Erro', description: err.message || 'Falha ao fechar mesa', variant: 'error' });
    }
  };

  // Avançar Status no KDS da Cozinha/Forno
  const handleAvancarKds = async (pedido) => {
    const proximo =
      pedido.status === 'pendente' ? 'preparando' : pedido.status === 'preparando' ? 'pronto' : 'servido';

    try {
      await api.patch(`/api/admin/pizzaria/kds/${pedido.comandaId}/item/${pedido.id}/status`, { status: proximo });
      toast({ title: 'KDS Atualizado', description: `Item avançado para ${proximo.toUpperCase()}`, variant: 'success' });
      carregarDados();
    } catch (err) {
      toast({ title: 'Erro', description: err.message || 'Falha ao avançar item no KDS', variant: 'error' });
    }
  };

  // Mesas agrupadas por setor
  const mesasSalao = useMemo(() => mesas.filter((m) => (m.num || m.numero) <= 15), [mesas]);
  const mesasVaranda = useMemo(
    () => mesas.filter((m) => (m.num || m.numero) >= 16 && (m.num || m.numero) <= 20),
    [mesas]
  );
  const mesasVirtuais = useMemo(() => mesas.filter((m) => (m.num || m.numero) > 20), [mesas]);

  // Filtragem dos pedidos no KDS
  const pedidosFiltradosKds = useMemo(() => {
    if (filtroKdsSetor === 'todos') return kdsPedidos;
    if (filtroKdsSetor === 'pizzas') return kdsPedidos.filter((p) => p.isPizza);
    if (filtroKdsSetor === 'bar') return kdsPedidos.filter((p) => p.setor === 'bar');
    if (filtroKdsSetor === 'cozinha') return kdsPedidos.filter((p) => p.setor === 'cozinha' && !p.isPizza);
    return kdsPedidos;
  }, [kdsPedidos, filtroKdsSetor]);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto', color: 'var(--cream, #fff)' }}>
      {/* Header Institucional Palatare */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
          border: '1px solid rgba(255, 107, 44, 0.3)',
          borderRadius: 14,
          padding: '20px 24px',
          marginBottom: 20,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: '#FF6B2C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              boxShadow: '0 4px 12px rgba(255, 107, 44, 0.4)',
            }}
          >
            🍕
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
                Palatare Pizzaria & Restaurante
              </h1>
              <span
                style={{
                  background: 'rgba(255, 107, 44, 0.2)',
                  color: '#FF6B2C',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 107, 44, 0.4)',
                }}
              >
                Tangará da Serra · MT
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted, #94a3b8)', marginTop: 4 }}>
              Rua 14 nº 307 W · Rodízio Tradicional Ter, Qua e Sex · Forno a Lenha & Delivery
            </div>
          </div>
        </div>

        {/* KPIs de Topo */}
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 16px', borderRadius: 8, textAlign: 'center', border: '1px solid var(--line, #334155)' }}>
            <div style={{ fontSize: 10, color: 'var(--muted, #94a3b8)', textTransform: 'uppercase', fontWeight: 700 }}>Mesas Ocupadas</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#FF6B2C' }}>
              {kpis?.mesas?.ocupadas || 0} / {kpis?.mesas?.total || 22}
            </div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 16px', borderRadius: 8, textAlign: 'center', border: '1px solid var(--line, #334155)' }}>
            <div style={{ fontSize: 10, color: 'var(--muted, #94a3b8)', textTransform: 'uppercase', fontWeight: 700 }}>Fila KDS (Forno)</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#10b981' }}>
              {kdsMetricas.pendentes + kdsMetricas.preparando} pedidos
            </div>
          </div>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--line, #334155)', paddingBottom: 12, marginBottom: 20 }}>
        {[
          { id: 'mesas', rotulo: '🍕 Mesas & Salão (22 Mesas)', badge: `${kpis?.mesas?.ocupadas || 0} ocupadas` },
          { id: 'kds', rotulo: '👨‍🍳 KDS Forneiro & Cozinha', badge: `${kdsMetricas.pendentes + kdsMetricas.preparando} na fila` },
          { id: 'rodizio', rotulo: '🍴 Rodízio Palatare (Ter/Qua/Sex)', badge: 'R$ 59,90' },
          { id: 'cardapio', rotulo: '📋 Cardápio & Sabores', badge: `${cardapio?.pizzas?.length || 15} sabores` },
        ].map((aba) => {
          const ativa = abaAtiva === aba.id;
          return (
            <button
              key={aba.id}
              type="button"
              onClick={() => setAbaAtiva(aba.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 8,
                border: ativa ? '1px solid #FF6B2C' : '1px solid transparent',
                background: ativa ? 'rgba(255, 107, 44, 0.15)' : 'var(--surface, #1e293b)',
                color: ativa ? '#FF6B2C' : 'var(--muted, #94a3b8)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
                transition: 'all 0.15s ease',
              }}
            >
              <span>{aba.rotulo}</span>
              {aba.badge && (
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: ativa ? '#FF6B2C' : 'var(--card, #0f172a)',
                    color: ativa ? '#fff' : 'var(--muted, #94a3b8)',
                  }}
                >
                  {aba.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ABA 1: MAPA DE MESAS & SALÃO */}
      {abaAtiva === 'mesas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Salão Principal */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16 }}>🏛️</span>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>
                Salão Principal (Mesas 1 a 15)
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {mesasSalao.map((m) => renderCardMesa(m))}
            </div>
          </div>

          {/* Varanda & Área Externa */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16 }}>🌿</span>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>
                Varanda & Área Externa (Mesas 16 a 20)
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {mesasVaranda.map((m) => renderCardMesa(m))}
            </div>
          </div>

          {/* Balcão & Delivery */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16 }}>🛵</span>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>
                Balcão, Retirada & Delivery WhatsApp
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {mesasVirtuais.map((m) => renderCardMesa(m))}
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: KDS FORNEIRO & COZINHA */}
      {abaAtiva === 'kds' && (
        <div>
          {/* Barra de Filtros e Status do KDS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { id: 'todos', label: 'Todos os Pedidos' },
                { id: 'pizzas', label: '🍕 Forno / Pizzas' },
                { id: 'cozinha', label: '🍳 Cozinha / Massas' },
                { id: 'bar', label: '🍺 Bar / Bebidas' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroKdsSetor(f.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: filtroKdsSetor === f.id ? '1px solid #10b981' : '1px solid var(--line, #334155)',
                    background: filtroKdsSetor === f.id ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface, #1e293b)',
                    color: filtroKdsSetor === f.id ? '#10b981' : 'var(--muted, #94a3b8)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
              🟢 Normal (&lt;12min) · 🟡 Atenção (12-20min) · 🔴 Atrasado (&gt;20min)
            </div>
          </div>

          {pedidosFiltradosKds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface, #1e293b)', borderRadius: 12, border: '1px solid var(--line, #334155)' }}>
              <div style={{ fontSize: 42, marginBottom: 12 }}>👨‍🍳</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Nenhum pedido em espera na cozinha</div>
              <div style={{ fontSize: 12, color: 'var(--muted, #94a3b8)', marginTop: 4 }}>
                Todos os pedidos foram forneados e entregues às mesas!
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {pedidosFiltradosKds.map((pedido) => {
                const corBorda =
                  pedido.statusSla === 'atrasado'
                    ? '#ef4444'
                    : pedido.statusSla === 'atencao'
                    ? '#f59e0b'
                    : '#10b981';

                return (
                  <div
                    key={pedido.id}
                    style={{
                      background: 'var(--surface, #1e293b)',
                      borderTop: `4px solid ${corBorda}`,
                      borderRight: '1px solid var(--line, #334155)',
                      borderBottom: '1px solid var(--line, #334155)',
                      borderLeft: '1px solid var(--line, #334155)',
                      borderRadius: 10,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 12,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}
                  >
                    <div>
                      {/* Topo do Card KDS */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>
                          {pedido.mesa}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: `${corBorda}22`,
                            color: corBorda,
                          }}
                        >
                          ⏱ {pedido.minutos} min
                        </span>
                      </div>

                      {/* Item e Fração de Pizza */}
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
                        {pedido.qtd}x {pedido.nome}
                      </div>

                      {pedido.obs && (
                        <div
                          style={{
                            background: 'var(--card, #0f172a)',
                            border: '1px solid var(--line, #334155)',
                            borderRadius: 6,
                            padding: '8px 10px',
                            fontSize: 12,
                            color: 'var(--gold, #f59e0b)',
                            lineHeight: 1.4,
                          }}
                        >
                          {pedido.obs}
                        </div>
                      )}
                    </div>

                    {/* Botão de Ação KDS */}
                    <button
                      type="button"
                      onClick={() => handleAvancarKds(pedido)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: 'none',
                        background:
                          pedido.status === 'pendente'
                            ? '#FF6B2C'
                            : pedido.status === 'preparando'
                            ? '#10b981'
                            : '#3b82f6',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      {pedido.status === 'pendente' && '🔥 Colocar no Forno'}
                      {pedido.status === 'preparando' && '✅ Marcar como Pronto'}
                      {pedido.status === 'pronto' && '🍽️ Marcar como Entregue'}
                      {pedido.status === 'servido' && 'Concluído ✓'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ABA 3: RODÍZIO PALATARE */}
      {abaAtiva === 'rodizio' && (
        <div style={{ background: 'var(--surface, #1e293b)', padding: 24, borderRadius: 12, border: '1px solid var(--line, #334155)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <span style={{ fontSize: 32 }}>🍴</span>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#fff' }}>
                Rodízio Tradicional de Pizzas Palatare
              </h2>
              <div style={{ fontSize: 12, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                Válido às Terças, Quartas e Sextas-feiras · Mais de 30 sabores doces, salgados e calzones servidos à vontade
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ background: 'var(--card, #0f172a)', padding: 18, borderRadius: 10, border: '1px solid var(--line, #334155)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>Adulto</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', margin: '6px 0' }}>R$ 59,90</div>
              <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Por pessoa · Servido à vontade no salão</div>
            </div>
            <div style={{ background: 'var(--card, #0f172a)', padding: 18, borderRadius: 10, border: '1px solid var(--line, #334155)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase' }}>Criança (até 10 anos)</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', margin: '6px 0' }}>R$ 29,90</div>
              <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Crianças de 5 a 10 anos</div>
            </div>
          </div>

          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
            Lançar Rodízio Rápido em Mesa Ocupada:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {mesas.map((m) => (
              <div
                key={m.id || m.num}
                style={{
                  background: 'var(--card, #0f172a)',
                  border: '1px solid var(--line, #334155)',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{m.nome}</div>
                  <div style={{ fontSize: 11, color: m.status === 'ocupada' ? '#FF6B2C' : '#10b981' }}>
                    {m.status === 'ocupada' ? 'Ocupada' : 'Livre'} · R$ {Number(m.total || 0).toFixed(2)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleLancarRodizio(m, 2, 0)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--line, #334155)',
                      background: 'var(--surface, #1e293b)',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    +2 Ad
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLancarRodizio(m, 4, 0)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--line, #334155)',
                      background: 'var(--surface, #1e293b)',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    +4 Ad
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA 4: CARDÁPIO & SABORES */}
      {abaAtiva === 'cardapio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>
              Catálogo Oficial da Palatare Pizzaria
            </h2>
            <div style={{ fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
              Total de itens sincronizados: {cardapio?.todosProdutos?.length || 0}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {(cardapio?.pizzas || []).map((pizza) => (
              <div
                key={pizza.id}
                style={{
                  background: 'var(--surface, #1e293b)',
                  border: '1px solid var(--line, #334155)',
                  borderRadius: 10,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{pizza.nome}</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--gold, #f59e0b)' }}>
                      R$ {Number(pizza.preco || 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700, marginBottom: 6 }}>
                    {pizza.categoria}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', lineHeight: 1.4 }}>
                    {pizza.descricao || 'Sem descrição cadastrada'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Pizza Fracionada */}
      <PizzaBuilderModal
        isOpen={modalPizzaAberto}
        onClose={() => setModalPizzaAberto(false)}
        mesa={mesaSelecionada}
        cardapioPizzas={cardapio?.pizzas || []}
        cardapioBordas={cardapio?.bordas || []}
        onConfirmarPizza={handleConfirmarPizza}
      />

      {/* Modal de Fechamento de Conta */}
      <FecharMesaModal
        isOpen={modalFecharAberto}
        onClose={() => setModalFecharAberto(false)}
        mesa={mesaSelecionada}
        comanda={comandaAtiva}
        onConfirmarFechamento={handleConfirmarFechamento}
      />
    </div>
  );

  // Renderizador de Card de Mesa
  function renderCardMesa(m) {
    const isOcupada = m.status === 'ocupada' || m.status === 'conta';
    const total = Number(m.total || 0);

    return (
      <div
        key={m.id || m.num}
        style={{
          background: 'var(--surface, #1e293b)',
          border: isOcupada ? '1px solid #FF6B2C' : '1px solid var(--line, #334155)',
          borderRadius: 10,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 12,
          position: 'relative',
        }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>{m.nome}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: 4,
                background: isOcupada ? 'rgba(255, 107, 44, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                color: isOcupada ? '#FF6B2C' : '#10b981',
                textTransform: 'uppercase',
              }}
            >
              {isOcupada ? 'Ocupada' : 'Livre'}
            </span>
          </div>

          <div style={{ fontSize: 18, fontWeight: 900, color: total > 0 ? '#10b981' : 'var(--muted, #64748b)' }}>
            R$ {total.toFixed(2)}
          </div>
        </div>

        {/* Botões Rápidos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            type="button"
            onClick={() => handleAbrirMontadorPizza(m)}
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              border: 'none',
              background: '#FF6B2C',
              color: '#fff',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            🍕 Lançar Pizza Meio a Meio
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button
              type="button"
              onClick={() => handleLancarRodizio(m, 1, 0)}
              style={{
                padding: '6px 8px',
                borderRadius: 6,
                border: '1px solid var(--line, #334155)',
                background: 'var(--card, #0f172a)',
                color: 'var(--cream, #fff)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🍴 +1 Rodízio
            </button>
            <button
              type="button"
              disabled={!isOcupada && total === 0}
              onClick={() => handleAbrirFecharConta(m)}
              style={{
                padding: '6px 8px',
                borderRadius: 6,
                border: '1px solid #10b981',
                background: isOcupada ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                color: isOcupada ? '#10b981' : 'var(--muted, #64748b)',
                fontSize: 11,
                fontWeight: 800,
                cursor: isOcupada ? 'pointer' : 'not-allowed',
              }}
            >
              🧾 Fechar / Dividir
            </button>
          </div>
        </div>
      </div>
    );
  }
}

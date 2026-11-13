import React, { useState, useEffect } from 'react';
import {
  Truck,
  Pizza,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  RefreshCw,
  ExternalLink,
  Copy,
  Printer,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Play,
  Send,
  Zap,
  ShieldCheck,
  Percent,
  ChefHat,
  Flame,
  X
} from 'lucide-react';
import { api } from '../../../lib/api';
import PizzariaIntegracoesAvancadas from './PizzariaIntegracoesAvancadas';

export default function PizzariaHubDeliveryMulticanal() {
  const [carregando, setCarregando] = useState(true);
  const [canais, setCanais] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [conciliacao, setConciliacao] = useState(null);
  const [filtroCanal, setFiltroCanal] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [modalComanda, setModalComanda] = useState(null);
  const [pedidoIntegracaoModal, setPedidoIntegracaoModal] = useState(null);
  const [notificacao, setNotificacao] = useState(null);
  const [processandoAcao, setProcessandoAcao] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      const [resCanais, resPedidos, resConc] = await Promise.all([
        api.get('/api/admin/pizzaria/delivery/canais'),
        api.get('/api/admin/pizzaria/delivery/pedidos'),
        api.get('/api/admin/pizzaria/delivery/conciliacao')
      ]);

      if (resCanais && resCanais.canais) setCanais(resCanais.canais);
      if (resPedidos && resPedidos.pedidos) setPedidos(resPedidos.pedidos);
      if (resConc) setConciliacao(resConc);
    } catch (e) {
      console.error('Erro ao carregar hub de delivery:', e);
      exibirAviso('Não foi possível carregar dados em tempo real: ' + e.message, 'erro');
    } finally {
      setCarregando(false);
    }
  };

  const exibirAviso = (texto, tipo = 'sucesso') => {
    setNotificacao({ texto, tipo });
    setTimeout(() => setNotificacao(null), 5000);
  };

  const testarConexao = async (canalId) => {
    try {
      setProcessandoAcao(true);
      const res = await api.post(`/api/admin/pizzaria/delivery/canais/${canalId}/testar`, {});
      if (res && res.sucesso) {
        exibirAviso(res.mensagem, 'sucesso');
        await carregarDados();
      }
    } catch (e) {
      exibirAviso('Falha ao testar conexão: ' + e.message, 'erro');
    } finally {
      setProcessandoAcao(false);
    }
  };

  const sincronizarCardapio = async (canalId) => {
    try {
      setProcessandoAcao(true);
      const res = await api.post(`/api/admin/pizzaria/delivery/canais/${canalId}/sincronizar-cardapio`, {});
      if (res && res.sucesso) {
        exibirAviso(res.mensagem, 'sucesso');
        await carregarDados();
      }
    } catch (e) {
      exibirAviso('Falha ao sincronizar cardápio: ' + e.message, 'erro');
    } finally {
      setProcessandoAcao(false);
    }
  };

  const alternarLojaAberta = async (canalId, statusAtual) => {
    try {
      setProcessandoAcao(true);
      const novoStatus = !statusAtual;
      const res = await api.patch(`/api/admin/pizzaria/delivery/canais/${canalId}`, { lojaAberta: novoStatus });
      if (res && res.sucesso) {
        exibirAviso(`Loja ${novoStatus ? 'ABERTA' : 'FECHADA/PAUSADA'} no canal com sucesso.`, 'sucesso');
        await carregarDados();
      }
    } catch (e) {
      exibirAviso('Erro ao alternar status da loja: ' + e.message, 'erro');
    } finally {
      setProcessandoAcao(false);
    }
  };

  const simularPedido = async (canalId) => {
    try {
      setProcessandoAcao(true);
      const res = await api.post('/api/admin/pizzaria/delivery/simular-pedido', { canalId });
      if (res && res.sucesso) {
        exibirAviso(res.mensagem, 'sucesso');
        await carregarDados();
      }
    } catch (e) {
      exibirAviso('Falha ao simular pedido: ' + e.message, 'erro');
    } finally {
      setProcessandoAcao(false);
    }
  };

  const avancarStatusPedido = async (pedidoId, novoStatus) => {
    try {
      setProcessandoAcao(true);
      const res = await api.patch(`/api/admin/pizzaria/delivery/pedidos/${pedidoId}/status`, { status: novoStatus });
      if (res && res.sucesso) {
        exibirAviso(res.mensagem, 'sucesso');
        await carregarDados();
      }
    } catch (e) {
      exibirAviso('Erro ao atualizar status: ' + e.message, 'erro');
    } finally {
      setProcessandoAcao(false);
    }
  };

  const pedidosFiltrados = pedidos.filter(p => {
    if (filtroCanal !== 'todos' && p.canal !== filtroCanal) return false;
    if (filtroStatus !== 'todos' && p.status !== filtroStatus) return false;
    return true;
  });

  const totalBrutoHoje = canais.reduce((acc, c) => acc + (c.faturamentoHoje || 0), 0);
  const totalPedidosHoje = canais.reduce((acc, c) => acc + (c.pedidosHoje || 0), 0);
  const economiaWhats = conciliacao?.economiaGeradaWhatsApp || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* ALERTA DE NOTIFICAÇÃO FLUTUANTE */}
      {notificacao && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 99999,
          background: notificacao.tipo === 'erro' ? '#DC2626' : '#10B981',
          color: '#FFF',
          padding: '14px 20px',
          borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          fontWeight: 700,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          {notificacao.tipo === 'erro' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{notificacao.texto}</span>
          <button
            onClick={() => setNotificacao(null)}
            style={{ background: 'transparent', border: 'none', color: '#FFF', cursor: 'pointer', marginLeft: 10 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* HEADER EXECUTIVO DO HUB */}
      <div style={{
        background: 'linear-gradient(135deg, #1E120D 0%, #2A170F 50%, #170F0A 100%)',
        border: '1px solid rgba(255, 107, 44, 0.35)',
        borderRadius: 16,
        padding: '24px 28px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28 }}>🍕</span>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#FFF', letterSpacing: -0.5 }}>
                Hub de Delivery Multicanal · Palatare Pizzaria
              </h1>
              <span style={{
                background: '#10B98122',
                color: '#10B981',
                border: '1px solid #10B981',
                fontSize: 11,
                fontWeight: 900,
                padding: '3px 10px',
                borderRadius: 20,
                textTransform: 'uppercase'
              }}>
                ● Operação Ao Vivo
              </span>
            </div>
            <p style={{ margin: '8px 0 0', color: '#D1C2B5', fontSize: 13, maxWidth: 840, lineHeight: 1.5 }}>
              Central unificada com recepção de pedidos em tempo real de <strong>iFood Brasil</strong>, <strong>Keeta (Meituan)</strong>, 
              <strong>Open Delivery (Abrasel v2)</strong> e <strong>Cardápio Digital WhatsApp Kytto (0% Comissão)</strong>. Roteamento automático para o KDS Forno a Lenha 400°C e despacho para a frota de motoboys de Tangará da Serra.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => simularPedido('ifood')}
              disabled={processandoAcao}
              style={{
                background: 'rgba(234, 29, 44, 0.2)',
                color: '#EA1D2C',
                border: '1px solid #EA1D2C',
                padding: '10px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
              title="Simular chegada de pedido real do iFood para teste de cozinha e motoboy"
            >
              <Play size={14} /> + Simular iFood
            </button>
            <button
              type="button"
              onClick={() => simularPedido('keeta')}
              disabled={processandoAcao}
              style={{
                background: 'rgba(255, 186, 0, 0.2)',
                color: '#FFBA00',
                border: '1px solid #FFBA00',
                padding: '10px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
              title="Simular chegada de pedido real do Keeta Meituan para teste de cozinha e motoboy"
            >
              <Play size={14} /> + Simular Keeta
            </button>
            <button
              type="button"
              onClick={carregarDados}
              disabled={processandoAcao || carregando}
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: '#FFF',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '10px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={16} className={carregando ? 'animate-spin' : ''} />
              Atualizar Pedidos
            </button>
          </div>
        </div>

        {/* CARDS DE METRICAS PRINCIPAIS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 16,
          marginTop: 24,
          paddingTop: 20,
          borderTop: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 12, color: '#A8998C', fontWeight: 600 }}>Total de Pedidos Hoje</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#FFF', marginTop: 4 }}>{totalPedidosHoje} pedidos</div>
            <div style={{ fontSize: 11, color: '#10B981', marginTop: 4, fontWeight: 700 }}>● Multicanal Integrado</div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 12, color: '#A8998C', fontWeight: 600 }}>Faturamento Delivery Hoje</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#FF6B2C', marginTop: 4 }}>
              R$ {totalBrutoHoje.toFixed(2)}
            </div>
            <div style={{ fontSize: 11, color: '#C8B6A6', marginTop: 4 }}>Tangará da Serra MT</div>
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: 16, borderRadius: 12, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <div style={{ fontSize: 12, color: '#34D399', fontWeight: 700 }}>Economia com WhatsApp Kytto</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#10B981', marginTop: 4 }}>
              R$ {economiaWhats.toFixed(2)}
            </div>
            <div style={{ fontSize: 11, color: '#34D399', marginTop: 4 }}>Taxa 0% vs 23% iFood</div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 12, color: '#A8998C', fontWeight: 600 }}>Tempo Médio de Saída do Forno</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#38BDF8', marginTop: 4 }}>14 min</div>
            <div style={{ fontSize: 11, color: '#93C5FD', marginTop: 4 }}>Forno 400°C Napolitano</div>
          </div>
        </div>
      </div>

      {/* GERENCIADOR DE CANAIS E CONEXÕES */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#FFF' }}>
              Canais de Venda Conectados & Plataformas de Delivery
            </h2>
            <span style={{ fontSize: 12, color: '#A8998C' }}>
              Gerencie a abertura da loja, sincronização de catálogo e credenciais oficiais de API
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {canais.map(canal => (
            <div
              key={canal.id}
              style={{
                background: '#181210',
                border: `1px solid ${canal.cor}44`,
                borderRadius: 14,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 14,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: canal.cor
              }} />

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24 }}>{canal.icone}</span>
                    <div>
                      <strong style={{ fontSize: 16, color: '#FFF' }}>{canal.nome}</strong>
                      <div style={{ fontSize: 11, color: '#A8998C', marginTop: 2 }}>
                        {canal.tipo === 'proprio' ? 'Canal Próprio (0% Taxa)' : `Marketplace · ${canal.comissaoPercentualPadrao}% taxa`}
                      </div>
                    </div>
                  </div>

                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: canal.statusConexao === 'conectado' || canal.statusConexao === 'ativo' ? '#10B981' : '#F59E0B',
                    background: canal.statusConexao === 'conectado' ? '#10B98122' : '#F59E0B22',
                    border: `1px solid ${canal.statusConexao === 'conectado' ? '#10B981' : '#F59E0B'}`,
                    padding: '2px 8px',
                    borderRadius: 6
                  }}>
                    {canal.statusConexao.toUpperCase()}
                  </span>
                </div>

                <div style={{ marginTop: 14, display: 'grid', gap: 6, fontSize: 12, color: '#C8B6A6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Status da Loja:</span>
                    <strong style={{ color: canal.lojaAberta ? '#10B981' : '#EF4444' }}>
                      {canal.lojaAberta ? '● Aberta (Recebendo)' : '○ Pausada / Fechada'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Pedidos Hoje:</span>
                    <strong style={{ color: '#FFF' }}>{canal.pedidosHoje || 0} pedidos</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Faturamento Hoje:</span>
                    <strong style={{ color: '#10B981' }}>R$ {(canal.faturamentoHoje || 0).toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Cardápio Sincronizado:</span>
                    <span style={{ color: '#E2E8F0', fontSize: 11 }}>{canal.totalItensSincronizados || 48} itens</span>
                  </div>
                </div>
              </div>

              {/* AÇÕES DO CANAL */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button
                  type="button"
                  onClick={() => alternarLojaAberta(canal.id, canal.lojaAberta)}
                  disabled={processandoAcao}
                  style={{
                    background: canal.lojaAberta ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: canal.lojaAberta ? '#F87171' : '#34D399',
                    border: `1px solid ${canal.lojaAberta ? '#EF4444' : '#10B981'}`,
                    padding: '8px 10px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {canal.lojaAberta ? 'Pausar Loja' : 'Abrir Loja'}
                </button>

                <button
                  type="button"
                  onClick={() => testarConexao(canal.id)}
                  disabled={processandoAcao}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: '#FFF',
                    border: '1px solid rgba(255,255,255,0.12)',
                    padding: '8px 10px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Testar Ping
                </button>

                <button
                  type="button"
                  onClick={() => sincronizarCardapio(canal.id)}
                  disabled={processandoAcao}
                  style={{
                    gridColumn: 'span 2',
                    background: 'rgba(255, 107, 44, 0.12)',
                    color: '#FF6B2C',
                    border: '1px solid rgba(255, 107, 44, 0.3)',
                    padding: '8px 10px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <Zap size={14} /> Sincronizar Cardápio & Pizzas
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PAINEL DE SIMULAÇÃO DE PEDIDOS EXTERNOS PARA HOMOLOGAÇÃO */}
      <div style={{
        background: '#1F1410',
        border: '1px dashed #FF6B2C',
        borderRadius: 14,
        padding: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <strong style={{ fontSize: 14, color: '#FFF', display: 'flex', alignItems: 'center', gap: 8 }}>
            🧪 Simulador de Pedidos Externos para Homologação da Equipe
          </strong>
          <span style={{ fontSize: 12, color: '#C8B6A6' }}>
            Injete pedidos de teste simulando a compra real de um cliente em cada aplicativo para testar a chegada na cozinha e no KDS:
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => simularPedido('ifood')}
            disabled={processandoAcao}
            style={{
              background: '#EA1D2C',
              color: '#FFF',
              border: 'none',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            + Simular iFood
          </button>

          <button
            type="button"
            onClick={() => simularPedido('keeta')}
            disabled={processandoAcao}
            style={{
              background: '#FDB913',
              color: '#000',
              border: 'none',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer'
            }}
          >
            + Simular Keeta
          </button>

          <button
            type="button"
            onClick={() => simularPedido('whatsapp_proprio')}
            disabled={processandoAcao}
            style={{
              background: '#25D366',
              color: '#FFF',
              border: 'none',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            + Simular WhatsApp Kytto
          </button>
        </div>
      </div>

      {/* CENTRAL UNIFICADA DE PEDIDOS MULTICANAL */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#FFF' }}>
              Central Unificada de Pedidos Delivery ({pedidosFiltrados.length})
            </h2>
            <span style={{ fontSize: 12, color: '#A8998C' }}>
              Acompanhamento de ponta a ponta desde o recebimento até a entrega no destino
            </span>
          </div>

          {/* FILTROS */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select
              value={filtroCanal}
              onChange={e => setFiltroCanal(e.target.value)}
              style={{
                background: '#1F1512',
                color: '#FFF',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700
              }}
            >
              <option value="todos">Todos os Canais</option>
              <option value="ifood">iFood Brasil</option>
              <option value="keeta">Keeta Brasil</option>
              <option value="whatsapp_proprio">WhatsApp Kytto</option>
            </select>

            <select
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
              style={{
                background: '#1F1512',
                color: '#FFF',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700
              }}
            >
              <option value="todos">Todos os Status</option>
              <option value="novo">Novos</option>
              <option value="confirmado">Confirmados</option>
              <option value="preparando_forno">No Forno 400°C</option>
              <option value="pronto_expedicao">Prontos p/ Expedição</option>
              <option value="despachado">Em Rota com Motoboy</option>
              <option value="concluido">Concluídos</option>
            </select>
          </div>
        </div>

        {/* FEED DE PEDIDOS */}
        <div style={{ display: 'grid', gap: 16 }}>
          {pedidosFiltrados.length === 0 ? (
            <div style={{
              background: '#181210',
              border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: 14,
              padding: 40,
              textAlign: 'center',
              color: '#A8998C'
            }}>
              Nenhum pedido encontrado para os filtros selecionados.
            </div>
          ) : (
            pedidosFiltrados.map(pedido => (
              <div
                key={pedido.id}
                style={{
                  background: '#181210',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 14,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                }}
              >
                {/* CABEÇALHO DO PEDIDO */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      background: pedido.canalCor,
                      color: '#FFF',
                      fontSize: 12,
                      fontWeight: 900,
                      padding: '4px 10px',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      {pedido.canalNome}
                    </span>
                    <strong style={{ fontSize: 18, color: '#FFF' }}>{pedido.codigoExibicao}</strong>
                    <span style={{ fontSize: 13, color: '#A8998C' }}>• Recebido às {pedido.horarioPedido}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: 6,
                      background:
                        pedido.status === 'novo' ? '#EF444422' :
                        pedido.status === 'confirmado' ? '#3B82F622' :
                        pedido.status === 'preparando_forno' ? '#F9731622' :
                        pedido.status === 'pronto_expedicao' ? '#10B98122' : '#8B5CF622',
                      color:
                        pedido.status === 'novo' ? '#EF4444' :
                        pedido.status === 'confirmado' ? '#3B82F6' :
                        pedido.status === 'preparando_forno' ? '#F97316' :
                        pedido.status === 'pronto_expedicao' ? '#10B981' : '#A78BFA',
                      border: `1px solid ${
                        pedido.status === 'novo' ? '#EF4444' :
                        pedido.status === 'confirmado' ? '#3B82F6' :
                        pedido.status === 'preparando_forno' ? '#F97316' :
                        pedido.status === 'pronto_expedicao' ? '#10B981' : '#A78BFA'
                      }`
                    }}>
                      {pedido.status === 'novo' ? '● NOVO PEDIDO' :
                       pedido.status === 'confirmado' ? 'CONFIRMADO' :
                       pedido.status === 'preparando_forno' ? '🔥 NO FORNO 400°C' :
                       pedido.status === 'pronto_expedicao' ? '✓ PRONTO EXPEDIÇÃO' :
                       pedido.status === 'despachado' ? '🛵 EM ROTA' : 'CONCLUÍDO'}
                    </span>

                    <button
                      type="button"
                      onClick={() => setPedidoIntegracaoModal(pedido)}
                      style={{
                        background: 'linear-gradient(135deg, rgba(255, 107, 44, 0.25) 0%, rgba(255, 107, 44, 0.1) 100%)',
                        color: '#FF6B2C',
                        border: '1px solid #FF6B2C',
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        boxShadow: '0 2px 8px rgba(255, 107, 44, 0.2)'
                      }}
                      title="Abrir painel de impressão térmica 80mm ESC/POS, emissão de NFC-e SEFAZ-MT e despacho de motoboy"
                    >
                      <Zap size={13} /> Fiscal, Motoboy & Térmica
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalComanda(pedido)}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        color: '#FFF',
                        border: '1px solid rgba(255,255,255,0.15)',
                        padding: '6px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Printer size={13} /> Imprimir Comanda
                    </button>
                  </div>
                </div>

                {/* DADOS DO CLIENTE & ENDEREÇO */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 12,
                  background: 'rgba(0,0,0,0.25)',
                  padding: 12,
                  borderRadius: 10,
                  fontSize: 12
                }}>
                  <div>
                    <span style={{ color: '#A8998C' }}>Cliente:</span> <strong style={{ color: '#FFF' }}>{pedido.clienteNome}</strong>
                    <div style={{ color: '#C8B6A6', marginTop: 2 }}>📞 {pedido.clienteTelefone}</div>
                  </div>
                  <div>
                    <span style={{ color: '#A8998C' }}>Endereço em Tangará:</span>
                    <div style={{ color: '#FFF', fontWeight: 600, marginTop: 2 }}>📍 {pedido.enderecoEntrega}</div>
                    {pedido.complemento && <div style={{ color: '#C8B6A6', fontSize: 11 }}>{pedido.complemento}</div>}
                  </div>
                  <div>
                    <span style={{ color: '#A8998C' }}>Logística & Entrega:</span>
                    <div style={{ color: '#38BDF8', fontWeight: 700, marginTop: 2 }}>
                      {pedido.tipoEntrega === 'parceiro_marketplace' ? '🛵 Entregador do Marketplace' : '🏍️ Frota Própria Palatare'}
                    </div>
                    {pedido.motoboy && <div style={{ color: '#10B981', fontSize: 11 }}>{pedido.motoboy.nome}</div>}
                  </div>
                </div>

                {/* ITENS DA PIZZARIA */}
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#FF6B2C', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Itens da Comanda ({pedido.itens.length})
                  </div>
                  {pedido.itens.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 8,
                        padding: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start'
                      }}
                    >
                      <div>
                        {item.tipo === 'pizza' || item.tipo === 'pizza_doce' ? (
                          <div>
                            <strong style={{ fontSize: 14, color: '#FFF' }}>
                              {item.quantidade}x Pizza {item.tamanho} ({item.fracao?.replace('_', ' ')})
                            </strong>
                            <div style={{ marginTop: 4, display: 'grid', gap: 2, fontSize: 12, color: '#E2E8F0' }}>
                              {item.sabores?.map((sabor, sIdx) => (
                                <div key={sIdx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ color: '#FF6B2C' }}>🍕</span>
                                  <span>{sabor}</span>
                                </div>
                              ))}
                            </div>
                            <div style={{ marginTop: 6, fontSize: 11, color: '#C8B6A6', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                              {item.massa && <span>🥖 Massa: <strong>{item.massa}</strong></span>}
                              {item.borda && <span>🧀 Borda: <strong>{item.borda}</strong></span>}
                              {item.adicionais?.length > 0 && <span>➕ Extras: <strong style={{ color: '#10B981' }}>{item.adicionais.join(', ')}</strong></span>}
                              {item.exclusoes?.length > 0 && <span>➖ Sem: <strong style={{ color: '#EF4444' }}>{item.exclusoes.join(', ')}</strong></span>}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <strong style={{ fontSize: 14, color: '#FFF' }}>{item.quantidade}x {item.nome}</strong>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#10B981' }}>
                        R$ {((item.quantidade || 1) * (item.valorUnitario || 0)).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* TOTALIZADORES & CONCILIAÇÃO FINANCEIRA DO PEDIDO */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(0,0,0,0.3)',
                  padding: 12,
                  borderRadius: 10,
                  fontSize: 12,
                  flexWrap: 'wrap',
                  gap: 12
                }}>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                      <span style={{ color: '#A8998C' }}>Subtotal:</span>{' '}
                      <strong style={{ color: '#FFF' }}>R$ {pedido.subtotal.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#A8998C' }}>Taxa Entrega:</span>{' '}
                      <strong style={{ color: '#FFF' }}>R$ {pedido.taxaEntrega.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#A8998C' }}>Total Bruto:</span>{' '}
                      <strong style={{ fontSize: 15, color: '#FF6B2C' }}>R$ {pedido.totalBruto.toFixed(2)}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: '#A8998C' }}>Comissão Canal:</span>{' '}
                      <strong style={{ color: pedido.comissaoCanal > 0 ? '#EF4444' : '#10B981' }}>
                        - R$ {pedido.comissaoCanal.toFixed(2)}
                      </strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: '#A8998C' }}>Repasse Líquido:</span>{' '}
                      <strong style={{ fontSize: 15, color: '#10B981' }}>
                        R$ {pedido.repasseLiquidoPrevisto.toFixed(2)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* AÇÕES DE FLUXO OPERACIONAL */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                  {pedido.status === 'novo' && (
                    <button
                      type="button"
                      onClick={() => avancarStatusPedido(pedido.id, 'confirmado')}
                      disabled={processandoAcao}
                      style={{
                        background: '#3B82F6',
                        color: '#FFF',
                        border: 'none',
                        padding: '10px 18px',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      ✓ Confirmar & Aceitar Pedido
                    </button>
                  )}

                  {(pedido.status === 'novo' || pedido.status === 'confirmado') && (
                    <button
                      type="button"
                      onClick={() => avancarStatusPedido(pedido.id, 'preparando_forno')}
                      disabled={processandoAcao}
                      style={{
                        background: '#F97316',
                        color: '#FFF',
                        border: 'none',
                        padding: '10px 18px',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Flame size={16} /> Enviar para Forno 400°C (KDS)
                    </button>
                  )}

                  {pedido.status === 'preparando_forno' && (
                    <button
                      type="button"
                      onClick={() => avancarStatusPedido(pedido.id, 'pronto_expedicao')}
                      disabled={processandoAcao}
                      style={{
                        background: '#10B981',
                        color: '#FFF',
                        border: 'none',
                        padding: '10px 18px',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <CheckCircle2 size={16} /> Marcar Pronto para Expedição
                    </button>
                  )}

                  {pedido.status === 'pronto_expedicao' && (
                    <button
                      type="button"
                      onClick={() => avancarStatusPedido(pedido.id, 'despachado')}
                      disabled={processandoAcao}
                      style={{
                        background: '#8B5CF6',
                        color: '#FFF',
                        border: 'none',
                        padding: '10px 18px',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Truck size={16} /> Despachar com Motoboy
                    </button>
                  )}

                  {pedido.status === 'despachado' && (
                    <button
                      type="button"
                      onClick={() => avancarStatusPedido(pedido.id, 'concluido')}
                      disabled={processandoAcao}
                      style={{
                        background: '#10B981',
                        color: '#FFF',
                        border: 'none',
                        padding: '10px 18px',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      ✓ Concluir Entrega
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* PAINEL DE CONCILIAÇÃO FINANCEIRA & COMPARATIVO DE TAXAS */}
      {conciliacao && (
        <div style={{
          background: '#181210',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 24
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#FFF' }}>
                Conciliação Financeira & Comparativo de Taxas por Canal
              </h2>
              <span style={{ fontSize: 12, color: '#A8998C' }}>
                Visão de repasse líquido e rentabilidade por plataforma de delivery
              </span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: '#FFF' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#A8998C', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Canal de Venda</th>
                  <th style={{ padding: '10px 12px' }}>Pedidos</th>
                  <th style={{ padding: '10px 12px' }}>Faturamento Bruto</th>
                  <th style={{ padding: '10px 12px' }}>Taxa Efetiva</th>
                  <th style={{ padding: '10px 12px' }}>Comissão Retida</th>
                  <th style={{ padding: '10px 12px' }}>Repasse Líquido</th>
                  <th style={{ padding: '10px 12px' }}>Rentabilidade</th>
                </tr>
              </thead>
              <tbody>
                {conciliacao.porCanal?.map((c, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.cor }} />
                      <strong>{c.nome}</strong>
                    </td>
                    <td style={{ padding: '12px' }}>{c.totalPedidos}</td>
                    <td style={{ padding: '12px', fontWeight: 700 }}>R$ {c.faturamentoBruto.toFixed(2)}</td>
                    <td style={{ padding: '12px', color: c.taxaEfetivaPercentual > 0 ? '#F87171' : '#34D399', fontWeight: 700 }}>
                      {c.taxaEfetivaPercentual}%
                    </td>
                    <td style={{ padding: '12px', color: '#EF4444' }}>
                      {c.comissaoTotal > 0 ? `- R$ ${c.comissaoTotal.toFixed(2)}` : 'R$ 0,00'}
                    </td>
                    <td style={{ padding: '12px', color: '#10B981', fontWeight: 800 }}>
                      R$ {c.repasseLiquido.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: c.taxaEfetivaPercentual === 0 ? '#10B98122' : 'rgba(255,255,255,0.08)',
                        color: c.taxaEfetivaPercentual === 0 ? '#10B981' : '#E2E8F0'
                      }}>
                        {c.taxaEfetivaPercentual === 0 ? '100% Retido (Máxima)' : `${(100 - c.taxaEfetivaPercentual).toFixed(1)}% Retido`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DE IMPRESSÃO TÉRMICA ESC/POS 80MM */}
      {pedidoIntegracaoModal && (
        <PizzariaIntegracoesAvancadas
          pedidoSelecionado={pedidoIntegracaoModal}
          onClose={() => setPedidoIntegracaoModal(null)}
          onPedidoAtualizado={carregarDados}
        />
      )}

      {modalComanda && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            background: '#FFF',
            color: '#000',
            width: 380,
            maxWidth: '100%',
            borderRadius: 8,
            padding: 24,
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            fontFamily: 'monospace',
            fontSize: 12,
            lineHeight: 1.4
          }}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>PALATARE PIZZARIA</div>
              <div style={{ fontSize: 10 }}>RUA JOÃO DO PRADO ARANTES, 307 W - CENTRO</div>
              <div style={{ fontSize: 10 }}>TANGARÁ DA SERRA - MT · (65) 99999-0090</div>
              <div style={{ marginTop: 6, fontSize: 14, fontWeight: 900, background: '#000', color: '#FFF', padding: 2 }}>
                DELIVERY {modalComanda.canalNome.toUpperCase()}
              </div>
            </div>

            <div style={{ borderBottom: '1px dashed #000', paddingBottom: 8, marginBottom: 8 }}>
              <div>PEDIDO: <strong>{modalComanda.codigoExibicao}</strong></div>
              <div>DATA/HORA: {new Date().toLocaleDateString('pt-BR')} {modalComanda.horarioPedido}</div>
              <div>CLIENTE: <strong>{modalComanda.clienteNome}</strong></div>
              <div>FONE: {modalComanda.clienteTelefone}</div>
              <div>END: {modalComanda.enderecoEntrega}</div>
              {modalComanda.complemento && <div>COMPL: {modalComanda.complemento}</div>}
            </div>

            <div style={{ borderBottom: '1px dashed #000', paddingBottom: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>ITENS DA COZINHA (FORNO 400°C):</div>
              {modalComanda.itens.map((it, idx) => (
                <div key={idx} style={{ marginBottom: 6 }}>
                  <div><strong>{it.quantidade}x {it.tamanho ? `PIZZA ${it.tamanho}` : it.nome}</strong></div>
                  {it.sabores && (
                    <div style={{ paddingLeft: 10, fontSize: 11 }}>
                      {it.sabores.map((s, sIdx) => <div key={sIdx}>- {s}</div>)}
                    </div>
                  )}
                  {it.borda && <div style={{ paddingLeft: 10, fontSize: 10 }}>BORDA: {it.borda}</div>}
                  {it.adicionais?.length > 0 && <div style={{ paddingLeft: 10, fontSize: 10 }}>OBS: {it.adicionais.join(', ')}</div>}
                </div>
              ))}
            </div>

            <div style={{ borderBottom: '1px dashed #000', paddingBottom: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>SUBTOTAL:</span> <span>R$ {modalComanda.subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>TAXA ENTREGA:</span> <span>R$ {modalComanda.taxaEntrega.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 900, marginTop: 4 }}>
                <span>TOTAL:</span> <span>R$ {modalComanda.totalBruto.toFixed(2)}</span>
              </div>
              <div style={{ marginTop: 4, fontSize: 10 }}>FORMA PGTO: {modalComanda.formaPagamento}</div>
            </div>

            <div style={{ textAlign: 'center', fontSize: 10, marginBottom: 16 }}>
              KYTTO ERP MULTICANAL · PROTOCOLO OPEN DELIVERY
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setModalComanda(null)}
                style={{ flex: 1, padding: 8, background: '#E2E8F0', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                style={{ flex: 1, padding: 8, background: '#000', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 800 }}
              >
                🖨️ Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

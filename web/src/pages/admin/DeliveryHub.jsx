import React, { useState, useEffect } from 'react';
import { useToast } from '../../hooks/useToast';

export default function DeliveryHub() {
  const { toast } = useToast();
  const [abaAtiva, setAbaAtiva] = useState('pedidos');
  const [pedidos, setPedidos] = useState([]);
  const [filaKds, setFilaKds] = useState([]);
  const [entregadores, setEntregadores] = useState([]);
  const [zonasFrete, setZonasFrete] = useState([]);
  const [cmvDados, setCmvDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [motoboySelecionado, setMotoboySelecionado] = useState({});
  const [comandaModal, setComandaModal] = useState(null);
  const [reciboModal, setReciboModal] = useState(null);

  useEffect(() => {
    carregarTudo();
  }, []);

  const carregarTudo = async () => {
    setCarregando(true);
    try {
      const token = localStorage.getItem('sp_token') || localStorage.getItem('sp_site_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [resPed, resKds, resEnt, resZon, resCmv] = await Promise.all([
        fetch('/api/admin/delivery/pedidos', { headers }),
        fetch('/api/admin/delivery/kds', { headers }),
        fetch('/api/admin/delivery/entregadores', { headers }),
        fetch('/api/admin/delivery/zonas-frete', { headers }),
        fetch('/api/admin/delivery/cmv', { headers })
      ]);

      const [dPed, dKds, dEnt, dZon, dCmv] = await Promise.all([
        resPed.json(),
        resKds.json(),
        resEnt.json(),
        resZon.json(),
        resCmv.json()
      ]);

      if (dPed.sucesso) setPedidos(dPed.pedidos);
      if (dKds.sucesso) setFilaKds(dKds.fila);
      if (dEnt.sucesso) setEntregadores(dEnt.entregadores);
      if (dZon.sucesso) setZonasFrete(dZon.zonas);
      if (dCmv.sucesso) setCmvDados(dCmv);
    } catch (e) {
      console.error('Erro ao carregar dados do delivery:', e);
    } finally {
      setCarregando(false);
    }
  };

  const despacharPedido = async (pedidoId) => {
    const entregadorId = motoboySelecionado[pedidoId] || (entregadores[0] && entregadores[0].id);
    if (!entregadorId) {
      if (toast) toast('Selecione um motoboy para despachar.', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('sp_token') || localStorage.getItem('sp_site_token');
      const res = await fetch(`/api/admin/delivery/pedidos/${pedidoId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'saiu_entrega', entregadorId })
      });
      const data = await res.json();
      if (data.sucesso) {
        if (toast) toast('Pedido despachado! Notificação enviada ao WhatsApp do cliente.', 'success');
        carregarTudo();
      }
    } catch (e) {
      if (toast) toast('Erro ao despachar pedido.', 'error');
    }
  };

  const avancarKds = async (pedidoId, novoStatus) => {
    try {
      const token = localStorage.getItem('sp_token') || localStorage.getItem('sp_site_token');
      const res = await fetch(`/api/admin/delivery/kds/${pedidoId}/avancar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ novoStatus })
      });
      const data = await res.json();
      if (data.sucesso) {
        if (toast) toast(`Status do pedido avançado para ${novoStatus.toUpperCase()}!`, 'success');
        carregarTudo();
      }
    } catch (e) {
      if (toast) toast('Erro ao avançar status no KDS.', 'error');
    }
  };

  const abrirComandaTermica = async (pedidoId) => {
    try {
      const token = localStorage.getItem('sp_token') || localStorage.getItem('sp_site_token');
      const res = await fetch(`/api/admin/delivery/pedidos/${pedidoId}/comanda-termica`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.sucesso) {
        setComandaModal(data.comandaTexto);
      }
    } catch (e) {
      if (toast) toast('Erro ao gerar comanda térmica.', 'error');
    }
  };

  const fecharAcerto = async (entregadorId) => {
    try {
      const token = localStorage.getItem('sp_token') || localStorage.getItem('sp_site_token');
      const res = await fetch(`/api/admin/delivery/entregadores/${entregadorId}/fechar-acerto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ observacoes: 'Fechamento do turno' })
      });
      const data = await res.json();
      if (data.sucesso) {
        setReciboModal(data.fechamento.reciboTexto);
        if (toast) toast('Acerto de contas realizado com sucesso!', 'success');
        carregarTudo();
      }
    } catch (e) {
      if (toast) toast('Erro ao fechar acerto.', 'error');
    }
  };

  return (
    <div className="dadm-page" style={{ padding: '24px 32px' }}>
      <header className="dadm-head" style={{ marginBottom: 20 }}>
        <div className="dadm-eyebrow">Operação & Logística · Kytto ERP</div>
        <h1 style={{ margin: '4px 0 0 0', fontSize: 26, fontWeight: 800 }}>
          🛵 Central de Delivery, Logística & KDS
        </h1>
        <p style={{ margin: '4px 0 0 0', color: 'var(--muted)' }}>
          Controle de pedidos multicanal (WhatsApp, Cardápio QR e Balcão), monitor de produção KDS em tempo real, despacho para motoboys e inteligência de CMV.
        </p>
      </header>

      {/* Abas Superiores */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--border)', marginBottom: 24, overflowX: 'auto' }}>
        <button
          onClick={() => setAbaAtiva('pedidos')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: abaAtiva === 'pedidos' ? '3px solid var(--primary, #00a868)' : '3px solid transparent',
            background: 'none',
            fontWeight: 700,
            cursor: 'pointer',
            color: abaAtiva === 'pedidos' ? 'var(--primary, #00a868)' : 'var(--muted)'
          }}
        >
          📦 Pedidos & Despacho ({pedidos.length})
        </button>
        <button
          onClick={() => setAbaAtiva('kds')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: abaAtiva === 'kds' ? '3px solid var(--primary, #00a868)' : '3px solid transparent',
            background: 'none',
            fontWeight: 700,
            cursor: 'pointer',
            color: abaAtiva === 'kds' ? 'var(--primary, #00a868)' : 'var(--muted)'
          }}
        >
          🍳 Monitor KDS (Cozinha & Expedição)
        </button>
        <button
          onClick={() => setAbaAtiva('motoboys')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: abaAtiva === 'motoboys' ? '3px solid var(--primary, #00a868)' : '3px solid transparent',
            background: 'none',
            fontWeight: 700,
            cursor: 'pointer',
            color: abaAtiva === 'motoboys' ? 'var(--primary, #00a868)' : 'var(--muted)'
          }}
        >
          🏍️ Motoboys & Acertos ({entregadores.length})
        </button>
        <button
          onClick={() => setAbaAtiva('zonas')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: abaAtiva === 'zonas' ? '3px solid var(--primary, #00a868)' : '3px solid transparent',
            background: 'none',
            fontWeight: 700,
            cursor: 'pointer',
            color: abaAtiva === 'zonas' ? 'var(--primary, #00a868)' : 'var(--muted)'
          }}
        >
          🗺️ Zonas de Frete Tangará MT ({zonasFrete.length})
        </button>
        <button
          onClick={() => setAbaAtiva('cmv')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: abaAtiva === 'cmv' ? '3px solid var(--primary, #00a868)' : '3px solid transparent',
            background: 'none',
            fontWeight: 700,
            cursor: 'pointer',
            color: abaAtiva === 'cmv' ? 'var(--primary, #00a868)' : 'var(--muted)'
          }}
        >
          📊 CMV Teórico vs Real
        </button>
      </div>

      {/* Conteúdo Aba 1: Pedidos */}
      {abaAtiva === 'pedidos' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
          {pedidos.map(p => (
            <div key={p.id} style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 18, fontWeight: 800 }}>PED-{p.numero}</span>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 800,
                  background: p.status === 'em_preparo' ? '#fef3c7' : p.status === 'saiu_entrega' ? '#e0e7ff' : '#dcfce7',
                  color: p.status === 'em_preparo' ? '#92400e' : p.status === 'saiu_entrega' ? '#3730a3' : '#166534'
                }}>
                  {p.status.toUpperCase().replace('_', ' ')}
                </span>
              </div>

              <div style={{ fontSize: 13, color: 'var(--foreground)', marginBottom: 8 }}>
                <strong>Cliente:</strong> {p.cliente.nome} · {p.cliente.telefone}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
                📍 {p.cliente.endereco}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>ITENS:</div>
                {p.itens.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>{it.qtd}x {it.nome}</span>
                    <span style={{ fontWeight: 600 }}>R$ {it.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: 10, marginBottom: 16 }}>
                <span style={{ fontWeight: 700 }}>Total (c/ Taxa R$ {p.taxaEntrega.toFixed(2)}):</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#00a868' }}>R$ {p.total.toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button
                  onClick={() => abrirComandaTermica(p.id)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: '#f8fafc',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🖨️ Comanda 80mm
                </button>
              </div>

              {p.status === 'em_preparo' && (
                <div>
                  <select
                    value={motoboySelecionado[p.id] || ''}
                    onChange={(e) => setMotoboySelecionado({ ...motoboySelecionado, [p.id]: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', marginBottom: 10 }}
                  >
                    <option value="">Selecione o Motoboy...</option>
                    {entregadores.map(m => (
                      <option key={m.id} value={m.id}>{m.nome} ({m.veiculo})</option>
                    ))}
                  </select>
                  <button
                    onClick={() => despacharPedido(p.id)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#2563eb',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    🛵 Despachar p/ Motoboy (WhatsApp ao Cliente)
                  </button>
                </div>
              )}

              {p.status === 'saiu_entrega' && (
                <button
                  onClick={() => avancarKds(p.id, 'entregue')}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#059669',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ✓ Confirmar Entrega Realizada
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Conteúdo Aba 2: KDS */}
      {abaAtiva === 'kds' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filaKds.map(p => (
            <div
              key={p.id}
              style={{
                background: 'var(--card-bg, #fff)',
                borderTop: `6px solid ${p.alertaKds === 'critico' ? '#ef4444' : p.alertaKds === 'atencao' ? '#f59e0b' : '#10b981'}`,
                borderRadius: 8,
                padding: 16,
                border: '1px solid var(--border)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 800 }}>PED #{p.numero}</span>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 800,
                  background: p.alertaKds === 'critico' ? '#fee2e2' : p.alertaKds === 'atencao' ? '#fef3c7' : '#dcfce7',
                  color: p.alertaKds === 'critico' ? '#b91c1c' : p.alertaKds === 'atencao' ? '#b45309' : '#15803d'
                }}>
                  ⏱️ {p.tempoDecorridoMinutos} min / Meta: {p.tempoMetaMinutos} min
                </span>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{p.cliente.nome}</div>

              <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, marginBottom: 12 }}>
                {p.itens.map((it, idx) => (
                  <div key={idx} style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    • {it.qtd}x {it.nome}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {p.status === 'em_preparo' && (
                  <button
                    onClick={() => avancarKds(p.id, 'pronto_expedicao')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#10b981',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ✓ Pronto p/ Expedição
                  </button>
                )}
                {p.status === 'pronto_expedicao' && (
                  <button
                    onClick={() => despacharPedido(p.id)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#3b82f6',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    🛵 Entregar ao Motoboy
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Conteúdo Aba 3: Motoboys */}
      {abaAtiva === 'motoboys' && (
        <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700 }}>Equipe de Motoboys & Acertos Financeiros</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)' }}>
                <th style={{ padding: 10 }}>ENTREGADOR</th>
                <th style={{ padding: 10 }}>TELEFONE</th>
                <th style={{ padding: 10 }}>VEÍCULO</th>
                <th style={{ padding: 10 }}>STATUS</th>
                <th style={{ padding: 10 }}>ENTREGAS HOJE</th>
                <th style={{ padding: 10 }}>REPASSE ACUMULADO</th>
                <th style={{ padding: 10 }}>AÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {entregadores.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 12, fontWeight: 700 }}>{m.nome}</td>
                  <td style={{ padding: 12 }}>{m.telefone}</td>
                  <td style={{ padding: 12 }}>{m.veiculo}</td>
                  <td style={{ padding: 12 }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 700,
                      background: m.status === 'disponivel' ? '#dcfce7' : '#e0e7ff',
                      color: m.status === 'disponivel' ? '#166534' : '#3730a3'
                    }}>
                      {m.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: 12, fontWeight: 700 }}>{m.entregasRealizadasHoje}</td>
                  <td style={{ padding: 12, fontWeight: 800, color: '#00a868' }}>
                    R$ {m.totalComissaoAcumulada.toFixed(2)}
                  </td>
                  <td style={{ padding: 12 }}>
                    <button
                      onClick={() => fecharAcerto(m.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: '#f8fafc',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      💰 Fechar Diária
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Conteúdo Aba 4: Zonas de Frete */}
      {abaAtiva === 'zonas' && (
        <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700 }}>Zonas de Frete de Tangará da Serra MT</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)' }}>
                <th style={{ padding: 10 }}>BAIRRO / REGIÃO</th>
                <th style={{ padding: 10 }}>TAXA DE ENTREGA</th>
                <th style={{ padding: 10 }}>TEMPO MÉDIO</th>
                <th style={{ padding: 10 }}>FRETE GRÁTIS A PARTIR DE</th>
                <th style={{ padding: 10 }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {zonasFrete.map(z => (
                <tr key={z.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 12, fontWeight: 700 }}>{z.bairro}</td>
                  <td style={{ padding: 12, fontWeight: 800, color: '#00a868' }}>R$ {z.taxa.toFixed(2)}</td>
                  <td style={{ padding: 12 }}>⏱️ {z.tempoMinutos} minutos</td>
                  <td style={{ padding: 12 }}>R$ {z.freteGratisAcimaDe.toFixed(2)}</td>
                  <td style={{ padding: 12, color: '#00a868', fontWeight: 700 }}>✓ Ativo</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Conteúdo Aba 5: CMV */}
      {abaAtiva === 'cmv' && cmvDados && (
        <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 800 }}>Auditoria de CMV Teórico vs Real</h3>
          <p style={{ margin: '0 0 20px 0', fontSize: 13, color: 'var(--muted)' }}>
            Confronto entre o custo padrão das fichas técnicas e o custo real das mercadorias consumidas.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Faturamento Total</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>R$ {cmvDados.faturamentoTotal.toFixed(2)}</div>
            </div>
            <div style={{ background: '#ecfdf5', padding: 16, borderRadius: 8, border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: 11, color: '#047857', textTransform: 'uppercase', fontWeight: 700 }}>CMV Teórico ({cmvDados.cmvTeoricoPercentual}%)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#047857', marginTop: 4 }}>R$ {cmvDados.cmvTeorico.toFixed(2)}</div>
            </div>
            <div style={{ background: '#fef2f2', padding: 16, borderRadius: 8, border: '1px solid #fecaca' }}>
              <div style={{ fontSize: 11, color: '#b91c1c', textTransform: 'uppercase', fontWeight: 700 }}>CMV Real ({cmvDados.cmvRealPercentual}%)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#b91c1c', marginTop: 4 }}>R$ {cmvDados.cmvReal.toFixed(2)}</div>
            </div>
            <div style={{ background: '#fefce8', padding: 16, borderRadius: 8, border: '1px solid #fef08a' }}>
              <div style={{ fontSize: 11, color: '#a16207', textTransform: 'uppercase', fontWeight: 700 }}>Variação / Desperdício</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#a16207', marginTop: 4 }}>R$ {cmvDados.variacaoDesperdicio.toFixed(2)}</div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>Detalhamento por Item da Ficha Técnica:</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px' }}>Item / Produto</th>
                  <th style={{ padding: '8px 10px' }}>Custo Ficha Técnica</th>
                  <th style={{ padding: '8px 10px' }}>Custo Real Estoque</th>
                  <th style={{ padding: '8px 10px' }}>Desvio (%)</th>
                  <th style={{ padding: '8px 10px' }}>Diagnóstico</th>
                </tr>
              </thead>
              <tbody>
                {cmvDados.itensAvaliados.map((it, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700 }}>{it.produto}</td>
                    <td style={{ padding: '8px 10px' }}>R$ {it.custoFichaTecnica.toFixed(2)}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: it.desvioPercentual > 5 ? '#dc2626' : '#16a34a' }}>
                      R$ {it.custoRealEstoque.toFixed(2)}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 700 }}>+{it.desvioPercentual}%</td>
                    <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{it.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Comanda Térmica */}
      {comandaModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 10, maxWidth: 450, width: '90%' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 800 }}>Visualizador de Comanda Térmica (80mm)</h3>
            <pre style={{
              background: '#f8fafc',
              border: '1px solid var(--border)',
              padding: 16,
              borderRadius: 6,
              fontSize: 11,
              fontFamily: 'monospace',
              maxHeight: 350,
              overflowY: 'auto'
            }}>
              {comandaModal}
            </pre>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                onClick={() => {
                  window.print();
                  if (toast) toast('Comanda enviada à impressora térmica!', 'success');
                }}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 6,
                  border: 'none',
                  background: '#00a868',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🖨️ Imprimir Agora
              </button>
              <button
                onClick={() => setComandaModal(null)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: '#f1f5f9',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Recibo de Acerto */}
      {reciboModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 10, maxWidth: 500, width: '90%' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 800, color: '#00a868' }}>
              ✓ Recibo de Quitação de Diária
            </h3>
            <pre style={{
              background: '#f8fafc',
              border: '1px solid var(--border)',
              padding: 16,
              borderRadius: 6,
              fontSize: 11,
              fontFamily: 'monospace',
              maxHeight: 350,
              overflowY: 'auto'
            }}>
              {reciboModal}
            </pre>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                onClick={() => {
                  window.print();
                }}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 6,
                  border: 'none',
                  background: '#00a868',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🖨️ Imprimir Recibo
              </button>
              <button
                onClick={() => setReciboModal(null)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: '#f1f5f9',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

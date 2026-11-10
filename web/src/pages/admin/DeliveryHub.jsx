import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { useToast } from '../../components/Toast.jsx';

export default function DeliveryHub() {
  const { toast } = useToast();
  const [pedidos, setPedidos] = useState([]);
  const [entregadores, setEntregadores] = useState([]);
  const [cmv, setCmv] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [subTab, setSubTab] = useState('pedidos'); // pedidos, entregadores, cmv
  const [modalNovoMotoboy, setModalNovoMotoboy] = useState(false);
  const [novoMotoboy, setNovoMotoboy] = useState({ nome: '', telefone: '', veiculo: '', taxaFixaEntrega: '8.00' });

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [rPedidos, rEntregadores, rCmv] = await Promise.all([
        api.get('/api/admin/delivery/pedidos'),
        api.get('/api/admin/delivery/entregadores'),
        api.get('/api/admin/delivery/cmv')
      ]);

      if (rPedidos?.sucesso) setPedidos(rPedidos.pedidos || []);
      if (rEntregadores?.sucesso) setEntregadores(rEntregadores.entregadores || []);
      if (rCmv?.sucesso) setCmv(rCmv.relatorio || null);
    } catch (err) {
      if (toast) toast('Erro ao carregar dados de delivery: ' + err.message, 'danger');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const avancarStatus = async (pedidoId, proximoStatus, motoboyId) => {
    try {
      const res = await api.patch(`/api/admin/delivery/pedidos/${pedidoId}/status`, {
        status: proximoStatus,
        entregadorId: motoboyId
      });

      if (res?.sucesso) {
        if (toast) toast(`Status atualizado para "${proximoStatus.toUpperCase()}"! WhatsApp disparado.`, 'success');
        carregarDados();
      }
    } catch (err) {
      if (toast) toast('Erro ao atualizar status: ' + err.message, 'danger');
    }
  };

  const cadastrarMotoboySubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/admin/delivery/entregadores', novoMotoboy);
      if (res?.sucesso) {
        if (toast) toast('Entregador cadastrado com sucesso!', 'success');
        setModalNovoMotoboy(false);
        setNovoMotoboy({ nome: '', telefone: '', veiculo: '', taxaFixaEntrega: '8.00' });
        carregarDados();
      }
    } catch (err) {
      if (toast) toast('Erro ao cadastrar motoboy: ' + err.message, 'danger');
    }
  };

  return (
    <div className="dadm-page" style={{ padding: '24px' }}>
      <header className="dadm-head" style={{ marginBottom: '24px' }}>
        <div className="dadm-eyebrow">Operação & Logística · Kytto ERP</div>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '4px 0 8px 0', color: '#1e293b' }}>
          🛵 Central de Delivery & Gestão de Entregas
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Controle de pedidos multicanal (WhatsApp, Cardápio QR e Balcão), despacho de motoboys parceiros, régua automática e CMV.
        </p>
      </header>

      {/* Sub-abas de Navegação */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <button
          type="button"
          onClick={() => setSubTab('pedidos')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: subTab === 'pedidos' ? '#2563eb' : '#f1f5f9',
            color: subTab === 'pedidos' ? '#ffffff' : '#475569',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          📦 Pedidos em Aberto ({pedidos.filter(p => p.status !== 'entregue').length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('entregadores')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: subTab === 'entregadores' ? '#2563eb' : '#f1f5f9',
            color: subTab === 'entregadores' ? '#ffffff' : '#475569',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          🏍️ Motoboys & Repasses ({entregadores.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('cmv')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: subTab === 'cmv' ? '#2563eb' : '#f1f5f9',
            color: subTab === 'cmv' ? '#ffffff' : '#475569',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          📊 CMV Teórico vs Real (Margem)
        </button>
      </div>

      {carregando ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Carregando dados de entregas...</div>
      ) : (
        <>
          {/* ABA PEDIDOS */}
          {subTab === 'pedidos' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
              {pedidos.map(p => (
                <div
                  key={p.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#0f172a' }}>{p.numero}</span>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background:
                          p.status === 'entregue' ? '#dcfce7' :
                          p.status === 'saiu_entrega' ? '#e0e7ff' :
                          p.status === 'em_preparo' ? '#fef9c3' : '#f1f5f9',
                        color:
                          p.status === 'entregue' ? '#166534' :
                          p.status === 'saiu_entrega' ? '#3730a3' :
                          p.status === 'em_preparo' ? '#854d0e' : '#475569'
                      }}
                    >
                      {p.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div style={{ fontSize: '14px', color: '#334155', marginBottom: '8px' }}>
                    <strong>Cliente:</strong> {p.clienteNome} · <span>{p.clienteTelefone}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
                    📍 <em>{p.endereco}</em>
                  </div>

                  {/* Itens do Pedido */}
                  <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px' }}>ITENS:</span>
                    {p.itens.map((it, idx) => (
                      <div key={idx} style={{ fontSize: '13px', color: '#1e293b', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{it.quantidade}x {it.nome}</span>
                        <span>R$ {(it.quantidade * it.valorUnitario).toFixed(2).replace('.', ',')}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px dashed #cbd5e1', marginTop: '8px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
                      <span>Total (c/ Taxa R$ {p.taxaEntrega.toFixed(2)}):</span>
                      <span style={{ color: '#059669' }}>R$ {p.valorTotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>

                  {/* Ações de Despacho */}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                    {p.status === 'recebido' && (
                      <button
                        type="button"
                        onClick={() => avancarStatus(p.id, 'em_preparo')}
                        style={{ width: '100%', padding: '10px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        🍳 Iniciar Preparo (Avisar Cliente WhatsApp)
                      </button>
                    )}
                    {p.status === 'em_preparo' && (
                      <div style={{ display: 'grid', gap: '8px' }}>
                        <select
                          id={`select-motoboy-${p.id}`}
                          defaultValue={entregadores[0]?.id || ''}
                          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        >
                          {entregadores.map(m => (
                            <option key={m.id} value={m.id}>{m.nome} ({m.veiculo})</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const sel = document.getElementById(`select-motoboy-${p.id}`);
                            avancarStatus(p.id, 'saiu_entrega', sel?.value);
                          }}
                          style={{ width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          🛵 Despachar p/ Motoboy (WhatsApp ao Cliente)
                        </button>
                      </div>
                    )}
                    {p.status === 'saiu_entrega' && (
                      <button
                        type="button"
                        onClick={() => avancarStatus(p.id, 'entregue')}
                        style={{ width: '100%', padding: '10px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        ✓ Confirmar Entrega Realizada
                      </button>
                    )}
                    {p.status === 'entregue' && (
                      <div style={{ textAlign: 'center', color: '#059669', fontSize: '13px', fontWeight: 600 }}>
                        ✓ Pedido entregue por {p.entregadorNome}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ABA MOTOBOYS */}
          {subTab === 'entregadores' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Equipe de Motoboys & Entregadores</h3>
                <button
                  type="button"
                  onClick={() => setModalNovoMotoboy(true)}
                  style={{ padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  + Cadastrar Novo Motoboy
                </button>
              </div>

              <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                      <th style={{ padding: '12px 16px' }}>Entregador</th>
                      <th style={{ padding: '12px 16px' }}>Telefone</th>
                      <th style={{ padding: '12px 16px' }}>Veículo</th>
                      <th style={{ padding: '12px 16px' }}>Status Atual</th>
                      <th style={{ padding: '12px 16px' }}>Entregas Hoje</th>
                      <th style={{ padding: '12px 16px' }}>Repasse Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entregadores.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{m.nome}</td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>{m.telefone}</td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>{m.veiculo}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: m.status === 'disponivel' ? '#dcfce7' : '#e0e7ff',
                            color: m.status === 'disponivel' ? '#166534' : '#3730a3'
                          }}>
                            {m.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{m.entregasRealizadasHoje}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#059669' }}>
                          R$ {m.totalComissaoAcumulada.toFixed(2).replace('.', ',')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ABA CMV */}
          {subTab === 'cmv' && cmv && (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px' }}>
              <h3 style={{ fontSize: '20px', color: '#1e293b', marginBottom: '8px' }}>Auditoria de CMV Teórico vs Real</h3>
              <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
                Confronto entre o custo padrão das fichas técnicas e o custo real das mercadorias consumidas.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Faturamento Total</span>
                  <strong style={{ fontSize: '22px', color: '#0f172a' }}>R$ {cmv.totalFaturado.toFixed(2).replace('.', ',')}</strong>
                </div>
                <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <span style={{ fontSize: '12px', color: '#166534', textTransform: 'uppercase', display: 'block' }}>CMV Teórico ({cmv.percCmvTeorico}%)</span>
                  <strong style={{ fontSize: '22px', color: '#166534' }}>R$ {cmv.totalCmvTeorico.toFixed(2).replace('.', ',')}</strong>
                </div>
                <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <span style={{ fontSize: '12px', color: '#991b1b', textTransform: 'uppercase', display: 'block' }}>CMV Real ({cmv.percCmvReal}%)</span>
                  <strong style={{ fontSize: '22px', color: '#991b1b' }}>R$ {cmv.totalCmvReal.toFixed(2).replace('.', ',')}</strong>
                </div>
                <div style={{ background: '#fefce8', padding: '16px', borderRadius: '8px', border: '1px solid #fef08a' }}>
                  <span style={{ fontSize: '12px', color: '#854d0e', textTransform: 'uppercase', display: 'block' }}>Variação / Desperdício</span>
                  <strong style={{ fontSize: '22px', color: '#854d0e' }}>R$ {cmv.variacaoDesperdicio.toFixed(2).replace('.', ',')}</strong>
                </div>
              </div>

              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', borderLeft: '4px solid #2563eb' }}>
                <strong style={{ display: 'block', color: '#1e293b', marginBottom: '4px' }}>Diagnóstico de Rentabilidade:</strong>
                <span style={{ color: '#475569', fontSize: '14px' }}>
                  Status: <strong>{cmv.statusEficiencia}</strong>. O índice de CMV Real está alinhado com a meta operacional do negócio (abaixo de 32% do faturamento bruto).
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL CADASTRAR MOTOBOY */}
      {modalNovoMotoboy && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '420px', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#1e293b' }}>Cadastrar Novo Motoboy</h3>
            <form onSubmit={cadastrarMotoboySubmit} style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Nome Completo</label>
                <input
                  type="text"
                  required
                  value={novoMotoboy.nome}
                  onChange={e => setNovoMotoboy({ ...novoMotoboy, nome: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>WhatsApp / Telefone</label>
                <input
                  type="text"
                  required
                  value={novoMotoboy.telefone}
                  onChange={e => setNovoMotoboy({ ...novoMotoboy, telefone: e.target.value })}
                  placeholder="5565999999999"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Veículo e Placa</label>
                <input
                  type="text"
                  value={novoMotoboy.veiculo}
                  onChange={e => setNovoMotoboy({ ...novoMotoboy, veiculo: e.target.value })}
                  placeholder="Honda CG 160 (RRA-9B12)"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Taxa Fixa de Repasse (R$)</label>
                <input
                  type="number"
                  step="0.50"
                  value={novoMotoboy.taxaFixaEntrega}
                  onChange={e => setNovoMotoboy({ ...novoMotoboy, taxaFixaEntrega: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setModalNovoMotoboy(false)}
                  style={{ padding: '8px 14px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Salvar Entregador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

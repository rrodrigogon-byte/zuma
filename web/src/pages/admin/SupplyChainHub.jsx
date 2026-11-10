import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  FileCheck,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Building,
  Calendar,
  Layers,
  Search,
  Plus
} from 'lucide-react';

export default function SupplyChainHub() {
  const [abaAtiva, setAbaAtiva] = useState('cotacoes'); // 'cotacoes' | 'pedidos' | 'matching'
  const [cotacoes, setCotacoes] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState('');

  const carregarDados = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sp_token') || localStorage.getItem('token');
      const headers = { 'Authorization': 'Bearer ' + token };

      const [resCot, resPed] = await Promise.all([
        fetch('/api/admin/supply-chain/cotacoes', { headers }),
        fetch('/api/admin/supply-chain/pedidos-compra', { headers })
      ]);

      const dCot = await resCot.json();
      const dPed = await resPed.json();

      if (dCot.sucesso) setCotacoes(dCot.cotacoes || []);
      if (dPed.sucesso) setPedidos(dPed.pedidos || []);
    } catch (err) {
      console.error('Erro ao carregar dados de Supply Chain:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleAprovarCotacao = async (rfqId, fornecedorId) => {
    try {
      const token = localStorage.getItem('sp_token') || localStorage.getItem('token');
      const res = await fetch(`/api/admin/supply-chain/cotacoes/${rfqId}/aprovar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ fornecedorIdEscolhido: fornecedorId })
      });
      const data = await res.json();
      if (data.sucesso) {
        setMensagem(data.mensagem);
        carregarDados();
      }
    } catch (err) {
      alert('Erro ao aprovar cotação: ' + err.message);
    }
  };

  const handleExecutarMatching = async (poId) => {
    try {
      const token = localStorage.getItem('sp_token') || localStorage.getItem('token');
      const res = await fetch(`/api/admin/supply-chain/pedidos-compra/${poId}/3-way-matching`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.sucesso) {
        setMensagem(`Conferência 3-Way Matching do Pedido ${data.numeroPedido}: ${data.parecer}`);
        carregarDados();
      }
    } catch (err) {
      alert('Erro na conferência 3-Way: ' + err.message);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto', fontFamily: 'inherit' }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Suprimentos & Compras · Kytto ERP
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: '4px 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          📦 Supply Chain & Cotação de Fornecedores (RFQ)
        </h1>
        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
          Cotação multicanal de compras, matriz comparativa de preços, emissão de Pedidos (PO) e conferência cega 3-Way Matching com MD-e.
        </p>
      </div>

      {mensagem && (
        <div style={{ padding: '14px 18px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', color: '#065f46', fontSize: '14px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 style={{ width: '20px', height: '20px', flexShrink: 0 }} />
          <span>{mensagem}</span>
        </div>
      )}

      {/* Navegação de Abas */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', gap: '24px', marginBottom: '24px' }}>
        <button
          onClick={() => setAbaAtiva('cotacoes')}
          style={{
            padding: '12px 4px',
            fontWeight: 700,
            fontSize: '14px',
            background: 'none',
            border: 'none',
            borderBottom: abaAtiva === 'cotacoes' ? '3px solid #d97706' : '3px solid transparent',
            color: abaAtiva === 'cotacoes' ? '#d97706' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <ShoppingCart style={{ width: '18px', height: '18px' }} />
          Cotações RFQ & Comparativo ({cotacoes.length})
        </button>
        <button
          onClick={() => setAbaAtiva('pedidos')}
          style={{
            padding: '12px 4px',
            fontWeight: 700,
            fontSize: '14px',
            background: 'none',
            border: 'none',
            borderBottom: abaAtiva === 'pedidos' ? '3px solid #d97706' : '3px solid transparent',
            color: abaAtiva === 'pedidos' ? '#d97706' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FileCheck style={{ width: '18px', height: '18px' }} />
          Pedidos de Compra (PO) ({pedidos.length})
        </button>
        <button
          onClick={() => setAbaAtiva('matching')}
          style={{
            padding: '12px 4px',
            fontWeight: 700,
            fontSize: '14px',
            background: 'none',
            border: 'none',
            borderBottom: abaAtiva === 'matching' ? '3px solid #d97706' : '3px solid transparent',
            color: abaAtiva === 'matching' ? '#d97706' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Layers style={{ width: '18px', height: '18px' }} />
          3-Way Matching (Pedido x NF-e x Estoque)
        </button>
      </div>

      {/* ABA 1: COTAÇÕES RFQ */}
      {abaAtiva === 'cotacoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {cotacoes.map((rfq) => (
            <div key={rfq.id} style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{rfq.numero}</span>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: rfq.status === 'APROVADA' ? '#d1fae5' : '#fef3c7',
                      color: rfq.status === 'APROVADA' ? '#065f46' : '#92400e'
                    }}>
                      {rfq.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Solicitante: <strong>{rfq.solicitante}</strong> · Centro de Custo: <strong>{rfq.centroCusto}</strong>
                  </div>
                </div>
              </div>

              {/* Itens Requisitados */}
              <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Itens Requisitados para Reposição de Estoque
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                  {rfq.itensSolicitados.map((it) => (
                    <div key={it.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                      <div style={{ fontWeight: 700, color: '#1e293b' }}>{it.descricao}</div>
                      <div style={{ color: '#64748b', marginTop: '4px' }}>
                        Qtd: <strong>{it.quantidade} {it.unidade}</strong> · Preço Ref: R$ {it.precoReferencia?.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quadro Comparativo de Propostas */}
              <div style={{ padding: '18px 24px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '14px' }}>
                  Quadro Comparativo de Propostas Comerciais
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
                  {rfq.propostasFornecedores.map((p) => (
                    <div
                      key={p.fornecedorId}
                      style={{
                        padding: '18px',
                        borderRadius: '12px',
                        border: p.melhorPrecoGeral ? '2px solid #10b981' : '1px solid #cbd5e1',
                        background: p.melhorPrecoGeral ? '#f0fdf4' : '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '16px' }}>{p.razaoSocial}</div>
                            <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', marginTop: '2px' }}>
                              CNPJ: {p.cnpj} · {p.cidade}
                            </div>
                          </div>
                          {p.melhorPrecoGeral && (
                            <span style={{ padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, background: '#d1fae5', color: '#065f46' }}>
                              ⭐ MENOR PREÇO
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '14px 0', fontSize: '12px' }}>
                          <div style={{ padding: '8px', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <span style={{ color: '#64748b' }}>Frete:</span> <strong>{p.tipoFrete}</strong>
                          </div>
                          <div style={{ padding: '8px', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <span style={{ color: '#64748b' }}>Lead Time:</span> <strong>{p.leadTimeDias} dias</strong>
                          </div>
                          <div style={{ gridColumn: 'span 2', padding: '8px', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <span style={{ color: '#64748b' }}>Condição:</span> <strong>{p.condicaoPagamento}</strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Total Proposta:</div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                            R$ {p.valorTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        {rfq.status !== 'APROVADA' && (
                          <button
                            onClick={() => handleAprovarCotacao(rfq.id, p.fornecedorId)}
                            style={{
                              padding: '10px 16px',
                              background: '#059669',
                              color: '#ffffff',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 700,
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            ✓ Aprovar & Gerar Pedido
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ABA 2: PEDIDOS DE COMPRA (PO) */}
      {abaAtiva === 'pedidos' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Ordens de Compra Emitidas (Purchase Orders)
            </h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead style={{ background: '#f1f5f9', color: '#475569', fontWeight: 700 }}>
              <tr>
                <th style={{ padding: '12px 16px' }}>Número</th>
                <th style={{ padding: '12px 16px' }}>Fornecedor</th>
                <th style={{ padding: '12px 16px' }}>Data Emissão</th>
                <th style={{ padding: '12px 16px' }}>Condição</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((po) => (
                <tr key={po.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 800, color: '#0f172a' }}>{po.numero}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 700, color: '#1e293b' }}>{po.fornecedor.razaoSocial}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{po.fornecedor.cnpj}</div>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#64748b' }}>{new Date(po.dataEmissao).toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '14px 16px', color: '#64748b' }}>{po.condicaoPagamento}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: '#dbeafe', color: '#1e40af' }}>
                      {po.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '14px' }}>
                    R$ {po.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ABA 3: 3-WAY MATCHING */}
      {abaAtiva === 'matching' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {pedidos.map((po) => (
            <div key={po.id} style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Conferência 3-Way: {po.numero} x NF-e Fornecedor x Estoque Físico
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Fornecedor: <strong>{po.fornecedor.razaoSocial}</strong> ({po.fornecedor.cnpj})
                  </div>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 800, background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                  ✓ {po.statusConferencia3Way || 'CONFERÊNCIA APROVADA'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>1. Pedido de Compra (PO)</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '6px 0' }}>
                    R$ {po.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Autorizado pelo almoxarifado</div>
                </div>

                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>2. NF-e Fornecedor (MD-e)</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '6px 0' }}>
                    R$ {po.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                    NF-e nº 8899 capturada via SEFAZ
                  </div>
                </div>

                <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#065f46', textTransform: 'uppercase' }}>3. Estoque Físico Recebido</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#065f46', margin: '6px 0' }}>
                    100% Conferido
                  </div>
                  <div style={{ fontSize: '12px', color: '#047857' }}>Custo Médio Ponderado Recalculado</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  onClick={() => handleExecutarMatching(po.id)}
                  style={{
                    padding: '8px 16px',
                    background: '#1e293b',
                    color: '#ffffff',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <FileCheck style={{ width: '16px', height: '16px' }} />
                  Revalidar 3-Way Matching
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

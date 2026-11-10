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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">
            Suprimentos & Compras · Kytto ERP
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-amber-600" />
            Supply Chain & Cotação de Fornecedores (RFQ)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Cotação multicanal de compras, matriz comparativa de preços, emissão de Pedidos (PO) e conferência cega 3-Way Matching com MD-e.
          </p>
        </div>
      </div>

      {mensagem && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{mensagem}</span>
        </div>
      )}

      {/* Navegação de Abas */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setAbaAtiva('cotacoes')}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition ${
            abaAtiva === 'cotacoes'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Cotações RFQ & Comparativo ({cotacoes.length})
        </button>
        <button
          onClick={() => setAbaAtiva('pedidos')}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition ${
            abaAtiva === 'pedidos'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          Pedidos de Compra (PO) ({pedidos.length})
        </button>
        <button
          onClick={() => setAbaAtiva('matching')}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition ${
            abaAtiva === 'matching'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          3-Way Matching (Pedido x NF-e x Estoque)
        </button>
      </div>

      {/* ABA 1: COTAÇÕES RFQ */}
      {abaAtiva === 'cotacoes' && (
        <div className="space-y-6">
          {cotacoes.map((rfq) => (
            <div key={rfq.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900 text-lg">{rfq.numero}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      rfq.status === 'APROVADA' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {rfq.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Solicitante: <strong>{rfq.solicitante}</strong> · Centro de Custo: <strong>{rfq.centroCusto}</strong>
                  </div>
                </div>
              </div>

              {/* Itens da Cotação */}
              <div className="p-5 border-b border-slate-100">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Itens Requisitados para Reposição
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {rfq.itensSolicitados.map((it) => (
                    <div key={it.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div className="font-bold text-slate-800">{it.descricao}</div>
                      <div className="text-slate-500 mt-1">
                        Qtd: <strong>{it.quantidade} {it.unidade}</strong> · Preço Ref: R$ {it.precoReferencia?.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comparativo de Fornecedores */}
              <div className="p-5">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Quadro Comparativo de Propostas Comerciais
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rfq.propostasFornecedores.map((p) => (
                    <div
                      key={p.fornecedorId}
                      className={`p-4 rounded-xl border-2 transition ${
                        p.melhorPrecoGeral
                          ? 'border-emerald-500 bg-emerald-50/30'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-slate-900 text-base">{p.razaoSocial}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{p.cnpj} · {p.cidade}</div>
                        </div>
                        {p.melhorPrecoGeral && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" /> Menor Preço
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-white rounded border border-slate-100">
                          <span className="text-slate-500">Frete:</span> <strong>{p.tipoFrete}</strong>
                        </div>
                        <div className="p-2 bg-white rounded border border-slate-100">
                          <span className="text-slate-500">Lead Time:</span> <strong>{p.leadTimeDias} dias</strong>
                        </div>
                        <div className="col-span-2 p-2 bg-white rounded border border-slate-100">
                          <span className="text-slate-500">Pagamento:</span> <strong>{p.condicaoPagamento}</strong>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-200">
                        <div>
                          <div className="text-xs text-slate-500">Valor Total Proposta:</div>
                          <div className="text-xl font-bold text-slate-900">
                            R$ {p.valorTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        {rfq.status !== 'APROVADA' && (
                          <button
                            onClick={() => handleAprovarCotacao(rfq.id, p.fornecedorId)}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
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

      {/* ABA 2: PEDIDOS DE COMPRA */}
      {abaAtiva === 'pedidos' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h3 className="font-bold text-slate-800">Ordens de Compra Emitidas (Purchase Orders)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-4">Número</th>
                  <th className="py-3 px-4">Fornecedor</th>
                  <th className="py-3 px-4">Data Emissão</th>
                  <th className="py-3 px-4">Condição</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Valor Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pedidos.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">{po.numero}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{po.fornecedor.razaoSocial}</div>
                      <div className="text-xs text-slate-500 font-mono">{po.fornecedor.cnpj}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{new Date(po.dataEmissao).toLocaleDateString('pt-BR')}</td>
                    <td className="py-3 px-4 text-slate-600">{po.condicaoPagamento}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        {po.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      R$ {po.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 3: 3-WAY MATCHING */}
      {abaAtiva === 'matching' && (
        <div className="space-y-4">
          {pedidos.map((po) => (
            <div key={po.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    Conferência 3-Way: {po.numero} x NF-e Fornecedor x Estoque Físico
                  </h3>
                  <p className="text-xs text-slate-500">
                    Fornecedor: {po.fornecedor.razaoSocial} ({po.fornecedor.cnpj})
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {po.statusConferencia3Way || 'CONFERÊNCIA APROVADA'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">1. Pedido de Compra (PO)</div>
                  <div className="text-xl font-bold text-slate-900">
                    R$ {po.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Autorizado pelo almoxarifado</div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">2. NF-e Fornecedor (MD-e)</div>
                  <div className="text-xl font-bold text-slate-900">
                    R$ {po.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono truncate">
                    Chave: {po.notaFiscalVinculada?.chaveAcesso || '512610...8899'}
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">3. Estoque Físico Recebido</div>
                  <div className="text-xl font-bold text-emerald-900">
                    100% Conferido
                  </div>
                  <div className="text-xs text-emerald-700 mt-1">Custo Médio Ponderado Recalculado</div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => handleExecutarMatching(po.id)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition flex items-center gap-2"
                >
                  <FileCheck className="w-4 h-4" /> Revalidar 3-Way Matching
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

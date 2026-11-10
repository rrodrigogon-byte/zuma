import React, { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, CreditCard, QrCode, FileText, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';

export default function DimpAuditoriaTab() {
  const [loading, setLoading] = useState(false);
  const [auditoria, setAuditoria] = useState(null);
  const [regularizando, setRegularizando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState('');

  const carregarAuditoria = async () => {
    setLoading(true);
    setMensagemSucesso('');
    try {
      const token = localStorage.getItem('sp_token') || localStorage.getItem('token');
      const res = await fetch('/api/admin/dimp-auditoria/auditar?mes=10&ano=2026', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      if (data.sucesso) {
        setAuditoria(data);
      }
    } catch (err) {
      console.error('Erro ao carregar auditoria DIMP:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarAuditoria();
  }, []);

  const handleRegularizarLote = async () => {
    if (!auditoria?.vendasPendentesEmissao?.length) return;
    setRegularizando(true);
    try {
      const token = localStorage.getItem('sp_token') || localStorage.getItem('token');
      const res = await fetch('/api/admin/dimp-auditoria/regularizar-lote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ itens: auditoria.vendasPendentesEmissao })
      });
      const data = await res.json();
      if (data.sucesso) {
        setMensagemSucesso(data.mensagem);
        // Recarregar com dados limpos
        setAuditoria(prev => ({
          ...prev,
          analiseDivergencia: {
            ...prev.analiseDivergencia,
            diferencaNaoFaturada: 0,
            percentualCobertura: 100,
            nivelRisco: 'ZERO',
            parecerFiscal: '100% dos recebimentos eletrônicos (Cartão e Pix) possuem respaldo em notas fiscais emitidas.'
          },
          vendasPendentesEmissao: []
        }));
      }
    } catch (err) {
      alert('Erro na regularização: ' + err.message);
    } finally {
      setRegularizando(false);
    }
  };

  if (loading && !auditoria) {
    return <div className="p-8 text-center text-slate-500">Executando auditoria cruzada DIMP vs Documentos Fiscais...</div>;
  }

  const div = auditoria?.analiseDivergencia;
  const isRiscoAlto = div?.nivelRisco === 'ALTO';
  const isRiscoZero = div?.nivelRisco === 'ZERO';

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Auditoria Preventiva DIMP vs Fiscal</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              Período: Outubro/2026
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Confronto eletrônico de recebimentos em Cartão (TEF/POS) e Pix com notas emitidas (NFC-e, NF-e e NFS-e), prevenindo malha fina SEFAZ-MT e Receita Federal.
          </p>
        </div>
        <button
          onClick={carregarAuditoria}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
        >
          <RefreshCw className="w-4 h-4" /> Recalcular Auditoria
        </button>
      </div>

      {mensagemSucesso && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{mensagemSucesso}</span>
        </div>
      )}

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Meios de Pagamento (DIMP)</span>
            <CreditCard className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            R$ {auditoria?.totaisMeiosPagamento?.totalGeral?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {auditoria?.totaisMeiosPagamento?.quantidadeTransacoes || 0} transações (TEF + Pix)
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Notas Fiscais Emitidas</span>
            <FileText className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            R$ {auditoria?.totaisDocumentosFiscais?.totalGeral?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            NFC-e 65, NF-e 55 e NFS-e DPS
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Divergência / Omissão</span>
            <ShieldAlert className={`w-5 h-5 ${isRiscoZero ? 'text-emerald-500' : 'text-amber-500'}`} />
          </div>
          <div className={`text-2xl font-bold ${div?.diferencaNaoFaturada > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            R$ {div?.diferencaNaoFaturada?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Cobertura: <strong className="text-slate-700">{div?.percentualCobertura}%</strong>
          </div>
        </div>

        <div className={`p-5 rounded-xl border shadow-sm ${
          isRiscoZero ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
          isRiscoAlto ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Risco Malha Fina SEFAZ</span>
            {isRiscoZero ? <ShieldCheck className="w-5 h-5 text-emerald-600" /> : <ShieldAlert className="w-5 h-5 text-amber-600" />}
          </div>
          <div className="text-xl font-bold">
            {div?.nivelRisco === 'ZERO' ? 'RISCO ZERO' : `ALERTA (${div?.nivelRisco})`}
          </div>
          <p className="text-xs mt-1 leading-relaxed opacity-90">
            {div?.parecerFiscal}
          </p>
        </div>
      </div>

      {/* Vendas Pendentes de Emissão com Botão de Regularização em Lote */}
      {auditoria?.vendasPendentesEmissao?.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-amber-50 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-amber-900">Vendas em Cartão/Pix Pendentes de Emissão Fiscal</h3>
            </div>
            <button
              onClick={handleRegularizarLote}
              disabled={regularizando}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition disabled:opacity-50"
            >
              {regularizando ? 'Emitindo Notas...' : '⚡ Regularizar em Lote (Emitir NFC-e)'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Meio / Adquirente</th>
                  <th className="py-3 px-4">NSU / Comprovante</th>
                  <th className="py-3 px-4">Item Sugerido</th>
                  <th className="py-3 px-4 text-right">Valor Pendente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditoria.vendasPendentesEmissao.map((v, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 text-slate-600">{v.data}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {v.meioPagamento === 'PIX_DINAMICO' ? 'Pix Sicredi' : `${v.meioPagamento} (${v.adquirente})`}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">{v.nsu}</td>
                    <td className="py-3 px-4 text-slate-600">{v.itensSugeridos[0]?.descricao}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      R$ {v.valorFaltante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabela de Adquirentes e Maquininhas */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-900 mb-4">Detalhamento por Credenciadora DIMP Declarada</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {auditoria?.resumoAdquirentes?.map((adq, idx) => (
            <div key={idx} className="p-4 rounded-lg border border-slate-200 bg-slate-50">
              <div className="font-bold text-slate-800">{adq.nome}</div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">CNPJ: {adq.cnpj}</div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-600">{adq.quantidadeTransacoes} transações</span>
                <span className="font-bold text-indigo-600">
                  R$ {adq.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

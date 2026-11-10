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

  const [flagEmissaoManual, setFlagEmissaoManual] = useState(false);
  const [modalItemEmitir, setModalItemEmitir] = useState(null);

  const handleEmitirItemIndividual = async (item) => {
    if (!flagEmissaoManual) {
      alert("Ative a flag de confirmação para autorizar a emissão individual.");
      return;
    }
    setRegularizando(true);
    try {
      const token = localStorage.getItem('sp_token') || localStorage.getItem('token');
      const res = await fetch('/api/admin/dimp-auditoria/regularizar-lote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ 
          itens: [item],
          confirmacaoManualExplicita: true 
        })
      });
      const data = await res.json();
      if (data.sucesso) {
        setMensagemSucesso(`NFC-e emitida com sucesso para NSU ${item.nsu} (R$ ${item.valorFaltante.toFixed(2)})`);
        setAuditoria(prev => ({
          ...prev,
          vendasPendentesEmissao: prev.vendasPendentesEmissao.filter(v => v.nsu !== item.nsu)
        }));
        setModalItemEmitir(null);
      } else {
        alert("Erro na emissão: " + (data.erro || "Rejeição SEFAZ"));
      }
    } catch (err) {
      alert("Erro na emissão individual: " + err.message);
    } finally {
      setRegularizando(false);
    }
  };

  if (loading && !auditoria) {
    return <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Executando auditoria cruzada DIMP vs Documentos Fiscais...</div>;
  }

  const div = auditoria?.analiseDivergencia;
  const isRiscoZero = div?.nivelRisco === 'ZERO';
  const isRiscoAlto = div?.nivelRisco === 'ALTO';

  return (
    <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Cabeçalho */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>🛡️ Auditoria Preventiva DIMP vs Fiscal</h2>
            <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: '#dbeafe', color: '#1e40af' }}>
              Período: Outubro/2026
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '6px 0 0 0' }}>
            Confronto eletrônico de recebimentos em Cartão (TEF/POS) e Pix com notas emitidas (NFC-e, NF-e e NFS-e), prevenindo malha fina SEFAZ-MT e Receita Federal.
          </p>
        </div>
        <button
          onClick={carregarAuditoria}
          style={{ padding: '10px 16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw style={{ width: '16px', height: '16px' }} /> Recalcular Auditoria
        </button>
      </div>

      {mensagemSucesso && (
        <div style={{ padding: '14px 18px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', color: '#065f46', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 style={{ width: '20px', height: '20px', flexShrink: 0 }} />
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {/* Grid de 4 Cards de Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Meios de Pagamento (DIMP)</span>
            <CreditCard style={{ width: '20px', height: '20px', color: '#6366f1' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
            R$ {auditoria?.totaisMeiosPagamento?.totalGeral?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {auditoria?.totaisMeiosPagamento?.quantidadeTransacoes || 0} transações (TEF + Pix)
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notas Fiscais Emitidas</span>
            <FileText style={{ width: '20px', height: '20px', color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
            R$ {auditoria?.totaisDocumentosFiscais?.totalGeral?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            NFC-e 65, NF-e 55 e NFS-e DPS
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Divergência / Omissão</span>
            <ShieldAlert style={{ width: '20px', height: '20px', color: isRiscoZero ? '#10b981' : '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: div?.diferencaNaoFaturada > 0 ? '#d97706' : '#059669' }}>
            R$ {div?.diferencaNaoFaturada?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Cobertura Fiscal: <strong>{div?.percentualCobertura}%</strong>
          </div>
        </div>

        <div style={{
          padding: '20px',
          borderRadius: '12px',
          border: isRiscoZero ? '1px solid #a7f3d0' : '1px solid #fde68a',
          background: isRiscoZero ? '#ecfdf5' : '#fffbeb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: isRiscoZero ? '#065f46' : '#92400e' }}>
              Risco Malha Fina SEFAZ
            </span>
            {isRiscoZero ? <ShieldCheck style={{ width: '20px', height: '20px', color: '#059669' }} /> : <ShieldAlert style={{ width: '20px', height: '20px', color: '#d97706' }} />}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: isRiscoZero ? '#065f46' : '#92400e' }}>
            {div?.nivelRisco === 'ZERO' ? 'RISCO ZERO' : `ALERTA (${div?.nivelRisco})`}
          </div>
          <div style={{ fontSize: '12px', color: isRiscoZero ? '#047857' : '#b45309', marginTop: '4px', lineHeight: 1.4 }}>
            {div?.parecerFiscal}
          </div>
        </div>
      </div>

      {/* Tabela de Vendas Pendentes de Emissão Fiscal */}
      {auditoria?.vendasPendentesEmissao?.length > 0 && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #fde68a', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', background: '#fffbeb', borderBottom: '1px solid #fef3c7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldAlert style={{ width: '20px', height: '20px', color: '#d97706' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#92400e', margin: 0 }}>
                Vendas em Cartão/Pix Pendentes de Emissão Fiscal
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#ffffff',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                fontWeight: 600,
                color: '#475569'
              }}>
                <input
                  type="checkbox"
                  id="flag-manual-dimp"
                  checked={flagEmissaoManual}
                  onChange={(e) => setFlagEmissaoManual(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="flag-manual-dimp" style={{ cursor: 'pointer' }}>
                  Permitir emissão individual assistida (Trava Anti-Lote ativa)
                </label>
              </div>
              <div style={{
                padding: '8px 14px',
                background: '#f1f5f9',
                color: '#475569',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid #e2e8f0'
              }}>
                🔒 Emissão em Lote Desativada
              </div>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead style={{ background: '#f8fafc', color: '#475569', fontWeight: 700 }}>
              <tr>
                <th style={{ padding: '12px 16px' }}>Data</th>
                <th style={{ padding: '12px 16px' }}>Meio / Adquirente</th>
                <th style={{ padding: '12px 16px' }}>NSU / Comprovante</th>
                <th style={{ padding: '12px 16px' }}>Item Sugerido</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Valor Pendente</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Ação Fiscal</th>
              </tr>
            </thead>
            <tbody>
              {auditoria.vendasPendentesEmissao.map((v, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{v.data}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e293b' }}>
                    {v.meioPagamento === 'PIX_DINAMICO' ? 'Pix Sicredi' : `${v.meioPagamento} (${v.adquirente})`}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#64748b' }}>{v.nsu}</td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>{v.itensSugeridos[0]?.descricao}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                    R$ {v.valorFaltante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleEmitirItemIndividual(v)}
                      disabled={!flagEmissaoManual || regularizando}
                      style={{
                        padding: '6px 12px',
                        background: flagEmissaoManual ? '#0284c7' : '#e2e8f0',
                        color: flagEmissaoManual ? '#ffffff' : '#94a3b8',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: flagEmissaoManual ? 'pointer' : 'not-allowed'
                      }}
                    >
                      Emitir Avulsa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detalhamento por Credenciadora DIMP */}
      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 16px 0' }}>
          Detalhamento por Credenciadora DIMP Declarada à SEFAZ
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
          {auditoria?.resumoAdquirentes?.map((adq, idx) => (
            <div key={idx} style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '15px' }}>{adq.nome}</div>
              <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', marginTop: '2px' }}>CNPJ: {adq.cnpj}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>{adq.quantidadeTransacoes} transações</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#4f46e5' }}>
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

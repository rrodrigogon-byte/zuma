import React, { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, ShieldCheck, CreditCard, FileText, RefreshCw, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';

const MESES = [
  { valor: '01', nome: 'Janeiro' },
  { valor: '02', nome: 'Fevereiro' },
  { valor: '03', nome: 'Março' },
  { valor: '04', nome: 'Abril' },
  { valor: '05', nome: 'Maio' },
  { valor: '06', nome: 'Junho' },
  { valor: '07', nome: 'Julho' },
  { valor: '08', nome: 'Agosto' },
  { valor: '09', nome: 'Setembro' },
  { valor: '10', nome: 'Outubro' },
  { valor: '11', nome: 'Novembro' },
  { valor: '12', nome: 'Dezembro' },
];

export default function DimpAuditoriaTab() {
  const { empresaAtiva } = useAuth();
  const agora = new Date();
  const [mes, setMes] = useState(String(agora.getMonth() + 1).padStart(2, '0'));
  const [ano, setAno] = useState(String(agora.getFullYear()));
  const [loading, setLoading] = useState(false);
  const [auditoria, setAuditoria] = useState(null);
  const [regularizando, setRegularizando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');
  const [flagEmissaoManual, setFlagEmissaoManual] = useState(false);
  const [modalItemEmitir, setModalItemEmitir] = useState(null);

  const carregarAuditoria = useCallback(async () => {
    setLoading(true);
    setMensagemErro('');
    try {
      const data = await api.get(`/api/admin/dimp-auditoria/auditar?mes=${encodeURIComponent(mes)}&ano=${encodeURIComponent(ano)}`);
      if (data?.sucesso) {
        setAuditoria(data);
      } else {
        setMensagemErro(data?.erro || 'Não foi possível carregar a auditoria DIMP.');
      }
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao carregar auditoria DIMP.');
    } finally {
      setLoading(false);
    }
  }, [mes, ano, empresaAtiva?.id]);

  useEffect(() => {
    carregarAuditoria();
  }, [carregarAuditoria]);

  const abrirConfirmacaoIndividual = (item) => {
    setMensagemErro('');
    setMensagemSucesso('');
    if (!flagEmissaoManual) {
      setMensagemErro('Marque a caixa de confirmação individual antes de abrir a validação assistida.');
      return;
    }
    setModalItemEmitir(item);
  };

  const confirmarEmissaoIndividualHomologacao = async () => {
    if (!modalItemEmitir) return;
    setRegularizando(true);
    setMensagemErro('');
    try {
      const data = await api.post('/api/admin/dimp-auditoria/regularizar-lote', {
        itens: [modalItemEmitir],
        confirmacaoManualExplicita: true,
        tpAmb: 2,
      });
      if (data?.sucesso) {
        setMensagemSucesso(
          data.mensagem ||
          `Documento validado em Homologação (tpAmb=2) para NSU ${modalItemEmitir.nsu} (R$ ${Number(modalItemEmitir.valorFaltante || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`
        );
        setAuditoria((prev) => prev ? ({
          ...prev,
          vendasPendentesEmissao: (prev.vendasPendentesEmissao || []).filter((v) => v.nsu !== modalItemEmitir.nsu),
        }) : prev);
        setModalItemEmitir(null);
      } else {
        setMensagemErro(data?.erro || 'Não foi possível concluir a validação individual.');
      }
    } catch (err) {
      setMensagemErro(err.message || 'Falha na validação individual.');
    } finally {
      setRegularizando(false);
    }
  };

  if (loading && !auditoria) {
    return <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Executando auditoria cruzada DIMP vs Documentos Fiscais da empresa ativa...</div>;
  }

  const div = auditoria?.analiseDivergencia;
  const isRiscoZero = div?.nivelRisco === 'ZERO';
  const nomeMes = MESES.find((m) => m.valor === mes)?.nome || mes;

  return (
    <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Auditoria Preventiva DIMP vs Fiscal</h2>
            <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: '#dbeafe', color: '#1e40af' }}>
              Competência: {nomeMes}/{ano}
            </span>
            <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: '#fef3c7', color: '#92400e' }}>
              Ambiente Seguro: Homologação (tpAmb=2)
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '6px 0 0 0' }}>
            Confronto eletrônico dos recebimentos em Cartão (TEF/POS) e Pix da empresa ativa ({empresaAtiva?.nome || 'Empresa'}) com as notas emitidas (NFC-e, NF-e e NFS-e).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <select
            aria-label="Mês de competência"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
          >
            {MESES.map((m) => (
              <option key={m.valor} value={m.valor}>{m.nome}</option>
            ))}
          </select>
          <select
            aria-label="Ano de competência"
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
          <button
            type="button"
            onClick={carregarAuditoria}
            disabled={loading}
            style={{ padding: '10px 16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw style={{ width: '16px', height: '16px' }} /> Recalcular Auditoria
          </button>
        </div>
      </div>

      {mensagemSucesso && (
        <div role="status" style={{ padding: '14px 18px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', color: '#065f46', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 style={{ width: '20px', height: '20px', flexShrink: 0 }} />
            <span>{mensagemSucesso}</span>
          </div>
          <button type="button" onClick={() => setMensagemSucesso('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46' }}>
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      )}

      {mensagemErro && (
        <div role="alert" style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle style={{ width: '20px', height: '20px', flexShrink: 0 }} />
            <span>{mensagemErro}</span>
          </div>
          <button type="button" onClick={() => setMensagemErro('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Meios de Pagamento (DIMP)</span>
            <CreditCard style={{ width: '20px', height: '20px', color: '#6366f1' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
            R$ {(auditoria?.totaisMeiosPagamento?.totalGeral || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {auditoria?.totaisMeiosPagamento?.quantidadeTransacoes || 0} transações eletrônicas no período
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notas Fiscais Emitidas</span>
            <FileText style={{ width: '20px', height: '20px', color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
            R$ {(auditoria?.totaisDocumentosFiscais?.totalGeral || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {auditoria?.totaisDocumentosFiscais?.quantidadeDocumentos || 0} documento(s) (NFC-e 65, NF-e 55 e NFS-e)
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Divergência / Omissão</span>
            <ShieldAlert style={{ width: '20px', height: '20px', color: isRiscoZero ? '#10b981' : '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: div?.diferencaNaoFaturada > 0 ? '#d97706' : '#059669' }}>
            R$ {(div?.diferencaNaoFaturada || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Cobertura Fiscal: <strong>{div?.percentualCobertura ?? 0}%</strong>
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
              Conformidade SEFAZ
            </span>
            {isRiscoZero ? <ShieldCheck style={{ width: '20px', height: '20px', color: '#059669' }} /> : <ShieldAlert style={{ width: '20px', height: '20px', color: '#d97706' }} />}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: isRiscoZero ? '#065f46' : '#92400e' }}>
            {div?.nivelRisco === 'ZERO' ? 'CONCILIADO' : `REVISÃO (${div?.nivelRisco})`}
          </div>
          <div style={{ fontSize: '12px', color: isRiscoZero ? '#047857' : '#b45309', marginTop: '4px', lineHeight: 1.4 }}>
            {div?.parecerFiscal}
          </div>
        </div>
      </div>

      {auditoria?.vendasPendentesEmissao?.length > 0 && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #fde68a', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', background: '#fffbeb', borderBottom: '1px solid #fef3c7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldAlert style={{ width: '20px', height: '20px', color: '#d97706' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#92400e', margin: 0 }}>
                Operações Eletrônicas Pendentes de Revisão Individual
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#ffffff',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={flagEmissaoManual}
                  onChange={(e) => setFlagEmissaoManual(e.target.checked)}
                />
                <span>Habilitar validação individual em Homologação (tpAmb=2)</span>
              </label>
              <div style={{
                padding: '8px 14px',
                background: '#f1f5f9',
                color: '#475569',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid #e2e8f0'
              }}>
                Emissão em Lote Bloqueada
              </div>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead style={{ background: '#f8fafc', color: '#475569', fontWeight: 700 }}>
              <tr>
                <th style={{ padding: '12px 16px' }}>Data</th>
                <th style={{ padding: '12px 16px' }}>Meio / Adquirente</th>
                <th style={{ padding: '12px 16px' }}>Identificador</th>
                <th style={{ padding: '12px 16px' }}>Descrição da Operação</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Valor (R$)</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Ação Individual</th>
              </tr>
            </thead>
            <tbody>
              {auditoria.vendasPendentesEmissao.map((v, i) => (
                <tr key={v.nsu || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{v.data}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e293b' }}>
                    {v.meioPagamento === 'PIX_DINAMICO' ? 'Pix' : `${v.meioPagamento} (${v.adquirente})`}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#64748b' }}>{v.nsu}</td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>{v.itensSugeridos?.[0]?.descricao || 'Operação eletrônica'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                    R$ {Number(v.valorFaltante || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => abrirConfirmacaoIndividual(v)}
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
                      Revisar & Validar (Homologação)
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 16px 0' }}>
          Detalhamento por Credenciadora DIMP no Período
        </h3>
        {auditoria?.resumoAdquirentes?.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
            {auditoria.resumoAdquirentes.map((adq, idx) => (
              <div key={idx} style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '15px' }}>{adq.nome}</div>
                <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', marginTop: '2px' }}>CNPJ: {adq.cnpj}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>{adq.quantidadeTransacoes} transações</span>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#4f46e5' }}>
                    R$ {Number(adq.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
            Nenhuma transação eletrônica de adquirente registrada para {nomeMes}/{ano} nesta empresa.
          </div>
        )}
      </div>

      {modalItemEmitir && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', maxWidth: '520px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
              Confirmar Validação Individual em Homologação
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
              Confira os dados da operação antes de confirmar. Esta validação é executada exclusivamente em <strong>Homologação (tpAmb=2)</strong>, sem transmissão em lote para produção.
            </p>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              <div><strong>Empresa:</strong> {empresaAtiva?.nome || auditoria?.empresaId}</div>
              <div><strong>Data da Operação:</strong> {modalItemEmitir.data}</div>
              <div><strong>Identificador / NSU:</strong> {modalItemEmitir.nsu}</div>
              <div><strong>Meio de Pagamento:</strong> {modalItemEmitir.meioPagamento} ({modalItemEmitir.adquirente})</div>
              <div><strong>Descrição:</strong> {modalItemEmitir.itensSugeridos?.[0]?.descricao || 'Operação comercial'}</div>
              <div><strong>Valor:</strong> R$ {Number(modalItemEmitir.valorFaltante || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div><strong>Ambiente SEFAZ:</strong> 2 — Homologação (Sem valor fiscal)</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setModalItemEmitir(null)}
                disabled={regularizando}
                style={{ padding: '9px 16px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEmissaoIndividualHomologacao}
                disabled={regularizando}
                style={{ padding: '9px 16px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                {regularizando ? 'Validando...' : 'Confirmar em Homologação (tpAmb=2)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

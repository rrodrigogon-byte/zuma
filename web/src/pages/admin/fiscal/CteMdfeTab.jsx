import React, { useState, useEffect } from 'react';
import { Truck, FileCheck2, ShieldCheck, Plus, CheckCircle2, MapPin, Package } from 'lucide-react';

export default function CteMdfeTab() {
  const [painel, setPainel] = useState({ ctes: [], mdfes: [], resumo: {} });
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [novoCte, setNovoCte] = useState({
    produtoPredominante: 'SOJA EM GRAOS COMERCIAL A GRANEL',
    pesoBrutoKg: 36600,
    valorCarga: 76425.38,
    valorFrete: 4850.00,
    placaTracao: 'QBP4A88',
    motoristaNome: 'Valdir Aparecido dos Santos',
    ufInicio: 'MT',
    ufFim: 'MT'
  });

  const carregar = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sp_token') || localStorage.getItem('token');
      const res = await fetch('/api/admin/cte-mdfe/painel', {
        headers: { Authorization: 'Bearer ' + token }
      });
      const d = await res.json();
      if (d.sucesso) setPainel(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const handleEmitirCte = async (e) => {
    e.preventDefault();
    setMensagem('');
    try {
      const token = localStorage.getItem('sp_token') || localStorage.getItem('token');
      const res = await fetch('/api/admin/cte-mdfe/cte/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(novoCte)
      });
      const d = await res.json();
      if (d.sucesso) {
        setMensagem(`CT-e Modelo 57 nº ${d.cte.numero} autorizado na SEFAZ-MT! Chave: ${d.cte.chaveAcesso}`);
        carregar();
      }
    } catch (err) {
      alert('Erro ao emitir CT-e: ' + err.message);
    }
  };

  const handleEmitirMdfe = async () => {
    setMensagem('');
    try {
      const token = localStorage.getItem('sp_token') || localStorage.getItem('token');
      const res = await fetch('/api/admin/cte-mdfe/mdfe/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          placaTracao: novoCte.placaTracao,
          motoristaNome: novoCte.motoristaNome,
          pesoTotalKg: novoCte.pesoBrutoKg,
          valorTotalCarga: novoCte.valorCarga,
          documentosVinculados: painel.ctes.slice(0, 2).map(c => c.chaveAcesso)
        })
      });
      const d = await res.json();
      if (d.sucesso) {
        setMensagem(`MDF-e Modelo 58 nº ${d.mdfe.numero} emitido e em trânsito! Protocolo: ${d.mdfe.protocoloAutorizacao}`);
        carregar();
      }
    } catch (err) {
      alert('Erro ao emitir MDF-e: ' + err.message);
    }
  };

  const handleEncerrarMdfe = async (id) => {
    try {
      const token = localStorage.getItem('sp_token') || localStorage.getItem('token');
      const res = await fetch(`/api/admin/cte-mdfe/mdfe/${id}/encerrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ municipioEncerramento: '5107602', ufEncerramento: 'MT' })
      });
      const d = await res.json();
      if (d.sucesso) {
        setMensagem(`MDF-e nº ${d.mdfe.numero} encerrado na SEFAZ-MT (Evento 110112) — Protocolo: ${d.mdfe.protocoloEncerramento}`);
        carregar();
      }
    } catch (err) {
      alert('Erro ao encerrar MDF-e: ' + err.message);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Truck style={{ width: '24px', height: '24px', color: '#2563eb' }} />
            CT-e (Modelo 57) & MDF-e (Modelo 58) — SEFAZ-MT
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '6px 0 0 0' }}>
            Conhecimento de Transporte Eletrônico (leiaute 4.00) e Manifesto Eletrônico de Documentos Fiscais (leiaute 3.00) com RNTRC, CIOT e Evento 110112 de Encerramento.
          </p>
        </div>
        <button
          onClick={handleEmitirMdfe}
          style={{ padding: '10px 18px', background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus style={{ width: '16px', height: '16px' }} /> Gerar Manifesto MDF-e (58)
        </button>
      </div>

      {mensagem && (
        <div style={{ padding: '14px 18px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', color: '#065f46', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 style={{ width: '20px', height: '20px' }} />
          <span>{mensagem}</span>
        </div>
      )}

      {/* Formulário Rápido Emissão CT-e 57 */}
      <form onSubmit={handleEmitirCte} style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>PRODUTO PREDOMINANTE</label>
          <input value={novoCte.produtoPredominante} onChange={e => setNovoCte({ ...novoCte, produtoPredominante: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>PLACA TRAÇÃO / RNTRC</label>
          <input value={novoCte.placaTracao} onChange={e => setNovoCte({ ...novoCte, placaTracao: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>PESO BRUTO (KG)</label>
          <input type="number" value={novoCte.pesoBrutoKg} onChange={e => setNovoCte({ ...novoCte, pesoBrutoKg: Number(e.target.value) })} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>VALOR FRETE (R$)</label>
          <input type="number" step="0.01" value={novoCte.valorFrete} onChange={e => setNovoCte({ ...novoCte, valorFrete: Number(e.target.value) })} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
        </div>
        <button type="submit" style={{ padding: '10px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
          ⚡ Emitir CT-e (57)
        </button>
      </form>

      {/* Lista de CT-es 57 */}
      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 800, color: '#0f172a', fontSize: '14px' }}>
          📄 Conhecimentos de Transporte Eletrônicos Emitidos (CT-e Modelo 57)
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead style={{ background: '#f1f5f9', color: '#475569' }}>
            <tr>
              <th style={{ padding: '10px 16px' }}>Nº / Série</th>
              <th style={{ padding: '10px 16px' }}>Chave de Acesso (44 dígitos)</th>
              <th style={{ padding: '10px 16px' }}>Origem → Destino</th>
              <th style={{ padding: '10px 16px' }}>Placa / Motorista</th>
              <th style={{ padding: '10px 16px', textAlign: 'right' }}>Frete / ICMS</th>
              <th style={{ padding: '10px 16px' }}>Status SEFAZ</th>
            </tr>
          </thead>
          <tbody>
            {painel.ctes.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 16px', fontWeight: 700 }}>#{c.numero} / Série {c.serie}</td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '11px', color: '#334155' }}>{c.chaveAcesso}</td>
                <td style={{ padding: '10px 16px' }}>{c.remetente?.municipio}/{c.remetente?.uf} → {c.destinatario?.municipio}/{c.destinatario?.uf}</td>
                <td style={{ padding: '10px 16px' }}>{c.placaTracao} · {c.motoristaNome}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>
                  R$ {Number(c.valorFrete || 0).toFixed(2)} <span style={{ color: '#64748b', fontSize: '11px' }}>(ICMS R$ {Number(c.valorIcms || 0).toFixed(2)})</span>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>
                    {c.status} ({c.protocoloAutorizacao})
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lista de MDF-es 58 */}
      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 800, color: '#0f172a', fontSize: '14px' }}>
          🚛 Manifestos Eletrônicos de Documentos Fiscais (MDF-e Modelo 58)
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead style={{ background: '#f1f5f9', color: '#475569' }}>
            <tr>
              <th style={{ padding: '10px 16px' }}>Nº / Série</th>
              <th style={{ padding: '10px 16px' }}>Chave MDF-e</th>
              <th style={{ padding: '10px 16px' }}>Percurso</th>
              <th style={{ padding: '10px 16px' }}>CIOT / Placa</th>
              <th style={{ padding: '10px 16px' }}>Status</th>
              <th style={{ padding: '10px 16px', textAlign: 'right' }}>Ação SEFAZ</th>
            </tr>
          </thead>
          <tbody>
            {painel.mdfes.map(m => (
              <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 16px', fontWeight: 700 }}>#{m.numero} / Série {m.serie}</td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '11px', color: '#334155' }}>{m.chaveAcesso}</td>
                <td style={{ padding: '10px 16px' }}>{m.municipioCarregamento} → {m.municipioDescarregamento}</td>
                <td style={{ padding: '10px 16px' }}>CIOT {m.ciot} · {m.placaTracao}</td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ background: m.status === 'ENCERRADO_SEFAZ' ? '#e2e8f0' : '#dbeafe', color: m.status === 'ENCERRADO_SEFAZ' ? '#334155' : '#1e40af', padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>
                    {m.status}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                  {m.status !== 'ENCERRADO_SEFAZ' ? (
                    <button onClick={() => handleEncerrarMdfe(m.id)} style={{ padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                      Encerrar MDF-e (110112)
                    </button>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>✓ Encerrado ({m.protocoloEncerramento})</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

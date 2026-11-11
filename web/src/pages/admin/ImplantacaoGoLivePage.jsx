import React, { useState, useEffect } from 'react';
import { Rocket, CheckCircle2, ShieldCheck, Server, Terminal, RefreshCw, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ImplantacaoGoLivePage() {
  const [painel, setPainel] = useState(null);
  const [loading, setLoading] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sp_token') || localStorage.getItem('token');
      const res = await fetch('/api/admin/implantacao/status', {
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

  return (
    <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ background: '#0f172a', color: '#ffffff', padding: '28px', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
            Governança de Go-Live · SaaS Cloud & On-Premise
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Rocket style={{ width: '28px', height: '28px', color: '#38bdf8' }} />
            Central de Implantação Guiada & Homologação (10 Etapas)
          </h1>
          <p style={{ fontSize: '14px', color: '#cbd5e1', margin: '8px 0 0 0' }}>
            Auditoria em tempo real dos requisitos de produção: Emitente SEFAZ-MT, Certificado A1 ICP-Brasil, NF-e 55, NFC-e 65, Contingência Zero, TEF, PIX, Agro e CT-e/MDF-e.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>ÍNDICE DE IMPLANTAÇÃO</div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#34d399' }}>
              {painel ? `${painel.percentualImplantacao}%` : '...'}
            </div>
          </div>
          <button
            onClick={carregar}
            disabled={loading}
            style={{ padding: '10px 16px', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw style={{ width: '16px', height: '16px' }} /> Atualizar Checklist
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
        {(painel?.etapas || []).map((et) => (
          <div key={et.ordem} style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: et.concluida ? '1px solid #a7f3d0' : '1px solid #fde68a', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: et.concluida ? '#dcfce7' : '#fef3c7', color: et.concluida ? '#166534' : '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px' }}>
                  {et.ordem}
                </span>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{et.titulo}</h3>
              </div>
              <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, background: et.concluida ? '#dcfce7' : '#fef3c7', color: et.concluida ? '#166534' : '#92400e' }}>
                {et.concluida ? '✓ HOMOLOGADO' : 'EM CONFIGURAÇÃO'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>{et.detalhe}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Link to={et.acaoUrl || '/admin'} style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Acessar módulo <ExternalLink style={{ width: '13px', height: '13px' }} />
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: '#ffffff', padding: '22px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal style={{ width: '18px', height: '18px', color: '#0f172a' }} />
          Instalador Automatizado On-Premise & Agente Local (PDV / Balança / Pinpad TEF)
        </h3>
        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748b' }}>
          Para implantação local em servidor dedicado ou terminal de caixa com balança Toledo/Filizola e Pinpad USB/Serial:
        </p>
        <pre style={{ margin: 0, padding: '14px', background: '#0f172a', color: '#38bdf8', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace', overflowX: 'auto' }}>
          bash bin/kytto-install-onpremise.sh --empresa-id d0d0ac01-8e50-4b61-8c79-de4aaa916da6 --enable-tef-agent --enable-balanca-serial
        </pre>
      </div>
    </div>
  );
}

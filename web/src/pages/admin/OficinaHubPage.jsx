import React, { useState, useEffect } from 'react';

export default function OficinaHubPage() {
  const [ordens, setOrdens] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buscaPlaca, setBuscaPlaca] = useState('');
  const [mensagemSucesso, setMensagemSucesso] = useState('');

  const token = localStorage.getItem('token') || localStorage.getItem('sp_token');

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(false);
    try {
      const resOs = await fetch('/api/admin/oficina/os', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataOs = await resOs.json();
      if (dataOs.ok) setOrdens(dataOs.ordens || []);

      const resVeic = await fetch('/api/admin/oficina/veiculos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataVeic = await resVeic.json();
      if (dataVeic.ok) setVeiculos(dataVeic.veiculos || []);
    } catch (e) {
      console.error('Erro ao carregar dados da oficina:', e);
    }
  }

  async function dispararWhatsApp(id) {
    try {
      const res = await fetch(`/api/admin/oficina/os/${id}/enviar-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.ok) {
        setMensagemSucesso(data.mensagem);
        setTimeout(() => setMensagemSucesso(''), 6000);
      }
    } catch (e) {
      alert('Erro ao disparar WhatsApp');
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header Corporativo */}
      <div style={{ background: '#0F172A', color: '#F8FAFC', padding: '24px', borderRadius: '12px', marginBottom: '24px', borderLeft: '6px solid #F59E0B' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>🚗</span> Hub de Oficinas Mecânicas, Autopeças & Ordem de Serviço
            </h1>
            <p style={{ margin: '8px 0 0 0', color: '#94A3B8', fontSize: '0.9rem' }}>
              Controle de Placa, Chassi, Renavam, Garantia de Peças, Checklist com Fotos e Aprovação Interativa no WhatsApp.
            </p>
          </div>
          <div>
            <span style={{ background: '#1E293B', padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155', color: '#FBBF24', fontWeight: 700, fontSize: '0.9rem' }}>
              🛠️ SetPoint Ultra / Kytto Auto
            </span>
          </div>
        </div>
      </div>

      {mensagemSucesso && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '16px 20px', borderRadius: '8px', color: '#065F46', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>📲</span> {mensagemSucesso}
        </div>
      )}

      {/* Grid de Ordens de Serviço */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {ordens.map((os) => (
          <div key={os.id} style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '22px', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
              <div>
                <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: '0.75rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>
                  {os.numeroOs}
                </span>
                <h3 style={{ margin: '6px 0 0 0', fontSize: '1.15rem', color: '#0F172A', fontWeight: 700 }}>
                  {os.veiculoDescricao}
                </h3>
                <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '4px' }}>
                  Placa: <strong style={{ color: '#0F172A', fontFamily: 'monospace', fontSize: '0.95rem' }}>{os.placa}</strong> | KM: <strong>{os.kmAtual.toLocaleString('pt-BR')} km</strong>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ background: os.status === 'APROVADO_WHATSAPP' ? '#DCFCE7' : '#E0F2FE', color: os.status === 'APROVADO_WHATSAPP' ? '#15803D' : '#0369A1', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '12px' }}>
                  {os.status}
                </span>
              </div>
            </div>

            {/* Dados do Cliente */}
            <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 600, color: '#334155' }}>Cliente: {os.clienteNome}</div>
              <div style={{ color: '#64748B' }}>WhatsApp: {os.clienteTelefone} | Mecânico: {os.mecanicoResponsavel}</div>
              <div style={{ color: '#64748B', marginTop: '4px', fontStyle: 'italic' }}>"{os.reclamacaoCliente}"</div>
            </div>

            {/* Resumo de Peças e Mão de Obra */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                Peças Aplicadas ({os.itensPecas.length})
              </div>
              {os.itensPecas.map((p, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', padding: '4px 0', borderBottom: '1px dashed #F1F5F9' }}>
                  <span style={{ color: '#334155' }}>{p.quantidade}x {p.descricao}</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>R$ {p.valorTotal.toFixed(2)}</span>
                </div>
              ))}

              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginTop: '10px', marginBottom: '6px' }}>
                Serviços Executados ({os.itensServicos.length})
              </div>
              {os.itensServicos.map((s, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', padding: '4px 0', borderBottom: '1px dashed #F1F5F9' }}>
                  <span style={{ color: '#334155' }}>{s.descricao}</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>R$ {s.valor.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Totalizador & Ações */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #E2E8F0', paddingTop: '14px', marginTop: '10px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Garantia Oficial: {os.garantiaMeses} meses</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16A34A' }}>
                  R$ {os.valorTotal.toFixed(2)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => dispararWhatsApp(os.id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#25D366',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>📲</span> Disparar Aprovação WhatsApp
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Card de Cadastro e Histórico Veicular */}
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '22px' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '1.15rem', color: '#0F172A', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔍</span> Histórico Veicular & Garantias por Placa
          </h3>
          <p style={{ margin: '0 0 14px 0', fontSize: '0.85rem', color: '#64748B' }}>
            Consulte o histórico de manutenção, trocas de óleo, peças instaladas e vigência de garantias por placa ou chassi:
          </p>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="Digite a Placa (ex: RNI4E29)"
              value={buscaPlaca}
              onChange={(e) => setBuscaPlaca(e.target.value.toUpperCase())}
              style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontFamily: 'monospace', fontWeight: 700 }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {veiculos.map((v) => (
              <div key={v.id} style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                    {v.placa}
                  </span>
                  <span style={{ background: '#E2E8F0', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600 }}>
                    {v.totalOs} Ordens de Serviço
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginTop: '4px' }}>
                  {v.marca} {v.modelo} ({v.anoModelo})
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Chassi: {v.chassi} | Renavam: {v.renavam}</div>

                {v.historicoGarantias && v.historicoGarantias.length > 0 && (
                  <div style={{ marginTop: '10px', borderTop: '1px solid #E2E8F0', paddingTop: '8px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803D' }}>Garantias Vigentes:</div>
                    {v.historicoGarantias.map((g, idx) => (
                      <div key={idx} style={{ fontSize: '0.75rem', color: '#475569' }}>
                        • {g.peca} ({g.garantiaMeses} meses até {g.dataInstalacao})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

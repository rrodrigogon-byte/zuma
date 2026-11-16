import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function OrdemServicoAprovacaoPublico() {
  const { id } = useParams();
  const [os, setOs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aprovando, setAprovando] = useState(false);
  const [sucessoAprovacao, setSucessoAprovacao] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregarOs();
  }, [id]);

  async function carregarOs() {
    setLoading(true);
    try {
      const res = await fetch(`/api/publico/oficina/os/${id || 'os-1042'}`);
      const data = await res.json();
      if (data.ok && data.os) {
        setOs(data.os);
        if (data.os.status === 'APROVADO_WHATSAPP' || data.os.aprovadoPeloWhatsApp) {
          setSucessoAprovacao(true);
        }
      } else {
        setErro('Ordem de Serviço não localizada ou link expirado.');
      }
    } catch (e) {
      setErro('Erro ao carregar o orçamento. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAprovar() {
    setAprovando(true);
    try {
      const res = await fetch(`/api/publico/oficina/os/${os.id}/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origem: 'whatsapp_mobile', timestamp: new Date().toISOString() })
      });
      const data = await res.json();
      if (data.ok) {
        setSucessoAprovacao(true);
        setOs(data.os);
      } else {
        alert('Não foi possível aprovar o orçamento. Entre em contato com a oficina.');
      }
    } catch (e) {
      alert('Erro ao enviar aprovação.');
    } finally {
      setAprovando(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0F172A', color: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔄</div>
          <p>Carregando Orçamento da Oficina...</p>
        </div>
      </div>
    );
  }

  if (erro || !os) {
    return (
      <div style={{ minHeight: '100vh', background: '#0F172A', color: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: '#1E293B', padding: '32px', borderRadius: '12px', maxWidth: '480px', textAlign: 'center', border: '1px solid #334155' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Orçamento não disponível</h2>
          <p style={{ color: '#94A3B8', fontSize: '0.9rem' }}>{erro || 'Não foi possível carregar os dados desta ordem de serviço.'}</p>
        </div>
      </div>
    );
  }

  const totalPecas = (os.itensPecas || []).reduce((acc, p) => acc + (p.valorTotal || 0), 0);
  const listaMaoObra = os.itensServicos || os.itensMaoObra || [];
  const totalMaoObra = listaMaoObra.reduce((acc, m) => acc + (m.valorTotal || m.valor || 0), 0);
  const valorTotalGeral = totalPecas + totalMaoObra;

  return (
    <div style={{ minHeight: '100vh', background: '#0B1120', color: '#F8FAFC', fontFamily: 'system-ui, -apple-system, sans-serif', paddingBottom: '60px' }}>
      {/* Topo Oficial da Oficina */}
      <header style={{ background: '#1E293B', borderBottom: '1px solid #334155', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🛠️ SetPoint Ultra · Kytto Auto
            </span>
            <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF' }}>
              {os.oficinaNome || 'Kytto Auto Center Tangará'}
            </h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              background: sucessoAprovacao ? '#10B981' : '#F59E0B',
              color: '#FFFFFF',
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '20px',
              display: 'inline-block'
            }}>
              {sucessoAprovacao ? '✅ APROVADO' : '⏳ AGUARDANDO ACEITE'}
            </span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '640px', margin: '20px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Banner de Sucesso pós-aprovação */}
        {sucessoAprovacao && (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', borderRadius: '12px', padding: '16px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '4px' }}>🎉</div>
            <h2 style={{ fontSize: '1.15rem', color: '#10B981', fontWeight: 800, margin: '0 0 6px 0' }}>
              Orçamento Aprovado com Sucesso!
            </h2>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#E2E8F0' }}>
              Sua aprovação foi registrada na oficina. A equipe técnica já iniciou a separação das peças e execução dos serviços.
            </p>
          </div>
        )}

        {/* Card do Veículo e Cliente */}
        <section style={{ background: '#1E293B', borderRadius: '12px', padding: '20px', border: '1px solid #334155', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #334155', paddingBottom: '14px', marginBottom: '14px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>Veículo Cadastrado</span>
              <h2 style={{ margin: '2px 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                {os.veiculoDescricao}
              </h2>
              <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>KM Atual: <strong>{os.kmAtual?.toLocaleString('pt-BR')} km</strong></span>
            </div>
            {/* Placa Padrão Mercosul */}
            <div style={{ background: '#FFFFFF', border: '2px solid #003399', borderRadius: '6px', overflow: 'hidden', width: '130px', textAlign: 'center' }}>
              <div style={{ background: '#003399', color: '#FFFFFF', fontSize: '0.55rem', fontWeight: 800, padding: '2px 0' }}>
                BRASIL 🇧🇷
              </div>
              <div style={{ color: '#000000', fontSize: '1.25rem', fontWeight: 900, letterSpacing: '1px', padding: '2px 0' }}>
                {os.placa}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: '#94A3B8', display: 'block' }}>Ordem de Serviço</span>
              <strong style={{ color: '#F8FAFC' }}>{os.numeroOs}</strong>
            </div>
            <div>
              <span style={{ color: '#94A3B8', display: 'block' }}>Cliente</span>
              <strong style={{ color: '#F8FAFC' }}>{os.clienteNome}</strong>
            </div>
            <div>
              <span style={{ color: '#94A3B8', display: 'block' }}>Mecânico Chefe</span>
              <strong style={{ color: '#F8FAFC' }}>{os.mecanicoResponsavel}</strong>
            </div>
            <div>
              <span style={{ color: '#94A3B8', display: 'block' }}>Data da Abertura</span>
              <strong style={{ color: '#F8FAFC' }}>{new Date(os.dataAbertura || Date.now()).toLocaleDateString('pt-BR')}</strong>
            </div>
          </div>

          {os.reclamacaoCliente && (
            <div style={{ marginTop: '14px', background: '#0F172A', padding: '12px 14px', borderRadius: '8px', fontSize: '0.85rem' }}>
              <span style={{ color: '#F59E0B', fontWeight: 700, display: 'block', marginBottom: '4px' }}>📋 Relato do Cliente / Diagnóstico:</span>
              <span style={{ color: '#CBD5E1' }}>{os.reclamacaoCliente}</span>
            </div>
          )}
        </section>

        {/* Peças e Componentes */}
        <section style={{ background: '#1E293B', borderRadius: '12px', padding: '20px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '1rem', fontWeight: 700, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚙️</span> Peças de Reposição Genuínas
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(os.itensPecas || []).map((p, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '8px', fontSize: '0.875rem' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#FFFFFF' }}>{p.descricao}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Qtd: {p.quantidade} un × R$ {Number(p.valorUnitario).toFixed(2)}</div>
                </div>
                <div style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '0.95rem' }}>
                  R$ {Number(p.valorTotal).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.9rem', color: '#94A3B8' }}>
            <span>Subtotal Peças:</span>
            <strong style={{ color: '#FFFFFF' }}>R$ {totalPecas.toFixed(2)}</strong>
          </div>
        </section>

        {/* Serviços e Mão de Obra */}
        <section style={{ background: '#1E293B', borderRadius: '12px', padding: '20px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '1rem', fontWeight: 700, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔧</span> Serviços Especializados & Mão de Obra
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {listaMaoObra.map((m, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '8px', fontSize: '0.875rem' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#FFFFFF' }}>{m.descricao}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Mão de obra técnica qualificada</div>
                </div>
                <div style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '0.95rem' }}>
                  R$ {Number(m.valorTotal || m.valor || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.9rem', color: '#94A3B8' }}>
            <span>Subtotal Mão de Obra:</span>
            <strong style={{ color: '#FFFFFF' }}>R$ {totalMaoObra.toFixed(2)}</strong>
          </div>
        </section>

        {/* Totalizador Geral */}
        <section style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', borderRadius: '12px', padding: '20px', border: '2px solid #F59E0B' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: '#FBBF24', fontWeight: 700, textTransform: 'uppercase' }}>Valor Total do Orçamento</span>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Condições: Pix, Cartão em até 6x ou Faturado</div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#FFFFFF' }}>
              R$ {valorTotalGeral.toFixed(2)}
            </div>
          </div>
          <div style={{ borderTop: '1px solid #334155', marginTop: '14px', paddingTop: '10px', fontSize: '0.75rem', color: '#94A3B8', textAlign: 'center' }}>
            🛡️ {os.garantiaLegal || 'Garantia de 90 dias em todas as peças e serviços.'}
          </div>
        </section>

        {/* Botões de Ação */}
        {!sucessoAprovacao ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={handleAprovar}
              disabled={aprovando}
              style={{
                background: '#10B981',
                color: '#FFFFFF',
                border: 'none',
                padding: '16px',
                borderRadius: '10px',
                fontSize: '1.1rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              {aprovando ? 'Registrando Aprovação...' : '✅ APROVAR ORÇAMENTO PELO WHATSAPP'}
            </button>

            <a
              href={`https://wa.me/556599352260?text=${encodeURIComponent(`Olá! Gostaria de tirar dúvidas sobre o orçamento da ${os.numeroOs} da ${os.veiculoDescricao} (Placa ${os.placa}).`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#25D366',
                color: '#FFFFFF',
                textDecoration: 'none',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '0.95rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                textAlign: 'center'
              }}
            >
              💬 Falar com o Mecânico no WhatsApp
            </a>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <a
              href={`https://wa.me/556599352260?text=${encodeURIComponent(`Olá! Já aprovei a ${os.numeroOs} pelo link oficial.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#25D366', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none' }}
            >
              💬 Acompanhar status pelo WhatsApp da Oficina
            </a>
          </div>
        )}

      </main>
    </div>
  );
}

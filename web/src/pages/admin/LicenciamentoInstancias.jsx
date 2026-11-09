import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Key, 
  Server, 
  Cpu, 
  Layers, 
  CheckCircle, 
  AlertTriangle, 
  PlusCircle, 
  RefreshCw, 
  Lock, 
  Copy,
  Terminal,
  ExternalLink
} from 'lucide-react';
import { api } from '../../lib/api';

export default function LicenciamentoInstancias() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [instancias, setInstancias] = useState(null);
  const [planos, setPlanos] = useState([]);
  const [chaveInput, setChaveInput] = useState('');
  const [ativando, setAtivando] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [copiado, setCopiado] = useState(false);

  // Modal / Formulário de Emissão (apenas visualização / admin global)
  const [abaAtiva, setAbaAtiva] = useState('status'); // 'status', 'instancias', 'onpremise'

  async function carregarDados() {
    setLoading(true);
    setMensagem(null);
    try {
      const [resStatus, resInstancias, resPlanos] = await Promise.all([
        api.get('/api/admin/licenciamento/status'),
        api.get('/api/admin/licenciamento/instancias'),
        api.get('/api/admin/licenciamento/planos')
      ]);
      setStatus(resStatus.data);
      setInstancias(resInstancias.data);
      setPlanos(resPlanos.data?.planos || []);
    } catch (err) {
      console.error('Erro ao carregar licenciamento:', err);
      setMensagem({ tipo: 'erro', texto: 'Erro ao carregar dados de licenciamento.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleAtivarLicenca(e) {
    e.preventDefault();
    if (!chaveInput.trim()) return;
    setAtivando(true);
    setMensagem(null);
    try {
      const res = await api.post('/api/admin/licenciamento/ativar', { chave: chaveInput.trim() });
      setMensagem({ tipo: 'sucesso', texto: 'Chave de licença ativada com sucesso!' });
      setChaveInput('');
      carregarDados();
    } catch (err) {
      setMensagem({ 
        tipo: 'erro', 
        texto: err.response?.data?.error || 'Chave de licença inválida ou com assinatura incorreta.' 
      });
    } finally {
      setAtivando(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  const cotas = instancias?.cotas;

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Topo / Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#ffffff',
        padding: '28px 32px',
        borderRadius: '16px',
        marginBottom: '28px',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
            padding: '14px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
          }}>
            <ShieldCheck size={28} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>
                Licenciamento, Planos & Instâncias Multi-Business
              </h1>
              <span style={{
                background: status?.modoDeploy === 'on-premise' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                color: status?.modoDeploy === 'on-premise' ? '#4ade80' : '#93c5fd',
                padding: '3px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600',
                border: '1px solid rgba(255, 255, 255, 0.15)'
              }}>
                {status?.modoDeploy === 'on-premise' ? '🏢 Sovereign On-Premise' : '☁️ SaaS Multi-Tenant Cloud'}
              </span>
            </div>
            <p style={{ color: '#94a3b8', margin: '6px 0 0 0', fontSize: '14px' }}>
              Gestão de nós, alocação de instâncias de WhatsApp/PDV, cotas e ativação criptográfica de licenças.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={carregarDados}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '10px 18px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <button
          onClick={() => setAbaAtiva('status')}
          style={{
            background: abaAtiva === 'status' ? '#0f172a' : '#f1f5f9',
            color: abaAtiva === 'status' ? '#ffffff' : '#475569',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Visão Geral & Licença
        </button>
        <button
          onClick={() => setAbaAtiva('instancias')}
          style={{
            background: abaAtiva === 'instancias' ? '#0f172a' : '#f1f5f9',
            color: abaAtiva === 'instancias' ? '#ffffff' : '#475569',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Cotas & Instâncias ({instancias?.instancias?.length || 0})
        </button>
        <button
          onClick={() => setAbaAtiva('onpremise')}
          style={{
            background: abaAtiva === 'onpremise' ? '#0f172a' : '#f1f5f9',
            color: abaAtiva === 'onpremise' ? '#ffffff' : '#475569',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Guia de Instalação On-Premise
        </button>
      </div>

      {mensagem && (
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '20px',
          background: mensagem.tipo === 'sucesso' ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${mensagem.tipo === 'sucesso' ? '#a7f3d0' : '#fecaca'}`,
          color: mensagem.tipo === 'sucesso' ? '#065f46' : '#991b1b',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          {mensagem.texto}
        </div>
      )}

      {/* Conteúdo Aba 1: Status & Licença */}
      {abaAtiva === 'status' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          
          {/* Card Detalhes da Licença */}
          <div style={{ background: '#ffffff', padding: '28px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>Plano Contratado</span>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin: '4px 0 0 0' }}>
                  {status?.planoNome || 'Kytto Professional'}
                </h2>
              </div>
              <span style={{
                background: '#dcfce7',
                color: '#15803d',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <CheckCircle size={16} /> Licença Ativa ({status?.diasRestantes || 365} dias)
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Canais WhatsApp</span>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                  {cotas?.whatsapp?.usado || 1} / {cotas?.whatsapp?.limite || 3}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Lojas / Filiais</span>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                  {cotas?.lojas?.usado || 1} / {cotas?.lojas?.limite || 3}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Terminais PDV</span>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                  {cotas?.pdv?.usado || 1} / {cotas?.pdv?.limite || 5}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Usuários Ativos</span>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                  {cotas?.usuarios?.usado || 1} / {cotas?.usuarios?.limite || 20}
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>
                Módulos Habilitados na Chave
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {status?.modulosAtivos?.map((mod, i) => (
                  <span key={i} style={{ background: '#eff6ff', color: '#1d4ed8', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
                    ✓ {mod}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Ativar Chave On-Premise */}
          <div style={{ background: '#ffffff', padding: '28px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={18} color="#2563eb" />
              Ativar Chave de Licença
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0', lineHeight: '1.4' }}>
              Insira a chave criptográfica emitida pela Kytto Global para desbloquear novas cotas ou modo On-Premise Soberano.
            </p>

            <form onSubmit={handleAtivarLicenca}>
              <textarea
                rows="4"
                placeholder="KYTTO-LIC.eyJlbXByZXNhSWQiOi..."
                value={chaveInput}
                onChange={(e) => setChaveInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  marginBottom: '14px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="submit"
                disabled={ativando || !chaveInput.trim()}
                style={{
                  width: '100%',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {ativando ? 'Validando Assinatura...' : 'Ativar Licença'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Conteúdo Aba 2: Cotas e Instâncias */}
      {abaAtiva === 'instancias' && (
        <div style={{ background: '#ffffff', padding: '28px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '16px' }}>
            Instâncias Registradas e Alocadas
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {instancias?.instancias?.map((inst, idx) => (
              <div key={idx} style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>{inst.tipo}</span>
                  <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                    {inst.status}
                  </span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                  {inst.id || inst.nome}
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                  Finalidade: {inst.finalidade || 'Operacional'} · {inst.telefone || 'Ativo'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conteúdo Aba 3: Guia On-Premise */}
      {abaAtiva === 'onpremise' && (
        <div style={{ background: '#ffffff', padding: '28px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={20} color="#2563eb" />
            Implantação Local / On-Premise Soberana (1 Comando)
          </h2>
          <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
            O Kytto ERP pode ser executado em servidores locais da sua empresa, datacenter próprio ou máquina isolada sem depender de serviços externos.
          </p>

          <div style={{ background: '#0f172a', color: '#f8fafc', padding: '20px', borderRadius: '12px', fontFamily: 'monospace', fontSize: '13px', marginBottom: '20px' }}>
            <span style={{ color: '#94a3b8' }}># Para instalar o Kytto ERP On-Premise em qualquer servidor Linux (Ubuntu/Debian/Rocky/RHEL):</span><br/>
            <span style={{ color: '#4ade80' }}>curl -fsSL https://kytto.com.br/install.sh | sudo bash</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>🔒 Conformidade Total LGPD</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Seus dados residem fisicamente dentro das instalações da sua empresa.</p>
            </div>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>⚡ Operação Offline-First</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>O PDV e as comandas operam mesmo se o link de internet externo cair.</p>
            </div>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>💾 Backups Automatizados</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Dumps diários com retenção programada de 30 dias em volume local seguro.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

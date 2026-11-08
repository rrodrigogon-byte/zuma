import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { 
  Zap, Calendar, Clock, Gift, Star, AlertTriangle, 
  PieChart, Users, Cpu, Play, CheckCircle2, RefreshCw
} from 'lucide-react';

export default function Automacoes() {
  const { empresaAtiva } = useAuth();
  const [loading, setLoading] = useState(true);
  const [executando, setExecutando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('central');
  const [dados, setDados] = useState({ automacoes: [], metricasEventos: {} });
  const [eventos, setEventos] = useState([]);
  const [planosPrevia, setPlanosPrevia] = useState([]);
  const [resumoDia, setResumoDia] = useState(null);
  const [sucessoMsg, setSucessoMsg] = useState('');
  const [erroMsg, setErroMsg] = useState('');

  const carregarDados = async () => {
    try {
      setLoading(true);
      const json = await api.get('/admin/automacoes/status');
      if (json && json.ok) {
        setDados(json);
      }
    } catch (err) {
      console.error('Erro ao carregar automações:', err);
    } finally {
      setLoading(false);
    }
  };

  const carregarEventos = async () => {
    try {
      const json = await api.get('/admin/automacoes/eventos?limite=30');
      if (json && json.ok) {
        setEventos(json.eventos || []);
      }
    } catch (err) {
      console.error('Erro ao carregar eventos:', err);
    }
  };

  const carregarPlanosPrevia = async () => {
    try {
      const json = await api.get('/admin/automacoes/planos/previa');
      if (json && json.ok) {
        setPlanosPrevia(json.pendencias || []);
      }
    } catch (err) {
      console.error('Erro ao carregar prévia de planos:', err);
    }
  };

  const carregarResumoDia = async () => {
    try {
      const json = await api.get('/admin/automacoes/resumo-dia');
      if (json && json.ok) {
        setResumoDia(json);
      }
    } catch (err) {
      console.error('Erro ao carregar resumo do dia:', err);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [empresaAtiva]);

  useEffect(() => {
    if (abaAtiva === 'eventos') carregarEventos();
    if (abaAtiva === 'planos') carregarPlanosPrevia();
    if (abaAtiva === 'resumo') carregarResumoDia();
  }, [abaAtiva]);

  const alternarAutomacao = async (id, estadoAtual) => {
    try {
      const json = await api.post(`/admin/automacoes/${id}/toggle`, { ativo: !estadoAtual });
      if (json && json.ok) {
        setDados(prev => ({
          ...prev,
          automacoes: prev.automacoes.map(a => a.id === id ? { ...a, ativo: !estadoAtual } : a)
        }));
        setSucessoMsg(`Automação ${!estadoAtual ? 'ativada' : 'pausada'} com sucesso.`);
        setTimeout(() => setSucessoMsg(''), 4000);
      }
    } catch (err) {
      setErroMsg('Não foi possível alterar a automação.');
      setTimeout(() => setErroMsg(''), 4000);
    }
  };

  const executarAgora = async (id, dispararReal = false) => {
    try {
      setExecutando(true);
      const json = await api.post(`/admin/automacoes/${id}/executar`, { disparar: dispararReal });
      if (json && json.ok) {
        setSucessoMsg(`Execução disparada com sucesso! Evento registrado no barramento.`);
        setTimeout(() => setSucessoMsg(''), 4000);
        carregarDados();
        if (abaAtiva === 'eventos') carregarEventos();
      }
    } catch (err) {
      setErroMsg('Erro ao executar automação.');
      setTimeout(() => setErroMsg(''), 4000);
    } finally {
      setExecutando(false);
    }
  };

  const getIcone = (iconeNome) => {
    switch (iconeNome) {
      case 'calendar-check': return <Calendar style={{ width: 20, height: 20, color: '#f59e0b' }} />;
      case 'clock': return <Clock style={{ width: 20, height: 20, color: '#3b82f6' }} />;
      case 'gift': return <Gift style={{ width: 20, height: 20, color: '#ec4899' }} />;
      case 'star': return <Star style={{ width: 20, height: 20, color: '#eab308' }} />;
      case 'package-alert': return <AlertTriangle style={{ width: 20, height: 20, color: '#f97316' }} />;
      case 'chart-pie': return <PieChart style={{ width: 20, height: 20, color: '#10b981' }} />;
      case 'user-check': return <Users style={{ width: 20, height: 20, color: '#6366f1' }} />;
      case 'cpu': return <Cpu style={{ width: 20, height: 20, color: '#06b6d4' }} />;
      default: return <Zap style={{ width: 20, height: 20, color: '#f59e0b' }} />;
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* HEADER HERO */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: '16px',
        padding: '24px 28px',
        color: '#ffffff',
        border: '1px solid #334155',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
        marginBottom: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            padding: '12px',
            borderRadius: '12px',
            color: '#fbbf24',
            display: 'flex'
          }}>
            <Zap style={{ width: 28, height: 28 }} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
              Automações & Processos Corporativos
            </h1>
            <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>
              Barramento de eventos internos desacoplado, réguas de relacionamento T-Rex e inteligência operacional.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid #334155',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#94a3b8'
          }}>
            Barramento: <strong style={{ color: '#10b981' }}>● 100% Sincronizado</strong>
          </div>
          <button
            onClick={carregarDados}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: '#334155',
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RefreshCw style={{ width: 14, height: 14 }} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {sucessoMsg && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#10b981',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 style={{ width: 18, height: 18 }} /> {sucessoMsg}
        </div>
      )}

      {erroMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle style={{ width: 18, height: 18 }} /> {erroMsg}
        </div>
      )}

      {/* ABAS */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #e2e8f0',
        marginBottom: '24px',
        gap: '8px'
      }}>
        {[
          { id: 'central', label: `Central de Automações (${dados.automacoes?.length || 8})` },
          { id: 'planos', label: 'Vencimento de Planos & PIX' },
          { id: 'resumo', label: 'Briefing Noturno da Gestão' },
          { id: 'eventos', label: 'Monitor de Eventos Internos (Live)' }
        ].map(aba => (
          <button
            key={aba.id}
            onClick={() => setAbaAtiva(aba.id)}
            style={{
              padding: '10px 18px',
              fontSize: '14px',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: abaAtiva === aba.id ? '2px solid #f59e0b' : '2px solid transparent',
              color: abaAtiva === aba.id ? '#d97706' : '#64748b',
              cursor: 'pointer',
              marginBottom: '-2px'
            }}
          >
            {aba.label}
          </button>
        ))}
      </div>

      {/* ABA 1: CENTRAL DE AUTOMAÇÕES */}
      {abaAtiva === 'central' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
          {dados.automacoes?.map(auto => (
            <div
              key={auto.id}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      {getIcone(auto.icone)}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{auto.nome}</h3>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{auto.intervalo}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => alternarAutomacao(auto.id, auto.ativo)}
                    style={{
                      background: auto.ativo ? '#10b981' : '#cbd5e1',
                      border: 'none',
                      borderRadius: '20px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    {auto.ativo ? 'LIGADA' : 'PAUSADA'}
                  </button>
                </div>

                <p style={{ margin: '14px 0 0 0', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                  {auto.descricao}
                </p>
              </div>

              <div style={{
                marginTop: '20px',
                paddingTop: '14px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Hoje: <strong style={{ color: '#0f172a' }}>{auto.totalExecucoesHoje} execuções</strong>
                </span>

                <button
                  onClick={() => executarAgora(auto.id)}
                  disabled={executando}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#0f172a',
                    cursor: 'pointer'
                  }}
                >
                  <Play style={{ width: 12, height: 12, color: '#d97706' }} />
                  Disparar Agora
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ABA 2: VENCIMENTO DE PLANOS */}
      {abaAtiva === 'planos' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>
            Régua de Vencimento de Planos & Mensalidades
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>
            Clientes identificados para cobrança amigável com lembrete de agendamento e opções de PIX e link de cartão de crédito.
          </p>

          {planosPrevia.length === 0 ? (
            <p style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '30px' }}>
              Nenhum plano com vencimento imediato nesta unidade.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '12px' }}>
                    <th style={{ padding: '10px 12px' }}>CLIENTE</th>
                    <th style={{ padding: '10px 12px' }}>TELEFONE</th>
                    <th style={{ padding: '10px 12px' }}>PLANO</th>
                    <th style={{ padding: '10px 12px' }}>VALOR</th>
                    <th style={{ padding: '10px 12px' }}>VENCIMENTO</th>
                    <th style={{ padding: '10px 12px' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {planosPrevia.slice(0, 15).map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{item.clienteNome}</td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{item.clienteTelefone}</td>
                      <td style={{ padding: '10px 12px', color: '#334155' }}>{item.planoNome}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#10b981' }}>{item.valorFormatado}</td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>{item.pagoAte}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: item.situacao === 'vence_hoje' ? '#fef3c7' : '#dbeafe',
                          color: item.situacao === 'vence_hoje' ? '#b45309' : '#1d4ed8'
                        }}>
                          {item.situacao}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ABA 3: BRIEFING NOTURNO */}
      {abaAtiva === 'resumo' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Prévia do Briefing Noturno (WhatsApp de Gestão)
            </h2>
            <button
              onClick={() => executarAgora('briefing_fechamento_gestao')}
              style={{
                padding: '8px 16px',
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Disparar Briefing Agora
            </button>
          </div>

          {resumoDia?.mensagemFormatada ? (
            <div style={{
              background: '#0f172a',
              color: '#f8fafc',
              padding: '20px',
              borderRadius: '10px',
              fontFamily: 'monospace',
              fontSize: '13px',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6'
            }}>
              {resumoDia.mensagemFormatada}
            </div>
          ) : (
            <p style={{ color: '#94a3b8' }}>Carregando dados consolidados do dia...</p>
          )}
        </div>
      )}

      {/* ABA 4: MONITOR DE EVENTOS INTERNOS */}
      {abaAtiva === 'eventos' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>
                Monitor de Eventos Internos do ERP Kytto (Audit Trail)
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                Barramento de mensageria em tempo real orientada a eventos internos.
              </p>
            </div>
            <button
              onClick={carregarEventos}
              style={{
                padding: '6px 14px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Atualizar
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px', fontFamily: 'monospace' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '8px 10px' }}>HORÁRIO</th>
                  <th style={{ padding: '8px 10px' }}>TIPO</th>
                  <th style={{ padding: '8px 10px' }}>ORIGEM</th>
                  <th style={{ padding: '8px 10px' }}>STATUS</th>
                  <th style={{ padding: '8px 10px' }}>LATÊNCIA</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((evt) => (
                  <tr key={evt.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', color: '#64748b' }}>{new Date(evt.timestamp).toLocaleTimeString('pt-BR')}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#d97706' }}>{evt.tipo}</td>
                    <td style={{ padding: '8px 10px', color: '#334155' }}>{evt.origem}</td>
                    <td style={{ padding: '8px 10px', color: '#10b981' }}>● {evt.status}</td>
                    <td style={{ padding: '8px 10px', color: '#64748b' }}>{evt.duracaoMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

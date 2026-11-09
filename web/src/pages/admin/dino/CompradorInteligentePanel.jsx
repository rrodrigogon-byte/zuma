import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';
import { moneyK } from './format';

export default function CompradorInteligentePanel({ nomeEmpresa = 'Barbearia Dino' }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState('recomendacoes'); // 'recomendacoes' | 'cotacoes' | 'copilot' | 'auditoria'
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // Estados dos dados da IA
  const [diagnostico, setDiagnostico] = useState({
    healthScore: 88,
    totalSkus: 0,
    kpis: {
      criticos: 0,
      atencao: 0,
      saudaveis: 0,
      excesso: 0,
      valorTotalEstoque: 0,
      capitalImobilizadoExcesso: 0,
      totalInvestimentoSugerido: 0,
      economiaProjetadaCotacao: 0
    },
    recomendacoes: [],
    analises: []
  });

  const [cotacoesComparativas, setCotacoesComparativas] = useState([]);
  const [configAutonomia, setConfigAutonomia] = useState({
    nivel: 'assistido',
    tetoSemanal: 1200,
    tetoMensal: 5000,
    alertaRupturaDias: 4,
    coberturaMetaDias: 25,
    autoAprovarCurvaA: false,
    autoEnviarEmailFornecedor: false,
    notificarWhatsApp: true,
    historicoAcoes: []
  });

  // Modal de Autonomia
  const [modalAutonomia, setModalAutonomia] = useState(false);
  const [formAutonomia, setFormAutonomia] = useState({});

  // Chat Copilot IA
  const [mensagensChat, setMensagensChat] = useState([
    {
      remetente: 'ia',
      data: 'Agora',
      texto: `Olá! Sou o **Comprador Inteligente Kytto**. Analisei todo o catálogo da **${nomeEmpresa}**, giro dos últimos 60 dias e prazos de entrega dos fornecedores parceiros.\n\nO Health Score atual de abastecimento é de **88%**. Como posso ajudar você a otimizar as compras hoje?`,
      acoes: ['O que preciso comprar para esta semana?', 'Onde temos capital parado?', 'Ver matriz comparativa de cotações']
    }
  ]);
  const [inputChat, setInputChat] = useState('');
  const [enviandoChat, setEnviandoChat] = useState(false);
  const [gerandoPedidos, setGerandoPedidos] = useState(false);

  // Carrega diagnóstico completo do backend
  const carregarDiagnostico = useCallback(async () => {
    setLoading(true);
    try {
      const [diagRes, cotRes, autoRes] = await Promise.all([
        api.get('/api/admin/barbearia/compras/inteligente/diagnostico').catch(() => null),
        api.get('/api/admin/barbearia/compras/inteligente/cotacoes').catch(() => null),
        api.get('/api/admin/barbearia/compras/inteligente/autonomia').catch(() => null),
      ]);

      if (diagRes?.ok) {
        setDiagnostico(diagRes);
      }
      if (cotRes?.ok && Array.isArray(cotRes.cotacoes)) {
        setCotacoesComparativas(cotRes.cotacoes);
      }
      if (autoRes?.ok && autoRes.config) {
        setConfigAutonomia(autoRes.config);
        setFormAutonomia(autoRes.config);
      }
    } catch (err) {
      console.warn('[Comprador Inteligente] Erro ao carregar diagnóstico:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDiagnostico();
  }, [carregarDiagnostico]);

  // Salvar políticas de autonomia
  async function salvarPoliticasAutonomia() {
    try {
      const res = await api.post('/api/admin/barbearia/compras/inteligente/autonomia', formAutonomia);
      if (res?.ok) {
        setConfigAutonomia(res.config);
        setModalAutonomia(false);
        toast(`Políticas de autonomia salvas! Nível ativo: ${res.config.nivel.toUpperCase()}`, 'success');
        carregarDiagnostico();
      }
    } catch (err) {
      toast(err.message || 'Erro ao salvar autonomia.', true);
    }
  }

  // Gerar pedidos otimizados via IA
  async function dispararGeracaoPedidosIA() {
    setGerandoPedidos(true);
    toast('Otimizando pedidos por lote econômico e fornecedor parceiro...', 'info');
    try {
      const res = await api.post('/api/admin/barbearia/compras/inteligente/pedidos-otimizados', {
        nivelAutonomia: configAutonomia.nivel
      });
      if (res?.ok) {
        toast(`Sucesso! ${res.pedidos?.length || 0} pedido(s) de compra gerado(s) com economia estimada de R$ ${Number(res.economiaEstimada || 0).toFixed(2)}!`, 'success');
        carregarDiagnostico();
      } else {
        toast(res.mensagem || 'Nenhum pedido gerado.', 'info');
      }
    } catch (err) {
      toast(err.message || 'Erro ao gerar pedidos pela IA.', true);
    } finally {
      setGerandoPedidos(false);
    }
  }

  // Enviar pergunta ao Copilot
  async function enviarPerguntaCopilot(textoPergunta) {
    const pergunta = (textoPergunta || inputChat).trim();
    if (!pergunta) return;

    const novaMensagemUsuario = {
      remetente: 'usuario',
      data: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      texto: pergunta
    };

    setMensagensChat(prev => [...prev, novaMensagemUsuario]);
    setInputChat('');
    setEnviandoChat(true);

    try {
      const res = await api.post('/api/admin/barbearia/compras/inteligente/copilot', { mensagem: pergunta });
      if (res?.ok) {
        setMensagensChat(prev => [
          ...prev,
          {
            remetente: 'ia',
            data: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            texto: res.resposta || 'Análise concluída com base nos dados do sistema.',
            acoes: res.acoesSugeridas || []
          }
        ]);
      }
    } catch (err) {
      setMensagensChat(prev => [
        ...prev,
        {
          remetente: 'ia',
          data: 'Erro',
          texto: 'Não foi possível consultar o Copilot no momento. Verifique a conexão com o servidor.'
        }
      ]);
    } finally {
      setEnviandoChat(false);
    }
  }

  const kpis = diagnostico.kpis || {};
  const recomendacoes = diagnostico.recomendacoes || [];

  const recomendacoesFiltradas = recomendacoes.filter(r => {
    if (filtroStatus === 'critico') return r.statusRuptura === 'critico';
    if (filtroStatus === 'atencao') return r.statusRuptura === 'atencao';
    if (filtroStatus === 'excesso') return r.statusRuptura === 'excesso';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── HEADER DO AGENTE COMPRADOR ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(99, 102, 241, 0.06) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        borderRadius: 14,
        padding: '18px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
          }}>
            🤖
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--fg)' }}>
                Comprador Inteligente & Autônomo
              </h2>
              <span style={{
                background: '#10b98122',
                color: '#10b981',
                border: '1px solid #10b98144',
                padding: '2px 8px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                Agente Ativo v4.2
              </span>
              <span style={{
                background: configAutonomia.nivel === 'autonomo' ? '#ef444422' : configAutonomia.nivel === 'supervisionado' ? '#f59e0b22' : '#6366f122',
                color: configAutonomia.nivel === 'autonomo' ? '#ef4444' : configAutonomia.nivel === 'supervisionado' ? '#d97706' : '#6366f1',
                padding: '2px 8px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600
              }}>
                Modo: {configAutonomia.nivel === 'autonomo' ? '🚀 Autônomo Total' : configAutonomia.nivel === 'supervisionado' ? '⚡ Supervisionado' : '🛡️ Assistido (Copilot)'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
              Motor de cálculo preditivo ROP/EOQ, curva ABC/XYZ e cotações comparativas multi-fornecedor para <strong>{nomeEmpresa}</strong>.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => { setFormAutonomia(configAutonomia); setModalAutonomia(true); }}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--card)',
              color: 'var(--fg)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            ⚙️ Alçadas & Autonomia
          </button>
          <button
            type="button"
            onClick={dispararGeracaoPedidosIA}
            disabled={gerandoPedidos}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)'
            }}
          >
            {gerandoPedidos ? 'Calculando Lote Econômico...' : '🎯 Gerar Pedidos Otimizados (IA)'}
          </button>
        </div>
      </div>

      {/* ── BOXES DE INDICADORES (KPIS) EM K ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 14
      }}>
        {/* Health Score */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Health Score
            </span>
            <span style={{ fontSize: 18 }}>🛡️</span>
          </div>
          <div style={{ margin: '10px 0 6px' }}>
            <strong style={{ fontSize: 26, fontWeight: 800, color: diagnostico.healthScore > 80 ? '#10b981' : '#f59e0b' }}>
              {diagnostico.healthScore}%
            </strong>
          </div>
          <div style={{ width: '100%', height: 6, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${diagnostico.healthScore}%`,
              height: '100%',
              background: diagnostico.healthScore > 80 ? '#10b981' : '#f59e0b',
              borderRadius: 4
            }} />
          </div>
        </div>

        {/* Risco Crítico */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid #ef444433',
          borderRadius: 12,
          padding: 16
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Ruptura Iminente (&lt; 3d)
            </span>
            <span style={{ fontSize: 18 }}>🚨</span>
          </div>
          <div style={{ margin: '10px 0 4px' }}>
            <strong style={{ fontSize: 26, fontWeight: 800, color: kpis.criticos > 0 ? '#ef4444' : '#10b981' }}>
              {kpis.criticos} item(ns)
            </strong>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {kpis.criticos > 0 ? 'Exige compra emergencial' : 'Zero rupturas hoje'}
          </div>
        </div>

        {/* Ponto de Reposição */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid #f59e0b33',
          borderRadius: 12,
          padding: 16
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Ponto de Pedido (ROP)
            </span>
            <span style={{ fontSize: 18 }}>⚠️</span>
          </div>
          <div style={{ margin: '10px 0 4px' }}>
            <strong style={{ fontSize: 26, fontWeight: 800, color: '#f59e0b' }}>
              {kpis.atencao} item(ns)
            </strong>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Cobertura entre 3 a 7 dias
          </div>
        </div>

        {/* Capital Parado */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 16
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Capital Parado (&gt; 45d)
            </span>
            <span style={{ fontSize: 18 }}>📦</span>
          </div>
          <div style={{ margin: '10px 0 4px' }}>
            <strong style={{ fontSize: 26, fontWeight: 800, color: 'var(--fg)' }}>
              {moneyK(kpis.capitalImobilizadoExcesso || 0)}
            </strong>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Exato: R$ {Number(kpis.capitalImobilizadoExcesso || 0).toFixed(2)}
          </div>
        </div>

        {/* Economia Projetada */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid #10b98133',
          borderRadius: 12,
          padding: 16
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Economia Projetada (IA)
            </span>
            <span style={{ fontSize: 18 }}>💰</span>
          </div>
          <div style={{ margin: '10px 0 4px' }}>
            <strong style={{ fontSize: 26, fontWeight: 800, color: '#10b981' }}>
              {moneyK(kpis.economiaProjetadaCotacao || 0)}
            </strong>
          </div>
          <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
            ~11.5% de ganho em cotações
          </div>
        </div>
      </div>

      {/* ── NAVEGAÇÃO DE SUB-ABAS DO COMPRADOR INTELIGENTE ── */}
      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid var(--border)',
        paddingBottom: 8,
        overflowX: 'auto'
      }}>
        {[
          { id: 'recomendacoes', label: '📊 Recomendações Preditivas (ROP/EOQ)', badge: recomendacoes.length },
          { id: 'cotacoes', label: '🏆 Matriz de Cotações Multi-Fornecedor', badge: cotacoesComparativas.length },
          { id: 'copilot', label: '💬 Copilot de Compras IA (Chat)', badge: 'Online' },
          { id: 'auditoria', label: '📜 Auditoria & Decisões da IA', badge: configAutonomia.historicoAcoes?.length || 0 }
        ].map(aba => (
          <button
            key={aba.id}
            type="button"
            onClick={() => setSubTab(aba.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: subTab === aba.id ? 'var(--fg)' : 'transparent',
              color: subTab === aba.id ? 'var(--bg)' : 'var(--muted)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease'
            }}
          >
            {aba.label}
            {aba.badge !== undefined && (
              <span style={{
                background: subTab === aba.id ? 'rgba(255,255,255,0.2)' : 'var(--card2)',
                color: subTab === aba.id ? '#fff' : 'var(--fg)',
                padding: '2px 6px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700
              }}>
                {aba.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── CONTEÚDO 1: RECOMENDAÇÕES PREDITIVAS ── */}
      {subTab === 'recomendacoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Filtros rápidos */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { id: 'todos', label: `Todos (${recomendacoes.length})` },
                { id: 'critico', label: `🚨 Críticos (${kpis.criticos})` },
                { id: 'atencao', label: `⚠️ Ponto de Pedido (${kpis.atencao})` },
                { id: 'excesso', label: `📦 Excesso (${kpis.excesso})` }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroStatus(f.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    border: '1px solid var(--border)',
                    background: filtroStatus === f.id ? 'var(--accent)' : 'var(--card)',
                    color: filtroStatus === f.id ? '#fff' : 'var(--fg)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Total sugerido: <strong>R$ {Number(kpis.totalInvestimentoSugerido || 0).toFixed(2)}</strong> ({moneyK(kpis.totalInvestimentoSugerido || 0)})
            </div>
          </div>

          {/* Tabela de Recomendações */}
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--card2)', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 16px' }}>Produto & Curva</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Estoque / Mín</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>CMD / Giro</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Cobertura</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>ROP / EOQ</th>
                    <th style={{ padding: '12px 16px' }}>Fornecedor Homologado</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Qtd Sugerida</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Custo Total</th>
                    <th style={{ padding: '12px 16px' }}>Raciocínio Explicável (IA)</th>
                  </tr>
                </thead>
                <tbody>
                  {recomendacoesFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                        Nenhum item encontrado com o filtro selecionado. Todos os níveis de abastecimento estão regulares.
                      </td>
                    </tr>
                  ) : (
                    recomendacoesFiltradas.map(rec => (
                      <tr key={rec.produtoId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--fg)' }}>{rec.nome}</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{rec.sku}</span>
                            <span style={{
                              background: '#6366f122',
                              color: '#6366f1',
                              padding: '1px 5px',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 700
                            }}>
                              Curva {rec.classeABC}-{rec.classeXYZ}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <strong>{rec.estoqueAtual}</strong> / {rec.estoqueMinimo} un
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--muted)' }}>
                          {rec.cmd} un/dia
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            background: rec.statusRuptura === 'critico' ? '#ef444422' : '#f59e0b22',
                            color: rec.statusRuptura === 'critico' ? '#ef4444' : '#d97706',
                            padding: '3px 8px',
                            borderRadius: 12,
                            fontWeight: 700,
                            fontSize: 12
                          }}>
                            {rec.diasCobertura} dias
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
                          ROP: {rec.rop} · EOQ: {rec.loteEconomico}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{rec.fornecedorNome}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Lead time: {rec.leadTimeDias} dias</div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <span style={{
                            background: '#10b98122',
                            color: '#10b981',
                            padding: '3px 10px',
                            borderRadius: 8,
                            fontWeight: 800,
                            fontSize: 13
                          }}>
                            +{rec.quantidadeSugerida} un
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>
                          R$ {Number(rec.custoTotalSugerido || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px', maxWidth: 280, fontSize: 12, color: 'var(--fg)', lineHeight: 1.4 }}>
                          {rec.justificativaIA}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTEÚDO 2: MATRIZ DE COTAÇÕES COMPARATIVAS ── */}
      {subTab === 'cotacoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Matriz Comparativa de Fornecedores Homologados
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                A IA consulta o catálogo e tabelas de múltiplos fornecedores para indicar a melhor relação preço x prazo de entrega.
              </p>
            </div>
            <div style={{
              background: '#10b98115',
              border: '1px solid #10b98144',
              color: '#10b981',
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700
            }}>
              💡 Economia estimada: R$ {Number(kpis.economiaProjetadaCotacao || 0).toFixed(2)} ({moneyK(kpis.economiaProjetadaCotacao || 0)})
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
            {cotacoesComparativas.map((grupo, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14
                }}
              >
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>
                    Categoria: {grupo.categoria}
                  </span>
                  <h4 style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>
                    {grupo.produtoExemplo}
                  </h4>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {grupo.cotacoes.map((cot, cIdx) => (
                    <div
                      key={cIdx}
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        border: cot.selo === 'melhor_custo_beneficio' ? '1.5px solid #10b981' : '1px solid var(--border)',
                        background: cot.selo === 'melhor_custo_beneficio' ? 'rgba(16, 185, 129, 0.04)' : 'var(--card2)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: 13, color: 'var(--fg)' }}>
                          {cot.fornecedorNome}
                        </strong>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 20,
                          background: cot.selo === 'melhor_custo_beneficio' ? '#10b98122' : '#3b82f622',
                          color: cot.selo === 'melhor_custo_beneficio' ? '#10b981' : '#3b82f6'
                        }}>
                          {cot.selo === 'melhor_custo_beneficio' ? '🏆 Melhor Custo' : '⚡ Entrega Expressa'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 12 }}>
                        <div>
                          <div style={{ color: 'var(--muted)' }}>Preço Unit.</div>
                          <strong style={{ color: '#10b981', fontSize: 14 }}>R$ {Number(cot.precoUnitario || 0).toFixed(2)}</strong>
                        </div>
                        <div>
                          <div style={{ color: 'var(--muted)' }}>Prazo</div>
                          <strong>{cot.prazoEntregaDias} dias</strong>
                        </div>
                        <div>
                          <div style={{ color: 'var(--muted)' }}>Mínimo</div>
                          <span>R$ {Number(cot.pedidoMinimo || 0).toFixed(0)}</span>
                        </div>
                        <div>
                          <div style={{ color: 'var(--muted)' }}>Frete</div>
                          <span>{cot.frete}</span>
                        </div>
                      </div>

                      <div style={{ fontSize: 11, color: 'var(--muted)', borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
                        {cot.motivoSelo}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CONTEÚDO 3: COPILOT DE COMPRAS IA (CHAT INTERATIVO) ── */}
      {subTab === 'copilot' && (
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          minHeight: 460
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Copilot de Suprimentos & Negociação com Fornecedores
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
              Tire dúvidas sobre demanda futura, negociação de preços em volume, identificação de itens parados ou simulações.
            </p>
          </div>

          {/* Área de Mensagens */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            maxHeight: 380,
            overflowY: 'auto',
            paddingRight: 6
          }}>
            {mensagensChat.map((m, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: m.remetente === 'usuario' ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                <div style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: m.remetente === 'usuario' ? 'var(--accent)' : 'var(--card2)',
                  color: m.remetente === 'usuario' ? '#fff' : 'var(--fg)',
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-line',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                }}>
                  {m.texto}
                </div>

                {m.acoes && m.acoes.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                    {m.acoes.map((acao, aIdx) => (
                      <button
                        key={aIdx}
                        type="button"
                        onClick={() => enviarPerguntaCopilot(acao)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 14,
                          border: '1px solid var(--border)',
                          background: 'var(--card)',
                          color: 'var(--accent)',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ⚡ {acao}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {enviandoChat && (
              <div style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                🤖 O Comprador Inteligente está analisando os dados...
              </div>
            )}
          </div>

          {/* Campo de Envio */}
          <div style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <input
              type="text"
              placeholder="Pergunte ao Copilot (ex: Quais produtos têm risco de ruptura nesta semana?)"
              value={inputChat}
              onChange={e => setInputChat(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') enviarPerguntaCopilot(); }}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--card2)',
                color: 'var(--fg)',
                fontSize: 13
              }}
            />
            <button
              type="button"
              onClick={() => enviarPerguntaCopilot()}
              disabled={enviandoChat}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              Enviar
            </button>
          </div>
        </div>
      )}

      {/* ── CONTEÚDO 4: AUDITORIA & REGISTRO DAS AÇÕES DO AGENTE ── */}
      {subTab === 'auditoria' && (
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Audit Trail & Histórico das Decisões do Comprador Autônomo
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
              Registro cronológico de todas as sugestões, aprovações e pedidos disparados pelo motor de IA.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(configAutonomia.historicoAcoes || []).map((h, idx) => (
              <div
                key={idx}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--card2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>🤖</span>
                    <strong style={{ fontSize: 13, color: 'var(--fg)' }}>{h.descricao}</strong>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    {new Date(h.data).toLocaleString('pt-BR')} · Tipo: {h.tipo}
                  </div>
                </div>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#10b981',
                  background: '#10b98115',
                  padding: '4px 10px',
                  borderRadius: 6
                }}>
                  {h.impacto}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL DE CONFIGURAÇÃO DE AUTONOMIA E ALÇADAS ── */}
      {modalAutonomia && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 580,
            padding: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 18
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>⚙️</span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  Políticas de Autonomia & Alçadas do Comprador
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalAutonomia(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
              Defina o grau de independência do agente IA na gestão do estoque da <strong>{nomeEmpresa}</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Nível de Autonomia */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--fg)' }}>
                  Grau de Autonomia
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { id: 'assistido', label: '🛡️ Assistido', desc: '100% aprovação manual' },
                    { id: 'supervisionado', label: '⚡ Supervisionado', desc: 'Aprova até o teto' },
                    { id: 'autonomo', label: '🚀 Autônomo', desc: 'Envio direto aos forn.' }
                  ].map(n => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => setFormAutonomia(prev => ({ ...prev, nivel: n.id }))}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 8,
                        border: formAutonomia.nivel === n.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: formAutonomia.nivel === n.id ? 'var(--card2)' : 'var(--card)',
                        textAlign: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{n.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{n.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Teto Semanal */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Teto Semanal (R$)
                  </label>
                  <input
                    type="number"
                    value={formAutonomia.tetoSemanal || ''}
                    onChange={e => setFormAutonomia(prev => ({ ...prev, tetoSemanal: Number(e.target.value) }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Meta de Cobertura (Dias)
                  </label>
                  <input
                    type="number"
                    value={formAutonomia.coberturaMetaDias || 25}
                    onChange={e => setFormAutonomia(prev => ({ ...prev, coberturaMetaDias: Number(e.target.value) }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)' }}
                  />
                </div>
              </div>

              {/* Regras e flags */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formAutonomia.autoAprovarCurvaA || false}
                    onChange={e => setFormAutonomia(prev => ({ ...prev, autoAprovarCurvaA: e.target.checked }))}
                  />
                  Aprovar automaticamente reposições de itens Curva A (essenciais)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formAutonomia.autoEnviarEmailFornecedor || false}
                    onChange={e => setFormAutonomia(prev => ({ ...prev, autoEnviarEmailFornecedor: e.target.checked }))}
                  />
                  Disparar e-mail com Ordem de Compra direto ao fornecedor parceiro
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formAutonomia.notificarWhatsApp || false}
                    onChange={e => setFormAutonomia(prev => ({ ...prev, notificarWhatsApp: e.target.checked }))}
                  />
                  Notificar o Gestor no WhatsApp a cada ordem emitida
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setModalAutonomia(false)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarPoliticasAutonomia}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Salvar Políticas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

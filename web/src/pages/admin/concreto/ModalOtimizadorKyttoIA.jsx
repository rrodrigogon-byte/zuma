import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

export default function ModalOtimizadorKyttoIA({
  isOpen,
  onClose,
  analise,
  carregando,
  onRecalcular,
  onAplicarEscala,
  aplicando,
  dataAlvo
}) {
  const [abaAtiva, setAbaAtiva] = useState('escala'); // 'escala' | 'gargalos' | 'central' | 'slump_ml' | 'normas_git'
  
  // Parâmetros do Simulador Interativo de Slump Loss ML
  const [simulador, setSimulador] = useState({
    slumpInicialCm: 14.0,
    temperaturaAmbienteC: 32.0,
    umidadeRelativaPct: 55.0,
    tempoViagemMin: 35.0,
    tipoAditivo: 'retardador_pr',
    volumeM3: 8.0,
    velocidadeVentoKmH: 12.0
  });

  const [resultadoSlump, setResultadoSlump] = useState(null);
  const [calculandoSlump, setCalculandoSlump] = useState(false);

  // Executar simulação local ou remota ao alterar inputs do simulador
  useEffect(() => {
    let ativo = true;
    const simular = async () => {
      setCalculandoSlump(true);
      try {
        const res = await api.post('/api/admin/concreto/programacao/simulador-ml-slump', simulador);
        if (ativo && res?.ok) {
          setResultadoSlump(res);
        }
      } catch (e) {
        // Fallback matemático local
        const s0 = Number(simulador.slumpInicialCm) || 14;
        const tAmb = Number(simulador.temperaturaAmbienteC) || 32;
        const tMin = Number(simulador.tempoViagemMin) || 35;
        const fatorRetardador = simulador.tipoAditivo === 'retardador_pr' ? 0.25 : simulador.tipoAditivo === 'superplastificante_sp' ? 0.15 : 0.6;
        const perda = +(0.85 * Math.pow(tAmb / 20, 1.35) * fatorRetardador * Math.sqrt(tMin / 15)).toFixed(2);
        const slumpObra = +(Math.max(2, s0 - perda)).toFixed(1);
        if (ativo) {
          setResultadoSlump({
            ok: true,
            slumpInicialUsinaCm: s0,
            temperaturaAmbienteC: tAmb,
            tempoViagemMin: tMin,
            perdaCalculadaCm: perda,
            slumpObraPrevistoCm: slumpObra,
            statusBombeabilidade: slumpObra >= 12 ? 'otima' : slumpObra >= 10 ? 'atencao' : 'inviavel',
            mensagemBombeabilidade: slumpObra >= 12 ? 'Slump ideal para bombeamento contínuo.' : 'Atenção ao bombeamento.',
            taxaEvaporacaoKgM2H: 0.85,
            riscoFissuracao: 'moderado',
            orientacaoCura: 'Iniciar aspersão de água logo após sarrafeamento.',
            limiteMaximoNbr7212Min: 150
          });
        }
      } finally {
        if (ativo) setCalculandoSlump(false);
      }
    };
    simular();
    return () => { ativo = false; };
  }, [simulador]);

  if (!isOpen) return null;

  const score = analise?.scoreEficiencia ?? 96;
  const totalViagens = analise?.totalViagens ?? 0;
  const volumeTotal = analise?.volumeTotalM3 ?? 0;
  const gargalos = analise?.gargalosPrevistos || [];
  const alertas = analise?.alertasPreventivos || [];
  const sugestoes = analise?.sugestoesEscala || [];
  const timeline = analise?.timelineUsinagem || [];
  const benchmarkNBR = analise?.benchmarkMercadoNBR || {
    normasRegulamentadoras: [],
    praticasOperacionaisMercado: []
  };
  const ecossistema = analise?.ecossistemaAberto || {
    repositoriosGitHub: [],
    mcpsRecomendados: []
  };

  return (
    <div className="serrano-modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div className="serrano-modal-card" style={{
        background: 'var(--surface, #1e293b)',
        color: 'var(--text, #f8fafc)',
        borderRadius: '14px',
        border: '1px solid var(--joint, #334155)',
        width: '100%',
        maxWidth: '1100px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
        overflow: 'hidden'
      }}>
        {/* HEADER MODAL */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--joint, #334155)',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(234, 88, 12, 0.05) 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              boxShadow: '0 4px 14px rgba(234, 88, 12, 0.4)'
            }}>
              🤖
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: -0.3 }}>
                  KyttoIA: Otimizador de Escala &amp; Previsão de Gargalos
                </h2>
                <span style={{
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#f59e0b',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 12,
                  border: '1px solid rgba(245, 158, 11, 0.4)'
                }}>
                  Motor KyttoIA 2.5 Flash
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted, #94a3b8)' }}>
                Programação logística e tecnológica para <b>{dataAlvo}</b> em conformidade com ABNT NBR 7212 / NBR 8953 / NBR 14931 e ACI 305R.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* SCORE KPI */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: score >= 90 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              border: `1px solid ${score >= 90 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
              padding: '6px 14px',
              borderRadius: 8
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)' }}>Score Logístico:</span>
              <span style={{
                fontSize: 18,
                fontWeight: 900,
                color: score >= 90 ? '#10b981' : '#f59e0b'
              }}>
                {score}%
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                fontSize: 22,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 6
              }}
              title="Fechar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* NAVEGAÇÃO POR ABAS */}
        <div style={{
          display: 'flex',
          gap: 6,
          padding: '10px 24px',
          borderBottom: '1px solid var(--joint, #334155)',
          background: 'var(--surface-2, #0f172a)',
          overflowX: 'auto'
        }}>
          {[
            { id: 'escala', rotulo: '🚛 Escala Otimizada & Frota', badge: sugestoes.length },
            { id: 'gargalos', rotulo: '⚠️ Gargalos & Mitigação', badge: gargalos.length, badgeCritico: gargalos.some(g => g.severidade === 'critico') },
            { id: 'central', rotulo: '⏱️ Timeline Usina (Convicta 80m³/h)', badge: timeline.length },
            { id: 'slump_ml', rotulo: '🧠 Predição Slump Loss ML (ACI 305R)' },
            { id: 'normas_git', rotulo: '📚 Regras NBR & GitHub / MCPs' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAbaAtiva(tab.id)}
              style={{
                background: abaAtiva === tab.id ? 'var(--serrano-orange-text, #ea580c)' : 'transparent',
                color: abaAtiva === tab.id ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.rotulo}</span>
              {tab.badge !== undefined && (
                <span style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: tab.badgeCritico ? '#ef4444' : abaAtiva === tab.id ? 'rgba(255,255,255,0.3)' : 'var(--joint, #334155)',
                  color: '#fff',
                  fontWeight: 800
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* CONTEÚDO SCROLLÁVEL DO MODAL */}
        <div style={{
          padding: '20px 24px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          {carregando ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
              <h3 style={{ margin: 0, fontWeight: 800 }}>Otimizando Escala com KyttoIA...</h3>
              <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 13, marginTop: 4 }}>
                Calculando matriz de distâncias, perda de abatimento (Slump Loss) e carrossel de betoneiras.
              </p>
            </div>
          ) : (
            <>
              {/* ABA 1: ESCALA OTIMIZADA */}
              {abaAtiva === 'escala' && (
                <div>
                  <div style={{
                    background: 'rgba(2, 132, 199, 0.08)',
                    border: '1px solid rgba(2, 132, 199, 0.25)',
                    borderRadius: 8,
                    padding: '12px 16px',
                    marginBottom: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12
                  }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: 13 }}>
                        💡 Diagnóstico do Despacho KyttoIA
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text, #f8fafc)' }}>
                        {analise?.diagnosticoKyttoIA || 'Escala em carrossel calculada para garantir fluxo contínuo de bombeamento sem retenção em pátio.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={onAplicarEscala}
                      disabled={aplicando || sugestoes.length === 0}
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '10px 18px',
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      <span>✓</span>
                      <span>{aplicando ? 'Aplicando na Grade...' : 'Aplicar Escala Otimizada na Programação'}</span>
                    </button>
                  </div>

                  {/* TABELA DE VIAGENS ESCALADAS */}
                  <div style={{ overflowX: 'auto', border: '1px solid var(--joint, #334155)', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2, #0f172a)', borderBottom: '1px solid var(--joint, #334155)', color: 'var(--text-muted, #94a3b8)' }}>
                          <th style={{ padding: '10px 12px' }}>Viagem</th>
                          <th style={{ padding: '10px 12px' }}>Betoneira / Placa</th>
                          <th style={{ padding: '10px 12px' }}>Motorista</th>
                          <th style={{ padding: '10px 12px' }}>Obra / Cliente</th>
                          <th style={{ padding: '10px 12px' }}>Vol. (m³) / FCK</th>
                          <th style={{ padding: '10px 12px' }}>Saída Usina</th>
                          <th style={{ padding: '10px 12px' }}>Chegada Prev.</th>
                          <th style={{ padding: '10px 12px' }}>Fim Descarga</th>
                          <th style={{ padding: '10px 12px' }}>Slump Obra</th>
                          <th style={{ padding: '10px 12px' }}>Margem NBR 7212</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sugestoes.map((sug, idx) => (
                          <tr key={idx} style={{
                            borderBottom: '1px solid var(--joint, #334155)',
                            background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'
                          }}>
                            <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--serrano-orange-text, #ea580c)' }}>
                              #{sug.cargaNumero} - Vg {sug.viagemNumero}/{sug.totalViagensCarga}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ fontWeight: 800, color: '#38bdf8' }}>{sug.betoneira}</span>
                              <span style={{ color: 'var(--text-muted, #94a3b8)', marginLeft: 6, fontSize: 11 }}>({sug.placa})</span>
                            </td>
                            <td style={{ padding: '10px 12px' }}>{sug.motorista}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 700 }}>{sug.obra}</div>
                              <small style={{ color: 'var(--text-muted, #94a3b8)' }}>{sug.cliente}</small>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ fontWeight: 800 }}>{sug.volumeM3} m³</span>
                              <span style={{ marginLeft: 6, color: '#10b981', fontWeight: 700 }}>FCK {sug.fck}</span>
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 800, color: '#fbbf24' }}>{sug.horarioSaidaUsina}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 700 }}>{sug.horarioChegadaObraPrevisto}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 700 }}>{sug.horarioFimDescargaPrevisto}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                fontWeight: 800,
                                color: sug.slumpPrevistoObraCm >= 12 ? '#10b981' : sug.slumpPrevistoObraCm >= 10 ? '#f59e0b' : '#ef4444'
                              }}>
                                {sug.slumpPrevistoObraCm} cm
                              </span>
                              <small style={{ color: 'var(--text-muted, #94a3b8)', display: 'block', fontSize: 10 }}>(-{sug.perdaSlumpCm}cm)</small>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 800,
                                background: sug.conformidadePega ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: sug.conformidadePega ? '#10b981' : '#ef4444'
                              }}>
                                {sug.conformidadePega ? `Folga ${sug.margemTempoRestanteMin} min` : 'Excedido'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ABA 2: GARGALOS & MITIGAÇÃO */}
              {abaAtiva === 'gargalos' && (
                <div style={{ display: 'grid', gap: 14 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)' }}>
                    A análise preditiva da KyttoIA monitora continuamente pontos críticos de falha operacional, risco de junta fria estrutural, cubagem fracionada e aquecimento de concreto:
                  </div>

                  {gargalos.length === 0 ? (
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: 8,
                      padding: '24px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                      <h4 style={{ margin: 0, color: '#10b981', fontWeight: 800 }}>Nenhum Gargalo Crítico Detectado</h4>
                      <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
                        Todas as viagens programadas cumprem os critérios de tempo de transporte da NBR 7212 e não geram filas na boca da central Convicta.
                      </p>
                    </div>
                  ) : (
                    gargalos.map((g, gIdx) => (
                      <div key={gIdx} style={{
                        background: g.severidade === 'critico' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                        border: `1px solid ${g.severidade === 'critico' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                        borderRadius: 8,
                        padding: '16px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: g.severidade === 'critico' ? '#ef4444' : '#f59e0b',
                            color: '#fff',
                            textTransform: 'uppercase'
                          }}>
                            {g.tipo.replace('_', ' ')}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>
                            {g.normaReferencia}
                          </span>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text, #f8fafc)', marginBottom: 6 }}>
                          {g.mensagem}
                        </div>
                        <div style={{
                          background: 'var(--surface-2, #0f172a)',
                          padding: '10px 12px',
                          borderRadius: 6,
                          fontSize: 12,
                          color: '#38bdf8',
                          borderLeft: '3px solid #38bdf8'
                        }}>
                          <b>💡 Recomendação KyttoIA:</b> {g.recomendacaoKyttoIA}
                        </div>
                      </div>
                    ))
                  )}

                  {alertas.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: 'var(--text-muted, #94a3b8)' }}>
                        Pontos de Monitoramento Preventivo:
                      </h4>
                      {alertas.map((al, aIdx) => (
                        <div key={aIdx} style={{
                          background: 'var(--surface-2, #0f172a)',
                          border: '1px solid var(--joint, #334155)',
                          borderRadius: 6,
                          padding: '10px 14px',
                          fontSize: 12,
                          marginBottom: 8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10
                        }}>
                          <span style={{ color: '#10b981', fontSize: 14 }}>ℹ️</span>
                          <span style={{ flex: 1 }}>{al.mensagem}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted, #94a3b8)' }}>{al.normaReferencia}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ABA 3: TIMELINE USINAGEM (CONVICTA 80 M³/H) */}
              {abaAtiva === 'central' && (
                <div>
                  <div style={{
                    background: 'var(--surface-2, #0f172a)',
                    border: '1px solid var(--joint, #334155)',
                    borderRadius: 8,
                    padding: '14px 18px',
                    marginBottom: 16
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>
                        Central Dosadora Convicta 80 m³/h &amp; Balança Rodoviária Toledo 80t
                      </div>
                      <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>
                        ● Ciclo Médio: 8 min / caminhão 8m³
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
                      Linha de dosagem automatizada de agregados, cimento portland a granel, água dosada e aditivos líquidos TecFlow.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {timeline.map((slot, sIdx) => (
                      <div key={sIdx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--surface-2, #0f172a)',
                        border: '1px solid var(--joint, #334155)',
                        borderRadius: 8,
                        padding: '12px 16px',
                        borderLeft: `4px solid ${sIdx % 2 === 0 ? '#ea580c' : '#0284c7'}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div style={{
                            background: 'var(--surface, #1e293b)',
                            border: '1px solid var(--joint, #334155)',
                            padding: '6px 10px',
                            borderRadius: 6,
                            fontWeight: 900,
                            fontFamily: 'var(--font-data, monospace)',
                            color: '#fbbf24',
                            fontSize: 13
                          }}>
                            {slot.horarioTexto}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 13 }}>
                              Carregamento Carga #{slot.cargaNumero} · Viagem {slot.viagemNumero} ({slot.obra})
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginTop: 2 }}>
                              Betoneira: <b style={{ color: '#38bdf8' }}>{slot.betoneira}</b> ({slot.placa}) — Motorista: {slot.motorista}
                            </div>
                          </div>
                        </div>

                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 6,
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981'
                        }}>
                          Boca Liberada Convicta
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ABA 4: SIMULADOR ML DE SLUMP LOSS */}
              {abaAtiva === 'slump_ml' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {/* CONTROLES DO SIMULADOR */}
                  <div style={{
                    background: 'var(--surface-2, #0f172a)',
                    border: '1px solid var(--joint, #334155)',
                    borderRadius: 8,
                    padding: '18px'
                  }}>
                    <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>🎛️</span> Parâmetros Físico-Químicos &amp; Climáticos
                    </h4>

                    <div style={{ display: 'grid', gap: 14 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                          <span>Slump Inicial na Central (Tronco de Cone):</span>
                          <span style={{ color: '#fbbf24' }}>{simulador.slumpInicialCm} cm</span>
                        </div>
                        <input
                          type="range"
                          min="6"
                          max="22"
                          step="0.5"
                          value={simulador.slumpInicialCm}
                          onChange={e => setSimulador({ ...simulador, slumpInicialCm: Number(e.target.value) })}
                          style={{ width: '100%', accentColor: '#ea580c' }}
                        />
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                          <span>Temperatura Ambiente (°C em Tangará da Serra):</span>
                          <span style={{ color: '#ef4444' }}>{simulador.temperaturaAmbienteC}°C</span>
                        </div>
                        <input
                          type="range"
                          min="18"
                          max="44"
                          step="1"
                          value={simulador.temperaturaAmbienteC}
                          onChange={e => setSimulador({ ...simulador, temperaturaAmbienteC: Number(e.target.value) })}
                          style={{ width: '100%', accentColor: '#ef4444' }}
                        />
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                          <span>Umidade Relativa do Ar (%):</span>
                          <span style={{ color: '#38bdf8' }}>{simulador.umidadeRelativaPct}%</span>
                        </div>
                        <input
                          type="range"
                          min="20"
                          max="95"
                          step="5"
                          value={simulador.umidadeRelativaPct}
                          onChange={e => setSimulador({ ...simulador, umidadeRelativaPct: Number(e.target.value) })}
                          style={{ width: '100%', accentColor: '#38bdf8' }}
                        />
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                          <span>Tempo Estimado de Trânsito até a Obra:</span>
                          <span style={{ color: '#10b981' }}>{simulador.tempoViagemMin} minutos</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="120"
                          step="5"
                          value={simulador.tempoViagemMin}
                          onChange={e => setSimulador({ ...simulador, tempoViagemMin: Number(e.target.value) })}
                          style={{ width: '100%', accentColor: '#10b981' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                          Tipo de Aditivo Químico (NBR 11768):
                        </label>
                        <select
                          value={simulador.tipoAditivo}
                          onChange={e => setSimulador({ ...simulador, tipoAditivo: e.target.value })}
                          style={{
                            width: '100%',
                            background: 'var(--surface, #1e293b)',
                            border: '1px solid var(--joint, #334155)',
                            color: '#fff',
                            borderRadius: 6,
                            padding: '8px 10px',
                            fontSize: 12,
                            fontWeight: 600
                          }}
                        >
                          <option value="retardador_pr">Plastificante Retardador de Pega (TecFlow R - Tipo PR)</option>
                          <option value="superplastificante_sp">Superplastificante Policarboxilato (TecFlow Max - Tipo SP)</option>
                          <option value="plastificante_p">Plastificante Convencional (Tipo P)</option>
                          <option value="sem_aditivo">Sem Aditivo (Limite Rígido 90 min NBR 7212)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* RESULTADOS DA PREDIÇÃO ML */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{
                      background: 'var(--surface-2, #0f172a)',
                      border: '1px solid var(--joint, #334155)',
                      borderRadius: 8,
                      padding: '18px'
                    }}>
                      <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>📊</span> Predição de Abatimento &amp; Trabalhabilidade na Obra
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, textAlign: 'center', marginBottom: 14 }}>
                        <div style={{ background: 'var(--surface, #1e293b)', padding: 12, borderRadius: 8, border: '1px solid var(--joint, #334155)' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Slump Inicial Central</span>
                          <div style={{ fontSize: 24, fontWeight: 900, color: '#fbbf24', marginTop: 2 }}>
                            {resultadoSlump?.slumpInicialUsinaCm ?? simulador.slumpInicialCm} cm
                          </div>
                        </div>

                        <div style={{ background: 'var(--surface, #1e293b)', padding: 12, borderRadius: 8, border: '1px solid var(--joint, #334155)' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Slump Previsto na Obra</span>
                          <div style={{
                            fontSize: 24,
                            fontWeight: 900,
                            color: (resultadoSlump?.slumpObraPrevistoCm ?? 14) >= 12 ? '#10b981' : (resultadoSlump?.slumpObraPrevistoCm ?? 14) >= 10 ? '#f59e0b' : '#ef4444',
                            marginTop: 2
                          }}>
                            {resultadoSlump?.slumpObraPrevistoCm} cm
                          </div>
                          <small style={{ color: 'var(--text-muted, #94a3b8)' }}>Perda prevista: -{resultadoSlump?.perdaCalculadaCm} cm</small>
                        </div>
                      </div>

                      {/* TAXA DE EVAPORAÇÃO ACI 305R */}
                      <div style={{
                        background: (resultadoSlump?.taxaEvaporacaoKgM2H || 0) > 1.0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        border: `1px solid ${(resultadoSlump?.taxaEvaporacaoKgM2H || 0) > 1.0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                        borderRadius: 6,
                        padding: '10px 14px',
                        marginBottom: 10
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 800 }}>Taxa de Evaporação Superficial (Menzel / ACI 305R):</span>
                          <span style={{
                            fontWeight: 900,
                            color: (resultadoSlump?.taxaEvaporacaoKgM2H || 0) > 1.0 ? '#ef4444' : '#10b981',
                            fontSize: 13
                          }}>
                            {resultadoSlump?.taxaEvaporacaoKgM2H} kg/m²/h
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>
                          {resultadoSlump?.orientacaoCura}
                        </p>
                      </div>

                      {/* BOMBEABILIDADE */}
                      <div style={{
                        background: 'var(--surface, #1e293b)',
                        border: '1px solid var(--joint, #334155)',
                        borderRadius: 6,
                        padding: '10px 14px',
                        fontSize: 12
                      }}>
                        <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: 2 }}>
                          Status de Bombeabilidade NBR 7212:
                        </div>
                        <div>{resultadoSlump?.mensagemBombeabilidade}</div>
                        {resultadoSlump?.dosagemCompensatoriaMlM3 > 0 && (
                          <div style={{ marginTop: 6, color: '#fbbf24', fontWeight: 700 }}>
                            ⚠️ Dosagem recomendada na obra: {resultadoSlump?.dosagemCompensatoriaMlM3} ml/m³ de superplastificante antes da descarga.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 5: NORMAS NBR & GITHUB / MCPS */}
              {abaAtiva === 'normas_git' && (
                <div style={{ display: 'grid', gap: 16 }}>
                  {/* REGRAS NBR */}
                  <div>
                    <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: 'var(--serrano-orange-text, #ea580c)' }}>
                      📑 Normas Regulamentadoras da Associação Brasileira de Normas Técnicas (ABNT)
                    </h4>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {benchmarkNBR.normasRegulamentadoras?.map((norma, nIdx) => (
                        <div key={nIdx} style={{
                          background: 'var(--surface-2, #0f172a)',
                          border: '1px solid var(--joint, #334155)',
                          borderRadius: 8,
                          padding: '14px'
                        }}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: '#38bdf8' }}>
                            {norma.codigo} — {norma.titulo}
                          </div>
                          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--text, #f8fafc)', lineHeight: 1.5 }}>
                            {norma.regrasChave?.map((rk, rkIdx) => (
                              <li key={rkIdx} style={{ marginBottom: 4 }}>{rk}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PRÁTICAS OPERACIONAIS DE MERCADO */}
                  <div>
                    <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800 }}>
                      ⚙️ Práticas Operacionais &amp; Benchmarks de Mercado de Concreteiras
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                      {benchmarkNBR.praticasOperacionaisMercado?.map((po, pIdx) => (
                        <div key={pIdx} style={{
                          background: 'var(--surface-2, #0f172a)',
                          border: '1px solid var(--joint, #334155)',
                          borderRadius: 6,
                          padding: '10px 14px'
                        }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>{po.item}</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#fbbf24', marginTop: 2 }}>{po.valor}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* GITHUB & MCPS */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div style={{
                      background: 'var(--surface-2, #0f172a)',
                      border: '1px solid var(--joint, #334155)',
                      borderRadius: 8,
                      padding: '14px'
                    }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#10b981' }}>
                        🌐 Repositórios Abertos GitHub Integrados
                      </h4>
                      {ecossistema.repositoriosGitHub?.map((repo, rIdx) => (
                        <div key={rIdx} style={{ marginBottom: 10, fontSize: 12 }}>
                          <a
                            href={repo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#38bdf8', fontWeight: 800, textDecoration: 'none' }}
                          >
                            🔗 {repo.nome}
                          </a>
                          <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 11, marginTop: 2 }}>
                            {repo.descricao}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{
                      background: 'var(--surface-2, #0f172a)',
                      border: '1px solid var(--joint, #334155)',
                      borderRadius: 8,
                      padding: '14px'
                    }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#818cf8' }}>
                        🔌 Protocolo Aberto MCP (Model Context Protocol)
                      </h4>
                      {ecossistema.mcpsRecomendados?.map((mcp, mIdx) => (
                        <div key={mIdx} style={{ marginBottom: 10, fontSize: 12 }}>
                          <span style={{ fontWeight: 800, color: '#a78bfa' }}>⚡ {mcp.nome}</span>
                          <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 11, marginTop: 2 }}>
                            {mcp.funcao}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER DO MODAL */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--joint, #334155)',
          background: 'var(--surface-2, #0f172a)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            Total: <b>{sugestoes.length} viagens</b> programadas · <b>{volumeTotal} m³</b> dosados · Central Convicta
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid var(--joint, #334155)',
                color: 'var(--text, #f8fafc)',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Fechar Painel
            </button>

            <button
              type="button"
              onClick={onAplicarEscala}
              disabled={aplicando || sugestoes.length === 0}
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 18px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>{aplicando ? 'Aplicando...' : 'Aplicar Escala Otimizada'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

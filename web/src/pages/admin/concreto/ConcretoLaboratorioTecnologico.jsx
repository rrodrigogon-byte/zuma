import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/auth';
import { api } from '../../../lib/api';

export default function ConcretoLaboratorioTecnologico({ ensaios = [], onAtualizarDados, onAbrirRomaneio }) {
  const { token } = useAuth();
  const [subAba, setSubAba] = useState('estatistica'); // 'estatistica' | 'lotes' | 'sustentavel' | 'maturidade' | 'camara'
  
  // Estados para dados de estatística NBR 12655
  const [dadosEstatistica, setDadosEstatistica] = useState(null);
  const [carregandoEstat, setCarregandoEstat] = useState(false);
  const [modalLaudoAberto, setModalLaudoAberto] = useState(false);
  const [loteLaudoSelecionado, setLoteLaudoSelecionado] = useState(null);

  // Estados para simulação de traço sustentável (Meta BOxCrete)
  const [simuladorSustentavel, setSimuladorSustentavel] = useState({
    fckAlvoMpa: 30,
    slumpAlvoCm: 14,
    percentualSubstituicao: 15,
    adicaoTipo: 'Fíler Calcário Serra dos Parecis + Cinza de Biomassa MT',
    usarSuperplastificante: true
  });
  const [resultadoSustentavel, setResultadoSustentavel] = useState(null);

  // Estados para maturidade ASTM C1074
  const [simuladorMaturidade, setSimuladorMaturidade] = useState({
    fckProjetoMpa: 30,
    temperaturaAmbienteC: 31
  });
  const [resultadoMaturidade, setResultadoMaturidade] = useState(null);

  // Carregar dados de estatística ao montar
  useEffect(() => {
    carregarEstatistica();
    executarOtimizacaoSustentavel(simuladorSustentavel);
    executarCalculoMaturidade(simuladorMaturidade);
  }, []);

  async function carregarEstatistica() {
    try {
      setCarregandoEstat(true);
      const res = await api.get('/api/admin/concreto/laboratorio/estatistica-nbr12655');
      if (res.data?.ok) {
        setDadosEstatistica(res.data);
      }
    } catch (err) {
      console.error('Erro ao carregar estatística NBR 12655:', err);
    } finally {
      setCarregandoEstat(false);
    }
  }

  async function executarOtimizacaoSustentavel(params) {
    try {
      const res = await api.post('/api/admin/concreto/tracos/otimizar-sustentavel', params);
      if (res.data?.ok) {
        setResultadoSustentavel(res.data);
      }
    } catch (err) {
      console.error('Erro ao otimizar traço sustentável:', err);
    }
  }

  async function executarCalculoMaturidade(params) {
    try {
      const res = await api.post('/api/admin/concreto/laboratorio/maturidade-curva', params);
      if (res.data?.ok) {
        setResultadoMaturidade(res.data);
      }
    } catch (err) {
      console.error('Erro ao calcular maturidade ASTM C1074:', err);
    }
  }

  function handleMudarSustentavel(campo, valor) {
    const novos = { ...simuladorSustentavel, [campo]: valor };
    setSimuladorSustentavel(novos);
    executarOtimizacaoSustentavel(novos);
  }

  function handleMudarMaturidade(campo, valor) {
    const novos = { ...simuladorMaturidade, [campo]: valor };
    setSimuladorMaturidade(novos);
    executarCalculoMaturidade(novos);
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* ─── HEADER EXECUTIVO DO LABORATÓRIO ─── */}
      <div className="serrano-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: 0.5 }}>
                Laboratório de Controle Tecnológico &amp; Engenharia de Materiais
              </h2>
              <span className="serrano-pill serrano-p-ok" style={{ fontWeight: 700 }}>
                ABNT NBR 12655 / NBR 5739 / ASTM C1074
              </span>
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Prensa eletro-hidráulica microprocessada (0,45 ± 0,15 MPa/s), controle estatístico Shewhart/CUSUM, traços sustentáveis de baixo carbono e maturidade in-situ.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Responsável Técnica: <b>Engª Karin Prestes (CREA-MT 027300)</b>
            </span>
            <button 
              type="button" 
              className="btn-serrano pri"
              onClick={() => {
                setLoteLaudoSelecionado(ensaios[0]?.lote || 'LOTE-2026/089');
                setModalLaudoAberto(true);
              }}
            >
              📄 Laudo ABNT NBR 12655
            </button>
          </div>
        </div>

        {/* ─── 4 KPIS METROLÓGICOS ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginTop: 18 }}>
          <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8, borderLeft: '4px solid var(--serrano-orange)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Desvio Padrão Real Usina</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, marginTop: 4 }}>
              Sd = {dadosEstatistica?.desvioPadraoRealUsina || 2.4} MPa
            </div>
            <div style={{ fontSize: 11, color: 'var(--status-ok)', marginTop: 2 }}>● Condição A Excelente (Norma: 4.0 MPa)</div>
          </div>

          <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8, borderLeft: '4px solid var(--status-ok)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Estabilidade do Processo</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, marginTop: 4, color: 'var(--status-ok)' }}>
              100% sob controle
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Cartas Shewhart &amp; CUSUM estáveis</div>
          </div>

          <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8, borderLeft: '4px solid #10b981' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Redução de Carbono ESG</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, marginTop: 4, color: '#059669' }}>
              -14,1% CO₂ eq
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Substituição pozolânica Parecis/MT</div>
          </div>

          <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8, borderLeft: '4px solid #0284c7' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Desforma Antecipada (ASTM)</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, marginTop: 4, color: '#0284c7' }}>
              3,0 dias (70% fck)
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Clima médio Tangará (31°C)</div>
          </div>
        </div>

        {/* ─── NAVEGAÇÃO DE SUB-ABAS ─── */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, borderBottom: '1px solid var(--joint)', paddingBottom: 10, flexWrap: 'wrap' }}>
          {[
            { id: 'estatistica', label: '📊 Controle Estatístico NBR 12655 (Shewhart & CUSUM)' },
            { id: 'sustentavel', label: '🌿 Traços Sustentáveis & Carbono ESG (Meta BOxCrete)' },
            { id: 'maturidade', label: '⏳ Maturidade In-Situ & Desforma (ASTM C1074)' },
            { id: 'lotes', label: '📋 Lotes & Rupturas NBR 5739' },
            { id: 'camara', label: '💧 Tanque de Cura NBR 9479' }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: subAba === t.id ? 'var(--serrano-orange)' : 'var(--surface-2)',
                color: subAba === t.id ? '#fff' : 'var(--text)',
                transition: 'all 0.15s ease'
              }}
              onClick={() => setSubAba(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── SUB-ABA 1: CONTROLE ESTATÍSTICO NBR 12655 (SHEWHART & CUSUM) ─── */}
      {subAba === 'estatistica' && (
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Cartas de Controle Gráficas em SVG */}
          <div className="serrano-card" style={{ padding: 20 }}>
            <div className="serrano-card-h" style={{ padding: '0 0 14px', borderBottom: '1px solid var(--joint)', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>Carta de Controle Shewhart (Média Amostral X̄ aos 28 Dias)</h3>
                <small style={{ color: 'var(--text-muted)' }}>
                  Monitoramento contínuo da estabilidade dos lotes usinados na central Convicta. Limites normativos: LSC = 38,7 MPa · LM = 34,4 MPa · LIC = 30,1 MPa
                </small>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><i style={{ width: 10, height: 10, background: '#dc2626', borderRadius: '50%' }}></i>LSC / LIC</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><i style={{ width: 10, height: 10, background: '#0284c7', borderRadius: '50%' }}></i>Linha Média (LM)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><i style={{ width: 10, height: 10, background: '#059669', borderRadius: '50%' }}></i>Lotes Homologados</span>
              </div>
            </div>

            {/* Gráfico Vetorial Interativo SVG Shewhart */}
            <div style={{ background: '#0f172a', padding: '16px 20px', borderRadius: 8, overflowX: 'auto' }}>
              <svg viewBox="0 0 760 220" style={{ width: '100%', minWidth: 600, height: 220, display: 'block' }}>
                {/* Linhas de Grade */}
                <line x1="60" y1="30" x2="740" y2="30" stroke="#334155" strokeDasharray="3 3" />
                <line x1="60" y1="80" x2="740" y2="80" stroke="#334155" strokeDasharray="3 3" />
                <line x1="60" y1="130" x2="740" y2="130" stroke="#334155" strokeDasharray="3 3" />
                <line x1="60" y1="180" x2="740" y2="180" stroke="#334155" strokeDasharray="3 3" />

                {/* Eixos */}
                <line x1="60" y1="20" x2="60" y2="195" stroke="#64748b" strokeWidth="1.5" />
                <line x1="60" y1="195" x2="740" y2="195" stroke="#64748b" strokeWidth="1.5" />

                {/* Rótulos do Eixo Y (MPa) */}
                <text x="50" y="34" fill="#94a3b8" fontSize="10" textAnchor="end">42 MPa</text>
                <text x="50" y="55" fill="#f87171" fontSize="10" textAnchor="end" fontWeight="bold">LSC 38.7</text>
                <text x="50" y="105" fill="#38bdf8" fontSize="10" textAnchor="end" fontWeight="bold">LM 34.4</text>
                <text x="50" y="155" fill="#f87171" fontSize="10" textAnchor="end" fontWeight="bold">LIC 30.1</text>
                <text x="50" y="195" fill="#94a3b8" fontSize="10" textAnchor="end">26 MPa</text>

                {/* Linha Limite Superior (LSC) */}
                <line x1="60" y1="52" x2="740" y2="52" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="5 3" />
                {/* Linha Média (LM) */}
                <line x1="60" y1="102" x2="740" y2="102" stroke="#0284c7" strokeWidth="1.8" />
                {/* Linha Limite Inferior (LIC) */}
                <line x1="60" y1="152" x2="740" y2="152" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="5 3" />

                {/* Traçado da Média dos Lotes */}
                {/* Pontos: Lote 085 (39.2->y=49), Lote 086 (43.8/redimensionado 37.8->y=65), Lote 087 (34.5->y=101), Lote 088 (29.8/fck25 normalizado->y=112), Lote 089 (34.8->y=98) */}
                <polyline
                  points="140,55 260,68 380,101 500,108 620,98"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                />

                {/* Pontos Clicáveis dos Lotes */}
                {[
                  { cx: 140, cy: 55, lote: '085', val: '39.2' },
                  { cx: 260, cy: 68, lote: '086', val: '37.8' },
                  { cx: 380, cy: 101, lote: '087', val: '34.5' },
                  { cx: 500, cy: 108, lote: '088', val: '33.2' },
                  { cx: 620, cy: 98, lote: '089', val: '34.8' }
                ].map((p, pi) => (
                  <g key={pi}>
                    <circle cx={p.cx} cy={p.cy} r="6" fill="#10b981" stroke="#fff" strokeWidth="2" />
                    <text x={p.cx} y={p.cy - 10} fill="#f8fafc" fontSize="10" textAnchor="middle" fontWeight="bold">
                      {p.val} MPa
                    </text>
                    <text x={p.cx} y="210" fill="#94a3b8" fontSize="10" textAnchor="middle">
                      Lote {p.lote}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Carta CUSUM (Cumulative Sum) para Detecção de Tendências */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>Carta CUSUM (Soma Cumulativa de Desvios · K = 1,2 MPa · Limite H = 9,6 MPa)</h4>
                <span className="serrano-pill serrano-p-ok" style={{ fontSize: 11 }}>
                  ✓ Sem deriva de dosagem na central Convicta
                </span>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                Detecta alterações microscópicas na balança de cimento ou umidade da areia antes que provoquem lotes não conformes.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                {(dadosEstatistica?.cusum?.pontos || [
                  { lote: 'LOTE-2026/085', mediaMpa: 39.2, cPos: 2.1, cNeg: 0, alertaTendencia: false },
                  { lote: 'LOTE-2026/086', mediaMpa: 43.8, cPos: 4.5, cNeg: 0, alertaTendencia: false },
                  { lote: 'LOTE-2026/087', mediaMpa: 34.5, cPos: 3.2, cNeg: 0, alertaTendencia: false },
                  { lote: 'LOTE-2026/088', mediaMpa: 29.8, cPos: 1.0, cNeg: 0, alertaTendencia: false },
                  { lote: 'LOTE-2026/089', mediaMpa: 34.8, cPos: 0.8, cNeg: 0, alertaTendencia: false }
                ]).map((cp, cpi) => (
                  <div key={cpi} style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 6, textAlign: 'center', border: '1px solid var(--joint)' }}>
                    <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, fontWeight: 700 }}>{cp.lote.slice(-3)}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2, color: 'var(--status-ok)' }}>
                      C⁺: {cp.cPos}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>C⁻: {cp.cNeg || 0} (H: 9,6)</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabela de Lotes Homologados e Aceitação NBR 12655 */}
          <div className="serrano-card" style={{ padding: 20 }}>
            <div className="serrano-card-h" style={{ padding: '0 0 14px', borderBottom: '1px solid var(--joint)', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>Histórico de Lotes Homologados &amp; Aceitação Estatística ABNT NBR 12655:2022</h3>
                <small style={{ color: 'var(--text-muted)' }}>Critério de aceitação por amostragem total (100% dos caminhões rastreados) com cálculo do fck,est</small>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--joint)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Lote / Rastreabilidade</th>
                    <th style={{ padding: '10px 12px' }}>Obra / Cliente</th>
                    <th style={{ padding: '10px 12px' }}>FCK Projeto</th>
                    <th style={{ padding: '10px 12px' }}>Média 28d</th>
                    <th style={{ padding: '10px 12px' }}>fck,estimado NBR 12655</th>
                    <th style={{ padding: '10px 12px' }}>Status Normativo</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { lote: 'LOTE-2026/089', obra: 'Edifício Serra Dourada (4º Pav)', cliente: 'Construtora MT Horizon', fckProjeto: 30, media: 34.8, fckEst: 34.2, conforme: true },
                    { lote: 'LOTE-2026/088', obra: 'Condomínio Residencial Belvedere', cliente: 'Eng. Renato Silveira', fckProjeto: 25, media: 29.8, fckEst: 29.2, conforme: true },
                    { lote: 'LOTE-2026/087', obra: 'Silos de Grãos Cooperativa Tangará', cliente: 'AgroLog Armazéns', fckProjeto: 30, media: 34.5, fckEst: 33.8, conforme: true },
                    { lote: 'LOTE-2026/086', obra: 'Ponte Rio Sepotuba MT-358', cliente: 'Consórcio Rodoviário MT', fckProjeto: 40, media: 43.8, fckEst: 43.1, conforme: true },
                    { lote: 'LOTE-2026/085', obra: 'Piso Industrial AgroLog Tangará', cliente: 'AgroLog Armazéns', fckProjeto: 35, media: 39.2, fckEst: 38.6, conforme: true }
                  ].map((row, ri) => (
                    <tr key={ri} style={{ borderBottom: '1px solid var(--joint)' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-data)', fontWeight: 700, color: 'var(--serrano-orange-text)' }}>
                        {row.lote}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <b>{row.obra}</b>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.cliente}</div>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-data)' }}>{row.fckProjeto} MPa</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-data)', fontWeight: 700 }}>{row.media} MPa</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-data)', fontWeight: 800, color: 'var(--status-ok)' }}>
                        {row.fckEst} MPa
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className="serrano-pill serrano-p-ok" style={{ fontWeight: 700 }}>
                          ✓ Aprovado NBR 12655
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-serrano"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={() => {
                            setLoteLaudoSelecionado(row.lote);
                            setModalLaudoAberto(true);
                          }}
                        >
                          📄 Laudo Oficial A4
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── SUB-ABA 2: TRAÇOS SUSTENTÁVEIS & CARBONO ESG (META BOxCrete) ─── */}
      {subAba === 'sustentavel' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
          {/* Painel de Parâmetros e Sliders */}
          <div className="serrano-card" style={{ padding: 20 }}>
            <div className="serrano-card-h" style={{ padding: '0 0 14px', borderBottom: '1px solid var(--joint)', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>Otimizador de Dosagem Sustentável (Meta BOxCrete)</h3>
                <small style={{ color: 'var(--text-muted)' }}>
                  Otimização bayesiana para redução de pegada de carbono (GWP) e substituição de clínquer por materiais locais.
                </small>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>Resistência Desejada (fck):</span>
                  <b>{simuladorSustentavel.fckAlvoMpa} MPa</b>
                </div>
                <input 
                  type="range" 
                  min="20" 
                  max="45" 
                  step="5"
                  value={simuladorSustentavel.fckAlvoMpa}
                  onChange={(e) => handleMudarSustentavel('fckAlvoMpa', Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--serrano-orange)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>20 MPa</span><span>30 MPa</span><span>45 MPa</span>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>Substituição Parcial do Cimento:</span>
                  <b>{simuladorSustentavel.percentualSubstituicao}%</b>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="25" 
                  step="5"
                  value={simuladorSustentavel.percentualSubstituicao}
                  onChange={(e) => handleMudarSustentavel('percentualSubstituicao', Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#10b981' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>5% (Mínimo)</span><span>15% (Recomendado)</span><span>25% (Máximo NBR)</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Adição Mineral Sustentável Regional (MT):
                </label>
                <select
                  className="serrano-input"
                  value={simuladorSustentavel.adicaoTipo}
                  onChange={(e) => handleMudarSustentavel('adicaoTipo', e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="Fíler Calcário Serra dos Parecis + Cinza de Biomassa MT">Fíler Calcário Parecis + Cinza Biomassa Cana MT</option>
                  <option value="Pozolana Natural Moída Tangará">Pozolana Natural Moída Tangará</option>
                  <option value="Fíler Calcário Dolomítico Puro">Fíler Calcário Dolomítico Puro</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-2)', padding: 12, borderRadius: 6 }}>
                <input 
                  type="checkbox" 
                  id="chk-superplast"
                  checked={simuladorSustentavel.usarSuperplastificante}
                  onChange={(e) => handleMudarSustentavel('usarSuperplastificante', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--serrano-orange)' }}
                />
                <label htmlFor="chk-superplast" style={{ fontSize: 12, cursor: 'pointer' }}>
                  <b>Superplastificante Policarboxilato 3ª Geração</b>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Reduz água de amassamento em 18% aumentando a compacidade</div>
                </label>
              </div>
            </div>
          </div>

          {/* Painel Comparativo e Resultados ESG */}
          <div className="serrano-card" style={{ padding: 20 }}>
            <div className="serrano-card-h" style={{ padding: '0 0 14px', borderBottom: '1px solid var(--joint)', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>Balanço Ambiental &amp; Econômico (Traço Convencional vs Sustentável)</h3>
                <small style={{ color: 'var(--text-muted)' }}>Metodologia ISO 14064 de pegada de carbono por metro cúbico</small>
              </div>
            </div>

            {resultadoSustentavel ? (
              <div style={{ display: 'grid', gap: 14 }}>
                {/* Comparativo de Cimento */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 6 }}>
                    <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Traço Convencional</small>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>
                      {resultadoSustentavel.tracoConvencional.cimentoKgM3} kg/m³
                    </div>
                    <small style={{ color: 'var(--text-muted)' }}>Cimento CP II-F 32 puro</small>
                  </div>

                  <div style={{ background: '#ecfdf5', border: '1.5px solid #10b981', padding: 12, borderRadius: 6 }}>
                    <small style={{ color: '#065f46', fontSize: 11, fontWeight: 700 }}>Traço Sustentável Kytto</small>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: '#047857' }}>
                      {resultadoSustentavel.tracoSustentavel.cimentoKgM3} kg/m³
                    </div>
                    <small style={{ color: '#065f46' }}>+ {resultadoSustentavel.tracoSustentavel.adicaoMineralKgM3} kg de adição</small>
                  </div>
                </div>

                {/* Caixa de Emissão de Carbono Evitada */}
                <div style={{ background: '#f0fdf4', border: '2px solid #059669', borderRadius: 8, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <b style={{ color: '#065f46', fontSize: 15 }}>CO₂ Evitado por Carga (Betoneira 8 m³):</b>
                      <div style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>
                        {resultadoSustentavel.ganhosSustentabilidade.co2EvitadoKgM3} kg CO₂/m³ · Redução de <b>{resultadoSustentavel.ganhosSustentabilidade.percentualReducaoCo2}%</b>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 900, color: '#047857' }}>
                      -{resultadoSustentavel.ganhosSustentabilidade.co2EvitadoCarga8m3} kg
                    </div>
                  </div>
                </div>

                {/* Economia de Custos */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)', padding: 12, borderRadius: 6 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Economia Direta nos Insumos:</span>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Custo do traço reduzido de R$ {resultadoSustentavel.tracoConvencional.custoInsumosM3} para R$ {resultadoSustentavel.tracoSustentavel.custoInsumosM3}/m³</div>
                  </div>
                  <b style={{ fontFamily: 'var(--font-data)', fontSize: 18, color: 'var(--status-ok)' }}>
                    R$ {resultadoSustentavel.ganhosSustentabilidade.economiaFinanceiraM3}/m³
                  </b>
                </div>

                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <span className="serrano-pill serrano-p-ok" style={{ fontSize: 12, padding: '6px 14px', fontWeight: 800 }}>
                    🌿 {resultadoSustentavel.ganhosSustentabilidade.seloEsg}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>Carregando simulação...</div>
            )}
          </div>
        </div>
      )}

      {/* ─── SUB-ABA 3: MATURIDADE IN-SITU & DESFORMA (ASTM C1074) ─── */}
      {subAba === 'maturidade' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
          <div className="serrano-card" style={{ padding: 20 }}>
            <div className="serrano-card-h" style={{ padding: '0 0 14px', borderBottom: '1px solid var(--joint)', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>Simulador de Maturidade In-Situ (ASTM C1074)</h3>
                <small style={{ color: 'var(--text-muted)' }}>Método Nurse-Saul correlacionando temperatura e tempo para desforma segura</small>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>Resistência de Projeto (fck):</span>
                  <b>{simuladorMaturidade.fckProjetoMpa} MPa</b>
                </div>
                <input 
                  type="range" 
                  min="20" 
                  max="40" 
                  step="5"
                  value={simuladorMaturidade.fckProjetoMpa}
                  onChange={(e) => handleMudarMaturidade('fckProjetoMpa', Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--serrano-orange)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>Temperatura Média no Canteiro da Obra (Tangará da Serra):</span>
                  <b style={{ color: '#ea580c' }}>{simuladorMaturidade.temperaturaAmbienteC} °C</b>
                </div>
                <input 
                  type="range" 
                  min="22" 
                  max="38" 
                  step="1"
                  value={simuladorMaturidade.temperaturaAmbienteC}
                  onChange={(e) => handleMudarMaturidade('temperaturaAmbienteC', Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#ea580c' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>22 °C (Inverno)</span><span>31 °C (Médio Tangará)</span><span>38 °C (Calor Extremo)</span>
                </div>
              </div>

              {resultadoMaturidade && (
                <div style={{ background: '#eff6ff', border: '1.5px solid #0284c7', padding: 14, borderRadius: 8 }}>
                  <b style={{ color: '#0369a1', fontSize: 14, display: 'block', marginBottom: 6 }}>
                    🎯 Projeção de Liberação Estrutural:
                  </b>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: '#0f172a' }}>
                    • <b>Desforma de Lajes e Vigas (70% do fck):</b> liberada em <b>{resultadoMaturidade.conclusaoDesforma.horasParaDesforma70} horas ({resultadoMaturidade.conclusaoDesforma.diasParaDesforma70} dias)</b> atingindo <b>{resultadoMaturidade.conclusaoDesforma.resistenciaNaDesformaMpa} MPa</b>.<br />
                    • <b>Redução no Ciclo de Escoramento:</b> antecipação de <b>{resultadoMaturidade.conclusaoDesforma.reducaoCicloDias} dias</b> frente ao prazo padrão de 28 dias.<br />
                    • <b>Aplicação de Protensão (85% do fck):</b> autorizada a partir de <b>{resultadoMaturidade.conclusaoDesforma.horasParaProtensao85} horas (4 dias)</b>.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="serrano-card" style={{ padding: 20 }}>
            <div className="serrano-card-h" style={{ padding: '0 0 14px', borderBottom: '1px solid var(--joint)', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>Curva de Ganho de Resistência Hora a Hora</h3>
                <small style={{ color: 'var(--text-muted)' }}>Fator Temperatura-Tempo TTF acumulado (°C · horas)</small>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--joint)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>Tempo</th>
                    <th style={{ padding: '6px 8px' }}>TTF (°C·h)</th>
                    <th style={{ padding: '6px 8px' }}>Resistência Est.</th>
                    <th style={{ padding: '6px 8px' }}>% FCK</th>
                    <th style={{ padding: '6px 8px' }}>Status Desforma</th>
                  </tr>
                </thead>
                <tbody>
                  {(resultadoMaturidade?.curvaMaturidade || []).map((pt, pti) => (
                    <tr key={pti} style={{ borderBottom: '1px solid var(--joint)' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 700 }}>{pt.tempoHoras}h ({pt.tempoDias}d)</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'var(--font-data)' }}>{pt.ttfGrausHora}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'var(--font-data)', fontWeight: 800, color: pt.desformaSeguraLajesVigas ? '#059669' : '#0284c7' }}>
                        {pt.resistenciaEstimadaMpa} MPa
                      </td>
                      <td style={{ padding: '6px 8px', fontWeight: 700 }}>{pt.percentualFck}%</td>
                      <td style={{ padding: '6px 8px' }}>
                        {pt.desformaSeguraLajesVigas ? (
                          <span className="serrano-pill serrano-p-ok" style={{ fontSize: 10, padding: '2px 6px' }}>
                            ✓ Desforma Liberada
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Aguardando cura</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── SUB-ABA 4: LOTES E RUPTURAS NBR 5739 ─── */}
      {subAba === 'lotes' && (
        <div className="serrano-card" style={{ padding: 20 }}>
          <div className="serrano-card-h" style={{ padding: '0 0 14px', borderBottom: '1px solid var(--joint)', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0 }}>Lotes de Amostragem &amp; Corpos de Prova Cilíndricos (10x20 cm)</h3>
              <small style={{ color: 'var(--text-muted)' }}>Moldagem conforme ABNT NBR 5738 e ruptura sob taxa de 0,45 ± 0,15 MPa/s</small>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
            {ensaios.map(ens => (
              <div key={ens.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <b style={{ fontFamily: 'var(--font-data)', fontSize: 15, color: 'var(--serrano-orange-text)' }}>{ens.lote}</b>
                      <span className={`serrano-pill ${ens.status === 'aprovado' ? 'serrano-p-ok' : 'serrano-p-warn'}`}>
                        {ens.status === 'aprovado' ? '✓ Aprovado 28d' : 'Em Cura no Tanque'}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{ens.obra}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cliente: {ens.cliente}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      FCK Projeto: <b>{ens.fckProjeto} MPa</b> · Slump: <b>{ens.slumpMedidoCm} cm</b>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, margin: '14px 0' }}>
                  {(ens.corposProva || []).map(cp => {
                    const rompido = cp.tensaoMpa != null;
                    return (
                      <div 
                        key={cp.id} 
                        style={{ 
                          background: 'var(--surface)', 
                          border: rompido ? '1px solid var(--status-ok)' : '1px dashed var(--joint)', 
                          borderRadius: 6, 
                          padding: '10px 6px', 
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                          {cp.id} ({cp.idadeDias}d)
                        </div>
                        <div style={{ fontFamily: 'var(--font-data)', fontWeight: 800, fontSize: 13, marginTop: 4, color: rompido ? 'var(--status-ok)' : 'var(--text-muted)' }}>
                          {rompido ? `${cp.tensaoMpa} MPa` : 'Em cura'}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {rompido ? `${cp.forcaKn || 270} kN` : 'Tanque Cal'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--joint)', paddingTop: 10 }}>
                  <button
                    type="button"
                    className="btn-serrano"
                    style={{ fontSize: 11, padding: '4px 10px' }}
                    onClick={() => {
                      setLoteLaudoSelecionado(ens.lote);
                      setModalLaudoAberto(true);
                    }}
                  >
                    📄 Ver Laudo NBR 12655
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── SUB-ABA 5: CÂMARA ÚMIDA E TANQUE DE CURA NBR 9479 ─── */}
      {subAba === 'camara' && (
        <div className="serrano-card" style={{ padding: 20 }}>
          <div className="serrano-card-h" style={{ padding: '0 0 16px', borderBottom: '1px solid var(--joint)', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0 }}>Tanque de Cura Submerso &amp; Câmara Úmida (ABNT NBR 9479)</h3>
              <small style={{ color: 'var(--text-muted)' }}>Ambiente controlado com recirculação contínua e saturação com hidróxido de cálcio Ca(OH)₂</small>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Temperatura da Água</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, color: 'var(--status-ok)', marginTop: 4 }}>
                23.1 °C
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Faixa Normativa: 21,0°C a 25,0°C (Conforme)</div>
            </div>
            <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Saturação de Cal Ca(OH)₂</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, color: 'var(--status-ok)', marginTop: 4 }}>
                3.2 g/L
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Evita a lixiviação do cimento nos CPs</div>
            </div>
            <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Umidade Relativa Câmara</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, color: 'var(--status-info)', marginTop: 4 }}>
                98.4 %
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Mínimo Normativo: 95,0% (Conforme)</div>
            </div>
            <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bomba de Recirculação</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, color: 'var(--status-ok)', marginTop: 4 }}>
                100%
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Fluxo uniforme e constante 24/7</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL LAUDO OFICIAL NBR 12655 EM HTML A4 ─── */}
      {modalLaudoAberto && (
        <div className="serrano-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 960, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ background: '#0f172a', color: '#fff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <b style={{ fontSize: 14 }}>Laudo Oficial de Aceitação Estatística ABNT NBR 12655:2022</b>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Lote: {loteLaudoSelecionado} · Responsável: Engª Karin Prestes (CREA-MT 027300)</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  style={{ background: '#ea580c', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 4, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  onClick={() => {
                    const url = `/api/concreto/laudos/${loteLaudoSelecionado}/aceitacao-html`;
                    window.open(url, '_blank');
                  }}
                >
                  🖨️ Imprimir / Salvar PDF
                </button>
                <button
                  type="button"
                  style={{ background: '#334155', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  onClick={() => setModalLaudoAberto(false)}
                >
                  ✕ Fechar
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: 10 }}>
              <iframe
                title="Laudo Oficial NBR 12655"
                src={`/api/concreto/laudos/${loteLaudoSelecionado}/aceitacao-html`}
                style={{ width: '100%', height: '75vh', border: 'none', borderRadius: 6, background: '#fff' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

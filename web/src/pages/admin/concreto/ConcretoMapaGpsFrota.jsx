import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

export default function ConcretoMapaGpsFrota() {
  const [gpsData, setGpsData] = useState(null);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    carregarGps();
    const interval = setInterval(carregarGps, 15000); // Polling 15s
    return () => clearInterval(interval);
  }, []);

  const carregarGps = async () => {
    try {
      const res = await api.get('/api/admin/concreto/frota/gps-rotas');
      if (res && res.ok) {
        setGpsData(res);
        if (!veiculoSelecionado && res.veiculosGps?.length > 0) {
          setVeiculoSelecionado(res.veiculosGps[1] || res.veiculosGps[0]); // Seleciona BT-02
        }
      }
    } catch (e) {
      console.warn('Falha ao carregar GPS da frota:', e);
    }
  };

  // Coordenadas projetadas no SVG (Width 760, Height 460)
  // Usina: (120, 240)
  // Sepotuba: (40, 400)
  // Jd Europa (Belvedere & Serra Dourada): (420, 160)
  // Distrito Industrial (AgroLog): (600, 320)
  // Alphaville: (380, 80)
  const LOCAIS_SVG = [
    { id: 'usina', nome: 'Usina Serrano Concreto (Base)', x: 140, y: 250, tipo: 'usina', icon: '🏭', desc: 'MT-358 km 12 · Central Convicta & Silos 96t' },
    { id: 'sepotuba', nome: 'Mineração Rio Sepotuba', x: 60, y: 400, tipo: 'mineracao', icon: '⛏️', desc: 'Porto de Areia Média Lavada e Britagem' },
    { id: 'belvedere', nome: 'Ed. Belvedere Tower', x: 440, y: 150, tipo: 'obra', icon: '🏢', desc: 'Grupo Moradda · Lajes 6º Pav (BL-01 operando)' },
    { id: 'serra_dourada', nome: 'Ed. Residencial Serra Dourada', x: 480, y: 190, tipo: 'obra', icon: '🏗️', desc: 'Construtora MT Horizon · BT-02 descarregando' },
    { id: 'agrolog', nome: 'Piso Industrial AgroLog', x: 620, y: 340, tipo: 'obra', icon: '🏭', desc: 'Distrito Industrial · BT-04 a caminho' },
    { id: 'alphaville', nome: 'Alphaville Tangará', x: 380, y: 70, tipo: 'obra', icon: '🏡', desc: 'Av. Lions Internacional · Lote 12' }
  ];

  const POSICOES_VEICULOS_SVG = {
    'BT-01': { x: 260, y: 220 }, // Retornando pela MT-358
    'BT-02': { x: 470, y: 200 }, // Na obra Serra Dourada
    'BT-03': { x: 130, y: 270 }, // No pátio
    'BT-04': { x: 530, y: 280 }, // Indo para Distrito Industrial
    'BT-05': { x: 150, y: 270 }, // No pátio
    'BL-01': { x: 430, y: 160 }, // Belvedere Tower
    'BL-02': { x: 170, y: 260 }  // Pátio
  };

  const veiculos = gpsData?.veiculosGps || [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
      
      {/* MAPA VETORIAL DE TANGARÁ DA SERRA */}
      <div className="serrano-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header do Mapa */}
        <div style={{ padding: '12px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--joint)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <b style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🗺️ Malha Viária de Tangará da Serra/MT · Rastreamento em Tempo Real
            </b>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Monitoramento GPS dos caminhões-betoneiras e bombas na MT-358 e malha urbana
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, background: 'var(--status-ok-bg)', color: 'var(--status-ok)', padding: '3px 8px', borderRadius: 12, fontWeight: 700 }}>
              ● 7 Veículos Conectados
            </span>
          </div>
        </div>

        {/* Canvas SVG Interativo */}
        <div style={{ position: 'relative', background: '#0f172a', flex: 1, minHeight: 440 }}>
          <svg viewBox="0 0 760 460" style={{ width: '100%', height: '100%', display: 'block' }}>
            <defs>
              <linearGradient id="gridGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <pattern id="roadGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" />
              </pattern>
            </defs>

            {/* Fundo com Grid */}
            <rect width="760" height="460" fill="url(#gridGrad)" />
            <rect width="760" height="460" fill="url(#roadGrid)" />

            {/* Rio Sepotuba (Curva Azul Sinusal) */}
            <path 
              d="M 10 450 Q 80 380 40 300 T 120 180 T 90 20" 
              fill="none" 
              stroke="#0284c7" 
              strokeWidth="14" 
              opacity="0.35" 
            />
            <text x="50" y="320" fill="#38bdf8" fontSize="10" fontWeight="bold" opacity="0.7" transform="rotate(-65, 50, 320)">
              Rio Sepotuba (Área de Extração)
            </text>

            {/* Rodovias e Vias Principais (MT-358) */}
            {/* MT-358 de Sepotuba até Usina e Centro */}
            <path 
              d="M 60 400 L 140 250 L 320 220 L 460 170 L 620 340" 
              fill="none" 
              stroke="#475569" 
              strokeWidth="6" 
              strokeLinecap="round" 
            />
            <path 
              d="M 60 400 L 140 250 L 320 220 L 460 170 L 620 340" 
              fill="none" 
              stroke="#f59e0b" 
              strokeWidth="1.5" 
              strokeDasharray="4 4" 
            />

            {/* Acesso Alphaville / Av Lions */}
            <path 
              d="M 320 220 L 380 70" 
              fill="none" 
              stroke="#475569" 
              strokeWidth="4" 
            />

            {/* Rota Ativa de Entrega: Usina -> Serra Dourada (BT-02) */}
            <path 
              d="M 140 250 L 320 220 L 480 190" 
              fill="none" 
              stroke="#10b981" 
              strokeWidth="3" 
              strokeDasharray="6 3" 
              opacity="0.8" 
            />

            {/* Rota Ativa de Retorno: Usina <- BT-01 */}
            <path 
              d="M 260 220 L 140 250" 
              fill="none" 
              stroke="#38bdf8" 
              strokeWidth="2.5" 
              strokeDasharray="4 4" 
              opacity="0.8" 
            />

            {/* Locais Chave / Canteiros */}
            {LOCAIS_SVG.map(loc => (
              <g key={loc.id} transform={`translate(${loc.x}, ${loc.y})`}>
                <circle 
                  r="14" 
                  fill={loc.tipo === 'usina' ? '#ea580c' : loc.tipo === 'mineracao' ? '#d97706' : '#334155'} 
                  stroke="#fff" 
                  strokeWidth="1.5" 
                />
                <text x="0" y="4" textAnchor="middle" fontSize="11">{loc.icon}</text>
                <text 
                  x="0" 
                  y="26" 
                  textAnchor="middle" 
                  fill="#f8fafc" 
                  fontSize="10" 
                  fontWeight="bold"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                >
                  {loc.nome}
                </text>
              </g>
            ))}

            {/* Veículos em Tempo Real */}
            {veiculos.map(v => {
              const pos = POSICOES_VEICULOS_SVG[v.codigo] || { x: 140, y: 250 };
              const isSelected = veiculoSelecionado?.codigo === v.codigo;
              const isBetoneira = v.tipo === 'betoneira';

              return (
                <g 
                  key={v.codigo} 
                  transform={`translate(${pos.x}, ${pos.y})`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setVeiculoSelecionado(v)}
                >
                  {/* Halo de Seleção */}
                  {isSelected && (
                    <circle r="18" fill="none" stroke="#ea580c" strokeWidth="2.5" strokeDasharray="3 3">
                      <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="4s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Marcador do Veículo */}
                  <rect 
                    x="-12" 
                    y="-10" 
                    width="24" 
                    height="20" 
                    rx="4" 
                    fill={v.status === 'descarregando_obra' ? '#10b981' : v.status === 'operando_obra' ? '#8b5cf6' : v.status === 'em_transito_obra' ? '#ea580c' : v.status === 'retornando_usina' ? '#38bdf8' : '#64748b'} 
                    stroke="#fff" 
                    strokeWidth="1.5" 
                  />
                  <text x="0" y="4" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold">
                    {v.codigo}
                  </text>

                  {/* Badge de RPM do Balão ou Pressão da Bomba */}
                  {isBetoneira && v.rpmTambor > 0 && (
                    <g transform="translate(14, -8)">
                      <rect x="0" y="0" width="36" height="12" rx="3" fill="#1e293b" stroke="#38bdf8" strokeWidth="0.8" />
                      <text x="18" y="9" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="bold">
                        {v.rpmTambor} rpm
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Legenda Flutuante */}
          <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)', padding: '6px 12px', borderRadius: 6, fontSize: 10, color: '#94a3b8', display: 'flex', gap: 12, border: '1px solid #334155' }}>
            <span><b style={{ color: '#ea580c' }}>■</b> Em Rota Obra</span>
            <span><b style={{ color: '#10b981' }}>■</b> Descarregando</span>
            <span><b style={{ color: '#38bdf8' }}>■</b> Retornando Usina</span>
            <span><b style={{ color: '#8b5cf6' }}>■</b> Bomba Lança</span>
            <span><b style={{ color: '#64748b' }}>■</b> Pátio Usina</span>
          </div>
        </div>

      </div>

      {/* PAINEL LATERAL: DETALHES DO VEÍCULO SELECIONADO */}
      <div className="serrano-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ borderBottom: '1px solid var(--joint)', paddingBottom: 10 }}>
          <b style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Telemetria Detalhada</b>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <h3 style={{ margin: 0, color: 'var(--serrano-orange-text)' }}>
              {veiculoSelecionado ? `${veiculoSelecionado.codigo} · ${veiculoSelecionado.placa}` : 'Selecione um Veículo'}
            </h3>
            {veiculoSelecionado && (
              <span className={`serrano-pill ${veiculoSelecionado.status.includes('obra') ? 'serrano-p-ok' : veiculoSelecionado.status.includes('transito') ? 'serrano-p-load' : 'serrano-p-plan'}`}>
                {veiculoSelecionado.status.replace('_', ' ').toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {veiculoSelecionado ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12 }}>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11 }}>Motorista Responsável</span>
              <b>{veiculoSelecionado.motorista}</b>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11 }}>Carga Atual</span>
              <b>{veiculoSelecionado.cargaAtual}</b>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--surface-2)', padding: 10, borderRadius: 6 }}>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Velocidade</small>
                <b style={{ fontSize: 15 }}>{veiculoSelecionado.velocidadeKmH} km/h</b>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Distância da Usina</small>
                <b style={{ fontSize: 15 }}>{veiculoSelecionado.distanciaUsinaKm} km</b>
              </div>
            </div>

            {veiculoSelecionado.tipo === 'betoneira' ? (
              <>
                <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 6, border: '1px solid var(--joint)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <small style={{ color: 'var(--text-muted)' }}>Giro do Balão</small>
                    <b style={{ color: 'var(--serrano-orange-text)', fontSize: 14 }}>{veiculoSelecionado.rpmTambor} RPM</b>
                  </div>
                  <div style={{ fontSize: 11, color: veiculoSelecionado.sentidoGiro === 'anti_horario' ? 'var(--status-ok)' : 'var(--text)' }}>
                    Sentido: <b>{veiculoSelecionado.sentidoGiro === 'anti_horario' ? '↺ Descarga na Obra' : veiculoSelecionado.sentidoGiro === 'horario' ? '↻ Agitação em Trânsito' : 'Parado'}</b>
                  </div>
                </div>

                {veiculoSelecionado.tempoRestantePegaMin !== undefined && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span>Tempo de Pega NBR 7212</span>
                      <b>{veiculoSelecionado.tempoDecorridoMinutos} / 150 min</b>
                    </div>
                    <div style={{ height: 6, background: 'var(--joint)', borderRadius: 3, overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          height: '100%', 
                          width: `${(veiculoSelecionado.tempoDecorridoMinutos / 150) * 100}%`,
                          background: veiculoSelecionado.tempoDecorridoMinutos > 120 ? '#ef4444' : '#10b981'
                        }} 
                      />
                    </div>
                    <small style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 4, display: 'block' }}>
                      Restam {veiculoSelecionado.tempoRestantePegaMin} min para término seguro da descarga
                    </small>
                  </div>
                )}
              </>
            ) : (
              <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 6 }}>
                <div style={{ fontSize: 11, marginBottom: 4 }}>
                  Alcance da Lança: <b>{veiculoSelecionado.lancaAbertaM} metros</b>
                </div>
                <div style={{ fontSize: 11, marginBottom: 4 }}>
                  Pressão Hidráulica: <b>{veiculoSelecionado.pressaoHidraulicaBar} bar</b>
                </div>
                <div style={{ fontSize: 11 }}>
                  Vazão Efetiva: <b>{veiculoSelecionado.vazaoEfetivaM3H} m³/h</b>
                </div>
              </div>
            )}

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span>Nível de Diesel</span>
                <b>{veiculoSelecionado.nivelDieselPercent}%</b>
              </div>
              <div style={{ height: 6, background: 'var(--joint)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${veiculoSelecionado.nivelDieselPercent}%`, background: '#38bdf8' }} />
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Localização aproximada: {veiculoSelecionado.sentido}
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Clique em qualquer caminhão ou bomba no mapa para inspecionar os dados telemétricos.
          </div>
        )}
      </div>

    </div>
  );
}

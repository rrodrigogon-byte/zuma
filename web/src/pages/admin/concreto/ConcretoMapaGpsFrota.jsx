import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';

export default function ConcretoMapaGpsFrota() {
  const { toast } = useToast();
  const [telemetriaData, setTelemetriaData] = useState(null);
  const [gpsData, setGpsData] = useState(null);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [atualizandoRemoto, setAtualizandoRemoto] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos' | 'transito' | 'descarga' | 'usina'

  useEffect(() => {
    carregarDadosFrota();
    const interval = setInterval(carregarDadosFrota, 6000); // Polling 6s
    return () => clearInterval(interval);
  }, []);

  const carregarDadosFrota = async () => {
    try {
      const [resTel, resGps] = await Promise.all([
        api.get('/api/admin/concreto/frota/telemetria-tempo-real'),
        api.get('/api/admin/concreto/frota/gps-rotas')
      ]);

      if (resTel?.ok) {
        setTelemetriaData(resTel);
        // Atualizar veículo selecionado mantendo foco
        if (veiculoSelecionado) {
          const atualizado = resTel.veiculos.find(v => v.codigo === veiculoSelecionado.codigo);
          if (atualizado) setVeiculoSelecionado(atualizado);
        } else if (resTel.veiculos?.length > 0) {
          // Selecionar por padrão a BT-02 (em descarga ativa) ou BT-04 (em trânsito)
          const alvo = resTel.veiculos.find(v => v.statusOperacional === 'descarregando_obra') || resTel.veiculos[0];
          setVeiculoSelecionado(alvo);
        }
      }

      if (resGps?.ok) {
        setGpsData(resGps);
      }
    } catch (e) {
      console.warn('Falha ao carregar telemetria e GPS da frota:', e);
    }
  };

  // Enviar comando de telemetria remota para o veículo
  const handleComandoRemoto = async (codigo, dadosComando, msgSucesso) => {
    setAtualizandoRemoto(true);
    try {
      const res = await api.post(`/api/admin/concreto/frota/telemetria/${codigo}/atualizar`, dadosComando);
      if (res?.ok) {
        toast(`[${codigo}] ${msgSucesso}`, 'success');
        carregarDadosFrota();
      } else {
        toast('Erro no comando telemétrico: ' + (res?.error || 'Falha'), 'error');
      }
    } catch (err) {
      toast('Erro de comunicação: ' + err.message, 'error');
    } finally {
      setAtualizandoRemoto(false);
    }
  };

  // Coordenadas projetadas no SVG (Width 760, Height 460)
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

  const veiculos = telemetriaData?.veiculos || [];
  const veiculosFiltrados = veiculos.filter(v => {
    if (filtroStatus === 'transito') return v.statusOperacional === 'em_transito_obra' || v.statusOperacional === 'retornando_usina';
    if (filtroStatus === 'descarga') return v.statusOperacional === 'descarregando_obra';
    if (filtroStatus === 'usina') return v.statusOperacional === 'carregando_usina' || v.statusOperacional === 'patio_disponivel';
    return true;
  });

  const kpis = telemetriaData?.resumoKpis || {
    totalBetoneirasAtivas: 5,
    betoneirasEmTransito: 1,
    betoneirasDescarregando: 1,
    betoneirasCarregando: 1,
    volumeConcretoEmTransitoM3: 18.2
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* ─── BANNER DE KPIS DE TELEMETRIA AO VIVO ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 12
      }}>
        <div className="serrano-card" style={{ padding: '14px 18px', background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Frota de Betoneiras Ativa
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--serrano-orange-text)', marginTop: 2 }}>
            {kpis.totalBetoneirasAtivas} Betoneiras
          </div>
          <small style={{ color: 'var(--status-ok)', fontWeight: 600 }}>● 100% Conectadas via Satélite/4G</small>
        </div>

        <div className="serrano-card" style={{ padding: '14px 18px', background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Concreto em Movimento
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-display)', color: '#0284c7', marginTop: 2 }}>
            {kpis.volumeConcretoEmTransitoM3} m³
          </div>
          <small style={{ color: 'var(--text-muted)' }}>Agitação controlada NBR 7212</small>
        </div>

        <div className="serrano-card" style={{ padding: '14px 18px', background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Descargas Ativas in-situ
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-display)', color: '#10b981', marginTop: 2 }}>
            {kpis.betoneirasDescarregando} Canteiro(s)
          </div>
          <small style={{ color: 'var(--status-ok)' }}>Giro anti-horário (vazão contínua)</small>
        </div>

        <div className="serrano-card" style={{ padding: '14px 18px', background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Sensor de Água no Trajeto
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-display)', color: '#10b981', marginTop: 2 }}>
            0 Litros
          </div>
          <small style={{ color: '#10b981', fontWeight: 700 }}>🔒 Lacre Eletrônico Inviolável</small>
        </div>
      </div>

      {/* ─── CORPO PRINCIPAL: MAPA GPS (ESQ) & COCKPIT DE TELEMETRIA DO BALÃO (DIR) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
        {/* MAPA VETORIAL DE TANGARÁ DA SERRA */}
        <div className="serrano-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Header do Mapa */}
          <div style={{ padding: '12px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--joint)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <b style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🗺️ Rastreamento GPS da Frota · Tangará da Serra/MT (MT-358 &amp; Canteiros)
              </b>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Posicionamento em tempo real com telemetria do balão e cronômetro de pega
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'transito', label: 'Em Trânsito' },
                { id: 'descarga', label: 'Descarregando' },
                { id: 'usina', label: 'Usina/Pátio' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  style={{
                    background: filtroStatus === f.id ? 'var(--serrano-orange-text)' : 'var(--surface)',
                    color: filtroStatus === f.id ? '#fff' : 'var(--text)',
                    border: '1px solid var(--joint)',
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 10.5,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  onClick={() => setFiltroStatus(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Canvas SVG Interativo de Tangará da Serra */}
          <div style={{ position: 'relative', background: '#090d16', flex: 1, minHeight: 460 }}>
            <svg viewBox="0 0 760 460" style={{ width: '100%', height: '100%', display: 'block' }}>
              <defs>
                <linearGradient id="gridDarkGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#090d16" />
                </linearGradient>
                <pattern id="roadGridPat" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.4" />
                </pattern>
              </defs>

              <rect width="760" height="460" fill="url(#gridDarkGrad)" />
              <rect width="760" height="460" fill="url(#roadGridPat)" />

              {/* Rio Sepotuba (Curva Azul Sinusal) */}
              <path 
                d="M 10 450 Q 80 380 40 300 T 120 180 T 90 20" 
                fill="none" 
                stroke="#0284c7" 
                strokeWidth="14" 
                opacity="0.3" 
              />
              <text x="50" y="320" fill="#38bdf8" fontSize="10" fontWeight="bold" opacity="0.6" transform="rotate(-65, 50, 320)">
                Rio Sepotuba (Jazida Serrano)
              </text>

              {/* Rodovia MT-358 (Espinha dorsal de Tangará da Serra) */}
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

              {/* Acesso Alphaville / Av Lions Internacional */}
              <path 
                d="M 320 220 L 380 70" 
                fill="none" 
                stroke="#475569" 
                strokeWidth="4" 
              />

              {/* Rota Ativa de Entrega: Usina -> Serra Dourada (BT-02 / BT-04) */}
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
                strokeWidth="3" 
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
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
                  >
                    {loc.nome}
                  </text>
                </g>
              ))}

              {/* Veículos em Tempo Real com Ícones e Pulso */}
              {veiculosFiltrados.map(v => {
                const pos = POSICOES_VEICULOS_SVG[v.codigo] || { x: 140, y: 250 };
                const isSelected = veiculoSelecionado?.codigo === v.codigo;
                const isDescarregando = v.statusOperacional === 'descarregando_obra';
                const isTransito = v.statusOperacional === 'em_transito_obra';
                const corStatus = isDescarregando ? '#ef4444' : isTransito ? '#10b981' : '#f59e0b';

                return (
                  <g 
                    key={v.codigo} 
                    transform={`translate(${pos.x}, ${pos.y})`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setVeiculoSelecionado(v)}
                  >
                    {/* Anel de Pulso se selecionado ou descarregando */}
                    {(isSelected || isDescarregando) && (
                      <circle 
                        r="22" 
                        fill="none" 
                        stroke={corStatus} 
                        strokeWidth="2" 
                        opacity="0.7"
                      >
                        <animate attributeName="r" values="16;28;16" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2s" repeatCount="indefinite" />
                      </circle>
                    )}

                    {/* Fundo do Veículo */}
                    <rect 
                      x="-18" 
                      y="-12" 
                      width="36" 
                      height="24" 
                      rx="6" 
                      fill={isSelected ? '#ea580c' : '#1e293b'} 
                      stroke={corStatus} 
                      strokeWidth="2" 
                    />
                    
                    {/* Ícone */}
                    <text x="0" y="4" textAnchor="middle" fontSize="11">
                      {v.tipo === 'betoneira' ? '🚚' : '🚜'}
                    </text>

                    {/* Tag Código */}
                    <rect 
                      x="-16" 
                      y="-24" 
                      width="32" 
                      height="12" 
                      rx="3" 
                      fill="#0f172a" 
                      stroke="var(--joint)" 
                      strokeWidth="1" 
                    />
                    <text 
                      x="0" 
                      y="-15" 
                      textAnchor="middle" 
                      fill="#fff" 
                      fontSize="9" 
                      fontWeight="bold"
                    >
                      {v.codigo}
                    </text>

                    {/* RPM em tempo real flutuante */}
                    {v.tipo === 'betoneira' && v.rpmTambor > 0 && (
                      <g transform="translate(0, 22)">
                        <rect x="-24" y="-8" width="48" height="12" rx="3" fill="#0f172a" stroke={corStatus} strokeWidth="1" />
                        <text x="0" y="1" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="bold">
                          {v.sentidoGiro === 'anti_horario' ? '↺' : '↻'} {v.rpmTambor} RPM
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* ─── COCKPIT DE TELEMETRIA DO BALÃO & CRONÔMETRO NBR 7212 (DIR) ─── */}
        <div className="serrano-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {veiculoSelecionado ? (
            <>
              {/* Header do Veículo Selecionado */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--joint)', paddingBottom: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <b style={{ fontFamily: 'var(--font-data)', fontSize: 18, color: 'var(--serrano-orange-text)' }}>
                      {veiculoSelecionado.codigo}
                    </b>
                    <span style={{ fontSize: 11, background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                      {veiculoSelecionado.placa}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Motorista: <b>{veiculoSelecionado.motorista}</b>
                  </div>
                </div>
                <span className={`serrano-pill ${veiculoSelecionado.statusOperacional === 'descarregando_obra' ? 'serrano-p-live' : veiculoSelecionado.statusOperacional === 'em_transito_obra' ? 'serrano-p-ok' : 'serrano-p-load'}`} style={{ fontWeight: 800 }}>
                  {veiculoSelecionado.statusTexto || veiculoSelecionado.statusOperacional}
                </span>
              </div>

              {/* TACÔMETRO DO BALÃO (RPM & SENTIDO DE GIRO) */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(234, 88, 12, 0.1) 100%)',
                border: '1.5pt solid var(--joint)',
                borderRadius: 12,
                padding: 14,
                textAlign: 'center'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <small style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Tacômetro de Rotação do Balão
                  </small>
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    background: veiculoSelecionado.sentidoGiro === 'anti_horario' ? '#ef4444' : '#10b981',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: 10
                  }}>
                    {veiculoSelecionado.sentidoGiro === 'anti_horario' ? '↺ DESCARGA IN-SITU' : veiculoSelecionado.sentidoGiro === 'horario' ? '↻ AGITAÇÃO TRÂNSITO' : '⏹️ PARADO'}
                  </span>
                </div>

                {/* Mostrador Digital & Animação do Tambor */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '8px 0' }}>
                  {/* Ícone Animado de Tambor Girando */}
                  <div style={{
                    width: 54,
                    height: 54,
                    borderRadius: '50%',
                    border: `3px dashed ${veiculoSelecionado.sentidoGiro === 'anti_horario' ? '#ef4444' : '#0284c7'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    animation: veiculoSelecionado.rpmTambor > 0 
                      ? `${veiculoSelecionado.sentidoGiro === 'anti_horario' ? 'spinReverse' : 'spinNormal'} ${Math.max(0.5, 12 / (veiculoSelecionado.rpmTambor || 1))}s linear infinite`
                      : 'none'
                  }}>
                    🚚
                  </div>

                  <div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 32,
                      fontWeight: 900,
                      color: veiculoSelecionado.sentidoGiro === 'anti_horario' ? '#ef4444' : '#0284c7',
                      lineHeight: 1
                    }}>
                      {veiculoSelecionado.rpmTambor?.toFixed(1) || '0.0'} <span style={{ fontSize: 14 }}>RPM</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {veiculoSelecionado.modoRotacaoTexto || 'Agitação controlada'}
                    </div>
                  </div>
                </div>

                {/* Barra Graduada de RPM (0 a 18 RPM) */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--text-muted)' }}>
                    <span>0 RPM (Parado)</span>
                    <span>3 RPM (Agitação)</span>
                    <span>16 RPM (Descarga)</span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: 'var(--joint)', borderRadius: 3, overflow: 'hidden', marginTop: 3 }}>
                    <div style={{
                      width: `${Math.min(100, ((veiculoSelecionado.rpmTambor || 0) / 16) * 100)}%`,
                      height: '100%',
                      background: veiculoSelecionado.sentidoGiro === 'anti_horario' ? '#ef4444' : '#0284c7'
                    }} />
                  </div>
                </div>
              </div>

              {/* CRONÔMETRO DE PEGA NBR 7212 (MÁXIMO 150 MIN / 120 MIN CALOR) */}
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Cronômetro de Pega NBR 7212
                  </b>
                  <span style={{ fontSize: 11, fontWeight: 700, color: (veiculoSelecionado.percPegaConsumido || 0) > 80 ? '#ef4444' : '#10b981' }}>
                    {veiculoSelecionado.minutosDesdeAgua || 0} min decorridos
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 6 }}>
                  <span>Tempo Restante Seguro:</span>
                  <b style={{ fontFamily: 'var(--font-data)' }}>{veiculoSelecionado.tempoRestantePegaMinutos || 0} min</b>
                </div>

                {/* Barra de Progresso NBR 7212 */}
                <div style={{ width: '100%', height: 8, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
                  <div style={{
                    width: `${veiculoSelecionado.percPegaConsumido || 0}%`,
                    height: '100%',
                    background: (veiculoSelecionado.percPegaConsumido || 0) > 80 ? '#ef4444' : (veiculoSelecionado.percPegaConsumido || 0) > 60 ? '#f59e0b' : '#10b981'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  <span>0 min (Hidratação Usina)</span>
                  <span>Teto: {veiculoSelecionado.limitePegaMinutos || 150} min</span>
                </div>
              </div>

              {/* SENSORES DE INTEGRIDADE & GEOFENCE */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                <div style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 8, border: '1px solid var(--joint)' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10 }}>ÁGUA NO TRAJETO</span>
                  <b style={{ color: '#10b981', fontSize: 13 }}>0 Litros (Inviolável)</b>
                  <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: 9 }}>Lacre eletrônico ativo</small>
                </div>
                <div style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 8, border: '1px solid var(--joint)' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10 }}>TEMP. DA MASSA</span>
                  <b style={{ fontSize: 13 }}>{veiculoSelecionado.temperaturaMassaC || 30.5} °C</b>
                  <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: 9 }}>Sensor infravermelho</small>
                </div>
                <div style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 8, border: '1px solid var(--joint)' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10 }}>VOLUME NO BALÃO</span>
                  <b style={{ fontSize: 13, color: 'var(--serrano-orange-text)' }}>{veiculoSelecionado.volumeAtualM3 || 0} m³</b>
                  <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: 9 }}>Capacidade: {veiculoSelecionado.capacidadeM3 || 8} m³</small>
                </div>
                <div style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 8, border: '1px solid var(--joint)' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10 }}>VELOCIDADE / GPS</span>
                  <b style={{ fontSize: 13 }}>{veiculoSelecionado.velocidadeKmH || 0} km/h</b>
                  <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: 9 }}>{veiculoSelecionado.distanciaRestanteKm || 0} km da obra</small>
                </div>
              </div>

              {/* Destino e Endereço */}
              <div style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 8, fontSize: 11 }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10 }}>DESTINO / OBRA ATUAL:</span>
                <b>{veiculoSelecionado.obraDestino || 'Usina Serrano Concreto'}</b>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  📍 {veiculoSelecionado.localizacaoTexto || 'Em operação na malha de Tangará'}
                </div>
              </div>

              {/* CONTROLES REMOTOS DE SIMULAÇÃO TELEMÉTRICA (OPERADOR / USINA) */}
              <div style={{ borderTop: '1px solid var(--joint)', paddingTop: 10 }}>
                <small style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Simulação &amp; Ações Telemétricas in-situ:
                </small>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button
                    type="button"
                    className="serrano-btn"
                    style={{
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '6px 8px',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleComandoRemoto(veiculoSelecionado.codigo, {
                      rpmTambor: 15.0,
                      sentidoGiro: 'anti_horario',
                      statusOperacional: 'descarregando_obra',
                      statusTexto: 'Descarregando na Obra',
                      volumeAtualM3: Math.max(0, (veiculoSelecionado.volumeAtualM3 || 8) - 4)
                    }, 'Descarga iniciada no canteiro da obra (15 RPM anti-horário)')}
                    disabled={atualizandoRemoto}
                  >
                    ⚡ Iniciar Descarga (15 RPM)
                  </button>

                  <button
                    type="button"
                    className="serrano-btn"
                    style={{
                      background: '#0284c7',
                      color: '#fff',
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '6px 8px',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleComandoRemoto(veiculoSelecionado.codigo, {
                      rpmTambor: 3.2,
                      sentidoGiro: 'horario',
                      statusOperacional: 'em_transito_obra',
                      statusTexto: 'Em Trânsito para a Obra',
                      velocidadeKmH: 48
                    }, 'Modo de Agitação em trânsito acionado (3.2 RPM horário)')}
                    disabled={atualizandoRemoto}
                  >
                    🔄 Agitação Trânsito (3 RPM)
                  </button>

                  <button
                    type="button"
                    className="serrano-btn"
                    style={{
                      background: '#10b981',
                      color: '#fff',
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '6px 8px',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleComandoRemoto(veiculoSelecionado.codigo, {
                      rpmTambor: 13.5,
                      sentidoGiro: 'horario',
                      statusOperacional: 'carregando_usina',
                      statusTexto: 'Mistura Rápida na Central Convicta',
                      minutosDesdeAgua: 0,
                      volumeAtualM3: 8.0
                    }, 'Mistura rápida de homogeneização acionada na usina')}
                    disabled={atualizandoRemoto}
                  >
                    🏭 Carga Usina (13.5 RPM)
                  </button>

                  <button
                    type="button"
                    className="serrano-btn serrano-btn-sec"
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '6px 8px',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleComandoRemoto(veiculoSelecionado.codigo, {
                      rpmTambor: 0.0,
                      sentidoGiro: 'parado',
                      statusOperacional: 'patio_disponivel',
                      statusTexto: 'Disponível no Pátio (Parado)',
                      velocidadeKmH: 0
                    }, 'Balão parado e veículo estacionado no pátio')}
                    disabled={atualizandoRemoto}
                  >
                    ⏹️ Parar Balão (0 RPM)
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '40px 0' }}>
              Selecione uma betoneira no mapa para inspecionar os dados telemétricos e rotação do balão.
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spinNormal {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spinReverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}

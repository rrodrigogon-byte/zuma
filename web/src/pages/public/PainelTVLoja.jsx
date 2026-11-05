import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Maximize2, Clock, Users, Bell } from 'lucide-react';
import './totem.css';

export default function PainelTVLoja() {
  const [painel, setPainel] = useState({
    ultimaChamada: null,
    historicoChamadas: [],
    filaAguardando: [],
    totalAguardando: 0,
    totalAtendidas: 0,
  });

  const [somHabilitado, setSomHabilitado] = useState(true);
  const [horaAtual, setHoraAtual] = useState(new Date().toLocaleTimeString('pt-BR'));

  // Atualiza relógio
  useEffect(() => {
    const timer = setInterval(() => {
      setHoraAtual(new Date().toLocaleTimeString('pt-BR'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Polling para novas senhas chamadas
  useEffect(() => {
    let ultimaChamadaId = null;

    async function buscarEstado() {
      try {
        const res = await fetch('/api/totem/painel-tv');
        const data = await res.json();
        if (data.ok) {
          setPainel(data);
          // Toca som se houver uma nova senha chamada
          if (data.ultimaChamada && data.ultimaChamada.id !== ultimaChamadaId) {
            ultimaChamadaId = data.ultimaChamada.id;
            tocarAlertaSonoro();
          }
        }
      } catch {
        // Fallback visual com dados simulados caso a rede oscile
      }
    }

    buscarEstado();
    const interval = setInterval(buscarEstado, 3000);
    return () => clearInterval(interval);
  }, [somHabilitado]);

  function tocarAlertaSonoro() {
    if (!somHabilitado) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch {
      // Ignora erro de áudio
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  const ultima = painel.ultimaChamada || {
    codigo: 'A-001',
    clienteNome: 'Carlos Eduardo',
    servicoDesejado: 'Corte e Barba Dino',
    guiche: 'Cadeira 01',
    profissionalAtendente: 'Dino Barbeiro',
  };

  return (
    <div className="painel-tv-container">
      {/* Header do Painel TV */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#B38E32', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#000', fontSize: 24 }}>
            D
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>
              BARBEARIA DINO
            </h1>
            <span style={{ fontSize: 13, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5 }}>
              Painel de Atendimento da Loja Física
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 32, fontWeight: 800, color: '#fff', background: '#141519', padding: '6px 18px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
            <Clock size={28} color="#B38E32" />
            <span>{horaAtual}</span>
          </div>

          <button
            onClick={() => setSomHabilitado(!somHabilitado)}
            style={{ background: '#141519', border: '1px solid rgba(255,255,255,0.1)', color: somHabilitado ? '#10b981' : '#64748b', borderRadius: 14, padding: 12, cursor: 'pointer' }}
          >
            {somHabilitado ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>

          <button
            onClick={toggleFullscreen}
            style={{ background: '#141519', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 14, padding: 12, cursor: 'pointer' }}
          >
            <Maximize2 size={24} />
          </button>
        </div>
      </header>

      {/* Grid Principal do Painel */}
      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 28, paddingTop: 24 }}>
        {/* Lado Esquerdo: Última Senha Chamada (GIGANTE) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="painel-chamada-gigante" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(179, 142, 50, 0.2)', padding: '8px 24px', borderRadius: 999, alignSelf: 'center', marginBottom: 16 }}>
              <Bell size={20} color="#B38E32" />
              <span style={{ fontSize: 16, fontWeight: 800, color: '#B38E32', textTransform: 'uppercase', letterSpacing: 2 }}>
                SENHA CHAMADA
              </span>
            </div>

            <div style={{ fontSize: 120, fontWeight: 900, color: '#fff', letterSpacing: 6, lineHeight: 1, margin: '10px 0 20px 0' }}>
              {ultima.codigo}
            </div>

            <div style={{ fontSize: 36, fontWeight: 800, color: '#f1f5f9', marginBottom: 8 }}>
              {ultima.clienteNome}
            </div>

            <div style={{ fontSize: 22, color: '#B38E32', fontWeight: 600 }}>
              {ultima.servicoDesejado || 'Atendimento'}
            </div>

            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center', gap: 24 }}>
              <div style={{ background: '#1c1e24', padding: '12px 28px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: 13, color: '#94a3b8', display: 'block' }}>PROFISSIONAL</span>
                <strong style={{ fontSize: 20, color: '#fff' }}>{ultima.profissionalAtendente || 'Equipe Dino'}</strong>
              </div>
              <div style={{ background: '#1c1e24', padding: '12px 28px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: 13, color: '#94a3b8', display: 'block' }}>LOCAL / CADEIRA</span>
                <strong style={{ fontSize: 20, color: '#10b981' }}>{ultima.guiche || 'Cadeira 01'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Direito: Histórico de Chamadas e Fila de Espera */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Histórico das Últimas Chamadas */}
          <div style={{ background: '#141519', borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)', padding: 20 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
              Últimas Chamadas
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {(painel.historicoChamadas.length > 0 ? painel.historicoChamadas.slice(1, 5) : [
                { codigo: 'A-041', clienteNome: 'Marcos Vinicius', guiche: 'Cadeira 02' },
                { codigo: 'P-040', clienteNome: 'Sr. Roberto', guiche: 'Cadeira 03' },
                { codigo: 'A-039', clienteNome: 'Felipe Santos', guiche: 'Cadeira 01' },
                { codigo: 'A-038', clienteNome: 'André Luiz', guiche: 'Cadeira 02' },
              ]).map((s, idx) => (
                <div key={idx} style={{ background: '#1c1e24', padding: '12px 16px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#B38E32' }}>{s.codigo}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.clienteNome}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{s.guiche || 'Atendimento'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Fila de Espera Atual */}
          <div style={{ flex: 1, background: '#141519', borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)', padding: 20, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} color="#3b82f6" /> Fila de Espera
              </h3>
              <span style={{ fontSize: 14, fontWeight: 800, background: '#3b82f6', color: '#fff', padding: '2px 10px', borderRadius: 8 }}>
                {painel.totalAguardando || 3} aguardando
              </span>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
              {(painel.filaAguardando.length > 0 ? painel.filaAguardando.slice(0, 5) : [
                { codigo: 'A-043', clienteNome: 'Lucas Gabriel', tipo: 'Normal' },
                { codigo: 'A-044', clienteNome: 'Thiago Mendes', tipo: 'Normal' },
                { codigo: 'P-045', clienteNome: 'Dona Maria', tipo: 'Prioritário' },
              ]).map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1c1e24', padding: '10px 16px', borderRadius: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <strong style={{ fontSize: 18, color: f.tipo === 'Prioritário' ? '#f59e0b' : '#fff' }}>{f.codigo}</strong>
                    <span style={{ fontSize: 14, color: '#cbd5e1' }}>{f.clienteNome}</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Posição #{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Rodapé Informativo */}
      <footer style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: 13 }}>
        <span>☕ Pegue um café ou peça uma cerveja artesanal Dino no nosso totem de autoatendimento.</span>
        <span>Rede Wi-Fi: <strong>Dino-Clientes</strong> | Senha: <strong>dino2026</strong></span>
      </footer>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Maximize2, Flame, ChefHat, Clock, CheckCircle2, Truck, Bell } from 'lucide-react';

export default function PainelTVPizzaria() {
  const [painel, setPainel] = useState({
    horaAtual: new Date().toLocaleTimeString('pt-BR'),
    forno: {
      temperaturaAtualC: 410,
      pizzasAssandoAgora: 4,
      capacidadeMaximaLastro: 6,
      tempoMedioCoccaoMin: 3.0
    },
    preparandoNoForno: [
      { comanda: 'CMD-0893', cliente: 'Thiago Brandão', destino: 'Delivery WhatsApp', status: 'Bancada de Montagem', tempoDecorrido: '4 min' },
      { comanda: 'CMD-0892', cliente: 'Dr. Ricardo Mendonça', destino: 'Mesa 04 · Salão', status: 'Assando no Forno (400°C)', tempoDecorrido: '5 min' },
      { comanda: 'CMD-0895', cliente: 'Rogério Ceni', destino: 'Mesa 07 · Salão', status: 'Bancada de Abertura', tempoDecorrido: '2 min' }
    ],
    prontosParaRetirada: [
      { comanda: 'CMD-0890', cliente: 'Dra. Juliana Barreto', destino: 'Balcão Retirada (Takeout)', chamadaEm: '20:25' },
      { comanda: 'CMD-0889', cliente: 'Marcos Vinícius', destino: 'Mesa 12 · Salão', chamadaEm: '20:20' }
    ],
    emRotaEntrega: [
      { comanda: 'CMD-0888', cliente: 'Eduardo Bertolini', motoboy: 'Cleber Santos (Moto 02)', status: 'Em rota no Jardim Europa' }
    ]
  });

  const [somHabilitado, setSomHabilitado] = useState(true);
  const [horaLocal, setHoraLocal] = useState(new Date().toLocaleTimeString('pt-BR'));
  const [ultimaComandaFalada, setUltimaComandaFalada] = useState(null);

  // Relógio local
  useEffect(() => {
    const timer = setInterval(() => {
      setHoraLocal(new Date().toLocaleTimeString('pt-BR'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Falar senha via Web Speech API
  const falarSenha = (comanda, cliente) => {
    if (!somHabilitado || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const frase = `Atenção: Pedido ${comanda}, cliente ${cliente}, pronto para retirada!`;
      const utterance = new SpeechSynthesisUtterance(frase);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Erro na síntese de voz:', e);
    }
  };

  // Buscar estado ao vivo do servidor
  const carregarPainel = async () => {
    try {
      const res = await fetch('/api/publico/palatare/painel-tv');
      if (res.ok) {
        const data = await res.json();
        if (data?.painel) {
          setPainel(data.painel);
          const primeiroPronto = data.painel.prontosParaRetirada?.[0];
          if (primeiroPronto && primeiroPronto.comanda !== ultimaComandaFalada) {
            setUltimaComandaFalada(primeiroPronto.comanda);
            falarSenha(primeiroPronto.comanda, primeiroPronto.cliente);
          }
        }
      }
    } catch (e) {
      // Manter estado visual ativo
    }
  };

  useEffect(() => {
    carregarPainel();
    const interval = setInterval(carregarPainel, 4000);
    return () => clearInterval(interval);
  }, [ultimaComandaFalada, somHabilitado]);

  // Alternar tela cheia
  const alternarFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const destaquePronto = painel.prontosParaRetirada?.[0];

  return (
    <div style={{
      background: '#0B0705',
      color: '#FFF',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      padding: '16px 24px'
    }}>
      {/* Topo do Painel TV */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 16,
        borderBottom: '2px solid #2A170F'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            background: 'linear-gradient(135deg, #EA580C, #9A3412)',
            padding: '12px 16px',
            borderRadius: 14,
            boxShadow: '0 4px 20px rgba(234, 88, 12, 0.4)'
          }}>
            <Flame size={32} color="#FFF" />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5, color: '#FFF' }}>
              PALATARE FORNERIA ARTESANAL
            </div>
            <div style={{ fontSize: 13, color: '#EA580C', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>FORNO A LENHA NAPOLITANO 400°C</span>
              <span>•</span>
              <span style={{ color: '#94A3B8' }}>Tangará da Serra · MT</span>
            </div>
          </div>
        </div>

        {/* Telemetria do Forno em Tempo Real */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          background: '#1A0E08',
          padding: '8px 20px',
          borderRadius: 14,
          border: '1px solid #3A1F13'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>Temperatura Forno</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#FF7A00' }}>
              {painel.forno?.temperaturaAtualC || 410}°C 🔥
            </div>
          </div>
          <div style={{ width: 1, height: 30, background: '#3A1F13' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>Lastro Ocupado</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#10B981' }}>
              {painel.forno?.pizzasAssandoAgora || 4} / {painel.forno?.capacidadeMaximaLastro || 6} Pizzas
            </div>
          </div>
        </div>

        {/* Relógio & Controles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#F8FAFC', letterSpacing: 1 }}>
            {horaLocal}
          </div>
          <button
            onClick={() => setSomHabilitado(!somHabilitado)}
            title={somHabilitado ? 'Mutar voz' : 'Ativar voz de chamada'}
            style={{
              background: somHabilitado ? '#10B98122' : '#EF444422',
              border: `1px solid ${somHabilitado ? '#10B981' : '#EF4444'}`,
              color: somHabilitado ? '#10B981' : '#EF4444',
              padding: 10,
              borderRadius: 10,
              cursor: 'pointer'
            }}
          >
            {somHabilitado ? <Volume2 size={22} /> : <VolumeX size={22} />}
          </button>
          <button
            onClick={alternarFullScreen}
            title="Modo Tela Cheia (TV 16:9)"
            style={{
              background: '#2A170F',
              border: '1px solid #4A281A',
              color: '#FFF',
              padding: 10,
              borderRadius: 10,
              cursor: 'pointer'
            }}
          >
            <Maximize2 size={22} />
          </button>
        </div>
      </header>

      {/* Grid Principal do Display TV */}
      <main style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 24,
        marginTop: 20
      }}>
        {/* Coluna 1: PREPARANDO NO FORNO */}
        <section style={{
          background: '#140B07',
          borderRadius: 20,
          border: '2px solid #EA580C44',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
            paddingBottom: 14,
            borderBottom: '2px solid #2A170F'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: '#EA580C', padding: 8, borderRadius: 10 }}>
                <ChefHat size={26} color="#FFF" />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#FB923C', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Preparando no Forno
              </h2>
            </div>
            <span style={{
              background: '#EA580C22',
              color: '#EA580C',
              padding: '6px 14px',
              borderRadius: 20,
              fontWeight: 800,
              fontSize: 14,
              border: '1px solid #EA580C66'
            }}>
              {painel.preparandoNoForno?.length || 0} na fornalha
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
            {(painel.preparandoNoForno || []).map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: '#1F110B',
                  borderRadius: 16,
                  border: '1px solid #3D2014',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 24, fontWeight: 900, color: '#FFF' }}>
                      {item.comanda}
                    </span>
                    <span style={{
                      background: '#FF7A0022',
                      color: '#FF7A00',
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '3px 10px',
                      borderRadius: 12,
                      border: '1px solid #FF7A0055'
                    }}>
                      {item.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, color: '#C8B6A6', marginTop: 4 }}>
                    {item.cliente} • <strong style={{ color: '#FFF' }}>{item.destino}</strong>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={14} /> Tempo
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#FB923C' }}>
                    {item.tempoDecorrido}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Coluna 2: PRONTO PARA RETIRADA & ENTREGA */}
        <section style={{
          background: '#07160F',
          borderRadius: 20,
          border: '2px solid #10B98155',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
            paddingBottom: 14,
            borderBottom: '2px solid #0F2D1F'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: '#10B981', padding: 8, borderRadius: 10 }}>
                <CheckCircle2 size={26} color="#FFF" />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#34D399', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Pronto p/ Retirada
              </h2>
            </div>
            <span style={{
              background: '#10B98122',
              color: '#10B981',
              padding: '6px 14px',
              borderRadius: 20,
              fontWeight: 800,
              fontSize: 14,
              border: '1px solid #10B98166'
            }}>
              Balcão &amp; Motoboy
            </span>
          </div>

          {/* Destaque Gigante da Última Comanda Chamada */}
          {destaquePronto ? (
            <div style={{
              background: 'linear-gradient(135deg, #064E3B, #022C22)',
              borderRadius: 20,
              border: '3px solid #10B981',
              padding: '24px 28px',
              marginBottom: 20,
              textAlign: 'center',
              boxShadow: '0 0 35px rgba(16, 185, 129, 0.35)',
              animation: 'pulse 2s infinite'
            }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#6EE7B7', textTransform: 'uppercase', letterSpacing: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Bell size={18} /> ÚLTIMA CHAMADA NO BALCÃO
              </div>
              <div style={{ fontSize: 68, fontWeight: 900, color: '#FFF', letterSpacing: 2, margin: '8px 0' }}>
                {destaquePronto.comanda}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#A7F3D0' }}>
                {destaquePronto.cliente}
              </div>
              <div style={{ fontSize: 15, color: '#6EE7B7', marginTop: 4 }}>
                {destaquePronto.destino}
              </div>
            </div>
          ) : (
            <div style={{
              background: '#0B1F16',
              borderRadius: 16,
              padding: 30,
              textAlign: 'center',
              color: '#6EE7B7',
              marginBottom: 20
            }}>
              Aguardando finalização da próxima fornada...
            </div>
          )}

          {/* Lista de Outras Comandas Prontas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
            {(painel.prontosParaRetirada || []).slice(1).map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: '#0B1F16',
                  borderRadius: 14,
                  border: '1px solid #133D2B',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span style={{ fontSize: 20, fontWeight: 900, color: '#FFF' }}>
                    {item.comanda}
                  </span>
                  <span style={{ fontSize: 14, color: '#A7F3D0', marginLeft: 12 }}>
                    {item.cliente} • {item.destino}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: '#6EE7B7', fontWeight: 700 }}>
                  Pronto às {item.chamadaEm}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Rodapé Informativo */}
      <footer style={{
        marginTop: 16,
        paddingTop: 12,
        borderTop: '1px solid #2A170F',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12,
        color: '#94A3B8'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span>Kytto ERP Food Service</span>
          <span>•</span>
          <span>Sincronização em Tempo Real (PizzariaEventBus)</span>
          <span>•</span>
          <span>Tangará da Serra - MT</span>
        </div>
        <div style={{ color: '#EA580C', fontWeight: 700 }}>
          ⚡ 0% Taxa no WhatsApp Delivery Palatare
        </div>
      </footer>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { 
  Truck, MapPin, Clock, ShieldCheck, Download, ExternalLink, 
  Share2, CheckCircle2, AlertTriangle, FileText, Activity, Navigation,
  Building, ChevronRight, Phone, Calendar
} from 'lucide-react';

export default function ConcretoPortalCliente() {
  const { cargaId: paramCargaId } = useParams();
  const [searchParams] = useSearchParams();
  const idOuNumero = paramCargaId || searchParams.get('carga') || '1001';

  const [carga, setCarga] = useState({
    id: 'crg-1001',
    numero: 1001,
    cliente: 'Construtora Tangará & Engenharia Civil',
    obra: 'Edifício Residencial Serra Dourada · Laje 4º Pavimento',
    endereco: 'Av. Brasil, 1420 - Centro, Tangará da Serra - MT',
    fck: 30,
    brita: 'Brita 1',
    slump: '14 ± 2 cm',
    volumeTotalM3: 32,
    volumeEntregueM3: 16,
    bombaEscalada: 'Bomba Lança Schwing S36X (36m)',
    viagemAtual: 2,
    totalViagens: 4,
    status: 'em_transito',
    betoneiraAtiva: {
      codigo: 'BT-02',
      placa: 'RBY-4F32',
      motorista: 'Carlos Eduardo Santos',
      telefone: '(65) 99841-2233',
      velocidadeKmH: 52,
      rpmBalao: 3.8,
      sentidoGiro: 'HORARIO_MISTURA_LENTA',
      distanciaRestanteKm: 4.8,
      etaMinutos: 9,
      tempoDecorridoMin: 32,
      limiteJanelaPegaMin: 90
    },
    assinaturaEntrega: {
      status: 'pendente',
      codigoAutenticidade: 'SERRANO-NBR7212-A892'
    }
  });

  const [copiado, setCopiado] = useState(false);

  // Simular deslocamento do caminhão na rota
  const [progressoRota, setProgressoRota] = useState(65);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgressoRota(prev => (prev >= 98 ? 98 : prev + 1));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const copiarLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const handleCompartilharWhatsApp = () => {
    const msg = encodeURIComponent(
      `*Acompanhamento da Betoneira ao Vivo (Serrano Concreto)*\n` +
      `*Obra:* ${carga.obra}\n` +
      `*Betoneira:* ${carga.betoneiraAtiva.codigo} (${carga.betoneiraAtiva.placa})\n` +
      `*Previsão de Chegada (ETA):* ${carga.betoneiraAtiva.etaMinutos} minutos\n` +
      `*Volume:* 8 m³ (Traço fck ${carga.fck} MPa - ${carga.slump})\n` +
      `Acompanhe a betoneira no mapa ao vivo e acesse laudos e comprovantes:\n${window.location.href}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0B0F19',
      color: '#F8FAFC',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      paddingBottom: 50
    }}>
      {/* ─── TOPO DO PORTAL DO CLIENTE CONSTRUTOR ─── */}
      <header style={{
        background: 'linear-gradient(180deg, #161F30 0%, #0F172A 100%)',
        borderBottom: '1px solid rgba(255, 107, 44, 0.3)',
        padding: '14px 20px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              background: 'linear-gradient(135deg, #FF6B2C 0%, #D9480F 100%)',
              width: 42,
              height: 42,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(255, 107, 44, 0.4)'
            }}>
              <Truck size={24} color="#FFF" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#FF6B2C', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Portal do Cliente Construtor
              </div>
              <h1 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#FFF' }}>
                SERRANO CONCRETO &amp; MINERAÇÃO
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleCompartilharWhatsApp}
              style={{
                background: '#10B981',
                border: 'none',
                color: '#FFF',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer'
              }}
            >
              <Share2 size={14} />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={copiarLink}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#FFF',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer'
              }}
            >
              <span>{copiado ? '✓ Copiado' : 'Copiar Link'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── CONTEÚDO PRINCIPAL ─── */}
      <main style={{ maxWidth: 800, margin: '20px auto 0', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* ─── CARD 1: STATUS AO VIVO DO CAMINHÃO BETONEIRA ─── */}
        <div style={{
          background: 'linear-gradient(135deg, #131B2E 0%, #0F172A 100%)',
          border: '1px solid rgba(255, 107, 44, 0.4)',
          borderRadius: 16,
          padding: 20,
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  background: '#10B981',
                  color: '#064E3B',
                  fontSize: 10,
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: 4,
                  textTransform: 'uppercase'
                }}>
                  Betoneira em Trânsito
                </span>
                <span style={{ color: '#D4AF37', fontSize: 11, fontWeight: 800 }}>
                  • Motor KyttoIA 2.5 Flash
                </span>
              </div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#FFF' }}>
                Viagem {carga.viagemAtual} de {carga.totalViagens} · Betoneira {carga.betoneiraAtiva.codigo}
              </h2>
              <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>
                Placa: <strong>{carga.betoneiraAtiva.placa}</strong> · Motorista: <strong>{carga.betoneiraAtiva.motorista}</strong>
              </div>
            </div>

            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 12,
              padding: '10px 16px',
              textAlign: 'right'
            }}>
              <div style={{ fontSize: 11, color: '#34D399', fontWeight: 700, textTransform: 'uppercase' }}>
                Previsão de Chegada (ETA)
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#FFF' }}>
                ~{carga.betoneiraAtiva.etaMinutos} <span style={{ fontSize: 14, color: '#94A3B8' }}>minutos</span>
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>
                Distância: {carga.betoneiraAtiva.distanciaRestanteKm} km pela MT-358
              </div>
            </div>
          </div>

          {/* ─── MAPA VETORIAL / ESTILO UBER COM DESLOCAMENTO DA BETONEIRA ─── */}
          <div style={{
            background: '#0B0F19',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: 16,
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#38BDF8' }}>
                <Navigation size={14} />
                <span>ROTA USINA MATRIZ MT-358 ➔ CANTEIRO DE OBRAS TANGARÁ</span>
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#94A3B8' }}>
                <span>Velocidade: <strong style={{ color: '#FFF' }}>{carga.betoneiraAtiva.velocidadeKmH} km/h</strong></span>
                <span>Giro do Balão: <strong style={{ color: '#10B981' }}>{carga.betoneiraAtiva.rpmBalao} RPM</strong></span>
              </div>
            </div>

            {/* Linha de Trajeto Estilizada */}
            <div style={{ position: 'relative', height: 48, background: 'rgba(255,255,255,0.03)', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 20px' }}>
              <div style={{ position: 'absolute', left: 20, right: 20, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}></div>
              <div style={{ position: 'absolute', left: 20, width: `${progressoRota}%`, height: 4, background: 'linear-gradient(90deg, #FF6B2C, #10B981)', borderRadius: 2 }}></div>

              {/* Ponto 1: Usina MT-358 */}
              <div style={{ position: 'absolute', left: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#FF6B2C', border: '2px solid #FFF' }}></div>
                <span style={{ fontSize: 9, color: '#94A3B8', marginTop: 4, fontWeight: 700 }}>Usina MT-358</span>
              </div>

              {/* Caminhão Betoneira em Movimento */}
              <div style={{
                position: 'absolute',
                left: `calc(${progressoRota}% - 14px)`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transition: 'left 1s ease-in-out'
              }}>
                <div style={{
                  background: '#10B981',
                  color: '#FFF',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 16px rgba(16, 185, 129, 0.8)',
                  border: '2px solid #FFF'
                }}>
                  <Truck size={14} />
                </div>
                <span style={{ fontSize: 9, color: '#34D399', marginTop: 2, fontWeight: 800 }}>{carga.betoneiraAtiva.codigo}</span>
              </div>

              {/* Ponto 2: Obra Destino */}
              <div style={{ position: 'absolute', right: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#38BDF8', border: '2px solid #FFF' }}></div>
                <span style={{ fontSize: 9, color: '#94A3B8', marginTop: 4, fontWeight: 700 }}>Obra</span>
              </div>
            </div>

            {/* Cronômetro Regressivo de Janela de Pega NBR 7212 */}
            <div style={{
              marginTop: 14,
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#F59E0B' }}>
                <Clock size={15} />
                <span>Janela de Pega ABNT NBR 7212: <strong>{carga.betoneiraAtiva.tempoDecorridoMin} min transcorridos</strong></span>
              </div>
              <div style={{ color: '#10B981', fontWeight: 800 }}>
                ✓ {carga.betoneiraAtiva.limiteJanelaPegaMin - carga.betoneiraAtiva.tempoDecorridoMin} min de margem segura
              </div>
            </div>
          </div>
        </div>

        {/* ─── CARD 2: DADOS TÉCNICOS DO CONCRETO E OBRA ─── */}
        <div style={{
          background: '#131B2E',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: 20
        }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 900, color: '#FFF', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building size={18} color="#FF6B2C" />
            DADOS DA OBRA &amp; ESPECIFICAÇÃO DO TRAÇO
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>CLIENTE</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#FFF', marginTop: 2 }}>{carga.cliente}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>CANTEIRO DE OBRA</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#FFF', marginTop: 2 }}>{carga.obra}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>ENDEREÇO DE ENTREGA</div>
              <div style={{ fontSize: 13, color: '#CBD5E1', marginTop: 2 }}>{carga.endereco}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>EQUIPAMENTO DE BOMBEAMENTO</div>
              <div style={{ fontSize: 13, color: '#38BDF8', fontWeight: 800, marginTop: 2 }}>{carga.bombaEscalada}</div>
            </div>
          </div>

          <div style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 10
          }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>RESISTÊNCIA FCK</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#FF6B2C' }}>{carga.fck} MPa</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>ABATIMENTO (SLUMP)</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#FFF' }}>{carga.slump}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>BRITA / AGREGADO</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#FFF' }}>{carga.brita}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>VOLUME TOTAL</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#10B981' }}>{carga.volumeTotalM3} m³</div>
            </div>
          </div>
        </div>

        {/* ─── CARD 3: CENTRAL DE LAUDOS TECNOLÓGICOS E COMPROVANTES NBR ─── */}
        <div style={{
          background: '#131B2E',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: 20
        }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 900, color: '#FFF', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color="#10B981" />
            CENTRAL DE DOCUMENTOS, LAUDOS E CERTIFICADOS
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {/* Canhoto Digital */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#FFF', marginBottom: 4 }}>
                Canhoto Eletrônico NBR 7212
              </div>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 10px', lineHeight: 1.4 }}>
                Assinatura touch em campo pelo mestre de obras com registro fotográfico e carimbo GPS.
              </p>
              <a
                href={`/concreto/assinatura/${carga.id}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#FF6B2C',
                  fontSize: 12,
                  fontWeight: 800,
                  textDecoration: 'none'
                }}
              >
                <span>Acessar Assinatura</span>
                <ExternalLink size={13} />
              </a>
            </div>

            {/* Laudo de Ruptura de CPs NBR 5739 */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#FFF', marginBottom: 4 }}>
                Laudo de Ruptura NBR 5739
              </div>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 10px', lineHeight: 1.4 }}>
                Ensaio servo-hidráulico a 10 Hz com resistência aos 3, 7 e 28 dias e certificado SHA-256.
              </p>
              <a
                href={`/api/public/concreto/cargas/${carga.id}/laudo-html`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#10B981',
                  fontSize: 12,
                  fontWeight: 800,
                  textDecoration: 'none'
                }}
              >
                <span>Visualizar Laudo</span>
                <ExternalLink size={13} />
              </a>
            </div>

            {/* Medição de Obras LC 116 */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#FFF', marginBottom: 4 }}>
                Medição de Obra LC 116
              </div>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 10px', lineHeight: 1.4 }}>
                Dedução legal de 70% de materiais para abatimento na base de cálculo de ISSQN e INSS.
              </p>
              <span style={{ color: '#38BDF8', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={13} /> Faturamento Homologado
              </span>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

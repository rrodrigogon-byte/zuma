import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function TorreDeControlePesagemSerrano({ onVoltar }) {
  const navigate = useNavigate();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [modoTelaCheia, setModoTelaCheia] = useState(false);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: modoTelaCheia ? '100vh' : 'calc(100vh - 80px)',
      background: '#0D0F11',
      color: '#ECEAE6',
      borderRadius: modoTelaCheia ? 0 : 12,
      overflow: 'hidden',
      border: modoTelaCheia ? 'none' : '1px solid #2A2F34',
      position: modoTelaCheia ? 'fixed' : 'relative',
      top: modoTelaCheia ? 0 : 'auto',
      left: modoTelaCheia ? 0 : 'auto',
      right: modoTelaCheia ? 0 : 'auto',
      bottom: modoTelaCheia ? 0 : 'auto',
      zIndex: modoTelaCheia ? 99999 : 1
    }}>
      {/* BARRA SUPERIOR DE COMANDO DA TORRE */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: '#15181B',
        borderBottom: '1px solid #2A2F34',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onVoltar && (
            <button
              type="button"
              onClick={onVoltar}
              style={{
                background: '#1C2024',
                border: '1px solid #2A2F34',
                color: '#A9ADB2',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>←</span> Voltar
            </button>
          )}

          <div style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: '#FF7000',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 900,
            color: '#16181B',
            fontSize: 16,
            fontFamily: 'sans-serif'
          }}>
            SC
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                Torre de Pesagem &amp; Controle Operacional
              </span>
              <span style={{
                background: 'rgba(61,190,116,0.15)',
                color: '#3DBE74',
                fontSize: 10,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 12,
                border: '1px solid rgba(61,190,116,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3DBE74' }}></span>
                GÊMEO DIGITAL AO VIVO
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#80868C', fontFamily: 'monospace' }}>
              Serrano Concreto &amp; Mineração Sepotuba · Balanças 80t BAL-01 / BAL-02 · Motor KyttoIA CCO
            </div>
          </div>
        </div>

        {/* ATALHOS RÁPIDOS & CONTROLES */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate('/pdv')}
            style={{
              background: '#1C2024',
              border: '1px solid #2A2F34',
              color: '#ECEAE6',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
            title="Ir para tela de operação física da balança"
          >
            <span>⚖️</span> Balança Rodoviária 80t
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/concreto?secao=cameras-cftv')}
            style={{
              background: '#1C2024',
              border: '1px solid #2A2F34',
              color: '#ECEAE6',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
            title="Configurações e parâmetros avançados de câmeras IP"
          >
            <span>📹</span> Câmeras &amp; Vision AI
          </button>

          <a
            href="/torre-pesagem.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#1C2024',
              border: '1px solid #2A2F34',
              color: '#5B9BE0',
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
            title="Abrir a Torre em nova aba/monitor dedicado de CCO"
          >
            <span>↗</span> Abrir no Monitor CCO
          </a>

          <button
            type="button"
            onClick={() => setModoTelaCheia(!modoTelaCheia)}
            style={{
              background: modoTelaCheia ? '#FF7000' : '#1C2024',
              border: '1px solid ' + (modoTelaCheia ? '#FF7000' : '#2A2F34'),
              color: modoTelaCheia ? '#16181B' : '#ECEAE6',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>{modoTelaCheia ? '↙' : '⛶'}</span>
            {modoTelaCheia ? 'Sair Tela Cheia' : 'Modo Sala de Controle'}
          </button>
        </div>
      </div>

      {/* ÁREA DA TORRE INTERATIVA */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {!iframeLoaded && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0D0F11',
            gap: 12,
            zIndex: 2
          }}>
            <div style={{
              width: 36,
              height: 36,
              border: '3px solid #2A2F34',
              borderTopColor: '#FF7000',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <div style={{ fontSize: 13, color: '#A9ADB2', fontFamily: 'monospace' }}>
              Carregando Torre de Pesagem &amp; Gêmeo Digital Serrano...
            </div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        <iframe
          src="/torre-pesagem.html"
          title="Torre de Pesagem Serrano"
          onLoad={() => setIframeLoaded(true)}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block'
          }}
        />
      </div>
    </div>
  );
}

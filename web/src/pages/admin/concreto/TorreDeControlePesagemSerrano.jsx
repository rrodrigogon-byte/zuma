import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * TorreDeControlePesagemSerrano
 * 
 * Componente unificado do Centro de Controle Operacional (CCO) da Serrano Concreto & Mineração Sepotuba.
 * Integrado sem molduras ou menus redundantes ("tela dentro de tela"), com navegação sincronizada
 * e suporte nativo ao Modo Sala de Controle (tela cheia).
 */
export default function TorreDeControlePesagemSerrano({ onVoltar }) {
  const [modoTelaCheia, setModoTelaCheia] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data?.type === 'TOGGLE_FULLSCREEN') {
        setModoTelaCheia(prev => !prev);
      } else if (e.data?.type === 'NAVIGATE_SECTION') {
        if (e.data.secao === 'cameras-cftv') {
          navigate('/admin/concreto?secao=cameras-cftv');
        } else if (e.data.secao === 'despacho') {
          if (onVoltar) onVoltar();
          else navigate('/admin/concreto?secao=operacao-despacho');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate, onVoltar]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: modoTelaCheia ? '100vh' : 'calc(100vh - 138px)',
        minHeight: 700,
        background: '#0D0F11',
        color: '#ECEAE6',
        borderRadius: 0,
        overflow: 'hidden',
        border: 'none',
        position: modoTelaCheia ? 'fixed' : 'relative',
        top: modoTelaCheia ? 0 : 'auto',
        left: modoTelaCheia ? 0 : 'auto',
        right: modoTelaCheia ? 0 : 'auto',
        bottom: modoTelaCheia ? 0 : 'auto',
        zIndex: modoTelaCheia ? 99999 : 1,
        width: '100%'
      }}
    >
      {modoTelaCheia && (
        <button
          type="button"
          onClick={() => setModoTelaCheia(false)}
          style={{
            position: 'absolute',
            top: 10,
            right: 14,
            zIndex: 100000,
            background: 'rgba(255, 112, 0, 0.92)',
            color: '#16181B',
            border: 'none',
            borderRadius: 6,
            padding: '7px 14px',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span>✕</span> Sair da Sala de Controle (Tela Cheia)
        </button>
      )}

      {/* ÁREA DA TORRE INTERATIVA (100% UTILIZAÇÃO DE TELA) */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, width: '100%' }}>
        {!iframeLoaded && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0D0F11',
              gap: 12,
              zIndex: 2
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                border: '3px solid #2A2F34',
                borderTopColor: '#FF7000',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}
            />
            <div style={{ fontSize: 13, color: '#A9ADB2', fontFamily: 'monospace' }}>
              Carregando Torre de Pesagem &amp; Gêmeo Digital Serrano...
            </div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        <iframe
          src="/torre-pesagem.html"
          title="Torre de Pesagem Serrano CCO"
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

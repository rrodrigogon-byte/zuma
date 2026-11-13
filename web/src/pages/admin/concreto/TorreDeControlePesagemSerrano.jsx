import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * TorreDeControlePesagemSerrano
 * 
 * Componente unificado do Centro de Controle Operacional (CCO) da Serrano Concreto & Mineração Sepotuba.
 * Integrado como sub-módulo de navegação nativa no ERP Kytto, sem barras laterais duplicadas,
 * com sincronização bidirecional de abas em tempo real e suporte a tela cheia.
 */
export default function TorreDeControlePesagemSerrano({ subsecao = 'torre', onSubsecaoChange, onVoltar }) {
  const [modoTelaCheia, setModoTelaCheia] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const navigate = useNavigate();

  const alternarTelaCheia = () => {
    const doc = document;
    const isFs = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement;
    if (!isFs) {
      const el = containerRef.current || doc.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
      setModoTelaCheia(true);
    } else {
      if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      else if (doc.mozCancelFullScreen) doc.mozCancelFullScreen();
      setModoTelaCheia(false);
    }
  };

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data?.type === 'TAB_CHANGED' && e.data.tab) {
        if (onSubsecaoChange && e.data.tab !== subsecao) {
          onSubsecaoChange(e.data.tab);
        }
      } else if (e.data?.type === 'TOGGLE_FULLSCREEN') {
        alternarTelaCheia();
      } else if (e.data?.type === 'NAVIGATE_SECTION') {
        if (e.data.secao === 'cameras-cftv') {
          navigate('/admin/concreto?secao=cameras-cftv');
        } else if (e.data.secao === 'despacho') {
          if (onVoltar) onVoltar();
          else navigate('/admin/concreto?secao=operacao-despacho');
        }
      }
    };

    const handleFsChange = () => {
      setModoTelaCheia(Boolean(document.fullscreenElement || document.webkitFullscreenElement));
    };

    window.addEventListener('message', handleMessage);
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);

    return () => {
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [navigate, onVoltar, onSubsecaoChange, subsecao]);

  // Sincroniza a sub-seção selecionada no ERP Kytto com o iframe via postMessage sem recarregar a página
  useEffect(() => {
    if (iframeLoaded && iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({ type: 'CHANGE_TAB', tab: subsecao }, '*');
      } catch {
        // cross-origin guard
      }
    }
  }, [subsecao, iframeLoaded]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: modoTelaCheia ? '100vh' : 'calc(100vh - 170px)',
        minHeight: 680,
        background: '#0D0F11',
        color: '#ECEAE6',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--joint, rgba(255, 255, 255, 0.08))',
        position: modoTelaCheia ? 'fixed' : 'relative',
        top: modoTelaCheia ? 0 : 'auto',
        left: modoTelaCheia ? 0 : 'auto',
        right: modoTelaCheia ? 0 : 'auto',
        bottom: modoTelaCheia ? 0 : 'auto',
        zIndex: modoTelaCheia ? 99999 : 1,
        width: '100%',
        marginTop: 6
      }}
    >
      {modoTelaCheia && (
        <button
          type="button"
          onClick={alternarTelaCheia}
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

      {/* ÁREA DA TORRE INTERATIVA (100% UTILIZAÇÃO DE TELA SEM SIDEBAR DUPLICADA) */}
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
          ref={iframeRef}
          src={`/torre-pesagem.html?embed=1&tab=${encodeURIComponent(subsecao || 'torre')}`}
          title="Torre de Pesagem Serrano CCO"
          allow="fullscreen"
          allowFullScreen
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

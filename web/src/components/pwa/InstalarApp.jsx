/**
 * Convite para instalar o app (PWA) na Tela de Início.
 * - Android/Chrome/Edge: usa o pedido nativo (beforeinstallprompt) com um botão.
 * - iPhone/iPad: o iOS não tem botão de instalar; mostra o passo a passo
 *   (Compartilhar → Adicionar à Tela de Início).
 * - Já instalado (aberto como app): não mostra nada.
 * "Agora não" esconde o convite por 14 dias neste aparelho.
 */
import { useEffect, useState } from 'react'

const CHAVE_ADIADO = 'kytto_pwa_convite_adiado_ate'

export function rodandoComoApp() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function ehIos() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  // iPadOS se apresenta como Mac; o toque denuncia o iPad.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

function adiado() {
  try { return Number(localStorage.getItem(CHAVE_ADIADO) || 0) > Date.now() } catch { return false }
}

function IconeCompartilhar() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ verticalAlign: '-3px' }}>
    <path d="M12 3v12M12 3l-4 4M12 3l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
}

export default function InstalarApp({ nomeApp = 'o app', tema = {}, compacto = false }) {
  const [pedido, setPedido] = useState(null)
  const [visivel, setVisivel] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    if (rodandoComoApp() || adiado()) return undefined
    setIos(ehIos())
    if (ehIos()) setVisivel(true)
    const antes = (event) => { event.preventDefault(); setPedido(event); setVisivel(true) }
    const instalado = () => { setVisivel(false); setPedido(null) }
    window.addEventListener('beforeinstallprompt', antes)
    window.addEventListener('appinstalled', instalado)
    return () => { window.removeEventListener('beforeinstallprompt', antes); window.removeEventListener('appinstalled', instalado) }
  }, [])

  if (!visivel) return null

  const cor = { card: tema.card || '#1C202B', linha: tema.line || '#2B3140', texto: tema.cream || '#E8EAF2', suave: tema.muted || '#A4AABE', destaque: tema.accent || '#6E7CE0' }
  const adiar = () => {
    try { localStorage.setItem(CHAVE_ADIADO, String(Date.now() + 14 * 86400000)) } catch { /* sem armazenamento: só esconde agora */ }
    setVisivel(false)
  }
  const instalar = async () => {
    if (!pedido) return
    pedido.prompt()
    await pedido.userChoice.catch(() => null)
    setPedido(null)
    setVisivel(false)
  }

  return <div role="region" aria-label="Instalar o app" style={{ background: cor.card, border: `1px solid ${cor.linha}`, borderRadius: 16, padding: compacto ? 12 : 16, display: 'grid', gap: 10, color: cor.texto }}>
    <div style={{ fontWeight: 800, fontSize: 15 }}>Instale {nomeApp} no celular</div>
    {ios
      ? <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6, fontSize: 14, color: cor.suave, lineHeight: 1.45 }}>
        <li>Toque em <strong style={{ color: cor.texto }}>Compartilhar</strong> <IconeCompartilhar /> na barra do Safari.</li>
        <li>Escolha <strong style={{ color: cor.texto }}>Adicionar à Tela de Início</strong>.</li>
        <li>Toque em <strong style={{ color: cor.texto }}>Adicionar</strong>. O app abre em tela cheia, como os outros.</li>
      </ol>
      : <div style={{ fontSize: 14, color: cor.suave, lineHeight: 1.45 }}>Abre direto da Tela de Início, em tela cheia, e funciona mesmo com internet fraca.</div>}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {!ios && pedido && <button type="button" onClick={instalar} style={{ flex: '1 1 160px', padding: '12px 14px', borderRadius: 12, border: 'none', background: cor.destaque, color: '#fff', font: 'inherit', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>Instalar app</button>}
      <button type="button" onClick={adiar} style={{ flex: '0 1 auto', padding: '12px 14px', borderRadius: 12, border: `1px solid ${cor.linha}`, background: 'transparent', color: cor.texto, font: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Agora não</button>
    </div>
  </div>
}

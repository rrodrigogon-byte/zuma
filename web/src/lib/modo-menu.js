import { useEffect, useState } from 'react'

// Abaixo desta largura o menu lateral vira gaveta (abre pelo botão ☰), em qualquer aparelho.
export const LARGURA_MENU_GAVETA = 1024
// Aparelho cujo apontador principal não passa o mouse por cima (iPad, celular, tela de toque).
const CONSULTA_SEM_MOUSE = '(hover: none)'

/**
 * O menu lateral é gaveta quando a tela é estreita ou quando não há mouse: no toque não existe
 * "passar o mouse", então o menu recolhido-que-abre-no-hover ficaria preso aberto por cima da tela.
 */
export function menuEmGaveta(janela = typeof window !== 'undefined' ? window : null) {
  if (!janela) return false
  const estreita = Number(janela.innerWidth || 0) < LARGURA_MENU_GAVETA
  let semMouse = false
  try { semMouse = Boolean(janela.matchMedia?.(CONSULTA_SEM_MOUSE)?.matches) } catch { semMouse = false }
  return estreita || semMouse
}

export function useMenuEmGaveta() {
  const [gaveta, setGaveta] = useState(() => menuEmGaveta())
  useEffect(() => {
    const atualizar = () => setGaveta(menuEmGaveta())
    window.addEventListener('resize', atualizar)
    window.addEventListener('orientationchange', atualizar)
    let consulta = null
    try { consulta = window.matchMedia?.(CONSULTA_SEM_MOUSE) || null } catch { consulta = null }
    consulta?.addEventListener?.('change', atualizar)
    return () => {
      window.removeEventListener('resize', atualizar)
      window.removeEventListener('orientationchange', atualizar)
      consulta?.removeEventListener?.('change', atualizar)
    }
  }, [])
  return gaveta
}

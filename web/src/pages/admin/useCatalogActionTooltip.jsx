import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const HELP = {
  Editar: 'Abre o cadastro para revisar e editar o produto; nenhuma mudança é salva automaticamente.',
  Duplicar: 'Cria uma cópia em rascunho, sem publicá-la.',
  Variantes: 'Abre as variantes para gerenciar preço, estoque e mídia.',
  Retirar: 'Retira o produto da vitrine, preservando seu cadastro e histórico.',
  Publicar: 'Publica o produto na vitrine selecionada.',
  Arquivar: 'Arquiva o produto e o retira da vitrine; preserva o histórico.',
  Excluir: 'Exclui o cadastro legado deste produto. Confira antes de confirmar.',
  Atualizar: 'Busca novamente os dados da vitrine e do catálogo selecionados.',
  'Adicionar produto': 'Abre o formulário para cadastrar um produto nesta vitrine.',
  'Novo item': 'Abre o formulário de cadastro; só salva após confirmação.',
  Produtos: 'Mostra e filtra os produtos da vitrine.',
  'Inserção em lote': 'Abre a importação com prévia antes de gravar alterações.',
  'Conteúdo e imagens': 'Abre ferramentas de descrição e imagens dos produtos.',
  Categorias: 'Abre o cadastro e a organização das categorias.',
  'Limpar filtros': 'Remove os filtros de busca e exibe novamente os produtos.',
  'Exibir em tabela': 'Organiza os produtos em linhas para consulta e edição.',
  'Exibir em cartões': 'Organiza os produtos em cartões com imagem maior.',
  'Salvar categoria': 'Salva as alterações da categoria selecionada.',
  'Criar categoria': 'Cria a categoria na vitrine selecionada.',
  'Adicionar primeiro produto': 'Abre o formulário do primeiro produto da vitrine.',
  Anterior: 'Exibe a página anterior de produtos.',
  Próxima: 'Exibe a próxima página de produtos.',
  Cancelar: 'Fecha esta edição sem salvar mudanças.',
}

export function catalogHelpFor(target) {
  if (!target) return ''
  const explicit = target.dataset?.catalogHelp?.trim()
  if (explicit) return explicit
  if (target.tagName === 'SELECT') {
    const label = target.closest('label')
    const field = label?.querySelector('span')?.textContent?.trim() || label?.firstChild?.textContent?.trim() || target.getAttribute('aria-label') || 'uma opção'
    return `Seleciona ${field.toLocaleLowerCase('pt-BR')} para esta vitrine, sem salvar outras alterações.`
  }
  const label = (target.textContent || target.getAttribute('aria-label') || target.title || '').trim().replace(/\s+/g, ' ')
  if (!label) return ''
  const key = Object.keys(HELP).find(name => label === name || (['Editar', 'Duplicar', 'Variantes', 'Retirar', 'Publicar', 'Arquivar', 'Excluir'].includes(name) && label.startsWith(`${name} `)))
  if (key) return HELP[key]
  return `Ação: ${label.slice(0, 96)}${label.length > 96 ? '…' : ''}.`
}

/** Attaches only while the catalog is mounted; also covers its header and dialogs. */
export default function useCatalogActionTooltip(rootRef) {
  const [tip, setTip] = useState(null)
  useEffect(() => {
    const workspace = rootRef.current
    const shell = workspace?.closest('.ecommerce-admin-shell') || workspace
    if (!workspace || !shell) return undefined
    let active = null
    let previousDescription = null
    let hideTimer = 0

    function hide() {
      clearTimeout(hideTimer)
      if (active) {
        if (previousDescription == null) active.removeAttribute('aria-describedby')
        else active.setAttribute('aria-describedby', previousDescription)
      }
      active = null
      previousDescription = null
      setTip(null)
    }
    function action(event) {
      const node = event.target instanceof Element ? event.target.closest('button, a[href], select, input[type=submit]') : null
      const inScope = node && (workspace.contains(node)
        || shell.querySelector('.ecommerce-admin-header-actions')?.contains(node)
        || shell.querySelector('.commerce-product-modal')?.contains(node))
      return inScope && shell.contains(node) && !node.disabled ? node : null
    }
    function show(event) {
      const node = action(event)
      if (!node) return
      const text = catalogHelpFor(node)
      if (!text) return
      if (active !== node) {
        hide()
        active = node
        previousDescription = node.getAttribute('aria-describedby')
        node.setAttribute('aria-describedby', [previousDescription, 'commerce-catalog-action-tooltip'].filter(Boolean).join(' '))
      }
      const rect = node.getBoundingClientRect()
      const below = rect.top < 95
      const left = Math.max(130, Math.min(window.innerWidth - 130, rect.left + rect.width / 2))
      const top = below ? rect.bottom + 9 : rect.top - 9
      clearTimeout(hideTimer)
      hideTimer = window.setTimeout(() => setTip({ text, left, top, below }), event.type === 'focusin' ? 0 : 180)
    }
    function leave(event) {
      if (active && event.relatedTarget instanceof Node && active.contains(event.relatedTarget)) return
      if (active && event.target instanceof Node && active.contains(event.target) && document.activeElement !== active) hide()
    }
    const onEscape = event => { if (event.key === 'Escape') hide() }
    shell.addEventListener('pointerover', show)
    shell.addEventListener('pointerout', leave)
    shell.addEventListener('focusin', show)
    shell.addEventListener('focusout', leave)
    shell.addEventListener('click', hide)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    document.addEventListener('keydown', onEscape)
    return () => {
      hide()
      shell.removeEventListener('pointerover', show)
      shell.removeEventListener('pointerout', leave)
      shell.removeEventListener('focusin', show)
      shell.removeEventListener('focusout', leave)
      shell.removeEventListener('click', hide)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
      document.removeEventListener('keydown', onEscape)
    }
  }, [rootRef])

  return tip && typeof document !== 'undefined'
    ? createPortal(<div id="commerce-catalog-action-tooltip" role="tooltip" className={`commerce-catalog-action-tooltip${tip.below ? ' below' : ''}`} style={{ left: tip.left, top: tip.top }}>{tip.text}</div>, document.body)
    : null
}

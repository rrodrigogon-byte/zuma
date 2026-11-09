import React, { useRef } from 'react'
import useDialogFocus from '../../../components/store/useDialogFocus'

export const API = '/api/admin/barbearia/clientes-360'

export const SEGMENTS = {
  vip: { label: 'VIP', tone: 'accent', hint: 'Alto valor ou alta frequência' },
  recorrente: { label: 'Recorrente', tone: 'success', hint: 'Compra ou visita com regularidade' },
  novo: { label: 'Novo', tone: 'info', hint: 'Uma única compra ou visita' },
  em_risco: { label: 'Em risco', tone: 'warning', hint: 'Mais de 45 dias sem atividade' },
  inativo: { label: 'Inativo', tone: 'danger', hint: 'Mais de 90 dias sem atividade' },
  sem_historico: { label: 'Sem histórico', tone: 'muted', hint: 'Nenhuma visita, pedido ou conversa registrada' },
}

export const TIMELINE_ICONS = { agendamento: '▣', comanda: '✂', revenda: '▤', pedido: '◧', carrinho: '◌', whatsapp: '✆', campanha: '↻', pontos: '☆' }
export const SOURCE_LABELS = {
  barbearia: 'Barbearia', pedidos: 'Pedidos da loja', crediario_loja: 'Crediário da loja', pontos_loja: 'Pontos da loja',
  carrinhos: 'Carrinhos', whatsapp: 'WhatsApp IA', campanhas: 'Campanhas', consentimentos_loja: 'Consentimentos da loja',
}
export const REASONS = {
  desativado: 'Commerce desativado', sem_permissao: 'Seu perfil não tem acesso a clientes da loja', sem_membership: 'Selecione a empresa/loja',
  tabela_ausente: 'Módulo ainda não instalado', coluna_ausente: 'Módulo desatualizado', temporariamente_indisponivel: 'Temporariamente indisponível',
}
export const STATUS_LABELS = {
  concluido: 'Concluído', agendado: 'Agendado', confirmado: 'Confirmado', cancelado: 'Cancelado', nao_compareceu: 'Não compareceu', em_atendimento: 'Em atendimento',
  paga: 'Paga', aberta: 'Aberta', em_conta: 'Em conta', aguardando_pagamento: 'Aguardando pagamento', pago: 'Pago', pendente: 'Pendente', atrasada: 'Atrasada',
  paid: 'Pago', pending_payment: 'Aguardando pagamento', cancelled: 'Cancelado', completed: 'Concluído', processing: 'Em preparo', shipped: 'Enviado',
  delivered: 'Entregue', picked_up: 'Retirado', ready_for_pickup: 'Pronto para retirada', open: 'Aberto', abandoned: 'Abandonado', converted: 'Convertido', expired: 'Expirado',
  ativo: 'Ativo', humano: 'Com atendente', encerrado: 'Encerrado', active: 'Ativo',
}
export const statusLabel = (value) => STATUS_LABELS[value] || String(value || '—').replaceAll('_', ' ')
export const FIELD_LABELS = { telefone: 'telefone', email: 'e-mail', documento: 'CPF/CNPJ', endereco: 'endereço' }
export const REVEAL_PRESETS = ['Retorno de contato solicitado pelo cliente', 'Emissão de nota fiscal', 'Cobrança de valor em aberto', 'Atendimento de pedido ou entrega']

export function fmtDay(value) {
  if (!value) return '—'
  const text = String(value)
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00` : text)
  return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleDateString('pt-BR')
}

export function daysLabel(days) {
  if (days == null) return 'Sem atividade'
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Ontem'
  return `Há ${days} dias`
}

export function Badge({ tone = 'muted', children, title }) {
  return <span className={`c360-badge tone-${tone}`} title={title}>{children}</span>
}

export function EmptyLine({ children }) {
  return <p className="c360-empty">{children}</p>
}

export function Table({ columns, rows, empty, caption }) {
  if (!rows?.length) return <EmptyLine>{empty}</EmptyLine>
  return <div className="c360-table-wrap">
    <table className="c360-table">
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead><tr>{columns.map((column) => <th key={column.key} scope="col" className={column.align === 'right' ? 'num' : ''}>{column.label}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={row.id || index}>{columns.map((column) => <td key={column.key} className={column.align === 'right' ? 'num' : ''}>{column.render ? column.render(row) : row[column.key]}</td>)}</tr>)}</tbody>
    </table>
  </div>
}


export const profilePath = (ref) => `/admin/clientes-360/${encodeURIComponent(ref)}`

export function Avatar({ name, big = false }) {
  return <span className={`c360-avatar${big ? ' big' : ''}`} aria-hidden="true">{String(name || '?').trim().charAt(0).toUpperCase()}</span>
}

/** Diálogo acessível: foco preso, ESC e clique fora fecham. */
export function Dialog({ open, title, labelId, onClose, onSubmit, children, actions, danger = false, initialFocusRef }) {
  const fallbackRef = useRef(null)
  const dialogRef = useDialogFocus(Boolean(open), onClose, initialFocusRef || fallbackRef)
  if (!open) return null
  const Tag = onSubmit ? 'form' : 'div'
  return <div className="c360-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <Tag ref={dialogRef} className={`c360-dialog${danger ? ' is-danger' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelId} onSubmit={onSubmit ? (event) => { event.preventDefault(); onSubmit() } : undefined}>
      <h2 id={labelId}>{title}</h2>
      {children}
      <div className="c360-dialog-actions">{actions}</div>
    </Tag>
  </div>
}

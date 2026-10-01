export const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
export const pct = (value, digits = 1) => (value == null || Number.isNaN(Number(value)) ? '—' : `${Number(value).toFixed(digits).replace('.', ',')}%`)
export const int = (value) => Number(value || 0).toLocaleString('pt-BR')

export function shortDate(value) {
  if (!value) return '—'
  const text = String(value)
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00` : text)
  return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleDateString('pt-BR')
}

export function dateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function csvCell(value) {
  const text = String(value ?? '')
  return /[";\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(rows) {
  if (!rows?.length) return ''
  const keys = Object.keys(rows[0])
  return [keys.join(';'), ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(';'))].join('\n')
}

export function downloadCsv(filename, rows) {
  const csv = toCsv(rows)
  if (!csv) return
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Data local (fuso do navegador) no formato AAAA-MM-DD. */
export function localDay(date = new Date()) {
  return date.toLocaleDateString('en-CA')
}

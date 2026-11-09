export const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
export const pct = (value, digits = 1) => (value == null || Number.isNaN(Number(value)) ? '—' : `${Number(value).toFixed(digits).replace('.', ',')}%`)
export const int = (value) => Number(value || 0).toLocaleString('pt-BR')

/** Formata valores em formato compacto "k" ou "M" com números redondos (ex: R$ 55k, R$ 55.5k, R$ 1.2M, R$ 460). */
export function moneyK(value, options = {}) {
  const num = Number(value || 0)
  const prefix = options.prefix !== false ? 'R$ ' : ''
  if (num === 0) return `${prefix}0`

  const abs = Math.abs(num)
  const sign = num < 0 ? '-' : ''

  if (abs >= 1_000_000) {
    const m = abs / 1_000_000
    const rounded = Math.round(m * 10) / 10
    const formatted = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)
    return `${sign}${prefix}${formatted}M`
  }

  if (abs >= 1_000) {
    const k = abs / 1_000
    const rounded = Math.round(k * 10) / 10
    const formatted = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)
    return `${sign}${prefix}${formatted}k`
  }

  const rounded = Math.round(abs)
  return `${sign}${prefix}${rounded}`
}

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

export function formatCnpj(v) {
  if (!v) return '—';
  const c = String(v).replace(/\D/g, '');
  if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return v;
}

export function formatIe(v) {
  if (!v) return '—';
  const c = String(v).replace(/\D/g, '');
  if (c.length === 9) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, '$1.$2.$3-$4');
  return v;
}

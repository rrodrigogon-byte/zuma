// Aviso curto embaixo do campo de CEP: "Buscando…", "Cidade/UF preenchido",
// "CEP geral: informe rua e bairro" ou "CEP não encontrado".
const TONE_COLOR = {
  ok: 'var(--success, #1F8A4C)',
  warn: 'var(--warning, #9A6700)',
  error: 'var(--danger, #C62828)',
  muted: 'var(--muted, #667085)',
}

export default function CepHint({ info }) {
  if (!info?.message) return null
  return (
    <small className={`cep-hint is-${info.tone || 'muted'}`} role="status" aria-live="polite" style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.35, fontWeight: 600, color: TONE_COLOR[info.tone] || TONE_COLOR.muted }}>
      {info.message}
    </small>
  )
}

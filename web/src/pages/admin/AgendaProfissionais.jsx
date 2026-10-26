import { useMemo, useState } from 'react'

export function profissionaisSelecionados(valor = '') {
  return [...new Set(String(valor).split(',').map(s => s.trim()).filter(Boolean))]
}

export function alternarProfissional(valor, id) {
  const ids = profissionaisSelecionados(valor)
  return (ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]).join(',')
}

function iniciais(nome = '') {
  return String(nome || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase()
}

// Paleta de cores para avatares inspirada no Google Calendar / Design System Kytto
const CORES_AVATAR = [
  '#1a73e8', // Azul Google
  '#E05915', // Laranja Kytto
  '#0d9488', // Teal
  '#7c3aed', // Roxo
  '#db2777', // Rosa
  '#d97706', // Âmbar
  '#0284c7', // Ciano
  '#4f46e5', // Índigo
  '#16a34a', // Verde
]

export default function AgendaProfissionais({
  profissionais = [],
  value = '',
  onChange,
  label = 'Barbeiros da equipe',
  mostrarContador = true,
  className = ''
}) {
  const ids = profissionaisSelecionados(value)
  const [expandirInativos, setExpandirInativos] = useState(false)

  // Filtra APENAS profissionais ativos (elimina inativos e excluídos da visão principal)
  const ativos = useMemo(() => {
    return (profissionais || [])
      .filter(p => p && p.ativo !== false && !p.removidoEm && !p.excluido)
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
  }, [profissionais])

  // Inativos isolados, fora da visão padrão para não poluir
  const inativos = useMemo(() => {
    return (profissionais || []).filter(p => p && (p.ativo === false || p.removidoEm || p.excluido))
  }, [profissionais])

  return (
    <div role="group" aria-label={label} className={`dino-cal-professionals-top ${className}`.trim()}>
      <div className="dino-cal-profs-header">
        <span className="dino-cal-profs-label">{label}</span>
        {mostrarContador && (
          <span className="dino-cal-profs-count">{ativos.length} ativo{ativos.length === 1 ? '' : 's'}</span>
        )}
      </div>

      <div className="dino-cal-profs-chips">
        {/* Botão Toda a Equipe */}
        <button
          type="button"
          className="dino-cal-prof-chip"
          aria-pressed={!ids.length}
          onClick={() => onChange?.('')}
          title="Ver agenda combinada de todos os barbeiros ativos"
        >
          <span className="dino-cal-prof-avatar dino-cal-prof-avatar-team">👥</span>
          <span className="dino-cal-prof-name">Toda a equipe</span>
          <span className="dino-cal-prof-badge">{ativos.length}</span>
        </button>

        {/* Chips de Barbeiros Ativos */}
        {ativos.map((p, idx) => {
          const selecionado = ids.includes(p.id)
          const cor = CORES_AVATAR[idx % CORES_AVATAR.length]
          const nomeCurto = p.apelido || (p.nome ? p.nome.split(' ').slice(0, 2).join(' ') : 'Barbeiro')
          return (
            <button
              type="button"
              key={p.id}
              className="dino-cal-prof-chip"
              data-ativo="true"
              aria-pressed={selecionado}
              onClick={(e) => {
                // Se pressionar Shift ou Ctrl, permite múltipla seleção
                if (e.shiftKey || e.ctrlKey || e.metaKey) {
                  onChange?.(alternarProfissional(value, p.id))
                } else {
                  // Clique simples: foca exclusivamente neste profissional (ou desmarca se já era ele)
                  if (ids.length === 1 && ids[0] === p.id) {
                    onChange?.('')
                  } else {
                    onChange?.(p.id)
                  }
                }
              }}
              title={`Clique para ver apenas a agenda de ${p.nome} (Shift+clique para comparar)`}
            >
              <span
                className="dino-cal-prof-avatar"
                style={{
                  backgroundColor: selecionado ? cor : `color-mix(in srgb, ${cor} 16%, var(--card))`,
                  color: selecionado ? '#ffffff' : cor,
                  borderColor: cor,
                }}
              >
                {p.fotoUrl ? (
                  <img src={p.fotoUrl} alt={p.nome} className="dino-cal-prof-avatar-img" />
                ) : (
                  iniciais(p.nome)
                )}
              </span>
              <span className="dino-cal-prof-name">{nomeCurto}</span>
              {selecionado && <span className="dino-cal-prof-check">✓</span>}
            </button>
          )
        })}

        {/* Botão sutil para inativos caso estritamente necessário para conferência */}
        {inativos.length > 0 && (
          <div className="dino-cal-inativos-wrap">
            <button
              type="button"
              className="dino-cal-prof-chip dino-cal-prof-chip-inativos"
              onClick={() => setExpandirInativos(v => !v)}
              title="Exibir ou ocultar profissionais inativos/antigos"
            >
              <span>{expandirInativos ? 'Ocultar inativos' : `+${inativos.length} inativo(s)`}</span>
            </button>
            {expandirInativos && inativos.map((p) => {
              const selecionado = ids.includes(p.id)
              return (
                <button
                  type="button"
                  key={p.id}
                  className="dino-cal-prof-chip dino-cal-prof-chip-inativo"
                  aria-pressed={selecionado}
                  onClick={() => onChange?.(alternarProfissional(value, p.id))}
                >
                  <span className="dino-cal-prof-avatar dino-cal-prof-avatar-muted">{iniciais(p.nome)}</span>
                  <span className="dino-cal-prof-name">{p.nome} <small>(inativo)</small></span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

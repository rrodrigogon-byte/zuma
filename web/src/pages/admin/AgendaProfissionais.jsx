import { useMemo, useState, useEffect, useRef } from 'react'

export function profissionaisSelecionados(valor = '') {
  return [...new Set(String(valor).split(',').map(s => s.trim()).filter(Boolean))]
}

export function alternarProfissional(valor, id) {
  const ids = profissionaisSelecionados(valor)
  return (ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]).join(',')
}

export function iniciais(nome = '') {
  return String(nome || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase()
}

// Cores para os avatares inspiradas no Google Calendar
export const CORES_AVATAR = [
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
  visiveisIds = null,
  onVisiveisIdsChange,
  label = 'Barbeiros da equipe',
  className = ''
}) {
  const ids = profissionaisSelecionados(value)
  const [popoverFiltroAberto, setPopoverFiltroAberto] = useState(false)
  const popoverRef = useRef(null)

  // Filtra APENAS profissionais estritamente ativos (sem inativos ou excluídos)
  const ativos = useMemo(() => {
    return (profissionais || [])
      .filter(p => p && p.ativo !== false && !p.removidoEm && !p.excluido)
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
  }, [profissionais])

  // Barbeiros selecionados para exibição na tela
  // Se visiveisIds for fornecido e não vazio, usa ele; senão exibe todos os ativos
  const idsExibidos = useMemo(() => {
    if (Array.isArray(visiveisIds) && visiveisIds.length > 0) {
      return visiveisIds
    }
    return ativos.map(p => p.id)
  }, [visiveisIds, ativos])

  // Barbeiros que aparecem na barra de chips
  const barbeirosExibidos = useMemo(() => {
    const setIds = new Set(idsExibidos)
    return ativos.filter(p => setIds.has(p.id))
  }, [ativos, idsExibidos])

  // Fecha o popover ao clicar fora
  useEffect(() => {
    if (typeof document === 'undefined') return
    function handleClickFora(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setPopoverFiltroAberto(false)
      }
    }
    if (popoverFiltroAberto) {
      document.addEventListener('mousedown', handleClickFora)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickFora)
    }
  }, [popoverFiltroAberto])

  function alternarVisibilidade(id) {
    if (!onVisiveisIdsChange) return
    const setIds = new Set(idsExibidos)
    if (setIds.has(id)) {
      setIds.delete(id)
    } else {
      setIds.add(id)
    }
    const novos = Array.from(setIds)
    onVisiveisIdsChange(novos)
  }

  function marcarTodos() {
    if (!onVisiveisIdsChange) return
    onVisiveisIdsChange(ativos.map(p => p.id))
  }

  function desmarcarTodos() {
    if (!onVisiveisIdsChange) return
    if (ativos.length > 0) {
      onVisiveisIdsChange([ativos[0].id])
    } else {
      onVisiveisIdsChange([])
    }
  }

  return (
    <div role="group" aria-label={label} className={`dino-cal-professionals-top ${className}`.trim()}>
      {/* Linha de Cabeçalho: Título + Botão de Filtro de Barbeiros na Tela */}
      <div className="dino-cal-profs-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="dino-cal-profs-label">{label}</span>
          <span className="dino-cal-profs-count" title="Barbeiros exibidos na grade">
            {barbeirosExibidos.length} de {ativos.length} na tela
          </span>
        </div>

        {/* Botão de Filtro de Profissionais Exibidos na Tela */}
        <div style={{ position: 'relative' }} ref={popoverRef}>
          <button
            type="button"
            className="dino-cal-btn-filter-profs"
            onClick={() => setPopoverFiltroAberto(v => !v)}
            aria-expanded={popoverFiltroAberto}
            title="Escolha quais profissionais você deseja exibir ou ocultar na tela"
          >
            <span style={{ fontSize: 13 }}>⚙️</span>
            <span>Filtrar exibição ({barbeirosExibidos.length}/{ativos.length})</span>
            <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
          </button>

          {/* POPOVER / DROPDOWN DE FILTRO DE PROFISSIONAIS */}
          {popoverFiltroAberto && (
            <div className="dino-cal-filter-popover" role="dialog" aria-label="Filtrar profissionais exibidos">
              <div className="dino-cal-filter-popover-header">
                <div>
                  <strong>Profissionais na tela</strong>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>
                    Marque quem deve aparecer no calendário
                  </p>
                </div>
                <button
                  type="button"
                  className="dino-cal-filter-close-btn"
                  onClick={() => setPopoverFiltroAberto(false)}
                  title="Fechar"
                >
                  ✕
                </button>
              </div>

              {/* Ações rápidas: Selecionar todos / Limpar */}
              <div className="dino-cal-filter-actions-bar">
                <button
                  type="button"
                  className="dino-cal-filter-action-btn"
                  onClick={marcarTodos}
                >
                  ✓ Marcar todos ({ativos.length})
                </button>
                <button
                  type="button"
                  className="dino-cal-filter-action-btn"
                  onClick={desmarcarTodos}
                >
                  ✕ Limpar seleção
                </button>
              </div>

              {/* Lista com Checkboxes dos Barbeiros Ativos */}
              <div className="dino-cal-filter-list">
                {ativos.map((p, idx) => {
                  const visivel = idsExibidos.includes(p.id)
                  const cor = CORES_AVATAR[idx % CORES_AVATAR.length]
                  return (
                    <label key={p.id} className="dino-cal-filter-item">
                      <input
                        type="checkbox"
                        checked={visivel}
                        onChange={() => alternarVisibilidade(p.id)}
                        className="dino-cal-filter-checkbox"
                      />
                      <span
                        className="dino-cal-prof-avatar"
                        style={{
                          width: 24,
                          height: 24,
                          fontSize: 10,
                          backgroundColor: visivel ? cor : 'var(--line)',
                          color: visivel ? '#fff' : 'var(--muted)',
                          borderColor: cor
                        }}
                      >
                        {iniciais(p.nome)}
                      </span>
                      <span className="dino-cal-filter-name" style={{ fontWeight: visivel ? 700 : 500 }}>
                        {p.nome}
                      </span>
                      {visivel && (
                        <span className="dino-cal-filter-badge-on">visível</span>
                      )}
                    </label>
                  )
                })}
              </div>

              <div className="dino-cal-filter-popover-footer">
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  {barbeirosExibidos.length} de {ativos.length} visíveis na agenda
                </span>
                <button
                  type="button"
                  className="dino-cal-filter-confirm-btn"
                  onClick={() => setPopoverFiltroAberto(false)}
                >
                  Concluir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Linha dos Chips: "Toda a equipe" + Barbeiros que foram marcados no filtro */}
      <div className="dino-cal-profs-chips">
        {/* Botão Toda a Equipe / Todos os Visíveis */}
        <button
          type="button"
          className="dino-cal-prof-chip"
          aria-pressed={!ids.length}
          onClick={() => onChange?.('')}
          title={`Ver agenda de todos os ${barbeirosExibidos.length} barbeiros visíveis na tela`}
        >
          <span className="dino-cal-prof-avatar dino-cal-prof-avatar-team">👥</span>
          <span className="dino-cal-prof-name">
            {barbeirosExibidos.length === ativos.length ? 'Toda a equipe' : 'Equipe filtrada'}
          </span>
          <span className="dino-cal-prof-badge">{barbeirosExibidos.length}</span>
        </button>

        {/* Chips dos Barbeiros que o usuário escolheu exibir */}
        {barbeirosExibidos.map((p, idx) => {
          const selecionado = ids.includes(p.id)
          const cor = CORES_AVATAR[idx % CORES_AVATAR.length]
          const nomeCurto = p.apelido || (p.nome ? p.nome.split(' ').slice(0, 2).join(' ') : 'Barbeiro')

          return (
            <button
              type="button"
              key={p.id}
              className="dino-cal-prof-chip"
              data-ativo="true"
              aria-label={p.nome}
              aria-pressed={selecionado}
              onClick={(e) => {
                if (e.shiftKey || e.ctrlKey || e.metaKey) {
                  onChange?.(alternarProfissional(value, p.id))
                } else {
                  if (ids.length === 1 && ids[0] === p.id) {
                    onChange?.('')
                  } else {
                    onChange?.(p.id)
                  }
                }
              }}
              title={`Clique para focar na agenda de ${p.nome} (Shift+clique para comparar)`}
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

        {barbeirosExibidos.length === 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', padding: '4px 10px' }}>
            <span>Nenhum barbeiro selecionado.</span>
            <button
              type="button"
              onClick={marcarTodos}
              style={{ background: 'transparent', border: 0, color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Exibir todos ({ativos.length})
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

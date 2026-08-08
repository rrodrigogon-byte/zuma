import { useState, useEffect } from 'react'
import { api, fmtDate } from '../../lib/api'

const CATEGORIAS = [
  { value: 'todos',     label: 'Todas',    color: '#888' },
  { value: 'aviso',     label: 'Aviso',    color: '#FF6B2C' },
  { value: 'resultado', label: 'Resultado', color: '#FF6B2C' },
  { value: 'novidade',  label: 'Novidade', color: '#FF9B72' },
]

function catInfo(cat) {
  return CATEGORIAS.find(c => c.value === cat) || { label: cat, color: '#888' }
}

function Badge({ categoria }) {
  const { label, color } = catInfo(categoria)
  return (
    <span style={{
      display: 'inline-block', padding: '0.2rem 0.6rem',
      borderRadius: 12, background: color + '22', color, fontSize: '0.75rem', fontWeight: 700,
    }}>{label}</span>
  )
}

const S = {
  page: { padding: '1.5rem', maxWidth: 900, margin: '0 auto' },
  h1: { color: 'var(--fg)', fontWeight: 800, fontSize: '1.6rem', margin: '0 0 0.3rem 0' },
  subtitle: { color: 'var(--muted)', fontSize: '0.95rem', marginBottom: '1.5rem' },
  filters: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' },
  filterBtn: (active, color) => ({
    padding: '0.35rem 1rem', borderRadius: 20, fontSize: '0.82rem', fontWeight: 600,
    border: `1px solid ${active ? color : 'var(--line)'}`, cursor: 'pointer',
    background: active ? color + '22' : 'var(--surface)',
    color: active ? color : 'var(--muted)',
    transition: 'all .15s',
  }),
  grid: { display: 'grid', gap: 16 },
  card: (expanded) => ({
    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12,
    overflow: 'hidden', cursor: 'pointer',
    boxShadow: expanded ? '0 4px 16px rgba(0,0,0,.12)' : '0 1px 4px rgba(0,0,0,.06)',
    transition: 'box-shadow .2s',
  }),
  cardHeader: { padding: '1rem 1.25rem 0.75rem' },
  cardMeta: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  cardTitle: { color: 'var(--fg)', fontWeight: 700, fontSize: '1.1rem', margin: '0 0 0.3rem 0', lineHeight: 1.3 },
  cardResumo: { color: 'var(--muted)', fontSize: '0.88rem', lineHeight: 1.5, margin: 0 },
  cardDate: { color: 'var(--muted)', fontSize: '0.78rem' },
  divider: { border: 'none', borderTop: '1px solid var(--line)', margin: '0 1.25rem' },
  cardBody: { padding: '1rem 1.25rem', color: 'var(--fg)', fontSize: '0.9rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' },
  chevron: (expanded) => ({
    marginLeft: 'auto', fontSize: 13, color: 'var(--muted)',
    transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s',
    flexShrink: 0,
  }),
  empty: { textAlign: 'center', color: 'var(--muted)', padding: '3rem', background: 'var(--surface)', borderRadius: 12 },
}

function NoticiaCard({ noticia }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={S.card(expanded)} onClick={() => setExpanded(e => !e)}>
      <div style={S.cardHeader}>
        <div style={S.cardMeta}>
          <Badge categoria={noticia.categoria} />
          <span style={S.cardDate}>{fmtDate(noticia.criadoEm)}</span>
          {noticia.autor && <span style={{ ...S.cardDate, marginLeft: 4 }}>por {noticia.autor}</span>}
          <span style={S.chevron(expanded)}>▼</span>
        </div>
        <h2 style={S.cardTitle}>{noticia.titulo}</h2>
        {noticia.resumo && <p style={S.cardResumo}>{noticia.resumo}</p>}
      </div>
      {expanded && noticia.conteudo && (
        <>
          <hr style={S.divider} />
          <div style={S.cardBody}>{noticia.conteudo}</div>
        </>
      )}
    </div>
  )
}

export default function NoticiasPublic() {
  const [noticias, setNoticias] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')

  useEffect(() => {
    api.get('/api/noticias?publicado=1')
      .then(setNoticias)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtradas = filtro === 'todos'
    ? noticias
    : noticias.filter(n => n.categoria === filtro)

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Notícias do Torneio</h1>
      <p style={S.subtitle}>Fique por dentro das últimas novidades, resultados e avisos.</p>

      <div style={S.filters}>
        {CATEGORIAS.map(c => (
          <button
            key={c.value}
            style={S.filterBtn(filtro === c.value, c.color)}
            onClick={e => { e.stopPropagation(); setFiltro(c.value) }}
          >{c.label}</button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Carregando…</p>
      ) : filtradas.length === 0 ? (
        <div style={S.empty}>Nenhuma notícia disponível no momento.</div>
      ) : (
        <div style={S.grid}>
          {filtradas.map(n => <NoticiaCard key={n.id} noticia={n} />)}
        </div>
      )}
    </div>
  )
}

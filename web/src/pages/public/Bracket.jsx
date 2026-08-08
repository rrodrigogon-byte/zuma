import { useState, useEffect } from 'react'
import { api, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

/* ─── helpers ─── */
function pct(done, total) {
  if (!total) return 0
  return Math.round((done / total) * 100)
}

/* ─── BracketVisual ─── */
function BracketVisual({ rodadas }) {
  if (!rodadas || rodadas.length === 0) return <p className="empty-msg">Sem jogos ainda.</p>

  return (
    <div className="bracket-scroll">
      <div className="bracket-columns" style={{ display: 'flex', gap: '0', alignItems: 'flex-start' }}>
        {rodadas.map((rodada, ri) => (
          <div key={ri} className="bracket-round" style={{ minWidth: 200 }}>
            <div className="bracket-round-title">{rodada.nome}</div>
            <div
              className="bracket-matches"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: `${Math.pow(2, ri) * 8}px`,
                paddingTop: `${Math.pow(2, ri) * 4}px`,
              }}
            >
              {rodada.jogos.map((jogo, ji) => (
                <BracketMatch key={ji} jogo={jogo} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BracketMatch({ jogo }) {
  const temPlacar = jogo.placar1 != null || jogo.placar2 != null
  const encerrado = !!jogo.vencedor

  return (
    <div className={`bracket-match ${encerrado ? 'bracket-match--done' : ''}`}>
      <BracketPlayer
        nome={jogo.p1 || 'A definir'}
        placar={jogo.placar1}
        vencedor={encerrado && jogo.vencedor === jogo.p1}
        bye={!jogo.p1}
      />
      <div className="bracket-divider" />
      <BracketPlayer
        nome={jogo.p2 || 'A definir'}
        placar={jogo.placar2}
        vencedor={encerrado && jogo.vencedor === jogo.p2}
        bye={!jogo.p2}
      />
      {(jogo.data || jogo.quadra) && (
        <div className="bracket-match-meta">
          {jogo.data && <span>{fmtDate(jogo.data)}</span>}
          {jogo.quadra && <span>Q{jogo.quadra}</span>}
        </div>
      )}
    </div>
  )
}

function BracketPlayer({ nome, placar, vencedor, bye }) {
  return (
    <div className={`bracket-player ${vencedor ? 'bracket-player--winner' : ''} ${bye ? 'bracket-player--bye' : ''}`}>
      <span className="bracket-player-nome">{nome}</span>
      {placar != null && <span className="bracket-player-placar">{placar}</span>}
    </div>
  )
}

/* ─── GruposView ─── */
function GruposView({ data }) {
  if (!data) return null
  const { grupos, jogos } = data

  return (
    <div className="grupos-wrap">
      <div className="grupos-tabelas">
        {(grupos || []).map((g, i) => (
          <div key={i} className="grupo-card">
            <h3 className="grupo-nome">{g.nome}</h3>
            <table className="admin-table grupo-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Atleta</th>
                  <th title="Vitórias">V</th>
                  <th title="Derrotas">D</th>
                  <th title="Sets">Sets</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {(g.tabela || []).map((row, j) => (
                  <tr key={j} className={j < 2 ? 'grupo-row--classifica' : ''}>
                    <td>{j + 1}</td>
                    <td>{row.atleta}</td>
                    <td>{row.v ?? 0}</td>
                    <td>{row.d ?? 0}</td>
                    <td>{row.sets ?? '—'}</td>
                    <td><strong>{row.pontos ?? 0}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {jogos && jogos.length > 0 && (
        <div className="grupos-jogos">
          <h3>Próximos Jogos</h3>
          <div className="jogos-lista">
            {jogos.filter(j => !j.vencedor).slice(0, 20).map((j, i) => (
              <div key={i} className="jogo-item">
                <span className="jogo-hora">{j.hora || '—'}</span>
                <span className="jogo-confronto">{j.p1} vs {j.p2}</span>
                {j.quadra && <span className="jogo-quadra">Q{j.quadra}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── TabelaView (suiço / roundrobin) ─── */
function TabelaView({ data, tipo }) {
  if (!data) return null
  const tabela = data.tabela || []
  const rodadas = data.rodadas || []

  return (
    <div className="tabela-wrap">
      {tabela.length > 0 && (
        <table className="admin-table tabela-classificacao">
          <thead>
            <tr>
              <th>#</th>
              <th>Atleta</th>
              <th>PJ</th>
              <th>V</th>
              <th>D</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {tabela.map((row, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{row.atleta || row.nome || '—'}</td>
                <td>{row.pj ?? (row.v ?? 0) + (row.d ?? 0)}</td>
                <td>{row.v ?? 0}</td>
                <td>{row.d ?? 0}</td>
                <td><strong>{row.pontos ?? row.pts ?? 0}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rodadas.length > 0 && (
        <div className="rodadas-lista">
          <h3>Rodadas</h3>
          {rodadas.map((r, i) => (
            <div key={i} className="rodada-bloco">
              <h4 className="rodada-nome">{r.nome || `Rodada ${i + 1}`}</h4>
              <div className="jogos-lista">
                {(r.jogos || []).map((j, ji) => (
                  <div key={ji} className={`jogo-item ${j.vencedor ? 'jogo-item--done' : ''}`}>
                    <span className={`jogo-p ${j.vencedor === j.p1 ? 'winner' : ''}`}>{j.p1}</span>
                    {(j.placar1 != null) && (
                      <span className="jogo-placar">{j.placar1} × {j.placar2}</span>
                    )}
                    <span className="jogo-vs">{j.placar1 == null ? 'vs' : ''}</span>
                    <span className={`jogo-p ${j.vencedor === j.p2 ? 'winner' : ''}`}>{j.p2}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Main ─── */
export default function Bracket() {
  const [categorias, setCategorias] = useState([])
  const [catSel, setCatSel] = useState('')
  const [dados, setDados] = useState(null)
  const [formato, setFormato] = useState(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    api.get('/api/categorias')
      .then(data => {
        const list = Array.isArray(data) ? data : data.categorias || []
        setCategorias(list)
        if (list.length > 0) setCatSel(list[0]?.slug || list[0]?.id || list[0])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!catSel) return
    setLoading(true)
    setDados(null)
    setFormato(null)

    // Tenta bracket primeiro, depois fallback para outros formatos
    api.get(`/api/bracket/${catSel}`)
      .then(data => {
        setFormato(data.formato || 'eliminatoria')
        setDados(data)
        setLoading(false)
      })
      .catch(() => {
        api.get(`/api/grupos/${catSel}`)
          .then(data => { setFormato('grupos'); setDados(data); setLoading(false) })
          .catch(() => {
            api.get(`/api/suico/${catSel}`)
              .then(data => { setFormato('swiss'); setDados(data); setLoading(false) })
              .catch(() => {
                api.get(`/api/liga/${catSel}`)
                  .then(data => { setFormato('roundrobin'); setDados(data); setLoading(false) })
                  .catch(() => { setLoading(false) })
              })
          })
      })
  }, [catSel])

  /* progresso */
  const progresso = (() => {
    if (!dados) return null
    if (formato === 'eliminatoria' || formato === 'dupla_eliminacao') {
      const jogos = (dados.rodadas || []).flatMap(r => r.jogos || [])
      const done = jogos.filter(j => j.vencedor).length
      return { done, total: jogos.length }
    }
    return null
  })()

  const catLabel = (c) => (typeof c === 'object' ? c.nome || c.slug || c.id : c)
  const catVal = (c) => (typeof c === 'object' ? c.slug || c.id : c)

  return (
    <div className="page-bracket">
      {/* Header */}
      <div className="bracket-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <h1 className="bracket-titulo" style={{ margin: 0 }}>🏆 Chaves do Torneio</h1>
          {dados && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              background: '#FF6B2C18', color: '#FF6B2C', border: '1px solid #FF6B2C40' }}>
              {formato === 'eliminatoria' ? 'Eliminatória' : formato === 'grupos' ? 'Fase de Grupos'
                : formato === 'swiss' ? 'Suíço' : formato === 'roundrobin' ? 'Round Robin'
                : formato === 'dupla_eliminacao' ? 'Dupla Eliminação' : formato}
            </span>
          )}
        </div>
        <p style={{ color: '#5A6570', margin: '0 0 16px', fontSize: '0.9rem' }}>
          Selecione uma categoria para ver os confrontos
        </p>

        {categorias.length > 0 && (
          <div className="bracket-cat-selector">
            {categorias.map(c => (
              <button
                key={catVal(c)}
                className={`cat-btn ${catSel === catVal(c) ? 'cat-btn--active' : ''}`}
                onClick={() => setCatSel(catVal(c))}
              >
                {catLabel(c)}
                {c.inscritos > 0 && (
                  <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.75 }}>{c.inscritos}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {progresso && (
          <div className="bracket-progresso">
            <div className="progresso-bar">
              <div
                className="progresso-fill"
                style={{ width: `${pct(progresso.done, progresso.total)}%` }}
              />
            </div>
            <span className="progresso-label">
              {progresso.done}/{progresso.total} jogos concluídos ({pct(progresso.done, progresso.total)}%)
            </span>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <p className="loading-msg">Carregando chave…</p>
      ) : !dados ? (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎾</div>
          <p style={{ color: '#5A6570', fontSize: '1rem', fontWeight: 600 }}>Chave ainda não gerada para esta categoria.</p>
          <p style={{ color: '#8AA9C0', fontSize: '0.85rem' }}>Aguarde o sorteio oficial ou escolha outra categoria acima.</p>
        </div>
      ) : (
        <div className="bracket-content">
          {(formato === 'eliminatoria' || formato === 'dupla_eliminacao') && (
            <BracketVisual rodadas={dados.rodadas || []} />
          )}
          {formato === 'grupos' && (
            <GruposView data={dados} />
          )}
          {(formato === 'swiss' || formato === 'roundrobin') && (
            <TabelaView data={dados} tipo={formato} />
          )}
        </div>
      )}

      <style>{`
        .page-bracket { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }

        .bracket-header { margin-bottom: 1.5rem; }
        .bracket-titulo { font-size: 1.5rem; font-weight: 700; color: #12283F; margin-bottom: 1rem; }

        .bracket-cat-selector { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 1rem; }
        .cat-btn {
          padding: .4rem .9rem; border-radius: 20px; border: 1.5px solid #FF6B2C;
          background: #fff; color: #FF6B2C; font-weight: 600; cursor: pointer; font-size: .85rem;
          transition: all .15s;
        }
        .cat-btn:hover { background: #FFF9F5; }
        .cat-btn--active { background: #FF6B2C; color: #fff; }

        .bracket-progresso { display: flex; align-items: center; gap: .75rem; margin-top: .5rem; }
        .progresso-bar { flex: 1; max-width: 300px; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
        .progresso-fill { height: 100%; background: #FF6B2C; border-radius: 4px; transition: width .3s; }
        .progresso-label { font-size: .8rem; color: #6b7280; }

        /* Bracket */
        .bracket-scroll { overflow-x: auto; padding-bottom: 1rem; }
        .bracket-columns { min-width: max-content; }
        .bracket-round { padding: 0 .5rem; }
        .bracket-round-title {
          text-align: center; font-size: .75rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: .05em; color: #6b7280; margin-bottom: .75rem; padding: .3rem .5rem;
          background: #f9fafb; border-radius: 6px;
        }

        .bracket-match {
          background: #fff; border: 1.5px solid #e5e7eb; border-radius: 8px;
          overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.06);
          min-width: 180px;
        }
        .bracket-match--done { border-color: #FFF9F5; }
        .bracket-match-meta {
          display: flex; gap: .5rem; padding: .2rem .5rem; background: #f9fafb;
          font-size: .7rem; color: #9ca3af; border-top: 1px solid #f3f4f6;
        }

        .bracket-divider { height: 1px; background: #e5e7eb; }

        .bracket-player {
          display: flex; justify-content: space-between; align-items: center;
          padding: .45rem .6rem; gap: .5rem;
          transition: background .1s;
        }
        .bracket-player--winner { background: #FFF9F5; }
        .bracket-player--bye { opacity: .45; }
        .bracket-player-nome {
          font-size: .82rem; font-weight: 500; color: #111; flex: 1;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .bracket-player--winner .bracket-player-nome { color: #2D6F9E; font-weight: 700; }
        .bracket-player-placar {
          font-size: .82rem; font-weight: 700; color: #374151;
          background: #f3f4f6; border-radius: 4px; padding: .1rem .35rem; min-width: 24px;
          text-align: center;
        }
        .bracket-player--winner .bracket-player-placar { background: #FFF9F5; color: #2D6F9E; }

        /* Grupos */
        .grupos-wrap { display: flex; flex-direction: column; gap: 2rem; }
        .grupos-tabelas { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
        .grupo-card { background: #fff; border: 1.5px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
        .grupo-nome {
          background: #12283F; color: #fff; padding: .6rem 1rem;
          font-size: .9rem; font-weight: 700; margin: 0;
        }
        .grupo-table { margin: 0; }
        .grupo-table th, .grupo-table td { padding: .4rem .6rem; font-size: .82rem; }
        .grupo-row--classifica td:first-child::after { content: ' ✓'; color: #FF6B2C; }

        .grupos-jogos h3 { font-size: 1rem; font-weight: 700; margin-bottom: .75rem; }

        /* Tabela */
        .tabela-wrap { display: flex; flex-direction: column; gap: 2rem; }
        .tabela-classificacao { max-width: 600px; }

        /* Jogos lista */
        .jogos-lista { display: flex; flex-direction: column; gap: .4rem; }
        .jogo-item {
          display: flex; align-items: center; gap: .75rem; padding: .5rem .75rem;
          background: #f9fafb; border-radius: 8px; font-size: .85rem;
        }
        .jogo-item--done { opacity: .6; }
        .jogo-hora { color: #6b7280; min-width: 40px; font-size: .8rem; }
        .jogo-confronto { flex: 1; font-weight: 500; }
        .jogo-quadra { color: #9ca3af; font-size: .78rem; }
        .jogo-p { flex: 1; }
        .jogo-p.winner { font-weight: 700; color: #2D6F9E; }
        .jogo-placar { font-weight: 700; font-size: .9rem; color: #374151; }
        .jogo-vs { color: #9ca3af; font-size: .75rem; }

        .rodada-bloco { margin-bottom: 1.5rem; }
        .rodada-nome { font-size: .9rem; font-weight: 700; color: #12283F; margin-bottom: .5rem; }

        @media (max-width: 640px) {
          .page-bracket { padding: 1rem; }
          .bracket-round { min-width: 160px; padding: 0 .25rem; }
          .bracket-player-nome { font-size: .78rem; }
        }
      `}</style>
    </div>
  )
}

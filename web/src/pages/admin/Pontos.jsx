import { useState, useEffect, useCallback, useMemo } from 'react'
import { api, asArray } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

// ── Gráfico de linha SVG — evolução do Elo ───────────────────────────────────
function EloLineChart({ historico, jogadorNome, color = '#FF6B2C' }) {
  // Filtra só os eventos de elo do jogador selecionado
  const dados = useMemo(() => {
    const hist = historico
      .filter(h => h.socioNome === jogadorNome && h.elo != null)
      .sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm))
    if (hist.length === 0) return []
    return hist.map((h, i) => ({
      x: i,
      y: h.elo,
      label: new Date(h.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      tipo: h.tipo,
    }))
  }, [historico, jogadorNome])

  if (dados.length < 2) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.9rem' }}>
        {dados.length === 0
          ? 'Nenhum dado de Elo para este jogador.'
          : 'Necessário ao menos 2 pontos para exibir o gráfico.'}
      </div>
    )
  }

  const W = 500, H = 160, PAD = { t: 16, r: 20, b: 36, l: 50 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b
  const minY = Math.min(...dados.map(d => d.y)) - 50
  const maxY = Math.max(...dados.map(d => d.y)) + 50

  const px = i => PAD.l + (i / (dados.length - 1)) * iW
  const py = v => PAD.t + iH - ((v - minY) / (maxY - minY)) * iH

  const points = dados.map((d, i) => `${px(i)},${py(d.y)}`).join(' ')

  // Linha de baseline (rating inicial / 1500)
  const baseline = py(1500)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxHeight: 200, overflow: 'visible' }}>
      {/* Grid horizontal */}
      {[minY, (minY + maxY) / 2, maxY].map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={py(v)} x2={W - PAD.r} y2={py(v)}
            stroke="var(--line)" strokeWidth="0.5" strokeDasharray="4" />
          <text x={PAD.l - 6} y={py(v) + 4} textAnchor="end" fontSize="9" fill="var(--muted)">
            {Math.round(v)}
          </text>
        </g>
      ))}

      {/* Linha baseline 1500 */}
      {baseline >= PAD.t && baseline <= PAD.t + iH && (
        <line x1={PAD.l} y1={baseline} x2={W - PAD.r} y2={baseline}
          stroke="#FF6B2C" strokeWidth="1" strokeDasharray="6 3" opacity={0.6} />
      )}

      {/* Área preenchida */}
      <polyline
        points={[
          `${PAD.l},${PAD.t + iH}`,
          ...dados.map((d, i) => `${px(i)},${py(d.y)}`),
          `${px(dados.length - 1)},${PAD.t + iH}`,
        ].join(' ')}
        fill={color + '22'}
        stroke="none"
      />

      {/* Linha principal */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Pontos e labels */}
      {dados.map((d, i) => (
        <g key={i}>
          <circle cx={px(i)} cy={py(d.y)} r={3} fill={color} />
          {(i === 0 || i === dados.length - 1 || dados.length <= 10) && (
            <text x={px(i)} y={PAD.t + iH + 14} textAnchor="middle" fontSize="8" fill="var(--muted)">
              {d.label}
            </text>
          )}
        </g>
      ))}

      {/* Valor atual */}
      <text x={px(dados.length - 1) + 5} y={py(dados[dados.length - 1].y) - 6}
        fontSize="10" fontWeight="bold" fill={color}>
        {dados[dados.length - 1].y}
      </text>
    </svg>
  )
}

// ── Mini sparkline para o ranking ─────────────────────────────────────────────
function Sparkline({ historico, socioNome }) {
  const vals = useMemo(() => {
    return historico
      .filter(h => h.socioNome === socioNome && h.elo != null)
      .sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm))
      .slice(-10)
      .map(h => h.elo)
  }, [historico, socioNome])

  if (vals.length < 2) return <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>

  const W = 60, H = 20
  const min = Math.min(...vals), max = Math.max(...vals)
  const range = max - min || 1
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - min) / range) * H}`).join(' ')
  const trend = vals[vals.length - 1] > vals[0]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 60, height: 20 }}>
      <polyline points={pts} fill="none" stroke={trend ? '#FF6B2C' : '#e05c5c'} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const fmtData = s => s ? new Date(s).toLocaleDateString('pt-BR') : '—'
const fmtR = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0))

const TIPO_INFO = {
  manual:    { label: 'Manual',     bg: '#e0e7ff', color: '#3730a3' },
  reserva:   { label: 'Reserva',    bg: '#FFF9F5', color: '#12283F' },
  compra:    { label: 'Compra',     bg: '#fef3c7', color: '#92400e' },
  inscricao: { label: 'Inscrição',  bg: '#ede9fe', color: '#5b21b6' },
  resgate:   { label: 'Resgate',    bg: '#fee2e2', color: '#991b1b' },
  bonus:     { label: 'Bônus',      bg: '#FFF9F5', color: '#12283F' },
}

const S = {
  page:  { padding: '24px 28px', maxWidth: 1100 },
  hdr:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 22, fontWeight: 800, color: 'var(--cream)' },
  btn:   { padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12 },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 24 },
  card:  { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '14px 18px' },
  cNum:  { fontSize: 26, fontWeight: 800, color: 'var(--green)', marginBottom: 2 },
  cLbl:  { fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' },
  table: { width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)' },
  th:    { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)', background: 'rgba(0,0,0,.03)' },
  td:    { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--line)' },
  inp:   { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--cream)', fontSize: 13 },
  lbl:   { fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 },
}

export default function Pontos() {
  const { toast } = useToast()
  const [tab, setTab] = useState('ranking')
  const [eloJogador, setEloJogador] = useState('')
  const [saldos, setSaldos] = useState([])
  const [historico, setHistorico] = useState([])
  const [socios, setSocios] = useState([])
  const [filtroSocio, setFiltroSocio] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalCreditar, setModalCreditar] = useState(false)
  const [modalResgatar, setModalResgatar] = useState(false)
  const [form, setForm] = useState({ socioId: '', pontos: '', tipo: 'manual', descricao: '' })
  const [formR, setFormR] = useState({ socioId: '', pontos: '', descricao: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, h, sc] = await Promise.all([
        api.get('/api/admin/pontos/saldos'),
        api.get('/api/admin/pontos'),
        api.get('/api/admin/socios'),
      ])
      const saldosLista = asArray(s, ['saldos', 'items'])
      const historicoLista = asArray(h, ['pontos', 'historico', 'items'])
      const sociosLista = asArray(sc, ['socios', 'items'])
      setSaldos(saldosLista)
      setHistorico(historicoLista)
      setSocios(sociosLista)
      // Define o primeiro sócio como padrão do gráfico Elo
      if (saldosLista.length > 0 && !eloJogador) setEloJogador(saldosLista[0].nome)
    } catch (error) {
      toast(error.message || 'Erro ao carregar o Programa de Pontos', true)
    } finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  const totalPontos = saldos.reduce((s, x) => s + x.saldo, 0)
  const comPontos = saldos.filter(s => s.saldo > 0).length
  const top = saldos[0]
  const [buscaRanking, setBuscaRanking] = useState('')

  const saldosFiltrados = useMemo(() => {
    if (!buscaRanking.trim()) return saldos
    const q = buscaRanking.toLowerCase()
    return saldos.filter(s => (s.nome || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q))
  }, [saldos, buscaRanking])

  const histFiltrado = filtroSocio
    ? historico.filter(h => h.socioId == filtroSocio)
    : historico

  async function creditar(e) {
    e.preventDefault()
    try {
      const r = await api.post('/api/admin/pontos', form)
      toast(`+${form.pontos} pontos creditados. Saldo: ${r.saldo}`)
      setModalCreditar(false); setForm({ socioId: '', pontos: '', tipo: 'manual', descricao: '' }); load()
    } catch (e) { toast(e.message, true) }
  }

  async function resgatar(e) {
    e.preventDefault()
    try {
      const r = await api.post('/api/admin/pontos/resgatar', formR)
      toast(`Resgate de ${formR.pontos} pts. Saldo restante: ${r.saldo}`)
      setModalResgatar(false); setFormR({ socioId: '', pontos: '', descricao: '' }); load()
    } catch (e) { toast(e.message, true) }
  }

  async function excluir(id) {
    if (!confirm('Estornar este lançamento de pontos?')) return
    try { await api.delete(`/api/admin/pontos/${id}`); toast('Estornado'); load() }
    catch (e) { toast(e.message, true) }
  }

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <div style={S.title}>⭐ Programa de Pontos</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              const headers = ['Sócio', 'Saldo', 'Data']
              const rows = tab === 'histórico'
                ? histFiltrado.map(h => [h.socioNome, h.pontos, h.criadoEm ? new Date(h.criadoEm).toLocaleString('pt-BR') : ''])
                : saldos.map(s => [s.nome, s.saldo, ''])
              const csv = [headers, ...rows].map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n')
              const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })); a.download = `pontos_${new Date().toISOString().slice(0,10)}.csv`; a.click()
            }}
            style={{ ...S.btn, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--cream)' }}
          >⬇ CSV</button>
          <button onClick={() => setModalResgatar(true)} style={{ ...S.btn, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--cream)' }}>🎁 Resgatar</button>
          <button onClick={() => setModalCreditar(true)} style={{ ...S.btn, background: 'var(--green)', color: 'var(--deep)' }}>+ Creditar Pontos</button>
        </div>
      </div>

      {/* KPI Cards com borderLeft */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { label: 'PONTOS ATIVOS', value: totalPontos.toLocaleString('pt-BR'), color: '#FF6B2C', icon: '⭐', sub: 'total em circulação' },
          { label: 'SÓCIOS COM PONTOS', value: comPontos, color: '#FF9B72', icon: '👥', sub: `de ${saldos.length} sócios` },
          { label: 'CRÉDITOS REALIZADOS', value: historico.filter(h => h.pontos > 0).length, color: '#FF6B2C', icon: '✏️', sub: 'lançamentos de crédito' },
          { label: 'LÍDER DO RANKING', value: top?.nome?.split(' ')[0] || '—', color: '#FF6B2C', icon: '🏆', sub: `${top?.saldo || 0} pontos` },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10,
            padding: '14px 18px', borderLeft: `4px solid ${k.color}`, flex: 1, minWidth: 140,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700 }}>{k.label}</div>
              <span style={{ fontSize: 16 }}>{k.icon}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--line)' }}>
        {['ranking', 'histórico', 'elo'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
            background: 'none', color: tab === t ? 'var(--green)' : 'var(--muted)',
            borderBottom: tab === t ? '2px solid var(--green)' : '2px solid transparent', textTransform: 'capitalize',
          }}>{t === 'elo' ? '⚡ Elo / Rating' : t}</button>
        ))}
      </div>

      {tab === 'ranking' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <input
              value={buscaRanking}
              onChange={e => setBuscaRanking(e.target.value)}
              placeholder="🔍 Buscar sócio por nome ou e-mail…"
              style={{ width: '100%', maxWidth: 320, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--cream)', fontSize: 13 }}
            />
            {buscaRanking && <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--muted)' }}>{saldosFiltrados.length} resultado(s)</span>}
          </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>#</th>
              <th style={S.th}>Sócio</th>
              <th style={S.th}>E-mail</th>
              <th style={S.th}>Pontos</th>
              <th style={S.th}>Tendência Elo</th>
              <th style={S.th}>Ações</th>
            </tr></thead>
            <tbody>
              {saldosFiltrados.length === 0 && <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Nenhum ponto registrado ainda.</td></tr>}
              {saldosFiltrados.map((s, i) => (
                <tr key={s.id}>
                  <td style={{ ...S.td, color: i < 3 ? 'var(--gold)' : 'var(--muted)', fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ ...S.td, fontWeight: 700 }}>{s.nome}</td>
                  <td style={{ ...S.td, color: 'var(--muted)', fontSize: 12 }}>{s.email}</td>
                  <td style={S.td}>
                    <span style={{ fontWeight: 800, fontSize: 16, color: s.saldo > 0 ? 'var(--green)' : 'var(--muted)' }}>
                      {s.saldo.toLocaleString('pt-BR')}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>pts</span>
                  </td>
                  <td style={S.td}>
                    <Sparkline historico={historico} socioNome={s.nome} />
                  </td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setForm(f => ({ ...f, socioId: s.id })); setModalCreditar(true) }}
                        style={{ ...S.btn, padding: '4px 9px', background: '#FFF9F5', color: '#12283F', fontSize: 11 }}>+ Creditar</button>
                      {s.saldo > 0 && (
                        <button onClick={() => { setFormR(f => ({ ...f, socioId: s.id })); setModalResgatar(true) }}
                          style={{ ...S.btn, padding: '4px 9px', background: '#fef3c7', color: '#92400e', fontSize: 11 }}>Resgatar</button>
                      )}
                      <button
                        onClick={() => { setEloJogador(s.nome); setTab('elo') }}
                        style={{ ...S.btn, padding: '4px 9px', background: '#ede9fe', color: '#5b21b6', fontSize: 11 }}
                      >⚡ Elo</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {tab === 'histórico' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={filtroSocio} onChange={e => setFiltroSocio(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--cream)', fontSize: 13 }}>
              <option value="">Todos os sócios</option>
              {socios.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{histFiltrado.length} lançamentos</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead><tr>
                {['Data', 'Sócio', 'Tipo', 'Pontos', 'Descrição', 'Ação'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {histFiltrado.length === 0 && <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Nenhum lançamento.</td></tr>}
                {histFiltrado.map(h => {
                  const ti = TIPO_INFO[h.tipo] || TIPO_INFO.manual
                  return (
                    <tr key={h.id}>
                      <td style={{ ...S.td, color: 'var(--muted)', fontSize: 12 }}>{fmtData(h.criadoEm)}</td>
                      <td style={{ ...S.td, fontWeight: 600 }}>{h.socioNome}</td>
                      <td style={S.td}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: ti.bg, color: ti.color }}>{ti.label}</span>
                      </td>
                      <td style={S.td}>
                        <span style={{ fontWeight: 800, color: h.pontos > 0 ? 'var(--green)' : '#ef4444' }}>
                          {h.pontos > 0 ? '+' : ''}{h.pontos}
                        </span>
                      </td>
                      <td style={{ ...S.td, color: 'var(--muted)', fontSize: 12 }}>{h.descricao}</td>
                      <td style={S.td}>
                        <button onClick={() => excluir(h.id)} style={{ ...S.btn, padding: '3px 8px', background: '#fee2e2', color: '#991b1b', fontSize: 11 }}>Estornar</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Aba Elo / Rating ── */}
      {tab === 'elo' && (
        <div>
          {/* Seletor de jogador */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Jogador:</label>
            <select
              value={eloJogador}
              onChange={e => setEloJogador(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--cream)', fontSize: 13 }}
            >
              <option value="">Selecione…</option>
              {saldos.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
            </select>
          </div>

          {/* Gráfico de evolução */}
          {eloJogador ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '1.25rem', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 800, color: 'var(--cream)', fontSize: 15 }}>
                  ⚡ Evolução Elo — {eloJogador}
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>linha amarela = 1500 (base)</span>
              </div>
              <EloLineChart historico={historico} jogadorNome={eloJogador} color="#FF6B2C" />
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '3rem', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--line)' }}>
              Selecione um jogador para ver a evolução do Elo.
            </div>
          )}

          {/* Tabela de rating geral — todos os sócios com elo */}
          <div style={{ fontWeight: 700, color: 'var(--cream)', fontSize: 14, marginBottom: 10 }}>
            Ranking Geral de Rating
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>#</th>
                <th style={S.th}>Jogador</th>
                <th style={S.th}>Rating Elo</th>
                <th style={S.th}>Tendência (últimas 10)</th>
                <th style={S.th}></th>
              </tr></thead>
              <tbody>
                {saldos.length === 0 && (
                  <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
                    Nenhum sócio cadastrado.
                  </td></tr>
                )}
                {saldos.map((s, i) => {
                  // Pega o último Elo registrado no histórico
                  const eloEntries = historico
                    .filter(h => h.socioNome === s.nome && h.elo != null)
                    .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))
                  const eloAtual = eloEntries[0]?.elo ?? s.elo ?? null
                  return (
                    <tr key={s.id} style={{ background: eloJogador === s.nome ? 'rgba(255,107,44,.06)' : undefined }}>
                      <td style={{ ...S.td, color: i < 3 ? 'var(--gold)' : 'var(--muted)', fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ ...S.td, fontWeight: 700, color: eloJogador === s.nome ? 'var(--green)' : 'var(--cream)' }}>
                        {eloJogador === s.nome && '▸ '}{s.nome}
                      </td>
                      <td style={S.td}>
                        {eloAtual != null
                          ? <span style={{ fontWeight: 800, fontSize: 15, color: eloAtual >= 1500 ? 'var(--green)' : '#FF6B2C' }}>{eloAtual}</span>
                          : <span style={{ color: 'var(--muted)' }}>—</span>
                        }
                      </td>
                      <td style={S.td}><Sparkline historico={historico} socioNome={s.nome} /></td>
                      <td style={S.td}>
                        <button
                          onClick={() => setEloJogador(s.nome)}
                          style={{ ...S.btn, padding: '3px 8px', background: eloJogador === s.nome ? '#FFF9F5' : 'var(--surface)', border: '1px solid var(--line)', color: 'var(--cream)', fontSize: 11 }}
                        >Ver gráfico</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
            Elo Rating calculado automaticamente pelo sistema com base em resultados das partidas.
            Rating inicial: 1500. K-factor: 32.
          </p>
        </div>
      )}

      {/* Modal creditar */}
      {modalCreditar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={creditar} style={{ background: 'var(--surface)', borderRadius: 12, padding: 28, width: 380, maxWidth: '95vw' }}>
            <h3 style={{ marginBottom: 18, color: 'var(--cream)' }}>⭐ Creditar Pontos</h3>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={S.lbl}>Sócio *</span>
              <select required value={form.socioId} onChange={e => setForm(f => ({ ...f, socioId: e.target.value }))} style={S.inp}>
                <option value="">Selecione…</option>
                {socios.length === 0 && <option value="" disabled>Nenhum sócio cadastrado</option>}
                {socios.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
              {socios.length === 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                  Cadastre um sócio em <a href="/admin/socios" style={{ color: 'var(--green)', fontWeight: 700 }}>Sócios</a> antes de creditar pontos.
                </div>
              )}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <label>
                <span style={S.lbl}>Pontos *</span>
                <input required type="number" min="1" value={form.pontos} onChange={e => setForm(f => ({ ...f, pontos: e.target.value }))} style={S.inp} />
              </label>
              <label>
                <span style={S.lbl}>Tipo</span>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} style={S.inp}>
                  <option value="manual">Manual</option>
                  <option value="reserva">Reserva</option>
                  <option value="compra">Compra</option>
                  <option value="inscricao">Inscrição</option>
                  <option value="bonus">Bônus</option>
                </select>
              </label>
            </div>
            <label style={{ display: 'block', marginBottom: 18 }}>
              <span style={S.lbl}>Descrição *</span>
              <input required value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} style={S.inp} placeholder="Ex: Torneio de duplas misto" />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModalCreditar(false)} style={{ ...S.btn, background: 'none', border: '1px solid var(--line)', color: 'var(--muted)' }}>Cancelar</button>
              <button type="submit" style={{ ...S.btn, background: 'var(--green)', color: 'var(--deep)' }}>Creditar</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal resgatar */}
      {modalResgatar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={resgatar} style={{ background: 'var(--surface)', borderRadius: 12, padding: 28, width: 380, maxWidth: '95vw' }}>
            <h3 style={{ marginBottom: 6, color: 'var(--cream)' }}>🎁 Resgatar Pontos</h3>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>
              {formR.socioId ? `Saldo: ${saldos.find(s => s.id == formR.socioId)?.saldo || 0} pts` : 'Selecione um sócio para ver o saldo.'}
            </p>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={S.lbl}>Sócio *</span>
              <select required value={formR.socioId} onChange={e => setFormR(f => ({ ...f, socioId: e.target.value }))} style={S.inp}>
                <option value="">Selecione…</option>
                {saldos.filter(s => s.saldo > 0).map(s => <option key={s.id} value={s.id}>{s.nome} ({s.saldo} pts)</option>)}
              </select>
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={S.lbl}>Pontos a resgatar *</span>
              <input required type="number" min="1" value={formR.pontos} onChange={e => setFormR(f => ({ ...f, pontos: e.target.value }))} style={S.inp} />
            </label>
            <label style={{ display: 'block', marginBottom: 18 }}>
              <span style={S.lbl}>Benefício resgatado *</span>
              <input required value={formR.descricao} onChange={e => setFormR(f => ({ ...f, descricao: e.target.value }))} style={S.inp} placeholder="Ex: 1h de quadra grátis" />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModalResgatar(false)} style={{ ...S.btn, background: 'none', border: '1px solid var(--line)', color: 'var(--muted)' }}>Cancelar</button>
              <button type="submit" style={{ ...S.btn, background: 'var(--gold)', color: '#1a1a1a' }}>Resgatar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

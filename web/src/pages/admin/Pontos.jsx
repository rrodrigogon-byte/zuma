import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const fmtData = s => s ? new Date(s).toLocaleDateString('pt-BR') : '—'
const fmtR = v => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`

const TIPO_INFO = {
  manual:    { label: 'Manual',     bg: '#e0e7ff', color: '#3730a3' },
  reserva:   { label: 'Reserva',    bg: '#d1fae5', color: '#065f46' },
  compra:    { label: 'Compra',     bg: '#fef3c7', color: '#92400e' },
  inscricao: { label: 'Inscrição',  bg: '#ede9fe', color: '#5b21b6' },
  resgate:   { label: 'Resgate',    bg: '#fee2e2', color: '#991b1b' },
  bonus:     { label: 'Bônus',      bg: '#d1fae5', color: '#065f46' },
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
      setSaldos(s); setHistorico(h); setSocios(sc)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const totalPontos = saldos.reduce((s, x) => s + x.saldo, 0)
  const comPontos = saldos.filter(s => s.saldo > 0).length
  const top = saldos[0]

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
          <button onClick={() => setModalResgatar(true)} style={{ ...S.btn, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--cream)' }}>🎁 Resgatar</button>
          <button onClick={() => setModalCreditar(true)} style={{ ...S.btn, background: 'var(--green)', color: 'var(--deep)' }}>+ Creditar Pontos</button>
        </div>
      </div>

      <div style={S.cards}>
        <div style={S.card}>
          <div style={S.cNum}>{totalPontos.toLocaleString('pt-BR')}</div>
          <div style={S.cLbl}>Total de pontos ativos</div>
        </div>
        <div style={S.card}>
          <div style={S.cNum}>{comPontos}</div>
          <div style={S.cLbl}>Sócios com pontos</div>
        </div>
        <div style={S.card}>
          <div style={S.cNum}>{historico.filter(h => h.pontos > 0).length}</div>
          <div style={S.cLbl}>Créditos realizados</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--cream)', marginBottom: 2 }}>{top?.nome?.split(' ')[0] || '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>{top?.saldo || 0} pts</div>
          <div style={S.cLbl}>Líder do ranking</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--line)' }}>
        {['ranking', 'histórico'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
            background: 'none', color: tab === t ? 'var(--green)' : 'var(--muted)',
            borderBottom: tab === t ? '2px solid var(--green)' : '2px solid transparent', textTransform: 'capitalize',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'ranking' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>#</th>
              <th style={S.th}>Sócio</th>
              <th style={S.th}>E-mail</th>
              <th style={S.th}>Pontos</th>
              <th style={S.th}>Ações</th>
            </tr></thead>
            <tbody>
              {saldos.length === 0 && <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Nenhum ponto registrado ainda.</td></tr>}
              {saldos.map((s, i) => (
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
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setForm(f => ({ ...f, socioId: s.id })); setModalCreditar(true) }}
                        style={{ ...S.btn, padding: '4px 9px', background: '#d1fae5', color: '#065f46', fontSize: 11 }}>+ Creditar</button>
                      {s.saldo > 0 && (
                        <button onClick={() => { setFormR(f => ({ ...f, socioId: s.id })); setModalResgatar(true) }}
                          style={{ ...S.btn, padding: '4px 9px', background: '#fef3c7', color: '#92400e', fontSize: 11 }}>Resgatar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      {/* Modal creditar */}
      {modalCreditar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={creditar} style={{ background: 'var(--surface)', borderRadius: 12, padding: 28, width: 380, maxWidth: '95vw' }}>
            <h3 style={{ marginBottom: 18, color: 'var(--cream)' }}>⭐ Creditar Pontos</h3>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={S.lbl}>Sócio *</span>
              <select required value={form.socioId} onChange={e => setForm(f => ({ ...f, socioId: e.target.value }))} style={S.inp}>
                <option value="">Selecione…</option>
                {socios.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
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

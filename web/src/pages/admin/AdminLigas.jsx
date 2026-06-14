import { useState, useEffect, useCallback } from 'react'
import { api, fmtDateOnly } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

/* ── Paleta ─────────────────────────────────────────────────────────────── */
const STATUS_BADGE = {
  inscricoes:   { label: 'Inscrições', color: '#27ae60', bg: 'rgba(39,174,96,.12)' },
  em_andamento: { label: 'Em Andamento', color: '#2980b9', bg: 'rgba(41,128,185,.12)' },
  encerrada:    { label: 'Encerrada', color: '#7f8c8d', bg: 'rgba(127,140,141,.12)' },
}

const EMPTY_LIGA = {
  nome: '', temporada: new Date().getFullYear().toString(),
  categoria: '', formato: 'simples', descricao: '',
  config: { pontosVitoria: 3, pontosDerrota: 1, pontosWO: 0, pontosBye: 2, maxRodadas: 7 },
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function Sb({ status }) {
  const b = STATUS_BADGE[status] || STATUS_BADGE.inscricoes
  return (
    <span style={{ background: b.bg, color: b.color, borderRadius: 20,
      padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{b.label}</span>
  )
}

function Spinner() {
  return <span style={{ display:'inline-block', width:14, height:14,
    border:'2px solid rgba(95,179,53,.3)', borderTopColor:'#5FB335',
    borderRadius:'50%', animation:'spin .7s linear infinite' }} />
}

/* ── Modal de criação / edição ─────────────────────────────────────────── */
function ModalLiga({ liga, onClose, onSave }) {
  const [form, setForm] = useState(liga || EMPTY_LIGA)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const setConf = (k, v) => setForm(p => ({ ...p, config: { ...p.config, [k]: Number(v) } }))
  const isEdit = !!liga?.id

  const submit = async () => {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      const res = isEdit
        ? await api.patch(`/api/admin/ligas/${liga.id}`, form)
        : await api.post('/api/admin/ligas', form)
      onSave(res)
    } catch (e) {
      alert(e.message)
    } finally { setSaving(false) }
  }

  const inp = { borderRadius: 8, border: '1px solid var(--line)', padding: '9px 12px',
    fontSize: 13, width: '100%', background: 'var(--surface)', color: 'var(--cream)',
    boxSizing: 'border-box', fontFamily: 'inherit' }
  const label = { fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 4 }
  const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

  return (
    <Modal onClose={onClose} title={isEdit ? `✏️ Editar: ${liga.nome}` : '🏆 Nova Liga'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={label}>Nome da Liga *</label>
          <input style={inp} value={form.nome} onChange={e => set('nome', e.target.value)}
            placeholder="Ex: Liga Masculina Simples 2026" />
        </div>
        <div style={row2}>
          <div>
            <label style={label}>Temporada</label>
            <input style={inp} value={form.temporada} onChange={e => set('temporada', e.target.value)} />
          </div>
          <div>
            <label style={label}>Categoria</label>
            <input style={inp} value={form.categoria} onChange={e => set('categoria', e.target.value)}
              placeholder="Ex: Masc · 1ª Classe" />
          </div>
        </div>
        <div>
          <label style={label}>Descrição</label>
          <input style={inp} value={form.descricao} onChange={e => set('descricao', e.target.value)}
            placeholder="Descrição breve da liga (opcional)" />
        </div>

        <div style={{ padding: '12px 14px', background: 'rgba(95,179,53,.06)',
          border: '1px solid rgba(95,179,53,.15)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)',
            textTransform: 'uppercase', marginBottom: 10 }}>⚙️ Pontuação</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[
              ['pontosVitoria', '🏆 Vitória'],
              ['pontosDerrota', '😓 Derrota'],
              ['pontosBye', '🎟 BYE'],
              ['pontosWO', '❌ W.O.'],
              ['maxRodadas', '📅 Máx. Rodadas'],
            ].map(([k, lbl]) => (
              <div key={k}>
                <label style={label}>{lbl}</label>
                <input style={{ ...inp, textAlign: 'center' }} type="number" min={0} max={99}
                  value={form.config?.[k] ?? 0}
                  onChange={e => setConf(k, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8,
            border: '1px solid var(--line)', background: 'transparent',
            color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}>
            Cancelar
          </button>
          <button onClick={submit} disabled={saving || !form.nome.trim()}
            style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none',
              background: saving ? '#555' : 'var(--green)', color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14 }}>
            {saving ? <Spinner /> : isEdit ? '💾 Salvar' : '🏆 Criar Liga'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ── Modal de resultado de jogo ────────────────────────────────────────── */
function ModalResultado({ ligaId, rodadaIdx, jogo, onClose, onSave }) {
  const [vencedor, setVencedor] = useState(jogo.vencedor || '')
  const [placar, setPlacar] = useState(jogo.placar || '')
  const [tipo, setTipo] = useState(jogo.tipo === 'wo' ? 'wo' : 'normal')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!vencedor) return
    setSaving(true)
    try {
      await api.post(`/api/admin/ligas/${ligaId}/resultado`, {
        rodadaIdx, jogoId: jogo.id, vencedor, placar, tipo,
      })
      onSave()
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  const btnBase = { flex: 1, padding: '10px 8px', borderRadius: 9, cursor: 'pointer',
    fontWeight: 700, fontSize: 13, border: '2px solid transparent', transition: 'all .15s' }

  return (
    <Modal onClose={onClose} title="🎾 Registrar Resultado">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ textAlign: 'center', padding: '10px 16px',
          background: 'rgba(95,179,53,.07)', borderRadius: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--cream)' }}>
            {jogo.a} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>vs</span> {jogo.b}
          </span>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)',
            textTransform: 'uppercase', marginBottom: 8 }}>Tipo</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['normal','🎾 Normal'],['wo','🚫 W.O.']].map(([v,l]) => (
              <button key={v} onClick={() => setTipo(v)}
                style={{ ...btnBase, background: tipo===v ? 'rgba(95,179,53,.15)' : 'transparent',
                  borderColor: tipo===v ? 'var(--green)' : 'var(--line)',
                  color: tipo===v ? 'var(--green)' : 'var(--muted)' }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)',
            textTransform: 'uppercase', marginBottom: 8 }}>Vencedor *</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[jogo.a, jogo.b].map(nome => (
              <button key={nome} onClick={() => setVencedor(nome)}
                style={{ ...btnBase, background: vencedor===nome ? 'rgba(95,179,53,.2)' : 'transparent',
                  borderColor: vencedor===nome ? 'var(--green)' : 'var(--line)',
                  color: vencedor===nome ? 'var(--green)' : 'var(--cream)' }}>
                {nome}
              </button>
            ))}
          </div>
        </div>

        {tipo === 'normal' && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)',
              textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
              Placar
            </label>
            <input
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8,
                border: '1px solid var(--line)', background: 'var(--surface)',
                color: 'var(--cream)', fontSize: 13, boxSizing: 'border-box' }}
              value={placar} onChange={e => setPlacar(e.target.value)}
              placeholder="Ex: 6-3, 7-5" />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8,
            border: '1px solid var(--line)', background: 'transparent',
            color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}>
            Cancelar
          </button>
          <button onClick={submit} disabled={!vencedor || saving}
            style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none',
              background: !vencedor ? '#444' : 'var(--green)', color: '#fff',
              cursor: !vencedor ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
            {saving ? <Spinner /> : '✅ Confirmar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ── Painel de detalhe da liga ──────────────────────────────────────────── */
function DetalheAdmin({ ligaId, onBack, showToast }) {
  const [liga, setLiga] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sortando, setSortando] = useState(false)
  const [proximaRd, setProximaRd] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [jogoModal, setJogoModal] = useState(null) // { rodadaIdx, jogo }
  const [abaDetalhe, setAbaDetalhe] = useState('tabela')

  const carregar = useCallback(async () => {
    try {
      const d = await api.get(`/api/admin/ligas/${ligaId}`)
      setLiga(d)
    } catch { showToast('Erro ao carregar liga', 'error') }
    finally { setLoading(false) }
  }, [ligaId])

  useEffect(() => { carregar() }, [carregar])

  const sortear = async () => {
    if (!confirm('Sortear rodadas? Os inscritos serão distribuídos automaticamente.')) return
    setSortando(true)
    try {
      await api.post(`/api/admin/ligas/${ligaId}/sortear`)
      showToast('Rodadas sorteadas!', 'success')
      carregar()
    } catch (e) { showToast(e.message, 'error') }
    finally { setSortando(false) }
  }

  const avancarRodada = async () => {
    setProximaRd(true)
    try {
      await api.post(`/api/admin/ligas/${ligaId}/proxima-rodada`)
      showToast('Próxima rodada iniciada!', 'success')
      carregar()
    } catch (e) { showToast(e.message, 'error') }
    finally { setProximaRd(false) }
  }

  const finalizar = async () => {
    if (!confirm('Finalizar liga? Esta ação não pode ser desfeita.')) return
    setFinalizando(true)
    try {
      await api.post(`/api/admin/ligas/${ligaId}/finalizar`)
      showToast('Liga finalizada!', 'success')
      carregar()
    } catch (e) { showToast(e.message, 'error') }
    finally { setFinalizando(false) }
  }

  const mudarStatus = async (status) => {
    try {
      await api.post(`/api/admin/ligas/${ligaId}/status`, { status })
      showToast('Status atualizado!', 'success')
      carregar()
    } catch (e) { showToast(e.message, 'error') }
  }

  const removerInscrito = async (inscId) => {
    if (!confirm('Remover inscrito?')) return
    try {
      await api.delete(`/api/admin/ligas/${ligaId}/participantes/${inscId}`)
      showToast('Inscrito removido.', 'success')
      carregar()
    } catch (e) { showToast(e.message, 'error') }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Carregando…</div>
  if (!liga) return <div style={{ textAlign: 'center', padding: 60 }}>Liga não encontrada.</div>

  const inscritos = liga.inscricoes || []
  const rodadas = liga.rodadas || []
  const tabela = liga.tabela || []
  const podeSort = liga.status === 'inscricoes' && inscritos.length >= 2 && rodadas.length === 0
  const podeAvancar = liga.status === 'em_andamento'
  const podeFinalizar = liga.status === 'em_andamento'

  const ABAS = [
    { id: 'tabela', label: `🏆 Tabela (${tabela.length})` },
    { id: 'rodadas', label: `📅 Rodadas (${rodadas.length})` },
    { id: 'inscritos', label: `👥 Inscritos (${inscritos.length})` },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ padding: '7px 14px', borderRadius: 8,
          border: '1px solid var(--line)', background: 'transparent',
          color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 18, color: 'var(--cream)' }}>{liga.nome}</h2>
            <Sb status={liga.status} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
            {liga.categoria} · Temporada {liga.temporada}
            {liga.descricao ? ` · ${liga.descricao}` : ''}
          </div>
        </div>
      </div>

      {/* Ações rápidas */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {liga.status === 'inscricoes' && (
          <button onClick={() => mudarStatus('em_andamento')}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none',
              background: '#2980b9', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            ▶ Iniciar Liga
          </button>
        )}
        {podeSort && (
          <button onClick={sortear} disabled={sortando}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none',
              background: 'var(--green)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            {sortando ? <Spinner /> : '🎲 Sortear Rodadas'}
          </button>
        )}
        {podeAvancar && (
          <button onClick={avancarRodada} disabled={proximaRd}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none',
              background: '#C9A656', color: '#0e2216', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            {proximaRd ? <Spinner /> : '⏭ Próxima Rodada'}
          </button>
        )}
        {podeFinalizar && (
          <button onClick={finalizar} disabled={finalizando}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none',
              background: '#e05c5c', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            {finalizando ? <Spinner /> : '🏁 Finalizar Liga'}
          </button>
        )}
        {liga.status === 'em_andamento' && (
          <button onClick={() => mudarStatus('inscricoes')}
            style={{ padding: '8px 16px', borderRadius: 8,
              border: '1px solid var(--line)', background: 'transparent',
              color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }}>
            ↩ Reabrir Inscrições
          </button>
        )}
      </div>

      {/* KPIs rápidos */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: 'Inscritos', val: inscritos.length, icon: '👥' },
          { label: 'Rodadas', val: rodadas.length, icon: '📅' },
          { label: 'Rodada Atual', val: liga.rodadaAtual || '—', icon: '🔴' },
          { label: 'Pts Vitória', val: liga.config?.pontosVitoria ?? 3, icon: '🏆' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--card)', border: '1px solid var(--line)',
            borderRadius: 10, padding: '12px 18px', minWidth: 100 }}>
            <div style={{ fontSize: 20 }}>{k.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--green)' }}>{k.val}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16,
        background: 'var(--card)', borderRadius: 10, padding: 4 }}>
        {ABAS.map(a => (
          <button key={a.id} onClick={() => setAbaDetalhe(a.id)}
            style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontWeight: abaDetalhe === a.id ? 800 : 500, fontSize: 12,
              background: abaDetalhe === a.id ? 'var(--green)' : 'transparent',
              color: abaDetalhe === a.id ? '#fff' : 'var(--muted)', transition: 'all .15s' }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* Tabela de Classificação */}
      {abaDetalhe === 'tabela' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
          {!tabela.length ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <p>Nenhum resultado registrado ainda.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(95,179,53,.1)' }}>
                    {['#', 'Atleta', 'Pts', 'J', 'V', 'D', 'BYE', 'W.O.'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Atleta' ? 'left' : 'center',
                        color: 'var(--muted)', fontWeight: 700, fontSize: 11,
                        textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabela.map((p, i) => (
                    <tr key={p.nome} style={{ borderTop: '1px solid var(--line)',
                      background: i < 3 ? 'rgba(201,166,86,.04)' : 'transparent' }}>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800,
                        color: ['#C9A656','#9e9e9e','#cd7f32'][i] || 'var(--muted)' }}>
                        {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--cream)' }}>{p.nome}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: 'var(--green)', fontSize: 15 }}>{p.pts}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--muted)' }}>{p.jogos}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#5FB335', fontWeight: 700 }}>{p.v}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#e05c5c' }}>{p.d}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--muted)' }}>{p.bye || 0}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--muted)' }}>{p.wo || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rodadas */}
      {abaDetalhe === 'rodadas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!rodadas.length ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)',
              background: 'var(--card)', borderRadius: 12, border: '1px solid var(--line)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
              <p>Rodadas ainda não geradas.</p>
              {podeSort && <p style={{ fontSize: 12 }}>Use "Sortear Rodadas" acima com {inscritos.length} inscritos.</p>}
            </div>
          ) : rodadas.map((rd, ri) => {
            const jogosReais = rd.jogos.filter(j => j.tipo !== 'bye')
            const concluidos = jogosReais.filter(j => j.vencedor).length
            const isAtual = liga.rodadaAtual === rd.numero
            return (
              <div key={ri} style={{ background: 'var(--card)',
                border: `1px solid ${isAtual ? 'var(--green)' : 'var(--line)'}`,
                borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between',
                  background: isAtual ? 'rgba(95,179,53,.08)' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%',
                      background: isAtual ? 'var(--green)' : 'var(--card2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isAtual ? '#fff' : 'var(--muted)', fontWeight: 800 }}>{rd.numero}</div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--cream)', fontSize: 14 }}>
                        Rodada {rd.numero} {isAtual && <span style={{ fontSize: 11, color: 'var(--green)' }}>● Atual</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {concluidos}/{jogosReais.length} concluídos
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '8px 16px 16px' }}>
                  {rd.jogos.map((j) => {
                    const isBye = j.tipo === 'bye'
                    const done = !!j.vencedor
                    return (
                      <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 12px', marginTop: 6,
                        background: done ? 'rgba(95,179,53,.06)' : isBye ? 'rgba(255,255,255,.03)' : 'var(--surface)',
                        border: `1px solid ${done ? 'rgba(95,179,53,.2)' : 'var(--line)'}`,
                        borderRadius: 9 }}>
                        {isBye ? (
                          <>
                            <span style={{ flex: 1, color: 'var(--cream)', fontWeight: 600 }}>{j.a}</span>
                            <span style={{ background: 'rgba(255,255,255,.08)', color: 'var(--muted)',
                              padding: '2px 10px', borderRadius: 6, fontSize: 11 }}>BYE 🎟</span>
                          </>
                        ) : (
                          <>
                            <span style={{ flex: 1, fontWeight: done && j.vencedor === j.a ? 800 : 500,
                              color: done && j.vencedor === j.a ? 'var(--green)' : 'var(--cream)',
                              textDecoration: done && j.vencedor !== j.a ? 'line-through' : '' }}>{j.a}</span>
                            <div style={{ textAlign: 'center', minWidth: 60 }}>
                              {done ? (
                                <span style={{ background: 'var(--green)', color: '#fff',
                                  padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                                  {j.placar || '✓'}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--muted)', fontSize: 12 }}>vs</span>
                              )}
                            </div>
                            <span style={{ flex: 1, textAlign: 'right', fontWeight: done && j.vencedor === j.b ? 800 : 500,
                              color: done && j.vencedor === j.b ? 'var(--green)' : 'var(--cream)',
                              textDecoration: done && j.vencedor !== j.b ? 'line-through' : '' }}>{j.b}</span>
                            {!done && liga.status === 'em_andamento' && (
                              <button onClick={() => setJogoModal({ rodadaIdx: ri, jogo: j })}
                                style={{ padding: '4px 12px', borderRadius: 7, border: 'none',
                                  background: 'var(--green)', color: '#fff', cursor: 'pointer',
                                  fontSize: 11, fontWeight: 700, marginLeft: 8, flexShrink: 0 }}>
                                ✍️ Resultado
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Inscritos */}
      {abaDetalhe === 'inscritos' && (
        <div>
          {!inscritos.length ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)',
              background: 'var(--card)', borderRadius: 12, border: '1px solid var(--line)' }}>
              <div style={{ fontSize: 32 }}>👥</div>
              <p>Nenhum inscrito ainda.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
              {inscritos.map(insc => (
                <div key={insc.id} style={{ background: 'var(--card)', border: '1px solid var(--line)',
                  borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--green)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                    {insc.nome.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--cream)', fontSize: 13,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{insc.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{insc.email}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                      📅 {fmtDateOnly(insc.inscritoEm)}
                    </div>
                  </div>
                  {liga.status === 'inscricoes' && (
                    <button onClick={() => removerInscrito(insc.id)}
                      style={{ padding: '4px 8px', borderRadius: 6, border: 'none',
                        background: 'rgba(224,92,92,.15)', color: '#e05c5c',
                        cursor: 'pointer', fontSize: 11, flexShrink: 0 }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal resultado */}
      {jogoModal && (
        <ModalResultado
          ligaId={ligaId}
          rodadaIdx={jogoModal.rodadaIdx}
          jogo={jogoModal.jogo}
          onClose={() => setJogoModal(null)}
          onSave={() => { setJogoModal(null); carregar() }}
        />
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════════════════════════ */
export default function AdminLigas() {
  const { showToast, ToastContainer } = useToast()
  const [ligas, setLigas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalCreate, setModalCreate] = useState(false)
  const [modalEdit, setModalEdit] = useState(null)
  const [detalheId, setDetalheId] = useState(null)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  const carregar = useCallback(async () => {
    try {
      const data = await api.get('/api/ligas')
      setLigas(data)
    } catch { showToast('Erro ao carregar ligas', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const deletar = async (id, nome) => {
    if (!confirm(`Deletar liga "${nome}"? Todos os dados serão perdidos.`)) return
    try {
      await api.delete(`/api/admin/ligas/${id}`)
      showToast('Liga deletada.', 'success')
      carregar()
    } catch (e) { showToast(e.message, 'error') }
  }

  const onSave = (nova) => {
    setModalCreate(false)
    setModalEdit(null)
    showToast(nova.nome ? `Liga "${nova.nome}" salva!` : 'Liga salva!', 'success')
    carregar()
  }

  const ligasFiltradas = ligas.filter(l => {
    const ok = filtroStatus === 'todos' || l.status === filtroStatus
    const q = busca.toLowerCase()
    return ok && (!q || l.nome.toLowerCase().includes(q) || l.categoria?.toLowerCase().includes(q))
  })

  // Detalhe
  if (detalheId) {
    return (
      <div style={{ padding: '20px 24px' }}>
        <ToastContainer />
        <DetalheAdmin
          ligaId={detalheId}
          onBack={() => { setDetalheId(null); carregar() }}
          showToast={showToast}
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <ToastContainer />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: 'var(--cream)' }}>🏆 Ligas de Ranking</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Gerencie ligas, rodadas e resultados
          </p>
        </div>
        <button onClick={() => setModalCreate(true)}
          style={{ padding: '10px 20px', borderRadius: 10, border: 'none',
            background: 'var(--green)', color: '#fff', cursor: 'pointer',
            fontWeight: 800, fontSize: 14 }}>
          + Nova Liga
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="🔍 Buscar liga…"
          style={{ padding: '9px 14px', borderRadius: 9, border: '1px solid var(--line)',
            background: 'var(--surface)', color: 'var(--cream)', fontSize: 13, flex: 1, minWidth: 200 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {[['todos','Todas'],['inscricoes','Inscrições'],['em_andamento','Em Andamento'],['encerrada','Encerradas']].map(([v,l]) => (
            <button key={v} onClick={() => setFiltroStatus(v)}
              style={{ padding: '8px 14px', borderRadius: 8,
                border: `1px solid ${filtroStatus===v ? 'var(--green)' : 'var(--line)'}`,
                background: filtroStatus===v ? 'rgba(95,179,53,.15)' : 'transparent',
                color: filtroStatus===v ? 'var(--green)' : 'var(--muted)',
                cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', val: ligas.length, icon: '🏆', color: 'var(--green)' },
          { label: 'Em Andamento', val: ligas.filter(l=>l.status==='em_andamento').length, icon: '🔴', color: '#2980b9' },
          { label: 'Inscrições Abertas', val: ligas.filter(l=>l.status==='inscricoes').length, icon: '✍️', color: '#27ae60' },
          { label: 'Encerradas', val: ligas.filter(l=>l.status==='encerrada').length, icon: '🏁', color: '#7f8c8d' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--card)', border: '1px solid var(--line)',
            borderLeft: `3px solid ${k.color}`, borderRadius: 10, padding: '12px 18px', flex: 1, minWidth: 110 }}>
            <div style={{ fontSize: 18 }}>{k.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Carregando…</div>
      ) : !ligasFiltradas.length ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)',
          background: 'var(--card)', borderRadius: 14, border: '1px solid var(--line)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
          <h3 style={{ margin: 0, color: 'var(--cream)' }}>
            {ligas.length === 0 ? 'Nenhuma liga criada ainda' : 'Nenhuma liga encontrada'}
          </h3>
          <p style={{ marginTop: 8 }}>
            {ligas.length === 0 ? 'Clique em "+ Nova Liga" para começar.' : 'Tente outros filtros.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ligasFiltradas.map(l => (
            <div key={l.id} style={{ background: 'var(--card)', border: '1px solid var(--line)',
              borderRadius: 12, padding: '16px 20px', display: 'flex',
              alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(95,179,53,.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0 }}>🏆</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, color: 'var(--cream)', fontSize: 15 }}>{l.nome}</span>
                  <Sb status={l.status} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                  {l.categoria} · Temporada {l.temporada}
                  {l.descricao ? ` · ${l.descricao}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 5, fontSize: 12, color: 'var(--muted)' }}>
                  <span>👥 {l.inscricoes} inscritos</span>
                  <span>📅 {l.totalRodadas} rodada{l.totalRodadas !== 1 ? 's' : ''}</span>
                  {l.status === 'em_andamento' && (
                    <span style={{ color: '#2980b9' }}>🔴 Rodada {l.rodadaAtual}</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => setDetalheId(l.id)}
                  style={{ padding: '7px 16px', borderRadius: 8, border: 'none',
                    background: 'var(--green)', color: '#fff', cursor: 'pointer',
                    fontWeight: 700, fontSize: 12 }}>
                  ⚙️ Gerenciar
                </button>
                <button onClick={() => setModalEdit(l)}
                  style={{ padding: '7px 12px', borderRadius: 8,
                    border: '1px solid var(--line)', background: 'transparent',
                    color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                <button onClick={() => deletar(l.id, l.nome)}
                  style={{ padding: '7px 12px', borderRadius: 8,
                    border: '1px solid rgba(224,92,92,.3)', background: 'rgba(224,92,92,.08)',
                    color: '#e05c5c', cursor: 'pointer', fontSize: 12 }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalCreate && <ModalLiga onClose={() => setModalCreate(false)} onSave={onSave} />}
      {modalEdit && <ModalLiga liga={modalEdit} onClose={() => setModalEdit(null)} onSave={onSave} />}
    </div>
  )
}

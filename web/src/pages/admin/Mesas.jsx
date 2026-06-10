import { useState, useEffect } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const STATUS_COLOR = {
  livre:    { bg: 'rgba(95,179,53,.15)',  text: 'var(--green)',  label: 'Livre' },
  ocupada:  { bg: 'rgba(201,166,86,.15)', text: 'var(--gold)',   label: 'Ocupada' },
  fechando: { bg: 'rgba(52,152,219,.15)', text: '#3498db',       label: 'Fechando' },
}

export default function Mesas() {
  const toast = useToast()
  const [fisicas, setFisicas]     = useState([])
  const [virtuais, setVirtuais]   = useState([])
  const [config, setConfig]       = useState({ mesasFisicas: 0 })
  const [loading, setLoading]     = useState(true)
  const [cfgEdit, setCfgEdit]     = useState('')
  const [savingCfg, setSavingCfg] = useState(false)
  const [comanda, setComanda]     = useState(null)     // { mesa, data }
  const [fechando, setFechando]   = useState(null)     // num da mesa

  async function load() {
    setLoading(true)
    try {
      const [mesas, cfg] = await Promise.all([
        api.get('/api/mesas'),
        api.get('/api/admin/mesas/config'),
      ])
      setFisicas(mesas.fisicas || [])
      setVirtuais(mesas.virtuais || [])
      setConfig(cfg)
      setCfgEdit(String(cfg.mesasFisicas ?? ''))
    } catch {
      toast('Erro ao carregar mesas', true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function salvarConfig() {
    const n = parseInt(cfgEdit)
    if (isNaN(n) || n < 1) return toast('Número inválido', true)
    setSavingCfg(true)
    try {
      await api.post('/api/admin/mesas/config', { mesasFisicas: n })
      toast('Configuração salva')
      load()
    } catch {
      toast('Erro ao salvar configuração', true)
    } finally {
      setSavingCfg(false)
    }
  }

  async function abrirComanda(mesa) {
    if (!mesa.comandaId) return
    try {
      const data = await api.get(`/api/comanda/${mesa.comandaId}`)
      setComanda({ mesa, data })
    } catch {
      toast('Erro ao carregar comanda', true)
    }
  }

  async function fecharForcado(num) {
    if (!confirm(`Fechar forçado a Mesa ${num}? Isso encerrará a comanda ativa.`)) return
    try {
      await api.post(`/api/admin/mesas/${num}/fechar`)
      toast(`Mesa ${num} fechada`)
      setComanda(null)
      setFechando(null)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao fechar mesa', true)
    }
  }

  const ocupadas    = fisicas.filter(m => m.status !== 'livre').length
  const livres      = fisicas.filter(m => m.status === 'livre').length
  const totalReceber = fisicas.reduce((s, m) => s + (m.total || 0), 0)

  if (loading) return <div className="page"><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Mesas</h1>
        <button className="btn btn-secondary btn-sm" onClick={load}>↺ Atualizar</button>
      </div>

      {/* KPIs */}
      <div className="grid4" style={{ marginBottom: 24 }}>
        <div className="kpi">
          <div className="kpi-label">Total Mesas</div>
          <div className="kpi-value">{fisicas.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Ocupadas</div>
          <div className="kpi-value" style={{ color: 'var(--gold)' }}>{ocupadas}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Livres</div>
          <div className="kpi-value" style={{ color: 'var(--green)' }}>{livres}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total a Receber</div>
          <div className="kpi-value" style={{ color: 'var(--lime)', fontSize: 22 }}>{fmtR(totalReceber)}</div>
        </div>
      </div>

      {/* Configuração */}
      <div className="card" style={{ marginBottom: 24 }}>
        <p className="section-title">Configuração</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: '0 0 220px' }}>
            <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
              Número de mesas físicas
            </label>
            <input
              type="number" min="1" value={cfgEdit}
              onChange={e => setCfgEdit(e.target.value)}
              style={{ maxWidth: 120 }}
            />
          </div>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginTop: 18 }}
            onClick={salvarConfig}
            disabled={savingCfg}
          >
            {savingCfg ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Grid de mesas físicas */}
      <p className="section-title">Mesas Físicas</p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 12,
        marginBottom: 32,
      }}>
        {fisicas.map(m => {
          const sc = STATUS_COLOR[m.status] || STATUS_COLOR.livre
          const clickable = m.status !== 'livre'
          return (
            <div
              key={m.num}
              onClick={() => clickable && abrirComanda(m)}
              style={{
                background: sc.bg,
                border: `2px solid ${sc.text}`,
                borderRadius: 12,
                padding: '16px 12px',
                textAlign: 'center',
                cursor: clickable ? 'pointer' : 'default',
                transition: 'transform .15s',
                userSelect: 'none',
              }}
              onMouseEnter={e => clickable && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
            >
              <div style={{ fontSize: 24, fontWeight: 900, color: sc.text }}>#{m.num}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: sc.text, textTransform: 'uppercase', marginTop: 4 }}>
                {sc.label}
              </div>
              {m.nome && (
                <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 4, fontWeight: 600 }}>{m.nome}</div>
              )}
              {m.total > 0 && (
                <div style={{ fontSize: 13, color: 'var(--cream)', marginTop: 6, fontWeight: 700 }}>{fmtR(m.total)}</div>
              )}
              {m.aguardandoCozinha > 0 && (
                <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 4 }}>
                  🍳 {m.aguardandoCozinha} item(s)
                </div>
              )}
            </div>
          )
        })}
        {fisicas.length === 0 && (
          <p style={{ color: 'var(--muted)', gridColumn: '1/-1' }}>Nenhuma mesa cadastrada.</p>
        )}
      </div>

      {/* Comandas virtuais */}
      {virtuais.length > 0 && (
        <>
          <p className="section-title">Comandas Virtuais Abertas</p>
          <div className="table-wrap" style={{ marginBottom: 24 }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome</th>
                  <th>Total</th>
                  <th>Cozinha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {virtuais.map(v => (
                  <tr key={v.comandaId}>
                    <td>#{v.comandaId}</td>
                    <td>{v.nome || '—'}</td>
                    <td>{fmtR(v.total)}</td>
                    <td>{v.aguardandoCozinha > 0
                      ? <span className="badge badge-gold">{v.aguardandoCozinha} item(s)</span>
                      : '—'}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirComanda(v)}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal: detalhes da comanda */}
      {comanda && (
        <Modal title={`Comanda — Mesa ${comanda.mesa.num ?? '#' + comanda.mesa.comandaId}`} onClose={() => setComanda(null)} width={580}>
          <div style={{ padding: '0 0 8px' }}>
            {comanda.data?.itens?.length > 0 ? (
              <div className="table-wrap" style={{ marginBottom: 16 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Qtd</th>
                      <th>Unit.</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comanda.data.itens.map((it, i) => (
                      <tr key={i}>
                        <td>{it.nome}</td>
                        <td>{it.qtd}</td>
                        <td>{fmtR(it.preco)}</td>
                        <td>{fmtR((it.preco || 0) * (it.qtd || 1))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--muted)', marginBottom: 16 }}>Nenhum item na comanda.</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>Total: </span>
                <strong style={{ color: 'var(--lime)', fontSize: 16 }}>{fmtR(comanda.data?.total || comanda.mesa.total)}</strong>
              </div>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => fecharForcado(comanda.mesa.num)}
              >
                Fechar Forçado
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

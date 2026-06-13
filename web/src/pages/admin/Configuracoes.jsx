import { useState, useEffect, useRef } from 'react'
import { api, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const PALETA = [
  { name: 'Deep',  var: '--deep',   hex: '#0E2E1C' },
  { name: 'Green', var: '--green',  hex: '#5FB335' },
  { name: 'Lime',  var: '--lime',   hex: '#8FD64A' },
  { name: 'Gold',  var: '--gold',   hex: '#C9A656' },
  { name: 'Cream', var: '--cream',  hex: '#F4F6EF' },
]

function SectionCard({ title, children, onSave, saving }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 12, padding: 24, marginBottom: 24,
    }}>
      <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 800, color: 'var(--cream)' }}>
        {title}
      </h3>
      {children}
      {onSave && (
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

/** Toggle estilo switch ON/OFF */
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: 52,
        height: 28,
        borderRadius: 999,
        background: checked ? 'var(--green)' : 'var(--line)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background .2s',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        left: checked ? 26 : 4,
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,.3)',
        transition: 'left .2s',
      }} />
    </button>
  )
}

export default function Configuracoes() {
  const { toast } = useToast()

  const [evento, setEvento]       = useState({ nome: '', slogan: '', dataInicio: '', dataFim: '', local: '', site: '' })
  const [bar, setBar]             = useState({ mesasFisicas: '', taxaServico: '' })
  const [pix, setPix]             = useState({ chave: '', nome: '', cidade: '' })
  const [loading, setLoading]     = useState(true)
  const [savingEv, setSavingEv]   = useState(false)
  const [savingBar, setSavingBar] = useState(false)
  const [savingPix, setSavingPix] = useState(false)

  // Pagamentos
  const [modoSimulado, setModoSimulado]   = useState(false)   // config.pagamentos.modoSimulado
  const [pagAtivos, setPagAtivos]         = useState(false)   // env-based (lido-only)
  const [savingPag, setSavingPag]         = useState(false)

  // reset modal
  const [resetStep, setResetStep]     = useState(0)
  const [resetInput, setResetInput]   = useState('')
  const [resetting, setResetting]     = useState(false)

  // Categorias & Vagas
  const [categoriasLista, setCategoriasLista] = useState([])   // { id, nome, preco, inscritos, vagas }
  const [vagasEdit, setVagasEdit]             = useState({})   // { [catId]: { vagas: '' } }
  const [savingCat, setSavingCat]             = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [data, status, cats] = await Promise.all([
        api.get('/api/admin/config'),
        api.get('/api/pagamentos/status').catch(() => ({ ativo: false })),
        api.get('/api/categorias').catch(() => []),
      ])
      if (data.evento) setEvento({ ...evento, ...data.evento })
      if (data.bar)    setBar({ mesasFisicas: data.bar.mesasFisicas ?? '', taxaServico: data.bar.taxaServico ?? '' })
      if (data.pix)    setPix({ chave: data.pix.chave ?? '', nome: data.pix.nome ?? '', cidade: data.pix.cidade ?? '' })
      setPagAtivos(!!status.ativo)
      setModoSimulado(!!(data.pagamentos?.modoSimulado))
      if (Array.isArray(cats) && cats.length) {
        setCategoriasLista(cats)
        // pré-preenche vagasEdit com o que vier da API
        const ve = {}
        cats.forEach(c => { ve[c.id] = { vagas: c.vagas != null ? String(c.vagas) : '' } })
        setVagasEdit(ve)
      }
    } catch {
      toast('Erro ao carregar configurações', true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function saveSection(patch, setSaving) {
    setSaving(true)
    try {
      await api.patch('/api/admin/config', patch)
      toast('Configurações salvas')
    } catch (e) {
      toast(e.message || 'Erro ao salvar', true)
    } finally {
      setSaving(false)
    }
  }

  async function savePagamentos() {
    await saveSection({ pagamentos: { modoSimulado } }, setSavingPag)
  }

  async function saveCategorias() {
    setSavingCat(true)
    try {
      // Monta objeto { [catId]: { vagas: Number|null } }
      const categorias = {}
      Object.entries(vagasEdit).forEach(([id, v]) => {
        const n = parseInt(v.vagas)
        categorias[id] = { vagas: isNaN(n) ? null : n }
      })
      await api.patch('/api/admin/config', { categorias })
      toast('Vagas salvas')
    } catch (e) {
      toast(e.message || 'Erro ao salvar vagas', true)
    } finally {
      setSavingCat(false)
    }
  }

  async function handleReset() {
    if (resetStep === 0) {
      if (!window.confirm('Tem certeza? Esta ação apagará TODOS os dados do banco. Não há volta!')) return
      setResetStep(2)
      return
    }
    if (resetInput !== 'CONFIRMAR') {
      toast('Digite CONFIRMAR exatamente', true)
      return
    }
    setResetting(true)
    try {
      await api.post('/api/admin/reset', {})
      toast('Banco resetado. Recarregue a página.')
      setResetStep(0)
      setResetInput('')
    } catch (e) {
      toast(e.message || 'Erro ao resetar', true)
    } finally {
      setResetting(false)
    }
  }

  function maskPix(v) {
    if (!v) return '—'
    if (v.includes('@')) return v.slice(0, 3) + '***' + v.slice(v.indexOf('@'))
    if (v.length >= 8) return v.slice(0, 4) + '****' + v.slice(-2)
    return '***'
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      <h2 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 900, color: 'var(--cream)' }}>
        ⚙️ Configurações
      </h2>

      {/* Evento */}
      <SectionCard
        title="Evento"
        onSave={() => saveSection({ evento }, setSavingEv)}
        saving={savingEv}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="Nome do Evento">
            <input className="input" value={evento.nome}
              onChange={e => setEvento(p => ({ ...p, nome: e.target.value }))} />
          </Field>
          <Field label="Slogan">
            <input className="input" value={evento.slogan}
              onChange={e => setEvento(p => ({ ...p, slogan: e.target.value }))} />
          </Field>
          <Field label="Data de Início">
            <input className="input" type="date" value={evento.dataInicio}
              onChange={e => setEvento(p => ({ ...p, dataInicio: e.target.value }))} />
          </Field>
          <Field label="Data de Fim">
            <input className="input" type="date" value={evento.dataFim}
              onChange={e => setEvento(p => ({ ...p, dataFim: e.target.value }))} />
          </Field>
          <Field label="Local">
            <input className="input" value={evento.local}
              onChange={e => setEvento(p => ({ ...p, local: e.target.value }))} />
          </Field>
          <Field label="Site">
            <input className="input" type="url" value={evento.site}
              onChange={e => setEvento(p => ({ ...p, site: e.target.value }))} />
          </Field>
        </div>
      </SectionCard>

      {/* Bar */}
      <SectionCard
        title="Bar & Restaurante"
        onSave={() => saveSection({ bar: { mesasFisicas: Number(bar.mesasFisicas) }, taxaServico: Number(bar.taxaServico) }, setSavingBar)}
        saving={savingBar}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="Mesas Físicas">
            <input className="input" type="number" min={0} value={bar.mesasFisicas}
              onChange={e => setBar(p => ({ ...p, mesasFisicas: e.target.value }))} />
          </Field>
          <Field label="Taxa de Serviço (%)">
            <input className="input" type="number" min={0} max={100} step={0.5} value={bar.taxaServico}
              onChange={e => setBar(p => ({ ...p, taxaServico: e.target.value }))} />
          </Field>
        </div>
      </SectionCard>

      {/* PIX */}
      <SectionCard
        title="PIX"
        onSave={() => saveSection({ pix }, setSavingPix)}
        saving={savingPix}
      >
        <div style={{
          background: 'rgba(201,166,86,.08)', border: '1px solid rgba(201,166,86,.25)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--gold)',
        }}>
          Chave atual (mascarada): <strong>{maskPix(pix.chave)}</strong>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
          <Field label="Chave PIX">
            <input className="input" value={pix.chave}
              onChange={e => setPix(p => ({ ...p, chave: e.target.value }))} />
          </Field>
          <Field label="Nome Beneficiário">
            <input className="input" value={pix.nome}
              onChange={e => setPix(p => ({ ...p, nome: e.target.value }))} />
          </Field>
          <Field label="Cidade">
            <input className="input" value={pix.cidade}
              onChange={e => setPix(p => ({ ...p, cidade: e.target.value }))} />
          </Field>
        </div>
      </SectionCard>

      {/* Pagamentos — Mercado Pago */}
      <SectionCard
        title="💳 Pagamentos & Mercado Pago"
        onSave={savePagamentos}
        saving={savingPag}
      >
        {/* Status atual (env-based, read-only) */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: pagAtivos ? 'rgba(95,179,53,.10)' : 'rgba(201,166,86,.08)',
          border: `1px solid ${pagAtivos ? 'rgba(95,179,53,.35)' : 'rgba(201,166,86,.30)'}`,
          borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13,
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            background: pagAtivos ? 'var(--green)' : 'var(--gold)',
          }} />
          <div>
            <strong style={{ color: pagAtivos ? 'var(--green)' : 'var(--gold)' }}>
              {pagAtivos ? 'Mercado Pago ativo' : 'Modo simulado (sem env vars de produção)'}
            </strong>
            <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: 12 }}>
              {pagAtivos
                ? 'Variáveis PIX_CHAVE / MP_TOKEN detectadas no servidor.'
                : 'Configure PIX_CHAVE ou MP_TOKEN nas variáveis de ambiente do servidor para ativar pagamentos reais.'}
            </p>
          </div>
        </div>

        {/* Toggle forçar simulação */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 16, padding: '14px 0', borderTop: '1px solid var(--line)',
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--cream)' }}>
              Forçar modo simulado
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              Quando ativado, todos os pagamentos entram em modo simulação — mesmo que as variáveis de produção estejam configuradas.
              Útil para testes sem movimentar dinheiro real.
            </p>
          </div>
          <Toggle
            checked={modoSimulado}
            onChange={setModoSimulado}
          />
        </div>

        {/* Toggle pagamentos por meio disponíveis */}
        <div style={{
          marginTop: 16, padding: '14px 0', borderTop: '1px solid var(--line)',
        }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
            Meios de pagamento aceitos no PDV
          </p>
          {['pix', 'cartao', 'dinheiro', 'carteira'].map(meio => (
            <div key={meio} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)',
            }}>
              <span style={{ fontSize: 13, color: 'var(--cream)', textTransform: 'capitalize', fontWeight: 600 }}>
                {meio === 'pix' ? '📱 PIX' : meio === 'cartao' ? '💳 Cartão' : meio === 'dinheiro' ? '💵 Dinheiro' : '👛 Carteira'}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                background: 'rgba(95,179,53,.15)', color: 'var(--green)',
              }}>
                ativo
              </span>
            </div>
          ))}
          <p style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)' }}>
            Para desativar meios de pagamento, edite <code>config.pagamentos.meios</code> via API.
          </p>
        </div>

        {/* Aviso quando modoSimulado ativo */}
        {modoSimulado && (
          <div style={{
            marginTop: 16,
            background: 'rgba(201,166,86,.10)', border: '1px solid rgba(201,166,86,.35)',
            borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--gold)',
          }}>
            ⚠️ <strong>Modo simulado ativo:</strong> ao salvar, todos os pagamentos PIX passarão a exigir confirmação manual — nenhum valor real será cobrado.
          </div>
        )}
      </SectionCard>

      {/* Aparência */}
      <SectionCard title="Aparência — Paleta de Cores">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {PALETA.map(c => (
            <div key={c.var} style={{ textAlign: 'center' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 10,
                background: c.hex,
                border: '2px solid var(--line)',
                margin: '0 auto 6px',
              }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cream)' }}>{c.name}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{c.hex}</div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
          Para alterar a paleta, edite as variáveis CSS em <code>index.css</code>.
        </p>
      </SectionCard>

      {/* Categorias & Vagas */}
      {categoriasLista.length > 0 && (
        <SectionCard title="🎾 Categorias — Vagas & Inscritos" onSave={saveCategorias} saving={savingCat}>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px' }}>
            Configure o número máximo de vagas por categoria. Deixe em branco para sem limite.
            O contador de inscritos reflete a situação atual do banco.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {categoriasLista.map(cat => {
              const ve = vagasEdit[cat.id] || { vagas: '' }
              const vagas = parseInt(ve.vagas)
              const ocupacao = !isNaN(vagas) && vagas > 0 ? Math.min(100, Math.round((cat.inscritos / vagas) * 100)) : null
              const lotado = !isNaN(vagas) && vagas > 0 && cat.inscritos >= vagas
              return (
                <div key={cat.id} style={{
                  background: 'var(--surface2)', border: `1px solid ${lotado ? '#e05c5c44' : 'var(--line)'}`,
                  borderLeft: `3px solid ${lotado ? '#e05c5c' : '#5FB335'}`,
                  borderRadius: 8, padding: '12px 14px',
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--fg)', fontSize: 12, marginBottom: 8, lineHeight: 1.3 }}>
                    {cat.nome}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Vagas:</label>
                    <input
                      type="number" min="0" placeholder="Sem limite"
                      value={ve.vagas}
                      onChange={e => setVagasEdit(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], vagas: e.target.value } }))}
                      style={{ width: 80, padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg)', fontSize: 13 }}
                    />
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                      background: lotado ? '#e05c5c18' : cat.inscritos > 0 ? '#5FB33518' : 'transparent',
                      color: lotado ? '#e05c5c' : cat.inscritos > 0 ? '#5FB335' : 'var(--muted)',
                    }}>
                      {cat.inscritos} inscrito{cat.inscritos !== 1 ? 's' : ''}
                      {!isNaN(vagas) && vagas > 0 ? ` / ${vagas}` : ''}
                    </span>
                  </div>
                  {ocupacao !== null && (
                    <div style={{ marginTop: 8, height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${ocupacao}%`, background: lotado ? '#e05c5c' : '#5FB335', borderRadius: 2, transition: 'width .3s' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}

      {/* Avançado */}
      <SectionCard title="Avançado">
        <div style={{
          background: 'rgba(231,76,60,.07)', border: '1px solid rgba(231,76,60,.3)',
          borderRadius: 10, padding: 18,
        }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#e74c3c', fontWeight: 700 }}>
            ⚠️ Zona de Perigo
          </p>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)' }}>
            Resetar o banco apaga todos os dados (inscrições, vendas, sócios, etc.).
            Esta operação é irreversível.
          </p>

          {resetStep === 0 && (
            <button
              className="btn btn-sm"
              style={{ background: '#e74c3c', color: '#fff', border: 'none' }}
              onClick={() => setResetStep(1)}
            >
              Resetar banco de dados
            </button>
          )}

          {resetStep === 1 && (
            <div>
              <p style={{ fontSize: 13, color: '#e74c3c', marginBottom: 10 }}>
                Confirma que quer apagar TODOS os dados? Esta ação não tem volta.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-sm"
                  style={{ background: '#e74c3c', color: '#fff', border: 'none' }}
                  onClick={handleReset}
                >
                  Sim, quero apagar
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setResetStep(0)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {resetStep === 2 && (
            <div>
              <p style={{ fontSize: 13, color: '#e74c3c', marginBottom: 10 }}>
                Digite <strong>CONFIRMAR</strong> para prosseguir:
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  className="input"
                  style={{ maxWidth: 200 }}
                  placeholder="CONFIRMAR"
                  value={resetInput}
                  onChange={e => setResetInput(e.target.value)}
                />
                <button
                  className="btn btn-sm"
                  style={{ background: '#e74c3c', color: '#fff', border: 'none' }}
                  onClick={handleReset}
                  disabled={resetting}
                >
                  {resetting ? 'Resetando…' : 'Resetar'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setResetStep(0); setResetInput('') }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

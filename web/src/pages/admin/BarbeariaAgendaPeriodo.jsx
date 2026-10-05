import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'

// Agenda por período e busca de horários livres.
// A recepção escolhe um ou vários dias, um profissional ou a equipe toda, e vê o que
// já está marcado (inclusive pelo WhatsApp) e onde ainda tem vaga.

const STATUS_LABEL = { agendado: 'Agendado', confirmado: 'Confirmado', em_atendimento: 'Em atendimento', concluido: 'Concluído', cancelado: 'Cancelado', nao_compareceu: 'Não compareceu' }
const ORIGEM_LABEL = { whatsapp_ia: 'WhatsApp IA', publico: 'Link público', online: 'Link público', admin: 'Recepção' }

function hojeLocal() {
  const agora = new Date()
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function somarDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

// Horário e dia no fuso da unidade (Cuiabá), não em UTC.
const FUSO = 'America/Cuiaba'
function horaDoItem(item) {
  if (item.horaLocal) return item.horaLocal
  const d = new Date(item.dataHora || '')
  return Number.isNaN(d.valueOf()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO })
}
function diaDoItem(item) {
  if (item.dataAgenda) return String(item.dataAgenda).slice(0, 10)
  const d = new Date(item.dataHora || '')
  return Number.isNaN(d.valueOf()) ? '' : d.toLocaleDateString('en-CA', { timeZone: FUSO })
}

function diaLegivel(iso) {
  const d = new Date(`${iso}T12:00:00Z`)
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

const s = {
  card: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'grid', gap: 14 },
  head: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', justifyContent: 'space-between' },
  h2: { margin: 0, fontSize: 18 },
  sub: { margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 },
  row: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' },
  label: { display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' },
  input: { padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', minHeight: 38 },
  chip: (ativo) => ({ padding: '7px 12px', borderRadius: 999, border: '1px solid var(--border)', background: ativo ? 'var(--accent)' : 'transparent', color: ativo ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 13 }),
  primary: { padding: '9px 14px', borderRadius: 10, border: 0, background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600 },
  dia: { borderTop: '1px solid var(--border)', paddingTop: 10, display: 'grid', gap: 6 },
  diaTitulo: { fontWeight: 700, textTransform: 'capitalize' },
  item: { display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 6%, transparent)', cursor: 'pointer', textAlign: 'left', border: 0, color: 'inherit', width: '100%' },
  badge: { fontSize: 11, padding: '3px 8px', borderRadius: 999, border: '1px solid var(--border)', whiteSpace: 'nowrap' },
  slots: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  slot: { padding: '6px 10px', borderRadius: 8, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontVariantNumeric: 'tabular-nums' },
  vazio: { color: 'var(--muted)', fontSize: 13 },
}

export default function BarbeariaAgendaPeriodo({ profissionais = [], servicos = [], profissionalId = '', onProfissionalChange, onOpenAppointment, onPickSlot, refreshKey = 0 }) {
  const hoje = hojeLocal()
  const [de, setDe] = useState(hoje)
  const [ate, setAte] = useState(somarDias(hoje, 6))
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [servicoId, setServicoId] = useState('')
  const [livres, setLivres] = useState(null)
  const [buscando, setBuscando] = useState(false)

  const ativos = useMemo(() => profissionais.filter((item) => item.ativo !== false), [profissionais])
  const servicosAtivos = useMemo(() => servicos.filter((item) => item.ativo !== false), [servicos])

  const atalho = (dias) => { setDe(hoje); setAte(somarDias(hoje, dias - 1)) }

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('')
    try {
      const q = new URLSearchParams({ de, ate })
      if (profissionalId) q.set('profissionalId', profissionalId)
      const r = await api.get(`/api/admin/barbearia/agenda-periodo?${q.toString()}`)
      setItens(r.itens || [])
    } catch (e) { setErro(e.message || 'Não foi possível carregar a agenda.') } finally { setCarregando(false) }
  }, [de, ate, profissionalId])

  useEffect(() => { carregar() }, [carregar, refreshKey])

  const porDia = useMemo(() => {
    const mapa = new Map()
    for (const item of itens) {
      const dia = diaDoItem(item)
      if (!mapa.has(dia)) mapa.set(dia, [])
      mapa.get(dia).push(item)
    }
    for (const lista of mapa.values()) lista.sort((a, b) => horaDoItem(a).localeCompare(horaDoItem(b)))
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [itens])

  async function buscarLivres() {
    if (!servicoId) { setErro('Escolha o serviço para ver os horários livres.'); return }
    setBuscando(true); setErro('')
    try {
      const q = new URLSearchParams({ servicoId, de, ate: ate > somarDias(de, 13) ? somarDias(de, 13) : ate })
      if (profissionalId) q.set('profissionalId', profissionalId)
      const r = await api.get(`/api/admin/barbearia/horarios-livres?${q.toString()}`)
      setLivres(r)
    } catch (e) { setErro(e.message || 'Não foi possível consultar os horários livres.') } finally { setBuscando(false) }
  }

  const livresPorDia = useMemo(() => {
    const mapa = new Map()
    for (const item of livres?.itens || []) {
      if (!mapa.has(item.data)) mapa.set(item.data, [])
      mapa.get(item.data).push(item)
    }
    return [...mapa.entries()]
  }, [livres])

  return <section style={s.card} aria-label="Agenda por período e horários livres">
    <div style={s.head}>
      <div><h2 style={s.h2}>Agenda por período</h2><p style={s.sub}>Escolha os dias e o profissional para ver tudo o que está marcado, inclusive pelo WhatsApp, e pedir os horários livres.</p></div>
      <div style={s.row}>
        <button type="button" style={s.chip(de === hoje && ate === hoje)} onClick={() => atalho(1)}>Hoje</button>
        <button type="button" style={s.chip(de === hoje && ate === somarDias(hoje, 1))} onClick={() => atalho(2)}>Hoje e amanhã</button>
        <button type="button" style={s.chip(de === hoje && ate === somarDias(hoje, 6))} onClick={() => atalho(7)}>7 dias</button>
        <button type="button" style={s.chip(de === hoje && ate === somarDias(hoje, 29))} onClick={() => atalho(30)}>30 dias</button>
      </div>
    </div>

    <div style={s.row}>
      <label style={s.label}>De<input type="date" value={de} onChange={(e) => { setDe(e.target.value); if (e.target.value > ate) setAte(e.target.value) }} style={s.input} /></label>
      <label style={s.label}>Até<input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} style={s.input} /></label>
      <label style={s.label}>Profissional
        <select value={profissionalId} onChange={(e) => onProfissionalChange?.(e.target.value)} style={s.input}>
          <option value="">Toda a equipe</option>
          {ativos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
      </label>
      <button type="button" style={s.primary} onClick={carregar} disabled={carregando}>{carregando ? 'Carregando…' : 'Atualizar'}</button>
    </div>

    {erro && <div role="alert" style={{ color: '#dc2626', fontSize: 13 }}>{erro}</div>}

    <div aria-live="polite">
      <strong>{itens.length}</strong> <span style={s.vazio}>atendimento(s) de {diaLegivel(de)} a {diaLegivel(ate)}{profissionalId ? ` · ${ativos.find((p) => p.id === profissionalId)?.nome || ''}` : ''}</span>
    </div>
    {!carregando && itens.length === 0 && <p style={s.vazio}>Nada marcado nesse período.</p>}
    {porDia.map(([dia, lista]) => <div key={dia} style={s.dia}>
      <div style={s.diaTitulo}>{diaLegivel(dia)} · {lista.length}</div>
      {lista.map((item) => <button type="button" key={item.id} style={s.item} onClick={() => onOpenAppointment?.(item)}>
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{horaDoItem(item)}</strong>
        <span><strong>{item.clienteNome || item.cliente_nome || 'Cliente'}</strong> · {item.servicoNome || item.servico_nome || 'Serviço'} · {item.profissionalNome || item.profissional_nome || 'Sem profissional'}</span>
        <span style={{ display: 'flex', gap: 6 }}>
          {item.origem && <span style={s.badge}>{ORIGEM_LABEL[item.origem] || item.origem}</span>}
          <span style={s.badge}>{STATUS_LABEL[item.status] || item.status}</span>
        </span>
      </button>)}
    </div>)}

    <div style={{ ...s.dia, gap: 10 }}>
      <div><h2 style={s.h2}>Horários livres</h2><p style={s.sub}>Mesma regra do WhatsApp e do link público: jornada de cada profissional, quem faz o serviço e o que já está ocupado. Até 14 dias por consulta.</p></div>
      <div style={s.row}>
        <label style={s.label}>Serviço
          <select value={servicoId} onChange={(e) => setServicoId(e.target.value)} style={s.input}>
            <option value="">Escolha o serviço</option>
            {servicosAtivos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
          </select>
        </label>
        <button type="button" style={s.primary} onClick={buscarLivres} disabled={buscando}>{buscando ? 'Buscando…' : 'Ver horários livres'}</button>
      </div>
      {livres && livresPorDia.length === 0 && <p style={s.vazio}>Nenhum horário livre no período.</p>}
      {livresPorDia.map(([dia, lista]) => <div key={dia} style={{ display: 'grid', gap: 6 }}>
        <div style={s.diaTitulo}>{diaLegivel(dia)}</div>
        {lista.map((linha) => <div key={linha.profissionalId} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, alignItems: 'start' }}>
          <span>{linha.profissionalNome}</span>
          {linha.horarios.length
            ? <div style={s.slots}>{linha.horarios.map((h) => <button type="button" key={h} style={s.slot} title="Agendar neste horário" onClick={() => onPickSlot?.({ data: dia, hora: h, profissionalId: linha.profissionalId, servicoId })}>{h}</button>)}</div>
            : <span style={s.vazio}>Sem vaga</span>}
        </div>)}
      </div>)}
    </div>
  </section>
}

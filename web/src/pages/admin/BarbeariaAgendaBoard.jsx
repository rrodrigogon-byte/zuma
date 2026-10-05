import { useMemo } from 'react'
import { hojeAgenda } from '../../lib/barbearia-calendar'

const PADRAO_GRADE = { inicio: 8 * 60, fim: 20 * 60, intervalo: 30 }
const ALTURA_SLOT = 48

const STATUS = {
  agendado: { label: 'Agendado', color: '#4a9eff' },
  confirmado: { label: 'Confirmado', color: '#8b5cf6' },
  em_atendimento: { label: 'Em atendimento', color: '#f59e0b' },
  concluido: { label: 'Concluído', color: '#14b87a' },
  cancelado: { label: 'Cancelado', color: '#e05c5c' },
  nao_compareceu: { label: 'Não compareceu', color: '#888' },
}

function minutosDoDia(value) {
  const data = new Date(value)
  if (Number.isNaN(data.valueOf())) return PADRAO_GRADE.inicio
  const partes = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(data)
  const hora = Number(partes.find((parte) => parte.type === 'hour')?.value)
  const minuto = Number(partes.find((parte) => parte.type === 'minute')?.value)
  return Number.isFinite(hora) && Number.isFinite(minuto) ? hora * 60 + minuto : PADRAO_GRADE.inicio
}

function dataComDeslocamento(data, deslocamento) {
  const base = new Date(`${data}T12:00:00Z`)
  base.setUTCDate(base.getUTCDate() + deslocamento)
  return base.toISOString().slice(0, 10)
}

function dataLonga(data) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Cuiaba' }).format(new Date(`${data}T12:00:00-04:00`))
}

function horaLabel(minutos) {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
}

function minutosHorario(value, fallback) {
  const [hora, minuto] = String(value || '').split(':').map(Number)
  if (!Number.isFinite(hora) || !Number.isFinite(minuto) || hora < 0 || hora > 23 || minuto < 0 || minuto > 59) return fallback
  return hora * 60 + minuto
}

function gradeDaUnidade(configuracao = {}) {
  const inicio = minutosHorario(configuracao.horarioAbertura, PADRAO_GRADE.inicio)
  const fim = minutosHorario(configuracao.horarioFechamento, PADRAO_GRADE.fim)
  const intervalo = Math.min(120, Math.max(5, Number(configuracao.intervaloMinutos || PADRAO_GRADE.intervalo)))
  return { inicio, fim: Math.max(inicio + intervalo, fim), intervalo }
}

function iniciais(nome) {
  return String(nome || '?').split(/\s+/).slice(0, 2).map((item) => item[0]).join('').toUpperCase()
}

function moeda(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function eventoPosicao(item, grade) {
  const inicio = Math.max(grade.inicio, Math.min(grade.fim - grade.intervalo, minutosDoDia(item.dataHora)))
  const duracao = Math.max(grade.intervalo, Number(item.duracaoMinutos || item.duracao_minutos || grade.intervalo))
  const fim = Math.min(grade.fim, inicio + duracao)
  return { top: ((inicio - grade.inicio) / grade.intervalo) * ALTURA_SLOT, height: Math.max(36, ((fim - inicio) / grade.intervalo) * ALTURA_SLOT - 6) }
}

export default function BarbeariaAgendaBoard({ data, configuracao = {}, agendamentos = [], profissionais = [], bloqueios = [], onDateChange, onNew, onOpenAppointment }) {
  const profissionaisAtivos = useMemo(() => profissionais.filter((item) => item.ativo !== false), [profissionais])
  const grade = useMemo(() => gradeDaUnidade(configuracao), [configuracao])
  const colunas = useMemo(() => {
    const base = profissionaisAtivos.map((item) => ({ id: item.id, nome: item.nome, especialidade: item.especialidade, avatar: iniciais(item.nome), horarioInicio: item.horarioInicio, horarioFim: item.horarioFim, diasTrabalho: item.diasTrabalho || [] }))
    if (agendamentos.some((item) => !item.profissionalId)) base.push({ id: '__sem_profissional__', nome: 'Sem atendente', especialidade: 'A definir', avatar: '?' })
    return base.length ? base : [{ id: '__sem_profissional__', nome: 'Sem atendente', especialidade: 'Cadastre a equipe', avatar: '?' }]
  }, [agendamentos, profissionaisAtivos])
  const linhas = useMemo(() => Array.from({ length: Math.floor((grade.fim - grade.inicio) / grade.intervalo) + 1 }, (_, index) => grade.inicio + index * grade.intervalo), [grade])
  const diaDaSemana = new Date(`${data}T12:00:00-04:00`).getDay()
  const porColuna = useMemo(() => {
    const resultado = new Map(colunas.map((coluna) => [coluna.id, []]))
    agendamentos.filter((item) => !['cancelado', 'nao_compareceu'].includes(item.status)).forEach((item) => {
      const coluna = item.profissionalId && resultado.has(item.profissionalId) ? item.profissionalId : '__sem_profissional__'
      if (!resultado.has(coluna)) resultado.set(coluna, [])
      resultado.get(coluna).push(item)
    })
    return resultado
  }, [agendamentos, colunas])

  return <section style={{ ...agendaBoardColumns(colunas.length), display: 'grid', gap: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
      <div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => onDateChange(dataComDeslocamento(data, -1))} style={styles.navButton} aria-label="Dia anterior">‹</button>
          <button type="button" onClick={() => onDateChange(hojeAgenda())} style={styles.todayButton}>Hoje</button>
          <button type="button" onClick={() => onDateChange(dataComDeslocamento(data, 1))} style={styles.navButton} aria-label="Próximo dia">›</button>
          <strong style={{ fontSize: 18, textTransform: 'capitalize' }}>{dataLonga(data)}</strong>
        </div>
        <p style={styles.sub}>Agenda diária da unidade ativa, organizada por atendente e intervalo de serviço.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={styles.dateLabel}>Escolher data<input type="date" value={data} onChange={(event) => event.target.value && onDateChange(event.target.value)} style={styles.dateInput} /></label>
        <button type="button" onClick={onNew} style={styles.primary}>+ Novo atendimento</button>
      </div>
    </div>
    <div style={styles.summaryRow}>
      {colunas.map((coluna) => <div key={coluna.id} style={styles.summaryCard}><div style={{ ...styles.avatar, background: coluna.id === '__sem_profissional__' ? '#e6edf5' : 'var(--accent)', color: coluna.id === '__sem_profissional__' ? 'var(--muted)' : '#fff' }}>{coluna.avatar}</div><div style={{ minWidth: 0 }}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{coluna.nome}</strong><span style={styles.sub}>{porColuna.get(coluna.id)?.length || 0} atendimentos · {coluna.especialidade || 'Equipe'}</span></div></div>)}
    </div>
    <div style={styles.hint}><strong>Leitura rápida:</strong> cada cartão representa um atendimento. Clique no cartão para abrir os detalhes e executar a próxima ação permitida; os bloqueios aparecem hachurados.</div>
    <div style={styles.scroll}>
      <div style={{ minWidth: Math.max(760, 170 + colunas.length * 230) }}>
        <div style={styles.boardHeader}><div style={styles.timeHeader}>Horário</div>{colunas.map((coluna) => <div key={coluna.id} style={styles.columnHeader}><div style={{ ...styles.avatar, width: 30, height: 30, fontSize: 11, background: coluna.id === '__sem_profissional__' ? '#e6edf5' : 'var(--accent)', color: coluna.id === '__sem_profissional__' ? 'var(--muted)' : '#fff' }}>{coluna.avatar}</div><div><strong>{coluna.nome}</strong><small style={styles.sub}>{coluna.especialidade || 'Equipe'} · {coluna.horarioInicio && coluna.horarioFim ? `${coluna.horarioInicio}–${coluna.horarioFim}` : 'jornada não definida'}</small></div></div>)}</div>
        <div style={styles.boardBody}>
          <div style={styles.timeColumn}>            {linhas.slice(0, -1).map((minutos) => <div key={minutos} style={{ height: ALTURA_SLOT, position: 'relative' }}><span style={styles.timeText}>{horaLabel(minutos)}</span></div>)}
</div>
          {colunas.map((coluna) => { const trabalhaHoje = coluna.id === '__sem_profissional__' || !coluna.diasTrabalho.length || coluna.diasTrabalho.includes(diaDaSemana); return <div key={coluna.id} style={{ ...styles.timelineColumn, opacity: trabalhaHoje ? 1 : .68 }}>
            {linhas.slice(0, -1).map((minutos) => <div key={minutos} style={{ height: ALTURA_SLOT, borderBottom: '1px solid var(--line)', borderTop: minutos % 60 === 0 ? '1px solid var(--line)' : undefined }} />)}
            {bloqueios.filter((item) => !item.profissionalId || item.profissionalId === coluna.id).map((bloqueio) => { const posicao = eventoPosicao({ dataHora: bloqueio.inicio, duracaoMinutos: (new Date(bloqueio.fim).valueOf() - new Date(bloqueio.inicio).valueOf()) / 60000 }, grade); return <div key={bloqueio.id} style={{ ...styles.blocked, top: posicao.top, height: posicao.height }} title={bloqueio.titulo}>{bloqueio.titulo}</div> })}
            {!trabalhaHoje && <div style={styles.offDayOverlay}>Folga do atendente<br /><small>{dataLonga(data)}</small></div>}
            {(porColuna.get(coluna.id) || []).map((item) => { const posicao = eventoPosicao(item, grade); const status = STATUS[item.status] || STATUS.agendado; return <button key={item.id} type="button" onClick={() => onOpenAppointment(item)} style={{ ...styles.event, top: posicao.top, height: posicao.height, borderLeftColor: status.color, background: `${status.color}18` }} title={`${item.clienteNome || 'Cliente'} · ${item.servicoNome || 'Serviço'}`}><strong>{item.clienteNome || 'Cliente sem nome'}</strong><span>{item.servicoNome || 'Serviço não informado'}</span><small>{horaLabel(minutosDoDia(item.dataHora))} · {item.duracaoMinutos || grade.intervalo} min · {moeda(item.valor)}</small></button> })}
          </div> })}
        </div>
      </div>
    </div>
    <div style={styles.legend}>{Object.entries(STATUS).slice(0, 4).map(([status, item]) => <span key={status} style={styles.legendItem}><i style={{ background: item.color }} />{item.label}</span>)}</div>
  </section>
}

const styles = {
  primary: { border: 0, borderRadius: 9, padding: '10px 14px', background: 'var(--accent)', color: '#fff', fontWeight: 800, cursor: 'pointer' },
  navButton: { width: 34, height: 34, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', fontSize: 24, lineHeight: 1, cursor: 'pointer' },
  todayButton: { border: '1px solid var(--line)', borderRadius: 9, padding: '8px 11px', background: 'var(--card)', color: 'var(--fg)', fontWeight: 800, cursor: 'pointer' },
  dateLabel: { display: 'flex', flexDirection: 'column', gap: 5, color: 'var(--muted)', fontSize: 11, fontWeight: 700 },
  dateInput: { border: '1px solid var(--line)', borderRadius: 9, background: 'var(--card)', color: 'var(--fg)', padding: '9px 10px', font: 'inherit' },
  sub: { display: 'block', color: 'var(--muted)', fontSize: 11, marginTop: 3 },
  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 },
  summaryCard: { display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12 },
  avatar: { width: 38, height: 38, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 900 },
  hint: { padding: '11px 13px', borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 8%, var(--card))', color: 'var(--muted)', fontSize: 12 },
  scroll: { overflowX: 'auto', paddingBottom: 6 },
  boardHeader: { display: 'grid', gridTemplateColumns: '84px repeat(var(--agenda-columns), minmax(210px, 1fr))', border: '1px solid var(--line)', borderBottom: 0, borderRadius: '12px 12px 0 0', overflow: 'hidden' },
  timeHeader: { padding: 14, background: 'var(--card2)', color: 'var(--muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' },
  columnHeader: { minWidth: 210, display: 'flex', alignItems: 'center', gap: 9, padding: 11, background: 'var(--card2)', borderLeft: '1px solid var(--line)' },
  boardBody: { display: 'grid', gridTemplateColumns: '84px repeat(var(--agenda-columns), minmax(210px, 1fr))', border: '1px solid var(--line)', borderRadius: '0 0 12px 12px', overflow: 'hidden' },
  timeColumn: { background: 'var(--card2)' },
  timeText: { position: 'absolute', right: 9, top: -8, color: 'var(--muted)', fontSize: 11, fontWeight: 700 },
  timelineColumn: { minWidth: 210, position: 'relative', background: 'var(--card)' },
  blocked: { position: 'absolute', left: 3, right: 3, zIndex: 1, borderRadius: 7, padding: '7px 8px', overflow: 'hidden', color: '#9b6a00', background: 'repeating-linear-gradient(135deg, rgba(245,158,11,.16), rgba(245,158,11,.16) 6px, rgba(245,158,11,.05) 6px, rgba(245,158,11,.05) 12px)', border: '1px dashed #f59e0b', fontSize: 11, fontWeight: 800 },
  offDayOverlay: { position: 'absolute', inset: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--muted)', fontSize: 12, fontWeight: 800, pointerEvents: 'none', background: 'repeating-linear-gradient(135deg, rgba(136,136,136,.05), rgba(136,136,136,.05) 8px, rgba(136,136,136,.11) 8px, rgba(136,136,136,.11) 16px)' },
  event: { position: 'absolute', left: 7, right: 7, zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, overflow: 'hidden', textAlign: 'left', border: '1px solid var(--line)', borderLeft: '4px solid', borderRadius: 9, padding: '7px 8px', color: 'var(--fg)', cursor: 'pointer', font: 'inherit', transition: 'transform 160ms ease-out, box-shadow 160ms ease-out' },
  legend: { display: 'flex', gap: 14, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 11 },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: 5 },
}

// CSS variables are not available in inline grid templates; this helper is kept outside the render path for callers that need it.
export const agendaBoardColumns = (count) => ({ '--agenda-columns': String(Math.max(1, count)) })

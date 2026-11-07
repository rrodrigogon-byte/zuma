import { useMemo, useState, useEffect } from 'react'
import { hojeAgenda } from '../../lib/barbearia-calendar'

const PADRAO_GRADE = { inicio: 8 * 60, fim: 20 * 60, intervalo: 15 }

const STATUS = {
  agendado: { label: 'Agendado', color: '#3b82f6' },
  confirmado: { label: 'Confirmado', color: '#10b981' },
  aguardando_confirmacao: { label: 'Aguardando confirmação', color: '#f59e0b' },
  cancelado_falta_confirmacao: { label: 'Cancelado por falta de confirmação', color: '#ef4444' },
  em_atendimento: { label: 'Em atendimento', color: '#8b5cf6' },
  concluido: { label: 'Concluído', color: '#059669' },
  cancelado: { label: 'Cancelado', color: '#ef4444' },
  nao_compareceu: { label: 'Não compareceu', color: '#6b7280' },
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

function gradeDaUnidade(configuracao = {}, overrideIntervalo = null, modo24h = false) {
  if (modo24h) {
    const intv = overrideIntervalo || configuracao.intervaloMinutos || PADRAO_GRADE.intervalo
    const intervalo = Math.min(120, Math.max(5, Number(intv)))
    return { inicio: 0, fim: 24 * 60, intervalo }
  }
  const inicio = minutosHorario(configuracao.horarioAbertura, PADRAO_GRADE.inicio)
  const fim = minutosHorario(configuracao.horarioFechamento, PADRAO_GRADE.fim)
  const intv = overrideIntervalo || configuracao.intervaloMinutos || PADRAO_GRADE.intervalo
  const intervalo = Math.min(120, Math.max(5, Number(intv)))
  return { inicio, fim: Math.max(inicio + intervalo, fim), intervalo }
}

function iniciais(nome) {
  return String(nome || '?').split(/\s+/).slice(0, 2).map((item) => item[0]).join('').toUpperCase()
}

function moeda(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function eventoPosicao(item, grade, alturaSlot) {
  const inicio = Math.max(grade.inicio, Math.min(grade.fim - grade.intervalo, minutosDoDia(item.dataHora)))
  const duracao = Math.max(grade.intervalo, Number(item.duracaoMinutos || item.duracao_minutos || grade.intervalo))
  const fim = Math.min(grade.fim, inicio + duracao)
  return { top: ((inicio - grade.inicio) / grade.intervalo) * alturaSlot, height: Math.max(26, ((fim - inicio) / grade.intervalo) * alturaSlot - 4) }
}

export default function BarbeariaAgendaBoard({ data, configuracao = {}, agendamentos = [], profissionais = [], bloqueios = [], onDateChange, onNew, onOpenAppointment }) {
  const [intervaloManual, setIntervaloManual] = useState(15)
  const [modo24h, setModo24h] = useState(false)
  const [agoraMinutos, setAgoraMinutos] = useState(null)
  const [horaAtualStr, setHoraAtualStr] = useState('')
  const [menuDataAberto, setMenuDataAberto] = useState(false)

  // Relógio ao vivo de Cuiabá para posicionar a linha vermelha horizontal
  useEffect(() => {
    function atualizarRelogio() {
      const agora = new Date()
      const partes = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(agora)
      const hora = Number(partes.find((p) => p.type === 'hour')?.value)
      const minuto = Number(partes.find((p) => p.type === 'minute')?.value)
      if (Number.isFinite(hora) && Number.isFinite(minuto)) {
        setAgoraMinutos(hora * 60 + minuto)
        setHoraAtualStr(`${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`)
      }
    }
    atualizarRelogio()
    const timer = setInterval(atualizarRelogio, 30000)
    return () => clearInterval(timer)
  }, [])

  const profissionaisAtivos = useMemo(() => profissionais.filter((item) => item.ativo !== false && !item.removidoEm && !item.excluido), [profissionais])
  const grade = useMemo(() => gradeDaUnidade(configuracao, intervaloManual, modo24h), [configuracao, intervaloManual, modo24h])
  const alturaSlot = grade.intervalo <= 15 ? 36 : grade.intervalo <= 30 ? 46 : 56
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

  const isHoje = data === hojeAgenda()
  const exibirLinhaVermelha = isHoje && agoraMinutos !== null && agoraMinutos >= grade.inicio && agoraMinutos <= grade.fim
  const posicaoLinhaVermelha = exibirLinhaVermelha ? ((agoraMinutos - grade.inicio) / grade.intervalo) * alturaSlot : null

  return (
    <section style={{ ...agendaBoardColumns(colunas.length), display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
            <button type="button" onClick={() => onDateChange(dataComDeslocamento(data, -1))} style={styles.navButton} aria-label="Dia anterior">‹</button>
            <button
              type="button"
              onClick={() => onDateChange(hojeAgenda())}
              style={{
                ...styles.todayButton,
                background: isHoje ? '#FF6B2C' : 'var(--card)',
                color: isHoje ? '#fff' : 'var(--fg)',
                borderColor: isHoje ? '#FF6B2C' : 'var(--line)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
              title="Voltar para a data de hoje"
            >
              <span>📅</span> Hoje
            </button>
            <button type="button" onClick={() => onDateChange(dataComDeslocamento(data, 1))} style={styles.navButton} aria-label="Próximo dia">›</button>
            <strong style={{ fontSize: 18, textTransform: 'capitalize' }}>{dataLonga(data)}</strong>
            {isHoje && (
              <span style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                AO VIVO ({horaAtualStr})
              </span>
            )}
          </div>
          <p style={styles.sub}>Agenda diária da unidade ativa, organizada por atendente e intervalo de serviço.</p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Seletor de Modo Comercial / 24 Horas */}
          <button
            type="button"
            onClick={() => setModo24h(!modo24h)}
            style={{
              border: modo24h ? '2px solid #6366f1' : '1px solid var(--line)',
              borderRadius: 8,
              padding: '6px 11px',
              fontSize: 11,
              fontWeight: 800,
              background: modo24h ? 'rgba(99,102,241,.15)' : 'var(--card)',
              color: modo24h ? '#6366f1' : 'var(--fg)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all .15s',
            }}
            title="Alternar entre horário comercial padrão (08h–20h) e visão 24 horas completa"
          >
            <span>{modo24h ? '🌙' : '☀️'}</span> {modo24h ? 'Modo 24 Horas' : 'Comercial'}
          </button>

          {/* Grade de Intervalos (15 min, 30 min, etc.) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--card)', padding: '3px 6px', borderRadius: 10, border: '1px solid var(--line)' }} role="group" aria-label="Intervalo de exibição da agenda">
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', paddingRight: 4 }}>Grade:</span>
            {[15, 30, 45, 60].map((intv) => (
              <button
                key={intv}
                type="button"
                onClick={() => setIntervaloManual(intv)}
                style={{
                  border: 0,
                  borderRadius: 7,
                  padding: '5px 9px',
                  fontSize: 11,
                  fontWeight: grade.intervalo === intv ? 800 : 600,
                  background: grade.intervalo === intv ? 'var(--accent)' : 'transparent',
                  color: grade.intervalo === intv ? '#fff' : 'var(--fg)',
                  cursor: 'pointer',
                  transition: 'all .15s',
                }}
              >
                {intv} min
              </button>
            ))}
          </div>

          <label style={styles.dateLabel}>
            Escolher data
            <input type="date" value={data} onChange={(event) => event.target.value && onDateChange(event.target.value)} style={styles.dateInput} />
          </label>
          <button type="button" onClick={onNew} style={styles.primary}>+ Novo atendimento</button>
        </div>
      </div>

      <div style={styles.summaryRow}>
        {colunas.map((coluna) => (
          <div key={coluna.id} style={styles.summaryCard}>
            <div style={{ ...styles.avatar, background: coluna.id === '__sem_profissional__' ? '#e6edf5' : 'var(--accent)', color: coluna.id === '__sem_profissional__' ? 'var(--muted)' : '#fff' }}>
              {coluna.avatar}
            </div>
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{coluna.nome}</strong>
              <span style={styles.sub}>{porColuna.get(coluna.id)?.length || 0} atendimentos · {coluna.especialidade || 'Equipe'}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.hint}>
        <strong>Leitura rápida:</strong> Agendamentos confirmados em <strong style={{ color: '#10b981' }}>verde</strong>. A linha vermelha horizontal indica o horário atual cortando a tela de fora a fora.
      </div>

      <div style={styles.scroll}>
        <div style={{ minWidth: Math.max(760, 170 + colunas.length * 230) }}>
          <div style={styles.boardHeader}>
            <div style={styles.timeHeader}>Horário</div>
            {colunas.map((coluna) => (
              <div key={coluna.id} style={styles.columnHeader}>
                <div style={{ ...styles.avatar, width: 30, height: 30, fontSize: 11, background: coluna.id === '__sem_profissional__' ? '#e6edf5' : 'var(--accent)', color: coluna.id === '__sem_profissional__' ? 'var(--muted)' : '#fff' }}>
                  {coluna.avatar}
                </div>
                <div>
                  <strong>{coluna.nome}</strong>
                  <small style={styles.sub}>{coluna.especialidade || 'Equipe'} · {coluna.horarioInicio && coluna.horarioFim ? `${coluna.horarioInicio}–${coluna.horarioFim}` : 'jornada não definida'}</small>
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...styles.boardBody, position: 'relative' }}>
            {/* LINHA VERMELHA HORIZONTAL CORTANDO A TELA DE FORA A FORA */}
            {exibirLinhaVermelha && posicaoLinhaVermelha !== null && (
              <div
                style={{
                  position: 'absolute',
                  top: posicaoLinhaVermelha,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: '#ef4444',
                  boxShadow: '0 0 10px rgba(239, 68, 68, 0.85)',
                  zIndex: 25,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 4,
                    background: '#ef4444',
                    color: '#ffffff',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 4,
                    transform: 'translateY(-50%)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
                  {horaAtualStr}
                </div>
              </div>
            )}

            <div style={styles.timeColumn}>
              {linhas.slice(0, -1).map((minutos) => (
                <div key={minutos} style={{ height: alturaSlot, position: 'relative' }}>
                  <span style={{
                    ...styles.timeText,
                    fontWeight: minutos % 60 === 0 ? 800 : 500,
                    fontSize: minutos % 60 === 0 ? 12 : 10,
                    color: minutos % 60 === 0 ? 'var(--fg)' : 'var(--muted)',
                    opacity: minutos % 60 === 0 ? 1 : 0.8,
                  }}>
                    {horaLabel(minutos)}
                  </span>
                </div>
              ))}
            </div>

            {colunas.map((coluna) => {
              const trabalhaHoje = coluna.id === '__sem_profissional__' || !coluna.diasTrabalho.length || coluna.diasTrabalho.includes(diaDaSemana);
              return (
                <div key={coluna.id} style={{ ...styles.timelineColumn, opacity: trabalhaHoje ? 1 : 0.68 }}>
                  {linhas.slice(0, -1).map((minutos) => (
                    <div
                      key={minutos}
                      style={{
                        height: alturaSlot,
                        borderBottom: '1px solid var(--line)',
                        borderTop: minutos % 60 === 0 ? '2px solid var(--line)' : '1px dashed color-mix(in srgb, var(--line) 40%, transparent)'
                      }}
                    />
                  ))}
                  {bloqueios.filter((item) => !item.profissionalId || item.profissionalId === coluna.id).map((bloqueio) => {
                    const posicao = eventoPosicao({ dataHora: bloqueio.inicio, duracaoMinutos: (new Date(bloqueio.fim).valueOf() - new Date(bloqueio.inicio).valueOf()) / 60000 }, grade, alturaSlot);
                    return <div key={bloqueio.id} style={{ ...styles.blocked, top: posicao.top, height: posicao.height }} title={bloqueio.titulo}>{bloqueio.titulo}</div>
                  })}
                  {!trabalhaHoje && <div style={styles.offDayOverlay}>Folga do atendente<br /><small>{dataLonga(data)}</small></div>}
                  {(porColuna.get(coluna.id) || []).map((item) => {
                    const posicao = eventoPosicao(item, grade, alturaSlot);
                    const status = STATUS[item.statusVisual] || STATUS[item.status] || STATUS.agendado;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onOpenAppointment(item)}
                        style={{
                          ...styles.event,
                          top: posicao.top,
                          height: posicao.height,
                          borderLeftColor: status.color,
                          background: `${status.color}18`
                        }}
                        title={`${item.clienteNome || 'Cliente'} · ${item.servicoNome || 'Serviço'}`}
                      >
                        <strong>{item.clienteNome || 'Cliente sem nome'}</strong>
                        <span>{item.servicoNome || 'Serviço não informado'}</span>
                        <small>{horaLabel(minutosDoDia(item.dataHora))} · {item.duracaoMinutos || grade.intervalo} min · {moeda(item.valor)}</small>
                        <small style={{ fontWeight: 800, color: status.color }}>{status.label}</small>
                      </button>
                    )
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={styles.legend}>
        {Object.entries(STATUS).filter(([status]) => ['agendado', 'confirmado', 'aguardando_confirmacao', 'em_atendimento', 'concluido', 'cancelado'].includes(status)).map(([status, item]) => (
          <span key={status} style={styles.legendItem}>
            <i style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </section>
  )
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

export const agendaBoardColumns = (count) => ({ '--agenda-columns': String(Math.max(1, count)) })

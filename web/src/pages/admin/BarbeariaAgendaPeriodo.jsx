import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { lerAgenda, erroAgenda } from '../../lib/agenda-read'
import AgendaProfissionais from './AgendaProfissionais'
import { hojeAgenda, somarDias, diasEntre, periodoMes, diaDoItem, horaDoItem, diaLegivel, filtrarAgenda } from '../../lib/barbearia-calendar'
import './BarbeariaAgendaPeriodo.css'

const STATUS = { agendado: 'Agendado', confirmado: 'Confirmado', em_atendimento: 'Em atendimento', concluido: 'Concluído', cancelado: 'Cancelado', nao_compareceu: 'Não compareceu' }
const ORIGEM = { whatsapp_ia: 'WhatsApp IA', publico: 'Link público', online: 'Link público', admin: 'Recepção', avec: 'Histórico Avec' }
const WEEK = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export default function BarbeariaAgendaPeriodo({ profissionais = [], servicos = [], profissionalId = '', onProfissionalChange, onOpenAppointment, onPickSlot, refreshKey = 0, dataSelecionada, onDateChange, statusFiltro = '' }) {
  const hoje = hojeAgenda()
  const [modo, setModo] = useState('semana')
  const [de, setDe] = useState(dataSelecionada || hoje)
  const [ate, setAte] = useState(somarDias(dataSelecionada || hoje, 6))
  const [busca, setBusca] = useState('')
  const [consulta, setConsulta] = useState(null)
  const [erro, setErro] = useState('')
  const [atualizacao, setAtualizacao] = useState(0)
  const [servicoId, setServicoId] = useState('')
  const [livres, setLivres] = useState(null)
  const [erroLivres, setErroLivres] = useState('')
  const [buscando, setBuscando] = useState(false)
  const pedidoLivres = useRef(0)
  const foco = dataSelecionada || de
  const dias = useMemo(() => diasEntre(de, ate), [de, ate])
  const chave = JSON.stringify([de, ate, profissionalId, refreshKey, atualizacao])
  const chaveLivres = JSON.stringify([de, ate, profissionalId, servicoId, refreshKey, atualizacao])
  const contextoAtual = useRef(chaveLivres)
  contextoAtual.current = chaveLivres
  const carregando = dias.length > 0 && consulta?.chave !== chave && !erro
  const itens = consulta?.chave === chave ? consulta.itens : []
  const visiveis = useMemo(() => filtrarAgenda(itens, { busca, status: statusFiltro }), [itens, busca, statusFiltro])
  const porDia = useMemo(() => {
    const mapa = new Map(dias.map(d => [d, []]))
    for (const item of visiveis) mapa.get(diaDoItem(item))?.push(item)
    for (const lista of mapa.values()) lista.sort((a, b) => horaDoItem(a).localeCompare(horaDoItem(b)))
    return mapa
  }, [dias, visiveis])

  // Changing the operational day keeps the calendar and professional timeline together.
  useEffect(() => {
    if (!dataSelecionada || (dataSelecionada >= de && dataSelecionada <= ate)) return
    if (modo === 'mes') { const p = periodoMes(dataSelecionada); setDe(p.de); setAte(p.ate) }
    else { setDe(dataSelecionada); setAte(somarDias(dataSelecionada, modo === 'semana' ? 6 : 0)) }
  }, [dataSelecionada]) // Range navigation must not be undone by the previously focused day.

  useEffect(() => {
    let ativo = true
    setErro('')
    if (!dias.length) { setErro('Escolha um período válido de até 62 dias.'); return }
    const q = new URLSearchParams({ de, ate })
    if (profissionalId) q.set('profissionalId', profissionalId)
    lerAgenda(() => api.get(`/api/admin/barbearia/agenda-periodo?${q}`), { ativo: () => ativo }).then(r => {
      // O histórico Avec entra como atendimento concluído somente leitura; a hora, quando
      // existe, é a do fechamento da comanda no mesmo dia (referência, não horário marcado).
      const historico = (r?.historico || []).map(item => ({ ...item, horaLocal: item.hora || '' }))
      if (ativo && r) setConsulta({ chave, itens: [...(r.itens || []), ...historico], horario: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Cuiaba' }) })
    }).catch(e => { if (ativo) setErro(erroAgenda(e)) })
    return () => { ativo = false }
  }, [chave])

  useEffect(() => { pedidoLivres.current++; setLivres(null); setErroLivres(''); setBuscando(false) }, [chaveLivres])
  useEffect(() => () => { pedidoLivres.current++ }, [])

  function escolherPeriodo(inicio, fim, novoModo = modo) {
    setDe(inicio); setAte(fim); setModo(novoModo)
    onDateChange?.(inicio)
  }
  function mudarModo(novo) {
    if (novo === 'mes') { const p = periodoMes(foco); escolherPeriodo(p.de, p.ate, novo) }
    else if (novo === 'dia') escolherPeriodo(foco, foco, novo)
    else if (novo === 'semana') escolherPeriodo(foco, somarDias(foco, 6), novo)
    else setModo(novo)
  }
  function navegar(sentido) {
    if (modo === 'mes') { const p = periodoMes(de, sentido); escolherPeriodo(p.de, p.ate) }
    else { const salto = Math.max(1, dias.length) * sentido; escolherPeriodo(somarDias(de, salto), somarDias(ate, salto)) }
  }
  async function buscarLivres() {
    if (!servicoId || !dias.length || dias.length > 14) return
    const pedido = ++pedidoLivres.current
    const contexto = chaveLivres
    setBuscando(true); setLivres(null); setErroLivres('')
    const q = new URLSearchParams({ servicoId, de, ate })
    if (profissionalId) q.set('profissionalId', profissionalId)
    try {
      const r = await lerAgenda(() => api.get(`/api/admin/barbearia/horarios-livres?${q}`), { ativo: () => pedido === pedidoLivres.current && contexto === contextoAtual.current })
      if (r && pedido === pedidoLivres.current && contexto === contextoAtual.current) setLivres({ ...r, contexto, servicoId })
    } catch (e) { if (pedido === pedidoLivres.current) setErroLivres(erroAgenda(e)) }
    finally { if (pedido === pedidoLivres.current) setBuscando(false) }
  }
  const vagas = livres?.contexto === chaveLivres ? livres : null
  const totalVagas = (vagas?.itens || []).reduce((n, item) => n + item.horarios.length, 0)
  const recuo = dias.length ? (new Date(`${de}T12:00:00Z`).getUTCDay() + 6) % 7 : 0
  const abrirDia = dia => { if (onDateChange) onDateChange(dia); else escolherPeriodo(dia, dia, 'lista') }
  const renderItem = item => item.historico ? <div className="dino-cal-event" data-status={item.status} data-historico="avec" key={item.id} title={`Histórico Avec · comanda ${item.numeroComanda || 's/n'}${item.profissionalNomeAvec && item.profissionalNomeAvec !== item.profissionalNome ? ` · ${item.profissionalNomeAvec}` : ''}`}>
    <strong>{item.hora ? `${item.hora}*` : 'Sem hora'} · {item.clienteNome || 'Cliente sem nome'}</strong>
    <span>{item.servicoNome || 'Serviço'} · {item.profissionalNome || 'Sem profissional'}</span>
    <small>Concluído · Histórico Avec{item.hora ? ' · *hora de fechamento da comanda' : ''}</small>
  </div> : <button type="button" className="dino-cal-event" data-status={item.status} key={item.id} onClick={() => onOpenAppointment?.(item)}>
    <strong>{horaDoItem(item)} · {item.clienteNome || item.cliente_nome || 'Cliente sem nome'}</strong>
    <span>{item.servicoNome || item.servico_nome || 'Serviço'} · {item.profissionalNome || item.profissional_nome || 'Sem profissional'}</span>
    <small>{STATUS[item.status] || item.status} · {ORIGEM[item.origem] || item.origem || 'Origem não informada'}</small>
  </button>

  return <section className="dino-cal" aria-label="Agenda por período e horários livres">
    <header className="dino-cal-header"><div><p className="dino-cal-eyebrow">AGENDA DA EQUIPE · CUIABÁ</p><h2>Seu calendário, em um só lugar</h2><p>Veja os próximos dias, abra um atendimento ou encontre uma vaga real.</p></div>
      <div className="dino-cal-segment" role="group" aria-label="Visualização do calendário">{[['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês'], ['lista', 'Lista por período']].map(([id, nome]) => <button type="button" key={id} aria-pressed={modo === id} onClick={() => mudarModo(id)}>{nome}</button>)}</div>
    </header>
    <div className="dino-cal-toolbar"><button type="button" aria-label="Período anterior" onClick={() => navegar(-1)} disabled={!dias.length}>‹</button><button type="button" onClick={() => escolherPeriodo(hoje, somarDias(hoje, 6), 'semana')}>Hoje</button><button type="button" aria-label="Próximo período" onClick={() => navegar(1)} disabled={!dias.length}>›</button><strong>{diaLegivel(de)} — {diaLegivel(ate)}</strong>
      <button type="button" onClick={() => escolherPeriodo(hoje, somarDias(hoje, 1), 'lista')}>Hoje e amanhã</button><button type="button" onClick={() => escolherPeriodo(hoje, somarDias(hoje, 6), 'semana')}>7 dias</button><button type="button" onClick={() => escolherPeriodo(hoje, somarDias(hoje, 29), 'lista')}>30 dias</button>
    </div>
    <div className="dino-cal-toolbar">
      <label>De<input type="date" value={de} onChange={e => { setDe(e.target.value); if (e.target.value > ate) setAte(e.target.value); setModo('lista') }} /></label>
      <label>Até<input type="date" value={ate} min={de} onChange={e => { setAte(e.target.value); setModo('lista') }} /></label>

      <label className="dino-cal-search">Buscar atendimento<input type="search" placeholder="Cliente, serviço ou profissional" value={busca} onChange={e => setBusca(e.target.value)} /></label>
      <button type="button" onClick={() => { setErro(''); setAtualizacao(n => n + 1) }}>Atualizar calendário</button>
    </div>
    <AgendaProfissionais profissionais={profissionais} value={profissionalId} onChange={onProfissionalChange} />
    <div className="dino-cal-meta" aria-live="polite">{carregando ? 'Consultando a agenda…' : erro ? <span role="alert">{erro}</span> : <><strong>{visiveis.length} atendimento(s)</strong>{visiveis.some(i => i.historico) && <span>{visiveis.filter(i => i.historico).length} do histórico Avec</span>}<span>{visiveis.filter(i => i.status === 'confirmado').length} confirmado(s)</span><span>{visiveis.filter(i => i.origem === 'whatsapp_ia').length} pelo WhatsApp</span><small>Consultado às {consulta?.horario} · {statusFiltro ? STATUS[statusFiltro] || statusFiltro : 'Todos os status'}</small></>}</div>
    {!carregando && !erro && <>
      {modo !== 'lista' ? <div className="dino-cal-scroll"><div className={`dino-cal-grid ${modo === 'mes' ? 'dino-cal-month' : modo === 'dia' ? 'dino-cal-single' : ''}`}>
        {modo === 'mes' && WEEK.map(d => <strong className="dino-cal-weekday" key={d}>{d}</strong>)}
        {modo === 'mes' && Array.from({ length: recuo }, (_, i) => <div className="dino-cal-pad" key={`pad-${i}`} />)}
        {dias.map(dia => <div className="dino-cal-day" data-selected={foco === dia} data-today={hoje === dia} key={dia}>
          <button type="button" className="dino-cal-date" aria-pressed={foco === dia} aria-label={`Ver ${diaLegivel(dia)} na linha do tempo`} onClick={() => abrirDia(dia)}><span>{diaLegivel(dia)}</span><b>{porDia.get(dia)?.length || 0}</b></button>
          {(porDia.get(dia) || []).slice(0, modo === 'mes' ? 2 : modo === 'dia' ? Infinity : 4).map(renderItem)}
          {(porDia.get(dia)?.length || 0) > (modo === 'mes' ? 2 : modo === 'dia' ? Infinity : 4) && <button type="button" onClick={() => escolherPeriodo(dia, dia, 'lista')}>Ver todos ({porDia.get(dia).length})</button>}
          {!porDia.get(dia)?.length && <small className="dino-cal-empty">Sem atendimento{busca || statusFiltro ? ' neste filtro' : ''}</small>}
        </div>)}
      </div></div> : <div className="dino-cal-list">{dias.map(dia => <div key={dia}><button type="button" className="dino-cal-list-date" onClick={() => abrirDia(dia)}>{diaLegivel(dia)} · {porDia.get(dia)?.length || 0}</button>{porDia.get(dia)?.length ? porDia.get(dia).map(renderItem) : <p className="dino-cal-empty">Sem atendimento neste filtro.</p>}</div>)}</div>}
      <p className="dino-cal-hint">Clique na data para abrir esse dia na linha do tempo abaixo. Dias sem atendimento não significam vagas disponíveis: consulte o serviço.</p>
    </>}
    <div className="dino-cal-availability"><div><h3>Encontre o próximo horário</h3><p>Disponibilidade conforme jornada, serviço, bloqueios e reservas. A vaga só é reservada ao salvar o agendamento.</p></div>
      <div className="dino-cal-toolbar"><label>Serviço<select value={servicoId} onChange={e => setServicoId(e.target.value)}><option value="">Escolha o serviço</option>{servicos.filter(s => s.ativo !== false).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></label><button type="button" className="dino-cal-primary" disabled={buscando || !servicoId || !dias.length || dias.length > 14} onClick={buscarLivres}>{buscando ? 'Consultando vagas…' : 'Ver horários livres'}</button></div>
      {dias.length > 14 && <p role="status">Para consultar vagas, selecione até 14 dias. <button type="button" onClick={() => escolherPeriodo(de, somarDias(de, 13), 'lista')}>Consultar os primeiros 14 dias</button></p>}
      {erroLivres && <p role="alert">{erroLivres}</p>}
      {vagas && <><p role="status"><strong>{totalVagas} horários disponíveis</strong> · {diaLegivel(de)} a {diaLegivel(ate)}</p><div className="dino-cal-slots">{vagas.itens.filter(l => l.horarios.length).map(l => <details key={`${l.data}-${l.profissionalId}`}><summary>{diaLegivel(l.data)} · {l.profissionalNome} · {l.horarios.length} vagas · primeira às {l.horarios[0]}</summary><div>{l.horarios.map(h => <button type="button" key={h} onClick={() => { if (vagas.contexto === contextoAtual.current) onPickSlot?.({ data: l.data, hora: h, profissionalId: l.profissionalId, servicoId: vagas.servicoId }) }}>{h}</button>)}</div></details>)}</div></>}
    </div>
  </section>
}

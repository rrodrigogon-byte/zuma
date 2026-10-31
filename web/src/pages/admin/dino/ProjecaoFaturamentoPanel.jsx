import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, fmtR } from '../../../lib/api'

const card = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 20 }
const grid = (min = 170) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 })
const kpi = { background: 'var(--card2, var(--card))', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px' }
const label = { fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }
const value = { fontSize: 25, fontWeight: 800, marginTop: 6, fontFamily: 'var(--font-display)' }
const title = { margin: 0, fontSize: 18, fontFamily: 'var(--font-display)' }
const sub = { margin: '4px 0 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 }
const button = { padding: '8px 12px', borderRadius: 9, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 700 }
const buttonPrimary = { ...button, background: 'var(--accent, #b0892e)', color: '#fff', border: '1px solid var(--accent, #b0892e)' }
const table = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const th = { textAlign: 'left', padding: '9px 10px', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--line)' }
const td = { padding: '10px', borderBottom: '1px solid var(--line)', verticalAlign: 'top' }

function mesAtual() {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
}
function mesBR(mes) {
  const [ano, numero] = String(mes || '').split('-').map(Number)
  if (!ano || !numero) return '—'
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(ano, numero - 1, 1))).replace('.', '')
}
function porcentagem(valor) {
  if (valor == null || !Number.isFinite(Number(valor))) return '—'
  return `${(Number(valor) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}
function horas(minutos) { return `${(Number(minutos || 0) / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h` }
function tom(severidade) {
  return ({ critico: '#e05c5c', critica: '#e05c5c', alta: '#f59e0b', alerta: '#f59e0b', positivo: '#14b87a', info: '#14b87a', informativo: '#4a9eff', normal: '#4a9eff' })[severidade] || 'var(--muted)'
}
function Pill({ children, severidade = 'informativo' }) {
  const cor = tom(severidade)
  return <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 20, border: `1px solid ${cor}`, color: cor, fontSize: 11, fontWeight: 800 }}>{children}</span>
}

function GraficoPrevisao({ itens = [] }) {
  const pontos = useMemo(() => {
    const dados = itens.filter((item) => Number.isFinite(Number(item.projecao)))
    const valores = dados.flatMap((item) => [item.conservador, item.projecao, item.favoravel, item.metaReceita].filter((valor) => Number(valor) > 0))
    const maximo = Math.max(1, ...valores)
    const largura = 680; const altura = 230; const lateral = 42; const superior = 22; const inferior = 34
    const passo = dados.length > 1 ? (largura - lateral * 2) / (dados.length - 1) : 0
    const y = (numero) => superior + (altura - superior - inferior) * (1 - Number(numero || 0) / maximo)
    const x = (indice) => lateral + indice * passo
    return { dados, maximo, largura, altura, lateral, superior, inferior, x, y }
  }, [itens])
  if (!pontos.dados.length) return <div style={{ padding: 20, color: 'var(--muted)' }}>Não há série suficiente para desenhar a projeção.</div>
  const linha = (campo) => pontos.dados.map((item, indice) => `${pontos.x(indice)},${pontos.y(item[campo])}`).join(' ')
  const faixa = `${linha('favoravel')} ${[...pontos.dados].reverse().map((item, indice) => `${pontos.x(pontos.dados.length - indice - 1)},${pontos.y(item.conservador)}`).join(' ')}`
  return <div style={{ overflowX: 'auto' }}>
    <svg viewBox={`0 0 ${pontos.largura} ${pontos.altura}`} role="img" aria-label="Cenários de faturamento para os próximos meses" style={{ minWidth: 560, width: '100%', display: 'block' }}>
      <line x1={pontos.lateral} y1={pontos.superior} x2={pontos.largura - pontos.lateral} y2={pontos.superior} stroke="var(--line)" strokeDasharray="3 3" />
      <line x1={pontos.lateral} y1={pontos.altura - pontos.inferior} x2={pontos.largura - pontos.lateral} y2={pontos.altura - pontos.inferior} stroke="var(--line)" />
      {[0.25, 0.5, 0.75].map((fracao) => <g key={fracao}><line x1={pontos.lateral} y1={pontos.superior + (pontos.altura - pontos.superior - pontos.inferior) * fracao} x2={pontos.largura - pontos.lateral} y2={pontos.superior + (pontos.altura - pontos.superior - pontos.inferior) * fracao} stroke="var(--line)" strokeOpacity="0.4" strokeDasharray="2 3" /><text x={pontos.lateral - 6} y={pontos.superior + (pontos.altura - pontos.superior - pontos.inferior) * fracao + 4} textAnchor="end" fill="var(--muted)" fontSize="10">{Math.round((pontos.maximo * (1 - fracao)) / 1000)}k</text></g>)}
      <polygon points={faixa} fill="rgba(74, 158, 255, .12)" />
      <polyline points={linha('conservador')} fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="5 4" />
      <polyline points={linha('favoravel')} fill="none" stroke="#14b87a" strokeWidth="2" strokeDasharray="5 4" />
      <polyline points={linha('projecao')} fill="none" stroke="var(--accent)" strokeWidth="3" />
      {pontos.dados.map((item, indice) => <g key={item.mes}><circle cx={pontos.x(indice)} cy={pontos.y(item.projecao)} r="4" fill="var(--accent)" /><text x={pontos.x(indice)} y={pontos.altura - 9} textAnchor="middle" fill="var(--muted)" fontSize="11">{mesBR(item.mes)}</text></g>)}
    </svg>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: '0 4px', color: 'var(--muted)', fontSize: 12 }}><span><b style={{ color: 'var(--accent)' }}>—</b> cenário base</span><span><b style={{ color: '#f59e0b' }}>- -</b> conservador</span><span><b style={{ color: '#14b87a' }}>- -</b> favorável</span></div>
  </div>
}

function variacaoPct(atual, anterior) {
  if (!anterior || !atual) return null
  return Number(((atual - anterior) / anterior).toFixed(4))
}

function SerieHistorica({ itens = [], resumo = {} }) {
  const [verTabela, setVerTabela] = useState(false)
  const ultimos = useMemo(() => [...itens].reverse().slice(0, 18), [itens])
  const maximo = useMemo(() => Math.max(1, ...itens.map((item) => Number(item.realizado || 0))), [itens])
  if (!itens.length) return null
  return <section style={card}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <div><h2 style={title}>Histórico de faturamento</h2><p style={sub}>Série real registrada desde o primeiro mês, somando o histórico Avec e o realizado no Kytto.</p></div>
      <button type="button" style={button} onClick={() => setVerTabela((v) => !v)}>{verTabela ? 'Ver gráfico' : 'Ver tabela completa'}</button>
    </div>
    <div style={{ ...grid(190), marginTop: 14 }}>
      <div style={kpi}><div style={label}>Meses registrados</div><div style={value}>{resumo.meses || itens.length}</div><small style={{ color: 'var(--muted)' }}>Desde {resumo.primeiroMes ? mesBR(resumo.primeiroMes) : '—'}</small></div>
      <div style={kpi}><div style={label}>Média dos meses fechados</div><div style={value}>{fmtR(resumo.mediaMensal)}</div><small style={{ color: 'var(--muted)' }}>Exclui mês em curso</small></div>
      <div style={kpi}><div style={label}>Total faturado no histórico</div><div style={value}>{fmtR(resumo.totalRealizado)}</div><small style={{ color: 'var(--muted)' }}>Avec {fmtR(resumo.totalAvec)} · Kytto {fmtR(resumo.totalKytto)}</small></div>
      <div style={kpi}><div style={label}>Melhor mês</div><div style={value}>{resumo.melhorMes ? fmtR(resumo.melhorMes.realizado) : '—'}</div><small style={{ color: 'var(--muted)' }}>{resumo.melhorMes ? mesBR(resumo.melhorMes.mes) : ''}</small></div>
    </div>
    {!verTabela ? <div style={{ overflowX: 'auto', marginTop: 16 }}>
      <div role="img" aria-label="Faturamento realizado por mês" style={{ display: 'flex', alignItems: 'flex-end', gap: 6, minWidth: Math.max(520, itens.length * 46), height: 220, padding: '0 4px' }}>
        {itens.map((item) => {
          const total = Number(item.realizado || 0)
          const altura = Math.max(2, Math.round((total / maximo) * 180))
          const avec = total > 0 ? Math.round((Number(item.historicoAvec || 0) / total) * altura) : 0
          return <div key={item.mes} title={`${mesBR(item.mes)}: ${fmtR(total)} (Avec ${fmtR(item.historicoAvec)} · Kytto ${fmtR(Number(item.servicos || 0) + Number(item.revenda || 0))})`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <small style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{total ? `${Math.round(total / 1000)}k` : ''}</small>
            <div style={{ width: '100%', maxWidth: 34, height: altura, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRadius: '6px 6px 0 0', overflow: 'hidden', opacity: item.emCurso ? 0.6 : 1 }}>
              <div style={{ height: altura - avec, background: 'var(--accent)' }} />
              <div style={{ height: avec, background: '#b0892e' }} />
            </div>
            <small style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{mesBR(item.mes)}</small>
          </div>
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, color: 'var(--muted)', fontSize: 12, marginTop: 8 }}><span><b style={{ color: '#b0892e' }}>■</b> histórico Avec</span><span><b style={{ color: 'var(--accent)' }}>■</b> Kytto</span><span>barra mais clara: mês em curso</span></div>
    </div> : <div style={{ overflowX: 'auto', marginTop: 16 }}><table style={table}><thead><tr><th style={th}>Mês</th><th style={th}>Histórico Avec</th><th style={th}>Serviços Kytto</th><th style={th}>Revenda Kytto</th><th style={th}>Total realizado</th><th style={th}>Comandas / atend.</th><th style={th}>Ticket</th><th style={th}>Variação</th></tr></thead><tbody>{ultimos.map((item, indice) => {
      const anterior = ultimos[indice + 1]
      const variacao = anterior && !item.emCurso ? variacaoPct(item.realizado, anterior.realizado) : null
      return <tr key={item.mes}><td style={td}><strong>{mesBR(item.mes)}</strong>{item.emCurso && <div><Pill>Em curso</Pill></div>}</td><td style={td}>{fmtR(item.historicoAvec)}</td><td style={td}>{fmtR(item.servicos)}</td><td style={td}>{fmtR(item.revenda)}</td><td style={{ ...td, fontWeight: 800 }}>{fmtR(item.realizado)}</td><td style={td}>{Number(item.comandasAvec || 0) + Number(item.atendimentosConcluidos || 0)}</td><td style={td}>{item.ticketMedio ? fmtR(item.ticketMedio) : '—'}</td><td style={{ ...td, color: variacao == null ? 'var(--muted)' : variacao >= 0 ? '#14b87a' : '#f59e0b' }}>{variacao == null ? '—' : `${variacao >= 0 ? '+' : ''}${porcentagem(variacao)}`}</td></tr>
    })}</tbody></table></div>}
  </section>
}

function AnaliseIa({ inteligencia, alertas, onAtualizar, onReconhecer, fatores, setFatores, simulacao, onSimular }) {
  const analysis = inteligencia?.analysis || {}
  const status = inteligencia?.status === 'ready' ? 'IA atualizada' : inteligencia?.status === 'fallback' ? 'Leitura local segura' : 'Em análise'
  const controls = [['atendimentos', 'Atendimentos', 'volume'], ['ticket', 'Ticket médio', 'ticket'], ['revenda', 'Revenda', 'revenda'], ['ocupacao', 'Ocupação', 'ocupação']]
  return <section style={card}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
      <div><h2 style={title}>Analista gerencial com IA</h2><p style={sub}>A IA interpreta somente os indicadores calculados pelo Kytto. Nenhuma recomendação altera caixa, agenda, estoque ou comissão.</p></div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Pill severidade={inteligencia?.status === 'ready' ? 'positivo' : 'informativo'}>{status}</Pill><button type="button" style={button} onClick={onAtualizar}>Atualizar análise</button></div>
    </div>
    <div style={{ ...grid(220), marginTop: 16 }}>
      <div style={{ ...kpi, gridColumn: 'span 2' }}><div style={label}>Resumo executivo</div><p style={{ margin: '9px 0 0', lineHeight: 1.55 }}>{analysis.resumoExecutivo || 'A análise será gerada após o primeiro ciclo de dados.'}</p><small style={{ color: 'var(--muted)' }}>Confiança: {analysis.confiancaRotulo || '—'} · {inteligencia?.provider ? `provedor ${inteligencia.provider}` : 'fallback determinístico'}</small></div>
      <div style={kpi}><div style={label}>Tendência identificada</div><div style={{ ...value, color: analysis.tendencia === 'crescimento' ? '#14b87a' : analysis.tendencia === 'queda' ? '#f59e0b' : 'var(--fg)' }}>{analysis.tendencia || '—'}</div><small style={{ color: 'var(--muted)' }}>Derivada do histórico registrado</small></div>
    </div>
    <div style={{ ...grid(300), marginTop: 16, alignItems: 'start' }}>
      <div><h3 style={{ ...title, fontSize: 16 }}>Alertas para a gestão</h3><div style={{ display: 'grid', gap: 9, marginTop: 10 }}>{alertas.length ? alertas.map((alerta) => <div key={alerta.id || alerta.alert_key} style={{ borderLeft: `3px solid ${tom(alerta.severidade)}`, padding: '8px 0 8px 11px' }}><Pill severidade={alerta.severidade}>{alerta.severidade}</Pill><strong style={{ display: 'block', marginTop: 6 }}>{alerta.titulo}</strong><div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>{alerta.mensagem}</div>{alerta.status === 'active' && alerta.id && <button type="button" style={{ ...button, marginTop: 8 }} onClick={() => onReconhecer(alerta.id)}>Reconhecer</button>}</div>) : <div style={{ color: 'var(--muted)', padding: 10 }}>Nenhum alerta crítico ativo para esta competência.</div>}</div></div>
      <div><h3 style={{ ...title, fontSize: 16 }}>Causas e recomendações</h3><div style={{ display: 'grid', gap: 9, marginTop: 10 }}>{(analysis.causas || []).slice(0, 4).map((causa, index) => <div key={`${causa.titulo}-${index}`} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 11 }}><strong>{causa.titulo}</strong><p style={sub}>{causa.explicacao}</p></div>)}{(analysis.recomendacoes || []).slice(0, 4).map((acao, index) => <div key={`${acao.titulo}-${index}`} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 11 }}><Pill severidade={acao.prioridade === 'alta' ? 'alerta' : 'informativo'}>Ação {acao.prioridade}</Pill><strong style={{ display: 'block', marginTop: 6 }}>{acao.titulo}</strong><p style={sub}>{acao.descricao}</p></div>)}</div></div>
    </div>
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}><div><h3 style={{ ...title, fontSize: 16 }}>Simulador de cenários</h3><p style={sub}>Ajuste fatores hipotéticos para estimar impacto. Nada é salvo ou aplicado ao ERP.</p></div><button type="button" style={button} onClick={onSimular}>Simular cenário</button></div><div style={{ ...grid(180), marginTop: 12 }}>{controls.map(([key, name, hint]) => <label key={key} style={{ display: 'grid', gap: 6, color: 'var(--muted)', fontSize: 12 }}>{name}: <strong style={{ color: 'var(--fg)' }}>{Number(fatores[key]).toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 0 })}</strong><input aria-label={name} type="range" min="0.5" max="1.5" step="0.05" value={fatores[key]} onChange={(event) => setFatores((old) => ({ ...old, [key]: Number(event.target.value) }))} /><small>{hint} relativo ao ritmo atual</small></label>)}</div>{simulacao && <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'var(--card2, var(--card))' }}><strong>Resultado simulado: {fmtR(simulacao.resultado?.total)}</strong><span style={{ color: simulacao.variacao >= 0 ? '#14b87a' : '#f59e0b', marginLeft: 8 }}>{simulacao.variacao >= 0 ? '+' : ''}{fmtR(simulacao.variacao)} contra a base</span><p style={sub}>{simulacao.aviso}</p></div>}</div>
  </section>
}

function ModalAnaliseProfissional({ profissional, mes, onClose, onSalvo }) {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [dados, setDados] = useState(null)
  const [form, setForm] = useState({ receita: '', atendimentos: '', planoAcao: '' })
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState('')

  useEffect(() => {
    let ativo = true
    setCarregando(true); setErro(''); setSucesso('')
    api.get(`/api/admin/barbearia/captacao/profissionais/${encodeURIComponent(profissional.profissionalId)}/analise-projecao?mes=${encodeURIComponent(mes)}`)
      .then((res) => {
        if (!ativo) return
        setDados(res)
        const rec = res.metaAtual?.receita ?? profissional.meta?.receita ?? res.planoAcao?.metasSugeridas?.receita ?? ''
        const atend = res.metaAtual?.atendimentos ?? profissional.meta?.atendimentos ?? res.planoAcao?.metasSugeridas?.atendimentos ?? ''
        const plano = res.metaAtual?.planoAcao || res.planoAcao?.textoPlanoSugerido || ''
        setForm({ receita: rec, atendimentos: atend, planoAcao: plano })
      })
      .catch((err) => { if (ativo) setErro(err.message || 'Erro ao carregar diagnóstico.') })
      .finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [profissional.profissionalId, mes, profissional.meta])

  const usarSugestao = () => {
    if (dados?.planoAcao?.textoPlanoSugerido) {
      setForm((prev) => ({
        ...prev,
        planoAcao: dados.planoAcao.textoPlanoSugerido,
        receita: dados.planoAcao.metasSugeridas?.receita || prev.receita,
        atendimentos: dados.planoAcao.metasSugeridas?.atendimentos || prev.atendimentos,
      }))
    }
  }

  const salvar = async () => {
    setSalvando(true); setErro(''); setSucesso('')
    try {
      await api.put('/api/admin/barbearia/captacao/metas-profissionais', {
        profissionalId: profissional.profissionalId,
        mes,
        receita: form.receita,
        atendimentos: form.atendimentos,
        planoAcao: form.planoAcao,
        diagnostico: dados?.diagnostico?.titulo || '',
        tendenciaObservada: profissional.tendencia || '',
      })
      setSucesso('Metas e plano de ação salvos com sucesso!')
      onSalvo?.()
    } catch (err) {
      setErro(err.message || 'Erro ao salvar metas.')
    } finally {
      setSalvando(false)
    }
  }

  const m = dados?.metricas || profissional
  const corTendencia = profissional.tendencia === 'crescimento' ? '#14b87a' : profissional.tendencia === 'queda' ? '#f59e0b' : '#4a9eff'

  return <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, width: '100%', maxWidth: 780, maxHeight: '92vh', overflowY: 'auto', padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 18, boxShadow: '0 20px 45px rgba(0,0,0,0.45)' }} role="dialog" aria-modal="true" aria-labelledby="modal-prof-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 id="modal-prof-title" style={{ ...title, fontSize: 20 }}>Análise de IA & Plano de Ação: {profissional.nome}</h2>
            <Pill severidade={profissional.tendencia === 'crescimento' ? 'positivo' : profissional.tendencia === 'queda' ? 'alerta' : 'informativo'}>
              Tendência {profissional.tendencia}
            </Pill>
            {profissional.meta?.receita ? <Pill severidade={profissional.noRitmo ? 'positivo' : 'alerta'}>{profissional.noRitmo ? 'No ritmo' : 'Acelerar'}</Pill> : <small style={{ color: 'var(--muted)' }}>Sem meta definida</small>}
          </div>
          <p style={sub}>Competência {mesBR(mes)} · Diagnóstico analítico de produção, tendências e plano de crescimento.</p>
        </div>
        <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 4 }} title="Fechar">✕</button>
      </div>

      <div style={grid(150)}>
        <div style={kpi}><div style={label}>Realizado</div><div style={{ ...value, fontSize: 20 }}>{fmtKpi(m.realizado)}</div><small style={{ color: 'var(--muted)' }}>{m.atendimentosConcluidos || 0} concluídos</small></div>
        <div style={kpi}><div style={label}>Agenda futura</div><div style={{ ...value, fontSize: 20 }}>{fmtKpi(m.agendaFutura)}</div><small style={{ color: 'var(--muted)' }}>{m.atendimentosAgendados || 0} agendados</small></div>
        <div style={kpi}><div style={label}>Projeção final</div><div style={{ ...value, fontSize: 20, color: 'var(--accent)' }}>{fmtKpi(m.projecao)}</div><small style={{ color: 'var(--muted)' }}>Estimativa do mês</small></div>
        <div style={kpi}><div style={label}>Meta cadastrada</div><div style={{ ...value, fontSize: 20 }}>{form.receita ? fmtKpi(form.receita) : '—'}</div><small style={{ color: 'var(--muted)' }}>{form.atendimentos ? `${form.atendimentos} atendimentos` : 'Sem meta de qtd'}</small></div>
        <div style={kpi}><div style={label}>Ticket médio</div><div style={{ ...value, fontSize: 20 }}>{m.ticketMedio ? fmtKpi(m.ticketMedio) : '—'}</div><small style={{ color: 'var(--muted)' }}>Por atendimento</small></div>
        <div style={kpi}><div style={label}>Taxa de ocupação</div><div style={{ ...value, fontSize: 20 }}>{porcentagem(m.ocupacao)}</div><small style={{ color: 'var(--muted)' }}>{horas(m.minutosAgendados)} de {horas(m.capacidadeMinutos)}</small></div>
      </div>

      {carregando ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Gerando diagnóstico inteligente e recomendações com IA…</div> : erro && !dados ? <div style={{ color: '#e05c5c', padding: 12 }}>{erro}</div> : <>
        <div style={{ background: 'var(--card2, var(--card))', border: '1px solid var(--line)', borderLeft: `4px solid ${corTendencia}`, borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🔍</span>
            <strong style={{ fontSize: 15 }}>{dados?.diagnostico?.titulo || 'Diagnóstico da Tendência'}</strong>
          </div>
          <p style={{ ...sub, marginTop: 4 }}>Por que os números mostram essa tendência de faturamento:</p>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {(dados?.diagnostico?.motivos || []).map((motivo, idx) => <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg)' }}>• {motivo.fator}:</span>
              <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.45, paddingLeft: 12 }}>{motivo.detalhe}</span>
            </div>)}
          </div>
        </div>

        <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '16px 18px', background: 'var(--card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🚀</span>
                <strong style={{ fontSize: 15 }}>Sugestão de Plano de Ação para Crescimento</strong>
              </div>
              <p style={{ ...sub, marginTop: 4 }}>Alavancas práticas para o profissional bater e superar a meta na competência.</p>
            </div>
            <button type="button" style={{ ...button, fontSize: 11, padding: '6px 10px', background: 'var(--card2)' }} onClick={usarSugestao} title="Preenche os campos abaixo com a sugestão completa da IA">
              Copiar sugestão para o plano ↵
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 14 }}>
            {(dados?.planoAcao?.alavancas || []).map((alavanca, idx) => <div key={idx} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: 'var(--card2)' }}>
              <strong style={{ display: 'block', fontSize: 13, color: 'var(--accent, #b0892e)' }}>{alavanca.titulo}</strong>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--fg)', lineHeight: 1.45 }}>{alavanca.acao}</p>
              <div style={{ marginTop: 8, fontSize: 11, color: '#14b87a', fontWeight: 700 }}>Impacto: {alavanca.impacto}</div>
            </div>)}
          </div>
        </div>

        <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '16px 18px', background: 'var(--card2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong style={{ fontSize: 15 }}>Ajustar e Complementar Plano de Ação</strong>
              <p style={{ ...sub, marginTop: 3 }}>Liberado para o gestor ajustar metas, detalhar compromissos e complementar o plano acordado com o profissional.</p>
            </div>
            <small style={{ color: 'var(--muted)' }}>Será salvo diretamente nas metas do profissional</small>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--fg)' }}>
              Meta de receita do mês (R$):
              <input
                type="number"
                min="0"
                step="50"
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', font: 'inherit', fontSize: 14 }}
                value={form.receita}
                onChange={(e) => setForm({ ...form, receita: e.target.value })}
                placeholder="Ex: 6000"
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--fg)' }}>
              Meta de atendimentos do mês:
              <input
                type="number"
                min="0"
                step="1"
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', font: 'inherit', fontSize: 14 }}
                value={form.atendimentos}
                onChange={(e) => setForm({ ...form, atendimentos: e.target.value })}
                placeholder="Ex: 85"
              />
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--fg)', marginTop: 14 }}>
            Detalhamento do plano de ação acordado:
            <textarea
              rows={8}
              style={{ padding: 12, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', font: 'inherit', fontSize: 13, lineHeight: 1.5, resize: 'vertical' }}
              value={form.planoAcao}
              onChange={(e) => setForm({ ...form, planoAcao: e.target.value })}
              placeholder="Digite ou ajuste as ações acordadas com o profissional..."
            />
          </label>
        </div>
      </>}

      {sucesso && <div style={{ color: '#14b87a', fontWeight: 700, fontSize: 13, padding: '4px 0' }}>✓ {sucesso}</div>}
      {erro && <div style={{ color: '#e05c5c', fontWeight: 700, fontSize: 13, padding: '4px 0' }}>✕ {erro}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
        <button type="button" style={button} onClick={onClose}>Fechar</button>
        <button type="button" style={button} onClick={usarSugestao} disabled={carregando || salvando}>Restaurar sugestão da IA</button>
        <button type="button" style={buttonPrimary} onClick={salvar} disabled={salvando || carregando}>
          {salvando ? 'Salvando…' : 'Salvar em Metas do Profissional'}
        </button>
      </div>
    </div>
  </div>
}

export default function ProjecaoFaturamentoPanel({ onOpenTab }) {
  const [mes, setMes] = useState(mesAtual)
  const [dados, setDados] = useState(null)
  const [inteligencia, setInteligencia] = useState(null)
  const [alertas, setAlertas] = useState([])
  const [simulacao, setSimulacao] = useState(null)
  const [fatores, setFatores] = useState({ atendimentos: 1, ticket: 1, revenda: 1, ocupacao: 1 })
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [profissionalModal, setProfissionalModal] = useState(null)

  const carregar = useCallback(async (signal, forcar = false) => {
    setCarregando(true); setErro('')
    try {
      const query = `mes=${encodeURIComponent(mes)}&horizonte=6${forcar ? '&forcar=1' : ''}`
      const resultado = await api.get(`/api/admin/barbearia/captacao/projecao-faturamento/inteligencia?${query}`, { signal })
      setDados(resultado.projection || resultado)
      setInteligencia(resultado.inteligencia || null)
      setAlertas(resultado.inteligencia?.alerts || [])
    } catch (e) { if (e.name !== 'AbortError') setErro(e.message || 'Não foi possível carregar a projeção.') }
    finally { if (!signal?.aborted) setCarregando(false) }
  }, [mes])
  useEffect(() => { const controller = new AbortController(); carregar(controller.signal); return () => controller.abort() }, [carregar])
  const atualizar = () => carregar(undefined, true)
  const reconhecer = async (id) => { try { await api.post(`/api/admin/barbearia/captacao/projecao-faturamento/alertas/${id}/reconhecer`, {}); setAlertas((items) => items.map((item) => item.id === id ? { ...item, status: 'acknowledged' } : item)) } catch (e) { setErro(e.message || 'Não foi possível reconhecer o alerta.') } }
  const simular = async () => { try { const resposta = await api.post('/api/admin/barbearia/captacao/projecao-faturamento/simular', { mes, horizonte: 1, fatores }); setSimulacao(resposta.simulacao) } catch (e) { setErro(e.message || 'Não foi possível simular o cenário.') } }

  if (carregando && !dados) return <div style={card} role="status">Calculando projeção e análise gerencial…</div>
  if (erro && !dados) return <div style={card} role="alert">{erro} <button type="button" style={{ ...button, marginLeft: 8 }} onClick={() => carregar()}>Tentar de novo</button></div>
  const atual = dados?.atual || {}
  const qualidade = dados?.qualidade || {}
  const profissionais = (dados?.profissionais || []).filter((item) => item.ativo || item.realizado || item.agendaFutura || item.meta)

  return <div style={{ display: 'grid', gap: 16 }}>
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div><h1 style={{ ...title, fontSize: 22 }}>Projeção inteligente de faturamento</h1><p style={sub}>Estimativa explicável baseada no histórico Avec, nas vendas do Kytto, na sazonalidade e na agenda futura.</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--muted)', fontSize: 13, fontWeight: 700 }}>Competência:
            <input aria-label="Competência" type="month" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', font: 'inherit' }} value={mes} onChange={(event) => setMes(event.target.value)} />
          </label>
          <button type="button" style={button} onClick={atualizar}>Atualizar</button>
        </div>
      </div>
      <div style={{ ...grid(190), marginTop: 16 }}>
        <div style={kpi}><div style={label}>Faturamento realizado</div><div style={value}>{fmtKpi(atual.realizado)}</div><small style={{ color: 'var(--muted)' }}>Serviços {fmtKpi(atual.servicos)} · Revenda {fmtKpi(atual.revenda)}</small></div>
        <div style={kpi}><div style={label}>Receita já reservada na agenda</div><div style={value}>{fmtKpi(atual.agendaFutura)}</div><small style={{ color: 'var(--muted)' }}>{atual.atendimentosAgendados || 0} agendamentos futuros no mês</small></div>
        <div style={kpi}><div style={label}>Projeção de fechamento</div><div style={{ ...value, color: 'var(--accent)' }}>{fmtKpi(atual.projecao)}</div><small style={{ color: 'var(--muted)' }}>Cenário conservador: {fmtKpi(atual.conservador)} · favorável: {fmtKpi(atual.favoravel)}</small></div>
        <div style={kpi}><div style={label}>Meta da equipe</div><div style={value}>{atual.metaReceita ? fmtKpi(atual.metaReceita) : '—'}</div><small style={{ color: 'var(--muted)' }}>{atual.diferencaMeta == null ? 'Sem meta configurada' : atual.diferencaMeta >= 0 ? `+${fmtKpi(atual.diferencaMeta)} acima da meta` : `${fmtKpi(atual.diferencaMeta)} para atingir a meta`}</small></div>
      </div>
    </section>

    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div><h2 style={title}>Cenários para os próximos 6 meses</h2><p style={sub}>Faixa delimitada pelo histórico de variação da barbearia. Não é garantia de faturamento.</p></div>
        <Pill severidade={qualidade.nivel === 'alta' ? 'positivo' : qualidade.nivel === 'media' ? 'informativo' : 'alerta'}>Confiança {qualidade.nivel || 'insuficiente'}</Pill>
      </div>
      <div style={{ marginTop: 14 }}><GraficoPrevisao itens={dados?.previsoes || []} /></div>
    </section>

    <SerieHistorica itens={dados?.historicoCompleto || []} resumo={dados?.resumoHistorico || {}} />

    <AnaliseIa inteligencia={inteligencia} alertas={alertas} onAtualizar={atualizar} onReconhecer={reconhecer} fatores={fatores} setFatores={setFatores} simulacao={simulacao} onSimular={simular} />

    <section style={card}>
      <h2 style={title}>Metodologia e qualidade dos dados</h2>
      <p style={sub}>{dados?.metodologia?.resumo}</p>
      <div style={{ ...grid(200), marginTop: 14 }}>
        <div style={kpi}><div style={label}>Nível de confiança</div><div style={{ ...value, fontSize: 18 }}><Pill severidade={qualidade.nivel === 'alta' ? 'positivo' : qualidade.nivel === 'media' ? 'informativo' : 'alerta'}>{qualidade.nivel || 'insuficiente'}</Pill></div><small style={{ color: 'var(--muted)' }}>{qualidade.mesesComDados || 0} mês(es) com dados</small></div>
        <div style={kpi}><div style={label}>Recebimentos Avec</div><div style={{ ...value, fontSize: 18 }}>{qualidade.fontes?.recebimentosAvec || 0}</div><small style={{ color: 'var(--muted)' }}>Até {qualidade.fontes?.ultimoDiaAvec ? qualidade.fontes.ultimoDiaAvec.split('-').reverse().join('/') : '—'}</small></div>
        <div style={kpi}><div style={label}>Serviços Kytto</div><div style={{ ...value, fontSize: 18 }}>{qualidade.fontes?.servicos || 0}</div><small style={{ color: 'var(--muted)' }}>Concluídos após a virada</small></div>
        <div style={kpi}><div style={label}>Revenda Kytto</div><div style={{ ...value, fontSize: 18 }}>{qualidade.fontes?.revenda || 0}</div><small style={{ color: 'var(--muted)' }}>Produtos pagos</small></div>
      </div>
      {qualidade.explicacao && <p style={{ ...sub, marginTop: 14 }}><strong>Base dos dados:</strong> {qualidade.explicacao} Corte em {qualidade.dataCorte?.split('-').reverse().join('/')}.</p>}
    </section>

    <section style={card}>
      <h2 style={title}>Projeção mês a mês</h2>
      <div style={{ overflowX: 'auto', marginTop: 14 }}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Mês</th>
              <th style={th}>Serviços</th>
              <th style={th}>Revenda</th>
              <th style={th}>Sazonalidade</th>
              <th style={th}>Conservador</th>
              <th style={th}>Projeção base</th>
              <th style={th}>Favorável</th>
              <th style={th}>Meta</th>
            </tr>
          </thead>
          <tbody>
            {(dados?.previsoes || []).map((item) => <tr key={item.mes}>
              <td style={td}><strong>{mesBR(item.mes)}</strong>{item.tipo === 'atual' && <div><Pill>Em curso</Pill></div>}</td>
              <td style={td}>{fmtR(item.projetadoServicos)}</td>
              <td style={td}>{fmtR(item.projetadoRevenda)}</td>
              <td style={td}>{item.sazonalidade?.referencia ? `${item.sazonalidade.fator >= 1 ? '+' : ''}${porcentagem(item.sazonalidade.fator - 1)} (${mesBR(item.sazonalidade.referencia)})` : '—'}</td>
              <td style={td}>{fmtR(item.conservador)}</td>
              <td style={{ ...td, fontWeight: 800 }}>{fmtR(item.projecao)}</td>
              <td style={td}>{fmtR(item.favoravel)}</td>
              <td style={td}>{item.metaReceita ? fmtR(item.metaReceita) : '—'}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>

    <section style={{ ...grid(340), alignItems: 'start' }}>
      <div style={card}>
        <h2 style={title}>O que está influenciando a projeção</h2>
        <p style={sub}>Cada ponto tem uma evidência observável; o painel não atribui causas que não estejam registradas.</p>
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {(dados?.fatores || []).length ? dados.fatores.map((item, index) => <div key={`${item.tipo}-${index}`} style={{ borderLeft: `3px solid ${tom(item.severidade)}`, padding: '8px 0 8px 11px' }}>
            <Pill severidade={item.severidade}>{item.severidade}</Pill>
            <strong style={{ display: 'block', marginTop: 6 }}>{item.titulo}</strong>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>{item.evidencia}</div>
          </div>) : <div style={{ color: 'var(--muted)', padding: 14 }}>Registre mais atendimentos e vendas para receber leituras gerenciais.</div>}
        </div>
      </div>
      <div style={card}>
        <h2 style={title}>Ações recomendadas</h2>
        <p style={sub}>Sugestões não executam cobranças, agendamentos ou mensagens automaticamente.</p>
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {(dados?.acoes || []).length ? dados.acoes.map((acao, index) => <div key={`${acao.aba}-${index}`} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
            <Pill severidade={acao.prioridade === 'alta' ? 'alerta' : 'informativo'}>Prioridade {acao.prioridade}</Pill>
            <strong style={{ display: 'block', marginTop: 7 }}>{acao.titulo}</strong>
            <p style={{ ...sub, marginTop: 4 }}>{acao.descricao}</p>
            {acao.aba && <button type="button" style={{ ...button, marginTop: 9 }} onClick={() => onOpenTab?.(acao.aba)}>Abrir {acao.aba}</button>}
          </div>) : <div style={{ color: 'var(--muted)', padding: 14 }}>Nenhuma ação adicional foi identificada nesta atualização.</div>}
        </div>
      </div>
    </section>

    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div>
          <h2 style={title}>Comparativo por profissional</h2>
          <p style={sub}>Produção atual, agenda, ticket, capacidade, tendência e meta da competência selecionada. <strong>Clique no nome do profissional</strong> para ver a análise profunda de IA (por que da queda ou aumento) e o plano de ação.</p>
        </div>
        <button type="button" style={button} onClick={() => onOpenTab?.('Ocupação e metas')}>Editar metas</button>
      </div>
      <div style={{ overflowX: 'auto', marginTop: 14 }}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Profissional (clique para análise)</th>
              <th style={th}>Realizado</th>
              <th style={th}>Agenda futura</th>
              <th style={th}>Projeção</th>
              <th style={th}>Meta</th>
              <th style={th}>Ticket</th>
              <th style={th}>Ocupação</th>
              <th style={th}>Tendência</th>
            </tr>
          </thead>
          <tbody>
            {profissionais.length ? profissionais.map((item) => <tr key={item.profissionalId} style={{ cursor: 'pointer' }} onClick={() => setProfissionalModal(item)}>
              <td style={td}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setProfissionalModal(item); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    textAlign: 'left',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'inherit',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  title="Clique para ver análise profunda de IA e plano de ação"
                >
                  <strong style={{ color: 'var(--accent, #b0892e)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                    {item.nome}
                  </strong>
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--fg)', background: 'var(--line)', padding: '2px 5px', borderRadius: 4 }}>
                    IA ↗
                  </span>
                </button>
                {item.meta?.receita ? <div style={{ marginTop: 4 }}><Pill severidade={item.noRitmo ? 'positivo' : 'alerta'}>{item.noRitmo ? 'No ritmo' : 'Acelerar'}</Pill></div> : <small style={{ display: 'block', color: 'var(--muted)', marginTop: 4 }}>Sem meta</small>}
              </td>
              <td style={td}>{fmtR(item.realizado)}<small style={{ display: 'block', color: 'var(--muted)' }}>{item.atendimentosConcluidos} atend.</small></td>
              <td style={td}>{fmtR(item.agendaFutura)}<small style={{ display: 'block', color: 'var(--muted)' }}>{item.atendimentosAgendados} atend.</small></td>
              <td style={{ ...td, fontWeight: 800 }}>{fmtR(item.projecao)}</td>
              <td style={td}>{item.meta?.receita ? fmtR(item.meta.receita) : '—'}</td>
              <td style={td}>{item.ticketMedio ? fmtR(item.ticketMedio) : '—'}</td>
              <td style={td}>{porcentagem(item.ocupacao)}<small style={{ display: 'block', color: 'var(--muted)' }}>{horas(item.minutosAgendados)} de {horas(item.capacidadeMinutos)}</small></td>
              <td style={td}><Pill severidade={item.tendencia === 'crescimento' ? 'positivo' : item.tendencia === 'queda' ? 'alerta' : 'informativo'}>{item.tendencia}</Pill></td>
            </tr>) : <tr><td colSpan="8" style={{ ...td, textAlign: 'center', color: 'var(--muted)' }}>Cadastre profissionais e conclua atendimentos para comparar produção.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    {profissionalModal && <ModalAnaliseProfissional
      profissional={profissionalModal}
      mes={mes}
      onClose={() => setProfissionalModal(null)}
      onSalvo={() => { carregar(); }}
    />}

    {erro && <div style={{ ...card, borderColor: '#f59e0b', color: 'var(--muted)' }} role="alert">A última atualização falhou: {erro} <button type="button" style={{ ...button, marginLeft: 8 }} onClick={() => carregar()}>Tentar novamente</button></div>}
  </div>
}

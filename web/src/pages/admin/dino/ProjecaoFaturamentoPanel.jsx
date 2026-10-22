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
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date(Date.UTC(ano, numero - 1, 1))).replace('.', '')
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
      {[0, 0.5, 1].map((fracao) => <g key={fracao}><line x1={pontos.lateral} x2={pontos.largura - pontos.lateral} y1={pontos.superior + (pontos.altura - pontos.superior - pontos.inferior) * fracao} y2={pontos.superior + (pontos.altura - pontos.superior - pontos.inferior) * fracao} stroke="var(--line)" strokeWidth="1" /><text x="2" y={pontos.superior + (pontos.altura - pontos.superior - pontos.inferior) * fracao + 4} fill="var(--muted)" fontSize="10">{fmtR(pontos.maximo * (1 - fracao))}</text></g>)}
      <polygon points={faixa} fill="rgba(74, 158, 255, .12)" />
      <polyline points={linha('conservador')} fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="5 4" />
      <polyline points={linha('favoravel')} fill="none" stroke="#14b87a" strokeWidth="2" strokeDasharray="5 4" />
      <polyline points={linha('projecao')} fill="none" stroke="var(--accent)" strokeWidth="3" />
      {pontos.dados.map((item, indice) => <g key={item.mes}><circle cx={pontos.x(indice)} cy={pontos.y(item.projecao)} r="4" fill="var(--accent)" /><text x={pontos.x(indice)} y={pontos.altura - 9} textAnchor="middle" fill="var(--muted)" fontSize="11">{mesBR(item.mes)}</text></g>)}
    </svg>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: '0 4px', color: 'var(--muted)', fontSize: 12 }}><span><b style={{ color: 'var(--accent)' }}>—</b> cenário base</span><span><b style={{ color: '#f59e0b' }}>- -</b> conservador</span><span><b style={{ color: '#14b87a' }}>- -</b> favorável</span></div>
  </div>
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

export default function ProjecaoFaturamentoPanel({ onOpenTab }) {
  const [mes, setMes] = useState(mesAtual)
  const [dados, setDados] = useState(null)
  const [inteligencia, setInteligencia] = useState(null)
  const [alertas, setAlertas] = useState([])
  const [simulacao, setSimulacao] = useState(null)
  const [fatores, setFatores] = useState({ atendimentos: 1, ticket: 1, revenda: 1, ocupacao: 1 })
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
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
  const corMeta = atual.noRitmo === true ? '#14b87a' : atual.noRitmo === false ? '#f59e0b' : 'var(--fg)'
  return <div style={{ display: 'grid', gap: 16 }}>
    <section style={card}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}><div><h2 style={title}>Projeção inteligente de faturamento</h2><p style={sub}>Leitura explicável de serviços concluídos, revenda paga, agenda futura e histórico. A previsão é apoio à decisão; não é garantia de faturamento.</p></div><div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}><label style={{ display: 'grid', gap: 4, color: 'var(--muted)', fontSize: 12 }}>Competência<input type="month" value={mes} onChange={(event) => setMes(event.target.value)} style={{ ...button, padding: '8px 10px' }} /></label><button type="button" style={button} onClick={() => carregar()}>Atualizar</button></div></div><div style={{ ...grid(155), marginTop: 16 }}><div style={kpi}><div style={label}>Realizado</div><div style={value}>{fmtR(atual.realizado)}</div><small style={{ color: 'var(--muted)' }}>{fmtR(atual.servicos)} serviços · {fmtR(atual.revenda)} revenda</small></div><div style={kpi}><div style={label}>Projeção de fechamento</div><div style={value}>{fmtR(atual.projecao)}</div><small style={{ color: 'var(--muted)' }}>{fmtR(atual.agendaFutura)} já na agenda</small></div><div style={kpi}><div style={label}>Meta da equipe</div><div style={{ ...value, color: corMeta }}>{atual.metaReceita ? fmtR(atual.metaReceita) : 'Não definida'}</div><small style={{ color: 'var(--muted)' }}>{atual.metaReceita ? (atual.noRitmo ? 'No ritmo projetado' : `${fmtR(Math.abs(atual.diferencaMeta || 0))} de diferença`) : 'Defina metas por profissional'}</small></div><div style={kpi}><div style={label}>Qualidade da previsão</div><div style={{ ...value, fontSize: 20 }}>{qualidade.rotulo || '—'}</div><small style={{ color: 'var(--muted)' }}>{qualidade.mesesComDados || 0} mês(es) com dados</small></div></div>{qualidade.explicacao && <p style={{ ...sub, marginTop: 14 }}><strong>Base dos dados:</strong> {qualidade.explicacao} Corte em {qualidade.dataCorte?.split('-').reverse().join('/')}.</p>}</section>
    <AnaliseIa inteligencia={inteligencia} alertas={alertas} onAtualizar={atualizar} onReconhecer={reconhecer} fatores={fatores} setFatores={setFatores} simulacao={simulacao} onSimular={simular} />
    <section style={card}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}><div><h2 style={title}>Cenários dos próximos seis meses</h2><p style={sub}>A faixa mostra a variação observada no histórico. O cenário base considera a tendência recente e a agenda já reservada.</p></div><Pill severidade={qualidade.nivel === 'alta' ? 'positivo' : qualidade.nivel === 'insuficiente' ? 'alerta' : 'informativo'}>{qualidade.rotulo || 'Em análise'}</Pill></div><div style={{ marginTop: 14 }}><GraficoPrevisao itens={dados?.previsoes || []} /></div><div style={{ overflowX: 'auto', marginTop: 16 }}><table style={table}><thead><tr><th style={th}>Mês</th><th style={th}>Serviços</th><th style={th}>Revenda</th><th style={th}>Conservador</th><th style={th}>Base</th><th style={th}>Favorável</th><th style={th}>Meta</th></tr></thead><tbody>{(dados?.previsoes || []).map((item) => <tr key={item.mes}><td style={td}><strong>{mesBR(item.mes)}</strong>{item.tipo === 'atual' && <div><Pill>Em curso</Pill></div>}</td><td style={td}>{fmtR(item.projetadoServicos)}</td><td style={td}>{fmtR(item.projetadoRevenda)}</td><td style={td}>{fmtR(item.conservador)}</td><td style={{ ...td, fontWeight: 800 }}>{fmtR(item.projecao)}</td><td style={td}>{fmtR(item.favoravel)}</td><td style={td}>{item.metaReceita ? fmtR(item.metaReceita) : '—'}</td></tr>)}</tbody></table></div></section>
    <section style={{ ...grid(340), alignItems: 'start' }}><div style={card}><h2 style={title}>O que está influenciando a projeção</h2><p style={sub}>Cada ponto tem uma evidência observável; o painel não atribui causas que não estejam registradas.</p><div style={{ display: 'grid', gap: 10, marginTop: 14 }}>{(dados?.fatores || []).length ? dados.fatores.map((item, index) => <div key={`${item.tipo}-${index}`} style={{ borderLeft: `3px solid ${tom(item.severidade)}`, padding: '8px 0 8px 11px' }}><Pill severidade={item.severidade}>{item.severidade}</Pill><strong style={{ display: 'block', marginTop: 6 }}>{item.titulo}</strong><div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>{item.evidencia}</div></div>) : <div style={{ color: 'var(--muted)', padding: 14 }}>Registre mais atendimentos e vendas para receber leituras gerenciais.</div>}</div></div><div style={card}><h2 style={title}>Ações recomendadas</h2><p style={sub}>Sugestões não executam cobranças, agendamentos ou mensagens automaticamente.</p><div style={{ display: 'grid', gap: 10, marginTop: 14 }}>{(dados?.acoes || []).length ? dados.acoes.map((acao, index) => <div key={`${acao.aba}-${index}`} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}><Pill severidade={acao.prioridade === 'alta' ? 'alerta' : 'informativo'}>Prioridade {acao.prioridade}</Pill><strong style={{ display: 'block', marginTop: 7 }}>{acao.titulo}</strong><p style={{ ...sub, marginTop: 4 }}>{acao.descricao}</p>{acao.aba && <button type="button" style={{ ...button, marginTop: 9 }} onClick={() => onOpenTab?.(acao.aba)}>Abrir {acao.aba}</button>}</div>) : <div style={{ color: 'var(--muted)', padding: 14 }}>Nenhuma ação adicional foi identificada nesta atualização.</div>}</div></div></section>
    <section style={card}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}><div><h2 style={title}>Comparativo por profissional</h2><p style={sub}>Produção atual, agenda, ticket, capacidade, tendência e meta da competência selecionada.</p></div><button type="button" style={button} onClick={() => onOpenTab?.('Ocupação e metas')}>Editar metas</button></div><div style={{ overflowX: 'auto', marginTop: 14 }}><table style={table}><thead><tr><th style={th}>Profissional</th><th style={th}>Realizado</th><th style={th}>Agenda futura</th><th style={th}>Projeção</th><th style={th}>Meta</th><th style={th}>Ticket</th><th style={th}>Ocupação</th><th style={th}>Tendência</th></tr></thead><tbody>{profissionais.length ? profissionais.map((item) => <tr key={item.profissionalId}><td style={td}><strong>{item.nome}</strong>{item.meta?.receita ? <div style={{ marginTop: 4 }}><Pill severidade={item.noRitmo ? 'positivo' : 'alerta'}>{item.noRitmo ? 'No ritmo' : 'Acelerar'}</Pill></div> : <small style={{ display: 'block', color: 'var(--muted)', marginTop: 4 }}>Sem meta</small>}</td><td style={td}>{fmtR(item.realizado)}<small style={{ display: 'block', color: 'var(--muted)' }}>{item.atendimentosConcluidos} atend.</small></td><td style={td}>{fmtR(item.agendaFutura)}<small style={{ display: 'block', color: 'var(--muted)' }}>{item.atendimentosAgendados} atend.</small></td><td style={{ ...td, fontWeight: 800 }}>{fmtR(item.projecao)}</td><td style={td}>{item.meta?.receita ? fmtR(item.meta.receita) : '—'}</td><td style={td}>{item.ticketMedio ? fmtR(item.ticketMedio) : '—'}</td><td style={td}>{porcentagem(item.ocupacao)}<small style={{ display: 'block', color: 'var(--muted)' }}>{horas(item.minutosAgendados)} de {horas(item.capacidadeMinutos)}</small></td><td style={td}><Pill severidade={item.tendencia === 'crescimento' ? 'positivo' : item.tendencia === 'queda' ? 'alerta' : 'informativo'}>{item.tendencia}</Pill></td></tr>) : <tr><td colSpan="8" style={{ ...td, textAlign: 'center', color: 'var(--muted)' }}>Cadastre profissionais e conclua atendimentos para comparar produção.</td></tr>}</tbody></table></div></section>
    {erro && <div style={{ ...card, borderColor: '#f59e0b', color: 'var(--muted)' }} role="alert">A última atualização falhou: {erro} <button type="button" style={{ ...button, marginLeft: 8 }} onClick={() => carregar()}>Tentar novamente</button></div>}
  </div>
}

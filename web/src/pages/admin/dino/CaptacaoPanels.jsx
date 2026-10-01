// Painéis de captação e retenção da barbearia (onda 1): retorno previsto,
// lista de espera, indicações, saúde do clube e ocupação/metas por barbeiro.
// Todos leem /api/admin/barbearia/captacao/* da empresa da sessão.
import { useCallback, useEffect, useState } from 'react'
import { api, fmtR } from '../../../lib/api'
import { useToast } from '../../../hooks/useToast'

const card = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 20 }
const grid = (min = 180) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 })
const kpi = { background: 'var(--card2, var(--card))', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px' }
const kpiLabel = { fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }
const kpiValue = { fontSize: 26, fontWeight: 800, marginTop: 6, fontFamily: 'var(--font-display)' }
const h2 = { margin: 0, fontSize: 18, fontFamily: 'var(--font-display)' }
const sub = { margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }
const table = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const th = { textAlign: 'left', padding: '8px 10px', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--line)' }
const td = { padding: '10px', borderBottom: '1px solid var(--line)', verticalAlign: 'top' }
const btn = { padding: '8px 12px', borderRadius: 9, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 700 }
const btnPrimary = { ...btn, background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
const input = { padding: '8px 10px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', font: 'inherit', fontSize: 13 }
const empty = { padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }

function pct(valor) { return `${(Number(valor || 0) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` }
function dataBR(valor) { return valor ? String(valor).slice(0, 10).split('-').reverse().join('/') : '—' }
function Pill({ children, tom = 'neutro' }) {
  const cores = { bom: '#14b87a', alerta: '#f59e0b', critico: '#e05c5c', neutro: 'var(--muted)' }
  return <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 800, color: cores[tom], border: `1px solid ${cores[tom]}` }}>{children}</span>
}

function useCarregar(rota) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try { setDados(await api.get(rota)) } catch (e) { setErro(e.message || 'Não foi possível carregar.') } finally { setCarregando(false) }
  }, [rota])
  useEffect(() => { carregar() }, [carregar])
  return { dados, erro, carregando, carregar }
}

function Estado({ carregando, erro, onRetry }) {
  if (carregando) return <div style={empty} role="status">Carregando…</div>
  if (erro) return <div style={empty} role="alert">{erro} <button type="button" style={btn} onClick={onRetry}>Tentar de novo</button></div>
  return null
}

const SITUACAO = { atrasado: ['Atrasado', 'critico'], esta_semana: ['Volta esta semana', 'alerta'], agendado: ['Já agendado', 'bom'], no_prazo: ['No prazo', 'neutro'] }

export function RetornosPanel() {
  const { dados, erro, carregando, carregar } = useCarregar('/api/admin/barbearia/captacao/retornos')
  const [filtro, setFiltro] = useState('acionaveis')
  if (carregando || erro) return <div style={card}><Estado carregando={carregando} erro={erro} onRetry={carregar} /></div>
  const resumo = dados?.resumo || {}
  const lista = filtro === 'acionaveis' ? (dados?.acionaveis || []) : (dados?.todos || [])
  return <div style={{ display: 'grid', gap: 16 }}>
    <div style={card}>
      <h2 style={h2}>Retorno previsto</h2>
      <p style={sub}>Cada cliente com duas ou mais visitas tem um intervalo habitual. Quem passou da data é o primeiro a receber um convite, com o próximo horário livre do barbeiro preferido.</p>
      <div style={{ ...grid(160), marginTop: 14 }}>
        <div style={kpi}><div style={kpiLabel}>Com histórico</div><div style={kpiValue}>{resumo.clientesComHistorico || 0}</div></div>
        <div style={kpi}><div style={kpiLabel}>Atrasados</div><div style={{ ...kpiValue, color: '#e05c5c' }}>{resumo.atrasados || 0}</div></div>
        <div style={kpi}><div style={kpiLabel}>Voltam esta semana</div><div style={{ ...kpiValue, color: '#f59e0b' }}>{resumo.estaSemana || 0}</div></div>
        <div style={kpi}><div style={kpiLabel}>Já agendados</div><div style={{ ...kpiValue, color: '#14b87a' }}>{resumo.agendados || 0}</div></div>
      </div>
    </div>
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <strong>{filtro === 'acionaveis' ? 'Para chamar agora' : 'Todos os clientes com histórico'}</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={filtro === 'acionaveis' ? btnPrimary : btn} onClick={() => setFiltro('acionaveis')}>Para chamar</button>
          <button type="button" style={filtro === 'todos' ? btnPrimary : btn} onClick={() => setFiltro('todos')}>Todos</button>
        </div>
      </div>
      {lista.length === 0 ? <div style={empty}>Ninguém para chamar agora. A lista aparece quando houver clientes com duas visitas concluídas ou mais.</div> : <div style={{ overflowX: 'auto' }}><table style={table}>
        <thead><tr><th style={th}>Cliente</th><th style={th}>Hábito</th><th style={th}>Última visita</th><th style={th}>Retorno previsto</th><th style={th}>Situação</th><th style={th}>Sugestão</th></tr></thead>
        <tbody>{lista.map((item) => {
          const [rotulo, tom] = SITUACAO[item.situacao] || ['—', 'neutro']
          return <tr key={`${item.clienteId}-${item.nome}`}>
            <td style={td}><strong>{item.nome}</strong><div style={{ color: 'var(--muted)', fontSize: 12 }}>{item.visitas} visitas · {item.servicoPreferido?.nome || '—'}</div></td>
            <td style={td}>a cada {item.intervaloHabitualDias} dias</td>
            <td style={td}>{dataBR(item.ultimaVisita)}</td>
            <td style={td}>{dataBR(item.retornoPrevisto)}{item.diasAtraso > 0 && <div style={{ color: '#e05c5c', fontSize: 12 }}>{item.diasAtraso} dias de atraso</div>}</td>
            <td style={td}><Pill tom={tom}>{rotulo}</Pill></td>
            <td style={td}>{item.sugestao ? `${dataBR(item.sugestao.data)} às ${item.sugestao.horario}${item.profissionalPreferido ? ` com ${item.profissionalPreferido.nome}` : ''}` : '—'}</td>
          </tr>
        })}</tbody>
      </table></div>}
    </div>
  </div>
}

const STATUS_ESPERA = { aguardando: ['Aguardando', 'alerta'], agendado: ['Agendado', 'bom'], desistiu: ['Desistiu', 'neutro'], expirado: ['Expirado', 'neutro'] }

export function ListaEsperaPanel() {
  const { toast } = useToast()
  const { dados, erro, carregando, carregar } = useCarregar('/api/admin/barbearia/captacao/lista-espera')
  const [ocupado, setOcupado] = useState('')
  async function mudar(item, status) {
    setOcupado(item.id)
    try { await api.patch(`/api/admin/barbearia/captacao/lista-espera/${encodeURIComponent(item.id)}/status`, { status }); toast('Lista de espera atualizada.', 'success'); carregar() } catch (e) { toast(e.message, 'error') } finally { setOcupado('') }
  }
  if (carregando || erro) return <div style={card}><Estado carregando={carregando} erro={erro} onRetry={carregar} /></div>
  const itens = dados?.itens || []
  const aguardando = itens.filter((item) => item.status === 'aguardando')
  return <div style={card}>
    <h2 style={h2}>Lista de espera da agenda</h2>
    <p style={sub}>Quem não achou horário no link público entra aqui. Quando um horário é cancelado, quem pediu aquele dia e período recebe o aviso no WhatsApp (só com consentimento).</p>
    <div style={{ ...grid(160), margin: '14px 0' }}>
      <div style={kpi}><div style={kpiLabel}>Aguardando</div><div style={kpiValue}>{aguardando.length}</div></div>
      <div style={kpi}><div style={kpiLabel}>Avisados de vaga</div><div style={kpiValue}>{itens.filter((item) => (item.avisos || []).length).length}</div></div>
      <div style={kpi}><div style={kpiLabel}>Viraram agendamento</div><div style={kpiValue}>{itens.filter((item) => item.status === 'agendado').length}</div></div>
    </div>
    {itens.length === 0 ? <div style={empty}>Ninguém na lista de espera.</div> : <div style={{ overflowX: 'auto' }}><table style={table}>
      <thead><tr><th style={th}>Dia</th><th style={th}>Cliente</th><th style={th}>Serviço</th><th style={th}>Período</th><th style={th}>WhatsApp</th><th style={th}>Avisos</th><th style={th}>Status</th><th style={th} /></tr></thead>
      <tbody>{itens.map((item) => {
        const [rotulo, tom] = STATUS_ESPERA[item.status] || ['—', 'neutro']
        return <tr key={item.id}>
          <td style={td}>{dataBR(item.data)}</td>
          <td style={td}><strong>{item.nome}</strong><div style={{ color: 'var(--muted)', fontSize: 12 }}>{item.telefone}</div></td>
          <td style={td}>{item.servicoNome}</td>
          <td style={td}>{{ manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }[item.periodo] || 'Qualquer'}</td>
          <td style={td}>{item.consentimentoWhatsapp ? <Pill tom="bom">Autorizado</Pill> : <Pill>Sem consentimento</Pill>}</td>
          <td style={td}>{(item.avisos || []).length ? (item.avisos || []).map((aviso) => aviso.horaLocal).join(', ') : '—'}</td>
          <td style={td}><Pill tom={tom}>{rotulo}</Pill></td>
          <td style={td}>{item.status === 'aguardando' && <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" style={btn} disabled={ocupado === item.id} onClick={() => mudar(item, 'agendado')}>Agendou</button>
            <button type="button" style={btn} disabled={ocupado === item.id} onClick={() => mudar(item, 'desistiu')}>Desistiu</button>
          </div>}</td>
        </tr>
      })}</tbody>
    </table></div>}
  </div>
}

export function IndicacoesPanel({ clientes = [] }) {
  const { toast } = useToast()
  const { dados, erro, carregando, carregar } = useCarregar('/api/admin/barbearia/captacao/indicacoes')
  const [clienteId, setClienteId] = useState('')
  const [link, setLink] = useState(null)
  const [config, setConfig] = useState(null)
  useEffect(() => { if (dados?.configuracao) setConfig(dados.configuracao) }, [dados])
  async function gerarLink() {
    if (!clienteId) return
    try {
      const resposta = await api.get(`/api/admin/barbearia/captacao/clientes/${encodeURIComponent(clienteId)}/indicacao`)
      setLink({ ...resposta, url: `${window.location.origin}${resposta.link}` })
    } catch (e) { toast(e.message, 'error') }
  }
  async function salvarConfig(event) {
    event.preventDefault()
    if (String(config.pontosIndicador).trim() === '' || String(config.pontosIndicado).trim() === '') { toast('Informe os pontos de quem indica e do indicado.', 'error'); return }
    try { await api.put('/api/admin/barbearia/captacao/configuracao', config); toast('Recompensas salvas.', 'success'); carregar() } catch (e) { toast(e.message, 'error') }
  }
  if (carregando || erro) return <div style={card}><Estado carregando={carregando} erro={erro} onRetry={carregar} /></div>
  const ativos = clientes.filter((item) => !item.padrao && item.status !== 'deletado')
  return <div style={{ display: 'grid', gap: 16 }}>
    <div style={card}>
      <h2 style={h2}>Indique um amigo</h2>
      <p style={sub}>Cada cliente tem um link próprio. Quando o amigo indicado conclui o primeiro atendimento, os dois ganham pontos de fidelidade automaticamente.</p>
      <div style={{ ...grid(160), margin: '14px 0' }}>
        <div style={kpi}><div style={kpiLabel}>Indicações</div><div style={kpiValue}>{dados?.total || 0}</div></div>
        <div style={kpi}><div style={kpiLabel}>Viraram cliente</div><div style={kpiValue}>{dados?.convertidas || 0}</div></div>
        <div style={kpi}><div style={kpiLabel}>Conversão</div><div style={kpiValue}>{dados?.total ? pct(dados.convertidas / dados.total) : '—'}</div></div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label htmlFor="indicacao-cliente" style={{ fontSize: 13, color: 'var(--muted)' }}>Link do cliente</label>
        <select id="indicacao-cliente" style={{ ...input, minWidth: 240 }} value={clienteId} onChange={(e) => { setClienteId(e.target.value); setLink(null) }}>
          <option value="">Selecione um cliente</option>
          {ativos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
        <button type="button" style={btnPrimary} disabled={!clienteId} onClick={gerarLink}>Gerar link</button>
      </div>
      {link && <div style={{ marginTop: 12, padding: 12, border: '1px dashed var(--line)', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <code style={{ fontSize: 13, wordBreak: 'break-all' }}>{link.url}</code>
        <button type="button" style={btn} onClick={() => { navigator.clipboard?.writeText(link.url); toast('Link copiado.', 'success') }}>Copiar</button>
      </div>}
    </div>
    {config && <form onSubmit={salvarConfig} style={{ ...card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>Pontos para quem indica<input type="number" min="0" style={input} value={config.pontosIndicador} onChange={(e) => setConfig((c) => ({ ...c, pontosIndicador: e.target.value }))} /></label>
      <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>Pontos para o indicado<input type="number" min="0" style={input} value={config.pontosIndicado} onChange={(e) => setConfig((c) => ({ ...c, pontosIndicado: e.target.value }))} /></label>
      <button type="submit" style={btnPrimary}>Salvar recompensas</button>
    </form>}
    <div style={card}>
      <strong>Quem mais traz clientes</strong>
      {(dados?.ranking || []).length === 0 ? <div style={empty}>Nenhuma indicação ainda.</div> : <table style={{ ...table, marginTop: 10 }}>
        <thead><tr><th style={th}>Cliente</th><th style={th}>Indicações</th><th style={th}>Convertidas</th><th style={th}>Pontos ganhos</th></tr></thead>
        <tbody>{dados.ranking.map((item) => <tr key={item.clienteId}><td style={td}><strong>{item.nome}</strong></td><td style={td}>{item.indicacoes}</td><td style={td}>{item.convertidas}</td><td style={td}>{item.pontos}</td></tr>)}</tbody>
      </table>}
    </div>
  </div>
}

const ALERTAS = { inadimplente: ['Pagamento em atraso', 'critico'], sem_pagamento: ['Sem pagamento confirmado', 'alerta'], sem_uso_risco_cancelamento: ['Sem uso: risco de cancelar', 'alerta'], uso_acima_da_mensalidade: ['Uso acima da mensalidade', 'alerta'] }

export function ClubeSaudePanel() {
  const { toast } = useToast()
  const { dados, erro, carregando, carregar } = useCarregar('/api/admin/barbearia/captacao/clube')
  const [pagando, setPagando] = useState('')
  async function registrarPagamento(item) {
    if (!window.confirm(`Confirmar o recebimento de ${fmtR(item.mensalidade)} de ${item.clienteNome} para este ciclo?`)) return
    setPagando(item.assinaturaId)
    try { await api.post(`/api/admin/barbearia/captacao/assinaturas/${encodeURIComponent(item.assinaturaId)}/pagamentos`, { confirmado: true, valor: item.mensalidade, meio: 'pix' }); toast('Pagamento do ciclo registrado.', 'success'); carregar() } catch (e) { toast(e.message, 'error') } finally { setPagando('') }
  }
  if (carregando || erro) return <div style={card}><Estado carregando={carregando} erro={erro} onRetry={carregar} /></div>
  const saude = dados?.saude || {}
  const candidatos = dados?.candidatos?.candidatos || []
  return <div style={{ display: 'grid', gap: 16 }}>
    <div style={card}>
      <h2 style={h2}>Saúde do clube de assinatura</h2>
      <p style={sub}>Uso de cada assinante contra a mensalidade. O uso é descontado quando o atendimento do assinante é concluído; inadimplente não consome o plano.</p>
      <div style={{ ...grid(150), marginTop: 14 }}>
        <div style={kpi}><div style={kpiLabel}>Assinantes ativos</div><div style={kpiValue}>{saude.assinantesAtivos || 0}</div></div>
        <div style={kpi}><div style={kpiLabel}>Receita recorrente (mês)</div><div style={kpiValue}>{fmtR(saude.mrr || 0)}</div></div>
        <div style={kpi}><div style={kpiLabel}>Uso médio no ciclo</div><div style={kpiValue}>{Number(saude.usoMedioPorAssinante || 0).toLocaleString('pt-BR')}</div></div>
        <div style={kpi}><div style={kpiLabel}>Em atraso</div><div style={{ ...kpiValue, color: saude.inadimplentes ? '#e05c5c' : undefined }}>{saude.inadimplentes || 0}</div></div>
        <div style={kpi}><div style={kpiLabel}>Risco de cancelar</div><div style={{ ...kpiValue, color: saude.emRisco ? '#f59e0b' : undefined }}>{saude.emRisco || 0}</div></div>
      </div>
    </div>
    <div style={card}>
      <strong>Assinantes</strong>
      {(saude.itens || []).length === 0 ? <div style={empty}>Nenhuma assinatura ativa. Crie um plano em Planos e assinaturas.</div> : <div style={{ overflowX: 'auto' }}><table style={{ ...table, marginTop: 10 }}>
        <thead><tr><th style={th}>Cliente</th><th style={th}>Plano</th><th style={th}>Uso no ciclo</th><th style={th}>Valor avulso usado</th><th style={th}>Margem do ciclo</th><th style={th}>Alertas</th><th style={th} /></tr></thead>
        <tbody>{saude.itens.map((item) => <tr key={item.assinaturaId}>
          <td style={td}><strong>{item.clienteNome}</strong></td>
          <td style={td}>{item.plano}<div style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtR(item.mensalidade)}</div></td>
          <td style={td}>{item.usosNoCiclo} de {item.limiteNoCiclo}</td>
          <td style={td}>{fmtR(item.valorAvulsoConsumido)}</td>
          <td style={{ ...td, color: item.margemCiclo < 0 ? '#e05c5c' : undefined, fontWeight: 700 }}>{fmtR(item.margemCiclo)}</td>
          <td style={td}><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{item.alertas.length ? item.alertas.map((alerta) => <Pill key={alerta} tom={(ALERTAS[alerta] || [])[1]}>{(ALERTAS[alerta] || [alerta])[0]}</Pill>) : <Pill tom="bom">Saudável</Pill>}</div></td>
          <td style={td}>{item.status === 'ativa' && <button type="button" style={['inadimplente', 'aguardando_pagamento'].includes(item.situacaoPagamento) ? btnPrimary : btn} disabled={pagando === item.assinaturaId} onClick={() => registrarPagamento(item)}>Registrar pagamento do ciclo</button>}{item.pagoAte && <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>Pago até {dataBR(item.pagoAte)}</div>}</td>
        </tr>)}</tbody>
      </table></div>}
    </div>
    <div style={card}>
      <strong>Candidatos ao clube</strong>
      <p style={sub}>Clientes sem plano que gastaram nos últimos 60 dias mais do que pagariam no plano mais barato. É a lista para oferecer o clube no balcão ou no WhatsApp.</p>
      {candidatos.length === 0 ? <div style={empty}>{dados?.candidatos?.planoReferencia ? 'Nenhum cliente gasta hoje mais do que o plano mais barato.' : 'Cadastre um plano para ver os candidatos.'}</div> : <table style={{ ...table, marginTop: 10 }}>
        <thead><tr><th style={th}>Cliente</th><th style={th}>Visitas</th><th style={th}>Gasto médio por mês</th><th style={th}>Plano sugerido</th><th style={th}>Economia por mês</th></tr></thead>
        <tbody>{candidatos.map((item) => <tr key={`${item.clienteId}-${item.nome}`}><td style={td}><strong>{item.nome}</strong></td><td style={td}>{item.visitas}</td><td style={td}>{fmtR(item.gastoMensalAvulso)}</td><td style={td}>{item.planoSugerido.nome}<div style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtR(item.planoSugerido.mensal)}</div></td><td style={{ ...td, color: '#14b87a', fontWeight: 800 }}>{fmtR(item.economiaMensal)}</td></tr>)}</tbody>
      </table>}
    </div>
  </div>
}

function mesAtual() {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
}

export function OcupacaoMetasPanel() {
  const { toast } = useToast()
  const [mes, setMesBruto] = useState(mesAtual())
  const { dados, erro, carregando, carregar } = useCarregar(`/api/admin/barbearia/captacao/metas-profissionais?mes=${mes}`)
  const [edicao, setEdicao] = useState({})
  // Trocar de mês descarta metas em edição (senão seriam salvas no mês errado).
  const setMes = (valor) => { setEdicao({}); setMesBruto(valor) }
  async function salvar(profissionalId) {
    const meta = edicao[profissionalId] || {}
    try { await api.put('/api/admin/barbearia/captacao/metas-profissionais', { profissionalId, mes, receita: Number(meta.receita || 0), atendimentos: Number(meta.atendimentos || 0) }); toast('Meta salva.', 'success'); setEdicao((e) => ({ ...e, [profissionalId]: undefined })); carregar() } catch (e) { toast(e.message, 'error') }
  }
  const linhas = dados?.profissionais || []
  const capacidade = linhas.reduce((s, item) => s + item.capacidadeMinutos, 0)
  const agendados = linhas.reduce((s, item) => s + item.minutosAgendados, 0)
  return <div style={{ display: 'grid', gap: 16 }}>
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><h2 style={h2}>Ocupação da agenda e metas por barbeiro</h2><p style={sub}>Ocupação = minutos agendados ÷ jornada disponível no mês (dias de funcionamento, jornada do barbeiro e feriados). A projeção usa o ritmo do mês até hoje.</p></div>
        <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>Mês<input type="month" style={input} value={mes} onChange={(e) => setMes(e.target.value)} /></label>
      </div>
      {!carregando && !erro && <div style={{ ...grid(160), marginTop: 14 }}>
        <div style={kpi}><div style={kpiLabel}>Ocupação geral</div><div style={kpiValue}>{capacidade ? pct(agendados / capacidade) : '—'}</div></div>
        <div style={kpi}><div style={kpiLabel}>Horas agendadas</div><div style={kpiValue}>{Math.round(agendados / 60)}h</div></div>
        <div style={kpi}><div style={kpiLabel}>Horas disponíveis</div><div style={kpiValue}>{Math.round(capacidade / 60)}h</div></div>
      </div>}
    </div>
    <div style={card}>
      {(carregando || erro) ? <Estado carregando={carregando} erro={erro} onRetry={carregar} /> : linhas.length === 0 ? <div style={empty}>Cadastre a equipe para ver a ocupação.</div> : <div style={{ overflowX: 'auto' }}><table style={table}>
        <thead><tr><th style={th}>Barbeiro</th><th style={th}>Ocupação</th><th style={th}>Concluídos</th><th style={th}>Receita</th><th style={th}>Meta de receita</th><th style={th}>Projeção</th><th style={th}>Meta de atendimentos</th><th style={th} /></tr></thead>
        <tbody>{linhas.map((item) => {
          const emEdicao = edicao[item.profissionalId]
          return <tr key={item.profissionalId}>
            <td style={td}><strong>{item.nome}</strong></td>
            <td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div aria-hidden="true" style={{ width: 80, height: 6, borderRadius: 3, background: 'var(--line)' }}><div style={{ width: `${Math.min(100, item.ocupacao * 100)}%`, height: 6, borderRadius: 3, background: 'var(--accent)' }} /></div>{pct(item.ocupacao)}</div></td>
            <td style={td}>{item.concluidos}</td>
            <td style={td}>{fmtR(item.receita)}</td>
            <td style={td}>{emEdicao ? <input type="number" min="0" style={{ ...input, width: 110 }} aria-label={`Meta de receita de ${item.nome}`} value={emEdicao.receita} onChange={(e) => setEdicao((x) => ({ ...x, [item.profissionalId]: { ...emEdicao, receita: e.target.value } }))} /> : item.meta?.receita ? <>{fmtR(item.meta.receita)}<div style={{ color: 'var(--muted)', fontSize: 12 }}>{pct(item.progressoReceita)} atingido</div></> : '—'}</td>
            <td style={td}>{item.meta?.receita ? <Pill tom={item.noRitmo ? 'bom' : 'alerta'}>{fmtR(item.projecaoReceita)}</Pill> : fmtR(item.projecaoReceita)}</td>
            <td style={td}>{emEdicao ? <input type="number" min="0" style={{ ...input, width: 90 }} aria-label={`Meta de atendimentos de ${item.nome}`} value={emEdicao.atendimentos} onChange={(e) => setEdicao((x) => ({ ...x, [item.profissionalId]: { ...emEdicao, atendimentos: e.target.value } }))} /> : item.meta?.atendimentos ? `${item.concluidos} de ${item.meta.atendimentos}` : '—'}</td>
            <td style={td}>{emEdicao ? <div style={{ display: 'flex', gap: 6 }}><button type="button" style={btnPrimary} onClick={() => salvar(item.profissionalId)}>Salvar</button><button type="button" style={btn} onClick={() => setEdicao((x) => ({ ...x, [item.profissionalId]: undefined }))}>Cancelar</button></div> : <button type="button" style={btn} onClick={() => setEdicao((x) => ({ ...x, [item.profissionalId]: { receita: item.meta?.receita || '', atendimentos: item.meta?.atendimentos || '' } }))}>Definir meta</button>}</td>
          </tr>
        })}</tbody>
      </table></div>}
    </div>
  </div>
}

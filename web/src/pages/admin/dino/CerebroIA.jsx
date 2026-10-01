import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { useToast } from '../../../hooks/useToast'
import { Badge, Dialog } from '../customer360/shared'
import { dateTime, int, money } from './format'
import '../customer360.css'
import './dino-admin.css'

const BASE = '/api/admin/barbearia/cerebro-ia'
const TABS = [['ativacao', 'Ativação'], ['geral', 'Visão geral'], ['aprendizado', 'Aprendizados'], ['ofertas', 'Próximas ofertas'], ['automacoes', 'Automações']]
const TASK_LABEL = { classificar: 'Classificar intenção', resumir_extrair: 'Resumir e extrair fatos', propor_resposta: 'Redigir respostas', avaliar: 'IA avaliadora', venda_consultiva: 'Venda consultiva', responder_reserva: 'Reserva do atendimento' }
const PROVIDER = { gemini: 'Gemini', anthropic: 'Claude', openai: 'GPT' }
const KEY_ENV = { gemini: 'GEMINI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY' }
const REL = { AGENDOU: 'agendou', COMPROU: 'comprou', ATENDIDO_POR: 'atendido por', INDICOU: 'indicou', PERGUNTOU: 'perguntou', INTERESSE: 'interesse' }
const NODE_COLOR = { cliente: '#4B57A6', profissional: '#7C8494', servico: '#2E9E7B', produto: '#E0A83B', interesse: '#D96A5B' }
const pct = (v) => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')}%`)
const score = (v) => Number(v || 0).toFixed(2).replace('.', ',')

function Kpi({ label, value, hint, alert }) {
  return <article className={alert ? 'is-alert' : ''}><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</article>
}

function EgoGraph({ ego }) {
  const layout = useMemo(() => {
    if (!ego?.nodes?.length) return null
    const center = ego.nodes[0]
    const others = ego.nodes.slice(1)
    const pos = new Map([[center.id, { x: 300, y: 190 }]])
    others.forEach((node, index) => {
      const angle = (index / Math.max(1, others.length)) * Math.PI * 2 - Math.PI / 2
      pos.set(node.id, { x: 300 + Math.cos(angle) * 210, y: 190 + Math.sin(angle) * 145 })
    })
    return { pos, center }
  }, [ego])
  if (!layout) return null
  return <svg className="dadm-ego" viewBox="0 0 600 380" role="img" aria-label={`Ligações de ${layout.center.rotulo}: ${ego.links.length} relações`}>
    {ego.links.map((link, index) => {
      const a = layout.pos.get(link.from); const b = layout.pos.get(link.to)
      if (!a || !b) return null
      return <g key={index}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#9AA1B2" strokeWidth={Math.min(4, 1 + link.peso * 0.6)} opacity=".6" />
        <text className="rel" x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 3} textAnchor="middle">{REL[link.rel] || link.rel}{link.peso > 1 ? ` ×${link.peso}` : ''}</text></g>
    })}
    {ego.nodes.map((node) => { const p = layout.pos.get(node.id); return <g key={node.id}>
      <circle cx={p.x} cy={p.y} r={node.id === layout.center.id ? 20 : 13} fill={NODE_COLOR[node.tipo] || '#7C8494'} stroke="#fff" strokeWidth="2" />
      <text x={p.x} y={p.y + (node.id === layout.center.id ? 36 : 28)} textAnchor="middle">{String(node.rotulo).slice(0, 26)}</text>
    </g> })}
  </svg>
}

export default function CerebroIA() {
  const { empresaAtiva } = useAuth()
  const { toast } = useToast()
  const [tab, setTab] = useState('ativacao')
  const [ativ, setAtiv] = useState(null)
  const [modal, setModal] = useState(null)
  const [vitrine, setVitrine] = useState({ phone: '', usarIdentidadeDino: true })
  const [info, setInfo] = useState(null)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState('')
  const [propostas, setPropostas] = useState({ status: 'proposto', items: [], drafts: {} })
  const [grafo, setGrafo] = useState(null)
  const [ego, setEgo] = useState(null)
  const [previa, setPrevia] = useState(null)
  const [confirmOff, setConfirmOff] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const data = await api.get(BASE)
      setInfo(data); setErro('')
      setForm({ ativo: data.settings.ativo, autonomia: data.settings.autonomia, teto: (data.settings.tetoDiarioCentavos / 100).toFixed(2).replace('.', ','), automacoes: { ...data.settings.automacoes } })
    } catch (error) { setErro(error.message || 'Não foi possível carregar.') }
  }, [])
  useEffect(() => { carregar() }, [carregar, empresaAtiva?.id])

  const carregarPropostas = useCallback(async (status = propostas.status) => {
    try { const data = await api.get(`${BASE}/propostas?status=${status}`); setPropostas((p) => ({ ...p, status, items: data.items || [], drafts: Object.fromEntries((data.items || []).map((i) => [i.id, i.proposta || ''])) })) }
    catch (error) { toast(error.message, true) }
  }, [propostas.status, toast])
  const carregarGrafo = useCallback(async () => { try { setGrafo(await api.get(`${BASE}/grafo`)) } catch (error) { toast(error.message, true) } }, [toast])
  const carregarAtivacao = useCallback(async () => { try { const data = await api.get('/api/admin/barbearia/ativacao'); setAtiv(data); setVitrine((v) => ({ ...v, phone: v.phone || data.vitrine?.phone || '' })) } catch (error) { toast(error.message, true) } }, [toast])
  const carregarPrevia = useCallback(async () => { try { setPrevia(await api.get(`${BASE}/automacoes/previa`)) } catch (error) { toast(error.message, true) } }, [toast])

  useEffect(() => {
    if (!info) return
    if (tab === 'ativacao') carregarAtivacao()
    if (tab === 'aprendizado') carregarPropostas()
    if (tab === 'ofertas' && !grafo) carregarGrafo()
    if (tab === 'automacoes') carregarPrevia()
  }, [tab, info]) // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar(patch = {}) {
    const next = { ...form, ...patch }
    const teto = Math.round(Number(String(next.teto).replace(/\./g, '').replace(',', '.')) * 100)
    if (!Number.isFinite(teto) || teto < 0) { toast('Informe um teto diário válido.', true); return }
    setBusy('salvar')
    try {
      await api.put(`${BASE}/config`, { ativo: next.ativo, autonomia: Number(next.autonomia), tetoDiarioCentavos: teto, automacoes: next.automacoes })
      toast('Configuração salva.'); await carregar()
      if (tab === 'automacoes') carregarPrevia()
    } catch (error) { toast(error.message, true) } finally { setBusy('') }
  }
  async function acao(tipo, body = {}) {
    setBusy(tipo)
    try {
      const rotas = { criar_canal: ['post', 'canal', {}], ativar_canal: ['post', 'canal', { ativar: true, confirmado: true }], politica: ['post', 'politica', {}], slug: ['post', 'slug', { slug: 'dino' }], vitrine: ['put', 'vitrine', vitrine], esgotados: ['post', 'esgotados', { confirmado: true, ids: (modal?.itens || []).map((i) => i.id) }] }
      const [method, path, payload] = rotas[tipo]
      const out = await api[method](`/api/admin/barbearia/ativacao/${path}`, { ...payload, ...body })
      const msg = { criar_canal: 'Canal criado em rascunho.', ativar_canal: 'Atendente ativado.', politica: 'Política aplicada: o assistente pergunta antes de usar o histórico.', slug: `Agendamento online em ${out.url || '/agendar/dino'}.`, vitrine: 'Identidade da vitrine atualizada.', esgotados: `${(out.despublicados || []).length} produto(s) fora da vitrine até repor o estoque.` }[tipo]
      toast(msg); setModal(null); carregarAtivacao()
    } catch (error) { toast(error.message, true) } finally { setBusy('') }
  }
  async function aprenderAgora() {
    setBusy('aprender')
    try {
      const out = await api.post(`${BASE}/aprender`, {})
      if (out.skipped) toast(out.reason === 'cerebro_desligado' ? 'Ligue o cérebro para aprender.' : 'Este dia já foi processado.', true)
      else toast(`Aprendizado concluído: ${out.conversas} conversas, ${out.fatosAtivos} fatos novos em uso, ${out.perguntas} perguntas para revisar.`)
      carregar()
    } catch (error) { toast(error.message, true) } finally { setBusy('') }
  }
  async function decidir(item, decisao) {
    try {
      await api.post(`${BASE}/propostas/${item.id}/decisao`, { decisao, proposta: propostas.drafts[item.id] })
      toast(decisao === 'aprovado' ? 'Aprovado. O atendente passa a usar esta resposta.' : 'Descartado.')
      carregarPropostas(); carregar()
    } catch (error) { toast(error.message, true) }
  }
  async function abrirEgo(chave) {
    try { setEgo(await api.get(`${BASE}/grafo/cliente/${encodeURIComponent(chave)}`)) } catch (error) { toast(error.message, true) }
  }
  async function executarAutomacoes() {
    setBusy('auto')
    try {
      const out = await api.post(`${BASE}/automacoes/executar`, {})
      const motivo = { horario_silencioso: 'horário silencioso (21h às 8h)', teto_diario: 'teto diário atingido', canal_inativo: 'canal do WhatsApp inativo', escopo_invalido: 'loja do WhatsApp não encontrada' }[out.reason]
      toast(out.queued ? `${out.queued} mensagem(ns) na fila de envio.` : `Nada enviado${motivo ? `: ${motivo}` : '.'}`, !out.queued && Boolean(motivo))
      carregarPrevia()
    } catch (error) { toast(error.message, true) } finally { setBusy('') }
  }

  if (erro) return <div className="dadm-page"><header className="dadm-head"><div><div className="dadm-eyebrow">Relacionamento & IA</div><h1>Cérebro do atendente</h1></div></header><p className="dadm-note danger" role="alert">{erro}</p></div>
  if (!info || !form) return <div className="dadm-page" aria-busy="true"><p className="dadm-muted">Carregando…</p></div>

  const q = info.qualidade || {}
  const configured = info.ia.providers.filter((p) => p.configured)
  const gastoHoje = info.gastoHojeCentavos / 100
  const teto = info.settings.tetoDiarioCentavos / 100

  return <div className="dadm-page">
    <header className="dadm-head">
      <div>
        <div className="dadm-eyebrow">Relacionamento & IA · {empresaAtiva?.nome || 'Empresa'}</div>
        <h1>Cérebro do atendente</h1>
        <p>O atendente do WhatsApp com várias IAs, memória de cada cliente e aprendizado diário. Ele aprende fatos e propõe melhorias; preço, promoção, cobrança e cancelamento nunca mudam sem uma pessoa.</p>
      </div>
      <div className="dadm-actions">
        <span className={`dadm-state ${info.settings.ativo ? 'is-open' : 'is-close'}`} role="status">{info.settings.ativo ? 'Ligado' : 'Desligado'}</span>
        <Link className="c360-btn ghost" to="/admin/whatsapp">Conexão do WhatsApp</Link>
      </div>
    </header>

    <div className="dadm-tabs" role="tablist" aria-label="Seções do cérebro">
      {TABS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}{key === 'aprendizado' && q.propostasPendentes ? ` (${q.propostasPendentes})` : ''}</button>)}
    </div>

    {tab === 'ativacao' && (ativ ? <>
      <section className="dadm-card" aria-labelledby="at-head">
        <h2 id="at-head">Colocar tudo no ar</h2>
        <p>Lista viva do que falta para o atendente, o cérebro, a agenda online e a vitrine funcionarem. Os passos marcados com botão são feitos aqui; segredos (chaves) só entram no servidor e aqui aparece apenas se existem.</p>
        <div className="dadm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={ativ.total} aria-valuenow={ativ.prontos} aria-label="Itens prontos"><span style={{ width: `${Math.round((ativ.prontos / Math.max(1, ativ.total)) * 100)}%` }} /></div>
        <strong>{ativ.prontos} de {ativ.total} itens prontos</strong>
      </section>
      {[...new Set(ativ.itens.map((i) => i.grupo))].map((grupo) => <section key={grupo} className="dadm-card" aria-label={grupo}>
        <h2>{grupo}</h2>
        <ul className="dadm-checklist">{ativ.itens.filter((i) => i.grupo === grupo).map((i) => <li key={i.id} className={i.ok ? 'ok' : i.opcional ? 'opt' : 'pend'}>
          <b aria-hidden="true">{i.ok ? '✓' : i.opcional ? '○' : '!'}</b>
          <span><strong>{i.titulo}</strong>{i.opcional && !i.ok ? <em> · opcional</em> : null}<small>{i.detalhe}</small>
            {i.dados?.url && <small className="dadm-code">Webhook: <code>{i.dados.url}</code> · cabeçalho <code>{i.dados.cabecalho}</code> com o valor de <code>{i.dados.segredo}</code></small>}
          </span>
          <span className="dadm-check-actions">
            {i.acao === 'criar_canal' && <button type="button" className="c360-btn primary" disabled={busy === 'criar_canal'} onClick={() => acao('criar_canal')}>Criar canal</button>}
            {i.acao === 'ativar_canal' && <button type="button" className="c360-btn primary" onClick={() => setModal({ tipo: 'ativar_canal' })}>Ativar atendente</button>}
            {i.acao === 'politica' && <button type="button" className="c360-btn primary" disabled={busy === 'politica'} onClick={() => acao('politica')}>Aplicar política</button>}
            {i.acao === 'slug' && <button type="button" className="c360-btn primary" disabled={busy === 'slug'} onClick={() => acao('slug')}>Ativar /agendar/dino</button>}
            {i.acao === 'vitrine' && <button type="button" className="c360-btn primary" onClick={() => setModal({ tipo: 'vitrine' })}>Ajustar vitrine</button>}
            {i.acao === 'esgotados' && <button type="button" className="c360-btn ghost" onClick={() => setModal({ tipo: 'esgotados', itens: i.dados?.itens || [] })}>Revisar esgotados</button>}
            {i.link && !i.acao && !i.ok && <Link className="c360-btn ghost" to={i.link}>Abrir</Link>}
          </span>
        </li>)}</ul>
      </section>)}
    </> : <p className="dadm-muted">Conferindo…</p>)}

    <Dialog open={modal?.tipo === 'ativar_canal'} title="Ativar o atendente no WhatsApp?" labelId="at-ativar" onClose={() => setModal(null)} onSubmit={() => acao('ativar_canal')}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setModal(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={busy === 'ativar_canal'}>Ativar</button></>}>
      <p>O assistente passa a responder as mensagens que chegarem no número conectado: agenda, catálogo, pedidos para retirada e encaminhamento para a equipe. Promoções continuam desligadas. Você pode pausar a qualquer momento voltando o canal para rascunho.</p>
    </Dialog>
    <Dialog open={modal?.tipo === 'vitrine'} title="Identidade da vitrine" labelId="at-vitrine" onClose={() => setModal(null)} onSubmit={() => acao('vitrine')}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setModal(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={busy === 'vitrine'}>Salvar</button></>}>
      <label className="dadm-toggle"><input type="checkbox" checked={vitrine.usarIdentidadeDino} onChange={(event) => setVitrine({ ...vitrine, usarIdentidadeDino: event.target.checked })} /> Usar as cores da Dino (índigo)</label>
      {ativ?.identidadeDino && <div className="dadm-swatches" aria-hidden="true">{Object.values(ativ.identidadeDino).map((c) => <i key={c} style={{ background: c }} title={c} />)}</div>}
      <label className="c360-field">WhatsApp de contato (com DDD)
        <input className="c360-input" inputMode="tel" value={vitrine.phone} onChange={(event) => setVitrine({ ...vitrine, phone: event.target.value })} placeholder="(65) 99999-0000" />
      </label>
    </Dialog>
    <Dialog open={modal?.tipo === 'esgotados'} title="Tirar esgotados da vitrine" labelId="at-esg" onClose={() => setModal(null)} onSubmit={() => acao('esgotados')}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setModal(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={busy === 'esgotados'}>Tirar da vitrine</button></>}>
      <p>Estes produtos estão publicados com saldo zero. Eles voltam para rascunho (nada é apagado) e você republica quando repor o estoque. Itens só reservados por pagamento pendente não entram na lista.</p>
      <ul className="dadm-memlist">{(modal?.itens || []).map((p) => <li key={p.id}>{p.nome}</li>)}</ul>
    </Dialog>

    {tab === 'geral' && <>
      <section className="dadm-kpis" aria-label="Indicadores dos últimos 30 dias">
        <Kpi label="Conversas (30 dias)" value={int(q.conversas || 0)} hint="resumidas pelo ciclo diário" />
        <Kpi label="Resolvidas sem humano" value={pct(q.resolvidoSemHumano)} />
        <Kpi label="Viraram agenda ou compra" value={pct(q.conversao)} />
        <Kpi label="Nota da IA avaliadora" value={q.notaMedia ? `${String(q.notaMedia).replace('.', ',')}/5` : '—'} hint={`${int(q.avaliadas || 0)} conversas avaliadas`} />
        <Kpi label="Clientes com memória" value={int(q.clientesComMemoria || 0)} hint={`${int(q.fatosAtivos || 0)} fatos em uso · ${int(q.fatosPropostos || 0)} para revisar`} />
        <Kpi label="Gasto com IA hoje" value={money(gastoHoje)} hint={`teto ${money(teto)}`} alert={teto > 0 && gastoHoje >= teto * 0.8} />
      </section>

      <div className="dadm-grid">
        <section className="dadm-card" aria-labelledby="cb-estado">
          <h2 id="cb-estado">Liga, desliga e autonomia</h2>
          <label className="dadm-toggle"><input type="checkbox" checked={form.ativo} onChange={(event) => (event.target.checked ? setForm({ ...form, ativo: true }) : setConfirmOff(true))} /> Cérebro ligado</label>
          <p>Desligado, o atendente continua respondendo como antes (sem memória, sem respostas aprovadas, sem reserva de IA) e nada é aprendido nem enviado pelas automações.</p>
          <fieldset className="dadm-levels" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="dadm-muted" style={{ marginBottom: 6 }}>Nível de autonomia</legend>
            {info.niveis.map((nivel) => <label key={nivel.level} className={Number(form.autonomia) === nivel.level ? 'is-on' : ''}>
              <input type="radio" name="autonomia" value={nivel.level} checked={Number(form.autonomia) === nivel.level} onChange={() => setForm({ ...form, autonomia: nivel.level })} />
              <b>N{nivel.level}</b><span><strong>{nivel.label}{nivel.level === 1 ? ' · recomendado' : ''}</strong>{nivel.detail}</span>
            </label>)}
          </fieldset>
          <p className="dadm-note">Nunca sozinho, em nenhum nível: mudar preço, criar promoção, cancelar, cobrar, prometer prazo ou apagar dados.</p>
          <label className="c360-field">Teto diário de gasto com IA (R$)
            <input className="c360-input" inputMode="decimal" value={form.teto} onChange={(event) => setForm({ ...form, teto: event.target.value })} />
          </label>
          <div className="dadm-actions"><button type="button" className="c360-btn primary" disabled={busy === 'salvar'} onClick={() => salvar()}>Salvar</button></div>
        </section>

        <section className="dadm-card" aria-labelledby="cb-ias">
          <h2 id="cb-ias">IAs conectadas</h2>
          <p>Cada tarefa tem uma IA principal e reservas. Se uma cair, a próxima assume. As chaves ficam só no servidor (Secret Manager).</p>
          <ul className="dadm-providers">
            {info.ia.providers.map((p) => <li key={p.id}>
              <span><strong>{p.label}</strong> <code>{p.models.fast} · {p.models.smart}</code></span>
              {p.configured ? <Badge tone="success">Configurada</Badge> : <Badge tone="warning" title={`Defina ${KEY_ENV[p.id]} no servidor`}>Falta {KEY_ENV[p.id]}</Badge>}
            </li>)}
          </ul>
          <div className="c360-table-wrap"><table className="c360-table">
            <caption className="sr-only">Rota de IAs por tarefa</caption>
            <thead><tr><th scope="col">Tarefa</th><th scope="col">Ordem das IAs</th></tr></thead>
            <tbody>{info.ia.routes.map((r) => <tr key={r.task}><td>{TASK_LABEL[r.task] || r.label}</td><td>{r.chain.map((c) => `${PROVIDER[c.split(':')[0]]}${c.endsWith('smart') ? '' : ' (rápida)'}`).join(' → ')}</td></tr>)}</tbody>
          </table></div>
          {!configured.length && <p className="dadm-note warn">Nenhuma IA configurada: o ciclo diário ainda resume por regras simples, sem extrair fatos.</p>}
        </section>
      </div>

      <section className="dadm-card" aria-labelledby="cb-ciclo">
        <h2 id="cb-ciclo">Ciclo de aprendizado</h2>
        <p>Roda toda madrugada (depois das 2h) com as conversas do dia anterior: resume, extrai fatos, junta perguntas sem resposta, redige respostas (N2) e avalia uma amostra com uma IA diferente da que atendeu.</p>
        {info.execucoes.length ? <div className="c360-table-wrap"><table className="c360-table">
          <caption className="sr-only">Últimas execuções</caption>
          <thead><tr><th scope="col">Dia</th><th scope="col">Situação</th><th scope="col" className="num">Conversas</th><th scope="col" className="num">Fatos em uso</th><th scope="col" className="num">Para revisar</th><th scope="col" className="num">Perguntas</th><th scope="col" className="num">Avaliadas</th></tr></thead>
          <tbody>{info.execucoes.map((run) => <tr key={run.dia}><td>{run.dia.split('-').reverse().join('/')}</td><td><Badge tone={run.status === 'concluido' ? 'success' : run.status === 'falhou' ? 'danger' : 'info'}>{run.status}</Badge></td>
            <td className="num">{run.resumo?.conversas ?? 0}</td><td className="num">{run.resumo?.fatosAtivos ?? 0}</td><td className="num">{run.resumo?.fatosPropostos ?? 0}</td><td className="num">{run.resumo?.perguntas ?? 0}</td><td className="num">{run.resumo?.avaliadas ?? 0}</td></tr>)}</tbody>
        </table></div> : <p className="c360-empty">Ainda não rodou. Ligue o cérebro e aguarde a madrugada, ou processe o dia anterior agora.</p>}
        <div className="dadm-actions"><button type="button" className="c360-btn ghost" disabled={!info.settings.ativo || busy === 'aprender'} onClick={aprenderAgora}>{busy === 'aprender' ? 'Processando…' : 'Processar ontem agora'}</button></div>
      </section>
    </>}

    {tab === 'aprendizado' && <section className="dadm-card" aria-labelledby="cb-prop">
      <h2 id="cb-prop">Perguntas e objeções que o atendente encontrou</h2>
      <p>Quando o atendente não sabe responder, a pergunta vem para cá, agrupada. Escreva (ou ajuste o rascunho) e aprove: a partir daí ele responde igual. Trechos [CONFERIR] precisam ser preenchidos antes.</p>
      <div className="dadm-filters" role="group" aria-label="Filtrar">{[['proposto', 'Para revisar'], ['aprovado', 'Aprovadas'], ['rejeitado', 'Descartadas']].map(([k, l]) => <button key={k} type="button" className={`c360-btn ${propostas.status === k ? 'primary' : 'ghost'}`} onClick={() => carregarPropostas(k)}>{l}</button>)}</div>
      {propostas.items.length ? propostas.items.map((item) => <article key={item.id} className="dadm-proposal">
        <div className="dadm-filters" style={{ justifyContent: 'space-between' }}>
          <strong>{item.titulo}</strong>
          <span><Badge tone={item.tipo === 'faq' ? 'info' : 'warning'}>{item.tipo === 'faq' ? 'Pergunta' : 'Objeção'}</Badge> <Badge>{item.ocorrencias}× </Badge></span>
        </div>
        {item.tipo === 'faq' && <label className="sr-only" htmlFor={`prop-${item.id}`}>Resposta</label>}
        {item.tipo === 'faq' && <textarea id={`prop-${item.id}`} value={propostas.drafts[item.id] ?? ''} disabled={propostas.status !== 'proposto'} placeholder="Escreva a resposta que o atendente deve dar" onChange={(event) => setPropostas((p) => ({ ...p, drafts: { ...p.drafts, [item.id]: event.target.value } }))} />}
        {item.tipo === 'objecao' && <p className="dadm-muted" style={{ margin: 0 }}>Objeção registrada em conversas. Aprovar marca como conhecida para acompanhar nos relatórios; não muda preço nem política.</p>}
        {propostas.status === 'proposto' ? <div className="dadm-actions"><button type="button" className="c360-btn primary" onClick={() => decidir(item, 'aprovado')}>Aprovar</button><button type="button" className="c360-btn ghost" onClick={() => decidir(item, 'rejeitado')}>Descartar</button></div>
          : <small className="dadm-muted">{item.status === 'aprovado' ? 'Aprovado' : 'Descartado'} por {item.decidido_por || '—'} em {dateTime(item.decidido_em)}</small>}
      </article>) : <p className="c360-empty">Nada aqui por enquanto.</p>}
    </section>}

    {tab === 'ofertas' && <>
      {grafo ? <>
        <section className="dadm-kpis" aria-label="Resumo do grafo">
          <Kpi label="Clientes no grafo" value={int(grafo.resumo.clientes)} />
          <Kpi label="Relações" value={int(grafo.resumo.arestas)} hint={Object.entries(grafo.resumo.relacoes).map(([k, v]) => `${REL[k] || k} ${v}`).join(' · ')} />
          <Kpi label="Em risco de sumir" value={int(grafo.resumo.emRisco)} hint="passaram de 1,5× o intervalo habitual" alert={grafo.resumo.emRisco > 0} />
          <Kpi label="Com memória do WhatsApp" value={int(grafo.resumo.comMemoria)} />
        </section>
        <div className="dadm-grid">
          <section className="dadm-card" aria-labelledby="cb-nbo">
            <h2 id="cb-nbo">Próxima melhor oferta por cliente</h2>
            <p>score = 0,40·afinidade + 0,25·interesse + 0,20·momento + 0,15·margem. Verde (≥ 0,60 e com consentimento) pode virar mensagem. Toque num cliente para ver as ligações.</p>
            {grafo.ofertas.length ? <div className="c360-table-wrap"><table className="c360-table">
              <caption className="sr-only">Próximas ofertas</caption>
              <thead><tr><th scope="col">Cliente</th><th scope="col">Oferta</th><th scope="col" className="num">Score</th><th scope="col">Por quê</th></tr></thead>
              <tbody>{grafo.ofertas.map((row) => <tr key={row.cliente.chave}>
                <td><button type="button" className="c360-link" onClick={() => abrirEgo(row.cliente.chave)}>{row.cliente.nome}</button><br /><small className="dadm-muted">{row.cliente.visitas} {row.cliente.visitas === 1 ? 'visita' : 'visitas'}{row.cliente.diasDesdeUltima !== null ? ` · há ${row.cliente.diasDesdeUltima} dias` : ''}{row.cliente.intervaloHabitual ? ` · volta a cada ${row.cliente.intervaloHabitual}` : ''}</small></td>
                <td>{row.melhor.nome}<br /><small className="dadm-muted">{row.melhor.tipo === 'servico' ? 'serviço' : 'produto'} · {money(row.melhor.preco)}</small></td>
                <td className="num"><span className={`dadm-score${row.enviar ? ' hot' : ''}`}>{score(row.melhor.score)}</span></td>
                <td>{row.melhor.motivos.join('; ') || '—'}{!row.cliente.consentimento.marketing && <><br /><small className="dadm-muted">sem consentimento de marketing</small></>}</td>
              </tr>)}</tbody>
            </table></div> : <p className="c360-empty">Ainda não há dados suficientes (agenda, comandas ou pedidos) para sugerir ofertas.</p>}
          </section>
          <section className="dadm-card" aria-labelledby="cb-ego" aria-live="polite">
            <h2 id="cb-ego">{ego?.cliente ? `Ligações de ${ego.cliente.nome}` : 'Ligações do cliente'}</h2>
            {ego ? <>
              <EgoGraph ego={ego.ego} />
              {ego.ofertas && <ul className="dadm-memlist">{[ego.ofertas.melhor, ...ego.ofertas.alternativas].map((o) => <li key={o.nome}><strong>{o.nome} · {score(o.score)}</strong><span className="dadm-muted">afinidade {score(o.partes.afinidade)} · interesse {score(o.partes.interesse)} · momento {score(o.partes.momento)} · margem {score(o.partes.margem)}</span></li>)}</ul>}
            </> : <p className="c360-empty">Escolha um cliente na lista.</p>}
            {grafo.resumo.compradosJuntos.length > 0 && <><h2>Comprados juntos</h2><ul className="dadm-memlist">{grafo.resumo.compradosJuntos.map((p) => <li key={p.itens.join('|')}>{p.itens.join(' + ')} <small className="dadm-muted">{p.clientes} clientes</small></li>)}</ul></>}
          </section>
        </div>
      </> : <p className="dadm-muted">Montando o grafo…</p>}
    </>}

    {tab === 'automacoes' && <div className="dadm-grid">
      <section className="dadm-card" aria-labelledby="cb-auto">
        <h2 id="cb-auto">Automações</h2>
        <p>Todas nascem desligadas. Regras fixas: consentimento de marketing (exceto pós-atendimento), nada das 21h às 8h, uma mensagem automática por cliente a cada 24 h, uma oferta a cada 14 dias, até {info.tetoAutomacoesDia} por dia e sempre com a opção SAIR.</p>
        {info.automacoes.map((a) => <label key={a.id} className="dadm-toggle"><input type="checkbox" checked={Boolean(form.automacoes[a.id])} onChange={(event) => setForm({ ...form, automacoes: { ...form.automacoes, [a.id]: event.target.checked } })} /> {a.label} <small className="dadm-muted">({a.finalidade === 'marketing' ? 'exige consentimento de marketing' : 'atendimento'})</small></label>)}
        <div className="dadm-actions"><button type="button" className="c360-btn primary" disabled={busy === 'salvar'} onClick={() => salvar()}>Salvar automações</button></div>
        {!info.settings.ativo && <p className="dadm-note warn">O cérebro está desligado: nenhuma automação roda.</p>}
      </section>
      <section className="dadm-card" aria-labelledby="cb-prev">
        <h2 id="cb-prev">Prévia do que sairia agora</h2>
        {previa?.skipped ? <p className="c360-empty">Ligue o cérebro para ver a prévia.</p> : previa ? <>
          <p>{previa.guards?.quiet ? 'Agora é horário silencioso: nada será enviado.' : `Hoje já foram ${previa.guards?.sentToday || 0} de ${previa.guards?.dailyCap || info.tetoAutomacoesDia}.`} A rodada automática acontece a cada 30 minutos entre 9h e 20h.</p>
          {previa.planned.length ? <ul className="dadm-memlist">{previa.planned.slice(0, 30).map((p) => <li key={`${p.automacao}-${p.telefoneFinal}-${p.referencia}`}>
            <strong>{p.cliente} · final {p.telefoneFinal} · {info.automacoes.find((a) => a.id === p.automacao)?.label}</strong>
            <span className="dadm-muted">{p.motivo}{p.variante === 'B' ? ' · variante B' : ''}</span>
            <span style={{ whiteSpace: 'pre-line' }}>{p.mensagem}</span>
          </li>)}</ul> : <p className="c360-empty">Ninguém para contatar agora com as automações ligadas.</p>}
          <div className="dadm-actions"><button type="button" className="c360-btn ghost" disabled={busy === 'auto' || !previa.planned.length || previa.guards?.quiet} onClick={executarAutomacoes}>Enfileirar agora</button></div>
          {previa.resultados?.length > 0 && <><h2>Resultado (90 dias)</h2><div className="c360-table-wrap"><table className="c360-table">
            <caption className="sr-only">Resultado das automações</caption>
            <thead><tr><th scope="col">Automação</th><th scope="col">Variante</th><th scope="col" className="num">Enviadas</th><th scope="col" className="num">Voltaram em 14 dias</th></tr></thead>
            <tbody>{previa.resultados.map((r) => <tr key={`${r.automacao}${r.variante}`}><td>{r.label}</td><td>{r.variante}</td><td className="num">{r.enviadas}</td><td className="num">{r.voltaram} ({pct(r.taxa)})</td></tr>)}</tbody>
          </table></div></>}
        </> : <p className="dadm-muted">Calculando…</p>}
      </section>
    </div>}

    <Dialog open={confirmOff} danger title="Desligar o cérebro?" labelId="cb-off" onClose={() => setConfirmOff(false)} onSubmit={() => { setConfirmOff(false); salvar({ ativo: false }) }}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setConfirmOff(false)}>Voltar</button><button type="submit" className="c360-btn primary">Desligar agora</button></>}>
      <p>O atendente volta a responder sem memória e sem reserva de IA, o aprendizado para e nenhuma automação é enviada. Nada é apagado: ao religar, tudo volta como estava.</p>
    </Dialog>
  </div>
}

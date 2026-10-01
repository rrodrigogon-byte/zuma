import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { useToast } from '../../../hooks/useToast'
import { Badge, Dialog, EmptyLine, fmtDay } from './shared'
import '../dino/dino-admin.css'

const API = '/api/admin/barbearia/cerebro-ia/memoria'
const STATUS = { ativo: ['Em uso', 'success'], proposto: ['Para revisar', 'warning'], contestado: ['Contestado', 'danger'], expirado: ['Vencido', 'muted'] }
const RESULT = { agendou: 'Agendou', comprou: 'Comprou', duvida: 'Dúvida', reclamacao: 'Reclamação', sem_resposta: 'Sem resposta', humano: 'Passou para a equipe' }
const pct = (value) => `${Math.round(Number(value || 0) * 100)}%`

/** Memória que o atendente do WhatsApp guardou sobre este cliente, com fonte e controles. */
export default function AiMemoryPanel({ reference, canManage }) {
  const { toast } = useToast()
  const [state, setState] = useState({ loading: true, data: null, error: '', code: '' })
  const [q, setQ] = useState('')
  const [busca, setBusca] = useState(null)
  const [forget, setForget] = useState({ open: false, text: '', busy: false })
  const confirmRef = useRef(null)
  const enc = encodeURIComponent(reference)

  const load = useCallback(async () => {
    try { setState({ loading: false, data: await api.get(`${API}/${enc}`), error: '', code: '' }) }
    catch (error) { setState({ loading: false, data: null, error: error.message, code: error.code || '' }) }
  }, [enc])
  useEffect(() => { load() }, [load])

  async function mark(fact, status) {
    try { await api.patch(`${API}/fatos/${fact.id}`, { status }); toast(status === 'contestado' ? 'Fato contestado. O atendente não usará mais.' : 'Fato confirmado.'); load() }
    catch (error) { toast(error.message, true) }
  }
  async function search(event) {
    event.preventDefault()
    if (!q.trim()) { setBusca(null); return }
    try { setBusca((await api.get(`${API}/${enc}?q=${encodeURIComponent(q.trim())}`)).busca || []) } catch (error) { toast(error.message, true) }
  }
  async function doForget() {
    setForget((f) => ({ ...f, busy: true }))
    try {
      const out = await api.delete(`${API}/${enc}`, { confirmacao: forget.text })
      const r = out.removidos || {}
      toast(`Memória apagada: ${r.fatos || 0} fatos, ${r.resumos || 0} resumos, ${r.conversas || 0} conversas.`)
      setForget({ open: false, text: '', busy: false }); load()
    } catch (error) { toast(error.message, true); setForget((f) => ({ ...f, busy: false })) }
  }

  if (state.loading) return <p className="c360-muted">Carregando memória do atendente…</p>
  if (state.error) {
    const hint = state.code === 'COMMERCE_REQUIRED' ? 'A memória fica no banco da loja, que não está ativo neste ambiente.' : state.error
    return <p className="c360-muted">{hint}</p>
  }
  const data = state.data
  if (!data?.disponivel) return <EmptyLine>Sem telefone no cadastro: o atendente do WhatsApp não tem memória deste cliente.</EmptyLine>

  return <div className="c360-stack">
    <p className="c360-muted" style={{ margin: 0 }}>O que o atendente aprendeu nas conversas. Só é usado no atendimento quando o cliente autoriza a personalização. Cada fato mostra de onde veio; contestar tira o fato do atendimento na hora.</p>
    {data.facts.length ? <div className="c360-table-wrap"><table className="c360-table">
      <caption className="sr-only">Fatos aprendidos</caption>
      <thead><tr><th scope="col">Fato</th><th scope="col">Situação</th><th scope="col">Fonte</th><th scope="col" className="num">Confiança</th>{canManage && <th scope="col"><span className="sr-only">Ações</span></th>}</tr></thead>
      <tbody>{data.facts.map((fact) => <tr key={fact.id}>
        <td><strong>{fact.categoriaLabel}:</strong> {fact.valor}</td>
        <td><Badge tone={STATUS[fact.status]?.[1] || 'muted'}>{STATUS[fact.status]?.[0] || fact.status}</Badge></td>
        <td>{fact.fonte ? `“${fact.fonte}”` : '—'}{fact.fonteDia ? ` · ${fmtDay(fact.fonteDia)}` : ''}</td>
        <td className="num">{pct(fact.confianca)}</td>
        {canManage && <td style={{ whiteSpace: 'nowrap' }}>
          {fact.status !== 'ativo' && fact.status !== 'expirado' && <button type="button" className="c360-btn ghost" onClick={() => mark(fact, 'ativo')}>Confirmar</button>}{' '}
          {fact.status !== 'contestado' && <button type="button" className="c360-btn ghost" onClick={() => mark(fact, 'contestado')}>Contestar</button>}
        </td>}
      </tr>)}</tbody>
    </table></div> : <EmptyLine>Nenhum fato aprendido ainda.</EmptyLine>}

    <h4 style={{ margin: '8px 0 0' }}>Conversas resumidas</h4>
    {data.summaries.length ? <ol className="dadm-memlist">{data.summaries.map((s) => <li key={s.id}>
      <strong>{fmtDay(s.dia)} · {RESULT[s.resultado] || s.resultado}</strong>
      <span>{s.resumo}</span>
      {s.nota != null && <small className="c360-muted">Nota da IA avaliadora: {s.nota}/5{s.comentario ? ` — ${s.comentario}` : ''}</small>}
    </li>)}</ol> : <EmptyLine>Nenhuma conversa resumida ainda. Os resumos são gerados toda madrugada.</EmptyLine>}

    <form className="dadm-filters" onSubmit={search} role="search">
      <label className="sr-only" htmlFor={`mem-q-${enc}`}>Buscar nas conversas deste cliente</label>
      <input id={`mem-q-${enc}`} className="c360-input" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar nas conversas (ex.: perfume)" />
      <button type="submit" className="c360-btn ghost">Buscar</button>
    </form>
    {busca && (busca.length ? <ul className="dadm-memlist">{busca.map((b, i) => <li key={i}>{fmtDay(b.dia)} — {b.resumo}</li>)}</ul> : <EmptyLine>Nada encontrado.</EmptyLine>)}

    {canManage && <div><button type="button" className="c360-btn ghost" onClick={() => setForget({ open: true, text: '', busy: false })}>Apagar memória do atendente</button></div>}
    <Dialog open={forget.open} danger title="Apagar memória do atendente" labelId="forget-mem" initialFocusRef={confirmRef}
      onClose={() => setForget({ open: false, text: '', busy: false })} onSubmit={doForget}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setForget({ open: false, text: '', busy: false })}>Voltar</button><button type="submit" className="c360-btn primary" disabled={forget.text !== 'APAGAR' || forget.busy}>Apagar tudo</button></>}>
      <p>Apaga fatos, resumos, avaliações, registros de automação e conversas do WhatsApp deste cliente. Não afeta agenda, comandas nem pedidos. Não dá para desfazer.</p>
      <label className="c360-field">Digite APAGAR para confirmar
        <input ref={confirmRef} className="c360-input" value={forget.text} onChange={(event) => setForget((f) => ({ ...f, text: event.target.value }))} autoComplete="off" />
      </label>
    </Dialog>
  </div>
}

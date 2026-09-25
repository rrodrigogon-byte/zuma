import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, fmtDate } from '../../../lib/api'
import { useToast } from '../../../hooks/useToast'
import { API, Badge, Dialog, EmptyLine, fmtDay, profilePath } from './shared'

const enc = encodeURIComponent

// ─────────────── anotações e etiquetas ───────────────

export function NotesAndTags({ reference, notas = [], etiquetas = [], disponiveis = [], onChange }) {
  const { toast } = useToast()
  const [texto, setTexto] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingTags, setEditingTags] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState(etiquetas)
  useEffect(() => { setTags(etiquetas) }, [etiquetas])

  async function addNote(event) {
    event.preventDefault()
    if (texto.trim().length < 2 || saving) return
    setSaving(true)
    try { await api.post(`${API}/${enc(reference)}/notas`, { texto: texto.trim() }); setTexto(''); onChange() }
    catch (error) { toast(error.message || 'Não foi possível salvar a anotação.', 'error') }
    finally { setSaving(false) }
  }
  async function removeNote(id) {
    try { await api.delete(`${API}/${enc(reference)}/notas/${enc(id)}`); onChange() }
    catch (error) { toast(error.message || 'Não foi possível remover.', 'error') }
  }
  async function saveTags(next) {
    try { const result = await api.put(`${API}/${enc(reference)}/etiquetas`, { etiquetas: next }); setTags(result.etiquetas || []); toast('Etiquetas salvas.', 'success') }
    catch (error) { toast(error.message || 'Não foi possível salvar as etiquetas.', 'error') }
  }
  function addTag(value) {
    const tag = String(value || '').trim().toLowerCase().slice(0, 32)
    if (!tag || tags.includes(tag)) { setTagInput(''); return }
    const next = [...tags, tag].slice(0, 12)
    setTags(next); setTagInput(''); saveTags(next)
  }
  const suggestions = disponiveis.filter((tag) => !tags.includes(tag) && (!tagInput || tag.includes(tagInput.toLowerCase()))).slice(0, 6)

  return <section className="c360-card" aria-labelledby="c360-notes-title">
    <header className="c360-card-head">
      <h2 id="c360-notes-title">Anotações da equipe</h2>
      <div className="c360-tags" aria-label="Etiquetas do cliente">
        {tags.map((tag) => <span key={tag} className="c360-tag">#{tag}{editingTags && <button type="button" onClick={() => { const next = tags.filter((item) => item !== tag); setTags(next); saveTags(next) }} aria-label={`Remover etiqueta ${tag}`}>×</button>}</span>)}
        {!tags.length && !editingTags && <span className="c360-muted">Sem etiquetas</span>}
        <button type="button" className="c360-link" onClick={() => setEditingTags((value) => !value)} aria-expanded={editingTags}>{editingTags ? 'Concluir' : 'Etiquetas'}</button>
      </div>
    </header>
    {editingTags && <div className="c360-tag-editor">
      <input className="c360-input" value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTag(tagInput) } }} placeholder="Nova etiqueta e Enter (ex.: barba, perfume, aniversário-março)" aria-label="Nova etiqueta" maxLength={32} />
      {suggestions.length > 0 && <div className="c360-tags">{suggestions.map((tag) => <button key={tag} type="button" className="c360-tag is-suggestion" onClick={() => addTag(tag)}>+ #{tag}</button>)}</div>}
    </div>}
    <form className="c360-note-form" onSubmit={addNote}>
      <label className="sr-only" htmlFor="c360-note-input">Nova anotação</label>
      <textarea id="c360-note-input" className="c360-input" rows={2} value={texto} onChange={(event) => setTexto(event.target.value)} maxLength={1000} placeholder="Preferências, combinados, observações do atendimento… (não registre dados sensíveis de saúde)" />
      <button type="submit" className="c360-btn primary" disabled={saving || texto.trim().length < 2}>{saving ? 'Salvando…' : 'Anotar'}</button>
    </form>
    {notas.length ? <ul className="c360-notes">
      {notas.map((nota) => <li key={nota.id}>
        <p>{nota.texto}</p>
        <small>{nota.autor} · {fmtDate(nota.em)}</small>
        <button type="button" className="c360-link danger" onClick={() => removeNote(nota.id)} aria-label="Remover anotação">Remover</button>
      </li>)}
    </ul> : <EmptyLine>Nenhuma anotação ainda.</EmptyLine>}
  </section>
}

// ─────────────── cadastros vinculados ───────────────

export function IdentityPanel({ reference, registros = [], vinculadoPor = [], canManage, onChange }) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [action, setAction] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [target, setTarget] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const searchRef = useRef(null)
  const myRefs = registros.map((item) => item.ref)

  useEffect(() => {
    if (action !== 'vincular' || query.trim().length < 2) { setResults([]); return undefined }
    const timer = setTimeout(() => {
      api.get(`${API}?limit=8&q=${enc(query.trim())}`).then((data) => setResults((data.items || []).filter((item) => !item.refs?.some((ref) => myRefs.includes(ref))))).catch(() => setResults([]))
    }, 280)
    return () => clearTimeout(timer)
  }, [query, action]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (saving) return
    setSaving(true)
    try {
      if (action === 'vincular') await api.post(`${API}/vinculos`, { a: myRefs[0], b: target.refs?.[0] || target.ref, motivo })
      else for (const other of myRefs.filter((ref) => ref !== action.ref)) await api.post(`${API}/separacoes`, { a: other, b: action.ref, motivo })
      toast(action === 'vincular' ? 'Cadastros unificados.' : 'Cadastro separado desta ficha.', 'success')
      setAction(null); setTarget(null); setQuery(''); setMotivo('')
      if (action !== 'vincular' && action.ref === reference) navigate(profilePath(myRefs.find((ref) => ref !== action.ref)))
      else onChange()
    } catch (error) { toast(error.message || 'Não foi possível salvar.', 'error') }
    finally { setSaving(false) }
  }

  return <div className="c360-stack">
    <h3>Cadastros desta pessoa</h3>
    <p className="c360-muted">{registros.length > 1 ? `Ligados por ${vinculadoPor.join(' e ') || 'contato'}. Separar um cadastro tira ele desta ficha e impede a união automática.` : 'Só um cadastro encontrado. Se o cliente também tem cadastro com outro telefone ou e-mail, vincule aqui.'}</p>
    <ul className="c360-records">
      {registros.map((item) => <li key={item.ref}>
        <Badge tone={item.fonte === 'loja' ? 'info' : 'muted'}>{item.fonte === 'loja' ? 'Loja' : 'Barbearia'}</Badge>
        <span><strong>{item.nome}</strong><small>{[item.telefone, item.email].filter(Boolean).join(' · ') || 'Sem contato'}{item.criadoEm ? ` · desde ${fmtDay(item.criadoEm)}` : ''}</small></span>
        {item.bloqueado && <Badge tone="danger">Bloqueado</Badge>}
        {canManage && registros.length > 1 && <button type="button" className="c360-link" onClick={() => setAction(item)}>Separar</button>}
      </li>)}
    </ul>
    {canManage && <button type="button" className="c360-btn ghost c360-fit" onClick={() => { setAction('vincular'); setTimeout(() => searchRef.current?.focus(), 50) }}>Vincular outro cadastro</button>}

    <Dialog open={Boolean(action)} labelId="c360-identity-title" title={action === 'vincular' ? 'Vincular outro cadastro' : 'Separar cadastro'} onClose={() => setAction(null)} onSubmit={submit}
      initialFocusRef={action === 'vincular' ? searchRef : undefined}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setAction(null)}>Cancelar</button><button type="submit" className="c360-btn primary" disabled={saving || (action === 'vincular' && !target)}>{saving ? 'Salvando…' : 'Confirmar'}</button></>}>
      {action === 'vincular' ? <>
        <p>Busque o outro cadastro da mesma pessoa (barbearia ou loja).</p>
        <input ref={searchRef} className="c360-input" value={query} onChange={(event) => { setQuery(event.target.value); setTarget(null) }} placeholder="Nome, final do telefone ou e-mail" aria-label="Buscar cadastro para vincular" />
        <ul className="c360-picker" role="listbox" aria-label="Cadastros encontrados">
          {results.map((item) => <li key={item.ref} role="option" aria-selected={target?.ref === item.ref}><button type="button" className={target?.ref === item.ref ? 'active' : ''} onClick={() => setTarget(item)}><strong>{item.nome}</strong><small>{[item.telefone, item.email].filter(Boolean).join(' · ')} · {item.fontes.join(' + ')}</small></button></li>)}
          {query.trim().length >= 2 && !results.length && <li className="c360-muted">Nenhum outro cadastro encontrado.</li>}
        </ul>
      </> : action && <p>Separar <strong>{action.nome}</strong> ({action.fonte}) desta ficha? Ele passa a ter ficha própria.</p>}
      <label className="c360-field">Observação (opcional)<input className="c360-input" value={motivo} onChange={(event) => setMotivo(event.target.value)} maxLength={240} placeholder="Ex.: cliente confirmou o novo número" /></label>
    </Dialog>
  </div>
}

// ─────────────── consentimentos da barbearia ───────────────

const CONSENT_ROWS = [['whatsapp', 'atendimento', 'WhatsApp · atendimento'], ['whatsapp', 'marketing', 'WhatsApp · ofertas e campanhas'], ['email', 'atendimento', 'E-mail · atendimento'], ['email', 'marketing', 'E-mail · ofertas e campanhas']]
const CONSENT_ORIGINS = [['balcao', 'Confirmado no balcão'], ['whatsapp', 'Confirmado por WhatsApp'], ['formulario', 'Formulário/assinatura'], ['telefone', 'Confirmado por telefone']]

export function ConsentEditor({ clienteId, consentimentos = [], onChange }) {
  const { toast } = useToast()
  const [pending, setPending] = useState(null)
  const [origem, setOrigem] = useState(CONSENT_ORIGINS[0][0])
  const [saving, setSaving] = useState(false)
  const current = (canal, finalidade) => consentimentos.find((item) => item.origem === 'barbearia' && item.canal === canal && item.finalidade === finalidade)
  if (!clienteId) return <EmptyLine>Consentimentos são geridos no cadastro da barbearia; este cliente só existe na loja online.</EmptyLine>

  async function confirm() {
    if (saving) return
    setSaving(true)
    try {
      await api.patch(`/api/admin/barbearia/clientes/${enc(clienteId)}/consentimentos`, { canal: pending.canal, finalidade: pending.finalidade, concedido: pending.concedido, origem: `c360_${origem}`, confirmado: true })
      toast(pending.concedido ? 'Consentimento registrado.' : 'Consentimento revogado.', 'success')
      setPending(null); onChange()
    } catch (error) { toast(error.message || 'Não foi possível atualizar o consentimento.', 'error') }
    finally { setSaving(false) }
  }

  return <div className="c360-stack">
    <ul className="c360-consents">
      {CONSENT_ROWS.map(([canal, finalidade, label]) => {
        const item = current(canal, finalidade)
        const on = item?.concedido === true
        return <li key={`${canal}-${finalidade}`}>
          <span><strong>{label}</strong><small>{item?.atualizadoEm ? `Atualizado ${fmtDate(item.atualizadoEm)}${item.fonte ? ` · ${item.fonte}` : ''}` : 'Nunca registrado'}</small></span>
          <button type="button" role="switch" aria-checked={on} className={`c360-switch${on ? ' on' : ''}`} onClick={() => setPending({ canal, finalidade, label, concedido: !on })} aria-label={`${label}: ${on ? 'autorizado' : 'não autorizado'}`}><span /></button>
        </li>
      })}
    </ul>
    <Dialog open={Boolean(pending)} labelId="c360-consent-title" title={pending?.concedido ? 'Registrar consentimento' : 'Revogar consentimento'} onClose={() => setPending(null)} onSubmit={confirm}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setPending(null)}>Cancelar</button><button type="submit" className="c360-btn primary" disabled={saving}>{saving ? 'Salvando…' : 'Confirmar'}</button></>}>
      <p>{pending?.label}. {pending?.concedido ? 'Só registre se o cliente autorizou de forma livre e explícita.' : 'O cliente deixará de receber comunicações desta finalidade.'}</p>
      {pending?.concedido && <label className="c360-field">Como o cliente autorizou<select className="c360-input" value={origem} onChange={(event) => setOrigem(event.target.value)}>{CONSENT_ORIGINS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
    </Dialog>
  </div>
}

// ─────────────── quem acessou ───────────────

const ACCESS_LABELS = { view: 'Abriu a ficha', reveal: 'Revelou dado', export: 'Exportou dados', anonymize: 'Anonimizou' }

export function AccessHistory({ reference }) {
  const [state, setState] = useState({ loading: true, items: [], fonte: '', error: '' })
  useEffect(() => {
    let active = true
    api.get(`${API}/${enc(reference)}/acessos`)
      .then((data) => active && setState({ loading: false, items: data.items || [], fonte: data.fonte, error: '' }))
      .catch((error) => active && setState({ loading: false, items: [], fonte: '', error: error.message }))
    return () => { active = false }
  }, [reference])
  if (state.loading) return <p className="c360-muted">Carregando histórico…</p>
  if (state.error) return <p className="c360-error" role="alert">{state.error}</p>
  return <div className="c360-stack">
    {state.items.length ? <div className="c360-table-wrap"><table className="c360-table">
      <caption className="sr-only">Histórico de acesso à ficha</caption>
      <thead><tr><th scope="col">Quando</th><th scope="col">Quem</th><th scope="col">Ação</th><th scope="col">Detalhe</th></tr></thead>
      <tbody>{state.items.map((item, index) => <tr key={`${item.em}-${index}`}><td>{fmtDate(item.em)}</td><td>{item.usuario}</td><td>{ACCESS_LABELS[item.acao] || item.acao}</td><td>{item.detalhe || '—'}</td></tr>)}</tbody>
    </table></div> : <EmptyLine>Nenhum acesso registrado.</EmptyLine>}
    <small className="c360-muted">Fonte: {state.fonte === 'commerce_audit_logs' ? 'log de auditoria do banco (permanente)' : 'auditoria do painel (últimos 1.000 eventos)'}.</small>
  </div>
}

// ─────────────── anonimização ───────────────

export function AnonymizePanel({ reference, nome, onDone }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const ready = confirmacao === 'ANONIMIZAR' && motivo.trim().length >= 10

  async function submit() {
    if (!ready || saving) return
    setSaving(true)
    try {
      const data = await api.post(`${API}/${enc(reference)}/anonimizar`, { confirmacao, motivo: motivo.trim() })
      setResult(data); setOpen(false); toast('Titular anonimizado.', 'success'); onDone?.()
    } catch (error) { toast(error.message || 'Não foi possível anonimizar.', 'error') }
    finally { setSaving(false) }
  }

  return <div className="c360-danger-zone">
    <h3>Anonimizar titular</h3>
    <p>Atende ao pedido de eliminação (LGPD, art. 18, IV e VI). Remove nome, contato, documento, endereço, anotações, etiquetas, consentimentos e conversas. Valores, datas e status de atendimentos, pedidos e pagamentos ficam, sem dados pessoais, porque a guarda fiscal é obrigatória. <strong>Não pode ser desfeito.</strong></p>
    <p className="c360-muted">Antes, exporte os dados se o titular também pediu uma cópia.</p>
    <button type="button" className="c360-btn danger" onClick={() => setOpen(true)}>Anonimizar {nome}</button>
    {result && <p className="c360-note" role="status">Concluído. Barbearia: {Object.entries(result.barbearia || {}).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', ') || 'nada'}{result.loja ? ` · Loja: ${Object.entries(result.loja).filter(([k]) => k !== 'auditoria').map(([k, v]) => `${k} ${v}`).join(', ')}` : ''}.</p>}
    <Dialog open={open} danger labelId="c360-anon-title" title="Anonimizar titular" onClose={() => setOpen(false)} onSubmit={submit}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setOpen(false)}>Cancelar</button><button type="submit" className="c360-btn danger" disabled={!ready || saving}>{saving ? 'Anonimizando…' : 'Anonimizar definitivamente'}</button></>}>
      <p>Esta ação apaga os dados pessoais de <strong>{nome}</strong> na barbearia e na loja online e não pode ser desfeita.</p>
      <label className="c360-field">Motivo e protocolo do pedido<textarea className="c360-input" rows={2} value={motivo} onChange={(event) => setMotivo(event.target.value)} maxLength={240} placeholder="Ex.: pedido do titular por e-mail em 25/09, protocolo 2026-0042" /></label>
      <label className="c360-field">Digite ANONIMIZAR para confirmar<input className="c360-input" value={confirmacao} onChange={(event) => setConfirmacao(event.target.value.toUpperCase())} autoComplete="off" /></label>
    </Dialog>
  </div>
}

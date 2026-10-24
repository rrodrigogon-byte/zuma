import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../lib/api'
import { useToast } from '../../../hooks/useToast'
import { Dialog } from '../customer360/shared'
import { int, money } from './format'

const STATUS = {
  atingida: { label: 'Atingida', icon: '✓' },
  no_ritmo: { label: 'No ritmo', icon: '↗' },
  abaixo: { label: 'Abaixo do ritmo', icon: '!' },
}
const fmt = (value, format) => (format === 'currency' ? money(value) : int(Math.round(value)))

/** Metas do mês com projeção de fechamento pelo ritmo diário. */
export function GoalsPanel({ goals, canEdit, onSaved }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [campos, setCampos] = useState([])
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const firstRef = useRef(null)

  async function abrir() {
    try {
      const data = await api.get('/api/admin/barbearia/metas')
      setCampos(data.campos || [])
      setForm(Object.fromEntries((data.campos || []).map(({ id }) => [id, data.metas?.[id] ?? ''])))
      setOpen(true)
    } catch (error) { toast(error.message, true) }
  }
  async function salvar() {
    setSaving(true)
    try { await api.put('/api/admin/barbearia/metas', form); toast('Metas salvas.'); setOpen(false); onSaved?.() }
    catch (error) { toast(error.message, true) }
    finally { setSaving(false) }
  }

  const items = goals?.items || []
  return <article className="dino-chart-panel dino-goals">
    <header>
      <div><span>Metas da empresa · {goals?.month || 'mês corrente'}</span><h3>Acompanhamento</h3></div>
      {canEdit && <button type="button" onClick={abrir}>{goals?.configured ? 'Editar metas' : 'Definir metas'}</button>}
    </header>
    {goals?.configured && goals?.comparable !== false ? <>
      <p className="dino-goals-meta">Dia {goals.day} de {goals.daysInMonth}. A projeção mantém o ritmo diário atual até o fim do mês. Receita da meta = serviços, revenda e pedidos Commerce confirmados{goals.historicoAvecIncluido ? ' + receita paga do histórico Avec (até a migração); atendimentos incluem os serviços do histórico' : ''}.</p>
      <ul className="dino-goal-list">
        {items.map((item) => <li key={item.id} className={`is-${item.status}`}>
          <div className="dino-goal-top">
            <span>{item.label}</span>
            <b aria-label={STATUS[item.status].label}><i aria-hidden="true">{STATUS[item.status].icon}</i> {STATUS[item.status].label}</b>
          </div>
          <div className="dino-goal-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, item.progress)} aria-label={`${item.label}: ${item.progress}% da meta`}>
            <span style={{ width: `${Math.min(100, item.progress)}%` }} />
            {!item.media && item.meta > 0 && <em style={{ left: `${Math.min(100, (item.projecao / item.meta) * 100)}%` }} title={`Projeção: ${fmt(item.projecao, item.format)}`} />}
          </div>
          <small>{fmt(item.atual, item.format)} de {fmt(item.meta, item.format)} · {String(item.progress).replace('.', ',')}%{!item.media ? ` · projeção ${fmt(item.projecao, item.format)}` : ''}</small>
        </li>)}
      </ul>
    </> : <div className="dino-panel-empty"><strong>{goals?.configured ? 'Meta da empresa' : 'Nenhuma meta definida'}</strong><span>{goals?.configured
      ? 'O painel está filtrado por unidade e as metas são corporativas. Selecione o agregado da empresa para comparar realizado e meta sem misturar escopos.'
      : canEdit ? 'Ainda não há metas corporativas cadastradas. Defina metas de receita, atendimentos, ticket e novos clientes para acompanhar o mês.' : 'Peça ao gestor para definir as metas corporativas do mês.'}</span></div>}

    <Dialog open={open} title="Metas mensais" labelId="metas-form" onClose={() => setOpen(false)} onSubmit={salvar} initialFocusRef={firstRef}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setOpen(false)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={saving}>Salvar metas</button></>}>
      <div style={{ display: 'grid', gap: 12 }}>
        {campos.map((campo, index) => <label key={campo.id} className="c360-field">{campo.label}{campo.format === 'currency' ? ' (R$)' : ''}
          <input ref={index === 0 ? firstRef : undefined} className="c360-input" inputMode="decimal" value={form[campo.id] ?? ''} placeholder="Sem meta" onChange={(event) => setForm({ ...form, [campo.id]: event.target.value })} />
        </label>)}
        <p className="dadm-muted" style={{ margin: 0 }}>Deixe em branco o que não quiser acompanhar. As metas valem para todos os meses até serem alteradas.</p>
      </div>
    </Dialog>
  </article>
}

/** Aviso no painel quando o WhatsApp conectado caiu. */
export function WhatsappAlert() {
  const [conexao, setConexao] = useState(null)
  useEffect(() => { api.get('/api/admin/barbearia/whatsapp-conexao?atualizar=1').then((data) => setConexao(data.conexao)).catch(() => setConexao(null)) }, [])
  if (!conexao?.ativo || conexao.state === 'open' || conexao.state === 'unknown') return null
  return <div className="dino-dashboard-error dino-wa-alert" role="status">
    <strong>WhatsApp {conexao.state === 'qr' ? 'aguardando leitura do QR' : 'desconectado'}.</strong> Atendente IA, lembretes e campanhas não enviam mensagens até reconectar.{conexao.nextReconnectAt ? ' A reconexão automática está tentando.' : ''} <Link to="/admin/whatsapp">Abrir conexão →</Link>
  </div>
}

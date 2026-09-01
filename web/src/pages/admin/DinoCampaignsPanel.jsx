import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import './dino-campaigns.css'

const EMPTY_FORM = { name: '', message: '', city: '', state: '', tag: '', createdWithinDays: '', scheduledAt: '' }
const STATUS_LABELS = { rascunho: 'Rascunho', confirmada: 'Confirmada', agendada: 'Agendada', enviando: 'Enviando', enviada: 'Enviada', parcial: 'Parcial', cancelada: 'Cancelada' }

function number(value) { return new Intl.NumberFormat('pt-BR').format(Number(value || 0)) }
function dateTime(value) { return value ? new Date(value).toLocaleString('pt-BR') : '—' }
function rate(value) { return `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` }

export default function DinoCampaignsPanel() {
  const { toast } = useToast()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [preview, setPreview] = useState(null)
  const [selected, setSelected] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [confirmation, setConfirmation] = useState(false)
  const [confirmationText, setConfirmationText] = useState('')
  const [audience, setAudience] = useState([])
  const [audienceSearch, setAudienceSearch] = useState('')
  const [consentTarget, setConsentTarget] = useState(null)
  const [consentOrigin, setConsentOrigin] = useState('cliente_solicitou')
  const [evidenceNote, setEvidenceNote] = useState('')
  const [consentConfirmed, setConsentConfirmed] = useState(false)

  const loadCampaigns = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/admin/commerce/campaigns?limit=50')
      setCampaigns(response.campaigns || [])
    } catch (error) {
      toast(error.message || 'Não foi possível carregar as campanhas.', 'error')
    } finally { setLoading(false) }
  }, [toast])

  const loadAudience = useCallback(async (search = '') => {
    try {
      const response = await api.get(`/api/admin/commerce/campaigns/audience?limit=100&search=${encodeURIComponent(search || '')}`)
      setAudience(response.customers || [])
    } catch (error) { toast(error.message || 'Não foi possível carregar a base autorizada.', 'error') }
  }, [toast])

  useEffect(() => { loadCampaigns(); loadAudience('') }, [loadCampaigns, loadAudience])

  const criteria = useMemo(() => ({
    city: form.city.trim(),
    state: form.state.trim().toUpperCase(),
    tag: form.tag.trim(),
    createdWithinDays: form.createdWithinDays ? Number(form.createdWithinDays) : null,
  }), [form])

  async function create(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const campaign = await api.post('/api/admin/commerce/campaigns', {
        name: form.name,
        message: form.message,
        criteria,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
      })
      const nextPreview = await api.get(`/api/admin/commerce/campaigns/${campaign.id}/preview`)
      setSelected(campaign)
      setPreview(nextPreview)
      setMetrics(null)
      setConfirmation(false)
      setConfirmationText('')
      setForm(EMPTY_FORM)
      await loadCampaigns()
      toast('Campanha criada em rascunho. Revise o preview antes de confirmar.', 'success')
    } catch (error) { toast(error.message || 'Não foi possível criar a campanha.', 'error') }
    finally { setBusy(false) }
  }

  async function openPreview(campaign) {
    setBusy(true)
    try {
      const nextPreview = await api.get(`/api/admin/commerce/campaigns/${campaign.id}/preview`)
      setSelected(campaign)
      setPreview(nextPreview)
      setMetrics(null)
      setConfirmation(false)
      setConfirmationText('')
    } catch (error) { toast(error.message || 'Não foi possível gerar o preview.', 'error') }
    finally { setBusy(false) }
  }

  async function openMetrics(campaign) {
    setBusy(true)
    try {
      const response = await api.get(`/api/admin/commerce/campaigns/${campaign.id}/metrics`)
      setSelected(campaign)
      setMetrics(response)
      setPreview(null)
    } catch (error) { toast(error.message || 'Não foi possível carregar as métricas.', 'error') }
    finally { setBusy(false) }
  }

  async function confirmSend() {
    if (!preview || !selected || !confirmation || confirmationText !== 'DISPARAR') return
    setBusy(true)
    try {
      const result = await api.post(`/api/admin/commerce/campaigns/${selected.id}/confirm`, { confirmed: true, previewHash: preview.previewHash })
      toast(`${result.queued} destinatário(s) enfileirado(s) com idempotência.`, 'success')
      setPreview(null)
      setConfirmation(false)
      setConfirmationText('')
      await loadCampaigns()
    } catch (error) { toast(error.message || 'Não foi possível confirmar a campanha.', 'error') }
    finally { setBusy(false) }
  }

  async function saveConsent() {
    if (!consentTarget || !consentConfirmed || evidenceNote.trim().length < 5) return
    setBusy(true)
    try {
      await api.patch(`/api/admin/commerce/campaigns/audience/${consentTarget.id}/consent`, { granted: true, origin: consentOrigin, evidenceNote: evidenceNote.trim() })
      toast('Opt-in de marketing registrado com evidência e auditoria.', 'success')
      setConsentTarget(null); setEvidenceNote(''); setConsentConfirmed(false)
      await loadAudience(audienceSearch)
    } catch (error) { toast(error.message || 'Não foi possível registrar o consentimento.', 'error') }
    finally { setBusy(false) }
  }

  async function revokeConsent(customer) {
    if (!window.confirm(`Revogar o consentimento de marketing por WhatsApp de ${customer.nome}?`)) return
    setBusy(true)
    try {
      await api.patch(`/api/admin/commerce/campaigns/audience/${customer.id}/consent`, { granted: false, origin: 'revogacao_cliente', evidenceNote: 'Revogação registrada pelo operador.' })
      toast('Consentimento revogado. O cliente será bloqueado em novos previews e envios.', 'success')
      await loadAudience(audienceSearch)
    } catch (error) { toast(error.message || 'Não foi possível revogar o consentimento.', 'error') }
    finally { setBusy(false) }
  }

  async function cancel(campaign) {
    if (!window.confirm(`Cancelar a campanha “${campaign.nome}”? Envios já concluídos não serão revertidos.`)) return
    setBusy(true)
    try {
      await api.post(`/api/admin/commerce/campaigns/${campaign.id}/cancel`, {})
      toast('Campanha cancelada.', 'success')
      if (selected?.id === campaign.id) { setSelected(null); setPreview(null); setMetrics(null) }
      await loadCampaigns()
    } catch (error) { toast(error.message || 'Não foi possível cancelar a campanha.', 'error') }
    finally { setBusy(false) }
  }

  return <section className="dino-campaigns" aria-labelledby="dino-campaigns-title">
    <header className="dino-campaigns-heading">
      <div><span>RELACIONAMENTO & IA</span><h2 id="dino-campaigns-title">Campanhas WhatsApp</h2><p>Segmentação com consentimento LGPD, preview obrigatório, fila idempotente e métricas do provedor.</p></div>
      <button type="button" onClick={loadCampaigns} disabled={busy || loading}>Atualizar</button>
    </header>

    <section className="dino-campaign-audience" aria-label="Base de consentimentos">
      <div className="dino-campaign-audience-head"><div><h3>Base autorizada</h3><p>Somente opt-ins explícitos de WhatsApp para marketing entram nos previews.</p></div><div><input value={audienceSearch} onChange={event => setAudienceSearch(event.target.value)} placeholder="Buscar cliente" /><button type="button" onClick={() => loadAudience(audienceSearch)} disabled={busy}>Buscar</button></div></div>
      {audience.length === 0 ? <p>Nenhum cliente CRM disponível neste tenant, ou nenhum resultado para a busca.</p> : <div className="dino-campaign-audience-list">{audience.map(customer => <article key={customer.id}><div><strong>{customer.nome}</strong><small>{customer.telefone || 'Sem telefone'} · {customer.email || 'Sem e-mail'}</small></div><div><span className={customer.consentimento_marketing ? 'is-granted' : 'is-denied'}>{customer.consentimento_marketing ? 'Opt-in ativo' : 'Sem opt-in'}</span>{customer.consentimento_marketing ? <button type="button" onClick={() => revokeConsent(customer)} disabled={busy}>Revogar</button> : <button type="button" onClick={() => { setConsentTarget(customer); setEvidenceNote(''); setConsentConfirmed(false) }} disabled={busy}>Registrar opt-in</button>}</div></article>)}</div>}
      {consentTarget && <div className="dino-campaign-consent"><h4>Registrar opt-in · {consentTarget.nome}</h4><label>Origem<select value={consentOrigin} onChange={event => setConsentOrigin(event.target.value)}><option value="cliente_solicitou">Cliente solicitou</option><option value="formulario">Formulário</option><option value="contrato">Contrato</option><option value="importacao_autorizada">Importação autorizada</option></select></label><label>Evidência<textarea value={evidenceNote} onChange={event => setEvidenceNote(event.target.value)} maxLength={500} rows={3} placeholder="Descreva quando e como o cliente autorizou." /></label><label className="dino-campaign-confirm"><input type="checkbox" checked={consentConfirmed} onChange={event => setConsentConfirmed(event.target.checked)} /> Confirmo que existe manifestação válida do titular para marketing por WhatsApp.</label><div><button type="button" onClick={saveConsent} disabled={busy || !consentConfirmed || evidenceNote.trim().length < 5}>Salvar opt-in</button><button type="button" onClick={() => setConsentTarget(null)} disabled={busy}>Cancelar</button></div></div>}
    </section>

    <form className="dino-campaigns-form" onSubmit={create}>
      <label>Nome<input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} minLength={3} maxLength={200} required /></label>
      <label className="is-wide">Mensagem<textarea value={form.message} onChange={event => setForm(current => ({ ...current, message: event.target.value }))} minLength={10} maxLength={1600} rows={4} placeholder="Olá, {{nome}}!" required /></label>
      <label>Cidade<input value={form.city} onChange={event => setForm(current => ({ ...current, city: event.target.value }))} maxLength={100} /></label>
      <label>UF<input value={form.state} onChange={event => setForm(current => ({ ...current, state: event.target.value.toUpperCase().slice(0, 2) }))} maxLength={2} /></label>
      <label>Tag<input value={form.tag} onChange={event => setForm(current => ({ ...current, tag: event.target.value }))} maxLength={80} /></label>
      <label>Clientes criados nos últimos dias<input type="number" min="1" max="3650" value={form.createdWithinDays} onChange={event => setForm(current => ({ ...current, createdWithinDays: event.target.value }))} /></label>
      <label>Agendar para<input type="datetime-local" value={form.scheduledAt} onChange={event => setForm(current => ({ ...current, scheduledAt: event.target.value }))} /></label>
      <div className="dino-campaigns-form-action"><button type="submit" disabled={busy}>Criar rascunho e gerar preview</button><small>Nenhum envio ocorre nesta etapa.</small></div>
    </form>

    {preview && <section className="dino-campaign-preview" aria-label="Preview da campanha">
      <div className="dino-campaign-preview-grid">
        <div><small>Candidatos</small><strong>{number(preview.summary?.candidates)}</strong></div>
        <div><small>Elegíveis</small><strong>{number(preview.summary?.eligible)}</strong></div>
        <div><small>Bloqueados LGPD</small><strong>{number(preview.summary?.blockedNoConsent)}</strong></div>
        <div><small>Telefone inválido</small><strong>{number(preview.summary?.blockedNoPhone)}</strong></div>
      </div>
      <p>Somente clientes com telefone válido e consentimento <strong>WhatsApp · marketing</strong> concedido entram no lote. O consentimento será revalidado no momento de cada envio.</p>
      <code>{preview.previewHash}</code>
      {preview.sample?.length > 0 && <div className="dino-campaign-sample"><strong>Amostra mascarada</strong>{preview.sample.map(item => <span key={item.customerId}>{item.name} · {item.phone}</span>)}</div>}
      <label className="dino-campaign-confirm"><input type="checkbox" checked={confirmation} onChange={event => setConfirmation(event.target.checked)} /> Confirmo o público, a mensagem, a finalidade de marketing e a base legal/consentimento do lote.</label>
      <label>Digite <strong>DISPARAR</strong> para liberar a confirmação<input value={confirmationText} onChange={event => setConfirmationText(event.target.value.toUpperCase())} /></label>
      <button type="button" onClick={confirmSend} disabled={busy || !confirmation || confirmationText !== 'DISPARAR' || !preview.summary?.eligible}>Confirmar e enfileirar {number(preview.summary?.eligible)} envio(s)</button>
    </section>}

    {metrics && <section className="dino-campaign-metrics" aria-label="Métricas da campanha">
      <h3>{metrics.campaign?.nome}</h3>
      <div className="dino-campaign-preview-grid">
        <div><small>Envio</small><strong>{rate(metrics.rates?.send)}</strong></div>
        <div><small>Entrega</small><strong>{rate(metrics.rates?.delivery)}</strong></div>
        <div><small>Leitura</small><strong>{rate(metrics.rates?.read)}</strong></div>
        <div><small>Resposta</small><strong>{rate(metrics.rates?.response)}</strong></div>
        <div><small>Conversão</small><strong>{rate(metrics.rates?.conversion)}</strong></div>
        <div><small>Receita atribuída</small><strong>{fmtR(metrics.campaign?.receita_atribuida || 0)}</strong></div>
      </div>
      <p>Conversões usam atribuição de último contato por telefone em janela de {metrics.attributionWindowDays} dias e somente pedidos Commerce confirmados.</p>
    </section>}

    <div className="dino-campaign-list">
      <h3>Histórico de campanhas</h3>
      {loading ? <p>Carregando campanhas…</p> : campaigns.length === 0 ? <p>Nenhuma campanha criada neste tenant e loja.</p> : campaigns.map(campaign => <article key={campaign.id}>
        <div><strong>{campaign.nome}</strong><span className={`status is-${campaign.status}`}>{STATUS_LABELS[campaign.status] || campaign.status}</span><small>{dateTime(campaign.criado_em)} · {number(campaign.qtd_enviados)} enviado(s) · {number(campaign.qtd_falhas)} bloqueio/falha(s)</small></div>
        <div className="actions"><button type="button" onClick={() => openMetrics(campaign)} disabled={busy}>Métricas</button>{['rascunho', 'confirmada', 'agendada'].includes(campaign.status) && <button type="button" onClick={() => openPreview(campaign)} disabled={busy}>Preview</button>}{['rascunho', 'confirmada', 'agendada', 'enviando'].includes(campaign.status) && <button type="button" className="danger" onClick={() => cancel(campaign)} disabled={busy}>Cancelar</button>}</div>
      </article>)}
    </div>
  </section>
}

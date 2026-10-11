import { useState } from 'react'
import { updateCoreStorefront } from './commerce-admin-adapter'
const FIELDS = [['privacyUrl','Privacidade'],['returnsUrl','Trocas e devoluções'],['shippingUrl','Entrega e retirada'],['termsUrl','Termos de uso']]
export default function StorefrontPolicies({ storefront, canWrite, onSaved }) {
  const existing = storefront.configuracoes?.public?.policies || {}
  const [values, setValues] = useState(() => Object.fromEntries(FIELDS.map(([key]) => [key, existing[key] || ''])))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event) {
    event.preventDefault()
    if (!canWrite || saving) return
    setSaving(true); setMessage('')
    try { await updateCoreStorefront(storefront.id, { publicPolicies: values }); setMessage('Links salvos. Confira as páginas na loja online.'); onSaved?.() }
    catch (error) { setMessage(error.message || 'Não foi possível salvar os links. Tente novamente.') }
    finally { setSaving(false) }
  }
  return <section className="ecommerce-admin-panel"><h2>Políticas da loja online</h2><p>Cadastre páginas aprovadas pela loja. Os links ficam públicos no rodapé; esta tela não cria textos jurídicos.</p><form onSubmit={submit} className="commerce-form-grid">{FIELDS.map(([key,label]) => <label key={key}>{label}<input name={key} type="url" placeholder="https://…" value={values[key]} onChange={event => setValues(current => ({...current,[key]:event.target.value}))} disabled={!canWrite || saving} /></label>)}<button type="submit" className="ecommerce-admin-button primary" disabled={!canWrite || saving}>{saving ? 'Salvando…' : 'Salvar links das políticas'}</button></form>{!canWrite && <p>Seu perfil pode consultar os links; edição exige permissão de configurações.</p>}{message && <p role="status">{message}</p>}</section>
}

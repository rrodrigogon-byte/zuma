import { Plus, Trash2 } from 'lucide-react'

function parseRules(value) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function csv(value) { return Array.isArray(value) ? value.join(', ') : String(value || '') }
function optionalNumber(value) { return value === '' ? undefined : value }

export default function OwnDeliveryRulesEditor({ value, onChange }) {
  const rules = parseRules(value)
  const commit = next => onChange(JSON.stringify(next, null, 2))
  const change = (index, field, nextValue) => commit(rules.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, [field]: nextValue } : rule))
  const add = () => commit([...rules, { id: `faixa-${rules.length + 1}`, label: '', cities: [], ufs: [], cepFrom: '', cepTo: '', amount: '', deliveryDays: 1, priority: rules.length ? 0 : 100 }])
  const remove = index => commit(rules.filter((_, ruleIndex) => ruleIndex !== index))

  return <section className="commerce-own-delivery-rules wide" aria-label="Faixas de entrega própria">
    <header><div><strong>Faixas de atendimento</strong><small>Cadastre cidade, UFs, região ou intervalo de CEP. Os valores são sempre revalidados no servidor.</small></div><button type="button" className="ecommerce-admin-button ghost" onClick={add}><Plus size={14} /> Adicionar faixa</button></header>
    {rules.map((rule, index) => <article key={`${rule.id || 'faixa'}-${index}`} className="commerce-own-delivery-rule">
      <div className="commerce-own-delivery-rule-heading"><strong>Faixa {index + 1}</strong><label className="commerce-checkbox"><input type="checkbox" checked={rule.fallback === true} onChange={event => change(index, 'fallback', event.target.checked)} /> Usar como fallback</label><button type="button" onClick={() => remove(index)} aria-label={`Remover faixa ${index + 1}`}><Trash2 size={14} /></button></div>
      <div className="ecommerce-admin-form-grid">
        <label>Identificador<input required value={rule.id || ''} onChange={event => change(index, 'id', event.target.value)} placeholder="ex.: centro" /></label>
        <label>Nome da opção<input required value={rule.label || ''} onChange={event => change(index, 'label', event.target.value)} placeholder="ex.: Centro e bairros próximos" /></label>
        <label>CEP inicial<input inputMode="numeric" value={rule.cepFrom || ''} onChange={event => change(index, 'cepFrom', event.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="00000000" /></label>
        <label>CEP final<input inputMode="numeric" value={rule.cepTo || ''} onChange={event => change(index, 'cepTo', event.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="00000000" /></label>
        <label>UFs, separadas por vírgula<input value={csv(rule.ufs || rule.uf)} onChange={event => change(index, 'ufs', event.target.value)} placeholder="MT, GO, MS" /></label>
        <label>Regiões brasileiras<input value={csv(rule.regions || rule.region)} onChange={event => change(index, 'regions', event.target.value)} placeholder="centro-oeste, sudeste" /></label>
        <label className="wide">Cidades, separadas por vírgula<input value={csv(rule.cities)} onChange={event => change(index, 'cities', event.target.value)} placeholder="Tangará da Serra, Nova Olímpia" /></label>
        <label>Valor fixo da faixa (R$)<input type="number" min="0" step="0.01" value={rule.amount ?? ''} onChange={event => change(index, 'amount', optionalNumber(event.target.value))} /></label>
        <label>Zona do motoboy<input type="number" min="0" step="1" value={rule.zone ?? ''} onChange={event => change(index, 'zone', optionalNumber(event.target.value))} /></label>
        <label>Distância estimada (km)<input type="number" min="0" step="0.1" value={rule.distanceKm ?? ''} onChange={event => change(index, 'distanceKm', optionalNumber(event.target.value))} /></label>
        <label>Prazo (dias úteis)<input required type="number" min="1" max="90" step="1" value={rule.deliveryDays ?? 1} onChange={event => change(index, 'deliveryDays', event.target.value)} /></label>
        <label>Prioridade<input type="number" step="1" value={rule.priority ?? 0} onChange={event => change(index, 'priority', event.target.value)} /></label>
      </div>
    </article>)}
    {!rules.length && <p className="commerce-admin-help">Nenhuma faixa cadastrada. Motoboy e tabela regional exigem ao menos uma faixa explícita antes de salvar.</p>}
    <details><summary>JSON avançado das faixas</summary><textarea rows="7" value={value} onChange={event => onChange(event.target.value)} aria-label="JSON avançado das faixas" /></details>
  </section>
}

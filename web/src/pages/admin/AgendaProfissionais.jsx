export function profissionaisSelecionados(valor = '') { return [...new Set(String(valor).split(',').map(s => s.trim()).filter(Boolean))] }
export function alternarProfissional(valor, id) {
  const ids = profissionaisSelecionados(valor)
  return (ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]).join(',')
}
export default function AgendaProfissionais({ profissionais = [], value = '', onChange, label = 'Profissionais da agenda' }) {
  const ids = profissionaisSelecionados(value)
  return <div role="group" aria-label={label} className="dino-cal-professionals"><span>{label}</span><div>
    <button type="button" aria-pressed={!ids.length} onClick={() => onChange?.('')}>Toda a equipe</button>
    {profissionais.map(p => <button type="button" key={p.id} aria-pressed={ids.includes(p.id)} onClick={() => onChange?.(alternarProfissional(value, p.id))}>{p.nome}{p.ativo === false ? ' (inativo)' : ''}</button>)}
  </div><small>Toque em um nome para ver só ele. Acrescente outros para comparar.</small></div>
}

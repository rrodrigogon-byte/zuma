import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtR } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { downloadCsv } from './format'
const TYPES = { services: 'Serviços', products: 'Produtos', plans: 'Pacotes', tips: 'Gorjetas' }
export default function AvecMixReport() {
  const { empresaAtiva, lojaAtiva, isPlatformAdmin } = useAuth()
  const [data, setData] = useState(null), [error, setError] = useState(''), [draft, setDraft] = useState({ inicio: '', fim: '' }), [range, setRange] = useState({}), [limit, setLimit] = useState(50)
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError(''); setLimit(50)
    api.get(`/api/admin/barbearia/avec-mix/report?${new URLSearchParams(range)}`, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return
      setData(result)
      if (result.available) setDraft({ inicio: result.from, fim: result.to })
    }).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [empresaAtiva?.id, lojaAtiva?.id, range])
  const rows = data?.details || []
  function exportAll() { downloadCsv('historico_completo_mix_avec.csv', rows.map(row => ({ empresa: empresaAtiva?.nome, unidade: lojaAtiva?.nome, de: data.from, ate: data.to, item: row.name, tipo: TYPES[row.type], categoria: row.category, quantidade: row.quantity, registros: row.records, valor_apos_desconto: row.value, origem: 'Avec 0186 — data de venda', arquivo: data.reportHash }))) }
  return <main style={{ padding: 24 }}><h1>Mix histórico completo Avec</h1><p>{empresaAtiva?.nome} · {lojaAtiva?.nome}</p><p>Vendas itemizadas por data: serviços, produtos, pacotes e gorjetas. Este relatório não acrescenta valores ao caixa consolidado.</p><fieldset><legend>Período</legend><label>De <input type="date" value={draft.inicio} onChange={e => setDraft(value => ({ ...value, inicio: e.target.value }))} /></label> <label>Até <input type="date" value={draft.fim} onChange={e => setDraft(value => ({ ...value, fim: e.target.value }))} /></label> <button disabled={!draft.inicio || !draft.fim || draft.inicio > draft.fim} onClick={() => setRange({ ...draft })}>Aplicar período</button> <button onClick={() => setRange({})}>Todo o histórico</button></fieldset>{error && <p role="alert">{error}</p>}{!error && !data && <p role="status">Carregando histórico…</p>}{data?.available === false && <p>O relatório auditado ainda não foi aplicado nesta unidade.</p>}{data?.available && <><h2>{fmtR(data.total)} no período de {data.from} a {data.to}</h2><dl>{Object.entries(TYPES).map(([type,label]) => <div key={type}><dt>{label}</dt><dd>{fmtR(rows.filter(row => row.type === type).reduce((sum,row) => sum + row.value,0))}</dd></div>)}</dl><p>Origem completa disponível: {data.summary.from} a {data.summary.to}; {data.summary.includedRows} de {data.summary.sourceRows} linhas classificadas. {data.summary.heldRows} linhas retidas para conferência ({fmtR(data.summary.heldCents / 100)}), fora das fatias.</p><button disabled={!rows.length} onClick={exportAll}>Exportar todos os itens do período (CSV)</button><div style={{ overflowX:'auto' }}><table><caption>Itens classificados — valor da linha menos desconto</caption><thead><tr><th>Item</th><th>Tipo</th><th>Categoria</th><th>Quantidade</th><th>Registros</th><th>Valor</th></tr></thead><tbody>{rows.slice(0,limit).map(row => <tr key={JSON.stringify([row.type,row.name,row.category])}><td>{row.name}</td><td>{TYPES[row.type]}</td><td>{row.category}</td><td>{row.quantity}</td><td>{row.records}</td><td>{fmtR(row.value)}</td></tr>)}</tbody></table></div>{rows.length > limit && <button onClick={() => setLimit(value => value + 50)}>Mostrar mais 50 itens</button>}<p>Exibindo {Math.min(limit,rows.length)} de {rows.length}; o CSV contém o recorte completo.</p><small>Arquivo de origem: {data.reportHash}</small></>}<p><Link to="/admin/bi">Voltar ao BI</Link>{isPlatformAdmin && <> · <Link to="/admin/avec-historico">Conferir importação</Link></>}</p></main>
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtR } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'

export default function AvecMixImport() {
  const { empresaAtiva, lojaAtiva } = useAuth()
  const [report, setReport] = useState(null), [preview, setPreview] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(false)
  const scopeKey = `${empresaAtiva?.id || ''}:${lojaAtiva?.id || ''}`
  const validPreview = preview?.scopeKey === scopeKey ? preview : null
  async function selectFile(event) {
    setReport(null); setPreview(null); setError(''); setDone(false)
    try { const file = event.target.files?.[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) throw new Error('Arquivo excede 10 MB.'); setReport(JSON.parse(await file.text())) } catch (e) { setError(e.message) }
  }
  async function submit(apply) {
    setBusy(true); setError('')
    try {
      const result = await api.post(`/api/admin/barbearia/avec-mix/${apply ? 'apply' : 'preview'}`, { report, ...(apply ? { confirm: true, expectedPreviousHash: validPreview.previousHash, expectedReportHash: validPreview.reportHash } : {}) })
      if (apply) setDone(true)
      else setPreview({ ...result, scopeKey })
    } catch (e) { setError(e.message); setPreview(null) } finally { setBusy(false) }
  }
  return <main style={{ padding: 24, maxWidth: 1000 }}><h1>Histórico do mix Avec</h1><p>Empresa: {empresaAtiva?.nome || 'Selecione a Dino'} · Unidade: {lojaAtiva?.nome || 'Selecione Dino matriz'}</p><p>Importação analítica do relatório 0186 auditado, de 05/06/2025 a 23/10/2026. Recupera serviços, produtos, pacotes e gorjetas nos relatórios. Não cria recebimentos, comandas ou movimentações de estoque.</p><label>Exportação JSON original <input type="file" accept=".json,application/json" onChange={selectFile} disabled={busy} /></label><p><button type="button" disabled={!report || busy} onClick={() => submit(false)}>Conferir arquivo sem aplicar</button></p>{error && <p role="alert">{error}</p>}{validPreview && <section><h2>Conferência</h2><p>{validPreview.summary.sourceRows} linhas de origem; {validPreview.summary.includedRows} linhas classificadas; {validPreview.summary.heldRows} linhas retidas para análise ({fmtR(validPreview.summary.heldCents / 100)}).</p><p>Base classificada em todo o histórico: <strong>{fmtR(validPreview.summary.includedCents / 100)}</strong>. Quantidade: soma de “Qtd.”; receita: “Valor” menos “Desconto”, sem multiplicar novamente pela quantidade.</p><p>Datas: {validPreview.summary.from} a {validPreview.summary.to}. Repetições exatas, quantidades inválidas e descontos inconsistentes ficam fora das fatias.</p><p>Dentro dessas datas, o Avec será a fonte exclusiva do mix para evitar sobreposição. O caixa consolidado permanece calculado pelos recebimentos.</p><p>Arquivo: <code>{validPreview.reportHash}</code></p>{validPreview.alreadyApplied ? <p>Este arquivo já está aplicado. Nenhum acréscimo será feito.</p> : <button type="button" disabled={busy || done} onClick={() => submit(true)}>Aplicar histórico analítico conferido</button>}</section>}{done && <p role="status">Histórico aplicado. Nenhum lançamento financeiro ou movimento de estoque criado.</p>}<p><Link to="/admin/barbearia-erp?area=operacao&tab=Vis%C3%A3o+geral">Abrir painel e conferir o mix</Link></p><p><Link to="/admin/bi">Abrir relatórios</Link></p></main>
}

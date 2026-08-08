import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

function Metric({ label, value, detail, color = '#FF6B2C' }) {
  return <div className="card" style={{ flex: 1, minWidth: 165, borderLeft: `4px solid ${color}`, padding: '15px 17px' }}>
    <div style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 800, letterSpacing: '.05em' }}>{label}</div>
    <div style={{ color, fontSize: 22, fontWeight: 850, marginTop: 5 }}>{value}</div>
    <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>{detail}</div>
  </div>
}

function exportCsv(report) {
  const rows = [['Data', 'Vendas aprovadas', 'Recebimentos'], ...(report.vendas.serieDiaria || []).map((item) => [item.data, item.vendas, item.recebimentos])]
  const content = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob); const link = document.createElement('a')
  link.href = url; link.download = `relatorio_operacional_${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url)
}

export default function RelatoriosOperacionais() {
  const { toast } = useToast()
  const [days, setDays] = useState('30')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const end = new Date(); const start = new Date(end)
      start.setDate(start.getDate() - Number(days) + 1); start.setHours(0, 0, 0, 0)
      const result = await api.get(`/api/admin/relatorios/operacional?dataInicio=${encodeURIComponent(start.toISOString())}&dataFim=${encodeURIComponent(end.toISOString())}`)
      setReport(result.relatorio)
    } catch (error) { toast(error.message || 'Falha ao gerar relatório operacional.', 'error') }
    finally { setLoading(false) }
  }, [days, toast])

  useEffect(() => { load() }, [load])
  const max = useMemo(() => Math.max(...(report?.vendas?.serieDiaria || []).flatMap((d) => [d.vendas, d.recebimentos]), 1), [report])

  return <div className="page">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
      <div><h1 className="page-title" style={{ marginBottom: 5 }}>Relatórios Operacionais</h1><p style={{ margin: 0, color: 'var(--muted)' }}>Dados de vendas, estoque e financeiro exclusivamente da empresa ativa.</p></div>
      <div style={{ display: 'flex', gap: 8 }}><select className="btn btn-secondary btn-sm" value={days} onChange={(e) => setDays(e.target.value)}><option value="7">7 dias</option><option value="30">30 dias</option></select><button className="btn btn-secondary btn-sm" onClick={load}>↺ Atualizar</button><button className="btn btn-primary btn-sm" disabled={!report} onClick={() => exportCsv(report)}>⇩ CSV</button></div>
    </div>
    {loading ? <div className="card" style={{ color: 'var(--muted)' }}>Gerando os indicadores reais da empresa ativa…</div> : !report ? <div className="card">Relatório indisponível.</div> : <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Metric label="VENDAS APROVADAS" value={fmtR(report.vendas.aprovadas)} detail={`${report.vendas.transacoes} transações confirmadas`} color="#16806b" />
        <Metric label="PAGAMENTOS PENDENTES" value={fmtR(report.vendas.pendentes)} detail="Aguardando confirmação do provedor" color="#c47a00" />
        <Metric label="A RECEBER" value={fmtR(report.financeiro.aReceber)} detail={`${report.financeiro.contasAbertas} conta(s) aberta(s)`} color="#12283F" />
        <Metric label="VENCIDO" value={fmtR(report.financeiro.vencido)} detail="Contas em atraso" color="#b23a48" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 16 }}>
        <section className="card"><h2 style={{ fontSize: 16, color: '#12283F', margin: '0 0 15px' }}>Vendas e recebimentos por dia</h2><div style={{ height: 190, display: 'flex', alignItems: 'end', gap: 4 }}>{report.vendas.serieDiaria.map((item) => <div key={item.data} title={`${item.data}: ${fmtR(item.vendas)}`} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'end', gap: 2 }}><span style={{ flex: 1, minHeight: 2, height: `${Math.max(2, item.vendas / max * 100)}%`, background: '#FF6B2C', borderRadius: '4px 4px 0 0' }} /><span style={{ flex: 1, minHeight: 2, height: `${Math.max(2, item.recebimentos / max * 100)}%`, background: '#12283F', borderRadius: '4px 4px 0 0' }} /></div>)}</div><div style={{ marginTop: 11, display: 'flex', gap: 12, color: 'var(--muted)', fontSize: 11 }}><span>■ Laranja: vendas</span><span>■ Azul: recebimentos</span></div></section>
        <section className="card"><h2 style={{ fontSize: 16, color: '#12283F', margin: '0 0 15px' }}>Estoque</h2><div style={{ display: 'grid', gap: 10, color: 'var(--muted)', fontSize: 13 }}><div>Itens de cardápio: <strong style={{ color: '#12283F' }}>{report.estoque.itensCatalogo}</strong></div><div>Itens controlados: <strong style={{ color: '#12283F' }}>{report.estoque.itensControlados}</strong></div><div>Sem estoque: <strong style={{ color: report.estoque.semEstoque ? '#b23a48' : '#16806b' }}>{report.estoque.semEstoque}</strong></div><div>Abaixo do mínimo: <strong style={{ color: report.estoque.baixo.length ? '#c47a00' : '#16806b' }}>{report.estoque.baixo.length}</strong></div></div></section>
      </div>
      <section className="card" style={{ marginTop: 16 }}><h2 style={{ fontSize: 16, color: '#12283F', margin: '0 0 12px' }}>Receita por meio de pagamento</h2><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{Object.entries(report.vendas.porMetodo || {}).map(([metodo, valor]) => <div key={metodo} style={{ padding: '10px 13px', background: 'var(--surface-2)', borderRadius: 8, minWidth: 130 }}><div style={{ color: 'var(--muted)', textTransform: 'capitalize', fontSize: 11 }}>{metodo}</div><strong style={{ color: '#12283F' }}>{fmtR(valor)}</strong></div>)}</div></section>
    </>}
  </div>
}

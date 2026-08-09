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
  const [metricas, setMetricas] = useState(null)
  const [analise, setAnalise] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const end = new Date(); const start = new Date(end)
      start.setDate(start.getDate() - Number(days) + 1); start.setHours(0, 0, 0, 0)
      const periodo = Number(days) === 7 ? 'semana' : 'mes'
      const [result, metricasRes, analiseRes] = await Promise.all([
        api.get(`/api/admin/relatorios/operacional?dataInicio=${encodeURIComponent(start.toISOString())}&dataFim=${encodeURIComponent(end.toISOString())}`),
        api.get(`/api/admin/metricas/operacional?periodo=${periodo}`),
        api.get(`/api/admin/analytics/vendas?periodo=${periodo}`),
      ])
      setReport(result.relatorio)
      setMetricas(metricasRes?.ok ? metricasRes : null)
      setAnalise(analiseRes?.ok ? analiseRes.analise : null)
    } catch (error) { toast(error.message || 'Falha ao gerar relatório operacional.', 'error') }
    finally { setLoading(false) }
  }, [days, toast])

  useEffect(() => { load() }, [load])
  const max = useMemo(() => Math.max(...(report?.vendas?.serieDiaria || []).flatMap((d) => [d.vendas, d.recebimentos]), 1), [report])
  const receitaCan = metricas?.faturamento || {}
  const estoqueCan = metricas?.estoque || {}

  return <div className="page">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
      <div><h1 className="page-title" style={{ marginBottom: 5 }}>Relatórios Operacionais</h1><p style={{ margin: 0, color: 'var(--muted)' }}>Dados de vendas, estoque e financeiro exclusivamente da empresa ativa.</p></div>
      <div style={{ display: 'flex', gap: 8 }}><select className="btn btn-secondary btn-sm" value={days} onChange={(e) => setDays(e.target.value)}><option value="7">7 dias</option><option value="30">30 dias</option></select><button className="btn btn-secondary btn-sm" onClick={load}>↺ Atualizar</button><button className="btn btn-primary btn-sm" disabled={!report} onClick={() => exportCsv(report)}>⇩ CSV</button></div>
    </div>
    {loading ? <div className="card" style={{ color: 'var(--muted)' }}>Gerando os indicadores reais da empresa ativa…</div> : !report ? <div className="card">Relatório indisponível.</div> : <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Metric label="VENDAS APROVADAS" value={fmtR(receitaCan.total ?? report.vendas.aprovadas)} detail={`${receitaCan.quantidade ?? report.vendas.transacoes} transações confirmadas · ${metricas?.periodo?.nome || 'período selecionado'}`} color="#16806b" />
        <Metric label="PAGAMENTOS PENDENTES" value={fmtR(report.vendas.pendentes)} detail="Aguardando confirmação do provedor" color="#c47a00" />
        <Metric label="A RECEBER" value={fmtR(report.financeiro.aReceber)} detail={`${report.financeiro.contasAbertas} conta(s) aberta(s)`} color="#12283F" />
        <Metric label="VENCIDO" value={fmtR(report.financeiro.vencido)} detail="Contas em atraso" color="#b23a48" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 16 }}>
        <section className="card"><h2 style={{ fontSize: 16, color: '#12283F', margin: '0 0 15px' }}>Vendas e recebimentos por dia</h2><div style={{ height: 190, display: 'flex', alignItems: 'end', gap: 4 }}>{report.vendas.serieDiaria.map((item) => <div key={item.data} title={`${item.data}: ${fmtR(item.vendas)}`} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'end', gap: 2 }}><span style={{ flex: 1, minHeight: 2, height: `${Math.max(2, item.vendas / max * 100)}%`, background: '#FF6B2C', borderRadius: '4px 4px 0 0' }} /><span style={{ flex: 1, minHeight: 2, height: `${Math.max(2, item.recebimentos / max * 100)}%`, background: '#12283F', borderRadius: '4px 4px 0 0' }} /></div>)}</div><div style={{ marginTop: 11, display: 'flex', gap: 12, color: 'var(--muted)', fontSize: 11 }}><span>■ Laranja: vendas</span><span>■ Azul: recebimentos</span></div></section>
        <section className="card"><h2 style={{ fontSize: 16, color: '#12283F', margin: '0 0 15px' }}>Estoque</h2><div style={{ display: 'grid', gap: 10, color: 'var(--muted)', fontSize: 13 }}><div>Itens de cardápio: <strong style={{ color: '#12283F' }}>{estoqueCan.total ?? report.estoque.itensCatalogo}</strong></div><div>Itens controlados: <strong style={{ color: '#12283F' }}>{estoqueCan.total ?? report.estoque.itensControlados}</strong></div><div>Sem estoque: <strong style={{ color: (estoqueCan.semEstoque ?? report.estoque.semEstoque) ? '#b23a48' : '#16806b' }}>{estoqueCan.semEstoque ?? report.estoque.semEstoque}</strong></div><div>Abaixo do mínimo: <strong style={{ color: (estoqueCan.baixo ?? report.estoque.baixo.length) ? '#c47a00' : '#16806b' }}>{estoqueCan.baixo ?? report.estoque.baixo.length}</strong></div></div></section>
      </div>
      <section className="card" style={{ marginTop: 16 }}><h2 style={{ fontSize: 16, color: '#12283F', margin: '0 0 12px' }}>Receita por meio de pagamento</h2><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{Object.entries(report.vendas.porMetodo || {}).map(([metodo, valor]) => <div key={metodo} style={{ padding: '10px 13px', background: 'var(--surface-2)', borderRadius: 8, minWidth: 130 }}><div style={{ color: 'var(--muted)', textTransform: 'capitalize', fontSize: 11 }}>{metodo}</div><strong style={{ color: '#12283F' }}>{fmtR(valor)}</strong></div>)}</div></section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16, marginTop: 16 }}>
        <section className="card"><h2 style={{ fontSize: 16, color: '#12283F', margin: '0 0 12px' }}>Mais vendidos</h2>{(analise?.maisVendidos || []).length === 0 ? <p style={{ color: 'var(--muted)' }}>Sem vendas fechadas no período.</p> : <div style={{ display: 'grid', gap: 8 }}>{analise.maisVendidos.slice(0, 5).map((item, index) => <div key={item.produtoId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}><span><strong style={{ color: '#FF6B2C' }}>{index + 1}.</strong> {item.nome}<small style={{ color: 'var(--muted)' }}> · {item.qtd} un.</small></span><strong style={{ color: '#12283F' }}>{fmtR(item.faturamento)}</strong></div>)}</div>}</section>
        <section className="card"><h2 style={{ fontSize: 16, color: '#12283F', margin: '0 0 12px' }}>Horário de pico</h2><div style={{ color: '#FF6B2C', fontSize: 30, fontWeight: 850 }}>{String(analise?.horarioPico?.hora ?? 0).padStart(2, '0')}:00</div><p style={{ color: 'var(--muted)', margin: '6px 0 0', fontSize: 13 }}>{analise?.horarioPico?.vendas || 0} venda(s) · {fmtR(analise?.horarioPico?.faturamento || 0)} no período selecionado.</p></section>
        <section className="card"><h2 style={{ fontSize: 16, color: '#12283F', margin: '0 0 12px' }}>Curva ABC</h2>{(analise?.curvaABC || []).length === 0 ? <p style={{ color: 'var(--muted)' }}>Sem itens vendidos no período.</p> : <div style={{ display: 'grid', gap: 7 }}>{analise.curvaABC.slice(0, 6).map(item => <div key={item.produtoId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span><b style={{ color: item.classe === 'A' ? '#16806b' : item.classe === 'B' ? '#c47a00' : '#6b7280' }}>{item.classe}</b> · {item.nome}</span><span style={{ color: 'var(--muted)' }}>{item.participacao}%</span></div>)}</div>}</section>
      </div>
    </>}
  </div>
}

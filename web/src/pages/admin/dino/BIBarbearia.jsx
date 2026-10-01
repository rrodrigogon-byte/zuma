import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../lib/api'
import { useAuth } from '../../../lib/auth'
import { Table } from '../customer360/shared'
import { downloadCsv, int, money, pct } from './format'
import '../customer360.css'
import './dino-admin.css'

const PERIODS = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias']]
const DAYS = [['seg', 'Seg'], ['ter', 'Ter'], ['qua', 'Qua'], ['qui', 'Qui'], ['sex', 'Sex'], ['sab', 'Sáb'], ['dom', 'Dom']]
const METODOS = { pix: 'Pix', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito', cartao: 'Cartão', conta: 'Na conta', 'não informado': 'Não informado' }

function Bars({ items, valueKey = 'receita', labelKey = 'nome', format = money, empty }) {
  const max = Math.max(1, ...items.map((item) => Number(item[valueKey] || 0)))
  if (!items.length) return <p className="c360-empty">{empty}</p>
  return <ul className="dadm-bars">
    {items.map((item) => <li key={item.id || item[labelKey]} title={`${item[labelKey]}: ${format(item[valueKey])}${item.quantidade != null ? ` · ${int(item.quantidade)} un.` : ''}`}>
      <span className="label">{item[labelKey]}</span>
      <span className="track"><span className="fill" style={{ width: `${(Number(item[valueKey] || 0) / max) * 100}%`, display: 'block' }} /></span>
      <span className="value">{format(item[valueKey])}</span>
    </li>)}
  </ul>
}

function Heatmap({ cells }) {
  const hours = Array.from({ length: 13 }, (_, index) => index + 8)
  const max = Math.max(1, ...cells.map((cell) => cell.valor))
  const value = (dia, hora) => cells.find((cell) => cell.dia === dia && cell.hora === hora)?.valor || 0
  if (!cells.length) return <p className="c360-empty">Sem agendamentos no período.</p>
  return <div className="dadm-heat" style={{ '--cols': hours.length }} role="table" aria-label="Agendamentos por dia da semana e hora">
    <span />{hours.map((hora) => <span key={hora} className="hd" role="columnheader">{hora}h</span>)}
    {DAYS.map(([dia, label]) => [<span key={dia} role="rowheader">{label}</span>, ...hours.map((hora) => {
      const total = value(dia, hora)
      return <span key={`${dia}-${hora}`} role="cell" className={`cell${total ? '' : ' zero'}`} style={total ? { opacity: 0.25 + 0.75 * (total / max) } : undefined} title={`${label} ${hora}h: ${total} agendamento(s)`} aria-label={`${label} ${hora}h: ${total}`} />
    })])}
  </div>
}

export default function BIBarbearia() {
  const { empresaAtiva } = useAuth()
  const [periodo, setPeriodo] = useState(30)
  const [bi, setBi] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try { setBi(await api.get(`/api/admin/barbearia/bi?periodo=${periodo}`)); setErro('') }
    catch (error) { setErro(error.message || 'Não foi possível carregar o BI.') }
    finally { setLoading(false) }
  }, [periodo])
  useEffect(() => { load() }, [load, empresaAtiva?.id])

  const r = bi?.resultado
  const atendimentos = (bi?.servicos || []).reduce((sum, item) => sum + item.quantidade, 0)
  const receitaServicos = r?.receitaServicos || 0

  function exportar() {
    if (!bi) return
    downloadCsv(`bi_barbearia_${periodo}d.csv`, [
      ...bi.servicos.map((item) => ({ bloco: 'Serviço', nome: item.nome, quantidade: item.quantidade, receita: item.receita, custo: '', margem: '' })),
      ...bi.revenda.map((item) => ({ bloco: 'Revenda', nome: item.nome, quantidade: item.quantidade, receita: item.receita, custo: item.custo, margem: item.margem ?? '' })),
      ...bi.profissionais.map((item) => ({ bloco: 'Profissional', nome: item.nome, quantidade: item.atendimentos, receita: item.receita, custo: item.comissaoEstimada, margem: '' })),
    ])
  }

  return <div className="dadm-page">
    <header className="dadm-head">
      <div><div className="dadm-eyebrow">Visão do negócio · {empresaAtiva?.nome || 'Empresa'}</div><h1>BI & Analytics</h1><p>O que vende, quem produz, quando a agenda enche e quanto sobra depois de comissões, custo de produtos e despesas.</p></div>
      <div className="dadm-actions">
        <div className="c360-chips" role="group" aria-label="Período">{PERIODS.map(([value, label]) => <button key={value} type="button" className={periodo === value ? 'active' : ''} aria-pressed={periodo === value} onClick={() => setPeriodo(value)}>{label}</button>)}</div>
        <button type="button" className="c360-btn ghost" onClick={exportar} disabled={!bi}>Exportar CSV</button>
      </div>
    </header>
    {erro && <p className="dadm-note danger" role="alert">{erro}</p>}
    {loading && !bi && <p className="dadm-muted">Carregando…</p>}
    {bi && <>
      <section className="dadm-kpis" aria-label="Indicadores do período">
        <article><span>Receita</span><strong>{money(r.receita)}</strong><small>Serviços {money(r.receitaServicos)} · Revenda {money(r.receitaRevenda)}</small></article>
        <article className={r.resultado < 0 ? 'is-alert' : ''}><span>Resultado estimado</span><strong>{money(r.resultado)}</strong><small>Margem {pct(r.margem)}</small></article>
        <article><span>Atendimentos</span><strong>{int(atendimentos)}</strong><small>Ticket médio {money(atendimentos ? receitaServicos / atendimentos : 0)}</small></article>
        <article className={bi.agenda.taxaComparecimento != null && bi.agenda.taxaComparecimento < 85 ? 'is-alert' : ''}><span>Comparecimento</span><strong>{pct(bi.agenda.taxaComparecimento)}</strong><small>{int(bi.agenda.faltas)} falta(s) · {int(bi.agenda.cancelados)} cancelado(s)</small></article>
        <article><span>Clientes atendidos</span><strong>{int(bi.clientes.ativos)}</strong><small>{pct(bi.clientes.taxaRecorrencia)} voltaram no período</small></article>
        <article><span>Agenda online</span><strong>{pct(bi.agenda.participacaoOnline)}</strong><small>{int(bi.agenda.online)} de {int(bi.agenda.total)} agendamentos</small></article>
      </section>

      <div className="dadm-grid">
        <section className="dadm-card">
          <h2>Resultado estimado</h2>
          <dl className="dadm-result">
            <div><dt>(+) Receita</dt><dd>{money(r.receita)}</dd></div>
            <div><dt>(−) Comissões dos profissionais</dt><dd>{money(r.comissoes)}</dd></div>
            <div><dt>(−) Custo da revenda vendida</dt><dd>{money(r.cmvRevenda)}</dd></div>
            {r.custoLoja > 0 && <div><dt>(−) Custo da loja online</dt><dd>{money(r.custoLoja)}</dd></div>}
            <div><dt>(−) Despesas pagas no Financeiro</dt><dd>{money(r.despesasPagas)}</dd></div>
            <div className="total"><dt>= Resultado</dt><dd className={r.resultado < 0 ? 'dadm-neg' : ''}>{money(r.resultado)}</dd></div>
          </dl>
          {r.notas?.map((nota) => <p key={nota} className="dadm-muted" style={{ margin: 0 }}>{nota}</p>)}
          <Link className="dadm-muted" to="/admin/financeiro">Lançar despesas no Financeiro →</Link>
        </section>
        <section className="dadm-card">
          <h2>Serviços que mais faturam</h2>
          <Bars items={bi.servicos.slice(0, 8)} empty="Nenhum serviço concluído ou pago no período." />
        </section>
      </div>

      <section className="dadm-card">
        <h2>Profissionais</h2>
        <Table caption="Desempenho por profissional" rows={bi.profissionais} empty="Sem produção no período." columns={[
          { key: 'nome', label: 'Profissional' },
          { key: 'atendimentos', label: 'Atendimentos', align: 'right', render: (item) => int(item.atendimentos) },
          { key: 'receitaServicos', label: 'Serviços', align: 'right', render: (item) => money(item.receitaServicos) },
          { key: 'receitaProdutos', label: 'Produtos', align: 'right', render: (item) => money(item.receitaProdutos) },
          { key: 'ticketMedio', label: 'Ticket médio', align: 'right', render: (item) => money(item.ticketMedio) },
          { key: 'comissaoEstimada', label: 'Comissão estimada', align: 'right', render: (item) => money(item.comissaoEstimada) },
        ]} />
      </section>

      <div className="dadm-grid">
        <section className="dadm-card">
          <h2>Quando a agenda enche</h2>
          <p>Agendamentos (sem cancelados e faltas) por dia da semana e hora, no fuso de Cuiabá.</p>
          <Heatmap cells={bi.agenda.heatmap} />
        </section>
        <section className="dadm-card">
          <h2>Formas de pagamento</h2>
          <Bars items={bi.pagamentos.map((item) => ({ ...item, nome: METODOS[item.metodo] || item.metodo }))} valueKey="valor" empty="Nenhum pagamento no período." />
        </section>
      </div>

      <div className="dadm-grid">
        <section className="dadm-card">
          <h2>Clientes</h2>
          <dl className="dadm-result">
            <div><dt>Clientes atendidos</dt><dd>{int(bi.clientes.ativos)}</dd></div>
            <div><dt>Voltaram no período (2+ visitas)</dt><dd>{int(bi.clientes.recorrentes)}</dd></div>
            <div><dt>Novos cadastros</dt><dd>{int(bi.clientes.novosCadastros)}</dd></div>
            <div><dt>Intervalo médio entre visitas</dt><dd>{bi.clientes.intervaloMedioDias == null ? '—' : `${String(bi.clientes.intervaloMedioDias).replace('.', ',')} dias`}</dd></div>
            <div><dt>Atendimentos sem cliente identificado</dt><dd className={bi.clientes.atendimentosSemCliente ? 'dadm-neg' : ''}>{int(bi.clientes.atendimentosSemCliente)}</dd></div>
          </dl>
          {bi.clientes.atendimentosSemCliente > 0 && <p className="dadm-note warn">Atendimentos sem nome e telefone não entram na recorrência nem na fidelidade. Informe o telefone ao agendar ou abrir a comanda: o cadastro é criado sozinho.</p>}
          <Link className="dadm-muted" to="/admin/clientes-360">Abrir carteira de clientes →</Link>
        </section>
        <section className="dadm-card">
          <h2>Revenda</h2>
          <Table caption="Produtos de revenda" rows={bi.revenda.slice(0, 8)} empty="Nenhuma venda de revenda no período." columns={[
            { key: 'nome', label: 'Produto' },
            { key: 'quantidade', label: 'Qtd.', align: 'right', render: (item) => int(item.quantidade) },
            { key: 'receita', label: 'Receita', align: 'right', render: (item) => money(item.receita) },
            { key: 'margem', label: 'Margem', align: 'right', render: (item) => item.margem == null ? <span className="dadm-muted">sem custo</span> : pct(item.margem) },
          ]} />
        </section>
      </div>

      <div className="dadm-grid">
        <section className="dadm-card">
          <h2>Loja online</h2>
          {bi.lojaOnline.disponivel ? <>
            <p>{money(bi.lojaOnline.receita)} em {int(bi.lojaOnline.pedidos)} pedido(s) no período.</p>
            <Bars items={bi.lojaOnline.topProdutos} empty="Nenhum produto vendido no período." />
          </> : <p className="c360-empty">Loja online indisponível para o seu perfil ou desativada.</p>}
        </section>
        <section className="dadm-card">
          <h2>Despesas por categoria</h2>
          <Bars items={bi.financeiro.despesasPorCategoria.map((item) => ({ ...item, nome: item.categoria }))} valueKey="valor" empty="Nenhuma despesa paga no período." />
          <p className="dadm-muted" style={{ margin: 0 }}>Receitas pagas {money(bi.financeiro.receitasPagas)} · despesas pagas {money(bi.financeiro.despesasPagas)} · saldo {money(bi.financeiro.saldo)}</p>
        </section>
      </div>
    </>}
  </div>
}

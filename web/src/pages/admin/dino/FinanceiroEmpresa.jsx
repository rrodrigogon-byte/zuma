import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { useToast } from '../../../hooks/useToast'
import { useAuth } from '../../../lib/auth'
import EscolherUnidade, { useUnidadeAtiva } from '../../../components/EscolherUnidade'
import { useRazaoAtivo } from '../../../lib/razao-estado'
import { brandFromContext } from '../../../lib/brand'
import { Badge, Dialog, Table } from '../customer360/shared'
import { downloadCsv, localDay, money, moneyK, shortDate } from './format'
import ConciliacaoBancariaTab from "../financeiro/ConciliacaoBancariaTab"
import DreEbitdaCompletoPanel from "../financeiro/DreEbitdaCompletoPanel"
import ConciliacaoTefPixPanel from "../financeiro/ConciliacaoTefPixPanel"
import TesourariaCofrePanel from "../financeiro/TesourariaCofrePanel"
import '../customer360.css'
import './dino-admin.css'

const BASE = '/api/admin/barbearia/financeiro'
const EMPTY_FORM = { tipo: 'despesa', categoria: 'Outros', descricao: '', valor: '', vencimento: '', status: 'pendente', obs: '', meses: 1 }
const STATUS = { pendente: { label: 'Pendente', tone: 'warning' }, pago: { label: 'Pago', tone: 'success' }, cancelado: { label: 'Cancelado', tone: 'muted' } }
const ORIGENS = { manual: 'Manual', barbearia_atendimento: 'Atendimento', barbearia_comanda: 'Comanda', barbearia_revenda: 'Revenda', comanda: 'Comanda', contas_receber: 'Conta a receber', estoque: 'Estoque', revenda: 'Revenda', 'avec-import-financeiro-20261022': 'Histórico Avec' }

function FlowChart({ fluxo, mesSelecionado, onSelectMes }) {
  const max = Math.max(1, ...fluxo.flatMap((item) => [item.receitas, item.despesas]))
  return <figure className="dadm-flow" aria-label="Receitas e despesas pagas por mês" style={{ margin: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      <div className="dadm-legend">
        <span><i className="s-in" />Receitas pagas</span>
        <span><i className="s-out" />Despesas pagas</span>
        {mesSelecionado && <span style={{ color: 'var(--accent, #b0892e)', fontWeight: 700, marginLeft: 8 }}>
          ● Mês filtrado: {mesSelecionado.slice(5)}/{mesSelecionado.slice(0, 4)}
        </span>}
      </div>
      {mesSelecionado && (
        <button type="button" className="c360-btn ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => onSelectMes(null)}>
          Ver todos os meses ✕
        </button>
      )}
    </div>
    <div className="dadm-flow-plot" style={{ marginTop: 8 }}>
      {fluxo.map((item) => {
        const isSelected = mesSelecionado === item.mes
        return <div
          key={item.mes}
          className="dadm-flow-col"
          onClick={() => onSelectMes(isSelected ? null : item.mes)}
          style={{
            cursor: 'pointer',
            padding: '4px 2px',
            borderRadius: 6,
            background: isSelected ? 'var(--card2, rgba(176, 137, 46, 0.15))' : 'transparent',
            outline: isSelected ? '2px solid var(--accent, #b0892e)' : 'none',
            transition: 'all 0.15s ease',
          }}
          title={`${item.mes}: receitas ${money(item.receitas)} · despesas ${money(item.despesas)} · saldo ${money(item.saldo)} (Clique para filtrar)`}
        >
          <div className="dadm-flow-bars">
            <i className="s-in" style={{ height: `${(item.receitas / max) * 100}%` }} />
            <i className="s-out" style={{ height: `${(item.despesas / max) * 100}%` }} />
          </div>
          <small style={{ fontWeight: isSelected ? 800 : 500, color: isSelected ? 'var(--fg)' : 'var(--muted)' }}>
            {item.mes.slice(5)}/{item.mes.slice(2, 4)}
          </small>
        </div>
      })}
    </div>
    <figcaption className="sr-only">{fluxo.map((item) => `${item.mes}: receitas ${money(item.receitas)}, despesas ${money(item.despesas)}`).join('; ')}</figcaption>
  </figure>
}

// Painel do Demonstrativo do Resultado do Exercício (DRE Gerencial)
function DreGerencialPanel({ dre, mes, onMesChange, onFilterCategoria }) {
  if (!dre) return <p className="dadm-muted">Carregando DRE Gerencial…</p>

  const anos = mes.slice(0, 4)
  const mesNum = mes.slice(5, 7)

  function mudarMes(delta) {
    const d = new Date(Number(anos), Number(mesNum) - 1 + delta, 1)
    const novoMes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    onMesChange(novoMes)
  }

  return <div style={{ display: 'grid', gap: 16 }}>
    {/* Controles de Mês do DRE */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Competência: {mesNum}/{anos}</h3>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>Demonstrativo contábil gerencial com análise vertical de margens</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button type="button" className="c360-btn ghost" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => mudarMes(-1)}>« Mês anterior</button>
        <button type="button" className="c360-btn ghost" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => mudarMes(1)}>Próximo mês »</button>
      </div>
    </div>

    {/* Resumo de Margens do DRE */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
      <div style={{ padding: '12px 14px', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Receita Bruta</span>
        <strong style={{ display: 'block', fontSize: 18, marginTop: 4 }}>{money(dre.receitaBruta)}</strong>
        <small style={{ fontSize: 11, color: 'var(--muted)' }}>100% da base</small>
      </div>
      <div style={{ padding: '12px 14px', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Margem de Contribuição</span>
        <strong style={{ display: 'block', fontSize: 18, marginTop: 4, color: dre.margemContribuicao >= 0 ? 'var(--fg)' : '#e05c5c' }}>
          {money(dre.margemContribuicao)}
        </strong>
        <small style={{ fontSize: 11, color: 'var(--muted)' }}>{dre.margemContribuicaoPercentual}% da receita</small>
      </div>
      <div style={{ padding: '12px 14px', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Despesas Fixas</span>
        <strong style={{ display: 'block', fontSize: 18, marginTop: 4, color: '#e05c5c' }}>
          {money(dre.totalDespesasOperacionais)}
        </strong>
        <small style={{ fontSize: 11, color: 'var(--muted)' }}>Custos estruturais</small>
      </div>
      <div style={{ padding: '12px 14px', background: 'var(--card2)', border: '1px solid var(--accent, #b0892e)', borderRadius: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--accent, #b0892e)', textTransform: 'uppercase', fontWeight: 700 }}>Lucro Líquido Real</span>
        <strong style={{ display: 'block', fontSize: 18, marginTop: 4, color: dre.resultadoLiquido >= 0 ? '#10b981' : '#e05c5c' }}>
          {money(dre.resultadoLiquido)}
        </strong>
        <small style={{ fontSize: 11, fontWeight: 700, color: dre.resultadoLiquido >= 0 ? '#10b981' : '#e05c5c' }}>
          Margem Líquida {dre.margemLiquidaPercentual}%
        </small>
      </div>
    </div>

    {/* Estrutura Detalhada em Tabela DRE */}
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--card2)', borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
            <th style={{ padding: '8px 12px' }}>Linha do DRE</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Valor (R$)</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Análise Vertical (%)</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ fontWeight: 700, background: 'rgba(16, 185, 129, 0.05)' }}>
            <td style={{ padding: '8px 12px' }}>(+) RECEITA OPERACIONAL BRUTA</td>
            <td style={{ padding: '8px 12px', textAlign: 'right' }}>{money(dre.receitaBruta)}</td>
            <td style={{ padding: '8px 12px', textAlign: 'right' }}>100.0%</td>
          </tr>
          <tr style={{ color: 'var(--muted)' }}>
            <td style={{ padding: '6px 12px 6px 28px' }}>• Atendimentos e Serviços</td>
            <td style={{ padding: '6px 12px', textAlign: 'right' }}>{money(dre.detalhesReceita?.servicos || 0)}</td>
            <td style={{ padding: '6px 12px', textAlign: 'right' }}>
              {dre.receitaBruta > 0 ? ((dre.detalhesReceita?.servicos / dre.receitaBruta) * 100).toFixed(1) : 0}%
            </td>
          </tr>
          <tr style={{ color: 'var(--muted)' }}>
            <td style={{ padding: '6px 12px 6px 28px' }}>• Planos e Assinaturas (Clube)</td>
            <td style={{ padding: '6px 12px', textAlign: 'right' }}>{money(dre.detalhesReceita?.planos || 0)}</td>
            <td style={{ padding: '6px 12px', textAlign: 'right' }}>
              {dre.receitaBruta > 0 ? ((dre.detalhesReceita?.planos / dre.receitaBruta) * 100).toFixed(1) : 0}%
            </td>
          </tr>
          <tr style={{ color: 'var(--muted)' }}>
            <td style={{ padding: '6px 12px 6px 28px' }}>• Produtos e Revenda</td>
            <td style={{ padding: '6px 12px', textAlign: 'right' }}>{money(dre.detalhesReceita?.revenda || 0)}</td>
            <td style={{ padding: '6px 12px', textAlign: 'right' }}>
              {dre.receitaBruta > 0 ? ((dre.detalhesReceita?.revenda / dre.receitaBruta) * 100).toFixed(1) : 0}%
            </td>
          </tr>

          <tr style={{ color: '#e05c5c', borderTop: '1px dashed var(--line)' }}>
            <td style={{ padding: '8px 12px' }}>(-) Deduções e Taxas de Cartão</td>
            <td style={{ padding: '8px 12px', textAlign: 'right' }}>- {money(dre.totalDeducoes)}</td>
            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
              {dre.receitaBruta > 0 ? ((dre.totalDeducoes / dre.receitaBruta) * 100).toFixed(1) : 0}%
            </td>
          </tr>

          <tr style={{ fontWeight: 600, borderTop: '1px solid var(--line)', background: 'var(--card2)' }}>
            <td style={{ padding: '8px 12px' }}>(=) RECEITA OPERACIONAL LÍQUIDA</td>
            <td style={{ padding: '8px 12px', textAlign: 'right' }}>{money(dre.receitaLiquida)}</td>
            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
              {dre.receitaBruta > 0 ? ((dre.receitaLiquida / dre.receitaBruta) * 100).toFixed(1) : 0}%
            </td>
          </tr>

          <tr style={{ color: '#e05c5c' }}>
            <td style={{ padding: '8px 12px' }}>(-) Custos Variáveis (Repasses & Insumos)</td>
            <td style={{ padding: '8px 12px', textAlign: 'right' }}>- {money(dre.totalCustosVariaveis)}</td>
            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
              {dre.receitaBruta > 0 ? ((dre.totalCustosVariaveis / dre.receitaBruta) * 100).toFixed(1) : 0}%
            </td>
          </tr>

          <tr style={{ fontWeight: 700, borderTop: '1px solid var(--line)', background: 'rgba(176, 137, 46, 0.08)' }}>
            <td style={{ padding: '8px 12px' }}>(=) MARGEM DE CONTRIBUIÇÃO (LUCRO BRUTO)</td>
            <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--accent, #b0892e)' }}>{money(dre.margemContribuicao)}</td>
            <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--accent, #b0892e)' }}>{dre.margemContribuicaoPercentual}%</td>
          </tr>

          <tr style={{ color: '#e05c5c' }}>
            <td style={{ padding: '8px 12px' }}>(-) Despesas Operacionais Fixas</td>
            <td style={{ padding: '8px 12px', textAlign: 'right' }}>- {money(dre.totalDespesasOperacionais)}</td>
            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
              {dre.receitaBruta > 0 ? ((dre.totalDespesasOperacionais / dre.receitaBruta) * 100).toFixed(1) : 0}%
            </td>
          </tr>

          <tr style={{ fontWeight: 800, fontSize: 14, borderTop: '2px solid var(--line)', background: dre.resultadoLiquido >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
            <td style={{ padding: '10px 12px' }}>(=) RESULTADO LÍQUIDO DO EXERCÍCIO (EBITDA)</td>
            <td style={{ padding: '10px 12px', textAlign: 'right', color: dre.resultadoLiquido >= 0 ? '#10b981' : '#e05c5c' }}>
              {money(dre.resultadoLiquido)}
            </td>
            <td style={{ padding: '10px 12px', textAlign: 'right', color: dre.resultadoLiquido >= 0 ? '#10b981' : '#e05c5c' }}>
              {dre.margemLiquidaPercentual}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
}

// Painel de Despesas por Categoria com Gráfico e Participação
function DespesasCategoriaPanel({ dre, onSelectCategoria }) {
  if (!dre?.rankingCategorias) return <p className="dadm-muted">Carregando categorias…</p>

  const total = dre.totalDespesasOperacionais || 1
  return <div style={{ display: 'grid', gap: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Centros de Custo & Despesas</h3>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>Distribuição percentual das despesas pagas no mês</p>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700 }}>Total: {money(total)}</span>
    </div>

    {!dre.rankingCategorias.length ? (
      <p className="dadm-muted">Nenhuma despesa operacional registrada para este mês.</p>
    ) : (
      <div style={{ display: 'grid', gap: 8 }}>
        {dre.rankingCategorias.map((item) => (
          <div
            key={item.categoria}
            onClick={() => onSelectCategoria(item.categoria)}
            style={{
              padding: '10px 14px',
              border: '1px solid var(--line)',
              borderRadius: 8,
              background: 'var(--card)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Clique para filtrar a tabela de lançamentos por esta categoria"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
              <strong>{item.categoria}</strong>
              <span>{money(item.valor)} · <span style={{ color: 'var(--accent, #b0892e)', fontWeight: 700 }}>{item.percentual}%</span></span>
            </div>
            <div style={{ height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, item.percentual)}%`, background: 'var(--accent, #b0892e)', borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
}


// Painel Detalhado de Contas a Receber
function ContasReceberPanel({ lancamentos, hoje, modoK, onMarcarPago, onNovo }) {
  function cobrarWhatsApp(item) {
    const nomeCliente = (item.descricao || "").replace(/^Comanda de barbearia [^\—]+—\s*/, "").replace(/\s*\([^\)]*\)\s*$/, "").trim() || "Cliente";
    const valorFormatado = money(item.valor);
    const texto = encodeURIComponent("Olá, " + nomeCliente + "! Tudo bem?\nPassando para enviar o resumo da sua comanda pendente na Barbearia Dino no valor de " + valorFormatado + ".\n\nPara sua comodidade, nossa chave PIX oficial é:\n👉 65999056008\n\nQualquer dúvida estamos à disposição! 💈✂️");
    window.open("https://api.whatsapp.com/send?text=" + texto, "_blank");
  }
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('pendente')

  const aReceber = useMemo(() => {
    return lancamentos.filter((i) => i.tipo === 'receita')
  }, [lancamentos])

  const totalPendente = aReceber.filter((i) => i.status === 'pendente').reduce((s, i) => s + (i.valor || 0), 0)
  const totalVencidas = aReceber.filter((i) => i.status === 'pendente' && i.vencimento < hoje).reduce((s, i) => s + (i.valor || 0), 0)
  const totalVencendo7d = aReceber.filter((i) => {
    const d7 = new Date()
    d7.setDate(d7.getDate() + 7)
    const d7Str = d7.toISOString().slice(0, 10)
    return i.status === 'pendente' && i.vencimento >= hoje && i.vencimento <= d7Str
  }).reduce((s, i) => s + (i.valor || 0), 0)
  const totalRecebido = aReceber.filter((i) => i.status === 'pago').reduce((s, i) => s + (i.valor || 0), 0)

  const lista = useMemo(() => {
    return aReceber.filter((i) => {
      if (filtroStatus === 'pendente' && i.status !== 'pendente') return false
      if (filtroStatus === 'pagas' && i.status !== 'pago') return false
      if (filtroStatus === 'vencidas' && (i.status !== 'pendente' || i.vencimento >= hoje)) return false
      if (busca) {
        const b = busca.toLowerCase()
        const t = `${i.descricao || ''} ${i.categoria || ''} ${i.observacao || ''}`.toLowerCase()
        if (!t.includes(b)) return false
      }
      return true
    })
  }, [aReceber, filtroStatus, busca, hoje])

  


  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📥 Gestão Detalhada de Contas a Receber</h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            Acompanhamento de comandas, mensalidades e valores pendentes a entrar
          </p>
        </div>
        <button type="button" className="c360-btn primary" onClick={() => onNovo('receita')} style={{ fontSize: 12 }}>
          + Nova Receita / Conta a Receber
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--line)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>A Receber Pendente</span>
          <strong style={{ fontSize: 22, color: '#10b981', display: 'block', margin: '4px 0 2px' }}>
            {modoK ? moneyK(totalPendente) : money(totalPendente)}
          </strong>
          <small style={{ fontSize: 11, color: 'var(--muted)' }}>Exato: {money(totalPendente)}</small>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--line)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>Vencendo em 7 Dias</span>
          <strong style={{ fontSize: 22, color: '#f59e0b', display: 'block', margin: '4px 0 2px' }}>
            {modoK ? moneyK(totalVencendo7d) : money(totalVencendo7d)}
          </strong>
          <small style={{ fontSize: 11, color: 'var(--muted)' }}>Exato: {money(totalVencendo7d)}</small>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card2)', border: totalVencidas > 0 ? '1px solid #e05c5c' : '1px solid var(--line)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: totalVencidas > 0 ? '#e05c5c' : 'var(--muted)', textTransform: 'uppercase' }}>Em Atraso (Vencidas)</span>
          <strong style={{ fontSize: 22, color: totalVencidas > 0 ? '#e05c5c' : 'var(--fg)', display: 'block', margin: '4px 0 2px' }}>
            {modoK ? moneyK(totalVencidas) : money(totalVencidas)}
          </strong>
          <small style={{ fontSize: 11, color: 'var(--muted)' }}>Exato: {money(totalVencidas)}</small>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--line)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Já Recebido</span>
          <strong style={{ fontSize: 22, color: 'var(--fg)', display: 'block', margin: '4px 0 2px' }}>
            {modoK ? moneyK(totalRecebido) : money(totalRecebido)}
          </strong>
          <small style={{ fontSize: 11, color: 'var(--muted)' }}>Exato: {money(totalRecebido)}</small>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['pendente', 'Pendentes'], ['vencidas', 'Vencidas'], ['pagas', 'Recebidas'], ['todos', 'Todas']].map(([st, rotulo]) => (
            <button
              key={st}
              type="button"
              className={`c360-btn ${filtroStatus === st ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => setFiltroStatus(st)}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="c360-input"
          placeholder="Buscar conta a receber..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ maxWidth: 240, fontSize: 12 }}
        />
      </div>

      {!lista.length ? (
        <p className="dadm-muted" style={{ padding: 16, textAlign: 'center', background: 'var(--card2)', borderRadius: 10 }}>
          Nenhuma conta a receber encontrada com os filtros selecionados.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--muted)', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>Vencimento</th>
                <th style={{ padding: '8px 10px' }}>Descrição</th>
                <th style={{ padding: '8px 10px' }}>Categoria</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Valor</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {lista.slice(0, 30).map((item) => {
                const emAtraso = item.status === 'pendente' && item.vencimento < hoje
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--line)', background: emAtraso ? 'rgba(239, 68, 68, 0.05)' : undefined }}>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      <strong>{shortDate(item.vencimento)}</strong>
                      {emAtraso && <span style={{ display: 'block', fontSize: 11, color: '#e05c5c', fontWeight: 700 }}>Atrasado</span>}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ fontWeight: 600 }}>{item.descricao || 'Receita'}</span>
                      {item.observacao && <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{item.observacao}</span>}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span className="c360-badge" style={{ fontSize: 11 }}>{item.categoria || 'Geral'}</span>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <strong style={{ color: '#10b981' }}>{modoK ? moneyK(item.valor) : money(item.valor)}</strong>
                      {modoK && <span style={{ display: 'block', fontSize: 10, color: 'var(--muted)' }}>{money(item.valor)}</span>}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span className={`c360-badge ${item.status === 'pago' ? 'success' : emAtraso ? 'danger' : 'warning'}`}>
                        {item.status === 'pago' ? 'Recebido' : emAtraso ? 'Vencida' : 'Pendente'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {item.status === 'pendente' ? (
                        <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="c360-btn primary"
                            style={{ fontSize: 11, padding: '3px 8px' }}
                            onClick={() => onMarcarPago(item)}
                          >
                            ✓ Receber
                          </button>
                          <button
                            type="button"
                            className="c360-btn ghost"
                            style={{ fontSize: 11, padding: '3px 8px', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                            onClick={() => cobrarWhatsApp(item)}
                            title="Enviar lembrete amigável com chave PIX pelo WhatsApp"
                          >
                            💬 WhatsApp
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Liquidado</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {lista.length > 30 && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
              Exibindo 30 de {lista.length} contas a receber. Use a busca ou filtros para refinar.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Painel Detalhado de Contas a Pagar
function ContasPagarPanel({ lancamentos, hoje, modoK, onMarcarPago, onNovo }) {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('pendente')

  const aPagar = useMemo(() => {
    return lancamentos.filter((i) => i.tipo === 'despesa')
  }, [lancamentos])

  const totalPendente = aPagar.filter((i) => i.status === 'pendente').reduce((s, i) => s + (i.valor || 0), 0)
  const totalVencidas = aPagar.filter((i) => i.status === 'pendente' && i.vencimento < hoje).reduce((s, i) => s + (i.valor || 0), 0)
  const totalVencendo7d = aPagar.filter((i) => {
    const d7 = new Date()
    d7.setDate(d7.getDate() + 7)
    const d7Str = d7.toISOString().slice(0, 10)
    return i.status === 'pendente' && i.vencimento >= hoje && i.vencimento <= d7Str
  }).reduce((s, i) => s + (i.valor || 0), 0)
  const totalPago = aPagar.filter((i) => i.status === 'pago').reduce((s, i) => s + (i.valor || 0), 0)

  const lista = useMemo(() => {
    return aPagar.filter((i) => {
      if (filtroStatus === 'pendente' && i.status !== 'pendente') return false
      if (filtroStatus === 'pagas' && i.status !== 'pago') return false
      if (filtroStatus === 'vencidas' && (i.status !== 'pendente' || i.vencimento >= hoje)) return false
      if (busca) {
        const b = busca.toLowerCase()
        const t = `${i.descricao || ''} ${i.categoria || ''} ${i.observacao || ''}`.toLowerCase()
        if (!t.includes(b)) return false
      }
      return true
    })
  }, [aPagar, filtroStatus, busca, hoje])

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📤 Gestão Detalhada de Contas a Pagar</h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            Obrigações, contas operacionais, insumos, fornecedores e vencimentos
          </p>
        </div>
        <button type="button" className="c360-btn primary" onClick={() => onNovo('despesa')} style={{ fontSize: 12 }}>
          + Nova Despesa / Conta a Pagar
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--line)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>A Pagar Pendente</span>
          <strong style={{ fontSize: 22, color: '#e05c5c', display: 'block', margin: '4px 0 2px' }}>
            {modoK ? moneyK(totalPendente) : money(totalPendente)}
          </strong>
          <small style={{ fontSize: 11, color: 'var(--muted)' }}>Exato: {money(totalPendente)}</small>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--line)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>Vencendo em 7 Dias</span>
          <strong style={{ fontSize: 22, color: '#f59e0b', display: 'block', margin: '4px 0 2px' }}>
            {modoK ? moneyK(totalVencendo7d) : money(totalVencendo7d)}
          </strong>
          <small style={{ fontSize: 11, color: 'var(--muted)' }}>Exato: {money(totalVencendo7d)}</small>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card2)', border: totalVencidas > 0 ? '1px solid #e05c5c' : '1px solid var(--line)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: totalVencidas > 0 ? '#e05c5c' : 'var(--muted)', textTransform: 'uppercase' }}>Despesas Vencidas</span>
          <strong style={{ fontSize: 22, color: totalVencidas > 0 ? '#e05c5c' : 'var(--fg)', display: 'block', margin: '4px 0 2px' }}>
            {modoK ? moneyK(totalVencidas) : money(totalVencidas)}
          </strong>
          <small style={{ fontSize: 11, color: 'var(--muted)' }}>Exato: {money(totalVencidas)}</small>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--line)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Já Pago</span>
          <strong style={{ fontSize: 22, color: 'var(--fg)', display: 'block', margin: '4px 0 2px' }}>
            {modoK ? moneyK(totalPago) : money(totalPago)}
          </strong>
          <small style={{ fontSize: 11, color: 'var(--muted)' }}>Exato: {money(totalPago)}</small>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['pendente', 'Pendentes'], ['vencidas', 'Vencidas'], ['pagas', 'Pagas'], ['todos', 'Todas']].map(([st, rotulo]) => (
            <button
              key={st}
              type="button"
              className={`c360-btn ${filtroStatus === st ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => setFiltroStatus(st)}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="c360-input"
          placeholder="Buscar conta a pagar..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ maxWidth: 240, fontSize: 12 }}
        />
      </div>

      {!lista.length ? (
        <p className="dadm-muted" style={{ padding: 16, textAlign: 'center', background: 'var(--card2)', borderRadius: 10 }}>
          Nenhuma conta a pagar encontrada com os filtros selecionados.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--muted)', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>Vencimento</th>
                <th style={{ padding: '8px 10px' }}>Descrição</th>
                <th style={{ padding: '8px 10px' }}>Categoria</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Valor</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {lista.slice(0, 30).map((item) => {
                const emAtraso = item.status === 'pendente' && item.vencimento < hoje
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--line)', background: emAtraso ? 'rgba(239, 68, 68, 0.05)' : undefined }}>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      <strong>{shortDate(item.vencimento)}</strong>
                      {emAtraso && <span style={{ display: 'block', fontSize: 11, color: '#e05c5c', fontWeight: 700 }}>Atrasada</span>}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ fontWeight: 600 }}>{item.descricao || 'Despesa'}</span>
                      {item.observacao && <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{item.observacao}</span>}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span className="c360-badge" style={{ fontSize: 11 }}>{item.categoria || 'Outros'}</span>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <strong style={{ color: '#e05c5c' }}>- {modoK ? moneyK(item.valor) : money(item.valor)}</strong>
                      {modoK && <span style={{ display: 'block', fontSize: 10, color: 'var(--muted)' }}>{money(item.valor)}</span>}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span className={`c360-badge ${item.status === 'pago' ? 'success' : emAtraso ? 'danger' : 'warning'}`}>
                        {item.status === 'pago' ? 'Paga' : emAtraso ? 'Vencida' : 'Pendente'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {item.status === 'pendente' ? (
                        <button
                          type="button"
                          className="c360-btn primary"
                          style={{ fontSize: 11, padding: '3px 8px', background: '#b45309', borderColor: '#b45309', color: '#fff' }}
                          onClick={() => onMarcarPago(item)}
                        >
                          ✓ Pagar
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Liquidada</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {lista.length > 30 && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
              Exibindo 30 de {lista.length} contas a pagar. Use a busca ou filtros para refinar.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Painel de Raio-X Financeiro 360°
function RaioXFinanceiroPanel({ indicadores, modoK }) {
  const mediaReceitaDia = indicadores.recPeriodo > 0 ? (indicadores.recPeriodo / 30) : 0
  const mediaDespesaDia = indicadores.despPeriodo > 0 ? (indicadores.despPeriodo / 30) : 0

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🔍 Raio-X & Diagnóstico Financeiro 360°</h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            Indicadores de liquidez, margem, ponto de equilíbrio e saúde contábil
          </p>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: indicadores.resultadoPeriodo >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: indicadores.resultadoPeriodo >= 0 ? '#10b981' : '#e05c5c' }}>
          {indicadores.resultadoPeriodo >= 0 ? '● Operação Superavitária' : '● Operação em Déficit'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <div style={{ padding: '14px', borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--line)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>Margem Operacional Líquida</span>
          <strong style={{ fontSize: 24, color: indicadores.margemPeriodo >= 0 ? 'var(--accent, #b0892e)' : '#e05c5c', display: 'block', margin: '4px 0' }}>
            {indicadores.margemPeriodo}%
          </strong>
          <small style={{ fontSize: 11, color: 'var(--muted)' }}>
            Lucro de {modoK ? moneyK(indicadores.resultadoPeriodo) : money(indicadores.resultadoPeriodo)} sobre as receitas
          </small>
        </div>

        <div style={{ padding: '14px', borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--line)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>Faturamento Diário Médio</span>
          <strong style={{ fontSize: 24, color: '#10b981', display: 'block', margin: '4px 0' }}>
            {modoK ? moneyK(mediaReceitaDia) : money(mediaReceitaDia)}/dia
          </strong>
          <small style={{ fontSize: 11, color: 'var(--muted)' }}>
            Exato: {money(mediaReceitaDia)} por dia
          </small>
        </div>

        <div style={{ padding: '14px', borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--line)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>Custo Operacional Médio</span>
          <strong style={{ fontSize: 24, color: '#e05c5c', display: 'block', margin: '4px 0' }}>
            {modoK ? moneyK(mediaDespesaDia) : money(mediaDespesaDia)}/dia
          </strong>
          <small style={{ fontSize: 11, color: 'var(--muted)' }}>
            Exato: {money(mediaDespesaDia)} por dia
          </small>
        </div>

        <div style={{ padding: '14px', borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--line)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>Saldo Acumulado Realizado</span>
          <strong style={{ fontSize: 24, color: 'var(--fg)', display: 'block', margin: '4px 0' }}>
            {modoK ? moneyK(indicadores.saldoGlobal) : money(indicadores.saldoGlobal)}
          </strong>
          <small style={{ fontSize: 11, color: 'var(--muted)' }}>
            Exato: {money(indicadores.saldoGlobal)}
          </small>
        </div>
      </div>
    </div>
  )
}

// Modal Interativo de Detalhamento de KPI
function ModalDetalheKpi({ tipo, dados, modoK, onClose, onFiltrarTabela }) {
  if (!tipo) return null

  const titulos = {
    saldo: 'Detalhamento do Saldo Realizado',
    aReceber: 'Detalhamento de Contas a Receber',
    aPagar: 'Detalhamento de Contas a Pagar',
    recPeriodo: 'Detalhamento das Receitas do Período',
    despPeriodo: 'Detalhamento das Despesas do Período',
    resultadoPeriodo: 'Detalhamento do Resultado & Margem',
    vencidos: 'Detalhamento dos Títulos Vencidos'
  }

  return (
    <Dialog open title={titulos[tipo] || 'Detalhamento'} onClose={onClose}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ padding: '16px', borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--line)', textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 800 }}>
            {titulos[tipo]}
          </span>
          <strong style={{ fontSize: 32, display: 'block', margin: '6px 0 2px', color: 'var(--accent, #b0892e)' }}>
            {modoK ? moneyK(dados.valor) : money(dados.valor)}
          </strong>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Valor Exato: {money(dados.valor)}</span>
        </div>

        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--fg)' }}>
          <p style={{ margin: '0 0 10px' }}>{dados.descricao}</p>
          {dados.itens && dados.itens.length > 0 && (
            <div>
              <strong style={{ display: 'block', marginBottom: 6 }}>Principais Compositores:</strong>
              <div style={{ display: 'grid', gap: 6 }}>
                {dados.itens.slice(0, 5).map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 6 }}>
                    <span>{it.descricao || it.nome}</span>
                    <strong style={{ color: it.tipo === 'despesa' ? '#e05c5c' : '#10b981' }}>
                      {modoK ? moneyK(it.valor) : money(it.valor)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="c360-btn ghost" onClick={onClose}>
            Fechar
          </button>
          <button
            type="button"
            className="c360-btn primary"
            onClick={() => {
              onFiltrarTabela(tipo)
              onClose()
            }}
          >
            Filtrar Lançamentos na Tabela →
          </button>
        </div>
      </div>
    </Dialog>
  )
}

function calcularDatasPeriodo(tipo, refHoje = localDay()) {
  const [anoStr, mesStr, diaStr] = refHoje.split('-')
  const ano = Number(anoStr)
  const mes = Number(mesStr)
  const dia = Number(diaStr)
  if (tipo === 'hoje') {
    return { de: refHoje, ate: refHoje, label: `Hoje (${diaStr}/${mesStr}/${anoStr})` }
  }
  if (tipo === '7d') {
    const d = new Date(ano, mes - 1, dia - 6)
    const deStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { de: deStr, ate: refHoje, label: `Últimos 7 dias (${deStr.split('-').reverse().join('/')} a ${refHoje.split('-').reverse().join('/')})` }
  }
  if (tipo === '15d') {
    const d = new Date(ano, mes - 1, dia - 14)
    const deStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { de: deStr, ate: refHoje, label: `Últimos 15 dias (${deStr.split('-').reverse().join('/')} a ${refHoje.split('-').reverse().join('/')})` }
  }
  if (tipo === 'mes') {
    const ultimoDia = new Date(ano, mes, 0).getDate()
    const deStr = `${anoStr}-${mesStr}-01`
    const ateStr = `${anoStr}-${mesStr}-${String(ultimoDia).padStart(2, '0')}`
    return { de: deStr, ate: ateStr, label: `Este Mês (${mesStr}/${anoStr})` }
  }
  if (tipo === 'mesAnterior') {
    const dAnt = new Date(ano, mes - 2, 1)
    const anoAnt = dAnt.getFullYear()
    const mesAnt = String(dAnt.getMonth() + 1).padStart(2, '0')
    const ultDiaAnt = new Date(anoAnt, dAnt.getMonth() + 1, 0).getDate()
    const deStr = `${anoAnt}-${mesAnt}-01`
    const ateStr = `${anoAnt}-${mesAnt}-${String(ultDiaAnt).padStart(2, '0')}`
    return { de: deStr, ate: ateStr, label: `Mês Anterior (${mesAnt}/${anoAnt})` }
  }
  if (tipo === 'ano') {
    return { de: `${anoStr}-01-01`, ate: `${anoStr}-12-31`, label: `Ano de ${anoStr}` }
  }
  if (tipo === 'tudo') {
    return { de: '', ate: '', label: 'Todo o Histórico' }
  }
  return { de: '', ate: '', label: 'Personalizado' }
}

export default function FinanceiroEmpresa() {
  const { toast } = useToast()
  const { empresaAtiva, perfil } = useAuth()
  const { unidade } = useUnidadeAtiva()
  const exigeUnidade = useRazaoAtivo() === true && !unidade
  const operador = perfil === 'operador'
  const stallone = brandFromContext(empresaAtiva) === 'stallone'

  const [lancamentos, setLancamentos] = useState([])
  const [resumo, setResumo] = useState(null)
  const [fluxo, setFluxo] = useState([])
  const [dre, setDre] = useState(null)
  const [categorias, setCategorias] = useState({ receita: [], despesa: [] })
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [filtros, setFiltros] = useState(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      return {
        tipo: sp.get('tipo') || (sp.get('aba') === 'pagar' ? 'despesa' : sp.get('aba') === 'receber' ? 'receita' : ''),
        status: sp.get('status') || (sp.get('aba') === 'pagar' || sp.get('aba') === 'receber' ? 'pendente' : ''),
        categoria: sp.get('categoria') || '',
        q: sp.get('q') || '',
        de: sp.get('de') || '',
        ate: sp.get('ate') || ''
      }
    }
    return { tipo: '', status: '', categoria: '', q: '', de: '', ate: '' }
  })
  const hoje = localDay()
  const mesAtual = resumo?.mesAtual || hoje.slice(0, 7)
  const [periodoFiltro, setPeriodoFiltro] = useState('mes') // 'mes' | 'hoje' | '7d' | '15d' | 'mesAnterior' | 'ano' | 'tudo' | 'custom'
  const [periodoDatas, setPeriodoDatas] = useState(() => calcularDatasPeriodo('mes', localDay()))
  const [cardFiltroAtivo, setCardFiltroAtivo] = useState(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      if (sp.get('filtro') === 'vencidos') return 'vencidos'
      if (sp.get('aba') === 'pagar') return 'aPagar'
      if (sp.get('aba') === 'receber') return 'aReceber'
    }
    return null
  })
  const [mesSelecionado, setMesSelecionado] = useState(null)
  const [modoK, setModoK] = useState(true)
  const [modalDetalheKpi, setModalDetalheKpi] = useState(null)
  const [abaAnalitica, setAbaAnalitica] = useState(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      if (sp.get('aba') === 'receber') return 'receber'
      if (sp.get('aba') === 'pagar') return 'pagar'
    }
    return 'fluxo'
  }) // 'fluxo' | 'receber' | 'pagar' | 'dre' | 'categorias' | 'raiox'
  const [ordenacao, setOrdenacao] = useState({ campo: 'vencimento', direcao: 'desc' })
  const [itensPorPagina, setItensPorPagina] = useState(50)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [selecionados, setSelecionados] = useState(new Set())
  const [executandoLote, setExecutandoLote] = useState(false)
  const [modalLiquidarVencidos, setModalLiquidarVencidos] = useState(false)
  const [form, setForm] = useState(null)
  const [cancelando, setCancelando] = useState(null)
  const firstField = useRef(null)
  const [mesDre, setMesDre] = useState(mesAtual)

  const tituloReceitas = periodoFiltro === 'mes' ? 'Receitas do mês' : periodoFiltro === 'hoje' ? 'Receitas de hoje' : periodoFiltro === '7d' ? 'Receitas (7 dias)' : periodoFiltro === '15d' ? 'Receitas (15 dias)' : periodoFiltro === 'ano' ? 'Receitas do ano' : periodoFiltro === 'tudo' ? 'Receitas totais' : 'Receitas do período'
  const tituloDespesas = periodoFiltro === 'mes' ? 'Despesas do mês' : periodoFiltro === 'hoje' ? 'Despesas de hoje' : periodoFiltro === '7d' ? 'Despesas (7 dias)' : periodoFiltro === '15d' ? 'Despesas (15 dias)' : periodoFiltro === 'ano' ? 'Despesas do ano' : periodoFiltro === 'tudo' ? 'Despesas totais' : 'Despesas do período'
  const tituloResultado = periodoFiltro === 'mes' ? 'Resultado do mês' : periodoFiltro === 'hoje' ? 'Resultado de hoje' : periodoFiltro === '7d' ? 'Resultado (7 dias)' : periodoFiltro === '15d' ? 'Resultado (15 dias)' : periodoFiltro === 'ano' ? 'Resultado do ano' : periodoFiltro === 'tudo' ? 'Resultado histórico' : 'Resultado do período'

  function aplicarPeriodo(tipo) {
    setPeriodoFiltro(tipo)
    if (tipo !== 'custom') {
      const datas = calcularDatasPeriodo(tipo, hoje)
      setPeriodoDatas(datas)
      setFiltros((prev) => ({ ...prev, de: datas.de, ate: datas.ate }))
      setCardFiltroAtivo(null)
      setPaginaAtual(1)
    }
  }

  function alterarDatasCustomizadas(de, ate) {
    setPeriodoFiltro('custom')
    setPeriodoDatas({
      de,
      ate,
      label: de && ate ? `${de.split('-').reverse().join('/')} a ${ate.split('-').reverse().join('/')}` : 'Personalizado'
    })
    setFiltros((prev) => ({ ...prev, de, ate }))
    setCardFiltroAtivo(null)
    setPaginaAtual(1)
  }

  const load = useCallback(async () => {
    setLoading(true)
    if (operador) {
      try { setCategorias((await api.get(`${BASE}/categorias`)) || { receita: [], despesa: [] }); setErro('') }
      catch (error) { setErro(error.message || 'Não foi possível carregar as categorias.') }
      finally { setLoading(false) }
      return
    }
    try {
      const [lista, r, f, c, d] = await Promise.all([
        api.get(`${BASE}/lancamentos`),
        api.get(`${BASE}/resumo`),
        api.get(`${BASE}/fluxo`),
        api.get(`${BASE}/categorias`),
        api.get(`${BASE}/dre?mes=${mesDre}`).catch(() => null)
      ])
      setLancamentos(Array.isArray(lista) ? lista : [])
      setResumo(r)
      setFluxo(Array.isArray(f) ? f : [])
      setCategorias(c || { receita: [], despesa: [] })
      setDre(d)
      setErro('')
    } catch (error) { setErro(error.message || 'Não foi possível carregar o financeiro.') }
    finally { setLoading(false) }
  }, [operador, mesDre])

  useEffect(() => { load() }, [load, empresaAtiva?.id])

  // Lançamentos vencidos
  const vencidos = useMemo(() => {
    return lancamentos.filter((item) => item.status === 'pendente' && item.vencimento < hoje)
  }, [lancamentos, hoje])

  const totalVencidos = useMemo(() => {
    return vencidos.reduce((sum, item) => sum + item.valor, 0)
  }, [vencidos])

  const vencendo = useMemo(() => {
    const daqui3dias = localDay(new Date(Date.now() + 3 * 86400000))
    return lancamentos.filter((item) => item.status === 'pendente' && item.vencimento >= hoje && item.vencimento <= daqui3dias)
  }, [lancamentos, hoje])

  // Agregação dos indicadores em O(N) com base no período ativo
  const indicadoresPeriodo = useMemo(() => {
    const { de, ate } = periodoDatas
    let recPeriodo = 0
    let despPeriodo = 0
    let aReceberPeriodo = 0
    let aPagarPeriodo = 0
    let recGlobal = 0
    let despGlobal = 0
    let aReceberGlobal = 0
    let aPagarGlobal = 0

    for (let i = 0; i < lancamentos.length; i++) {
      const item = lancamentos[i]
      if (item.status === 'cancelado') continue
      const valor = Number(item.valor || 0)
      const dataRef = String(item.pagoEm || item.dataOperacao || item.vencimento || '').slice(0, 10)
      const dataVenc = String(item.vencimento || '').slice(0, 10)

      const noPeriodo = !de || !ate ? true : (dataRef >= de && dataRef <= ate)
      const noPeriodoVenc = !de || !ate ? true : (dataVenc >= de && dataVenc <= ate)

      if (item.tipo === 'receita') {
        if (item.status === 'pago') {
          recGlobal += valor
          if (noPeriodo) recPeriodo += valor
        } else if (item.status === 'pendente') {
          aReceberGlobal += valor
          if (noPeriodoVenc) aReceberPeriodo += valor
        }
      } else if (item.tipo === 'despesa') {
        if (item.status === 'pago') {
          despGlobal += valor
          if (noPeriodo) despPeriodo += valor
        } else if (item.status === 'pendente') {
          aPagarGlobal += valor
          if (noPeriodoVenc) aPagarPeriodo += valor
        }
      }
    }

    const resultadoPeriodo = recPeriodo - despPeriodo
    const margemPeriodo = recPeriodo > 0 ? Number(((resultadoPeriodo / recPeriodo) * 100).toFixed(1)) : 0
    const saldoGlobal = recGlobal - despGlobal

    return {
      recPeriodo,
      despPeriodo,
      resultadoPeriodo,
      margemPeriodo,
      aReceberPeriodo,
      aPagarPeriodo,
      saldoGlobal,
      recGlobal,
      despGlobal,
      aReceberGlobal,
      aPagarGlobal,
    }
  }, [lancamentos, periodoDatas])

  // Manipular clique nos Cards de KPI com filtro contextual do período
  function toggleCardFiltro(tipoCard) {
    if (cardFiltroAtivo === tipoCard) {
      setCardFiltroAtivo(null)
      setFiltros((prev) => ({
        ...prev,
        tipo: '',
        status: '',
        de: periodoDatas.de,
        ate: periodoDatas.ate,
      }))
      setPaginaAtual(1)
      return
    }
    setCardFiltroAtivo(tipoCard)
    setMesSelecionado(null)
    setPaginaAtual(1)
    if (tipoCard === 'saldo') {
      setAbaAnalitica('fluxo')
      setFiltros((prev) => ({ ...prev, tipo: '', status: 'pago', de: '', ate: '' }))
    } else if (tipoCard === 'aReceber') {
      setAbaAnalitica('receber')
      setFiltros((prev) => ({ ...prev, tipo: 'receita', status: 'pendente', de: '', ate: '' }))
    } else if (tipoCard === 'aPagar') {
      setAbaAnalitica('pagar')
      setFiltros((prev) => ({ ...prev, tipo: 'despesa', status: 'pendente', de: '', ate: '' }))
    } else if (tipoCard === 'recPeriodo' || tipoCard === 'recMes') {
      setFiltros((prev) => ({ ...prev, tipo: 'receita', status: 'pago', de: periodoDatas.de, ate: periodoDatas.ate }))
    } else if (tipoCard === 'despPeriodo' || tipoCard === 'despMes') {
      setFiltros((prev) => ({ ...prev, tipo: 'despesa', status: 'pago', de: periodoDatas.de, ate: periodoDatas.ate }))
    } else if (tipoCard === 'resultadoPeriodo' || tipoCard === 'resultadoMes') {
      setFiltros((prev) => ({ ...prev, tipo: '', status: 'pago', de: periodoDatas.de, ate: periodoDatas.ate }))
    } else if (tipoCard === 'vencidos') {
      setFiltros((prev) => ({ ...prev, tipo: '', status: 'pendente', de: '', ate: '' }))
    }
  }

  // Manipular clique no gráfico de fluxo
  function handleSelectMesFluxo(mes) {
    setMesSelecionado(mes)
    setCardFiltroAtivo(null)
    setPaginaAtual(1)
    if (!mes) {
      setFiltros((prev) => ({ ...prev, de: '', ate: '' }))
    } else {
      setFiltros((prev) => ({ ...prev, de: `${mes}-01`, ate: `${mes}-31` }))
    }
  }

  function handleSelectCategoriaFiltro(cat) {
    setFiltros((prev) => ({ ...prev, categoria: cat }))
    setPaginaAtual(1)
  }

  function limparTodosFiltros() {
    setCardFiltroAtivo(null)
    setMesSelecionado(null)
    setFiltros({ tipo: '', status: '', categoria: '', q: '', de: '', ate: '' })
    setPaginaAtual(1)
  }

  // Filtragem da lista
  const lista = useMemo(() => {
    return lancamentos.filter((item) => {
      if (cardFiltroAtivo === 'vencidos') {
        if (item.status !== 'pendente' || item.vencimento >= hoje) return false
      }
      if (filtros.tipo && item.tipo !== filtros.tipo) return false
      if (filtros.status && item.status !== filtros.status) return false
      if (filtros.categoria && item.categoria !== filtros.categoria) return false
      if (filtros.q) {
        const busca = filtros.q.toLowerCase()
        const texto = `${item.descricao || ''} ${item.observacao || ''} ${item.categoria || ''}`.toLowerCase()
        if (!texto.includes(busca)) return false
      }
      if (filtros.de && item.vencimento < filtros.de) return false
      if (filtros.ate && item.vencimento > filtros.ate) return false
      return true
    })
  }, [lancamentos, filtros, cardFiltroAtivo, hoje])

  // Ordenação da lista
  const listaOrdenada = useMemo(() => {
    return [...lista].sort((a, b) => {
      let valA = a[ordenacao.campo]
      let valB = b[ordenacao.campo]
      if (ordenacao.campo === 'valor') {
        valA = Number(valA || 0)
        valB = Number(valB || 0)
      } else {
        valA = String(valA || '').toLowerCase()
        valB = String(valB || '').toLowerCase()
      }
      if (valA < valB) return ordenacao.direcao === 'asc' ? -1 : 1
      if (valA > valB) return ordenacao.direcao === 'asc' ? 1 : -1
      return 0
    })
  }, [lista, ordenacao])

  // Paginação
  const totalPaginas = Math.max(1, Math.ceil(listaOrdenada.length / (itensPorPagina || 50)))
  const listaPaginada = useMemo(() => {
    if (itensPorPagina >= 9999) return listaOrdenada
    const inicio = (paginaAtual - 1) * itensPorPagina
    return listaOrdenada.slice(inicio, inicio + itensPorPagina)
  }, [listaOrdenada, paginaAtual, itensPorPagina])

  const totalFiltrado = useMemo(() => {
    const rec = lista.filter((i) => i.tipo === 'receita').reduce((s, i) => s + i.valor, 0)
    const desp = lista.filter((i) => i.tipo === 'despesa').reduce((s, i) => s + i.valor, 0)
    return { rec, desp, saldo: rec - desp }
  }, [lista])

  const todasCategorias = useMemo(() => {
    return [...new Set([...(categorias.receita || []), ...(categorias.despesa || []), ...lancamentos.map((item) => item.categoria)])].filter(Boolean)
  }, [categorias, lancamentos])

  function toggleOrdenar(campo) {
    setOrdenacao((prev) => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'desc' ? 'asc' : 'desc'
    }))
  }

  // Seleção em lote
  const todosDaPaginaSelecionados = listaPaginada.length > 0 && listaPaginada.every((item) => selecionados.has(item.id))
  function toggleSelecionarTodosPagina() {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (todosDaPaginaSelecionados) {
        listaPaginada.forEach((item) => next.delete(item.id))
      } else {
        listaPaginada.forEach((item) => next.add(item.id))
      }
      return next
    })
  }

  function toggleSelecionarLinha(id) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Liquidação em lote dos selecionados
  async function liquidarSelecionados() {
    if (!selecionados.size) return
    const ids = Array.from(selecionados)
    setExecutandoLote(true)
    try {
      await api.post(`${BASE}/lancamentos/liquidar-lote`, { ids })
      toast(`${ids.length} lançamento(s) marcado(s) como pago(s).`)
      setSelecionados(new Set())
      await load()
    } catch (err) {
      toast(err.message || 'Erro ao liquidar lançamentos.', true)
    } finally {
      setExecutandoLote(false)
    }
  }

  // Liquidação em lote de todos os 71 vencidos
  async function confirmarLiquidarTodosVencidos() {
    const ids = vencidos.map((item) => item.id)
    setExecutandoLote(true)
    try {
      await api.post(`${BASE}/lancamentos/liquidar-lote`, { ids })
      toast(`${ids.length} despesa(s) vencida(s) liquidada(s) como pagas!`)
      setModalLiquidarVencidos(false)
      setSelecionados(new Set())
      setCardFiltroAtivo(null)
      await load()
    } catch (err) {
      toast(err.message || 'Erro ao liquidar despesas vencidas.', true)
    } finally {
      setExecutandoLote(false)
    }
  }

  function abrirNovo(tipo = 'despesa') { setForm({ ...EMPTY_FORM, tipo, vencimento: hoje }) }
  function abrirEdicao(item) { setForm({ id: item.id, automatico: item.automatico, tipo: item.tipo, categoria: item.categoria, descricao: item.descricao, valor: item.valor, vencimento: item.vencimento, status: item.status, obs: item.observacao || '' }) }

  async function salvar() {
    try {
      const payload = form.automatico ? { status: form.status, obs: form.obs } : { tipo: form.tipo, categoria: form.categoria, descricao: form.descricao, valor: Number(String(form.valor).replace(',', '.')), vencimento: form.vencimento, status: form.status, obs: form.obs, ...(!form.id && Number(form.meses) > 1 ? { recorrencia: { meses: Number(form.meses) } } : {}) }
      if (form.id) await api.patch(`${BASE}/lancamentos/${form.id}`, payload)
      else await api.post(`${BASE}/lancamentos`, payload)
      toast(form.id ? 'Lançamento atualizado.' : (Number(form.meses) > 1 ? `${form.meses} lançamentos mensais criados.` : 'Lançamento criado.'))
      setForm(null); load()
    } catch (error) { toast(error.message, true) }
  }

  async function marcarPago(item) {
    try {
      await api.patch(`${BASE}/lancamentos/${item.id}`, { status: 'pago', pagoEm: new Date().toISOString() })
      toast('Marcado como pago.')
      load()
    } catch (error) { toast(error.message || 'Erro ao marcar como pago.', true) }
  }

  async function encerrarSerie() {
    try { const r = await api.delete(`${BASE}/series/${cancelando.serieId}`); toast(`${r.canceladas} parcela(s) futura(s) cancelada(s).`); setCancelando(null); load() }
    catch (error) { toast(error.message, true) }
  }

  async function confirmarCancelamento() {
    try { await api.delete(`${BASE}/lancamentos/${cancelando.id}`); toast('Lançamento cancelado (fica no histórico).'); setCancelando(null); load() }
    catch (error) { toast(error.message, true) }
  }

  function exportar() {
    downloadCsv(`financeiro_${hoje}.csv`, lista.map((item) => ({
      vencimento: item.vencimento,
      tipo: item.tipo,
      categoria: item.categoria,
      descricao: item.descricao,
      valor: item.valor,
      status: item.status,
      origem: ORIGENS[item.origem] || item.origem,
      pago_em: item.pagoEm ? item.pagoEm.slice(0, 10) : '',
      observacao: item.observacao || ''
    })))
  }

  const columns = [
    {
      key: 'select',
      label: <input type="checkbox" aria-label="Selecionar todos da página" checked={todosDaPaginaSelecionados} onChange={toggleSelecionarTodosPagina} />,
      render: (item) => <input type="checkbox" aria-label={`Selecionar ${item.descricao}`} checked={selecionados.has(item.id)} onChange={() => toggleSelecionarLinha(item.id)} />
    },
    {
      key: 'vencimento',
      label: <span style={{ cursor: 'pointer' }} onClick={() => toggleOrdenar('vencimento')}>
        Vencimento {ordenacao.campo === 'vencimento' ? (ordenacao.direcao === 'asc' ? '▲' : '▼') : ''}
      </span>,
      render: (item) => <span className={item.status === 'pendente' && item.vencimento < hoje ? 'dadm-neg' : ''} style={{ fontWeight: item.status === 'pendente' && item.vencimento < hoje ? 700 : 400 }}>
        {shortDate(item.vencimento)}
      </span>
    },
    {
      key: 'descricao',
      label: <span style={{ cursor: 'pointer' }} onClick={() => toggleOrdenar('descricao')}>
        Descrição {ordenacao.campo === 'descricao' ? (ordenacao.direcao === 'asc' ? '▲' : '▼') : ''}
      </span>,
      render: (item) => <div>
        <div style={{ fontWeight: 600 }}>{item.descricao}</div>
        <small className="dadm-muted" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>
          {item.categoria} · {ORIGENS[item.origem] || item.origem}
          {item.serieParcela ? ` · Parcela ${item.serieParcela}/${item.serieTotal}` : ''}
          {item.pagoEm ? ` · Pago em ${shortDate(item.pagoEm)}` : ''}
        </small>
      </div>
    },
    {
      key: 'valor',
      label: <span style={{ cursor: 'pointer' }} onClick={() => toggleOrdenar('valor')}>
        Valor {ordenacao.campo === 'valor' ? (ordenacao.direcao === 'asc' ? '▲' : '▼') : ''}
      </span>,
      align: 'right',
      render: (item) => <span className={item.tipo === 'receita' ? 'dadm-pos' : 'dadm-neg'} style={{ fontWeight: 700 }}>
        {item.tipo === 'receita' ? '+' : '−'} {money(item.valor)}
      </span>
    },
    {
      key: 'status',
      label: <span style={{ cursor: 'pointer' }} onClick={() => toggleOrdenar('status')}>
        Situação {ordenacao.campo === 'status' ? (ordenacao.direcao === 'asc' ? '▲' : '▼') : ''}
      </span>,
      render: (item) => <Badge tone={STATUS[item.status]?.tone}>{STATUS[item.status]?.label || item.status}</Badge>
    },
    {
      key: 'acoes',
      label: 'Ações',
      render: (item) => item.status === 'cancelado' ? <span className="dadm-muted">—</span> : <div className="dadm-actions">
        {item.status === 'pendente' && <button type="button" className="c360-btn ghost" onClick={() => marcarPago(item)} title="Marcar este lançamento como pago">Marcar pago</button>}
        <button type="button" className="c360-btn ghost" onClick={() => abrirEdicao(item)} title="Editar detalhes">Editar</button>
        {!item.automatico && <button type="button" className="c360-btn ghost" onClick={() => setCancelando(item)} title="Cancelar lançamento">Cancelar</button>}
      </div>
    },
  ]

  const cardStyle = (ativo) => ({
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.15s ease',
    outline: ativo ? '2px solid var(--accent, #b0892e)' : 'none',
    boxShadow: ativo ? '0 0 12px rgba(176, 137, 46, 0.25)' : 'none',
    background: ativo ? 'var(--card2, rgba(176, 137, 46, 0.08))' : 'var(--card)',
  })

    function obterDadosDetalheKpi(tipo) {
    if (tipo === 'saldo') {
      const topEntradas = lancamentos.filter((i) => i.tipo === 'receita' && i.status === 'pago').slice(0, 5)
      const topSaidas = lancamentos.filter((i) => i.tipo === 'despesa' && i.status === 'pago').slice(0, 5)
      return {
        valor: indicadoresPeriodo.saldoGlobal,
        descricao: 'Saldo realizado acumulado resultante de todas as receitas pagas menos despesas pagas consolidadas.',
        itens: [...topEntradas, ...topSaidas]
      }
    }
    if (tipo === 'aReceber') {
      const pendentes = lancamentos.filter((i) => i.tipo === 'receita' && i.status === 'pendente')
      return {
        valor: indicadoresPeriodo.aReceberPeriodo,
        descricao: `Total de contas a receber pendentes vencendo em ${periodoDatas.label}.`,
        itens: pendentes.slice(0, 5)
      }
    }
    if (tipo === 'aPagar') {
      const pendentes = lancamentos.filter((i) => i.tipo === 'despesa' && i.status === 'pendente')
      return {
        valor: indicadoresPeriodo.aPagarPeriodo,
        descricao: `Total de contas a pagar pendentes vencendo em ${periodoDatas.label}.`,
        itens: pendentes.slice(0, 5)
      }
    }
    if (tipo === 'recPeriodo') {
      const receitas = lancamentos.filter((i) => i.tipo === 'receita' && i.status === 'pago')
      return {
        valor: indicadoresPeriodo.recPeriodo,
        descricao: `Receitas recebidas no período selecionado (${periodoDatas.label}).`,
        itens: receitas.slice(0, 5)
      }
    }
    if (tipo === 'despPeriodo') {
      const despesas = lancamentos.filter((i) => i.tipo === 'despesa' && i.status === 'pago')
      return {
        valor: indicadoresPeriodo.despPeriodo,
        descricao: `Despesas pagas no período selecionado (${periodoDatas.label}).`,
        itens: despesas.slice(0, 5)
      }
    }
    if (tipo === 'resultadoPeriodo') {
      return {
        valor: indicadoresPeriodo.resultadoPeriodo,
        descricao: `Resultado líquido do período: ${modoK ? moneyK(indicadoresPeriodo.recPeriodo) : money(indicadoresPeriodo.recPeriodo)} em receitas menos ${modoK ? moneyK(indicadoresPeriodo.despPeriodo) : money(indicadoresPeriodo.despPeriodo)} em despesas, gerando margem de ${indicadoresPeriodo.margemPeriodo}%.`,
        itens: []
      }
    }
    if (tipo === 'vencidos') {
      return {
        valor: totalVencidos,
        descricao: `Existem ${vencidos.length} despesa(s) antiga(s) vencida(s) (em especial da importação Avec) aguardando liquidação.`,
        itens: vencidos.slice(0, 5)
      }
    }
    return { valor: 0, descricao: '', itens: [] }
  }

  return <div className="dadm-page">
    <header className="dadm-head">
      <div>
        <div className="dadm-eyebrow">Gestão · {empresaAtiva?.nome || 'Empresa'}</div>
        <h1>Financeiro</h1>
        <p>{stallone ? 'Contas a pagar e a receber desta empresa. Registre despesas e acompanhe os lançamentos. Pedidos e pagamentos da loja online são consultados no painel da loja; a conciliação financeira precisa ser validada.' : 'Contas a pagar e a receber só desta empresa. Atendimentos pagos, comandas e contas a receber entram sozinhos; aqui você lança aluguel, insumos, contas e outras despesas.'}</p>
      </div>
      <div className="dadm-actions">
        {!operador && <button type="button" className="c360-btn ghost" onClick={exportar} disabled={loading || !lista.length}>Exportar CSV</button>}
        {!operador && <button type="button" className="c360-btn ghost" onClick={() => abrirNovo('receita')} disabled={exigeUnidade}>+ Receita</button>}
        <button type="button" className="c360-btn primary" onClick={() => abrirNovo('despesa')} disabled={exigeUnidade}>+ Despesa</button>
      </div>
    </header>

    {exigeUnidade && <EscolherUnidade motivo="Para lançar receita ou despesa, escolha a unidade." />}
    {erro && <p className="dadm-note danger" role="alert">{erro}</p>}
    {operador && <p className="dadm-note">Seu perfil é de operador: aqui você lança as despesas do dia. Saldo, contas e relatórios ficam com a administração.</p>}

    {operador ? null : loading && !resumo ? <p className="dadm-muted">Carregando indicadores financeiros…</p> : resumo && <>
      {/* ── BARRA DE CONTROLE DE PERÍODO DOS INDICADORES FINANCEIROS ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        padding: '12px 16px',
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        marginBottom: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>📅</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Período dos Indicadores:
            </span>
          </div>
          {/* Atalhos Rápidos */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`c360-btn ${periodoFiltro === 'hoje' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20 }}
              onClick={() => aplicarPeriodo('hoje')}
            >
              Hoje
            </button>
            <button
              type="button"
              className={`c360-btn ${periodoFiltro === '7d' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20 }}
              onClick={() => aplicarPeriodo('7d')}
            >
              7 Dias
            </button>
            <button
              type="button"
              className={`c360-btn ${periodoFiltro === '15d' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20 }}
              onClick={() => aplicarPeriodo('15d')}
            >
              15 Dias
            </button>
            <button
              type="button"
              className={`c360-btn ${periodoFiltro === 'mes' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20 }}
              onClick={() => aplicarPeriodo('mes')}
            >
              Este Mês
            </button>
            <button
              type="button"
              className={`c360-btn ${periodoFiltro === 'mesAnterior' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20 }}
              onClick={() => aplicarPeriodo('mesAnterior')}
            >
              Mês Anterior
            </button>
            <button
              type="button"
              className={`c360-btn ${periodoFiltro === 'ano' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20 }}
              onClick={() => aplicarPeriodo('ano')}
            >
              Este Ano
            </button>
            <button
              type="button"
              className={`c360-btn ${periodoFiltro === 'tudo' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20 }}
              onClick={() => aplicarPeriodo('tudo')}
            >
              Todo o Histórico
            </button>
            <button
              type="button"
              className={`c360-btn ${periodoFiltro === 'custom' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20 }}
              onClick={() => aplicarPeriodo('custom')}
            >
              Personalizado
            </button>
          </div>
        </div>

        {/* Seletores de Data Início / Fim e Resetar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            De:
            <input
              type="date"
              value={periodoDatas.de}
              onChange={(e) => alterarDatasCustomizadas(e.target.value, periodoDatas.ate)}
              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--fg)', fontSize: 12 }}
            />
          </label>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            Até:
            <input
              type="date"
              value={periodoDatas.ate}
              onChange={(e) => alterarDatasCustomizadas(periodoDatas.de, e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--fg)', fontSize: 12 }}
            />
          </label>
          {periodoFiltro !== 'mes' && (
            <button
              type="button"
              className="c360-btn ghost"
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => aplicarPeriodo('mes')}
              title="Voltar para a competência do mês corrente"
            >
              Resetar (Este Mês)
            </button>
          )}
          <button
            type="button"
            className={`c360-btn ${modoK ? 'primary' : 'ghost'}`}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20 }}
            onClick={() => setModoK(!modoK)}
            title="Alternar entre números redondos em K (ex: 55k, 535.7k) ou moeda completa (R$ 55.345,00)"
          >
            {modoK ? '🏷️ Valores em K (Ativo)' : '💵 Moeda Completa'}
          </button>
        </div>
      </div>

      {/* Cards de KPI Interativos com Filtro Imediato ao Clicar */}
      <section className="dadm-kpis" aria-label="Resumo financeiro e filtros rápidos">
        <article
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFiltro('saldo')}
          style={cardStyle(cardFiltroAtivo === 'saldo')}
          title="Clique para filtrar todos os lançamentos pagos"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Saldo realizado</span>
            <button
              type="button"
              className="c360-btn ghost"
              style={{ padding: '2px 6px', fontSize: 10, height: 'auto', lineHeight: 1 }}
              onClick={(e) => { e.stopPropagation(); setModalDetalheKpi('saldo') }}
              title="Ver composição detalhada"
            >
              🔎 Detalhes
            </button>
          </div>
          <strong className={indicadoresPeriodo.saldoGlobal >= 0 ? '' : 'dadm-neg'}>
            {modoK ? moneyK(indicadoresPeriodo.saldoGlobal) : money(indicadoresPeriodo.saldoGlobal)}
          </strong>
          <div className="dadm-kpi-subval">Exato: {money(indicadoresPeriodo.saldoGlobal)}</div>
          <small>Receitas − despesas pagas (acumulado)</small>
        </article>
        <article
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFiltro('aReceber')}
          style={cardStyle(cardFiltroAtivo === 'aReceber')}
          title="Clique para filtrar contas a receber pendentes do período"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>A receber</span>
            <button
              type="button"
              className="c360-btn ghost"
              style={{ padding: '2px 6px', fontSize: 10, height: 'auto', lineHeight: 1 }}
              onClick={(e) => { e.stopPropagation(); setModalDetalheKpi('aReceber') }}
              title="Ver composição detalhada"
            >
              🔎 Detalhes
            </button>
          </div>
          <strong style={{ color: '#10b981', fontSize: 'clamp(18px, 1.8vw, 24px)' }}>
            {modoK 
              ? moneyK(indicadoresPeriodo.aReceberPeriodo > 0 ? indicadoresPeriodo.aReceberPeriodo : indicadoresPeriodo.aReceberGlobal) 
              : money(indicadoresPeriodo.aReceberPeriodo > 0 ? indicadoresPeriodo.aReceberPeriodo : indicadoresPeriodo.aReceberGlobal)}
          </strong>
          <div className="dadm-kpi-subval">
            {indicadoresPeriodo.aReceberPeriodo > 0 
              ? `No período: ${money(indicadoresPeriodo.aReceberPeriodo)}` 
              : `Total pendente: ${money(indicadoresPeriodo.aReceberGlobal)}`}
          </div>
          <small>{indicadoresPeriodo.aReceberPeriodo > 0 ? `Vencendo em ${periodoDatas.label}` : `Vencimentos em aberto (${money(indicadoresPeriodo.aReceberGlobal)})`}</small>
        </article>
        <article
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFiltro('aPagar')}
          style={cardStyle(cardFiltroAtivo === 'aPagar')}
          title="Clique para filtrar contas a pagar pendentes do período"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>A pagar</span>
            <button
              type="button"
              className="c360-btn ghost"
              style={{ padding: '2px 6px', fontSize: 10, height: 'auto', lineHeight: 1 }}
              onClick={(e) => { e.stopPropagation(); setModalDetalheKpi('aPagar') }}
              title="Ver composição detalhada"
            >
              🔎 Detalhes
            </button>
          </div>
          <strong style={{ color: '#e05c5c', fontSize: 'clamp(18px, 1.8vw, 24px)' }}>
            {modoK 
              ? moneyK(indicadoresPeriodo.aPagarPeriodo > 0 ? indicadoresPeriodo.aPagarPeriodo : indicadoresPeriodo.aPagarGlobal) 
              : money(indicadoresPeriodo.aPagarPeriodo > 0 ? indicadoresPeriodo.aPagarPeriodo : indicadoresPeriodo.aPagarGlobal)}
          </strong>
          <div className="dadm-kpi-subval">
            {indicadoresPeriodo.aPagarPeriodo > 0 
              ? `No período: ${money(indicadoresPeriodo.aPagarPeriodo)}` 
              : `Total pendente: ${money(indicadoresPeriodo.aPagarGlobal)}`}
          </div>
          <small>{indicadoresPeriodo.aPagarPeriodo > 0 ? `Vencendo em ${periodoDatas.label}` : `Vencimentos em aberto (${money(indicadoresPeriodo.aPagarGlobal)})`}</small>
        </article>
        <article
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFiltro('recPeriodo')}
          style={cardStyle(cardFiltroAtivo === 'recPeriodo' || cardFiltroAtivo === 'recMes')}
          title={`Clique para filtrar receitas pagas em ${periodoDatas.label}`}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{tituloReceitas}</span>
            <button
              type="button"
              className="c360-btn ghost"
              style={{ padding: '2px 6px', fontSize: 10, height: 'auto', lineHeight: 1 }}
              onClick={(e) => { e.stopPropagation(); setModalDetalheKpi('recPeriodo') }}
              title="Ver composição detalhada"
            >
              🔎 Detalhes
            </button>
          </div>
          <strong style={{ color: '#10b981' }}>
            {modoK ? moneyK(indicadoresPeriodo.recPeriodo) : money(indicadoresPeriodo.recPeriodo)}
          </strong>
          <div className="dadm-kpi-subval">Exato: {money(indicadoresPeriodo.recPeriodo)}</div>
          <small>Pagas em {periodoDatas.label}</small>
        </article>
        <article
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFiltro('despPeriodo')}
          style={cardStyle(cardFiltroAtivo === 'despPeriodo' || cardFiltroAtivo === 'despMes')}
          title={`Clique para filtrar despesas pagas em ${periodoDatas.label}`}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{tituloDespesas}</span>
            <button
              type="button"
              className="c360-btn ghost"
              style={{ padding: '2px 6px', fontSize: 10, height: 'auto', lineHeight: 1 }}
              onClick={(e) => { e.stopPropagation(); setModalDetalheKpi('despPeriodo') }}
              title="Ver composição detalhada"
            >
              🔎 Detalhes
            </button>
          </div>
          <strong style={{ color: '#e05c5c' }}>
            {modoK ? moneyK(indicadoresPeriodo.despPeriodo) : money(indicadoresPeriodo.despPeriodo)}
          </strong>
          <div className="dadm-kpi-subval">Exato: {money(indicadoresPeriodo.despPeriodo)}</div>
          <small>Pagas no período</small>
        </article>
        <article
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFiltro('resultadoPeriodo')}
          className={indicadoresPeriodo.resultadoPeriodo < 0 ? 'is-alert' : ''}
          style={cardStyle(cardFiltroAtivo === 'resultadoPeriodo' || cardFiltroAtivo === 'resultadoMes')}
          title={`Clique para filtrar movimentações do período (${periodoDatas.label})`}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{tituloResultado}</span>
            <button
              type="button"
              className="c360-btn ghost"
              style={{ padding: '2px 6px', fontSize: 10, height: 'auto', lineHeight: 1 }}
              onClick={(e) => { e.stopPropagation(); setModalDetalheKpi('resultadoPeriodo') }}
              title="Ver composição detalhada"
            >
              🔎 Detalhes
            </button>
          </div>
          <strong className={indicadoresPeriodo.resultadoPeriodo >= 0 ? '' : 'dadm-neg'}>
            {modoK ? moneyK(indicadoresPeriodo.resultadoPeriodo) : money(indicadoresPeriodo.resultadoPeriodo)}
          </strong>
          <div className="dadm-kpi-subval">Exato: {money(indicadoresPeriodo.resultadoPeriodo)}</div>
          <small>{indicadoresPeriodo.recPeriodo > 0 ? `Margem ${indicadoresPeriodo.margemPeriodo}%` : 'Sem receitas no período'}</small>
        </article>
        <article
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFiltro('vencidos')}
          className={vencidos.length ? 'is-alert' : ''}
          style={{
            ...cardStyle(cardFiltroAtivo === 'vencidos'),
            borderColor: vencidos.length ? '#e05c5c' : undefined,
          }}
          title="Clique para filtrar apenas os lançamentos vencidos"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Vencidos</span>
            <button
              type="button"
              className="c360-btn ghost"
              style={{ padding: '2px 6px', fontSize: 10, height: 'auto', lineHeight: 1 }}
              onClick={(e) => { e.stopPropagation(); setModalDetalheKpi('vencidos') }}
              title="Ver composição detalhada"
            >
              🔎 Detalhes
            </button>
          </div>
          <strong style={{ color: vencidos.length ? '#e05c5c' : 'inherit' }}>{vencidos.length}</strong>
          <div className="dadm-kpi-subval">Total: {modoK ? moneyK(totalVencidos) : money(totalVencidos)}</div>
          <small>{vencidos.length ? `Exato: ${money(totalVencidos)}` : 'Nada atrasado'}</small>
        </article>
      </section>
      {/* Banner de Aviso de Vencimento Próximo */}
      {vencendo.length > 0 && <p className="dadm-note warn">
        {vencendo.length} lançamento(s) vencem nos próximos 3 dias: {vencendo.slice(0, 3).map((item) => `${item.descricao} (${money(item.valor)})`).join(', ')}{vencendo.length > 3 ? '…' : ''}
      </p>}

      {/* Ação Especial em Lote para as 71 despesas vencidas do Avec */}
      {vencidos.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '12px 16px', background: 'var(--card2, #fdf6ec)', border: '1px solid #f59e0b', borderRadius: 12, margin: '8px 0' }}>
          <div>
            <strong style={{ color: '#b45309' }}>Atenção: Existem {vencidos.length} despesa(s) antiga(s) vencida(s) ({money(totalVencidos)}).</strong>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--muted)' }}>
              Registros históricos do Avec que venceram antes da migração. Você pode liquidá-los em lote para dar baixa e atualizar o razão contábil.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="c360-btn ghost"
              style={{ fontSize: 12 }}
              onClick={() => toggleCardFiltro('vencidos')}
            >
              {cardFiltroAtivo === 'vencidos' ? '✓ Filtrando vencidos' : `Ver os ${vencidos.length} vencidos`}
            </button>
            <button
              type="button"
              className="c360-btn primary"
              style={{ fontSize: 12, background: '#b45309', borderColor: '#b45309', color: '#fff' }}
              onClick={() => setModalLiquidarVencidos(true)}
              disabled={executandoLote}
            >
              {executandoLote ? 'Liquidando…' : `Liquidar todos os ${vencidos.length} vencidos`}
            </button>
          </div>
        </div>
      )}

      {/* Seção Analítica: Abas de Fluxo de Caixa, DRE Gerencial e Despesas por Categoria */}
      <section className="dadm-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid var(--line)', paddingBottom: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, whiteSpace: 'nowrap', scrollbarWidth: 'thin' }}>
            <button
              type="button"
              className={`c360-btn ${abaAnalitica === 'fluxo' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => setAbaAnalitica('fluxo')}
            >
              📊 Fluxo 12 Meses
            </button>
            <button
              type="button"
              className={`c360-btn ${abaAnalitica === 'receber' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => setAbaAnalitica('receber')}
            >
              📥 Contas a Receber Detalhado
            </button>
            <button
              type="button"
              className={`c360-btn ${abaAnalitica === 'pagar' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => setAbaAnalitica('pagar')}
            >
              📤 Contas a Pagar Detalhado
            </button>
            <button
              type="button"
              className={`c360-btn ${abaAnalitica === 'dre' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => setAbaAnalitica('dre')}
            >
              📑 DRE Gerencial
            </button>
            <button
              type="button"
              className={`c360-btn ${abaAnalitica === 'conciliacao' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => setAbaAnalitica('conciliacao')}
            >
              🏦 Conciliação Bancária OFX
            </button>
            <button
              type="button"
              className={`c360-btn ${abaAnalitica === 'categorias' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => setAbaAnalitica('categorias')}
            >
              🏷️ Despesas por Categoria
            </button>
            <button
              type="button"
              className={`c360-btn ${abaAnalitica === 'raiox' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => setAbaAnalitica('raiox')}
            >
              🔍 Raio-X 360°
            </button>
            <button
              type="button"
              className={`c360-btn ${abaAnalitica === 'dre_ebitda' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => setAbaAnalitica('dre_ebitda')}
            >
              📊 DRE & EBITDA Operacional
            </button>
            <button
              type="button"
              className={`c360-btn ${abaAnalitica === 'conciliacao_tef' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => setAbaAnalitica('conciliacao_tef')}
            >
              💳 Conciliação TEF/PIX
            </button>
            <button
              type="button"
              className={`c360-btn ${abaAnalitica === 'tesouraria' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => setAbaAnalitica('tesouraria')}
            >
              🏦 Tesouraria & Cofre
            </button>
          </div>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {abaAnalitica === 'fluxo' && 'Clique em um mês para filtrar'}
            {abaAnalitica === 'receber' && 'Gestão avançada de recebíveis e faturamento'}
            {abaAnalitica === 'pagar' && 'Gestão avançada de fornecedores e obrigações'}
            {abaAnalitica === 'dre' && 'Demonstrativo contábil gerencial'}
            {abaAnalitica === 'conciliacao' && 'Importação de extratos OFX e conciliação bancária inteligente'}
            {abaAnalitica === 'categorias' && 'Clique na categoria para filtrar a lista'}
            {abaAnalitica === 'raiox' && 'Métricas de margem, faturamento médio e liquidez'}
          </span>
        </div>

        {abaAnalitica === 'fluxo' && (
          <FlowChart fluxo={fluxo} mesSelecionado={mesSelecionado} onSelectMes={handleSelectMesFluxo} />
        )}

        {abaAnalitica === 'receber' && (
          <ContasReceberPanel
            lancamentos={lancamentos}
            hoje={hoje}
            modoK={modoK}
            onMarcarPago={marcarPago}
            onNovo={(tipo) => abrirNovo(tipo)}
          />
        )}

        {abaAnalitica === 'pagar' && (
          <ContasPagarPanel
            lancamentos={lancamentos}
            hoje={hoje}
            modoK={modoK}
            onMarcarPago={marcarPago}
            onNovo={(tipo) => abrirNovo(tipo)}
          />
        )}

        {abaAnalitica === 'dre' && (
          <DreGerencialPanel dre={dre} mes={mesDre} onMesChange={setMesDre} onFilterCategoria={handleSelectCategoriaFiltro} />
        )}

        {abaAnalitica === 'conciliacao' && (
          <div style={{ marginTop: 12 }}>
            <ConciliacaoBancariaTab onAtualizarFinanceiro={load} />
          </div>
        )}

        {abaAnalitica === 'categorias' && (
          <DespesasCategoriaPanel dre={dre} onSelectCategoria={handleSelectCategoriaFiltro} />
        )}

        {abaAnalitica === 'raiox' && (
          <RaioXFinanceiroPanel indicadores={indicadoresPeriodo} modoK={modoK} />
        )}
        {abaAnalitica === 'dre_ebitda' && (
          <div style={{ marginTop: 14 }}>
            <DreEbitdaCompletoPanel toast={toast} />
          </div>
        )}
        {abaAnalitica === 'conciliacao_tef' && (
          <div style={{ marginTop: 14 }}>
            <ConciliacaoTefPixPanel toast={toast} />
          </div>
        )}
        {abaAnalitica === 'tesouraria' && (
          <div style={{ marginTop: 14 }}>
            <TesourariaCofrePanel toast={toast} />
          </div>
        )}
      </section>
    </>}

    {/* Tabela de Lançamentos Interativa com Busca, Filtros, Ordenação e Paginação */}
    {!operador && <section className="dadm-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2>Lançamentos</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            Exibindo <strong>{lista.length}</strong> lançamento(s)
            {lista.length > 0 && ` · Saldo: ${modoK ? moneyK(totalFiltrado.saldo) : money(totalFiltrado.saldo)} (Receitas: ${modoK ? moneyK(totalFiltrado.rec) : money(totalFiltrado.rec)} | Despesas: ${modoK ? moneyK(totalFiltrado.desp) : money(totalFiltrado.desp)})`}
          </span>
          {(cardFiltroAtivo || mesSelecionado || filtros.q || filtros.tipo || filtros.status || filtros.categoria || filtros.de || filtros.ate) && (
            <button type="button" className="c360-btn ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={limparTodosFiltros}>
              Limpar filtros ✕
            </button>
          )}
        </div>
      </div>

      {/* Banner de Filtro Ativo */}
      {(cardFiltroAtivo || mesSelecionado || filtros.categoria) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8, margin: '8px 0' }}>
          <span style={{ fontSize: 13 }}>
            Filtro ativo: <strong style={{ color: 'var(--accent, #b0892e)' }}>
              {cardFiltroAtivo === 'vencidos' && `${vencidos.length} Lançamentos Vencidos`}
              {cardFiltroAtivo === 'saldo' && 'Todos os Lançamentos Pagos'}
              {cardFiltroAtivo === 'aReceber' && 'Contas a Receber Pendentes'}
              {cardFiltroAtivo === 'aPagar' && 'Contas a Pagar Pendentes'}
              {cardFiltroAtivo === 'recMes' && `Receitas Pagas do Mês (${mesAtual})`}
              {cardFiltroAtivo === 'despMes' && `Despesas Pagas do Mês (${mesAtual})`}
              {cardFiltroAtivo === 'resultadoMes' && `Movimentações do Mês (${mesAtual})`}
              {mesSelecionado && `Mês do Fluxo: ${mesSelecionado.slice(5)}/${mesSelecionado.slice(0, 4)}`}
              {filtros.categoria && `Categoria: ${filtros.categoria}`}
            </strong>
          </span>
          <button type="button" className="c360-btn ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={limparTodosFiltros}>
            Remover filtro ✕
          </button>
        </div>
      )}

      {/* Barra de Ações em Lote quando há Selecionados */}
      {selecionados.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--card2, rgba(176, 137, 46, 0.15))', border: '1px solid var(--accent, #b0892e)', borderRadius: 10, margin: '10px 0' }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>
            ✓ {selecionados.size} lançamento(s) selecionado(s)
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="c360-btn ghost" style={{ fontSize: 12 }} onClick={() => setSelecionados(new Set())}>
              Desmarcar todos
            </button>
            <button type="button" className="c360-btn primary" style={{ fontSize: 12 }} onClick={liquidarSelecionados} disabled={executandoLote}>
              {executandoLote ? 'Processando…' : `Marcar ${selecionados.size} como pago(s)`}
            </button>
          </div>
        </div>
      )}

      <div className="dadm-filters" role="group" aria-label="Filtros" style={{ marginTop: 10 }}>
        <input className="c360-input" type="search" placeholder="Buscar descrição..." value={filtros.q} onChange={(event) => { setFiltros({ ...filtros, q: event.target.value }); setPaginaAtual(1); }} aria-label="Buscar descrição" />
        <select className="c360-input" value={filtros.tipo} onChange={(event) => { setFiltros({ ...filtros, tipo: event.target.value }); setCardFiltroAtivo(null); setPaginaAtual(1); }} aria-label="Tipo">
          <option value="">Receitas e despesas</option>
          <option value="receita">Receitas</option>
          <option value="despesa">Despesas</option>
        </select>
        <select className="c360-input" value={filtros.status} onChange={(event) => { setFiltros({ ...filtros, status: event.target.value }); setCardFiltroAtivo(null); setPaginaAtual(1); }} aria-label="Situação">
          <option value="">Todas as situações</option>
          <option value="pendente">Pendentes</option>
          <option value="pago">Pagos</option>
          <option value="cancelado">Cancelados</option>
        </select>
        <select className="c360-input" value={filtros.categoria} onChange={(event) => { setFiltros({ ...filtros, categoria: event.target.value }); setPaginaAtual(1); }} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {todasCategorias.map((item) => <option key={item}>{item}</option>)}
        </select>
        <label className="dadm-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          De <input className="c360-input" type="date" value={filtros.de} onChange={(event) => { setFiltros({ ...filtros, de: event.target.value }); setMesSelecionado(null); setPaginaAtual(1); }} />
        </label>
        <label className="dadm-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Até <input className="c360-input" type="date" value={filtros.ate} onChange={(event) => { setFiltros({ ...filtros, ate: event.target.value }); setMesSelecionado(null); setPaginaAtual(1); }} />
        </label>
      </div>

      <Table
        caption="Lançamentos financeiros"
        columns={columns}
        rows={listaPaginada}
        empty={lancamentos.length ? 'Nenhum lançamento com estes filtros.' : stallone ? 'Nenhum lançamento financeiro registrado nesta empresa.' : 'Nenhum lançamento ainda. Atendimentos pagos e comandas aparecem aqui automaticamente.'}
      />

      {/* Controles de Paginação */}
      {lista.length > 25 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
            <span>Itens por página:</span>
            <select
              className="c360-input"
              style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
              value={itensPorPagina}
              onChange={(e) => { setItensPorPagina(Number(e.target.value)); setPaginaAtual(1); }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={9999}>Todos ({lista.length})</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="c360-btn ghost"
              disabled={paginaAtual <= 1}
              onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
              style={{ fontSize: 12, padding: '5px 10px' }}
            >
              « Anterior
            </button>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Página <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong>
            </span>
            <button
              type="button"
              className="c360-btn ghost"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
              style={{ fontSize: 12, padding: '5px 10px' }}
            >
              Próxima »
            </button>
          </div>
        </div>
      )}
    </section>}

    {/* Modal para Editar/Criar Lançamento */}
    <Dialog open={Boolean(form)} title={form?.id ? 'Editar lançamento' : (form?.tipo === 'receita' ? 'Nova receita' : 'Nova despesa')} labelId="fin-form" onClose={() => setForm(null)} onSubmit={salvar} initialFocusRef={firstField}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setForm(null)}>Voltar</button><button type="submit" className="c360-btn primary">Salvar</button></>}>
      {form && <div style={{ display: 'grid', gap: 12 }}>
        {form.automatico && <p className="dadm-note">Lançamento automático: só a situação e a observação podem mudar.</p>}
        {!form.automatico && <>
          <label className="c360-field">Tipo<select ref={firstField} className="c360-input" value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value, categoria: 'Outros' })}><option value="despesa">Despesa</option><option value="receita">Receita</option></select></label>
          <label className="c360-field">Categoria<select className="c360-input" value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })}>{(categorias[form.tipo] || ['Outros']).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="c360-field">Descrição<input className="c360-input" required maxLength={240} value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} /></label>
          <label className="c360-field">Valor (R$)<input className="c360-input" required inputMode="decimal" value={form.valor} onChange={(event) => setForm({ ...form, valor: event.target.value })} /></label>
          <label className="c360-field">{form.id ? 'Vencimento' : 'Vencimento (1ª parcela)'}<input className="c360-input" type="date" required value={form.vencimento} onChange={(event) => setForm({ ...form, vencimento: event.target.value })} /></label>
          {!form.id && <label className="c360-field">Repetir<select className="c360-input" value={form.meses} onChange={(event) => setForm({ ...form, meses: Number(event.target.value) })}><option value={1}>Não repetir</option><option value={3}>Todo mês por 3 meses</option><option value={6}>Todo mês por 6 meses</option><option value={12}>Todo mês por 12 meses</option><option value={24}>Todo mês por 24 meses</option></select></label>}
          {!form.id && Number(form.meses) > 1 && <p className="dadm-muted" style={{ margin: 0 }}>Cria {form.meses} lançamentos pendentes no mesmo dia de cada mês (aluguel, internet, pró-labore…). Dá para encerrar a série depois.</p>}
        </>}
        <label className="c360-field">Situação<select ref={form.automatico ? firstField : undefined} className="c360-input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="pendente">Pendente</option><option value="pago">Pago</option></select></label>
        <label className="c360-field">Observação<textarea className="c360-input" rows={2} maxLength={500} value={form.obs} onChange={(event) => setForm({ ...form, obs: event.target.value })} /></label>
      </div>}
    </Dialog>

    {/* Modal para Cancelamento de Lançamento */}
    <Dialog open={Boolean(cancelando)} title="Cancelar lançamento?" labelId="fin-cancel" onClose={() => setCancelando(null)} danger
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setCancelando(null)}>Voltar</button>{cancelando?.serieId && <button type="button" className="c360-btn ghost" onClick={encerrarSerie}>Encerrar série (futuras)</button>}<button type="button" className="c360-btn primary" onClick={confirmarCancelamento}>Cancelar este</button></>}>
      <p>{cancelando?.descricao} · {money(cancelando?.valor)}. O lançamento fica no histórico como cancelado e sai dos totais.</p>
    </Dialog>

    {/* Modal de Confirmação para Liquidar as 71 despesas vencidas do Avec */}
    <Dialog
      open={modalLiquidarVencidos}
      title={"Liquidar todas as " + vencidos.length + " despesas vencidas?"}
      labelId="fin-liquidar-vencidos"
      onClose={() => setModalLiquidarVencidos(false)}
      actions={<>
        <button type="button" className="c360-btn ghost" onClick={() => setModalLiquidarVencidos(false)}>Voltar</button>
        <button type="button" className="c360-btn primary" onClick={confirmarLiquidarTodosVencidos} disabled={executandoLote}>
          {executandoLote ? 'Processando…' : 'Sim, marcar todas como pagas'}
        </button>
      </>}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <p>
          Você está prestes a liquidar <strong>{vencidos.length} lançamentos de despesas vencidas</strong> no valor total de <strong>{money(totalVencidos)}</strong>.
        </p>
        <p className="dadm-muted" style={{ fontSize: 13, margin: 0 }}>
          Essas despesas são registros históricos do Avec com vencimento entre 2025 e agosto/2026. Ao marcá-las como pagas, elas saem de "A pagar" e "Vencidos", e passam a integrar o histórico contábil consolidado como liquidadas.
        </p>
      </div>
    </Dialog>

    {/* Modal de Detalhamento Interativo de KPI */}
    {modalDetalheKpi && (
      <ModalDetalheKpi
        tipo={modalDetalheKpi}
        dados={obterDadosDetalheKpi(modalDetalheKpi)}
        modoK={modoK}
        onClose={() => setModalDetalheKpi(null)}
        onFiltrarTabela={(tipo) => toggleCardFiltro(tipo)}
      />
    )}
  </div>
}

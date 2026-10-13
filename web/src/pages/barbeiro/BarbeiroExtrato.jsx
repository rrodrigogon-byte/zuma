// Extrato do próprio barbeiro no celular: comissão por período (serviços,
// produtos e planos), o que foi descontado da base, vales e repasses com recibo.
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { abrirHtmlAutenticado } from '../admin/dino/RepassesPanel'

const t = { card: '#1C202B', line: '#2B3140', muted: '#A4AABE', cream: '#E8EAF2', green: '#3CC48B', yellow: '#E0B24B', red: '#F27A89', accent: '#6E7CE0', surface: '#161922' }
const reais = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dataBR = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '')
const hojeIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date())
function periodo(tipo) {
  const hoje = hojeIso()
  const d = new Date(`${hoje}T12:00:00Z`)
  if (tipo === 'semana') { const s = new Date(d); s.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return { inicio: s.toISOString().slice(0, 10), fim: hoje } }
  if (tipo === 'mes_anterior') { const ini = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)); const fim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0)); return { inicio: ini.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) } }
  return { inicio: `${hoje.slice(0, 8)}01`, fim: hoje }
}

export default function BarbeiroExtrato({ profissionalId = '' }) {
  const [tipo, setTipo] = useState('semana')
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    let ativo = true
    const { inicio, fim } = periodo(tipo)
    setErro('')
    api.get(`/api/admin/barbearia/modo-barbeiro/extrato?${new URLSearchParams({ inicio, fim, ...(profissionalId ? { profissionalId } : {}) })}`)
      .then((r) => { if (ativo) setDados(r) })
      .catch((e) => { if (ativo) setErro(e.message || 'Não foi possível carregar o extrato.') })
    return () => { ativo = false }
  }, [tipo, profissionalId])
  const btn = (ativo) => ({ flex: 1, minHeight: 44, borderRadius: 10, border: `1px solid ${ativo ? t.accent : t.line}`, background: ativo ? t.accent : t.surface, color: t.cream, font: 'inherit', fontWeight: 700, cursor: 'pointer' })
  const x = dados?.extrato
  const tot = x?.totais
  return <div style={{ display: 'grid', gap: 12 }}>
    <div role="group" aria-label="Período do extrato" style={{ display: 'flex', gap: 8 }}>{[['semana', 'Semana'], ['mes', 'Mês'], ['mes_anterior', 'Mês passado']].map(([id, nome]) => <button key={id} type="button" aria-pressed={tipo === id} style={btn(tipo === id)} onClick={() => setTipo(id)}>{nome}</button>)}</div>
    {erro && <div role="alert" style={{ color: t.red }}>{erro}</div>}
    {tot && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
        {[['Comissão', reais(tot.comissaoTotal), `${tot.atendimentos} serviço(s) · ${tot.vendasProdutos} venda(s)`, t.green], ['A receber', reais(tot.aReceber), tot.valesAbertos ? `vales: ${reais(tot.valesAbertos)}` : 'sem vales em aberto', t.cream], ['Serviços', reais(tot.comissaoServicos), `bruto ${reais(tot.bruto)}`, t.cream], ['Produtos e planos', reais(tot.comissaoProdutos + tot.comissaoPlanos), `planos ${reais(tot.comissaoPlanos)}`, t.cream]].map(([titulo, valor, sub, cor]) => <div key={titulo} style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 14, padding: 12 }}><div style={{ fontSize: 12, color: t.muted, fontWeight: 700 }}>{titulo}</div><div style={{ fontSize: 19, fontWeight: 800, color: cor }}>{valor}</div><div style={{ fontSize: 12, color: t.muted }}>{sub}</div></div>)}
      </div>
      {(tot.taxas > 0 || tot.materiais > 0) && <div style={{ fontSize: 13, color: t.muted }}>Descontado da base: taxas {reais(tot.taxas)} · material {reais(tot.materiais)}</div>}
      <div style={{ display: 'grid', gap: 6 }}>
        {x.linhas.length === 0 && x.pote.length === 0 && <div style={{ color: t.muted, textAlign: 'center', padding: 12 }}>Nada pago neste período ainda.</div>}
        {x.linhas.map((l, i) => <div key={`${l.origemId}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderBottom: `1px solid ${t.line}`, paddingBottom: 6, fontSize: 14 }}><span style={{ minWidth: 0 }}><strong>{l.descricao}</strong><br /><small style={{ color: t.muted }}>{dataBR(l.data)}{l.cliente ? ` · ${l.cliente}` : ''} · {reais(l.base)} × {l.percentual}%</small></span><strong style={{ color: t.green, whiteSpace: 'nowrap' }}>{reais(l.comissao)}</strong></div>)}
        {x.pote.map((p) => <div key={p.planoId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span>Pote do plano {p.plano}</span><strong style={{ color: t.green }}>{reais(p.valor)}</strong></div>)}
      </div>
      {(dados.repasses || []).length > 0 && <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 13, color: t.muted, fontWeight: 700 }}>Repasses recebidos</div>
        {dados.repasses.map((r) => <button key={r.id} type="button" onClick={() => abrirHtmlAutenticado(`/api/admin/barbearia/comissoes/repasses/${r.id}/recibo`).catch((e) => setErro(e.message))} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, background: t.card, border: `1px solid ${t.line}`, borderRadius: 12, padding: 10, color: t.cream, font: 'inherit', cursor: 'pointer', textAlign: 'left' }}><span>{r.recibo} · {dataBR(r.inicio)} a {dataBR(r.fim)}{r.status === 'estornado' ? ' · estornado' : ''}</span><strong>{reais(r.valorPago)}</strong></button>)}
      </div>}
    </>}
  </div>
}

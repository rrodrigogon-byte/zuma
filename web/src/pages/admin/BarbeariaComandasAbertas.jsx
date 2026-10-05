import { useEffect, useRef, useState } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { lerAgenda, erroAgenda } from '../../lib/agenda-read'
import './BarbeariaComandasAbertas.css'
const statusNome = { aberta: 'Em atendimento', aguardando_pagamento: 'Pronta para receber', parcialmente_paga: 'Pagamento parcial' }
export default function BarbeariaComandasAbertas({ profissionais = [], onOpen, refreshKey }) {
  const [itens, setItens] = useState([]), [erro, setErro] = useState(''), [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState(''), [status, setStatus] = useState(''), [profissional, setProfissional] = useState('')
  const [atualizado, setAtualizado] = useState(''), [revisao, setRevisao] = useState(0)
  const pedido = useRef(0)
  useEffect(() => {
    let ativo = true, ocupado = false
    async function carregar() {
      if (ocupado || (typeof document !== 'undefined' && document.hidden)) return
      ocupado = true
      const seq = ++pedido.current
      setLoading(true)
      try {
        const r = await lerAgenda(() => api.get('/api/admin/barbearia/comandas?pendentes=1'), { ativo: () => ativo && seq === pedido.current })
        if (!ativo || seq !== pedido.current) return
        setItens((r?.comandas || []).filter(c => statusNome[c.status]))
        setErro(''); setAtualizado(new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit' }))
      } catch (e) { if (ativo && seq === pedido.current) { setErro(erroAgenda(e)); setItens([]) } }
      finally { ocupado = false; if (ativo && seq === pedido.current) setLoading(false) }
    }
    carregar()
    const timer = setInterval(carregar, 30000)
    return () => { ativo = false; clearInterval(timer) }
  }, [revisao, refreshKey])
  const nomeProfissional = c => profissionais.find(p => p.id === c.profissionalId)?.nome || 'Sem profissional'
  const normalizar = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const filtrados = itens.filter(c => (!status || c.status === status) && (!profissional || c.profissionalId === profissional) && normalizar([c.clienteNome, c.clienteTelefone, c.id, nomeProfissional(c), ...(c.itens || []).map(i => i.nome)].join(' ')).includes(normalizar(busca)))
    .sort((a,b) => Number(b.status !== 'aberta') - Number(a.status !== 'aberta') || String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')))
  const saldo = filtrados.reduce((s,c) => s + Number(c.saldoPendente || 0), 0)
  return <section className="comandas-caixa" aria-label="Visão geral de comandas abertas">
    <header><div><span className="comandas-caixa-kicker">RECEPÇÃO E CAIXA</span><h2>Comandas abertas</h2><p>Todas as datas da unidade ativa. Pendências antigas continuam visíveis até o fechamento.</p></div><button type="button" onClick={() => setRevisao(r => r + 1)} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar comandas'}</button></header>
    <div className="comandas-caixa-filtros"><label>Buscar cliente, telefone, serviço ou comanda<input type="search" value={busca} onChange={e => setBusca(e.target.value)} /></label><label>Situação<select value={status} onChange={e => setStatus(e.target.value)}><option value="">Todas as pendências</option>{Object.entries(statusNome).map(([id,nome]) => <option key={id} value={id}>{nome}</option>)}</select></label><label>Profissional<select value={profissional} onChange={e => setProfissional(e.target.value)}><option value="">Toda a equipe</option>{profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label></div>
    {erro ? <p role="alert">{erro} Os valores não estão disponíveis até uma nova consulta.</p> : <>
      <div className="comandas-caixa-resumo" aria-live="polite"><strong>{filtrados.length} comanda(s)</strong><span>{filtrados.filter(c => c.status !== 'aberta').length} pronta(s) ou parcialmente paga(s)</span><strong>Saldo a receber: {fmtR(saldo)}</strong><small>{atualizado ? `Consultado às ${atualizado} · atualização a cada 30 s` : 'Consultando…'}</small></div>
      {!loading && !filtrados.length && <p>Nenhuma comanda pendente neste filtro. Contas já faturadas ficam no financeiro.</p>}
      <div className="comandas-caixa-grid">{filtrados.map(c => <article key={c.id}>
        <div className="comandas-caixa-card-head"><strong>{c.clienteNome || 'Nome não informado'}</strong><span>{statusNome[c.status]}</span></div>
        {c.clienteNomePendente && <small>Confira o nome no cadastro do cliente.</small>}
        <p>{nomeProfissional(c)} · {c.agendamentoId ? 'Vinculada à agenda' : 'Venda avulsa'}</p>
        <small>Aberta em {c.criadoEm ? fmtDate(c.criadoEm) : 'data não informada'} · {c.id}</small>
        <ul>{(c.itens || []).slice(0,3).map((item,i) => <li key={item.id || i}>{item.quantidade} × {item.nome}</li>)}</ul>{c.itens?.length > 3 && <small>+ {c.itens.length - 3} item(ns)</small>}
        <dl><div><dt>Total</dt><dd>{fmtR(c.total)}</dd></div><div><dt>Recebido</dt><dd>{fmtR(c.totalPago)}</dd></div><div><dt>Saldo a receber</dt><dd>{fmtR(c.saldoPendente)}</dd></div></dl>
        <button type="button" disabled={loading} onClick={() => onOpen(c)}>Conferir comanda e receber</button>
      </article>)}</div>
    </>}
    <p className="comandas-caixa-nota">Abrir a comanda não registra pagamento. O recebimento exige conferência e confirmação no caixa.</p>
  </section>
}

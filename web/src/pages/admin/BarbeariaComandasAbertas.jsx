import { useEffect, useRef, useState } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { lerAgenda, erroAgenda } from '../../lib/agenda-read'
import './BarbeariaComandasAbertas.css'
const statusNome = { aberta: 'Em atendimento', aguardando_pagamento: 'Pronta para receber', parcialmente_paga: 'Pagamento parcial' }
export default function BarbeariaComandasAbertas({ profissionais = [], onOpen, onNovaComanda, refreshKey }) {
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
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
      <div>
        <span className="comandas-caixa-kicker">RECEPÇÃO E CAIXA</span>
        <h2>Comandas Abertas</h2>
        <p>Abertura de comandas avulsas (serviços ou apenas bebidas/bar) e conferência de recebimentos.</p>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {onNovaComanda && (
          <button
            type="button"
            onClick={() => onNovaComanda()}
            style={{
              background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(29, 78, 216, 0.35)',
            }}
          >
            <span style={{ fontSize: 16 }}>➕</span> Abrir Comanda +
          </button>
        )}
        <div
          style={{
            background: filtrados.length > 0 ? '#fef3c7' : '#f1f5f9',
            color: filtrados.length > 0 ? '#92400e' : '#475569',
            border: filtrados.length > 0 ? '1px solid #fcd34d' : '1px solid #cbd5e1',
            borderRadius: 8,
            padding: '9px 14px',
            fontSize: 13,
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>📋</span> Comandas Pendentes ({filtrados.length})
        </div>
        <button type="button" onClick={() => setRevisao(r => r + 1)} disabled={loading} style={{ padding: '9px 14px', fontSize: 13 }}>
          {loading ? 'Atualizando…' : '🔄 Atualizar'}
        </button>
      </div>
    </header>
    <div className="comandas-caixa-filtros"><label>Buscar cliente, telefone, serviço ou comanda<input type="search" value={busca} onChange={e => setBusca(e.target.value)} /></label><label>Situação<select value={status} onChange={e => setStatus(e.target.value)}><option value="">Todas as pendências</option>{Object.entries(statusNome).map(([id,nome]) => <option key={id} value={id}>{nome}</option>)}</select></label><label>Profissional<select value={profissional} onChange={e => setProfissional(e.target.value)}><option value="">Toda a equipe</option>{profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label></div>
    {erro ? <p role="alert">{erro} Os valores não estão disponíveis até uma nova consulta.</p> : <>
      <div className="comandas-caixa-resumo" aria-live="polite"><strong>{filtrados.length} comanda(s)</strong><span>{filtrados.filter(c => c.status !== 'aberta').length} pronta(s) ou parcialmente paga(s)</span><strong>Saldo a receber: {fmtR(saldo)}</strong><small>{atualizado ? `Consultado às ${atualizado} · atualização a cada 30 s` : 'Consultando…'}</small></div>
      {!loading && !filtrados.length && (
        <div style={{ textAlign: 'center', padding: '36px 18px', background: 'var(--card, #fff)', border: '1px dashed var(--line, #cbd5e1)', borderRadius: 12, margin: '14px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🧾🍺</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>Nenhuma comanda aberta no momento</h3>
          <p style={{ fontSize: 13, color: 'var(--muted, #64748b)', margin: '0 0 16px' }}>
            O cliente chegou apenas para bebidas ou consumo do bar? Abra a comanda diretamente aqui no caixa sem precisar de agendamento na cadeira.
          </p>
          {onNovaComanda && (
            <button
              type="button"
              onClick={() => onNovaComanda()}
              style={{
                background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(29, 78, 216, 0.3)',
              }}
            >
              ➕ Abrir Comanda Agora (Bebidas, Bar ou Serviços)
            </button>
          )}
        </div>
      )}
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

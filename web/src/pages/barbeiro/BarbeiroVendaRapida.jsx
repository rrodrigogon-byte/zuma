import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { lerAgenda, erroAgenda } from '../../lib/agenda-read'
import './BarbeiroVendaRapida.css'
const reais = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export default function BarbeiroVendaRapida({ profissional, atendimento, onPronto, onEstadoChange }) {
  const [catalogo, setCatalogo] = useState(null)
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => { const atualizar = () => setOnline(navigator.onLine); window.addEventListener('online', atualizar); window.addEventListener('offline', atualizar); return () => { window.removeEventListener('online', atualizar); window.removeEventListener('offline', atualizar) } }, [])
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState('servico')
  const [carrinho, setCarrinho] = useState([])
  const [nome, setNome] = useState(atendimento?.clienteNome || '')
  const [telefone, setTelefone] = useState(atendimento?.clienteTelefone || '')
  const [enviando, setEnviando] = useState(false)
  const [pendente, setPendente] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [revisao, setRevisao] = useState(0)
  const trava = useRef(false)
  const chave = useRef(null)
  useEffect(() => {
    let ativo = true
    setCatalogo(null); setErro('')
    lerAgenda(() => api.get(`/api/admin/barbearia/modo-barbeiro/catalogo?${new URLSearchParams({ profissionalId: profissional.id, agendamentoId: atendimento?.id || '' })}`), { ativo: () => ativo })
      .then(r => { if (ativo && r) { setCatalogo(r); if (atendimento && !r.comanda) { const s = r.servicos.find(s => s.id === atendimento.servicoId); if (s) setCarrinho(atual => atual.length ? atual : [{ ...s, tipo: 'servico', quantidade: 1 }]) } } }).catch(e => { if (ativo) setErro(erroAgenda(e)) })
    return () => { ativo = false }
  }, [profissional.id, atendimento?.id, revisao])
  const bloqueado = enviando || Boolean(pendente)
  useEffect(() => {
    if (!bloqueado) return
    const aviso = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [bloqueado])
  function adicionar(item) {
    if (bloqueado) return
    setCarrinho(atual => {
      const anterior = atual.find(i => i.id === item.id && i.tipo === tipo)
      const limite = tipo === 'produto' ? Math.min(99, Math.floor(item.estoque)) : 99
      if ((anterior?.quantidade || 0) >= limite) return atual
      return anterior ? atual.map(i => i === anterior ? { ...i, quantidade: i.quantidade + 1 } : i) : [...atual, { ...item, tipo, quantidade: 1 }]
    })
  }
  function reduzir(item) { if (!bloqueado) setCarrinho(atual => atual.flatMap(i => i !== item ? [i] : i.quantidade > 1 ? [{ ...i, quantidade: i.quantidade - 1 }] : [])) }
  async function salvar() {
    if (trava.current || !carrinho.length || !nome.trim() || !navigator.onLine) return
    trava.current = true; setEnviando(true); onEstadoChange?.(true); setErro('')
    if (!chave.current) chave.current = crypto.randomUUID()
    const payload = pendente || { profissionalId: profissional.id, agendamentoId: atendimento?.id || '', clienteNome: nome.trim(), clienteTelefone: telefone, itens: carrinho.map(i => ({ tipo: i.tipo, ...(i.tipo === 'servico' ? { servicoId: i.id } : { produtoId: i.id }), quantidade: i.quantidade })) }
    try {
      const r = await api.post('/api/admin/barbearia/modo-barbeiro/comandas', payload, { headers: { 'Idempotency-Key': chave.current } })
      if (!r?.comanda?.id) throw new Error('Não foi possível confirmar o registro no servidor.')
      setResultado(r.comanda); setPendente(null); onEstadoChange?.(false); onPronto?.()
    } catch (e) {
      // Keep exactly the same payload/key on an ambiguous network failure.
      if (!e.status || e.status >= 500) { setPendente(payload); setErro('Não foi possível confirmar se salvou. Toque em “Conferir e tentar novamente”; a mesma operação será consultada sem duplicar. Mantenha esta tela aberta.') }
      else { setPendente(null); onEstadoChange?.(false); chave.current = null; setErro(e.message || 'Revise os itens antes de salvar.') }
    } finally { trava.current = false; setEnviando(false) }
  }
  if (resultado) return <div className="barber-sale" role="status"><h3>Comanda salva</h3><p>Código: {resultado.id}</p>{resultado.itens.map((i,index) => <p key={index}>{i.quantidade} × {i.nome} · {reais(i.subtotal)}</p>)}<strong>Total da comanda: {reais(resultado.total)}</strong><p>Saldo no caixa: {reais(resultado.saldoPendente)}. O pagamento ainda precisa ser recebido e confirmado no caixa.</p></div>
  const lista = (tipo === 'servico' ? catalogo?.servicos : catalogo?.produtos) || []
  const filtrados = lista.filter(i => i.nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(busca.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()))
  return <div className="barber-sale">
    <p>{profissional.nome} · {atendimento ? 'Itens adicionais ao atendimento selecionado' : 'Nova comanda'}</p>
    {catalogo?.comanda && <div><strong>Já lançado na comanda</strong>{catalogo.comanda.itens.map((i,n) => <p key={n}>{i.quantidade} × {i.nome} · {reais(i.subtotal)}</p>)}<p>Você está acrescentando itens. Status: {catalogo.comanda.status}.</p></div>}
    {!online && <p role="status">Sem conexão. Os itens continuam na tela; aguarde a internet para salvar.</p>}
    {(!atendimento || !atendimento.clienteNome) && <div className="barber-sale-client"><label>Nome do cliente<input value={nome} onChange={e => setNome(e.target.value)} disabled={bloqueado} autoComplete="name" /></label><label>Telefone (opcional)<input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} disabled={bloqueado} autoComplete="tel" /></label></div>}
    {erro && <p role="alert">{erro}</p>}
    {!catalogo && !erro && <p role="status">Carregando catálogo…</p>}
    {!catalogo && erro && <button type="button" onClick={() => setRevisao(n => n + 1)}>Recarregar catálogo</button>}
    {catalogo && <><div className="barber-sale-tabs" role="group" aria-label="Catálogo"><button type="button" aria-pressed={tipo === 'servico'} onClick={() => setTipo('servico')}>Serviços ({catalogo.servicos.length})</button><button type="button" aria-pressed={tipo === 'produto'} onClick={() => setTipo('produto')}>Produtos ({catalogo.produtos.length})</button></div>
      <label>Buscar no catálogo<input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome do serviço ou produto" /></label>
      <div className="barber-sale-catalog">{filtrados.map(i => <button type="button" key={i.id} disabled={bloqueado} onClick={() => adicionar(i)}><strong>{i.nome}</strong><span>{reais(i.preco)} · {tipo === 'servico' ? `${i.duracaoMinutos} min` : `${i.estoque} em estoque`}</span><b>+ Adicionar</b></button>)}{!filtrados.length && <p>Nenhum item disponível neste filtro.</p>}</div>
      <div className="barber-sale-cart" aria-label="Itens da comanda">{carrinho.map(i => <div key={`${i.tipo}-${i.id}`}><span>{i.quantidade} × {i.nome}<small>{reais(i.preco * i.quantidade)}</small></span><button type="button" aria-label={`Diminuir ${i.nome}`} disabled={bloqueado} onClick={() => reduzir(i)}>−</button></div>)}</div>
      <strong aria-live="polite">Total dos itens: {reais(carrinho.reduce((n,i) => n + i.preco * i.quantidade,0))}</strong>
      <p>Preços e estoque são conferidos no servidor ao salvar. Produtos do catálogo de revenda do ERP.</p>
      <button type="button" className="barber-sale-save" disabled={enviando || !online || !carrinho.length || !nome.trim() || (catalogo?.comanda && !['aberta','aguardando_pagamento'].includes(catalogo.comanda.status))} onClick={salvar}>{enviando ? 'Conferindo…' : pendente ? 'Conferir e tentar novamente' : 'Salvar comanda para o caixa'}</button>
    </>}
  </div>
}

/**
 * PDV Unificado — SetPoint Ultra
 * Atende todos os segmentos: Supermercado, Loja de Moda, Barbearia, Varejo, Bar
 * Rota: /admin/pdv-erp
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../../lib/api'

const theme = {
  bg: '#0f1117', surface: '#1a1d27', card: '#22263a',
  green: '#5fb335', muted: '#8a8fa8', cream: '#e8e6df',
  line: '#2e3248', red: '#e05c5c', yellow: '#f5a623', blue: '#4a9eff',
}

const SEGMENTOS = [
  { id: 'supermercado', label: 'Supermercado', icon: '🏪', cor: '#4a9eff' },
  { id: 'loja-moda',    label: 'Loja de Moda', icon: '👗', cor: '#e05c5c' },
  { id: 'barbearia',    label: 'Barbearia',    icon: '✂️', cor: '#f5a623' },
  { id: 'varejo',       label: 'Varejo Geral', icon: '🛒', cor: '#5fb335' },
  { id: 'bar',          label: 'Bar/Rest.',    icon: '🍺', cor: '#9b59b6' },
]

const FORMAS_PGTO = [
  { id: 'dinheiro',     label: 'Dinheiro',    icon: '💵' },
  { id: 'pix',          label: 'PIX',         icon: '⚡' },
  { id: 'debito',       label: 'Débito',      icon: '💳' },
  { id: 'credito',      label: 'Crédito',     icon: '💳' },
  { id: 'crediario',    label: 'Crediário',   icon: '📋' },
  { id: 'vale_presente',label: 'Vale',        icon: '🎁' },
]

export default function PDVUnificado() {
  const [segmento, setSegmento] = useState('varejo')
  const [itens, setItens] = useState([])
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [formaPgto, setFormaPgto] = useState('dinheiro')
  const [desconto, setDesconto] = useState(0)
  const [tipoDesconto, setTipoDesconto] = useState('valor') // 'valor' | 'percentual'
  const [troco, setTroco] = useState('')
  const [finalizando, setFinalizando] = useState(false)
  const [venda, setVenda] = useState(null)
  const [modalGrade, setModalGrade] = useState(null) // produto com grade de moda
  const [modalPgto, setModalPgto] = useState(false)
  const inputRef = useRef(null)
  const buscaTimer = useRef(null)

  // Focar no input ao montar
  useEffect(() => { inputRef.current?.focus() }, [])

  // Busca com debounce
  useEffect(() => {
    if (!busca.trim()) { setResultados([]); return }
    clearTimeout(buscaTimer.current)
    buscaTimer.current = setTimeout(() => buscarProduto(busca), 300)
    return () => clearTimeout(buscaTimer.current)
  }, [busca, segmento])

  async function buscarProduto(termo) {
    setBuscando(true)
    try {
      let url = ''
      if (segmento === 'supermercado') {
        // Tentar busca por código de barras primeiro (inclui código de balança)
        if (/^\d+$/.test(termo)) {
          const res = await api.get(`/api/supermercado/produtos/buscar/${termo}`)
          if (res?.produto) {
            adicionarItem(res.produto, res.produto.peso_balanca)
            setBusca('')
            setResultados([])
            inputRef.current?.focus()
            return
          }
        }
        const res = await api.get(`/api/supermercado/produtos?busca=${encodeURIComponent(termo)}&limit=8`)
        setResultados(res?.produtos || [])
      } else if (segmento === 'loja-moda') {
        const res = await api.get(`/api/loja-moda/produtos?busca=${encodeURIComponent(termo)}&limit=8`)
        setResultados(res?.produtos || [])
      } else {
        const res = await api.get(`/api/estoque/produtos?busca=${encodeURIComponent(termo)}&limit=8`)
        setResultados(res?.produtos || [])
      }
    } catch { setResultados([]) }
    finally { setBuscando(false) }
  }

  function adicionarItem(produto, quantidade = 1, variante = null) {
    const chave = variante ? `${produto.id}-${variante.id}` : produto.id
    const precoFinal = produto.preco_final || produto.preco_venda || 0

    setItens(prev => {
      const idx = prev.findIndex(i => i.chave === chave)
      if (idx >= 0) {
        const novos = [...prev]
        novos[idx] = { ...novos[idx], quantidade: novos[idx].quantidade + (parseFloat(quantidade) || 1) }
        return novos
      }
      return [...prev, {
        chave,
        produto_id: produto.id,
        variante_id: variante?.id || null,
        nome: variante ? `${produto.nome} — ${variante.cor} / ${variante.tamanho}` : produto.nome,
        preco: parseFloat(precoFinal),
        preco_original: parseFloat(produto.preco_venda || precoFinal),
        quantidade: parseFloat(quantidade) || 1,
        unidade: produto.unidade || 'UN',
        pesavel: produto.pesavel || false,
        promocao: produto.promocao || null,
      }]
    })
  }

  function removerItem(chave) {
    setItens(prev => prev.filter(i => i.chave !== chave))
  }

  function alterarQuantidade(chave, delta) {
    setItens(prev => prev.map(i => {
      if (i.chave !== chave) return i
      const nova = Math.max(0.001, i.quantidade + delta)
      return { ...i, quantidade: Math.round(nova * 1000) / 1000 }
    }).filter(i => i.quantidade > 0))
  }

  function alterarPreco(chave, novoPreco) {
    setItens(prev => prev.map(i =>
      i.chave === chave ? { ...i, preco: parseFloat(novoPreco) || 0 } : i
    ))
  }

  // Cálculos
  const subtotal = itens.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const valorDesconto = tipoDesconto === 'percentual'
    ? subtotal * (parseFloat(desconto) / 100)
    : parseFloat(desconto) || 0
  const total = Math.max(0, subtotal - valorDesconto)
  const trocoCalc = formaPgto === 'dinheiro' && parseFloat(troco) > total
    ? parseFloat(troco) - total : 0

  async function finalizarVenda() {
    if (!itens.length) return
    setFinalizando(true)
    try {
      const payload = {
        segmento,
        itens: itens.map(i => ({
          produto_id: i.produto_id,
          variante_id: i.variante_id,
          quantidade: i.quantidade,
          preco_unitario: i.preco,
        })),
        forma_pagamento: formaPgto,
        desconto: valorDesconto,
        total,
        troco: trocoCalc,
      }
      const res = await api.post('/api/pdv/venda', payload)
      setVenda(res.venda)
      setItens([])
      setDesconto(0)
      setTroco('')
      setModalPgto(false)
    } catch (err) {
      alert(err.message || 'Erro ao finalizar venda')
    } finally {
      setFinalizando(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', background: theme.bg, color: theme.cream, overflow: 'hidden' }}>

      {/* ── Coluna esquerda: produtos ─────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${theme.line}`, overflow: 'hidden' }}>

        {/* Seletor de segmento */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 12px', borderBottom: `1px solid ${theme.line}`, overflowX: 'auto' }}>
          {SEGMENTOS.map(sg => (
            <button
              key={sg.id}
              onClick={() => { setSegmento(sg.id); setResultados([]); setBusca('') }}
              style={{
                padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: segmento === sg.id ? sg.cor : theme.surface,
                color: segmento === sg.id ? '#fff' : theme.muted,
                fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                transition: 'all .15s',
              }}
            >
              {sg.icon} {sg.label}
            </button>
          ))}
        </div>

        {/* Campo de busca / código de barras */}
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${theme.line}` }}>
          <input
            ref={inputRef}
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="🔍 Código de barras, nome ou referência..."
            style={{
              width: '100%', padding: '12px 14px', boxSizing: 'border-box',
              background: theme.surface, border: `1px solid ${theme.line}`,
              borderRadius: 10, color: theme.cream, fontSize: 14, outline: 'none',
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && resultados.length === 1) {
                const p = resultados[0]
                if (segmento === 'loja-moda' && p.variacoes?.length > 0) {
                  setModalGrade(p)
                } else {
                  adicionarItem(p)
                  setBusca('')
                  setResultados([])
                }
              }
            }}
          />
        </div>

        {/* Resultados da busca */}
        {resultados.length > 0 && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
            {resultados.map(p => (
              <div
                key={p.id}
                onClick={() => {
                  if (segmento === 'loja-moda' && p.variacoes?.length > 0) {
                    setModalGrade(p)
                  } else {
                    adicionarItem(p)
                    setBusca('')
                    setResultados([])
                    inputRef.current?.focus()
                  }
                }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 14px', marginBottom: 6,
                  background: theme.card, border: `1px solid ${theme.line}`,
                  borderRadius: 10, cursor: 'pointer', transition: 'border-color .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = theme.green}
                onMouseLeave={e => e.currentTarget.style.borderColor = theme.line}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{p.nome}</div>
                  <div style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>
                    {p.codigo_barras || p.referencia || p.codigo_interno}
                    {p.unidade && ` · ${p.unidade}`}
                    {p.estoque_atual !== undefined && ` · Estoque: ${p.estoque_atual}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {p.preco_final && p.preco_final < p.preco_venda ? (
                    <>
                      <div style={{ textDecoration: 'line-through', color: theme.muted, fontSize: 11 }}>
                        R$ {parseFloat(p.preco_venda).toFixed(2)}
                      </div>
                      <div style={{ fontWeight: 800, color: theme.green, fontSize: 14 }}>
                        R$ {parseFloat(p.preco_final).toFixed(2)}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontWeight: 800, color: theme.green, fontSize: 14 }}>
                      R$ {parseFloat(p.preco_venda || p.preco_final || 0).toFixed(2)}
                    </div>
                  )}
                  {segmento === 'loja-moda' && p.total_variacoes > 0 && (
                    <div style={{ fontSize: 10, color: theme.yellow, marginTop: 2 }}>
                      {p.total_variacoes} variações
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mensagem de boas-vindas quando vazio */}
        {!resultados.length && !busca && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: theme.muted }}>
            <div style={{ fontSize: 48 }}>
              {SEGMENTOS.find(s => s.id === segmento)?.icon || '🛒'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {SEGMENTOS.find(s => s.id === segmento)?.label}
            </div>
            <div style={{ fontSize: 12 }}>Digite ou passe o código de barras</div>
          </div>
        )}
      </div>

      {/* ── Coluna direita: carrinho ──────────────────────────────────────── */}
      <div style={{ width: 380, display: 'flex', flexDirection: 'column', background: theme.surface }}>

        {/* Header do carrinho */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${theme.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>🛒 Carrinho ({itens.length})</div>
          {itens.length > 0 && (
            <button
              onClick={() => { if (confirm('Limpar carrinho?')) setItens([]) }}
              style={{ background: 'none', border: 'none', color: theme.red, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
            >
              Limpar
            </button>
          )}
        </div>

        {/* Itens do carrinho */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {itens.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: theme.muted, fontSize: 13 }}>
              Nenhum item adicionado
            </div>
          ) : itens.map(item => (
            <div key={item.chave} style={{
              background: theme.card, border: `1px solid ${theme.line}`,
              borderRadius: 10, padding: '10px 12px', marginBottom: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, flex: 1, marginRight: 8 }}>{item.nome}</div>
                <button onClick={() => removerItem(item.chave)} style={{ background: 'none', border: 'none', color: theme.red, cursor: 'pointer', fontSize: 14 }}>✕</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Controle de quantidade */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => alterarQuantidade(item.chave, item.pesavel ? -0.1 : -1)}
                    style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${theme.line}`, background: theme.surface, color: theme.cream, cursor: 'pointer', fontSize: 14 }}
                  >−</button>
                  <span style={{ fontSize: 13, fontWeight: 700, minWidth: 36, textAlign: 'center' }}>
                    {item.pesavel ? item.quantidade.toFixed(3) : item.quantidade}
                    <span style={{ fontSize: 10, color: theme.muted, marginLeft: 2 }}>{item.unidade}</span>
                  </span>
                  <button
                    onClick={() => alterarQuantidade(item.chave, item.pesavel ? 0.1 : 1)}
                    style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${theme.line}`, background: theme.surface, color: theme.cream, cursor: 'pointer', fontSize: 14 }}
                  >+</button>
                </div>
                {/* Preço editável */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: theme.muted, fontSize: 11 }}>R$</span>
                  <input
                    type="number"
                    value={item.preco}
                    onChange={e => alterarPreco(item.chave, e.target.value)}
                    style={{
                      width: 64, padding: '4px 6px', textAlign: 'right',
                      background: theme.surface, border: `1px solid ${theme.line}`,
                      borderRadius: 6, color: theme.green, fontSize: 13, fontWeight: 700, outline: 'none',
                    }}
                    step="0.01"
                  />
                </div>
                <div style={{ fontWeight: 800, fontSize: 13, minWidth: 64, textAlign: 'right' }}>
                  R$ {(item.preco * item.quantidade).toFixed(2)}
                </div>
              </div>
              {item.promocao && (
                <div style={{ fontSize: 10, color: theme.yellow, marginTop: 4 }}>
                  🏷️ Promoção: {item.promocao.nome}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Desconto */}
        {itens.length > 0 && (
          <div style={{ padding: '10px 12px', borderTop: `1px solid ${theme.line}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.muted, marginBottom: 6 }}>DESCONTO</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setTipoDesconto('valor')}
                style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: tipoDesconto === 'valor' ? theme.green : theme.card, color: tipoDesconto === 'valor' ? '#fff' : theme.muted }}
              >R$</button>
              <button
                onClick={() => setTipoDesconto('percentual')}
                style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: tipoDesconto === 'percentual' ? theme.green : theme.card, color: tipoDesconto === 'percentual' ? '#fff' : theme.muted }}
              >%</button>
              <input
                type="number"
                value={desconto}
                onChange={e => setDesconto(e.target.value)}
                placeholder="0"
                style={{ flex: 1, padding: '6px 10px', background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 8, color: theme.cream, fontSize: 13, outline: 'none' }}
                min="0"
                step="0.01"
              />
            </div>
          </div>
        )}

        {/* Totais */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${theme.line}` }}>
          {valorDesconto > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: theme.muted }}>Subtotal</span>
              <span>R$ {subtotal.toFixed(2)}</span>
            </div>
          )}
          {valorDesconto > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: theme.red }}>Desconto</span>
              <span style={{ color: theme.red }}>− R$ {valorDesconto.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 900, marginBottom: 12 }}>
            <span>TOTAL</span>
            <span style={{ color: theme.green }}>R$ {total.toFixed(2)}</span>
          </div>

          {/* Forma de pagamento */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
            {FORMAS_PGTO.map(fp => (
              <button
                key={fp.id}
                onClick={() => setFormaPgto(fp.id)}
                style={{
                  padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: formaPgto === fp.id ? theme.green : theme.card,
                  color: formaPgto === fp.id ? '#fff' : theme.muted,
                  fontSize: 10, fontWeight: 700, transition: 'all .15s',
                }}
              >
                <div style={{ fontSize: 16, marginBottom: 2 }}>{fp.icon}</div>
                {fp.label}
              </button>
            ))}
          </div>

          {/* Troco (apenas dinheiro) */}
          {formaPgto === 'dinheiro' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: theme.muted, whiteSpace: 'nowrap' }}>Recebido:</span>
              <input
                type="number"
                value={troco}
                onChange={e => setTroco(e.target.value)}
                placeholder={total.toFixed(2)}
                style={{ flex: 1, padding: '8px 10px', background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 8, color: theme.cream, fontSize: 13, outline: 'none' }}
                step="0.01"
              />
              {trocoCalc > 0 && (
                <div style={{ fontSize: 13, fontWeight: 800, color: theme.yellow, whiteSpace: 'nowrap' }}>
                  Troco: R$ {trocoCalc.toFixed(2)}
                </div>
              )}
            </div>
          )}

          {/* Botão finalizar */}
          <button
            onClick={finalizarVenda}
            disabled={!itens.length || finalizando}
            style={{
              width: '100%', padding: '16px',
              background: itens.length ? theme.green : theme.card,
              color: itens.length ? '#fff' : theme.muted,
              border: 'none', borderRadius: 12,
              fontSize: 16, fontWeight: 900, cursor: itens.length ? 'pointer' : 'not-allowed',
              transition: 'all .15s',
            }}
          >
            {finalizando ? '⏳ Processando...' : `✅ Finalizar — R$ ${total.toFixed(2)}`}
          </button>
        </div>
      </div>

      {/* ── Modal: Grade de moda ──────────────────────────────────────────── */}
      {modalGrade && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{ background: theme.card, borderRadius: 16, padding: 24, width: 400, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>👗 {modalGrade.nome}</div>
              <button onClick={() => setModalGrade(null)} style={{ background: 'none', border: 'none', color: theme.muted, cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: theme.muted, marginBottom: 12 }}>Selecione a variação:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {(modalGrade.variacoes || []).map(v => (
                <button
                  key={v.id}
                  onClick={() => {
                    adicionarItem(modalGrade, 1, v)
                    setModalGrade(null)
                    setBusca('')
                    setResultados([])
                    inputRef.current?.focus()
                  }}
                  disabled={v.estoque <= 0}
                  style={{
                    padding: '10px 12px', borderRadius: 10,
                    border: `1.5px solid ${v.estoque > 0 ? theme.line : theme.red}`,
                    background: v.estoque > 0 ? theme.surface : 'rgba(224,92,92,.08)',
                    color: v.estoque > 0 ? theme.cream : theme.red,
                    cursor: v.estoque > 0 ? 'pointer' : 'not-allowed',
                    fontSize: 12, fontWeight: 700, textAlign: 'left',
                  }}
                >
                  <div>{v.cor} / {v.tamanho}</div>
                  <div style={{ fontSize: 10, color: theme.muted, marginTop: 2 }}>
                    Estoque: {v.estoque} · R$ {parseFloat(v.preco || modalGrade.preco_venda).toFixed(2)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Venda confirmada ───────────────────────────────────────── */}
      {venda && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{ background: theme.card, borderRadius: 20, padding: 32, width: 360, textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: theme.green, marginBottom: 8 }}>Venda realizada!</div>
            <div style={{ color: theme.muted, fontSize: 13, marginBottom: 20 }}>
              Venda #{venda.id?.slice(-6).toUpperCase()} · R$ {parseFloat(venda.total || 0).toFixed(2)}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setVenda(null)}
                style={{ flex: 1, padding: '12px', background: theme.green, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: 14 }}
              >
                Nova Venda
              </button>
              <button
                onClick={() => { /* imprimir cupom */ setVenda(null) }}
                style={{ flex: 1, padding: '12px', background: theme.surface, color: theme.cream, border: `1px solid ${theme.line}`, borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
              >
                🖨️ Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

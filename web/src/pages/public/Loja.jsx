import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XGG']

function fmtTel(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim()
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim()
}

// Categorias que requerem seleção de tamanho
function hasSize(produto) {
  const c = produto.cat?.toLowerCase() || ''
  return c === 'kit' || c === 'camiseta' || produto.nome?.toLowerCase().includes('camis')
}

// ── Carrinho Badge ──────────────────────────────────────────────────────────

function CartBadge({ count, onClick }) {
  if (count === 0) return null
  return (
    <button onClick={onClick} style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
      background: 'linear-gradient(135deg, #5FB335, #7BC142)',
      color: '#1B4D2E', border: 'none', borderRadius: '999px',
      padding: '14px 22px', fontWeight: 800, fontSize: '1rem',
      cursor: 'pointer', boxShadow: '0 6px 24px rgba(95,179,53,0.5)',
      display: 'flex', alignItems: 'center', gap: 10,
      transition: 'transform .15s, box-shadow .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(95,179,53,0.6)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 6px 24px rgba(95,179,53,0.5)' }}
    >
      🛒 <span>Carrinho</span>
      <span style={{
        background: '#1B4D2E', color: '#7BC142',
        borderRadius: '999px', padding: '2px 9px', fontSize: '0.82rem', fontWeight: 900,
      }}>{count}</span>
    </button>
  )
}

// ── Produto Card ────────────────────────────────────────────────────────────

function ProdutoCard({ produto, onAddCart, qtdNoCarrinho }) {
  const p = produto
  const esgotado = p.estoque != null && p.estoque <= 0
  const poucasVagas = !esgotado && p.estoque != null && p.estoque <= 5
  const [addingSize, setAddingSize] = useState(false)
  const [tamanhoSel, setTamanhoSel] = useState('')
  const [sizeErr, setSizeErr] = useState(false)
  const needsSize = hasSize(p)

  const handleAdd = () => {
    if (esgotado) return
    if (needsSize) {
      setAddingSize(true)
      return
    }
    onAddCart(p, 1, '')
  }

  const confirmSize = () => {
    if (!tamanhoSel) { setSizeErr(true); return }
    onAddCart(p, 1, tamanhoSel)
    setAddingSize(false)
    setTamanhoSel('')
    setSizeErr(false)
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 20, overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
      border: esgotado ? '1.5px solid #eee' : qtdNoCarrinho > 0 ? '2px solid #5FB335' : '1.5px solid rgba(95,179,53,0.15)',
      opacity: esgotado ? 0.75 : 1,
      display: 'flex', flexDirection: 'column',
      transition: 'transform .2s, box-shadow .2s',
      position: 'relative',
    }}
      onMouseEnter={e => !esgotado && (e.currentTarget.style.transform = 'translateY(-4px)', e.currentTarget.style.boxShadow = '0 10px 32px rgba(0,0,0,0.12)')}
      onMouseLeave={e => (e.currentTarget.style.transform = '', e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.07)')}
    >
      {/* Badge carrinho */}
      {qtdNoCarrinho > 0 && (
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 5,
          background: '#5FB335', color: '#fff', borderRadius: '999px',
          padding: '3px 10px', fontSize: '0.72rem', fontWeight: 800,
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        }}>{qtdNoCarrinho} no carrinho</div>
      )}

      {/* Imagem */}
      <div style={{
        height: 200,
        background: p.imagem ? '#fff' : esgotado
          ? 'linear-gradient(135deg,#e0e0e0,#f0f0f0)'
          : 'linear-gradient(135deg,#1B4D2E 0%,#1a4a2e 60%,#2a5a3e 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '5rem', position: 'relative', overflow: 'hidden',
      }}>
        {p.imagem ? (
          <img src={p.imagem} alt={p.nome}
            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 10, filter: esgotado ? 'grayscale(60%) opacity(0.7)' : 'none' }}
            onError={e => { e.target.style.display = 'none'; e.target.parentNode.querySelector('.img-fallback').style.display = 'flex' }}
          />
        ) : null}
        <div className="img-fallback" style={{ display: p.imagem ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem' }}>
          {p.emoji || '📦'}
        </div>

        {/* Badges */}
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {esgotado && (
            <span style={{ background: '#e05555', color: '#fff', borderRadius: 999, padding: '4px 12px', fontSize: '0.72rem', fontWeight: 800 }}>ESGOTADO</span>
          )}
          {poucasVagas && (
            <span style={{ background: '#C9A656', color: '#1B4D2E', borderRadius: 999, padding: '4px 12px', fontSize: '0.72rem', fontWeight: 800 }}>ÚLTIMAS {p.estoque}</span>
          )}
        </div>
        {p.cod && (
          <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(14,46,28,.85)', color: '#7BC142', borderRadius: 6, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 800 }}>
            {p.cod}
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div style={{ padding: '18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 800, color: '#1B4D2E' }}>{p.nome}</h3>
        {(p.desc || p.descricao) && (
          <p style={{ margin: '0 0 10px', fontSize: '0.83rem', color: '#5a7a5a', lineHeight: 1.5, flex: 1 }}>
            {(() => { const d = p.desc || p.descricao; return d.length > 90 ? d.slice(0, 90) + '…' : d })()}
          </p>
        )}

        <div style={{ marginTop: 'auto' }}>
          {p.estoque != null && !esgotado && (
            <div style={{ fontSize: '0.76rem', color: poucasVagas ? '#C9A656' : '#5a7a5a', marginBottom: 10, fontWeight: poucasVagas ? 700 : 400 }}>
              {poucasVagas ? `⚡ Apenas ${p.estoque} unidade${p.estoque > 1 ? 's' : ''} disponível${p.estoque > 1 ? 'is' : ''}` : `✅ ${p.estoque} em estoque`}
            </div>
          )}

          {/* Seletor de tamanho inline */}
          {addingSize && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1B4D2E', marginBottom: 6 }}>Selecione o tamanho:</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TAMANHOS.map(t => (
                  <button key={t} onClick={() => { setTamanhoSel(t); setSizeErr(false) }}
                    style={{
                      padding: '5px 12px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700,
                      border: tamanhoSel === t ? '2px solid #5FB335' : '1.5px solid #d0dcc8',
                      background: tamanhoSel === t ? '#5FB335' : '#fff',
                      color: tamanhoSel === t ? '#1B4D2E' : '#333',
                      cursor: 'pointer', transition: 'all .1s',
                    }}
                  >{t}</button>
                ))}
              </div>
              {sizeErr && <div style={{ color: '#e05555', fontSize: '0.75rem', marginTop: 4 }}>Selecione um tamanho</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => { setAddingSize(false); setTamanhoSel(''); setSizeErr(false) }}
                  style={{ flex: 1, padding: '8px', background: '#f0f0f0', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#666' }}>
                  Cancelar
                </button>
                <button onClick={confirmSize}
                  style={{ flex: 2, padding: '8px', background: 'linear-gradient(135deg,#5FB335,#7BC142)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#1B4D2E' }}>
                  ✓ Adicionar
                </button>
              </div>
            </div>
          )}

          {!addingSize && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: esgotado ? '#bbb' : '#5FB335' }}>
                {fmtR(p.preco || 0)}
              </div>
              <button onClick={handleAdd} disabled={esgotado}
                style={{
                  background: esgotado ? '#e0e0e0' : 'linear-gradient(135deg,#5FB335,#7BC142)',
                  color: esgotado ? '#999' : '#1B4D2E', border: 'none', borderRadius: 10,
                  padding: '10px 18px', fontWeight: 700, fontSize: '0.88rem',
                  cursor: esgotado ? 'not-allowed' : 'pointer',
                  boxShadow: esgotado ? 'none' : '0 3px 10px rgba(95,179,53,0.3)',
                }}>
                {esgotado ? 'Esgotado' : '🛒 Adicionar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Carrinho Modal ──────────────────────────────────────────────────────────

function CarrinhoModal({ itens, produtos, onClose, onRemove, onQtdChange, onCheckout }) {
  const total = useMemo(() => itens.reduce((s, i) => {
    const p = produtos.find(x => x.id === i.produtoId)
    return s + (p?.preco || 0) * i.qtd
  }, 0), [itens, produtos])

  if (itens.length === 0) {
    return (
      <Modal onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🛒</div>
          <div style={{ color: '#5a7a5a', fontSize: '1rem' }}>Seu carrinho está vazio</div>
          <button onClick={onClose} style={{ marginTop: 20, padding: '10px 28px', background: 'linear-gradient(135deg,#5FB335,#7BC142)', border: 'none', borderRadius: 10, fontWeight: 700, color: '#1B4D2E', cursor: 'pointer' }}>
            Ver Produtos
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose}>
      <h2 style={{ margin: '0 0 20px', color: '#1B4D2E', fontWeight: 800, fontSize: '1.2rem' }}>🛒 Carrinho de Compras</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, maxHeight: 320, overflowY: 'auto' }}>
        {itens.map((item, idx) => {
          const p = produtos.find(x => x.id === item.produtoId)
          if (!p) return null
          return (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#f8faf4', borderRadius: 12, padding: '12px 14px',
              border: '1px solid rgba(95,179,53,0.15)',
            }}>
              {/* Mini imagem */}
              <div style={{ width: 48, height: 48, borderRadius: 8, background: '#e8f0dc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                {p.imagem
                  ? <img src={p.imagem} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display='none'; e.target.parentNode.innerHTML='📦' }} />
                  : <span style={{ fontSize: '1.5rem' }}>{p.emoji || '📦'}</span>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#1B4D2E', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</div>
                {item.tamanho && <div style={{ fontSize: '0.75rem', color: '#5FB335', fontWeight: 700 }}>Tamanho: {item.tamanho}</div>}
                <div style={{ fontSize: '0.82rem', color: '#5a7a5a' }}>{fmtR(p.preco)} × {item.qtd} = <strong style={{ color: '#1B4D2E' }}>{fmtR(p.preco * item.qtd)}</strong></div>
              </div>
              {/* Controles de quantidade */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button onClick={() => onQtdChange(idx, item.qtd - 1)}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #d0dcc8', background: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>
                  −
                </button>
                <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center', color: '#1B4D2E' }}>{item.qtd}</span>
                <button onClick={() => onQtdChange(idx, item.qtd + 1)}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #d0dcc8', background: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>
                  +
                </button>
                <button onClick={() => onRemove(idx)}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#fee2e2', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e05555' }}>
                  ✕
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {/* Total */}
      <div style={{ background: 'linear-gradient(135deg,#1B4D2E,#1a4a2e)', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#7BC142', fontWeight: 600, fontSize: '0.85rem' }}>Total ({itens.length} item{itens.length > 1 ? 's' : ''})</div>
        <div style={{ color: '#C9A656', fontWeight: 900, fontSize: '1.5rem' }}>{fmtR(total)}</div>
      </div>
      <button onClick={onCheckout} style={{
        width: '100%', background: 'linear-gradient(135deg,#5FB335,#7BC142)', color: '#1B4D2E',
        border: 'none', borderRadius: 12, padding: '14px', fontWeight: 800, fontSize: '1rem',
        cursor: 'pointer', boxShadow: '0 4px 14px rgba(95,179,53,0.35)',
      }}>
        ✅ Finalizar Pedido
      </button>
    </Modal>
  )
}

// ── Checkout Modal ──────────────────────────────────────────────────────────

function CheckoutModal({ itens, produtos, onClose, onSuccess }) {
  const { toast } = useToast()
  const [form, setForm] = useState({ nome: '', email: '', tel: '' })
  const [erros, setErros] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [pixInfo, setPixInfo] = useState(null)
  const [concluido, setConcluido] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const total = useMemo(() => itens.reduce((s, i) => {
    const p = produtos.find(x => x.id === i.produtoId)
    return s + (p?.preco || 0) * i.qtd
  }, 0), [itens, produtos])

  const setF = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErros(e => ({ ...e, [k]: '' })) }

  const validar = () => {
    const e = {}
    if (!form.nome.trim()) e.nome = 'Nome obrigatório'
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) e.email = 'E-mail inválido'
    if (form.tel.replace(/\D/g, '').length < 10) e.tel = 'Telefone inválido'
    setErros(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validar()) return
    setSubmitting(true)
    try {
      // Reservar cada item do carrinho sequencialmente
      for (const item of itens) {
        const p = produtos.find(x => x.id === item.produtoId)
        if (!p) continue
        await api.post(`/api/loja/${p.id}/reservar`, {
          nome: form.nome, email: form.email, tel: form.tel,
          qtd: item.qtd, tamanho: item.tamanho || undefined,
        })
      }
      const pix = await api.get(`/api/pix-info?valor=${total}`).catch(() => null)
      setPixInfo(pix)
      setConcluido(true)
      onSuccess()
    } catch (err) {
      toast(err.message || 'Erro ao finalizar pedido', true)
    } finally {
      setSubmitting(false)
    }
  }

  const copiarPix = async () => {
    if (!pixInfo?.copiaECola) return
    try {
      await navigator.clipboard.writeText(pixInfo.copiaECola)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { toast('Não foi possível copiar', true) }
  }

  const inputStyle = (err) => ({
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: `1.5px solid ${err ? '#e05555' : '#d0dcc8'}`,
    fontSize: '0.9rem', outline: 'none', background: '#fff',
    boxSizing: 'border-box', color: '#1a2e1a',
  })
  const labelStyle = { display: 'block', fontWeight: 600, color: '#1B4D2E', marginBottom: 5, fontSize: '0.85rem' }

  if (concluido) {
    return (
      <Modal onClose={onClose}>
        <div style={{ padding: '8px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>✅</div>
            <h2 style={{ color: '#1B4D2E', fontWeight: 800, margin: '0 0 4px' }}>Pedido Confirmado!</h2>
            <p style={{ color: '#5a7a5a', margin: 0, fontSize: '0.9rem' }}>
              {itens.length} item{itens.length > 1 ? 's' : ''} reservado{itens.length > 1 ? 's' : ''}
            </p>
          </div>
          {/* Resumo dos itens */}
          <div style={{ background: '#f8faf4', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
            {itens.map((item, idx) => {
              const p = produtos.find(x => x.id === item.produtoId)
              if (!p) return null
              return (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0', borderBottom: idx < itens.length - 1 ? '1px solid #e8f0e0' : 'none' }}>
                  <span style={{ color: '#1B4D2E', fontWeight: 600 }}>{p.nome}{item.tamanho ? ` (${item.tamanho})` : ''} ×{item.qtd}</span>
                  <span style={{ color: '#5FB335', fontWeight: 700 }}>{fmtR((p.preco || 0) * item.qtd)}</span>
                </div>
              )
            })}
          </div>
          <div style={{ background: 'linear-gradient(135deg,#1B4D2E,#1a4a2e)', borderRadius: 14, padding: '18px', textAlign: 'center', marginBottom: 20, color: '#F4F6EF' }}>
            <div style={{ fontSize: '0.8rem', color: '#7BC142', fontWeight: 600, marginBottom: 3 }}>TOTAL A PAGAR</div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#C9A656' }}>{fmtR(total)}</div>
          </div>
          {pixInfo?.copiaECola && (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '0.82rem', color: '#666', fontWeight: 600, marginBottom: 5 }}>Código Copia e Cola PIX</div>
                <textarea readOnly value={pixInfo.copiaECola} rows={3}
                  style={{ width: '100%', borderRadius: 10, border: '1.5px solid #d0dcc8', padding: '9px 12px', fontSize: '0.75rem', color: '#444', resize: 'none', boxSizing: 'border-box', background: '#fafaf6', marginBottom: 8 }}
                />
                <button onClick={copiarPix} style={{
                  width: '100%', background: copiado ? '#5FB335' : 'linear-gradient(135deg,#5FB335,#7BC142)',
                  color: copiado ? '#fff' : '#1B4D2E', border: 'none', borderRadius: 10, padding: 11, fontWeight: 700, cursor: 'pointer',
                }}>
                  {copiado ? '✅ Copiado!' : '📋 Copiar Código PIX'}
                </button>
              </div>
              {pixInfo.chave && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: '0.82rem', color: '#666', fontWeight: 600, marginBottom: 5 }}>Chave PIX</div>
                  <div style={{ background: '#f0f4e8', borderRadius: 10, padding: '11px 14px', fontWeight: 700, color: '#1B4D2E', fontSize: '0.95rem' }}>
                    {pixInfo.chave}
                  </div>
                  {pixInfo.nome && <div style={{ fontSize: '0.78rem', color: '#5a7a5a', marginTop: 3 }}>Favorecido: <strong>{pixInfo.nome}</strong></div>}
                </div>
              )}
            </>
          )}
          <div style={{ background: '#fffbf0', border: '1px solid #C9A656', borderRadius: 10, padding: '12px 14px', fontSize: '0.8rem', color: '#5a4a00', lineHeight: 1.6, marginBottom: 16 }}>
            Abra seu banco → PIX → Copia e Cola (ou chave) → confirme e guarde o comprovante.
            <br />Seus itens ficam reservados até a confirmação do pagamento pela organização.
          </div>
          <button onClick={onClose} style={{ width: '100%', background: 'transparent', border: '2px solid #d0dcc8', borderRadius: 10, padding: 11, color: '#5a7a5a', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
            Fechar
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: '8px 0' }}>
        <h2 style={{ margin: '0 0 4px', color: '#1B4D2E', fontWeight: 800, fontSize: '1.2rem' }}>📦 Finalizar Pedido</h2>
        <p style={{ margin: '0 0 20px', color: '#5a7a5a', fontSize: '0.85rem' }}>
          {itens.length} item{itens.length > 1 ? 's' : ''} · Total: <strong style={{ color: '#5FB335' }}>{fmtR(total)}</strong>
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Nome completo *</label>
          <input value={form.nome} onChange={e => setF('nome', e.target.value)} placeholder="Seu nome" style={inputStyle(erros.nome)} />
          {erros.nome && <div style={{ color: '#e05555', fontSize: '0.78rem', marginTop: 3 }}>{erros.nome}</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>E-mail *</label>
            <input type="email" value={form.email} onChange={e => setF('email', e.target.value)} placeholder="seu@email.com" style={inputStyle(erros.email)} />
            {erros.email && <div style={{ color: '#e05555', fontSize: '0.78rem', marginTop: 3 }}>{erros.email}</div>}
          </div>
          <div>
            <label style={labelStyle}>Telefone *</label>
            <input value={form.tel} onChange={e => setF('tel', fmtTel(e.target.value))} placeholder="(65) 99999-0000" maxLength={16} style={inputStyle(erros.tel)} />
            {erros.tel && <div style={{ color: '#e05555', fontSize: '0.78rem', marginTop: 3 }}>{erros.tel}</div>}
          </div>
        </div>

        {/* Resumo */}
        <div style={{ background: '#f8faf4', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
          {itens.map((item, idx) => {
            const p = produtos.find(x => x.id === item.produtoId)
            if (!p) return null
            return (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0', borderBottom: idx < itens.length - 1 ? '1px solid #e8f0e0' : 'none' }}>
                <span style={{ color: '#1B4D2E', fontWeight: 600 }}>{p.nome}{item.tamanho ? ` (${item.tamanho})` : ''} ×{item.qtd}</span>
                <span style={{ color: '#5FB335', fontWeight: 700 }}>{fmtR((p.preco || 0) * item.qtd)}</span>
              </div>
            )
          })}
        </div>

        <div style={{ background: 'linear-gradient(135deg,#1B4D2E,#1a4a2e)', borderRadius: 12, padding: '14px 18px', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#7BC142', fontWeight: 600, fontSize: '0.85rem' }}>Total a pagar</div>
          <div style={{ color: '#C9A656', fontWeight: 900, fontSize: '1.5rem' }}>{fmtR(total)}</div>
        </div>

        <button onClick={handleSubmit} disabled={submitting} style={{
          width: '100%', background: submitting ? '#ccc' : 'linear-gradient(135deg,#5FB335,#7BC142)',
          color: submitting ? '#666' : '#1B4D2E', border: 'none', borderRadius: 12, padding: 14,
          fontWeight: 800, fontSize: '1rem', cursor: submitting ? 'wait' : 'pointer',
          boxShadow: submitting ? 'none' : '0 4px 14px rgba(95,179,53,0.35)',
        }}>
          {submitting ? 'Processando…' : '✅ Confirmar Pedido'}
        </button>
      </div>
    </Modal>
  )
}

// ── Main Loja ───────────────────────────────────────────────────────────────

export default function Loja() {
  const { toast } = useToast()
  const [produtos, setProdutos] = useState([])
  const [loading, setLoading] = useState(true)
  // Carrinho: [ { produtoId, qtd, tamanho } ]
  const [carrinho, setCarrinho] = useState([])
  const [showCarrinho, setShowCarrinho] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [filtroCat, setFiltroCat] = useState('todos')

  useEffect(() => {
    api.get('/api/loja')
      .then(d => { setProdutos(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Categorias únicas para filtro
  const cats = useMemo(() => {
    const uniq = [...new Set(produtos.map(p => p.cat).filter(Boolean))]
    return uniq
  }, [produtos])

  const produtosFiltrados = useMemo(() => {
    if (filtroCat === 'todos') return produtos
    return produtos.filter(p => p.cat === filtroCat)
  }, [produtos, filtroCat])

  // Adicionar item ao carrinho
  const addCart = (produto, qtd, tamanho) => {
    // Verificar estoque disponível
    const jaNoCarrinho = carrinho.filter(i => i.produtoId === produto.id && i.tamanho === tamanho).reduce((s, i) => s + i.qtd, 0)
    const disponivel = produto.estoque != null ? produto.estoque : 999
    if (jaNoCarrinho + qtd > disponivel) {
      toast(`Estoque insuficiente. Disponível: ${disponivel - jaNoCarrinho}`, true)
      return
    }
    setCarrinho(prev => {
      const idx = prev.findIndex(i => i.produtoId === produto.id && i.tamanho === tamanho)
      if (idx >= 0) {
        const novo = [...prev]
        novo[idx] = { ...novo[idx], qtd: novo[idx].qtd + qtd }
        return novo
      }
      return [...prev, { produtoId: produto.id, qtd, tamanho }]
    })
    toast(`${produto.nome} adicionado ao carrinho ✓`)
  }

  const removeCart = (idx) => {
    setCarrinho(prev => prev.filter((_, i) => i !== idx))
  }

  const changeQtd = (idx, novaQtd) => {
    if (novaQtd <= 0) { removeCart(idx); return }
    const item = carrinho[idx]
    const produto = produtos.find(p => p.id === item.produtoId)
    const disponivel = produto?.estoque != null ? produto.estoque : 999
    if (novaQtd > disponivel) {
      toast(`Estoque máximo: ${disponivel}`, true)
      return
    }
    setCarrinho(prev => prev.map((i, k) => k === idx ? { ...i, qtd: novaQtd } : i))
  }

  const handleCheckoutSuccess = () => {
    setCarrinho([])
    setShowCheckout(false)
  }

  const totalItens = useMemo(() => carrinho.reduce((s, i) => s + i.qtd, 0), [carrinho])

  const qtdNoCarrinhoPor = (prodId) => carrinho.filter(i => i.produtoId === prodId).reduce((s, i) => s + i.qtd, 0)

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6EF', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#1B4D2E 0%,#1a4a2e 100%)',
        padding: '40px 24px 56px', color: '#F4F6EF',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '8%', right: '3%', fontSize: '6rem', opacity: 0.07, pointerEvents: 'none' }}>🛍️</div>
        <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <Link to="/" style={{ color: '#7BC142', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>← Início</Link>
          <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 900, margin: '12px 0 6px' }}>
            🛍️ Loja do Torneio
          </h1>
          <p style={{ color: '#a0c8a0', margin: 0 }}>Kit Atleta e produtos exclusivos · 4ª Agro Open 2026</p>

          {/* Mini-carrinho no header */}
          {totalItens > 0 && (
            <button onClick={() => setShowCarrinho(true)} style={{
              marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(143,214,74,0.15)', border: '1.5px solid #7BC142',
              color: '#7BC142', borderRadius: 10, padding: '8px 18px',
              fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem',
            }}>
              🛒 {totalItens} item{totalItens > 1 ? 's' : ''} no carrinho
            </button>
          )}
        </div>
        <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%' }} viewBox="0 0 1440 40" preserveAspectRatio="none">
          <path d="M0,40 C480,0 960,40 1440,10 L1440,40 Z" fill="#F4F6EF" />
        </svg>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '8px 24px 80px' }}>

        {/* Filtro por categoria */}
        {!loading && cats.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '20px 0 8px' }}>
            {['todos', ...cats].map(c => (
              <button key={c} onClick={() => setFiltroCat(c)} style={{
                padding: '6px 16px', borderRadius: 999, fontSize: '0.82rem', fontWeight: 700,
                border: filtroCat === c ? 'none' : '1.5px solid #d0dcc8',
                background: filtroCat === c ? 'linear-gradient(135deg,#5FB335,#7BC142)' : '#fff',
                color: filtroCat === c ? '#1B4D2E' : '#5a7a5a',
                cursor: 'pointer', transition: 'all .15s',
              }}>
                {c === 'todos' ? '🛍️ Todos' : c}
              </button>
            ))}
            <span style={{ fontSize: '0.78rem', color: '#9a9a9a', alignSelf: 'center', marginLeft: 4 }}>
              {produtosFiltrados.length} produto{produtosFiltrados.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '64px', color: '#5FB335', fontSize: '2rem' }}>🎾</div>
        ) : produtos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px', color: '#999' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🛍️</div>
            <div>Nenhum produto disponível no momento</div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 24, marginTop: 16,
          }}>
            {produtosFiltrados.map(p => (
              <ProdutoCard
                key={p.id}
                produto={p}
                onAddCart={addCart}
                qtdNoCarrinho={qtdNoCarrinhoPor(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB carrinho fixo */}
      <CartBadge count={totalItens} onClick={() => setShowCarrinho(true)} />

      {/* Modal: Carrinho */}
      {showCarrinho && (
        <CarrinhoModal
          itens={carrinho}
          produtos={produtos}
          onClose={() => setShowCarrinho(false)}
          onRemove={removeCart}
          onQtdChange={changeQtd}
          onCheckout={() => { setShowCarrinho(false); setShowCheckout(true) }}
        />
      )}

      {/* Modal: Checkout */}
      {showCheckout && (
        <CheckoutModal
          itens={carrinho}
          produtos={produtos}
          onClose={() => setShowCheckout(false)}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XGG']

function fmtTel(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim()
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim()
}

const CAT_COLORS = {
  kit:     { bg: 'linear-gradient(135deg, #5FB335, #8FD64A)', text: '#0E2E1C' },
  camiseta: { bg: 'linear-gradient(135deg, #C9A656, #f0d080)', text: '#0E2E1C' },
  acessorio: { bg: 'linear-gradient(135deg, #4a90d9, #74b3f7)', text: '#fff' },
  default: { bg: 'linear-gradient(135deg, #888, #bbb)', text: '#fff' },
}

function catStyle(cat) {
  const key = cat?.toLowerCase()
  return CAT_COLORS[key] || CAT_COLORS.default
}

function hasSize(produto) {
  const c = produto.cat?.toLowerCase() || ''
  return c === 'kit' || c === 'camiseta' || produto.nome?.toLowerCase().includes('camis')
}

export default function Loja() {
  const toast = useToast()
  const navigate = useNavigate()

  const [produtos, setProdutos] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedProduto, setSelectedProduto] = useState(null)
  const [pixInfo, setPixInfo] = useState(null)
  const [etapaModal, setEtapaModal] = useState('form') // 'form' | 'pix'
  const [submitting, setSubmitting] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [formRes, setFormRes] = useState({ nome: '', email: '', tel: '', qtd: 1, tamanho: '' })
  const [erros, setErros] = useState({})

  useEffect(() => {
    api.get('/api/loja')
      .then(d => { setProdutos(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const abrirModal = (produto) => {
    setSelectedProduto(produto)
    setEtapaModal('form')
    setFormRes({ nome: '', email: '', tel: '', qtd: 1, tamanho: '' })
    setErros({})
    setPixInfo(null)
    setCopiado(false)
  }

  const setF = (k, v) => {
    setFormRes(f => ({ ...f, [k]: v }))
    if (erros[k]) setErros(e => ({ ...e, [k]: '' }))
  }

  const validarForm = () => {
    const e = {}
    if (!formRes.nome.trim()) e.nome = 'Nome obrigatório'
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(formRes.email)) e.email = 'E-mail inválido'
    if (formRes.tel.replace(/\D/g, '').length < 10) e.tel = 'Telefone inválido'
    if (formRes.qtd < 1) e.qtd = 'Quantidade inválida'
    if (hasSize(selectedProduto) && !formRes.tamanho) e.tamanho = 'Selecione o tamanho'
    setErros(e)
    return Object.keys(e).length === 0
  }

  const handleReservar = async () => {
    if (!validarForm()) return
    setSubmitting(true)
    try {
      const valorTotal = (selectedProduto.preco || 0) * formRes.qtd
      await api.post(`/api/loja/${selectedProduto.id}/reservar`, {
        nome: formRes.nome,
        email: formRes.email,
        tel: formRes.tel,
        qtd: formRes.qtd,
        tamanho: formRes.tamanho || undefined,
      })
      const pix = await api.get(`/api/pix-info?valor=${valorTotal}`).catch(() => null)
      setPixInfo(pix)
      setEtapaModal('pix')
    } catch (err) {
      toast?.error?.(err.message || 'Erro ao realizar reserva')
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
    } catch {
      toast?.error?.('Não foi possível copiar')
    }
  }

  const inputStyle = (err) => ({
    width: '100%', padding: '11px 14px', borderRadius: '10px',
    border: `1.5px solid ${err ? '#e05555' : '#d0dcc8'}`,
    fontSize: '0.9rem', outline: 'none', background: '#fff',
    boxSizing: 'border-box', color: '#1a2e1a',
  })

  const labelStyle = { display: 'block', fontWeight: 600, color: '#0E2E1C', marginBottom: '5px', fontSize: '0.85rem' }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6EF', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0E2E1C 0%, #1a4a2e 100%)',
        padding: '40px 24px 56px',
        color: '#F4F6EF',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '8%', right: '3%', fontSize: '6rem', opacity: 0.07, pointerEvents: 'none' }}>🛍️</div>
        <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <Link to="/" style={{ color: '#8FD64A', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>← Início</Link>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, margin: '12px 0 6px' }}>
            🛍️ Loja do Torneio
          </h1>
          <p style={{ color: '#a0c8a0', margin: 0 }}>Kit Atleta e produtos exclusivos · 4ª Agro Open 2026</p>
        </div>
        <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%' }} viewBox="0 0 1440 40" preserveAspectRatio="none">
          <path d="M0,40 C480,0 960,40 1440,10 L1440,40 Z" fill="#F4F6EF" />
        </svg>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '8px 24px 60px' }}>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '64px', color: '#5FB335', fontSize: '2rem' }}>🎾</div>
        ) : produtos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px', color: '#999' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛍️</div>
            <div>Nenhum produto disponível no momento</div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '24px',
            marginTop: '20px',
          }}>
            {produtos.map(p => {
              const esgotado = p.estoque != null && p.estoque <= 0
              const cs = catStyle(p.cat)
              const poucasVagas = !esgotado && p.estoque != null && p.estoque <= 5
              return (
                <div key={p.id} style={{
                  background: '#fff',
                  borderRadius: '20px',
                  overflow: 'hidden',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
                  border: esgotado ? '1.5px solid #eee' : '1.5px solid rgba(95,179,53,0.15)',
                  opacity: esgotado ? 0.75 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform .2s, box-shadow .2s',
                }}
                  onMouseEnter={e => !esgotado && (e.currentTarget.style.transform = 'translateY(-4px)', e.currentTarget.style.boxShadow = '0 10px 32px rgba(0,0,0,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = '', e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.07)')}
                >
                  {/* Imagem / placeholder */}
                  <div style={{
                    height: 200,
                    background: esgotado
                      ? 'linear-gradient(135deg, #e0e0e0, #f0f0f0)'
                      : `linear-gradient(135deg, #0E2E1C 0%, #1a4a2e 60%, #2a5a3e 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '5rem',
                    position: 'relative',
                  }}>
                    {p.cat?.toLowerCase() === 'kit' ? '🎽' : p.cat?.toLowerCase() === 'camiseta' ? '👕' : '🎾'}

                    {/* Badges */}
                    <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {esgotado && (
                        <span style={{
                          background: '#e05555', color: '#fff',
                          borderRadius: '999px', padding: '4px 12px', fontSize: '0.72rem', fontWeight: 800,
                        }}>ESGOTADO</span>
                      )}
                      {poucasVagas && (
                        <span style={{
                          background: '#C9A656', color: '#0E2E1C',
                          borderRadius: '999px', padding: '4px 12px', fontSize: '0.72rem', fontWeight: 800,
                        }}>ÚLTIMAS {p.estoque}</span>
                      )}
                    </div>

                    {/* categoria badge */}
                    {p.cat && (
                      <div style={{
                        position: 'absolute', bottom: 10, right: 10,
                        background: cs.bg, color: cs.text,
                        borderRadius: '8px', padding: '3px 10px',
                        fontSize: '0.72rem', fontWeight: 700,
                      }}>
                        {p.cat}
                      </div>
                    )}
                  </div>

                  {/* Conteúdo */}
                  <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 800, color: '#0E2E1C' }}>
                      {p.nome}
                    </h3>
                    {p.descricao && (
                      <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: '#5a7a5a', lineHeight: 1.5, flex: 1 }}>
                        {p.descricao}
                      </p>
                    )}

                    <div style={{ marginTop: 'auto' }}>
                      {p.estoque != null && !esgotado && (
                        <div style={{ fontSize: '0.78rem', color: poucasVagas ? '#C9A656' : '#5a7a5a', marginBottom: '10px', fontWeight: poucasVagas ? 700 : 400 }}>
                          {poucasVagas ? `⚡ Apenas ${p.estoque} unidade${p.estoque > 1 ? 's' : ''} disponível${p.estoque > 1 ? 'is' : ''}` : `✅ ${p.estoque} em estoque`}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: esgotado ? '#bbb' : '#5FB335' }}>
                          {fmtR(p.preco || 0)}
                        </div>
                        <button
                          onClick={() => !esgotado && abrirModal(p)}
                          disabled={esgotado}
                          style={{
                            background: esgotado ? '#e0e0e0' : 'linear-gradient(135deg, #5FB335, #8FD64A)',
                            color: esgotado ? '#999' : '#0E2E1C',
                            border: 'none', borderRadius: '10px',
                            padding: '10px 20px',
                            fontWeight: 700, fontSize: '0.9rem',
                            cursor: esgotado ? 'not-allowed' : 'pointer',
                            boxShadow: esgotado ? 'none' : '0 3px 10px rgba(95,179,53,0.3)',
                            transition: 'all .15s',
                          }}
                        >
                          {esgotado ? 'Esgotado' : '🛒 Reservar'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedProduto && (
        <Modal onClose={() => setSelectedProduto(null)}>
          {etapaModal === 'form' ? (
            <div style={{ padding: '8px 0' }}>
              <h2 style={{ margin: '0 0 4px', color: '#0E2E1C', fontWeight: 800, fontSize: '1.3rem' }}>
                🛒 Reservar Produto
              </h2>
              <p style={{ margin: '0 0 20px', color: '#5a7a5a', fontSize: '0.9rem' }}>
                {selectedProduto.nome} · <strong style={{ color: '#5FB335' }}>{fmtR(selectedProduto.preco || 0)}</strong>
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Nome completo *</label>
                <input value={formRes.nome} onChange={e => setF('nome', e.target.value)} placeholder="Seu nome" style={inputStyle(erros.nome)} />
                {erros.nome && <div style={{ color: '#e05555', fontSize: '0.78rem', marginTop: 3 }}>{erros.nome}</div>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>E-mail *</label>
                  <input type="email" value={formRes.email} onChange={e => setF('email', e.target.value)} placeholder="seu@email.com" style={inputStyle(erros.email)} />
                  {erros.email && <div style={{ color: '#e05555', fontSize: '0.78rem', marginTop: 3 }}>{erros.email}</div>}
                </div>
                <div>
                  <label style={labelStyle}>Telefone *</label>
                  <input value={formRes.tel} onChange={e => setF('tel', fmtTel(e.target.value))} placeholder="(65) 99999-0000" maxLength={16} style={inputStyle(erros.tel)} />
                  {erros.tel && <div style={{ color: '#e05555', fontSize: '0.78rem', marginTop: 3 }}>{erros.tel}</div>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: hasSize(selectedProduto) ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle}>Quantidade *</label>
                  <input
                    type="number" min={1} max={selectedProduto.estoque || 99}
                    value={formRes.qtd}
                    onChange={e => setF('qtd', Math.max(1, parseInt(e.target.value) || 1))}
                    style={inputStyle(erros.qtd)}
                  />
                </div>
                {hasSize(selectedProduto) && (
                  <div>
                    <label style={labelStyle}>Tamanho *</label>
                    <select
                      value={formRes.tamanho}
                      onChange={e => setF('tamanho', e.target.value)}
                      style={{ ...inputStyle(erros.tamanho), cursor: 'pointer' }}
                    >
                      <option value="">Selecione…</option>
                      {TAMANHOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {erros.tamanho && <div style={{ color: '#e05555', fontSize: '0.78rem', marginTop: 3 }}>{erros.tamanho}</div>}
                  </div>
                )}
              </div>

              {/* Total */}
              <div style={{
                background: 'linear-gradient(135deg, #0E2E1C, #1a4a2e)',
                borderRadius: '12px', padding: '14px 18px', marginBottom: '20px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ color: '#8FD64A', fontWeight: 600, fontSize: '0.85rem' }}>Total a pagar</div>
                <div style={{ color: '#C9A656', fontWeight: 900, fontSize: '1.5rem' }}>
                  {fmtR((selectedProduto.preco || 0) * formRes.qtd)}
                </div>
              </div>

              <button
                onClick={handleReservar}
                disabled={submitting}
                style={{
                  width: '100%',
                  background: submitting ? '#ccc' : 'linear-gradient(135deg, #5FB335, #8FD64A)',
                  color: submitting ? '#666' : '#0E2E1C',
                  border: 'none', borderRadius: '12px', padding: '14px',
                  fontWeight: 800, fontSize: '1rem',
                  cursor: submitting ? 'wait' : 'pointer',
                  boxShadow: submitting ? 'none' : '0 4px 14px rgba(95,179,53,0.35)',
                }}
              >
                {submitting ? 'Processando…' : '✅ Confirmar Reserva'}
              </button>
            </div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>✅</div>
                <h2 style={{ color: '#0E2E1C', fontWeight: 800, margin: '0 0 4px' }}>Reserva Confirmada!</h2>
                <p style={{ color: '#5a7a5a', margin: 0, fontSize: '0.9rem' }}>
                  {selectedProduto.nome} × {formRes.qtd}
                  {formRes.tamanho ? ` · Tamanho ${formRes.tamanho}` : ''}
                </p>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #0E2E1C, #1a4a2e)',
                borderRadius: '14px', padding: '18px', textAlign: 'center', marginBottom: '20px', color: '#F4F6EF',
              }}>
                <div style={{ fontSize: '0.8rem', color: '#8FD64A', fontWeight: 600, marginBottom: '3px' }}>VALOR A PAGAR</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#C9A656' }}>
                  {fmtR((selectedProduto.preco || 0) * formRes.qtd)}
                </div>
              </div>

              {pixInfo ? (
                <>
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.82rem', color: '#666', fontWeight: 600, marginBottom: '5px' }}>Chave PIX</div>
                    <div style={{
                      background: '#f0f4e8', borderRadius: '10px', padding: '11px 14px',
                      fontWeight: 700, color: '#0E2E1C', letterSpacing: '0.04em', fontSize: '0.95rem',
                    }}>
                      {pixInfo.chave}
                    </div>
                    {pixInfo.nome && (
                      <div style={{ fontSize: '0.78rem', color: '#5a7a5a', marginTop: '3px' }}>
                        Favorecido: <strong>{pixInfo.nome}</strong>
                      </div>
                    )}
                  </div>

                  {pixInfo.copiaECola && (
                    <>
                      <div style={{ fontSize: '0.82rem', color: '#666', fontWeight: 600, marginBottom: '5px' }}>
                        Código Copia e Cola
                      </div>
                      <textarea
                        readOnly value={pixInfo.copiaECola} rows={3}
                        style={{
                          width: '100%', borderRadius: '10px', border: '1.5px solid #d0dcc8',
                          padding: '9px 12px', fontSize: '0.75rem', color: '#444',
                          resize: 'none', boxSizing: 'border-box', background: '#fafaf6',
                          marginBottom: '8px',
                        }}
                      />
                      <button
                        onClick={copiarPix}
                        style={{
                          width: '100%',
                          background: copiado ? '#5FB335' : 'linear-gradient(135deg, #5FB335, #8FD64A)',
                          color: copiado ? '#fff' : '#0E2E1C',
                          border: 'none', borderRadius: '10px', padding: '11px',
                          fontWeight: 700, cursor: 'pointer', marginBottom: '14px',
                        }}
                      >
                        {copiado ? '✅ Copiado!' : '📋 Copiar Código PIX'}
                      </button>
                    </>
                  )}

                  <div style={{
                    background: '#fffbf0', border: '1px solid #C9A656', borderRadius: '10px',
                    padding: '12px 14px', fontSize: '0.8rem', color: '#5a4a00', lineHeight: 1.6,
                  }}>
                    Abra seu banco → PIX → Copia e Cola (ou chave CNPJ) → confirme e guarde o comprovante.
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: '#888', padding: '20px' }}>
                  PIX temporariamente indisponível. Entre em contato com a organização.
                </div>
              )}

              <button
                onClick={() => setSelectedProduto(null)}
                style={{
                  width: '100%', marginTop: '16px',
                  background: 'transparent', border: '2px solid #d0dcc8',
                  borderRadius: '10px', padding: '11px',
                  color: '#5a7a5a', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
                }}
              >
                Fechar
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

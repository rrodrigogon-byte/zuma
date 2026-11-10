import { useState, useEffect, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import { useSEO, buildProductJsonLd } from '../../hooks/useSEO'

const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XGG']

function hasSize(produto) {
  const c = produto.cat?.toLowerCase() || ''
  return c === 'kit' || c === 'camiseta' || produto.nome?.toLowerCase().includes('camis')
}

/** Gera slug a partir do nome do produto: "Camiseta Oficial Agro Open" → "camiseta-oficial-agro-open" */
export function slugify(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Encontra produto pelo slug ou pelo id */
function findProduto(lista, slugOuId) {
  return lista.find(p => slugify(p.nome) === slugOuId || String(p.id) === slugOuId || (p.cod && slugify(p.cod) === slugOuId))
}

export default function ProdutoDetalhe() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [produtos, setProdutos] = useState([])
  const [loading, setLoading] = useState(true)
  const [tamanhoSel, setTamanhoSel] = useState('')
  const [sizeErr, setSizeErr] = useState(false)
  const [qtd, setQtd] = useState(1)
  const [adicionado, setAdicionado] = useState(false)

  useEffect(() => {
    api.get('/api/loja')
      .then(d => { setProdutos(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const produto = useMemo(() => findProduto(produtos, slug), [produtos, slug])

  useEffect(() => {
    if (!loading && !produto && slug) {
      const alias = slug.toLowerCase();
      if (["stallone", "dino", "supermercado", "agro", "agro_open"].includes(alias)) {
        navigate("/ecommerce/" + alias, { replace: true });
      }
    }
  }, [loading, produto, slug, navigate]);

  // SEO dinâmico com Schema.org Product
  const jsonLd = useMemo(() => produto ? buildProductJsonLd(produto, window.location.href) : null, [produto])
  useSEO({
    title: produto ? `${produto.nome} | Loja Agro Open TTC` : 'Produto | Loja Agro Open TTC',
    description: produto
      ? `${produto.descricao || produto.desc || produto.nome} — Compre agora na Loja Oficial da 4ª Agro Open 2026 em Tangará da Serra – MT.`
      : 'Produto exclusivo da Agro Open TTC 2026.',
    canonical: window.location.origin + '/loja/' + slug,
    image: produto?.imagem,
    type: 'product',
    jsonLd,
    jsonLdId: 'ld-produto',
  })

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F4F6EF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⏳</div>
        <div style={{ color: '#5a7a5a', fontWeight: 600 }}>Carregando produto…</div>
      </div>
    </div>
  )

  if (!produto) return (
    <div style={{ minHeight: '100vh', background: '#F4F6EF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔍</div>
        <h1 style={{ color: '#1B4D2E', marginBottom: 8 }}>Produto não encontrado</h1>
        <p style={{ color: '#5a7a5a', marginBottom: 24 }}>O produto que você procura não existe ou foi removido.</p>
        <Link to="/loja" style={{ padding: '10px 24px', background: 'linear-gradient(135deg,#5FB335,#7BC142)', color: '#1B4D2E', borderRadius: 12, fontWeight: 700, textDecoration: 'none' }}>
          ← Voltar à loja
        </Link>
      </div>
    </div>
  )

  const esgotado = produto.estoque != null && produto.estoque <= 0
  const poucasVagas = !esgotado && produto.estoque != null && produto.estoque <= 5
  const needsSize = hasSize(produto)

  // Produtos relacionados (mesma categoria, excluindo o atual)
  const relacionados = produtos.filter(p => p.cat === produto.cat && p.id !== produto.id).slice(0, 4)

  const handleComprar = () => {
    if (esgotado) return
    if (needsSize && !tamanhoSel) { setSizeErr(true); return }

    // Usar localStorage como carrinho compartilhado entre páginas
    const carrinho = JSON.parse(localStorage.getItem('sp_cart') || '[]')
    const jaNoCarrinho = carrinho.filter(i => i.produtoId === produto.id && i.tamanho === (tamanhoSel || '')).reduce((s, i) => s + i.qtd, 0)
    const disponivel = produto.estoque != null ? produto.estoque : 999
    if (jaNoCarrinho + qtd > disponivel) {
      toast(`Estoque insuficiente. Disponível: ${disponivel - jaNoCarrinho}`, true)
      return
    }
    const idx = carrinho.findIndex(i => i.produtoId === produto.id && i.tamanho === (tamanhoSel || ''))
    if (idx >= 0) carrinho[idx].qtd += qtd
    else carrinho.push({ produtoId: produto.id, qtd, tamanho: tamanhoSel || '' })
    localStorage.setItem('sp_cart', JSON.stringify(carrinho))
    setAdicionado(true)
    toast(`✅ ${produto.nome} adicionado ao carrinho!`)
    setTimeout(() => setAdicionado(false), 2500)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6EF', fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#1B4D2E 0%,#1a4a2e 100%)', padding: '28px 24px 18px', color: '#F4F6EF' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {/* Breadcrumb */}
          <nav style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.82rem', flexWrap: 'wrap' }} aria-label="Breadcrumb">
            <Link to="/" style={{ color: '#7BC142', textDecoration: 'none', fontWeight: 700 }}>Agro Open</Link>
            <span style={{ color: 'rgba(200,224,184,.45)' }}>›</span>
            <Link to="/loja" style={{ color: '#7BC142', textDecoration: 'none', fontWeight: 700 }}>Loja</Link>
            <span style={{ color: 'rgba(200,224,184,.45)' }}>›</span>
            <span style={{ color: 'rgba(200,224,184,.8)' }}>{produto.cat}</span>
            <span style={{ color: 'rgba(200,224,184,.45)' }}>›</span>
            <span style={{ color: '#F4F6EF', fontWeight: 600 }}>{produto.nome}</span>
          </nav>
        </div>
        <svg style={{ display: 'block', marginTop: 18, width: '100%' }} viewBox="0 0 1440 24" preserveAspectRatio="none">
          <path d="M0,24 C480,0 960,24 1440,8 L1440,24 Z" fill="#F4F6EF" />
        </svg>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '8px 24px 80px' }}>
        {/* Layout principal: imagem + detalhes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,1fr) 1fr', gap: 40, alignItems: 'start', marginTop: 8 }}>

          {/* Imagem */}
          <div style={{
            background: produto.imagem ? '#fff' : esgotado
              ? 'linear-gradient(135deg,#e0e0e0,#f0f0f0)'
              : 'linear-gradient(135deg,#1B4D2E 0%,#1a4a2e 60%,#2a5a3e 100%)',
            borderRadius: 20, overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            {produto.imagem ? (
              <img
                src={produto.imagem} alt={produto.nome}
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 24, filter: esgotado ? 'grayscale(60%) opacity(0.7)' : 'none' }}
                onError={e => { e.target.style.display = 'none'; e.target.parentNode.querySelector('.fb').style.display = 'flex' }}
              />
            ) : null}
            <div className="fb" style={{ display: produto.imagem ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7rem' }}>
              {produto.emoji || '📦'}
            </div>
            {/* Badges */}
            {esgotado && (
              <div style={{ position: 'absolute', top: 16, left: 16, background: '#e05555', color: '#fff', borderRadius: 999, padding: '6px 16px', fontSize: '0.82rem', fontWeight: 800 }}>ESGOTADO</div>
            )}
            {poucasVagas && (
              <div style={{ position: 'absolute', top: 16, left: 16, background: '#C9A656', color: '#1B4D2E', borderRadius: 999, padding: '6px 16px', fontSize: '0.82rem', fontWeight: 800 }}>ÚLTIMAS {produto.estoque} UNIDADES</div>
            )}
            {produto.cod && (
              <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(14,46,28,.85)', color: '#7BC142', borderRadius: 8, padding: '4px 12px', fontSize: '0.76rem', fontWeight: 800 }}>
                {produto.cod}
              </div>
            )}
          </div>

          {/* Detalhes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Categoria */}
            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <span style={{ background: 'rgba(95,179,53,0.12)', color: '#3a7a1a', borderRadius: 999, padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {produto.cat}
              </span>
            </div>

            {/* Nome */}
            <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 900, color: '#1B4D2E', lineHeight: 1.2 }}>
              {produto.nome}
            </h1>

            {/* Preço */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 900, color: esgotado ? '#bbb' : '#5FB335' }}>
                {fmtR(produto.preco || 0)}
              </span>
              <span style={{ fontSize: '0.82rem', color: '#9a9a9a' }}>à vista via Pix</span>
            </div>

            {/* Estoque */}
            {!esgotado && produto.estoque != null && (
              <div style={{ fontSize: '0.85rem', color: poucasVagas ? '#C9A656' : '#5a7a5a', fontWeight: poucasVagas ? 700 : 400 }}>
                {poucasVagas ? `⚡ Apenas ${produto.estoque} unidade${produto.estoque > 1 ? 's' : ''} disponível${produto.estoque > 1 ? 'is' : ''}` : `✅ ${produto.estoque} em estoque`}
              </div>
            )}

            {/* Descrição */}
            {(produto.descricao || produto.desc) && (
              <div style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', border: '1.5px solid #e8f0e0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1B4D2E', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Descrição</div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#444', lineHeight: 1.7 }}>{produto.descricao || produto.desc}</p>
              </div>
            )}

            {/* Seletor de tamanho */}
            {needsSize && !esgotado && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1B4D2E', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Tamanho {tamanhoSel && <span style={{ color: '#5FB335' }}>— {tamanhoSel}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TAMANHOS.map(t => (
                    <button key={t} onClick={() => { setTamanhoSel(t); setSizeErr(false) }}
                      style={{
                        padding: '8px 16px', borderRadius: 10, fontSize: '0.88rem', fontWeight: 700,
                        border: tamanhoSel === t ? '2px solid #5FB335' : '1.5px solid #d0dcc8',
                        background: tamanhoSel === t ? '#5FB335' : '#fff',
                        color: tamanhoSel === t ? '#1B4D2E' : '#333',
                        cursor: 'pointer', transition: 'all .1s',
                      }}
                    >{t}</button>
                  ))}
                </div>
                {sizeErr && <div style={{ color: '#e05555', fontSize: '0.78rem', marginTop: 6 }}>⚠ Selecione um tamanho para continuar</div>}
              </div>
            )}

            {/* Quantidade */}
            {!esgotado && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1B4D2E', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Qtd</div>
                <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #d0dcc8', borderRadius: 10, overflow: 'hidden' }}>
                  <button onClick={() => setQtd(v => Math.max(1, v - 1))}
                    style={{ padding: '8px 14px', background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#5a7a5a', fontWeight: 700 }}>−</button>
                  <span style={{ padding: '8px 16px', fontWeight: 700, fontSize: '1rem', color: '#1B4D2E', minWidth: 40, textAlign: 'center' }}>{qtd}</span>
                  <button onClick={() => setQtd(v => Math.min(produto.estoque != null ? produto.estoque : 99, v + 1))}
                    style={{ padding: '8px 14px', background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#5a7a5a', fontWeight: 700 }}>+</button>
                </div>
              </div>
            )}

            {/* Botão comprar */}
            <button
              onClick={handleComprar}
              disabled={esgotado}
              style={{
                padding: '14px 28px', borderRadius: 14, fontSize: '1rem', fontWeight: 800,
                background: esgotado ? '#e0e0e0' : adicionado ? '#3a8a1a' : 'linear-gradient(135deg,#5FB335,#7BC142)',
                color: esgotado ? '#999' : '#1B4D2E',
                border: 'none', cursor: esgotado ? 'not-allowed' : 'pointer',
                boxShadow: esgotado ? 'none' : '0 4px 16px rgba(95,179,53,0.35)',
                transition: 'all .2s', width: '100%',
              }}
            >
              {esgotado ? '😔 Produto Esgotado' : adicionado ? '✅ Adicionado ao carrinho!' : `🛒 Adicionar ao carrinho — ${fmtR((produto.preco || 0) * qtd)}`}
            </button>

            {/* Link volta */}
            <Link to="/loja" style={{ textAlign: 'center', color: '#5a7a5a', fontSize: '0.85rem', textDecoration: 'none', display: 'block' }}>
              ← Ver todos os produtos
            </Link>

            {/* Info Pix */}
            <div style={{ background: 'rgba(95,179,53,0.08)', border: '1.5px solid rgba(95,179,53,0.2)', borderRadius: 12, padding: '12px 16px', fontSize: '0.8rem', color: '#3a7a1a' }}>
              <strong>💡 Como funciona:</strong> Reserve aqui, pague com Pix e retire no balcão oficial do Tangará Tênis Clube durante o evento (07–13 Set 2026).
            </div>
          </div>
        </div>

        {/* Produtos relacionados */}
        {relacionados.length > 0 && (
          <div style={{ marginTop: 56 }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#1B4D2E', marginBottom: 20 }}>
              Outros produtos em <span style={{ color: '#5FB335' }}>{produto.cat}</span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
              {relacionados.map(p => {
                const esg = p.estoque != null && p.estoque <= 0
                return (
                  <Link key={p.id} to={`/loja/${slugify(p.nome)}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: '#fff', borderRadius: 16, overflow: 'hidden',
                      boxShadow: '0 3px 12px rgba(0,0,0,0.06)',
                      border: '1.5px solid rgba(95,179,53,0.1)',
                      transition: 'transform .15s, box-shadow .15s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 3px 12px rgba(0,0,0,0.06)' }}
                    >
                      <div style={{
                        height: 140, background: p.imagem ? '#fff' : 'linear-gradient(135deg,#1B4D2E,#1a4a2e)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem',
                        filter: esg ? 'grayscale(50%) opacity(0.7)' : 'none',
                      }}>
                        {p.imagem
                          ? <img src={p.imagem} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 12 }} />
                          : p.emoji || '📦'}
                      </div>
                      <div style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1B4D2E', marginBottom: 4, lineHeight: 1.3 }}>{p.nome}</div>
                        <div style={{ fontWeight: 900, color: esg ? '#bbb' : '#5FB335', fontSize: '1rem' }}>{fmtR(p.preco || 0)}</div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

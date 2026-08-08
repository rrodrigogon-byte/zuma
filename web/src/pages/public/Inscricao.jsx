import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

function fmtCPF(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function fmtTel(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim()
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim()
}

function validarCPF(cpf) {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  let s = 0
  for (let i = 0; i < 9; i++) s += +d[i] * (10 - i)
  let r = (s * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== +d[9]) return false
  s = 0
  for (let i = 0; i < 10; i++) s += +d[i] * (11 - i)
  r = (s * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === +d[10]
}

const FIELD = (label, children, error) => (
  <div style={{ marginBottom: '20px' }}>
    <label style={{ display: 'block', fontWeight: 600, color: '#12283F', marginBottom: '6px', fontSize: '0.9rem' }}>
      {label}
    </label>
    {children}
    {error && <div style={{ color: '#e05555', fontSize: '0.8rem', marginTop: '4px' }}>{error}</div>}
  </div>
)

const INPUT_STYLE = (err) => ({
  width: '100%',
  padding: '12px 14px',
  borderRadius: '10px',
  border: `1.5px solid ${err ? '#e05555' : '#d0dcc8'}`,
  fontSize: '0.95rem',
  outline: 'none',
  background: '#fff',
  boxSizing: 'border-box',
  transition: 'border-color .15s',
  color: '#1a2e1a',
})

export default function Inscricao() {
  const { toast } = useToast()
  const navigate = useNavigate()

  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [pixInfo, setPixInfo] = useState(null)
  const [etapa, setEtapa] = useState('form') // 'form' | 'pix'
  const [copiado, setCopiado] = useState(false)

  const [form, setForm] = useState({ nome: '', cpf: '', email: '', tel: '', nasc: '', categorias: [] })
  const [erros, setErros] = useState({})
  const [lgpdOk, setLgpdOk] = useState(false)

  useEffect(() => {
    api.get('/api/categorias')
      .then(d => { setCategorias(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { setCategorias([]); setLoading(false) })
  }, [])

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }))
    if (erros[field]) setErros(e => ({ ...e, [field]: '' }))
  }

  const toggleCat = (id) => {
    setForm(f => {
      const cats = f.categorias.includes(id)
        ? f.categorias.filter(c => c !== id)
        : [...f.categorias, id]
      return { ...f, categorias: cats }
    })
    if (erros.categorias) setErros(e => ({ ...e, categorias: '' }))
  }

  const totalSelecionado = categorias
    .filter(c => form.categorias.includes(c.id))
    .reduce((s, c) => s + (c.preco || 0), 0)

  const validar = () => {
    const e = {}
    if (!form.nome.trim()) e.nome = 'Nome obrigatório'
    if (!validarCPF(form.cpf)) e.cpf = 'CPF inválido'
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) e.email = 'E-mail inválido'
    if (form.tel.replace(/\D/g, '').length < 10) e.tel = 'Telefone inválido'
    if (!form.nasc) e.nasc = 'Data de nascimento obrigatória'
    if (form.categorias.length === 0) e.categorias = 'Selecione ao menos uma categoria'
    if (!lgpdOk) e.lgpd = 'Aceite os termos para continuar'
    setErros(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validar()) return
    setSubmitting(true)
    try {
      await api.post('/api/inscricoes', {
        nome: form.nome,
        cpf: form.cpf.replace(/\D/g, ''),
        email: form.email,
        tel: form.tel,
        nasc: form.nasc,
        categorias: form.categorias,
        pagamento: 'pix',
      })
      const pix = await api.get(`/api/pix-info?valor=${totalSelecionado}`).catch(() => null)
      setPixInfo(pix)
      setEtapa('pix')
    } catch (err) {
      toast(err.message || 'Erro ao realizar inscrição', true)
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
      toast('Não foi possível copiar', true)
    }
  }

  if (etapa === 'pix') {
    return (
      <div style={{ minHeight: '100vh', background: '#FFF4EC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: '#fff', borderRadius: '24px', padding: '40px 36px', maxWidth: '500px', width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.1)' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✅</div>
            <h2 style={{ color: '#12283F', fontWeight: 800, fontSize: '1.5rem', margin: '0 0 6px' }}>
              Inscrição Realizada!
            </h2>
            <p style={{ color: '#5A6570', margin: 0 }}>Agora finalize seu pagamento via PIX</p>
          </div>

          {/* Total */}
          <div style={{
            background: 'linear-gradient(135deg, #12283F, #183450)',
            borderRadius: '16px', padding: '20px', textAlign: 'center', marginBottom: '24px', color: '#FFF4EC',
          }}>
            <div style={{ fontSize: '0.85rem', color: '#FF9B72', fontWeight: 600, marginBottom: '4px' }}>VALOR A PAGAR</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#FF6B2C' }}>
              {fmtR(totalSelecionado)}
            </div>
          </div>

          {pixInfo ? (
            <>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.85rem', color: '#666', fontWeight: 600, marginBottom: '6px' }}>
                  Chave PIX (CNPJ)
                </div>
                <div style={{
                  background: '#f0f4e8', borderRadius: '10px', padding: '12px 16px',
                  fontWeight: 700, color: '#12283F', fontSize: '1.05rem', letterSpacing: '0.05em',
                }}>
                  {pixInfo.chave}
                </div>
                {pixInfo.nome && (
                  <div style={{ fontSize: '0.8rem', color: '#5A6570', marginTop: '4px' }}>
                    Favorecido: <strong>{pixInfo.nome}</strong>
                  </div>
                )}
              </div>

              {pixInfo.copiaECola && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', fontWeight: 600, marginBottom: '6px' }}>
                    Código Copia e Cola
                  </div>
                  <textarea
                    readOnly
                    value={pixInfo.copiaECola}
                    rows={4}
                    style={{
                      width: '100%', borderRadius: '10px', border: '1.5px solid #d0dcc8',
                      padding: '10px 12px', fontSize: '0.78rem', color: '#444',
                      resize: 'none', boxSizing: 'border-box', background: '#fafaf6',
                    }}
                  />
                  <button
                    onClick={copiarPix}
                    style={{
                      width: '100%', marginTop: '8px',
                      background: copiado ? '#FF6B2C' : 'linear-gradient(135deg, #FF6B2C, #FF9B72)',
                      color: copiado ? '#fff' : '#12283F',
                      border: 'none', borderRadius: '10px', padding: '12px',
                      fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem',
                      transition: 'all .2s',
                    }}
                  >
                    {copiado ? '✅ Copiado!' : '📋 Copiar Código PIX'}
                  </button>
                </div>
              )}

              <div style={{
                background: '#fffbf0', border: '1px solid #FF6B2C', borderRadius: '12px',
                padding: '14px 16px', fontSize: '0.83rem', color: '#5a4a00', lineHeight: 1.6,
              }}>
                <strong>📌 Instruções:</strong>
                <ol style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
                  <li>Abra o app do seu banco</li>
                  <li>Acesse a opção <strong>PIX → Copia e Cola</strong> ou use a <strong>chave CNPJ</strong></li>
                  <li>Cole o código e confirme o pagamento</li>
                  <li>Guarde o comprovante</li>
                </ol>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#888', padding: '24px' }}>
              PIX temporariamente indisponível. Entre em contato com a organização.
            </div>
          )}

          {/* ── Banner próximo passo ── */}
          <div style={{
            background: 'linear-gradient(135deg, #12283F22, #FF6B2C11)',
            border: '1.5px solid #FF6B2C55',
            borderRadius: '14px', padding: '18px 20px', marginTop: '20px',
          }}>
            <div style={{ fontWeight: 700, color: '#12283F', fontSize: '0.95rem', marginBottom: '8px' }}>
              🏆 Próximos passos
            </div>
            <ol style={{ margin: 0, paddingLeft: '18px', color: '#3a5a3a', lineHeight: 1.8, fontSize: '0.88rem' }}>
              <li>Envie o comprovante PIX para o WhatsApp da organização</li>
              <li>Aguarde a <strong>confirmação por e-mail</strong> em até 24 h</li>
              <li>Acompanhe as <strong>chaves do torneio</strong> pela página abaixo</li>
            </ol>
            <Link
              to="/chaves"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginTop: '14px', padding: '11px 16px',
                background: 'linear-gradient(135deg, #FF6B2C, #FF9B72)',
                color: '#12283F', borderRadius: '10px',
                fontWeight: 700, fontSize: '0.92rem', textDecoration: 'none',
                boxShadow: '0 2px 8px #FF6B2C40',
              }}
            >
              🏆 Ver Chaves do Torneio
            </Link>
          </div>

          <button
            onClick={() => navigate('/')}
            style={{
              width: '100%', marginTop: '12px',
              background: 'transparent', border: '2px solid #d0dcc8',
              borderRadius: '10px', padding: '12px',
              color: '#5A6570', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
            }}
          >
            ← Voltar ao início
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFF4EC' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #12283F, #183450)',
        padding: '32px 24px 40px',
        color: '#FFF4EC',
        position: 'relative',
      }}>
        <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
          <Link to="/" style={{ color: '#FF9B72', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
            ← Voltar
          </Link>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: '12px 0 4px' }}>Inscrição</h1>
          <p style={{ color: '#a0c8a0', margin: 0 }}>4ª Agro Open de Tênis · 07–13 Set 2026</p>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '-20px auto 40px', padding: '0 24px' }}>
        <form onSubmit={handleSubmit} style={{
          background: '#fff', borderRadius: '20px',
          padding: '36px 32px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
        }}>

          {/* Dados pessoais */}
          <h3 style={{ color: '#12283F', fontWeight: 800, margin: '0 0 24px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: 'linear-gradient(135deg,#FF6B2C,#FF9B72)', color: '#12283F', borderRadius: '8px', padding: '2px 10px', fontSize: '0.8rem' }}>1</span>
            Dados Pessoais
          </h3>

          {FIELD('Nome completo *', (
            <input
              value={form.nome}
              onChange={e => set('nome', e.target.value)}
              placeholder="Seu nome completo"
              style={INPUT_STYLE(erros.nome)}
              onFocus={e => !erros.nome && (e.target.style.borderColor = '#FF6B2C')}
              onBlur={e => !erros.nome && (e.target.style.borderColor = '#d0dcc8')}
            />
          ), erros.nome)}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {FIELD('CPF *', (
              <input
                value={form.cpf}
                onChange={e => set('cpf', fmtCPF(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                style={INPUT_STYLE(erros.cpf)}
                onFocus={e => !erros.cpf && (e.target.style.borderColor = '#FF6B2C')}
                onBlur={e => !erros.cpf && (e.target.style.borderColor = '#d0dcc8')}
              />
            ), erros.cpf)}
            {FIELD('Data de Nascimento *', (
              <input
                type="date"
                value={form.nasc}
                onChange={e => set('nasc', e.target.value)}
                style={INPUT_STYLE(erros.nasc)}
                onFocus={e => !erros.nasc && (e.target.style.borderColor = '#FF6B2C')}
                onBlur={e => !erros.nasc && (e.target.style.borderColor = '#d0dcc8')}
              />
            ), erros.nasc)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {FIELD('E-mail *', (
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="seu@email.com"
                style={INPUT_STYLE(erros.email)}
                onFocus={e => !erros.email && (e.target.style.borderColor = '#FF6B2C')}
                onBlur={e => !erros.email && (e.target.style.borderColor = '#d0dcc8')}
              />
            ), erros.email)}
            {FIELD('Telefone / WhatsApp *', (
              <input
                value={form.tel}
                onChange={e => set('tel', fmtTel(e.target.value))}
                placeholder="(65) 99999-9999"
                maxLength={16}
                style={INPUT_STYLE(erros.tel)}
                onFocus={e => !erros.tel && (e.target.style.borderColor = '#FF6B2C')}
                onBlur={e => !erros.tel && (e.target.style.borderColor = '#d0dcc8')}
              />
            ), erros.tel)}
          </div>

          {/* Categorias */}
          <h3 style={{ color: '#12283F', fontWeight: 800, margin: '12px 0 20px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: 'linear-gradient(135deg,#FF6B2C,#FF9B72)', color: '#12283F', borderRadius: '8px', padding: '2px 10px', fontSize: '0.8rem' }}>2</span>
            Categorias
          </h3>

          {erros.categorias && (
            <div style={{ color: '#e05555', fontSize: '0.85rem', marginBottom: '12px' }}>{erros.categorias}</div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', color: '#FF6B2C', padding: '20px' }}>Carregando categorias…</div>
          ) : categorias.length === 0 ? (
            <div style={{ color: '#888', padding: '12px', textAlign: 'center' }}>Nenhuma categoria disponível</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {categorias.map(cat => {
                const sel = form.categorias.includes(cat.id)
                const esgotado = cat.vagasRestantes != null && cat.vagasRestantes <= 0
                return (
                  <label key={cat.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: `1.5px solid ${sel ? '#FF6B2C' : esgotado ? '#e0e0e0' : '#d0dcc8'}`,
                    background: sel ? '#f0fae8' : esgotado ? '#fafafa' : '#fafcf8',
                    cursor: esgotado ? 'not-allowed' : 'pointer',
                    opacity: esgotado ? 0.6 : 1,
                    transition: 'all .15s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="checkbox"
                        checked={sel}
                        disabled={esgotado}
                        onChange={() => !esgotado && toggleCat(cat.id)}
                        style={{ width: 18, height: 18, accentColor: '#FF6B2C' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, color: '#12283F', fontSize: '0.95rem' }}>{cat.nome}</div>
                        {cat.vagasRestantes != null && (
                          <div style={{ fontSize: '0.78rem', color: esgotado ? '#e05555' : '#5A6570', marginTop: '2px' }}>
                            {esgotado ? '❌ Esgotado' : `✅ ${cat.vagasRestantes} vagas restantes`}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, color: '#FF6B2C', fontSize: '1rem' }}>
                      {fmtR(cat.preco || 0)}
                    </div>
                  </label>
                )
              })}
            </div>
          )}

          {/* Resumo */}
          {form.categorias.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #12283F, #183450)',
              borderRadius: '14px', padding: '20px', marginTop: '20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ color: '#FF9B72', fontWeight: 600, fontSize: '0.85rem' }}>TOTAL</div>
                <div style={{ color: '#a0c8a0', fontSize: '0.8rem', marginTop: '2px' }}>
                  {form.categorias.length} categoria{form.categorias.length > 1 ? 's' : ''} selecionada{form.categorias.length > 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ color: '#FF6B2C', fontWeight: 900, fontSize: '1.8rem' }}>
                {fmtR(totalSelecionado)}
              </div>
            </div>
          )}

          {/* ── LGPD / Consentimento ── */}
          <div style={{
            marginTop: '24px',
            background: '#f8faf4', border: `1.5px solid ${erros.lgpd ? '#e05555' : '#d0e8c8'}`,
            borderRadius: '12px', padding: '14px 16px',
          }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={lgpdOk}
                onChange={e => { setLgpdOk(e.target.checked); setErros(err => ({ ...err, lgpd: '' })) }}
                style={{ marginTop: 3, width: 18, height: 18, accentColor: '#FF6B2C', flexShrink: 0, cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.82rem', color: '#3a5a3a', lineHeight: 1.55 }}>
                Estou ciente e concordo que meus dados pessoais (nome, CPF, e-mail e telefone) serão utilizados
                exclusivamente para a realização da inscrição e comunicação sobre o{' '}
                <strong>4ª Agro Open de Tênis 2026</strong>, conforme a{' '}
                <strong>Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018)</strong>.
                Os dados não serão compartilhados com terceiros sem consentimento.
              </span>
            </label>
            {erros.lgpd && (
              <div style={{ color: '#e05555', fontSize: '0.78rem', marginTop: 6, fontWeight: 600 }}>
                ⚠ {erros.lgpd}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', marginTop: '16px',
              background: submitting ? '#ccc' : 'linear-gradient(135deg, #FF6B2C, #FF9B72)',
              color: submitting ? '#666' : '#12283F',
              border: 'none', borderRadius: '12px', padding: '16px',
              fontWeight: 800, fontSize: '1rem', cursor: submitting ? 'wait' : 'pointer',
              boxShadow: submitting ? 'none' : '0 4px 16px rgba(255,107,44,0.35)',
              letterSpacing: '0.04em',
            }}
          >
            {submitting ? 'Processando…' : '🎾 Confirmar Inscrição e Pagar via PIX'}
          </button>
        </form>
      </div>
    </div>
  )
}

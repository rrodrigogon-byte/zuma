import { useState, useEffect, useCallback, useRef } from 'react'
import { api, fmtR } from '../lib/api'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../lib/auth'

// ─── PIX EMV BR Code builder ───────────────────────────────────────────────
function pixField(id, value) {
  const v = String(value)
  const len = String(v.length).padStart(2, '0')
  return `${id}${len}${v}`
}

function crc16(str) {
  let crc = 0xFFFF
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1)
    }
  }
  return ((crc & 0xFFFF).toString(16).toUpperCase()).padStart(4, '0')
}

function buildPixEMV({ chavePix = 'contato@agroopen.com.br', valor, nome = 'Agro Open', cidade = 'CAMPINAS', txid = '***' } = {}) {
  const valorStr = Number(valor).toFixed(2)
  const gui = pixField('00', 'BR.GOV.BCB.PIX') + pixField('01', chavePix)
  const merchantAccountInfo = pixField('26', gui)
  const body =
    pixField('00', '01') +                        // payload format
    merchantAccountInfo +
    pixField('52', '0000') +                       // merchant category code
    pixField('53', '986') +                        // BRL
    (valor ? pixField('54', valorStr) : '') +       // valor
    pixField('58', 'BR') +                         // country
    pixField('59', nome.substring(0, 25)) +        // merchant name
    pixField('60', cidade.substring(0, 15)) +      // city
    pixField('62', pixField('05', txid.substring(0, 25))) + // additional data
    '6304'                                          // CRC placeholder
  const checksum = crc16(body)
  return body + checksum
}

// ─── QR Code SVG puro (matrix de módulos) ──────────────────────────────────
// Implementação simples baseada no padrão de encoding QR versão 3–5 com
// biblioteca inline mínima.  Para produção real use qrcode.react ou similar.
function makeQRMatrix(text) {
  // Usa um iframe + canvas hack via URL data se BarcodeDetector não disponível;
  // aqui geramos via API de terceiro (goqr.me) como fallback seguro e leve.
  // Retornamos null para indicar uso de fallback de imagem.
  return null
}

function PixQRSVG({ emv, size = 220 }) {
  // Usa API pública do goqr.me para gerar imagem — sem dependências
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(emv)}&color=0E2E1C&bgcolor=F4F6EF&margin=6`
  return (
    <img
      src={url}
      width={size}
      height={size}
      alt="QR Code PIX"
      style={{ borderRadius: 10, display: 'block', margin: '0 auto' }}
      onError={e => { e.target.style.display = 'none' }}
    />
  )
}

// ─── Modal PIX dinâmico ─────────────────────────────────────────────────────
function PixQRModal({ valor, comandaId, onClose, onPago, toast }) {
  // Estados da criação do pagamento
  const [iniciando, setIniciando] = useState(true)    // aguardando POST /api/pagar
  const [erroInicio, setErroInicio] = useState(null)  // erro ao criar pagamento
  // Dados retornados pelo backend
  const [pagamentoId, setPagamentoId] = useState(null)
  const [copiaECola, setCopiaECola] = useState('')
  const [qrBase64, setQrBase64] = useState(null)
  const [modo, setModo] = useState('simulado')        // 'mercadopago' | 'simulado'
  // Estado do polling
  const [status, setStatus] = useState('aguardando')  // aguardando | aprovado | erro
  const [tentativas, setTentativas] = useState(0)
  const [copied, setCopied] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const pollRef = useRef(null)

  // Passo 1: criar o registro de pagamento no backend ao abrir o modal
  useEffect(() => {
    let cancelled = false
    async function criarPagamento() {
      try {
        const r = await api.post('/api/pagar', {
          tipo: 'generico',
          valor,
          descricao: `Comanda #${comandaId || 0}`,
        })
        if (cancelled) return
        setPagamentoId(r.pagamentoId)
        setCopiaECola(r.copiaECola || '')
        setQrBase64(r.qrBase64 || null)
        setModo(r.modo || 'simulado')
        setIniciando(false)
      } catch (e) {
        if (cancelled) return
        setErroInicio(e?.message || 'Erro ao gerar PIX')
        setIniciando(false)
      }
    }
    criarPagamento()
    return () => { cancelled = true }
  }, [valor, comandaId])

  // Passo 2: assim que temos o pagamentoId, inicia polling GET /api/pagamento/:id
  useEffect(() => {
    if (!pagamentoId) return
    pollRef.current = setInterval(async () => {
      try {
        const r = await api.get(`/api/pagamento/${pagamentoId}`)
        setTentativas(t => t + 1)
        if (r?.status === 'aprovado') {
          setStatus('aprovado')
          clearInterval(pollRef.current)
          setTimeout(() => onPago?.(), 1500)
        }
      } catch { /* ignora erros transientes */ }
    }, 3000)
    return () => clearInterval(pollRef.current)
  }, [pagamentoId, onPago])

  // Copiar copia-e-cola (retornado pelo backend, não o EMV local)
  function copiar() {
    const texto = copiaECola || buildPixEMV({ valor, txid: `CMD${comandaId || 0}` })
    navigator.clipboard?.writeText(texto).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  // Confirmar simulação (dev/staging apenas — botão visível somente quando modo === 'simulado')
  async function confirmarSimulacao() {
    if (!pagamentoId) return
    setConfirmando(true)
    try {
      await api.post(`/api/pagamento/${pagamentoId}/confirmar`, {})
      setStatus('aprovado')
      clearInterval(pollRef.current)
      setTimeout(() => onPago?.(), 1500)
    } catch (e) {
      toast?.(e?.message || 'Erro ao confirmar', 'error')
    } finally {
      setConfirmando(false)
    }
  }

  // QR a exibir: prioriza base64 do backend (Mercado Pago real), fallback para API externa
  const emvFallback = buildPixEMV({ valor, txid: `CMD${comandaId || 0}` })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#0d1f12', border: '1.5px solid #1e4029', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, textAlign: 'center' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>📲 PIX</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8FD64A', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Carregando criação do pagamento */}
        {iniciando && (
          <div style={{ padding: '32px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14, opacity: 0.65 }}>Gerando PIX...</div>
          </div>
        )}

        {/* Erro ao criar pagamento */}
        {!iniciando && erroInicio && (
          <div style={{ padding: '24px 0' }}>
            <div style={{ fontSize: 36 }}>❌</div>
            <div style={{ fontSize: 14, color: '#e74c3c', marginTop: 10, marginBottom: 16 }}>{erroInicio}</div>
            <button onClick={onClose} style={{ background: '#1e4029', border: '1px solid #5FB335', borderRadius: 8, color: '#8FD64A', padding: '8px 20px', cursor: 'pointer', fontWeight: 700 }}>
              Fechar
            </button>
          </div>
        )}

        {/* Pagamento aprovado */}
        {!iniciando && !erroInicio && status === 'aprovado' && (
          <div style={{ padding: '32px 0' }}>
            <div style={{ fontSize: 52 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#8FD64A', marginTop: 10 }}>Pagamento confirmado!</div>
          </div>
        )}

        {/* QR Code + ações */}
        {!iniciando && !erroInicio && status !== 'aprovado' && (
          <>
            {/* QR: base64 do backend (MP) ou fallback externo */}
            <div style={{ background: '#F4F6EF', borderRadius: 12, padding: 12, marginBottom: 14 }}>
              {qrBase64 ? (
                <img
                  src={`data:image/png;base64,${qrBase64}`}
                  width={200} height={200} alt="QR Code PIX"
                  style={{ borderRadius: 10, display: 'block', margin: '0 auto' }}
                />
              ) : (
                <PixQRSVG emv={emvFallback} size={200} />
              )}
            </div>

            <div style={{ fontSize: 22, fontWeight: 800, color: '#8FD64A', marginBottom: 4 }}>
              {fmtR(valor)}
            </div>
            <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 14 }}>
              {modo === 'mercadopago' ? 'QR dinâmico Mercado Pago' : 'Escaneie o QR code no app do banco'}
            </div>

            {/* Copiar copia-e-cola (do backend) */}
            <button onClick={copiar} style={{ width: '100%', background: '#1e4029', border: '1.5px solid #5FB335', borderRadius: 10, color: '#8FD64A', padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
              {copied ? '✓ Copiado!' : '📋 Copiar código PIX'}
            </button>

            {/* Botão de simulação (dev/staging — só aparece em modo simulado) */}
            {modo === 'simulado' && (
              <button
                onClick={confirmarSimulacao}
                disabled={confirmando}
                style={{ width: '100%', background: '#2d4a10', border: '1.5px solid #8FD64A', borderRadius: 10, color: '#8FD64A', padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 10, opacity: confirmando ? 0.6 : 1 }}>
                {confirmando ? '⏳ Confirmando...' : '✓ Confirmar pagamento (simulação)'}
              </button>
            )}

            {/* Status de polling */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontSize: 12, opacity: 0.55 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#8FD64A', animation: 'pulse-gold 1.4s ease-in-out infinite' }} />
              Aguardando pagamento{tentativas > 0 ? ` (${tentativas}x)` : ''}...
            </div>

            {/* Preview do código (truncado) */}
            {copiaECola && (
              <div style={{ marginTop: 14, fontSize: 10, opacity: 0.35, wordBreak: 'break-all', padding: '8px', background: '#0a1a10', borderRadius: 8, lineHeight: 1.4, maxHeight: 48, overflow: 'hidden' }}>
                {copiaECola.substring(0, 80)}…
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const S = {
  page: { minHeight: '100vh', background: 'var(--bg, #091a0f)', color: '#f4f6ef', fontFamily: 'inherit', paddingBottom: 80 },
  banner: { background: 'linear-gradient(90deg,#1a4a20,#2d6e35)', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  bannerStat: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 },
  bannerLabel: { fontSize: 10, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 0.8 },
  bannerVal: { fontSize: 16, fontWeight: 700, color: '#8FD64A' },
  bannerValSmall: { fontSize: 13, fontWeight: 700 },
  section: { padding: '18px 16px 8px' },
  sectionTitle: { fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#8FD64A', marginBottom: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 10 },
  card: (status) => ({
    background: status === 'ocupada' ? '#132b1b' : status === 'conta' ? '#3a2800' : status === 'livre' ? '#0d1f12' : '#132b1b',
    border: `1.5px solid ${status === 'conta' ? '#C9A656' : status === 'ocupada' ? '#5FB335' : '#1e4029'}`,
    borderRadius: 10, padding: '10px 8px', cursor: 'pointer', textAlign: 'center', position: 'relative',
    transition: 'transform .15s, box-shadow .15s',
    animation: status === 'conta' ? 'pulse-gold 1.4s ease-in-out infinite' : 'none',
  }),
  cardNum: { fontSize: 22, fontWeight: 800, lineHeight: 1 },
  cardType: { fontSize: 10, opacity: 0.55, marginTop: 2 },
  cardTotal: { fontSize: 13, fontWeight: 700, color: '#8FD64A', marginTop: 4 },
  cardFire: { position: 'absolute', top: 4, right: 6, fontSize: 14 },
  virtualList: { display: 'flex', flexDirection: 'column', gap: 8 },
  vcard: { background: '#132b1b', border: '1.5px solid #1e4029', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' },
  vcardLeft: { display: 'flex', flexDirection: 'column' },
  vcardName: { fontWeight: 700, fontSize: 14 },
  vcardSub: { fontSize: 11, opacity: 0.55 },
  vcardTotal: { fontSize: 15, fontWeight: 700, color: '#8FD64A' },
  sheet: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0d1f12', borderTop: '2px solid #1e4029', borderRadius: '18px 18px 0 0', padding: '0 0 env(safe-area-inset-bottom,0)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', zIndex: 100 },
  sheetHeader: { padding: '14px 18px 10px', borderBottom: '1px solid #1e4029', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontWeight: 800, fontSize: 16 },
  sheetClose: { background: 'none', border: 'none', color: '#8FD64A', fontSize: 22, cursor: 'pointer', lineHeight: 1 },
  sheetBody: { overflowY: 'auto', flex: 1, padding: '10px 16px' },
  itemRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #1a3020' },
  itemQty: { minWidth: 26, height: 26, borderRadius: 6, background: '#1e4029', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#8FD64A' },
  itemName: { flex: 1, fontSize: 13 },
  itemPrice: { fontSize: 13, fontWeight: 600, color: '#C9A656' },
  itemStatus: { fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#1e4029', color: '#8FD64A' },
  itemDeleteBtn: { background: 'none', border: 'none', color: '#c0392b', fontSize: 15, cursor: 'pointer', padding: '2px 4px', lineHeight: 1, opacity: 0.8 },
  sheetActions: { padding: '10px 16px 14px', display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #1e4029' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#0d1f12', border: '1.5px solid #1e4029', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380 },
  modalTitle: { fontSize: 17, fontWeight: 800, marginBottom: 16 },
  payBtns: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 },
  payBtn: (active) => ({ padding: '18px 10px', borderRadius: 10, border: `2px solid ${active ? '#5FB335' : '#1e4029'}`, background: active ? '#1a4a20' : '#132b1b', color: '#f4f6ef', cursor: 'pointer', fontSize: 20, textAlign: 'center', transition: 'all .15s' }),
  payBtnLabel: { fontSize: 12, fontWeight: 600, marginTop: 4 },
  catScroll: { display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 0', marginBottom: 10 },
  catBtn: (active) => ({ padding: '5px 14px', borderRadius: 20, border: `1.5px solid ${active ? '#5FB335' : '#1e4029'}`, background: active ? '#1a4a20' : 'transparent', color: active ? '#8FD64A' : '#f4f6ef', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600 }),
  prodGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, overflowY: 'auto', maxHeight: '40vh' },
  prodCard: { background: '#132b1b', border: '1.5px solid #1e4029', borderRadius: 10, padding: '10px 10px 8px', position: 'relative' },
  prodName: { fontSize: 12, fontWeight: 600, marginBottom: 4 },
  prodPrice: { fontSize: 13, color: '#C9A656', fontWeight: 700 },
  addBtn: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 6, background: '#5FB335', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 },
  input: { width: '100%', background: '#132b1b', border: '1.5px solid #1e4029', borderRadius: 8, padding: '9px 12px', color: '#f4f6ef', fontSize: 14, marginBottom: 10, boxSizing: 'border-box' },
  contaBox: { marginBottom: 16 },
  contaRow: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 14 },
  contaTotal: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 17, fontWeight: 800, borderTop: '1px solid #1e4029', marginTop: 6 },
  serviceToggle: { display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0', fontSize: 13, cursor: 'pointer' },
  bottomTabs: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0d1f12', borderTop: '1.5px solid #1e4029', display: 'flex', zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom,0)' },
  tabBtn: (active) => ({ flex: 1, padding: '10px 4px 8px', background: 'none', border: 'none', color: active ? '#8FD64A' : '#f4f6ef', cursor: 'pointer', fontSize: 10, fontWeight: active ? 700 : 400, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, opacity: active ? 1 : 0.55 }),
  tabIcon: { fontSize: 18 },
  vendasList: { display: 'flex', flexDirection: 'column', gap: 8 },
  vendaRow: { background: '#132b1b', border: '1px solid #1e4029', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
}

const PAY_OPTIONS = [
  { key: 'pix', icon: '📲', label: 'Pix' },
  { key: 'cartao', icon: '💳', label: 'Cartão' },
  { key: 'dinheiro', icon: '💵', label: 'Dinheiro' },
  { key: 'carteira', icon: '👛', label: 'Carteira' },
]

const TABS = [
  { key: 'mesas', icon: '🍽', label: 'Mesas' },
  { key: 'vendas', icon: '📊', label: 'Vendas' },
]

// Emoji por categoria/nome do produto (case-insensitive, cobre plurais/variações).
// Antes o mapa usava chaves exatas ('Cerveja') e a categoria real ('Cervejas') caía
// no fallback genérico 🍽 — por isso cervejas apareciam como prato+garfo.
function prodEmoji(p) {
  const s = `${p?.cat || ''} ${p?.nome || ''}`.toLowerCase()
  const has = (...ks) => ks.some(k => s.includes(k))
  if (has('chopp')) return '🍺'
  if (has('cerveja', 'lager', 'pilsen', 'ipa', 'long neck', 'lata 350')) return '🍺'
  if (has('refri', 'coca', 'guaraná', 'guarana', 'soda', 'sprite', 'fanta', 'tônica', 'tonica')) return '🥤'
  if (has('drink', 'caipirinha', 'gin', 'vodka', 'whisky', 'dose', 'coquetel')) return '🍸'
  if (has('vinho', 'espumante', 'taça', 'taca')) return '🍷'
  if (has('suco', 'limonada')) return '🧃'
  if (has('água', 'agua', 'water')) return '💧'
  if (has('café', 'cafe', 'expresso', 'capuccino', 'cappuccino')) return '☕'
  if (has('lanche', 'burger', 'hambúrguer', 'hamburguer', 'sanduí', 'sandui', 'x-')) return '🍔'
  if (has('batata', 'fritas', 'porção', 'porcao', 'petisco', 'isca', 'frango')) return '🍟'
  if (has('espetinho', 'churrasco', 'espeto')) return '🍢'
  if (has('pizza')) return '🍕'
  if (has('sobremesa', 'doce', 'bolo', 'pudim', 'sorvete', 'açaí', 'acai')) return '🍰'
  if (has('bebida')) return '🥤'
  return '🍽'
}

// ── Componente de card de mesa (extraído para evitar parsing issues) ──────────
function MesaCard({ m, onClick }) {
  const tempoAberto = (() => {
    if (m.status === 'livre' || !m.abertaEm) return null
    const mins = Math.floor((Date.now() - new Date(m.abertaEm)) / 60000)
    if (mins < 60) return mins + 'min'
    const hh = Math.floor(mins / 60)
    const mm = mins % 60
    return hh + 'h' + (mm > 0 ? String(mm).padStart(2, '0') : '')
  })()
  const bgStatus = m.status === 'conta' ? '#C9A656' : m.status === 'ocupada' ? '#1e4029' : '#0d1f12'
  const clrStatus = m.status === 'conta' ? '#000' : '#8FD64A'
  const label = m.status === 'livre' ? 'livre' : m.status === 'conta' ? 'conta' : 'ocupada'
  return (
    <div style={{ background: m.status === 'ocupada' ? '#132b1b' : m.status === 'conta' ? '#3a2800' : '#0d1f12', border: '1.5px solid ' + (m.status === 'conta' ? '#C9A656' : m.status === 'ocupada' ? '#5FB335' : '#1e4029'), borderRadius: 10, padding: '10px 8px', cursor: 'pointer', textAlign: 'center', position: 'relative', transition: 'transform .12s, box-shadow .12s', animation: m.status === 'conta' ? 'pulse-gold 1.4s ease-in-out infinite' : 'none' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
      onClick={onClick}>
      {m.aguardandoCozinha && <span style={{ position: 'absolute', top: 4, right: 6, fontSize: 14 }} title="Aguardando cozinha">🔥</span>}
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{m.num}</div>
      <div style={{ fontSize: 10, opacity: 0.55, marginTop: 2 }}>{m.tipo || 'Mesa'}</div>
      {m.status !== 'livre' && <div style={{ fontSize: 13, fontWeight: 700, color: '#8FD64A', marginTop: 4 }}>{fmtR(m.total || 0)}</div>}
      {m.nome && <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>{m.nome}</div>}
      {tempoAberto && <div style={{ fontSize: 9, color: '#C9A656', fontWeight: 700, marginTop: 2 }}>{'⏱ ' + tempoAberto}</div>}
      <div style={{ fontSize: 9, marginTop: 4, padding: '2px 6px', borderRadius: 4, background: bgStatus, color: clrStatus, display: 'inline-block' }}>{label}</div>
    </div>
  )
}

export default function PDV() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [mesas, setMesas] = useState({ fisicas: [], virtuais: [] })
  const [cardapio, setCardapio] = useState([])
  const [comanda, setComanda] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [overlay, setOverlay] = useState(null)
  const [catFiltro, setCatFiltro] = useState('Tudo')
  const [payMeio, setPayMeio] = useState('pix')
  const [servico, setServico] = useState(true)
  const [novaVirtual, setNovaVirtual] = useState({ nome: '', local: '' })
  const [novaMesaNome, setNovaMesaNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('mesas')

  // Busca de mesa
  const [buscaMesa, setBuscaMesa] = useState('')

  // Desconto
  const [descPct, setDescPct] = useState(0)

  // Sangria/Suprimento
  const [caixaMov, setCaixaMov] = useState({ tipo: 'sangria', valor: '', motivo: '' })

  // Item obs modal
  const [itemObs, setItemObs] = useState({ prod: null, obs: '' })

  // Troco
  const [valorRecebido, setValorRecebido] = useState('')

  // Divisão de conta
  const [dividir, setDividir] = useState(1)

  // Múltiplos meios de pagamento
  const [multiPag, setMultiPag] = useState([])
  const [multiPagValor, setMultiPagValor] = useState('')
  const [multiPagMeio, setMultiPagMeio] = useState('pix')
  const totalMultiPag = multiPag.reduce((s, p) => s + p.valor, 0)
  // restanteMultiPag calculado após totalFinal (ver abaixo)

  // PIX QR dinâmico
  const [showPixQR, setShowPixQR] = useState(false)

  // Vendas do dia
  const [vendas, setVendas] = useState([])
  const [vendasLoading, setVendasLoading] = useState(false)

  // Caixa stats
  const [caixaHoje, setCaixaHoje] = useState({ abertura: 0, sangrias: 0, suprimentos: 0, vendas: 0, saldo: 0 })

  // Print ref
  const printRef = useRef(null)
  const timerRef = useRef(null)

  const loadMesas = useCallback(async () => {
    try {
      const data = await api.get('/api/mesas')
      setMesas(data)
    } catch { /* silencioso */ }
  }, [])

  const loadCardapio = useCallback(async () => {
    try {
      const data = await api.get('/api/cardapio')
      setCardapio(data.filter(p => !p.indisponivel))
    } catch { /* silencioso */ }
  }, [])

  const loadComanda = useCallback(async (id) => {
    if (!id) return
    try {
      const data = await api.get(`/api/comanda/${id}`)
      setComanda(data)
    } catch { /* silencioso */ }
  }, [])

  const loadCaixaHoje = useCallback(async () => {
    try {
      const data = await api.get('/api/admin/caixa/hoje')
      setCaixaHoje(data)
    } catch { /* silencioso */ }
  }, [])

  const loadVendas = useCallback(async () => {
    setVendasLoading(true)
    try {
      const data = await api.get('/api/admin/vendas?hoje=1')
      setVendas(Array.isArray(data) ? data : (data.vendas || []))
    } catch { /* silencioso */ }
    finally { setVendasLoading(false) }
  }, [])

  useEffect(() => {
    loadMesas()
    loadCardapio()
    loadCaixaHoje()
    timerRef.current = setInterval(() => {
      loadMesas()
      loadCaixaHoje()
    }, 15000)
    return () => clearInterval(timerRef.current)
  }, [loadMesas, loadCardapio, loadCaixaHoje])

  useEffect(() => {
    if (activeTab === 'vendas') loadVendas()
  }, [activeTab, loadVendas])

  // Banner stats
  const abertas = [...(mesas.fisicas || []), ...(mesas.virtuais || [])].filter(m => m.status !== 'livre')
  const totalAberto = abertas.reduce((s, m) => s + (m.total || 0), 0)

  // Busca no cardápio
  const [buscaCardapio, setBuscaCardapio] = useState('')

  // Categorias
  const cats = ['Tudo', ...Array.from(new Set(cardapio.map(p => p.cat)))]
  const prodsFiltrados = cardapio
    .filter(p => catFiltro === 'Tudo' || p.cat === catFiltro)
    .filter(p => !buscaCardapio || p.nome.toLowerCase().includes(buscaCardapio.toLowerCase()))

  // Totais com desconto e serviço
  const subtotal = comanda?.total || 0
  const descVal = subtotal * (descPct / 100)
  const subtotalDesc = subtotal - descVal
  const servicoVal = servico ? subtotalDesc * 0.1 : 0
  const totalFinal = subtotalDesc + servicoVal

  // Restante multi-pagamento (calculado aqui após totalFinal estar disponível)
  const restanteMultiPag = totalFinal - totalMultiPag

  // Troco (considera divisão)
  const totalPorPessoa = dividir > 1 ? totalFinal / dividir : totalFinal
  const trocoVal = valorRecebido ? (parseFloat(valorRecebido.replace(',', '.')) || 0) - totalPorPessoa : 0

  // Abrir mesa física
  const handleMesaClick = async (mesa) => {
    if (mesa.status === 'livre') {
      setNovaMesaNome('')
      setSheet({ tipo: 'fisica', num: mesa.num, nova: true })
      setOverlay('nova-fisica')
    } else {
      setDescPct(0)
      setSheet({ tipo: 'fisica', num: mesa.num, id: mesa.comandaId })
      await loadComanda(mesa.comandaId)
    }
  }

  // Abrir comanda virtual
  const handleVirtualClick = async (v) => {
    setDescPct(0)
    setSheet({ tipo: 'virtual', id: v.id })
    await loadComanda(v.id)
  }

  // Iniciar comanda física
  const iniciarComandaFisica = async () => {
    if (!sheet?.num) return
    setLoading(true)
    try {
      await api.post(`/api/mesa/${sheet.num}/pedir`, { itens: [], nome: novaMesaNome || undefined })
      await loadMesas()
      toast('Comanda aberta!', 'success')
      const mesasData = await api.get('/api/mesas')
      setMesas(mesasData)
      const m = mesasData.fisicas.find(x => x.num === sheet.num)
      if (m?.comandaId) {
        setSheet({ tipo: 'fisica', num: m.num, id: m.comandaId })
        const cmd = await api.get(`/api/comanda/${m.comandaId}`)
        setComanda(cmd)
      }
      setOverlay(null)
    } catch (e) {
      toast(e.message || 'Erro ao abrir comanda', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Criar comanda virtual
  const criarVirtual = async () => {
    if (!novaVirtual.nome.trim()) { toast('Nome obrigatório', 'error'); return }
    setLoading(true)
    try {
      const data = await api.post('/api/mesa-virtual', novaVirtual)
      await loadMesas()
      toast('Comanda virtual criada!', 'success')
      setSheet({ tipo: 'virtual', id: data.id })
      const cmd = await api.get(`/api/comanda/${data.id}`)
      setComanda(cmd)
      setOverlay(null)
      setNovaVirtual({ nome: '', local: '' })
    } catch (e) {
      toast(e.message || 'Erro', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Quantidade direta por produto no cardápio (sem precisar abrir modal para qtd > 1)
  const [qtdMap, setQtdMap] = useState({})   // { prodId: qtd }

  const getQtd = (id) => qtdMap[id] || 1
  const setQtd = (id, v) => setQtdMap(prev => ({ ...prev, [id]: Math.max(1, Math.min(99, v)) }))

  // Abrir modal de obs do item antes de adicionar
  const abrirObsItem = (prod) => {
    setItemObs({ prod, obs: '', qtd: getQtd(prod.id) })
    setOverlay('obs-item')
  }

  // Confirmar adição com obs
  const confirmarAdicionarItem = async () => {
    if (!itemObs.prod) return
    await adicionarItem(itemObs.prod.id, itemObs.qtd || 1, itemObs.obs)
    setOverlay('cardapio')
    setItemObs({ prod: null, obs: '', qtd: 1 })
  }

  // Lançamento rápido: adiciona direto sem obs
  const lancamentoRapido = async (prod) => {
    if (!comanda?.id) return
    const qtd = getQtd(prod.id)
    await adicionarItem(prod.id, qtd, '')
    setQtdMap(prev => ({ ...prev, [prod.id]: 1 }))
  }

  // Adicionar item
  const adicionarItem = async (produtoId, qtd = 1, obs = '') => {
    if (!comanda?.id) return
    try {
      await api.post(`/api/comanda/${comanda.id}/adicionar`, { itens: [{ produtoId, qtd, obs }] })
      await loadComanda(comanda.id)
      await loadMesas()
      toast('Item adicionado!', 'success')
    } catch (e) {
      toast(e.message || 'Erro ao adicionar', 'error')
    }
  }

  // Cancelar item individual
  const cancelarItem = async (idx) => {
    if (!comanda?.id) return
    if (!window.confirm('Remover este item da comanda?')) return
    try {
      await api.delete(`/api/comanda/${comanda.id}/item/${idx}`)
      await loadComanda(comanda.id)
      await loadMesas()
      toast('Item removido', 'success')
    } catch (e) {
      // fallback: tentar POST
      try {
        await api.post(`/api/comanda/${comanda.id}/cancelar-item`, { idx })
        await loadComanda(comanda.id)
        await loadMesas()
        toast('Item removido', 'success')
      } catch (e2) {
        toast(e2.message || 'Erro ao remover item', 'error')
      }
    }
  }

  // Pedir conta
  const pedirConta = async () => {
    if (!comanda?.id) return
    setLoading(true)
    try {
      await api.post(`/api/comanda/${comanda.id}/conta`, {})
      await loadComanda(comanda.id)
      await loadMesas()
      toast('Conta solicitada!', 'success')
      setOverlay('conta')
    } catch (e) {
      toast(e.message || 'Erro', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Pagar
  const pagar = async () => {
    if (!comanda?.id) return
    setLoading(true)
    try {
      // Se há múltiplos meios registrados, envia todos; senão envia o único selecionado
      const payload = multiPag.length > 0 && restanteMultiPag < 0.01
        ? {
            meios: multiPag,
            meio: multiPag[0]?.meio || payMeio,
            desconto: descPct > 0 ? descPct : undefined,
            servico,
            totalFinal,
          }
        : {
            meio: payMeio,
            desconto: descPct > 0 ? descPct : undefined,
            servico,
            totalFinal,
            dividir: dividir > 1 ? dividir : undefined,
          }
      await api.post(`/api/comanda/${comanda.id}/pagar`, payload)
      toast('Pagamento registrado! ✓', 'success')
      setOverlay(null)
      setSheet(null)
      setComanda(null)
      setDescPct(0)
      setValorRecebido('')
      setDividir(1)
      setMultiPag([])
      setMultiPagValor('')
      await loadMesas()
      await loadCaixaHoje()
    } catch (e) {
      toast(e.message || 'Erro ao pagar', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Sangria / Suprimento
  const registrarMovimento = async () => {
    const val = parseFloat(caixaMov.valor.replace(',', '.'))
    if (!val || val <= 0) { toast('Valor inválido', 'error'); return }
    if (!caixaMov.motivo.trim()) { toast('Informe o motivo', 'error'); return }
    setLoading(true)
    try {
      await api.post('/api/admin/caixa/movimento', {
        tipo: caixaMov.tipo,
        valor: val,
        motivo: caixaMov.motivo,
      })
      toast(`${caixaMov.tipo === 'sangria' ? 'Sangria' : 'Suprimento'} registrado!`, 'success')
      setCaixaMov({ tipo: 'sangria', valor: '', motivo: '' })
      setOverlay(null)
      await loadCaixaHoje()
    } catch (e) {
      toast(e.message || 'Erro', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Imprimir comanda
  const imprimirComanda = () => {
    if (!comanda) return
    const linhas = (comanda.itens || []).map(it =>
      `<tr><td>${it.qtd}× ${it.nome}${it.obs ? ` <small>(${it.obs})</small>` : ''}</td><td style="text-align:right">${fmtR((it.preco || 0) * (it.qtd || 1))}</td></tr>`
    ).join('')
    const mesa = sheet?.tipo === 'fisica' ? `Mesa ${sheet.num}` : (comanda.mesa || `Comanda #${comanda.id}`)
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const html = `
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Comanda #${comanda.id}</title>
      <style>
        body { font-family: monospace; font-size: 13px; max-width: 300px; margin: 0 auto; padding: 12px; }
        h2 { text-align: center; margin: 4px 0; }
        p { text-align: center; margin: 2px 0; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        td { padding: 4px 2px; border-bottom: 1px dashed #ccc; }
        .total { font-weight: bold; font-size: 15px; }
        .rodape { text-align: center; margin-top: 14px; font-size: 11px; color: #888; }
      </style></head><body>
      <h2>Agro Open</h2>
      <p>${mesa} — ${hora}</p>
      <table>${linhas}
        ${descPct > 0 ? `<tr><td>Desconto ${descPct}%</td><td style="text-align:right">-${fmtR(descVal)}</td></tr>` : ''}
        ${servico ? `<tr><td>Serviço 10%</td><td style="text-align:right">${fmtR(servicoVal)}</td></tr>` : ''}
        <tr class="total"><td>TOTAL</td><td style="text-align:right">${fmtR(totalFinal)}</td></tr>
      </table>
      <div class="rodape">Obrigado pela preferência!</div>
      </body></html>`
    const w = window.open('', '_blank', 'width=340,height=500')
    if (w) {
      w.document.write(html)
      w.document.close()
      w.focus()
      setTimeout(() => { w.print(); w.close() }, 400)
    }
  }

  const fecharSheet = () => {
    setSheet(null)
    setComanda(null)
    setOverlay(null)
    setDescPct(0)
    setDividir(1)
    setMultiPag([])
    setMultiPagValor('')
    setBuscaCardapio('')
  }

  const fmtMeio = (meio) => {
    const map = { pix: 'Pix', cartao: 'Cartão', dinheiro: 'Dinheiro', carteira: 'Carteira' }
    return map[meio] || meio || '—'
  }

  return (
    <div style={S.page}>
      <style>{`
        @keyframes pulse-gold {
          0%,100% { box-shadow: 0 0 0 0 rgba(201,166,86,.5); }
          50% { box-shadow: 0 0 0 8px rgba(201,166,86,0); }
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e4029; border-radius: 4px; }
        @media print { body * { visibility: hidden; } }
      `}</style>

      {/* Banner resumo caixa */}
      <div style={S.banner}>
        <div style={S.bannerStat}>
          <span style={S.bannerLabel}>Abertura</span>
          <span style={{ ...S.bannerValSmall, color: '#f4f6ef' }}>{fmtR(caixaHoje.abertura || 0)}</span>
        </div>
        <div style={S.bannerStat}>
          <span style={S.bannerLabel}>Sangrias</span>
          <span style={{ ...S.bannerValSmall, color: '#e74c3c' }}>-{fmtR(caixaHoje.sangrias || 0)}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#f4f6ef', lineHeight: 1 }}>PDV</div>
          <div style={{ fontSize: 10, opacity: 0.55, marginTop: 2 }}>{abertas.length} mesa{abertas.length !== 1 ? 's' : ''} abertas</div>
        </div>
        <div style={S.bannerStat}>
          <span style={S.bannerLabel}>Vendas</span>
          <span style={{ ...S.bannerValSmall, color: '#8FD64A' }}>{fmtR(caixaHoje.vendas || 0)}</span>
        </div>
        <div style={S.bannerStat}>
          <span style={S.bannerLabel}>Saldo est.</span>
          <span style={{ ...S.bannerValSmall, color: '#C9A656' }}>{fmtR(caixaHoje.saldo || 0)}</span>
        </div>
        {/* Botão Sangria/Suprimento */}
        <button
          onClick={() => { setCaixaMov({ tipo: 'sangria', valor: '', motivo: '' }); setOverlay('caixa-mov') }}
          style={{ background: '#1e4029', border: '1.5px solid #5FB335', borderRadius: 8, color: '#f4f6ef', fontSize: 11, padding: '5px 9px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
          💰 Caixa
        </button>
      </div>

      {/* Conteúdo por aba */}
      {activeTab === 'mesas' && (
        <>
          {/* Mesas Físicas — MELHORADO F3 */}
          <div style={S.section}>
            {/* Header com busca e KPIs rápidos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={S.sectionTitle}>Mesas Físicas</div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Chips de status */}
                {[
                  { label: 'Livres', count: (mesas.fisicas||[]).filter(m=>m.status==='livre').length, color: '#1e4029', text: '#6aaa6a' },
                  { label: 'Ocupadas', count: (mesas.fisicas||[]).filter(m=>m.status==='ocupada').length, color: '#1a4a20', text: '#8FD64A' },
                  { label: 'Conta', count: (mesas.fisicas||[]).filter(m=>m.status==='conta').length, color: '#3a2800', text: '#C9A656' },
                ].map(s => s.count > 0 && (
                  <span key={s.label} style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: s.color, color: s.text }}>
                    {s.label}: {s.count}
                  </span>
                ))}
                {/* Busca rápida */}
                <input
                  style={{ ...S.input, marginBottom: 0, width: 100, fontSize: 12, padding: '4px 8px' }}
                  placeholder="🔍 Mesa…"
                  value={buscaMesa}
                  onChange={e => setBuscaMesa(e.target.value)}
                />
              </div>
            </div>
            <div style={S.grid}>
              {(mesas.fisicas || [])
                .filter(m => !buscaMesa || String(m.num).includes(buscaMesa) || (m.nome||'').toLowerCase().includes(buscaMesa.toLowerCase()))
                .map(m => <MesaCard key={m.num} m={m} onClick={() => handleMesaClick(m)} />)}
            </div>
          </div>

          {/* Comandas Virtuais */}
          <div style={S.section}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={S.sectionTitle}>Comandas Virtuais</div>
              <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 14px' }}
                onClick={() => { setNovaVirtual({ nome: '', local: '' }); setOverlay('nova-virtual') }}>
                + Nova
              </button>
            </div>
            <div style={S.virtualList}>
              {(mesas.virtuais || []).length === 0 && (
                <div style={{ fontSize: 13, opacity: 0.45, textAlign: 'center', padding: 16 }}>Nenhuma comanda virtual aberta</div>
              )}
              {(mesas.virtuais || []).map(v => (
                <div key={v.id} style={S.vcard} onClick={() => handleVirtualClick(v)}>
                  <div style={S.vcardLeft}>
                    <span style={S.vcardName}>{v.nome || `Comanda #${v.id}`}</span>
                    <span style={S.vcardSub}>{typeof v.local === 'object' && v.local ? (v.local.ref || '—') : (v.local || '—')}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={S.vcardTotal}>{fmtR(v.total || 0)}</div>
                    {v.aguardandoCozinha && <span style={{ fontSize: 14 }}>🔥</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Aba Vendas */}
      {activeTab === 'vendas' && (
        <div style={S.section}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={S.sectionTitle}>Vendas de Hoje</div>
            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={loadVendas}>↺ Atualizar</button>
          </div>
          {vendasLoading ? (
            <div style={{ textAlign: 'center', opacity: 0.5, padding: 20 }}>Carregando...</div>
          ) : vendas.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.45, textAlign: 'center', padding: 24 }}>Nenhuma venda fechada hoje</div>
          ) : (
            <div style={S.vendasList}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.55, padding: '0 4px 6px', borderBottom: '1px solid #1e4029' }}>
                <span>Total do dia</span>
                <span style={{ color: '#8FD64A', fontWeight: 700 }}>
                  {fmtR(vendas.reduce((s, v) => s + (v.total || v.valor || 0), 0))}
                </span>
              </div>
              {vendas.map((v, i) => (
                <div key={v.id || i} style={S.vendaRow}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{v.mesa || v.nome || `Comanda #${v.id}`}</div>
                    <div style={{ fontSize: 11, opacity: 0.55 }}>
                      {fmtMeio(v.meio || v.meioPagamento)} · {v.hora || v.fechadoEm ? new Date(v.fechadoEm || v.hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#8FD64A' }}>{fmtR(v.total || v.valor || 0)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom tabs */}
      <div style={S.bottomTabs}>
        {TABS.map(t => (
          <button key={t.key} style={S.tabBtn(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
            <span style={S.tabIcon}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Sheet da comanda — MELHORADO F2/F4 */}
      {sheet && !sheet.nova && comanda && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 99 }} onClick={fecharSheet} />
          <div style={S.sheet}>
            {/* Header melhorado */}
            <div style={S.sheetHeader}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={S.sheetTitle}>
                    {sheet.tipo === 'fisica' ? `Mesa ${sheet.num}` : comanda.mesa || `Comanda #${comanda.id}`}
                  </div>
                  {comanda.itens?.length > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 800, background: '#5FB335', color: '#0E2E1C', borderRadius: 10, padding: '2px 7px' }}>
                      {comanda.itens.reduce((s,i) => s+(i.qtd||1), 0)} itens
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2, display: 'flex', gap: 8 }}>
                  <span>Comanda #{comanda.id}</span>
                  {comanda.nome && <span>· {comanda.nome}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {/* Botão lançar rápido — abre cardápio direto */}
                <button
                  onClick={() => setOverlay('cardapio')}
                  style={{ background: 'linear-gradient(135deg,#5FB335,#3a8c1e)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', padding: '5px 12px', whiteSpace: 'nowrap' }}>
                  + Lançar
                </button>
                <button title="Imprimir comanda" onClick={imprimirComanda}
                  style={{ background: 'none', border: '1px solid #1e4029', borderRadius: 6, color: '#f4f6ef', fontSize: 16, cursor: 'pointer', padding: '3px 7px' }}>
                  🖨
                </button>
                <button style={S.sheetClose} onClick={fecharSheet}>✕</button>
              </div>
            </div>

            <div style={S.sheetBody}>
              {(!comanda.itens || comanda.itens.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🍽</div>
                  <div style={{ fontSize: 14, opacity: 0.45, marginBottom: 16 }}>Comanda vazia</div>
                  <button
                    onClick={() => setOverlay('cardapio')}
                    style={{ background: 'linear-gradient(135deg,#5FB335,#3a8c1e)', border: 'none', borderRadius: 10, color: '#fff', padding: '12px 28px', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                    ➕ Lançar primeiro item
                  </button>
                </div>
              ) : (
                <>
                  {comanda.itens.map((it, i) => (
                    <div key={i} style={{ ...S.itemRow, alignItems: 'center' }}>
                      <div style={{ ...S.itemQty, background: it.status === 'cancelado' ? '#3a1a1a' : '#1e4029' }}>{it.qtd}</div>
                      <div style={S.itemName}>
                        <span style={{ textDecoration: it.status === 'cancelado' ? 'line-through' : 'none', opacity: it.status === 'cancelado' ? 0.4 : 1 }}>{it.nome}</span>
                        {it.obs && <div style={{ fontSize: 10, opacity: 0.5, fontStyle: 'italic' }}>💬 {it.obs}</div>}
                      </div>
                      {it.status && it.status !== 'normal' && (
                        <div style={{ ...S.itemStatus, background: it.status === 'entregue' ? '#1a4a20' : it.status === 'preparando' ? '#3a2800' : '#1e4029', color: it.status === 'entregue' ? '#8FD64A' : it.status === 'preparando' ? '#C9A656' : '#8FD64A' }}>
                          {it.status}
                        </div>
                      )}
                      <div style={S.itemPrice}>{fmtR((it.preco || 0) * (it.qtd || 1))}</div>
                      <button style={S.itemDeleteBtn} title="Remover item" onClick={() => cancelarItem(i)}>✕</button>
                    </div>
                  ))}
                </>
              )}

              {/* Campo de desconto — mais compacto */}
              {comanda.itens?.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #1e4029' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, opacity: 0.65, marginRight: 4 }}>Desconto:</span>
                    {[0, 5, 10, 15, 20].map(p => (
                      <button key={p} onClick={() => setDescPct(p)}
                        style={{ padding: '3px 9px', borderRadius: 16, border: `1.5px solid ${descPct === p ? '#5FB335' : '#1e4029'}`, background: descPct === p ? '#1a4a20' : 'transparent', color: descPct === p ? '#8FD64A' : '#f4f6ef', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                        {p}%
                      </button>
                    ))}
                    <input
                      type="number" min="0" max="100" placeholder="outro"
                      value={descPct > 20 ? descPct : ''}
                      onChange={e => setDescPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                      style={{ ...S.input, marginBottom: 0, width: 56, padding: '3px 7px', fontSize: 11 }}
                    />
                  </div>
                  {descPct > 0 && (
                    <div style={{ fontSize: 11, color: '#8FD64A', marginTop: 5 }}>
                      Desconto: −{fmtR(descVal)} → Subtotal: {fmtR(subtotalDesc)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé com total visual rico */}
            <div style={{ padding: '8px 16px', borderTop: '1px solid #1e4029', background: '#0a1a0f' }}>
              {descPct > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.6, marginBottom: 2 }}>
                  <span>Subtotal c/ desconto</span>
                  <span>{fmtR(subtotalDesc)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 900 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Total
                  {servico && comanda.itens?.length > 0 && (
                    <span style={{ fontSize: 10, opacity: 0.5, fontWeight: 400 }}>+10% serv.</span>
                  )}
                </span>
                <span style={{ color: '#8FD64A' }}>{fmtR(totalFinal)}</span>
              </div>
            </div>

            <div style={S.sheetActions}>
              <button className="btn btn-secondary" style={{ flex: 1, fontSize: 13 }}
                onClick={() => setOverlay('cardapio')}>
                ➕ Adicionar
              </button>
              <button className="btn btn-secondary" style={{ flex: 1, fontSize: 13 }}
                onClick={pedirConta} disabled={loading}>
                🧾 Conta
              </button>
              <button className="btn btn-primary" style={{ flex: 2, fontSize: 14, fontWeight: 800 }}
                onClick={() => { setPayMeio('pix'); setValorRecebido(''); setOverlay('pagar') }}>
                💳 Pagar {fmtR(totalFinal)}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Overlay: Seletor de cardápio — MELHORADO F1 */}
      {overlay === 'cardapio' && (
        <div style={S.overlay} onClick={() => setOverlay(null)}>
          <div style={{ ...S.modal, maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid #1e4029', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>🍽 Cardápio</div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 1 }}>
                  {sheet?.tipo === 'fisica' ? `Mesa ${sheet.num}` : comanda?.mesa || `Comanda #${comanda?.id}`}
                  {' · '}{prodsFiltrados.length} produto{prodsFiltrados.length !== 1 ? 's' : ''}
                </div>
              </div>
              <button style={S.sheetClose} onClick={() => { setOverlay(null); setBuscaCardapio('') }}>✕</button>
            </div>

            {/* Busca */}
            <div style={{ padding: '10px 16px 0' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: 0.5 }}>🔍</span>
                <input
                  style={{ ...S.input, paddingLeft: 32, marginBottom: 0, fontSize: 13 }}
                  placeholder="Buscar produto…"
                  value={buscaCardapio}
                  onChange={e => setBuscaCardapio(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {/* Categorias — scroll horizontal com contadores */}
            <div style={{ ...S.catScroll, padding: '10px 16px 8px', gap: 6 }}>
              {cats.map(c => {
                const count = c === 'Tudo' ? cardapio.length : cardapio.filter(p => p.cat === c).length
                return (
                  <button key={c} style={{
                    ...S.catBtn(catFiltro === c),
                    display: 'flex', alignItems: 'center', gap: 4,
                  }} onClick={() => { setCatFiltro(c); setBuscaCardapio('') }}>
                    {c}
                    <span style={{
                      fontSize: 10, fontWeight: 800,
                      background: catFiltro === c ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                      borderRadius: 10, padding: '1px 6px',
                    }}>{count}</span>
                  </button>
                )
              })}
            </div>

            {/* Grid de produtos — VISUAL RICO */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '4px 16px 16px' }}>
              {prodsFiltrados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.4 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 13 }}>Nenhum produto encontrado</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 10 }}>
                  {prodsFiltrados.map(p => {
                    const estBaixo = p.estoque !== null && p.estoque !== undefined && p.estoque <= 5
                    const estZero = p.estoque !== null && p.estoque !== undefined && p.estoque <= 0
                    const qtd = getQtd(p.id)
                    const emoji = p.emoji || prodEmoji(p)

                    return (
                      <div key={p.id} style={{
                        background: estZero ? '#1a1a1a' : '#1a2e1e',
                        border: `1.5px solid ${estZero ? '#3a1a1a' : estBaixo ? '#C9A65660' : '#1e4029'}`,
                        borderRadius: 12, overflow: 'hidden',
                        opacity: estZero ? 0.5 : 1,
                        display: 'flex', flexDirection: 'column',
                        transition: 'border-color .15s',
                      }}>
                        {/* Área visual do produto */}
                        <div style={{
                          background: estZero ? '#2a1a1a' : 'linear-gradient(135deg,#0d2218,#1a3a24)',
                          padding: '14px 12px 10px',
                          display: 'flex', flexDirection: 'column', flex: 1,
                          position: 'relative',
                        }}>
                          {/* Badge estoque */}
                          {p.estoque !== null && p.estoque !== undefined && (
                            <div style={{
                              position: 'absolute', top: 6, right: 6,
                              background: estZero ? '#e74c3c' : estBaixo ? '#C9A656' : '#1e4a2a',
                              color: estZero ? '#fff' : estBaixo ? '#000' : '#8FD64A',
                              borderRadius: 8, fontSize: 9, fontWeight: 800,
                              padding: '2px 6px', lineHeight: 1.4,
                            }}>
                              {estZero ? 'SEM' : estBaixo ? `⚠ ${p.estoque}` : `${p.estoque}`}
                            </div>
                          )}
                          {/* Emoji/ícone */}
                          <div style={{ fontSize: 28, marginBottom: 6, lineHeight: 1 }}>{emoji}</div>
                          <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3, color: estZero ? '#888' : '#f4f6ef', marginBottom: 3 }}>{p.nome}</div>
                          {p.cat && <div style={{ fontSize: 10, opacity: 0.45, marginBottom: 4 }}>{p.cat}</div>}
                          <div style={{ fontSize: 15, fontWeight: 800, color: estZero ? '#666' : '#C9A656' }}>{fmtR(p.preco)}</div>
                        </div>

                        {/* Controles de quantidade + adicionar */}
                        {!estZero && (
                          <div style={{ padding: '8px 10px', borderTop: '1px solid #1e4029', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {/* Seletor de quantidade */}
                            <button
                              onClick={() => setQtd(p.id, qtd - 1)}
                              style={{ width: 26, height: 26, borderRadius: 6, background: '#132b1b', border: '1px solid #1e4029', color: '#8FD64A', fontWeight: 800, fontSize: 16, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>
                              −
                            </button>
                            <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 800, fontSize: 13, color: qtd > 1 ? '#C9A656' : '#f4f6ef' }}>{qtd}</span>
                            <button
                              onClick={() => setQtd(p.id, qtd + 1)}
                              style={{ width: 26, height: 26, borderRadius: 6, background: '#132b1b', border: '1px solid #1e4029', color: '#8FD64A', fontWeight: 800, fontSize: 16, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>
                              +
                            </button>
                            {/* Botão lançar rápido */}
                            <button
                              onClick={() => lancamentoRapido(p)}
                              title="Lançar na comanda"
                              style={{ flex: 1, height: 26, borderRadius: 6, background: 'linear-gradient(135deg,#5FB335,#3a8c1e)', border: 'none', color: '#fff', fontWeight: 800, fontSize: 11.5, cursor: 'pointer', lineHeight: 1, letterSpacing: '.02em' }}>
                              + Lançar
                            </button>
                            {/* Botão com obs */}
                            <button
                              onClick={() => abrirObsItem(p)}
                              title="Adicionar com observação"
                              style={{ width: 26, height: 26, borderRadius: 6, background: '#132b1b', border: '1px solid #1e4029', color: '#C9A656', fontWeight: 800, fontSize: 13, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>
                              💬
                            </button>
                          </div>
                        )}
                        {estZero && (
                          <div style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: '#e74c3c', fontWeight: 700, borderTop: '1px solid #3a1a1a' }}>
                            Indisponível
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Rodapé: lista VIVA dos itens já lançados na comanda */}
            {comanda?.itens?.length > 0 && (
              <div style={{ borderTop: '1px solid #1e4029', background: '#0a1a0f' }}>
                <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8FD64A' }}>
                    🧾 Lançados ({comanda.itens.reduce((s, i) => s + (i.qtd || 1), 0)})
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#C9A656' }}>{fmtR(comanda.total || 0)}</span>
                </div>
                {/* lista rolável dos itens já na comanda */}
                <div style={{ maxHeight: 132, overflowY: 'auto', padding: '0 16px' }}>
                  {comanda.itens.map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #142a1a' }}>
                      <span style={{ minWidth: 26, height: 20, borderRadius: 5, background: '#1e4029', color: '#8FD64A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{it.qtd}×</span>
                      <span style={{ flex: 1, fontSize: 12, color: '#dfe9df', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {it.nome}{it.obs ? <span style={{ color: '#8FD64A', opacity: .7 }}> · {it.obs}</span> : null}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#C9A656', flexShrink: 0 }}>{fmtR((it.preco || 0) * (it.qtd || 1))}</span>
                      <button
                        onClick={() => cancelarItem(idx)}
                        title="Remover item"
                        aria-label={`Remover ${it.nome}`}
                        style={{ background: 'none', border: 'none', color: '#e05c5c', cursor: 'pointer', fontSize: 13, padding: '0 2px', flexShrink: 0 }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '8px 16px 12px' }}>
                  <button
                    onClick={() => setOverlay(null)}
                    style={{ width: '100%', background: '#1a4a20', border: '1.5px solid #5FB335', borderRadius: 9, color: '#8FD64A', padding: '9px 0', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>
                    ✓ Concluir e voltar à comanda
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay: Obs por item — MELHORADO F2 */}
      {overlay === 'obs-item' && itemObs.prod && (
        <div style={S.overlay} onClick={() => setOverlay('cardapio')}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            {/* Header com emoji/nome */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#1a3a24,#0d2218)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                🍽
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{itemObs.prod.nome}</div>
                <div style={{ fontSize: 13, color: '#C9A656', fontWeight: 700 }}>{fmtR(itemObs.prod.preco)}</div>
                {itemObs.prod.cat && <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>{itemObs.prod.cat}</div>}
              </div>
            </div>

            {/* Seletor de quantidade */}
            <div style={{ marginBottom: 12, padding: '10px 12px', background: '#132b1b', borderRadius: 10, border: '1px solid #1e4029' }}>
              <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 8 }}>Quantidade</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => setItemObs(v => ({ ...v, qtd: Math.max(1, (v.qtd || 1) - 1) }))}
                  style={{ width: 36, height: 36, borderRadius: 8, background: '#1e4029', border: 'none', color: '#8FD64A', fontWeight: 800, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>
                  −
                </button>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#C9A656', minWidth: 36, textAlign: 'center' }}>
                  {itemObs.qtd || 1}
                </span>
                <button
                  onClick={() => setItemObs(v => ({ ...v, qtd: Math.min(99, (v.qtd || 1) + 1) }))}
                  style={{ width: 36, height: 36, borderRadius: 8, background: '#1e4029', border: 'none', color: '#8FD64A', fontWeight: 800, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>
                  +
                </button>
                <div style={{ flex: 1, textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#8FD64A' }}>
                  = {fmtR((itemObs.prod.preco || 0) * (itemObs.qtd || 1))}
                </div>
              </div>
            </div>

            {/* Observação */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 6 }}>Observação (opcional)</div>
              <input
                style={{ ...S.input, marginBottom: 0 }}
                placeholder="ex: sem cebola, bem passado, sem gelo…"
                value={itemObs.obs}
                onChange={e => setItemObs(v => ({ ...v, obs: e.target.value }))}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setOverlay('cardapio')}>← Voltar</button>
              <button className="btn btn-primary" style={{ flex: 2, fontWeight: 800 }} onClick={confirmarAdicionarItem}>
                ✓ Lançar {itemObs.qtd > 1 ? `${itemObs.qtd}×` : ''} {itemObs.prod.nome}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay: Pré-conta */}
      {overlay === 'conta' && comanda && (
        <div style={S.overlay} onClick={() => setOverlay(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={S.modalTitle}>🧾 Pré-conta</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button title="Imprimir" onClick={imprimirComanda}
                  style={{ background: 'none', border: '1px solid #1e4029', borderRadius: 6, color: '#f4f6ef', fontSize: 15, cursor: 'pointer', padding: '3px 7px' }}>
                  🖨
                </button>
                <button style={S.sheetClose} onClick={() => setOverlay(null)}>✕</button>
              </div>
            </div>

            <div style={S.contaBox}>
              {(comanda.itens || []).map((it, i) => (
                <div key={i} style={S.contaRow}>
                  <span>{it.qtd}× {it.nome}</span>
                  <span style={{ color: '#C9A656' }}>{fmtR((it.preco || 0) * (it.qtd || 1))}</span>
                </div>
              ))}
              <div style={S.contaRow}>
                <span>Subtotal</span>
                <span>{fmtR(subtotal)}</span>
              </div>
              {descPct > 0 && (
                <div style={{ ...S.contaRow, color: '#8FD64A' }}>
                  <span>Desconto {descPct}%</span>
                  <span>-{fmtR(descVal)}</span>
                </div>
              )}
              <label style={S.serviceToggle}>
                <input type="checkbox" checked={servico} onChange={e => setServico(e.target.checked)} />
                10% Serviço ({fmtR(servicoVal)})
              </label>
              <div style={S.contaTotal}>
                <span>Total</span>
                <span style={{ color: '#8FD64A' }}>{fmtR(totalFinal)}</span>
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%' }}
              onClick={() => { setValorRecebido(''); setOverlay('pagar') }}>
              💳 Ir para pagamento
            </button>
          </div>
        </div>
      )}

      {/* Overlay: Pagamento — MELHORADO F4 */}
      {overlay === 'pagar' && (
        <div style={S.overlay} onClick={() => setOverlay(null)}>
          <div style={{ ...S.modal, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={S.modalTitle}>💳 Pagamento</div>
              <button style={S.sheetClose} onClick={() => setOverlay(null)}>✕</button>
            </div>

            {/* Resumo visual do total — destaque */}
            <div style={{ textAlign: 'center', padding: '14px 10px', background: 'linear-gradient(135deg,#0d2218,#1a3a24)', borderRadius: 14, marginBottom: 14, border: '1.5px solid #1e4029' }}>
              {descPct > 0 && (
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>
                  Subtotal {fmtR(subtotal)} − {descPct}% desc. = {fmtR(subtotalDesc)}
                  {servico && ` + 10% serv. = ${fmtR(totalFinal)}`}
                </div>
              )}
              <div style={{ fontSize: 11, opacity: 0.55, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                {sheet?.tipo === 'fisica' ? `Mesa ${sheet?.num}` : comanda?.mesa || `Comanda #${comanda?.id}`}
              </div>
              <div style={{ fontSize: 34, fontWeight: 900, color: '#8FD64A', lineHeight: 1 }}>
                {fmtR(totalFinal)}
              </div>
              {servico && (
                <label style={{ ...S.serviceToggle, justifyContent: 'center', marginTop: 8, marginBottom: 0 }}>
                  <input type="checkbox" checked={servico} onChange={e => setServico(e.target.checked)} />
                  <span style={{ fontSize: 12, opacity: 0.7 }}>Incluir 10% serviço ({fmtR(servicoVal)})</span>
                </label>
              )}
            </div>

            {/* Divisão de conta */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 10px', background: '#132b1b', borderRadius: 8 }}>
              <span style={{ fontSize: 12, opacity: 0.7, flex: 1 }}>Dividir entre:</span>
              <button onClick={() => setDividir(d => Math.max(1, d - 1))}
                style={{ background: '#1e4029', border: 'none', borderRadius: 6, color: '#8FD64A', width: 28, height: 28, cursor: 'pointer', fontWeight: 800, fontSize: 16 }}>-</button>
              <span style={{ fontWeight: 800, fontSize: 16, minWidth: 24, textAlign: 'center' }}>{dividir}</span>
              <button onClick={() => setDividir(d => d + 1)}
                style={{ background: '#1e4029', border: 'none', borderRadius: 6, color: '#8FD64A', width: 28, height: 28, cursor: 'pointer', fontWeight: 800, fontSize: 16 }}>+</button>
              {dividir > 1 && (
                <span style={{ fontSize: 13, color: '#C9A656', fontWeight: 700, marginLeft: 6 }}>
                  = {fmtR(totalFinal / dividir)}/pessoa
                </span>
              )}
            </div>

            <div style={S.payBtns}>
              {PAY_OPTIONS.map(o => (
                <div key={o.key} style={S.payBtn(payMeio === o.key)} onClick={() => { setPayMeio(o.key); setValorRecebido('') }}>
                  <div>{o.icon}</div>
                  <div style={S.payBtnLabel}>{o.label}</div>
                </div>
              ))}
            </div>

            {/* Múltiplos meios de pagamento */}
            {multiPag.length > 0 && (
              <div style={{ marginTop: 12, padding: '8px 10px', background: '#0a1a10', borderRadius: 8, border: '1px solid #1e4029' }}>
                <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 6 }}>Pagamentos registrados:</div>
                {multiPag.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span>{PAY_OPTIONS.find(o => o.key === p.meio)?.icon} {PAY_OPTIONS.find(o => o.key === p.meio)?.label}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: '#8FD64A', fontWeight: 700 }}>{fmtR(p.valor)}</span>
                      <button onClick={() => setMultiPag(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 12 }}>✕</button>
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #1e4029', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Restante:</span>
                  <span style={{ color: restanteMultiPag > 0 ? '#C9A656' : '#8FD64A', fontWeight: 700 }}>{fmtR(Math.max(0, restanteMultiPag))}</span>
                </div>
              </div>
            )}

            {/* Adicionar pagamento parcial */}
            {multiPag.length > 0 && restanteMultiPag > 0.01 && (
              <div style={{ marginTop: 8, padding: '8px 10px', background: '#132b1b', borderRadius: 8, border: '1px solid #1e4029' }}>
                <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 6 }}>Adicionar pagamento parcial:</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="number" min="0" step="0.01"
                    placeholder="Valor"
                    value={multiPagValor}
                    onChange={e => setMultiPagValor(e.target.value)}
                    style={{ ...S.input, marginBottom: 0, fontSize: 13, flex: 1 }}
                  />
                  <button
                    onClick={() => {
                      const v = parseFloat(multiPagValor) || 0
                      if (v > 0) {
                        setMultiPag(prev => [...prev, { meio: multiPagMeio, valor: v }])
                        setMultiPagValor('')
                      }
                    }}
                    style={{ background: '#5FB335', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, padding: '0 14px', cursor: 'pointer', fontSize: 13 }}>
                    + Add
                  </button>
                </div>
              </div>
            )}

            {multiPag.length === 0 && (
              <button
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid #1e4029', borderRadius: 8, color: '#8FD64A', padding: '6px 12px', cursor: 'pointer', fontSize: 12, marginTop: 8 }}
                onClick={() => setMultiPag([{ meio: payMeio, valor: parseFloat((totalFinal / 2).toFixed(2)) }])}>
                ➕ Dividir pagamento (2+ meios)
              </button>
            )}

            {/* PIX QR dinâmico */}
            {payMeio === 'pix' && multiPag.length === 0 && (
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={() => setShowPixQR(true)}
                  style={{ width: '100%', background: 'linear-gradient(135deg,#0E2E1C,#1a4a20)', border: '2px solid #5FB335', borderRadius: 12, color: '#8FD64A', padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  📲 Gerar QR Code PIX — {fmtR(dividir > 1 ? totalFinal / dividir : totalFinal)}
                </button>
                <div style={{ fontSize: 11, opacity: 0.45, textAlign: 'center', marginTop: 6 }}>
                  QR dinâmico · aguarda confirmação automática
                </div>
              </div>
            )}

            {/* Troco calculado para dinheiro */}
            {payMeio === 'dinheiro' && multiPag.length === 0 && (
              <div style={{ marginTop: 12, padding: '12px', background: '#132b1b', borderRadius: 10, border: '1px solid #1e4029' }}>
                <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>Valor recebido (R$)</div>
                <input
                  type="number" min="0" step="0.01"
                  placeholder={`mín. ${fmtR(dividir > 1 ? totalFinal / dividir : totalFinal)}`}
                  value={valorRecebido}
                  onChange={e => setValorRecebido(e.target.value)}
                  style={{ ...S.input, marginBottom: 0, fontSize: 16, fontWeight: 600 }}
                />
                {valorRecebido && (
                  <div style={{ marginTop: 8, textAlign: 'center' }}>
                    {trocoVal >= 0 ? (
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#8FD64A' }}>
                        Troco: {fmtR(trocoVal)}
                      </div>
                    ) : (
                      <div style={{ fontSize: 14, color: '#e74c3c', fontWeight: 600 }}>
                        Valor insuficiente ({fmtR(Math.abs(trocoVal))} a menos)
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 14, fontSize: 15 }}
              onClick={pagar}
              disabled={loading || (payMeio === 'dinheiro' && multiPag.length === 0 && valorRecebido && trocoVal < 0)}>
              {loading ? 'Processando...' : multiPag.length > 0 && restanteMultiPag < 0.01
                ? `✅ Confirmar — Pago (${fmtR(totalFinal)})`
                : `Confirmar — ${PAY_OPTIONS.find(o => o.key === payMeio)?.label}${dividir > 1 ? ` (${fmtR(totalFinal / dividir)}/pessoa)` : ''}`
              }
            </button>
          </div>
        </div>
      )}

      {/* Overlay: Nova comanda virtual */}
      {overlay === 'nova-virtual' && (
        <div style={S.overlay} onClick={() => setOverlay(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Nova Comanda Virtual</div>
            <input style={S.input} placeholder="Nome (ex: João da Silva)" value={novaVirtual.nome}
              onChange={e => setNovaVirtual(v => ({ ...v, nome: e.target.value }))} />
            <input style={S.input} placeholder="Local (ex: Arquibancada B)" value={novaVirtual.local}
              onChange={e => setNovaVirtual(v => ({ ...v, local: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setOverlay(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={criarVirtual} disabled={loading}>
                {loading ? '...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay: Nova comanda física */}
      {overlay === 'nova-fisica' && (
        <div style={S.overlay} onClick={() => { setOverlay(null); setSheet(null) }}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Mesa {sheet?.num}</div>
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 14 }}>Iniciar nova comanda</div>
            <input style={S.input} placeholder="Nome do cliente (opcional)"
              value={novaMesaNome} onChange={e => setNovaMesaNome(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }}
                onClick={() => { setOverlay(null); setSheet(null) }}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }}
                onClick={iniciarComandaFisica} disabled={loading}>
                {loading ? '...' : 'Abrir comanda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal PIX QR dinâmico */}
      {showPixQR && (
        <PixQRModal
          valor={dividir > 1 ? totalFinal / dividir : totalFinal}
          comandaId={comanda?.id}
          toast={toast}
          onClose={() => setShowPixQR(false)}
          onPago={async () => {
            setShowPixQR(false)
            await pagar()
          }}
        />
      )}

      {/* Overlay: Sangria / Suprimento de caixa */}
      {overlay === 'caixa-mov' && (
        <div style={S.overlay} onClick={() => setOverlay(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={S.modalTitle}>💰 Movimento de Caixa</div>
              <button style={S.sheetClose} onClick={() => setOverlay(null)}>✕</button>
            </div>

            {/* Tipo */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[{ key: 'sangria', label: '📤 Sangria', desc: 'Retirada' }, { key: 'suprimento', label: '📥 Suprimento', desc: 'Entrada' }].map(t => (
                <button key={t.key}
                  onClick={() => setCaixaMov(v => ({ ...v, tipo: t.key }))}
                  style={{
                    flex: 1, padding: '10px 6px', borderRadius: 10,
                    border: `2px solid ${caixaMov.tipo === t.key ? (t.key === 'sangria' ? '#e74c3c' : '#5FB335') : '#1e4029'}`,
                    background: caixaMov.tipo === t.key ? (t.key === 'sangria' ? '#2d0a0a' : '#1a4a20') : '#132b1b',
                    color: '#f4f6ef', cursor: 'pointer', textAlign: 'center',
                  }}>
                  <div style={{ fontSize: 16 }}>{t.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>{t.desc}</div>
                </button>
              ))}
            </div>

            <input style={S.input} placeholder="Valor (R$)" type="number" min="0" step="0.01"
              value={caixaMov.valor}
              onChange={e => setCaixaMov(v => ({ ...v, valor: e.target.value }))} />
            <input style={S.input} placeholder="Motivo (ex: troco inicial, retirada gerencial)"
              value={caixaMov.motivo}
              onChange={e => setCaixaMov(v => ({ ...v, motivo: e.target.value }))} />

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setOverlay(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={registrarMovimento} disabled={loading}>
                {loading ? '...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

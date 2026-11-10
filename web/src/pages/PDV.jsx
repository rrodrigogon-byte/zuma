import { useState, useEffect, useCallback, useRef } from 'react'
import { api, asArray, fmtR } from '../lib/api'
import { pagarTef, MODALIDADES_TEF } from '../lib/tef'
import { enfileirarVendaOffline, entregarFilaAoAgente, imprimirViaAgenteLocal, resumoFilaOffline } from '../lib/pdvOffline'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../lib/auth'
import { barAdminPath, barPath } from '../lib/bar-api'

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
  const [modo, setModo] = useState('indisponivel')   // 'mercadopago' | 'pix-estatico' | 'indisponivel'
  // Estado do polling
  const [status, setStatus] = useState('aguardando')  // aguardando | aprovado | erro
  const [tentativas, setTentativas] = useState(0)
  const [copied, setCopied] = useState(false)
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
        setModo(r.modo || 'indisponivel')
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
    const texto = copiaECola
    if (!texto) return
    navigator.clipboard?.writeText(texto).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  // QR/copia-e-cola só podem vir do servidor após criação em um provedor real.

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#142F49', border: '1.5px solid #294F6C', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, textAlign: 'center' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>📲 PIX</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#FF9B72', fontSize: 22, cursor: 'pointer' }}>✕</button>
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
            <button onClick={onClose} style={{ background: '#294F6C', border: '1px solid #FF6B2C', borderRadius: 8, color: '#FF9B72', padding: '8px 20px', cursor: 'pointer', fontWeight: 700 }}>
              Fechar
            </button>
          </div>
        )}

        {/* Pagamento aprovado */}
        {!iniciando && !erroInicio && status === 'aprovado' && (
          <div style={{ padding: '32px 0' }}>
            <div style={{ fontSize: 52 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#FF9B72', marginTop: 10 }}>Pagamento confirmado!</div>
          </div>
        )}

        {/* QR Code + ações */}
        {!iniciando && !erroInicio && status !== 'aprovado' && (
          <>
              {/* QR: somente retorno do gateway ou BR Code estático retornado pelo servidor */}
              <div style={{ background: '#FFF4EC', borderRadius: 12, padding: 12, marginBottom: 14 }}>
                {qrBase64 ? (
                  <img
                    src={`data:image/png;base64,${qrBase64}`}
                    width={200} height={200} alt="QR Code PIX"
                    style={{ borderRadius: 10, display: 'block', margin: '0 auto' }}
                  />
                ) : copiaECola ? (
                  <PixQRSVG emv={copiaECola} size={200} />
                ) : (
                  <div style={{ padding: '54px 14px', color: '#8A5B4A', fontSize: 13 }}>QR ainda não retornado pelo provedor.</div>
                )}
              </div>

            <div style={{ fontSize: 22, fontWeight: 800, color: '#FF9B72', marginBottom: 4 }}>
              {fmtR(valor)}
            </div>
            <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 14 }}>
              {modo === 'mercadopago' ? 'QR dinâmico Mercado Pago' : (modo === 'pix-estatico' ? 'Pix estático configurado pela loja' : 'Pagamento real indisponível')}
            </div>

            {/* Copiar copia-e-cola (do backend) */}
                          <button onClick={copiar} disabled={!copiaECola} style={{ width: '100%', background: '#294C65', border: '1.5px solid #FF6B2C', borderRadius: 10, color: '#FF9B72', padding: '10px', fontSize: 13, fontWeight: 700, cursor: copiaECola ? 'pointer' : 'not-allowed', marginBottom: 10, opacity: copiaECola ? 1 : 0.55 }}>

              {copied ? '✓ Copiado!' : '📋 Copiar código PIX'}
            </button>

            {/* Status de polling */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontSize: 12, opacity: 0.55 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#FF9B72', animation: 'pulse-gold 1.4s ease-in-out infinite' }} />
              Aguardando pagamento{tentativas > 0 ? ` (${tentativas}x)` : ''}...
            </div>

            {/* Preview do código (truncado) */}
            {copiaECola && (
              <div style={{ marginTop: 14, fontSize: 10, opacity: 0.35, wordBreak: 'break-all', padding: '8px', background: '#10283F', borderRadius: 8, lineHeight: 1.4, maxHeight: 48, overflow: 'hidden' }}>
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
  page: { minHeight: '100vh', background: 'var(--bg, #12283F)', color: '#FFF4EC', fontFamily: 'inherit', paddingBottom: 80 },
  banner: { background: 'linear-gradient(90deg,#254B6A,#2E5C7A)', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  bannerStat: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 },
  bannerLabel: { fontSize: 10, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 0.8 },
  bannerVal: { fontSize: 16, fontWeight: 700, color: '#FF9B72' },
  bannerValSmall: { fontSize: 13, fontWeight: 700 },
  section: { padding: '18px 16px 8px' },
  sectionTitle: { fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#FF9B72', marginBottom: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 10 },
  card: (status) => ({
    background: status === 'ocupada' ? '#17354F' : status === 'conta' ? '#3a2800' : status === 'livre' ? '#142F49' : '#17354F',
    border: `1.5px solid ${status === 'conta' ? '#FF6B2C' : status === 'ocupada' ? '#FF6B2C' : '#294F6C'}`,
    borderRadius: 10, padding: '10px 8px', cursor: 'pointer', textAlign: 'center', position: 'relative',
    transition: 'transform .15s, box-shadow .15s',
    animation: status === 'conta' ? 'pulse-gold 1.4s ease-in-out infinite' : 'none',
  }),
  cardNum: { fontSize: 22, fontWeight: 800, lineHeight: 1 },
  cardType: { fontSize: 10, opacity: 0.55, marginTop: 2 },
  cardTotal: { fontSize: 13, fontWeight: 700, color: '#FF9B72', marginTop: 4 },
  cardFire: { position: 'absolute', top: 4, right: 6, fontSize: 14 },
  virtualList: { display: 'flex', flexDirection: 'column', gap: 8 },
  vcard: { background: '#17354F', border: '1.5px solid #294F6C', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' },
  vcardLeft: { display: 'flex', flexDirection: 'column' },
  vcardName: { fontWeight: 700, fontSize: 14 },
  vcardSub: { fontSize: 11, opacity: 0.55 },
  vcardTotal: { fontSize: 15, fontWeight: 700, color: '#FF9B72' },
  sheet: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#142F49', borderTop: '2px solid #294F6C', borderRadius: '18px 18px 0 0', padding: '0 0 env(safe-area-inset-bottom,0)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', zIndex: 100 },
  sheetHeader: { padding: '14px 18px 10px', borderBottom: '1px solid #294F6C', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontWeight: 800, fontSize: 16 },
  sheetClose: { background: 'none', border: 'none', color: '#FF9B72', fontSize: 22, cursor: 'pointer', lineHeight: 1 },
  sheetBody: { overflowY: 'auto', flex: 1, padding: '10px 16px' },
  itemRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #1F405C' },
  itemQty: { minWidth: 26, height: 26, borderRadius: 6, background: '#294F6C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#FF9B72' },
  itemName: { flex: 1, fontSize: 13 },
  itemPrice: { fontSize: 13, fontWeight: 600, color: '#FF6B2C' },
  itemStatus: { fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#294F6C', color: '#FF9B72' },
  itemDeleteBtn: { background: 'none', border: 'none', color: '#c0392b', fontSize: 15, cursor: 'pointer', padding: '2px 4px', lineHeight: 1, opacity: 0.8 },
  sheetActions: { padding: '10px 16px 14px', display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #294F6C' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#142F49', border: '1.5px solid #294F6C', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380 },
  modalTitle: { fontSize: 17, fontWeight: 800, marginBottom: 16 },
  payBtns: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 },
  payBtn: (active) => ({ padding: '18px 10px', borderRadius: 10, border: `2px solid ${active ? '#FF6B2C' : '#294F6C'}`, background: active ? '#254B6A' : '#17354F', color: '#FFF4EC', cursor: 'pointer', fontSize: 20, textAlign: 'center', transition: 'all .15s' }),
  payBtnLabel: { fontSize: 12, fontWeight: 600, marginTop: 4 },
  catScroll: { display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 0', marginBottom: 10 },
  catBtn: (active) => ({ padding: '5px 14px', borderRadius: 20, border: `1.5px solid ${active ? '#FF6B2C' : '#294F6C'}`, background: active ? '#254B6A' : 'transparent', color: active ? '#FF9B72' : '#FFF4EC', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600 }),
  prodGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, overflowY: 'auto', maxHeight: '40vh' },
  prodCard: { background: '#17354F', border: '1.5px solid #294F6C', borderRadius: 10, padding: '10px 10px 8px', position: 'relative' },
  prodName: { fontSize: 12, fontWeight: 600, marginBottom: 4 },
  prodPrice: { fontSize: 13, color: '#FF6B2C', fontWeight: 700 },
  addBtn: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 6, background: '#FF6B2C', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 },
  input: { width: '100%', background: '#17354F', border: '1.5px solid #294F6C', borderRadius: 8, padding: '9px 12px', color: '#FFF4EC', fontSize: 14, marginBottom: 10, boxSizing: 'border-box' },
  contaBox: { marginBottom: 16 },
  contaRow: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 14 },
  contaTotal: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 17, fontWeight: 800, borderTop: '1px solid #294F6C', marginTop: 6 },
  serviceToggle: { display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0', fontSize: 13, cursor: 'pointer' },
  bottomTabs: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#142F49', borderTop: '1.5px solid #294F6C', display: 'flex', zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom,0)' },
  tabBtn: (active) => ({ flex: 1, padding: '10px 4px 8px', background: 'none', border: 'none', color: active ? '#FF9B72' : '#FFF4EC', cursor: 'pointer', fontSize: 10, fontWeight: active ? 700 : 400, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, opacity: active ? 1 : 0.55 }),
  tabIcon: { fontSize: 18 },
  vendasList: { display: 'flex', flexDirection: 'column', gap: 8 },
  vendaRow: { background: '#17354F', border: '1px solid #294F6C', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
}

const PAY_OPTIONS = [
  { key: 'pix', icon: '📲', label: 'Pix' },
  { key: 'tef', icon: '💳', label: 'Maquininha' },
  { key: 'cartao', icon: '🌐', label: 'Cartão online' },
  { key: 'dinheiro', icon: '💵', label: 'Dinheiro' },
  { key: 'carteira', icon: '👛', label: 'Carteira' },
  { key: 'conta', icon: '📒', label: 'Na conta' },
]

const TABS = [
  { key: 'mesas', icon: '🍽', label: 'Mesas' },
  { key: 'offline', icon: '📡', label: 'Contingência' },
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
  const bgStatus = m.status === 'conta' ? '#FF6B2C' : m.status === 'ocupada' ? '#294F6C' : '#142F49'
  const clrStatus = m.status === 'conta' ? '#000' : '#FF9B72'
  const label = m.status === 'livre' ? 'livre' : m.status === 'conta' ? 'conta' : 'ocupada'
  return (
    <div style={{ background: m.status === 'ocupada' ? '#17354F' : m.status === 'conta' ? '#3a2800' : '#142F49', border: '1.5px solid ' + (m.status === 'conta' ? '#FF6B2C' : m.status === 'ocupada' ? '#FF6B2C' : '#294F6C'), borderRadius: 10, padding: '10px 8px', cursor: 'pointer', textAlign: 'center', position: 'relative', transition: 'transform .12s, box-shadow .12s', animation: m.status === 'conta' ? 'pulse-gold 1.4s ease-in-out infinite' : 'none' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
      onClick={onClick}>
      {m.aguardandoCozinha && <span style={{ position: 'absolute', top: 4, right: 6, fontSize: 14 }} title="Aguardando cozinha">🔥</span>}
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{m.num}</div>
      <div style={{ fontSize: 10, opacity: 0.55, marginTop: 2 }}>{m.tipo || 'Mesa'}</div>
      {m.status !== 'livre' && <div style={{ fontSize: 13, fontWeight: 700, color: '#FF9B72', marginTop: 4 }}>{fmtR(m.total || 0)}</div>}
      {m.nome && <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>{m.nome}</div>}
      {tempoAberto && <div style={{ fontSize: 9, color: '#FF6B2C', fontWeight: 700, marginTop: 2 }}>{'⏱ ' + tempoAberto}</div>}
      <div style={{ fontSize: 9, marginTop: 4, padding: '2px 6px', borderRadius: 4, background: bgStatus, color: clrStatus, display: 'inline-block' }}>{label}</div>
    </div>
  )
}

export default function PDV() {
  const { toast } = useToast()
  const { user, lojaAtiva } = useAuth()
  const [mesas, setMesas] = useState({ fisicas: [], virtuais: [] })
  const [cardapio, setCardapio] = useState([])
  const [combos, setCombos] = useState([])
  const [comanda, setComanda] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [overlay, setOverlay] = useState(null)
  const [catFiltro, setCatFiltro] = useState('Tudo')
  const [payMeio, setPayMeio] = useState('pix')
  const [servico, setServico] = useState(true)

  // TEF (maquininha): config do agente + modalidade/parcelas escolhidas no pagamento
  const [tefCfg, setTefCfg] = useState(null)
  const [tefModalidade, setTefModalidade] = useState('credito_avista')
  const [tefParcelas, setTefParcelas] = useState(2)
  const [tefProcessando, setTefProcessando] = useState(false)

  // CPF na nota (NFC-e) — opcional, informado no fechamento
  const [cpfNota, setCpfNota] = useState('')
  const [novaVirtual, setNovaVirtual] = useState({ nome: '', local: '' })
  const [novaMesaNome, setNovaMesaNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('mesas')
  const [carrinhoOffline, setCarrinhoOffline] = useState([])
  const [pagamentoOffline, setPagamentoOffline] = useState('dinheiro')
  const [processandoOffline, setProcessandoOffline] = useState(false)
  const [resumoOffline, setResumoOffline] = useState({ total: 0, pendente: 0, falha: 0 })

  // Busca de mesa
  const [buscaMesa, setBuscaMesa] = useState('')

  // Desconto
  const [descPct, setDescPct] = useState(0)

  // Sangria/Suprimento
  const [caixaMov, setCaixaMov] = useState({ tipo: 'sangria', valor: '', motivo: '' })

  // Item obs modal
  const [itemObs, setItemObs] = useState({ prod: null, obs: '', qtd: 1, grupos: [], selecoes: [] })

  // Troco
  const [valorRecebido, setValorRecebido] = useState('')

  // Divisão de conta
  const [dividir, setDividir] = useState(1)

  // Múltiplos meios de pagamento
  const [multiPag, setMultiPag] = useState([])
  const [multiPagValor, setMultiPagValor] = useState('')
  const [multiPagMeio, setMultiPagMeio] = useState('pix')
  const [clientesConta, setClientesConta] = useState([])
  const [clienteContaId, setClienteContaId] = useState('')
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
      const data = await api.get(barPath('/mesas'))
      setMesas({
        fisicas: asArray(data, ['fisicas', 'mesas']),
        virtuais: asArray(data, ['virtuais']),
      })
    } catch { /* silencioso */ }
  }, [])

  const loadCardapio = useCallback(async () => {
    const chaveCache = `kytto_pdv_catalogo_${lojaAtiva?.id || 'padrao'}`
    try {
      const [data, dadosCombos] = await Promise.all([api.get(barPath('/cardapio')), api.get('/api/combos').catch(() => ({ combos: [] }))])
      const itens = asArray(data, ['itens', 'produtos', 'cardapio']).filter(p => p && !p.indisponivel)
      setCardapio(itens)
      setCombos(Array.isArray(dadosCombos?.combos) ? dadosCombos.combos : [])
      localStorage.setItem(chaveCache, JSON.stringify({ atualizado_em: new Date().toISOString(), itens }))
    } catch {
      try {
        const cache = JSON.parse(localStorage.getItem(chaveCache) || 'null')
        if (Array.isArray(cache?.itens)) setCardapio(cache.itens)
      } catch { /* cache indisponível */ }
    }
  }, [lojaAtiva?.id])

  const loadComanda = useCallback(async (id) => {
    if (!id) return
    try {
      const data = await api.get(barPath(`/comanda/${id}`))
      setComanda(data)
    } catch { /* silencioso */ }
  }, [])

  const loadClientesConta = useCallback(async () => {
    try {
      const data = await api.get(barAdminPath('/clientes'))
      const elegiveis = (data?.clientes || []).filter(cliente => !cliente.padrao && cliente.status !== 'deletado')
      setClientesConta(elegiveis)
      setClienteContaId(atual => atual && elegiveis.some(cliente => cliente.id === atual) ? atual : (elegiveis[0]?.id || ''))
    } catch { setClientesConta([]) }
  }, [])

  const loadCaixaHoje = useCallback(async () => {
    try {
      const data = await api.get(barPath('/caixa/hoje'))
      setCaixaHoje(data)
    } catch { /* silencioso */ }
  }, [])

  const loadVendas = useCallback(async () => {
    setVendasLoading(true)
    try {
      const data = await api.get(barPath('/vendas?hoje=1'))
      setVendas(Array.isArray(data) ? data : (data.vendas || []))
    } catch { /* silencioso */ }
    finally { setVendasLoading(false) }
  }, [])

  useEffect(() => {
    loadMesas()
    loadCardapio()
    loadClientesConta()
    loadCaixaHoje()
    // Config do TEF (agente local, adquirente, parcelamento). Sem agenteUrl, o pagamento fica bloqueado.
    api.get('/api/admin/config').then(cfg => setTefCfg(cfg?.tef || {})).catch(() => setTefCfg({}))
    timerRef.current = setInterval(() => {
      loadMesas()
      loadCaixaHoje()
    }, 8000)
    return () => clearInterval(timerRef.current)
  }, [loadMesas, loadCardapio, loadClientesConta, loadCaixaHoje])

  useEffect(() => {
    if (!comanda?.id) return undefined
    const sincronizador = setInterval(() => loadComanda(comanda.id), 6000)
    return () => clearInterval(sincronizador)
  }, [comanda?.id, loadComanda])

  const atualizarResumoOffline = useCallback(async () => {
    try { setResumoOffline(await resumoFilaOffline()) } catch { /* IndexedDB indisponível */ }
  }, [])

  useEffect(() => {
    if (activeTab === 'vendas') loadVendas()
    if (activeTab === 'offline') atualizarResumoOffline()
  }, [activeTab, loadVendas, atualizarResumoOffline])

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
  const adicionalItemObs = (itemObs.selecoes || []).reduce((soma, selecao) => {
    const grupo = (itemObs.grupos || []).find(item => item.id === selecao.grupoId)
    const opcao = (grupo?.opcoes || []).find(item => item.id === selecao.opcaoId)
    return soma + Number(opcao?.precoAdicional || 0)
  }, 0)

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
      await api.post(barPath(`/mesa/${sheet.num}/pedir`), { itens: [], nome: novaMesaNome || undefined })
      await loadMesas()
      toast('Comanda aberta!', 'success')
      const mesasData = await api.get(barPath('/mesas'))
      setMesas(mesasData)
      const m = mesasData.fisicas.find(x => x.num === sheet.num)
      if (m?.comandaId) {
        setSheet({ tipo: 'fisica', num: m.num, id: m.comandaId })
        const cmd = await api.get(barPath(`/comanda/${m.comandaId}`))
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
      const data = await api.post(barPath('/mesa-virtual'), novaVirtual)
      await loadMesas()
      toast('Comanda virtual criada!', 'success')
      setSheet({ tipo: 'virtual', id: data.id })
      const cmd = await api.get(barPath(`/comanda/${data.id}`))
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
  const abrirObsItem = async (prod) => {
    setItemObs({ prod, obs: '', qtd: getQtd(prod.id), grupos: [], selecoes: [] })
    setOverlay('obs-item')
    try {
      const resposta = await api.get(barPath(`/cardapio/${prod.id}/modificadores`))
      setItemObs(atual => atual.prod?.id === prod.id ? { ...atual, grupos: Array.isArray(resposta?.grupos) ? resposta.grupos : [] } : atual)
    } catch (erro) { toast(erro.message || 'Não foi possível carregar os adicionais do item.', 'error') }
  }

  const alternarModificador = (grupo, opcao) => {
    setItemObs(atual => {
      const selecoes = Array.isArray(atual.selecoes) ? atual.selecoes : []
      const existe = selecoes.some(selecao => selecao.grupoId === grupo.id && selecao.opcaoId === opcao.id)
      if (existe) return { ...atual, selecoes: selecoes.filter(selecao => !(selecao.grupoId === grupo.id && selecao.opcaoId === opcao.id)) }
      const doGrupo = selecoes.filter(selecao => selecao.grupoId === grupo.id)
      if (doGrupo.length >= Number(grupo.maximo || 1)) { toast(`Máximo de ${grupo.maximo || 1} opção(ões) em ${grupo.nome}.`, 'error'); return atual }
      return { ...atual, selecoes: [...selecoes, { grupoId: grupo.id, opcaoId: opcao.id }] }
    })
  }

  // Confirmar adição com observação e modificadores estruturados
  const confirmarAdicionarItem = async () => {
    if (!itemObs.prod) return
    const sucesso = await adicionarItem(itemObs.prod.id, itemObs.qtd || 1, itemObs.obs, itemObs.selecoes || [])
    if (!sucesso) return
    setOverlay('cardapio')
    setItemObs({ prod: null, obs: '', qtd: 1, grupos: [], selecoes: [] })
  }

  // Lançamento rápido: abre configuração sempre que o produto possuir grupos de modificadores.
  const lancamentoRapido = async (prod) => {
    if (!comanda?.id) return
    if ((prod.modificadorGrupoIds || []).length) { await abrirObsItem(prod); return }
    const qtd = getQtd(prod.id)
    await adicionarItem(prod.id, qtd, '')
    setQtdMap(prev => ({ ...prev, [prod.id]: 1 }))
  }

  const lancarCombo = async (combo) => {
    if (!comanda?.id) return
    try {
      const resposta = await api.post(barPath(`/comanda/${comanda.id}/adicionar`), { itens: [{ comboId: combo.id, qtd: 1 }] })
      if (resposta?.offlineQueued) { toast('Combo salvo offline; será sincronizado ao reconectar.', 'success'); return }
      await loadComanda(comanda.id); await loadMesas(); toast(`Combo “${combo.nome}” adicionado!`, 'success')
    } catch (erro) { toast(erro.message || 'Não foi possível lançar o combo.', 'error') }
  }

  // Adicionar item
  const adicionarItem = async (produtoId, qtd = 1, obs = '', modificadores = []) => {
    if (!comanda?.id) return false
    try {
      const resposta = await api.post(barPath(`/comanda/${comanda.id}/adicionar`), { itens: [{ produtoId, qtd, obs, modificadores }] })
      if (resposta?.offlineQueued) { toast('Item salvo offline; será sincronizado ao reconectar.', 'success'); return true }
      await loadComanda(comanda.id)
      await loadMesas()
      toast('Item adicionado!', 'success')
      return true
    } catch (e) {
      toast(e.message || 'Erro ao adicionar', 'error')
      return false
    }
  }

  // Bipe de leitor de código de barras ou balança de checkout (EAN-13 Prefixo 2)
  const handleBipeCodigoBarras = async (e) => {
    if (e.key !== 'Enter' || !buscaCardapio.trim()) return;
    const codigo = buscaCardapio.trim();

    // Caso 1: Código de balança EAN-13 iniciando com 2 (2 + 5 dig PLU + 5 dig peso/preço + 1 dig DV)
    if (codigo.length === 13 && codigo.startsWith('2')) {
      const plu = codigo.slice(1, 6).replace(/^0+/, '');
      const gramas = parseInt(codigo.slice(6, 12), 10);
      const pesoKg = gramas > 0 ? Number((gramas / 1000).toFixed(3)) : 1;
      const prod = cardapio.find(p => String(p.plu || p.sku || '').endsWith(plu) || String(p.id).includes(plu) || p.pesavel);
      if (prod) {
        if (comanda?.id) {
          await adicionarItem(prod.id, pesoKg, `Pesável balança: ${pesoKg}kg`);
        } else {
          setCarrinhoOffline(atual => [
            ...atual,
            {
              produto_id: prod.produto_id || prod.id,
              nome: `${prod.nome} (${pesoKg}kg)`,
              quantidade: pesoKg,
              valor_unitario: Number(prod.preco || prod.preco_venda || 0),
              desconto_item: 0
            }
          ]);
        }
        toast(`Balança: ${prod.nome} (${pesoKg}kg) adicionado com sucesso!`, 'success');
        setBuscaCardapio('');
        return;
      }
    }

    // Caso 2: EAN convencional, SKU ou código exato
    const prodExato = cardapio.find(p => p.ean === codigo || p.sku === codigo || p.codigo_barras === codigo || String(p.id) === codigo);
    if (prodExato) {
      if (comanda?.id) {
        await lancamentoRapido(prodExato);
      } else {
        adicionarAoCarrinhoOffline(prodExato);
      }
      toast(`${prodExato.nome} bipado com sucesso!`, 'success');
      setBuscaCardapio('');
      return;
    }
  };

  // Venda direta de contingência. Ela não altera comandas abertas para evitar
  // duplicidade de estoque; cada evento é entregue ao agente local de forma idempotente.
  const totalCarrinhoOffline = carrinhoOffline.reduce((soma, item) => soma + item.quantidade * item.valor_unitario, 0)

  const adicionarAoCarrinhoOffline = (produto) => {
    const produtoId = produto.produto_id || produto.id
    setCarrinhoOffline((atual) => {
      const existente = atual.find((item) => item.produto_id === produtoId)
      if (existente) return atual.map((item) => item.produto_id === produtoId ? { ...item, quantidade: item.quantidade + 1 } : item)
      return [...atual, {
        produto_id: produtoId,
        nome: produto.nome,
        quantidade: 1,
        valor_unitario: Number(produto.preco || produto.preco_venda || 0),
        desconto_item: 0,
      }]
    })
  }

  const alterarQuantidadeOffline = (produtoId, diferenca) => {
    setCarrinhoOffline((atual) => atual
      .map((item) => item.produto_id === produtoId ? { ...item, quantidade: Math.max(0, item.quantidade + diferenca) } : item)
      .filter((item) => item.quantidade > 0))
  }

  const finalizarVendaOffline = async () => {
    const operadorId = user?.id || user?.usuario_id || user?.user_id
    if (!operadorId) { toast('Sessão de operador inválida para venda offline.', 'error'); return }
    if (carrinhoOffline.length === 0 || totalCarrinhoOffline <= 0) { toast('Inclua ao menos um item no carrinho de contingência.', 'error'); return }
    if (pagamentoOffline === 'pix') { toast('PIX não pode ser concluído em contingência sem confirmação online.', 'error'); return }

    setProcessandoOffline(true)
    try {
      let referenciaExterna = null
      if (pagamentoOffline === 'tef') {
        const tef = await pagarTef({ valor: totalCarrinhoOffline, modalidade: tefModalidade, parcelas: tefParcelas, tef: tefCfg || {} })
        referenciaExterna = tef?.nsu || tef?.referencia || null
        if (!referenciaExterna) throw new Error('A autorização TEF não retornou uma referência segura')
      }

      const evento = await enfileirarVendaOffline({
        usuario_vendedor_id: operadorId,
        itens: carrinhoOffline.map(({ produto_id, quantidade, valor_unitario, desconto_item }) => ({ produto_id, quantidade, valor_unitario, desconto_item })),
        pagamentos: [{ tipo: pagamentoOffline, valor: Number(totalCarrinhoOffline.toFixed(2)), status: 'aprovado', referencia_externa: referenciaExterna }],
        observacoes: `Venda direta em contingência${lojaAtiva?.nome ? ` — ${lojaAtiva.nome}` : ''}`,
      })

      let mensagem = `Venda ${evento.id.slice(0, 8)} preservada na fila local.`
      try {
        const entrega = await entregarFilaAoAgente()
        mensagem = entrega.entregue > 0
          ? 'Venda capturada e entregue com segurança ao agente local.'
          : mensagem
      } catch {
        mensagem = 'Venda preservada localmente; será sincronizada quando o agente retornar.'
      }

      setCarrinhoOffline([])
      await atualizarResumoOffline()
      toast(mensagem, 'success')
    } catch (erro) {
      toast(erro?.message || 'Não foi possível registrar a venda de contingência.', 'error')
    } finally {
      setProcessandoOffline(false)
    }
  }

  // Cancelar item individual
  const cancelarItem = async (idx) => {
    if (!comanda?.id) return
    if (!window.confirm('Remover este item da comanda?')) return
    try {
      await api.delete(barPath(`/comanda/${comanda.id}/item/${idx}`))
      await loadComanda(comanda.id)
      await loadMesas()
      toast('Item removido', 'success')
    } catch (e) {
      // fallback: tentar POST
      try {
      await api.post(barPath(`/comanda/${comanda.id}/cancelar-item`), { idx })
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
      await api.post(barPath(`/comanda/${comanda.id}/conta`), {})
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
    // Maquininha (TEF): captura no pinpad ANTES de fechar a venda. Se negar/falhar,
    // a comanda permanece aberta. (fluxo de meio único)
    let tefResult = null
    if (payMeio === 'tef' && multiPag.length === 0) {
      setTefProcessando(true)
      try {
        tefResult = await pagarTef({ valor: totalFinal, modalidade: tefModalidade, parcelas: tefParcelas, tef: tefCfg || {} })
      } catch (e) {
        setTefProcessando(false)
        toast(e.message || 'Falha na maquininha — venda mantida em aberto', 'error')
        return
      }
      setTefProcessando(false)
    }
    setLoading(true)
    try {
      // Se há múltiplos meios registrados, envia todos; senão envia o único selecionado.
      // Quando ainda existir saldo, registra somente a parcela e mantém a comanda em conta.
      const cpf = cpfNota.replace(/\D/g, '') || undefined
      const registrarParcial = multiPag.length > 0 && restanteMultiPag > 0.01
      const payload = multiPag.length > 0 && restanteMultiPag < 0.01
        ? {
            meios: multiPag,
            meio: multiPag[0]?.meio || payMeio,
            desconto: descPct > 0 ? descPct : undefined,
            servico,
            totalFinal,
            cpf,
          }
        : {
            meio: payMeio,
            clienteId: payMeio === 'conta' ? clienteContaId : undefined,
            desconto: descPct > 0 ? descPct : undefined,
            servico,
            totalFinal,
            dividir: dividir > 1 ? dividir : undefined,
            tef: tefResult || undefined,
            cpf,
          }
      const resposta = registrarParcial
        ? await api.post(barPath(`/comanda/${comanda.id}/pagamento-parcial`), { ...payload, meios: multiPag, totalFinal })
        : await api.post(barPath(`/comanda/${comanda.id}/pagar`), payload)
      if (registrarParcial && !resposta.quitada) {
        toast(`Parcela registrada. Saldo pendente: ${fmtR(resposta.saldoPendente)}`, 'success')
        setComanda(resposta.comanda)
        setMultiPag([])
        setMultiPagValor('')
        setOverlay(null)
        await loadMesas()
        await loadCaixaHoje()
        return
      }
      toast(tefResult
        ? `Pago na maquininha ✓ NSU ${tefResult.nsu}`
        : 'Pagamento registrado! ✓', 'success')
      setOverlay(null)
      setSheet(null)
      setComanda(null)
      setDescPct(0)
      setValorRecebido('')
      setDividir(1)
      setCpfNota('')
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
      await api.post(barPath('/caixa/movimento'), {
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

  // Imprimir comanda: prioriza o agente local homologado e mantém o navegador como contingência.
  const imprimirComanda = async () => {
    if (!comanda) return
    const itens = comanda.itens || []
    const linhasAgente = itens.map(it => ({
      esquerda: `${it.qtd}× ${it.nome}${it.obs ? ` (${it.obs})` : ''}`,
      direita: fmtR((it.preco || 0) * (it.qtd || 1)),
    }))
    const linhas = itens.map(it =>
      `<tr><td>${it.qtd}× ${it.nome}${it.obs ? ` <small>(${it.obs})</small>` : ''}</td><td style="text-align:right">${fmtR((it.preco || 0) * (it.qtd || 1))}</td></tr>`
    ).join('')
    const mesa = sheet?.tipo === 'fisica' ? `Mesa ${sheet.num}` : (comanda.mesa || `Comanda #${comanda.id}`)
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const conteudoAgente = {
      titulo: 'KY TTO ERP',
      subtitulo: `${mesa} — ${hora}`,
      linhas: [
        ...linhasAgente,
        ...(descPct > 0 ? [{ esquerda: `Desconto ${descPct}%`, direita: `-${fmtR(descVal)}` }] : []),
        ...(servico ? [{ esquerda: 'Serviço 10%', direita: fmtR(servicoVal) }] : []),
      ],
      total: `TOTAL ${fmtR(totalFinal)}`,
      rodape: 'Obrigado pela preferência!',
    }

    try {
      await imprimirViaAgenteLocal({ conteudo: conteudoAgente })
      toast('Comanda enviada à impressora local.', 'success')
      return
    } catch {
      toast('Agente local indisponível; abrindo impressão do navegador.', 'warning')
    }

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
      <h2>Kytto ERP</h2>
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
          0%,100% { box-shadow: 0 0 0 0 rgba(255,107,44,.5); }
          50% { box-shadow: 0 0 0 8px rgba(255,107,44,0); }
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #294F6C; border-radius: 4px; }
        @media print { body * { visibility: hidden; } }
      `}</style>

      {/* Banner resumo caixa */}
      <div style={S.banner}>
        <div style={S.bannerStat}>
          <span style={S.bannerLabel}>Abertura</span>
          <span style={{ ...S.bannerValSmall, color: '#FFF4EC' }}>{fmtR(caixaHoje.abertura || 0)}</span>
        </div>
        <div style={S.bannerStat}>
          <span style={S.bannerLabel}>Sangrias</span>
          <span style={{ ...S.bannerValSmall, color: '#e74c3c' }}>-{fmtR(caixaHoje.sangrias || 0)}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#FFF4EC', lineHeight: 1 }}>PDV</div>
          <div style={{ fontSize: 10, opacity: 0.55, marginTop: 2 }}>{abertas.length} mesa{abertas.length !== 1 ? 's' : ''} abertas</div>
        </div>
        <div style={S.bannerStat}>
          <span style={S.bannerLabel}>Vendas</span>
          <span style={{ ...S.bannerValSmall, color: '#FF9B72' }}>{caixaHoje.numerosOcultos ? '•••' : fmtR(caixaHoje.vendas || 0)}</span>
        </div>
        <div style={S.bannerStat}>
          <span style={S.bannerLabel}>Saldo est.</span>
          <span style={{ ...S.bannerValSmall, color: '#FF6B2C' }}>{caixaHoje.numerosOcultos ? '•••' : fmtR(caixaHoje.saldo || 0)}</span>
        </div>
        {/* Botão Sangria/Suprimento */}
        <button
          onClick={() => { setCaixaMov({ tipo: 'sangria', valor: '', motivo: '' }); setOverlay('caixa-mov') }}
          style={{ background: '#294F6C', border: '1.5px solid #FF6B2C', borderRadius: 8, color: '#FFF4EC', fontSize: 11, padding: '5px 9px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
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
                  { label: 'Livres', count: (mesas.fisicas||[]).filter(m=>m.status==='livre').length, color: '#294F6C', text: '#A9C3D6' },
                  { label: 'Ocupadas', count: (mesas.fisicas||[]).filter(m=>m.status==='ocupada').length, color: '#254B6A', text: '#FF9B72' },
                  { label: 'Conta', count: (mesas.fisicas||[]).filter(m=>m.status==='conta').length, color: '#3a2800', text: '#FF6B2C' },
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

      {/* Aba de contingência: somente vendas diretas, sem manipular comandas em aberto. */}
      {activeTab === 'offline' && (
        <div style={S.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={S.sectionTitle}>Venda direta em contingência</div>
              <div style={{ fontSize: 12, opacity: .68, maxWidth: 650, marginTop: 4 }}>
                Registre apenas operações novas quando a conexão com o servidor estiver indisponível. A venda é guardada no navegador e transferida ao agente local antes da sincronização.
              </div>
            </div>
            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 10px' }} onClick={atualizarResumoOffline}>Atualizar fila</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 8, marginBottom: 16 }}>
            <div style={{ background: '#17354F', border: '1px solid #294F6C', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11, opacity: .6 }}>Eventos na fila</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{resumoOffline.total || 0}</div>
            </div>
            <div style={{ background: '#17354F', border: '1px solid #294F6C', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11, opacity: .6 }}>Pendentes locais</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#FF6B2C' }}>{resumoOffline.pendente || 0}</div>
            </div>
            <div style={{ background: '#17354F', border: '1px solid #294F6C', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11, opacity: .6 }}>Com falha de entrega</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: resumoOffline.falha ? '#e74c3c' : '#FF9B72' }}>{resumoOffline.falha || 0}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(280px, .9fr)', gap: 14, alignItems: 'start' }}>
            <div style={{ background: '#18374F', border: '1px solid #294F6C', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Catálogo disponível localmente</div>
              {cardapio.length === 0 ? (
                <div style={{ fontSize: 12, opacity: .6, padding: 14 }}>Nenhum catálogo está disponível em cache. Conecte-se uma vez para atualizar os produtos deste terminal.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, maxHeight: 430, overflowY: 'auto', paddingRight: 3 }}>
                  {cardapio.map((produto) => (
                    <button key={produto.produto_id || produto.id} type="button" onClick={() => adicionarAoCarrinhoOffline(produto)} style={{ textAlign: 'left', cursor: 'pointer', color: '#FFF4EC', background: '#17354F', border: '1px solid #294F6C', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 17, marginBottom: 3 }}>{prodEmoji(produto)}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.25 }}>{produto.nome}</div>
                      <div style={{ fontSize: 12, color: '#FF9B72', fontWeight: 700, marginTop: 5 }}>{fmtR(produto.preco || produto.preco_venda || 0)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: '#17354F', border: '1px solid #12283F', borderRadius: 10, padding: 12, position: 'sticky', top: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderBottom: '1px solid #294F6C', paddingBottom: 9, marginBottom: 8 }}>
                <strong>Carrinho de contingência</strong>
                <span style={{ fontSize: 12, opacity: .65 }}>{carrinhoOffline.reduce((soma, item) => soma + item.quantidade, 0)} itens</span>
              </div>
              {carrinhoOffline.length === 0 ? (
                <div style={{ fontSize: 12, opacity: .6, padding: '16px 0' }}>Selecione itens do catálogo para iniciar uma venda direta.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, maxHeight: 220, overflowY: 'auto' }}>
                  {carrinhoOffline.map((item) => (
                    <div key={item.produto_id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{item.nome}</div>
                        <div style={{ fontSize: 11, opacity: .6 }}>{fmtR(item.valor_unitario)} cada</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <button type="button" onClick={() => alterarQuantidadeOffline(item.produto_id, -1)} style={{ width: 25, height: 25, borderRadius: 5, border: '1px solid #456', background: '#142F49', color: '#FFF4EC', cursor: 'pointer' }}>−</button>
                        <span style={{ minWidth: 18, textAlign: 'center', fontSize: 12 }}>{item.quantidade}</span>
                        <button type="button" onClick={() => alterarQuantidadeOffline(item.produto_id, 1)} style={{ width: 25, height: 25, borderRadius: 5, border: '1px solid #456', background: '#142F49', color: '#FFF4EC', cursor: 'pointer' }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #294F6C', paddingTop: 10, fontSize: 17, fontWeight: 800 }}>
                <span>Total</span><span style={{ color: '#FF9B72' }}>{fmtR(totalCarrinhoOffline)}</span>
              </div>
              <div style={{ fontSize: 12, margin: '13px 0 7px', opacity: .75 }}>Pagamento já autorizado</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
                {[['dinheiro', 'Dinheiro'], ['tef', 'TEF local'], ['carteira', 'Vale']].map(([tipo, label]) => (
                  <button key={tipo} type="button" onClick={() => setPagamentoOffline(tipo)} style={{ border: pagamentoOffline === tipo ? '1.5px solid #FF9B72' : '1px solid #294F6C', background: pagamentoOffline === tipo ? '#294F6C' : '#142F49', color: '#FFF4EC', borderRadius: 7, padding: '7px 4px', cursor: 'pointer', fontSize: 11, fontWeight: pagamentoOffline === tipo ? 700 : 400 }}>{label}</button>
                ))}
              </div>
              {pagamentoOffline === 'tef' && <div style={{ fontSize: 11, color: '#FF6B2C', margin: '-5px 0 10px' }}>A autorização TEF local será solicitada antes de salvar o evento.</div>}
              <button className="btn btn-primary" type="button" disabled={processandoOffline || carrinhoOffline.length === 0} onClick={finalizarVendaOffline} style={{ width: '100%', opacity: processandoOffline || carrinhoOffline.length === 0 ? .55 : 1 }}>
                {processandoOffline ? 'Registrando venda...' : 'Registrar venda de contingência'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={async () => {
                try {
                  const entrega = await entregarFilaAoAgente()
                  await atualizarResumoOffline()
                  toast(entrega.entregue ? `${entrega.entregue} evento(s) entregue(s) ao agente.` : 'Não há eventos pendentes para entregar.', 'success')
                } catch (erro) {
                  toast(erro?.message || 'Agente local indisponível.', 'warning')
                }
              }} style={{ width: '100%', marginTop: 8, fontSize: 12 }}>
                Tentar entregar fila ao agente
              </button>
            </div>
          </div>
        </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                <div style={{ background: '#153550', border: '1px solid #294F6C', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, opacity: 0.62, textTransform: 'uppercase', fontWeight: 800 }}>Total do dia</div>
                  <strong style={{ display: 'block', color: '#FF9B72', marginTop: 4, fontSize: 17 }}>{fmtR(vendas.reduce((s, v) => s + Number(v.total || v.valor || 0), 0))}</strong>
                </div>
                <div style={{ background: '#153550', border: '1px solid #294F6C', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, opacity: 0.62, textTransform: 'uppercase', fontWeight: 800 }}>Comandas pagas</div>
                  <strong style={{ display: 'block', color: '#fff', marginTop: 4, fontSize: 17 }}>{vendas.length}</strong>
                </div>
                <div style={{ background: '#153550', border: '1px solid #294F6C', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, opacity: 0.62, textTransform: 'uppercase', fontWeight: 800 }}>Ticket médio</div>
                  <strong style={{ display: 'block', color: '#fff', marginTop: 4, fontSize: 17 }}>{fmtR(vendas.reduce((s, v) => s + Number(v.total || v.valor || 0), 0) / vendas.length)}</strong>
                </div>
              </div>
              <div style={{ fontSize: 11, opacity: 0.55, padding: '0 4px 7px', borderBottom: '1px solid #294F6C' }}>Comandas fechadas hoje</div>
              {vendas.map((v, i) => (
                <div key={v.id || i} style={S.vendaRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.mesa || v.cliente || v.nome || `Comanda #${v.id}`}</div>
                    <div style={{ fontSize: 11, opacity: 0.62, marginTop: 2 }}>
                      {fmtMeio(v.formaPagamento || v.meio || v.meioPagamento)} · {Array.isArray(v.itens) ? `${v.itens.reduce((s, item) => s + Number(item.qtd || item.quantidade || 1), 0)} item(ns)` : '—'} · {v.fechadoEm ? new Date(v.fechadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, color: '#FF9B72', whiteSpace: 'nowrap' }}>{fmtR(v.total || v.valor || 0)}</div>
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
                    <span style={{ fontSize: 10, fontWeight: 800, background: '#FF6B2C', color: '#12283F', borderRadius: 10, padding: '2px 7px' }}>
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
                  style={{ background: 'linear-gradient(135deg,#FF6B2C,#2D6F9E)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', padding: '5px 12px', whiteSpace: 'nowrap' }}>
                  + Lançar
                </button>
                <button title="Imprimir comanda" onClick={imprimirComanda}
                  style={{ background: 'none', border: '1px solid #294F6C', borderRadius: 6, color: '#FFF4EC', fontSize: 16, cursor: 'pointer', padding: '3px 7px' }}>
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
                    style={{ background: 'linear-gradient(135deg,#FF6B2C,#2D6F9E)', border: 'none', borderRadius: 10, color: '#fff', padding: '12px 28px', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                    ➕ Lançar primeiro item
                  </button>
                </div>
              ) : (
                <>
                  {comanda.itens.map((it, i) => (
                    <div key={i} style={{ ...S.itemRow, alignItems: 'center' }}>
                      <div style={{ ...S.itemQty, background: it.status === 'cancelado' ? '#3a1a1a' : '#294F6C' }}>{it.qtd}</div>
                      <div style={S.itemName}>
                        <span style={{ textDecoration: it.status === 'cancelado' ? 'line-through' : 'none', opacity: it.status === 'cancelado' ? 0.4 : 1 }}>{it.nome}</span>
                        {it.obs && <div style={{ fontSize: 10, opacity: 0.5, fontStyle: 'italic' }}>💬 {it.obs}</div>}
                      </div>
                      {it.status && it.status !== 'normal' && (
                        <div style={{ ...S.itemStatus, background: it.status === 'entregue' ? '#254B6A' : it.status === 'preparando' ? '#3a2800' : '#294F6C', color: it.status === 'entregue' ? '#FF9B72' : it.status === 'preparando' ? '#FF6B2C' : '#FF9B72' }}>
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
                <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #294F6C' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, opacity: 0.65, marginRight: 4 }}>Desconto:</span>
                    {[0, 5, 10, 15, 20].map(p => (
                      <button key={p} onClick={() => setDescPct(p)}
                        style={{ padding: '3px 9px', borderRadius: 16, border: `1.5px solid ${descPct === p ? '#FF6B2C' : '#294F6C'}`, background: descPct === p ? '#254B6A' : 'transparent', color: descPct === p ? '#FF9B72' : '#FFF4EC', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
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
                    <div style={{ fontSize: 11, color: '#FF9B72', marginTop: 5 }}>
                      Desconto: −{fmtR(descVal)} → Subtotal: {fmtR(subtotalDesc)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé com total visual rico */}
            <div style={{ padding: '8px 16px', borderTop: '1px solid #294F6C', background: '#12283F' }}>
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
                <span style={{ color: '#FF9B72' }}>{fmtR(totalFinal)}</span>
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
            <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid #294F6C', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
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
                  placeholder="Buscar produto, EAN ou bipe de balança (ex: 2001001014859)…"
                  value={buscaCardapio}
                  onKeyDown={handleBipeCodigoBarras}
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
              {combos.filter(combo => !buscaCardapio || combo.nome.toLowerCase().includes(buscaCardapio.toLowerCase())).length > 0 && (catFiltro === 'Tudo' || buscaCardapio) && <section style={{ margin: '5px 0 14px' }}><div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.08em', color: '#FF9B72', marginBottom: 7 }}>COMBOS E PROMOÇÕES</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 10 }}>{combos.filter(combo => !buscaCardapio || combo.nome.toLowerCase().includes(buscaCardapio.toLowerCase())).map(combo => <button key={combo.id} onClick={() => lancarCombo(combo)} style={{ border: '1.5px solid #FF6B2C', borderRadius: 12, padding: 12, cursor: 'pointer', textAlign: 'left', background: 'linear-gradient(135deg,#402114,#12283F)', color: '#FFF4EC' }}><div style={{ fontSize: 23, marginBottom: 4 }}>🎁</div><div style={{ fontWeight: 800, fontSize: 13 }}>{combo.nome}</div><div style={{ opacity: .65, fontSize: 10, margin: '4px 0' }}>{(combo.componentes || []).map(componente => `${componente.qtd}× ${componente.nome}`).join(' · ')}</div><div style={{ color: '#FF6B2C', fontWeight: 900, fontSize: 15 }}>{fmtR(combo.preco)}</div></button>)}</div></section>}
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
                        background: estZero ? '#1a1a1a' : '#12283F',
                        border: `1.5px solid ${estZero ? '#3a1a1a' : estBaixo ? '#FF6B2C60' : '#294F6C'}`,
                        borderRadius: 12, overflow: 'hidden',
                        opacity: estZero ? 0.5 : 1,
                        display: 'flex', flexDirection: 'column',
                        transition: 'border-color .15s',
                      }}>
                        {/* Área visual do produto */}
                        <div style={{
                          background: estZero ? '#2a1a1a' : 'linear-gradient(135deg,#12283F,#12283F)',
                          padding: '14px 12px 10px',
                          display: 'flex', flexDirection: 'column', flex: 1,
                          position: 'relative',
                        }}>
                          {/* Badge estoque */}
                          {p.estoque !== null && p.estoque !== undefined && (
                            <div style={{
                              position: 'absolute', top: 6, right: 6,
                              background: estZero ? '#e74c3c' : estBaixo ? '#FF6B2C' : '#12283F',
                              color: estZero ? '#fff' : estBaixo ? '#000' : '#FF9B72',
                              borderRadius: 8, fontSize: 9, fontWeight: 800,
                              padding: '2px 6px', lineHeight: 1.4,
                            }}>
                              {estZero ? 'SEM' : estBaixo ? `⚠ ${p.estoque}` : `${p.estoque}`}
                            </div>
                          )}
                          {/* Emoji/ícone */}
                          <div style={{ fontSize: 28, marginBottom: 6, lineHeight: 1 }}>{emoji}</div>
                          <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3, color: estZero ? '#888' : '#FFF4EC', marginBottom: 3 }}>{p.nome}</div>
                          {p.cat && <div style={{ fontSize: 10, opacity: 0.45, marginBottom: 4 }}>{p.cat}</div>}
                          <div style={{ fontSize: 15, fontWeight: 800, color: estZero ? '#666' : '#FF6B2C' }}>{fmtR(p.preco)}</div>
                        </div>

                        {/* Controles de quantidade + adicionar */}
                        {!estZero && (
                          <div style={{ padding: '8px 10px', borderTop: '1px solid #294F6C', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {/* Seletor de quantidade */}
                            <button
                              onClick={() => setQtd(p.id, qtd - 1)}
                              style={{ width: 26, height: 26, borderRadius: 6, background: '#17354F', border: '1px solid #294F6C', color: '#FF9B72', fontWeight: 800, fontSize: 16, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>
                              −
                            </button>
                            <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 800, fontSize: 13, color: qtd > 1 ? '#FF6B2C' : '#FFF4EC' }}>{qtd}</span>
                            <button
                              onClick={() => setQtd(p.id, qtd + 1)}
                              style={{ width: 26, height: 26, borderRadius: 6, background: '#17354F', border: '1px solid #294F6C', color: '#FF9B72', fontWeight: 800, fontSize: 16, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>
                              +
                            </button>
                            {/* Botão lançar rápido */}
                            <button
                              onClick={() => lancamentoRapido(p)}
                              title="Lançar na comanda"
                              style={{ flex: 1, height: 26, borderRadius: 6, background: 'linear-gradient(135deg,#FF6B2C,#2D6F9E)', border: 'none', color: '#fff', fontWeight: 800, fontSize: 11.5, cursor: 'pointer', lineHeight: 1, letterSpacing: '.02em' }}>
                              + Lançar
                            </button>
                            {/* Botão com obs */}
                            <button
                              onClick={() => abrirObsItem(p)}
                              title="Adicionar com observação"
                              style={{ width: 26, height: 26, borderRadius: 6, background: '#17354F', border: '1px solid #294F6C', color: '#FF6B2C', fontWeight: 800, fontSize: 13, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>
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
              <div style={{ borderTop: '1px solid #294F6C', background: '#12283F' }}>
                <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#FF9B72' }}>
                    🧾 Lançados ({comanda.itens.reduce((s, i) => s + (i.qtd || 1), 0)})
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#FF6B2C' }}>{fmtR(comanda.total || 0)}</span>
                </div>
                {/* lista rolável dos itens já na comanda */}
                <div style={{ maxHeight: 132, overflowY: 'auto', padding: '0 16px' }}>
                  {comanda.itens.map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #12283F' }}>
                      <span style={{ minWidth: 26, height: 20, borderRadius: 5, background: '#294F6C', color: '#FF9B72', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{it.qtd}×</span>
                      <span style={{ flex: 1, fontSize: 12, color: '#FFF9F5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {it.nome}{it.obs ? <span style={{ color: '#FF9B72', opacity: .7 }}> · {it.obs}</span> : null}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#FF6B2C', flexShrink: 0 }}>{fmtR((it.preco || 0) * (it.qtd || 1))}</span>
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
                    style={{ width: '100%', background: '#254B6A', border: '1.5px solid #FF6B2C', borderRadius: 9, color: '#FF9B72', padding: '9px 0', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>
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
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#12283F,#12283F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                🍽
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{itemObs.prod.nome}</div>
                <div style={{ fontSize: 13, color: '#FF6B2C', fontWeight: 700 }}>{fmtR(itemObs.prod.preco)}</div>
                {itemObs.prod.cat && <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>{itemObs.prod.cat}</div>}
              </div>
            </div>

            {/* Seletor de quantidade */}
            <div style={{ marginBottom: 12, padding: '10px 12px', background: '#17354F', borderRadius: 10, border: '1px solid #294F6C' }}>
              <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 8 }}>Quantidade</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => setItemObs(v => ({ ...v, qtd: Math.max(1, (v.qtd || 1) - 1) }))}
                  style={{ width: 36, height: 36, borderRadius: 8, background: '#294F6C', border: 'none', color: '#FF9B72', fontWeight: 800, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>
                  −
                </button>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#FF6B2C', minWidth: 36, textAlign: 'center' }}>
                  {itemObs.qtd || 1}
                </span>
                <button
                  onClick={() => setItemObs(v => ({ ...v, qtd: Math.min(99, (v.qtd || 1) + 1) }))}
                  style={{ width: 36, height: 36, borderRadius: 8, background: '#294F6C', border: 'none', color: '#FF9B72', fontWeight: 800, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>
                  +
                </button>
                <div style={{ flex: 1, textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#FF9B72' }}>
                  = {fmtR(((itemObs.prod.preco || 0) + adicionalItemObs) * (itemObs.qtd || 1))}
                </div>
              </div>
            </div>

            {/* Modificadores e adicionais */}
            {(itemObs.grupos || []).map(grupo => {
              const selecionados = (itemObs.selecoes || []).filter(selecao => selecao.grupoId === grupo.id).map(selecao => selecao.opcaoId)
              return <div key={grupo.id} style={{ marginBottom: 12, padding: '10px 12px', background: '#17354F', borderRadius: 10, border: '1px solid #294F6C' }}>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 7 }}>{grupo.nome} {grupo.obrigatorio && <span style={{ color: '#FF9B72' }}>*</span>} <span style={{ opacity: .55, fontWeight: 500 }}>({grupo.minimo || 0}–{grupo.maximo || 1})</span></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{(grupo.opcoes || []).map(opcao => {
                  const ativo = selecionados.includes(opcao.id)
                  return <button key={opcao.id} onClick={() => alternarModificador(grupo, opcao)} style={{ border: `1px solid ${ativo ? '#FF6B2C' : '#294F6C'}`, borderRadius: 8, background: ativo ? '#4B2718' : '#12283F', color: ativo ? '#FFF4EC' : '#D9E4EC', padding: '7px 9px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>{ativo ? '✓ ' : ''}{opcao.nome}{Number(opcao.precoAdicional || 0) > 0 ? ` +${fmtR(opcao.precoAdicional)}` : ''}</button>
                })}</div>
              </div>
            })}

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
                  style={{ background: 'none', border: '1px solid #294F6C', borderRadius: 6, color: '#FFF4EC', fontSize: 15, cursor: 'pointer', padding: '3px 7px' }}>
                  🖨
                </button>
                <button style={S.sheetClose} onClick={() => setOverlay(null)}>✕</button>
              </div>
            </div>

            <div style={S.contaBox}>
              {(comanda.itens || []).map((it, i) => (
                <div key={i} style={S.contaRow}>
                  <span>{it.qtd}× {it.nome}</span>
                  <span style={{ color: '#FF6B2C' }}>{fmtR((it.preco || 0) * (it.qtd || 1))}</span>
                </div>
              ))}
              <div style={S.contaRow}>
                <span>Subtotal</span>
                <span>{fmtR(subtotal)}</span>
              </div>
              {descPct > 0 && (
                <div style={{ ...S.contaRow, color: '#FF9B72' }}>
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
                <span style={{ color: '#FF9B72' }}>{fmtR(totalFinal)}</span>
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
            <div style={{ textAlign: 'center', padding: '14px 10px', background: 'linear-gradient(135deg,#12283F,#12283F)', borderRadius: 14, marginBottom: 14, border: '1.5px solid #294F6C' }}>
              {descPct > 0 && (
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>
                  Subtotal {fmtR(subtotal)} − {descPct}% desc. = {fmtR(subtotalDesc)}
                  {servico && ` + 10% serv. = ${fmtR(totalFinal)}`}
                </div>
              )}
              <div style={{ fontSize: 11, opacity: 0.55, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                {sheet?.tipo === 'fisica' ? `Mesa ${sheet?.num}` : comanda?.mesa || `Comanda #${comanda?.id}`}
              </div>
              <div style={{ fontSize: 34, fontWeight: 900, color: '#FF9B72', lineHeight: 1 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 10px', background: '#17354F', borderRadius: 8 }}>
              <span style={{ fontSize: 12, opacity: 0.7, flex: 1 }}>Dividir entre:</span>
              <button onClick={() => setDividir(d => Math.max(1, d - 1))}
                style={{ background: '#294F6C', border: 'none', borderRadius: 6, color: '#FF9B72', width: 28, height: 28, cursor: 'pointer', fontWeight: 800, fontSize: 16 }}>-</button>
              <span style={{ fontWeight: 800, fontSize: 16, minWidth: 24, textAlign: 'center' }}>{dividir}</span>
              <button onClick={() => setDividir(d => d + 1)}
                style={{ background: '#294F6C', border: 'none', borderRadius: 6, color: '#FF9B72', width: 28, height: 28, cursor: 'pointer', fontWeight: 800, fontSize: 16 }}>+</button>
              {dividir > 1 && (
                <span style={{ fontSize: 13, color: '#FF6B2C', fontWeight: 700, marginLeft: 6 }}>
                  = {fmtR(totalFinal / dividir)}/pessoa
                </span>
              )}
            </div>

            <div style={S.payBtns}>
              {PAY_OPTIONS.map(o => (
                <div key={o.key} style={S.payBtn(payMeio === o.key)} onClick={() => { setPayMeio(o.key); setValorRecebido(''); if (o.key !== 'conta') setMultiPag([]) }}>
                  <div>{o.icon}</div>
                  <div style={S.payBtnLabel}>{o.label}</div>
                </div>
              ))}
            </div>

            {/* Lançamento em conta: exige cliente nominal da empresa ativa */}
            {payMeio === 'conta' && multiPag.length === 0 && (
              <div style={{ marginTop: 12, padding: '12px', background: '#3a2800', borderRadius: 10, border: '1px solid #FF6B2C' }}>
                <div style={{ fontSize: 12, color: '#FF9B72', fontWeight: 700, marginBottom: 7 }}>📒 Lançar em conta do cliente</div>
                {clientesConta.length ? (
                  <>
                    <select value={clienteContaId} onChange={e => setClienteContaId(e.target.value)} style={{ ...S.input, marginBottom: 6, cursor: 'pointer' }}>
                      {clientesConta.map(cliente => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
                    </select>
                    <div style={{ fontSize: 11, opacity: .7 }}>A venda será encerrada e a pendência será registrada em Contas a Receber.</div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: '#FF9B72' }}>Cadastre primeiro um cliente nominal para usar esta forma de pagamento.</div>
                )}
              </div>
            )}

            {/* Múltiplos meios de pagamento */}
            {multiPag.length > 0 && (
              <div style={{ marginTop: 12, padding: '8px 10px', background: '#10283F', borderRadius: 8, border: '1px solid #294F6C' }}>
                <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 6 }}>Pagamentos registrados:</div>
                {multiPag.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span>{PAY_OPTIONS.find(o => o.key === p.meio)?.icon} {PAY_OPTIONS.find(o => o.key === p.meio)?.label}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: '#FF9B72', fontWeight: 700 }}>{fmtR(p.valor)}</span>
                      <button onClick={() => setMultiPag(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 12 }}>✕</button>
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #294F6C', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Restante:</span>
                  <span style={{ color: restanteMultiPag > 0 ? '#FF6B2C' : '#FF9B72', fontWeight: 700 }}>{fmtR(Math.max(0, restanteMultiPag))}</span>
                </div>
              </div>
            )}

            {/* Adicionar pagamento parcial */}
            {multiPag.length > 0 && restanteMultiPag > 0.01 && (
              <div style={{ marginTop: 8, padding: '8px 10px', background: '#17354F', borderRadius: 8, border: '1px solid #294F6C' }}>
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
                    style={{ background: '#FF6B2C', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, padding: '0 14px', cursor: 'pointer', fontSize: 13 }}>
                    + Add
                  </button>
                </div>
              </div>
            )}

            {multiPag.length === 0 && (
              <button
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid #294F6C', borderRadius: 8, color: '#FF9B72', padding: '6px 12px', cursor: 'pointer', fontSize: 12, marginTop: 8 }}
                onClick={() => setMultiPag([{ meio: payMeio, valor: parseFloat((totalFinal / 2).toFixed(2)) }])}>
                ➕ Dividir pagamento (2+ meios)
              </button>
            )}

            {/* PIX QR dinâmico */}
            {payMeio === 'pix' && multiPag.length === 0 && (
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={() => setShowPixQR(true)}
                  style={{ width: '100%', background: 'linear-gradient(135deg,#12283F,#254B6A)', border: '2px solid #FF6B2C', borderRadius: 12, color: '#FF9B72', padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  📲 Gerar QR Code PIX — {fmtR(dividir > 1 ? totalFinal / dividir : totalFinal)}
                </button>
                <div style={{ fontSize: 11, opacity: 0.45, textAlign: 'center', marginTop: 6 }}>
                  QR dinâmico · aguarda confirmação automática
                </div>
              </div>
            )}

            {/* Troco calculado para dinheiro */}
            {payMeio === 'dinheiro' && multiPag.length === 0 && (
              <div style={{ marginTop: 12, padding: '12px', background: '#17354F', borderRadius: 10, border: '1px solid #294F6C' }}>
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
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#FF9B72' }}>
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

            {/* Maquininha (TEF): modalidade + parcelas */}
            {payMeio === 'tef' && multiPag.length === 0 && (
              <div style={{ marginTop: 12, padding: '12px', background: '#17354F', borderRadius: 10, border: '1px solid #294F6C' }}>
                <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 8 }}>Modalidade no cartão</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {MODALIDADES_TEF.map(m => (
                    <button key={m.key} onClick={() => setTefModalidade(m.key)}
                      style={{ flex: 1, minWidth: 92, padding: '8px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                        border: tefModalidade === m.key ? '1.5px solid #FF6B2C' : '1px solid #294F6C',
                        background: tefModalidade === m.key ? '#254B6A' : 'transparent',
                        color: tefModalidade === m.key ? '#FF9B72' : '#8AA9C0' }}>
                      {m.icon} {m.label}
                    </button>
                  ))}
                </div>
                {tefModalidade === 'credito_parcelado' && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, opacity: 0.65 }}>Parcelas:</span>
                    <select value={tefParcelas} onChange={e => setTefParcelas(parseInt(e.target.value))}
                      style={{ ...S.input, marginBottom: 0, width: 'auto', padding: '6px 10px' }}>
                      {Array.from({ length: Math.max(2, (tefCfg?.maxParcelas || 12)) - 1 }, (_, i) => i + 2).map(n => (
                        <option key={n} value={n}>{n}x de {fmtR(totalFinal / n)}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ fontSize: 11, opacity: 0.55, marginTop: 8 }}>
                  {tefCfg && !String(tefCfg.agenteUrl || '').trim()
                    ? '⚠️ Agente TEF não configurado — pagamento bloqueado até conectar a maquininha.'
                    : '💳 Insira/aproxime o cartão na maquininha ao confirmar.'}
                </div>
              </div>
            )}

            {/* CPF na nota (NFC-e) — opcional */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, opacity: 0.65, whiteSpace: 'nowrap' }}>🧾 CPF na nota</span>
              <input
                value={cpfNota}
                onChange={e => setCpfNota(e.target.value)}
                placeholder="opcional"
                inputMode="numeric"
                style={{ ...S.input, marginBottom: 0, flex: 1, fontSize: 13 }}
              />
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 14, fontSize: 15 }}
              onClick={pagar}
              disabled={loading || tefProcessando || (payMeio === 'conta' && multiPag.length === 0 && !clienteContaId) || (payMeio === 'dinheiro' && multiPag.length === 0 && valorRecebido && trocoVal < 0)}>
              {tefProcessando ? '💳 Aguardando maquininha…' : loading ? 'Processando...' : multiPag.length > 0 && restanteMultiPag > 0.01
                ? `Registrar parcela — saldo ${fmtR(restanteMultiPag)}`
                : multiPag.length > 0
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
                    border: `2px solid ${caixaMov.tipo === t.key ? (t.key === 'sangria' ? '#e74c3c' : '#FF6B2C') : '#294F6C'}`,
                    background: caixaMov.tipo === t.key ? (t.key === 'sangria' ? '#2d0a0a' : '#254B6A') : '#17354F',
                    color: '#FFF4EC', cursor: 'pointer', textAlign: 'center',
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

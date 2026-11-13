/**
 * Página Pública: Agendamento Online
 * Acessível sem login — link compartilhável via WhatsApp/Instagram
 * Rota: /agendar/:slug (slug do tenant)
 */
import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { DINO_BARBERSHOP_LOGO } from '../../lib/brand'

const API = import.meta.env.VITE_API_URL || ''

function dataLocalIso() {
  const agora = new Date()
  const local = new Date(agora.valueOf() - agora.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function linkWhatsApp(numero, mensagem) {
  const digitos = String(numero || '').replace(/\D/g, '')
  if (!digitos) return ''
  const destino = digitos.startsWith('55') ? digitos : `55${digitos}`
  return `https://wa.me/${destino}?text=${encodeURIComponent(mensagem)}`
}

// Paleta Dino: grafite profundo e índigo profissional. A chave `green` é
// mantida apenas para compatibilidade interna com o componente existente.
const theme = {
  bg: '#0E1014',
  surface: '#161922',
  card: '#1C202B',
  green: '#6E7CE0',
  muted: '#A4AABE',
  cream: '#E8EAF2',
  line: '#2B3140',
  red: '#F27A89',
  yellow: '#E0B24B',
}


const PRODUTOS_UPSELL_DINO = [
  {
    id: 'pom-matte-80g',
    nome: 'Pomada Modeladora Efeito Matte Dino',
    volume: '80g',
    preco: 45.00,
    emoji: '🧴',
    descricao: 'Fixação forte e efeito natural sem brilho. O produto mais pedido pelos clientes.',
    badge: 'Mais Vendido',
  },
  {
    id: 'oleo-barba-30ml',
    nome: 'Óleo Hidratante para Barba Premium Dino',
    volume: '30ml',
    preco: 38.00,
    emoji: '🧔',
    descricao: 'Hidratação profunda, fios macios e alinhados com aroma amadeirado nobre.',
    badge: 'Essencial Barba',
  },
  {
    id: 'balm-pos-barba-100g',
    nome: 'Balm Modelador & Pós-Barba Dino',
    volume: '100g',
    preco: 42.00,
    emoji: '✨',
    descricao: 'Acalma a pele pós-lâmina, previne foliculite e perfuma a barba no dia a dia.',
    badge: 'Toque Macio',
  },
  {
    id: 'shampoo-antiqueda-250ml',
    nome: 'Shampoo Fortalecedor Antiqueda Dino',
    volume: '250ml',
    preco: 48.00,
    emoji: '🌿',
    descricao: 'Controle de oleosidade e fortalecimento dos fios de cabelo desde a raiz.',
    badge: 'Cuidado Capilar',
  },
];

function obterEstiloServico(nomeServico = '') {
  const n = String(nomeServico).toLowerCase();
  if (n.includes('combo') || n.includes('completo') || (n.includes('cabelo') && n.includes('barba'))) {
    return { emoji: '👑', tag: 'Experiência Completa', cor: '#E0B24B', desc: 'Corte + Barba alinhada com toalha quente e finalização premium.' };
  }
  if (n.includes('barba')) {
    return { emoji: '🧔', tag: 'Barba Terapia', cor: '#E0B24B', desc: 'Alinhamento navalhado, toalha quente e óleos essenciais hidratantes.' };
  }
  if (n.includes('degrade') || n.includes('fade') || n.includes('navalha')) {
    return { emoji: '💈', tag: 'Fade & Degradê', cor: '#6E7CE0', desc: 'Graduação milimétrica da zero à tesoura com acabamento impecável.' };
  }
  if (n.includes('pezinho') || n.includes('acabamento') || n.includes('sobrancelha')) {
    return { emoji: '⚡', tag: 'Manutenção Rápida', cor: '#A855F7', desc: 'Contornos nítidos e limpeza dos fios para eventos e manutenção.' };
  }
  return { emoji: '✂️', tag: 'Corte Tradicional', cor: '#38BDF8', desc: 'Tesoura, máquina e finalização com pomada e styling profissional.' };
}

const s = {
  page: {
    minHeight: '100vh',
    height: 'auto',
    background: theme.bg,
    color: theme.cream,
    fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
    padding: '0 0 140px',
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
    touchAction: 'pan-y',
  },
  header: {
    background: theme.surface,
    borderBottom: `1px solid ${theme.line}`,
    padding: '20px 24px',
    textAlign: 'center',
  },
  logo: { fontSize: 36, marginBottom: 8 },
  brandLogo: { display: 'block', width: 132, height: 132, objectFit: 'contain', margin: '0 auto 12px', padding: 8, background: '#FFFFFF', borderRadius: 20, boxShadow: '0 12px 28px rgba(0,0,0,.24)' },
  nomeEstab: { fontSize: 22, fontWeight: 800, color: theme.cream, fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif", letterSpacing: '-.2px' },
  subtitulo: { fontSize: 13, color: theme.muted, marginTop: 4 },
  container: { maxWidth: 520, margin: '0 auto', padding: '20px 16px 100px', touchAction: 'pan-y' },
  card: {
    background: theme.card,
    border: `1px solid ${theme.line}`,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  label: { fontSize: 12, fontWeight: 700, color: theme.muted, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6, display: 'block' },
  input: {
    width: '100%', padding: '12px 14px',
    background: theme.surface, border: `1px solid ${theme.line}`,
    borderRadius: 10, color: theme.cream, fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
  },
  btnPrimary: {
    width: '100%', padding: '14px',
    background: theme.green, color: '#fff',
    border: 'none', borderRadius: 12,
    fontSize: 15, fontWeight: 800, cursor: 'pointer',
    transition: 'opacity .15s',
  },
  btnSecondary: {
    padding: '10px 18px',
    background: 'transparent', color: theme.green,
    border: `1.5px solid ${theme.green}`,
    borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  stepTitle: { fontSize: 18, fontWeight: 800, marginBottom: 16 },
  badge: (cor) => ({
    display: 'inline-block', padding: '3px 10px',
    background: cor === 'green' ? 'rgba(110,124,224,.15)' : 'rgba(224,178,75,.15)',
    color: cor === 'green' ? theme.green : theme.yellow,
    borderRadius: 20, fontSize: 11, fontWeight: 700,
  }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  profCard: (sel) => ({
    width: '100%', background: sel ? 'rgba(110,124,224,.12)' : theme.surface,
    border: `1.5px solid ${sel ? theme.green : theme.line}`,
    borderRadius: 12, padding: '14px 12px', cursor: 'pointer', color: theme.cream,
    transition: 'all .15s', textAlign: 'center', fontFamily: 'inherit',
  }),
  servicoCard: (sel) => ({
    width: '100%', background: sel ? 'rgba(110,124,224,.12)' : theme.surface,
    border: `1.5px solid ${sel ? theme.green : theme.line}`,
    borderRadius: 12, padding: '12px 14px', cursor: 'pointer', color: theme.cream,
    transition: 'all .15s', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    textAlign: 'left', fontFamily: 'inherit',
  }),
  horarioBtn: (sel, dis) => ({
    padding: '10px 0', textAlign: 'center',
    background: dis ? 'rgba(255,255,255,.03)' : sel ? theme.green : theme.surface,
    border: `1.5px solid ${dis ? theme.line : sel ? theme.green : theme.line}`,
    borderRadius: 10, cursor: dis ? 'not-allowed' : 'pointer',
    color: dis ? theme.muted : sel ? '#fff' : theme.cream,
    fontSize: 13, fontWeight: 700, opacity: dis ? .4 : 1,
    transition: 'all .15s', fontFamily: 'inherit',

  }),
  sucesso: {
    textAlign: 'center', padding: '32px 18px',
    background: theme.card, border: `1px solid ${theme.line}`,
    borderRadius: 20, touchAction: 'pan-y',
  },
  alerta: {
    padding: '12px 14px', marginBottom: 16, borderRadius: 10,
    border: `1px solid ${theme.red}`, background: 'rgba(242,122,137,.1)',
    color: theme.red, fontSize: 13, fontWeight: 700, lineHeight: 1.45,
  },
}

export function servicoDisponivelParaProfissional(servico, profissionalId, profissionalNome = '') {
  if (!profissionalId || profissionalId === 'qualquer') return true
  if (!servico) return false
  const ids = Array.isArray(servico.profissionais_ids) && servico.profissionais_ids.length > 0
    ? servico.profissionais_ids
    : (Array.isArray(servico.profissionaisIds) && servico.profissionaisIds.length > 0 ? servico.profissionaisIds : [])
  if (ids.length > 0) {
    return ids.includes(profissionalId)
  }
  const nomeUpper = (servico.nome || '').toUpperCase()
  const profUpper = (profissionalNome || '').toUpperCase()
  if (/\bCOM DINO\b|\(DINO\)/i.test(nomeUpper) && !/\bDINO\b/i.test(profUpper)) return false
  if (/\( *JO[AÃ]O *\)/i.test(nomeUpper) && !/\bJO[AÃ]O\b/i.test(profUpper)) return false
  if (/\( *BRUNO OU NATI *\)/i.test(nomeUpper) && !(/\bBRUNO\b/i.test(profUpper) || /\bNATI\b/i.test(profUpper) || /\bNATANI\b/i.test(profUpper))) return false
  return true
}

function slugify(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function validarCpf(cpf) {
  const limpo = String(cpf || '').replace(/\D/g, '')
  if (limpo.length !== 11) return false
  if (/^(\d)\1{10}$/.test(limpo)) return false
  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(limpo.charAt(i), 10) * (10 - i)
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(limpo.charAt(9), 10)) return false
  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(limpo.charAt(i), 10) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  return resto === parseInt(limpo.charAt(10), 10)
}

function mascaraCpf(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
}

function mascaraTelefone(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AgendamentoOnline() {
  const { slug, barbeiro } = useParams()
  const isDino = String(slug || '').trim().toLowerCase() === 'dino'
  const [passo, setPasso] = useState(1) // 1=serviço 2=profissional 3=data/hora 4=dados 5=confirmado
  const [estabelecimento, setEstabelecimento] = useState(null)
  const [profissionais, setProfissionais] = useState([])
  const [servicos, setServicos] = useState([])
  const [horariosDisponiveis, setHorariosDisponiveis] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [erroFluxo, setErroFluxo] = useState('')
  const [carregandoHorarios, setCarregandoHorarios] = useState(false)
  const [enviando, setEnviando] = useState(false)

  // Seleções do usuário
  const [servicoSel, setServicoSel] = useState(null)
  const [profissionalSel, setProfissionalSel] = useState(null)
  const [barbeiroPreselecionado, setBarbeiroPreselecionado] = useState(null)
  const [dataSel, setDataSel] = useState('')
  const [horarioSel, setHorarioSel] = useState('')
  const [form, setForm] = useState({ nome: '', cpf: '', telefone: '', observacoes: '' })
  const [agendamento, setAgendamento] = useState(null)
  const [consentimento, setConsentimento] = useState(false)
  const [produtosUpsellSel, setProdutosUpsellSel] = useState([])
  // Consentimento separado por finalidade: aviso de vaga ≠ confirmação/lembrete do agendamento.
  const [consentimentoEspera, setConsentimentoEspera] = useState(false)
  const [politicas, setPoliticas] = useState({ cancelamentoHoras: 4 })
  const [searchParams] = useSearchParams()
  const barbeiroParam = barbeiro || searchParams.get('barbeiro') || searchParams.get('profissional') || searchParams.get('b') || searchParams.get('prof') || ''
  // Código de quem indicou (vem do link de indicação). Só o código, nunca dado pessoal.
  const indicacao = String(searchParams.get('indicacao') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  // Canal de origem do link (Google, Instagram, WhatsApp, QR code). Só o nome do canal.
  const canal = String(searchParams.get('canal') || searchParams.get('utm_source') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24)
  const campanha = String(searchParams.get('utm_campaign') || '').slice(0, 60)
  const [pagamento, setPagamento] = useState(null)
  const [avisoPagamento, setAvisoPagamento] = useState(null)
  const [pixCopiado, setPixCopiado] = useState(false)
  const [espera, setEspera] = useState({ aberta: false, periodo: 'qualquer', enviada: false, enviando: false, erro: '' })
  // Autoatendimento: ver, remarcar ou cancelar com código + telefone.
  const [gestao, setGestao] = useState({ codigo: '', telefone: '', agendamento: null, erro: '', carregando: false, data: '', horarios: [], horario: '', mensagem: '' })

  useEffect(() => {
    carregarDados()
  }, [slug])

  // Volta do checkout: confere o pagamento do sinal na InfinitePay pelo servidor.
  useEffect(() => {
    if (searchParams.get('pagamento') !== 'retorno') return
    const orderNsu = searchParams.get('order_nsu')
    const transactionNsu = searchParams.get('transaction_nsu') || searchParams.get('transaction_id')
    const invoiceSlug = searchParams.get('invoice_slug')
    if (!orderNsu || !transactionNsu || !invoiceSlug) { setAvisoPagamento({ tom: 'alerta', texto: 'Recebemos sua volta do pagamento, mas faltou o identificador do checkout. Se você pagou, a confirmação chega em instantes.' }); return }
    fetch(`${API}/api/publico/agendamento/${encodeURIComponent(slug)}/pagamento/verificar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_nsu: orderNsu, transaction_nsu: transactionNsu, invoice_slug: invoiceSlug }),
    }).then((res) => res.json().catch(() => ({}))).then((data) => {
      setAvisoPagamento(!data?.pago
        ? { tom: 'alerta', texto: data?.error || 'Ainda não recebemos a confirmação do pagamento. Se já pagou, aguarde alguns instantes.' }
        : data.horarioLiberado
          ? { tom: 'alerta', texto: 'Recebemos seu pagamento, mas o prazo tinha vencido e o horário foi liberado. A barbearia vai falar com você para remarcar ou devolver o valor.' }
          : data.tipo === 'assinatura'
            ? { tom: 'ok', texto: 'Mensalidade do clube paga. Obrigado!' }
            : { tom: 'ok', texto: 'Pagamento confirmado! Seu horário está garantido.' })
    }).catch(() => setAvisoPagamento({ tom: 'alerta', texto: 'Não foi possível conferir o pagamento agora.' }))
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  async function carregarDados() {
    try {
      setLoading(true)
      setErro(null)
      const res = await fetch(`${API}/api/publico/agendamento/${encodeURIComponent(slug)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || 'Estabelecimento não encontrado')
      setEstabelecimento(data.estabelecimento)
      const profs = data.profissionais || []
      setProfissionais(profs)
      setServicos(data.servicos || [])
      if (data.politicas) setPoliticas(data.politicas)

      // Auto-selecionar barbeiro quando acessado via link individual (/agendar/:slug/:barbeiro ou ?barbeiro=...)
      const dataParam = searchParams.get('data') || ''
      if (/^\d{4}-\d{2}-\d{2}$/.test(dataParam)) {
        setDataSel(dataParam)
      }
      let matchedProf = null
      if (barbeiroParam && profs.length > 0) {
        const bSlug = slugify(barbeiroParam)
        matchedProf = profs.find(p =>
          p.id === barbeiroParam ||
          p.slug === bSlug ||
          slugify(p.apelido || '') === bSlug ||
          slugify(p.nome) === bSlug ||
          slugify(p.nome).includes(bSlug) ||
          bSlug.includes(slugify(p.nome))
        )
        if (matchedProf) {
          setProfissionalSel(matchedProf)
          setBarbeiroPreselecionado(matchedProf)
        }
      }
      const servicoParam = searchParams.get('servico') || searchParams.get('servico_id') || ''
      const listaServ = data.servicos || []
      if (servicoParam && listaServ.length > 0) {
        const sSlug = slugify(servicoParam)
        const sMatch = listaServ.find(sv =>
          sv.id === servicoParam ||
          slugify(sv.nome) === sSlug ||
          slugify(sv.nome).includes(sSlug)
        )
        if (sMatch) {
          setServicoSel(sMatch)
          if (matchedProf) setPasso(3)
        }
      }
    } catch (err) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function carregarHorarios() {
    if (!profissionalSel || !dataSel || !servicoSel) return
    setCarregandoHorarios(true)
    setErroFluxo('')
    setHorariosDisponiveis([])
    try {
      const res = await fetch(
        `${API}/api/publico/agendamento/${encodeURIComponent(slug)}/horarios?profissional_id=${encodeURIComponent(profissionalSel.id)}&data=${encodeURIComponent(dataSel)}&servico_id=${encodeURIComponent(servicoSel.id)}`
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        const msg = data.error || 'Não foi possível consultar os horários.'
        if (msg.includes('não realiza este serviço')) {
          setErroFluxo(`O profissional ${profissionalSel?.nome || ''} não realiza o serviço "${servicoSel?.nome || ''}".`)
          setHorariosDisponiveis([])
          return
        }
        throw new Error(msg)
      }
      setHorariosDisponiveis(Array.isArray(data.horarios) ? data.horarios : [])
    } catch (err) {
      setErroFluxo(err.message || 'Não foi possível consultar os horários.')
    } finally {
      setCarregandoHorarios(false)
    }
  }

  // Filtra serviços para exibir apenas os que o profissional selecionado realiza
  const servicosExibidos = useMemo(() => {
    if (!profissionalSel || profissionalSel.id === 'qualquer') return servicos
    return servicos.filter(sv => servicoDisponivelParaProfissional(sv, profissionalSel.id, profissionalSel.nome))
  }, [servicos, profissionalSel])

  // Se o serviço previamente selecionado não for realizado pelo profissional ativo, limpa a seleção
  useEffect(() => {
    if (servicoSel && profissionalSel && profissionalSel.id !== 'qualquer') {
      if (!servicoDisponivelParaProfissional(servicoSel, profissionalSel.id, profissionalSel.nome)) {
        setServicoSel(null)
      }
    }
  }, [profissionalSel, servicoSel])

  // No Passo 2: exibe apenas os profissionais que realizam o serviço selecionado no Passo 1
  const profissionaisExibidos = useMemo(() => {
    if (!servicoSel) return profissionais
    return profissionais.filter(p => servicoDisponivelParaProfissional(servicoSel, p.id, p.nome))
  }, [profissionais, servicoSel])

  useEffect(() => {
    if (passo === 3 && profissionalSel && dataSel && servicoSel) carregarHorarios()
  }, [passo, dataSel, profissionalSel, servicoSel])

  async function confirmarAgendamento() {
    const nome = form.nome.trim()
    const cpfLimpo = form.cpf.replace(/\D/g, '')
    const telefone = form.telefone.replace(/\D/g, '')
    if (nome.length < 2) {
      setErroFluxo('Informe seu nome completo.')
      return
    }
    if (!cpfLimpo || !validarCpf(cpfLimpo)) {
      setErroFluxo('Informe um CPF válido com 11 dígitos.')
      return
    }
    if (telefone.length < 10) {
      setErroFluxo('Informe um telefone WhatsApp válido com DDD.')
      return
    }
    setErroFluxo('')
    setEnviando(true)
    try {
      const res = await fetch(`${API}/api/publico/agendamento/${encodeURIComponent(slug)}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servico_id: servicoSel.id,
          profissional_id: profissionalSel.id,
          data: dataSel,
          horario: horarioSel,
          cliente_nome: nome,
          cliente_cpf: cpfLimpo,
          cliente_telefone: telefone,
          observacoes: [
            form.observacoes,
            produtosUpsellSel.length > 0
              ? `🧴 PRODUTOS INCLUÍDOS PARA RETIRADA NO ATENDIMENTO: ${produtosUpsellSel.map(p => `${p.nome} (${p.volume}) - R$ ${p.preco.toFixed(2)}`).join(' + ')}`
              : null,
          ].filter(Boolean).join(' | '),
          produtos_upsell: produtosUpsellSel,
          consentimento_whatsapp: consentimento === true,
          ...(indicacao ? { indicacao } : {}),
          ...(canal ? { canal, campanha } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || 'Não foi possível confirmar o agendamento.')
      setAgendamento(data.agendamento)
      setPagamento(data.pagamento || null)
      setPasso(5)
    } catch (err) {
      setErroFluxo(err.message || 'Não foi possível confirmar o agendamento.')
    } finally {
      setEnviando(false)
    }
  }

  async function entrarNaListaDeEspera() {
    const nome = form.nome.trim()
    const telefone = form.telefone.replace(/\D/g, '')
    if (nome.length < 2 || telefone.length < 10) {
      setEspera(e => ({ ...e, erro: 'Informe seu nome e um telefone válido com DDD.' }))
      return
    }
    setEspera(e => ({ ...e, enviando: true, erro: '' }))
    try {
      const res = await fetch(`${API}/api/publico/agendamento/${encodeURIComponent(slug)}/lista-espera`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servico_id: servicoSel.id,
          profissional_id: profissionalSel?.id || 'qualquer',
          data: dataSel,
          periodo: espera.periodo,
          cliente_nome: nome,
          cliente_telefone: telefone,
          consentimento_whatsapp: consentimentoEspera === true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || 'Não foi possível entrar na lista de espera.')
      setEspera(e => ({ ...e, enviada: true, enviando: false }))
    } catch (err) {
      setEspera(e => ({ ...e, enviando: false, erro: err.message || 'Não foi possível entrar na lista de espera.' }))
    }
  }

  async function chamarGestao(rota, extra = {}) {
    const telefone = gestao.telefone.replace(/\D/g, '')
    const codigo = gestao.codigo.trim()
    if (codigo.length < 6 || telefone.length < 10) {
      setGestao(g => ({ ...g, erro: 'Informe o código do agendamento e o telefone usado na reserva.' }))
      return null
    }
    setGestao(g => ({ ...g, carregando: true, erro: '', mensagem: '' }))
    try {
      const res = await fetch(`${API}/api/publico/agendamento/${encodeURIComponent(slug)}/meu-agendamento${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, cliente_telefone: telefone, ...extra }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || 'Não foi possível concluir.')
      setGestao(g => ({ ...g, carregando: false, agendamento: data.agendamento, cashback: data.cashback === undefined ? g.cashback : data.cashback }))
      return data.agendamento
    } catch (err) {
      setGestao(g => ({ ...g, carregando: false, erro: err.message || 'Não foi possível concluir.' }))
      return null
    }
  }

  async function carregarHorariosRemarcacao(data) {
    const ag = gestao.agendamento
    setGestao(g => ({ ...g, data, horario: '', horarios: [] }))
    if (!ag?.servico?.id || !data) return
    try {
      const res = await fetch(`${API}/api/publico/agendamento/${encodeURIComponent(slug)}/horarios?profissional_id=${encodeURIComponent(ag.profissional?.id || 'qualquer')}&data=${encodeURIComponent(data)}&servico_id=${encodeURIComponent(ag.servico.id)}`)
      const json = await res.json().catch(() => ({}))
      // Só aplica se a data ainda for a escolhida (troca rápida de data).
      setGestao(g => g.data !== data ? g : ({ ...g, horarios: Array.isArray(json.horarios) ? json.horarios.filter(h => h.disponivel) : [] }))
    } catch (_) {
      setGestao(g => g.data !== data ? g : ({ ...g, horarios: [] }))
    }
  }

  // Data mínima = hoje
  const hoje = dataLocalIso()

  // ── Tela de loading / erro ──────────────────────────────────────────────────
  if (loading) return (
    <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✂️</div>
        <p style={{ color: theme.muted }}>Carregando...</p>
      </div>
    </div>
  )

  if (erro) return (
    <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
        <p style={{ color: theme.red, fontWeight: 700 }}>{erro}</p>
        <p style={{ color: theme.muted, fontSize: 13, marginTop: 8 }}>Verifique o link e tente novamente</p>
      </div>
    </div>
  )

  // ── Cabeçalho ───────────────────────────────────────────────────────────────
  const Header = () => (
    <div style={s.header}>
      {isDino ? <img src={DINO_BARBERSHOP_LOGO} alt="Barbearia Dino — desde 1997" style={s.brandLogo} /> : <div style={s.logo}>{estabelecimento?.emoji || '✂️'}</div>}
      <div style={s.nomeEstab}>{estabelecimento?.nome || (isDino ? 'Barbearia Dino' : 'Agendamento Online')}</div>
      {estabelecimento?.endereco && (
        <div style={s.subtitulo}>📍 {estabelecimento.endereco}</div>
      )}
      {avisoPagamento && <div role="status" aria-live="polite" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: `1px solid ${avisoPagamento.tom === 'ok' ? theme.green : theme.yellow}`, color: avisoPagamento.tom === 'ok' ? theme.green : theme.yellow }}>{avisoPagamento.texto}</div>}
      {/* Indicador de passos */}
      {typeof passo === 'number' && <div role="progressbar" aria-label={`Etapa ${Math.min(passo, 4)} de 4`} aria-valuemin="1" aria-valuemax="4" aria-valuenow={Math.min(passo, 4)} style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
        {[1, 2, 3, 4].map(p => (
          <div key={p} style={{
            width: 28, height: 4, borderRadius: 2,
            background: passo >= p ? theme.green : theme.line,
            transition: 'background .3s',
          }} />
        ))}
      </div>}
    </div>
  )

  // ── Passo 1: Escolher serviço ───────────────────────────────────────────────
  if (passo === 1) return (
    <div style={s.page}>
      <Header />
      <div style={s.container}>
        {barbeiroPreselecionado && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(110,124,224,0.18), rgba(22,25,34,0.95))',
            border: `1.5px solid ${theme.green}`,
            borderRadius: 16,
            padding: '16px 20px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(110,124,224,0.2)',
                border: `1.5px solid ${theme.green}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                overflow: 'hidden',
              }}>
                {barbeiroPreselecionado.foto_url ? (
                  <img src={barbeiroPreselecionado.foto_url} alt={barbeiroPreselecionado.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  barbeiroPreselecionado.foto_emoji || '✂️'
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: theme.green, textTransform: 'uppercase', letterSpacing: '.8px' }}>
                  Agendamento com
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: theme.cream }}>
                  {barbeiroPreselecionado.nome}
                </div>
                <div style={{ fontSize: 12, color: theme.muted }}>
                  {barbeiroPreselecionado.especialidade || 'Barbeiro Profissional'}
                </div>
              </div>
            </div>
            <button
              type="button"
              style={{
                background: 'none',
                border: `1px solid ${theme.line}`,
                borderRadius: 8,
                color: theme.muted,
                fontSize: 11,
                padding: '6px 10px',
                cursor: 'pointer',
              }}
              onClick={() => {
                setBarbeiroPreselecionado(null)
                setProfissionalSel(null)
                setServicoSel(null)
              }}
            >
              Trocar
            </button>
          </div>
        )}
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={s.stepTitle}>🛠️ Qual serviço deseja?</div>
            {profissionalSel && (
              <span style={{ fontSize: 11, color: theme.green, fontWeight: 700 }}>
                Serviços de {profissionalSel.nome} ({servicosExibidos.length})
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {servicosExibidos.length === 0 && (
              <p role="status" style={{ color: theme.muted, fontSize: 13 }}>
                Nenhum serviço disponível para este profissional no momento.
              </p>
            )}
            {servicosExibidos.map(sv => {
              const estilo = obterEstiloServico(sv.nome);
              const selecionado = servicoSel?.id === sv.id;
              return (
                <button
                  type="button"
                  key={sv.id}
                  aria-pressed={selecionado}
                  style={{
                    ...s.servicoCard(selecionado),
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    boxShadow: selecionado ? "0 4px 16px rgba(110,124,224,0.25)" : "none",
                  }}
                  onClick={() => { setServicoSel(sv); setErroFluxo(""); }}
                >
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: selecionado ? "rgba(110,124,224,0.25)" : "rgba(255,255,255,0.04)",
                    border: `1.5px solid ${selecionado ? theme.green : estilo.cor}40`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 26,
                    flexShrink: 0,
                  }}>
                    {estilo.emoji}
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: theme.cream }}>{sv.nome}</span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: ".4px",
                        padding: "2px 7px",
                        borderRadius: 6,
                        background: `${estilo.cor}22`,
                        color: estilo.cor,
                      }}>
                        {estilo.tag}
                      </span>
                    </div>
                    <span style={{ display: "block", color: theme.muted, fontSize: 12, marginTop: 3 }}>
                      {estilo.desc}
                    </span>
                    <span style={{ display: "inline-block", color: theme.muted, fontSize: 11, marginTop: 4 }}>
                      ⏱ {sv.duracao_min} min de cadeira
                    </span>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <span style={{ display: "block", fontWeight: 800, color: theme.green, fontSize: 16 }}>
                      {sv.preco_rotulo || `R$ ${parseFloat(sv.preco).toFixed(2).replace(".", ",")}`}
                    </span>
                    {selecionado ? (
                      <span aria-hidden="true" style={{ display: "inline-block", fontSize: 12, color: "#fff", background: theme.green, padding: "2px 8px", borderRadius: 10, marginTop: 4, fontWeight: 700 }}>✓ Escolhido</span>
                    ) : (
                      <span style={{ display: "inline-block", fontSize: 11, color: theme.muted, marginTop: 4 }}>Selecionar</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <button
          style={{ ...s.btnPrimary, opacity: servicoSel ? 1 : .4 }}
          disabled={!servicoSel}
          onClick={() => setPasso((barbeiroPreselecionado || (profissionalSel && profissionalSel.id !== 'qualquer')) ? 3 : 2)}
        >
          Continuar →
        </button>
        <button type="button" style={{ ...s.btnSecondary, width: '100%', marginTop: 12 }} onClick={() => { setErroFluxo(''); setPasso('meu') }}>
          Já agendou? Ver, remarcar ou cancelar
        </button>
        {indicacao && <p style={{ color: theme.muted, fontSize: 12, textAlign: 'center', marginTop: 12 }}>Você chegou por indicação de um cliente da casa.</p>}
      </div>
    </div>
  )

  // ── Autoatendimento: meu agendamento ───────────────────────────────────────
  if (passo === 'meu') {
    const ag = gestao.agendamento
    const quando = ag ? `${String(ag.dataAgenda || '').split('-').reverse().join('/')} às ${ag.horaLocal}` : ''
    return (
      <div style={s.page}>
        <Header />
        <div style={s.container}>
          <div style={s.card}>
            <div style={s.stepTitle}>🔎 Meu agendamento</div>
            {gestao.erro && <div role="alert" aria-live="assertive" style={s.alerta}>{gestao.erro}</div>}
            {gestao.mensagem && <div role="status" aria-live="polite" style={{ ...s.alerta, borderColor: theme.green, color: theme.green, background: 'rgba(110,124,224,.1)' }}>{gestao.mensagem}</div>}
            {!ag ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label htmlFor="gestao-codigo" style={s.label}>Código do agendamento</label>
                  <input id="gestao-codigo" style={s.input} maxLength={12} autoComplete="off" placeholder="Ex.: 7F3A9C21" value={gestao.codigo} onChange={e => setGestao(g => ({ ...g, codigo: e.target.value.toUpperCase(), erro: '' }))} />
                </div>
                <div>
                  <label htmlFor="gestao-telefone" style={s.label}>Telefone usado na reserva</label>
                  <input id="gestao-telefone" type="tel" inputMode="tel" autoComplete="tel" maxLength={18} style={s.input} placeholder="(65) 9 9999-9999" value={gestao.telefone} onChange={e => setGestao(g => ({ ...g, telefone: e.target.value, erro: '' }))} />
                </div>
                <button type="button" style={{ ...s.btnPrimary, opacity: gestao.carregando ? .5 : 1 }} disabled={gestao.carregando} onClick={() => chamarGestao('')}>
                  {gestao.carregando ? 'Buscando…' : 'Buscar agendamento'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: theme.surface, borderRadius: 12, padding: 16 }}>
                  {[
                    ['Status', { agendado: 'Agendado', confirmado: 'Confirmado', em_atendimento: 'Em atendimento', concluido: 'Concluído', cancelado: 'Cancelado', nao_compareceu: 'Não compareceu' }[ag.status] || ag.status],
                    ['Serviço', ag.servico?.nome],
                    ['Profissional', ag.profissional?.nome],
                    ['Quando', quando],
                    ...(ag.sinal ? [['Sinal', `R$ ${Number(ag.sinal.valor).toFixed(2).replace('.', ',')} · ${{ pendente: 'aguardando pagamento', paga: 'pago', expirada: 'prazo vencido', cancelada: 'cancelado' }[ag.sinal.status] || ag.sinal.status}`]] : []),
                    ...(gestao.cashback ? [['Cashback disponível', `R$ ${Number(gestao.cashback.saldo).toFixed(2).replace('.', ',')}`]] : []),
                  ].map(([rotulo, valor]) => (
                    <div key={rotulo} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${theme.line}`, fontSize: 13 }}>
                      <span style={{ color: theme.muted }}>{rotulo}</span>
                      <span style={{ fontWeight: 700 }}>{valor}</span>
                    </div>
                  ))}
                </div>
                {ag.sinal?.status === 'pendente' && ag.sinal.url && <a href={ag.sinal.url} style={{ ...s.btnPrimary, display: 'block', textAlign: 'center', textDecoration: 'none' }}>Pagar o sinal</a>}
                {ag.sinal?.status === 'pendente' && ag.sinal.pixCopiaECola && <button type="button" style={s.btnSecondary} onClick={() => navigator.clipboard?.writeText(ag.sinal.pixCopiaECola)}>Copiar Pix do sinal</button>}
                {ag.podeRemarcar ? (
                  <>
                    <label htmlFor="gestao-data" style={s.label}>Remarcar para</label>
                    <input id="gestao-data" type="date" min={hoje} value={gestao.data} onChange={e => carregarHorariosRemarcacao(e.target.value)} style={s.input} />
                    {gestao.data && (gestao.horarios.length === 0
                      ? <p role="status" style={{ color: theme.muted, fontSize: 13 }}>Nenhum horário livre com {ag.profissional?.nome || 'a equipe'} nesta data.</p>
                      : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                          {gestao.horarios.map(h => (
                            <button type="button" key={h.horario} aria-pressed={gestao.horario === h.horario} style={s.horarioBtn(gestao.horario === h.horario, false)} onClick={() => setGestao(g => ({ ...g, horario: h.horario }))}>{h.horario}</button>
                          ))}
                        </div>)}
                    <button type="button" style={{ ...s.btnPrimary, opacity: gestao.horario && !gestao.carregando ? 1 : .4 }} disabled={!gestao.horario || gestao.carregando} onClick={async () => { const novo = await chamarGestao('/remarcar', { data: gestao.data, horario: gestao.horario }); if (novo) setGestao(g => ({ ...g, data: '', horario: '', horarios: [], mensagem: 'Horário remarcado.' })) }}>
                      Confirmar novo horário
                    </button>
                    <button type="button" style={{ ...s.btnSecondary, width: '100%', color: theme.red, borderColor: theme.red }} disabled={gestao.carregando} onClick={async () => { const cancelado = await chamarGestao('/cancelar'); if (cancelado) setGestao(g => ({ ...g, mensagem: 'Agendamento cancelado. Se quiser, marque outro horário quando puder.' })) }}>
                      Cancelar agendamento
                    </button>
                    <p style={{ color: theme.muted, fontSize: 12 }}>Remarcações e cancelamentos pelo site vão até {ag.politicaCancelamentoHoras}h antes do horário.</p>
                  </>
                ) : ag.status === 'agendado' || ag.status === 'confirmado' ? (
                  <p style={{ color: theme.muted, fontSize: 13 }}>Faltam menos de {ag.politicaCancelamentoHoras}h para o horário. Para mudar, fale com a barbearia pelo WhatsApp.</p>
                ) : null}
                {estabelecimento?.whatsapp && (
                  <a href={linkWhatsApp(estabelecimento.whatsapp, `Olá! Sobre o meu agendamento ${ag.codigo}.`)} target="_blank" rel="noopener noreferrer" style={{ ...s.btnSecondary, display: 'block', textAlign: 'center', textDecoration: 'none' }}>💬 Falar com a barbearia</a>
                )}
              </div>
            )}
          </div>
          <button type="button" style={{ ...s.btnSecondary, width: '100%' }} onClick={() => { setGestao({ codigo: '', telefone: '', agendamento: null, erro: '', carregando: false, data: '', horarios: [], horario: '', mensagem: '' }); setPasso(1) }}>
            ← Fazer um novo agendamento
          </button>
        </div>
      </div>
    )
  }

  // ── Passo 2: Escolher profissional ─────────────────────────────────────────
  if (passo === 2) return (
    <div style={s.page}>
      <Header />
      <div style={s.container}>
        <div style={s.card}>
          <div style={s.stepTitle}>👤 Com quem prefere?</div>
          {servicoSel && (
            <div style={{ fontSize: 12, color: theme.muted, marginBottom: 14 }}>
              Profissionais disponíveis para <strong style={{ color: theme.cream }}>{servicoSel.nome}</strong>:
            </div>
          )}
          <div style={s.grid2}>
            {/* Opção "Qualquer disponível" quando há mais de 1 profissional */}
            {profissionaisExibidos.length > 1 && (
              <button
                type="button"
                aria-pressed={profissionalSel?.id === 'qualquer'}
                style={s.profCard(profissionalSel?.id === 'qualquer')}
                onClick={() => { setProfissionalSel({ id: 'qualquer', nome: 'Qualquer disponível' }); setErroFluxo('') }}
              >
                <span aria-hidden="true" style={{ display: 'block', fontSize: 28, marginBottom: 6 }}>🎲</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Qualquer disponível</span>
              </button>
            )}
            {profissionaisExibidos.map(p => (
              <button
                type="button"
                key={p.id}
                aria-pressed={profissionalSel?.id === p.id}
                style={s.profCard(profissionalSel?.id === p.id)}
                onClick={() => { setProfissionalSel(p); setErroFluxo('') }}
              >
                <span aria-hidden="true" style={{ display: 'block', fontSize: 28, marginBottom: 6 }}>{p.foto_emoji || '💇'}</span>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 700 }}>{p.nome}</span>
                {p.especialidade && (
                  <span style={{ display: 'block', fontSize: 10, color: theme.muted, marginTop: 2 }}>{p.especialidade}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ ...s.btnSecondary, flex: 1 }} onClick={() => setPasso(1)}>← Voltar</button>
          <button
            style={{ ...s.btnPrimary, flex: 2, opacity: profissionalSel ? 1 : .4 }}
            disabled={!profissionalSel}
            onClick={() => setPasso(3)}
          >
            Continuar →
          </button>
        </div>
      </div>
    </div>
  )

  // ── Passo 3: Escolher data e horário ───────────────────────────────────────
  if (passo === 3) {
    const proximosDias = Array.from({ length: 14 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const iso = d.toISOString().slice(0, 10)
      const ehHoje = i === 0
      const ehAmanha = i === 1
      const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase()
      const diaMes = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      const label = ehHoje ? 'Hoje' : ehAmanha ? 'Amanhã' : diaSemana
      return { iso, label, diaMes }
    })

    const dataSelFormatada = dataSel
      ? new Date(dataSel + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
      : ''

    return (
    <div style={s.page}>
      <Header />
      <div style={s.container}>
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={s.stepTitle}>📅 Quando prefere?</div>
            {profissionalSel && (
              <div style={{ fontSize: 12, color: theme.green, fontWeight: 700 }}>
                {profissionalSel.nome}
              </div>
            )}
          </div>
          {erroFluxo && (
            <div role="alert" aria-live="assertive" style={s.alerta}>
              <div>{erroFluxo}</div>
              {erroFluxo.includes('não realiza') && (
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: `1px solid ${theme.red}`,
                    borderRadius: 8,
                    color: '#fff',
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginTop: 10,
                    width: '100%',
                  }}
                  onClick={() => {
                    setServicoSel(null)
                    setErroFluxo('')
                    setPasso(1)
                  }}
                >
                  ← Escolher outro serviço para {profissionalSel?.nome || 'este profissional'}
                </button>
              )}
            </div>
          )}

          <label style={s.label}>Selecione um dia</label>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 16 }}>
            {proximosDias.map(({ iso, label, diaMes }) => {
              const sel = dataSel === iso
              return (
                <button
                  type="button"
                  key={iso}
                  onClick={() => { setDataSel(iso); setHorarioSel(''); setEspera(x => ({ ...x, aberta: false, enviada: false, erro: '' })) }}
                  style={{
                    flex: '0 0 auto',
                    minWidth: 72,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: sel ? theme.green : theme.surface,
                    border: `1.5px solid ${sel ? theme.green : theme.line}`,
                    color: sel ? '#fff' : theme.cream,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', opacity: sel ? 1 : 0.7 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>{diaMes}</div>
                </button>
              )
            })}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="agendamento-data" style={{ ...s.label, fontSize: 11 }}>Ou escolha outra data no calendário:</label>
          <input
            id="agendamento-data"
            type="date"
            min={hoje}
            value={dataSel}
            onChange={e => { setDataSel(e.target.value); setHorarioSel(''); setEspera(x => ({ ...x, aberta: false, enviada: false, erro: '' })) }}
            style={s.input}
          />
          </div>
          {dataSel && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <label style={{ ...s.label, margin: 0 }}>
                  Horários para {dataSelFormatada}
                </label>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: theme.muted }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme.green }} /> Livre
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme.muted, opacity: 0.5 }} /> Ocupado
                  </span>
                </div>
              </div>
              {carregandoHorarios ? (
                <p role="status" aria-live="polite" style={{ color: theme.muted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Consultando a agenda…</p>
              ) : horariosDisponiveis.filter(h => h.disponivel).length === 0 ? (
                <div role="status" style={{ textAlign: 'center', padding: '12px 0' }}>
                  <p style={{ color: theme.muted, fontSize: 13, marginBottom: 12 }}>Nenhum horário disponível nesta data.</p>
                  {espera.enviada ? (
                    <p style={{ color: theme.green, fontSize: 13, fontWeight: 700 }}>Pronto! Você está na lista de espera. Se abrir um horário, avisamos{consentimentoEspera ? ' pelo WhatsApp' : ''}.</p>
                  ) : !espera.aberta ? (
                    <button type="button" style={s.btnSecondary} onClick={() => setEspera(e => ({ ...e, aberta: true }))}>Entrar na lista de espera deste dia</button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
                      {espera.erro && <div role="alert" style={s.alerta}>{espera.erro}</div>}
                      <label htmlFor="espera-nome" style={s.label}>Seu nome</label>
                      <input id="espera-nome" autoComplete="name" maxLength={160} style={s.input} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
                      <label htmlFor="espera-telefone" style={s.label}>Telefone com DDD</label>
                      <input id="espera-telefone" type="tel" inputMode="tel" autoComplete="tel" maxLength={18} style={s.input} value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
                      <label htmlFor="espera-periodo" style={s.label}>Período</label>
                      <select id="espera-periodo" style={s.input} value={espera.periodo} onChange={e => setEspera(x => ({ ...x, periodo: e.target.value }))}>
                        <option value="qualquer">Qualquer horário</option>
                        <option value="manha">Manhã</option>
                        <option value="tarde">Tarde</option>
                        <option value="noite">Noite</option>
                      </select>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: theme.cream }}>
                        <input type="checkbox" checked={consentimentoEspera} onChange={e => setConsentimentoEspera(e.target.checked)} style={{ marginTop: 3 }} />
                        <span>Quero ser avisado pelo WhatsApp se abrir um horário.</span>
                      </label>
                      <button type="button" style={{ ...s.btnPrimary, opacity: espera.enviando ? .5 : 1 }} disabled={espera.enviando} onClick={entrarNaListaDeEspera}>{espera.enviando ? 'Enviando…' : 'Entrar na lista de espera'}</button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {horariosDisponiveis.map(h => (
                    <button
                      type="button"
                      key={h.horario}
                      disabled={!h.disponivel}
                      aria-pressed={horarioSel === h.horario}
                      aria-label={`${h.horario}, ${h.disponivel ? 'horário livre' : 'horário ocupado'}`}
                      style={{
                        ...s.horarioBtn(horarioSel === h.horario, !h.disponivel),
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '10px 4px',
                      }}
                      onClick={() => {
                        if (h.disponivel) {
                          setHorarioSel(h.horario)
                          setErroFluxo('')
                        }
                      }}
                    >
                      <span style={{ fontSize: 15, fontWeight: 800 }}>{h.horario}</span>
                      <span style={{
                        fontSize: 10,
                        marginTop: 3,
                        fontWeight: 700,
                        color: h.disponivel ? (horarioSel === h.horario ? '#fff' : theme.green) : theme.muted,
                        opacity: h.disponivel ? 1 : 0.6,
                      }}>
                        {h.disponivel ? 'Livre' : 'Ocupado'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ ...s.btnSecondary, flex: 1 }} onClick={() => setPasso((barbeiroPreselecionado || (profissionalSel && profissionalSel.id !== 'qualquer')) ? 1 : 2)}>← Voltar</button>
          <button
            style={{ ...s.btnPrimary, flex: 2, opacity: (dataSel && horarioSel) ? 1 : .4 }}
            disabled={!dataSel || !horarioSel}
            onClick={() => setPasso(4)}
          >
            Continuar →
          </button>
        </div>
      </div>
    </div>
  )
  }

  // ── Passo 4: Dados do cliente ──────────────────────────────────────────────
  if (passo === 4) return (
    <div style={s.page}>
      <Header />
      <div style={s.container}>
        {/* Resumo */}
        {erroFluxo && <div role="alert" aria-live="assertive" style={s.alerta}>{erroFluxo}</div>}
        <div style={{ ...s.card, borderColor: theme.green }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.green, marginBottom: 10 }}>📋 Resumo do agendamento</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: theme.muted }}>Serviço</span>
              <span style={{ fontWeight: 700 }}>{servicoSel?.nome}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: theme.muted }}>Profissional</span>
              <span style={{ fontWeight: 700 }}>{profissionalSel?.nome}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: theme.muted }}>Data</span>
              <span style={{ fontWeight: 700 }}>{new Date(dataSel + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: theme.muted }}>Horário</span>
              <span style={{ fontWeight: 700 }}>{horarioSel}</span>
            </div>
            {produtosUpsellSel.map(prod => (
              <div key={prod.id} style={{ display: 'flex', justifyContent: 'space-between', color: '#E0B24B' }}>
                <span>🧴 {prod.nome} ({prod.volume})</span>
                <span style={{ fontWeight: 700 }}>+ R$ {prod.preco.toFixed(2).replace('.', ',')}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${theme.line}`, paddingTop: 8, marginTop: 4 }}>
              <span style={{ color: theme.muted }}>Valor Total do Atendimento</span>
              <span style={{ fontWeight: 800, color: theme.green, fontSize: 17 }}>
                R$ {((parseFloat(servicoSel?.preco || 0) + produtosUpsellSel.reduce((acc, p) => acc + p.preco, 0))).toFixed(2).replace('.', ',')}
              </span>
            </div>
            {/* Box Promocional de Bilhetes da Sorte Integrado ao Sorteio Oficial */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(224, 178, 75, 0.12) 0%, rgba(20, 184, 122, 0.12) 100%)',
              border: '1px dashed rgba(224, 178, 75, 0.6)',
              borderRadius: 12,
              padding: '10px 14px',
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>🎟️</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#E0B24B', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                    Campanha Premiada Barbearia Dino
                  </div>
                  <div style={{ fontSize: 11, color: theme.cream, opacity: 0.85, marginTop: 2 }}>
                    Este atendimento gera bilhetes para o sorteio oficial (perfumaria conta 2x)!
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{
                  background: '#E0B24B',
                  color: '#0e1117',
                  fontWeight: 900,
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 20,
                  display: 'inline-block',
                  boxShadow: '0 2px 6px rgba(224, 178, 75, 0.3)'
                }}>
                  +{Math.max(1, Math.floor(((parseFloat(servicoSel?.preco || 0)) + (produtosUpsellSel.reduce((acc, p) => acc + p.preco, 0) * 2)) / 50))} Bilhete(s)
                </span>
              </div>
            </div>
          </div>
        </div>

        
        {/* CARROSSEL / VITRINE DE PERFUMARIA & PRODUTOS DINO (UPSELL) */}
        <div style={{
          ...s.card,
          background: 'linear-gradient(180deg, rgba(224,178,75,0.08) 0%, rgba(22,25,34,0.95) 100%)',
          border: '1.5px solid rgba(224,178,75,0.4)',
          borderRadius: 16,
          padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 26 }}>🧴</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#E0B24B', textTransform: 'uppercase', letterSpacing: '.6px' }}>
                Vitrine de Perfumaria & Cuidados Pessoais
              </div>
              <div style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>
                Deseja incluir produtos oficiais Dino para retirar no seu atendimento?
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PRODUTOS_UPSELL_DINO.map(prod => {
              const estaSelecionado = produtosUpsellSel.some(p => p.id === prod.id);
              return (
                <div
                  key={prod.id}
                  style={{
                    background: estaSelecionado ? 'rgba(224,178,75,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${estaSelecionado ? '#E0B24B' : theme.line}`,
                    borderRadius: 12,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    transition: 'all .2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 26 }}>{prod.emoji}</span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 800, fontSize: 13, color: theme.cream }}>{prod.nome}</span>
                        {prod.badge && (
                          <span style={{
                            fontSize: 9,
                            fontWeight: 800,
                            background: 'rgba(224,178,75,0.2)',
                            color: '#E0B24B',
                            padding: '2px 5px',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                          }}>
                            {prod.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>
                        {prod.descricao}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#E0B24B', marginTop: 4 }}>
                        R$ {prod.preco.toFixed(2).replace('.', ',')}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    style={{
                      background: estaSelecionado ? '#E0B24B' : 'transparent',
                      color: estaSelecionado ? '#000' : '#E0B24B',
                      border: '1.5px solid #E0B24B',
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all .15s ease',
                    }}
                    onClick={() => {
                      if (estaSelecionado) {
                        setProdutosUpsellSel(prev => prev.filter(p => p.id !== prod.id));
                      } else {
                        setProdutosUpsellSel(prev => [...prev, prod]);
                      }
                    }}
                  >
                    {estaSelecionado ? '✓ Incluído' : '+ Incluir'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={s.card}>
          <div style={s.stepTitle}>📱 Seus dados</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label htmlFor="agendamento-nome" style={s.label}>Seu nome completo *</label>
              <input
                id="agendamento-nome"
                name="nome"
                required
                autoComplete="name"
                maxLength={160}
                style={s.input}
                placeholder="Ex.: João Pedro da Silva"
                value={form.nome}
                onChange={e => { setForm(f => ({ ...f, nome: e.target.value })); setErroFluxo('') }}
              />
            </div>
            <div>
              <label htmlFor="agendamento-cpf" style={s.label}>CPF *</label>
              <input
                id="agendamento-cpf"
                name="cpf"
                required
                inputMode="numeric"
                maxLength={14}
                style={s.input}
                placeholder="000.000.000-00"
                value={form.cpf}
                onChange={e => {
                  const formatado = mascaraCpf(e.target.value)
                  setForm(f => ({ ...f, cpf: formatado }))
                  setErroFluxo('')
                }}
              />
              {form.cpf && form.cpf.replace(/\D/g, '').length === 11 && !validarCpf(form.cpf) && (
                <span style={{ fontSize: 11, color: theme.red, marginTop: 4, display: 'block' }}>
                  CPF inválido. Verifique os números digitados.
                </span>
              )}
            </div>
            <div>
              <label htmlFor="agendamento-telefone" style={s.label}>WhatsApp com DDD *</label>
              <input
                id="agendamento-telefone"
                name="telefone"
                required
                autoComplete="tel"
                inputMode="tel"
                maxLength={15}
                style={s.input}
                placeholder="(65) 99999-9999"
                type="tel"
                value={form.telefone}
                onChange={e => {
                  const formatado = mascaraTelefone(e.target.value)
                  setForm(f => ({ ...f, telefone: formatado }))
                  setErroFluxo('')
                }}
              />
            </div>
            <div>
              <label htmlFor="agendamento-observacoes" style={s.label}>Observações (opcional)</label>
              <textarea
                id="agendamento-observacoes"
                name="observacoes"
                maxLength={600}
                style={{ ...s.input, resize: 'vertical', minHeight: 70 }}
                placeholder="Alguma preferência ou informação importante?"
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              />
            </div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: theme.cream, lineHeight: 1.45 }}>
              <input type="checkbox" checked={consentimento} onChange={e => setConsentimento(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
              <span>Quero receber a confirmação e o lembrete deste agendamento pelo WhatsApp. Posso parar a qualquer momento respondendo SAIR.</span>
            </label>
            {politicas.sinal && <div style={{ fontSize: 13, color: theme.yellow, lineHeight: 1.45, border: `1px solid ${theme.line}`, borderRadius: 10, padding: 10 }}>
              Para garantir o horário, é cobrado um sinal de {politicas.sinal.tipo === 'fixo' ? `R$ ${Number(politicas.sinal.valor).toFixed(2).replace('.', ',')}` : `${politicas.sinal.valor}% do serviço`}, pago em até {politicas.sinal.prazoMinutos} minutos. O sinal é descontado no dia do atendimento.
            </div>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ ...s.btnSecondary, flex: 1 }} onClick={() => setPasso(3)}>← Voltar</button>
          <button
            style={{ ...s.btnPrimary, flex: 2, opacity: (form.nome && form.cpf && form.telefone && !enviando) ? 1 : .4 }}
            disabled={!form.nome || !form.cpf || !form.telefone || enviando}
            onClick={confirmarAgendamento}
          >
            {enviando ? 'Confirmando...' : '✅ Confirmar Agendamento'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── Passo 5: Confirmado ────────────────────────────────────────────────────
  if (passo === 5) return (
    <div style={s.page}>
      <Header />
      <div style={s.container}>
        <div role="status" aria-live="polite" style={s.sucesso}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: theme.green, marginBottom: 8 }}>
            Agendamento solicitado!
          </div>
          <div style={{ color: theme.muted, fontSize: 14, marginBottom: 24 }}>
            A solicitação entrou na agenda. Guarde o código abaixo: com ele e o seu telefone você pode remarcar ou cancelar pelo site até {politicas.cancelamentoHoras}h antes.
          </div>

          {pagamento && (
            <div style={{ background: theme.surface, border: `1px solid ${theme.yellow}`, borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'left' }}>
              <div style={{ fontWeight: 800, color: theme.yellow, marginBottom: 6 }}>Pague o sinal para garantir o horário</div>
              <div style={{ fontSize: 13, color: theme.muted, marginBottom: 12 }}>
                Sinal de R$ {Number(pagamento.valor).toFixed(2).replace('.', ',')}{pagamento.expiraEm ? `, até as ${new Date(pagamento.expiraEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}. Sem o pagamento no prazo, o horário é liberado.
              </div>
              {pagamento.url && <a href={pagamento.url} style={{ ...s.btnPrimary, display: 'block', textAlign: 'center', textDecoration: 'none' }}>Pagar com Pix ou cartão</a>}
              {pagamento.pixCopiaECola && <>
                <div style={{ fontSize: 11, color: theme.muted, marginBottom: 4 }}>PIX COPIA E COLA</div>
                <textarea readOnly value={pagamento.pixCopiaECola} style={{ ...s.input, fontSize: 11, minHeight: 70, resize: 'none' }} onFocus={(e) => e.target.select()} />
                <button type="button" style={{ ...s.btnPrimary, width: '100%', marginTop: 8 }} onClick={() => { navigator.clipboard?.writeText(pagamento.pixCopiaECola); setPixCopiado(true) }}>{pixCopiado ? 'Copiado!' : 'Copiar código Pix'}</button>
                <div style={{ fontSize: 12, color: theme.muted, marginTop: 8 }}>Depois de pagar, a barbearia confirma o recebimento e o horário fica garantido.</div>
              </>}
            </div>
          )}

          {/* Código de confirmação */}
          {agendamento?.codigo && (
            <div style={{
              background: theme.surface, border: `1px solid ${theme.line}`,
              borderRadius: 12, padding: '14px 20px', marginBottom: 20,
            }}>
              <div style={{ fontSize: 11, color: theme.muted, marginBottom: 4 }}>CÓDIGO DE CONFIRMAÇÃO</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: theme.green, letterSpacing: 2 }}>
                {agendamento.codigo}
              </div>
            </div>
          )}

          {/* Detalhes */}
          <div style={{ textAlign: 'left', background: theme.surface, borderRadius: 12, padding: 16, marginBottom: 20 }}>
            {[
              ['Serviço', servicoSel?.nome],
              ['Profissional', agendamento?.profissional || profissionalSel?.nome],
              ['Data', new Date(dataSel + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })],
              ['Horário', horarioSel],
              ['Valor', servicoSel?.preco_rotulo || `R$ ${parseFloat(servicoSel?.preco || 0).toFixed(2).replace('.', ',')}`],
            ].map(([label, valor]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${theme.line}`, fontSize: 13 }}>
                <span style={{ color: theme.muted }}>{label}</span>
                <span style={{ fontWeight: 700 }}>{valor}</span>
              </div>
            ))}
          </div>

          {/* Botão WhatsApp com T-Rex e Atendente */}
          {estabelecimento?.whatsapp && (
            <a
              href={linkWhatsApp(estabelecimento.whatsapp, `Olá! Solicitei o serviço ${servicoSel?.nome || 'agendamento'} para ${dataSel} às ${horarioSel}. Código: ${agendamento?.codigo || ''}`)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '16px 20px',
                background: 'linear-gradient(135deg, #25D366, #128C7E)', color: '#FFFFFF',
                borderRadius: 14, textDecoration: 'none',
                fontSize: 15, fontWeight: 800, marginBottom: 14,
                boxShadow: '0 4px 14px rgba(37,211,102,.35)',
                transition: 'transform .15s ease',
              }}
            >
              <span style={{ fontSize: 20 }}>💬</span>
              <span>Falar com o estabelecimento</span>
            </a>
          )}

          <button
            style={{ ...s.btnSecondary, width: '100%' }}
            onClick={() => { setPasso(1); setServicoSel(null); setProfissionalSel(null); setBarbeiroPreselecionado(null); setDataSel(''); setHorarioSel(''); setHorariosDisponiveis([]); setAgendamento(null); setErroFluxo(''); setForm({ nome: '', cpf: '', telefone: '', observacoes: '' }); setConsentimento(false); setConsentimentoEspera(false); setEspera({ aberta: false, periodo: 'qualquer', enviada: false, enviando: false, erro: '' }) }}
          >
            + Fazer outro agendamento
          </button>
        </div>
      </div>
    </div>
  )

  return null
}

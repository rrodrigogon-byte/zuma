/**
 * Modo barbeiro — app do profissional no celular: /barbeiro/:slug
 * Agenda do dia (só a do próprio profissional), ações do atendimento, encaixe,
 * bloqueio de horário, comissão do dia e do mês, avisos no celular (push) e uso
 * sem internet (mostra a última agenda carregada). Instalável no Android e no iPhone.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { lerAgenda, erroAgenda } from '../../lib/agenda-read'
import BarbeiroVendaRapida from './BarbeiroVendaRapida'
import BarbeiroPeriodo from './BarbeiroPeriodo'
import BarbeiroExtrato from './BarbeiroExtrato'
import BarbeiroGanhos from './BarbeiroGanhos'
import BarbeiroClientes from './BarbeiroClientes'
import BarbeiroClienteDetalhe from './BarbeiroClienteDetalhe'
import DinoSalesAssistantPanel from '../../components/barbearia/DinoSalesAssistantPanel'
import { useAuth } from '../../lib/auth'
import { DINO_BARBERSHOP_LOGO } from '../../lib/brand'
import InstalarApp from '../../components/pwa/InstalarApp'
import { ativarPush, desativarPush, situacaoPush, testarPush } from '../../lib/push-equipe'

const t = { bg: '#0E1014', surface: '#161922', card: '#1C202B', accent: '#6E7CE0', muted: '#A4AABE', cream: '#E8EAF2', line: '#2B3140', red: '#F27A89', green: '#3CC48B', yellow: '#E0B24B', blue: '#5AA9F0' }
const STATUS = {
  agendado: { rotulo: 'Agendado', cor: t.muted },
  confirmado: { rotulo: 'Confirmado', cor: t.blue },
  aguardando_confirmacao: { rotulo: 'Aguardando confirmação', cor: t.yellow },
  cancelado_falta_confirmacao: { rotulo: 'Cancelado por falta de confirmação', cor: t.red },
  em_atendimento: { rotulo: 'Em atendimento', cor: t.yellow },
  concluido: { rotulo: 'Concluído', cor: t.green },
  nao_compareceu: { rotulo: 'Não veio', cor: t.red },
  cancelado: { rotulo: 'Cancelado', cor: t.red },
}
const btn = { minHeight: 44, padding: '10px 14px', borderRadius: 12, border: 'none', background: t.accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 800, cursor: 'pointer' }
const btn2 = { ...btn, background: 'transparent', color: t.cream, border: `1px solid ${t.line}`, fontWeight: 700 }

function tocarSom(tipo = 'sucesso') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (tipo === 'meta') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.connect(g)
        g.connect(ctx.destination)
        o.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1)
        g.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.1)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.3)
        o.start(ctx.currentTime + idx * 0.1)
        o.stop(ctx.currentTime + idx * 0.1 + 0.35)
      })
      navigator.vibrate?.([60, 50, 60, 50, 120])
      return
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(tipo === 'iniciar' ? 440 : 587.33, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(tipo === 'iniciar' ? 660 : 880, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
    osc.start()
    osc.stop(ctx.currentTime + 0.22)
    navigator.vibrate?.([40])
  } catch (_) {}
}
const input = { width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 12px', borderRadius: 10, border: `1px solid ${t.line}`, background: t.surface, color: t.cream, font: 'inherit', fontSize: 16 }
const label = { display: 'grid', gap: 6, fontSize: 13, color: t.muted, fontWeight: 600 }
const card = { background: t.card, border: `1px solid ${t.line}`, borderRadius: 16, padding: 14 }

const reais = (v) => `R$\u00a0${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
// Horários sempre no fuso da barbearia (não no do celular).
let FUSO = 'America/Cuiaba'
const hora = (iso) => { const d = new Date(iso); return Number.isNaN(d.valueOf()) ? '--:--' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO }) }
// "AAAA-MM-DD" + "HH:MM" no fuso da barbearia → instante ISO (UTC).
export function isoNoFuso(dia, hhmm, fuso = FUSO) {
  const [a, m, d] = dia.split('-').map(Number); const [h, mi] = hhmm.split(':').map(Number)
  const palpite = Date.UTC(a, m - 1, d, h, mi)
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(palpite)).map((p) => [p.type, p.value]))
  const comoUtc = Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day), Number(partes.hour), Number(partes.minute))
  return new Date(palpite - (comoUtc - palpite)).toISOString()
}
function agoraNoFuso(minutos = 5) {
  const d = new Date(Date.now() + minutos * 60000)
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: FUSO, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]))
  const total = Math.ceil((Number(p.hour) * 60 + Number(p.minute)) / 5) * 5
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
const dataLonga = (dia) => { const txt = new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }); return txt.charAt(0).toUpperCase() + txt.slice(1) }
const somarDias = (dia, n) => { const d = new Date(`${dia}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0] || ''
const soDigitos = (v) => String(v || '').replace(/\D/g, '')
function linkWhatsapp(telefone) { const d = soDigitos(telefone); if (d.length < 10) return ''; return `https://wa.me/${d.startsWith('55') ? d : `55${d}`}` }
function linkWhatsappAgendamento(telefone, clienteNome, barbeiroNome, horaAgenda, servicoNome) {
  const d = soDigitos(telefone)
  if (d.length < 10) return ''
  const telCompleto = d.startsWith('55') ? d : `55${d}`
  const primCliente = primeiroNome(clienteNome) || 'amigo'
  const primBarber = primeiroNome(barbeiroNome) || 'seu barbeiro'
  const msg = encodeURIComponent(
    `Olá ${primCliente}! Sou o ${primBarber} da Barbearia Dino. 💈 Confirmando seu horário hoje às ${horaAgenda} (${servicoNome}). Te aguardo aqui na cadeira!`
  )
  return `https://wa.me/${telCompleto}?text=${msg}`
}

function Folha({ titulo, onFechar, children, podeFechar = true }) {
  useEffect(() => { const esc = (e) => e.key === 'Escape' && podeFechar && onFechar(); window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc) }, [onFechar, podeFechar])
  return <div role="dialog" aria-modal="true" aria-label={titulo} onClick={() => podeFechar && onFechar()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', background: t.surface, borderRadius: '20px 20px 0 0', padding: '16px 16px calc(16px + env(safe-area-inset-bottom))', boxSizing: 'border-box', display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 17 }}>{titulo}</strong>
        <button type="button" onClick={onFechar} disabled={!podeFechar} aria-label="Fechar" style={{ ...btn2, minHeight: 40, padding: '6px 12px' }}>Fechar</button>
      </div>
      {children}
    </div>
  </div>
}

function LoginEquipe({ isDino }) {
  const { login } = useAuth()
  const [form, setForm] = useState({ user: '', senha: '' })
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  async function entrar(e) {
    e.preventDefault(); setErro(''); setEnviando(true)
    try {
      const data = await api.post('/api/admin/login', { user: form.user, senha: form.senha })
      if (!data?.token) throw new Error('O servidor não retornou uma sessão válida. Tente novamente.')
      const usuario = data.user && typeof data.user === 'object' ? data.user : { nome: form.user, role: data.role || '' }
      login(data.token, usuario, false, data.sessao || {})
    } catch (error) { setErro(error.message || 'Não foi possível entrar.') } finally { setEnviando(false) }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', minHeight: '80vh' }}>
      <div style={{ background: t.card, padding: 30, borderRadius: 24, border: `1px solid ${t.line}`, width: '100%', maxWidth: 400, boxShadow: '0 20px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img src={isDino ? '/brand/dino-equipe-192.png' : '/favicon.svg'} alt="Logo" style={{ width: 80, height: 80, borderRadius: 20, marginBottom: 20, objectFit: 'cover' }} />
        <h1 style={{ fontSize: 24, fontWeight: 900, color: t.cream, margin: '0 0 8px' }}>{isDino ? 'Barbearia Dino' : 'Equipe App'}</h1>
        <p style={{ color: t.muted, fontSize: 14, margin: '0 0 30px', textAlign: 'center' }}>Acesse com seu e-mail de profissional para carregar sua agenda.</p>
        
        <form onSubmit={entrar} style={{ width: '100%', display: 'grid', gap: 16 }}>
          <label style={{ ...label, fontSize: 14 }}>
            E-mail ou usuário
            <input 
              style={{ ...input, height: 50, borderRadius: 14, fontSize: 16, background: '#10131A', border: `1px solid ${t.line}` }} 
              value={form.user} 
              onChange={(e) => setForm({ ...form, user: e.target.value })} 
              autoComplete="username" 
              placeholder="barbeiro@dino.com.br"
              required 
            />
          </label>
          <label style={{ ...label, fontSize: 14 }}>
            Senha
            <input 
              style={{ ...input, height: 50, borderRadius: 14, fontSize: 16, background: '#10131A', border: `1px solid ${t.line}` }} 
              type="password" 
              value={form.senha} 
              onChange={(e) => setForm({ ...form, senha: e.target.value })} 
              autoComplete="current-password" 
              placeholder="••••••••"
              required 
            />
          </label>
          {erro && <div style={{ color: t.red, fontWeight: 700, fontSize: 14, textAlign: 'center', background: 'rgba(242, 122, 137, 0.1)', padding: 10, borderRadius: 10 }}>{erro}</div>}
          <button type="submit" style={{ ...btn, background: t.accent, color: '#fff', fontSize: 17, height: 50, borderRadius: 14, marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: enviando ? 0.7 : 1 }} disabled={enviando}>
            {enviando ? 'Autenticando...' : 'Entrar no App'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function Avisos({ gestao, contexto = '' }) {
  const [estado, setEstado] = useState({ carregando: true })
  const [erro, setErro] = useState('')
  const [processando, setProcessando] = useState(false)
  const vivo = useRef(true)
  const pedido = useRef(0)
  const ocupado = useRef(false)
  const contextoRef = useRef(contexto)
  contextoRef.current = contexto
  const ativo = useCallback(() => vivo.current && contextoRef.current === contexto, [contexto])
  const carregar = useCallback(async () => {
    const id = ++pedido.current
    try { const resposta = await situacaoPush({ ativo }); if (ativo() && id === pedido.current) setEstado(resposta) }
    catch { if (ativo() && id === pedido.current) setEstado({ ok: false, motivo: 'erro' }) }
  }, [ativo])
  useEffect(() => { vivo.current = true; ocupado.current = false; setProcessando(false); setErro(''); setEstado({ carregando: true }); carregar(); return () => { vivo.current = false; pedido.current += 1 } }, [carregar])
  if (estado.carregando) return null
  const textos = {
    instalar_ios: 'No iPhone, os avisos funcionam com o app instalado na Tela de Início. Instale e abra pelo ícone.',
    bloqueado: 'As notificações estão bloqueadas para este app. Libere nas configurações do aparelho.',
    indisponivel: 'Este navegador não oferece Web Push compatível. No Android, tente Chrome ou Edge atualizado; no iPhone/iPad, use o app instalado na Tela de Início com iOS/iPadOS 16.4 ou posterior.',
    servidor: 'Os avisos no celular ainda não foram ligados pela administração.',
    erro: 'Não foi possível verificar os avisos agora.',
  }
  async function alternar(todos = false) {
    if (ocupado.current || !ativo()) return
    ocupado.current = true; setErro(''); setProcessando(true)
    try { if (estado.ativo) await desativarPush({ ativo }); else await ativarPush({ chavePublica: estado.chavePublica, todos, ativo }); if (ativo()) await carregar() }
    catch (error) { if (ativo()) setErro(error.message || 'Não foi possível alterar os avisos.') }
    finally { if (ativo()) { ocupado.current = false; setProcessando(false) } }
  }
  return <div style={{ ...card, display: 'grid', gap: 10 }}>
    <div style={{ fontWeight: 800 }}>Avisos no celular</div>
    {!estado.ok
      ? <div style={{ fontSize: 14, color: t.muted }}>{textos[estado.motivo] || textos.erro}</div>
      : <>
        <div style={{ fontSize: 14, color: t.muted }}>{estado.ativo ? `Ligados${estado.todos ? ' para toda a equipe' : ''}: você recebe aviso de agendamento novo, remarcado ou cancelado.` : estado.motivo === 'permissao_pendente' ? 'Toque em “Ligar avisos” para autorizar. O pedido de permissão só acontece neste gesto.' : 'Receba um aviso quando entrar, mudar ou cair um agendamento seu.'}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={{ ...(estado.ativo ? btn2 : btn), opacity: processando ? 0.7 : 1 }} disabled={processando} onClick={() => alternar(false)}>{processando ? 'Atualizando…' : estado.ativo ? 'Desligar avisos' : 'Ligar avisos'}</button>
          {!estado.ativo && gestao && <button type="button" style={{ ...btn2, opacity: processando ? 0.7 : 1 }} disabled={processando} onClick={() => alternar(true)}>Ligar para toda a equipe</button>}
          {estado.ativo && <button type="button" style={btn2} disabled={processando} onClick={() => testarPush({ ativo }).catch((e) => { if (ativo()) setErro(e.message) })}>Enviar teste</button>}
        </div>
      </>}
    {erro && <div role="alert" style={{ color: t.red, fontSize: 14, fontWeight: 600 }}>{erro}</div>}
  </div>
}


function RoletaModal({ onFechar, onGanhado }) {
  const [girando, setGirando] = useState(false);
  const [premio, setPremio] = useState(null);
  
  const premios = [
    { nome: 'Pix R$ 20,00', cor: '#10b981' },
    { nome: 'Pix R$ 10,00', cor: '#3b82f6' },
    { nome: 'Kit Cerveja', cor: '#f59e0b' },
    { nome: 'Corte Grátis', cor: '#8b5cf6' },
    { nome: 'Pix R$ 50,00', cor: '#ec4899' },
    { nome: 'Tente Novamente', cor: '#64748b' }
  ];

  function girar() {
    if (girando) return;
    setGirando(true);
    setPremio(null);
    tocarSom('iniciar');
    
    setTimeout(() => {
      const p = premios[Math.floor(Math.random() * (premios.length - 1))];
      setPremio(p);
      setGirando(false);
      tocarSom('meta');
      setTimeout(() => onGanhado?.(p), 3000);
    }, 4000);
  }

  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      {!premio ? (
        <>
          <div style={{ fontSize: 60, marginBottom: 20, animation: girando ? 'spin 0.2s linear infinite' : 'none', display: 'inline-block' }}>
            🎡
          </div>
          <h3 style={{ margin: '0 0 10px', fontSize: 20, color: t.cream }}>Sua vez de girar!</h3>
          <p style={{ margin: '0 0 20px', color: t.muted, fontSize: 14 }}>Você bateu a meta e ganhou o direito de rodar a Roleta de Prêmios do Salão.</p>
          <button disabled={girando} onClick={girar} style={{ ...btn, background: '#f59e0b', color: '#000', fontSize: 18, padding: '14px 30px', borderRadius: 30, textTransform: 'uppercase' }}>
            {girando ? 'Girando...' : 'Girar Roleta Agora!'}
          </button>
          
          <style>{`
            @keyframes spin { 100% { transform: rotate(360deg); } }
            @keyframes pulsePrize { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
          `}</style>
        </>
      ) : (
        <div style={{ animation: 'pulsePrize 1s ease-in-out infinite' }}>
          <div style={{ fontSize: 60, marginBottom: 10 }}>🎉</div>
          <h2 style={{ margin: 0, color: premio.cor, fontSize: 28, fontWeight: 900, textTransform: 'uppercase' }}>{premio.nome}</h2>
          <p style={{ margin: '10px 0 20px', color: t.cream, fontSize: 16 }}>Parabéns! Apresente esta tela na gerência para resgatar.</p>
          <button onClick={onFechar} style={{ ...btn2, width: '100%' }}>Voltar</button>
        </div>
      )}
    </div>
  );
}

export default function ModoBarbeiro() {
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { user, logout, empresaAtiva, lojaAtiva } = useAuth()
  const [abaAtiva, setAbaAtiva] = useState('agenda') // 'agenda', 'ganhos', 'metas', 'clientes'
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [painelRecebido, setPainel] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [acaoEmCurso, setAcaoEmCurso] = useState('')
  const [folha, setFolha] = useState(params.get('acao') === 'encaixe' ? 'encaixe' : '')
  const [profissionalId, setProfissionalId] = useState('')
  const [vendaAtendimento, setVendaAtendimento] = useState(null)
  const [clienteDetalheId, setClienteDetalheId] = useState(null)
  const [vendaPendente, setVendaPendente] = useState(false)
  const [atualizadoEm, setAtualizadoEm] = useState(null)
  const data = /^\d{4}-\d{2}-\d{2}$/.test(params.get('data') || '') ? params.get('data') : ''
  const pedido = useRef(0)
  const contextoPainel = JSON.stringify([data, profissionalId, user?.id, user?.email, empresaAtiva?.id, lojaAtiva?.id])
  const painel = painelRecebido?._contexto === contextoPainel ? painelRecebido : null

  const carregar = useCallback(async () => {
    if (!user) return
    const id = ++pedido.current
    setCarregando(true)
    try {
      const qs = new URLSearchParams()
      if (data) qs.set('data', data)
      if (profissionalId) qs.set('profissionalId', profissionalId)
      const resposta = await lerAgenda(() => api(`/api/admin/barbearia/modo-barbeiro${qs.toString() ? `?${qs}` : ''}`, { headers: { 'X-Kytto-Usuario': String(user.id ?? user.email ?? '') } }), { ativo: () => id === pedido.current })
      if (!resposta || id !== pedido.current) return
      if (resposta?.fuso) FUSO = resposta.fuso
      setPainel({ ...resposta, _contexto: contextoPainel }); setErro(''); setAtualizadoEm(resposta._offline?.salvoEm ? new Date(resposta._offline.salvoEm) : new Date())
    } catch (error) {
      if (id === pedido.current) setErro(error.code === 'EMPRESA_REQUIRED' ? 'Escolha a empresa no painel administrativo e volte para cá.' : erroAgenda(error))
    } finally { if (id === pedido.current) setCarregando(false) }
  }, [user, data, profissionalId, contextoPainel])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    const on = () => { setOnline(true); carregar() }
    const off = () => setOnline(false)
    const visivel = () => { if (document.visibilityState === 'visible') carregar() }
    window.addEventListener('online', on); window.addEventListener('offline', off); document.addEventListener('visibilitychange', visivel)
    const timer = setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) carregar() }, 60000)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); document.removeEventListener('visibilitychange', visivel); clearInterval(timer) }
  }, [carregar])
  useEffect(() => { document.documentElement.style.background = t.bg; return () => { document.documentElement.style.background = '' } }, [])

  const isDino = String(slug || painel?.slug || '').toLowerCase() === 'dino'
  const dia = data || painel?.data || painel?.hoje || painelRecebido?.hoje || ''
  const hoje = painel?.hoje || ''
  const irPara = (novo) => { const p = new URLSearchParams(params); if (!novo || novo === hoje) p.delete('data'); else p.set('data', novo); p.delete('acao'); setParams(p, { replace: true }) }
  const offline = !online || Boolean(painel?._offline)
  const podeOperar = !offline && !carregando && !erro

  const emAtendimentoAtual = useMemo(() => {
    return (painel?.agendamentos || []).find((a) => a.status === 'em_atendimento') || null
  }, [painel])

  const proximoCliente = useMemo(() => {
    return (painel?.agendamentos || [])
      .filter((a) => ['agendado', 'confirmado'].includes(a.status))
      .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora))[0] || null
  }, [painel])

  async function mudarStatus(agendamento, status, pergunta) {
    if (pergunta && !window.confirm(pergunta)) return
    setAcaoEmCurso(agendamento.id); setErro('')
    try {
      await api.patch(`/api/admin/barbearia/agenda/${agendamento.id}/status`, { status, registrarFinanceiro: false })
      if (status === 'em_atendimento') tocarSom('iniciar')
      else if (status === 'concluido') tocarSom('sucesso')
      await carregar()
    }
    catch (error) { setErro(error.message || 'Não foi possível atualizar o atendimento.') }
    finally { setAcaoEmCurso('') }
  }

  const agenda = useMemo(() => {
    const itens = (painel?.agendamentos || []).map((a) => ({ tipo: 'atendimento', quando: a.dataHora, a }))
      .concat((painel?.bloqueios || []).map((b) => ({ tipo: 'bloqueio', quando: b.inicio, b })))
    return itens.sort((x, y) => new Date(x.quando) - new Date(y.quando))
  }, [painel])

  const agendaFiltrada = useMemo(() => {
    if (filtroStatus === 'todos') return agenda
    if (filtroStatus === 'pendentes') return agenda.filter((i) => i.tipo === 'bloqueio' || ['agendado', 'confirmado'].includes(i.a.status))
    if (filtroStatus === 'na_cadeira') return agenda.filter((i) => i.tipo === 'atendimento' && i.a.status === 'em_atendimento')
    if (filtroStatus === 'concluidos') return agenda.filter((i) => i.tipo === 'atendimento' && i.a.status === 'concluido')
    return agenda
  }, [agenda, filtroStatus])

  const cabecalho = <header style={{ position: 'sticky', top: 0, zIndex: 20, background: t.surface, borderBottom: `1px solid ${t.line}`, padding: 'calc(10px + env(safe-area-inset-top)) 16px 10px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 560, margin: '0 auto' }}>
      {isDino && <img src={DINO_BARBERSHOP_LOGO} alt="" width="36" height="36" style={{ width: 36, height: 36, objectFit: 'contain', background: '#fff', borderRadius: 10, padding: 3 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{painel?.profissional ? `Olá, ${primeiroNome(painel.profissional.nome)}` : (isDino ? 'Dino Equipe' : 'Equipe')}</div>
        <div style={{ fontSize: 12, color: offline ? t.yellow : t.muted }}>{offline ? `${painel?._offline?.motivo === 'servidor' ? 'Servidor indisponível · cópia de' : 'Sem internet · agenda de'} ${atualizadoEm ? atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}` : carregando ? 'Atualizando…' : atualizadoEm ? `Atualizado às ${atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
      </div>
      {user && <button type="button" onClick={carregar} aria-label="Atualizar agenda" style={{ ...btn2, minHeight: 40, padding: '6px 12px' }}>↻</button>}
      {user && <button type="button" onClick={() => { if (window.confirm('Sair do app neste aparelho?')) logout() }} style={{ ...btn2, minHeight: 40, padding: '6px 12px' }}>Sair</button>}
    </div>
  </header>

  const corpo = !user
    ? <><LoginEquipe isDino={isDino} /><InstalarApp nomeApp={isDino ? 'o app Dino Equipe' : 'o app da equipe'} tema={t} /></>
    : <>
        {painel?.profissional && (
          <nav aria-label="Abas do app" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 4 }}>
            {[
              ['agenda', 'Agenda', '📅'],
              ['ganhos', 'Ganhos', '💰'],
              ['metas', 'Metas', '🎯'],
              ['clientes', 'Clientes', '👥'],
            ].map(([id, label, icon]) => {
              const ativo = abaAtiva === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAbaAtiva(id)}
                  style={{
                    ...btn2,
                    padding: '8px 4px',
                    fontSize: 12,
                    fontWeight: 800,
                    background: ativo ? t.accent : 'transparent',
                    color: ativo ? '#fff' : t.cream,
                    borderColor: ativo ? t.accent : t.line,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    borderRadius: 12,
                  }}
                >
                  <span>{icon}</span> {label}
                </button>
              )
            })}
          </nav>
        )}

        {abaAtiva === 'ganhos' && painel?.profissional && (
          <BarbeiroGanhos painel={painel} onAtualizar={carregar} />
        )}

        {abaAtiva === 'clientes' && painel?.profissional && (
          <BarbeiroClientes clientes={painel.clientesRecentes || []} profissionalNome={painel.profissional?.nome} />
        )}

        {abaAtiva === 'metas' && painel?.profissional && (
          <div style={{ display: 'grid', gap: 12 }}>
            {painel.gamificacao ? (
              <div style={{ ...card, padding: 16, background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 1) 100%)', border: '1.5px solid rgba(245, 158, 11, 0.45)', display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 16, color: '#fbbf24' }}>
                    <span style={{ fontSize: 20 }}>🎡</span> Metas Diárias & Roleta de Prêmios
                  </div>
                  {painel.gamificacao.girosPendentes?.length > 0 && (
                    <button type="button" onClick={() => setFolha('roleta')} style={{ background: '#f59e0b', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 11.5, padding: '6px 12px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                      🎡 Girar Roleta ({painel.gamificacao.girosPendentes.length})
                    </button>
                  )}
                </div>

                {painel.gamificacao.config?.metasDiarias?.servicosExtrasAtivo && (
                  <div style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12, padding: 12, display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: t.cream, fontSize: 13 }}>✂️ Serviços Extras Diários</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: painel.gamificacao.dia?.metaExtrasAtingida ? t.green : t.accent }}>
                        {painel.gamificacao.dia?.servicosExtras || 0} de {painel.gamificacao.config.metasDiarias.servicosExtrasQtd} extras
                      </span>
                    </div>
                    <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: painel.gamificacao.dia?.metaExtrasAtingida ? t.green : t.accent, width: `${Math.min(100, Math.round(((painel.gamificacao.dia?.servicosExtras || 0) / (painel.gamificacao.config.metasDiarias.servicosExtrasQtd || 1)) * 100))}%` }} />
                    </div>
                    <div style={{ fontSize: 11.5, color: painel.gamificacao.dia?.metaExtrasAtingida ? t.green : t.muted }}>
                      {painel.gamificacao.dia?.metaExtrasAtingida ? '✓ Parabéns! Meta de extras atingida hoje!' : `Faltam ${Math.max(0, painel.gamificacao.config.metasDiarias.servicosExtrasQtd - (painel.gamificacao.dia?.servicosExtras || 0))} extras para ganhar 1 giro na Roleta!`}
                    </div>
                  </div>
                )}

                {painel.gamificacao.config?.metasDiarias?.produtosAtivo && (
                  <div style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12, padding: 12, display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: t.cream, fontSize: 13 }}>🧴 Venda Diária de Produtos</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: painel.gamificacao.dia?.metaProdutosAtingida ? t.green : '#10b981' }}>
                        {painel.gamificacao.dia?.produtosQtd || 0} de {painel.gamificacao.config.metasDiarias?.produtosQtd ?? 2} un
                      </span>
                    </div>
                    <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: painel.gamificacao.dia?.metaProdutosAtingida ? t.green : '#10b981', width: `${painel.gamificacao.dia?.metaProdutosProgresso ?? 0}%` }} />
                    </div>
                    <div style={{ fontSize: 11.5, color: painel.gamificacao.dia?.metaProdutosAtingida ? t.green : t.muted }}>
                      {painel.gamificacao.dia?.metaProdutosAtingida ? '✓ Parabéns! Meta de produtos atingida hoje!' : `Falta ${Math.max(0, (painel.gamificacao.config.metasDiarias?.produtosQtd ?? 2) - (painel.gamificacao.dia?.produtosQtd || 0))} un para ganhar 1 giro na Roleta!`}
                    </div>
                  </div>
                )}

                {painel.gamificacao.config?.metasSemanais?.ativo && (
                  <div style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.25) 100%)', border: '1px solid rgba(245, 158, 11, 0.4)', padding: 14, borderRadius: 12, display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: '#fbbf24' }}>
                        🔥 {painel.gamificacao.config.metasSemanais.tituloDesafio || 'Desafio Semanal de Vendas'}
                      </span>
                      <span style={{ background: '#0f172a', color: '#fbbf24', fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 10 }}>
                        Semana
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#fef3c7' }}>
                      Vendas acumuladas na semana: <strong>{reais(painel.gamificacao.semana?.produtosValor || 0)} ({painel.gamificacao.semana?.produtosQtd || 0} un)</strong>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#fed7aa', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6 }}>
                      🎁 Premiação: <strong>{painel.gamificacao.config.metasSemanais.premiacaoDescricao || 'Super Bônus'}</strong>
                    </div>
                  </div>
                )}

                {/* TABELA DE PRÊMIOS DA ROLETA */}
                <div style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12, padding: 12, display: 'grid', gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: t.cream }}>🎁 Prêmios Disponíveis na Roleta Dino</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11.5 }}>
                    <div style={{ background: t.card, padding: '6px 8px', borderRadius: 8 }}>💵 R$ 50 no Pix</div>
                    <div style={{ background: t.card, padding: '6px 8px', borderRadius: 8 }}>💰 R$ 100 no Pix</div>
                    <div style={{ background: t.card, padding: '6px 8px', borderRadius: 8 }}>🏖️ Folga Bônus</div>
                    <div style={{ background: t.card, padding: '6px 8px', borderRadius: 8 }}>🍔 Almoço Completo</div>
                    <div style={{ background: t.card, padding: '6px 8px', borderRadius: 8 }}>🧴 Kit de Produtos</div>
                    <div style={{ background: t.card, padding: '6px 8px', borderRadius: 8 }}>☕ Café Especial</div>
                  </div>
                  <div style={{ fontSize: 11, color: t.muted, textAlign: 'center', marginTop: 4 }}>
                    Ao atingir as metas diárias, o Dino aciona a Roleta no painel para você girar ao vivo!
                  </div>
                </div>
              </div>
            ) : (
              <div style={card}>Gamificação não disponível no momento.</div>
            )}
          </div>
        )}

        {abaAtiva === 'agenda' && <>
        <nav aria-label="Escolher dia" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
          {[['Ontem', -1], ['Hoje', 0], ['Amanhã', 1]].map(([rotulo, n]) => {
            const alvo = hoje ? somarDias(hoje, n) : ''
            const ativo = alvo && alvo === dia
            return <button key={rotulo} type="button" disabled={!hoje} onClick={() => irPara(alvo)} aria-pressed={Boolean(ativo)} style={{ ...btn2, padding: '10px 6px', background: ativo ? t.accent : 'transparent', color: ativo ? '#fff' : t.cream, borderColor: ativo ? t.accent : t.line }}>{rotulo}</button>
          })}
          <input type="date" aria-label="Outro dia" value={dia} onChange={(e) => irPara(e.target.value)} style={{ ...input, gridColumn: '1 / -1' }} />
        </nav>
        {dia && <div style={{ fontSize: 14, color: t.muted }}>{dataLonga(dia)}</div>}

        {painel?.gestao && painel.profissionais?.length > 0 && <label style={label}>Ver a agenda de
          <select style={input} value={profissionalId || painel.profissional?.id || ''} onChange={(e) => setProfissionalId(e.target.value)}>
            {!painel.profissional && <option value="">Escolha…</option>}
            {painel.profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>}
        {painel && !painel.profissional && !painel.gestao && (
           <div style={{ ...card, background: 'rgba(242, 122, 137, 0.1)', borderColor: t.red, color: t.red, textAlign: 'center' }}>
             <strong>Opa!</strong> Seu usuário não está amarrado a nenhum barbeiro. 
             <br/><br/>
             Peça para o gerente ir no menu <strong>"Equipe"</strong> do Kytto e colocar seu e-mail de acesso no seu cadastro de profissional.
             
             <button type="button" onClick={logout} style={{ ...btn, background: t.red, color: '#fff', width: '100%', marginTop: 20 }}>
                Sair desta conta
             </button>
           </div>
        )}

        {erro && <div role="alert" style={{ ...card, borderColor: t.red, color: t.red, fontWeight: 600 }}>{erro}</div>}
        {painel && !painel.profissional && painel.gestao && <div style={card}>{painel.mensagem}</div>}

        {painel?.profissional && dia && <BarbeiroPeriodo dia={dia} profissionalId={profissionalId || painel.profissional.id} onDateChange={irPara} refreshKey={atualizadoEm?.valueOf()} />}
        {painel?.profissional && <>
          {/* HERO CARD INTELIGENTE: CLIENTE NA CADEIRA OU PRÓXIMO */}
          {emAtendimentoAtual ? (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(6, 78, 59, 0.28) 100%)',
                border: '1.5px solid #10B981',
                borderRadius: 16,
                padding: 14,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: '#10B981', color: '#0E1014', fontWeight: 800, fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>
                  ● NA CADEIRA AGORA
                </span>
                <span style={{ fontSize: 13, color: '#A7F3D0', fontWeight: 700 }}>
                  {hora(emAtendimentoAtual.dataHora)}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
                  {emAtendimentoAtual.clienteNome || 'Cliente'}
                </div>
                <div style={{ fontSize: 13, color: '#D1FAE5', marginTop: 2 }}>
                  {emAtendimentoAtual.servicoNome} · {reais(emAtendimentoAtual.valor)}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  style={{ ...btn, background: t.green, color: '#0E1014' }}
                  onClick={() => mudarStatus(emAtendimentoAtual, 'concluido', `Concluir o atendimento de ${primeiroNome(emAtendimentoAtual.clienteNome)}? O pagamento é recebido no caixa.`)}
                >
                  ✓ Concluir Atendimento
                </button>
                <button
                  type="button"
                  style={{ ...btn, background: t.accent }}
                  onClick={() => { setVendaAtendimento(emAtendimentoAtual); setFolha('venda') }}
                >
                  + Extra / Produto
                </button>
              </div>
            </div>
          ) : proximoCliente ? (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(30, 58, 138, 0.2) 100%)',
                border: '1.5px solid #3B82F6',
                borderRadius: 16,
                padding: 14,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: '#3B82F6', color: '#fff', fontWeight: 800, fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>
                  PRÓXIMO AGENDAMENTO
                </span>
                <span style={{ fontSize: 13, color: '#93C5FD', fontWeight: 700 }}>
                  {hora(proximoCliente.dataHora)}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
                  {proximoCliente.clienteNome || 'Cliente'}
                </div>
                <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>
                  {proximoCliente.servicoNome} · {proximoCliente.duracaoMinutos} min · {reais(proximoCliente.valor)}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  style={btn}
                  onClick={() => mudarStatus(proximoCliente, 'em_atendimento')}
                >
                  ▶ Iniciar Atendimento
                </button>
                {proximoCliente.clienteTelefone && (
                  <a
                    href={linkWhatsappAgendamento(proximoCliente.clienteTelefone, proximoCliente.clienteNome, painel.profissional?.nome, hora(proximoCliente.dataHora), proximoCliente.servicoNome)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...btn2, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    💬 WhatsApp
                  </a>
                )}
              </div>
            </div>
          ) : null}

          <section aria-label="Resumo do dia" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
            {[
              ['Atendimentos', `${painel.resumo.concluidos}/${painel.resumo.total}`, painel.resumo.faltas ? `${painel.resumo.faltas} não veio` : `${painel.resumo.pendentes} a atender`],
              ['Previsto no dia', reais(painel.resumo.previsto), 'valor dos serviços'],
              ['Minha comissão hoje', reais(painel.comissao.dia.repasse), `${painel.comissao.dia.atendimentos} pago(s)`],
              ['Comissão no mês', reais(painel.comissao.mes.repasse), `${painel.comissao.mes.atendimentos} atendimento(s)`],
            ].map(([titulo, valor, sub]) => <div key={titulo} style={{ ...card, padding: 12 }}>
              <div style={{ fontSize: 12, color: t.muted, fontWeight: 700 }}>{titulo}</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{valor}</div>
              <div style={{ fontSize: 12, color: t.muted }}>{sub}</div>
            </div>)}
          </section>

          {painel.gamificacao && (
            <div style={{ ...card, padding: 14, background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)', border: '1px solid rgba(245, 158, 11, 0.35)', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 14, color: '#fbbf24' }}>
                  <span>🎯</span> Minhas Metas & Roleta
                </div>
                {(painel.gamificacao.girosPendentes?.length > 0) && (
                  <button type="button" onClick={() => { setAbaAtiva('metas'); setFolha('roleta'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ background: '#f59e0b', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 11, padding: '4px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                    🎡 Girar ({painel.gamificacao.girosPendentes.length})
                  </button>
                )}
              </div>

              {painel.gamificacao.config?.metasDiarias?.servicosExtrasAtivo && (
                <div style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: t.cream }}>
                    <span>✂️ Extras hoje: <strong>{painel.gamificacao.dia?.servicosExtras || 0} de {painel.gamificacao.config.metasDiarias.servicosExtrasQtd}</strong></span>
                    {painel.gamificacao.dia?.metaExtrasAtingida
                      ? <span style={{ color: t.green, fontWeight: 800 }}>✓ Meta batida!</span>
                      : <span style={{ color: t.muted }}>Faltam {Math.max(0, painel.gamificacao.config.metasDiarias.servicosExtrasQtd - (painel.gamificacao.dia?.servicosExtras || 0))}</span>}
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: painel.gamificacao.dia?.metaExtrasAtingida ? t.green : t.accent, width: `${Math.min(100, Math.round(((painel.gamificacao.dia?.servicosExtras || 0) / (painel.gamificacao.config.metasDiarias.servicosExtrasQtd || 1)) * 100))}%` }} />
                  </div>
                </div>
              )}

              {painel.gamificacao.config?.metasDiarias?.produtosAtivo && (
                <div style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: t.cream }}>
                    <span>🧴 Produtos hoje: <strong>{painel.gamificacao.dia?.produtosQtd || 0} de {painel.gamificacao.config.metasDiarias?.produtosQtd ?? 2} un</strong></span>
                    {painel.gamificacao.dia?.metaProdutosAtingida
                      ? <span style={{ color: t.green, fontWeight: 800 }}>✓ Meta batida!</span>
                      : <span style={{ color: t.muted }}>Falta {Math.max(0, (painel.gamificacao.config.metasDiarias?.produtosQtd ?? 2) - (painel.gamificacao.dia?.produtosQtd || 0))} un</span>}
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: painel.gamificacao.dia?.metaProdutosAtingida ? t.green : '#10b981', width: `${painel.gamificacao.dia?.metaProdutosProgresso ?? 0}%` }} />
                  </div>
                </div>
              )}

              {painel.gamificacao.config?.metasSemanais?.ativo && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '6px 10px', borderRadius: 8, fontSize: 12 }}>
                  <span style={{ color: '#e2e8f0' }}>🔥 {painel.gamificacao.config.metasSemanais.tituloDesafio || 'Desafio da Semana'}:</span>
                  <strong style={{ color: '#fbbf24' }}>{reais(painel.gamificacao.semana?.produtosValor || 0)} ({painel.gamificacao.semana?.produtosQtd || 0} un)</strong>
                </div>
              )}
            </div>
          )}

          <button type="button" style={btn2} onClick={() => setFolha('extrato')}>Meu extrato e repasses</button>

          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            {[
              ['todos', `Todos (${agenda.filter((i) => i.tipo === 'atendimento').length})`],
              ['pendentes', `Pendentes (${agenda.filter((i) => i.tipo === 'atendimento' && ['agendado', 'confirmado'].includes(i.a.status)).length})`],
              ['na_cadeira', `Na cadeira (${agenda.filter((i) => i.tipo === 'atendimento' && i.a.status === 'em_atendimento').length})`],
              ['concluidos', `Concluídos (${agenda.filter((i) => i.tipo === 'atendimento' && i.a.status === 'concluido').length})`],
            ].map(([chave, rotulo]) => {
              const ativo = filtroStatus === chave
              return (
                <button
                  key={chave}
                  type="button"
                  onClick={() => setFiltroStatus(chave)}
                  style={{
                    ...btn2,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    background: ativo ? (chave === 'na_cadeira' ? t.green : t.accent) : 'transparent',
                    color: ativo ? (chave === 'na_cadeira' ? '#0E1014' : '#fff') : t.cream,
                    borderColor: ativo ? 'transparent' : t.line,
                    whiteSpace: 'nowrap',
                    borderRadius: 20,
                  }}
                >
                  {rotulo}
                </button>
              )
            })}
          </div>

          <section aria-label="Agenda" style={{ display: 'grid', gap: 10 }}>
            {agendaFiltrada.length === 0 && <div style={{ ...card, textAlign: 'center', color: t.muted }}>Nenhum atendimento neste filtro.</div>}
            {agendaFiltrada.map((item) => item.tipo === 'bloqueio'
              ? <div key={`b-${item.b.id}`} style={{ ...card, borderStyle: 'dashed', color: t.muted, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: 'rgba(239, 68, 68, 0.06)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🔒</span>
                  <span><strong style={{ color: t.cream }}>{hora(item.b.inicio)}–{hora(item.b.fim)}</strong> · {item.b.titulo}{item.b.geral ? ' (toda a equipe)' : ''}</span>
                </div>
                {podeOperar && (
                  <button
                    type="button"
                    style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    onClick={async () => {
                      if (!window.confirm(`Liberar este horário bloqueado (${item.b.titulo})?`)) return
                      try {
                        await api.delete(`/api/admin/barbearia/bloqueios/${item.b.id}`)
                        tocarSom('concluir')
                        await carregar()
                      } catch (e) {
                        alert('Não foi possível desativar o bloqueio.')
                      }
                    }}
                  >
                    Liberar
                  </button>
                )}
              </div>
              : (() => {
                const a = item.a
                const statusVisual = a.motivoCancelamento === 'falta_confirmacao' || a.confirmacaoAutomatica?.status === 'cancelado_falta_confirmacao'
                  ? 'cancelado_falta_confirmacao'
                  : a.status === 'confirmado' || a.confirmacaoAutomatica?.status === 'confirmado'
                    ? 'confirmado'
                    : a.status === 'agendado' && a.confirmacaoAutomatica?.ativa === true && ['aguardando', 'primeira_enviada', 'segunda_enviada'].includes(a.confirmacaoAutomatica.status)
                      ? 'aguardando_confirmacao'
                      : a.status
                const st = STATUS[statusVisual] || STATUS.agendado
                const destaque = painel.resumo.proximoId === a.id
                const ocupado = acaoEmCurso === a.id
                const zap = linkWhatsapp(a.clienteTelefone)
                return <article key={a.id} aria-label={`${hora(a.dataHora)} ${a.clienteNome}`} style={{ ...card, borderColor: destaque ? t.accent : t.line, display: 'grid', gap: 10, opacity: ['cancelado'].includes(a.status) ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      {destaque && <div style={{ fontSize: 11, fontWeight: 800, color: t.accent, textTransform: 'uppercase', letterSpacing: '.05em' }}>Próximo cliente</div>}
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{hora(a.dataHora)} · {a.clienteNome || 'Cliente'}</div>
                      <div style={{ fontSize: 14, color: t.muted }}>{a.servicoNome} · {a.duracaoMinutos} min · {reais(a.valor)}</div>
                      {a.observacoes && <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>Obs.: {a.observacoes}</div>}
                    </div>
                    <span style={{ flex: '0 0 auto', fontSize: 12, fontWeight: 800, color: st.cor, border: `1px solid ${st.cor}`, borderRadius: 999, padding: '3px 9px' }}>{st.rotulo}</span>
                  </div>
                  {podeOperar && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {a.status === 'agendado' && <button type="button" disabled={ocupado} style={btn2} onClick={() => mudarStatus(a, 'confirmado')}>Confirmar</button>}
                    {['agendado', 'confirmado'].includes(a.status) && <button type="button" disabled={ocupado} style={btn} onClick={() => mudarStatus(a, 'em_atendimento')}>Iniciar</button>}
                    {a.status === 'em_atendimento' && (
                      <>
                        <button type="button" disabled={ocupado} style={{ ...btn, background: t.green, color: '#0E1014' }} onClick={() => mudarStatus(a, 'concluido', `Concluir o atendimento de ${primeiroNome(a.clienteNome) || 'cliente'}? O pagamento será recebido no caixa.`)}>Concluir</button>
                        
                        <button type="button" disabled={ocupado} style={{ ...btn, background: '#8b5cf6', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => {
                          setVendaAtendimento(a); 
                          setFolha('checkout_qrcode');
                        }}>
                          📱 Cobrar na Cadeira (QR)
                        </button>
                      </>
                    )}
                    {['agendado', 'confirmado', 'em_atendimento'].includes(a.status) && <button type="button" disabled={ocupado} style={btn2} onClick={() => mudarStatus(a, 'nao_compareceu', 'Marcar que o cliente não veio?')}>Não veio</button>}
                    {['agendado', 'confirmado'].includes(a.status) && <button type="button" disabled={ocupado} style={{ ...btn2, color: t.red }} onClick={() => mudarStatus(a, 'cancelado', 'Cancelar este agendamento? O cliente será avisado se autorizou o WhatsApp.')}>Cancelar</button>}
                    {!['cancelado', 'nao_compareceu'].includes(a.status) && <button type="button" disabled={ocupado} style={btn} onClick={() => { setVendaAtendimento(a); setFolha('venda') }}>+ Serviços / produtos</button>}
                    {a.status === 'concluido' && <span style={{ fontSize: 13, color: t.muted, alignSelf: 'center' }}>Pagamento no caixa.</span>}
                  </div>}
                  {!['cancelado', 'nao_compareceu'].includes(a.status) && <DinoSalesAssistantPanel key={a.id} appointmentId={a.id} currentServiceId={a.servicoId} compact />}
                  {(a.clienteId && !['cancelado'].includes(a.status)) && (
                      <button type="button" disabled={ocupado} style={{ ...btn2, width: '100%', marginBottom: 8, display: 'flex', justifyContent: 'center', gap: 6 }} onClick={() => { setClienteDetalheId(a.clienteId); setFolha('cliente_detalhe'); }}>
                        👤 Ver Prontuário do Cliente
                      </button>
                    )}
                    {(a.clienteTelefone && !['cancelado'].includes(a.status)) && <div style={{ display: 'flex', gap: 8 }}>
                    <a href={`tel:${soDigitos(a.clienteTelefone)}`} style={{ ...btn2, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Ligar</a>
                    {zap && <a href={linkWhatsappAgendamento(a.clienteTelefone, a.clienteNome, painel.profissional?.nome, hora(a.dataHora), a.servicoNome)} target="_blank" rel="noopener noreferrer" style={{ ...btn2, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>💬 WhatsApp</a>}
                  </div>}
                </article>
              })())}
          </section>
        </>}

        {painel?.profissional && podeOperar && <button type="button" style={btn2} onClick={() => setFolha('bloqueio')}>Bloquear horário</button>}
        </>}
        {painel?.profissional && <Avisos key={JSON.stringify([user?.id, empresaAtiva?.id, lojaAtiva?.id])} contexto={JSON.stringify([user?.id, empresaAtiva?.id, lojaAtiva?.id])} gestao={painel.gestao} />}
        <InstalarApp nomeApp={isDino ? 'o app Dino Equipe' : 'o app da equipe'} tema={t} />
      </>

  return <div style={{ minHeight: '100vh', background: t.bg, color: t.cream, fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}>
    {cabecalho}
    <main style={{ maxWidth: 560, margin: '0 auto', padding: `14px 16px calc(${painel?.profissional && !offline ? 110 : 24}px + env(safe-area-inset-bottom))`, display: 'grid', gap: 12, boxSizing: 'border-box' }}>
      {corpo}
    </main>

    {/* BARRA DE NAVEGAÇÃO INFERIOR FIXA (BOTTOM NAV) */}
    {user && painel?.profissional && (
      <nav
        aria-label="Navegação do aplicativo"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          background: '#161922',
          borderTop: '1px solid #2B3140',
          padding: '6px 12px calc(6px + env(safe-area-inset-bottom))',
          zIndex: 30,
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.3)',
        }}
      >
        {[
          ['agenda', 'Agenda', '📅', agenda.filter((i) => i.tipo === 'atendimento' && ['agendado', 'confirmado'].includes(i.a.status)).length],
          ['ganhos', 'Ganhos', '💰', reais(painel?.comissao?.dia?.repasse || 0)],
          ['metas', 'Metas', '🎯', painel?.gamificacao?.girosPendentes?.length ? `${painel.gamificacao.girosPendentes.length}🎡` : null],
          ['clientes', 'Clientes', '👥', painel?.clientesRecentes?.filter((c) => c.statusRetorno === 'ideal_retorno').length || null],
        ].map(([id, label, icon, badge]) => {
          const ativo = abaAtiva === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => { setAbaAtiva(id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              style={{
                background: 'transparent',
                border: 'none',
                color: ativo ? '#6E7CE0' : '#A4AABE',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '4px 6px',
                cursor: 'pointer',
                position: 'relative',
                minWidth: 64,
              }}
            >
              <span style={{ fontSize: 20 }}>{icon}</span>
              <span style={{ fontSize: 11, fontWeight: ativo ? 800 : 600 }}>{label}</span>
              {badge && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: id === 'ganhos' ? -2 : 6,
                    background: id === 'ganhos' ? '#10B981' : id === 'metas' ? '#F59E0B' : '#EF4444',
                    color: '#000',
                    fontWeight: 800,
                    fontSize: 9.5,
                    padding: '1px 5px',
                    borderRadius: 10,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    )}

    {/* AÇÕES FLUTUANTES RÁPIDAS NA ABA AGENDA */}
    {user && painel?.profissional && podeOperar && abaAtiva === 'agenda' && (
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 'calc(54px + env(safe-area-inset-bottom))',
          padding: '6px 16px',
          zIndex: 25,
          pointerEvents: 'none',
        }}
      >
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, pointerEvents: 'auto' }}>
          <button type="button" style={{ ...btn, padding: '12px 6px', fontSize: 13, boxShadow: '0 4px 14px rgba(0,0,0,0.4)' }} onClick={() => setFolha('encaixe')}>+ Encaixe</button>
          <button type="button" style={{ ...btn2, padding: '12px 6px', fontSize: 13, background: t.surface, boxShadow: '0 4px 14px rgba(0,0,0,0.4)' }} onClick={() => { setVendaAtendimento(null); setFolha('venda') }}>+ Venda</button>
          <button type="button" style={{ ...btn2, padding: '12px 6px', fontSize: 13, background: 'rgba(245, 158, 11, 0.15)', borderColor: '#f59e0b', color: '#fbbf24', boxShadow: '0 4px 14px rgba(0,0,0,0.4)' }} onClick={() => setFolha('bloqueio')}>🔒 Bloquear</button>
        </div>
      </div>
    )}
    {folha === 'venda' && painel?.profissional && <Folha titulo="Serviços e produtos" podeFechar={!vendaPendente} onFechar={() => setFolha('')}><BarbeiroVendaRapida key={`${painel.profissional.id}-${vendaAtendimento?.id || 'avulsa'}`} profissional={painel.profissional} atendimento={vendaAtendimento} onEstadoChange={setVendaPendente} onPronto={carregar} /></Folha>}
    {folha === 'encaixe' && painel?.profissional && <FolhaEncaixe painel={painel} dia={dia} onFechar={() => { setFolha(''); const p = new URLSearchParams(params); p.delete('acao'); setParams(p, { replace: true }) }} onPronto={carregar} />}
    {folha === 'extrato' && painel?.profissional && <Folha titulo="Meu extrato" onFechar={() => setFolha('')}><BarbeiroExtrato profissionalId={painel.gestao ? painel.profissional.id : ''} /></Folha>}
    {folha === 'bloqueio' && painel?.profissional && <FolhaBloqueio painel={painel} dia={dia} onFechar={() => setFolha('')} onPronto={carregar} />}
  </div>
}

function FolhaEncaixe({ painel, dia, onFechar, onPronto }) {
  const ehHoje = dia === painel.hoje
  const [form, setForm] = useState({ clienteNome: '', clienteTelefone: '', servicoId: painel.servicos[0]?.id || '', hora: ehHoje ? agoraNoFuso() : '09:00', atenderAgora: ehHoje })
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  async function salvar(e) {
    e.preventDefault(); setErro(''); setEnviando(true)
    try {
      const r = await api.post('/api/admin/barbearia/agenda', {
        clienteNome: form.clienteNome, clienteTelefone: form.clienteTelefone, profissionalId: painel.profissional.id, servicoId: form.servicoId,
        dataHora: isoNoFuso(dia, form.hora), dataAgenda: dia, origem: 'admin', observacoes: 'Encaixe pelo app da equipe',
      })
      if (form.atenderAgora && r?.agendamento?.id) await api.patch(`/api/admin/barbearia/agenda/${r.agendamento.id}/status`, { status: 'em_atendimento', registrarFinanceiro: false }).catch(() => null)
      await onPronto(); onFechar()
    } catch (error) { setErro(error.message || 'Não foi possível encaixar.') } finally { setEnviando(false) }
  }
  return <Folha titulo="Encaixe de cliente" onFechar={onFechar}>
    <form onSubmit={salvar} style={{ display: 'grid', gap: 12 }}>
      <label style={label}>Nome do cliente<input style={input} value={form.clienteNome} onChange={(e) => setForm({ ...form, clienteNome: e.target.value })} required autoComplete="off" /></label>
      <label style={label}>Telefone (opcional)<input style={input} type="tel" inputMode="tel" value={form.clienteTelefone} onChange={(e) => setForm({ ...form, clienteTelefone: e.target.value })} placeholder="(65) 99999-9999" /></label>
      <label style={label}>Serviço<select style={input} value={form.servicoId} onChange={(e) => setForm({ ...form, servicoId: e.target.value })} required>
        {painel.servicos.map((s) => <option key={s.id} value={s.id}>{s.nome} · {reais(s.preco)} · {s.duracaoMinutos} min</option>)}
      </select></label>
      <label style={label}>Horário<input style={input} type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} required /></label>
      {ehHoje && <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 15 }}><input type="checkbox" checked={form.atenderAgora} onChange={(e) => setForm({ ...form, atenderAgora: e.target.checked })} style={{ width: 22, height: 22 }} />Já vou atender agora</label>}
      {erro && <div role="alert" style={{ color: t.red, fontWeight: 600, fontSize: 14 }}>{erro}</div>}
      <button type="submit" style={{ ...btn, opacity: enviando ? 0.7 : 1 }} disabled={enviando}>{enviando ? 'Salvando…' : 'Encaixar'}</button>
    </form>
  </Folha>
}

function FolhaBloqueio({ painel, dia, onFechar, onPronto }) {
  const [form, setForm] = useState({ titulo: 'Almoço', inicio: '12:00', fim: '13:00' })
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  async function salvar(e) {
    e.preventDefault(); setErro(''); setEnviando(true)
    try {
      await api.post('/api/admin/barbearia/bloqueios', {
        titulo: form.titulo, motivo: 'Pelo app da equipe', profissionalId: painel.profissional.id,
        inicio: isoNoFuso(dia, form.inicio), fim: isoNoFuso(dia, form.fim),
      })
      await onPronto(); onFechar()
    } catch (error) { setErro(error.message || 'Não foi possível bloquear.') } finally { setEnviando(false) }
  }
  const atalhosBarbeiro = [
    { label: '🥪 Almoço 12h-13h', titulo: 'Almoço', ini: '12:00', fim: '13:00' },
    { label: '🥗 Almoço 13h-14h', titulo: 'Almoço', ini: '13:00', fim: '14:00' },
    { label: '☕ Pausa 30 min', titulo: 'Pausa', ini: '16:00', fim: '16:30' },
    { label: '🏥 Compromisso', titulo: 'Compromisso', ini: '16:30', fim: '17:30' },
    { label: '🏖️ Folga Hoje', titulo: 'Folga', ini: '08:00', fim: '19:00' },
  ]
  return <Folha titulo="Bloquear horário na agenda" onFechar={onFechar}>
    <form onSubmit={salvar} style={{ display: 'grid', gap: 14 }}>
      <div>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.muted, marginBottom: 8 }}>Atalhos rápidos de 1 toque:</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {atalhosBarbeiro.map(at => (
            <button
              key={at.label}
              type="button"
              style={{ ...btn2, padding: '5px 10px', fontSize: 12, borderRadius: 8, background: form.titulo === at.titulo && form.inicio === at.ini ? '#f59e0b' : t.surface, color: form.titulo === at.titulo && form.inicio === at.ini ? '#000000' : t.cream, fontWeight: 700 }}
              onClick={() => setForm({ titulo: at.titulo, inicio: at.ini, fim: at.fim })}
            >
              {at.label}
            </button>
          ))}
        </div>
      </div>
      <label style={label}>Motivo do bloqueio<select style={input} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })}>
        {['Almoço', 'Pausa', 'Compromisso', 'Folga', 'Outro'].map((m) => <option key={m}>{m}</option>)}
      </select></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label style={label}>Das<input style={input} type="time" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} required /></label>
        <label style={label}>Até<input style={input} type="time" value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} required /></label>
      </div>
      <div style={{ fontSize: 13, color: t.muted }}>Os clientes não conseguem agendar com você nesse intervalo.</div>
      {erro && <div role="alert" style={{ color: t.red, fontWeight: 600, fontSize: 14 }}>{erro}</div>}
      <button type="submit" style={{ ...btn, opacity: enviando ? 0.7 : 1 }} disabled={enviando}>{enviando ? 'Salvando…' : 'Bloquear'}</button>
    </form>
  </Folha>
}

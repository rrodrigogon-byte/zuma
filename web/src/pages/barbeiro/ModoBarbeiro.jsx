/**
 * Modo barbeiro — app do profissional no celular: /barbeiro/:slug
 * Agenda do dia (só a do próprio profissional), ações do atendimento, encaixe,
 * bloqueio de horário, comissão do dia e do mês, avisos no celular (push) e uso
 * sem internet (mostra a última agenda carregada). Instalável no Android e no iPhone.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { DINO_BARBERSHOP_LOGO } from '../../lib/brand'
import InstalarApp from '../../components/pwa/InstalarApp'
import { ativarPush, desativarPush, situacaoPush, testarPush } from '../../lib/push-equipe'

const t = { bg: '#0E1014', surface: '#161922', card: '#1C202B', accent: '#6E7CE0', muted: '#A4AABE', cream: '#E8EAF2', line: '#2B3140', red: '#F27A89', green: '#3CC48B', yellow: '#E0B24B', blue: '#5AA9F0' }
const STATUS = {
  agendado: { rotulo: 'Agendado', cor: t.muted },
  confirmado: { rotulo: 'Confirmado', cor: t.blue },
  em_atendimento: { rotulo: 'Em atendimento', cor: t.yellow },
  concluido: { rotulo: 'Concluído', cor: t.green },
  nao_compareceu: { rotulo: 'Não veio', cor: t.red },
  cancelado: { rotulo: 'Cancelado', cor: t.red },
}
const btn = { minHeight: 44, padding: '10px 14px', borderRadius: 12, border: 'none', background: t.accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 800, cursor: 'pointer' }
const btn2 = { ...btn, background: 'transparent', color: t.cream, border: `1px solid ${t.line}`, fontWeight: 700 }
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

function Folha({ titulo, onFechar, children }) {
  useEffect(() => { const esc = (e) => e.key === 'Escape' && onFechar(); window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc) }, [onFechar])
  return <div role="dialog" aria-modal="true" aria-label={titulo} onClick={onFechar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', background: t.surface, borderRadius: '20px 20px 0 0', padding: '16px 16px calc(16px + env(safe-area-inset-bottom))', boxSizing: 'border-box', display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 17 }}>{titulo}</strong>
        <button type="button" onClick={onFechar} aria-label="Fechar" style={{ ...btn2, minHeight: 40, padding: '6px 12px' }}>Fechar</button>
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
  return <form onSubmit={entrar} style={{ ...card, display: 'grid', gap: 12 }}>
    <div style={{ fontSize: 17, fontWeight: 800 }}>Entrar no app da equipe</div>
    <div style={{ fontSize: 14, color: t.muted }}>Use o mesmo login do sistema{isDino ? ' da Dino' : ''}.</div>
    <label style={label}>E-mail ou usuário<input style={input} value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} autoComplete="username" required /></label>
    <label style={label}>Senha<input style={input} type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} autoComplete="current-password" required /></label>
    {erro && <div role="alert" style={{ color: t.red, fontWeight: 600, fontSize: 14 }}>{erro}</div>}
    <button type="submit" style={{ ...btn, opacity: enviando ? 0.7 : 1 }} disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
  </form>
}

function Avisos({ gestao }) {
  const [estado, setEstado] = useState({ carregando: true })
  const [erro, setErro] = useState('')
  const carregar = useCallback(() => { situacaoPush().then(setEstado).catch(() => setEstado({ ok: false, motivo: 'erro' })) }, [])
  useEffect(() => { carregar() }, [carregar])
  if (estado.carregando) return null
  const textos = {
    instalar_ios: 'No iPhone, os avisos funcionam com o app instalado na Tela de Início. Instale e abra pelo ícone.',
    bloqueado: 'As notificações estão bloqueadas para este app. Libere nas configurações do aparelho.',
    navegador: 'Este navegador não recebe notificações.',
    servidor: 'Os avisos no celular ainda não foram ligados pela administração.',
    erro: 'Não foi possível verificar os avisos agora.',
  }
  async function alternar(todos = false) {
    setErro('')
    try { if (estado.ativo) await desativarPush(); else await ativarPush({ chavePublica: estado.chavePublica, todos }) ; carregar() }
    catch (error) { setErro(error.message || 'Não foi possível alterar os avisos.') }
  }
  return <div style={{ ...card, display: 'grid', gap: 10 }}>
    <div style={{ fontWeight: 800 }}>Avisos no celular</div>
    {!estado.ok
      ? <div style={{ fontSize: 14, color: t.muted }}>{textos[estado.motivo] || textos.erro}</div>
      : <>
        <div style={{ fontSize: 14, color: t.muted }}>{estado.ativo ? `Ligados${estado.todos ? ' para toda a equipe' : ''}: você recebe aviso de agendamento novo, remarcado ou cancelado.` : 'Receba um aviso quando entrar, mudar ou cair um agendamento seu.'}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={estado.ativo ? btn2 : btn} onClick={() => alternar(false)}>{estado.ativo ? 'Desligar avisos' : 'Ligar avisos'}</button>
          {!estado.ativo && gestao && <button type="button" style={btn2} onClick={() => alternar(true)}>Ligar para toda a equipe</button>}
          {estado.ativo && <button type="button" style={btn2} onClick={() => testarPush().catch((e) => setErro(e.message))}>Enviar teste</button>}
        </div>
      </>}
    {erro && <div role="alert" style={{ color: t.red, fontSize: 14, fontWeight: 600 }}>{erro}</div>}
  </div>
}

export default function ModoBarbeiro() {
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { user, logout } = useAuth()
  const [painel, setPainel] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [acaoEmCurso, setAcaoEmCurso] = useState('')
  const [folha, setFolha] = useState(params.get('acao') === 'encaixe' ? 'encaixe' : '')
  const [profissionalId, setProfissionalId] = useState('')
  const [atualizadoEm, setAtualizadoEm] = useState(null)
  const data = /^\d{4}-\d{2}-\d{2}$/.test(params.get('data') || '') ? params.get('data') : ''
  const pedido = useRef(0)

  const carregar = useCallback(async () => {
    if (!user) return
    const id = ++pedido.current
    setCarregando(true)
    try {
      const qs = new URLSearchParams()
      if (data) qs.set('data', data)
      if (profissionalId) qs.set('profissionalId', profissionalId)
      const resposta = await api(`/api/admin/barbearia/modo-barbeiro${qs.toString() ? `?${qs}` : ''}`, { headers: { 'X-Kytto-Usuario': String(user.id ?? user.email ?? '') } })
      if (id !== pedido.current) return
      if (resposta?.fuso) FUSO = resposta.fuso
      setPainel(resposta); setErro(''); setAtualizadoEm(resposta._offline?.salvoEm ? new Date(resposta._offline.salvoEm) : new Date())
    } catch (error) {
      if (id === pedido.current) setErro(error.code === 'EMPRESA_REQUIRED' ? 'Escolha a empresa no painel administrativo e volte para cá.' : (error.message || 'Não foi possível carregar a agenda.'))
    } finally { if (id === pedido.current) setCarregando(false) }
  }, [user, data, profissionalId])

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
  const dia = data || painel?.data || painel?.hoje || ''
  const hoje = painel?.hoje || ''
  const irPara = (novo) => { const p = new URLSearchParams(params); if (!novo || novo === hoje) p.delete('data'); else p.set('data', novo); p.delete('acao'); setParams(p, { replace: true }) }
  const offline = !online || Boolean(painel?._offline)

  async function mudarStatus(agendamento, status, pergunta) {
    if (pergunta && !window.confirm(pergunta)) return
    setAcaoEmCurso(agendamento.id); setErro('')
    try { await api.patch(`/api/admin/barbearia/agenda/${agendamento.id}/status`, { status, registrarFinanceiro: false }); await carregar() }
    catch (error) { setErro(error.message || 'Não foi possível atualizar o atendimento.') }
    finally { setAcaoEmCurso('') }
  }

  const agenda = useMemo(() => {
    const itens = (painel?.agendamentos || []).map((a) => ({ tipo: 'atendimento', quando: a.dataHora, a }))
      .concat((painel?.bloqueios || []).map((b) => ({ tipo: 'bloqueio', quando: b.inicio, b })))
    return itens.sort((x, y) => new Date(x.quando) - new Date(y.quando))
  }, [painel])

  const cabecalho = <header style={{ position: 'sticky', top: 0, zIndex: 20, background: t.surface, borderBottom: `1px solid ${t.line}`, padding: 'calc(10px + env(safe-area-inset-top)) 16px 10px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 560, margin: '0 auto' }}>
      {isDino && <img src={DINO_BARBERSHOP_LOGO} alt="" width="36" height="36" style={{ width: 36, height: 36, objectFit: 'contain', background: '#fff', borderRadius: 10, padding: 3 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{painel?.profissional ? `Olá, ${primeiroNome(painel.profissional.nome)}` : (isDino ? 'Dino Equipe' : 'Equipe')}</div>
        <div style={{ fontSize: 12, color: offline ? t.yellow : t.muted }}>{offline ? `Sem internet · agenda de ${atualizadoEm ? atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}` : carregando ? 'Atualizando…' : atualizadoEm ? `Atualizado às ${atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
      </div>
      {user && <button type="button" onClick={carregar} aria-label="Atualizar agenda" style={{ ...btn2, minHeight: 40, padding: '6px 12px' }}>↻</button>}
      {user && <button type="button" onClick={() => { if (window.confirm('Sair do app neste aparelho?')) logout() }} style={{ ...btn2, minHeight: 40, padding: '6px 12px' }}>Sair</button>}
    </div>
  </header>

  const corpo = !user
    ? <><LoginEquipe isDino={isDino} /><InstalarApp nomeApp={isDino ? 'o app Dino Equipe' : 'o app da equipe'} tema={t} /></>
    : <>
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

        {erro && <div role="alert" style={{ ...card, borderColor: t.red, color: t.red, fontWeight: 600 }}>{erro}</div>}
        {painel && !painel.profissional && <div style={card}>{painel.mensagem}</div>}

        {painel?.profissional && <>
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

          <section aria-label="Agenda" style={{ display: 'grid', gap: 10 }}>
            {agenda.length === 0 && <div style={{ ...card, textAlign: 'center', color: t.muted }}>Nenhum atendimento neste dia.</div>}
            {agenda.map((item) => item.tipo === 'bloqueio'
              ? <div key={`b-${item.b.id}`} style={{ ...card, borderStyle: 'dashed', color: t.muted, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span><strong style={{ color: t.cream }}>{hora(item.b.inicio)}–{hora(item.b.fim)}</strong> · {item.b.titulo}{item.b.geral ? ' (toda a equipe)' : ''}</span>
              </div>
              : (() => {
                const a = item.a
                const st = STATUS[a.status] || STATUS.agendado
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
                  {!offline && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {a.status === 'agendado' && <button type="button" disabled={ocupado} style={btn2} onClick={() => mudarStatus(a, 'confirmado')}>Confirmar</button>}
                    {['agendado', 'confirmado'].includes(a.status) && <button type="button" disabled={ocupado} style={btn} onClick={() => mudarStatus(a, 'em_atendimento')}>Iniciar</button>}
                    {a.status === 'em_atendimento' && <button type="button" disabled={ocupado} style={{ ...btn, background: t.green, color: '#0E1014' }} onClick={() => mudarStatus(a, 'concluido', `Concluir o atendimento de ${primeiroNome(a.clienteNome) || 'cliente'}? O pagamento é recebido no caixa.`)}>Concluir</button>}
                    {['agendado', 'confirmado', 'em_atendimento'].includes(a.status) && <button type="button" disabled={ocupado} style={btn2} onClick={() => mudarStatus(a, 'nao_compareceu', 'Marcar que o cliente não veio?')}>Não veio</button>}
                    {['agendado', 'confirmado'].includes(a.status) && <button type="button" disabled={ocupado} style={{ ...btn2, color: t.red }} onClick={() => mudarStatus(a, 'cancelado', 'Cancelar este agendamento? O cliente será avisado se autorizou o WhatsApp.')}>Cancelar</button>}
                    {a.status === 'concluido' && <span style={{ fontSize: 13, color: t.muted, alignSelf: 'center' }}>Pagamento no caixa.</span>}
                  </div>}
                  {(a.clienteTelefone && !['cancelado'].includes(a.status)) && <div style={{ display: 'flex', gap: 8 }}>
                    <a href={`tel:${soDigitos(a.clienteTelefone)}`} style={{ ...btn2, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Ligar</a>
                    {zap && <a href={zap} target="_blank" rel="noopener noreferrer" style={{ ...btn2, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>WhatsApp</a>}
                  </div>}
                </article>
              })())}
          </section>
        </>}

        {painel?.profissional && <Avisos gestao={painel.gestao} />}
        <InstalarApp nomeApp={isDino ? 'o app Dino Equipe' : 'o app da equipe'} tema={t} />
      </>

  return <div style={{ minHeight: '100vh', background: t.bg, color: t.cream, fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}>
    {cabecalho}
    <main style={{ maxWidth: 560, margin: '0 auto', padding: `14px 16px calc(${painel?.profissional && !offline ? 96 : 24}px + env(safe-area-inset-bottom))`, display: 'grid', gap: 12, boxSizing: 'border-box' }}>
      {corpo}
    </main>
    {user && painel?.profissional && !offline && <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: t.surface, borderTop: `1px solid ${t.line}`, padding: '10px 16px calc(10px + env(safe-area-inset-bottom))', zIndex: 20 }}>
      <div style={{ maxWidth: 560, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button type="button" style={btn} onClick={() => setFolha('encaixe')}>+ Encaixe</button>
        <button type="button" style={btn2} onClick={() => setFolha('bloqueio')}>Bloquear horário</button>
      </div>
    </div>}
    {folha === 'encaixe' && painel?.profissional && <FolhaEncaixe painel={painel} dia={dia} onFechar={() => { setFolha(''); const p = new URLSearchParams(params); p.delete('acao'); setParams(p, { replace: true }) }} onPronto={carregar} />}
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
  return <Folha titulo="Bloquear horário" onFechar={onFechar}>
    <form onSubmit={salvar} style={{ display: 'grid', gap: 12 }}>
      <label style={label}>Motivo<select style={input} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })}>
        {['Almoço', 'Pausa', 'Compromisso', 'Folga'].map((m) => <option key={m}>{m}</option>)}
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

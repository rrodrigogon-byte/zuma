/**
 * Página Pública: Agendamento Online
 * Acessível sem login — link compartilhável via WhatsApp/Instagram
 * Rota: /agendar/:slug (slug do tenant)
 */
import { useState, useEffect } from 'react'
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

const s = {
  page: {
    minHeight: '100vh',
    background: theme.bg,
    color: theme.cream,
    fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
    padding: '0 0 60px',
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
  container: { maxWidth: 520, margin: '0 auto', padding: '24px 16px' },
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
    textAlign: 'center', padding: '40px 24px',
    background: theme.card, border: `1px solid ${theme.line}`,
    borderRadius: 20,
  },
  alerta: {
    padding: '12px 14px', marginBottom: 16, borderRadius: 10,
    border: `1px solid ${theme.red}`, background: 'rgba(242,122,137,.1)',
    color: theme.red, fontSize: 13, fontWeight: 700, lineHeight: 1.45,
  },
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AgendamentoOnline() {
  const { slug } = useParams()
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
  const [dataSel, setDataSel] = useState('')
  const [horarioSel, setHorarioSel] = useState('')
  const [form, setForm] = useState({ nome: '', telefone: '', observacoes: '' })
  const [agendamento, setAgendamento] = useState(null)
  const [consentimento, setConsentimento] = useState(false)
  // Consentimento separado por finalidade: aviso de vaga ≠ confirmação/lembrete do agendamento.
  const [consentimentoEspera, setConsentimentoEspera] = useState(false)
  const [politicas, setPoliticas] = useState({ cancelamentoHoras: 4 })
  const [searchParams] = useSearchParams()
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
    const slugPagamento = searchParams.get('slug') || searchParams.get('invoice_slug')
    if (!orderNsu || !transactionNsu || !slugPagamento) { setAvisoPagamento({ tom: 'alerta', texto: 'Recebemos sua volta do pagamento. Se você pagou, a confirmação chega em instantes.' }); return }
    fetch(`${API}/api/publico/agendamento/${encodeURIComponent(slug)}/pagamento/verificar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_nsu: orderNsu, transaction_nsu: transactionNsu, slug: slugPagamento }),
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
      setProfissionais(data.profissionais || [])
      setServicos(data.servicos || [])
      if (data.politicas) setPoliticas(data.politicas)
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
      if (!res.ok || !data.ok) throw new Error(data.error || 'Não foi possível consultar os horários.')
      setHorariosDisponiveis(Array.isArray(data.horarios) ? data.horarios : [])
    } catch (err) {
      setErroFluxo(err.message || 'Não foi possível consultar os horários.')
    } finally {
      setCarregandoHorarios(false)
    }
  }

  useEffect(() => {
    if (passo === 3 && profissionalSel && dataSel && servicoSel) carregarHorarios()
  }, [passo, dataSel, profissionalSel, servicoSel])

  async function confirmarAgendamento() {
    const nome = form.nome.trim()
    const telefone = form.telefone.replace(/\D/g, '')
    if (nome.length < 2 || telefone.length < 10) {
      setErroFluxo('Informe seu nome e um telefone válido com DDD.')
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
          cliente_telefone: telefone,
          observacoes: form.observacoes,
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
        <div style={s.card}>
          <div style={s.stepTitle}>🛠️ Qual serviço deseja?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {servicos.length === 0 && <p role="status" style={{ color: theme.muted, fontSize: 13 }}>Nenhum serviço está habilitado para agendamento online.</p>}
            {servicos.map(sv => (
              <button
                type="button"
                key={sv.id}
                aria-pressed={servicoSel?.id === sv.id}
                style={s.servicoCard(servicoSel?.id === sv.id)}
                onClick={() => { setServicoSel(sv); setErroFluxo('') }}
              >
                <span>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>{sv.nome}</span>
                  <span style={{ display: 'block', color: theme.muted, fontSize: 12, marginTop: 2 }}>⏱ {sv.duracao_min} min</span>
                </span>
                <span style={{ textAlign: 'right' }}>
                  <span style={{ display: 'block', fontWeight: 800, color: theme.green, fontSize: 15 }}>
                    {sv.preco_rotulo || `R$ ${parseFloat(sv.preco).toFixed(2).replace('.', ',')}`}
                  </span>
                  {servicoSel?.id === sv.id && <span aria-hidden="true" style={{ display: 'block', fontSize: 16, marginTop: 2 }}>✓</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
        <button
          style={{ ...s.btnPrimary, opacity: servicoSel ? 1 : .4 }}
          disabled={!servicoSel}
          onClick={() => setPasso(2)}
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
          <div style={s.grid2}>
            {/* Opção "Qualquer disponível" */}
            <button
              type="button"
              aria-pressed={profissionalSel?.id === 'qualquer'}
              style={s.profCard(profissionalSel?.id === 'qualquer')}
              onClick={() => { setProfissionalSel({ id: 'qualquer', nome: 'Qualquer disponível' }); setErroFluxo('') }}
            >
              <span aria-hidden="true" style={{ display: 'block', fontSize: 28, marginBottom: 6 }}>🎲</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>Qualquer disponível</span>
            </button>
            {profissionais.map(p => (
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
  if (passo === 3) return (
    <div style={s.page}>
      <Header />
      <div style={s.container}>
        <div style={s.card}>
          <div style={s.stepTitle}>📅 Quando prefere?</div>
          {erroFluxo && <div role="alert" aria-live="assertive" style={s.alerta}>{erroFluxo}</div>}
          <label htmlFor="agendamento-data" style={s.label}>Data</label>
          <input
            id="agendamento-data"
            type="date"
            min={hoje}
            value={dataSel}
            onChange={e => { setDataSel(e.target.value); setHorarioSel(''); setEspera(x => ({ ...x, aberta: false, enviada: false, erro: '' })) }}
            style={{ ...s.input, marginBottom: 20 }}
          />
          {dataSel && (
            <>
              <label style={s.label}>Horário disponível</label>
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
                      aria-label={`${h.horario}${h.disponivel ? '' : ', indisponível'}`}
                      style={s.horarioBtn(horarioSel === h.horario, !h.disponivel)}
                      onClick={() => { setHorarioSel(h.horario); setErroFluxo('') }}
                    >
                      {h.horario}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ ...s.btnSecondary, flex: 1 }} onClick={() => setPasso(2)}>← Voltar</button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${theme.line}`, paddingTop: 8, marginTop: 4 }}>
              <span style={{ color: theme.muted }}>Valor</span>
              <span style={{ fontWeight: 800, color: theme.green, fontSize: 15 }}>
                {servicoSel?.preco_rotulo || `R$ ${parseFloat(servicoSel?.preco || 0).toFixed(2).replace('.', ',')}`}
              </span>
            </div>
          </div>
        </div>

        <div style={s.card}>
          <div style={s.stepTitle}>📱 Seus dados</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label htmlFor="agendamento-nome" style={s.label}>Seu nome *</label>
              <input
                id="agendamento-nome"
                name="nome"
                required
                autoComplete="name"
                maxLength={160}
                style={s.input}
                placeholder="Como prefere ser chamado(a)?"
                value={form.nome}
                onChange={e => { setForm(f => ({ ...f, nome: e.target.value })); setErroFluxo('') }}
              />
            </div>
            <div>
              <label htmlFor="agendamento-telefone" style={s.label}>Telefone com DDD *</label>
              <input
                id="agendamento-telefone"
                name="telefone"
                required
                autoComplete="tel"
                inputMode="tel"
                maxLength={18}
                style={s.input}
                placeholder="(65) 9 9999-9999"
                type="tel"
                value={form.telefone}
                onChange={e => { setForm(f => ({ ...f, telefone: e.target.value })); setErroFluxo('') }}
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
            style={{ ...s.btnPrimary, flex: 2, opacity: (form.nome && form.telefone && !enviando) ? 1 : .4 }}
            disabled={!form.nome || !form.telefone || enviando}
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

          {/* Botão WhatsApp */}
          {estabelecimento?.whatsapp && (
            <a
              href={linkWhatsApp(estabelecimento.whatsapp, `Olá! Solicitei o serviço ${servicoSel?.nome} para ${dataSel} às ${horarioSel}. Código: ${agendamento?.codigo}`)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block', padding: '14px',
                background: '#2D6F9E', color: '#fff',
                borderRadius: 12, textDecoration: 'none',
                fontSize: 14, fontWeight: 800, marginBottom: 12,
              }}
            >
              💬 Falar com o estabelecimento
            </a>
          )}

          <button
            style={{ ...s.btnSecondary, width: '100%' }}
            onClick={() => { setPasso(1); setServicoSel(null); setProfissionalSel(null); setDataSel(''); setHorarioSel(''); setHorariosDisponiveis([]); setAgendamento(null); setErroFluxo(''); setForm({ nome: '', telefone: '', observacoes: '' }); setConsentimento(false); setConsentimentoEspera(false); setEspera({ aberta: false, periodo: 'qualquer', enviada: false, enviando: false, erro: '' }) }}
          >
            + Fazer outro agendamento
          </button>
        </div>
      </div>
    </div>
  )

  return null
}

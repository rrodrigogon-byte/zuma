/**
 * App do cliente (instalável): /minha/:slug
 * Agendar, meus horários, clube, cashback, avaliação e vale-presente num só lugar.
 * "Minha conta" pede o código de um agendamento + o telefone (no corpo, nunca
 * na URL) e não guarda nada no aparelho.
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DINO_BARBERSHOP_LOGO } from '../../lib/brand'

const API = import.meta.env.VITE_API_URL || ''

const theme = { bg: '#0E1014', surface: '#161922', card: '#1C202B', accent: '#6E7CE0', muted: '#A4AABE', cream: '#E8EAF2', line: '#2B3140', red: '#F27A89', green: '#3CC48B', yellow: '#E0B24B' }
const s = {
  page: { minHeight: '100vh', background: theme.bg, color: theme.cream, fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif", paddingBottom: 60 },
  header: { background: theme.surface, borderBottom: `1px solid ${theme.line}`, padding: '20px 16px', textAlign: 'center' },
  logo: { display: 'block', width: 96, height: 96, objectFit: 'contain', margin: '0 auto 10px', padding: 6, background: '#fff', borderRadius: 18 },
  nome: { fontSize: 20, fontWeight: 800, fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif" },
  container: { maxWidth: 520, margin: '0 auto', padding: '20px 16px', display: 'grid', gap: 14 },
  card: { background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 16, padding: 18, display: 'grid', gap: 12 },
  titulo: { fontSize: 15, fontWeight: 800 },
  sub: { fontSize: 13, color: theme.muted, lineHeight: 1.45 },
  label: { display: 'grid', gap: 6, fontSize: 13, color: theme.muted, fontWeight: 600 },
  input: { padding: '12px 14px', borderRadius: 10, border: `1px solid ${theme.line}`, background: theme.surface, color: theme.cream, font: 'inherit', fontSize: 15 },
  btn: { padding: '13px 16px', borderRadius: 12, border: 'none', background: theme.accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 800, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'block' },
  btn2: { padding: '12px 14px', borderRadius: 12, border: `1px solid ${theme.line}`, background: 'transparent', color: theme.cream, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'block' },
  atalhos: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 },
  linha: { display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: `1px solid ${theme.line}`, fontSize: 14 },
  erro: { color: theme.red, fontSize: 14, fontWeight: 600 },
}

const reais = (valor) => `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`
const dataBR = (valor) => (valor ? String(valor).slice(0, 10).split('-').reverse().join('/') : '')

async function postar(url, corpo) {
  const res = await fetch(`${API}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
  const dados = await res.json().catch(() => ({}))
  if (!res.ok || dados.ok === false) throw new Error(dados.error || 'Não foi possível concluir agora.')
  return dados
}

export default function MinhaConta() {
  const { slug } = useParams()
  const [estab, setEstab] = useState(null)
  const [politicas, setPoliticas] = useState({})
  const [instalar, setInstalar] = useState(null)
  const [acesso, setAcesso] = useState({ codigo: '', telefone: '' })
  const [conta, setConta] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [vale, setVale] = useState({ aberto: false, valor: 100, deNome: '', deTelefone: '', paraNome: '', mensagem: '', resultado: null, erro: '', enviando: false })
  const isDino = String(slug || '').toLowerCase() === 'dino'

  useEffect(() => {
    fetch(`${API}/api/publico/agendamento/${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => {
      if (d?.ok) { setEstab(d.estabelecimento); setPoliticas(d.politicas || {}) }
    }).catch(() => {})
    const antes = (event) => { event.preventDefault(); setInstalar(event) }
    window.addEventListener('beforeinstallprompt', antes)
    return () => window.removeEventListener('beforeinstallprompt', antes)
  }, [slug])

  async function entrar(event) {
    event.preventDefault()
    setErro(''); setCarregando(true)
    try {
      const dados = await postar(`/api/publico/agendamento/${encodeURIComponent(slug)}/minha-conta`, { codigo: acesso.codigo, cliente_telefone: acesso.telefone })
      setConta(dados.conta)
    } catch (e) { setErro(e.message) } finally { setCarregando(false) }
  }

  async function comprarVale(event) {
    event.preventDefault()
    setVale((v) => ({ ...v, enviando: true, erro: '' }))
    try {
      const dados = await postar(`/api/publico/agendamento/${encodeURIComponent(slug)}/vale/comprar`, { valor: Number(vale.valor), de_nome: vale.deNome, de_telefone: vale.deTelefone, para_nome: vale.paraNome, mensagem: vale.mensagem })
      setVale((v) => ({ ...v, enviando: false, resultado: dados }))
    } catch (e) { setVale((v) => ({ ...v, enviando: false, erro: e.message })) }
  }

  const nome = estab?.nome || (isDino ? 'Barbearia Dino' : 'Minha barbearia')
  const whatsapp = String(estab?.whatsapp || '').replace(/\D/g, '')

  return <div style={s.page}>
    <div style={s.header}>
      {isDino ? <img src={DINO_BARBERSHOP_LOGO} alt="Barbearia Dino — desde 1997" style={s.logo} /> : <div style={{ fontSize: 36 }}>✂️</div>}
      <div style={s.nome}>{nome}</div>
      <div style={{ fontSize: 13, color: theme.muted, marginTop: 4 }}>{conta?.nome ? `Olá, ${conta.nome}!` : 'Seu app da barbearia'}</div>
    </div>
    <div style={s.container}>
      <div style={s.atalhos}>
        <Link to={`/agendar/${encodeURIComponent(slug)}`} style={s.btn}>Agendar</Link>
        {whatsapp ? <a href={`https://wa.me/${whatsapp.startsWith('55') ? whatsapp : `55${whatsapp}`}`} target="_blank" rel="noopener noreferrer" style={s.btn2}>WhatsApp</a> : <span />}
      </div>
      {instalar && <button type="button" style={s.btn2} onClick={async () => { instalar.prompt(); await instalar.userChoice.catch(() => null); setInstalar(null) }}>Instalar o app no celular</button>}

      {!conta ? <form onSubmit={entrar} style={s.card}>
        <div style={s.titulo}>Minha conta</div>
        <div style={s.sub}>Use o código de qualquer agendamento seu e o telefone da reserva para ver seus horários, seu clube e seu cashback.</div>
        <label style={s.label}>Código do agendamento<input style={s.input} value={acesso.codigo} autoComplete="off" maxLength={12} onChange={(e) => setAcesso((a) => ({ ...a, codigo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))} required /></label>
        <label style={s.label}>Telefone<input style={s.input} type="tel" inputMode="tel" autoComplete="tel" value={acesso.telefone} onChange={(e) => setAcesso((a) => ({ ...a, telefone: e.target.value }))} required placeholder="(65) 99999-9999" /></label>
        {erro && <div role="alert" style={s.erro}>{erro}</div>}
        <button type="submit" style={{ ...s.btn, opacity: carregando ? 0.7 : 1 }} disabled={carregando}>{carregando ? 'Entrando…' : 'Entrar'}</button>
      </form> : <>
        <div style={s.card}>
          <div style={s.titulo}>Próximos horários</div>
          {conta.proximos.length === 0 ? <div style={s.sub}>Nenhum horário marcado. <Link to={`/agendar/${encodeURIComponent(slug)}`} style={{ color: theme.accent }}>Agendar agora</Link></div> : conta.proximos.map((item) => <div key={`${item.dataAgenda}-${item.horaLocal}-${item.codigo}`} style={s.linha}>
            <span><strong>{dataBR(item.dataAgenda)} às {item.horaLocal}</strong><br /><span style={{ color: theme.muted }}>{item.servico}{item.profissional ? ` com ${item.profissional}` : ''}</span></span>
            <span style={{ color: theme.muted, fontSize: 12, textAlign: 'right' }}>Código<br />{item.codigo}</span>
          </div>)}
          <div style={s.sub}>Para remarcar ou cancelar, use "Já agendou?" na página de agendamento com o código.</div>
        </div>
        <div style={s.card}>
          <div style={s.titulo}>Clube e cashback</div>
          {conta.plano ? <>
            <div style={s.linha}><span>{conta.plano.plano}</span><strong>{conta.plano.restantes ?? '—'} restantes</strong></div>
            <div style={s.sub}>Ciclo até {dataBR(conta.plano.cicloTermina)}{conta.plano.pagamentoEmDia ? '' : ' · mensalidade pendente'}</div>
          </> : <div style={s.sub}>Você ainda não é do clube. Pergunte na barbearia.</div>}
          {conta.cashback && <div style={s.linha}><span>Cashback disponível</span><strong>{reais(conta.cashback.saldo)}</strong></div>}
          <div style={s.linha}><span>Visitas</span><strong>{conta.visitas}</strong></div>
        </div>
        {conta.paraAvaliar && <div style={s.card}>
          <div style={s.titulo}>Como foi seu último atendimento?</div>
          <div style={s.sub}>{conta.paraAvaliar.servico} em {dataBR(conta.paraAvaliar.dataAgenda)}. Código {conta.paraAvaliar.codigo}.</div>
          <Link to={`/avaliar/${encodeURIComponent(slug)}`} style={s.btn2}>Avaliar</Link>
        </div>}
        {conta.codigoIndicacao && <div style={s.card}>
          <div style={s.titulo}>Indique um amigo</div>
          <div style={s.sub}>Quando o amigo fizer o primeiro atendimento, vocês dois ganham pontos.</div>
          <button type="button" style={s.btn2} onClick={() => { const url = `${window.location.origin}/agendar/${encodeURIComponent(slug)}?indicacao=${conta.codigoIndicacao}`; if (navigator.share) navigator.share({ title: nome, url }).catch(() => {}); else navigator.clipboard?.writeText(url) }}>Compartilhar meu link</button>
        </div>}
        <button type="button" style={s.btn2} onClick={() => { setConta(null); setAcesso({ codigo: '', telefone: '' }) }}>Sair</button>
      </>}

      {politicas.valePresente && <div style={s.card}>
        <div style={s.titulo}>Vale-presente</div>
        {!vale.aberto && !vale.resultado && <><div style={s.sub}>Presenteie alguém com um corte, uma barba ou o que a pessoa preferir.</div><button type="button" style={s.btn2} onClick={() => setVale((v) => ({ ...v, aberto: true }))}>Dar um vale-presente</button></>}
        {vale.aberto && !vale.resultado && <form onSubmit={comprarVale} style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{[50, 100, 150, 200].map((v) => <button type="button" key={v} onClick={() => setVale((x) => ({ ...x, valor: v }))} style={{ ...s.btn2, flex: '1 1 70px', borderColor: Number(vale.valor) === v ? theme.accent : theme.line }}>{reais(v)}</button>)}</div>
          <label style={s.label}>Outro valor (R$ 20 a R$ 2.000)<input style={s.input} type="number" min="20" max="2000" step="1" value={vale.valor} onChange={(e) => setVale((v) => ({ ...v, valor: e.target.value }))} /></label>
          <label style={s.label}>Para quem<input style={s.input} maxLength={80} value={vale.paraNome} onChange={(e) => setVale((v) => ({ ...v, paraNome: e.target.value }))} /></label>
          <label style={s.label}>Mensagem (opcional)<input style={s.input} maxLength={200} value={vale.mensagem} onChange={(e) => setVale((v) => ({ ...v, mensagem: e.target.value }))} /></label>
          <label style={s.label}>Seu nome<input style={s.input} required maxLength={80} value={vale.deNome} onChange={(e) => setVale((v) => ({ ...v, deNome: e.target.value }))} /></label>
          <label style={s.label}>Seu telefone<input style={s.input} required type="tel" inputMode="tel" value={vale.deTelefone} onChange={(e) => setVale((v) => ({ ...v, deTelefone: e.target.value }))} /></label>
          {vale.erro && <div role="alert" style={s.erro}>{vale.erro}</div>}
          <button type="submit" style={{ ...s.btn, opacity: vale.enviando ? 0.7 : 1 }} disabled={vale.enviando}>{vale.enviando ? 'Gerando…' : `Pagar ${reais(vale.valor)}`}</button>
        </form>}
        {vale.resultado && <div style={{ display: 'grid', gap: 10 }} role="status">
          <div style={s.sub}>Guarde o código do vale. Ele passa a valer assim que o pagamento for confirmado.</div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 2, textAlign: 'center', color: theme.green }}>{vale.resultado.vale.codigo}</div>
          {vale.resultado.pagamento.url && <a href={vale.resultado.pagamento.url} style={s.btn}>Pagar com Pix ou cartão</a>}
          {vale.resultado.pagamento.pixCopiaECola && <>
            <textarea readOnly value={vale.resultado.pagamento.pixCopiaECola} style={{ ...s.input, fontSize: 11, minHeight: 70, resize: 'none' }} onFocus={(e) => e.target.select()} />
            <button type="button" style={s.btn} onClick={() => navigator.clipboard?.writeText(vale.resultado.pagamento.pixCopiaECola)}>Copiar código Pix</button>
            <div style={s.sub}>Depois de pagar, a barbearia confirma o recebimento.</div>
          </>}
        </div>}
      </div>}
    </div>
  </div>
}

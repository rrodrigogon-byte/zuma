/**
 * Página Pública: Avaliação do atendimento (NPS)
 * Rota: /avaliar/:slug
 * O cliente digita o código e o telefone da reserva (enviados no corpo, nunca na URL),
 * dá uma nota de 0 a 10 e um comentário opcional, armazenados no próprio sistema.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { DINO_BARBERSHOP_LOGO } from '../../lib/brand'

const API = import.meta.env.VITE_API_URL || ''

const theme = {
  bg: '#0E1014', surface: '#161922', card: '#1C202B', accent: '#6E7CE0', muted: '#A4AABE',
  cream: '#E8EAF2', line: '#2B3140', red: '#F27A89', green: '#3CC48B', yellow: '#E0B24B',
}

const s = {
  page: { minHeight: '100vh', background: theme.bg, color: theme.cream, fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif", paddingBottom: 60 },
  header: { background: theme.surface, borderBottom: `1px solid ${theme.line}`, padding: '20px 24px', textAlign: 'center' },
  brandLogo: { display: 'block', width: 112, height: 112, objectFit: 'contain', margin: '0 auto 12px', padding: 8, background: '#FFFFFF', borderRadius: 20 },
  nome: { fontSize: 22, fontWeight: 800, fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif" },
  container: { maxWidth: 520, margin: '0 auto', padding: '24px 16px' },
  card: { background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 16, padding: 20, display: 'grid', gap: 16 },
  label: { display: 'grid', gap: 6, fontSize: 13, color: theme.muted, fontWeight: 600 },
  input: { padding: '12px 14px', borderRadius: 10, border: `1px solid ${theme.line}`, background: theme.surface, color: theme.cream, font: 'inherit', fontSize: 15 },
  notas: { display: 'grid', gridTemplateColumns: 'repeat(11, minmax(0, 1fr))', gap: 4 },
  btn: { padding: '14px 16px', borderRadius: 12, border: 'none', background: theme.accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 800, cursor: 'pointer' },
}

function corDaNota(nota) {
  if (nota >= 9) return theme.green
  if (nota >= 7) return theme.yellow
  return theme.red
}

export default function AvaliarAtendimento() {
  const { slug } = useParams()
  const [estabelecimento, setEstabelecimento] = useState(null)
  const [codigo, setCodigo] = useState('')
  const [telefone, setTelefone] = useState('')
  const [nota, setNota] = useState(null)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState(null)
  const isDino = String(slug || '').trim().toLowerCase() === 'dino'

  useEffect(() => {
    let ativo = true
    fetch(`${API}/api/publico/agendamento/${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((dados) => { if (ativo && dados?.ok) setEstabelecimento(dados.estabelecimento) })
      .catch(() => {})
    return () => { ativo = false }
  }, [slug])

  async function enviar(event) {
    event.preventDefault()
    if (nota === null) { setErro('Escolha uma nota de 0 a 10.'); return }
    setEnviando(true)
    setErro('')
    try {
      const res = await fetch(`${API}/api/publico/agendamento/${encodeURIComponent(slug)}/avaliar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, cliente_telefone: telefone, nota, comentario }),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(dados.error || 'Não foi possível registrar sua avaliação.')
      setResultado(dados.avaliacao)
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const nomeEstab = estabelecimento?.nome || (isDino ? 'Barbearia Dino' : 'Avaliação do atendimento')

  return <div style={s.page}>
    <div style={s.header}>
      {isDino ? <img src={DINO_BARBERSHOP_LOGO} alt="Barbearia Dino — desde 1997" style={s.brandLogo} /> : <div style={{ fontSize: 36, marginBottom: 8 }}>✂️</div>}
      <div style={s.nome}>{nomeEstab}</div>
      <div style={{ fontSize: 13, color: theme.muted, marginTop: 4 }}>Como foi seu atendimento?</div>
    </div>
    <div style={s.container}>
      {resultado ? <div style={{ ...s.card, textAlign: 'center' }} role="status">
        <div style={{ fontSize: 44 }}>{resultado.nota >= 9 ? '🙌' : '🙏'}</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{resultado.repetida ? 'Você já tinha avaliado este atendimento.' : 'Obrigado pela avaliação!'}</div>
        <div style={{ color: theme.muted, fontSize: 14 }}>
          {resultado.nota >= 9
            ? 'Ficamos muito felizes com a sua nota.'
            : 'Sua opinião vai direto para a equipe e nos ajuda a melhorar.'}
        </div>
      </div> : <form onSubmit={enviar} style={s.card}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>De 0 a 10, quanto você recomendaria a {nomeEstab} para um amigo?</div>
        <div style={s.notas} role="radiogroup" aria-label="Nota de 0 a 10">
          {Array.from({ length: 11 }, (_, valor) => {
            const marcado = nota === valor
            return <button key={valor} type="button" role="radio" aria-checked={marcado} onClick={() => setNota(valor)}
              style={{ padding: '10px 0', borderRadius: 8, border: `1px solid ${marcado ? corDaNota(valor) : theme.line}`, background: marcado ? corDaNota(valor) : theme.surface, color: marcado ? '#0E1014' : theme.cream, fontWeight: 800, cursor: 'pointer', font: 'inherit', fontSize: 14 }}>
              {valor}
            </button>
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: theme.muted, marginTop: -8 }}><span>Nada provável</span><span>Muito provável</span></div>
        <label style={s.label}>Quer contar o motivo? (opcional)
          <textarea rows={3} maxLength={600} style={{ ...s.input, resize: 'vertical' }} value={comentario} onChange={(e) => setComentario(e.target.value)} />
        </label>
        <label style={s.label}>Código do agendamento
          <input style={s.input} value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))} required minLength={6} autoComplete="off" />
        </label>
        <label style={s.label}>Telefone usado na reserva
          <input style={s.input} type="tel" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} required placeholder="(65) 99999-9999" autoComplete="tel" />
        </label>
        {erro && <div role="alert" style={{ color: theme.red, fontSize: 14, fontWeight: 600 }}>{erro}</div>}
        <button type="submit" style={{ ...s.btn, opacity: enviando ? 0.7 : 1 }} disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar avaliação'}</button>
      </form>}
    </div>
  </div>
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'

// Painel inicial de um clube ou academia: números do dia da própria empresa (sócios, catraca,
// quadras, aulas, Pix e contratos), no lugar do painel do evento Agro Open.
const n = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR'))

function Kpi({ rotulo, valor, detalhe, alerta = false, para }) {
  const corpo = (
    <div className="kpi" style={{ height: '100%', borderTop: `3px solid ${alerta ? 'var(--danger, #c8342b)' : 'var(--accent, #FF6B2C)'}` }}>
      <div className="kpi-label">{rotulo}</div>
      <div className="kpi-value" style={alerta ? { color: 'var(--danger, #c8342b)' } : undefined}>{valor}</div>
      {detalhe && <div className="kpi-sub">{detalhe}</div>}
    </div>
  )
  return para ? <Link to={para} style={{ textDecoration: 'none', color: 'inherit' }}>{corpo}</Link> : corpo
}

export default function ClubeDashboard() {
  const { empresaAtiva } = useAuth()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let vivo = true
    // troca de empresa: não deixa os números da anterior na tela enquanto carrega
    setDados(null); setErro(null)
    const carregar = () => api.get('/api/admin/clube/painel/resumo')
      .then((r) => { if (vivo) { setDados(r); setErro(null) } })
      .catch((e) => { if (vivo) setErro(e?.message || 'Não foi possível carregar o painel.') })
    carregar()
    const t = setInterval(carregar, 60000)
    return () => { vivo = false; clearInterval(t) }
  }, [empresaAtiva?.id])

  const nome = empresaAtiva?.nome_fantasia || empresaAtiva?.nome || 'Clube'
  const s = dados?.socios
  const q = dados?.quadras
  const quadrasSub = q ? (q.aberto ? `${q.ocupacao?.ocupados ?? 0} de ${q.ocupacao?.horarios ?? 0} horários reservados` : 'Fechado hoje') : null

  return (
    <div className="page">
      <h1 className="page-title" style={{ marginBottom: 6 }}>{nome}</h1>
      <p style={{ margin: '0 0 22px', color: 'var(--muted)' }}>
        Hoje no clube{dados?.data ? ` · ${new Date(`${dados.data}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}` : ''}
      </p>
      {erro && <div className="card" style={{ marginBottom: 16, color: 'var(--danger, #c8342b)' }}>{erro}</div>}

      <div className="grid4" style={{ marginBottom: 16 }}>
        <Kpi rotulo="Sócios ativos" valor={n(s?.ativos)} detalhe={s ? `${n(s.novosNoMes)} novos no mês · ${n(s.congelados)} congelados` : null} para="/admin/clube/alunos" />
        <Kpi rotulo="Mensalidade em atraso" valor={n(s?.inadimplentes)} alerta={Number(s?.inadimplentes) > 0} detalhe="Já passou a tolerância do plano" para="/admin/clube/alunos" />
        <Kpi rotulo="Entradas hoje" valor={n(dados?.entradasHoje?.liberadas)} detalhe={dados?.entradasHoje ? `${n(dados.entradasHoje.negadas)} bloqueadas na catraca` : null} para="/admin/clube/recepcao" />
        <Kpi rotulo="Quadras hoje" valor={q?.ocupacao ? `${q.ocupacao.percentual}%` : '—'} detalhe={quadrasSub} para="/admin/clube/quadras" />
      </div>
      <div className="grid4" style={{ marginBottom: 24 }}>
        <Kpi rotulo="Aulas hoje" valor={n(dados?.aulasHoje?.aulas)} detalhe={dados?.aulasHoje ? `${n(dados.aulasHoje.reservas)} alunos reservados` : null} para="/admin/clube/aulas" />
        <Kpi rotulo="Pix a confirmar" valor={n(dados?.pixPendentes?.quantidade)} alerta={Number(dados?.pixPendentes?.quantidade) > 0} detalhe="Aguardando baixa da recepção" para="/admin/clube/cobrancas" />
        <Kpi rotulo="Contratos sem aceite" valor={n(dados?.contratosPendentes)} alerta={Number(dados?.contratosPendentes) > 0} detalhe="Enviados e ainda não aceitos" para="/admin/clube/contratos" />
        <Kpi rotulo="Nova adesão" valor="+" detalhe="Cadastro, plano, contrato e Pix" para="/admin/clube/alunos" />
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Próximas reservas de quadra</h2>
          <Link to="/admin/clube/quadras">Abrir a grade do dia</Link>
        </div>
        {!dados ? <p style={{ color: 'var(--muted)', margin: 0 }}>Carregando…</p>
          : !q?.quantidade ? <p style={{ color: 'var(--muted)', margin: 0 }}>Nenhuma quadra cadastrada. <Link to="/admin/clube/ajustes">Cadastrar quadras</Link></p>
          : !q.proximas?.length ? <p style={{ color: 'var(--muted)', margin: 0 }}>Nenhuma reserva para o resto do dia.</p>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Horário', 'Quadra', 'Quem'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, color: 'var(--muted)', borderBottom: '1px solid var(--line)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {q.proximas.map((r, i) => (
                    <tr key={`${r.quadra}-${r.inicio}-${i}`}>
                      <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{r.inicio}–{r.fim}</td>
                      <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--line)' }}>{r.quadra}</td>
                      <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--line)' }}>{r.quem}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  )
}

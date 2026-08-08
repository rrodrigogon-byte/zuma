import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
// "2026-09-07".."2026-09-13" → "07 a 13 de Setembro de 2026" (sem Date p/ evitar fuso)
function periodoBR(ini, fim) {
  if (!ini || !fim) return ''
  const [ay, am, ad] = ini.split('-')
  const [by, bm, bd] = fim.split('-')
  if (!ad || !bd) return ''
  const mes = MESES[(+am || 1) - 1]
  return `${ad} a ${bd} de ${mes} de ${ay}` + (am !== bm ? '' : '')
}

const SECOES = [
  { id: 'organizacao', num: '1', titulo: 'Organização' },
  { id: 'categorias', num: '2', titulo: 'Categorias e Critérios' },
  { id: 'sistema', num: '3', titulo: 'Sistema de Jogo' },
  { id: 'pontuacao', num: '4', titulo: 'Pontuação' },
  { id: 'premiacao', num: '5', titulo: 'Premiação' },
  { id: 'disposicoes', num: '6', titulo: 'Disposições Gerais' },
]

function Section({ id, num, titulo, children }) {
  return (
    <section id={id} style={{
      background: '#fff', borderRadius: 20, padding: '36px 40px',
      boxShadow: '0 2px 16px rgba(0,0,0,0.06)', marginBottom: 24,
      border: '1px solid rgba(255,107,44,0.08)',
      scrollMarginTop: 80,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid #EADFD4' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          background: 'linear-gradient(135deg,#FF6B2C,#FF9B72)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.2rem', fontWeight: 900, color: '#12283F',
        }}>
          {num}
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#12283F', margin: 0 }}>
          {titulo}
        </h2>
      </div>
      <div style={{ color: '#3a5a3a', lineHeight: 1.8, fontSize: '0.95rem' }}>
        {children}
      </div>
    </section>
  )
}

function Item({ label, children }) {
  return (
    <div style={{ marginBottom: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: '#FF6B2C',
        flexShrink: 0, marginTop: 8,
      }} />
      <div>
        {label && <strong style={{ color: '#12283F' }}>{label}: </strong>}
        {children}
      </div>
    </div>
  )
}

function SubTitle({ children }) {
  return (
    <div style={{
      fontWeight: 800, color: '#12283F', fontSize: '1rem',
      margin: '20px 0 12px', paddingLeft: 12,
      borderLeft: '3px solid #FF9B72',
    }}>
      {children}
    </div>
  )
}

export default function Regulamento() {
  const navigate = useNavigate()
  const [active, setActive] = useState('organizacao')
  const [info, setInfo] = useState(null)

  // Datas/evento/local vêm do backend (/api/info) para não divergir do torneio
  // configurado. Os textos detalhados das regras seguem editoriais (estáticos).
  useEffect(() => {
    api.get('/api/info').then(setInfo).catch(() => {})
  }, [])

  const periodo = periodoBR(info?.dataInicio, info?.dataFim)
  const evento = info?.nomeEvento || info?.evento || '4ª Agro Open de Tênis'
  const local = info?.local || 'Tangará Tênis Clube'

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) setActive(e.target.id)
        })
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    SECOES.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFF4EC', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#12283F 0%,#183450 100%)',
        padding: '48px 24px 64px', color: '#FFF4EC',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '10%', right: '4%', fontSize: '7rem', opacity: 0.06, pointerEvents: 'none' }}>📜</div>
        <div style={{ position: 'absolute', bottom: '5%', left: '2%', fontSize: '5rem', opacity: 0.06, pointerEvents: 'none' }}>🎾</div>
        <div style={{ maxWidth: 960, margin: '0 auto', position: 'relative' }}>
          <Link to="/" style={{ color: '#FF9B72', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>← Início</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '16px 0 8px' }}>
            <span style={{ fontSize: '2.5rem' }}>📜</span>
            <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>
              Regulamento
            </h1>
          </div>
          <p style={{ color: '#a0c8a0', margin: 0, fontSize: '1rem' }}>
            {evento}{periodo ? ` · ${periodo}` : ''}
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16,
            background: 'rgba(255,107,44,0.15)', border: '1px solid rgba(255,107,44,0.4)',
            borderRadius: 10, padding: '8px 18px', fontSize: '0.82rem', color: '#FF6B2C', fontWeight: 600,
          }}>
            🏆 R$ 5.000 em prêmios · {local} · Tangará da Serra – MT
          </div>
        </div>
        <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%' }} viewBox="0 0 1440 40" preserveAspectRatio="none">
          <path d="M0,40 C480,0 960,40 1440,10 L1440,40 Z" fill="#FFF4EC" />
        </svg>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 64px', display: 'flex', gap: 32, alignItems: 'flex-start' }}>

        {/* Índice lateral */}
        <aside style={{
          width: 220, flexShrink: 0, position: 'sticky', top: 24,
          background: '#fff', borderRadius: 18, padding: '20px 16px',
          boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
          // visibilidade controlada por .reg-sidebar (oculto no mobile, visível ≥900px)
        }}
          className="reg-sidebar"
          aria-label="Índice do regulamento"
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#5A6570', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
            Conteúdo
          </div>
          {SECOES.map(s => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              aria-current={active === s.id ? 'true' : undefined}
              aria-label={`Ir para a seção ${s.num} — ${s.titulo}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                background: active === s.id ? 'rgba(255,107,44,0.1)' : 'transparent',
                border: 'none', borderRadius: 10, padding: '9px 12px',
                cursor: 'pointer', textAlign: 'left', color: active === s.id ? '#FF6B2C' : '#5A6570',
                fontWeight: active === s.id ? 800 : 500, fontSize: '0.85rem',
                transition: 'all .15s',
                borderLeft: active === s.id ? '3px solid #FF6B2C' : '3px solid transparent',
              }}
            >
              <span style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                background: active === s.id ? '#FF6B2C' : '#EADFD4',
                color: active === s.id ? '#fff' : '#5A6570',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 800,
              }}>{s.num}</span>
              {s.titulo}
            </button>
          ))}
        </aside>

        {/* Conteúdo */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Índice mobile/inline */}
          <div style={{
            background: '#fff', borderRadius: 18, padding: '20px 24px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 24,
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#FF6B2C', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
              Índice
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SECOES.map(s => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  style={{
                    background: '#EADFD4', border: 'none', borderRadius: 10,
                    padding: '7px 16px', cursor: 'pointer', fontSize: '0.82rem',
                    fontWeight: 700, color: '#12283F', transition: 'background .15s, color .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#FF6B2C'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#EADFD4'; e.currentTarget.style.color = '#12283F' }}
                >
                  {s.num}. {s.titulo}
                </button>
              ))}
            </div>
          </div>

          {/* Seção 1 */}
          <Section id="organizacao" num="1" titulo="Organização">
            <Item label="Promotor">UISA Agroindustrial S.A., em parceria com o Tangará Tênis Clube.</Item>
            <Item label="Coordenação técnica">Comissão esportiva da 4ª Agro Open, composta por árbitros credenciados pela CBT (Confederação Brasileira de Tênis).</Item>
            <Item label="Apoio institucional">Prefeitura Municipal de Tangará da Serra – Secretaria Municipal de Esportes.</Item>
            <Item label="Local">Tangará Tênis Clube — Av. Esportiva, s/n, Tangará da Serra – MT. Quadras de saibro e cimento com iluminação artificial.</Item>
            <Item label="Datas">7 de setembro de 2026 (abertura) a 13 de setembro de 2026 (encerramento).</Item>
            <Item label="Credenciamento">O credenciamento dos atletas ocorrerá nos dias 5 e 6 de setembro de 2026, das 8h às 18h, na sede do clube.</Item>
          </Section>

          {/* Seção 2 */}
          <Section id="categorias" num="2" titulo="Categorias e Critérios">
            <SubTitle>Categorias Individuais</SubTitle>
            <Item label="Simples Masculino A">Jogadores com ranking CBT, experiência em competições regionais ou nacionais. Nível avançado.</Item>
            <Item label="Simples Masculino B">Aberta a jogadores intermediários sem ranking CBT ou com classificação abaixo de 500 pontos. Nível intermediário.</Item>
            <Item label="Simples Feminino">Aberta a todas as jogadoras, independente de nível. Podem participar maiores de 16 anos.</Item>
            <Item label="Masters +40">Exclusiva para atletas com 40 anos ou mais completados até a data de início do torneio.</Item>

            <SubTitle>Categorias de Duplas</SubTitle>
            <Item label="Duplas Masculinas">Formadas por dois atletas inscritos individualmente ou diretamente como dupla.</Item>
            <Item label="Duplas Mistas">Uma atleta feminina e um atleta masculino. Ambos devem estar inscritos na plataforma.</Item>

            <SubTitle>Critérios de Participação</SubTitle>
            <Item>Ser maior de 16 anos (ou ter autorização dos responsáveis legais).</Item>
            <Item>Efetuar o pagamento da inscrição dentro do prazo estabelecido.</Item>
            <Item>Apresentar documento de identificação com foto no credenciamento.</Item>
            <Item>Aceitar formalmente este regulamento no ato da inscrição.</Item>
            <Item>Cada atleta poderá participar de no máximo 2 categorias.</Item>
          </Section>

          {/* Seção 3 */}
          <Section id="sistema" num="3" titulo="Sistema de Jogo">
            <SubTitle>Formato Geral</SubTitle>
            <Item>O torneio adota o sistema de eliminatória simples a partir das quartas de final.</Item>
            <Item>As fases classificatórias (quando houver) utilizarão o formato de grupos (round robin).</Item>
            <Item>O número de sets e games por partida poderá variar conforme a fase do torneio, conforme tabela abaixo:</Item>

            <div style={{ overflowX: 'auto', margin: '16px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg,#12283F,#183450)', color: '#FF9B72' }}>
                    {['Fase', 'Sets', 'Games', 'Match Tie-Break'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 800, letterSpacing: '0.06em', fontSize: '0.75rem', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Fase de grupos', 'Melhor de 1', '4 games', 'Sim (7 pts)'],
                    ['Oitavas / Quartas', 'Melhor de 3', '6 games', 'Sim (10 pts)'],
                    ['Semifinais', 'Melhor de 3', '6 games', 'Não'],
                    ['Final', 'Melhor de 3', '6 games', 'Não'],
                  ].map(([fase, sets, games, mtb], i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #EADFD4', background: i % 2 === 0 ? '#fff' : '#fafcf8' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#12283F' }}>{fase}</td>
                      <td style={{ padding: '10px 14px', color: '#3a5a3a' }}>{sets}</td>
                      <td style={{ padding: '10px 14px', color: '#3a5a3a' }}>{games}</td>
                      <td style={{ padding: '10px 14px', color: '#FF6B2C', fontWeight: 600 }}>{mtb}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <SubTitle>Regras Técnicas</SubTitle>
            <Item>Aplicam-se as regras oficiais da ITF (International Tennis Federation) e CBT.</Item>
            <Item>Em caso de empate nos grupos, o critério de desempate é: saldo de sets, depois saldo de games, depois confronto direto.</Item>
            <Item>O atleta que não se apresentar no horário marcado terá 15 minutos de tolerância. Após esse período, será declarado W.O.</Item>
            <Item>Não são permitidas raquetes com cordas fora do padrão ITF.</Item>
            <Item>A arbitragem será feita pelo próprio atleta (árbitro cadeira somente nas semifinais e final).</Item>
          </Section>

          {/* Seção 4 */}
          <Section id="pontuacao" num="4" titulo="Pontuação">
            <p style={{ marginBottom: 16 }}>O torneio integra o sistema de ranking Kytto Clube. Os pontos distribuídos por categoria e fase estão descritos abaixo:</p>
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg,#12283F,#183450)', color: '#FF9B72' }}>
                    {['Fase', 'Campeão', 'Vice', 'Semifinal', 'Quartas', 'Oitavas'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, letterSpacing: '0.06em', fontSize: '0.75rem', textTransform: 'uppercase', '&:first-child': { textAlign: 'left' } }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Masculino A', '250', '175', '100', '50', '25'],
                    ['Masculino B', '150', '100', '60', '30', '15'],
                    ['Feminino', '150', '100', '60', '30', '15'],
                    ['Duplas Masc.', '120', '80', '50', '25', '—'],
                    ['Duplas Mistas', '100', '70', '40', '20', '—'],
                    ['Masters +40', '120', '80', '50', '25', '—'],
                  ].map(([cat, ...pts], i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #EADFD4', background: i % 2 === 0 ? '#fff' : '#fafcf8' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#12283F' }}>{cat}</td>
                      {pts.map((p, j) => (
                        <td key={j} style={{ padding: '10px 14px', textAlign: 'right', color: j === 0 ? '#FF6B2C' : '#3a5a3a', fontWeight: j === 0 ? 800 : 400 }}>{p}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Item>Os pontos serão lançados no ranking Kytto Clube em até 48h após o encerramento do torneio.</Item>
            <Item>Atletas que se retirarem sem completar a fase mínima de grupos não pontuarão.</Item>
            <Item>O ranking Kytto Clube utiliza o sistema Elo combinado com pontuação por fase, acumulando resultados dos últimos 12 meses.</Item>
          </Section>

          {/* Seção 5 */}
          <Section id="premiacao" num="5" titulo="Premiação">
            <div style={{
              background: 'linear-gradient(135deg,rgba(255,107,44,0.1),rgba(255,107,44,0.05))',
              border: '1px solid rgba(255,107,44,0.3)', borderRadius: 14,
              padding: '20px 24px', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <span style={{ fontSize: '2.5rem' }}>🏆</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: '1.4rem', color: '#FF6B2C' }}>R$ 5.000 em prêmios</div>
                <div style={{ color: '#5A6570', fontSize: '0.88rem', marginTop: 2 }}>Distribuídos entre todas as categorias + troféus e medalhas</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>
              {[
                { cat: 'Simples Masculino A', primeiro: 'R$ 800', segundo: 'R$ 400', terceiro: 'R$ 200' },
                { cat: 'Simples Masculino B', primeiro: 'R$ 600', segundo: 'R$ 300', terceiro: 'R$ 150' },
                { cat: 'Simples Feminino', primeiro: 'R$ 600', segundo: 'R$ 300', terceiro: 'R$ 150' },
                { cat: 'Duplas Masculinas', primeiro: 'R$ 400/dupla', segundo: 'R$ 200/dupla', terceiro: '—' },
                { cat: 'Duplas Mistas', primeiro: 'R$ 350/dupla', segundo: 'R$ 175/dupla', terceiro: '—' },
                { cat: 'Masters +40', primeiro: 'R$ 400', segundo: 'R$ 200', terceiro: 'R$ 100' },
              ].map((item, i) => (
                <div key={i} style={{
                  background: '#fff', borderRadius: 14, padding: '16px 18px',
                  border: '1px solid rgba(255,107,44,0.1)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ fontWeight: 800, color: '#12283F', fontSize: '0.88rem', marginBottom: 10 }}>{item.cat}</div>
                  {[
                    { label: '🥇 1º lugar', value: item.primeiro, color: '#FF6B2C' },
                    { label: '🥈 2º lugar', value: item.segundo, color: '#9e9e9e' },
                    { label: '🥉 3º lugar', value: item.terceiro, color: '#cd7f32' },
                  ].map((row, j) => (
                    <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: j < 2 ? '1px solid #FFF4EC' : 'none' }}>
                      <span style={{ fontSize: '0.8rem', color: '#5A6570' }}>{row.label}</span>
                      <span style={{ fontWeight: 800, color: row.color, fontSize: '0.88rem' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <Item>Todos os participantes receberão certificado de participação digital.</Item>
            <Item>Troféus serão entregues ao 1º e 2º lugar de cada categoria individual.</Item>
            <Item>Medalhas para os 4 semifinalistas de cada categoria.</Item>
            <Item>A premiação em dinheiro será paga via Pix em até 72h após a final.</Item>
          </Section>

          {/* Seção 6 */}
          <Section id="disposicoes" num="6" titulo="Disposições Gerais">
            <SubTitle>Inscrições</SubTitle>
            <Item>As inscrições são realizadas exclusivamente pela plataforma Kytto Clube (este site).</Item>
            <Item>O prazo de inscrição encerra-se em 31 de agosto de 2026 ou quando esgotadas as vagas.</Item>
            <Item>A inscrição somente é confirmada após o pagamento integral da taxa via Pix.</Item>
            <Item>Não haverá devolução da taxa de inscrição após confirmação, exceto em cancelamento do evento pela organização.</Item>

            <SubTitle>Conduta e Fair Play</SubTitle>
            <Item>É obrigatório o uso de traje esportivo adequado em todas as partidas.</Item>
            <Item>Comportamento antidesportivo, insultos ou condutas impróprias resultarão em advertência, perda de game ou desqualificação, a critério do árbitro.</Item>
            <Item>O uso de aparelhos de comunicação é vedado durante as partidas.</Item>
            <Item>O consumo de álcool é proibido antes e durante as partidas.</Item>

            <SubTitle>Responsabilidades</SubTitle>
            <Item>A organização não se responsabiliza por acidentes, furtos ou extravios de pertences durante o evento.</Item>
            <Item>Os atletas devem chegar ao clube com pelo menos 30 minutos de antecedência para seu jogo.</Item>
            <Item>A tabela de jogos será publicada em até 48h antes do início de cada rodada.</Item>

            <SubTitle>Casos Omissos</SubTitle>
            <Item>Os casos não previstos neste regulamento serão resolvidos pela comissão técnica do evento, cujas decisões são soberanas e irrecorríveis.</Item>
            <Item>Eventuais alterações de horário, quadra ou formato serão comunicadas pelo sistema Kytto Clube e pelo mural do clube.</Item>

            <div style={{
              marginTop: 24, background: '#FFF4EC', borderRadius: 12,
              padding: '16px 20px', fontSize: '0.82rem', color: '#5A6570',
            }}>
              <strong style={{ color: '#12283F' }}>Contato:</strong> Para dúvidas, entre em contato com a secretaria do evento pelo e-mail <span style={{ color: '#FF6B2C', fontWeight: 600 }}>agroopen@uisa.com.br</span> ou pelo telefone <span style={{ color: '#FF6B2C', fontWeight: 600 }}>(65) 3326-0000</span>.
            </div>
          </Section>

          {/* CTA */}
          <div style={{
            background: 'linear-gradient(135deg,#12283F,#183450)',
            borderRadius: 20, padding: '36px 32px', textAlign: 'center', color: '#FFF4EC',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🎾</div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '0 0 10px' }}>Leu o regulamento?</h3>
            <p style={{ color: '#a0c8a0', margin: '0 0 24px', lineHeight: 1.6 }}>
              Garanta sua vaga na 4ª Agro Open de Tênis. Vagas limitadas por categoria.
            </p>
            <button
              onClick={() => navigate('/inscricao')}
              style={{
                background: 'linear-gradient(135deg,#FF6B2C,#FF9B72)',
                color: '#12283F', border: 'none', borderRadius: 12,
                padding: '14px 36px', fontWeight: 800, fontSize: '0.95rem',
                cursor: 'pointer', boxShadow: '0 4px 16px rgba(255,107,44,0.35)',
                transition: 'transform .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = ''}
            >
              Fazer Inscrição →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

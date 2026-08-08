import fs from 'fs'
import path from 'path'

const HOME_PATH = path.join(process.cwd(), 'web/src/pages/public/Home.jsx')

const NOVO_CONTEUDO = `import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS / HOOKS
// ─────────────────────────────────────────────────────────────────────────────

function useReveal(threshold = 0.12) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

function RevealSection({ children, style, delay = 0 }) {
  const { ref, visible } = useReveal()
  return (
    <div
      ref={ref}
      style={{
        transition: \`opacity 0.7s ease \${delay}ms, transform 0.7s ease \${delay}ms\`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(36px)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function SectionLabel({ text, color = '#FF6B2C' }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={{ height: 2, width: 36, background: color, borderRadius: 2 }} />
      <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.18em', color, textTransform: 'uppercase' }}>{text}</span>
      <div style={{ height: 2, width: 36, background: color, borderRadius: 2 }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES DE SEÇÃO
// ─────────────────────────────────────────────────────────────────────────────

function HeroInstitucional() {
  return (
    <section style={{
      background: 'linear-gradient(135deg, #12283F 0%, #0D1D2E 100%)',
      padding: '120px 24px 80px',
      position: 'relative',
      overflow: 'hidden',
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
    }}>
      {/* Background elements */}
      <div style={{
        position: 'absolute', top: -100, right: -100, width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(255,107,44,0.1) 0%, transparent 70%)',
        borderRadius: '50%',
      }} />
      <div style={{
        position: 'absolute', bottom: -150, left: -50, width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)',
        borderRadius: '50%',
      }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 10, width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: 800 }}>
          
          <img 
            src="/brand/kytto-negativo.svg" 
            alt="Kytto" 
            style={{ height: 64, marginBottom: 40 }} 
          />
          
          <SectionLabel text="Nascemos em Tangará da Serra" color="#FF9B72" />
          
          <h1 style={{ 
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', 
            fontWeight: 900, 
            color: '#FFF4EC', 
            lineHeight: 1.1, 
            letterSpacing: '-0.02em',
            marginBottom: 24 
          }}>
            Sistemas que fazem o <br />
            <span style={{ color: '#FF6B2C' }}>seu negócio subir.</span>
          </h1>
          
          <p style={{ 
            fontSize: 'clamp(1.1rem, 2vw, 1.3rem)', 
            color: 'rgba(255,244,236,0.8)', 
            lineHeight: 1.6,
            marginBottom: 40,
            maxWidth: 600
          }}>
            Gestão, vendas, operações, automação e suporte técnico local para negócios que precisam funcionar de ponta a ponta, sem dor de cabeça.
          </p>
          
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Link to="/login" style={{
              background: '#FF6B2C', color: '#fff', padding: '16px 32px',
              borderRadius: 12, fontWeight: 800, textDecoration: 'none',
              fontSize: '1.1rem', transition: 'background 0.2s, transform 0.2s',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 8px 24px rgba(255,107,44,0.3)'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e85c22'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FF6B2C'; e.currentTarget.style.transform = '' }}
            >
              Acessar Plataforma →
            </Link>
            
            <a href="#solucoes" style={{
              background: 'rgba(255,255,255,0.1)', color: '#FFF4EC', padding: '16px 32px',
              borderRadius: 12, fontWeight: 700, textDecoration: 'none',
              fontSize: '1.1rem', transition: 'background 0.2s',
              border: '1px solid rgba(255,255,255,0.2)'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              Conhecer Soluções
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function SolucoesSection() {
  const SOLUCOES = [
    { 
      icon: '🛒', tag: 'Comércio', title: 'Loja e varejo', 
      text: 'PDV ágil, controle de estoque integrado, compras, gestão fiscal e financeiro completo para operações comerciais de todos os tamanhos.', 
      to: '/login' 
    },
    { 
      icon: '🍽️', tag: 'Alimentação', title: 'Bar e restaurante', 
      text: 'Gestão de comandas, integração direta com cozinha (KDS), mapa de mesas, pagamentos e controle de produção no mesmo fluxo.', 
      to: '/login' 
    },
    { 
      icon: '🌾', tag: 'Agro', title: 'Agropecuária', 
      text: 'Controle de insumos, gestão de compras, documentos fiscais, receituário agronômico e operação especializada para o campo.', 
      to: '/login' 
    },
    { 
      icon: '🎾', tag: 'Associativo', title: 'Clube e eventos', 
      text: 'Gestão de associados, cobrança recorrente, reservas de quadras, organização de torneios, ranking e experiências esportivas.', 
      to: '#agro-open' 
    },
    { 
      icon: '✂️', tag: 'Serviços', title: 'Barbearia e salão', 
      text: 'Agendamento online, atendimento, comissionamento automático de profissionais, venda de produtos e fechamento de caixa.', 
      to: '/login' 
    },
  ]

  return (
    <section id="solucoes" style={{ padding: '100px 24px', background: '#FFF4EC' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <RevealSection>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <SectionLabel text="Plataforma Multinegócio" color="#FF6B2C" />
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, color: '#12283F', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
              Uma plataforma, <br />várias verticais de negócio.
            </h2>
            <p style={{ color: '#5A6570', fontSize: '1.1rem', maxWidth: 600, margin: '0 auto' }}>
              Sistemas especialistas que conversam entre si. Escolha o módulo que o seu negócio precisa hoje e expanda quando quiser.
            </p>
          </div>
        </RevealSection>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
          {SOLUCOES.map((s, i) => (
            <RevealSection key={i} delay={i * 100}>
              <div style={{
                background: '#fff',
                borderRadius: 24,
                padding: '32px',
                height: '100%',
                boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.05)',
                transition: 'transform 0.3s, box-shadow 0.3s',
                display: 'flex',
                flexDirection: 'column'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-8px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.04)' }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>{s.icon}</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#FF6B2C', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  {s.tag}
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#12283F', marginBottom: 16 }}>{s.title}</h3>
                <p style={{ color: '#5A6570', fontSize: '0.95rem', lineHeight: 1.6, flex: 1 }}>{s.text}</p>
                
                {s.to.startsWith('#') ? (
                  <a href={s.to} style={{ 
                    marginTop: 24, display: 'inline-flex', alignItems: 'center', gap: 8, 
                    color: '#FF6B2C', fontWeight: 700, textDecoration: 'none', fontSize: '0.95rem' 
                  }}>
                    Conhecer o case →
                  </a>
                ) : (
                  <Link to={s.to} style={{ 
                    marginTop: 24, display: 'inline-flex', alignItems: 'center', gap: 8, 
                    color: '#12283F', fontWeight: 700, textDecoration: 'none', fontSize: '0.95rem' 
                  }}>
                    Acessar módulo →
                  </Link>
                )}
              </div>
            </RevealSection>
          ))}
        </div>
      </div>
    </section>
  )
}

function OrigemSection() {
  return (
    <section style={{ padding: '100px 24px', background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 64, alignItems: 'center' }}>
        <div style={{ flex: '1 1 400px' }}>
          <RevealSection>
            <SectionLabel text="A Nossa Origem" color="#FF6B2C" />
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, color: '#12283F', margin: '0 0 24px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              Quando der problema, <br />
              <span style={{ color: '#FF6B2C' }}>você fala com quem instalou.</span>
            </h2>
            <p style={{ color: '#5A6570', fontSize: '1.1rem', lineHeight: 1.7, marginBottom: 24 }}>
              Nascemos em Tangará da Serra (MT) com um propósito claro: entregar tecnologia de ponta com suporte local de verdade. Chega de abrir chamados e esperar dias por uma resposta de outro estado.
            </p>
            <p style={{ color: '#5A6570', fontSize: '1.1rem', lineHeight: 1.7, marginBottom: 32 }}>
              Temos software próprio, infraestrutura de redes, câmeras, automação e uma <strong>equipe técnica própria com veículo em rota</strong>, atendendo presencialmente num raio de 250 km.
            </p>
            
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,107,44,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: '#FF6B2C' }}>📍</div>
                <div>
                  <div style={{ fontWeight: 800, color: '#12283F' }}>Base Local</div>
                  <div style={{ fontSize: '0.85rem', color: '#5A6570' }}>Tangará da Serra</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,107,44,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: '#FF6B2C' }}>🚗</div>
                <div>
                  <div style={{ fontWeight: 800, color: '#12283F' }}>250 km</div>
                  <div style={{ fontSize: '0.85rem', color: '#5A6570' }}>Atendimento presencial</div>
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
        
        <div style={{ flex: '1 1 400px' }}>
          <RevealSection delay={200}>
            <div style={{ 
              background: 'linear-gradient(135deg, #12283F 0%, #0D1D2E 100%)', 
              borderRadius: 32, 
              padding: 48,
              boxShadow: '0 24px 64px rgba(18,40,63,0.15)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: -20, right: -20, opacity: 0.05 }}>
                <img src="/brand/kytto-icone.svg" alt="" style={{ width: 200 }} />
              </div>
              
              <h3 style={{ color: '#FFF4EC', fontSize: '1.5rem', fontWeight: 800, marginBottom: 32 }}>O ecossistema completo</h3>
              
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {[
                  { i: '💻', t: 'Software Próprio', d: 'Sistemas de gestão e PDV' },
                  { i: '🎥', t: 'Câmeras e Segurança', d: 'Monitoramento integrado' },
                  { i: '🌐', t: 'Redes e Infraestrutura', d: 'Wi-Fi e conectividade' },
                  { i: '⚡', t: 'Automação', d: 'Controle inteligente de ambientes' }
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ fontSize: '1.5rem', background: 'rgba(255,255,255,0.05)', width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.i}</div>
                    <div>
                      <div style={{ color: '#FFF4EC', fontWeight: 700, fontSize: '1.1rem' }}>{item.t}</div>
                      <div style={{ color: 'rgba(255,244,236,0.6)', fontSize: '0.9rem' }}>{item.d}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </RevealSection>
        </div>
      </div>
    </section>
  )
}

function CaseAgroOpenSection() {
  return (
    <section id="agro-open" style={{ padding: '100px 24px', background: '#12283F', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'url(https://sspark.genspark.ai/cfimages?u1=uBNzwhX%2FTWhx2%2FVnwh4vVJUma6aBOvWTlIp48Bj%2Bt%2FvkVnGub7UFEePk2YdVFY%2FfaMkcnjM%2BYrDRG82yPVNOnL3MpDZIl1BTPBTCA2Nn3mJAV6ZnkFH4SloUF9rWESX5DHm8YgdL1l7eUZOb7Pg%3D&u2=i4Vxk9s4b8RsKjvy&width=2560) center/cover', opacity: 0.05, mixBlendMode: 'overlay' }} />
      
      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 10 }}>
        <RevealSection>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <SectionLabel text="Case de Sucesso: Associativo" color="#FF6B2C" />
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, color: '#FFF4EC', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
              4ª Agro Open de Tênis
            </h2>
            <p style={{ color: 'rgba(255,244,236,0.7)', fontSize: '1.1rem', maxWidth: 600, margin: '0 auto' }}>
              O maior torneio de tênis do Centro-Oeste é 100% gerenciado pela plataforma Kytto. De inscrições e chaves até o PDV do bar durante o evento.
            </p>
          </div>
        </RevealSection>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20, marginBottom: 48 }}>
          {[
            { v: '250+', l: 'Atletas', i: '🎾' },
            { v: 'R$ 250k+', l: 'Premiação', i: '💰' },
            { v: '14', l: 'Categorias', i: '📋' },
            { v: '100%', l: 'Gestão Kytto', i: '⚡' },
          ].map((s, i) => (
            <RevealSection key={i} delay={i * 100}>
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '24px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>{s.i}</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#FF6B2C' }}>{s.v}</div>
                <div style={{ color: 'rgba(255,244,236,0.7)', fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase' }}>{s.l}</div>
              </div>
            </RevealSection>
          ))}
        </div>

        <RevealSection delay={400}>
          <div style={{ textAlign: 'center', display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/inscricao" style={{ background: '#FF6B2C', color: '#fff', padding: '14px 28px', borderRadius: 10, fontWeight: 800, textDecoration: 'none' }}>
              Inscreva-se no Torneio
            </Link>
            <Link to="/ranking" style={{ background: 'rgba(255,255,255,0.1)', color: '#FFF4EC', padding: '14px 28px', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>
              Ver Ranking e Chaves
            </Link>
          </div>
        </RevealSection>
      </div>
    </section>
  )
}

function CTAFinal() {
  return (
    <section style={{ padding: '100px 24px', background: '#FF6B2C', textAlign: 'center' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <RevealSection>
          <img src="/brand/kytto-negativo.svg" alt="Kytto" style={{ height: 48, marginBottom: 32 }} />
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, color: '#fff', margin: '0 0 24px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Pronto para fazer o seu negócio subir?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.2rem', marginBottom: 40 }}>
            Fale com nossa equipe em Tangará da Serra e descubra como a Kytto pode transformar a sua operação.
          </p>
          <a href="https://wa.me/5565999999999" target="_blank" rel="noreferrer" style={{
            background: '#12283F', color: '#fff', padding: '18px 40px',
            borderRadius: 14, fontWeight: 900, textDecoration: 'none',
            fontSize: '1.2rem', display: 'inline-flex', alignItems: 'center', gap: 12,
            boxShadow: '0 12px 32px rgba(18,40,63,0.3)', transition: 'transform 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={e => e.currentTarget.style.transform = ''}
          >
            <span style={{ fontSize: '1.4rem' }}>💬</span> Falar com Consultor
          </a>
        </RevealSection>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      <style>{GLOBAL_CSS}</style>
      
      <HeroInstitucional />
      <SolucoesSection />
      <OrigemSection />
      <CaseAgroOpenSection />
      <CTAFinal />
      
    </div>
  )
}
`

fs.writeFileSync(HOME_PATH, NOVO_CONTEUDO)
console.log('Home.jsx reconstruído com sucesso.')

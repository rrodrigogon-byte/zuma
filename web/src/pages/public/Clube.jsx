import { useEffect, useState } from 'react'

const C = {
  deep: '#0E2E1C',
  green: '#5FB335',
  lime: '#8FD64A',
  gold: '#C9A656',
  cream: '#F4F6EF',
}

function Section({ id, title, children }) {
  return (
    <section id={id} style={{ marginBottom: 56 }}>
      <h2 style={{
        fontSize: '1.5rem', fontWeight: 700, color: C.deep,
        borderLeft: `4px solid ${C.green}`, paddingLeft: 16,
        marginBottom: 20,
      }}>{title}</h2>
      {children}
    </section>
  )
}

function InfoCard({ icon, label, value }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      padding: '12px 16px', background: '#fff',
      borderRadius: 8, border: `1px solid #e5e7eb`,
    }}>
      <span style={{ fontSize: '1.3rem', minWidth: 28 }}>{icon}</span>
      <div>
        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ color: C.deep, fontWeight: 500, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, items }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '20px 24px',
      border: `1px solid #e5e7eb`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: 8 }}>{icon}</div>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: C.deep, marginBottom: 12 }}>{title}</h3>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {items.map((item, i) => (
          <li key={i} style={{
            color: '#374151', fontSize: '0.9rem', padding: '4px 0',
            borderBottom: i < items.length - 1 ? '1px solid #f3f4f6' : 'none',
            paddingLeft: 16, position: 'relative',
          }}>
            <span style={{ position: 'absolute', left: 0, color: C.green }}>›</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

const FOTOS = [
  { src: '/ttc/galeria/galeria-bt-01.jpg', alt: 'Equipe feminina de beach tennis celebrando' },
  { src: '/ttc/galeria/galeria-bt-02.jpg', alt: 'Atleta com raquete na quadra de areia' },
  { src: '/ttc/galeria/galeria-bt-03.jpg', alt: 'Dupla campeã de beach tennis com troféu' },
  { src: '/ttc/galeria/galeria-bt-04.jpg', alt: 'Jogo de beach tennis à noite' },
  { src: '/ttc/galeria/galeria-ten-01.jpg', alt: 'Jovem tenista na quadra de saibro' },
  { src: '/ttc/galeria/galeria-ten-02.jpg', alt: 'Criança sacando no tênis' },
  { src: '/ttc/galeria/galeria-ten-03.jpg', alt: 'Turma de tênis kids com professores' },
  { src: '/ttc/galeria/galeria-ten-04.jpg', alt: 'Atleta na 2ª Copa Agro de Tênis' },
  { src: '/ttc/galeria/galeria-ten-05.jpg', alt: 'Tenista em ação à noite' },
  { src: '/ttc/galeria/galeria-ten-06.jpg', alt: 'Grupo de crianças no torneio Copa Agro' },
  { src: '/ttc/galeria/galeria-ten-07.jpg', alt: 'Campeões Kids Sub-10 com troféus' },
  { src: '/ttc/galeria/galeria-ten-08.jpg', alt: '2ª Copa Agro de Tênis — banner oficial' },
]

function GaleriaFotos() {
  const [lightbox, setLightbox] = useState(null)

  return (
    <>
      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 8,
      }}>
        {FOTOS.map((foto, i) => (
          <div
            key={i}
            onClick={() => setLightbox(i)}
            style={{
              borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
              aspectRatio: '1/1', background: '#e5e7eb',
              position: 'relative',
              transition: 'transform .15s, box-shadow .15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.03)'
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <img
              src={foto.src}
              alt={foto.alt}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(14,46,28,0)',
              transition: 'background .15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14,46,28,0.25)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(14,46,28,0)' }}
            >
              <span style={{ fontSize: '1.6rem', opacity: 0.9 }}>🔍</span>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <button
            onClick={() => setLightbox(i => (i - 1 + FOTOS.length) % FOTOS.length)}
            style={{
              position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
              width: 48, height: 48, color: '#fff', fontSize: 22, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={e => { e.stopPropagation(); setLightbox(i => (i - 1 + FOTOS.length) % FOTOS.length) }}
          >‹</button>

          <img
            src={FOTOS[lightbox].src}
            alt={FOTOS[lightbox].alt}
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
            onClick={e => e.stopPropagation()}
          />

          <button
            style={{
              position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
              width: 48, height: 48, color: '#fff', fontSize: 22, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={e => { e.stopPropagation(); setLightbox(i => (i + 1) % FOTOS.length) }}
          >›</button>

          <button
            style={{
              position: 'fixed', top: 16, right: 16,
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
              width: 40, height: 40, color: '#fff', fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={e => { e.stopPropagation(); setLightbox(null) }}
          >✕</button>

          <div style={{
            position: 'fixed', bottom: 20, left: 0, right: 0, textAlign: 'center',
            color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem',
          }}>
            {FOTOS[lightbox].alt} · {lightbox + 1}/{FOTOS.length}
          </div>
        </div>
      )}
    </>
  )
}

export default function Clube() {
  useEffect(() => { window.scrollTo(0, 0) }, [])

  return (
    <div style={{ minHeight: '100vh', background: C.cream }}>

      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${C.deep} 0%, #1a4a2e 60%, #2a5a3e 100%)`,
        color: '#fff', padding: '60px 24px 48px', textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: 'url(/ttc/piscina-toboga.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: 0.18,
        }} />
        <div style={{ position: 'relative', maxWidth: 700, margin: '0 auto' }}>
          <div style={{
            display: 'inline-block', background: C.green, color: '#fff',
            fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em',
            padding: '4px 14px', borderRadius: 20, marginBottom: 16,
            textTransform: 'uppercase',
          }}>Sede Oficial — 4ª Agro Open de Tênis 2026</div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900, margin: '0 0 8px', lineHeight: 1.1 }}>
            Tangará Tênis Clube
          </h1>
          <div style={{ fontSize: '1.2rem', color: C.lime, fontWeight: 700, marginBottom: 12 }}>TTC</div>
          <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.85)', margin: 0 }}>
            Muito mais lazer, diversão e esportes — o maior clube de lazer de Tangará da Serra e região, MT
          </p>
        </div>
      </div>

      {/* Imagem principal */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px' }}>
        <div style={{
          marginTop: -24, borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)', background: C.deep,
        }}>
          <img
            src="/ttc/piscina-toboga.jpg"
            alt="Piscina semiolímpica e tobogã do TTC"
            style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover', maxHeight: 380 }}
          />
          <div style={{
            background: 'rgba(14,46,28,0.92)', color: 'rgba(255,255,255,0.85)',
            fontSize: '0.85rem', textAlign: 'center', padding: '8px 16px', fontStyle: 'italic',
          }}>
            Piscina semiolímpica com tobogã — uma das marcas registradas do clube
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 16px 64px' }}>

        {/* Quem Somos */}
        <Section id="quem-somos" title="Quem Somos">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
            <p style={{ color: '#374151', lineHeight: 1.8, margin: 0, fontSize: '1rem' }}>
              O Tangará Tênis Clube — conhecido pela sigla <strong>TTC</strong> — é o <strong>maior clube
              de lazer de Tangará da Serra e de toda a região</strong>, no estado de Mato Grosso. Reunindo
              esporte, recreação e convívio social em um só lugar, o clube é um ponto de encontro de
              famílias, atletas e amigos, com estrutura preparada para todas as idades.
            </p>
            <p style={{ color: '#374151', lineHeight: 1.8, margin: 0, fontSize: '1rem' }}>
              Sob o lema <em>"muito mais lazer, diversão e esportes"</em>, o TTC oferece o melhor da vida
              em clube com preço acessível para a família tangaraense. Em suas dependências, crianças
              aprendem a nadar, jovens treinam tênis, beach tennis e futevôlei, adultos cuidam da saúde
              na hidroginástica e famílias inteiras transformam o fim de semana em momentos de descanso,
              esporte e diversão.
            </p>
            <p style={{ color: '#374151', lineHeight: 1.8, margin: 0, fontSize: '1rem' }}>
              Nossa missão é promover qualidade de vida, integração social e a prática esportiva em um
              espaço completo, bem cuidado e aberto a toda a família — para que cada associado se sinta
              em casa e o TTC siga sendo, por muitas gerações, sinônimo de convivência saudável em
              Tangará da Serra.
            </p>
          </div>
        </Section>

        {/* Nossa História */}
        <Section id="historia" title="Nossa História">
          <div style={{
            background: '#fff', borderRadius: 12, padding: '24px 28px',
            border: `1px solid #e5e7eb`, borderLeft: `4px solid ${C.gold}`,
          }}>
            <p style={{ color: '#374151', lineHeight: 1.8, margin: '0 0 16px', fontSize: '1rem' }}>
              O Tangará Tênis Clube nasceu do desejo de reunir a comunidade de Tangará da Serra em torno
              do esporte e do convívio social. Acompanhando o crescimento do município — um dos polos mais
              dinâmicos do agronegócio mato-grossense —, o clube se consolidou como <strong>referência de
              lazer</strong>, recebendo ao longo dos anos milhares de famílias em suas piscinas, quadras e
              áreas sociais.
            </p>
            <p style={{ color: '#374151', lineHeight: 1.8, margin: '0 0 16px', fontSize: '1rem' }}>
              De geração em geração, o TTC se tornou parte da <strong>memória afetiva da cidade</strong>.
              Foi e continua sendo o cenário de aulas de natação, treinos e torneios de tênis, festas,
              confraternizações e tardes ensolaradas à beira da piscina — e de amizades que se formaram
              dentro de seus portões. Esse vínculo com a comunidade é o maior patrimônio do clube.
            </p>
            <p style={{ color: '#374151', lineHeight: 1.8, margin: 0, fontSize: '1rem' }}>
              Hoje, o TTC mantém viva essa tradição ao mesmo tempo em que se moderniza: amplia suas
              modalidades esportivas, renova sua estrutura e fortalece a agenda de eventos para atender
              às novas gerações de associados.
            </p>
          </div>
        </Section>

        {/* Estrutura */}
        <Section id="estrutura" title="Estrutura e Modalidades">
          <p style={{ color: '#374151', lineHeight: 1.7, marginBottom: 28, fontSize: '1rem' }}>
            O TTC oferece uma estrutura completa, pensada para que esporte, bem-estar e lazer caminhem
            juntos. Conheça os principais espaços e atividades do clube:
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16, marginBottom: 28,
          }}>
            <FeatureCard icon="🏊" title="Piscinas e Parque Aquático" items={[
              'Piscina semiolímpica para natação, treinos e recreação',
              'Tobogã — grande atrativo para crianças e famílias',
              'Amplas áreas de lazer e quiosques ao redor das piscinas',
              'Reserva exclusiva de quiosques para sócios',
            ]} />
            <FeatureCard icon="🎾" title="Tênis" items={[
              'Quadras de saibro que dão nome ao clube',
              'Praticantes de todos os níveis',
              'Palco de torneios regionais — Copa Agro e Domino\'s Open',
              'Sede da 4ª Agro Open de Tênis 2026',
            ]} />
            <FeatureCard icon="🏖️" title="Beach Tennis e Futevôlei" items={[
              'Quadras de areia para beach tennis e futevôlei',
              'Modalidades em forte crescimento na região',
              'Sede de competições e torneios oficiais',
              'Torneio de tênis de Carnaval',
            ]} />
            <FeatureCard icon="🥋" title="Karatê" items={[
              'Aulas para crianças e adolescentes',
              'Duas vezes por semana com turmas regulares',
              'Formação esportiva e disciplina',
            ]} />
            <FeatureCard icon="🤸" title="Natação e Hidroginástica" items={[
              'Aulas de natação para adultos e crianças (2x/semana)',
              'Hidroginástica para adultos',
              'Saúde, condicionamento e bem-estar',
            ]} />
            <FeatureCard icon="🍽️" title="Restaurante, Bar e Convivência" items={[
              'Restaurante e bar com rodízio de petiscos',
              'Transmissão de grandes eventos esportivos',
              'Áreas sociais e quiosques para confraternizações',
              'Sauna em dias específicos da semana',
            ]} />
          </div>

          {/* Segunda foto */}
          <div style={{
            borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}>
            <img
              src="/ttc/area-piscina.jpg"
              alt="Área da piscina semiolímpica do TTC"
              style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover', maxHeight: 320 }}
            />
            <div style={{
              background: C.deep, color: 'rgba(255,255,255,0.8)',
              fontSize: '0.85rem', textAlign: 'center', padding: '8px 16px', fontStyle: 'italic',
            }}>
              Espaço amplo ao redor das piscinas, integrado às quadras esportivas
            </div>
          </div>
        </Section>

        {/* Eventos */}
        <Section id="eventos" title="Eventos e Comunidade">
          <p style={{ color: '#374151', lineHeight: 1.7, marginBottom: 24, fontSize: '1rem' }}>
            O TTC mantém uma <strong>agenda viva de eventos esportivos e sociais</strong> que movimentam
            Tangará da Serra o ano todo. O clube sedia torneios e competições que reúnem atletas locais e
            de toda a região, reforçando seu papel como referência esportiva no interior de Mato Grosso.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { icon: '🌾', title: 'Copa Agro de Tênis', desc: 'Celebra a ligação entre esporte e agronegócio. Já na 4ª edição, com apoio de empresas da região.' },
              { icon: '🍕', title: "Domino's Open", desc: 'Torneio que reúne os principais tenistas do clube e da região.' },
              { icon: '🏖️', title: 'Beach Tennis TTC', desc: 'Torneio de beach tennis com premiação e brindes aos inscritos.' },
              { icon: '🎉', title: 'Tênis de Carnaval', desc: 'Torneio especial de Carnaval com provas de tênis e beach tennis.' },
            ].map((ev, i) => (
              <div key={i} style={{
                background: '#fff', borderRadius: 10, padding: '16px 18px',
                border: `1px solid #e5e7eb`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}>
                <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{ev.icon}</div>
                <div style={{ fontWeight: 700, color: C.deep, marginBottom: 6, fontSize: '0.95rem' }}>{ev.title}</div>
                <div style={{ color: '#6b7280', fontSize: '0.85rem', lineHeight: 1.5 }}>{ev.desc}</div>
              </div>
            ))}
          </div>

          <p style={{ color: '#374151', lineHeight: 1.7, margin: 0, fontSize: '1rem' }}>
            Além das competições, o TTC promove encontros sociais e ações em parceria com a comunidade —
            das tradicionais tardes de domingo às transmissões de grandes jogos no restaurante do clube.
            Essa vocação para reunir pessoas faz do TTC muito mais do que um espaço esportivo: é um
            verdadeiro <strong>patrimônio social de Tangará da Serra</strong>, onde tradição, esporte e
            celebração caminham lado a lado.
          </p>
        </Section>

        {/* Galeria de Fotos */}
        <Section id="galeria" title="Galeria de Fotos">
          <p style={{ color: '#374151', lineHeight: 1.7, marginBottom: 24, fontSize: '1rem' }}>
            Momentos reais do Tangará Tênis Clube — beach tennis, tênis, eventos e muito mais.
            Siga <strong>@ttctga</strong> no Instagram para acompanhar o dia a dia do clube.
          </p>

          <GaleriaFotos />

          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <a
              href="https://www.instagram.com/ttctga/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)',
                color: '#fff', padding: '13px 28px', borderRadius: 30,
                fontWeight: 700, textDecoration: 'none', fontSize: '0.95rem',
                boxShadow: '0 4px 16px rgba(130,58,180,0.35)',
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>📸</span>
              Ver mais no Instagram @ttctga
            </a>
          </div>
        </Section>

        {/* Seja Sócio */}
        <Section id="seja-socio" title="Seja Sócio do TTC">
          <div style={{
            background: `linear-gradient(135deg, ${C.deep}, #1a4a2e)`,
            borderRadius: 16, padding: '32px 28px', color: '#fff',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.7, marginBottom: 24, fontSize: '1rem' }}>
              Fazer parte do Tangará Tênis Clube é garantir, para você e sua família, acesso ao melhor
              do esporte e do lazer em Tangará da Serra — com o menor preço para a diversão da família.
            </p>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 28,
            }}>
              {[
                '✅ Acesso ilimitado à piscina e áreas de lazer',
                '✅ Reserva exclusiva de quiosques',
                '✅ Aulas de natação para adultos e crianças (2×/sem)',
                '✅ Aulas de karatê para crianças e adolescentes (2×/sem)',
                '✅ Hidroginástica para adultos',
                '✅ Brinde de boas-vindas ao se associar',
              ].map((b, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.1)', borderRadius: 8,
                  padding: '10px 14px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.95)',
                }}>{b}</div>
              ))}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: C.lime, fontWeight: 800, fontSize: '1.1rem', marginBottom: 16 }}>
                #VemSerSócio — associe-se e faça parte dessa história
              </div>
              <a
                href="https://wa.me/5565999247052"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block', background: C.green, color: '#fff',
                  padding: '14px 32px', borderRadius: 30, fontWeight: 700,
                  textDecoration: 'none', fontSize: '1rem',
                  boxShadow: '0 4px 16px rgba(95,179,53,0.4)',
                }}
              >
                💬 Falar pelo WhatsApp
              </a>
            </div>
          </div>
        </Section>

        {/* Contato */}
        <Section id="contato" title="Contato e Localização">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 24 }}>
            <InfoCard icon="📍" label="Endereço" value="Rua Benedito Pereira de Oliveira, 1500 — Jardim Tangará, Tangará da Serra/MT — CEP 78300-000" />
            <InfoCard icon="💬" label="WhatsApp" value="(65) 99924-7052" />
            <InfoCard icon="📞" label="Secretaria" value="(65) 99606-2398 / (65) 3326-1356" />
            <InfoCard icon="✉️" label="E-mail" value="tangaratc@outlook.com" />
            <InfoCard icon="🌐" label="Site Oficial" value="tangaratenisclube.com.br" />
            <InfoCard icon="📸" label="Instagram" value="@ttctga" />
          </div>

          {/* Mapa */}
          <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
            <iframe
              title="Localização TTC"
              src="https://maps.google.com/maps?q=Rua+Benedito+Pereira+de+Oliveira+1500+Tangará+da+Serra+MT&output=embed"
              width="100%"
              height="280"
              style={{ border: 0, display: 'block' }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </Section>

      </div>
    </div>
  )
}

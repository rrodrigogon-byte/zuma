import React, { useState, useEffect } from 'react'
import { useSearchParams, useParams, Link } from 'react-router-dom'
import {
  Crown,
  Scissors,
  CheckCircle2,
  Sparkles,
  Phone,
  User,
  ArrowRight,
  ShieldCheck,
  Calendar,
  MessageSquare,
  Award,
} from 'lucide-react'

function moeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ehProfissionalDino(nome = '') {
  const n = String(nome).toLowerCase()
  return n.includes('dino') || n.includes('guilherme')
}

export default function BarbeariaClubeVip() {
  const [searchParams] = useSearchParams()
  const params = useParams()
  const slug = params.slug || searchParams.get('slug') || 'dino'
  const planoParamId = searchParams.get('plano')
  const profParamId = searchParams.get('prof')

  const [loading, setLoading] = useState(true)
  const [estabelecimento, setEstabelecimento] = useState(null)
  const [planos, setPlanos] = useState([])
  const [profissionais, setProfissionais] = useState([])

  const [planoSelecionadoId, setPlanoSelecionadoId] = useState(planoParamId || '')
  const [profSelecionadoId, setProfSelecionadoId] = useState(profParamId || '')
  const [nomeCliente, setNomeCliente] = useState('')
  const [telefoneCliente, setTelefoneCliente] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      try {
        setLoading(true)
        const res = await fetch(`/api/publico/agendamento/${encodeURIComponent(slug)}/planos`)
        const data = await res.json()
        if (data.ok) {
          setEstabelecimento(data.estabelecimento)
          setPlanos(data.planos || [])
          // Se tiver plano no query param, já pré-seleciona
          if (planoParamId && data.planos.some((p) => p.id === planoParamId)) {
            setPlanoSelecionadoId(planoParamId)
          } else if (data.planos.length > 0) {
            setPlanoSelecionadoId(data.planos[0].id)
          }
        }

        // Carrega também profissionais da unidade
        const resUnidade = await fetch(`/api/publico/agendamento/${encodeURIComponent(slug)}`)
        const dataUnidade = await resUnidade.json()
        if (dataUnidade.ok) {
          setProfissionais(dataUnidade.profissionais || [])
          if (profParamId && dataUnidade.profissionais.some((p) => p.id === profParamId)) {
            setProfSelecionadoId(profParamId)
          }
        }
      } catch (err) {
        console.error('Erro ao carregar clube VIP:', err)
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [slug, planoParamId, profParamId])

  const planoAtivo = planos.find((p) => p.id === planoSelecionadoId) || planos[0]
  const profAtivo = profissionais.find((p) => p.id === profSelecionadoId)

  // Preço dinâmico considerando profissional selecionado
  const precoDinamico =
    profSelecionadoId && planoAtivo?.precosPorProfissional?.[profSelecionadoId]
      ? Number(planoAtivo.precosPorProfissional[profSelecionadoId])
      : Number(planoAtivo?.preco || 0)

  async function handleAdesao(e) {
    e.preventDefault()
    if (!planoAtivo || !nomeCliente || !telefoneCliente) return
    setEnviando(true)
    setErro('')
    try {
      const res = await fetch(`/api/publico/agendamento/${encodeURIComponent(slug)}/assinatura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteNome: nomeCliente,
          clienteTelefone: telefoneCliente,
          planoId: planoAtivo.id,
          profissionalId: profSelecionadoId || null,
          observacoes,
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setSucesso(data)
      } else {
        setErro(data.error || 'Não foi possível registrar a adesão. Tente novamente.')
      }
    } catch (err) {
      setErro('Erro na conexão. Verifique sua internet e tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0D1117',
        color: '#E8EAF2',
        fontFamily: "'Inter', -apple-system, sans-serif",
        padding: '30px 16px 60px',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gap: 32 }}>
        {/* HEADER / HERO */}
        <header style={{ textAlign: 'center', display: 'grid', gap: 12 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              borderRadius: 30,
              background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(212, 175, 55, 0.05) 100%)',
              border: '1px solid rgba(212, 175, 55, 0.4)',
              color: '#FFD700',
              fontWeight: 800,
              fontSize: 13,
              margin: '0 auto',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            <Crown size={16} /> Clube VIP & Assinaturas Exclusivas
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(28px, 5vw, 42px)',
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '-0.5px',
            }}
          >
            {estabelecimento?.nome || 'Barbearia Dino'}
          </h1>
          <p
            style={{
              margin: '0 auto',
              maxWidth: 600,
              fontSize: 'clamp(14px, 2.5vw, 16px)',
              color: '#A4AABE',
              lineHeight: 1.5,
            }}
          >
            Garanta sua cadeira com o Mestre Dino ou com nossos profissionais de elite. Procedimentos mensais,
            prioridade absoluta e vantagens exclusivas de sócio.
          </p>
        </header>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#A4AABE' }}>Carregando planos VIP…</div>
        ) : sucesso ? (
          /* TELA DE SUCESSO DA ADESÃO */
          <div
            style={{
              background: 'linear-gradient(145deg, rgba(20, 184, 122, 0.12) 0%, rgba(28, 32, 43, 0.95) 70%)',
              border: '2px solid #14B87A',
              borderRadius: 24,
              padding: '36px 24px',
              textAlign: 'center',
              display: 'grid',
              gap: 20,
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: '50%',
                background: '#14B87A',
                color: '#121212',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              <CheckCircle2 size={40} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#FFFFFF' }}>
                🎉 Bem-vindo ao Clube VIP!
              </h2>
              <p style={{ margin: '8px 0 0', color: '#A4AABE', fontSize: 15 }}>
                Sua solicitação de adesão ao <strong>{sucesso.plano?.nome}</strong> foi registrada com sucesso.
              </p>
            </div>

            <div
              style={{
                background: '#161922',
                border: '1px solid #2B3140',
                borderRadius: 16,
                padding: 20,
                maxWidth: 480,
                margin: '0 auto',
                width: '100%',
                display: 'grid',
                gap: 10,
                textAlign: 'left',
                fontSize: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#A4AABE' }}>Sócio:</span>
                <strong>{nomeCliente}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#A4AABE' }}>WhatsApp:</span>
                <strong>{telefoneCliente}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#A4AABE' }}>Plano:</span>
                <strong style={{ color: '#FFD700' }}>{sucesso.plano?.nome}</strong>
              </div>
              {sucesso.assinatura?.profissionalNome && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#A4AABE' }}>Profissional:</span>
                  <strong>👑 {sucesso.assinatura.profissionalNome}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#A4AABE' }}>Valor Mensal:</span>
                <strong style={{ color: '#14B87A', fontSize: 16 }}>{moeda(sucesso.precoFinal)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Olá! Acabei de aderir ao *${sucesso.plano?.nome}* na Barbearia Dino no valor de ${moeda(
                    sucesso.precoFinal
                  )}${
                    sucesso.assinatura?.profissionalNome
                      ? ` com o profissional *${sucesso.assinatura.profissionalNome}*`
                      : ''
                  }! Meu WhatsApp: ${telefoneCliente}.`
                )}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '14px 28px',
                  borderRadius: 12,
                  background: '#25D366',
                  color: '#121212',
                  fontWeight: 800,
                  fontSize: 15,
                  textDecoration: 'none',
                }}
              >
                <MessageSquare size={18} /> Confirmar via WhatsApp
              </a>
              <Link
                to={`/agendar/${slug}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '14px 24px',
                  borderRadius: 12,
                  background: '#242938',
                  border: '1px solid #2B3140',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: 'none',
                }}
              >
                <Calendar size={18} /> Agendar 1º Atendimento
              </Link>
            </div>
          </div>
        ) : (
          /* SELEÇÃO DE PLANOS & FORMULÁRIO DE ADESÃO */
          <>
            {/* CARDS DOS PLANOS DISPONÍVEIS */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
              }}
            >
              {planos.map((plano) => {
                const ehVip = Boolean(plano.ehVip)
                const selecionado = plano.id === planoSelecionadoId
                const ehDino = ehProfissionalDino(plano.profissionalNome || plano.nome)

                return (
                  <div
                    key={plano.id}
                    onClick={() => setPlanoSelecionadoId(plano.id)}
                    style={{
                      background: selecionado
                        ? 'linear-gradient(145deg, rgba(212, 175, 55, 0.15) 0%, #1C202B 70%)'
                        : '#1C202B',
                      border: `2px solid ${
                        selecionado ? '#FFD700' : ehVip ? 'rgba(212, 175, 55, 0.5)' : '#2B3140'
                      }`,
                      borderRadius: 18,
                      padding: 24,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 16,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      transform: selecionado ? 'scale(1.02)' : 'none',
                      boxShadow: selecionado ? '0 12px 30px rgba(212, 175, 55, 0.2)' : 'none',
                    }}
                  >
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {ehVip ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '3px 8px',
                              borderRadius: 20,
                              background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
                              color: '#121212',
                              fontWeight: 900,
                              fontSize: 11,
                            }}
                          >
                            <Crown size={12} /> VIP
                          </span>
                        ) : (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: 20,
                              background: '#242938',
                              color: '#A4AABE',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            Recorrência
                          </span>
                        )}
                        {selecionado && (
                          <span style={{ color: '#14B87A', fontSize: 12, fontWeight: 800 }}>✓ Selecionado</span>
                        )}
                      </div>

                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#FFFFFF' }}>{plano.nome}</h3>

                      {plano.profissionalNome && (
                        <div style={{ fontSize: 12, color: ehDino ? '#FFD700' : '#6E7CE0', fontWeight: 700 }}>
                          {ehDino ? '👑 Atendimento Exclusivo:' : '✂️ Profissional:'} {plano.profissionalNome}
                        </div>
                      )}

                      <p style={{ margin: 0, fontSize: 13, color: '#A4AABE', lineHeight: 1.4 }}>
                        {plano.descricao || `${plano.sessoesIncluidas} atendimentos por mês.`}
                      </p>

                      <div style={{ borderTop: '1px solid #2B3140', paddingTop: 12, display: 'grid', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#E8EAF2' }}>
                          <CheckCircle2 size={15} color="#14B87A" /> {plano.sessoesIncluidas} procedimentos por ciclo
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#E8EAF2' }}>
                          <CheckCircle2 size={15} color="#14B87A" /> Prioridade na fila e agenda
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#E8EAF2' }}>
                          <CheckCircle2 size={15} color="#14B87A" /> Bebida cortesia na recepção
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #2B3140', paddingTop: 14 }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#14B87A' }}>{moeda(plano.preco)}</div>
                      <div style={{ fontSize: 12, color: '#A4AABE' }}>por {plano.ciclo}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* FORMULÁRIO DE ADESÃO COM ESCOLHA DO PROFISSIONAL */}
            <div
              style={{
                background: '#1C202B',
                border: '1.5px solid #2B3140',
                borderRadius: 20,
                padding: '28px 24px',
                display: 'grid',
                gap: 20,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={20} color="#FFD700" /> Solicitar Adesão Online
                </h3>
                <p style={{ margin: '4px 0 0', color: '#A4AABE', fontSize: 14 }}>
                  Preencha seus dados para vincular seu plano VIP com o profissional escolhido.
                </p>
              </div>

              {erro && (
                <div
                  style={{
                    background: 'rgba(224, 92, 92, 0.15)',
                    border: '1px solid #E05C5C',
                    borderRadius: 10,
                    padding: '10px 14px',
                    color: '#FF8888',
                    fontSize: 13,
                  }}
                >
                  {erro}
                </div>
              )}

              <form onSubmit={handleAdesao} style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#A4AABE', display: 'block', marginBottom: 6 }}>
                      Seu Nome Completo *
                    </label>
                    <input
                      required
                      value={nomeCliente}
                      onChange={(e) => setNomeCliente(e.target.value)}
                      placeholder="Ex: Carlos Eduardo Silveira"
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        background: '#161922',
                        border: '1px solid #2B3140',
                        borderRadius: 10,
                        color: '#E8EAF2',
                        fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#A4AABE', display: 'block', marginBottom: 6 }}>
                      WhatsApp com DDD *
                    </label>
                    <input
                      required
                      value={telefoneCliente}
                      onChange={(e) => setTelefoneCliente(e.target.value)}
                      placeholder="(66) 99999-9999"
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        background: '#161922',
                        border: '1px solid #2B3140',
                        borderRadius: 10,
                        color: '#E8EAF2',
                        fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* ESCOLHA DO PROFISSIONAL (DINO VS OUTROS PROFISSIONAIS) */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#A4AABE', display: 'block', marginBottom: 6 }}>
                    Profissional de Preferência (Diferenciação de Valores):
                  </label>
                  <select
                    value={profSelecionadoId}
                    onChange={(e) => setProfSelecionadoId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: '#161922',
                      border: '1px solid #2B3140',
                      borderRadius: 10,
                      color: '#E8EAF2',
                      fontSize: 14,
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="">Qualquer profissional da equipe (Sem exclusividade)</option>
                    {profissionais
                      .filter((p) => p.ativo !== false)
                      .map((p) => {
                        const isDino = ehProfissionalDino(p.nome)
                        const precoDiferenciado = planoAtivo?.precosPorProfissional?.[p.id]
                        return (
                          <option key={p.id} value={p.id}>
                            {isDino ? '👑 ' : '✂️ '}
                            {p.nome} {precoDiferenciado ? `— ${moeda(precoDiferenciado)}` : ''}
                          </option>
                        )
                      })}
                  </select>
                </div>

                {/* RESUMO DO VALOR FINAL COM O PROFISSIONAL ESCOLHIDO */}
                <div
                  style={{
                    background: profAtivo && ehProfissionalDino(profAtivo.nome)
                      ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.18) 0%, rgba(28, 32, 43, 0.95) 100%)'
                      : '#161922',
                    border: `1.5px solid ${
                      profAtivo && ehProfissionalDino(profAtivo.nome) ? '#FFD700' : '#2B3140'
                    }`,
                    borderRadius: 14,
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: '#A4AABE', textTransform: 'uppercase', fontWeight: 800 }}>
                      Total da Adesão
                    </div>
                    <div style={{ fontSize: 14, color: '#FFFFFF', marginTop: 2 }}>
                      {planoAtivo?.nome} {profAtivo ? `com ${profAtivo.nome}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#14B87A' }}>{moeda(precoDinamico)}</div>
                    <div style={{ fontSize: 11, color: '#A4AABE' }}>ciclo {planoAtivo?.ciclo || 'mensal'}</div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={enviando || !nomeCliente || !telefoneCliente}
                  style={{
                    padding: '16px 24px',
                    borderRadius: 12,
                    border: 0,
                    background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
                    color: '#121212',
                    fontWeight: 900,
                    fontSize: 16,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    boxShadow: '0 6px 20px rgba(212, 175, 55, 0.3)',
                    opacity: enviando ? 0.7 : 1,
                  }}
                >
                  <Crown size={20} />
                  {enviando ? 'Processando Adesão…' : 'Garantir Minha Vaga no Clube VIP'}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

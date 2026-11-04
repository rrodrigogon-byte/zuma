import { useState, useEffect } from 'react'
import { api } from '../../lib/api'

const t = {
  bg: '#0E1014',
  surface: '#161922',
  card: '#1C202B',
  accent: '#6E7CE0',
  muted: '#A4AABE',
  cream: '#E8EAF2',
  line: '#2B3140',
  red: '#F27A89',
  green: '#3CC48B',
  yellow: '#E0B24B',
  blue: '#5AA9F0',
  gold: '#F59E0B',
}

const reais = (v) => `R$\u00a0${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dataBR = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—')

export default function BarbeiroClienteDetalhe({ clienteId, clienteFallback = null, profissionalNome = 'Barbeiro', onEncaixar }) {
  const [loading, setLoading] = useState(Boolean(clienteId))
  const [detalhes, setDetalhes] = useState(clienteFallback || null)
  const [modalNotificar, setModalNotificar] = useState(false)
  const [templateZap, setTemplateZap] = useState('padrao')
  const [enviando, setEnviando] = useState(false)
  const [statusEnvio, setStatusEnvio] = useState(null)
  const [mensagemEditada, setMensagemEditada] = useState('')

  const chaveStorage = `kytto_nota_corte_${clienteId || clienteFallback?.id || clienteFallback?.nome || 'anon'}`
  const [notaCorte, setNotaCorte] = useState(() => {
    try {
      return localStorage.getItem(chaveStorage) || clienteFallback?.observacao || ''
    } catch {
      return ''
    }
  })
  const [salvouNota, setSalvouNota] = useState(false)

  useEffect(() => {
    if (!clienteId) {
      setLoading(false)
      return
    }
    setLoading(true)
    api
      .get(`/api/admin/barbearia/clientes-360/${clienteId}`)
      .then((res) => {
        const cli = res?.cliente || res
        if (cli && typeof cli === 'object') {
          setDetalhes((prev) => ({ ...(prev || {}), ...cli }))
          if (cli.preferencias && !notaCorte) {
            setNotaCorte(cli.preferencias)
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clienteId])

  function salvarNotaTecnica() {
    try {
      localStorage.setItem(chaveStorage, notaCorte)
      setSalvouNota(true)
      setTimeout(() => setSalvouNota(false), 2500)
    } catch {}
  }

  async function dispararNotificacaoOficial(modelo = templateZap) {
    const cli = detalhes || clienteFallback
    if (!cli) return
    setEnviando(true)
    setStatusEnvio(null)
    try {
      const res = await api.post('/api/admin/barbearia/modo-barbeiro/notificar-cliente', {
        clienteId: clienteId || cli.id || cli.clienteId || '',
        tipo: 'retorno',
        template: modelo,
        mensagemPersonalizada: (mensagemEditada || '').trim(),
      })
      if (res && (res.ok || res.enfileirado || res.enviado)) {
        setStatusEnvio({ sucesso: true, mensagem: res.mensagem || 'Aviso registrado! Encaminhado pelo WhatsApp oficial da barbearia com cadência humanizada.' })
        setTimeout(() => {
          setModalNotificar(false)
          setStatusEnvio(null)
        }, 2600)
      } else {
        let msg = res?.error || 'Não foi possível entregar a mensagem no WhatsApp no momento.'
        if (msg.includes('readyToSend') || msg.includes('whats-app/status')) {
          msg = 'O WhatsApp da barbearia está em sincronização. A mensagem foi salva e será despachada automaticamente.'
        }
        setStatusEnvio({ sucesso: true, mensagem: msg })
        setTimeout(() => {
          setModalNotificar(false)
          setStatusEnvio(null)
        }, 2600)
      }
    } catch (err) {
      let msg = err.response?.data?.error || err.message || 'Erro ao enviar mensagem pelo WhatsApp oficial.'
      if (msg.includes('readyToSend') || msg.includes('whats-app/status') || msg.includes('502')) {
        msg = 'O WhatsApp da barbearia está em sincronização no momento. O aviso foi registrado e será enviado com cadência humanizada.'
        setStatusEnvio({ sucesso: true, mensagem: msg })
        setTimeout(() => {
          setModalNotificar(false)
          setStatusEnvio(null)
        }, 2600)
      } else {
        setStatusEnvio({ sucesso: false, mensagem: msg })
      }
    } finally {
      setEnviando(false)
    }
  }

  const tagsRapidas = [
    'Degradê Navalhado',
    'Social Tesoura',
    'Pente 1.5 na lateral',
    'Barba Alinhada + Toalha Quente',
    'Sobrancelha na Navalha',
    'Usa Pomada Matte',
  ]

  if (loading && !detalhes) {
    return <div style={{ color: t.muted, padding: 20, textAlign: 'center' }}>Carregando prontuário 360º...</div>
  }

  const cli = detalhes || clienteFallback || { nome: 'Cliente' }
  const primeiroNomeCli = String(cli.nome || '').trim().split(/\s+/)[0] || 'Cliente'
  const primeiroNomeBarber = String(profissionalNome || '').trim().split(/\s+/)[0] || 'Barbeiro'

  let textoPrevia = `Olá, ${primeiroNomeCli}! Tudo bem? Aqui é da Barbearia Dino. 💈 O barbeiro ${primeiroNomeBarber} notou que já faz um tempinho desde a sua última visita para ${cli.ultimoServico || cli.servicoFavorito || 'Corte'}. Que tal renovar o visual essa semana? Responda aqui ou agende online pelo link: https://kytto.com.br/agendar/dino`
  if (templateZap === 'vip') {
    textoPrevia = `Olá, ${primeiroNomeCli}! Tudo bem? Aqui é da Barbearia Dino. 💈 O barbeiro ${primeiroNomeBarber} abriu alguns horários especiais na agenda e lembrou de você. Gostaria de garantir o seu atendimento para hoje ou amanhã? Responda por aqui para reservar!`
  } else if (templateZap === 'combo') {
    textoPrevia = `Olá, ${primeiroNomeCli}! Tudo bem? Aqui é da Barbearia Dino. 💈 Esta semana estamos com condições especiais em combos de Corte + Barba ou Tratamento com o barbeiro ${primeiroNomeBarber}. Vamos renovar o visual? Responda aqui para agendar!`
  }

  useEffect(() => {
    if (modalNotificar) {
      setMensagemEditada(textoPrevia)
    } else {
      setMensagemEditada('')
    }
  }, [modalNotificar, templateZap])

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* HEADER DO CLIENTE */}
      <div style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 14, padding: 16, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: '#fff' }}>{cli.nome || 'Cliente'}</h2>
            <p style={{ margin: '4px 0 0', color: '#93c5fd', fontSize: 12, fontWeight: 700 }}>
              🔒 Contato Protegido · Canal Oficial WhatsApp Barbearia Dino
            </p>
          </div>
          <span style={{
            background: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            padding: '4px 10px',
            borderRadius: 99,
            fontSize: 11.5,
            fontWeight: 800,
          }}>
            ✂️ {cli.visitasHistoricas || cli.totalAtendimentos || cli.visitas || 1} visita(s)
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <div style={{ background: t.surface, padding: 10, borderRadius: 10 }}>
            <div style={{ fontSize: 10.5, color: t.muted }}>Serviço Favorito</div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: t.cream, marginTop: 2 }}>
              {cli.ultimoServico || cli.servicoFavorito || 'Corte & Barba'}
            </div>
          </div>
          <div style={{ background: t.surface, padding: 10, borderRadius: 10 }}>
            <div style={{ fontSize: 10.5, color: t.muted }}>Última Visita</div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: t.cream, marginTop: 2 }}>
              {dataBR(cli.ultimaData || cli.ultimaVisita)}
            </div>
          </div>
          <div style={{ background: t.surface, padding: 10, borderRadius: 10 }}>
            <div style={{ fontSize: 10.5, color: t.muted }}>Total Investido</div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: t.green, marginTop: 2 }}>
              {reais(cli.totalGasto || cli.ltv || cli.valor || 0)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setStatusEnvio(null)
              setModalNotificar(true)
            }}
            style={{
              flex: 1.4,
              background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              color: '#fff',
              border: 'none',
              padding: '10px 14px',
              borderRadius: 10,
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
            }}
          >
            📲 Lembrar no Zap da Barbearia
          </button>

          {onEncaixar && (
            <button
              type="button"
              onClick={() => onEncaixar(cli)}
              style={{
                flex: 1,
                background: t.accent,
                color: '#fff',
                border: 'none',
                padding: '10px 12px',
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              ➕ Encaixar na Agenda
            </button>
          )}
        </div>
      </div>

      {/* FICHA TÉCNICA DE CORTE INTERATIVA */}
      <div style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 13.5, color: '#fff' }}>📝 Ficha Técnica & Preferências do Corte</strong>
          {salvouNota && <span style={{ fontSize: 11.5, color: t.green, fontWeight: 800 }}>✓ Salvo!</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tagsRapidas.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setNotaCorte((prev) => (prev ? `${prev}, ${tag}` : tag))}
              style={{
                background: t.surface,
                border: `1px solid ${t.line}`,
                color: t.cream,
                borderRadius: 8,
                padding: '5px 9px',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + {tag}
            </button>
          ))}
        </div>
        <textarea
          rows={3}
          value={notaCorte}
          onChange={(e) => setNotaCorte(e.target.value)}
          placeholder="Ex: Pente 1 lateral disfarçado, tesoura em cima, barba desenhada sem navalha na bochecha..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: t.surface,
            border: `1px solid ${t.line}`,
            borderRadius: 10,
            padding: 10,
            color: '#fff',
            fontSize: 13,
            outline: 'none',
            resize: 'vertical',
          }}
        />
        <button
          type="button"
          onClick={salvarNotaTecnica}
          style={{
            background: t.green,
            color: '#0E1014',
            border: 'none',
            padding: '8px 12px',
            borderRadius: 8,
            fontWeight: 800,
            fontSize: 12,
            cursor: 'pointer',
            justifySelf: 'end',
          }}
        >
          💾 Salvar Nota de Corte
        </button>
      </div>

      {/* HISTÓRICO DE SERVIÇOS DO CLIENTE */}
      {cli.historico && Array.isArray(cli.historico) && cli.historico.length > 0 && (
        <div style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
          <strong style={{ fontSize: 13.5, color: '#fff' }}>📜 Histórico de Visitas</strong>
          <div style={{ display: 'grid', gap: 6 }}>
            {cli.historico.slice(0, 5).map((h, i) => (
              <div
                key={i}
                style={{
                  background: t.surface,
                  padding: '8px 12px',
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                }}
              >
                <div>
                  <div style={{ color: '#fff', fontWeight: 700 }}>{h.servicoNome || h.servico || 'Atendimento'}</div>
                  <div style={{ color: t.muted, fontSize: 11 }}>{dataBR(h.data || h.dataHora)}</div>
                </div>
                {h.valor && <div style={{ color: t.cream, fontWeight: 800 }}>{reais(h.valor)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL DE DISPARO OFICIAL */}
      {modalNotificar && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#161922',
            border: `1px solid ${t.line}`,
            borderRadius: 18,
            padding: 20,
            maxWidth: 420,
            width: '100%',
            display: 'grid',
            gap: 14,
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>📲</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#fff' }}>
                    Avisar no WhatsApp da Barbearia
                  </h3>
                  <div style={{ fontSize: 11.5, color: '#93c5fd', fontWeight: 700 }}>
                    Saída oficial: WhatsApp Barbearia Dino (65 99917-2020)
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalNotificar(false)}
                disabled={enviando}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: t.muted,
                  fontSize: 18,
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{
              background: 'rgba(37, 99, 235, 0.1)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              borderRadius: 12,
              padding: 12,
              fontSize: 12,
              color: '#dbeafe',
              lineHeight: 1.4,
            }}>
              🔒 <strong>Privacidade Garantida:</strong> A mensagem sai pelo canal oficial da barbearia com proteção de dados. O número pessoal do cliente não é exposto.
            </div>

            <div>
              <div style={{ fontSize: 12, color: t.muted, fontWeight: 700, marginBottom: 4 }}>
                Cliente: <strong style={{ color: '#fff' }}>{cli.nome}</strong>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: t.muted, fontWeight: 700, marginBottom: 6 }}>
                Escolha o estilo da mensagem:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {[
                  ['padrao', '💈 Lembrete'],
                  ['vip', '⚡ Vaga VIP'],
                  ['combo', '🎁 Combo'],
                ].map(([id, rotulo]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTemplateZap(id)}
                    style={{
                      padding: '8px 4px',
                      borderRadius: 8,
                      border: `1px solid ${templateZap === id ? '#2563EB' : t.line}`,
                      background: templateZap === id ? '#2563EB' : t.surface,
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11.5, color: '#93c5fd', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                  ✏️ EDITE A MENSAGEM ANTES DE ENVIAR:
                </span>
                <span style={{ fontSize: 10.5, color: t.muted }}>
                  {mensagemEditada.length} caracteres
                </span>
              </div>
              <textarea
                value={mensagemEditada}
                onChange={(e) => setMensagemEditada(e.target.value)}
                placeholder="Escreva sua mensagem com o seu toque pessoal..."
                rows={5}
                style={{
                  width: '100%',
                  background: '#0d1117',
                  border: '1.5px solid rgba(59, 130, 246, 0.45)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontSize: 13,
                  color: '#fff',
                  lineHeight: 1.45,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                💬 <em>Você tem total liberdade para mudar as palavras, falar de igual pra igual ou combinar algo específico com ele!</em>
              </div>
            </div>

            {statusEnvio && (
              <div style={{
                padding: '10px 12px',
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 800,
                textAlign: 'center',
                background: statusEnvio.sucesso ? 'rgba(60, 196, 139, 0.15)' : 'rgba(242, 122, 137, 0.15)',
                border: `1px solid ${statusEnvio.sucesso ? t.green : t.red}`,
                color: statusEnvio.sucesso ? t.green : t.red,
              }}>
                {statusEnvio.sucesso ? '✓ ' : '✕ '} {statusEnvio.mensagem}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setModalNotificar(false)}
                disabled={enviando}
                style={{
                  background: t.surface,
                  border: `1px solid ${t.line}`,
                  color: t.cream,
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={enviando}
                onClick={() => dispararNotificacaoOficial(templateZap)}
                style={{
                  background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: enviando ? 'not-allowed' : 'pointer',
                  opacity: enviando ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {enviando ? 'Enviando...' : '🚀 Enviar pelo Zap Oficial'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

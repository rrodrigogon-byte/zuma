import { useState, useMemo } from 'react'
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
const dataBR = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : 'Recente')

export default function BarbeiroClientes({ clientes = [], profissionalNome = 'Barbeiro', onAbrirProntuario, onEncaixarCliente }) {
  const [busca, setBusca] = useState('')
  const [filtroRetorno, setFiltroRetorno] = useState('todos')
  const [templateZap, setTemplateZap] = useState('padrao')
  const [clienteModal, setClienteModal] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [statusEnvio, setStatusEnvio] = useState(null)

  const clientesNorm = useMemo(() => {
    return clientes.map((c) => {
      const dias = Number(c.diasDesdeUltimo ?? c.diasSemRetorno ?? 0)
      const status = c.statusRetorno === 'sumido' ? 'atrasado' : (c.statusRetorno || (dias <= 15 ? 'em_dia' : dias <= 30 ? 'ideal_retorno' : 'atrasado'))
      return {
        ...c,
        id: c.id || c.clienteId || null,
        clienteId: c.clienteId || c.id || null,
        ultimoServico: c.ultimoServico || c.servicoFavorito || 'Corte Masculino',
        ultimaData: c.ultimaData || c.ultimaVisita || '',
        diasDesdeUltimo: dias,
        totalAtendimentos: Number(c.totalAtendimentos || c.totalAtendimentosComBarbeiro || 1),
        totalGasto: Number(c.totalGasto || c.totalGastoComBarbeiro || 0),
        statusRetorno: status,
      }
    })
  }, [clientes])

  const qtdEmDia = clientesNorm.filter((c) => c.statusRetorno === 'em_dia').length
  const qtdIdeal = clientesNorm.filter((c) => c.statusRetorno === 'ideal_retorno').length
  const qtdAtrasados = clientesNorm.filter((c) => c.statusRetorno === 'atrasado').length

  const listaFiltrada = useMemo(() => {
    let res = clientesNorm
    if (busca.trim()) {
      const q = busca.toLowerCase()
      res = res.filter(
        (c) =>
          (c.nome || '').toLowerCase().includes(q) ||
          (c.ultimoServico || '').toLowerCase().includes(q)
      )
    }
    if (filtroRetorno === 'retorno_ideal') {
      res = res.filter((c) => c.statusRetorno === 'ideal_retorno')
    } else if (filtroRetorno === 'atrasados') {
      res = res.filter((c) => c.statusRetorno === 'atrasado')
    } else if (filtroRetorno === 'em_dia') {
      res = res.filter((c) => c.statusRetorno === 'em_dia')
    }
    return res
  }, [clientesNorm, busca, filtroRetorno])

  async function dispararAvisoOficial(cliente, modelo = templateZap) {
    if (!cliente) return
    setEnviando(true)
    setStatusEnvio(null)
    try {
      const res = await api.post('/api/admin/barbearia/modo-barbeiro/notificar-cliente', {
        clienteId: cliente.clienteId || cliente.id || '',
        tipo: 'retorno',
        template: modelo,
      })
      if (res && res.ok) {
        setStatusEnvio({ sucesso: true, mensagem: res.mensagem || 'Mensagem enviada com sucesso pelo WhatsApp oficial da barbearia!' })
        setTimeout(() => {
          setClienteModal(null)
          setStatusEnvio(null)
        }, 2200)
      } else {
        throw new Error(res?.error || 'Não foi possível entregar a mensagem no WhatsApp.')
      }
    } catch (err) {
      setStatusEnvio({ sucesso: false, mensagem: err.message || 'Erro ao enviar mensagem pelo WhatsApp oficial.' })
    } finally {
      setEnviando(false)
    }
  }

  const primeiroNomeCli = clienteModal ? String(clienteModal.nome || '').split(' ')[0] : 'Cliente'
  const primeiroNomeBarber = String(profissionalNome || '').split(' ')[0] || 'Barbeiro'

  let textoPrevia = `Olá, ${primeiroNomeCli}! Tudo bem? Aqui é da Barbearia Dino. 💈 O barbeiro ${primeiroNomeBarber} notou que já faz um tempinho desde a sua última visita para ${clienteModal?.ultimoServico || 'Corte'}. Que tal renovar o visual essa semana? Responda aqui ou agende online pelo link: https://kytto.com.br/agendar/dino`
  if (templateZap === 'vip') {
    textoPrevia = `Olá, ${primeiroNomeCli}! Tudo bem? Aqui é da Barbearia Dino. 💈 O barbeiro ${primeiroNomeBarber} abriu alguns horários especiais na agenda e lembrou de você. Gostaria de garantir o seu atendimento para hoje ou amanhã? Responda por aqui para reservar!`
  } else if (templateZap === 'combo') {
    textoPrevia = `Olá, ${primeiroNomeCli}! Tudo bem? Aqui é da Barbearia Dino. 💈 Esta semana estamos com condições especiais em combos de Corte + Barba ou Tratamento com o barbeiro ${primeiroNomeBarber}. Vamos renovar o visual? Responda aqui para agendar!`
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* HEADER CRM CARTEIRA DO BARBEIRO */}
      <div style={{
        background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 14,
        display: 'grid',
        gap: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              👥 Minha Carteira de Clientes & Retorno
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginTop: 2 }}>
              {clientesNorm.length} cliente(s) atendidos por { String(profissionalNome).split(' ')[0] }
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <button
            type="button"
            onClick={() => setFiltroRetorno(filtroRetorno === 'em_dia' ? 'todos' : 'em_dia')}
            style={{
              background: filtroRetorno === 'em_dia' ? 'rgba(60, 196, 139, 0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${filtroRetorno === 'em_dia' ? t.green : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 12,
              padding: 8,
              textAlign: 'center',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 10, color: t.muted, fontWeight: 700 }}>EM DIA (&le;15d)</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: t.green, marginTop: 2 }}>{qtdEmDia}</div>
          </button>

          <button
            type="button"
            onClick={() => setFiltroRetorno(filtroRetorno === 'retorno_ideal' ? 'todos' : 'retorno_ideal')}
            style={{
              background: filtroRetorno === 'retorno_ideal' ? 'rgba(224, 178, 75, 0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${filtroRetorno === 'retorno_ideal' ? t.yellow : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 12,
              padding: 8,
              textAlign: 'center',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 10, color: t.muted, fontWeight: 700 }}>VOLTAR (16-30d)</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: t.yellow, marginTop: 2 }}>{qtdIdeal}</div>
          </button>

          <button
            type="button"
            onClick={() => setFiltroRetorno(filtroRetorno === 'atrasados' ? 'todos' : 'atrasados')}
            style={{
              background: filtroRetorno === 'atrasados' ? 'rgba(242, 122, 137, 0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${filtroRetorno === 'atrasados' ? t.red : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 12,
              padding: 8,
              textAlign: 'center',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 10, color: t.muted, fontWeight: 700 }}>SUMIDOS (+30d)</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: t.red, marginTop: 2 }}>{qtdAtrasados}</div>
          </button>
        </div>

        {/* SELETOR DE SCRIPT DE ABORDAGEM WHATSAPP */}
        <div>
          <div style={{ fontSize: 11, color: t.muted, fontWeight: 700, marginBottom: 6 }}>
            💬 Modelo da mensagem oficial de retorno (WhatsApp Barbearia Dino):
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {[
              ['padrao', '💈 Lembrete Corte'],
              ['vip', '⚡ Vaga VIP Hoje'],
              ['combo', '🎁 Oferta Combo'],
            ].map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTemplateZap(id)}
                style={{
                  padding: '6px 8px',
                  borderRadius: 8,
                  border: `1px solid ${templateZap === id ? '#2563EB' : t.line}`,
                  background: templateZap === id ? 'rgba(37, 99, 235, 0.25)' : t.surface,
                  color: templateZap === id ? '#93c5fd' : t.cream,
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
      </div>

      {/* CAMPO DE PESQUISA */}
      <input
        type="search"
        placeholder="🔍 Buscar cliente por nome ou serviço…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          minHeight: 44,
          padding: '10px 14px',
          borderRadius: 12,
          border: `1px solid ${t.line}`,
          background: t.surface,
          color: t.cream,
          fontSize: 14,
          outline: 'none',
        }}
      />

      {/* FILTROS DE RETORNO */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {[
          ['todos', `Todos (${clientesNorm.length})`],
          ['retorno_ideal', `Hora de Voltar (${qtdIdeal})`],
          ['atrasados', `Em Risco (${qtdAtrasados})`],
          ['em_dia', `Em Dia (${qtdEmDia})`],
        ].map(([chave, label]) => {
          const ativo = filtroRetorno === chave
          return (
            <button
              key={chave}
              type="button"
              onClick={() => setFiltroRetorno(chave)}
              style={{
                background: ativo ? t.accent : t.surface,
                color: ativo ? '#fff' : t.muted,
                border: `1px solid ${ativo ? t.accent : t.line}`,
                borderRadius: 99,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* LISTA DE CLIENTES */}
      <div style={{ display: 'grid', gap: 10 }}>
        {listaFiltrada.length === 0 ? (
          <div style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 14, padding: 20, textAlign: 'center', color: t.muted }}>
            Nenhum cliente encontrado neste filtro.
          </div>
        ) : (
          listaFiltrada.map((c, i) => {
            const corStatus = c.statusRetorno === 'em_dia' ? t.green : c.statusRetorno === 'ideal_retorno' ? t.yellow : t.red
            const rotuloStatus = c.statusRetorno === 'em_dia' ? 'Cortou recente' : c.statusRetorno === 'ideal_retorno' ? 'Hora de voltar!' : 'Sumido / Risco'
            return (
              <div
                key={`${c.id || c.clienteId || c.nome}-${i}`}
                style={{
                  background: t.card,
                  border: `1px solid ${c.statusRetorno === 'ideal_retorno' ? 'rgba(224, 178, 75, 0.4)' : t.line}`,
                  borderRadius: 14,
                  padding: 14,
                  display: 'grid',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>
                      {c.nome}
                    </div>
                    <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>
                      ✂️ {c.ultimoServico} · Último: {dataBR(c.ultimaData)}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#93c5fd', marginTop: 3, fontWeight: 700 }}>
                      {c.totalAtendimentos} visita(s) {c.totalGasto > 0 ? `· LTV ${reais(c.totalGasto)}` : ''}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      color: corStatus,
                      background: 'rgba(255,255,255,0.05)',
                      border: `1px solid ${corStatus}`,
                      borderRadius: 12,
                      padding: '3px 8px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {rotuloStatus} ({c.diasDesdeUltimo}d)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusEnvio(null)
                      setClienteModal(c)
                    }}
                    style={{
                      flex: 1.4,
                      background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                      color: '#fff',
                      border: 'none',
                      textAlign: 'center',
                      padding: '9px 10px',
                      borderRadius: 10,
                      fontWeight: 800,
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
                    }}
                  >
                    📲 Lembrar no Zap da Barbearia
                  </button>

                  {onAbrirProntuario && (
                    <button
                      type="button"
                      onClick={() => onAbrirProntuario(c)}
                      style={{
                        flex: 1,
                        background: t.surface,
                        border: `1px solid ${t.line}`,
                        color: t.cream,
                        padding: '8px 10px',
                        borderRadius: 10,
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      👤 Ficha 360º
                    </button>
                  )}

                  {onEncaixarCliente && (
                    <button
                      type="button"
                      onClick={() => onEncaixarCliente(c)}
                      style={{
                        flex: 1,
                        background: 'rgba(110, 124, 224, 0.18)',
                        border: `1px solid ${t.accent}`,
                        color: '#c7d2fe',
                        padding: '8px 10px',
                        borderRadius: 10,
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      ➕ Encaixar
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* MODAL DE NOTIFICAÇÃO PELO WHATSAPP OFICIAL DA BARBEARIA */}
      {clienteModal && (
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
                onClick={() => setClienteModal(null)}
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
              🔒 <strong>Privacidade Garantida:</strong> A mensagem sai pelo canal institucional da barbearia com proteção de dados e cadência humanizada. O número pessoal do cliente não é exposto.
            </div>

            <div>
              <div style={{ fontSize: 12, color: t.muted, fontWeight: 700, marginBottom: 4 }}>
                Cliente: <strong style={{ color: '#fff' }}>{clienteModal.nome}</strong> · Último corte há {clienteModal.diasDesdeUltimo} dias
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

            <div style={{
              background: t.card,
              border: `1px solid ${t.line}`,
              borderRadius: 12,
              padding: 12,
              fontSize: 12,
              color: t.cream,
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
            }}>
              <span style={{ fontSize: 10.5, color: '#93c5fd', fontWeight: 800, display: 'block', marginBottom: 4 }}>
                PRÉVIA DA MENSAGEM OFICIAL:
              </span>
              {textoPrevia}
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
                onClick={() => setClienteModal(null)}
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
                onClick={() => dispararAvisoOficial(clienteModal, templateZap)}
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

import { useState, useMemo } from 'react'

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
const soDigitos = (v) => String(v || '').replace(/\D/g, '')

function linkWhatsappMensagem(telefone, nomeCliente, nomeBarbeiro, ultimoServico, dias, template = 'padrao') {
  const d = soDigitos(telefone)
  if (d.length < 10) return ''
  const telCompleto = d.startsWith('55') ? d : `55${d}`
  const primeiroNome = String(nomeCliente || '').trim().split(/\s+/)[0] || 'amigo'
  const barberNome = String(nomeBarbeiro || '').trim().split(/\s+/)[0] || 'seu barbeiro'

  let texto = `Fala ${primeiroNome}, beleza? Aqui é o ${barberNome} da Barbearia Dino! 💈 Vi que já faz ${dias > 0 ? `${dias} dias` : 'um tempinho'} do seu último ${ultimoServico || 'corte'}. Vamos renovar o visual essa semana? Me avisa que já separo seu horário!`
  if (template === 'vip') {
    texto = `E aí ${primeiroNome}! Aqui é o ${barberNome} da Barbearia Dino 💈 Abri 2 horários especiais hoje/amanhã na minha agenda e lembrei de você. Quer garantir sua cadeira?`
  } else if (template === 'combo') {
    texto = `Fala ${primeiroNome}! ${barberNome} da Barbearia Dino por aqui 💈 Essa semana estamos com condição especial fazendo Corte + Barba ou Hidratação. Bora dar um talento no visual?`
  }
  return `https://wa.me/${telCompleto}?text=${encodeURIComponent(texto)}`
}

export default function BarbeiroClientes({ clientes = [], profissionalNome = 'Barbeiro', onAbrirProntuario, onEncaixarCliente }) {
  const [busca, setBusca] = useState('')
  const [filtroRetorno, setFiltroRetorno] = useState('todos') // 'todos', 'retorno_ideal', 'atrasados', 'em_dia'
  const [templateZap, setTemplateZap] = useState('padrao') // 'padrao' | 'vip' | 'combo'

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
          (c.telefone || '').includes(q) ||
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
            <div style={{ fontSize: 10, color: t.muted, fontWeight: 700 }}>EM DIA (≤15d)</div>
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
            <div style={{ fontSize: 10, color: t.muted, fontWeight: 700 }}>CHAMAR (16-30d)</div>
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
            💬 Estilo da mensagem rápida de WhatsApp:
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
                  border: `1px solid ${templateZap === id ? '#16A34A' : t.line}`,
                  background: templateZap === id ? 'rgba(22, 163, 74, 0.2)' : t.surface,
                  color: templateZap === id ? '#86efac' : t.cream,
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
        placeholder="🔍 Buscar cliente por nome, telefone ou serviço…"
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
                padding: '6px 12px',
                borderRadius: 20,
                border: `1px solid ${ativo ? t.accent : t.line}`,
                background: ativo ? t.accent : t.surface,
                color: ativo ? '#fff' : t.cream,
                fontWeight: 700,
                fontSize: 12,
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
            const zap = linkWhatsappMensagem(c.telefone, c.nome, profissionalNome, c.ultimoServico, c.diasDesdeUltimo, templateZap)
            const corStatus = c.statusRetorno === 'em_dia' ? t.green : c.statusRetorno === 'ideal_retorno' ? t.yellow : t.red
            const rotuloStatus = c.statusRetorno === 'em_dia' ? 'Cortou recente' : c.statusRetorno === 'ideal_retorno' ? 'Hora de voltar!' : 'Sumido / Risco'

            return (
              <div
                key={`${c.id || c.telefone || c.nome}-${i}`}
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
                  {zap && (
                    <a
                      href={zap}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1.4,
                        background: '#16A34A',
                        color: '#fff',
                        textDecoration: 'none',
                        textAlign: 'center',
                        padding: '8px 10px',
                        borderRadius: 10,
                        fontWeight: 800,
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                    >
                      💬 Chamar Zap
                    </a>
                  )}
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
    </div>
  )
}

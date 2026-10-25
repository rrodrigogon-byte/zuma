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

const dataBR = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '')
const soDigitos = (v) => String(v || '').replace(/\D/g, '')

function linkWhatsappMensagem(telefone, nomeCliente, nomeBarbeiro, ultimoServico, dias) {
  const d = soDigitos(telefone)
  if (d.length < 10) return ''
  const telCompleto = d.startsWith('55') ? d : `55${d}`
  const primeiroNome = String(nomeCliente || '').trim().split(/\s+/)[0] || 'amigo'
  const barberNome = String(nomeBarbeiro || '').trim().split(/\s+/)[0] || 'seu barbeiro'
  const msg = encodeURIComponent(
    `Fala ${primeiroNome}, beleza? Aqui é o ${barberNome} da Barbearia Dino! 💈 Vi que já faz ${dias > 0 ? `${dias} dias` : 'um tempinho'} do seu último corte. Vamos renovar o visual essa semana? Me avisa por aqui que já reservo sua cadeira!`
  )
  return `https://wa.me/${telCompleto}?text=${msg}`
}

export default function BarbeiroClientes({ clientes = [], profissionalNome = 'Barbeiro' }) {
  const [busca, setBusca] = useState('')
  const [filtroRetorno, setFiltroRetorno] = useState('todos') // 'todos', 'retorno_ideal', 'atrasados'

  const listaFiltrada = useMemo(() => {
    let res = clientes
    if (busca.trim()) {
      const q = busca.toLowerCase()
      res = res.filter((c) => (c.nome || '').toLowerCase().includes(q) || (c.telefone || '').includes(q))
    }
    if (filtroRetorno === 'retorno_ideal') {
      res = res.filter((c) => c.statusRetorno === 'ideal_retorno')
    } else if (filtroRetorno === 'atrasados') {
      res = res.filter((c) => c.statusRetorno === 'atrasado')
    }
    return res
  }, [clientes, busca, filtroRetorno])

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* CAMPO DE PESQUISA */}
      <div style={{ display: 'grid', gap: 6 }}>
        <input
          type="text"
          placeholder="Buscar cliente por nome ou telefone…"
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
      </div>

      {/* FILTROS DE RETORNO */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {[
          ['todos', `Todos (${clientes.length})`],
          ['retorno_ideal', `Hora de Voltar (${clientes.filter((c) => c.statusRetorno === 'ideal_retorno').length})`],
          ['atrasados', `Em Risco (${clientes.filter((c) => c.statusRetorno === 'atrasado').length})`],
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
            Nenhum cliente encontrado com este critério.
          </div>
        ) : (
          listaFiltrada.map((c, i) => {
            const zap = linkWhatsappMensagem(c.telefone, c.nome, profissionalNome, c.ultimoServico, c.diasDesdeUltimo)
            const corStatus = c.statusRetorno === 'em_dia' ? t.green : c.statusRetorno === 'ideal_retorno' ? t.yellow : t.red
            const rotuloStatus = c.statusRetorno === 'em_dia' ? 'Cortou recente' : c.statusRetorno === 'ideal_retorno' ? 'Hora de voltar!' : 'Sumido / Risco'

            return (
              <div
                key={`${c.telefone || c.nome}-${i}`}
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
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: t.cream }}>
                      {c.nome}
                    </div>
                    <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>
                      {c.ultimoServico} · Último corte em {dataBR(c.ultimaData)}
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
                      padding: '2px 8px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {rotuloStatus} ({c.diasDesdeUltimo}d)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {zap && (
                    <a
                      href={zap}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1,
                        background: '#16A34A',
                        color: '#fff',
                        textDecoration: 'none',
                        textAlign: 'center',
                        padding: '8px 12px',
                        borderRadius: 10,
                        fontWeight: 800,
                        fontSize: 12.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <span>💬 Convidar Retorno WhatsApp</span>
                    </a>
                  )}
                  {c.telefone && (
                    <a
                      href={`tel:${soDigitos(c.telefone)}`}
                      style={{
                        background: t.surface,
                        border: `1px solid ${t.line}`,
                        color: t.cream,
                        textDecoration: 'none',
                        padding: '8px 14px',
                        borderRadius: 10,
                        fontWeight: 700,
                        fontSize: 12.5,
                      }}
                    >
                      Ligar
                    </a>
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

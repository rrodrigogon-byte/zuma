import PerfilPacoteTelefone from './PerfilPacoteTelefone'
// Painéis de captação e retenção da barbearia (onda 1): retorno previsto,
// lista de espera, indicações, saúde do clube, ocupação/metas por barbeiro e NPS.
// Todos leem /api/admin/barbearia/captacao/* da empresa da sessão.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, fmtR } from '../../../lib/api'
import { useToast } from '../../../hooks/useToast'

const card = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 20 }
const grid = (min = 180) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 })
const kpi = { background: 'var(--card2, var(--card))', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px' }
const kpiLabel = { fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }
const kpiValue = { fontSize: 26, fontWeight: 800, marginTop: 6, fontFamily: 'var(--font-display)' }
const h2 = { margin: 0, fontSize: 18, fontFamily: 'var(--font-display)' }
const sub = { margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }
const table = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const th = { textAlign: 'left', padding: '8px 10px', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--line)' }
const td = { padding: '10px', borderBottom: '1px solid var(--line)', verticalAlign: 'top' }
const btn = { padding: '8px 12px', borderRadius: 9, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 700 }
const btnPrimary = { ...btn, background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
const input = { padding: '8px 10px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', font: 'inherit', fontSize: 13 }
const empty = { padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }

function pct(valor) { return `${(Number(valor || 0) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` }
function dataBR(valor) { return valor ? String(valor).slice(0, 10).split('-').reverse().join('/') : '—' }
function horas(valor) { return `${Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h` }
function Pill({ children, tom = 'neutro' }) {
  const cores = { bom: '#14b87a', alerta: '#f59e0b', critico: '#e05c5c', neutro: 'var(--muted)' }
  return <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 800, color: cores[tom], border: `1px solid ${cores[tom]}` }}>{children}</span>
}

function useCarregar(rota) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const requisicao = useRef(0)
  const carregar = useCallback(async () => {
    const atual = ++requisicao.current
    setCarregando(true)
    setErro('')
    try { const resposta = await api.get(rota); if (atual === requisicao.current) setDados({ rota, resposta }) }
    catch (e) { if (atual === requisicao.current) setErro(e.message || 'Não foi possível carregar.') }
    finally { if (atual === requisicao.current) setCarregando(false) }
  }, [rota])
  useEffect(() => { carregar(); return () => { requisicao.current += 1 } }, [carregar])
  return { dados: dados?.rota === rota ? dados.resposta : null, erro, carregando: carregando || (dados !== null && dados.rota !== rota), carregar }
}

function Estado({ carregando, erro, onRetry }) {
  if (carregando) return <div style={empty} role="status">Carregando…</div>
  if (erro) return <div style={empty} role="alert">{erro} <button type="button" style={btn} onClick={onRetry}>Tentar de novo</button></div>
  return null
}

const SITUACAO = { atrasado: ['Atrasado', 'critico'], esta_semana: ['Volta esta semana', 'alerta'], agendado: ['Já agendado', 'bom'], no_prazo: ['No prazo', 'neutro'] }

// Gera o texto calibrado para o convite de retorno
function gerarTextoConvite(item) {
  const primeiro = String(item?.nome || '').trim().split(/\s+/)[0] || 'Cliente'
  const servico = item?.servicoPreferido?.nome ? ` o seu ${item.servicoPreferido.nome.toLowerCase()}` : ' o seu corte'
  const horario = item?.sugestao
    ? ` Tenho horário livre no dia ${dataBR(item.sugestao.data)} às ${item.sugestao.horario}${item.profissionalPreferido ? ` com ${item.profissionalPreferido.nome}` : ''}. Quer que eu reserve para você?`
    : ' Quer que eu separe o melhor horário da semana para você?'
  return `Olá, ${primeiro}! Tudo bem? Notamos que já está na hora de renovar${servico}.${horario}`
}

function conviteWhatsApp(item, textoPersonalizado) {
  const digitos = String(item?.telefone || '').replace(/\D/g, '')
  if (digitos.length < 10) return ''
  const destino = digitos.startsWith('55') ? digitos : `55${digitos}`
  const texto = textoPersonalizado || gerarTextoConvite(item)
  return `https://wa.me/${destino}?text=${encodeURIComponent(texto)}`
}

export function RetornosPanel({ lojaId = '' } = {}) {
  const { toast } = useToast()
  const urlRetornos = lojaId ? `/api/admin/barbearia/captacao/retornos?lojaId=${encodeURIComponent(lojaId)}` : '/api/admin/barbearia/captacao/retornos'
  const { dados, erro, carregando, carregar } = useCarregar(urlRetornos)
  const [filtroBase, setFiltroBase] = useState('acionaveis') // 'acionaveis' | 'todos'
  const [situacaoFiltro, setSituacaoFiltro] = useState(null) // null | 'atrasado' | 'esta_semana' | 'agendado'
  const [busca, setBusca] = useState('')
  const [ordenacao, setOrdenacao] = useState('atraso') // 'atraso' | 'visitas' | 'nome'
  const [modalCliente, setModalCliente] = useState(null)
  const [textoModal, setTextoModal] = useState('')

  if (carregando || erro) return <div style={card}><Estado carregando={carregando} erro={erro} onRetry={carregar} /></div>

  const resumo = dados?.resumo || {}
  const listaBase = filtroBase === 'acionaveis' ? (dados?.acionaveis || []) : (dados?.todos || [])

  // Filtragem combinada (situação do card + busca)
  const listaFiltrada = listaBase.filter((item) => {
    if (situacaoFiltro && item.situacao !== situacaoFiltro) return false
    if (busca) {
      const q = busca.toLowerCase()
      const t = `${item.nome || ''} ${item.servicoPreferido?.nome || ''} ${item.profissionalPreferido?.nome || ''}`.toLowerCase()
      if (!t.includes(q)) return false
    }
    return true
  })

  // Ordenação
  const listaOrdenada = [...listaFiltrada].sort((a, b) => {
    if (ordenacao === 'atraso') return (b.diasAtraso || 0) - (a.diasAtraso || 0)
    if (ordenacao === 'visitas') return (b.visitas || 0) - (a.visitas || 0)
    if (ordenacao === 'nome') return String(a.nome || '').localeCompare(String(b.nome || ''))
    return 0
  })

  // Estimativa de faturamento recuperável (R$ 65 médio ou valor do serviço preferido)
  const faturamentoRecuperavel = (dados?.acionaveis || [])
    .filter((i) => i.situacao === 'atrasado')
    .reduce((soma, i) => soma + (i.servicoPreferido?.preco || 65), 0)

  function copiarTexto(item, textoPersonalizado) {
    const texto = textoPersonalizado || gerarTextoConvite(item)
    if (navigator.clipboard) {
      navigator.clipboard.writeText(texto).then(() => {
        toast('Mensagem copiada para a área de transferência!')
      }).catch(() => {
        toast('Não foi possível copiar automaticamente.', true)
      })
    }
  }

  function abrirModalConvite(item) {
    setModalCliente(item)
    setTextoModal(gerarTextoConvite(item))
  }

  const kpiCardStyle = (ativo) => ({
    ...kpi,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    border: ativo ? '2px solid var(--accent, #b0892e)' : '1px solid var(--line)',
    background: ativo ? 'var(--card2, rgba(176, 137, 46, 0.08))' : 'var(--card)',
  })

  return <div style={{ display: 'grid', gap: 16 }}>
    {/* Cabeçalho e KPIs Clicáveis */}
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={h2}>CRM de Retenção & Reativação (Retorno Previsto)</h2>
          <p style={sub}>Identificação preditiva do hábito de retorno de cada cliente para reativação ativa e combate ao churn.</p>
        </div>
        {situacaoFiltro && (
          <button type="button" style={{ ...btn, fontSize: 11, padding: '4px 8px' }} onClick={() => setSituacaoFiltro(null)}>
            Ver todos ✕
          </button>
        )}
      </div>

      <div style={{ ...grid(160), marginTop: 14 }}>
        <div
          role="button"
          tabIndex={0}
          style={kpiCardStyle(situacaoFiltro === null)}
          onClick={() => setSituacaoFiltro(null)}
          title="Clique para ver todos os clientes com histórico"
        >
          <div style={kpiLabel}>Com histórico</div>
          <div style={kpiValue}>{resumo.clientesComHistorico || 0}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Base cadastrada</div>
        </div>

        <div
          role="button"
          tabIndex={0}
          style={kpiCardStyle(situacaoFiltro === 'atrasado')}
          onClick={() => setSituacaoFiltro(situacaoFiltro === 'atrasado' ? null : 'atrasado')}
          title="Clique para filtrar clientes atrasados"
        >
          <div style={kpiLabel}>Atrasados</div>
          <div style={{ ...kpiValue, color: '#e05c5c' }}>{resumo.atrasados || 0}</div>
          <div style={{ fontSize: 11, color: '#e05c5c', marginTop: 4 }}>Passaram do prazo habitual</div>
        </div>

        <div
          role="button"
          tabIndex={0}
          style={kpiCardStyle(situacaoFiltro === 'esta_semana')}
          onClick={() => setSituacaoFiltro(situacaoFiltro === 'esta_semana' ? null : 'esta_semana')}
          title="Clique para filtrar quem volta esta semana"
        >
          <div style={kpiLabel}>Voltam esta semana</div>
          <div style={{ ...kpiValue, color: '#f59e0b' }}>{resumo.estaSemana || 0}</div>
          <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>Janela de agendamento</div>
        </div>

        <div
          role="button"
          tabIndex={0}
          style={kpiCardStyle(situacaoFiltro === 'agendado')}
          onClick={() => setSituacaoFiltro(situacaoFiltro === 'agendado' ? null : 'agendado')}
          title="Clique para filtrar clientes já agendados"
        >
          <div style={kpiLabel}>Já agendados</div>
          <div style={{ ...kpiValue, color: '#14b87a' }}>{resumo.agendados || 0}</div>
          <div style={{ fontSize: 11, color: '#14b87a', marginTop: 4 }}>Com horário confirmado</div>
        </div>
      </div>

      {/* Banner de Oportunidade Financeira */}
      {faturamentoRecuperavel > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 14, padding: '10px 14px', background: 'rgba(176, 137, 46, 0.1)', border: '1px solid var(--accent, #b0892e)', borderRadius: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            💰 Potencial de faturamento a reativar: <span style={{ color: 'var(--accent, #b0892e)' }}>{fmtR(faturamentoRecuperavel)}</span> ({resumo.atrasados || 0} clientes atrasados)
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            Reative esses clientes enviando convites pelo WhatsApp com 1 clique.
          </span>
        </div>
      )}
    </div>

    {/* Toolbar de Filtros e Lista */}
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong>{filtroBase === 'acionaveis' ? 'Para chamar agora' : 'Todos com histórico'}</strong>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>({listaOrdenada.length} exibidos)</span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={{ ...input, minWidth: 200, padding: '6px 10px', fontSize: 12 }}
            type="search"
            placeholder="Buscar cliente ou barbeiro..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <select
            style={{ ...input, padding: '6px 8px', fontSize: 12 }}
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value)}
            aria-label="Ordenar por"
          >
            <option value="atraso">Mais atrasados primeiro</option>
            <option value="visitas">Mais visitas (VIPs)</option>
            <option value="nome">Nome alfabético</option>
          </select>

          <div style={{ display: 'flex', gap: 4 }}>
            <button type="button" style={filtroBase === 'acionaveis' ? btnPrimary : btn} onClick={() => setFiltroBase('acionaveis')}>Para chamar</button>
            <button type="button" style={filtroBase === 'todos' ? btnPrimary : btn} onClick={() => setFiltroBase('todos')}>Todos</button>
          </div>
        </div>
      </div>

      {situacaoFiltro && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: 'var(--card2)', borderRadius: 8, marginBottom: 10, fontSize: 12 }}>
          <span>Filtrando por: <strong>{SITUACAO[situacaoFiltro]?.[0] || situacaoFiltro}</strong></span>
          <button type="button" style={{ ...btn, padding: '2px 6px', fontSize: 11 }} onClick={() => setSituacaoFiltro(null)}>Limpar filtro ✕</button>
        </div>
      )}

      {listaOrdenada.length === 0 ? (
        <div style={empty}>Nenhum cliente com estes critérios de busca ou filtro.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Cliente</th>
                <th style={th}>Hábito</th>
                <th style={th}>Última visita</th>
                <th style={th}>Retorno previsto</th>
                <th style={th}>Situação</th>
                <th style={th}>Sugestão</th>
                <th style={th}>Ações de Reativação</th>
              </tr>
            </thead>
            <tbody>
              {listaOrdenada.map((item) => {
                const [rotulo, tom] = SITUACAO[item.situacao] || ['—', 'neutro']
                const linkWa = conviteWhatsApp(item)
                return <tr key={`${item.clienteId}-${item.nome}`}>
                  <td style={td}>
                    <strong>{item.nome}</strong>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {item.visitas} visitas · {item.servicoPreferido?.nome || 'Serviço habitual'}
                      {item.telefone ? ` · ${item.telefone}` : ''}
                    </div>
                  </td>
                  <td style={td}>a cada {item.intervaloHabitualDias} dias</td>
                  <td style={td}>{dataBR(item.ultimaVisita)}</td>
                  <td style={td}>
                    {dataBR(item.retornoPrevisto)}
                    {item.diasAtraso > 0 && <div style={{ color: '#e05c5c', fontSize: 12, fontWeight: 700 }}>{item.diasAtraso} dias de atraso</div>}
                  </td>
                  <td style={td}><Pill tom={tom}>{rotulo}</Pill></td>
                  <td style={td}>
                    {item.sugestao ? (
                      <div>
                        <strong>{dataBR(item.sugestao.data)} às {item.sugestao.horario}</strong>
                        {item.profissionalPreferido && <div style={{ fontSize: 12, color: 'var(--muted)' }}>com {item.profissionalPreferido.nome}</div>}
                      </div>
                    ) : '—'}
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {linkWa ? (
                        <a
                          href={linkWa}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 8px', fontSize: 11 }}
                          title="Abrir WhatsApp com mensagem pronta"
                        >
                          💬 WhatsApp
                        </a>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: 11 }}>Sem telefone</span>
                      )}

                      <button
                        type="button"
                        style={{ ...btn, padding: '5px 8px', fontSize: 11 }}
                        onClick={() => copiarTexto(item)}
                        title="Copiar texto da mensagem de convite"
                      >
                        📋 Copiar
                      </button>

                      <button
                        type="button"
                        style={{ ...btn, padding: '5px 8px', fontSize: 11 }}
                        onClick={() => abrirModalConvite(item)}
                        title="Ver e personalizar a mensagem antes de enviar"
                      >
                        ✏️ Editar
                      </button>
                    </div>
                  </td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {/* Modal de Personalização do Convite */}
    {modalCliente && (
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16,
        }}
        onClick={() => setModalCliente(null)}
      >
        <div
          style={{
            background: 'var(--card, #fff)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            padding: 24,
            maxWidth: 520,
            width: '100%',
            display: 'grid',
            gap: 14,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Convite para {modalCliente.nome}</h3>
            <button type="button" style={{ ...btn, padding: '2px 8px' }} onClick={() => setModalCliente(null)}>✕</button>
          </div>

          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
            Personalize a mensagem abaixo antes de enviar pelo WhatsApp ou copiar para a área de transferência:
          </p>

          <textarea
            style={{ ...input, minHeight: 110, resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
            value={textoModal}
            onChange={(e) => setTextoModal(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              style={btn}
              onClick={() => {
                copiarTexto(modalCliente, textoModal)
                setModalCliente(null)
              }}
            >
              📋 Copiar texto
            </button>

            {conviteWhatsApp(modalCliente, textoModal) && (
              <a
                href={conviteWhatsApp(modalCliente, textoModal)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={() => setModalCliente(null)}
              >
                💬 Abrir no WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
}

const STATUS_ESPERA = { aguardando: ['Aguardando', 'alerta'], agendado: ['Agendado', 'bom'], desistiu: ['Desistiu', 'neutro'], expirado: ['Expirado', 'neutro'] }

export function ListaEsperaPanel() {
  const { toast } = useToast()
  const { dados, erro, carregando, carregar } = useCarregar('/api/admin/barbearia/captacao/lista-espera')
  const [ocupado, setOcupado] = useState('')
  async function mudar(item, status) {
    setOcupado(item.id)
    try { await api.patch(`/api/admin/barbearia/captacao/lista-espera/${encodeURIComponent(item.id)}/status`, { status }); toast('Lista de espera atualizada.', 'success'); carregar() } catch (e) { toast(e.message, 'error') } finally { setOcupado('') }
  }
  if (carregando || erro) return <div style={card}><Estado carregando={carregando} erro={erro} onRetry={carregar} /></div>
  const itens = dados?.itens || []
  const aguardando = itens.filter((item) => item.status === 'aguardando')
  return <div style={card}>
    <h2 style={h2}>Lista de espera da agenda</h2>
    <p style={sub}>Quem não achou horário no link público entra aqui. Quando um horário é cancelado, quem pediu aquele dia e período recebe o aviso no WhatsApp (só com consentimento).</p>
    <div style={{ ...grid(160), margin: '14px 0' }}>
      <div style={kpi}><div style={kpiLabel}>Aguardando</div><div style={kpiValue}>{aguardando.length}</div></div>
      <div style={kpi}><div style={kpiLabel}>Avisados de vaga</div><div style={kpiValue}>{itens.filter((item) => (item.avisos || []).length).length}</div></div>
      <div style={kpi}><div style={kpiLabel}>Viraram agendamento</div><div style={kpiValue}>{itens.filter((item) => item.status === 'agendado').length}</div></div>
    </div>
    {itens.length === 0 ? <div style={empty}>Ninguém na lista de espera.</div> : <div style={{ overflowX: 'auto' }}><table style={table}>
      <thead><tr><th style={th}>Dia</th><th style={th}>Cliente</th><th style={th}>Serviço</th><th style={th}>Período</th><th style={th}>WhatsApp</th><th style={th}>Avisos</th><th style={th}>Status</th><th style={th} /></tr></thead>
      <tbody>{itens.map((item) => {
        const [rotulo, tom] = STATUS_ESPERA[item.status] || ['—', 'neutro']
        return <tr key={item.id}>
          <td style={td}>{dataBR(item.data)}</td>
          <td style={td}><strong>{item.nome}</strong><div style={{ color: 'var(--muted)', fontSize: 12 }}>{item.telefone}</div></td>
          <td style={td}>{item.servicoNome}</td>
          <td style={td}>{{ manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }[item.periodo] || 'Qualquer'}</td>
          <td style={td}>{item.consentimentoWhatsapp ? <Pill tom="bom">Autorizado</Pill> : <Pill>Sem consentimento</Pill>}</td>
          <td style={td}>{(item.avisos || []).length ? (item.avisos || []).map((aviso) => aviso.horaLocal).join(', ') : '—'}</td>
          <td style={td}><Pill tom={tom}>{rotulo}</Pill></td>
          <td style={td}>{item.status === 'aguardando' && <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" style={btn} disabled={ocupado === item.id} onClick={() => mudar(item, 'agendado')}>Agendou</button>
            <button type="button" style={btn} disabled={ocupado === item.id} onClick={() => mudar(item, 'desistiu')}>Desistiu</button>
          </div>}</td>
        </tr>
      })}</tbody>
    </table></div>}
  </div>
}

export function IndicacoesPanel({ clientes = [] }) {
  const { toast } = useToast()
  const { dados, erro, carregando, carregar } = useCarregar('/api/admin/barbearia/captacao/indicacoes')
  const [clienteId, setClienteId] = useState('')
  const [link, setLink] = useState(null)
  const [config, setConfig] = useState(null)
  useEffect(() => { if (dados?.configuracao) setConfig(dados.configuracao) }, [dados])
  async function gerarLink() {
    if (!clienteId) return
    try {
      const resposta = await api.get(`/api/admin/barbearia/captacao/clientes/${encodeURIComponent(clienteId)}/indicacao`)
      setLink({ ...resposta, url: `${window.location.origin}${resposta.link}` })
    } catch (e) { toast(e.message, 'error') }
  }
  async function salvarConfig(event) {
    event.preventDefault()
    if (String(config.pontosIndicador).trim() === '' || String(config.pontosIndicado).trim() === '') { toast('Informe os pontos de quem indica e do indicado.', 'error'); return }
    try { await api.put('/api/admin/barbearia/captacao/configuracao', config); toast('Recompensas salvas.', 'success'); carregar() } catch (e) { toast(e.message, 'error') }
  }
  if (carregando || erro) return <div style={card}><Estado carregando={carregando} erro={erro} onRetry={carregar} /></div>
  const ativos = clientes.filter((item) => !item.padrao && item.status !== 'deletado')
  return <div style={{ display: 'grid', gap: 16 }}>
    <div style={card}>
      <h2 style={h2}>Indique um amigo</h2>
      <p style={sub}>Cada cliente tem um link próprio. Quando o amigo indicado conclui o primeiro atendimento, os dois ganham pontos de fidelidade automaticamente.</p>
      <div style={{ ...grid(160), margin: '14px 0' }}>
        <div style={kpi}><div style={kpiLabel}>Indicações</div><div style={kpiValue}>{dados?.total || 0}</div></div>
        <div style={kpi}><div style={kpiLabel}>Viraram cliente</div><div style={kpiValue}>{dados?.convertidas || 0}</div></div>
        <div style={kpi}><div style={kpiLabel}>Conversão</div><div style={kpiValue}>{dados?.total ? pct(dados.convertidas / dados.total) : '—'}</div></div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label htmlFor="indicacao-cliente" style={{ fontSize: 13, color: 'var(--muted)' }}>Link do cliente</label>
        <select id="indicacao-cliente" style={{ ...input, minWidth: 240 }} value={clienteId} onChange={(e) => { setClienteId(e.target.value); setLink(null) }}>
          <option value="">Selecione um cliente</option>
          {ativos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
        <button type="button" style={btnPrimary} disabled={!clienteId} onClick={gerarLink}>Gerar link</button>
      </div>
      {link && <div style={{ marginTop: 12, padding: 12, border: '1px dashed var(--line)', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <code style={{ fontSize: 13, wordBreak: 'break-all' }}>{link.url}</code>
        <button type="button" style={btn} onClick={() => { navigator.clipboard?.writeText(link.url); toast('Link copiado.', 'success') }}>Copiar</button>
      </div>}
    </div>
    {config && <form onSubmit={salvarConfig} style={{ ...card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>Pontos para quem indica<input type="number" min="0" style={input} value={config.pontosIndicador} onChange={(e) => setConfig((c) => ({ ...c, pontosIndicador: e.target.value }))} /></label>
      <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>Pontos para o indicado<input type="number" min="0" style={input} value={config.pontosIndicado} onChange={(e) => setConfig((c) => ({ ...c, pontosIndicado: e.target.value }))} /></label>
      <button type="submit" style={btnPrimary}>Salvar recompensas</button>
    </form>}
    <div style={card}>
      <strong>Quem mais traz clientes</strong>
      {(dados?.ranking || []).length === 0 ? <div style={empty}>Nenhuma indicação ainda.</div> : <table style={{ ...table, marginTop: 10 }}>
        <thead><tr><th style={th}>Cliente</th><th style={th}>Indicações</th><th style={th}>Convertidas</th><th style={th}>Pontos ganhos</th></tr></thead>
        <tbody>{dados.ranking.map((item) => <tr key={item.clienteId}><td style={td}><strong>{item.nome}</strong></td><td style={td}>{item.indicacoes}</td><td style={td}>{item.convertidas}</td><td style={td}>{item.pontos}</td></tr>)}</tbody>
      </table>}
    </div>
  </div>
}

const ALERTAS = { inadimplente: ['Pacote vencido / renovação pendente', 'critico'], sem_pagamento: ['Sem pagamento confirmado', 'alerta'], sem_uso_risco_cancelamento: ['Sem uso: risco de cancelar', 'alerta'], uso_acima_da_mensalidade: ['Uso acima da mensalidade', 'alerta'] }

export function ClubeSaudePanel() {
  const { toast } = useToast()
  const { dados, erro, carregando, carregar } = useCarregar('/api/admin/barbearia/captacao/clube')
  const [pagando, setPagando] = useState('')
  async function registrarPagamento(item) {
    if (!window.confirm(`Confirmar o recebimento de ${fmtR(item.mensalidade)} de ${item.clienteNome} para este ciclo?`)) return
    setPagando(item.assinaturaId)
    try { await api.post(`/api/admin/barbearia/captacao/assinaturas/${encodeURIComponent(item.assinaturaId)}/pagamentos`, { confirmado: true, valor: item.mensalidade, meio: 'pix', referencia:item.referenciaRenovacao, periodoInicio:item.pagoAte || item.inicio }); toast('Pagamento do ciclo registrado.', 'success'); carregar() } catch (e) { toast(e.message, 'error') } finally { setPagando('') }
  }
  if (carregando || erro) return <div style={card}><Estado carregando={carregando} erro={erro} onRetry={carregar} /></div>
  const saude = dados?.saude || {}
  const candidatos = dados?.candidatos?.candidatos || []
  return <div style={{ display: 'grid', gap: 16 }}>
    <PerfilPacoteTelefone />
    <div style={card}>
      <h2 style={h2}>Saúde do clube de assinatura</h2>
      <p style={sub}>Uso de cada assinante contra a mensalidade. O uso é descontado quando o atendimento do assinante é concluído; inadimplente não consome o plano.</p>
      <div style={{ ...grid(150), marginTop: 14 }}>
        <div style={kpi}><div style={kpiLabel}>Assinantes ativos</div><div style={kpiValue}>{saude.assinantesAtivos || 0}</div></div>
        <div style={kpi}><div style={kpiLabel}>Receita recorrente (mês)</div><div style={kpiValue}>{fmtR(saude.mrr || 0)}</div></div>
        <div style={kpi}><div style={kpiLabel}>Uso médio no ciclo</div><div style={kpiValue}>{Number(saude.usoMedioPorAssinante || 0).toLocaleString('pt-BR')}</div></div>
        <div style={kpi}><div style={kpiLabel}>Em atraso</div><div style={{ ...kpiValue, color: saude.inadimplentes ? '#e05c5c' : undefined }}>{saude.inadimplentes || 0}</div></div>
        <div style={kpi}><div style={kpiLabel}>Risco de cancelar</div><div style={{ ...kpiValue, color: saude.emRisco ? '#f59e0b' : undefined }}>{saude.emRisco || 0}</div></div>
      </div>
    </div>
    <div style={card}>
      <strong>Assinantes</strong>
      {(saude.itens || []).length === 0 ? <div style={empty}>Nenhuma assinatura ativa. Crie um plano em Planos e assinaturas.</div> : <div style={{ overflowX: 'auto' }}><table style={{ ...table, marginTop: 10 }}>
        <thead><tr><th style={th}>Cliente</th><th style={th}>Plano</th><th style={th}>Vencimento / renovação</th><th style={th}>Uso no ciclo</th><th style={th}>Valor avulso usado</th><th style={th}>Margem do ciclo</th><th style={th}>Alertas</th><th style={th} /></tr></thead>
        <tbody>{saude.itens.map((item) => <tr key={item.assinaturaId}>
          <td style={td}><strong>{item.clienteNome}</strong></td>
          <td style={td}>{item.plano}<div style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtR(item.mensalidade)}</div></td>
          <td style={td}>{item.pagoAte ? dataBR(item.pagoAte) : 'Pagamento pendente'}<div style={{fontSize:12,color:'var(--muted)'}}>{item.regraRenovacao==='aniversario'?'Aniversário da contratação':'Período em dias'}</div></td><td style={td}>{item.usosNoCiclo} de {item.limiteNoCiclo}</td>
          <td style={td}>{fmtR(item.valorAvulsoConsumido)}</td>
          <td style={{ ...td, color: item.margemCiclo < 0 ? '#e05c5c' : undefined, fontWeight: 700 }}>{fmtR(item.margemCiclo)}</td>
          <td style={td}><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{item.alertas.length ? item.alertas.map((alerta) => <Pill key={alerta} tom={(ALERTAS[alerta] || [])[1]}>{(ALERTAS[alerta] || [alerta])[0]}</Pill>) : <Pill tom="bom">Saudável</Pill>}</div></td>
          <td style={td}>{item.status === 'ativa' && <button type="button" style={['inadimplente', 'aguardando_pagamento'].includes(item.situacaoPagamento) ? btnPrimary : btn} disabled={pagando === item.assinaturaId} onClick={() => registrarPagamento(item)}>Registrar pagamento do ciclo</button>}{item.pagoAte && <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>Pago até {dataBR(item.pagoAte)}</div>}</td>
        </tr>)}</tbody>
      </table></div>}
    </div>
    <div style={card}>
      <strong>Candidatos ao clube</strong>
      <p style={sub}>Clientes sem plano que gastaram nos últimos 60 dias mais do que pagariam no plano mais barato. É a lista para oferecer o clube no balcão ou no WhatsApp.</p>
      {candidatos.length === 0 ? <div style={empty}>{dados?.candidatos?.planoReferencia ? 'Nenhum cliente gasta hoje mais do que o plano mais barato.' : 'Cadastre um plano para ver os candidatos.'}</div> : <table style={{ ...table, marginTop: 10 }}>
        <thead><tr><th style={th}>Cliente</th><th style={th}>Visitas</th><th style={th}>Gasto médio por mês</th><th style={th}>Plano sugerido</th><th style={th}>Economia por mês</th></tr></thead>
        <tbody>{candidatos.map((item) => <tr key={`${item.clienteId}-${item.nome}`}><td style={td}><strong>{item.nome}</strong></td><td style={td}>{item.visitas}</td><td style={td}>{fmtR(item.gastoMensalAvulso)}</td><td style={td}>{item.planoSugerido.nome}<div style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtR(item.planoSugerido.mensal)}</div></td><td style={{ ...td, color: '#14b87a', fontWeight: 800 }}>{fmtR(item.economiaMensal)}</td></tr>)}</tbody>
      </table>}
    </div>
  </div>
}

function mesAtual() {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
}

export function OcupacaoMetasPanel() {
  const { toast } = useToast()
  const [mes, setMesBruto] = useState(mesAtual())
  const { dados, erro, carregando, carregar } = useCarregar(`/api/admin/barbearia/captacao/metas-profissionais?mes=${mes}`)
  const [edicao, setEdicao] = useState({})
  // Trocar de mês descarta metas em edição (senão seriam salvas no mês errado).
  const setMes = (valor) => { setEdicao({}); setMesBruto(valor) }
  async function salvar(profissionalId) {
    const meta = edicao[profissionalId] || {}
    try { await api.put('/api/admin/barbearia/captacao/metas-profissionais', { profissionalId, mes, receita: Number(meta.receita || 0), atendimentos: Number(meta.atendimentos || 0) }); toast('Meta salva.', 'success'); setEdicao((e) => ({ ...e, [profissionalId]: undefined })); carregar() } catch (e) { toast(e.message, 'error') }
  }
  const linhas = dados?.profissionais || []
  const capacidade = linhas.reduce((s, item) => s + item.capacidadeMinutos, 0)
  const agendados = linhas.reduce((s, item) => s + item.minutosAgendados, 0)
  const metasReceita = linhas.filter((item) => item.meta?.receita)
  const metaTotal = metasReceita.reduce((s, item) => s + Number(item.meta.receita || 0), 0)
  const receitaTotal = metasReceita.reduce((s, item) => s + Number(item.receita || 0), 0)
  const projecaoTotal = metasReceita.reduce((s, item) => s + Number(item.projecaoReceita || 0), 0)
  return <div style={{ display: 'grid', gap: 16 }}>
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><h2 style={h2}>Ocupação da agenda e metas por barbeiro</h2><p style={sub}>Defina quanto cada barbeiro quer faturar. A projeção usa dias úteis, histórico real, ticket médio, duração dos atendimentos e a agenda já reservada.</p></div>
        <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>Mês<input type="month" style={input} value={mes} onChange={(e) => setMes(e.target.value)} /></label>
      </div>
      {!carregando && !erro && <div style={{ ...grid(160), marginTop: 14 }}>
        <div style={kpi}><div style={kpiLabel}>Ocupação geral</div><div style={kpiValue}>{capacidade ? pct(agendados / capacidade) : '—'}</div></div>
        <div style={kpi}><div style={kpiLabel}>Horas agendadas</div><div style={kpiValue}>{Math.round(agendados / 60)}h</div></div>
        <div style={kpi}><div style={kpiLabel}>Horas disponíveis</div><div style={kpiValue}>{Math.round(capacidade / 60)}h</div></div>
        {metasReceita.length > 0 && <><div style={kpi}><div style={kpiLabel}>Meta da equipe</div><div style={kpiValue}>{fmtR(metaTotal)}</div></div><div style={kpi}><div style={kpiLabel}>Projeção da equipe</div><div style={kpiValue}>{fmtR(projecaoTotal)}</div><div style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtR(receitaTotal)} realizados</div></div></>}
      </div>}
    </div>
    {!carregando && !erro && metasReceita.length > 0 && <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div><h2 style={h2}>Plano para bater a meta</h2><p style={sub}>“Produção adicional” é o que ainda precisa entrar além dos horários que já estão na agenda. O cálculo é uma orientação; não cria agendamentos nem promete faturamento.</p></div>
        <Pill tom={projecaoTotal >= metaTotal ? 'bom' : 'alerta'}>{projecaoTotal >= metaTotal ? 'Equipe no ritmo' : 'Ação necessária'}</Pill>
      </div>
      <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
        {metasReceita.map((item) => {
          const temBase = Number(item.ticketMedio || 0) > 0
          return <div key={item.profissionalId} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div><strong style={{ fontSize: 15 }}>{item.nome}</strong><div style={{ color: 'var(--muted)', fontSize: 12 }}>Meta {fmtR(item.meta.receita)} · realizado {fmtR(item.receita)} · projeção {fmtR(item.projecaoReceita)}</div></div>
              <Pill tom={item.noRitmo ? 'bom' : 'alerta'}>{item.noRitmo ? 'No ritmo' : 'Acelerar'}</Pill>
            </div>
            <div style={{ ...grid(135), marginTop: 12 }}>
              <div style={kpi}><div style={kpiLabel}>Falta no total</div><div style={kpiValue}>{fmtR(item.receitaRestante)}</div></div>
              <div style={kpi}><div style={kpiLabel}>Já agendado</div><div style={kpiValue}>{fmtR(item.receitaAgendada)}</div><div style={{ color: 'var(--muted)', fontSize: 12 }}>{item.atendimentosAgendados} atendimentos</div></div>
              <div style={kpi}><div style={kpiLabel}>Produção adicional</div><div style={kpiValue}>{fmtR(item.receitaExtraNecessaria)}</div></div>
              <div style={kpi}><div style={kpiLabel}>Atendimentos extras</div><div style={kpiValue}>{temBase ? item.atendimentosExtrasReceita : '—'}</div><div style={{ color: 'var(--muted)', fontSize: 12 }}>{temBase ? 'além da agenda' : 'sem histórico suficiente'}</div></div>
              <div style={kpi}><div style={kpiLabel}>Horas de cadeira extras</div><div style={kpiValue}>{temBase ? horas(item.minutosExtrasReceita / 60) : '—'}</div><div style={{ color: 'var(--muted)', fontSize: 12 }}>{item.ocupacaoNecessaria == null ? 'capacidade não calculada' : `ocupação necessária ${pct(item.ocupacaoNecessaria)}`}</div></div>
              <div style={kpi}><div style={kpiLabel}>Ritmo necessário</div><div style={kpiValue}>{fmtR(item.receitaDiariaNecessaria)}</div><div style={{ color: 'var(--muted)', fontSize: 12 }}>{item.atendimentosDiariosNecessarios || 0} atend./dia · {item.diasUteisRestantes} dias úteis</div></div>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10 }}>{temBase ? `Base usada: ticket médio de ${fmtR(item.ticketMedio)} e ${horas(item.duracaoMedia / 60)} por atendimento.` : 'Conclua e registre alguns atendimentos para o sistema estimar ticket e tempo de produção.'}</div>
          </div>
        })}
      </div>
    </div>}
    <div style={card}>
      {(carregando || erro) ? <Estado carregando={carregando} erro={erro} onRetry={carregar} /> : linhas.length === 0 ? <div style={empty}>Cadastre a equipe para ver a ocupação.</div> : <div style={{ overflowX: 'auto' }}><table style={table}>
        <thead><tr><th style={th}>Barbeiro</th><th style={th}>Ocupação</th><th style={th}>Concluídos</th><th style={th}>Receita</th><th style={th}>Meta de receita</th><th style={th}>Projeção no ritmo</th><th style={th}>Meta de atendimentos</th><th style={th} /></tr></thead>
        <tbody>{linhas.map((item) => {
          const emEdicao = edicao[item.profissionalId]
          return <tr key={item.profissionalId}>
            <td style={td}><strong>{item.nome}</strong></td>
            <td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div aria-hidden="true" style={{ width: 80, height: 6, borderRadius: 3, background: 'var(--line)' }}><div style={{ width: `${Math.min(100, item.ocupacao * 100)}%`, height: 6, borderRadius: 3, background: 'var(--accent)' }} /></div>{pct(item.ocupacao)}</div></td>
            <td style={td}>{item.concluidos}</td>
            <td style={td}>{fmtR(item.receita)}</td>
            <td style={td}>{emEdicao ? <input type="number" min="0" style={{ ...input, width: 110 }} aria-label={`Meta de receita de ${item.nome}`} value={emEdicao.receita} onChange={(e) => setEdicao((x) => ({ ...x, [item.profissionalId]: { ...emEdicao, receita: e.target.value } }))} /> : item.meta?.receita ? <>{fmtR(item.meta.receita)}<div style={{ color: 'var(--muted)', fontSize: 12 }}>{pct(item.progressoReceita)} atingido</div></> : '—'}</td>
            <td style={td}>{item.meta?.receita ? <Pill tom={item.noRitmo ? 'bom' : 'alerta'}>{fmtR(item.projecaoReceita)}</Pill> : fmtR(item.projecaoReceita)}</td>
            <td style={td}>{emEdicao ? <input type="number" min="0" style={{ ...input, width: 90 }} aria-label={`Meta de atendimentos de ${item.nome}`} value={emEdicao.atendimentos} onChange={(e) => setEdicao((x) => ({ ...x, [item.profissionalId]: { ...emEdicao, atendimentos: e.target.value } }))} /> : item.meta?.atendimentos ? `${item.concluidos} de ${item.meta.atendimentos}` : '—'}</td>
            <td style={td}>{emEdicao ? <div style={{ display: 'flex', gap: 6 }}><button type="button" style={btnPrimary} onClick={() => salvar(item.profissionalId)}>Salvar</button><button type="button" style={btn} onClick={() => setEdicao((x) => ({ ...x, [item.profissionalId]: undefined }))}>Cancelar</button></div> : <button type="button" style={btn} onClick={() => setEdicao((x) => ({ ...x, [item.profissionalId]: { receita: item.meta?.receita || '', atendimentos: item.meta?.atendimentos || '' } }))}>Definir meta</button>}</td>
          </tr>
        })}</tbody>
      </table></div>}
    </div>
  </div>
}

const CATEGORIA_NPS = { promotor: ['Promotor', 'bom'], neutro: ['Neutro', 'alerta'], detrator: ['Detrator', 'critico'] }

function periodoNps(dias) {
  if (dias === 'todos') return ''
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const inicio = new Date(`${hoje}T12:00:00Z`)
  inicio.setUTCDate(inicio.getUTCDate() - Number(dias) + 1)
  return `?inicio=${inicio.toISOString().slice(0, 10)}&fim=${hoje}`
}

export function NpsPanel() {
  const { toast } = useToast()
  const [periodo, setPeriodo] = useState('90')
  const [customNpsInicio, setCustomNpsInicio] = useState('')
  const [customNpsFim, setCustomNpsFim] = useState('')
  
  const queryPeriodo = periodo === 'custom' && customNpsInicio && customNpsFim 
    ? `?inicio=${customNpsInicio}&fim=${customNpsFim}` 
    : periodoNps(periodo)
    
  const { dados, erro, carregando, carregar } = useCarregar(`/api/admin/barbearia/captacao/nps${queryPeriodo}`)
  const config = useCarregar('/api/admin/barbearia/captacao/configuracao')
  const [atraso, setAtraso] = useState('0')
  useEffect(() => {
    if (!config.dados?.configuracao) return
    setAtraso(String(config.dados.configuracao.pedirAvaliacaoAposMinutos ?? 0))
  }, [config.dados])
  async function salvar(event) {
    event.preventDefault()
    try {
      await api.put('/api/admin/barbearia/captacao/configuracao', { pedirAvaliacaoAposMinutos: Number(atraso) })
      toast('Avaliações configuradas.', 'success')
      config.carregar(); carregar()
    } catch (e) { toast(e.message, 'error') }
  }
  if (carregando || erro || config.carregando || config.erro) return <div style={card}><Estado carregando={carregando || config.carregando} erro={erro || config.erro} onRetry={() => { carregar(); config.carregar() }} /></div>
  const tomNps = dados?.nps == null ? 'neutro' : dados.nps >= 50 ? 'bom' : dados.nps >= 0 ? 'alerta' : 'critico'
  const cores = { bom: '#14b87a', alerta: '#f59e0b', critico: '#e05c5c', neutro: 'var(--fg)' }
  const maiorFaixa = Math.max(1, ...(dados?.distribuicao || []).map((item) => item.respostas))
  return <div style={{ display: 'grid', gap: 16 }}>
    {dados?.armazenamentoDuravel === false && <div role="alert" style={{ ...card, color: '#c73535', fontWeight: 700 }}>Armazenamento persistente de avaliações não confirmado. O formulário recusa novas respostas para não perdê-las no deploy; verifique o disco/DB_PATH do serviço.</div>}
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div><h2 style={h2}>Avaliações da Barbearia (NPS)</h2><p style={sub}>Questionário da própria Dino. Após a conclusão, o convite é programado somente com consentimento de WhatsApp e canal ativo. Nota e comentário ficam no sistema.</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 4, color: 'var(--muted)', fontSize: 12 }}>Período
            <select style={input} value={periodo} onChange={(e) => { setPeriodo(e.target.value); if(e.target.value !== 'custom') { setCustomNpsInicio(''); setCustomNpsFim(''); } }}>
              <option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="todos">Todo o histórico</option><option value="custom">Personalizado</option>
            </select>
          </label>
          {periodo === 'custom' && (
            <>
              <label style={{ display: 'grid', gap: 4, color: 'var(--muted)', fontSize: 12 }}>De
                <input type="date" style={input} value={customNpsInicio} onChange={(e) => setCustomNpsInicio(e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: 4, color: 'var(--muted)', fontSize: 12 }}>Até
                <input type="date" style={input} value={customNpsFim} onChange={(e) => setCustomNpsFim(e.target.value)} />
              </label>
            </>
          )}
        </div>
      </div>
      <div style={{ ...grid(150), marginTop: 14 }}>
        <div style={kpi}><div style={kpiLabel}>NPS</div><div style={{ ...kpiValue, color: cores[tomNps] }}>{dados?.nps ?? '—'}</div></div>
        <div style={kpi}><div style={kpiLabel}>Respostas</div><div style={kpiValue}>{dados?.respostas || 0}</div></div>
        <div style={kpi}><div style={kpiLabel}>Atendimentos concluídos</div><div style={kpiValue}>{dados?.atendimentosConcluidos ?? 0}</div></div>
        <div style={kpi}><div style={kpiLabel}>Participação</div><div style={kpiValue}>{dados?.taxaResposta == null ? '—' : `${dados.taxaResposta.toLocaleString('pt-BR')}%`}</div></div>
        <div style={kpi}><div style={kpiLabel}>Promotores</div><div style={{ ...kpiValue, color: '#14b87a' }}>{dados?.promotores || 0}</div></div>
        <div style={kpi}><div style={kpiLabel}>Neutros</div><div style={{ ...kpiValue, color: '#f59e0b' }}>{dados?.neutros || 0}</div></div>
        <div style={kpi}><div style={kpiLabel}>Detratores</div><div style={{ ...kpiValue, color: '#e05c5c' }}>{dados?.detratores || 0}</div></div>
        <div style={kpi}><div style={kpiLabel}>Nota média</div><div style={kpiValue}>{dados?.media ?? '—'}</div></div>
      </div>
    </div>
    <form onSubmit={salvar} style={{ ...card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>Pedir avaliação após (minutos)
        <input type="number" min="0" max="2880" style={{ ...input, width: 120 }} value={atraso} onChange={(e) => setAtraso(e.target.value)} />
      </label>
      <button type="submit" style={btnPrimary}>Salvar intervalo</button>
      <span style={{ color: 'var(--muted)', fontSize: 12 }}>O link do convite abre exclusivamente o formulário da Dino; sem integração de avaliações externas.</span>
    </form>
    <div style={card}>
      <strong>Convites pelo WhatsApp</strong>
      <p style={sub}>Fila acumulada da empresa/unidade ativa, independente do filtro de período acima. “Aceito pelo provedor” não comprova entrega ou leitura pelo cliente.</p>
      {dados?.notificacoesPesquisa?.canaisAtivos === 0 && <p role="alert" style={{ color: '#c73535', fontWeight: 700, margin: '10px 0' }}>Nenhum canal WhatsApp ativo para esta empresa/unidade. O convite automático não pode ser programado até configurar e validar o canal.</p>}
      {dados?.notificacoesPesquisa ? <div style={{ ...grid(150), marginTop: 12 }}>
        <div style={kpi}><div style={kpiLabel}>Pendentes</div><div style={kpiValue}>{dados.notificacoesPesquisa.pendentes}</div></div>
        <div style={kpi}><div style={kpiLabel}>Aceitos pelo provedor</div><div style={kpiValue}>{dados.notificacoesPesquisa.aceitas_provedor}</div></div>
        <div style={kpi}><div style={kpiLabel}>Falhas / verificar</div><div style={{ ...kpiValue, color: '#e05c5c' }}>{dados.notificacoesPesquisa.falhas}</div></div>
        <div style={kpi}><div style={kpiLabel}>Cancelados</div><div style={kpiValue}>{dados.notificacoesPesquisa.canceladas}</div></div>
      </div> : <div style={empty}>Fila WhatsApp indisponível para consulta. Não assuma que convites foram enviados.</div>}
    </div>
    <div style={card}>
      <strong>Distribuição das notas</strong>
      <p style={sub}>Contagem por nota, de 0 a 10, somente nos atendimentos do período e da unidade selecionados.</p>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {(dados?.distribuicao || []).map((faixa) => <div key={faixa.nota} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) 42px', alignItems: 'center', gap: 10, fontSize: 12 }}>
          <span>{faixa.nota}</span><div aria-hidden="true" style={{ background: 'var(--line)', height: 12, borderRadius: 6, overflow: 'hidden' }}><div style={{ height: '100%', width: `${100 * faixa.respostas / maiorFaixa}%`, borderRadius: 6, background: faixa.nota >= 9 ? '#14b87a' : faixa.nota >= 7 ? '#f59e0b' : '#e05c5c' }} /></div><strong aria-label={`${faixa.respostas} avaliações com nota ${faixa.nota}`}>{faixa.respostas}</strong>
        </div>)}
      </div>
    </div>
    <div style={card}>
      <strong>Evolução mensal</strong>
      <p style={sub}>Últimos 12 meses com respostas no período; meses sem respostas não recebem NPS artificial.</p>
      {(dados?.evolucaoMensal || []).length === 0 ? <div style={empty}>Ainda não há respostas no período selecionado.</div> : <div style={{ overflowX: 'auto' }}><table style={table}>
        <thead><tr><th style={th}>Mês do atendimento</th><th style={th}>Respostas</th><th style={th}>NPS</th><th style={th}>Média</th></tr></thead>
        <tbody>{dados.evolucaoMensal.map((item) => <tr key={item.mes}><td style={td}>{item.mes.slice(5)}/{item.mes.slice(0, 4)}</td><td style={td}>{item.respostas}</td><td style={td}>{item.nps ?? '—'}</td><td style={td}>{item.media ?? '—'}</td></tr>)}</tbody>
      </table></div>}
    </div>
    <div style={card}>
      <strong>Por barbeiro</strong>
      {(dados?.porProfissional || []).length === 0 ? <div style={empty}>Ainda sem avaliações.</div> : <table style={{ ...table, marginTop: 10 }}>
        <thead><tr><th style={th}>Profissional</th><th style={th}>NPS</th><th style={th}>Respostas</th><th style={th}>Média</th></tr></thead>
        <tbody>{dados.porProfissional.map((item) => <tr key={item.profissionalId || item.nome}><td style={td}><strong>{item.nome}</strong></td><td style={td}>{item.nps ?? '—'}</td><td style={td}>{item.respostas}</td><td style={td}>{item.media ?? '—'}</td></tr>)}</tbody>
      </table>}
    </div>
    <div style={card}>
      <strong>Comentários recentes</strong>
      {(dados?.comentarios || []).length === 0 ? <div style={empty}>Nenhum comentário ainda.</div> : <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
        {dados.comentarios.map((item, indice) => {
          const [rotulo, tom] = CATEGORIA_NPS[item.categoria] || ['—', 'neutro']
          return <div key={indice} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' }}>
              <strong style={{ color: 'var(--fg)', fontSize: 14 }}>{item.nota}</strong><Pill tom={tom}>{rotulo}</Pill>
              <span>{item.servico || 'Atendimento'}{item.profissional ? ` com ${item.profissional}` : ''} · {dataBR(item.dataAtendimento)}</span>
            </div>
            <div style={{ marginTop: 6, fontSize: 13 }}>{item.comentario}</div>
          </div>
        })}
      </div>}
    </div>
  </div>
}

// ── Onda 3: cobranças, cashback, origem dos clientes e receita da IA ───────

const STATUS_COBRANCA = { pendente: ['Aguardando', 'alerta'], paga: ['Paga', 'bom'], expirada: ['Expirada', 'neutro'], cancelada: ['Cancelada', 'neutro'] }
const label = { display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }
const checkLabel = { display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-start', fontSize: 13, fontWeight: 700, color: 'var(--fg)', paddingBottom: 8, whiteSpace: 'nowrap' }
const checkBox = { width: 18, height: 18, flex: '0 0 auto', margin: 0 }

export function CobrancasPanel() {
  const { toast } = useToast()
  const { dados, erro, carregando, carregar } = useCarregar('/api/admin/barbearia/cobrancas')
  const [config, setConfig] = useState(null)
  const [ocupado, setOcupado] = useState('')
  useEffect(() => { if (dados?.configuracao) setConfig(JSON.parse(JSON.stringify(dados.configuracao))) }, [dados])
  const mudar = (grupo, campo, valor) => setConfig((atual) => ({ ...atual, [grupo]: { ...atual[grupo], [campo]: valor } }))
  async function salvar(event) {
    event.preventDefault()
    setOcupado('config')
    try {
      await api.put('/api/admin/barbearia/cobrancas/configuracao', {
        sinal: { ...config.sinal, valor: Number(config.sinal.valor), prazoMinutos: Number(config.sinal.prazoMinutos) },
        cobrancaClube: { ...config.cobrancaClube, diasAntes: Number(config.cobrancaClube.diasAntes), tentativas: Number(config.cobrancaClube.tentativas ?? 3), intervaloDias: Number(config.cobrancaClube.intervaloDias ?? 2), bloquearAposDias: Number(config.cobrancaClube.bloquearAposDias ?? 5), bloquearAutomatico: config.cobrancaClube.bloquearAutomatico !== false },
        pix: config.pix,
        cashback: { percentual: Number(config.cashback.percentual), validadeDias: Number(config.cashback.validadeDias) },
        vale: { ativo: config.vale?.ativo === true },
      })
      toast('Cobranças configuradas.', 'success')
      carregar()
    } catch (e) { toast(e.message, 'error') } finally { setOcupado('') }
  }
  async function acao(cobranca, tipo) {
    if (tipo === 'confirmar' && !window.confirm(`Confirmar que o Pix de ${fmtR(cobranca.valor)} de ${cobranca.clienteNome || 'cliente'} caiu na conta?`)) return
    setOcupado(cobranca.id)
    try {
      await api.post(`/api/admin/barbearia/cobrancas/${encodeURIComponent(cobranca.id)}/${tipo}`, tipo === 'confirmar' ? { confirmado: true } : {})
      toast(tipo === 'confirmar' ? 'Pagamento confirmado.' : 'Cobrança cancelada.', 'success')
      carregar()
    } catch (e) { toast(e.message, 'error') } finally { setOcupado('') }
  }
  async function gerarClube() {
    setOcupado('clube')
    try {
      const r = await api.post('/api/admin/barbearia/cobrancas/clube/gerar', {})
      toast(`${r.criadas} cobrança(s) do clube gerada(s); ${r.avisosEnfileirados} aviso(s) pelo WhatsApp.`, 'success')
      carregar()
    } catch (e) { toast(e.message, 'error') } finally { setOcupado('') }
  }
  if (carregando || erro) return <div style={card}><Estado carregando={carregando} erro={erro} onRetry={carregar} /></div>
  const r = dados?.ultimos30Dias || {}
  const provedor = dados?.configuracao?.provedor
  return <div style={{ display: 'grid', gap: 16 }}>
    <div style={card}>
      <h2 style={h2}>Cobranças e cashback</h2>
      <p style={sub}>Sinal no agendamento online (o horário só fica garantido com o pagamento), cobrança da mensalidade do clube pelo WhatsApp e cashback para o próximo atendimento. Tudo começa desligado.</p>
      <div style={{ marginTop: 10 }}>{provedor === 'infinitepay' ? <Pill tom="bom">InfinitePay ativa: pagamento confirmado automaticamente</Pill> : provedor === 'pix_manual' ? <Pill tom="alerta">Pix da barbearia: a equipe confirma cada pagamento</Pill> : <Pill tom="critico">Sem meio de cobrança configurado</Pill>}</div>
      <div style={{ ...grid(160), marginTop: 14 }}>
        <div style={kpi}><div style={kpiLabel}>Sinais pagos (30d)</div><div style={kpiValue}>{fmtR(r.sinaisPagos || 0)}</div></div>
        <div style={kpi}><div style={kpiLabel}>Sinais expirados (30d)</div><div style={kpiValue}>{r.sinaisExpirados || 0}</div></div>
        <div style={kpi}><div style={kpiLabel}>Clube recebido (30d)</div><div style={{ ...kpiValue, color: '#14b87a' }}>{fmtR(r.clubeRecebido || 0)}</div></div>
        <div style={kpi}><div style={kpiLabel}>Clube a receber</div><div style={{ ...kpiValue, color: '#f59e0b' }}>{fmtR(r.clubePendente || 0)}</div></div>
        <div style={kpi}><div style={kpiLabel}>Cashback em aberto</div><div style={kpiValue}>{fmtR(dados?.cashbackEmAberto || 0)}</div></div>
      </div>
    </div>
    {config && <form onSubmit={salvar} style={{ ...card, display: 'grid', gap: 16 }}>
      <div>
        <strong>Pix da barbearia</strong>
        <p style={sub}>Usado quando a InfinitePay não está liberada para esta empresa no servidor. O cliente recebe o Pix copia e cola; a equipe confirma o recebimento aqui.</p>
        <div style={{ ...grid(200), marginTop: 8 }}>
          <label style={label}>Chave Pix<input style={input} value={config.pix.chave} onChange={(e) => mudar('pix', 'chave', e.target.value)} placeholder="CNPJ, e-mail, +55… ou chave aleatória" /></label>
          <label style={label}>Nome do recebedor<input style={input} maxLength={25} value={config.pix.nomeRecebedor} onChange={(e) => mudar('pix', 'nomeRecebedor', e.target.value)} /></label>
          <label style={label}>Cidade<input style={input} maxLength={15} value={config.pix.cidade} onChange={(e) => mudar('pix', 'cidade', e.target.value)} /></label>
        </div>
      </div>
      <div>
        <strong>Sinal no agendamento online</strong>
        <div style={{ ...grid(180), marginTop: 8, alignItems: 'end' }}>
          <label style={checkLabel}><input type="checkbox" style={checkBox} checked={config.sinal.ativo} onChange={(e) => mudar('sinal', 'ativo', e.target.checked)} />Cobrar sinal</label>
          <label style={label}>Tipo<select style={input} value={config.sinal.tipo} onChange={(e) => mudar('sinal', 'tipo', e.target.value)}><option value="percentual">% do serviço</option><option value="fixo">Valor fixo (R$)</option></select></label>
          <label style={label}>{config.sinal.tipo === 'fixo' ? 'Valor (R$)' : 'Percentual (%)'}<input type="number" min="0" step="0.01" style={input} value={config.sinal.valor} onChange={(e) => mudar('sinal', 'valor', e.target.value)} /></label>
          <label style={label}>Prazo para pagar (min)<input type="number" min="10" max="1440" style={input} value={config.sinal.prazoMinutos} onChange={(e) => mudar('sinal', 'prazoMinutos', e.target.value)} /></label>
        </div>
        <p style={sub}>Sem pagamento no prazo, o horário é liberado e a lista de espera é avisada.</p>
      </div>
      <div>
        <strong>Mensalidade do clube</strong>
        <div style={{ ...grid(180), marginTop: 8, alignItems: 'end' }}>
          <label style={checkLabel}><input type="checkbox" style={checkBox} checked={config.cobrancaClube.ativa} onChange={(e) => mudar('cobrancaClube', 'ativa', e.target.checked)} />Cobrar pelo WhatsApp</label>
          <label style={label}>Enviar quantos dias antes<input type="number" min="0" max="10" style={input} value={config.cobrancaClube.diasAntes} onChange={(e) => mudar('cobrancaClube', 'diasAntes', e.target.value)} /></label>
          <label style={label}>Tentativas de cobrança<input type="number" min="1" max="5" style={input} value={config.cobrancaClube.tentativas ?? 3} onChange={(e) => mudar('cobrancaClube', 'tentativas', e.target.value)} /></label>
          <label style={label}>Dias entre tentativas<input type="number" min="1" max="10" style={input} value={config.cobrancaClube.intervaloDias ?? 2} onChange={(e) => mudar('cobrancaClube', 'intervaloDias', e.target.value)} /></label>
          <label style={label}>Pausar o plano após (dias de atraso)<input type="number" min="1" max="30" style={input} value={config.cobrancaClube.bloquearAposDias ?? 5} onChange={(e) => mudar('cobrancaClube', 'bloquearAposDias', e.target.value)} /></label>
          <label style={checkLabel}><input type="checkbox" style={checkBox} checked={config.cobrancaClube.bloquearAutomatico !== false} onChange={(e) => mudar('cobrancaClube', 'bloquearAutomatico', e.target.checked)} />Pausar sozinho e reativar ao pagar</label>
        </div>
        <p style={sub}>Só para quem autorizou o WhatsApp. Pago pelo link, o ciclo é quitado sozinho; quem atrasar além da carência fica bloqueado no clube.</p>
      </div>
      <div>
        <strong>Vale-presente online</strong>
        <div style={{ marginTop: 8 }}><label style={checkLabel}><input type="checkbox" style={checkBox} checked={config.vale?.ativo === true} onChange={(e) => setConfig((atual) => ({ ...atual, vale: { ativo: e.target.checked } }))} />Vender vale-presente no app do cliente</label></div>
        <p style={sub}>O código só vale depois do pagamento confirmado; validade de 12 meses. A venda no balcão fica em Gestão → Vale-presente.</p>
      </div>
      <div>
        <strong>Cashback</strong>
        <div style={{ ...grid(180), marginTop: 8 }}>
          <label style={label}>Percentual do atendimento (0 = desligado)<input type="number" min="0" max="30" step="0.5" style={input} value={config.cashback.percentual} onChange={(e) => mudar('cashback', 'percentual', e.target.value)} /></label>
          <label style={label}>Validade (dias)<input type="number" min="7" max="365" style={input} value={config.cashback.validadeDias} onChange={(e) => mudar('cashback', 'validadeDias', e.target.value)} /></label>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="submit" style={btnPrimary} disabled={ocupado === 'config'}>{ocupado === 'config' ? 'Salvando…' : 'Salvar'}</button>
        <button type="button" style={btn} disabled={ocupado === 'clube' || !config.cobrancaClube.ativa} onClick={gerarClube}>Gerar cobranças do clube agora</button>
      </div>
    </form>}
    <div style={card}>
      <strong>Cobranças recentes</strong>
      {(dados?.cobrancas || []).length === 0 ? <div style={empty}>Nenhuma cobrança ainda.</div> : <div style={{ overflowX: 'auto' }}><table style={{ ...table, marginTop: 10 }}>
        <thead><tr><th style={th}>Cliente</th><th style={th}>Tipo</th><th style={th}>Valor</th><th style={th}>Situação</th><th style={th}>Criada</th><th style={th}></th></tr></thead>
        <tbody>{dados.cobrancas.map((item) => {
          const [rotulo, tom] = STATUS_COBRANCA[item.status] || [item.status, 'neutro']
          return <tr key={item.id}>
            <td style={td}><strong>{item.clienteNome || '—'}</strong><div style={{ color: 'var(--muted)', fontSize: 12 }}>{item.descricao}</div></td>
            <td style={td}>{item.tipo === 'sinal' ? 'Sinal' : item.tipo === 'vale' ? 'Vale-presente' : 'Clube'}</td>
            <td style={td}>{fmtR(item.valor)}</td>
            <td style={td}><Pill tom={tom}>{rotulo}</Pill>{item.pagoEm && <div style={{ color: 'var(--muted)', fontSize: 12 }}>{dataBR(item.pagoEm)} · {item.confirmadoPor}</div>}{item.revisar && <div style={{ color: '#e05c5c', fontSize: 12, fontWeight: 700 }}>{{ horario_liberado: 'Pago depois que o horário foi liberado: remarque ou devolva.', cobranca_cancelada: 'Pago depois de cancelada: confira e devolva se for o caso.', pagamento_em_dobro: 'O período já tinha sido pago no balcão: devolva um dos pagamentos.', efeito_nao_aplicado: `Pagamento registrado, mas não aplicado (${item.efeitoErro || 'erro'}): confira a assinatura.` }[item.revisar] || 'Revisar este pagamento.'}</div>}</td>
            <td style={td}>{dataBR(item.criadoEm)}</td>
            <td style={td}>{item.status === 'pendente' && <div style={{ display: 'flex', gap: 6 }}>
              {item.provedor === 'pix_manual' && <button type="button" style={btnPrimary} disabled={ocupado === item.id} onClick={() => acao(item, 'confirmar')}>Pix recebido</button>}
              <button type="button" style={btn} disabled={ocupado === item.id} onClick={() => acao(item, 'cancelar')}>Cancelar</button>
            </div>}</td>
          </tr>
        })}</tbody>
      </table></div>}
    </div>
  </div>
}

function inicioDoMes() {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-01`
}
function hojeIso(diasAFrente = 0) {
  const agora = new Date(Date.now() + diasAFrente * 86400000)
  return new Date(agora.valueOf() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function CanaisPanel() {
  // Inclui os próximos 30 dias: agendamento marcado hoje para a semana que vem já conta.
  const [periodo, setPeriodo] = useState({ inicio: inicioDoMes(), fim: hojeIso(30) })
  const { dados, erro, carregando, carregar } = useCarregar(`/api/admin/barbearia/captacao/canais?inicio=${periodo.inicio}&fim=${periodo.fim}`)
  const { toast } = useToast()
  const base = `${window.location.origin}/agendar/`
  const [slug, setSlug] = useState('')
  useEffect(() => { api.get('/api/admin/barbearia/configuracoes').then((r) => setSlug(r?.configuracao?.slugPublico || r?.slugPublico || '')).catch(() => {}) }, [])
  const links = slug ? [['Google (botão Agendar do perfil da empresa)', 'google'], ['Instagram (link da bio)', 'instagram'], ['WhatsApp (status e mensagens)', 'whatsapp'], ['QR code no balcão', 'qrcode']].map(([nome, canal]) => [nome, `${base}${slug}?canal=${canal}`]) : []
  return <div style={{ display: 'grid', gap: 16 }}>
    <div style={card}>
      <h2 style={h2}>Origem dos clientes</h2>
      <p style={sub}>De onde vêm os agendamentos e os clientes novos. Use um link por canal: cada um é contado separado.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'end' }}>
        <label style={label}>De<input type="date" style={input} value={periodo.inicio} onChange={(e) => setPeriodo((p) => ({ ...p, inicio: e.target.value }))} /></label>
        <label style={label}>Até<input type="date" style={input} value={periodo.fim} onChange={(e) => setPeriodo((p) => ({ ...p, fim: e.target.value }))} /></label>
      </div>
      {(carregando || erro) ? <Estado carregando={carregando} erro={erro} onRetry={carregar} /> : <>
        <div style={{ ...grid(160), marginTop: 14 }}>
          <div style={kpi}><div style={kpiLabel}>Agendamentos</div><div style={kpiValue}>{dados?.total || 0}</div></div>
          <div style={kpi}><div style={kpiLabel}>Clientes novos</div><div style={{ ...kpiValue, color: '#14b87a' }}>{dados?.clientesNovos || 0}</div></div>
        </div>
        {(dados?.canais || []).length === 0 ? <div style={empty}>Sem agendamentos no período.</div> : <table style={{ ...table, marginTop: 12 }}>
          <thead><tr><th style={th}>Canal</th><th style={th}>Agendamentos</th><th style={th}>Clientes novos</th><th style={th}>Concluídos</th><th style={th}>Cancelados</th><th style={th}>Valor atendido</th></tr></thead>
          <tbody>{dados.canais.map((item) => <tr key={item.canal}><td style={td}><strong>{item.canal}</strong></td><td style={td}>{item.agendamentos}</td><td style={td}>{item.clientesNovos}</td><td style={td}>{item.concluidos}</td><td style={td}>{item.cancelados}</td><td style={td}>{fmtR(item.receita)}</td></tr>)}</tbody>
        </table>}
      </>}
    </div>
    {links.length > 0 && <div style={card}>
      <strong>Links por canal</strong>
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>{links.map(([nome, url]) => <div key={url} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: 10, border: '1px dashed var(--line)', borderRadius: 10 }}>
        <span style={{ minWidth: 260, fontSize: 13 }}>{nome}</span>
        <code style={{ fontSize: 12, wordBreak: 'break-all', flex: 1 }}>{url}</code>
        <button type="button" style={btn} onClick={() => { navigator.clipboard?.writeText(url); toast('Link copiado.', 'success') }}>Copiar</button>
      </div>)}</div>
    </div>}
  </div>
}

export function ReceitaIaPanel() {
  const [periodo, setPeriodo] = useState({ inicio: inicioDoMes(), fim: hojeIso() })
  const { dados, erro, carregando, carregar } = useCarregar(`/api/admin/barbearia/captacao/receita-ia?inicio=${periodo.inicio}&fim=${periodo.fim}`)
  return <div style={card}>
    <h2 style={h2}>Receita da IA e da captação</h2>
    <p style={sub}>Atendimentos concluídos que nasceram da atendente IA no WhatsApp, de uma vaga aproveitada pela lista de espera ou de uma indicação.</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'end' }}>
      <label style={label}>De<input type="date" style={input} value={periodo.inicio} onChange={(e) => setPeriodo((p) => ({ ...p, inicio: e.target.value }))} /></label>
      <label style={label}>Até<input type="date" style={input} value={periodo.fim} onChange={(e) => setPeriodo((p) => ({ ...p, fim: e.target.value }))} /></label>
    </div>
    {(carregando || erro) ? <Estado carregando={carregando} erro={erro} onRetry={carregar} /> : <>
      <div style={{ ...grid(180), marginTop: 14 }}><div style={kpi}><div style={kpiLabel}>Receita atribuída</div><div style={{ ...kpiValue, color: '#14b87a' }}>{fmtR(dados?.receitaTotal || 0)}</div></div></div>
      <table style={{ ...table, marginTop: 12 }}>
        <thead><tr><th style={th}>Fonte</th><th style={th}>Agendamentos</th><th style={th}>Concluídos</th><th style={th}>Receita</th></tr></thead>
        <tbody>{(dados?.fontes || []).map((item) => <tr key={item.fonte}><td style={td}><strong>{item.fonte}</strong></td><td style={td}>{item.agendamentos}</td><td style={td}>{item.concluidos}</td><td style={td}>{fmtR(item.receita)}</td></tr>)}</tbody>
      </table>
    </>}
  </div>
}


// ── Onda 4: vale-presente e comparativo por unidade ───────────────────────

const STATUS_VALE = { ativo: ['Ativo', 'bom'], aguardando_pagamento: ['Aguardando pagamento', 'alerta'], usado: ['Usado', 'neutro'], cancelado: ['Cancelado', 'neutro'], vencido: ['Vencido', 'critico'] }

export function ValesPanel() {
  const { toast } = useToast()
  const { dados, erro, carregando, carregar } = useCarregar('/api/admin/barbearia/vales')
  const [form, setForm] = useState({ valor: '100', paraNome: '', deNome: '', deTelefone: '', meioPagamento: 'pix' })
  const [emitido, setEmitido] = useState(null)
  const [consulta, setConsulta] = useState({ codigo: '', resultado: null })
  async function emitir(event) {
    event.preventDefault()
    if (!window.confirm(`Confirmar que recebeu ${fmtR(Number(form.valor))} pelo vale?`)) return
    try {
      const r = await api.post('/api/admin/barbearia/vales', { ...form, valor: Number(form.valor), confirmado: true })
      setEmitido(r.vale); toast('Vale emitido e receita lançada.', 'success'); carregar()
    } catch (e) { toast(e.message, 'error') }
  }
  async function consultar(event) {
    event.preventDefault()
    try { const r = await api.post('/api/admin/barbearia/vales/consulta', { codigo: consulta.codigo }); setConsulta((c) => ({ ...c, resultado: r.vale })) } catch (e) { toast(e.message, 'error'); setConsulta((c) => ({ ...c, resultado: null })) }
  }
  async function cancelar(vale) {
    let corpo = {}
    if (vale.status === 'ativo') {
      // Vale pago: o cancelamento lança o estorno no financeiro.
      const motivo = window.prompt('Vale pago. Motivo do cancelamento (o estorno será lançado no financeiro):')
      if (!motivo) return
      const meioEstorno = window.prompt('Como o valor foi devolvido? (pix, dinheiro, debito, credito)', 'pix')
      if (!meioEstorno) return
      corpo = { motivo, meioEstorno }
    } else if (!window.confirm('Cancelar este vale aguardando pagamento?')) return
    try { await api.post(`/api/admin/barbearia/vales/${encodeURIComponent(vale.id)}/cancelar`, corpo); toast(vale.status === 'ativo' ? 'Vale cancelado e estorno lançado.' : 'Vale cancelado.', 'success'); carregar() } catch (e) { toast(e.message, 'error') }
  }
  if (carregando || erro) return <div style={card}><Estado carregando={carregando} erro={erro} onRetry={carregar} /></div>
  const lista = dados?.vales || []
  const emAberto = lista.filter((v) => v.status === 'ativo').reduce((soma, v) => soma + v.saldo, 0)
  return <div style={{ display: 'grid', gap: 16 }}>
    <div style={card}>
      <h2 style={h2}>Vale-presente</h2>
      <p style={sub}>Venda no balcão ou online (pelo app do cliente). O cliente usa o código na hora de pagar o atendimento; o desconto é conferido no servidor.</p>
      <div style={{ ...grid(160), marginTop: 14 }}>
        <div style={kpi}><div style={kpiLabel}>Vales ativos</div><div style={kpiValue}>{lista.filter((v) => v.status === 'ativo').length}</div></div>
        <div style={kpi}><div style={kpiLabel}>Saldo em aberto</div><div style={kpiValue}>{fmtR(emAberto)}</div></div>
      </div>
    </div>
    <form onSubmit={emitir} style={{ ...card, display: 'grid', gap: 12 }}>
      <strong>Vender no balcão</strong>
      <div style={grid(180)}>
        <label style={label}>Valor (R$)<input type="number" min="20" max="2000" style={input} value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} /></label>
        <label style={label}>Para quem<input style={input} value={form.paraNome} onChange={(e) => setForm((f) => ({ ...f, paraNome: e.target.value }))} /></label>
        <label style={label}>Comprador<input style={input} value={form.deNome} onChange={(e) => setForm((f) => ({ ...f, deNome: e.target.value }))} /></label>
        <label style={label}>Meio de pagamento<select style={input} value={form.meioPagamento} onChange={(e) => setForm((f) => ({ ...f, meioPagamento: e.target.value }))}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="debito">Débito</option><option value="credito">Crédito</option></select></label>
      </div>
      <div><button type="submit" style={btnPrimary}>Emitir vale</button></div>
      {emitido && <div style={{ padding: 12, border: '1px dashed var(--line)', borderRadius: 10 }}>Código do vale: <strong style={{ fontSize: 18, letterSpacing: 1 }}>{emitido.codigo}</strong> · {fmtR(emitido.valor)} · válido até {dataBR(emitido.validoAte)}</div>}
    </form>
    <form onSubmit={consultar} style={{ ...card, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <label style={label}>Consultar código<input style={input} value={consulta.codigo} onChange={(e) => setConsulta({ codigo: e.target.value.toUpperCase(), resultado: null })} placeholder="ABCDE-FGHJK" /></label>
      <button type="submit" style={btn}>Consultar</button>
      {consulta.resultado && <span style={{ fontSize: 13 }}><Pill tom={(STATUS_VALE[consulta.resultado.status] || [])[1] || 'neutro'}>{(STATUS_VALE[consulta.resultado.status] || [consulta.resultado.status])[0]}</Pill> saldo {fmtR(consulta.resultado.saldo)}{consulta.resultado.validoAte ? ` · até ${dataBR(consulta.resultado.validoAte)}` : ''}</span>}
    </form>
    <div style={card}>
      <strong>Vales emitidos</strong>
      {lista.length === 0 ? <div style={empty}>Nenhum vale ainda.</div> : <table style={{ ...table, marginTop: 10 }}>
        <thead><tr><th style={th}>Final</th><th style={th}>Para</th><th style={th}>Valor</th><th style={th}>Saldo</th><th style={th}>Situação</th><th style={th}>Origem</th><th style={th}></th></tr></thead>
        <tbody>{lista.map((v) => { const [rot, tom] = STATUS_VALE[v.status] || [v.status, 'neutro']; return <tr key={v.id}>
          <td style={td}>…{v.codigoFinal}</td><td style={td}>{v.paraNome || '—'}<div style={{ color: 'var(--muted)', fontSize: 12 }}>{v.deNome}</div></td><td style={td}>{fmtR(v.valor)}</td><td style={td}>{fmtR(v.saldo)}</td><td style={td}><Pill tom={tom}>{rot}</Pill></td><td style={td}>{v.origem === 'online' ? 'Online' : 'Balcão'}</td>
          <td style={td}>{['ativo', 'aguardando_pagamento'].includes(v.status) && v.saldo === v.valor && <button type="button" style={btn} onClick={() => cancelar(v)}>Cancelar</button>}</td>
        </tr> })}</tbody>
      </table>}
    </div>
  </div>
}

export function UnidadesPanel({ lojas = [] }) {
  // Padrão: últimos 30 dias até hoje.
  const [periodo, setPeriodo] = useState({ inicio: hojeIso(-30), fim: hojeIso() })
  const { dados, erro, carregando, carregar } = useCarregar(`/api/admin/barbearia/unidades/comparativo?inicio=${periodo.inicio}&fim=${periodo.fim}`)
  const nomeDa = (id) => lojas.find((l) => String(l.id) === String(id))?.nome || (id ? `Unidade ${String(id).slice(0, 8)}` : 'Sem unidade')
  return <div style={card}>
    <h2 style={h2}>Comparativo por unidade</h2>
    <p style={sub}>A mesma régua para todas as unidades: volume, conclusão, faltas, valor atendido, ticket médio, ocupação da agenda e NPS.</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'end' }}>
      <label style={label}>De<input type="date" style={input} value={periodo.inicio} onChange={(e) => setPeriodo((p) => ({ ...p, inicio: e.target.value }))} /></label>
      <label style={label}>Até<input type="date" style={input} value={periodo.fim} onChange={(e) => setPeriodo((p) => ({ ...p, fim: e.target.value }))} /></label>
    </div>
    {(carregando || erro) ? <Estado carregando={carregando} erro={erro} onRetry={carregar} /> : (dados?.unidades || []).length === 0 ? <div style={empty}>Sem atendimentos no período.</div> : <div style={{ overflowX: 'auto' }}><table style={{ ...table, marginTop: 12 }}>
      <thead><tr><th style={th}>Unidade</th><th style={th}>Agendamentos</th><th style={th}>Concluídos</th><th style={th}>Faltas</th><th style={th}>Clientes</th><th style={th}>Valor atendido</th><th style={th}>Ticket médio</th><th style={th}>Ocupação</th><th style={th}>NPS</th></tr></thead>
      <tbody>{dados.unidades.map((u) => <tr key={u.lojaId || 'sem'}><td style={td}><strong>{nomeDa(u.lojaId)}</strong></td><td style={td}>{u.agendamentos}</td><td style={td}>{pct(u.taxaConclusao)}</td><td style={td}>{pct(u.taxaFalta)}</td><td style={td}>{u.clientesUnicos}</td><td style={td}>{fmtR(u.valorAtendido)}</td><td style={td}>{fmtR(u.ticketMedio)}</td><td style={td}>{u.ocupacao == null ? '—' : pct(u.ocupacao)}</td><td style={td}>{u.nps ?? '—'}{u.respostasNps ? <span style={{ color: 'var(--muted)', fontSize: 11 }}> ({u.respostasNps})</span> : null}</td></tr>)}</tbody>
    </table></div>}
  </div>
}


// ── Resumo diário no WhatsApp do dono ─────────────────────────────────────
// Prévia exata do fechamento que vai para o WhatsApp (mesma rota do envio
// automático) e envio manual com confirmação. Números vêm da agenda e do atendente.

function BolhaWhatsApp({ texto }) {
  // Formatação nativa do WhatsApp: *negrito*. Renderiza só isso, sem HTML do servidor.
  const linhas = String(texto || '').split('\n')
  return <div style={{ background: 'color-mix(in srgb, #25d366 14%, var(--card))', border: '1px solid color-mix(in srgb, #25d366 35%, var(--line))', borderRadius: '14px 14px 14px 4px', padding: '12px 14px', fontSize: 14, lineHeight: 1.5, maxWidth: 460, whiteSpace: 'pre-wrap' }}>
    {linhas.map((linha, i) => <div key={i} style={{ minHeight: linha ? undefined : 8 }}>{linha.split(/(\*[^*]+\*)/g).map((parte, j) => parte.startsWith('*') && parte.endsWith('*') && parte.length > 2 ? <strong key={j}>{parte.slice(1, -1)}</strong> : <span key={j}>{parte}</span>)}</div>)}
  </div>
}

export function ResumoDiarioPanel() {
  const { toast } = useToast()
  const [dia, setDia] = useState(hojeIso())
  const [enviando, setEnviando] = useState(false)
  const { dados, erro, carregando, carregar } = useCarregar(`/api/admin/barbearia/resumo-diario?dia=${dia}`)
  const cfg = dados?.configuracao
  const agenda = dados?.agenda
  const atendente = dados?.atendente
  const ehHoje = dia === hojeIso()

  async function enviarAgora() {
    if (!window.confirm(`Enviar agora o resumo de hoje para ${cfg?.destinatarios?.join(', ') || 'os destinatários configurados'}?`)) return
    setEnviando(true)
    try {
      const r = await api.post('/api/admin/barbearia/resumo-diario/enviar', { confirmar: true })
      toast(`Resumo enviado para ${r.enviados} destinatário(s).${r.falhas?.length ? ` Falhou: ${r.falhas.join(', ')}.` : ''}`, r.falhas?.length ? 'warning' : 'success')
    } catch (e) {
      toast(e.message || 'Não foi possível enviar.', 'error')
    } finally {
      setEnviando(false)
    }
  }

  return <div style={card}>
    <h2 style={h2}>Resumo diário no WhatsApp</h2>
    <p style={sub}>O fechamento do dia que chega no WhatsApp do dono: atendimentos, valor atendido, o que a IA fechou sozinha, conversas esperando a equipe e a agenda de amanhã.</p>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12, alignItems: 'end' }}>
      <label style={label}>Dia<input type="date" style={input} value={dia} max={hojeIso()} onChange={(e) => setDia(e.target.value || hojeIso())} /></label>
      <button type="button" style={btn} onClick={carregar}>Atualizar</button>
      <button type="button" style={{ ...btnPrimary, ...((enviando || !ehHoje || !cfg?.destinatarios?.length) ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }} disabled={enviando || !ehHoje || !cfg?.destinatarios?.length} onClick={enviarAgora} title={!cfg?.destinatarios?.length ? 'Configure DINO_RESUMO_TELEFONES no servidor' : !ehHoje ? 'O envio manual manda o resumo de hoje' : ''}>{enviando ? 'Enviando…' : 'Enviar agora'}</button>
    </div>
    {cfg && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center', fontSize: 13, color: 'var(--muted)' }}>
      <Pill tom={cfg.ativo ? 'bom' : 'neutro'}>{cfg.ativo ? `Automático às ${cfg.hora}` : 'Envio automático desligado'}</Pill>
      <span>{cfg.destinatarios?.length ? `Para ${cfg.destinatarios.join(', ')}` : 'Nenhum destinatário configurado (DINO_RESUMO_TELEFONES)'}</span>
    </div>}
    {(carregando || erro) ? <Estado carregando={carregando} erro={erro} onRetry={carregar} /> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={grid(140)}>
          <div style={kpi}><div style={kpiLabel}>Concluídos</div><div style={kpiValue}>{agenda?.concluidos ?? 0}<span style={{ fontSize: 14, color: 'var(--muted)' }}> / {agenda?.atendimentos ?? 0}</span></div></div>
          <div style={kpi}><div style={kpiLabel}>Valor atendido</div><div style={{ ...kpiValue, color: '#14b87a' }}>{fmtR(agenda?.faturamento || 0)}</div></div>
          <div style={kpi}><div style={kpiLabel}>Marcados pela IA</div><div style={kpiValue}>{agenda?.ia?.agendamentos ?? 0}</div></div>
          <div style={kpi}><div style={kpiLabel}>Com a equipe agora</div><div style={{ ...kpiValue, color: atendente?.filaEquipe ? '#f59e0b' : undefined }}>{atendente ? atendente.filaEquipe : '—'}</div></div>
        </div>
        <p style={sub}>{atendente ? `${atendente.conversas} conversa(s) no WhatsApp neste dia.` : 'Dados do atendente indisponíveis agora; o resumo sai só com a agenda.'} Amanhã: {agenda?.amanha?.agendamentos ? `${agenda.amanha.agendamentos} horário(s), o primeiro às ${agenda.amanha.primeiro}` : 'agenda livre'}.</p>
      </div>
      <div><div style={{ ...kpiLabel, marginBottom: 8 }}>Prévia da mensagem</div><BolhaWhatsApp texto={dados?.texto} /></div>
    </div>}
  </div>
}

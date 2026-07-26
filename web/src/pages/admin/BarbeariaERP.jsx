/**
 * Barbearia & Salão ERP — SetPoint Ultra
 * Agendamentos, Profissionais, Rateio automático, Assinaturas/Pacotes, Extrato de repasse
 */
import { useState, useEffect, useCallback } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const TABS = ['Agenda', 'Profissionais', 'Rateio', 'Assinaturas', 'Serviços']
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const STATUS_AGEND = {
  agendado: { label: 'Agendado', color: '#4a9eff' },
  confirmado: { label: 'Confirmado', color: '#8b5cf6' },
  em_atendimento: { label: 'Em Atendimento', color: '#f59e0b' },
  concluido: { label: 'Concluído', color: '#5FB335' },
  cancelado: { label: 'Cancelado', color: '#e05c5c' },
  nao_compareceu: { label: 'Não Compareceu', color: '#888' }
}

export default function BarbeariaERP() {
  const { toast } = useToast()
  const [tab, setTab] = useState('Agenda')
  const [agendamentos, setAgendamentos] = useState([])
  const [profissionais, setProfissionais] = useState([])
  const [rateios, setRateios] = useState([])
  const [assinaturas, setAssinaturas] = useState([])
  const [servicos, setServicos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [profSelecionado, setProfSelecionado] = useState(null)

  // Form profissional
  const [formProf, setFormProf] = useState({
    nome: '', telefone: '', especialidade: '', percentual_comissao: 50,
    taxa_maquininha_debito: 1.5, taxa_maquininha_credito: 2.8,
    horario_inicio: '08:00', horario_fim: '18:00',
    dias_trabalho: [1, 2, 3, 4, 5, 6] // seg a sab
  })

  // Form assinatura
  const [formAssinatura, setFormAssinatura] = useState({
    cliente_nome: '', cliente_telefone: '', plano_nome: '',
    valor_mensal: '', dia_cobranca: 1, servicos_inclusos: []
  })

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [agendData, profData, rateioData, assData, servData] = await Promise.all([
        api.get('/api/v1/barbearia/agendamentos').catch(() => ({ agendamentos: [] })),
        api.get('/api/v1/barbearia/profissionais').catch(() => ({ profissionais: [] })),
        api.get('/api/v1/barbearia/rateios').catch(() => ({ rateios: [] })),
        api.get('/api/v1/barbearia/assinaturas').catch(() => ({ assinaturas: [] })),
        api.get('/api/v1/barbearia/servicos').catch(() => ({ servicos: [] }))
      ])
      setAgendamentos(agendData.agendamentos || [])
      setProfissionais(profData.profissionais || [])
      setRateios(rateioData.rateios || [])
      setAssinaturas(assData.assinaturas || [])
      setServicos(servData.servicos || [])
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function salvarProfissional() {
    try {
      await api.post('/api/v1/barbearia/profissionais', formProf)
      toast('Profissional cadastrado!', 'success')
      setModal(null)
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function salvarAssinatura() {
    try {
      await api.post('/api/v1/barbearia/assinaturas', formAssinatura)
      toast('Assinatura criada! Cobranças mensais ativadas.', 'success')
      setModal(null)
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function calcularRateio(profId, periodo) {
    try {
      const data = await api.post(`/api/v1/barbearia/profissionais/${profId}/calcular-rateio`, { periodo })
      toast(`Rateio calculado: ${fmtR(data.valor_profissional)} para o profissional`, 'success')
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  function toggleDia(dia) {
    setFormProf(p => ({
      ...p,
      dias_trabalho: p.dias_trabalho.includes(dia)
        ? p.dias_trabalho.filter(d => d !== dia)
        : [...p.dias_trabalho, dia].sort()
    }))
  }

  // KPIs rápidos
  const totalFaturado = rateios.reduce((s, r) => s + (r.valor_total || 0), 0)
  const totalProfissionais = rateios.reduce((s, r) => s + (r.valor_profissional || 0), 0)
  const totalSalao = rateios.reduce((s, r) => s + (r.valor_salao || 0), 0)

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>✂️ Barbearia & Salão</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            {profissionais.length} profissionais · {agendamentos.length} agendamentos · {assinaturas.filter(a => a.status === 'ativa').length} assinaturas ativas
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {tab === 'Profissionais' && <button className="btn-primary" onClick={() => setModal('novo-prof')}>+ Novo Profissional</button>}
          {tab === 'Assinaturas' && <button className="btn-primary" onClick={() => setModal('nova-assinatura')}>+ Nova Assinatura</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--card)', borderRadius: 10, padding: 4, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? '#fff' : 'var(--muted)', cursor: 'pointer', fontWeight: tab === t ? 600 : 400 }}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Carregando...</div> : (
        <>
          {/* Agenda */}
          {tab === 'Agenda' && (
            <div>
              <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--card2)', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Horário</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Cliente</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Profissional</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Serviço</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Valor</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agendamentos.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                        Nenhum agendamento hoje. Link público de agendamento disponível em <strong>/agendar/{'{slug}'}</strong>
                      </td></tr>
                    ) : agendamentos.map(a => {
                      const st = STATUS_AGEND[a.status] || { label: a.status, color: '#888' }
                      return (
                        <tr key={a.id} style={{ borderTop: '1px solid var(--line)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, fontFamily: 'monospace' }}>
                            {a.horario_inicio} – {a.horario_fim}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{a.cliente_nome}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{a.cliente_telefone}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>{a.profissional_nome}</td>
                          <td style={{ padding: '12px 16px' }}>{a.servico_nome}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{fmtR(a.valor || 0)}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ background: st.color + '22', color: st.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{st.label}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Profissionais */}
          {tab === 'Profissionais' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {profissionais.length === 0 ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Nenhum profissional cadastrado</div>
              ) : profissionais.map(p => (
                <div key={p.id} style={{ background: 'var(--card)', borderRadius: 12, padding: 20, border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent)22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
                      {p.nome?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{p.nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.especialidade || 'Barbeiro'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Comissão</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#5FB335' }}>{p.percentual_comissao}%</div>
                    </div>
                    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Salão</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#4a9eff' }}>{100 - p.percentual_comissao}%</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
                    Taxa débito: {p.taxa_maquininha_debito}% · Crédito: {p.taxa_maquininha_credito}%
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                    {DIAS_SEMANA.map((d, i) => (
                      <span key={i} style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: (p.dias_trabalho || []).includes(i) ? 'var(--accent)' : 'var(--bg)', color: (p.dias_trabalho || []).includes(i) ? '#fff' : 'var(--muted)' }}>
                        {d[0]}
                      </span>
                    ))}
                  </div>
                  <button onClick={() => { setProfSelecionado(p); setModal('calcular-rateio') }}
                    style={{ marginTop: 14, width: '100%', padding: '8px', borderRadius: 8, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                    💰 Calcular Rateio
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Rateio */}
          {tab === 'Rateio' && (
            <div>
              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
                {[
                  { label: 'Total Faturado', value: fmtR(totalFaturado), color: '#4a9eff', icon: '💰' },
                  { label: 'Repasse Profissionais', value: fmtR(totalProfissionais), color: '#8b5cf6', icon: '✂️' },
                  { label: 'Receita do Salão', value: fmtR(totalSalao), color: '#5FB335', icon: '🏠' },
                ].map(k => (
                  <div key={k.label} style={{ background: 'var(--card)', borderRadius: 12, padding: 20, border: '1px solid var(--line)', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{k.icon}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{k.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--card2)', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Profissional</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Período</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Bruto</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Taxa Máq.</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Comissão %</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Repasse Prof.</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Salão</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rateios.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                        Nenhum rateio calculado. Acesse a aba "Profissionais" e clique em "Calcular Rateio".
                      </td></tr>
                    ) : rateios.map(r => (
                      <tr key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.profissional_nome}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>{r.periodo}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{fmtR(r.valor_total || 0)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#e05c5c' }}>-{fmtR(r.taxa_maquininha || 0)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{r.percentual_comissao}%</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#8b5cf6' }}>{fmtR(r.valor_profissional || 0)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#5FB335' }}>{fmtR(r.valor_salao || 0)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: r.pago ? '#5FB33522' : '#f59e0b22', color: r.pago ? '#5FB335' : '#f59e0b', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                            {r.pago ? 'Pago' : 'Pendente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Assinaturas */}
          {tab === 'Assinaturas' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {assinaturas.length === 0 ? (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                    Nenhuma assinatura ativa. Crie planos mensais para fidelizar clientes.
                  </div>
                ) : assinaturas.map(a => (
                  <div key={a.id} style={{ background: 'var(--card)', borderRadius: 12, padding: 20, border: `1px solid ${a.status === 'ativa' ? 'var(--accent)' : 'var(--line)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{a.cliente_nome}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{a.plano_nome}</div>
                      </div>
                      <span style={{ background: a.status === 'ativa' ? '#5FB33522' : '#88888822', color: a.status === 'ativa' ? '#5FB335' : '#888', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                        {a.status === 'ativa' ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', marginBottom: 8 }}>
                      {fmtR(a.valor_mensal || 0)}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)' }}>/mês</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                      Vence dia {a.dia_cobranca} · Próx: {a.proxima_cobranca ? fmtDate(a.proxima_cobranca) : '-'}
                    </div>
                    {a.servicos_inclusos?.length > 0 && (
                      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {a.servicos_inclusos.map(s => (
                          <span key={s} style={{ background: 'var(--bg)', padding: '2px 8px', borderRadius: 20, fontSize: 11 }}>{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Serviços */}
          {tab === 'Serviços' && (
            <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--card2)', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Serviço</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Duração</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Preço</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Categoria</th>
                  </tr>
                </thead>
                <tbody>
                  {servicos.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhum serviço cadastrado</td></tr>
                  ) : servicos.map(s => (
                    <tr key={s.id} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{s.nome}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--muted)' }}>{s.duracao_minutos} min</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#5FB335' }}>{fmtR(s.preco || 0)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: 'var(--card2)', padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>{s.categoria || 'Geral'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal: Novo Profissional */}
      {modal === 'novo-prof' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 24px' }}>✂️ Novo Profissional</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Nome *', key: 'nome', full: true },
                { label: 'Telefone', key: 'telefone', placeholder: '(65) 99999-9999' },
                { label: 'Especialidade', key: 'especialidade', placeholder: 'Barbeiro, Cabeleireiro...' },
                { label: 'Comissão (%)', key: 'percentual_comissao', type: 'number', placeholder: '50' },
                { label: 'Taxa Débito (%)', key: 'taxa_maquininha_debito', type: 'number', placeholder: '1.5' },
                { label: 'Taxa Crédito (%)', key: 'taxa_maquininha_credito', type: 'number', placeholder: '2.8' },
                { label: 'Horário Início', key: 'horario_inicio', type: 'time' },
                { label: 'Horário Fim', key: 'horario_fim', type: 'time' },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? '1/-1' : undefined }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type || 'text'} placeholder={f.placeholder} value={formProf[f.key] || ''} onChange={e => setFormProf(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Dias de Trabalho</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {DIAS_SEMANA.map((d, i) => (
                    <button key={i} onClick={() => toggleDia(i)}
                      style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${formProf.dias_trabalho.includes(i) ? 'var(--accent)' : 'var(--line)'}`, background: formProf.dias_trabalho.includes(i) ? 'var(--accent)' : 'transparent', color: formProf.dias_trabalho.includes(i) ? '#fff' : 'var(--fg)', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                      {d[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview do rateio */}
            <div style={{ background: 'var(--card)', borderRadius: 10, padding: 16, marginTop: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Exemplo de rateio em uma venda de R$ 100,00 no débito:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Taxa máquina</div>
                  <div style={{ fontWeight: 700, color: '#e05c5c' }}>-{fmtR(parseFloat(formProf.taxa_maquininha_debito) || 0)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Profissional ({formProf.percentual_comissao}%)</div>
                  <div style={{ fontWeight: 700, color: '#8b5cf6' }}>{fmtR(((100 - (parseFloat(formProf.taxa_maquininha_debito) || 0)) * (parseFloat(formProf.percentual_comissao) || 0)) / 100)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Salão</div>
                  <div style={{ fontWeight: 700, color: '#5FB335' }}>{fmtR(((100 - (parseFloat(formProf.taxa_maquininha_debito) || 0)) * (100 - (parseFloat(formProf.percentual_comissao) || 0))) / 100)}</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarProfissional} className="btn-primary">Salvar Profissional</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nova Assinatura */}
      {modal === 'nova-assinatura' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 520 }}>
            <h2 style={{ margin: '0 0 24px' }}>📋 Nova Assinatura Mensal</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Nome do Cliente *', key: 'cliente_nome', full: true },
                { label: 'Telefone', key: 'cliente_telefone', placeholder: '(65) 99999-9999' },
                { label: 'Nome do Plano', key: 'plano_nome', placeholder: 'Plano Mensal Básico' },
                { label: 'Valor Mensal (R$) *', key: 'valor_mensal', type: 'number' },
                { label: 'Dia de Cobrança', key: 'dia_cobranca', type: 'number', placeholder: '1' },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? '1/-1' : undefined }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type || 'text'} placeholder={f.placeholder} value={formAssinatura[f.key] || ''} onChange={e => setFormAssinatura(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Serviços Inclusos (um por linha)</label>
                <textarea placeholder="Corte masculino&#10;Barba&#10;Hidratação" rows={4} onChange={e => setFormAssinatura(p => ({ ...p, servicos_inclusos: e.target.value.split('\n').filter(s => s.trim()) }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarAssinatura} className="btn-primary">Criar Assinatura</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Calcular Rateio */}
      {modal === 'calcular-rateio' && profSelecionado && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 420, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
            <h2 style={{ margin: '0 0 8px' }}>Calcular Rateio</h2>
            <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Profissional: <strong>{profSelecionado.nome}</strong></p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
              {['hoje', 'semana', 'mes_atual', 'mes_anterior'].map(p => (
                <button key={p} onClick={() => { calcularRateio(profSelecionado.id, p); setModal(null) }}
                  style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--accent)', background: 'var(--accent)22', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>
                  {p === 'hoje' ? 'Hoje' : p === 'semana' ? 'Esta Semana' : p === 'mes_atual' ? 'Mês Atual' : 'Mês Anterior'}
                </button>
              ))}
            </div>
            <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  )
}

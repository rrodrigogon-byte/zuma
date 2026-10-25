import { useCallback, useEffect, useState } from 'react'
import { api, fmtR } from '../../lib/api'
import { a2Path } from '../../lib/tenant-api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const EMPTY_FORM = {
  nome: '',
  tipo: 'pf',
  cpfCnpj: '',
  email: '',
  telefone: '',
  endereco: '',
  bairro: '',
  cidade: '',
  aniversario: '',
  estadoCivil: 'solteiro',
  conjugeNome: '',
  conjugeAniversario: '',
  bebida: '',
  corte: '',
  instagram: '',
  linkedin: '',
  limiteCreditoMensal: 0,
  diasVencimento: 30,
  observacao: ''
}

export default function Clientes() {
  const { toast } = useToast()
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [abaFiltro, setAbaFiltro] = useState('todos') // 'todos' | 'aniversariantes' | 'viralgram' | 'familia'
  const [modal, setModal] = useState(null) // null | 'novo' | cliente_id
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [mappingViralgram, setMappingViralgram] = useState(false)

  const handleMapearTodosViralgram = async () => {
    setMappingViralgram(true)
    try {
      const res = await api.post(a2Path('/clientes/viralgram/mapear-todos'))
      toast(`${res.mapeadosComRedes || 0} clientes mapeados com ViralGram 4.0!`)
      load()
    } catch (e) {
      toast('Erro ao mapear clientes no ViralGram', true)
    } finally {
      setMappingViralgram(false)
    }
  }

  const handleMapearIndividualViralgram = async (clienteId) => {
    try {
      const res = await api.post(a2Path(`/clientes/${clienteId}/mapear-viralgram`))
      toast('Cliente mapeado com ViralGram!')
      load()
      if (res.viralgramProfile) {
        setForm(prev => ({ ...prev, viralgramProfile: res.viralgramProfile }))
      }
    } catch (e) {
      toast('Erro ao analisar no ViralGram', true)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { clientes } = await api.get(a2Path('/clientes'))
      setClientes(clientes || [])
    } catch (e) {
      toast('Erro ao carregar clientes', true)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!form.nome) return toast('Nome do cliente é obrigatório', true)
    setSaving(true)
    try {
      if (modal === 'novo') {
        await api.post(a2Path('/clientes'), form)
        toast('Cliente cadastrado com sucesso')
      } else {
        await api.patch(a2Path(`/clientes/${modal}`), form)
        toast('Cliente atualizado com sucesso')
      }
      setModal(null)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao salvar cliente', true)
    } finally {
      setSaving(false)
    }
  }

  const openNovo = () => {
    setForm(EMPTY_FORM)
    setModal('novo')
  }

  const openEditar = (c) => {
    setForm({
      nome: c.nome || '',
      tipo: c.tipo || 'pf',
      cpfCnpj: c.cpfCnpj || '',
      email: c.email || '',
      telefone: c.telefone || '',
      endereco: c.endereco || '',
      bairro: c.bairro || '',
      cidade: c.cidade || '',
      aniversario: c.aniversario || c.dataNascimento || '',
      estadoCivil: c.estadoCivil || 'solteiro',
      conjugeNome: c.conjugeNome || (c.familia?.find(f => f.relacao === 'esposa' || f.relacao === 'conjuge')?.nome) || '',
      conjugeAniversario: c.conjugeAniversario || (c.familia?.find(f => f.relacao === 'esposa' || f.relacao === 'conjuge')?.aniversario) || '',
      bebida: c.preferencias?.bebida || c.bebida || '',
      corte: c.preferencias?.corte || c.corte || '',
      instagram: c.instagram || c.redesSociais?.instagram || '',
      linkedin: c.linkedin || c.redesSociais?.linkedin || '',
      viralgramProfile: c.viralgramProfile || null,
      limiteCreditoMensal: c.limiteCreditoMensal || 0,
      diasVencimento: c.diasVencimento || 30,
      observacao: c.observacao || ''
    })
    setModal(c.id)
  }

  const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0')
  const totalAniversariantes = clientes.filter(c => {
    const aniv = c.aniversario || (c.dataNascimento ? c.dataNascimento.slice(5) : '')
    const anivEsp = c.conjugeAniversario || ''
    return Boolean((aniv && aniv.startsWith(mesAtual)) || (anivEsp && anivEsp.startsWith(mesAtual)))
  }).length
  const totalViralgram = clientes.filter(c => Boolean(c.viralgramProfile?.status === 'mapeado' || c.instagram || c.linkedin)).length
  const totalFamilia = clientes.filter(c => Boolean(c.conjugeNome || (c.familia && c.familia.length > 0) || c.estadoCivil === 'casado')).length

  const filtrados = clientes.filter(c => {
    const term = busca.toLowerCase()
    const matchBusca = !term || c.nome.toLowerCase().includes(term) || (c.cpfCnpj || '').includes(term) || (c.email || '').toLowerCase().includes(term) || (c.telefone || '').includes(term)
    if (!matchBusca) return false

    if (abaFiltro === 'aniversariantes') {
      const aniv = c.aniversario || (c.dataNascimento ? c.dataNascimento.slice(5) : '')
      const anivEsp = c.conjugeAniversario || ''
      return Boolean((aniv && aniv.startsWith(mesAtual)) || (anivEsp && anivEsp.startsWith(mesAtual)))
    }
    if (abaFiltro === 'viralgram') {
      return Boolean(c.viralgramProfile?.status === 'mapeado' || c.instagram || c.linkedin)
    }
    if (abaFiltro === 'familia') {
      return Boolean(c.conjugeNome || (c.familia && c.familia.length > 0) || c.estadoCivil === 'casado')
    }
    return true
  })

  // KPIs
  const totalClientes = clientes.length
  const totalCredito = clientes.reduce((acc, c) => acc + (c.limiteCreditoMensal || 0), 0)
  const totalDevedor = clientes.reduce((acc, c) => acc + (c.saldoDevedor || 0), 0)
  const clientesEmRisco = clientes.filter(c => c.risco === 'alto').length

  return (
    <div className="page">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <h1 className="page-title" style={{ margin:0 }}>👥 Clientes & Contas</h1>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary btn-sm" onClick={load}>↺ Atualizar</button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleMapearTodosViralgram}
            disabled={mappingViralgram}
            title="Mapear presença social de todos os clientes com o motor ViralGram 4.0"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {mappingViralgram ? 'Mapeando...' : '🌟 Mapear ViralGram'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={openNovo}>+ Novo Cliente</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:24 }}>
        <div className="kpi" style={{ borderLeft:'4px solid #FF6B2C' }}>
          <div className="kpi-label">Total de Clientes</div>
          <div className="kpi-value">{totalClientes}</div>
        </div>
        <div className="kpi" style={{ borderLeft:'4px solid #FF9B72' }}>
          <div className="kpi-label">Limite de Crédito Total</div>
          <div className="kpi-value" style={{ color:'#FF9B72' }}>{fmtR(totalCredito)}</div>
        </div>
        <div className="kpi" style={{ borderLeft:'4px solid #FFB703' }}>
          <div className="kpi-label">Saldo Devedor Total</div>
          <div className="kpi-value" style={{ color:'#FFB703' }}>{fmtR(totalDevedor)}</div>
        </div>
        <div className="kpi" style={{ borderLeft:'4px solid #e74c3c' }}>
          <div className="kpi-label">Clientes em Risco Alto</div>
          <div className="kpi-value" style={{ color:'#e74c3c' }}>{clientesEmRisco}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <input type="search" className="input" placeholder="🔍 Buscar por nome, telefone, CPF ou email..." value={busca} onChange={e => setBusca(e.target.value)} style={{ maxWidth: 360 }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${abaFiltro === 'todos' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAbaFiltro('todos')}
          >
            Todos ({totalClientes})
          </button>
          <button
            className={`btn btn-sm ${abaFiltro === 'aniversariantes' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAbaFiltro('aniversariantes')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            🎂 Aniversariantes do Mês ({totalAniversariantes})
          </button>
          <button
            className={`btn btn-sm ${abaFiltro === 'viralgram' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAbaFiltro('viralgram')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            🌟 Mapeados ViralGram ({totalViralgram})
          </button>
          <button
            className={`btn btn-sm ${abaFiltro === 'familia' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAbaFiltro('familia')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            💍 Família & Cônjuge ({totalFamilia})
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome / Razão Social</th>
              <th>Contato</th>
              <th>Aniversário / Região</th>
              <th>Família / Cônjuge</th>
              <th>Limite Mensal</th>
              <th>Saldo Devedor</th>
              <th>Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="8" style={{ textAlign:'center', padding:20 }}>Carregando...</td></tr>}
            {!loading && filtrados.length === 0 && <tr><td colSpan="8" style={{ textAlign:'center', padding:20, color:'var(--muted)' }}>Nenhum cliente encontrado.</td></tr>}
            {filtrados.map(c => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.tipo.toUpperCase()} {c.cpfCnpj ? `· ${c.cpfCnpj}` : ''}</div>
                </td>
                <td>
                  <div style={{ fontSize: 13 }}>{c.telefone || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.email}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
                    {(c.instagram || c.redesSociais?.instagram) ? (
                      <a
                        href={`https://instagram.com/${String(c.instagram || c.redesSociais?.instagram).replace(/^@/, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 11, color: '#E1306C', textDecoration: 'none', fontWeight: 500 }}
                        title="Ver perfil no Instagram"
                      >
                        📸 @{String(c.instagram || c.redesSociais?.instagram).replace(/^@/, '')}
                      </a>
                    ) : null}
                    {(c.linkedin || c.redesSociais?.linkedin) ? (
                      <a
                        href={String(c.linkedin || c.redesSociais?.linkedin).startsWith('http') ? String(c.linkedin || c.redesSociais?.linkedin) : `https://www.linkedin.com/in/${c.linkedin || c.redesSociais?.linkedin}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 11, color: '#0077B5', textDecoration: 'none', fontWeight: 500 }}
                        title="Ver perfil no LinkedIn"
                      >
                        💼 LinkedIn
                      </a>
                    ) : null}
                    {c.viralgramProfile?.reputationScore ? (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '1px 5px',
                          borderRadius: 4,
                          background: 'rgba(255, 107, 44, 0.15)',
                          color: 'var(--primary, #FF6B2C)',
                          fontWeight: 600,
                        }}
                        title={`ViralGram Score: ${c.viralgramProfile.reputationScore}/100 · ${c.viralgramProfile.tier || ''}`}
                      >
                        🌟 VG {c.viralgramProfile.reputationScore}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {c.aniversario ? `🎂 ${c.aniversario}` : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {[c.bairro, c.cidade].filter(Boolean).join(', ') || '—'}
                  </div>
                  {(c.preferencias?.bebida || c.bebida) ? (
                    <div style={{ fontSize: 11, color: 'var(--primary, #FF6B2C)' }}>
                      ☕ {c.preferencias?.bebida || c.bebida}
                    </div>
                  ) : null}
                  {c.telefone && c.aniversario && c.aniversario.startsWith(mesAtual) ? (
                    <a
                      href={`https://wa.me/${c.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Fala ${c.nome?.split(' ')[0] || ''}! Aqui é o T-Rex da Barbearia Dino. Vi que seu aniversário tá chegando e a equipe preparou um presente especial pra você: uma hidratação cortesia no seu corte e aquela bebida comemorativa gelada da casa! Bora agendar seu horário pra comemorar no estilo? Se quiser, já garanto um horário adicional pra trazer um parceiro ou filho pra cortar junto!`)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 4,
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: '#25D366',
                        color: '#fff',
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                      title="Enviar parabéns com brinde e agendamento adicional no WhatsApp"
                    >
                      🎁 Enviar Brinde
                    </a>
                  ) : null}
                </td>
                <td>
                  <div style={{ fontSize: 12 }}>
                    {c.estadoCivil ? (c.estadoCivil.charAt(0).toUpperCase() + c.estadoCivil.slice(1)) : '—'}
                  </div>
                  {c.conjugeNome ? (
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      💍 {c.conjugeNome} {c.conjugeAniversario ? `(${c.conjugeAniversario})` : ''}
                    </div>
                  ) : null}
                </td>
                <td>{fmtR(c.limiteCreditoMensal)}</td>
                <td>
                  <span style={{ color: c.saldoDevedor > 0 ? '#FFB703' : 'inherit', fontWeight: c.saldoDevedor > 0 ? 600 : 400 }}>
                    {fmtR(c.saldoDevedor)}
                  </span>
                </td>
                <td>
                  <span className="badge" style={{ background: c.risco === 'baixo' ? 'rgba(46,204,113,0.1)' : c.risco === 'alto' ? 'rgba(231,76,60,0.1)' : 'rgba(255,183,3,0.1)', color: c.risco === 'baixo' ? '#2ecc71' : c.risco === 'alto' ? '#e74c3c' : '#FFB703' }}>
                    {c.scoreCredito} ({c.risco})
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEditar(c)}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === 'novo' ? 'Novo Cliente' : 'Editar Cliente'} onClose={() => setModal(null)} width={600}>
          <div style={{ display: 'grid', gap: 12, paddingBottom: 16 }}>
            <div className="form-row">
              <div className="form-group">
                <label>Nome / Razão Social *</label>
                <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" />
              </div>
              <div className="form-group" style={{ maxWidth: 120 }}>
                <label>Tipo</label>
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                  <option value="pf">Pessoa Física</option>
                  <option value="pj">Pessoa Jurídica</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>CPF / CNPJ</label>
                <input value={form.cpfCnpj} onChange={e => setForm({ ...form, cpfCnpj: e.target.value })} placeholder="000.000.000-00" />
              </div>
              <div className="form-group">
                <label>Telefone</label>
                <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
            </div>
            <div className="form-group">
              <label>Endereço Completo</label>
              <input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, Número, Bairro, Cidade - UF" />
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--primary, #FF6B2C)' }}>
                Dados Pessoais e Família (T-Rex / Fidelidade)
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Data de Aniversário</label>
                  <input value={form.aniversario} onChange={e => setForm({ ...form, aniversario: e.target.value })} placeholder="DD/MM ou DD/MM/AAAA" />
                </div>
                <div className="form-group">
                  <label>Estado Civil</label>
                  <select value={form.estadoCivil} onChange={e => setForm({ ...form, estadoCivil: e.target.value })}>
                    <option value="solteiro">Solteiro</option>
                    <option value="casado">Casado</option>
                    <option value="namorando">Namorando</option>
                    <option value="uniao_estavel">União Estável</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Bebida Preferida (Cortesia da Casa)</label>
                  <input value={form.bebida} onChange={e => setForm({ ...form, bebida: e.target.value })} placeholder="Ex: Café expresso, Cerveja gelada" />
                </div>
                <div className="form-group">
                  <label>Estilo de Corte Preferido</label>
                  <input value={form.corte} onChange={e => setForm({ ...form, corte: e.target.value })} placeholder="Ex: Degradê navalhado" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Instagram (@ ou link do perfil)</label>
                  <input
                    value={form.instagram}
                    onChange={e => setForm({ ...form, instagram: e.target.value })}
                    placeholder="Ex: @usuario ou instagram.com/usuario"
                  />
                </div>
                <div className="form-group">
                  <label>LinkedIn (link ou perfil)</label>
                  <input
                    value={form.linkedin}
                    onChange={e => setForm({ ...form, linkedin: e.target.value })}
                    placeholder="Ex: linkedin.com/in/usuario"
                  />
                </div>
              </div>
              {form.viralgramProfile && (
                <div style={{ marginBottom: 12, padding: 10, background: 'rgba(255, 107, 44, 0.08)', borderRadius: 8, border: '1px solid rgba(255, 107, 44, 0.25)', fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: '#FF6B2C' }}>
                      🌟 Inteligência ViralGram 4.0 ({form.viralgramProfile.tier || 'Mapeado'})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleMapearIndividualViralgram(modal)}
                      style={{ fontSize: 11, background: 'none', border: 'none', color: '#FF6B2C', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Reanalisar
                    </button>
                  </div>
                  <div>
                    <strong>Score de Reputação:</strong> {form.viralgramProfile.reputationScore}/100 &nbsp;|&nbsp; <strong>Visibilidade:</strong> {form.viralgramProfile.visibilityScore}/100
                  </div>
                  <div style={{ marginTop: 4, color: 'var(--muted)' }}>
                    {form.viralgramProfile.resumoPerfil}
                  </div>
                  {form.viralgramProfile.estrategiaDino && (
                    <div style={{ marginTop: 4, fontWeight: 500, color: 'var(--foreground)' }}>
                      💡 <strong>Estratégia Dino:</strong> {form.viralgramProfile.estrategiaDino}
                    </div>
                  )}
                </div>
              )}
              {modal && modal !== 'novo' && !form.viralgramProfile && (form.instagram || form.linkedin) && (
                <div style={{ marginBottom: 12, textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => handleMapearIndividualViralgram(modal)}
                    style={{ fontSize: 12, padding: '4px 8px', borderRadius: 4, border: '1px solid #FF6B2C', color: '#FF6B2C', background: 'transparent', cursor: 'pointer' }}
                  >
                    🌟 Mapear Presença no ViralGram
                  </button>
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>Bairro</label>
                  <input value={form.bairro} onChange={e => setForm({ ...form, bairro: e.target.value })} placeholder="Ex: Jardim das Américas" />
                </div>
                <div className="form-group">
                  <label>Cidade</label>
                  <input value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} placeholder="Ex: Cuiabá" />
                </div>
              </div>
              {form.estadoCivil === 'casado' || form.estadoCivil === 'namorando' || form.estadoCivil === 'uniao_estavel' ? (
                <div className="form-row">
                  <div className="form-group">
                    <label>Nome da Esposa / Parceira</label>
                    <input value={form.conjugeNome} onChange={e => setForm({ ...form, conjugeNome: e.target.value })} placeholder="Nome da esposa" />
                  </div>
                  <div className="form-group">
                    <label>Aniversário da Esposa</label>
                    <input value={form.conjugeAniversario} onChange={e => setForm({ ...form, conjugeAniversario: e.target.value })} placeholder="DD/MM" />
                  </div>
                </div>
              ) : null}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Limite de Crédito Mensal (R$)</label>
                <input type="number" min="0" step="0.01" value={form.limiteCreditoMensal} onChange={e => setForm({ ...form, limiteCreditoMensal: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Prazo Padrão (Dias)</label>
                <input type="number" min="1" max="90" value={form.diasVencimento} onChange={e => setForm({ ...form, diasVencimento: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Observações Internas</label>
              <textarea value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} rows={3} placeholder="Anotações sobre o cliente..." />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Cliente'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

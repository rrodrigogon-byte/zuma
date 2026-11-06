import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'

export default function OrdensServico() {
  const { empresaAtiva } = useAuth()
  const [ordens, setOrdens] = useState([])
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statusFiltro, setStatusFiltro] = useState('')
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [modalVisualizar, setModalVisualizar] = useState(null)
  const [modalAssinatura, setModalAssinatura] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)
  const canvasRef = useRef(null)
  const [desenhando, setDesenhando] = useState(false)

  const [form, setForm] = useState({
    cliente_nome: '',
    cliente_documento: '',
    cliente_telefone: '',
    cliente_email: '',
    tecnico_responsavel: '',
    prioridade: 'normal',
    equipamento_tipo: 'Equipamento Geral',
    equipamento_marca: '',
    equipamento_modelo: '',
    equipamento_serie: '',
    equipamento_patrimonio: '',
    defeito_reclamado: '',
    laudo_tecnico: '',
    solucao_aplicada: '',
    garantia_dias: 90,
    termo_garantia: 'Garantia de 90 dias conforme Art. 26 do Código de Defesa do Consumidor (Lei 8.078/90) sobre serviços executados e peças aplicadas.',
    checklist: [
      { item: 'Cabo de alimentação / Bateria', conferido: true, obs: 'Em bom estado' },
      { item: 'Acessórios / Estojo', conferido: false, obs: 'Não entregue' },
      { item: 'Avarias estéticas / Riscos pré-existentes', conferido: false, obs: 'Sem marcas aparentes' }
    ],
    pecas: [],
    servicos: [
      { descricao: 'Mão de obra técnica especializada', horas: 1, valor_unitario: 120, total: 120 }
    ],
    desconto: 0
  })

  const notify = (msg, tipo = 'success') => {
    setToastMsg({ msg, tipo })
    setTimeout(() => setToastMsg(null), 4000)
  }

  const carregarDados = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (statusFiltro) qs.set('status', statusFiltro)
      if (busca) qs.set('busca', busca)
      const [lista, kpiData] = await Promise.all([
        api.get(`/api/admin/erp/os?${qs}`),
        api.get('/api/admin/erp/kpis').catch(() => null)
      ])
      setOrdens(Array.isArray(lista) ? lista : [])
      if (kpiData?.ordensServico) setKpis(kpiData.ordensServico)
    } catch (err) {
      notify(err.message || 'Erro ao carregar Ordens de Serviço', 'error')
    } finally {
      setLoading(false)
    }
  }, [statusFiltro, busca])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  const abrirNovaOS = () => {
    setForm({
      cliente_nome: '',
      cliente_documento: '',
      cliente_telefone: '',
      cliente_email: '',
      tecnico_responsavel: '',
      prioridade: 'normal',
      equipamento_tipo: 'Equipamento Geral',
      equipamento_marca: '',
      equipamento_modelo: '',
      equipamento_serie: '',
      equipamento_patrimonio: '',
      defeito_reclamado: '',
      laudo_tecnico: '',
      solucao_aplicada: '',
      garantia_dias: 90,
      termo_garantia: 'Garantia de 90 dias conforme Art. 26 do Código de Defesa do Consumidor (Lei 8.078/90) sobre serviços executados e peças aplicadas.',
      checklist: [
        { item: 'Cabo de alimentação / Bateria', conferido: true, obs: 'Em bom estado' },
        { item: 'Acessórios / Estojo', conferido: false, obs: 'Não entregue' },
        { item: 'Avarias estéticas / Riscos pré-existentes', conferido: false, obs: 'Sem marcas aparentes' }
      ],
      pecas: [],
      servicos: [
        { descricao: 'Mão de obra técnica especializada', horas: 1, valor_unitario: 120, total: 120 }
      ],
      desconto: 0
    })
    setModalAberto(true)
  }

  const addPeca = () => {
    setForm(prev => ({
      ...prev,
      pecas: [...prev.pecas, { descricao: '', quantidade: 1, valor_unitario: 0, total: 0 }]
    }))
  }

  const removePeca = (idx) => {
    setForm(prev => ({ ...prev, pecas: prev.pecas.filter((_, i) => i !== idx) }))
  }

  const updatePeca = (idx, campo, valor) => {
    setForm(prev => {
      const novos = [...prev.pecas]
      novos[idx] = { ...novos[idx], [campo]: valor }
      novos[idx].total = Math.round(Number(novos[idx].quantidade || 1) * Number(novos[idx].valor_unitario || 0) * 100) / 100
      return { ...prev, pecas: novos }
    })
  }

  const addServico = () => {
    setForm(prev => ({
      ...prev,
      servicos: [...prev.servicos, { descricao: '', horas: 1, valor_unitario: 0, total: 0 }]
    }))
  }

  const removeServico = (idx) => {
    if (form.servicos.length <= 1) return
    setForm(prev => ({ ...prev, servicos: prev.servicos.filter((_, i) => i !== idx) }))
  }

  const updateServico = (idx, campo, valor) => {
    setForm(prev => {
      const novos = [...prev.servicos]
      novos[idx] = { ...novos[idx], [campo]: valor }
      novos[idx].total = Math.round(Number(novos[idx].horas || 1) * Number(novos[idx].valor_unitario || 0) * 100) / 100
      return { ...prev, servicos: novos }
    })
  }

  const salvarOS = async (e) => {
    e.preventDefault()
    if (!form.cliente_nome.trim()) return notify('Informe o nome do cliente', 'error')
    setSalvando(true)
    try {
      await api.post('/api/admin/erp/os', form)
      notify('Ordem de Serviço salva com sucesso!')
      setModalAberto(false)
      carregarDados()
    } catch (err) {
      notify(err.message || 'Erro ao salvar OS', 'error')
    } finally {
      setSalvando(false)
    }
  }

  const alterarStatusOS = async (id, status) => {
    try {
      await api.post(`/api/admin/erp/os/${id}/status`, { status })
      notify(`Status da OS alterado para ${status}`)
      carregarDados()
    } catch (err) {
      notify(err.message || 'Erro ao alterar status da OS', 'error')
    }
  }

  const faturarOS = async (id) => {
    if (!confirm('Deseja faturar esta Ordem de Serviço? Um lançamento financeiro a receber será gerado no razão.')) return
    try {
      const res = await api.post(`/api/admin/erp/os/${id}/faturar`, {})
      notify(res.mensagem || 'OS faturada com sucesso!')
      carregarDados()
    } catch (err) {
      notify(err.message || 'Erro ao faturar OS', 'error')
    }
  }

  // Canvas de Assinatura Digital do Cliente
  const iniciarDesenho = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
    setDesenhando(true)
  }

  const desenhar = (e) => {
    if (!desenhando) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  const pararDesenho = () => setDesenhando(false)

  const limparAssinatura = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const salvarAssinatura = async () => {
    const canvas = canvasRef.current
    if (!canvas || !modalAssinatura) return
    const dataUrl = canvas.toDataURL('image/png')
    try {
      await api.post(`/api/admin/erp/os/${modalAssinatura.id}/assinatura`, { assinatura: dataUrl })
      notify('Assinatura digital do cliente registrada com sucesso!')
      setModalAssinatura(null)
      carregarDados()
    } catch (err) {
      notify(err.message || 'Erro ao salvar assinatura', 'error')
    }
  }

  const enviarWhatsAppOS = (os) => {
    const tel = (os.cliente_telefone || '').replace(/\D/g, '')
    if (!tel) return notify('Cliente sem telefone cadastrado', 'error')
    const msg = `*ORDEM DE SERVIÇO ${os.numero}*\nOlá, *${os.cliente_nome}*!\nSua OS do equipamento *${os.equipamento_marca} ${os.equipamento_modelo}* está com status: *${os.status.toUpperCase()}*.\nValor Total: R$ ${Number(os.valor_total).toFixed(2)}\nGarantia: ${os.garantia_dias} dias.\n\nQualquer dúvida, estamos à disposição!`
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const statusBadge = (s) => {
    const map = {
      aberta: { bg: '#64748b', label: 'Aberta' },
      em_analise: { bg: '#0284c7', label: 'Em Análise' },
      aguardando_pecas: { bg: '#eab308', label: 'Aguardando Peças' },
      aguardando_aprovacao: { bg: '#f97316', label: 'Aguard. Aprovação' },
      aprovada: { bg: '#6366f1', label: 'Aprovada' },
      em_execucao: { bg: '#8b5cf6', label: 'Em Execução' },
      concluida: { bg: '#10b981', label: 'Concluída' },
      faturada: { bg: '#059669', label: 'Faturada' },
      cancelada: { bg: '#ef4444', label: 'Cancelada' }
    }
    const c = map[s] || { bg: '#64748b', label: s }
    return (
      <span style={{
        background: c.bg, color: '#fff', padding: '3px 8px', borderRadius: 12,
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5
      }}>
        {c.label}
      </span>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', fontFamily: 'inherit' }}>
      {toastMsg && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toastMsg.tipo === 'error' ? '#ef4444' : '#10b981',
          color: '#fff', padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontWeight: 600, fontSize: 14
        }}>
          {toastMsg.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🛠️</span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Ordens de Serviço & Manutenção (OS 360)</h1>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            Controle completo de assistência técnica, laudos periciais, peças, mão de obra, termos de garantia e assinatura digital
          </p>
        </div>
        <button
          onClick={abrirNovaOS}
          style={{
            background: 'var(--orange, #f97316)', color: '#fff', border: 'none',
            padding: '10px 20px', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 6px rgba(249,115,22,0.3)'
          }}
        >
          <span>➕</span> Nova Ordem de Serviço
        </button>
      </div>

      {/* KPIs */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', padding: 16, borderRadius: 12 }}>
            <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>Total de OS Registradas</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{kpis.total}</div>
          </div>
          <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', padding: 16, borderRadius: 12 }}>
            <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>OS em Aberto / Execução</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: '#f59e0b' }}>{kpis.abertas}</div>
          </div>
          <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', padding: 16, borderRadius: 12 }}>
            <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>Faturamento Realizado de OS</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: '#10b981' }}>R$ {Number(kpis.faturamento || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{
        background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)',
        borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center'
      }}>
        <input
          type="text"
          placeholder="Buscar por número, cliente, equipamento, marca..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ flex: '1 1 260px', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', fontSize: 14 }}
        />
        <select
          value={statusFiltro}
          onChange={e => setStatusFiltro(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', fontSize: 14, minWidth: 160 }}
        >
          <option value="">Todos os status</option>
          <option value="aberta">Aberta</option>
          <option value="em_analise">Em Análise</option>
          <option value="aguardando_pecas">Aguardando Peças</option>
          <option value="aguardando_aprovacao">Aguard. Aprovação</option>
          <option value="aprovada">Aprovada</option>
          <option value="em_execucao">Em Execução</option>
          <option value="concluida">Concluída</option>
          <option value="faturada">Faturada</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <button
          onClick={carregarDados}
          style={{ background: 'var(--line, #e2e8f0)', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
        >
          🔄 Atualizar
        </button>
      </div>

      {/* Tabela de OS */}
      <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
          <thead style={{ background: 'var(--bg-muted, #f8fafc)', borderBottom: '1px solid var(--line, #e2e8f0)' }}>
            <tr>
              <th style={{ padding: '12px 16px' }}>Número</th>
              <th style={{ padding: '12px 16px' }}>Cliente</th>
              <th style={{ padding: '12px 16px' }}>Equipamento / Bem</th>
              <th style={{ padding: '12px 16px' }}>Abertura</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total (R$)</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Carregando Ordens de Serviço...</td></tr>
            ) : ordens.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Nenhuma Ordem de Serviço cadastrada.</td></tr>
            ) : ordens.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid var(--line, #f1f5f9)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>{o.numero}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600 }}>{o.cliente_nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{o.cliente_telefone || '—'}</div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600 }}>{o.equipamento_marca} {o.equipamento_modelo}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{o.equipamento_tipo} {o.equipamento_serie ? `· S/N: ${o.equipamento_serie}` : ''}</div>
                </td>
                <td style={{ padding: '12px 16px' }}>{new Date(o.data_abertura).toLocaleDateString('pt-BR')}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800 }}>
                  R$ {Number(o.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '12px 16px' }}>{statusBadge(o.status)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    <button
                      onClick={() => setModalVisualizar(o)}
                      title="Imprimir OS Completa (A4)"
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                    >
                      🖨️
                    </button>
                    <button
                      onClick={() => setModalAssinatura(o)}
                      title="Coletar Assinatura Digital do Cliente"
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer' }}
                    >
                      ✍️
                    </button>
                    <button
                      onClick={() => enviarWhatsAppOS(o)}
                      title="Notificar Cliente via WhatsApp"
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #86efac', background: '#f0fdf4', color: '#15803d', cursor: 'pointer' }}
                    >
                      💬
                    </button>
                    {o.status !== 'faturada' && (
                      <button
                        onClick={() => faturarOS(o.id)}
                        title="Faturar OS no Financeiro"
                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #fdba74', background: '#fff7ed', color: '#c2410c', fontWeight: 700, cursor: 'pointer' }}
                      >
                        ⚡ Faturar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Nova OS */}
      {modalAberto && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{
            background: '#fff', width: '100%', maxWidth: 960, maxHeight: '90vh',
            borderRadius: 16, overflowY: 'auto', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Abertura de Ordem de Serviço (OS)</h2>
              <button onClick={() => setModalAberto(false)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={salvarOS}>
              {/* Seção Cliente & Técnico */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Nome do Cliente *</label>
                  <input
                    type="text" required
                    value={form.cliente_nome} onChange={e => setForm({ ...form, cliente_nome: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={form.cliente_telefone} onChange={e => setForm({ ...form, cliente_telefone: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Técnico / Responsável</label>
                  <input
                    type="text"
                    value={form.tecnico_responsavel} onChange={e => setForm({ ...form, tecnico_responsavel: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Prioridade</label>
                  <select
                    value={form.prioridade} onChange={e => setForm({ ...form, prioridade: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                  >
                    <option value="baixa">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              {/* Seção Equipamento / Bem */}
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Dados do Equipamento / Bem / Instalação</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Tipo de Bem</label>
                    <input
                      type="text" value={form.equipamento_tipo} onChange={e => setForm({ ...form, equipamento_tipo: e.target.value })}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                      placeholder="Ex: Cadeira Hidráulica, Climatizador, Máquina de Cortar"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Marca</label>
                    <input
                      type="text" value={form.equipamento_marca} onChange={e => setForm({ ...form, equipamento_marca: e.target.value })}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Modelo</label>
                    <input
                      type="text" value={form.equipamento_modelo} onChange={e => setForm({ ...form, equipamento_modelo: e.target.value })}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Nº Série / Placa / Chassi</label>
                    <input
                      type="text" value={form.equipamento_serie} onChange={e => setForm({ ...form, equipamento_serie: e.target.value })}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>
              </div>

              {/* Defeito e Laudo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Defeito Reclamado pelo Cliente</label>
                  <textarea
                    rows="3" value={form.defeito_reclamado} onChange={e => setForm({ ...form, defeito_reclamado: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                    placeholder="Descrição do problema relatado na entrada..."
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Laudo Técnico / Diagnóstico Pericial</label>
                  <textarea
                    rows="3" value={form.laudo_tecnico} onChange={e => setForm({ ...form, laudo_tecnico: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                    placeholder="Parecer técnico constatado após desmontagem/análise..."
                  />
                </div>
              </div>

              {/* Serviços Executados */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Serviços / Mão de Obra</h3>
                  <button type="button" onClick={addServico} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                    ➕ Adicionar Serviço
                  </button>
                </div>
                {form.servicos.map((s, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                    <input
                      type="text" placeholder="Descrição do serviço executado" value={s.descricao}
                      onChange={e => updateServico(idx, 'descricao', e.target.value)}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                    <input
                      type="number" step="0.5" min="0.5" placeholder="Horas" value={s.horas}
                      onChange={e => updateServico(idx, 'horas', e.target.value)}
                      style={{ width: 80, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'center' }}
                    />
                    <input
                      type="number" step="0.01" min="0" placeholder="R$ Valor" value={s.valor_unitario}
                      onChange={e => updateServico(idx, 'valor_unitario', e.target.value)}
                      style={{ width: 110, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }}
                    />
                    <div style={{ width: 100, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontWeight: 700 }}>
                      R$ {Number(s.total || 0).toFixed(2)}
                    </div>
                    <button type="button" onClick={() => removeServico(idx)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
              </div>

              {/* Peças e Materiais */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Peças e Materiais Aplicados (Baixa de Estoque)</h3>
                  <button type="button" onClick={addPeca} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                    ➕ Adicionar Peça
                  </button>
                </div>
                {form.pecas.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic', marginBottom: 8 }}>Nenhuma peça adicional adicionada a esta OS.</div>
                ) : form.pecas.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                    <input
                      type="text" placeholder="Nome da peça / componente" value={p.descricao}
                      onChange={e => updatePeca(idx, 'descricao', e.target.value)}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                    <input
                      type="number" min="1" placeholder="Qtd" value={p.quantidade}
                      onChange={e => updatePeca(idx, 'quantidade', e.target.value)}
                      style={{ width: 70, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'center' }}
                    />
                    <input
                      type="number" step="0.01" min="0" placeholder="R$ Unit" value={p.valor_unitario}
                      onChange={e => updatePeca(idx, 'valor_unitario', e.target.value)}
                      style={{ width: 110, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }}
                    />
                    <div style={{ width: 100, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontWeight: 700 }}>
                      R$ {Number(p.total || 0).toFixed(2)}
                    </div>
                    <button type="button" onClick={() => removePeca(idx)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
              </div>

              {/* Botões do modal */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                <button type="button" onClick={() => setModalAberto(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                  Cancelar
                </button>
                <button
                  type="submit" disabled={salvando}
                  style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--orange, #f97316)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                >
                  {salvando ? 'Salvando...' : 'Salvar Ordem de Serviço'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Assinatura Touch */}
      {modalAssinatura && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{
            background: '#fff', width: '100%', maxWidth: 520, borderRadius: 16, padding: 24,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>Assinatura Digital do Cliente</h2>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
              Peça para o cliente assinar abaixo com o dedo ou mouse aprovando os serviços da OS <strong>{modalAssinatura.numero}</strong>:
            </p>

            <div style={{ border: '2px dashed #cbd5e1', borderRadius: 8, background: '#fafafa', marginBottom: 16, overflow: 'hidden' }}>
              <canvas
                ref={canvasRef}
                width={470} height={200}
                onMouseDown={iniciarDesenho}
                onMouseMove={desenhar}
                onMouseUp={pararDesenho}
                onMouseLeave={pararDesenho}
                style={{ width: '100%', height: 200, cursor: 'crosshair', display: 'block' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={limparAssinatura} style={{ border: '1px solid #cbd5e1', background: '#fff', padding: '8px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                🧹 Limpar
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setModalAssinatura(null)} style={{ border: '1px solid #cbd5e1', background: '#fff', padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={salvarAssinatura} style={{ border: 'none', background: '#10b981', color: '#fff', padding: '8px 18px', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Confirmar Assinatura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Visualizar Impressão OS A4 */}
      {modalVisualizar && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{
            background: '#fff', width: '100%', maxWidth: 840, maxHeight: '95vh',
            borderRadius: 16, overflowY: 'auto', padding: 32
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }} className="no-print">
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => window.print()} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
                  🖨️ Imprimir OS (A4)
                </button>
                <button onClick={() => enviarWhatsAppOS(modalVisualizar)} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
                  💬 WhatsApp
                </button>
              </div>
              <button onClick={() => setModalVisualizar(null)} style={{ border: 'none', background: 'none', fontSize: 24, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ border: '1px solid #e2e8f0', padding: 32, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 16, marginBottom: 20 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>{empresaAtiva?.nome || 'KYTTO ERP'}</h2>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Ordem de Serviço Oficial & Termo de Garantia</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>ORDEM DE SERVIÇO</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#f97316' }}>{modalVisualizar.numero}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Data: {new Date(modalVisualizar.data_abertura).toLocaleDateString('pt-BR')}</div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div><strong>Cliente:</strong> {modalVisualizar.cliente_nome}</div>
                  <div><strong>Telefone:</strong> {modalVisualizar.cliente_telefone || '—'}</div>
                  <div><strong>Equipamento:</strong> {modalVisualizar.equipamento_marca} {modalVisualizar.equipamento_modelo}</div>
                  <div><strong>Nº de Série:</strong> {modalVisualizar.equipamento_serie || 'Não informado'}</div>
                </div>
              </div>

              <div style={{ marginBottom: 16, fontSize: 13 }}>
                <div><strong>Defeito Reclamado:</strong> {modalVisualizar.defeito_reclamado || 'Não especificado'}</div>
                <div style={{ marginTop: 4 }}><strong>Laudo Técnico:</strong> {modalVisualizar.laudo_tecnico || 'Em análise técnica'}</div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, marginBottom: 16, textAlign: 'right', fontSize: 16, fontWeight: 900 }}>
                Valor Total da OS: R$ {Number(modalVisualizar.valor_total).toFixed(2)}
              </div>

              {/* Termo e Assinatura */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, fontSize: 11, color: '#64748b' }}>
                <div style={{ marginBottom: 24 }}>{modalVisualizar.termo_garantia}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, textAlign: 'center', alignItems: 'flex-end' }}>
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 6 }}>
                    <div><strong>{modalVisualizar.tecnico_responsavel || 'Técnico Autorizado'}</strong></div>
                    <div>Responsável Técnico</div>
                  </div>
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 6 }}>
                    {modalVisualizar.assinatura_cliente ? (
                      <img src={modalVisualizar.assinatura_cliente} alt="Assinatura" style={{ maxHeight: 50, marginBottom: 4 }} />
                    ) : (
                      <div style={{ height: 30 }}></div>
                    )}
                    <div><strong>{modalVisualizar.cliente_nome}</strong></div>
                    <div>Assinatura do Cliente</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

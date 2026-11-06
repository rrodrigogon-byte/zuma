import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'

export default function PropostasComerciais() {
  const { empresaAtiva } = useAuth()
  const [propostas, setPropostas] = useState([])
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statusFiltro, setStatusFiltro] = useState('')
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [modalVisualizar, setModalVisualizar] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)

  const [form, setForm] = useState({
    cliente_nome: '',
    cliente_documento: '',
    cliente_telefone: '',
    cliente_email: '',
    vendedor_nome: '',
    validade_dias: 15,
    condicao_pagamento: 'À vista',
    forma_pagamento: 'Pix',
    prazo_entrega: 'Imediato',
    tipo_frete: 'sem_frete',
    valor_frete: 0,
    observacoes: '',
    termos_garantia: 'Garantia legal de 90 dias conforme Art. 26 do CDC.',
    itens: [
      { descricao: '', ncm: '33059000', quantidade: 1, valor_unitario: 0, valor_desconto: 0, subtotal: 0 }
    ]
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
        api.get(`/api/admin/erp/propostas?${qs}`),
        api.get('/api/admin/erp/kpis').catch(() => null)
      ])
      setPropostas(Array.isArray(lista) ? lista : [])
      if (kpiData?.propostas) setKpis(kpiData.propostas)
    } catch (err) {
      notify(err.message || 'Erro ao carregar propostas', 'error')
    } finally {
      setLoading(false)
    }
  }, [statusFiltro, busca])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  const abrirNovaProposta = () => {
    setForm({
      cliente_nome: '',
      cliente_documento: '',
      cliente_telefone: '',
      cliente_email: '',
      vendedor_nome: '',
      validade_dias: 15,
      condicao_pagamento: 'À vista',
      forma_pagamento: 'Pix',
      prazo_entrega: 'Imediato',
      tipo_frete: 'sem_frete',
      valor_frete: 0,
      observacoes: '',
      termos_garantia: 'Garantia legal de 90 dias conforme Art. 26 do CDC.',
      itens: [
        { descricao: '', ncm: '33059000', quantidade: 1, valor_unitario: 0, valor_desconto: 0, subtotal: 0 }
      ]
    })
    setModalAberto(true)
  }

  const addItem = () => {
    setForm(prev => ({
      ...prev,
      itens: [...prev.itens, { descricao: '', ncm: '33059000', quantidade: 1, valor_unitario: 0, valor_desconto: 0, subtotal: 0 }]
    }))
  }

  const removeItem = (idx) => {
    if (form.itens.length <= 1) return
    setForm(prev => ({
      ...prev,
      itens: prev.itens.filter((_, i) => i !== idx)
    }))
  }

  const updateItem = (idx, campo, valor) => {
    setForm(prev => {
      const novos = [...prev.itens]
      novos[idx] = { ...novos[idx], [campo]: valor }
      const q = Number(novos[idx].quantidade || 1)
      const vu = Number(novos[idx].valor_unitario || 0)
      const desc = Number(novos[idx].valor_desconto || 0)
      novos[idx].subtotal = Math.max(0, Math.round((q * vu - desc) * 100) / 100)
      return { ...prev, itens: novos }
    })
  }

  const calcularTotaisForm = () => {
    let subtotal = 0
    for (const it of form.itens) {
      subtotal += (Number(it.quantidade || 1) * Number(it.valor_unitario || 0))
    }
    const descontoTotal = form.itens.reduce((s, it) => s + Number(it.valor_desconto || 0), 0)
    const valorFrete = Number(form.valor_frete || 0)
    const valorTotal = Math.max(0, subtotal - descontoTotal + valorFrete)
    return { subtotal, descontoTotal, valorFrete, valorTotal }
  }

  const salvarProposta = async (e) => {
    e.preventDefault()
    if (!form.cliente_nome.trim()) return notify('Informe o nome do cliente', 'error')
    setSalvando(true)
    try {
      await api.post('/api/admin/erp/propostas', form)
      notify('Proposta comercial salva com sucesso!')
      setModalAberto(false)
      carregarDados()
    } catch (err) {
      notify(err.message || 'Erro ao salvar proposta', 'error')
    } finally {
      setSalvando(false)
    }
  }

  const alterarStatus = async (id, status) => {
    try {
      await api.post(`/api/admin/erp/propostas/${id}/status`, { status })
      notify(`Status alterado para ${status}`)
      carregarDados()
    } catch (err) {
      notify(err.message || 'Erro ao alterar status', 'error')
    }
  }

  const converterEmVenda = async (id) => {
    if (!confirm('Deseja aprovar e faturar esta proposta comercial? Isto criará o recebível financeiro correspondente.')) return
    try {
      const res = await api.post(`/api/admin/erp/propostas/${id}/converter`, {})
      notify(res.mensagem || 'Proposta faturada com sucesso!')
      carregarDados()
    } catch (err) {
      notify(err.message || 'Erro ao faturar proposta', 'error')
    }
  }

  const enviarWhatsApp = (prop) => {
    const tel = (prop.cliente_telefone || '').replace(/\D/g, '')
    if (!tel) return notify('Cliente não possui telefone cadastrado', 'error')
    const itensTexto = (Array.isArray(prop.itens) ? prop.itens : JSON.parse(prop.itens || '[]'))
      .map(it => `• ${it.quantidade}x ${it.descricao}: R$ ${Number(it.subtotal || 0).toFixed(2)}`)
      .join('\n')
    const msg = `*PROPOSTA COMERCIAL ${prop.numero}*\nOlá, *${prop.cliente_nome}*!\nSegue o orçamento elaborado para você:\n\n${itensTexto}\n\n*Total: R$ ${Number(prop.valor_total).toFixed(2)}*\nCondição: ${prop.condicao_pagamento} (${prop.forma_pagamento})\nValidade: até ${new Date(prop.data_validade).toLocaleDateString('pt-BR')}\n\nPara aprovar ou tirar dúvidas, basta responder esta mensagem!`
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const statusBadge = (s) => {
    const map = {
      rascunho: { bg: '#94a3b8', label: 'Rascunho' },
      enviada: { bg: '#3b82f6', label: 'Enviada' },
      aprovada: { bg: '#10b981', label: 'Aprovada' },
      faturada: { bg: '#059669', label: 'Faturada' },
      rejeitada: { bg: '#ef4444', label: 'Rejeitada' },
      cancelada: { bg: '#64748b', label: 'Cancelada' }
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

  const totaisForm = calcularTotaisForm()

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

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>📜</span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Propostas Comerciais & Cotações</h1>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            Gestão empresarial de orçamentos, cotações B2B/B2C, envio de PDF e conversão direta para faturamento
          </p>
        </div>
        <button
          onClick={abrirNovaProposta}
          style={{
            background: 'var(--orange, #f97316)', color: '#fff', border: 'none',
            padding: '10px 20px', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 6px rgba(249,115,22,0.3)'
          }}
        >
          <span>➕</span> Nova Proposta Comercial
        </button>
      </div>

      {/* Cards de KPIs */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', padding: 16, borderRadius: 12 }}>
            <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>Total de Propostas</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{kpis.total}</div>
          </div>
          <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', padding: 16, borderRadius: 12 }}>
            <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>Valor Total Ofertado</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: '#0284c7' }}>R$ {Number(kpis.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', padding: 16, borderRadius: 12 }}>
            <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>Propostas Aprovadas / Fechadas</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: '#10b981' }}>{kpis.aprovadas}</div>
          </div>
          <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', padding: 16, borderRadius: 12 }}>
            <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>Taxa de Conversão</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: '#f59e0b' }}>{kpis.taxaConversao}%</div>
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
          placeholder="Buscar por número, cliente, documento..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{
            flex: '1 1 240px', padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--line, #cbd5e1)', fontSize: 14
          }}
        />
        <select
          value={statusFiltro}
          onChange={e => setStatusFiltro(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--line, #cbd5e1)', fontSize: 14, minWidth: 160
          }}
        >
          <option value="">Todos os status</option>
          <option value="rascunho">Rascunho</option>
          <option value="enviada">Enviada</option>
          <option value="aprovada">Aprovada</option>
          <option value="faturada">Faturada</option>
          <option value="rejeitada">Rejeitada</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <button
          onClick={carregarDados}
          style={{
            background: 'var(--line, #e2e8f0)', border: 'none', padding: '8px 16px',
            borderRadius: 8, fontWeight: 600, cursor: 'pointer'
          }}
        >
          🔄 Atualizar
        </button>
      </div>

      {/* Tabela de Propostas */}
      <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
          <thead style={{ background: 'var(--bg-muted, #f8fafc)', borderBottom: '1px solid var(--line, #e2e8f0)' }}>
            <tr>
              <th style={{ padding: '12px 16px' }}>Número</th>
              <th style={{ padding: '12px 16px' }}>Cliente</th>
              <th style={{ padding: '12px 16px' }}>Emissão</th>
              <th style={{ padding: '12px 16px' }}>Validade</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Valor Total</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Carregando propostas comerciais...</td></tr>
            ) : propostas.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Nenhuma proposta comercial cadastrada até o momento.</td></tr>
            ) : propostas.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--line, #f1f5f9)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>{p.numero}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600 }}>{p.cliente_nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.cliente_telefone || p.cliente_email || '—'}</div>
                </td>
                <td style={{ padding: '12px 16px' }}>{new Date(p.data_emissao).toLocaleDateString('pt-BR')}</td>
                <td style={{ padding: '12px 16px' }}>{p.data_validade ? new Date(p.data_validade).toLocaleDateString('pt-BR') : `${p.validade_dias} dias`}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--primary, #0f172a)' }}>
                  R$ {Number(p.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '12px 16px' }}>{statusBadge(p.status)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    <button
                      onClick={() => setModalVisualizar(p)}
                      title="Visualizar Proposta / Imprimir"
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                    >
                      🖨️
                    </button>
                    <button
                      onClick={() => enviarWhatsApp(p)}
                      title="Enviar via WhatsApp"
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #86efac', background: '#f0fdf4', color: '#15803d', cursor: 'pointer' }}
                    >
                      💬
                    </button>
                    {p.status !== 'faturada' && (
                      <button
                        onClick={() => converterEmVenda(p.id)}
                        title="Aprovar e Faturar (Gerar Receita no Financeiro)"
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

      {/* Modal Nova Proposta */}
      {modalAberto && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{
            background: '#fff', width: '100%', maxWidth: 900, maxHeight: '90vh',
            borderRadius: 16, overflowY: 'auto', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Nova Proposta Comercial</h2>
              <button onClick={() => setModalAberto(false)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={salvarProposta}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Nome do Cliente *</label>
                  <input
                    type="text" required
                    value={form.cliente_nome}
                    onChange={e => setForm({ ...form, cliente_nome: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                    placeholder="Ex: Carlos Eduardo de Oliveira"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>CPF / CNPJ</label>
                  <input
                    type="text"
                    value={form.cliente_documento}
                    onChange={e => setForm({ ...form, cliente_documento: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>WhatsApp / Telefone</label>
                  <input
                    type="text"
                    value={form.cliente_telefone}
                    onChange={e => setForm({ ...form, cliente_telefone: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                    placeholder="(65) 99999-0000"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>E-mail</label>
                  <input
                    type="email"
                    value={form.cliente_email}
                    onChange={e => setForm({ ...form, cliente_email: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                    placeholder="cliente@exemplo.com"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Validade (Dias)</label>
                  <input
                    type="number" min="1"
                    value={form.validade_dias}
                    onChange={e => setForm({ ...form, validade_dias: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Condição de Pagamento</label>
                  <select
                    value={form.condicao_pagamento}
                    onChange={e => setForm({ ...form, condicao_pagamento: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                  >
                    <option value="À vista">À vista</option>
                    <option value="15 dias">15 dias</option>
                    <option value="30 dias">30 dias</option>
                    <option value="30/60 dias">30/60 dias</option>
                    <option value="30/60/90 dias">30/60/90 dias</option>
                    <option value="Entrada + Parcelas">Entrada + Parcelas</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Forma de Pagamento</label>
                  <select
                    value={form.forma_pagamento}
                    onChange={e => setForm({ ...form, forma_pagamento: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                  >
                    <option value="Pix">Pix (Chave da Empresa)</option>
                    <option value="Boleto Bancário">Boleto Bancário</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Transferência TED">Transferência TED</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Prazo de Entrega</label>
                  <input
                    type="text"
                    value={form.prazo_entrega}
                    onChange={e => setForm({ ...form, prazo_entrega: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                    placeholder="Imediato / 5 dias úteis"
                  />
                </div>
              </div>

              {/* Tabela de Itens */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Itens da Proposta (Produtos e Serviços)</h3>
                  <button
                    type="button" onClick={addItem}
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
                  >
                    ➕ Adicionar Item
                  </button>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Descrição</th>
                        <th style={{ padding: '8px 10px', width: 90 }}>NCM</th>
                        <th style={{ padding: '8px 10px', width: 70, textAlign: 'center' }}>Qtd</th>
                        <th style={{ padding: '8px 10px', width: 110, textAlign: 'right' }}>Unitário (R$)</th>
                        <th style={{ padding: '8px 10px', width: 100, textAlign: 'right' }}>Desconto</th>
                        <th style={{ padding: '8px 10px', width: 110, textAlign: 'right' }}>Subtotal</th>
                        <th style={{ padding: '8px 10px', width: 40, textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.itens.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              type="text" required placeholder="Nome do produto ou serviço"
                              value={it.descricao} onChange={e => updateItem(idx, 'descricao', e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              type="text" placeholder="NCM"
                              value={it.ncm} onChange={e => updateItem(idx, 'ncm', e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              type="number" min="0.01" step="any" required
                              value={it.quantidade} onChange={e => updateItem(idx, 'quantidade', e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'center' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              type="number" min="0" step="0.01" required
                              value={it.valor_unitario} onChange={e => updateItem(idx, 'valor_unitario', e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              type="number" min="0" step="0.01"
                              value={it.valor_desconto} onChange={e => updateItem(idx, 'valor_desconto', e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
                            R$ {Number(it.subtotal || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <button
                              type="button" onClick={() => removeItem(idx)}
                              style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 800 }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totais */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
                <div style={{ width: 280, background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: 'var(--muted)' }}>Subtotal:</span>
                    <span style={{ fontWeight: 600 }}>R$ {totaisForm.subtotal.toFixed(2)}</span>
                  </div>
                  {totaisForm.descontoTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#ef4444' }}>
                      <span>Descontos:</span>
                      <span style={{ fontWeight: 600 }}>- R$ {totaisForm.descontoTotal.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: 8, fontSize: 18 }}>
                    <span style={{ fontWeight: 800 }}>Total Geral:</span>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>R$ {totaisForm.valorTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Botões do modal */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  type="button" onClick={() => setModalAberto(false)}
                  style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={salvando}
                  style={{
                    padding: '10px 24px', borderRadius: 8, border: 'none',
                    background: 'var(--orange, #f97316)', color: '#fff', cursor: 'pointer', fontWeight: 700
                  }}
                >
                  {salvando ? 'Salvando...' : 'Salvar Proposta Comercial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Visualizar / Layout A4 Impressão */}
      {modalVisualizar && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{
            background: '#fff', width: '100%', maxWidth: 840, maxHeight: '95vh',
            borderRadius: 16, overflowY: 'auto', padding: 32, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }} className="no-print">
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => window.print()}
                  style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
                >
                  🖨️ Imprimir Proposta (A4)
                </button>
                <button
                  onClick={() => enviarWhatsApp(modalVisualizar)}
                  style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
                >
                  💬 Enviar via WhatsApp
                </button>
              </div>
              <button onClick={() => setModalVisualizar(null)} style={{ border: 'none', background: 'none', fontSize: 24, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Layout Folha A4 Timbrada */}
            <div style={{ border: '1px solid #e2e8f0', padding: 32, borderRadius: 8, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 16, marginBottom: 20 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>{empresaAtiva?.nome || 'KYTTO ERP'}</h2>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Soluções Corporativas Integradas</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>PROPOSTA COMERCIAL</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f97316' }}>{modalVisualizar.numero}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Data: {new Date(modalVisualizar.data_emissao).toLocaleDateString('pt-BR')}</div>
                </div>
              </div>

              {/* Dados do Cliente */}
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, marginBottom: 20, fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', color: '#475569' }}>Dados do Cliente / Solicitante</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div><strong>Nome:</strong> {modalVisualizar.cliente_nome}</div>
                  <div><strong>Documento:</strong> {modalVisualizar.cliente_documento || 'Não informado'}</div>
                  <div><strong>Telefone:</strong> {modalVisualizar.cliente_telefone || 'Não informado'}</div>
                  <div><strong>E-mail:</strong> {modalVisualizar.cliente_email || 'Não informado'}</div>
                </div>
              </div>

              {/* Tabela de Itens */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
                <thead>
                  <tr style={{ background: '#0f172a', color: '#fff' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Item / Descrição</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: 60 }}>Qtd</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: 100 }}>Unitário</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: 100 }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(modalVisualizar.itens) ? modalVisualizar.itens : JSON.parse(modalVisualizar.itens || '[]')).map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ fontWeight: 600 }}>{it.descricao}</div>
                        {it.ncm && <div style={{ fontSize: 11, color: '#94a3b8' }}>NCM: {it.ncm}</div>}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>{it.quantidade}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>R$ {Number(it.valor_unitario).toFixed(2)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>R$ {Number(it.subtotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totais e Condições */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 20 }}>
                <div style={{ flex: 1, fontSize: 12, color: '#475569' }}>
                  <div><strong>Condição de Pagamento:</strong> {modalVisualizar.condicao_pagamento}</div>
                  <div><strong>Forma de Pagamento:</strong> {modalVisualizar.forma_pagamento}</div>
                  <div><strong>Prazo de Entrega:</strong> {modalVisualizar.prazo_entrega}</div>
                  <div><strong>Validade da Proposta:</strong> até {modalVisualizar.data_validade ? new Date(modalVisualizar.data_validade).toLocaleDateString('pt-BR') : `${modalVisualizar.validade_dias} dias`}</div>
                </div>
                <div style={{ width: 220, textAlign: 'right', fontSize: 14 }}>
                  <div>Subtotal: <strong>R$ {Number(modalVisualizar.subtotal || 0).toFixed(2)}</strong></div>
                  {Number(modalVisualizar.desconto_total) > 0 && (
                    <div style={{ color: '#ef4444' }}>Desconto: - R$ {Number(modalVisualizar.desconto_total).toFixed(2)}</div>
                  )}
                  <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6, borderTop: '2px solid #0f172a', paddingTop: 6 }}>
                    Total: R$ {Number(modalVisualizar.valor_total).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Termos e Assinatura */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, fontSize: 11, color: '#64748b' }}>
                <div style={{ marginBottom: 28 }}>{modalVisualizar.termos_garantia}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, textAlign: 'center' }}>
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 6 }}>
                    <div><strong>{empresaAtiva?.nome || 'Representante Autorizado'}</strong></div>
                    <div>Emissor da Proposta</div>
                  </div>
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 6 }}>
                    <div><strong>{modalVisualizar.cliente_nome}</strong></div>
                    <div>De Acordo do Cliente</div>
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

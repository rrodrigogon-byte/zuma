import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'

export default function ExpedicaoLogistica() {
  const { empresaAtiva } = useAuth()
  const [romaneios, setRomaneios] = useState([])
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statusFiltro, setStatusFiltro] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [modalVisualizar, setModalVisualizar] = useState(null)
  const [modalBaixaEntrega, setModalBaixaEntrega] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)

  const [form, setForm] = useState({
    data_saida: new Date().toISOString().split('T')[0],
    motorista_nome: '',
    veiculo_placa: '',
    veiculo_modelo: '',
    observacoes: '',
    entregas: [
      { cliente_nome: '', endereco: '', telefone: '', pedido_ref: '', volumes: 1, valor_mercadoria: 0, forma_pagamento: 'pago_antecipado', valor_a_cobrar: 0 }
    ]
  })

  const [formBaixa, setFormBaixa] = useState({
    recebedor_nome: '',
    recebedor_doc: '',
    status: 'entregue'
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
      const [lista, kpiData] = await Promise.all([
        api.get(`/api/admin/erp/romaneios?${qs}`),
        api.get('/api/admin/erp/kpis').catch(() => null)
      ])
      setRomaneios(Array.isArray(lista) ? lista : [])
      if (kpiData?.logistica) setKpis(kpiData.logistica)
    } catch (err) {
      notify(err.message || 'Erro ao carregar romaneios', 'error')
    } finally {
      setLoading(false)
    }
  }, [statusFiltro])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  const abrirNovoRomaneio = () => {
    setForm({
      data_saida: new Date().toISOString().split('T')[0],
      motorista_nome: '',
      veiculo_placa: '',
      veiculo_modelo: '',
      observacoes: '',
      entregas: [
        { cliente_nome: '', endereco: '', telefone: '', pedido_ref: '', volumes: 1, valor_mercadoria: 0, forma_pagamento: 'pago_antecipado', valor_a_cobrar: 0 }
      ]
    })
    setModalAberto(true)
  }

  const addEntrega = () => {
    setForm(prev => ({
      ...prev,
      entregas: [...prev.entregas, { cliente_nome: '', endereco: '', telefone: '', pedido_ref: '', volumes: 1, valor_mercadoria: 0, forma_pagamento: 'pago_antecipado', valor_a_cobrar: 0 }]
    }))
  }

  const removeEntrega = (idx) => {
    if (form.entregas.length <= 1) return
    setForm(prev => ({ ...prev, entregas: prev.entregas.filter((_, i) => i !== idx) }))
  }

  const updateEntrega = (idx, campo, valor) => {
    setForm(prev => {
      const novos = [...prev.entregas]
      novos[idx] = { ...novos[idx], [campo]: valor }
      return { ...prev, entregas: novos }
    })
  }

  const salvarRomaneio = async (e) => {
    e.preventDefault()
    if (!form.motorista_nome.trim()) return notify('Informe o nome do motorista/entregador', 'error')
    setSalvando(true)
    try {
      await api.post('/api/admin/erp/romaneios', form)
      notify('Romaneio de Carga criado com sucesso!')
      setModalAberto(false)
      carregarDados()
    } catch (err) {
      notify(err.message || 'Erro ao salvar romaneio', 'error')
    } finally {
      setSalvando(false)
    }
  }

  const confirmarBaixaEntrega = async (e) => {
    e.preventDefault()
    if (!modalBaixaEntrega) return
    try {
      await api.post(`/api/admin/erp/romaneios/${modalBaixaEntrega.romaneioId}/entrega/${modalBaixaEntrega.entrega.id}`, formBaixa)
      notify('Entrega confirmada com sucesso!')
      setModalBaixaEntrega(null)
      carregarDados()
      if (modalVisualizar && modalVisualizar.id === modalBaixaEntrega.romaneioId) {
        const atualizado = await api.get(`/api/admin/erp/romaneios/${modalVisualizar.id}`)
        setModalVisualizar(atualizado)
      }
    } catch (err) {
      notify(err.message || 'Erro ao registrar baixa da entrega', 'error')
    }
  }

  const statusBadge = (s) => {
    const map = {
      em_preparacao: { bg: '#eab308', label: 'Em Separação' },
      em_rota: { bg: '#3b82f6', label: 'Em Trânsito' },
      concluido: { bg: '#10b981', label: 'Concluído' },
      cancelado: { bg: '#ef4444', label: 'Cancelado' }
    }
    const c = map[s] || { bg: '#64748b', label: s }
    return (
      <span style={{
        background: c.bg, color: '#fff', padding: '3px 8px', borderRadius: 12,
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase'
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
            <span style={{ fontSize: 28 }}>🚚</span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Expedição, Logística & Romaneio de Carga</h1>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            Controle de saída de mercadorias, conferência (picking/packing), romaneios para motoristas e comprovante de entrega
          </p>
        </div>
        <button
          onClick={abrirNovoRomaneio}
          style={{
            background: 'var(--orange, #f97316)', color: '#fff', border: 'none',
            padding: '10px 20px', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 6px rgba(249,115,22,0.3)'
          }}
        >
          <span>➕</span> Novo Romaneio de Carga
        </button>
      </div>

      {/* KPIs */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', padding: 16, borderRadius: 12 }}>
            <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>Total de Romaneios</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{kpis.totalRomaneios}</div>
          </div>
          <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', padding: 16, borderRadius: 12 }}>
            <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>Cargas em Trânsito / Na Rua</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: '#3b82f6' }}>{kpis.entregasEmTransito}</div>
          </div>
        </div>
      )}

      {/* Tabela de Romaneios */}
      <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
          <thead style={{ background: 'var(--bg-muted, #f8fafc)', borderBottom: '1px solid var(--line, #e2e8f0)' }}>
            <tr>
              <th style={{ padding: '12px 16px' }}>Romaneio</th>
              <th style={{ padding: '12px 16px' }}>Data Saída</th>
              <th style={{ padding: '12px 16px' }}>Motorista / Entregador</th>
              <th style={{ padding: '12px 16px' }}>Veículo</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Paradas / Pedidos</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Valor Carga</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Carregando romaneios de carga...</td></tr>
            ) : romaneios.length === 0 ? (
              <tr><td colSpan="8" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Nenhum romaneio de carga registrado.</td></tr>
            ) : romaneios.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--line, #f1f5f9)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>{r.numero}</td>
                <td style={{ padding: '12px 16px' }}>{new Date(r.data_saida).toLocaleDateString('pt-BR')}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.motorista_nome}</td>
                <td style={{ padding: '12px 16px' }}>{r.veiculo_modelo || '—'} {r.veiculo_placa ? `(${r.veiculo_placa})` : ''}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>{r.total_pedidos || 0}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800 }}>
                  R$ {Number(r.valor_total_mercadorias || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '12px 16px' }}>{statusBadge(r.status)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <button
                    onClick={() => setModalVisualizar(r)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
                  >
                    📋 Visualizar / Rota
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Novo Romaneio */}
      {modalAberto && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{
            background: '#fff', width: '100%', maxWidth: 960, maxHeight: '90vh',
            borderRadius: 16, overflowY: 'auto', padding: 24
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Criar Romaneio de Carga & Expedição</h2>
              <button onClick={() => setModalAberto(false)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={salvarRomaneio}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Motorista / Entregador *</label>
                  <input
                    type="text" required value={form.motorista_nome}
                    onChange={e => setForm({ ...form, motorista_nome: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                    placeholder="Nome do condutor"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Veículo (Placa)</label>
                  <input
                    type="text" value={form.veiculo_placa}
                    onChange={e => setForm({ ...form, veiculo_placa: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                    placeholder="ABC-1234"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Modelo do Veículo</label>
                  <input
                    type="text" value={form.veiculo_modelo}
                    onChange={e => setForm({ ...form, veiculo_modelo: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                    placeholder="Fiorino / Moto / Van"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Data da Saída</label>
                  <input
                    type="date" value={form.data_saida}
                    onChange={e => setForm({ ...form, data_saida: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              {/* Paradas de Entrega */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Paradas de Entrega / Destinatários</h3>
                  <button type="button" onClick={addEntrega} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                    ➕ Adicionar Parada
                  </button>
                </div>

                {form.entregas.map((ent, idx) => (
                  <div key={idx} style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 8 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>Destinatário / Cliente</label>
                        <input
                          type="text" required placeholder="Nome do cliente" value={ent.cliente_nome}
                          onChange={e => updateEntrega(idx, 'cliente_nome', e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>Endereço Completo</label>
                        <input
                          type="text" required placeholder="Rua, número, bairro, cidade" value={ent.endereco}
                          onChange={e => updateEntrega(idx, 'endereco', e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>Telefone para Contato</label>
                        <input
                          type="text" placeholder="(65) 99999-0000" value={ent.telefone}
                          onChange={e => updateEntrega(idx, 'telefone', e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, alignItems: 'center' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>Nº Pedido / Nota</label>
                        <input
                          type="text" placeholder="Ex: PED-102" value={ent.pedido_ref}
                          onChange={e => updateEntrega(idx, 'pedido_ref', e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>Volumes</label>
                        <input
                          type="number" min="1" value={ent.volumes}
                          onChange={e => updateEntrega(idx, 'volumes', e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'center' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>Valor Mercadoria</label>
                        <input
                          type="number" step="0.01" min="0" value={ent.valor_mercadoria}
                          onChange={e => updateEntrega(idx, 'valor_mercadoria', e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>Pagamento</label>
                        <select
                          value={ent.forma_pagamento}
                          onChange={e => updateEntrega(idx, 'forma_pagamento', e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                        >
                          <option value="pago_antecipado">Já Pago</option>
                          <option value="cobrar_destino">Cobrar na Entrega</option>
                        </select>
                      </div>
                      {ent.forma_pagamento === 'cobrar_destino' && (
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#c2410c' }}>A Cobrar (R$)</label>
                          <input
                            type="number" step="0.01" min="0" value={ent.valor_a_cobrar}
                            onChange={e => updateEntrega(idx, 'valor_a_cobrar', e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #fdba74', textAlign: 'right', fontWeight: 700 }}
                          />
                        </div>
                      )}
                      <div style={{ textAlign: 'right', paddingTop: 16 }}>
                        <button type="button" onClick={() => removeEntrega(idx)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700 }}>
                          🗑️ Remover
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                <button type="button" onClick={() => setModalAberto(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button
                  type="submit" disabled={salvando}
                  style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--orange, #f97316)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                >
                  {salvando ? 'Salvando...' : 'Salvar Romaneio de Carga'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Visualizar e Imprimir Romaneio */}
      {modalVisualizar && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{
            background: '#fff', width: '100%', maxWidth: 900, maxHeight: '95vh',
            borderRadius: 16, overflowY: 'auto', padding: 32
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }} className="no-print">
              <button onClick={() => window.print()} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
                🖨️ Imprimir Romaneio (A4)
              </button>
              <button onClick={() => setModalVisualizar(null)} style={{ border: 'none', background: 'none', fontSize: 24, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ border: '1px solid #e2e8f0', padding: 24, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 12, marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>{empresaAtiva?.nome || 'KYTTO ERP'}</h2>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Romaneio de Carga & Expedição de Entregas</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{modalVisualizar.numero}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Saída: {new Date(modalVisualizar.data_saida).toLocaleDateString('pt-BR')}</div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, marginBottom: 16, fontSize: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><strong>Motorista:</strong> {modalVisualizar.motorista_nome}</div>
                <div><strong>Veículo:</strong> {modalVisualizar.veiculo_modelo} {modalVisualizar.veiculo_placa ? `(Placa: ${modalVisualizar.veiculo_placa})` : ''}</div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 20 }}>
                <thead>
                  <tr style={{ background: '#0f172a', color: '#fff' }}>
                    <th style={{ padding: '8px', textAlign: 'center', width: 30 }}>#</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Destinatário & Endereço</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: 90 }}>Pedido</th>
                    <th style={{ padding: '8px', textAlign: 'right', width: 100 }}>A Cobrar</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: 90 }}>Status</th>
                    <th style={{ padding: '8px', textAlign: 'left', width: 140 }}>Assinatura / Doc</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(modalVisualizar.entregas) ? modalVisualizar.entregas : JSON.parse(modalVisualizar.entregas || '[]')).map((ent, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700 }}>{idx + 1}</td>
                      <td style={{ padding: '8px' }}>
                        <div style={{ fontWeight: 700 }}>{ent.cliente_nome}</div>
                        <div style={{ fontSize: 11, color: '#475569' }}>{ent.endereco}</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>Tel: {ent.telefone || '—'}</div>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{ent.pedido_ref || '—'}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: ent.forma_pagamento === 'cobrar_destino' ? 800 : 400, color: ent.forma_pagamento === 'cobrar_destino' ? '#c2410c' : '#475569' }}>
                        {ent.forma_pagamento === 'cobrar_destino' ? `R$ ${Number(ent.valor_a_cobrar || 0).toFixed(2)}` : 'Pago'}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: ent.status === 'entregue' ? '#dcfce7' : '#fef9c3', color: ent.status === 'entregue' ? '#15803d' : '#854d0e' }}>
                          {ent.status === 'entregue' ? 'Entregue' : 'Pendente'}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>
                        {ent.status === 'entregue' ? (
                          <div style={{ fontSize: 10, color: '#16a34a' }}>
                            <div>✓ {ent.recebedor_nome || 'Recebido'}</div>
                            <div>{ent.recebedor_doc}</div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setModalBaixaEntrega({ romaneioId: modalVisualizar.id, entrega: ent })}
                            className="no-print"
                            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', fontSize: 11, cursor: 'pointer' }}
                          >
                            ✍️ Confirmar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderTop: '2px solid #0f172a', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <div>Total de Paradas: <strong>{modalVisualizar.total_pedidos}</strong> | Volumes: <strong>{modalVisualizar.total_volumes}</strong></div>
                <div>Total a Cobrar no Destino: <strong>R$ {Number(modalVisualizar.valor_a_receber_destino || 0).toFixed(2)}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Baixar Entrega */}
      {modalBaixaEntrega && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 440, borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>Confirmar Recebimento da Entrega</h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>
              Destinatário: <strong>{modalBaixaEntrega.entrega.cliente_nome}</strong>
            </p>
            <form onSubmit={confirmarBaixaEntrega}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Nome de Quem Recebeu *</label>
                <input
                  type="text" required value={formBaixa.recebedor_nome}
                  onChange={e => setFormBaixa({ ...formBaixa, recebedor_nome: e.target.value })}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  placeholder="Nome legível"
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>RG / CPF do Recebedor</label>
                <input
                  type="text" value={formBaixa.recebedor_doc}
                  onChange={e => setFormBaixa({ ...formBaixa, recebedor_doc: e.target.value })}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  placeholder="Documento"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setModalBaixaEntrega(null)} style={{ border: '1px solid #cbd5e1', background: '#fff', padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ border: 'none', background: '#10b981', color: '#fff', padding: '6px 16px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
                  Registrar Entrega
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

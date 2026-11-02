/**
 * Oficina Mecânica — KYTTO Clube
 * Tela completa: lista de OS, criação, checklist, aprovação WhatsApp
 */
import { useState, useEffect, useCallback } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const STATUS_LABELS = {
  aberta: { label: 'Aberta', color: '#4a9eff' },
  orcamento_enviado: { label: 'Aguardando Aprovação', color: '#f59e0b' },
  aprovado: { label: 'Aprovado', color: '#2D6F9E' },
  em_execucao: { label: 'Em Execução', color: '#8b5cf6' },
  finalizado: { label: 'Finalizado', color: '#FF6B2C' },
  cancelado: { label: 'Cancelado', color: '#e05c5c' },
}

const CHECKLIST_PADRAO = [
  'Nível de óleo do motor', 'Nível de água do radiador', 'Nível de fluido de freio',
  'Pneus (calibragem e desgaste)', 'Freios dianteiros', 'Freios traseiros',
  'Luzes dianteiras', 'Luzes traseiras', 'Bateria', 'Extintor de incêndio',
  'Estepe e macaco', 'Documentação do veículo'
]

export default function Oficina() {
  const { toast } = useToast()
  const [ordens, setOrdens] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(null) // 'nova-os' | 'detalhes' | 'checklist'
  const [osSelecionada, setOsSelecionada] = useState(null)
  const [formOS, setFormOS] = useState({
    placa: '', cliente_nome: '', cliente_telefone: '',
    marca: '', modelo: '', ano_fabricacao: '', km_entrada: '',
    descricao_problema: '', mecanico_responsavel: '',
    valor_pecas: '', valor_mao_obra: ''
  })

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroStatus) params.set('status', filtroStatus)
      if (busca) params.set('q', busca)
      const data = await api.get(`/api/v1/oficina/ordens?${params}`)
      setOrdens(data.ordens || [])
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }, [filtroStatus, busca])

  useEffect(() => { carregar() }, [carregar])

  async function criarOS() {
    try {
      await api.post('/api/v1/oficina/ordens', formOS)
      toast('Ordem de Serviço criada!', 'success')
      setModal(null)
      setFormOS({ placa: '', cliente_nome: '', cliente_telefone: '', marca: '', modelo: '', ano_fabricacao: '', km_entrada: '', descricao_problema: '', mecanico_responsavel: '', valor_pecas: '', valor_mao_obra: '' })
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function enviarOrcamentoWhatsApp(os) {
    try {
      await api.post(`/api/v1/oficina/ordens/${os.id}/enviar-orcamento`)
      toast('Orçamento enviado via WhatsApp!', 'success')
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  async function atualizarStatus(osId, novoStatus) {
    try {
      await api.patch(`/api/v1/oficina/ordens/${osId}/status`, { status: novoStatus })
      toast('Status atualizado!', 'success')
      carregar()
    } catch (e) { toast(e.message, 'error') }
  }

  const ordensFiltradas = ordens.filter(os =>
    (!busca || os.numero_os?.includes(busca) || os.placa?.toLowerCase().includes(busca.toLowerCase()) ||
     os.cliente_nome?.toLowerCase().includes(busca.toLowerCase()))
  )

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>🔧 Oficina Mecânica</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            {ordens.length} ordens de serviço
          </p>
        </div>
        <button className="btn-primary" onClick={() => setModal('nova-os')}>
          + Nova OS
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder="Buscar por placa, cliente ou nº OS..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ flex: 1, minWidth: 220, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }}
        />
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Tabela de OS */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Carregando...</div>
      ) : (
        <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--card2)', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Nº OS</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Placa / Veículo</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Cliente</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Abertura</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {ordensFiltradas.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhuma OS encontrada</td></tr>
              ) : ordensFiltradas.map(os => {
                const st = STATUS_LABELS[os.status] || { label: os.status, color: '#888' }
                return (
                  <tr key={os.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, fontFamily: 'monospace' }}>{os.numero_os}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{os.placa}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{os.marca} {os.modelo}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div>{os.cliente_nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{os.cliente_telefone}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: st.color + '22', color: st.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                      {fmtR(os.valor_total || 0)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>
                      {fmtDate(os.created_at)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          onClick={() => { setOsSelecionada(os); setModal('detalhes') }}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer', fontSize: 12 }}
                        >Ver</button>
                        {os.status === 'aberta' && (
                          <button
                            onClick={() => enviarOrcamentoWhatsApp(os)}
                            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#2D6F9E', color: '#fff', cursor: 'pointer', fontSize: 12 }}
                          >WhatsApp</button>
                        )}
                        {os.status === 'orcamento_enviado' && (
                          <button
                            onClick={() => atualizarStatus(os.id, 'aprovado')}
                            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#14b87a', color: '#fff', cursor: 'pointer', fontSize: 12 }}
                          >Aprovar</button>
                        )}
                        {os.status === 'aprovado' && (
                          <button
                            onClick={() => atualizarStatus(os.id, 'em_execucao')}
                            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#8b5cf6', color: '#fff', cursor: 'pointer', fontSize: 12 }}
                          >Iniciar</button>
                        )}
                        {os.status === 'em_execucao' && (
                          <button
                            onClick={() => atualizarStatus(os.id, 'finalizado')}
                            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#FF6B2C', color: '#fff', cursor: 'pointer', fontSize: 12 }}
                          >Finalizar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Nova OS */}
      {modal === 'nova-os' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 580, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 24px' }}>Nova Ordem de Serviço</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Placa *', key: 'placa', placeholder: 'ABC-1234' },
                { label: 'KM Entrada', key: 'km_entrada', placeholder: '45000', type: 'number' },
                { label: 'Marca', key: 'marca', placeholder: 'Toyota' },
                { label: 'Modelo', key: 'modelo', placeholder: 'Corolla' },
                { label: 'Ano Fabricação', key: 'ano_fabricacao', placeholder: '2020', type: 'number' },
                { label: 'Nome do Cliente *', key: 'cliente_nome', placeholder: 'João Silva' },
                { label: 'Telefone do Cliente', key: 'cliente_telefone', placeholder: '(65) 99999-9999' },
                { label: 'Mecânico Responsável', key: 'mecanico_responsavel', placeholder: 'Carlos' },
                { label: 'Valor Peças (R$)', key: 'valor_pecas', placeholder: '0.00', type: 'number' },
                { label: 'Valor Mão de Obra (R$)', key: 'valor_mao_obra', placeholder: '0.00', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{f.label}</label>
                  <input
                    type={f.type || 'text'}
                    placeholder={f.placeholder}
                    value={formOS[f.key]}
                    onChange={e => setFormOS(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Descrição do Problema *</label>
                <textarea
                  placeholder="Descreva o problema relatado pelo cliente..."
                  value={formOS.descricao_problema}
                  onChange={e => setFormOS(p => ({ ...p, descricao_problema: e.target.value }))}
                  rows={3}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={criarOS} className="btn-primary">Criar OS</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalhes OS */}
      {modal === 'detalhes' && osSelecionada && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 32, width: 700, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: 0 }}>OS #{osSelecionada.numero_os}</h2>
                <span style={{ background: (STATUS_LABELS[osSelecionada.status]?.color || '#888') + '22', color: STATUS_LABELS[osSelecionada.status]?.color || '#888', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  {STATUS_LABELS[osSelecionada.status]?.label || osSelecionada.status}
                </span>
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--muted)' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'var(--card)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase' }}>Veículo</div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{osSelecionada.placa}</div>
                <div>{osSelecionada.marca} {osSelecionada.modelo} {osSelecionada.ano_fabricacao}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>KM Entrada: {osSelecionada.km_entrada?.toLocaleString('pt-BR')}</div>
              </div>
              <div style={{ background: 'var(--card)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase' }}>Cliente</div>
                <div style={{ fontWeight: 600 }}>{osSelecionada.cliente_nome}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{osSelecionada.cliente_telefone}</div>
              </div>
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase' }}>Problema Relatado</div>
              <p style={{ margin: 0 }}>{osSelecionada.descricao_problema}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div style={{ background: 'var(--card)', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Peças</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#4a9eff' }}>{fmtR(osSelecionada.valor_pecas || 0)}</div>
              </div>
              <div style={{ background: 'var(--card)', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Mão de Obra</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#8b5cf6' }}>{fmtR(osSelecionada.valor_mao_obra || 0)}</div>
              </div>
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 10, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Total da OS</span>
              <span style={{ fontWeight: 700, fontSize: 24, color: '#FF6B2C' }}>{fmtR(osSelecionada.valor_total || 0)}</span>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              {osSelecionada.status === 'aberta' && (
                <button
                  onClick={() => enviarOrcamentoWhatsApp(osSelecionada)}
                  style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#2D6F9E', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                >📱 Enviar Orçamento WhatsApp</button>
              )}
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

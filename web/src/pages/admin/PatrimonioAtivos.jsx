import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'

export default function PatrimonioAtivos() {
  const { empresaAtiva } = useAuth()
  const [ativos, setAtivos] = useState([])
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [modalManutencao, setModalManutencao] = useState(null)
  const [modalEtiquetas, setModalEtiquetas] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)

  const [form, setForm] = useState({
    codigo_tombamento: '',
    descricao: '',
    categoria: 'maquinas_equipamentos',
    marca: '',
    modelo: '',
    numero_serie: '',
    data_aquisicao: new Date().toISOString().split('T')[0],
    valor_aquisicao: 0,
    vida_util_anos: 10,
    taxa_depreciacao_anual: 10.0,
    nf_compra: '',
    fornecedor_nome: '',
    localizacao_setor: 'Salão Principal',
    responsavel: '',
    estado_conservacao: 'otimo'
  })

  const [formManut, setFormManut] = useState({
    tipo: 'preventiva',
    descricao: '',
    custo: 0,
    prestador: '',
    proxima_manutencao: ''
  })

  const notify = (msg, tipo = 'success') => {
    setToastMsg({ msg, tipo })
    setTimeout(() => setToastMsg(null), 4000)
  }

  const carregarDados = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (categoriaFiltro) qs.set('categoria', categoriaFiltro)
      if (busca) qs.set('busca', busca)
      const [lista, kpiData] = await Promise.all([
        api.get(`/api/admin/erp/ativos?${qs}`),
        api.get('/api/admin/erp/kpis').catch(() => null)
      ])
      setAtivos(Array.isArray(lista) ? lista : [])
      if (kpiData?.patrimonio) setKpis(kpiData.patrimonio)
    } catch (err) {
      notify(err.message || 'Erro ao carregar ativos patrimoniais', 'error')
    } finally {
      setLoading(false)
    }
  }, [categoriaFiltro, busca])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  const abrirNovoAtivo = () => {
    setForm({
      codigo_tombamento: '',
      descricao: '',
      categoria: 'maquinas_equipamentos',
      marca: '',
      modelo: '',
      numero_serie: '',
      data_aquisicao: new Date().toISOString().split('T')[0],
      valor_aquisicao: 0,
      vida_util_anos: 10,
      taxa_depreciacao_anual: 10.0,
      nf_compra: '',
      fornecedor_nome: '',
      localizacao_setor: 'Salão Principal',
      responsavel: '',
      estado_conservacao: 'otimo'
    })
    setModalAberto(true)
  }

  const mudarCategoria = (cat) => {
    const regras = {
      informatica: { taxa: 20.0, anos: 5 },
      maquinas_equipamentos: { taxa: 10.0, anos: 10 },
      moveis_utensilios: { taxa: 10.0, anos: 10 },
      veiculos: { taxa: 20.0, anos: 5 },
      instalacoes: { taxa: 10.0, anos: 10 },
      ferramentas: { taxa: 20.0, anos: 5 }
    }
    const r = regras[cat] || { taxa: 10.0, anos: 10 }
    setForm({
      ...form,
      categoria: cat,
      taxa_depreciacao_anual: r.taxa,
      vida_util_anos: r.anos
    })
  }

  const salvarAtivo = async (e) => {
    e.preventDefault()
    if (!form.descricao.trim()) return notify('Informe a descrição do bem', 'error')
    setSalvando(true)
    try {
      await api.post('/api/admin/erp/ativos', form)
      notify('Bem patrimonial cadastrado com sucesso!')
      setModalAberto(false)
      carregarDados()
    } catch (err) {
      notify(err.message || 'Erro ao cadastrar bem patrimonial', 'error')
    } finally {
      setSalvando(false)
    }
  }

  const salvarManutencao = async (e) => {
    e.preventDefault()
    if (!modalManutencao) return
    try {
      await api.post(`/api/admin/erp/ativos/${modalManutencao.id}/manutencao`, formManut)
      notify('Manutenção registrada com sucesso!')
      setModalManutencao(null)
      carregarDados()
    } catch (err) {
      notify(err.message || 'Erro ao registrar manutenção', 'error')
    }
  }

  const categoriaLabel = (c) => {
    const map = {
      informatica: 'Informática / TI',
      maquinas_equipamentos: 'Máquinas & Equipamentos',
      moveis_utensilios: 'Móveis & Utensílios',
      veiculos: 'Veículos & Transporte',
      instalacoes: 'Instalações & Climatização',
      ferramentas: 'Ferramentas'
    }
    return map[c] || c
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
            <span style={{ fontSize: 28 }}>🏛️</span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Controle de Patrimônio & Ativos Imobilizados</h1>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            Tombamento físico, depreciação linear oficial (IN SRF 162), manutenções preventivas e controle de vida útil
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setModalEtiquetas(true)}
            style={{
              background: '#0284c7', color: '#fff', border: 'none', padding: '10px 18px',
              borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            🏷️ Etiquetas de Tombamento
          </button>
          <button
            onClick={abrirNovoAtivo}
            style={{
              background: 'var(--orange, #f97316)', color: '#fff', border: 'none',
              padding: '10px 20px', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 6px rgba(249,115,22,0.3)'
            }}
          >
            <span>➕</span> Cadastrar Ativo
          </button>
        </div>
      </div>

      {/* KPIs */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', padding: 16, borderRadius: 12 }}>
            <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>Total de Bens Tombados</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{kpis.totalAtivos}</div>
          </div>
          <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', padding: 16, borderRadius: 12 }}>
            <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>Valor Histórico de Aquisição</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: '#0f172a' }}>R$ {Number(kpis.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', padding: 16, borderRadius: 12 }}>
            <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>Depreciação Acumulada</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: '#ef4444' }}>- R$ {Number(kpis.depreciacaoAcumulada || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', padding: 16, borderRadius: 12 }}>
            <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>Valor Residual Contábil Atual</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: '#10b981' }}>R$ {Number(kpis.valorResidual || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
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
          placeholder="Buscar por código de tombamento, descrição, marca..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ flex: '1 1 260px', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', fontSize: 14 }}
        />
        <select
          value={categoriaFiltro}
          onChange={e => setCategoriaFiltro(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', fontSize: 14, minWidth: 200 }}
        >
          <option value="">Todas as categorias</option>
          <option value="informatica">Informática / TI</option>
          <option value="maquinas_equipamentos">Máquinas & Equipamentos</option>
          <option value="moveis_utensilios">Móveis & Utensílios</option>
          <option value="veiculos">Veículos & Transporte</option>
          <option value="instalacoes">Instalações & Climatização</option>
          <option value="ferramentas">Ferramentas</option>
        </select>
        <button
          onClick={carregarDados}
          style={{ background: 'var(--line, #e2e8f0)', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
        >
          🔄 Atualizar
        </button>
      </div>

      {/* Tabela de Ativos */}
      <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
          <thead style={{ background: 'var(--bg-muted, #f8fafc)', borderBottom: '1px solid var(--line, #e2e8f0)' }}>
            <tr>
              <th style={{ padding: '12px 16px' }}>Tombamento</th>
              <th style={{ padding: '12px 16px' }}>Descrição do Bem</th>
              <th style={{ padding: '12px 16px' }}>Categoria</th>
              <th style={{ padding: '12px 16px' }}>Aquisição</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Valor Original</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Depreciação</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Valor Residual</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Carregando patrimônio...</td></tr>
            ) : ativos.length === 0 ? (
              <tr><td colSpan="8" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Nenhum ativo patrimonial cadastrado.</td></tr>
            ) : ativos.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid var(--line, #f1f5f9)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 800, color: '#f97316' }}>{a.codigo_tombamento}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600 }}>{a.descricao}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{a.marca} {a.modelo} {a.numero_serie ? `· S/N: ${a.numero_serie}` : ''}</div>
                </td>
                <td style={{ padding: '12px 16px' }}>{categoriaLabel(a.categoria)}</td>
                <td style={{ padding: '12px 16px' }}>{new Date(a.data_aquisicao).toLocaleDateString('pt-BR')}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                  R$ {Number(a.valor_aquisicao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ef4444' }}>
                  - R$ {Number(a.depreciacao_acumulada || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>({a.percentual_depreciado}%)</div>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                  R$ {Number(a.valor_residual || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <button
                    onClick={() => setModalManutencao(a)}
                    title="Registrar Manutenção"
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
                  >
                    🔧 Manutenção
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Cadastro de Ativo */}
      {modalAberto && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{
            background: '#fff', width: '100%', maxWidth: 800, maxHeight: '90vh',
            borderRadius: 16, overflowY: 'auto', padding: 24
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Cadastrar Bem Patrimonial (Ativo Imobilizado)</h2>
              <button onClick={() => setModalAberto(false)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={salvarAtivo}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Descrição do Bem *</label>
                  <input
                    type="text" required value={form.descricao}
                    onChange={e => setForm({ ...form, descricao: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                    placeholder="Ex: Cadeira de Barbeiro Hidráulica Reclinável"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Categoria Contábil (IN SRF 162)</label>
                  <select
                    value={form.categoria} onChange={e => mudarCategoria(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                  >
                    <option value="maquinas_equipamentos">Máquinas & Equipamentos (10% a.a. / 10 anos)</option>
                    <option value="moveis_utensilios">Móveis & Utensílios (10% a.a. / 10 anos)</option>
                    <option value="informatica">Informática & TI (20% a.a. / 5 anos)</option>
                    <option value="veiculos">Veículos & Transporte (20% a.a. / 5 anos)</option>
                    <option value="instalacoes">Instalações & Climatização (10% a.a. / 10 anos)</option>
                    <option value="ferramentas">Ferramentas de Uso Contínuo (20% a.a. / 5 anos)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Marca</label>
                  <input
                    type="text" value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Modelo</label>
                  <input
                    type="text" value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Nº de Série</label>
                  <input
                    type="text" value={form.numero_serie} onChange={e => setForm({ ...form, numero_serie: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Data de Aquisição</label>
                  <input
                    type="date" value={form.data_aquisicao} onChange={e => setForm({ ...form, data_aquisicao: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Valor de Compra (R$) *</label>
                  <input
                    type="number" step="0.01" min="0" required value={form.valor_aquisicao}
                    onChange={e => setForm({ ...form, valor_aquisicao: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Setor / Localização</label>
                  <input
                    type="text" value={form.localizacao_setor} onChange={e => setForm({ ...form, localizacao_setor: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                <button type="button" onClick={() => setModalAberto(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button
                  type="submit" disabled={salvando}
                  style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--orange, #f97316)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                >
                  {salvando ? 'Salvando...' : 'Gravar Bem Patrimonial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar Manutenção */}
      {modalManutencao && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 500, borderRadius: 16, padding: 24 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>Registrar Manutenção de Ativo</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
              Bem: <strong>{modalManutencao.codigo_tombamento} — {modalManutencao.descricao}</strong>
            </p>

            <form onSubmit={salvarManutencao}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Tipo de Manutenção</label>
                <select
                  value={formManut.tipo} onChange={e => setFormManut({ ...formManut, tipo: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                >
                  <option value="preventiva">Preventiva (Revisão periódica / Lubrificação / Limpeza)</option>
                  <option value="corretiva">Corretiva (Troca de peças / Reparo de quebra)</option>
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Descrição do Serviço / Troca *</label>
                <textarea
                  rows="2" required value={formManut.descricao}
                  onChange={e => setFormManut({ ...formManut, descricao: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  placeholder="Ex: Troca do pistão hidráulico e vedação..."
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Custo Total (R$)</label>
                  <input
                    type="number" step="0.01" min="0" value={formManut.custo}
                    onChange={e => setFormManut({ ...formManut, custo: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Prestador / Oficina</label>
                  <input
                    type="text" value={formManut.prestador}
                    onChange={e => setFormManut({ ...formManut, prestador: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setModalManutencao(null)} style={{ border: '1px solid #cbd5e1', background: '#fff', padding: '8px 14px', borderRadius: 6, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ border: 'none', background: '#0284c7', color: '#fff', padding: '8px 18px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
                  Salvar Manutenção
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Impressão de Etiquetas de Tombamento */}
      {modalEtiquetas && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{
            background: '#fff', width: '100%', maxWidth: 840, maxHeight: '90vh',
            borderRadius: 16, overflowY: 'auto', padding: 28
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }} className="no-print">
              <button onClick={() => window.print()} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
                🖨️ Imprimir Etiquetas Patrimoniais
              </button>
              <button onClick={() => setModalEtiquetas(false)} style={{ border: 'none', background: 'none', fontSize: 24, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {ativos.map(a => (
                <div key={a.id} style={{
                  border: '2px solid #0f172a', borderRadius: 8, padding: 12,
                  textAlign: 'center', background: '#fff', fontSize: 11
                }}>
                  <div style={{ fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>{empresaAtiva?.nome || 'KYTTO ERP'}</div>
                  <div style={{ fontSize: 9, color: '#64748b', marginBottom: 6 }}>CONTROLE PATRIMONIAL</div>
                  <div style={{
                    fontSize: 20, fontWeight: 900, background: '#0f172a', color: '#fff',
                    padding: '4px 8px', borderRadius: 4, letterSpacing: 1, margin: '6px 0'
                  }}>
                    {a.codigo_tombamento}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.descricao}</div>
                  <div style={{ fontSize: 10, color: '#475569' }}>{a.localizacao_setor}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

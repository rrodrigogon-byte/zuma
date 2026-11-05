import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const TIPOS_NEGOCIO = [
  { id: 'barbearia', label: 'Barbearia & Perfumaria', icon: '💈' },
  { id: 'loja', label: 'Loja / Suplementos & Nutrição', icon: '🏪' },
  { id: 'esporte', label: 'Complexo Esportivo / Tênis & Beach', icon: '🎾' },
  { id: 'bar', label: 'Bar, Restaurante & Conveniência', icon: '🍻' },
  { id: 'clube', label: 'Clube & Academia', icon: '🏋️' },
  { id: 'supermercado', label: 'Supermercado & Varejo', icon: '🛒' },
  { id: 'outro', label: 'Outro Segmento Comercial', icon: '🏢' },
]

const FORM_VAZIO = {
  nome: '',
  razaoSocial: '',
  cnpj: '',
  inscricaoEstadual: '',
  inscricaoMunicipal: '',
  tipoNegocio: 'barbearia',
  telefone: '',
  email: '',
  website: '',
  enderecoLogradouro: '',
  enderecoNumero: '',
  enderecoComplemento: '',
  enderecoBairro: '',
  enderecoCidade: 'Tangará da Serra',
  enderecoEstado: 'MT',
  enderecoCep: '',
  permitirEstoqueNegativo: true,
  criarLojaMatriz: true,
  administrador: {
    nome: '',
    email: '',
    senhaInicial: '',
  },
}

function mascaraCnpj(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`
}

function mascaraCep(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

function mascaraTelefone(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`
}

export default function Empresas() {
  const { toast } = useToast()
  const { empresaAtiva, trocarEmpresa, user } = useAuth()
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todas')
  const [modal, setModal] = useState(null) // null | { modo: 'novo' } | { modo: 'editar', empresa: {...} }
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/admin/empresas?incluir_inativas=true')
      setEmpresas(Array.isArray(res.empresas) ? res.empresas : [])
    } catch (err) {
      toast(err.message || 'Não foi possível carregar as empresas.', true)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  const abrirNovo = () => {
    setForm(FORM_VAZIO)
    setModal({ modo: 'novo' })
  }

  const abrirEditar = (empresa) => {
    setForm({
      nome: empresa.nomeFantasia || empresa.nome || '',
      razaoSocial: empresa.razaoSocial || empresa.nome || '',
      cnpj: mascaraCnpj(empresa.cnpjNormalizado || empresa.cnpj || ''),
      inscricaoEstadual: empresa.inscricaoEstadual || '',
      inscricaoMunicipal: empresa.inscricaoMunicipal || '',
      tipoNegocio: empresa.tipoNegocio || 'outro',
      telefone: mascaraTelefone(empresa.telefone || ''),
      email: empresa.email || '',
      website: empresa.website || '',
      enderecoLogradouro: empresa.enderecoLogradouro || '',
      enderecoNumero: empresa.enderecoNumero || '',
      enderecoComplemento: empresa.enderecoComplemento || '',
      enderecoBairro: empresa.enderecoBairro || '',
      enderecoCidade: empresa.enderecoCidade || 'Tangará da Serra',
      enderecoEstado: empresa.enderecoEstado || 'MT',
      enderecoCep: mascaraCep(empresa.enderecoCep || ''),
      permitirEstoqueNegativo: empresa.permitirEstoqueNegativo !== false,
      criarLojaMatriz: false,
      administrador: { nome: '', email: '', senhaInicial: '' },
    })
    setModal({ modo: 'editar', id: empresa.id, empresa })
  }

  const buscarCepAutomatico = async (cepEntrada) => {
    const limpo = String(cepEntrada || '').replace(/\D/g, '')
    if (limpo.length !== 8) return
    setBuscandoCep(true)
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${limpo}/json/`)
      const data = await resp.json()
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          enderecoLogradouro: data.logradouro || prev.enderecoLogradouro,
          enderecoBairro: data.bairro || prev.enderecoBairro,
          enderecoCidade: data.localidade || prev.enderecoCidade,
          enderecoEstado: data.uf || prev.enderecoEstado,
          enderecoCep: mascaraCep(limpo),
        }))
        toast('Endereço preenchido com sucesso pelo CEP!')
      }
    } catch {
      // silencioso se offline
    } finally {
      setBuscandoCep(false)
    }
  }

  const salvar = async () => {
    if (!form.nome?.trim()) {
      return toast('O Nome Fantasia é obrigatório.', true)
    }
    if (!form.razaoSocial?.trim()) {
      return toast('A Razão Social é obrigatória.', true)
    }

    const cnpjDigitos = String(form.cnpj || '').replace(/\D/g, '')
    if (cnpjDigitos && cnpjDigitos.length !== 14) {
      return toast('O CNPJ deve conter exatamente 14 dígitos numéricos.', true)
    }

    if (modal?.modo === 'novo' && form.administrador?.email) {
      if (!form.administrador.nome?.trim()) {
        return toast('Informe o nome do administrador inicial.', true)
      }
      if (String(form.administrador.senhaInicial || '').length < 6) {
        return toast('A senha inicial do administrador deve ter ao menos 6 caracteres.', true)
      }
    }

    setSalvando(true)
    try {
      if (modal?.modo === 'novo') {
        await api.post('/api/admin/empresas', form)
        toast('Empresa cadastrada com sucesso com isolamento multiempresa!')
      } else {
        await api.patch(`/api/admin/empresas/${modal.id}`, form)
        toast('Dados da empresa atualizados com sucesso!')
      }
      setModal(null)
      await carregar()
    } catch (err) {
      toast(err.message || 'Erro ao salvar empresa.', true)
    } finally {
      setSalvando(false)
    }
  }

  const inativar = async (empresa) => {
    const acao = empresa.ativa !== false ? 'inativar' : 'reativar'
    const confirma = window.confirm(`Deseja realmente ${acao} a empresa "${empresa.nomeFantasia || empresa.nome}"?`)
    if (!confirma) return

    try {
      if (empresa.ativa !== false) {
        await api.delete(`/api/admin/empresas/${empresa.id}`)
        toast(`Empresa ${empresa.nomeFantasia || empresa.nome} inativada com sucesso.`)
      } else {
        await api.patch(`/api/admin/empresas/${empresa.id}`, { ativa: true })
        toast(`Empresa ${empresa.nomeFantasia || empresa.nome} reativada com sucesso.`)
      }
      await carregar()
    } catch (err) {
      toast(err.message || `Erro ao ${acao} empresa.`, true)
    }
  }

  const selecionarEmpresaAtiva = (empresa) => {
    if (empresa.id === empresaAtiva?.id) {
      return toast(`A empresa ${empresa.nomeFantasia || empresa.nome} já é a ativa na sessão.`)
    }
    const trocou = trocarEmpresa?.(empresa.id)
    if (trocou) {
      toast(`Empresa ativa alternada para ${empresa.nomeFantasia || empresa.nome}!`)
    } else {
      try {
        localStorage.setItem('sp_empresa_ativa', JSON.stringify(empresa))
        window.location.reload()
      } catch {}
    }
  }

  const empresasFiltradas = useMemo(() => {
    return empresas.filter((emp) => {
      if (filtroStatus === 'ativas' && emp.ativa === false) return false
      if (filtroStatus === 'inativas' && emp.ativa !== false) return false
      if (filtroTipo !== 'todos' && emp.tipoNegocio !== filtroTipo) return false

      if (!busca.trim()) return true
      const b = busca.toLowerCase()
      const n = String(emp.nome || '').toLowerCase()
      const r = String(emp.razaoSocial || '').toLowerCase()
      const c = String(emp.cnpj || '').toLowerCase()
      const cd = String(emp.enderecoCidade || '').toLowerCase()
      return n.includes(b) || r.includes(b) || c.includes(b) || cd.includes(b)
    })
  }, [empresas, busca, filtroTipo, filtroStatus])

  return (
    <div className="page" style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
      {/* Topo / Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🏢</span>
            <h1 className="page-title" style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#12283F' }}>
              Gestão de Empresas & Multiempresa
            </h1>
          </div>
          <div style={{ marginTop: 6, color: 'var(--muted, #64748b)', fontSize: 13 }}>
            Cadastro completo de matrizes e filiais com isolamento contábil, fiscal, estoque e financeiro.
            {empresaAtiva && (
              <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,107,44,.12)', color: '#FF6B2C', fontWeight: 700 }}>
                Ativa agora: {empresaAtiva.nomeFantasia || empresaAtiva.nome}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={carregar} disabled={loading} title="Recarregar lista">
            ↺ {loading ? 'Carregando...' : 'Atualizar'}
          </button>
          <Link to="/admin/lojas" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            🏪 Unidades / Lojas
          </Link>
          <button className="btn btn-primary btn-sm" onClick={abrirNovo} style={{ background: '#FF6B2C', borderColor: '#FF6B2C', fontWeight: 700 }}>
            + Nova Empresa
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <input
            type="text"
            className="form-control"
            placeholder="🔍 Buscar por Nome, Razão Social, CNPJ ou Cidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Segmento:</label>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            style={{ padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}
          >
            <option value="todos">Todos os segmentos</option>
            {TIPOS_NEGOCIO.map((t) => (
              <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Status:</label>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            style={{ padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}
          >
            <option value="todas">Todas ({empresas.length})</option>
            <option value="ativas">Somente Ativas</option>
            <option value="inativas">Somente Inativas</option>
          </select>
        </div>
      </div>

      {/* Grid de Cards de Empresas */}
      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          Carregando empresas cadastradas no Kytto...
        </div>
      ) : empresasFiltradas.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: '#64748b', background: '#fff', borderRadius: 10, border: '1px dashed #cbd5e1' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
          <h3 style={{ margin: '0 0 6px', color: '#1e293b' }}>Nenhuma empresa encontrada</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13 }}>Tente ajustar a busca ou cadastre uma nova empresa com isolamento multiempresa.</p>
          <button className="btn btn-primary btn-sm" onClick={abrirNovo} style={{ background: '#FF6B2C', borderColor: '#FF6B2C' }}>
            + Cadastrar Nova Empresa
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {empresasFiltradas.map((emp) => {
            const eAtiva = emp.id === empresaAtiva?.id
            const seg = TIPOS_NEGOCIO.find((t) => t.id === emp.tipoNegocio) || TIPOS_NEGOCIO[6]

            return (
              <div
                key={emp.id}
                className="card"
                style={{
                  padding: 20,
                  borderRadius: 12,
                  background: '#fff',
                  border: eAtiva ? '2px solid #FF6B2C' : '1px solid #e2e8f0',
                  boxShadow: eAtiva ? '0 4px 14px rgba(255,107,44,.14)' : '0 2px 6px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 14,
                  position: 'relative',
                  transition: 'transform .15s ease, box-shadow .15s ease',
                }}
              >
                {/* Header do Card */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 24 }}>{seg.icon}</span>
                      <div>
                        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1e293b' }}>
                          {emp.nomeFantasia || emp.nome}
                        </h2>
                        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                          {emp.razaoSocial && emp.razaoSocial !== emp.nome ? emp.razaoSocial : 'Razão Social Matriz'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {eAtiva && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#22c55e', color: '#fff' }}>
                          EM USO
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: emp.ativa !== false ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
                          color: emp.ativa !== false ? '#15803d' : '#b91c1c',
                        }}
                      >
                        {emp.ativa !== false ? 'ATIVA' : 'INATIVA'}
                      </span>
                    </div>
                  </div>

                  {/* Informações Fiscais e Cadastrais */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: 12, marginTop: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>CNPJ</span>
                      <strong style={{ color: '#334155', fontFamily: 'monospace' }}>{emp.cnpj || 'Não informado'}</strong>
                    </div>

                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Inscrição Estadual</span>
                      <strong style={{ color: '#334155' }}>{emp.inscricaoEstadual || 'Isento / Não inf.'}</strong>
                    </div>

                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Segmento</span>
                      <strong style={{ color: '#334155' }}>{seg.label}</strong>
                    </div>

                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Unidades / Lojas</span>
                      <strong style={{ color: '#334155' }}>{emp.totalLojas || 1} filial(is)</strong>
                    </div>
                  </div>

                  {/* Contato e Endereço */}
                  <div style={{ marginTop: 10, fontSize: 12, color: '#475569', display: 'grid', gap: 4 }}>
                    {emp.endereco && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#94a3b8' }}>📍</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={emp.endereco}>
                          {emp.endereco}
                        </span>
                      </div>
                    )}
                    {emp.telefone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#94a3b8' }}>📞</span>
                        <span>{emp.telefone}</span>
                      </div>
                    )}
                    {emp.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#94a3b8' }}>✉️</span>
                        <span>{emp.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rodapé de Ações do Card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => selecionarEmpresaAtiva(emp)}
                    style={{
                      background: eAtiva ? '#f1f5f9' : '#12283F',
                      color: eAtiva ? '#475569' : '#fff',
                      borderColor: eAtiva ? '#e2e8f0' : '#12283F',
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '6px 12px',
                    }}
                  >
                    {eAtiva ? '✓ Selecionada' : '⚡ Operar nesta'}
                  </button>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => abrirEditar(emp)}
                      style={{ fontSize: 12 }}
                      title="Editar dados da empresa"
                    >
                      ✏️ Editar
                    </button>
                    {emp.id !== 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => inativar(emp)}
                        style={{ fontSize: 12, color: emp.ativa !== false ? '#dc2626' : '#16a34a' }}
                        title={emp.ativa !== false ? 'Inativar empresa' : 'Reativar empresa'}
                      >
                        {emp.ativa !== false ? 'Inativar' : 'Reativar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Nova Empresa / Edição */}
      {modal && (
        <Modal
          title={modal.modo === 'novo' ? '🏢 Cadastrar Nova Empresa' : `✏️ Editar Empresa: ${modal.empresa?.nomeFantasia || modal.empresa?.nome}`}
          onClose={() => setModal(null)}
          width={740}
        >
          <div style={{ display: 'grid', gap: 16, paddingBottom: 16 }}>
            <div className="card" style={{ fontSize: 12, color: '#475569', background: 'rgba(255,107,44,.06)', border: '1px solid rgba(255,107,44,.18)', padding: 12, borderRadius: 8 }}>
              O Kytto garante <strong>isolamento multiempresa absoluto</strong>. A nova empresa terá cadastros mestres, catálogo, estoque, financeiro, regras fiscais (NFC-e/NFS-e) e usuários próprios e autônomos.
            </div>

            {/* SEÇÃO 1: Dados Jurídicos e Segmento */}
            <h3 style={{ margin: '8px 0 0', color: '#12283F', fontSize: 14, fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
              1. Identificação Jurídica & Segmento
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Nome Fantasia / Comercial *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: Barbearia Dino, Stallone Nutre Sport"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Razão Social Oficial *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: DINO BARBEARIA LTDA"
                  value={form.razaoSocial}
                  onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>CNPJ</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="form-control"
                  placeholder="00.000.000/0000-00"
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: mascaraCnpj(e.target.value) })}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Inscrição Estadual (IE)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: 14.229.191-9"
                  value={form.inscricaoEstadual}
                  onChange={(e) => setForm({ ...form, inscricaoEstadual: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Inscrição Municipal (IM)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: 060101"
                  value={form.inscricaoMunicipal}
                  onChange={(e) => setForm({ ...form, inscricaoMunicipal: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Segmento / Tipo de Negócio</label>
              <select
                className="form-control"
                value={form.tipoNegocio}
                onChange={(e) => setForm({ ...form, tipoNegocio: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}
              >
                {TIPOS_NEGOCIO.map((t) => (
                  <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>

            {/* SEÇÃO 2: Endereço */}
            <h3 style={{ margin: '12px 0 0', color: '#12283F', fontSize: 14, fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
              2. Endereço Fiscal & Operacional
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>CEP</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-control"
                    placeholder="78300-000"
                    value={form.enderecoCep}
                    onChange={(e) => {
                      const v = mascaraCep(e.target.value)
                      setForm({ ...form, enderecoCep: v })
                      if (v.replace(/\D/g, '').length === 8) buscarCepAutomatico(v)
                    }}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => buscarCepAutomatico(form.enderecoCep)}
                    disabled={buscandoCep}
                    title="Buscar dados do CEP"
                    style={{ padding: '4px 8px', fontSize: 11 }}
                  >
                    {buscandoCep ? '...' : '🔍'}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Logradouro / Rua / Avenida</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: Av. Brasil, Rua 19"
                  value={form.enderecoLogradouro}
                  onChange={(e) => setForm({ ...form, enderecoLogradouro: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Número</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: 500-W"
                  value={form.enderecoNumero}
                  onChange={(e) => setForm({ ...form, enderecoNumero: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 70px', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Complemento / Sala</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: Sala 02, Térreo"
                  value={form.enderecoComplemento}
                  onChange={(e) => setForm({ ...form, enderecoComplemento: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Bairro</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: Centro"
                  value={form.enderecoBairro}
                  onChange={(e) => setForm({ ...form, enderecoBairro: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Cidade</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Tangará da Serra"
                  value={form.enderecoCidade}
                  onChange={(e) => setForm({ ...form, enderecoCidade: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>UF</label>
                <input
                  type="text"
                  maxLength={2}
                  className="form-control"
                  placeholder="MT"
                  value={form.enderecoEstado}
                  onChange={(e) => setForm({ ...form, enderecoEstado: e.target.value.toUpperCase() })}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'center' }}
                />
              </div>
            </div>

            {/* SEÇÃO 3: Contatos */}
            <h3 style={{ margin: '12px 0 0', color: '#12283F', fontSize: 14, fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
              3. Contatos & Comunicação
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Telefone / WhatsApp</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="form-control"
                  placeholder="(65) 99999-9999"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: mascaraTelefone(e.target.value) })}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>E-mail Corporativo</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="contato@empresa.com.br"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Website / Link</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="https://kytto.com.br"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            {/* SEÇÃO 4: Configurações & Administrador (Apenas no cadastro novo) */}
            {modal.modo === 'novo' && (
              <>
                <h3 style={{ margin: '12px 0 0', color: '#12283F', fontSize: 14, fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
                  4. Unidade Matriz & Administrador Inicial (Opcional)
                </h3>

                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.criarLojaMatriz}
                      onChange={(e) => setForm({ ...form, criarLojaMatriz: e.target.checked })}
                    />
                    Criar unidade Matriz automaticamente para esta empresa
                  </label>

                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.permitirEstoqueNegativo}
                      onChange={(e) => setForm({ ...form, permitirEstoqueNegativo: e.target.checked })}
                    />
                    Permitir estoque negativo no PDV
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 4 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Nome do Administrador</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ex: Jhenyffer, Rodrigo"
                      value={form.administrador.nome}
                      onChange={(e) => setForm({ ...form, administrador: { ...form.administrador, nome: e.target.value } })}
                      style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>E-mail de Login</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="admin@empresa.com.br"
                      value={form.administrador.email}
                      onChange={(e) => setForm({ ...form, administrador: { ...form.administrador, email: e.target.value } })}
                      style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Senha Inicial</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Mínimo 6 caracteres"
                      value={form.administrador.senhaInicial}
                      onChange={(e) => setForm({ ...form, administrador: { ...form.administrador, senhaInicial: e.target.value } })}
                      style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Ações do Modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)} disabled={salvando}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={salvar}
                disabled={salvando}
                style={{ background: '#FF6B2C', borderColor: '#FF6B2C', fontWeight: 700 }}
              >
                {salvando ? 'Salvando dados...' : modal.modo === 'novo' ? 'Cadastrar Empresa' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

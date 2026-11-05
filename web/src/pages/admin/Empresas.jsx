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
  const [buscandoCnpjIa, setBuscandoCnpjIa] = useState(false)
  const [sugestaoIaCnpj, setSugestaoIaCnpj] = useState(null)

  // Modais de Diagnóstico IA e Ficha Cadastral
  const [modalDiagnostico, setModalDiagnostico] = useState(null) // dados do diagnostico
  const [loadingDiagnostico, setLoadingDiagnostico] = useState(false)
  const [modalHolding, setModalHolding] = useState(null)
  const [modalFicha, setModalFicha] = useState(null) // empresa para ficha cadastral

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
    setSugestaoIaCnpj(null)
    setModal({ modo: 'novo' })
  }

  const abrirEditar = (empresa) => {
    setSugestaoIaCnpj(null)
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

  // Consulta pública enriquecida por IA
  const consultarCnpjComIa = async () => {
    const digitos = String(form.cnpj || '').replace(/\D/g, '')
    if (digitos.length !== 14) {
      return toast('Informe os 14 dígitos do CNPJ para a IA consultar.', true)
    }
    setBuscandoCnpjIa(true)
    try {
      const res = await api.get(`/api/admin/empresas/consulta-cnpj/${digitos}`)
      if (res.ok && res.dados) {
        const d = res.dados
        setForm((prev) => ({
          ...prev,
          nome: d.nomeFantasia || prev.nome || d.razaoSocial,
          razaoSocial: d.razaoSocial || prev.razaoSocial,
          tipoNegocio: d.ia?.tipoNegocioSugerido || prev.tipoNegocio,
          inscricaoMunicipal: d.ia?.codigoServicoSugerido || prev.inscricaoMunicipal,
          enderecoLogradouro: d.endereco?.logradouro || prev.enderecoLogradouro,
          enderecoNumero: d.endereco?.numero || prev.enderecoNumero,
          enderecoComplemento: d.endereco?.complemento || prev.enderecoComplemento,
          enderecoBairro: d.endereco?.bairro || prev.enderecoBairro,
          enderecoCidade: d.endereco?.cidade || prev.enderecoCidade,
          enderecoEstado: d.endereco?.estado || prev.enderecoEstado,
          enderecoCep: mascaraCep(d.endereco?.cep || prev.enderecoCep),
          telefone: mascaraTelefone(d.contato?.telefone || prev.telefone),
          email: d.contato?.email || prev.email,
        }))
        setSugestaoIaCnpj(d.ia)
        toast('Dados preenchidos e enriquecidos com sucesso pela IA!')
      }
    } catch (err) {
      toast(err.message || 'Não foi possível consultar os dados públicos do CNPJ.', true)
    } finally {
      setBuscandoCnpjIa(false)
    }
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
      // silencioso
    } finally {
      setBuscandoCep(false)
    }
  }

  // Diagnóstico IA de uma Empresa específica
  const abrirDiagnosticoIa = async (empresa) => {
    setLoadingDiagnostico(true)
    setModalDiagnostico({ carregando: true, empresa })
    try {
      const res = await api.get(`/api/admin/empresas/${empresa.id}/diagnostico-ia`)
      setModalDiagnostico(res.diagnostico)
    } catch (err) {
      toast(err.message || 'Erro ao gerar diagnóstico IA da empresa.', true)
      setModalDiagnostico(null)
    } finally {
      setLoadingDiagnostico(false)
    }
  }

  // Diagnóstico Consolidado da Holding
  const abrirDiagnosticoHolding = async () => {
    setLoadingDiagnostico(true)
    try {
      const res = await api.get('/api/admin/empresas/diagnostico-holding')
      setModalHolding(res)
    } catch (err) {
      toast(err.message || 'Erro ao carregar diagnóstico da holding.', true)
    } finally {
      setLoadingDiagnostico(false)
    }
  }

  const salvar = async () => {
    if (!form.nome?.trim()) return toast('O Nome Fantasia é obrigatório.', true)
    if (!form.razaoSocial?.trim()) return toast('A Razão Social é obrigatória.', true)

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

  const kpisHolding = useMemo(() => {
    const total = empresas.length
    const ativas = empresas.filter(e => e.ativa !== false).length
    const totalLojas = empresas.reduce((acc, e) => acc + (e.totalLojas || 1), 0)
    return { total, ativas, totalLojas }
  }, [empresas])

  return (
    <div className="page" style={{ maxWidth: 1240, margin: '0 auto', paddingBottom: 60 }}>
      {/* Topo / Header com Barra de Gestão Executiva */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🏢</span>
            <h1 className="page-title" style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#12283F' }}>
              Gestão de Empresas & Multiempresa
            </h1>
          </div>
          <div style={{ marginTop: 6, color: 'var(--muted, #64748b)', fontSize: 13 }}>
            Cadastro completo e autônomo com inteligência artificial, isolamento contábil, fiscal e operacional.
            {empresaAtiva && (
              <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,107,44,.12)', color: '#FF6B2C', fontWeight: 700 }}>
                Ativa agora: {empresaAtiva.nomeFantasia || empresaAtiva.nome}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={carregar} disabled={loading} title="Recarregar lista">
            ↺ {loading ? 'Carregando...' : 'Atualizar'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={abrirDiagnosticoHolding} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🧠</span> Copilot Holding
          </button>
          <Link to="/admin/lojas" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            🏪 Unidades / Lojas
          </Link>
          <button className="btn btn-primary btn-sm" onClick={abrirNovo} style={{ background: '#FF6B2C', borderColor: '#FF6B2C', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>+</span> Nova Empresa
          </button>
        </div>
      </div>

      {/* Painel de Indicadores da Holding & IA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: '14px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, background: 'rgba(18,40,63,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            🏢
          </div>
          <div>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Empresas do Grupo</span>
            <strong style={{ fontSize: 18, color: '#12283F' }}>{kpisHolding.total} cadastradas</strong>
            <span style={{ fontSize: 11, color: '#16a34a', display: 'block' }}>{kpisHolding.ativas} ativas em produção</span>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, background: 'rgba(255,107,44,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            🏪
          </div>
          <div>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Unidades & Filiais</span>
            <strong style={{ fontSize: 18, color: '#FF6B2C' }}>{kpisHolding.totalLojas} operacionais</strong>
            <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Matrizes e pontos de venda</span>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, background: 'rgba(34,197,94,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            ⚡
          </div>
          <div>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Barramento A2</span>
            <strong style={{ fontSize: 18, color: '#15803d' }}>100% Síncrono</strong>
            <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Eventos internos sem atraso</span>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, background: 'rgba(99,102,241,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            🤖
          </div>
          <div>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>IA & Automação</span>
            <strong style={{ fontSize: 18, color: '#4f46e5' }}>Auditado</strong>
            <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Diagnóstico & consulta ativos</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(370px, 1fr))', gap: 16 }}>
          {empresasFiltradas.map((emp) => {
            const eAtiva = emp.id === empresaAtiva?.id
            const seg = TIPOS_NEGOCIO.find((t) => t.id === emp.tipoNegocio) || TIPOS_NEGOCIO[6]

            return (
              <div
                key={emp.id}
                className="card"
                style={{
                  padding: 18,
                  borderRadius: 12,
                  background: '#fff',
                  border: eAtiva ? '2px solid #FF6B2C' : '1px solid #e2e8f0',
                  boxShadow: eAtiva ? '0 4px 14px rgba(255,107,44,.14)' : '0 2px 6px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                  position: 'relative',
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
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: '#22c55e', color: '#fff' }}>
                          EM USO
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px', fontSize: 12, marginTop: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
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
                  <div style={{ marginTop: 8, fontSize: 12, color: '#475569', display: 'grid', gap: 3 }}>
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

                {/* Ações Especiais de IA e Documentos */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => abrirDiagnosticoIa(emp)}
                    style={{ flex: 1, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: '#f8fafc' }}
                    title="Análise de conformidade fiscal, operacional e atendimento por IA"
                  >
                    <span>🧠</span> Diagnóstico IA
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setModalFicha(emp)}
                    style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                    title="Visualizar e imprimir ficha cadastral oficial da empresa"
                  >
                    <span>📋</span> Ficha
                  </button>
                </div>

                {/* Rodapé de Ações do Card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
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
                      padding: '5px 12px',
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

      {/* Modal de Nova Empresa / Edição com IA de CNPJ */}
      {modal && (
        <Modal
          title={modal.modo === 'novo' ? '🏢 Cadastrar Nova Empresa com IA' : `✏️ Editar Empresa: ${modal.empresa?.nomeFantasia || modal.empresa?.nome}`}
          onClose={() => setModal(null)}
          width={760}
        >
          <div style={{ display: 'grid', gap: 14, paddingBottom: 16 }}>
            {/* Bloco de Ajuda IA */}
            <div className="card" style={{ fontSize: 12, color: '#334155', background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.2)', padding: '10px 14px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <strong>Assistente de Cadastro por IA:</strong> Digite o CNPJ e clique no botão para auto-preencher razão social, endereço e segmento automaticamente!
              </div>
            </div>

            {/* SEÇÃO 1: Identificação Jurídica & Segmento */}
            <h3 style={{ margin: '6px 0 0', color: '#12283F', fontSize: 14, fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
              1. Identificação Jurídica & Inteligência Fiscal
            </h3>

            {/* CNPJ com botão de Auto-Preenchimento por IA */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr auto 1fr 1fr', gap: 10, alignItems: 'flex-end' }}>
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
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={consultarCnpjComIa}
                  disabled={buscandoCnpjIa}
                  style={{ background: '#4f46e5', borderColor: '#4f46e5', color: '#fff', fontSize: 12, fontWeight: 700, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
                  title="Consultar dados públicos do CNPJ e enriquecer com IA"
                >
                  <span>🤖</span> {buscandoCnpjIa ? 'Consultando IA...' : 'Auto-preencher por IA'}
                </button>
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

            {/* Alerta de Recomendação da IA quando CNPJ for consultado */}
            {sugestaoIaCnpj && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#166534' }}>
                <strong>Recomendação da IA:</strong> {sugestaoIaCnpj.recomendacaoIa}
              </div>
            )}

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
            <h3 style={{ margin: '8px 0 0', color: '#12283F', fontSize: 14, fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
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
            <h3 style={{ margin: '8px 0 0', color: '#12283F', fontSize: 14, fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
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

            {/* SEÇÃO 4: Unidade Matriz & Administrador Inicial */}
            {modal.modo === 'novo' && (
              <>
                <h3 style={{ margin: '8px 0 0', color: '#12283F', fontSize: 14, fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
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

      {/* Modal de Diagnóstico IA da Empresa */}
      {modalDiagnostico && (
        <Modal
          title={`🧠 Diagnóstico de Inteligência Artificial: ${modalDiagnostico.nomeFantasia || 'Empresa'}`}
          onClose={() => setModalDiagnostico(null)}
          width={780}
        >
          {loadingDiagnostico ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🧠</div>
              A IA está analisando cadastros, notas fiscais, lojas, estoques e automações...
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16, paddingBottom: 16 }}>
              {/* Score Geral com Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Score de Prontidão Operacional & Fiscal</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 36, fontWeight: 900, color: modalDiagnostico.score?.cor || '#15803d' }}>
                      {modalDiagnostico.score?.total}%
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: `${modalDiagnostico.score?.cor}18`, color: modalDiagnostico.score?.cor }}>
                      {modalDiagnostico.score?.nivel}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right', fontSize: 12, color: '#475569' }}>
                  <div><strong>Cadastral:</strong> {modalDiagnostico.score?.cadastral}/25 pts</div>
                  <div><strong>Fiscal:</strong> {modalDiagnostico.score?.fiscal}/25 pts</div>
                  <div><strong>Operacional:</strong> {modalDiagnostico.score?.operacional}/25 pts</div>
                  <div><strong>IA & Atendimento:</strong> {modalDiagnostico.score?.ia}/25 pts</div>
                </div>
              </div>

              {/* Status dos Pilares */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="card" style={{ padding: 14, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Certificado Digital & mTLS</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginTop: 4 }}>
                    {modalDiagnostico.status?.certificadoDigital}
                  </div>
                </div>

                <div className="card" style={{ padding: 14, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Emissão de Documentos Fiscais</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginTop: 4 }}>
                    {modalDiagnostico.status?.documentosFiscais}
                  </div>
                </div>

                <div className="card" style={{ padding: 14, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Atendente IA & WhatsApp Antiban</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginTop: 4 }}>
                    {modalDiagnostico.status?.atendenteIa}
                  </div>
                </div>

                <div className="card" style={{ padding: 14, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Barramento Multiempresa A2</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginTop: 4 }}>
                    {modalDiagnostico.status?.barramentoA2}
                  </div>
                </div>
              </div>

              {/* Insights e Recomendações Estratégicas da IA */}
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#12283F' }}>
                  Insights & Recomendações Estratégicas da IA
                </h4>
                <div style={{ display: 'grid', gap: 8 }}>
                  {modalDiagnostico.recomendacoes?.map((rec, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: rec.tipo === 'sucesso' ? '#f0fdf4' : rec.tipo === 'alerta' ? '#fef2f2' : '#f0f9ff',
                        border: `1px solid ${rec.tipo === 'sucesso' ? '#bbf7d0' : rec.tipo === 'alerta' ? '#fecaca' : '#bae6fd'}`,
                      }}
                    >
                      <strong style={{ fontSize: 12, color: rec.tipo === 'sucesso' ? '#166534' : rec.tipo === 'alerta' ? '#991b1b' : '#0369a1' }}>
                        {rec.titulo}
                      </strong>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#334155' }}>
                        {rec.texto}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botão de Fechar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalDiagnostico(null)}>
                  Fechar Diagnóstico
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Modal de Diagnóstico da Holding Kytto */}
      {modalHolding && (
        <Modal
          title="🏢 Copilot IA: Diagnóstico Consolidado da Holding Kytto"
          onClose={() => setModalHolding(null)}
          width={760}
        >
          <div style={{ display: 'grid', gap: 16, paddingBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#12283F' }}>{modalHolding.holding}</h3>
                <span style={{ fontSize: 12, color: '#64748b' }}>Consolidado de Governança, Isolamento Multi-Tenant e Automações</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Score Médio do Grupo</span>
                <strong style={{ fontSize: 28, color: '#15803d' }}>{modalHolding.scoreMedioGrupo}%</strong>
              </div>
            </div>

            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#12283F' }}>
                Empresas Ativas no Ecossistema
              </h4>
              <div style={{ display: 'grid', gap: 8 }}>
                {modalHolding.empresas?.map((emp) => (
                  <div key={emp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div>
                      <strong style={{ fontSize: 13, color: '#1e293b' }}>{emp.nome}</strong>
                      <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>CNPJ: {emp.cnpj} · Segmento: {emp.tipoNegocio}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#f1f5f9', color: '#334155' }}>
                      {emp.lojas} loja(s)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#12283F' }}>
                Diretrizes de Inteligência Artificial da Holding
              </h4>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#334155', display: 'grid', gap: 6 }}>
                {modalHolding.insightsIa?.map((ins, idx) => (
                  <li key={idx}>{ins}</li>
                ))}
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModalHolding(null)}>
                Concluir Leitura
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Ficha Cadastral Oficial da Empresa */}
      {modalFicha && (
        <Modal
          title={`📋 Ficha Cadastral Oficial: ${modalFicha.nomeFantasia || modalFicha.nome}`}
          onClose={() => setModalFicha(null)}
          width={720}
        >
          <div style={{ display: 'grid', gap: 14, paddingBottom: 16 }}>
            <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: 8 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#12283F' }}>{modalFicha.razaoSocial || modalFicha.nome}</h3>
                  <span style={{ fontSize: 13, color: '#64748b' }}>Nome Fantasia: {modalFicha.nomeFantasia || modalFicha.nome}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: '#22c55e', color: '#fff' }}>
                  ATIVA
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                <div><strong>CNPJ:</strong> {modalFicha.cnpj || 'Não informado'}</div>
                <div><strong>Inscrição Estadual:</strong> {modalFicha.inscricaoEstadual || 'Isento'}</div>
                <div><strong>Inscrição Municipal:</strong> {modalFicha.inscricaoMunicipal || 'Isento'}</div>
                <div><strong>Segmento:</strong> {modalFicha.tipoNegocio}</div>
                <div><strong>Telefone:</strong> {modalFicha.telefone || 'Não informado'}</div>
                <div><strong>E-mail:</strong> {modalFicha.email || 'Não informado'}</div>
              </div>

              <div style={{ fontSize: 12, borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                <strong>Endereço Operacional:</strong> {modalFicha.endereco || `${modalFicha.enderecoLogradouro || ''}, ${modalFicha.enderecoNumero || ''} - ${modalFicha.enderecoBairro || ''}, ${modalFicha.enderecoCidade || 'Tangará da Serra'}/${modalFicha.enderecoEstado || 'MT'}`}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                🖨️ Imprimir Ficha
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setModalFicha(null)} style={{ background: '#FF6B2C', borderColor: '#FF6B2C' }}>
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

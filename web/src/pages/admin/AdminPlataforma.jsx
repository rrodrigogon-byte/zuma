import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const MODULOS = [
  { id: 'pdv', label: 'PDV', grupo: 'Operação' },
  { id: 'mesas', label: 'Mesas e comandas', grupo: 'Operação' },
  { id: 'kds', label: 'Cozinha / KDS', grupo: 'Operação' },
  { id: 'cardapio', label: 'Cardápio', grupo: 'Operação' },
  { id: 'pagamentos', label: 'Pagamentos', grupo: 'Financeiro' },
  { id: 'financeiro', label: 'Financeiro', grupo: 'Financeiro' },
  { id: 'fiscal', label: 'Fiscal', grupo: 'Financeiro' },
  { id: 'estoque', label: 'Estoque', grupo: 'Gestão' },
  { id: 'compras', label: 'Compras e fornecedores', grupo: 'Gestão' },
  { id: 'crm', label: 'CRM', grupo: 'Gestão' },
  { id: 'usuarios', label: 'Usuários', grupo: 'Gestão' },
  { id: 'socios', label: 'Sócios e fidelidade', grupo: 'Gestão' },
  { id: 'barbearia', label: 'Barbearia e salão', grupo: 'Especializados' },
  { id: 'supermercado', label: 'Supermercado', grupo: 'Especializados' },
  { id: 'loja_moda', label: 'Loja de moda', grupo: 'Especializados' },
  { id: 'oficina', label: 'Oficina mecânica', grupo: 'Especializados' },
  { id: 'agropecuaria', label: 'Agropecuária e pet', grupo: 'Especializados' },
  { id: 'varejo', label: 'Varejo geral', grupo: 'Especializados' },
  { id: 'ecommerce', label: 'E-commerce', grupo: 'Canais' },
  { id: 'delivery', label: 'Delivery e fidelidade', grupo: 'Canais' },
  { id: 'torneios', label: 'Torneios', grupo: 'Clube' },
  { id: 'quadras', label: 'Quadras', grupo: 'Clube' },
  { id: 'pontos', label: 'Pontos e Elo', grupo: 'Clube' },
  { id: 'ligas', label: 'Ligas de ranking', grupo: 'Clube' },
]

const MODULOS_PADRAO_BARBEARIA = ['pdv', 'mesas', 'kds', 'cardapio', 'pagamentos', 'financeiro', 'fiscal', 'estoque', 'compras', 'usuarios', 'barbearia']

const EMPTY_EMPRESA = {
  nome: 'Barbearia do Dino',
  nomeFantasia: 'Barbearia do Dino',
  cnpj: '',
  inscricaoEstadual: '',
  endereco: '',
  email: '',
  telefone: '',
  plano: 'standard',
  permitirEstoqueNegativo: false,
  modulos: MODULOS_PADRAO_BARBEARIA,
  administrador: { nome: '', email: '', senhaInicial: '' },
}

function campoLabel(label, value, onChange, props = {}) {
  return (
    <label className="form-group">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
  )
}

function ModulosEditor({ value, onChange, compact = false }) {
  const ativos = new Set(Array.isArray(value) ? value : [])
  const grupos = [...new Set(MODULOS.map((modulo) => modulo.grupo))]
  return (
    <div style={{ display: 'grid', gap: compact ? 8 : 14 }}>
      {grupos.map((grupo) => (
        <div key={grupo}>
          <div style={{ color: '#12283F', fontWeight: 800, fontSize: compact ? 11 : 12, marginBottom: 6 }}>{grupo}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6 }}>
            {MODULOS.filter((modulo) => modulo.grupo === grupo).map((modulo) => (
              <label key={modulo.id} style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12, color: 'var(--muted)', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 7, background: ativos.has(modulo.id) ? 'rgba(255,107,44,.08)' : 'var(--surface-2)' }}>
                <input
                  type="checkbox"
                  checked={ativos.has(modulo.id)}
                  onChange={(event) => {
                    const proximo = new Set(ativos)
                    if (event.target.checked) proximo.add(modulo.id)
                    else proximo.delete(modulo.id)
                    onChange([...proximo])
                  }}
                />
                {modulo.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AdminPlataforma() {
  const { toast } = useToast()
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(true)
  const [empresaForm, setEmpresaForm] = useState(EMPTY_EMPRESA)
  const [expanded, setExpanded] = useState('')
  const [drafts, setDrafts] = useState({})

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const resposta = await api.get('/api/admin/plataforma/empresas')
      const lista = Array.isArray(resposta) ? resposta : (resposta.empresas || [])
      setEmpresas(lista)
      setDrafts(Object.fromEntries(lista.map((empresa) => [empresa.id, {
        modulos: Array.isArray(empresa.modulos) ? empresa.modulos : [],
        plano: empresa.plano || 'standard',
        statusOnboarding: empresa.statusOnboarding || 'configuracao',
        ativa: empresa.ativa !== false,
      }])))
    } catch (error) {
      toast(error.message || 'Não foi possível carregar as empresas da plataforma.', true)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { carregar() }, [carregar])

  const atualizarDraft = (empresaId, campo, valor) => {
    setDrafts((atual) => ({ ...atual, [empresaId]: { ...atual[empresaId], [campo]: valor } }))
  }

  const salvarEmpresa = async (empresa) => {
    const draft = drafts[empresa.id]
    if (!draft) return
    setSavingId(empresa.id)
    try {
      await api.patch(`/api/admin/plataforma/empresas/${empresa.id}`, draft)
      toast(`Módulos de ${empresa.nomeFantasia || empresa.nome} atualizados.`)
      await carregar()
    } catch (error) {
      toast(error.message || 'Não foi possível atualizar a empresa.', true)
    } finally {
      setSavingId('')
    }
  }

  const criarEmpresa = async (event) => {
    event.preventDefault()
    const administrador = empresaForm.administrador
    if (!empresaForm.nome || !administrador.nome || !administrador.email || String(administrador.senhaInicial).length < 8) {
      toast('Informe o nome da empresa e os dados do gestor inicial. A senha deve ter ao menos 8 caracteres.', true)
      return
    }
    setCreating(true)
    try {
      const resposta = await api.post('/api/admin/plataforma/empresas', empresaForm)
      toast(`Empresa ${resposta?.empresa?.nomeFantasia || empresaForm.nome} criada com isolamento próprio.`)
      setEmpresaForm({ ...EMPTY_EMPRESA, administrador: { ...EMPTY_EMPRESA.administrador } })
      setShowCreate(false)
      setExpanded(resposta?.empresa?.id || '')
      await carregar()
    } catch (error) {
      toast(error.message || 'Não foi possível criar a empresa.', true)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div className="badge" style={{ color: '#FF6B2C', background: 'rgba(255,107,44,.12)', marginBottom: 8 }}>ADMINISTRAÇÃO GERAL</div>
          <h1 className="page-title" style={{ margin: 0 }}>🏢 Empresas e Módulos</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, maxWidth: 700, lineHeight: 1.55, margin: '8px 0 0' }}>
            Painel exclusivo do administrador da plataforma. Crie tenants, defina o plano contratado e libere somente os módulos que cada gestor poderá utilizar.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={carregar}>↺ Atualizar</button>
      </div>

      <div className="card" style={{ marginBottom: 18, border: '1px solid rgba(255,107,44,.25)', background: 'rgba(255,107,44,.05)' }}>
        <strong style={{ color: '#FF6B2C', fontSize: 13 }}>Separação de acesso ativa.</strong>
        <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>Gestores de empresa não acessam esta tela e não podem alterar plano, módulos ou outras empresas. O backend valida essa regra em cada operação.</span>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, color: '#12283F', fontSize: 18 }}>Nova empresa</h2>
            <div style={{ marginTop: 4, color: 'var(--muted)', fontSize: 12 }}>A criação exige um gestor inicial e uma senha individual. Nenhuma senha é exibida depois do cadastro.</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'Fechar formulário' : 'Abrir formulário'}</button>
        </div>
        {showCreate && (
          <form onSubmit={criarEmpresa} style={{ display: 'grid', gap: 14, marginTop: 18 }}>
            <div className="form-row">
              {campoLabel('Razão social *', empresaForm.nome, (value) => setEmpresaForm({ ...empresaForm, nome: value }))}
              {campoLabel('Nome fantasia', empresaForm.nomeFantasia, (value) => setEmpresaForm({ ...empresaForm, nomeFantasia: value }))}
            </div>
            <div className="form-row">
              {campoLabel('CNPJ', empresaForm.cnpj, (value) => setEmpresaForm({ ...empresaForm, cnpj: value }), { inputMode: 'numeric' })}
              {campoLabel('Plano', empresaForm.plano, (value) => setEmpresaForm({ ...empresaForm, plano: value }))}
            </div>
            <div className="form-row">
              {campoLabel('E-mail corporativo', empresaForm.email, (value) => setEmpresaForm({ ...empresaForm, email: value }), { type: 'email' })}
              {campoLabel('Telefone', empresaForm.telefone, (value) => setEmpresaForm({ ...empresaForm, telefone: value }))}
            </div>
            {campoLabel('Endereço fiscal', empresaForm.endereco, (value) => setEmpresaForm({ ...empresaForm, endereco: value }))}
            <h3 style={{ margin: '4px 0 0', color: '#12283F', fontSize: 15 }}>Gestor inicial da empresa</h3>
            <div className="form-row">
              {campoLabel('Nome completo *', empresaForm.administrador.nome, (value) => setEmpresaForm({ ...empresaForm, administrador: { ...empresaForm.administrador, nome: value } }))}
              {campoLabel('E-mail de acesso *', empresaForm.administrador.email, (value) => setEmpresaForm({ ...empresaForm, administrador: { ...empresaForm.administrador, email: value } }), { type: 'email' })}
            </div>
            {campoLabel('Senha inicial *', empresaForm.administrador.senhaInicial, (value) => setEmpresaForm({ ...empresaForm, administrador: { ...empresaForm.administrador, senhaInicial: value } }), { type: 'password', minLength: 8, autoComplete: 'new-password' })}
            <div>
              <h3 style={{ margin: '4px 0 8px', color: '#12283F', fontSize: 15 }}>Módulos contratados</h3>
              <ModulosEditor value={empresaForm.modulos} onChange={(modulos) => setEmpresaForm({ ...empresaForm, modulos })} />
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--muted)' }}><input type="checkbox" checked={empresaForm.permitirEstoqueNegativo} onChange={(event) => setEmpresaForm({ ...empresaForm, permitirEstoqueNegativo: event.target.checked })} />Permitir estoque negativo</label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn btn-primary" disabled={creating}>{creating ? 'Criando empresa...' : 'Criar empresa e gestor'}</button></div>
          </form>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 style={{ margin: 0, color: '#12283F', fontSize: 18 }}>Empresas cadastradas</h2>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>{empresas.length} tenant{empresas.length === 1 ? '' : 's'}</span>
      </div>
      {loading && <div className="card">Carregando empresas...</div>}
      {!loading && empresas.length === 0 && <div className="card" style={{ color: 'var(--muted)' }}>Nenhuma empresa cadastrada.</div>}
      {!loading && empresas.map((empresa) => {
        const draft = drafts[empresa.id] || { modulos: empresa.modulos || [], plano: empresa.plano || 'standard', statusOnboarding: empresa.statusOnboarding || 'configuracao', ativa: empresa.ativa !== false }
        const isOpen = expanded === empresa.id
        return (
          <div className="card" key={empresa.id} style={{ marginBottom: 12, border: isOpen ? '1px solid rgba(255,107,44,.35)' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><strong style={{ color: '#12283F', fontSize: 15 }}>{empresa.nomeFantasia || empresa.nome}</strong><span className="badge" style={{ color: empresa.ativa === false ? '#B91C1C' : '#16803C', background: empresa.ativa === false ? '#FEE2E2' : '#DCFCE7' }}>{empresa.ativa === false ? 'inativa' : 'ativa'}</span></div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>{empresa.nome} · plano {empresa.plano || 'standard'} · {Array.isArray(empresa.modulos) ? empresa.modulos.length : 0} módulos liberados</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setExpanded(isOpen ? '' : empresa.id)}>{isOpen ? 'Fechar módulos' : 'Gerenciar módulos'}</button>
            </div>
            {isOpen && (
              <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 16, display: 'grid', gap: 14 }}>
                <div className="form-row">
                  <label className="form-group"><span>Plano contratado</span><input value={draft.plano} onChange={(event) => atualizarDraft(empresa.id, 'plano', event.target.value)} /></label>
                  <label className="form-group"><span>Status do onboarding</span><select value={draft.statusOnboarding} onChange={(event) => atualizarDraft(empresa.id, 'statusOnboarding', event.target.value)}><option value="rascunho">Rascunho</option><option value="configuracao">Em configuração</option><option value="pronta">Pronta</option></select></label>
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--muted)' }}><input type="checkbox" checked={draft.ativa} onChange={(event) => atualizarDraft(empresa.id, 'ativa', event.target.checked)} />Empresa ativa</label>
                <ModulosEditor value={draft.modulos} onChange={(modulos) => atualizarDraft(empresa.id, 'modulos', modulos)} compact />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-primary btn-sm" onClick={() => salvarEmpresa(empresa)} disabled={savingId === empresa.id}>{savingId === empresa.id ? 'Salvando...' : 'Salvar plano e módulos'}</button></div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}


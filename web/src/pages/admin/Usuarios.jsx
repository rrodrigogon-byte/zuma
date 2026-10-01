import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'

function unique(values) { return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR')) }

export default function Usuarios() {
  const [accounts, setAccounts] = useState([])
  const [complete, setComplete] = useState(false)
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 50

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/api/admin/usuarios-diretorio')
      setAccounts(Array.isArray(response.usuarios) ? response.usuarios : [])
      setComplete(response.completo === true)
      setSources(Array.isArray(response.fontes) ? response.fontes : [])
    } catch (reason) {
      setAccounts([])
      setError(reason?.message || 'Não foi possível carregar o diretório.')
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const companies = useMemo(() => unique(accounts.map(item => item.empresaNome)), [accounts])
  const roles = useMemo(() => unique(accounts.flatMap(item => (item.vinculos || []).map(binding => binding.codigo))), [accounts])
  const filtered = useMemo(() => accounts.filter(item => {
    const text = `${item.nome} ${item.email}`.toLocaleLowerCase('pt-BR')
    return (!query || text.includes(query.toLocaleLowerCase('pt-BR').trim()))
      && (!company || item.empresaNome === company)
      && (!role || (item.vinculos || []).some(binding => binding.codigo === role))
      && (!status || (item.ativo ? 'ativo' : 'inativo') === status)
      && (!source || item.origem === source)
  }), [accounts, query, company, role, status, source])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize)
  const change = setter => event => { setter(event.target.value); setPage(0) }

  return (
    <main className="page" style={{ maxWidth: '100%', minWidth: 0 }}>
      <header style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Usuários por empresa</h1>
          <p style={{ color: 'var(--muted)' }}>Diretório de leitura das contas do painel e do Commerce. Perfis e permissões são separados por origem; contas com o mesmo e-mail não são mescladas.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>Atualizar</button>
      </header>
      {error && <div role="alert" style={{ color: '#e05c5c', marginBottom: 16 }}>{error}</div>}
      {!loading && !error && !complete && <div role="status" style={{ marginBottom: 16 }}>O Commerce Core está desativado. Apenas contas legadas foram carregadas; esta lista não é completa.</div>}
      {!loading && !error && <p role="status" style={{ color: 'var(--muted)' }}><strong>{accounts.length}</strong> contas visíveis no seu escopo; <strong>{filtered.length}</strong> após os filtros. Fontes: {sources.join(' e ') || 'nenhuma'}.</p>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <label>Nome ou e-mail<br /><input aria-label="Buscar usuário por nome ou e-mail" value={query} onChange={change(setQuery)} placeholder="Buscar usuário" /></label>
        <label>Empresa<br /><select value={company} onChange={change(setCompany)}><option value="">Todas as empresas autorizadas</option>{companies.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Papel<br /><select value={role} onChange={change(setRole)}><option value="">Todos</option>{roles.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Estado<br /><select value={status} onChange={change(setStatus)}><option value="">Todos</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select></label>
        <label>Origem<br /><select value={source} onChange={change(setSource)}><option value="">Todas</option><option value="legado">Painel</option><option value="commerce">Commerce</option></select></label>
      </div>
      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        {loading ? <p role="status">Carregando usuários…</p> : !error && filtered.length === 0 ? <p>Nenhuma conta encontrada neste escopo e filtro.</p> : !error && (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 850 }}>
            <thead><tr>{['Empresa', 'Nome', 'E-mail', 'Origem', 'Papel e unidade', 'Permissões Commerce', 'Estado'].map(label => <th key={label} scope="col" style={{ textAlign: 'left', padding: 10 }}>{label}</th>)}</tr></thead>
            <tbody>{visible.map(item => <tr key={item.key} style={{ borderTop: '1px solid var(--line)' }}>
              <td style={{ padding: 10 }}>{item.empresaNome || 'Não atribuída'}</td>
              <td style={{ padding: 10 }}>{item.nome}</td>
              <td style={{ padding: 10 }}>{item.email}</td>
              <td style={{ padding: 10 }}>{item.origem === 'commerce' ? 'Commerce' : 'Painel legado'}</td>
              <td style={{ padding: 10 }}>{item.vinculos?.length ? item.vinculos.map((binding, index) => <div key={`${binding.codigo}:${binding.lojaId || 'empresa'}:${index}`}>{binding.nome || binding.codigo} · {binding.lojaNome || (binding.lojaId ? 'Unidade selecionada' : 'Empresa inteira')}{!binding.ativo ? ' (vínculo inativo)' : ''}</div>) : 'Sem papel atribuído'}</td>
              <td style={{ padding: 10, maxWidth: 300, overflowWrap: 'anywhere' }}>{item.origem === 'legado' ? 'Perfil legado; permissões SQL não aplicáveis' : item.permissoes?.length ? item.permissoes.join(', ') : 'Sem permissão efetiva'}</td>
              <td style={{ padding: 10 }}>{!item.ativo ? 'Inativo' : item.acessoAtivo ? 'Ativo' : 'Ativo, sem vínculo Commerce'}</td>
            </tr>)}</tbody>
          </table>
        )}
      </div>
      {!loading && !error && filtered.length > pageSize && <nav aria-label="Páginas de usuários" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 15 }}>
        <button type="button" className="btn btn-secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Anterior</button>
        <span>Página {page + 1} de {pages}</span>
        <button type="button" className="btn btn-secondary" disabled={page + 1 >= pages} onClick={() => setPage(value => value + 1)}>Próxima</button>
      </nav>}
      <p style={{ marginTop: 20, color: 'var(--muted)' }}>Para alterar vínculos Commerce, utilize <Link to="/admin/ecommerce?tab=usuarios">Gestão de acessos Commerce</Link> conforme seu papel. O diretório não cria, exclui nem mescla contas.</p>
    </main>
  )
}

import { useState, useEffect, useMemo } from 'react'
import { api, asArray, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'
import { useAuth } from '../../lib/auth'

function exportCSV(itens) {
  const headers = ['ID', 'Nome', 'Categoria', 'Setor', 'Preço', 'Disponível', 'Cozinha']
  const rows = itens.map(i => [
    i.id, i.nome, i.cat, i.setor || 'bar',
    String(i.preco), i.indisponivel ? 'Não' : 'Sim', i.cozinha ? 'Sim' : 'Não',
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }))
  a.download = `cardapio_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 10, padding: '14px 18px', flex: 1, minWidth: 110,
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color || 'var(--cream)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

const CATEGORIAS = ['Bebidas', 'Porções', 'Espetos', 'Burgers']
const SETORES = ['bar', 'cozinha', 'chapa']

const EMPTY_FORM = {
  nome: '',
  marca: '',
  tipo: '',
  embalagem: '',
  volumeMl: '',
  subcategoria: 'Bebidas',
  unidade: 'UN',
  semAlcool: false,
  precoPendente: false,
  emoji: '',
  cat: 'Bebidas',
  preco: '',
  setor: 'bar',
  cozinha: false,
  indisponivel: false,
  modificadorGrupoIds: [],
}

// Preview do PDV — simula como o cardápio aparece na tela do atendente
function PreviewPDV({ itens }) {
  const grouped = CATEGORIAS.reduce((acc, cat) => {
    const lista = itens.filter(i => i.cat === cat && !i.indisponivel)
    if (lista.length) acc[cat] = lista
    return acc
  }, {})

  return (
    <div style={{
      background: '#12283F',
      borderRadius: 10,
      padding: 16,
      maxHeight: 420,
      overflowY: 'auto',
      fontSize: 13,
      border: '1px solid #12283F',
    }}>
      <div style={{ color: '#FF9B72', fontWeight: 700, fontSize: 14, marginBottom: 12, letterSpacing: 1 }}>
        📋 PREVIEW — PDV / COMANDA
      </div>
      {Object.entries(grouped).map(([cat, lista]) => (
        <div key={cat} style={{ marginBottom: 14 }}>
          <div style={{
            color: '#FF6B2C',
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            borderBottom: '1px solid #12283F',
            paddingBottom: 4,
            marginBottom: 6,
          }}>
            {cat}
          </div>
          {lista.map(item => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 0',
                borderBottom: '1px solid rgba(255,255,255,.05)',
              }}
            >
              <span style={{ color: '#FFF4EC' }}>
                {item.emoji ? item.emoji + ' ' : ''}{item.nome}
              </span>
              <span style={{ color: '#FF6B2C', fontWeight: 700, marginLeft: 12, whiteSpace: 'nowrap' }}>
                {fmtR(item.preco)}
              </span>
            </div>
          ))}
        </div>
      ))}
      {Object.keys(grouped).length === 0 && (
        <p style={{ color: 'var(--muted)', textAlign: 'center' }}>Nenhum item disponível.</p>
      )}
    </div>
  )
}

export default function Cardapio() {
  const { toast } = useToast()
  const { isPlatformAdmin } = useAuth()
  const [itens, setItens] = useState([])
  const [gruposModificadores, setGruposModificadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [novoForm, setNovoForm] = useState({ ...EMPTY_FORM })
  const [novoCategoria, setNovoCategoria] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [busca, setBusca]           = useState('')
  const [filtroCat, setFiltroCat]   = useState('Todas')
  const [filtroDisp, setFiltroDisp] = useState('todos') // 'todos'|'disponiveis'|'indisponiveis'
  const [replicando, setReplicando] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([api.get('/api/admin/cardapio'), api.get('/api/admin/modificadores/grupos')])
      .then(([cardapio, modificadores]) => { setItens(asArray(cardapio, ['itens', 'produtos', 'cardapio'])); setGruposModificadores(asArray(modificadores, ['grupos'])) })
      .catch(() => toast('Erro ao carregar cardápio', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  // KPIs
  const kpis = useMemo(() => ({
    total:        itens.length,
    disponiveis:  itens.filter(i => !i.indisponivel).length,
    bar:          itens.filter(i => i.setor === 'bar').length,
    cozinha:      itens.filter(i => i.setor === 'cozinha').length,
    chapa:        itens.filter(i => i.setor === 'chapa').length,
    precoMedio:   itens.length ? (itens.reduce((s, i) => s + Number(i.preco || 0), 0) / itens.length) : 0,
  }), [itens])

  // Itens filtrados por busca/categoria/disponibilidade
  const itensFiltrados = useMemo(() => {
    const q = busca.toLowerCase().trim()
    return itens.filter(i => {
      if (filtroCat !== 'Todas' && i.cat !== filtroCat) return false
      if (filtroDisp === 'disponiveis' && i.indisponivel) return false
      if (filtroDisp === 'indisponiveis' && !i.indisponivel) return false
      if (q && !i.nome.toLowerCase().includes(q)) return false
      return true
    })
  }, [itens, busca, filtroCat, filtroDisp])

  // Itens agrupados por categoria, respeitando campo ordem
  const grouped = useMemo(() => CATEGORIAS.reduce((acc, cat) => {
    acc[cat] = itensFiltrados
      .filter(i => i.cat === cat)
      .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999))
    return acc
  }, {}), [itensFiltrados])

  const handleToggle = async (item, campo) => {
    try {
      await api.patch(`/api/admin/cardapio/${item.id}`, { [campo]: !item[campo] })
      load()
    } catch {
      toast('Erro ao atualizar', 'error')
    }
  }

  const handleDelete = async (item) => {
    if (!confirm(`Excluir "${item.nome}"?`)) return
    try {
      await api.delete(`/api/admin/cardapio/${item.id}`)
      toast('Item excluído', 'success')
      load()
    } catch {
      toast('Erro ao excluir', 'error')
    }
  }

  const handleMover = async (item, direcao) => {
    // direcao: -1 = subir, +1 = descer
    const lista = grouped[item.cat]
    const idx = lista.findIndex(i => i.id === item.id)
    const outro = lista[idx + direcao]
    if (!outro) return
    const ordemA = item.ordem ?? idx
    const ordemB = outro.ordem ?? (idx + direcao)
    try {
      await Promise.all([
        api.patch(`/api/admin/cardapio/${item.id}`, { ordem: ordemB }),
        api.patch(`/api/admin/cardapio/${outro.id}`, { ordem: ordemA }),
      ])
      load()
    } catch {
      toast('Erro ao reordenar', 'error')
    }
  }

  const handleDuplicar = (item) => {
    const cat = item.cat
    setNovoForm({
      nome: item.nome + ' (cópia)',
      emoji: item.emoji || '',
      cat,
      preco: item.preco,
      setor: item.setor || 'bar',
      cozinha: !!item.cozinha,
      indisponivel: false,
    })
    setNovoCategoria(cat)
    // scroll para o topo da categoria seria ideal, mas simplesmente abre o form
    toast('Formulário preenchido com os dados do item — clique em Salvar para duplicar', 'info')
  }

  const openNovoInline = (cat) => {
    setNovoForm({ ...EMPTY_FORM, cat, setor: cat === 'Bebidas' ? 'bar' : cat === 'Espetos' ? 'chapa' : 'cozinha' })
    setNovoCategoria(cat)
  }

  const handleNovoSave = async () => {
    if (!novoForm.nome || novoForm.preco === '' || Number(novoForm.preco) < 0) return toast('Nome e preço válido são obrigatórios', 'warn')
    setSaving(true)
    try {
      await api.post('/api/admin/cardapio', {
        ...novoForm,
        preco: parseFloat(String(novoForm.preco).replace(',', '.')),
      })
      toast('Item adicionado', 'success')
      setNovoCategoria(null)
      load()
    } catch (e) {
      toast(e?.message || 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const openEditar = (item) => {
    setEditForm({
      nome: item.nome,
      marca: item.marca || '',
      tipo: item.tipo || '',
      embalagem: item.embalagem || '',
      volumeMl: item.volumeMl || '',
      subcategoria: item.subcategoria || 'Bebidas',
      unidade: item.unidade || 'UN',
      semAlcool: !!item.semAlcool,
      precoPendente: !!item.precoPendente,
      emoji: item.emoji || '',
      cat: item.cat,
      preco: item.preco,
      setor: item.setor || 'bar',
      cozinha: !!item.cozinha,
      indisponivel: !!item.indisponivel,
      modificadorGrupoIds: Array.isArray(item.modificadorGrupoIds) ? item.modificadorGrupoIds : [],
      fiscal: { ncm: '', cfop: '', cstCsosn: '', unidade: 'UN', origem: 0, ...(item.fiscal || {}) },
    })
    setEditModal(item)
  }

  const handleEditSave = async () => {
    if (!editForm.nome || editForm.preco === '' || Number(editForm.preco) < 0) return toast('Nome e preço válido são obrigatórios', 'warn')
    setSaving(true)
    try {
      await api.patch(`/api/admin/cardapio/${editModal.id}`, {
        ...editForm,
        preco: parseFloat(String(editForm.preco).replace(',', '.')),
      })
      toast('Item atualizado', 'success')
      setEditModal(null)
      load()
    } catch (e) {
      toast(e?.message || 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleReplicarTodasEmpresas = async () => {
    if (!confirm('Replicar o catálogo oficial para todas as empresas ativas? Itens já existentes não serão duplicados e nenhum preço será sobrescrito.')) return
    setReplicando(true)
    try {
      const resultado = await api.post('/api/admin/cardapio/replicar-todas-empresas', {})
      toast(`${resultado.totalAdicionados || 0} itens replicados em ${resultado.totalEmpresas || 0} empresas`, 'success')
      load()
    } catch (e) {
      toast(e?.message || 'Erro ao replicar cardápios', 'error')
    } finally {
      setReplicando(false)
    }
  }
  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Cardápio</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(itensFiltrados)}>⬇ CSV</button>
          <button
            className={`btn btn-sm ${showPreview ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setShowPreview(v => !v)}
          >
            👁 Preview PDV
          </button>
          {isPlatformAdmin && (
            <button className="btn btn-primary btn-sm" onClick={handleReplicarTodasEmpresas} disabled={replicando}>
              {replicando ? 'Replicando…' : '↗ Aplicar catálogo oficial'}
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <KpiCard label="Total de Itens" value={kpis.total} color="var(--cream)" />
        <KpiCard label="Disponíveis" value={kpis.disponiveis} color="#FF6B2C" sub={`${kpis.total - kpis.disponiveis} indisp.`} />
        <KpiCard label="Bar" value={kpis.bar} color="#FF9B72" />
        <KpiCard label="Cozinha" value={kpis.cozinha} color="var(--gold)" />
        <KpiCard label="Chapa" value={kpis.chapa} color="#e07b39" />
        <KpiCard label="Preço Médio" value={fmtR(kpis.precoMedio)} color="var(--cream)" />
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <input
          className="input" placeholder="🔍 Buscar item…"
          value={busca} onChange={e => setBusca(e.target.value)}
          style={{ maxWidth: 220 }}
        />
        <select className="input" value={filtroCat} onChange={e => setFiltroCat(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="Todas">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {['todos', 'disponiveis', 'indisponiveis'].map(v => (
          <button key={v} className={`btn btn-sm ${filtroDisp === v ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFiltroDisp(v)}
          >
            {v === 'todos' ? 'Todos' : v === 'disponiveis' ? '✅ Disponíveis' : '🚫 Indisponíveis'}
          </button>
        ))}
        {(busca || filtroCat !== 'Todas' || filtroDisp !== 'todos') && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setBusca(''); setFiltroCat('Todas'); setFiltroDisp('todos') }}>
            ✕ Limpar
          </button>
        )}
        {(busca || filtroCat !== 'Todas' || filtroDisp !== 'todos') && (
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>
            {itensFiltrados.length} resultado{itensFiltrados.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Preview do PDV */}
      {showPreview && (
        <div style={{ marginBottom: 28 }}>
          <PreviewPDV itens={itens} />
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Carregando…</p>
      ) : (
        CATEGORIAS.map((cat) => {
          const lista = grouped[cat] || []
          return (
            <section key={cat} style={{ marginBottom: 32 }}>
              {/* Cabeçalho da categoria */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                  paddingBottom: 8,
                  borderBottom: '2px solid #12283F',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>{cat}</h2>
                  <span
                    className="badge"
                    style={{ background: '#FF6B2C22', color: '#FF6B2C', border: '1px solid #FF6B2C44' }}
                  >
                    {lista.length} {lista.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => openNovoInline(novoCategoria === cat ? null : cat)}
                >
                  {novoCategoria === cat ? '✕ Cancelar' : '+ Adicionar'}
                </button>
              </div>

              {/* Formulário inline para novo item */}
              {novoCategoria === cat && (
                <div
                  className="card"
                  style={{
                    marginBottom: 12,
                    border: '1px solid #FF6B2C',
                    display: 'grid',
                    gridTemplateColumns: '56px 1fr 110px 120px 130px auto',
                    gap: 10,
                    alignItems: 'end',
                  }}
                >
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Emoji</label>
                    <input
                      value={novoForm.emoji}
                      onChange={(e) => setNovoForm((f) => ({ ...f, emoji: e.target.value }))}
                      placeholder="🍺"
                      style={{ textAlign: 'center', fontSize: 18 }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Nome</label>
                    <input
                      value={novoForm.nome}
                      onChange={(e) => setNovoForm((f) => ({ ...f, nome: e.target.value }))}
                      placeholder="Nome do item"
                      autoFocus
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Preço (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={novoForm.preco}
                      onChange={(e) => setNovoForm((f) => ({ ...f, preco: e.target.value }))}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Setor</label>
                    <select
                      value={novoForm.setor}
                      onChange={(e) => setNovoForm((f) => ({ ...f, setor: e.target.value }))}
                    >
                      {SETORES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ opacity: 0 }}>.</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ddd', fontSize: 13, cursor: 'pointer', height: 36 }}>
                      <input
                        type="checkbox"
                        checked={novoForm.cozinha}
                        onChange={(e) => setNovoForm((f) => ({ ...f, cozinha: e.target.checked }))}
                      />
                      Cozinha
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-primary btn-sm" onClick={handleNovoSave} disabled={saving}>
                      {saving ? '…' : 'Salvar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Cards dos produtos */}
              {lista.length === 0 && novoCategoria !== cat ? (
                <p style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>
                  Nenhum item nesta categoria.
                </p>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                    gap: 12,
                  }}
                >
                  {lista.map((item, idx) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      isFirst={idx === 0}
                      isLast={idx === lista.length - 1}
                      onToggleCozinha={() => handleToggle(item, 'cozinha')}
                      onToggleDisponivel={() => handleToggle(item, 'indisponivel')}
                      onEditar={() => openEditar(item)}
                      onExcluir={() => handleDelete(item)}
                      onSubir={() => handleMover(item, -1)}
                      onDescer={() => handleMover(item, 1)}
                      onDuplicar={() => handleDuplicar(item)}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })
      )}

      {/* Modal de edição */}
      {editModal && (
        <Modal title={`Editar — ${editModal.nome}`} onClose={() => setEditModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Linha: emoji + nome */}
            <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 10 }}>
              <div className="form-group">
                <label>Emoji</label>
                <input
                  value={editForm.emoji}
                  onChange={(e) => setEditForm((f) => ({ ...f, emoji: e.target.value }))}
                  placeholder="🍺"
                  style={{ textAlign: 'center', fontSize: 20 }}
                />
              </div>
              <div className="form-group">
                <label>Nome</label>
                <input
                  value={editForm.nome}
                  onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Marca</label>
                <input value={editForm.marca} onChange={(e) => setEditForm((f) => ({ ...f, marca: e.target.value }))} placeholder="Ex.: Heineken" />
              </div>
              <div className="form-group">
                <label>Tipo / estilo</label>
                <input value={editForm.tipo} onChange={(e) => setEditForm((f) => ({ ...f, tipo: e.target.value }))} placeholder="Ex.: Puro Malte" />
              </div>
              <div className="form-group">
                <label>Embalagem</label>
                <input value={editForm.embalagem} onChange={(e) => setEditForm((f) => ({ ...f, embalagem: e.target.value }))} placeholder="Ex.: Long Neck 330 ml" />
              </div>
              <div className="form-group">
                <label>Volume (ml)</label>
                <input type="number" min="0" value={editForm.volumeMl} onChange={(e) => setEditForm((f) => ({ ...f, volumeMl: e.target.value }))} placeholder="330" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Preço (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.preco}
                  onChange={(e) => setEditForm((f) => ({ ...f, preco: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Setor</label>
                <select
                  value={editForm.setor}
                  onChange={(e) => setEditForm((f) => ({ ...f, setor: e.target.value }))}
                >
                  {SETORES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Categoria</label>
              <select
                value={editForm.cat}
                onChange={(e) => setEditForm((f) => ({ ...f, cat: e.target.value }))}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#ddd', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={editForm.cozinha}
                  onChange={(e) => setEditForm((f) => ({ ...f, cozinha: e.target.checked }))}
                />
                Exibir na cozinha
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#ddd', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={editForm.indisponivel}
                  onChange={(e) => setEditForm((f) => ({ ...f, indisponivel: e.target.checked }))}
                />
                Indisponível
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#ddd', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={editForm.precoPendente}
                  onChange={(e) => setEditForm((f) => ({ ...f, precoPendente: e.target.checked }))}
                />
                Preço pendente de revisão
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#ddd', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={editForm.semAlcool}
                  onChange={(e) => setEditForm((f) => ({ ...f, semAlcool: e.target.checked }))}
                />
                Sem álcool
              </label>
            </div>

            <details style={{ background: 'rgba(255,107,44,.06)', border: '1px solid rgba(255,107,44,.2)', borderRadius: 8, padding: '8px 12px' }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--gold,#FF6B2C)' }}>➕ Modificadores e adicionais</summary>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8, marginTop: 10 }}>
                {gruposModificadores.length === 0 ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhum grupo cadastrado. Crie-os em “Adicionais & Combos”.</div> : gruposModificadores.map(grupo => <label key={grupo.id} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', color: '#ddd', fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={(editForm.modificadorGrupoIds || []).includes(grupo.id)} onChange={e => setEditForm(form => ({ ...form, modificadorGrupoIds: e.target.checked ? [...new Set([...(form.modificadorGrupoIds || []), grupo.id])] : (form.modificadorGrupoIds || []).filter(id => id !== grupo.id) }))} /><span><strong>{grupo.nome}</strong><br /><small style={{ color: 'var(--muted)' }}>{grupo.minimo}–{grupo.maximo} opção(ões){grupo.obrigatorio ? ' · obrigatório' : ''}</small></span></label>)}
              </div>
            </details>

            {/* Dados fiscais (NFC-e) — usados na emissão da nota do bar */}
            <details style={{ background: 'rgba(255,107,44,.06)', border: '1px solid rgba(255,107,44,.2)', borderRadius: 8, padding: '8px 12px' }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--gold,#FF6B2C)' }}>🧾 Dados fiscais (NFC-e)</summary>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', marginTop: 10 }}>
                <label style={{ fontSize: 12, color: '#bbb' }}>NCM
                  <input className="input" value={editForm.fiscal?.ncm || ''} placeholder="ex.: 22030000"
                    onChange={e => setEditForm(f => ({ ...f, fiscal: { ...f.fiscal, ncm: e.target.value } }))} />
                </label>
                <label style={{ fontSize: 12, color: '#bbb' }}>CFOP
                  <input className="input" value={editForm.fiscal?.cfop || ''} placeholder="ex.: 5102"
                    onChange={e => setEditForm(f => ({ ...f, fiscal: { ...f.fiscal, cfop: e.target.value } }))} />
                </label>
                <label style={{ fontSize: 12, color: '#bbb' }}>CST / CSOSN
                  <input className="input" value={editForm.fiscal?.cstCsosn || ''} placeholder="ex.: 102"
                    onChange={e => setEditForm(f => ({ ...f, fiscal: { ...f.fiscal, cstCsosn: e.target.value } }))} />
                </label>
                <label style={{ fontSize: 12, color: '#bbb' }}>Unidade
                  <input className="input" value={editForm.fiscal?.unidade || ''} placeholder="UN"
                    onChange={e => setEditForm(f => ({ ...f, fiscal: { ...f.fiscal, unidade: e.target.value } }))} />
                </label>
                <label style={{ fontSize: 12, color: '#bbb' }}>Origem
                  <select className="input" value={editForm.fiscal?.origem ?? 0}
                    onChange={e => setEditForm(f => ({ ...f, fiscal: { ...f.fiscal, origem: Number(e.target.value) } }))}>
                    <option value={0}>0 — Nacional</option>
                    <option value={1}>1 — Estrangeira (importação direta)</option>
                    <option value={2}>2 — Estrangeira (mercado interno)</option>
                  </select>
                </label>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                Em branco → usa o padrão por categoria (Configurações → Fiscal).
              </div>
            </details>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn btn-secondary" onClick={() => setEditModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleEditSave} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function ItemCard({ item, isFirst, isLast, onToggleCozinha, onToggleDisponivel, onEditar, onExcluir, onSubir, onDescer, onDuplicar }) {
  return (
    <div
      className="card"
      style={{
        opacity: item.indisponivel ? 0.55 : 1,
        border: item.indisponivel ? '1px solid #444' : '1px solid #12283F',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>
            {item.emoji ? <span style={{ marginRight: 6, fontSize: 16 }}>{item.emoji}</span> : null}
            {item.nome}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {[item.marca, item.tipo, item.embalagem].filter(Boolean).join(' · ') || item.setor}
          </div>
        </div>
        <div style={{ fontWeight: 700, color: '#FF6B2C', fontSize: 15, whiteSpace: 'nowrap', marginLeft: 8, textAlign: 'right' }}>
          {item.precoPendente ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>A definir</span> : fmtR(item.preco)}
        </div>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ToggleChip
          label="Cozinha"
          active={!!item.cozinha}
          activeColor="#FF6B2C"
          onClick={onToggleCozinha}
        />
        <ToggleChip
          label={item.indisponivel ? 'Indisponível' : 'Disponível'}
          active={!item.indisponivel}
          activeColor="#FF9B72"
          inactiveColor="#e05c5c"
          onClick={onToggleDisponivel}
        />
      </div>

      {/* Ações */}
      <div style={{ display: 'flex', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
        {/* Reordenar */}
        <button
          className="btn btn-ghost btn-sm"
          title="Mover para cima"
          disabled={isFirst}
          onClick={onSubir}
          style={{ padding: '2px 7px', opacity: isFirst ? 0.3 : 1 }}
        >
          ↑
        </button>
        <button
          className="btn btn-ghost btn-sm"
          title="Mover para baixo"
          disabled={isLast}
          onClick={onDescer}
          style={{ padding: '2px 7px', opacity: isLast ? 0.3 : 1 }}
        >
          ↓
        </button>

        {/* Duplicar */}
        <button
          className="btn btn-ghost btn-sm"
          title="Duplicar item"
          onClick={onDuplicar}
          style={{ padding: '2px 8px' }}
        >
          📋
        </button>

        <button className="btn btn-secondary btn-sm" style={{ flex: 1, minWidth: 50 }} onClick={onEditar}>
          Editar
        </button>
        <button className="btn btn-danger btn-sm" onClick={onExcluir}>
          ✕
        </button>
      </div>
    </div>
  )
}

function ToggleChip({ label, active, activeColor = '#FF6B2C', inactiveColor = '#555', onClick }) {
  const color = active ? activeColor : inactiveColor
  return (
    <button
      onClick={onClick}
      style={{
        background: color + '22',
        color,
        border: `1px solid ${color}55`,
        borderRadius: 12,
        padding: '2px 10px',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

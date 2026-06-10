import { useState, useEffect } from 'react'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const CATEGORIAS = ['Bebidas', 'Petiscos', 'Espetinhos', 'Cozinha', 'Sobremesas']
const SETORES = ['bar', 'cozinha', 'chapa']

const EMPTY_FORM = {
  nome: '',
  cat: 'Bebidas',
  preco: '',
  setor: 'bar',
  cozinha: false,
  indisponivel: false,
}

export default function Cardapio() {
  const { toast } = useToast()
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [novoForm, setNovoForm] = useState({ ...EMPTY_FORM })
  const [novoCategoria, setNovoCategoria] = useState(null) // categoria do formulário inline aberto
  const [editModal, setEditModal] = useState(null) // item sendo editado
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    api
      .get('/api/admin/cardapio')
      .then(setItens)
      .catch(() => toast('Erro ao carregar cardápio', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const grouped = CATEGORIAS.reduce((acc, cat) => {
    acc[cat] = itens.filter((i) => i.cat === cat)
    return acc
  }, {})

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

  const openNovoInline = (cat) => {
    setNovoForm({ ...EMPTY_FORM, cat, setor: cat === 'Bebidas' ? 'bar' : cat === 'Espetinhos' ? 'chapa' : 'cozinha' })
    setNovoCategoria(cat)
  }

  const handleNovoSave = async () => {
    if (!novoForm.nome || !novoForm.preco) return toast('Nome e preço obrigatórios', 'warn')
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
      cat: item.cat,
      preco: item.preco,
      setor: item.setor || 'bar',
      cozinha: !!item.cozinha,
      indisponivel: !!item.indisponivel,
    })
    setEditModal(item)
  }

  const handleEditSave = async () => {
    if (!editForm.nome || !editForm.preco) return toast('Nome e preço obrigatórios', 'warn')
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

  return (
    <div className="page">
      <h1 className="page-title">Cardápio</h1>

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
                  borderBottom: '2px solid #1e4a2e',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>{cat}</h2>
                  <span
                    className="badge"
                    style={{ background: '#5FB33522', color: '#5FB335', border: '1px solid #5FB33544' }}
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
                    border: '1px solid var(--green)',
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 130px auto',
                    gap: 10,
                    alignItems: 'end',
                  }}
                >
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
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: 12,
                  }}
                >
                  {lista.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onToggleCozinha={() => handleToggle(item, 'cozinha')}
                      onToggleDisponivel={() => handleToggle(item, 'indisponivel')}
                      onEditar={() => openEditar(item)}
                      onExcluir={() => handleDelete(item)}
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
            <div className="form-group">
              <label>Nome</label>
              <input
                value={editForm.nome}
                onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
              />
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
            <div style={{ display: 'flex', gap: 20 }}>
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
            </div>
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

function ItemCard({ item, onToggleCozinha, onToggleDisponivel, onEditar, onExcluir }) {
  return (
    <div
      className="card"
      style={{
        opacity: item.indisponivel ? 0.55 : 1,
        border: item.indisponivel ? '1px solid #444' : '1px solid #1e4a2e',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>{item.nome}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{item.setor}</div>
        </div>
        <div style={{ fontWeight: 700, color: '#C9A656', fontSize: 15, whiteSpace: 'nowrap' }}>
          {fmtR(item.preco)}
        </div>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ToggleChip
          label="Cozinha"
          active={!!item.cozinha}
          activeColor="#5FB335"
          onClick={onToggleCozinha}
        />
        <ToggleChip
          label={item.indisponivel ? 'Indisponível' : 'Disponível'}
          active={!item.indisponivel}
          activeColor="#8FD64A"
          inactiveColor="#e05c5c"
          onClick={onToggleDisponivel}
        />
      </div>

      {/* Ações */}
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={onEditar}>
          Editar
        </button>
        <button className="btn btn-danger btn-sm" onClick={onExcluir}>
          ✕
        </button>
      </div>
    </div>
  )
}

function ToggleChip({ label, active, activeColor = '#5FB335', inactiveColor = '#555', onClick }) {
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

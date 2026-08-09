import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const vazio = { produtoFinalId: '', rendimento: 1, baixarProdutoFinal: false, observacao: '', itens: [] }
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--text)' }

export default function FichasTecnicas() {
  const { toast } = useToast()
  const [fichas, setFichas] = useState([])
  const [produtos, setProdutos] = useState([])
  const [estoque, setEstoque] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(vazio)
  const [insumoId, setInsumoId] = useState('')
  const [insumoQtd, setInsumoQtd] = useState('1')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [fichasRes, produtosRes, estoqueRes] = await Promise.all([
        api.get('/api/admin/fichas-tecnicas'),
        api.get('/api/admin/cardapio'),
        api.get('/api/admin/estoque'),
      ])
      setFichas(fichasRes.fichas || [])
      setProdutos(produtosRes || [])
      setEstoque(estoqueRes.estoque || [])
    } catch (error) { toast(error.message || 'Não foi possível carregar as fichas técnicas.', 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { carregar() }, [carregar])

  const produtoPorId = useMemo(() => new Map(produtos.map(produto => [produto.id, produto])), [produtos])
  const estoquePorProduto = useMemo(() => new Map(estoque.map(item => [item.produtoId || item.id, item])), [estoque])
  const disponiveis = produtos.filter(produto => produto.id !== form.produtoFinalId && !form.itens.some(item => item.produtoId === produto.id))

  function abrirNova() { setEditando(null); setForm(vazio); setInsumoId(''); setInsumoQtd('1'); setModal(true) }
  function abrirEdicao(ficha) {
    setEditando(ficha)
    setForm({ produtoFinalId: ficha.produtoFinalId, rendimento: ficha.rendimento || 1, baixarProdutoFinal: ficha.baixarProdutoFinal === true, observacao: ficha.observacao || '', itens: (ficha.itens || []).map(item => ({ produtoId: item.produtoId, qtd: item.qtd })) })
    setInsumoId(''); setInsumoQtd('1'); setModal(true)
  }

  function adicionarInsumo() {
    const qtd = Number(String(insumoQtd).replace(',', '.'))
    if (!insumoId || !Number.isFinite(qtd) || qtd <= 0) return toast('Selecione um insumo e informe uma quantidade válida.', 'error')
    setForm(atual => ({ ...atual, itens: [...atual.itens, { produtoId: insumoId, qtd }] }))
    setInsumoId(''); setInsumoQtd('1')
  }

  async function salvar() {
    if (!form.produtoFinalId || !form.itens.length) return toast('Selecione o produto final e pelo menos um insumo.', 'error')
    setSaving(true)
    try {
      const payload = { ...form, rendimento: Number(form.rendimento || 1) }
      if (editando) await api.patch(`/api/admin/fichas-tecnicas/${editando.id}`, payload)
      else await api.post('/api/admin/fichas-tecnicas', payload)
      toast(editando ? 'Ficha técnica atualizada.' : 'Ficha técnica criada.')
      setModal(false); carregar()
    } catch (error) { toast(error.message || 'Não foi possível salvar a ficha técnica.', 'error') }
    finally { setSaving(false) }
  }

  async function excluir(ficha) {
    if (!window.confirm(`Remover a ficha técnica de ${ficha.nomeProduto}?`)) return
    try { await api.delete(`/api/admin/fichas-tecnicas/${ficha.id}`); toast('Ficha técnica removida.'); carregar() }
    catch (error) { toast(error.message || 'Não foi possível remover a ficha técnica.', 'error') }
  }

  return <div className="page">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
      <div><h1 className="page-title" style={{ margin: '0 0 5px' }}>Fichas Técnicas</h1><p style={{ margin: 0, color: 'var(--muted)' }}>Composição, custo estimado e baixa automática de insumos por empresa.</p></div>
      <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-secondary btn-sm" onClick={carregar}>↺ Atualizar</button><button className="btn btn-primary btn-sm" onClick={abrirNova}>+ Nova ficha</button></div>
    </div>

    <div className="card" style={{ marginBottom: 16, background: 'rgba(255,107,44,.06)', borderColor: 'rgba(255,107,44,.25)' }}>
      <strong style={{ color: '#FF6B2C' }}>Como funciona:</strong> ao lançar um produto com ficha técnica no PDV, os insumos são baixados automaticamente. O custo é gravado no item da venda para preservar o CMV histórico. O produto final só terá baixa própria quando esta opção for marcada.
    </div>

    {loading ? <div className="card" style={{ color: 'var(--muted)' }}>Carregando fichas técnicas…</div> : fichas.length === 0 ? <div className="card" style={{ color: 'var(--muted)' }}>Nenhuma ficha cadastrada nesta empresa. Crie fichas para drinks, pratos e produtos compostos.</div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(315px, 1fr))', gap: 14 }}>
      {fichas.map((ficha) => <section className="card" key={ficha.id}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}><div><h2 style={{ margin: 0, color: '#12283F', fontSize: 16 }}>{ficha.nomeProduto}</h2><div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>Rendimento: {ficha.rendimento} unidade(s) · {ficha.baixarProdutoFinal ? 'baixa produto final + insumos' : 'baixa somente insumos'}</div></div><strong style={{ color: '#16806b', whiteSpace: 'nowrap' }}>{fmtR(ficha.custo?.custoPorRendimento || 0)}/un.</strong></div>
        <div style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 9, display: 'grid', gap: 6 }}>{(ficha.itens || []).map(item => { const saldo = estoquePorProduto.get(item.produtoId); return <div key={item.produtoId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{item.nome}</span><span style={{ color: Number(saldo?.qtd || 0) <= 0 ? '#b23a48' : 'var(--muted)' }}>{item.qtd} {item.unidade} · saldo {saldo?.qtd ?? 0}</span></div> })}</div>
        {ficha.observacao && <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 0 }}>{ficha.observacao}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button className="btn btn-secondary btn-sm" onClick={() => abrirEdicao(ficha)}>Editar</button><button className="btn btn-ghost btn-sm" onClick={() => excluir(ficha)} style={{ color: '#b23a48' }}>Remover</button></div>
      </section>)}
    </div>}

    {modal && <Modal title={editando ? 'Editar ficha técnica' : 'Nova ficha técnica'} onClose={() => setModal(false)} width={720}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}><span style={{ color: 'var(--muted)', fontSize: 12 }}>Produto final *</span><select style={inputStyle} value={form.produtoFinalId} onChange={e => setForm({ ...form, produtoFinalId: e.target.value, itens: form.itens.filter(item => item.produtoId !== e.target.value) })}><option value="">Selecione…</option>{produtos.map(produto => <option key={produto.id} value={produto.id}>{produto.nome}</option>)}</select></label>
        <label style={{ display: 'grid', gap: 6 }}><span style={{ color: 'var(--muted)', fontSize: 12 }}>Rendimento *</span><input style={inputStyle} type="number" min="0.0001" step="0.0001" value={form.rendimento} onChange={e => setForm({ ...form, rendimento: e.target.value })} /></label>
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 12 }}><input type="checkbox" checked={form.baixarProdutoFinal} onChange={e => setForm({ ...form, baixarProdutoFinal: e.target.checked })} /> Também baixar o estoque do produto final</label>
      <div style={{ marginTop: 16, padding: 12, borderRadius: 9, background: 'var(--surface-2)' }}><strong style={{ color: '#12283F', fontSize: 14 }}>Insumos</strong>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 125px auto', gap: 8, marginTop: 9 }}><select style={inputStyle} value={insumoId} onChange={e => setInsumoId(e.target.value)}><option value="">Selecione o insumo…</option>{disponiveis.map(produto => <option key={produto.id} value={produto.id}>{produto.nome}</option>)}</select><input style={inputStyle} type="number" min="0.0001" step="0.0001" value={insumoQtd} onChange={e => setInsumoQtd(e.target.value)} /><button className="btn btn-secondary" onClick={adicionarInsumo}>Adicionar</button></div>
        <div style={{ display: 'grid', gap: 7, marginTop: 11 }}>{form.itens.length === 0 ? <span style={{ color: 'var(--muted)', fontSize: 13 }}>Adicione ao menos um insumo.</span> : form.itens.map((item, index) => { const produto = produtoPorId.get(item.produtoId); return <div key={item.produtoId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}><span>{produto?.nome || item.produtoId}</span><span><input aria-label="Quantidade do insumo" type="number" min="0.0001" step="0.0001" value={item.qtd} onChange={e => setForm({ ...form, itens: form.itens.map((atual, i) => i === index ? { ...atual, qtd: e.target.value } : atual) })} style={{ width: 90, ...inputStyle, padding: '4px 6px', marginRight: 7 }} /><button className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, itens: form.itens.filter((_, i) => i !== index) })}>×</button></span></div> })}</div>
      </div>
      <label style={{ display: 'grid', gap: 6, marginTop: 12 }}><span style={{ color: 'var(--muted)', fontSize: 12 }}>Observação</span><textarea style={{ ...inputStyle, minHeight: 70 }} value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} /></label>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}><button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button><button className="btn btn-primary" disabled={saving} onClick={salvar}>{saving ? 'Salvando…' : 'Salvar ficha técnica'}</button></div>
    </Modal>}
  </div>
}

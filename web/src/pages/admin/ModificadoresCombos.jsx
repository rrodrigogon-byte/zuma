import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const novoGrupo = () => ({ id: null, nome: '', descricao: '', obrigatorio: false, minimo: 0, maximo: 1, opcoes: [{ nome: '', precoAdicional: 0, custoAdicional: 0, produtoId: '', quantidadeEstoque: 1 }] })
const novoCombo = () => ({ id: null, nome: '', descricao: '', preco: '', setor: 'bar', componentes: [{ produtoId: '', qtd: 1, observacao: '' }] })
const asNumber = valor => Number(String(valor ?? '').replace(',', '.')) || 0

export default function ModificadoresCombos() {
  const { toast } = useToast()
  const [grupos, setGrupos] = useState([])
  const [combos, setCombos] = useState([])
  const [produtos, setProdutos] = useState([])
  const [grupoForm, setGrupoForm] = useState(novoGrupo)
  const [comboForm, setComboForm] = useState(novoCombo)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState('')

  const carregar = useCallback(async () => {
    try {
      const [dadosGrupos, dadosCombos, dadosProdutos] = await Promise.all([
        api.get('/api/admin/modificadores/grupos'), api.get('/api/admin/combos'), api.get('/api/admin/cardapio'),
      ])
      setGrupos(Array.isArray(dadosGrupos?.grupos) ? dadosGrupos.grupos : [])
      setCombos(Array.isArray(dadosCombos?.combos) ? dadosCombos.combos : [])
      setProdutos(Array.isArray(dadosProdutos) ? dadosProdutos : [])
    } catch (erro) { toast(erro.message || 'Não foi possível carregar modificadores e combos.', 'error') }
    finally { setCarregando(false) }
  }, [toast])
  useEffect(() => { carregar() }, [carregar])

  const produtoPorId = useMemo(() => new Map(produtos.map(produto => [produto.id, produto])), [produtos])
  const atualizarOpcao = (indice, campo, valor) => setGrupoForm(atual => ({ ...atual, opcoes: atual.opcoes.map((opcao, i) => i === indice ? { ...opcao, [campo]: valor } : opcao) }))
  const atualizarComponente = (indice, campo, valor) => setComboForm(atual => ({ ...atual, componentes: atual.componentes.map((componente, i) => i === indice ? { ...componente, [campo]: valor } : componente) }))

  const salvarGrupo = async evento => {
    evento.preventDefault(); setSalvando('grupo')
    try {
      const payload = { ...grupoForm, minimo: asNumber(grupoForm.minimo), maximo: asNumber(grupoForm.maximo), opcoes: grupoForm.opcoes.map(opcao => ({ ...opcao, precoAdicional: asNumber(opcao.precoAdicional), custoAdicional: asNumber(opcao.custoAdicional), quantidadeEstoque: asNumber(opcao.quantidadeEstoque || 1) })) }
      if (grupoForm.id) await api.patch(`/api/admin/modificadores/grupos/${grupoForm.id}`, payload)
      else await api.post('/api/admin/modificadores/grupos', payload)
      toast('Grupo de modificadores salvo.', 'success'); setGrupoForm(novoGrupo()); await carregar()
    } catch (erro) { toast(erro.message || 'Não foi possível salvar o grupo.', 'error') }
    finally { setSalvando('') }
  }
  const salvarCombo = async evento => {
    evento.preventDefault(); setSalvando('combo')
    try {
      const payload = { ...comboForm, preco: asNumber(comboForm.preco), componentes: comboForm.componentes.map(componente => ({ ...componente, qtd: asNumber(componente.qtd || 1) })) }
      if (comboForm.id) await api.patch(`/api/admin/combos/${comboForm.id}`, payload)
      else await api.post('/api/admin/combos', payload)
      toast('Combo salvo.', 'success'); setComboForm(novoCombo()); await carregar()
    } catch (erro) { toast(erro.message || 'Não foi possível salvar o combo.', 'error') }
    finally { setSalvando('') }
  }
  const excluir = async (tipo, id) => {
    if (!window.confirm(`Excluir este ${tipo === 'grupo' ? 'grupo de modificadores' : 'combo'}?`)) return
    try { await api.delete(tipo === 'grupo' ? `/api/admin/modificadores/grupos/${id}` : `/api/admin/combos/${id}`); toast('Registro excluído.', 'success'); await carregar() }
    catch (erro) { toast(erro.message || 'Não foi possível excluir.', 'error') }
  }

  if (carregando) return <div className="page" style={{ padding: 18 }}><div className="spinner" /></div>
  return <div className="page" style={{ padding: 18, maxWidth: 1360 }}>
    <header style={{ marginBottom: 18 }}><h1 style={{ margin: 0, color: '#12283F', fontSize: 25 }}>Modificadores, adicionais e combos</h1><p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>Configure escolhas estruturadas do cardápio. Os adicionais podem somar preço, refletir CMV e baixar um item de estoque.</p></header>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
      <section className="card" style={{ padding: 16 }}><h2 style={{ marginTop: 0, color: '#12283F', fontSize: 18 }}>{grupoForm.id ? 'Editar grupo' : 'Novo grupo de modificadores'}</h2>
        <form onSubmit={salvarGrupo}><div className="form-grid"><label>Nome<input className="input" required value={grupoForm.nome} onChange={e => setGrupoForm(v => ({ ...v, nome: e.target.value }))} placeholder="Ex.: Escolha o ponto" /></label><label>Descrição<input className="input" value={grupoForm.descricao} onChange={e => setGrupoForm(v => ({ ...v, descricao: e.target.value }))} placeholder="Instrução para o atendente" /></label><label>Seleção mínima<input className="input" type="number" min="0" value={grupoForm.minimo} onChange={e => setGrupoForm(v => ({ ...v, minimo: e.target.value }))} /></label><label>Seleção máxima<input className="input" type="number" min="1" value={grupoForm.maximo} onChange={e => setGrupoForm(v => ({ ...v, maximo: e.target.value }))} /></label></div><label style={{ display: 'block', margin: '10px 0', fontWeight: 700 }}><input type="checkbox" checked={grupoForm.obrigatorio} onChange={e => setGrupoForm(v => ({ ...v, obrigatorio: e.target.checked, minimo: e.target.checked && Number(v.minimo || 0) < 1 ? 1 : v.minimo }))} /> Escolha obrigatória</label>
          <div style={{ fontWeight: 800, color: '#12283F', margin: '12px 0 8px' }}>Opções</div>{grupoForm.opcoes.map((opcao, indice) => <div key={indice} style={{ display: 'grid', gridTemplateColumns: '1.6fr .7fr .7fr 1.2fr .55fr auto', gap: 6, marginBottom: 6 }}><input className="input" required value={opcao.nome} onChange={e => atualizarOpcao(indice, 'nome', e.target.value)} placeholder="Opção" /><input className="input" type="number" min="0" step="0.01" value={opcao.precoAdicional} onChange={e => atualizarOpcao(indice, 'precoAdicional', e.target.value)} placeholder="Preço +" /><input className="input" type="number" min="0" step="0.01" value={opcao.custoAdicional} onChange={e => atualizarOpcao(indice, 'custoAdicional', e.target.value)} placeholder="Custo" /><select className="input" value={opcao.produtoId || ''} onChange={e => atualizarOpcao(indice, 'produtoId', e.target.value)}><option value="">Sem baixa de estoque</option>{produtos.map(produto => <option key={produto.id} value={produto.id}>{produto.nome}</option>)}</select><input className="input" type="number" min="0.001" step="0.001" value={opcao.quantidadeEstoque || 1} onChange={e => atualizarOpcao(indice, 'quantidadeEstoque', e.target.value)} title="Quantidade baixada" /> <button type="button" className="btn" onClick={() => setGrupoForm(v => ({ ...v, opcoes: v.opcoes.filter((_, i) => i !== indice) }))} disabled={grupoForm.opcoes.length === 1}>×</button></div>)}
          <button type="button" className="btn" onClick={() => setGrupoForm(v => ({ ...v, opcoes: [...v.opcoes, { nome: '', precoAdicional: 0, custoAdicional: 0, produtoId: '', quantidadeEstoque: 1 }] }))}>+ Adicionar opção</button><div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button className="btn btn-primary" disabled={salvando === 'grupo'}>{salvando === 'grupo' ? 'Salvando…' : 'Salvar grupo'}</button>{grupoForm.id && <button type="button" className="btn" onClick={() => setGrupoForm(novoGrupo())}>Cancelar edição</button>}</div>
        </form>
      </section>
      <section className="card" style={{ padding: 16 }}><h2 style={{ marginTop: 0, color: '#12283F', fontSize: 18 }}>{comboForm.id ? 'Editar combo' : 'Novo combo'}</h2>
        <form onSubmit={salvarCombo}><div className="form-grid"><label>Nome<input className="input" required value={comboForm.nome} onChange={e => setComboForm(v => ({ ...v, nome: e.target.value }))} placeholder="Ex.: Espetinho + Chope" /></label><label>Preço promocional<input className="input" required type="number" min="0" step="0.01" value={comboForm.preco} onChange={e => setComboForm(v => ({ ...v, preco: e.target.value }))} /></label><label>Setor<select className="input" value={comboForm.setor} onChange={e => setComboForm(v => ({ ...v, setor: e.target.value }))}><option value="bar">Bar</option><option value="cozinha">Cozinha</option><option value="chapa">Chapa</option></select></label><label>Descrição<input className="input" value={comboForm.descricao} onChange={e => setComboForm(v => ({ ...v, descricao: e.target.value }))} /></label></div><div style={{ fontWeight: 800, color: '#12283F', margin: '12px 0 8px' }}>Componentes</div>{comboForm.componentes.map((componente, indice) => <div key={indice} style={{ display: 'grid', gridTemplateColumns: '1.8fr .45fr 1fr auto', gap: 6, marginBottom: 6 }}><select className="input" required value={componente.produtoId} onChange={e => atualizarComponente(indice, 'produtoId', e.target.value)}><option value="">Selecione um produto</option>{produtos.map(produto => <option key={produto.id} value={produto.id}>{produto.nome} — {fmtR(produto.preco)}</option>)}</select><input className="input" type="number" min="1" value={componente.qtd} onChange={e => atualizarComponente(indice, 'qtd', e.target.value)} /><input className="input" value={componente.observacao || ''} placeholder="Observação" onChange={e => atualizarComponente(indice, 'observacao', e.target.value)} /><button type="button" className="btn" onClick={() => setComboForm(v => ({ ...v, componentes: v.componentes.filter((_, i) => i !== indice) }))} disabled={comboForm.componentes.length === 1}>×</button></div>)}<button type="button" className="btn" onClick={() => setComboForm(v => ({ ...v, componentes: [...v.componentes, { produtoId: '', qtd: 1, observacao: '' }] }))}>+ Adicionar componente</button><div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button className="btn btn-primary" disabled={salvando === 'combo'}>{salvando === 'combo' ? 'Salvando…' : 'Salvar combo'}</button>{comboForm.id && <button type="button" className="btn" onClick={() => setComboForm(novoCombo())}>Cancelar edição</button>}</div></form>
      </section>
    </div>
    <section className="card" style={{ padding: 16, marginTop: 18 }}><h2 style={{ marginTop: 0, color: '#12283F', fontSize: 18 }}>Grupos cadastrados</h2>{grupos.length === 0 ? <p style={{ color: 'var(--muted)' }}>Nenhum grupo cadastrado.</p> : <div className="table-wrap"><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th>Grupo</th><th>Regras</th><th>Opções</th><th /></tr></thead><tbody>{grupos.map(grupo => <tr key={grupo.id}><td><strong>{grupo.nome}</strong><br /><small>{grupo.descricao}</small></td><td>{grupo.minimo}–{grupo.maximo} {grupo.obrigatorio ? '· obrigatório' : ''}</td><td>{grupo.opcoes.map(opcao => `${opcao.nome}${opcao.precoAdicional ? ` (+${fmtR(opcao.precoAdicional)})` : ''}`).join(' · ')}</td><td style={{ whiteSpace: 'nowrap' }}><button className="btn" onClick={() => setGrupoForm(structuredClone(grupo))}>Editar</button> <button className="btn" onClick={() => excluir('grupo', grupo.id)}>Excluir</button></td></tr>)}</tbody></table></div>}</section>
    <section className="card" style={{ padding: 16, marginTop: 18 }}><h2 style={{ marginTop: 0, color: '#12283F', fontSize: 18 }}>Combos cadastrados</h2>{combos.length === 0 ? <p style={{ color: 'var(--muted)' }}>Nenhum combo cadastrado.</p> : <div className="table-wrap"><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th>Combo</th><th>Preço</th><th>Componentes</th><th /></tr></thead><tbody>{combos.map(combo => <tr key={combo.id}><td><strong>{combo.nome}</strong><br /><small>{combo.descricao}</small></td><td>{fmtR(combo.preco)}</td><td>{combo.componentes.map(componente => `${componente.qtd}× ${produtoPorId.get(componente.produtoId)?.nome || componente.produtoId}`).join(' · ')}</td><td style={{ whiteSpace: 'nowrap' }}><button className="btn" onClick={() => setComboForm(structuredClone(combo))}>Editar</button> <button className="btn" onClick={() => excluir('combo', combo.id)}>Excluir</button></td></tr>)}</tbody></table></div>}</section>
  </div>
}

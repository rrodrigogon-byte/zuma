import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

const fmt = valor => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0))
const gerarIdempotencia = () => `${Date.now().toString(36)}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`
async function publico(url, { method = 'GET', session, body, idempotencyKey } = {}) {
  const resposta = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(session ? { 'X-Mesa-Session': session } : {}), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível concluir a solicitação.')
  return dados
}
function totalAdicionais(produto, selecoes) { return (selecoes || []).reduce((soma, selecao) => { const grupo = (produto.gruposModificadores || []).find(item => item.id === selecao.grupoId); const opcao = (grupo?.opcoes || []).find(item => item.id === selecao.opcaoId); return soma + Number(opcao?.precoAdicional || 0) }, 0) }

export default function CardapioMesaPublico() {
  const { token } = useParams()
  const [dados, setDados] = useState(null)
  const [session, setSession] = useState(() => sessionStorage.getItem(`kytto_mesa_${token}`) || '')
  const [carrinho, setCarrinho] = useState([])
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('Tudo')
  const [selecionado, setSelecionado] = useState(null)
  const [selecoes, setSelecoes] = useState([])
  const [observacao, setObservacao] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let ativo = true
    ;(async () => {
      try {
        const inicio = await publico(`/api/public/mesa/${token}/sessao`, { method: 'POST' })
        if (!ativo) return
        sessionStorage.setItem(`kytto_mesa_${token}`, inicio.sessao.token); setSession(inicio.sessao.token); setDados(inicio); setFeedback('')
      } catch (erro) { if (ativo) setFeedback(erro.message) }
      finally { if (ativo) setCarregando(false) }
    })()
    return () => { ativo = false }
  }, [token])

  const cardapio = dados?.cardapio || []
  const categorias = ['Tudo', ...Array.from(new Set(cardapio.map(produto => produto.cat).filter(Boolean)))]
  const produtos = cardapio.filter(produto => (categoria === 'Tudo' || produto.cat === categoria) && `${produto.nome} ${produto.marca} ${produto.tipo}`.toLowerCase().includes(busca.toLowerCase()))
  const total = useMemo(() => carrinho.reduce((soma, linha) => soma + (Number(linha.preco) + Number(linha.adicional || 0)) * Number(linha.qtd), 0), [carrinho])
  const abrirProduto = produto => { setSelecionado(produto); setSelecoes([]); setObservacao(''); setQuantidade(1) }
  const alternar = (grupo, opcao) => setSelecoes(atual => { const existe = atual.some(item => item.grupoId === grupo.id && item.opcaoId === opcao.id); if (existe) return atual.filter(item => !(item.grupoId === grupo.id && item.opcaoId === opcao.id)); const doGrupo = atual.filter(item => item.grupoId === grupo.id); if (doGrupo.length >= Number(grupo.maximo || 1)) { setFeedback(`Máximo de ${grupo.maximo || 1} opção(ões) em ${grupo.nome}.`); return atual } return [...atual, { grupoId: grupo.id, opcaoId: opcao.id }] })
  const adicionar = () => {
    if (!selecionado) return
    for (const grupo of selecionado.gruposModificadores || []) { const n = selecoes.filter(item => item.grupoId === grupo.id).length; if (n < Number(grupo.minimo || 0)) { setFeedback(`Selecione ao menos ${grupo.minimo} opção(ões) em ${grupo.nome}.`); return } }
    const adicional = totalAdicionais(selecionado, selecoes)
    setCarrinho(atual => [...atual, { id: gerarIdempotencia(), produtoId: selecionado.id, nome: selecionado.nome, preco: selecionado.preco, adicional, qtd: quantidade, modificadores: selecoes, obs: observacao }]); setSelecionado(null); setFeedback('Item adicionado ao pedido.')
  }
  const enviarPedido = async () => {
    if (!carrinho.length || !session) return
    setEnviando(true)
    try {
      const chave = gerarIdempotencia(); const resposta = await publico(`/api/public/mesa/${token}/pedidos`, { method: 'POST', session, idempotencyKey: chave, body: { idempotencyKey: chave, itens: carrinho.map(item => ({ produtoId: item.produtoId, qtd: item.qtd, obs: item.obs, modificadores: item.modificadores })) } })
      setCarrinho([]); setFeedback(resposta.aguardandoConfirmacao ? 'Pedido recebido e aguardando confirmação da equipe.' : 'Pedido enviado ao preparo. Obrigado!')
    } catch (erro) { setFeedback(erro.message) } finally { setEnviando(false) }
  }
  const chamar = async tipo => { try { const resposta = await publico(`/api/public/mesa/${token}/chamar-garcom`, { method: 'POST', session, body: { tipo } }); setFeedback(resposta.mensagem) } catch (erro) { setFeedback(erro.message) } }

  if (carregando) return <main style={styles.loading}>Carregando cardápio…</main>
  if (!dados) return <main style={styles.loading}><div><strong>Não foi possível acessar esta mesa.</strong><p>{feedback || 'Leia novamente o QR Code disponível na mesa.'}</p></div></main>
  return <main style={styles.page}>
    <header style={styles.header}><div><div style={styles.logo}>KYTTO</div><div style={styles.sub}>{dados.empresa?.nome}</div></div><div style={styles.mesa}>{dados.mesa?.nome || `Mesa ${dados.mesa?.numero}`}</div></header>
    <section style={styles.hero}><h1 style={{ margin: 0, fontSize: 25 }}>Faça seu pedido</h1><p style={{ margin: '7px 0 0', opacity: .75 }}>Escolha seus itens e envie diretamente para a equipe.</p></section>
    {feedback && <div style={styles.feedback}>{feedback}<button onClick={() => setFeedback('')} style={styles.clear}>×</button></div>}
    <div style={styles.tools}><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar no cardápio" style={styles.input} /><div style={styles.categories}>{categorias.map(item => <button key={item} onClick={() => setCategoria(item)} style={{ ...styles.category, ...(categoria === item ? styles.categoryActive : {}) }}>{item}</button>)}</div></div>
    <section style={styles.grid}>{produtos.map(produto => <button key={produto.id} onClick={() => abrirProduto(produto)} style={styles.product}><div style={styles.emoji}>{produto.emoji || '🍽️'}</div><div style={styles.productName}>{produto.nome}</div><small style={{ color: '#6a7480' }}>{produto.marca || produto.tipo || produto.cat}</small><div style={styles.price}>{fmt(produto.preco)}</div>{(produto.gruposModificadores || []).length > 0 && <small style={{ color: '#FF6B2C', fontWeight: 800 }}>Personalizável</small>}</button>)}</section>
    {produtos.length === 0 && <p style={{ textAlign: 'center', color: '#6a7480', padding: 30 }}>Nenhum item encontrado.</p>}
    {carrinho.length > 0 && <aside style={styles.cart}><div><strong>{carrinho.reduce((soma, item) => soma + item.qtd, 0)} item(ns)</strong><div style={{ fontSize: 12, opacity: .76 }}>{carrinho.map(item => `${item.qtd}× ${item.nome}`).join(' · ')}</div></div><div style={{ textAlign: 'right' }}><strong style={{ color: '#FF6B2C' }}>{fmt(total)}</strong><button onClick={enviarPedido} disabled={enviando} style={styles.order}>{enviando ? 'Enviando…' : 'Enviar pedido'}</button></div></aside>}
    <footer style={styles.footer}><button onClick={() => chamar('garcom')} style={styles.footerButton}>Chamar garçom</button><button onClick={() => chamar('conta')} style={styles.footerButton}>Solicitar conta</button></footer>
    {selecionado && <div style={styles.overlay} onClick={() => setSelecionado(null)}><section style={styles.modal} onClick={e => e.stopPropagation()}><button onClick={() => setSelecionado(null)} style={styles.close}>×</button><div style={{ fontSize: 30 }}>{selecionado.emoji || '🍽️'}</div><h2 style={{ color: '#12283F', margin: '6px 0' }}>{selecionado.nome}</h2><strong style={styles.price}>{fmt(Number(selecionado.preco) + totalAdicionais(selecionado, selecoes))}</strong>{(selecionado.gruposModificadores || []).map(grupo => <div key={grupo.id} style={styles.group}><strong>{grupo.nome} {grupo.obrigatorio && <span style={{ color: '#c2451f' }}>*</span>}</strong><small style={{ display: 'block', color: '#6a7480', margin: '3px 0 7px' }}>Escolha de {grupo.minimo} até {grupo.maximo}</small><div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{grupo.opcoes.map(opcao => { const ativo = selecoes.some(item => item.grupoId === grupo.id && item.opcaoId === opcao.id); return <button key={opcao.id} onClick={() => alternar(grupo, opcao)} style={{ ...styles.option, ...(ativo ? styles.optionActive : {}) }}>{ativo ? '✓ ' : ''}{opcao.nome}{opcao.precoAdicional ? ` +${fmt(opcao.precoAdicional)}` : ''}</button> })}</div></div>)}<label style={{ display: 'block', fontWeight: 700, color: '#12283F' }}>Observação<textarea value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex.: sem gelo, bem passado" style={{ ...styles.input, minHeight: 64, marginTop: 5 }} /></label><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}><div><button onClick={() => setQuantidade(q => Math.max(1, q - 1))} style={styles.quantity}>−</button><strong style={{ padding: 12 }}>{quantidade}</strong><button onClick={() => setQuantidade(q => Math.min(99, q + 1))} style={styles.quantity}>+</button></div><button onClick={adicionar} style={styles.add}>Adicionar {fmt((Number(selecionado.preco) + totalAdicionais(selecionado, selecoes)) * quantidade)}</button></div></section></div>}
  </main>
}

const styles = { page: { minHeight: '100vh', background: '#FFF4EC', color: '#12283F', paddingBottom: 90, fontFamily: 'Inter,system-ui,sans-serif' }, loading: { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#FFF4EC', color: '#12283F', fontFamily: 'Inter,system-ui,sans-serif', textAlign: 'center', padding: 24 }, header: { background: '#12283F', color: '#FFF4EC', padding: '16px max(18px,calc((100vw - 900px)/2))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, logo: { color: '#FF6B2C', letterSpacing: '.12em', fontWeight: 950, fontSize: 20 }, sub: { fontSize: 12, opacity: .75 }, mesa: { background: '#FF6B2C', color: '#12283F', borderRadius: 999, fontWeight: 850, fontSize: 13, padding: '7px 11px' }, hero: { maxWidth: 900, margin: '0 auto', padding: '22px 18px 14px' }, feedback: { maxWidth: 860, margin: '0 auto 12px', background: '#fff', border: '1px solid #FFB18F', color: '#12283F', borderRadius: 10, padding: '10px 38px 10px 13px', position: 'relative', fontWeight: 600, fontSize: 13 }, clear: { position: 'absolute', right: 10, top: 5, border: 0, background: 'transparent', fontSize: 22, cursor: 'pointer', color: '#12283F' }, tools: { maxWidth: 900, margin: '0 auto', padding: '0 18px 14px' }, input: { boxSizing: 'border-box', width: '100%', border: '1px solid #D6BCAF', borderRadius: 10, padding: '11px 12px', background: '#fff', color: '#12283F', font: 'inherit' }, categories: { display: 'flex', overflowX: 'auto', gap: 8, paddingTop: 10 }, category: { border: '1px solid #D6BCAF', borderRadius: 999, padding: '7px 11px', background: '#fff', color: '#12283F', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer' }, categoryActive: { background: '#12283F', color: '#FFF4EC', borderColor: '#12283F' }, grid: { maxWidth: 900, margin: '0 auto', padding: '0 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(145px,1fr))', gap: 10 }, product: { minHeight: 160, border: '1px solid #E9D4C8', background: '#fff', borderRadius: 13, padding: 12, textAlign: 'left', cursor: 'pointer', color: '#12283F', display: 'flex', flexDirection: 'column', gap: 4 }, emoji: { fontSize: 30 }, productName: { fontWeight: 850, fontSize: 14, lineHeight: 1.2 }, price: { marginTop: 'auto', color: '#E45116', fontWeight: 900, fontSize: 16 }, cart: { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 4, background: '#12283F', color: '#FFF4EC', padding: '10px max(18px,calc((100vw - 860px)/2))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, boxShadow: '0 -6px 25px #12283F33' }, order: { display: 'block', marginTop: 5, border: 0, borderRadius: 8, padding: '8px 11px', background: '#FF6B2C', color: '#12283F', fontWeight: 900, cursor: 'pointer' }, footer: { maxWidth: 900, margin: '26px auto 0', padding: '0 18px', display: 'flex', gap: 9 }, footerButton: { flex: 1, border: '1px solid #12283F', background: 'transparent', color: '#12283F', borderRadius: 9, padding: 11, fontWeight: 800, cursor: 'pointer' }, overlay: { position: 'fixed', inset: 0, zIndex: 10, background: '#12283F99', display: 'grid', placeItems: 'end center' }, modal: { boxSizing: 'border-box', width: 'min(640px,100%)', maxHeight: '90vh', overflow: 'auto', background: '#FFF4EC', borderRadius: '18px 18px 0 0', padding: 20, position: 'relative' }, close: { position: 'absolute', right: 14, top: 9, border: 0, background: 'transparent', color: '#12283F', cursor: 'pointer', fontSize: 25 }, group: { margin: '14px 0', padding: 11, background: '#fff', border: '1px solid #E9D4C8', borderRadius: 10 }, option: { border: '1px solid #D6BCAF', color: '#12283F', background: '#fff', padding: '7px 9px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12 }, optionActive: { borderColor: '#FF6B2C', background: '#FFE4D6' }, quantity: { border: '1px solid #D6BCAF', borderRadius: 7, background: '#fff', color: '#12283F', width: 30, height: 30, fontSize: 20, cursor: 'pointer' }, add: { border: 0, borderRadius: 9, padding: '10px 12px', background: '#FF6B2C', color: '#12283F', fontWeight: 900, cursor: 'pointer' } }

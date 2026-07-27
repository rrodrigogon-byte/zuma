import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, fmtDate, fmtDateOnly, fmtQtd, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const TABS = ['Produtos', 'Lotes & Validade', 'Promoções', 'Etiquetas', 'Transferências']
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', boxSizing: 'border-box' }
const labelStyle = { display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 5, fontWeight: 600 }
const panelStyle = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12 }

function Modal({ title, children, onClose, width = 620 }) {
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 1000, padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6, 13, 24, .74)' }}>
      <div style={{ width: '100%', maxWidth: width, maxHeight: '92vh', overflowY: 'auto', padding: 26, borderRadius: 16, background: 'var(--bg)', border: '1px solid var(--line)', boxShadow: '0 24px 70px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
          <button onClick={onClose} aria-label="Fechar" style={{ border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 22 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Status({ children, tone = 'neutral' }) {
  const colors = {
    success: ['#dcfce7', '#166534'], danger: ['#fee2e2', '#b91c1c'], warning: ['#fef3c7', '#92400e'], neutral: ['var(--card2)', 'var(--muted)'], info: ['#dbeafe', '#1d4ed8'],
  }
  return <span style={{ display: 'inline-block', borderRadius: 999, padding: '3px 8px', background: colors[tone][0], color: colors[tone][1], fontSize: 11, fontWeight: 700 }}>{children}</span>
}

function statusValidade(lote) {
  const status = lote.situacao_validade
  if (status === 'vencido') return <Status tone="danger">VENCIDO</Status>
  if (status === 'critico') return <Status tone="danger">Vence em {lote.dias_para_vencer} dias</Status>
  if (status === 'atencao') return <Status tone="warning">Vence em {lote.dias_para_vencer} dias</Status>
  if (status === 'sem_validade') return <Status>Sem validade</Status>
  return <Status tone="success">Normal</Status>
}

function promocaoDescricao(promo) {
  if (promo.tipo === 'percentual') return `${Number(promo.percentual_desconto || 0)}% OFF`
  if (promo.tipo === 'valor_fixo') return `${fmtR(promo.valor_desconto)} de desconto`
  if (promo.tipo === 'preco_fixo') return `Preço fixo: ${fmtR(promo.preco_fixo)}`
  if (promo.tipo === 'leve_pague') return `Leve ${promo.quantidade_leve}, pague ${promo.quantidade_pague}`
  return 'Combo promocional'
}

function transferenciaTom(transferencia) {
  const porStatus = {
    rascunho: 'neutral', em_transito: 'info', recebida_parcial: 'warning', recebida: 'success', cancelada: 'danger',
  }
  return porStatus[transferencia.status] || 'neutral'
}

export default function Supermercado() {
  const { toast } = useToast()
  const [tab, setTab] = useState('Produtos')
  const [produtos, setProdutos] = useState([])
  const [lotes, setLotes] = useState([])
  const [promocoes, setPromocoes] = useState([])
  const [etiquetas, setEtiquetas] = useState([])
  const [transferencias, setTransferencias] = useState([])
  const [lojas, setLojas] = useState([])
  const [terminais, setTerminais] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState(null)
  const [busca, setBusca] = useState('')
  const [filtroVencendo, setFiltroVencendo] = useState(false)
  const [produtoSelecionado, setProdutoSelecionado] = useState(null)
  const [formConfig, setFormConfig] = useState({ preco_venda: '', preco_promocional: '', estoque_minimo: '', ponto_reposicao: '' })
  const [formEtiqueta, setFormEtiqueta] = useState({ quantidade: 1, formato: 'gondola_100x40', terminal_id: '' })
  const [formPromo, setFormPromo] = useState({ codigo: '', nome: '', tipo: 'percentual', status: 'rascunho', percentual_desconto: '', valor_desconto: '', preco_fixo: '', quantidade_leve: '', quantidade_pague: '', data_inicio: '', data_fim: '', produto_ids: [] })
  const [formTransferencia, setFormTransferencia] = useState({ loja_destino_id: '', observacoes: '', itens: [] })

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [prodData, loteData, promoData, etiquetaData, transfData, lojasData, terminaisData] = await Promise.all([
        api.get('/api/supermercado/produtos?limit=500'),
        api.get('/api/supermercado/lotes').catch(() => ({ lotes: [] })),
        api.get('/api/supermercado/promocoes').catch(() => ({ promocoes: [] })),
        api.get('/api/supermercado/etiquetas').catch(() => ({ etiquetas: [] })),
        api.get('/api/supermercado/transferencias').catch(() => ({ transferencias: [] })),
        api.get('/api/lojas').catch(() => ({ lojas: [] })),
        api.get('/api/pdv-offline/terminais').catch(() => ({ terminais: [] })),
      ])
      setProdutos(prodData.produtos || [])
      setLotes(loteData.lotes || [])
      setPromocoes(promoData.promocoes || [])
      setEtiquetas(etiquetaData.etiquetas || [])
      setTransferencias(transfData.transferencias || [])
      setLojas(lojasData.lojas || lojasData || [])
      setTerminais(terminaisData.terminais || [])
    } catch (error) {
      toast(error.message || 'Não foi possível carregar a operação de supermercado', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { carregar() }, [carregar])

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return produtos
    return produtos.filter((produto) => [produto.nome, produto.codigo_interno, produto.codigo_barras, produto.plu, produto.departamento].filter(Boolean).some((valor) => String(valor).toLowerCase().includes(termo)))
  }, [produtos, busca])

  const lotesFiltrados = useMemo(() => lotes.filter((lote) => {
    const buscaOk = !busca || [lote.produto_nome, lote.lote, lote.codigo_interno].filter(Boolean).some((valor) => String(valor).toLowerCase().includes(busca.toLowerCase()))
    const vencendoOk = !filtroVencendo || ['vencido', 'critico', 'atencao'].includes(lote.situacao_validade)
    return buscaOk && vencendoOk
  }), [lotes, busca, filtroVencendo])

  const lotesCriticos = lotes.filter((lote) => ['vencido', 'critico'].includes(lote.situacao_validade)).length

  function abrirConfiguracao(produto) {
    setProdutoSelecionado(produto)
    setFormConfig({
      preco_venda: produto.preco_venda_loja ?? produto.preco_venda ?? '',
      preco_promocional: produto.preco_promocional_loja ?? '',
      estoque_minimo: produto.estoque_minimo ?? '',
      ponto_reposicao: produto.ponto_reposicao ?? '',
    })
    setModal('configurar')
  }

  async function salvarConfiguracao() {
    if (!produtoSelecionado) return
    setBusy(true)
    try {
      await api.put(`/api/supermercado/produtos/${produtoSelecionado.id}/configuracao-loja`, {
        preco_venda: formConfig.preco_venda,
        preco_promocional: formConfig.preco_promocional || null,
        estoque_minimo: formConfig.estoque_minimo || null,
        ponto_reposicao: formConfig.ponto_reposicao || null,
      })
      toast('Configuração comercial salva para a loja ativa.', 'success')
      setModal(null)
      carregar()
    } catch (error) {
      toast(error.message, 'error')
    } finally { setBusy(false) }
  }

  function abrirEtiqueta(produto) {
    setProdutoSelecionado(produto)
    setFormEtiqueta({ quantidade: 1, formato: 'gondola_100x40', terminal_id: '' })
    setModal('etiqueta')
  }

  async function gerarEtiqueta() {
    setBusy(true)
    try {
      const resposta = await api.post('/api/supermercado/etiquetas', {
        produto_id: produtoSelecionado.id,
        quantidade: Number(formEtiqueta.quantidade),
        formato: formEtiqueta.formato,
        terminal_id: formEtiqueta.terminal_id || null,
      })
      toast(resposta.mensagem || 'Etiqueta registrada.', 'success')
      setModal(null)
      carregar()
    } catch (error) { toast(error.message, 'error') }
    finally { setBusy(false) }
  }

  function alternarProdutoPromocao(produtoId) {
    setFormPromo((atual) => ({
      ...atual,
      produto_ids: atual.produto_ids.includes(produtoId)
        ? atual.produto_ids.filter((id) => id !== produtoId)
        : [...atual.produto_ids, produtoId],
    }))
  }

  async function salvarPromocao() {
    if (!formPromo.nome || !formPromo.codigo || formPromo.produto_ids.length === 0) {
      toast('Informe código, nome e ao menos um produto.', 'error')
      return
    }
    setBusy(true)
    try {
      await api.post('/api/supermercado/promocoes', {
        ...formPromo,
        percentual_desconto: formPromo.percentual_desconto || null,
        valor_desconto: formPromo.valor_desconto || null,
        preco_fixo: formPromo.preco_fixo || null,
        quantidade_leve: formPromo.quantidade_leve || null,
        quantidade_pague: formPromo.quantidade_pague || null,
      })
      toast('Promoção criada com sucesso.', 'success')
      setModal(null)
      setFormPromo({ codigo: '', nome: '', tipo: 'percentual', status: 'rascunho', percentual_desconto: '', valor_desconto: '', preco_fixo: '', quantidade_leve: '', quantidade_pague: '', data_inicio: '', data_fim: '', produto_ids: [] })
      carregar()
    } catch (error) { toast(error.message, 'error') }
    finally { setBusy(false) }
  }

  async function atualizarStatusPromocao(promocao, status) {
    setBusy(true)
    try {
      await api.patch(`/api/supermercado/promocoes/${promocao.id}/status`, { status })
      toast('Status da promoção atualizado.', 'success')
      carregar()
    } catch (error) { toast(error.message, 'error') }
    finally { setBusy(false) }
  }

  function abrirTransferencia() {
    setFormTransferencia({ loja_destino_id: '', observacoes: '', itens: [] })
    setModal('transferencia')
  }

  function adicionarItemTransferencia(produto) {
    setFormTransferencia((atual) => {
      if (atual.itens.some((item) => item.produto_id === produto.id)) return atual
      return { ...atual, itens: [...atual.itens, { produto_id: produto.id, nome: produto.nome, quantidade: 1, custo_unitario: produto.preco_custo || 0 }] }
    })
  }

  function atualizarItemTransferencia(produtoId, chave, valor) {
    setFormTransferencia((atual) => ({ ...atual, itens: atual.itens.map((item) => item.produto_id === produtoId ? { ...item, [chave]: valor } : item) }))
  }

  function removerItemTransferencia(produtoId) {
    setFormTransferencia((atual) => ({ ...atual, itens: atual.itens.filter((item) => item.produto_id !== produtoId) }))
  }

  async function salvarTransferencia() {
    if (!formTransferencia.loja_destino_id || formTransferencia.itens.length === 0) {
      toast('Selecione a loja de destino e ao menos um item.', 'error')
      return
    }
    setBusy(true)
    try {
      await api.post('/api/supermercado/transferencias', {
        loja_destino_id: formTransferencia.loja_destino_id,
        observacoes: formTransferencia.observacoes || null,
        itens: formTransferencia.itens.map((item) => ({ produto_id: item.produto_id, quantidade: Number(item.quantidade), custo_unitario: Number(item.custo_unitario || 0) })),
      })
      toast('Transferência criada em rascunho.', 'success')
      setModal(null)
      carregar()
    } catch (error) { toast(error.message, 'error') }
    finally { setBusy(false) }
  }

  async function acaoTransferencia(transferencia, acao) {
    const mensagens = { enviar: 'Enviar esta transferência e baixar o estoque da origem?', receber: 'Confirmar o recebimento de todos os itens pendentes?', cancelar: 'Cancelar este rascunho de transferência?' }
    if (!window.confirm(mensagens[acao])) return
    setBusy(true)
    try {
      const resposta = await api.post(`/api/supermercado/transferencias/${transferencia.id}/${acao}`, {})
      toast(resposta.mensagem || 'Transferência atualizada.', 'success')
      carregar()
    } catch (error) { toast(error.message, 'error') }
    finally { setBusy(false) }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 25 }}>Supermercado e Operação de Loja</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 14 }}>PLU, produtos pesáveis, validade, promoção, etiquetas e transferências com rastreabilidade.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tab === 'Produtos' && <button className="btn-primary" onClick={() => setModal('buscar')}>Buscar por PLU / código</button>}
          {tab === 'Promoções' && <button className="btn-primary" onClick={() => setModal('promocao')}>Nova promoção</button>}
          {tab === 'Transferências' && <button className="btn-primary" onClick={abrirTransferencia}>Nova transferência</button>}
          <button onClick={carregar} disabled={loading || busy} style={{ padding: '9px 13px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', cursor: 'pointer' }}>Atualizar</button>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginBottom: 22 }}>
        <div style={{ ...panelStyle, padding: 16 }}><div style={{ color: 'var(--muted)', fontSize: 12 }}>Produtos no sortimento</div><strong style={{ display: 'block', fontSize: 24, marginTop: 4 }}>{produtos.length}</strong></div>
        <div style={{ ...panelStyle, padding: 16 }}><div style={{ color: 'var(--muted)', fontSize: 12 }}>Lotes críticos ou vencidos</div><strong style={{ display: 'block', fontSize: 24, marginTop: 4, color: lotesCriticos ? '#dc2626' : 'var(--fg)' }}>{lotesCriticos}</strong></div>
        <div style={{ ...panelStyle, padding: 16 }}><div style={{ color: 'var(--muted)', fontSize: 12 }}>Promoções cadastradas</div><strong style={{ display: 'block', fontSize: 24, marginTop: 4 }}>{promocoes.length}</strong></div>
        <div style={{ ...panelStyle, padding: 16 }}><div style={{ color: 'var(--muted)', fontSize: 12 }}>Transferências em trânsito</div><strong style={{ display: 'block', fontSize: 24, marginTop: 4 }}>{transferencias.filter((transferencia) => transferencia.status === 'em_transito').length}</strong></div>
      </section>

      <nav style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: 4, marginBottom: 18, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--line)' }}>
        {TABS.map((item) => <button key={item} onClick={() => setTab(item)} style={{ padding: '9px 14px', borderRadius: 7, border: 0, cursor: 'pointer', background: tab === item ? 'var(--accent)' : 'transparent', color: tab === item ? '#fff' : 'var(--muted)', fontWeight: tab === item ? 700 : 500 }}>{item}</button>)}
      </nav>

      {loading ? <div style={{ textAlign: 'center', padding: 70, color: 'var(--muted)' }}>Carregando dados operacionais...</div> : (
        <>
          {tab === 'Produtos' && <section style={panelStyle}>
            <div style={{ padding: 14, borderBottom: '1px solid var(--line)', display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Nome, EAN, SKU, PLU ou departamento" style={{ ...inputStyle, maxWidth: 420 }} />
              <span style={{ color: 'var(--muted)', alignSelf: 'center', fontSize: 13 }}>{produtosFiltrados.length} produto(s)</span>
            </div>
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead><tr style={{ background: 'var(--card2)', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>
                {['Código / PLU', 'Produto', 'Departamento', 'Preço final', 'Estoque', 'Operação', 'Ações'].map((coluna) => <th key={coluna} style={{ textAlign: coluna === 'Preço final' || coluna === 'Estoque' ? 'right' : 'left', padding: '11px 14px' }}>{coluna}</th>)}
              </tr></thead>
              <tbody>{produtosFiltrados.length === 0 ? <tr><td colSpan="7" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Nenhum produto encontrado para a loja ativa.</td></tr> : produtosFiltrados.map((produto) => {
                const abaixoMinimo = Number(produto.saldo_estoque) <= Number(produto.estoque_minimo || 0)
                return <tr key={produto.id} style={{ borderTop: '1px solid var(--line)', background: abaixoMinimo ? '#fef2f2' : 'transparent' }}>
                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 12 }}>{produto.codigo_barras || produto.codigo_interno || '—'}{produto.plu && <div style={{ color: 'var(--muted)' }}>PLU {produto.plu}</div>}</td>
                  <td style={{ padding: '12px 14px' }}><strong>{produto.nome}</strong>{produto.promocao && <div style={{ marginTop: 4 }}><Status tone="success">{produto.promocao.codigo}</Status></div>}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--muted)' }}>{produto.departamento || '—'}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}><strong style={{ color: '#15803d' }}>{fmtR(produto.preco_final)}</strong>{produto.preco_final !== produto.preco_base && <div style={{ color: 'var(--muted)', textDecoration: 'line-through', fontSize: 11 }}>{fmtR(produto.preco_base)}</div>}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: abaixoMinimo ? '#dc2626' : 'var(--fg)' }}><strong>{fmtQtd(produto.saldo_estoque, produto.unidade_medida)}</strong><div style={{ fontSize: 11 }}>mín. {fmtQtd(produto.estoque_minimo, produto.unidade_medida)}</div></td>
                  <td style={{ padding: '12px 14px' }}>{produto.pesavel && <Status tone="info">Pesável</Status>} {produto.controla_lote && <Status tone="warning">Lote</Status>}</td>
                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}><button onClick={() => abrirConfiguracao(produto)} style={{ marginRight: 7, padding: '6px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Preço</button><button onClick={() => abrirEtiqueta(produto)} style={{ padding: '6px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Etiqueta</button></td>
                </tr>
              })}</tbody>
            </table></div>
          </section>}

          {tab === 'Lotes & Validade' && <section>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar produto, código ou lote" style={{ ...inputStyle, maxWidth: 350 }} />
              <label style={{ display: 'flex', gap: 7, alignItems: 'center', color: 'var(--muted)', fontSize: 13 }}><input type="checkbox" checked={filtroVencendo} onChange={(event) => setFiltroVencendo(event.target.checked)} />Exibir vencidos ou a vencer</label>
            </div>
            <div style={panelStyle}><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}><thead><tr style={{ background: 'var(--card2)', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>{['Produto', 'Lote', 'Saldo', 'Validade', 'Situação'].map((coluna) => <th key={coluna} style={{ padding: '11px 14px', textAlign: coluna === 'Saldo' ? 'right' : 'left' }}>{coluna}</th>)}</tr></thead><tbody>{lotesFiltrados.length === 0 ? <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhum lote encontrado.</td></tr> : lotesFiltrados.map((lote) => <tr key={lote.id} style={{ borderTop: '1px solid var(--line)' }}><td style={{ padding: '12px 14px' }}><strong>{lote.produto_nome}</strong><div style={{ fontSize: 11, color: 'var(--muted)' }}>{lote.codigo_interno}</div></td><td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>{lote.lote || '—'}</td><td style={{ padding: '12px 14px', textAlign: 'right' }}>{fmtQtd(lote.quantidade, lote.unidade_medida)}</td><td style={{ padding: '12px 14px' }}>{lote.validade ? fmtDateOnly(lote.validade) : '—'}</td><td style={{ padding: '12px 14px' }}>{statusValidade(lote)}</td></tr>)}</tbody></table></div></div>
          </section>}

          {tab === 'Promoções' && <section>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>{promocoes.length === 0 ? <div style={{ ...panelStyle, padding: 40, textAlign: 'center', color: 'var(--muted)', gridColumn: '1/-1' }}>Nenhuma promoção cadastrada para a loja ativa.</div> : promocoes.map((promo) => <article key={promo.id} style={{ ...panelStyle, padding: 18 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}><div><strong>{promo.nome}</strong><div style={{ marginTop: 5, color: 'var(--muted)', fontSize: 12 }}>{promo.codigo} · {promo.total_itens} item(ns)</div></div><Status tone={promo.status === 'ativa' ? 'success' : promo.status === 'pausada' ? 'warning' : 'neutral'}>{promo.status}</Status></div><div style={{ margin: '18px 0 8px', fontSize: 20, color: 'var(--accent)', fontWeight: 800 }}>{promocaoDescricao(promo)}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtDate(promo.data_inicio)} até {fmtDate(promo.data_fim)}</div><div style={{ display: 'flex', gap: 8, marginTop: 16 }}>{promo.status !== 'ativa' && <button onClick={() => atualizarStatusPromocao(promo, 'ativa')} disabled={busy} style={{ padding: '6px 9px', cursor: 'pointer', borderRadius: 6, border: '1px solid #86efac', background: '#f0fdf4', color: '#15803d' }}>Ativar</button>}{promo.status === 'ativa' && <button onClick={() => atualizarStatusPromocao(promo, 'pausada')} disabled={busy} style={{ padding: '6px 9px', cursor: 'pointer', borderRadius: 6, border: '1px solid #fde68a', background: '#fffbeb', color: '#a16207' }}>Pausar</button>} {!['encerrada', 'cancelada'].includes(promo.status) && <button onClick={() => atualizarStatusPromocao(promo, 'encerrada')} disabled={busy} style={{ padding: '6px 9px', cursor: 'pointer', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)' }}>Encerrar</button>}</div></article>)}</div>
          </section>}

          {tab === 'Etiquetas' && <section style={panelStyle}><div style={{ padding: 15, borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: 13 }}>Solicitações de etiquetas de gôndola e filas de impressão local. Use a ação “Etiqueta” na aba de produtos para criar uma nova solicitação.</div><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}><thead><tr style={{ background: 'var(--card2)', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>{['Produto', 'Formato', 'Qtd.', 'Preço exibido', 'Status', 'Solicitada em'].map((coluna) => <th key={coluna} style={{ padding: '11px 14px', textAlign: coluna === 'Qtd.' || coluna === 'Preço exibido' ? 'right' : 'left' }}>{coluna}</th>)}</tr></thead><tbody>{etiquetas.length === 0 ? <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhuma etiqueta solicitada.</td></tr> : etiquetas.map((etiqueta) => <tr key={etiqueta.id} style={{ borderTop: '1px solid var(--line)' }}><td style={{ padding: '12px 14px' }}>{etiqueta.produto_nome}</td><td style={{ padding: '12px 14px' }}>{etiqueta.formato}</td><td style={{ padding: '12px 14px', textAlign: 'right' }}>{etiqueta.quantidade}</td><td style={{ padding: '12px 14px', textAlign: 'right' }}>{fmtR(etiqueta.preco_exibido)}</td><td style={{ padding: '12px 14px' }}><Status tone={etiqueta.status_impressao === 'falha' ? 'danger' : etiqueta.status_impressao === 'concluido' ? 'success' : 'warning'}>{etiqueta.status_impressao || etiqueta.status}</Status>{etiqueta.erro_ultima_tentativa && <div style={{ marginTop: 4, maxWidth: 230, color: '#dc2626', fontSize: 11 }}>{etiqueta.erro_ultima_tentativa}</div>}</td><td style={{ padding: '12px 14px' }}>{fmtDate(etiqueta.data_criacao)}</td></tr>)}</tbody></table></div></section>}

          {tab === 'Transferências' && <section style={panelStyle}><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}><thead><tr style={{ background: 'var(--card2)', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>{['Número', 'Origem', 'Destino', 'Itens', 'Status', 'Criada em', 'Ações'].map((coluna) => <th key={coluna} style={{ padding: '11px 14px', textAlign: 'left' }}>{coluna}</th>)}</tr></thead><tbody>{transferencias.length === 0 ? <tr><td colSpan="7" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nenhuma transferência encontrada para a loja ativa.</td></tr> : transferencias.map((transferencia) => <tr key={transferencia.id} style={{ borderTop: '1px solid var(--line)' }}><td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 12 }}>{transferencia.numero}</td><td style={{ padding: '12px 14px' }}>{transferencia.loja_origem_nome}</td><td style={{ padding: '12px 14px' }}>{transferencia.loja_destino_nome}</td><td style={{ padding: '12px 14px' }}>{transferencia.total_itens}</td><td style={{ padding: '12px 14px' }}><Status tone={transferenciaTom(transferencia)}>{transferencia.status.replaceAll('_', ' ')}</Status></td><td style={{ padding: '12px 14px' }}>{fmtDate(transferencia.data_criacao)}</td><td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>{transferencia.status === 'rascunho' && <><button onClick={() => acaoTransferencia(transferencia, 'enviar')} disabled={busy} style={{ marginRight: 6, padding: '6px 9px', borderRadius: 6, border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer' }}>Enviar</button><button onClick={() => acaoTransferencia(transferencia, 'cancelar')} disabled={busy} style={{ padding: '6px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: '#dc2626', cursor: 'pointer' }}>Cancelar</button></>}{['em_transito', 'recebida_parcial'].includes(transferencia.status) && <button onClick={() => acaoTransferencia(transferencia, 'receber')} disabled={busy} style={{ padding: '6px 9px', borderRadius: 6, border: '1px solid #86efac', background: '#f0fdf4', color: '#15803d', cursor: 'pointer' }}>Receber</button>}</td></tr>)}</tbody></table></div></section>}
        </>
      )}

      {modal === 'buscar' && <BuscarProdutoModal onClose={() => setModal(null)} onResultado={(produto) => { setModal(null); setBusca(produto.codigo_interno || produto.nome); toast(`Produto localizado: ${produto.nome}`, 'success') }} toast={toast} />}
      {modal === 'configurar' && produtoSelecionado && <Modal title={`Preço e reposição — ${produtoSelecionado.nome}`} onClose={() => setModal(null)}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}><div><label style={labelStyle}>Preço de venda (R$)</label><input type="number" min="0" step="0.01" value={formConfig.preco_venda} onChange={(event) => setFormConfig({ ...formConfig, preco_venda: event.target.value })} style={inputStyle} /></div><div><label style={labelStyle}>Preço promocional (R$)</label><input type="number" min="0" step="0.01" value={formConfig.preco_promocional} onChange={(event) => setFormConfig({ ...formConfig, preco_promocional: event.target.value })} style={inputStyle} /></div><div><label style={labelStyle}>Estoque mínimo</label><input type="number" min="0" step="0.001" value={formConfig.estoque_minimo} onChange={(event) => setFormConfig({ ...formConfig, estoque_minimo: event.target.value })} style={inputStyle} /></div><div><label style={labelStyle}>Ponto de reposição</label><input type="number" min="0" step="0.001" value={formConfig.ponto_reposicao} onChange={(event) => setFormConfig({ ...formConfig, ponto_reposicao: event.target.value })} style={inputStyle} /></div></div><ModalActions onCancel={() => setModal(null)} onSave={salvarConfiguracao} busy={busy} label="Salvar configuração" /></Modal>}
      {modal === 'etiqueta' && produtoSelecionado && <Modal title={`Etiquetas — ${produtoSelecionado.nome}`} onClose={() => setModal(null)}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}><div><label style={labelStyle}>Quantidade</label><input type="number" min="1" max="1000" value={formEtiqueta.quantidade} onChange={(event) => setFormEtiqueta({ ...formEtiqueta, quantidade: event.target.value })} style={inputStyle} /></div><div><label style={labelStyle}>Formato</label><select value={formEtiqueta.formato} onChange={(event) => setFormEtiqueta({ ...formEtiqueta, formato: event.target.value })} style={inputStyle}><option value="gondola_100x40">Gôndola 100 × 40</option><option value="gondola_60x40">Gôndola 60 × 40</option><option value="prateleira_90x30">Prateleira 90 × 30</option><option value="balanca_40x30">Balança 40 × 30</option></select></div><div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Terminal de impressão (opcional)</label><select value={formEtiqueta.terminal_id} onChange={(event) => setFormEtiqueta({ ...formEtiqueta, terminal_id: event.target.value })} style={inputStyle}><option value="">Registrar sem enfileirar impressão</option>{terminais.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.nome || terminal.codigo}</option>)}</select><p style={{ color: 'var(--muted)', fontSize: 12, margin: '7px 0 0' }}>Ao selecionar um terminal, a etiqueta será entregue com segurança à fila do agente local.</p></div></div><ModalActions onCancel={() => setModal(null)} onSave={gerarEtiqueta} busy={busy} label="Gerar etiqueta" /></Modal>}
      {modal === 'promocao' && <Modal title="Nova promoção" onClose={() => setModal(null)} width={760}><div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}><div><label style={labelStyle}>Código</label><input value={formPromo.codigo} onChange={(event) => setFormPromo({ ...formPromo, codigo: event.target.value.toUpperCase() })} placeholder="SEMANA-01" style={inputStyle} /></div><div><label style={labelStyle}>Nome</label><input value={formPromo.nome} onChange={(event) => setFormPromo({ ...formPromo, nome: event.target.value })} placeholder="Semana de ofertas" style={inputStyle} /></div><div><label style={labelStyle}>Tipo</label><select value={formPromo.tipo} onChange={(event) => setFormPromo({ ...formPromo, tipo: event.target.value })} style={inputStyle}><option value="percentual">Percentual</option><option value="valor_fixo">Valor fixo</option><option value="preco_fixo">Preço fixo</option><option value="leve_pague">Leve / pague</option><option value="combo">Combo</option></select></div><div><label style={labelStyle}>Status inicial</label><select value={formPromo.status} onChange={(event) => setFormPromo({ ...formPromo, status: event.target.value })} style={inputStyle}><option value="rascunho">Rascunho</option><option value="agendada">Agendada</option><option value="ativa">Ativa</option></select></div><div><label style={labelStyle}>Início</label><input type="datetime-local" value={formPromo.data_inicio} onChange={(event) => setFormPromo({ ...formPromo, data_inicio: event.target.value })} style={inputStyle} /></div><div><label style={labelStyle}>Fim</label><input type="datetime-local" value={formPromo.data_fim} onChange={(event) => setFormPromo({ ...formPromo, data_fim: event.target.value })} style={inputStyle} /></div>{formPromo.tipo === 'percentual' && <div><label style={labelStyle}>Desconto (%)</label><input type="number" min="0.01" max="100" step="0.01" value={formPromo.percentual_desconto} onChange={(event) => setFormPromo({ ...formPromo, percentual_desconto: event.target.value })} style={inputStyle} /></div>}{formPromo.tipo === 'valor_fixo' && <div><label style={labelStyle}>Desconto (R$)</label><input type="number" min="0.01" step="0.01" value={formPromo.valor_desconto} onChange={(event) => setFormPromo({ ...formPromo, valor_desconto: event.target.value })} style={inputStyle} /></div>}{formPromo.tipo === 'preco_fixo' && <div><label style={labelStyle}>Preço fixo (R$)</label><input type="number" min="0" step="0.01" value={formPromo.preco_fixo} onChange={(event) => setFormPromo({ ...formPromo, preco_fixo: event.target.value })} style={inputStyle} /></div>}{formPromo.tipo === 'leve_pague' && <><div><label style={labelStyle}>Leve</label><input type="number" min="1" step="1" value={formPromo.quantidade_leve} onChange={(event) => setFormPromo({ ...formPromo, quantidade_leve: event.target.value })} style={inputStyle} /></div><div><label style={labelStyle}>Pague</label><input type="number" min="1" step="1" value={formPromo.quantidade_pague} onChange={(event) => setFormPromo({ ...formPromo, quantidade_pague: event.target.value })} style={inputStyle} /></div></>}</div><div style={{ marginTop: 18, border: '1px solid var(--line)', borderRadius: 9, padding: 12, maxHeight: 220, overflowY: 'auto' }}><strong style={{ fontSize: 13 }}>Produtos participantes ({formPromo.produto_ids.length})</strong>{produtos.length === 0 ? <p style={{ color: 'var(--muted)' }}>Não há produtos carregados.</p> : produtos.map((produto) => <label key={produto.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}><input type="checkbox" checked={formPromo.produto_ids.includes(produto.id)} onChange={() => alternarProdutoPromocao(produto.id)} /><span>{produto.nome}</span><span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>{fmtR(produto.preco_final)}</span></label>)}</div><ModalActions onCancel={() => setModal(null)} onSave={salvarPromocao} busy={busy} label="Criar promoção" /></Modal>}
      {modal === 'transferencia' && <Modal title="Nova transferência entre lojas" onClose={() => setModal(null)} width={840}><div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}><div><label style={labelStyle}>Loja de destino</label><select value={formTransferencia.loja_destino_id} onChange={(event) => setFormTransferencia({ ...formTransferencia, loja_destino_id: event.target.value })} style={inputStyle}><option value="">Selecione</option>{lojas.map((loja) => <option key={loja.id} value={loja.id}>{loja.nome || loja.codigo}</option>)}</select></div><div><label style={labelStyle}>Observações</label><input value={formTransferencia.observacoes} onChange={(event) => setFormTransferencia({ ...formTransferencia, observacoes: event.target.value })} style={inputStyle} /></div></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}><div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: 12, maxHeight: 300, overflowY: 'auto' }}><strong style={{ fontSize: 13 }}>Adicionar produtos</strong>{produtos.map((produto) => <div key={produto.id} style={{ display: 'flex', gap: 8, justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}><span>{produto.nome}<small style={{ display: 'block', color: 'var(--muted)' }}>Disponível: {fmtQtd(produto.saldo_estoque, produto.unidade_medida)}</small></span><button onClick={() => adicionarItemTransferencia(produto)} disabled={formTransferencia.itens.some((item) => item.produto_id === produto.id)} style={{ padding: '4px 7px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Adicionar</button></div>)}</div><div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: 12, maxHeight: 300, overflowY: 'auto' }}><strong style={{ fontSize: 13 }}>Itens a transferir</strong>{formTransferencia.itens.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum item selecionado.</p> : formTransferencia.itens.map((item) => <div key={item.produto_id} style={{ display: 'grid', gridTemplateColumns: '1fr 75px 34px', gap: 6, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--line)' }}><span style={{ fontSize: 13 }}>{item.nome}</span><input type="number" min="0.001" step="0.001" value={item.quantidade} onChange={(event) => atualizarItemTransferencia(item.produto_id, 'quantidade', event.target.value)} style={{ ...inputStyle, padding: 6 }} /><button onClick={() => removerItemTransferencia(item.produto_id)} style={{ border: 0, background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 18 }}>×</button></div>)}</div></div><ModalActions onCancel={() => setModal(null)} onSave={salvarTransferencia} busy={busy} label="Criar rascunho" /></Modal>}
    </div>
  )
}

function ModalActions({ onCancel, onSave, busy, label }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}><button onClick={onCancel} disabled={busy} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button><button className="btn-primary" onClick={onSave} disabled={busy}>{busy ? 'Processando…' : label}</button></div>
}

function BuscarProdutoModal({ onClose, onResultado, toast }) {
  const [codigo, setCodigo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultado, setResultado] = useState(null)
  async function buscar() {
    if (!codigo.trim()) return
    setBuscando(true)
    try {
      const data = await api.get(`/api/supermercado/produtos/buscar/${encodeURIComponent(codigo.trim())}`)
      setResultado(data.produto)
    } catch (error) { toast(error.message, 'error'); setResultado(null) }
    finally { setBuscando(false) }
  }
  return <Modal title="Consulta por código, PLU ou balança" onClose={onClose} width={520}><label style={labelStyle}>Código lido</label><div style={{ display: 'flex', gap: 8 }}><input autoFocus value={codigo} onChange={(event) => setCodigo(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && buscar()} placeholder="EAN, SKU, PLU ou código de balança" style={inputStyle} /><button className="btn-primary" onClick={buscar} disabled={buscando}>{buscando ? 'Buscando…' : 'Buscar'}</button></div>{resultado && <div style={{ marginTop: 18, padding: 15, borderRadius: 9, background: 'var(--card2)' }}><strong>{resultado.nome}</strong><div style={{ marginTop: 8, display: 'grid', gap: 4, fontSize: 13 }}><span>Preço final: <b>{fmtR(resultado.preco_final)}</b></span><span>Saldo: <b>{fmtQtd(resultado.saldo_estoque, resultado.unidade_medida)}</b></span>{resultado.leitura_balanca && <span>Peso lido: <b>{resultado.leitura_balanca.peso_kg} kg</b> · Valor sugerido: <b>{fmtR(resultado.valor_sugerido)}</b></span>}</div><div style={{ marginTop: 14 }}><button className="btn-primary" onClick={() => onResultado(resultado)}>Usar na lista</button></div></div>}</Modal>
}

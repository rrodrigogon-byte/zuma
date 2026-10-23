import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { useToast } from '../../../hooks/useToast'
import { useAuth } from '../../../lib/auth'
import { lojasDaEmpresa } from '../../../lib/context-selection'
import { useRazaoAtivo } from '../../../lib/razao-estado'
import { Badge, Dialog, Table } from '../customer360/shared'
import { money, shortDate, dateTime } from '../dino/format'
import '../customer360.css'
import '../dino/dino-admin.css'

// Estoque e compras da empresa: itens e saldo por unidade, movimentos, inventário, perdas,
// ficha técnica dos produtos vendidos, pedidos de compra, recebimento (com NF-e) e relatórios.
// Receber uma compra dá entrada no estoque e cria as contas a pagar no Financeiro.
const BASE = '/api/admin/suprimentos'
const ABAS = [
  ['itens', 'Itens e saldos'], ['movimentos', 'Movimentos'], ['inventario', 'Inventário'], ['fichas', 'Ficha técnica'],
  ['compras', 'Pedidos de compra'], ['receber', 'Receber / NF-e'], ['relatorios', 'Reposição e curva ABC'],
]
const UNIDADES = ['UN', 'KG', 'G', 'L', 'ML', 'CX', 'PCT', 'FD', 'DZ', 'M']
const TIPOS = { mercadoria: 'Mercadoria', insumo: 'Insumo', embalagem: 'Embalagem', uso_consumo: 'Uso e consumo' }
const MOVS = { entrada: 'Entrada', saida: 'Saída', venda: 'Venda', ajuste: 'Ajuste', perda: 'Perda', inventario: 'Inventário', transferencia_saida: 'Transferência (saída)', transferencia_entrada: 'Transferência (entrada)' }
const STATUS_PEDIDO = { rascunho: ['Rascunho', 'muted'], enviado: ['Enviado', 'info'], parcial: ['Recebido em parte', 'warning'], recebido: ['Recebido', 'success'], cancelado: ['Cancelado', 'muted'] }
const num = (v, casas = 3) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas })
const chaveUnica = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

// Com o Financeiro novo desligado, a conta a pagar fica guardada e só aparece quando ele for ligado.
const ondeFicaAConta = (razaoAtivo) => (razaoAtivo === true ? 'no Financeiro' : 'guardada(s) para o Financeiro novo (aparecem quando ele for ativado para a empresa)')

export default function Suprimentos({ abaInicial = 'itens' }) {
  const razaoAtivo = useRazaoAtivo()
  const { toast } = useToast()
  const { empresaAtiva, lojaAtiva, lojasAcessiveis } = useAuth()
  const lojas = useMemo(() => lojasDaEmpresa(lojasAcessiveis, empresaAtiva?.id), [lojasAcessiveis, empresaAtiva?.id])
  const [aba, setAba] = useState(abaInicial)
  const [unidade, setUnidade] = useState(() => lojaAtiva?.id || (lojas.length === 1 ? lojas[0].id : ''))
  // Escrita sempre numa unidade: com uma unidade só, "Empresa toda" grava nela.
  const unidadeEscrita = unidade || (lojas.length === 1 ? lojas[0].id : '')
  const precisaUnidade = !unidadeEscrita && lojas.length > 1
  const nomeLoja = useCallback((id) => (id ? lojas.find((l) => String(l.id) === String(id))?.nome || 'Outra unidade' : 'Sem unidade'), [lojas])
  const [itens, setItens] = useState([])
  const [busca, setBusca] = useState('')
  const [soAbaixo, setSoAbaixo] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState(null)
  const [mov, setMov] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const qs = useCallback((extra = {}) => {
    const p = new URLSearchParams()
    if (unidade) p.set('lojaId', unidade)
    for (const [k, v] of Object.entries(extra)) if (v !== '' && v != null && v !== false) p.set(k, v)
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [unidade])

  const carregarItens = useCallback(async () => {
    try { setItens(await api.get(`${BASE}/itens${qs({ q: busca, abaixoDoMinimo: soAbaixo ? 'true' : '' })}`)); setErro('') }
    catch (error) { setErro(error.message || 'Não foi possível carregar o estoque.') }
  }, [qs, busca, soAbaixo])
  useEffect(() => { carregarItens() }, [carregarItens, empresaAtiva?.id])

  async function salvarItem() {
    if (enviando) return
    setEnviando(true)
    try {
      const corpo = { nome: form.nome, sku: form.sku, ean: form.ean, unidade: form.unidade, tipo: form.tipo, categoria: form.categoria, ncm: form.ncm, estoqueMinimo: form.estoqueMinimo || 0 }
      if (form.id) await api.patch(`${BASE}/itens/${form.id}`, corpo)
      else await api.post(`${BASE}/itens`, { ...corpo, custoMedio: form.custoMedio || 0 })
      toast('Item salvo.', 'success'); setForm(null); carregarItens()
    } catch (error) { toast(error.message, 'error') } finally { setEnviando(false) }
  }
  async function salvarMovimento() {
    if (enviando) return
    setEnviando(true)
    try {
      await api.post(`${BASE}/movimentos`, { lojaId: unidadeEscrita || null, itemId: mov.item.id, tipo: mov.tipo, quantidade: mov.quantidade, custoUnitario: mov.tipo === 'entrada' ? mov.custoUnitario : undefined, motivo: mov.motivo, idempotencia: mov.chave })
      toast('Movimento registrado.', 'success'); setMov(null); carregarItens()
    } catch (error) { toast(error.message, 'error') } finally { setEnviando(false) }
  }

  const totalEstoque = itens.reduce((s, i) => s + (i.valorEmEstoque || 0), 0)
  const abaixo = itens.filter((i) => i.abaixoDoMinimo).length

  return <div className="dadm-page">
    <header className="dadm-head">
      <div><div className="dadm-eyebrow">Suprimentos · {empresaAtiva?.nome || 'Empresa'}</div><h1>Estoque e compras</h1>
        <p>O que a empresa compra e controla, por unidade. Receber uma compra dá entrada no estoque e cria as contas a pagar {razaoAtivo === true ? 'no Financeiro' : 'para o Financeiro novo, que aparecem quando ele for ativado para a empresa'}; as vendas do bar e da loja online baixam os insumos pela ficha técnica.</p></div>
      <div className="dadm-actions">
        <label className="dadm-muted">Unidade{' '}
          <select className="c360-input" value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Unidade">
            <option value="">Empresa toda</option>
            {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </label>
        <button type="button" className="c360-btn primary" onClick={() => setForm({ nome: '', sku: '', ean: '', unidade: 'UN', tipo: 'mercadoria', categoria: '', ncm: '', estoqueMinimo: '', custoMedio: '' })}>+ Item</button>
      </div>
    </header>
    <div className="dadm-tabs" role="tablist" aria-label="Seções de estoque e compras">
      {ABAS.map(([id, rotulo]) => <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}>{rotulo}</button>)}
    </div>
    {erro && <p className="dadm-note danger" role="alert">{erro}</p>}

    {aba === 'itens' && <section className="dadm-card">
      <section className="dadm-kpis" aria-label="Resumo do estoque">
        <article><span>Itens</span><strong>{itens.length}</strong><small>{unidade ? nomeLoja(unidade) : 'Empresa toda'}</small></article>
        <article><span>Valor em estoque</span><strong>{money(totalEstoque)}</strong><small>Pelo custo médio</small></article>
        <article className={abaixo ? 'is-alert' : ''}><span>Abaixo do mínimo</span><strong>{abaixo}</strong><small>Veja a sugestão de compra</small></article>
      </section>
      <div className="dadm-filters">
        <input className="c360-input" type="search" placeholder="Buscar por nome, SKU ou EAN" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar item" />
        <label className="dadm-muted"><input type="checkbox" checked={soAbaixo} onChange={(e) => setSoAbaixo(e.target.checked)} /> Só abaixo do mínimo</label>
      </div>
      <Table caption="Itens do estoque" rows={itens} empty="Nenhum item cadastrado. Cadastre o que você compra (ou lance uma NF-e, que cadastra para você)." columns={[
        { key: 'nome', label: 'Item', render: (i) => <div><strong>{i.nome}</strong><div className="dadm-muted">{TIPOS[i.tipo]}{i.sku ? ` · ${i.sku}` : ''}{i.ean ? ` · EAN ${i.ean}` : ''}</div></div> },
        { key: 'saldo', label: 'Saldo', align: 'right', render: (i) => <span className={i.saldo < 0 || i.abaixoDoMinimo ? 'dadm-neg' : ''}>{num(i.saldo)} {i.unidade}</span> },
        { key: 'min', label: 'Mínimo', align: 'right', render: (i) => (i.estoqueMinimo ? `${num(i.estoqueMinimo)} ${i.unidade}` : '—') },
        { key: 'custo', label: 'Custo médio', align: 'right', render: (i) => money(i.custoMedio) },
        { key: 'valor', label: 'Valor', align: 'right', render: (i) => money(i.valorEmEstoque) },
        { key: 'acoes', label: 'Ações', render: (i) => <div className="dadm-actions">
          {['entrada', 'saida', 'perda', 'ajuste'].map((t) => <button key={t} type="button" className="c360-btn ghost" disabled={precisaUnidade} title={precisaUnidade ? 'Escolha a unidade no topo' : ''} onClick={() => setMov({ item: i, tipo: t, quantidade: '', custoUnitario: i.custoMedio || '', motivo: '', chave: chaveUnica() })}>{{ entrada: 'Entrada', saida: 'Saída', perda: 'Perda', ajuste: 'Contar' }[t]}</button>)}
          <button type="button" className="c360-btn ghost" onClick={() => setForm({ ...i, estoqueMinimo: String(i.estoqueMinimo), custoMedio: String(i.custoMedio) })}>Editar</button>
        </div> },
      ]} />
    </section>}

    {aba === 'movimentos' && <Movimentos qs={qs} nomeLoja={nomeLoja} unidade={unidade} />}
    {aba === 'inventario' && <Inventario qs={qs} unidade={unidadeEscrita} precisaUnidade={precisaUnidade} toast={toast} onMudou={carregarItens} />}
    {aba === 'fichas' && <Fichas itens={itens} lojas={lojas} toast={toast} />}
    {aba === 'compras' && <Pedidos itens={itens} unidade={unidadeEscrita} qs={qs} toast={toast} onRecebido={carregarItens} />}
    {aba === 'receber' && <ReceberNfe itens={itens} unidade={unidadeEscrita} precisaUnidade={precisaUnidade} toast={toast} onLancado={carregarItens} />}
    {aba === 'relatorios' && <Relatorios qs={qs} />}

    <Dialog open={Boolean(form)} title={form?.id ? 'Editar item' : 'Novo item'} labelId="sup-item" onClose={() => setForm(null)} onSubmit={salvarItem}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setForm(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={enviando}>Salvar</button></>}>
      {form && <div style={{ display: 'grid', gap: 12 }}>
        <label className="c360-field">Nome<input className="c360-input" required minLength={2} maxLength={180} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="c360-field">Tipo<select className="c360-input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{Object.entries(TIPOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
          <label className="c360-field">Unidade de medida<select className="c360-input" value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })}>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</select></label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="c360-field">SKU (opcional)<input className="c360-input" maxLength={60} value={form.sku || ''} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></label>
          <label className="c360-field">EAN (opcional)<input className="c360-input" inputMode="numeric" maxLength={14} value={form.ean || ''} onChange={(e) => setForm({ ...form, ean: e.target.value })} /></label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="c360-field">Estoque mínimo<input className="c360-input" inputMode="decimal" value={form.estoqueMinimo} onChange={(e) => setForm({ ...form, estoqueMinimo: e.target.value })} /></label>
          {!form.id && <label className="c360-field">Custo inicial (R$)<input className="c360-input" inputMode="decimal" value={form.custoMedio} onChange={(e) => setForm({ ...form, custoMedio: e.target.value })} /></label>}
          {form.id && <label className="c360-field">NCM (opcional)<input className="c360-input" inputMode="numeric" maxLength={8} value={form.ncm || ''} onChange={(e) => setForm({ ...form, ncm: e.target.value })} /></label>}
        </div>
      </div>}
    </Dialog>

    <Dialog open={Boolean(mov)} title={mov ? `${{ entrada: 'Entrada', saida: 'Saída', perda: 'Perda', ajuste: 'Contagem' }[mov.tipo]} · ${mov.item.nome}` : ''} labelId="sup-mov" onClose={() => setMov(null)} onSubmit={salvarMovimento}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setMov(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={enviando}>Registrar</button></>}>
      {mov && <div style={{ display: 'grid', gap: 12 }}>
        <p className="dadm-muted">Saldo atual: {num(mov.item.saldo)} {mov.item.unidade}{unidade ? ` em ${nomeLoja(unidade)}` : ''}.</p>
        <label className="c360-field">{mov.tipo === 'ajuste' ? 'Quantidade contada' : 'Quantidade'} ({mov.item.unidade})<input className="c360-input" required inputMode="decimal" value={mov.quantidade} onChange={(e) => setMov({ ...mov, quantidade: e.target.value })} /></label>
        {mov.tipo === 'entrada' && <label className="c360-field">Custo por {mov.item.unidade} (R$)<input className="c360-input" inputMode="decimal" value={mov.custoUnitario} onChange={(e) => setMov({ ...mov, custoUnitario: e.target.value })} /></label>}
        {['perda', 'ajuste', 'saida'].includes(mov.tipo) && <label className="c360-field">Motivo{mov.tipo !== 'saida' ? '' : ' (opcional)'}<input className="c360-input" required={mov.tipo !== 'saida'} maxLength={240} value={mov.motivo} onChange={(e) => setMov({ ...mov, motivo: e.target.value })} /></label>}
        {mov.tipo === 'entrada' && <p className="dadm-note">Entrada manual não cria conta a pagar. Para compra de fornecedor, use “Receber / NF-e”.</p>}
      </div>}
    </Dialog>
  </div>
}

function Movimentos({ qs, nomeLoja, unidade }) {
  const [lista, setLista] = useState([])
  const [tipo, setTipo] = useState('')
  const [erro, setErro] = useState('')
  useEffect(() => { api.get(`/api/admin/suprimentos/movimentos${qs({ tipo })}`).then((l) => { setLista(l); setErro('') }).catch((e) => { setLista([]); setErro(e.message || 'Não foi possível carregar os movimentos.') }) }, [qs, tipo])
  return <section className="dadm-card">
    <h2>Movimentos</h2>
    {erro && <p className="dadm-note danger" role="alert">{erro}</p>}
    <div className="dadm-filters"><select className="c360-input" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de movimento"><option value="">Todos os tipos</option>{Object.entries(MOVS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
    <Table caption="Movimentos de estoque" rows={lista} empty="Nenhum movimento." columns={[
      { key: 'quando', label: 'Quando', render: (m) => dateTime(m.criadoEm) },
      { key: 'item', label: 'Item', render: (m) => <div><strong>{m.itemNome}</strong>{!unidade && <div className="dadm-muted">{nomeLoja(m.lojaId)}</div>}</div> },
      { key: 'tipo', label: 'Tipo', render: (m) => MOVS[m.tipo] || m.tipo },
      { key: 'qtd', label: 'Quantidade', align: 'right', render: (m) => <span className={m.quantidade < 0 ? 'dadm-neg' : 'dadm-pos'}>{m.quantidade > 0 ? '+' : ''}{num(m.quantidade)} {m.unidade}</span> },
      { key: 'saldo', label: 'Saldo depois', align: 'right', render: (m) => num(m.saldoApos) },
      { key: 'quem', label: 'Motivo / quem', render: (m) => [m.motivo, m.usuario].filter(Boolean).join(' · ') || m.origem },
    ]} />
  </section>
}

function Inventario({ qs, unidade, precisaUnidade, toast, onMudou }) {
  const [lista, setLista] = useState([])
  const [aberto, setAberto] = useState(null)
  const [contagens, setContagens] = useState({})
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const carregar = useCallback(async () => { try { setLista(await api.get(`/api/admin/suprimentos/inventarios${qs()}`)); setErro('') } catch (e) { setLista([]); setErro(e.message || 'Não foi possível carregar os inventários.') } }, [qs])
  useEffect(() => { carregar() }, [carregar])
  async function abrir() {
    try { const inv = await api.post('/api/admin/suprimentos/inventarios', { lojaId: unidade || null, descricao: `Inventário de ${new Date().toLocaleDateString('pt-BR')}` }); setAberto(inv); setContagens({}); carregar() }
    catch (error) { toast(error.message, 'error') }
  }
  async function ver(id) { try { setAberto(await api.get(`/api/admin/suprimentos/inventarios/${id}`)); setContagens({}) } catch (error) { toast(error.message, 'error') } }
  async function salvarContagem() {
    try {
      const lista = Object.entries(contagens).map(([itemId, contado]) => ({ itemId, contado }))
      setAberto(await api.post(`/api/admin/suprimentos/inventarios/${aberto.id}/contagens`, { contagens: lista })); setContagens({}); toast('Contagem salva.', 'success')
    } catch (error) { toast(error.message, 'error') }
  }
  async function concluir() {
    if (enviando) return
    setEnviando(true)
    try { const r = await api.post(`/api/admin/suprimentos/inventarios/${aberto.id}/concluir`, {}); setAberto(r); toast(`Inventário concluído: ${r.ajustes} ajuste(s).`, 'success'); carregar(); onMudou() }
    catch (error) { toast(error.message, 'error') } finally { setEnviando(false) }
  }
  const valorDif = aberto?.itens?.reduce((s, i) => s + (i.valorDiferenca || 0), 0) || 0
  return <section className="dadm-card">
    <h2>Inventário</h2>
    <p className="dadm-muted">Abra, conte item por item e conclua. A diferença vira ajuste de estoque (e perda no DRE quando falta). Vendas feitas durante a contagem são consideradas.</p>
    {erro && <p className="dadm-note danger" role="alert">{erro}</p>}
    <div className="dadm-actions"><button type="button" className="c360-btn primary" disabled={precisaUnidade} onClick={abrir}>Abrir inventário{precisaUnidade ? ' (escolha a unidade)' : ''}</button></div>
    {aberto && <div style={{ marginTop: 14 }}>
      <h3>{aberto.descricao} · <Badge tone={aberto.status === 'aberto' ? 'warning' : 'success'}>{aberto.status}</Badge></h3>
      <Table caption="Itens do inventário" rows={aberto.itens.map((i) => ({ ...i, id: i.itemId }))} empty="Sem itens." columns={[
        { key: 'nome', label: 'Item', render: (i) => `${i.nome} (${i.unidade})` },
        { key: 'sistema', label: 'No sistema', align: 'right', render: (i) => num(i.saldoSistema) },
        { key: 'contado', label: 'Contado', align: 'right', render: (i) => aberto.status === 'aberto'
          ? <input className="c360-input" style={{ width: 100 }} inputMode="decimal" aria-label={`Contado de ${i.nome}`} value={contagens[i.itemId] ?? (i.contado ?? '')} onChange={(e) => setContagens({ ...contagens, [i.itemId]: e.target.value })} />
          : (i.contado === null ? '—' : num(i.contado)) },
        { key: 'dif', label: 'Diferença', align: 'right', render: (i) => (i.diferenca === null ? '—' : <span className={i.diferenca < 0 ? 'dadm-neg' : ''}>{num(i.diferenca)} · {money(i.valorDiferenca)}</span>) },
      ]} />
      {aberto.status === 'aberto' && <div className="dadm-actions" style={{ marginTop: 10 }}>
        <button type="button" className="c360-btn ghost" onClick={salvarContagem} disabled={!Object.keys(contagens).length}>Salvar contagem</button>
        <button type="button" className="c360-btn primary" disabled={enviando} onClick={concluir}>Concluir ({money(valorDif)} de diferença)</button>
      </div>}
    </div>}
    <h3 style={{ marginTop: 18 }}>Histórico</h3>
    <Table caption="Inventários" rows={lista} empty="Nenhum inventário ainda." columns={[
      { key: 'desc', label: 'Inventário', render: (i) => i.descricao },
      { key: 'status', label: 'Situação', render: (i) => <Badge tone={i.status === 'aberto' ? 'warning' : i.status === 'concluido' ? 'success' : 'muted'}>{i.status}</Badge> },
      { key: 'quando', label: 'Aberto em', render: (i) => dateTime(i.criadoEm) },
      { key: 'ver', label: '', render: (i) => <button type="button" className="c360-btn ghost" onClick={() => ver(i.id)}>Abrir</button> },
    ]} />
  </section>
}

function Fichas({ itens, lojas, toast }) {
  const [produtos, setProdutos] = useState([])
  const [fichas, setFichas] = useState([])
  const [editando, setEditando] = useState(null)
  const [config, setConfig] = useState(null)
  useEffect(() => { api.get('/api/admin/suprimentos/config').then(setConfig).catch(() => setConfig(null)) }, [])
  async function salvarLojaBar(lojaBar) {
    try { setConfig(await api.put('/api/admin/suprimentos/config', { lojaBar: lojaBar || null })); toast('Unidade do bar salva.', 'success') } catch (error) { toast(error.message, 'error') }
  }
  const carregar = useCallback(async () => {
    try { const [p, f] = await Promise.all([api.get('/api/admin/suprimentos/produtos-vendidos'), api.get('/api/admin/suprimentos/fichas')]); setProdutos(p); setFichas(f) } catch (error) { toast(error.message, 'error') }
  }, [toast])
  useEffect(() => { carregar() }, [carregar])
  const fichaDe = (p) => fichas.find((f) => f.fonte === p.fonte && f.fonteId === p.id)
  async function salvar() {
    try {
      await api.put('/api/admin/suprimentos/fichas', { fonte: editando.produto.fonte, fonteId: editando.produto.id, itens: editando.linhas.filter((l) => l.itemId).map((l) => ({ itemId: l.itemId, fator: l.fator, espelho: l.espelho })) })
      toast('Ficha salva.', 'success'); setEditando(null); carregar()
    } catch (error) { toast(error.message, 'error') }
  }
  return <section className="dadm-card">
    <h2>Ficha técnica</h2>
    <p className="dadm-muted">Diga quanto de cada item do estoque sai a cada unidade vendida. Ex.: caipirinha = 0,2 KG de limão + 0,05 L de cachaça. Marque “espelhar” quando o produto é o próprio item (cerveja lata): a compra também soma no estoque do bar.</p>
    {lojas.length > 1 && <div className="dadm-filters">
      <label className="dadm-muted">Os insumos das vendas do bar saem de{' '}
        <select className="c360-input" aria-label="Unidade do bar" value={config?.lojaBar || ''} onChange={(e) => salvarLojaBar(e.target.value)}>
          <option value="">— escolha a unidade —</option>
          {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
      </label>
      {config && !config.lojaBarEfetiva && <span className="dadm-note warn">Sem unidade do bar, as vendas baixam de “sem unidade”.</span>}
    </div>}
    <Table caption="Produtos vendidos" rows={produtos.map((p) => ({ ...p, id: p.id }))} empty="Nenhum produto vendido no bar ou na loja online." columns={[
      { key: 'nome', label: 'Produto', render: (p) => <div><strong>{p.nome}</strong><div className="dadm-muted">{p.grupo}</div></div> },
      { key: 'ficha', label: 'Consome', render: (p) => { const f = fichaDe(p); return f ? f.itens.map((i) => `${num(i.fator)} ${i.unidade} ${i.nome}${i.espelho ? ' (espelho)' : ''}`).join(' + ') : <span className="dadm-muted">sem ficha</span> } },
      { key: 'custo', label: 'Custo', align: 'right', render: (p) => { const f = fichaDe(p); return f ? money(f.custo) : '—' } },
      { key: 'acao', label: '', render: (p) => <button type="button" className="c360-btn ghost" onClick={() => setEditando({ produto: p, linhas: (fichaDe(p)?.itens || []).map((i) => ({ ...i })).concat([{ itemId: '', fator: '', espelho: false }]) })}>Editar</button> },
    ]} />
    <Dialog open={Boolean(editando)} title={editando ? `Ficha · ${editando.produto.nome}` : ''} labelId="sup-ficha" onClose={() => setEditando(null)} onSubmit={salvar}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setEditando(null)}>Voltar</button><button type="submit" className="c360-btn primary">Salvar ficha</button></>}>
      {editando && <div style={{ display: 'grid', gap: 8 }}>
        {editando.linhas.map((l, idx) => <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, alignItems: 'end' }}>
          <label className="c360-field">Item<select className="c360-input" value={l.itemId} onChange={(e) => { const linhas = [...editando.linhas]; linhas[idx] = { ...l, itemId: e.target.value }; if (idx === linhas.length - 1 && e.target.value) linhas.push({ itemId: '', fator: '', espelho: false }); setEditando({ ...editando, linhas }) }}><option value="">—</option>{itens.map((i) => <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>)}</select></label>
          <label className="c360-field">Por venda<input className="c360-input" inputMode="decimal" value={l.fator} onChange={(e) => { const linhas = [...editando.linhas]; linhas[idx] = { ...l, fator: e.target.value }; setEditando({ ...editando, linhas }) }} /></label>
          {editando.produto.fonte === 'bar_produto' && <label className="dadm-muted"><input type="checkbox" checked={l.espelho} onChange={(e) => { const linhas = editando.linhas.map((x, j) => ({ ...x, espelho: j === idx ? e.target.checked : false })); setEditando({ ...editando, linhas }) }} /> espelhar</label>}
        </div>)}
      </div>}
    </Dialog>
  </section>
}

function Pedidos({ itens, unidade, qs, toast, onRecebido }) {
  const razaoAtivo = useRazaoAtivo()
  const [pedidos, setPedidos] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [novo, setNovo] = useState(null)
  const [recebendo, setRecebendo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const carregar = useCallback(async () => {
    try { setPedidos(await api.get(`/api/admin/suprimentos/pedidos${qs()}`)) } catch (error) { toast(error.message, 'error') }
    try { setFornecedores((await api.get('/api/admin/a2/fornecedores')).fornecedores || []) } catch { setFornecedores([]) }
  }, [qs, toast])
  useEffect(() => { carregar() }, [carregar])
  async function criar() {
    try {
      await api.post('/api/admin/suprimentos/pedidos', { lojaId: unidade || null, fornecedorId: novo.fornecedorId || null, fornecedorNome: novo.fornecedorNome, condicaoPagamento: novo.condicao, previsao: novo.previsao || null, itens: novo.linhas.filter((l) => l.itemId && l.quantidade).map((l) => ({ itemId: l.itemId, quantidade: l.quantidade, custoUnitario: l.custo || 0 })) })
      toast('Pedido criado.', 'success'); setNovo(null); carregar()
    } catch (error) { toast(error.message, 'error') }
  }
  async function acao(p, a) { try { await api.post(`/api/admin/suprimentos/pedidos/${p.id}/${a}`, {}); carregar() } catch (error) { toast(error.message, 'error') } }
  async function abrirRecebimento(p) {
    try { const completo = await api.get(`/api/admin/suprimentos/pedidos/${p.id}`); setRecebendo({ pedido: completo, condicao: completo.condicaoPagamento, chave: chaveUnica(), excedente: false, linhas: completo.itens.filter((i) => i.pendente > 0).map((i) => ({ itemId: i.itemId, nome: i.nome, unidade: i.unidade, quantidade: String(i.pendente), custo: String(i.custoUnitario) })) }) }
    catch (error) { toast(error.message, 'error') }
  }
  async function receber() {
    if (enviando) return
    setEnviando(true)
    try {
      const r = await api.post('/api/admin/suprimentos/recebimentos', { pedidoId: recebendo.pedido.id, lojaId: recebendo.pedido.lojaId || unidade || null, condicaoPagamento: recebendo.condicao, idempotencia: recebendo.chave, aceitarExcedente: recebendo.excedente, itens: recebendo.linhas.filter((l) => Number(l.quantidade) > 0).map((l) => ({ itemId: l.itemId, quantidade: l.quantidade, custoUnitario: l.custo })) })
      toast(`Recebido. ${r.contasAPagar.length} conta(s) a pagar ${ondeFicaAConta(razaoAtivo)}.`, 'success'); setRecebendo(null); carregar(); onRecebido()
    } catch (error) { toast(error.message, 'error') } finally { setEnviando(false) }
  }
  return <section className="dadm-card">
    <h2>Pedidos de compra</h2>
    <div className="dadm-actions"><button type="button" className="c360-btn primary" onClick={() => setNovo({ fornecedorId: '', fornecedorNome: '', condicao: 'a_vista', previsao: '', linhas: [{ itemId: '', quantidade: '', custo: '' }] })}>+ Pedido</button></div>
    <Table caption="Pedidos" rows={pedidos} empty="Nenhum pedido." columns={[
      { key: 'numero', label: 'Nº', render: (p) => `#${p.numero}` },
      { key: 'forn', label: 'Fornecedor', render: (p) => p.fornecedorNome },
      { key: 'total', label: 'Total', align: 'right', render: (p) => money(p.total) },
      { key: 'cond', label: 'Pagamento', render: (p) => (p.condicaoPagamento === 'a_vista' ? 'À vista' : `${p.condicaoPagamento} dias`) },
      { key: 'status', label: 'Situação', render: (p) => <Badge tone={STATUS_PEDIDO[p.status]?.[1]}>{STATUS_PEDIDO[p.status]?.[0] || p.status}</Badge> },
      { key: 'acoes', label: 'Ações', render: (p) => <div className="dadm-actions">
        {p.status === 'rascunho' && <button type="button" className="c360-btn ghost" onClick={() => acao(p, 'enviar')}>Marcar enviado</button>}
        {['rascunho', 'enviado', 'parcial'].includes(p.status) && <button type="button" className="c360-btn ghost" onClick={() => abrirRecebimento(p)}>Receber</button>}
        {['rascunho', 'enviado'].includes(p.status) && <button type="button" className="c360-btn ghost" onClick={() => acao(p, 'cancelar')}>Cancelar</button>}
      </div> },
    ]} />
    <Dialog open={Boolean(novo)} title="Novo pedido de compra" labelId="sup-pedido" onClose={() => setNovo(null)} onSubmit={criar}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setNovo(null)}>Voltar</button><button type="submit" className="c360-btn primary">Criar pedido</button></>}>
      {novo && <div style={{ display: 'grid', gap: 10 }}>
        <label className="c360-field">Fornecedor<select className="c360-input" value={novo.fornecedorId} onChange={(e) => setNovo({ ...novo, fornecedorId: e.target.value })}><option value="">Outro (digitar)</option>{fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
        {!novo.fornecedorId && <label className="c360-field">Nome do fornecedor<input className="c360-input" required minLength={2} value={novo.fornecedorNome} onChange={(e) => setNovo({ ...novo, fornecedorNome: e.target.value })} /></label>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="c360-field">Pagamento<input className="c360-input" placeholder="a_vista ou 30/60" value={novo.condicao} onChange={(e) => setNovo({ ...novo, condicao: e.target.value })} /></label>
          <label className="c360-field">Previsão de entrega<input className="c360-input" type="date" value={novo.previsao} onChange={(e) => setNovo({ ...novo, previsao: e.target.value })} /></label>
        </div>
        {novo.linhas.map((l, idx) => <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
          <select className="c360-input" aria-label="Item" value={l.itemId} onChange={(e) => { const linhas = [...novo.linhas]; linhas[idx] = { ...l, itemId: e.target.value, custo: l.custo || String(itens.find((i) => i.id === e.target.value)?.custoMedio || '') }; if (idx === linhas.length - 1 && e.target.value) linhas.push({ itemId: '', quantidade: '', custo: '' }); setNovo({ ...novo, linhas }) }}><option value="">Item…</option>{itens.map((i) => <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>)}</select>
          <input className="c360-input" aria-label="Quantidade" placeholder="Qtd" inputMode="decimal" value={l.quantidade} onChange={(e) => { const linhas = [...novo.linhas]; linhas[idx] = { ...l, quantidade: e.target.value }; setNovo({ ...novo, linhas }) }} />
          <input className="c360-input" aria-label="Custo unitário" placeholder="Custo" inputMode="decimal" value={l.custo} onChange={(e) => { const linhas = [...novo.linhas]; linhas[idx] = { ...l, custo: e.target.value }; setNovo({ ...novo, linhas }) }} />
        </div>)}
      </div>}
    </Dialog>
    <Dialog open={Boolean(recebendo)} title={recebendo ? `Receber pedido #${recebendo.pedido.numero}` : ''} labelId="sup-receber" onClose={() => setRecebendo(null)} onSubmit={receber}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setRecebendo(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={enviando}>Confirmar recebimento</button></>}>
      {recebendo && <div style={{ display: 'grid', gap: 8 }}>
        {recebendo.linhas.map((l, idx) => <div key={l.itemId} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, alignItems: 'end' }}>
          <span>{l.nome}</span>
          <label className="c360-field">Recebido ({l.unidade})<input className="c360-input" inputMode="decimal" value={l.quantidade} onChange={(e) => { const linhas = [...recebendo.linhas]; linhas[idx] = { ...l, quantidade: e.target.value }; setRecebendo({ ...recebendo, linhas }) }} /></label>
          <label className="c360-field">Custo (R$)<input className="c360-input" inputMode="decimal" value={l.custo} onChange={(e) => { const linhas = [...recebendo.linhas]; linhas[idx] = { ...l, custo: e.target.value }; setRecebendo({ ...recebendo, linhas }) }} /></label>
        </div>)}
        <label className="c360-field">Pagamento<input className="c360-input" value={recebendo.condicao} onChange={(e) => setRecebendo({ ...recebendo, condicao: e.target.value })} /></label>
        <label className="dadm-muted"><input type="checkbox" checked={recebendo.excedente} onChange={(e) => setRecebendo({ ...recebendo, excedente: e.target.checked })} /> Chegou mais do que o pedido e vou aceitar o excedente</label>
        <p className="dadm-note">Ao confirmar: entrada no estoque e conta(s) a pagar {ondeFicaAConta(razaoAtivo)}.</p>
      </div>}
    </Dialog>
  </section>
}

function ReceberNfe({ itens, unidade, precisaUnidade, toast, onLancado }) {
  const razaoAtivo = useRazaoAtivo()
  const [enviando, setEnviando] = useState(false)
  const [xml, setXml] = useState('')
  const [previa, setPrevia] = useState(null)
  const [mapa, setMapa] = useState({})
  const [condicao, setCondicao] = useState('a_vista')
  const [confirmarAvisos, setConfirmarAvisos] = useState(false)
  const [recentes, setRecentes] = useState([])
  const carregarRecentes = useCallback(() => api.get('/api/admin/suprimentos/recebimentos').then(setRecentes).catch(() => setRecentes([])), [])
  useEffect(() => { carregarRecentes() }, [carregarRecentes])
  async function lerArquivo(e) { const f = e.target.files?.[0]; if (f) setXml(await f.text()) }
  async function verPrevia() {
    try { const p = await api.post('/api/admin/suprimentos/nfe/previa', { xml }); setPrevia(p); setMapa(Object.fromEntries(p.itens.map((i) => [i.item, { itemId: i.sugestao || '', fator: String(i.fator || 1), criar: !i.sugestao }]))) }
    catch (error) { toast(error.message, 'error') }
  }
  async function lancar() {
    if (enviando || precisaUnidade) return
    setEnviando(true)
    try {
      const mapeamento = previa.itens.map((i) => { const m = mapa[i.item] || {}; return m.itemId ? { item: i.item, itemId: m.itemId, fator: Number(m.fator) || 1 } : { item: i.item, fator: Number(m.fator) || 1, criarItem: { nome: i.descricao, unidade: (i.unidade || 'UN').toUpperCase(), tipo: 'mercadoria' } } })
      const r = await api.post('/api/admin/suprimentos/nfe/lancar', { xml, lojaId: unidade || null, mapeamento, condicaoPagamento: condicao, confirmarAvisos })
      toast(`NF-e lançada: estoque atualizado e ${r.contasAPagar.length} conta(s) a pagar ${ondeFicaAConta(razaoAtivo)}.`, 'success'); setXml(''); setPrevia(null); carregarRecentes(); onLancado()
    } catch (error) { toast(error.message, 'error') } finally { setEnviando(false) }
  }
  return <section className="dadm-card">
    <h2>Receber com NF-e</h2>
    <p className="dadm-muted">Envie o XML da nota do fornecedor. O sistema confere a autorização e o destinatário, sugere os itens e, ao lançar, dá entrada no estoque{precisaUnidade ? ' (escolha a unidade no topo)' : ''} e cria as contas a pagar. Frete e impostos da nota entram no custo dos itens.</p>
    <div className="dadm-filters"><input type="file" accept=".xml,text/xml" onChange={lerArquivo} aria-label="Arquivo XML da NF-e" /><button type="button" className="c360-btn ghost" disabled={!xml} onClick={verPrevia}>Ler a nota</button></div>
    {previa && <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
      <p><strong>NF {previa.numero}/{previa.serie}</strong> · {previa.emitente.fantasia || previa.emitente.nome} · {shortDate(previa.emissao)} · {money(previa.valorNota)} {previa.autorizada ? <Badge tone="success">autorizada</Badge> : <Badge tone="danger">sem autorização</Badge>}</p>
      {previa.jaLancada && <p className="dadm-note danger">Esta nota já foi lançada.</p>}
      {previa.avisos.map((a) => <p key={a} className="dadm-note warn">{a}</p>)}
      {previa.avisos.length > 0 && <label className="dadm-muted"><input type="checkbox" checked={confirmarAvisos} onChange={(e) => setConfirmarAvisos(e.target.checked)} /> Conferi e quero lançar mesmo assim</label>}
      <Table caption="Itens da nota" rows={previa.itens.map((i) => ({ ...i, id: i.item }))} columns={[
        { key: 'desc', label: 'Na nota', render: (i) => <div><strong>{i.descricao}</strong><div className="dadm-muted">{num(i.quantidade)} {i.unidade} × {money(i.custoUnitario)}</div></div> },
        { key: 'item', label: 'Item do estoque', render: (i) => <select className="c360-input" aria-label={`Item para ${i.descricao}`} value={mapa[i.item]?.itemId || ''} onChange={(e) => setMapa({ ...mapa, [i.item]: { ...mapa[i.item], itemId: e.target.value } })}><option value="">Criar item novo</option>{itens.map((x) => <option key={x.id} value={x.id}>{x.nome} ({x.unidade})</option>)}</select> },
        { key: 'fator', label: '1 da nota =', render: (i) => <input className="c360-input" style={{ width: 80 }} aria-label={`Conversão de ${i.descricao}`} inputMode="decimal" value={mapa[i.item]?.fator || '1'} onChange={(e) => setMapa({ ...mapa, [i.item]: { ...mapa[i.item], fator: e.target.value } })} /> },
      ]} />
      <label className="c360-field" style={{ maxWidth: 260 }}>Pagamento<input className="c360-input" placeholder="a_vista ou 30/60" value={condicao} onChange={(e) => setCondicao(e.target.value)} /></label>
      <div className="dadm-actions"><button type="button" className="c360-btn primary" disabled={enviando || precisaUnidade || previa.jaLancada || (previa.avisos.length > 0 && !confirmarAvisos)} title={precisaUnidade ? 'Escolha a unidade no topo' : ''} onClick={lancar}>Lançar nota</button></div>
    </div>}
    <h3 style={{ marginTop: 18 }}>Recebimentos recentes</h3>
    <Table caption="Recebimentos" rows={recentes} empty="Nenhum recebimento." columns={[
      { key: 'quando', label: 'Quando', render: (r) => dateTime(r.criadoEm) },
      { key: 'forn', label: 'Fornecedor', render: (r) => r.fornecedorNome },
      { key: 'nf', label: 'Documento', render: (r) => (r.nfeNumero ? `NF ${r.nfeNumero}` : r.pedidoId ? 'Pedido' : '—') },
      { key: 'valor', label: 'Valor', align: 'right', render: (r) => money(r.valorTotal) },
      { key: 'parc', label: 'Parcelas', render: (r) => (r.parcelas || []).map((p) => `${shortDate(p.vencimento)}: ${money(p.valor)}`).join(' · ') },
    ]} />
  </section>
}

function Relatorios({ qs }) {
  const [sugestao, setSugestao] = useState([])
  const [abc, setAbc] = useState([])
  const [erro, setErro] = useState('')
  useEffect(() => {
    const falhou = (e) => setErro(e.message || 'Não foi possível carregar os relatórios.')
    setErro('')
    api.get(`/api/admin/suprimentos/sugestao-compra${qs()}`).then(setSugestao).catch((e) => { setSugestao([]); falhou(e) })
    api.get('/api/admin/suprimentos/curva-abc?dias=90').then(setAbc).catch((e) => { setAbc([]); falhou(e) })
  }, [qs])
  return <div style={{ display: 'grid', gap: 16 }}>
    {erro && <p className="dadm-note danger" role="alert">{erro}</p>}
    <section className="dadm-card"><h2>Sugestão de compra</h2>
      <Table caption="Sugestão de compra" rows={sugestao} empty="Nada abaixo do mínimo." columns={[
        { key: 'nome', label: 'Item', render: (i) => i.nome }, { key: 'saldo', label: 'Saldo', align: 'right', render: (i) => `${num(i.saldo)} ${i.unidade}` },
        { key: 'min', label: 'Mínimo', align: 'right', render: (i) => num(i.estoqueMinimo) }, { key: 'sug', label: 'Comprar', align: 'right', render: (i) => <strong>{num(i.sugerido)} {i.unidade}</strong> },
        { key: 'custo', label: 'Estimado', align: 'right', render: (i) => money(i.sugerido * i.custoMedio) },
      ]} />
    </section>
    <section className="dadm-card"><h2>Curva ABC (consumo em 90 dias)</h2>
      <Table caption="Curva ABC" rows={abc.map((i) => ({ ...i, id: i.itemId }))} empty="Sem consumo registrado no período." columns={[
        { key: 'classe', label: 'Classe', render: (i) => <Badge tone={i.classe === 'A' ? 'danger' : i.classe === 'B' ? 'warning' : 'muted'}>{i.classe}</Badge> },
        { key: 'nome', label: 'Item', render: (i) => i.nome }, { key: 'qtd', label: 'Consumo', align: 'right', render: (i) => `${num(i.quantidade)} ${i.unidade}` },
        { key: 'valor', label: 'Valor', align: 'right', render: (i) => money(i.valor) }, { key: 'part', label: '%', align: 'right', render: (i) => `${String(i.participacao).replace('.', ',')}%` },
      ]} />
    </section>
  </div>
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { useToast } from '../../../hooks/useToast'
import { useAuth } from '../../../lib/auth'
import { lojasDaEmpresa } from '../../../lib/context-selection'
import { Badge, Dialog, Table } from '../customer360/shared'
import { money, shortDate, dateTime } from '../dino/format'
import '../customer360.css'
import '../dino/dino-admin.css'

// Supermercado/varejo sobre o estoque único: preço por unidade, promoções, lotes e validade,
// etiquetas de gôndola e transferências entre unidades.
const BASE = '/api/admin/varejo'
const ABAS = [['produtos', 'Produtos e preços'], ['promocoes', 'Promoções'], ['lotes', 'Lotes e validade'], ['etiquetas', 'Etiquetas'], ['transferencias', 'Transferências']]
const TIPO_PROMO = { percentual: '% de desconto', valor_fixo: 'R$ de desconto', preco_fixo: 'Preço fixo', leve_pague: 'Leve X, pague Y' }
const STATUS_PROMO = { rascunho: ['Rascunho', 'muted'], ativa: ['Ativa', 'success'], pausada: ['Pausada', 'warning'], encerrada: ['Encerrada', 'muted'] }
const STATUS_TRANSF = { rascunho: ['Rascunho', 'muted'], em_transito: ['Em trânsito', 'info'], recebida: ['Recebida', 'success'], recebida_parcial: ['Recebida em parte', 'warning'], cancelada: ['Cancelada', 'muted'] }
const SITUACAO = { vencido: ['Vencido', 'danger'], critico: ['Vence em até 7 dias', 'danger'], atencao: ['Vence em até 30 dias', 'warning'], normal: ['No prazo', 'success'], sem_validade: ['Sem validade', 'muted'] }
const num = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export default function Varejo({ abaInicial = 'produtos' }) {
  const { toast } = useToast()
  const { empresaAtiva, lojaAtiva, lojasAcessiveis } = useAuth()
  const lojas = useMemo(() => lojasDaEmpresa(lojasAcessiveis, empresaAtiva?.id), [lojasAcessiveis, empresaAtiva?.id])
  const [aba, setAba] = useState(abaInicial)
  const [unidade, setUnidade] = useState(() => lojaAtiva?.id || (lojas.length === 1 ? lojas[0].id : ''))
  const [produtos, setProdutos] = useState([])
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const trava = useRef(false)
  const qs = useCallback((extra = {}) => { const p = new URLSearchParams(); if (unidade) p.set('lojaId', unidade); for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v); const s = p.toString(); return s ? `?${s}` : '' }, [unidade])
  const carregarProdutos = useCallback(async () => {
    try { setProdutos((await api.get(`${BASE}/produtos${qs()}`)).produtos || []); setErro('') } catch (e) { setErro(e.message || 'Não foi possível carregar os produtos.') }
  }, [qs])
  useEffect(() => { carregarProdutos() }, [carregarProdutos, empresaAtiva?.id])
  async function acao(fn, sucesso) {
    if (trava.current) return false
    trava.current = true
    try { const r = await fn(); if (sucesso) toast(typeof sucesso === 'function' ? sucesso(r) : sucesso, 'success'); return r || true } catch (e) { toast(e.message, 'error'); return false } finally { trava.current = false }
  }
  const visiveis = produtos.filter((p) => !busca || `${p.nome} ${p.ean || ''} ${p.plu || ''} ${p.sku || ''}`.toLowerCase().includes(busca.toLowerCase()))
  const nomeLoja = (id) => lojas.find((l) => l.id === id)?.nome || 'Unidade'

  return <div className="dadm-page">
    <header className="dadm-head">
      <div><div className="dadm-eyebrow">Varejo · {empresaAtiva?.nome || 'Empresa'}</div><h1>Supermercado e varejo</h1>
        <p>Preço por unidade, promoções com período, lotes e validade, etiquetas e transferências — tudo sobre o mesmo estoque de Estoque e compras.</p></div>
      <div className="dadm-actions"><label className="dadm-muted">Unidade{' '}<select className="c360-input" aria-label="Unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)}><option value="">Empresa toda</option>{lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></label></div>
    </header>
    <div className="dadm-tabs" role="tablist" aria-label="Seções do varejo">{ABAS.map(([id, r]) => <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}>{r}</button>)}</div>
    {erro && <p className="dadm-note danger" role="alert">{erro}</p>}
    {['produtos', 'etiquetas'].includes(aba) && <div className="dadm-filters"><input className="c360-input" type="search" placeholder="Buscar por nome, EAN, PLU ou SKU" aria-label="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>}
    {aba === 'produtos' && <Produtos produtos={visiveis} unidade={unidade} acao={acao} onMudou={carregarProdutos} />}
    {aba === 'promocoes' && <Promocoes produtos={produtos} unidade={unidade} qs={qs} acao={acao} onMudou={carregarProdutos} />}
    {aba === 'lotes' && <Lotes produtos={produtos} unidade={unidade} qs={qs} acao={acao} />}
    {aba === 'etiquetas' && <Etiquetas produtos={visiveis} qs={qs} unidade={unidade} acao={acao} />}
    {aba === 'transferencias' && <Transferencias produtos={produtos} lojas={lojas} unidade={unidade} qs={qs} acao={acao} nomeLoja={nomeLoja} onMudou={carregarProdutos} />}
  </div>
}

function Produtos({ produtos, unidade, acao, onMudou }) {
  const [form, setForm] = useState(null)
  async function salvar() {
    const corpo = { precoBase: form.precoBase === '' ? null : form.precoBase, departamento: form.departamento, plu: form.plu, pesavel: form.pesavel, controlaLote: form.controlaLote }
    if (unidade) corpo.precoUnidade = form.precoUnidade === '' ? null : form.precoUnidade
    if (await acao(() => api.patch(`${BASE}/produtos/${form.id}${unidade ? `?lojaId=${unidade}` : ''}`, corpo), 'Produto atualizado.')) { setForm(null); onMudou() }
  }
  return <section className="dadm-card">
    <Table caption="Produtos" rows={produtos} empty="Nenhum produto. Cadastre os itens em Estoque e compras (ou lance uma NF-e)." columns={[
      { key: 'n', label: 'Produto', render: (p) => <div><strong>{p.nome}</strong><div className="dadm-muted">{[p.departamento, p.ean && `EAN ${p.ean}`, p.plu && `PLU ${p.plu}`].filter(Boolean).join(' · ')}</div></div> },
      { key: 's', label: 'Saldo', align: 'right', render: (p) => <span className={p.saldo < p.estoqueMinimo ? 'dadm-neg' : ''}>{num(p.saldo)} {p.unidade}</span> },
      { key: 'c', label: 'Custo', align: 'right', render: (p) => money(p.custoMedio) },
      { key: 'p', label: 'Preço', align: 'right', render: (p) => (p.precoFinal == null ? <Badge tone="warning">sem preço</Badge> : <div>{p.promocao && <s className="dadm-muted">{money(p.precoBase)}</s>} <strong>{money(p.precoFinal)}</strong>{p.promocao && <div><Badge tone="success">{p.promocao.texto}</Badge></div>}{p.precoDaUnidade != null && !p.promocao && <div className="dadm-muted">preço da unidade</div>}</div>) },
      { key: 'm', label: 'Margem', align: 'right', render: (p) => (p.margem == null ? '—' : <span className={p.margem < 15 ? 'dadm-neg' : ''}>{String(p.margem).replace('.', ',')}%</span>) },
      { key: 'a', label: '', render: (p) => <button type="button" className="c360-btn ghost" onClick={() => setForm({ id: p.id, nome: p.nome, precoBase: p.precoBase ?? '', precoUnidade: p.precoDaUnidade ?? '', departamento: p.departamento || '', plu: p.plu || '', pesavel: p.pesavel, controlaLote: p.controlaLote })}>Preço e cadastro</button> },
    ]} />
    <Dialog open={Boolean(form)} title={form?.nome || ''} labelId="var-prod" onClose={() => setForm(null)} onSubmit={salvar}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setForm(null)}>Voltar</button><button type="submit" className="c360-btn primary">Salvar</button></>}>
      {form && <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="c360-field">Preço de venda (empresa toda)<input className="c360-input" inputMode="decimal" value={form.precoBase} onChange={(e) => setForm({ ...form, precoBase: e.target.value })} /></label>
          {unidade && <label className="c360-field">Preço nesta unidade (vazio = o da empresa)<input className="c360-input" inputMode="decimal" value={form.precoUnidade} onChange={(e) => setForm({ ...form, precoUnidade: e.target.value })} /></label>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
          <label className="c360-field">Departamento<input className="c360-input" maxLength={80} value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })} /></label>
          <label className="c360-field">PLU (balança)<input className="c360-input" inputMode="numeric" maxLength={6} value={form.plu} onChange={(e) => setForm({ ...form, plu: e.target.value })} /></label>
        </div>
        <label className="dadm-muted"><input type="checkbox" checked={form.pesavel} onChange={(e) => setForm({ ...form, pesavel: e.target.checked })} /> Vendido por peso</label>
        <label className="dadm-muted"><input type="checkbox" checked={form.controlaLote} onChange={(e) => setForm({ ...form, controlaLote: e.target.checked })} /> Controla lote e validade</label>
      </div>}
    </Dialog>
  </section>
}

function Promocoes({ produtos, unidade, qs, acao, onMudou }) {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(null)
  const carregar = useCallback(() => api.get(`${BASE}/promocoes${qs()}`).then((r) => setLista(r.promocoes || [])).catch(() => setLista([])), [qs])
  useEffect(() => { carregar() }, [carregar])
  const nomes = new Map(produtos.map((p) => [p.id, p.nome]))
  async function criar() {
    if (await acao(() => api.post(`${BASE}/promocoes${qs()}`, { ...form, inicio: new Date(form.inicio).toISOString(), fim: new Date(form.fim).toISOString(), daUnidade: Boolean(form.daUnidade && unidade) }), 'Promoção criada.')) { setForm(null); carregar(); onMudou() }
  }
  async function status(p, s) { if (await acao(() => api.patch(`${BASE}/promocoes/${p.id}/status`, { status: s }), 'Promoção atualizada.')) { carregar(); onMudou() } }
  return <section className="dadm-card">
    <div className="dadm-actions"><button type="button" className="c360-btn primary" onClick={() => setForm({ nome: '', tipo: 'percentual', percentual: '', valorDesconto: '', precoFixo: '', leve: '', pague: '', inicio: '', fim: '', itens: [], status: 'ativa', daUnidade: false })}>+ Promoção</button></div>
    <Table caption="Promoções" rows={lista} empty="Nenhuma promoção." columns={[
      { key: 'n', label: 'Promoção', render: (p) => <div><strong>{p.nome}</strong><div className="dadm-muted">{TIPO_PROMO[p.tipo]} · {p.itens.map((i) => nomes.get(i) || 'produto').slice(0, 4).join(', ')}{p.itens.length > 4 ? '…' : ''}</div></div> },
      { key: 'per', label: 'Período', render: (p) => `${dateTime(p.inicio)} a ${dateTime(p.fim)}` },
      { key: 's', label: 'Situação', render: (p) => <Badge tone={STATUS_PROMO[p.status]?.[1]}>{STATUS_PROMO[p.status]?.[0]}</Badge> },
      { key: 'a', label: '', render: (p) => <div className="dadm-actions">
        {['rascunho', 'pausada'].includes(p.status) && <button type="button" className="c360-btn ghost" onClick={() => status(p, 'ativa')}>Ativar</button>}
        {p.status === 'ativa' && <button type="button" className="c360-btn ghost" onClick={() => status(p, 'pausada')}>Pausar</button>}
        {p.status !== 'encerrada' && <button type="button" className="c360-btn ghost" onClick={() => status(p, 'encerrada')}>Encerrar</button>}
      </div> },
    ]} />
    <Dialog open={Boolean(form)} title="Nova promoção" labelId="var-promo" onClose={() => setForm(null)} onSubmit={criar}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setForm(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={!form?.itens?.length}>Criar</button></>}>
      {form && <div style={{ display: 'grid', gap: 10 }}>
        <label className="c360-field">Nome<input className="c360-input" required minLength={2} maxLength={120} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></label>
        <label className="c360-field">Tipo<select className="c360-input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{Object.entries(TIPO_PROMO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
        {form.tipo === 'percentual' && <label className="c360-field">Desconto (%)<input className="c360-input" required inputMode="decimal" value={form.percentual} onChange={(e) => setForm({ ...form, percentual: e.target.value })} /></label>}
        {form.tipo === 'valor_fixo' && <label className="c360-field">Desconto (R$)<input className="c360-input" required inputMode="decimal" value={form.valorDesconto} onChange={(e) => setForm({ ...form, valorDesconto: e.target.value })} /></label>}
        {form.tipo === 'preco_fixo' && <label className="c360-field">Preço promocional (R$)<input className="c360-input" required inputMode="decimal" value={form.precoFixo} onChange={(e) => setForm({ ...form, precoFixo: e.target.value })} /></label>}
        {form.tipo === 'leve_pague' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><label className="c360-field">Leve<input className="c360-input" required inputMode="numeric" value={form.leve} onChange={(e) => setForm({ ...form, leve: e.target.value })} /></label><label className="c360-field">Pague<input className="c360-input" required inputMode="numeric" value={form.pague} onChange={(e) => setForm({ ...form, pague: e.target.value })} /></label></div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="c360-field">Início<input className="c360-input" required type="datetime-local" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} /></label>
          <label className="c360-field">Fim<input className="c360-input" required type="datetime-local" value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} /></label>
        </div>
        <label className="c360-field">Produtos<select className="c360-input" multiple size={6} value={form.itens} onChange={(e) => setForm({ ...form, itens: [...e.target.selectedOptions].map((o) => o.value) })}>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
        {unidade && <label className="dadm-muted"><input type="checkbox" checked={form.daUnidade} onChange={(e) => setForm({ ...form, daUnidade: e.target.checked })} /> Só nesta unidade</label>}
      </div>}
    </Dialog>
  </section>
}

function Lotes({ produtos, unidade, qs, acao }) {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(null)
  const carregar = useCallback(() => api.get(`${BASE}/lotes${qs()}`).then((r) => setLista(r.lotes || [])).catch(() => setLista([])), [qs])
  useEffect(() => { carregar() }, [carregar])
  async function salvar() { if (await acao(() => api.post(`${BASE}/lotes${qs()}`, { ...form, quantidade: form.saida ? -Math.abs(Number(String(form.quantidade).replace(',', '.'))) : form.quantidade }), 'Lote registrado.')) { setForm(null); carregar() } }
  const criticos = lista.filter((l) => ['vencido', 'critico'].includes(l.situacao)).length
  return <section className="dadm-card">
    {criticos > 0 && <p className="dadm-note danger">{criticos} lote(s) vencido(s) ou vencendo em até 7 dias.</p>}
    <div className="dadm-actions"><button type="button" className="c360-btn primary" disabled={!unidade} title={unidade ? '' : 'Escolha a unidade no topo'} onClick={() => setForm({ itemId: '', lote: '', validade: '', quantidade: '', saida: false })}>+ Movimentar lote</button></div>
    <Table caption="Lotes" rows={lista} empty="Nenhum lote com saldo." columns={[
      { key: 'p', label: 'Produto', render: (l) => <div><strong>{l.itemNome}</strong><div className="dadm-muted">Lote {l.lote}</div></div> },
      { key: 'v', label: 'Validade', render: (l) => (l.validade ? shortDate(l.validade) : '—') },
      { key: 'q', label: 'Quantidade', align: 'right', render: (l) => `${num(l.quantidade)} ${l.unidade}` },
      { key: 's', label: 'Situação', render: (l) => <Badge tone={SITUACAO[l.situacao]?.[1]}>{SITUACAO[l.situacao]?.[0]}{l.diasParaVencer != null && l.diasParaVencer >= 0 ? ` (${l.diasParaVencer} d)` : ''}</Badge> },
    ]} />
    <Dialog open={Boolean(form)} title="Movimentar lote" labelId="var-lote" onClose={() => setForm(null)} onSubmit={salvar}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setForm(null)}>Voltar</button><button type="submit" className="c360-btn primary">Registrar</button></>}>
      {form && <div style={{ display: 'grid', gap: 10 }}>
        <label className="c360-field">Produto<select className="c360-input" required value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}><option value="">—</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <label className="c360-field">Lote<input className="c360-input" required maxLength={60} value={form.lote} onChange={(e) => setForm({ ...form, lote: e.target.value })} /></label>
          <label className="c360-field">Validade<input className="c360-input" type="date" value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} /></label>
          <label className="c360-field">Quantidade<input className="c360-input" required inputMode="decimal" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} /></label>
        </div>
        <label className="dadm-muted"><input type="checkbox" checked={form.saida} onChange={(e) => setForm({ ...form, saida: e.target.checked })} /> É saída (venda, perda ou descarte do lote)</label>
        <p className="dadm-muted">O lote controla validade; o saldo do estoque continua vindo das entradas, vendas e perdas.</p>
      </div>}
    </Dialog>
  </section>
}

function Etiquetas({ produtos, qs, unidade, acao }) {
  const [marcados, setMarcados] = useState({})
  const [formato, setFormato] = useState('gondola_100x40')
  const [geradas, setGeradas] = useState(null)
  async function gerar() {
    const itens = Object.entries(marcados).filter(([, q]) => Number(q) > 0).map(([itemId, quantidade]) => ({ itemId, quantidade: Number(quantidade) }))
    const r = await acao(() => api.post(`${BASE}/etiquetas${qs()}`, { itens, formato }), (x) => `${x.etiquetas.length} etiqueta(s) prontas para imprimir.`)
    if (r) setGeradas(r.etiquetas)
  }
  return <section className="dadm-card">
    {!unidade && <p className="dadm-note warn">Sem unidade escolhida, a etiqueta usa o preço da empresa (sem o preço da unidade).</p>}
    <div className="dadm-filters">
      <select className="c360-input" aria-label="Formato" value={formato} onChange={(e) => setFormato(e.target.value)}><option value="gondola_100x40">Gôndola 100×40</option><option value="gondola_60x30">Gôndola 60×30</option><option value="adesivo_40x25">Adesivo 40×25</option></select>
      <button type="button" className="c360-btn primary" disabled={!Object.values(marcados).some((q) => Number(q) > 0)} onClick={gerar}>Gerar etiquetas</button>
      {geradas && <button type="button" className="c360-btn ghost" onClick={() => window.print()}>Imprimir</button>}
    </div>
    {geradas && <div className="var-etiquetas" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0' }}>{geradas.flatMap((e) => Array.from({ length: e.quantidade }, (_, i) => <div key={`${e.id}-${i}`} style={{ border: '1px solid var(--line, #ccc)', borderRadius: 6, padding: 8, width: formato === 'adesivo_40x25' ? 150 : 260 }}>
      <div style={{ fontWeight: 700 }}>{e.nome}</div>
      {e.precoDe != null && <div className="dadm-muted"><s>{money(e.precoDe)}</s> · {e.promocao}</div>}
      <div style={{ fontSize: 26, fontWeight: 800 }}>{money(e.preco)}</div>
      <div className="dadm-muted">{e.ean ? `EAN ${e.ean}` : e.plu ? `PLU ${e.plu}` : ''} · {e.unidade}</div>
    </div>))}</div>}
    <Table caption="Escolha os produtos" rows={produtos} empty="Nenhum produto." columns={[
      { key: 'n', label: 'Produto', render: (p) => p.nome },
      { key: 'p', label: 'Preço', align: 'right', render: (p) => (p.precoFinal == null ? <Badge tone="warning">sem preço</Badge> : money(p.precoFinal)) },
      { key: 'q', label: 'Etiquetas', render: (p) => <input className="c360-input" style={{ width: 70 }} inputMode="numeric" aria-label={`Etiquetas de ${p.nome}`} disabled={p.precoFinal == null} value={marcados[p.id] || ''} onChange={(e) => setMarcados({ ...marcados, [p.id]: e.target.value })} /> },
    ]} />
  </section>
}

function Transferencias({ produtos, lojas, unidade, qs, acao, nomeLoja, onMudou }) {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(null)
  const [recebendo, setRecebendo] = useState(null)
  const carregar = useCallback(() => api.get(`${BASE}/transferencias${qs()}`).then((r) => setLista(r.transferencias || [])).catch(() => setLista([])), [qs])
  useEffect(() => { carregar() }, [carregar])
  async function criar() { if (await acao(() => api.post(`${BASE}/transferencias`, { origemId: form.origemId, destinoId: form.destinoId, observacao: form.observacao, itens: form.itens.filter((i) => i.itemId && Number(i.quantidade) > 0) }), 'Transferência criada.')) { setForm(null); carregar() } }
  async function fazer(t, a, corpo = {}) { if (await acao(() => api.post(`${BASE}/transferencias/${t.id}/${a}`, corpo), { enviar: 'Enviada: saiu do estoque da origem.', receber: 'Recebida: entrou no estoque do destino.', cancelar: 'Transferência cancelada.' }[a])) { setRecebendo(null); carregar(); onMudou() } }
  return <section className="dadm-card">
    <div className="dadm-actions"><button type="button" className="c360-btn primary" disabled={lojas.length < 2} onClick={() => setForm({ origemId: unidade || lojas[0]?.id || '', destinoId: '', observacao: '', itens: [{ itemId: '', quantidade: '' }] })}>+ Transferência</button></div>
    <Table caption="Transferências" rows={lista} empty="Nenhuma transferência." columns={[
      { key: 'n', label: 'Nº', render: (t) => `#${t.numero}` },
      { key: 'r', label: 'De → para', render: (t) => `${t.origemNome || nomeLoja(t.origemId)} → ${t.destinoNome || nomeLoja(t.destinoId)}` },
      { key: 'i', label: 'Itens', render: (t) => t.itens.map((i) => `${num(i.quantidade)} ${i.unidade} ${i.nome}${i.recebido != null && i.recebido !== i.quantidade ? ` (chegou ${num(i.recebido)})` : ''}`).join(', ') },
      { key: 's', label: 'Situação', render: (t) => <Badge tone={STATUS_TRANSF[t.status]?.[1]}>{STATUS_TRANSF[t.status]?.[0]}</Badge> },
      { key: 'a', label: '', render: (t) => <div className="dadm-actions">
        {t.status === 'rascunho' && <button type="button" className="c360-btn ghost" onClick={() => fazer(t, 'enviar')}>Enviar</button>}
        {t.status === 'em_transito' && <button type="button" className="c360-btn ghost" onClick={() => setRecebendo({ t, recebidos: Object.fromEntries(t.itens.map((i) => [i.itemId, String(i.quantidade)])) })}>Receber</button>}
        {['rascunho', 'em_transito'].includes(t.status) && <button type="button" className="c360-btn ghost" onClick={() => fazer(t, 'cancelar')}>Cancelar</button>}
      </div> },
    ]} />
    <Dialog open={Boolean(form)} title="Nova transferência" labelId="var-transf" onClose={() => setForm(null)} onSubmit={criar}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setForm(null)}>Voltar</button><button type="submit" className="c360-btn primary">Criar</button></>}>
      {form && <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="c360-field">De<select className="c360-input" required value={form.origemId} onChange={(e) => setForm({ ...form, origemId: e.target.value })}>{lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>
          <label className="c360-field">Para<select className="c360-input" required value={form.destinoId} onChange={(e) => setForm({ ...form, destinoId: e.target.value })}><option value="">—</option>{lojas.filter((l) => l.id !== form.origemId).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>
        </div>
        {form.itens.map((it, idx) => <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 8 }}>
          <select className="c360-input" aria-label="Produto" value={it.itemId} onChange={(e) => { const itens = [...form.itens]; itens[idx] = { ...it, itemId: e.target.value }; if (idx === itens.length - 1 && e.target.value) itens.push({ itemId: '', quantidade: '' }); setForm({ ...form, itens }) }}><option value="">Produto…</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
          <input className="c360-input" aria-label="Quantidade" placeholder="Qtd" inputMode="decimal" value={it.quantidade} onChange={(e) => { const itens = [...form.itens]; itens[idx] = { ...it, quantidade: e.target.value }; setForm({ ...form, itens }) }} />
        </div>)}
      </div>}
    </Dialog>
    <Dialog open={Boolean(recebendo)} title={recebendo ? `Receber transferência #${recebendo.t.numero}` : ''} labelId="var-receber" onClose={() => setRecebendo(null)}
      onSubmit={() => fazer(recebendo.t, 'receber', { recebidos: Object.entries(recebendo.recebidos).map(([itemId, quantidade]) => ({ itemId, quantidade: Number(String(quantidade).replace(',', '.')) })) })}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setRecebendo(null)}>Voltar</button><button type="submit" className="c360-btn primary">Confirmar recebimento</button></>}>
      {recebendo && <div style={{ display: 'grid', gap: 8 }}>
        {recebendo.t.itens.map((i) => <label key={i.itemId} className="c360-field">{i.nome} (enviado {num(i.quantidade)} {i.unidade})<input className="c360-input" inputMode="decimal" value={recebendo.recebidos[i.itemId]} onChange={(e) => setRecebendo({ ...recebendo, recebidos: { ...recebendo.recebidos, [i.itemId]: e.target.value } })} /></label>)}
        <p className="dadm-muted">O que não chegou volta para o estoque da origem.</p>
      </div>}
    </Dialog>
  </section>
}
